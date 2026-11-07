import type { ReplayDatabase } from './replay-database';

/**
 * S8B-07 CP1-B — the transient media definers of migration 0196, called by the Replay pool only, as its own database
 * role (INFRA-07 P-3). The database decides ownership, readability, currency, the cap, the generations and every
 * erasure; nothing here caches an answer. No row returned here is ever logged: a storage key leaves this process only
 * as the address of a store request.
 */
export const TRANSIENT_FAILURE_CLASSES = [
  'SOURCE_UNAVAILABLE', 'OBJECT_MISSING', 'DECODE_FAILED', 'LENGTH_MISMATCH', 'TIME_CAP', 'SCRATCH_CAP', 'GENERATION_MISMATCH',
] as const;
export type TransientFailureClass = (typeof TRANSIENT_FAILURE_CLASSES)[number];

export interface ClaimedJob { readonly job_id: string; readonly lease_id: string }

/** One row of `server_read_transient_media_job_v1`: the JOB row first, then plan rows and SEGMENT rows. */
export interface JobInputRow {
  readonly entry: 'JOB' | 'SEGMENT' | 'GAP' | 'WINDOW' | 'AUDIBLE' | 'MIX' | 'HELD';
  readonly owner_kind: 'LISTENING' | 'REPLAY_PLAYBACK' | null;
  readonly generation: number | null;
  readonly storage_key: string | null;
  readonly expected_duration_ms: string | number | null;
  readonly track: 'USER' | 'QANDEEL' | 'NOTE' | null;
  readonly segment_index: number | null;
  readonly content_type: string | null;
  readonly byte_size: string | number | null;
  readonly clock_start_ms: string | number | null;
  readonly clock_end_ms: string | number | null;
  readonly elapsed_ms: string | number | null;
  readonly gap_kind: string | null;
  readonly window_ordinal: number | null;
  readonly selected_ordinal: number | null;
}

export type CompletionOutcome = 'READY' | 'FAILED' | 'EXPIRED' | 'LEASE_LOST';

export interface JobFacts {
  readonly wallMs: number;
  readonly cpuMs: number;
  readonly bytesRead: number;
  readonly storeOps: number;
}

export interface SweepResult { readonly expired: number; readonly late_marked: number; readonly late_outstanding: number; readonly purged: number }
export interface ClaimedErasure { readonly storage_key: string; readonly lease_id: string }

/** The content-free health read: ages in milliseconds and counts. */
export interface ReplayHealthRow {
  readonly oldest_pending_age_ms: string | number | null;
  readonly pending_over_60s: number;
  readonly pool_heartbeat_age_ms: string | number | null;
  readonly watchdog_heartbeat_age_ms: string | number | null;
  readonly erasures_due: number;
  readonly erasures_late: number;
}

export class TransientMediaRepository {
  constructor(private readonly db: ReplayDatabase) {}

  claimJobs(limit: number): Promise<ClaimedJob[]> {
    return this.db.query<ClaimedJob>('SELECT * FROM public.server_claim_transient_media_jobs_v1($1)', [limit]);
  }

  readJob(jobId: string, leaseId: string): Promise<JobInputRow[]> {
    return this.db.query<JobInputRow>('SELECT * FROM public.server_read_transient_media_job_v1($1, $2)', [jobId, leaseId]);
  }

  async heartbeat(jobId: string, leaseId: string): Promise<boolean> {
    const [row] = await this.db.query<{ ok: boolean }>('SELECT public.server_heartbeat_transient_media_job_v1($1, $2) AS ok', [jobId, leaseId]);
    return row?.ok === true;
  }

  async complete(jobId: string, leaseId: string, byteSize: number, durationMs: number, pcmDigest: string, facts: JobFacts): Promise<CompletionOutcome> {
    const [row] = await this.db.query<{ outcome: CompletionOutcome }>(
      'SELECT public.server_complete_transient_media_job_v1($1, $2, $3, $4, $5, $6, $7, $8, $9) AS outcome',
      [jobId, leaseId, byteSize, durationMs, pcmDigest, facts.wallMs, facts.cpuMs, facts.bytesRead, facts.storeOps]);
    return row?.outcome ?? 'LEASE_LOST';
  }

  async fail(jobId: string, leaseId: string, failureClass: TransientFailureClass, facts: JobFacts): Promise<boolean> {
    const [row] = await this.db.query<{ ok: boolean }>(
      'SELECT public.server_fail_transient_media_job_v1($1, $2, $3, $4, $5, $6, $7) AS ok',
      [jobId, leaseId, failureClass, facts.wallMs, facts.cpuMs, facts.bytesRead, facts.storeOps]);
    return row?.ok === true;
  }

  async sweep(limit: number): Promise<SweepResult> {
    const [row] = await this.db.query<SweepResult>('SELECT * FROM public.server_sweep_transient_media_v1($1)', [limit]);
    return row ?? { expired: 0, late_marked: 0, late_outstanding: 0, purged: 0 };
  }

  claimErasures(limit: number, overdueSeconds: number): Promise<ClaimedErasure[]> {
    return this.db.query<ClaimedErasure>('SELECT * FROM public.server_claim_transient_media_erasures_v1($1, $2)', [limit, overdueSeconds]);
  }

  async completeErasure(storageKey: string, leaseId: string): Promise<boolean> {
    const [row] = await this.db.query<{ ok: boolean }>('SELECT public.server_complete_transient_media_erasure_v1($1, $2) AS ok', [storageKey, leaseId]);
    return row?.ok === true;
  }

  async beat(instanceId: string, role: 'REPLAY_MEDIA' | 'REPLAY_WATCHDOG'): Promise<void> {
    await this.db.query('SELECT public.server_beat_transient_media_pool_v1($1, $2)', [instanceId, role]);
  }

  async health(): Promise<ReplayHealthRow | null> {
    const [row] = await this.db.query<ReplayHealthRow>('SELECT * FROM public.server_read_transient_media_health_v1()', []);
    return row ?? null;
  }
}
