// T-03B1b1 - the canonical durable focus-semantic payload boundary.
//
// T-03B1a produces PREPARED results that carry transient, batch-local
// `prepared:` identities. Migration 0066's integrated per-Moment writer accepts
// NONE of them: it takes a canonical semantic payload whose every identity is
// a stable RFC 4122 version-5 UUID derived server-side by the canonicalizer.
// One canonical semantic object corresponds exactly to one proposed committed
// CU `unit_id`.
//
// These types describe exactly what crosses the database boundary; the
// database revalidates every element independently (frozen enums and
// cardinalities, exact code-point anchor spans, same-Session handles and
// focuses, prior targets, first grounding by the current CU). Nothing here is
// a Nest provider and nothing here is wired into a runtime path: T-03B1b2
// owns activation.

import type {
  AttentionKind,
  AttentionReason,
  ClaimFrame,
  ConversationalFunction,
  ReferenceResolutionState,
  SequencePosition,
} from './conversational-focus.types';

/** The three DURABLE claimant kinds. `NEW_CURRENT_CU_REFERENCE` is prepared-only and never crosses this boundary. */
export const DURABLE_CLAIMANT_KINDS = Object.freeze(['CURRENT_CONVERSATIONAL_SPEAKER', 'REFERENCE_HANDLE', 'UNRESOLVED'] as const);
export type DurableClaimantKind = (typeof DURABLE_CLAIMANT_KINDS)[number];

export interface CanonicalReferenceResolution {
  readonly reference_index: number;
  readonly anchor_text: string;
  readonly anchor_occurrence: number;
  readonly span_start: number;
  readonly span_end: number;
  readonly state: ReferenceResolutionState;
  /** A stable handle UUID when RESOLVED; null otherwise. */
  readonly resolved_handle_id: string | null;
  /** True when this CU is the FIRST grounding of `resolved_handle_id` (the handle is created here). */
  readonly creates_handle: boolean;
  /** At least two distinct stable handle UUIDs when AMBIGUOUS; empty otherwise. */
  readonly candidate_handle_ids: readonly string[];
}

export interface CanonicalClaimAttribution {
  readonly attribution_index: number;
  readonly anchor_text: string;
  readonly anchor_occurrence: number;
  readonly span_start: number;
  readonly span_end: number;
  readonly claimant_kind: DurableClaimantKind;
  /** A stable handle UUID when the claimant is REFERENCE_HANDLE; null otherwise. */
  readonly claimant_handle_id: string | null;
  readonly claim_frame: ClaimFrame;
}

export interface CanonicalAttention {
  readonly kind: AttentionKind;
  readonly reason: AttentionReason;
  /** A stable emerging_focus_id for START_NEW_FOCUS / ATTEND_EXISTING_FOCUS; null for NO_INDEPENDENT_FOCUS. */
  readonly emerging_focus_id: string | null;
  /** True only for START_NEW_FOCUS: the focus identity is created by this CU. */
  readonly creates_focus: boolean;
  /** The same-CU RESOLVED reference that grounds the focus; required for START, optional for ATTEND. */
  readonly grounding_reference_index: number | null;
}

/** One canonical semantic bundle for one proposed committed CU. */
export interface CanonicalCuFocusSemanticPayload {
  readonly unit_id: string;
  readonly functions: readonly ConversationalFunction[];
  readonly sequence_position: SequencePosition;
  readonly target_cu_id: string | null;
  readonly references: readonly CanonicalReferenceResolution[];
  readonly claim_attributions: readonly CanonicalClaimAttribution[];
  readonly attention: CanonicalAttention;
}

/** The technical provenance the writer records on the semantic batch. */
export interface CanonicalFocusBatchProvenance {
  readonly focusEvaluatorVersion: string;
  readonly focusPolicyVersion: string;
  readonly focusProvider: string;
  readonly focusModel: string;
  readonly focusPromptVersion: string;
  readonly focusSchemaVersion: number;
}

/** A canonicalized ordered sequence: the exact input of one integrated writer call per source turn. */
export interface CanonicalFocusSequence {
  readonly units: readonly CanonicalCuFocusSemanticPayload[];
  /** prepared reference id -> stable handle UUID, for every handle this sequence creates. */
  readonly referenceHandleIds: ReadonlyMap<string, string>;
  /** prepared focus id -> stable emerging_focus_id, for every focus this sequence creates. */
  readonly emergingFocusIds: ReadonlyMap<string, string>;
}

export type FocusCanonicalizationFailure =
  | 'INVALID_CANONICAL_UNIT_ID'
  | 'UNKNOWN_PREPARED_REFERENCE'
  | 'UNKNOWN_PREPARED_FOCUS'
  | 'INVALID_DURABLE_IDENTITY'
  | 'INVALID_CLAIMANT_POINTER'
  | 'FOCUS_GROUNDING_REQUIRED'
  | 'PREPARED_IDENTITY_LEAKED';

export class FocusCanonicalizationError extends Error {
  constructor(
    readonly reason: FocusCanonicalizationFailure,
    readonly cuId: string | null = null,
  ) {
    super(`Durable focus canonicalization failed: ${reason}.`);
    this.name = 'FocusCanonicalizationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
