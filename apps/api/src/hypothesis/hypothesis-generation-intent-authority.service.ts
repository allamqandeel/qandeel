import { Injectable } from '@nestjs/common';
import { MAX_ELIGIBLE_EVIDENCE } from '../memory/evidence.service';
import { HYPOTHESIS_DOMAINS, MAX_STATEMENT_LENGTH } from './hypothesis.types';
import {
  INTENT_PROBLEM_SOURCE,
  INTENT_SCOPE_KIND,
  MAX_INTENT_EVIDENCE_IDS,
  type HypothesisGenerationIntentAuthorityInput,
  type HypothesisGenerationIntentAuthorityResult,
  type HypothesisGenerationIntentRejectionReason,
} from './hypothesis-generation-intent-authority.types';
import { MAX_HYPOTHESIS_TRIGGER_INPUT_CHARS } from './hypothesis-generation-trigger-classification.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVIDENCE_ID = /^memory:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const MAX_RAW_PROBLEM_CODE_UNITS = MAX_STATEMENT_LENGTH * 2;
const MAX_RAW_TURN_CODE_UNITS = MAX_HYPOTHESIS_TRIGGER_INPUT_CHARS * 2;
const GENERIC_PROBLEMS = new Set(['unknown', 'general', 'unspecified', 'n/a', 'غير محدد', 'عام']);

@Injectable()
export class HypothesisGenerationIntentAuthorityService {
  authorize(input: HypothesisGenerationIntentAuthorityInput): HypothesisGenerationIntentAuthorityResult {
    if (!this.validEnvelope(input)) return rejected('INVALID_CANDIDATE');
    const { candidate, currentTurn, eligibleEvidenceUniverse } = input;

    if (!this.exactKeys(candidate, ['problem', 'domain', 'scope', 'evidenceIds']) ||
      !this.exactKeys(candidate.problem, ['text', 'source', 'sourceTurnId']) ||
      !this.exactKeys(candidate.scope, ['kind', 'sessionId'])) return rejected('INVALID_CANDIDATE');

    if (candidate.problem.source !== INTENT_PROBLEM_SOURCE ||
      candidate.problem.sourceTurnId !== currentTurn.id) return rejected('TURN_PROVENANCE_MISMATCH');
    if (candidate.scope.kind !== INTENT_SCOPE_KIND) return rejected('INVALID_SCOPE_AUTHORITY');
    if (candidate.scope.sessionId !== currentTurn.sessionId) return rejected('SESSION_PROVENANCE_MISMATCH');

    const problem = this.canonicalProblem(candidate.problem.text, currentTurn.text);
    if (problem.reason) return rejected(problem.reason);
    if (!HYPOTHESIS_DOMAINS.includes(candidate.domain)) return rejected('INVALID_DOMAIN');

    if (!Array.isArray(candidate.evidenceIds)) return rejected('INVALID_CANDIDATE');
    if (candidate.evidenceIds.length === 0) return rejected('NO_SELECTED_EVIDENCE');
    if (candidate.evidenceIds.length > MAX_INTENT_EVIDENCE_IDS) return rejected('TOO_MANY_SELECTED_EVIDENCE');
    if (new Set(candidate.evidenceIds).size !== candidate.evidenceIds.length) return rejected('DUPLICATE_EVIDENCE');

    const universeIds = this.canonicalUniverseIds(eligibleEvidenceUniverse);
    if (!universeIds) return rejected('EVIDENCE_UNIVERSE_INVALID');
    const selected = new Set(candidate.evidenceIds);
    if ([...selected].some((id) => !universeIds.includes(id))) return rejected('EVIDENCE_OUT_OF_UNIVERSE');

    return {
      status: 'AUTHORIZED',
      intent: {
        problem: { text: problem.text!, source: INTENT_PROBLEM_SOURCE, sourceTurnId: currentTurn.id },
        domain: candidate.domain,
        scope: {
          kind: INTENT_SCOPE_KIND,
          sessionId: currentTurn.sessionId,
          serialized: `${INTENT_SCOPE_KIND}:${currentTurn.sessionId}`,
        },
        evidenceIds: universeIds.filter((id) => selected.has(id)),
      },
    };
  }

  private validEnvelope(input: HypothesisGenerationIntentAuthorityInput): boolean {
    return !!input && this.exactKeys(input, ['eligibility', 'currentTurn', 'eligibleEvidenceUniverse', 'candidate']) &&
      input.eligibility?.status === 'ELIGIBLE' &&
      input.eligibility?.reason === 'TRIGGER_AND_EVIDENCE_AVAILABLE' &&
      this.exactKeys(input.currentTurn, ['id', 'sessionId', 'role', 'status', 'text']) &&
      input.currentTurn.role === 'USER' && input.currentTurn.status === 'COMPLETED' &&
      UUID.test(input.currentTurn.id) && UUID.test(input.currentTurn.sessionId) &&
      typeof input.currentTurn.text === 'string' && input.currentTurn.text.length <= MAX_RAW_TURN_CODE_UNITS &&
      Array.isArray(input.eligibleEvidenceUniverse) && !!input.candidate;
  }

  private canonicalProblem(value: unknown, turnText: string): {
    text?: string;
    reason?: HypothesisGenerationIntentRejectionReason;
  } {
    if (typeof value !== 'string' || value.length === 0) return { reason: 'INVALID_CANDIDATE' };
    if (value.length > MAX_RAW_PROBLEM_CODE_UNITS) return { reason: 'INPUT_BOUND_EXCEEDED' };
    const text = normalize(value);
    const turn = normalize(turnText);
    if ([...text].length > MAX_STATEMENT_LENGTH || [...turn].length > MAX_HYPOTHESIS_TRIGGER_INPUT_CHARS) {
      return { reason: 'INPUT_BOUND_EXCEEDED' };
    }
    if (text.length === 0 || GENERIC_PROBLEMS.has(text.toLocaleLowerCase('und'))) {
      return { reason: 'INVALID_CANDIDATE' };
    }
    return turn.includes(text) ? { text } : { reason: 'PROBLEM_NOT_GROUNDED' };
  }

  private canonicalUniverseIds(value: ReadonlyArray<unknown>): string[] | undefined {
    if (value.length > MAX_ELIGIBLE_EVIDENCE) return undefined;
    const ids: string[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') return undefined;
      const record = item as Record<string, unknown>;
      const match = typeof record.evidenceId === 'string' ? EVIDENCE_ID.exec(record.evidenceId) : null;
      if (!match || record.originatingMemoryId !== match[1]) return undefined;
      ids.push(record.evidenceId as string);
    }
    return new Set(ids).size === ids.length ? ids : undefined;
  }

  private exactKeys(value: unknown, expected: readonly string[]): boolean {
    return !!value && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).length === expected.length && expected.every((key) => key in value);
  }
}

function normalize(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

function rejected(reason: HypothesisGenerationIntentRejectionReason): HypothesisGenerationIntentAuthorityResult {
  return { status: 'NOT_AUTHORIZED', reason };
}
