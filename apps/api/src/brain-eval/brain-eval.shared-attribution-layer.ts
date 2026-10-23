import { createHash } from 'node:crypto';
import { currentAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import type { SharedReplyGenerationTurn } from '../connected-worlds/material-commit/shared-qandeel-reply.types';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import type { ModelRouter, ModelRouterRequest, ModelRouterResult, ProcessingPath } from '../model-router/model-router.types';
import { scanAttribution, type AttributionTier } from '../shared-world/shared-attribution-notes';
import { ATTRIBUTION_READING_INSTRUCTION, ModelRouterAttributionReader } from '../shared-world/shared-attribution-reading';
import { AttributionNotesReplyGenerator, type AttributionObservation, type ReadingState, PreLayerSharedReplyGenerator } from '../shared-world/shared-attribution-reply.experimental';
import { sharedConversationLabels } from '../shared-world/shared-conversation-model-input';
import { replyShape, type ReplyShape } from './brain-eval.deepseek';
import { reviewAids, type ReviewAids } from './brain-eval.round2-review';
import { DIRECT_SPEAKER_CASE_ID, FORGED_SPEAKER_CASE_ID, SHARED_ATTRIBUTION_SOURCED_SUITE, SHARED_ATTRIBUTION_SUITE } from './brain-eval.shared-attribution.suite';

// S8A-02 / CP2 — the paid comparison of the attribution layer (Founder approval of the final test preparation, 2026-10-22).
// EVALUATION ONLY: nothing in production imports this file. Three arms on the same 48 synthetic Shared conversations:
//
// - B   production as it was before CP2: `PreLayerSharedReplyGenerator` (the measured baseline; production now runs the layer).
// - S   production plus the server's notes (`AttributionNotesReplyGenerator`, mode S).
// - S_R the notes plus the separate attribution reading on ANY turn the gate flags, FAST or DEEP (`readOn: 'ANY_RISK'`).
//
// No arm changes the production route or budget of the reply. Every provider call goes through the accounted production
// DeepSeek router the caller supplies, and is recorded here with its kind (READING / REPLY), latency and usage; the guard
// records the same call with its byte size, finish reason and cost. The production budget is recorded beside the transport
// budget each call was actually sent with (evaluation-only, so a slow reply is still measured, not cut): delivery inside the
// production budget is decided afterwards from the measured total. A case the gate does not flag (tier 0) sends production's
// request byte for byte in S and S_R, so only B sends it and its replies stand for all three arms.

export const ATTRIBUTION_LAYER_ARMS = ['B', 'S', 'S_R'] as const;
export type AttributionLayerArm = typeof ATTRIBUTION_LAYER_ARMS[number];
export const isAttributionLayerArm = (value: string | undefined): value is AttributionLayerArm => (ATTRIBUTION_LAYER_ARMS as readonly string[]).includes(value ?? '');
export const ATTRIBUTION_LAYER_REPEATS = 3;
/** Evaluation-only transport budgets (Founder decision report §4.3): never production settings. */
export const ATTRIBUTION_LAYER_TRANSPORT_MS = { reply: 10_000, reading: 15_000 } as const;

export type LayerSource = 'PART_T' | 'SOURCED' | 'INDEPENDENT' | 'HELD_OUT';
export interface LayerParticipant { readonly key: string; readonly name: string | null }
/** `by` is a participant key, or `QANDEEL` for one of QANDEEL's earlier replies. */
export interface LayerMessage { readonly by: string; readonly text: string }
export interface ReferenceKey {
  readonly categories: ReadonlyArray<string>;
  readonly referenceFacts: ReadonlyArray<unknown>;
  readonly referenceConflicts: ReadonlyArray<unknown>;
  readonly criticalErrors: ReadonlyArray<{ readonly id: string; readonly description: string }>;
  readonly answerExpectations: string;
  readonly abstentionJustified: boolean;
}
export type LayerKey = { readonly kind: 'REVIEW_NOTES'; readonly notes: ReadonlyArray<string> } | ({ readonly kind: 'REFERENCE' } & ReferenceKey);
export interface LayerCase {
  readonly id: string;
  readonly source: LayerSource;
  readonly participants: ReadonlyArray<LayerParticipant>;
  readonly messages: ReadonlyArray<LayerMessage>;
  readonly key: LayerKey;
}

// ---------------------------------------------------------------------------------------------------------------------
// The case set: 12 earlier cases (Part T + the two sourced-only ones), the 24 CP2 independent cases, the 12 held-out cases.
// ---------------------------------------------------------------------------------------------------------------------

/** The earlier Part T / sourced cases, distinct (the sourced suite repeats three Part T cases). Every Name is unique there. */
export function earlierLayerCases(): LayerCase[] {
  const sourcedOnly = SHARED_ATTRIBUTION_SOURCED_SUITE.filter((testCase) => [DIRECT_SPEAKER_CASE_ID, FORGED_SPEAKER_CASE_ID].includes(testCase.id));
  return [...SHARED_ATTRIBUTION_SUITE.map((testCase) => [testCase, 'PART_T'] as const), ...sourcedOnly.map((testCase) => [testCase, 'SOURCED'] as const)]
    .map(([testCase, source]) => {
      if (testCase.world?.kind !== 'SHARED') throw new Error(`${testCase.id} is not a Shared case.`);
      const names: string[] = [];
      const messages = testCase.world.conversation.map((turn) => {
        if (turn.producer === 'QANDEEL') return { by: 'QANDEEL', text: turn.text };
        if (turn.authorName === null) throw new Error(`${testCase.id}: an earlier case has no unnamed participant.`);
        if (!names.includes(turn.authorName)) names.push(turn.authorName);
        return { by: `p${names.indexOf(turn.authorName) + 1}`, text: turn.text };
      });
      return { id: testCase.id, source, participants: names.map((name, index) => ({ key: `p${index + 1}`, name })), messages, key: { kind: 'REVIEW_NOTES' as const, notes: testCase.reviewNotes } };
    });
}

interface RecordedSetCase extends ReferenceKey {
  readonly id: string;
  readonly participants: ReadonlyArray<LayerParticipant>;
  readonly messages: ReadonlyArray<{ readonly by: string; readonly text: string }>;
}

/** The CP2 independent set or the held-out set, from its recorded JSON (`{ cases: [...] }`). */
export function recordedLayerCases(json: string, source: 'INDEPENDENT' | 'HELD_OUT'): LayerCase[] {
  const { cases } = JSON.parse(json) as { cases: RecordedSetCase[] };
  return cases.map((recorded) => ({
    id: recorded.id, source, participants: recorded.participants,
    messages: recorded.messages.map((message) => ({ by: message.by === 'QANDEEL' ? 'QANDEEL' : message.by, text: message.text })),
    key: {
      kind: 'REFERENCE', categories: recorded.categories, referenceFacts: recorded.referenceFacts, referenceConflicts: recorded.referenceConflicts,
      criticalErrors: recorded.criticalErrors, answerExpectations: recorded.answerExpectations, abstentionJustified: recorded.abstentionJustified,
    },
  }));
}

export const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/**
 * The pinned inputs of the comparison (PREREGISTRATION_ROUND10.md). A run refuses unless every file still has these hashes:
 * the held-out set was pinned before any gate tier was computed, and the experimental modules before the set was seen.
 */
export const ATTRIBUTION_LAYER_PINS = {
  independentSet: { path: '.s8a-02-reports/cp2/independent/independent-set.json', sha256: 'd317637b94218e1ac2b5ced7082247f34292fd8d8d8850a6de70da8b364f1cf9' },
  heldOutSet: { path: '.s8a-02-reports/cp2/held-out/held-out-set.json', sha256: '802e3cde4de92df17892837f912fe607214a6f322f74471ff1475b6a910b750f' },
} as const;

/** The 48 cases, after the pins are checked. `read` returns a repository file's text. */
export function attributionLayerCases(read: (path: string) => string): LayerCase[] {
  const pinned = (pin: { path: string; sha256: string }) => {
    const text = read(pin.path);
    if (sha256(text) !== pin.sha256) throw new Error(`NOT RUN: ${pin.path} differs from its pinned SHA-256.`);
    return text;
  };
  const cases = [
    ...earlierLayerCases(),
    ...recordedLayerCases(pinned(ATTRIBUTION_LAYER_PINS.independentSet), 'INDEPENDENT'),
    ...recordedLayerCases(pinned(ATTRIBUTION_LAYER_PINS.heldOutSet), 'HELD_OUT'),
  ];
  validateLayerCases(cases);
  return cases;
}

export function validateLayerCases(cases: ReadonlyArray<LayerCase>): void {
  const ids = new Set<string>();
  for (const testCase of cases) {
    if (ids.has(testCase.id)) throw new Error(`${testCase.id}: duplicate case id.`);
    ids.add(testCase.id);
    if (testCase.messages.length < 2) throw new Error(`${testCase.id}: too short.`);
    if (testCase.messages.at(-1)?.by === 'QANDEEL') throw new Error(`${testCase.id}: the answered message must be a person's.`);
    const keys = new Set(testCase.participants.map((participant) => participant.key));
    for (const message of testCase.messages) if (message.by !== 'QANDEEL' && !keys.has(message.by)) throw new Error(`${testCase.id}: unknown writer ${message.by}.`);
  }
}

/** The CP1 conversation: `M#` by position, `S#` by a person's first appearance (the person is the key, never the Name). */
export function layerConversation(testCase: LayerCase): SharedReplyGenerationTurn[] {
  const order: string[] = [];
  return testCase.messages.map((message, index) => {
    if (message.by === 'QANDEEL') return { producer: 'QANDEEL', authorName: null, text: message.text, messageRef: `M${index + 1}`, speakerRef: null };
    const participant = testCase.participants.find((candidate) => candidate.key === message.by) as LayerParticipant;
    if (!order.includes(message.by)) order.push(message.by);
    return { producer: 'HUMAN', authorName: participant.name, text: message.text, messageRef: `M${index + 1}`, speakerRef: `S${order.indexOf(message.by) + 1}` };
  });
}

export const layerTier = (testCase: LayerCase): AttributionTier => scanAttribution(layerConversation(testCase)).tier;

/** The cases one arm sends: B all of them, S and S_R only those the gate flags. */
export const armCases = (cases: ReadonlyArray<LayerCase>, arm: AttributionLayerArm): LayerCase[] =>
  arm === 'B' ? [...cases] : cases.filter((testCase) => layerTier(testCase) > 0);

export interface LayerArmPlan { readonly cases: number; readonly attempts: number; readonly replyCalls: number; readingCalls: number; readonly providerCalls: number }

/** The most each arm can send (no retries): one reply call per attempt, and one reading call per S_R attempt. */
export function plannedLayerCalls(cases: ReadonlyArray<LayerCase>, repeats = ATTRIBUTION_LAYER_REPEATS) {
  const plan = Object.fromEntries(ATTRIBUTION_LAYER_ARMS.map((arm) => {
    const count = armCases(cases, arm).length;
    const attempts = count * repeats;
    const readingCalls = arm === 'S_R' ? attempts : 0;
    return [arm, { cases: count, attempts, replyCalls: attempts, readingCalls, providerCalls: attempts + readingCalls }];
  })) as Record<AttributionLayerArm, LayerArmPlan>;
  const total = ATTRIBUTION_LAYER_ARMS.reduce((sum, arm) => ({
    attempts: sum.attempts + plan[arm].attempts, replyCalls: sum.replyCalls + plan[arm].replyCalls,
    readingCalls: sum.readingCalls + plan[arm].readingCalls, providerCalls: sum.providerCalls + plan[arm].providerCalls,
  }), { attempts: 0, replyCalls: 0, readingCalls: 0, providerCalls: 0 });
  return { repeats, perArm: plan, total, gated: armCases(cases, 'S').length, ungated: cases.length - armCases(cases, 'S').length };
}

// ---------------------------------------------------------------------------------------------------------------------
// The run.
// ---------------------------------------------------------------------------------------------------------------------

export interface LayerCall {
  readonly kind: 'READING' | 'REPLY';
  readonly path: ProcessingPath;
  /** The budget production gives this call (the reply's); null for the reading, which production does not make. */
  readonly productionBudgetMs: number | null;
  /** The evaluation-only budget the call was actually sent with. */
  readonly transportBudgetMs: number;
  readonly latencyMs: number;
  readonly success: boolean;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

/** Records every provider call of one attempt, and sends a reply with the evaluation transport budget instead of production's. */
export class RecordingTransportRouter implements ModelRouter {
  readonly calls: LayerCall[] = [];

  constructor(private readonly inner: ModelRouter, private readonly replyTransportMs: number, private readonly now: () => number) {}

  async generate(request: ModelRouterRequest): Promise<ModelRouterResult> {
    const kind = request.behavioralGuidance === ATTRIBUTION_READING_INSTRUCTION ? 'READING' : 'REPLY';
    const sent = kind === 'REPLY' ? { ...request, latencyBudgetMs: this.replyTransportMs } : request;
    const record = { kind, path: request.path, productionBudgetMs: kind === 'REPLY' ? request.latencyBudgetMs : null, transportBudgetMs: sent.latencyBudgetMs } as const;
    const started = this.now();
    try {
      const result = await this.inner.generate(sent);
      this.calls.push({ ...record, latencyMs: this.now() - started, success: true, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens });
      return result;
    } catch (error) {
      this.calls.push({ ...record, latencyMs: this.now() - started, success: false, inputTokens: null, outputTokens: null });
      throw error;
    }
  }
}

export interface LayerAttemptResult {
  readonly caseId: string;
  readonly source: LayerSource;
  readonly arm: AttributionLayerArm;
  readonly repeat: number;
  readonly tier: AttributionTier;
  /** GENERATED: a reply; UNAVAILABLE: the generator produced none (provider failure, empty, withheld); ERROR: the attempt threw. */
  readonly generation: 'GENERATED' | 'UNAVAILABLE' | 'ERROR';
  readonly success: boolean;
  readonly response: string;
  readonly shape: ReplyShape | null;
  readonly productionPath: ProcessingPath | null;
  readonly productionBudgetMs: number | null;
  readonly calls: ReadonlyArray<LayerCall>;
  readonly readingState: ReadingState | null;
  readonly readingMs: number | null;
  readonly replyMs: number | null;
  /** From the start of the generation to its end: local processing, the reading (if any) and the reply. */
  readonly totalMs: number;
  readonly localMs: { readonly scanAndFacts: number; readonly verifyAndRender: number } | null;
  readonly deliveredWithinProductionBudget: boolean;
  readonly replyWithinProductionBudget: boolean;
  /** What the layer added (for the audit after un-blinding; never shown to a reviewer). */
  readonly notes: string | null;
  readonly reading: AttributionObservation['reading'];
}

export interface LayerRunDependencies {
  /** The accounted production DeepSeek router. */
  readonly router: ModelRouter;
  /** Opens the attribution scope (a fresh synthetic account) around one attempt; the key is `arm:caseId#repeat`. */
  readonly attribute: <T>(attemptKey: string, work: () => Promise<T>) => Promise<T>;
  readonly now?: () => number;
  readonly replyTransportMs?: number;
  readonly readingTransportMs?: number;
  /** Checked before every attempt: a reason to stop sending, or null. */
  readonly stopWhen?: (results: ReadonlyArray<LayerAttemptResult>) => string | null;
}

export const layerAttemptKey = (arm: AttributionLayerArm, caseId: string, repeat: number): string => `${arm}:${caseId}#${repeat}`;

/** One arm, `repeats` attempts per case, round-robin (every case once, then again), never retried. */
export async function runAttributionLayerArm(
  cases: ReadonlyArray<LayerCase>, arm: AttributionLayerArm, dependencies: LayerRunDependencies, repeats = ATTRIBUTION_LAYER_REPEATS,
): Promise<LayerAttemptResult[]> {
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 3) throw new Error('The comparison repeats each case 1 to 3 times.');
  const now = dependencies.now ?? (() => performance.now());
  const replyTransportMs = dependencies.replyTransportMs ?? ATTRIBUTION_LAYER_TRANSPORT_MS.reply;
  const readingTransportMs = dependencies.readingTransportMs ?? ATTRIBUTION_LAYER_TRANSPORT_MS.reading;
  const selected = armCases(cases, arm);
  const results: LayerAttemptResult[] = [];
  run: for (let repeat = 1; repeat <= repeats; repeat += 1) for (const testCase of selected) {
    if (dependencies.stopWhen?.(results) != null) break run;
    const conversation = layerConversation(testCase);
    const tier = scanAttribution(conversation).tier;
    let observation: AttributionObservation | undefined;
    let recorder: RecordingTransportRouter | undefined;
    let started = now();
    let generation: LayerAttemptResult['generation'] = 'ERROR';
    let response = '';
    try {
      const outcome = await dependencies.attribute(layerAttemptKey(arm, testCase.id, repeat), async () => {
        const userId = currentAiUsageAttribution()?.userId;
        if (userId === undefined) throw new Error('No attribution scope is open for this attempt.');
        const router = new RecordingTransportRouter(dependencies.router, replyTransportMs, now);
        recorder = router;
        const safety = new SafetyResponseGateService();
        const generator = arm === 'B'
          ? new PreLayerSharedReplyGenerator(router, safety)
          : new AttributionNotesReplyGenerator(router, safety, {
            mode: arm === 'S' ? 'S' : 'R_DEEP', readOn: 'ANY_RISK', reader: new ModelRouterAttributionReader(router, readingTransportMs),
            readingBudgetMs: readingTransportMs, observe: (seen) => { observation = seen; },
          });
        started = now();
        return generator.generate({ conversation, requesterUserId: userId });
      });
      generation = outcome.state;
      response = outcome.state === 'GENERATED' ? outcome.text : '';
    } catch {
      generation = 'ERROR';
    }
    const totalMs = Math.max(0, now() - started);
    const calls = recorder?.calls ?? [];
    const reply = calls.filter((call) => call.kind === 'REPLY').at(-1);
    const reading = calls.find((call) => call.kind === 'READING');
    const productionBudgetMs = reply?.productionBudgetMs ?? null;
    const success = generation === 'GENERATED';
    results.push({
      caseId: testCase.id, source: testCase.source, arm, repeat, tier, generation, success, response, shape: success ? replyShape(response) : null,
      productionPath: reply?.path ?? null, productionBudgetMs, calls,
      readingState: observation?.readingState ?? null, readingMs: reading?.latencyMs ?? null, replyMs: reply?.latencyMs ?? null, totalMs,
      localMs: observation === undefined ? null : { scanAndFacts: observation.timingsMs.scanAndFacts, verifyAndRender: observation.timingsMs.verifyAndRender },
      // A deterministic Safety reply makes no call: it is delivered at once.
      deliveredWithinProductionBudget: success && (productionBudgetMs === null || totalMs <= productionBudgetMs),
      replyWithinProductionBudget: success && (productionBudgetMs === null || (reply?.latencyMs ?? 0) <= productionBudgetMs),
      notes: observation?.notes ?? null, reading: observation?.reading ?? null,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------------------------------------------------
// Blinding: per case, every reply of every arm, shuffled by a salted hash, with no arm, tier, note, latency or route.
// ---------------------------------------------------------------------------------------------------------------------

const LEAK = /\[fact\]|\[reading\]|\bnotes?\b|\bserver\b|الخادم|ملاحظات|shared_attribution_notes/giu;
export const leakAid = (reply: string): string[] => [...new Set((reply.match(LEAK) ?? []).map((match) => match.toLowerCase()))];

export interface LayerBlindReply { readonly replyId: string; readonly reply: string | null; readonly failure: string | null; readonly aids: ReviewAids | null; readonly leakAid: ReadonlyArray<string> }
export interface LayerBlindItem {
  readonly itemId: string;
  readonly conversation: ReadonlyArray<{ readonly speaker: string; readonly text: string }>;
  readonly key: LayerKey;
  readonly replies: ReadonlyArray<LayerBlindReply>;
}
export interface LayerMapEntry { readonly replyId: string; readonly arm: AttributionLayerArm; readonly repeat: number; readonly standsForAllArms: boolean }
export const LAYER_NO_REPLY = 'No reply: the attempt failed (provider error, time budget or withheld output) and was not retried.';

export function createLayerBlindPacket(cases: ReadonlyArray<LayerCase>, results: ReadonlyArray<LayerAttemptResult>, salt: string) {
  const packet: LayerBlindItem[] = [];
  const map: Array<{ itemId: string; replies: LayerMapEntry[] }> = [];
  for (const testCase of cases) {
    const own = results.filter((result) => result.caseId === testCase.id);
    const gated = own.some((result) => result.tier > 0) || layerTier(testCase) > 0;
    const shown = own.filter((result) => gated || result.arm === 'B')
      .map((result) => ({ result, order: sha256(`${salt}\u0000${testCase.id}\u0000${result.arm}\u0000${result.repeat}`) }))
      .sort((left, right) => left.order.localeCompare(right.order));
    const conversation = layerConversation(testCase);
    const labels = sharedConversationLabels(conversation);
    packet.push({
      itemId: testCase.id,
      conversation: conversation.map((turn, index) => ({ speaker: turn.producer === 'QANDEEL' ? 'QANDEEL' : labels[index] as string, text: turn.text })),
      key: testCase.key,
      replies: shown.map(({ result }, index) => ({
        replyId: `R${index + 1}`, reply: result.success ? result.response : null, failure: result.success ? null : LAYER_NO_REPLY,
        aids: result.success ? reviewAids(result.response) : null, leakAid: result.success ? leakAid(result.response) : [],
      })),
    });
    map.push({ itemId: testCase.id, replies: shown.map(({ result }, index) => ({ replyId: `R${index + 1}`, arm: result.arm, repeat: result.repeat, standsForAllArms: !gated })) });
  }
  return { packet, map: { salt, items: map } };
}

/** One reviewer verdict on one reply. Every field starts null; only a reviewer fills it. */
export interface LayerReplyVerdict {
  readonly replyId: string;
  /** Any of: a keyed critical error; a fact or position on the wrong person; reported words presented as the person's own statement here; a false absence claim; an invented person, source or confirmed relation. */
  criticalAttributionError: boolean | null;
  errorTypes: Array<'KEYED_CRITICAL_ERROR' | 'WRONG_PERSON' | 'TRANSFER' | 'REPORTED_AS_OWN' | 'FALSE_ABSENCE' | 'INVENTED_PERSON_OR_SOURCE' | 'INVENTED_CONFIRMED_RELATION'>;
  keyedCriticalErrors: string[];
  falseAbsenceClaim: boolean | null;
  negationError: boolean | null;
  pronounError: boolean | null;
  /** A confirmation question the conversation did not need, or an abstention the key does not justify. */
  unnecessaryQuestionOrAbstention: boolean | null;
  /** Lectures, or explains the mechanism (notes, server, records) to the people. */
  mechanismOrLecture: boolean | null;
  /** Mentions notes, the server, [fact] / [reading], or the container. */
  leak: boolean | null;
  /** Anything abnormal: broken text, wrong language, truncated, off-topic. */
  abnormal: boolean | null;
  note: string;
}
export interface LayerItemReview { readonly itemId: string; readonly replies: LayerReplyVerdict[] }

export const layerReviewForm = (packet: ReadonlyArray<LayerBlindItem>): LayerItemReview[] => packet.map((item) => ({
  itemId: item.itemId,
  replies: item.replies.filter((reply) => reply.reply !== null).map((reply) => ({
    replyId: reply.replyId, criticalAttributionError: null, errorTypes: [], keyedCriticalErrors: [], falseAbsenceClaim: null, negationError: null,
    pronounError: null, unnecessaryQuestionOrAbstention: null, mechanismOrLecture: null, leak: null, abnormal: null, note: '',
  })),
}));

// ---------------------------------------------------------------------------------------------------------------------
// The measured facts per arm (no judgement) and the pre-registered scoring of the final verdicts.
// ---------------------------------------------------------------------------------------------------------------------

const percentile = (values: ReadonlyArray<number>, fraction: number): number | null => {
  if (values.length === 0) return null;
  const ordered = [...values].sort((x, y) => x - y);
  return ordered[Math.max(0, Math.ceil(fraction * ordered.length) - 1)];
};
const timing = (values: ReadonlyArray<number>) => ({ n: values.length, p50: percentile(values, 0.5), p90: percentile(values, 0.9), max: values.length ? Math.max(...values) : null });

export function measureLayerArm(results: ReadonlyArray<LayerAttemptResult>) {
  const ok = results.filter((result) => result.success);
  const states: Record<string, number> = {};
  for (const result of results) if (result.readingState !== null) states[result.readingState] = (states[result.readingState] ?? 0) + 1;
  return {
    attempts: results.length, replies: ok.length, noReply: results.length - ok.length,
    providerCalls: results.reduce((sum, result) => sum + result.calls.length, 0),
    readingCalls: results.reduce((sum, result) => sum + result.calls.filter((call) => call.kind === 'READING').length, 0),
    failedCalls: results.reduce((sum, result) => sum + result.calls.filter((call) => !call.success).length, 0),
    readingStates: states,
    readingMs: timing(results.map((result) => result.readingMs).filter((value): value is number => value !== null)),
    replyMs: timing(results.map((result) => result.replyMs).filter((value): value is number => value !== null)),
    totalMs: timing(ok.map((result) => result.totalMs)),
    deliveredWithinProductionBudget: results.filter((result) => result.deliveredWithinProductionBudget).length,
    replyWithinProductionBudget: results.filter((result) => result.replyWithinProductionBudget).length,
    productionPaths: { FAST: results.filter((result) => result.productionPath === 'FAST').length, DEEP: results.filter((result) => result.productionPath === 'DEEP').length },
  };
}

/** The pre-registered thresholds (PREREGISTRATION_ROUND10.md §5). */
export const ATTRIBUTION_LAYER_CRITERIA = {
  sVersusB: { relativeReduction: 0.4, absoluteReduction: 0.08 },
  srVersusS: { relativeReduction: 0.3, absoluteReduction: 0.05 },
  maxUnnecessaryIncrease: 0.05,
  maxRegressions: 1,
  maxDeliveryDrop: 0.05,
  lengthBand: 0.25,
  minimumBaselineCaeRate: 0.15,
  maxNoReplyShare: 0.1,
  /** A case with fewer replies than this in any arm it ran in is INCONCLUSIVE and leaves every comparison (decision §4.7). */
  minimumRepliesPerCase: 2,
} as const;

interface ScoredReply { readonly caseId: string; readonly source: LayerSource; readonly gated: boolean; readonly arm: AttributionLayerArm; readonly repeat: number; readonly characters: number; readonly verdict: LayerReplyVerdict }

/** Final verdicts (the Founder's where given, else the AI rater's) joined to arms; a tier-0 reply counts for every arm. */
export function joinLayerVerdicts(
  cases: ReadonlyArray<LayerCase>, results: ReadonlyArray<LayerAttemptResult>, map: { items: ReadonlyArray<{ itemId: string; replies: ReadonlyArray<LayerMapEntry> }> },
  verdicts: ReadonlyArray<LayerItemReview>,
): ScoredReply[] {
  const out: ScoredReply[] = [];
  for (const item of map.items) {
    const testCase = cases.find((candidate) => candidate.id === item.itemId) as LayerCase;
    const review = verdicts.find((entry) => entry.itemId === item.itemId);
    for (const entry of item.replies) {
      const result = results.find((candidate) => candidate.caseId === item.itemId && candidate.arm === entry.arm && candidate.repeat === entry.repeat);
      if (result === undefined || !result.success) continue;
      const verdict = review?.replies.find((candidate) => candidate.replyId === entry.replyId);
      if (verdict === undefined) throw new Error(`NOT SCORABLE: ${item.itemId} ${entry.replyId} has no verdict.`);
      for (const arm of entry.standsForAllArms ? ATTRIBUTION_LAYER_ARMS : [entry.arm]) {
        out.push({ caseId: item.itemId, source: testCase.source, gated: !entry.standsForAllArms, arm, repeat: entry.repeat, characters: [...result.response.trim()].length, verdict });
      }
    }
  }
  return out;
}

const share = (count: number, total: number): number | null => (total === 0 ? null : count / total);
const median = (values: ReadonlyArray<number>): number | null => percentile(values, 0.5);

function armMetrics(replies: ReadonlyArray<ScoredReply>) {
  const required = (verdict: LayerReplyVerdict) => [verdict.criticalAttributionError, verdict.falseAbsenceClaim, verdict.unnecessaryQuestionOrAbstention, verdict.mechanismOrLecture, verdict.leak];
  if (replies.some((reply) => required(reply.verdict).some((value) => value === null))) throw new Error('NOT SCORABLE: a required verdict field is still empty.');
  return {
    replies: replies.length,
    cae: replies.filter((reply) => reply.verdict.criticalAttributionError).length,
    caeRate: share(replies.filter((reply) => reply.verdict.criticalAttributionError).length, replies.length),
    falseAbsence: replies.filter((reply) => reply.verdict.falseAbsenceClaim).length,
    negationErrors: replies.filter((reply) => reply.verdict.negationError).length,
    pronounErrors: replies.filter((reply) => reply.verdict.pronounError).length,
    unnecessaryRate: share(replies.filter((reply) => reply.verdict.unnecessaryQuestionOrAbstention).length, replies.length),
    mechanismOrLecture: replies.filter((reply) => reply.verdict.mechanismOrLecture).length,
    leaks: replies.filter((reply) => reply.verdict.leak).length,
    abnormal: replies.filter((reply) => reply.verdict.abnormal).length,
    medianCharacters: median(replies.map((reply) => reply.characters)),
  };
}

/** Cases clean in every reply of `reference` (at least two) and clean in at most a third of `candidate`'s replies. */
function regressions(replies: ReadonlyArray<ScoredReply>, reference: AttributionLayerArm, candidate: AttributionLayerArm): string[] {
  const ids = [...new Set(replies.map((reply) => reply.caseId))];
  return ids.filter((caseId) => {
    const before = replies.filter((reply) => reply.caseId === caseId && reply.arm === reference);
    const after = replies.filter((reply) => reply.caseId === caseId && reply.arm === candidate);
    const clean = (rows: ReadonlyArray<ScoredReply>) => rows.filter((reply) => !reply.verdict.criticalAttributionError).length;
    return before.length >= 2 && clean(before) === before.length && after.length > 0 && clean(after) / after.length <= 1 / 3;
  });
}

export interface LayerComparison {
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly reasons: string[];
  readonly checks: Record<string, boolean>;
}

/** The pre-registered decision. Inputs: the joined final verdicts, every attempt of every arm, and whether a cap stopped the run. */
export function scoreAttributionLayer(scoredReplies: ReadonlyArray<ScoredReply>, attempts: ReadonlyArray<LayerAttemptResult>, stoppedByCap: boolean) {
  const c = ATTRIBUTION_LAYER_CRITERIA;
  const inconclusiveCases = [...new Set(attempts.map((attempt) => attempt.caseId))].filter((caseId) => ATTRIBUTION_LAYER_ARMS.some((arm) => {
    const own = attempts.filter((attempt) => attempt.caseId === caseId && attempt.arm === arm);
    return own.length > 0 && own.filter((attempt) => attempt.success).length < c.minimumRepliesPerCase;
  }));
  const replies = scoredReplies.filter((reply) => !inconclusiveCases.includes(reply.caseId));
  const gated = replies.filter((reply) => reply.gated);
  const per = (rows: ReadonlyArray<ScoredReply>) => Object.fromEntries(ATTRIBUTION_LAYER_ARMS.map((arm) => [arm, armMetrics(rows.filter((reply) => reply.arm === arm))])) as Record<AttributionLayerArm, ReturnType<typeof armMetrics>>;
  const G = per(gated);
  const heldOut = per(gated.filter((reply) => reply.source === 'HELD_OUT'));
  const all = per(replies);
  const ungated = per(replies.filter((reply) => !reply.gated));
  const gatedAttempts = (arm: AttributionLayerArm) => attempts.filter((attempt) => attempt.arm === arm && attempt.tier > 0);
  const delivery = (arm: AttributionLayerArm) => share(gatedAttempts(arm).filter((attempt) => attempt.deliveredWithinProductionBudget).length, gatedAttempts(arm).length);
  const noReplyShare = (arm: AttributionLayerArm) => share(attempts.filter((attempt) => attempt.arm === arm && !attempt.success).length, attempts.filter((attempt) => attempt.arm === arm).length) ?? 0;

  const inconclusive: string[] = [];
  if (stoppedByCap) inconclusive.push('a spend or attempt cap stopped the run before it completed');
  if ((G.B.caeRate ?? 0) < c.minimumBaselineCaeRate) inconclusive.push(`B's critical-error rate on the gated cases is below ${c.minimumBaselineCaeRate}`);
  for (const arm of ATTRIBUTION_LAYER_ARMS) if (noReplyShare(arm) > c.maxNoReplyShare) inconclusive.push(`${arm}: more than ${c.maxNoReplyShare * 100}% of attempts have no reply`);

  const compare = (base: AttributionLayerArm, test: AttributionLayerArm, thresholds: { relativeReduction: number; absoluteReduction: number }, withDelivery: boolean): LayerComparison => {
    const [b, t] = [G[base], G[test]];
    const [hb, ht] = [heldOut[base], heldOut[test]];
    const checks: Record<string, boolean> = {
      P1: b.caeRate !== null && t.caeRate !== null && t.caeRate <= b.caeRate * (1 - thresholds.relativeReduction) && b.caeRate - t.caeRate >= thresholds.absoluteReduction,
      P2: hb.caeRate !== null && ht.caeRate !== null && ht.caeRate < hb.caeRate,
      G1: t.falseAbsence <= b.falseAbsence,
      G2: b.unnecessaryRate !== null && t.unnecessaryRate !== null && t.unnecessaryRate - b.unnecessaryRate <= c.maxUnnecessaryIncrease,
      G3: regressions(gated, base, test).length <= c.maxRegressions,
      G5: t.leaks === 0 && t.mechanismOrLecture <= b.mechanismOrLecture && b.medianCharacters !== null && t.medianCharacters !== null
        && Math.abs(t.medianCharacters - b.medianCharacters) <= b.medianCharacters * c.lengthBand,
    };
    if (withDelivery) checks.G4 = (delivery(test) ?? 0) >= (delivery(base) ?? 0) - c.maxDeliveryDrop;
    const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
    return inconclusive.length > 0 ? { verdict: 'INCONCLUSIVE', reasons: inconclusive, checks }
      : { verdict: failed.length === 0 ? 'PASS' : 'FAIL', reasons: failed.map((name) => `${name} not met`), checks };
  };

  const residual = replies.filter((reply) => reply.verdict.criticalAttributionError)
    .map((reply) => ({ caseId: reply.caseId, arm: reply.arm, repeat: reply.repeat, gated: reply.gated, errorTypes: reply.verdict.errorTypes, note: reply.verdict.note }));
  return {
    sVersusB: compare('B', 'S', c.sVersusB, true),
    srVersusS: compare('S', 'S_R', c.srVersusS, false),
    metrics: { gated: G, heldOutGated: heldOut, ungated, all48: all },
    inconclusiveCases,
    regressions: { sVersusB: regressions(gated, 'B', 'S'), srVersusS: regressions(gated, 'S', 'S_R') },
    deliveryWithinProductionBudget: Object.fromEntries(ATTRIBUTION_LAYER_ARMS.map((arm) => [arm, delivery(arm)])),
    residualCriticalErrors: residual,
    abnormalReplies: replies.filter((reply) => reply.verdict.abnormal).map((reply) => ({ caseId: reply.caseId, arm: reply.arm, repeat: reply.repeat, note: reply.verdict.note })),
  };
}
