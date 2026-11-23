/**
 * REPLAY-COSMOS-01 — synthetic history for the Replay COSMOS tests (no customer content): the scenes as T-04 discloses
 * them (Threads at WORLD, their Reading appearances from THREAD down), through the production Personal chain.
 *
 * Six moments: topics established at 1, 3 and 5; a Reading bound at 4.
 */
import type { MapScene } from '../../map';
import { canonicalWorldAddress } from '../../map/world';
import { buildReplayCameraPlan } from '../camera-plan';
import type { ReplayCosmosScene } from '../frame';
import { emptyReplayStage, replayMomentStage, type ReplayMomentStage } from '../stages';
import type { ReplayCosmosTimeline } from '../timeline';

const FAR = 8192;
// A disclosed Home, decoded through the governed world-address reader (as the COSMOS core tests do); never placed here.
const addr = (x: number, y: number) => { const a = canonicalWorldAddress(BigInt(Math.round(x * FAR)), BigInt(Math.round(-y * FAR))); if (!a.ok) throw new Error('not canonical'); return a.address; };
const DEPTHS = ['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'] as const;

export interface Knowledge { readonly threads: readonly { id: string; x: number; y: number }[]; readonly readings: readonly { id: string; threadId: string; bindingId: string; boundSp: number }[] }

function sceneAt(k: Knowledge, rung: number, tc: number): MapScene {
  const homes = new Map(k.threads.map((t) => [t.id, addr(t.x, t.y)] as const));
  const objects: unknown[] = k.threads.map((t) => ({ family: 'THREAD', id: t.id, key: `THREAD:${t.id}`, disclosedAtDepth: 'WORLD', loci: [{ kind: 'THREAD_HOME', threadId: t.id, address: homes.get(t.id) }] }));
  if (rung >= 1) for (const r of k.readings) {
    objects.push({ family: 'READING', id: r.id, key: `READING:${r.id}`, disclosedAtDepth: 'THREAD', loci: [{ kind: 'CONTEXTUAL_APPEARANCE', bindingId: r.bindingId, threadId: r.threadId, hostAddress: homes.get(r.threadId), boundSp: r.boundSp, current: true, ordinal: 0 }] });
  }
  return { sessionId: 'SYNTHETIC', tc, liveHead: tc, sealed: true, depth: DEPTHS[rung], objects, homes: [], ungeographic: [] } as unknown as MapScene;
}
export const stageOf = (ordinal: number, k: Knowledge, names: Record<string, string> = {}): ReplayMomentStage =>
  replayMomentStage(ordinal, DEPTHS.map((_, rung) => sceneAt(k, rung, ordinal)), new Map(Object.entries(names)), false);

const T1 = { id: 'a1', x: -0.6, y: -0.4 }; const T2 = { id: 'b2', x: 0.7, y: 0.2 }; const T3 = { id: 'c3', x: -0.1, y: 0.8 };
const R1 = { id: 'r1', threadId: 'a1', bindingId: 'g1', boundSp: 4 };
export const KNOWLEDGE: Record<number, Knowledge> = {
  1: { threads: [T1], readings: [] }, 2: { threads: [T1], readings: [] }, 3: { threads: [T1, T2], readings: [] },
  4: { threads: [T1, T2], readings: [R1] }, 5: { threads: [T1, T2, T3], readings: [R1] }, 6: { threads: [T1, T2, T3], readings: [R1] },
};
export const STAGES = new Map([1, 2, 3, 4, 5, 6].map((o) => [o, stageOf(o, KNOWLEDGE[o], { a1: 'العمل', b2: 'Family', c3: 'السفر 2026' })] as const));
export const VIEW = { width: 360, height: 640 };
export const sceneOf = (timeline: ReplayCosmosTimeline): ReplayCosmosScene => ({
  timeline, plan: buildReplayCameraPlan(timeline, STAGES, VIEW),
  stages: new Map([...STAGES].map(([o, stage]) => [o, { stage, prepared: null as never }])), empty: { stage: emptyReplayStage(), prepared: null as never },
  rtl: false, fontScale: 1, typography: 'SYSTEM_LIVE_WEIGHTS', fonts: null,
});
