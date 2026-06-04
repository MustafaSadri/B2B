const router = require('express').Router();
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const PriceList = require('../models/PriceList');
const Coupon = require('../models/Coupon');
const AuditLog = require('../models/AuditLog');
const Settings = require('../models/Settings');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');
const analytics = require('../services/analytics');
const msService = require('../services/moysklad');

// GET /api/admin/dashboard
router.get('/dashboard', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [summary, trend, topCustomers, repPerformance, lowStock] = await Promise.all([
      analytics.getGrowthSummary(),
      analytics.getRevenueTrend(30),
      analytics.getTopCustomers(5),
      analytics.getSalesRepPerformance(30),
      analytics.getLowStockProducts(100),
    ]);

    const [totalSalesReps, pendingOrders, recentOrders] = await Promise.all([
      User.countDocuments({ role: 'salesRep', isActive: true }),
      Order.countDocuments({ status: 'pending' }),
      Order.find({ status: { $nin: ['cancelled'] } })
        .populate('customerId', 'name companyName')
        .populate('salesRepId', 'name')
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    res.json({
      success: true,
      summary: { ...summary, totalSalesReps, pendingOrders },
      trend,
      topCustomers,
      repPerformance,
      lowStock,
      recentOrders,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/admin/analytics — detailed analytics
router.get('/analytics', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const [trend, topCustomers, repPerformance, growth] = await Promise.all([
      analytics.getRevenueTrend(parseInt(days)),
      analytics.getTopCustomers(10, parseInt(days)),
      analytics.getSalesRepPerformance(parseInt(days)),
      analytics.getGrowthSummary(),
    ]);

    res.json({ success: true, trend, topCustomers, repPerformance, growth });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/admin/orders — all orders with filters
router.get('/orders', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status, salesRepId, customerId, page = 1, limit = 30 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (salesRepId) query.salesRepId = salesRepId;
    if (customerId) query.customerId = customerId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('customerId', 'name username companyName')
        .populate('salesRepId', 'name username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(query),
    ]);

    res.json({ success: true, orders, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Price Lists ──────────────────────────────────────────────────────────────

// GET /api/admin/pricelists — readable by salesRep too
router.get('/pricelists', verifyToken, async (req, res) => {
  const priceLists = await PriceList.find({ isActive: true }).sort({ name: 1 });
  res.json({ success: true, priceLists });
});

// POST /api/admin/pricelists
router.post('/pricelists', verifyToken, requireAdmin, async (req, res) => {
  try {
    const pl = await PriceList.create(req.body);
    res.status(201).json({ success: true, priceList: pl });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/admin/pricelists/sync
router.post('/pricelists/sync', verifyToken, requireAdmin, async (req, res) => {
  try {
    msService.clearCache('price_types');
    const priceTypes = await msService.getPriceTypes();
    let created = 0;

    for (const pt of priceTypes) {
      const existing = await PriceList.findOne({ moyskladPriceTypeId: pt.id });
      if (!existing) {
        await PriceList.create({ moyskladPriceTypeId: pt.id, name: pt.name || 'Price List' });
        created++;
      }
    }
    res.json({ success: true, message: `Synced. Created: ${created}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/pricelists/:id
router.patch('/pricelists/:id', verifyToken, requireAdmin, async (req, res) => {
  const pl = await PriceList.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, priceList: pl });
});

// ─── Coupons ──────────────────────────────────────────────────────────────────

// GET /api/admin/coupons
router.get('/coupons', verifyToken, requireAdmin, async (req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 }).populate('assignedTo', 'name username');
  res.json({ success: true, coupons });
});

// POST /api/admin/coupons
router.post('/coupons', verifyToken, requireAdmin, async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({ success: true, coupon });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/coupons/:id
router.patch('/coupons/:id', verifyToken, requireAdmin, async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, coupon });
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

router.get('/audit-logs', verifyToken, requireAdmin, async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const logs = await AuditLog.find()
    .populate('actorId', 'name username role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  const total = await AuditLog.countDocuments();
  res.json({ success: true, logs, total });
});

// ─── Live MoySklad inventory ──────────────────────────────────────────────────

// GET /api/admin/inventory/live  — fresh data straight from MoySklad
router.get('/inventory/live', verifyToken, requireAdmin, async (req, res) => {
  try {
    msService.clearCache('stock_all');
    const [stockRows, allProducts, categories] = await Promise.all([
      msService.msAll('/report/stock/all').then(r => r.rows),
      Product.find().populate('categoryId', 'name').lean(),
      require('../models/Category').find({ isActive: true }).lean(),
    ]);

    // Build stock map UUID → row
    const stockMap = {};
    for (const s of stockRows) {
      const href = s.meta?.href || '';
      const uuid = href.split('/').pop().split('?')[0];
      if (uuid) stockMap[uuid] = s;
    }

    // Merge live stock into DB products
    const merged = allProducts.map((p) => {
      const live = stockMap[p.moyskladProductId] || {};
      return {
        ...p,
        liveStock: live.stock ?? live.quantity ?? p.stock ?? 0,
        livePrice: live.salePrice ? (live.salePrice.value || 0) / 100 : p.basePrice,
        inTransit: live.inTransit || 0,
        reserve: live.reserve || 0,
      };
    });

    res.json({ success: true, products: merged, categories, total: merged.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/inventory/publish  — toggle isActive (publish/hide)
router.patch('/inventory/publish', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { productIds, isActive } = req.body;
    if (!productIds?.length) return res.status(400).json({ success: false, message: 'productIds required' });
    await Product.updateMany({ _id: { $in: productIds } }, { $set: { isActive } });
    res.json({ success: true, updated: productIds.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/inventory/categorise  — bulk assign category
router.patch('/inventory/categorise', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { productIds, categoryId } = req.body;
    if (!productIds?.length) return res.status(400).json({ success: false, message: 'productIds required' });
    await Product.updateMany({ _id: { $in: productIds } }, { $set: { categoryId: categoryId || null } });
    res.json({ success: true, updated: productIds.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/inventory/sync-now  — full resync from MoySklad
router.post('/inventory/sync-now', verifyToken, requireAdmin, async (req, res) => {
  try {
    const Category = require('../models/Category');
    const PriceList = require('../models/PriceList');
    msService.clearCache();

    const [assortmentData, stockRows] = await Promise.all([
      msService.msAll('/entity/assortment?expand=productFolder'),
      msService.msAll('/report/stock/all').then(r => r.rows),
    ]);

    const stockMap = {};
    for (const s of stockRows) {
      const uuid = (s.meta?.href || '').split('/').pop().split('?')[0];
      if (uuid) stockMap[uuid] = s.stock ?? s.quantity ?? 0;
    }

    const priceLists = await PriceList.find({ isActive: true });
    const allCats = await Category.find();
    const catMap = {};
    allCats.forEach(c => { if (c.moyskladGroupId) catMap[c.moyskladGroupId] = c._id; });

    let created = 0, updated = 0;
    for (const item of assortmentData.rows) {
      const msId = item.id;
      const folderHref = item.productFolder?.meta?.href;
      let categoryId = null;
      if (folderHref) {
        const fId = folderHref.split('/').pop().split('?')[0];
        categoryId = catMap[fId] || null;
      }

      const plEntries = [];
      let basePrice = 0;
      if (item.salePrices?.length) {
        basePrice = (item.salePrices[0].value || 0) / 100;
        for (const sp of item.salePrices) {
          const pl = priceLists.find(p => p.moyskladPriceTypeId === sp.priceType?.id);
          if (pl) plEntries.push({ priceListId: pl._id, priceListName: pl.name, price: (sp.value || 0) / 100 });
        }
      }

      const doc = {
        moyskladProductId: msId,
        moyskladHref: item.meta?.href || null,
        'name.ru': item.name || '',
        'name.en': item.name || '',
        sku: item.article || item.code || '',
        stock: stockMap[msId] ?? 0,
        unit: item.uom?.name || 'шт',
        basePrice,
        priceLists: plEntries,
        isVariant: item.meta?.type === 'variant',
        lastSyncedAt: new Date(),
      };

      const exists = await Product.findOne({ moyskladProductId: msId });
      if (exists) {
        // preserve categoryId and isActive if already set by admin
        await Product.updateOne({ _id: exists._id }, { $set: { ...doc, categoryId: exists.categoryId ?? categoryId } });
        updated++;
      } else {
        // new products start hidden — admin must publish
        await Product.create({ ...doc, categoryId, isActive: false });
        created++;
      }
    }

    res.json({ success: true, message: `Sync done. Created: ${created}, Updated: ${updated}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/settings
router.get('/settings', verifyToken, requireAdmin, async (req, res) => {
  try {
    const settings = await Settings.get();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/settings
router.patch('/settings', verifyToken, requireAdmin, async (req, res) => {
  try {
    const allowed = ['signupBonusPoints', 'globalLoyaltyPercentage', 'defaultMinOrderQty'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = Number(req.body[k]); });
    const settings = await Settings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
