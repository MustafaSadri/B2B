const router = require('express').Router();
const LoyaltyWallet = require('../models/LoyaltyWallet');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');

// GET /api/loyalty/wallet — current user's wallet
router.get('/wallet', verifyToken, async (req, res) => {
  try {
    const wallet = await LoyaltyWallet.findOne({ customerId: req.user._id });
    if (!wallet) return res.json({ success: true, balance: 0, transactions: [] });
    res.json({ success: true, balance: wallet.balance, transactions: wallet.transactions.slice(-50) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/loyalty/wallet/:customerId — Admin/SalesRep views customer wallet
router.get('/wallet/:customerId', verifyToken, async (req, res) => {
  try {
    const wallet = await LoyaltyWallet.findOne({ customerId: req.params.customerId });
    res.json({ success: true, balance: wallet?.balance || 0, transactions: wallet?.transactions || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PATCH /api/loyalty/adjust — Admin manually adjusts balance
router.patch('/adjust', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { customerId, amount, description } = req.body;
    if (!customerId || amount === undefined) {
      return res.status(400).json({ success: false, message: 'customerId and amount required.' });
    }

    const wallet = await LoyaltyWallet.findOneAndUpdate(
      { customerId },
      {
        $inc: { balance: amount },
        $push: {
          transactions: { type: 'adjust', amount, description: description || 'Admin adjustment' },
        },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, balance: wallet.balance });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
