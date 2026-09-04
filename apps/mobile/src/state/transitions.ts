/**
 * T-02 — Executable kernel transitions.
 *
 * Action transitions return `ClientWritable` only: `live` (LH, LF) and `history` (RH) are
 * unreachable from a Product action at compile time. Event transitions return `LiveTruth`
 * only: `TM`, `IF_ref`, `MC` and `RH` are unreachable from a passive event. The runtime
 * per-field guard in `authority.ts` re-checks every result regardless.
 *
 * Preconditions throw before any state is produced. No transition performs gesture-to-world
 * mathematics, Preview handling, locate resolution or any later-owner semantics.
 */
import type { AuthoritativeEvent, KernelAction, KernelActionType } from './actions';
import { OutOfOrderTransition, PreconditionFailed, RetractionRejected } from './authority';
import {
  isLiveFocus,
  isOpaqueRefOfKind,
  isSemanticDepth,
  isSessionPosition,
  liveFocusEquals,
  type CameraIntent,
  type CanonicalState,
  type LiveTruth,
} from './classes';

export type ClientWritable = Pick<CanonicalState, 'temporal' | 'inspection' | 'camera'>;

export type ActionTransition<A extends KernelAction> = (state: CanonicalState, action: A) => ClientWritable;
export type EventTransition<E extends AuthoritativeEvent> = (state: CanonicalState, event: E) => LiveTruth;

export type ActionTransitionTable = {
  readonly [K in KernelActionType]: ActionTransition<Extract<KernelAction, { type: K }>>;
};
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

export const KERNEL_ACTION_TRANSITIONS: ActionTransitionTable = Object.freeze({
  PAN: pan,
  ZOOM_SEMANTIC: zoomSemantic,
  COMMIT_MOMENT: commitMoment,
  COMMIT_LIVE_EDGE: commitLiveEdge,
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
