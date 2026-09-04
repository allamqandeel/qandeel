// T-03B1a - the focus-resolution provider boundary.
//
// Stage 1.2 defines reference resolution, attribution and conversational
// function semantically, and Stage 1.3 defines independent attention as
// genuine conversational evidence rather than lexical presence. A
// deterministic rule set would have nothing but surface cues to read, and
// lexical repetition is explicitly NOT identity (CU-11) and NOT focus
// (THR-01). The evaluator is therefore hybrid, exactly like T-03A1's: a
// provider PROPOSES a strictly structured resolution, deterministic code
// validates every element of it against the allowlists and the current CU,
// and T-03B1b later writes.
//
// The provider request is the one-CU input and NOTHING later: no later CU of
// the same batch, no later SP, no future assistant material, no analysis, no
// Map state. That boundary is what makes the no-hindsight rule (§16) true by
// construction rather than by instruction.

import type {
  AttentionKind,
  AttentionReason,
  ClaimFrame,
  ClaimantKind,
  ConversationalFunction,
  CurrentCuInput,
  ExtractiveAnchor,
  FocusCandidate,
  PriorCuContext,
  ReferenceHandleCandidate,
  ReferenceResolutionState,
  SequencePosition,
} from './conversational-focus.types';

export const FOCUS_RESOLUTION_SCHEMA_VERSION = 1 as const;

/** Exactly the one-CU evaluation input, minus identities the provider has no use for. */
export interface FocusResolutionRequest {
  readonly schemaVersion: typeof FOCUS_RESOLUTION_SCHEMA_VERSION;
  readonly currentCu: CurrentCuInput;
  readonly priorCus: readonly PriorCuContext[];
  readonly referenceHandles: readonly ReferenceHandleCandidate[];
  readonly focusCandidates: readonly FocusCandidate[];
  readonly currentFocusCandidateId: string | null;
}

export interface ReferenceResolutionProposal {
  readonly anchor: ExtractiveAnchor;
  readonly state: ReferenceResolutionState;
  readonly resolvedHandleId: string | null;
  readonly candidateHandleIds: readonly string[];
  readonly newReference: boolean;
}

export interface ClaimantProposal {
  readonly kind: ClaimantKind;
  readonly handleId: string | null;
  readonly referenceIndex: number | null;
}

export interface ClaimAttributionProposal {
  readonly anchor: ExtractiveAnchor;
  readonly claimant: ClaimantProposal;
  readonly frame: ClaimFrame;
}

export interface AttentionProposal {
  readonly kind: AttentionKind;
  readonly existingFocusCandidateId: string | null;
  readonly groundingAnchor: ExtractiveAnchor | null;
  readonly reason: AttentionReason;
}

/** The strict structured proposal (§9). No score, no Thread, no LF, no speaker. */
export interface FocusResolutionProposal {
  readonly functions: readonly ConversationalFunction[];
  readonly sequencePosition: SequencePosition;
  readonly targetCuId: string | null;
  readonly references: readonly ReferenceResolutionProposal[];
  readonly claimAttributions: readonly ClaimAttributionProposal[];
  readonly attention: AttentionProposal;
}

export interface FocusResolutionProvider {
  propose(request: FocusResolutionRequest): Promise<FocusResolutionProposal>;
}

export type FocusResolutionProviderErrorCode = 'UNAVAILABLE' | 'TIMEOUT' | 'INVALID_STRUCTURED_OUTPUT' | 'PROVIDER_ERROR';

export class FocusResolutionProviderError extends Error {
  constructor(readonly code: FocusResolutionProviderErrorCode) {
    super('Focus resolution provider failed.');
    this.name = 'FocusResolutionProviderError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
