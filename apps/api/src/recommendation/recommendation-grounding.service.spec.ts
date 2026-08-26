import { CONFIDENCE_POLICY_VERSION, type ConfidenceMissingInformationCode } from '../hypothesis/confidence.types';
import type { HypothesisReasoningContext, HypothesisReasoningContextResult, HypothesisReasoningItem } from '../hypothesis/hypothesis-reasoning-context.types';
import { RecommendationGroundingService } from './recommendation-grounding.service';
import { RecommendationGroundingInvariantError } from './recommendation-grounding.types';

const evaluated = (codes: ConfidenceMissingInformationCode[] = []): HypothesisReasoningItem['confidence'] => ({
  state: 'EXACT_CURRENT_VERSION_EVALUATED', targetVersion: 2, numericScore: null, confidenceBand: null,
  calibrationState: 'UNCALIBRATED', stability: 'UNASSESSED', missingInformationCodes: codes,
  policyVersion: CONFIDENCE_POLICY_VERSION,
});
const item = (overrides: Partial<HypothesisReasoningItem> = {}): HypothesisReasoningItem => ({
  statement: 'the user avoids deciding under time pressure', type: 'CAUSAL', domain: 'GENERAL',
  scope: 'current conversation', origin: 'USER_PROPOSED', status: 'ACTIVE', hypothesisVersion: 2,
  currentlyEligibleSupportingEvidenceCount: 3, currentlyEligibleContradictingEvidenceCount: 0,
  assumptions: [], disconfirmingConditions: ['a contrary observation'],
  confidence: { state: 'NOT_EVALUATED_FOR_CURRENT_VERSION', targetVersion: 2 }, ...overrides,
});
const available = (hypotheses: HypothesisReasoningItem[], overrides: Partial<HypothesisReasoningContext> = {}): HypothesisReasoningContextResult => ({
  coverageState: 'AVAILABLE', context: {
    contractVersion: 1, source: 'QANDEEL_HYPOTHESIS_REASONING_CONTEXT', coverageState: 'AVAILABLE',
    candidateHypothesisCount: hypotheses.length, includedHypothesisCount: hypotheses.length,
    truncated: false, hypotheses, ...overrides,
  },
});

describe('RecommendationGroundingService', () => {
  const service = new RecommendationGroundingService();

  describe('EMPTY', () => {
    it('maps the exact EMPTY source to EMPTY grounding without fabricating context or defaults', () => {
      const result = service.ground({ coverageState: 'EMPTY', candidateHypothesisCount: 0 });
      expect(result).toEqual({ coverageState: 'EMPTY', reason: 'NO_ACTIVE_HYPOTHESES' });
      expect(result).not.toHaveProperty('context');
      expect(JSON.stringify(result)).not.toMatch(/score|rank|readiness|utility|risk|AVAILABLE/u);
    });
    it('fails closed when EMPTY carries a nonzero candidate count', () => {
      expect(() => service.ground({ coverageState: 'EMPTY', candidateHypothesisCount: 3 } as never)).toThrow(RecommendationGroundingInvariantError);
    });
  });

  describe('confidence coverage', () => {
    it('derives NONE when zero included Hypotheses have exact-current evaluations', () => {
      const result = service.ground(available([item(), item()]));
      if (result.coverageState !== 'AVAILABLE') throw new Error();
      expect(result.context.currentVersionConfidenceCoverage).toBe('NONE');
    });
    it('derives PARTIAL when some but not all included Hypotheses are exactly evaluated', () => {
      const result = service.ground(available([item({ confidence: evaluated() }), item()]));
      if (result.coverageState !== 'AVAILABLE') throw new Error();
      expect(result.context.currentVersionConfidenceCoverage).toBe('PARTIAL');
    });
    it('derives FULL without exposing a score, band, or any HIGH/ready label', () => {
      const result = service.ground(available([item({ confidence: evaluated() }), item({ confidence: evaluated() })]));
      if (result.coverageState !== 'AVAILABLE') throw new Error();
      expect(result.context.currentVersionConfidenceCoverage).toBe('FULL');
      const serialized = JSON.stringify(result.context);
      expect(serialized).not.toMatch(/numericScore|confidenceBand|HIGH|LOW|MEDIUM|readiness|ready|probability/u);
    });
  });

  describe('actionable missing information', () => {
    it('exports only the three actionable codes, excluding the calibration-only code', () => {
      const result = service.ground(available([item({ confidence: evaluated(['CONFIDENCE_MODEL_UNCALIBRATED', 'UNVERIFIED_ASSUMPTIONS']) })]));
      if (result.coverageState !== 'AVAILABLE') throw new Error();
      expect(result.context.actionableMissingInformationCodes).toEqual(['UNVERIFIED_ASSUMPTIONS']);
    });
    it('returns the canonical fixed order regardless of source encounter order and collapses duplicates', () => {
      const result = service.ground(available([
        item({ confidence: evaluated(['COMPETING_HYPOTHESES_UNASSESSED', 'UNVERIFIED_ASSUMPTIONS']) }),
        item({ confidence: evaluated(['UNVERIFIED_ASSUMPTIONS', 'NO_ELIGIBLE_EVIDENCE']) }),
      ]));
      if (result.coverageState !== 'AVAILABLE') throw new Error();
      expect(result.context.actionableMissingInformationCodes).toEqual(['NO_ELIGIBLE_EVIDENCE', 'UNVERIFIED_ASSUMPTIONS', 'COMPETING_HYPOTHESES_UNASSESSED']);
    });
    it('yields zero actionable codes for calibration-only evaluations', () => {
      const result = service.ground(available([item({ confidence: evaluated(['CONFIDENCE_MODEL_UNCALIBRATED']) })]));
      if (result.coverageState !== 'AVAILABLE') throw new Error();
      expect(result.context.actionableMissingInformationCodes).toEqual([]);
    });
    it('fails closed on an unknown future missing-information code instead of ignoring it', () => {
      expect(() => service.ground(available([item({ confidence: evaluated(['FUTURE_CODE' as never]) })]))).toThrow(RecommendationGroundingInvariantError);
    });
  });

  describe('assumptions, contradiction, and truncation', () => {
    it('exposes assumption presence as a boolean only and never copies assumption text', () => {
      const result = service.ground(available([item({ assumptions: ['a private unverified assumption'] })]));
      if (result.coverageState !== 'AVAILABLE') throw new Error();
      expect(result.context.unverifiedAssumptionsPresent).toBe(true);
      expect(JSON.stringify(result.context)).not.toContain('assumption');
    });
    it('reports no unverified assumptions when every included item has none', () => {
      const result = service.ground(available([item()]));
      if (result.coverageState !== 'AVAILABLE') throw new Error();
      expect(result.context.unverifiedAssumptionsPresent).toBe(false);
    });
    it('exposes contradicting Evidence presence as a boolean without counts or IDs', () => {
      const grounded = service.ground(available([item({ currentlyEligibleContradictingEvidenceCount: 2 })]));
      if (grounded.coverageState !== 'AVAILABLE') throw new Error();
      expect(grounded.context.contradictingEvidencePresent).toBe(true);
      expect(JSON.stringify(grounded.context)).not.toMatch(/Count|memory:|evidenceId/u);
      const none = service.ground(available([item()]));
      if (none.coverageState !== 'AVAILABLE') throw new Error();
      expect(none.context.contradictingEvidencePresent).toBe(false);
    });
    it('mirrors source truncation exactly without converting it to a score', () => {
      const truncated = service.ground(available([item()], { candidateHypothesisCount: 5, truncated: true }));
      if (truncated.coverageState !== 'AVAILABLE') throw new Error();
      expect(truncated.context.sourceTruncated).toBe(true);
      expect(typeof truncated.context.sourceTruncated).toBe('boolean');
    });
    it('leaks no statement, scope, ID, version, or numeric source detail into the minimized context', () => {
      const result = service.ground(available([item({ statement: 'sensitive user statement', scope: 'sensitive scope' })]));
      if (result.coverageState !== 'AVAILABLE') throw new Error();
      expect(Object.keys(result.context).sort()).toEqual([
        'actionableMissingInformationCodes', 'contractVersion', 'contradictingEvidencePresent',
        'currentVersionConfidenceCoverage', 'source', 'sourceContractVersion', 'sourceTruncated',
        'unverifiedAssumptionsPresent',
      ]);
      expect(JSON.stringify(result.context)).not.toMatch(/sensitive|statement|scope|hypothesisVersion|targetVersion|user|session|turn/u);
    });
  });

  describe('fail-closed invariants', () => {
    it.each([
      ['contract version', { contractVersion: 2 }],
      ['source identity', { source: 'OTHER_SOURCE' }],
      ['coverage state', { coverageState: 'PARTIAL' }],
      ['included count mismatch', { includedHypothesisCount: 3 }],
      ['candidate below included', { candidateHypothesisCount: 0 }],
      ['inconsistent truncation flag', { truncated: true }],
      ['non-boolean truncation', { truncated: 'yes' }],
    ])('rejects a malformed source %s', (_name, overrides) => {
      expect(() => service.ground(available([item()], overrides as never))).toThrow(RecommendationGroundingInvariantError);
    });
    it('rejects an empty included array and an over-bound included array', () => {
      expect(() => service.ground(available([], { candidateHypothesisCount: 1, truncated: true }))).toThrow(RecommendationGroundingInvariantError);
      expect(() => service.ground(available(Array.from({ length: 9 }, () => item())))).toThrow(RecommendationGroundingInvariantError);
    });
    it.each([
      ['evaluated target-version mismatch', { confidence: { ...evaluated(), targetVersion: 1 } }],
      ['not-evaluated target-version mismatch', { confidence: { state: 'NOT_EVALUATED_FOR_CURRENT_VERSION', targetVersion: 1 } }],
      ['non-null score', { confidence: { ...evaluated(), numericScore: 0.8 } }],
      ['non-null band', { confidence: { ...evaluated(), confidenceBand: 'HIGH' } }],
      ['wrong calibration', { confidence: { ...evaluated(), calibrationState: 'CALIBRATED' } }],
      ['wrong stability', { confidence: { ...evaluated(), stability: 'STABLE' } }],
      ['wrong policy', { confidence: { ...evaluated(), policyVersion: 'other-policy' } }],
      ['unsupported confidence state', { confidence: { state: 'LEGACY_EVALUATED', targetVersion: 2 } }],
      ['negative contradicting count', { currentlyEligibleContradictingEvidenceCount: -1 }],
      ['non-array assumptions', { assumptions: 'not-a-list' }],
    ])('rejects a malformed item: %s', (_name, overrides) => {
      expect(() => service.ground(available([item(overrides as never)]))).toThrow(RecommendationGroundingInvariantError);
    });
    it('throws a bounded error that contains no raw user content', () => {
      try {
        service.ground(available([item({ statement: 'private user text', confidence: { ...evaluated(), numericScore: 0.5 } as never })]));
        throw new Error('expected rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(RecommendationGroundingInvariantError);
        expect((error as Error).message).toBe('RECOMMENDATION_GROUNDING_INVARIANT');
        expect(JSON.stringify({ message: (error as Error).message, stack: undefined })).not.toContain('private user text');
      }
    });
  });
});
