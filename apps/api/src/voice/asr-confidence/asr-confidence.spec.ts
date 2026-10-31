import type { RecognizedWord } from '../batch-transcription-jobs.port';
import { asrBandThresholds, classifyVoiceNote, DEFAULT_ASR_BAND_THRESHOLDS, MAX_UNCERTAIN_TOKENS } from './asr-confidence';
import { isHighImpactWord } from './high-impact-words';

/** S8B-03 (CP1, A23) — the band on synthetic json-v2-shaped words. No recording and no provider are involved. */
const words = (...items: [string, number | null, number?][]): RecognizedWord[] => {
  let at = 0;
  return items.map(([text, confidence, ms = 400]) => {
    const word = { text, confidence, startMs: at, endMs: at + ms };
    at += ms + 50;
    return word;
  });
};
const band = (w: RecognizedWord[]) => {
  const result = classifyVoiceNote(w);
  return result.kind === 'TRANSCRIBED' ? result.band : result.kind;
};

describe('classifyVoiceNote', () => {
  it('no words → NO_SPEECH', () => {
    expect(classifyVoiceNote([])).toEqual({ kind: 'NO_SPEECH' });
    expect(classifyVoiceNote(words(['  ', 0.9]))).toEqual({ kind: 'NO_SPEECH' });
  });

  it('the duration-weighted mean decides HIGH / MEDIUM / LOW at 0.85 / 0.65', () => {
    expect(band(words(['أنا', 0.95], ['بشتغل', 0.9], ['مهندس', 0.88]))).toBe('HIGH');
    expect(band(words(['أنا', 0.9], ['بشتغل', 0.7], ['مهندس', 0.7]))).toBe('MEDIUM');
    expect(band(words(['أنا', 0.6], ['بشتغل', 0.6], ['مهندس', 0.6]))).toBe('LOW');
    // A long confident word outweighs a short unsure one.
    expect(band(words(['القاهرة', 0.95, 2000], ['يا', 0.5, 100]))).toBe('HIGH');
  });

  it('a missing or out-of-range confidence → LOW', () => {
    expect(band(words(['أنا', 0.99], ['هنا', null]))).toBe('LOW');
    expect(band(words(['أنا', 0.99], ['هنا', 1.2]))).toBe('LOW');
    expect(band(words(['أنا', 0.99], ['هنا', Number.NaN]))).toBe('LOW');
  });

  it.each([
    ['negation «مش»', 'مش'], ['negation «ما»', 'ما'], ['English negation', "don't"], ['the Egyptian «م…ش» pattern', 'مبحبش'],
    ['change / time', 'كنت'], ['«خلاص»', 'خلاص'], ['a Memory verb', 'انسى'], ['«امسح»', 'امسح'], ['an English Memory verb', 'forget'],
    ['a Latin digit', '2024'], ['an Arabic-Indic digit', '٣'], ['a number word', 'تلاتة'], ['a month', 'مارس'], ['a day', 'الخميس'], ['an English month', 'March'],
  ])('a high-impact word heard below 0.85 → LOW whatever the mean: %s', (_name, word) => {
    expect(band(words(['أنا', 0.99, 1500], ['بحب', 0.99, 1500], [word, 0.8, 200], ['القهوة', 0.99, 1500]))).toBe('LOW');
    // The same word heard confidently does not lower the band.
    expect(band(words(['أنا', 0.99, 1500], ['بحب', 0.99, 1500], [word, 0.9, 200], ['القهوة', 0.99, 1500]))).not.toBe('LOW');
  });

  it('K5: a Latin word in a mostly Arabic note, and an Arabic word in a mostly English note', () => {
    expect(band(words(['أنا', 0.99], ['بشتغل', 0.99], ['في', 0.99], ['Google', 0.8]))).toBe('LOW');
    expect(band(words(['I', 0.99], ['work', 0.99], ['in', 0.99], ['القاهرة', 0.8]))).toBe('LOW');
  });

  it('normalization: harakat, tatweel and alef forms do not hide a listed word', () => {
    expect(isHighImpactWord('لَيْسَ', true)).toBe(true);
    expect(isHighImpactWord('خــلاص', true)).toBe(true);
    expect(isHighImpactWord('ابريل', true)).toBe(true);
    expect(isHighImpactWord('NOT', false)).toBe(true);
    expect(isHighImpactWord('القهوة', true)).toBe(false);
  });

  it('the uncertain tokens: every word below 0.85, normalized, unique, at most 64', () => {
    const result = classifyVoiceNote(words(['أَحمد', 0.6], ['احمد', 0.5], ['أخويا', 0.99], ['سارة', 0.7]));
    // Names are not a high-impact class (a declared limit): the band follows the mean, and the tokens guard person labels (E11).
    expect(result).toMatchObject({ kind: 'TRANSCRIBED', band: 'MEDIUM', uncertainTokens: ['احمد', 'ساره'] });
    const many = classifyVoiceNote(Array.from({ length: 100 }, (_, i) => ({ text: `w${i}`, confidence: 0.5, startMs: i * 10, endMs: i * 10 + 5 })));
    expect(many.kind === 'TRANSCRIBED' && many.uncertainTokens.length).toBe(MAX_UNCERTAIN_TOKENS);
  });

  it('the text joins the words as heard; more than 20000 characters is TOO_LONG', () => {
    expect(classifyVoiceNote(words(['أنا', 0.99], ['هنا', 0.99]))).toMatchObject({ text: 'أنا هنا' });
    expect(classifyVoiceNote(Array.from({ length: 3000 }, (_, i) => ({ text: 'كلمةطويلة', confidence: 0.99, startMs: i, endMs: i + 1 })))).toEqual({ kind: 'TOO_LONG' });
  });
});

describe('asrBandThresholds (startup bounds)', () => {
  it('defaults to the approved 0.85 / 0.65', () => {
    expect(asrBandThresholds()).toEqual(DEFAULT_ASR_BAND_THRESHOLDS);
    expect(asrBandThresholds('', ' ')).toEqual({ high: 0.85, medium: 0.65 });
  });
  it('accepts values inside T_HIGH ∈ [0.70, 0.99], T_MEDIUM ∈ [0.40, T_HIGH)', () => {
    expect(asrBandThresholds('0.7', '0.4')).toEqual({ high: 0.7, medium: 0.4 });
    expect(asrBandThresholds('0.99', '0.98')).toEqual({ high: 0.99, medium: 0.98 });
  });
  it.each([['0.69', '0.5'], ['1', '0.5'], ['0.9', '0.39'], ['0.8', '0.8'], ['0.8', '0.9'], ['x', '0.5']])('refuses to start at high=%s medium=%s', (high, medium) => {
    expect(() => asrBandThresholds(high, medium)).toThrow();
  });
});
