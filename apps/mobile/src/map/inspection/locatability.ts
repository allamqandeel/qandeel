/**
 * T-04 — the locatability substrate: how many legitimate loci one canonical identity has on the
 * disclosed Map, and typed handles for them.
 *
 * This is geometry and entitlement, and nothing else. It answers exactly one question — zero,
 * one, or many — over `MapScene`, which was derived from the disclosed projection `V` alone. It
 * does not execute `COMMIT_MOMENT_AND_LOCATE`, `CHOOSE_LOCUS`, `RETURN_LIVE_FOCUS`,
 * `GO_LIVE_AND_LOCATE`, `RETURN_WORLD`, `EXACT_RETURN` or `BACK_ONE_STEP`: those are T-06's and
 * T-07's acts, they remain later-owner metadata in the registry, and this module exists so that
 * their owners inherit the mechanics rather than reinvent them.
 *
 * Zero loci is a truthful answer about a legitimately ungeographic identity — a pregeographic
 * Emerging Focus, an ungrounded Reading, an analytical object the Map does not place — and it is
 * exactly what forbids a caller from inventing a landing for it. Many loci is equally truthful,
 * and it never resolves itself: this module returns them all and elects none.
 */
import { mapDestination, type CanonicalWorldAddress, type MapDestination } from '../world';
import type { MapObjectFamily, MapScene, MapSceneLocus } from '../projection';
import { mapSceneObject, mapSceneObjectKey } from '../projection';

export interface EntitledLocus {
  /** A stable handle for this locus of this identity within this scene. */
  readonly key: string;
  readonly objectKey: string;
  readonly locus: MapSceneLocus;
  readonly anchor: CanonicalWorldAddress;
  readonly destination: MapDestination;
}

export type LocatabilityResult =
  | { readonly outcome: 'NO_LEGITIMATE_LOCUS' }
  | { readonly outcome: 'UNIQUE_LOCUS'; readonly locus: EntitledLocus }
  | { readonly outcome: 'MULTIPLE_LEGITIMATE_LOCI'; readonly loci: readonly EntitledLocus[] };

const minted = new WeakSet<object>();

/** True only for a handle this module produced from a disclosed scene. */
export function isEntitledLocus(value: unknown): value is EntitledLocus {
  return typeof value === 'object' && value !== null && minted.has(value as object);
}

function mint(objectKey: string, locus: MapSceneLocus): EntitledLocus | null {
  const address = locus.kind === 'THREAD_HOME' ? locus.address : locus.hostAddress;
  const destination =
    locus.kind === 'THREAD_HOME'
      ? mapDestination('THREAD_HOME', locus.threadId, null, address)
      : mapDestination('CONTEXTUAL_APPEARANCE', locus.threadId, locus.bindingId, address);
  if (!destination.ok) return null;
  const key = locus.kind === 'THREAD_HOME' ? `${objectKey}@THREAD_HOME:${locus.threadId}` : `${objectKey}@THREAD_READING:${locus.bindingId}`;
  const handle: EntitledLocus = Object.freeze({ key, objectKey, locus, anchor: address, destination: destination.value });
  minted.add(handle);
  return handle;
}

/**
 * Resolves the legitimate loci of one canonical identity on the disclosed Map. An identity that
 * the scene does not contain has zero legitimate loci, which is the same actionable answer as an
 * entitled identity that legitimately has none.
 */
export function resolveLocatability(scene: MapScene, family: MapObjectFamily, id: string): LocatabilityResult {
  const object = mapSceneObject(scene, family, id);
  if (object === null) return { outcome: 'NO_LEGITIMATE_LOCUS' };
  const objectKey = mapSceneObjectKey(family, id);
  const loci = object.loci.map((locus) => mint(objectKey, locus)).filter((locus): locus is EntitledLocus => locus !== null);
  if (loci.length === 0) return { outcome: 'NO_LEGITIMATE_LOCUS' };
  if (loci.length === 1) return { outcome: 'UNIQUE_LOCUS', locus: loci[0] };
  return { outcome: 'MULTIPLE_LEGITIMATE_LOCI', loci: Object.freeze(loci) };
}

/** Every entitled locus of one identity, in scene order. Empty is a truthful answer. */
export function entitledLoci(scene: MapScene, family: MapObjectFamily, id: string): readonly EntitledLocus[] {
  const result = resolveLocatability(scene, family, id);
  if (result.outcome === 'UNIQUE_LOCUS') return [result.locus];
  if (result.outcome === 'MULTIPLE_LEGITIMATE_LOCI') return result.loci;
  return [];
}

/** The locus a specific disclosed contextual binding names, or `null` when it is not one. */
export function locusForBinding(scene: MapScene, family: MapObjectFamily, id: string, bindingId: string): EntitledLocus | null {
  return entitledLoci(scene, family, id).find((locus) => locus.locus.kind === 'CONTEXTUAL_APPEARANCE' && locus.locus.bindingId === bindingId) ?? null;
}
