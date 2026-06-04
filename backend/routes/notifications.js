const router = require('express').Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');
const { sendNotification } = require('../services/notifications');

// GET /api/notifications — user's own notifications
router.get('/', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      $or: [
        { recipientType: 'all' },
        { recipientType: req.user.role },
        { recipientId: req.user._id },
      ],
    };

    const [notifications, total, unread] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...query, isRead: false }),
    ]);

    res.json({ success: true, notifications, total, unread });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', verifyToken, async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
  res.json({ success: true });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', verifyToken, async (req, res) => {
  await Notification.updateMany(
    {
      $or: [
        { recipientType: 'all' },
        { recipientType: req.user.role },
        { recipientId: req.user._id },
      ],
      isRead: false,
    },
    { isRead: true }
  );
  res.json({ success: true });
});

// POST /api/notifications/broadcast — Admin sends broadcast
router.post('/broadcast', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { recipientType, recipientId, channel, title, body } = req.body;
    if (!title || !body) return res.status(400).json({ success: false, message: 'title and body required.' });

    await sendNotification({ recipientType, recipientId, channel: channel || 'inApp', title, body });
    res.json({ success: true, message: 'Notification sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
