const Test = require('../models/Test');
const Question = require('../models/Question');
const { autoFormatQuestionText } = require('../utils/formatText');

async function getAllTests() {
  const tests = await Test.find({ active: true }).lean();
  return {
    success: true,
    tests: tests.map(t => ({
      testId: t.testId, testName: t.testName, subject: t.subject,
      examGroup: t.examGroup || t.packId, totalQuestions: t.totalQuestions || 0,
      durationMinutes: t.durationMinutes || 60, marksCorrect: t.marksCorrect || 1,
      marksWrong: t.marksWrong || 0, totalMarks: t.totalMarks || 0,
      passMarks: t.passMarks || 0, access: t.access || 'free',
      packId: t.packId || '', pdfLink: t.pdfLink || '',
      dateAdded: t.goLiveDate || t.createdAt
    }))
  };
}

async function buildTestPayload(testId, includeAnswers) {
  const cfg = await Test.findOne({ testId }).lean();
  if (!cfg) throw new Error('Test not found: ' + testId);
  if (!cfg.active) throw new Error('Test is not active.');

  const qDocs = await Question.find({ testId }).lean();
  const questions = qDocs.map(q => {
    const base = {
      id: q.questionId,
      text: autoFormatQuestionText(q.questionText),
      options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD },
      image: q.imageLink || '',
      marks: q.marksCorrect || cfg.marksCorrect || 1,
      negative: q.marksWrong || cfg.marksWrong || 0,
      unit: q.unit || '',
      explanation: q.explanation || ''
    };
    if (includeAnswers) base.correctAnswer = (q.correctAnswer || '').toUpperCase();
    return base;
  });

  return {
    success: true,
    testId: cfg.testId, testName: cfg.testName, subject: cfg.subject,
    examGroup: cfg.examGroup || cfg.packId || '',
    durationMinutes: cfg.durationMinutes || 60,
    marksCorrect: cfg.marksCorrect || 1, marksWrong: cfg.marksWrong || 0,
    totalMarks: cfg.totalMarks || questions.length,
    passMarks: cfg.passMarks || 0, totalQuestions: questions.length,
    access: cfg.access || 'free', packId: cfg.packId || '',
    pdfLink: cfg.pdfLink || '', questions
  };
}

async function getTest(testId) {
  if (!testId) throw new Error('testId is required');
  return buildTestPayload(testId, false);
}

async function getTestPractice(testId) {
  if (!testId) throw new Error('testId is required');
  return buildTestPayload(testId, true);
}


async function saveTest(t) {
  if (!t || !t.testId || !t.testName) throw new Error('testId and testName are required.');

  const doc = {
    testId: t.testId, testName: t.testName, subject: t.subject || '',
    totalQuestions: parseInt(t.totalQuestions) || 0,
    durationMinutes: parseInt(t.durationMinutes) || 60,
    marksCorrect: parseFloat(t.marksCorrect) || 1,
    marksWrong: parseFloat(t.marksWrong) || 0,
    totalMarks: parseFloat(t.totalMarks) || 0,
    passMarks: parseFloat(t.passMarks) || 0,
    active: t.active === true || t.active === 'YES',
    access: t.access || 'free', packId: t.packId || '',
    pdfLink: t.pdfLink || '', examGroup: t.examGroup || '',
    goLiveDate: t.goLiveDate ? new Date(t.goLiveDate) : undefined
  };

  const existing = await Test.findOne({ testId: t.testId });
  if (existing) {
    await Test.updateOne({ testId: t.testId }, doc);
    return { success: true, action: 'updated', testId: t.testId };
  }
  await Test.create(doc);
  return { success: true, action: 'added', testId: t.testId };
}

async function deleteTest(testId) {
  if (!testId) throw new Error('testId required');
  const result = await Test.deleteOne({ testId });
  if (result.deletedCount === 0) throw new Error('Test not found: ' + testId);
  return { success: true, deleted: testId };
}
module.exports = { getAllTests, getTest, getTestPractice, saveTest, deleteTest };