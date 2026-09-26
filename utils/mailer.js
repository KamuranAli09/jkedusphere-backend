const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

async function sendPasswordResetLinkEmail(toEmail, name, resetLink) {
  await transporter.sendMail({
    from: `"JKEdusphere" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'JKEdusphere — Reset Your Password',
    text:
      `Hello ${name},\n\n` +
      `We received a request to reset your JKEdusphere password.\n\n` +
      `Click this link to set a new password (valid for 1 hour):\n${resetLink}\n\n` +
      `If you did not request this, you can safely ignore this email — your password will not change.\n\n` +
      `— JKEdusphere Team`
  });
}

async function sendMigrationEmail(toEmail, name, tempPassword) {
  await transporter.sendMail({
    from: `"JKEdusphere" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: "JKEdusphere — We've Upgraded! Your New Login",
    text:
      `Hello ${name},\n\n` +
      `We've upgraded JKEdusphere's backend for a much faster experience — no more slow submissions or leaderboard delays!\n\n` +
      `As part of this upgrade, you'll need a new password to sign in. Your temporary password is:\n\n` +
      `${tempPassword}\n\n` +
      `Sign in with your email and this password. You can change it anytime using "Forgot Password" on the sign-in screen.\n\n` +
      `Your test history, scores, and premium access are all preserved — nothing is lost.\n\n` +
      `Questions? Reach us on Telegram: t.me/JKEdusphere\n\n` +
      `— JKEdusphere Team`
  });
}

module.exports = { sendPasswordResetLinkEmail, sendMigrationEmail };
