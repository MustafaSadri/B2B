/**
 * Full one-time setup script.
 * Run: node scripts/setup.js
 *
 * Does everything in order:
 *  1. Seed admin user
 *  2. Sync MoySklad categories (product folders)
 *  3. Sync price lists (price types)
 *  4. Sync all products + variants from assortment
 *  5. Apply stock levels
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fetch = require('node-fetch');

const User = require('../models/User');
const Category = require('../models/Category');
const PriceList = require('../models/PriceList');
const Product = require('../models/Product');

const BASE = 'https://api.moysklad.ru/api/remap/1.2';
const TOKEN = process.env.MOYSKLAD_API_TOKEN;
const headers = { 'Authorization': 'Bearer ' + TOKEN, 'Accept': 'application/json;charset=utf-8' };

// ─── helpers ──────────────────────────────────────────────────────────────────

const get = async (path) => {
  const r = await fetch(BASE + path, { headers });
  if (!r.ok) throw new Error(`MoySklad ${r.status}: ${path}`);
  return r.json();
};

// Auto-paginate
const getAll = async (path) => {
  const sep = path.includes('?') ? '&' : '?';
  const first = await get(`${path}${sep}limit=1000&offset=0`);
  const total = first.meta?.size || 0;
  let rows = first.rows || [];
  if (total > 1000) {
    for (let offset = 1000; offset < total; offset += 1000) {
      const page = await get(`${path}${sep}limit=1000&offset=${offset}`);
      rows = rows.concat(page.rows || []);
    }
  }
  return rows;
};

const log = (msg) => console.log(`  ${msg}`);
const section = (title) => console.log(`\n━━━ ${title} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 B2B Platform — Full Setup\n');

  await mongoose.connect(process.env.MONGODB_URI);
  log('✅ MongoDB connected');

  // ── 1. Admin user ────────────────────────────────────────────────────────────
  section('1. Admin User');
  const adminId = process.env.ADMIN_ID;
  const adminPass = process.env.ADMIN_PASS;
  const existing = await User.findOne({ username: adminId?.toLowerCase() });
  if (existing) {
    log(`ℹ  Admin already exists: ${adminId}`);
  } else {
    const passwordHash = await bcrypt.hash(adminPass, 12);
    await User.create({ role: 'admin', username: adminId.toLowerCase(), passwordHash, name: 'Administrator', isActive: true });
    log(`✅ Admin created → username: ${adminId}  password: ${adminPass}`);
  }

  // ── 2. MoySklad token check ──────────────────────────────────────────────────
  section('2. MoySklad Connection');
  const org = await get('/entity/organization?limit=1');
  const orgRow = org.rows?.[0];
  if (!orgRow) throw new Error('No MoySklad organization found — check your token.');
  log(`✅ Connected to MoySklad org: "${orgRow.name}" (${orgRow.id})`);

  // ── 3. Categories from product folders ───────────────────────────────────────
  section('3. Categories');
  const folders = await getAll('/entity/productfolder');
  log(`Found ${folders.length} folder(s) in MoySklad`);

  const catMap = {}; // moyskladGroupId → Category._id
  for (const f of folders) {
    const cat = await Category.findOneAndUpdate(
      { moyskladGroupId: f.id },
      { $set: { 'name.ru': f.name, 'name.en': f.name, moyskladGroupId: f.id, isActive: true } },
      { upsert: true, new: true }
    );
    catMap[f.id] = cat._id;
    log(`  📁 "${f.name}"  →  category saved`);
  }

  // ── 4. Price lists from MoySklad price types ──────────────────────────────────
  section('4. Price Lists');
  // Get price types embedded in first product's salePrices
  const sampleAssortment = await get('/entity/assortment?limit=5');
  const priceTypesSeen = new Map();
  for (const item of sampleAssortment.rows || []) {
    for (const sp of item.salePrices || []) {
      const id = sp.priceType?.id;
      const name = sp.priceType?.name;
      if (id && name && !priceTypesSeen.has(id)) priceTypesSeen.set(id, name);
    }
  }

  const plMap = {}; // moyskladPriceTypeId → PriceList._id
  for (const [ptId, ptName] of priceTypesSeen) {
    const pl = await PriceList.findOneAndUpdate(
      { moyskladPriceTypeId: ptId },
      { $set: { moyskladPriceTypeId: ptId, name: ptName, isActive: true } },
      { upsert: true, new: true }
    );
    plMap[ptId] = pl._id;
    log(`  💰 "${ptName}"  →  price list saved`);
  }
  const priceLists = await PriceList.find({ isActive: true });

  // ── 5. Stock map ──────────────────────────────────────────────────────────────
  section('5. Stock Levels');
  const stockRows = await getAll('/report/stock/all');
  const stockMap = {}; // moyskladProductId (UUID) → stock quantity
  for (const s of stockRows) {
    // href looks like: .../entity/variant/UUID?expand=...  OR  .../entity/product/UUID
    const href = s.meta?.href || '';
    const uuid = href.split('/').pop().split('?')[0];
    if (uuid) stockMap[uuid] = s.stock ?? s.quantity ?? 0;
  }
  log(`Loaded stock for ${Object.keys(stockMap).length} items`);

  // ── 6. Products + variants from assortment ────────────────────────────────────
  section('6. Products & Variants');
  const items = await getAll('/entity/assortment?expand=productFolder');
  log(`Found ${items.length} items in assortment`);

  let created = 0, updated = 0;

  for (const item of items) {
    const msId = item.id;
    const isVariant = item.meta?.type === 'variant';

    // Category
    let categoryId = null;
    const folderHref = item.productFolder?.meta?.href;
    if (folderHref) {
      const fId = folderHref.split('/').pop().split('?')[0];
      categoryId = catMap[fId] || null;
    }

    // Prices
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

    const doc = {
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

    const exists = await Product.findOne({ moyskladProductId: msId });
    if (exists) {
      // preserve admin's isActive and categoryId choices on re-sync
      await Product.updateOne({ _id: exists._id }, { $set: doc });
      updated++;
    } else {
      // new products start hidden — admin must publish them
      await Product.create({ ...doc, isActive: false });
      created++;
    }
  }

  log(`✅ Created: ${created}  |  Updated: ${updated}  |  Total: ${items.length}`);

  // ── Summary ──────────────────────────────────────────────────────────────────
  const [totalProducts, totalCats, totalPL] = await Promise.all([
    Product.countDocuments(),
    Category.countDocuments({ isActive: true }),
    PriceList.countDocuments({ isActive: true }),
  ]);

  console.log('\n━━━ ✅ Setup Complete ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`  Products in DB  : ${totalProducts}`);
  console.log(`  Categories      : ${totalCats}`);
  console.log(`  Price Lists     : ${totalPL}`);
  console.log(`\n  Admin login     : ${process.env.ADMIN_ID} / ${process.env.ADMIN_PASS}`);
  console.log(`  App URL         : http://localhost:3000`);
  console.log('\n──────────────────────────────────────────────────────\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
