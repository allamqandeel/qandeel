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
 * `PINNED(capturedTC)`; no act writes `LH`, `LF` or the Session; a projection is proven to be the
 * arriving viewpoint's BEFORE any semantic answer is derived from it and AGAIN before anything is
 * written; and no result names a target, a place, a direction or a count.
 *
 * This barrel is the layer's whole public surface, and it is an allowlist: the static contract pins
 * the exact set of names below, so nothing can drift back into it by accident.
 *
 * Two kinds of machinery are deliberately absent from it.
 *
 *   The authorization set, the plan types, the action constructor and the mint are not exported from
 *   any module of the layer, so no consumer — through this barrel or through a deep import — can
 *   build, authorize or dispatch a return act except by calling one of the six executors and
 *   accepting their frozen semantics.
 *
 *   The SEMANTIC focus resolver is not exported either. Turning a `MapInspectionContext` into
 *   entitlement and locatability meaning is only truthful once that context has been proven to be
 *   the viewpoint's, and that proof belongs to the acts. Exporting the resolver would let a later
 *   consumer hand it a stale, foreign-Session, wrong-position or wrong-depth context and read a
 *   semantic `NOT_ENTITLED` or `NOT_LOCATABLE` out of it — the freshness-before-meaning defect,
 *   recreated outside the six executors and around the safe capability query below.
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

// Only the TECHNICAL half of the projection seam is public. `returnMapContext` reads what the
// client already holds and answers with a usable context or a technical refusal; it can produce no
// semantic claim about the world at all. The semantic half — the Live Focus → Map target mapping and
// the landing resolution — stays internal, because it turns a context into entitlement and
// locatability MEANING, and doing that to a context nobody has proven current is exactly the defect
// the freshness gate exists to prevent. It is reachable only through the six executors and the one
// projection-bound capability query, each of which proves the context first.
export type { ReturnMapContext } from './focus-target';
export { returnMapContext } from './focus-target';

export type { ReturnCheckpointTarget } from './checkpoint-target';
export { isReturnCheckpointTarget, latestReturnCheckpoint, returnCheckpoints } from './checkpoint-target';

// The six executors, the verifier the store is constructed with, and the one capability question
// that can only be answered against a proven projection. The mint crosses no boundary at all.
export type { GoLiveAndLocateRequest, ReturnLiveFocusAvailability, ReturnLiveFocusRequest } from './return-actions';
export {
  RETURN_ACTION_AUTHORITY,
  backOneStep,
  exactReturn,
  goLiveAndLocate,
  liveFocusReturnAvailability,
  returnLiveFocus,
  returnLiveHead,
  returnWorld,
} from './return-actions';

export type { ReturnAvailability } from './availability';
export { RETURN_ACT_IDS, returnAvailability } from './availability';
