/**
 * seedDemo.js — Creates demo data linked to real MoySklad employees & products
 *
 * Run: node scripts/seedDemo.js
 *
 * Creates:
 *  - 1 Sales Rep per available MoySklad employee (up to 3)
 *  - 2 Customers per Sales Rep
 *  - 2–3 Orders per Customer using real products from DB
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const LoyaltyWallet = require('../models/LoyaltyWallet');
const { getEmployees } = require('../services/moysklad');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hash = (pw) => bcrypt.hash(pw, 10);

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const STATUSES = ['pending', 'confirmed', 'processing', 'dispatched', 'delivered'];

const COMPANY_NAMES = [
  'ООО «Торговый Дом Восток»',
  'ИП Смирнов А.В.',
  'ООО «Меркурий Плюс»',
  'ИП Ахметов Р.Р.',
  'ООО «Бизнес Снаб»',
  'ИП Попова Е.Н.',
];

const FIRST_NAMES = ['Алексей', 'Михаил', 'Дмитрий', 'Сергей', 'Андрей', 'Наталья', 'Ольга', 'Ирина'];
const LAST_NAMES  = ['Иванов', 'Петров', 'Сидоров', 'Козлов', 'Новиков', 'Морозов', 'Волков', 'Лебедев'];

const ADDRESSES = [
  'г. Москва, ул. Ленина 12, оф. 5',
  'г. Санкт-Петербург, пр. Невский 88',
  'г. Казань, ул. Баумана 3',
  'г. Новосибирск, ул. Красный пр. 54',
  'г. Екатеринбург, ул. Мира 15',
];

const NOTES = [
  'Доставка после 14:00',
  'Позвонить за час до прибытия',
  'Код ворот: 1234',
  '',
  'Склад открыт Пн-Пт 9:00-18:00',
];

// ─── Main ─────────────────────────────────────────────────────────────────────

const seed = async () => {
  await connectDB();

  // 1. Fetch real MoySklad employees
  console.log('\n📡 Fetching employees from MoySklad...');
  let employees = [];
  try {
    employees = await getEmployees();
    console.log(`   Found ${employees.length} employee(s).`);
  } catch (err) {
    console.warn('   ⚠ Could not fetch employees:', err.message);
    console.warn('   Continuing without MoySklad employee linking.\n');
  }

  // Use up to 3 employees; fall back to placeholder names if none available
  const empSlots = employees.slice(0, 3).length > 0
    ? employees.slice(0, 3)
    : [null, null];  // create 2 unlinked sales reps if MoySklad unavailable

  // 2. Fetch real products from DB (need at least some synced products)
  const products = await Product.find({ isActive: true }).limit(40);
  if (products.length === 0) {
    console.error('\n❌ No products in database. Run the admin Sync MoySklad first, then re-run this script.');
    process.exit(1);
  }
  console.log(`\n📦 Found ${products.length} products to use in orders.`);

  const createdReps = [];
  const createdCustomers = [];
  const createdOrders = [];

  // ─── 3. Create Sales Reps ────────────────────────────────────────────────

  console.log('\n👤 Creating Sales Reps...');

  for (let i = 0; i < empSlots.length; i++) {
    const emp = empSlots[i];
    const msEmpId = emp ? (emp.id || (emp.meta?.href || '').split('/').pop().split('?')[0]) : null;
    const empName = emp ? (emp.name || emp.shortFio || `Employee ${i + 1}`) : `Demo Rep ${i + 1}`;

    const username = `rep${i + 1}`;
    const password = `rep${i + 1}pass`;

    // Skip if already exists
    const existing = await User.findOne({ username });
    if (existing) {
      console.log(`   ⚠ ${username} already exists — skipping`);
      createdReps.push(existing);
      continue;
    }

    // Also skip if this MoySklad employee is already linked
    if (msEmpId) {
      const empLinked = await User.findOne({ moyskladEmployeeId: msEmpId });
      if (empLinked) {
        console.log(`   ⚠ MoySklad employee "${empName}" already linked to ${empLinked.username} — skipping`);
        createdReps.push(empLinked);
        continue;
      }
    }

    const rep = await User.create({
      role: 'salesRep',
      username,
      passwordHash: await hash(password),
      name: empName,
      moyskladEmployeeId: msEmpId || null,
      email: `${username}@demo.com`,
      phone: `+7 (9${randomInt(10, 99)}) ${randomInt(100, 999)}-${randomInt(10, 99)}-${randomInt(10, 99)}`,
      isActive: true,
    });

    createdReps.push(rep);
    console.log(`   ✅ Sales Rep: ${username} / ${password}  (MoySklad: ${empName})`);
  }

  if (createdReps.length === 0) {
    console.error('❌ No sales reps created. Exiting.');
    process.exit(1);
  }

  // ─── 4. Create Customers ─────────────────────────────────────────────────

  console.log('\n🧑‍💼 Creating Customers...');
  let custIdx = 0;

  for (const rep of createdReps) {
    for (let c = 0; c < 2; c++) {
      custIdx++;
      const username = `customer${custIdx}`;
      const password = `cust${custIdx}pass`;
      const firstName = randomFrom(FIRST_NAMES);
      const lastName  = randomFrom(LAST_NAMES);
      const company   = COMPANY_NAMES[(custIdx - 1) % COMPANY_NAMES.length];

      const existing = await User.findOne({ username });
      if (existing) {
        console.log(`   ⚠ ${username} already exists — skipping`);
        createdCustomers.push(existing);
        continue;
      }

      const customer = await User.create({
        role: 'customer',
        username,
        passwordHash: await hash(password),
        name: `${firstName} ${lastName}`,
        email: `${username}@demo.com`,
        phone: `+7 (9${randomInt(10, 99)}) ${randomInt(100, 999)}-${randomInt(10, 99)}-${randomInt(10, 99)}`,
        companyName: company,
        address: randomFrom(ADDRESSES),
        salesRepId: rep._id,
        isActive: true,
        language: 'ru',
      });

      // Create empty loyalty wallet
      await LoyaltyWallet.findOneAndUpdate(
        { customerId: customer._id },
        { $setOnInsert: { customerId: customer._id, balance: 0, transactions: [] } },
        { upsert: true }
      );

      createdCustomers.push(customer);
      console.log(`   ✅ Customer: ${username} / ${password}  → rep: ${rep.username}  (${company})`);
    }
  }

  // ─── 5. Create Orders ────────────────────────────────────────────────────

  console.log('\n🛒 Creating Sample Orders...');

  for (const customer of createdCustomers) {
    const rep = createdReps.find(r => String(r._id) === String(customer.salesRepId));
    if (!rep) continue;

    const numOrders = randomInt(2, 3);

    for (let o = 0; o < numOrders; o++) {
      // Pick 1–4 random products
      const numItems = randomInt(1, 4);
      const shuffled = [...products].sort(() => Math.random() - 0.5).slice(0, numItems);

      let subtotal = 0;
      const items = shuffled.map(p => {
        const qty   = randomInt(p.minOrderQty || 1, (p.minOrderQty || 1) + randomInt(1, 10));
        const price = p.basePrice || randomInt(200, 5000);
        const total = price * qty;
        subtotal += total;
        return {
          productId:        p._id,
          moyskladProductId: p.moyskladProductId || null,
          moyskladHref:     p.moyskladHref || null,
          moyskladType:     p.isVariant ? 'variant' : 'product',
          name:             p.name?.ru || p.name?.en || 'Product',
          quantity:         qty,
          unitPrice:        price,
          totalPrice:       total,
          discount:         0,
        };
      });

      const status = STATUSES[randomInt(0, STATUSES.length - 1)];
      const loyaltyEarned = Math.round((subtotal * 0.05) * 100) / 100;

      const order = await Order.create({
        customerId:    customer._id,
        salesRepId:    rep._id,
        items,
        status,
        totalAmount:   subtotal,
        discountAmount: 0,
        loyaltyCreditsUsed: 0,
        shippingAddress: customer.address || randomFrom(ADDRESSES),
        notes:         randomFrom(NOTES),
      });

      // Award loyalty credits for delivered orders
      if (status === 'delivered' && loyaltyEarned > 0) {
        await LoyaltyWallet.findOneAndUpdate(
          { customerId: customer._id },
          {
            $inc: { balance: loyaltyEarned },
            $push: { transactions: { type: 'earn', amount: loyaltyEarned, orderId: order._id, description: 'Order reward' } },
          },
          { upsert: true }
        );
      }

      createdOrders.push(order);
      console.log(`   ✅ Order ${order.orderNumber}  customer: ${customer.username}  status: ${status}  total: ₽${subtotal.toLocaleString()}`);
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────────

  console.log('\n' + '─'.repeat(50));
  console.log(`✅ Demo data created successfully!\n`);
  console.log(`   Sales Reps  : ${createdReps.length}`);
  console.log(`   Customers   : ${createdCustomers.length}`);
  console.log(`   Orders      : ${createdOrders.length}`);
  console.log('\n📋 Login credentials:');

  for (let i = 0; i < createdReps.length; i++) {
    const rep = createdReps[i];
    console.log(`\n   Sales Rep  : ${rep.username} / rep${i + 1}pass`);
    const repCustomers = createdCustomers.filter(c => String(c.salesRepId) === String(rep._id));
    repCustomers.forEach((c, ci) => {
      const idx = createdCustomers.indexOf(c) + 1;
      console.log(`   Customer ${ci + 1}: customer${idx} / cust${idx}pass`);
    });
  }
  console.log('\n   Admin      : admin / admin123');
  console.log('─'.repeat(50) + '\n');

  process.exit(0);
};

seed().catch((err) => {
  console.error('\n❌ Seed error:', err.message);
  process.exit(1);
});
