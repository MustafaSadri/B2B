const mongoose = require('mongoose');

const priceListSchema = new mongoose.Schema(
  {
    moyskladPriceTypeId: { type: String, default: null },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PriceList', priceListSchema);
