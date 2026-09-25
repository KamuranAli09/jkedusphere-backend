const ExamConfig = require('../models/ExamConfig');
const AnswerKey = require('../models/AnswerKey');
const OfficialSubmission = require('../models/OfficialSubmission');

async function saveExamAK(body) {
  const examId = String(body.examID || '').trim();
  const examName = String(body.examName || '').trim();
  const totalQuestions = parseInt(body.totalQuestions) || 0;
  const sets = (body.sets || []).map(s => String(s).trim().toUpperCase()).filter(Boolean);
  const status = body.status || 'NotReleased';
  const negativeMarking = !!body.negativeMarking;
  const marksPerQuestion = parseFloat(body.marksPerQuestion) || 1;
  const negMarksPerQuestion = parseFloat(body.negMarksPerQuestion) || 0;

  if (!examId || !examName || !totalQuestions || !sets.length) {
    throw new Error('examID, examName, totalQuestions, and at least one set are required.');
  }

  await ExamConfig.updateOne(
    { examId },
    { examId, examName, totalQuestions, sets, status, negativeMarking, marksPerQuestion, negMarksPerQuestion },
    { upsert: true }
  );

  const ops = [];
  for (let q = 1; q <= totalQuestions; q++) {
    ops.push({
      updateOne: {
        filter: { examId, qNo: q },
        update: { $setOnInsert: { status: 'Normal', marks: marksPerQuestion, negMarks: negMarksPerQuestion, tentativeAnswers: {}, officialAnswers: {} } },
        upsert: true
      }
    });
  }
  if (ops.length) await AnswerKey.bulkWrite(ops);

  return { success: true, examID: examId };
}

async function getExamsAK() {
  const docs = await ExamConfig.find({}).lean();
  return {
    success: true,
    exams: docs.map(e => ({
      examID: e.examId, examName: e.examName, totalQuestions: e.totalQuestions,
      sets: e.sets || [], status: e.status || 'NotReleased',
      negativeMarking: e.negativeMarking, marksPerQuestion: e.marksPerQuestion,
      negMarksPerQuestion: e.negMarksPerQuestion
    }))
  };
}

async function deleteExamAK(examID) {
  examID = String(examID || '').trim();
  if (!examID) throw new Error('examID required');
  await ExamConfig.deleteOne({ examId: examID });
  await AnswerKey.deleteMany({ examId: examID });
  return { success: true, deleted: examID };
}

async function getAnswerKeyAK(examID, version) {
  examID = String(examID || '').trim();
  version = String(version || '').trim();
  if (!examID || !version) throw new Error('examID and version required.');
  const field = version === 'Official' ? 'officialAnswers' : 'tentativeAnswers';
  const docs = await AnswerKey.find({ examId: examID }).sort({ qNo: 1 }).lean();
  const sets = {};
  docs.forEach(d => {
    const ansMap = d[field] || {};
    Object.keys(ansMap).forEach(setName => {
      if (!sets[setName]) sets[setName] = {};
      sets[setName][d.qNo] = ansMap[setName];
    });
  });
  return { success: true, sets };
}

async function saveAnswerKeyAK(body) {
  const examID = String(body.examID || '').trim();
  const version = String(body.version || '').trim();
  const setName = String(body.set || '').trim().toUpperCase();
  const answers = body.answers || {};
  if (!examID || !version || !setName) throw new Error('examID, version, and set are required.');
  if (!['Tentative', 'Official'].includes(version)) throw new Error('version must be Tentative or Official.');

  const field = version === 'Official' ? 'officialAnswers' : 'tentativeAnswers';
  const ops = [];
  let updated = 0;
  for (const qNo of Object.keys(answers)) {
    const val = String(answers[qNo] || '').toUpperCase().trim();
    if (!val) continue;
    ops.push({
      updateOne: {
        filter: { examId: examID, qNo: parseInt(qNo) },
        update: { $set: { [`${field}.${setName}`]: val } }
      }
    });
    updated++;
  }
  if (ops.length) await AnswerKey.bulkWrite(ops);
  return { success: true, updated };
}

async function submitAnswerKey(body) {
  const examId = String(body.examID || '').trim();
  const setName = String(body.set || '').trim().toUpperCase();
  const studentName = String(body.studentName || '').trim();
  const studentEmail = String(body.studentEmail || '').toLowerCase().trim();
  const answers = body.answers || {};

  if (!examId || !setName) throw new Error('examID and set are required');
  if (!studentEmail) throw new Error('You must be signed in to use the Answer Key Matcher.');

  const exam = await ExamConfig.findOne({ examId }).lean();
  if (!exam) throw new Error('Exam not found: ' + examId);
  if (exam.status === 'NotReleased') throw new Error('Answer key not yet released for this exam.');

  const negativeMarking = !!exam.negativeMarking;
  const defaultMarks = exam.marksPerQuestion || 1;
  const defaultNegMarks = exam.negMarksPerQuestion || 0;
  const keyDocs = await AnswerKey.find({ examId }).sort({ qNo: 1 }).lean();

  function scoreAgainst(field) {
    let score = 0, correctCount = 0, wrongCount = 0, unattemptedCount = 0, total = 0, hasData = false;
    const review = [];
    for (const doc of keyDocs) {
      const correctAnswer = ((doc[field] || {})[setName] || '').toUpperCase().trim();
      if (correctAnswer) hasData = true;
      total++;
      const given = String(answers[String(doc.qNo)] || '').toUpperCase().trim() || 'NOT ATTEMPTED';
      const marks = doc.marks != null ? doc.marks : defaultMarks;
      const negMarks = doc.negMarks != null ? doc.negMarks : defaultNegMarks;
      let status = 'unattempted';
      if (doc.status === 'Dropped' || doc.status === 'Bonus') {
        score += marks; status = 'bonus';
      } else if (given === 'NOT ATTEMPTED') {
        unattemptedCount++;
      } else if (given === correctAnswer) {
        score += marks; correctCount++; status = 'correct';
      } else {
        wrongCount++; status = 'wrong';
        if (negativeMarking) score -= negMarks;
      }
      review.push({ qNo: doc.qNo, given, correct: correctAnswer, status });
    }
    return { hasData, score: Math.round(score * 100) / 100, correctCount, wrongCount, unattemptedCount, totalQuestions: total, review };
  }

  const tentative = scoreAgainst('tentativeAnswers');
  const official = scoreAgainst('officialAnswers');

  if (!tentative.hasData && !official.hasData) {
    throw new Error(`Answer key for Set ${setName} has not been entered yet. Please try again once it's published, or contact support.`);
  }

  const primary = tentative.hasData ? tentative : official;

  await OfficialSubmission.create({
    examId, set: setName, studentName, studentEmail, answers,
    tentativeScore: primary.score,
    officialScore: official.hasData ? official.score : undefined,
    correctCount: primary.correctCount, wrongCount: primary.wrongCount, unattemptedCount: primary.unattemptedCount
  });

  return {
    success: true, tentativeScore: primary.score,
    officialScore: official.hasData ? official.score : null,
    officialAvailable: official.hasData,
    correctCount: primary.correctCount, wrongCount: primary.wrongCount,
    unattemptedCount: primary.unattemptedCount, totalQuestions: primary.totalQuestions,
    review: primary.review, officialReview: official.hasData ? official.review : null
  };
}

module.exports = { saveExamAK, getExamsAK, deleteExamAK, getAnswerKeyAK, saveAnswerKeyAK, submitAnswerKey };