import { MAX_GENERATED_HYPOTHESIS_CANDIDATES } from '../hypothesis/hypothesis-generation.types';

// Durable managed Confidence-batch result vocabulary (QAN-AUD-06). It lives on
// the same effect ledger result fields every other typed effect uses. There is
// deliberately no partial/failed completed code: the batch is complete only
// when every frozen target has a valid Confidence evaluation.
export const CONFIDENCE_BATCH_EFFECT_RESULT_CODES = ['NO_CONFIDENCE_TARGETS', 'CONFIDENCE_BATCH_EVALUATED'] as const;
export type ConfidenceBatchEffectResultCode = (typeof CONFIDENCE_BATCH_EFFECT_RESULT_CODES)[number];

/**
 * One immutable Confidence-batch receipt: the 1-based position in the durable
 * generation persistence order, the exact target Hypothesis, the exact target
 * version frozen at first batch initialization, and the stable evaluation
 * identity the database generated for that target. The receipt is the
 * post-execution recovery contract - it is never repaired, reordered or
 * reinterpreted, and a later Hypothesis version is never substituted into it.
 */
export interface DurableConfidenceBatchReceipt {
  ordinal: number;
  hypothesisId: string;
  targetVersion: number;
  confidenceEvaluationId: string;
}

// Recovery of an already-COMPLETED CONFIDENCE_BATCH effect, cross-checked
// against the exact recovered HYPOTHESIS_PERSISTENCE ID list. INDETERMINATE
// covers a legacy pre-0035 all-null generic completion, a malformed payload, an
// unknown code, an impossible code/target-count pairing and any receipt/target
// mismatch - never an inference, never a Confidence replay.
export type ConfidenceBatchRecovery =
  | { status: 'NO_CONFIDENCE_TARGETS' }
  | { status: 'CONFIDENCE_BATCH_EVALUATED'; receipts: DurableConfidenceBatchReceipt[] }
  | { status: 'INDETERMINATE' };

export interface DurableConfidenceBatchEffectRow {
  readonly result_code: string | null;
  readonly result_reference: string | null;
  readonly result_payload: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const INDETERMINATE = { status: 'INDETERMINATE' } as const;
const RECEIPT_KEYS = ['ordinal', 'hypothesisId', 'targetVersion', 'confidenceEvaluationId'] as const;

/**
 * Deterministically recovers a completed CONFIDENCE_BATCH effect's durable
 * result against the exact durable persisted Hypothesis IDs of the same
 * execution. It never reads current Hypothesis state, never re-evaluates
 * Confidence and never assigns new identities: anything it cannot recognise
 * exactly is INDETERMINATE - a legacy pre-0035 result-less completion included,
 * because which targets actually got a Confidence snapshot is unknowable.
 */
export function recoverConfidenceBatchResult(
  effect: DurableConfidenceBatchEffectRow,
  persistedHypothesisIds: readonly string[],
): ConfidenceBatchRecovery {
  if (effect.result_reference !== null) return INDETERMINATE;
  if (effect.result_code === 'NO_CONFIDENCE_TARGETS') {
    if (effect.result_payload !== null && effect.result_payload !== undefined) return INDETERMINATE;
    return persistedHypothesisIds.length === 0 ? { status: 'NO_CONFIDENCE_TARGETS' } : INDETERMINATE;
  }
  if (effect.result_code !== 'CONFIDENCE_BATCH_EVALUATED') return INDETERMINATE;
  if (persistedHypothesisIds.length < 1 || persistedHypothesisIds.length > MAX_GENERATED_HYPOTHESIS_CANDIDATES) return INDETERMINATE;
  const receipts = canonicalReceipts(effect.result_payload, persistedHypothesisIds);
  return receipts ? { status: 'CONFIDENCE_BATCH_EVALUATED', receipts } : INDETERMINATE;
}

function canonicalReceipts(
  value: unknown,
  persistedHypothesisIds: readonly string[],
): DurableConfidenceBatchReceipt[] | undefined {
  if (!Array.isArray(value) || value.length !== persistedHypothesisIds.length) return undefined;
  const identities = new Set<string>();
  const recovered: DurableConfidenceBatchReceipt[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
    const receipt = entry as Record<string, unknown>;
    if (Object.keys(receipt).length !== RECEIPT_KEYS.length || RECEIPT_KEYS.some((key) => !(key in receipt))) return undefined;
    if (receipt.ordinal !== index + 1) return undefined;
    // The target is the exact durable persisted Hypothesis at this position:
    // identity is never inferred from current Hypothesis rows and the order of
    // the original generation persistence is authoritative. Comparison is
    // canonical-UUID identity (case-insensitive), never string shape.
    const expected = persistedHypothesisIds[index];
    if (typeof receipt.hypothesisId !== 'string' || !UUID.test(receipt.hypothesisId)) return undefined;
    if (typeof expected !== 'string' || receipt.hypothesisId.toLowerCase() !== expected.toLowerCase()) return undefined;
    if (typeof receipt.confidenceEvaluationId !== 'string' || !UUID.test(receipt.confidenceEvaluationId)) return undefined;
    const targetKey = receipt.hypothesisId.toLowerCase();
    const evaluationKey = receipt.confidenceEvaluationId.toLowerCase();
    if (identities.has(targetKey) || identities.has(evaluationKey) || targetKey === evaluationKey) return undefined;
    identities.add(targetKey);
    identities.add(evaluationKey);
    if (typeof receipt.targetVersion !== 'number' || !Number.isSafeInteger(receipt.targetVersion) || receipt.targetVersion < 1) return undefined;
    recovered.push({
      ordinal: index + 1,
      hypothesisId: receipt.hypothesisId,
      targetVersion: receipt.targetVersion,
      confidenceEvaluationId: receipt.confidenceEvaluationId,
    });
  }
  return recovered;
}
