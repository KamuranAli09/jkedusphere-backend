require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendMigrationEmail } = require('../utils/mailer');

const DATA_DIR = path.join(__dirname, '..', 'migration-data');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function readCsv(filename, headerMarker) {
  const filePath = path.join(DATA_DIR, filename);
  const raw = fs.readFileSync(filePath, 'utf8');
  const allRows = parse(raw, { skip_empty_lines: false });
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

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 10; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
  return pw;
}

async function run() {
  console.log('⚠️  This will set new passwords and EMAIL EVERY USER. Ctrl+C now to cancel.');
  await sleep(5000);

  await mongoose.connect(process.env.MONGODB_URI);
  const rows = readCsv('Users.csv', 'email');
  let count = 0;

  for (const r of rows) {
    if (!r.email) continue;
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const purchasedPacks = (r.purchased_packs || '').split(',').map(s => s.trim()).filter(Boolean);

    await User.updateOne(
      { email: r.email.toLowerCase() },
      { email: r.email.toLowerCase(), phone: r.phone || '', name: r.name || '', exam: r.exam || '', district: r.district || '', passwordHash, tier: r.tier || 'free', purchasedPacks },
      { upsert: true }
    );

    try {
      await sendMigrationEmail(r.email, r.name || 'Student', tempPassword);
      console.log(`📧 ${r.email}`);
    } catch (e) {
      console.log(`⚠️  Email failed for ${r.email}: ${e.message}`);
    }
    count++;
    await sleep(1200);
  }

  console.log(`\n🎉 ${count} users migrated and emailed.`);
  process.exit(0);
}

run().catch(err => { console.error('❌ Failed:', err); process.exit(1); });