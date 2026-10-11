const mongoose = require('mongoose');

const packSchema = new mongoose.Schema({
  packId: { type: String, required: true, unique: true },   // e.g. "jkpsi-telecom" — matches Test.packId
  name: { type: String, required: true },                     // e.g. "JKPSI Telecom Complete Pack"
  description: { type: String, default: '' },
  examGroup: { type: String, default: '' },                   // e.g. "JKPSI Telecom"
  price: { type: Number, default: 0 },                         // 0 = free pack
  originalPrice: { type: Number, default: 0 },
  validityDays: { type: Number, default: 0 },                  // 0 = lifetime access
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Pack', packSchema);
