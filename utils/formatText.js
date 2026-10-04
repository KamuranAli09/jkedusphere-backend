function autoFormatQuestionText(text) {
  if (!text) return text;
  let t = String(text);

  // "A. Dynasty - 1. Feature" style match-the-following pairs — run this
  // BEFORE the numbered-statement rule below, and exclude anything right
  // after a dash, so "A. Kushana - 1. Kanishka's..." stays on one line
  // as a single pair instead of being split mid-pair.
  t = t.replace(/\s+(?=[A-E]\.\s+[A-Z][a-zA-Z''\s]{0,40}?-\s*\d)/g, "\n");

  // Numbered statements: "1. ..." "2. ..." — skipped when immediately
  // preceded by a dash (that's a match-pair's right-hand side, handled above).
  t = t.replace(/(?<!-)\s+(?=\d{1,2}\.\s+[A-Z])/g, "\n");
  // Roman numeral statements: "I. ..." "II. ..."
  t = t.replace(/\s+(?=(I|II|III|IV|V|VI|VII|VIII)\.\s+[A-Z])/g, "\n");
  // "Statement I:" / "Statement 1:" style
  t = t.replace(/\s+(?=Statement\s+(I|II|III|IV|1|2|3|4)\s*[:.])/gi, "\n");
  // "S1:" / "S2:" / "S3:" style — your actual most-used statement format
  t = t.replace(/\s+(?=S\d{1,2}\s*[:.])/g, "\n");
  // Assertion/Reason
  t = t.replace(/\s+(?=Assertion\s*\(A\))/gi, "\n");
  t = t.replace(/\s+(?=Reason\s*\(R\))/gi, "\n");
  // List I / List II headers (match-the-following)
  t = t.replace(/\s+(?=List[\s-]*I{1,3}\b)/gi, "\n\n");
  t = t.replace(/\s+(?=Column[\s-]*[AB]\b)/gi, "\n\n");
  // Lowercase lettered/roman-numeral options: "(a) ..." "(iv) ..."
  t = t.replace(/\s+(?=\([a-d]\)\s*[A-Za-z])/g, "\n");
  t = t.replace(/\s+(?=\([ivx]+\)\s*[A-Za-z])/gi, "\n");
  // Common closing lines — including your actual "Which are correct?" phrasing
  t = t.replace(/\s+(?=Which of the (above|following))/gi, "\n\n");
  t = t.replace(/\s+(?=Which\s+(is|are)\s+correct)/gi, "\n\n");
  t = t.replace(/\s+(?=How many of the above)/gi, "\n\n");
  t = t.replace(/\s+(?=Select the correct)/gi, "\n\n");
  t = t.replace(/\s+(?=Choose the correct)/gi, "\n\n");

  // Cleanup: a trailing comma right before a line break (from the match-pair
  // splitting above) looks odd — drop it since the line break already
  // separates the items.
  t = t.replace(/,\s*\n/g, "\n");

  return t.trim();
}

module.exports = { autoFormatQuestionText };
