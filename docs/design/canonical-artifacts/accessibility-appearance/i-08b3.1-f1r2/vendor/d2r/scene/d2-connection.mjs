/**
 * I-08B3.1-D2R — CONNECTION. INHERITED CONTROL.
 *
 * The Product Owner selected GUIDED THREAD at I-08B3.1-D0R and CONTROLLED MEANING EMERGENCE at
 * I-08B3.1-D1. D2 may not redesign either, may not offer an alternative, and may not
 * reinterpret them.
 *
 * SO THIS FILE CONTAINS NO MOTION. It imports D1's functions and hands them on. There is no
 * copy of the Guided Thread in this package to drift from the original, because a copy is
 * exactly what "silently redesigned" looks like six months later — the same shape, two numbers
 * different, and nobody able to say when it happened. `source/vendor/d1/` holds D1's three
 * scene files byte-identical, with their hashes recorded in data/D2_RESOLUTION.json, and the
 * build refuses to run if any of them has changed.
 *
 * Check C1 measures the inheritance rather than trusting the import: all 23 channels, at all
 * 210 frames, against D1's own composed function. The largest permitted difference is zero.
 */

import { guidedThread } from '../vendor/d1/d1-scene.mjs';
import { ARRIVALS, REDUCED } from '../vendor/d1/d1-arrivals.mjs';

/** THE selected lifecycle: GUIDED THREAD -> CONTROLLED MEANING EMERGENCE -> CALM SETTLE. */
export const connectionEvent = ARRIVALS.C.apply;

/**
 * ------------------------------------------------------------------------------------------
 * THE ONE CHANGE D2 MAKES TO THE INHERITED CONTROL, AND WHY IT IS NOT A REDESIGN.
 * ------------------------------------------------------------------------------------------
 *
 * D2's Reference Gate turned up a genuine conflict inside work that was already accepted.
 *
 * D1's reduced-motion counterpart KEEPS the bridging blur. Its skill gate says so explicitly
 * and gives a good reason: in the reduced version the destination really is crossfading between
 * two fixed renderings, which is the situation the technique exists for.
 *
 * Apple's accessibility guidance says the opposite, in a list written for exactly this setting:
 *
 *   > When this setting is active, ensure your app or game responds by reducing automatic and
 *   > repetitive animations... Other best practices for reducing motion include: ...
 *   > Avoiding animating into and out of blurs.
 *
 * Both are right about their own concern. The blur is the correct bridge for a crossfade, AND
 * an animated blur is on the list of things Reduce Motion exists to remove — it is a focal
 * change, and focal changes are part of why motion makes some people unwell. When a craft
 * technique and an accessibility setting disagree, the setting is not a suggestion.
 *
 * This is a correction in the ACCESSIBILITY layer, which §14 of the D2 brief puts inside D2's
 * remit, and it touches ONE CHANNEL of the counterpart nobody selected. The Product expression
 * the Product Owner chose — the full-motion Connection — is untouched: `connectionEvent` above
 * is D1's function, unmodified, and check C1 proves it at fourteen decimal places.
 *
 * It is reported as a real contradiction discovered, not folded in quietly.
 */
export const BLUR_CORRECTION = {
  channel: 'receptionBlur',
  appliesTo: 'reduced-motion counterpart only',
  d1Behaviour: 'transient bridging blur, peak 0.34 CSS px',
  d2Behaviour: 'exactly 0 at every millisecond',
  source: 'Apple HIG — Accessibility, Cognitive: "Avoiding animating into and out of blurs"',
  productExpressionChanged: false,
};

export function connectionReduced(t) {
  const S = REDUCED.C.apply(t);
  return { ...S, receptionBlur: 0 };
}

/** What D1 itself would have produced, kept so the correction can be MEASURED, not described. */
export const connectionReducedUncorrected = REDUCED.C.apply;

export const CONNECTION = {
  key: 'connection',
  name: 'CONNECTION — GUIDED THREAD / CONTROLLED MEANING EMERGENCE',
  arabic: 'الرابط',
  apply: connectionEvent,
  reduced: connectionReduced,
  inheritedFrom: 'I-08B3.1-D1 ARRIVALS.C / REDUCED.C',
};
