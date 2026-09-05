// T-03B3 - the Thread Continuity provider boundary.
//
// Whether a current Session Emerging Focus refers to the SAME canonical
// conversational locus as an existing user/world Thread is a conversational
// judgment over committed wording. Deterministic code alone would have only
// surface cues to read, and surface similarity is explicitly NOT identity
// (B3-02). The evaluator is therefore hybrid, exactly like T-03B1a / T-03B2a:
// a provider PROPOSES two strictly structured, deliberately small answers -
// which supplied Threads are plausibly the same (screening) and one closed
// final decision over the nominated set (resolution) - and deterministic code
// validates every element against the supplied dossiers and the canonical B1
// bundle before anything is prepared.
//
// INPUT FIREWALL (task section 20). The provider may receive only: the
// current CU, its canonical B1 bundle, the current Session focus grounding,
// and candidate Thread identity dossiers. It never receives a Home coordinate,
// world geography, a relation graph, Readings / Hypotheses, confidence,
// importance, ranking, LF, Map state, viewport or any later material.
//
// OUTPUT SCHEMA. Screening: `possibleSameThreadIds` only. Resolution:
// decision, threadId | null, candidateThreadIds[],
// currentEvidenceReferenceIndexes[], priorEvidenceRefs[]. No score, no
// confidence, no rationale, no minted id.

import type { CurrentCuInput } from '../conversational-focus/conversational-focus.types';
import type { CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';
import type {
  CurrentFocusGrounding,
  PriorIdentityEvidenceRef,
  ThreadContinuityDecision,
  ThreadIdentityDossier,
} from './thread-continuity.types';

export const THREAD_CONTINUITY_SCHEMA_VERSION = 1 as const;

/** Exactly the screening input: the current CU material plus ONE fixed-size chunk of dossiers. */
export interface ThreadContinuityScreeningRequest {
  readonly schemaVersion: typeof THREAD_CONTINUITY_SCHEMA_VERSION;
  readonly currentCu: CurrentCuInput;
  readonly currentFocusSemantics: CanonicalCuFocusSemanticPayload;
  readonly currentFocusGrounding: CurrentFocusGrounding;
  readonly candidates: readonly ThreadIdentityDossier[];
}

/** Strict screening output: a subset of the supplied chunk, nothing graded. */
export interface ThreadContinuityScreeningProposal {
  readonly possibleSameThreadIds: readonly string[];
}

/** Exactly the resolution input: the current CU material plus the union of every nominated dossier. */
export interface ThreadContinuityResolutionRequest {
  readonly schemaVersion: typeof THREAD_CONTINUITY_SCHEMA_VERSION;
  readonly currentCu: CurrentCuInput;
  readonly currentFocusSemantics: CanonicalCuFocusSemanticPayload;
  readonly currentFocusGrounding: CurrentFocusGrounding;
  readonly candidates: readonly ThreadIdentityDossier[];
}

/** The strict closed final proposal. */
export interface ThreadContinuityResolutionProposal {
  readonly decision: ThreadContinuityDecision;
  readonly threadId: string | null;
  readonly candidateThreadIds: readonly string[];
  readonly currentEvidenceReferenceIndexes: readonly number[];
  readonly priorEvidenceRefs: readonly PriorIdentityEvidenceRef[];
}

export interface ThreadContinuityProvider {
  screen(request: ThreadContinuityScreeningRequest): Promise<ThreadContinuityScreeningProposal>;
  resolve(request: ThreadContinuityResolutionRequest): Promise<ThreadContinuityResolutionProposal>;
}

export type ThreadContinuityProviderErrorCode = 'UNAVAILABLE' | 'TIMEOUT' | 'INVALID_STRUCTURED_OUTPUT' | 'PROVIDER_ERROR';

export class ThreadContinuityProviderError extends Error {
  constructor(readonly code: ThreadContinuityProviderErrorCode) {
    super('Thread continuity provider failed.');
    this.name = 'ThreadContinuityProviderError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
