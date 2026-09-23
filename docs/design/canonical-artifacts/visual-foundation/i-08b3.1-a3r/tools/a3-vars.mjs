/**
 * I-08B3.1-A3 - the colour block handed to the shared template.
 *
 * SIX values go in. FIVE of them are identical for every render in this package:
 *
 *     --world      #101010              the sole incumbent World Base, preserved
 *     --subtle     World + dL 0.035     DIAGNOSTIC surface, non-canonical
 *     --ink-2      #afaca3              Secondary, unchanged and not under test
 *     --ink-3      #8b8982              Tertiary, unchanged and not under test
 *     --edge       solved to 3:1        DIAGNOSTIC non-text value, non-canonical
 *
 * The sixth, `--ink-1`, is the only thing a finalist contributes. That is the entire
 * experiment: one variable, changed, with everything else held.
 *
 * The edge value is carried over from A2 unchanged in method. A2 found that neither thesis
 * contained a non-text value at all and that a near-black World offers no calm accessible
 * one; A3 does not reopen that, does not promote the solved value into a token, and does not
 * design an edge system. It needs a line colour to draw ENVIRONMENT 2 at all, and the honest
 * way to supply one is to derive it from the World's own chroma and hue at whatever lightness
 * clears WCAG 2.2 SC 1.4.11.
 *
 * L is SOLVED against the DISPLAYED 8-bit value, and against the SUBTLE rather than the World
 * Base - the Subtle is the lighter of the two surfaces a mark can land on and therefore the
 * worse case. Material 3 states the same rule from the other direction: "on surface" and "on
 * surface variant" are used "on all types of surfaces", so a content or mark value has to
 * hold its floor on every surface it can reach, not just the darkest one.
 */
import { resolve, contrastHex } from './color.mjs';
import { WORLD, SECONDARY, TERTIARY, oklchOf, diagSubtle } from './a3-model.mjs';

/**
 * Smallest L whose DISPLAYED hex clears `target`:1 against `bgHex`, holding C and H.
 * Searches the displayed value, so the answer survives 8-bit quantisation.
 */
export function solveEdge(bgHex, C, H, target = 3.0) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const r = resolve([mid, C, H]);
    if (contrastHex(r.hex, bgHex) >= target) hi = mid; else lo = mid;
  }
  const r = resolve([hi, C, H], 'edge');
  return { ...r, ratio: contrastHex(r.hex, bgHex) };
}

let _edge = null;
export function diagEdge() {
  if (_edge === null) {
    const [, C0, H0] = oklchOf(WORLD);
    _edge = solveEdge(diagSubtle().hex, C0, H0, 3.0);
  }
  return _edge;
}

/**
 * The six custom properties, and nothing else, that reach the shared product template.
 * `primaryHex` is the ONLY argument; everything else is a constant of this package.
 */
export function varsFor(primaryHex) {
  return {
    '--world': WORLD,
    '--subtle': diagSubtle().hex,
    '--ink-1': primaryHex,
    '--ink-2': SECONDARY,
    '--ink-3': TERTIARY,
    '--edge': diagEdge().hex,
  };
}
