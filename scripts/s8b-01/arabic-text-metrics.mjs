// S8B-01 — Arabic transcript metrics for the ASR benchmark (operator tooling; never a CI step's runtime; never imported
// by production code).
//
// The preregistered normalization (bench-plan.json `asr.normalization`) is applied identically to the reference and the
// hypothesis BEFORE scoring, so a provider is not penalised for orthographic choices that do not change what was said:
// diacritics, tatweel, alef / hamza seats, alef maqsura, ta marbuta, Arabic-Indic digits and punctuation. It is a scoring
// normalization only: nothing here is used to rewrite a transcript a user sees (Voice Runtime Contract §4.2).

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/gu;
const TATWEEL = /ـ/gu;
const PUNCTUATION = /[\p{P}\p{S}]/gu;
const ARABIC_INDIC = /[٠-٩]/gu;
const EXTENDED_INDIC = /[۰-۹]/gu;

/** The preregistered scoring normalization. Every flag defaults to the plan's value (all on). */
export function normalizeArabic(text, options = {}) {
  const o = { diacritics: true, tatweel: true, alef: true, alefMaqsura: true, taMarbuta: true, digits: true, punctuation: true, ...options };
  let t = String(text).normalize('NFC');
  if (o.diacritics) t = t.replace(DIACRITICS, '');
  if (o.tatweel) t = t.replace(TATWEEL, '');
  if (o.alef) t = t.replace(/[آأإٱ]/gu, 'ا');
  if (o.alefMaqsura) t = t.replace(/ى/gu, 'ي');
  if (o.taMarbuta) t = t.replace(/ة/gu, 'ه');
  if (o.digits) {
    t = t.replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660));
    t = t.replace(EXTENDED_INDIC, (d) => String(d.charCodeAt(0) - 0x06F0));
  }
  if (o.punctuation) t = t.replace(PUNCTUATION, ' ');
  return t.toLowerCase().replace(/\s+/gu, ' ').trim();
}

/** Levenshtein distance over two sequences (words or characters). */
export function editDistance(a, b) {
  const n = a.length; const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  let previous = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i += 1) {
    const current = [i];
    for (let j = 1; j <= m; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[m];
}

const words = (text) => (text === '' ? [] : text.split(' '));

/** Word and character error rate of one hypothesis against one reference, after normalization. */
export function errorRates(reference, hypothesis, options) {
  const ref = normalizeArabic(reference, options);
  const hyp = normalizeArabic(hypothesis, options);
  const refWords = words(ref);
  const refChars = [...ref.replace(/ /gu, '')];
  return {
    referenceWords: refWords.length,
    wordErrors: editDistance(refWords, words(hyp)),
    referenceChars: refChars.length,
    charErrors: editDistance(refChars, [...hyp.replace(/ /gu, '')]),
  };
}

/** Corpus-level WER / CER: total errors over total reference length (not a mean of per-utterance rates). */
export function corpusRates(pairs, options) {
  let rw = 0; let we = 0; let rc = 0; let ce = 0;
  for (const { reference, hypothesis } of pairs) {
    const r = errorRates(reference, hypothesis, options);
    rw += r.referenceWords; we += r.wordErrors; rc += r.referenceChars; ce += r.charErrors;
  }
  return { utterances: pairs.length, wer: rw === 0 ? 0 : we / rw, cer: rc === 0 ? 0 : ce / rc };
}
