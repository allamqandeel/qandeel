/**
 * T-07 — the executors of the six promoted return acts, and the runtime authority that lets them
 * reach canonical state at all.
 *
 * The pattern is T-04's and T-06's, with a third, independent set — and, deliberately, in the same
 * shape: the authorization set, the action constructor, the mint and every executor live in ONE
 * module, and none of the first three is exported. `runReturnPlan` is a module-local function
 * declaration, so there is no deep import, no test seam and no future consumer that can reach the
 * mint at all. What crosses this module's boundary is `RETURN_ACTION_AUTHORITY`, which can only
 * ANSWER about an action, and the six public executors, each of which carries the frozen semantics
 * of its own act — Preview precedence, one-shot binding, target provenance, canonical World target.
 *
 * The store holds the verifier and nothing else: it cannot create an authorization, and it never
 * learns a locatability, disclosure, focus or history rule.
 *
 * The check is object identity in a `WeakSet`, consumed on use. A structurally perfect copy is a
 * different object and is refused; a leaked granted action cannot be replayed; a `true` flag, a
 * string token or a TypeScript brand buys nothing, because none of them is in the set. The Map and
 * temporal owners' authorities are DIFFERENT sets, so no owner's mint can satisfy another's seam.
 *
 * ## Freshness comes before meaning
 *
 * A disclosed projection is authority for exactly the viewpoint it was disclosed for. That matters
 * twice, in two different ways, and both are enforced here:
 *
 *   BEFORE any semantic question is asked of a context, `requireCurrentContext` proves the context
 *   IS this act's viewpoint. Without that, a stale, foreign-Session, wrong-position or wrong-depth
 *   scene that simply does not happen to contain the bound referent would escape as a semantic
 *   "not disclosed here" or "has no place here" — a statement about the world derived from a
 *   projection of somewhere else. Staleness is a fact about the client; it is never evidence.
 *
 *   AT authorization, `runReturnPlan` proves it again, because the viewpoint can move between the
 *   two: a Live Head advance under `FOLLOW_LIVE`, or a committed temporal change, retires the scene
 *   the landing was resolved from. A landing may only be dispatched from a projection that is still
 *   the arriving viewpoint's.
 *
 * The rule itself is T-04's ONE shared `mapContextFreshness`, called in exactly one place here and
 * never re-implemented. `postActState` builds the arriving viewpoint as a read-only hypothetical —
 * never published, never stored, differing from real state in `TM` alone, and only for the one act
 * that establishes `FOLLOW_LIVE` while carrying a landing. `RETURN_LIVE_FOCUS` writes no temporal
 * field, so the viewpoint it arrives at IS the current one and the rule reduces to T-04's.
 *
 * The other four acts carry no landing, so there is nothing to prove about a projection and nothing
 * is consulted: a temporal-only return, a World camera return and a history restoration are not
 * spatial entitlement questions.
 */
import {
  mapContextFreshness,
  mapProjectionRequest,
  initialCameraIntent,
  type MapInspectionContext,
  type MapProjectionRequest,
} from '../map';
import {
  type CameraIntent,
  type CanonicalState,
  type CanonicalStore,
  type LocateLanding,
  type ReturnAction,
  type ReturnActionAuthority,
  type RhEntry,
} from '../state';
import { resolveCheckpointTarget, type ReturnCheckpointTarget } from './checkpoint-target';
import { focusMapTarget, resolveFocusLanding, type ReturnMapContext } from './focus-target';
import {
  reportReturnDispatch,
  returnNoOp,
  returnRejected,
  withLocate,
  withNoOpReason,
  type ReturnLocateStatus,
  type ReturnOutcome,
} from './outcomes';
import { committedReturn, type ReturnSurface } from './surface';

const authorized = new WeakSet<ReturnAction>();

/**
 * A landing that has been resolved from ONE disclosed projection, travelling with the projection it
 * came from so the authorization can prove that projection is still the arriving viewpoint's.
 */
interface AuthorizedLanding {
  readonly to: LocateLanding;
  readonly context: MapInspectionContext;
}

/**
 * A fully resolved return act, before it is authorized. A plan is data: it names an identity and
 * carries exactly what that identity's frozen authority may write. It is not an action, it cannot be
 * dispatched, and it is unreachable from outside this module.
 */
type ReturnPlan =
  | { readonly act: 'RETURN_LIVE_HEAD' }
  | { readonly act: 'RETURN_LIVE_FOCUS'; readonly landing: AuthorizedLanding }
  | { readonly act: 'GO_LIVE_AND_LOCATE'; readonly landing: AuthorizedLanding | null }
  | { readonly act: 'RETURN_WORLD'; readonly camera: CameraIntent }
  | { readonly act: 'EXACT_RETURN'; readonly target: RhEntry }
  | { readonly act: 'BACK_ONE_STEP'; readonly target: RhEntry };

/** The two identities that carry a landing, and therefore the only two with a projection to prove. */
type ReturnLocatingAct = 'RETURN_LIVE_FOCUS' | 'GO_LIVE_AND_LOCATE';

/** The landing a plan carries, or `null` when the act is not a spatial one. */
function landingOf(plan: ReturnPlan): AuthorizedLanding | null {
  if (plan.act === 'RETURN_LIVE_FOCUS') return plan.landing;
  if (plan.act === 'GO_LIVE_AND_LOCATE') return plan.landing;
  return null;
}

/**
 * The canonical viewpoint an act arrives at. A read-only hypothetical, never published: only `TM`
 * can differ, and only for the one act that establishes `FOLLOW_LIVE` while carrying a landing.
 */
function postActState(state: CanonicalState, act: ReturnLocatingAct): CanonicalState {
  return act === 'GO_LIVE_AND_LOCATE' ? { ...state, temporal: { kind: 'FOLLOW_LIVE' } } : state;
}

/** THE freshness question, asked through T-04's one shared rule and in exactly one place here. */
function contextFreshness(store: CanonicalStore, act: ReturnLocatingAct, context: MapInspectionContext) {
  return mapContextFreshness(postActState(store.getState(), act), context);
}

type ContextAdmission = { readonly ok: true } | { readonly ok: false; readonly outcome: ReturnOutcome };

/**
 * Proves that a context IS the disclosed projection of the viewpoint this act arrives at, before
 * anything semantic is derived from it. A refusal is technical (`STALE_PROJECTION`) and is never
 * dressed up as a fact about the world.
 */
function requireCurrentContext(store: CanonicalStore, act: ReturnLocatingAct, context: MapInspectionContext): ContextAdmission {
  const freshness = contextFreshness(store, act, context);
  if (freshness.fresh) return { ok: true };
  return { ok: false, outcome: returnRejected('STALE_PROJECTION', `${freshness.reason}: ${freshness.detail}`) };
}

/** Builds the frozen action for a resolved plan. Six identities, six shapes, no shared payload. */
function buildAction(plan: ReturnPlan): ReturnAction {
  switch (plan.act) {
    case 'RETURN_LIVE_HEAD':
      return { type: 'RETURN_LIVE_HEAD' };
    case 'RETURN_LIVE_FOCUS':
      return { type: 'RETURN_LIVE_FOCUS', to: plan.landing.to };
    case 'GO_LIVE_AND_LOCATE':
      return plan.landing === null ? { type: 'GO_LIVE_AND_LOCATE' } : { type: 'GO_LIVE_AND_LOCATE', to: plan.landing.to };
    case 'RETURN_WORLD':
      return { type: 'RETURN_WORLD', to: plan.camera };
    case 'EXACT_RETURN':
      return { type: 'EXACT_RETURN', target: plan.target };
    case 'BACK_ONE_STEP':
      return { type: 'BACK_ONE_STEP', target: plan.target };
    default: {
      const exhaustive: never = plan;
      return exhaustive;
    }
  }
}

/** The verifier the canonical store is constructed with. It can answer; it can never create. */
export const RETURN_ACTION_AUTHORITY: ReturnActionAuthority = Object.freeze({
  consume(action: ReturnAction): boolean {
    if (action === null || typeof action !== 'object') return false;
    if (!authorized.has(action)) return false;
    authorized.delete(action);
    return true;
  },
});

/**
 * Authorizes ONE act, once, and dispatches it — and only while any landing it carries still comes
 * from the projection of the viewpoint the act arrives at.
 *
 * This is the whole executable seam of the layer, and it is module-local: the only `authorized.add`,
 * the only construction of a return action, and the only call of the canonical return dispatch. All
 * six acts reach canonical state through this one function, and nothing outside this module can
 * call it, import it or reproduce it.
 */
function runReturnPlan(store: CanonicalStore, plan: ReturnPlan): ReturnOutcome {
  const landing = landingOf(plan);
  if (landing !== null) {
    const admitted = requireCurrentContext(store, plan.act as ReturnLocatingAct, landing.context);
    if (!admitted.ok) return admitted.outcome;
  }
  const action = buildAction(plan);
  Object.freeze(action);
  authorized.add(action);
  return reportReturnDispatch(store, () => store.dispatchReturn(action));
}

// ------------------------------------------------------------------------------------------
// RETURN_LIVE_HEAD (P4) — temporal only
// ------------------------------------------------------------------------------------------

/**
 * Frozen result:
 *
 *     TM := FOLLOW_LIVE
 *     effective TC := the authoritative current Live Head, by derivation
 *
 * `IF_ref`, `MC`, `LH` and `LF` are all preserved directly. Historical projection re-resolves only
 * because the effective `TC` changed; this act itself moves no camera and inspects nothing, which is
 * exactly why its frozen authority is `TM` alone.
 *
 * When the reader is historical it is effective and appends exactly ONE checkpoint capturing the
 * complete pre-act historical viewpoint, so one Back afterwards restores that exact position,
 * inspection, camera and depth. When the reader is already following Live it is a true no-op that
 * records nothing — an answer derived by the store from `Φ_eff` over the SAME live truth on both
 * sides of the transition, so a Live Head that advances while the act is in flight cannot be
 * attributed to it. There is no activation snapshot here to compare against a later settled state.
 */
export function returnLiveHead(surface: ReturnSurface): ReturnOutcome {
  return committedReturn(surface, (store) => withNoOpReason(runReturnPlan(store, { act: 'RETURN_LIVE_HEAD' }), 'ALREADY_FOLLOWING_LIVE'));
}

// ------------------------------------------------------------------------------------------
// RETURN_LIVE_FOCUS (D1) — one-shot return to where live attention is
// ------------------------------------------------------------------------------------------

export interface ReturnLiveFocusRequest {
  /**
   * The disclosed projection of the viewpoint the reader is standing on. It is proven to BE that
   * viewpoint's projection before any question is asked of it, and proven again before anything is
   * written; a stale one authorizes nothing and explains nothing.
   */
  readonly context: MapInspectionContext;
}

/**
 * The whole act is spatial. `TM` is not written, the effective `TC` does not move, and `LF` itself is
 * never changed: this is a camera move to where the live conversation currently is, made once, from
 * wherever the reader is standing.
 *
 * At explicit activation the referent is bound ONCE (`LF* := LF at activation`). `LF*` is transient
 * and act-local: it has no key in canonical state, it is not recorded in RH, it is not a temporal
 * mode, and it creates no persistent follow. A later Live Focus transition does not retarget this
 * act, and reaching the live focus once does not mean tracking it; a later explicit activation binds
 * the then-current referent, which is a different act.
 *
 * Reading `LF` at settle instead would be a different Product act: the reader asked to go where
 * attention WAS when they asked, and chasing a newer referent would move them somewhere they never
 * chose. So if the bound referent has no legitimate place here, the camera does not move at all —
 * there is no fallback to the newer focus, and none to anything else.
 *
 * A Thread that exists only later is not disclosed at a historical position, so it is refused rather
 * than located, and no future Home, direction, distance or count reaches the reader through this act.
 */
export function returnLiveFocus(surface: ReturnSurface, request: ReturnLiveFocusRequest): ReturnOutcome {
  return committedReturn(surface, (store) => {
    // D1: bound ONCE, here, at explicit activation. Nothing later in this function re-reads `LF`.
    const bound = focusMapTarget(store.getState().live.LF.value);
    if (bound === null) return returnNoOp('NO_LEGITIMATE_LANDING', 'NO_FOCUS');

    // Freshness BEFORE meaning: a scene that is not this viewpoint's cannot be read as evidence
    // that the bound referent is undisclosed or ungeographic.
    const admitted = requireCurrentContext(store, 'RETURN_LIVE_FOCUS', request.context);
    if (!admitted.ok) return admitted.outcome;

    const landing = resolveFocusLanding(request.context, bound);
    if (landing.status === 'NO_LANDING') return returnNoOp('NO_LEGITIMATE_LANDING', landing.locate);

    const outcome = runReturnPlan(store, { act: 'RETURN_LIVE_FOCUS', landing: { to: landing.to, context: request.context } });
    // A no-op here means the camera is already at the exact entitled landing: nothing moved, and
    // nothing was recorded, which is the frozen answer rather than a redundant checkpoint.
    return withLocate(outcome, outcome.outcome === 'NO_OP' ? 'ALREADY_THERE' : 'LANDED');
  });
}

// ------------------------------------------------------------------------------------------
// GO_LIVE_AND_LOCATE (P5) — go Live and land once, as ONE Product act
// ------------------------------------------------------------------------------------------

export interface GoLiveAndLocateRequest {
  /**
   * Resolves the disclosed projection of the LIVE viewpoint. It is called at the post-live boundary,
   * AFTER the referent has been bound, so a provider that has to reach for a disclosure cannot
   * retarget the act; whatever it returns is proven to be the live viewpoint's projection before any
   * question is asked of it, and proven again before anything is written.
   */
  readonly liveContext: (request: MapProjectionRequest) => ReturnMapContext;
}

/**
 * Frozen sequence:
 *
 *     activation
 *       → establish FOLLOW_LIVE as the temporal sub-effect
 *       → resolve the authoritative Live Head
 *       → at the logical post-live boundary bind ONCE:  P5_LF* := LF at that boundary
 *       → locate once iff the bound referent is legitimately locatable at K(LH)
 *
 * `P5_LF*` is transient and act-local: it is a local constant for the length of this function, and
 * there is nowhere else in the layer it could be kept.
 *
 * The binding is at the post-live boundary because P5 is "go live, and take me to where live
 * attention is" — not "return to where attention was when I asked". A transition that arrives
 * between activation and that boundary is bound; one that arrives after it is not, because nothing
 * below re-reads `LF`.
 *
 * ## Atomicity
 *
 * There is exactly ONE canonical dispatch. The temporal effect is never published first and then
 * followed by a camera act: that would leave an intermediate committed state that never happened, an
 * extra RH checkpoint, and a Back that stops halfway. The post-live viewpoint is computed as a local
 * hypothetical, used to ask for the live projection and to prove the landing against, and then the
 * whole act — temporal and spatial together — is dispatched once. One Back after an effective P5
 * therefore restores the complete pre-P5 viewpoint.
 *
 * ## When the spatial part cannot happen
 *
 * A bound referent that is `NONE`, undisclosed at the Live viewpoint, ungeographic or ambiguous
 * leaves the temporal Live return standing alone — still ONE act, still one checkpoint when it is
 * effective. So does a live projection the client does not hold, and so does a live scene that is
 * not (or is no longer) the Live viewpoint's. A delivery failure and a stale scene are technical
 * facts: neither may become a fabricated semantic claim that there is nowhere to go, and neither
 * invents a camera movement.
 */
export function goLiveAndLocate(surface: ReturnSurface, request: GoLiveAndLocateRequest): ReturnOutcome {
  return committedReturn(surface, (store) => {
    const atBoundary = store.getState();
    if (atBoundary.live.LH === null) {
      return returnRejected('NO_ADDRESSABLE_POSITION', 'no authoritative committed Session Position has been mirrored (LH = null); there is no Live Head to return to');
    }
    // The hypothetical post-live viewpoint. Never published, never stored, never observable: it
    // exists so the LIVE projection can be asked for, and proven current, before the one dispatch.
    const postLive: CanonicalState = { ...atBoundary, temporal: { kind: 'FOLLOW_LIVE' } };
    const projectionRequest = mapProjectionRequest(postLive);
    if (projectionRequest === null) {
      return returnRejected('NO_ADDRESSABLE_POSITION', 'the live viewpoint has no addressable Session Position');
    }
    // AMB-01: bound exactly ONCE, here, at the logical post-live boundary. Nothing below re-reads it.
    const bound = focusMapTarget(atBoundary.live.LF.value);

    /** The temporal return alone, still as ONE composite act. Used wherever the landing cannot be. */
    const temporalOnly = (locate: ReturnLocateStatus): ReturnOutcome =>
      withLocate(runReturnPlan(store, { act: 'GO_LIVE_AND_LOCATE', landing: null }), locate);

    if (bound === null) return temporalOnly('NO_FOCUS');

    const live = request.liveContext(projectionRequest);
    if (!live.ok) return temporalOnly('PROJECTION_NOT_AVAILABLE');

    // Freshness BEFORE meaning, exactly as in D1: a scene that is not the live viewpoint's cannot be
    // read as evidence about the bound referent.
    const admitted = requireCurrentContext(store, 'GO_LIVE_AND_LOCATE', live.context);
    if (!admitted.ok) return temporalOnly('STALE_PROJECTION');

    const landing = resolveFocusLanding(live.context, bound);
    if (landing.status === 'NO_LANDING') return temporalOnly(landing.locate);

    const located = runReturnPlan(store, { act: 'GO_LIVE_AND_LOCATE', landing: { to: landing.to, context: live.context } });
    if (located.outcome === 'REJECTED' && located.code === 'STALE_PROJECTION') {
      // The live viewpoint moved between the landing being resolved and the act being authorized, so
      // that scene is no longer this Map. Nothing was dispatched there, so this is still exactly one
      // transaction — the temporal one — and no camera movement is invented from a retired scene.
      return temporalOnly('STALE_PROJECTION');
    }
    return withLocate(located, located.outcome === 'NO_OP' ? 'ALREADY_THERE' : 'LANDED');
  });
}

// ------------------------------------------------------------------------------------------
// RETURN_WORLD — the existing canonical World / Z0 camera target
// ------------------------------------------------------------------------------------------

/**
 * Frozen result: same `TM`, same effective `TC`, same `K(TC)`, World/Z0 camera orientation.
 *
 * The reader does not move in time and does not go Live. The inspection reference is NOT erased
 * merely because the World rung will withhold its render: `IF_ref` is the exact thing the reader
 * asked for, it survives the depth change, and whether it can be rendered at the World rung is
 * historical projection's answer, given afterwards.
 *
 * The camera it returns to is the existing canonical Map target and is never composed here: the
 * world origin, the canonical orientation, the default presentation scale, the `WORLD` rung and no
 * destination. Nothing is fitted to what happens to be visible, nothing is recentred on an
 * "important" object, and no second World camera exists to disagree with the first. If the camera is
 * already exactly that, the act is a true no-op and records nothing.
 */
export function returnWorld(surface: ReturnSurface): ReturnOutcome {
  return committedReturn(surface, (store) =>
    withNoOpReason(runReturnPlan(store, { act: 'RETURN_WORLD', camera: initialCameraIntent() }), 'ALREADY_AT_WORLD_CAMERA'),
  );
}

// ------------------------------------------------------------------------------------------
// BACK_ONE_STEP (P8) and EXACT_RETURN (P7) — the only two acts that reduce RH
// ------------------------------------------------------------------------------------------

/**
 * Back reverses the latest effective user-visible transaction, exactly once, and appends nothing.
 *
 * With an empty history nothing at all happens — no state mutation, no refusal dressed up as an act.
 * The target is taken from the store's own current history here, so Back needs no handle from a
 * caller and no caller-supplied payload can influence which step it reverses.
 */
export function backOneStep(surface: ReturnSurface): ReturnOutcome {
  return committedReturn(surface, (store) => {
    const history = store.getState().history;
    if (history.length === 0) return returnNoOp('EMPTY_HISTORY', 'NOT_ATTEMPTED');
    return runReturnPlan(store, { act: 'BACK_ONE_STEP', target: history[history.length - 1] });
  });
}

/**
 * Exact Return restores the named checkpoint and consumes it together with every newer entry, so the
 * restored viewpoint does not linger as a redundant Back step. It appends nothing.
 *
 * A target that is absent, stale, forged, copied or already consumed is refused with the state and
 * the history left object-equivalent — proven here by provenance, and again independently by the
 * store, which locates the entry OBJECT in its own current history before writing anything.
 */
export function exactReturn(surface: ReturnSurface, target: ReturnCheckpointTarget): ReturnOutcome {
  return committedReturn(surface, (store) => {
    const resolved = resolveCheckpointTarget(store, target);
    if (!resolved.ok) return returnRejected(resolved.code, resolved.detail);
    return runReturnPlan(store, { act: 'EXACT_RETURN', target: resolved.entry });
  });
}

// ------------------------------------------------------------------------------------------
// Whether a Return to Live Focus has anywhere to go, right now
// ------------------------------------------------------------------------------------------

/**
 * `UNPROVEN` is not a weaker `UNAVAILABLE`: it says the supplied projection is not this viewpoint's,
 * so the question was never asked. `AVAILABLE` and `UNAVAILABLE` are answers about `K(TC)` — what
 * the reader's own current position discloses — and never about live truth relative to it.
 */
export type ReturnLiveFocusAvailability = { readonly status: 'AVAILABLE' | 'UNAVAILABLE' | 'UNPROVEN' };

/**
 * Whether `RETURN_LIVE_FOCUS` has a legitimate landing right now.
 *
 * It is deliberately NOT part of the state-only availability model. `LF != NONE` is live truth, and
 * from a historical position live truth is future-relative: answering from it would both overstate
 * the capability — a live Thread with no place at `K(TC)` is not a landing — and expose a bit about
 * a future object to a reader who may not have it. So the question can only be asked against a
 * disclosed projection that is PROVEN to be this viewpoint's, and is then answered by exactly the
 * same locatability substrate the act itself uses.
 *
 * It holds nothing: no cache, no token, no capability that could outlive its justification. It
 * names nothing either — no identity, label, Home, direction, distance, locus or count.
 */
export function liveFocusReturnAvailability(store: CanonicalStore, context: MapInspectionContext): ReturnLiveFocusAvailability {
  // Freshness first, exactly as in the act: an unproven projection yields no answer at all, not even
  // about whether a Live Focus exists.
  const admitted = requireCurrentContext(store, 'RETURN_LIVE_FOCUS', context);
  if (!admitted.ok) return { status: 'UNPROVEN' };
  const bound = focusMapTarget(store.getState().live.LF.value);
  if (bound === null) return { status: 'UNAVAILABLE' };
  return resolveFocusLanding(context, bound).status === 'LANDING' ? { status: 'AVAILABLE' } : { status: 'UNAVAILABLE' };
}
