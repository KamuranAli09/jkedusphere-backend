const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('../utils/mailer');

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 10; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
  return pw;
}

async function register(body) {
  const email = (body.email || '').toLowerCase().trim();
  const phone = (body.phone || '').trim();
  const name = (body.name || '').trim();
  const exam = (body.exam || '').trim();
  const district = (body.district || '').trim();
  const password = String(body.password || '');

  if (!email || !name || !password) return { success: false, error: 'Email, name and password are required.' };
  if (!/\S+@\S+\.\S+/.test(email)) return { success: false, error: 'Invalid email address.' };
  if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };

  const existing = await User.findOne({ email });
  if (existing) return { success: false, error: 'An account with this email already exists. Please sign in.' };

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ email, phone, name, exam, district, passwordHash, tier: 'free', purchasedPacks: [] });

  return { success: true, user: { email, phone, name, exam, district, tier: 'free', purchasedPacks: [] } };
}

async function login(email, password) {
  email = (email || '').toLowerCase().trim();
  password = String(password || '');
  if (!email || !password) return { success: false, error: 'Email and password are required.' };

  const user = await User.findOne({ email });
  if (!user) return { success: false, error: 'No account found with this email.' };

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return { success: false, error: 'Incorrect password.' };

  return {
    success: true,
    user: {
      email: user.email, phone: user.phone, name: user.name,
      exam: user.exam, district: user.district,
      tier: user.tier, purchasedPacks: user.purchasedPacks || []
    }
  };
}

async function forgotPassword(email) {
  email = (email || '').toLowerCase().trim();
  if (!email) return { success: false, error: 'Email is required.' };

  const user = await User.findOne({ email });
  if (!user) return { success: false, error: 'No account found with this email.' };

  const tempPassword = generateTempPassword();
  user.passwordHash = await bcrypt.hash(tempPassword, 10);
  await user.save();

  try {
    await sendPasswordResetEmail(email, user.name || 'Student', tempPassword);
  } catch (mailErr) {
    return { success: false, error: 'Could not send email: ' + mailErr.message };
  }

  return { success: true, message: 'A new password has been sent to ' + email };
}

module.exports = { register, login, forgotPassword };