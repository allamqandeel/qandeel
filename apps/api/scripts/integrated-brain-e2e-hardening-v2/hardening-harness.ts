// QIR-007 Integrated Brain E2E Hardening v2 — verification-only harness.
//
// Everything in this file is TEST INSTRUMENTATION around the frozen A2 /
// Full Intelligence transport substitutes. It decides NO intelligence
// semantics, reimplements NO domain rule, and is never imported by any
// production module:
//
//   * the conversational router double still records the request through the
//     REAL production `composeServerGuidance`, and its only added behaviour is
//     an armed provider FAILURE — the canonical
//     `CONVERSATIONAL_PROVIDER_FAILURE` class QIR-001 already names;
//   * the transport wrappers inject INFRASTRUCTURE faults (a canonical
//     4xx/5xx Data API status, a malformed successful boundary payload, a lost
//     HTTP transport, or a deterministically deferred settlement) at exactly
//     the boundaries production already treats as external. They never change
//     an authority answer and never fabricate durable state;
//   * the telemetry census DELEGATES every call to the REAL TelemetryService
//     and only records what production emitted.
//
// No provider key is read here, no network call is made, and no canonical
// database authority is bypassed: every SQL statement still runs through the
// frozen smoke transport substitutes against real PostgreSQL.
import type { SmokeDbSession } from '../a2-e2e-smoke/smoke-db';
import type { PgPostResponseIntelligenceRepositoryAdapter } from '../a2-e2e-smoke/pg-post-response-intelligence.adapter';
import {
  DeterministicConversationalModelRouter,
  type RecordedConversationalCall,
} from '../full-intelligence-e2e-smoke/deterministic-conversational-router';
import {
  PgAuthenticatedDataApiAdapter,
  PgConversationServiceRoleApiAdapter,
  SmokeAuthenticatedRpcCensus,
} from '../full-intelligence-e2e-smoke/pg-foreground-intelligence.adapters';
import { ModelRouterProviderError, type ModelRouter, type ModelRouterRequest, type ModelRouterResult } from '../../src/model-router/model-router.types';
import { MemoryDataApiError } from '../../src/memory/memory-data-api.service';
import type { PostResponseIntelligenceRepository } from '../../src/post-response-intelligence/post-response-intelligence.repository';
import type { TelemetryService } from '../../src/observability/telemetry.service';

/** The bounded verifier-specific failure identity of the armed provider fault. */
export const HARDENING_PROVIDER_FAILURE = 'INTEGRATED_BRAIN_E2E_HARDENING_V2_PROVIDER_FAILURE';
export const HARDENING_CONFIDENCE_BATCH_TRANSPORT_LOST = 'INTEGRATED_BRAIN_E2E_HARDENING_V2_CONFIDENCE_BATCH_TRANSPORT_LOST';
export const HARDENING_ASSOCIATION_COMPLETION_TRANSPORT_LOST = 'INTEGRATED_BRAIN_E2E_HARDENING_V2_ASSOCIATION_COMPLETION_TRANSPORT_LOST';

/** Drains the microtask queue: everything queued so far has run when this resolves. */
export function drainMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => { setImmediate(resolve); });
}

/**
 * A deterministic deferred. It replaces every wall-clock sleep in this
 * verifier: a settlement that must lose a frozen foreground deadline is held
 * here and released only AFTER the turn it raced has already finished, so the
 * deadline provably wins instead of winning "usually".
 */
export class DeterministicGate {
  private release: (() => void) | undefined;
  readonly promise: Promise<void>;
  private settled = false;

  constructor() {
    this.promise = new Promise<void>((resolve) => { this.release = resolve; });
  }

  get opened(): boolean { return this.settled; }

  open(): void { this.settled = true; this.release?.(); }
}

/**
 * The ONE conversational provider boundary of this verifier.
 *
 * It delegates recording to the FROZEN Full Intelligence double, so the
 * recorded central guidance is still the output of the REAL production
 * `composeServerGuidance`. The only addition is `failNextCall()`, which raises
 * the canonical `ModelRouterProviderError` AFTER the request was recorded — a
 * genuine conversational provider failure, never a second call, never a retry,
 * and never a fallback provider.
 */
export class HardeningConversationalModelRouter implements ModelRouter {
  private failures = 0;
  private readonly inner: DeterministicConversationalModelRouter;

  constructor(fixedAssistantContent: string) {
    this.inner = new DeterministicConversationalModelRouter(fixedAssistantContent);
  }

  get calls(): ReadonlyArray<RecordedConversationalCall> { return this.inner.calls; }
  get callCount(): number { return this.inner.callCount; }
  get armedFailures(): number { return this.failures; }
  lastCall(): RecordedConversationalCall { return this.inner.calls[this.inner.calls.length - 1]; }

  /** Arms exactly ONE canonical provider failure for the next generation. */
  failNextCall(): void { this.failures += 1; }

  async generate(request: ModelRouterRequest): Promise<ModelRouterResult> {
    const result = await this.inner.generate(request);
    if (this.failures > 0) {
      this.failures -= 1;
      throw new ModelRouterProviderError(HARDENING_PROVIDER_FAILURE);
    }
    return result;
  }
}

/** One armed transport fault for a named service-role RPC. */
export type ServiceRoleFault =
  /** Sanitized transport/configuration unavailability — the approved availability class. */
  | { readonly kind: 'THROW_BEFORE_CALL'; readonly error: unknown }
  /** The RPC really runs; its successful settlement is held until the gate opens. */
  | { readonly kind: 'GATE_AFTER_CALL'; readonly gate: DeterministicGate }
  /** The RPC really runs; after the gate opens the settlement becomes a LATE rejection. */
  | { readonly kind: 'GATE_THEN_REJECT'; readonly gate: DeterministicGate; readonly error: unknown }
  /** A malformed but SUCCESSFUL boundary payload; the canonical command is not executed. */
  | { readonly kind: 'MALFORMED_SUCCESS'; readonly value: unknown };

/**
 * Fault-injecting wrapper over the frozen service-role transport substitute.
 *
 * It records every attempted RPC name (before any fault decision, so a faulted
 * request is still censused) and applies at most ONE armed fault per arming.
 * The underlying canonical SECURITY DEFINER commands are unchanged.
 */
export class HardeningServiceRoleApiAdapter {
  readonly census = new SmokeAuthenticatedRpcCensus();
  private readonly faults = new Map<string, ServiceRoleFault[]>();
  private readonly inner: PgConversationServiceRoleApiAdapter;

  constructor(db: SmokeDbSession) {
    this.inner = new PgConversationServiceRoleApiAdapter(db);
  }

  /** Arms ONE fault for the next call of `name`. Faults are consumed in order. */
  arm(name: string, fault: ServiceRoleFault): void {
    const queue = this.faults.get(name) ?? [];
    queue.push(fault);
    this.faults.set(name, queue);
  }

  armed(name: string): number { return this.faults.get(name)?.length ?? 0; }

  async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    this.census.recordAttempt(name);
    const fault = this.faults.get(name)?.shift();
    if (fault?.kind === 'THROW_BEFORE_CALL') {
      this.census.recordFailure(name);
      throw fault.error;
    }
    if (fault?.kind === 'MALFORMED_SUCCESS') {
      this.census.recordCompletion(name);
      return fault.value as T;
    }
    let rows: T;
    try {
      rows = await this.inner.rpc<T>(name, body);
    } catch (error) {
      this.census.recordFailure(name);
      throw error;
    }
    this.census.recordCompletion(name);
    if (fault?.kind === 'GATE_AFTER_CALL') {
      await fault.gate.promise;
      return rows;
    }
    if (fault?.kind === 'GATE_THEN_REJECT') {
      await fault.gate.promise;
      throw fault.error;
    }
    return rows;
  }
}

/**
 * One armed transport fault for an authenticated PostgREST request. The
 * predicate is what makes the fault land on the EXACT production read the
 * scenario names: the Memory retrieval read and the Evidence read reach the
 * same table through different canonical limits, and a scenario that could not
 * tell them apart would prove nothing about which source degraded.
 */
export interface AuthenticatedFault {
  readonly match: (path: string) => boolean;
  readonly error: unknown;
}

/**
 * Fault-injecting wrapper over the frozen authenticated transport substitute.
 * It is used to reproduce the EXACT approved optional-source availability
 * failure - and the exact NON-approved authority failure - at a real read
 * boundary without touching any production class.
 */
export class HardeningAuthenticatedDataApiAdapter {
  private readonly faults: AuthenticatedFault[] = [];
  private readonly inner: PgAuthenticatedDataApiAdapter;
  private readonly attemptedPaths: string[] = [];

  constructor(db: SmokeDbSession) {
    this.inner = new PgAuthenticatedDataApiAdapter(db);
  }

  get rpcCensus(): SmokeAuthenticatedRpcCensus { return this.inner.rpcCensus; }
  get paths(): ReadonlyArray<string> { return this.attemptedPaths; }
  armed(): number { return this.faults.length; }

  /** Arms ONE fault for the next authenticated request matching the predicate. */
  arm(fault: AuthenticatedFault): void { this.faults.push(fault); }

  async request<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
    this.attemptedPaths.push(path);
    const index = this.faults.findIndex((fault) => fault.match(path));
    if (index >= 0) {
      const [fault] = this.faults.splice(index, 1);
      throw fault.error;
    }
    return this.inner.request<T>(accessToken, path, init);
  }
}

/** A canonical Memory Data API failure with an exact HTTP status. */
export function memoryDataApiFailure(status: number): MemoryDataApiError {
  return new MemoryDataApiError(status);
}

export interface HardeningLedgerFaults {
  /** Loses the HTTP transport of the next managed Confidence-batch command. */
  failNextConfidenceBatchTransport(): void;
  /** Loses the HTTP transport of the next Association completion, AFTER the durable claim. */
  failNextAssociationCompletionTransport(): void;
  readonly armed: number;
}

/**
 * Fault-injecting PROXY over the frozen post-response ledger substitute.
 *
 * Every method is delegated unchanged; only the two named commands can be
 * faulted, and only by LOSING THEIR TRANSPORT - exactly the "the managed
 * command is atomic but HTTP transport is not" case the production dispatcher
 * already documents and reconciles from durable state. The fault is raised
 * BEFORE delegation, so the canonical command genuinely does not execute and
 * the resulting durable checkpoint is real rather than fabricated.
 */
export function createHardeningPostResponseLedger(inner: PgPostResponseIntelligenceRepositoryAdapter): {
  ledger: PostResponseIntelligenceRepository;
  faults: HardeningLedgerFaults;
} {
  const armed = { confidenceBatch: 0, associationCompletion: 0 };
  const faulted = (property: string): string | undefined => {
    if (property === 'executeConfidenceBatch' && armed.confidenceBatch > 0) {
      armed.confidenceBatch -= 1;
      return HARDENING_CONFIDENCE_BATCH_TRANSPORT_LOST;
    }
    if (property === 'completeAssociation' && armed.associationCompletion > 0) {
      armed.associationCompletion -= 1;
      return HARDENING_ASSOCIATION_COMPLETION_TRANSPORT_LOST;
    }
    return undefined;
  };
  const proxy = new Proxy(inner as unknown as Record<string, unknown>, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function' || typeof property !== 'string') return value;
      const method = value as (...args: unknown[]) => unknown;
      return async (...args: unknown[]): Promise<unknown> => {
        const lost = faulted(property);
        if (lost !== undefined) throw new Error(lost);
        return method.apply(target, args);
      };
    },
  });
  return {
    ledger: proxy as unknown as PostResponseIntelligenceRepository,
    faults: {
      failNextConfidenceBatchTransport(): void { armed.confidenceBatch += 1; },
      failNextAssociationCompletionTransport(): void { armed.associationCompletion += 1; },
      get armed(): number { return armed.confidenceBatch + armed.associationCompletion; },
    },
  };
}

export interface RecordedTelemetryCall {
  readonly method: string;
  readonly args: ReadonlyArray<unknown>;
}

/**
 * Verification-only telemetry census.
 *
 * It is a transparent PROXY over the REAL production TelemetryService: every
 * call is forwarded unchanged to the real instance (so production telemetry
 * behaviour, including its own fail-soft guards and finite label registries, is
 * exactly what runs), and every `record*` invocation is additionally recorded
 * so the verifier can prove what production emitted and, more importantly, what
 * it never emits.
 */
export function createTelemetryCensus(real: TelemetryService): {
  telemetry: TelemetryService;
  calls: RecordedTelemetryCall[];
} {
  const calls: RecordedTelemetryCall[] = [];
  const proxy = new Proxy(real as unknown as Record<string, unknown>, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function' || typeof property !== 'string') return value;
      const method = value as (...args: unknown[]) => unknown;
      return (...args: unknown[]): unknown => {
        if (property.startsWith('record')) {
          calls.push({ method: property, args: args.map((argument) => safeClone(argument)) });
        }
        return method.apply(target, args);
      };
    },
  });
  return { telemetry: proxy as unknown as TelemetryService, calls };
}

function safeClone(value: unknown): unknown {
  if (typeof value === 'function') return '[function]';
  try {
    return structuredClone(value);
  } catch {
    return String(value);
  }
}

/**
 * Flattens every scalar a telemetry call carried, so a privacy assertion can
 * scan the ACTUAL emitted dimensions instead of a model of them.
 */
export function telemetryScalars(call: RecordedTelemetryCall): string[] {
  const scalars: string[] = [];
  const walk = (value: unknown): void => {
    if (value === null || value === undefined) return;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      scalars.push(String(value));
      return;
    }
    if (Array.isArray(value)) { for (const item of value) walk(item); return; }
    if (typeof value === 'object') { for (const item of Object.values(value)) walk(item); }
  };
  for (const argument of call.args) walk(argument);
  return scalars;
}
