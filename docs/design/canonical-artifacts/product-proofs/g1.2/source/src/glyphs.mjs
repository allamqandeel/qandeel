// G1.1 — the proof's drawn glyphs. 24-unit grid, one stroke weight (1.75, C2's ICON_STROKE), round
// caps and joins. PROVISIONAL: C3 froze no icon geometry ("These are not a final icon set").
//
// Two families, never mixed in one role:
//   NAV_GLYPHS    — the persistent navigation family. Painted in qandeel.navigation.machinery
//                   (Living Brass) at EVERY state; the markup gives them no state class at all.
//   FUNC_GLYPHS   — functional controls. Neutral ink (qandeel.state.*), never Brass.
//
// Semantics are chosen so each glyph is TRUE of what it names (a relation may be drawn only if it
// is true): the three world glyphs share one ring — every World type is a World — and differ only
// in who is in it. Nothing overlaps or intersects, because a Shared World is NOT the intersection
// of two personal worlds (CW-00 REV-01: a Shared World is never a converted personal object).

const S = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
const dot = (x, y, r = 1.7) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;
const at = (deg, r = 7.5) => [12 + r * Math.cos((deg * Math.PI) / 180), 12 + r * Math.sin((deg * Math.PI) / 180)].map((v) => +v.toFixed(3));

export const NAV_GLYPHS = {
  // MY_WORLD — one ring, one point inside it, set low and to one side the way the QANDEEL Q carries
  // its structural light-core inside the ring's counter. Offset on purpose: a centred dot in a ring
  // reads as a selected radio button, i.e. as a STATE, which this family must never express.
  mine: `<circle cx="12" cy="12" r="7.5" ${S}/>${dot(14.4, 14.4, 1.9)}`,
  // SHARED_WORLD — the same ring with two people on its edge: one world, more than one person.
  shared: `<circle cx="12" cy="12" r="7.5" ${S}/>${dot(...at(150), 1.9)}${dot(...at(30), 1.9)}`,
  // PUBLIC_WORLD — the same ring, people all the way round it.
  public: `<circle cx="12" cy="12" r="7.5" ${S}/>${dot(...at(270), 1.6)}${dot(...at(30), 1.6)}${dot(...at(150), 1.6)}${dot(...at(90), 1.6)}`,
};

export const FUNC_GLYPHS = {
  // WORLD (doorway) — the reader's own World: one ring, one point inside it, set low and to one side the
  // way the QANDEEL Q carries its structural light-core inside the ring's counter. Offset on purpose:
  // a centred dot in a ring reads as a selected radio button — a STATE — and this is a place.
  depth: `<circle cx="12" cy="12" r="7.5" ${S}/>${dot(14.4, 14.4, 1.9)}`,
  // (R3: this glyph now names «تحليل المحادثة» — the analysis of THIS conversation — not «العالم».)
  mic: `<rect x="9" y="3.8" width="6" height="10.4" rx="3" ${S}/><path d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0M12 17.4v2.8" ${S}/>`,
  // SEND — vertical on purpose, so it needs no mirroring and cannot point "backwards" in either script.
  send: `<path d="M12 18.6V6.2M6.8 11.2 12 6l5.2 5.2" ${S}/>`,
  stop: `<rect x="7.4" y="7.4" width="9.2" height="9.2" rx="2.2" fill="currentColor" stroke="none"/>`,
  keyboard: `<rect x="3.6" y="6.6" width="16.8" height="10.8" rx="2.4" ${S}/><path d="M7.4 10.2h.01M10.4 10.2h.01M13.6 10.2h.01M16.6 10.2h.01M8.6 14h6.8" ${S}/>`,
  // BACK — directional. Drawn pointing to the LEFT (LTR "back"); the stylesheet mirrors it with
  // scaleX(-1) under [dir=rtl], never rotate(180deg) (designing-arabic-frontends §6).
  back: `<path d="M14.6 6.4 9 12l5.6 5.6" ${S}/>`,
  // ---- R3 ----
  // REPLAY — a media glyph: an open ring that returns on itself around a play triangle. Media playback is
  // never mirrored (designing-arabic-frontends §6), so the class list gives it no .mirror.
  replay: `<path d="M5.2 9.6A7.4 7.4 0 1 1 4.8 13.6" ${S}/><path d="M4.4 5.6v4.3h4.3" ${S}/><path d="M10.6 9.4v5.2l4.3-2.6z" fill="currentColor" stroke="none"/>`,
  // CALL — the handset. Not directional: never mirrored.
  call: `<path d="M8.4 4.6c.5 0 .9.3 1.1.8l1 2.5c.2.5.1 1-.3 1.4l-1.3 1.1a10.6 10.6 0 0 0 4.7 4.7l1.1-1.3c.4-.4.9-.5 1.4-.3l2.5 1c.5.2.8.6.8 1.1v2.3c0 .8-.7 1.5-1.5 1.4A15.6 15.6 0 0 1 4.6 6.1c0-.8.6-1.5 1.4-1.5z" ${S}/>`,
  // END CALL — the same handset laid down (rotated 135°), the universal hang-up sign. A shape, not a colour.
  endCall: `<g transform="rotate(135 12 12)"><path d="M8.4 4.6c.5 0 .9.3 1.1.8l1 2.5c.2.5.1 1-.3 1.4l-1.3 1.1a10.6 10.6 0 0 0 4.7 4.7l1.1-1.3c.4-.4.9-.5 1.4-.3l2.5 1c.5.2.8.6.8 1.1v2.3c0 .8-.7 1.5-1.5 1.4A15.6 15.6 0 0 1 4.6 6.1c0-.8.6-1.5 1.4-1.5z" fill="currentColor" stroke="none"/></g>`,
  muted: `<rect x="9" y="3.8" width="6" height="10.4" rx="3" ${S}/><path d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0M12 17.4v2.8M4.6 4.2l14.8 15.6" ${S}/>`,
  play: `<path d="M8.6 6.2v11.6l9.2-5.8z" fill="currentColor" stroke="none"/>`,
  close: `<path d="M7 7l10 10M17 7 7 17" ${S}/>`,
  // ---- G1.2 ----
  pause: `<rect x="7.6" y="6.2" width="3" height="11.6" rx="1" fill="currentColor" stroke="none"/><rect x="13.4" y="6.2" width="3" height="11.6" rx="1" fill="currentColor" stroke="none"/>`,
  // SPEAKER — a loudspeaker with its sound. A toggle: ON = the cone FILLED, OFF = the cone drawn in outline — the
  // state is a change of shape, never of colour alone. Media: never mirrored.
  routeOn: `<path d="M4.6 9.4h3.2l4.6-3.8v12.8l-4.6-3.8H4.6z" fill="currentColor" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M15.4 9.2a4 4 0 0 1 0 5.6M17.8 6.8a7.4 7.4 0 0 1 0 10.4" ${S}/>`,
  route:`<path d="M4.6 9.4h3.2l4.6-3.8v12.8l-4.6-3.8H4.6z" ${S}/><path d="M15.4 9.2a4 4 0 0 1 0 5.6M17.8 6.8a7.4 7.4 0 0 1 0 10.4" ${S}/>`,
};

// G1.2: the R3 static waveform is REMOVED. A waveform drawn from a seed is fake data wearing a semantic shape
// (G1.2 §15: no fake waveform data as semantic truth). A voice message shows its duration and a playback track.

export const svg = (inner, { size = 24, cls = '', label = null } = {}) =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"` +
  (label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true" focusable="false"') + `>${inner}</svg>`;

/** The approved QANDEEL Q (I-08B2.3 reconstruction, I-08B2.5 package), geometry verbatim — never mirrored. */
export const Q_MARK = {
  viewBox: '0 -69.76 1710.08 1235.9',
  paths: [
    'M1059.19 968.2C1000.69 1030.77 930.99 1081.49 852.31 1115.72C780.22 1147.08 702.13 1164.27 623.52 1165.99C551.87 1167.56 480.05 1156.29 412.32 1132.85C347.94 1110.58 287.43 1077.38 233.99 1035.12C186.21 997.34 144.17 952.39 109.59 902.25C-40.81 684.21 -35.06 390.02 122.95 177.58C172.4 111.1 235.24 54.78 306.84 13.06C375.51 -26.96 451.92 -53.37 530.67 -64.15C602.24 -73.96 675.48 -70.84 745.95 -54.96C809.21 -40.71 870.08 -16.23 925.62 17.22C977.84 48.67 1025.25 88 1065.87 133.46C1194.88 277.84 1248.82 479.35 1210.97 669.04C1197.33 737.38 1172.06 802.69 1137.11 862.92L1048.83 821.62C1081.68 765 1104.8 703.5 1116.01 638.93C1145.4 469.81 1091.92 291.18 970.47 169.1C936.01 134.46 896.61 104.77 853.75 81.31C807.84 56.18 758.03 38.26 706.61 28.47C648.9 17.48 589.33 16.78 531.37 26.38C467.44 36.97 405.74 60.06 350.44 93.82C290.36 130.49 238.12 179.57 197.39 236.95C60.25 430.12 67.1 701.57 216.17 886.23C246.72 924.07 282.58 957.6 322.49 985.41C365.08 1015.08 412.2 1038.18 461.79 1053.53C517.27 1070.7 575.69 1078.12 633.7 1075.3C697.56 1072.21 760.66 1056.71 818.77 1030.06C884.07 1000.1 941.8 956.36 989.68 902.93Z',
    'M663.82 896.5C685.9 893.21 708.04 888.9 730.24 886.59C747.91 884.75 765.7 885.39 783.38 883.48C819.38 879.59 858.08 874.67 894.08 881.19C928.66 887.46 962.61 903.24 995.92 914.23C1013.44 920 1031.11 925.6 1049.06 929.85C1062.4 933.01 1076.08 934.4 1088.91 939.44C1199.37 982.85 1304.24 1040.55 1421.02 1066.38C1480.64 1079.56 1541.63 1084.45 1602.56 1080.2C1635.21 1077.93 1667.4 1071.22 1699.98 1068.08L1710.08 1068.82C1664.55 1089.17 1632.81 1107.01 1598.14 1118.09C1538.89 1137.02 1478.72 1146 1416.59 1143.92C1300.26 1140.02 1193.63 1085.97 1088.91 1041.22C1076.14 1035.76 1062.39 1034.08 1049.06 1030.51C1028.03 1024.89 1007.4 1017.55 987.07 1009.81C958.9 999.09 930.13 988.16 902.94 975.14C890.6 969.23 880.28 959.73 867.51 954.67C838.85 943.34 805.14 937.22 774.52 934.71C759.79 933.51 744.9 934.65 730.24 932.59C707.63 929.4 685.55 921.82 663.82 915.1Z',
    'M663.82 871.26C682.9 871.26 698.36 886.72 698.36 905.8C698.36 924.87 682.9 940.34 663.82 940.34C644.75 940.34 629.28 924.87 629.28 905.8C629.28 886.72 644.75 871.26 663.82 871.26Z',
  ],
};

export const qMarkSVG = ({ height = 28, label = null, cls = 'qmark' } = {}) => {
  const [, , w, h] = Q_MARK.viewBox.split(' ').map(Number);
  const width = +(height * (w / h)).toFixed(2);
  return `<svg class="${cls}" width="${width}" height="${height}" viewBox="${Q_MARK.viewBox}" xmlns="http://www.w3.org/2000/svg"` +
    (label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true" focusable="false"') +
    ` fill="currentColor">${Q_MARK.paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
};
