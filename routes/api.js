const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const testCtrl = require('../controllers/testController');
const questionCtrl = require('../controllers/questionController');
const akCtrl = require('../controllers/akController');
const submissionCtrl = require('../controllers/submissionController');
const purchaseCtrl = require('../controllers/purchaseController');
const userCtrl = require('../controllers/userController');
const notesCtrl = require('../controllers/notesController');

router.get('/', async (req, res) => {
  const { action } = req.query;
  try {
    switch (action) {
      case 'login':
        return res.json(await auth.login(req.query.email, req.query.password));
      case 'forgotPassword':
        return res.json(await auth.forgotPassword(req.query.email));
        case 'resetPassword':
        return res.json(await auth.resetPassword(req.body));
      case 'getTests':
        return res.json(await testCtrl.getAllTests());
      case 'getTest':
        return res.json(await testCtrl.getTest(req.query.testId));
      case 'getTestPractice':
        return res.json(await testCtrl.getTestPractice(req.query.testId));
      case 'getAllQuestions':
        return res.json(await questionCtrl.getAllQuestions());
              case 'getLeaderboard':
        return res.json(await submissionCtrl.getLeaderboard(req.query.testId, parseInt(req.query.limit) || 20));
      case 'getPackLeaderboard':
        return res.json(await submissionCtrl.getPackLeaderboard(req.query.packId, parseInt(req.query.limit) || 50));
      case 'getStudentHistory':
        return res.json(await submissionCtrl.getStudentHistory(req.query.email));
      case 'getSubmissionReview':
        return res.json(await submissionCtrl.getSubmissionReview(req.query.submissionId, req.query.email));
      case 'getWeakAreas':
        return res.json(await submissionCtrl.getWeakAreas(req.query.email));
      case 'verifyAccess':
        return res.json(await purchaseCtrl.verifyAccess(req.query.email, req.query.packId));
      case 'getQuestionsBySubject':
        return res.json(await questionCtrl.getQuestionsBySubject(req.query.subject));
      case 'getExamsAK':
        return res.json(await akCtrl.getExamsAK());
      case 'getAnswerKeyAK':
        return res.json(await akCtrl.getAnswerKeyAK(req.query.examID, req.query.version));
      case 'getSubmissionsCount':
        return res.json(await submissionCtrl.getSubmissionsCount());
              case 'getAllUsers':
        return res.json(await userCtrl.listUsers(req.query.search));
      case 'listSubmissions':
        return res.json(await submissionCtrl.listSubmissions({ page: req.query.page, limit: req.query.limit, email: req.query.email, testId: req.query.testId }));
              case 'getNotes':
        return res.json(await notesCtrl.getAllNotes());
      case 'getAllNotesAdmin':
        return res.json(await notesCtrl.getAllNotesAdmin());
      case 'redeemToken':
        return res.json(await notesCtrl.redeemToken(req.query.token));
      default:
        return res.json({ error: 'Unknown action: ' + (action || 'none') });
    }
  } catch (err) {
    res.json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { action } = req.body;
  try {
    switch (action) {
      case 'register':
        return res.json(await auth.register(req.body));
      case 'login':
        return res.json(await auth.login(req.body.email, req.body.password));
      case 'forgotPassword':
        return res.json(await auth.forgotPassword(req.body.email));
      case 'addQuestion':
        return res.json(await questionCtrl.addQuestion(req.body.question));
      case 'bulkAddQuestions':
        return res.json(await questionCtrl.bulkAddQuestions(req.body.questions));
      case 'deleteQuestion':
        return res.json(await questionCtrl.deleteQuestion(req.body.questionId));
      case 'saveTest':
        return res.json(await testCtrl.saveTest(req.body.test));
      case 'deleteTest':
        return res.json(await testCtrl.deleteTest(req.body.testId));
      case 'saveExamAK':
        return res.json(await akCtrl.saveExamAK(req.body));
      case 'deleteExamAK':
        return res.json(await akCtrl.deleteExamAK(req.body.examID));
      case 'saveAnswerKeyAK':
        return res.json(await akCtrl.saveAnswerKeyAK(req.body));
      case 'submitAnswerKey':
        return res.json(await akCtrl.submitAnswerKey(req.body));
              case 'submitTest':
        return res.json(await submissionCtrl.submitTest(req.body));
      case 'recordPurchase':
        return res.json(await purchaseCtrl.recordPurchase(req.body));
        case 'resetPassword':
        return res.json(await auth.resetPassword(req.body));
              case 'updateUser':
        return res.json(await userCtrl.updateUser(req.body));
      case 'deleteSubmission':
        return res.json(await submissionCtrl.deleteSubmission(req.body.submissionId));
              case 'verifyPurchase':
        return res.json(await notesCtrl.verifyPurchase(req.body));
      case 'saveNote':
        return res.json(await notesCtrl.saveNote(req.body.note));
      case 'deleteNote':
        return res.json(await notesCtrl.deleteNote(req.body.noteId));
      default:
        return res.json({ error: 'Unknown POST action: ' + action });
    }
  } catch (err) {
    res.json({ error: err.message });
  }
});

module.exports = router;
