// S8A-05 CP3 — the free, deterministic placement simulation on the EXACT implemented geometry (Controlled Amendment A-4).
//
// It reproduces the WP1-R1 method (independent mulberry32 streams per data seed; DEV 11, 12 / TEST 101..505 / HOLDOUT2
// 606..1010; the same ASSUMED interpreter error model) for the one rule CP3 implements — P-dom on the closed vocabulary
// QANDEEL_PUBLIC_REGIONS_V1 — with the implementation's own pieces:
//   - the 46 sub-regions, their ordinals and lattice centres, read from `apps/api/src/public-world/public-semantic-regions.ts`
//     (the verifier and the API spec prove that file equals migration 0181's seed);
//   - the profile as the decoder keeps it (hundredths, each >= 10, summing to 100) and the dominant rule (weight, then the
//     lower ordinal);
//   - the slot rule of `public_region_private.assign_slot_v1`: one global lattice (8,000 / 4,000 / 6,929), the sub-region's
//     cursor after its last slot, the first free point of its fixed hexagonal spiral.
//
// What this does NOT show: anything about DeepSeek. The interpreter errors are assumptions; quality is the paid Tier S /
// Tier P evaluation's question, behind its own gate. No network, no model, no database.
//
// Run: node scripts/s8a-05/cp3/placement-sim.mjs            (full, a few seconds)
import { readFileSync } from 'node:fs';

const SEEDS = { DEV: [11, 12], TEST: [101, 202, 303, 404, 505], HOLDOUT2: [606, 707, 808, 909, 1010] };
const SIZES = [200, 1000, 5000];

// ---------- the implemented vocabulary and geometry ----------
const SOURCE = readFileSync(new URL('../../../apps/api/src/public-world/public-semantic-regions.ts', import.meta.url), 'utf8');
const REGIONS = [...SOURCE.matchAll(/^\s*sub\('([a-z_.]+)', (\d+), (-?\d+), (-?\d+), ['"]/gmu)]
  .map((m) => ({ key: m[1], major: m[1].split('.')[0], ordinal: Number(m[2]), q: BigInt(m[3]), r: BigInt(m[4]) }));
const RING_MAJORS = [...SOURCE.matchAll(/^\s*\{ key: '([a-z]+)', definition: /gmu)].map((m) => m[1]).filter((key) => key !== 'everyday');
if (REGIONS.length !== 46 || RING_MAJORS.length !== 12) throw new Error(`vocabulary not read: ${REGIONS.length} / ${RING_MAJORS.length}`);
const MAJORS = [...RING_MAJORS, 'everyday'];
const KEYS = REGIONS.length;
const majorIndex = (k) => MAJORS.indexOf(REGIONS[k].major);
const keysOf = (m) => REGIONS.map((region, k) => (region.major === MAJORS[m] ? k : -1)).filter((k) => k >= 0);
const ringDistance = (a, b) => { const d = Math.abs(a - b) % 12; return Math.min(d, 12 - d); };
const point = (q, r) => [8000n * q + 4000n * r, 6929n * r];
const centre = REGIONS.map((region) => point(region.q, region.r));
const majorCentre = MAJORS.map((_, m) => {
  const ks = keysOf(m);
  return [ks.reduce((a, k) => a + Number(centre[k][0]), 0) / ks.length, ks.reduce((a, k) => a + Number(centre[k][1]), 0) / ks.length];
});
const dist = (a, b) => Math.hypot(Number(a[0]) - Number(b[0]), Number(a[1]) - Number(b[1]));

const DIRECTIONS = [[1n, 0n], [1n, -1n], [0n, -1n], [-1n, 0n], [-1n, 1n], [0n, 1n]];
function hexSlot(k) {
  if (k === 0n) return [0n, 0n];
  let n = 1n;
  while (3n * n * (n + 1n) < k) n += 1n;
  const s = k - (3n * n * (n - 1n) + 1n);
  const side = Number(s / n);
  const step = s % n;
  const corners = [[-n, n], [0n, n], [n, 0n], [n, -n], [0n, -n], [-n, 0n]];
  return [corners[side][0] + step * DIRECTIONS[side][0], corners[side][1] + step * DIRECTIONS[side][1]];
}

/** assign_slot_v1, exactly: a reused slot, or the first free lattice point of the sub-region's spiral from its cursor. */
class Field {
  constructor() { this.taken = new Set(); this.cursor = new Map(); this.slots = new Map(); }
  assign(id, k) {
    const mine = `${id}|${k}`;
    if (this.slots.has(mine)) return this.slots.get(mine);
    let slot = this.cursor.get(k) ?? 0n;
    for (;;) {
      const [dq, dr] = hexSlot(slot);
      const q = REGIONS[k].q + dq;
      const r = REGIONS[k].r + dr;
      if (!this.taken.has(`${q},${r}`)) {
        this.taken.add(`${q},${r}`);
        this.cursor.set(k, slot + 1n);
        const p = point(q, r);
        this.slots.set(mine, p);
        return p;
      }
      slot += 1n;
    }
  }
}

// ---------- the profile, as the decoder keeps it, and the dominant rule ----------
function hundredths(profile) {
  const total = profile.reduce((a, [, w]) => a + w, 0);
  let out = profile.map(([k, w]) => [k, Math.max(10, Math.round((100 * w) / total))]);
  const merged = new Map();
  for (const [k, w] of out) merged.set(k, (merged.get(k) ?? 0) + w);
  out = [...merged.entries()].slice(0, 3);
  let sum = out.reduce((a, [, w]) => a + w, 0);
  while (sum !== 100) {
    const i = out.reduce((best, [, w], j) => (w > out[best][1] ? j : best), 0);
    const step = sum > 100 ? -1 : 1;
    out[i][1] += step; sum += step;
  }
  return out;
}
const dominant = (profile) => profile.slice().sort((a, b) => b[1] - a[1] || REGIONS[a[0]].ordinal - REGIONS[b[0]].ordinal)[0][0];

// ---------- independent streams ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, n) => Math.floor(r() * n);

// ---------- ground truth: a shared sub-region = 1, the same major = partial (WP1-R1) ----------
function vec(profile) {
  const v = new Float64Array(KEYS + MAJORS.length);
  for (const [k, w] of profile) { v[k] += w; v[KEYS + majorIndex(k)] += 0.5 * w; }
  return v;
}
function cos(a, b) { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i += 1) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / Math.sqrt(na * nb); }

// ---------- 1. the dataset, frozen before placement ----------
// ONE 60%; TWO_ADJ 12% (majors one ring step apart); TWO_FAR 12% (>= 4 steps); TWO_SAME 6% (one major); THREE 10%.
function dataset(seed, N) {
  const rd = mulberry32(seed), ri = mulberry32(seed + 1), ro = mulberry32(seed + 2);
  const ringKey = (m) => { const ks = keysOf(m); return ks[pick(rd, ks.length)]; };
  const topics = [];
  for (let i = 0; i < N; i += 1) {
    const u = rd();
    const k1 = pick(rd, KEYS);
    const m1 = majorIndex(k1);
    const ring = m1 < 12;
    let kind, truth;
    if (u < 0.60 || !ring) { kind = 'ONE'; truth = [[k1, 1]]; }
    else if (u < 0.72) { kind = 'TWO_ADJ'; truth = [[k1, 0.6], [ringKey((m1 + (rd() < 0.5 ? 1 : 11)) % 12), 0.4]]; }
    else if (u < 0.84) { kind = 'TWO_FAR'; truth = [[k1, 0.6], [ringKey((m1 + 4 + pick(rd, 5)) % 12), 0.4]]; }
    else if (u < 0.90) { kind = 'TWO_SAME'; const ks = keysOf(m1).filter((k) => k !== k1); truth = [[k1, 0.6], [ks[pick(rd, ks.length)], 0.4]]; }
    else { kind = 'THREE'; truth = [[k1, 0.5], [ringKey((m1 + 1 + pick(rd, 2)) % 12), 0.3], [ringKey((m1 + 5 + pick(rd, 3)) % 12), 0.2]]; }
    topics.push({ id: i, kind, truth, section: pick(rd, 13) });
  }
  // The ASSUMED interpreter: per key 12% another sub-region of the same major, 4% any sub-region; weight noise ±0.1;
  // 8% a secondary dropped. Then exactly what the decoder keeps.
  for (const t of topics) {
    let out = t.truth.map(([k, w]) => {
      const r = ri();
      let kk = k;
      if (r < 0.04) kk = pick(ri, KEYS);
      else if (r < 0.16) { const ks = keysOf(majorIndex(k)); kk = ks[pick(ri, ks.length)]; }
      return [kk, Math.max(0.1, w + (ri() - 0.5) * 0.2)];
    });
    if (out.length > 1 && ri() < 0.08) out = out.slice(0, -1);
    t.profile = hundredths(out);
    t.dominant = dominant(t.profile);
  }
  const order = [...Array(N).keys()];
  for (let i = N - 1; i > 0; i -= 1) { const j = pick(ro, i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  return { topics, order };
}

function place(topics, order) {
  const field = new Field();
  const pos = new Array(topics.length);
  for (const i of order) pos[i] = field.assign(topics[i].id, topics[i].dominant);
  return { pos, field };
}

const nearestMajor = (p) => majorCentre.reduce((best, c, m) => (dist(p, c) < dist(p, majorCentre[best]) ? m : best), 0);
const nearestRegion = (p) => centre.reduce((best, c, k) => (dist(p, c) < dist(p, centre[best]) ? k : best), 0);

function evaluate(seed, N) {
  const { topics, order } = dataset(seed, N);
  const natural = [...Array(N).keys()];
  const a = place(topics, natural);
  const b = place(topics, order);
  // section independence: the rule never reads a section — permute them and place again
  const c = place(topics.map((t) => ({ ...t, section: (t.section + 7) % 13 })), natural);
  // a retry: the same topic again moves nothing
  const retry = topics.every((t) => { const p = a.field.assign(t.id, t.dominant); return p[0] === a.pos[t.id][0] && p[1] === a.pos[t.id][1]; });
  const re = mulberry32(seed + 4);
  const V = topics.map((t) => vec(t.truth));
  let ok = 0, tot = 0;
  for (let s = 0; s < 60000 && tot < 6000; s += 1) {
    const x = pick(re, N), y = pick(re, N), z = pick(re, N);
    if (x === y || x === z || y === z) continue;
    if (cos(V[x], V[y]) >= 0.8 && cos(V[x], V[z]) <= 0.1) { tot += 1; if (dist(a.pos[x], a.pos[y]) < dist(a.pos[x], a.pos[z])) ok += 1; }
  }
  const share = (list, test) => (list.length ? list.filter(test).length / list.length : NaN);
  const ones = topics.filter((t) => t.kind === 'ONE');
  const multi = topics.filter((t) => t.kind !== 'ONE');
  const far = topics.filter((t) => t.kind === 'TWO_FAR');
  let nearest = Infinity;
  const pts = a.pos.map((p) => [p[0], p[1]]);
  const grid = new Map();
  for (const p of pts) grid.set(`${p[0]},${p[1]}`, true);
  for (const p of pts) for (const [dx, dy] of [[8000n, 0n], [4000n, 6929n], [-4000n, 6929n]]) if (grid.has(`${p[0] + dx},${p[1] + dy}`)) nearest = Math.min(nearest, Math.hypot(Number(dx), Number(dy)));
  return {
    triplet: tot ? ok / tot : NaN,
    tripletAltOrder: (() => { let o = 0, n = 0; const r2 = mulberry32(seed + 4); for (let s = 0; s < 60000 && n < 6000; s += 1) { const x = pick(r2, N), y = pick(r2, N), z = pick(r2, N); if (x === y || x === z || y === z) continue; if (cos(V[x], V[y]) >= 0.8 && cos(V[x], V[z]) <= 0.1) { n += 1; if (dist(b.pos[x], b.pos[y]) < dist(b.pos[x], b.pos[z])) o += 1; } } return n ? o / n : NaN; })(),
    majorPurity: share(ones, (t) => nearestMajor(a.pos[t.id]) === majorIndex(t.truth[0][0])),
    subPurity: share(ones, (t) => nearestRegion(a.pos[t.id]) === t.truth[0][0]),
    placedInDominant: share(topics, (t) => nearestRegion(a.pos[t.id]) === t.dominant),
    compoundDomMajor: share(multi, (t) => nearestMajor(a.pos[t.id]) === majorIndex(t.truth[0][0])),
    farDomMajor: share(far, (t) => nearestMajor(a.pos[t.id]) === majorIndex(t.truth[0][0])),
    farCrossroads: share(far, (t) => !t.truth.map(([k]) => majorIndex(k)).includes(nearestMajor(a.pos[t.id]))),
    secondaryKept: share(multi, (t) => t.profile.length > 1),
    regionSameAltOrder: topics.every((t) => nearestRegion(a.pos[t.id]) === nearestRegion(b.pos[t.id])) ? 1 : 0,
    orderShift: a.pos.reduce((s, p, i) => s + dist(p, b.pos[i]), 0) / N,
    sectionSame: c.pos.every((p, i) => p[0] === a.pos[i][0] && p[1] === a.pos[i][1]) ? 1 : 0,
    retrySame: retry ? 1 : 0,
    minSpacing: nearest,
  };
}

const fmt = (x) => (Number.isFinite(x) ? (Math.abs(x) >= 1000 ? Math.round(x).toLocaleString('en') : +x.toFixed(3)) : String(x));
function summarize(label, seeds) {
  const rows = [];
  for (const N of SIZES) {
    const runs = seeds.map((seed) => evaluate(seed, N));
    const out = { set: label, N };
    for (const key of Object.keys(runs[0])) {
      const xs = runs.map((r) => r[key]).filter(Number.isFinite);
      const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, xs.length - 1));
      out[key] = xs.length ? `${fmt(mean)} ±${fmt(sd)}` : 'n/a';
    }
    rows.push(out);
  }
  return rows;
}

function crowding(seed, M) {
  const ri = mulberry32(seed + 1);
  const key = REGIONS.findIndex((r) => r.key === 'work.pressure');
  const sameMajor = keysOf(majorIndex(key));
  const field = new Field();
  const placed = [];
  for (let i = 0; i < M; i += 1) {
    const r = ri();
    const k = r < 0.04 ? pick(ri, KEYS) : r < 0.16 ? sameMajor[pick(ri, sameMajor.length)] : key;
    placed.push({ k, p: field.assign(i, k) });
  }
  const inKey = placed.filter((x) => x.k === key);
  const radius = Math.max(...inKey.map((x) => dist(x.p, centre[key])));
  const spill = inKey.filter((x) => nearestRegion(x.p) !== key).length / inKey.length;
  const exact = new Field();
  let exactRadius = 0;
  for (let i = 0; i < M; i += 1) exactRadius = Math.max(exactRadius, dist(exact.assign(i, key), centre[key]));
  return { M, inKey: inKey.length, radius: Math.round(radius), spill: +spill.toFixed(3), allInOneRadius: Math.round(exactRadius) };
}

const [far] = [hexSlot(1_000_000_000_000n)];
const edge = point(REGIONS[0].q + far[0], REGIONS[0].r + far[1]);
let crossMin = Infinity;
for (let i = 0; i < KEYS; i += 1) for (let j = i + 1; j < KEYS; j += 1) if (REGIONS[i].major !== REGIONS[j].major) crossMin = Math.min(crossMin, dist(centre[i], centre[j]));

console.log('S8A-05 CP3 placement simulation — P-dom on QANDEEL_PUBLIC_REGIONS_V1, layout public_region_dominant_v1 (assumed interpreter errors; no model).');
console.log(`vocabulary: ${KEYS} sub-regions, ${MAJORS.length} majors; nearest centres of different majors ${Math.round(crossMin).toLocaleString('en')} apart`);
console.log(`BigInt range: slot 10^12 of ${REGIONS[0].key} is at (${edge[0]}, ${edge[1]}), inside ±2^62 = ${4611686018427387903n}`);
for (const [label, seeds] of Object.entries(SEEDS)) {
  console.log(`\n${label} seeds ${seeds.join(', ')} — mean ±sd across seeds`);
  console.table(summarize(label, seeds));
}
console.log('\nCapacity: M topics whose meaning is ONE sub-region (work.pressure), with the same assumed errors (radius = farthest in-key topic from its centre; spill = share whose nearest sub-region centre is another one); allInOneRadius = every topic exactly in it.');
console.table([500, 2000, 5000].map((M) => crowding(SEEDS.TEST[0], M)));
