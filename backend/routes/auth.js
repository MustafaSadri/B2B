const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const cookieOpts = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge,
});

// POST /api/auth/login
router.post(
  '/login',
  loginLimiter,
  [
    body('username').trim().notEmpty().withMessage('Username required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const { username, password } = req.body;
      const user = await User.findOne({ username: username.toLowerCase() });
      if (!user || !user.isActive) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

      user.lastLoginAt = new Date();
      await user.save();

      const { accessToken, refreshToken } = generateTokens(user._id);

      res
        .cookie('accessToken', accessToken, cookieOpts(15 * 60 * 1000))
        .cookie('refreshToken', refreshToken, cookieOpts(7 * 24 * 60 * 60 * 1000))
        .json({
          success: true,
          user: {
            id: user._id,
            role: user.role,
            username: user.username,
            name: user.name,
            language: user.language,
          },
        });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ success: false, message: 'No refresh token.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'Invalid token.' });

    const { accessToken, refreshToken } = generateTokens(user._id);
    res
      .cookie('accessToken', accessToken, cookieOpts(15 * 60 * 1000))
      .cookie('refreshToken', refreshToken, cookieOpts(7 * 24 * 60 * 60 * 1000))
      .json({ success: true });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res
    .clearCookie('accessToken')
    .clearCookie('refreshToken')
    .json({ success: true, message: 'Logged out.' });
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  const u = req.user;
  res.json({
    success: true,
    user: {
      id: u._id,
      role: u.role,
      username: u.username,
      name: u.name,
      email: u.email,
      phone: u.phone,
      language: u.language,
      companyName: u.companyName,
      salesRepId: u.salesRepId,
      priceListId: u.priceListId,
    },
  });
});

// PATCH /api/auth/language
router.patch('/language', verifyToken, async (req, res) => {
  const { language } = req.body;
  if (!['ru', 'en'].includes(language)) {
    return res.status(400).json({ success: false, message: 'Invalid language.' });
  }
  await User.findByIdAndUpdate(req.user._id, { language });
  res.json({ success: true });
});

// PATCH /api/auth/profile
router.patch(
  '/profile',
  verifyToken,
  [body('name').optional().trim(), body('email').optional().isEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, email, phone, companyName, address, taxId } = req.body;
    const update = {};
    if (name) update.name = name;
    if (email) update.email = email;
    if (phone) update.phone = phone;
    if (companyName) update.companyName = companyName;
    if (address) update.address = address;
    if (taxId) update.taxId = taxId;

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true }).select('-passwordHash');
    res.json({ success: true, user });
  }
);

// PATCH /api/auth/change-password
router.patch(
  '/change-password',
  verifyToken,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 }).withMessage('Min 6 chars'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(400).json({ success: false, message: 'Current password incorrect.' });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ success: true, message: 'Password updated.' });
  }
);

module.exports = router;
