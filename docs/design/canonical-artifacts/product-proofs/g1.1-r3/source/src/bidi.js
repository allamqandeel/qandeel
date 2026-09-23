/* G1.1-A1 — the paragraph direction of one conversation turn. Plain script: build.mjs inlines this same
 * text into the prototype (the live send path) and evaluates it in Node (the fixture turns), so there is
 * one implementation, not two that can drift.
 *
 * Why not `dir="auto"`: HTML's auto direction is FIRST-STRONG. A reader in Cairo routinely opens an
 * Arabic sentence with an English work word — «Q3 numbers لسه ما وصلتش» — and first-strong then lays
 * the whole Arabic sentence out left-to-right: the full stop lands at the wrong end and the sentence
 * aligns to the wrong edge. The paragraph's direction is decided here by which script carries the
 * sentence: WORDS whose first strong letter is Arabic-script against words whose first strong letter is
 * Latin. A word like «الـclient» counts as Arabic (it begins with the Arabic article). A tie, or a turn
 * with no letters at all (a number, a time), takes the reader's UI direction.
 */
function paragraphDir(text, fallback) {
  var rtl = 0, ltr = 0, words = String(text).split(/\s+/);
  for (var w = 0; w < words.length; w++) {
    var s = words[w];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if ((c >= 0x0590 && c <= 0x08FF) || (c >= 0xFB1D && c <= 0xFDFF) || (c >= 0xFE70 && c <= 0xFEFF)) { rtl++; break; }
      if ((c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A) || (c >= 0xC0 && c <= 0x24F)) { ltr++; break; }
    }
  }
  if (rtl === ltr) return fallback;
  return rtl > ltr ? 'rtl' : 'ltr';
}
