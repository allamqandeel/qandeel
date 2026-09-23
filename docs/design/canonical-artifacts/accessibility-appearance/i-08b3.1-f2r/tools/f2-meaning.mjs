/**
 * I-08B3.1-F2 — QANDEEL LIGHT, IN BOTH APPEARANCES, FROM ONE FUNCTION.
 *
 * ================================================================================================
 * WHY THIS FILE EXISTS AT ALL, RATHER THAN THE PROFILE LIVING IN THE RENDERER
 *
 * The derivation measured four expression families and chose one. If the renderer then painted its
 * own version of the winner, the package would contain a measurement of one thing and a picture of
 * another, and nothing would notice: the numbers would be right, the raster would be plausible,
 * and the two would be about different objects. So there is ONE profile function. tools/f2-derive
 * measures it, tools/f2-scene paints it, and tools/f2-verify re-measures the SHIPPED one and
 * requires it to reproduce the derivation's recorded figures. Check C-04 is exactly that loop.
 *
 * ================================================================================================
 * WHAT A MEANING EVENT IS, AND WHAT F2 IS AND IS NOT ALLOWED TO TOUCH
 *
 * I-08B3.1-D0R derived the easing vocabulary, D1 derived the arrival, D2R froze the lifecycle —
 * 260 ms of rise, 1150 ms of fall, asymmetric, reaching exactly zero — and the ONE falloff law all
 * four categories share. Every one of those is imported here and called. F2 changes WHAT the
 * intensity paints. It does not change WHEN, how fast, how long, or where the sources are: the
 * source lists below come out of D2R's own patternEvent() and insightEvent() at a time in ms.
 *
 * A package that re-derived the geometry "in the spirit of" D2R would be comparing its own drawing
 * to its own other drawing, which is the failure I-08B3.1-F1R was written to correct.
 *
 * ================================================================================================
 * THE TWO TECHNIQUES, AND WHY NEITHER IS SELECTED BY THE APPEARANCE'S NAME
 *
 * `technique` is a token. The dark appearance resolves it to `additive-over-ground` and the light
 * appearance to `signed-bloom`, and this file dispatches on the resolved value. §28 of the brief
 * forbids `if dark -> X else -> Y` scattered through Product logic, and the reason is not tidiness:
 * a system with that shape has as many appearance decisions as it has call sites, and a third
 * appearance — or an increased-contrast variant that needed a different technique — would have to
 * find all of them. Here there is one dispatch and it is driven by the tree.
 */
import {
  lch, dEok, over, hex, Y, grayOf, inSrgbGamut, srgbToOklch, hexToRgb8,
} from './f2-color.mjs';
import { falloff, FALLOFF, meaningEnvelope, LIFECYCLE } from '../vendor/f1/vendor/d2r/scene/d2-foundation.mjs';
import { patternEvent, insightEvent, PATTERN_LOCUS, INSIGHT_SITE, PATTERN_MEMBERS, LIFECYCLE_SCALE } from '../vendor/f1/vendor/d2r/scene/d2-events.mjs';
import { connectionEvent } from '../vendor/f1/vendor/d2r/scene/d2-connection.mjs';
import { topicById } from '../vendor/f1/vendor/d2r/scene/d2-world.mjs';

export { falloff, meaningEnvelope, LIFECYCLE };

/**
 * THE INTENSITY AXIS IS NORMALISED, AND THE FIRST VERSION OF THIS FILE WAS NOT — WHICH PAINTED
 * A PICTURE OF SOMETHING THE DERIVATION HAD NOT MEASURED.
 *
 * The derivation sampled an abstract falloff output while the renderer sampled its own; the two
 * agreed by accident at one end and not at the other. So the profile now takes n in [0, 1] — a
 * normalised intensity — and every caller converts into it. The derivation sweeps n; the renderer
 * computes n from D2R's geometry; there is one axis and one function on it.
 *
 * WASH_OPACITY is I-08B3.1-D2R's own magnitude for a light source, and D2R's comment on it is
 * worth keeping in view: 0.62 was the first value, and the first rendered frame said it was wrong,
 * because "a meaning event that does not read as an event has failed before anyone judges its
 * taste". F2 does not retune it.
 */
export const WASH_OPACITY = 0.86;
export const FALLOFF_EXPONENT = FALLOFF.EXPONENT;

/** Normalised intensity at radius fraction f inside a source of this level — D2R's own falloff
 *  exponent, over D2R's own source geometry. */
export const intensityAt = (level, f) => level * Math.pow(Math.max(0, 1 - f), FALLOFF_EXPONENT);

/**
 * THE AREA MEAN — THE MEASUREMENT I-08B3.1-F2R EXISTS BECAUSE F2 DID NOT HAVE.
 *
 * F2 required the meaning event's PEAK to exceed the appearance's own smallest reading step, and
 * the shipped light expression cleared it: 0.1046 against a floor of 0.1017. Independent review
 * then looked at the rendered CONNECTION and called it near-static, and both statements were true,
 * because a peak is a property of ONE POINT ON THE FALLOFF and an event is a REGION. The shipped
 * glaze was a rim 0.14 wide in normalised intensity; it reached the floor on a thin annulus and was
 * essentially the bare ground everywhere else. Integrated over the disc a reader actually looks at,
 * it came to 0.0255 — a QUARTER of the floor its peak had cleared, and one twelfth of the dark
 * appearance's 0.3257.
 *
 * So the quantity is the difference from the ground AVERAGED OVER THE SOURCE'S AREA: weighted by
 * the disc's own area element 2f df, sampled along I-08B3.1-D2R's falloff, at full level. It is
 * what the eye integrates on a soft low-frequency blob, it is what a reviewer judges at board
 * scale, and unlike a peak it cannot be satisfied by a line.
 */
export const AREA_SAMPLES = 400;
export function areaMean(at, ground, { level = 1, gray = false } = {}) {
  let acc = 0, wsum = 0;
  for (let i = 0; i <= AREA_SAMPLES; i++) {
    const f = i / AREA_SAMPLES;
    const w = 2 * f / AREA_SAMPLES;
    const c = at(intensityAt(level, f));
    acc += (gray ? dEok(grayOf(c), grayOf(ground)) : dEok(c, ground)) * w;
    wsum += w;
  }
  return acc / wsum;
}

/** The smallest adjacent step of an appearance's own reading ramp — the least difference QANDEEL
 *  asks anyone to read AS MEANING SOMETHING, and therefore the floor the event's area mean must
 *  clear. Computed from the resolved tree so it moves if the ramp ever does. */
export const readingStepOf = (r) => Math.min(
  dEok(r.colour.PRIMARY.value, r.colour.SECONDARY.value),
  dEok(r.colour.SECONDARY.value, r.colour.TERTIARY.value),
);

/**
 * THE PROFILE. Given a resolved tree, return the function that turns an intensity into a painted
 * colour, plus the parameters it used, so a caller can print what it painted with.
 *
 * ADDITIVE-OVER-GROUND (dark). The Light's core composited over whatever is beneath it. The World
 * occupies almost none of the luminance range, so a meaning event can borrow all of it.
 *
 * SIGNED BLOOM (light). Two poles along one falloff. Above `split` the region floods toward the
 * core — the place the light IS, and the reason the event is a light rather than a stain. Below
 * it, the glaze: the warm deepening a bright source lays around itself on a light material, and
 * the contrast boundary that makes the core read as a source rather than as bare ground.
 *
 * BOTH RETURN THE GROUND EXACTLY AT INTENSITY ZERO. Asserted on the quantised hex rather than on
 * the float, because a residue of one 8-bit step is a permanent Meaning glow that no float
 * comparison would ever report.
 */
export function profile(r, groundHex) {
  const technique = r.scalar?.ILLUM_TECHNIQUE?.value ?? resolveTechnique(r);
  const core = r.colour.LIGHT_CORE.value;
  const mid = r.colour.LIGHT_MID.value;
  const low = r.colour.LIGHT_LOW.value;
  const ground = groundHex ?? r.colour.WORLD.value;

  if (technique === 'additive-over-ground') {
    return {
      technique, core, mid, low, ground, params: { washOpacity: WASH_OPACITY },
      at: (n) => over(core, Math.max(0, Math.min(1, n)) * WASH_OPACITY, ground),
    };
  }
  if (technique === 'signed-bloom') {
    const split = num(r, 'qandeel.expression.illumination.bloom.split');
    const width = num(r, 'qandeel.expression.illumination.bloom.glaze-width');
    /**
     * THE GLAZE WEIGHT, AND I-08B3.1-F2R CHANGED IT IN TWO WAYS THAT ARE WORTH SEPARATING.
     *
     * IT VANISHES AT ZERO INTENSITY BY SHAPE, NOT BY A SPECIAL CASE. A bare Gaussian centred on
     * `split` is non-zero at n = 0 — for a narrow width the residue is too small to survive the
     * 8-bit grid, which is why F2 never noticed, but the correction wants a WIDE glaze and there a
     * bare Gaussian leaves a visible tint at the exact intensity where the event is supposed to be
     * over. The `at(0) === ground` guard would still have reported a clean settle, because a guard
     * on one point cannot see the shape approaching it. Subtracting the zero-intensity value and
     * renormalising makes the settle a property of the function.
     *
     * THERE IS NO GLAZE GAIN ANY MORE. The dark ramp is one material at three intensities under
     * ONE gain — I-08B3.1-D2R's WASH_OPACITY — and the light ramp now is too. A separate gain made
     * the glaze's depth and its strength two names for one thing, so the search could reach the
     * same composite from a shallow stop at high gain or a deep stop at low gain, and picked
     * between them on nothing. The deep-stop answers put the LOW stop's authored value inside the
     * reading ramp's own lightness range while the composite looked identical.
     */
    const g0 = Math.exp(-((split / width) ** 2));
    const glazeAt = (n) => Math.max(0, (Math.exp(-(((n - split) / width) ** 2)) - g0) / (1 - g0));
    return {
      technique, core, mid, low, ground, params: { split, glazeWidth: width, washOpacity: WASH_OPACITY },
      at: (nRaw) => {
        const n = Math.max(0, Math.min(1, nRaw));
        if (n <= 0) return ground;
        /* THE FLOOD: above `split` the region rises toward the core — the place the light IS. */
        const wB = Math.max(0, (n - split) / (1 - split));
        return over(low, glazeAt(n) * WASH_OPACITY * (1 - wB), over(core, wB * WASH_OPACITY, ground));
      },
    };
  }
  throw new Error(`f2-meaning: unknown illumination technique '${technique}' — the renderer dispatches on the token and will not guess`);
}

function resolveTechnique(r) {
  const e = r.flat.get('qandeel.expression.illumination.technique');
  if (!e) throw new Error('f2-meaning: qandeel.expression.illumination.technique is not in the resolved tree');
  return String(e.value);
}
function num(r, name) {
  const e = r.flat.get(name);
  if (!e) throw new Error('f2-meaning: ' + name + ' is not in the resolved tree');
  return Number(e.value);
}

/**
 * THE RADIAL STOPS A SOURCE PAINTS, SAMPLED FROM THE PROFILE ITSELF.
 *
 * The gradient is not authored: it is the profile, evaluated at N radii along D2R's falloff. That
 * is the only way the painted picture and the measured family can be the same object. A gradient
 * with hand-placed stops that "looks like" the profile would be a second design nobody measured.
 *
 * Each stop is emitted as an explicit colour at full opacity over a transparent base, EXCEPT that
 * the outermost stop is the ground at zero alpha so the source composites into whatever is beneath
 * it rather than punching a disc of World over the field.
 */
export function radialStops(prof, level, samples = 24) {
  const out = [];
  for (let i = 0; i <= samples; i++) {
    const f = i / samples;
    const n = intensityAt(level, f);
    const c = prof.at(n);
    out.push({ offset: +(f * 100).toFixed(2), colour: c, opacity: c === prof.ground ? 0 : 1, n: +n.toFixed(4) });
  }
  /* the outermost stop is always the ground at zero alpha, so the source composites into
     whatever is beneath it instead of punching a disc of World over the field */
  out[out.length - 1] = { offset: 100, colour: prof.ground, opacity: 0, n: 0 };
  return out;
}

/** D2R's own source geometry: an ellipse whose axes come from `elong`, rotated by `angle`,
 *  at `level x WASH_OPACITY`. Restated here as a pure function so the renderer and the boards
 *  cannot disagree about where a light is or how big it is. */
export const sourceGeometry = (s) => ({
  cx: s.x, cy: s.y,
  rx: s.r * (1 + 0.55 * (s.elong || 0)),
  ry: s.r * (1 - 0.30 * (s.elong || 0)),
  angle: s.angle || 0,
  opacity: (s.level ?? 0) * WASH_OPACITY,
});

/** The field's acknowledgement of a meaning event — opacity and nothing else. D2R's magnitude. */
export const RECEDE_OPACITY = 0.34;

/**
 * THE SOURCES OF EACH MEANING CATEGORY AT A TIME IN MILLISECONDS — D2R's own, called rather than
 * restated. CONNECTION's wash is a single travelling source; PATTERN's are its four members;
 * INSIGHT's are its five lobes.
 */
export function sourcesAt(kind, t) {
  if (kind === 'connection') {
    const s = connectionEvent(t);
    const src = s.washLevel > 0 ? [{ x: s.washX, y: s.washY, r: s.washR, level: s.washLevel }] : [];
    return { sources: src, signal: s, residue: { relationDraw: s.relationDraw, relationLevel: s.relationLevel } };
  }
  if (kind === 'pattern') {
    const s = patternEvent(t);
    return { sources: s.sources ?? [], signal: s, residue: { locusReveal: s.locusReveal, linkDraw: s.linkDraw, markReveal: s.markReveal } };
  }
  if (kind === 'insight') {
    const s = insightEvent(t);
    return { sources: s.sources ?? [], signal: s, residue: { nodeReveal: s.nodeReveal, keelDraw: s.keelDraw } };
  }
  throw new Error('f2-meaning: unknown meaning category ' + kind);
}

/**
 * THE FRAMES A REVIEWER IS POINTED AT — AND I-08B3.1-F2 POINTED THEM AT THE WRONG ONE.
 *
 * F2 used ONE set of times for all three meaning categories: REST 800, RISE 2750, PEAK 2900,
 * FALL 3400, SETTLE 5800. Two of the three are well served by it — PATTERN peaks at 3010 and
 * INSIGHT at 2920 — and CONNECTION is not, because CONNECTION peaks at 1050. Its wash is a single
 * source that travels the relation and is gone before the other two have started; at t = 2900 it
 * is at 0.363 of its own level, on its tail.
 *
 * So the board captioned "CONNECTION — PEAK" was showing CONNECTION at 42 per cent, and the
 * independent review that compared REST against PEAK and found the light event near-static was
 * looking at a frame where it genuinely almost is. Measured on the rendered pair, the darkest
 * point of that frame is 9 luminance units out of 255 below the ground; at CONNECTION's own peak
 * the same expression reaches about 32. Roughly three quarters of what the review rejected was
 * this, and no amount of re-deriving the expression would have fixed it.
 *
 * The beats are therefore derived PER CATEGORY, from D2R's own event functions, by scanning the
 * level they return: the peak is the argmax, rise and fall are its half-level crossings either
 * side, rest is before the first source exists and settle is after the last one is gone. Nothing
 * about D2R's lifecycle changes — this is how the proof SAMPLES it, which was always F2's choice
 * and not D2R's.
 */
const SCAN_MS = 6000, SCAN_STEP = 10;
const levelSeries = (kind) => {
  const out = [];
  for (let t = 0; t <= SCAN_MS; t += SCAN_STEP) {
    const { sources } = sourcesAt(kind, t);
    out.push({ t, level: sources.length ? Math.max(...sources.map((s) => s.level ?? 0)) : 0 });
  }
  return out;
};
export function beatsFor(kind) {
  const s = levelSeries(kind);
  let pk = s[0];
  for (const x of s) if (x.level > pk.level) pk = x;
  const half = pk.level / 2;
  const onset = s.find((x) => x.level > 0) ?? s[0];
  const rise = s.find((x) => x.level >= half) ?? pk;
  const fall = s.find((x) => x.t > pk.t && x.level <= half) ?? s[s.length - 1];
  const last = [...s].reverse().find((x) => x.level > 0) ?? pk;
  return Object.freeze({
    REST: Math.max(0, onset.t - 100),
    RISE: rise.t,
    PEAK: pk.t,
    FALL: fall.t,
    SETTLE: Math.min(SCAN_MS, last.t + 400),
    peakLevel: +pk.level.toFixed(4),
  });
}
export const BEATS_BY_KIND = Object.freeze(Object.fromEntries(
  ['connection', 'pattern', 'insight'].map((k) => [k, beatsFor(k)]),
));

/** The settled frame, shared: every category is over by here, and it is what a reduced-motion
 *  render shows. Kept as one value because "after everything" is not category-specific. */
export const BEATS = Object.freeze({
  SETTLE: Math.max(...Object.values(BEATS_BY_KIND).map((b) => b.SETTLE)),
});

/**
 * THE LEVELS THE THREE MEANING CATEGORIES ACTUALLY REACH.
 *
 * R-EVENT is a claim about what a reader sees, and a reader never sees the profile at intensity 1.0:
 * D2R's own envelopes top out at 0.8598 for CONNECTION, 0.9587 for PATTERN and 0.9219 for INSIGHT.
 * A floor evaluated at 1.0 is evaluated somewhere the Product does not go.
 */
export const PEAK_LEVELS = Object.freeze(Object.fromEntries(
  Object.entries(BEATS_BY_KIND).map(([k, b]) => [k, b.peakLevel]),
));

/**
 * THE LEVEL THE FLOOR BINDS AT — AND IT IS NOT THE LOWEST ONE, WHICH IS THE THIRD TIME THIS
 * PACKAGE HAS MADE THE SAME MISTAKE IN A DIFFERENT PLACE.
 *
 * I-08B3.1-F2R replaced "evaluate at 1.0" with "evaluate at the level the QUIETEST category
 * reaches", which sounds like the conservative choice and is not. **The signed bloom's area mean
 * FALLS as intensity rises.** Above the split the centre of the disc floods toward the core, and the
 * core is only dEok 0.021 from a ground at L 0.9491 — so a stronger event paints MORE of its disc
 * with the quietest colour it owns. Measured on the expression that came back from that correction:
 * 0.1026 at CONNECTION's 0.8598, 0.1009 at INSIGHT's 0.9219, 0.0995 at PATTERN's 0.9587, against a
 * floor of 0.1017. **The weakest category was where it scored BEST.** Two of the three categories
 * failed a floor the derivation reported as cleared, and the verifier found it by measuring at 1.0
 * and disagreeing with the record.
 *
 * "The quietest category" was a guess about which level is hardest, dressed as a measurement. The
 * quantity R-EVENT is actually about is the SMALLEST area mean among the levels the Product reaches,
 * and for a non-monotonic expression that argmin depends on the configuration — so it cannot be a
 * constant and is computed per profile.
 *
 * WEAKEST_PEAK_LEVEL is deliberately NOT exported any more. A named constant that meant "where this
 * requirement is evaluated" invited exactly one caller to use it and every other to forget, and the
 * two that forgot are why the disagreement existed at all.
 */
export function bindingAreaMean(at, ground, { gray = false } = {}) {
  let worst = Infinity, atLevel = null, kind = null;
  /* THE PER-CATEGORY FIGURES COME BACK TOO, from this one pass. They are wanted everywhere the
     binding value is wanted — the record, the boards, the verifier — and computing them again
     outside would triple the integration cost of a search whose size is counted in
     data/F2_DERIVATION.json under searchSize. */
  const byCategory = {};
  for (const [k, level] of Object.entries(PEAK_LEVELS)) {
    const m = areaMean(at, ground, { level, gray });
    byCategory[k] = +m.toFixed(4);
    if (m < worst) { worst = m; atLevel = level; kind = k; }
  }
  return { mean: worst, level: atLevel, category: kind, byCategory };
}

/**
 * MEASURE A PROFILE AGAINST EVERY REQUIREMENT THE DERIVATION STATED — on the SHIPPED profile,
 * resolved from the SHIPPED tokens. This is the function check C-04 calls, and its output is
 * compared against data/F2_DERIVATION.json rather than against a number typed into a test.
 */
export function measureProfile(prof, { brass, inks, error }) {
  const g = prof.ground, gC = lch(g)[1], gY = Y(g);
  let eventPeak = 0, risePeak = 0, dipPeak = 0, grayPeak = 0;
  let minBrass = 9, minInk = 9, minError = 9, shadowAt = null;
  const N = 128;
  for (let i = 0; i <= N; i++) {
    const q = i / N;
    const c = prof.at(q);
    const d = dEok(c, g);
    const gray = dEok(grayOf(c), grayOf(g));
    eventPeak = Math.max(eventPeak, d);
    grayPeak = Math.max(grayPeak, gray);
    if (Y(c) > gY) risePeak = Math.max(risePeak, gray);
    else if (Y(c) < gY) dipPeak = Math.max(dipPeak, gray);
    minBrass = Math.min(minBrass, dEok(c, brass));
    minError = Math.min(minError, dEok(c, error));
    for (const ink of inks) minInk = Math.min(minInk, dEok(c, ink));
    if (q > 0 && lch(c)[1] + 1e-9 < gC && shadowAt === null) shadowAt = +q.toFixed(4);
  }
  const binding = bindingAreaMean(prof.at, g);
  return {
    technique: prof.technique,
    eventPeak: +eventPeak.toFixed(4), risePeak: +risePeak.toFixed(4), dipPeak: +dipPeak.toFixed(4),
    grayPeak: +grayPeak.toFixed(4),
    /* THE FIGURE THE FLOOR IS NOW ON, AT THE LEVEL WHERE IT BINDS. Reported beside the peak rather
       than instead of it, because the two disagreeing is exactly the failure this package had and a
       reviewer should be able to see both numbers without running anything. The binding level and
       the category it belongs to are reported too — an area mean without the level it was taken at
       is the ambiguity that let the derivation and the verifier report different numbers for the
       same expression and both be internally consistent. */
    areaMean: +binding.mean.toFixed(4),
    grayAreaMean: +bindingAreaMean(prof.at, g, { gray: true }).mean.toFixed(4),
    areaMeanBindsAt: binding.level,
    areaMeanBindsOn: binding.category,
    areaMeanByCategory: binding.byCategory,
    /* THE SETTLE, MEASURED ONE INTENSITY STEP ABOVE ZERO rather than only AT zero. `at(0)` is a
       special case in every profile; this asks whether the SHAPE is heading for the ground. */
    tailAtOneStep: +dEok(prof.at(1 / 256), g).toFixed(4),
    minDEokToBrass: +minBrass.toFixed(4), minDEokToInk: +minInk.toFixed(4), minDEokToError: +minError.toFixed(4),
    settlesToGround: prof.at(0) === g,
    becomesShadowAt: shadowAt,
  };
}

export { PATTERN_LOCUS, INSIGHT_SITE, PATTERN_MEMBERS, topicById, LIFECYCLE_SCALE };
