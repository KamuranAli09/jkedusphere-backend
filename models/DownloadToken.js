const mongoose = require('mongoose');

const downloadTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  noteIds: [{ type: String }],   // expanded list, bundles already resolved
  paymentId: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  redeemedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('DownloadToken', downloadTokenSchema);
