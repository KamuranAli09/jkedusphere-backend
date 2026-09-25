const Question = require('../models/Question');
const { autoFormatQuestionText } = require('../utils/formatText');

async function addQuestion(q) {
  if (!q || !q.questionId || !q.testId || !q.questionText) throw new Error('Missing fields.');
  const correct = (q.correctAnswer || '').toUpperCase();
  if (!['A', 'B', 'C', 'D'].includes(correct)) throw new Error('correctAnswer must be A-D.');

  const doc = {
    questionId: q.questionId, testId: q.testId, subject: q.subject || '',
    unit: q.unit || '', questionText: q.questionText,
    optionA: q.optionA || '', optionB: q.optionB || '',
    optionC: q.optionC || '', optionD: q.optionD || '',
    correctAnswer: correct, marksCorrect: parseFloat(q.marksCorrect) || 1,
    marksWrong: parseFloat(q.marksWrong) || -0.25,
    explanation: q.explanation || '', imageLink: q.imageLink || ''
  };

  const existing = await Question.findOne({ questionId: q.questionId });
  if (existing) {
    await Question.updateOne({ questionId: q.questionId }, doc);
    return { success: true, action: 'updated', questionId: q.questionId };
  }
  await Question.create(doc);
  return { success: true, action: 'added', questionId: q.questionId };
}

async function bulkAddQuestions(questions) {
  if (!questions || !questions.length) throw new Error('No questions provided.');

  const existingIds = new Set((await Question.find({}, 'questionId').lean()).map(q => q.questionId));
  let maxNum = 0;
  existingIds.forEach(id => {
    const m = String(id).match(/^Q(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1]));
  });

  const toInsert = [];
  const added = [];
  const skipped = [];

  questions.forEach(q => {
    if (!q.questionText || !q.testId) { skipped.push(q.questionId || 'unknown'); return; }
    let qid = String(q.questionId || '').trim();
    if (!qid || existingIds.has(qid)) {
      maxNum++;
      qid = 'Q' + String(maxNum).padStart(3, '0');
      while (existingIds.has(qid)) { maxNum++; qid = 'Q' + String(maxNum).padStart(3, '0'); }
    }
    existingIds.add(qid);
    let correct = (q.correctAnswer || 'A').toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(correct)) correct = 'A';

    toInsert.push({
      questionId: qid, testId: q.testId, subject: q.subject || '', unit: q.unit || '',
      questionText: q.questionText, optionA: q.optionA || '', optionB: q.optionB || '',
      optionC: q.optionC || '', optionD: q.optionD || '', correctAnswer: correct,
      marksCorrect: parseFloat(q.marksCorrect) || 1, marksWrong: parseFloat(q.marksWrong) || -0.25,
      explanation: q.explanation || '', imageLink: q.imageLink || ''
    });
    added.push(qid);
  });

  if (toInsert.length) await Question.insertMany(toInsert);
  return { success: true, added: added.length, skipped: skipped.length, addedIds: added };
}

async function deleteQuestion(questionId) {
  if (!questionId) throw new Error('questionId required');
  const result = await Question.deleteOne({ questionId });
  if (result.deletedCount === 0) throw new Error('Question not found: ' + questionId);
  return { success: true, deleted: questionId };
}

async function getAllQuestions() {
  const docs = await Question.find({}).lean();
  const questions = docs.map(q => ({
    questionId: q.questionId, testId: q.testId, testName: '', subject: q.subject,
    unit: q.unit, questionText: q.questionText, imageLink: q.imageLink,
    optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
    image: q.imageLink, correctAnswer: q.correctAnswer,
    marksCorrect: q.marksCorrect, marksWrong: q.marksWrong, explanation: q.explanation
  }));
  return { success: true, total: questions.length, questions };
}

async function getQuestionsBySubject(subject) {
  if (!subject) throw new Error('subject is required');
  const docs = await Question.find({ subject: new RegExp('^' + subject + '$', 'i') }).lean();
  const questions = docs.map(q => ({
    id: q.questionId, text: autoFormatQuestionText(q.questionText),
    options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD },
    correctAnswer: (q.correctAnswer || '').toUpperCase(),
    explanation: q.explanation, image: q.imageLink, unit: q.unit
  }));
  return { success: true, subject, total: questions.length, questions };
}

module.exports = { addQuestion, bulkAddQuestions, deleteQuestion, getAllQuestions, getQuestionsBySubject };