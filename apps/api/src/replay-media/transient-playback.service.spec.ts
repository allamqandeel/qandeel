import { HttpException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { TransientAudioStore } from './transient-audio.store';
import type { ReplayAttentionRow, ReplayAvailabilityRow, TransientMapRow, TransientMediaRepository, TransientSetRow } from './transient-media.repository';
import { TransientPlaybackService } from './transient-playback.service';

// S8B-07 CP1-B step 3 — the Replay Media Service's translation of the database's answers into the approved wire, against
// a scripted repository and store. The real PostgreSQL, the rclone store and the HTTP routes are proven by
// database/prove-0196-media-service.mjs (V-31 API, V-32, V-34, V-35a).
const USER = randomUUID();
const CALL = randomUUID();
const REPLAY = randomUUID();
const VERSION = randomUUID();
const COMMAND = randomUUID();
const KEY = `voice-transient/${randomUUID()}`;

const failureOf = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => (e instanceof HttpException ? [e.getStatus(), e.getResponse()] : ['THROWN', String(e)]));
const pgError = (code: string, message: string, detail?: string) => Object.assign(new Error(message), { code, detail });

function setRow(over: Partial<TransientSetRow> = {}): TransientSetRow {
  return {
    set_id: randomUUID(), artifact_id: randomUUID(), run_ordinal: 0, generation: 1, job_state: 'PENDING', failure_class: null,
    expected_duration_ms: '6000', duration_ms: null, readable_for_ms: '3480000', reason: null, ...over,
  };
}
const mapRow = (kind: TransientMapRow['row_kind'], over: Partial<TransientMapRow>): TransientMapRow => ({
  entry_ordinal: 1, row_kind: kind, run_ordinal: null, window_ordinal: null, selected_ordinal: null, track: null, clock_start_ms: null,
  clock_end_ms: null, elapsed_ms: null, gap_kind: null, boundary_kind: null, ...over,
});
const TWO_RUN_MAP: TransientMapRow[] = [
  mapRow('RUN', { entry_ordinal: 1, run_ordinal: 1, clock_start_ms: 0, clock_end_ms: 3000 }),
  mapRow('ITEM', { entry_ordinal: 1, run_ordinal: 1, window_ordinal: 1, selected_ordinal: 1 }),
  mapRow('WINDOW', { entry_ordinal: 1, run_ordinal: 1, window_ordinal: 1, track: 'NOTE', clock_start_ms: 0, clock_end_ms: 3000 }),
  mapRow('BOUNDARY', { entry_ordinal: 2, boundary_kind: 'CROSS_RECORDING' }),
  mapRow('RUN', { entry_ordinal: 3, run_ordinal: 2, clock_start_ms: 500, clock_end_ms: 2500 }),
  mapRow('ITEM', { entry_ordinal: 3, run_ordinal: 2, window_ordinal: 2, selected_ordinal: 2 }),
  mapRow('WINDOW', { entry_ordinal: 3, run_ordinal: 2, window_ordinal: 2, track: 'USER', clock_start_ms: 500, clock_end_ms: 2500 }),
];

function harness(over: Partial<Record<keyof TransientMediaRepository, jest.Mock>> = {}, store: Partial<TransientAudioStore> = {}) {
  const repository = {
    request: jest.fn().mockResolvedValue([setRow()]),
    map: jest.fn().mockResolvedValue(TWO_RUN_MAP),
    availability: jest.fn().mockResolvedValue([]),
    attention: jest.fn().mockResolvedValue([]),
    read: jest.fn().mockResolvedValue(null),
    check: jest.fn().mockResolvedValue(null),
    release: jest.fn().mockResolvedValue(null),
    ...over,
  } as unknown as jest.Mocked<TransientMediaRepository>;
  const audio = {
    isConfigured: () => true,
    openTransient: jest.fn().mockResolvedValue(Readable.from([Buffer.from('0123456789')])),
    ...store,
  } as unknown as TransientAudioStore;
  const telemetry = { recordOperationalOutcome: jest.fn() };
  return { repository, audio, telemetry, service: new TransientPlaybackService(repository, audio, telemetry as never) };
}

describe('the listening request (POST /voice/listening/:callId/:commandId)', () => {
  it('answers the one artifact with its state, length and time left; the call id is the subject, never a recording id', async () => {
    const row = setRow({ job_state: 'READY', duration_ms: '5990' });
    const h = harness({ request: jest.fn().mockResolvedValue([row]) });
    const answer = await h.service.requestListening(USER, CALL, COMMAND);
    expect(answer).toEqual({ artifactId: row.artifact_id, state: 'READY', durationMs: 6000, readableForMs: 3_480_000, reason: null });
    expect(h.repository.request).toHaveBeenCalledWith(USER, 'LISTENING', CALL, COMMAND);
    expect(JSON.stringify(answer)).not.toMatch(/voice-|key|set_id|recording/u);
  });

  it('maps every database refusal to its bounded word, and nothing else', async () => {
    const cases: Array<[Error, number, Record<string, unknown>]> = [
      [pgError('P0002', 'TRANSIENT_NOT_AVAILABLE', 'DELETED'), 404, { outcome: 'NOT_FOUND', reason: 'DELETED' }],
      [pgError('P0002', 'TRANSIENT_NOT_AVAILABLE', ''), 404, { outcome: 'NOT_FOUND', reason: null }],
      [pgError('P0002', 'TRANSIENT_NOT_AVAILABLE', 'GUESSED'), 404, { outcome: 'NOT_FOUND', reason: null }],
      // §14.3: no artifact id, state or reason with a reused command.
      [pgError('P0001', 'COMMAND_REUSED'), 409, { outcome: 'COMMAND_REUSED' }],
      // V-34: no start during the person's live call.
      [pgError('P0001', 'LIVE_CALL_ACTIVE'), 409, { outcome: 'LIVE_CALL_ACTIVE' }],
      [pgError('P0001', 'BUSY'), 503, { outcome: 'BUSY' }],
      [pgError('P0001', 'TRANSIENT_GENERATION_LIMIT'), 503, { outcome: 'BUSY' }],
      [pgError('57014', 'canceling statement due to statement timeout'), 503, { outcome: 'BUSY' }],
      [pgError('22023', 'TRANSIENT_REQUEST_INVALID'), 400, { outcome: 'INVALID_REQUEST' }],
    ];
    for (const [error, status, body] of cases) {
      const h = harness({ request: jest.fn().mockRejectedValue(error) });
      expect(await failureOf(h.service.requestListening(USER, CALL, COMMAND))).toEqual([status, body]);
    }
  });

  it('refuses malformed ids before the database; a malformed answer fails closed', async () => {
    const h = harness();
    expect(await failureOf(h.service.requestListening(USER, 'not-a-call', COMMAND))).toEqual([404, { outcome: 'NOT_FOUND', reason: null }]);
    expect(await failureOf(h.service.requestListening(USER, CALL, 'not-a-command'))).toEqual([400, { outcome: 'INVALID_REQUEST' }]);
    expect(h.repository.request).not.toHaveBeenCalled();
    const twoRows = harness({ request: jest.fn().mockResolvedValue([setRow(), setRow()]) });
    expect(await failureOf(twoRows.service.requestListening(USER, CALL, COMMAND))).toEqual([503, { outcome: 'BUSY' }]);
  });
});

describe('the Replay playback request (POST /replay/:replayId/versions/:versionId/playback/:commandId)', () => {
  it('answers the set with the presentation map; a run carries its artifact id only once READY', async () => {
    const rows = [setRow({ run_ordinal: 1, job_state: 'READY', expected_duration_ms: 3000, readable_for_ms: 900_000 }),
      setRow({ run_ordinal: 2, job_state: 'RUNNING', expected_duration_ms: 2000, readable_for_ms: 800_000 })];
    const h = harness({ request: jest.fn().mockResolvedValue(rows) });
    const answer = await h.service.requestReplay(USER, REPLAY, VERSION, COMMAND);
    expect(answer).toEqual({
      state: 'RUNNING', readableForMs: 800_000, reason: null, boundaries: [{ kind: 'CROSS_RECORDING' }],
      runs: [
        { artifactId: rows[0]!.artifact_id, durationMs: 3000, spans: [{ kind: 'WINDOW', fromMs: 0, toMs: 3000, track: 'NOTE', momentOrdinal: 1 }] },
        { durationMs: 2000, spans: [{ kind: 'WINDOW', fromMs: 0, toMs: 2000, track: 'USER', momentOrdinal: 2 }] },
      ],
    });
    expect(h.repository.request).toHaveBeenCalledWith(USER, 'REPLAY_PLAYBACK', VERSION, COMMAND);
    expect(h.repository.map).toHaveBeenCalledWith(USER, REPLAY, VERSION);
  });

  it('a map that disagrees with the set (another run count or length) is never presented; an empty map is NOT_FOUND', async () => {
    const rows = [setRow({ run_ordinal: 1, expected_duration_ms: 3000 }), setRow({ run_ordinal: 2, expected_duration_ms: 1999 })];
    expect(await failureOf(harness({ request: jest.fn().mockResolvedValue(rows) }).service.requestReplay(USER, REPLAY, VERSION, COMMAND)))
      .toEqual([503, { outcome: 'BUSY' }]);
    const gone = harness({ request: jest.fn().mockResolvedValue(rows), map: jest.fn().mockResolvedValue([]) });
    expect(await failureOf(gone.service.requestReplay(USER, REPLAY, VERSION, COMMAND))).toEqual([404, { outcome: 'NOT_FOUND', reason: null }]);
  });

  it('a known command\'s terminal set answers its state and its PROVEN reason, with nothing to play', async () => {
    const rows = [setRow({ run_ordinal: 1, job_state: 'EXPIRED', reason: 'EXPIRED' }), setRow({ run_ordinal: 2, job_state: 'EXPIRED', reason: 'EXPIRED' })];
    const h = harness({ request: jest.fn().mockResolvedValue(rows) });
    expect(await h.service.requestReplay(USER, REPLAY, VERSION, COMMAND))
      .toEqual({ state: 'EXPIRED', runs: [], boundaries: [], readableForMs: 0, reason: 'EXPIRED' });
    expect(h.repository.map).not.toHaveBeenCalled();
  });
});

describe('status, release and the per-request read', () => {
  it('status: the database\'s state, its failure class only when FAILED, the time left, the proven reason; another person\'s → 404', async () => {
    const h = harness({ check: jest.fn().mockResolvedValue({ readable: false, job_state: 'EXPIRED', failure_class: null, readable_for_ms: '0', reason: 'DELETED' }) });
    expect(await h.service.status(USER, randomUUID())).toEqual({ state: 'EXPIRED', failure: null, readableForMs: 0, reason: 'DELETED' });
    const failed = harness({ check: jest.fn().mockResolvedValue({ readable: false, job_state: 'FAILED', failure_class: 'DECODE_FAILED', readable_for_ms: 0, reason: null }) });
    expect((await failed.service.status(USER, randomUUID())).failure).toBe('DECODE_FAILED');
    expect(await failureOf(harness().service.status(USER, randomUUID()))).toEqual([404, { outcome: 'NOT_FOUND', reason: null }]);
  });

  it('release: RELEASED; another person\'s → 404', async () => {
    expect(await harness({ release: jest.fn().mockResolvedValue('RELEASED') }).service.release(USER, randomUUID())).toEqual({ state: 'RELEASED' });
    expect(await failureOf(harness().service.release(USER, randomUUID()))).toEqual([404, { outcome: 'NOT_FOUND', reason: null }]);
  });

  it('read: refused by the database → 404 with no store read; 206 for a range, 200 whole, 416 out of bounds', async () => {
    const none = harness();
    expect(await failureOf(none.service.open(USER, randomUUID(), undefined, new AbortController().signal))).toEqual([404, { outcome: 'NOT_FOUND', reason: null }]);
    expect(none.audio.openTransient).not.toHaveBeenCalled();
    const now = new Date();
    const readable = { storage_key: KEY, byte_size: '10', duration_ms: '6000', serve_until: new Date(now.getTime() + 60_000), db_now: now };
    const h = harness({ read: jest.fn().mockResolvedValue(readable) });
    const part = await h.service.open(USER, randomUUID(), 'bytes=2-4', new AbortController().signal);
    expect([part.status, part.contentLength, part.contentRange, part.serveForMs]).toEqual([206, 3, 'bytes 2-4/10', 60_000]);
    expect((h.audio.openTransient as jest.Mock).mock.calls[0].slice(0, 2)).toEqual([KEY, { start: 2, end: 4 }]);
    expect((await h.service.open(USER, randomUUID(), undefined, new AbortController().signal)).status).toBe(200);
    expect((await failureOf(h.service.open(USER, randomUUID(), 'bytes=20-30', new AbortController().signal)))?.[0]).toBe(416);
  });

  it('read: a READY file with no object, a store that fails, or a deadline already passed never answers audio', async () => {
    const now = new Date();
    const readable = { storage_key: KEY, byte_size: '10', duration_ms: '6000', serve_until: new Date(now.getTime() + 60_000), db_now: now };
    const missing = harness({ read: jest.fn().mockResolvedValue(readable) }, { openTransient: jest.fn().mockResolvedValue(null) });
    expect(await failureOf(missing.service.open(USER, randomUUID(), undefined, new AbortController().signal))).toEqual([503, { outcome: 'BUSY' }]);
    const failing = harness({ read: jest.fn().mockResolvedValue(readable) }, { openTransient: jest.fn().mockRejectedValue(new Error('store')) });
    expect(await failureOf(failing.service.open(USER, randomUUID(), undefined, new AbortController().signal))).toEqual([503, { outcome: 'BUSY' }]);
    const late = harness({ read: jest.fn().mockResolvedValue({ ...readable, serve_until: now }) });
    expect(await failureOf(late.service.open(USER, randomUUID(), undefined, new AbortController().signal))).toEqual([404, { outcome: 'NOT_FOUND', reason: null }]);
  });

  it('the in-stream re-check: true only while the database says readable, false on an error or no answer in time', async () => {
    expect(await harness({ check: jest.fn().mockResolvedValue({ readable: true }) }).service.recheck(USER, randomUUID(), 50)).toBe(true);
    expect(await harness({ check: jest.fn().mockResolvedValue({ readable: false }) }).service.recheck(USER, randomUUID(), 50)).toBe(false);
    expect(await harness({ check: jest.fn().mockRejectedValue(new Error('lost')) }).service.recheck(USER, randomUUID(), 50)).toBe(false);
    expect(await harness({ check: jest.fn().mockReturnValue(new Promise(() => undefined)) }).service.recheck(USER, randomUUID(), 30)).toBe(false);
  });

  it('every outcome is one content-free telemetry class', async () => {
    const h = harness({ request: jest.fn().mockRejectedValue(pgError('P0001', 'LIVE_CALL_ACTIVE')) });
    await failureOf(h.service.requestListening(USER, CALL, COMMAND));
    expect(h.telemetry.recordOperationalOutcome).toHaveBeenCalledWith('REPLAY_MEDIA', 'request', 'live_call_active');
    for (const call of h.telemetry.recordOperationalOutcome.mock.calls) expect(JSON.stringify(call)).not.toMatch(/[0-9a-f]{8}-/u);
  });
});

describe('RB-2 / S3: the availability read (GET /replay/:replayId/versions/:versionId/availability)', () => {
  const DIGEST = `sha256:${'a'.repeat(64)}`;
  const row = (over: Partial<ReplayAvailabilityRow>): ReplayAvailabilityRow => ({
    replay_id: REPLAY, replay_version_id: VERSION, replay_version_revision: 2, source_window_binding_digest: DIGEST,
    ledger_through_sp: 9, ledger_through_event_sequence: '3', selected_ordinal: 1, availability_state: 'RECORDED',
    placement: 'AFTER_END', run_ordinal: null, clock_ms: null, ...over,
  });

  it('translates a certified clock position into its run and file position, at or after it, bound to the version and map', async () => {
    const h = harness({
      availability: jest.fn().mockResolvedValue([
        row({ selected_ordinal: 1, placement: 'IN_RECORDING', run_ordinal: 2, clock_ms: '1700' }),
        row({ selected_ordinal: 2, placement: 'AFTER_END' }),
      ]),
    });
    const answer = await h.service.availability(USER, REPLAY, VERSION);
    expect(answer).toEqual({
      replayId: REPLAY, versionId: VERSION, revision: 2, sourceWindowBindingDigest: DIGEST,
      mapDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u), ledgerWatermark: { sp: 9, seq: 3 },
      moments: [
        { ordinal: 1, state: 'RECORDED', placement: { kind: 'IN_RECORDING', runIndex: 1, fileMs: 1200 } },
        { ordinal: 2, state: 'RECORDED', placement: { kind: 'AFTER_END' } },
      ],
    });
    expect(h.repository.availability).toHaveBeenCalledWith(USER, REPLAY, VERSION);
    expect(JSON.stringify(answer)).not.toMatch(/recording_?id|clock|voice-|key/iu);
  });

  it('a position at or after its run end waits for the end; non-RECORDED states carry no placement; V1 reads no map', async () => {
    const late = harness({ availability: jest.fn().mockResolvedValue([row({ placement: 'IN_RECORDING', run_ordinal: 2, clock_ms: 2500 })]) });
    expect((await late.service.availability(USER, REPLAY, VERSION)).moments[0]!.placement).toEqual({ kind: 'AFTER_END' });
    const v1 = harness({ availability: jest.fn().mockResolvedValue([
      row({ availability_state: 'ORDINAL_ONLY', placement: null, source_window_binding_digest: null, ledger_through_sp: null, ledger_through_event_sequence: null }),
    ]) });
    const answer = await v1.service.availability(USER, REPLAY, VERSION);
    expect(answer).toMatchObject({ mapDigest: null, ledgerWatermark: null, moments: [{ ordinal: 1, state: 'ORDINAL_ONLY', placement: null }] });
    expect(v1.repository.map).not.toHaveBeenCalled();
    for (const state of ['UNESTABLISHED', 'BROKEN'] as const) {
      const h = harness({ availability: jest.fn().mockResolvedValue([row({ availability_state: state, placement: null })]) });
      expect((await h.service.availability(USER, REPLAY, VERSION)).moments).toEqual([{ ordinal: 1, state, placement: null }]);
    }
  });

  it('refuses whole, never repairs: not found, foreign binding, unknown state, a placement on a non-RECORDED row, a run the map lacks', async () => {
    expect(await failureOf(harness({ availability: jest.fn().mockResolvedValue([]) }).service.availability(USER, REPLAY, VERSION)))
      .toEqual([404, { outcome: 'NOT_FOUND', reason: null }]);
    expect(await failureOf(harness().service.availability(USER, 'not-a-uuid', VERSION))).toEqual([404, { outcome: 'NOT_FOUND', reason: null }]);
    const busyCases: ReplayAvailabilityRow[][] = [
      [row({ replay_version_id: randomUUID() })],
      [row({}), row({ selected_ordinal: 2, replay_version_revision: 3 })],
      [row({ availability_state: 'PENDING' as never })],
      [row({ availability_state: 'BROKEN', placement: 'AFTER_END' })],
      [row({ placement: 'IN_RECORDING', run_ordinal: 7, clock_ms: 0 })],
      [row({ placement: 'IN_RECORDING', run_ordinal: 2, clock_ms: null })],
    ];
    for (const rows of busyCases) {
      expect(await failureOf(harness({ availability: jest.fn().mockResolvedValue(rows) }).service.availability(USER, REPLAY, VERSION)))
        .toEqual([503, { outcome: 'BUSY' }]);
    }
    expect(await failureOf(harness({ availability: jest.fn().mockRejectedValue(pgError('57014', 'timeout')) }).service.availability(USER, REPLAY, VERSION)))
      .toEqual([503, { outcome: 'BUSY' }]);
    const noMap = harness({ availability: jest.fn().mockResolvedValue([row({})]), map: jest.fn().mockResolvedValue([]) });
    expect(await failureOf(noMap.service.availability(USER, REPLAY, VERSION))).toEqual([404, { outcome: 'NOT_FOUND', reason: null }]);
  });
});

describe('INTEL-LIVE-01 CP3: the attention read (GET /replay/:replayId/versions/:versionId/attention)', () => {
  const DIGEST = `sha256:${'b'.repeat(64)}`;
  // One call run [1000, 24000): USER [1000, 3000), QANDEEL [3000, 6000), a 14 s HELD [6000, 20000) (presented 1500 ms),
  // USER [20000, 24000).
  const HELD_MAP: TransientMapRow[] = [
    mapRow('RUN', { entry_ordinal: 1, run_ordinal: 1, clock_start_ms: 1000, clock_end_ms: 24000 }),
    mapRow('ITEM', { entry_ordinal: 1, run_ordinal: 1, window_ordinal: 1, selected_ordinal: 1 }),
    mapRow('ITEM', { entry_ordinal: 1, run_ordinal: 1, window_ordinal: 2, selected_ordinal: 2 }),
    mapRow('ITEM', { entry_ordinal: 1, run_ordinal: 1, window_ordinal: 3, selected_ordinal: 3 }),
    mapRow('WINDOW', { entry_ordinal: 1, run_ordinal: 1, window_ordinal: 1, track: 'USER', clock_start_ms: 1000, clock_end_ms: 3000 }),
    mapRow('WINDOW', { entry_ordinal: 1, run_ordinal: 1, window_ordinal: 2, track: 'QANDEEL', clock_start_ms: 3000, clock_end_ms: 6000 }),
    mapRow('WINDOW', { entry_ordinal: 1, run_ordinal: 1, window_ordinal: 3, track: 'USER', clock_start_ms: 20000, clock_end_ms: 24000 }),
    mapRow('HELD', { entry_ordinal: 1, run_ordinal: 1, clock_start_ms: 6000, clock_end_ms: 20000, elapsed_ms: 14000 }),
  ];
  const version = (over: Partial<ReplayAttentionRow> = {}): ReplayAttentionRow => ({
    entry: 'VERSION', replay_id: REPLAY, replay_version_id: VERSION, replay_version_revision: 3, source_window_binding_digest: DIGEST,
    call_ordinal: null, event_seq: null, track: null, op: null, subject_key: null, label: null, kind: null, confidence: null,
    thread_ref: null, anchor_run_ordinal: null, anchor_clock_ms: null, floor_basis: null, floor_placement: null, floor_run_ordinal: null,
    floor_clock_ms: null, ...over,
  });
  const event = (over: Partial<ReplayAttentionRow>): ReplayAttentionRow => version({
    entry: 'EVENT', call_ordinal: 1, event_seq: '1', track: 'USER', op: 'SET', subject_key: 'manager', label: 'L manager', kind: 'TOPIC',
    confidence: 'HIGH', anchor_run_ordinal: 1, anchor_clock_ms: '1200', floor_basis: 'PRODUCED_POSITION', floor_placement: 'IN_RECORDING',
    floor_run_ordinal: 1, floor_clock_ms: '1700', ...over,
  });

  it('places every event at its produced (or settled) position in the map, the anchor at or after its words, a hold at its elapsed offset', async () => {
    const thread = randomUUID();
    const h = harness({
      map: jest.fn().mockResolvedValue(HELD_MAP),
      attention: jest.fn().mockResolvedValue([
        version(),
        event({}),
        event({ event_seq: '2', op: 'WITHDRAW', anchor_clock_ms: 2600, floor_clock_ms: 2950 }),
        event({ event_seq: '3', subject_key: 'held', anchor_clock_ms: 2900, floor_clock_ms: 6800 }),
        event({ event_seq: '4', subject_key: 'far', anchor_clock_ms: 2900, floor_clock_ms: 10000 }),
        event({ event_seq: '5', track: 'QANDEEL', subject_key: 'reply', thread_ref: thread, anchor_clock_ms: 3500, floor_clock_ms: 4100 }),
        event({ event_seq: '6', subject_key: 'late', anchor_clock_ms: 21000, floor_placement: 'AFTER_END', floor_run_ordinal: null, floor_clock_ms: null }),
        event({ event_seq: '7', op: 'CONFIRMED', anchor_clock_ms: null, floor_basis: 'SETTLED_THROUGH', floor_clock_ms: 3600 }),
        event({ call_ordinal: 2, event_seq: '1', subject_key: 'edge', anchor_clock_ms: 21000, floor_clock_ms: 24000 }),
      ]),
    });
    const answer = await h.service.attention(USER, REPLAY, VERSION);
    const inRun = (fileMs: number, basis = 'PRODUCED_POSITION') => ({ kind: 'IN_RECORDING', runIndex: 0, fileMs, basis });
    const base = { call: 1, track: 'USER', subjectKey: 'manager', label: 'L manager', kind: 'TOPIC', confidence: 'HIGH', threadRef: null };
    expect(answer).toEqual({
      replayId: REPLAY, versionId: VERSION, revision: 3, sourceWindowBindingDigest: DIGEST,
      mapDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      events: [
        { ...base, seq: 1, op: 'SET', anchor: { runIndex: 0, fileMs: 200 }, floor: inRun(700) },
        { ...base, seq: 2, op: 'WITHDRAW', anchor: { runIndex: 0, fileMs: 1600 }, floor: inRun(1950) },
        // inside the shortened hold (presented from 5000): 800 ms after its start, and at most its 1500 ms
        { ...base, seq: 3, op: 'SET', subjectKey: 'held', anchor: { runIndex: 0, fileMs: 1900 }, floor: inRun(5800) },
        { ...base, seq: 4, op: 'SET', subjectKey: 'far', anchor: { runIndex: 0, fileMs: 1900 }, floor: inRun(6500) },
        { ...base, seq: 5, op: 'SET', track: 'QANDEEL', subjectKey: 'reply', threadRef: thread, anchor: { runIndex: 0, fileMs: 2500 }, floor: inRun(3100) },
        { ...base, seq: 6, op: 'SET', subjectKey: 'late', anchor: { runIndex: 0, fileMs: 7500 }, floor: { kind: 'AFTER_END', basis: 'PRODUCED_POSITION' } },
        { ...base, seq: 7, op: 'CONFIRMED', anchor: null, floor: inRun(2600, 'SETTLED_THROUGH') },
        // a floor at the run's end waits for the end
        { ...base, call: 2, seq: 1, op: 'SET', subjectKey: 'edge', anchor: { runIndex: 0, fileMs: 7500 }, floor: { kind: 'AFTER_END', basis: 'PRODUCED_POSITION' } },
      ],
    });
    expect(h.repository.attention).toHaveBeenCalledWith(USER, REPLAY, VERSION);
    expect(JSON.stringify(answer)).not.toMatch(/recording_?id|clock|voice-|storage_?key|call_?id/iu);
  });

  it('no event: the binding alone, no map read; a V1 version carries no digest', async () => {
    const h = harness({ attention: jest.fn().mockResolvedValue([version()]) });
    expect(await h.service.attention(USER, REPLAY, VERSION)).toEqual({
      replayId: REPLAY, versionId: VERSION, revision: 3, sourceWindowBindingDigest: DIGEST, mapDigest: null, events: [],
    });
    expect(h.repository.map).not.toHaveBeenCalled();
    const v1 = harness({ attention: jest.fn().mockResolvedValue([version({ source_window_binding_digest: null })]) });
    expect(await v1.service.attention(USER, REPLAY, VERSION)).toMatchObject({ sourceWindowBindingDigest: null, mapDigest: null, events: [] });
  });

  it('refuses whole, never repairs: not found, a foreign binding, a misplaced VERSION row, a malformed event, a run the map lacks', async () => {
    const of = (rows: ReplayAttentionRow[], map: TransientMapRow[] = HELD_MAP) =>
      failureOf(harness({ attention: jest.fn().mockResolvedValue(rows), map: jest.fn().mockResolvedValue(map) }).service.attention(USER, REPLAY, VERSION));
    expect(await of([])).toEqual([404, { outcome: 'NOT_FOUND', reason: null }]);
    expect(await failureOf(harness().service.attention(USER, REPLAY, 'not-a-uuid'))).toEqual([404, { outcome: 'NOT_FOUND', reason: null }]);
    expect(await of([version(), event({})], [])).toEqual([404, { outcome: 'NOT_FOUND', reason: null }]);
    const busyCases: ReplayAttentionRow[][] = [
      [event({})],
      [version(), version()],
      [version({ replay_version_id: randomUUID() })],
      [version(), event({ replay_version_revision: 4 })],
      [version(), event({ source_window_binding_digest: null })],
      [version(), event({ op: 'GUESS' })],
      [version(), event({ track: 'NOTE' })],
      [version(), event({ kind: 'MOOD' })],
      [version(), event({ confidence: 'SURE' })],
      [version(), event({ event_seq: null })],
      [version(), event({ call_ordinal: 0 })],
      [version(), event({ anchor_run_ordinal: 7 })],
      [version(), event({ anchor_clock_ms: null })],
      [version(), event({ anchor_clock_ms: 25000 })],
      [version(), event({ floor_basis: 'SETTLED_THROUGH' })],
      [version(), event({ op: 'EXPIRED', floor_basis: 'SETTLED_THROUGH' })],
      [version(), event({ floor_placement: 'AFTER_END' })],
      [version(), event({ floor_placement: 'SOMEWHERE' })],
      [version(), event({ floor_run_ordinal: 7 })],
      [version(), event({ floor_clock_ms: null })],
    ];
    for (const rows of busyCases) expect([rows.length, await of(rows)]).toEqual([rows.length, [503, { outcome: 'BUSY' }]]);
    expect(await failureOf(harness({ attention: jest.fn().mockRejectedValue(pgError('57014', 'timeout')) }).service.attention(USER, REPLAY, VERSION)))
      .toEqual([503, { outcome: 'BUSY' }]);
  });
});

describe('S8B-07 CP2-A.1: the map read (GET /replay/:replayId/versions/:versionId/map)', () => {
  it('answers the playback map alone, as the playback answer carries it, and asks for no set', async () => {
    const h = harness();
    const answer = await h.service.presentationMap(USER, REPLAY, VERSION);
    expect(answer).toEqual({
      boundaries: [{ kind: 'CROSS_RECORDING' }],
      runs: [
        { durationMs: 3000, spans: [{ kind: 'WINDOW', fromMs: 0, toMs: 3000, track: 'NOTE', momentOrdinal: 1 }] },
        { durationMs: 2000, spans: [{ kind: 'WINDOW', fromMs: 0, toMs: 2000, track: 'USER', momentOrdinal: 2 }] },
      ],
    });
    expect(h.repository.map).toHaveBeenCalledWith(USER, REPLAY, VERSION);
    // No command, no set, no job, no file: nothing to erase.
    expect(h.repository.request).not.toHaveBeenCalled();
    expect(JSON.stringify(answer)).not.toMatch(/artifactId|readableForMs|state/u);
    expect(h.telemetry.recordOperationalOutcome).toHaveBeenCalledWith('REPLAY_MEDIA', 'map', 'success');
  });

  it('refuses whole, never repairs: malformed ids before the database, no plan → NOT_FOUND, a failed read → BUSY', async () => {
    expect(await failureOf(harness().service.presentationMap(USER, 'not-a-uuid', VERSION))).toEqual([404, { outcome: 'NOT_FOUND', reason: null }]);
    expect(await failureOf(harness().service.presentationMap(USER, REPLAY, 'not-a-uuid'))).toEqual([404, { outcome: 'NOT_FOUND', reason: null }]);
    expect(await failureOf(harness({ map: jest.fn().mockResolvedValue([]) }).service.presentationMap(USER, REPLAY, VERSION)))
      .toEqual([404, { outcome: 'NOT_FOUND', reason: null }]);
    expect(await failureOf(harness({ map: jest.fn().mockRejectedValue(pgError('57014', 'timeout')) }).service.presentationMap(USER, REPLAY, VERSION)))
      .toEqual([503, { outcome: 'BUSY' }]);
  });
});
