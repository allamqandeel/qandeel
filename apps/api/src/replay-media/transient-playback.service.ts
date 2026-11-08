import {
  BadRequestException, ConflictException, HttpException, HttpStatus, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import type { TelemetryService } from '../observability/telemetry.service';
import { parseByteRange } from '../voice-media/byte-range';
import { assertReplayDatabaseRole, type ReplayDatabase } from './replay-database';
import type { TransientAudioStore } from './transient-audio.store';
import type { TransientMediaRepository, TransientSetRow } from './transient-media.repository';
import { buildPresentationMap, type PresentationBoundary, type PresentationSpan } from './transient-presentation-map';
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
