const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  signupBonusPoints:      { type: Number, default: 50 },
  globalLoyaltyPercentage:{ type: Number, default: 5  },
  defaultMinOrderQty:     { type: Number, default: 5  },
}, { timestamps: true });

// Singleton helper — always work with the one document
settingsSchema.statics.get = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

module.exports = mongoose.model('Settings', settingsSchema);
