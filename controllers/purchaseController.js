const Purchase = require('../models/Purchase');
const User = require('../models/User');

async function recordPurchase(body) {
  const email = (body.email || '').toLowerCase().trim();
  const name = (body.name || '').trim();
  const packId = (body.packId || '').trim();
  const paymentId = (body.paymentId || '').trim();
  const amount = String(body.amount || '').replace(/[^\d.]/g, '');

  if (!email || !packId) return { success: false, error: 'Missing email or packId.' };

  if (paymentId) {
    const already = await Purchase.findOne({ paymentId });
    if (!already) await Purchase.create({ email, packId, name, paymentId, amount: parseFloat(amount) || 0 });
  } else {
    await Purchase.create({ email, packId, name, paymentId, amount: parseFloat(amount) || 0 });
  }

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ email, name, tier: 'premium', purchasedPacks: [packId], passwordHash: '' });
  } else {
    user.tier = 'premium';
    if (!user.purchasedPacks.includes(packId)) user.purchasedPacks.push(packId);
    await user.save();
  }

  return {
    success: true,
    user: { email: user.email, phone: user.phone, name: user.name, exam: user.exam, district: user.district, tier: 'premium', purchasedPacks: user.purchasedPacks }
  };
}

async function verifyAccess(email, packId) {
  email = String(email || '').toLowerCase().trim();
  packId = String(packId || '').trim();
  if (!email || !packId) return { hasAccess: false, error: 'Missing email or packId' };

  const purchase = await Purchase.findOne({ email, packId });
  if (purchase) return { hasAccess: true };

  const user = await User.findOne({ email });
  if (user && (user.purchasedPacks || []).includes(packId)) return { hasAccess: true };

  return { hasAccess: false };
}

module.exports = { recordPurchase, verifyAccess };