import { randomUUID } from 'node:crypto';
import { currentAiUsageAttribution } from './ai-usage-attribution';
import {
  ABSENT_AI_USAGE,
  AI_MODEL_IDENTITY,
  AI_PROVIDER_OPERATION,
  type AiFeatureFamily,
  type AiProcessingPath,
  type AiProvider,
  type AiProviderCallDescriptor,
  type AiProviderCallOutcome,
  type AiProviderOperation,
  type NormalizedAiUsage,
} from './ai-usage.types';

// AI-COST-01 - THE accounting boundary every production provider attempt passes through.
//
//   beginCall (durable PENDING intent) -> the external provider request -> settleCall (usage, rated in the database)
//
// The law it enforces:
//   1. No intent, no call. If the attempt cannot be attributed to an account, or its PENDING row cannot be written,
//      the provider is never contacted: the caller gets ONE error before any spend, which every adapter already maps
//      to its existing bounded "provider unavailable" outcome. There is no "ledger is down, call anyway" path.
//   2. One external attempt, one row. The id is fresh per attempt; a retry that contacts the provider again is a new
//      row (the database numbers it). Replaying the same settlement is idempotent in the database.
//   3. Unknown stays unknown. A failure, a missing usage object or an unreadable one settles as such; nothing is
//      padded with zero, and a crash between begin and settle leaves the row PENDING for the stale summary.
//   4. Accounting never changes the Product answer. Once the provider has answered, a settlement failure is retried
//      once and then made operationally visible; the answer is returned untouched. A provider error is re-thrown
//      exactly as it arrived.
//   5. Nothing private crosses it: no prompt, response, error text or user content - identities and numbers only.

export interface AiProviderCallBeginRecord {
  readonly callId: string;
  readonly userId: string;
  readonly sessionId: string | null;
  readonly sourceTurnId: string | null;
  readonly provider: AiProvider;
  readonly requestedModel: string;
  readonly operation: AiProviderOperation;
  readonly featureFamily: AiFeatureFamily;
  readonly processingPath: AiProcessingPath | null;
}

export interface AiProviderCallSettleRecord {
  readonly callId: string;
  readonly userId: string;
  readonly outcome: AiProviderCallOutcome;
  readonly usage: NormalizedAiUsage;
}

/** The durable ledger (migration 0135, service-role channel). */
export interface AiProviderCallLedger {
  begin(record: AiProviderCallBeginRecord): Promise<void>;
  settle(record: AiProviderCallSettleRecord): Promise<void>;
}

/** Bounded, fail-soft operational signals. Labels are closed registries; never an id, a model string or a payload. */
export interface AiProviderCallAccountingSignals {
  recordAiProviderCallAccounting(stage: 'begin' | 'settle', outcome: 'success' | 'failure' | 'unattributed'): void;
  recordAiProviderCallSettlement(provider: AiProvider, featureFamily: AiFeatureFamily, outcome: AiProviderCallOutcome, usage: NormalizedAiUsage): void;
}

/** The correlation the request already holds (session / user turn), used only to fill a gap in the attribution. */
export type AiCorrelationReader = () => { readonly session_id?: string; readonly turn_id?: string } | undefined;

/**
 * Raised BEFORE any provider request when the accounting intent cannot be established. `status` 503 lets every
 * adapter's existing classification treat it as "provider unavailable"; it carries no detail of its own.
 */
export class AiProviderCallAccountingUnavailableError extends Error {
  readonly status = 503;
  constructor() {
    super('AI provider call accounting is unavailable; no provider request was started.');
    this.name = 'AiProviderCallAccountingUnavailableError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function abortedBeforeProvider(): Error {
  const error = new Error('The provider request was cancelled before it started.');
  error.name = 'AbortError';
  return error;
}

export class AiProviderCallAccounting {
  constructor(
    private readonly ledger: AiProviderCallLedger,
    private readonly signals?: AiProviderCallAccountingSignals,
    private readonly correlation: AiCorrelationReader = () => undefined,
    private readonly newCallId: () => string = randomUUID,
  ) {}

  async track<T>(
    descriptor: AiProviderCallDescriptor,
    invoke: () => Promise<T>,
    readUsage: (value: T) => NormalizedAiUsage,
    signal?: AbortSignal,
    /** For a transport that answers a failure as a value (an HTTP error status), how that value ended. */
    outcomeOf: (value: T) => 'SUCCEEDED' | 'FAILED' = () => 'SUCCEEDED',
  ): Promise<T> {
    const attribution = currentAiUsageAttribution();
    if (!attribution) {
      this.signal('begin', 'unattributed');
      throw new AiProviderCallAccountingUnavailableError();
    }
    if (!AI_MODEL_IDENTITY.test(descriptor.requestedModel)) {
      this.signal('begin', 'failure');
      throw new AiProviderCallAccountingUnavailableError();
    }
    const correlation = safely(this.correlation);
    const callId = this.newCallId();
    try {
      await this.ledger.begin({
        callId,
        userId: attribution.userId,
        sessionId: attribution.sessionId ?? correlation?.session_id ?? null,
        sourceTurnId: attribution.sourceTurnId ?? correlation?.turn_id ?? null,
        provider: descriptor.provider,
        requestedModel: descriptor.requestedModel,
        operation: AI_PROVIDER_OPERATION[descriptor.provider],
        featureFamily: descriptor.featureFamily,
        processingPath: attribution.processingPath ?? null,
      });
    } catch {
      this.signal('begin', 'failure');
      throw new AiProviderCallAccountingUnavailableError();
    }
    this.signal('begin', 'success');

    const settle = (outcome: AiProviderCallOutcome, usage: NormalizedAiUsage) =>
      this.settle(descriptor, { callId, userId: attribution.userId, outcome, usage });

    if (signal?.aborted) {
      await settle('CANCELLED_BEFORE_PROVIDER', ABSENT_AI_USAGE);
      throw abortedBeforeProvider();
    }
    let value: T;
    try {
      value = await invoke();
    } catch (error) {
      // A failed attempt may still have been billed; nothing says it was free, so its usage is unknown.
      await settle('FAILED', ABSENT_AI_USAGE);
      throw error;
    }
    let usage: NormalizedAiUsage;
    let outcome: 'SUCCEEDED' | 'FAILED';
    try {
      usage = readUsage(value);
    } catch {
      usage = ABSENT_AI_USAGE;
    }
    try {
      outcome = outcomeOf(value);
    } catch {
      outcome = 'FAILED';
    }
    await settle(outcome, usage);
    return value;
  }

  private async settle(descriptor: AiProviderCallDescriptor, record: AiProviderCallSettleRecord): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.ledger.settle(record);
        this.signal('settle', 'success');
        try {
          this.signals?.recordAiProviderCallSettlement(descriptor.provider, descriptor.featureFamily, record.outcome, record.usage);
        } catch { /* fail-soft */ }
        return;
      } catch { /* retried once below; the row stays PENDING (stale, unknown) if both fail */ }
    }
    this.signal('settle', 'failure');
  }

  private signal(stage: 'begin' | 'settle', outcome: 'success' | 'failure' | 'unattributed'): void {
    try { this.signals?.recordAiProviderCallAccounting(stage, outcome); } catch { /* fail-soft */ }
  }
}

function safely<T>(read: () => T): T | undefined {
  try { return read(); } catch { return undefined; }
}
