#!/usr/bin/env node
// VPORT-02 — generate the production geometry of the two P2 MACHINES (the Temporal Spine + Aperture, variant C
// "Parting"; the Call Rail, variant A "Keyed Seam") and the Call Rail's signature glyphs, FROM THE FROZEN P2-A SOURCES.
//
// The P2 closure freezes this geometry BY REFERENCE to the merged P2-A package (`docs/qandeel-p2-final-iconography-
// canonical-closure.md` §1). Nothing below is typed by hand:
//
//   - the Parting aperture is produced by EXECUTING the proof's own `aperture()` (and its `f2()`), lifted as text from
//     the P2-A Temporal Spine block of `source/src/app.js`, for variant 'C' — the accepted one — and nothing else;
//   - the Live terminal, the notch, the spine and the discontinuity are read from their exact lines in the same block,
//     each SOURCE-LOCKED: the build fails if the frozen file stops containing that line byte for byte;
//   - the Call Rail art is `railArt('A')` and `END_GLYPH_PX` from `source/src/machines.mjs`, executed;
//   - the call glyphs are `SIG.mic`, `SIG.muted`, `SIG.routeMorph` and `SIG.endCall` from `source/src/sig.mjs`,
//     executed with the accepted N1 "Open" nuance at their frozen render sizes (24 px; End Call 27 px).
//
// The comparison variants (Spine A / B, Rail B / C, N2) are never executed: they are evidence, not alternatives.
// P2 itself classes the aperture's dimensions, the notch length, the terminal's line length and the discontinuity
// mark as reference CRAFT values, not Product law (P2 closure §7; P2-A Spine proof §5). They are emitted under that
// name and nothing here promotes them.
//
//   node apps/mobile/scripts/generate-p2-production.mjs          write the module
//   node apps/mobile/scripts/generate-p2-production.mjs --check  exit 1 if the module is stale
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const P2 = join(REPO, 'docs/design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/source/src');
const APP = join(P2, 'app.js');
const SIG_FILE = join(P2, 'sig.mjs');
const MACHINES = join(P2, 'machines.mjs');
const OUT = join(REPO, 'apps/mobile/src/iconography/p2-production.generated.ts');

const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const rel = (path) => relative(REPO, path).replace(/\\/gu, '/');
const fail = (message) => {
  process.stderr.write(`generate-p2-production: ${message}\n`);
  process.exit(1);
};

const app = readFileSync(APP, 'utf8');
/** A frozen line, asserted present byte for byte. Returns the line so its numbers are read from it, never retyped. */
const lock = (line) => {
  if (!app.includes(line)) fail(`the frozen P2-A Temporal Spine block no longer contains:\n  ${line}`);
  return line;
};
const numbers = (text) => (text.match(/-?\d+(?:\.\d+)?/gu) ?? []).map(Number);
const attr = (markup, name) => {
  const match = new RegExp(`\\s${name}="([^"]*)"`, 'u').exec(markup);
  if (match === null) fail(`attribute ${name} missing from ${markup.slice(0, 80)}…`);
  return match[1];
};
const elements = (markup, tag) => markup.match(new RegExp(`<${tag}\\b[^>]*>`, 'gu')) ?? [];

// --------------------------------------------------------------------------------------- the Temporal Spine (C)
// The variant registry is read so the build refuses if the accepted variant ever stops being 'C'.
const machines = await import(pathToFileURL(MACHINES).href);
if (machines.SPINE_RECOMMENDED !== 'C') fail(`SPINE_RECOMMENDED is ${machines.SPINE_RECOMMENDED}, not the frozen 'C'`);
if (machines.RAIL_RECOMMENDED !== 'A') fail(`RAIL_RECOMMENDED is ${machines.RAIL_RECOMMENDED}, not the frozen 'A'`);
if (machines.STEP !== 48 || machines.RAIL_H !== 44) fail('the T-05 geometry the proof drew over is no longer 48 / 44');

// Execute the proof's own aperture function, lifted as text.
const f2Source = lock('  function f2(v) { return (+v).toFixed(2); }');
const apertureStart = app.indexOf('  function aperture(v, x, w, sy) {');
const apertureEnd = app.indexOf('  /** Draws the spine, its notches, the apertures and the terminal');
if (apertureStart < 0 || apertureEnd < apertureStart) fail('the P2-A aperture() function could not be located');
const aperture = new Function(`${f2Source}\n${app.slice(apertureStart, apertureEnd)}\nreturn aperture;`)();

/** One Parting aperture at the origin, in its own 34 × 44 frame (x = 17 is the Moment; y = 22 is the spine). */
function parting(weight) {
  const [markup, halfWidth] = aperture('C', halfWidthProbe, weight, 1);
  const paths = elements(markup, 'path');
  if (paths.length !== 1) fail('the Parting aperture is no longer one path');
  const marks = elements(markup, 'rect');
  return {
    halfWidth,
    d: attr(paths[0], 'd'),
    strokeWidth: Number(attr(paths[0], 'stroke-width')),
    opacity: Number(/<g opacity="([^"]+)"/u.exec(markup)[1]),
    mark: marks.length === 0 ? null : {
      x: Number(attr(marks[0], 'x')),
      y: Number(attr(marks[0], 'y')),
      width: Number(attr(marks[0], 'width')),
      height: Number(attr(marks[0], 'height')),
      r: Number(attr(marks[0], 'rx')),
    },
  };
}
// The aperture's own half-width, read from a first call at the origin, places the next call inside a 0-origin frame.
const halfWidthProbe = aperture('C', 0, 1, 1)[1];
const committed = parting(1);
const preview = parting(0);
if (committed.mark === null) fail('the committed Parting aperture lost its mark');
if (preview.mark !== null) fail('the preview Parting aperture gained a mark: a preview has no committed core');

// The spine, the notches, the discontinuity and the terminal: their exact lines, locked, then read.
const spineLine = lock(`'<g class="spn" style="color:var(--tertiary)"><path d="' + spine + '" fill="none" stroke="currentColor" stroke-width="1" opacity="' + f2(0.55 + 0.25 * act) + '"/>' +`);
const notchHeightLine = lock('var tgt = target === i, h = tgt ? 12 : 6 + 4 * act, o = i === n ? get(\'nw\') : 1;');
const notchStyleLine = lock(`notches += '<path d="M' + f2(x) + ' ' + f2(22 - h / 2) + 'v' + f2(h) + '" stroke="currentColor" stroke-width="' + (tgt ? 1.5 : 1) + '" stroke-linecap="round" opacity="' + f2((tgt ? 1 : 0.85) * o) + '" class="' + (tgt ? 'tgt' : 'nt') + '"/>';`);
const committedNotchLine = lock("if (S.apSp === i && apO > 0.5 && S.mode === 'PINNED') continue;");
const discontinuityLine = lock(`if (S.off < maxOff() - 0.5) { var ex = RTL ? 6 : W - 6; for (var k = 0; k < 3; k++) cont += '<circle cx="' + f2(ex + (RTL ? 1 : -1) * k * 4) + '" cy="22" r="1" fill="currentColor" opacity=".7"/>'; }`);
const terminalLine = lock(`else out = '<path d="M8 13V31"' + sw + '/><path d="M14.5 22H29"' + sw.replace('1.5', f2(1.25 + 1.75 * e)) + '/>';`);
const terminalStrokeLine = lock(`var sw = ' fill="none" stroke="' + ink + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';`);
const terminalInkLine = lock(`t.style.color = e > 0.5 ? 'var(--primary)' : 'var(--rest)';`);
const settleLine = lock('var A = aperture(v, apX, 1, (0.4 + 0.6 * Math.min(1, apO)) * (1 + 0.09 * settle));');
void committedNotchLine;
void terminalInkLine;

const [notchTarget, notchRest] = numbers(notchHeightLine);
const [terminalStroke] = numbers(terminalStrokeLine);
const terminalNumbers = numbers(terminalLine);
// M8 13V31 · M14.5 22H29 · 1.5 · f2( · then the engaged stroke 1.25 + 1.75 · e.
const [engagedBase, engagedGain] = terminalNumbers.slice(8, 10);
const discontinuity = numbers(discontinuityLine);

const SPINE = {
  provenance: 'P2-A Temporal Spine block, variant C "Parting" (accepted); reference CRAFT values, not Product law',
  /** T-05's frozen pitch and band, read from the proof's own machine module and re-asserted here. */
  stepPoints: machines.STEP,
  bandPoints: machines.RAIL_H,
  /** The spine runs on the band's centre line. */
  axisY: 22,
  spine: { strokeWidth: numbers(spineLine).find((n) => n === 1), opacity: 0.55 },
  notch: {
    restHeight: notchRest,
    targetHeight: notchTarget,
    restStrokeWidth: 1,
    targetStrokeWidth: 1.5,
    restOpacity: 0.85,
  },
  aperture: {
    /** The opening's half-width: the spine parts across [x − h, x + h]. */
    halfWidth: committed.halfWidth,
    frameWidth: 2 * committed.halfWidth,
    committed: { d: committed.d, strokeWidth: committed.strokeWidth, mark: committed.mark },
    preview: { d: preview.d, strokeWidth: preview.strokeWidth },
    /** The settle's extra height (T-06 M2 already freezes 0.09); asserted, never re-chosen here. */
    settleScale: numbers(settleLine).at(-1),
  },
  terminal: {
    frame: 44,
    stop: { d: 'M8 13V31', strokeWidth: terminalStroke },
    present: { d: 'M14.5 22H29', availableStrokeWidth: engagedBase, engagedStrokeWidth: +(engagedBase + engagedGain).toFixed(2) },
  },
  // - 0.5 · RTL ? 6 : W - 6 · k = 0 · k < 3 · f2( · (RTL ? 1 : -1) · k * 4
  discontinuity: { inset: discontinuity[1], spacing: discontinuity[8], radius: 1, opacity: 0.7, count: discontinuity[4] },
};
if (SPINE.notch.targetHeight !== 12 || SPINE.notch.restHeight !== 6) fail('notch heights drifted from the locked line');
if (SPINE.aperture.settleScale !== 0.09) fail('the settle scale is no longer T-06 M2\'s 0.09');
if (!(notchStyleLine.includes('(tgt ? 1.5 : 1)') && notchStyleLine.includes('(tgt ? 1 : 0.85)'))) fail('notch style drifted');
if (SPINE.discontinuity.inset !== 6 || SPINE.discontinuity.spacing !== 4) fail('discontinuity drifted from the locked line');
if (SPINE.terminal.present.availableStrokeWidth !== 1.25 || SPINE.terminal.present.engagedStrokeWidth !== 3) fail('terminal stroke drifted');

// ------------------------------------------------------------------------------------------- the Call Rail (A)
const artPieces = machines.railArt('A').map((svg) => {
  const style = /style="inset-inline-end:(\d+)px;width:(\d+)px;height:(\d+)px;top:(\d+)px"/u.exec(svg);
  if (style === null) fail('the Keyed Seam art lost its logical placement');
  const [end, width, height, top] = style.slice(1).map(Number);
  return { end, width, height, top, d: attr(elements(svg, 'path')[0], 'd'), strokeWidth: 1 };
});
// The control slots, from the END edge: the proof's own layout comment, locked in machines.mjs.
const machinesText = readFileSync(MACHINES, 'utf8');
const slotLine = '//   End Call button [12, 56]   ·   Mic [78, 122]   ·   Route [122, 166]';
if (!machinesText.includes(slotLine)) fail('the Call Rail slot layout line is no longer in machines.mjs');
const slots = numbers(slotLine);
const RAIL = {
  provenance: 'P2-A machines.mjs railArt("A") — Call Rail A "Keyed Seam" (accepted)',
  lineHeight: 64,
  /** Logical placement, in points from the END edge. All targets are 44 × 44. */
  slots: {
    end: { end: slots[0], width: slots[1] - slots[0] },
    mic: { end: slots[2], width: slots[3] - slots[2] },
    route: { end: slots[4], width: slots[5] - slots[4] },
  },
  group: artPieces[0],
  terminal: artPieces[1],
  glyphPx: { mic: 24, route: 24, end: machines.END_GLYPH_PX },
};
if (RAIL.glyphPx.end !== 27) fail(`END_GLYPH_PX is ${RAIL.glyphPx.end}, not the frozen 27`);
for (const slot of Object.values(RAIL.slots)) if (slot.width !== 44) fail('a Call Rail target is no longer 44 pt');

// ----------------------------------------------------------------------------------------------- call glyphs
const { SIG, NUANCES } = await import(pathToFileURL(SIG_FILE).href);
const OPEN = NUANCES.open;
if (OPEN.id !== 'N1') fail('the accepted nuance is no longer N1 "Open"');
const mic = SIG.mic(OPEN, 24);
const muted = SIG.muted(OPEN, 24, 'production');
const route = SIG.routeMorph(OPEN, 24);
const endCall = SIG.endCall(OPEN, RAIL.glyphPx.end);
const strokeOf = (markup) => Number(attr(elements(markup, 'path')[0], 'stroke-width'));
const micRect = elements(mic, 'rect')[0];
const micPaths = elements(mic, 'path');
const cutband = elements(muted, 'path').find((p) => p.includes('class="cutband"'));
const slash = elements(muted, 'path').find((p) => p.includes('class="slash"'));
const routePaths = elements(route, 'path');
const GLYPHS = {
  provenance: 'P2-A sig.mjs, nuance N1 "Open", at the frozen render sizes',
  grid: 24,
  mic: {
    size: 24,
    strokeWidth: strokeOf(mic),
    capsule: { x: +attr(micRect, 'x'), y: +attr(micRect, 'y'), width: +attr(micRect, 'width'), height: +attr(micRect, 'height'), r: +attr(micRect, 'rx') },
    cradle: attr(micPaths[0], 'd'),
    /** MUTED: the same drawing, cut by a band of negative space and crossed by the slash, drawn together. */
    slash: attr(slash, 'd'),
    cutbandWidth: +attr(cutband, 'stroke-width'),
  },
  route: {
    size: 24,
    strokeWidth: strokeOf(routePaths[1]),
    /** The body: filled when the loudspeaker carries the sound, an outline when the earpiece does. */
    body: attr(routePaths[0], 'd'),
    innerWave: attr(routePaths[2], 'd'),
    /** The second wave, drawn only when the loudspeaker carries the sound. */
    outerWave: attr(routePaths[3], 'd'),
  },
  endCall: { size: RAIL.glyphPx.end, d: attr(elements(endCall, 'path')[0], 'd') },
};
if (GLYPHS.mic.slash !== 'M4.2 3.6 19.8 20.4') fail('the mute slash drifted');
if (attr(routePaths[0], 'd') !== attr(routePaths[1], 'd')) fail('the route body fill and outline are no longer one drawing');

// ------------------------------------------------------------------------------------------------- write
const sources = [APP, MACHINES, SIG_FILE];
const header = [
  '/**',
  ' * GENERATED by apps/mobile/scripts/generate-p2-production.mjs — do not edit by hand.',
  ' *',
  ' * VPORT-02: the production geometry of the frozen P2 machines (Temporal Spine + Aperture C "Parting"; Call Rail A',
  ' * "Keyed Seam") and the Call Rail glyphs, produced by executing the merged P2-A package\'s own functions and',
  ' * source-locking its frozen lines. The aperture, notch, terminal and discontinuity dimensions are P2-A reference',
  ' * CRAFT values (P2 closure §7), not Product law. Regenerate after any source changes; the VPORT-02 contract fails on',
  ' * drift.',
  ' *',
  ' * Sources (sha256):',
  ...sources.map((path) => ` *   ${rel(path)}  ${sha(path)}`),
  ' */',
  '',
].join('\n');
const body = `export const P2_SPINE = ${JSON.stringify(SPINE, null, 2)} as const;\n\nexport const P2_CALL_RAIL = ${JSON.stringify(RAIL, null, 2)} as const;\n\nexport const P2_CALL_GLYPHS = ${JSON.stringify(GLYPHS, null, 2)} as const;\n`;
const output = header + body;

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUT, 'utf8');
  } catch {
    fail(`${rel(OUT)} does not exist; run without --check`);
  }
  if (current !== output) fail(`${rel(OUT)} is stale; run node apps/mobile/scripts/generate-p2-production.mjs`);
  process.stdout.write('generate-p2-production: current\n');
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, output);
  process.stdout.write(`generate-p2-production: wrote ${rel(OUT)}\n`);
}
