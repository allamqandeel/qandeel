// S8A-05 CP3 — Controlled Amendment A-4: the closed two-level vocabulary of Public semantic regions and the deterministic
// geometry that turns a reviewed dominant sub-region into one exact point of `QANDEEL_PUBLIC_FIELD_V1`.
//
// The regions are QANDEEL's internal frame of meaning, never a category a person picks or sees: they are not the 13
// browsing sections (a section never reaches the interpreter or the placement), and no region name is ever shown. The
// interpreter answers a profile of one to three sub-regions with weights; the server keeps only the DOMINANT sub-region
// (highest weight; a tie goes to the lower vocabulary ordinal) as the reviewed lens key, and the place is that
// sub-region's centre plus the first free slot of one fixed hexagonal spiral on one global lattice. The secondary
// meanings stay in the themes the panel shows; they never pull the point between distant regions (WP1-R1 §2.5).
//
// The same vocabulary and centres are seeded by migration 0181 (`public_region_private.sub_regions`); a root contract
// test proves the two are identical. This module computes nothing for production placement — the database does that,
// inside the publication transaction — it is the API's decoder and the exact mirror the free simulation uses.

export const PUBLIC_REGION_VOCABULARY_VERSION = 'QANDEEL_PUBLIC_REGIONS_V1' as const;
export const PUBLIC_REGION_LAYOUT_VERSION = 'public_region_dominant_v1' as const;

/** The global lattice: two distinct lattice points are never closer than 8,000 units (8000² ≤ 4000² + 6929²). */
export const PUBLIC_REGION_LATTICE = { column: 8_000n, halfColumn: 4_000n, row: 6_929n } as const;
export const PUBLIC_REGION_MIN_SPACING = 8_000;

/** A profile holds 1–3 distinct sub-regions; each weight is in hundredths, at least 0.10, and they sum to exactly 1.00. */
export const PUBLIC_REGION_PROFILE = { minRegions: 1, maxRegions: 3, minWeight: 10, total: 100 } as const;

export interface PublicMajorRegion {
  readonly key: string;
  readonly definition: string;
}

export interface PublicSubRegion {
  readonly key: string;
  readonly major: string;
  readonly ordinal: number;
  /** The centre, as global lattice coordinates (axial q, r). */
  readonly q: bigint;
  readonly r: bigint;
  readonly definition: string;
}

/** The twelve ring majors in ring order (neighbours are related), then `everyday` at the world's origin. */
export const PUBLIC_MAJOR_REGIONS: ReadonlyArray<PublicMajorRegion> = Object.freeze([
  { key: 'romance', definition: 'love before or outside marriage: attraction, commitment, betrayal, breaking up' },
  { key: 'marriage', definition: 'married life: everyday partnership, conflict, in-laws, divorce or separation' },
  { key: 'parenthood', definition: 'being a parent: raising children, adolescents, pregnancy and fertility' },
  { key: 'family', definition: 'the family one comes from: parents, siblings, caring for elders, inheritance' },
  { key: 'social', definition: 'people beyond the family: friendship, loneliness, social pressure, neighbours and community' },
  { key: 'work', definition: 'work and livelihood: job pressure, colleagues and managers, losing or seeking work, money and debt' },
  { key: 'learning', definition: 'study and early direction: exams, choosing a field, graduating and first steps' },
  { key: 'transitions', definition: 'big life changes: migration and living abroad, moving home or city, life-changing decisions' },
  { key: 'meaning', definition: 'faith and meaning: religious life, doubt and existential questions, values and conscience' },
  { key: 'loss', definition: 'loss and crisis: death and grief, trauma, a sudden crisis' },
  { key: 'health', definition: 'the body: illness, disability or chronic conditions, daily habits, addiction and recovery' },
  { key: 'inner', definition: 'the inner self: anxiety and fear, lasting sadness, self-worth, anger' },
  { key: 'everyday', definition: 'everyday life that fits none of the above: small moments, humour, interests and hobbies' },
]);

const sub = (key: string, ordinal: number, q: number, r: number, definition: string): PublicSubRegion =>
  Object.freeze({ key, major: key.slice(0, key.indexOf('.')), ordinal, q: BigInt(q), r: BigInt(r), definition });

/**
 * The 46 sub-regions, their ordinals and lattice centres. Construction (scratch, geometry only): majors on a ring with
 * 2,000,000 units between neighbours, sub-regions 600,000 units from their major's centre, rotated to keep sub-regions of
 * different majors at least 1,068,000 apart; `everyday` around the origin; every centre snapped to the lattice.
 */
export const PUBLIC_SUB_REGIONS: ReadonlyArray<PublicSubRegion> = Object.freeze([
  sub('romance.attraction', 1, -365, 594, 'attraction, first love, being drawn to someone, attachment'),
  sub('romance.commitment', 2, -271, 479, 'deciding to commit, engagement, how serious a relationship is'),
  sub('romance.betrayal', 3, -193, 521, 'betrayal, cheating, jealousy, lost trust in a partner'),
  sub('romance.breakup', 4, -286, 636, 'breaking up, parting, longing for someone after it ended'),
  sub('marriage.daily_life', 5, -79, 554, 'everyday married life, sharing responsibilities, understanding each other'),
  sub('marriage.conflict', 6, -36, 433, 'conflict between spouses, arguments, communication that breaks down'),
  sub('marriage.in_laws', 7, 78, 412, "a spouse's family, in-laws and their place in the marriage"),
  sub('marriage.separation', 8, 36, 533, 'divorce, separation of spouses and life after it'),
  sub('parenthood.raising', 9, 229, 365, 'raising young children, discipline, a parent\'s daily worries'),
  sub('parenthood.adolescence', 10, 242, 229, 'teenage or grown children and the relationship with them'),
  sub('parenthood.fertility', 11, 365, 242, 'pregnancy, wanting children, infertility, birth'),
  sub('family.parents', 12, 476, 78, 'the relationship with one\'s own father or mother'),
  sub('family.siblings', 13, 396, 37, 'brothers and sisters and the bond between them'),
  sub('family.elder_care', 14, 490, -78, 'caring for ageing or ill parents and relatives'),
  sub('family.inheritance', 15, 569, -37, 'inheritance and money or property within the family'),
  sub('social.friendship', 16, 594, -229, 'friendship, friends, losing or finding a friend'),
  sub('social.loneliness', 17, 479, -208, 'loneliness, isolation, having no one to talk to'),
  sub('social.pressure', 18, 521, -328, 'social expectations, what people say, fitting in'),
  sub('social.community', 19, 636, -350, 'neighbours, the community, people one lives among'),
  sub('work.pressure', 20, 554, -475, 'pressure at work, long hours, burnout'),
  sub('work.relations', 21, 433, -397, 'colleagues and managers, conflict or unfairness at work'),
  sub('work.job_loss', 22, 412, -490, 'losing a job, unemployment, looking for work'),
  sub('work.money', 23, 533, -569, 'money worries, debt, cost of living, a small business'),
  sub('learning.exams', 24, 365, -594, 'exams, grades, pressure of studying'),
  sub('learning.choices', 25, 229, -471, 'choosing a field of study or a university'),
  sub('learning.first_steps', 26, 242, -607, 'graduating, a first job, starting out in life'),
  sub('transitions.migration', 27, 79, -554, 'migration, living abroad, being far from home'),
  sub('transitions.relocation', 28, -8, -404, 'moving to a new home or city and settling in'),
  sub('transitions.big_decision', 29, -71, -490, 'a decision that changes the course of one\'s life'),
  sub('meaning.faith', 30, -229, -365, 'faith, religious practice, the relationship with God'),
  sub('meaning.doubt', 31, -242, -229, 'doubt, existential questions, searching for meaning'),
  sub('meaning.values', 32, -365, -242, 'values, conscience, right and wrong'),
  sub('loss.grief', 33, -476, -78, 'the death of someone close, grief, mourning'),
  sub('loss.trauma', 34, -412, 8, 'a traumatic or painful experience and its aftermath'),
  sub('loss.crisis', 35, -561, 71, 'a sudden crisis, an accident, a disaster'),
  sub('health.illness', 36, -594, 229, 'illness, a diagnosis, treatment'),
  sub('health.disability', 37, -479, 208, 'disability or a chronic condition and living with it'),
  sub('health.habits', 38, -521, 328, 'sleep, food, exercise and daily habits'),
  sub('health.addiction', 39, -636, 350, 'addiction and recovery'),
  sub('inner.anxiety', 40, -554, 475, 'anxiety, fear, constant worry'),
  sub('inner.sadness', 41, -433, 397, 'lasting sadness, emptiness, depression'),
  sub('inner.self_worth', 42, -412, 490, 'self-confidence, self-image, feeling not good enough'),
  sub('inner.anger', 43, -533, 569, 'anger, losing one\'s temper, regret afterwards'),
  sub('everyday.moments', 44, -43, 87, 'small everyday moments and situations'),
  sub('everyday.humor', 45, -43, -43, 'something funny, a light story'),
  sub('everyday.interests', 46, 86, -43, 'interests, hobbies, things one enjoys'),
]);

const BY_KEY: ReadonlyMap<string, PublicSubRegion> = new Map(PUBLIC_SUB_REGIONS.map((region) => [region.key, region]));
export const PUBLIC_SUB_REGION_KEYS: ReadonlyArray<string> = Object.freeze(PUBLIC_SUB_REGIONS.map((region) => region.key));

export const publicSubRegion = (key: string): PublicSubRegion | undefined => BY_KEY.get(key);

/** One sub-region of a profile, as the API carries it: the key and its weight in hundredths. */
export interface PublicRegionWeight {
  readonly key: string;
  readonly hundredths: number;
}

export interface PublicRegionProfile {
  readonly regions: ReadonlyArray<PublicRegionWeight>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));

/** A weight the interpreter wrote (a number such as 0.6), in exact hundredths, or null when it is not exactly that. */
function hundredthsOf(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const scaled = Math.round(value * 100);
  return Math.abs(value * 100 - scaled) < 1e-9 ? scaled : null;
}

/**
 * The interpreter's `{ regions: [{ key, weight }] }`, or null. Exactly those keys; 1–3 distinct known sub-regions; each
 * weight exactly hundredths, at least 0.10; the weights sum to exactly 1.00. A coordinate, an unknown key, a score or any
 * other field makes the whole answer malformed.
 */
export function decodePublicRegionProfile(value: unknown): PublicRegionProfile | null {
  if (!isRecord(value) || !exactKeys(value, ['regions']) || !Array.isArray(value.regions)) return null;
  const entries = value.regions as unknown[];
  if (entries.length < PUBLIC_REGION_PROFILE.minRegions || entries.length > PUBLIC_REGION_PROFILE.maxRegions) return null;
  const regions: PublicRegionWeight[] = [];
  for (const entry of entries) {
    if (!isRecord(entry) || !exactKeys(entry, ['key', 'weight']) || typeof entry.key !== 'string' || !BY_KEY.has(entry.key)) return null;
    const hundredths = hundredthsOf(entry.weight);
    if (hundredths === null || hundredths < PUBLIC_REGION_PROFILE.minWeight || hundredths > PUBLIC_REGION_PROFILE.total) return null;
    if (regions.some((region) => region.key === entry.key)) return null;
    regions.push(Object.freeze({ key: entry.key, hundredths }));
  }
  if (regions.reduce((sum, region) => sum + region.hundredths, 0) !== PUBLIC_REGION_PROFILE.total) return null;
  return Object.freeze({ regions: Object.freeze(regions) });
}

/** The dominant sub-region: the highest weight; on a tie, the lower vocabulary ordinal (independent of the answer's order). */
export function dominantSubRegion(profile: PublicRegionProfile): string {
  let best: PublicRegionWeight | null = null;
  for (const region of profile.regions) {
    if (best === null || region.hundredths > best.hundredths
      || (region.hundredths === best.hundredths && BY_KEY.get(region.key)!.ordinal < BY_KEY.get(best.key)!.ordinal)) best = region;
  }
  return best!.key;
}

// ------------------------------------------------------------------------------------------------ the geometry
// Slot k of the fixed hexagonal spiral around a centre: slot 0 is the centre; ring n ≥ 1 holds slots 3n(n-1)+1 …
// 3n(n+1), walked from the corner (-n, n) along the six axial directions. Exact integers only.

const DIRECTIONS: ReadonlyArray<readonly [bigint, bigint]> = [[1n, 0n], [1n, -1n], [0n, -1n], [-1n, 0n], [-1n, 1n], [0n, 1n]];
export const PUBLIC_REGION_MAX_SLOT = 1_000_000_000_000n;

function isqrt(value: bigint): bigint {
  if (value < 2n) return value;
  let x = BigInt(Math.floor(Math.sqrt(Number(value))));
  while (x * x > value) x -= 1n;
  while ((x + 1n) * (x + 1n) <= value) x += 1n;
  return x;
}

/** The axial offset of slot k from its centre. */
export function hexSlot(k: bigint): readonly [bigint, bigint] {
  if (k < 0n || k > PUBLIC_REGION_MAX_SLOT) throw new RangeError('slot out of range');
  if (k === 0n) return [0n, 0n];
  let n = (3n + isqrt(12n * k - 3n)) / 6n;
  while (3n * n * (n + 1n) + 1n <= k) n += 1n;
  while (3n * n * (n - 1n) + 1n > k) n -= 1n;
  const s = k - (3n * n * (n - 1n) + 1n);
  const side = Number(s / n);
  const step = s % n;
  const corners: ReadonlyArray<readonly [bigint, bigint]> = [[-n, n], [0n, n], [n, 0n], [n, -n], [0n, -n], [-n, 0n]];
  const [cq, cr] = corners[side];
  const [dq, dr] = DIRECTIONS[side];
  return [cq + step * dq, cr + step * dr];
}

/** A lattice point in world units. */
export function latticePoint(q: bigint, r: bigint): readonly [bigint, bigint] {
  return [PUBLIC_REGION_LATTICE.column * q + PUBLIC_REGION_LATTICE.halfColumn * r, PUBLIC_REGION_LATTICE.row * r];
}
