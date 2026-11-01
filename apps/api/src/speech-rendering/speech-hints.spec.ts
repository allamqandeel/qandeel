import { L0_CASES } from './testing/l0-regression.fixture';
import { arabicWords, canonicalDiacritized, hasDiacritics } from './arabic-text';
import {
  DEFAULT_READINGS, fromStoredHints, MAX_HINTS_PER_REPLY, toStoredHints, validateSpeechHints,
} from './speech-hints';

/** S8B-04 CP1, contract v1.2 §6.3 B / C, §6.10 SR-D1. */

describe('S8B-04 hint validator (B)', () => {
  const text = 'طبخت الأرز في القدر الكبير. وبعدين رحنا لأسوان مع هدير.';
  const end1 = text.indexOf('.') + 1;

  it('keeps a hint whose letters are exactly one undiacritized word of its sentence', () => {
    const r = validateSpeechHints(text, [{ word: 'القِدْر', at: end1 }], 'B_ALL');
    expect(r.hints).toEqual([{ start: text.indexOf('القدر'), end: text.indexOf('القدر') + 5, spoken: 'القِدْر' }]);
  });

  it('drops (and counts) every invalid hint, never touching the text', () => {
    const cases: Array<[string, number, string]> = [
      ['القدر', end1, 'FORMAT'],
      ['qidr', end1, 'FORMAT'],
      ['القِدْر|الأَرُز|الكَبِير', end1, 'FORMAT'],
      ['البَيْت', end1, 'NO_MATCH'],
      ['القِدْر', text.length, 'NO_MATCH'],
      ['أَسْوان', text.length, 'NO_MATCH'],
      ['هَدِير', text.length, 'NAME'],
    ];
    for (const [word, at, reason] of cases) {
      expect(validateSpeechHints(text, [{ word, at }], 'B_ALL')).toEqual({ hints: [], dropped: { [reason]: 1 } });
    }
  });

  it('drops a hint on a word written twice in the sentence, or already vocalized', () => {
    const t = 'الحب يغلب الحب.';
    expect(validateSpeechHints(t, [{ word: 'الحُبّ', at: t.length }], 'B_ALL').dropped).toEqual({ AMBIGUOUS: 1 });
    expect(validateSpeechHints('القِدر كبير.', [{ word: 'القِدْر', at: 12 }], 'B_ALL').dropped).toEqual({ ALREADY_DIACRITIZED: 1 });
  });

  it('enforces 2 per sentence and 4 per reply, in order', () => {
    const t = 'ملك قدر عقد. علم حب شعر. دين بر.';
    const s1 = t.indexOf('.') + 1;
    const s2 = t.indexOf('.', s1) + 1;
    const s3 = t.length;
    const r = validateSpeechHints(t, [
      { word: 'مِلْك|قِدْر', at: s1 }, { word: 'عِقْد', at: s1 },
      { word: 'عِلْم|حُبّ', at: s2 }, { word: 'دَيْن', at: s3 },
    ], 'B_ALL');
    expect(r.hints.map((h) => h.spoken)).toEqual(['مِلْك', 'قِدْر', 'عِلْم', 'حُبّ']);
    expect(r.dropped).toEqual({ SENTENCE_LIMIT: 1, REPLY_LIMIT: 1 });
    expect(MAX_HINTS_PER_REPLY).toBe(4);
  });

  it('OFF yields nothing; B_FILTERED drops recorded default readings', () => {
    expect(validateSpeechHints(text, [{ word: 'القِدْر', at: end1 }], 'OFF')).toEqual({ hints: [], dropped: {} });
    const t = 'استقبل الملك الوفد.';
    expect(validateSpeechHints(t, [{ word: 'المَلِك', at: t.length }], 'B_FILTERED').dropped).toEqual({ DEFAULT_READING: 1 });
    expect(validateSpeechHints(t, [{ word: 'المَلِك', at: t.length }], 'B_ALL').hints).toHaveLength(1);
  });

  it('DEFAULT_READINGS holds every homograph reading Gemini read correctly without diacritics in L-0', () => {
    const fromL0 = L0_CASES
      .filter((c) => c.group.startsWith('HOMOGRAPH') && c.baseline.verdict === 'CORRECT' && c.rendered)
      .map((c) => arabicWords(c.rendered!.text).find((w) => hasDiacritics(w.text))!.text);
    for (const r of fromL0) expect(DEFAULT_READINGS.has(canonicalDiacritized(r))).toBe(true);
    for (const id of ['H07', 'H10', 'H13', 'H29']) {
      const c = L0_CASES.find((x) => x.caseId === id)!;
      const r = arabicWords(c.rendered!.text).find((w) => hasDiacritics(w.text))!.text;
      expect(DEFAULT_READINGS.has(canonicalDiacritized(r))).toBe(false);
    }
  });

  it('stored hints round-trip and are re-validated against the visible text', () => {
    const r = validateSpeechHints(text, [{ word: 'القِدْر', at: end1 }], 'B_ALL');
    const stored = toStoredHints(r.hints);
    expect(stored).toEqual([{ offset: text.indexOf('القدر'), word: 'القِدْر' }]);
    expect(fromStoredHints(text, stored)).toEqual(r.hints);
    expect(fromStoredHints(`x${text}`, stored)).toEqual([]);
    expect(fromStoredHints(text, [{ offset: text.indexOf('هدير'), word: 'هَدِير' }])).toEqual([]);
  });
});
