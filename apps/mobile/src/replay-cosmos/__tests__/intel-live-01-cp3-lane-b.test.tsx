/**
 * INTEL-LIVE-01 CP3 (D-CP3, PO 2026-11-26) — Lane B of the Replay end to end, on synthetic data only: the bound attention
 * answer on the presentation clock (anchor and floor as the server placed them, hold offsets, the closing display), the
 * live owner's own fold of the marks, the stage drawn through the production chain, and the frame. Proven here:
 *   C1  a Replay without Lane B draws exactly what it drew before CP3 (a pinned golden of frames and facts, computed on the
 *       pre-CP3 code and on this code: equal), and an answer with no event adds no lane;
 *   C2 / C9  placement at the server-produced floor (hold offset kept), never at the anchor alone;
 *   C4  the live order: the same events fed to the live layer give the same marks at each step;
 *   C5  a refused or ineligible lane is no lane: Lane A's frames are untouched;
 *   C6  the export's facts: `attentionOnFrame` equals the in-app state at equal frames.
 */
import { createHash } from 'node:crypto';
import { Canvas } from '@shopify/react-native-skia';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ProvisionalAttention } from '../../call/provisional-attention';
import type { AttentionMark } from '../../cosmos/core/stage';
import { attentionMarksOf } from '../../cosmos/product/owners/personal';
import { prepareStage } from '../../cosmos/skia/prepare';
import { CROSS, MOMENTS, REPLAY, RUN0, RUN1, VERSION, moment, pace } from '../../original-audio/__fixtures__/replay-audio-world';
import { planFor } from '../../original-audio/replay-audio-clock';
import { decodeReplayAttention } from '../../original-audio/replay-attention';
import type { ReplayAttentionSourceState } from '../../original-audio/replay-attention-source';
import { presentationMapDigest } from '../../original-audio/replay-availability';
import { readingPaceMs } from '../../replay-player';
import type { ReplayHistoryMoment } from '../../runtime-entry';
import { replayAttentionLane, replayAttentionMarks, type ReplayAttentionTimeline } from '../attention-lane';
import { buildReplayCameraPlan } from '../camera-plan';
import { attentionAt, attentionOnFrame } from '../event-track';
import { replayCosmosFrame, replayFrameFacts, type ReplayCosmosScene, type ReplayFrameAttention, type ReplayFrameStage } from '../frame';
import { replayPresentationClock, type ReplayPresentationClock } from '../presentation-clock';
import { replayStageTimeline } from '../stage-timeline';
import { emptyReplayStage, replayAttentionStage, type ReplayMomentStage } from '../stages';
import { buildReplayCosmosTimeline, causalFrame, type ReplayCosmosTimeline } from '../timeline';
import { STAGES, VIEW, sceneOf } from '../__fixtures__/synthetic-history';

const FPS = 30;
const paceOf = (m: ReplayHistoryMoment): number => readingPaceMs(m.text ?? '');
const PLAN = planFor(MOMENTS, [{ durationMs: 9_000, spans: RUN0 }, { durationMs: 5_000, spans: RUN1 }], [CROSS])!;
const CLOCK = replayPresentationClock(PLAN, MOMENTS, paceOf)!;
const MAP_DIGEST = presentationMapDigest(PLAN.runs, PLAN.boundaries)!;
const R0 = pace('first');
const R1 = R0 + 9_000 + pace('fifth') + 1_500;
const SOURCE_WINDOWS = `sha256:${'c'.repeat(64)}`;

type Wire = Record<string, unknown>;
const produced = (runIndex: number, fileMs: number) => ({ kind: 'IN_RECORDING', runIndex, fileMs, basis: 'PRODUCED_POSITION' });
const subject = (track: string, subjectKey: string, label: string, kind: string, confidence: string, threadRef: string | null = null) => ({ track, subjectKey, label, kind, confidence, threadRef });
const EVENTS: Wire[] = [
  { call: 1, seq: 1, op: 'SET', ...subject('USER', 'manager', 'manager', 'PERSON', 'HIGH'), anchor: { runIndex: 0, fileMs: 1_200 }, floor: produced(0, 1_900) },
  { call: 1, seq: 2, op: 'SET', ...subject('QANDEEL', 'plan', 'the plan', 'PLAN', 'MEDIUM'), anchor: { runIndex: 0, fileMs: 4_500 }, floor: produced(0, 5_200) },
  { call: 1, seq: 3, op: 'WITHDRAW', ...subject('USER', 'manager', 'manager', 'PERSON', 'HIGH'), anchor: { runIndex: 0, fileMs: 5_000 }, floor: produced(0, 5_600) },
  { call: 1, seq: 4, op: 'EXPIRED', ...subject('QANDEEL', 'plan', 'the plan', 'PLAN', 'MEDIUM'), anchor: null, floor: { kind: 'AFTER_END', basis: 'SETTLED_THROUGH' } },
  { call: 2, seq: 1, op: 'SET', ...subject('USER', 'trip', 'trip', 'EXPERIENCE', 'LOW', 'e0000000-0000-4000-8000-000000000005'), anchor: { runIndex: 1, fileMs: 1_000 }, floor: produced(1, 1_800) },
];
const bound = (events: Wire[] = EVENTS, over: Wire = {}, plan = PLAN): ReplayAttentionSourceState => {
  const answer = decodeReplayAttention({ replayId: REPLAY, versionId: VERSION, revision: 1, sourceWindowBindingDigest: SOURCE_WINDOWS, mapDigest: events.length === 0 ? null : presentationMapDigest(plan.runs, plan.boundaries), events, ...over }, { replayId: REPLAY, versionId: VERSION, runs: plan.runs });
  if (answer === null) throw new Error('synthetic answer refused');
  return { kind: 'BOUND', answer, mapDigest: presentationMapDigest(plan.runs, plan.boundaries)! };
};
const laneOf = (attention: ReplayAttentionSourceState | null, over: Partial<Parameters<typeof replayAttentionLane>[0]> = {}, presentation: ReplayPresentationClock = CLOCK, mapDigest = MAP_DIGEST) => replayAttentionLane({
  replayId: REPLAY, versionId: VERSION, revision: 1, presentation, mapDigest, availability: null, attention, scope: { kind: 'FULL' }, fps: FPS, ...over,
});
const LANE = laneOf(bound())!;
const keys = (tl: ReplayAttentionTimeline, t: number) => [...attentionAt(tl, t).keys()];

describe('CP3 · the answer on the presentation clock (C2, C9)', () => {
  it('each event at its run\'s start plus the server\'s file position; settlements in source order; AFTER_END closing', () => {
    expect(LANE.steps.map((s) => [s.eventId, s.op, s.atMs, s.exact])).toEqual([
      ['1:1', 'SET', R0 + 1_900, false], ['1:2', 'SET', R0 + 5_200, false], ['1:3', 'WITHDRAW', R0 + 5_600, false], ['2:1', 'SET', R1 + 1_800, false],
    ]);
    expect(LANE.closing.map((s) => [s.eventId, s.op, s.atMs])).toEqual([['1:4', 'EXPIRED', CLOCK.durationMs]]);
    expect(LANE.outside).toEqual([]);
    // Never at the anchor alone: the words of 1:1 are at R0 + 1200, the mark at its produced position.
    expect(keys(LANE, R0 + 1_200)).toEqual([]);
    expect(keys(LANE, R0 + 1_900)).toEqual(['1:USER:manager']);
    expect(keys(LANE, R0 + 5_200)).toEqual(['1:USER:manager', '1:QANDEEL:plan']);
    expect(keys(LANE, R0 + 5_600)).toEqual(['1:QANDEEL:plan']);
    expect(keys(LANE, R1 + 1_800)).toEqual(['1:QANDEEL:plan', '2:USER:trip']);
    expect(keys(LANE, CLOCK.durationMs)).toEqual(['2:USER:trip']);
  });

  it('C9 · a position the server produced inside a long pause is drawn at that pause\'s presented elapsed offset', () => {
    const moments = [moment(1, 'ORIGINAL_AUDIO', null), moment(2, 'ORIGINAL_AUDIO', null)];
    // A 14 s pause presented as 1.5 s (HELD [3000, 4500)); the API placed a floor 800 ms into it (fileMsAtHeldOffset).
    const plan = planFor(moments, [{ durationMs: 8_000, spans: [
      { kind: 'WINDOW', fromMs: 0, toMs: 3_000, track: 'USER', momentOrdinal: 1 },
      { kind: 'HELD', fromMs: 3_000, toMs: 4_500, elapsedMs: 14_000, shortened: true },
      { kind: 'WINDOW', fromMs: 4_500, toMs: 8_000, track: 'USER', momentOrdinal: 2 },
    ] }], [])!;
    const clock = replayPresentationClock(plan, moments, paceOf)!;
    const held = [{ call: 1, seq: 1, op: 'SET', ...subject('USER', 'pause', 'pause', 'TOPIC', 'LOW'), anchor: { runIndex: 0, fileMs: 2_000 }, floor: produced(0, 3_800) }];
    const lane = laneOf(bound(held, {}, plan), {}, clock, presentationMapDigest(plan.runs, plan.boundaries)!)!;
    expect(lane.steps.map((s) => s.atMs)).toEqual([3_800]);
    expect(keys(lane, 3_799)).toEqual([]);
    expect(keys(lane, 3_800)).toEqual(['1:USER:pause']);
  });
});

describe('CP3 · no lane unless bound, eligible and non-empty (C1, C5)', () => {
  it('pending, refused, unavailable, NOT_FOUND, another map, no map, Lane A\'s NOT_FOUND, another revision, or no event: null', () => {
    expect(laneOf(null)).toBeNull();
    for (const state of [{ kind: 'PENDING' }, { kind: 'REFUSED', reason: 'MALFORMED' }, { kind: 'UNAVAILABLE' }, { kind: 'NOT_FOUND' }] as const) expect(laneOf(state)).toBeNull();
    expect(laneOf({ ...bound(), mapDigest: `sha256:${'d'.repeat(64)}` } as ReplayAttentionSourceState)).toBeNull();
    expect(laneOf(bound(), { presentation: null })).toBeNull();
    expect(laneOf(bound(), { mapDigest: null })).toBeNull();
    expect(laneOf(bound(), { availability: { kind: 'NOT_FOUND' } })).toBeNull();
    expect(laneOf(bound(), { revision: 2 })).toBeNull();
    expect(laneOf(bound([]))).toBeNull();
    // Lane A's other states never withhold Lane B (only NOT_FOUND is an eligibility answer).
    expect(laneOf(bound(), { availability: { kind: 'UNAVAILABLE' } })).not.toBeNull();
  });
});

describe('CP3 · the live order (C4): the same events give the live layer\'s marks at each step', () => {
  it('call 1 through the live reducer and through Lane B: equal marks after every event', () => {
    const live = new ProvisionalAttention(() => 0);
    const call1 = EVENTS.filter((e) => e.call === 1);
    const steps = [...LANE.steps, ...LANE.closing].filter((s) => s.eventId.startsWith('1:'));
    expect(steps.map((s) => s.eventId)).toEqual(call1.map((e) => `1:${e.seq}`));
    for (const [i, e] of call1.entries()) {
      live.event({ type: 'ATTENTION', seq: e.seq as number, op: e.op as never, track: e.track as never, subjectKey: e.subjectKey as string, label: e.label as string, kind: e.kind as never, confidence: e.confidence as never, threadRef: e.threadRef as string | null, producedClockMs: null });
      // The live layer is one call's: Replay's call-1 subjects at the same step (call 2 is another live layer).
      const replay = replayAttentionMarks(new Map([...attentionAt(LANE, steps[i]!.atMs)].filter(([key]) => key.startsWith('1:'))));
      expect(replay).toEqual(attentionMarksOf(live.current) ?? []);
    }
  });

  it('a mark names a body the person has (a glow) by its thread, else none (an ember); one subject of one track drawn once', () => {
    expect(replayAttentionMarks(attentionAt(LANE, R1 + 1_800))).toEqual([
      { subjectKey: 'QANDEEL:plan', label: 'the plan', entityId: null, confidence: 'MEDIUM' },
      { subjectKey: 'USER:trip', label: 'trip', entityId: 'THREAD:e0000000-0000-4000-8000-000000000005', confidence: 'LOW' },
    ]);
    // A later call's same subject replaces the earlier call's, as the newest (the live map shows one call's layer).
    const twice = laneOf(bound([EVENTS[0]!, { ...EVENTS[0]!, call: 2, label: 'manager 2', anchor: { runIndex: 1, fileMs: 500 }, floor: produced(1, 900) }]))!;
    expect(replayAttentionMarks(attentionAt(twice, CLOCK.durationMs - 1))).toEqual([{ subjectKey: 'USER:manager', label: 'manager 2', entityId: null, confidence: 'HIGH' }]);
  });
});

describe('CP3 · the stage: the production chain, Lane A\'s stage untouched', () => {
  const marks: AttentionMark[] = [
    { subjectKey: 'USER:manager', label: 'manager', entityId: null, confidence: 'HIGH' },
    { subjectKey: 'USER:work', label: 'work', entityId: 'THREAD:a1', confidence: 'LOW' },
  ];
  const labelsOf = (stage: ReplayMomentStage) => stage.list.layers.flatMap((l) => l.labels.map((x) => x.id));
  it('an ember for an unknown subject, a glow (no label) for a body the stage draws; the base stage is unchanged', () => {
    const base = STAGES.get(1)!;
    const digest = base.list.digest;
    const marked = replayAttentionStage(base, marks, false);
    expect(base.list.digest).toBe(digest);
    expect(marked.list.digest).not.toBe(digest);
    expect(labelsOf(marked).filter((id) => id.startsWith('ATTENTION:'))).toEqual(marked.held.filter(Boolean).map(() => 'ATTENTION:USER:manager'));
    expect(marked.held).toEqual(base.held);
    expect(labelsOf(base).some((id) => id.startsWith('ATTENTION:'))).toBe(false);
  });

  it('before the first disclosure, the marks are drawn on an empty field at every depth — embers only', () => {
    const empty = emptyReplayStage();
    const marked = replayAttentionStage(empty, marks, false);
    expect(empty.held.every((h) => !h)).toBe(true);
    expect(marked.held.every(Boolean)).toBe(true);
    expect(marked.list.layers.every((l) => l.hits.length === 0 && l.lines.length === 0)).toBe(true);
    // THREAD:a1 is not drawn on the empty field: no body to glow, so it is an ember too (as live, for a body not drawn).
    expect(labelsOf(marked)).toEqual(marked.list.layers.flatMap(() => ['ATTENTION:USER:manager', 'ATTENTION:USER:work']));
  });
});

// ── the frame ──────────────────────────────────────────────────────────────────────────────────────────────────────

const IMAGE = { width: () => 1024, height: () => 1024 } as never;
const IMAGES = { deep: IMAGE, gas: IMAGE, veil: IMAGE, atlas: IMAGE };
const round = (_k: string, v: unknown) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e6) / 1e6 : v);
const prepared = (scene: ReplayCosmosScene): ReplayCosmosScene => ({
  ...scene,
  stages: new Map([...scene.stages].map(([o, s]) => [o, { stage: s.stage, prepared: prepareStage(s.stage.list) }])),
  empty: { stage: scene.empty.stage, prepared: prepareStage(scene.empty.stage.list) },
});
function tree(scene: ReplayCosmosScene, t: number): string {
  let root: ReactTestRenderer | undefined;
  act(() => { root = create(<Canvas>{replayCosmosFrame(scene, IMAGES, t, VIEW.width, VIEW.height)}</Canvas>); });
  const json = JSON.stringify(root!.toJSON(), round);
  act(() => root!.unmount());
  return json;
}
/** The test's own Lane B variants (the world's are held and released; here every variant is kept). */
function attentionOf(timeline: ReplayAttentionTimeline): ReplayFrameAttention {
  const made = new Map<string, ReplayFrameStage>();
  return {
    timeline,
    stageOf(base, state) {
      const key = `${base.stage.ordinal}|${[...state.keys()].join(',')}`;
      let variant = made.get(key);
      if (variant === undefined) {
        const stage = replayAttentionStage(base.stage, replayAttentionMarks(state), false);
        variant = { stage, prepared: prepareStage(stage.list) };
        made.set(key, variant);
      }
      return variant;
    },
  };
}

describe('CP3 · C1: a Replay without Lane B draws exactly what it drew before CP3', () => {
  // The pre-CP3 golden: frames and facts every 250 ms of the synthetic Replay (numbers rounded to 1e-6), computed on the
  // pre-CP3 replay-cosmos (HEAD 3c4298c5) and on this code — equal — then pinned.
  const GOLDEN = '3a4dc8b2be5aa36bcc1783f5a0058bfef0053ec9a4f850ed0c0b2dc50f6ab75a';
  const goldenScene = (): ReplayCosmosScene => {
    const inputs = [1, 2, 3, 4, 5, 6].map((ordinal) => ({ ordinal, tc: ordinal, windowStartMs: (ordinal - 1) * 4000, windowEndMs: ordinal * 4000, completeAtMs: ordinal * 4000, availability: { kind: 'UNRECORDED' as const } }));
    const r = buildReplayCosmosTimeline(inputs, { kind: 'FULL' }, { fps: 30, mode: 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY', durationMs: 26_000 });
    if (!r.ok) throw new Error(r.reason);
    return prepared(sceneOf(r.timeline));
  };
  const digest = (scene: ReplayCosmosScene) => {
    const h = createHash('sha256');
    for (let t = 0; t <= 26_000; t += 250) {
      h.update(JSON.stringify(replayFrameFacts(scene, t), round));
      h.update(tree(scene, t));
    }
    return h.digest('hex');
  };

  it('the golden frames and facts are unchanged, and the facts name no Lane B', () => {
    const scene = goldenScene();
    expect(digest(scene)).toBe(GOLDEN);
    expect('attention' in replayFrameFacts(scene, 10_000)).toBe(false);
  });

  it('a lane whose state is empty at t draws the identical frame (only the facts name the empty state)', () => {
    const scene = goldenScene();
    const late = laneOf(bound([{ ...EVENTS[4]!, call: 1 }]))!;
    const withLane = { ...scene, attention: attentionOf(late) };
    for (const t of [0, 4_000, 9_250, R1 + 1_799]) {
      expect(keys(late, t)).toEqual([]);
      expect(tree(withLane, t)).toBe(tree(scene, t));
      const { attention, ...rest } = replayFrameFacts(withLane, t);
      expect(attention).toEqual([]);
      expect(rest).toEqual(replayFrameFacts(scene, t));
    }
  });
});

describe('CP3 · the frame draws Lane B over Lane A, and the export\'s facts agree with the app (C6)', () => {
  const laneA = (): ReplayCosmosTimeline => replayStageTimeline(CLOCK.inputs, { kind: 'FULL' }, { kind: 'AUDIO', presentation: CLOCK, availability: null }, FPS)!.timeline;
  const scene = (): ReplayCosmosScene => {
    const timeline = laneA();
    const stages = new Map([...STAGES].map(([o, stage]) => [o, { stage, prepared: prepareStage(stage.list) }]));
    const empty = emptyReplayStage();
    return {
      timeline, plan: buildReplayCameraPlan(timeline, STAGES, VIEW), stages, empty: { stage: empty, prepared: prepareStage(empty.list) },
      rtl: false, fontScale: 1, typography: 'SYSTEM_LIVE_WEIGHTS', fonts: null, attention: attentionOf(LANE),
    };
  };

  it('the ember\'s label is drawn from its produced position on, over the stage Lane A draws then (before any disclosure too)', () => {
    const s = scene();
    const { attention: _lane, ...bare } = s;
    expect(tree(s, R0 + 1_899)).toBe(tree(bare, R0 + 1_899));
    expect(tree(s, R0 + 1_899)).not.toMatch(/"text":"manager"/u);
    expect(tree(s, R0 + 1_900)).toMatch(/"text":"manager"/u);
    expect(replayFrameFacts(s, R0 + 1_900).knowledge).toBe(replayFrameFacts(bare, R0 + 1_900).knowledge);
    expect(tree(s, R0 + 5_600)).not.toMatch(/"text":"manager"/u); // withdrawn
    expect(tree(s, R0 + 5_600)).toMatch(/"text":"the plan"/u);
  });

  it('C6 · at every frame, attentionOnFrame equals the state the app draws at that frame\'s time', () => {
    const s = scene();
    const frames = causalFrame(CLOCK.durationMs, FPS) + 1;
    for (let f = 0; f <= frames; f += 1) {
      expect(replayFrameFacts(s, Math.min((f * 1000) / FPS, CLOCK.durationMs)).attention).toEqual([...attentionOnFrame(LANE, f).keys()]);
    }
  });

  it('C3 · seek back and forth, restart: the frame and its facts at t are the same however t was reached', () => {
    const s = scene();
    const visits = [R0 + 5_300, 0, CLOCK.durationMs, R0 + 1_950, R1 + 2_000, R0 + 5_300];
    const first = visits.map((t) => JSON.stringify(replayFrameFacts(s, t), round) + tree(s, t));
    const again = scene();
    expect(visits.map((t) => JSON.stringify(replayFrameFacts(again, t), round) + tree(again, t))).toEqual(first);
  });
});
