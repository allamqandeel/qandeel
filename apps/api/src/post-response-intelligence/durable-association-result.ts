import type { EvidenceRole } from '../hypothesis/hypothesis.types';
import type { HypothesisUpdateRequest } from '../hypothesis/hypothesis-update.types';
import {
  MAX_FRESH_EVIDENCE_ASSOCIATIONS,
  type HypothesisEvidenceAssociationAuthorization,
} from '../hypothesis/hypothesis-evidence-association.types';

// Durable successful-Association result vocabulary. Mirrors the typed MEMORY_WRITE
// durable result (migration 0024) on the same effect ledger.
export const ASSOCIATION_EFFECT_RESULT_CODES = ['NO_ASSOCIATION', 'AUTHORIZED_COMMANDS'] as const;
export type AssociationEffectResultCode = (typeof ASSOCIATION_EFFECT_RESULT_CODES)[number];

// The durable authorized batch is bounded by the existing association contract.
export const MAX_DURABLE_ASSOCIATION_COMMANDS = MAX_FRESH_EVIDENCE_ASSOCIATIONS;

export type DurableAssociationResult =
  | { code: 'NO_ASSOCIATION' }
  | { code: 'AUTHORIZED_COMMANDS'; commands: HypothesisUpdateRequest[] };

// Recovery of an already-COMPLETED ASSOCIATION_PROVIDER effect. INDETERMINATE
// means the durable result is legacy/null/malformed/contradictory and the effect
// must fail closed (quarantine) — never a provider replay, never re-inference.
export type AssociationRecovery =
  | { status: 'NO_ASSOCIATION' }
  | { status: 'AUTHORIZED_COMMANDS'; commands: HypothesisUpdateRequest[] }
  | { status: 'INDETERMINATE' };

// The durable row shape on the canonical effect ledger: the authorized command
// batch lives in the shared result_payload field established by migration 0029
// (there is no dedicated result_commands column).
export interface DurableAssociationEffectRow {
  readonly result_code: string | null;
  readonly result_reference: string | null;
  readonly result_payload: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MEMORY_REFERENCE = /^memory:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EVIDENCE_ROLES = new Set<EvidenceRole>(['SUPPORTING', 'CONTRADICTING']);

// Maps a successful post-authorization result into the durable result to persist.
// Only the two success statuses persist; every other status (including
// NOT_AUTHORIZED) returns null and must never become a durable success.
export function toDurableAssociationResult(
  authorization: HypothesisEvidenceAssociationAuthorization,
): DurableAssociationResult | null {
  if (authorization.status === 'NO_ASSOCIATION') return { code: 'NO_ASSOCIATION' };
  if (authorization.status === 'AUTHORIZED') {
    if (!isValidCommandBatch(authorization.commands, authorization.commands[0]?.evidenceId)) return null;
    return { code: 'AUTHORIZED_COMMANDS', commands: authorization.commands };
  }
  return null;
}

// Deterministically recovers a completed ASSOCIATION_PROVIDER effect's durable
// result against the fresh Evidence identity from the durable MEMORY_WRITE
// result. Legacy/null/malformed/contradictory results are INDETERMINATE.
export function recoverAssociationResult(
  effect: DurableAssociationEffectRow,
  freshEvidenceId: string,
): AssociationRecovery {
  if (!MEMORY_REFERENCE.test(freshEvidenceId)) return { status: 'INDETERMINATE' };
  if (effect.result_code === 'NO_ASSOCIATION') {
    if (effect.result_reference !== null || (effect.result_payload !== null && effect.result_payload !== undefined)) return { status: 'INDETERMINATE' };
    return { status: 'NO_ASSOCIATION' };
  }
  if (effect.result_code === 'AUTHORIZED_COMMANDS') {
    const payload = effect.result_payload;
    if (effect.result_reference !== null || !isValidCommandBatch(payload, freshEvidenceId)) {
      return { status: 'INDETERMINATE' };
    }
    return { status: 'AUTHORIZED_COMMANDS', commands: payload.map(normalizeCommand) };
  }
  return { status: 'INDETERMINATE' };
}

function isValidCommandBatch(value: unknown, expectedEvidenceId: string | undefined): value is HypothesisUpdateRequest[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_DURABLE_ASSOCIATION_COMMANDS) return false;
  if (expectedEvidenceId === undefined || !MEMORY_REFERENCE.test(expectedEvidenceId)) return false;
  const targets = new Set<string>();
  for (const command of value) {
    if (!isValidCommand(command) || command.evidenceId !== expectedEvidenceId) return false;
    if (targets.has(command.hypothesisId)) return false;
    targets.add(command.hypothesisId);
  }
  return true;
}

function isValidCommand(value: unknown): value is HypothesisUpdateRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const command = value as Record<string, unknown>;
  if (Object.keys(command).length !== 4) return false;
  return typeof command.hypothesisId === 'string' && UUID.test(command.hypothesisId) &&
    typeof command.expectedVersion === 'number' && Number.isSafeInteger(command.expectedVersion) &&
    command.expectedVersion > 0 && command.expectedVersion <= 2_147_483_647 &&
    typeof command.evidenceId === 'string' && MEMORY_REFERENCE.test(command.evidenceId) &&
    typeof command.evidenceRole === 'string' && EVIDENCE_ROLES.has(command.evidenceRole as EvidenceRole);
}

function normalizeCommand(value: unknown): HypothesisUpdateRequest {
  const command = value as Record<string, unknown>;
  return {
    hypothesisId: command.hypothesisId as string,
    expectedVersion: command.expectedVersion as number,
    evidenceId: command.evidenceId as string,
    evidenceRole: command.evidenceRole as EvidenceRole,
  };
}
