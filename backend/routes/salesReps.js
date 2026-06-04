const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Order = require('../models/Order');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin, requireSalesRep } = require('../middleware/roles');
const msService = require('../services/moysklad');

// GET /api/salesreps — Admin sees all
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const reps = await User.find({ role: 'salesRep' })
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    // Attach customer count and revenue to each rep
    const enriched = await Promise.all(
      reps.map(async (rep) => {
        const [customerCount, revenueData] = await Promise.all([
          User.countDocuments({ role: 'customer', salesRepId: rep._id, isActive: true }),
          Order.aggregate([
            { $match: { salesRepId: rep._id, status: { $nin: ['cancelled'] } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
          ]),
        ]);
        return {
          ...rep.toObject(),
          customerCount,
          totalRevenue: revenueData[0]?.total || 0,
          orderCount: revenueData[0]?.orders || 0,
        };
      })
    );

    res.json({ success: true, salesReps: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/salesreps/ms-employees — MoySklad employee list for dropdown (admin only)
router.get('/ms-employees', verifyToken, requireAdmin, async (req, res) => {
  try {
    const employees = await msService.getEmployees();
    const list = employees.map((e) => ({
      id: (e.meta?.href || '').split('/').pop().split('?')[0],
      name: e.name || e.shortFio || 'Unknown',
    })).filter((e) => e.id);
    res.json({ success: true, employees: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/salesreps/:id/dashboard — Sales Rep's own dashboard
router.get('/:id/dashboard', verifyToken, requireSalesRep, async (req, res) => {
  try {
    if (req.user.role === 'salesRep' && String(req.user._id) !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const repId = req.params.id;
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      customers,
      totalOrders,
      thisMonthRevenue,
      lastMonthRevenue,
      recentOrders,
      pendingOrders,
      dispatchedOrders,
    ] = await Promise.all([
      User.countDocuments({ role: 'customer', salesRepId: repId, isActive: true }),
      Order.countDocuments({ salesRepId: repId }),
      Order.aggregate([
        { $match: { salesRepId: repId, createdAt: { $gte: thisMonthStart }, status: { $nin: ['cancelled'] } } },
        { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate([
        {
          $match: {
            salesRepId: repId,
            createdAt: { $gte: lastMonthStart, $lt: thisMonthStart },
            status: { $nin: ['cancelled'] },
          },
        },
        { $group: { _id: null, revenue: { $sum: '$totalAmount' } } },
      ]),
      Order.find({ salesRepId: repId })
        .populate('customerId', 'name companyName')
        .sort({ createdAt: -1 })
        .limit(10),
      Order.find({ salesRepId: repId, status: 'pending' })
        .populate('customerId', 'name companyName')
        .sort({ createdAt: -1 }),
      Order.find({ salesRepId: repId, status: 'dispatched' })
        .populate('customerId', 'name companyName')
        .sort({ updatedAt: -1 }),
    ]);

    const thisRev = thisMonthRevenue[0]?.revenue || 0;
    const lastRev = lastMonthRevenue[0]?.revenue || 0;
    const growth = lastRev > 0 ? ((thisRev - lastRev) / lastRev) * 100 : 0;

    res.json({
      success: true,
      pendingOrders,
      dispatchedOrders,
      stats: {
        customers,
        totalOrders,
        thisMonthRevenue: thisRev,
        lastMonthRevenue: lastRev,
        thisMonthOrders: thisMonthRevenue[0]?.orders || 0,
        revenueGrowth: Math.round(growth * 10) / 10,
      },
      recentOrders,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/salesreps — Admin creates Sales Rep
router.post(
  '/',
  verifyToken,
  requireAdmin,
  [
    body('username').trim().isLength({ min: 3 }),
    body('password').isLength({ min: 6 }),
    body('name').trim().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const { username, password, name, email, phone, moyskladEmployeeId } = req.body;
      const existing = await User.findOne({ username: username.toLowerCase() });
      if (existing) return res.status(409).json({ success: false, message: 'Username taken.' });

      const passwordHash = await bcrypt.hash(password, 12);
      const rep = await User.create({
        role: 'salesRep',
        username: username.toLowerCase(),
        passwordHash,
        name,
        email,
        phone,
        moyskladEmployeeId: moyskladEmployeeId || null,
      });

      const safe = rep.toObject();
      delete safe.passwordHash;
      res.status(201).json({ success: true, salesRep: safe });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PATCH /api/salesreps/:id — Admin updates Sales Rep
router.patch('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, isActive, moyskladEmployeeId } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (email !== undefined) update.email = email;
    if (phone !== undefined) update.phone = phone;
    if (isActive !== undefined) update.isActive = isActive;
    if (moyskladEmployeeId !== undefined) update.moyskladEmployeeId = moyskladEmployeeId;

    if (req.body.password) {
      update.passwordHash = await bcrypt.hash(req.body.password, 12);
    }

    const rep = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'salesRep' },
      update,
      { new: true }
    ).select('-passwordHash');

    if (!rep) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, salesRep: rep });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
