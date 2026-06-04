require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const { getEmployees } = require('../services/moysklad');
const crypto = require('crypto');

const seed = async () => {
  await connectDB();

  console.log('Fetching employees from MoySklad...');
  const employees = await getEmployees();
  console.log(`Found ${employees.length} employees.`);

  let created = 0;
  let skipped = 0;

  for (const emp of employees) {
    const msId = emp.id || (emp.meta?.href || '').split('/').pop().split('?')[0];
    if (!msId) continue;

    const existing = await User.findOne({ moyskladEmployeeId: msId });
    if (existing) {
      skipped++;
      continue;
    }

    const username = (emp.uid || emp.shortFio || emp.name || msId)
      .toLowerCase()
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '');

    const tempPassword = crypto.randomBytes(4).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await User.create({
      role: 'salesRep',
      username,
      passwordHash,
      name: emp.name || emp.shortFio || username,
      moyskladEmployeeId: msId,
      isActive: true,
    });

    console.log(`✅ Sales Rep created: ${username} | Temp password: ${tempPassword}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped (already exist): ${skipped}`);
  process.exit(0);
};

seed().catch((err) => {
  console.error('SeedSalesReps error:', err);
  process.exit(1);
});
