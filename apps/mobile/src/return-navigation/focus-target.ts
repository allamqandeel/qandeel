/**
 * T-07 — the ONE mapping from a bound Live Focus referent to a place on the Map, and the ONE way
 * this layer asks whether that place legitimately exists.
 *
 * Both acts that carry a Live Focus referent — Return to Live Focus (D1) and Go Live + Locate (P5) —
 * use exactly this module, so there is one focus-to-geography mapping in the layer and not two.
 *
 * The mapping itself uses only frozen identities and invents nothing:
 *
 *   NONE                     → no target at all;
 *   EMERGING_FOCUS(id)       → the Map's own `EMERGING_FOCUS` family, by that id. An Emerging Focus
 *                              is pregeographic by frozen truth, so at most it resolves to a locus
 *                              the CURRENT disclosed projection legitimately provides — and never to
 *                              the Home of a Thread it may have been promoted to later, because at
 *                              this position that Thread's geography is a different fact;
 *   ESTABLISHED_THREAD(id)   → the Map's own `THREAD` family, by that id, located only through the
 *                              currently entitled scene.
 *
 * Whether the referent is disclosed here, and how many legitimate places it has, is asked of T-06's
 * own target resolver — which asks T-04's entitlement and locatability substrate. This layer holds
 * no second locatability algorithm, ranks nothing, elects nothing and repairs nothing: zero places
 * is a truthful answer about an ungeographic identity, and several places is an ambiguity nothing
 * here resolves.
 */
import type { LiveFocus } from '../state';
import {
  spatialDestinationRef,
  worldAnchorRef,
  type EntitledLocus,
  type MapInspectionContext,
  type MapObjectFamily,
  type MapProjectionRequest,
} from '../map';
import { mapInspectionContext } from '../map';
import type { HistoricalDisclosureEntry } from '../projection';
import { resolveLocateAtTarget } from '../temporal-navigation';
import type { LocateLanding } from '../state';
import { type ReturnLocateStatus, type ReturnRejectionCode } from './outcomes';

/** A canonical identity on the Map, derived from a bound Live Focus referent and nothing else. */
export interface ReturnFocusTarget {
  readonly family: MapObjectFamily;
  readonly id: string;
}

/** The frozen Live Focus → Map target mapping. `NONE` has no target; nothing else is invented. */
export function focusMapTarget(focus: LiveFocus): ReturnFocusTarget | null {
  switch (focus.kind) {
    case 'ESTABLISHED_THREAD':
      return { family: 'THREAD', id: focus.threadId };
    case 'EMERGING_FOCUS':
      return { family: 'EMERGING_FOCUS', id: focus.emergingFocusId };
    default:
      return null;
  }
}

export type FocusLanding =
  | { readonly status: 'LANDING'; readonly to: LocateLanding }
  | { readonly status: 'NO_LANDING'; readonly locate: ReturnLocateStatus };

/** Only the two references the frozen authority of a locating return act permits. No depth. */
function landingFor(locus: EntitledLocus): LocateLanding {
  return Object.freeze({ anchor: worldAnchorRef(locus.anchor), destination: spatialDestinationRef(locus.destination) });
}

/**
 * Resolves the bound referent against ONE disclosed projection, through the existing target
 * resolver. Every non-landing answer keeps its own truthful reason: a referent that is not disclosed
 * here is NOT ENTITLED, one that is disclosed and has no place is NOT LOCATABLE, and one with
 * several places is AMBIGUOUS — three different facts that are never collapsed into one.
 */
export function resolveFocusLanding(context: MapInspectionContext, target: ReturnFocusTarget): FocusLanding {
  const resolved = resolveLocateAtTarget(context, { family: target.family, id: target.id });
  if (resolved.outcome === 'LOCUS_SELECTION_REQUIRED') return { status: 'NO_LANDING', locate: 'AMBIGUOUS_LOCUS' };
  if (resolved.outcome === 'REJECTED') {
    return { status: 'NO_LANDING', locate: resolved.code === 'NOT_ENTITLED' ? 'NOT_ENTITLED' : 'NOT_LOCATABLE' };
  }
  return { status: 'LANDING', to: landingFor(resolved.locus) };
}

export type ReturnMapContext =
  | { readonly ok: true; readonly context: MapInspectionContext }
  | { readonly ok: false; readonly code: ReturnRejectionCode; readonly detail: string };

/**
 * Turns what the client actually HOLDS into either a usable projection context or a TECHNICAL
 * refusal — never into a semantic "there is nowhere to go".
 *
 * A disclosure that was never fetched, one the server refused, and one that does not describe the
 * requested viewpoint are all availability facts about the client, not facts about the world. Saying
 * `NOT_LOCATABLE` for any of them would tell the reader something false. There is no second cache
 * and no second derivation here: this reads the entry the projection boundary already holds, through
 * the Map's own context builder.
 */
export function returnMapContext(entry: HistoricalDisclosureEntry, request: MapProjectionRequest): ReturnMapContext {
  const resolution = mapInspectionContext(entry, request);
  if (resolution.ok) return { ok: true, context: resolution.context };
  const derivation = resolution.derivation;
  if (derivation.status === 'PROJECTION_NOT_FETCHED') {
    return { ok: false, code: 'PROJECTION_NOT_AVAILABLE', detail: 'the disclosed projection of this viewpoint has not been fetched' };
  }
  if (derivation.status === 'PROJECTION_UNAVAILABLE') {
    return { ok: false, code: 'PROJECTION_NOT_AVAILABLE', detail: `the server refused the disclosure of this viewpoint: ${derivation.code}` };
  }
  if (derivation.status === 'REJECTED') {
    return { ok: false, code: 'PROJECTION_NOT_AVAILABLE', detail: `${derivation.reason}: ${derivation.detail}` };
  }
  return { ok: false, code: 'PROJECTION_NOT_AVAILABLE', detail: 'the held disclosure produced no usable scene' };
}
