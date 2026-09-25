require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const mongoose = require('mongoose');

const Test = require('../models/Test');
const Question = require('../models/Question');
const Purchase = require('../models/Purchase');
const Submission = require('../models/Submission');

const DATA_DIR = path.join(__dirname, '..', 'migration-data');

function readCsv(filename, headerMarker) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${filename} — not found in migration-data/`);
    return [];
  }
  const raw = fs.readFileSync(filePath, 'utf8');
    const allRows = parse(raw, { skip_empty_lines: false });
  if (!allRows.length) {
    console.log(`⚠️  ${filename} is empty — nothing to import`);
    return [];
  }

  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, allRows.length); i++) {
    if (allRows[i].some(cell => cell === headerMarker)) { headerIdx = i; break; }
  }
  const headers = allRows[headerIdx].map(h => h.trim());
  const dataRows = allRows.slice(headerIdx + 1).filter(r => r.some(c => c && c.trim()));

  return dataRows.map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i].trim() : ''; });
    return obj;
  });
}

async function migrateTests() {
  const rows = readCsv('Tests_Config.csv', 'Test_ID');
  let count = 0;
  for (const r of rows) {
    if (!r.Test_ID) continue;
    await Test.updateOne(
      { testId: r.Test_ID },
      {
        testId: r.Test_ID, testName: r.Test_Name, subject: r.Subject,
        totalQuestions: parseInt(r.Total_Questions) || 0,
        durationMinutes: parseInt(r.Duration_Minutes) || 60,
        marksCorrect: parseFloat(r.Marks_Correct) || 1,
        marksWrong: parseFloat(r.Marks_Wrong) || 0,
        totalMarks: parseFloat(r.Total_Marks) || 0,
        passMarks: parseFloat(r.Pass_Marks) || 0,
        active: (r.Active || '').toUpperCase() === 'YES',
        access: r.access || 'free', packId: r.packId || '',
        pdfLink: r.PDF_Link || '', examGroup: r.examGroup || ''
      },
      { upsert: true }
    );
    count++;
  }
  console.log(`✅ Tests migrated: ${count}`);
}

async function migrateQuestions() {
  const rows = readCsv('Questions_Bank.csv', 'Question_ID');
  let count = 0;
  const batch = [];
  for (const r of rows) {
    if (!r.Question_ID) continue;
    batch.push({
      updateOne: {
        filter: { questionId: r.Question_ID },
        update: {
          questionId: r.Question_ID, testId: r.Test_ID, subject: r.Subject, unit: r.Unit,
          questionText: r.Question_Text, optionA: r.Option_A, optionB: r.Option_B,
          optionC: r.Option_C, optionD: r.Option_D,
          correctAnswer: (r.Correct_Answer || '').toUpperCase(),
          marksCorrect: parseFloat(r.Marks_Correct) || 1,
          marksWrong: parseFloat(r.Marks_Wrong) || -0.25,
          explanation: r.Explanation || '', imageLink: r.Image_Link || ''
        },
        upsert: true
      }
    });
    count++;
  }
  if (batch.length) await Question.bulkWrite(batch);
  console.log(`✅ Questions migrated: ${count}`);
}

async function migratePurchases() {
  const rows = readCsv('Purchases.csv', 'email');
  let count = 0;
  const batch = [];
  for (const r of rows) {
    if (!r.email || !r.packId) continue;
    const amount = parseFloat(String(r.amount || '0').replace(/[^\d.]/g, '')) || 0;
    batch.push({
      updateOne: {
        filter: { paymentId: r.paymentId || `${r.email}-${r.packId}-${r.timestamp}` },
        update: { email: r.email.toLowerCase(), packId: r.packId, name: r.name || '', paymentId: r.paymentId || '', amount },
        upsert: true
      }
    });
    count++;
  }
  if (batch.length) await Purchase.bulkWrite(batch);
  console.log(`✅ Purchases migrated: ${count}`);
}

async function migrateSubmissions() {
  const rows = readCsv('Submissions.csv', 'Submission_ID');
  let count = 0, skipped = 0;
  const batch = [];
  for (const r of rows) {
    if (!r.Submission_ID) continue;
    let answers = {};
    try { if (r.Answers_JSON) answers = JSON.parse(r.Answers_JSON); } catch (e) { skipped++; }

    batch.push({
      updateOne: {
        filter: { submissionId: r.Submission_ID },
        update: {
          submissionId: r.Submission_ID, testId: r.Test_ID, testName: r.Test_Name,
          studentName: r.Student_Name, studentEmail: (r.Student_Email || '').toLowerCase(),
          score: parseFloat(r.Score) || 0, totalMarks: parseFloat(r.Total_Marks) || 0,
          percentage: parseFloat(r.Percentage) || 0, timeTakenSec: parseInt(r.Time_Taken_Sec) || 0,
          correct: parseInt(r.Correct) || 0, wrong: parseInt(r.Wrong) || 0, skipped: parseInt(r.Skipped) || 0,
          answers
        },
        upsert: true
      }
    });
    count++;
  }
  if (batch.length) await Submission.bulkWrite(batch);
  console.log(`✅ Submissions migrated: ${count} (${skipped} had unparseable answers, imported anyway)`);
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected\n');

  await migrateTests();
  await migrateQuestions();
  await migratePurchases();
  await migrateSubmissions();

  console.log('\n🎉 Data migration complete. Users NOT touched — run migrate-users.js separately when ready to go live.');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});