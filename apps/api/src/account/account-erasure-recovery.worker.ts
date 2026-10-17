import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { classifyOperationalFailure } from '../observability/operational-failure';
import { TelemetryService } from '../observability/telemetry.service';
import { PrivacyMaintenanceRepository, type AccountErasureOperationsSummary } from './privacy-maintenance.repository';
import { ProviderAccountRemovalService } from './provider-account-removal.service';

/** Default cadence of the pass. An implementation detail, not Product authority. */
export const ACCOUNT_ERASURE_RECOVERY_DEFAULT_POLL_MS = 5 * 60_000;
const REARM_BATCH = 20;

/**
 * ACCT-DEL-01 (P-3) — the account erasure's own recovery and visibility pass, beside the Privacy & Data pass and
 * sharing nothing with its cycle:
 *
 *   1. re-arm: the database re-judges every BLOCKED request whose residue classes are now all covered by a module (or
 *      that never recorded a class); a clean one is SCHEDULED again with a fresh grace period its owner can cancel.
 *      Nothing is re-armed today - no module covers Shared STANDARD, Public or Replay yet (ACCT-DEL-02, Stage 7) - so
 *      a BLOCKED request waits for its class, truthfully, instead of for nobody.
 *   2. scan: the erasure's aggregate state as numbers - BLOCKED requests by residue class, requests under a RETRY or an
 *      INTEGRITY backoff, erased requests whose photo files are not yet proven gone (and the oldest), and how many
 *      residue classes no module covers (the release gate's number).
 *
 * Content-free (finite labels; never an id, a class of a person, a text or a database code), fail-soft, one cycle at a
 * time, a timer that never keeps the process alive; enabled exactly where the Privacy & Data pass is.
 */
@Injectable()
export class AccountErasureRecoveryWorker implements OnModuleInit, OnModuleDestroy {
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
    const poll = Number(process.env.ACCOUNT_ERASURE_RECOVERY_POLL_MS ?? ACCOUNT_ERASURE_RECOVERY_DEFAULT_POLL_MS);
    this.timer = setInterval(() => void this.runOnce(), Number.isFinite(poll) && poll >= 1000 ? poll : ACCOUNT_ERASURE_RECOVERY_DEFAULT_POLL_MS);
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
      await this.repository.rearmBlockedDeletions(REARM_BATCH).then(
        () => this.signal('rearm', 'success'),
        (error: unknown) => this.signal('rearm', failureOutcome(error)),
      );
      let summary: AccountErasureOperationsSummary;
      try {
        summary = await this.repository.readErasureOperations();
      } catch (error) {
        this.signal('operations_scan', failureOutcome(error));
        return;
      }
      this.signal('operations_scan', 'success');
      this.quietly(() => {
        const t = this.telemetry;
        t.recordPrivacyOperationState('ACCOUNT_ERASURE', 'blocked_shared_standard', summary.blockedSharedStandard);
        t.recordPrivacyOperationState('ACCOUNT_ERASURE', 'blocked_public', summary.blockedPublic);
        t.recordPrivacyOperationState('ACCOUNT_ERASURE', 'blocked_replay', summary.blockedReplay);
        t.recordPrivacyOperationState('ACCOUNT_ERASURE', 'blocked_unregistered', summary.blockedUnregistered);
        t.recordPrivacyOperationState('ACCOUNT_ERASURE', 'blocked_unclassified', summary.blockedUnclassified);
        t.recordPrivacyOperationState('ACCOUNT_ERASURE', 'retrying', summary.retrying);
        t.recordPrivacyOperationState('ACCOUNT_ERASURE', 'integrity_holding', summary.integrityHolding);
        t.recordPrivacyOperationState('ACCOUNT_ERASURE', 'media_pending', summary.mediaPending, summary.mediaPendingOldestAgeSeconds);
        t.recordPrivacyOperationState('ACCOUNT_ERASURE', 'uncovered_classes', summary.uncoveredClasses);
      });
    } finally {
      this.running = false;
    }
  }

  private signal(operation: 'rearm' | 'operations_scan', outcome: string): void {
    this.quietly(() => this.telemetry.recordOperationalOutcome('ACCOUNT_ERASURE', operation, outcome));
  }

  /** Telemetry can never alter the pass, even if the telemetry object itself throws. */
  private quietly(emit: () => void): void {
    try {
      emit();
    } catch {
      // Losing a signal is acceptable; changing a deletion is not.
    }
  }
}

function failureOutcome(error: unknown): 'transport_failure' | 'integrity_failure' {
  return classifyOperationalFailure(error) === 'TRANSPORT' ? 'transport_failure' : 'integrity_failure';
}
