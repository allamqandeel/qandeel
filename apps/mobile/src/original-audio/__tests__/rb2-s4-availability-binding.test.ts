import { CROSS, MOMENTS, REPLAY, RUN0, RUN1, VERSION, run, world } from '../__fixtures__/replay-audio-world';
import type { PresentationBoundary, PresentationRun } from '../presentation-map';
import { planFor, type ReplayAudioPlan } from '../replay-audio-clock';
import { bindReplayAvailability, decodeReplayAvailability, presentationMapDigest, type ReplayAvailabilityBinding } from '../replay-availability';
import { createReplayAvailabilitySource, type ReplayAvailabilitySourceOptions } from '../replay-availability-source';
import { TransientMediaApiClient, type TransientAvailabilityResult } from '../transient-media-api';

// RB-2 / S4-B (PO S4 execution directive, 2026-11-24) — the phone fetches S3's availability answer through the AC-01
// seam and uses it only when it is bound to exactly what the player presents. Synthetic only: no customer content.

const SOURCE_WINDOWS = `sha256:${'c'.repeat(64)}`;
const SHAPES = [{ durationMs: 9_000, spans: RUN0 }, { durationMs: 5_000, spans: RUN1 }];
const PLAN: ReplayAudioPlan = planFor(MOMENTS, SHAPES, [CROSS])!;
const MAP_DIGEST = presentationMapDigest(PLAN.runs, PLAN.boundaries)!;
const ORDINALS = MOMENTS.map((m) => m.ordinal);

/** A well-formed S3 answer for the fixture version: every moment named, 2 placed in run 0, 6 in run 1, 3 / 4 after the end. */
const body = (over: Record<string, unknown> = {}) => ({
  replayId: REPLAY, versionId: VERSION, revision: 1, sourceWindowBindingDigest: SOURCE_WINDOWS, mapDigest: MAP_DIGEST,
  ledgerWatermark: { sp: 7, seq: 2 },
  moments: [
    { ordinal: 1, state: 'RECORDED', placement: { kind: 'AFTER_END' } },
    { ordinal: 2, state: 'RECORDED', placement: { kind: 'IN_RECORDING', runIndex: 0, fileMs: 6_400 } },
    { ordinal: 3, state: 'RECORDED', placement: { kind: 'IN_RECORDING', runIndex: 0, fileMs: 9_000 } },
    { ordinal: 4, state: 'RECORDED', placement: { kind: 'IN_RECORDING', runIndex: 0, fileMs: 9_000 } },
    { ordinal: 5, state: 'RECORDED', placement: { kind: 'AFTER_END' } },
    { ordinal: 6, state: 'RECORDED', placement: { kind: 'IN_RECORDING', runIndex: 1, fileMs: 5_000 } },
  ],
  ...over,
});
const decoded = (over: Record<string, unknown> = {}) => decodeReplayAvailability(body(over), { replayId: REPLAY, versionId: VERSION, runs: PLAN.runs })!;
const held = (previous: ReplayAvailabilityBinding | null = null) => ({ revision: 1, mapDigest: MAP_DIGEST, ordinals: ORDINALS, previous });

describe('S4-B · the map digest, by the server\'s reference serialization', () => {
  // The SAME literal and golden value as apps/api/src/replay-media/transient-presentation-map.spec.ts.
  const GOLDEN = 'sha256:2f290a7fcf3091994f2b2993f67af95c34b50bca1c2e97f2620be642ff931ac7';
  // Built with every key in a DIFFERENT order from the server's: the digest must not depend on the decoded objects' order.
  const runs = [
    { spans: [
      { momentOrdinal: 2, track: 'USER', toMs: 4000, fromMs: 0, kind: 'WINDOW' },
      { shortened: true, elapsedMs: 7000, toMs: 5500, fromMs: 4000, kind: 'HELD' },
      { momentOrdinal: 3, track: 'QANDEEL', toMs: 9000, fromMs: 5500, kind: 'WINDOW' },
      { toMs: 7000, fromMs: 6000, kind: 'MIX' },
      { gapKind: 'MUTED', track: 'USER', toMs: 8500, fromMs: 8000, kind: 'GAP' },
    ], durationMs: 9000, artifactId: null },
    { spans: [{ momentOrdinal: 6, track: 'USER', toMs: 5000, fromMs: 0, kind: 'WINDOW' }], durationMs: 5000, artifactId: '00000000-0000-4000-8000-0000000000aa' },
  ] as unknown as PresentationRun[];
  const boundaries = [{ shortened: false, elapsedMs: 2500, kind: 'SAME_RECORDING' }] as unknown as PresentationBoundary[];

  it('equals the server\'s golden value for the same map, whatever the key order or the file ids held', () => {
    expect(presentationMapDigest(runs, boundaries)).toBe(GOLDEN);
  });

  it('changes with any change of the map; refuses a non-ASCII word rather than guess an encoding', () => {
    expect(presentationMapDigest([{ ...runs[0]!, durationMs: 9001 }, runs[1]!], boundaries)).not.toBe(GOLDEN);
    expect(presentationMapDigest(runs, [{ kind: 'CROSS_RECORDING' }])).not.toBe(GOLDEN);
    const odd = [{ ...runs[1]!, spans: [{ kind: 'WINDOW', fromMs: 0, toMs: 5000, track: 'USÉR', momentOrdinal: 6 }] }] as unknown as PresentationRun[];
    expect(presentationMapDigest(odd, [])).toBeNull();
  });
});

describe('S4-B · bindReplayAvailability: the whole answer, bound to what the player holds, or nothing', () => {
  it('binds an answer for this revision, this map, every moment, with source windows', () => {
    expect(bindReplayAvailability(decoded(), held())).toEqual({ ok: true });
  });

  it('refuses a revised version, another map, unbound or changed source windows, a regressed ledger, other moments', () => {
    const first = decoded().binding;
    const cases: [string, ReturnType<typeof decoded>, ReturnType<typeof held>][] = [
      ['REVISION_MISMATCH', decoded({ revision: 2 }), held()],
      ['MAP_DIGEST_MISMATCH', decoded({ mapDigest: `sha256:${'d'.repeat(64)}` }), held()],
      ['SOURCE_WINDOWS_UNBOUND', decoded({ sourceWindowBindingDigest: null }), held()],
      ['SOURCE_WINDOWS_CHANGED', decoded({ sourceWindowBindingDigest: `sha256:${'e'.repeat(64)}` }), held(first)],
      ['WATERMARK_REGRESSED', decoded({ ledgerWatermark: { sp: 6, seq: 9 } }), held(first)],
      ['WATERMARK_REGRESSED', decoded({ ledgerWatermark: { sp: 7, seq: 1 } }), held(first)],
      ['MOMENTS_MISMATCH', decoded({ moments: body().moments.slice(0, 5) }), held()],
      ['MOMENTS_MISMATCH', decoded({ moments: [...body().moments, { ordinal: 7, state: 'BROKEN', placement: null }] }), held()],
    ];
    for (const [reason, answer, h] of cases) expect([reason, bindReplayAvailability(answer, h)]).toEqual([reason, { ok: false, reason }]);
    // A later watermark, with the same source windows, is the same history read later: bound.
    expect(bindReplayAvailability(decoded({ ledgerWatermark: { sp: 7, seq: 3 } }), held(first))).toEqual({ ok: true });
  });
});

describe('S4-B · the client: one GET through the authorized seam, no token in the URL', () => {
  const calls: { url: string; init: unknown }[] = [];
  const client = (status: number, json: () => Promise<unknown>) => new TransientMediaApiClient({
    baseUrl: 'https://media.test',
    fetch: async (url, init) => {
      calls.push({ url, init });
      return { ok: status === 200, status, json };
    },
  });
  beforeEach(() => { calls.length = 0; });

  it('asks GET /replay/:replayId/versions/:versionId/availability and returns the body undecoded', async () => {
    await expect(client(200, async () => body()).availability(REPLAY, VERSION)).resolves.toEqual({ kind: 'ANSWER', body: body() });
    expect(calls).toEqual([{ url: `https://media.test/replay/${REPLAY}/versions/${VERSION}/availability`, init: { method: 'GET', headers: { Accept: 'application/json' } } }]);
    expect(calls[0]!.url).not.toMatch(/token|bearer|auth|key=/iu);
  });

  it('NOT_FOUND for 404 (revoked, deleted, retired, replaced); UNAVAILABLE for BUSY, any other status, an unreadable body or no answer', async () => {
    await expect(client(404, async () => ({ outcome: 'NOT_FOUND', reason: null })).availability(REPLAY, VERSION)).resolves.toEqual({ kind: 'NOT_FOUND' });
    await expect(client(503, async () => ({ outcome: 'BUSY' })).availability(REPLAY, VERSION)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    await expect(client(400, async () => ({})).availability(REPLAY, VERSION)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    await expect(client(200, async () => { throw new Error('not json'); }).availability(REPLAY, VERSION)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    const offline = new TransientMediaApiClient({ baseUrl: 'https://media.test', fetch: async () => { throw new Error('offline'); } });
    await expect(offline.availability(REPLAY, VERSION)).resolves.toEqual({ kind: 'UNAVAILABLE' });
  });
});

describe('S4-B · the source: one request per opening, stale answers dropped, failures never masked', () => {
  function source(over: Partial<ReplayAvailabilitySourceOptions> = {}) {
    const pending: ((r: TransientAvailabilityResult) => void)[] = [];
    const pins: ReplayAvailabilityBinding[] = [];
    let pinned: ReplayAvailabilityBinding | null = null;
    const s = createReplayAvailabilitySource({
      replayId: REPLAY, versionId: VERSION, revision: 1, ordinals: ORDINALS,
      fetch: () => new Promise((resolve) => pending.push(resolve)),
      pinned: () => pinned,
      pin: (b) => { pins.push(b); pinned = b; },
      ...over,
    });
    return { s, pending, pins, setPinned: (b: ReplayAvailabilityBinding | null) => { pinned = b; } };
  }
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

  it('asks nothing before the map is held, then exactly once for it', async () => {
    const { s, pending } = source();
    s.observe(null);
    expect(pending).toHaveLength(0);
    expect(s.getState()).toEqual({ kind: 'PENDING' });
    s.observe(PLAN);
    s.observe(PLAN);
    expect(pending).toHaveLength(1);
    pending[0]!({ kind: 'ANSWER', body: body() });
    await settle();
    expect(s.getState().kind).toBe('BOUND');
    s.observe(PLAN);
    expect(pending).toHaveLength(1);
  });

  it('BOUND only for a bound answer; every failure is its own state — never the last answer standing in', async () => {
    const outcomes: [TransientAvailabilityResult, unknown][] = [
      [{ kind: 'NOT_FOUND' }, { kind: 'NOT_FOUND' }],
      [{ kind: 'UNAVAILABLE' }, { kind: 'UNAVAILABLE' }],
      [{ kind: 'ANSWER', body: { ...body(), extra: 1 } }, { kind: 'REFUSED', reason: 'MALFORMED' }],
      [{ kind: 'ANSWER', body: body({ revision: 2 }) }, { kind: 'REFUSED', reason: 'REVISION_MISMATCH' }],
      [{ kind: 'ANSWER', body: body({ mapDigest: `sha256:${'d'.repeat(64)}` }) }, { kind: 'REFUSED', reason: 'MAP_DIGEST_MISMATCH' }],
    ];
    for (const [result, expected] of outcomes) {
      const { s, pending, pins, setPinned } = source();
      // An earlier opening of this version had bound an answer: it is a pin for checking, never a fallback.
      setPinned(decoded().binding);
      s.observe(PLAN);
      pending[0]!(result);
      await settle();
      expect(s.getState()).toEqual(expected);
      expect(pins).toHaveLength(0);
    }
  });

  it('a rejected or throwing fetch is UNAVAILABLE, and never reaches the caller of observe (the audio clock)', async () => {
    const rejected = createReplayAvailabilitySource({
      replayId: REPLAY, versionId: VERSION, revision: 1, ordinals: ORDINALS, fetch: () => Promise.reject(new Error('x')), pinned: () => null, pin: () => undefined,
    });
    rejected.observe(PLAN);
    await settle();
    expect(rejected.getState()).toEqual({ kind: 'UNAVAILABLE' });
    const throwing = createReplayAvailabilitySource({
      replayId: REPLAY, versionId: VERSION, revision: 1, ordinals: ORDINALS, fetch: () => { throw new Error('sync'); }, pinned: () => null, pin: () => undefined,
    });
    expect(() => throwing.observe(PLAN)).not.toThrow();
    await settle();
    expect(throwing.getState()).toEqual({ kind: 'UNAVAILABLE' });
  });

  it('a late answer is dropped: after the source is retired, or once another map is held', async () => {
    const retired = source();
    retired.s.observe(PLAN);
    let told = 0;
    retired.s.subscribe(() => { told += 1; });
    retired.s.retire();
    retired.pending[0]!({ kind: 'ANSWER', body: body() });
    await settle();
    expect(retired.s.getState()).toEqual({ kind: 'PENDING' });
    expect(told).toBe(0);
    expect(retired.pins).toHaveLength(0);

    const moved = source();
    moved.s.observe(PLAN);
    const other = planFor(MOMENTS, [{ durationMs: 9_000, spans: RUN0 }, { durationMs: 5_500, spans: RUN1 }], [CROSS])!;
    moved.s.observe(other);
    moved.pending[0]!({ kind: 'ANSWER', body: body() });
    await settle();
    expect(moved.s.getState()).toEqual({ kind: 'PENDING' });
  });

  it('pins the first bound answer; a later one with other source windows is refused', async () => {
    const first = source();
    first.s.observe(PLAN);
    first.pending[0]!({ kind: 'ANSWER', body: body() });
    await settle();
    expect(first.pins).toEqual([decoded().binding]);
    const second = source();
    second.setPinned(first.pins[0]!);
    second.s.observe(PLAN);
    second.pending[0]!({ kind: 'ANSWER', body: body({ sourceWindowBindingDigest: `sha256:${'f'.repeat(64)}` }) });
    await settle();
    expect(second.s.getState()).toEqual({ kind: 'REFUSED', reason: 'SOURCE_WINDOWS_CHANGED' });
  });
});

describe('S4-B · wired: the player\'s stage clock carries the bound availability; the audio is untouched', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('one GET once the map is held, BOUND for a bound answer; the playback ledger is unchanged', async () => {
    const w = world({ availability: async () => ({ kind: 'ANSWER', body: body() }) });
    await w.open();
    w.player.play();
    // Moment 1 is text (paced): the audio set, and so the map, is asked for at the first audio moment.
    w.player.seek(2);
    await run(3_000);
    const stage = w.audio.stageClockOf(VERSION)!;
    expect(w.availabilityCalls).toEqual([`${REPLAY} ${VERSION}`]);
    expect(stage.availability?.().kind).toBe('BOUND');
    expect(w.server.calls.some((c) => c.includes('availability'))).toBe(false);
    expect(stage.place()).toEqual(w.clock()!.place());
    await run(3_000);
    expect(w.availabilityCalls).toHaveLength(1);
  });

  it('a refused answer leaves the audio playing exactly as before, and the stage neutral', async () => {
    const w = world({ availability: async () => ({ kind: 'ANSWER', body: body({ revision: 9 }) }) });
    await w.open();
    w.player.play();
    // Moment 1 is text (paced): the audio set, and so the map, is asked for at the first audio moment.
    w.player.seek(2);
    await run(3_000);
    expect(w.audio.stageClockOf(VERSION)!.availability?.()).toEqual({ kind: 'REFUSED', reason: 'REVISION_MISMATCH' });
    expect(w.clock()!.getState().phase).toBe('RUNNING');
  });

  it('an unavailable answer (BUSY, offline): UNAVAILABLE, the stage neutral, the audio playing', async () => {
    const w = world();
    await w.open();
    w.player.play();
    // Moment 1 is text (paced): the audio set, and so the map, is asked for at the first audio moment.
    w.player.seek(2);
    await run(3_000);
    expect(w.audio.stageClockOf(VERSION)!.availability?.()).toEqual({ kind: 'UNAVAILABLE' });
  });
});
