/**
 * I-08B3.1-E1 — THE DERIVATION. Every number E1 authors is produced here and nowhere
 * else; the token files and the results document are generated from its output. Not one
 * figure in this package is typed twice, because a hand-entered number can disagree with
 * its own evidence and nobody re-runs a suite on a document that already says PASS.
 *
 * ONE declared Product decision: the error belongs to the RED FAMILY. That is FAMILIARITY,
 * named as a decision rather than disguised as a measurement — the single convention E1
 * keeps from ordinary UI. E1_REFERENCE_GATE.md carries the sources.
 *
 * Everything else below is derived from the frozen system, and each source is named so a
 * reviewer can attack it alone.
 */
import { srgbToOklch, hexToRgb8, relativeLuminance, oklchToSrgbRaw, to8bit, rgb8ToHex } from '../vendor/lib/color.mjs';
import { simulate8, selfCheck, KINDS } from './e1-cvd.mjs';

export const ok = (hex) => srgbToOklch(hexToRgb8(hex).map((c) => c / 255));
export const okL = (hex) => ok(hex)[0];
const ab = ([, C, H]) => { const h = Number.isNaN(H) ? 0 : H; return [C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180)]; };
export const dE = (p, q) => { const A = ab(p), B = ab(q); return Math.hypot(p[0] - q[0], A[0] - B[0], A[1] - B[1]); };
export const dEhex = (a, b) => dE(ok(a), ok(b));
export const crY = (y1, y2) => { const [a, b] = y1 >= y2 ? [y1, y2] : [y2, y1]; return (a + 0.05) / (b + 0.05); };
export const cr = (a, b) => crY(relativeLuminance(hexToRgb8(a)), relativeLuminance(hexToRgb8(b)));
export const Y = (hex) => relativeLuminance(hexToRgb8(hex));

/** Source-over compositing exactly as a browser and React Native perform it: a per-channel
 *  blend of 8-bit sRGB values, then a round. NOT a linear-light blend. */
export const over = (ink, ground, a) =>
  rgb8ToHex(hexToRgb8(ink).map((c, i) => Math.round(a * c + (1 - a) * hexToRgb8(ground)[i])));

/** The frozen values, restated here ONLY as the expected result of resolution. e1-resolve.mjs
 *  reads them out of the vendored token files and check R1 fails if the two ever disagree. */
export const FROZEN = {
  WORLD: '#101010', SURFACE: '#181818',
  PRIMARY: '#d8d5ca', SECONDARY: '#afaca3', TERTIARY: '#8b8982',
  BRASS: '#a58e6f',
  'LIGHT-low': '#d6caa9', 'LIGHT-mid': '#e8ddc2', 'LIGHT-core': '#fbf2db',
};
export const RAMP = { PRIMARY: FROZEN.PRIMARY, SECONDARY: FROZEN.SECONDARY, TERTIARY: FROZEN.TERTIARY };
export const INKS = { ...RAMP, BRASS: FROZEN.BRASS, 'LIGHT-low': FROZEN['LIGHT-low'], 'LIGHT-mid': FROZEN['LIGHT-mid'], 'LIGHT-core': FROZEN['LIGHT-core'] };

/** The retired I-08B3.1-C1/C2 diagnostic state carriers. Recorded so the correction in
 *  E1_DISABLED_COLLISION_RESOLUTION.md can be checked, and forbidden everywhere else. */
export const RETIRED = { disabledInk: '#5a5a58' };

export const FLOOR = Math.min(...Object.values(RAMP).map((h) => dEhex(FROZEN.BRASS, h)));
export const CHROMATIC = ok(FROZEN.BRASS)[1];

/**
 * EVERY FLOOR THE ERROR VALUE HAS TO KEEP, exported so the suite can apply the identical
 * test to a candidate E1 did NOT derive — which is how "these floors are specific to THIS
 * palette" stops being an assertion.
 */
export function errorFloors(hex) {
  const a = ok(hex), out = [];
  const add = (name, value, floor) => out.push({ name, value, floor, pass: value >= floor });
  add('chroma at least Living Brass’s', a[1], CHROMATIC);
  add('contrast on WORLD', cr(hex, FROZEN.WORLD), 4.5);
  add('contrast on SURFACE', cr(hex, FROZEN.SURFACE), 4.5);
  for (const [n, h] of Object.entries(INKS)) add('dEok from ' + n, dEhex(hex, h), FLOOR);
  for (const kind of KINDS) {
    const s = rgb8ToHex(simulate8(hexToRgb8(hex), kind));
    add(kind + ': contrast on WORLD', cr(s, rgb8ToHex(simulate8(hexToRgb8(FROZEN.WORLD), kind))), 4.5);
    add(kind + ': contrast on SURFACE', cr(s, rgb8ToHex(simulate8(hexToRgb8(FROZEN.SURFACE), kind))), 4.5);
    for (const [n, h] of Object.entries(INKS)) add(kind + ': dEok from ' + n, dEhex(s, rgb8ToHex(simulate8(hexToRgb8(h), kind))), FLOOR);
  }
  return out;
}

export function derive() {
  const self = selfCheck();
  if (self.some((r) => !r.pass)) throw new Error('e1-derive: dichromacy self-check failed — transcribed constants are suspect');

  const brassGaps = Object.fromEntries(Object.entries(RAMP).map(([n, h]) => [n, dEhex(FROZEN.BRASS, h)]));

  // --- THE ERROR INK -------------------------------------------------------------------
  const H_ANCHOR = ok('#ff0000')[2];
  const L_LO = 0.40, L_HI = 0.99, C_LO = 0.01, C_HI = 0.40;

  const floors = errorFloors;

  /** A quantised value is not its authoring value and a panel does not reproduce an 8-bit
   *  triple exactly, so the value must keep every floor for all 27 combinations of one
   *  least-significant bit per channel. A value that passes only at its exact triple
   *  passes only on paper. */
  const robust = (hex) => {
    const base = hexToRgb8(hex);
    for (const dr of [-1, 0, 1]) for (const dg of [-1, 0, 1]) for (const db of [-1, 0, 1]) {
      const p = rgb8ToHex([base[0] + dr, base[1] + dg, base[2] + db].map((c) => Math.min(255, Math.max(0, c))));
      if (floors(p).some((f) => !f.pass)) return false;
    }
    return true;
  };

  const sweepHue = (hue) => {
    const out = [];
    for (let L = L_LO; L <= L_HI + 1e-9; L += 0.0025) {
      for (let C = C_LO; C <= C_HI; C += 0.0005) {
        const raw = oklchToSrgbRaw([L, C, hue]);
        if (raw.some((c) => c < -1e-6 || c > 1 + 1e-6)) break;
        const hex = rgb8ToHex(to8bit(raw));
        if (floors(hex).every((f) => f.pass) && robust(hex)) {
          out.push({ hex, L: Number(L.toFixed(4)), C: Number(C.toFixed(4)), worst: Math.min(...floors(hex).filter((f) => f.name.includes('dEok')).map((f) => f.value)) });
        }
      }
    }
    return out;
  };

  let feasible = [], deviation = null, direction = 'none', H = H_ANCHOR;
  for (let d = 0; d <= 40 && !feasible.length; d += 0.25) {
    for (const sgn of d === 0 ? [0] : [-1, 1]) {
      const hue = (H_ANCHOR + sgn * d + 360) % 360;
      const got = sweepHue(hue);
      if (got.length) { feasible = got; deviation = d; direction = sgn < 0 ? 'toward magenta' : sgn > 0 ? 'toward orange' : 'none'; H = hue; break; }
    }
  }
  if (!feasible.length) throw new Error('e1-derive: no robust error value exists in the red family');
  feasible.sort((a, b) => a.C - b.C || b.worst - a.worst);
  const err = feasible[0];

  let gamutC = err.C;
  while (!oklchToSrgbRaw([err.L, gamutC + 0.0005, H]).some((c) => c < -1e-6 || c > 1 + 1e-6)) gamutC += 0.0005;

  const ERROR = {
    hex: err.hex,
    authored: { colorSpace: 'oklch', L: err.L, C: err.C, H: Number(H.toFixed(4)) },
    recovered: { L: ok(err.hex)[0], C: ok(err.hex)[1], H: ok(err.hex)[2] },
    luminance: Y(err.hex),
    hueAnchor: H_ANCHOR, hueDeviation: deviation, hueDirection: direction,
    feasibleSamples: feasible.length,
    feasibleL: [Math.min(...feasible.map((f) => f.L)), Math.max(...feasible.map((f) => f.L))],
    feasibleC: [Math.min(...feasible.map((f) => f.C)), Math.max(...feasible.map((f) => f.C))],
    sweepBounds: { L: [L_LO, L_HI], C: [C_LO, C_HI] },
    gamutHeadroom: Number((gamutC - err.C).toFixed(4)),
    floors: floors(err.hex),
  };

  // --- THE DISABLED INK: the reading ramp extended by its own rule ----------------------
  const rungs = [okL(RAMP.PRIMARY) - okL(RAMP.SECONDARY), okL(RAMP.SECONDARY) - okL(RAMP.TERTIARY)];
  const RUNG = Math.min(...rungs);
  const chromaStep = ok(RAMP.SECONDARY)[1] - ok(RAMP.TERTIARY)[1];
  const hueMean = (ok(RAMP.PRIMARY)[2] + ok(RAMP.SECONDARY)[2] + ok(RAMP.TERTIARY)[2]) / 3;
  const disAuthored = [okL(RAMP.TERTIARY) - RUNG, Math.max(0, ok(RAMP.TERTIARY)[1] - chromaStep), hueMean];
  const disHex = rgb8ToHex(to8bit(oklchToSrgbRaw(disAuthored)));
  const DISABLED = {
    hex: disHex,
    authored: { colorSpace: 'oklch', L: Number(disAuthored[0].toFixed(4)), C: Number(disAuthored[1].toFixed(4)), H: Number(disAuthored[2].toFixed(4)) },
    recovered: { L: ok(disHex)[0], C: ok(disHex)[1], H: ok(disHex)[2] },
    rung: RUNG, rungs, chromaStep, hueMean,
    belowTertiary: { dL: okL(RAMP.TERTIARY) - okL(disHex), dEok: dEhex(RAMP.TERTIARY, disHex) },
    contrast: { world: cr(disHex, FROZEN.WORLD), surface: cr(disHex, FROZEN.SURFACE) },
  };

  // --- THE PRESS PRESENCE --------------------------------------------------------------
  const STEP = okL(FROZEN.SURFACE) - okL(FROZEN.WORLD);
  const PRESS_ALPHA = 0.10;                      // Material 3 pressed state-layer opacity
  let floorAlpha = null;
  for (let a = 0.005; a <= 0.6; a += 0.005) { if (okL(over(RAMP.PRIMARY, FROZEN.SURFACE, a)) - okL(FROZEN.SURFACE) >= STEP) { floorAlpha = Number(a.toFixed(3)); break; } }
  const PRESS = {
    alpha: PRESS_ALPHA, derivedFloorStep: STEP, alphaThatWouldMeetTheFloor: floorAlpha,
    onSurface: over(RAMP.PRIMARY, FROZEN.SURFACE, PRESS_ALPHA),
    onWorld: over(RAMP.PRIMARY, FROZEN.WORLD, PRESS_ALPHA),
  };
  PRESS.dLSurface = okL(PRESS.onSurface) - okL(FROZEN.SURFACE);
  PRESS.dLWorld = okL(PRESS.onWorld) - okL(FROZEN.WORLD);
  PRESS.chromaSurface = ok(PRESS.onSurface)[1];
  PRESS.chromaWorld = ok(PRESS.onWorld)[1];
  PRESS.collidesWithSurface = PRESS.onWorld === FROZEN.SURFACE;

  // --- THE FOCUS INDICATOR PAIR --------------------------------------------------------
  const PALETTE = { ...FROZEN, ERROR: ERROR.hex, DISABLED: DISABLED.hex,
    'pressed SURFACE': PRESS.onSurface, 'pressed WORLD': PRESS.onWorld };
  const coverage = Object.entries(PALETTE).map(([n, h]) => ({
    against: n, hex: h, ring: cr(RAMP.PRIMARY, h), companion: cr(FROZEN.WORLD, h),
    ringAlone: cr(RAMP.PRIMARY, h) >= 3, covered: cr(RAMP.PRIMARY, h) >= 3 || cr(FROZEN.WORLD, h) >= 3,
  }));
  const FOCUS = {
    indicator: RAMP.PRIMARY, companion: FROZEN.WORLD,
    thickness: 2, companionThickness: 1, offset: 2,
    changeOfContrast: { onWorld: cr(RAMP.PRIMARY, FROZEN.WORLD), onSurface: cr(RAMP.PRIMARY, FROZEN.SURFACE) },
    coverage,
    ringAloneCovers: coverage.filter((c) => c.ringAlone).length,
    pairCovers: coverage.filter((c) => c.covered).length,
    total: coverage.length,
  };

  // --- THE INHERITED COLLISION, MEASURED -----------------------------------------------
  const COLLISION = {
    claim: 'the disabled ink #5a5a58 sits close enough to the rest-state ink #8b8982 to be argued with',
    source: 'I-08B3.1-C2 C2_FINDINGS.md, restated in I-08B3.1-C3 C3_FREEZE_RECORD.md 4.2 and C3_ICONOGRAPHY_MATERIAL_CONTRACT.md 6.4',
    dL: okL(RAMP.TERTIARY) - okL(RETIRED.disabledInk),
    dEok: dEhex(RAMP.TERTIARY, RETIRED.disabledInk),
    contrastRest: cr(RAMP.TERTIARY, FROZEN.SURFACE),
    contrastDisabled: cr(RETIRED.disabledInk, FROZEN.SURFACE),
    rampRungs: rungs, floor: FLOOR,
  };
  COLLISION.survivesMeasurement = COLLISION.dL < Math.min(...rungs) || COLLISION.dEok < FLOOR;

  return {
    generatedBy: 'tools/e1-derive.mjs',
    selfCheck: self,
    FLOOR, CHROMATIC, brassGaps,
    ERROR, DISABLED, PRESS, FOCUS, COLLISION,
    WEIGHT: { rest: 500, selected: 600, arabicBand: [400, 700] },
    SELECTED: { ink: RAMP.PRIMARY, marker: RAMP.PRIMARY, markerThickness: 2 },
    REST: { ink: RAMP.TERTIARY },
    FROZEN, RETIRED,
  };
}
