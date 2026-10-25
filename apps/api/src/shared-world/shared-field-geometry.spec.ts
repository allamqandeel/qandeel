// S8A-04 CP2 — the Shared field geometry (Controlled Amendment §4.2): the server derives every point from the anchors the
// placer named. Pinned here: the exact points of the rules, determinism, independence from input order, the spacing and
// bound of every point, the refusals, and that the module reads nothing but its arguments (no time, random, hash or
// floating-point trigonometry).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FIELD_RADIUS, FIELD_REGION_RING, FIELD_SPACING, FIELD_UNIT, SHARED_FIELD_LAYOUT_VERSION, compareCodePoints, inMeaningOrder, placeNewMeanings,
  type ExistingFieldPlace, type FieldAnchor, type FieldPoint, type NewFieldMeaning,
} from './shared-field-geometry';

const U = FIELD_UNIT;
const at = (x: bigint, y: bigint): FieldPoint => ({ x, y });
const anchors = (entries: Record<string, FieldAnchor[]>) => new Map(Object.entries(entries));
const square = (value: bigint) => value * value;
const distance2 = (l: FieldPoint, r: FieldPoint) => square(l.x - r.x) + square(l.y - r.y);

describe('S8A-04 CP2 — the Shared field geometry: the rules, exactly', () => {
  it('the constants of §4.2', () => {
    expect(SHARED_FIELD_LAYOUT_VERSION).toBe('shared_field_anchor_v1');
    expect(U).toBe(1_048_576n);
    expect(FIELD_SPACING).toBe(4n * U);
    expect(FIELD_RADIUS).toEqual({ 1: 4n * U, 2: 12n * U, 3: 24n * U });
    expect(FIELD_REGION_RING).toBe(64n * U);
  });

  it('an empty World: the first region is founded at (0, 0), the next region on the first ring, in code-point order of its key', () => {
    const meanings: NewFieldMeaning[] = [{ ref: 'N1', meaning: 'b', region: 'work' }, { ref: 'N2', meaning: 'a', region: 'home' }];
    const points = placeNewMeanings([], meanings, anchors({ N1: [{ to: 'R:work', closeness: 2 }], N2: [{ to: 'R:home', closeness: 2 }] }));
    expect(points).toEqual(new Map([['N2', at(0n, 0n)], ['N1', at(64n * U, 0n)]]));
  });

  it('a meaning anchored to a place sits on the spiral around it at the radius of its closeness, the first free angle', () => {
    const existing: ExistingFieldPlace[] = [{ ref: 'P1', point: at(0n, 0n), region: 'home', order: 1 }];
    expect(placeNewMeanings(existing, [{ ref: 'N1', meaning: 'x', region: 'home' }], anchors({ N1: [{ to: 'P1', closeness: 1 }] })))
      .toEqual(new Map([['N1', at(4n * U, 0n)]]));
    expect(placeNewMeanings(existing, [{ ref: 'N1', meaning: 'x', region: 'home' }], anchors({ N1: [{ to: 'P1', closeness: 3 }] })))
      .toEqual(new Map([['N1', at(24n * U, 0n)]]));
    // Angle 0 taken; 30° and 60° (from the fixed integer tables) fall closer than the spacing to it; 90° is the first free.
    const crowded = [...existing, { ref: 'P2', point: at(4n * U, 0n), region: 'home', order: 2 }];
    expect(placeNewMeanings(crowded, [{ ref: 'N1', meaning: 'x', region: 'home' }], anchors({ N1: [{ to: 'P1', closeness: 1 }] })))
      .toEqual(new Map([['N1', at(0n, 4n * U)]]));
  });

  it('several anchors: the weighted centre (3 / 2 / 1), then the spiral at the closest radius; an existing region is reached through its first place', () => {
    const existing: ExistingFieldPlace[] = [
      { ref: 'P2', point: at(100n * U, 0n), region: 'work', order: 2 },
      { ref: 'P1', point: at(0n, 0n), region: 'work', order: 1 },
    ];
    const points = placeNewMeanings(existing, [{ ref: 'N1', meaning: 'x', region: 'work' }],
      anchors({ N1: [{ to: 'P2', closeness: 1 }, { to: 'R:work', closeness: 3 }] }));
    // centre = (3·100U + 1·0) / 4 = 75U; radius 4U at angle 0.
    expect(points).toEqual(new Map([['N1', at(79n * U, 0n)]]));
  });

  it('a new meaning may anchor to another new meaning: it is placed after it (topological order), ties by code point', () => {
    const meanings: NewFieldMeaning[] = [{ ref: 'N1', meaning: 'أ', region: 'home' }, { ref: 'N2', meaning: 'ب', region: 'home' }];
    const points = placeNewMeanings([], meanings, anchors({ N1: [{ to: 'N2', closeness: 1 }], N2: [{ to: 'R:home', closeness: 2 }] }));
    expect(points).toEqual(new Map([['N2', at(0n, 0n)], ['N1', at(4n * U, 0n)]]));
  });

  it('refuses what cannot be derived: an unknown target, a cycle, a meaning without anchors, a repeated ref', () => {
    const one: NewFieldMeaning[] = [{ ref: 'N1', meaning: 'x', region: 'home' }];
    expect(placeNewMeanings([], one, anchors({ N1: [{ to: 'P9', closeness: 1 }] }))).toBeNull();
    expect(placeNewMeanings([], one, anchors({}))).toBeNull();
    expect(placeNewMeanings([], [...one, { ref: 'N2', meaning: 'y', region: 'home' }],
      anchors({ N1: [{ to: 'N2', closeness: 1 }], N2: [{ to: 'N1', closeness: 1 }] }))).toBeNull();
    expect(placeNewMeanings([], [...one, { ref: 'N1', meaning: 'y', region: 'home' }], anchors({ N1: [{ to: 'R:home', closeness: 1 }] }))).toBeNull();
  });

  it('orders by Unicode code point, not UTF-16 code unit', () => {
    expect(compareCodePoints('\u{1F600}', '￿')).toBeGreaterThan(0);
    expect('\u{1F600}' < '￿').toBe(true);
    expect(inMeaningOrder([{ meaning: 'ب', region: 'x' }, { meaning: 'أ', region: 'x' }]).map((m) => m.meaning)).toEqual(['أ', 'ب']);
  });
});

describe('S8A-04 CP2 — the Shared field geometry: properties', () => {
  // A seeded generator for the TEST's cases only; the module itself has none.
  const generator = (seed: number) => () => { seed = (Math.imul(seed, 1_103_515_245) + 12_345) >>> 0; return seed >>> 8; };
  const REGIONS = ['home', 'work', 'money', 'family'];
  function scenario(seed: number) {
    const next = generator(seed);
    const existing: ExistingFieldPlace[] = [];
    for (let index = 0; index < next() % 30; index += 1) {
      existing.push({ ref: `P${index + 1}`, point: at(BigInt(next() % 2000 - 1000) * U, BigInt(next() % 2000 - 1000) * U), region: REGIONS[next() % 4], order: index });
    }
    const meanings: NewFieldMeaning[] = Array.from({ length: 1 + (next() % 3) }, (_, index) => ({ ref: `N${index + 1}`, meaning: `m${next() % 50}-${index}`, region: REGIONS[next() % 4] }));
    const map = new Map<string, FieldAnchor[]>();
    meanings.forEach((meaning, index) => {
      const targets = [...existing.map((place) => place.ref), ...meanings.slice(0, index).map((other) => other.ref), 
        // Only the regions the request holds, as `sharedPlacementTargets` gives them.
        ...[...new Set([...existing, ...meanings].map((entry) => entry.region))].map((region) => `R:${region}`)];
      const own: FieldAnchor[] = [];
      for (let count = 1 + (next() % 3); own.length < count;) {
        const to = targets[next() % targets.length];
        if (!own.some((anchor) => anchor.to === to)) own.push({ to, closeness: (1 + (next() % 3)) as 1 | 2 | 3 });
      }
      map.set(meaning.ref, own);
    });
    return { existing, meanings, map };
  }

  it('for 200 Worlds: deterministic, independent of input order, every new point spaced and within bound, no existing point moved', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const { existing, meanings, map } = scenario(seed);
      const points = placeNewMeanings(existing, meanings, map);
      expect(points).not.toBeNull();
      const placed = points as Map<string, FieldPoint>;
      expect(placeNewMeanings(existing, meanings, map)).toEqual(placed);
      expect(placeNewMeanings([...existing].reverse(), [...meanings].reverse(), new Map([...map].reverse()))).toEqual(placed);
      expect([...placed.keys()].sort()).toEqual(meanings.map((meaning) => meaning.ref).sort());
      const all = [...existing.map((place) => place.point), ...placed.values()];
      for (const point of placed.values()) {
        expect(point.x >= -(2n ** 62n) && point.x < 2n ** 62n && point.y >= -(2n ** 62n) && point.y < 2n ** 62n).toBe(true);
        for (const other of all) if (other !== point) expect(distance2(point, other) >= square(FIELD_SPACING)).toBe(true);
      }
    }
  });

  it('reads nothing but its arguments: no time, random, crypto, hash, environment or floating-point trigonometry', () => {
    const source = readFileSync(resolve(__dirname, 'shared-field-geometry.ts'), 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//gu, '');
    for (const forbidden of [/Math\.(?!min\()/u, /Date/u, /performance/u, /crypto/u, /createHash/u, /process\./u, /\bimport\b/u, /require\(/u, /\bNumber\(/u, /parseFloat/u]) {
      expect(source).not.toMatch(forbidden);
    }
  });
});
