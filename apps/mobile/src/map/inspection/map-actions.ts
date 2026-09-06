/**
 * T-04 — the executors of the three promoted Map acts.
 *
 * Each one resolves entitlement against the disclosed projection `V` first and dispatches
 * through the existing canonical store second. There is no third path: no direct write, no
 * parallel navigation store, no generic `navigate()`, and nothing that could reach `TM`, `TC` or
 * `LF` — the frozen per-field authority of these acts is `IF_ref` for inspection and context
 * switching, and `IF_ref` plus the camera fields for a direct jump.
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

import type { CanonicalStore, SemanticDepth } from '../../state';
import type { HistoricalDisclosureEntry } from '../../projection';
import { worldAnchorRef, spatialDestinationRef } from '../world';
import {
  deriveMapScene,
  type MapObjectFamily,
  type MapProjectionRequest,
  type MapScene,
  type MapSceneDerivation,
} from '../projection';
import { dispatchMapAction, rejected, type MapActionOutcome } from '../outcome';
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
export interface MapInspectionContext {
  readonly disclosure: HistoricalDisclosure;
  readonly scene: MapScene;
}

export type MapContextResolution =
  | { readonly ok: true; readonly context: MapInspectionContext }
  | { readonly ok: false; readonly derivation: MapSceneDerivation };

export function mapInspectionContext(entry: HistoricalDisclosureEntry, request: MapProjectionRequest): MapContextResolution {
  const derivation = deriveMapScene(entry, request);
  if (derivation.status !== 'SCENE' || entry.status !== 'FETCHED') return { ok: false, derivation };
  return { ok: true, context: { disclosure: entry.value, scene: derivation.scene } };
}

/** The Map families that carry geography. Every other disclosed family is inspectable, not placed. */
const MAP_FAMILY: Partial<Record<string, MapObjectFamily>> = { THREAD: 'THREAD', READING: 'READING', EMERGING_FOCUS: 'EMERGING_FOCUS' };

function mapFamilyOf(entitled: EntitledInspection): MapObjectFamily | null {
  return MAP_FAMILY[entitled.family] ?? null;
}

// ------------------------------------------------------------------------------------------
// INSPECT_OBJECT
// ------------------------------------------------------------------------------------------

/** Inspects an already-entitled target. The brand makes a forged entitlement unusable. */
export function inspectEntitled(store: CanonicalStore, entitled: EntitledInspection): MapActionOutcome {
  if (!isEntitledInspection(entitled)) {
    return rejected('NOT_ENTITLED', 'the inspection target was not resolved against a disclosed projection');
  }
  return dispatchMapAction(store, { type: 'INSPECT_OBJECT', ref: entitled.ref });
}

export function inspectObject(store: CanonicalStore, context: MapInspectionContext, request: InspectionRequest): MapActionOutcome {
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
  return dispatchMapAction(store, { type: 'SWITCH_CONTEXT', ref: entitled.ref });
}

/**
 * Switches to another legitimate appearance of the SAME canonical object. The canonical identity
 * is not re-elected here: the kernel refuses a reference whose identity differs from the current
 * inspection, so a "switch" can never become a second object.
 */
export function switchContext(store: CanonicalStore, context: MapInspectionContext, request: InspectionRequest): MapActionOutcome {
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
      return dispatchMapAction(store, {
        type: 'DIRECT_JUMP',
        ref: landing.ref,
        to: {
          depth,
          anchor: worldAnchorRef(located.locus.anchor),
          destination: spatialDestinationRef(located.locus.destination),
        },
      });
    }
    default: {
      const exhaustive: never = located;
      return exhaustive;
    }
  }
}
