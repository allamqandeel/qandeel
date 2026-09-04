// T-03B2a - the Thread-establishment provider boundary.
//
// Whether committed conversation now satisfies TE-01 / TE-02 / TE-03 is a
// conversational judgment over committed wording and its canonical B1
// semantics. Deterministic code alone would have nothing but surface cues to
// read, and surface frequency is explicitly NOT establishment (THR-22). The
// evaluator is therefore hybrid, exactly like T-03B1a's: a provider PROPOSES a
// strictly structured, deliberately small decision, deterministic code validates
// every element of it against the frozen evidence paths, and T-03B2b later
// canonicalizes and writes.
//
// The provider request is the one-CU input and NOTHING later or wider: no later
// CU, no Thread id, no Home / spatial data, no analytical objects, no counts,
// no confidence, no similarity, no wall-clock, no SP, no LF, no Map state. The
// Product judgment stays conversational and evidence-path based by construction.

import type { CurrentCuInput, ExtractiveAnchor, PriorCuContext } from '../conversational-focus/conversational-focus.types';
import type { CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';
import type { FocusAttentionHistoryEntry, ThreadEstablishmentDecision, ThreadEstablishmentPath } from './thread-establishment.types';

export const THREAD_ESTABLISHMENT_SCHEMA_VERSION = 1 as const;

/** Exactly the one-CU evaluation input the provider may see (task §7). `establishedFocusIds` is NOT exposed. */
export interface ThreadEstablishmentRequest {
  readonly schemaVersion: typeof THREAD_ESTABLISHMENT_SCHEMA_VERSION;
  readonly currentCu: CurrentCuInput;
  readonly currentFocusSemantics: CanonicalCuFocusSemanticPayload;
  readonly priorCus: readonly PriorCuContext[];
  readonly focusAttentionHistory: readonly FocusAttentionHistoryEntry[];
}

/**
 * The strict structured proposal (task §8). Deliberately small: a decision, the
 * frozen path it rests on, the committed CUs cited as evidence, and - for TE-01
 * only - the exact extractive wording of the user's selection. No rationale, no
 * score, no Thread id, no Home, no offsets.
 */
export interface ThreadEstablishmentProposal {
  readonly decision: ThreadEstablishmentDecision;
  readonly path: ThreadEstablishmentPath | null;
  readonly evidenceCuIds: readonly string[];
  readonly explicitSelectionAnchor: ExtractiveAnchor | null;
}

export interface ThreadEstablishmentProvider {
  propose(request: ThreadEstablishmentRequest): Promise<ThreadEstablishmentProposal>;
}

export type ThreadEstablishmentProviderErrorCode = 'UNAVAILABLE' | 'TIMEOUT' | 'INVALID_STRUCTURED_OUTPUT' | 'PROVIDER_ERROR';

export class ThreadEstablishmentProviderError extends Error {
  constructor(readonly code: ThreadEstablishmentProviderErrorCode) {
    super('Thread establishment provider failed.');
    this.name = 'ThreadEstablishmentProviderError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
