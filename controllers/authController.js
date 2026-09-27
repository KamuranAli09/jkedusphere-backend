const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendPasswordResetLinkEmail } = require('../utils/mailer');

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
  if (!user) return { success: true, message: 'If an account exists for ' + email + ', a reset link has been sent.' };

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.passwordResetToken = tokenHash;
  user.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const resetLink = `${process.env.FRONTEND_URL}?resetToken=${rawToken}&email=${encodeURIComponent(email)}`;

  sendPasswordResetLinkEmail(email, user.name || 'Student', resetLink)
    .catch(err => console.error('Failed to send reset email to', email, err.message));

  return { success: true, message: 'If an account exists for ' + email + ', a reset link has been sent.' };
}

async function resetPassword(body) {
  const email = (body.email || '').toLowerCase().trim();
  const token = String(body.token || '').trim();
  const newPassword = String(body.newPassword || '');

  if (!email || !token || !newPassword) return { success: false, error: 'Missing email, token, or new password.' };
  if (newPassword.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    email,
    passwordResetToken: tokenHash,
    passwordResetExpiry: { $gt: new Date() }
  });

  if (!user) return { success: false, error: 'This reset link is invalid or has expired. Please request a new one.' };

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordResetToken = undefined;
  user.passwordResetExpiry = undefined;
  await user.save();

  return { success: true, message: 'Password updated. You can now sign in.' };
}

module.exports = { register, login, forgotPassword, resetPassword };