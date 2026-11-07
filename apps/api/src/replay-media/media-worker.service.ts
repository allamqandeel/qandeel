import { randomUUID } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { endianness, tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TelemetryService } from '../observability/telemetry.service';
import { assertPinnedFfmpeg, type FfmpegBinaries } from './replay-ffmpeg';
import { assertReplayDatabaseRole, type ReplayDatabase } from './replay-database';
import { newStoreMeter, type StoreMeter, type TransientAudioStore } from './transient-audio.store';
import { ERASURE_CLAIM_LIMIT, SWEEP_LIMIT, eraseClaimed } from './transient-erasure';
import type { CompletionOutcome, TransientMediaRepository } from './transient-media.repository';
import { executeMix } from './transient-mixer';
import { MixFailure, planMix } from './transient-mix-plan';

/**
 * S8B-07 CP1-B (contract §9, §10, §17, §18; D-06.1, D-06.3, D-06.5; P-5) — the media worker of the Replay pool.
 *
 *   jobs       claim (FOR UPDATE SKIP LOCKED) up to the concurrency (1 per process, configurable 1 – 2), read the job's
 *              inputs, plan, mix inside the job's own scratch directory, probe, upload with an exact-length PUT, HEAD
 *              the size, then complete: the database revalidates the source, the cap, the length and the generation's
 *              PCM. A heartbeat every 20 s extends the lease and aborts the job (SIGKILL) the moment the database
 *              refuses it. The wall cap per job is 20 s + 0.03 × media seconds, at most 150 s.
 *   reaper     every 10 s: the Replay erasure ledger's due keys, DELETE then HEAD 404; then the sweep (EXPIRED, late
 *              marks, purge); TRANSIENT_ERASURE_LATE on every cycle while a violation is outstanding.
 *   heartbeat  every 30 s, the pool's content-free heartbeat row.
 *
 * Fail-closed: a MixFailure fails the job's set with its bounded class and nothing is uploaded. A transport failure
 * (the database or the store unreachable) changes nothing: the lease lapses and the job is claimed again, up to its
 * three attempts. The scratch root is emptied at start-up (a live job holds its lease, not its directory), and each
 * job's directory is removed in `finally`. Nothing here logs a key, an id, a plan, a digest or any byte.
 */
export const JOB_LEASE_HEARTBEAT_MS = 20_000;
export const REAPER_INTERVAL_MS = 10_000;
export const POOL_HEARTBEAT_MS = 30_000;
export const JOB_CAP_BASE_MS = 20_000;
export const JOB_CAP_PER_MEDIA_MS = 0.03;
export const JOB_CAP_MAX_MS = 150_000;

/** D-06.5: 20 s + 0.03 × media seconds, at most 150 s. */
export const jobWallCapMs = (expectedMs: number): number => Math.min(JOB_CAP_MAX_MS, Math.ceil(JOB_CAP_BASE_MS + JOB_CAP_PER_MEDIA_MS * expectedMs));

export interface MediaWorkerOptions {
  readonly concurrency: number;
  readonly pollMs: number;
  readonly scratchRoot: string;
  readonly instanceId: string;
  readonly minFreeBytes?: number;
  /** The proofs' time-cap fixture only: a shorter wall cap than D-06.5's (never longer). */
  readonly wallCapMs?: number;
}

export function mediaWorkerOptionsFrom(env: NodeJS.ProcessEnv): MediaWorkerOptions {
  const concurrency = env.REPLAY_MEDIA_CONCURRENCY === undefined || env.REPLAY_MEDIA_CONCURRENCY === '' ? 1 : Number(env.REPLAY_MEDIA_CONCURRENCY);
  if (concurrency !== 1 && concurrency !== 2) throw new Error('REPLAY_MEDIA_CONCURRENCY must be 1 or 2 (D-06.1)');
  const pollMs = Math.max(250, Number(env.REPLAY_MEDIA_POLL_MS ?? 1000) || 1000);
  return { concurrency, pollMs, scratchRoot: env.REPLAY_SCRATCH_ROOT || join(tmpdir(), 'qandeel-replay-scratch'), instanceId: randomUUID() };
}

/** The process's CPU so far, its finished children included where the platform reports them (Linux /proc). */
export function cpuMsNow(): number {
  try {
    const fields = readFileSync('/proc/self/stat', 'utf8').split(') ')[1]!.split(' ');
    // utime, stime, cutime, cstime are fields 14 – 17 (1-based), i.e. 11 – 14 after the command name.
    const ticks = [11, 12, 13, 14].reduce((sum, i) => sum + Number(fields[i]), 0);
    return Math.round((ticks * 1000) / 100);
  } catch {
    const usage = process.cpuUsage();
    return Math.round((usage.user + usage.system) / 1000);
  }
}

export type JobResult = CompletionOutcome | 'DEFERRED';

export class MediaWorkerService {
  private timers: NodeJS.Timeout[] = [];
  private active = 0;
  private reaping = false;
  private readonly inFlight = new Set<Promise<unknown>>();

  constructor(
    private readonly repository: TransientMediaRepository,
    private readonly store: TransientAudioStore,
    private readonly bin: FfmpegBinaries,
    private readonly options: MediaWorkerOptions,
    private readonly telemetry?: TelemetryService,
  ) {}

  /** V-28: the start-up checks. Throws (the entry point does not start) on any of them. */
  static async preflight(db: ReplayDatabase, store: TransientAudioStore, bin: FfmpegBinaries): Promise<void> {
    if (endianness() !== 'LE') throw new Error('the Replay pool runs on a little-endian host');
    await assertReplayDatabaseRole(db);
    if (!store.isConfigured()) throw new Error('the Replay store is not configured');
    await assertPinnedFfmpeg(bin, AbortSignal.timeout(10_000));
  }

  /** Empties the scratch root (every directory a dead process left), then starts the three loops. */
  async start(): Promise<void> {
    await this.cleanScratchRoot();
    const every = (ms: number, task: () => Promise<unknown>) => {
      const timer = setInterval(() => void this.track(task()), ms);
      this.timers.push(timer);
    };
    every(this.options.pollMs, () => this.runJobsOnce());
    every(REAPER_INTERVAL_MS, () => this.reapOnce());
    every(POOL_HEARTBEAT_MS, () => this.beatOnce());
    await this.beatOnce();
  }

  async stop(): Promise<void> {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    await Promise.allSettled([...this.inFlight]);
  }

  private track<T>(work: Promise<T>): Promise<T> {
    this.inFlight.add(work);
    void work.finally(() => this.inFlight.delete(work)).catch(() => undefined);
    return work;
  }

  async cleanScratchRoot(): Promise<void> {
    await mkdir(this.options.scratchRoot, { recursive: true });
    for (const entry of await readdir(this.options.scratchRoot)) {
      await rm(join(this.options.scratchRoot, entry), { recursive: true, force: true });
    }
  }

  /** Claims what the free slots allow and runs each job to its end. Returns the jobs' results, for the proofs. */
  async runJobsOnce(): Promise<JobResult[]> {
    const free = this.options.concurrency - this.active;
    if (free <= 0) return [];
    let claims: Array<{ job_id: string; lease_id: string }>;
    try {
      claims = await this.repository.claimJobs(free);
    } catch {
      this.signal('job', 'transport_failure');
      return [];
    }
    return Promise.all(claims.map(async (claim) => {
      this.active += 1;
      try {
        return await this.processJob(claim.job_id, claim.lease_id);
      } finally {
        this.active -= 1;
      }
    }));
  }

  async processJob(jobId: string, leaseId: string): Promise<JobResult> {
    const started = Date.now();
    const cpuStart = cpuMsNow();
    const meter = newStoreMeter();
    const facts = () => ({ wallMs: Date.now() - started, cpuMs: Math.max(0, cpuMsNow() - cpuStart), bytesRead: meter.bytesRead, storeOps: meter.ops });
    const scratchDir = join(this.options.scratchRoot, jobId);
    const controller = new AbortController();
    let leaseGone = false;
    let heartbeat: NodeJS.Timeout | null = null;
    let cap: NodeJS.Timeout | null = null;
    try {
      const rows = await this.repository.readJob(jobId, leaseId);
      if (rows.length === 0) {
        // The source is gone, the file reached its cap, or the lease moved on: the heartbeat lets the database say which
        // and end the set itself.
        await this.repository.heartbeat(jobId, leaseId);
        this.signal('job', 'expired');
        return 'EXPIRED';
      }
      const plan = planMix(rows);
      cap = setTimeout(() => controller.abort(), Math.min(jobWallCapMs(plan.expectedMs), this.options.wallCapMs ?? JOB_CAP_MAX_MS));
      heartbeat = setInterval(() => {
        void this.repository.heartbeat(jobId, leaseId).then((alive) => {
          if (!alive) {
            leaseGone = true;
            controller.abort();
          }
        }, () => undefined);
      }, JOB_LEASE_HEARTBEAT_MS);
      await mkdir(scratchDir, { recursive: true });
      const mixed = await executeMix(plan, {
        bin: this.bin, store: this.store, scratchDir, meter, signal: controller.signal, minFreeBytes: this.options.minFreeBytes,
      });
      if (controller.signal.aborted) throw new MixFailure('TIME_CAP');
      await this.store.putTransient(plan.storageKey, createReadStream(mixed.path), mixed.byteSize, meter, controller.signal);
      const stored = await this.store.headTransient(plan.storageKey, meter, controller.signal);
      if (stored !== mixed.byteSize) throw new MixFailure('LENGTH_MISMATCH');
      const outcome = await this.repository.complete(jobId, leaseId, mixed.byteSize, mixed.durationMs, mixed.pcmDigest, facts());
      this.signal('job', outcome === 'READY' ? 'success' : outcome === 'FAILED' ? 'failed_closed' : outcome === 'EXPIRED' ? 'expired' : 'lease_lost');
      return outcome;
    } catch (error) {
      if (leaseGone) {
        // The database already ended this job (source gone, cap reached) or another claim holds it: nothing to report.
        this.signal('job', 'lease_lost');
        return 'LEASE_LOST';
      }
      const failureClass = error instanceof MixFailure ? error.failureClass : controller.signal.aborted ? 'TIME_CAP' : null;
      if (failureClass === null) {
        // A transport failure (the database or the store unreachable): the lease lapses and the job is claimed again.
        this.signal('job', 'transport_failure');
        return 'DEFERRED';
      }
      try {
        await this.repository.fail(jobId, leaseId, failureClass, facts());
      } catch {
        this.signal('job', 'transport_failure');
        return 'DEFERRED';
      }
      this.signal('job', 'failed_closed');
      return 'FAILED';
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      if (cap) clearTimeout(cap);
      await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** The reaper and the sweep (every 10 s). Returns what it did, for the proofs. */
  async reapOnce(): Promise<{ erased: number; deferred: number; expired: number; lateOutstanding: number }> {
    const result = { erased: 0, deferred: 0, expired: 0, lateOutstanding: 0 };
    if (this.reaping) return result;
    this.reaping = true;
    try {
      try {
        const swept = await this.repository.sweep(SWEEP_LIMIT);
        result.expired = Number(swept.expired);
        result.lateOutstanding = Number(swept.late_outstanding);
        this.signal('sweep', 'success');
      } catch {
        this.signal('sweep', 'transport_failure');
      }
      try {
        const claims = await this.repository.claimErasures(ERASURE_CLAIM_LIMIT, 0);
        const erased = await eraseClaimed(this.repository, this.store, claims);
        result.erased = erased.erased;
        result.deferred = erased.deferred;
        for (let i = 0; i < erased.erased; i += 1) this.signal('reap', 'success');
        for (let i = 0; i < erased.deferred; i += 1) this.signal('reap', 'deferred');
      } catch {
        this.signal('reap', 'transport_failure');
      }
      if (result.lateOutstanding > 0) this.late();
      return result;
    } finally {
      this.reaping = false;
    }
  }

  async beatOnce(): Promise<void> {
    try {
      await this.repository.beat(this.options.instanceId, 'REPLAY_MEDIA');
      this.signal('heartbeat', 'success');
    } catch {
      this.signal('heartbeat', 'transport_failure');
    }
  }

  private signal(operation: 'job' | 'reap' | 'sweep' | 'heartbeat', outcome: string): void {
    try {
      this.telemetry?.recordOperationalOutcome('REPLAY_MEDIA', operation, outcome);
    } catch {
      // Observability is best-effort.
    }
  }

  private late(): void {
    try {
      this.telemetry?.recordOperationalOutcome('TRANSIENT_ERASURE_LATE', 'erasure', 'late');
    } catch {
      // Observability is best-effort.
    }
  }
}

export type { StoreMeter };
