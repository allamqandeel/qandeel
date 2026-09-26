// P3-A — the ONLY new drawings this proof adds to the frozen P2 family, on P2's own construction (sig.mjs: the 24-unit
// grid, the optical stroke per size, round N1 terminals, the QANDEEL cut at 45°). Nothing in sig.mjs is edited: the
// three P2 world glyphs, `settings` (Hugeicons Free via utility.mjs), close and back are consumed as they are.
//
// 1. THE ACTIVITY ENTRY — ACCEPTED by the Product Owner (P3-A refinement §4.1): **Open Ledger**.
//    ledger  "Open Ledger" (ACCEPTED): the square keyline (16 u, corner radius 2 u) holding two equal rows — a record of
//            what happened. It is NOT a ring: in the P2 family the ring means a World, and Activity is not a World.
//            The QANDEEL cut is carried to the square's lower END corner, centred on the 45° diagonal, with the same
//            visible span as N1's ring cut (≈ 5.7 u between the caps): the record is open where new things arrive.
//    bell    "Quiet Bell": comparison / history evidence only (the P3-A first pass compared it; it is not the entry).
//    Neither is ever filled, mirrored or Brass. Both are symmetric except for the cut (P2 spec §3 asymmetry limits).
// 2. THE INTRODUCTIONS SOURCE MARK — needed only as an Activity row's source glyph (refinement §9). The P3-A first pass
//    drew two arcs of the Shared ring (two openings: a second exception to P2's one-opening-per-ring grammar). That
//    drawing is WITHDRAWN and kept below only as history and as the planted defect the checks must reject. Two bounded
//    variants replace it, both inside the grammar with no exception:
//    link    "Open Link" (ACCEPTED, FINAL — non-ring): navShared's two points of light, on the same 45° diagonal through
//            the cut, but with NO ring (before a Mutual Match there is no Shared World to draw). Each point reaches
//            toward the other with one straight stroke; the two strokes stop short of each other, so the link stays
//            open in the middle — offered, not made. No ring, so no ring opening at all.
//    door    "At the Door" (comparison / history only — ring-based, compliant): ONE open ring with the one N1 cut at 45°, one point
//            inside, and the second point standing in the opening. It obeys the grammar (one opening), but a ring
//            means a World in P2, so it risks reading as navMine with a visitor — kept only as the compliant ring option.
//    Points never sit on a horizontal (P2 face rule): both variants keep them on the 45° diagonal.
// 3. THE ATTENTION MARK is not a glyph: it is a CSS presence mark (build.mjs), neutral primary ink, never Brass, never red.
import { NUANCES, strokeFor, arc } from './sig.mjs';

const f = (v) => +v.toFixed(3);
const S = (sw) => `fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
const P = (d, sw) => `<path d="${d}" ${S(sw)}/>`;
const dot = (x, y, r) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="currentColor" stroke="none"/>`;
const openRing = (sw, nu = NUANCES.open) => { const overhang = ((sw / 2) / 8) * (180 / Math.PI), half = nu.cut / 2 + overhang; return arc(12, 12, 8, 45 + half, 45 + 360 - half); };

/** The square cut: the visible gap between the two round caps, in grid units (asserted by checks: ≥ 2 u, ≈ N1's ring). */
export const LEDGER_CUT = { a: [20, 14.8], b: [14.8, 20] };
export const ledgerCutVisible = (size = 22) => f(Math.hypot(LEDGER_CUT.a[0] - LEDGER_CUT.b[0], LEDGER_CUT.a[1] - LEDGER_CUT.b[1]) - strokeFor(size));
export const ringCutVisible = (size = 22, nu = NUANCES.open) => f(2 * 8 * Math.sin((nu.cut / 2) * Math.PI / 180));

/** Open Link: the two points (navShared's core size) and the open middle, in grid units along the 45° diagonal. */
export const LINK = { a: 5.3, b: 18.7, gap: 2.6 };
/** The visible opening between the two strokes' round caps (u). Never under P2's 2-u minimum. */
export const linkGapVisible = () => LINK.gap;

export const P3G = {
  ledger: (sz) => {
    const sw = strokeFor(sz);
    const frame = `M${LEDGER_CUT.a[0]} ${LEDGER_CUT.a[1]}V6A2 2 0 0 0 18 4H6A2 2 0 0 0 4 6V18A2 2 0 0 0 6 20H${LEDGER_CUT.b[0]}`;
    return P(frame, sw) + P('M8 9.2H16M8 13.2H16', sw);
  },
  bell: (sz) => {
    const sw = strokeFor(sz);
    // dome: from the END side (lower END is left open by the cut) over the crown to the START side, then the lip.
    return P('M17.6 13.4V11.1A5.6 5.6 0 0 0 6.4 11.1V16.2', sw) + P('M4.6 16.4H14.9', sw) + P('M12 3.7V5.3', sw) + P('M10.2 19.5A1.9 1.9 0 0 0 13.8 19.5', sw);
  },
  // The ACCEPTED (final) Introductions source mark (non-ring).
  link: (sz) => {
    const sw = strokeFor(sz), nu = NUANCES.open, k = (LINK.gap / 2 + sw / 2) / Math.SQRT2;   // where each stroke's cap ends
    return P(`M${LINK.a} ${LINK.a}L${f(12 - k)} ${f(12 - k)}M${LINK.b} ${LINK.b}L${f(12 + k)} ${f(12 + k)}`, sw) +
      dot(LINK.a, LINK.a, nu.core * 0.92) + dot(LINK.b, LINK.b, nu.core * 0.92);
  },
  // Comparison / history only (ring, one opening — compliant; not the accepted mark).
  door: (sz) => {
    const sw = strokeFor(sz), nu = NUANCES.open;
    return P(openRing(sw), sw) + dot(9.5, 9.5, nu.core * 0.92) + dot(17.657, 17.657, nu.core * 0.92);
  },
};
/** WITHDRAWN (P3-A first pass): two arcs of the Shared ring — TWO openings. History evidence and planted defect D23 only. */
export const WITHDRAWN = {
  introTwoArcs: (sz) => {
    const sw = strokeFor(sz), nu = NUANCES.open, overhang = ((sw / 2) / 8) * (180 / Math.PI), half = 40 / 2 + overhang;
    const d = arc(12, 12, 8, 135 + half, 315 - half) + arc(12, 12, 8, 315 + half, 135 + 360 - half);
    return P(d, sw) + dot(14.3, 14.3, nu.core * 0.92) + dot(9.5, 9.5, nu.core * 0.92);
  },
};
export const ACTIVITY_VARIANTS = { ledger: { name: 'Open Ledger', accepted: true }, bell: { name: 'Quiet Bell', accepted: false, role: 'comparison / history only' } };
export const ACTIVITY_ACCEPTED = 'ledger';
// Final micro-refinement §4.1: the Product Owner ACCEPTED Open Link as the FINAL Introductions row mark. At the Door is
// comparison / history evidence only; the two-opening drawing (WITHDRAWN) stays rejected / planted-defect evidence only.
export const INTRO_VARIANTS = { link: { name: 'Open Link', accepted: true, ring: false }, door: { name: 'At the Door', accepted: false, ring: true, role: 'comparison / history only' } };
export const INTRO_ACCEPTED = 'link';

const draw = (name, size) => (P3G[name] || WITHDRAWN[name])(size);
export const p3Svg = (name, { size = 22, cls = '', label = null } = {}) =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"` +
  (label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true" focusable="false"') + `>${draw(name, size)}</svg>`;
