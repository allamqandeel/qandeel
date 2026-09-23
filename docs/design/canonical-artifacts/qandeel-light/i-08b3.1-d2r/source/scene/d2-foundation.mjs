/**
 * I-08B3.1-D2R — THE FOUNDATION, AND THE ONE LAW THE WHOLE LIGHT SYSTEM SHARES.
 *
 * D2 completes QANDEEL LIGHT. Four categories express four different Product truths:
 *
 *   AMBIENT    = FIELD        the world's atmosphere. NOT meaning.
 *   CONNECTION = DIRECTION    A relates to B. INHERITED, not redesigned.
 *   PATTERN    = CONVERGENCE  A + B + C are one larger structure.
 *   INSIGHT    = EMERGENCE    something new is understood.
 *
 * THE COHERENCE CLAIM IS ARCHITECTURAL, NOT STYLISTIC. The four are one language because they
 * are four TOPOLOGIES OF ONE FALLOFF LAW, driven by one lifecycle envelope, composed from one
 * easing vocabulary, and ending in one kind of residue. Everything in that sentence is a
 * function in this file or imported into it, so "do these belong together" is answerable by
 * reading the call graph and not only by looking.
 */

import {
  EASE, phase, envelope, bezier,
} from '../vendor/d1/d1-scene.mjs';
import { srgbToOklch, hexToRgb8 } from '../vendor/color.mjs';

/* ------------------------------------------------------------------ the vocabulary ------ */
/**
 * THE EASING VOCABULARY IS IMPORTED, NOT RESTATED.
 *
 * I-08B3.1-D0 derived these three curves and recorded why the house UI curves tear at this
 * timescale; D0R shipped them; D1 inherited them unchanged. D2 does not re-author them and does
 * not add a fourth. Re-exported here so that every D2 module reaches them through one name, and
 * so that a future reader can see at a glance that the vocabulary crossed the package boundary
 * as code rather than as a paragraph saying it did.
 */
export { EASE, phase, envelope, bezier };

/* ------------------------------------------------------------------- the foundation ----- */
/** FROZEN in I-08B3.0 / I-08B3.1-A. Re-resolved from C3's sealed token files at build time. */
export const FOUNDATION = {
  WORLD: '#101010',
  SURFACE: '#181818',
  PRIMARY: '#d8d5ca',
  SECONDARY: '#afaca3',
  TERTIARY: '#8b8982',
  BRASS: '#A58E6F',
};

/**
 * P2 — IDENTITY MACHINERY FAMILY. Every value resolved at build time from the vendored C3
 * token tree, by VALUE and by ALIAS ROUTE. A hex that happens to be right today is a copy.
 */
export const CHROME = {
  /** qandeel.identity.mark -> qandeel.identity.material -> …living-brass.body */
  identityMark: '#a58e6f',
  /** qandeel.navigation.machinery -> qandeel.identity.material -> …living-brass.body */
  navigationMachinery: '#a58e6f',
  /** qandeel.control.functional -> qandeel.content.tertiary */
  controlFunctional: '#8b8982',
  /** qandeel.analysis.node -> qandeel.content.primary */
  analysisNode: '#d8d5ca',
  /** qandeel.analysis.relation -> qandeel.content.tertiary. D1's foundation alignment, kept. */
  analysisRelation: '#8b8982',
  opacity: 1,
};

/* ------------------------------------------------------------------------ THE LIGHT ----- */
/**
 * QANDEEL LIGHT — FREEZE CANDIDATE. Not frozen by this package; see §26 of the brief and
 * D2R_FREEZE_CANDIDATE.md. `qandeel.illumination` is populated here as a CANDIDATE token set
 * that stands beside the sealed C3 tree rather than inside it.
 *
 * DERIVED, NOT CHOSEN. I-08B3.1-D1 closed with a finding: the diagnostic family passes within
 * ΔEok 0.0163 of Living Brass, so at low intensity LIGHT and MATTER stop being separable and
 * the doctrine stops being checkable at exactly the intensities an arrival decays through.
 *
 * `source/tools/d2-lightsearch.mjs` turns that finding into the requirement and searches for
 * the colour it implies. Measured on the FULL compositing path — three stops x two grounds x
 * 513 alphas — the diagnostic family is even closer than D1's raster sampling found: 0.0118.
 *
 * The selection rule was stated before the numbers were read: meet 0.020, then take the LOWEST
 * HUE that does, because this is a freeze candidate and it should move the smallest distance
 * its own requirement forces. It landed 5 degrees from the family the Product Owner has already
 * seen three times.
 */
/**
 * **0.020 IS AN ENGINEERING HEURISTIC, NOT A PERCEPTUAL LAW, AND NO ARITHMETIC FROZE THIS
 * COLOUR.** It is the floor this package adopted so the search had a bound that was not taste,
 * and its justification is comparative: the family it replaces measures 0.0118, and I-08B3.1-D1
 * could not tell that family's dim tail from the identity material. Acceptance of the result
 * remains this measurement PLUS visual Product review PLUS device validation.
 */
export const LIGHT = {
  CORE: '#fbf2db',
  MID: '#e8ddc2',
  LOW: '#d6caa9',
  status: 'FREEZE CANDIDATE — proposed by I-08B3.1-D2, frozen by nobody',
  authored: { colorSpace: 'oklch', hue: 89, chromaMax: 0.046, rampShapeInheritedFrom: 'I-08B3.1-D0 diagnostic family' },
  separationFromBrass: 0.0201,
  separationRequired: 0.020,
  diagnosticSeparation: 0.0118,
};

/** The family D0/D0R/D1 used. Kept so the comparison board can show what changed and why. */
export const LIGHT_DIAGNOSTIC = { CORE: '#fef1d6', MID: '#ecdcbc', LOW: '#dcc8a1' };

/* -------------------------------------------------------------- THE ONE FALLOFF LAW ----- */
/**
 * HOW LIGHT FALLS OFF IN QANDEEL. ONE function, used by all four categories.
 *
 * Inherited from I-08B3.1-D0R's reception model, which D1 extended to take the maximum over
 * every warm source in the scene. D2 changes neither the law nor its constants; it only gives
 * them a name and makes every category reach them through it.
 *
 * This is the load-bearing half of the coherence claim. AMBIENT, CONNECTION, PATTERN and
 * INSIGHT differ in WHERE the light is and HOW MANY sources there are — field, route, converging
 * ring, contracting gather — and in nothing else. A viewer reading them as one language is
 * reading a real shared property and not a family resemblance someone asserted.
 */
export const FALLOFF = { REACH_BASE: 1.5, REACH_GAIN: 2.5, EXPONENT: 0.7, CEILING: 0.75 };

export function falloff(distance, radius, level) {
  if (level <= 0 || radius <= 0) return 0;
  const reach = radius * (FALLOFF.REACH_BASE + FALLOFF.REACH_GAIN * level);
  const k = Math.max(0, Math.min(1, 1 - distance / reach));
  return level * Math.pow(k, FALLOFF.EXPONENT) * FALLOFF.CEILING;
}

/**
 * How strongly the Living Brass mark is ILLUMINATED, given every warm source in the scene.
 *
 * A category cannot write "the Q is lit now". It can only bring light near the mark, and it
 * cannot do that without the light being visible on its way. Sources are {x, y, r, level}.
 */
export function markIllumination(sources, mark) {
  let best = 0;
  for (const s of sources) {
    if (!s || s.level <= 0) continue;
    const q = falloff(Math.hypot(s.x - mark.x, s.y - mark.y), s.r, s.level);
    if (q > best) best = q;
  }
  return best;
}

/* -------------------------------------------------------------- THE ONE LIFECYCLE ------- */
/**
 * EMERGE -> CRYSTALLIZE -> SETTLE, in milliseconds, shared by every MEANING event.
 *
 * These are the numbers I-08B3.1-D1 ran and the Product Owner accepted at D1's ARRIVE beat:
 * 260 ms of rise, 1150 ms of fall, asymmetric, reaching EXACTLY zero. D2 does not retune them.
 *
 * WHY THIS IS NOT A SPRING, stated because the reference gate raised it. Material 3 replaced
 * its easing-and-duration system with a physics system in May 2025, and its own split is the
 * reason the answer here is still a curve: M3 separates SPATIAL springs, which overshoot and
 * bounce into place, from EFFECTS springs for colour and opacity "where there shouldn't be any
 * overshoot". Light intensity is an effect in exactly that sense. An overshoot in a meaning
 * event would be the insight arriving, retracting and arriving again — and a bounce is delight,
 * which `animate` permits only at the rare/first-time tier. The one place D2 does use momentum
 * physics is the ambient pan, which is a gesture, and there it uses Apple's projection function
 * rather than a curve. SPATIAL MAY OVERSHOOT. LIGHT MAY NOT.
 */
export const LIFECYCLE = { RISE: 260, FALL: 1150 };

/** The shared envelope, bound to the shared lifecycle. Every meaning event rises and falls here. */
export const meaningEnvelope = (t, t0, scale = 1) => envelope(t, t0, LIFECYCLE.RISE * scale, LIFECYCLE.FALL * scale);

/* ----------------------------------------------------------------------- viewport ------- */
/** IDENTICAL to D0, D0R and D1. 390 x 844 CSS px at DPR 2 — one phone, one frame, one history. */
export const VIEW = { W: 390, H: 844, DPR: 2 };

/** IDENTICAL to D1. The analytical plane is what lies between them. */
export const FRAME = { header: 56, nav: 64 };

/** The canonical Q, in Living Brass, in the functional header. Same place as D0R and D1. */
export const MARK = { cx: 348, cy: 28, h: 23 };

/* ------------------------------------------------------------- AMBIENT IS NOT LIGHT ----- */
/**
 * THE ATMOSPHERE PALETTE — and the single rule that keeps it from ever lying.
 *
 *   ATMOSPHERE IS NEVER THE MOST COLOURFUL THING ON SCREEN.
 *
 * Every ambient colour is bounded to a chroma below BOTH the identity material's (0.0516) and
 * the Light's dimmest stop (0.046). So the ordering of chroma on a QANDEEL screen is fixed:
 * MEANING and MATTER are the chromatic things; ATMOSPHERE is the quiet one. A ring can never be
 * mistaken for a meaning event, and the mistake is unavailable by arithmetic rather than
 * forbidden by a rule someone has to remember. Guard G5 measures it on rasters.
 *
 * SIX HUES, CLOSED, AND DELIBERATELY OUTSIDE THE WARM BAND. A topic's hue is its IDENTITY, not
 * its value: every ring carries the same chroma and the same lightness, so nothing about the
 * palette is ordinal and no ring can look more important than another. The set excludes the
 * warm band entirely, which is what makes "atmosphere is not Light and not Brass" true by
 * construction and not only by chroma.
 *
 * AND HUE IS NEVER THE ONLY CHANNEL. Apple's accessibility guidance is explicit: "Convey
 * information with more than color alone... Offer visual indicators, like distinct shapes."
 * A topic's CONTOUR is derived from the same identity as its hue, so two topics differ in shape
 * whether or not the viewer can tell their hues apart. See d2-world.mjs.
 */
const chromaOf = (hex) => srgbToOklch(hexToRgb8(hex).map((c) => c / 255))[1];

/**
 * THE CEILING IS DERIVED, NOT TYPED.
 *
 * It is a fraction of the LEAST chromatic stop of the Light — and the least chromatic stop is
 * CORE, the brightest one, which is the trap a typed number walks into. "Below the Light"
 * sounds like it means below the Light's deepest colour; it has to mean below its palest,
 * because a ring that outranks CORE outranks the Light somewhere.
 *
 * Deriving it means the rule survives the Light being re-chosen. If a later package picks a
 * paler Light, the atmosphere gets quieter on its own, and nobody has to remember that the two
 * numbers were related. Gate 5 in d2-build.mjs still measures the finished inks, because a
 * derivation is a claim about arithmetic and the gate is a claim about what was painted.
 *
 * THE FRACTION WAS 0.80 AND A MEASUREMENT MOVED IT TO 0.62. At 0.80 the ceiling landed at
 * chroma 0.0254 — genuinely below the Light, so the RULE held, but only just: the boundary that
 * separates "atmosphere" from "Light" on a raster fell between 0.0254 and 0.0317, and an
 * antialiased ring edge or a low-alpha Light can each move a few thousandths. A rule that is
 * arithmetically true and not measurable is half a rule. At 0.62 the three families sit at
 * 0.0153 (ink), 0.0197 (atmosphere) and 0.0317 (Light), and the gaps are wide enough that a
 * pixel can be ASSIGNED to one of them rather than merely compared against a line.
 *
 * The cost is real and was weighed: the rings carry less colour. It is affordable because the
 * character of this world was never in its saturation — it is in the contour, which is
 * untouched.
 */
export const ATMOSPHERE = {
  chromaCeiling: +(0.62 * Math.min(chromaOf(LIGHT.CORE), chromaOf(LIGHT.MID), chromaOf(LIGHT.LOW))).toFixed(4),
  hues: [150, 192, 228, 262, 300, 338],
  L: { near: 0.62, mid: 0.55, far: 0.48 },
};

/* --------------------------------------------------------------------- the timeline ----- */
/** The three MEANING categories share one timeline, so they can be watched against each other. */
export const T = {
  REST_END: 800,
  EVENT_START: 2600,
  EVENT_END: 3500,
  SETTLE_END: 5800,
  TOTAL: 7000,
  FPS: 30,
};
T.FRAMES = Math.round((T.TOTAL / 1000) * T.FPS);

/** AMBIENT is not an event and does not share the event timeline. It has three worlds to show. */
export const TA = {
  P_STILL: [0, 2200],
  P_PAN: [2200, 3100],
  P_REST: [3100, 3600],
  S_CUT: 3600,
  S_STILL: [3600, 5200],
  S_PAN: [5200, 6100],
  S_REST: [6100, 6400],
  U_CUT: 6400,
  U_STILL: [6400, 8000],
  U_PAN: [8000, 8700],
  TOTAL: 9000,
  FPS: 30,
};
TA.FRAMES = Math.round((TA.TOTAL / 1000) * TA.FPS);

/** Frames a reviewer is pointed at, chosen on phase structure rather than by eye. */
export const KEYFRAMES = {
  REST: Math.floor((T.REST_END / 1000) * T.FPS),
  EVENT: Math.round((2900 / 1000) * T.FPS),
  SETTLED: T.FRAMES - 1,
};

export const AMBIENT_KEYFRAMES = {
  PERSONAL: Math.round((1600 / 1000) * TA.FPS),
  PARALLAX: Math.round((2800 / 1000) * TA.FPS),
  SHARED: Math.round((4400 / 1000) * TA.FPS),
  PUBLIC: Math.round((7200 / 1000) * TA.FPS),
};
