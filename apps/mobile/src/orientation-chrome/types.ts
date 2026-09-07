/**
 * T-08 — the read-only orientation vocabulary.
 *
 * Five orientation dimensions, kept structurally apart because they are five different questions
 * and collapsing any two of them would make a false answer expressible:
 *
 *   temporal    where the reader stands in conversational time;
 *   spatial     which viewpoint and which disclosure rung the camera is on;
 *   inspection  what was requested, and what this disclosure may legitimately render of it;
 *   live        that Live exists and has moved on — generically, and never where it went;
 *   returns     which of the six frozen return acts is meaningful right now.
 *
 * Nothing in this file computes. It is the shape the model may answer in, and the shape is itself a
 * firewall: the branches that may not name an identity have no field to name one with, so a leak
 * would have to be a type error rather than a mistake in prose.
 *
 * ## The one rule behind the inspection union
 *
 * An identity may be named only where the disclosure says `knowledge != UNKNOWN_AT_TC`. A reader who
 * asked to inspect something may always be shown what they asked for once `K(TC)` confirms it is
 * part of the world at this position — but at a position where the identity is NOT part of `K(TC)`,
 * naming it would confirm a future object exists, which is exactly the historical firewall's job to
 * prevent. So `IDENTITY_UNKNOWN_AT_TC` carries no family, no id, no version, no lineage and no
 * shape: there is nothing on it to render, and nothing target-shaped to leave a hole for.
 *
 * ## Technical states are not semantic ones
 *
 * `PROJECTION_NOT_FETCHED`, `PROJECTION_UNAVAILABLE`, `PROJECTION_STALE`, `INSPECTION_NOT_RESOLVED`
 * and `RESOLUTION_MALFORMED` are five facts about the CLIENT and the transport. None of them is
 * `IDENTITY_UNKNOWN_AT_TC`, none is `DEPTH_WITHHELD`, and none may be presented as an absence in the
 * world. They stay five separate members so no code path can widen one into another.
 */
import type { SemanticDepth, SessionPosition } from '../state';
import type { MapProjectionStaleReason } from '../map';
import type { HistoricalFamily, HistoricalProjectionUnavailableCode } from '../projection';

// ------------------------------------------------------------------------------------------
// Temporal
// ------------------------------------------------------------------------------------------

/**
 * Entailed by Class A alone. `PINNED` at the Live Head is NOT `FOLLOW_LIVE`: the modes differ, and
 * only one of them advances when Live does. There is no third mode here and nowhere to put one.
 */
export interface TemporalChrome {
  readonly mode: 'FOLLOW_LIVE' | 'PINNED';
  /** The effective `TC`; `null` only while no authoritative Session Position has been mirrored. */
  readonly at: SessionPosition | null;
  /** A pinned position strictly earlier than the current Live Head. Always false under Live. */
  readonly earlierThanLiveHead: boolean;
  readonly liveHeadEstablished: boolean;
}

// ------------------------------------------------------------------------------------------
// Spatial
// ------------------------------------------------------------------------------------------

/**
 * The camera's own orientation, read from canonical state and from nothing else. A sparse or empty
 * historical viewport is a correct viewport: emptiness is never evidence that the camera is at the
 * World viewpoint, so `atWorldViewpoint` is a camera fact and never a scene fact.
 */
export interface SpatialChrome {
  readonly depth: SemanticDepth;
  readonly atWorldViewpoint: boolean;
}

// ------------------------------------------------------------------------------------------
// Inspection
// ------------------------------------------------------------------------------------------

/**
 * What one step of a disclosed contextual route is. `RUNG` is a rung of the frozen disclosure
 * lineage that names no identity; `OBJECT` is always the terminal step, the thing being inspected.
 */
export type ContextStepKind = 'WORLD' | 'RUNG' | 'THREAD' | 'THREAD_READING' | 'QUESTION_TURN' | 'OBJECT';

/**
 * One step of the disclosed contextual route.
 *
 * Parsed from the route T-04 minted against `V`, never inferred: no parent is derived from
 * geometry, no ownership is implied by containment, and a route that does not parse yields no path
 * at all rather than a plausible-looking guess.
 */
export interface ContextStep {
  readonly kind: ContextStepKind;
  /** The rung or family name exactly as the disclosed route recorded it. */
  readonly token: string;
  /** The identity this step names, or `null` for a structural rung that names none. */
  readonly id: string | null;
}

/** Whether the requested version is the then-current one, and if not, in which direction. */
export type NoncurrentVersionState = 'PREVALID' | 'SUPERSEDED' | null;

/**
 * `IF_render`: what the SELECTED historical disclosure can legitimately render of `IF_ref` now.
 *
 * `IF_ref` itself lives in canonical state and is never rewritten, rescued or re-elected here; this
 * union only says what may be shown of it at this position, and every member is a different fact.
 */
export type InspectionRenderState =
  | { readonly kind: 'NO_INSPECTION' }
  | {
      readonly kind: 'RENDERABLE';
      readonly family: HistoricalFamily;
      readonly id: string;
      /** The version the reader asked for; `null` means "the then-current one at TC", exactly. */
      readonly versionIntent: number | null;
      readonly noncurrent: NoncurrentVersionState;
      /** The disclosed contextual route. Empty when the request named no contextual appearance. */
      readonly lineage: readonly ContextStep[];
      readonly contextRequested: boolean;
    }
  /** Not part of `K(TC)`. Nothing about it may be named, shaped, counted or held a place for. */
  | { readonly kind: 'IDENTITY_UNKNOWN_AT_TC' }
  /**
   * The identity is part of `K(TC)`; the requested contextual appearance is not. The identity may be
   * named, the unavailable context may not, and no other context is substituted for it.
   */
  | {
      readonly kind: 'CONTEXT_UNAVAILABLE_AT_TC';
      readonly family: HistoricalFamily;
      readonly id: string;
      readonly versionIntent: number | null;
      readonly noncurrent: NoncurrentVersionState;
    }
  /**
   * Known at `TC`, but this rung did not earn the render. Withheld is not absent: the reader is told
   * which rung would disclose it, and no withheld content is exposed.
   */
  | { readonly kind: 'DEPTH_WITHHELD'; readonly family: HistoricalFamily; readonly id: string; readonly requiredDepth: SemanticDepth }
  /** Technical: the client has not obtained a disclosure for this viewpoint. Never an absence. */
  | { readonly kind: 'PROJECTION_NOT_FETCHED' }
  /** Technical: the server refused with a typed code. Never `IDENTITY_UNKNOWN_AT_TC`. */
  | { readonly kind: 'PROJECTION_UNAVAILABLE'; readonly code: HistoricalProjectionUnavailableCode }
  /** Technical: the held disclosure is not this viewpoint's. Retired immediately, never reread. */
  | { readonly kind: 'PROJECTION_STALE'; readonly reason: MapProjectionStaleReason }
  /** Technical: the held disclosure produced no usable scene at all. */
  | { readonly kind: 'PROJECTION_INCOHERENT' }
  /** Technical: this disclosure carries no answer about the current inspection. */
  | { readonly kind: 'INSPECTION_NOT_RESOLVED' }
  /** Technical: the answer is not a legal resolution, or does not agree with canonical state. */
  | { readonly kind: 'RESOLUTION_MALFORMED' };

export interface InspectionChrome {
  /** An `IF_ref` exists in canonical state. It says nothing at all about what that reference names. */
  readonly requested: boolean;
  readonly render: InspectionRenderState;
}

// ------------------------------------------------------------------------------------------
// Live
// ------------------------------------------------------------------------------------------

/**
 * Everything a historical reader may learn about Live, and nothing more.
 *
 * There is deliberately no identity, name, family, category, Home, direction, distance, offscreen
 * side, minimap point, count or set size on this interface. Two positions that differ only in a
 * Live Focus the reader's own `K(TC)` cannot disclose produce an identical value of this type,
 * because there is no field on which they could differ.
 *
 * `focusReturn` is the ONE specific capability, and it is not derived from `LF` at all: it is the
 * answer of the projection-bound query, asked against a projection proven to be this viewpoint's.
 * `UNPROVEN` means the question was never asked — it is not a quieter `UNAVAILABLE`.
 */
export interface LiveChrome {
  readonly liveEstablished: boolean;
  /** The reader is behind Live. Generic: it says Live moved on, never where it moved to. */
  readonly advancedWhileHistorical: boolean;
  readonly routeBackToLiveAvailable: boolean;
  readonly focusReturn: 'AVAILABLE' | 'UNAVAILABLE' | 'UNPROVEN';
}

// ------------------------------------------------------------------------------------------
// Returns
// ------------------------------------------------------------------------------------------

/**
 * The six frozen return identities, in a fixed logical order that no layout direction may reorder.
 * There is no seventh, and no generic `HOME`, `RESET`, `NAVIGATE`, `GO_LIVE`, `BACK_OR_HOME` or
 * `RETURN` that could stand in for several of them.
 */
export const RETURN_OPPORTUNITY_IDS = Object.freeze([
  'BACK_ONE_STEP',
  'EXACT_RETURN',
  'RETURN_LIVE_HEAD',
  'RETURN_LIVE_FOCUS',
  'RETURN_WORLD',
  'GO_LIVE_AND_LOCATE',
] as const);
export type ReturnOpportunityId = (typeof RETURN_OPPORTUNITY_IDS)[number];

/** What an act actually changes. Four different shapes; none of them is "navigation". */
export type ReturnEffect = 'HISTORY' | 'TEMPORAL' | 'SPATIAL' | 'TEMPORAL_AND_SPATIAL';

/**
 * One offered return, and the promises it is allowed to make.
 *
 * `movesTime` and `movesCamera` are what the frozen act does, not what a reader might hope: Return
 * to Live Head moves time and promises no camera movement, Return to Live Focus moves the camera and
 * promises no temporal movement, and the composite says both out loud so it can never be mistaken
 * for either half. Nothing here names a target, a place, a direction or a count.
 */
export interface ReturnOpportunity {
  readonly id: ReturnOpportunityId;
  readonly available: boolean;
  readonly effect: ReturnEffect;
  readonly movesTime: boolean;
  readonly movesCamera: boolean;
  /** Structural placeholder copy. Distinct per identity; final wording belongs to a later task. */
  readonly label: string;
  readonly hint: string;
}

export interface ReturnChrome {
  readonly opportunities: readonly ReturnOpportunity[];
  /** How many of the reader's OWN transactions are reversible. Never a count of anything in the world. */
  readonly checkpointCount: number;
}

// ------------------------------------------------------------------------------------------
// Context
// ------------------------------------------------------------------------------------------

/**
 * One legitimate disclosed appearance of the inspected identity. `current` states where the reader
 * IS; it is not a recommendation, and no option is ever preselected, defaulted or marked preferable.
 */
export interface ContextAppearanceOption {
  readonly key: string;
  readonly bindingId: string;
  readonly threadId: string;
  readonly label: string;
  readonly current: boolean;
}

/**
 * "What am I inside?" — answered from disclosed truth only.
 *
 * The lineage is the exact route the disclosure minted, not a computed hierarchy: no parent is
 * inferred, no ownership is implied, no geometry is consulted and no ranking exists. `ordering` says
 * so explicitly, because a list that does not deny being a ranking will be read as one.
 */
export interface ContextChrome {
  readonly lineage: readonly ContextStep[];
  readonly appearances: readonly ContextAppearanceOption[];
  /** Several legitimate appearances exist and none is elected. One appearance needs no chooser. */
  readonly choiceAvailable: boolean;
  readonly ordering: string;
}

// ------------------------------------------------------------------------------------------
// The projection the whole model is derived through
// ------------------------------------------------------------------------------------------

export type ChromeProjectionState =
  | { readonly status: 'CURRENT' }
  | { readonly status: 'NOT_FETCHED' }
  | { readonly status: 'UNAVAILABLE'; readonly code: HistoricalProjectionUnavailableCode }
  | { readonly status: 'STALE'; readonly reason: MapProjectionStaleReason }
  | { readonly status: 'INCOHERENT' };

/**
 * The whole read-only orientation answer.
 *
 * `projection` is first among equals: every semantic field below it was derived only after the held
 * disclosure was proven to be this viewpoint's, and when it was not, the semantic fields fall back
 * to their generic technical forms rather than to a quieter statement about the world.
 */
export interface OrientationModel {
  readonly projection: ChromeProjectionState;
  readonly temporal: TemporalChrome;
  readonly spatial: SpatialChrome;
  readonly inspection: InspectionChrome;
  readonly live: LiveChrome;
  readonly returns: ReturnChrome;
  readonly context: ContextChrome;
}
