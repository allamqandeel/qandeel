import type { HypothesisCandidateGenerator, HypothesisCandidateProposal } from './hypothesis-generation.types';

export const HYPOTHESIS_CANDIDATE_GENERATOR = Symbol('HYPOTHESIS_CANDIDATE_GENERATOR');
export const HYPOTHESIS_CANDIDATE_GENERATION_SCHEMA_VERSION = 1 as const;

export type HypothesisCandidateGeneratorErrorCode =
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'INVALID_STRUCTURED_OUTPUT'
  | 'PROVIDER_ERROR';

export class HypothesisCandidateGeneratorError extends Error {
  constructor(readonly code: HypothesisCandidateGeneratorErrorCode) {
    super('Hypothesis candidate generation provider failed.');
    this.name = 'HypothesisCandidateGeneratorError';
  }
}

export type BoundHypothesisCandidateGenerator = HypothesisCandidateGenerator;
export type HypothesisCandidateGeneratorOutput = ReadonlyArray<HypothesisCandidateProposal>;
