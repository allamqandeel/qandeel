import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { TelemetryService } from '../observability/telemetry.service';
import { VoiceMediaRepository } from './voice-media.repository';
import { voiceWorkersEnabled } from './voice-retention.worker';

const DEFAULT_POLL_MS = 30_000;
const RECOVER_LIMIT = 50;
/** How long past its lapsed writer lease a call recording waits before it is sealed (0183 bounds it to 0 .. 3600 s). */
export const VOICE_RECOVERY_GRACE_SECONDS = 60;

/**
 * S8B-02 (CP2, §3.5 rule 4) — recording recovery. A call recording whose writer stopped heartbeating (its lease lapsed by
 * more than the grace) is sealed RECOVERY by `server_recover_stale_call_recordings_v1` (0183, SKIP LOCKED): its pending
 * segments become DISCARDED with WRITER_LOSS gaps and their keys queued after their deadline; every acknowledged segment
 * stays readable; the expiry is unchanged. Upload deadlines of unfinished Voice Notes are settled by the retention sweep.
 * Only the recording is recovered: the call, its end and its reason are S8B-05's.
 *
 * One cycle at a time, an unref'd timer, off under tests and when unconfigured. Content-free outcomes
 * (`VOICE_RETENTION` / recover).
 */
@Injectable()
export class VoiceRecordingRecoveryWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly repository: VoiceMediaRepository, @Optional() private readonly telemetry?: TelemetryService) {}

  get enabled(): boolean {
    return voiceWorkersEnabled() && process.env.VOICE_RECORDING_RECOVERY_DISABLED !== 'true';
  }

  onModuleInit(): void {
    if (!this.enabled) return;
    const poll = Math.max(1000, Number(process.env.VOICE_RECORDING_RECOVERY_POLL_MS ?? DEFAULT_POLL_MS) || DEFAULT_POLL_MS);
    this.timer = setInterval(() => void this.runOnce(), poll);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One cycle. Returns how many recordings it sealed; never throws. */
  async runOnce(graceSeconds = VOICE_RECOVERY_GRACE_SECONDS): Promise<{ recovered: number }> {
    if (this.running) return { recovered: 0 };
    this.running = true;
    try {
      const row = await this.repository.recoverStale(RECOVER_LIMIT, graceSeconds);
      this.signal('success');
      return { recovered: Number(row?.recovered ?? 0) };
    } catch {
      this.signal('transport_failure');
      return { recovered: 0 };
    } finally {
      this.running = false;
    }
  }

  private signal(outcome: 'success' | 'transport_failure'): void {
    try {
      this.telemetry?.recordOperationalOutcome('VOICE_RETENTION', 'recover', outcome);
    } catch {
      // Observability is best-effort.
    }
  }
}
