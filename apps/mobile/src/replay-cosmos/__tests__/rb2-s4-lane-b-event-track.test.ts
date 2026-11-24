/**
 * RB-2 / S4-E (PO S4 execution directive, 2026-11-24) — Lane B READINESS ONLY. Every event below is SYNTHETIC, made in
 * this file and labelled so (`payload.synthetic`). Nothing in the product produces Lane B events: these tests prove the
 * extension point (the typed track, its deterministic reduction on Lane A's presentation clock), NOT live incremental
 * understanding — QAN-BL-INTEL-06 stays open, and no DeepSeek, Speechmatics, INTERIM analysis, storage, migration,
 * worker or attention UI is involved.
 */
import { CROSS, MOMENTS, REPLAY, RUN0, RUN1, VERSION, moment, pace } from '../../original-audio/__fixtures__/replay-audio-world';
import { planFor } from '../../original-audio/replay-audio-clock';
import { decodeReplayAvailability, presentationMapDigest } from '../../original-audio/replay-availability';
import { readingPaceMs } from '../../replay-player';
import type { ReplayHistoryMoment } from '../../runtime-entry';
import {
  attentionAt, attentionOnFrame, buildReplayEventTimeline, emptyReplayEventTrack,
  type ReplayEventTimeline, type ReplayEventTrackBinding, type ReplayHistoricalEvent, type ReplayHistoricalEventTrack,
} from '../event-track';
import { replayPresentationClock } from '../presentation-clock';
import { replayStageTimeline } from '../stage-timeline';
import { causalFrame, knowledgeAt, type ReplayCosmosAvailability, type ReplayScope } from '../timeline';

const FPS = 30;
const FULL: ReplayScope = { kind: 'FULL' };
const paceOf = (m: ReplayHistoryMoment): number => readingPaceMs(m.text ?? '');
const PLAN = planFor(MOMENTS, [{ durationMs: 9_000, spans: RUN0 }, { durationMs: 5_000, spans: RUN1 }], [CROSS])!;
const CLOCK = replayPresentationClock(PLAN, MOMENTS, paceOf)!;
const R0 = pace('first');
const R1 = R0 + 9_000 + pace('fifth') + 1_500;
const BINDING: ReplayEventTrackBinding = { replayId: REPLAY, versionId: VERSION, revision: 1, mapDigest: presentationMapDigest(PLAN.runs, PLAN.boundaries)! };

type Synthetic = { readonly synthetic: true; readonly label: string };
let seq = 0;
const at = (atMs: number): ReplayCosmosAvailability => ({ kind: 'RECORDED', atMs });
/** A SYNTHETIC Lane B event (no producer exists). */
function ev(over: Partial<ReplayHistoricalEvent<Synthetic>> & Pick<ReplayHistoricalEvent<Synthetic>, 'subjectKey' | 'momentOrdinal' | 'anchorMs'>): ReplayHistoricalEvent<Synthetic> {
  seq += 1;
  return {
    eventId: `synthetic-${seq}`, op: 'SET', source: 'USER', availability: at(over.anchorMs), sequence: seq,
    payload: { synthetic: true, label: `SYNTHETIC ${over.subjectKey} #${seq}` }, ...over,
  };
}
const track = (events: ReplayHistoricalEvent<Synthetic>[], binding = BINDING): ReplayHistoricalEventTrack<Synthetic> => ({ lane: 'IN_SPEECH_ATTENTION', binding, events });
const built = (t: ReplayHistoricalEventTrack<Synthetic>, scope: ReplayScope = FULL): ReplayEventTimeline<Synthetic> => {
  const r = buildReplayEventTimeline(t, BINDING, CLOCK.inputs, scope, { fps: FPS, durationMs: CLOCK.durationMs });
  if (!r.ok) throw new Error(r.reason);
  return r.timeline;
};
const view = (state: ReadonlyMap<string, { eventId: string; source: string; payload: Synthetic }>) =>
  [...state].map(([subject, e]) => `${subject}=${e.source}:${e.payload.label}`).sort();

/** Lane A, certified, for the same version: what Lane B must never change. */
function laneA() {
  const answer = decodeReplayAvailability({
    replayId: REPLAY, versionId: VERSION, revision: 1, sourceWindowBindingDigest: `sha256:${'a'.repeat(64)}`, mapDigest: `sha256:${'a'.repeat(64)}`,
    ledgerWatermark: { sp: 3, seq: 0 },
    moments: [1, 2, 3, 4, 5, 6].map((ordinal) => ({ ordinal, state: 'RECORDED', placement: { kind: 'IN_RECORDING', runIndex: ordinal === 6 ? 1 : 0, fileMs: ordinal === 6 ? 5_000 : 9_000 } })),
  }, { replayId: REPLAY, versionId: VERSION, runs: PLAN.runs })!;
  return replayStageTimeline(CLOCK.inputs, FULL, { kind: 'AUDIO', presentation: CLOCK, availability: { kind: 'BOUND', answer } }, FPS)!;
}

describe('Lane B · the empty lane (every Replay today)', () => {
  it('reduces to the empty state at every t and frame, with no allocation, and leaves Lane A identical', () => {
    const before = laneA();
    const tl = built(emptyReplayEventTrack<Synthetic>(BINDING));
    expect(tl.steps).toEqual([]);
    expect(tl.afterEnd).toEqual([]);
    const first = attentionAt(tl, 0);
    expect(first.size).toBe(0);
    for (let t = 0; t <= CLOCK.durationMs; t += 100) expect(attentionAt(tl, t)).toBe(first); // the same object: nothing made
    for (let f = 0; f < 700; f += 7) expect(attentionOnFrame(tl, f)).toBe(first);
    expect(laneA()).toEqual(before);
  });
});

describe('Lane B · synthetic in-speech events on Lane A\'s clock', () => {
  it('several USER events inside one long window appear while it is heard — never before their anchor or availability', () => {
    const events = [
      ev({ subjectKey: 'topic', momentOrdinal: 2, anchorMs: R0 + 1_000 }),
      ev({ subjectKey: 'person', momentOrdinal: 2, anchorMs: R0 + 2_500, availability: at(R0 + 3_100) }), // available 600 ms later
      ev({ subjectKey: 'topic', momentOrdinal: 2, anchorMs: R0 + 4_000 }), // a correction of the same subject
    ];
    const tl = built(track(events));
    expect(tl.steps.map((s) => [s.eventId, s.atMs])).toEqual([[events[0]!.eventId, R0 + 1_000], [events[1]!.eventId, R0 + 3_100], [events[2]!.eventId, R0 + 4_000]]);
    expect(view(attentionAt(tl, R0 + 999))).toEqual([]);
    expect(view(attentionAt(tl, R0 + 3_099))).toEqual([`topic=USER:${events[0]!.payload.label}`]);
    expect(view(attentionAt(tl, R0 + 3_100))).toEqual([`person=USER:${events[1]!.payload.label}`, `topic=USER:${events[0]!.payload.label}`]);
    expect(view(attentionAt(tl, R0 + 5_000))).toEqual([`person=USER:${events[1]!.payload.label}`, `topic=USER:${events[2]!.payload.label}`]);
    // Lane B may show during the speech; Lane A shows nothing of moment 2 until its window has ended (and, in this
    // synthetic Lane A, nothing at all before R0 + 9000): the two lanes never mix.
    expect(knowledgeAt(laneA().timeline, R0 + 5_000)).toBeNull();
    expect(knowledgeAt(laneA().timeline, R0 + 9_000)).toBe(5);
  });

  it('a QANDEEL event in QANDEEL\'s overlapping window; update, correction and withdrawal in the producer\'s order', () => {
    const set = ev({ subjectKey: 'focus', momentOrdinal: 3, anchorMs: R0 + 4_500, source: 'QANDEEL' });
    // The correction was available EARLIER than what it corrects: it is held after it (never shown before it).
    const corrected = ev({ subjectKey: 'focus', momentOrdinal: 3, anchorMs: R0 + 4_600, source: 'QANDEEL', availability: at(R0 + 4_400) });
    const withdrawn = ev({ subjectKey: 'focus', momentOrdinal: 3, anchorMs: R0 + 7_000, source: 'QANDEEL', op: 'WITHDRAW' });
    const tl = built(track([withdrawn, corrected, set])); // handed over in any order
    expect(tl.steps.map((s) => [s.eventId, s.op, s.atMs])).toEqual([
      [set.eventId, 'SET', R0 + 4_500], [corrected.eventId, 'SET', R0 + 4_600], [withdrawn.eventId, 'WITHDRAW', R0 + 7_000],
    ]);
    expect(view(attentionAt(tl, R0 + 4_550))).toEqual([`focus=QANDEEL:${set.payload.label}`]);
    expect(view(attentionAt(tl, R0 + 6_000))).toEqual([`focus=QANDEEL:${corrected.payload.label}`]);
    expect(view(attentionAt(tl, R0 + 7_000))).toEqual([]);
  });

  it('a late-available event is never shown early; AFTER_END is never inside the Replay', () => {
    const late = ev({ subjectKey: 'late', momentOrdinal: 2, anchorMs: R0 + 500, availability: at(R1 + 2_000) });
    const after = ev({ subjectKey: 'after', momentOrdinal: 6, anchorMs: R1 + 100, availability: { kind: 'AFTER_END' } });
    const tl = built(track([late, after]));
    expect(tl.steps.map((s) => [s.eventId, s.atMs])).toEqual([[late.eventId, R1 + 2_000]]);
    expect(tl.afterEnd).toEqual([after.eventId]);
    expect(view(attentionAt(tl, R1 + 1_999))).toEqual([]);
    expect(view(attentionAt(tl, CLOCK.durationMs))).toEqual([`late=USER:${late.payload.label}`]);
  });

  it('nothing uncertified enters: an UNRECORDED (temporary, uncommitted) event refuses the whole lane', () => {
    const r = buildReplayEventTimeline(track([ev({ subjectKey: 'x', momentOrdinal: 2, anchorMs: R0, availability: { kind: 'UNRECORDED' } })]), BINDING, CLOCK.inputs, FULL, { fps: FPS, durationMs: CLOCK.durationMs });
    expect(r).toEqual({ ok: false, reason: 'UNRECORDED_EVENT' });
  });

  it('seek, re-seek and restart give the identical state; frames are causal and agree with time (the video\'s facts)', () => {
    const events = [
      ev({ subjectKey: 'a', momentOrdinal: 2, anchorMs: R0 + 1_234 }), ev({ subjectKey: 'b', momentOrdinal: 3, anchorMs: R0 + 5_001, source: 'QANDEEL' }),
      ev({ subjectKey: 'a', momentOrdinal: 6, anchorMs: R1 + 10, op: 'WITHDRAW' }),
    ];
    const tl = built(track(events));
    const visits = [0, R0 + 5_001, R0 + 1_233, R1 + 10, R0 + 1_234, R0 + 5_000, 0, R1 + 4_000];
    const first = visits.map((t) => view(attentionAt(tl, t)));
    expect(visits.map((t) => view(attentionAt(built(track(events)), t)))).toEqual(first);
    for (const s of tl.steps) expect(s.frame).toBe(causalFrame(s.atMs, FPS));
    const frames = Math.ceil((CLOCK.durationMs * FPS) / 1000);
    for (let f = 0; f < frames; f += 1) expect(view(attentionOnFrame(tl, f))).toEqual(view(attentionAt(tl, (f * 1000) / FPS)));
  });

  it('a RANGE opens on the events disclosed at or before its start', () => {
    const a = ev({ subjectKey: 'a', momentOrdinal: 2, anchorMs: R0 + 1_000 });
    const b = ev({ subjectKey: 'b', momentOrdinal: 3, anchorMs: R0 + 6_000, source: 'QANDEEL' });
    const tl = built(track([a, b]), { kind: 'RANGE', startMs: R0 + 3_000, endMs: R1 });
    expect(view(tl.opening)).toEqual([`a=USER:${a.payload.label}`]);
    expect(tl.steps.map((s) => [s.eventId, s.atMs])).toEqual([[b.eventId, 3_000]]);
  });
});

describe('Lane B · no leakage, refused whole', () => {
  const one = () => [ev({ subjectKey: 'a', momentOrdinal: 2, anchorMs: R0 + 1_000 })];
  const refusal = (t: ReplayHistoricalEventTrack<Synthetic>) => buildReplayEventTimeline(t, BINDING, CLOCK.inputs, FULL, { fps: FPS, durationMs: CLOCK.durationMs });
  it('another Replay, version, revision or map; a duplicate id; an unknown moment; an anchor outside its window', () => {
    expect(refusal(track(one(), { ...BINDING, versionId: 'c0000000-0000-4000-8000-0000000000ff' }))).toEqual({ ok: false, reason: 'BINDING_MISMATCH' });
    expect(refusal(track(one(), { ...BINDING, replayId: 'b0000000-0000-4000-8000-0000000000ff' }))).toEqual({ ok: false, reason: 'BINDING_MISMATCH' });
    expect(refusal(track(one(), { ...BINDING, revision: 2 }))).toEqual({ ok: false, reason: 'BINDING_MISMATCH' });
    expect(refusal(track(one(), { ...BINDING, mapDigest: `sha256:${'9'.repeat(64)}` }))).toEqual({ ok: false, reason: 'BINDING_MISMATCH' });
    const e = one()[0]!;
    expect(refusal(track([e, { ...e }]))).toEqual({ ok: false, reason: 'DUPLICATE_EVENT' });
    expect(refusal(track([{ ...e, momentOrdinal: 9 }]))).toEqual({ ok: false, reason: 'UNKNOWN_MOMENT' });
    // An unselected source span is not moved into an earlier selected window (#410 annex §3.2).
    expect(refusal(track([{ ...e, anchorMs: R0 + 6_001 }]))).toEqual({ ok: false, reason: 'ANCHOR_OUTSIDE_WINDOW' });
  });

  it('a refused Lane B leaves Lane A\'s certified knowledge exactly as it is (fails closed, alone)', () => {
    const before = laneA();
    expect(refusal(track(one(), { ...BINDING, revision: 2 })).ok).toBe(false);
    expect(laneA()).toEqual(before);
    expect(before.kind).toBe('CERTIFIED');
  });
});

describe('Lane B · a 120-second USER turn (#410 annex §4.2–4.3), SYNTHETIC', () => {
  const moments = [moment(1, 'ORIGINAL_AUDIO', null), moment(2, 'ORIGINAL_AUDIO', null, 'ASSISTANT')];
  const plan = planFor(moments, [{ durationMs: 125_000, spans: [
    { kind: 'WINDOW', fromMs: 0, toMs: 120_000, track: 'USER', momentOrdinal: 1 },
    { kind: 'WINDOW', fromMs: 120_000, toMs: 125_000, track: 'QANDEEL', momentOrdinal: 2 },
  ] }], [])!;
  const clock = replayPresentationClock(plan, moments, paceOf)!;
  const binding = { ...BINDING, mapDigest: presentationMapDigest(plan.runs, plan.boundaries)! };

  it('several attention changes while the user is still speaking; the one known only at 17 s is not shown at 12 s', () => {
    const events = [
      ev({ subjectKey: 'topic', momentOrdinal: 1, anchorMs: 12_000, availability: at(17_000) }),
      ev({ subjectKey: 'topic', momentOrdinal: 1, anchorMs: 40_000 }),
      ev({ subjectKey: 'person', momentOrdinal: 1, anchorMs: 75_000 }),
      ev({ subjectKey: 'topic', momentOrdinal: 1, anchorMs: 110_000, op: 'WITHDRAW' }),
    ];
    const r = buildReplayEventTimeline(track(events, binding), binding, clock.inputs, FULL, { fps: FPS, durationMs: clock.durationMs });
    if (!r.ok) throw new Error(r.reason);
    const tl = r.timeline;
    expect(tl.steps.map((s) => s.atMs)).toEqual([17_000, 40_000, 75_000, 110_000]);
    expect(view(attentionAt(tl, 12_000))).toEqual([]);
    expect(view(attentionAt(tl, 16_999))).toEqual([]);
    const changes = new Set([0, 17_000, 40_000, 75_000, 110_000].map((t) => JSON.stringify(view(attentionAt(tl, t)))));
    expect(changes.size).toBe(5); // four distinct changes, all before the window ends at 120 s
    // Lane A for the same turn: nothing of moment 1 before its window has ended.
    const answer = decodeReplayAvailability({
      replayId: REPLAY, versionId: VERSION, revision: 1, sourceWindowBindingDigest: `sha256:${'a'.repeat(64)}`, mapDigest: binding.mapDigest,
      ledgerWatermark: { sp: 2, seq: 0 },
      moments: [{ ordinal: 1, state: 'RECORDED', placement: { kind: 'IN_RECORDING', runIndex: 0, fileMs: 30_000 } }, { ordinal: 2, state: 'RECORDED', placement: { kind: 'AFTER_END' } }],
    }, { replayId: REPLAY, versionId: VERSION, runs: plan.runs })!;
    const a = replayStageTimeline(clock.inputs, FULL, { kind: 'AUDIO', presentation: clock, availability: { kind: 'BOUND', answer } }, FPS)!;
    expect(a.kind).toBe('CERTIFIED');
    expect(knowledgeAt(a.timeline, 119_999)).toBeNull();
    expect(knowledgeAt(a.timeline, 120_000)).toBe(1);
  });
});
