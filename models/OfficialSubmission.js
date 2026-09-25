const mongoose = require('mongoose');

const officialSubmissionSchema = new mongoose.Schema({
  examId: { type: String, required: true, index: true },
  set: { type: String, required: true },
  studentName: String,
  studentEmail: { type: String, index: true },
  answers: { type: Object },
  tentativeScore: Number,
  officialScore: Number,
  correctCount: Number,
  wrongCount: Number,
  unattemptedCount: Number
}, { timestamps: true });

module.exports = mongoose.model('OfficialSubmission', officialSubmissionSchema);