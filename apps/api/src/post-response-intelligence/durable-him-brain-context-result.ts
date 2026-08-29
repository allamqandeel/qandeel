import {
  HIM_BRAIN_CONTEXT_MATERIALIZATION_SOURCE,
  HIM_BRAIN_CONTEXT_MAX_SIGNALS,
  himBrainContextRegistryEntry,
  type HimBrainContextDurablePayload,
  type HimBrainContextDurableSignal,
  type HimBrainContextNumericValue,
} from '../human-model/him-brain-context.types';

// QHIA-012: the durable MANAGED Brain Context materialization result vocabulary.
//
// It lives on the same effect ledger result fields every other typed effect
// uses. There is deliberately no partial, failed, or degraded completed code:
// the background path either materialized at least one KNOWN canonical signal
// for the exact source turn, or it authoritatively materialized none.
export const HIM_BRAIN_CONTEXT_EFFECT_RESULT_CODES = ['NO_HIM_BRAIN_CONTEXT', 'HIM_BRAIN_CONTEXT_MATERIALIZED'] as const;
export type HimBrainContextEffectResultCode = (typeof HIM_BRAIN_CONTEXT_EFFECT_RESULT_CODES)[number];

/**
 * The typed durable result the background materializer produces and the managed
 * database command persists. NO_HIM_BRAIN_CONTEXT carries no payload at all;
 * HIM_BRAIN_CONTEXT_MATERIALIZED carries the exact bounded payload below and
 * nothing else.
 */
export type DurableHimBrainContextResult =
  | { readonly code: 'NO_HIM_BRAIN_CONTEXT' }
  | { readonly code: 'HIM_BRAIN_CONTEXT_MATERIALIZED'; readonly payload: HimBrainContextDurablePayload };

/**
 * Recovery of an already-COMPLETED HIM_BRAIN_CONTEXT_MATERIALIZATION effect,
 * cross-checked against the exact source turn of the same execution.
 *
 * INDETERMINATE covers a result-less completion, an unknown code, a malformed
 * payload, a payload bound to a different source turn, and any impossible
 * code/payload pairing. It is never repaired, reordered, reinterpreted, or
 * recomputed from current world state: the whole point of the durable result is
 * that a later binding change must not be able to rewrite it.
 */
export type HimBrainContextRecovery =
  | { readonly status: 'NO_HIM_BRAIN_CONTEXT' }
  | { readonly status: 'HIM_BRAIN_CONTEXT_MATERIALIZED'; readonly payload: HimBrainContextDurablePayload }
  | { readonly status: 'INDETERMINATE' };

export interface DurableHimBrainContextEffectRow {
  readonly result_code: string | null;
  readonly result_reference: string | null;
  readonly result_payload: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const INDETERMINATE = { status: 'INDETERMINATE' } as const;
const PAYLOAD_KEYS = ['contractVersion', 'source', 'sourceTurnId', 'signals'] as const;
const SIGNAL_KEYS = [
  'slotOrder', 'slot', 'contextKind', 'contextId', 'numericValue',
  'semanticMappingStatus', 'semanticType', 'freshnessState', 'confidenceState',
] as const;
// The existing v1 structured scale contract. Structural bound only.
const MIN_NUMERIC_VALUE = 1;
const MAX_NUMERIC_VALUE = 5;

/**
 * Strictly parses a persisted durable Brain Context payload. It is the ONE
 * application-side reader of that shape and is shared by the background
 * recovery path and by every consumer of a completed effect, so no second,
 * more permissive copy of these rules can drift into existence.
 *
 * It reads no table, evaluates no binding, and consults no current value: a
 * durable receipt is validated for SHAPE and IDENTITY only.
 */
export function parseHimBrainContextDurablePayload(
  value: unknown,
  expectedSourceTurnId: string,
): HimBrainContextDurablePayload | undefined {
  if (typeof expectedSourceTurnId !== 'string' || !UUID.test(expectedSourceTurnId)) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const payload = value as Record<string, unknown>;
  if (Object.keys(payload).length !== PAYLOAD_KEYS.length || PAYLOAD_KEYS.some((key) => !(key in payload))) return undefined;
  if (payload.contractVersion !== 1) return undefined;
  if (payload.source !== HIM_BRAIN_CONTEXT_MATERIALIZATION_SOURCE) return undefined;
  if (typeof payload.sourceTurnId !== 'string' || !UUID.test(payload.sourceTurnId)) return undefined;
  // The durable result belongs to EXACTLY one source turn and is never read on
  // behalf of another.
  if (payload.sourceTurnId.toLowerCase() !== expectedSourceTurnId.toLowerCase()) return undefined;
  if (!Array.isArray(payload.signals)) return undefined;
  if (payload.signals.length < 1 || payload.signals.length > HIM_BRAIN_CONTEXT_MAX_SIGNALS) return undefined;

  const signals: HimBrainContextDurableSignal[] = [];
  let previousSlotOrder = 0;
  for (const entry of payload.signals) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
    const signal = entry as Record<string, unknown>;
    if (Object.keys(signal).length !== SIGNAL_KEYS.length || SIGNAL_KEYS.some((key) => !(key in signal))) return undefined;
    // Strictly increasing registry ordinals: fixed registry order and no
    // duplicate slot, proven by one rule.
    if (typeof signal.slotOrder !== 'number' || signal.slotOrder <= previousSlotOrder) return undefined;
    previousSlotOrder = signal.slotOrder;
    const registry = himBrainContextRegistryEntry(signal.slotOrder);
    if (!registry) return undefined;
    // Each slot is pinned to its one frozen context kind.
    if (signal.slot !== registry.slot || signal.contextKind !== registry.contextKind) return undefined;
    if (typeof signal.contextId !== 'string' || !UUID.test(signal.contextId)) return undefined;
    if (
      typeof signal.numericValue !== 'number' || !Number.isSafeInteger(signal.numericValue)
      || signal.numericValue < MIN_NUMERIC_VALUE || signal.numericValue > MAX_NUMERIC_VALUE
    ) return undefined;
    // The exact persisted semantic mapping, preserved and never coerced.
    if (signal.semanticMappingStatus === 'RESOLVED') {
      if (typeof signal.semanticType !== 'string' || signal.semanticType.length === 0) return undefined;
    } else if (signal.semanticMappingStatus === 'UNRESOLVED') {
      if (signal.semanticType !== null) return undefined;
    } else {
      return undefined;
    }
    // This channel derives neither, ever.
    if (signal.freshnessState !== 'UNASSESSED' || signal.confidenceState !== 'UNASSESSED') return undefined;
    signals.push({
      slotOrder: registry.slotOrder,
      slot: registry.slot,
      contextKind: registry.contextKind,
      contextId: signal.contextId,
      numericValue: signal.numericValue as HimBrainContextNumericValue,
      semanticMappingStatus: signal.semanticMappingStatus,
      semanticType: signal.semanticType as string | null,
      freshnessState: 'UNASSESSED',
      confidenceState: 'UNASSESSED',
    });
  }

  return {
    contractVersion: 1,
    source: HIM_BRAIN_CONTEXT_MATERIALIZATION_SOURCE,
    sourceTurnId: payload.sourceTurnId,
    signals,
  };
}

/**
 * Deterministically recovers a completed HIM_BRAIN_CONTEXT_MATERIALIZATION
 * effect against the exact source turn of its own execution. Anything it cannot
 * recognise exactly is INDETERMINATE - a result-less completion included,
 * because "which signals were materialized" is then unknowable and must never
 * be guessed, repaired, or recomputed.
 */
export function recoverHimBrainContextResult(
  effect: DurableHimBrainContextEffectRow,
  expectedSourceTurnId: string,
): HimBrainContextRecovery {
  if (effect.result_reference !== null) return INDETERMINATE;
  if (effect.result_code === 'NO_HIM_BRAIN_CONTEXT') {
    return effect.result_payload === null || effect.result_payload === undefined
      ? { status: 'NO_HIM_BRAIN_CONTEXT' }
      : INDETERMINATE;
  }
  if (effect.result_code !== 'HIM_BRAIN_CONTEXT_MATERIALIZED') return INDETERMINATE;
  const payload = parseHimBrainContextDurablePayload(effect.result_payload, expectedSourceTurnId);
  return payload ? { status: 'HIM_BRAIN_CONTEXT_MATERIALIZED', payload } : INDETERMINATE;
}
