const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionId: { type: String, required: true, unique: true },
  testId: { type: String, required: true, index: true },
  subject: String,
  unit: String,
  questionText: { type: String, required: true },
  optionA: String,
  optionB: String,
  optionC: String,
  optionD: String,
  correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
  marksCorrect: { type: Number, required: true },
  marksWrong: { type: Number, required: true },
  explanation: String,
  imageLink: String
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);