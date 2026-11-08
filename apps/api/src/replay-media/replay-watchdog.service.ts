import { randomUUID } from 'node:crypto';
import type { TelemetryService } from '../observability/telemetry.service';
import { assertReplayDatabaseRole, type ReplayDatabase } from './replay-database';
import type { TransientAudioStore } from './transient-audio.store';
import { ERASE_BY_SECONDS, ERASURE_CLAIM_LIMIT, SWEEP_LIMIT, eraseClaimed } from './transient-erasure';
import type { TransientMediaRepository } from './transient-media.repository';

/**
 * S8B-07 CP1-B (INFRA-07 P-4 as approved, contract §18.2) — the independent Replay watchdog: ONE run, then the process
 * exits. An external scheduler starts it every 60 s as its own deployment (proposed: a Cloud Scheduler-triggered Cloud
 * Run Job in `qandeel-replay`, configured at HOSTED-DEPLOY-01; nothing is created now). It never runs on a call server
 * or on the Replay pool's own instances (the role guard, V-33), so it still works when every pool instance is down.
 *
 * Each run, in order:
 *   1  its own run heartbeat (a dead watchdog is detected by that row's age, the dead-man input);
 *   2  the sweep: EXPIRED at the cap or the source's end, erasure_late_at marked once past erase_by;
 *   3  the backstop: DELETE then HEAD 404 on ledger rows past erase_by = due_at + 120 s;
 *   4  health: queue age, PENDING past 60 s, the pool heartbeat's age, due and late erasures, as content-free gauges.
 * A step that fails is reported and the next runs anyway; nothing here reads content or extends retention.
 */
export interface WatchdogRun {
  readonly expired: number;
  readonly lateMarked: number;
  readonly lateOutstanding: number;
  readonly erased: number;
  readonly deferred: number;
  readonly health: Readonly<Record<string, number | null>> | null;
}

export class ReplayWatchdogService {
  constructor(
    private readonly repository: TransientMediaRepository,
    private readonly store: TransientAudioStore,
    private readonly telemetry?: TelemetryService,
    private readonly instanceId: string = randomUUID(),
  ) {}

  static async preflight(db: ReplayDatabase, store: TransientAudioStore): Promise<void> {
    await assertReplayDatabaseRole(db);
    if (!store.isConfigured()) throw new Error('the Replay store is not configured');
  }

  async runOnce(): Promise<WatchdogRun> {
    const run = { expired: 0, lateMarked: 0, lateOutstanding: 0, erased: 0, deferred: 0, health: null as Record<string, number | null> | null };
    try {
      await this.repository.beat(this.instanceId, 'REPLAY_WATCHDOG');
      this.signal('heartbeat', 'success');
    } catch {
      this.signal('heartbeat', 'transport_failure');
    }
    try {
      const swept = await this.repository.sweep(SWEEP_LIMIT);
      run.expired = Number(swept.expired);
      run.lateMarked = Number(swept.late_marked);
      run.lateOutstanding = Number(swept.late_outstanding);
      this.signal('sweep', 'success');
    } catch {
      this.signal('sweep', 'transport_failure');
    }
    try {
      const claims = await this.repository.claimErasures(ERASURE_CLAIM_LIMIT, ERASE_BY_SECONDS);
      const erased = await eraseClaimed(this.repository, this.store, claims);
      run.erased = erased.erased;
      run.deferred = erased.deferred;
      for (let i = 0; i < erased.erased; i += 1) this.signal('backstop', 'success');
      for (let i = 0; i < erased.deferred; i += 1) this.signal('backstop', 'deferred');
    } catch {
      this.signal('backstop', 'transport_failure');
    }
    if (run.lateOutstanding > 0) {
      try {
        this.telemetry?.recordOperationalOutcome('TRANSIENT_ERASURE_LATE', 'erasure', 'late');
      } catch {
        // Observability is best-effort.
      }
    }
    try {
      const health = await this.repository.health();
      if (health !== null) {
        const values: Record<string, number | null> = {};
        for (const [metric, value] of Object.entries(health)) {
          values[metric] = value === null ? null : Number(value);
          // An absent heartbeat is not emitted: its absence is the dead-man alert's input.
          if (value !== null) this.telemetry?.recordReplayHealth(metric, Number(value));
        }
        run.health = values;
      }
      this.signal('health', 'success');
    } catch {
      this.signal('health', 'transport_failure');
    }
    return run;
  }

  private signal(operation: 'sweep' | 'backstop' | 'health' | 'heartbeat', outcome: string): void {
    try {
      this.telemetry?.recordOperationalOutcome('REPLAY_WATCHDOG', operation, outcome);
    } catch {
      // Observability is best-effort.
    }
  }
}
