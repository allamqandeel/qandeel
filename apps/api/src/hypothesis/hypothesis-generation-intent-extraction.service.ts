import { Inject, Injectable } from '@nestjs/common';
import { HYPOTHESIS_DOMAINS } from './hypothesis.types';
import { HypothesisGenerationIntentAuthorityService } from './hypothesis-generation-intent-authority.service';
import { INTENT_PROBLEM_SOURCE, INTENT_SCOPE_KIND, MAX_INTENT_EVIDENCE_IDS } from './hypothesis-generation-intent-authority.types';
import type {
  HypothesisGenerationIntentExtractionInput,
  HypothesisGenerationIntentExtractionResult,
} from './hypothesis-generation-intent-extraction.types';
import {
  HYPOTHESIS_INTENT_EXTRACTION_PROVIDER,
  HYPOTHESIS_INTENT_EXTRACTION_SCHEMA_VERSION,
  MAX_EXTRACTION_EVIDENCE_TEXT_CHARS,
  MAX_EXTRACTION_EVIDENCE_UNIVERSE,
  MAX_EXTRACTION_TOTAL_EVIDENCE_TEXT_CHARS,
  HypothesisIntentExtractionProviderError,
  type HypothesisIntentExtractionProvider,
} from './hypothesis-intent-extraction-provider.types';

@Injectable()
export class HypothesisGenerationIntentExtractionService {
  constructor(
    @Inject(HYPOTHESIS_INTENT_EXTRACTION_PROVIDER)
    private readonly provider: HypothesisIntentExtractionProvider,
    private readonly authority: HypothesisGenerationIntentAuthorityService,
  ) {}

  async extract(
    input: HypothesisGenerationIntentExtractionInput,
  ): Promise<HypothesisGenerationIntentExtractionResult> {
    const providerEvidence = this.projectProviderEvidence(input.eligibleEvidence);
    try {
      const output = await this.provider.extract({
        currentUserText: input.currentTurn.text,
        triggerReason: input.triggerReason,
        allowedDomains: HYPOTHESIS_DOMAINS,
        eligibleEvidence: providerEvidence,
        maxSelectedEvidence: MAX_INTENT_EVIDENCE_IDS,
        schemaVersion: HYPOTHESIS_INTENT_EXTRACTION_SCHEMA_VERSION,
      });
      const authority = this.authority.authorize({
        eligibility: input.eligibility,
        currentTurn: input.currentTurn,
        eligibleEvidenceUniverse: input.eligibleEvidence,
        candidate: {
          problem: {
            text: output.problemText,
            source: INTENT_PROBLEM_SOURCE,
            sourceTurnId: input.currentTurn.id,
          },
          domain: output.domain,
          scope: { kind: INTENT_SCOPE_KIND, sessionId: input.currentTurn.sessionId },
          evidenceIds: output.selectedEvidenceIds,
        },
      });
      return authority.status === 'AUTHORIZED'
        ? authority
        : { status: 'NOT_AUTHORIZED', reason: 'AUTHORITY_REJECTED', authorityReason: authority.reason };
    } catch (error) {
      if (!(error instanceof HypothesisIntentExtractionProviderError)) {
        return { status: 'NOT_AUTHORIZED', reason: 'PROVIDER_FAILED' };
      }
      if (error.code === 'UNAVAILABLE') return { status: 'NOT_AUTHORIZED', reason: 'PROVIDER_UNAVAILABLE' };
      if (error.code === 'TIMEOUT') return { status: 'NOT_AUTHORIZED', reason: 'PROVIDER_TIMEOUT' };
      if (error.code === 'INVALID_STRUCTURED_OUTPUT') {
        return { status: 'NOT_AUTHORIZED', reason: 'INVALID_PROVIDER_OUTPUT' };
      }
      return { status: 'NOT_AUTHORIZED', reason: 'PROVIDER_FAILED' };
    }
  }

  private projectProviderEvidence(input: HypothesisGenerationIntentExtractionInput['eligibleEvidence']) {
    let totalCharacters = 0;
    return input.slice(0, MAX_EXTRACTION_EVIDENCE_UNIVERSE).flatMap((item) => {
      const remaining = MAX_EXTRACTION_TOTAL_EVIDENCE_TEXT_CHARS - totalCharacters;
      if (remaining <= 0) return [];
      const statement = [...item.statement]
        .slice(0, Math.min(MAX_EXTRACTION_EVIDENCE_TEXT_CHARS, remaining))
        .join('');
      if (statement.length === 0) return [];
      totalCharacters += [...statement].length;
      return [{ evidenceId: item.evidenceId, evidenceKind: item.evidenceKind, statement }];
    });
  }
}
