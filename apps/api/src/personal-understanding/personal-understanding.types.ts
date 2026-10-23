// S8A-03 CP2 — Personal Understanding capture: the provider port and the verified command (migration 0171).
//
// The provider PROPOSES; it never decides. A fact proposal names a verbatim span of the user's current message and how
// the model read it (whose fact, stated or not, affirmed or negated, when). The server's deterministic verifier
// (`personal-understanding-capture.verifier.ts`) accepts a proposal only when the words themselves agree, and the
// database command then applies every 0152 rule of the background writer. Semantic keys only make a Memory findable;
// they are never shown as a fact and never decide anything.
import type { MemoryType } from '../memory/memory.types';

export const PERSONAL_UNDERSTANDING_CAPTURE_PROVIDER = Symbol('PERSONAL_UNDERSTANDING_CAPTURE_PROVIDER');
/** S8A-03 Living Personal Memory: 2 adds the current items and the REAFFIRMED / ENDED context answer. */
export const PERSONAL_UNDERSTANDING_CAPTURE_SCHEMA_VERSION = 2 as const;

/** The slots the same-slot UNSETTLED rule reads (Founder CP2 condition 3, CP2 R1). Optional: most Memories have none. */
export const UNDERSTANDING_SLOTS = ['RESIDENCE', 'OCCUPATION', 'EMPLOYER', 'STUDY', 'MARITAL_STATUS', 'SMOKING'] as const;
export type UnderstandingSlot = typeof UNDERSTANDING_SLOTS[number];
export const UNDERSTANDING_TEMPORALS = ['CURRENT', 'PAST', 'PLANNED', 'TEMPORARY'] as const;
export type UnderstandingTemporal = typeof UNDERSTANDING_TEMPORALS[number];
/** The Memory types a natural capture may keep (never an Interaction Preference, never a Derived Insight). */
export const UNDERSTANDING_FACT_TYPES = ['PERSONAL_FACT', 'STABLE_PREFERENCE', 'GOAL', 'DECISION_COMMITMENT', 'RELATIONSHIP_CONTEXT', 'TEMPORARY_STATE'] as const;
export type UnderstandingFactType = typeof UNDERSTANDING_FACT_TYPES[number] & MemoryType;
export const UNDERSTANDING_SUBJECTS = ['SELF', 'OTHER', 'UNCLEAR'] as const;
export const UNDERSTANDING_POLARITIES = ['AFFIRMED', 'NEGATED'] as const;
export const UNDERSTANDING_MODALITIES = ['STATED', 'QUESTION', 'HYPOTHETICAL', 'QUOTED', 'WISH'] as const;
/** S8A-03 Living Personal Memory: what the current message says about one supplied current item. */
export const UNDERSTANDING_CONTEXT_STATUSES = ['REAFFIRMED', 'ENDED'] as const;
export type UnderstandingContextStatus = typeof UNDERSTANDING_CONTEXT_STATUSES[number];

/** At most three new Memories per turn (0171), four backfilled Memories, sixteen keys per proposal. */
export const MAX_UNDERSTANDING_FACTS = 3;
export const MAX_UNDERSTANDING_BACKFILL = 4;
export const MAX_UNDERSTANDING_KEYS = 16;
export const MAX_UNDERSTANDING_KEY_LENGTH = 48;
/** The longest message sent for capture; a longer one is not captured (backfill still runs). */
export const MAX_UNDERSTANDING_MESSAGE_CHARS = 1_500;
export const MAX_UNDERSTANDING_SPAN_CHARS = 280;
/** S8A-03 Living Personal Memory: at most ten current items are sent, and at most ten restated / ended per turn (0172). */
export const MAX_UNDERSTANDING_CURRENT_ITEMS = 10;

export interface UnderstandingFactProposal {
  readonly span: string;
  readonly subject: typeof UNDERSTANDING_SUBJECTS[number];
  readonly polarity: typeof UNDERSTANDING_POLARITIES[number];
  readonly modality: typeof UNDERSTANDING_MODALITIES[number];
  readonly temporal: UnderstandingTemporal;
  readonly type: UnderstandingFactType;
  readonly slot: UnderstandingSlot | null;
  readonly keys: readonly string[];
}

export interface UnderstandingMemoryProposal {
  readonly handle: string;
  readonly slot: UnderstandingSlot | null;
  readonly temporal: UnderstandingTemporal;
  readonly keys: readonly string[];
}

/** S8A-03 Living Personal Memory: the model's reading of one supplied current item in the current message. */
export interface UnderstandingContextProposal {
  readonly handle: string;
  readonly status: UnderstandingContextStatus;
  readonly span: string;
}

/**
 * What the provider sees: the current message (or null when only backfill runs), opaque Memory handles for backfill,
 * and (with a message only) the user's current items under opaque handles c1-c10.
 */
export interface PersonalUnderstandingCaptureRequest {
  readonly schemaVersion: typeof PERSONAL_UNDERSTANDING_CAPTURE_SCHEMA_VERSION;
  readonly currentUserText: string | null;
  readonly memories: ReadonlyArray<{ readonly handle: string; readonly type: MemoryType; readonly content: string }>;
  readonly current: ReadonlyArray<{ readonly handle: string; readonly type: MemoryType; readonly content: string }>;
}

/** The parsed provider answer. Structure only: nothing in it is verified yet. */
export interface PersonalUnderstandingCaptureOutput {
  readonly facts: readonly UnderstandingFactProposal[];
  readonly memories: readonly UnderstandingMemoryProposal[];
  readonly context: readonly UnderstandingContextProposal[];
}

export type PersonalUnderstandingCaptureErrorCode = 'TIMEOUT' | 'UNAVAILABLE' | 'PROVIDER_ERROR' | 'INVALID_STRUCTURED_OUTPUT';
export class PersonalUnderstandingCaptureProviderError extends Error {
  constructor(readonly code: PersonalUnderstandingCaptureErrorCode) {
    super(code);
    this.name = 'PersonalUnderstandingCaptureProviderError';
  }
}

export interface PersonalUnderstandingCaptureProvider {
  capture(request: PersonalUnderstandingCaptureRequest): Promise<PersonalUnderstandingCaptureOutput>;
}

/** One verified new Memory: the user's own words, a canonical type, and its index. */
export interface VerifiedUnderstandingItem {
  readonly memoryId: string;
  readonly type: UnderstandingFactType;
  readonly content: string;
  readonly importance: number;
  readonly expiresAt: string | null;
  readonly slot: UnderstandingSlot | null;
  readonly temporal: UnderstandingTemporal;
  /** SELF: the user's own fact. OTHER: a statement of who one of the user's family is (0172), never the user's fact. */
  readonly subject: 'SELF' | 'OTHER';
  readonly terms: readonly string[];
}

/** One verified backfill index row for an existing Memory. */
export interface VerifiedUnderstandingIndex {
  readonly memoryId: string;
  readonly slot: UnderstandingSlot | null;
  readonly temporal: UnderstandingTemporal;
  readonly terms: readonly string[];
}

/** The input of the ONE atomic database command (0172 complete_post_response_personal_capture_v2). */
export interface PersonalUnderstandingCaptureCommand {
  readonly items: readonly VerifiedUnderstandingItem[];
  readonly index: readonly VerifiedUnderstandingIndex[];
  /** S8A-03 Living Personal Memory: existing SELF Memories the user verifiably restated / explicitly ended (0172). */
  readonly reaffirmed: readonly string[];
  readonly ended: readonly string[];
}

/** Why a fact proposal was not kept. Content-free: safe for counters and tests, never carries the words. */
export type UnderstandingRejection =
  | 'MALFORMED' | 'NOT_SELF' | 'NOT_A_STATEMENT' | 'NOT_VERBATIM' | 'TOO_SHORT_OR_LONG' | 'SENSITIVE_DATA'
  | 'QUESTION' | 'HYPOTHETICAL' | 'QUOTED_OR_REPORTED' | 'SPECULATIVE' | 'NEGATION_MISMATCH' | 'THIRD_PARTY'
  | 'NO_FIRST_PERSON' | 'TEMPORAL_MISMATCH' | 'TRANSIENT_EMOTION' | 'DUPLICATE' | 'REVERSAL_NEEDS_CORRECTION'
  | 'NOT_ABOUT_ITEM' | 'NOT_AN_ENDING';
