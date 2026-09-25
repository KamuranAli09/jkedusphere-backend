function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [l, d] = email.split('@');
  return l[0] + '***' + (l.length > 4 ? l.slice(-1) : '') + '@' + d;
}

module.exports = { maskEmail };