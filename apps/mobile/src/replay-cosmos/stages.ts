/**
 * REPLAY-COSMOS-01 — the COSMOS stage of ONE disclosed moment, through the PRODUCTION Personal chain only.
 *
 * Per Personal depth, the T-04 scene the governed adapter disclosed for that (moment, depth) — `discloseReplayMoment` →
 * `mapInspectionContext`, exactly as the live Personal owner reads its own projection — becomes, through the production
 * `personalScene` → `personalDrawList`, the ONE stage both the app and the video draw. Nothing here places, names,
 * relates or discloses anything itself: a Thread is labelled only with a name the Replay disclosed for it, and no focus
 * ring is drawn (a Replay records no inspection; the live map's rings are the live reader's).
 */
import { PERSONAL_DEPTHS, personalDrawList, personalScene } from '../cosmos/core/adapters';
import type { Stage, StageHit } from '../cosmos/core/stage';
import type { MapScene } from '../map';

/** The production owners' scene origin (owner-core ORIGIN). */
const ORIGIN = { x: BigInt(0), y: BigInt(0) };

export interface ReplayMomentStage {
  readonly ordinal: number;
  readonly list: Stage;
  readonly held: readonly boolean[];
  /** Each drawn Reading appearance (its production mark id) → the Thread mark it is bound to, from the disclosed scenes. */
  readonly hosts: ReadonlyMap<string, string>;
}

/**
 * The stage of one moment. `scenes[r]` is the scene disclosed at PERSONAL_DEPTHS[r] (null: that depth disclosed none,
 * which the production chain holds as an unheld rung). `names`: Thread id → the name the Replay disclosed (absent: no
 * label — never invented).
 */
export function replayMomentStage(ordinal: number, scenes: readonly (MapScene | null)[], names: ReadonlyMap<string, string>, rtl: boolean): ReplayMomentStage {
  if (scenes.length !== PERSONAL_DEPTHS.length) throw new Error('replayMomentStage: one scene (or null) per Personal depth');
  const byRung = scenes.map((scene) => (scene === null ? null : personalScene(scene, null, rtl, ORIGIN, names)));
  const { list, held } = personalDrawList(byRung);
  const hosts = new Map<string, string>();
  for (const input of byRung) for (const e of input?.entities ?? []) if (e.kind === 'READING' && e.hostId !== undefined) hosts.set(e.id, e.hostId);
  return { ordinal, list, held, hosts };
}

/** A stage with nothing disclosed: before the first disclosure of a scope that opens on nothing. */
export function emptyReplayStage(): ReplayMomentStage {
  return { ordinal: 0, ...personalDrawList(PERSONAL_DEPTHS.map(() => null)), hosts: new Map() };
}

/** A mark's position at one rung, from the production stage's own hit targets (never recomputed here). */
export function markOf(stage: Stage, rung: number, id: string): StageHit | null {
  const layer = stage.layers[rung];
  if (layer === undefined) return null;
  return layer.hits.find((h) => h.id === id || h.id.startsWith(`${id}@`)) ?? null;
}

/** The Thread and Reading marks a stage draws, by family (ids as the production stage keys them). */
export function marksOf(stage: Stage): { readonly threads: readonly string[]; readonly readings: readonly string[] } {
  const threads = new Set<string>();
  const readings = new Set<string>();
  for (const layer of stage.layers) {
    for (const hit of layer.hits) {
      if (hit.id.startsWith('THREAD:')) threads.add(hit.id);
      else if (hit.id.startsWith('READING:')) readings.add(hit.id.split('@')[0]);
    }
  }
  return { threads: [...threads].sort(), readings: [...readings].sort() };
}
