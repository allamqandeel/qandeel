/**
 * T-06 — resolving WHERE a composite temporal act may land, at the position it commits to.
 *
 * This module owns no geography. It asks T-04's substrate the two questions it already answers —
 * "is this identity disclosed here?" (entitlement) and "how many legitimate loci does it have
 * here?" (locatability) — and it asks them against the disclosed projection of the TARGET position,
 * never the one being left. That is the whole of no-hindsight for a locate: a Home that exists only
 * later is not in `K(target)`, so it cannot be landed on, and no later locus can be reused for an
 * earlier target because no later locus is visible from here at all.
 *
 * The three answers stay three answers, and none of them is repaired:
 *
 *   - exactly one legitimate locus  → the composite locate may proceed;
 *   - zero legitimate loci          → no geography is invented. An ungeographic identity is a
 *                                     truthful answer, not a missing placement;
 *   - several legitimate loci       → nothing is elected. Not the first row, not the nearest, not
 *                                     the "current" appearance, not the Live Focus, not the one the
 *                                     reader last used. The frozen contextual-locus choice runs.
 */
import {
  entitledLoci,
  isEntitledLocus,
  resolveEntitledInspection,
  resolveLocatability,
  type EntitledLocus,
  type MapInspectionContext,
  type MapObjectFamily,
} from '../../map';
import type { TemporalRejectionCode } from '../outcome';

/** A canonical identity the reader wants to arrive at. Only placed families can be located. */
export interface TemporalLocateTarget {
  readonly family: MapObjectFamily;
  readonly id: string;
  /** Absent means the then-current version at the target position, exactly as `IF_ref` means it. */
  readonly version?: number;
}

export type LocateResolution =
  | { readonly outcome: 'UNIQUE_LOCUS'; readonly locus: EntitledLocus }
  | { readonly outcome: 'LOCUS_SELECTION_REQUIRED'; readonly loci: readonly EntitledLocus[] }
  | { readonly outcome: 'REJECTED'; readonly code: TemporalRejectionCode; readonly detail: string };

const refuse = (code: TemporalRejectionCode, detail: string): LocateResolution => ({ outcome: 'REJECTED', code, detail });

/**
 * Resolves the landing of one identity against ONE disclosed projection.
 *
 * `chosen` is an explicit contextual-locus choice. It is verified twice: the runtime brand proves
 * the handle came from a disclosed scene at all, and membership proves it is a locus of THIS
 * identity in THIS projection — so a handle minted from another position, another identity or
 * another depth is refused rather than trusted for looking structurally correct.
 */
export function resolveLocateAtTarget(
  context: MapInspectionContext,
  target: TemporalLocateTarget,
  chosen?: EntitledLocus,
): LocateResolution {
  if (target === null || typeof target !== 'object') return refuse('INVALID_INPUT', 'a locate target is required');
  if (typeof target.id !== 'string' || target.id.length === 0) return refuse('INVALID_INPUT', 'a non-empty canonical identity is required');

  // Entitlement first, so a refusal keeps its disclosure-truthful reason: a rung that is withheld is
  // WITHHELD, and an identity absent from a disclosed rung is UNKNOWN AT THIS POSITION. Collapsing
  // both into "not locatable" would tell the reader something false about the world.
  const entitlement = resolveEntitledInspection(context.disclosure, {
    family: target.family,
    id: target.id,
    ...(target.version === undefined ? {} : { version: target.version }),
  });
  if (!entitlement.ok) return refuse('NOT_ENTITLED', `${entitlement.reason}: ${entitlement.detail}`);

  const candidates = entitledLoci(context.scene, target.family, target.id);

  if (chosen !== undefined) {
    if (!isEntitledLocus(chosen)) return refuse('INVALID_INPUT', 'the chosen locus was not derived from a disclosed scene');
    const match = candidates.find((candidate) => candidate.key === chosen.key);
    if (match === undefined) {
      return refuse('INVALID_INPUT', `the chosen locus is not a legitimate locus of ${target.family} ${target.id} at Session Position ${context.scene.tc}`);
    }
    return { outcome: 'UNIQUE_LOCUS', locus: match };
  }

  const locatability = resolveLocatability(context.scene, target.family, target.id);
  switch (locatability.outcome) {
    case 'NO_LEGITIMATE_LOCUS':
      return refuse('NOT_LOCATABLE', `${target.family} ${target.id} has no legitimate locus on the Map at Session Position ${context.scene.tc}`);
    case 'UNIQUE_LOCUS':
      return { outcome: 'UNIQUE_LOCUS', locus: locatability.locus };
    case 'MULTIPLE_LEGITIMATE_LOCI':
      return { outcome: 'LOCUS_SELECTION_REQUIRED', loci: locatability.loci };
    default: {
      const exhaustive: never = locatability;
      return exhaustive;
    }
  }
}

/** Every legitimate locus of one identity at one disclosed position, for a chooser to present. */
export function legitimateLoci(context: MapInspectionContext, target: TemporalLocateTarget): readonly EntitledLocus[] {
  return entitledLoci(context.scene, target.family, target.id);
}
