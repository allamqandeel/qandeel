// QIR-002 — the ONE server-owned FAST/DEEP route-pair contract.
//
// Before QIR-002 the legal path/reason pairs were hard-coded independently in
// three places (the orchestrator, the persisted CHECK constraint, and the
// runtime-event validator), so a routing change had to be made three times and
// could silently drift. This module is the single TypeScript owner of the pair
// vocabulary; migration 0062 owns the database half of the same contract and
// must be changed in the same reviewed change.
//
// AUTHORITY BOUNDARY. A route pair is EXECUTION/ROUTING metadata only. It is
// never diagnosis, Safety, Question, Hypothesis, Confidence, Recommendation,
// Human Intelligence, or product/provider authority, and nothing downstream may
// derive semantic meaning from it. Reasons are explanatory, not truth claims.
//
// PROVIDER NEUTRALITY. This module names no vendor, model, tokenizer, or
// provider adapter, imports nothing from the model router, and performs no I/O.
// `RuntimeRoutingPath` is deliberately declared here rather than imported from
// `model-router.types` so the routing boundary carries no edge into the model
// router at all; it is structurally identical to `ProcessingPath`.

/** The canonical execution paths. Structurally identical to `ProcessingPath`. */
export type RuntimeRoutingPath = 'FAST' | 'DEEP';

/** The Runtime Decision Policy version this contract describes. */
export const RUNTIME_ROUTING_POLICY_VERSION = 2 as const;

/** `complexityScore` is bounded: 3 input-scale + 2 question + 2 breadth points. */
export const RUNTIME_ROUTING_MIN_COMPLEXITY_SCORE = 0;
export const RUNTIME_ROUTING_MAX_COMPLEXITY_SCORE = 7;

/**
 * The exact five v2 reasons. NEW canonical claims may use ONLY these.
 */
export const RUNTIME_ROUTING_V2_REASONS = Object.freeze([
  'RUNTIME_ROUTING_V2_FAST_DEFAULT',
  'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE',
  'RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION',
  'RUNTIME_ROUTING_V2_DEEP_MULTI_PART',
  'RUNTIME_ROUTING_V2_DEEP_COMPOSITE',
] as const);
export type RuntimeRoutingV2Reason = (typeof RUNTIME_ROUTING_V2_REASONS)[number];

/**
 * The two pre-QIR-002 reasons. These are READ/EVENT compatibility only:
 * historical canonical turns and historical pending/durable runtime events keep
 * carrying them and must stay valid and recoverable forever. No NEW claim may
 * ever use one again — the database claim authority in migration 0062 rejects
 * them, and `isLegalCurrentRoutePair` refuses them here.
 */
export const LEGACY_ROUTING_REASONS = Object.freeze([
  'FAST_DEFAULT',
  'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT',
] as const);
export type LegacyRoutingReason = (typeof LEGACY_ROUTING_REASONS)[number];

/** The exact path each reason may be paired with. Cross-pairs are illegal. */
const CURRENT_PAIRS: ReadonlyMap<string, RuntimeRoutingPath> = new Map<string, RuntimeRoutingPath>([
  ['RUNTIME_ROUTING_V2_FAST_DEFAULT', 'FAST'],
  ['RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE', 'DEEP'],
  ['RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION', 'DEEP'],
  ['RUNTIME_ROUTING_V2_DEEP_MULTI_PART', 'DEEP'],
  ['RUNTIME_ROUTING_V2_DEEP_COMPOSITE', 'DEEP'],
]);
const LEGACY_PAIRS: ReadonlyMap<string, RuntimeRoutingPath> = new Map<string, RuntimeRoutingPath>([
  ['FAST_DEFAULT', 'FAST'],
  ['INPUT_LENGTH_REQUIRES_DEEP_CONTEXT', 'DEEP'],
]);

/** The deterministic structural signals the v2 policy reads. Never semantic. */
export interface RuntimeRoutingSignals {
  /** Unicode CODE POINTS of the normalized turn, never UTF-16 code units. */
  readonly codePointCount: number;
  /** Count of `?` and Arabic `؟` only. Not a question-intent classifier. */
  readonly questionCount: number;
  /** Structural breadth only, never linguistic understanding. */
  readonly logicalUnitCount: number;
}

/** The complete, explainable routing decision for one turn. */
export interface RuntimeRoutingDecision {
  readonly policyVersion: typeof RUNTIME_ROUTING_POLICY_VERSION;
  readonly path: RuntimeRoutingPath;
  readonly reason: RuntimeRoutingV2Reason;
  /** Bounded 0..7. */
  readonly complexityScore: number;
  readonly signals: RuntimeRoutingSignals;
}

/** The route pair carried across the canonical claim boundary. */
export interface RuntimeRoutePair {
  readonly path: RuntimeRoutingPath;
  readonly reason: RuntimeRoutingV2Reason;
}

export function isRuntimeRoutingV2Reason(value: unknown): value is RuntimeRoutingV2Reason {
  return typeof value === 'string' && CURRENT_PAIRS.has(value);
}

export function isLegacyRoutingReason(value: unknown): value is LegacyRoutingReason {
  return typeof value === 'string' && LEGACY_PAIRS.has(value);
}

/**
 * CURRENT authority: exactly the five legal v2 pairs. A legacy reason, an
 * unknown reason, a cross pair, a path-only state, and a reason-only state are
 * all illegal. This is the gate every NEW canonical claim passes.
 */
export function isLegalCurrentRoutePair(path: unknown, reason: unknown): boolean {
  return typeof reason === 'string' && CURRENT_PAIRS.get(reason) === path;
}

/**
 * DURABLE authority: everything a persisted turn or an already-emitted runtime
 * event may legitimately carry — the pre-routing null/null state, both
 * historical legacy pairs, and all five v2 pairs. Unknown reasons, cross pairs,
 * and half-null states stay illegal.
 *
 * This is strictly wider than `isLegalCurrentRoutePair` on purpose: historical
 * rows and historical events must stay readable and recoverable, while nothing
 * new may be produced with a legacy reason.
 */
export function isLegalDurableRoutePair(path: unknown, reason: unknown): boolean {
  if (path === null && reason === null) return true;
  if (typeof reason !== 'string') return false;
  return (CURRENT_PAIRS.get(reason) ?? LEGACY_PAIRS.get(reason)) === path;
}
