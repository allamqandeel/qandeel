import { HYPOTHESIS_DOMAINS, MAX_SCOPE_LENGTH, MAX_STATEMENT_LENGTH } from '../hypothesis/hypothesis.types';
import {
  INTENT_PROBLEM_SOURCE,
  INTENT_SCOPE_KIND,
  MAX_INTENT_EVIDENCE_IDS,
  type AuthorizedHypothesisGenerationIntent,
} from '../hypothesis/hypothesis-generation-intent-authority.types';
import type { IntelligenceEffectState, IntelligenceExecution, IntentProviderRecovery } from './post-response-intelligence.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVIDENCE_ID = /^memory:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INDETERMINATE = { status: 'INDETERMINATE' } as const;

/**
 * Recovery boundary for a COMPLETED INTENT_PROVIDER effect. The ledger payload is
 * arbitrary JSON as far as this process is concerned, so it is re-validated here
 * against the same canonical contract the authority produced and the durable
 * provenance of the execution being replayed.
 *
 * It never calls the provider, never re-runs the authority pipeline, and never
 * infers an intent from the current turn, Hypotheses or Memory: anything it
 * cannot recognise exactly is INDETERMINATE, never NOT_AUTHORIZED.
 */
export function recoverDurableIntentProviderResult(
  effect: Pick<IntelligenceEffectState, 'result_code' | 'result_reference' | 'result_payload'>,
  execution: Pick<IntelligenceExecution, 'session_id' | 'source_turn_id'>,
): IntentProviderRecovery {
  if (effect.result_reference !== null) return INDETERMINATE;
  // A legacy pre-0029 completion has no durable result at all. Its real provider
  // outcome is unknowable, so it is quarantined rather than assumed.
  if (effect.result_code === null) return INDETERMINATE;
  if (effect.result_code === 'INTENT_NOT_AUTHORIZED') {
    return effect.result_payload === null || effect.result_payload === undefined
      ? { status: 'NOT_AUTHORIZED' }
      : INDETERMINATE;
  }
  if (effect.result_code !== 'INTENT_AUTHORIZED') return INDETERMINATE;
  const intent = canonicalIntent(effect.result_payload, execution);
  return intent ? { status: 'AUTHORIZED', intent } : INDETERMINATE;
}

function canonicalIntent(
  value: unknown,
  execution: Pick<IntelligenceExecution, 'session_id' | 'source_turn_id'>,
): AuthorizedHypothesisGenerationIntent | undefined {
  if (!exactKeys(value, ['problem', 'domain', 'scope', 'evidenceIds'])) return undefined;
  const payload = value as Record<string, unknown>;
  if (!exactKeys(payload.problem, ['text', 'source', 'sourceTurnId']) ||
    !exactKeys(payload.scope, ['kind', 'sessionId', 'serialized'])) return undefined;
  const problem = payload.problem as Record<string, unknown>;
  const scope = payload.scope as Record<string, unknown>;

  if (typeof problem.text !== 'string' || problem.text.trim().length === 0 ||
    [...problem.text].length > MAX_STATEMENT_LENGTH) return undefined;
  if (problem.source !== INTENT_PROBLEM_SOURCE) return undefined;
  if (typeof problem.sourceTurnId !== 'string' || !UUID.test(problem.sourceTurnId)) return undefined;
  if (typeof payload.domain !== 'string' ||
    !(HYPOTHESIS_DOMAINS as readonly string[]).includes(payload.domain)) return undefined;
  if (scope.kind !== INTENT_SCOPE_KIND) return undefined;
  if (typeof scope.sessionId !== 'string' || !UUID.test(scope.sessionId)) return undefined;
  if (typeof scope.serialized !== 'string' ||
    scope.serialized !== `${INTENT_SCOPE_KIND}:${scope.sessionId}` ||
    [...scope.serialized].length > MAX_SCOPE_LENGTH) return undefined;
  if (!Array.isArray(payload.evidenceIds) || payload.evidenceIds.length < 1 ||
    payload.evidenceIds.length > MAX_INTENT_EVIDENCE_IDS) return undefined;
  if (payload.evidenceIds.some((id) => typeof id !== 'string' || !EVIDENCE_ID.test(id))) return undefined;
  if (new Set(payload.evidenceIds).size !== payload.evidenceIds.length) return undefined;

  // Durable provenance must still belong to the execution being replayed, so a
  // result recorded for another turn or session can never be recovered here.
  if (problem.sourceTurnId.toLowerCase() !== execution.source_turn_id.toLowerCase()) return undefined;
  if (scope.sessionId.toLowerCase() !== execution.session_id.toLowerCase()) return undefined;

  return {
    problem: { text: problem.text, source: INTENT_PROBLEM_SOURCE, sourceTurnId: problem.sourceTurnId },
    domain: payload.domain as AuthorizedHypothesisGenerationIntent['domain'],
    scope: { kind: INTENT_SCOPE_KIND, sessionId: scope.sessionId, serialized: scope.serialized },
    evidenceIds: [...(payload.evidenceIds as string[])],
  };
}

function exactKeys(value: unknown, expected: readonly string[]): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === expected.length && expected.every((key) => key in value);
}
