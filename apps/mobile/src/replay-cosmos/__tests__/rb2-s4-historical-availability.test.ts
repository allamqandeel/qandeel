/**
 * RB-2 / S4-C / S4-D (PO S4 execution directive, 2026-11-24) — Lane A (COMMITTED_KNOWLEDGE) on the Replay's ONE
 * presentation clock: S3's answer, bound by the phone (S4-B), mapped onto the clock and consumed by the timeline.
 *
 *   disclosedAt(k) = max( availability(k), windowStart(k), completeAt(k), disclosedAt(k − 1) )
 *
 * Proven here on SYNTHETIC answers over the CP1-B synthetic world (no customer content, no recording): never before
 * availableAt, completeAt or windowStart; overlapping windows; causal frames; pause, seek and restart as pure functions of
 * presentation time; RANGE openings drawn only from certified knowledge; a shortened HELD; a second recording.
 *
 * S4-CORRECTION-01 (the Product Owner's decision of 2026-11-24 on PR #413, superseding S4's display policy): eligible
 * historical analysis is SHOWN whether or not its instant is certified. A certified instant places it exactly; AFTER_END,
 * UNESTABLISHED, BROKEN, ORDINAL_ONLY, a missing moment, an answer pending, refused or unavailable, no source, no map —
 * each is placed by SOURCE ORDER (after its own speech, after the knowledge before it, labelled non-exact), never blank.
 * NOT_FOUND (not this person's current version) alone is the NEUTRAL stage. The last speech's knowledge is the CLOSING
 * display at the presentation's end. V1 / text-only keep their ordinal pacing, labelled as such. Before the correction,
 * every one of those cases was the neutral stage (the previous pins are quoted where they changed).
 */
import { CROSS, MOMENTS, REPLAY, RUN0, RUN1, VERSION, moment, pace } from '../../original-audio/__fixtures__/replay-audio-world';
import { planFor } from '../../original-audio/replay-audio-clock';
import { decodeReplayAvailability, type ReplayAvailability } from '../../original-audio/replay-availability';
import type { ReplayAvailabilitySourceState } from '../../original-audio/replay-availability-source';
import { readingPaceMs } from '../../replay-player';
import type { ReplayHistoryMoment } from '../../runtime-entry';
import { buildReplayCameraPlan, planFutureViolations } from '../camera-plan';
import { replayFrameFacts } from '../frame';
import { replayPresentationClock, replayStageTime, withReplayAvailability, type ReplayPresentationClock } from '../presentation-clock';
import { replayStageTimeline, type ReplayStageTimeline } from '../stage-timeline';
import { marksOf } from '../stages';
import {
  buildReplayCosmosTimeline, causalFrame, knowledgeAt, knowledgeOnFrame, UNRECORDED_AVAILABILITY, UNRECORDED_IN_CERTIFIED,
  type ReplayCosmosTimeline, type ReplayScope,
} from '../timeline';
import { STAGES, VIEW, sceneOf } from '../__fixtures__/synthetic-history';

const FPS = 30;
const FULL: ReplayScope = { kind: 'FULL' };
const paceOf = (m: ReplayHistoryMoment): number => readingPaceMs(m.text ?? '');
const PLAN = planFor(MOMENTS, [{ durationMs: 9_000, spans: RUN0 }, { durationMs: 5_000, spans: RUN1 }], [CROSS])!;
const CLOCK: ReplayPresentationClock = replayPresentationClock(PLAN, MOMENTS, paceOf)!;
// 1 TEXT [0, R0) · RUN 0 [R0, R0+9000): 2 USER [R0, R0+6000), 3 (+4) QANDEEL [R0+4000, R0+9000) · 5 TEXT · PAUSE · RUN 1 [R1, R1+5000): 6
const R0 = pace('first');
const R1 = R0 + 9_000 + pace('fifth') + 1_500;
const DIGEST = `sha256:${'a'.repeat(64)}`;

type Placement = { kind: 'IN_RECORDING'; runIndex: number; fileMs: number } | { kind: 'AFTER_END' } | 'UNESTABLISHED' | 'BROKEN' | 'ORDINAL_ONLY';
/** A SYNTHETIC S3 answer, decoded as the phone decodes it (the binding itself is S4-B's suite). */
function answer(placements: Record<number, Placement>): ReplayAvailability {
  const moments = Object.entries(placements).map(([ordinal, p]) => (typeof p === 'string'
    ? { ordinal: Number(ordinal), state: p, placement: null }
    : { ordinal: Number(ordinal), state: 'RECORDED', placement: p }));
  const decoded = decodeReplayAvailability({
    replayId: REPLAY, versionId: VERSION, revision: 1, sourceWindowBindingDigest: DIGEST, mapDigest: DIGEST, ledgerWatermark: { sp: 4, seq: 1 }, moments,
  }, { replayId: REPLAY, versionId: VERSION, runs: PLAN.runs });
  if (decoded === null) throw new Error('synthetic answer refused');
  return decoded;
}
const run0 = (fileMs: number): Placement => ({ kind: 'IN_RECORDING', runIndex: 0, fileMs });
const run1 = (fileMs: number): Placement => ({ kind: 'IN_RECORDING', runIndex: 1, fileMs });
/** The certified scenario: 2's analysis later than its speech; 3's earlier than QANDEEL finished; 6 at the very end. */
const CERTIFIED: Record<number, Placement> = { 1: run0(200), 2: run0(6_400), 3: run0(8_000), 4: run0(9_000), 5: run0(9_000), 6: run1(5_000) };
const bound = (placements: Record<number, Placement>): ReplayAvailabilitySourceState => ({ kind: 'BOUND', answer: answer(placements) });
const stage = (availability: ReplayAvailabilitySourceState | null, scope: ReplayScope = FULL, presentation: ReplayPresentationClock | null = CLOCK): ReplayStageTimeline =>
  replayStageTimeline(CLOCK.inputs, scope, { kind: 'AUDIO', presentation, availability }, FPS)!;
const certified = (placements: Record<number, Placement> = CERTIFIED, scope: ReplayScope = FULL): ReplayCosmosTimeline => {
  const s = stage(bound(placements), scope);
  expect(s.kind).toBe('CERTIFIED');
  return s.timeline;
};
const expectNeutral = (s: ReplayStageTimeline) => {
  expect(s.kind).toBe('NEUTRAL');
  expect(s.timeline.steps).toEqual([]);
  expect(s.timeline.initialOrdinal).toBeNull();
  expect(s.timeline.afterEnd).toEqual([]);
  expect(s.timeline.availabilityEstablished).toBe(false);
  for (let t = 0; t <= s.timeline.durationMs; t += 250) expect(knowledgeAt(s.timeline, t)).toBeNull();
};

describe('S4-C · IN_RECORDING mapped onto the presentation clock, AT OR AFTER', () => {
  it('is the run\'s start plus the file position the server placed — exact, in either recording', () => {
    const inputs = withReplayAvailability(CLOCK, answer(CERTIFIED));
    const at = (o: number) => inputs.find((m) => m.ordinal === o)!.availability;
    expect(at(2)).toEqual({ kind: 'RECORDED', atMs: R0 + 6_400 });
    expect(at(6)).toEqual({ kind: 'RECORDED', atMs: R1 + 5_000 });
    expect(withReplayAvailability(CLOCK, answer({ ...CERTIFIED, 6: { kind: 'AFTER_END' } })).at(-1)!.availability).toEqual({ kind: 'AFTER_END' });
    // Only the availability changes: the windows and completions are the clock's own.
    expect(inputs.map(({ availability: _a, ...rest }) => rest)).toEqual(CLOCK.inputs.map(({ availability: _a, ...rest }) => rest));
  });

  it('a shortened HELD: a position the server moved to the HELD\'s end is used as it is, never earlier', () => {
    const moments = [moment(1, 'ORIGINAL_AUDIO', null), moment(2, 'ORIGINAL_AUDIO', null, 'ASSISTANT')];
    const plan = planFor(moments, [{ durationMs: 9_000, spans: [
      { kind: 'WINDOW', fromMs: 0, toMs: 6_000, track: 'USER', momentOrdinal: 1 },
      { kind: 'HELD', fromMs: 6_000, toMs: 7_500, elapsedMs: 16_000, shortened: true },
      { kind: 'WINDOW', fromMs: 7_500, toMs: 9_000, track: 'QANDEEL', momentOrdinal: 2 },
    ] }], [])!;
    const clock = replayPresentationClock(plan, moments, paceOf)!;
    const held = decodeReplayAvailability({
      replayId: REPLAY, versionId: VERSION, revision: 1, sourceWindowBindingDigest: DIGEST, mapDigest: DIGEST, ledgerWatermark: { sp: 2, seq: 0 },
      moments: [{ ordinal: 1, state: 'RECORDED', placement: { kind: 'IN_RECORDING', runIndex: 0, fileMs: 7_500 } }, { ordinal: 2, state: 'RECORDED', placement: { kind: 'AFTER_END' } }],
    }, { replayId: REPLAY, versionId: VERSION, runs: plan.runs })!;
    const tl = replayStageTimeline(clock.inputs, FULL, { kind: 'AUDIO', presentation: clock, availability: { kind: 'BOUND', answer: held } }, FPS)!;
    // S4-CORRECTION-01 RE-ANCHOR: moment 2 is AFTER_END, so the stage is SOURCE_ORDER (previous pin: CERTIFIED with 2 in
    // `afterEnd`); 1's certified position is kept as it is, and 2 completes at the recording's end: the closing knowledge.
    expect(tl.kind).toBe('SOURCE_ORDER');
    expect(tl.timeline.steps.map((s) => [s.ordinal, s.atMs, s.availability])).toEqual([[1, 7_500, 'RECORDED']]);
    expect(tl.timeline.afterEnd).toEqual([]);
    expect(tl.timeline.closing).toEqual([2]);
  });
});

describe('S4-C · the certified timeline: NO ANALYSIS BEFORE SPEECH, never before its availability', () => {
  it('each disclosure is the latest of its availability, its window start, its completion and the one before', () => {
    const tl = certified();
    expect(tl.availabilityEstablished).toBe(true);
    expect(tl.steps.map((s) => [s.ordinal, s.atMs, s.availability, s.heldByGuardMs])).toEqual([
      [1, R0 + 200, 'RECORDED', 0],
      [2, R0 + 6_400, 'RECORDED', 0], // available after USER finished speaking (R0 + 6000): the availability decides
      [3, R0 + 9_000, 'RECORDED', 1_000], // available at R0 + 8000, while QANDEEL still spoke: held to its window's end
      [4, R0 + 9_000, 'RECORDED', 0],
      [5, R0 + 9_000, 'RECORDED', 0],
    ]);
    expect(tl.afterEnd).toEqual([]);
    expect(tl.closing).toEqual([6]); // completes at the very end: never pulled into the last frame; the closing knowledge (S4-CORRECTION-01)
    const inputs = withReplayAvailability(CLOCK, answer(CERTIFIED));
    for (const s of tl.steps) {
      const m = inputs.find((i) => i.ordinal === s.ordinal)!;
      const a = m.availability.kind === 'RECORDED' ? m.availability.atMs : Infinity;
      expect(s.atMs).toBeGreaterThanOrEqual(Math.max(a, m.windowStartMs, m.completeAtMs));
    }
  });

  it('overlapping speakers: QANDEEL\'s moment waits for its own window\'s end, after the USER moment it overlaps', () => {
    const tl = certified({ ...CERTIFIED, 2: run0(5_000) }); // 2's analysis "available" before USER finished: held to R0 + 6000
    expect(tl.steps.find((s) => s.ordinal === 2)).toMatchObject({ atMs: R0 + 6_000, heldByGuardMs: 1_000 });
    expect(tl.steps.find((s) => s.ordinal === 3)!.atMs).toBe(R0 + 9_000);
    expect(tl.windows.filter((w) => w.ordinal === 2 || w.ordinal === 3)).toEqual([
      { ordinal: 2, startMs: R0, endMs: R0 + 6_000 }, { ordinal: 3, startMs: R0 + 4_000, endMs: R0 + 9_000 },
    ]);
  });

  it('a late availability is never drawn early; a moment after it waits for it (monotonic)', () => {
    const tl = certified({ ...CERTIFIED, 2: run1(1_000) }); // 2 certified only in the second recording
    expect(tl.steps.map((s) => [s.ordinal, s.atMs])).toEqual([[1, R0 + 200], [2, R1 + 1_000], [3, R1 + 1_000], [4, R1 + 1_000], [5, R1 + 1_000]]);
    expect(knowledgeAt(tl, R1 + 999)).toBe(1);
    expect(knowledgeAt(tl, R1 + 1_000)).toBe(5);
  });

  it('frames are causal at 30 fps: first drawn on the first frame at or after its time', () => {
    const tl = certified();
    for (const s of tl.steps) {
      expect((s.frame * 1000) / FPS).toBeGreaterThanOrEqual(s.atMs - 1e-6);
      expect(((s.frame - 1) * 1000) / FPS).toBeLessThan(s.atMs);
      expect(knowledgeOnFrame(tl, s.frame - 1)).not.toBe(s.ordinal);
    }
  });

  it('play, pause, backward and forward seek, restart: the knowledge at t is a pure function of t', () => {
    const tl = certified();
    const truth = (t: number) => tl.steps.filter((s) => s.atMs <= t).at(-1)?.ordinal ?? tl.initialOrdinal;
    const visits = [0, 1_000, R0 + 6_399, R0 + 6_400, R0 + 6_400, 2_000, R0 + 9_000, R0 + 100, R1 + 4_999, 0, R0 + 8_999, R0 + 9_000];
    for (const t of visits) expect(knowledgeAt(tl, t)).toBe(truth(t));
    // A restart builds the identical timeline, frame for frame.
    expect(certified()).toEqual(tl);
    const scene = sceneOf(tl);
    for (const t of visits) expect(JSON.stringify(replayFrameFacts(scene, t))).toBe(JSON.stringify(replayFrameFacts(sceneOf(certified()), t)));
    expect(planFutureViolations(scene.plan, tl, STAGES)).toEqual([]);
  });
});

describe('S4-C · Selection / RANGE: the opening knowledge is certified knowledge only', () => {
  it('opens on the latest moment certified at or before its start, and keeps every later disclosure', () => {
    const tl = certified(CERTIFIED, { kind: 'RANGE', startMs: R0 + 7_000, endMs: R1 });
    expect(tl.initialOrdinal).toBe(2);
    expect(tl.steps.map((s) => [s.ordinal, s.atMs])).toEqual([[3, 2_000], [4, 2_000], [5, 2_000]]);
  });

  it('a range starting before a moment\'s availability does not open on it, even after its speech has ended', () => {
    const tl = certified(CERTIFIED, { kind: 'RANGE', startMs: R0 + 6_200, endMs: R1 });
    expect(tl.initialOrdinal).toBe(1); // 2's speech ended at R0 + 6000, but its analysis was available only at R0 + 6400
    expect(tl.steps[0]).toMatchObject({ ordinal: 2, atMs: 200 });
  });

  it('a range ending before a disclosure lists it after the end; its last frame does not draw it', () => {
    const tl = certified(CERTIFIED, { kind: 'RANGE', startMs: 0, endMs: R0 + 6_400 });
    expect(tl.afterEnd).toEqual([2, 3, 4, 5, 6]);
    const last = Math.ceil((tl.durationMs * FPS) / 1000) - 1;
    expect(knowledgeOnFrame(tl, last)).toBe(1);
  });
});

describe('S4-CORRECTION-01 (PO, 2026-11-24, PR #413) · eligible analysis is shown; certification places it and never gates it', () => {
  const NON_EXACT = 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY';
  /** Where source order alone places each moment: after its own speech (an audio window's END), after the knowledge before it. */
  const SOURCE_ORDER_STEPS: [number, number, string][] = [[2, R0 + 6_000, NON_EXACT], [3, R0 + 9_000, NON_EXACT], [4, R0 + 9_000, NON_EXACT], [5, R0 + 9_000, NON_EXACT]];
  const everyMoment = (p: Placement): Record<number, Placement> => Object.fromEntries([1, 2, 3, 4, 5, 6].map((o) => [o, p]));
  /** VISIBLY drawn at t: the frame names knowledge, and that knowledge's stage has marks on the map. */
  const drawnAt = (tl: ReplayCosmosTimeline, t: number): boolean => {
    const facts = replayFrameFacts(sceneOf(tl), t);
    return facts.knowledge !== null && marksOf(STAGES.get(facts.knowledge)!.list).threads.length > 0;
  };
  const neverBeforeSpeech = (tl: ReplayCosmosTimeline, inputs = CLOCK.inputs) => {
    let previous = -Infinity;
    for (const s of tl.steps) {
      const m = inputs.find((i) => i.ordinal === s.ordinal)!;
      expect(s.atMs).toBeGreaterThanOrEqual(Math.max(m.windowStartMs, m.completeAtMs, previous));
      previous = s.atMs;
    }
  };
  const expectSourceOrderMap = (s: ReplayStageTimeline, reason: string) => {
    expect(s.kind).toBe('SOURCE_ORDER');
    expect(s.reason).toBe(reason);
    expect(s.timeline.initialOrdinal).toBe(1);
    expect(s.timeline.steps.map((x) => [x.ordinal, x.atMs, x.availability])).toEqual(SOURCE_ORDER_STEPS);
    expect(s.timeline.steps.every((x) => x.heldByGuardMs === null)).toBe(true);
    expect(s.timeline.closing).toEqual([6]);
    expect(s.timeline.afterEnd).toEqual([]);
    expect(s.timeline.availabilityEstablished).toBe(false);
    expect(s.timeline.unrecorded).toEqual([1, 2, 3, 4, 5, 6]);
    // The same clock and windows as the certified stage: only the placement differs, and it is labelled.
    expect(s.timeline.windows).toEqual(certified().windows);
    expect(s.timeline.durationMs).toBe(CLOCK.durationMs);
    neverBeforeSpeech(s.timeline);
    // The acceptance: the map is DRAWN — not a blank stage for want of a certificate.
    expect(drawnAt(s.timeline, R0 + 6_000)).toBe(true);
    expect(drawnAt(s.timeline, s.timeline.durationMs - 1)).toBe(true);
    expect(planFutureViolations(sceneOf(s.timeline).plan, s.timeline, STAGES)).toEqual([]);
  };

  it.each(['UNESTABLISHED', 'BROKEN', 'ORDINAL_ONLY'] as const)('Case B · valid history, %s on every moment: SOURCE_ORDER, the map is drawn (previous pin: neutral)', (state) => {
    expectSourceOrderMap(stage(bound(everyMoment(state))), UNRECORDED_IN_CERTIFIED);
  });

  it('Case E · iOS: AFTER_END on every moment (no certified position, fail-closed) is the same drawn map, never a blank Replay', () => {
    const s = stage(bound(everyMoment({ kind: 'AFTER_END' })));
    expectSourceOrderMap(s, UNRECORDED_IN_CERTIFIED);
    expect(s.timeline.steps.some((x) => x.availability === 'RECORDED')).toBe(false); // nothing is passed off as certified
  });

  it.each(['UNESTABLISHED', 'BROKEN', 'ORDINAL_ONLY', { kind: 'AFTER_END' }] as const)('Case C · mixed: %s on one moment keeps every certified instant exactly; only that moment is placed by its speech (previous pin: neutral)', (p) => {
    const s = stage(bound({ ...CERTIFIED, 4: p }));
    expect(s.kind).toBe('SOURCE_ORDER');
    expect(s.reason).toBe(UNRECORDED_IN_CERTIFIED);
    const exact = certified();
    expect(s.timeline.steps.map((x) => [x.ordinal, x.atMs])).toEqual(exact.steps.map((x) => [x.ordinal, x.atMs]));
    expect(s.timeline.steps.map((x) => x.availability)).toEqual(['RECORDED', 'RECORDED', 'RECORDED', NON_EXACT, 'RECORDED']);
    expect(s.timeline.unrecorded).toEqual([4]);
    expect(s.timeline.closing).toEqual([6]);
    expect(drawnAt(s.timeline, R0 + 9_000)).toBe(true);
  });

  it('Case C · an uncertified moment is never moved by a certified neighbour: by its speech, the certified ones as recorded', () => {
    const s = stage(bound({ ...CERTIFIED, 2: 'BROKEN' }));
    expect(s.timeline.steps.map((x) => [x.ordinal, x.atMs, x.availability, x.heldByGuardMs])).toEqual([
      [1, R0 + 200, 'RECORDED', 0],
      [2, R0 + 6_000, NON_EXACT, null], // the USER's speech ends here; no certified instant (it would have been R0 + 6400): labelled
      [3, R0 + 9_000, 'RECORDED', 1_000],
      [4, R0 + 9_000, 'RECORDED', 0],
      [5, R0 + 9_000, 'RECORDED', 0],
    ]);
    neverBeforeSpeech(s.timeline);
  });

  it('Case D · AFTER_END on one moment erases nothing before it and suppresses nothing after it (previous pin: 2 … 6 never drawn)', () => {
    const s = stage(bound({ ...CERTIFIED, 2: { kind: 'AFTER_END' } }));
    expect(s.kind).toBe('SOURCE_ORDER');
    expect(s.timeline.steps.map((x) => [x.ordinal, x.atMs, x.availability])).toEqual([
      [1, R0 + 200, 'RECORDED'], [2, R0 + 6_000, NON_EXACT], [3, R0 + 9_000, 'RECORDED'], [4, R0 + 9_000, 'RECORDED'], [5, R0 + 9_000, 'RECORDED'],
    ]);
    expect(s.timeline.closing).toEqual([6]);
    expect(knowledgeAt(s.timeline, s.timeline.durationMs)).toBe(6);
    const last = Math.ceil((s.timeline.durationMs * FPS) / 1000) - 1;
    expect(knowledgeOnFrame(s.timeline, last)).toBe(5);
  });

  it('a moment the answer does not name is placed by source order, the rest as certified (previous pin: neutral)', () => {
    const { 3: _omitted, ...rest } = CERTIFIED;
    const s = stage(bound(rest));
    expect(s.kind).toBe('SOURCE_ORDER');
    expect(s.timeline.steps.find((x) => x.ordinal === 3)).toMatchObject({ atMs: R0 + 9_000, availability: NON_EXACT });
    expect(s.timeline.steps.find((x) => x.ordinal === 2)).toMatchObject({ atMs: R0 + 6_400, availability: 'RECORDED' });
  });

  it('the closing display: the last speech\'s knowledge is drawn at the presentation\'s end and not one frame before', () => {
    const tl = certified();
    expect(tl.closing).toEqual([6]);
    expect(tl.afterEnd).toEqual([]);
    expect(knowledgeAt(tl, tl.durationMs - 1)).toBe(5);
    expect(knowledgeAt(tl, tl.durationMs)).toBe(6);
    const last = Math.ceil((tl.durationMs * FPS) / 1000) - 1;
    expect(knowledgeOnFrame(tl, last)).toBe(5);
    expect(knowledgeOnFrame(tl, causalFrame(tl.durationMs, FPS))).toBe(6);
    expect(drawnAt(tl, tl.durationMs)).toBe(true);
    // A scope that ends AT the presentation's end closes on it too; one that ends before lists it after its end, undrawn.
    expect(certified(CERTIFIED, { kind: 'RANGE', startMs: R0 + 7_000, endMs: CLOCK.durationMs }).closing).toEqual([6]);
    const cut = certified(CERTIFIED, { kind: 'RANGE', startMs: R0 + 7_000, endMs: R1 + 4_000 });
    expect(cut.closing).toEqual([]);
    expect(cut.afterEnd).toEqual([6]);
    // The camera plan is the plan of what is drawn inside the Replay: the closing knowledge adds no segment.
    expect(buildReplayCameraPlan(tl, STAGES, VIEW)).toEqual(buildReplayCameraPlan({ ...tl, closing: [] }, STAGES, VIEW));
  });

  it('in the app: the clock\'s end report on the last moment is the END time; a report on an earlier run, or for another moment, is not', () => {
    expect(replayStageTime(CLOCK, 6, { phase: 'DONE', ordinal: 6, place: { kind: 'RUN', runIndex: 1, positionMs: 5_000 } })).toEqual({ kind: 'END', t: CLOCK.durationMs });
    expect(replayStageTime(CLOCK, 6, { phase: 'DONE', ordinal: 6, place: null })).toEqual({ kind: 'END', t: CLOCK.durationMs });
    expect(replayStageTime(CLOCK, 4, { phase: 'DONE', ordinal: 4, place: { kind: 'RUN', runIndex: 0, positionMs: 9_000 } }).kind).toBe('AUDIO');
    expect(replayStageTime(CLOCK, 6, { phase: 'DONE', ordinal: 2, place: { kind: 'RUN', runIndex: 0, positionMs: 9_000 } })).toEqual({ kind: 'AT', t: R1 });
    expect(replayStageTime(CLOCK, 6, { phase: 'RUNNING', ordinal: 6, place: { kind: 'RUN', runIndex: 1, positionMs: 5_000 } }).kind).toBe('AUDIO');
  });

  it('play, pause, backward and forward seek, restart on a source-order timeline: the knowledge at t is a pure function of t', () => {
    const build = () => stage(bound({ ...CERTIFIED, 2: 'UNESTABLISHED', 4: { kind: 'AFTER_END' } })).timeline;
    const tl = build();
    const truth = (t: number) => (t >= tl.durationMs && tl.closing.length > 0 ? tl.closing.at(-1) : tl.steps.filter((s) => s.atMs <= t).at(-1)?.ordinal ?? tl.initialOrdinal);
    const visits = [0, 1_000, R0 + 5_999, R0 + 6_000, R0 + 6_000, 2_000, R0 + 9_000, R0 + 100, R1 + 4_999, tl.durationMs, 0, R0 + 8_999, R0 + 9_000];
    for (const t of visits) expect(knowledgeAt(tl, t)).toBe(truth(t));
    expect(build()).toEqual(tl);
    const scene = sceneOf(tl);
    for (const t of visits) expect(JSON.stringify(replayFrameFacts(scene, t))).toBe(JSON.stringify(replayFrameFacts(sceneOf(build()), t)));
    expect(planFutureViolations(scene.plan, tl, STAGES)).toEqual([]);
    neverBeforeSpeech(tl);
  });

  it('Case F · NOT_FOUND (revoked, deleted, retired, replaced) is the one neutral answer: no opening, no snapshot, no closing', () => {
    const s = stage({ kind: 'NOT_FOUND' });
    expectNeutral(s);
    expect(s.reason).toBe('NOT_FOUND');
    expect(s.timeline.closing).toEqual([]);
    expectNeutral(stage({ kind: 'NOT_FOUND' }, FULL, null)); // before the map is held, too
    expectNeutral(stage({ kind: 'NOT_FOUND' }, { kind: 'RANGE', startMs: R0 + 9_500, endMs: R1 }));
  });

  it('a timing gap is never neutral: pending, refused (every reason), unavailable, no source, no map are source order (previous pin: neutral)', () => {
    const gaps: [ReplayAvailabilitySourceState | null, string][] = [
      [{ kind: 'PENDING' }, 'PENDING'], [{ kind: 'UNAVAILABLE' }, 'UNAVAILABLE'], [null, 'NO_AVAILABILITY_SOURCE'],
      [{ kind: 'REFUSED', reason: 'MALFORMED' }, 'REFUSED:MALFORMED'], [{ kind: 'REFUSED', reason: 'MAP_UNREADABLE' }, 'REFUSED:MAP_UNREADABLE'],
      [{ kind: 'REFUSED', reason: 'REVISION_MISMATCH' }, 'REFUSED:REVISION_MISMATCH'], [{ kind: 'REFUSED', reason: 'MAP_DIGEST_MISMATCH' }, 'REFUSED:MAP_DIGEST_MISMATCH'],
      [{ kind: 'REFUSED', reason: 'SOURCE_WINDOWS_UNBOUND' }, 'REFUSED:SOURCE_WINDOWS_UNBOUND'], [{ kind: 'REFUSED', reason: 'SOURCE_WINDOWS_CHANGED' }, 'REFUSED:SOURCE_WINDOWS_CHANGED'],
      [{ kind: 'REFUSED', reason: 'WATERMARK_REGRESSED' }, 'REFUSED:WATERMARK_REGRESSED'], [{ kind: 'REFUSED', reason: 'MOMENTS_MISMATCH' }, 'REFUSED:MOMENTS_MISMATCH'],
    ];
    for (const [a, reason] of gaps) expectSourceOrderMap(stage(a), reason);
    // No map yet: the paced windows the world lays out, in source order (the world holds t at the moment shown).
    const noMap = stage(bound(CERTIFIED), FULL, null);
    expect(noMap.kind).toBe('SOURCE_ORDER');
    expect(noMap.reason).toBe('NO_MAP');
    expect(noMap.timeline.steps.length).toBeGreaterThan(0);
    // A refused or stale answer is never used for placement: no certified instant survives it.
    expect(stage({ kind: 'REFUSED', reason: 'REVISION_MISMATCH' }).timeline.steps.some((x) => x.availability === 'RECORDED')).toBe(false);
  });

  it('a neutral scene draws the empty stage at every t, with a camera that aims at nothing ahead', () => {
    const tl = stage({ kind: 'NOT_FOUND' }).timeline;
    const scene = sceneOf(tl);
    for (let t = 0; t <= tl.durationMs; t += 500) expect(replayFrameFacts(scene, t).knowledge).toBeNull();
    expect(planFutureViolations(scene.plan, tl, STAGES)).toEqual([]);
  });

  it('the source-order policy is never availability evidence: CERTIFIED refuses it (UNRECORDED and AFTER_END alike), and it is never labelled RECORDED', () => {
    expect(buildReplayCosmosTimeline(CLOCK.inputs, FULL, { fps: FPS, mode: 'CERTIFIED', durationMs: CLOCK.durationMs }))
      .toEqual({ ok: false, reason: UNRECORDED_IN_CERTIFIED });
    expect(buildReplayCosmosTimeline(withReplayAvailability(CLOCK, answer({ ...CERTIFIED, 5: { kind: 'AFTER_END' } })), FULL, { fps: FPS, mode: 'CERTIFIED', durationMs: CLOCK.durationMs }))
      .toEqual({ ok: false, reason: UNRECORDED_IN_CERTIFIED });
    const guards = buildReplayCosmosTimeline(CLOCK.inputs, FULL, { fps: FPS, mode: 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY', durationMs: CLOCK.durationMs });
    if (!guards.ok) throw new Error(guards.reason);
    expect(guards.timeline.availabilityEstablished).toBe(false);
    expect(new Set(guards.timeline.steps.map((s) => s.availability))).toEqual(new Set([NON_EXACT]));
  });
});

describe('S4-D · V1 and text-only: ordinal pacing, labelled, unchanged', () => {
  it('no audio clock: the pre-RB-2 guards over the reading pace, exactly as buildReplayCosmosTimeline gave them', () => {
    const inputs = [1, 2, 3].map((ordinal) => ({
      ordinal, tc: ordinal, windowStartMs: (ordinal - 1) * 4000, windowEndMs: ordinal * 4000, completeAtMs: (ordinal - 1) * 4000, availability: UNRECORDED_AVAILABILITY,
    }));
    const s = replayStageTimeline(inputs, FULL, { kind: 'TEXT_ONLY' }, FPS)!;
    expect(s.kind).toBe('ORDINAL_ONLY');
    const direct = buildReplayCosmosTimeline(inputs, FULL, { fps: FPS, mode: 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY' });
    expect(direct.ok && s.timeline).toEqual(direct.ok ? direct.timeline : null);
    expect(s.timeline.availabilityEstablished).toBe(false);
    expect(s.timeline.steps.map((x) => [x.ordinal, x.atMs, x.availability])).toEqual([
      [2, 4000, 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY'], [3, 8000, 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY'],
    ]);
  });
});
