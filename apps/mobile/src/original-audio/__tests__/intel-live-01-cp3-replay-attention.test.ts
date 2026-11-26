import { CROSS, MOMENTS, REPLAY, RUN0, RUN1, VERSION, run, world } from '../__fixtures__/replay-audio-world';
import { planFor, type ReplayAudioPlan } from '../replay-audio-clock';
import { bindReplayAttention, decodeReplayAttention } from '../replay-attention';
import { createReplayAttentionSource, type ReplayAttentionSourceOptions } from '../replay-attention-source';
import { presentationMapDigest } from '../replay-availability';
import { replayAttentionOf } from '../../replay-cosmos/attention-lane';
import { TransientMediaApiClient, type TransientAvailabilityResult } from '../transient-media-api';

// INTEL-LIVE-01 CP3 (D-CP3, PO 2026-11-26) — the phone reads the calls' attention answer (0205) through the AC-01 seam and
// uses it only when it is exactly well formed and bound to what the player presents. Synthetic only: no customer content.

const SOURCE_WINDOWS = `sha256:${'c'.repeat(64)}`;
const PLAN: ReplayAudioPlan = planFor(MOMENTS, [{ durationMs: 9_000, spans: RUN0 }, { durationMs: 5_000, spans: RUN1 }], [CROSS])!;
const MAP_DIGEST = presentationMapDigest(PLAN.runs, PLAN.boundaries)!;
const THREAD = 'e0000000-0000-4000-8000-000000000005';

type Wire = Record<string, unknown>;
const produced = (runIndex: number, fileMs: number) => ({ kind: 'IN_RECORDING', runIndex, fileMs, basis: 'PRODUCED_POSITION' });
const EVENTS: Wire[] = [
  { call: 1, seq: 1, track: 'USER', op: 'SET', subjectKey: 'manager', label: 'manager', kind: 'PERSON', confidence: 'HIGH', threadRef: null, anchor: { runIndex: 0, fileMs: 1_200 }, floor: produced(0, 1_900) },
  { call: 1, seq: 2, track: 'QANDEEL', op: 'SET', subjectKey: 'plan', label: 'the plan', kind: 'PLAN', confidence: 'MEDIUM', threadRef: null, anchor: { runIndex: 0, fileMs: 4_500 }, floor: produced(0, 5_200) },
  { call: 1, seq: 3, track: 'USER', op: 'WITHDRAW', subjectKey: 'manager', label: 'manager', kind: 'PERSON', confidence: 'HIGH', threadRef: null, anchor: { runIndex: 0, fileMs: 5_000 }, floor: produced(0, 5_600) },
  { call: 1, seq: 4, track: 'QANDEEL', op: 'EXPIRED', subjectKey: 'plan', label: 'the plan', kind: 'PLAN', confidence: 'MEDIUM', threadRef: null, anchor: null, floor: { kind: 'AFTER_END', basis: 'SETTLED_THROUGH' } },
  { call: 2, seq: 1, track: 'USER', op: 'SET', subjectKey: 'trip', label: 'السفر', kind: 'EXPERIENCE', confidence: 'LOW', threadRef: THREAD, anchor: { runIndex: 1, fileMs: 1_000 }, floor: produced(1, 1_800) },
];
const body = (over: Wire = {}, events: Wire[] = EVENTS): Wire => ({
  replayId: REPLAY, versionId: VERSION, revision: 1, sourceWindowBindingDigest: SOURCE_WINDOWS, mapDigest: MAP_DIGEST, events, ...over,
});
const expectation = { replayId: REPLAY, versionId: VERSION, runs: PLAN.runs };
const decode = (b: unknown) => decodeReplayAttention(b, expectation);
const withEvent = (index: number, over: Wire) => body({}, EVENTS.map((e, i) => (i === index ? { ...e, ...over } : e)));

describe('CP3 · the decoder: exact, refused whole, never repaired', () => {
  it('reads the answer as the server serialized it (call, then event_seq), every placement inside the held map', () => {
    const a = decode(body())!;
    expect(a.binding).toEqual({ replayId: REPLAY, versionId: VERSION, revision: 1, sourceWindowBindingDigest: SOURCE_WINDOWS, mapDigest: MAP_DIGEST });
    expect(a.events.map((e) => [e.call, e.seq, e.track, e.op, e.subjectKey, e.anchor, e.floor])).toEqual([
      [1, 1, 'USER', 'SET', 'manager', { runIndex: 0, fileMs: 1_200 }, { kind: 'IN_RECORDING', runIndex: 0, fileMs: 1_900, basis: 'PRODUCED_POSITION' }],
      [1, 2, 'QANDEEL', 'SET', 'plan', { runIndex: 0, fileMs: 4_500 }, { kind: 'IN_RECORDING', runIndex: 0, fileMs: 5_200, basis: 'PRODUCED_POSITION' }],
      [1, 3, 'USER', 'WITHDRAW', 'manager', { runIndex: 0, fileMs: 5_000 }, { kind: 'IN_RECORDING', runIndex: 0, fileMs: 5_600, basis: 'PRODUCED_POSITION' }],
      [1, 4, 'QANDEEL', 'EXPIRED', 'plan', null, { kind: 'AFTER_END', basis: 'SETTLED_THROUGH' }],
      [2, 1, 'USER', 'SET', 'trip', { runIndex: 1, fileMs: 1_000 }, { kind: 'IN_RECORDING', runIndex: 1, fileMs: 1_800, basis: 'PRODUCED_POSITION' }],
    ]);
    // An answer with no event names no map, and is still an answer (the lane is empty).
    expect(decode(body({ mapDigest: null }, []))!.events).toEqual([]);
  });

  it('refuses any other shape: keys, identity, digests, order, duplicates', () => {
    for (const bad of [
      null, [], { ...body(), extra: 1 }, body({ replayId: 'b0000000-0000-4000-8000-0000000000ff' }), body({ versionId: VERSION.toUpperCase().replace('C', 'D') }),
      body({ revision: 0 }), body({ revision: 1.5 }), body({ sourceWindowBindingDigest: 'sha256:x' }), body({ mapDigest: null }), body({ events: {} }),
      body({}, [EVENTS[1]!, EVENTS[0]!]), body({}, [EVENTS[0]!, EVENTS[0]!]), body({}, [EVENTS[4]!, EVENTS[0]!]),
    ]) expect(decode(bad)).toBeNull();
  });

  it('refuses an event that is not 0204\'s: a word outside the bounded sets, an unbounded subject or label, a non-UUID thread', () => {
    for (const over of [
      { extra: 1 }, { call: 0 }, { seq: 0 }, { track: 'NOTE' }, { op: 'ABANDONED' }, { kind: 'MOOD' }, { confidence: 'CERTAIN' },
      { subjectKey: 'Manager' }, { subjectKey: '' }, { subjectKey: 'x'.repeat(65) }, { label: '' }, { label: 'x'.repeat(41) }, { label: 'a\u0007b' },
      { threadRef: 'not-a-uuid' }, { threadRef: 7 },
    ]) expect(decode(withEvent(0, over))).toBeNull();
    // A label is bounded by characters (0204's char_length), not by UTF-16 units: 40 Arabic letters are accepted.
    expect(decode(withEvent(0, { label: 'س'.repeat(40) }))).not.toBeNull();
  });

  it('a development has words and a produced position; a settlement has neither words nor a produced position', () => {
    for (const [index, over] of [
      [0, { anchor: null }], [3, { anchor: { runIndex: 0, fileMs: 1 } }],
      [0, { floor: { ...produced(0, 1_900), basis: 'SETTLED_THROUGH' } }], [3, { floor: { kind: 'AFTER_END', basis: 'PRODUCED_POSITION' } }],
      [0, { floor: { kind: 'AFTER_END', basis: 'PRODUCED_POSITION', runIndex: 0 } }], [0, { floor: { kind: 'IN_RECORDING', runIndex: 0, fileMs: 1, basis: 'PRODUCED_POSITION', extra: 1 } }],
    ] as const) expect(decode(withEvent(index, over))).toBeNull();
  });

  it('every placement inside a run of the map held, and a floor never in a run before its words', () => {
    for (const over of [
      { anchor: { runIndex: 2, fileMs: 0 } }, { anchor: { runIndex: 0, fileMs: 9_001 } }, { anchor: { runIndex: 0, fileMs: -1 } },
      { floor: produced(1, 5_001) }, { floor: produced(3, 0) },
    ]) expect(decode(withEvent(0, over))).toBeNull();
    expect(decode(withEvent(4, { floor: produced(0, 8_000) }))).toBeNull(); // run 1's words, floor in run 0
    expect(decode(withEvent(0, { floor: produced(1, 0) }))).not.toBeNull(); // a later run is a later position
  });
});

describe('CP3 · the binding: this revision, this map, these source windows', () => {
  const a = decode(body())!;
  it('binds an answer for the held revision and map, with source windows equal to any pinned for this version', () => {
    expect(bindReplayAttention(a, { revision: 1, mapDigest: MAP_DIGEST, sourceWindowBindingDigest: null })).toEqual({ ok: true });
    expect(bindReplayAttention(a, { revision: 1, mapDigest: MAP_DIGEST, sourceWindowBindingDigest: SOURCE_WINDOWS })).toEqual({ ok: true });
  });
  it('refuses a revised version, another map, unbound or changed source windows', () => {
    expect(bindReplayAttention(a, { revision: 2, mapDigest: MAP_DIGEST, sourceWindowBindingDigest: null })).toEqual({ ok: false, reason: 'REVISION_MISMATCH' });
    expect(bindReplayAttention(a, { revision: 1, mapDigest: `sha256:${'d'.repeat(64)}`, sourceWindowBindingDigest: null })).toEqual({ ok: false, reason: 'MAP_DIGEST_MISMATCH' });
    expect(bindReplayAttention(decode(body({ sourceWindowBindingDigest: null }))!, { revision: 1, mapDigest: MAP_DIGEST, sourceWindowBindingDigest: null })).toEqual({ ok: false, reason: 'SOURCE_WINDOWS_UNBOUND' });
    expect(bindReplayAttention(a, { revision: 1, mapDigest: MAP_DIGEST, sourceWindowBindingDigest: `sha256:${'f'.repeat(64)}` })).toEqual({ ok: false, reason: 'SOURCE_WINDOWS_CHANGED' });
    // No event places nothing: the map it does not name is not a mismatch.
    expect(bindReplayAttention(decode(body({ mapDigest: null }, []))!, { revision: 1, mapDigest: MAP_DIGEST, sourceWindowBindingDigest: null })).toEqual({ ok: true });
  });
});

describe('CP3 · the client: one GET through the authorized seam, no token in the URL', () => {
  const calls: { url: string; init: unknown }[] = [];
  const client = (status: number, json: () => Promise<unknown>) => new TransientMediaApiClient({
    baseUrl: 'https://media.test',
    fetch: async (url, init) => {
      calls.push({ url, init });
      return { ok: status === 200, status, json };
    },
  });
  beforeEach(() => { calls.length = 0; });

  it('asks GET /replay/:replayId/versions/:versionId/attention and returns the body undecoded', async () => {
    await expect(client(200, async () => body()).attention(REPLAY, VERSION)).resolves.toEqual({ kind: 'ANSWER', body: body() });
    expect(calls).toEqual([{ url: `https://media.test/replay/${REPLAY}/versions/${VERSION}/attention`, init: { method: 'GET', headers: { Accept: 'application/json' } } }]);
    expect(calls[0]!.url).not.toMatch(/token|bearer|auth|key=/iu);
  });

  it('NOT_FOUND for 404; UNAVAILABLE for BUSY, any other status, an unreadable body or no answer', async () => {
    await expect(client(404, async () => ({ outcome: 'NOT_FOUND', reason: null })).attention(REPLAY, VERSION)).resolves.toEqual({ kind: 'NOT_FOUND' });
    await expect(client(503, async () => ({ outcome: 'BUSY' })).attention(REPLAY, VERSION)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    await expect(client(200, async () => { throw new Error('not json'); }).attention(REPLAY, VERSION)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    const offline = new TransientMediaApiClient({ baseUrl: 'https://media.test', fetch: async () => { throw new Error('offline'); } });
    await expect(offline.attention(REPLAY, VERSION)).resolves.toEqual({ kind: 'UNAVAILABLE' });
  });
});

describe('CP3 · the source: one request per opening, stale answers dropped, failures never masked', () => {
  function source(over: Partial<ReplayAttentionSourceOptions> = {}) {
    const pending: ((r: TransientAvailabilityResult) => void)[] = [];
    const pins: string[] = [];
    let pinned: string | null = null;
    const s = createReplayAttentionSource({
      replayId: REPLAY, versionId: VERSION, revision: 1,
      fetch: () => new Promise((resolve) => pending.push(resolve)),
      pinned: () => pinned,
      pin: (d) => { pins.push(d); pinned = d; },
      ...over,
    });
    return { s, pending, pins, setPinned: (d: string | null) => { pinned = d; } };
  }
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

  it('asks nothing before the map is held, then exactly once; BOUND carries the held map\'s digest and pins its source windows', async () => {
    const { s, pending, pins } = source();
    s.observe(null);
    expect(pending).toHaveLength(0);
    s.observe(PLAN);
    s.observe(PLAN);
    expect(pending).toHaveLength(1);
    pending[0]!({ kind: 'ANSWER', body: body() });
    await settle();
    const state = s.getState();
    expect(state.kind === 'BOUND' && state.mapDigest).toBe(MAP_DIGEST);
    expect(pins).toEqual([SOURCE_WINDOWS]);
  });

  it('every failure is its own state, and nothing is pinned for it', async () => {
    const outcomes: [TransientAvailabilityResult, unknown][] = [
      [{ kind: 'NOT_FOUND' }, { kind: 'NOT_FOUND' }],
      [{ kind: 'UNAVAILABLE' }, { kind: 'UNAVAILABLE' }],
      [{ kind: 'ANSWER', body: { ...body(), extra: 1 } }, { kind: 'REFUSED', reason: 'MALFORMED' }],
      [{ kind: 'ANSWER', body: body({ revision: 2 }) }, { kind: 'REFUSED', reason: 'REVISION_MISMATCH' }],
      [{ kind: 'ANSWER', body: body({ mapDigest: `sha256:${'d'.repeat(64)}` }) }, { kind: 'REFUSED', reason: 'MAP_DIGEST_MISMATCH' }],
      [{ kind: 'ANSWER', body: body({ sourceWindowBindingDigest: `sha256:${'f'.repeat(64)}` }) }, { kind: 'REFUSED', reason: 'SOURCE_WINDOWS_CHANGED' }],
    ];
    for (const [result, expected] of outcomes) {
      const { s, pending, pins, setPinned } = source();
      setPinned(SOURCE_WINDOWS);
      s.observe(PLAN);
      pending[0]!(result);
      await settle();
      expect(s.getState()).toEqual(expected);
      expect(pins).toHaveLength(0);
    }
  });

  it('a rejected or throwing fetch is UNAVAILABLE and never reaches the caller of observe; a late answer is dropped', async () => {
    const throwing = source({ fetch: () => { throw new Error('sync'); } });
    expect(() => throwing.s.observe(PLAN)).not.toThrow();
    await settle();
    expect(throwing.s.getState()).toEqual({ kind: 'UNAVAILABLE' });
    const rejected = source({ fetch: () => Promise.reject(new Error('x')) });
    rejected.s.observe(PLAN);
    await settle();
    expect(rejected.s.getState()).toEqual({ kind: 'UNAVAILABLE' });

    const retired = source();
    retired.s.observe(PLAN);
    retired.s.retire();
    retired.pending[0]!({ kind: 'ANSWER', body: body() });
    await settle();
    expect(retired.s.getState()).toEqual({ kind: 'PENDING' });
    const moved = source();
    moved.s.observe(PLAN);
    moved.s.observe(planFor(MOMENTS, [{ durationMs: 9_000, spans: RUN0 }, { durationMs: 5_500, spans: RUN1 }], [CROSS])!);
    moved.pending[0]!({ kind: 'ANSWER', body: body() });
    await settle();
    expect(moved.s.getState()).toEqual({ kind: 'PENDING' });
  });
});

describe('CP3 · wired: the stage clock carries Lane B beside Lane A; the audio and the availability are untouched', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('one GET once the map is held, BOUND for a bound answer; the availability and the playback ledger are unchanged', async () => {
    const w = world({ attention: async () => ({ kind: 'ANSWER', body: body() }) });
    await w.open();
    w.player.play();
    w.player.seek(2);
    await run(3_000);
    const stage = w.audio.stageClockOf(VERSION)!;
    expect(w.attentionCalls).toEqual([`${REPLAY} ${VERSION}`]);
    expect(replayAttentionOf(stage)?.kind).toBe('BOUND');
    expect(stage.availability?.()).toEqual({ kind: 'UNAVAILABLE' });
    expect(w.availabilityCalls).toHaveLength(1);
    expect(w.server.calls.some((c) => c.includes('attention'))).toBe(false);
    expect(w.clock()!.getState().phase).toBe('RUNNING');
    await run(3_000);
    expect(w.attentionCalls).toHaveLength(1);
  });

  it('a stage clock without the Lane B port, or none: no attention answer (Lane B empty)', async () => {
    const w = world();
    await w.open();
    const stage = w.audio.stageClockOf(VERSION)!;
    const { attention: _port, ...laneA } = stage as typeof stage & { attention?: unknown };
    expect(_port).toBeInstanceOf(Function);
    expect(replayAttentionOf(laneA)).toBeNull();
    expect(replayAttentionOf(null)).toBeNull();
  });

  it('source windows other than the availability answer\'s: Lane B refused, Lane A bound, the audio playing', async () => {
    const availability = {
      replayId: REPLAY, versionId: VERSION, revision: 1, sourceWindowBindingDigest: SOURCE_WINDOWS, mapDigest: MAP_DIGEST, ledgerWatermark: { sp: 7, seq: 2 },
      moments: MOMENTS.map((m) => ({ ordinal: m.ordinal, state: 'UNESTABLISHED', placement: null })),
    };
    const w = world({
      availability: async () => ({ kind: 'ANSWER', body: availability }),
      attention: async () => ({ kind: 'ANSWER', body: body({ sourceWindowBindingDigest: `sha256:${'f'.repeat(64)}` }) }),
    });
    await w.open();
    w.player.play();
    w.player.seek(2);
    await run(3_000);
    const stage = w.audio.stageClockOf(VERSION)!;
    expect(stage.availability?.().kind).toBe('BOUND');
    expect(replayAttentionOf(stage)).toEqual({ kind: 'REFUSED', reason: 'SOURCE_WINDOWS_CHANGED' });
    expect(w.clock()!.getState().phase).toBe('RUNNING');
  });
});
