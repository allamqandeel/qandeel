// P3-A — the ONLY new drawings this proof adds to the frozen P2 family, on P2's own construction (sig.mjs: the 24-unit
// grid, the optical stroke per size, round N1 terminals, the QANDEEL cut at 45°). Nothing in sig.mjs is edited: the
// three P2 world glyphs, `settings` (Hugeicons Free via utility.mjs), close and back are consumed as they are.
//
// 1. THE ACTIVITY ENTRY — a truly new identity-bearing glyph (task §20 allows at most 2 bounded variants):
//    ledger  "Open Ledger" (RECOMMENDED): the square keyline (16 u, corner radius 2 u) holding two equal rows — a record
//            of what happened. It is NOT a ring: in the P2 family the ring means a World, and Activity is not a World
//            (P3-A). The QANDEEL cut is carried to the square's lower END corner, centred on the 45° diagonal, with the
//            same visible span as N1's ring cut (≈ 5.7 u between the caps): the record is open where new things arrive.
//    bell    "Quiet Bell": the familiar notification bell drawn on N1 (symmetric dome and lip, round terminals, the cut at
//            the lower END corner). Comparison evidence: familiar, but it names ringing — the one thing Activity is not.
//    Neither is ever filled, mirrored or Brass. Both are symmetric except for the cut (P2 spec §3 asymmetry limits).
// 2. THE INTRODUCTIONS SOURCE MARK — needed only as an Activity row's source glyph. Built from navShared's parts, and
//    drawing only what is true (G1.1 glyph law): the same two points of light, but the ring is not yet one — two arcs,
//    open on the axis between the two people. Before a Mutual Match there is no Shared World, so there is no whole ring.
//    Two openings is the second semantic exception after Public (P2 spec §3); it is reported for Product Owner review.
// 3. THE ATTENTION MARK is not a glyph: it is a CSS presence mark (build.mjs), neutral primary ink, never Brass, never red.
import { NUANCES, strokeFor, arc } from './sig.mjs';

const f = (v) => +v.toFixed(3);
const pt = (cx, cy, r, deg) => [f(cx + r * Math.cos((deg * Math.PI) / 180)), f(cy + r * Math.sin((deg * Math.PI) / 180))];
const S = (sw) => `fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
const P = (d, sw) => `<path d="${d}" ${S(sw)}/>`;
const dot = (x, y, r) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="currentColor" stroke="none"/>`;

/** The square cut: the visible gap between the two round caps, in grid units (asserted by checks: ≥ 2 u, ≈ N1's ring). */
export const LEDGER_CUT = { a: [20, 14.8], b: [14.8, 20] };
export const ledgerCutVisible = (size = 22) => f(Math.hypot(LEDGER_CUT.a[0] - LEDGER_CUT.b[0], LEDGER_CUT.a[1] - LEDGER_CUT.b[1]) - strokeFor(size));
export const ringCutVisible = (size = 22, nu = NUANCES.open) => f(2 * 8 * Math.sin((nu.cut / 2) * Math.PI / 180));

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
  introMark: (sz) => {
    const sw = strokeFor(sz), nu = NUANCES.open, overhang = ((sw / 2) / 8) * (180 / Math.PI), half = 40 / 2 + overhang;
    // two arcs of the Shared ring, broken on the 135° / 315° axis — the axis between the two points
    const d = arc(12, 12, 8, 135 + half, 315 - half) + arc(12, 12, 8, 315 + half, 135 + 360 - half);
    return P(d, sw) + dot(14.3, 14.3, nu.core * 0.92) + dot(9.5, 9.5, nu.core * 0.92);
  },
};
export const ACTIVITY_VARIANTS = { ledger: { name: 'Open Ledger', recommended: true }, bell: { name: 'Quiet Bell', recommended: false } };
export const ACTIVITY_RECOMMENDED = 'ledger';

export const p3Svg = (name, { size = 22, cls = '', label = null } = {}) =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"` +
  (label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true" focusable="false"') + `>${P3G[name](size)}</svg>`;
