const mongoose = require('mongoose');

const priceListEntrySchema = new mongoose.Schema(
  {
    priceListId: { type: mongoose.Schema.Types.ObjectId, ref: 'PriceList' },
    priceListName: String,
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    moyskladProductId: { type: String, unique: true, sparse: true },
    moyskladHref: { type: String, default: null },
    name: {
      ru: { type: String, default: '' },
      en: { type: String, default: '' },
    },
    description: {
      ru: { type: String, default: '' },
      en: { type: String, default: '' },
    },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    moyskladGroupId: { type: String, default: null },
    sku: { type: String, default: '' },
    barcode: { type: String, default: '' },
    images: [String],
    stock: { type: Number, default: 0 },
    unit: { type: String, default: 'шт' },
    minOrderQty: { type: Number, default: 5 },
    loyaltyPercentage: { type: Number, default: null },
    priceLists: [priceListEntrySchema],
    basePrice: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isVariant: { type: Boolean, default: false },
    parentProductId: { type: String, default: null },
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

productSchema.index({ categoryId: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ 'name.ru': 'text', 'name.en': 'text', sku: 'text' });

module.exports = mongoose.model('Product', productSchema);
