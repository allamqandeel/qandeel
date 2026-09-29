import type { HypothesisDomain, HypothesisStatus } from '../hypothesis/hypothesis.types';

/**
 * W3-MEGA-U (E2E-D-14) — the user-facing «فهم قنديل» / QANDEEL Understanding projection.
 *
 * This is a Product view model, not the Hypothesis Runtime object. It carries only what P1 §11 lets the reader see:
 * a theme, the current summary, a qualitative confidence state in words, and — in the detail — the reader's own
 * supporting and contradicting context, alternatives, unresolved points and evolution. It never carries a database
 * identifier, lifecycle status, version counter, scope, Evidence identifier, Evidence count, Memory extraction
 * confidence, importance, a score, a band, a policy or reason code, provenance, or any reasoning text.
 */

/** The four P1 §11.3 concepts; the words are the P4-C4 / P4-C3R approved `confClear` … `confMore` copy. No fifth state. */
export const UNDERSTANDING_CONFIDENCE_STATES = ['CLEAR', 'TAKING_SHAPE', 'MIXED', 'NEEDS_MORE'] as const;
export type UnderstandingConfidenceState = (typeof UNDERSTANDING_CONFIDENCE_STATES)[number];

/**
 * The human-readable title family. It is derived deterministically from the canonical Hypothesis domain, which the
 * P1 §11.1 scope already names (the user, relationships, goals, major decisions, recurring patterns). It is a label on
 * an item that exists, never an empty taxonomy tab.
 */
export const UNDERSTANDING_THEMES = ['YOU', 'RELATIONSHIPS', 'WORK', 'DECISIONS', 'GOALS', 'HOW_WE_TALK'] as const;
export type UnderstandingTheme = (typeof UNDERSTANDING_THEMES)[number];

export const THEME_BY_DOMAIN: Readonly<Record<HypothesisDomain, UnderstandingTheme>> = {
  GENERAL: 'YOU',
  RELATIONSHIP: 'RELATIONSHIPS',
  WORK: 'WORK',
  DECISION: 'DECISIONS',
  GOAL: 'GOALS',
  INTERACTION: 'HOW_WE_TALK',
};

/**
 * Which lifecycle states are a *current* understanding the reader can see. CANDIDATE is a transient pre-admission
 * state (0036 activates every generated Hypothesis inside the same transaction), REOPENED is a rejected / retired
 * interpretation being reconsidered, and REJECTED / RETIRED are withdrawn. None of them is shown as current.
 */
export const UNDERSTANDING_SURFACE_STATUSES: ReadonlyArray<HypothesisStatus> = ['ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK'];

export const UNDERSTANDING_LIST_DEFAULT_LIMIT = 32;
export const UNDERSTANDING_LIST_MAX_LIMIT = 32;
export const MAX_DETAIL_CONTEXT_ITEMS = 8;
export const MAX_DETAIL_ALTERNATIVES = 4;
export const MAX_DETAIL_EVOLUTION = 16;

/** How an understanding changed, in the P1 §11.5 vocabulary. Rendered as words by the client. */
export const UNDERSTANDING_EVOLUTION_KINDS = [
  'FIRST_SEEN', 'SUPPORT_ADDED', 'CHALLENGE_ADDED', 'STRENGTHENED', 'WEAKENED', 'BECAME_MIXED', 'WITHDRAWN', 'RECONSIDERED',
] as const;
export type UnderstandingEvolutionKind = (typeof UNDERSTANDING_EVOLUTION_KINDS)[number];

export interface UnderstandingItemSummary {
  /** Opaque, stable per item and reader; not reversible to any identifier. */
  readonly ref: string;
  /** Opaque token for the exact interpretation the reader is looking at. */
  readonly revision: string;
  readonly theme: UnderstandingTheme;
  readonly summary: string;
  readonly confidence: UnderstandingConfidenceState;
}

export interface UnderstandingEvolutionEntry {
  readonly kind: UnderstandingEvolutionKind;
  readonly at: string;
}

export interface UnderstandingItemDetail extends UnderstandingItemSummary {
  /** The reader's own supporting context (P1 §11.2 "supporting context / evidence"). */
  readonly evidence: readonly string[];
  /** The reader's own contradictory context. */
  readonly contradictions: readonly string[];
  readonly alternatives: readonly string[];
  readonly unresolved: readonly string[];
  /** Newest first. */
  readonly evolution: readonly UnderstandingEvolutionEntry[];
}

export interface UnderstandingListView {
  readonly items: readonly UnderstandingItemSummary[];
}

export class UnderstandingProjectionInvariantError extends Error {
  constructor() { super('UNDERSTANDING_PROJECTION_INVARIANT'); this.name = 'UnderstandingProjectionInvariantError'; }
}
