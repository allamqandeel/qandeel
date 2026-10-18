import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { classifyOperationalFailure } from '../observability/operational-failure';
import { TelemetryService } from '../observability/telemetry.service';
import { IntroductionsForwardDispatchRepository, type ForwardOutcome, type UnpublishedDelivery } from './introductions-forward-dispatch.repository';

/** Default cadence of the pass. An implementation detail, not Product authority. */
export const INTRODUCTIONS_FORWARD_DEFAULT_POLL_MS = 60_000;
/** At most this many single-proposal attempts per cycle, each its own transaction (the 0157 sweeper discipline). */
export const FORWARD_ATTEMPTS_PER_CYCLE = 10;
const RECONCILE_LIMIT = 50;

/**
 * The Activity side of a delivery (CP3): publishes the "a new proposal reached you" item to the delivery's recipient,
 * idempotently by its candidate key. S6-07 CP2 provides NO implementation - the INTRODUCTIONS Activity producer, its copy
 * and its capability truth are CP3 - so until one is bound the worker forwards and never publishes.
 */
export interface IntroductionsDeliveryNotifier {
  publishDelivered(delivery: UnpublishedDelivery): Promise<void>;
}
export const INTRODUCTIONS_DELIVERY_NOTIFIER = Symbol('INTRODUCTIONS_DELIVERY_NOTIFIER');

/** What one cycle did, for the proof harness. Counts only. */
export interface ForwardCycleSummary {
  attempts: number;
  forwarded: number;
  skipped: number;
  busy: number;
  held: number;
  failed: number;
  published: number;
  publishFailed: number;
}

type DispatchSignal = 'success' | 'superseded_expected' | 'blocked_expected' | 'retry_expected' | 'transport_failure' | 'integrity_failure';
const SIGNAL: Readonly<Record<Exclude<ForwardOutcome, 'NONE_DUE'>, DispatchSignal>> = {
  FORWARDED: 'success',
  SKIPPED_MOVED: 'superseded_expected',
  SKIPPED_NO_CONCLUSION: 'blocked_expected',
  SKIPPED_NOT_CLEARED: 'blocked_expected',
  SKIPPED_NOT_READY: 'blocked_expected',
  SKIPPED_STALE: 'blocked_expected',
  BUSY: 'retry_expected',
  HELD_INTEGRITY: 'integrity_failure',
};

/**
 * S6-07 (CP2, CA-SYS-02, QAN-BL-MATCH-06) — the forward dispatcher's server pass. Each cycle:
 *
 *   1. FORWARD   up to FORWARD_ATTEMPTS_PER_CYCLE calls of the ONE database dispatcher, each one proposal in its own
 *                transaction: the pair lock first, the ids minted once in the ledger, then the frozen forward core,
 *                whose revalidation and CW2-08 seam decide. The cycle ends at NONE_DUE, at BUSY (a pair held by a
 *                human decision is the next cycle's, never a tight loop) and at any failure. A proposal that is not ready
 *                waits its own backoff in the database, so it cannot starve the others.
 *   2. RECONCILE only when an Activity notifier is bound (CP3): every committed delivery whose recipient has no Activity
 *                member yet is published, idempotently. Publication is never part of the forward transaction, so a
 *                worker that dies after a committed forward finds the delivery again on its next cycle.
 *
 * It decides nothing a human or the frozen core decides, takes no client input, and logs nothing: telemetry is
 * content-free finite labels only (`INTRODUCTIONS_FORWARD` / dispatch, reconcile) - never a person, proposal, view or
 * count as a label. One cycle at a time, a timer that never keeps the process alive, off under tests and whenever the
 * server channel is not configured, and switchable off (`INTRODUCTIONS_FORWARD_DISPATCH_DISABLED=true`). With the CW2-08
 * seam closed, as it is in production, every attempt ends SKIPPED_NOT_CLEARED and nothing is delivered.
 */
@Injectable()
export class IntroductionsForwardDispatcherWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private stopped = false;

  constructor(
    private readonly repository: IntroductionsForwardDispatchRepository,
    @Optional() private readonly telemetry?: TelemetryService,
    @Optional() @Inject(INTRODUCTIONS_DELIVERY_NOTIFIER) private readonly notifier?: IntroductionsDeliveryNotifier,
  ) {}

  get enabled(): boolean {
    return Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) && process.env.NODE_ENV !== 'test'
      && process.env.INTRODUCTIONS_FORWARD_DISPATCH_DISABLED !== 'true';
  }

  onModuleInit(): void {
    if (!this.enabled || this.stopped) return;
    const poll = Number(process.env.INTRODUCTIONS_FORWARD_DISPATCH_POLL_MS ?? INTRODUCTIONS_FORWARD_DEFAULT_POLL_MS);
    this.timer = setInterval(() => void this.runOnce(), Number.isFinite(poll) && poll >= 1000 ? poll : INTRODUCTIONS_FORWARD_DEFAULT_POLL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** One cycle. A cycle already in flight is not doubled; it never throws. */
  async runOnce(): Promise<ForwardCycleSummary> {
    const summary: ForwardCycleSummary = { attempts: 0, forwarded: 0, skipped: 0, busy: 0, held: 0, failed: 0, published: 0, publishFailed: 0 };
    if (this.running || this.stopped) return summary;
    this.running = true;
    try {
      for (let i = 0; i < FORWARD_ATTEMPTS_PER_CYCLE; i += 1) {
        let outcome: ForwardOutcome;
        try {
          outcome = await this.repository.forwardOne();
        } catch (error) {
          // Nothing was committed by a call that failed; the next cycle tries again.
          summary.failed += 1;
          this.signal('dispatch', failureOutcome(error));
          break;
        }
        if (outcome === 'NONE_DUE') break;
        summary.attempts += 1;
        if (outcome === 'FORWARDED') summary.forwarded += 1;
        else if (outcome === 'BUSY') summary.busy += 1;
        else if (outcome === 'HELD_INTEGRITY') summary.held += 1;
        else summary.skipped += 1;
        this.signal('dispatch', SIGNAL[outcome]);
        if (outcome === 'BUSY') break;
      }
      if (this.notifier) await this.reconcile(this.notifier, summary);
      return summary;
    } finally {
      this.running = false;
    }
  }

  private async reconcile(notifier: IntroductionsDeliveryNotifier, summary: ForwardCycleSummary): Promise<void> {
    let pending: UnpublishedDelivery[];
    try {
      pending = await this.repository.listUnpublishedDeliveries(RECONCILE_LIMIT);
    } catch (error) {
      this.signal('reconcile', failureOutcome(error));
      return;
    }
    let failure: 'transport_failure' | 'integrity_failure' | undefined;
    for (const delivery of pending) {
      try {
        await notifier.publishDelivered(delivery);
        summary.published += 1;
      } catch (error) {
        // It stays listed (the database still sees no Activity member) and is published on a later cycle.
        summary.publishFailed += 1;
        failure ??= failureOutcome(error);
      }
    }
    this.signal('reconcile', failure ?? 'success');
  }

  /** One content-free outcome; a telemetry failure never reaches the pass. */
  private signal(operation: 'dispatch' | 'reconcile', outcome: DispatchSignal): void {
    try {
      this.telemetry?.recordOperationalOutcome('INTRODUCTIONS_FORWARD', operation, outcome);
    } catch {
      // Observability is best-effort.
    }
  }
}

function failureOutcome(error: unknown): 'transport_failure' | 'integrity_failure' {
  return classifyOperationalFailure(error) === 'TRANSPORT' ? 'transport_failure' : 'integrity_failure';
}
