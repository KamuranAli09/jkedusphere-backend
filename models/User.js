const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: String,
  name: String,
  exam: String,
  district: String,
  passwordHash: { type: String, required: true },
  tier: { type: String, enum: ['free', 'premium'], default: 'free' },
  purchasedPacks: [{ type: String }],
  passwordResetToken: String,
  passwordResetExpiry: Date
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);