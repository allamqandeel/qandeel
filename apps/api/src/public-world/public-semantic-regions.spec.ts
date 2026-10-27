// S8A-05 CP3 — Controlled Amendment A-4: the closed region vocabulary and its geometry, as the API holds them, are exactly
// migration 0181's seed; the profile decoder and the dominant rule are the database's; the spiral is the documented ring walk.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PUBLIC_MAJOR_REGIONS, PUBLIC_REGION_MAX_SLOT, PUBLIC_SUB_REGIONS, PUBLIC_SUB_REGION_KEYS, decodePublicRegionProfile,
  dominantSubRegion, hexSlot, latticePoint,
} from './public-semantic-regions';

const MIGRATION = join(__dirname, '../../../../database/migrations/0181_s8a_05_public_semantic_placement_v1.sql');

function ringWalk(k: bigint): [bigint, bigint] {
  if (k === 0n) return [0n, 0n];
  let n = 1n;
  while (3n * n * (n + 1n) < k) n += 1n;
  const s = k - (3n * n * (n - 1n) + 1n);
  const side = Number(s / n);
  const step = s % n;
  const corners: Array<[bigint, bigint]> = [[-n, n], [0n, n], [n, 0n], [n, -n], [0n, -n], [-n, 0n]];
  const directions: Array<[bigint, bigint]> = [[1n, 0n], [1n, -1n], [0n, -1n], [-1n, 0n], [-1n, 1n], [0n, 1n]];
  return [corners[side][0] + step * directions[side][0], corners[side][1] + step * directions[side][1]];
}

describe('S8A-05 CP3 — the Public region vocabulary (A-4)', () => {
  it('is exactly the migration 0181 seed: 46 sub-regions of 13 majors, ordinals 1..46, the same centres', () => {
    const seeded = [...readFileSync(MIGRATION, 'utf8').matchAll(/\('([a-z_.]+)', '([a-z]+)', (\d+), (-?\d+), (-?\d+)\)/gu)]
      .map((m) => ({ key: m[1], major: m[2], ordinal: Number(m[3]), q: BigInt(m[4]), r: BigInt(m[5]) }));
    expect(PUBLIC_SUB_REGIONS.map(({ key, major, ordinal, q, r }) => ({ key, major, ordinal, q, r }))).toEqual(seeded);
    expect(PUBLIC_SUB_REGIONS.map((region) => region.ordinal)).toEqual(Array.from({ length: 46 }, (_, i) => i + 1));
    expect(PUBLIC_MAJOR_REGIONS).toHaveLength(13);
    expect(new Set(PUBLIC_SUB_REGIONS.map((region) => region.major))).toEqual(new Set(PUBLIC_MAJOR_REGIONS.map((major) => major.key)));
    for (const key of PUBLIC_SUB_REGION_KEYS) expect(key).toMatch(/^[a-z0-9][a-z0-9_.-]{0,63}$/u);
  });

  it('is not the browsing sections: no sub-region or major is a section key', () => {
    const sections = ['love', 'marriage', 'family', 'parenting', 'people', 'work_money'];
    for (const key of PUBLIC_SUB_REGION_KEYS) expect(sections).not.toContain(key);
  });

  it('decodes a profile exactly: 1-3 known sub-regions, hundredths >= 0.10 summing to 1, nothing else', () => {
    expect(decodePublicRegionProfile({ regions: [{ key: 'work.pressure', weight: 0.7 }, { key: 'inner.sadness', weight: 0.3 }] }))
      .toEqual({ regions: [{ key: 'work.pressure', hundredths: 70 }, { key: 'inner.sadness', hundredths: 30 }] });
    expect(decodePublicRegionProfile({ regions: [{ key: 'loss.grief', weight: 1 }] })).toEqual({ regions: [{ key: 'loss.grief', hundredths: 100 }] });
    for (const bad of [
      null, [], {}, { regions: [] }, { regions: 'work.pressure' }, { regions: [{ key: 'work.pressure', weight: 1 }], x: 1 },
      { regions: [{ key: 'work.pressure', weight: 1, y: 2 }] }, { regions: [{ key: 'work', weight: 1 }] },
      { regions: [{ key: 'work.pressure', weight: 0.95 }, { key: 'loss.grief', weight: 0.05 }] },
      { regions: [{ key: 'work.pressure', weight: 0.5 }, { key: 'loss.grief', weight: 0.4 }] },
      { regions: [{ key: 'work.pressure', weight: 0.505 }, { key: 'loss.grief', weight: 0.495 }] },
      { regions: [{ key: 'work.pressure', weight: 0.5 }, { key: 'work.pressure', weight: 0.5 }] },
      { regions: ['a', 'b', 'c', 'd'].map((_, i) => ({ key: PUBLIC_SUB_REGION_KEYS[i], weight: 0.25 })) },
      { regions: [{ key: 'work.pressure', weight: Number.NaN }] }, { regions: [{ key: 'work.pressure', weight: 1.1 }] },
    ]) expect(decodePublicRegionProfile(bad)).toBeNull();
  });

  it('keeps the dominant sub-region by weight, then the lower ordinal, whatever the answer order', () => {
    const profile = (pairs: Array<[string, number]>) => decodePublicRegionProfile({ regions: pairs.map(([key, weight]) => ({ key, weight })) })!;
    expect(dominantSubRegion(profile([['inner.sadness', 0.4], ['work.pressure', 0.6]]))).toBe('work.pressure');
    expect(dominantSubRegion(profile([['work.pressure', 0.5], ['family.parents', 0.5]]))).toBe('family.parents');
    expect(dominantSubRegion(profile([['family.parents', 0.5], ['work.pressure', 0.5]]))).toBe('family.parents');
  });

  it('walks the documented spiral and keeps every point on the 8,000 lattice', () => {
    const seen = new Set<string>();
    for (let k = 0n; k <= 5000n; k += 1n) {
      expect(hexSlot(k)).toEqual(ringWalk(k));
      seen.add(hexSlot(k).join(','));
    }
    expect(seen.size).toBe(5001);
    expect(hexSlot(PUBLIC_REGION_MAX_SLOT)).toEqual(ringWalk(PUBLIC_REGION_MAX_SLOT));
    expect(() => hexSlot(-1n)).toThrow(RangeError);
    expect(() => hexSlot(PUBLIC_REGION_MAX_SLOT + 1n)).toThrow(RangeError);
    const [x, y] = latticePoint(...hexSlot(1n));
    expect(Math.hypot(Number(x), Number(y))).toBeGreaterThanOrEqual(8000);
    expect(latticePoint(1n, 0n)).toEqual([8000n, 0n]);
  });
});
