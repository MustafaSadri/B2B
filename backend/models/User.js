const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['admin', 'salesRep', 'customer'],
      required: true,
    },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    language: { type: String, enum: ['ru', 'en'], default: 'ru' },
    // Customer fields
    salesRepId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    moyskladCounterpartyId: { type: String, default: null },
    priceListId: { type: mongoose.Schema.Types.ObjectId, ref: 'PriceList', default: null },
    // Business profile (customers)
    companyName: { type: String, trim: true },
    address: { type: String, trim: true },
    taxId: { type: String, trim: true },
    // Sales Rep fields
    moyskladEmployeeId: { type: String, default: null },
    // Bot integration
    telegramChatId: { type: String, default: null },
    whatsappPhone: { type: String, default: null },
    // Account status
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ salesRepId: 1 });
userSchema.index({ moyskladCounterpartyId: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
