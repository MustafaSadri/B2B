require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

const seed = async () => {
  await connectDB();

  const adminId = process.env.ADMIN_ID;
  const adminPass = process.env.ADMIN_PASS;

  if (!adminId || !adminPass) {
    console.error('ADMIN_ID and ADMIN_PASS must be set in .env');
    process.exit(1);
  }

  const existing = await User.findOne({ username: adminId.toLowerCase() });
  if (existing) {
    console.log('Admin user already exists. Skipping seed.');
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(adminPass, 12);
  await User.create({
    role: 'admin',
    username: adminId.toLowerCase(),
    passwordHash,
    name: 'Administrator',
    isActive: true,
  });

  console.log(`✅ Admin user created: ${adminId}`);
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
