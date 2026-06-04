const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const LoyaltyWallet = require('../models/LoyaltyWallet');
const Order = require('../models/Order');
const PriceList = require('../models/PriceList');
const { verifyToken } = require('../middleware/auth');
const { requireSalesRep, requireAdmin } = require('../middleware/roles');
const { notifyNewCustomer } = require('../services/notifications');
const msService = require('../services/moysklad');
const Settings = require('../models/Settings');

// GET /api/customers — Sales Rep sees their own, Admin sees all
router.get('/', verifyToken, requireSalesRep, async (req, res) => {
  try {
    const query = { role: 'customer', isActive: true };
    if (req.user.role === 'salesRep') query.salesRepId = req.user._id;

    const { page = 1, limit = 20, search } = req.query;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [customers, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash')
        .populate('priceListId', 'name')
        .populate('salesRepId', 'name username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.json({ success: true, customers, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/customers/:id
router.get('/:id', verifyToken, requireSalesRep, async (req, res) => {
  try {
    const customer = await User.findById(req.params.id)
      .select('-passwordHash')
      .populate('priceListId', 'name')
      .populate('salesRepId', 'name username');

    if (!customer || customer.role !== 'customer') {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    if (req.user.role === 'salesRep' && String(customer.salesRepId?._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    // Get wallet and order stats
    const [wallet, orderStats] = await Promise.all([
      LoyaltyWallet.findOne({ customerId: customer._id }),
      Order.aggregate([
        { $match: { customerId: customer._id, status: { $nin: ['cancelled'] } } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 },
            lastOrderDate: { $max: '$createdAt' },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      customer,
      wallet: { balance: wallet?.balance || 0, transactions: wallet?.transactions?.slice(-10) || [] },
      stats: orderStats[0] || { totalRevenue: 0, orderCount: 0 },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/customers — Sales Rep registers new customer
router.post(
  '/',
  verifyToken,
  requireSalesRep,
  [
    body('username').trim().isLength({ min: 3 }).withMessage('Min 3 chars'),
    body('password').isLength({ min: 6 }).withMessage('Min 6 chars'),
    body('name').trim().notEmpty().withMessage('Name required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const { username, password, name, email, phone, companyName, address, taxId, priceListId } = req.body;

      const existing = await User.findOne({ username: username.toLowerCase() });
      if (existing) return res.status(409).json({ success: false, message: 'Username already taken.' });

      const passwordHash = await bcrypt.hash(password, 12);
      const salesRepId = req.user._id;

      // Create MoySklad counterparty
      let moyskladCounterpartyId = null;
      try {
        const counterparty = await msService.createCounterparty({ name, phone, email, companyName });
        if (counterparty?.id) moyskladCounterpartyId = counterparty.id;
      } catch (e) {
        console.warn('MoySklad counterparty creation failed:', e.message);
      }

      const customer = await User.create({
        role: 'customer',
        username: username.toLowerCase(),
        passwordHash,
        name,
        email,
        phone,
        companyName,
        address,
        taxId,
        salesRepId,
        moyskladCounterpartyId,
        priceListId: priceListId || null,
        language: req.body.language || 'ru',
      });

      // Create loyalty wallet with signup bonus
      const settings = await Settings.get();
      const bonus = settings.signupBonusPoints || 0;
      const walletDoc = { customerId: customer._id, balance: bonus, transactions: [] };
      if (bonus > 0) {
        walletDoc.transactions.push({ type: 'earn', amount: bonus, description: 'Welcome bonus' });
      }
      await LoyaltyWallet.create(walletDoc);

      const salesRep = await User.findById(salesRepId);
      await notifyNewCustomer(salesRep, customer);

      const safe = customer.toObject();
      delete safe.passwordHash;

      res.status(201).json({ success: true, customer: safe });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PATCH /api/customers/:id — Sales Rep/Admin updates customer
router.patch('/:id', verifyToken, requireSalesRep, async (req, res) => {
  try {
    const customer = await User.findById(req.params.id);
    if (!customer || customer.role !== 'customer') {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }
    if (req.user.role === 'salesRep' && String(customer.salesRepId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const allowed = ['name', 'email', 'phone', 'companyName', 'address', 'taxId', 'isActive', 'language'];
    const update = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    // Username change — check uniqueness
    if (req.body.username) {
      const newUsername = req.body.username.trim().toLowerCase();
      if (newUsername !== customer.username) {
        const taken = await User.findOne({ username: newUsername });
        if (taken) return res.status(409).json({ success: false, message: 'Username already taken.' });
        update.username = newUsername;
      }
    }

    // Password change
    if (req.body.password) {
      if (req.body.password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      }
      update.passwordHash = await bcrypt.hash(req.body.password, 12);
    }

    const updated = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-passwordHash');
    res.json({ success: true, customer: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PATCH /api/customers/:id/pricelist — Sales Rep assigns price list
router.patch('/:id/pricelist', verifyToken, requireSalesRep, async (req, res) => {
  try {
    const { priceListId } = req.body;
    if (!priceListId) return res.status(400).json({ success: false, message: 'priceListId required.' });

    const customer = await User.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Not found.' });
    if (req.user.role === 'salesRep' && String(customer.salesRepId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const pl = await PriceList.findById(priceListId);
    if (!pl) return res.status(404).json({ success: false, message: 'Price list not found.' });

    customer.priceListId = priceListId;
    await customer.save();

    res.json({ success: true, message: `Price list "${pl.name}" assigned.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/customers/:id/orders
router.get('/:id/orders', verifyToken, requireSalesRep, async (req, res) => {
  try {
    const customer = await User.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Not found.' });
    if (req.user.role === 'salesRep' && String(customer.salesRepId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const orders = await Order.find({ customerId: customer._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
