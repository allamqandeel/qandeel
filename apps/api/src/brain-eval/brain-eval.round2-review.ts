import { createHash } from 'node:crypto';
import { DEFAULT_INTERACTION_PREFERENCES } from '../interaction-preferences/interaction-preferences.types';
import { replyShape, type DeepSeekEvaluationResult } from './brain-eval.deepseek';
import { pathComparisonStem } from './brain-eval.golden-round2.suite';
import type { BrainEvaluationCase } from './brain-eval.types';

// S8A-02 Round 2 (Product Owner decision, 2026-10-21) — the blinded review of the ONE brain-eval system, for repeated runs.
//
// Each item shows two SETS, X and Y, of complete replies to the same input: every attempt, failures included. Which
// condition produced which set (core v2 / core v3, or FAST / DEEP) is decided per item by a salted hash, and the mapping
// and its salt are written ONLY to a separate label map. The packet carries no label, path, latency, token count or route:
// nothing in it says which set is which. The reviewer (the Product Owner; optionally a second, AI rater that sees the packet
// only) records the blocking failures and the personality-quality judgements on the form; un-blinding happens after.
//
// Review aids are deterministic flags for attention (form, gendered address, dialect markers, script). They are NEVER
// scores and decide nothing: a flagged reply may be right, and an unflagged one wrong.

const ARABIC_MARKS = /[ً-ْٰـ]/gu;
const normalize = (text: string): string => text.replace(ARABIC_MARKS, '').replace(/[أإآ]/gu, 'ا').replace(/ى/gu, 'ي');
const words = (text: string): string[] => normalize(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

// Second-person address that carries a gender in common Arabic varieties (a curated list: an aid, not a grammar). Unvocalized
// «أنت» is left out: it is written the same for either gender.
const FEMININE_ADDRESS = ['انتي', 'عليكي', 'ليكي', 'ارتاحي', 'خليكي', 'ناوية', 'تعبانة', 'مبسوطة', 'قاعدة', 'حبيبتي', 'عاملة', 'قادرة', 'متأكدة', 'جاهزة', 'محتاجة'];
const MASCULINE_ADDRESS = ['ناوي', 'تعبان', 'مبسوط', 'قاعد', 'حبيبي', 'عامل', 'قادر', 'متأكد', 'جاهز', 'محتاج', 'صاحبي', 'باشا', 'معلم'];
// Markers that usually belong to one variety; a reply in another variety that shows them is worth a look.
const DIALECT_MARKERS: Readonly<Record<'EGYPTIAN' | 'LEVANTINE' | 'GULF' | 'MAGHREBI', ReadonlyArray<string>>> = {
  EGYPTIAN: ['مش', 'عايز', 'عايزة', 'ازاي', 'دلوقتي', 'كده', 'بتاع', 'اوي', 'خالص'],
  LEVANTINE: ['هلق', 'هلا', 'شو', 'منيح', 'هيك', 'بدي', 'بدك', 'كتير', 'لهيك', 'مو'],
  GULF: ['وش', 'ابي', 'ابغي', 'ابغى', 'زين', 'وايد', 'الحين', 'شلون', 'ودي'],
  MAGHREBI: ['واش', 'بزاف', 'ديال', 'كيفاش', 'غادي', 'دابا', 'شنو', 'بغيت', 'كاين'],
};

export interface ReviewAids {
  characters: number;
  questionMarks: number;
  endsWithQuestion: boolean;
  markdown: { bold: number; headings: number; bullets: number; numbered: number };
  genderedAddress: { feminine: string[]; masculine: string[] };
  dialectMarkers: Record<keyof typeof DIALECT_MARKERS, string[]>;
  /** Share of letters that are Latin (0 = all Arabic letters, 1 = all Latin). */
  latinLetterShare: number;
}

const matches = (tokens: ReadonlyArray<string>, lexicon: ReadonlyArray<string>): string[] => {
  const wanted = new Set(lexicon.map(normalize));
  // A leading «و» / «ف» / «ب» clitic does not hide a marker; the marker itself is reported.
  const found = tokens.map((token) => (wanted.has(token) ? token : /^[وفب]/u.test(token) && wanted.has(token.slice(1)) ? token.slice(1) : null));
  return [...new Set(found.filter((token): token is string => token !== null))];
};

export function reviewAids(reply: string): ReviewAids {
  const shape = replyShape(reply);
  const tokens = words(reply);
  const latin = (reply.match(/[A-Za-z]/gu) ?? []).length;
  const arabic = (reply.match(/\p{Script=Arabic}/gu) ?? []).length;
  return {
    characters: shape.characters, questionMarks: shape.questionMarks, endsWithQuestion: shape.endsWithQuestion,
    markdown: { bold: shape.boldSpans, headings: shape.headingLines, bullets: shape.bulletLines, numbered: shape.numberedLines },
    genderedAddress: { feminine: matches(tokens, FEMININE_ADDRESS), masculine: matches(tokens, MASCULINE_ADDRESS) },
    dialectMarkers: {
      EGYPTIAN: matches(tokens, DIALECT_MARKERS.EGYPTIAN), LEVANTINE: matches(tokens, DIALECT_MARKERS.LEVANTINE),
      GULF: matches(tokens, DIALECT_MARKERS.GULF), MAGHREBI: matches(tokens, DIALECT_MARKERS.MAGHREBI),
    },
    latinLetterShare: latin + arabic === 0 ? 0 : Math.round((latin / (latin + arabic)) * 100) / 100,
  };
}

export const NO_REPLY = 'No reply: the attempt failed (provider error or time budget) and was not retried.';

export interface BlindReply { attempt: number; reply: string | null; failure: string | null; aids: ReviewAids | null }

export interface BlindPacketItem {
  itemId: string;
  world: 'PERSONAL' | 'SHARED' | 'PUBLIC';
  context: unknown;
  reviewNotes: ReadonlyArray<string>;
  declaredPreferences: unknown;
  safetyGuided: boolean;
  X: BlindReply[];
  Y: BlindReply[];
}

export interface BlindGroup {
  itemId: string;
  /** The case whose input both sets answer (for PATHS, either member of the pair: their input is identical). */
  testCase: BrainEvaluationCase;
  a: { condition: string; results: ReadonlyArray<DeepSeekEvaluationResult> };
  b: { condition: string; results: ReadonlyArray<DeepSeekEvaluationResult> };
}

/** X is \`a\` or \`b\` by a salted hash of the item id: stable for one salt, unpredictable without it. */
export const xIsA = (salt: string, itemId: string): boolean => (createHash('sha256').update(`${salt}\u0000${itemId}`, 'utf8').digest()[0] & 1) === 0;

const blindSet = (results: ReadonlyArray<DeepSeekEvaluationResult>): BlindReply[] => [...results]
  .sort((left, right) => left.repeat - right.repeat)
  .map((result, index) => (result.success
    ? { attempt: index + 1, reply: result.response, failure: null, aids: reviewAids(result.response) }
    : { attempt: index + 1, reply: null, failure: NO_REPLY, aids: null }));

export function createBlindPacket(groups: ReadonlyArray<BlindGroup>, salt: string) {
  if (salt.length < 16) throw new Error('The blinding salt must be at least 16 characters.');
  const packet: BlindPacketItem[] = [];
  const labelMap: Array<{ itemId: string; X: string; Y: string }> = [];
  for (const group of groups) {
    const aFirst = xIsA(salt, group.itemId);
    const [x, y] = aFirst ? [group.a, group.b] : [group.b, group.a];
    const testCase = group.testCase;
    packet.push({
      itemId: group.itemId,
      world: testCase.world?.kind ?? 'PERSONAL',
      context: testCase.world === undefined ? testCase.context : testCase.world,
      reviewNotes: testCase.reviewNotes,
      declaredPreferences: testCase.world === undefined ? testCase.interactionPreferences ?? DEFAULT_INTERACTION_PREFERENCES : null,
      safetyGuided: testCase.safety === 'GUIDED',
      X: blindSet(x.results), Y: blindSet(y.results),
    });
    labelMap.push({ itemId: group.itemId, X: x.condition, Y: y.condition });
  }
  return { packet, labelMap: { salt, items: labelMap } };
}

// The review form: blocking failures are counted per set (how many of its replies show it); quality is judged per set on
// 1–5, or NA where a dimension does not apply (for example humour on a Safety turn).
export const BLOCKING_FAILURES = [
  'UNFOUNDED_PERSONAL_ASSUMPTION', 'INVENTED_FACT', 'HUMOUR_AGAINST_SAFETY', 'PREFERENCE_VIOLATION', 'PARTICIPANT_INDEPENDENCE', 'CASE_FAIL_CONDITION',
] as const;
export const PERSONALITY_QUALITY = ['NATURALNESS', 'SPONTANEITY', 'FITTING_HUMOUR', 'DEPTH', 'CANDOUR', 'USEFULNESS'] as const;

type Blocking = Record<typeof BLOCKING_FAILURES[number], number | null>;
type Quality = Record<typeof PERSONALITY_QUALITY[number], number | 'NA' | null>;
export interface SetReview { blocking: Blocking; quality: Quality; readsAsQandeel: 'QANDEEL' | 'GENERIC_ASSISTANT' | 'MIXED' | null }
export interface ItemReview { itemId: string; X: SetReview; Y: SetReview; preference: 'X' | 'Y' | 'EQUAL' | null; note: string }

const emptySet = (): SetReview => ({
  blocking: Object.fromEntries(BLOCKING_FAILURES.map((name) => [name, null])) as Blocking,
  quality: Object.fromEntries(PERSONALITY_QUALITY.map((name) => [name, null])) as Quality,
  readsAsQandeel: null,
});

export const reviewForm = (packet: ReadonlyArray<BlindPacketItem>): ItemReview[] =>
  packet.map((item) => ({ itemId: item.itemId, X: emptySet(), Y: emptySet(), preference: null, note: '' }));

/** Un-blinds a completed form: per condition, blocking-failure counts, quality means (NA and blanks excluded), preferences. */
export function summarizeBlindReview(form: ReadonlyArray<ItemReview>, labelMap: { items: ReadonlyArray<{ itemId: string; X: string; Y: string }> }) {
  const conditionOf = new Map(labelMap.items.map((entry) => [entry.itemId, entry]));
  const totals = new Map<string, { items: number; blocking: Record<string, number>; quality: Record<string, number[]>; preferred: number; qandeel: number }>();
  const bucket = (condition: string) => {
    if (!totals.has(condition)) {
      totals.set(condition, {
        items: 0, preferred: 0, qandeel: 0,
        blocking: Object.fromEntries(BLOCKING_FAILURES.map((name) => [name, 0])),
        quality: Object.fromEntries(PERSONALITY_QUALITY.map((name) => [name, [] as number[]])),
      });
    }
    return totals.get(condition)!;
  };
  let equal = 0;
  let unrated = 0;
  for (const item of form) {
    const map = conditionOf.get(item.itemId);
    if (map === undefined) throw new Error(`The label map has no entry for ${item.itemId}.`);
    for (const side of ['X', 'Y'] as const) {
      const total = bucket(map[side]);
      const review = item[side];
      total.items += 1;
      for (const name of BLOCKING_FAILURES) total.blocking[name] += review.blocking[name] ?? 0;
      for (const name of PERSONALITY_QUALITY) {
        const value = review.quality[name];
        if (typeof value === 'number') total.quality[name].push(value);
      }
      if (review.readsAsQandeel === 'QANDEEL') total.qandeel += 1;
    }
    if (item.preference === 'EQUAL') equal += 1;
    else if (item.preference === null) unrated += 1;
    else bucket(map[item.preference]).preferred += 1;
  }
  const mean = (values: number[]) => (values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : null);
  return {
    conditions: Object.fromEntries([...totals].map(([condition, total]) => [condition, {
      items: total.items, preferred: total.preferred, readsAsQandeel: total.qandeel, blockingFailures: total.blocking,
      qualityMeans: Object.fromEntries(PERSONALITY_QUALITY.map((name) => [name, mean(total.quality[name])])),
      qualityRated: Object.fromEntries(PERSONALITY_QUALITY.map((name) => [name, total.quality[name].length])),
    }])),
    equalPreference: equal, unratedPreference: unrated,
  };
}

/** The packet as a readable document: every reply in full, every failure stated, no condition named. */
export function renderBlindPacketMarkdown(title: string, packet: ReadonlyArray<BlindPacketItem>): string {
  const lines = [
    `# ${title}`, '',
    'Each item shows two sets of replies, X and Y, to the same input. They were produced under two conditions that are not',
    'disclosed here; which one is X changes from item to item. Every attempt is shown in full, failures included.',
    'An attempt with no reply is neither a pass nor a fail of any rule: judge only the replies.',
    'Review aids are flags for attention only, never scores.', '',
  ];
  for (const item of packet) {
    lines.push(`## ${item.itemId} (${item.world})`, '');
    lines.push('**Input**', '', '```json', JSON.stringify(item.context, null, 1), '```', '');
    if (item.declaredPreferences !== null) lines.push(`**Declared preferences:** \`${JSON.stringify(item.declaredPreferences)}\``, '');
    if (item.safetyGuided) lines.push('**Safety:** GUIDED (safety guidance applies on this turn)', '');
    lines.push('**Review notes:**', ...item.reviewNotes.map((note) => `- ${note}`), '');
    for (const side of ['X', 'Y'] as const) {
      lines.push(`### Set ${side}`, '');
      for (const reply of item[side]) {
        lines.push(`**Attempt ${reply.attempt}**`, '');
        lines.push(reply.reply === null ? `> ${reply.failure}` : reply.reply.split('\n').map((line) => `> ${line}`).join('\n'), '');
        if (reply.aids !== null) {
          const aids = reply.aids;
          const flags = [
            `${aids.characters} chars`, `${aids.questionMarks} question mark(s)${aids.endsWithQuestion ? ', ends with a question' : ''}`,
            ...(aids.markdown.bold + aids.markdown.headings + aids.markdown.bullets + aids.markdown.numbered > 0
              ? [`markdown: bold ${aids.markdown.bold}, headings ${aids.markdown.headings}, bullets ${aids.markdown.bullets}, numbered ${aids.markdown.numbered}`] : []),
            ...(aids.genderedAddress.feminine.length ? [`feminine forms: ${aids.genderedAddress.feminine.join('، ')}`] : []),
            ...(aids.genderedAddress.masculine.length ? [`masculine forms: ${aids.genderedAddress.masculine.join('، ')}`] : []),
            ...Object.entries(aids.dialectMarkers).filter(([, found]) => found.length).map(([variety, found]) => `${variety.toLowerCase()} markers: ${found.join('، ')}`),
            ...(aids.latinLetterShare > 0 ? [`Latin letters ${Math.round(aids.latinLetterShare * 100)}%`] : []),
          ];
          lines.push(`<sub>aids: ${flags.join(' · ')}</sub>`, '');
        }
      }
    }
  }
  return lines.join('\n');
}

// Round 3 (Product Owner decision D4, 2026-10-21): attempts that produced no reply are counted on their own and judged
// neither way. An item is INCONCLUSIVE when either set has fewer than `minimumReplies` replies.
export const ROUND3_MINIMUM_REPLIES = 2;

export function completionReport(groups: ReadonlyArray<BlindGroup>, minimumReplies: number) {
  if (!Number.isInteger(minimumReplies) || minimumReplies < 1) throw new Error('minimumReplies must be a positive integer.');
  const side = (results: ReadonlyArray<DeepSeekEvaluationResult>) => {
    const failures = results.filter((result) => !result.success);
    return {
      attempts: results.length, replies: results.length - failures.length, noReply: failures.length,
      failureReasons: [...new Set(failures.map((result) => result.error ?? 'unknown'))],
    };
  };
  const items = groups.map((group) => {
    const [a, b] = [side(group.a.results), side(group.b.results)];
    const conclusive = a.replies >= minimumReplies && b.replies >= minimumReplies;
    return { itemId: group.itemId, verdict: conclusive ? 'CONCLUSIVE' as const : 'INCONCLUSIVE' as const, [group.a.condition]: a, [group.b.condition]: b };
  });
  return { minimumReplies, inconclusiveItems: items.filter((item) => item.verdict === 'INCONCLUSIVE').map((item) => item.itemId), items };
}

const resultsOf = (results: ReadonlyArray<DeepSeekEvaluationResult>, caseId: string) => results.filter((result) => result.caseId === caseId);

/** GUIDANCE: one item per case; the two sets are every attempt under core v2 and every attempt under core v3. */
export function guidanceGroups(
  cases: ReadonlyArray<BrainEvaluationCase>, first: ReadonlyArray<DeepSeekEvaluationResult>, second: ReadonlyArray<DeepSeekEvaluationResult>,
  labels: readonly [string, string] = ['core-v2', 'core-v3'],
): BlindGroup[] {
  return cases.map((testCase) => ({
    itemId: testCase.id, testCase,
    a: { condition: labels[0], results: resultsOf(first, testCase.id) },
    b: { condition: labels[1], results: resultsOf(second, testCase.id) },
  }));
}

/**
 * PATHS: one item per message; the two sets are its FAST and its DEEP attempts under one core. The item id names the stem
 * only, never a path, and the input shown is the pair's shared input (the validator proves the two cases identical).
 */
export function pathGroups(cases: ReadonlyArray<BrainEvaluationCase>, results: ReadonlyArray<DeepSeekEvaluationResult>): BlindGroup[] {
  const stems = [...new Set(cases.map((testCase) => pathComparisonStem(testCase.id)))];
  return stems.map((stem) => {
    const member = (path: 'FAST' | 'DEEP') => {
      const found = cases.find((testCase) => testCase.path === path && pathComparisonStem(testCase.id) === stem);
      if (found === undefined) throw new Error(`The path pair ${stem} has no ${path} case.`);
      return found;
    };
    const [fast, deep] = [member('FAST'), member('DEEP')];
    return {
      itemId: `pathcmp-${stem}`, testCase: fast,
      a: { condition: 'FAST', results: resultsOf(results, fast.id) },
      b: { condition: 'DEEP', results: resultsOf(results, deep.id) },
    };
  });
}
