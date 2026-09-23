/**
 * F1 DERIVATION. The increased-contrast atmosphere expression is SEARCHED, not chosen.
 *
 * WHAT IS IN REACH, AND WHY THAT IS THE WHOLE SAFETY ARGUMENT.
 *
 * The search below can touch exactly two things: the stroke ALPHA the ambient field is drawn
 * at, and the LIGHTNESS of the three atmosphere layers. d2-world's PRESENTATION_CONTRACT
 * declares `ring.layer`, `ring.hue`, `ring.radius`, `ring.contourShape` and `field.parallax`
 * all `encodes: null`. There is no semantic token in the search's reach at all -- not the
 * reading ramp, not Living Brass, not QANDEEL Light, not one E1 state or status ink. That is
 * why an increased-contrast expression derived here cannot invent importance: it has nothing
 * to invent it out of.
 *
 * THE TARGET IS ADOPTED, NOT OBLIGED. I-08B3.1-D2R argued on the record that a contour is
 * atmosphere, carries nothing that position and label do not also carry, and is therefore NOT
 * a graphical object under WCAG 2.2 SC 1.4.11. F1 does not reopen that. It adopts 1.4.11's 3:1
 * as the TARGET for the increased-contrast expression, because a user who turns that setting
 * on has asked for separation and 3:1 is the threshold the standard uses for the kind of
 * separation they asked for.
 *
 * THE CEILING IS A PRODUCT LAW AND IT IS THE ONE THAT CAN FAIL. I-08B3.0 froze MEANING EARNS
 * EMPHASIS and QUIET BEFORE LUMINOUS. An atmosphere contour that arrives at the on-screen
 * strength of an ANALYTICAL RELATION has stopped being atmosphere, whatever its token says.
 * So the ceiling is stated on the COMPOSITED contrast against the World, against the measured
 * strength of the analytical relation stroke -- not on the ink's lightness, which is where the
 * first version of this search put it and was wrong. See F1_INCREASED_CONTRAST.md.
 */
import { writeFileSync } from 'node:fs';
import { hexToRgb8, rgb8ToHex, contrastHex, srgbToOklch, oklchToSrgbRaw, to8bit, inSrgbGamut } from '../vendor/lib/color.mjs';
import { WORLDS, RINGS } from '../vendor/d2r/scene/d2-world.mjs';
import { ATMOSPHERE } from '../vendor/d2r/scene/d2-foundation.mjs';

const WORLD = '#101010';
const SURFACE = '#181818';
const RELATION = '#8b8982'; // qandeel.analysis.relation -> qandeel.content.tertiary
const TARGET = 3.0;

const over = (fg, alpha, bg) => {
  const F = hexToRgb8(fg), B = hexToRgb8(bg);
  return rgb8ToHex(F.map((c, i) => Math.round(c * alpha + B[i] * (1 - alpha))));
};
const ink = (L, hue) => {
  const t = [L, ATMOSPHERE.chromaCeiling, hue];
  return inSrgbGamut(t) ? rgb8ToHex(to8bit(oklchToSrgbRaw(t))) : null;
};
const oklchOf = (hex) => srgbToOklch(hexToRgb8(hex).map((c) => c / 255));
const f = (n, d = 4) => Number(n.toFixed(d));

/** The ceiling, measured rather than assumed. */
const RELATION_CONTRAST = contrastHex(RELATION, WORLD);
const RELATION_L = oklchOf(RELATION)[0];

/** Every (world, layer, ringIndex) the field actually draws, with the alpha it draws at. */
const CASES = [];
for (const [wk, w] of Object.entries(WORLDS)) {
  for (let layer = 0; layer < 3; layer++) {
    const limit = Math.min(w.ringLimit, RINGS[layer].length);
    for (let ring = 0; ring < limit; ring++) {
      CASES.push({ world: wk, layer, ring, alpha: w.strokeAlpha[ring] ?? w.strokeAlpha.at(-1) });
    }
  }
}
const BASE = [ATMOSPHERE.L.near, ATMOSPHERE.L.mid, ATMOSPHERE.L.far];

/** Worst and best composited contrast over all six hues, for one (L, alpha). The hue loop is
 *  inside the objective because the constraint is on EVERY ring; a lift chosen on the best hue
 *  would leave the worst one short, and a ceiling checked on the worst would let the best through. */
function span(L, alpha) {
  let lo = Infinity, hi = -Infinity;
  for (const h of ATMOSPHERE.hues) {
    const i = ink(L, h);
    if (i === null) return { lo: -1, hi: Infinity, gamut: false };
    const c = contrastHex(over(i, alpha, WORLD), WORLD);
    lo = Math.min(lo, c); hi = Math.max(hi, c);
  }
  return { lo, hi, gamut: true };
}

const result = {
  note: 'F1 increased-contrast atmosphere derivation. Two levers, tried in order of how little they change.',
  target: TARGET,
  targetStatus: 'ADOPTED FOR THE INCREASED-CONTRAST EXPRESSION, NOT AN OBLIGATION ON THE DEFAULT.',
  ceiling: {
    value: f(RELATION_CONTRAST, 3),
    what: 'the composited contrast of the ANALYTICAL RELATION stroke #8b8982 against the World',
    why: 'I-08B3.0: MEANING EARNS EMPHASIS. No atmosphere contour may reach the on-screen strength of an analytical object.',
    relationOklchL: f(RELATION_L, 4),
  },
  levers: [],
  finding: {},
};

/* ---------------------------------------------------------------- LEVER 1: ALPHA ONLY ---- */
/**
 * The cheapest lever by a distance: alpha changes no colour at all, so nothing in the palette
 * can acquire a new relationship to anything else. Try it to its own limit first.
 */
const alphaOnly = [];
for (let mul = 1.0; mul <= 3.001; mul += 0.01) {
  const rows = CASES.map((c) => {
    const a = Math.min(1, c.alpha * mul);
    return { ...c, a: f(a, 3), ...span(BASE[c.layer], a) };
  });
  const worst = Math.min(...rows.map((r) => r.lo));
  const best = Math.max(...rows.map((r) => r.hi));
  alphaOnly.push({ mul: f(mul, 2), worst: f(worst, 3), best: f(best, 3) });
  if (worst >= TARGET) break;
}
const alphaSaturated = alphaOnly.at(-1);
const atFullAlpha = CASES.map((c) => ({ ...c, ...span(BASE[c.layer], 1) }));
result.levers.push({
  lever: 'ALPHA, uniform multiplier, clamped at 1.0',
  reachedTarget: alphaSaturated.worst >= TARGET,
  atFullOpacity: { worst: f(Math.min(...atFullAlpha.map((r) => r.lo)), 3), best: f(Math.max(...atFullAlpha.map((r) => r.hi)), 3) },
  perLayerAtFullOpacity: [0, 1, 2].map((layer) => ({ layer, ...(() => { const s = span(BASE[layer], 1); return { worst: f(s.lo, 3), best: f(s.hi, 3) }; })() })),
  shortfall: f(TARGET - Math.min(...atFullAlpha.map((r) => r.lo)), 3),
  casesStillShort: atFullAlpha.filter((r) => r.lo < TARGET).map((r) => `${r.world}/L${r.layer}/r${r.ring}`),
});

/* -------------------------------------- LEVER 2: THE MINIMUM UNIFORM LIGHTNESS RESIDUE --- */
/**
 * Only for what alpha could not reach, and only as ONE delta applied to all three layers --
 * a per-layer lift would compress or expand the depth ladder, which is a change in the spatial
 * reading rather than in its visibility.
 *
 * RUN TWICE, AGAINST TWO CEILINGS, AND THE DIFFERENCE BETWEEN THE RUNS IS THE FINDING.
 *
 *   2A  against the ceiling as the DEFAULT sets it -- the analytical relation at 5.435:1.
 *   2B  against the ceiling the increased-contrast expression sets, once the analytical
 *       relation has ALSO moved up the frozen ramp (tertiary -> secondary, 5.435 -> 8.384).
 *
 * 2A is expected to fail. That failure is the real result: raising the atmosphere alone cannot
 * reach the target, because the near layer arrives at the strength of an analytical object
 * before the far layer arrives at legibility. An accessibility expression that raises only the
 * quiet things flattens the very hierarchy it was supposed to leave alone.
 */
function lever2(ceiling, label) {
  let chosen = null;
  const trace = [];
  for (let delta = 0; delta <= 0.30001; delta += 0.0005) {
    const L = BASE.map((b) => b + delta);
    const rows = CASES.map((c) => ({ ...c, ...span(L[c.layer], 1) }));
    const worst = Math.min(...rows.map((r) => r.lo));
    const best = Math.max(...rows.map((r) => r.hi));
    const orderOk = L[0] > L[1] && L[1] > L[2];
    const ceilingOk = best < ceiling;
    const gamutOk = rows.every((r) => r.gamut);
    /* NON-COMPRESSION: the gap between the weakest analytical object and the loudest contour
       may widen under increased contrast. It may not shrink. This is the mechanical form of
       "HIGH CONTRAST IS NOT HIGH IMPORTANCE" -- importance is a RATIO, so the check is on the
       ratio and not on either value. */
    const ratio = ceiling / best;
    const noCompression = ratio >= DEFAULT_RATIO - 1e-9;
    trace.push({ delta: f(delta), worst: f(worst, 3), best: f(best, 3), ratio: f(ratio, 4), orderOk, ceilingOk, gamutOk, noCompression });
    if (!gamutOk) { chosen = { delta: f(delta), L, blocked: 'GAMUT' }; break; }
    if (!ceilingOk) { chosen = { delta: f(delta), L, blocked: 'CEILING' }; break; }
    if (!noCompression) { chosen = { delta: f(delta), L, blocked: 'COMPRESSION' }; break; }
    if (worst >= TARGET) { chosen = { delta: f(delta), L, blocked: null, ratio: f(ratio, 4) }; break; }
  }
  return { lever: label, ceiling: f(ceiling, 3), searched: trace.length, step: 0.0005, chosen, traceTail: trace.slice(-3) };
}

/** The default's own hierarchy ratio -- the thing that must not shrink. */
const DEFAULT_LOUDEST_CONTOUR = Math.max(...CASES.map((c) => span(BASE[c.layer], c.alpha).hi));
const DEFAULT_RATIO = RELATION_CONTRAST / DEFAULT_LOUDEST_CONTOUR;
const RELATION_RAISED = contrastHex('#afaca3', WORLD); // qandeel.content.secondary, an EXISTING rung
result.hierarchy = {
  defaultWeakestAnalytical: f(RELATION_CONTRAST, 3),
  defaultLoudestContour: f(DEFAULT_LOUDEST_CONTOUR, 3),
  defaultRatio: f(DEFAULT_RATIO, 4),
  raisedWeakestAnalytical: f(RELATION_RAISED, 3),
  raisedBy: 'qandeel.analysis.relation is RE-ROUTED from {qandeel.content.tertiary} to {qandeel.content.secondary}. Both are frozen rungs of the I-08B3.0 reading ramp. NO NEW LITERAL ENTERS QANDEEL.',
};

const run2A = lever2(RELATION_CONTRAST, 'LIGHTNESS at full opacity, against the DEFAULT ceiling (analysis unmoved)');
const run2B = lever2(RELATION_RAISED, 'LIGHTNESS at full opacity, against the RAISED ceiling (analysis moved up the frozen ramp)');
result.levers.push(run2A, run2B);
const chosen = run2B.chosen;

if (chosen && !chosen.blocked) {
  const L = chosen.L;
  result.finding = {
    verdict: 'REACHED',
    alphaTo: 1.0,
    lightnessDelta: chosen.delta,
    layersBefore: BASE.map((x) => f(x)),
    layersAfter: L.map((x) => f(x)),
    orderPreserved: L[0] > L[1] && L[1] > L[2],
    spacingBefore: [f(BASE[0] - BASE[1], 5), f(BASE[1] - BASE[2], 5)],
    spacingAfter: [f(L[0] - L[1], 5), f(L[1] - L[2], 5)],
    worstAfter: f(Math.min(...CASES.map((c) => span(L[c.layer], 1).lo)), 3),
    bestAfter: f(Math.max(...CASES.map((c) => span(L[c.layer], 1).hi)), 3),
    headroomBelowRelation: f(RELATION_RAISED - Math.max(...CASES.map((c) => span(L[c.layer], 1).hi)), 3),
    hierarchyRatioAfter: f(RELATION_RAISED / Math.max(...CASES.map((c) => span(L[c.layer], 1).hi)), 4),
    hierarchyRatioDefault: f(DEFAULT_RATIO, 4),
    inksAfter: [0, 1, 2].map((layer) => ATMOSPHERE.hues.map((h) => ink(L[layer], h))),
    inksBefore: [0, 1, 2].map((layer) => ATMOSPHERE.hues.map((h) => ink(BASE[layer], h))),
  };
  /* the palette must still carry NOTHING after the lift -- the lift is not allowed to turn an
     isoluminant hue wheel into a legible one, because that would hand it an identity channel. */
  const after = [0, 1, 2].map((layer) => ATMOSPHERE.hues.map((h) => ink(L[layer], h)));
  let maxPair = 0, maxPairBefore = 0;
  for (const row of after) for (let i = 0; i < row.length; i++) for (let j = i + 1; j < row.length; j++) maxPair = Math.max(maxPair, contrastHex(row[i], row[j]));
  for (const row of result.finding.inksBefore) for (let i = 0; i < row.length; i++) for (let j = i + 1; j < row.length; j++) maxPairBefore = Math.max(maxPairBefore, contrastHex(row[i], row[j]));
  result.finding.hueStillCarriesNothing = { before: f(maxPairBefore, 4), after: f(maxPair, 4) };
  result.finding.perCase = CASES.map((c) => ({
    case: `${c.world}/L${c.layer}/r${c.ring}`,
    before: f(span(BASE[c.layer], c.alpha).lo, 3),
    after: f(span(L[c.layer], 1).lo, 3),
  }));
} else {
  result.finding = { verdict: 'BLOCKED', by: chosen && chosen.blocked, at: chosen };
}

/* ------------------- what a darker ground would have bought, measured and rejected ------- */
result.groundRejected = {
  question: 'The obvious move under increased contrast is to darken the ground. How much does it actually buy?',
  rows: ['#0a0a0a', '#050505', '#000000'].map((g) => ({
    ground: g,
    tertiaryTextGain: f(contrastHex('#8b8982', g) / contrastHex('#8b8982', WORLD), 4),
    farRingGain: f(contrastHex(over(ink(BASE[2], 300), 0.58, g), g) / contrastHex(over(ink(BASE[2], 300), 0.58, WORLD), WORLD), 4),
  })),
};

/* ---------------------------- the boundary, and why it is not a new colour --------------- */
result.boundary = {
  question: 'Apple asks for "near-solid backgrounds with a defined, contrasting border" under increased contrast. What draws that border?',
  worldVsSurface: f(contrastHex(WORLD, SURFACE), 3),
  candidates: [
    ['qandeel.content.tertiary #8b8982 (an existing reading rung)', '#8b8982', 'already in the system; not a state; not a status; not the material'],
    ['qandeel.content.secondary #afaca3', '#afaca3', 'already in the system, but louder than the content it frames'],
    ['qandeel.state.disabled.ink #696762', '#696762', 'REJECTED ON MEANING: E1 owns this as AVAILABILITY. A border drawn in it would say unavailable.'],
    ['a newly invented mid neutral #676767', '#676767', 'REJECTED: adds a colour to QANDEEL to solve a problem an existing rung already solves.'],
  ].map(([name, hex, note]) => ({
    name, hex, note,
    vsSurface: f(contrastHex(hex, SURFACE), 3),
    vsWorld: f(contrastHex(hex, WORLD), 3),
    meetsThreeToOneBothSides: contrastHex(hex, SURFACE) >= 3 && contrastHex(hex, WORLD) >= 3,
  })),
};

/* --------------------- reduce transparency: the substitutions, computed ------------------ */
result.transparency = {
  principle: 'Where the backdrop is the flat opaque World, an alpha composite has an EXACT opaque equivalent. Substituting it changes the mechanism and not one pixel.',
  scrim: { spec: 'black @ 0.5', overWorld: over('#000000', 0.5, WORLD), overSurface: over('#000000', 0.5, SURFACE) },
  strokeSubstitutions: [],
  fillSubstitutions: [],
};
for (const [wk, w] of Object.entries(WORLDS)) {
  for (let layer = 0; layer < 3; layer++) {
    const limit = Math.min(w.ringLimit, RINGS[layer].length);
    for (let ring = 0; ring < limit; ring++) {
      const a = w.strokeAlpha[ring] ?? w.strokeAlpha.at(-1);
      for (const h of ATMOSPHERE.hues) {
        result.transparency.strokeSubstitutions.push({ world: wk, layer, ring, hue: h, translucent: { ink: ink(BASE[layer], h), alpha: a }, opaque: over(ink(BASE[layer], h), a, WORLD) });
      }
    }
  }
  for (const h of ATMOSPHERE.hues) {
    result.transparency.fillSubstitutions.push({ world: wk, hue: h, translucentAlpha: w.fillAlpha, opaque: over(ink(BASE[0], h), w.fillAlpha, WORLD) });
  }
}
result.transparency.strokeCount = result.transparency.strokeSubstitutions.length;
result.transparency.fillCount = result.transparency.fillSubstitutions.length;

writeFileSync(new URL('../data/F1_DERIVATION.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');

console.log('ceiling (analytical relation vs World):', result.ceiling.value, ' relation OkLCh L', result.ceiling.relationOklchL);
console.log('atmosphere near-layer ink OkLCh L      :', f(oklchOf(ink(BASE[0], 150))[0], 4), '<- the headroom question');
console.log('');
console.log('LEVER 1 alpha only  -> reached target?', result.levers[0].reachedTarget, '| at full opacity worst', result.levers[0].atFullOpacity.worst, 'best', result.levers[0].atFullOpacity.best);
console.log('  per layer at full opacity:', JSON.stringify(result.levers[0].perLayerAtFullOpacity));
console.log('  shortfall', result.levers[0].shortfall, 'cases still short:', result.levers[0].casesStillShort.join(', ') || 'none');
console.log('');
console.log('HIERARCHY default ratio', result.hierarchy.defaultRatio, '= weakest analytical', result.hierarchy.defaultWeakestAnalytical, '/ loudest contour', result.hierarchy.defaultLoudestContour);
console.log('LEVER 2A (default ceiling', result.levers[1].ceiling + ') ->', JSON.stringify(result.levers[1].chosen));
console.log('LEVER 2B (raised  ceiling', result.levers[2].ceiling + ') ->', JSON.stringify(result.levers[2].chosen && { delta: result.levers[2].chosen.delta, blocked: result.levers[2].chosen.blocked, ratio: result.levers[2].chosen.ratio }));
console.log('FINDING:', JSON.stringify(result.finding.verdict === 'REACHED' ? {
  verdict: result.finding.verdict, delta: result.finding.lightnessDelta,
  layersAfter: result.finding.layersAfter, worst: result.finding.worstAfter, best: result.finding.bestAfter,
  headroomBelowRelation: result.finding.headroomBelowRelation,
  order: result.finding.orderPreserved, spacing: result.finding.spacingAfter,
  hue: result.finding.hueStillCarriesNothing,
} : result.finding));
console.log('');
console.log('ground rejected:', JSON.stringify(result.groundRejected.rows));
console.log('boundary:');
for (const c of result.boundary.candidates) console.log('   ', String(c.vsSurface).padStart(6), String(c.vsWorld).padStart(6), c.meetsThreeToOneBothSides ? 'OK ' : '-- ', c.name);
