import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { TelemetryService } from '../observability/telemetry.service';
import { ReplySpeechRepository } from './reply-speech.repository';

const DEFAULT_POLL_MS = 60_000;
const SWEEP_LIMIT = 100;
const MAX_ROUNDS = 10;

/**
 * S8B-04 (CP1, contract v1.2 §8.2 / §8.3) — the Listen store's sweeper. It has NO clock and NO rule of its own: the
 * database's `server_sweep_reply_speech_v1` (0187) decides, under its per-user lock:
 *   - a SYNTHESIZING segment whose lease ran out (a crashed instance) becomes FAILED_UNKNOWN and its PENDING ledger row is
 *     settled FAILED with ABSENT usage (FAILED_USAGE_UNKNOWN) — never re-synthesized automatically (I-7);
 *   - every segment past its 15 minutes, and every discarded one already settled, is deleted.
 * Reads already stop at the expiry instant, before this runs.
 *
 * One cycle at a time, a timer that never keeps the process alive, off under tests and whenever the server authority is
 * not configured. Outcomes are content-free (`VOICE_LISTEN` / sweep).
 */
@Injectable()
export class ReplySpeechSweepWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly repository: ReplySpeechRepository, @Optional() private readonly telemetry?: TelemetryService) {}

  get enabled(): boolean {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) && process.env.NODE_ENV !== 'test'
      && process.env.VOICE_REPLY_SPEECH_SWEEP_DISABLED !== 'true';
  }

  onModuleInit(): void {
    if (!this.enabled) return;
    this.timer = setInterval(() => void this.runOnce(), DEFAULT_POLL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One cycle: sweep until a round finds less than a full batch. Never throws. */
  async runOnce(): Promise<{ leasesExpired: number; callsSettled: number; segmentsDeleted: number }> {
    const result = { leasesExpired: 0, callsSettled: 0, segmentsDeleted: 0 };
    if (this.running) return result;
    this.running = true;
    try {
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const row = await this.repository.sweep(SWEEP_LIMIT);
        const leases = Number(row.leases_expired ?? 0);
        const deleted = Number(row.segments_deleted ?? 0);
        result.leasesExpired += leases;
        result.callsSettled += Number(row.calls_settled ?? 0);
        result.segmentsDeleted += deleted;
        if (leases + deleted < SWEEP_LIMIT) break;
      }
      this.signal('success');
    } catch {
      // A failed sweep transaction changed nothing; the next cycle sweeps again.
      this.signal('transport_failure');
    } finally {
      this.running = false;
    }
    return result;
  }

  private signal(outcome: 'success' | 'transport_failure'): void {
    try {
      this.telemetry?.recordOperationalOutcome('VOICE_LISTEN', 'sweep', outcome);
    } catch {
      // Observability is best-effort.
    }
  }
}
