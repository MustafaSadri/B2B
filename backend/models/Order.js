const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    moyskladProductId: String,
    moyskladHref: String,
    moyskladType: String,
    name: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    salesRepId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'readyToDispatch', 'dispatched', 'delivered', 'cancelled'],
      default: 'pending',
    },
    moyskladOrderId: { type: String, default: null },
    moyskladOrderName: { type: String, default: null },
    moyskladStateName: { type: String, default: null },
    trackingUrl: { type: String, default: null },
    trackingNumber: { type: String, default: null },
    dispatchedAt: { type: Date, default: null },
    totalAmount: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    loyaltyCreditsUsed: { type: Number, default: 0 },
    couponCode: { type: String, default: null },
    invoiceUrl: { type: String, default: null },
    shippingAddress: { type: String, default: '' },
    notes: { type: String, default: '' },
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    paymentMethod: { type: String, default: null },
    cancelReason: { type: String, default: null },
    cancelRequestedAt: { type: Date, default: null },
    cancelApprovedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Auto-generate order number before save
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `ORD-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

orderSchema.index({ customerId: 1 });
orderSchema.index({ salesRepId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ moyskladOrderId: 1 });

module.exports = mongoose.model('Order', orderSchema);
