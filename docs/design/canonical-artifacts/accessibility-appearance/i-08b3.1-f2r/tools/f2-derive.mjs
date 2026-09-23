/**
 * I-08B3.1-F2 — THE LIGHT APPEARANCE, DERIVED.
 *
 * ================================================================================================
 * THE ONE SENTENCE THIS FILE EXISTS TO MAKE CHECKABLE
 *
 *     APPEARANCE CHANGES THE LUMINANCE ENVIRONMENT. IT DOES NOT CHANGE THE CHROMA ORDER.
 *
 * Measured on the frozen dark system, QANDEEL's twelve appearance literals fall into a ladder
 * that is not a style — it is the Product's semantics written in chroma:
 *
 *     ERROR 0.1364  >  BRASS 0.0516  >  LIGHT 0.0317–0.0462  >  [atmosphere ceiling 0.0197]
 *                   >  INK 0.0106–0.0153  >  DISABLED 0.0081  >  WORLD / SURFACE 0.0000
 *
 * The one status colour is the most chromatic thing on screen; then the identity material; then
 * meaning; then the world's atmosphere; then reading; then the ground. Nobody wrote that ladder
 * down — I-08B3.1-A, C, D2R and E1 each set their own value for their own reason and the ladder
 * is what fell out. It is therefore a genuine invariant rather than a rule imposed afterwards,
 * and F2 adopts it as THE cross-appearance identity mechanism: the light appearance may move
 * every lightness and must not reorder that ladder. Check X-01 measures it in both appearances.
 *
 * ================================================================================================
 * WHY THERE IS NO SINGLE TRANSFER FUNCTION HERE, AND WHY THAT IS THE POINT
 *
 * §4 of the brief forbids deriving light by inverting dark. That prohibition is usually argued
 * on taste. In QANDEEL it can be argued on measurement, and `invertedWouldHaveBeen` below is the
 * argument: a per-channel inversion rotates EVERY chromatic role in this system to the opposite
 * side of the colour wheel — Brass 75° → 256°, Error 30° → 214°, the reading ramp 94° → 273°.
 * The inversion does not merely produce different values; it produces a blue identity material
 * and a teal error. One table, and §4 stops being a preference.
 *
 * So each role is solved by ITS OWN semantic responsibility:
 *
 *   WORLD      the ground a light has to be visible in   -> lightness bounded by the meaning event
 *   SURFACE    machinery told apart from the World       -> the frozen 1.0716 ratio, away from glare
 *   INK x3     reading HIERARCHY                         -> ratio parity, exactly
 *   SCRIM      WORLD SUPPRESSION                         -> suppression is darkening in BOTH
 *   BRASS      identity MATERIAL that is also an ink     -> hue held; the least darkening that reads
 *   LIGHT x3   MEANING EMERGENCE                         -> an expression family chosen by measurement
 *   ATMOSPHERE the world's field, never meaning          -> contour contrast parity, chroma ceiling
 *   ERROR      one cross-appearance family               -> hue held; the least darkening that reads
 *   DISABLED   availability override                     -> its RELATION to the rest ink, preserved
 *
 * ================================================================================================
 * THE SELECTION DISCIPLINE, INHERITED FROM I-08B3.1-D2R AND STATED BEFORE ANY NUMBER IS READ
 *
 *     MEET THE FLOOR, THEN MOVE THE SMALLEST DISTANCE THE REQUIREMENT FORCES.
 *
 * D2R used it to pick a Light five degrees from the family the Product Owner had already seen.
 * F2 uses it everywhere a floor exists, which is why Light Brass is the LIGHTEST brass that can
 * still be read as an ink rather than the one that reproduces dark Brass's contrast ratio. Both
 * candidates are computed and both are reported; the rejected one is in the record so a reviewer
 * can see what was available and disagree with the rule rather than guess at it.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveAll } from '../vendor/f1/tools/f1-resolve.mjs';
import { ATMOSPHERE } from '../vendor/f1/vendor/d2r/scene/d2-foundation.mjs';
import { WORLDS, RINGS } from '../vendor/f1/vendor/d2r/scene/d2-world.mjs';
import { areaMean, bindingAreaMean, PEAK_LEVELS, BEATS_BY_KIND } from './f2-meaning.mjs';
import {
  lch, dEok, over, hex, Y, ratioSolve, luminanceAt, chromaCeilingAt,
  grayOf, invert, contrastHex, inSrgbGamut, f, lchStr,
} from './f2-color.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');

/* ========================================================================== THE FROZEN DARK == */
/**
 * READ, NOT TYPED. Every dark value below comes out of the vendored token tree through F1's own
 * resolver. A hex typed into this file would be a copy that happened to be right on the day it
 * was written, and the dark-regression gate would then be comparing F2's memory of dark against
 * F2's memory of dark.
 */
const R = resolveAll();
export const DARK = Object.freeze({
  WORLD: R.colour.WORLD.value,
  SURFACE: R.colour.SURFACE.value,
  PRIMARY: R.colour.PRIMARY.value,
  SECONDARY: R.colour.SECONDARY.value,
  TERTIARY: R.colour.TERTIARY.value,
  BRASS: R.colour.BRASS.value,
  CORE: R.colour.LIGHT_CORE.value,
  MID: R.colour.LIGHT_MID.value,
  LOW: R.colour.LIGHT_LOW.value,
  ERROR: R.colour.ERROR_INK.value,
  DISABLED: R.colour.DISABLED_INK.value,
  SCRIM_INK: '#000000',
  SCRIM_ALPHA: 0.5,
});

/** The state and status inks E1 froze, so the interaction derivation can preserve RELATIONS
 *  rather than re-invent them. Every one of these is an ALIAS in dark; F2 keeps every alias. */
const DARK_STATE = Object.freeze({
  REST: R.colour.REST_INK.value,
  PRESSED: R.colour.PRESSED_INK.value,
  FOCUS: R.colour.FOCUS_INDICATOR.value,
  FOCUS_COMPANION: R.colour.FOCUS_COMPANION.value,
  SELECTED: R.colour.SELECTED_INK.value,
  SELECTED_MARKER: R.colour.SELECTED_MARKER.value,
  WARNING: R.colour.WARNING_INK.value,
  SUCCESS: R.colour.SUCCESS_INK.value,
  INFORMATIONAL: R.colour.INFORMATIONAL_INK.value,
});

/* ============================================================================ REQUIREMENTS == */
/**
 * STATED BEFORE THE SEARCH RUNS. Shipped as data so a reviewer reads the requirement rather than
 * the justification: a requirement written after the answer is a description of the answer.
 */
export const REQUIREMENTS = Object.freeze({
  'R-ORDER': {
    statement: 'The chroma order of the ROLE FAMILIES is identical in both appearances: ERROR > BRASS > LIGHT > ATMOSPHERE > INK > GROUND.',
    class: 'product-contract',
    why: 'It is the only structural property that makes "the same identity under different lighting" checkable rather than asserted. IT IS A LADDER OF ROLES, NOT OF VALUES: the first version of this check compared the eleven literals one by one and failed because the three Light stops came out in a different internal order, which is a fact about one ramp\'s shape and not about what the system means. Families are compared band to band — every Light stop above every atmosphere value and below the identity material.',
  },
  'R-HUE': {
    statement: 'Every chromatic role keeps its hue across appearances, to within 3 degrees.',
    class: 'product-contract',
    why: 'Hue is what a per-channel inversion destroys. Holding it is what makes Light Brass the same material and Light Error the same error, and it is measurable in one number.',
  },
  'R-RATIO': {
    statement: 'The three reading inks keep their WCAG contrast ratios against their own ground.',
    class: 'product-contract',
    why: 'QANDEEL hierarchy is a set of ratios. I-08B3.1-F1 proved importance is a ratio when it forbade increased contrast from inventing importance; the same argument binds an appearance change.',
  },
  'R-SEPARATION': {
    statement: 'min dEok(Meaning Light composited at any intensity, Living Brass) >= 0.020.',
    class: 'production-default',
    serves: 'LIGHT IS MEANING / BRASS IS MATTER must stay separable at every intensity.',
    why: "I-08B3.1-D2R's own floor, re-run with D2R's own metric on the light ground. 0.020 is an engineering heuristic and D2R said so; F2 does not promote it.",
  },
  'R-INK-SEPARATION': {
    statement: 'min dEok(any STOP of the Meaning Light ramp, any reading ink) >= 0.020.',
    class: 'production-default',
    serves: 'A meaning event must not be mistakable for writing.',
    why: "IT IS MEASURED ON THE RAMP'S STOPS AND NOT ON ITS COMPOSITING PATH, AND THE FIRST VERSION GOT THAT WRONG IN A WAY WORTH RECORDING. Measured along the composite, the FROZEN DARK appearance fails it: a bright wash rising over a near-black World passes within dEok 0.0094 of the tertiary reading ink at about half intensity, on its way up. That is not a confusion and it is not a defect in a frozen package — a broad soft gradient transiently crossing an ink's tone while it rises is nothing like a glyph. What the requirement is actually about is an expression that RESTS at an ink's colour, which is what a darkening family does: its stops ARE ink-like tones. So the stops are what is measured. The composite-path minimum is reported alongside in both appearances, as information rather than as a verdict.",
    note: 'This requirement did not exclude the darkening family. R-SOURCE did.',
  },
  'R-GRAYSCALE': {
    statement: 'The meaning event must remain perceptible with colour removed: gray dEok >= 0.020 at peak.',
    class: 'product-contract',
    why: 'I-08B3.1-E1 and F1 forbid colour being the only carrier. It is the requirement that kills the chroma-only answer to Part C, and it kills it by arithmetic rather than by preference.',
  },
  'R-NOT-SHADOW': {
    statement: 'At every intensity the illuminated composite carries at least as much chroma as the ground it replaces.',
    class: 'product-contract',
    why: 'Light ADDS colour to a material; shadow REMOVES it.',
  },
  'R-SOURCE': {
    statement: 'At its peak the event must be LIGHTER than its ground, by more than a just-noticeable step, with the colour removed.',
    class: 'production-default',
    serves: 'qandeel.appearance.light-remains-meaning',
    why: "THIS REQUIREMENT EXISTS BECAUSE THE FIRST SEARCH RETURNED THE ANSWER §8 FORBIDS BY NAME. With only a chroma-gain test for \"not shadow\", the DARKENING family was admissible and won on magnitude: on a ground whose own chroma is 0.0041, any chromatic darkening gains chroma. What actually distinguishes a light from a shadow is that a light HAS A SOURCE. The falloff may glaze deeper away from it — that is what a warm light does to a light material — but the place the light is must be brighter than the place it is not. It is also the requirement that bounds the Light World from above, because a ground at L 0.98 leaves a source nothing to rise into.",
    reclassified: "I-08B3.1-F2R DEMOTED THIS FROM PRODUCT CONTRACT ON INSTRUCTION, AND KEPT IT. Independent review was explicit that 'the source must always be lighter than the ground' is a derivation constraint and not frozen Product truth, and that a light-appearance expression may legitimately combine local lightening and darkening. It is retained as the production default because the only family in the search it excludes is F-B, pure DARKENING — every insight gets deeper — which §8 of the F2 brief forbids by name and F2R does not withdraw.",
    andWhatNowSHARESThatDoor: "R-SOURCE-DOMINANCE REJECTS F-B's STRONGEST CONFIGURATIONS BUT NOT THE FAMILY, AND THE DISTINCTION IS WORTH STATING PRECISELY RATHER THAN CLAIMING MORE. Pure darkening has no rise at any depth, so R-SOURCE is still the requirement that fails EVERY F-B variant and is still the one that excludes the family as a family. What R-SOURCE-DOMINANCE removes is the part of F-B that made it attractive: the deep configurations, which are the only ones whose magnitude clears R-EVENT, are also the ones that go darker than the World under its own passage scrim. The shallow ones that survive the new bound fail R-EVENT instead. So the door is no longer held by one sentence at one point of the falloff — but this requirement has not been retired, and reporting it as redundant would be reporting a wish.",
  },
  'R-SOURCE-DOMINANCE': {
    statement: "No stop of the Meaning Light ramp may be DARKER than the World under its own passage scrim. On the shipped ground that is L 0.5423.",
    class: 'production-default',
    serves: 'qandeel.appearance.light-remains-meaning',
    why: "A LIGHT GROUND CANNOT LEND A SOURCE MUCH BRIGHTNESS, SO A PERCEIVABLE LIGHT EVENT MUST BORROW MAGNITUDE FROM DARKENING — at L 0.9491 a source can rise by at most about dEok 0.021 before it runs out of range. R-SOURCE says the source must be lighter than its ground; it does NOT say how much deepening may accompany it, and that silence is the hole. This requirement closes it from the other side, and it does so with a value the appearance already owns rather than with a threshold chosen to fit: the passage scrim is what QANDEEL paints over a region it is pushing behind something else, and it composites to L 0.5423 from an alpha solved against the dark appearance's suppression factor. An event that means 'QANDEEL UNDERSTOOD' may not be darker than the veil that means 'not this, not now'.",
    howItWasFound: "IT WAS NOT REASONED OUT IN ADVANCE. I-08B3.1-F2R derived the ratio-preserving floor in full, and the expression that cleared it satisfied every requirement in this table — hue drift well inside the tolerance, ladder preserved, separations clear, clean settle — and rendered as an opaque brown-grey sphere on a near-white World. A configuration that passes every check and fails on sight is evidence that a check is missing, not that the eye is wrong. The rejected expression's deepest stop sits BELOW the scrim, and by a narrow margin: the requirement is not calibrated to reject that configuration comfortably, it is calibrated to a frozen value and rejects it by whatever amount that produces. chosen.ratioFloorCost carries the figures from the run rather than this paragraph.",
    measuredOnTheStops: "ON THE STOPS, WHICH IS THE SOUND PLACE AND NOT THE CONVENIENT ONE. The composite at any intensity is a convex blend of a stop with a backdrop no darker than the ground, so the deepest stop bounds the lightness of EVERY PAINTED PIXEL from below: stops above the scrim guarantee a whole event above the scrim. Measured on the composite the test does not separate the two floors at all — the rejected expression's darkest pixel sits near L 0.583, above the scrim, because a partial glaze never reaches its own stop. A bound on the composite would be a bound on one frame; a bound on the stops is a bound on the expression. R-INK-SEPARATION is on the stops for the same reason.",
    whatIsNotClaimed: "THE DIP-TO-RISE RATIO IS REPORTED AND NOT BOUNDED. It is 6.9 : 1 for the shipped expression against 17 : 1 for the rejected one, and it is the number that best describes what a reader sees differently between them — but any threshold between those two values would be a threshold chosen from two samples, which is taste wearing a measurement. It is in the record as `dipOverRise` so a later brief can bound it if it finds a reason to.",
  },
  'R-CONTINUOUS': {
    statement: 'The expression reaches the unilluminated ground CONTINUOUSLY: one 8-bit intensity step above zero, the composite is already within a just-noticeable step of the ground.',
    class: 'production-default',
    serves: 'qandeel.appearance.light-remains-meaning',
    why: "R-SETTLE ASKS THE VALUE AT ZERO AND CANNOT SEE THE SHAPE ARRIVING AT IT. F2's glaze was a Gaussian centred on the split, which is non-zero at zero intensity; at a width of 0.14 the residue was far below one 8-bit step, so R-SETTLE passed and nothing was wrong. The F2R correction needs a WIDE glaze, and there the same shape leaves a visible tint at the intensity where the event is supposed to be over, with R-SETTLE still reporting a clean settle because `at(0)` is a special case in every profile. A requirement that is satisfied by a special case is satisfied by the special case and not by the design. The glaze weight is now normalised to vanish at zero, and this is the check that would notice if it stopped.",
  },
  'R-SETTLE': {
    statement: 'At intensity 0 the composite is the unilluminated ground, exactly.',
    class: 'product-contract',
    why: 'Inherited from I-08B3.1-D2R: no permanent Meaning glow. Asserted on the quantised hex, not on the float.',
  },
  'R-EVENT': {
    statement: "The meaning event's AREA MEAN — its difference from the ground averaged over the source's disc, weighted by area along D2R's falloff — must exceed the smallest step of the appearance's own reading ramp AT EVERY PEAK LEVEL THE THREE MEANING CATEGORIES REACH, which means at whichever of them the expression scores lowest.",
    class: 'production-default',
    serves: 'qandeel.appearance.light-remains-meaning',
    why: "THIS BOUND HAS BEEN RESTATED THREE TIMES AND EVERY EARLIER VERSION WAS WRONG IN AN INSTRUCTIVE WAY. The first required the event to exceed the world's strongest CONTOUR — but a contour is a one-pixel line and an event is a broad soft region, and comparing their per-pixel dEok compares unlike things. The second used the World-to-Surface step, which is like-for-like but is the WEAKEST distinction in the system: a floor so low that it did no work and left the selection rule to decide everything. The third — the one F2 shipped — put the reading ramp's smallest adjacent step on the event's PEAK, and that is the version worth understanding, because it is the one that passed.",
    whyTheThirdVersionFailed: "A PEAK IS A PROPERTY OF ONE POINT ON THE FALLOFF AND AN EVENT IS A REGION. F2's expression reached dEok 0.1046 against a floor of 0.1017 — it cleared the requirement — on a glaze 0.14 wide in normalised intensity, which is to say on a thin annulus, with essentially bare ground on either side of it. Integrated over the disc a reader looks at, the same expression came to 0.0255: a QUARTER of the floor its peak had cleared, and one twelfth of the dark appearance's 0.3257. Independent review called the rendered CONNECTION near-static and the number agreed; the requirement had simply been measuring something else. The floor is unchanged and the QUANTITY is corrected: the smallest difference QANDEEL asks a reader to perceive as meaning something, required of the event's average rather than of its best pixel.",
    andItWasEvaluatedWhereTheProductNeverGoes: "EVERY VERSION BEFORE I-08B3.1-F2R MEASURED THE PROFILE AT INTENSITY 1.0, AND NO MEANING CATEGORY REACHES IT. I-08B3.1-D2R's own envelopes top out at 0.8598 for CONNECTION, 0.9587 for PATTERN and 0.9219 for INSIGHT. A requirement evaluated where the Product never goes is a requirement about nothing.",
    andTHENITWASEvaluatedAtTheFlatteringOneOfTheThree: "THE FIRST FIX WAS 'EVALUATE AT THE LEVEL THE QUIETEST CATEGORY REACHES', AND THAT WAS A GUESS ABOUT THE SHAPE WEARING A MEASUREMENT'S CLOTHES. It reads like the conservative choice. It is not, because THE SIGNED BLOOM'S AREA MEAN FALLS AS INTENSITY RISES: above the split the centre of the disc floods toward the core, and the core is only dEok 0.021 from a ground at L 0.9491, so a stronger event paints more of its own disc with the quietest colour it owns. The expression that came back from that fix measured 0.1026 at CONNECTION's 0.8598, 0.1009 at INSIGHT's 0.9219 and 0.0995 at PATTERN's 0.9587 against a floor of 0.1017 — it cleared the floor at the level the requirement looked at and FAILED IT AT THE OTHER TWO. Two of the three meaning categories did not meet a requirement the derivation reported as met.",
    andHowITWasFound: "BY THE VERIFIER DISAGREEING WITH THE RECORD. Check C-07 was still calling the area mean at its default level of 1.0 while the derivation called it at 0.8598, so the two reported different numbers for the same expression and each was internally consistent. That disagreement is normally a defect in the check. Here it was the only reason anyone looked at the third number. The quantity is now the SMALLEST area mean among the three levels the Product reaches, found per configuration, because for a non-monotonic expression the argmin is not a constant — and the two appearances demonstrate exactly that: the dark event is monotonically increasing and binds on CONNECTION, the light event is monotonically decreasing and binds on PATTERN. THE BINDING CATEGORY IS A PROPERTY OF THE EXPRESSION, NOT OF THE PRODUCT, which is why it could never have been a named constant.",
  },
  'R-FOOTPRINT': {
    statement: "The light event's perceived extent must not exceed the dark event's by more than 0.10 of the source radius.",
    class: 'product-contract',
    serves: 'An alternate appearance may not make a meaning event cover more of the world than it does in the appearance it is a counterpart of.',
    why: 'IT IS THE REQUIREMENT THE FIRST RENDER ASKED FOR IN WORDS. With no footprint bound and an objective of "the largest admissible event", the search drove the glaze to its deepest and widest setting and the five lobes of an INSIGHT laid a continuous wash over half the world. Measured, the event was correct; looked at, it was a stain. Extent is a property a reader perceives directly and a per-pixel distance cannot see, so it is stated separately and measured separately.',
  },
  'R-GLARE': {
    statement: 'The Light World is not #FFFFFF and carries a non-zero chroma stable under 8-bit quantisation.',
    class: 'production-default',
    serves: 'The World is a material, not paper.',
    why: 'Apple and Material both ship a white light background. QANDEEL departs, and the reason is QANDEEL\'s own: this World has to be able to hold a light, and a ground with no chroma at all is the "white utility app" the Product Owner named.',
  },
  'R-INK-DUTY': {
    statement: 'Living Brass and Error meet 4.5:1 against BOTH the Light World and the Light Surface.',
    class: 'product-contract',
    why: 'Both are painted as TEXT — the identity mark, the navigation labels, the error line — at sizes below the WCAG large-text threshold. In dark one value could be a material and an ink at once; on a light ground the two duties pull apart and the ink duty is the binding one.',
  },
  'R-SUPPRESSION': {
    statement: 'The PASSAGE scrim darkens in BOTH appearances.',
    class: 'product-contract',
    why: 'A scrim expresses WORLD SUPPRESSION, and suppression is not a direction on the lightness axis — it is subtraction. Apple is explicit that a light translucent surface must never be stacked on another, so a "light-mode scrim" made by inverting the dark one would collapse the legibility it exists to protect.',
  },
});

/** The single adopted bound whose only justification is that a search needs one. Named, so that
 *  it can be argued with. */
export const ADOPTED = Object.freeze({
  SEPARATION_FLOOR: 0.020,
  INK_FLOOR_RATIO: 4.5,
  QUANTISATION_STABLE_CHROMA: 0.0030,
  HUE_TOLERANCE_DEG: 3.0,
  JND_DEOK: 0.020,
  FOOTPRINT_TOLERANCE: 0.10,
});

/**
 * THE SELECTION RULE, RESTATED — AND THE FIRST ONE CONTRADICTED THIS FILE'S OWN STATED DISCIPLINE.
 *
 * It was "among admissible families, take the one with the largest event". That is an objective
 * with no upper bound, so it ran to one: the glaze went to its deepest and widest setting, and
 * the rendered INSIGHT — five overlapping lobes — covered half the world. Every number was right.
 * The objective was wrong, and it was wrong in a way the numbers could not report, because
 * "largest" was exactly what it had been asked for.
 *
 * THE SECOND ATTEMPT WAS "CLOSEST TO THE DARK APPEARANCE'S EVENT PEAK", which sounds like parity
 * and is not. The light appearance cannot reach the dark one's magnitude — a near-black ground
 * lends a meaning event the whole luminance range, and a light ground has already spent it — so
 * the target is unreachable, and "closest to an unreachable target" IS "maximum". The same
 * runaway objective, in better words. Both attempts are recorded because the failure mode is the
 * interesting part: an objective that runs to a bound did not choose the answer, it was chosen by
 * the bound.
 *
 * THE THIRD ATTEMPT — the one F2 shipped — was "the smallest glaze", and it was the right
 * DISCIPLINE against the wrong FLOOR. Minimising above a floor is only as good as the floor: R-EVENT
 * was on the event's peak, a rim 0.14 wide cleared it by three per cent, and the selection duly
 * took that. The objective did not fail. It went exactly where it was sent.
 *
 * THE RULE IS NOW THE SAME DISCIPLINE ON THE CORRECTED FLOOR, WITH ONE CHANGE OF INSTRUMENT:
 *
 *   among admissible configurations, take the one with the MILDEST EXTREME —
 *   the smallest peak departure from the ground.
 *
 * "Smallest glaze" was measured as the deepest point of the dip, which trades depth against
 * extent: it prefers a wide shallow wash, and pushed to its limit a wash is the stain the brief
 * forbids. "Mildest extreme" bounds the single most departed point in either direction, so neither
 * a hard bright core nor a hard dark rim can win, and it CONVERGES rather than running to a bound —
 * measured, the attainable minimum saturates at dEok 0.1535 once the glaze is wide enough, and
 * widening it further buys nothing. Ties break on the shallowest third rung, then the hue nearest
 * the frozen dark Light, then the least extent, then the least shape. Every level is stated, and
 * the reason there are levels at all is that the feasible set is essentially one contour: almost
 * everything admissible sits within 0.003 of the floor, so what the selection is really choosing
 * among is SHAPES at one magnitude.
 */
export const SELECTION_RULE = 'among admissible configurations, the mildest extreme — the floor makes the event read, and the selection takes the least departure the floor forces, with magnitude compared only down to a just-noticeable step so that an imperceptible sliver of it cannot outrank the cross-appearance contract';

/* ================================================================ PART A — THE LIGHT GROUND == */
/**
 * The world's hue is the system's own reading hue, rounded. It is NOT a new colour decision:
 * every ink in QANDEEL already sits between 91.6 and 94.2 degrees, and a ground at any other hue
 * would be the first cool thing in a warm system.
 */
const READING_HUE = +(([DARK.PRIMARY, DARK.SECONDARY, DARK.TERTIARY]
  .map((h) => lch(h)[2]).reduce((a, b) => a + b, 0) / 3).toFixed(1));

/** The least chroma that survives 8-bit quantisation at this lightness — "the World is the least
 *  chromatic thing on screen", instantiated rather than asserted. */
function leastStableChroma(L, H) {
  /* Among every authored chroma that survives quantisation at this lightness, the one whose
     RECOVERED HUE is nearest the system's own. At L near 0.95 and chroma near 0.004 the 8-bit
     grid is coarse enough to move a hue fifteen degrees, and a ground that is warm in the token
     file and green on the screen is exactly the kind of drift this project has been bitten by. */
  let best = null;
  for (let C = 0.0005; C < 0.020; C += 0.0001) {
    const h = hex(L, C, H);
    const [, Cg, Hg] = lch(h);
    if (Cg < ADOPTED.QUANTISATION_STABLE_CHROMA) continue;
    if (Cg > ADOPTED.QUANTISATION_STABLE_CHROMA * 2.2) break;
    const drift = Number.isNaN(Hg) ? 999 : (() => { const d = Math.abs(Hg - H) % 360; return d > 180 ? 360 - d : d; })();
    if (!best || drift < best.drift) best = { C: +C.toFixed(4), hex: h, actual: +Cg.toFixed(4), drift: +drift.toFixed(2) };
  }
  return best;
}

function ground(Lw) {
  const w = leastStableChroma(Lw, READING_HUE);
  if (!w) return null;
  const world = w.hex;
  /* THE SURFACE MOVES AWAY FROM THE EXTREME. One sentence covers both appearances: in dark the
     extreme is black and the Surface is lifted; in light the extreme is white and the Surface is
     deepened. The MAGNITUDE is the frozen 1.0716, untouched. */
  const wsRatio = contrastHex(DARK.SURFACE, DARK.WORLD);
  const surf = solveRole(world, world, wsRatio, { tol: 0.012, from: 0.80, to: Lw });
  return {
    Lw, world, worldAuthoredC: w.C, worldChroma: w.actual, worldHueDrift: w.drift, wsRatio,
    surface: surf?.hex ?? null, surfaceRatio: surf?.ratio ?? null, surfaceHueDrift: surf?.hueDrift ?? null,
  };
}

/* ========================================================== PART C — THE MEANING LIGHT ======= */
/**
 * FOUR CANDIDATE EXPRESSION FAMILIES. §8 says "do not preselect the technique", so all four are
 * built, all four are measured against the requirement set above, and the winner is whichever is
 * admissible with the largest event. Three of them fail, and each fails for a different reason
 * that the brief predicted in words and this file converts into a number.
 *
 *   F-A  ADDITIVE      the DARK technique, unchanged: composite a bright warm stop over the
 *                      ground. §8's "make it brighter may fail completely".
 *   F-B  DARKENING     composite a deep warm stop. §8's "making every insight darker".
 *   F-C  CHROMATIC     hold the ground's lightness, spend everything on chroma.
 *   F-D  SIGNED BLOOM  the source blows out toward the ceiling; the falloff annulus glazes
 *                      DEEPER and warmer. Both signs, one event — which is what a warm light
 *                      does to a light material, and the only family with a luminance signature
 *                      that survives having its colour removed.
 *
 * The intensity q is I-08B3.1-D2R's falloff output, peaking at CEILING x event-peak. The whole
 * lifecycle, the easing and the settle are D2R's and are not retuned here; F2 changes WHAT the
 * intensity paints, never WHEN.
 */
/**
 * THE INTENSITY AXIS IS NORMALISED [0, 1], and the renderer converts into it from D2R's geometry.
 * The first version swept an absolute falloff output here while tools/f2-scene swept its own, so
 * the family that was measured and the family that was painted agreed at one end and nowhere else.
 */
const WASH_OPACITY = 0.86; // I-08B3.1-D2R's MAGNITUDE.WASH_OPACITY, not retuned
const QS = Array.from({ length: 129 }, (_, i) => i / 128);

/**
 * EVERY FAMILY IS SEARCHED, NOT TYPED.
 *
 * A family whose constants I chose and whose rival's constants I also chose is not a comparison,
 * it is a preference with arithmetic attached. So each family below is a PARAMETERISED SHAPE, and
 * each is given its strongest configuration that satisfies every other requirement. The winner is
 * then the winner of a fair fight, and a family that loses loses on its own best day.
 *
 * The LIGHT HUE is searched too, in a band around the frozen dark Light's 89 degrees, under
 * I-08B3.1-D2R's own rule: meet the separation floor, then take the value nearest the one the
 * Product Owner has already seen.
 */
/**
 * THE SEARCH RUNS IN TWO PASSES, AND THE REASON IS HONEST RATHER THAN MERELY PRACTICAL.
 *
 * The full grid for the signed-bloom family alone is tens of thousands of configurations, and the
 * ground sweep has 21 candidates; the product of the two, each measured over hundreds of samples at
 * three intensities, is not a search — it is a way of not finishing. The counted sizes are in
 * data/F2_DERIVATION.json under searchSize rather than typed here.
 *
 * PASS 1 asks only ONE question of each candidate ground: does ANY admissible expression exist
 * here? A coarse grid answers that, because viability is a property of the ground and not of a
 * shape parameter. PASS 2 then runs the FULL grid, for all four families, at the ground Pass 1
 * chose — and that is the comparison the package reports. No family is preselected at either
 * stage; the coarse pass runs all four too.
 */
const HUE_BAND = Array.from({ length: 9 }, (_, i) => 85 + i);   // 85 .. 93, around the frozen 89.1
const HUE_BAND_COARSE = [86, 89, 92];

function variantsA(g, band, brassC, coarse) {
  /* ADDITIVE: the dark technique unchanged. Its only free parameters are how high the stop can
     go and how much chroma it carries — both bounded by sRGB at the top of the lightness axis. */
  const out = [];
  for (const H of (coarse ? HUE_BAND_COARSE : HUE_BAND)) for (const C of (coarse ? [band, band * 1.45] : [band, band * 1.2, band * 1.45])) {
    let L = 0.999; while (L > 0.85 && !inSrgbGamut([L, C, H])) L -= 0.001;
    const stops = [L, L - 0.018, L - 0.036].map((x) => hex(x, C, H));
    out.push({ H, C: +C.toFixed(4), stops, at: (n) => over(stops[0], n * WASH_OPACITY, g.world) });
  }
  return out;
}
function variantsB(g, band, brassC, coarse) {
  /* DARKENING: the insight gets deeper. Free parameter is how deep. */
  const Lw = lch(g.world)[0];
  const out = [];
  for (const H of (coarse ? HUE_BAND_COARSE : HUE_BAND)) for (const C of (coarse ? [band, band * 1.45] : [band, band * 1.2, band * 1.45])) for (const drop of (coarse ? [0.28, 0.44] : [0.20, 0.28, 0.36, 0.44, 0.52])) {
    const L = Lw - drop; if (L < 0.12 || !inSrgbGamut([L, C, H])) continue;
    const stops = [L, L + 0.05, L + 0.10].map((x) => hex(x, C, H));
    out.push({ H, C: +C.toFixed(4), drop, stops, at: (n) => over(stops[0], n * WASH_OPACITY, g.world) });
  }
  return out;
}
function variantsC(g, band, brassC, coarse) {
  /* CHROMATIC: lightness held at the ground's, everything spent on colour. Capped just under the
     identity material so the family gets its best ADMISSIBLE shot rather than being disqualified
     on a chroma I chose for it. */
  const Lw = lch(g.world)[0];
  const out = [];
  for (const H of (coarse ? HUE_BAND_COARSE : HUE_BAND)) {
    const ceil = Math.min(chromaCeilingAt(Lw, H), brassC - 0.0005);
    for (const C of [ceil, ceil * 0.8, ceil * 0.6]) {
      if (C <= band * 0.5) continue;
      const stops = [C, C * 0.85, C * 0.7].map((c) => hex(Lw, c, H));
      out.push({ H, C: +C.toFixed(4), stops, at: (n) => over(stops[0], n * WASH_OPACITY, g.world) });
    }
  }
  return out;
}
/**
 * F-D — SIGNED BLOOM. The source floods toward the ceiling of what sRGB can hold at the Light's
 * hue; the falloff annulus GLAZES deeper and warmer. Both signs in one event.
 *
 * It is the only family with a signed luminance profile, which is the only reason any family
 * survives having its colour removed AND stays out of the ink ramp: the flooded core is above
 * every ink and the glaze is bounded by the separation floor rather than by a number I liked.
 *
 * `split` is where flooding gives way to glazing along D2R's falloff, `glazeDrop` how deep the
 * third rung sits, and `width` how far the glaze reaches. All three are searched. The lifecycle,
 * the easing and the settle are D2R's and are not touched: F2 changes WHAT the intensity paints,
 * never WHEN.
 */
/**
 * THE GLAZE WEIGHT — I-08B3.1-F2R's two corrections to the shape, both of which REMOVE something.
 *
 * It vanishes at zero intensity BY SHAPE rather than by the `at(0)` special case, which is
 * R-CONTINUOUS; and there is NO GAIN PARAMETER any more, because the glaze's strength is
 * I-08B3.1-D2R's WASH_OPACITY, the same single gain the dark ramp has. A separate gain made depth
 * and strength two names for one thing: the same composite was reachable from a shallow stop at
 * high gain or a deep stop at low gain, the search could not tell them apart, and the deep-stop
 * answers put the LOW stop's AUTHORED value inside the reading ramp's own lightness range while
 * the painted result looked identical. Removing the parameter removes the ambiguity.
 */
const glazeWeight = (n, split, width) => {
  const g0 = Math.exp(-((split / width) ** 2));
  return Math.max(0, (Math.exp(-(((n - split) / width) ** 2)) - g0) / (1 - g0));
};
const D_DROPS = (() => { const a = []; for (let d = 0.04; d <= 0.501; d += 0.01) a.push(+d.toFixed(2)); return a; })();
const D_SPLITS = [0.35, 0.45, 0.55, 0.65, 0.75];
/* THE WIDTH RANGE RUNS PAST WHERE THE ANSWER STOPS MOVING, WHICH IS THE ONLY HONEST WAY TO SHOW A
   BOUND DID NOT CHOOSE IT. Measured, the attainable minimum peak falls 0.1725 -> 0.1632 -> 0.1612
   -> 0.1541 -> 0.1535 as the cap rises through 0.45, 0.60, 0.80, 1.00, 1.40, and then does not
   move again at 2.00. The shape converges because the normalised Gaussian tends to a fixed
   parabola as the width grows; the grid is carried past the knee so the record shows the plateau
   rather than asserting one. */
const D_WIDTHS = [0.20, 0.30, 0.45, 0.60, 0.80, 1.00, 1.40, 2.00];
function variantsD(g, band, brassC, coarse) {
  const Lw = lch(g.world)[0];
  const out = [];
  for (const H of (coarse ? HUE_BAND_COARSE : HUE_BAND)) for (const C of (coarse ? [band, band * 1.45] : [band, band * 1.2, band * 1.45])) {
    let ceilL = 0.999; while (ceilL > 0.85 && !inSrgbGamut([ceilL, C, H])) ceilL -= 0.001;
    const ceiling = hex(ceilL, C, H);
    /* THE COARSE PASS'S GRID HAS TO BE ABLE TO REACH WHAT THE FULL GRID CAN, or it answers its one
       question — does an admissible expression exist at this ground? — with a no that is about the
       grid. It did exactly that when I-08B3.1-F2R raised the floor: the coarse set topped out at an
       area mean of 0.2435 against a floor of 0.2525, so every ground in the sweep was reported
       non-viable while the full grid at the same grounds had thousands of admissible
       configurations. A coarse pass may be coarse in RESOLUTION; it may not be narrow in RANGE. */
    for (const glazeDrop of (coarse ? [0.10, 0.18, 0.28, 0.40, 0.52] : D_DROPS)) {
      const gl = +(Lw - glazeDrop).toFixed(4); if (gl < 0.2 || !inSrgbGamut([gl, C, H])) continue;
      const glaze = hex(gl, C, H);
      /* THREE RUNGS OF ONE RAMP, exactly as the dark appearance has three. The flooded source,
         a midpoint, and the glaze — all authored at ONE chroma, because the dark ramp's three
         stops are one material at three intensities and not three colours. The earlier version
         made the third rung a COMPOSITE of the glaze over the World, which diluted its chroma
         below the ink ramp and quietly broke the ladder the whole package rests on. */
      const stops = [ceiling, hex((ceilL + gl) / 2, C, H), glaze];
      for (const split of (coarse ? [0.45, 0.65] : D_SPLITS)) for (const width of (coarse ? [0.30, 1.00] : D_WIDTHS)) {
        const at = (nRaw) => {
          const n = Math.max(0, Math.min(1, nRaw));
          if (n <= 0) return g.world;
          const wB = Math.max(0, (n - split) / (1 - split));
          return over(glaze, glazeWeight(n, split, width) * WASH_OPACITY * (1 - wB), over(ceiling, wB * WASH_OPACITY, g.world));
        };
        out.push({ H, C: +C.toFixed(4), glazeDrop, split, width, stops, at, parts: { ceiling, glaze, split, width } });
      }
    }
  }
  return out;
}

const FAMILIES = [
  ['F-A', 'ADDITIVE — the dark technique, unchanged', variantsA],
  ['F-B', 'DARKENING — the insight gets deeper', variantsB],
  ['F-C', 'CHROMATIC — lightness held, everything spent on colour', variantsC],
  ['F-D', 'SIGNED BLOOM — the core floods, the annulus glazes', variantsD],
];

/** Measure one VARIANT against every stated requirement. Nothing here is a judgement. */
/**
 * THE PERCEIVED EXTENT of an expression: the fraction of a source's radius over which the
 * composite still differs from its ground by more than a just-noticeable step. It is measured
 * along I-08B3.1-D2R's own falloff exponent, at full level, so the dark and light figures are
 * about the same geometry and differ only in what the intensity paints.
 */
const FOOTPRINT_SAMPLES = 200;
export function footprintOf(at, ground) {
  let last = 0;
  for (let i = 0; i <= FOOTPRINT_SAMPLES; i++) {
    const f = i / FOOTPRINT_SAMPLES;
    const n = Math.pow(Math.max(0, 1 - f), 0.7);
    if (dEok(at(n), ground) > ADOPTED.JND_DEOK) last = f;
  }
  return +last.toFixed(3);
}

/**
 * THE QUANTITY R-EVENT IS NOW ON — imported from tools/f2-meaning so the derivation, the renderer
 * and the verifier cannot be measuring three different integrals of the same picture.
 *
 * AND IT IS EVALUATED WHERE IT BINDS, WHICH TOOK TWO CORRECTIONS AND NOT ONE. The first version
 * measured at intensity 1.0, where no meaning category ever goes: D2R's envelopes top out at 0.8598
 * for CONNECTION, 0.9587 for PATTERN and 0.9219 for INSIGHT. The second measured at the lowest of
 * those three, on the reasoning that the quietest category is the hardest case — and that was a
 * GUESS ABOUT THE SHAPE dressed as a measurement. The signed bloom's area mean FALLS as intensity
 * rises, because above the split the centre of the disc floods toward a core only dEok 0.021 from
 * the ground, so the quietest category is where the expression scores BEST. The configuration that
 * came back from the second correction cleared the floor at CONNECTION's level and failed it at both
 * of the others.
 *
 * It is now the SMALLEST area mean among the three levels the Product actually reaches, found per
 * configuration because for a non-monotonic expression the argmin is not a constant.
 */
const areaMeanOf = (at, ground, gray = false) => bindingAreaMean(at, ground, { gray }).mean;

function measureVariant(v, g, brassHex, errorHex, inks, eventFloor, atmoCeiling, darkHue, darkRef, suppressedWorld) {
  const gnd = g.world, gC = lch(gnd)[1], gY = Y(gnd);
  let eventPeak = 0, risePeak = 0, dipPeak = 0, grayPeak = 0;
  let minBrass = 9, minInk = 9, minError = 9, shadowAt = null;
  for (const q of QS) {
    const c = v.at(q);
    const d = dEok(c, gnd);
    eventPeak = Math.max(eventPeak, d);
    /* THE RISE IS MEASURED WITH THE COLOUR REMOVED, AND THAT IS NOT A DETAIL. Measured on the
       full colour, a core that is merely WARMER than its ground satisfies "there is a light"
       on chroma alone — which is how the first version of this check passed a core whose
       lightness was indistinguishable from the World it sat in. A source is a LUMINANCE fact. */
    const gray = dEok(grayOf(c), grayOf(gnd));
    if (Y(c) > gY) risePeak = Math.max(risePeak, gray); else if (Y(c) < gY) dipPeak = Math.max(dipPeak, gray);
    grayPeak = Math.max(grayPeak, gray);
    minBrass = Math.min(minBrass, dEok(c, brassHex));
    minError = Math.min(minError, dEok(c, errorHex));
    for (const ink of inks) minInk = Math.min(minInk, dEok(c, ink));
    if (q > 0 && lch(c)[1] + 1e-9 < gC && shadowAt === null) shadowAt = +q.toFixed(4);
  }
  /* the ink separation that is a VERDICT, measured on the ramp's stops — see R-INK-SEPARATION */
  let minInkStops = 9;
  for (const s of v.stops) for (const ink of inks) minInkStops = Math.min(minInkStops, dEok(s, ink));
  const settles = v.at(0) === gnd;
  const footprint = footprintOf(v.at, gnd);
  /* THE TWO FIGURES I-08B3.1-F2R ADDED. The area mean is what R-EVENT is on; the tail is what
     R-CONTINUOUS is on. Both are computed for every variant of every family, so the record shows
     what the rejected families scored on them too rather than only the winner. */
  /* EVERY CATEGORY'S OWN FIGURE COMES BACK WITH THE BINDING ONE, from a single pass. The defect this
     replaced was invisible precisely because one number was reported where three exist, and the one
     reported was the highest of them. */
  const binding = bindingAreaMean(v.at, gnd);
  const areaMeanC = binding.mean;
  const areaMeanGray = areaMeanOf(v.at, gnd, true);
  const areaMeanByCategory = binding.byCategory;
  const tailAtOneStep = dEok(v.at(1 / 256), gnd);
  const stopC = v.stops.map((s) => lch(s)[1]);
  /* MEASURED ON THE RECOVERED HUE OF THE HEX THAT SHIPS, not on the hue that was authored. The
     two differ by up to a degree and a half at these chroma magnitudes, and a requirement checked
     against the authored value is a requirement checked against a number nobody will ever see. */
  const hueDrift = Math.max(...v.stops.map((s) => {
    const Hg = lch(s)[2];
    if (Number.isNaN(Hg)) return 999;
    const d = Math.abs(Hg - darkHue) % 360;
    return d > 180 ? 360 - d : d;
  }));
  /* THE DRIFT THE CROSS-APPEARANCE CONTRACT ACTUALLY CHECKS — each light stop against ITS OWN dark
     counterpart, not all three against the dark core. I-08B3.1-F2 broke ties on the proximity of
     the AUTHORED hue to the dark core's, which is neither the quantity X-03 measures nor measured
     on the hex that ships; it cost 1.6 degrees of drift on the LOW rung for nothing. */
  const darkStops = [DARK.CORE, DARK.MID, DARK.LOW];
  const perRungDrift = v.stops.map((s, i) => {
    const a = lch(s)[2], b = lch(darkStops[i])[2];
    if (Number.isNaN(a) || Number.isNaN(b)) return 999;
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  });
  /* SUMMED, NOT MAXIMISED, AND THE DIFFERENCE IS NOT ACADEMIC. Broken on the worst rung, the
     tie-break traded a CORE sitting EXACTLY on the dark core's hue for 0.05 degrees on the LOW
     rung — where the recovered hue is dominated by the 8-bit grid at that lightness and 0.05 is
     noise. The tolerance is a maximum and stays a maximum; what the tie-break should prefer is the
     ramp that moves LEAST IN TOTAL. */
  const roleHueDrift = perRungDrift.reduce((a, b) => a + b, 0);
  const roleHueDriftWorst = Math.max(...perRungDrift);
  /* THE QUANTITIES R-SOURCE-DOMINANCE IS ON — see the requirement below for why the bound is on the
     STOPS and not on the composite. `dipOverRise` is REPORTED AND NOT BOUNDED, deliberately: it is
     the number that describes the difference a reader sees between the two floors, and no
     non-arbitrary threshold for it was found. Reporting a quantity without a bound is honest;
     inventing a bound to fit two samples is not. */
  const minStopLightness = Math.min(...v.stops.map((s) => lch(s)[0]));
  const suppressedLightness = lch(suppressedWorld)[0];
  const pass = {
    /* MEASURED RUNG AGAINST ITS OWN DARK COUNTERPART — the quantity check X-03 applies and the one
       qandeel.appearance.hue-constancy is written about. The search used to compare all three stops
       to the dark CORE's hue, which is a WEAKER test: a ramp can sit within 3 degrees of one dark
       value while its third rung is 3.78 from the dark value it is the counterpart of. That is not
       a hypothetical — it is what the ratio-preserving floor returned, and the search called it
       admissible while the cross-appearance map would have failed it. The drift against the core is
       kept as reported information. */
    'R-HUE': roleHueDriftWorst <= ADOPTED.HUE_TOLERANCE_DEG,
    'R-SEPARATION': minBrass >= ADOPTED.SEPARATION_FLOOR,
    'R-INK-SEPARATION': minInkStops >= ADOPTED.SEPARATION_FLOOR,
    /* MEASURED ON THE AREA MEAN TOO, for the same reason R-EVENT is: "it survives without colour"
       has to mean the REGION survives, not that one pixel of it does. */
    'R-GRAYSCALE': areaMeanGray >= ADOPTED.SEPARATION_FLOOR,
    'R-NOT-SHADOW': shadowAt === null,
    'R-CONTINUOUS': tailAtOneStep < ADOPTED.JND_DEOK,
    /* R-SOURCE and R-EVENT ARE DIFFERENT CLAIMS AND THEY HAD ONE FLOOR BETWEEN THEM, WHICH MADE
       THE WHOLE SEARCH EMPTY. "There is a light here" only has to be VISIBLE — a just-noticeable
       step. "This is a meaning event" has to be SIGNIFICANT — the reading ramp's own smallest
       step. Sharing the larger floor asked the source to carry the entire event's magnitude on a
       ground that has no room for it, and nothing passed. */
    'R-SOURCE': risePeak > ADOPTED.JND_DEOK,
    'R-SETTLE': settles,
    /* THE LIGHT FAMILY'S BAND SITS STRICTLY BETWEEN THE ATMOSPHERE AND THE MATERIAL — and the
       second clause is the one that is easy to miss. I-08B3.1-D2R DERIVES the atmosphere's
       chroma ceiling as 0.62 x the least chromatic Light stop, precisely so the rule survives the
       Light being re-chosen. F2 re-chooses the Light, so a Light that is too quiet drags the
       atmosphere ceiling down THROUGH the reading ramp and inverts two rungs of the ladder
       without touching either of them. The Light therefore has to carry enough chroma to hold
       the atmosphere up above the ink. */
    'R-ORDER': Math.max(...stopC) < lch(brassHex)[1]
      && Math.min(...stopC) > atmoCeiling
      && 0.62 * Math.min(...stopC) > Math.max(...inks.map((i) => lch(i)[1])),
    'R-EVENT': areaMeanC > eventFloor,
    /**
     * R-SOURCE-DOMINANCE — A MEANING EVENT MAY NOT BE DARKER THAN THE WORLD'S OWN SUPPRESSION.
     *
     * THIS IS THE CHECK I-08B3.1-F2R ADDED BECAUSE IT WAS MISSING, AND THE WAY IT WAS FOUND IS
     * part of what it is for. The ratio-preserving floor (see RATIO_PRESERVING_FLOOR) produced a
     * configuration that satisfied EVERY requirement stated above — hue drift 1.6 degrees inside a
     * 3 degree tolerance, the chroma ladder preserved, every separation clear, a clean settle — and
     * rendered as an opaque brown-grey sphere sitting on a near-white World. A configuration that
     * passes every check and fails on sight means a check is missing; it does not mean the eye is
     * wrong.
     *
     * THE BOUND IS NOT A TASTE, IT IS THIS APPEARANCE'S OWN FROZEN STATEMENT OF SUPPRESSION. The
     * passage scrim is what QANDEEL paints over a region it is pushing behind something else —
     * qandeel.appearance.passage-is-suppressed — and on this ground it composites to L 0.5423. An
     * event that means "QANDEEL UNDERSTOOD" may not be darker than the veil that means "not this,
     * not now". The rejected configuration's deepest stop is darker than that. Nothing about the
     * bound was chosen here; it falls out of an alpha solved in scrimFor() against the dark
     * appearance's suppression factor.
     *
     * AND IT IS MEASURED ON THE STOPS, WHICH IS THE SOUND PLACE AND NOT THE CONVENIENT ONE. The
     * composite is a convex blend of a stop with a backdrop no darker than the ground, so its
     * lightness is bounded below by the deepest stop: if every stop is lighter than the scrim then
     * EVERY PAINTED PIXEL of the event is. Measured on the composite instead, the test does not
     * separate the two floors at all — the rejected configuration's darkest pixel lands near
     * L 0.583, above the scrim, because a partial glaze never reaches its own stop. A bound on the
     * composite would be a bound on this frame; a bound on the stops is a bound on the expression.
     * R-INK-SEPARATION is on the stops for the same reason and says so.
     */
    'R-SOURCE-DOMINANCE': minStopLightness > suppressedLightness,
    /* NON-EXCEEDING, not matching. The requirement's own words are that an alternate appearance
       may not make a meaning event cover MORE of the world than its counterpart does; a tighter
       light is not a worse light, and the first version's two-sided test rejected every
       configuration for being too contained. */
    'R-FOOTPRINT': footprint <= darkRef.footprint + ADOPTED.FOOTPRINT_TOLERANCE,
  };
  return {
    footprint, footprintDeltaFromDark: +(footprint - darkRef.footprint).toFixed(3),
    eventPeakDeltaFromDark: +(eventPeak - darkRef.eventPeak).toFixed(4),
    areaMean: +areaMeanC.toFixed(4), areaMeanGray: +areaMeanGray.toFixed(4),
    areaMeanBindsAt: binding.level, areaMeanBindsOn: binding.category, areaMeanByCategory,
    areaMeanOverDark: +(areaMeanC / darkRef.areaMean).toFixed(4),
    tailAtOneStep: +tailAtOneStep.toFixed(4),
    hue: v.H, hueDriftFromDarkLight: +hueDrift.toFixed(2),
    stopHueDriftVsDarkStops: +roleHueDrift.toFixed(2), stopHueDriftWorstRung: +roleHueDriftWorst.toFixed(2),
    perRungHueDriftVsDark: perRungDrift.map((x) => +x.toFixed(2)),
    chroma: v.C, stops: v.stops, parts: v.parts ?? null,
    shape: { glazeDrop: v.glazeDrop ?? null, split: v.split ?? null, width: v.width ?? null, drop: v.drop ?? null },
    eventPeak: +eventPeak.toFixed(4), risePeak: +risePeak.toFixed(4), dipPeak: +dipPeak.toFixed(4),
    grayPeak: +grayPeak.toFixed(4),
    minStopLightness: +minStopLightness.toFixed(4),
    suppressedWorldLightness: +suppressedLightness.toFixed(4),
    lightnessAboveSuppression: +(minStopLightness - suppressedLightness).toFixed(4),
    /* REPORTED, NOT BOUNDED. The dark appearance's event is pure brightening, so its dip/rise is 0;
       on a ground at L 0.95 a source can rise by at most about dEok 0.021 and a perceivable light
       event MUST borrow magnitude from darkening. How much it may borrow is what R-SOURCE-DOMINANCE
       answers, through the scrim, rather than through a ratio nobody can derive a threshold for. */
    dipOverRise: risePeak > 0 ? +(dipPeak / risePeak).toFixed(2) : null,
    minDEokToBrass: +minBrass.toFixed(4),
    minDEokStopsToInk: +minInkStops.toFixed(4),
    minDEokPathToInk: +minInk.toFixed(4),
    minDEokToError: +minError.toFixed(4),
    stopChroma: stopC.map((c) => +c.toFixed(4)), settlesToGround: settles, becomesShadowAt: shadowAt,
    pass, admissible: Object.values(pass).every(Boolean),
  };
}

/**
 * A family's BEST ADMISSIBLE configuration, and — when none is admissible — its best attempt and
 * exactly which requirement stopped it. The second half matters as much as the first: "this
 * family fails" is worth nothing without "and here is the requirement it could not meet on its
 * own best day".
 *
 * Ties on the event are broken by hue proximity to the frozen dark Light, which is D2R's rule:
 * move the smallest distance the requirement forces.
 */
function bestOfFamily(key, name, variants, g, brassHex, errorHex, inks, eventFloor, atmoCeiling, darkHue, darkRef, suppressedWorld, ratioFloor = null) {
  const measured = variants.map((v) => measureVariant(v, g, brassHex, errorHex, inks, eventFloor, atmoCeiling, darkHue, darkRef, suppressedWorld));
  /* THE RATIO-PRESERVING FLOOR, MEASURED ON THIS FAMILY'S OWN GRID rather than argued about. See
     RATIO_PRESERVING_FLOOR: the question is not whether that floor is reachable — it is — but what
     a configuration has to become to reach it. */
  const ratio = (() => {
    if (!ratioFloor) return null;
    const above = measured.filter((m) => m.areaMean > ratioFloor);
    if (!above.length) return { floor: +ratioFloor.toFixed(4), countAbove: 0, reachable: false };
    const byInk = above.slice().sort((a, b) => b.minDEokPathToInk - a.minDEokPathToInk)[0];
    /* WHAT EVERY CONFIGURATION THAT REACHES THE RATIO FLOOR HAS TO GIVE UP. Reported as the set of
       requirements NONE of them can satisfy, so "the ratio is not attainable" arrives with the
       name of the thing it would have cost instead of as a verdict. */
    const blocking = {};
    for (const m of above) for (const [r, v] of Object.entries(m.pass)) if (!v) blocking[r] = (blocking[r] ?? 0) + 1;
    const admissibleAbove = above.filter((m) => m.admissible);
    return {
      floor: +ratioFloor.toFixed(4), countAbove: above.length, reachable: true,
      admissibleAtThatFloor: admissibleAbove.length,
      maxAreaMean: +Math.max(...above.map((m) => m.areaMean)).toFixed(4),
      failedByEveryConfigurationAboveIt: Object.entries(blocking).filter(([, n]) => n === above.length).map(([r]) => r),
      bestSeparationFromInkAmongThem: byInk.minDEokPathToInk,
      itsGlaze: byInk.stops[2], itsGlazeLightness: +lch(byInk.stops[2])[0].toFixed(4),
      itsWorstRungHueDrift: byInk.stopHueDriftWorstRung,
      /* WHAT REACHING THE RATIO FLOOR COSTS, IN THE UNIT THE MISSING CHECK IS IN. Before
         R-SOURCE-DOMINANCE existed this block reported a configuration that broke nothing; it now
         reports the requirement it breaks, which is the whole difference between a gap that is
         disclosed and a gap that is understood. */
      itsMinStopLightness: byInk.minStopLightness,
      suppressedWorldLightness: byInk.suppressedWorldLightness,
      itsDipOverRise: byInk.dipOverRise,
      darkerThanTheWorldsOwnSuppression: byInk.minStopLightness <= byInk.suppressedWorldLightness,
      countDarkerThanSuppression: above.filter((m) => m.minStopLightness <= m.suppressedWorldLightness).length,
      hueTolerance: ADOPTED.HUE_TOLERANCE_DEG,
      tertiaryInkLightness: +lch(inks[2])[0].toFixed(4),
      primaryInkLightness: +lch(inks[0])[0].toFixed(4),
      clearsTheSeparationFloor: byInk.minDEokPathToInk >= ADOPTED.SEPARATION_FLOOR,
    };
  })();
  /**
   * THE MILDEST EXTREME — see SELECTION_RULE. The floor makes the event read; this takes the least
   * departure the floor forces.
   *
   * THE MAGNITUDE OBJECTIVE IS QUANTISED TO A JUST-NOTICEABLE STEP, AND THAT IS NOT A CONVENIENCE.
   * Compared at full float precision, a difference of 0.0001 in the event's peak departure — a
   * fortieth of the smallest difference anyone can see — outranked TWO DEGREES of hue drift away
   * from the value each rung is the cross-appearance counterpart of. It did exactly that: the run
   * that first met the corrected floor returned a ramp 2.85 degrees from the dark stops where the
   * feasible set contained one under 0.7, and the only thing that bought those two degrees was an
   * imperceptible sliver of magnitude. **An objective compared below its own perceptual resolution
   * is not measuring a preference about the picture, it is ordering numerical noise.** So
   * configurations whose peak departures differ by less than ADOPTED.JND_DEOK are treated as equal
   * on magnitude, and the cross-appearance contract decides between them. The bound is the JND
   * itself rather than a fraction of it, because that is the number this package already owns for
   * "a difference a reader can see".
   *
   * The order after that: (2) the least TOTAL hue drift AGAINST THE DARK STOPS, each rung against
   * its own counterpart, measured on the recovered hue of the hex that ships, which is the quantity
   * check X-03 and qandeel.appearance.hue-constancy are about; (3) the shallowest third rung, so the
   * Meaning Light's own authored value stays as near its ground as the requirement allows; (4) the
   * exact peak, which now only separates configurations the first key called equal; (5) the least
   * extent; (6) the least shape.
   */
  const magnitudeBucket = (m) => Math.floor(m.eventPeak / ADOPTED.JND_DEOK);
  const ok = measured.filter((m) => m.admissible)
    .sort((a, b) => (magnitudeBucket(a) - magnitudeBucket(b))
      || (a.stopHueDriftVsDarkStops - b.stopHueDriftVsDarkStops)
      || ((a.shape.glazeDrop ?? 0) - (b.shape.glazeDrop ?? 0))
      || (a.eventPeak - b.eventPeak)
      || (a.footprint - b.footprint)
      || ((a.shape.width ?? 0) - (b.shape.width ?? 0)));
  if (ok.length) {
    /**
     * THE SELECTION RULE AUDITS ITSELF, BECAUSE IT IS THE PART OF THIS DERIVATION THAT HAS BEEN
     * WRONG THREE TIMES.
     *
     * "The largest admissible event" ran to a bound. "Closest to the dark appearance's peak" was the
     * same runaway objective in better words. And comparing magnitude at full float precision let a
     * fortieth of a just-noticeable step outrank two degrees of cross-appearance hue drift. All three
     * produced a correct number and the wrong answer, and none of them could be caught by checking
     * the winner alone — you have to see what it was chosen OVER.
     *
     * So the record carries the shape of the decision: how many configurations shared the winner's
     * magnitude bucket, and what the best and worst hue drift among them was. Check X-03 asserts that
     * the shipped drift IS the best of them, which is the only way to test that the rule stated in
     * SELECTION_RULE is the rule that ran.
     */
    const winnerBucket = magnitudeBucket(ok[0]);
    const inBucket = ok.filter((m) => magnitudeBucket(m) === winnerBucket);
    const selectionAudit = {
      rule: SELECTION_RULE,
      magnitudeBucketWidth: ADOPTED.JND_DEOK,
      configurationsSharingTheWinnersMagnitude: inBucket.length,
      totalHueDriftAmongThem: {
        chosen: ok[0].stopHueDriftVsDarkStops,
        best: +Math.min(...inBucket.map((m) => m.stopHueDriftVsDarkStops)).toFixed(2),
        worst: +Math.max(...inBucket.map((m) => m.stopHueDriftVsDarkStops)).toFixed(2),
      },
      /* THE CLAIM A CHECK CAN TEST: nothing was paid in role identity for magnitude nobody can see. */
      hueDriftWasNotBoughtWithImperceptibleMagnitude:
        ok[0].stopHueDriftVsDarkStops <= +Math.min(...inBucket.map((m) => m.stopHueDriftVsDarkStops)).toFixed(2) + 1e-9,
      /* AND WHAT THE UNQUANTISED OBJECTIVE WOULD HAVE PICKED, so the difference the quantisation
         makes is in the record as a measurement rather than as an argument. */
      whatTheUnquantisedObjectiveWouldHaveChosen: (() => {
        const raw = measured.filter((m) => m.admissible)
          .sort((a, b) => (a.eventPeak - b.eventPeak) || (a.stopHueDriftVsDarkStops - b.stopHueDriftVsDarkStops))[0];
        return { stops: raw.stops, eventPeak: raw.eventPeak, totalHueDrift: raw.stopHueDriftVsDarkStops, worstRungHueDrift: raw.stopHueDriftWorstRung };
      })(),
      /**
       * AND WHY THE DRIFT IS NOT SMALLER, WITH THE NAME OF THE REQUIREMENT THAT STOPS IT.
       *
       * "This is the least drift available" is a bound. "And here is what a smaller one costs" is an
       * explanation, and this package holds itself to the second everywhere else — the
       * ratioPreserving block above does exactly this for the event floor. Without it a reader has no
       * way to tell a tolerance spent carelessly from a tolerance spent by arithmetic.
       *
       * The answer on the light ground is the sRGB GAMUT BOUNDARY, and it is worth stating plainly:
       * the ramps whose third rung sits on its dark counterpart's hue need MORE CHROMA, and at a
       * fixed hue more chroma lowers the lightness sRGB can still hold — so the flooded core comes
       * down with it and stops rising above the ground by a just-noticeable step. R-HUE and R-SOURCE
       * pull against each other through the gamut, and the gamut is not negotiable.
       */
      whatASmallerDriftWouldCost: (() => {
        const inBucketAll = measured.filter((m) => Math.floor(m.eventPeak / ADOPTED.JND_DEOK) === winnerBucket);
        const better = inBucketAll.filter((m) => m.stopHueDriftVsDarkStops < ok[0].stopHueDriftVsDarkStops);
        if (!better.length) {
          return { note: 'nothing in this magnitude bucket carries less total hue drift than the shipped ramp, admissible or not — the drift is the grid\'s own minimum here' };
        }
        const best = better.slice().sort((a, b) => a.stopHueDriftVsDarkStops - b.stopHueDriftVsDarkStops)[0];
        const blocking = {};
        for (const m of better) for (const [r, v] of Object.entries(m.pass)) if (!v) blocking[r] = (blocking[r] ?? 0) + 1;
        return {
          configurationsWithLessDrift: better.length,
          admissibleAmongThem: better.filter((m) => m.admissible).length,
          leastDriftAvailable: best.stopHueDriftVsDarkStops,
          itsStops: best.stops,
          itsChroma: best.chroma,
          itsRise: best.risePeak,
          riseFloor: ADOPTED.JND_DEOK,
          failedByEveryConfigurationWithLessDrift: Object.entries(blocking).filter(([, n]) => n === better.length).map(([r]) => r),
          failureCounts: blocking,
        };
      })(),
    };
    return {
      key, name, admissible: true, variantsTried: measured.length, admissibleVariants: ok.length,
      ...ok[0],
      selectionAudit,
      /* THE SHAPE OF THE FEASIBLE SET, not only its winner. Almost everything admissible sits on
         one contour just above the floor, and that fact is more informative than the hex. */
      feasibleAreaMeanRange: [Math.min(...ok.map((m) => m.areaMean)), Math.max(...ok.map((m) => m.areaMean))],
      feasibleEventPeakRange: [Math.min(...ok.map((m) => m.eventPeak)), Math.max(...ok.map((m) => m.eventPeak))],
      ratioPreserving: ratio,
    };
  }
  const near = measured.slice().sort((a, b) => b.areaMean - a.areaMean)[0];
  const blocking = {};
  for (const m of measured) for (const [r, v] of Object.entries(m.pass)) if (!v) blocking[r] = (blocking[r] ?? 0) + 1;
  return {
    key, name, admissible: false, variantsTried: measured.length, admissibleVariants: 0,
    ...near,
    bestAttemptIs: 'the largest area mean this family reaches — its best day, so "it fails" is reported against its strongest configuration rather than an average one',
    failedOnEveryVariant: Object.entries(blocking).filter(([, n]) => n === measured.length).map(([r]) => r),
    failureCounts: blocking,
    ratioPreserving: ratio,
  };
}

/**
 * THE DARK EVENT, MEASURED ONCE, AS THE THING THE LIGHT EVENT IS A COUNTERPART OF.
 *
 * Every parity figure in Part C is relative to these two numbers, and they are computed from the
 * frozen dark values through the same profile arithmetic the renderer uses — not quoted from
 * I-08B3.1-D2R's documentation, and not typed.
 */
const darkAt = (n) => over(DARK.CORE, Math.max(0, Math.min(1, n)) * WASH_OPACITY, DARK.WORLD);
export const DARK_EVENT = Object.freeze({
  eventPeak: +Math.max(...QS.map((n) => dEok(darkAt(n), DARK.WORLD))).toFixed(4),
  grayPeak: +Math.max(...QS.map((n) => dEok(grayOf(darkAt(n)), grayOf(DARK.WORLD)))).toFixed(4),
  areaMean: +areaMeanOf(darkAt, DARK.WORLD).toFixed(4),
  areaMeanGray: +areaMeanOf(darkAt, DARK.WORLD, true).toFixed(4),
  footprint: footprintOf(darkAt, DARK.WORLD),
  technique: 'additive-over-ground',
});

/**
 * THE RATIO-PRESERVING FLOOR, TESTED AND REJECTED — WITH THE NUMBER THAT REJECTED IT.
 *
 * This package's governing principle everywhere else is that what transfers between appearances is
 * the RELATIONSHIP and not the value: the reading inks preserve ratios, the atmosphere preserves
 * its contour contrast, the scrim preserves its suppression factor. Applied to the meaning event
 * the principle says the light event should stand to the LIGHT reading ramp as the dark event
 * stands to the DARK one. Measured, the dark event's area mean is a little over two and a half times
 * the dark appearance's own smallest reading step; DARK_EVENT_IN_READING_STEPS is the figure, and
 * the floor it implies for the light appearance is computed per ground rather than quoted here.
 *
 * IT IS REACHABLE, IT WAS DERIVED IN FULL, IT WAS RENDERED, AND IT WAS REJECTED ON WHAT IT LOOKED
 * LIKE. This is the opposite of what an earlier draft of this comment said, and the correction is
 * worth more than the conclusion. With the floor raised, the search returns a complete, admissible
 * expression: hue drift well inside the 3 degree tolerance, the chroma ladder preserved, every
 * separation clear, a clean settle. It satisfied every requirement this file stated at the time.
 * Rendered at CONNECTION's own peak it is an opaque brown-grey sphere sitting on a near-white
 * World — a stain, which section 1 of the F2R brief forbids by name.
 *
 * SO THE FINDING IS NOT "THE RATIO IS UNREACHABLE". IT IS "A CHECK WAS MISSING." A configuration
 * that passes every check and fails on sight is evidence about the checks, not about the eye. The
 * missing one is R-SOURCE-DOMINANCE, written after this was rendered: the rejected expression's
 * deepest stop is DARKER than this appearance's own passage scrim — the meaning event would have
 * been deeper than the veil the World draws over what it is suppressing. The ratio floor is now
 * rejected BY A REQUIREMENT rather than by a judgement, and the requirement is stated in terms of a
 * frozen value rather than a taste. `chosen.ratioFloorCost` carries the figures from the run.
 *
 * THE GAP THAT REMAINS IS STILL REAL AND IS STILL REPORTED, and F2_CONTRADICTIONS carries it as a
 * genuine contradiction. What has changed is that the package can now say WHY the gap may not be
 * closed on this ground instead of only that it was not: closing it requires an event darker than
 * the World's own suppression, and on a ground at L 0.9491 there is no other place for the
 * magnitude to come from.
 *
 * `derive()` fills the numbers in, on the grid that actually ran, rather than quoting these.
 */
/** The dark event's area mean as a multiple of the DARK appearance's own smallest reading step.
 *  Both sides measured at the level the quietest category actually reaches, so the multiple is
 *  about what the Product paints rather than about the top of a normalised axis. */
export const DARK_READING_STEP = Math.min(dEok(DARK.PRIMARY, DARK.SECONDARY), dEok(DARK.SECONDARY, DARK.TERTIARY));
export const DARK_EVENT_IN_READING_STEPS = +(DARK_EVENT.areaMean / DARK_READING_STEP).toFixed(3);

export const RATIO_PRESERVING_FLOOR = Object.freeze({
  whatItIs: "the dark event's area mean as a multiple of the DARK appearance's own smallest reading step, applied to the LIGHT one — the transfer this package uses for the reading ramp, the atmosphere and the scrim",
  whyItIsNotTheFloor: "it is reachable, and what reaches it is darker than this appearance's own passage scrim, so the event that means 'QANDEEL understood' would be deeper than the veil that means 'this is suppressed'. R-SOURCE-DOMINANCE rejects it. The numbers are in chosen.ratioFloorCost, measured on the grid that actually ran — they are NOT repeated here, because a figure typed into a paragraph beside the run that produces it is the class of defect consistency claim C7 exists to catch and this file has already shipped once.",
  howItWasFound: "it was derived, rendered and looked at. It passed every requirement stated at the time and read as an opaque brown-grey sphere on a near-white World. The check came second, from the render — which is the honest order to admit, because the alternative is a package whose checks only ever confirm what it already did.",
  whatIsStillOpen: "the magnitude gap itself — see magnitudeInReadingSteps, and F2_CONTRADICTIONS.md, which carries it as a contradiction rather than closing it.",
});

/* ================================================================ THE DERIVATION ============= */
export function derive() {
  /* --- the dark ladder, measured, so the light one can be compared to something real --- */
  const darkLadder = Object.entries(DARK)
    .filter(([k]) => !k.startsWith('SCRIM'))
    .map(([k, v]) => ({ role: k, hex: v, L: +lch(v)[0].toFixed(4), C: +lch(v)[1].toFixed(4), H: Number.isNaN(lch(v)[2]) ? null : +lch(v)[2].toFixed(1) }))
    .sort((a, b) => b.C - a.C);

  /* --- the not-an-inversion table --- */
  const invertedWouldHaveBeen = Object.entries(DARK).filter(([k]) => !k.startsWith('SCRIM')).map(([k, v]) => {
    const i = invert(v), a = lch(v), b = lch(i);
    const dh = Number.isNaN(a[2]) || Number.isNaN(b[2]) ? null : (() => { const d = Math.abs(b[2] - a[2]) % 360; return +(d > 180 ? 360 - d : d).toFixed(1); })();
    return { role: k, dark: v, inverted: i, darkHue: Number.isNaN(a[2]) ? null : +a[2].toFixed(1), invertedHue: Number.isNaN(b[2]) ? null : +b[2].toFixed(1), hueRotation: dh };
  });

  /* --- the LIGHT WORLD sweep. Every dependent role is re-derived at every candidate, because a
         ground chosen first and checked afterwards is a ground nothing could have rejected. --- */
  const band = Math.min(...[DARK.CORE, DARK.MID, DARK.LOW].map((h) => lch(h)[1])); // the Light's own chroma floor
  const sweep = [];
  for (let Lw = 0.880; Lw <= 0.985; Lw += 0.005) {
    const g = ground(+Lw.toFixed(3));
    /* R-HUE binds the GROUND too. A world whose quantised hex recovers a hue the token file did
       not author is a ground nobody chose, and at these chroma magnitudes that is a live risk
       rather than a theoretical one. */
    if (!g || !g.surface || g.worldHueDrift > ADOPTED.HUE_TOLERANCE_DEG || g.surfaceHueDrift > ADOPTED.HUE_TOLERANCE_DEG) continue;

    /* the reading ramp: ratio parity, exactly */
    /* THE READING RAMP IS SOLVED IN ORDER, UNDER A RUNNING CHROMA CAP. Solved independently, the
       three rungs come back in a different chroma order than they went in — the quantised hex for
       SECONDARY can recover a higher chroma than PRIMARY's, because the rungs are 0.002 apart and
       the 8-bit grid is coarser than that at these lightnesses. The ladder is the contract, so
       each rung is capped by the one above it. */
    let cap = Infinity;
    const inks = ['PRIMARY', 'SECONDARY', 'TERTIARY'].map((role) => {
      const ratio = contrastHex(DARK[role], DARK.WORLD);
      const hit = solveRole(DARK[role], g.world, ratio, { chromaCap: cap });
      if (hit) cap = hit.chroma - 0.0001;
      return { role, darkRatio: +ratio.toFixed(4), hex: hit?.hex ?? null, lightRatio: hit?.ratio ?? null, chroma: hit?.chroma ?? null, hueDrift: hit?.hueDrift ?? null, L: hit?.L ?? null };
    });
    if (inks.some((i) => !i.hex)) continue;

    /* brass and error: meet the ink floor, then stay as close to the frozen value as possible */
    const brass = closestMeetingFloor(DARK.BRASS, g, lch(DARK.BRASS)[2], lch(DARK.BRASS)[1]);
    const error = closestMeetingFloor(DARK.ERROR, g, lch(DARK.ERROR)[2], lch(DARK.ERROR)[1]);
    if (!brass || !error) continue;

    /* the atmosphere: the contour's contrast against its own ground, preserved */
    const atmo = atmosphere(g);

    /* THE EVENT FLOOR IS THIS APPEARANCE'S OWN SMALLEST READING STEP — the least difference the
       Product asks a reader to take as meaning something, measured in the environment being
       judged and on the values that actually ship there. */
    const readingStep = Math.min(
      dEok(inks[0].hex, inks[1].hex),
      dEok(inks[1].hex, inks[2].hex),
    );
    /**
     * THE FLOOR IS THE STEP. THE RATIO IS MEASURED ANYWAY — see RATIO_PRESERVING_FLOOR.
     *
     * The requirement the Product would state is the one this package states everywhere else: what
     * transfers between appearances is the RELATIONSHIP, so the light event should stand to the
     * LIGHT reading ramp as the dark event stands to the DARK one. That floor was derived in full,
     * rendered, and rejected: what reaches it is darker than this appearance's own passage scrim.
     * The shipped floor is therefore the absolute one — this appearance's own smallest reading
     * step — and the ratio floor is still computed at every ground so the rejected alternative is
     * reported with its own numbers rather than described.
     *
     * There is no switch here any more. An earlier revision read the floor from the environment so
     * that both answers could be derived and looked at; a derivation whose answer depends on an
     * environment variable is not a derivation, and the experiment is over.
     */
    const ratioFloor = DARK_EVENT_IN_READING_STEPS * readingStep;
    /* THE WORLD UNDER ITS OWN SUPPRESSION — the bound R-SOURCE-DOMINANCE is against. Derived here,
       per ground, by the same function that derives the shipped scrim, from an alpha solved against
       the DARK appearance's suppression factor. It depends on the ground and the primary ink, both
       fixed before the Light is chosen, so there is no circularity in using it to choose the Light. */
    const suppressedWorld = scrimFor({ world: g.world, inks }).suppressed;
    const brassC = lch(brass.hex)[1];
    const darkLightHue = lch(DARK.CORE)[2];
    /* THE ORDERING LOWER BOUND IS D2R's OWN CEILING, USED AS A STAND-IN, AND THE CIRCULARITY IS
       BROKEN DELIBERATELY. The light atmosphere ceiling is DERIVED FROM the light Light, so it
       cannot also be a constraint on choosing it. The dark ceiling is used during the search and
       the real one is re-derived from the winner afterwards; `atmosphereCeilingLight` below
       re-checks the ordering on the value that actually ships. */
    /* PASS 1 — one question per ground: does ANY admissible expression exist here? All four
       families, coarse grid. */
    const variantsFor = FAMILIES.map(([key, name, mk]) => [key, name, mk(g, band, brassC, true)]);
    const runAt = (floor) => variantsFor.map(([key, name, vs]) =>
      bestOfFamily(key, name, vs, g, brass.hex, error.hex, inks.map((i) => i.hex),
        floor, ATMOSPHERE.chromaCeiling, darkLightHue, DARK_EVENT, suppressedWorld, ratioFloor));
    const fams = runAt(readingStep);
    const eventFloor = readingStep;
    /* THE SAME RULE BETWEEN FAMILIES AS WITHIN ONE. The earlier version sorted families by
       "closest to the dark appearance's event peak" — the objective this file's own SELECTION_RULE
       records as a runaway maximum in better words — and it survived only because exactly one
       family is ever admissible. A rule that is stated in one place and contradicted in another is
       not a rule. */
    const admissible = fams.filter((x) => x.admissible).sort((a, b) =>
      (Math.floor(a.eventPeak / ADOPTED.JND_DEOK) - Math.floor(b.eventPeak / ADOPTED.JND_DEOK))
      || (a.stopHueDriftVsDarkStops - b.stopHueDriftVsDarkStops));

    sweep.push({ Lw: g.Lw, world: g.world, surface: g.surface, eventFloor: +eventFloor.toFixed(4), readingStep, ratioFloor: +ratioFloor.toFixed(4), suppressedWorld, inks, brass, error, atmo, families: fams, brassC, darkLightHue, band, winner: admissible[0]?.key ?? null, winnerEventPeak: admissible[0]?.eventPeak ?? null });
  }

  /* SELECTION. Stated before the numbers: among candidates where an admissible family exists,
     take the HIGHEST lightness — a light World darker than its own requirements force is a dim
     appearance wearing a light name. */
  const viable = sweep.filter((s) => s.winner !== null);
  const chosen = viable.length ? viable[viable.length - 1] : null;
  /* WHAT STOPPED THE GROUND GOING LIGHTER. Reported rather than inferred: the selection rule is
     "take the highest", so the interesting fact is the first candidate above it that failed and
     the requirement that failed there. */
  const firstRejectedAbove = chosen ? sweep.find((s) => s.Lw > chosen.Lw && s.winner === null) : null;

  /* PASS 2 — the FULL grid, all four families, at the ground Pass 1 chose. This is the comparison
     the package reports, and it replaces Pass 1's coarse result at the chosen ground. */
  if (chosen) {
    /* THE RATIO-PRESERVING FLOOR FOR THIS GROUND: the dark event's area mean expressed as a
       multiple of the DARK appearance's own smallest reading step, applied to the LIGHT one. */
    chosen.darkEventOverDarkReadingStep = DARK_EVENT_IN_READING_STEPS;
    chosen.readingStep = +chosen.readingStep.toFixed(4);
    chosen.ratioPreservingFloor = +(DARK_EVENT_IN_READING_STEPS * chosen.readingStep).toFixed(4);
    /* THE FULL GRID IS RICHER THAN THE COARSE ONE, so the ratio floor is asked again here rather
       than inherited from Pass 1's answer: a floor that admits nothing on the coarse set may admit
       something on the full one, and deciding otherwise would let the coarse grid's resolution
       decide a Product question. */
    const vs = FAMILIES.map(([key, name, mk]) => [key, name, mk(chosen, chosen.band, chosen.brassC, false)]);
    const runFull = (floor) => vs.map(([key, name, list]) =>
      bestOfFamily(key, name, list, chosen, chosen.brass.hex, chosen.error.hex, chosen.inks.map((i) => i.hex),
        floor, ATMOSPHERE.chromaCeiling, chosen.darkLightHue, DARK_EVENT, chosen.suppressedWorld, chosen.ratioPreservingFloor));
    chosen.families = runFull(chosen.readingStep);
    chosen.eventFloor = chosen.readingStep;
    chosen.floorUsed = 'the light appearance\'s own smallest reading step';
    /* WHAT THE RATIO FLOOR COSTS, MEASURED ON THE FULL GRID rather than argued about: the best
       configuration that DOES reach it, and the requirement it breaks to get there. It is reported
       for the winning family because that is the family it would have been chosen from. */
    chosen.ratioFloorCost = chosen.families.find((x) => x.key === 'F-D')?.ratioPreserving ?? null;
    const adm = chosen.families.filter((x) => x.admissible).sort((a, b) =>
      (Math.floor(a.eventPeak / ADOPTED.JND_DEOK) - Math.floor(b.eventPeak / ADOPTED.JND_DEOK))
      || (a.stopHueDriftVsDarkStops - b.stopHueDriftVsDarkStops));
    chosen.winner = adm[0]?.key ?? null;
    chosen.winnerEventPeak = adm[0]?.eventPeak ?? null;
    chosen.winnerAreaMean = adm[0]?.areaMean ?? null;
  }
  /* A SEARCH THAT FINDS NOTHING MUST SAY WHY. Throwing here would leave a reviewer with an
     exception and no evidence; the sweep is the evidence, so it is returned either way and the
     caller decides what to do with an empty result. */
  const sweepSummary = sweep.map((s) => ({
    Lw: s.Lw, world: s.world, surface: s.surface, winner: s.winner, winnerEventPeak: s.winnerEventPeak,
    eventFloor: s.eventFloor, atmoStrongestContourDEok: s.atmo.strongestContourDEok,
    families: s.families.map((x) => ({
      key: x.key, eventPeak: x.eventPeak, areaMean: x.areaMean, areaMeanGray: x.areaMeanGray,
      tailAtOneStep: x.tailAtOneStep,
      risePeak: x.risePeak, dipPeak: x.dipPeak, grayPeak: x.grayPeak,
      minDEokToBrass: x.minDEokToBrass,
      minDEokStopsToInk: x.minDEokStopsToInk, minDEokPathToInk: x.minDEokPathToInk, becomesShadowAt: x.becomesShadowAt, admissible: x.admissible,
      admissibleVariants: x.admissibleVariants, variantsTried: x.variantsTried,
      failed: Object.entries(x.pass).filter(([, v]) => !v).map(([k]) => k),
      failedOnEveryVariant: x.failedOnEveryVariant ?? null,
    })),
  }));
  if (!chosen) return { generatedBy: 'tools/f2-derive.mjs', requirements: REQUIREMENTS, adopted: ADOPTED, sweep: sweepSummary, chosen: null, exhausted: true };

  const winningFamily = chosen.families.find((x) => x.key === chosen.winner);

  /* --- the remaining roles, at the chosen ground --- */
  const scrim = scrimFor(chosen);
  /* THE BOUND R-SOURCE-DOMINANCE USED AND THE SCRIM THAT SHIPS MUST BE THE SAME COMPOSITE. They are
     produced by the same function from the same ground, so this can only fire if someone gives the
     search a stand-in later — which is exactly when it should fire. */
  if (scrim.suppressed !== chosen.suppressedWorld) {
    throw new Error(`R-SOURCE-DOMINANCE was measured against ${chosen.suppressedWorld} but the scrim that ships composites to ${scrim.suppressed}`);
  }
  const states = interactionStates(chosen);
  const contrast = increasedContrast(chosen, chosen.atmo);

  const LIGHT = {
    WORLD: chosen.world,
    SURFACE: chosen.surface,
    PRIMARY: chosen.inks[0].hex,
    SECONDARY: chosen.inks[1].hex,
    TERTIARY: chosen.inks[2].hex,
    BRASS: chosen.brass.hex,
    CORE: winningFamily.stops[0],
    MID: winningFamily.stops[1],
    LOW: winningFamily.stops[2],
    ERROR: chosen.error.hex,
    DISABLED: states.disabled.hex,
    SCRIM_INK: scrim.ink,
    SCRIM_ALPHA: scrim.alpha,
  };

  const lightLadder = Object.entries(LIGHT).filter(([k]) => !k.startsWith('SCRIM'))
    .map(([k, v]) => ({ role: k, hex: v, L: +lch(v)[0].toFixed(4), C: +lch(v)[1].toFixed(4), H: Number.isNaN(lch(v)[2]) ? null : +lch(v)[2].toFixed(1) }))
    .sort((a, b) => b.C - a.C);

  /**
   * THE LADDER, CHECKED AS A LADDER OF ROLE FAMILIES.
   *
   * Comparing the eleven literals one by one cannot work and the first version of this check
   * proved it twice: in DARK, WORLD and SURFACE are both exactly achromatic, so their relative
   * position in a sorted list is an artefact of the sort and not a fact about the system. What
   * the contract actually says is that six BANDS stay in order, and that is what is measured —
   * every member of a band above every member of the next, in both appearances.
   */
  const atmoCeilingLight = +(0.62 * Math.min(...[LIGHT.CORE, LIGHT.MID, LIGHT.LOW].map((h) => lch(h)[1]))).toFixed(4);
  const bandsOf = (set, atmoC) => [
    ['ERROR', [lch(set.ERROR)[1]]],
    ['BRASS', [lch(set.BRASS)[1]]],
    ['LIGHT', [set.CORE, set.MID, set.LOW].map((h) => lch(h)[1])],
    ['ATMOSPHERE', [atmoC]],
    ['INK', [set.PRIMARY, set.SECONDARY, set.TERTIARY, set.DISABLED].map((h) => lch(h)[1])],
    ['GROUND', [set.WORLD, set.SURFACE].map((h) => lch(h)[1])],
  ].map(([name, cs]) => ({ band: name, min: +Math.min(...cs).toFixed(4), max: +Math.max(...cs).toFixed(4) }));
  const darkBands = bandsOf(DARK, ATMOSPHERE.chromaCeiling);
  const lightBands = bandsOf(LIGHT, atmoCeilingLight);
  const ladderHolds = (bands) => bands.every((b, i) => i === 0 || bands[i - 1].min > b.max);
  const orderPreserved = ladderHolds(darkBands) && ladderHolds(lightBands);
  const ladderBreaks = [darkBands, lightBands].map((bands, j) => bands
    .map((b, i) => (i > 0 && !(bands[i - 1].min > b.max) ? `${['dark', 'light'][j]}: ${bands[i - 1].band} min ${bands[i - 1].min} is not above ${b.band} max ${b.max}` : null))
    .filter(Boolean)).flat();
  const hueDrift = Object.keys(LIGHT).filter((k) => !k.startsWith('SCRIM')).map((k) => {
    const a = lch(DARK[k])[2], b = lch(LIGHT[k])[2];
    if (Number.isNaN(a) && Number.isNaN(b)) return { role: k, darkHue: null, lightHue: null, drift: null, achromaticInBoth: true };
    if (Number.isNaN(a) || Number.isNaN(b)) return { role: k, darkHue: Number.isNaN(a) ? null : +a.toFixed(1), lightHue: Number.isNaN(b) ? null : +b.toFixed(1), drift: null, achromaticInBoth: false };
    const d = Math.abs(b - a) % 360;
    return { role: k, darkHue: +a.toFixed(1), lightHue: +b.toFixed(1), drift: +(d > 180 ? 360 - d : d).toFixed(2), achromaticInBoth: false };
  });

  /* the cream the calibration note in the frontend-design skill names as an AI default, measured
     against rather than avoided by instinct */
  const AI_DEFAULT_CREAM = '#f4f1ea';

  return {
    generatedBy: 'tools/f2-derive.mjs',
    requirements: REQUIREMENTS,
    adopted: ADOPTED,
    selectionRule: SELECTION_RULE,
    darkEvent: DARK_EVENT,
    readingHue: READING_HUE,
    lightChromaBand: +band.toFixed(4),
    dark: DARK,
    darkState: DARK_STATE,
    darkLadder,
    invertedWouldHaveBeen,
    inversionMeanHueRotation: +(invertedWouldHaveBeen.filter((r) => r.hueRotation !== null).reduce((a, r) => a + r.hueRotation, 0) / invertedWouldHaveBeen.filter((r) => r.hueRotation !== null).length).toFixed(1),
    sweep: sweepSummary,
    /* HOW MUCH WAS ACTUALLY SEARCHED, counted rather than estimated — a figure quoted in three
       documents and a token file, and therefore a figure that has to come from the run. */
    searchSize: {
      groundsEvaluated: sweep.length,
      coarsePassConfigurationsPerGround: sweep.length ? sweep[0].families.reduce((a, f) => a + f.variantsTried, 0) : 0,
      coarsePassTotal: sweep.reduce((a, s) => a + s.families.reduce((b, f) => b + f.variantsTried, 0), 0),
      fullPassAtChosenGround: chosen ? chosen.families.reduce((a, f) => a + f.variantsTried, 0) : 0,
      byFamilyAtChosenGround: chosen ? Object.fromEntries(chosen.families.map((f) => [f.key, f.variantsTried])) : {},
    },
    /**
     * THE MAGNITUDE COMPARISON, IN THE ONE UNIT THAT IS COMPARABLE ACROSS TWO GROUNDS.
     *
     * A dEok on a near-black ground and a dEok on a near-white one are not the same currency —
     * that is the whole reason the light event is quieter — so the package also reports each
     * appearance's event as a MULTIPLE OF ITS OWN SMALLEST READING STEP, which is the same
     * relationship measured in each environment's own terms. The dark event is a little over two and
     * a half of them and the light event a little over one. That is the gap, stated in the only unit
     * in which the two numbers mean the same thing, and it is not closed: see ratioPreserving, which
     * measures what closing it would cost — and, since I-08B3.1-F2R, names the requirement that cost
     * breaks. Both figures are emitted below rather than written into this paragraph.
     */
    magnitudeInReadingSteps: {
      darkAreaMeanOverDarkReadingStep: chosen.darkEventOverDarkReadingStep,
      lightAreaMeanOverLightReadingStep: +(chosen.winnerAreaMean / chosen.eventFloor).toFixed(3),
      ratioPreservingFloorWouldBe: chosen.ratioPreservingFloor,
      ratioPreservingFloorReachable: chosen.families.find((x) => x.key === chosen.winner)?.ratioPreserving?.reachable ?? null,
      greatestAreaMeanTheFamilyReaches: chosen.families.find((x) => x.key === chosen.winner)?.feasibleAreaMeanRange?.[1] ?? null,
      winnerMinStopLightness: chosen.families.find((x) => x.key === chosen.winner)?.minStopLightness ?? null,
      suppressedWorldLightness: chosen.families.find((x) => x.key === chosen.winner)?.suppressedWorldLightness ?? null,
      winnerDipOverRise: chosen.families.find((x) => x.key === chosen.winner)?.dipOverRise ?? null,
      note: 'THE LIGHT APPEARANCE CANNOT STAND TO ITS OWN READING RAMP AS THE DARK ONE DOES, AND THE REASON IS NOW A REQUIREMENT RATHER THAN A LIMIT OF THE SEARCH. The floor a ratio transfer would set IS reachable on this ground; an expression that reaches it was derived in full and rendered, and its deepest stop is darker than the passage scrim of the very appearance it belongs to, so R-SOURCE-DOMINANCE rejects it. Closing the gap would mean a meaning event deeper than the veil the World draws over what it is suppressing. Reported as a contradiction, not closed.',
    },
    chosen: {
      Lw: chosen.Lw,
      why: 'the HIGHEST lightness at which an admissible meaning expression still exists — a light World darker than its own requirements force is a dim appearance wearing a light name',
      eventFloor: chosen.eventFloor,
      floorUsed: chosen.floorUsed,
      eventFloorIsOn: 'the AREA MEAN of the event across the source disc — corrected in I-08B3.1-F2R from the event PEAK, which a rim 0.14 wide cleared while the rendered event read as near-static',
      /**
       * WHAT THE RATIO-PRESERVING FLOOR COSTS, ON THE FULL GRID, AND IT IS ONE REQUIREMENT.
       *
       * This is the most load-bearing single object in the record, so it is placed where the floor
       * is stated rather than left inside a family. Of the configurations that reach the ratio
       * floor, EVERY ONE fails R-SOURCE-DOMINANCE and every one is darker than the World under its
       * own passage scrim — `countDarkerThanSuppression` equals `countAbove` exactly. The
       * incompatibility is therefore not a property of a threshold tuned to reject one render; it
       * is a property of this ground. A World at L 0.9491 cannot give a meaning event the dark
       * appearance's multiple of its own reading step without painting it deeper than the veil it
       * draws over what it is suppressing.
       */
      ratioFloorCost: chosen.ratioFloorCost,
      stoppedBy: firstRejectedAbove
        ? { Lw: firstRejectedAbove.Lw, world: firstRejectedAbove.world, requirementsThatFailedEveryFamily: [...new Set(firstRejectedAbove.families.flatMap((x) => x.failedOnEveryVariant ?? []))] }
        : { note: 'the sweep reached its upper bound with candidates still viable — the bound, not a requirement, is what stopped it' },
    },
    families: chosen.families,
    winningFamily,
    atmosphere: chosen.atmo,
    brass: chosen.brass,
    error: chosen.error,
    states,
    scrim,
    increasedContrast: contrast,
    light: LIGHT,
    lightLadder,
    atmosphereCeilingLight: atmoCeilingLight,
    crossAppearance: {
      chromaOrderPreserved: orderPreserved, darkBands, lightBands, ladderBreaks,
      hueDrift, maxHueDrift: +Math.max(...hueDrift.filter((h) => h.drift !== null).map((h) => h.drift)).toFixed(2),
    },
    aiDefaultCreamCheck: {
      value: AI_DEFAULT_CREAM,
      note: 'The frontend-design skill names "a warm cream background near #F4F1EA" as one of three looks AI design clusters on. The derived World is measured against it rather than kept away from it by instinct.',
      dEok: +dEok(LIGHT.WORLD, AI_DEFAULT_CREAM).toFixed(4),
      derivedChroma: +lch(LIGHT.WORLD)[1].toFixed(4),
      creamChroma: +lch(AI_DEFAULT_CREAM)[1].toFixed(4),
    },
  };
}

/**
 * SOLVE ONE ROLE FOR A TARGET CONTRAST RATIO, WITHOUT LOSING ITS HUE ON THE 8-BIT GRID.
 *
 * Walking the lightness axis at a fixed authored (C, H) and taking the first hex that meets a
 * luminance target is not good enough here, and the first version of this derivation proved it:
 * the sRGB grid is coarse in chroma at low lightness, so the quantised hex for an ink authored at
 * C 0.008 drifted up to 8 degrees off its own hue. A role that arrives at the right contrast and
 * the wrong hue has failed the one requirement this package rests on.
 *
 * So the search is over a NEIGHBOURHOOD — lightness for the ratio, and a small chroma window
 * around the authored value — and among every hex that lands inside the ratio tolerance it takes
 * the one whose recovered hue is nearest the frozen dark role's. The chroma window is what buys
 * the hue back: a neighbouring chroma often quantises onto a hex whose hue is far truer.
 */
function solveRole(darkHex, groundHex, ratioTarget, { tol = 0.06, from = 0.10, to = 0.95, chromaCap = Infinity } = {}) {
  const [, C0, H0] = lch(darkHex);
  let best = null;
  /* The chroma window is DELIBERATELY NARROW. A wide one buys better hue fidelity and pays for
     it by moving the role up or down the chroma ladder — which, on a three-rung reading ramp
     whose rungs are 0.002 apart, silently reordered SECONDARY and TERTIARY the first time this
     ran. Chroma fidelity is therefore weighted an order of magnitude above hue fidelity here:
     the ladder is the contract, the hue is the identity, and the ladder must not be spent on it. */
  for (let L = from; L <= to; L += 0.0008) {
    for (const k of [1, 0.96, 1.04, 0.92, 1.08]) {
      const C = C0 * k;
      if (!inSrgbGamut([L, C, H0])) continue;
      const h = hex(L, C, H0);
      const r = contrastHex(h, groundHex);
      if (Math.abs(r - ratioTarget) > tol) continue;
      const [, Cg, Hg] = lch(h);
      if (Cg > chromaCap) continue;
      const drift = Number.isNaN(Hg) ? 999 : (() => { const d = Math.abs(Hg - H0) % 360; return d > 180 ? 360 - d : d; })();
      const score = drift + Math.abs(r - ratioTarget) * 2 + Math.abs(Cg - C0) * 400;
      if (!best || score < best.score) best = { hex: h, L: +L.toFixed(4), authoredC: +C.toFixed(4), chroma: +Cg.toFixed(4), ratio: +r.toFixed(4), hueDrift: +drift.toFixed(2), score };
    }
  }
  return best;
}

/** Meet the ink floor against BOTH grounds, then take the value closest to the frozen dark one.
 *  The rejected ratio-parity candidate is returned alongside, because a rule is easier to argue
 *  with when the road not taken is on the page. */
function closestMeetingFloor(darkHex, g, H, C) {
  const floor = ADOPTED.INK_FLOOR_RATIO;
  let best = null;
  for (let L = 0.20; L <= 0.90; L += 0.0005) {
    if (!inSrgbGamut([L, C, H])) continue;
    const h = hex(L, C, H);
    const rw = contrastHex(h, g.world), rs = contrastHex(h, g.surface);
    if (rw >= floor && rs >= floor) {
      const d = dEok(h, darkHex);
      if (!best || d < best.dEokFromDark) best = { hex: h, L: +L.toFixed(4), ratioVsWorld: +rw.toFixed(3), ratioVsSurface: +rs.toFixed(3), dEokFromDark: +d.toFixed(4) };
    }
  }
  if (!best) return null;
  const parityRatio = contrastHex(darkHex, DARK.WORLD);
  const py = ratioSolve(g.world, parityRatio, 'darker');
  const parity = py === null ? null : luminanceAt(py, C, H, { from: 0.15, to: 0.9 });
  return {
    ...best, hue: +H.toFixed(1), chroma: +C.toFixed(4),
    rule: 'meet 4.5:1 against both grounds, then minimise dEok from the frozen dark value',
    rejectedRatioParityCandidate: parity ? { hex: parity.hex, L: parity.L, ratioItWouldHold: +parityRatio.toFixed(3), dEokFromDark: +dEok(parity.hex, darkHex).toFixed(4) } : null,
  };
}

/**
 * THE AMBIENT FIELD, AND THE ONE THING THAT MAKES IT HONEST.
 *
 * The contour ink's CONTRAST AGAINST ITS OWN GROUND is preserved per layer, so the field has
 * exactly the presence in light that it has in dark. Its lightness therefore crosses the ground
 * — brighter than the World in dark, deeper than it in light — and nothing else moves: the six
 * hues are a topic's IDENTITY and an appearance has no authority over identity; the harmonics,
 * the amplitude, the ring counts and the parallax are I-08B3.1-D2R's and are untouched.
 *
 * THE CHROMA CEILING IS RE-DERIVED, NOT COPIED. D2R made it 0.62 x the least chromatic stop of
 * the Light precisely so that the rule would survive the Light being re-chosen. F2 re-chooses
 * the Light, so the ceiling moves on its own and nobody has to remember that the two were
 * related.
 */
function atmosphere(g) {
  const w = WORLDS.personal;
  const layers = [ATMOSPHERE.L.near, ATMOSPHERE.L.mid, ATMOSPHERE.L.far].map((Ld, i) => {
    const darkInk = hex(Ld, ATMOSPHERE.chromaCeiling, ATMOSPHERE.hues[2]);
    const ratio = contrastHex(darkInk, DARK.WORLD);
    const y = ratioSolve(g.world, ratio, 'darker');
    const hit = y === null ? null : luminanceAt(y, ATMOSPHERE.chromaCeiling, ATMOSPHERE.hues[2], { from: 0.15, to: 0.9 });
    return { layer: ['near', 'mid', 'far'][i], darkL: Ld, darkInk, ratioPreserved: +ratio.toFixed(4), lightL: hit ? hit.L : null, lightInk: hit?.hex ?? null };
  });
  const near = layers[0];
  /* the strongest thing the WORLD ITSELF ever paints: the near layer's first contour at the
     personal world's first stroke alpha. R-EVENT is measured against exactly this. */
  const darkContour = over(near.darkInk, w.strokeAlpha[0], DARK.WORLD);
  const lightContour = near.lightInk ? over(near.lightInk, w.strokeAlpha[0], g.world) : null;
  return {
    hues: ATMOSPHERE.hues,
    chromaCeilingDark: ATMOSPHERE.chromaCeiling,
    strokeAlpha: w.strokeAlpha, fillAlpha: w.fillAlpha,
    layers,
    darkStrongestContour: darkContour,
    darkStrongestContourDEok: +dEok(darkContour, DARK.WORLD).toFixed(4),
    lightStrongestContour: lightContour,
    strongestContourDEok: lightContour ? +dEok(lightContour, g.world).toFixed(4) : 99,
  };
}

/**
 * THE SCRIM DOES NOT INVERT. Its duty is WORLD SUPPRESSION, and suppression is subtraction in
 * any appearance. What is preserved is the RESULT: the contrast between the suppressed World and
 * the functional Surface that stands over it. The alpha is solved for that, which is why the
 * light scrim is heavier than the dark one — it has more world to suppress.
 */
function scrimFor(c) {
  /* WHAT A SCRIM ACTUALLY DOES, AND WHAT THE FIRST VERSION OF THIS FUNCTION MEASURED INSTEAD.
     It first solved for the alpha that reproduced the dark appearance's suppressed-World-to-
     Surface contrast, and returned 0.09 — a scrim so light it suppresses nothing. That rule was
     measuring the GROUND. A scrim is painted over the World AND EVERYTHING IN IT, and its work
     is on the contents: in dark it takes the World's own internal contrast — primary reading ink
     against the World — from 12.95:1 down to 3.80:1. THAT ratio is what world suppression means,
     it is the thing a reader perceives, and it is what is preserved here.

     The result is the most quietly interesting number in the derivation: the light scrim lands
     within a few hundredths of the dark one. Suppression is MULTIPLICATIVE, and a multiplication
     does not care which end of the lightness range it starts from. This is the one role in
     QANDEEL whose value barely moves between appearances, and the reason is arithmetic. */
  const darkSuppressed = over(DARK.SCRIM_INK, DARK.SCRIM_ALPHA, DARK.WORLD);
  const darkInkSuppressed = over(DARK.SCRIM_INK, DARK.SCRIM_ALPHA, DARK.PRIMARY);
  const darkUnscrimmed = contrastHex(DARK.PRIMARY, DARK.WORLD);
  const darkScrimmed = contrastHex(darkInkSuppressed, darkSuppressed);
  const target = darkScrimmed;
  let best = null;
  for (let a = 0.02; a <= 0.95; a += 0.002) {
    const s = over('#000000', a, c.world);
    const ink = over('#000000', a, c.inks[0].hex);
    const r = contrastHex(ink, s);
    const d = Math.abs(r - target);
    if (!best || d < best.delta) best = { alpha: +a.toFixed(3), suppressed: s, suppressedInk: ink, scrimmedRatio: +r.toFixed(4), delta: +d.toFixed(4) };
  }
  return {
    ink: '#000000', alpha: best.alpha, suppressed: best.suppressed, suppressedInk: best.suppressedInk,
    darkSuppressed,
    darkUnscrimmedRatio: +darkUnscrimmed.toFixed(4), darkScrimmedRatio: +darkScrimmed.toFixed(4),
    darkSuppressionFactor: +(darkUnscrimmed / darkScrimmed).toFixed(4),
    lightUnscrimmedRatio: +contrastHex(c.inks[0].hex, c.world).toFixed(4),
    lightScrimmedRatio: best.scrimmedRatio,
    lightSuppressionFactor: +(contrastHex(c.inks[0].hex, c.world) / best.scrimmedRatio).toFixed(4),
    rule: 'neutral black, at the alpha that reproduces the factor by which the dark scrim suppresses the World\'s own internal contrast',
    doesNotInvert: true,
    alphaDeltaFromDark: +(best.alpha - DARK.SCRIM_ALPHA).toFixed(3),
  };
}

/**
 * INTERACTION AND STATUS, IN LIGHT. Every one of these is an ALIAS in the frozen E1 tree, and
 * every one of them STAYS an alias: F2 gives the light appearance new EXPRESSION values and does
 * not touch a single semantic name. The only two literals E1's dark appearance owns are ERROR and
 * DISABLED, so those are the only two this function resolves — the rest follow their aliases into
 * the reading ramp and the identity material and change because those changed.
 *
 * DISABLED keeps its RELATION rather than its ratio: in dark it sits at 3.368:1 against the World
 * and below the tertiary ink, which is what "de-emphasis without illegibility" means as a pair of
 * facts. Both facts are re-instantiated here.
 */
function interactionStates(c) {
  const darkRatio = contrastHex(DARK.DISABLED, DARK.WORLD);
  const hit = solveRole(DARK.DISABLED, c.world, darkRatio, { from: 0.2, to: 0.95 });
  const disabled = { hex: hit.hex, L: hit.L, hueDrift: hit.hueDrift, darkRatio: +darkRatio.toFixed(4), lightRatio: hit.ratio };
  return {
    disabled,
    belowTertiaryInDark: contrastHex(DARK.DISABLED, DARK.WORLD) < contrastHex(DARK.TERTIARY, DARK.WORLD),
    belowTertiaryInLight: contrastHex(disabled.hex, c.world) < contrastHex(c.inks[2].hex, c.world),
    aliasedRoles: {
      note: 'These carry NO literal in either appearance. They are listed so the cross-appearance map can show that their light value changed because the thing they alias changed — which is the whole architecture working.',
      rest: 'qandeel.state.rest.ink', pressed: 'qandeel.state.pressed.ink',
      focus: 'qandeel.state.focus.indicator', selected: 'qandeel.state.selected.ink',
      warning: 'qandeel.status.warning.ink', success: 'qandeel.status.success.ink',
      informational: 'qandeel.status.informational.ink',
    },
    dark: DARK_STATE,
  };
}

/**
 * PART F — THE ACCESSIBILITY OVERRIDES, IN LIGHT.
 *
 * THE HEADLINE HERE IS HOW LITTLE THERE IS TO DO, AND THAT IS A RESULT RATHER THAN A SHORTCUT.
 * I-08B3.1-F1's increased-contrast context is almost entirely RE-ROUTES: `qandeel.analysis.relation`
 * and `qandeel.control.functional` are pointed one rung up the frozen reading ramp, and an alias
 * is appearance-independent by construction — it resolves through whatever the appearance supplies.
 * So F1's hardest decision, the one that keeps HIGH CONTRAST from becoming HIGH IMPORTANCE, needs
 * nothing from F2 at all. Its ratio guard is re-measured on the light values in check A-03.
 *
 * FOUR THINGS ARE APPEARANCE-BOUND AND THEY ARE ALL HERE:
 *   1-3. the ambient field's three layer lightnesses, whose increased-contrast DIRECTION reverses
 *        — in dark, contrast is bought by lifting a contour off a near-black ground; in light it
 *        is bought by deepening it against a near-white one. Same lever, opposite sign, and the
 *        magnitude is searched rather than mirrored.
 *   4.   the opaque scrim literal, which is by definition the composite of the light scrim over
 *        the light World and cannot be anything else.
 *
 * The search is I-08B3.1-F1's own, in order of how little each lever changes: ALPHA first,
 * because it moves no colour at all and therefore cannot give any hue a new relationship to any
 * other; then ONE lightness delta for all three layers, because a per-layer lift would compress
 * or expand the depth ladder, which is a change in the spatial reading rather than in visibility.
 */
function increasedContrast(c, atmo) {
  const TARGET = 3.0; // WCAG 2.2 SC 1.4.11 non-text contrast, adopted as a TARGET by F1
  const baseL = atmo.layers.map((l) => l.lightL);
  const cases = (Ls, alphaFull) => {
    const out = [];
    for (const [wname, w] of Object.entries(WORLDS)) {
      for (let layer = 0; layer < 3; layer++) {
        const limit = Math.min(w.ringLimit, RINGS[layer].length);
        for (let ring = 0; ring < limit; ring++) {
          const declared = w.strokeAlpha[ring] ?? w.strokeAlpha[w.strokeAlpha.length - 1];
          const a = alphaFull ? 1 : declared;
          /* the WORST hue, because the ladder has to clear for every topic and not on average */
          let worst = 99, worstHex = null;
          for (const hue of ATMOSPHERE.hues) {
            const ink = hex(Ls[layer], ATMOSPHERE.chromaCeiling, hue);
            const painted = over(ink, a, c.world);
            const r = contrastHex(painted, c.world);
            if (r < worst) { worst = r; worstHex = painted; }
          }
          out.push({ world: wname, layer, ring, alpha: a, ratio: +worst.toFixed(4), painted: worstHex });
        }
      }
    }
    return out;
  };

  const atDefault = cases(baseL, false);
  const atFullAlpha = cases(baseL, true);
  /* LEVER 2: one delta, DOWNWARD, because on a light ground contrast is depth. */
  let delta = 0, withDelta = atFullAlpha;
  for (let d = 0; d <= 0.30; d += 0.0005) {
    const Ls = baseL.map((L) => L - d);
    if (Ls.some((L) => L < 0.12)) break;
    const r = cases(Ls, true);
    if (r.every((x) => x.ratio >= TARGET)) { delta = +d.toFixed(4); withDelta = r; break; }
  }
  const finalL = baseL.map((L) => +(L - delta).toFixed(4));
  /* the layer LADDER must survive: same order, same spacing, to the digit */
  const darkSpacing = [ATMOSPHERE.L.near - ATMOSPHERE.L.mid, ATMOSPHERE.L.mid - ATMOSPHERE.L.far].map((x) => +x.toFixed(4));
  const lightSpacing = [baseL[1] - baseL[0], baseL[2] - baseL[1]].map((x) => +x.toFixed(4));
  const contrastSpacing = [finalL[1] - finalL[0], finalL[2] - finalL[1]].map((x) => +x.toFixed(4));

  /* THE MEANING HIERARCHY GUARD, RE-MEASURED IN LIGHT. F1's whole argument was that raising the
     atmosphere alone compresses the ratio between the loudest ambient contour and the weakest
     analytical object from 1.2914 to 1.028, and that raising the analytical relation too widens
     it to 1.524. The same two numbers, on the light ground. */
  const loudest = (rows) => Math.max(...rows.map((x) => x.ratio));
  const relationDefault = contrastHex(c.inks[2].hex, c.world);   // analysis.relation -> content.tertiary
  const relationRaised = contrastHex(c.inks[1].hex, c.world);    // -> content.secondary under the override
  return {
    target: TARGET,
    note: 'F1\'s increased-contrast context re-routes two ALIASES and those need nothing from F2. Only the three layer lightnesses are appearance-bound, and their direction reverses.',
    defaultWorstRatio: +Math.min(...atDefault.map((x) => x.ratio)).toFixed(4),
    afterAlphaWorstRatio: +Math.min(...atFullAlpha.map((x) => x.ratio)).toFixed(4),
    casesClearedByAlphaAlone: atFullAlpha.filter((x) => x.ratio >= TARGET).length,
    casesTotal: atFullAlpha.length,
    lightnessDelta: -delta,
    direction: 'DOWNWARD — the reverse of the dark appearance\'s +0.011, because on a near-white ground a contour buys contrast by deepening',
    lightnessNear: finalL[0], lightnessMid: finalL[1], lightnessFar: finalL[2],
    finalWorstRatio: +Math.min(...withDelta.map((x) => x.ratio)).toFixed(4),
    finalLoudestRatio: +loudest(withDelta).toFixed(4),
    layerSpacingDark: darkSpacing, layerSpacingLightDefault: lightSpacing, layerSpacingLightIncreased: contrastSpacing,
    spacingPreserved: JSON.stringify(lightSpacing) === JSON.stringify(contrastSpacing),
    meaningHierarchy: {
      atmosphereLoudestDefault: +loudest(atDefault).toFixed(4),
      atmosphereLoudestIncreased: +loudest(withDelta).toFixed(4),
      analysisRelationDefault: +relationDefault.toFixed(4),
      analysisRelationIncreased: +relationRaised.toFixed(4),
      ratioDefault: +(relationDefault / loudest(atDefault)).toFixed(4),
      ratioIfOnlyAtmosphereRose: +(relationDefault / loudest(withDelta)).toFixed(4),
      ratioIncreased: +(relationRaised / loudest(withDelta)).toFixed(4),
    },
  };
}

/* ------------------------------------------------------------------------------- report ----- */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const d = derive();
  mkdirSync(join(PKG, 'data'), { recursive: true });
  writeFileSync(join(PKG, 'data/F2_DERIVATION.json'), JSON.stringify(d, null, 2) + '\n');
  if (d.exhausted) {
    console.log('NO LIGHT WORLD SATISFIES THE REQUIREMENT SET. The sweep, and what failed where:');
    for (const s of d.sweep) {
      console.log('  Lw=' + s.Lw, s.world, 'contour dEok=' + s.atmoStrongestContourDEok);
      for (const x of s.families) console.log('      ', x.key, 'event=' + f(x.eventPeak), 'gray=' + f(x.grayPeak), x.admissible ? 'OK' : 'failed: ' + x.failed.join(','));
    }
    process.exit(1);
  }

  console.log('READING HUE (the system\'s own):', d.readingHue, '  Light chroma band:', d.lightChromaBand);
  console.log('\nTHE DARK CHROMA LADDER');
  for (const r of d.darkLadder) console.log('   ', r.role.padEnd(10), r.hex, 'C=' + f(r.C), 'H=' + (r.H ?? '--'));

  console.log('\nWHAT A MECHANICAL INVERSION WOULD HAVE PRODUCED  (mean hue rotation ' + d.inversionMeanHueRotation + ' deg)');
  for (const r of d.invertedWouldHaveBeen) if (r.hueRotation !== null) console.log('   ', r.role.padEnd(10), r.dark, '->', r.inverted, ' hue', r.darkHue, '->', r.invertedHue, ' (' + r.hueRotation + ' deg)');

  console.log('\nPART C — THE FOUR MEANING-LIGHT FAMILIES, AT THE CHOSEN GROUND');
  for (const x of d.families) {
    console.log('   ', x.key, x.admissible ? 'ADMISSIBLE' : 'REJECTED  ', 'event dEok=' + f(x.eventPeak), 'gray dEok=' + f(x.grayPeak), 'minToBrass=' + f(x.minDEokToBrass), 'minStopsToInk=' + f(x.minDEokStopsToInk));
    if (!x.admissible) console.log('        failed:', Object.entries(x.pass).filter(([, v]) => !v).map(([k]) => k).join(', '));
  }
  console.log('    WINNER:', d.winningFamily.key, '—', d.winningFamily.name);

  console.log('\nLIGHT WORLD selection: Lw =', d.chosen.Lw, '—', d.chosen.why);
  console.log('    event floor (the reading ramp\'s smallest step) =', d.chosen.eventFloor, '| winning event peak =', d.winningFamily.eventPeak,
    '| of which rise', d.winningFamily.risePeak, 'and dip', d.winningFamily.dipPeak);
  console.log('    stopped from going lighter by:', JSON.stringify(d.chosen.stoppedBy));

  console.log('\nTHE LIGHT LADDER');
  for (const r of d.lightLadder) console.log('   ', r.role.padEnd(10), r.hex, 'C=' + f(r.C), 'H=' + (r.H ?? '--'), 'L=' + f(r.L));
  console.log('\nTHE LADDER OF ROLE FAMILIES');
  for (let i = 0; i < d.crossAppearance.darkBands.length; i++) {
    const a = d.crossAppearance.darkBands[i], b = d.crossAppearance.lightBands[i];
    console.log('   ', a.band.padEnd(11), 'dark [' + f(a.min) + ' .. ' + f(a.max) + ']   light [' + f(b.min) + ' .. ' + f(b.max) + ']');
  }
  console.log('  chroma ORDER preserved across appearances:', d.crossAppearance.chromaOrderPreserved);
  for (const brk of d.crossAppearance.ladderBreaks) console.log('     BREAK:', brk);
  console.log('  max hue drift:', d.crossAppearance.maxHueDrift, 'deg  (tolerance', ADOPTED.HUE_TOLERANCE_DEG + ')');
  console.log('  scrim:', d.scrim.ink, '@', d.scrim.alpha, '— does not invert:', d.scrim.doesNotInvert);
  const ic = d.increasedContrast;
  console.log('\nPART F — INCREASED CONTRAST IN LIGHT');
  console.log('    worst contour', ic.defaultWorstRatio, '-> after full alpha', ic.afterAlphaWorstRatio,
    '(' + ic.casesClearedByAlphaAlone + '/' + ic.casesTotal + ' cases) -> after L delta', ic.lightnessDelta, ':', ic.finalWorstRatio);
  console.log('    layer spacing preserved exactly:', ic.spacingPreserved, JSON.stringify(ic.layerSpacingLightDefault));
  console.log('    meaning hierarchy ratio: default', ic.meaningHierarchy.ratioDefault,
    '| if only the atmosphere rose', ic.meaningHierarchy.ratioIfOnlyAtmosphereRose,
    '| with the relation raised too', ic.meaningHierarchy.ratioIncreased);
  console.log('\nATMOSPHERE, dark -> light (contour contrast against its own ground, preserved)');
  for (const l of d.atmosphere.layers) console.log('   ', l.layer.padEnd(5), l.darkInk, 'L=' + f(l.darkL, 3), '->', l.lightInk, 'L=' + f(l.lightL, 3), ' ratio', f(l.ratioPreserved, 3));
  console.log('  vs the AI-default cream ' + d.aiDefaultCreamCheck.value + ': dEok', d.aiDefaultCreamCheck.dEok,
    '(derived chroma ' + d.aiDefaultCreamCheck.derivedChroma + ' vs cream ' + d.aiDefaultCreamCheck.creamChroma + ')');
}

