import { PRONUNCIATION_LEXICON, lexiconSpans } from './pronunciation-lexicon';
import {
  BASELINE_RENDER_PROFILE, compatibleReadings, FIRST_SEGMENT_CHARS, MAX_SEGMENTS, PRODUCTION_RENDER_PROFILE, renderChunk,
  renderSpeech, SEGMENT_CHARS, segmentSpoken, spokenAlignmentViolations, type RenderProfile,
} from './speech-renderer';
import { SPEECH_HINT_POLICY, validateSpeechHints } from './speech-hints';
import { L0_CASES } from './testing/l0-regression.fixture';

/** S8B-04 CP1, contract v1.2 §6.3 / §6.8 / §6.10. */

const P1_PROFILE: RenderProfile = { numbers: true, lexicon: 'ALL_CANDIDATES', form: 'FULL', hintPolicy: 'B_ALL' };
const spoken = (text: string, profile: RenderProfile = PRODUCTION_RENDER_PROFILE): string => renderChunk(text, [], profile).spoken;
const baseline = (text: string): string => spoken(text, BASELINE_RENDER_PROFILE);

describe('S8B-04 Speech Rendering — production state', () => {
  it('ships every lexicon entry disabled, the hint channel OFF and A1 on (P-1 decides the rest)', () => {
    expect(PRONUNCIATION_LEXICON.map((e) => e.id)).toEqual(['A2-01', 'A2-02', 'A2-03', 'A2-04']);
    expect(PRONUNCIATION_LEXICON.every((e) => e.enabled === false)).toBe(true);
    expect(SPEECH_HINT_POLICY).toBe('OFF');
    expect(PRODUCTION_RENDER_PROFILE).toEqual({ numbers: true, lexicon: 'ENABLED_ONLY', form: 'FULL', hintPolicy: 'OFF' });
    expect(lexiconSpans('طبخت الأرز في القدر الكبير.', { mode: 'ENABLED_ONLY' })).toEqual([]);
  });

  it('ignores hints entirely while the policy is OFF, even valid ones', () => {
    const text = 'طبخت الأرز في القدر الكبير.';
    const hints = validateSpeechHints(text, [{ word: 'القِدْر', at: text.length }], 'B_ALL').hints;
    expect(hints).toHaveLength(1);
    expect(renderChunk(text, hints).spoken).toBe(text);
  });
});

describe('S8B-04 Speech Rendering — PA-4: the L-0 listening as a free regression', () => {
  const corrected = new Set(['H07', 'H10', 'H13', 'H29']);
  const pairs = L0_CASES.filter((c) => c.rendered !== null);

  it('covers the 43 rated pairs and the 3 singles', () => {
    expect(pairs).toHaveLength(43);
    expect(L0_CASES.filter((c) => c.kind === 'SINGLE')).toHaveLength(3);
  });

  it.each(pairs.filter((c) => c.group !== 'NUMBER').map((c) => [c.caseId, c] as const))(
    '%s: the full A path gives RENDERED only where L-0 proved the need, BASELINE everywhere else',
    (id, c) => {
      const out = spoken(c.baseline.text, P1_PROFILE);
      expect(out).toBe(corrected.has(id) ? c.rendered!.text : c.baseline.text);
      expect(baseline(c.baseline.text)).toBe(c.baseline.text);
    },
  );

  it('the four corrected cases inherit the CORRECT, not-less-natural rating of the sample they now match', () => {
    for (const id of corrected) {
      const c = pairs.find((x) => x.caseId === id)!;
      expect(c.baseline.verdict).toBe('WRONG');
      expect(c.rendered).toMatchObject({ verdict: 'CORRECT', lessNatural: 'NO' });
      expect(spoken(c.baseline.text, P1_PROFILE)).toBe(c.rendered!.text);
    }
  });

  it('the production profile (no entry enabled) leaves every L-0 homograph and name case at BASELINE', () => {
    for (const c of pairs.filter((x) => x.group !== 'NUMBER')) expect(spoken(c.baseline.text)).toBe(c.baseline.text);
  });

  it('A1: D01, D03, D04, D07 render exactly the rated RENDERED text; D02, D05, D06, D08 produce new MSA wording for P-1 (c)', () => {
    const numbers = new Map(pairs.filter((c) => c.group === 'NUMBER').map((c) => [c.caseId, c] as const));
    for (const id of ['D01', 'D03', 'D04', 'D07']) {
      const c = numbers.get(id)!;
      expect(spoken(c.baseline.text)).toBe(c.rendered!.text);
    }
    expect(spoken(numbers.get('D02')!.baseline.text)).toBe('دفعت ألفين وخمسمئة جنيه.');
    expect(spoken(numbers.get('D05')!.baseline.text)).toBe('فاضل ثلاثة أيام على الامتحان.');
    expect(spoken(numbers.get('D06')!.baseline.text)).toBe('الرحلة الساعة العاشرة والربع الصبح.');
    expect(spoken(numbers.get('D08')!.baseline.text)).toBe('عمرها إحدى وعشرين سنة.');
    for (const id of ['D02', 'D05', 'D06', 'D08']) {
      const c = numbers.get(id)!;
      expect(spoken(c.baseline.text)).not.toBe(c.rendered!.text);
    }
  });

  it('singles are unchanged (foreign words and names are never processed)', () => {
    for (const c of L0_CASES.filter((x) => x.kind === 'SINGLE')) expect(spoken(c.baseline.text, P1_PROFILE)).toBe(c.baseline.text);
  });
});

describe('S8B-04 Speech Rendering — PA-1b / PA-1c / PA-2 / PA-3 / A4 / A5', () => {
  const positives: Array<[string, string, string]> = [
    ['A2-01', 'هذا البيت ملك أبي منذ زمن.', 'هذا البيت مِلْك أبي منذ زمن.'],
    ['A2-01', 'الأرض ملك جدي.', 'الأرض مِلْك جدي.'],
    ['A2-01', 'الشقة ملك أخوي.', 'الشقة مِلْك أخوي.'],
    ['A2-02', 'طبخت الأرز في القدر الكبير.', 'طبخت الأرز في القِدْر الكبير.'],
    ['A2-02', 'حط اللحم على القدر وخليه يغلي.', 'حط اللحم على القِدْر وخليه يغلي.'],
    ['A2-03', 'لبست العقد الذي أهدته لها أمها.', 'لبست العِقْد الذي أهدته لها أمها.'],
    ['A2-03', 'اشترت عقد ذهب لأختها.', 'اشترت عِقْد ذهب لأختها.'],
    ['A2-04', 'عمري تلاتين سنة ولسه بتعلم.', 'عُمْري تلاتين سنة ولسه بتعلم.'],
    ['A2-04', 'عمري 25 سنة.', 'عُمْري خمس وعشرين سنة.'],
  ];
  const negatives = [
    'استقبل الملك الوفد في القصر.',
    'الملك عادل.',
    'هذا البيت ملك.',
    'رضي بما كتبه الله له من القدر.',
    'القدر كتب لنا نلتقي.',
    'في القدر حكمة كبيرة.',
    'وقع العقد مع الشركة صباح الأحد.',
    'العقد ينتهي الشهر الجاي.',
    'عقد العمل جاهز.',
    'عمر صاحبي من أيام الجامعة.',
    'عمري ما شفت كده.',
    'عمري كله قدامي.',
    'هذا البيت مِلك أبي.',
    'طبخت الأرز في القِدر.',
  ];

  it.each(positives)('PA-2 positive %s: %s', (id, text, expected) => {
    const r = renderChunk(text, [], P1_PROFILE);
    expect(r.spoken).toBe(expected);
    expect(r.spans.filter((s) => s.kind === 'SR-L1')).toHaveLength(1);
    expect(lexiconSpans(text, { mode: 'ALL_CANDIDATES' })[0].entryId).toBe(id);
  });

  it.each(negatives)('PA-2 negative (the default reading, or no cue, or already vocalized) never fires: %s', (text) => {
    expect(lexiconSpans(text, { mode: 'ALL_CANDIDATES' })).toEqual([]);
  });

  it('A5: the MINIMAL form is the one-vowel variant, for P-1 only', () => {
    expect(lexiconSpans('طبخت الأرز في القدر الكبير.', { mode: 'ALL_CANDIDATES', form: 'MINIMAL' })[0].spoken).toBe('القِدر');
    for (const e of PRONUNCIATION_LEXICON) {
      for (const r of e.rules) expect(compatibleReadings(r.spoken, r.minimal)).toBe(true);
    }
  });

  it('PA-1c / A4: no lexicon entry is a name, a foreign word or a default reading', () => {
    for (const e of PRONUNCIATION_LEXICON) {
      for (const r of e.rules) {
        expect(r.spoken).not.toBe(e.defaultReading);
        expect(/^[ء-يً-ْٰ]+$/u.test(r.spoken)).toBe(true);
      }
    }
    for (const c of L0_CASES.filter((x) => x.group === 'NAME' || x.kind === 'SINGLE')) {
      expect(lexiconSpans(c.baseline.text, { mode: 'ALL_CANDIDATES' })).toEqual([]);
    }
  });

  it('PA-3: where A does not act, the spoken version equals the BASELINE spoken version byte for byte', () => {
    for (const text of [...negatives, 'تمام، فاهمك.', 'Sounds good, see you at 7:30.', 'شوف **ده** و`كده`.']) {
      const a = renderChunk(text, [], { ...P1_PROFILE, numbers: false });
      expect(a.spoken).toBe(baseline(text));
    }
  });
});

describe('S8B-04 Speech Rendering — SR-F1 / SR-F2 / AC-03', () => {
  it.each([
    ['**مهم** جدًا', 'مهم جدًا'],
    ['# عنوان\nنص', 'عنوان\nنص'],
    ['- أول\n- ثاني', 'أول\nثاني'],
    ['1. أول\n2. ثاني', 'أول\nثاني'],
    ['> اقتباس', 'اقتباس'],
    ['شوف [الرابط ده](https://example.com/x) كده.', 'شوف الرابط ده كده.'],
    ['شوف https://example.com/a?b=1.', 'شوف.'],
    ['جرب `npm test` بس.', 'جرب npm test بس.'],
    ['```js\nconst x = 1;\n```', 'const x = 1;'],
    ['a <b> c', 'a b c'],
    ['x<y', 'x y'],
    ['هذا *مهم* فعلًا', 'هذا مهم فعلًا'],
    ['2*3 = 6', '2*3 = 6'],
    ['snake_case_name', 'snake_case_name'],
    ['   مسافات   ', 'مسافات'],
  ])('%j → %j', (input, expected) => {
    const r = renderChunk(input, [], BASELINE_RENDER_PROFILE);
    expect(r.spoken).toBe(expected);
    expect(r.spoken).not.toMatch(/[<>]/u);
    expect(spokenAlignmentViolations(input, r)).toEqual([]);
  });

  it('English replies get formatting only (no numbers transform on record)', () => {
    expect(spoken('See you at **7:30** on 15/3/2026.')).toBe('See you at 7:30 on 15/3/2026.');
  });
});

describe('S8B-04 Speech Rendering — the conflict rule (C) and SR-D1', () => {
  const text = 'طبخت الأرز في القدر الكبير.';
  const at = text.length;

  it('applies a valid hint under B_ALL when A has nothing for the word', () => {
    const t = 'رفعوا العلم فوق المدرسة.';
    const hints = validateSpeechHints(t, [{ word: 'العَلَم', at: t.length }], 'B_ALL').hints;
    const r = renderChunk(t, hints, P1_PROFILE);
    expect(r.spoken).toBe('رفعوا العَلَم فوق المدرسة.');
    expect(r.counts.hints).toBe(1);
  });

  it('B_FILTERED drops a hint for a recorded default reading', () => {
    const t = 'رفعوا العلم فوق المدرسة.';
    const hints = validateSpeechHints(t, [{ word: 'العَلَم', at: t.length }], 'B_ALL').hints;
    expect(renderChunk(t, hints, { ...P1_PROFILE, hintPolicy: 'B_FILTERED' }).spoken).toBe(t);
  });

  it('agreeing A and B readings give A once; disagreeing readings give no vocalization (counted)', () => {
    const agree = validateSpeechHints(text, [{ word: 'القِدر', at }], 'B_ALL').hints;
    expect(renderChunk(text, agree, P1_PROFILE).spoken).toBe('طبخت الأرز في القِدْر الكبير.');
    const disagree = validateSpeechHints(text, [{ word: 'القَدَر', at }], 'B_ALL').hints;
    const r = renderChunk(text, disagree, P1_PROFILE);
    expect(r.spoken).toBe(text);
    expect(r.counts.conflicts).toBe(1);
  });
});

describe('S8B-04 Speech Rendering — SR-S1 segmentation', () => {
  const sentence = 'هذه جملة عربية متوسطة الطول تتكرر لاختبار التقسيم. ';

  it('joins back to the spoken text exactly, cuts only after whitespace, respects the limits', () => {
    const long = sentence.repeat(30).trim();
    const r = segmentSpoken(long);
    expect(r.kind).toBe('OK');
    if (r.kind !== 'OK') return;
    expect(r.segments.join('')).toBe(long);
    expect(r.segments[0].trim().length).toBeLessThanOrEqual(FIRST_SEGMENT_CHARS);
    for (const s of r.segments.slice(1)) expect(s.trim().length).toBeLessThanOrEqual(SEGMENT_CHARS);
    for (const s of r.segments.slice(0, -1)) expect(s).toMatch(/\s$/u);
    for (const s of r.segments.slice(0, -1)) expect(s.trim()).toMatch(/[.!?؟…]$/u);
  });

  it('refuses a reply longer than the cap and reports an empty one', () => {
    expect(segmentSpoken(sentence.repeat(200)).kind).toBe('TOO_LONG');
    expect(segmentSpoken('   ')).toEqual({ kind: 'EMPTY' });
    expect(renderSpeech('https://example.com', []).segmentation).toEqual({ kind: 'EMPTY' });
    expect(MAX_SEGMENTS).toBe(16);
  });

  it('a short reply is one segment', () => {
    expect(segmentSpoken('تمام.')).toEqual({ kind: 'OK', segments: ['تمام.'] });
  });
});

describe('S8B-04 Speech Rendering — PA-9 SPOKEN-ALIGN and PA-8 timing', () => {
  const corpus = [
    ...L0_CASES.map((c) => c.baseline.text),
    'الموعد **7:30** مساءً، شوف [هنا](https://x.y/z) و<تمام>.',
    '# خطة\n- 3 أيام\n- 25% خصم\n> طبخت الأرز في القدر الكبير.',
  ];

  it('every render of every profile is aligned (closed kinds, each passing its check, exact assembly)', () => {
    for (const text of corpus) {
      for (const profile of [BASELINE_RENDER_PROFILE, PRODUCTION_RENDER_PROFILE, P1_PROFILE, { ...P1_PROFILE, form: 'MINIMAL' as const }]) {
        expect(spokenAlignmentViolations(text, renderChunk(text, [], profile))).toEqual([]);
      }
    }
  });

  it('detects a tampered span', () => {
    const text = 'طبخت الأرز في القدر الكبير.';
    const r = renderChunk(text, [], P1_PROFILE);
    const tampered = { ...r, spans: r.spans.map((s) => ({ ...s, spoken: 'الكبير' })), spoken: r.spoken };
    expect(spokenAlignmentViolations(text, tampered).length).toBeGreaterThan(0);
  });

  it('PA-8: rendering a segment stays under 1 ms at p95 (local measure)', () => {
    const text = 'الموعد في الساعة 7:30 مساءً، وطبخت الأرز في القدر الكبير، **وبعدين** نتكلم عن 25% من 3.5 كيلومتر.';
    const times: number[] = [];
    for (let i = 0; i < 300; i += 1) {
      const t0 = process.hrtime.bigint();
      renderChunk(text, [], P1_PROFILE);
      times.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    times.sort((a, b) => a - b);
    expect(times[Math.floor(times.length * 0.95)]).toBeLessThan(1);
  });
});
