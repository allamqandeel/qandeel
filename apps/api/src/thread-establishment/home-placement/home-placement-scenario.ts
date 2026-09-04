// T-03B2b1 - the deterministic append-growth scenario behind the 100 / 1,000 /
// 10,000 Thread proofs (task sections 11 and 14, items 27-30).
//
// Pure engineering fixture: no Product value, no random source, no clock. The
// same code drives the Jest suites in-process and the static contract's
// separate-process replay, so the pinned outcomes in
// `home-placement-vectors.ts` are one contract, not two.

import { placeCanonicalHome } from './home-placement-engine';
import type { CanonicalExistingHome, CanonicalHomePlacement, ConversationalOrigin } from './home-placement.types';

export const STRESS_USER_WORLD_ID = 'stress-user-world-v1';

/** Zero-padded so that identity order equals establishment order below 100 000. */
export function stressThreadId(index: number): string {
  return `thread-${String(index).padStart(5, '0')}`;
}

/**
 * The origin of the `index`-th Thread (zero-based) given the Homes already
 * placed, cycling NONE / RESOLVED / MULTIPLE / AMBIGUOUS with members given
 * deliberately out of identity order.
 */
export function stressOrigin(index: number, placed: readonly CanonicalExistingHome[]): ConversationalOrigin {
  const kind = index % 4;
  if (kind === 0 || index < 4) return { state: 'NONE' };
  if (kind === 1) return { state: 'RESOLVED', homes: [placed[index - 1]] };
  if (kind === 2) return { state: 'MULTIPLE', homes: [placed[index - 1], placed[index - 2]] };
  return { state: 'AMBIGUOUS', homes: [placed[index - 1], placed[index - 3], placed[index - 2]] };
}

/**
 * A 7x7 lattice of Homes 400 000 apart around `center` (itself the middle
 * Home). Every shell-1 candidate around the center lies within 200 000 of a
 * lattice Home, so a Thread with RESOLVED origin `center` can only be placed
 * from shell 2 onward (attempt >= CANDIDATES_PER_SHELL) - and no lattice Home
 * moves to make room.
 */
export function denseWorldAround(center: CanonicalExistingHome): readonly CanonicalExistingHome[] {
  const homes: CanonicalExistingHome[] = [];
  for (let row = -3; row <= 3; row += 1) {
    for (let column = -3; column <= 3; column += 1) {
      if (row === 0 && column === 0) {
        homes.push(center);
        continue;
      }
      homes.push(Object.freeze({
        threadId: `${center.threadId}-r${row + 3}c${column + 3}`,
        x: center.x + BigInt(column) * 400_000n,
        y: center.y + BigInt(row) * 400_000n,
      }));
    }
  }
  return Object.freeze(homes);
}

export interface StressScenarioResult {
  /** The committed world in establishment order: placement i became Home i. */
  readonly world: readonly CanonicalExistingHome[];
  readonly placements: readonly CanonicalHomePlacement[];
  readonly maxAttempt: number;
  readonly originCounts: Readonly<Record<ConversationalOrigin['state'], number>>;
}

/**
 * Establishes `count` Threads one after another, each against the world as it
 * then stood. The world is only ever appended to; every earlier placement is
 * carried forward unchanged.
 */
export function runStressScenario(count: number, onPlaced?: (placement: CanonicalHomePlacement, index: number) => void): StressScenarioResult {
  const world: CanonicalExistingHome[] = [];
  const placements: CanonicalHomePlacement[] = [];
  const originCounts = { NONE: 0, RESOLVED: 0, MULTIPLE: 0, AMBIGUOUS: 0 };
  let maxAttempt = 0;
  for (let index = 0; index < count; index += 1) {
    const origin = stressOrigin(index, world);
    originCounts[origin.state] += 1;
    const placed = placeCanonicalHome({ userWorldId: STRESS_USER_WORLD_ID, newThreadId: stressThreadId(index), origin, existingHomes: world });
    if (placed.attempt > maxAttempt) maxAttempt = placed.attempt;
    placements.push(placed);
    world.push(Object.freeze({ threadId: stressThreadId(index), x: placed.x, y: placed.y }));
    onPlaced?.(placed, index);
  }
  return Object.freeze({ world: Object.freeze(world), placements: Object.freeze(placements), maxAttempt, originCounts: Object.freeze(originCounts) });
}
