// T-03B2b1 - Canonical Home Placement Engine v1: the append-only world law at
// scale (task sections 11 and 14, items 27-30). The 10,000-Thread run lives in
// tests/canonical-home-placement-engine-contract.test.mjs (separate process,
// API CI) so this suite stays fast; its outcome is pinned in the same vectors.

import {
  chebyshevDistance,
  fingerprintWorld,
  floorDiv,
  outerHalfBoundary,
  placeCanonicalHome,
  radiusForAttempt,
  SeparationIndex,
} from './home-placement-engine';
import { runStressScenario, STRESS_USER_WORLD_ID, stressOrigin, stressThreadId } from './home-placement-scenario';
import { CANONICAL_HOME_PLACEMENT_STRESS_GOLDENS } from './home-placement-vectors';
import { MAX_ATTEMPTS, MIN_HOME_SEPARATION, type CanonicalExistingHome } from './home-placement.types';

const golden = (threads: number) => {
  const found = CANONICAL_HOME_PLACEMENT_STRESS_GOLDENS.find((entry) => entry.threads === threads);
  if (found === undefined) throw new Error(`no stress golden for ${threads}`);
  return found;
};
const rotate = (homes: readonly CanonicalExistingHome[], by: number) => [...homes.slice(by), ...homes.slice(0, by)];

describe('append-only world growth at scale', () => {
  it('100 Threads: zero movement - every placement replays exactly against the world as it then stood, in any order (items 27, 30)', () => {
    const run = runStressScenario(100);
    expect(run.world).toHaveLength(100);
    expect(run.placements).toHaveLength(100);
    run.placements.forEach((placed, index) => {
      expect(run.world[index]).toEqual({ threadId: stressThreadId(index), x: placed.x, y: placed.y });
      const prefix = run.world.slice(0, index);
      const replay = placeCanonicalHome({
        userWorldId: STRESS_USER_WORLD_ID,
        newThreadId: stressThreadId(index),
        origin: stressOrigin(index, prefix),
        existingHomes: rotate(prefix, index % 3),
      });
      expect(replay).toEqual(placed);
    });
    expect(fingerprintWorld(run.world)).toBe(golden(100).worldFingerprint);
    expect(run.maxAttempt).toBe(golden(100).maxAttempt);
    expect(run.originCounts).toEqual({ NONE: 28, RESOLVED: 24, MULTIPLE: 24, AMBIGUOUS: 24 });
  });

  it('the same canonical set constructed in the same order reproduces the exact placements (item 30)', () => {
    const first = runStressScenario(100);
    const second = runStressScenario(100);
    expect(second.placements).toEqual(first.placements);
    expect(second.world).toEqual(first.world);
  });

  it('1,000 Threads: unique placements, exact pairwise separation, annulus discipline, truthful origin bases, pinned outcome (item 28)', () => {
    const run = runStressScenario(1_000);
    const seen = new Set<string>();
    const index = new SeparationIndex();
    run.world.forEach((committed, position) => {
      const key = `${committed.x}\t${committed.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(index.isAdmissible(committed)).toBe(true);
      index.insert(committed);
      const placed = run.placements[position];
      const base = { x: placed.baseX, y: placed.baseY };
      const reach = chebyshevDistance(committed, base);
      expect(reach >= outerHalfBoundary(radiusForAttempt(placed.attempt))).toBe(true);
      expect(reach <= radiusForAttempt(placed.attempt)).toBe(true);
      const origin = stressOrigin(position, run.world.slice(0, position));
      if (origin.state === 'NONE') {
        expect(base).toEqual({ x: 0n, y: 0n });
      } else {
        const count = BigInt(origin.homes.length);
        const sumX = origin.homes.reduce((sum, member) => sum + member.x, 0n);
        const sumY = origin.homes.reduce((sum, member) => sum + member.y, 0n);
        expect(base).toEqual({ x: floorDiv(sumX, count), y: floorDiv(sumY, count) });
      }
    });
    expect(seen.size).toBe(1_000);
    for (let position = 0; position < 1_000; position += 97) {
      const earlier = run.world.slice(0, position);
      expect(earlier.every((existing) => chebyshevDistance(run.world[position], existing) >= MIN_HOME_SEPARATION)).toBe(true);
    }
    expect(run.maxAttempt).toBeLessThan(MAX_ATTEMPTS);
    expect(fingerprintWorld(run.world)).toBe(golden(1_000).worldFingerprint);
    expect(run.maxAttempt).toBe(golden(1_000).maxAttempt);
    expect(run.originCounts).toEqual({ NONE: 253, RESOLVED: 249, MULTIPLE: 249, AMBIGUOUS: 249 });
  });

  it('W0 -> P1, W1 -> P2, W2 -> P3: P1 and P2 never change once P3 exists (section 11)', () => {
    const run = runStressScenario(3);
    const [p1, p2, p3] = run.placements;
    const again1 = placeCanonicalHome({ userWorldId: STRESS_USER_WORLD_ID, newThreadId: stressThreadId(0), origin: { state: 'NONE' }, existingHomes: [] });
    const again2 = placeCanonicalHome({
      userWorldId: STRESS_USER_WORLD_ID,
      newThreadId: stressThreadId(1),
      origin: stressOrigin(1, run.world.slice(0, 1)),
      existingHomes: run.world.slice(0, 1),
    });
    expect(again1).toEqual(p1);
    expect(again2).toEqual(p2);
    expect(p3.worldFingerprint).not.toBe(p2.worldFingerprint);
    expect(chebyshevDistance(p3, p1) >= MIN_HOME_SEPARATION).toBe(true);
    expect(chebyshevDistance(p3, p2) >= MIN_HOME_SEPARATION).toBe(true);
    expect(run.world[0]).toEqual({ threadId: stressThreadId(0), x: p1.x, y: p1.y });
    expect(run.world[1]).toEqual({ threadId: stressThreadId(1), x: p2.x, y: p2.y });
  });

  it('pins the 10,000-Thread outcome for the separate-process replay', () => {
    expect(golden(10_000)).toEqual({ threads: 10_000, worldFingerprint: '348c972c9c024d2c5cff2e5a194e42f77b3d6a4c11611ccf6ca07665ad0b8937', maxAttempt: 603 });
  });
});
