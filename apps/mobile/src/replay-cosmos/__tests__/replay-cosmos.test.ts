/**
 * REPLAY-COSMOS-01 — the Replay's ONE timeline, camera plan and frame, on synthetic history (no customer content).
 *
 * The scenes are built as T-04 discloses them (Threads at WORLD, their Reading appearances from THREAD down) and go
 * through the production Personal chain. What is proven: availability authority with the SP/TC guard kept; causal
 * frames; a range that opens on the knowledge authorised at its start and keeps every millisecond; a camera that never
 * aims at, or moves before, a disclosure; and a frame that is a pure function of presentation time (seek = play).
 */
import { buildReplayCameraPlan, cameraAt, planFutureViolations } from '../camera-plan';
import { replayFrameFacts, REVEAL_MS } from '../frame';
import { marksOf } from '../stages';
import { buildReplayCosmosTimeline, frameTimeMs, knowledgeAt, knowledgeOnFrame, type ReplayCosmosMomentInput, type ReplayCosmosTimeline } from '../timeline';
import { KNOWLEDGE, STAGES, VIEW, sceneOf, stageOf } from '../__fixtures__/synthetic-history';

// Six text-presented moments of 4 s (each shown whole at its window's start, so the speech guard is that start; the
// audio case — a window's END — is RB-1's own suite, rb1-audio-clock.test.ts).
const moments = (available: (ordinal: number, start: number) => number | null): ReplayCosmosMomentInput[] =>
  [1, 2, 3, 4, 5, 6].map((ordinal) => ({ ordinal, tc: ordinal, windowStartMs: (ordinal - 1) * 4000, windowEndMs: ordinal * 4000, completeAtMs: (ordinal - 1) * 4000, availableAtMs: available(ordinal, (ordinal - 1) * 4000) }));
const built = (input: ReplayCosmosMomentInput[], scope: Parameters<typeof buildReplayCosmosTimeline>[1] = { kind: 'FULL' }): ReplayCosmosTimeline => {
  const r = buildReplayCosmosTimeline(input, scope, { fps: 30, unrecorded: 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY' });
  if (!r.ok) throw new Error(r.reason);
  return r.timeline;
};

describe('the timeline: availability is the authority, and the no-future guard stays independent', () => {
  it('discloses at the recorded availability, never before its own moment or the knowledge it contains', () => {
    // Recorded (synthetic, an RB-2 contract case): 1.5 s into each window, except moment 3 (recorded BEFORE its window, which
    // cannot be shown: the SP/TC guard holds it) and moment 5 (recorded later than moment 6: K(6) contains K(5)).
    const tl = built(moments((o, start) => (o === 3 ? start - 900 : o === 5 ? 23_500 : start + 1500)));
    const at = new Map(tl.steps.map((s) => [s.ordinal, s] as const));
    expect(tl.initialOrdinal).toBeNull();
    expect(at.get(1)!.atMs).toBe(1500);
    expect(at.get(3)!.atMs).toBe(8000); // held to its window start
    expect(at.get(3)!.heldByGuardMs).toBe(900);
    expect(at.get(5)!.atMs).toBe(23_500);
    expect(at.get(6)!.atMs).toBe(23_500); // never before K(5)
    expect(tl.unrecorded).toEqual([]);
    for (const s of tl.steps) expect(s.atMs).toBeGreaterThanOrEqual((s.ordinal - 1) * 4000);
  });

  it('names an unrecorded availability as UNESTABLISHED, and reports it — nothing is inferred, no precision claimed', () => {
    const tl = built(moments((o, start) => (o === 2 ? null : start + 700)));
    expect(tl.unrecorded).toEqual([2]);
    expect(tl.steps.find((s) => s.ordinal === 2)).toMatchObject({ availability: 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY', atMs: 4000, heldByGuardMs: null });
    expect(tl.availabilityEstablished).toBe(false);
    expect(tl.steps.find((s) => s.ordinal === 1)).toMatchObject({ availability: 'RECORDED' });
  });

  it('frames are causal: the first frame at or after the disclosure, lag in [0, 33.33) ms, never the nearest', () => {
    const tl = built(moments((_, start) => start + 1517)); // 1517 ms: frame 45.51 → 46 (nearest would be 46; 1501 → 46 vs nearest 45)
    const odd = built(moments((_, start) => start + 1501));
    for (const s of [...tl.steps, ...odd.steps]) {
      expect(frameTimeMs(tl, s.frame)).toBeGreaterThanOrEqual(s.atMs - 1e-9);
      expect(frameTimeMs(tl, s.frame - 1)).toBeLessThan(s.atMs);
      expect(s.frameLagMs).toBeGreaterThanOrEqual(0);
      expect(s.frameLagMs).toBeLessThan(1000 / 30);
    }
    const first = odd.steps[0];
    expect(first.frame).toBe(46); // 1501 ms × 30 / 1000 = 45.03 → 46, where the nearest frame (45) would be early
    expect(knowledgeOnFrame(odd, 45)).toBeNull();
    expect(knowledgeOnFrame(odd, 46)).toBe(1);
  });

  it('an exact boundary is its own frame (no epsilon drift)', () => {
    const tl = built(moments((_, start) => start + 1000));
    expect(tl.steps[0]).toMatchObject({ atMs: 1000, frame: 30, frameLagMs: 0 });
  });

  it('a range opens on the knowledge authorised AT its start — never the final state, never nothing — and keeps every ms', () => {
    const full = built(moments((_, start) => start + 1500));
    const range = built(moments((_, start) => start + 1500), { kind: 'RANGE', startMs: 13_250, endMs: 21_100 });
    expect(range.durationMs).toBe(7850);
    expect(range.initialOrdinal).toBe(knowledgeAt(full, 13_250)); // moment 4 is available at 13 500: still K(3)
    expect(range.initialOrdinal).toBe(3);
    expect(range.steps.map((s) => [s.ordinal, s.atMs])).toEqual([[4, 250], [5, 4250]]);
    // Windows are clipped, not dropped or snapped: the partial first and last windows are kept.
    expect(range.windows[0]).toEqual({ ordinal: 4, startMs: 0, endMs: 2750 });
    expect(range.windows.at(-1)).toEqual({ ordinal: 6, startMs: 6750, endMs: 7850 });
    for (let t = 0; t <= range.durationMs; t += 50) expect(knowledgeAt(range, t)).toBe(knowledgeAt(full, t + 13_250));
  });

  it('refuses a scope outside the version, a reversed scope, and out-of-order moments', () => {
    const input = moments(() => null);
    expect(buildReplayCosmosTimeline(input, { kind: 'RANGE', startMs: 0, endMs: 24_001 }, { fps: 30, unrecorded: 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY' }).ok).toBe(false);
    expect(buildReplayCosmosTimeline(input, { kind: 'RANGE', startMs: 5000, endMs: 5000 }, { fps: 30, unrecorded: 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY' }).ok).toBe(false);
    expect(buildReplayCosmosTimeline([input[1], input[0]], { kind: 'FULL' }, { fps: 30, unrecorded: 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY' }).ok).toBe(false);
  });
});

describe('the camera plan: one guided camera, justified by what is already visible', () => {
  const tl = built(moments((_, start) => start + 1500));
  const plan = buildReplayCameraPlan(tl, STAGES, VIEW);

  it('every segment starts at or after its disclosure and aims only at marks visible then', () => {
    expect(plan.segments.length).toBeGreaterThan(0);
    expect(planFutureViolations(plan, tl, STAGES)).toEqual([]);
    for (let i = 1; i < plan.segments.length; i += 1) expect(plan.segments[i].t0).toBeGreaterThanOrEqual(plan.segments[i - 1].t1);
    expect(plan.segments.map((s) => s.kind)).toEqual(expect.arrayContaining(['APPROACH_TOPIC', 'REVEAL_CONNECTION', 'FOLLOW_CONNECTION', 'FRAME_ESTABLISHED_TOPICS']));
  });

  it('a planted future target is caught', () => {
    const early = { ...plan, segments: plan.segments.map((s, i) => (i === 0 ? { ...s, t0: s.source.atMs - 1 } : s)) };
    expect(planFutureViolations(early, tl, STAGES).length).toBeGreaterThan(0);
  });

  it('is deterministic and pure: rebuilt, it is the same plan, and the camera at t does not depend on how t was reached', () => {
    expect(JSON.stringify(buildReplayCameraPlan(tl, STAGES, VIEW))).toBe(JSON.stringify(plan));
    const forward = [0, 1500, 3000, 9000, 14_000, 20_000, 23_999].map((t) => cameraAt(plan, t).camera);
    const sought = [23_999, 9000, 0, 20_000, 1500, 14_000, 3000].map((t) => [t, cameraAt(plan, t).camera] as const);
    const order = [0, 1500, 3000, 9000, 14_000, 20_000, 23_999];
    for (const [t, camera] of sought) expect(camera).toEqual(forward[order.indexOf(t)]);
  });

  it('moves smoothly: no frame-to-frame jump beyond the bound the RL02 proof measured', () => {
    let worst = 0;
    for (let f = 1; f < (tl.durationMs * 30) / 1000; f += 1) {
      const a = cameraAt(plan, ((f - 1) * 1000) / 30).camera; const b = cameraAt(plan, (f * 1000) / 30).camera;
      // The screen speed of the view's centre, in points per frame, at the average scale.
      const s = Math.sqrt(a.scale * b.scale);
      worst = Math.max(worst, Math.hypot(b.cx - a.cx, b.cy - a.cy) * s);
    }
    expect(worst).toBeLessThan(60);
  });

  it('a range plan opens framing the topics known at its start, not the origin', () => {
    const range = built(moments((_, start) => start + 1500), { kind: 'RANGE', startMs: 13_250, endMs: 21_100 });
    const rp = buildReplayCameraPlan(range, STAGES, VIEW);
    expect(rp.initial).not.toEqual({ cx: 0, cy: 0, scale: 1 });
    expect(planFutureViolations(rp, range, STAGES)).toEqual([]);
  });
});

describe('the frame: a pure function of presentation time (the app and the video draw the same t the same way)', () => {
  const tl = built(moments((_, start) => start + 1500));
  const scene = sceneOf(tl);

  it('never draws knowledge before its disclosure, in any frame', () => {
    for (let f = 0; f <= (tl.durationMs * 30) / 1000; f += 1) {
      const t = (f * 1000) / 30;
      const facts = replayFrameFacts(scene, t);
      const step = tl.steps.find((s) => s.ordinal === facts.knowledge);
      if (step !== undefined) expect(step.atMs).toBeLessThanOrEqual(t);
      expect(facts.knowledge).toBe(knowledgeOnFrame(tl, f));
    }
  });

  it('a disclosure is already visible on its first frame and complete after the reveal', () => {
    const s4 = tl.steps.find((s) => s.ordinal === 4)!;
    const first = replayFrameFacts(scene, frameTimeMs(tl, s4.frame));
    expect(first.knowledge).toBe(4);
    expect(first.mix).toBeGreaterThan(0);
    expect(first.previous).toBe(3);
    expect(replayFrameFacts(scene, s4.atMs + REVEAL_MS).mix).toBe(1);
    expect(replayFrameFacts(scene, s4.atMs + REVEAL_MS).previous).toBeNull();
  });

  it('seek backward / forward, and pause / resume, give exactly the frame playing to t gives', () => {
    const at = (t: number) => JSON.stringify(replayFrameFacts(scene, t));
    const played = [0, 5000, 13_600, 17_000, 23_000].map(at);
    expect([23_000, 0, 17_000, 5000, 13_600].map(at)).toEqual([played[4], played[0], played[3], played[1], played[2]]);
    // A pause holds t; the frame at a held t is the same however long it is held.
    expect(at(13_600)).toBe(played[2]);
  });

  it('labels are only the names the Replay disclosed (none invented)', () => {
    const unnamed = stageOf(5, KNOWLEDGE[5]);
    expect(unnamed.list.layers.every((l) => l.labels.length === 0)).toBe(true);
    const named = STAGES.get(5)!;
    expect(named.list.layers[0].labels.map((l) => l.text).sort()).toEqual(['Family', 'السفر 2026', 'العمل']);
    expect(marksOf(named.list).threads).toHaveLength(3);
  });
});
