/**
 * T-06 — the executors of the two promoted temporal acts, and the runtime authority that lets them
 * reach canonical state at all.
 *
 * `grant` is a module-local function: declared here, used only by the two executors here, exported
 * nowhere. The ONLY way an action object can enter the authorization set is by being built a few
 * lines below, after the landing was resolved against a disclosed projection. What crosses the
 * module boundary is `TEMPORAL_ACTION_AUTHORITY`, which can only ANSWER about an action, never mint
 * one. The store holds that verifier and nothing else: it cannot mint an authorization, and it never
 * learns a disclosure or locatability rule, so no part of `V` is duplicated inside the kernel.
 *
 * The check is object identity in a `WeakSet`, consumed on use. A structurally perfect copy is a
 * different object and is refused; a leaked granted action cannot be replayed; a `true` flag, a
 * string token or a TypeScript brand buys nothing, because none of them is in the set. The Map
 * owner's authority is a DIFFERENT set, so neither owner's mint can satisfy the other's seam.
 *
 * ## The authorization rule, and why it is not T-04's
 *
 * A Map act is authorized while the projection it came from is the store's CURRENT one, because a
 * Map act does not move the temporal position. A composite temporal act does move it — that is the
 * point of it — so requiring the landing to have come from the current projection would be exactly
 * backwards: it would force the landing to be resolved at the position being LEFT, which is how
 * hindsight enters a locate.
 *
 * So the rule here is the same rule applied to the position the act ARRIVES at:
 *
 *     the landing's projection must be the projection of the canonical viewpoint this act commits
 *     to — its Session, its effective `TC`, its semantic depth
 *
 * `postActState` builds that viewpoint as a read-only hypothetical. It is never published, never
 * stored and never observable: it exists for the length of one comparison, and it can differ from
 * real state in exactly one field, because `TM` is the only Class-A field either act can move that
 * the projection tuple depends on. `mapContextFreshness` — T-04's ONE shared rule, unchanged and
 * not re-implemented — then answers the question, including the disclosure-and-scene coherence
 * check that a tuple alone cannot make.
 *
 * For `CHOOSE_LOCUS` the post-act viewpoint IS the current viewpoint, because a locus choice writes
 * no temporal field, so that act reduces to exactly T-04's rule with no special case at all.
 */
import {
  sessionPosition,
  type CanonicalState,
  type CanonicalStore,
  type LocateLanding,
  type SessionPosition,
  type TemporalAction,
  type TemporalActionAuthority,
} from '../../state';
import {
  mapContextFreshness,
  spatialDestinationRef,
  worldAnchorRef,
  type EntitledLocus,
  type MapInspectionContext,
} from '../../map';
import { dispatchAuthorizedTemporalAction, temporalRejected, type TemporalOutcome } from '../outcome';
import { resolveTemporalTarget, temporalBounds } from './addressability';
import { resolveLocateAtTarget, type TemporalLocateTarget } from './locate';

const authorized = new WeakSet<TemporalAction>();

type GrantRefusal = { readonly ok: false; readonly outcome: TemporalOutcome };
type Granted<A extends TemporalAction> = { readonly ok: true; readonly action: A };

/**
 * The canonical viewpoint an act commits to. A read-only hypothetical, never published: only `TM`
 * can differ, and only for the composite act, because `CHOOSE_LOCUS` writes no temporal field.
 */
function postActState(state: CanonicalState, action: TemporalAction): CanonicalState {
  return action.type === 'COMMIT_MOMENT_AND_LOCATE' ? { ...state, temporal: { kind: 'PINNED', at: action.moment } } : state;
}

/**
 * Authorizes ONE act, once — and only while the projection its landing came from is the projection
 * of the viewpoint that act commits to. Module-local by construction: nothing outside this file can
 * call it, so nothing outside this file can put an action into the authorization set, and the ONLY
 * `authorized.add` in the layer sits behind this check.
 */
function authorizeIfLandingMatchesPostAct<A extends TemporalAction>(
  store: CanonicalStore,
  context: MapInspectionContext,
  action: A,
): Granted<A> | GrantRefusal {
  const current = mapContextFreshness(postActState(store.getState(), action), context);
  if (!current.fresh) {
    return { ok: false, outcome: temporalRejected('STALE_PROJECTION', `${current.reason}: ${current.detail}`) };
  }
  Object.freeze(action);
  authorized.add(action);
  return { ok: true, action };
}

/**
 * The verifier the canonical store is constructed with. It can answer about an act and consume its
 * authorization; it cannot create one.
 */
export const TEMPORAL_ACTION_AUTHORITY: TemporalActionAuthority = Object.freeze({
  consume(action: TemporalAction): boolean {
    if (action === null || typeof action !== 'object') return false;
    if (!authorized.has(action)) return false;
    authorized.delete(action);
    return true;
  },
});

function landingFor(locus: EntitledLocus): LocateLanding {
  // Only the two references the frozen authority permits. No depth: neither act holds `MC.depth`,
  // so a locate can never become a semantic-zoom move.
  return Object.freeze({ anchor: worldAnchorRef(locus.anchor), destination: spatialDestinationRef(locus.destination) });
}

// ------------------------------------------------------------------------------------------
// COMMIT_MOMENT_AND_LOCATE — the one frozen exception where temporal movement and spatial locate
// are ONE Product act
// ------------------------------------------------------------------------------------------

export interface CommitMomentAndLocateRequest {
  /** The position this act commits to. Stated by the caller, then proven against the projection. */
  readonly moment: SessionPosition;
  /**
   * The disclosed projection OF THAT POSITION — never of the position being left. Everything about
   * the landing is derived from it, which is what keeps a composite locate free of hindsight.
   */
  readonly context: MapInspectionContext;
  readonly target: TemporalLocateTarget;
  /** An explicit contextual-locus choice. Required when the target has several legitimate loci. */
  readonly locus?: EntitledLocus;
}

export type CommitMomentAndLocateOutcome =
  | TemporalOutcome
  /**
   * The target has several legitimate loci at that position and the request named none. NOTHING
   * happened: no temporal move, no camera write, no RH entry, no partial commit. The frozen
   * contextual-locus choice runs and the composite act is re-issued with the chosen locus, so the
   * result is still ONE composite transaction — never a temporal commit followed by a pan.
   */
  | { readonly outcome: 'LOCUS_SELECTION_REQUIRED'; readonly moment: SessionPosition; readonly loci: readonly EntitledLocus[] };

export function commitMomentAndLocate(store: CanonicalStore, request: CommitMomentAndLocateRequest): CommitMomentAndLocateOutcome {
  const state = store.getState();
  const resolved = resolveTemporalTarget(temporalBounds(state), request.moment);
  if (!resolved.ok) return temporalRejected(resolved.code, resolved.detail);

  // The caller's stated destination and the projection the landing will come from must be the same
  // position. Without this the act would silently commit to whatever position a stale context
  // happened to describe, and the authorization below could never notice.
  if (request.context.scene.tc !== resolved.sp) {
    return temporalRejected(
      'STALE_PROJECTION',
      `the landing was resolved at Session Position ${request.context.scene.tc}, but this act commits to ${resolved.sp}`,
    );
  }

  const located = resolveLocateAtTarget(request.context, request.target, request.locus);
  if (located.outcome === 'REJECTED') return temporalRejected(located.code, located.detail);
  if (located.outcome === 'LOCUS_SELECTION_REQUIRED') {
    // No silent selection: no primary context, no Live Focus heuristic, no nearest geometry, no
    // first row, no last used. Nothing is written and nothing is recorded until a choice exists.
    return { outcome: 'LOCUS_SELECTION_REQUIRED', moment: resolved.sp, loci: located.loci };
  }

  const granted = authorizeIfLandingMatchesPostAct(store, request.context, {
    type: 'COMMIT_MOMENT_AND_LOCATE',
    moment: resolved.sp,
    to: landingFor(located.locus),
  });
  if (!granted.ok) return granted.outcome;
  return dispatchAuthorizedTemporalAction(store, granted.action);
}

// ------------------------------------------------------------------------------------------
// CHOOSE_LOCUS — resolving an already-legitimate contextual-location choice
// ------------------------------------------------------------------------------------------

export interface ChooseLocusRequest {
  /** The projection of the position the reader is standing on; this act moves nobody in time. */
  readonly context: MapInspectionContext;
  readonly target: TemporalLocateTarget;
  /** Mandatory: a choice that was not made is not a choice, and nothing here elects one. */
  readonly locus: EntitledLocus;
}

/**
 * Resolves a contextual-location choice. It writes the spatial landing and nothing else: it changes
 * no canonical identity, invents no preferred Thread, ranks no contextual appearance, creates no
 * geometry from proximity, and — because the frozen authority of this act excludes `TM` and the
 * transition carries the temporal mode through unchanged — it cannot become a temporal move.
 */
export function chooseLocus(store: CanonicalStore, request: ChooseLocusRequest): TemporalOutcome {
  if (request === null || typeof request !== 'object' || request.locus === undefined) {
    return temporalRejected('INVALID_INPUT', 'a contextual-locus choice names the locus it chooses');
  }
  const located = resolveLocateAtTarget(request.context, request.target, request.locus);
  if (located.outcome === 'REJECTED') return temporalRejected(located.code, located.detail);
  if (located.outcome === 'LOCUS_SELECTION_REQUIRED') {
    return temporalRejected('INVALID_INPUT', 'a contextual-locus choice names the locus it chooses');
  }

  const granted = authorizeIfLandingMatchesPostAct(store, request.context, { type: 'CHOOSE_LOCUS', to: landingFor(located.locus) });
  if (!granted.ok) return granted.outcome;
  return dispatchAuthorizedTemporalAction(store, granted.action);
}

/** The Session Position a disclosed projection describes, as an addressable target. */
export function projectionMoment(context: MapInspectionContext): SessionPosition {
  return sessionPosition(context.scene.tc);
}
