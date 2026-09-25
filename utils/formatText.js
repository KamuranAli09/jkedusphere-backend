function autoFormatQuestionText(text) {
  if (!text) return text;
  let t = String(text);

  t = t.replace(/\s+(?=\d{1,2}\.\s+[A-Z])/g, "\n");
  t = t.replace(/\s+(?=(I|II|III|IV|V|VI|VII|VIII)\.\s+[A-Z])/g, "\n");
  t = t.replace(/\s+(?=Statement\s+(I|II|III|IV|1|2|3|4)\s*[:.])/gi, "\n");
  t = t.replace(/\s+(?=Assertion\s*\(A\))/gi, "\n");
  t = t.replace(/\s+(?=Reason\s*\(R\))/gi, "\n");
  t = t.replace(/\s+(?=List[\s-]*I{1,3}\b)/gi, "\n\n");
  t = t.replace(/\s+(?=Column[\s-]*[AB]\b)/gi, "\n\n");
  t = t.replace(/\s+(?=\([a-d]\)\s*[A-Za-z])/g, "\n");
  t = t.replace(/\s+(?=\([ivx]+\)\s*[A-Za-z])/gi, "\n");
  t = t.replace(/\s+(?=Which of the (above|following))/gi, "\n\n");
  t = t.replace(/\s+(?=How many of the above)/gi, "\n\n");
  t = t.replace(/\s+(?=Select the correct)/gi, "\n\n");
  t = t.replace(/\s+(?=Choose the correct)/gi, "\n\n");

  return t.trim();
}

module.exports = { autoFormatQuestionText };