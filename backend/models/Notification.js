const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientType: {
      type: String,
      enum: ['all', 'salesRep', 'customer', 'specific'],
      required: true,
    },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    channel: {
      type: String,
      enum: ['inApp', 'push', 'email', 'sms', 'telegram', 'whatsapp'],
      default: 'inApp',
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    sentAt: { type: Date, default: null },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
