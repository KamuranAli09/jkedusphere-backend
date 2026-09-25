const Submission = require('../models/Submission');
const Test = require('../models/Test');
const Question = require('../models/Question');
const { maskEmail } = require('../utils/mask');

async function submitTest(body) {
  const { testId, studentName, studentEmail, answers, timeTakenSec } = body;
  if (!testId || !studentName || !studentEmail || !answers) throw new Error('Missing required fields.');

  const cfg = await Test.findOne({ testId }).lean();
  if (!cfg) throw new Error('Test not found: ' + testId);

  const questions = await Question.find({ testId }).lean();
  const mC = cfg.marksCorrect || 1;
  const mW = cfg.marksWrong || 0;
  const tm = cfg.totalMarks || questions.length;

  let score = 0, correct = 0, wrong = 0, skipped = 0;
  const review = [];

  questions.forEach(q => {
    const given = String(answers[q.questionId] || '').toUpperCase().trim();
    const actual = (q.correctAnswer || '').toUpperCase().trim();
    if (!given) { skipped++; review.push({ qid: q.questionId, given, actual, qScore: 0 }); }
    else if (given === actual) { correct++; score += mC; review.push({ qid: q.questionId, given, actual, qScore: mC }); }
    else { wrong++; score += mW; review.push({ qid: q.questionId, given, actual, qScore: mW }); }
  });

  const percentage = tm > 0 ? ((score / tm) * 100).toFixed(2) : '0.00';
  const submissionId = 'SUB' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);

  await Submission.create({
    submissionId, testId, testName: cfg.testName, studentName, studentEmail: studentEmail.toLowerCase(),
    score, totalMarks: tm, percentage: parseFloat(percentage), timeTakenSec: timeTakenSec || 0,
    correct, wrong, skipped, answers
  });

  // Rank = 1 + how many submissions for this test beat this score
  // (or tied on score but finished faster) — a single indexed query,
  // not a full sheet rewrite.
  const rank = 1 + await Submission.countDocuments({
    testId,
    $or: [
      { score: { $gt: score } },
      { score, timeTakenSec: { $lt: timeTakenSec || 0 } }
    ]
  });

  return { success: true, submissionId, score, totalMarks: tm, percentage, correct, wrong, skipped, rank, review };
}

async function getLeaderboard(testId, limit) {
  if (!testId) throw new Error('testId required');
  limit = Math.min(limit || 20, 50);

  const cfg = await Test.findOne({ testId }).lean();
  const testName = cfg ? cfg.testName : testId;

  const docs = await Submission.find({ testId })
    .sort({ score: -1, timeTakenSec: 1 })
    .limit(limit)
    .lean();

  const leaderboard = docs.map((r, i) => ({
    rank: i + 1, name: r.studentName, email: maskEmail(r.studentEmail),
    score: r.score, percentage: r.percentage, timeTaken: r.timeTakenSec
  }));

  return { success: true, testId, testName, leaderboard };
}

async function getPackLeaderboard(packId, limit) {
  if (!packId) throw new Error('packId required');
  limit = Math.min(limit || 50, 100);

  const packTests = await Test.find({ packId }).lean();
  const packTestIds = packTests.map(t => t.testId);
  if (!packTestIds.length) return { success: true, packId, totalTests: 0, totalParticipants: 0, leaderboard: [] };

  // Best score per (email, testId) so retakes don't double-count
  const subs = await Submission.find({ testId: { $in: packTestIds } }).lean();
  const best = {};
  subs.forEach(s => {
    const key = s.studentEmail + '|' + s.testId;
    if (!best[key] || s.score > best[key].score) {
      best[key] = { email: s.studentEmail, name: s.studentName, score: s.score, totalMarks: s.totalMarks, timeTaken: s.timeTakenSec };
    }
  });

  const agg = {};
  Object.values(best).forEach(b => {
    if (!agg[b.email]) agg[b.email] = { email: b.email, name: b.name, totalScore: 0, totalPossible: 0, testsAttempted: 0, totalTime: 0 };
    agg[b.email].totalScore += b.score;
    agg[b.email].totalPossible += b.totalMarks;
    agg[b.email].testsAttempted++;
    agg[b.email].totalTime += b.timeTaken;
    if (b.name) agg[b.email].name = b.name;
  });

  const arr = Object.values(agg).sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.testsAttempted !== a.testsAttempted) return b.testsAttempted - a.testsAttempted;
    return a.totalTime - b.totalTime;
  });

  const n = arr.length;
  const leaderboard = arr.slice(0, limit).map((a, idx) => {
    const pct = a.totalPossible > 0 ? (a.totalScore / a.totalPossible) * 100 : 0;
    const rating = n > 1 ? (10 - (9 * idx) / (n - 1)) : 10;
    return {
      rank: idx + 1, name: a.name, email: maskEmail(a.email),
      totalScore: Math.round(a.totalScore * 100) / 100, testsAttempted: a.testsAttempted,
      percentage: Math.round(pct * 100) / 100, rating: Math.round(rating * 10) / 10
    };
  });

  return { success: true, packId, totalTests: packTestIds.length, totalParticipants: n, leaderboard };
}

async function getStudentHistory(email) {
  if (!email) throw new Error('email required');
  email = email.toLowerCase().trim();

  const docs = await Submission.find({ studentEmail: email }).sort({ createdAt: -1 }).lean();
  const history = docs.map(r => ({
    submissionId: r.submissionId, timestamp: r.createdAt, testId: r.testId, testName: r.testName,
    score: r.score, totalMarks: r.totalMarks, percentage: r.percentage, rank: '',
    timeTaken: r.timeTakenSec, correct: r.correct, wrong: r.wrong, skipped: r.skipped
  }));

  return { success: true, email, totalAttempts: history.length, history };
}

async function getSubmissionReview(submissionId, requesterEmail) {
  if (!submissionId) throw new Error('submissionId is required');

  const sub = await Submission.findOne({ submissionId }).lean();
  if (!sub) throw new Error('Submission not found.');

  if (requesterEmail && sub.studentEmail.toLowerCase() !== String(requesterEmail).toLowerCase().trim()) {
    throw new Error('You are not authorized to view this submission.');
  }

  const answers = sub.answers || {};
  const hasAnswers = Object.keys(answers).length > 0;

  const qDocs = await Question.find({ testId: sub.testId }).lean();
  const questions = qDocs.map(q => ({
    id: q.questionId, text: q.questionText,
    options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD },
    image: q.imageLink, unit: q.unit, explanation: q.explanation,
    given: (answers[q.questionId] || '').toUpperCase().trim(),
    correct: (q.correctAnswer || '').toUpperCase()
  }));

  return {
    success: true, submissionId, testId: sub.testId, testName: sub.testName,
    hasAnswerData: hasAnswers, totalQuestions: questions.length, questions
  };
}

async function getWeakAreas(email) {
  if (!email) throw new Error('email required');
  email = email.toLowerCase().trim();

  const qDocs = await Question.find({}).lean();
  const qLookup = {};
  qDocs.forEach(q => { qLookup[q.questionId] = { unit: q.unit || 'General', correct: (q.correctAnswer || '').toUpperCase() }; });

  const subs = await Submission.find({ studentEmail: email }).lean();
  const unitStats = {};

  subs.forEach(sub => {
    const answers = sub.answers || {};
    Object.keys(answers).forEach(qid => {
      const info = qLookup[qid];
      if (!info) return;
      const given = String(answers[qid] || '').toUpperCase().trim();
      if (!given) return;
      if (!unitStats[info.unit]) unitStats[info.unit] = { attempted: 0, correct: 0 };
      unitStats[info.unit].attempted++;
      if (given === info.correct) unitStats[info.unit].correct++;
    });
  });

  const areas = Object.keys(unitStats).map(unit => {
    const s = unitStats[unit];
    return { unit, attempted: s.attempted, correct: s.correct, accuracy: s.attempted > 0 ? (s.correct / s.attempted) * 100 : 0 };
  });
  areas.sort((a, b) => a.accuracy - b.accuracy);

  return { success: true, areas };
}

async function getSubmissionsCount() {
  const total = await Submission.countDocuments();
  const uniqueEmails = await Submission.distinct('studentEmail');
  return { success: true, total, unique: uniqueEmails.length };
}

module.exports = { submitTest, getLeaderboard, getPackLeaderboard, getStudentHistory, getSubmissionReview, getWeakAreas, getSubmissionsCount };