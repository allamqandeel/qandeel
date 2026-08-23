import { Injectable } from '@nestjs/common';
import { MAX_GENERATION_EVIDENCE_ITEMS } from './hypothesis-generation.types';
import type { AuthorizedHypothesisGenerationIntent } from './hypothesis-generation-intent-authority.types';
import { INTENT_PROBLEM_SOURCE, INTENT_SCOPE_KIND, MAX_INTENT_EVIDENCE_IDS } from './hypothesis-generation-intent-authority.types';
import type { HypothesisGenerationRequestAssemblyResult } from './hypothesis-generation-request-assembler.types';
import { HYPOTHESIS_DOMAINS, MAX_SCOPE_LENGTH, MAX_STATEMENT_LENGTH } from './hypothesis.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVIDENCE_ID = /^memory:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class HypothesisGenerationRequestAssemblerService {
  assemble(intent: AuthorizedHypothesisGenerationIntent): HypothesisGenerationRequestAssemblyResult {
    if (!this.exactKeys(intent, ['problem', 'domain', 'scope', 'evidenceIds']) ||
      !this.exactKeys(intent?.problem, ['text', 'source', 'sourceTurnId']) ||
      !this.exactKeys(intent?.scope, ['kind', 'sessionId', 'serialized'])) {
      return { status: 'NOT_READY', reason: 'INVALID_AUTHORIZED_INTENT' };
    }
    if (typeof intent.problem.text !== 'string' || intent.problem.text.length === 0 ||
      [...intent.problem.text].length > MAX_STATEMENT_LENGTH ||
      typeof intent.scope.serialized !== 'string' || [...intent.scope.serialized].length > MAX_SCOPE_LENGTH ||
      !Array.isArray(intent.evidenceIds) || intent.evidenceIds.length < 1 ||
      intent.evidenceIds.length > Math.min(MAX_INTENT_EVIDENCE_IDS, MAX_GENERATION_EVIDENCE_ITEMS)) {
      return { status: 'NOT_READY', reason: 'BOUND_VIOLATION' };
    }
    if (intent.scope.kind !== INTENT_SCOPE_KIND || !UUID.test(intent.scope.sessionId) ||
      intent.scope.serialized !== `${INTENT_SCOPE_KIND}:${intent.scope.sessionId}`) {
      return { status: 'NOT_READY', reason: 'SCOPE_SERIALIZATION_FAILED' };
    }
    if (intent.problem.source !== INTENT_PROBLEM_SOURCE || !UUID.test(intent.problem.sourceTurnId) ||
      !HYPOTHESIS_DOMAINS.includes(intent.domain) ||
      intent.evidenceIds.some((id) => typeof id !== 'string' || !EVIDENCE_ID.test(id)) ||
      new Set(intent.evidenceIds).size !== intent.evidenceIds.length) {
      return { status: 'NOT_READY', reason: 'INVARIANT_REJECTED' };
    }
    return {
      status: 'READY',
      request: {
        problem: intent.problem.text,
        domain: intent.domain,
        scope: intent.scope.serialized,
        evidenceIds: [...intent.evidenceIds],
      },
    };
  }

  private exactKeys(value: unknown, expected: readonly string[]): boolean {
    return !!value && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).length === expected.length && expected.every((key) => key in value);
  }
}
