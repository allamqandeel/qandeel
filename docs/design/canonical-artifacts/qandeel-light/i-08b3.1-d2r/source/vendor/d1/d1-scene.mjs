/**
 * I-08B3.1-D1 — THE SCENE.
 *
 * ONE scene, ONE renderer, THREE ARRIVAL functions — and, unlike D0, a CONNECT phase that is
 * not a variable at all.
 *
 * D0 compared three MOVEMENT languages, so its fairness problem was "hold the scene still and
 * let the motion vary". D1 compares three ARRIVAL languages on a movement language the Product
 * Owner has already selected, so its fairness problem is narrower and much sharper: everything
 * up to the moment of contact must be the SAME EVENT, not a similar one.
 *
 * That is solved by construction rather than by discipline. `guidedThread(t)` below is the only
 * thing that writes the Guided Thread's channels, all three arrivals call it, and none of them
 * can reach those channels afterwards — the arrival functions return a partial state that is
 * MERGED ONTO the thread's, and the merge refuses any key the thread owns. So:
 *
 *   - Frames 0..77 (t < 2600 ms) are produced by identical state in all three directions, and
 *     the rasters are therefore byte-identical. Measured, not asserted: source/tools/d1-fairness.mjs.
 *   - `priorTravel`, `threadPos`, `threadLevel`, `currentLight` and `relationDraw` are identical
 *     at ALL 210 frames, including through the arrival, because the destination's advance and
 *     the analytical state change belong to the selected motion language, not to the arrival
 *     treatment.
 *   - Frames 174..209 (t >= 5800 ms) are the settled state, identical in all three.
 *
 * WHAT A D1 DIRECTION MAY ACTUALLY CHANGE is the eleven arrival channels at the bottom of the
 * state vector, between 2600 ms and 5800 ms. Nothing else is reachable.
 *
 * DETERMINISM, unchanged from D0: no CSS transition, no CSS animation, no clock. Every visual
 * property is written imperatively from apply(t). The prototype drives it from
 * requestAnimationFrame; the capture harness seeks it to an exact millisecond.
 */

/* ===================================================================== timeline ======= */
/**
 * IDENTICAL TO I-08B3.1-D0R, to the millisecond. Not "similar duration envelope" — the same
 * numbers, so the brief's fairness clause ("the same duration envelope as reasonably possible")
 * is satisfied by there being only one envelope.
 *
 * No duration below is a proposal. D1 is forbidden from freezing timing and does not.
 */
export const T = {
  REST_END: 800,
  CONNECT_END: 2600,   // CONNECT — 1800 ms. IDENTICAL in A, B and C by construction.
  ARRIVE_END: 3500,    // ARRIVE  —  900 ms. The only window the three directions differ in.
  SETTLE_END: 5800,    // SETTLE  — 2300 ms.
  TOTAL: 7000,         // HOLD    — 1200 ms of settled state.
  FPS: 30,
};
T.FRAMES = Math.round((T.TOTAL / 1000) * T.FPS);

/**
 * The frame indices the fairness instrument partitions on. Computed from the phase boundaries
 * rather than typed, because an off-by-one here would silently weaken the claim it supports.
 *
 * SHARED_LAST is the last frame whose millisecond is strictly before CONNECT_END: frame 78 is
 * exactly 2600 ms and `t < T.CONNECT_END` is already false there, so 78 belongs to the arrival.
 */
export const PARTITION = {
  SHARED_LAST: Math.ceil((T.CONNECT_END / 1000) * T.FPS) - 1,   // 77
  SETTLED_FIRST: Math.ceil((T.SETTLE_END / 1000) * T.FPS),      // 174
  LAST: T.FRAMES - 1,                                           // 209
};

/** Frames a reviewer is pointed at, chosen on the phase structure rather than by eye. */
export const KEYFRAMES = {
  START: Math.floor((T.REST_END / 1000) * T.FPS),   // the last frame still at rest
  ARRIVAL: Math.round((2900 / 1000) * T.FPS),       // 300 ms after contact — the arrival beat
  SETTLED: T.FRAMES - 1,                            // the last frame of the settled hold
};

/* ================================================================== foundation ======== */
/** FROZEN. Not reopened by D0, not by D0R, not by D1. Re-resolved from C3's sealed files. */
export const FOUNDATION = {
  WORLD: '#101010',
  SURFACE: '#181818',
  PRIMARY: '#d8d5ca',
  SECONDARY: '#afaca3',
  TERTIARY: '#8b8982',
  BRASS: '#A58E6F',
};

/* ============================================================== product chrome ======== */
/**
 * P2 — IDENTITY MACHINERY FAMILY, inherited from I-08B3.1-D0R and resolved the same way.
 *
 * None of these values is authored here. Every one is resolved at build time from the token
 * files I-08B3.1-C3 froze, vendored byte-identical under source/vendor/c3/, and the build
 * refuses to emit a page if what it resolves disagrees with what is written below — value,
 * alias ROUTE, and the whole inherited foundation. See source/tools/d1-chrome.mjs.
 *
 * D0R's lesson, applied rather than restated: a hex that happens to be right today is a copy,
 * not an inheritance.
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
  /**
   * qandeel.analysis.relation -> qandeel.content.tertiary
   *
   * THE FOUNDATION ALIGNMENT THIS PACKAGE WAS ASKED TO MAKE. D0 and D0R drew the settled
   * relation hairline as `#4a4740`, a literal held inside the proof and resolved from nothing.
   * D0R found it, recorded it, and deliberately did not touch it — re-pointing it changes the
   * settled frame, and D0R had no remit to change the artefact the Product Owner selected.
   *
   * D1 does have that remit, and the alignment turned out not to be cosmetic. The token's own
   * $description says what a relation stroke IS: "a graphical object under WCAG 2.2 SC 1.4.11
   * rather than text" — which carries a 3:1 minimum against its background. `#4a4740` on the
   * World measures 2.05:1 and fails it. `#8b8982` measures 5.43:1 and passes. Both figures are
   * re-derived at build time from the vendored token files and the vendored contrast code; see
   * D1_FOUNDATION_ALIGNMENT.md.
   *
   * ANALYTICAL MEANING IS UNCHANGED. The relation connects the same two facts, along the same
   * curve, at the same milliseconds, ending in the same geometry. Only its ink is now resolved
   * instead of held.
   */
  analysisRelation: '#8b8982',
  /** The identity material is opaque and has exactly one rung — C3 invariant I-09. */
  opacity: 1,
};

/**
 * The palette the REVIEW SURFACES use — the Product Owner's board and the contact sheets.
 *
 * DECLARED HERE IN D0R, AND MOVED OUT IN D1. It now lives in source/tools/d1-review-ink.mjs,
 * which no product surface imports, because D0R found that the builder was inlining the review
 * board's palette — including the name `accent`, which C3's invariant I-18 forbids in the token
 * system — into the product bundle as dead data. That was handed forward as "a one-line change
 * with no visual consequence that belongs in D1's first commit". This is that commit; the
 * export is gone from the scene rather than merely unused.
 */

/**
 * QANDEEL LIGHT — DIAGNOSTIC / NON-CANONICAL.
 *
 * The SAME family D0 derived and D0R shipped, byte for byte. D1 does not search for a Light
 * colour and does not freeze one: `qandeel.illumination` is RESERVED, EMPTY and owned by this
 * track, and it still has no valued member after this package. Guard G7 checks that.
 *
 * All three arrival directions use this identical family, at the same three stops, through the
 * same gradient and the same blend. A comparison in which one candidate had a warmer or
 * brighter Light would be comparing Light colours, which is not what D1 is for.
 */
export const LIGHT = {
  CORE: '#fef1d6',
  MID: '#ecdcbc',
  LOW: '#dcc8a1',
  status: 'DIAGNOSTIC / NON-CANONICAL',
};

/* ==================================================================== viewport ======== */
export const VIEW = { W: 390, H: 844, DPR: 2 };

/* ================================================================== geography ========= */
/**
 * IDENTICAL TO D0R. Every coordinate, every size, every weight. The brief requires the same
 * semantic geography across D1's variants AND the same geography as the selected Guided Thread,
 * so this block is inherited wholesale rather than re-derived.
 *
 * The one addition is `provisional` at the bottom, which is not a place any object can stand —
 * it is how far the UNRESOLVED relation's control points sit from the canonical ones.
 */
export const GEO = {
  header: { h: 56 },
  nav: { h: 64 },

  current: { x: 272, y: 118, size: 25, weight: 560 },
  currentLabel: { size: 11.5, weight: 400 },

  prior: {
    depth: { x: 122, y: 566, size: 19, scale: 0.86, blur: 0.6, opacity: 0.62, weight: 450 },
    relation: { x: 168, y: 488, size: 19, scale: 1.0, blur: 0, opacity: 1.0, weight: 480 },
  },
  priorLabel: { size: 11.5, weight: 400 },

  /** The canonical Q, in Living Brass, in the functional header. `qandeel.identity.mark`. */
  q: { cx: 348, cy: 28, h: 23 },

  quiet: [
    { text: 'تأجيل المهام', x: 286, y: 258, size: 14 },
    { text: 'الرغبة في الإتقان', x: 108, y: 300, size: 13.5 },
    { text: 'مقارنة بالآخرين', x: 300, y: 392, size: 14 },
    { text: 'قلّة النوم', x: 96, y: 430, size: 13.5 },
    { text: 'إرهاق آخر الأسبوع', x: 262, y: 650, size: 13.5 },
  ],

  /**
   * THE UNRESOLVED ROUTE — direction B's whole subject, and the reason B is not a glow.
   *
   * When QANDEEL first proposes a relation it knows WHAT it has connected before it knows
   * exactly HOW. So the provisional relation shares the canonical curve's ENDPOINTS exactly and
   * differs only in its two interior control points, displaced along the offsets below. The
   * endpoints are the analytical claim; the interior is the resolution of it.
   *
   * This is the difference between "the connection is uncertain" — which would be a semantic
   * falsehood, because the connection is not uncertain — and "the connection is not yet drawn
   * where it belongs", which is true of any analysis at the instant it is made.
   */
  provisional: { c1: [26, -19], c2: [-21, 24] },
};

/* ======================================================================= copy ========= */
/** The analytical facts. IDENTICAL across A, B and C, and identical to D0R's. */
export const COPY = {
  current: 'ضغط الشغل',
  currentLabel: 'في هذه المحادثة',
  prior: 'الخوف من التقصير',
  priorLabel: 'سبق أن ظهر',
};

/* ====================================================================== state ========= */
/**
 * THE STATE VECTOR, in two halves that are policed differently.
 *
 * THREAD_KEYS — written ONLY by guidedThread(t). An arrival function that returns any of these
 * keys is rejected by `merge()` with an error naming the key. This is the mechanical form of
 * "do not redesign the Guided Thread": it is not a rule anyone has to remember.
 *
 * ARRIVAL_KEYS — the eleven degrees of freedom a direction actually has.
 *
 * DELIBERATELY ABSENT, and each absence is a decision:
 *
 *   `priorLight`  D0R's warm light ON the destination's glyphs. Removed. In D1 the destination
 *                 resolves along the FROZEN NEUTRAL READING RAMP and never becomes warm, in any
 *                 direction, at any millisecond — which is what makes "touched by light, not
 *                 turned into a lamp" a measurement (guard G3) instead of a promise. Warm light
 *                 still reaches the GROUND beneath it, through `receptionGround`.
 *
 *   `relationLight` D0R's luminance carried by the relation. Removed from every direction, not
 *                 only from B. The brief forbids a luminous final relation and forbids turning
 *                 brightness into importance; a channel that exists is a channel that gets used,
 *                 and the relation is analytical STATE, which resolves by coherence and by
 *                 reveal. Nothing in D1 can light it.
 *
 *   `convergeNear` / `convergeFar` / two of D0's three motion languages' machinery. Removed:
 *                 they belonged to D0's CONVERGENT MEANING, which was not selected. A vector
 *                 carrying channels nothing writes is decoration, and D0 removed three unused
 *                 easing curves for exactly this reason.
 */
export const THREAD_KEYS = [
  'priorTravel', 'priorGhost', 'priorReveal',
  'threadPos', 'threadLevel', 'currentLight',
  'washX', 'washY', 'washR', 'washLevel', 'washElong',
  'relationDraw', 'relationOrigin', 'relationLevel',
];

export const ARRIVAL_KEYS = [
  'receptionBlur', 'receptionPress', 'receptionLift', 'receptionGround', 'priorSettle',
  'relationProvisional', 'relationConverge',
  'fieldRecede', 'currentOrient',
];

export const ZERO_STATE = Object.freeze({
  /* ---- THE GUIDED THREAD. Identical in A, B and C at every millisecond. --------------- */
  priorTravel: 0,      // 0 = DEPTH plane, 1 = RELATION plane.
  priorGhost: 0,       // opacity of a SECOND destination rendering held at the depth plane.
  priorReveal: 1,      // opacity multiplier on the main destination rendering.
  threadPos: 0,        // 0..1 head position of the travelling trace along the route.
  threadLevel: 0,      // visibility of that trace.
  currentLight: 0,     // readiness / participation of the current statement.
  washX: 0, washY: 0,  // the travelling light's centre, in scene px.
  washR: 0,            // its radius, in scene px.
  washLevel: 0,        // its strength.
  washElong: 0,        // 0 = circular, 1 = stretched along the route's tangent.
  relationDraw: 0,     // 0..1 how much of the CANONICAL relation is DRAWN along its length.
  relationOrigin: 1,   // the Guided Thread resolves the relation back from where the light landed.
  relationLevel: 1,    // 0..1 opacity of whatever length is drawn. Separate from relationDraw so
                       // the reduced-motion counterpart can show the WHOLE relation fading in
                       // rather than a line drawing itself — a wipe is motion, a fade is not.

  /* ---- THE ARRIVAL. The only thing a D1 direction may write. -------------------------- */
  /**
   * Both `receptionBlur` and `receptionPress` are TRANSIENTS: they are zero at rest and zero at
   * the settled state, so no direction can leave a trace of its arrival in the shared frames.
   * They are separate channels rather than one "focus" channel because they are two different
   * quantities, and a direction has to be able to take one without the other — direction B does
   * exactly that.
   */
  receptionBlur: 0,    // 0..1 transient bridging blur ON THE DESTINATION'S TEXT, 0.5 px at 1.
  receptionPress: 0,   // 0..1 transient scale compression of the destination, 1.4 % at 1.
  receptionLift: 0,    // 0..1 its ink lifted along the NEUTRAL ramp, SECONDARY -> PRIMARY.
  receptionGround: 0,  // 0..1 warm light on the GROUND beneath it. Never on the glyphs.
  priorSettle: 0,      // 0..1 micro follow-through along the arrival tangent, 1.5 px at 1.
  relationProvisional: 0, // 0..1 visibility of the UNRESOLVED relation.
  relationConverge: 0, // 0 = the provisional route, 1 = the canonical curve.
  fieldRecede: 0,      // 0..1 the quiet material's brief acknowledgement.
  currentOrient: 0,    // 0..1 the live statement's micro orientation toward the relation axis.
});

/**
 * The settled state. Reached by all six apply functions; audited for byte-equality.
 *
 * `threadPos` returns to 0 here and that is not a mistake, it is fidelity. D0R's settled state
 * put the trace's head back at the start of the route, where it is inert — `threadLevel` is 0,
 * so nothing is drawn, and the only other consumer of `threadPos` is the wash's rotation, which
 * is only read when `washLevel` is above zero and it is not. D1 could have left it at 1 and been
 * more coherent to read. It does not, because check F5 asserts that this package's Guided Thread
 * is the SAME FUNCTION D0R ran, at all 210 frames, to the last bit of a double — and a claim
 * that needs one channel excluded to be true is a weaker claim than the one being made.
 */
export const SETTLED_STATE = Object.freeze({
  ...ZERO_STATE,
  priorTravel: 1,
  relationDraw: 1,
});

/**
 * Merge an arrival's partial state onto the thread's, refusing any attempt to reach a thread
 * channel. The error names the key, because "the arrival redesigned the Guided Thread" is the
 * single failure this whole architecture exists to make impossible.
 */
export function merge(thread, arrival) {
  for (const k of Object.keys(arrival)) {
    if (THREAD_KEYS.includes(k)) {
      throw new Error(`d1-scene: an arrival direction may not write the Guided Thread channel '${k}'`);
    }
    if (!ARRIVAL_KEYS.includes(k)) {
      throw new Error(`d1-scene: '${k}' is not a declared arrival channel`);
    }
  }
  return { ...thread, ...arrival };
}

/* ===================================================================== easing ========= */
/** Cubic-bezier timing, solved numerically. Identical to D0R's, so the CONNECT phase is. */
export function bezier(x1, y1, x2, y2) {
  const A = (a, b) => 1 - 3 * b + 3 * a;
  const B = (a, b) => 3 * b - 6 * a;
  const Cc = (a) => 3 * a;
  const calc = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + Cc(a)) * t;
  const slope = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + Cc(a);
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = slope(t, x1, x2);
      if (Math.abs(d) < 1e-6) break;
      const e = calc(t, x1, x2) - x;
      if (Math.abs(e) < 1e-7) return calc(t, y1, y2);
      t -= e / d;
    }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 24; i++) {
      const e = calc(t, x1, x2) - x;
      if (Math.abs(e) < 1e-7) break;
      if (e > 0) hi = t; else lo = t;
      t = (lo + hi) / 2;
    }
    return calc(t, y1, y2);
  };
}

/**
 * THE SHARED EASING VOCABULARY — the same three curves D0 arrived at, unchanged, and still only
 * three. Three arrival languages drawing from three private curve sets would confound "a
 * different arrival" with "a different curve taste".
 *
 * The house animation guidance supplies ease-out (0.23, 1, 0.32, 1), ease-in-out
 * (0.77, 0, 0.175, 1) and the iOS drawer curve (0.32, 0.72, 0, 1), and forbids hand-rolling.
 * D0 measured all three against this task's spans and recorded why they tear here: they are
 * calibrated for 150-300 ms moves, where a peak slope near 5 is invisible because the whole
 * move is six frames. At 700-2300 ms the same curve concentrates the motion into a few frames
 * in the middle. D1's arrival beats are 270-750 ms, which is closer to the sanctioned range but
 * still outside it, and the curves below are inherited rather than re-argued — changing them
 * would change the CONNECT phase, which D1 may not do.
 */
export const EASE = {
  /** Both ends eased; commits earlier than it settles. Peak slope 2.23. */
  considered: bezier(0.38, 0.0, 0.32, 1.0),
  /** A single rise and fall, for an event that must be perceived and then stop existing. */
  swell: (p) => Math.sin(Math.PI * Math.max(0, Math.min(1, p))),
  /** Coming into existence, and ceasing to. Eased at BOTH ends. Peak slope 1.50. */
  emerge: (p) => { const q = Math.max(0, Math.min(1, p)); return q * q * (3 - 2 * q); },
};

/** Normalised progress through a phase, clamped. */
export const phase = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

/**
 * AN ASYMMETRIC ENVELOPE, composed from the vocabulary rather than added to it.
 *
 * Rises over [t0, t0+rise] with `emerge` and falls over [t0+rise, t0+rise+fall] with
 * `considered`. Two spans, two existing curves, no fourth bezier.
 *
 * The asymmetry is the point and it is a stated position, not a default. The craft guidance is
 * explicit that timing should be "slow where the user is deciding, fast where the system is
 * responding", and its review checklist adds "make exit faster than enter". THIS DIRECTION
 * INVERTS THE SECOND HALF OF THAT, DELIBERATELY: the rise here IS the system responding, so it
 * is the fast half; the fall is not a dismissal the user asked for, it is the world returning to
 * rest after an answer, and a snappy fall reads as the insight being retracted. Recorded in
 * D1_MOTION_SKILL_GATE.md rather than quietly broken.
 */
export const envelope = (t, t0, rise, fall) => (
  t <= t0 ? 0
    : t <= t0 + rise ? EASE.emerge((t - t0) / rise)
      : 1 - EASE.considered(Math.min(1, (t - t0 - rise) / fall))
);

/* ================================================================== the curve ========= */
/**
 * THE SINGLE GEOMETRY OF THE RELATION. Inherited from D0R unchanged.
 *
 * Everything that ever happens between the two objects happens ON IT: the travelling trace, the
 * wash it carries, and the hairline that remains. Its far end is a FUNCTION OF WHERE THE
 * DESTINATION CURRENTLY IS — light travels to where the object actually is, not to where it is
 * about to go.
 */
export function curve(travel) {
  const p = priorAt(travel);
  return {
    p0: [258, 148],
    p1: [356, 250],
    p2: [300, p.y - 20 - 48],
    p3: [p.x + 16, p.y - 20],
  };
}

/**
 * THE UNRESOLVED ROUTE, at a given convergence. `converge` 1 returns the canonical curve
 * EXACTLY — not approximately — so direction B's crystallisation lands on the same geometry
 * every other direction settles into, and the settled frames stay comparable byte for byte.
 *
 * p0 and p3 are never displaced. See GEO.provisional.
 */
export function curveProvisional(travel, converge) {
  const c = curve(travel);
  const k = 1 - Math.max(0, Math.min(1, converge));
  const off = (pt, d) => [pt[0] + d[0] * k, pt[1] + d[1] * k];
  return {
    p0: c.p0,
    p1: off(c.p1, GEO.provisional.c1),
    p2: off(c.p2, GEO.provisional.c2),
    p3: c.p3,
  };
}

const cubic = (c, s) => {
  const u = 1 - s;
  const b0 = u * u * u, b1 = 3 * u * u * s, b2 = 3 * u * s * s, b3 = s * s * s;
  return [
    b0 * c.p0[0] + b1 * c.p1[0] + b2 * c.p2[0] + b3 * c.p3[0],
    b0 * c.p0[1] + b1 * c.p1[1] + b2 * c.p2[1] + b3 * c.p3[1],
  ];
};

/** A point on the relation curve, for a given destination travel and 0..1 along it. */
export const curveAt = (travel, s) => cubic(curve(travel), Math.max(0, Math.min(1, s)));

/** The curve's tangent in degrees, for orienting anything stretched along the relation. */
export function curveAngle(travel, s) {
  const c = curve(travel);
  const a = cubic(c, Math.max(0, Math.min(1, s - 0.02)));
  const b = cubic(c, Math.max(0, Math.min(1, s + 0.02)));
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
}

const pathOf = (c) => {
  const f = (p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  return `M ${f(c.p0)} C ${f(c.p1)} ${f(c.p2)} ${f(c.p3)}`;
};

/** The SVG path data for the canonical relation at a given travel. One source of truth. */
export const curvePath = (travel) => pathOf(curve(travel));
/** The SVG path data for the unresolved relation. Same command count, by construction. */
export const curvePathProvisional = (travel, converge) => pathOf(curveProvisional(travel, converge));

/** The destination's position for a given travel — the ONLY way it can move. */
export function priorAt(travel) {
  const d = GEO.prior.depth, r = GEO.prior.relation;
  const k = Math.max(0, Math.min(1, travel));
  const mix = (a, b) => a + (b - a) * k;
  return {
    x: mix(d.x, r.x), y: mix(d.y, r.y),
    scale: mix(d.scale, r.scale),
    blur: mix(d.blur, r.blur),
    opacity: mix(d.opacity, r.opacity),
    weight: mix(d.weight, r.weight),
  };
}

/* ============================================================= THE GUIDED THREAD ====== */
/**
 * D0's `motionA`, CONNECT phase and all, transplanted with its channel writes intact.
 *
 * WHAT WAS REMOVED AND WHY, stated so the transplant can be checked rather than trusted:
 *
 *   `priorLight` and `relationLight` are gone — see the note on the state vector. Both were
 *   ARRIVAL-phase channels in D0 (they are 0 for every millisecond of REST and CONNECT), so
 *   removing them cannot change the shared phase, and d1-fairness.mjs proves that by replaying
 *   D0R's own captured CONNECT frames against D1's.
 *
 * Everything else is byte-for-byte the same arithmetic, including the travel span, the current
 * statement's gather-and-hand-off, the trace's emergence over ~250 ms, and the wash opening out
 * as the light travels.
 */
const lerp = (a, b, t) => a + (b - a) * t;

/** A's single continuous crossing, evaluated from one span of absolute time. */
const TRAVEL_SPAN = [T.CONNECT_END, T.CONNECT_END + 0.82 * (T.ARRIVE_END - T.CONNECT_END)];
const travel = (t) => EASE.considered(phase(t, TRAVEL_SPAN[0], TRAVEL_SPAN[1]));

/**
 * The thread's ARRIVE-phase arithmetic, factored out so SETTLE can sample it at exactly the
 * millisecond D0R sampled it at.
 *
 * D0R's SETTLE wrapper interpolated away from `motionA(ARRIVE_END - 0.0001)`, not from
 * `motionA(ARRIVE_END)`. The two differ only in the last few digits of a double, and nothing
 * visible depends on it — but "the Guided Thread is the same function D0R ran" is a claim this
 * package makes and then measures to fourteen decimal places in d1-fairness.mjs, and a claim
 * that has to be rounded before it is true is a weaker claim than the one being made.
 */
const ARRIVE_EPS = 0.0001;

function threadArrive(t) {
  const S = { ...ZERO_STATE };
  S.relationOrigin = 1;
  const a = phase(t, T.CONNECT_END, T.ARRIVE_END);
  S.threadPos = 1;
  S.threadLevel = 1 - EASE.emerge(Math.min(1, a / 0.34));
  S.priorTravel = travel(t);
  const pnow = priorAt(S.priorTravel);
  S.currentLight = lerp(0.16, 0.04, EASE.considered(a));
  S.washX = pnow.x; S.washY = pnow.y;
  S.washR = lerp(78, 112, EASE.swell(Math.min(1, a / 0.5)));
  S.washLevel = lerp(0.50, 0.14, EASE.considered(a));
  S.relationDraw = EASE.emerge(Math.max(0, (a - 0.25) / 0.75));
  return S;
}

export function guidedThread(t) {
  const S = { ...ZERO_STATE };
  S.relationOrigin = 1;

  if (t <= T.REST_END) return S;

  if (t < T.CONNECT_END) {
    const c = phase(t, T.REST_END, T.CONNECT_END);
    S.currentLight = c < 0.18
      ? EASE.considered(c / 0.18) * 0.62
      : lerp(0.62, 0.16, EASE.considered((c - 0.18) / 0.82));
    S.threadPos = EASE.considered(c);
    S.threadLevel = EASE.emerge(Math.min(1, c / 0.14));
    const open = EASE.considered(Math.max(0, (c - 0.14) / 0.19));
    const [wx, wy] = curveAt(S.priorTravel, S.threadPos);
    S.washX = wx; S.washY = wy;
    S.washR = lerp(62, 78, open);
    S.washLevel = lerp(0.86, 0.50, open) * S.threadLevel;
    return S;
  }

  if (t >= T.SETTLE_END) return { ...SETTLED_STATE, relationOrigin: 1 };

  if (t < T.ARRIVE_END) return threadArrive(t);

  /**
   * SETTLE, written once and shared. Every light channel reaches exactly zero, the destination
   * is on the relation plane, the relation is fully drawn. Identical in all three directions
   * because there is only one copy of it.
   */
  const at = threadArrive(T.ARRIVE_END - ARRIVE_EPS);
  const k = EASE.considered(phase(t, T.ARRIVE_END, T.SETTLE_END));
  return {
    ...at,
    threadLevel: lerp(at.threadLevel, 0, k),
    currentLight: lerp(at.currentLight, 0, k),
    washLevel: lerp(at.washLevel, 0, k),
    washR: lerp(at.washR, at.washR * 0.72, k),
    priorTravel: lerp(at.priorTravel, 1, k),
    relationDraw: lerp(at.relationDraw, 1, k),
  };
}
