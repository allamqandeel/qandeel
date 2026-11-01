import {
  assertNoSpeechMarkup, SpeechMarkupLeakError, SpeechMarkupStream, stripSpeechMarkup, type SpeechMarkupResult,
} from './speech-markup';
import { arabicWords } from './arabic-text';

/** S8B-04 CP1, contract v1.2 §7.4 as narrowed by the Product Owner's CP1 brief item C (fail closed). */

const strip = (raw: string, safetyGuided = false): SpeechMarkupResult => stripSpeechMarkup(raw, { safetyGuided });
const ok = (raw: string, safetyGuided = false) => {
  const r = strip(raw, safetyGuided);
  if (r.kind !== 'OK') throw new Error(`expected OK, got ${r.reason}`);
  return r;
};

/** A small deterministic PRNG so the property runs are reproducible. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const CLEAN_TEXTS = [
  'طبخت الأرز في القدر الكبير. وبعدين أكلنا سوا.',
  'هذا البيت ملك أبي منذ زمن، وما زال كما هو.',
  'تمام، فاهمك. خذ وقتك وقل لي لما تكون جاهز.',
  'Sounds good — tell me when you are ready.',
  'شوف [[wiki]] دي، وكمان القوسين ]] لوحدهم عادي.',
  'سطر أول\nسطر ثاني\n\nفقرة بعد سطر فارغ.',
  'كتبت لي: «[[ say:test]]» وده مش علامة.',
  'A list:\n- first\n- second',
  'عمري تلاتين سنة ولسه بتعلم!',
  'هل تقصد 7:30 أم 8:00؟ قول لي.',
];

describe('S8B-04 speech markup — goldens (G)', () => {
  it('reads the delivery line and removes it with its line break', () => {
    const r = ok('[[speech:PLAYFUL]]\nيا سلام عليك!');
    expect(r.text).toBe('يا سلام عليك!');
    expect(r.expression).toBe('PLAYFUL');
    expect(r.counts.deliveryLine).toBe(true);
  });

  it('accepts the delivery line followed by a space or the end', () => {
    expect(ok('[[speech:JOY]] مبروك!').text).toBe('مبروك!');
    expect(ok('[[speech:JOY]]').text).toBe('');
  });

  it('defaults to CALM without a delivery line', () => {
    const r = ok('أهلًا، عامل إيه؟');
    expect(r.expression).toBe('CALM');
    expect(r.text).toBe('أهلًا، عامل إيه؟');
    expect(r.counts.markers).toBe(0);
  });

  it('removes a hint marker after a sentence with one horizontal space, and keeps the hint candidate', () => {
    const r = ok('[[speech:CALM]]\nطبخت الأرز في القدر الكبير. [[say:القِدْر]] وبعدين أكلنا.');
    expect(r.text).toBe('طبخت الأرز في القدر الكبير. وبعدين أكلنا.');
    expect(r.hints).toEqual([{ word: 'القِدْر', at: 'طبخت الأرز في القدر الكبير.'.length }]);
  });

  it('removes a marker alone on its line with its line break', () => {
    expect(ok('السطر الأول.\n[[say:مِلْك]]\nالسطر الثاني.').text).toBe('السطر الأول.\nالسطر الثاني.');
    expect(ok('السطر الأول.\n[[say:مِلْك]]').text).toBe('السطر الأول.');
  });

  it('removes two consecutive markers', () => {
    const r = ok('هذا البيت ملك أبي. [[say:مِلْك]] [[say:أَبِي]] تمام.');
    expect(r.text).toBe('هذا البيت ملك أبي. تمام.');
    expect(r.hints.map((h) => h.word)).toEqual(['مِلْك', 'أَبِي']);
  });

  it('never touches [[wiki]], a lone ]], a spaced or capitalized opener', () => {
    for (const t of ['شوف [[wiki]] كده.', 'قوسين ]] بس.', 'نص [[ say:x]] هنا.', 'نص [[Say:x]] هنا.', 'نص [[SPEECH:CALM]] هنا.']) {
      expect(ok(t).text).toBe(t);
    }
  });

  it('removes a misplaced or unknown-valued delivery marker and falls back to CALM', () => {
    const r = ok('[[speech:JOY]]\nمبروك! [[speech:PLAYFUL]] يا بطل.');
    expect(r.text).toBe('مبروك! يا بطل.');
    expect(r.expression).toBe('CALM');
    expect(r.counts.misplacedDelivery).toBe(1);
    const u = ok('[[speech:ANGRY]]\nتمام.');
    expect(u.text).toBe('تمام.');
    expect(u.expression).toBe('CALM');
    expect(u.counts.unknownDelivery).toBe(1);
  });

  it('removes a stream cut inside a final hint marker (the one certain unclosed case), without a hint', () => {
    const r = ok('طبخت الأرز في القدر الكبير. [[say:القِدْر');
    expect(r.text).toBe('طبخت الأرز في القدر الكبير.');
    expect(r.hints).toEqual([]);
    expect(r.counts.truncatedTail).toBe(1);
  });

  it('fails closed on an unclosed opener before a real sentence', () => {
    expect(strip('[[say: وبعدين رحنا البيت.')).toEqual({ kind: 'MALFORMED', reason: 'UNCLOSED_MARKER' });
    expect(strip('تمام [[say:القِدْر وبعدين رحنا.')).toEqual({ kind: 'MALFORMED', reason: 'UNCLOSED_MARKER' });
    expect(strip('[[speech:CALM\nتمام.')).toEqual({ kind: 'MALFORMED', reason: 'UNCLOSED_MARKER' });
  });

  it('fails closed on a marker inside a word', () => {
    expect(strip('الق[[say:القِدْر]]در')).toEqual({ kind: 'MALFORMED', reason: 'MARKER_INSIDE_WORD' });
  });

  it('fails closed on nested or malformed content (format AND content are checked, CP1 brief C1)', () => {
    for (const t of [
      '[[say:[[say:القِدْر]]]] تمام.',
      'تمام. [[say:two words]]',
      '[[speech:calm]]\nتمام.',
      'تمام. [[speech:]]',
      'تمام. [[say:]]',
      `تمام. [[say:${'ب'.repeat(61)}]]`,
    ]) {
      expect(strip(t).kind).toBe('MALFORMED');
    }
  });

  it('applies the Safety constraint: GUIDED never yields PLAYFUL or JOY (AC-06)', () => {
    expect(ok('[[speech:PLAYFUL]]\nتمام.', true).expression).toBe('CALM');
    expect(ok('[[speech:JOY]]\nتمام.', true).expression).toBe('CALM');
    expect(ok('[[speech:EMPATHY]]\nتمام.', true).expression).toBe('EMPATHY');
  });

  it('keeps every marker under the guidance-echo guard length (48)', () => {
    expect('[[speech:SURPRISE]]'.length).toBeLessThan(48);
    expect('[[say:القِدْر|عُمْري]]'.length).toBeLessThan(48);
  });

  it('the tripwire removes nothing and fires on any opener', () => {
    expect(() => assertNoSpeechMarkup('نص [[wiki]] عادي')).not.toThrow();
    expect(() => assertNoSpeechMarkup('نص [[say:x')).toThrow(SpeechMarkupLeakError);
    expect(() => assertNoSpeechMarkup('[[speech:CALM]]')).toThrow(SpeechMarkupLeakError);
  });
});

const HINTS = ['القِدْر', 'مِلْك', 'العِقْد', 'عُمْري'];

/** Inserts valid markers only at allowed places: the delivery line first, hints after a sentence end. */
function insertValid(text: string, rand: () => number): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    out += text[i];
    const sentenceEnd = /[.!?؟]/u.test(text[i]) && (text[i + 1] === undefined || text[i + 1] === ' ' || text[i + 1] === '\n');
    if (sentenceEnd && rand() < 0.6) out += ` [[say:${HINTS[Math.floor(rand() * HINTS.length)]}]]`;
  }
  const lead = rand();
  if (lead < 0.4) return `[[speech:CALM]]\n${out}`;
  if (lead < 0.6) return `[[speech:SERIOUS]] ${out}`;
  return out;
}

const wordsOf = (t: string): string[] => t.split(/[\s.,!?؟،«»:;—\-[\]]+/u).filter(Boolean);
const isSubsequence = (needle: string[], hay: string[]): boolean => {
  let j = 0;
  for (const w of hay) if (j < needle.length && w === needle[j]) j += 1;
  return j === needle.length;
};

describe('S8B-04 speech markup — properties (P-a … P-f)', () => {
  const rand = rng(20261101);

  it('P-b: stripping valid markers inserted at allowed places gives the clean text back byte for byte', () => {
    for (let n = 0; n < 400; n += 1) {
      const t = CLEAN_TEXTS[n % CLEAN_TEXTS.length];
      const r = strip(insertValid(t, rand));
      expect(r.kind).toBe('OK');
      if (r.kind === 'OK') expect(r.text).toBe(t);
    }
  });

  it('P-a / P-c: under any corruption of the markers alone, no opener survives and no word of the text is lost', () => {
    let truncatedBefore = -1;
    const corrupt = (marked: string): string => {
      const openers = [...marked.matchAll(/\[\[(?:say|speech):/gu)].map((m) => m.index);
      if (openers.length === 0) return marked;
      const at = openers[Math.floor(rand() * openers.length)];
      const close = marked.indexOf(']]', at);
      switch (Math.floor(rand() * 6)) {
        // The stream ends inside the marker: the words before it are what must survive.
        case 0: truncatedBefore = at; return marked.slice(0, at + 1 + Math.floor(rand() * Math.max(1, close + 2 - at)));
        case 1: return close < 0 ? marked : marked.slice(0, close) + marked.slice(close + 2);
        case 2: return `${marked.slice(0, at)}[[say:Latin text]]${marked.slice(close + 2)}`;
        case 3: return `${marked.slice(0, at)}[[speech:WHATEVER]]${marked.slice(close + 2)}`;
        case 4: return `${marked.slice(0, at)}[[say:${marked.slice(at)}`;
        default: {
          const w = arabicWords(marked)[0];
          return w ? `${marked.slice(0, w.start + 1)}[[say:مِلْك]]${marked.slice(w.start + 1)}` : marked;
        }
      }
    };
    let malformed = 0;
    for (let n = 0; n < 600; n += 1) {
      const t = CLEAN_TEXTS[n % CLEAN_TEXTS.length];
      truncatedBefore = -1;
      const marked = insertValid(t, rand);
      const corrupted = corrupt(marked);
      const prefix = truncatedBefore >= 0 ? strip(marked.slice(0, truncatedBefore)) : null;
      const expected = prefix ? (prefix.kind === 'OK' ? prefix.text : '') : t;
      const r = strip(corrupted);
      if (r.kind === 'MALFORMED') {
        malformed += 1;
        continue;
      }
      expect(r.text).not.toMatch(/\[\[(?:say|speech):/u);
      expect(isSubsequence(wordsOf(expected), wordsOf(r.text))).toBe(true);
    }
    expect(malformed).toBeGreaterThan(0);
  });

  it('P-e: hints come only from valid closed markers (or the valid end-of-reply token, which yields none)', () => {
    for (let n = 0; n < 200; n += 1) {
      const marked = insertValid(CLEAN_TEXTS[n % CLEAN_TEXTS.length], rand);
      const r = strip(marked);
      if (r.kind !== 'OK') continue;
      const closed = [...marked.matchAll(/\[\[say:([^\s[\]]{1,60})\]\]/gu)].map((m) => m[1]);
      expect(r.hints.map((h) => h.word)).toEqual(closed);
    }
  });

  it('P-f: the streaming parser over any chunking equals the whole-reply parser', () => {
    const samples = [
      ...CLEAN_TEXTS.map((t) => insertValid(t, rand)),
      'طبخت الأرز في القدر الكبير. [[say:القِدْر',
      '[[say: وبعدين رحنا البيت.',
      '[[speech:EMPATHY]]\nأنا معاك. [[say:عُمْري]]\n[[say:مِلْك]]\nتمام.',
      'نص [[wiki]] و [ و [[ و ]] عادي.',
    ];
    for (const s of samples) {
      const whole = strip(s);
      for (let trial = 0; trial < 30; trial += 1) {
        const stream = new SpeechMarkupStream({ safetyGuided: false });
        let shown = '';
        let i = 0;
        while (i < s.length) {
          const size = 1 + Math.floor(rand() * 9);
          shown += stream.push(s.slice(i, i + size));
          i += size;
        }
        const end = stream.end();
        expect(end).toEqual(whole);
        if (end.kind === 'OK') expect(end.text.startsWith(shown)).toBe(true);
        expect(shown).not.toMatch(/\[\[(?:say|speech):/u);
      }
    }
  });

  it('P-f: a stream holds a possible marker no longer than the decision needs', () => {
    const stream = new SpeechMarkupStream({ safetyGuided: false });
    expect(stream.push('أهلًا [[sa')).toBe('أهلًا');
    expect(stream.push('y:مِلْك]] كيف')).toBe(' كيف');
    expect(stream.overHold).toBe(false);
  });
});
