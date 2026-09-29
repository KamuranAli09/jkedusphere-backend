const Note = require('../models/Note');
const DownloadToken = require('../models/DownloadToken');
const crypto = require('crypto');

async function getAllNotes() {
  const notes = await Note.find({ active: true }).lean();
  return {
    success: true,
    notes: notes.map(n => ({
      id: n.noteId, cat: n.category, tag: n.tag, tagLabel: n.tagLabel,
      title: n.title, catLabel: n.catLabel, desc: n.description, meta: n.meta,
      orig: n.origPrice, price: n.price, img: n.image, isBundle: n.isBundle,
      bundleIds: n.bundleNoteIds || []
    }))
  };
}

// ── Admin ──
async function getAllNotesAdmin() {
  const notes = await Note.find({}).sort({ createdAt: -1 }).lean();
  return { success: true, total: notes.length, notes };
}

async function saveNote(n) {
  if (!n || !n.noteId || !n.title || !n.price) throw new Error('noteId, title, and price are required.');
  const doc = {
    noteId: n.noteId, title: n.title, category: n.category || '',
    catLabel: n.catLabel || '', description: n.description || '',
    meta: Array.isArray(n.meta) ? n.meta : String(n.meta || '').split(',').map(s => s.trim()).filter(Boolean),
    tag: n.tag || '', tagLabel: n.tagLabel || '',
    origPrice: parseFloat(n.origPrice) || parseFloat(n.price),
    price: parseFloat(n.price), image: n.image || '', fileId: n.fileId || '',
    isBundle: !!n.isBundle,
    bundleNoteIds: Array.isArray(n.bundleNoteIds) ? n.bundleNoteIds : String(n.bundleNoteIds || '').split(',').map(s => s.trim()).filter(Boolean),
    active: n.active !== false
  };
  const existing = await Note.findOne({ noteId: n.noteId });
  if (existing) {
    await Note.updateOne({ noteId: n.noteId }, doc);
    return { success: true, action: 'updated', noteId: n.noteId };
  }
  await Note.create(doc);
  return { success: true, action: 'added', noteId: n.noteId };
}

async function deleteNote(noteId) {
  if (!noteId) throw new Error('noteId required');
  const result = await Note.deleteOne({ noteId });
  if (result.deletedCount === 0) throw new Error('Note not found: ' + noteId);
  return { success: true, deleted: noteId };
}

// ── Payment verify + redeem (mirrors the old two-step Apps Script flow) ──
async function verifyPurchase(body) {
  const paymentId = body.paymentId;
  const productId = body.productId;
  if (!paymentId || !productId) return { error: 'Missing paymentId or productId' };

  const note = await Note.findOne({ noteId: productId }).lean();
  if (!note) return { error: 'Product not found: ' + productId };

  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  let payment;
  try {
    const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    payment = await rzpRes.json();
  } catch (err) {
    return { error: 'Could not reach Razorpay: ' + err.message };
  }

  if (payment.error) return { error: 'Razorpay: ' + payment.error.description };
  if (payment.status !== 'captured' && payment.status !== 'authorized') {
    return { error: `Payment status is '${payment.status}', expected captured` };
  }
  if (payment.amount !== note.price * 100) {
    return { error: `Amount mismatch. Expected ₹${note.price}, got ${payment.amount / 100}` };
  }

  const already = await DownloadToken.findOne({ paymentId });
  if (already) return { error: 'This payment was already redeemed. Contact support.' };

  const noteIds = note.isBundle ? note.bundleNoteIds : [productId];
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await DownloadToken.create({ token, noteIds, paymentId, expiresAt });

  return { token, expiresAt: expiresAt.toISOString() };
}

async function redeemToken(token) {
  if (!token) return { error: 'invalid_token', message: 'No token provided.' };

  const record = await DownloadToken.findOne({ token });
  if (!record) return { error: 'invalid_token', message: 'Invalid or expired link.' };
  if (record.used) return { error: 'link_used', message: 'Link already used. Contact support with Payment ID: ' + record.paymentId };
  if (new Date() > record.expiresAt) return { error: 'link_expired', message: 'Link expired. Contact support with Payment ID: ' + record.paymentId };

  record.used = true;
  record.redeemedAt = new Date();
  await record.save();

  const notes = await Note.find({ noteId: { $in: record.noteIds } }).lean();
  const links = notes
    .filter(n => n.fileId && n.fileId !== 'BUNDLE')
    .map(n => ({ title: n.title, url: `https://drive.google.com/uc?export=download&id=${n.fileId}` }));

  if (!links.length) return { error: 'File not found. Contact support with Payment ID: ' + record.paymentId };

  return { success: true, downloads: links, paymentId: record.paymentId };
}

module.exports = { getAllNotes, getAllNotesAdmin, saveNote, deleteNote, verifyPurchase, redeemToken };
