/**
 * T-04 — the executors of the three promoted Map acts, and the runtime authority that lets them
 * reach canonical state at all (R1-01).
 *
 * Each one resolves entitlement against the disclosed projection `V` first and dispatches
 * through the existing canonical store second. There is no third path: no direct write, no
 * parallel navigation store, no generic `navigate()`, and nothing that could reach `TM`, `TC` or
 * `LF` — the frozen per-field authority of these acts is `IF_ref` for inspection and context
 * switching, and `IF_ref` plus the camera fields for a direct jump.
 *
 * The authority below closes the raw-dispatch bypass. `grant` is a module-local function: it is
 * declared here, used only by the three executors here, and exported nowhere, so the ONLY way an
 * action object can enter the authorization set is by being built a few lines below — after
 * `resolveEntitledInspection` admitted it against the current disclosed `V`. What crosses the
 * module boundary is `MAP_ACTION_AUTHORITY`, which can only ANSWER about an action, never mint
 * one. The store holds that verifier and nothing else: it cannot mint an authorization, and it
 * never learns an entitlement rule, so no part of `V` is duplicated inside the kernel.
 *
 * The check is object identity in a `WeakSet`, consumed on use. A structurally perfect copy is a
 * different object and is refused; a leaked granted action cannot be replayed; a `true` flag, a
 * string token or a TypeScript brand buys nothing, because none of them is in the set.
 *
 *   INSPECT_OBJECT  `IF_ref := the exact requested reference`. No temporal movement, no camera
 *                   movement at all: an ordinary inspection never smuggles a locate.
 *   SWITCH_CONTEXT  the same canonical identity through another disclosed appearance. A context
 *                   unavailable at `TC` fails closed; nothing is elected in its place.
 *   DIRECT_JUMP     the exact reference, the semantic depth and the camera intent needed to land
 *                   in ONE identified contextual locus — as one transaction, therefore one RH
 *                   checkpoint. When the target has several legitimate loci and the request
 *                   names none, nothing at all happens: no primary context is chosen, the Live
 *                   Focus is not consulted, geometry is not consulted, the first row is not
 *                   taken, no Class-A field is written and no RH entry is appended.
 */
import type { HistoricalDisclosure } from '@qandeel/runtime';

import type { CanonicalStore, MapAction, MapActionAuthority, SemanticDepth } from '../../state';
import type { HistoricalDisclosureEntry } from '../../projection';
import { worldAnchorRef, spatialDestinationRef } from '../world';
import {
  deriveMapScene,
  mapContextFreshness,
  projectionTupleFreshness,
  type DisclosedProjectionContext,
  type DisclosedProjectionTuple,
  type MapObjectFamily,
  type MapProjectionRequest,
  type MapScene,
  type MapSceneDerivation,
} from '../projection';
import { dispatchAuthorizedMapAction, rejected, type MapActionOutcome } from '../outcome';
import {
  isEntitledInspection,
  resolveEntitledInspection,
  type EntitledInspection,
  type InspectionRequest,
} from './entitlement';
import { entitledLoci, isEntitledLocus, locusForBinding, resolveLocatability, type EntitledLocus } from './locatability';

/**
 * One disclosed projection, seen two ways: as the entitlement source for references and as the
 * geography of the Map. Both come from the SAME `V`, so the visual Map, hit testing, the
 * accessible tree and every act agree about what exists by construction.
 */
export interface MapInspectionContext extends DisclosedProjectionContext {
  readonly disclosure: HistoricalDisclosure;
  readonly scene: MapScene;
}

/**
 * Whether this context still represents the store's current `(Session, effective TC, MC.depth)`.
 * It is the one shared rule (`mapContextFreshness`) and nothing else: every surface and every act
 * in T-04 asks exactly this, so they cannot disagree about whether the Map is current.
 */
export function isCurrentMapContext(store: CanonicalStore, context: MapInspectionContext) {
  return mapContextFreshness(store.getState(), context);
}

function staleOutcome(store: CanonicalStore, context: MapInspectionContext): MapActionOutcome | null {
  const freshness = isCurrentMapContext(store, context);
  return freshness.fresh ? null : rejected('STALE_PROJECTION', `${freshness.reason}: ${freshness.detail}`);
}

export type MapContextResolution =
  | { readonly ok: true; readonly context: MapInspectionContext }
  | { readonly ok: false; readonly derivation: MapSceneDerivation };

export function mapInspectionContext(entry: HistoricalDisclosureEntry, request: MapProjectionRequest): MapContextResolution {
  const derivation = deriveMapScene(entry, request);
  if (derivation.status !== 'SCENE' || entry.status !== 'FETCHED') return { ok: false, derivation };
  return { ok: true, context: { disclosure: entry.value, scene: derivation.scene } };
}

// ------------------------------------------------------------------------------------------
// The runtime authorization boundary (R1-01)
// ------------------------------------------------------------------------------------------

const authorized = new WeakSet<MapAction>();

export type GrantRefusal = { readonly ok: false; readonly outcome: MapActionOutcome };
export type Granted<A extends MapAction> = { readonly ok: true; readonly action: A };

/**
 * Authorizes ONE act, once — and only while the projection it was resolved from is still the
 * store's current one (R2-01). Module-local by construction: nothing outside this file can call
 * it, so nothing outside this file can put an action into the authorization set, and the ONLY
 * `authorized.add` in the codebase sits behind this freshness check. Every call site is a few
 * lines below, downstream of `resolveEntitledInspection`.
 *
 * The two conditions are deliberately fused: R1 proves the act came from the T-04 executors, and
 * R2 proves the `V` those executors used is still the `V` for this canonical state. Neither alone
 * is authority.
 */
function authorizeIfProjectionCurrent<A extends MapAction>(
  store: CanonicalStore,
  tuple: DisclosedProjectionTuple,
  action: A,
): Granted<A> | GrantRefusal {
  const freshness = projectionTupleFreshness(store.getState(), tuple);
  if (!freshness.fresh) {
    return { ok: false, outcome: rejected('STALE_PROJECTION', `${freshness.reason}: ${freshness.detail}`) };
  }
  Object.freeze(action);
  authorized.add(action);
  return { ok: true, action };
}

/**
 * The verifier the canonical store is constructed with. It can answer about an act and consume
 * its authorization; it cannot create one.
 */
export const MAP_ACTION_AUTHORITY: MapActionAuthority = Object.freeze({
  consume(action: MapAction): boolean {
    if (action === null || typeof action !== 'object') return false;
    if (!authorized.has(action)) return false;
    authorized.delete(action);
    return true;
  },
});

/** The Map families that carry geography. Every other disclosed family is inspectable, not placed. */
const MAP_FAMILY: Partial<Record<string, MapObjectFamily>> = { THREAD: 'THREAD', READING: 'READING', EMERGING_FOCUS: 'EMERGING_FOCUS' };

function mapFamilyOf(entitled: EntitledInspection): MapObjectFamily | null {
  return MAP_FAMILY[entitled.family] ?? null;
}

// ------------------------------------------------------------------------------------------
// INSPECT_OBJECT
// ------------------------------------------------------------------------------------------

/**
 * Inspects an already-entitled target. The brand makes a forged entitlement unusable, and the
 * entitlement's own projection tuple makes a stale one unusable — including on this shortcut,
 * which never sees a context.
 */
export function inspectEntitled(store: CanonicalStore, entitled: EntitledInspection): MapActionOutcome {
  if (!isEntitledInspection(entitled)) {
    return rejected('NOT_ENTITLED', 'the inspection target was not resolved against a disclosed projection');
  }
  const granted = authorizeIfProjectionCurrent(store, entitled.projection, { type: 'INSPECT_OBJECT', ref: entitled.ref });
  if (!granted.ok) return granted.outcome;
  return dispatchAuthorizedMapAction(store, granted.action);
}

export function inspectObject(store: CanonicalStore, context: MapInspectionContext, request: InspectionRequest): MapActionOutcome {
  const stale = staleOutcome(store, context);
  if (stale !== null) return stale;
  const resolution = resolveEntitledInspection(context.disclosure, request);
  if (!resolution.ok) return rejected('NOT_ENTITLED', `${resolution.reason}: ${resolution.detail}`);
  return inspectEntitled(store, resolution.entitled);
}

// ------------------------------------------------------------------------------------------
// SWITCH_CONTEXT
// ------------------------------------------------------------------------------------------

export function switchContextEntitled(store: CanonicalStore, entitled: EntitledInspection): MapActionOutcome {
  if (!isEntitledInspection(entitled)) {
    return rejected('NOT_ENTITLED', 'the context switch target was not resolved against a disclosed projection');
  }
  if (entitled.appearance === null) {
    return rejected('INVALID_INPUT', 'a context switch names the contextual appearance it switches to');
  }
  const granted = authorizeIfProjectionCurrent(store, entitled.projection, { type: 'SWITCH_CONTEXT', ref: entitled.ref });
  if (!granted.ok) return granted.outcome;
  return dispatchAuthorizedMapAction(store, granted.action);
}

/**
 * Switches to another legitimate appearance of the SAME canonical object. The canonical identity
 * is not re-elected here: the kernel refuses a reference whose identity differs from the current
 * inspection, so a "switch" can never become a second object.
 */
export function switchContext(store: CanonicalStore, context: MapInspectionContext, request: InspectionRequest): MapActionOutcome {
  const stale = staleOutcome(store, context);
  if (stale !== null) return stale;
  if (request?.appearance === undefined) {
    return rejected('INVALID_INPUT', 'a context switch names the contextual appearance it switches to');
  }
  const resolution = resolveEntitledInspection(context.disclosure, request);
  if (!resolution.ok) return rejected('NOT_ENTITLED', `${resolution.reason}: ${resolution.detail}`);
  return switchContextEntitled(store, resolution.entitled);
}

/** Every legitimate appearance of a canonical identity, for a chooser owned by a later task. */
export function disclosedAppearances(context: MapInspectionContext, family: MapObjectFamily, id: string): readonly EntitledLocus[] {
  return entitledLoci(context.scene, family, id);
}

// ------------------------------------------------------------------------------------------
// DIRECT_JUMP
// ------------------------------------------------------------------------------------------

export interface DirectJumpRequest extends InspectionRequest {
  /** An explicitly chosen locus. Required when the target has several legitimate loci. */
  readonly locus?: EntitledLocus;
  /** Must be the depth the held projection was disclosed at; a different depth needs another `V`. */
  readonly depth?: SemanticDepth;
}

export type DirectJumpOutcome =
  | MapActionOutcome
  | {
      readonly outcome: 'CONTEXT_SELECTION_REQUIRED';
      readonly loci: readonly EntitledLocus[];
      readonly entitled: EntitledInspection;
    };

function resolveJumpLocus(
  context: MapInspectionContext,
  entitled: EntitledInspection,
  request: DirectJumpRequest,
): { readonly kind: 'LOCUS'; readonly locus: EntitledLocus } | { readonly kind: 'NONE' } | { readonly kind: 'MANY'; readonly loci: readonly EntitledLocus[] } | { readonly kind: 'INVALID'; readonly detail: string } {
  const family = mapFamilyOf(entitled);
  if (family === null) return { kind: 'NONE' };

  if (request.locus !== undefined) {
    if (!isEntitledLocus(request.locus)) return { kind: 'INVALID', detail: 'the chosen locus was not derived from a disclosed scene' };
    const candidates = entitledLoci(context.scene, family, entitled.id);
    const match = candidates.find((candidate) => candidate.key === request.locus?.key);
    if (match === undefined) return { kind: 'INVALID', detail: 'the chosen locus is not a legitimate locus of this identity at TC' };
    return { kind: 'LOCUS', locus: match };
  }

  // A request that already names a disclosed contextual appearance has identified its locus.
  if (entitled.appearance !== null && entitled.appearance.kind === 'THREAD_READING') {
    const locus = locusForBinding(context.scene, family, entitled.id, entitled.appearance.bindingId);
    if (locus === null) return { kind: 'INVALID', detail: 'the named contextual appearance is not a locus on the disclosed Map' };
    return { kind: 'LOCUS', locus };
  }

  const locatability = resolveLocatability(context.scene, family, entitled.id);
  switch (locatability.outcome) {
    case 'NO_LEGITIMATE_LOCUS':
      return { kind: 'NONE' };
    case 'UNIQUE_LOCUS':
      return { kind: 'LOCUS', locus: locatability.locus };
    case 'MULTIPLE_LEGITIMATE_LOCI':
      return { kind: 'MANY', loci: locatability.loci };
    default: {
      const exhaustive: never = locatability;
      return exhaustive;
    }
  }
}

/**
 * Direct addressability to an already-entitled, already-disclosed target. Temporal state is
 * untouched. The landing carries the locus itself, so the target arrives inside its contextual
 * route rather than as an isolated floating object.
 */
export function directJump(store: CanonicalStore, context: MapInspectionContext, request: DirectJumpRequest): DirectJumpOutcome {
  const stale = staleOutcome(store, context);
  if (stale !== null) return stale;
  const resolution = resolveEntitledInspection(context.disclosure, request);
  if (!resolution.ok) return rejected('NOT_ENTITLED', `${resolution.reason}: ${resolution.detail}`);
  const entitled = resolution.entitled;

  const depth = request.depth ?? context.scene.depth;
  if (depth !== context.scene.depth) {
    return rejected('PROJECTION_NOT_AVAILABLE', `landing at depth ${depth} requires a projection disclosed at that depth; the held one is ${context.scene.depth}`);
  }

  const located = resolveJumpLocus(context, entitled, request);
  switch (located.kind) {
    case 'INVALID':
      return rejected('INVALID_INPUT', located.detail);
    case 'NONE':
      return rejected('NOT_LOCATABLE', `${entitled.family} ${entitled.id} has no legitimate locus on the Map at TC ${context.scene.tc}`);
    case 'MANY':
      // No silent selection: no primary context, no Live Focus heuristic, no nearest geometry,
      // no first row. Nothing is written and nothing is recorded until an explicit choice exists.
      return { outcome: 'CONTEXT_SELECTION_REQUIRED', loci: located.loci, entitled };
    case 'LOCUS': {
      // The landing carries the contextual route of the locus it lands in, so the target arrives
      // inside its context rather than as an isolated floating object. This is not an election:
      // the locus was either uniquely determined or explicitly chosen before this point.
      let landing = entitled;
      const locus = located.locus.locus;
      if (locus.kind === 'CONTEXTUAL_APPEARANCE' && entitled.appearance === null) {
        const contextual = resolveEntitledInspection(context.disclosure, {
          family: request.family,
          id: request.id,
          ...(request.version === undefined ? {} : { version: request.version }),
          appearance: { kind: 'THREAD_READING', bindingId: locus.bindingId },
        });
        if (!contextual.ok) return rejected('NOT_ENTITLED', `${contextual.reason}: ${contextual.detail}`);
        landing = contextual.entitled;
      }
      const granted = authorizeIfProjectionCurrent(store, landing.projection, {
        type: 'DIRECT_JUMP',
        ref: landing.ref,
        to: Object.freeze({
          depth,
          anchor: worldAnchorRef(located.locus.anchor),
          destination: spatialDestinationRef(located.locus.destination),
        }),
      });
      if (!granted.ok) return granted.outcome;
      return dispatchAuthorizedMapAction(store, granted.action);
    }
    default: {
      const exhaustive: never = located;
      return exhaustive;
    }
  }
}
