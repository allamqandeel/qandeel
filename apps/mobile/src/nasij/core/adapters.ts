// NASIJ (experimental, isolated) — the adapters from the product's own read models to the scene input.
//
// These read the authority's answers and change nothing about them. Coordinates are subtracted in exact integers and
// only the DIFFERENCE from the scene origin becomes a float, so a place far from the canonical origin keeps its
// precision. The canonical orientation is world +y up; the cloth's y runs down the screen.
//
// Types are imported as types only: this file stays free of React Native so the browser preview and the headless
// rasteriser can load it.

import type { MapScene } from '../../map/projection/map-scene';
import type { PublicFieldEntry, PublicTopicSection } from '../../runtime-entry/public-field-api';
import type { SharedFieldEntry } from '../../runtime-entry/shared-field-api';
import { compileNasij, type Dye, type NasijDrawList, type NasijEntity, type NasijLayer, type NasijSceneInput, type NasijTie } from './scene';

/** Canonical world units per point at the first rung (the Map's frozen default scale). */
export const FAR_UNITS_PER_POINT = 8192;

export interface SceneOrigin { readonly x: bigint; readonly y: bigint }
interface Address { readonly x: bigint; readonly y: bigint }

export const toFarX = (origin: SceneOrigin, a: Address): number => Number(a.x - origin.x) / FAR_UNITS_PER_POINT;
export const toFarY = (origin: SceneOrigin, a: Address): number => -Number(a.y - origin.y) / FAR_UNITS_PER_POINT;
/** A FAR-point position back to canonical world units, rounded to the integer the authority speaks in. */
export const fromFar = (origin: SceneOrigin, x: number, y: number): Address => ({
  x: origin.x + BigInt(Math.round(x * FAR_UNITS_PER_POINT)),
  y: origin.y - BigInt(Math.round(y * FAR_UNITS_PER_POINT)),
});

const PUBLIC_SECTION_ORDER: readonly PublicTopicSection[] = ['love', 'marriage', 'family', 'parenting', 'people', 'work_money', 'study_future',
  'inner_self', 'health_body', 'loss_crisis', 'faith_meaning', 'life_changes', 'open'];

/** A Public entry's dye comes from its authoritative section and nothing else; an entry with none is indigo. */
export function publicDye(section: PublicTopicSection | undefined): Dye {
  if (section === undefined) return 0;
  return (PUBLIC_SECTION_ORDER.indexOf(section) % 6) as Dye;
}

export interface PublicSceneFacts {
  readonly entries: ReadonlyArray<PublicFieldEntry>;
  readonly focusId: string | null;
  /** The focused Experience's server-stated relations (ids of the other side), or none. */
  readonly relatedIds?: readonly string[];
  readonly section: PublicTopicSection | null;
  readonly rtl: boolean;
}

export function publicScene(facts: PublicSceneFacts, origin: SceneOrigin): NasijSceneInput {
  const entities: NasijEntity[] = facts.entries.map((e) => ({
    id: e.id, kind: 'EXPERIENCE', x: toFarX(origin, e.address), y: toFarY(origin, e.address), dye: publicDye(e.section),
    label: e.title ?? e.meaning, fromRung: 0, region: e.region,
  }));
  const receded = facts.section === null ? undefined : new Set(facts.entries.filter((e) => e.section !== facts.section).map((e) => e.id));
  const ties: NasijTie[] = facts.focusId === null ? [] : (facts.relatedIds ?? []).map((id) => ({ a: facts.focusId as string, b: id }));
  return { world: 'PUBLIC', rungs: 3, entities, ties, focusId: facts.focusId, receded, rtl: facts.rtl };
}

export function sharedScene(entries: ReadonlyArray<SharedFieldEntry>, focusId: string | null, rtl: boolean, origin: SceneOrigin): NasijSceneInput {
  // A Shared place carries no category the client may show, so every place takes the one dye.
  const entities: NasijEntity[] = entries.map((e) => ({
    id: e.id, kind: 'PLACE', x: toFarX(origin, e.address), y: toFarY(origin, e.address), dye: 0, label: e.meaning, fromRung: 0, region: e.region,
  }));
  return { world: 'SHARED', rungs: 3, entities, focusId, rtl };
}

export const PERSONAL_DEPTHS = ['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'] as const;
export type PersonalDepth = (typeof PERSONAL_DEPTHS)[number];

/**
 * One Personal scene, as the production derivation disclosed it at ONE depth and ONE time. Threads sit at their Homes;
 * a Reading is drawn once per contextual appearance, tied to the Thread that hosts it (the one relation the Personal
 * map may draw). Objects with no place are counted for the fringe and never given one. No label is produced: the
 * Personal map draws no names.
 */
export function personalScene(scene: MapScene, inspectedKey: string | null, rtl: boolean, origin: SceneOrigin): NasijSceneInput {
  const entities: NasijEntity[] = [];
  let fringe = 0;
  for (const object of scene.objects) {
    const fromRung = PERSONAL_DEPTHS.indexOf(object.disclosedAtDepth as PersonalDepth);
    if (object.loci.length === 0) { fringe += 1; continue; }
    for (const locus of object.loci) {
      if (locus.kind === 'THREAD_HOME') {
        entities.push({ id: object.key, kind: 'THREAD', x: toFarX(origin, locus.address), y: toFarY(origin, locus.address), dye: 0, label: null, fromRung });
      } else {
        entities.push({
          id: `${object.key}@${locus.bindingId}`, kind: 'READING', x: toFarX(origin, locus.hostAddress), y: toFarY(origin, locus.hostAddress), dye: 1, label: null,
          hostId: `THREAD:${locus.threadId}`, ordinal: locus.ordinal, solid: locus.current, fromRung,
        });
      }
    }
  }
  const focusId = inspectedKey === null ? null : entities.find((e) => e.id === inspectedKey || e.id.startsWith(`${inspectedKey}@`))?.id ?? null;
  return { world: 'PERSONAL', rungs: PERSONAL_DEPTHS.length, entities, focusId, fringe, rtl };
}

const EMPTY_LAYER = (rung: number): NasijLayer => ({ rung, batches: [], labels: [], hits: [] });

/**
 * The Personal cloth across rungs. Each rung is its own authorised read; a rung the client does not hold contributes
 * no layer and is reported as unheld, so the camera shows its held neighbour instead of guessing.
 */
export function personalDrawList(byRung: ReadonlyArray<NasijSceneInput | null>): { list: NasijDrawList; held: boolean[] } {
  const compiled = byRung.map((input) => (input === null ? null : compileNasij(input)));
  const layers = compiled.map((list, rung) => list?.layers[rung] ?? EMPTY_LAYER(rung));
  const widest = compiled.find((list) => list !== null) ?? null;
  const deepest = [...compiled].reverse().find((list) => list !== null) ?? null;
  return {
    list: {
      world: 'PERSONAL', layers, bounds: widest?.bounds ?? null, border: [], fringe: deepest?.fringe ?? 0,
      digest: compiled.map((list) => list?.digest ?? '--------').join(''),
    },
    held: compiled.map((list) => list !== null),
  };
}
