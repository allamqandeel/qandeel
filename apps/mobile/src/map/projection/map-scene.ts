/**
 * T-04 — `MapScene`: the entitled Map derived from the disclosed projection `V`, and from
 * nothing else.
 *
 * `V = Disclose(K(TC), depth, inspection)` is the ONLY entitlement source of the Map. The visual
 * renderer, hit testing and the accessible semantic tree all read this one derivation, so they
 * cannot disagree about what exists: there is no second query, no raw `K(TC)`, no local cache of
 * "everything", and no identity that is present in one surface and hidden in another.
 *
 * What this derivation may and may not do:
 *
 *   - a Thread's ONE permanent Home is read exactly as `V` disclosed it. Homes are never
 *     computed, adjusted, compacted, redistributed or fitted;
 *   - an object that has no canonical Home never receives one. An Emerging Focus is
 *     pregeographic by frozen truth and is NOT given the Home of the Thread it was later
 *     promoted to, because at `TC` that Thread's geography is a different fact;
 *   - a contextual appearance is hosted by its Thread's Home. It has no independent canonical
 *     coordinate, and it never becomes a second canonical identity;
 *   - an entitled identity with no legitimate locus at `TC` is kept, explicitly, as
 *     *ungeographic*. It is not dropped (that would hide disclosed truth) and it is not placed
 *     (that would invent geography);
 *   - a sparse or empty scene is a correct scene. `NOT_FETCHED`, `UNAVAILABLE` and "disclosed
 *     and empty" stay three different answers, exactly as T-03C keeps them apart;
 *   - a malformed world — a Home outside the canonical coordinate bound, two Homes on one
 *     placement, an appearance whose host Thread is not known at `TC` — fails closed for the
 *     whole scene rather than silently dropping the offending row.
 *
 * `MapScene` is derived presentation input. It is Class B, it is never stored in the canonical
 * state, it never appends RH, and no ordering or position in it carries analytical meaning.
 */
import type {
  DisclosedThread,
  HistoricalDisclosure,
  HistoricalProjectionUnavailableCode,
  HistoricalSemanticDepth,
} from '@qandeel/runtime';

import { effectiveTC, type CanonicalState, type SemanticDepth, type SessionPosition } from '../../state';
import type { HistoricalDisclosureEntry } from '../../projection';
import { decodeDisclosedHome, worldAddressKey, type CanonicalWorldAddress } from '../world';

export const MAP_OBJECT_FAMILIES = Object.freeze(['THREAD', 'READING', 'EMERGING_FOCUS'] as const);
export type MapObjectFamily = (typeof MAP_OBJECT_FAMILIES)[number];

/** A Thread's own permanent Home: the only canonical placement the Map has. */
export interface MapSceneThreadHomeLocus {
  readonly kind: 'THREAD_HOME';
  readonly threadId: string;
  readonly address: CanonicalWorldAddress;
}

/**
 * One legitimate contextual appearance of a canonical object inside a Thread. `ordinal` is a
 * deterministic presentation slot derived from already-disclosed facts (the binding's own
 * Session Position, then its binding identity). It is a tie-break, not a rank: it states no
 * importance, confidence, strength, ownership, causality or primacy.
 */
export interface MapSceneAppearanceLocus {
  readonly kind: 'CONTEXTUAL_APPEARANCE';
  readonly bindingId: string;
  readonly threadId: string;
  readonly hostAddress: CanonicalWorldAddress;
  readonly boundSp: number;
  readonly current: boolean;
  readonly ordinal: number;
}

export type MapSceneLocus = MapSceneThreadHomeLocus | MapSceneAppearanceLocus;

export interface MapSceneObject {
  readonly family: MapObjectFamily;
  readonly id: string;
  /** `${family}:${id}` — the stable scene key of ONE canonical identity, across every depth. */
  readonly key: string;
  /** The shallowest rung of `V` that disclosed this identity at `TC`. */
  readonly disclosedAtDepth: SemanticDepth;
  /** Zero, one or many legitimate loci. Zero is a truthful answer, not a missing placement. */
  readonly loci: readonly MapSceneLocus[];
}

export interface MapSceneRungs {
  readonly thread: boolean;
  readonly session: boolean;
  readonly analyticalObject: boolean;
  readonly sourceProvenance: boolean;
}

export interface MapScene {
  readonly sessionId: string;
  readonly tc: number;
  readonly liveHead: number;
  readonly sealed: boolean;
  readonly depth: SemanticDepth;
  readonly rungs: MapSceneRungs;
  /** Every entitled Map identity at this depth, in a deterministic order. */
  readonly objects: readonly MapSceneObject[];
  /** The subset that carries a canonical Home. */
  readonly homes: readonly MapSceneObject[];
  /** The subset that legitimately has no locus at `TC`. */
  readonly ungeographic: readonly MapSceneObject[];
  readonly keys: ReadonlySet<string>;
}

export type MapSceneRejectionReason =
  | 'PROJECTION_NOT_FETCHED'
  | 'PROJECTION_UNAVAILABLE'
  | 'PROJECTION_DEPTH_MISMATCH'
  | 'PROJECTION_SESSION_MISMATCH'
  | 'PROJECTION_TC_MISMATCH'
  | 'MALFORMED_WORLD';

export type MapSceneDerivation =
  | { readonly status: 'SCENE'; readonly scene: MapScene }
  | { readonly status: 'PROJECTION_NOT_FETCHED' }
  | { readonly status: 'PROJECTION_UNAVAILABLE'; readonly code: HistoricalProjectionUnavailableCode }
  | { readonly status: 'REJECTED'; readonly reason: MapSceneRejectionReason; readonly detail: string };

/** The (Session, TC, depth) the Map is entitled to ask for, taken from canonical state alone. */
export interface MapProjectionRequest {
  readonly sessionId: string;
  readonly tc: SessionPosition;
  readonly depth: SemanticDepth;
}

/**
 * Derives the projection request from canonical state: the store's Session context, the derived
 * effective `TC` and `MC.depth`. `null` while no authoritative committed Session Position has
 * been mirrored — the Map has nothing addressable to disclose yet, which is not an error.
 */
export function mapProjectionRequest(state: CanonicalState): MapProjectionRequest | null {
  const tc = effectiveTC(state);
  if (tc === null) return null;
  return { sessionId: state.session.id, tc, depth: state.camera.depth };
}

const objectKey = (family: MapObjectFamily, id: string): string => `${family}:${id}`;

const reject = (reason: MapSceneRejectionReason, detail: string): MapSceneDerivation => ({ status: 'REJECTED', reason, detail });

/** `HistoricalSemanticDepth` and `SemanticDepth` are the same frozen five rungs. */
const asSemanticDepth = (depth: HistoricalSemanticDepth): SemanticDepth => depth;

function compareAppearances(a: MapSceneAppearanceLocus, b: MapSceneAppearanceLocus): number {
  if (a.boundSp !== b.boundSp) return a.boundSp - b.boundSp;
  return a.bindingId < b.bindingId ? -1 : a.bindingId > b.bindingId ? 1 : 0;
}

function compareObjects(a: MapSceneObject, b: MapSceneObject): number {
  if (a.family !== b.family) return MAP_OBJECT_FAMILIES.indexOf(a.family) - MAP_OBJECT_FAMILIES.indexOf(b.family);
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

interface DraftObject {
  family: MapObjectFamily;
  id: string;
  disclosedAtDepth: SemanticDepth;
  loci: MapSceneLocus[];
}

/**
 * Builds the entitled scene from ONE disclosure. The caller must have obtained `disclosure`
 * for the same (Session, TC, depth) it is asking about; the mismatch guards below make a wrong
 * pairing a typed rejection rather than a plausible-looking wrong Map.
 */
export function deriveMapSceneFromDisclosure(disclosure: HistoricalDisclosure, request: MapProjectionRequest): MapSceneDerivation {
  if (disclosure.sessionId !== request.sessionId) {
    return reject('PROJECTION_SESSION_MISMATCH', `the disclosure covers Session ${disclosure.sessionId}, not ${request.sessionId}`);
  }
  if (disclosure.tc !== request.tc) {
    return reject('PROJECTION_TC_MISMATCH', `the disclosure is at TC ${disclosure.tc}, not ${request.tc}`);
  }
  if (asSemanticDepth(disclosure.depth) !== request.depth) {
    return reject('PROJECTION_DEPTH_MISMATCH', `the disclosure was made at depth ${disclosure.depth}, not ${request.depth}`);
  }

  const drafts = new Map<string, DraftObject>();
  const homeOf = new Map<string, CanonicalWorldAddress>();
  const placements = new Set<string>();

  for (const thread of disclosure.world.threads as readonly DisclosedThread[]) {
    const decoded = decodeDisclosedHome(thread.home, `world.threads[${thread.id}].home`);
    if (!decoded.ok) return reject('MALFORMED_WORLD', decoded.detail);
    const placement = worldAddressKey(decoded.address);
    if (placements.has(placement)) {
      return reject('MALFORMED_WORLD', `world.threads[${thread.id}]: two Established Threads share one canonical placement`);
    }
    placements.add(placement);
    const key = objectKey('THREAD', thread.id);
    if (drafts.has(key)) return reject('MALFORMED_WORLD', `world.threads[${thread.id}]: the same Thread is disclosed twice`);
    homeOf.set(thread.id, decoded.address);
    drafts.set(key, {
      family: 'THREAD',
      id: thread.id,
      disclosedAtDepth: 'WORLD',
      loci: [{ kind: 'THREAD_HOME', threadId: thread.id, address: decoded.address }],
    });
  }

  if (disclosure.thread.status === 'DISCLOSED') {
    // Two passes: the disclosed appearances are grouped by host Thread and ordered first, then
    // the ordinal is assigned per host Home over that host's own appearances only, so a Thread
    // appearing elsewhere in the world never renumbers an existing Thread's contextual slots.
    const perThread = new Map<string, { readingId: string; locus: Omit<MapSceneAppearanceLocus, 'ordinal'> }[]>();
    for (const appearance of disclosure.thread.value.threadReadingAppearances) {
      const hostAddress = homeOf.get(appearance.threadId);
      if (hostAddress === undefined) {
        return reject('MALFORMED_WORLD', `thread.threadReadingAppearances[${appearance.bindingId}]: the host Thread is not known at TC`);
      }
      const bucket = perThread.get(appearance.threadId) ?? [];
      bucket.push({
        readingId: appearance.readingId,
        locus: {
          kind: 'CONTEXTUAL_APPEARANCE',
          bindingId: appearance.bindingId,
          threadId: appearance.threadId,
          hostAddress,
          boundSp: appearance.boundSp,
          current: appearance.current,
        },
      });
      perThread.set(appearance.threadId, bucket);
    }
    for (const bucket of perThread.values()) {
      const ordered = [...bucket].sort((a, b) => compareAppearances({ ...a.locus, ordinal: 0 }, { ...b.locus, ordinal: 0 }));
      ordered.forEach((entry, index) => {
        const locus: MapSceneAppearanceLocus = { ...entry.locus, ordinal: index };
        const key = objectKey('READING', entry.readingId);
        const draft = drafts.get(key);
        if (draft === undefined) drafts.set(key, { family: 'READING', id: entry.readingId, disclosedAtDepth: 'THREAD', loci: [locus] });
        else draft.loci.push(locus);
      });
    }
  }

  if (disclosure.session.status === 'DISCLOSED') {
    for (const focus of disclosure.session.value.emergingFocuses) {
      const key = objectKey('EMERGING_FOCUS', focus.id);
      // Deliberately no locus: an Emerging Focus is pregeographic, and the Thread it may have
      // been promoted to is a different canonical identity with a different geography.
      if (!drafts.has(key)) drafts.set(key, { family: 'EMERGING_FOCUS', id: focus.id, disclosedAtDepth: 'SESSION', loci: [] });
    }
  }

  if (disclosure.analyticalObject.status === 'DISCLOSED') {
    for (const reading of disclosure.analyticalObject.value.readings) {
      const key = objectKey('READING', reading.id);
      // A Reading with no disclosed Thread appearance is entitled and ungeographic: an
      // ungrounded Reading has no Thread, and no Thread means no Home to be hosted by.
      if (!drafts.has(key)) drafts.set(key, { family: 'READING', id: reading.id, disclosedAtDepth: 'ANALYTICAL_OBJECT', loci: [] });
    }
  }

  const objects: MapSceneObject[] = [...drafts.values()]
    .map((draft) => ({
      family: draft.family,
      id: draft.id,
      key: objectKey(draft.family, draft.id),
      disclosedAtDepth: draft.disclosedAtDepth,
      loci: Object.freeze([...draft.loci].sort((a, b) => (a.kind === 'THREAD_HOME' ? -1 : b.kind === 'THREAD_HOME' ? 1 : compareAppearances(a, b)))),
    }))
    .sort(compareObjects);

  const scene: MapScene = Object.freeze({
    sessionId: disclosure.sessionId,
    tc: disclosure.tc,
    liveHead: disclosure.liveHead,
    sealed: disclosure.sealed,
    depth: asSemanticDepth(disclosure.depth),
    rungs: Object.freeze({
      thread: disclosure.thread.status === 'DISCLOSED',
      session: disclosure.session.status === 'DISCLOSED',
      analyticalObject: disclosure.analyticalObject.status === 'DISCLOSED',
      sourceProvenance: disclosure.sourceProvenance.status === 'DISCLOSED',
    }),
    objects: Object.freeze(objects),
    homes: Object.freeze(objects.filter((object) => object.family === 'THREAD')),
    ungeographic: Object.freeze(objects.filter((object) => object.loci.length === 0)),
    keys: new Set(objects.map((object) => object.key)),
  });
  return { status: 'SCENE', scene };
}

/**
 * Derives the scene from what the client actually holds. `NOT_FETCHED` is the absence of a
 * fetch and says nothing about history; `UNAVAILABLE` is the server's typed refusal and is never
 * "unknown"; a disclosed-and-empty world is a correct, sparse Map.
 */
export function deriveMapScene(entry: HistoricalDisclosureEntry, request: MapProjectionRequest): MapSceneDerivation {
  switch (entry.status) {
    case 'NOT_FETCHED':
      return { status: 'PROJECTION_NOT_FETCHED' };
    case 'UNAVAILABLE':
      return { status: 'PROJECTION_UNAVAILABLE', code: entry.code };
    case 'FETCHED':
      return deriveMapSceneFromDisclosure(entry.value, request);
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
}

export function mapSceneObject(scene: MapScene, family: MapObjectFamily, id: string): MapSceneObject | null {
  return scene.objects.find((object) => object.family === family && object.id === id) ?? null;
}

export function mapSceneContains(scene: MapScene, family: MapObjectFamily, id: string): boolean {
  return scene.keys.has(objectKey(family, id));
}

export function mapSceneObjectKey(family: MapObjectFamily, id: string): string {
  return objectKey(family, id);
}
