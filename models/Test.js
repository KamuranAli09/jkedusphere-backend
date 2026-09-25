const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  testId: { type: String, required: true, unique: true },
  testName: { type: String, required: true },
  subject: String,
  totalQuestions: Number,
  durationMinutes: Number,
  marksCorrect: Number,
  marksWrong: Number,
  totalMarks: Number,
  passMarks: Number,
  active: { type: Boolean, default: false },
  access: { type: String, enum: ['free', 'paid'], default: 'free' },
  packId: { type: String, index: true },
  pdfLink: String,
  examGroup: String,
  goLiveDate: Date
}, { timestamps: true });

module.exports = mongoose.model('Test', testSchema);