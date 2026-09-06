// T-03C R2 - the canonical Reading subject-grounding contract (server side).
//
// Stage 1.9 freezes Reading <-> Hypothesis as PARTIAL. The Hypothesis keeps
// its analytical identity, statement, type / domain / scope / origin,
// lifecycle and version, Evidence semantics, assumptions / disconfirming
// conditions, Confidence integration and update loop untouched; subject
// grounding is ADDITIONAL canonical truth - "this analytical object is
// substantively about this canonical conversational focus, on inspectable
// committed conversational grounding" - and is never Evidence participation
// (which bears on the claim) and never the Thread contextual appearance
// (A-1, which the database DERIVES from the grounding and the frozen
// focus -> Thread truth of 0068 / 0070).
//
// The grounding target is the frozen B1 stable focus identity
// (`emerging_focus_id`), the same handle Thread establishment and
// cross-Session continuity resolve. The server builds the bounded universe of
// groundable focuses from committed truth (migration 0072,
// `build_hypothesis_subject_grounding_universe_v1`) and hands the provider an
// OPAQUE per-execution handle for each; the provider may only return a subset
// of those handles; the server authorizes the proposal against the exact
// stored universe (here, deterministically) and the database judges it again
// before it becomes canonical. No label, string similarity, embedding,
// Evidence overlap, peer relation, current Live Focus, geometry or
// caller-supplied identity ever grounds a Reading.

/** The bounded universe: at most the 32 most recently attended committed focuses of the Session. */
export const MAX_SUBJECT_GROUNDING_CANDIDATES = 32;
/** One candidate may be grounded to at most eight focuses. */
export const MAX_SUBJECT_GROUNDINGS_PER_CANDIDATE = 8;
/** A server-issued handle is an RFC 4122 version-5 identity (`uuidV5(handle namespace, execution:focus)`); it names no focus, Thread or Session. */
export const SUBJECT_GROUNDING_HANDLE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
/** The longest committed reference wording a universe entry may present (the canonical anchor text bound of 0066 is far below this). */
export const MAX_SUBJECT_TEXT_LENGTH = 2000;

/** One legitimately groundable focus, as the provider sees it: an opaque handle plus the exact committed wording that first grounded the focus and its Session Positions. */
export interface AuthorizedSubjectGroundingCandidate {
  readonly handle: string;
  readonly subjectText: string;
  readonly startedSp: number;
  readonly lastAttentionSp: number | null;
}

/** The server-built, durably stored universe of ONE durable generation (`frontierSp` = the immutable causal semantic frontier of the execution's own source finalized exchange; null = that exchange committed no Moment of its own, therefore empty). */
export interface AuthorizedSubjectGroundingUniverse {
  readonly executionId: string;
  readonly frontierSp: number | null;
  readonly entries: readonly AuthorizedSubjectGroundingCandidate[];
}

/**
 * T-03C R3 - the stable technical condition the server answers with while the
 * execution's source finalized exchange has NOT completed its FINAL semantic
 * establishment (B1 + B2 + B3 + effective Live Focus). It has no causal
 * frontier yet, so there is nothing to cut a universe at. It is NOT an empty
 * universe and NOT a database failure: nothing is stored, no Candidate
 * provider budget slot is spent, no provider is called, and the execution
 * retries through the existing bounded delivery/recovery semantics.
 */
export const SOURCE_SEMANTIC_FRONTIER_NOT_ESTABLISHED = 'SOURCE_SEMANTIC_FRONTIER_NOT_ESTABLISHED';

/** What the server answers when a generation asks for its grounding universe: the durable universe, or the not-yet-established causal frontier. */
export type SubjectGroundingUniverseResolution =
  | { readonly status: 'ESTABLISHED'; readonly universe: AuthorizedSubjectGroundingUniverse }
  | { readonly status: typeof SOURCE_SEMANTIC_FRONTIER_NOT_ESTABLISHED };

/** The durable, server-authorized grounding selection of ONE accepted candidate: exactly the handles it is grounded to (possibly none). */
export interface DurableSubjectGroundingSelection {
  readonly hypothesisId: string;
  readonly handles: readonly string[];
}

export const SUBJECT_GROUNDING_REJECTION_REASONS = [
  'SUBJECT_GROUNDING_MALFORMED',
  'SUBJECT_GROUNDING_OUTSIDE_UNIVERSE',
  'SUBJECT_GROUNDING_DUPLICATE',
  'SUBJECT_GROUNDING_LIMIT_EXCEEDED',
] as const;
export type SubjectGroundingRejectionReason = (typeof SUBJECT_GROUNDING_REJECTION_REASONS)[number];
