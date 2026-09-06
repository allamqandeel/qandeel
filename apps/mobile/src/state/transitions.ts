/**
 * T-02 — Executable kernel transitions, extended by T-04 with the three promoted Map acts and by
 * T-06 with the two promoted temporal acts.
 *
 * Action transitions return `ClientWritable` only: `live` (LH, LF) and `history` (RH) are
 * unreachable from a Product action at compile time. Event transitions return `LiveTruth`
 * only: `TM`, `IF_ref`, `MC` and `RH` are unreachable from a passive event. The runtime
 * per-field guard in `authority.ts` re-checks every result regardless.
 *
 * Preconditions throw before any state is produced. No transition performs gesture-to-world
 * mathematics, Preview handling, locate resolution or any later-owner semantics. The Map
 * transitions are structural in exactly the same sense: entitlement against the disclosed
 * projection `V` is resolved before the act exists, in `src/map/inspection`, and never here —
 * the kernel receives an already-entitled `InspectionRef` the way `PAN` receives an already
 * authorized `WORLD_ANCHOR`. Not one of the three writes `TM` or `LF`.
 *
 * The two T-06 transitions are structural in the same sense again: the kernel receives an already
 * authorized landing and re-checks only its shape and the frozen temporal bound. No preview state
 * exists here — a preview is Class C and never reaches this file — and no transition here can be
 * reached by an animation, a gesture frame or a presentation movement.
 */
import type {
  AuthoritativeEvent,
  KernelAction,
  KernelActionType,
  LocateLanding,
  MapAction,
  MapActionType,
  StoreAction,
  StoreActionType,
  TemporalAction,
  TemporalActionType,
} from './actions';
import { OutOfOrderTransition, PreconditionFailed, RetractionRejected } from './authority';
import {
  inspectionRefShapeIssue,
  isLiveFocus,
  isOpaqueRefOfKind,
  isSemanticDepth,
  isSessionPosition,
  liveFocusEquals,
  opaqueRefEquals,
  type CameraIntent,
  type CanonicalState,
  type LiveTruth,
} from './classes';

export type ClientWritable = Pick<CanonicalState, 'temporal' | 'inspection' | 'camera'>;

export type ActionTransition<A extends StoreAction> = (state: CanonicalState, action: A) => ClientWritable;
export type EventTransition<E extends AuthoritativeEvent> = (state: CanonicalState, event: E) => LiveTruth;

export type ActionTransitionTable = {
  readonly [K in StoreActionType]: ActionTransition<Extract<StoreAction, { type: K }>>;
};
export type KernelActionTransitionTable = Pick<ActionTransitionTable, KernelActionType>;
export type MapActionTransitionTable = Pick<ActionTransitionTable, MapActionType>;
export type TemporalActionTransitionTable = Pick<ActionTransitionTable, TemporalActionType>;
export type EventTransitionTable = {
  readonly [K in AuthoritativeEvent['type']]: EventTransition<Extract<AuthoritativeEvent, { type: K }>>;
};

function writable(state: CanonicalState, camera?: CameraIntent, temporal?: CanonicalState['temporal']): ClientWritable {
  return {
    temporal: temporal ?? state.temporal,
    inspection: state.inspection,
    camera: camera ?? state.camera,
  };
}

/** `PAN`: abstract camera-intent write only (EX02-03). Orientation, scale and depth are preserved. */
const pan: ActionTransition<Extract<KernelAction, { type: 'PAN' }>> = (state, action) => {
  const { to } = action;
  if (!to || !isOpaqueRefOfKind(to.anchor, 'WORLD_ANCHOR')) {
    throw new PreconditionFailed('PAN', 'requires an abstract WORLD_ANCHOR intent');
  }
  if (to.destination !== undefined && !isOpaqueRefOfKind(to.destination, 'SPATIAL_DESTINATION')) {
    throw new PreconditionFailed('PAN', 'destination must be a SPATIAL_DESTINATION reference');
  }
  const camera: CameraIntent =
    to.destination === undefined
      ? { ...state.camera, anchor: to.anchor }
      : { ...state.camera, anchor: to.anchor, destination: to.destination };
  return writable(state, camera);
};

/** `ZOOM_SEMANTIC`: depth write plus optional scale / focal anchor (EX02-03). Orientation and destination preserved. */
const zoomSemantic: ActionTransition<Extract<KernelAction, { type: 'ZOOM_SEMANTIC' }>> = (state, action) => {
  if (!isSemanticDepth(action.depth)) {
    throw new PreconditionFailed('ZOOM_SEMANTIC', `depth must be one of the five frozen rungs, got ${String(action.depth)}`);
  }
  const to = action.to;
  if (to?.scale !== undefined && !isOpaqueRefOfKind(to.scale, 'SCALE_INTENT')) {
    throw new PreconditionFailed('ZOOM_SEMANTIC', 'scale must be a SCALE_INTENT reference');
  }
  if (to?.anchor !== undefined && !isOpaqueRefOfKind(to.anchor, 'WORLD_ANCHOR')) {
    throw new PreconditionFailed('ZOOM_SEMANTIC', 'anchor must be a WORLD_ANCHOR reference');
  }
  const camera: CameraIntent = {
    ...state.camera,
    depth: action.depth,
    scale: to?.scale ?? state.camera.scale,
    anchor: to?.anchor ?? state.camera.anchor,
  };
  return writable(state, camera);
};

/** `COMMIT_MOMENT(m)`: requires `LH != null` and `1 <= m <= LH`; `TM := PINNED(m)`, including `m == LH`. */
const commitMoment: ActionTransition<Extract<KernelAction, { type: 'COMMIT_MOMENT' }>> = (state, action) => {
  const lh = state.live.LH;
  if (lh === null) {
    throw new PreconditionFailed('COMMIT_MOMENT', 'no authoritative committed Session Position has been mirrored (LH = null)');
  }
  if (!isSessionPosition(action.moment)) {
    throw new PreconditionFailed('COMMIT_MOMENT', `moment must be a Session Position >= 1, got ${String(action.moment)}`);
  }
  if (action.moment > lh) {
    throw new PreconditionFailed('COMMIT_MOMENT', `moment ${action.moment} is beyond LH ${lh}; nothing later than LH exists`);
  }
  return writable(state, undefined, { kind: 'PINNED', at: action.moment });
};

/** `COMMIT_LIVE_EDGE`: requires a real Live Head (EX02-02); `TM := FOLLOW_LIVE`. */
const commitLiveEdge: ActionTransition<Extract<KernelAction, { type: 'COMMIT_LIVE_EDGE' }>> = (state) => {
  if (state.live.LH === null) {
    throw new PreconditionFailed('COMMIT_LIVE_EDGE', 'no authoritative committed Session Position has been mirrored (LH = null); there is no Live Edge target');
  }
  return writable(state, undefined, { kind: 'FOLLOW_LIVE' });
};

export const KERNEL_ACTION_TRANSITIONS: KernelActionTransitionTable = Object.freeze({
  PAN: pan,
  ZOOM_SEMANTIC: zoomSemantic,
  COMMIT_MOMENT: commitMoment,
  COMMIT_LIVE_EDGE: commitLiveEdge,
});

// ------------------------------------------------------------------------------------------
// T-04 — the three promoted Map acts
// ------------------------------------------------------------------------------------------

/** Structural validation only: whether the reference is *entitled* was decided in `src/map/inspection`. */
function assertInspectionRefShape(actId: MapActionType, ref: unknown): void {
  const issue = inspectionRefShapeIssue(ref, `${actId}.ref`);
  if (issue) throw new PreconditionFailed(actId, issue);
}

/**
 * `INSPECT_OBJECT`: `IF_ref := the exact requested inspection reference`. No temporal movement,
 * no `LF`, and no camera write at all — an ordinary inspection can never smuggle a locate,
 * which is why the frozen authority of this act is `IF_ref` alone.
 */
const inspectObject: ActionTransition<Extract<MapAction, { type: 'INSPECT_OBJECT' }>> = (state, action) => {
  assertInspectionRefShape('INSPECT_OBJECT', action.ref);
  return { temporal: state.temporal, inspection: action.ref, camera: state.camera };
};

/**
 * `SWITCH_CONTEXT`: the same canonical object seen through another legitimate contextual
 * appearance. The canonical identity and the semantic depth must be identical — a switch is
 * never a depth move and never a second canonical object — and the new reference must name a
 * contextual appearance. An identical reference is a true no-op and is dropped by `Φ_eff`.
 */
const switchContext: ActionTransition<Extract<MapAction, { type: 'SWITCH_CONTEXT' }>> = (state, action) => {
  assertInspectionRefShape('SWITCH_CONTEXT', action.ref);
  const current = state.inspection;
  if (current === null) {
    throw new PreconditionFailed('SWITCH_CONTEXT', 'a context switch requires a current inspection to switch the context of');
  }
  if (!opaqueRefEquals(current.canonicalIdentity, action.ref.canonicalIdentity)) {
    throw new PreconditionFailed('SWITCH_CONTEXT', 'the canonical identity must remain identical; a different identity is an inspection, not a context switch');
  }
  if (current.depth !== action.ref.depth) {
    throw new PreconditionFailed('SWITCH_CONTEXT', 'a context switch never changes semantic depth');
  }
  if (action.ref.contextualAppearance === undefined) {
    throw new PreconditionFailed('SWITCH_CONTEXT', 'a context switch names the contextual appearance it switches to');
  }
  return { temporal: state.temporal, inspection: action.ref, camera: state.camera };
};

/**
 * `DIRECT_JUMP`: one effective transaction that sets the exact `IF_ref`, the semantic depth and
 * the authorized camera intent required to land in the identified contextual locus. Temporal
 * state is untouched: `TM` is preserved and no `LF` exists. Orientation, scale and destination
 * are written only when the authorized landing supplies them (EX02-03's rule for `PAN`).
 */
const directJump: ActionTransition<Extract<MapAction, { type: 'DIRECT_JUMP' }>> = (state, action) => {
  assertInspectionRefShape('DIRECT_JUMP', action.ref);
  const to = action.to;
  if (to === null || typeof to !== 'object') throw new PreconditionFailed('DIRECT_JUMP', 'requires an authorized landing');
  if (!isSemanticDepth(to.depth)) {
    throw new PreconditionFailed('DIRECT_JUMP', `landing depth must be one of the five frozen rungs, got ${String(to.depth)}`);
  }
  if (!isOpaqueRefOfKind(to.anchor, 'WORLD_ANCHOR')) throw new PreconditionFailed('DIRECT_JUMP', 'the landing requires a WORLD_ANCHOR reference');
  if (!isOpaqueRefOfKind(to.destination, 'SPATIAL_DESTINATION')) {
    throw new PreconditionFailed('DIRECT_JUMP', 'the landing requires an authorized SPATIAL_DESTINATION locus');
  }
  if (to.scale !== undefined && !isOpaqueRefOfKind(to.scale, 'SCALE_INTENT')) {
    throw new PreconditionFailed('DIRECT_JUMP', 'scale must be a SCALE_INTENT reference');
  }
  if (to.orientation !== undefined && !isOpaqueRefOfKind(to.orientation, 'WORLD_ORIENTATION')) {
    throw new PreconditionFailed('DIRECT_JUMP', 'orientation must be a WORLD_ORIENTATION reference');
  }
  const base: CameraIntent = {
    ...state.camera,
    anchor: to.anchor,
    depth: to.depth,
    destination: to.destination,
    scale: to.scale ?? state.camera.scale,
  };
  const camera: CameraIntent = to.orientation === undefined ? base : { ...base, orientation: to.orientation };
  return { temporal: state.temporal, inspection: action.ref, camera };
};

export const MAP_ACTION_TRANSITIONS: MapActionTransitionTable = Object.freeze({
  INSPECT_OBJECT: inspectObject,
  SWITCH_CONTEXT: switchContext,
  DIRECT_JUMP: directJump,
});

// ------------------------------------------------------------------------------------------
// T-06 — the two promoted temporal acts
// ------------------------------------------------------------------------------------------

/**
 * Structural validation of an authorized landing. WHETHER the locus is legitimate at the position
 * this act commits to was decided in `src/temporal-navigation`, against the disclosed projection of
 * that position — never here, and never against the projection of the position being left.
 */
function assertLocateLanding(actId: TemporalActionType, to: unknown): void {
  if (to === null || typeof to !== 'object') throw new PreconditionFailed(actId, 'requires an authorized landing');
  const landing = to as Partial<LocateLanding>;
  if (!isOpaqueRefOfKind(landing.anchor, 'WORLD_ANCHOR')) throw new PreconditionFailed(actId, 'the landing requires a WORLD_ANCHOR reference');
  if (!isOpaqueRefOfKind(landing.destination, 'SPATIAL_DESTINATION')) {
    throw new PreconditionFailed(actId, 'the landing requires an authorized SPATIAL_DESTINATION locus');
  }
  if (landing.scale !== undefined && !isOpaqueRefOfKind(landing.scale, 'SCALE_INTENT')) {
    throw new PreconditionFailed(actId, 'scale must be a SCALE_INTENT reference');
  }
  if (landing.orientation !== undefined && !isOpaqueRefOfKind(landing.orientation, 'WORLD_ORIENTATION')) {
    throw new PreconditionFailed(actId, 'orientation must be a WORLD_ORIENTATION reference');
  }
}

/** The authorized camera intent of a landing. `MC.depth` is never written: neither act holds it. */
function locatedCamera(state: CanonicalState, to: LocateLanding): CameraIntent {
  const base: CameraIntent = { ...state.camera, anchor: to.anchor, destination: to.destination, scale: to.scale ?? state.camera.scale };
  return to.orientation === undefined ? base : { ...base, orientation: to.orientation };
}

/**
 * `COMMIT_MOMENT_AND_LOCATE(m)`: ONE composite transaction that sets `TM := PINNED(m)` and the
 * authorized spatial landing together, therefore ONE effective transaction and ONE checkpoint —
 * never a temporal commit followed later by a separate pan. The temporal precondition is exactly
 * `COMMIT_MOMENT`'s (`LH != null`, `1 <= m <= LH`), because this act is that commit plus a locate,
 * not a second temporal rule. `IF_ref` is untouched: locating is not inspecting.
 */
const commitMomentAndLocate: ActionTransition<Extract<TemporalAction, { type: 'COMMIT_MOMENT_AND_LOCATE' }>> = (state, action) => {
  const lh = state.live.LH;
  if (lh === null) {
    throw new PreconditionFailed('COMMIT_MOMENT_AND_LOCATE', 'no authoritative committed Session Position has been mirrored (LH = null)');
  }
  if (!isSessionPosition(action.moment)) {
    throw new PreconditionFailed('COMMIT_MOMENT_AND_LOCATE', `moment must be a Session Position >= 1, got ${String(action.moment)}`);
  }
  if (action.moment > lh) {
    throw new PreconditionFailed('COMMIT_MOMENT_AND_LOCATE', `moment ${action.moment} is beyond LH ${lh}; nothing later than LH exists`);
  }
  assertLocateLanding('COMMIT_MOMENT_AND_LOCATE', action.to);
  return { temporal: { kind: 'PINNED', at: action.moment }, inspection: state.inspection, camera: locatedCamera(state, action.to) };
};

/**
 * `CHOOSE_LOCUS`: resolves an already-legitimate contextual-location choice. It writes the spatial
 * landing and nothing else — `TM` is carried through unchanged, so a locus choice can never become
 * a temporal move, and `IF_ref` is carried through unchanged, so it can never become an inspection
 * or a change of canonical identity.
 */
const chooseLocus: ActionTransition<Extract<TemporalAction, { type: 'CHOOSE_LOCUS' }>> = (state, action) => {
  assertLocateLanding('CHOOSE_LOCUS', action.to);
  return { temporal: state.temporal, inspection: state.inspection, camera: locatedCamera(state, action.to) };
};

export const TEMPORAL_ACTION_TRANSITIONS: TemporalActionTransitionTable = Object.freeze({
  COMMIT_MOMENT_AND_LOCATE: commitMomentAndLocate,
  CHOOSE_LOCUS: chooseLocus,
});

/** Every Product transition the store can run: the T-02 kernel, the T-04 Map acts, the T-06 temporal acts. */
export const STORE_ACTION_TRANSITIONS: ActionTransitionTable = Object.freeze({
  ...KERNEL_ACTION_TRANSITIONS,
  ...MAP_ACTION_TRANSITIONS,
  ...TEMPORAL_ACTION_TRANSITIONS,
});

/** `LIVE_HEAD_ADVANCED`: monotonic `LH` mirror; retraction rejected; redelivery idempotent. */
const liveHeadAdvanced: EventTransition<Extract<AuthoritativeEvent, { type: 'LIVE_HEAD_ADVANCED' }>> = (state, event) => {
  if (!isSessionPosition(event.toSp)) {
    throw new PreconditionFailed('LIVE_HEAD_ADVANCED', `toSp must be a Session Position >= 1, got ${String(event.toSp)}`);
  }
  const lh = state.live.LH;
  if (lh !== null) {
    if (event.toSp < lh) {
      throw new RetractionRejected(`LIVE_HEAD_ADVANCED to ${event.toSp} below mirrored LH ${lh}: an established Moment is never retracted`);
    }
    if (event.toSp === lh) return state.live;
  }
  return { ...state.live, LH: event.toSp };
};

/** `LIVE_FOCUS_TRANSITION`: append-only, SP-anchored `LF` mirror; out-of-order or conflicting deliveries rejected. */
const liveFocusTransition: EventTransition<Extract<AuthoritativeEvent, { type: 'LIVE_FOCUS_TRANSITION' }>> = (state, event) => {
  if (!isLiveFocus(event.value)) {
    throw new PreconditionFailed('LIVE_FOCUS_TRANSITION', 'value must be NONE, EMERGING_FOCUS(id) or ESTABLISHED_THREAD(id)');
  }
  if (!isSessionPosition(event.atSp)) {
    throw new PreconditionFailed('LIVE_FOCUS_TRANSITION', `atSp must be a Session Position >= 1, got ${String(event.atSp)}`);
  }
  const current = state.live.LF;
  if (current.atSp !== null) {
    if (event.atSp < current.atSp) {
      throw new OutOfOrderTransition(`LIVE_FOCUS_TRANSITION at SP ${event.atSp} arrived after the mirrored transition at SP ${current.atSp}`);
    }
    if (event.atSp === current.atSp) {
      if (liveFocusEquals(event.value, current.value)) return state.live;
      throw new OutOfOrderTransition(`LIVE_FOCUS_TRANSITION at SP ${event.atSp} conflicts with the mirrored value at the same SP (exactly one effective LF per SP)`);
    }
  }
  return { ...state.live, LF: { value: event.value, atSp: event.atSp } };
};

export const KERNEL_EVENT_TRANSITIONS: EventTransitionTable = Object.freeze({
  LIVE_HEAD_ADVANCED: liveHeadAdvanced,
  LIVE_FOCUS_TRANSITION: liveFocusTransition,
});
