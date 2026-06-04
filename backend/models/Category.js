const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      ru: { type: String, required: true },
      en: { type: String, default: '' },
    },
    moyskladGroupId: { type: String, default: null },
    parentCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    displayOrder: { type: Number, default: 0 },
    imageUrl: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
