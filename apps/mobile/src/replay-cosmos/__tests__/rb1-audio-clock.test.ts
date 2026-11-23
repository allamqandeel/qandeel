/**
 * PR #404 RB-1 S1–S3 — the Replay COSMOS stage on the ONE audio presentation authority (CP1-B's presentation map, as the
 * phone's ReplayAudioClock reads it against the version), with the PO's temporal-safety invariant: NO ANALYSIS BEFORE
 * SPEECH. Written first, and seen failing, before the implementation (PO RB-1 authorisation, 2026-11-23).
 *
 * Two kinds of test, kept apart (the PO's instruction):
 *   RB-1      what RB-1 implements and proves now: one presentation clock from the map; every window kept, overlaps
 *             included; a disclosure never before the end of the audio window(s) it depends on; the stage driven by the
 *             audio clock's place (pause, resume, seek, run boundary), never by the wall clock or the reading pace; the
 *             export on the same clock; a missing availability never passed off as recorded; nothing pulled back from
 *             after the end; the text-only fallback unchanged; no camera or reveal ahead of its disclosure.
 *   RB-2      the CONTRACT RB-2 must satisfy, exercised here on SYNTHETIC recorded instants only: a recorded
 *             availability later than the speech guard decides. No production source of a recorded availability exists
 *             until RB-2 (migrations 0201 / 0202, not approved); RB-1 does not complete it.
 *
 * Synthetic history only (the CP1-B step-5 world: 1 text · 2 USER audio · 3 + 4 one QANDEEL turn overlapping 2 · 5 text ·
 * 6 USER audio in another recording, with a GAP). No customer content, no recording.
 */
import { planFor, type ReplayAudioPlan } from '../../original-audio/replay-audio-clock';
import { CROSS, MOMENTS, MOMENTS_AS_TEXT, RUN0, RUN1, pace, run, world } from '../../original-audio/__fixtures__/replay-audio-world';
import { REPLAY_RENDER_CONTRACT_V1 } from '../../replay-composite';
import { readingPaceMs } from '../../replay-player';
import type { ReplayHistoryMoment } from '../../runtime-entry';
import { cameraAt, planFutureViolations } from '../camera-plan';
import { replayFrameFacts } from '../frame';
import {
  REPLAY_STAGE_AUDIO_LAG_MS,
  replayExportAudio,
  replayPresentationClock,
  replayStageTime,
  type ReplayPresentationClock,
} from '../presentation-clock';
import { buildReplayCosmosTimeline, knowledgeAt, type ReplayCosmosMomentInput, type ReplayCosmosTimeline } from '../timeline';
import { STAGES, sceneOf } from '../__fixtures__/synthetic-history';

const FPS = 30;
const paceOf = (m: ReplayHistoryMoment): number => readingPaceMs(m.text ?? '');
const SHAPES = [{ durationMs: 9_000, spans: RUN0 }, { durationMs: 5_000, spans: RUN1 }];
const PLAN: ReplayAudioPlan = (() => {
  const plan = planFor(MOMENTS, SHAPES, [CROSS]);
  if (plan === null) throw new Error('the CP1-B fixture map must be accepted by planFor');
  return plan;
})();
const clockOf = (paceMs = paceOf): ReplayPresentationClock => {
  const c = replayPresentationClock(PLAN, MOMENTS, paceMs);
  if (c === null) throw new Error('refused');
  return c;
};
const timelineOf = (inputs: readonly ReplayCosmosMomentInput[], durationMs?: number): ReplayCosmosTimeline => {
  const r = buildReplayCosmosTimeline(inputs, { kind: 'FULL' }, { fps: FPS, unrecorded: 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY', ...(durationMs === undefined ? {} : { durationMs }) });
  if (!r.ok) throw new Error(r.reason);
  return r.timeline;
};

// The layout the map gives (pace('first') = pace('fifth') = 3500 ms):
//   1 TEXT [0, 3500) · RUN 0 [3500, 12500): 2 USER [3500, 9500), 3 (+4) QANDEEL [7500, 12500), MIX [7500, 9500)
//   5 TEXT [12500, 16000) · PAUSE (CROSS, 1500) [16000, 17500) · RUN 1 [17500, 22500): 6 USER, GAP [18500, 19500)
const P1 = pace('first');
const R0 = P1;
const R1 = R0 + 9_000 + pace('fifth') + 1_500;

describe('RB-1 · the existing mismatch: the timeline refused what the presentation map presents', () => {
  it('overlapping USER / QANDEEL windows from the map are accepted, and every window is kept (none dropped or flattened)', () => {
    // Before RB-1, buildReplayCosmosTimeline refused this ("out of order"): a QANDEEL window starting inside a USER one.
    const inputs: ReplayCosmosMomentInput[] = [
      { ordinal: 2, tc: 2, windowStartMs: 3_500, windowEndMs: 9_500, completeAtMs: 9_500, availableAtMs: null },
      { ordinal: 3, tc: 3, windowStartMs: 7_500, windowEndMs: 12_500, completeAtMs: 12_500, availableAtMs: null },
    ];
    const tl = timelineOf(inputs);
    expect(tl.windows).toEqual([{ ordinal: 2, startMs: 3_500, endMs: 9_500 }, { ordinal: 3, startMs: 7_500, endMs: 12_500 }]);
  });

  it('the clock carries the plan\'s windows, overlaps included, at the plan\'s own lengths', () => {
    const c = clockOf();
    expect(c.windows.map((w) => [w.momentOrdinal, w.track, w.startMs, w.endMs])).toEqual([
      [2, 'USER', R0, R0 + 6_000], [3, 'QANDEEL', R0 + 4_000, R0 + 9_000], [6, 'USER', R1, R1 + 5_000],
    ]);
  });
});

describe('RB-1 S1 · replayPresentationClock(plan): one presentation clock from the server-authorised map', () => {
  it('lays out text blocks, the boundary pause and each run\'s file in moment order; HELD / GAP / MIX at their stated length', () => {
    const c = clockOf();
    expect(c.blocks).toEqual([
      { kind: 'TEXT', ordinal: 1, startMs: 0, endMs: P1 },
      { kind: 'RUN', runIndex: 0, startMs: R0, endMs: R0 + 9_000 },
      { kind: 'TEXT', ordinal: 5, startMs: R0 + 9_000, endMs: R0 + 9_000 + pace('fifth') },
      { kind: 'PAUSE', runIndex: 1, startMs: R1 - 1_500, endMs: R1, boundary: CROSS },
      { kind: 'RUN', runIndex: 1, startMs: R1, endMs: R1 + 5_000 },
    ]);
    expect(c.durationMs).toBe(R1 + 5_000);
    expect(c.runStartMs(0)).toBe(R0);
    expect(c.runStartMs(1)).toBe(R1);
    // Every span of every run, moved by its run's offset and nothing else.
    const gap = c.spans.find((s) => s.kind === 'GAP')!;
    expect([gap.startMs, gap.endMs]).toEqual([R1 + 1_000, R1 + 2_000]);
    const mix = c.spans.find((s) => s.kind === 'MIX')!;
    expect([mix.startMs, mix.endMs]).toEqual([R0 + 4_000, R0 + 6_000]);
  });

  it('maps the clock\'s place both ways: a file position, and the boundary pause the phone times', () => {
    const c = clockOf();
    expect(c.at({ kind: 'RUN', runIndex: 0, positionMs: 0 })).toBe(R0);
    expect(c.at({ kind: 'RUN', runIndex: 0, positionMs: 4_321 })).toBe(R0 + 4_321);
    expect(c.at({ kind: 'BOUNDARY', runIndex: 1, elapsedMs: 600 })).toBe(R1 - 900);
    expect(c.at({ kind: 'RUN', runIndex: 1, positionMs: 5_000 })).toBe(R1 + 5_000);
    expect(c.placeAt(R0 + 4_321)).toEqual({ kind: 'RUN', runIndex: 0, positionMs: 4_321 });
    expect(c.placeAt(R1 - 900)).toEqual({ kind: 'BOUNDARY', runIndex: 1, elapsedMs: 600 });
    expect(c.placeAt(100)).toBeNull(); // a text block: no audio there
  });

  it('gives the timeline every moment: windows from the map, a later unit on its turn\'s window, nothing invented', () => {
    const c = clockOf();
    expect(c.inputs).toEqual([
      { ordinal: 1, tc: 1, windowStartMs: 0, windowEndMs: P1, completeAtMs: 0, presentedBy: 1, availableAtMs: null },
      { ordinal: 2, tc: 2, windowStartMs: R0, windowEndMs: R0 + 6_000, completeAtMs: R0 + 6_000, presentedBy: 2, availableAtMs: null },
      { ordinal: 3, tc: 3, windowStartMs: R0 + 4_000, windowEndMs: R0 + 9_000, completeAtMs: R0 + 9_000, presentedBy: 3, availableAtMs: null },
      { ordinal: 4, tc: 4, windowStartMs: R0 + 4_000, windowEndMs: R0 + 9_000, completeAtMs: R0 + 9_000, presentedBy: 3, availableAtMs: null },
      { ordinal: 5, tc: 5, windowStartMs: R0 + 9_000, windowEndMs: R0 + 9_000 + pace('fifth'), completeAtMs: R0 + 9_000, presentedBy: 5, availableAtMs: null },
      { ordinal: 6, tc: 6, windowStartMs: R1, windowEndMs: R1 + 5_000, completeAtMs: R1 + 5_000, presentedBy: 6, availableAtMs: null },
    ]);
  });

  it('refuses what it cannot place without skipping: a text moment inside one run\'s moments', () => {
    const textInside = MOMENTS.map((m) => (m.ordinal === 3 ? { ...m, originalMedium: 'ORIGINAL_TEXT' as const, text: 'typed' } : m));
    const plan = planFor(textInside, [{ durationMs: 9_000, spans: [RUN0[0]!, { kind: 'WINDOW', fromMs: 4_000, toMs: 9_000, track: 'QANDEEL', momentOrdinal: 4 }] }, SHAPES[1]!], [CROSS]);
    expect(plan).not.toBeNull(); // CP1-B accepts it; the server never groups it so (0195 `kept`/`grouped`)
    expect(replayPresentationClock(plan!, textInside, paceOf)).toBeNull();
  });
});

describe('RB-1 · NO ANALYSIS BEFORE SPEECH, on the timeline', () => {
  const c = clockOf();
  const tl = timelineOf(c.inputs, c.durationMs);
  const at = new Map(tl.steps.map((s) => [s.ordinal, s.atMs] as const));

  it('1 · never before the spoken turn has completed (its window\'s end), a later unit included', () => {
    expect(at.get(2)).toBe(R0 + 6_000);
    expect(at.get(3)).toBe(R0 + 9_000);
    expect(at.get(4)).toBe(R0 + 9_000);
    for (const input of c.inputs) {
      const step = tl.steps.find((s) => s.ordinal === input.ordinal);
      if (step !== undefined) expect(step.atMs).toBeGreaterThanOrEqual(input.completeAtMs);
    }
  });

  it('3 · overlapping windows: the causal boundary is the latest end among the windows it depends on (running maximum)', () => {
    // A short QANDEEL interjection wholly inside a long USER window: K(3) contains K(2), so it waits for 2's end too.
    const tl2 = timelineOf([
      { ordinal: 2, tc: 2, windowStartMs: 0, windowEndMs: 10_000, completeAtMs: 10_000, availableAtMs: null },
      { ordinal: 3, tc: 3, windowStartMs: 2_000, windowEndMs: 3_000, completeAtMs: 3_000, availableAtMs: null },
    ], 12_000);
    expect(tl2.steps.map((s) => [s.ordinal, s.atMs])).toEqual([[2, 10_000], [3, 10_000]]);
    expect(knowledgeAt(tl2, 9_999)).toBeNull();
  });

  it('8 · a disclosure at or after the end is never pulled back into the last frame: it is listed, not drawn', () => {
    // Moment 6's window ends where the Replay does: nothing is drawn for it (the end-of-Replay policy is a PO decision).
    expect(at.has(6)).toBe(false);
    expect(tl.afterEnd).toEqual([6]);
    expect(knowledgeAt(tl, c.durationMs)).toBe(5);
    const last = Math.floor((c.durationMs * FPS) / 1000) - 1;
    expect(knowledgeAt(tl, (last * 1000) / FPS)).toBe(5);
  });

  it('6 · a missing availability is UNESTABLISHED, never RECORDED, and carries no held-by-guard precision', () => {
    for (const s of tl.steps) {
      expect(s.availability).toBe('UNESTABLISHED_PRESENTATION_GUARDS_ONLY');
      expect(s.heldByGuardMs).toBeNull();
    }
    expect(tl.unrecorded).toEqual([1, 2, 3, 4, 5]);
    expect(tl.availabilityEstablished).toBe(false);
  });

  it('frames round forwards: the first drawing frame is at or after the disclosure', () => {
    for (const s of tl.steps) {
      expect((s.frame * 1000) / FPS).toBeGreaterThanOrEqual(s.atMs - 1e-9);
      expect(((s.frame - 1) * 1000) / FPS).toBeLessThan(s.atMs);
    }
  });
});

describe('RB-2 CONTRACT (synthetic recorded instants; no production source until RB-2) · the availability guard', () => {
  it('2 · never before an authoritative availability: a later recorded instant decides, an earlier one is held to the speech', () => {
    const c = clockOf();
    const inputs = c.inputs.map((m) => (m.ordinal === 2 ? { ...m, availableAtMs: R0 + 8_200 } : m.ordinal === 3 ? { ...m, availableAtMs: R0 + 5_000 } : { ...m, availableAtMs: m.completeAtMs }));
    const tl = timelineOf(inputs, c.durationMs);
    const step = (o: number) => tl.steps.find((s) => s.ordinal === o)!;
    expect(step(2)).toMatchObject({ atMs: R0 + 8_200, availability: 'RECORDED', heldByGuardMs: 0 });
    // Recorded before QANDEEL finished speaking: held to the window's end, and the hold is reported.
    expect(step(3)).toMatchObject({ atMs: R0 + 9_000, availability: 'RECORDED', heldByGuardMs: 4_000 });
    expect(tl.availabilityEstablished).toBe(true);
  });
});

describe('RB-1 S2 · the stage time is the audio clock\'s place (never the wall clock, never the reading pace)', () => {
  const c = clockOf();

  it('a text moment is paced inside its own block; an audio moment follows the place, lagged by the stated allowance', () => {
    expect(replayStageTime(c, 1, { phase: 'IDLE', ordinal: null, place: null })).toEqual({ kind: 'PACED', startMs: 0, endMs: P1, behindMs: REPLAY_STAGE_AUDIO_LAG_MS });
    expect(replayStageTime(c, 2, { phase: 'RUNNING', ordinal: 2, place: { kind: 'RUN', runIndex: 0, positionMs: 2_000 } }))
      .toEqual({ kind: 'AUDIO', t: R0 + 2_000 - REPLAY_STAGE_AUDIO_LAG_MS });
    // Not running (never played, released, failed): the start of the moment shown, where the player starts it.
    expect(replayStageTime(c, 6, { phase: 'IDLE', ordinal: null, place: null })).toEqual({ kind: 'AT', t: R1 });
    // A place that is not the moment shown (paused at 2, then the Spine moved to 6): the moment's start, never the old place.
    expect(replayStageTime(c, 6, { phase: 'HELD', ordinal: 2, place: { kind: 'RUN', runIndex: 0, positionMs: 2_000 } })).toEqual({ kind: 'AT', t: R1 });
    // Paused at 6 while a later place is still held (a backward Spine move while paused): never the later place.
    expect(replayStageTime(c, 2, { phase: 'HELD', ordinal: 6, place: { kind: 'RUN', runIndex: 1, positionMs: 3_000 } })).toEqual({ kind: 'AT', t: R0 });
  });

  it('1 · a text block after a run is drawn behind by the same allowance: the run\'s last speech is not shown on the end report', () => {
    // Emulator proof (RB-1, rl01): at a run's end the player shows the next (text) moment as soon as the file reports its end,
    // and the paced block started AT its start — the disclosure of the run's last speech (completed at that very instant)
    // was drawn 18–52 ms after the report, inside the 43 ms the reported place leads what is heard (CA-07B-2). The text
    // block's paced time now runs the same allowance behind, so that disclosure is drawn no earlier than the audio's.
    const end = { phase: 'DONE' as const, ordinal: 4, place: { kind: 'RUN' as const, runIndex: 0, positionMs: 9_000 } };
    expect(replayStageTime(c, 5, end)).toEqual({ kind: 'PACED', startMs: R0 + 9_000, endMs: R1 - 1_500, behindMs: REPLAY_STAGE_AUDIO_LAG_MS });
    const tl = timelineOf(c.inputs, c.durationMs);
    // The block's first drawn instant (paced 0 ms into it) is before the run's last disclosure; the allowance later, it is drawn.
    const step4 = tl.steps.find((s) => s.ordinal === 4)!;
    expect(step4.atMs).toBe(R0 + 9_000);
    expect(knowledgeAt(tl, R0 + 9_000 - REPLAY_STAGE_AUDIO_LAG_MS)).not.toBe(4);
  });

  it('5 · the reading pace moves only the text blocks; an audio place gives the same offset into its run', () => {
    const slow = clockOf((m) => 2 * paceOf(m));
    for (const position of [0, 1_234, 8_999]) {
      expect(slow.at({ kind: 'RUN', runIndex: 0, positionMs: position }) - slow.runStartMs(0)).toBe(position);
      expect(c.at({ kind: 'RUN', runIndex: 0, positionMs: position }) - c.runStartMs(0)).toBe(position);
    }
  });
});

describe('RB-1 S2 · end to end on the CP1-B player and clock (fake engine and streaming player, jest\'s fake clock)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /**
   * One sample per 50 ms of the fake clock: the stage time the world would draw. Afterwards, what was being heard at each
   * wall instant, as presentation time: the newest audible piece started by then (a seek starts a new one), at its own
   * place in it (its last place once it stopped). The fake streaming player has no output latency: what it plays is heard.
   */
  async function playThrough(steps: (w: ReturnType<typeof world>, elapsed: number, sampled: number) => Promise<void> | void, totalMs: number) {
    const w = world();
    await w.open();
    const c = replayPresentationClock(w.clock()!.detail().plan ?? PLAN, MOMENTS, paceOf) ?? clockOf();
    const samples: { wall: number; t: number | null; kind: string; ordinal: number | undefined; phase: string; place: string | null; pos: number | null }[] = [];
    w.player.play();
    for (let elapsed = 0; elapsed < totalMs; elapsed += 50) {
      await steps(w, elapsed, samples.length);
      const clock = w.clock()!;
      const shown = w.ordinal()!;
      const place = clock.place();
      const st = replayStageTime(c, shown, { phase: clock.getState().phase, ordinal: clock.getState().ordinal, place });
      samples.push({ wall: Date.now(), t: st.kind === 'PACED' ? null : st.t, kind: st.kind, ordinal: shown, phase: clock.getState().phase, place: place?.kind ?? null, pos: place === null ? null : c.at(place) });
      await run(50);
    }
    // A piece is recorded when it stops: stop the last one.
    w.player.pause();
    await run(0);
    const heard = w.heard().map((h) => ({ from: c.runStartMs(h.run) + h.from, to: c.runStartMs(h.run) + h.to, at: h.at, until: h.until }));
    const heardAt = (wall: number): number => {
      let piece: (typeof heard)[number] | null = null;
      for (const h of heard) if (h.at <= wall && (piece === null || h.at >= piece.at)) piece = h;
      return piece === null ? -Infinity : piece.from + Math.min(piece.to - piece.from, wall - piece.at);
    };
    return { w, c, samples, heardBy: heardAt };
  }

  it('4 · plays, pauses, resumes and seeks with the map on the audio: the stage never runs ahead of what was heard', async () => {
    const pausedAt: number[] = [];
    const { c, samples, heardBy } = await playThrough(async (w, elapsed, sampled) => {
      if (elapsed === 6_000) { w.player.pause(); pausedAt.push(sampled); }
      if (elapsed === 8_000) w.player.play();
      if (elapsed === 12_000) w.player.seek(6);
    }, 20_000);
    const tl = timelineOf(c.inputs, c.durationMs);
    const audio = samples.filter((s) => s.kind === 'AUDIO');
    expect(audio.length).toBeGreaterThan(100);
    for (const s of audio) {
      // The reference: while a file plays, what is being heard (the fake player has no output latency); while the clock waits
      // for a file (a seek, a start) or holds its boundary pause, its own place (silence advances nothing that was heard).
      const heard = s.phase === 'RUNNING' && s.place === 'RUN' ? heardBy(s.wall) : s.pos!;
      expect(s.t!).toBeLessThanOrEqual(s.pos! + 1e-6);
      expect(s.t!).toBeLessThanOrEqual(heard + 1e-6);
      // And every disclosure drawn at t is of speech presented to its window's end by then.
      for (const step of tl.steps) if (step.atMs <= s.t!) expect(heard).toBeGreaterThanOrEqual(c.inputs.find((m) => m.ordinal === step.ordinal)!.completeAtMs);
    }
    // Pause holds the stage; resume continues from the same place; the seek lands at moment 6's window.
    const during = samples.slice(pausedAt[0]! + 1, pausedAt[0]! + 38).filter((s) => s.kind === 'AUDIO').map((s) => s.t);
    expect(new Set(during).size).toBe(1);
    const afterSeek = samples.find((s) => s.ordinal === 6 && s.kind !== 'PACED')!;
    expect(afterSeek.t).toBeGreaterThanOrEqual(R1 - REPLAY_STAGE_AUDIO_LAG_MS - 1);
    expect(afterSeek.t).toBeLessThanOrEqual(R1 + 1);
  });

  it('5 · the wall clock is ignored: while the audio waits (PREPARING after a seek), the stage does not move', async () => {
    const { samples } = await playThrough((w, elapsed) => {
      if (elapsed === 5_000) w.player.seek(6);
    }, 6_000);
    const preparing = samples.filter((s) => s.ordinal === 6 && s.phase === 'PREPARING').map((s) => s.t);
    expect(preparing.length).toBeGreaterThan(1);
    expect(new Set(preparing).size).toBe(1);
  });

  it('the measured stage lag behind the heard audio stays within the allowance plus one report interval', async () => {
    const { samples, heardBy } = await playThrough(() => undefined, 14_000);
    const lags = samples.filter((s) => s.kind === 'AUDIO' && s.phase === 'RUNNING' && s.place === 'RUN').map((s) => heardBy(s.wall) - s.t!).filter(Number.isFinite);
    expect(lags.length).toBeGreaterThan(50);
    expect(Math.min(...lags)).toBeGreaterThanOrEqual(0);
    // The clock's moment report can trail the place by one status tick (250 ms) at a window start: the stage then holds.
    expect(Math.max(...lags)).toBeLessThanOrEqual(REPLAY_STAGE_AUDIO_LAG_MS + 250 + 1);
  });
});

describe('RB-1 S3 · the export on the same presentation clock', () => {
  const c = clockOf();
  const tl = timelineOf(c.inputs, c.durationMs);
  const scene = sceneOf(tl);

  it('places each run\'s file at the clock\'s own offset, and silence (no file) in text blocks and pauses', () => {
    expect(replayExportAudio(c)).toEqual([{ runIndex: 0, atMs: R0, durationMs: 9_000 }, { runIndex: 1, atMs: R1, durationMs: 5_000 }]);
  });

  it('7 · the same presentation position gives the same frame in the app and in the video', () => {
    for (let k = 0; k < Math.floor((c.durationMs * FPS) / 1000); k += 7) {
      const t = (k * 1000) / FPS;
      const place = c.placeAt(t);
      // The video draws frame k at t; an in-app stage whose audio is at that place draws the same t (before its lag).
      if (place !== null) expect(c.at(place)).toBeCloseTo(t, 9);
      expect(JSON.stringify(replayFrameFacts(scene, t))).toBe(JSON.stringify(replayFrameFacts(sceneOf(tl), t)));
    }
  });

  it('10 · no camera move and no reveal anticipates a disclosure, on any video frame', () => {
    expect(planFutureViolations(scene.plan, tl, STAGES)).toEqual([]);
    const completeOf = new Map(c.inputs.map((m) => [m.ordinal, m.completeAtMs] as const));
    for (const s of scene.plan.segments) expect(s.t0).toBeGreaterThanOrEqual(completeOf.get(s.source.ordinal)!);
    for (let k = 0; k < Math.floor((c.durationMs * FPS) / 1000); k += 1) {
      const t = (k * 1000) / FPS;
      const facts = replayFrameFacts(scene, t);
      const step = tl.steps.find((s) => s.ordinal === facts.knowledge);
      if (step !== undefined) expect(step.atMs).toBeLessThanOrEqual(t);
      const { segment } = cameraAt(scene.plan, t);
      if (segment !== null) expect(segment.source.atMs).toBeLessThanOrEqual(t);
    }
  });
});

describe('RB-1 · the text-only fallback is preserved (no audio claim)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('9 · a version with no audio gets no clock: the stage keeps the reading pace exactly as before', async () => {
    const w = world({ contract: REPLAY_RENDER_CONTRACT_V1, moments: MOMENTS_AS_TEXT });
    await w.open();
    expect(w.clock()).toBeNull();
    // Text moments disclose at their window's start, as the shipped (S7-03) Replay did: unchanged.
    let start = 0;
    const inputs = MOMENTS_AS_TEXT.map((m) => {
      const windowStartMs = start;
      start += paceOf(m);
      return { ordinal: m.ordinal, tc: m.tc, windowStartMs, windowEndMs: start, completeAtMs: windowStartMs, availableAtMs: null };
    });
    const tl = timelineOf(inputs);
    expect(tl.initialOrdinal).toBe(1);
    expect(tl.steps.map((s) => s.atMs)).toEqual(inputs.slice(1).map((m) => m.windowStartMs));
  });
});
