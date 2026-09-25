const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  packId: { type: String, required: true },
  name: String,
  paymentId: { type: String, required: true, unique: true },
  amount: Number
}, { timestamps: true });

module.exports = mongoose.model('Purchase', purchaseSchema);