const Pack = require('../models/Pack');
const Test = require('../models/Test');

// Public: only active packs, sorted for display
async function getAllPacks() {
  const packs = await Pack.find({ active: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  return packs.map(formatPack);
}

// Admin: all packs regardless of active state
async function getAllPacksAdmin() {
  const packs = await Pack.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean();
  // attach how many tests currently reference each pack, useful in the admin table
  const counts = await Test.aggregate([
    { $match: { packId: { $ne: '' } } },
    { $group: { _id: '$packId', count: { $sum: 1 } } }
  ]);
  const countMap = {};
  counts.forEach(c => { countMap[c._id] = c.count; });
  return packs.map(p => ({ ...formatPack(p), testCount: countMap[p.packId] || 0 }));
}

function formatPack(p) {
  return {
    packId: p.packId,
    name: p.name,
    description: p.description || '',
    examGroup: p.examGroup || '',
    price: p.price || 0,
    originalPrice: p.originalPrice || 0,
    validityDays: p.validityDays || 0,
    active: !!p.active,
    sortOrder: p.sortOrder || 0
  };
}

async function savePack(p) {
  if (!p || !p.packId || !p.name) throw new Error('packId and name are required.');

  const existing = await Pack.findOne({ packId: p.packId });

  const doc = {
    packId: p.packId,
    name: p.name,
    description: p.description || '',
    examGroup: p.examGroup || '',
    price: parseFloat(p.price) || 0,
    originalPrice: parseFloat(p.originalPrice) || 0,
    validityDays: parseInt(p.validityDays) || 0,
    active: p.active === true || p.active === 'YES' || p.active === 'true'
  };

  if (existing) {
    await Pack.updateOne({ packId: p.packId }, doc);
    return { success: true, action: 'updated', packId: p.packId };
  }

  // new pack goes to the end of the list
  const last = await Pack.findOne({}).sort({ sortOrder: -1 });
  doc.sortOrder = last ? (last.sortOrder || 0) + 10 : 10;

  await Pack.create(doc);
  return { success: true, action: 'added', packId: p.packId };
}

async function deletePack(packId) {
  if (!packId) throw new Error('packId required');

  // guard: warn (but still allow) if tests are still pointing at this pack
  const testCount = await Test.countDocuments({ packId });

  const result = await Pack.deleteOne({ packId });
  if (result.deletedCount === 0) throw new Error('Pack not found: ' + packId);

  return { success: true, deleted: packId, testsStillLinked: testCount };
}

module.exports = { getAllPacks, getAllPacksAdmin, savePack, deletePack };
