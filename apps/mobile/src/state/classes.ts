/**
 * T-02 — Canonical client state kernel: Class A types, the only stored state class.
 *
 * Frozen authority: Core Checkpoint v2 S5-STATE-01/02 (`S`, exactly two temporal modes),
 * Stage 6.5 v3 §9–§11 (state classes, per-field Class-A authority), T-02 Execution
 * Authorization v1 (§2, EX02-01, §6, §9, §10).
 *
 *   S = { LH, LF, TM, TC, K(TC), IF, MC, RH }
 *
 * Stored here: `LH` and `LF` (server-authoritative mirrors), `TM` (the pinned target lives
 * inside it), `IF_ref`, `MC` intent and `RH`. Effective `TC` is derived in `selectors.ts`
 * (`FOLLOW_LIVE` → `LH`, `PINNED(t)` → `t`) and has no storage slot. `K(TC)`, `V`,
 * `IF_render`, divergence, locatability, the visible footprint (Class B / D), `PTC`, gesture,
 * pointer and input streams, the Timeline window, presentation position, animation progress
 * and focus proxies (Class C / D) have no key in `CanonicalState` by design.
 */
import type { ProductActId } from './actions';

// ------------------------------------------------------------------------------------------
// Opaque references (Execution Authorization §6)
//
// The kernel never parses the domain meaning of these values. The owning task (T-03C, T-04, …)
// defines the encoding. Equality is deterministic value equality: strings compare by value,
// records compare key-order-insensitively with primitive members compared by `Object.is`.
// ------------------------------------------------------------------------------------------

export type OpaquePrimitive = string | number | boolean | null;
export type OpaqueValue = string | Readonly<Record<string, OpaquePrimitive>>;

export interface OpaqueRef<K extends string> {
  readonly kind: K;
  readonly value: OpaqueValue;
}

export const OPAQUE_REF_KINDS = [
  'CANONICAL_IDENTITY',
  'CONTEXTUAL_APPEARANCE',
  'VERSION',
  'LINEAGE',
  'WORLD_ANCHOR',
  'WORLD_ORIENTATION',
  'SCALE_INTENT',
  'SPATIAL_DESTINATION',
] as const;
export type OpaqueRefKind = (typeof OPAQUE_REF_KINDS)[number];

/** Any canonical object family, present or future. No family enumeration exists here. */
export type CanonicalIdentityRef = OpaqueRef<'CANONICAL_IDENTITY'>;
export type ContextualAppearanceRef = OpaqueRef<'CONTEXTUAL_APPEARANCE'>;
export type VersionRef = OpaqueRef<'VERSION'>;
/** Containing-context chain of an inspection (Stage 4.3 nested inspection history). */
export type LineageRef = OpaqueRef<'LINEAGE'>;
/** World reference / anchor. T-04 binds concrete world coordinates behind it. */
export type WorldAnchorRef = OpaqueRef<'WORLD_ANCHOR'>;
export type WorldOrientationRef = OpaqueRef<'WORLD_ORIENTATION'>;
/** Zoom / scale intent, distinct from semantic depth. */
export type ScaleIntentRef = OpaqueRef<'SCALE_INTENT'>;
/** Authorized / user-authored spatial destination. */
export type SpatialDestinationRef = OpaqueRef<'SPATIAL_DESTINATION'>;

function isOpaquePrimitive(value: unknown): value is OpaquePrimitive {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

export function isOpaqueValue(value: unknown): value is OpaqueValue {
  if (typeof value === 'string') return true;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(isOpaquePrimitive);
}

export function isOpaqueRefOfKind<K extends OpaqueRefKind>(value: unknown, kind: K): value is OpaqueRef<K> {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as { kind?: unknown; value?: unknown };
  return candidate.kind === kind && isOpaqueValue(candidate.value);
}

/** Builds a frozen opaque reference after validating its shape (never its meaning). */
export function opaqueRef<K extends OpaqueRefKind>(kind: K, value: OpaqueValue): OpaqueRef<K> {
  if (!OPAQUE_REF_KINDS.includes(kind)) {
    throw new TypeError(`opaqueRef: unknown opaque reference kind ${String(kind)}`);
  }
  if (!isOpaqueValue(value)) {
    throw new TypeError('opaqueRef: value must be a string or a flat record of finite primitives');
  }
  const frozenValue: OpaqueValue = typeof value === 'string' ? value : Object.freeze({ ...value });
  return Object.freeze({ kind, value: frozenValue });
}

export function opaqueValueEquals(a: OpaqueValue, b: OpaqueValue): boolean {
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i += 1) {
    if (keysA[i] !== keysB[i]) return false;
  }
  return keysA.every((key) => Object.is(a[key], b[key]));
}

export function opaqueRefEquals(
  a: OpaqueRef<string> | null | undefined,
  b: OpaqueRef<string> | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && opaqueValueEquals(a.value, b.value);
}

// ------------------------------------------------------------------------------------------
// Session position, Live Head, Live Focus
// ------------------------------------------------------------------------------------------

/** Committed-CU ordinal: integer ≥ 1. `SP(1)` is the first addressable Session Position. */
export type SessionPosition = number & { readonly __brand: 'SessionPosition' };

export function isSessionPosition(value: unknown): value is SessionPosition {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

export function sessionPosition(value: number): SessionPosition {
  if (!isSessionPosition(value)) {
    throw new RangeError(`sessionPosition: ${String(value)} is not an integer >= 1`);
  }
  return value;
}

/**
 * `null` is a technical client absence sentinel only: no authoritative committed Session
 * Position has been mirrored yet. It is not SP(0), not PRE_FIRST_SP, not a Moment, not a
 * temporal mode, not an addressable target and never a persistable temporal cursor.
 */
export type LiveHead = SessionPosition | null;

export type LiveFocus =
  | { readonly kind: 'NONE' }
  | { readonly kind: 'EMERGING_FOCUS'; readonly emergingFocusId: string }
  | { readonly kind: 'ESTABLISHED_THREAD'; readonly threadId: string };

export function isLiveFocus(value: unknown): value is LiveFocus {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as { kind?: unknown; emergingFocusId?: unknown; threadId?: unknown };
  switch (candidate.kind) {
    case 'NONE':
      return true;
    case 'EMERGING_FOCUS':
      return typeof candidate.emergingFocusId === 'string' && candidate.emergingFocusId.length > 0;
    case 'ESTABLISHED_THREAD':
      return typeof candidate.threadId === 'string' && candidate.threadId.length > 0;
    default:
      return false;
  }
}

export function liveFocusEquals(a: LiveFocus, b: LiveFocus): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'EMERGING_FOCUS' && b.kind === 'EMERGING_FOCUS') return a.emergingFocusId === b.emergingFocusId;
  if (a.kind === 'ESTABLISHED_THREAD' && b.kind === 'ESTABLISHED_THREAD') return a.threadId === b.threadId;
  return true;
}

/** Mirror of the server's current live conversational attention, anchored at its committed SP. */
export interface LiveFocusMirror {
  readonly value: LiveFocus;
  readonly atSp: SessionPosition | null;
}

/** Server-authoritative live truth. Written only through the two ingestion seams. */
export interface LiveTruth {
  readonly LH: LiveHead;
  readonly LF: LiveFocusMirror;
}

// ------------------------------------------------------------------------------------------
// Temporal mode, semantic depth, inspection reference, camera intent
// ------------------------------------------------------------------------------------------

/** Exactly two modes. `PINNED(t)` stores `t`; `FOLLOW_LIVE` stores nothing temporal. */
export type TemporalMode = { readonly kind: 'FOLLOW_LIVE' } | { readonly kind: 'PINNED'; readonly at: SessionPosition };

export function temporalModeEquals(a: TemporalMode, b: TemporalMode): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === 'PINNED' && b.kind === 'PINNED' ? a.at === b.at : true;
}

/**
 * Frozen disclosure lineage World → Thread → Session → Reading / analytical object →
 * Source / Provenance (S34-WORLD-03, Stage 4.2). Rung four is the analytical-object rung;
 * Reading is one object family that discloses there, never a depth of its own (EX02-01).
 */
export const SEMANTIC_DEPTHS = ['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'] as const;
export type SemanticDepth = (typeof SEMANTIC_DEPTHS)[number];

export function isSemanticDepth(value: unknown): value is SemanticDepth {
  return typeof value === 'string' && (SEMANTIC_DEPTHS as readonly string[]).includes(value);
}

/**
 * `IF_ref`: the exact requested inspection. Retained exactly even when a later projection says
 * the version, the contextual appearance or the default render is unavailable at `TC`
 * (S5-HIST-11, IV-06). Only explicit inspection acts owned by later tasks may change it.
 */
export interface InspectionRef {
  readonly canonicalIdentity: CanonicalIdentityRef;
  readonly contextualAppearance?: ContextualAppearanceRef;
  /** Absent means the then-current version at `TC`. */
  readonly version?: VersionRef;
  readonly depth: SemanticDepth;
  readonly lineage: LineageRef;
}

export function isInspectionRef(value: unknown): value is InspectionRef {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<Record<keyof InspectionRef, unknown>>;
  return (
    isOpaqueRefOfKind(candidate.canonicalIdentity, 'CANONICAL_IDENTITY') &&
    (candidate.contextualAppearance === undefined ||
      isOpaqueRefOfKind(candidate.contextualAppearance, 'CONTEXTUAL_APPEARANCE')) &&
    (candidate.version === undefined || isOpaqueRefOfKind(candidate.version, 'VERSION')) &&
    isSemanticDepth(candidate.depth) &&
    isOpaqueRefOfKind(candidate.lineage, 'LINEAGE')
  );
}

export function inspectionRefEquals(a: InspectionRef | null, b: InspectionRef | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    opaqueRefEquals(a.canonicalIdentity, b.canonicalIdentity) &&
    opaqueRefEquals(a.contextualAppearance, b.contextualAppearance) &&
    opaqueRefEquals(a.version, b.version) &&
    a.depth === b.depth &&
    opaqueRefEquals(a.lineage, b.lineage)
  );
}

/**
 * `MC` intent: canonical navigation intent only. The device presentation envelope (width,
 * height, aspect, clipping) and the derived visible footprint are Class D, owned by T-04/T-11,
 * and never appear here, in `C_RH` or in `Φ_eff` (REV-T02-02, Execution Authorization §8).
 */
export interface CameraIntent {
  readonly anchor: WorldAnchorRef;
  readonly orientation?: WorldOrientationRef;
  readonly scale: ScaleIntentRef;
  readonly depth: SemanticDepth;
  readonly destination?: SpatialDestinationRef;
}

export function isCameraIntent(value: unknown): value is CameraIntent {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<Record<keyof CameraIntent, unknown>>;
  return (
    isOpaqueRefOfKind(candidate.anchor, 'WORLD_ANCHOR') &&
    (candidate.orientation === undefined || isOpaqueRefOfKind(candidate.orientation, 'WORLD_ORIENTATION')) &&
    isOpaqueRefOfKind(candidate.scale, 'SCALE_INTENT') &&
    isSemanticDepth(candidate.depth) &&
    (candidate.destination === undefined || isOpaqueRefOfKind(candidate.destination, 'SPATIAL_DESTINATION'))
  );
}

export function cameraIntentEquals(a: CameraIntent, b: CameraIntent): boolean {
  return (
    opaqueRefEquals(a.anchor, b.anchor) &&
    opaqueRefEquals(a.orientation, b.orientation) &&
    opaqueRefEquals(a.scale, b.scale) &&
    a.depth === b.depth &&
    opaqueRefEquals(a.destination, b.destination)
  );
}

// ------------------------------------------------------------------------------------------
// Reversible history (RH) and the canonical state
// ------------------------------------------------------------------------------------------

/** `C_RH` (S5-RH-03): the pre-act viewpoint. `tmProvenance` is provenance only (S5-RH-01). */
export interface RhCheckpoint {
  readonly tmProvenance: TemporalMode;
  readonly tc: SessionPosition | null;
  readonly ifRef: InspectionRef | null;
  readonly camera: CameraIntent;
}

export interface RhEntry {
  readonly act: ProductActId;
  readonly captured: RhCheckpoint;
}

export interface CanonicalState {
  readonly session: { readonly id: string };
  /** Server-authoritative mirror. No Product action can reach it. */
  readonly live: LiveTruth;
  /** `TM`. Effective `TC` is derived, never stored. */
  readonly temporal: TemporalMode;
  /** `IF_ref`. */
  readonly inspection: InspectionRef | null;
  /** `MC` intent. */
  readonly camera: CameraIntent;
  /** `RH`, append-only; written only by the transaction boundary in `store.ts`. */
  readonly history: readonly RhEntry[];
}

/** Class-A authority fields as governed by the per-field writer guard. */
export const CLASS_A_FIELDS = [
  'LH',
  'LF',
  'TM',
  'IF_ref',
  'MC.anchor',
  'MC.orientation',
  'MC.scale',
  'MC.destination',
  'MC.depth',
  'RH',
] as const;
export type ClassAField = (typeof CLASS_A_FIELDS)[number];

function historyEquals(a: readonly RhEntry[], b: readonly RhEntry[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((entry, index) => entry === b[index]);
}

/** Deterministic per-field equality used by the writer guard and by `Φ_eff`. */
export function classAFieldEquals(field: ClassAField, a: CanonicalState, b: CanonicalState): boolean {
  switch (field) {
    case 'LH':
      return a.live.LH === b.live.LH;
    case 'LF':
      return a.live.LF.atSp === b.live.LF.atSp && liveFocusEquals(a.live.LF.value, b.live.LF.value);
    case 'TM':
      return temporalModeEquals(a.temporal, b.temporal);
    case 'IF_ref':
      return inspectionRefEquals(a.inspection, b.inspection);
    case 'MC.anchor':
      return opaqueRefEquals(a.camera.anchor, b.camera.anchor);
    case 'MC.orientation':
      return opaqueRefEquals(a.camera.orientation, b.camera.orientation);
    case 'MC.scale':
      return opaqueRefEquals(a.camera.scale, b.camera.scale);
    case 'MC.destination':
      return opaqueRefEquals(a.camera.destination, b.camera.destination);
    case 'MC.depth':
      return a.camera.depth === b.camera.depth;
    case 'RH':
      return historyEquals(a.history, b.history);
    default: {
      const exhaustive: never = field;
      return exhaustive;
    }
  }
}

/** Freezes a value graph in place. Canonical state is immutable once published. */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (!Object.isFrozen(value)) Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}
