import { HYPOTHESIS_DOMAINS, HYPOTHESIS_TYPES, MAX_ASSUMPTIONS, MAX_DISCONFIRMING_CONDITIONS, MAX_SCOPE_LENGTH, MAX_STATEMENT_LENGTH, MAX_STRUCTURED_TEXT_LENGTH } from '../hypothesis/hypothesis.types';
import type { HypothesisDomain, HypothesisType } from '../hypothesis/hypothesis.types';
import { hypothesisCollisionKey } from '../hypothesis/hypothesis-generation.policy';
import { MAX_GENERATED_HYPOTHESIS_CANDIDATES, MAX_GENERATION_EVIDENCE_ITEMS } from '../hypothesis/hypothesis-generation.types';
import type { AuthorizedHypothesisGenerationIntent } from '../hypothesis/hypothesis-generation-intent-authority.types';

// Durable successful-generation result vocabularies. Both live on the same
// effect ledger result fields the typed MEMORY_WRITE (0024), INTENT_PROVIDER
// (0029) and ASSOCIATION_PROVIDER (0031) results use.
export const CANDIDATE_EFFECT_RESULT_CODES = ['NO_ACCEPTED_CANDIDATES', 'VALIDATED_CANDIDATES'] as const;
export type CandidateProviderEffectResultCode = (typeof CANDIDATE_EFFECT_RESULT_CODES)[number];
export const HYPOTHESIS_PERSISTENCE_EFFECT_RESULT_CODES = ['NO_HYPOTHESES_PERSISTED', 'HYPOTHESES_PERSISTED'] as const;
export type HypothesisPersistenceEffectResultCode = (typeof HYPOTHESIS_PERSISTENCE_EFFECT_RESULT_CODES)[number];

/**
 * One durable accepted candidate in its exact final stored form: the
 * post-validation canonical proposal fields plus the stable server-assigned
 * Hypothesis UUID. The ID is assigned BEFORE durable Candidate completion and
 * is never regenerated: fresh persistence and recovered persistence both
 * create exactly this identity.
 */
export interface DurableGenerationCandidate {
  hypothesisId: string;
  statement: string;
  type: HypothesisType;
  domain: HypothesisDomain;
  scope: string;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  assumptions: string[];
  disconfirmingConditions: string[];
}

export type DurableCandidateProviderResult =
  | { code: 'NO_ACCEPTED_CANDIDATES' }
  | { code: 'VALIDATED_CANDIDATES'; candidates: DurableGenerationCandidate[] };

// Recovery of an already-COMPLETED CANDIDATE_PROVIDER effect. INDETERMINATE
// means the durable result is legacy/null/malformed/foreign and the effect
// must fail closed (quarantine) - never a provider replay, never inference,
// never replacement IDs.
export type CandidateProviderRecovery =
  | { status: 'NO_ACCEPTED_CANDIDATES' }
  | { status: 'VALIDATED_CANDIDATES'; candidates: DurableGenerationCandidate[] }
  | { status: 'INDETERMINATE' };

// Recovery of an already-COMPLETED HYPOTHESIS_PERSISTENCE effect, cross-checked
// against the recovered Candidate result: NO_ACCEPTED pairs only with
// NO_HYPOTHESES_PERSISTED, VALIDATED pairs only with HYPOTHESES_PERSISTED, and
// the persisted ID list must exactly match the candidate plan IDs in order.
export type HypothesisPersistenceRecovery =
  | { status: 'NO_HYPOTHESES_PERSISTED'; hypothesisIds: [] }
  | { status: 'HYPOTHESES_PERSISTED'; hypothesisIds: string[] }
  | { status: 'INDETERMINATE' };

// The durable row shape on the canonical effect ledger: both generation
// results live in the shared result_payload field established by migration
// 0029 (there is no dedicated generation column).
export interface DurableGenerationEffectRow {
  readonly result_code: string | null;
  readonly result_reference: string | null;
  readonly result_payload: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EVIDENCE_ID = /^memory:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const INDETERMINATE = { status: 'INDETERMINATE' } as const;
const CANDIDATE_KEYS = ['hypothesisId', 'statement', 'type', 'domain', 'scope', 'supportingEvidenceIds', 'contradictingEvidenceIds', 'assumptions', 'disconfirmingConditions'] as const;

/**
 * Deterministically recovers a completed CANDIDATE_PROVIDER effect's durable
 * result against the durable authorized Intent of the same execution. It never
 * calls the provider, never re-runs validation against current Hypotheses or
 * Evidence, and never assigns new IDs: anything it cannot recognise exactly is
 * INDETERMINATE - a legacy pre-0033 null result included, because its real
 * provider outcome is unknowable.
 */
export function recoverCandidateProviderResult(
  effect: DurableGenerationEffectRow,
  intent: AuthorizedHypothesisGenerationIntent,
): CandidateProviderRecovery {
  if (effect.result_reference !== null) return INDETERMINATE;
  if (effect.result_code === 'NO_ACCEPTED_CANDIDATES') {
    return effect.result_payload === null || effect.result_payload === undefined
      ? { status: 'NO_ACCEPTED_CANDIDATES' }
      : INDETERMINATE;
  }
  if (effect.result_code !== 'VALIDATED_CANDIDATES') return INDETERMINATE;
  const candidates = canonicalCandidates(effect.result_payload, intent);
  return candidates ? { status: 'VALIDATED_CANDIDATES', candidates } : INDETERMINATE;
}

/**
 * Deterministically recovers a completed HYPOTHESIS_PERSISTENCE effect's
 * durable result. The recovered ID list is the durable Candidate plan's exact
 * ID order or nothing: a legacy null result, a malformed payload, or any
 * Candidate/Persistence mismatch is INDETERMINATE. IDs are never inferred from
 * later Hypothesis rows.
 */
export function recoverHypothesisPersistenceResult(
  effect: DurableGenerationEffectRow,
  candidate: Exclude<CandidateProviderRecovery, { status: 'INDETERMINATE' }>,
): HypothesisPersistenceRecovery {
  if (effect.result_reference !== null) return INDETERMINATE;
  if (effect.result_code === 'NO_HYPOTHESES_PERSISTED') {
    if (effect.result_payload !== null && effect.result_payload !== undefined) return INDETERMINATE;
    return candidate.status === 'NO_ACCEPTED_CANDIDATES'
      ? { status: 'NO_HYPOTHESES_PERSISTED', hypothesisIds: [] }
      : INDETERMINATE;
  }
  if (effect.result_code !== 'HYPOTHESES_PERSISTED') return INDETERMINATE;
  if (candidate.status !== 'VALIDATED_CANDIDATES') return INDETERMINATE;
  const ids = effect.result_payload;
  if (!Array.isArray(ids) || ids.length !== candidate.candidates.length) return INDETERMINATE;
  if (ids.some((id, index) => typeof id !== 'string' || id !== candidate.candidates[index].hypothesisId)) return INDETERMINATE;
  return { status: 'HYPOTHESES_PERSISTED', hypothesisIds: [...(ids as string[])] };
}

function canonicalCandidates(
  value: unknown,
  intent: AuthorizedHypothesisGenerationIntent,
): DurableGenerationCandidate[] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_GENERATED_HYPOTHESIS_CANDIDATES) return undefined;
  const allowedEvidence = new Set(intent.evidenceIds);
  const ids = new Set<string>();
  const collisionKeys = new Set<string>();
  const recovered: DurableGenerationCandidate[] = [];
  for (const entry of value) {
    if (!exactKeys(entry, CANDIDATE_KEYS)) return undefined;
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.hypothesisId !== 'string' || !UUID.test(candidate.hypothesisId)) return undefined;
    const idKey = candidate.hypothesisId.toLowerCase();
    if (ids.has(idKey)) return undefined;
    ids.add(idKey);
    if (!validText(candidate.statement, MAX_STATEMENT_LENGTH)) return undefined;
    if (typeof candidate.type !== 'string' || !(HYPOTHESIS_TYPES as readonly string[]).includes(candidate.type)) return undefined;
    if (typeof candidate.domain !== 'string' || !(HYPOTHESIS_DOMAINS as readonly string[]).includes(candidate.domain)) return undefined;
    if (!validText(candidate.scope, MAX_SCOPE_LENGTH)) return undefined;
    // Durable Intent provenance: the plan must still belong to the exact
    // authorized generation it was validated for.
    if (candidate.domain !== intent.domain || candidate.scope !== intent.scope.serialized) return undefined;
    const supporting = canonicalEvidenceList(candidate.supportingEvidenceIds, allowedEvidence);
    const contradicting = canonicalEvidenceList(candidate.contradictingEvidenceIds, allowedEvidence);
    if (!supporting || !contradicting) return undefined;
    if (supporting.some((id) => contradicting.includes(id))) return undefined;
    const assumptions = canonicalTextList(candidate.assumptions, MAX_ASSUMPTIONS);
    const disconfirmingConditions = canonicalTextList(candidate.disconfirmingConditions, MAX_DISCONFIRMING_CONDITIONS);
    if (!assumptions || !disconfirmingConditions) return undefined;
    const collisionKey = hypothesisCollisionKey(candidate.statement as string, candidate.scope as string);
    if (collisionKeys.has(collisionKey)) return undefined;
    collisionKeys.add(collisionKey);
    recovered.push({
      hypothesisId: candidate.hypothesisId,
      statement: candidate.statement as string,
      type: candidate.type as HypothesisType,
      domain: candidate.domain as HypothesisDomain,
      scope: candidate.scope as string,
      supportingEvidenceIds: supporting,
      contradictingEvidenceIds: contradicting,
      assumptions,
      disconfirmingConditions,
    });
  }
  return recovered;
}

function canonicalEvidenceList(value: unknown, allowed: ReadonlySet<string>): string[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_GENERATION_EVIDENCE_ITEMS) return undefined;
  if (value.some((id) => typeof id !== 'string' || !EVIDENCE_ID.test(id) || !allowed.has(id))) return undefined;
  if (new Set(value).size !== value.length) return undefined;
  return [...(value as string[])];
}

function canonicalTextList(value: unknown, max: number): string[] | undefined {
  if (!Array.isArray(value) || value.length > max) return undefined;
  if (value.some((item) => !validText(item, MAX_STRUCTURED_TEXT_LENGTH))) return undefined;
  if (new Set(value).size !== value.length) return undefined;
  return [...(value as string[])];
}

function validText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

function exactKeys(value: unknown, expected: readonly string[]): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === expected.length && expected.every((key) => key in value);
}
