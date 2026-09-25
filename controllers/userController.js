const User = require('../models/User');

async function listUsers(search) {
  const filter = search
    ? { $or: [{ email: new RegExp(search, 'i') }, { name: new RegExp(search, 'i') }] }
    : {};
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  return {
    success: true,
    total: users.length,
    users: users.map(u => ({
      email: u.email, phone: u.phone, name: u.name, exam: u.exam, district: u.district,
      tier: u.tier, purchasedPacks: u.purchasedPacks || [], joined: u.createdAt
    }))
  };
}

async function updateUser(body) {
  const email = (body.email || '').toLowerCase().trim();
  if (!email) throw new Error('email is required');

  const update = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.phone !== undefined) update.phone = body.phone;
  if (body.exam !== undefined) update.exam = body.exam;
  if (body.district !== undefined) update.district = body.district;
  if (body.tier !== undefined) update.tier = body.tier;
  if (body.purchasedPacks !== undefined) {
    update.purchasedPacks = Array.isArray(body.purchasedPacks)
      ? body.purchasedPacks
      : String(body.purchasedPacks).split(',').map(s => s.trim()).filter(Boolean);
  }

  const result = await User.updateOne({ email }, { $set: update });
  if (result.matchedCount === 0) throw new Error('User not found: ' + email);
  return { success: true, updated: email };
}

module.exports = { listUsers, updateUser };