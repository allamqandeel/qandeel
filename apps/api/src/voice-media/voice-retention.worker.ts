import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { TelemetryService } from '../observability/telemetry.service';
import { VoiceMediaRepository } from './voice-media.repository';

const DEFAULT_POLL_MS = 60_000;
const SWEEP_LIMIT = 100;
const MAX_ROUNDS = 10;

/**
 * S8B-02 (CP2, D-6) — the voice retention worker. It has NO clock and NO retention rule of its own: the database's
 * `server_sweep_voice_recordings_v1` (0183) decides, from `retention_expires_at` (accepted_at / started_at + 30 days,
 * written once) and the upload deadline, under SKIP LOCKED, which recordings become EXPIRED or DISCARDED, and queues every
 * key of each in the same transaction. Reads already stopped at the expiry instant, before this runs; a call recording
 * still RECORDING at its expiry is sealed RECOVERY first (0183 R1). The shared media erasure worker then deletes each
 * object and proves it gone.
 *
 * One cycle at a time, a timer that never keeps the process alive, off under tests and whenever the object store or the
 * server authority is not configured. Outcomes are content-free (`VOICE_RETENTION` / sweep).
 */
@Injectable()
export class VoiceRetentionWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly repository: VoiceMediaRepository, @Optional() private readonly telemetry?: TelemetryService) {}

  get enabled(): boolean {
    return voiceWorkersEnabled() && process.env.VOICE_RETENTION_WORKER_DISABLED !== 'true';
  }

  onModuleInit(): void {
    if (!this.enabled) return;
    const poll = Math.max(1000, Number(process.env.VOICE_RETENTION_POLL_MS ?? DEFAULT_POLL_MS) || DEFAULT_POLL_MS);
    this.timer = setInterval(() => void this.runOnce(), poll);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One cycle: sweep until a round finds less than a full batch. Returns what it did; never throws. */
  async runOnce(): Promise<{ expired: number; discarded: number }> {
    const result = { expired: 0, discarded: 0 };
    if (this.running) return result;
    this.running = true;
    try {
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const row = await this.repository.sweep(SWEEP_LIMIT);
        const expired = Number(row?.expired ?? 0);
        const discarded = Number(row?.discarded ?? 0);
        result.expired += expired;
        result.discarded += discarded;
        if (expired + discarded < SWEEP_LIMIT) break;
      }
      this.signal('sweep', 'success');
    } catch {
      // Nothing was changed by a failed sweep transaction; the next cycle sweeps again.
      this.signal('sweep', 'transport_failure');
    } finally {
      this.running = false;
    }
    return result;
  }

  private signal(operation: 'sweep', outcome: 'success' | 'transport_failure'): void {
    try {
      this.telemetry?.recordOperationalOutcome('VOICE_RETENTION', operation, outcome);
    } catch {
      // Observability is best-effort.
    }
  }
}

/** The voice workers run in the API process, like the media erasure worker: never under tests, never unconfigured. */
export function voiceWorkersEnabled(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.QANDEEL_MEDIA_S3_ENDPOINT
    && process.env.QANDEEL_MEDIA_S3_BUCKET) && process.env.NODE_ENV !== 'test';
}
