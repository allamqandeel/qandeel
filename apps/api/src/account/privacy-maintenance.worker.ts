import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { classifyOperationalFailure } from '../observability/operational-failure';
import { TelemetryService } from '../observability/telemetry.service';
import { PrivacyMaintenanceRepository, type DueDeletion, type PrivacyOperationsSummary } from './privacy-maintenance.repository';
import { ProviderAccountRemovalService } from './provider-account-removal.service';

/** Default cadence of the pass. An implementation detail, not Product authority. */
export const PRIVACY_MAINTENANCE_DEFAULT_POLL_MS = 30_000;
const BATCH = 10;

type Domain = 'PRIVACY_EXPORT' | 'ACCOUNT_DELETION';
type DeletionStep = 'erase' | 'provider_remove' | 'complete';

/**
 * W3-MEGA-S — the server's own asynchronous Privacy & Data pass (W3-PDG-01 §7.2 step 3, §8.2).
 *
 * One single-flight cycle on a timer, the same shape as the runtime-event publisher, and nothing wider: it is not a job
 * framework. Each cycle:
 *
 *   1. prepares pending export packages and discards expired ones (the database does both, in its own transaction);
 *   2. claims the deletions that are due (a short database lease, so several servers never advance one request), and
 *      for each: runs the ONE governed Personal erasure (for an ERASED request, its residual sweep), then removes the
 *      provider account once the database says ERASED, then records it COMPLETED. Every step is idempotent and judged again by the database,
 *      so a crash or lost answer anywhere resumes on a later cycle and never reports a deletion it did not finish.
 *   3. PROD-OPS-01: reads the database's aggregate operational state (migration 0132) and emits it as numbers.
 *
 * BLOCKED (a Connected Worlds row still references the account) is the database's answer and stops there: nothing is
 * erased and the provider account is not touched. Nothing is logged — no account, id or outcome.
 *
 * PROD-OPS-01: every step's outcome is VISIBLE as content-free telemetry (finite labels only; never an id, a text, an
 * error message or a database code), so a failure the pass survives and retries is never silent. Telemetry is
 * fail-soft and never alters a step: the retry semantics, the absence of any attempt cutoff for a deletion, and
 * BLOCKED as a legitimate (non-failure) answer are exactly as before.
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
    private readonly telemetry: TelemetryService,
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
      await this.repository.prepareExports(BATCH).then(
        () => this.signal('PRIVACY_EXPORT', 'prepare', 'success'),
        (error: unknown) => this.signal('PRIVACY_EXPORT', 'prepare', failureOutcome(error)),
      );
      const due = await this.repository.claimDueDeletions(BATCH).then(
        (rows) => { this.signal('ACCOUNT_DELETION', 'claim', 'success'); return rows; },
        (error: unknown): DueDeletion[] => { this.signal('ACCOUNT_DELETION', 'claim', failureOutcome(error)); return []; },
      );
      for (const deletion of due) await this.advance(deletion);
      await this.scan();
    } finally {
      this.running = false;
    }
  }

  private async advance(deletion: DueDeletion): Promise<void> {
    let step: DeletionStep = 'erase';
    try {
      // Always through the erasure, also for an ERASED request: there it sweeps the measurement rows that hang off the
      // provider account (a still-valid session could have written one since), which would otherwise refuse the
      // provider's delete. Only ERASED / ALREADY_ERASED go on to the provider.
      const outcome = await this.repository.erase(deletion.deletionId);
      if (outcome !== 'ERASED' && outcome !== 'ALREADY_ERASED') {
        // BLOCKED is Connected Worlds' legitimate answer, and a cancelled or not-yet-due request lost a race it is
        // meant to lose: neither is an operational failure. Any other answer is one the database never gives.
        this.signal('ACCOUNT_DELETION', 'erase', outcome === 'BLOCKED' ? 'blocked_expected' : outcome === 'CANCELLED' || outcome === 'NOT_DUE' ? 'superseded_expected' : 'integrity_failure');
        return;
      }
      this.signal('ACCOUNT_DELETION', 'erase', 'success');
      step = 'provider_remove';
      const removal = await this.provider.remove(deletion.userId);
      // UNAVAILABLE keeps the request ERASED and retryable, exactly as before; it is now visible.
      this.signal('ACCOUNT_DELETION', 'provider_remove', removal === 'REMOVED' ? 'success' : 'provider_unavailable');
      if (removal !== 'REMOVED') return;
      step = 'complete';
      const completed = await this.repository.complete(deletion.deletionId);
      this.signal('ACCOUNT_DELETION', 'complete', completed === 'COMPLETED' ? 'success' : 'integrity_failure');
    } catch (error) {
      // The database lease expires and a later cycle resumes from the committed state.
      this.signal('ACCOUNT_DELETION', step, step === 'provider_remove' ? 'provider_unavailable' : failureOutcome(error));
    }
  }

  /** PROD-OPS-01 — the aggregate operational state, as numbers. Never a readiness input and never a Product decision. */
  private async scan(): Promise<void> {
    let summary: PrivacyOperationsSummary;
    try {
      summary = await this.repository.readOperationsSummary();
    } catch (error) {
      const outcome = failureOutcome(error);
      this.signal('PRIVACY_EXPORT', 'stuck_scan', outcome);
      this.signal('ACCOUNT_DELETION', 'stuck_scan', outcome);
      return;
    }
    this.signal('PRIVACY_EXPORT', 'stuck_scan', 'success');
    this.signal('ACCOUNT_DELETION', 'stuck_scan', 'success');
    this.quietly(() => {
      const t = this.telemetry;
      t.recordPrivacyOperationState('PRIVACY_EXPORT', 'preparing', summary.exportPreparing);
      t.recordPrivacyOperationState('PRIVACY_EXPORT', 'retrying', summary.exportRetrying);
      t.recordPrivacyOperationState('PRIVACY_EXPORT', 'stuck_preparing', summary.exportStuckPreparing, summary.exportStuckPreparingOldestAgeSeconds);
      t.recordPrivacyOperationState('PRIVACY_EXPORT', 'failed_total', summary.exportFailedTotal);
      t.recordPrivacyOperationState('PRIVACY_EXPORT', 'failed_recent', summary.exportFailedRecent);
      t.recordPrivacyExportRecentFailures('TRANSIENT_DATABASE', summary.exportRecentFailuresTransientDatabase);
      t.recordPrivacyExportRecentFailures('CONSTRAINT_OR_INTEGRITY', summary.exportRecentFailuresConstraintOrIntegrity);
      t.recordPrivacyExportRecentFailures('RESOURCE_OR_CAPACITY', summary.exportRecentFailuresResourceOrCapacity);
      t.recordPrivacyExportRecentFailures('INTERNAL_OTHER', summary.exportRecentFailuresInternalOther);
      t.recordPrivacyOperationState('ACCOUNT_DELETION', 'stuck_due', summary.deletionStuckDue, summary.deletionStuckDueOldestAgeSeconds);
      t.recordPrivacyOperationState('ACCOUNT_DELETION', 'stuck_provider_pending', summary.deletionStuckProviderPending, summary.deletionStuckProviderPendingOldestAgeSeconds);
    });
  }

  private signal(domain: Domain, operation: string, outcome: string): void {
    this.quietly(() => this.telemetry.recordOperationalOutcome(domain, operation, outcome));
  }

  /** Telemetry can never alter the pass, even if the telemetry object itself throws. */
  private quietly(emit: () => void): void {
    try {
      emit();
    } catch {
      // Losing a signal is acceptable; changing a deletion or an export is not.
    }
  }
}

function failureOutcome(error: unknown): 'transport_failure' | 'integrity_failure' {
  return classifyOperationalFailure(error) === 'TRANSPORT' ? 'transport_failure' : 'integrity_failure';
}
