import {
  BadRequestException, ConflictException, HttpException, HttpStatus, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import type { TelemetryService } from '../observability/telemetry.service';
import { parseByteRange } from '../voice-media/byte-range';
import { assertReplayDatabaseRole, type ReplayDatabase } from './replay-database';
import type { TransientAudioStore } from './transient-audio.store';
import type { ReplayAttentionRow, ReplayAvailabilityRow, TransientMediaRepository, TransientSetRow } from './transient-media.repository';
import {
  buildPresentationMap, presentationMapDigest, runTimelinesOf, type PresentationBoundary, type PresentationSpan,
} from './transient-presentation-map';
import { boundedRecheck, type OpenedTransient } from './transient-stream';

/**
 * S8B-07 CP1-B step 3 (contract §6, §14.3, §15, §19, §20; INFRA-07 P-1) — the Replay Media Service's answers, on the
 * Replay pool only. The database decides everything on EVERY request (owner, readability, currency, the cap, the
 * generations, BUSY, LIVE_CALL_ACTIVE, COMMAND_REUSED); this service only translates its rows into the approved wire
 * and never caches an answer. The phone receives no key, URL, recording id or text.
 *
 *   POST   /voice/listening/:callId/:commandId                   → { artifactId, state, durationMs, readableForMs, reason }
 *   POST   /replay/:replayId/versions/:versionId/playback/:commandId
 *                                                               → { state, runs[], boundaries[], readableForMs, reason }
 *   GET    /voice/transient/:artifactId/status                   → { state, failure, readableForMs, reason }
 *   GET    /voice/transient/:artifactId                          → the audio, whole (200) or one Range (206)
 *   DELETE /voice/transient/:artifactId                          → { state } (released; never read or reused again)
 *   GET    /replay/:replayId/versions/:versionId/availability    → RB-2 / S3: { replayId, versionId, revision,
 *                                                                  sourceWindowBindingDigest, mapDigest, ledgerWatermark,
 *                                                                  moments[{ ordinal, state, placement }] }
 *   GET    /replay/:replayId/versions/:versionId/attention       → INTEL-LIVE-01 CP3: { replayId, versionId, revision,
 *                                                                  sourceWindowBindingDigest, mapDigest, events[{ call, seq,
 *                                                                  track, op, subjectKey, label, kind, confidence,
 *                                                                  threadRef, anchor, floor }] }
 *
 * Refusals are the bounded words only: 404 NOT_FOUND (with the PROVEN reason, or null), 409 COMMAND_REUSED (nothing
 * else), 409 LIVE_CALL_ACTIVE, 503 BUSY (a full queue, a generation limit, or any failure to answer: fail-closed), 400
 * INVALID_REQUEST, 416 RANGE_NOT_SATISFIABLE. Nothing is logged; each outcome is one content-free telemetry class.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** A store read must begin answering within this budget (the Voice Note read's own, `VOICE_STORE_OPEN_MS`). */
export const TRANSIENT_STORE_OPEN_MS = 15_000;

type JobState = TransientSetRow['job_state'];
type Reason = 'EXPIRED' | 'DELETED' | null;

export interface ListeningAnswer {
  readonly artifactId: string;
  readonly state: JobState;
  readonly durationMs: number;
  readonly readableForMs: number;
  readonly reason: Reason;
}

export interface ReplayRunAnswer {
  readonly artifactId?: string;
  readonly durationMs: number;
  readonly spans: readonly PresentationSpan[];
}

export interface ReplayPlaybackAnswer {
  readonly state: JobState;
  readonly runs: readonly ReplayRunAnswer[];
  readonly boundaries: readonly PresentationBoundary[];
  readonly readableForMs: number;
  readonly reason: Reason;
}

/** S8B-07 CP2-A.1: the playback map alone, with no set (each run's length and spans, and the boundaries between runs). */
export interface ReplayPresentationMapAnswer {
  readonly runs: readonly ReplayRunAnswer[];
  readonly boundaries: readonly PresentationBoundary[];
}

/** RB-2 / S3: where a moment's analysis may appear — inside a run of the playback map, or after the whole Replay. */
export type ReplayMomentPlacement =
  | { readonly kind: 'IN_RECORDING'; readonly runIndex: number; readonly fileMs: number }
  | { readonly kind: 'AFTER_END' };

export interface ReplayAvailabilityAnswer {
  readonly replayId: string;
  readonly versionId: string;
  readonly revision: number;
  readonly sourceWindowBindingDigest: string | null;
  readonly mapDigest: string | null;
  readonly ledgerWatermark: { readonly sp: number; readonly seq: number } | null;
  readonly moments: ReadonlyArray<{
    readonly ordinal: number;
    readonly state: ReplayAvailabilityRow['availability_state'];
    readonly placement: ReplayMomentPlacement | null;
  }>;
}
const AVAILABILITY_STATES: ReadonlySet<string> = new Set(['RECORDED', 'UNESTABLISHED', 'BROKEN', 'ORDINAL_ONLY']);

/**
 * INTEL-LIVE-01 CP3: where one attention event may first appear — never certified (0205): the server-produced position or
 * the settlement's source-order position, at its hold's elapsed offset, inside a run of the playback map; or after the
 * whole Replay (the closing display).
 */
export type ReplayAttentionFloor =
  | { readonly kind: 'IN_RECORDING'; readonly runIndex: number; readonly fileMs: number; readonly basis: ReplayAttentionBasis }
  | { readonly kind: 'AFTER_END'; readonly basis: ReplayAttentionBasis };
export type ReplayAttentionBasis = 'PRODUCED_POSITION' | 'SETTLED_THROUGH';

export interface ReplayAttentionEvent {
  /** The call's rank by its first presented run, and 0204's event_seq within it. */
  readonly call: number;
  readonly seq: number;
  readonly track: 'USER' | 'QANDEEL';
  readonly op: 'SET' | 'WITHDRAW' | 'CONFIRMED' | 'EXPIRED';
  readonly subjectKey: string;
  readonly label: string;
  readonly kind: string;
  readonly confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly threadRef: string | null;
  /** The words the event is about, in the playback map (a settlement has none). */
  readonly anchor: { readonly runIndex: number; readonly fileMs: number } | null;
  readonly floor: ReplayAttentionFloor;
}

export interface ReplayAttentionAnswer {
  readonly replayId: string;
  readonly versionId: string;
  readonly revision: number;
  readonly sourceWindowBindingDigest: string | null;
  readonly mapDigest: string | null;
  readonly events: readonly ReplayAttentionEvent[];
}
const ATTENTION_OPS: ReadonlySet<string> = new Set(['SET', 'WITHDRAW', 'CONFIRMED', 'EXPIRED']);
const ATTENTION_KINDS: ReadonlySet<string> = new Set(['TOPIC', 'PERSON', 'PLACE', 'EXPERIENCE', 'CONCERN', 'PLAN']);
const CONFIDENCES: ReadonlySet<string> = new Set(['HIGH', 'MEDIUM', 'LOW']);

export interface TransientStatusAnswer {
  readonly state: JobState;
  readonly failure: string | null;
  readonly readableForMs: number;
  readonly reason: Reason;
}

interface DatabaseError { readonly code?: string; readonly message?: string; readonly detail?: string }
type Settled<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: DatabaseError };
const settle = <T>(promise: Promise<T>): Promise<Settled<T>> =>
  promise.then((value) => ({ ok: true as const, value }), (error: unknown) => ({ ok: false as const, error: (error ?? {}) as DatabaseError }));

const whole = (value: string | number | null): number | null => {
  const n = Number(value);
  return value === null || !Number.isSafeInteger(n) ? null : n;
};

/** One EVENT row of 0205 as the wire carries it, or the integrity refusal (a malformed row refuses the whole answer). */
function attentionEventOf(r: ReplayAttentionRow, timelines: ReturnType<typeof runTimelinesOf>, integrity: () => HttpException): ReplayAttentionEvent {
  const seq = whole(r.event_seq);
  const producer = r.op === 'SET' || r.op === 'WITHDRAW';
  const anchorRun = r.anchor_run_ordinal === null ? undefined : timelines?.get(r.anchor_run_ordinal);
  const basis = r.floor_basis;
  if (r.entry !== 'EVENT' || seq === null || seq < 1 || r.call_ordinal === null || r.call_ordinal < 1
      || (r.track !== 'USER' && r.track !== 'QANDEEL') || r.op === null || !ATTENTION_OPS.has(r.op)
      || typeof r.subject_key !== 'string' || typeof r.label !== 'string' || r.kind === null || !ATTENTION_KINDS.has(r.kind)
      || r.confidence === null || !CONFIDENCES.has(r.confidence) || anchorRun === undefined
      || basis !== (producer ? 'PRODUCED_POSITION' : 'SETTLED_THROUGH')) {
    throw integrity();
  }
  let anchor: ReplayAttentionEvent['anchor'] = null;
  if (producer) {
    const clock = whole(r.anchor_clock_ms);
    const fileMs = clock === null ? null : anchorRun.fileMsAtOrAfter(clock);
    if (fileMs === null) throw integrity();
    anchor = { runIndex: r.anchor_run_ordinal! - 1, fileMs };
  } else if (r.anchor_clock_ms !== null) {
    throw integrity();
  }
  let floor: ReplayAttentionFloor;
  if (r.floor_placement === 'AFTER_END') {
    if (r.floor_run_ordinal !== null || r.floor_clock_ms !== null) throw integrity();
    floor = { kind: 'AFTER_END', basis };
  } else {
    const run = r.floor_placement === 'IN_RECORDING' && r.floor_run_ordinal !== null && r.floor_run_ordinal >= r.anchor_run_ordinal!
      ? timelines?.get(r.floor_run_ordinal) : undefined;
    const clock = whole(r.floor_clock_ms);
    if (run === undefined || clock === null) throw integrity();
    const fileMs = run.fileMsAtHeldOffset(clock);
    // Nothing of the run is at or after the position: the event waits for the end, never for an earlier instant.
    floor = fileMs === null ? { kind: 'AFTER_END', basis } : { kind: 'IN_RECORDING', runIndex: r.floor_run_ordinal! - 1, fileMs, basis };
  }
  return {
    call: r.call_ordinal, seq, track: r.track, op: r.op as ReplayAttentionEvent['op'], subjectKey: r.subject_key, label: r.label,
    kind: r.kind, confidence: r.confidence as ReplayAttentionEvent['confidence'], threadRef: r.thread_ref, anchor, floor,
  };
}

const notFound = (reason: Reason = null) => new NotFoundException({ outcome: 'NOT_FOUND', reason });
const busy = () => new ServiceUnavailableException({ outcome: 'BUSY' });
const reasonOf = (value: unknown): Reason => (value === 'EXPIRED' || value === 'DELETED' ? value : null);
const count = (value: string | number | null | undefined): number => {
  const n = Number(value);
  return value === null || value === undefined || !Number.isSafeInteger(n) || n < 0 ? 0 : n;
};
const LIVE: ReadonlySet<JobState> = new Set(['PENDING', 'RUNNING', 'READY']);

/** A set's one state: a set is prepared, failed and released whole; runs differ only while some are still preparing. */
function setStateOf(rows: readonly TransientSetRow[]): JobState {
  const states = new Set(rows.map((r) => r.job_state));
  for (const terminal of ['FAILED', 'EXPIRED', 'RELEASED'] as const) if (states.has(terminal)) return terminal;
  if (states.size === 1 && states.has('READY')) return 'READY';
  return states.has('RUNNING') || states.has('READY') ? 'RUNNING' : 'PENDING';
}

export class TransientPlaybackService {
  constructor(
    private readonly repository: TransientMediaRepository,
    private readonly store: TransientAudioStore,
    private readonly telemetry: TelemetryService | null = null,
  ) {}

  /** V-28: the service starts only as the Replay role with its approved limits, with the store and the bearer check configured. */
  static async preflight(db: ReplayDatabase, store: TransientAudioStore, env: NodeJS.ProcessEnv): Promise<void> {
    await assertReplayDatabaseRole(db);
    if (!store.isConfigured()) throw new Error('the Replay store is not configured');
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) throw new Error('the Replay pool bearer verification is not configured');
  }

  async requestListening(userId: string, callId: string, commandId: string): Promise<ListeningAnswer> {
    if (!UUID.test(callId)) throw this.refused('request', notFound());
    const rows = await this.request(userId, 'LISTENING', callId, commandId);
    const [row] = rows;
    if (rows.length !== 1 || row === undefined || row.run_ordinal !== 0) throw this.refused('request', busy(), 'integrity_failure');
    this.signal('request', 'success');
    return {
      artifactId: row.artifact_id, state: row.job_state, durationMs: count(row.expected_duration_ms),
      readableForMs: count(row.readable_for_ms), reason: reasonOf(row.reason),
    };
  }

  async requestReplay(userId: string, replayId: string, versionId: string, commandId: string): Promise<ReplayPlaybackAnswer> {
    if (!UUID.test(replayId) || !UUID.test(versionId)) throw this.refused('request', notFound());
    const rows = await this.request(userId, 'REPLAY_PLAYBACK', versionId, commandId);
    if (rows.length === 0 || rows.some((r, i) => r.run_ordinal !== i + 1)) throw this.refused('request', busy(), 'integrity_failure');
    const state = setStateOf(rows);
    const readableForMs = Math.min(...rows.map((r) => count(r.readable_for_ms)));
    const reason = reasonOf(rows[0]!.reason);
    if (!LIVE.has(state)) {
      // A known command's terminal set: its state, nothing to play.
      this.signal('request', 'success');
      return { state, runs: [], boundaries: [], readableForMs: 0, reason };
    }
    const read = await settle(this.repository.map(userId, replayId, versionId));
    if (!read.ok) throw this.refused('request', busy(), 'transport_failure');
    const map = buildPresentationMap(read.value);
    // The version left CURRENT between the two reads, or another Replay id: nothing is presented.
    if (read.value.length === 0) throw this.refused('request', notFound(reason));
    // The map and the files are one plan: the same runs, each of the length its file is made to.
    if (map === null || map.runs.length !== rows.length
        || map.runs.some((run, i) => run.durationMs !== count(rows[i]!.expected_duration_ms))) {
      throw this.refused('request', busy(), 'integrity_failure');
    }
    this.signal('request', 'success');
    return {
      state,
      runs: map.runs.map((run, i) => ({
        ...(rows[i]!.job_state === 'READY' ? { artifactId: rows[i]!.artifact_id } : {}), durationMs: run.durationMs, spans: run.spans,
      })),
      boundaries: map.boundaries, readableForMs, reason,
    };
  }

  /**
   * S8B-07 CP2-A.1 (R-3; the Product Owner's "CP2-A.1 FINAL VALIDATION AND CORRECTION", 2026-11-27): the version's playback
   * map alone — the runs, their lengths and spans, and the boundaries — from the same plan rows and the same
   * `buildPresentationMap` as the playback answer, so the phone draws the whole part's timeline before the first Play. It
   * asks for no set: no command, no file, no job, no lease, nothing to erase. Not this person's CURRENT V2 version, or no
   * plan: NOT_FOUND. A map that cannot be built: BUSY, never repaired.
   */
  async presentationMap(userId: string, replayId: string, versionId: string): Promise<ReplayPresentationMapAnswer> {
    if (!UUID.test(replayId) || !UUID.test(versionId)) throw this.refused('map', notFound());
    const read = await settle(this.repository.map(userId, replayId, versionId));
    if (!read.ok) throw this.refused('map', busy(), 'transport_failure');
    if (read.value.length === 0) throw this.refused('map', notFound());
    const map = buildPresentationMap(read.value);
    if (map === null || map.runs.length === 0) throw this.refused('map', busy(), 'integrity_failure');
    this.signal('map', 'success');
    return { runs: map.runs.map((run) => ({ durationMs: run.durationMs, spans: run.spans })), boundaries: map.boundaries };
  }

  /**
   * RB-2 / S3 (contract v1.1 §6.1 / §8 as amended by Direct Historical Binding): the database places every moment
   * (0202); this answer only translates a certified run clock position into the playback map's file position, AT OR
   * AFTER it (RunTimeline.fileMsAtOrAfter), and binds the answer to the version, its revision, its source windows, the
   * map and the ledger watermark. Nothing is cached; a malformed answer is refused whole (BUSY), never repaired.
   */
  async availability(userId: string, replayId: string, versionId: string): Promise<ReplayAvailabilityAnswer> {
    if (!UUID.test(replayId) || !UUID.test(versionId)) throw this.refused('availability', notFound());
    const read = await settle(this.repository.availability(userId, replayId, versionId));
    if (!read.ok) throw this.refused('availability', busy(), 'transport_failure');
    const rows = read.value;
    const first = rows[0];
    if (first === undefined) throw this.refused('availability', notFound());
    const integrity = () => this.refused('availability', busy(), 'integrity_failure');
    if (rows.some((r) => r.replay_id !== replayId || r.replay_version_id !== versionId
        || r.replay_version_revision !== first.replay_version_revision
        || r.source_window_binding_digest !== first.source_window_binding_digest || !AVAILABILITY_STATES.has(r.availability_state))) {
      throw integrity();
    }
    let mapDigest: string | null = null;
    let timelines: ReturnType<typeof runTimelinesOf> = null;
    if (rows.some((r) => r.availability_state !== 'ORDINAL_ONLY')) {
      const plan = await settle(this.repository.map(userId, replayId, versionId));
      if (!plan.ok) throw this.refused('availability', busy(), 'transport_failure');
      if (plan.value.length === 0) throw this.refused('availability', notFound());
      const map = buildPresentationMap(plan.value);
      timelines = runTimelinesOf(plan.value);
      if (map === null || timelines === null) throw integrity();
      mapDigest = presentationMapDigest(map);
    }
    const moments = rows.map((r) => {
      if (r.availability_state !== 'RECORDED') {
        if (r.placement !== null) throw integrity();
        return { ordinal: r.selected_ordinal, state: r.availability_state, placement: null };
      }
      if (r.placement === 'AFTER_END') return { ordinal: r.selected_ordinal, state: r.availability_state, placement: { kind: 'AFTER_END' as const } };
      const timeline = r.placement === 'IN_RECORDING' && r.run_ordinal !== null ? timelines?.get(r.run_ordinal) : undefined;
      const clock = Number(r.clock_ms);
      if (timeline === undefined || r.clock_ms === null || !Number.isSafeInteger(clock)) throw integrity();
      const fileMs = timeline.fileMsAtOrAfter(clock);
      // Nothing of the run is at or after the position: the moment waits for the end, never for an earlier instant.
      const placement: ReplayMomentPlacement = fileMs === null
        ? { kind: 'AFTER_END' }
        : { kind: 'IN_RECORDING', runIndex: r.run_ordinal! - 1, fileMs };
      return { ordinal: r.selected_ordinal, state: r.availability_state, placement };
    });
    const seq = Number(first.ledger_through_event_sequence);
    this.signal('availability', 'success');
    return {
      replayId, versionId, revision: first.replay_version_revision, sourceWindowBindingDigest: first.source_window_binding_digest,
      mapDigest,
      ledgerWatermark: first.ledger_through_sp === null || !Number.isSafeInteger(seq) ? null : { sp: first.ledger_through_sp, seq },
      moments,
    };
  }

  /**
   * INTEL-LIVE-01 CP3 (D-CP3): the database reads and places every attention event of the version's calls (0205); this
   * answer only translates each run clock position into the playback map's file position (the anchor AT OR AFTER it, the
   * floor at its hold's elapsed offset, RunTimeline) and binds the answer to the version, its revision, its source windows
   * and the map. Nothing is certified, nothing is cached; a malformed answer is refused whole (BUSY), never repaired.
   */
  async attention(userId: string, replayId: string, versionId: string): Promise<ReplayAttentionAnswer> {
    if (!UUID.test(replayId) || !UUID.test(versionId)) throw this.refused('attention', notFound());
    const read = await settle(this.repository.attention(userId, replayId, versionId));
    if (!read.ok) throw this.refused('attention', busy(), 'transport_failure');
    const rows = read.value;
    const first = rows[0];
    if (first === undefined) throw this.refused('attention', notFound());
    const integrity = () => this.refused('attention', busy(), 'integrity_failure');
    if (first.entry !== 'VERSION' || rows.some((r, i) => (r.entry === 'VERSION') !== (i === 0) || r.replay_id !== replayId
        || r.replay_version_id !== versionId || r.replay_version_revision !== first.replay_version_revision
        || r.source_window_binding_digest !== first.source_window_binding_digest)) {
      throw integrity();
    }
    const eventRows = rows.slice(1);
    let mapDigest: string | null = null;
    let timelines: ReturnType<typeof runTimelinesOf> = null;
    if (eventRows.length > 0) {
      const plan = await settle(this.repository.map(userId, replayId, versionId));
      if (!plan.ok) throw this.refused('attention', busy(), 'transport_failure');
      if (plan.value.length === 0) throw this.refused('attention', notFound());
      const map = buildPresentationMap(plan.value);
      timelines = runTimelinesOf(plan.value);
      if (map === null || timelines === null) throw integrity();
      mapDigest = presentationMapDigest(map);
    }
    const events = eventRows.map((r) => attentionEventOf(r, timelines, integrity));
    this.signal('attention', 'success');
    return {
      replayId, versionId, revision: first.replay_version_revision, sourceWindowBindingDigest: first.source_window_binding_digest,
      mapDigest, events,
    };
  }

  async status(userId: string, artifactId: string): Promise<TransientStatusAnswer> {
    if (!UUID.test(artifactId)) throw this.refused('status', notFound());
    const read = await settle(this.repository.check(userId, artifactId));
    if (!read.ok) throw this.refused('status', busy(), 'transport_failure');
    if (read.value === null) throw this.refused('status', notFound());
    this.signal('status', 'success');
    const row = read.value;
    return {
      state: row.job_state, failure: row.job_state === 'FAILED' ? row.failure_class : null,
      readableForMs: count(row.readable_for_ms), reason: reasonOf(row.reason),
    };
  }

  async release(userId: string, artifactId: string): Promise<{ state: JobState }> {
    if (!UUID.test(artifactId)) throw this.refused('release', notFound());
    const read = await settle(this.repository.release(userId, artifactId));
    if (!read.ok) throw this.refused('release', busy(), 'transport_failure');
    if (read.value === null) throw this.refused('release', notFound());
    this.signal('release', 'success');
    return { state: read.value };
  }

  /**
   * One response's file: re-checked by the database for THIS request (every GET and every Range, including each resume
   * after a cut), and opened at the store only then. Not readable now → 404, the bounded word.
   */
  async open(userId: string, artifactId: string, rangeHeader: unknown, signal: AbortSignal): Promise<OpenedTransient> {
    if (!UUID.test(artifactId)) throw this.refused('read', notFound());
    const read = await settle(this.repository.read(userId, artifactId));
    if (!read.ok) throw this.refused('read', busy(), 'transport_failure');
    const row = read.value;
    const serveForMs = row === null ? 0 : row.serve_until.getTime() - row.db_now.getTime();
    if (row === null || !(serveForMs > 0)) throw this.refused('read', notFound());
    const size = count(row.byte_size);
    const range = parseByteRange(rangeHeader, size);
    if (range === 'UNSATISFIABLE') {
      throw this.refused('read', new HttpException({ outcome: 'RANGE_NOT_SATISFIABLE' }, HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE));
    }
    // The open budget aborts only a store that never begins to answer; once the body flows it is never fired.
    const opening = new AbortController();
    const budget = setTimeout(() => opening.abort(), TRANSIENT_STORE_OPEN_MS);
    const body = await settle(this.store.openTransient(row.storage_key, range, AbortSignal.any([signal, opening.signal])))
      .finally(() => clearTimeout(budget));
    // A READY file with no object, or a store that does not answer: never an empty answer.
    if (!body.ok || body.value === null) throw this.refused('read', busy(), body.ok ? 'integrity_failure' : 'transport_failure');
    this.signal('read', 'success');
    return {
      status: range ? 206 : 200,
      contentLength: range ? range.end - range.start + 1 : size,
      contentRange: range ? `bytes ${range.start}-${range.end}/${size}` : null,
      body: body.value,
      serveForMs,
    };
  }

  /** The in-stream re-check (contract §15.1 step 2): the read's predicate without the key, fail-closed. */
  recheck(userId: string, artifactId: string, timeoutMs: number): Promise<boolean> {
    return boundedRecheck(() => this.repository.check(userId, artifactId).then((row) => row?.readable === true), timeoutMs);
  }

  recordStream(outcome: string): void {
    this.signal('stream', outcome);
  }

  private async request(userId: string, kind: 'LISTENING' | 'REPLAY_PLAYBACK', subject: string, commandId: string): Promise<TransientSetRow[]> {
    if (!UUID.test(commandId)) throw this.refused('request', new BadRequestException({ outcome: 'INVALID_REQUEST' }));
    const answer = await settle(this.repository.request(userId, kind, subject, commandId));
    if (answer.ok) return answer.value;
    const { code, message, detail } = answer.error;
    if (code === 'P0002' && message === 'TRANSIENT_NOT_AVAILABLE') throw this.refused('request', notFound(reasonOf(detail)));
    if (code === 'P0001' && message === 'COMMAND_REUSED') {
      // §14.3: no artifact id, state or reason; the phone mints one new command.
      throw this.refused('request', new ConflictException({ outcome: 'COMMAND_REUSED' }), 'command_reused');
    }
    if (code === 'P0001' && message === 'LIVE_CALL_ACTIVE') {
      throw this.refused('request', new ConflictException({ outcome: 'LIVE_CALL_ACTIVE' }), 'live_call_active');
    }
    if (code === '22023') throw this.refused('request', new BadRequestException({ outcome: 'INVALID_REQUEST' }));
    // BUSY (the queue), TRANSIENT_GENERATION_LIMIT (fail-closed), a timeout or a lost connection: never a live host.
    throw this.refused('request', busy(), code === 'P0001' ? 'busy' : 'transport_failure');
  }

  private refused(operation: string, error: HttpException, outcome = 'refused_expected'): HttpException {
    this.signal(operation, outcome);
    return error;
  }

  private signal(operation: string, outcome: string): void {
    this.telemetry?.recordOperationalOutcome('REPLAY_MEDIA', operation, outcome);
  }
}
