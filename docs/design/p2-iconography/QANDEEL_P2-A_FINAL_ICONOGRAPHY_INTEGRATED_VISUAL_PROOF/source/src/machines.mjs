// P2-A — the two signature MACHINES (task §4.2, §4.3), as measured geometry. Their runtime drawing lives in app.js
// (the Temporal Spine is drawn every frame from the temporal state); this module holds their static parts and the
// variant registry, so build, boards and checks read one source.
//
// ------------------------------------------------------------------------------------------------ THE CALL RAIL
// One low-profile machine on the call line (FIELD, G1.2): Mic and the audio route belong to ONE group; End Call is a
// related but SEPARATED terminal. Every variant is drawn only with the neutral tertiary hairline (B4R: nesting adds no
// tonal step, APPARATUS/FIELD take no second tone) — the End terminal's rank comes from geometry, separation and its
// solid glyph, never from a new colour (no canonical grant exists for a red End Call; E1R's error ink is retrospective).
//
// Logical layout, in points from the END edge (the physical right in English, the left in Arabic):
//   End Call button [12, 56]   ·   Mic [78, 122]   ·   Route [122, 166]
// Each art element is drawn in a local frame whose x grows toward the END edge, and is mirrored as a whole under RTL
// (this is layout direction, so it mirrors; the glyphs inside never do).
export const RAIL_VARIANTS = {
  A: { name: 'Keyed seam', note: 'the group and the terminal are two pieces of one plate, cut apart on a parallel slant' },
  B: { name: 'Open tray', note: 'the group rests in an open tray; the terminal\'s tray rises on its outer side only' },
  C: { name: 'Break line', note: 'no enclosure: one baseline carries the group and flicks up where it breaks; the terminal stands on its own plinth' },
};
export const RAIL_RECOMMENDED = 'A';

const HAIR = 'fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"';
const art = (cls, end, w, h, top, d, extra = '') =>
  `<svg class="cr-art ${cls}" style="inset-inline-end:${end}px;width:${w}px;height:${h}px;top:${top}px" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><path d="${d}" ${HAIR}${extra}/></svg>`;

/** The rail's static art for one variant: [group, terminal]. The local frame's x grows toward the END edge. */
export function railArt(v) {
  if (v === 'A') return [
    // group [70, 174]: rounded on its START side; its END side is a slant whose top leans toward the terminal
    art('cr-group', 70, 104, 48, 8, 'M16 .5H103.5L95.5 47.5H16A15.5 15.5 0 0 1 .5 32V16A15.5 15.5 0 0 1 16 .5Z'),
    // terminal [6, 74]: its START side is the same slant, 7 pt away — one plate, keyed and broken
    art('cr-term', 6, 68, 48, 8, 'M10.5 .5H52A15.5 15.5 0 0 1 67.5 16V32A15.5 15.5 0 0 1 52 47.5H2.5Z'),
  ];
  if (v === 'B') return [
    art('cr-group', 70, 104, 48, 8, 'M.8 18V32A15 15 0 0 0 15.8 47.2H88.2A15 15 0 0 0 103.2 32V18'),
    art('cr-term', 6, 60, 48, 8, 'M.8 34A13.2 13.2 0 0 0 14 47.2H44.2A15 15 0 0 0 59.2 32V.8'),
  ];
  return [
    art('cr-group', 70, 104, 48, 8, 'M.5 47.5H96L103.5 39.5'),
    art('cr-term cr-plinth', 6, 60, 48, 8, 'M8 47.5H52', ' stroke-width="2"'),
  ];
}

// --------------------------------------------------------------------------------------- THE TEMPORAL SPINE
// The Timeline's visible machine, drawn over T-05's invisible geometry: every committed Moment keeps its 48-pt
// ordinal step, the interaction band keeps its 44-pt height, and the visible spine is a 1-pt hairline. The Aperture
// OPENS the spine at the current / preview Moment; the Live edge is a separate TERMINAL beyond the spine's end, in
// T-05's outboard slot, and never takes a Moment's form.
export const SPINE_VARIANTS = {
  A: { name: 'Lens', note: 'the spine breaks and a floating lens holds the Moment; committed = lens + core, preview = lighter lens' },
  B: { name: 'Gate', note: 'the spine breaks and turns into two lips; committed = heavier lips + core, preview = hairline lips' },
  C: { name: 'Parting', note: 'the spine itself parts around the Moment and rejoins; committed = the Moment\'s mark inside the opening' },
};
export const SPINE_RECOMMENDED = 'C';
export const STEP = 48;          // T-05: every committed Moment occupies 48 RN layout pixels (unchanged)
export const RAIL_H = 44;        // T-05: the position rail / interaction band is 44 pixels high (unchanged)
