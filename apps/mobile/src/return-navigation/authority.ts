/**
 * T-07 — the runtime authority that lets a return act reach canonical state at all, and the ONE
 * place a return action object is built, authorized and dispatched.
 *
 * The pattern is T-04's and T-06's, with a third, independent set. `mint` is a module-local
 * function: declared here, called only by the single authorization function here, exported nowhere.
 * The only way an action object can enter the authorization set is by being CONSTRUCTED a few lines
 * below from a resolved plan — and because the constructed action never leaves this module (the
 * dispatch happens here too), no sibling can hold a granted act, keep one, copy one or replay one.
 *
 * What crosses the module boundary is `RETURN_ACTION_AUTHORITY`, which can only ANSWER about an
 * action, never mint one. The store holds that verifier and nothing else: it cannot create an
 * authorization, and it never learns a locatability, disclosure, focus or history rule.
 *
 * The check is object identity in a `WeakSet`, consumed on use. A structurally perfect copy is a
 * different object and is refused; a leaked granted action cannot be replayed; a `true` flag, a
 * string token or a TypeScript brand buys nothing, because none of them is in the set. The Map and
 * temporal owners' authorities are DIFFERENT sets, so no owner's mint can satisfy another's seam.
 *
 * ## The authorization rule, and why it is the post-act one
 *
 * A landing is authority for exactly the viewpoint it was disclosed for. `RETURN_LIVE_FOCUS` writes
 * no temporal field, so the viewpoint it arrives at IS the current one and the rule reduces to
 * T-04's. `GO_LIVE_AND_LOCATE` moves the reader to the Live Head, so requiring the landing to have
 * come from the CURRENT projection would be exactly backwards: it would force the landing to be
 * resolved at the position being left, which is how hindsight enters a locate. `postActState` builds
 * the arriving viewpoint as a read-only hypothetical — never published, never stored, differing from
 * real state in `TM` alone — and `mapContextFreshness`, T-04's ONE shared rule, answers.
 *
 * The other four acts carry no landing, so there is nothing to prove about a projection and nothing
 * is consulted: a temporal-only return, a World camera return and a history restoration are not
 * spatial entitlement questions.
 */
import {
  type CameraIntent,
  type CanonicalState,
  type CanonicalStore,
  type LocateLanding,
  type ReturnAction,
  type ReturnActionAuthority,
  type RhEntry,
} from '../state';
import { mapContextFreshness, type MapInspectionContext } from '../map';
import { dispatchAuthorizedReturnAction, returnRejected, type ReturnOutcome } from './outcomes';

const authorized = new WeakSet<ReturnAction>();

/**
 * A landing that has been resolved from ONE disclosed projection, travelling with the projection it
 * came from so the authorization can prove that projection is the arriving viewpoint's.
 */
export interface AuthorizedLanding {
  readonly to: LocateLanding;
  readonly context: MapInspectionContext;
}

/**
 * A fully resolved return act, before it is authorized. A plan is data: it names an identity and
 * carries exactly what that identity's frozen authority may write. It is not an action, it cannot be
 * dispatched, and building one grants nothing.
 */
export type ReturnPlan =
  | { readonly act: 'RETURN_LIVE_HEAD' }
  | { readonly act: 'RETURN_LIVE_FOCUS'; readonly landing: AuthorizedLanding }
  | { readonly act: 'GO_LIVE_AND_LOCATE'; readonly landing: AuthorizedLanding | null }
  | { readonly act: 'RETURN_WORLD'; readonly camera: CameraIntent }
  | { readonly act: 'EXACT_RETURN'; readonly target: RhEntry }
  | { readonly act: 'BACK_ONE_STEP'; readonly target: RhEntry };

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
function postActState(state: CanonicalState, plan: ReturnPlan): CanonicalState {
  return plan.act === 'GO_LIVE_AND_LOCATE' ? { ...state, temporal: { kind: 'FOLLOW_LIVE' } } : state;
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
 * Authorizes ONE act, once, and dispatches it — and only while any landing it carries came from the
 * projection of the viewpoint the act arrives at.
 *
 * This is the whole executable seam of the layer. It is the only `authorized.add` in the codebase's
 * return family, the only construction of a return action, and the only call of the canonical return
 * dispatch; every one of the six acts reaches canonical state through this one function and there is
 * no second path.
 */
export function runReturnPlan(store: CanonicalStore, plan: ReturnPlan): ReturnOutcome {
  const landing = landingOf(plan);
  if (landing !== null) {
    const current = mapContextFreshness(postActState(store.getState(), plan), landing.context);
    if (!current.fresh) return returnRejected('STALE_PROJECTION', `${current.reason}: ${current.detail}`);
  }
  const action = buildAction(plan);
  Object.freeze(action);
  authorized.add(action);
  return dispatchAuthorizedReturnAction(store, action);
}
