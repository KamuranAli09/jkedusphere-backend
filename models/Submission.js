const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  submissionId: { type: String, required: true, unique: true },
  testId: { type: String, required: true, index: true },
  testName: String,
  studentName: String,
  studentEmail: { type: String, required: true, index: true },
  score: Number,
  totalMarks: Number,
  percentage: Number,
  timeTakenSec: Number,
  correct: Number,
  wrong: Number,
  skipped: Number,
  answers: { type: Object }
}, { timestamps: true });

// This compound index is what makes leaderboard queries instant
submissionSchema.index({ testId: 1, score: -1, timeTakenSec: 1 });

module.exports = mongoose.model('Submission', submissionSchema);