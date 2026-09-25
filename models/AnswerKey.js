const mongoose = require('mongoose');

const answerKeySchema = new mongoose.Schema({
  examId: { type: String, required: true, index: true },
  qNo: { type: Number, required: true },
  status: { type: String, default: 'Normal' },
  marks: Number,
  negMarks: Number,
  tentativeAnswers: { type: Map, of: String, default: {} },
  officialAnswers: { type: Map, of: String, default: {} }
}, { timestamps: true });

answerKeySchema.index({ examId: 1, qNo: 1 }, { unique: true });

module.exports = mongoose.model('AnswerKey', answerKeySchema);