import type { EvidenceRole } from '../hypothesis/hypothesis.types';
import type { HypothesisUpdateRequest } from '../hypothesis/hypothesis-update.types';
import { MAX_DURABLE_ASSOCIATION_COMMANDS } from './durable-association-result';

// Durable managed-batch result vocabulary (A2.3c). Lives on the same effect
// ledger result fields as every other typed effect.
export const HYPOTHESIS_UPDATE_BATCH_RESULT_CODES = ['UPDATES_APPLIED', 'UPDATES_REJECTED'] as const;
export type HypothesisUpdateBatchEffectResultCode = (typeof HYPOTHESIS_UPDATE_BATCH_RESULT_CODES)[number];

export const HYPOTHESIS_UPDATE_CONFIDENCE_STATUSES = ['EVALUATED', 'PENDING_RETRY'] as const;
export type HypothesisUpdateConfidenceStatus = (typeof HYPOTHESIS_UPDATE_CONFIDENCE_STATUSES)[number];

/**
 * One immutable execution receipt of the managed HYPOTHESIS_UPDATE_BATCH
 * effect: the exact durable Association command it consumed (same 1-based
 * ordinal, same target, version, Evidence identity and role), the audit and
 * Confidence identities the invocation supplied, the exact before/after
 * versions the canonical mutation returned, and the durable exact-version
 * Confidence outcome. The receipt is the post-execution recovery contract -
 * it is never repaired, reordered or reinterpreted.
 */
export interface DurableHypothesisUpdateReceipt {
  commandOrdinal: number;
  updateId: string;
  confidenceEvaluationId: string;
  hypothesisId: string;
  expectedVersion: number;
  evidenceId: string;
  evidenceRole: EvidenceRole;
  beforeVersion: number;
  afterVersion: number;
  confidenceStatus: HypothesisUpdateConfidenceStatus;
}

// Recovery of an already-COMPLETED HYPOTHESIS_UPDATE_BATCH effect, cross-checked
// against the exact durable Association command batch. UPDATES_APPLIED recovers
// the exact receipts with zero mutation/Confidence/provider replay;
// UPDATES_REJECTED means zero mutation from the batch committed and the
// execution quarantines; INDETERMINATE covers a malformed payload, an unknown
// code, or any receipt/command mismatch - never a replay, never inference from
// current Hypothesis state, never a repair.
export type HypothesisUpdateBatchRecovery =
  | { status: 'UPDATES_APPLIED'; receipts: DurableHypothesisUpdateReceipt[] }
  | { status: 'UPDATES_REJECTED' }
  | { status: 'INDETERMINATE' };

export interface DurableHypothesisUpdateBatchEffectRow {
  readonly result_code: string | null;
  readonly result_reference: string | null;
  readonly result_payload: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const INDETERMINATE = { status: 'INDETERMINATE' } as const;
const RECEIPT_KEYS = ['commandOrdinal', 'updateId', 'confidenceEvaluationId', 'hypothesisId', 'expectedVersion', 'evidenceId', 'evidenceRole', 'beforeVersion', 'afterVersion', 'confidenceStatus'] as const;

export function recoverHypothesisUpdateBatchResult(
  effect: DurableHypothesisUpdateBatchEffectRow,
  commands: ReadonlyArray<HypothesisUpdateRequest>,
): HypothesisUpdateBatchRecovery {
  if (effect.result_reference !== null) return INDETERMINATE;
  if (effect.result_code === 'UPDATES_REJECTED') {
    return effect.result_payload === null || effect.result_payload === undefined
      ? { status: 'UPDATES_REJECTED' }
      : INDETERMINATE;
  }
  if (effect.result_code !== 'UPDATES_APPLIED') return INDETERMINATE;
  const receipts = canonicalReceipts(effect.result_payload, commands);
  return receipts ? { status: 'UPDATES_APPLIED', receipts } : INDETERMINATE;
}

function canonicalReceipts(
  value: unknown,
  commands: ReadonlyArray<HypothesisUpdateRequest>,
): DurableHypothesisUpdateReceipt[] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_DURABLE_ASSOCIATION_COMMANDS) return undefined;
  if (value.length !== commands.length) return undefined;
  const identities = new Set<string>();
  const recovered: DurableHypothesisUpdateReceipt[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    const command = commands[index];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
    const receipt = entry as Record<string, unknown>;
    if (Object.keys(receipt).length !== RECEIPT_KEYS.length || RECEIPT_KEYS.some((key) => !(key in receipt))) return undefined;
    if (receipt.commandOrdinal !== index + 1) return undefined;
    if (typeof receipt.updateId !== 'string' || !UUID.test(receipt.updateId)) return undefined;
    if (typeof receipt.confidenceEvaluationId !== 'string' || !UUID.test(receipt.confidenceEvaluationId)) return undefined;
    // Audit and Confidence identities are unique, and never reused across the
    // two identity sets.
    const updateKey = receipt.updateId.toLowerCase();
    const confidenceKey = receipt.confidenceEvaluationId.toLowerCase();
    if (identities.has(updateKey) || identities.has(confidenceKey) || updateKey === confidenceKey) return undefined;
    identities.add(updateKey);
    identities.add(confidenceKey);
    // The receipt must be the exact durable Association command at the same
    // ordinal: identity is never inferred from current Hypothesis state.
    if (receipt.hypothesisId !== command.hypothesisId) return undefined;
    if (receipt.expectedVersion !== command.expectedVersion) return undefined;
    if (receipt.evidenceId !== command.evidenceId) return undefined;
    if (receipt.evidenceRole !== command.evidenceRole) return undefined;
    if (receipt.beforeVersion !== command.expectedVersion) return undefined;
    if (receipt.afterVersion !== command.expectedVersion + 1) return undefined;
    if (receipt.confidenceStatus !== 'EVALUATED' && receipt.confidenceStatus !== 'PENDING_RETRY') return undefined;
    recovered.push({
      commandOrdinal: index + 1,
      updateId: receipt.updateId,
      confidenceEvaluationId: receipt.confidenceEvaluationId,
      hypothesisId: command.hypothesisId,
      expectedVersion: command.expectedVersion,
      evidenceId: command.evidenceId,
      evidenceRole: command.evidenceRole,
      beforeVersion: command.expectedVersion,
      afterVersion: command.expectedVersion + 1,
      confidenceStatus: receipt.confidenceStatus,
    });
  }
  return recovered;
}
