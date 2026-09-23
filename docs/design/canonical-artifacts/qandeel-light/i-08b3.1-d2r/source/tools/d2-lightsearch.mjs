/**
 * I-08B3.1-D2R — DERIVING THE PRODUCTION LIGHT.
 *
 * I-08B3.1-D1 closed with one finding handed forward:
 *
 *   > The diagnostic Light's dim tail passes within ΔEok 0.0163 of Living Brass. Whoever closes
 *   > `qandeel.illumination` should carry a minimum separation from `qandeel.identity.material`
 *   > as an explicit requirement, measured ALONG THE LIGHT'S WHOLE COMPOSITING PATH OVER THE
 *   > WORLD, not at full strength.
 *
 * This tool is that requirement turned into an instrument. It does not propose a colour by
 * taste and then measure it; it SEARCHES for the colour the requirement implies, reports the
 * whole front rather than one winner, and writes every number it used.
 *
 * WHY THE MEASUREMENT IS A PATH AND NOT A VALUE. A Light is never seen at full strength alone.
 * It is composited over the World at every alpha from 0 to 1 as it rises and as it decays, and
 * a decay passes through every intermediate colour on the way to nothing. "BRASS IS MATTER,
 * LIGHT IS MEANING" is only checkable if it holds at every one of those intermediate colours —
 * and D1 measured that it does NOT hold for the diagnostic family at around two thirds alpha.
 *
 * SCOPE, STATED. The path evaluated here is Light composited over the WORLD and over the
 * FUNCTIONAL SURFACE — the grounds an analytical field pixel can have. It deliberately does NOT
 * include the `screen` blend of Light onto the Living Brass mark: that path BEGINS at the
 * material by construction, because it is the material receiving light, and requiring it to be
 * far from the material would be requiring the mark not to be itself.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './d2-main.mjs';
import {
  srgbToOklch, oklchToSrgbRaw, oklabToOklch, oklchToOklab,
  hexToRgb8, rgb8ToHex, to8bit, inSrgbGamut, contrastHex,
} from '../vendor/color.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolvePath(HERE, '..', '..');

/* ------------------------------------------------------------------ the fixed points ---- */

export const WORLD = '#101010';
export const SURFACE = '#181818';
export const BRASS = '#a58e6f';

/** The reading ramp. A Light must also be unmistakable against INK, not only against MATTER. */
export const RAMP = ['#d8d5ca', '#afaca3', '#8b8982'];

/** I-08B3.1-D0's family, carried through D0R and D1. DIAGNOSTIC, never frozen. */
export const DIAGNOSTIC = { CORE: '#fef1d6', MID: '#ecdcbc', LOW: '#dcc8a1' };

const oklchOf = (hex) => {
  const [L, C, H] = srgbToOklch(hexToRgb8(hex).map((c) => c / 255));
  return { L, C, H };
};

/**
 * ΔE in Oklab, NaN-safe.
 *
 * D1 lost two guard runs to this: `srgbToOklch` returns a NaN hue for an achromatic colour, so
 * a distance computed through hue silently poisons every comparison that touches it and the
 * branch taken depends on the caller's polarity. The distance here is computed in Oklab's
 * CARTESIAN coordinates, where achromatic is simply a = b = 0 and there is no hue to be NaN.
 */
export function deltaEok(hexA, hexB) {
  const la = oklchToOklab(srgbToOklch(hexToRgb8(hexA).map((c) => c / 255)));
  const lb = oklchToOklab(srgbToOklch(hexToRgb8(hexB).map((c) => c / 255)));
  const d = Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
  if (!Number.isFinite(d)) throw new Error(`d2-lightsearch: deltaEok(${hexA}, ${hexB}) is not finite`);
  return d;
}

/**
 * Source-over compositing of an opaque colour at `alpha` onto an opaque ground, IN THE DEVICE
 * SPACE and then QUANTISED.
 *
 * Both halves of that sentence are load-bearing. Browsers and Skia composite ordinary alpha in
 * the gamma-encoded space, not in linear light, so a "more correct" linear blend here would
 * measure a colour the product never paints. And only an 8-bit colour is ever displayed, so the
 * path is walked through the values that actually appear on a screen.
 */
export function compositeHex(groundHex, overHex, alpha) {
  const g = hexToRgb8(groundHex);
  const o = hexToRgb8(overHex);
  return rgb8ToHex(g.map((c, i) => Math.round(c + (o[i] - c) * alpha)));
}

/* ------------------------------------------------------- the shape of the family -------- */

/**
 * The candidate family keeps the DIAGNOSTIC family's RAMP SHAPE and changes only two things:
 * its hue and its chroma scale.
 *
 * That is a deliberate control rather than a convenience. The three stops of a warm light are
 * not free of each other — a light gets more chromatic as it gets deeper, because the deep end
 * is where the tint survives. Re-authoring all six degrees of freedom would have produced a
 * colour whose separation could not be attributed to anything. Here exactly two numbers move,
 * so the result can be read as "this hue, this much chroma", and the lightness ladder the
 * Product Owner has already seen three times is unchanged.
 */
export const RAMP_SHAPE = (() => {
  const d = Object.fromEntries(Object.entries(DIAGNOSTIC).map(([k, v]) => [k, oklchOf(v)]));
  const cmax = Math.max(d.CORE.C, d.MID.C, d.LOW.C);
  return {
    CORE: { L: d.CORE.L, k: d.CORE.C / cmax },
    MID: { L: d.MID.L, k: d.MID.C / cmax },
    LOW: { L: d.LOW.L, k: d.LOW.C / cmax },
    diagnosticCmax: cmax,
    diagnosticHue: d.LOW.H,
  };
})();

export function familyAt(hue, cmax) {
  const out = {};
  for (const stop of ['CORE', 'MID', 'LOW']) {
    const { L, k } = RAMP_SHAPE[stop];
    const triple = [L, k * cmax, hue];
    if (!inSrgbGamut(triple)) return null;
    out[stop] = rgb8ToHex(to8bit(oklchToSrgbRaw(triple)));
  }
  return out;
}

/* ------------------------------------------------------------------ the measurement ----- */

const GROUNDS = [WORLD, SURFACE];
const STEPS = 512;

/**
 * The minimum ΔEok between ANY colour this family can put on the analytical ground and the
 * identity material — over both grounds, all three stops, and 513 alphas each.
 *
 * Returns the minimum and the exact place it happens, because a separation figure with no
 * location is not a finding anyone can act on.
 */
export function separationFromBrass(family) {
  let best = { dE: Infinity, stop: null, ground: null, alpha: null, hex: null };
  for (const ground of GROUNDS) {
    for (const [stop, hex] of Object.entries(family)) {
      for (let i = 0; i <= STEPS; i++) {
        const alpha = i / STEPS;
        const c = compositeHex(ground, hex, alpha);
        const dE = deltaEok(c, BRASS);
        if (dE < best.dE) best = { dE, stop, ground, alpha, hex: c };
      }
    }
  }
  return best;
}

/** The same walk, against the reading ramp: a Light must not be confusable with INK either. */
export function separationFromInk(family) {
  let best = { dE: Infinity, stop: null, ground: null, alpha: null, ink: null, hex: null };
  for (const ground of GROUNDS) {
    for (const [stop, hex] of Object.entries(family)) {
      for (let i = 0; i <= STEPS; i++) {
        const alpha = i / STEPS;
        const c = compositeHex(ground, hex, alpha);
        for (const ink of RAMP) {
          const dE = deltaEok(c, ink);
          if (dE < best.dE) best = { dE, stop, ground, alpha, ink, hex: c };
        }
      }
    }
  }
  return best;
}

/* -------------------------------------------------------------------- constraints ------- */

/**
 * Every constraint below is a REFUSAL, not a preference, and each one names the thing it is
 * protecting. A search that optimises an objective with no constraints finds the colour that
 * games the objective: here, that is a light so chromatic it is a neon, or one so pale it is
 * white, or one so far around the wheel it is green. Each of those maximises distance from
 * Living Brass and destroys something else.
 */
export const CONSTRAINTS = {
  hueMin: 55, hueMax: 125,
  cmaxMin: 0.024, cmaxMax: 0.085,
  lowContrastMin: 3.0,
  chromaAboveInkFactor: 2.0,
  warmChannelMargin: 2,
  separationRequired: 0.020,
};

/**
 * WHAT "WARM" IS, MECHANICALLY, SO THAT TASTE IS NOT DOING THE FILTERING.
 *
 * The first run of this search pinned its optimum to the hue cap — 108°, the highest hue the
 * constraint allowed — which means the cap was choosing the colour and the measurement was only
 * ratifying it. Separation from Living Brass rises monotonically as hue leaves the material's
 * 75°, so ANY hue ceiling produces a "winner" sitting against it, and the number attached to
 * that winner says nothing.
 *
 * At 108° the stops come out `#f4f4dc` and `#cdcdaa` — R and G EQUAL. That is the moment a warm
 * light stops being warm: with no red lead left, the next step is an acid yellow-green, which is
 * also, precisely, one of the three looks that read as machine-generated design on a near-black
 * ground. The house design guidance names it.
 *
 * So the warm band is not a hue range chosen by eye. It is the device-space ordering that makes
 * a colour warm at all: R leads G leads B, at every stop, by more than a rounding step. A colour
 * that fails it is not a warm light with an unusual hue — it is a different kind of colour.
 */
function warmOrdering(family) {
  const m = CONSTRAINTS.warmChannelMargin;
  return Object.values(family).every((hex) => {
    const [r, g, b] = hexToRgb8(hex);
    return r - g >= m && g - b >= m;
  });
}

/**
 * THE INK CONSTRAINT WAS WRONG IN ITS FIRST FORM, AND THE FIRST RUN IS WHAT SAID SO.
 *
 * It asked for a minimum ΔEok between the Light's compositing path and the reading ramp, by
 * analogy with the Brass constraint. No family in the entire search space satisfied it — and
 * neither does the diagnostic family, which measures 0.0113 from TERTIARY.
 *
 * The constraint was impossible rather than demanding, and impossible for a reason that should
 * have been obvious before it was coded. A light rising over a near-black World passes through
 * EVERY lightness on its way up. Somewhere on that climb its lightness equals the ink's, and at
 * low alpha its chroma is near zero, so at that one alpha it is close to a low-chroma grey by
 * arithmetic. No colour avoids this. Requiring it to is requiring a light not to fade in.
 *
 * What is actually true — and what the brief's separation is really about — is that INK AND
 * LIGHT ARE NEVER TOLD APART BY COLOUR IN THE FIRST PLACE. Ink is type: it has glyph shape,
 * hard edges and a stroke. Light is field: it is a soft gradient with no edge. D1 already
 * proves the pair cannot be confused where it matters, by construction and then by measurement
 * — the destination's ink is mixed between two ramp values and has no code path to warmth, and
 * the raster half of that check counts glyph CORES rather than colours.
 *
 * So the ink requirement here is the one that is both true and checkable: AT FULL STRENGTH, the
 * least chromatic stop of the Light is at least twice as chromatic as the most chromatic ink.
 * The Light is unmistakably a chromatic thing; the ramp is unmistakably a neutral one.
 */
const RAMP_CMAX = Math.max(...RAMP.map((h) => oklchOf(h).C));

/**
 * NOT A SEARCH CONSTRAINT, AND SAYING SO RATHER THAN LEAVING IT IN THE LOOP.
 *
 * The ramp SHAPE is inherited from the diagnostic family and does not vary with hue or chroma,
 * so "does CORE read as a light" has the same answer for every candidate. Left inside the
 * filter it would have been a condition that cannot fail — a sentence wearing a check's
 * clothes. It is asserted once, here, where it is actually a claim about the inheritance.
 */
if (RAMP_SHAPE.CORE.L < 0.94) {
  throw new Error(`d2-lightsearch: the inherited ramp's CORE lightness is ${RAMP_SHAPE.CORE.L}, which does not read as a light`);
}

export function constraintReport(hue, cmax, family) {
  const lowC = contrastHex(family.LOW, WORLD);
  const coreChroma = oklchOf(family.CORE).C;
  return {
    hueInWarmBand: hue >= CONSTRAINTS.hueMin && hue <= CONSTRAINTS.hueMax,
    chromaRestrained: cmax >= CONSTRAINTS.cmaxMin && cmax <= CONSTRAINTS.cmaxMax,
    lowVisibleOnWorld: lowC >= CONSTRAINTS.lowContrastMin,
    chromaticallyNotInk: coreChroma >= CONSTRAINTS.chromaAboveInkFactor * RAMP_CMAX,
    readsAsWarm: warmOrdering(family),
    lowContrastOnWorld: lowC,
    coreChroma,
    rampChromaMax: RAMP_CMAX,
  };
}

const passes = (r) => r.hueInWarmBand && r.chromaRestrained
  && r.lowVisibleOnWorld && r.chromaticallyNotInk && r.readsAsWarm;

/**
 * THE SELECTION RULE, STATED BEFORE THE NUMBERS WERE LOOKED AT.
 *
 * Maximising separation is the wrong objective: it would walk the colour as far from the
 * material as the constraints permit, for no gain past the point where the two are already
 * distinguishable, and every step it takes is a step away from the family the Product Owner has
 * now seen in D0, D0R and D1.
 *
 *   1. REQUIRED — separation at least 0.020 ΔEok along the whole path.
 *
 *      **0.020 IS AN ENGINEERING HEURISTIC THIS PACKAGE ADOPTED. IT IS NOT A PERCEPTUAL LAW AND
 *      IT DID NOT FREEZE A COLOUR.** Oklab is built so that a unit of ΔE is roughly a unit of
 *      perceived difference, so a figure of this order is a reasonable place to look for
 *      "reliably distinguishable" — but the threshold at which two colours become tellable
 *      apart depends on their size, their surround, the display, the ambient light and the
 *      viewer, and none of those is in this arithmetic. What the number does is give the search
 *      a floor that is not taste, and give a reviewer something to disagree with in a unit.
 *
 *      Its practical justification is comparative rather than absolute: the family it replaces
 *      measures 0.0118 and I-08B3.1-D1 could not tell that family's dim tail from the identity
 *      material. A requirement a little under twice that is a stated bet that the difference
 *      matters, not a proof that it does.
 *
 *      ACCEPTANCE OF THE RESULTING COLOUR REMAINS: this measurement, PLUS visual Product review,
 *      PLUS device validation. The search narrows the field; it does not close it.
 *   2. PREFERRED — of the families that satisfy it, the one with the LOWEST HUE: the smallest
 *      departure from the inherited diagnostic family that the requirement actually forces.
 *   3. TIE-BREAK — at that hue, the chroma with the largest separation.
 *
 * Rule 2 is the important one and it is deliberately conservative. This is a freeze CANDIDATE,
 * and a candidate that moved further than its own requirement demanded would be a taste
 * decision wearing a measurement's clothes.
 */
export function select(rows) {
  const eligible = rows.filter((r) => r.separation >= CONSTRAINTS.separationRequired);
  if (!eligible.length) return null;
  const minHue = Math.min(...eligible.map((r) => r.hue));
  const atHue = eligible.filter((r) => r.hue === minHue);
  atHue.sort((a, b) => b.separation - a.separation);
  return atHue[0];
}

/* ------------------------------------------------------------------------ the search ---- */

export function search() {
  const rows = [];
  for (let hue = CONSTRAINTS.hueMin; hue <= CONSTRAINTS.hueMax; hue += 1) {
    for (let ci = 0; ci <= 61; ci++) {
      const cmax = CONSTRAINTS.cmaxMin + ci * 0.001;
      const family = familyAt(hue, cmax);
      if (!family) continue;
      const r = constraintReport(hue, cmax, family);
      if (!passes(r)) continue;
      const sep = separationFromBrass(family);
      rows.push({ hue, cmax: +cmax.toFixed(3), family, separation: sep.dE, at: sep });
    }
  }
  rows.sort((a, b) => b.separation - a.separation);
  return rows;
}

/* ------------------------------------------------------------------------- reporting ---- */

if (isMain(import.meta.url)) {
  const diagSep = separationFromBrass(DIAGNOSTIC);
  const diagInk = separationFromInk(DIAGNOSTIC);

  console.log('D2 LIGHT DERIVATION');
  console.log('  ramp shape inherited from the diagnostic family:');
  for (const s of ['CORE', 'MID', 'LOW']) {
    console.log(`    ${s.padEnd(4)} L ${RAMP_SHAPE[s].L.toFixed(4)}  chroma x${RAMP_SHAPE[s].k.toFixed(3)}`);
  }
  console.log(`    diagnostic hue ${RAMP_SHAPE.diagnosticHue.toFixed(2)}deg  cmax ${RAMP_SHAPE.diagnosticCmax.toFixed(4)}`);
  console.log('');
  console.log(`  DIAGNOSTIC family separation from Living Brass: dEok ${diagSep.dE.toFixed(4)}`);
  console.log(`    worst at ${diagSep.stop} over ${diagSep.ground} at alpha ${diagSep.alpha.toFixed(3)} -> ${diagSep.hex}`);
  console.log(`  DIAGNOSTIC family separation from the reading ramp: dEok ${diagInk.dE.toFixed(4)} (${diagInk.ink})`);
  console.log('');

  const rows = search();
  if (!rows.length) throw new Error('d2-lightsearch: no candidate satisfied every constraint');

  console.log(`  ${rows.length} families satisfy every constraint. Top 14 by separation:`);
  console.log('    hue  cmax   sepBrass  worst-at            CORE     MID      LOW');
  for (const r of rows.slice(0, 14)) {
    console.log(
      `    ${String(r.hue).padStart(3)}  ${r.cmax.toFixed(3)}  ${r.separation.toFixed(4)}    `
      + `${r.at.stop.padEnd(4)} a=${r.at.alpha.toFixed(2)} ${r.at.hex}  `
      + `${r.family.CORE} ${r.family.MID} ${r.family.LOW}`,
    );
  }

  console.log('');
  console.log('  Best family at each hue (chroma free) — the front the selection rule reads:');
  const byHue = new Map();
  for (const r of rows) if (!byHue.has(r.hue) || byHue.get(r.hue).separation < r.separation) byHue.set(r.hue, r);
  for (const hue of [...byHue.keys()].sort((a, b) => a - b)) {
    const r = byHue.get(hue);
    const mark = r.separation >= CONSTRAINTS.separationRequired ? ' <- meets 0.020' : '';
    console.log(`    hue ${String(hue).padStart(3)}  best cmax ${r.cmax.toFixed(3)}  sep ${r.separation.toFixed(4)}  ${r.family.LOW}${mark}`);
  }

  const chosen = select(rows);
  if (!chosen) throw new Error('d2-lightsearch: no family reaches the required separation');
  console.log('');
  console.log('  SELECTED (lowest hue meeting the requirement):');
  console.log(`    hue ${chosen.hue}deg  cmax ${chosen.cmax.toFixed(3)}`);
  console.log(`    CORE ${chosen.family.CORE}   MID ${chosen.family.MID}   LOW ${chosen.family.LOW}`);
  console.log(`    separation from Living Brass: dEok ${chosen.separation.toFixed(4)}`);
  console.log(`      worst at ${chosen.at.stop} over ${chosen.at.ground} at alpha ${chosen.at.alpha.toFixed(3)} -> ${chosen.at.hex}`);
  console.log(`    that is ${(chosen.separation / diagSep.dE).toFixed(2)}x the diagnostic family's separation`);
  const cr = constraintReport(chosen.hue, chosen.cmax, chosen.family);
  console.log(`    LOW on the World: ${cr.lowContrastOnWorld.toFixed(2)}:1`);
  console.log(`    CORE chroma ${cr.coreChroma.toFixed(4)} vs ramp max ${cr.rampChromaMax.toFixed(4)} (${(cr.coreChroma / cr.rampChromaMax).toFixed(2)}x)`);
  for (const [k, hex] of Object.entries(chosen.family)) {
    const [r, g, b] = hexToRgb8(hex);
    console.log(`    ${k.padEnd(4)} ${hex}  R${r} G${g} B${b}  R-G ${r - g}  G-B ${g - b}`);
  }

  mkdirSync(resolvePath(PKG, 'data'), { recursive: true });
  writeFileSync(
    resolvePath(PKG, 'data', 'D2_LIGHT_DERIVATION.json'),
    JSON.stringify({
      generated: 'source/tools/d2-lightsearch.mjs',
      fixedPoints: { WORLD, SURFACE, BRASS, RAMP },
      rampShape: RAMP_SHAPE,
      constraints: CONSTRAINTS,
      steps: STEPS,
      grounds: GROUNDS,
      diagnostic: { family: DIAGNOSTIC, separationFromBrass: diagSep, separationFromInk: diagInk },
      selected: chosen,
      selectedConstraintReport: cr,
      frontByHue: [...byHue.entries()].sort((a, b) => a[0] - b[0]).map(([h, r]) => ({
        hue: h, cmax: r.cmax, separation: r.separation, family: r.family,
      })),
      candidates: rows.slice(0, 40),
      candidateCount: rows.length,
    }, null, 2) + '\n',
  );
  console.log('\n  wrote data/D2_LIGHT_DERIVATION.json');
}
