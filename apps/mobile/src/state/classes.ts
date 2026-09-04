/**
 * T-02 — Canonical client state kernel: Class A types, the only stored state class.
 *
 * Frozen authority: Core Checkpoint v2 S5-STATE-01/02 (`S`, exactly two temporal modes),
 * Stage 6.5 v3 §9–§11 (state classes, per-field Class-A authority), T-02 Execution
 * Authorization v1 (§2, EX02-01, §6, §9, §10), Targeted Fix R1 (FIX-T02-02/03/04).
 *
 *   S = { LH, LF, TM, TC, K(TC), IF, MC, RH }
 *
 * Stored here: `LH` and `LF` (server-authoritative mirrors), `TM` (the pinned target lives
 * inside it), `IF_ref`, `MC` intent and `RH`. Effective `TC` is derived in `selectors.ts`
 * (`FOLLOW_LIVE` → `LH`, `PINNED(t)` → `t`) and has no storage slot. `K(TC)`, `V`,
 * `IF_render`, divergence, locatability, the visible footprint (Class B / D), `PTC`, gesture,
 * pointer and input streams, the Timeline window, presentation position, animation progress
 * and focus proxies (Class C / D) have no key in `CanonicalState` by design, and the exact
 * runtime shape validators below reject any attempt to smuggle one in.
 */
import type { RhActionId } from './actions';

// ------------------------------------------------------------------------------------------
// Exact runtime shape helpers (FIX-T02-02): allowlists, never blacklists
// ------------------------------------------------------------------------------------------

/** A path-qualified description of the first shape violation, or `null` when the shape is exact. */
export type ShapeIssue = string | null;

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Exact-key rule: every required key present, and no key outside `required ∪ optional`.
 * An optional key may be present with the value `undefined`.
 */
export function exactShapeIssue(
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[] = [],
): ShapeIssue {
  if (!isPlainRecord(value)) return `${path}: must be a plain object`;
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) return `${path}: missing ${key}`;
  }
  for (const key of Object.keys(value)) {
    if (!required.includes(key) && !optional.includes(key)) return `${path}: unknown key ${key}`;
  }
  return null;
}

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

export const OPAQUE_REF_KINDS = Object.freeze([
  'CANONICAL_IDENTITY',
  'CONTEXTUAL_APPEARANCE',
  'VERSION',
  'LINEAGE',
  'WORLD_ANCHOR',
  'WORLD_ORIENTATION',
  'SCALE_INTENT',
  'SPATIAL_DESTINATION',
] as const);
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
  if (!isPlainRecord(value)) return false;
  return Object.values(value).every(isOpaquePrimitive);
}

/** Exact wrapper shape `{ kind, value }` with the expected kind; the value stays uninterpreted. */
export function opaqueRefShapeIssue(value: unknown, kind: OpaqueRefKind, path: string): ShapeIssue {
  const issue = exactShapeIssue(value, path, ['kind', 'value']);
  if (issue) return issue;
  const candidate = value as { kind: unknown; value: unknown };
  if (candidate.kind !== kind) return `${path}: expected kind ${kind}, got ${String(candidate.kind)}`;
  if (!isOpaqueValue(candidate.value)) return `${path}: value must be a string or a flat record of finite primitives`;
  return null;
}

export function isOpaqueRefOfKind<K extends OpaqueRefKind>(value: unknown, kind: K): value is OpaqueRef<K> {
  return opaqueRefShapeIssue(value, kind, 'ref') === null;
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
 * temporal mode, not an addressable target and never a persistable temporal cursor. No RH
 * checkpoint can ever capture it (FIX-T02-04).
 */
export type LiveHead = SessionPosition | null;

export type LiveFocus =
  | { readonly kind: 'NONE' }
  | { readonly kind: 'EMERGING_FOCUS'; readonly emergingFocusId: string }
  | { readonly kind: 'ESTABLISHED_THREAD'; readonly threadId: string };

export function liveFocusShapeIssue(value: unknown, path: string): ShapeIssue {
  if (!isPlainRecord(value)) return `${path}: must be a plain object`;
  switch (value.kind) {
    case 'NONE':
      return exactShapeIssue(value, path, ['kind']);
    case 'EMERGING_FOCUS': {
      const issue = exactShapeIssue(value, path, ['kind', 'emergingFocusId']);
      if (issue) return issue;
      return typeof value.emergingFocusId === 'string' && value.emergingFocusId.length > 0 ? null : `${path}: emergingFocusId must be a non-empty string`;
    }
    case 'ESTABLISHED_THREAD': {
      const issue = exactShapeIssue(value, path, ['kind', 'threadId']);
      if (issue) return issue;
      return typeof value.threadId === 'string' && value.threadId.length > 0 ? null : `${path}: threadId must be a non-empty string`;
    }
    default:
      return `${path}: kind must be NONE, EMERGING_FOCUS or ESTABLISHED_THREAD`;
  }
}

export function isLiveFocus(value: unknown): value is LiveFocus {
  return liveFocusShapeIssue(value, 'LF') === null;
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

export function liveTruthShapeIssue(value: unknown, path: string): ShapeIssue {
  const issue = exactShapeIssue(value, path, ['LH', 'LF']);
  if (issue) return issue;
  const live = value as { LH: unknown; LF: unknown };
  if (live.LH !== null && !isSessionPosition(live.LH)) return `${path}.LH: must be null or a Session Position >= 1`;
  const mirrorIssue = exactShapeIssue(live.LF, `${path}.LF`, ['value', 'atSp']);
  if (mirrorIssue) return mirrorIssue;
  const mirror = live.LF as { value: unknown; atSp: unknown };
  const focusIssue = liveFocusShapeIssue(mirror.value, `${path}.LF.value`);
  if (focusIssue) return focusIssue;
  if (mirror.atSp !== null && !isSessionPosition(mirror.atSp)) return `${path}.LF.atSp: must be null or a Session Position >= 1`;
  return null;
}

// ------------------------------------------------------------------------------------------
// Temporal mode, semantic depth, inspection reference, camera intent
// ------------------------------------------------------------------------------------------

/** Exactly two modes. `PINNED(t)` stores `t`; `FOLLOW_LIVE` stores nothing temporal. */
export type TemporalMode = { readonly kind: 'FOLLOW_LIVE' } | { readonly kind: 'PINNED'; readonly at: SessionPosition };

export function temporalModeShapeIssue(value: unknown, path: string): ShapeIssue {
  if (!isPlainRecord(value)) return `${path}: must be a plain object`;
  if (value.kind === 'FOLLOW_LIVE') return exactShapeIssue(value, path, ['kind']);
  if (value.kind === 'PINNED') {
    const issue = exactShapeIssue(value, path, ['kind', 'at']);
    if (issue) return issue;
    return isSessionPosition(value.at) ? null : `${path}.at: must be a Session Position >= 1`;
  }
  return `${path}: kind must be FOLLOW_LIVE or PINNED`;
}

export function temporalModeEquals(a: TemporalMode, b: TemporalMode): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === 'PINNED' && b.kind === 'PINNED' ? a.at === b.at : true;
}

/**
 * Frozen disclosure lineage World → Thread → Session → Reading / analytical object →
 * Source / Provenance (S34-WORLD-03, Stage 4.2). Rung four is the analytical-object rung;
 * Reading is one object family that discloses there, never a depth of its own (EX02-01).
 */
export const SEMANTIC_DEPTHS = Object.freeze(['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'] as const);
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

export function inspectionRefShapeIssue(value: unknown, path: string): ShapeIssue {
  const issue = exactShapeIssue(value, path, ['canonicalIdentity', 'depth', 'lineage'], ['contextualAppearance', 'version']);
  if (issue) return issue;
  const ref = value as Partial<Record<keyof InspectionRef, unknown>>;
  return (
    opaqueRefShapeIssue(ref.canonicalIdentity, 'CANONICAL_IDENTITY', `${path}.canonicalIdentity`) ??
    (ref.contextualAppearance === undefined
      ? null
      : opaqueRefShapeIssue(ref.contextualAppearance, 'CONTEXTUAL_APPEARANCE', `${path}.contextualAppearance`)) ??
    (ref.version === undefined ? null : opaqueRefShapeIssue(ref.version, 'VERSION', `${path}.version`)) ??
    (isSemanticDepth(ref.depth) ? null : `${path}.depth: must be one of the five frozen rungs`) ??
    opaqueRefShapeIssue(ref.lineage, 'LINEAGE', `${path}.lineage`)
  );
}

export function isInspectionRef(value: unknown): value is InspectionRef {
  return inspectionRefShapeIssue(value, 'IF_ref') === null;
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
 * and never appear here, in `C_RH` or in `Φ_eff` (REV-T02-02, Execution Authorization §8);
 * the exact-shape rule rejects any such key at the trust boundary.
 */
export interface CameraIntent {
  readonly anchor: WorldAnchorRef;
  readonly orientation?: WorldOrientationRef;
  readonly scale: ScaleIntentRef;
  readonly depth: SemanticDepth;
  readonly destination?: SpatialDestinationRef;
}

export function cameraIntentShapeIssue(value: unknown, path: string): ShapeIssue {
  const issue = exactShapeIssue(value, path, ['anchor', 'scale', 'depth'], ['orientation', 'destination']);
  if (issue) return issue;
  const camera = value as Partial<Record<keyof CameraIntent, unknown>>;
  return (
    opaqueRefShapeIssue(camera.anchor, 'WORLD_ANCHOR', `${path}.anchor`) ??
    (camera.orientation === undefined ? null : opaqueRefShapeIssue(camera.orientation, 'WORLD_ORIENTATION', `${path}.orientation`)) ??
    opaqueRefShapeIssue(camera.scale, 'SCALE_INTENT', `${path}.scale`) ??
    (isSemanticDepth(camera.depth) ? null : `${path}.depth: must be one of the five frozen rungs`) ??
    (camera.destination === undefined ? null : opaqueRefShapeIssue(camera.destination, 'SPATIAL_DESTINATION', `${path}.destination`))
  );
}

export function isCameraIntent(value: unknown): value is CameraIntent {
  return cameraIntentShapeIssue(value, 'MC') === null;
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

/**
 * `C_RH` (S5-RH-03): the pre-act viewpoint. `tmProvenance` is provenance only (S5-RH-01).
 * `tc` is always an addressable Session Position: frozen restoration is `PINNED(capturedTC)`,
 * so a checkpoint over the technical absence sentinel is unrepresentable (FIX-T02-04).
 */
export interface RhCheckpoint {
  readonly tmProvenance: TemporalMode;
  readonly tc: SessionPosition;
  readonly ifRef: InspectionRef | null;
  readonly camera: CameraIntent;
}

/** An RH entry records an effective explicit Product transaction only (FIX-T02-03). */
export interface RhEntry {
  readonly act: RhActionId;
  readonly captured: RhCheckpoint;
}

export function rhCheckpointShapeIssue(value: unknown, path: string): ShapeIssue {
  const issue = exactShapeIssue(value, path, ['tmProvenance', 'tc', 'ifRef', 'camera']);
  if (issue) return issue;
  const checkpoint = value as Partial<Record<keyof RhCheckpoint, unknown>>;
  return (
    temporalModeShapeIssue(checkpoint.tmProvenance, `${path}.tmProvenance`) ??
    (isSessionPosition(checkpoint.tc) ? null : `${path}.tc: must be an addressable Session Position (never null)`) ??
    (checkpoint.ifRef === null ? null : inspectionRefShapeIssue(checkpoint.ifRef, `${path}.ifRef`)) ??
    cameraIntentShapeIssue(checkpoint.camera, `${path}.camera`)
  );
}

export function rhEntryShapeIssue(value: unknown, path: string, isRhAct: (candidate: unknown) => boolean): ShapeIssue {
  const issue = exactShapeIssue(value, path, ['act', 'captured']);
  if (issue) return issue;
  const entry = value as { act: unknown; captured: unknown };
  if (!isRhAct(entry.act)) return `${path}.act: ${String(entry.act)} is not an RH-eligible Product action identity`;
  return rhCheckpointShapeIssue(entry.captured, `${path}.captured`);
}

export interface CanonicalState {
  /** Immutable store context (not a Product-writable field of `S`). */
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

export const CANONICAL_STATE_KEYS = Object.freeze(['session', 'live', 'temporal', 'inspection', 'camera', 'history'] as const);

/** Exact canonical shape of a whole state candidate; `null` when every level is exact. */
export function canonicalStateShapeIssue(value: unknown, isRhAct: (candidate: unknown) => boolean): ShapeIssue {
  const issue = exactShapeIssue(value, 'state', CANONICAL_STATE_KEYS);
  if (issue) return issue;
  const state = value as Record<keyof CanonicalState, unknown>;
  const sessionIssue = exactShapeIssue(state.session, 'state.session', ['id']);
  if (sessionIssue) return sessionIssue;
  const session = state.session as { id: unknown };
  if (typeof session.id !== 'string' || session.id.length === 0) return 'state.session.id: must be a non-empty string';
  const liveIssue = liveTruthShapeIssue(state.live, 'state.live');
  if (liveIssue) return liveIssue;
  const temporalIssue = temporalModeShapeIssue(state.temporal, 'state.temporal');
  if (temporalIssue) return temporalIssue;
  if (state.inspection !== null) {
    const inspectionIssue = inspectionRefShapeIssue(state.inspection, 'state.inspection');
    if (inspectionIssue) return inspectionIssue;
  }
  const cameraIssue = cameraIntentShapeIssue(state.camera, 'state.camera');
  if (cameraIssue) return cameraIssue;
  if (!Array.isArray(state.history)) return 'state.history: must be an array';
  for (let i = 0; i < state.history.length; i += 1) {
    const entryIssue = rhEntryShapeIssue(state.history[i], `state.history[${i}]`, isRhAct);
    if (entryIssue) return entryIssue;
  }
  return null;
}

/** Class-A authority fields as governed by the per-field writer guard. */
export const CLASS_A_FIELDS = Object.freeze([
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
] as const);
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
