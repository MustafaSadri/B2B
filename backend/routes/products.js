const router = require('express').Router();
const path = require('path');
const multer = require('multer');
const Product = require('../models/Product');
const Category = require('../models/Category');
const PriceList = require('../models/PriceList');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');
const msService = require('../services/moysklad');

const isProd = process.env.NODE_ENV === 'production';

// Local disk storage (development)
const diskStorage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `product-${req.params.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage: isProd ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// S3 upload helper (production only)
const uploadToS3 = async (file, productId) => {
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({
    region: 'ru-central1',
    endpoint: process.env.S3_ENDPOINT,
    credentials: { accessKeyId: process.env.S3_KEY, secretAccessKey: process.env.S3_SECRET },
  });
  const ext = file.originalname.split('.').pop() || 'jpg';
  const key = `products/product-${productId}-${Date.now()}.${ext}`;
  await client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read',
  }));
  return `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${key}`;
};

// ─── GET /api/products ────────────────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    const { category, search, page = 1, limit = 60 } = req.query;
    const query = { isActive: true };

    if (category) query.categoryId = category;
    if (search) {
      query.$or = [
        { 'name.ru': { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('categoryId', 'name')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ 'name.ru': 1 }),
      Product.countDocuments(query),
    ]);

    // Resolve customer price
    let priceListId = null;
    if (req.user.role === 'customer' && req.user.priceListId) {
      priceListId = String(req.user.priceListId);
    }

    const productsOut = products.map((p) => {
      const obj = p.toObject();
      let price = obj.basePrice;
      if (priceListId) {
        const entry = obj.priceLists?.find((pl) => String(pl.priceListId) === priceListId);
        if (entry && entry.price > 0) price = entry.price;
      }
      obj.displayPrice = price;
      if (req.user.role !== 'admin') delete obj.priceLists;
      return obj;
    });

    res.json({ success: true, products: productsOut, total, page: parseInt(page) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET /api/products/:id ────────────────────────────────────────────────────
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('categoryId', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── POST /api/products/sync — full MoySklad sync ────────────────────────────
router.post('/sync', verifyToken, requireAdmin, async (req, res) => {
  try {
    msService.clearCache();

    // 1. Fetch all three in parallel
    const [assortmentData, stockRows, productFolders] = await Promise.all([
      msService.msAll('/entity/assortment?expand=productFolder'),
      msService.getStock(),
      msService.getProductGroups(),
    ]);

    const assortmentItems = assortmentData.rows;

    // 2. Sync categories from MoySklad folders
    for (const folder of productFolders) {
      await Category.findOneAndUpdate(
        { moyskladGroupId: folder.id },
        { $set: { 'name.ru': folder.name, 'name.en': folder.name, moyskladGroupId: folder.id, isActive: true } },
        { upsert: true, new: true }
      );
    }

    // 3. Build category map: moyskladGroupId → Category._id
    const allCats = await Category.find();
    const catMap = {};
    allCats.forEach((c) => { if (c.moyskladGroupId) catMap[c.moyskladGroupId] = c._id; });

    // 4. Build price lists from the price types embedded in the first product
    const firstItem = assortmentItems.find((a) => a.salePrices?.length);
    if (firstItem) {
      for (const sp of firstItem.salePrices) {
        const ptId = sp.priceType?.id;
        const ptName = sp.priceType?.name;
        if (ptId && ptName) {
          await PriceList.findOneAndUpdate(
            { moyskladPriceTypeId: ptId },
            { $set: { moyskladPriceTypeId: ptId, name: ptName, isActive: true } },
            { upsert: true, new: true }
          );
        }
      }
    }
    const priceLists = await PriceList.find({ isActive: true });

    // 5. Build stock map: UUID → quantity
    const stockMap = {};
    for (const s of stockRows) {
      const href = s.meta?.href || s.assortment?.meta?.href || '';
      const uuid = href.split('/').pop().split('?')[0];
      if (uuid) stockMap[uuid] = s.stock ?? s.quantity ?? 0;
    }

    // 6. Upsert each assortment item into products collection
    let created = 0, updated = 0;

    for (const item of assortmentItems) {
      const msId = item.id;
      const isVariant = item.meta?.type === 'variant';

      // Resolve category
      let categoryId = null;
      const folderHref = item.productFolder?.meta?.href;
      if (folderHref) {
        const folderId = folderHref.split('/').pop().split('?')[0];
        categoryId = catMap[folderId] || null;
      }

      // Resolve price list entries
      const plEntries = [];
      let basePrice = 0;
      if (item.salePrices?.length) {
        basePrice = (item.salePrices[0].value || 0) / 100;
        for (const sp of item.salePrices) {
          const ptId = sp.priceType?.id;
          const pl = priceLists.find((p) => p.moyskladPriceTypeId === ptId);
          if (pl) {
            plEntries.push({ priceListId: pl._id, priceListName: pl.name, price: (sp.value || 0) / 100 });
          }
        }
      }

      const stock = stockMap[msId] ?? 0;

      const updateDoc = {
        moyskladProductId: msId,
        moyskladHref: item.meta?.href || null,
        'name.ru': item.name || '',
        'name.en': item.name || '',
        sku: item.article || item.code || '',
        stock,
        unit: item.uom?.name || 'шт',
        basePrice,
        priceLists: plEntries,
        categoryId,
        isActive: !item.archived,
        isVariant,
        lastSyncedAt: new Date(),
      };

      const existing = await Product.findOne({ moyskladProductId: msId });
      if (existing) {
        await Product.updateOne({ _id: existing._id }, { $set: updateDoc });
        updated++;
      } else {
        await Product.create(updateDoc);
        created++;
      }
    }

    res.json({
      success: true,
      message: `Sync done. Created: ${created}, Updated: ${updated}. Total products: ${created + updated}.`,
    });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/products/:id — admin updates (e.g. category assignment) ───────
router.patch('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const allowed = ['categoryId', 'isActive', 'minOrderQty', 'name', 'description', 'basePrice', 'images', 'loyaltyPercentage'];
    const update = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const product = await Product.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
      .populate('categoryId', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── POST /api/products/:id/upload-image ─────────────────────────────────────
router.post('/:id/upload-image', verifyToken, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    let imageUrl;
    if (isProd) {
      imageUrl = await uploadToS3(req.file, req.params.id);
    } else {
      const base = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
      imageUrl = `${base}/uploads/${req.file.filename}`;
    }

    await Product.findByIdAndUpdate(req.params.id, { $set: { images: [imageUrl] } });
    res.json({ success: true, imageUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/products/bulk-category — assign category to many products ──────
router.post('/bulk-category', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { productIds, categoryId } = req.body;
    if (!productIds?.length) return res.status(400).json({ success: false, message: 'productIds required.' });
    await Product.updateMany({ _id: { $in: productIds } }, { $set: { categoryId: categoryId || null } });
    res.json({ success: true, message: `Updated ${productIds.length} products.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
