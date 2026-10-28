// S8B-01 CP2 — the TTS work list, its automated review and its interleaved order (the Product Owner's full Google Cloud
// evaluation order, 2026-10-28). Pure functions only: no network, no guard. Used by the Google Cloud run, its plan check
// (which refuses to start while the review finds a defect) and the root contract.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readingAnnotated, renderItem } from './cp2-providers.mjs';

/** Arabic letters without their diacritics (fathatan … sukun, superscript alef) and tatweel. */
export const stripDiacritics = (s) => s.replace(/[ً-ْٰـ]/gu, '');
const ARABIC = /[؀-ۿ]/u;
// Annotation marks a rater note could carry, and the inline-tag brackets the 3.8 TTS models read as non-speech sounds.
const ANNOTATION = /[()[\]{}<>=]|[ɐ-ʯ]/u;
const LATIN_WORD = /[A-Za-z]+/gu;

/** The corpora, read from the harness directory. */
export function loadCorpora(here) {
  const set = JSON.parse(readFileSync(join(here, 'corpus', 'tts-pronunciation-set.json'), 'utf8'));
  const expression = JSON.parse(readFileSync(join(here, 'corpus', 'tts-expression-set.json'), 'utf8'));
  const setItems = [...set.homographs, ...set.names, ...set.numbers, ...set.dialect_sentences, ...set.code_switch, ...set.replies];
  return { set, expression, setItems };
}

const categoryOf = (id) => ({ H: 'HOMOGRAPH', N: 'NAME', D: 'NUMBER', E: 'DIALECT', G: 'DIALECT', L: 'DIALECT', M: 'DIALECT', C: 'CODE_SWITCH', R: 'REPLY', X: 'EMOTION' }[id[0]]);

/**
 * The work list, one entry per (item, arm), before models and voices:
 *   SET: every pronunciation-set item as BASELINE, and as RENDERED where the rendering changes the text;
 *   EXPRESSION: each expression item as NO_STYLE, PERSONA and EMOTION, and the six replies as PERSONA only: their no-style
 *   rendition is their SET BASELINE, and their EMOTION style is the PERSONA style (tts-expression-set.json also_note), so
 *   neither identical request is sent twice.
 */
export function buildWork({ expression, setItems }) {
  const work = [];
  for (const item of setItems) {
    const base = { item: item.id, category: categoryOf(item.id), dialect: item.dialect, group: 'SET', style: null };
    work.push({ ...base, arm: 'BASELINE', text: item.text });
    const rendered = renderItem(item);
    if (rendered !== item.text) work.push({ ...base, arm: 'RENDERED', text: rendered });
  }
  const replies = new Map(setItems.filter((i) => i.id.startsWith('R')).map((i) => [i.id, i]));
  for (const x of [...expression.items, ...expression.also_from_tts_set.map((id) => replies.get(id))]) {
    const base = { item: x.id, category: categoryOf(x.id), dialect: x.dialect, group: 'EXPRESSION', emotion: x.emotion ?? 'REPLY', text: x.text };
    // A reply's no-style rendition is its SET BASELINE (the same request): it is not sent twice.
    if (!replies.has(x.id)) work.push({ ...base, arm: 'NO_STYLE', style: null });
    work.push({ ...base, arm: 'PERSONA', style: expression.persona_style });
    if (x.style) work.push({ ...base, arm: 'EMOTION', style: x.style });
  }
  return work;
}

/**
 * The automated review of the work list. Returns the defects (empty = the set may be sent):
 *   - every text is Arabic speech, non-empty, with no annotation mark, no inline-tag bracket, and no Latin word its item's
 *     own text does not already carry (code-switch words stay; a rater gloss, an IPA or a Latin reading never reaches it);
 *   - RENDERED keeps the item's words and meaning: a homograph or a name differs from BASELINE only by diacritics on its
 *     target, which occurs once as a whole word; a number changes only its span, which becomes words (no digit left);
 *   - a style travels only in speechMetadata: PERSONA / EMOTION carry a short English style that is not in the text;
 *     BASELINE, RENDERED and NO_STYLE carry none; an expression item's text is the same in its three variants;
 *   - every (item, arm) is unique, and no two entries are the same request (text and style).
 */
export function reviewWork(work, setItems) {
  const defects = [];
  const items = new Map(setItems.map((i) => [i.id, i]));
  const seen = new Set();
  const bad = (w, why) => defects.push(`${w.item} ${w.arm}: ${why}`);
  for (const w of work) {
    const key = `${w.item}|${w.arm}`;
    if (seen.has(key)) bad(w, 'duplicate');
    seen.add(key);
    const original = items.get(w.item)?.text ?? w.text;
    if (!w.text || w.text !== w.text.trim() || !ARABIC.test(w.text)) bad(w, 'empty, untrimmed or not Arabic');
    if (ANNOTATION.test(w.text)) bad(w, 'an annotation mark or an inline-tag bracket in the speech text');
    for (const word of w.text.match(LATIN_WORD) ?? []) if (!original.includes(word)) bad(w, `a Latin word not in the item's text: ${word}`);
    if (['PERSONA', 'EMOTION'].includes(w.arm)) {
      if (!w.style || ARABIC.test(w.style) || w.style.length > 80 || w.text.includes(w.style)) bad(w, 'the style must be a short English speechMetadata style');
    } else if (w.style) bad(w, 'no style on this arm');
    if (w.arm === 'RENDERED') {
      const item = items.get(w.item);
      if (w.text === item.text) bad(w, 'RENDERED equals BASELINE');
      if (item.target) {
        // The target occurs once, as a word or after a one-letter proclitic (و ب ل ف ك ع: «وضحى», «عحلب»).
        const occurrences = item.text.split(item.target).length - 1;
        const asWord = new RegExp(`(?:^|[\\s.,!?؟،؛:])[وبلفكع]?${item.target}(?=$|[\\s.,!?؟،؛:])`, 'u').test(item.text);
        if (occurrences !== 1 || !asWord) bad(w, 'the target is not one whole word of the text');
        // Only diacritics change: both sides are compared without them (the item's own tanween, «متأخرًا», stays as written).
        if (stripDiacritics(w.text) !== stripDiacritics(item.text)) bad(w, 'RENDERED changes more than diacritics on its target');
        const changed = [...w.text].length - [...item.text].length;
        if (changed <= 0) bad(w, 'RENDERED adds no diacritic');
        if (readingAnnotated(item.expected) && stripDiacritics(item.expected.replace(/\s*\([^)]*\)/gu, '').trim()) !== item.target) bad(w, 'an annotated reading whose letters are not the target');
      } else {
        const a = item.text.search(/[0-9٠-٩]/u);
        if (a < 0 || /[0-9٠-٩]/u.test(w.text) || !w.text.startsWith(item.text.slice(0, a))) bad(w, 'a number rendering must replace only its digit span with words');
      }
    }
  }
  const requests = new Map();
  for (const x of work) {
    const k = JSON.stringify([x.text, x.style]);
    if (requests.has(k)) defects.push(`${x.item} ${x.arm}: the same request as ${requests.get(k)}`);
    else requests.set(k, `${x.item} ${x.arm}`);
  }
  const byItem = new Map();
  for (const w of work.filter((x) => x.group === 'EXPRESSION')) (byItem.get(w.item) ?? byItem.set(w.item, new Set()).get(w.item)).add(w.text);
  for (const [id, texts] of byItem) if (texts.size !== 1) defects.push(`${id}: the expression variants differ in text`);
  return defects;
}

/**
 * The run order. Each (item, arm) becomes one call per model and voice. Calls are interleaved so that a stop at any point
 * leaves a balanced partial coverage: categories in round robin (homographs, names, numbers, dialects, code switch,
 * replies, emotions …), and for each entry the four model × voice combinations next to each other. The two models
 * strictly alternate across the whole run (m0, m1, m0, m1 …), so each model's own pacing interval runs while the other
 * model is called; the voice of each model's first call alternates from one entry to the next.
 */
export function interleave(work, models, voices) {
  const queues = new Map();
  for (const w of work) (queues.get(w.category) ?? queues.set(w.category, []).get(w.category)).push(w);
  const ordered = [];
  for (let i = 0; ordered.length < work.length; i += 1) for (const q of queues.values()) if (q[i]) ordered.push(q[i]);
  if (models.length !== 2 || voices.length !== 2) throw new Error('S8B_01_CLOUD: the alternating order needs exactly two models and two voices');
  const [m0, m1] = models;
  const [v0, v1] = voices;
  return ordered.flatMap((w, i) => {
    const [a, b] = i % 2 === 0 ? [v0, v1] : [v1, v0];
    return [[m0, a], [m1, b], [m0, b], [m1, a]].map(([model, voice]) => ({ ...w, model, voice }));
  });
}

/** Counts by a key, for the plan check and the report. */
export function countBy(rows, key) {
  const out = {};
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + 1;
  return out;
}
