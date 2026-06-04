const router = require('express').Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');

// GET /api/categories
router.get('/', verifyToken, async (req, res) => {
  try {
    const { all } = req.query;
    const query = all === 'true' ? {} : { isActive: true };
    const categories = await Category.find(query).sort({ displayOrder: 1, 'name.ru': 1 });

    // Attach product count to each category
    const withCount = await Promise.all(
      categories.map(async (c) => {
        const count = await Product.countDocuments({ categoryId: c._id, isActive: true });
        return { ...c.toObject(), productCount: count };
      })
    );
    res.json({ success: true, categories: withCount });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/categories — admin creates category
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { nameRu, nameEn, displayOrder } = req.body;
    if (!nameRu) return res.status(400).json({ success: false, message: 'nameRu required.' });
    const category = await Category.create({
      name: { ru: nameRu, en: nameEn || nameRu },
      displayOrder: displayOrder || 0,
    });
    res.status(201).json({ success: true, category });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /api/categories/:id
router.patch('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { nameRu, nameEn, displayOrder, isActive } = req.body;
    const update = {};
    if (nameRu) update['name.ru'] = nameRu;
    if (nameEn) update['name.en'] = nameEn;
    if (displayOrder !== undefined) update.displayOrder = displayOrder;
    if (isActive !== undefined) update.isActive = isActive;

    const category = await Category.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!category) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, category });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/categories/:id — unassigns products then hides category
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    await Product.updateMany({ categoryId: req.params.id }, { $set: { categoryId: null } });
    await Category.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Category removed and products unassigned.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
