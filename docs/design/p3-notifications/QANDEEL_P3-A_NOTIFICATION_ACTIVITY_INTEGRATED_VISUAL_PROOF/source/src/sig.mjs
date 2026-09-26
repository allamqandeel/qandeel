// P2-A — the QANDEEL signature family: the small set of glyphs QANDEEL owns (P2 task §4.1 Layer A, §11), drawn on one
// measured construction system (docs/P2_ICON_GEOMETRY_SPEC.md). Every glyph is a pure function of a nuance and a render
// size, so the optical correction per size is a rule, not a hand edit.
//
// Construction, in 24-unit grid units (u):
//   - live area 2..22 (20 u); keylines: circle ⌀16 (r 8), capsule 6 × 11, square 16.
//   - stroke is OPTICAL, per render size: 24 px → 1.60 u, 20 px → 1.75 u, 16 px → 1.95 u (so 1.60 / 1.46 / 1.30 px).
//   - round caps and joins everywhere; corner radius 2 u on rectilinear forms, concentric on nested ones.
//   - THE QANDEEL CUT: one opening per glyph at most, on a ring, centred at 45° (lower END of the ring as drawn, where
//     the canonical Q's ring opens for its tail). Its visible gap, measured between the round caps, is never under
//     2 u at 24 px (1.3 px at 16 px), so it survives rasterisation instead of closing into a smudge.
//   - SOLID ANCHORS only where recognition or state needs them: the core (a world's point of light), the media
//     transport (play / pause / stop), a toggle's ON body (speaker), and the terminal act (End Call).
//   - nothing is mirrored here. Direction is decided per glyph in the inventory; every glyph below is non-directional
//     or a media / identity mark, which is never mirrored (designing-arabic-frontends §6; C3 §7.1).
//
// Two nuance sets exist (task §10, "no more than 2"): OPEN (N1, recommended) and ARCH (N2, architectural). They share
// every skeleton; they differ only in the cut span, the stroke and the corner radius.

export const NUANCES = {
  open: { id: 'N1', name: 'Open', cut: 50, strokeK: 1.0, r: 2.0, core: 2.05, cap: 'round' },
  arch: { id: 'N2', name: 'Architectural', cut: 34, strokeK: 1.08, r: 1.2, core: 1.85, cap: 'butt' },
};
export const STROKE = { 16: 1.95, 20: 1.75, 22: 1.66, 24: 1.6, 28: 1.5, 32: 1.45, 48: 1.3 };
export const strokeFor = (size, nu = NUANCES.open) => +((STROKE[size] ?? 1.6) * nu.strokeK).toFixed(3);

const f = (v) => +v.toFixed(3);
const pt = (cx, cy, r, deg) => [f(cx + r * Math.cos((deg * Math.PI) / 180)), f(cy + r * Math.sin((deg * Math.PI) / 180))];
/** A clockwise arc on (cx, cy, r) from a0° to a1° (SVG angles: 0 = +x, clockwise positive). */
export function arc(cx, cy, r, a0, a1) {
  const [x0, y0] = pt(cx, cy, r, a0), [x1, y1] = pt(cx, cy, r, a1);
  const sweep = ((a1 - a0) % 360 + 360) % 360;
  return `M${x0} ${y0}A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}
/** The open ring: the whole circle except the cut. The cut span grows by the cap overhang so the VISIBLE gap is the
 *  nuance's angle, whatever the stroke. */
function openRing(cx, cy, r, sw, nu, at = 45) {
  const overhang = nu.cap === 'round' ? ((sw / 2) / r) * (180 / Math.PI) : 0;   // a round cap eats this much of the gap
  const half = nu.cut / 2 + overhang;
  return arc(cx, cy, r, at + half, at + 360 - half);
}
/** A ring broken into `n` equal arcs by `n` cuts of the nuance's span, the first centred at `at`. */
function porousRing(cx, cy, r, sw, nu, n, at, span) {
  const overhang = nu.cap === 'round' ? ((sw / 2) / r) * (180 / Math.PI) : 0, half = span / 2 + overhang, step = 360 / n;
  let d = '';
  for (let i = 0; i < n; i++) d += arc(cx, cy, r, at + i * step + half, at + (i + 1) * step - half);
  return d;
}
const dot = (x, y, r) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="currentColor" stroke="none"/>`;
const S = (sw, cap = 'round') => `fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="${cap}" stroke-linejoin="round"`;
const P = (d, sw, cap) => `<path d="${d}" ${S(sw, cap)}/>`;

// The laid-down handset (End Call). Drawn once, used solid for the terminal act and rotated for the call entry.
const HANDSET = 'M3.4 14.6c-.1-1.5.3-2.8 1.5-3.7C6.8 9.5 9.3 8.8 12 8.8s5.2.7 7.1 2.1c1.2.9 1.6 2.2 1.5 3.7l-.1.8c-.1.8-.8 1.3-1.6 1.2l-2.7-.5c-.7-.1-1.2-.7-1.2-1.4v-1.5c-1-.4-2-.6-3-.6s-2 .2-3 .6v1.5c0 .7-.5 1.3-1.2 1.4l-2.7.5c-.8.1-1.5-.4-1.6-1.2z';

/** Every signature glyph: (nuance, size) → inner SVG markup on the 24-unit grid. */
export const SIG = {
  // ---------------------------------------------------------------- persistent navigation family (Living Brass)
  // One family, three destinations of the frozen Global Switcher (I-08A4; G1.2 §3 names). Each is ONE open world —
  // the same ring, the same cut — and differs only in who is in it (G1.1 glyph law: draw only what is true).
  // The first render placed the Shared / Public points side by side inside the ring, and they read as FACES (two eyes,
  // three features). Points of light therefore never sit on a horizontal inside a ring: Shared's two lie on the
  // diagonal through the cut; Public's people stand IN the ring's openings — a world open on every side.
  navMine: (nu, sz) => { const sw = strokeFor(sz, nu); return P(openRing(12, 12, 8, sw, nu), sw, nu.cap) + dot(13.9, 13.9, nu.core); },
  navShared: (nu, sz) => { const sw = strokeFor(sz, nu); return P(openRing(12, 12, 8, sw, nu), sw, nu.cap) + dot(14.3, 14.3, nu.core * 0.92) + dot(9.5, 9.5, nu.core * 0.92); },
  navPublic: (nu, sz) => {
    const sw = strokeFor(sz, nu), at = [45, 165, 285];
    return P(porousRing(12, 12, 8, sw, nu, 3, 45, nu.cut + 8), sw, nu.cap) + at.map((a) => dot(...pt(12, 12, 8, a), nu.core * 0.78)).join('') + dot(12, 12, nu.core * 0.78);
  },

  // ---------------------------------------------------------------- Conversation ↔ Analysis, Replay (neutral)
  // «تحليل المحادثة» — the doorway into THIS conversation's world: the same open world, drawn neutral (G1.1 R3 semantic).
  depth: (nu, sz) => { const sw = strokeFor(sz, nu); return P(openRing(12, 12, 8, sw, nu), sw, nu.cap) + dot(13.9, 13.9, nu.core); },
  // Replay — an open ring that turns back on itself; its cut IS the return. Media: never mirrored.
  replay: (nu, sz) => {
    const sw = strokeFor(sz, nu), a0 = 212, a1 = 212 + 360 - Math.max(40, nu.cut + 8);
    const [x0, y0] = pt(12, 12, 8, a0);
    const head = `M${f(x0 - 0.2)} ${f(y0 - 3.4)}L${f(x0)} ${f(y0)}L${f(x0 + 3.3)} ${f(y0 + 0.5)}`;
    return P(arc(12, 12, 8, a0, a1), sw, nu.cap) + P(head, sw) + `<path d="M10.6 9.6v4.8c0 .5.5.8.9.5l3.6-2.4c.4-.2.4-.8 0-1l-3.6-2.4c-.4-.3-.9 0-.9.5z" fill="currentColor"/>`;
  },

  // ---------------------------------------------------------------- Live Call / Voice critical family (neutral)
  mic: (nu, sz) => { const sw = strokeFor(sz, nu); return `<rect x="9" y="3" width="6" height="11.2" rx="3" ${S(sw)}/>` + P('M5.6 11.2a6.4 6.4 0 0 0 12.8 0M12 17.6v3', sw, nu.cap); },
  // MUTED — the same microphone, CUT by the slash: the slash carries a band of negative space through the drawing
  // (mask), so the state is a change of FORM (a broken instrument), never a change of colour. The morph in motion
  // grows the slash and its cut together (motion M-MIC).
  muted: (nu, sz, id = 'm') => {
    const sw = strokeFor(sz, nu), gap = sw + 2.6;
    return `<defs><mask id="cut-${id}-${sz}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="#fff"/>` +
      `<path class="cutband" d="M4.2 3.6 19.8 20.4" pathLength="1" stroke-dasharray="1 1" stroke="#000" stroke-width="${gap}" stroke-linecap="round"/></mask></defs>` +
      `<g mask="url(#cut-${id}-${sz})"><rect x="9" y="3" width="6" height="11.2" rx="3" ${S(sw)}/>${P('M5.6 11.2a6.4 6.4 0 0 0 12.8 0M12 17.6v3', sw, nu.cap)}</g>` +
      `<path class="slash" d="M4.2 3.6 19.8 20.4" pathLength="1" stroke-dasharray="1 1" ${S(sw)}/>`;
  },
  // SPEAKER ROUTE — one stable body. ON (loudspeaker): the body is SOLID and carries two waves. OFF (the phone's own
  // earpiece): the body is drawn in outline and keeps ONE wave, because sound still plays (no wave would read as mute).
  // Two carriers for one state: fill and wave count. Media: never mirrored.
  routeOn: (nu, sz) => { const sw = strokeFor(sz, nu); return `<path d="M3.6 10.2c0-.7.5-1.2 1.2-1.2h2.4l4-3.5c.5-.4 1.2-.1 1.2.6v11.8c0 .7-.7 1-1.2.6l-4-3.5H4.8c-.7 0-1.2-.5-1.2-1.2z" fill="currentColor" stroke="currentColor" stroke-width="${sw}" stroke-linejoin="round"/>` + P(arc(12.4, 12, 3.6, -48, 48), sw, nu.cap) + P(arc(12.4, 12, 7.4, -52, 52), sw, nu.cap); },
  route: (nu, sz) => { const sw = strokeFor(sz, nu); return P('M3.6 10.2c0-.7.5-1.2 1.2-1.2h2.4l4-3.5c.5-.4 1.2-.1 1.2.6v11.8c0 .7-.7 1-1.2.6l-4-3.5H4.8c-.7 0-1.2-.5-1.2-1.2z', sw) + P(arc(12.4, 12, 3.6, -48, 48), sw, nu.cap); },
  // ROUTE, as ONE morphing drawing for the live control: the same body and inner wave always; the ON state fills the
  // body (class rf, fill-opacity) and draws the outer wave (class rw, pathLength 1). app.js animates both together.
  routeMorph: (nu, sz) => {
    const sw = strokeFor(sz, nu), body = 'M3.6 10.2c0-.7.5-1.2 1.2-1.2h2.4l4-3.5c.5-.4 1.2-.1 1.2.6v11.8c0 .7-.7 1-1.2.6l-4-3.5H4.8c-.7 0-1.2-.5-1.2-1.2z';
    return `<path class="rf" d="${body}" fill="currentColor" stroke="none"/>` + P(body, sw) + P(arc(12.4, 12, 3.6, -48, 48), sw, nu.cap) +
      `<path class="rw" d="${arc(12.4, 12, 7.4, -52, 52)}" pathLength="1" stroke-dasharray="1 1" ${S(sw, nu.cap)}/>`;
  },
  // END CALL — the universal laid-down handset, SOLID: the terminal act is the one solid mark in the Call Rail.
  endCall: () => `<path d="${HANDSET}" fill="currentColor"/>`,
  // CALL (entry, in the Conversation line) — the same handset raised, in outline. Not directional: never mirrored.
  call: (nu, sz) => { const sw = strokeFor(sz, nu); return `<g transform="rotate(-135 12 12.6)"><path d="${HANDSET}" ${S(sw)}/></g>`; },

  // ---------------------------------------------------------------- the Conversation line + the voice message (neutral)
  // SEND — vertical on purpose: it needs no mirroring and cannot point "backwards" in either script (G1.1 decision kept).
  send: (nu, sz) => { const sw = strokeFor(sz, nu); return P('M12 19.4V5.2M6.6 10.4 12 5l5.4 5.4', sw); },
  play: () => '<path d="M8.4 6.6v10.8c0 .9 1 1.4 1.7.9l8-5.4c.6-.4.6-1.3 0-1.7l-8-5.4c-.7-.5-1.7 0-1.7.8z" fill="currentColor"/>',
  pause: () => '<rect x="7" y="6" width="3.4" height="12" rx="1.4" fill="currentColor"/><rect x="13.6" y="6" width="3.4" height="12" rx="1.4" fill="currentColor"/>',
  stop: (nu) => `<rect x="7" y="7" width="10" height="10" rx="${nu.r + 0.6}" fill="currentColor"/>`,
};

/** Inner markup for one glyph at one size. */
export const glyph = (name, { size = 24, nuance = 'open', id } = {}) => SIG[name](NUANCES[nuance], size, id);

/** An <svg> element. Decorative unless `label` is given (fixing-accessibility §1: decorative icons are aria-hidden;
 *  the control that holds the glyph carries the name). */
export const sigSvg = (name, { size = 24, nuance = 'open', cls = '', label = null, id } = {}) =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"` +
  (label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true" focusable="false"') + `>${glyph(name, { size, nuance, id })}</svg>`;

export const SIGNATURE_NAMES = Object.keys(SIG);
