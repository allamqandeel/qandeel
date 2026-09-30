import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrivacyMaintenanceRepository, type DueDeletion } from './privacy-maintenance.repository';
import { ProviderAccountRemovalService } from './provider-account-removal.service';

/** Default cadence of the pass. An implementation detail, not Product authority. */
export const PRIVACY_MAINTENANCE_DEFAULT_POLL_MS = 30_000;
const BATCH = 10;

/**
 * W3-MEGA-S — the server's own asynchronous Privacy & Data pass (W3-PDG-01 §7.2 step 3, §8.2).
 *
 * One single-flight cycle on a timer, the same shape as the runtime-event publisher, and nothing wider: it is not a job
 * framework. Each cycle:
 *
 *   1. prepares pending export packages and discards expired ones (the database does both, in its own transaction);
 *   2. claims the deletions that are due (a short database lease, so several servers never advance one request), and
 *      for each: runs the ONE governed Personal erasure when it is SCHEDULED, then removes the provider account once
 *      the database says ERASED, then records it COMPLETED. Every step is idempotent and judged again by the database,
 *      so a crash or lost answer anywhere resumes on a later cycle and never reports a deletion it did not finish.
 *
 * BLOCKED (a Connected Worlds row still references the account) is the database's answer and stops there: nothing is
 * erased and the provider account is not touched. Nothing is logged — no account, id or outcome.
 *
 * Enabled only where both server credentials exist, never under tests, and it can be switched off by configuration.
 */
@Injectable()
export class PrivacyMaintenanceWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private stopped = false;

  constructor(
    private readonly repository: PrivacyMaintenanceRepository,
    private readonly provider: ProviderAccountRemovalService,
  ) {}

  get enabled(): boolean {
    return this.provider.isConfigured() && process.env.NODE_ENV !== 'test' && process.env.PRIVACY_MAINTENANCE_DISABLED !== 'true';
  }

  onModuleInit(): void {
    if (!this.enabled || this.stopped) return;
    const poll = Number(process.env.PRIVACY_MAINTENANCE_POLL_MS ?? PRIVACY_MAINTENANCE_DEFAULT_POLL_MS);
    this.timer = setInterval(() => void this.runOnce(), Number.isFinite(poll) && poll >= 1000 ? poll : PRIVACY_MAINTENANCE_DEFAULT_POLL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** One cycle. A cycle already in flight is not doubled. */
  async runOnce(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      await this.repository.prepareExports(BATCH).catch(() => undefined);
      const due = await this.repository.claimDueDeletions(BATCH).catch((): DueDeletion[] => []);
      for (const deletion of due) await this.advance(deletion);
    } finally {
      this.running = false;
    }
  }

  private async advance(deletion: DueDeletion): Promise<void> {
    try {
      if (deletion.status === 'SCHEDULED') {
        const outcome = await this.repository.erase(deletion.deletionId);
        if (outcome !== 'ERASED' && outcome !== 'ALREADY_ERASED') return;
      }
      if ((await this.provider.remove(deletion.userId)) !== 'REMOVED') return;
      await this.repository.complete(deletion.deletionId);
    } catch {
      // The database lease expires and a later cycle resumes from the committed state.
    }
  }
}
