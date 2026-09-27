const { Resend } = require('resend');
const nodemailer = require('nodemailer');

let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

let transporter;
if (!resend && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
}

async function sendPasswordResetLinkEmail(toEmail, name, resetLink) {
  const subject = 'JKEdusphere — Reset Your Password';
  const text =
    `Hello ${name},\n\n` +
    `We received a request to reset your JKEdusphere password.\n\n` +
    `Click this link to set a new password (valid for 1 hour):\n${resetLink}\n\n` +
    `If you did not request this, you can safely ignore this email — your password will not change.\n\n` +
    `— JKEdusphere Team`;

  if (resend) {
    await resend.emails.send({
      from: 'JKEdusphere <noreply@jkedusphere.com>',
      to: toEmail,
      subject,
      text
    });
    return;
  }

  if (transporter) {
    await transporter.sendMail({
      from: `"JKEdusphere" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject,
      text
    });
    return;
  }

  console.warn('No mailer configured: set RESEND_API_KEY or GMAIL_USER + GMAIL_APP_PASSWORD');
}

async function sendMigrationEmail(toEmail, name, tempPassword) {
  const subject = "JKEdusphere — We've Upgraded! Your New Login";
  const text =
    `Hello ${name},\n\n` +
    `We've upgraded JKEdusphere's backend for a much faster experience — no more slow submissions or leaderboard delays!\n\n` +
    `As part of this upgrade, you'll need a new password to sign in. Your temporary password is:\n\n` +
    `${tempPassword}\n\n` +
    `Sign in with your email and this password. You can change it anytime using "Forgot Password" on the sign-in screen.\n\n` +
    `Your test history, scores, and premium access are all preserved — nothing is lost.\n\n` +
    `Questions? Reach us on Telegram: t.me/JKEdusphere\n\n` +
    `— JKEdusphere Team`;

  if (resend) {
    await resend.emails.send({
      from: 'JKEdusphere <noreply@jkedusphere.com>',
      to: toEmail,
      subject,
      text
    });
    return;
  }

  if (transporter) {
    await transporter.sendMail({
      from: `"JKEdusphere" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject,
      text
    });
    return;
  }

  console.warn('No mailer configured: set RESEND_API_KEY or GMAIL_USER + GMAIL_APP_PASSWORD');
}

module.exports = { sendPasswordResetLinkEmail, sendMigrationEmail };