/**
 * T-07 — Return Semantics + Reversible History Restoration: the six frozen return acts, executable.
 *
 * The canonical state kernel stays the only authority. This layer decides WHEN each act may run and
 * with what, from an explicit user act, and owns exactly the things around that moment: the runtime
 * return authority, the one-shot Live Focus bindings, the post-live composite, the World/Z0 return,
 * and the consumption of reversible history.
 *
 * The six stay SIX different Product acts, with different read-sets, write-sets, history rules and
 * target-binding rules. There is deliberately no `navigate()`, no `goHome()`, no `reset()`, no
 * `goLive()`, no `restore()` and no `backOrHome()`: a generic identity would make the differences
 * between them unstatable, and every one of those differences is frozen Product truth.
 *
 *   `RETURN_LIVE_HEAD`     temporal only; `TM := FOLLOW_LIVE`, camera and inspection untouched.
 *   `RETURN_LIVE_FOCUS`    spatial only; the referent is bound once at activation and never chased.
 *   `GO_LIVE_AND_LOCATE`   ONE composite act; the referent is bound once at the post-live boundary.
 *   `RETURN_WORLD`         spatial and depth only; the existing canonical World/Z0 camera target.
 *   `EXACT_RETURN`         restores a named recorded checkpoint and consumes it and everything newer.
 *   `BACK_ONE_STEP`        restores the latest recorded checkpoint and removes exactly it.
 *
 * Cross-cutting, and true of all six: a Preview is cancelled before the act is resolved; the act is
 * authorized by this layer's own runtime authority and by no other; every restoration is
 * `PINNED(capturedTC)`; no act writes `LH`, `LF` or the Session; no act appends and consumes;
 * no camera landing is authorized by a projection that is not the arriving viewpoint's; and no
 * result names a target, a place, a direction or a count.
 *
 * What this layer does NOT do: it stores no canonical field, adds no temporal mode, keeps no
 * `RETURNING` or `SETTLING` state, holds no return cursor or stack, persists nothing, fetches
 * nothing, builds no second Map disclosure or projection cache, implements no second locatability or
 * Live Focus resolver, mounts nothing, animates nothing, and writes no final chrome, copy, colour or
 * layout. It adds no dependency at all: every import is a relative module of this app.
 */
export type {
  ReturnLocateStatus,
  ReturnNoOpReason,
  ReturnOutcome,
  ReturnRejectionCode,
} from './outcomes';
export { returnNoOp, returnRejected } from './outcomes';

export type { ReturnSurface } from './surface';

export type { AuthorizedLanding, ReturnPlan } from './authority';
// Only the verifier crosses this boundary. `runReturnPlan` — the one place a return action is built,
// minted and dispatched — stays inside the layer on purpose: minting is not a public capability.
export { RETURN_ACTION_AUTHORITY } from './authority';

export type { FocusLanding, ReturnFocusTarget, ReturnMapContext } from './focus-target';
export { focusMapTarget, resolveFocusLanding, returnMapContext } from './focus-target';

export { returnLiveHead } from './live-head';

export type { ReturnLiveFocusRequest } from './live-focus';
export { returnLiveFocus } from './live-focus';

export type { GoLiveAndLocateRequest } from './go-live-and-locate';
export { goLiveAndLocate } from './go-live-and-locate';

export { returnWorld } from './return-world';

export type { ReturnCheckpointTarget } from './history-restoration';
export { backOneStep, exactReturn, isReturnCheckpointTarget, latestReturnCheckpoint, returnCheckpoints } from './history-restoration';

export type { ReturnAvailability } from './availability';
export { RETURN_ACT_IDS, returnAvailability } from './availability';
