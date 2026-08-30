import { Injectable, Optional } from '@nestjs/common';
import { TelemetryService } from '../observability/telemetry.service';
import { PostResponseProviderBudget, reconstructSpentProviderSlots } from './post-response-provider-budget';
import type { IntelligenceEffectState } from './post-response-intelligence.types';

/**
 * QIR-005 - the narrow server-owned factory for one durable execution's provider
 * budget.
 *
 * Its whole job is to open a `PostResponseProviderBudget` whose spent slots are
 * reconstructed from the DURABLE effect ledger, and to bind it to the bounded
 * fail-soft provider-budget telemetry surface. It performs no I/O of its own: it
 * reads no database, touches no Redis, calls no provider, owns no retry or
 * reclaim policy, and holds no per-execution state between calls.
 *
 * It deliberately does NOT perform the durable claim. The dispatcher stays the
 * composition/execution engine and issues the claim itself, so this abstraction
 * can never grow into a generic workflow engine.
 */
@Injectable()
export class PostResponseProviderBudgetService {
  constructor(@Optional() private readonly telemetry?: TelemetryService) {}

  /**
   * Opens the provider budget for ONE durable post-response execution.
   *
   * `effects` is the durable effect ledger snapshot for that execution, which is
   * the ONLY authority for already-spent provider slots. Because nothing about
   * the delivery, the reclaim, the attempt count or the process is consulted,
   * reopening the budget on a duplicate delivery, a reclaimed redelivery, a
   * redispatch or after a process restart re-derives the SAME spent set instead
   * of resetting it.
   *
   * `processingPath` is a bounded FAST/DEEP telemetry label only; it never
   * changes an authorization and never scales the cap.
   */
  open(effects: readonly IntelligenceEffectState[], processingPath: 'FAST' | 'DEEP' | null): PostResponseProviderBudget {
    return new PostResponseProviderBudget(
      reconstructSpentProviderSlots(effects),
      (effect, decision) => this.telemetry?.recordPostResponseProviderBudget(effect, decision, processingPath),
    );
  }
}
