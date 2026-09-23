/**
 * I-08B3.1-D2R — THE AMBIENT WORLD.
 *
 * ==========================================================================================
 * WHAT CHANGED IN D2R, AND WHY IT WAS A BLOCKER
 * ==========================================================================================
 *
 * I-08B3.1-D2 gave this field's geometry PRODUCT MEANING it had no authority to give. It said a
 * ring's radius was how much material a topic holds, that its depth plane was how recently the
 * topic was active, that a gap in a Shared contour was the fraction of the topic that exists in
 * that world, that a Public world's dimness meant less of it was resolved to you, and that a
 * contour's shape was a permanent analytical identity.
 *
 * NONE OF THAT WAS AUTHORISED BY ANY FROZEN CONTRACT. The Living Analysis Map's rule is
 * explicit and D2 walked straight through it:
 *
 *     GEOMETRY DOES NOT MANUFACTURE MEANING.
 *
 * Distance, direction, adjacency, orientation, size, footprint and contour morphology carry
 * ZERO analytical meaning by default. They acquire meaning only when a separate canonical
 * Product contract grants it, and none does.
 *
 * The seductive part is that each claim was individually plausible and none was needed. The
 * VISUALS were never the problem — a field of irregular contours at varying sizes and depths is
 * exactly as rich without a data story attached. What D2 did was invent a rationale to justify a
 * composition it had already made, which is how a presentation decision becomes a lie about the
 * product. **If a visual property is presentation, say so.**
 *
 * So every property below is declared in PRESENTATION_CONTRACT, every one of them declares
 * `encodes: null`, and the build refuses to emit a page if any entry claims otherwise without
 * naming a canonical source. See `source/tools/d2-build.mjs` gate 6 and guard S1.
 */

import { ATMOSPHERE, FRAME, VIEW, TA, phase, EASE } from './d2-foundation.mjs';
import { oklchToSrgbRaw, to8bit, rgb8ToHex, inSrgbGamut } from '../vendor/color.mjs';

/* ====================================================== THE PRESENTATION CONTRACT ===== */
/**
 * EVERY VISUAL PROPERTY OF THE AMBIENT FIELD, AND WHAT IT MEANS.
 *
 * This is not documentation. It is a data structure the build reads and refuses to proceed
 * without, and it is the thing guard S1 probes. `encodes: null` is a claim that the property
 * carries no analytical meaning; anything else must name the canonical contract that grants the
 * meaning, and there is currently no such contract for any of these.
 *
 * A property may be beautiful, deliberate and carefully composed and still encode nothing. That
 * is the normal case for atmosphere, and it is what this table records.
 */
export const PRESENTATION_CONTRACT = {
  'ring.radius': {
    encodes: null,
    is: 'Composition. Rings vary in size so the field has rhythm rather than a uniform grid.',
    doesNotMean: 'amount of material, importance, confidence, activity, size of anything',
  },
  'ring.layer': {
    encodes: null,
    is: 'Apparent depth, for spatial richness and to give the pan something to reveal.',
    doesNotMean: 'recency, age, relevance, rank, distance in time',
  },
  'ring.contourCount': {
    encodes: null,
    is: 'A depth cue. Nearer layers are drawn with more level lines, the way a nearer hill on a map shows more of them.',
    doesNotMean: 'temporal distance, quantity, density of anything analytical',
  },
  'ring.contourShape': {
    encodes: null,
    is: 'Authored irregularity from a PRESENTATION SEED, so the field is not a set of circles. The seed is a composition choice; it is not derived from the topic\'s analytical identity and carries NO guarantee of stability across releases, devices or users.',
    doesNotMean: 'identity, a signature, a permanent property of the topic, anything recognisable-by-shape',
  },
  'ring.hue': {
    encodes: null,
    is: 'One of six authored atmosphere hues, assigned for composition. Every ring on a layer carries the same chroma and the same lightness.',
    doesNotMean: 'category, identity, type, state, sentiment',
  },
  'world.treatment': {
    encodes: 'WHICH WORLD IS OPEN — and nothing about any topic in it.',
    source: 'The world kind is disclosed Product state: the user knows which world they opened. The TREATMENT is a uniform atmosphere applied to the whole field, identical for every topic in that world.',
    is: 'A contextual atmosphere keyed to a single disclosed fact.',
    doesNotMean: 'per-topic sharing, per-topic availability, how much of a topic is visible, how much is known',
  },
  'field.parallax': {
    encodes: null,
    is: 'Depth response to the user\'s own hand. Layer rates are a spatial cue.',
    doesNotMean: 'time, sequence, importance',
  },
};

/** Guard S1 and build gate 6 both read this. A property whose meaning is not null must cite one. */
export function contractViolations() {
  const bad = [];
  for (const [key, entry] of Object.entries(PRESENTATION_CONTRACT)) {
    if (entry.encodes === null) continue;
    if (!entry.source) bad.push(`${key} claims to encode "${entry.encodes}" and names no canonical source`);
  }
  return bad;
}

/* -------------------------------------------------------------- presentation seed ----- */
/**
 * A PRESENTATION SEED, AND THE DIFFERENCE FROM D2's `identity()` IS THE WHOLE CORRECTION.
 *
 * D2 hashed the topic's analytical id, which made a topic's contour a stable, per-topic,
 * cross-device fingerprint — and then claimed exactly that as a feature. That is an identity
 * channel the Product never granted, and it would have become a compatibility constraint the
 * moment anyone relied on it.
 *
 * This hashes an AUTHORED SEED that belongs to the scene, not to the topic. Same determinism
 * inside this proof — the package reproduces byte for byte — and no claim outside it. A later
 * release may reseed the whole field and lose nothing, because nothing was ever promised.
 */
export function presentationSeed(seed) {
  let h = 0x811c9dc5;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const draw = (h, i) => {
  let x = (h ^ Math.imul(i + 1, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

/**
 * THE CONTOUR. r(θ) = r0 · (1 + Σ a_k·cos(kθ + φ_k)) for k = 2, 3, 4.
 *
 * Three harmonics, amplitudes summing to at most 6 % of the radius, phases from the
 * presentation seed. Bounded on purpose: at 6 % a ring is unmistakably not a circle and still
 * unmistakably a ring. Above roughly twice that the lobes start to look like a MEASUREMENT of
 * something — which is precisely the misreading this whole file now exists to prevent.
 *
 * k starts at 2 because k = 1 is a translation, not a shape, and a ring's centre is a real
 * position on a canonical map.
 */
export const CONTOUR = { harmonics: [2, 3, 4], amplitudeTotal: 0.06, samples: 84 };

export function contourHarmonics(seed) {
  const h = presentationSeed(seed);
  const raw = CONTOUR.harmonics.map((_, i) => 0.35 + 0.65 * draw(h, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return CONTOUR.harmonics.map((k, i) => ({
    k,
    a: (raw[i] / sum) * CONTOUR.amplitudeTotal,
    phi: draw(h, i + 8) * Math.PI * 2,
  }));
}

export function contourPath(topic, ringScale) {
  const H = contourHarmonics(topic.seed);
  const n = CONTOUR.samples;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    let m = 1;
    for (const { k, a, phi } of H) m += a * Math.cos(k * th + phi);
    const r = topic.radius * ringScale * m;
    pts.push([topic.x + r * Math.cos(th), topic.y + r * Math.sin(th)]);
  }
  const f = (p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  return `M ${f(pts[0])} ` + pts.slice(1).map((p) => `L ${f(p)}`).join(' ') + ' Z';
}

/* ----------------------------------------------------------------------- the topics --- */
/**
 * THE ONLY PROPERTY HERE THAT MEANS ANYTHING IS `x, y` — THE CANONICAL SEMANTIC GEOGRAPHY.
 *
 * Positions are inherited: five of these eight are I-08B3.1-D1's own `GEO.quiet` coordinates,
 * unchanged to the pixel, and a sixth is the locus D1's destination travels within. That
 * inheritance is why D1's scene and this field are one map rather than two drawings stacked.
 *
 * `radius`, `layer`, `hue` and `seed` are COMPOSITION. They were chosen so the field reads well.
 * They encode nothing, and D2's `extent`, `plane` and `shared` fields — which claimed to encode
 * quantity, recency and a sharing fraction — are gone rather than renamed.
 *
 * `shared` in particular is not merely undocumented now; the number itself has been deleted,
 * because a number in a scene file is a thing a later reader will find a use for.
 */
export const TOPICS = [
  { id: 'task-delay', label: 'تأجيل المهام', x: 286, y: 258, radius: 40, layer: 0, hue: 1, seed: 'a1', from: 'D1 GEO.quiet[0]' },
  { id: 'mastery', label: 'الرغبة في الإتقان', x: 108, y: 300, radius: 36, layer: 0, hue: 3, seed: 'a2', from: 'D1 GEO.quiet[1]' },
  { id: 'comparison', label: 'مقارنة بالآخرين', x: 300, y: 392, radius: 30, layer: 1, hue: 0, seed: 'a3', from: 'D1 GEO.quiet[2]' },
  { id: 'sleep', label: 'قلّة النوم', x: 96, y: 430, radius: 32, layer: 0, hue: 2, seed: 'a4', from: 'D1 GEO.quiet[3]' },
  { id: 'fear-shortfall', label: 'الخوف من التقصير', x: 145, y: 527, radius: 44, layer: 1, hue: 4, seed: 'a5', from: 'D1 GEO.prior locus' },
  { id: 'weekend-fatigue', label: 'إرهاق آخر الأسبوع', x: 262, y: 650, radius: 26, layer: 2, hue: 5, seed: 'a6', from: 'D1 GEO.quiet[4]' },
  { id: 'close-relations', label: 'العلاقات القريبة', x: 66, y: 196, radius: 22, layer: 2, hue: 0, seed: 'a7', from: 'D2' },
  { id: 'energy-decline', label: 'تراجع الطاقة', x: 150, y: 690, radius: 28, layer: 1, hue: 2, seed: 'a8', from: 'D2' },
];

/** Keys a topic record is permitted to carry. Guard S1 probes this list. */
export const TOPIC_KEYS = ['id', 'label', 'x', 'y', 'radius', 'layer', 'hue', 'seed', 'from'];

/**
 * A ring's ink. ONE chroma and ONE lightness per depth layer, for every topic on that layer.
 *
 * The constancy is what keeps the palette non-ordinal: two rings on a layer differ in hue and in
 * nothing else, so neither can be brighter, more saturated or more insistent than the other.
 * There is no quantity in the palette to order.
 */
export function ringInk(hue, layer) {
  const L = [ATMOSPHERE.L.near, ATMOSPHERE.L.mid, ATMOSPHERE.L.far][layer];
  const triple = [L, ATMOSPHERE.chromaCeiling, hue];
  if (!inSrgbGamut(triple)) {
    throw new Error(`d2-world: ring ink oklch(${L} ${ATMOSPHERE.chromaCeiling} ${hue}) is outside sRGB`);
  }
  return rgb8ToHex(to8bit(oklchToSrgbRaw(triple)));
}

/** Level lines per layer. A depth cue and nothing else — see PRESENTATION_CONTRACT. */
export const RINGS = [[1.0, 0.72, 0.44], [1.0, 0.66], [1.0]];

/**
 * PARALLAX RATES. Near moves with the hand; far lags.
 *
 * Under reduced motion every layer uses the NEAR rate, so the layers move together and there is
 * no relative motion at all — the vestibular part is removed and the depth, which is carried by
 * scale, luminance and level-line count, is untouched.
 */
export const PARALLAX = [1.0, 0.72, 0.48];

/* ------------------------------------------------------------------- the three worlds --- */
/**
 * ONE FIELD, THREE ATMOSPHERES — AND EVERY DIFFERENCE IS UNIFORM ACROSS THE WHOLE FIELD.
 *
 * This is the other half of the D2R correction. D2's Shared world dashed each contour by a
 * PER-TOPIC fraction and its Public world removed labels below a depth, so both treatments
 * carried hidden per-topic quantities. Here the treatment is a property of THE WORLD, applied
 * identically to every topic in it, keyed to the one fact that is genuinely disclosed: which
 * world the user opened.
 *
 * So the three still feel like different places, and nothing about any individual topic is
 * claimed. A reader can tell which world they are in; they cannot infer anything about a ring
 * from how that world is drawn, because every ring in it is drawn the same way.
 */
export const WORLDS = {
  personal: {
    key: 'personal', name: 'العالم الخاص',
    strokeAlpha: [0.86, 0.60, 0.40], fillAlpha: 0.050, dash: null, ringLimit: 3, labelAlpha: 1.0,
  },
  shared: {
    key: 'shared', name: 'عالم مشترك',
    /* ONE dash, identical on every contour of every topic. It says "shared world", not
       "this much of this topic". */
    strokeAlpha: [0.84, 0.58, 0.38], fillAlpha: 0.040, dash: '7 5', ringLimit: 3, labelAlpha: 1.0,
  },
  public: {
    key: 'public', name: 'عالم عام',
    /* Fewer level lines and a lower luminance, uniformly. Labels are NOT removed: in D2 the
       removal was justified as "less of the world is resolved to you", which is a claim about
       knowledge. Every topic is named in every world. */
    strokeAlpha: [0.58, 0.40, 0.26], fillAlpha: 0.014, dash: null, ringLimit: 1, labelAlpha: 0.74,
  },
};

/* --------------------------------------------------------------------------- the pan ---- */
/**
 * THE ONLY MOTION AMBIENT HAS, AND IT IS THE USER'S.
 *
 * A finger drags the map and the map tracks it 1:1 — no duration, no easing, no interpretation.
 * On release the map continues at the finger's exact velocity and comes to rest at the position
 * the gesture was GOING to, using Apple's own projection function:
 *
 *     project(v) = (v / 1000) · d / (1 − d),  d = 0.998
 *
 * This is not an animation of the map. It is the second half of one gesture, and the seam
 * between drag and glide is where an interface stops feeling direct.
 */
export const DECELERATION = 0.998;
export const project = (v) => (v / 1000) * DECELERATION / (1 - DECELERATION);

function finger(t, span, distance) {
  const [t0, t1] = span;
  const dur = (t1 - t0) / 1000;
  const p = phase(t, t0, t1);
  const s = EASE.emerge(p);
  const displacement = distance * s;
  const dp = 1 / (dur * 60);
  const vel = ((EASE.emerge(Math.min(1, p + dp)) - s) * distance) / (dp * dur);
  return { displacement, vel };
}

/**
 * `reduced` removes exactly two things: the momentum glide — Reanimated's `withDecay` under
 * reduced motion "returns the current value immediately", so the map stops where the finger let
 * go — and the parallax differential.
 */
export function panAt(t, span, restEnd, distance, reduced) {
  const [t0, t1] = span;
  if (t <= t0) return { dx: 0, held: false };
  if (t <= t1) {
    const { displacement } = finger(t, span, distance);
    return { dx: displacement, held: true };
  }
  const { vel } = finger(t1, span, distance);
  if (reduced) return { dx: distance, held: false };
  const glide = project(vel);
  const k = EASE.considered(phase(t, t1, restEnd));
  return { dx: distance + glide * k, held: false, projected: glide };
}

/**
 * THE AMBIENT STATE VECTOR — three members, and that is the point.
 *
 * No level, no phase, no intensity, no time-varying anything: `world` says which of the three is
 * on screen, `dx` is where the user's hand has put it, `held` is whether the hand is still down.
 * A state vector with nothing in it that varies on its own IS the claim this category makes.
 */
export function ambient(t, reduced = false) {
  if (t < TA.S_CUT) {
    return { world: 'personal', ...panAt(t, TA.P_PAN, TA.P_REST[1], -58, reduced) };
  }
  if (t < TA.U_CUT) {
    return { world: 'shared', ...panAt(t, TA.S_PAN, TA.S_REST[1], 44, reduced) };
  }
  return { world: 'public', ...panAt(t, TA.U_PAN, TA.TOTAL, -36, reduced) };
}

/* ------------------------------------------------------------------- derived geometry --- */
export const PLANE = { top: FRAME.header, bottom: VIEW.H - FRAME.nav, w: VIEW.W };

export const topicById = (id) => {
  const t = TOPICS.find((x) => x.id === id);
  if (!t) throw new Error(`d2-world: no topic '${id}'`);
  return t;
};

/**
 * Everything the page needs about the field, computed HERE so the browser computes nothing.
 *
 * Every contour path and every colour is a build-time constant by the time the page loads. The
 * field is not "cheap to animate"; there is nothing in it to animate — which is also what makes
 * the stillness provable, since a frame can only differ from the previous one if a hand moved.
 */
export function fieldData() {
  return TOPICS.map((t) => ({
    id: t.id, label: t.label,
    x: t.x, y: t.y, layer: t.layer,
    hue: ATMOSPHERE.hues[t.hue], ink: ringInk(ATMOSPHERE.hues[t.hue], t.layer),
    radius: t.radius,
    rings: RINGS[t.layer].map((s) => ({ scale: s, d: contourPath(t, s) })),
  }));
}

/** Keys the page is permitted to receive. Anything else would be a quantity crossing the wire. */
export const FIELD_KEYS = ['id', 'label', 'x', 'y', 'layer', 'hue', 'ink', 'radius', 'rings'];
