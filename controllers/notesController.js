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
async function seedNotes(providedKey) {
  if (!process.env.ADMIN_SEED_KEY || providedKey !== process.env.ADMIN_SEED_KEY) {
    return { error: 'Unauthorized' };
  }

  const NOTES = [
    { noteId: "jkpsi_bundle", title: "JKPSI Telecom IT Part Plus Communication System Complete Bundle", category: "jkpsi", catLabel: "All 7 Units · JKPSI Telecom", description: "Get all 7 core JKPSI Telecom notes in one bundle — Communication Systems, CS & Networking, IT System & Egov, DBMS, IoT & Embedded Systems, Cyber Security & IT Act, and AI & Data Science. Save ₹290 vs buying individually.", meta: ["7 PDFs Included", "Save ₹290", "90 Marks"], tag: "hot", tagLabel: "Best Value", origPrice: 789, price: 499, image: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgGrnDJApaBNpVgpiJdv5phH9ERCiHn9XEzUE7nTmdmb_3Yxhaz4JIOWmuV-ESm7qk3f7VSUNzT_ycXnqtJ8oVN2gX9l8VffMBonFQG7Dudx5wm6Z7k6DhiVtBRjO3Ci8a4aVyF-ELOIOc6pqg3Zd2Wk8bqf3kY7aauLE-MR2wZ8BpuyPrvl-LsaII5mtY/s1536/photo_2026-06-13_16-49-08.jpg", fileId: "BUNDLE", isBundle: true, bundleNoteIds: ["itsys_egov", "cs_networking", "communication_systems_jkpsi", "dbms_jkpsi", "iot_embedded", "cyber_security", "ai_ds"], active: true },
    { noteId: "const_technical", title: "Constable Telecommunication Part B", category: "Constable Telecom", catLabel: "200+ MCQS", description: "Radio Communication, Television Transmission, Electronics, and Electricity", meta: ["200+ MCQs", "Complete Notes", "40 Marks"], tag: "hot", tagLabel: "New", origPrice: 199, price: 110, image: "https://blogger.googleusercontent.com/img/a/AVvXsEg6KScRqweKu7DLvJLsLoy9KOFYSGEllwKwMTMChseKvh8JogNYmwBrLkC38C0awxkdaz8qrdj3GxbpDykmYfckfqao_gtJBTUxucHF7s1hBSoGyHtxe9YdXPdziru-mxSfWxXj8Yb-hQl6NEdkKtjB72atDIE9eg6rs9nDBN6RBNSAiDTBd1iqT4BpfGc", fileId: "17DhfAx-smRsH2rqclcqcB54Qc5NqfS8_", isBundle: false, bundleNoteIds: [], active: true },
    { noteId: "microprocessorjkpsit", title: "Microprocessors & Microcontrollers", category: "jkpsi", catLabel: "Full Syllabus Covered", description: "8085/8086 architecture and instruction set basics, Addressing modes, interrupts and timing, 8051 microcontroller fundamentals, Introduction to ARM architecture, Memory interfacing (conceptual)", meta: ["Exam relevance", "Complete", "Memory"], tag: "hot", tagLabel: "Trending", origPrice: 129, price: 59, image: "https://blogger.googleusercontent.com/img/a/AVvXsEh6boBhpmH_BF2K94E4C5Gl_4LeYEnKKVe8p_yVhqZb5xAl6i-gQSDB7FZfzvgCoFA_eDrSlluR_neKjG4wKFe_-SJejL_M8AcJT4J3KS4KDfIIqiuhXY4VbmWQOvN_4XQDZ2upwiR5VsyibFoeNmJNZqjhKEszNi9lzF1pJt91ZMIu9h8g19KUvMSjQ7g", fileId: "1K_PWQ_w6bjuqxiytmJuOq4O4V_LvLBip", isBundle: false, bundleNoteIds: [], active: true },
    { noteId: "basic_numeracysit", title: "Basic Numeracy JKPsi Telecom", category: "jkpsi", catLabel: "250+ Questions to practice and solved", description: "Ratio and proportion, Percentages, Profit and loss, Simple and compound interest, Averages, Time, speed and distance, Elementary statistics and data interpretation", meta: ["200+ Mcqs", "Practice", "10 marks"], tag: "hot", tagLabel: "New", origPrice: 199, price: 129, image: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhyJ8ig3F0lKfcNe6HSYM4O5nc1JnD-akammslvqyWFQdgmFRMYwT3zMVoFUzm2Wy-4O9wlx6wUEjMDvdbb5-w_rx63lULFU6EYP74Or5v1yrv1CK4K32EZKB7zvmPQDRPHhG-qPk3SilBo34gALvBioVy6VhXqsCZfyuFHBc_ibGtChef9c6IoB1OOU-c/s320/ChatGPT%20Image%20Jun%2021,%202026,%2006_44_46%20PM.png", fileId: "1iMB8HghN9TLGHrD3nGDD8WQG0JqvlLb5", isBundle: false, bundleNoteIds: [], active: true },
    { noteId: "cs_networking", title: "Computer Science & Networking System", category: "jkpsi", catLabel: "Data Types, Wifi, Bluetooth, Routing", description: "OSI & TCP/IP models IP addressing, subnetting, CIDR RIP & OSPF basics Router, switch, hub Wi-Fi 802.11, Bluetooth, NFC Programming fundamentals Data structures & algorithms OS: process, memory, file systems", meta: ["CS", "Networking", "Programing - Data types"], tag: "hot", tagLabel: "New", origPrice: 149, price: 119, image: "https://blogger.googleusercontent.com/img/a/AVvXsEjiYqtZY5aUUv-QEm22RiHy72Zzzx8TfwQujhyAKgDxqUocCsEp1b6D4fWlAg89sTjHPnB8kPmPDpcmpDFkHYVtLkCw3G-jV0LClMtlaLSIBhb2WJyu1MJTPmMbNaRqNeg2cDMHBTqer29yc4if5sdqFbu_3N9VO8NEs3sgZO_ktMpIF_Y25yZbCqtiq5U", fileId: "1-qDQnrUBLNdfV39196GVDhs22mbRi3dw", isBundle: false, bundleNoteIds: [], active: true },
    { noteId: "itsys_egov", title: "IT Systems & e-Governance", category: "jkpsi", catLabel: "Web, Cloud, E-Gov", description: "Web application basics, Cloud computing fundamentals, Client–server architecture, Data centres & disaster recovery, Govt IT systems & APIs", meta: ["Web", "Egov", "CS Architecture"], tag: "hot", tagLabel: "New", origPrice: 149, price: 10, image: "https://blogger.googleusercontent.com/img/a/AVvXsEhr2GW-nL3ZcZqY-8LPUgPiSP0Lu6r4BB63KkbzjMbCrQUFurM-E7GT6059wNtvPWhVfZi1HrY6IzWPrwzlX_Gbc4pMwP6Gm2tVAqu3-VcDFpRnJCjhdHoACa9zwVzISMlnNww6eKCsiF5a98lWiB1CTrJDsFI13rZ60AODaSSryciKofJrf23FQItxjjI", fileId: "1N92t-amGkISfwt_bDwHZ3r7JMgl5ao62", isBundle: false, bundleNoteIds: [], active: true },
    { noteId: "jk_gk", title: "GK With Special Reference To UT", category: "jkpsi", catLabel: "Rivers, Soil, Flaura & Fauna, History", description: "A quick-reference guide for JKPSI Telecommunication aspirants covering J&K's geography (rivers, lakes), flora & fauna (protected areas, IUCN species), soils, climate, and history — from ancient dynasties to Article 370 abrogation", meta: ["Rivers", "Soil", "History - All dynasties"], tag: "hot", tagLabel: "Trending", origPrice: 149, price: 10, image: "https://blogger.googleusercontent.com/img/a/AVvXsEjAtQEvft_9YOWMs-l41v0Luc1n4URDdWtOGCpt7hvFyg7ORELkr08Fo8bNEMvqtaR3fgj22wn8v1H51ZKd0zHTltLbk8OgU8LkEUrWmdNzbVxI0w4fNTN3FYe62Jmzau3ZbmZ7vhpSLkaBi9keEU0Am0Z58KYwR-v9oTnRenHQfJCQneyVdhSLFSoJR4Y", fileId: "1oX8Hh-OaF4dEnIgHFIJt_JP68OvdcAae", isBundle: false, bundleNoteIds: [], active: true },
    { noteId: "communication_systems_jkpsi", title: "Communication Systems Comprehensive Handwritten", category: "jkpsi", catLabel: "Communication & JKPSI Telecom", description: "Analog & digital communication, modulation, SNR/BER, antennas, satellite, optical fibre, 2G–5G, multiple access — complete JKPSI Telecom notes.", meta: ["Communication Systems", "Analog & Digital Modulation", "70+ MCQs"], tag: "new", tagLabel: "Trending", origPrice: 199, price: 149, image: "https://blogger.googleusercontent.com/img/a/AVvXsEh_0rzpfCdbVIavSk1OR3Gf-4S2bcGCHXmYu29ZnAas_DyNja_qr859oJKXUb-uGiz5ndqmPFuiOsZvtFPAM4FkQuk3v8b3-yrOsEw1ElxSLahxa_QZskA_mI0CiBaNAPWjTYMAmkyd67ZFck5dRXKDlZjIEeYihYIUotL21DggN9zACPt6-pg0N91jauU", fileId: "1cM2l69lAaFQiPivq7hgJozS6ntjCz6gC", isBundle: false, bundleNoteIds: [], active: true },
    { noteId: "dbms_jkpsi", title: "Database Management Systems", category: "jkpsi", catLabel: "DBMS & JKPSI Telecom", description: "Database architecture, SQL, normalization, transactions, concurrency control — complete DBMS notes for JKPSI Telecom.", meta: ["DBMS", "SQL & Normalization", "MCQ Focus"], tag: "new", tagLabel: "New", origPrice: 199, price: 129, image: "https://blogger.googleusercontent.com/img/a/AVvXsEg8SVarZMjI1xkrbBsK-VohIbSIbzHUIHXs2RjtVjbW25yfES1k8dGZm7uF0zBgD1BJZAVTXPbsfFwQzk2jx5-6LSkFjxo7wZgtAaTaFwdMSsblkQCyFOsiwqqsjTBZviYBfAAMlBdg8vnhYg6PmY1LW6nZnGnGTOiD3oEQQeZwHfcgIzr6VCVIddTY5IA", fileId: "1Hz59zgOLzDRqkb8frZgyO83Wr837tv8N", isBundle: false, bundleNoteIds: [], active: true },
    { noteId: "iot_embedded", title: "IoT, Embedded Systems & Mechatronics", category: "jkpsc", catLabel: "IoT & Embedded & JKPSI Telecom", description: "IoT architecture, M2M, embedded & real-time systems, CCTV, ANPR, RFID, drones, robotics — Unit 14 JKPSI Telecom.", meta: ["Unit 14", "IoT & M2M", "MCQ Focus"], tag: "new", tagLabel: "New", origPrice: 199, price: 119, image: "https://blogger.googleusercontent.com/img/a/AVvXsEgxgbxo2BFeuWhQA_qNBp3YFDO4GfHfbM6REyitbTQQAzBy9NrCVaYp9mX6riRfdXMVOMABe6Y23A0-akD71xLh2iPwE7gmulLBf8q33T7I3_KVHk4NWstkioCybA06FVQ0UZiK-XRPGhIRnV_L2f57yCWNEeFTNQvlHZhCvGubzd1GGPizKZddi8mN1Q4", fileId: "1kzXLWqSVEPcgYAPsh2wdTb5sqPjmFLvc", isBundle: false, bundleNoteIds: [], active: true },
    { noteId: "ai_ds", title: "Artificial Intelligence & Data Science", category: "jkpsc", catLabel: "AI & Data Science & JKPSI Telecom", description: "Unit 15 — AI fundamentals, ML techniques, Big Data, e-Gov & ethical concerns. Complete final unit for JKPSI Telecom.", meta: ["Unit 15", "AI & ML", "MCQ Focus"], tag: "new", tagLabel: "New", origPrice: 189, price: 110, image: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj6utjnSHLKCzPjGNp665xIR6dEzSezHhQy3K9jR8FJfY7_IzpOfqrj7vhBlDpTxu2f46wk4a440tdeR60G2_HDwfM7gXYaw-d8sF0zmGq-I2XMBz7QATtDA-TEAq5oDB_celuM7ZzL_Imd6XlfJDMByS36PyFEwxMM_Z6qGbXcgPMMMy5KdoweUQ2usHY/s16000/jkedusphere_ai_ds_automation_frontpage.jpg", fileId: "10sIX0kIfmjRVlm4Y9fQBtYy1_eJM1vV1", isBundle: false, bundleNoteIds: [], active: true },
    { noteId: "cyber_security", title: "Cyber Security & IT Act", category: "jkssb jkpsc", catLabel: "Cyber Security & JKSSB / JKPSC", description: "Network security, cryptography, malware, cyber laws, IT Act 2000 & amendments, ethical hacking basics.", meta: ["50+ Pages", "Cryptography", "MCQ Focus"], tag: "new", tagLabel: "New", origPrice: 199, price: 139, image: "https://blogger.googleusercontent.com/img/a/AVvXsEixtHU5tX4BvktfJQGR_ZnyS3YghSdobRFqoq7bACpPJIX35LB9YfLzAIwKXPmCwxgKRLJJWGkLpHbzR4_MT7FxYvkmwQE9tXgHKhUMa6kHgWPY-5Yc5KWCcf5y9yTwXOHek6At0lBYY79Mkle8WPeAmIEb_E-_H82qdnCcSB5vCb8L7Z0a7HtkHYpTYAg", fileId: "1FAhqR7KFPjAMQgqgjTRmTGFafbEtWj0w", isBundle: false, bundleNoteIds: [], active: true },
    { noteId: "comm_systems", title: "Communication Systems Crux", category: "jkpsc", catLabel: "Telecom & JKPSI", description: "AM/FM/PM, PCM, digital modulation, error correction, antennas, satellite, 1G–5G & multiple access.", meta: ["28 Pages", "Formula Sheets", "MCQ Focus"], tag: "new", tagLabel: "New", origPrice: 200, price: 110, image: "https://blogger.googleusercontent.com/img/a/AVvXsEhNEi74c3Nh7Vn1JsdUXZk1aBImaa1jq_QVmWSYTf6MjMVeucY9-BT2fwGmzfEjnSF0GOowGSIFxvb8LcEaJVux480cSuxCzLendeKFB67zGme2BXClowmShF9fDjhVWYVw6U5FhD-k7XXoXqCGoi1nGDpZhWcoCSK1mzqUZ8x5mn5PbOe9eYiz-5_QWZI", fileId: "1QOpcDYpES9bxjVOa_0ETanDazid93K1z", isBundle: false, bundleNoteIds: [], active: true },
    { noteId: "jk_history", title: "History of Jammu & Kashmir", category: "jkssb jkpsc jk", catLabel: "J&K History · JKSSB / JKPSC", description: "Ancient kingdoms to Dogra rule, partition, accession & 2019 Reorganisation Act. Everything JKSSB & JKPSC asks.", meta: ["80+ Pages", "Maps Included", "PYQs"], tag: "hot", tagLabel: "Bestseller", origPrice: 199, price: 149, image: "https://blogger.googleusercontent.com/img/a/AVvXsEh6HD5jDwECD0YaVkf5Uohxi3NjENczCXWxXn_KEBjEQqywXa8_jJ4IAdq7o6YNT0jIKAxqnWZI-LlveaTiBLJ2paPCA4N1ikz_lLgbGoehFefC1mEiOufqoTpS4_cTcL9TFosaU7oCOXA3C36aw4H96uMC-d3B38EFGjhqcO16Q4P-ylLDddiJldhZYpA", fileId: "1cP_jq-34s4uDzdxT8RK8Kw7y4fbwvVik", isBundle: false, bundleNoteIds: [], active: true },
    { noteId: "ancient", title: "Ancient History of India", category: "upsc jkpsc", catLabel: "Ancient History · UPSC / JKPSC", description: "Indus Valley, Vedic Age, Maurya & Gupta Empires, Buddhism, Jainism — with timelines and MCQ-ready facts.", meta: ["90+ Pages", "Timelines", "MCQ Ready"], tag: "", tagLabel: "", origPrice: 199, price: 99, image: "https://blogger.googleusercontent.com/img/a/AVvXsEjTcQQNXBsgRNM4IZRSVlkE7D7_bQ8tk5hD5uxdGjO_uDyKGHaSPGDzgbRBXqtwlyzPon0lmdl1Jb0tcPNBERgujLX8jExZJcQ3mimvED8NLF1pWSvZYxUaxEqSDKk3HZNwljq55jF5ITMEBYfQ-wT-Z-38gWvLdMPfpUfXlR0KD4DZ3WKOZRHZoYIxpYo", fileId: "REPLACE_WITH_ANCIENT_FILE_ID", isBundle: false, bundleNoteIds: [], active: false },
    { noteId: "medieval", title: "Medieval History of India", category: "upsc jkpsc", catLabel: "Medieval History · UPSC / JKPSC", description: "Delhi Sultanate, Mughals, Vijayanagara, Bhakti & Sufi movements — crisp exam notes with key battles.", meta: ["85+ Pages", "Battles List", "MCQ Ready"], tag: "", tagLabel: "", origPrice: 199, price: 99, image: "https://blogger.googleusercontent.com/img/a/AVvXsEjMxbNqgtIxbVtMeTUU98-6pkmoAB5yE0MZx1IXIeUAVRFP1NqO9pNHz1XCZM_sU78j7JbXQdXnww-gcLrEuy552A7Iz6SqH1e067mnraGPn7q9XPuvWaU-qjgq5qsbLObxzeY-tqDVPlXmMgYX7IigbtAY3S4rz_A4FfIOrI1KVz_j3vCml74R09Nr0xE", fileId: "REPLACE_WITH_MEDIEVAL_FILE_ID", isBundle: false, bundleNoteIds: [], active: false },
    { noteId: "modern", title: "Modern Indian History", category: "upsc jkpsc jkssb", catLabel: "Modern History · UPSC / JKPSC / JKSSB", description: "British arrival, 1857, INC, Non-Cooperation, Quit India to Independence. Most-tested topic in all exams.", meta: ["100+ Pages", "Chronology", "PYQs"], tag: "ask", tagLabel: "Most Asked", origPrice: 249, price: 129, image: "https://blogger.googleusercontent.com/img/a/AVvXsEh0hAVKduUrKaVF6vdpBR0_KyULJNYpU1GmBpsSwEe8p4cUEQKCPbpV4ymrJo6R9zkPQkVBTKSTdd8YXhfWgIzzyli9kHC9uKuX7VHKl2yCJz4Vn0GQvhsSxoCEue8_mLNScNvLpNBFCxCzXvk3dWMPPJR6v4QT2CGuyQFridf9GtaqzksTjSDyvf1iAoc", fileId: "REPLACE_WITH_MODERN_FILE_ID", isBundle: false, bundleNoteIds: [], active: false },
    { noteId: "world", title: "World History", category: "upsc", catLabel: "World History · UPSC GS-I", description: "French Revolution, World Wars, Cold War, decolonisation — complete UPSC GS-I World History.", meta: ["75+ Pages", "Global Events", "GS-I Focused"], tag: "", tagLabel: "", origPrice: 199, price: 99, image: "https://blogger.googleusercontent.com/img/a/AVvXsEjshVJlENyhQqYfKOI86JpKgtgrrKoZuhf3gGobeLri7az7lOV3n-bHaEEy66oZhjQSp42zXDm9DlVegKXHIea2JbzZYjs6ptccIIDdnAFp9ZArDcKEFpXvQA6zXX3dsMUTuaGKgUID98le5WEsANYrbgHwdWqL_mIFE4bVnpjVK4DEVGsNeg8HIsRKxLI", fileId: "REPLACE_WITH_WORLD_FILE_ID", isBundle: false, bundleNoteIds: [], active: false },
    { noteId: "art_culture", title: "Indian Art & Culture", category: "upsc jkpsc", catLabel: "Art & Culture · UPSC / JKPSC", description: "Architecture, dance, painting, literature, music, UNESCO sites — complete Art & Culture for Prelims & Mains.", meta: ["70+ Pages", "Architecture", "Arts & Crafts"], tag: "", tagLabel: "", origPrice: 199, price: 99, image: "https://blogger.googleusercontent.com/img/a/AVvXsEi3WflZL9iLA4OhSRNWBObd7uCRxlrFHfecGPvwIxpEg5mH3dqyx0C7IvCVmWcl5IxNKr4jIx23EyeE8OMpnROoGjtsSS8cdIJu6OunbrkTd16uH6tALdFQpgGwZkJn35MkloBHa6I9Ubg-IXAj7WCL_k7XXoXqCGoi1nGDpZhWcoCSK1mzqUZ8x5mn5PbOe9eYiz-5_QWZI", fileId: "REPLACE_WITH_ART_FILE_ID", isBundle: false, bundleNoteIds: [], active: false }
  ];

  let count = 0;
  const results = [];
  for (const n of NOTES) {
    await Note.updateOne({ noteId: n.noteId }, n, { upsert: true });
    results.push(n.noteId + (n.active ? '' : ' (inactive - needs real file ID)'));
    count++;
  }

  return { success: true, imported: count, notes: results };
}

module.exports = { getAllNotes, getAllNotesAdmin, saveNote, deleteNote, verifyPurchase, redeemToken };
