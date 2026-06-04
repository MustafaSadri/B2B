require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const connectDB = require('../config/db');
const Order = require('../models/Order');
const LoyaltyWallet = require('../models/LoyaltyWallet');
const User = require('../models/User');

const clear = async () => {
  await connectDB();

  const orderCount = await Order.countDocuments();
  await Order.deleteMany({});
  console.log(`✅ Deleted ${orderCount} orders`);

  await LoyaltyWallet.deleteMany({});
  console.log('✅ Cleared all loyalty wallets');

  const repCount = await User.countDocuments({ role: 'salesRep' });
  await User.deleteMany({ role: 'salesRep' });
  console.log(`✅ Deleted ${repCount} sales reps`);

  const custCount = await User.countDocuments({ role: 'customer' });
  await User.deleteMany({ role: 'customer' });
  console.log(`✅ Deleted ${custCount} customers`);

  console.log('✅ Done. Admin account untouched.');
  process.exit(0);
};

clear().catch((err) => { console.error(err); process.exit(1); });
