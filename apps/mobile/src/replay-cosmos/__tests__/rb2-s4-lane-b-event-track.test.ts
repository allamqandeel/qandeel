/**
 * RB-2 / S4-E built Lane B as a typed boundary with no producer; INTEL-LIVE-01 CP3 (D-10, D-CP3 — PO approval of
 * 2026-11-26) RE-ANCHORS it to its producer (0204 → 0205) and to the Replay §19 placement. Previous pins, replaced here:
 *   - "an UNRECORDED event refuses the whole lane" → an uncertified event is placed at its server-produced floor, labelled
 *     non-exact (`exact: false`), never dropped and never at its anchor alone;
 *   - "AFTER_END is never inside the Replay" → AFTER_END is the closing display (applied only at t ≥ the end);
 *   - an event bound to a `momentOrdinal`'s window → its anchor must lie in a presented window of its OWN track (C7), else
 *     it stays out (not a refusal of the lane);
 *   - SET / WITHDRAW → SET / WITHDRAW / CONFIRMED / EXPIRED, reduced as the live layer reduces them.
 * Every event below is SYNTHETIC, made in this file (`payload.synthetic`).
 */
import { CROSS, MOMENTS, REPLAY, RUN0, RUN1, VERSION, moment, pace } from '../../original-audio/__fixtures__/replay-audio-world';
import { planFor } from '../../original-audio/replay-audio-clock';
import { decodeReplayAvailability, presentationMapDigest } from '../../original-audio/replay-availability';
import { readingPaceMs } from '../../replay-player';
import type { ReplayHistoryMoment } from '../../runtime-entry';
import {
  attentionAt, attentionOnFrame, buildReplayEventTimeline, emptyReplayEventTrack,
  type ReplayEventFloor, type ReplayEventTimeline, type ReplayEventTrackBinding, type ReplayHistoricalEvent, type ReplayHistoricalEventTrack,
} from '../event-track';
import { replayPresentationClock } from '../presentation-clock';
import { replayStageTimeline } from '../stage-timeline';
import { causalFrame, knowledgeAt, type ReplayScope } from '../timeline';

const FPS = 30;
const FULL: ReplayScope = { kind: 'FULL' };
const paceOf = (m: ReplayHistoryMoment): number => readingPaceMs(m.text ?? '');
const PLAN = planFor(MOMENTS, [{ durationMs: 9_000, spans: RUN0 }, { durationMs: 5_000, spans: RUN1 }], [CROSS])!;
const CLOCK = replayPresentationClock(PLAN, MOMENTS, paceOf)!;
// Run 0: USER [R0, R0 + 6000], QANDEEL [R0 + 4000, R0 + 9000]; run 1: USER [R1, R1 + 5000].
const R0 = pace('first');
const R1 = R0 + 9_000 + pace('fifth') + 1_500;
const BINDING: ReplayEventTrackBinding = { replayId: REPLAY, versionId: VERSION, revision: 1, mapDigest: presentationMapDigest(PLAN.runs, PLAN.boundaries)! };

type Synthetic = { readonly synthetic: true; readonly label: string };
let seq = 0;
const at = (atMs: number): ReplayEventFloor => ({ kind: 'PRODUCED', atMs });
/** A SYNTHETIC development (SET by default), produced 700 ms after its anchor unless said otherwise. */
function ev(over: Partial<ReplayHistoricalEvent<Synthetic>> & Pick<ReplayHistoricalEvent<Synthetic>, 'subjectKey' | 'anchorMs'>): ReplayHistoricalEvent<Synthetic> {
  seq += 1;
  return {
    eventId: `synthetic-${seq}`, op: 'SET', source: 'USER', floor: at((over.anchorMs ?? 0) + 700), sequence: seq,
    payload: { synthetic: true, label: `SYNTHETIC ${over.subjectKey} #${seq}` }, ...over,
  };
}
/** A SYNTHETIC settlement (no anchor), at its settled-through position. */
const settle = (subjectKey: string, op: 'CONFIRMED' | 'EXPIRED', floor: ReplayEventFloor, source: 'USER' | 'QANDEEL' = 'USER') => ev({ subjectKey, anchorMs: null, op, floor, source });
const track = (events: ReplayHistoricalEvent<Synthetic>[], binding = BINDING): ReplayHistoricalEventTrack<Synthetic> => ({ lane: 'IN_SPEECH_ATTENTION', binding, events });
const built = (t: ReplayHistoricalEventTrack<Synthetic>, scope: ReplayScope = FULL): ReplayEventTimeline<Synthetic> => {
  const r = buildReplayEventTimeline(t, BINDING, CLOCK.windows, scope, { fps: FPS, durationMs: CLOCK.durationMs });
  if (!r.ok) throw new Error(r.reason);
  return r.timeline;
};
const view = (state: ReadonlyMap<string, { eventId: string; source: string; payload: Synthetic }>) => [...state].map(([subject, e]) => `${subject}=${e.source}:${e.payload.label}`);

/** Lane A, certified, for the same version: what Lane B must never change. */
function laneA() {
  const answer = decodeReplayAvailability({
    replayId: REPLAY, versionId: VERSION, revision: 1, sourceWindowBindingDigest: `sha256:${'a'.repeat(64)}`, mapDigest: `sha256:${'a'.repeat(64)}`,
    ledgerWatermark: { sp: 3, seq: 0 },
    moments: [1, 2, 3, 4, 5, 6].map((ordinal) => ({ ordinal, state: 'RECORDED', placement: { kind: 'IN_RECORDING', runIndex: ordinal === 6 ? 1 : 0, fileMs: ordinal === 6 ? 5_000 : 9_000 } })),
  }, { replayId: REPLAY, versionId: VERSION, runs: PLAN.runs })!;
  return replayStageTimeline(CLOCK.inputs, FULL, { kind: 'AUDIO', presentation: CLOCK, availability: { kind: 'BOUND', answer } }, FPS)!;
}

describe('Lane B · the empty lane', () => {
  it('reduces to the empty state at every t and frame, with no allocation, and leaves Lane A identical', () => {
    const before = laneA();
    const tl = built(emptyReplayEventTrack<Synthetic>(BINDING));
    expect(tl.steps).toEqual([]);
    expect(tl.closing).toEqual([]);
    const first = attentionAt(tl, 0);
    expect(first.size).toBe(0);
    for (let t = 0; t <= CLOCK.durationMs; t += 100) expect(attentionAt(tl, t)).toBe(first); // the same object: nothing made
    for (let f = 0; f < 700; f += 7) expect(attentionOnFrame(tl, f)).toBe(first);
    expect(laneA()).toEqual(before);
  });
});

describe('Lane B · C2 / C9: placed at the server-produced floor, never at the anchor alone, never before the words', () => {
  it('in-speech progression is kept at the produced positions (never deferred to the end of the turn), labelled non-exact', () => {
    const events = [
      ev({ subjectKey: 'topic', anchorMs: R0 + 1_000, floor: at(R0 + 1_700) }),
      ev({ subjectKey: 'person', anchorMs: R0 + 2_500, floor: at(R0 + 3_100) }),
      ev({ subjectKey: 'topic', anchorMs: R0 + 4_000, floor: at(R0 + 4_400) }), // a correction of the same subject
    ];
    const tl = built(track(events));
    expect(tl.steps.map((s) => [s.eventId, s.atMs, s.exact])).toEqual([[events[0]!.eventId, R0 + 1_700, false], [events[1]!.eventId, R0 + 3_100, false], [events[2]!.eventId, R0 + 4_400, false]]);
    // The anchor alone never places it (previous pin: shown at the anchor when certified at it).
    expect(view(attentionAt(tl, R0 + 1_000))).toEqual([]);
    expect(view(attentionAt(tl, R0 + 1_699))).toEqual([]);
    expect(view(attentionAt(tl, R0 + 1_700))).toEqual([`topic=USER:${events[0]!.payload.label}`]);
    // A SET moves its subject to the newest, as the live layer does.
    expect(view(attentionAt(tl, R0 + 5_000))).toEqual([`person=USER:${events[1]!.payload.label}`, `topic=USER:${events[2]!.payload.label}`]);
    // Every change happens while the user is still speaking (the window ends at R0 + 6000).
    expect(tl.steps.every((s) => s.atMs < R0 + 6_000)).toBe(true);
    // Lane A shows nothing of moment 2 until its window has ended: the two lanes never mix.
    expect(knowledgeAt(laneA().timeline, R0 + 5_000)).toBeNull();
  });

  it('a floor before its anchor (a mapped hold) is held at the anchor — never before the words', () => {
    const e = ev({ subjectKey: 'held', anchorMs: R0 + 2_000, floor: at(R0 + 1_500) });
    expect(built(track([e])).steps.map((s) => s.atMs)).toEqual([R0 + 2_000]);
  });

  it('C9 · a tail event after the speech ended is placed at its produced position, after the window, not at the anchor', () => {
    const tail = ev({ subjectKey: 'tail', anchorMs: R0 + 5_500, floor: at(R0 + 7_200) });
    const tl = built(track([tail]));
    expect(tl.steps.map((s) => s.atMs)).toEqual([R0 + 7_200]);
    expect(view(attentionAt(tl, R0 + 6_000))).toEqual([]);
  });

  it('AFTER_END is the closing display: applied at the presentation\'s end and on no frame before it', () => {
    const late = ev({ subjectKey: 'late', anchorMs: R0 + 500, floor: { kind: 'AFTER_END' } });
    const tl = built(track([late]));
    expect(tl.steps).toEqual([]);
    expect(tl.closing.map((s) => [s.eventId, s.atMs, s.exact])).toEqual([[late.eventId, CLOCK.durationMs, false]]);
    expect(view(attentionAt(tl, CLOCK.durationMs - 1))).toEqual([]);
    expect(view(attentionAt(tl, CLOCK.durationMs))).toEqual([`late=USER:${late.payload.label}`]);
    const end = causalFrame(CLOCK.durationMs, FPS);
    expect(view(attentionOnFrame(tl, end - 1))).toEqual([]);
    expect(view(attentionOnFrame(tl, end))).toEqual([`late=USER:${late.payload.label}`]);
    // Every later event on that subject follows it to the end (monotonic per subject).
    const after = ev({ subjectKey: 'late', anchorMs: R1 + 100, floor: at(R1 + 300), op: 'WITHDRAW' });
    expect(built(track([late, after])).closing.map((s) => s.op)).toEqual(['SET', 'WITHDRAW']);
  });
});

describe('Lane B · C4: corrections, withdrawals and settlements in the producer\'s order (the live order)', () => {
  it('SET → corrected SET → WITHDRAW; the earlier state is never rewritten', () => {
    const set = ev({ subjectKey: 'focus', anchorMs: R0 + 4_500, source: 'QANDEEL', floor: at(R0 + 4_800) });
    // The correction was produced EARLIER than what it corrects (an out-of-order floor): it is held after it.
    const corrected = ev({ subjectKey: 'focus', anchorMs: R0 + 4_600, source: 'QANDEEL', floor: at(R0 + 4_700) });
    const withdrawn = ev({ subjectKey: 'focus', anchorMs: R0 + 7_000, source: 'QANDEEL', op: 'WITHDRAW', floor: at(R0 + 7_300) });
    const tl = built(track([withdrawn, corrected, set])); // handed over in any order
    expect(tl.steps.map((s) => [s.eventId, s.op, s.atMs])).toEqual([
      [set.eventId, 'SET', R0 + 4_800], [corrected.eventId, 'SET', R0 + 4_800], [withdrawn.eventId, 'WITHDRAW', R0 + 7_300],
    ]);
    expect(view(attentionAt(tl, R0 + 4_799))).toEqual([]);
    expect(view(attentionAt(tl, R0 + 4_800))).toEqual([`focus=QANDEEL:${corrected.payload.label}`]);
    expect(view(attentionAt(tl, R0 + 7_300))).toEqual([]);
  });

  it('CONFIRMED and EXPIRED remove their subject at their settled-through position, never before what they settle', () => {
    const a = ev({ subjectKey: 'a', anchorMs: R0 + 1_000, floor: at(R0 + 1_500) });
    const b = ev({ subjectKey: 'b', anchorMs: R0 + 2_000, floor: at(R0 + 2_600) });
    const confirmed = settle('a', 'CONFIRMED', at(R0 + 6_000));
    const expired = settle('b', 'EXPIRED', at(R0 + 1_000)); // settled-through earlier than its SET: held after it
    const tl = built(track([a, b, confirmed, expired]));
    expect(tl.steps.map((s) => [s.op, s.atMs])).toEqual([['SET', R0 + 1_500], ['SET', R0 + 2_600], ['EXPIRED', R0 + 2_600], ['CONFIRMED', R0 + 6_000]]);
    expect(view(attentionAt(tl, R0 + 5_999))).toEqual([`a=USER:${a.payload.label}`]);
    expect(view(attentionAt(tl, R0 + 6_000))).toEqual([]);
  });
});

describe('Lane B · C7: each event on its own track', () => {
  it('a QANDEEL development whose anchor lies only in a USER window stays out (no leakage into another speaker)', () => {
    const user = ev({ subjectKey: 'u', anchorMs: R0 + 1_000 });
    const misplaced = ev({ subjectKey: 'q', anchorMs: R0 + 1_000, source: 'QANDEEL' }); // QANDEEL speaks from R0 + 4000 only
    const own = ev({ subjectKey: 'q', anchorMs: R0 + 4_200, source: 'QANDEEL' });
    const tl = built(track([user, misplaced, own]));
    expect(tl.outside).toEqual([misplaced.eventId]);
    expect(tl.steps.map((s) => s.eventId)).toEqual([user.eventId, own.eventId]);
    // An anchor in no presented window at all (the text block, the pause) stays out too.
    const gap = ev({ subjectKey: 'g', anchorMs: R0 + 9_500 });
    expect(built(track([gap])).outside).toEqual([gap.eventId]);
  });
});

describe('Lane B · C3: seek, restart and RANGE are pure functions of t', () => {
  it('seek, re-seek and restart give the identical state; frames are causal and agree with time (the video\'s facts)', () => {
    const events = [
      ev({ subjectKey: 'a', anchorMs: R0 + 1_234 }), ev({ subjectKey: 'b', anchorMs: R0 + 5_001, source: 'QANDEEL' }),
      ev({ subjectKey: 'a', anchorMs: R1 + 10, op: 'WITHDRAW' }), settle('b', 'EXPIRED', { kind: 'AFTER_END' }, 'QANDEEL'),
    ];
    const tl = built(track(events));
    const visits = [0, R0 + 5_701, R0 + 1_933, R1 + 710, R0 + 1_934, R0 + 5_000, 0, R1 + 4_000, CLOCK.durationMs];
    const first = visits.map((t) => view(attentionAt(tl, t)));
    expect(visits.map((t) => view(attentionAt(built(track(events)), t)))).toEqual(first);
    for (const s of tl.steps) expect(s.frame).toBe(causalFrame(s.atMs, FPS));
    const frames = Math.ceil((CLOCK.durationMs * FPS) / 1000) + 1;
    for (let f = 0; f <= frames; f += 1) expect(view(attentionOnFrame(tl, f))).toEqual(view(attentionAt(tl, Math.min((f * 1000) / FPS, CLOCK.durationMs))));
  });

  it('a RANGE opens on the events disclosed at or before its start; a disclosure after its end is listed, never drawn', () => {
    const a = ev({ subjectKey: 'a', anchorMs: R0 + 1_000 });
    const b = ev({ subjectKey: 'b', anchorMs: R0 + 6_000, source: 'QANDEEL' });
    const c = ev({ subjectKey: 'c', anchorMs: R1 + 100 });
    const tl = built(track([a, b, c]), { kind: 'RANGE', startMs: R0 + 3_000, endMs: R1 });
    expect(view(tl.opening)).toEqual([`a=USER:${a.payload.label}`]);
    expect(tl.steps.map((s) => [s.eventId, s.atMs])).toEqual([[b.eventId, 3_700]]);
    expect(tl.afterEnd).toEqual([c.eventId]);
    expect(tl.closing).toEqual([]);
  });
});

describe('Lane B · C5: no leakage, refused whole, Lane A unaffected', () => {
  const one = () => [ev({ subjectKey: 'a', anchorMs: R0 + 1_000 })];
  const refusal = (t: ReplayHistoricalEventTrack<Synthetic>) => buildReplayEventTimeline(t, BINDING, CLOCK.windows, FULL, { fps: FPS, durationMs: CLOCK.durationMs });
  it('another Replay, version, revision or map; a duplicate id; a malformed event', () => {
    expect(refusal(track(one(), { ...BINDING, versionId: 'c0000000-0000-4000-8000-0000000000ff' }))).toEqual({ ok: false, reason: 'BINDING_MISMATCH' });
    expect(refusal(track(one(), { ...BINDING, replayId: 'b0000000-0000-4000-8000-0000000000ff' }))).toEqual({ ok: false, reason: 'BINDING_MISMATCH' });
    expect(refusal(track(one(), { ...BINDING, revision: 2 }))).toEqual({ ok: false, reason: 'BINDING_MISMATCH' });
    expect(refusal(track(one(), { ...BINDING, mapDigest: `sha256:${'9'.repeat(64)}` }))).toEqual({ ok: false, reason: 'BINDING_MISMATCH' });
    const e = one()[0]!;
    expect(refusal(track([e, { ...e }]))).toEqual({ ok: false, reason: 'DUPLICATE_EVENT' });
    expect(refusal(track([{ ...e, anchorMs: null }]))).toEqual({ ok: false, reason: 'MALFORMED_EVENT' }); // a development without words
    expect(refusal(track([{ ...e, op: 'CONFIRMED' }]))).toEqual({ ok: false, reason: 'MALFORMED_EVENT' }); // a settlement with an anchor
    expect(refusal(track([{ ...e, floor: { kind: 'PRODUCED', atMs: Number.NaN } }]))).toEqual({ ok: false, reason: 'MALFORMED_EVENT' });
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

  it('several attention changes while the user is still speaking; the one produced at 17 s is not shown at 12 s (its anchor)', () => {
    const events = [
      ev({ subjectKey: 'topic', anchorMs: 12_000, floor: at(17_000) }),
      ev({ subjectKey: 'topic', anchorMs: 40_000, floor: at(41_200) }),
      ev({ subjectKey: 'person', anchorMs: 75_000, floor: at(76_000) }),
      ev({ subjectKey: 'topic', anchorMs: 110_000, op: 'WITHDRAW', floor: at(111_000) }),
    ];
    const r = buildReplayEventTimeline(track(events, binding), binding, clock.windows, FULL, { fps: FPS, durationMs: clock.durationMs });
    if (!r.ok) throw new Error(r.reason);
    const tl = r.timeline;
    expect(tl.steps.map((s) => s.atMs)).toEqual([17_000, 41_200, 76_000, 111_000]);
    expect(view(attentionAt(tl, 12_000))).toEqual([]);
    expect(view(attentionAt(tl, 16_999))).toEqual([]);
    const changes = new Set([0, 17_000, 41_200, 76_000, 111_000].map((t) => JSON.stringify(view(attentionAt(tl, t)))));
    expect(changes.size).toBe(5); // four distinct changes, all before the window ends at 120 s
    // Lane A for the same turn: nothing of moment 1 before its window has ended.
    const answer = decodeReplayAvailability({
      replayId: REPLAY, versionId: VERSION, revision: 1, sourceWindowBindingDigest: `sha256:${'a'.repeat(64)}`, mapDigest: binding.mapDigest,
      ledgerWatermark: { sp: 2, seq: 0 },
      moments: [{ ordinal: 1, state: 'RECORDED', placement: { kind: 'IN_RECORDING', runIndex: 0, fileMs: 30_000 } }, { ordinal: 2, state: 'RECORDED', placement: { kind: 'AFTER_END' } }],
    }, { replayId: REPLAY, versionId: VERSION, runs: plan.runs })!;
    const a = replayStageTimeline(clock.inputs, FULL, { kind: 'AUDIO', presentation: clock, availability: { kind: 'BOUND', answer } }, FPS)!;
    expect(a.kind).toBe('SOURCE_ORDER');
    expect(knowledgeAt(a.timeline, 119_999)).toBeNull();
    expect(knowledgeAt(a.timeline, 120_000)).toBe(1);
  });
});
