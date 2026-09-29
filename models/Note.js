const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  noteId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  category: { type: String, default: '' },       // e.g. "jkpsi jkpsc" (space-separated, matches old filter tags)
  catLabel: { type: String, default: '' },
  description: { type: String, default: '' },
  meta: [{ type: String }],                        // small badge chips, e.g. ["70+ MCQs","Formula Sheets"]
  tag: { type: String, enum: ['', 'new', 'hot', 'ask'], default: '' },
  tagLabel: { type: String, default: '' },
  origPrice: { type: Number, required: true },
  price: { type: Number, required: true },
  image: { type: String, default: '' },
  fileId: { type: String, default: '' },            // Google Drive file ID for the PDF
  isBundle: { type: Boolean, default: false },
  bundleNoteIds: [{ type: String }],                 // if isBundle, the noteIds it expands to
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Note', noteSchema);
