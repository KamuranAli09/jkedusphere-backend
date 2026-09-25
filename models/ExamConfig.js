const mongoose = require('mongoose');

const examConfigSchema = new mongoose.Schema({
  examId: { type: String, required: true, unique: true },
  examName: { type: String, required: true },
  totalQuestions: Number,
  sets: [{ type: String }], // e.g. ['A','B','C','D']
  status: { type: String, enum: ['Draft', 'Official', 'Closed'], default: 'Draft' },
  negativeMarking: { type: Boolean, default: true },
  marksPerQuestion: Number,
  negMarksPerQuestion: Number
}, { timestamps: true });

module.exports = mongoose.model('ExamConfig', examConfigSchema);