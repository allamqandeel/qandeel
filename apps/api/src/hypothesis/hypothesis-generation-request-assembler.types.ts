import type { HypothesisGenerationInput } from './hypothesis-generation.types';

export type HypothesisGenerationRequestAssemblyResult =
  | { status: 'READY'; request: HypothesisGenerationInput }
  | {
      status: 'NOT_READY';
      reason:
        | 'INVALID_AUTHORIZED_INTENT'
        | 'SCOPE_SERIALIZATION_FAILED'
        | 'BOUND_VIOLATION'
        | 'INVARIANT_REJECTED';
    };
