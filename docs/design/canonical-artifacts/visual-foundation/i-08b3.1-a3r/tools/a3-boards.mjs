/**
 * I-08B3.1-A3 - the boards.
 *
 * Order matters. The reading boards run first because they carry the question; the product
 * environments follow, because a reading value that fails on a page of Arabic cannot be
 * rescued by a screen around it. The derived boards (blind, magnified, mobile pair) are CUT
 * FROM THE PIXELS of the boards above them and are never re-rendered, so nothing can drift
 * between a labelled board and its derived twin.
 *
 * Boards that COMPARE candidates always draw them through the same code path with the
 * candidate as an argument, never as two hand-written blocks.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { page, barePage, head, cap, cap2, esc, PKG, BENCH } from './a3-ui.mjs';
import { render, COND_A2, COND_MOBILE, chromeVersion } from './a3-render.mjs';
import {
  WORLD, SECONDARY, TERTIARY, CONTROL, P1, P2, FINALISTS, CANDIDATES,
  ROLES, COPY, oklchOf, diagSubtle, probeSwatches, DIAG_SUBTLE_DELTA_L,
} from './a3-model.mjs';
import { productFrame, assertNoDecor, ENVIRONMENTS, DESKTOP, MOBILE, METADATA_WEIGHT } from './a3-env.mjs';
import { varsFor, diagEdge } from './a3-vars.mjs';
import { contrastHex, hexToRgb8 } from './color.mjs';
import { decode, encode, crop, upscale, paste, blank } from './png.mjs';

const OUT = join(PKG, 'review');
const FAIL = join(OUT, 'failures');
for (const d of [OUT, FAIL]) if (!existsSync(d)) mkdirSync(d, { recursive: true });

/**
 * 1440 is the established A2 board canvas and every product environment uses it unchanged.
 * 1990 is wider, and is used ONLY where three columns each have to carry the full frozen
 * 560 px Arabic measure - shrinking the measure to fit a 1440 board would have made the
 * reading boards test a narrower column than the Product uses, which is the one thing a
 * reading proof may not do.
 */
const BOARD = 1440;
const WIDE = 1990;
const PADCOL = 28;
const COL = DESKTOP.measure + PADCOL * 2;   // 616

/**
 * The raster condition for the wide bench. deviceScaleFactor, colour profile and antialiasing
 * are IDENTICAL to COND_A2; only the bench canvas is wider, because the bench is board chrome
 * and not part of what is being tested. The product environments all use COND_A2 unchanged, so
 * the A3.7 comparison is between COND_A2 and COND_MOBILE and nothing else.
 */
const COND_WIDE = { ...COND_A2, viewport: WIDE, label: 'A2 proof condition on a wider bench canvas' };

const f = (n, d = 4) => (n === null || n === undefined || Number.isNaN(n) ? 'none' : n.toFixed(d));
const R = ROLES;
const SUB = diagSubtle().hex;
const EDGE = diagEdge().hex;

const results = [];
const record = (r) => { results.push(r); return r; };
const geo = {};

/** The two surfaces every reading value has to hold on. The second is DIAGNOSTIC. */
const SURFACES = [
  { name: 'World Base', hex: WORLD, note: 'the sole incumbent World Base' },
  { name: `Diagnostic Subtle dL +${DIAG_SUBTLE_DELTA_L}`, hex: SUB, note: 'NON-CANONICAL proof surface carried from A2' },
];

/** One Arabic specimen in one frozen role. letter-spacing pinned to 0, always. */
const sp = (text, role, hex, { mt = 0, weight = null, w = null, rect = null } = {}) =>
  `<p class="ar"${rect ? ` data-qp-rect="${rect}"` : ''} style="font-size:${role.size}px;` +
  `line-height:${role.leading}px;font-weight:${weight ?? role.weight};color:${hex};` +
  `margin-top:${mt}px;letter-spacing:0;${w ? `width:${w}px;` : ''}">` +
  esc(text).replace(/\n/g, '<br>') + `</p>`;

/** The measurement line printed under every candidate panel. Rendered values, not authored. */
function specOf(hex) {
  const o = oklchOf(hex);
  return `<div class="spec">L ${f(o[0])} &nbsp; C ${f(o[1])} &nbsp; H ${f(o[2], 1)}<br>` +
    `vs World Base ${contrastHex(hex, WORLD).toFixed(3)}:1 &nbsp; vs Diagnostic Subtle ${contrastHex(hex, SUB).toFixed(3)}:1<br>` +
    `lightness remaining above this value: ${f(1 - o[0])}</div>`;
}

/**
 * The rightmost and leftmost INKED columns inside a reported element box.
 *
 * Magnification crops are anchored to the ink, never to the box. An RTL paragraph's border box
 * is the full column width while its glyphs occupy only part of it, and the two edges do not
 * have to coincide - the first run of this board anchored on `rect.x + rect.w` and cut the
 * first word off the right-hand end of every specimen, which on a right-to-left line is the
 * beginning of the sentence. Reading the pixels removes the whole class of error: whatever the
 * box says, the crop ends where the glyphs end.
 *
 * `margin` is in luminance units above the known surface, so an antialiased glyph edge counts
 * as ink and a quantisation wobble in the ground does not.
 */
export function inkExtent(img, rc, dpr, bgHex, margin = 12) {
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const base = lum(...hexToRgb8(bgHex));
  const x0 = Math.max(0, Math.round(rc.x * dpr));
  const x1 = Math.min(img.width, Math.round((rc.x + rc.w) * dpr));
  const y0 = Math.max(0, Math.round(rc.y * dpr));
  const y1 = Math.min(img.height, Math.round((rc.y + rc.h) * dpr));
  let minX = x1, maxX = x0 - 1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      if (lum(img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]) - base > margin) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (maxX < minX) throw new Error(`inkExtent: no ink found inside the reported box ${JSON.stringify(rc)}`);
  return { minX, maxX, x0, x1, y0, y1 };
}

/** A right-anchored magnification tile cut from the ink of one reported element. */
function inkTile(img, rc, dpr, bgHex, { cropW, cropH, factor }) {
  const e = inkExtent(img, rc, dpr, bgHex);
  const right = Math.min(img.width, e.maxX + 2);
  const x = Math.max(0, right - cropW * dpr);
  const y = Math.max(0, e.y0);
  return upscale(crop(img, x, y, Math.min(cropW * dpr, img.width - x), cropH * dpr), factor / dpr);
}

const candLabel = (c) =>
  c.key === 'C' ? `CONTROL - A1 PRIMARY ${c.hex}  (reference only, NOT a finalist)`
                : `${c.name} ${c.hex}   A1 Primary L -${c.drop}`;

/* =================================================== A3.1 primary reading closure ===== */

/**
 * Board 1 - the frozen type roles, at true size, in all three candidates.
 *
 * Every role the brief names is present once, in the order a screen uses them, in identical
 * copy and at the identical 560px measure. Nothing is enlarged and nothing else is shrunk.
 * The control is here to show what A1 had, and is labelled as not a finalist on the board
 * itself so a reviewer cannot mistake it for a third option.
 */
async function readingRoleMatrix() {
  const col = (c) => {
    const body = sp(COPY.deep.title, R.screenTitle, c.hex) +
      sp(COPY.deep.statement, R.statement, c.hex, { mt: 22 }) +
      sp(COPY.deep.statement, R.compactStmt, c.hex, { mt: 26 }) +
      sp(COPY.deep.section, R.sectionTitle, c.hex, { mt: 30 }) +
      sp(COPY.deep.paras[0], R.body, c.hex, { mt: 16 });
    return `<div style="width:${COL}px;">` + cap2(candLabel(c)) +
      `<div style="background:${WORLD};padding:${PADCOL}px;">${body}</div>` + specOf(c.hex) + `</div>`;
  };
  const html = page('READ01', `<div class="board">` +
    head('A3.1 - PRIMARY READING CLOSURE: THE FROZEN TYPE ROLES AT TRUE SIZE',
      `Screen Title 26/42/600, Meaningful Statement 32/52/500, Compact Meaningful Statement 26/42/500, Section Title 20/33/600, Primary Body 17/30/400 - ` +
      `Estedad v8.5, zero tracking, identical realistic Arabic, identical ${DESKTOP.measure}px measure, identical order, on the identical World Base ${WORLD}. ` +
      `The ONLY difference between these three columns is the Primary Reading Neutral. The control is the A1 value and is not a finalist; it is on the board to show what was gained and lost, ` +
      `and the decision is between P1 and P2. No logo, no glow, no gradient, no card, no accent.`) +
    `<div class="row">${CANDIDATES.map(col).join('')}</div>` +
    `<div class="note">All three clear WCAG 2.2 SC 1.4.3 at 4.5:1 on both surfaces by a wide margin, and all three clear the 7:1 that Apple's Dark Mode guidance asks of custom ` +
    `foreground and background colours. A contrast ratio therefore cannot answer this board - it separates none of them. What the raster can show is what the Arabic does at each value.</div>` +
    `</div>`, { width: WIDE });
  return record(await render(html, join(OUT, 'READING_01_ROLE_MATRIX.png'), 'READING_01_ROLE_MATRIX', { cond: COND_WIDE }));
}

/* ====================================================== A3.3 long Arabic reading ====== */

/**
 * Board 2 - sustained analytical reading. This is the board that carries the most weight.
 *
 * Six paragraphs of real QANDEEL analytical Arabic at Primary Body 17/30/400 in a 560px
 * column, the established comfort zone, with the statement and the section title that would
 * really precede them and the supporting line and metadata that would really follow. The
 * question is sustained comfort over a page, not first-glance brightness.
 */
async function readingLongForm() {
  const col = (c) => {
    const inner = sp(COPY.deep.statement, R.compactStmt, c.hex) +
      sp(COPY.deep.section, R.sectionTitle, c.hex, { mt: 34 }) +
      COPY.deep.paras.map((p, i) => sp(p, R.body, c.hex, { mt: i === 0 ? 16 : 24 })).join('') +
      sp(COPY.deep.supporting, R.supporting, SECONDARY, { mt: 30 }) +
      sp(COPY.deep.meta, R.metadata, TERTIARY, { mt: 14, weight: METADATA_WEIGHT });
    return `<div style="width:${COL}px;">` + cap2(candLabel(c)) +
      `<div data-qp-rect="col-${c.key}" style="background:${WORLD};padding:${PADCOL}px;">${inner}</div>` +
      specOf(c.hex) + `</div>`;
  };
  const html = page('READ02', `<div class="board">` +
    head('A3.3 - SUSTAINED ARABIC ANALYTICAL READING',
      `Six paragraphs of real QANDEEL analytical prose at Primary Body 17/30/400 in a ${DESKTOP.measure}px column - the established 520-600px comfort zone - preceded by the Compact ` +
      `Meaningful Statement and the Section Title that would really precede them, and followed by the Supporting Body in the unchanged Secondary ${SECONDARY} and Metadata 12/20/500 in the ` +
      `unchanged Tertiary ${TERTIARY}. No Lorem Ipsum and no specimen filler: this is the copy the Product would actually set. Judge sustained comfort over the page, not first-glance brightness.`) +
    `<div class="row">${CANDIDATES.map(col).join('')}</div>` +
    `</div>`, { width: WIDE });
  return record(await render(html, join(OUT, 'READING_02_LONG_FORM.png'), 'READING_02_LONG_FORM', { cond: COND_WIDE }));
}

/**
 * The blind board is CUT FROM THE PIXELS of READING_02 rather than re-rendered, so the two
 * cannot drift apart - they are literally the same pixels.
 *
 * READING X is P2 and READING Y is P1. The mapping is deliberately not in candidate order, it
 * lives only in the documentation and in A3_MEASUREMENTS, and it appears nowhere in the image.
 * The control is not in the blind board at all: the blind comparison is between the two
 * finalists, which is what the Director has to decide.
 */
export const BLIND_MAP = { X: 'P2', Y: 'P1' };

async function blindReading(r) {
  const cut = (key) => {
    const rc = r.rects[`col-${key}`];
    if (!rc) throw new Error(`blind board: no rect for column ${key}`);
    return crop(r.img, rc.x * r.dpr, rc.y * r.dpr, rc.w * r.dpr, rc.h * r.dpr);
  };
  const xImg = cut(BLIND_MAP.X), yImg = cut(BLIND_MAP.Y);
  const PAD = 30, GAP = 34, LBL = 46;
  const W = PAD * 2 + GAP + xImg.width + yImg.width;
  const H = PAD * 2 + LBL + Math.max(xImg.height, yImg.height);
  const canvas = blank(W, H, hexToRgb8(BENCH.bg));
  paste(canvas, xImg, PAD, PAD + LBL);
  paste(canvas, yImg, PAD + xImg.width + GAP, PAD + LBL);
  drawText(canvas, 'READING X', PAD + 6, PAD + 8, hexToRgb8(BENCH.ink), 4);
  drawText(canvas, 'READING Y', PAD + xImg.width + GAP + 6, PAD + 8, hexToRgb8(BENCH.ink), 4);
  writeFileSync(join(OUT, 'BLIND_READING_X_Y.png'), encode(canvas));
  console.log(`  BLIND_READING_X_Y (cut from READING_02)     ${W}x${H}px`);
  return record({ name: 'BLIND_READING_X_Y', path: join(OUT, 'BLIND_READING_X_Y.png'), width: W, height: H });
}

/* ======================================================= A3.2 hierarchy coherence ===== */

/**
 * Board 3 - the complete unchanged reading relationship.
 *
 * Primary against the unchanged Secondary #afaca3 against the unchanged Tertiary #8b8982, on
 * BOTH surfaces, for all three candidates. Material 3 puts the rule plainly: "on surface" and
 * "on surface variant" are used "on all types of surfaces", so a content value has to hold its
 * relationship on every surface it can reach, not only on the darkest one.
 *
 * The table under each row is evidence, not the decision. Ratios cannot say whether a
 * hierarchy reads; they can only say whether it is legal.
 */
async function hierarchyRamp() {
  const block = (c, s) => {
    const inner =
      sp(COPY.deep.section, R.sectionTitle, c.hex) +
      sp(COPY.deep.paras[1], R.body, c.hex, { mt: 14 }) +
      sp(COPY.deep.supporting, R.supporting, SECONDARY, { mt: 20 }) +
      sp(COPY.deep.meta, R.metadata, TERTIARY, { mt: 14, weight: METADATA_WEIGHT });
    return `<div style="width:${COL}px;">` + cap2(`${s.name}   ${s.hex}`) +
      `<div style="background:${s.hex};padding:${PADCOL}px;">${inner}</div></div>`;
  };
  const dL = (a, b) => oklchOf(a)[0] - oklchOf(b)[0];
  const row = (c) => {
    const steps = [
      ['Primary -> Secondary', dL(c.hex, SECONDARY)],
      ['Secondary -> Tertiary', dL(SECONDARY, TERTIARY)],
    ];
    const tbl = `<table class="t" style="margin-top:14px;">` +
      `<tr><th>role</th><th>hex</th><th>L</th><th>vs World Base</th><th>vs Diagnostic Subtle</th><th>WCAG floor</th><th>Apple dark 7:1</th></tr>` +
      [['Primary 17/30/400', c.hex], ['Secondary 15/25/400', SECONDARY], [`Tertiary 12/20/${METADATA_WEIGHT}`, TERTIARY]]
        .map(([n, h]) => {
          const worst = Math.min(contrastHex(h, WORLD), contrastHex(h, SUB));
          return `<tr><td>${n}</td><td class="mono">${h}</td><td>${f(oklchOf(h)[0])}</td>` +
            `<td>${contrastHex(h, WORLD).toFixed(3)}:1</td><td>${contrastHex(h, SUB).toFixed(3)}:1</td>` +
            `<td>4.5:1 ${worst >= 4.5 ? 'PASS' : 'FAIL'}</td><td>${worst >= 7 ? 'meets' : 'BELOW - ' + worst.toFixed(2) + ':1'}</td></tr>`;
        }).join('') + `</table>`;
    const ladder = `<div class="spec">OKLCH lightness steps down the ramp: ` +
      steps.map(([n, v]) => `${n} ${f(v)}`).join(' &nbsp;|&nbsp; ') +
      `<br>step ratio (first step / second step): ${(steps[0][1] / steps[1][1]).toFixed(3)} ` +
      `- 1.000 would be a perfectly even three-level ramp</div>`;
    return `<div class="sect">` + cap(candLabel(c)) +
      `<div class="row">${SURFACES.map((s) => block(c, s)).join('')}</div>` + ladder + tbl + `</div>`;
  };
  const html = page('HIER', `<div class="board">` +
    head('A3.2 - HIERARCHY COHERENCE: PRIMARY vs SECONDARY vs TERTIARY, ON BOTH SURFACES',
      `The Secondary ${SECONDARY} and the Tertiary ${TERTIARY} are UNCHANGED and are not under test. A3 asks only whether each Primary candidate still works coherently with them. ` +
      `Both surfaces are shown because a content value has to hold its relationship on every surface it can reach; the second surface is the NON-CANONICAL diagnostic Subtle carried from A2, ` +
      `not a Subtle token and not a decision about surface hierarchy. The tables are evidence, not the answer - every value on this board is legal, so a ratio cannot separate them.`) +
    CANDIDATES.map(row).join('') +
    `</div>`, { width: BOARD });
  return record(await render(html, join(OUT, 'HIERARCHY_RAMP.png'), 'HIERARCHY_RAMP'));
}

/* ========================================================= A3.5 luminous headroom ===== */

/**
 * Board 4 - is there credible perceptual headroom left above the reading?
 *
 * The four chips are the same TEMPORARY ACHROMATIC DIAGNOSTIC PROBE A2 used: chroma exactly 0,
 * no hue, no glow, no bloom, no gradient, no aura. They are NOT QANDEEL Light and are NOT a
 * proposal for it. QANDEEL Light remains entirely undesigned.
 *
 * The board answers ONE question - whether the chosen Primary leaves credible perceptual
 * headroom for a future earned emphasis - and it does not state how many levels exist, does
 * not derive a token, and does not extend its answer from fills to text or to small marks.
 */
async function headroom() {
  const CHIP = (COL - PADCOL * 2 - 18) / 4;
  const col = (c) => {
    const chips = probeSwatches().map((s) =>
      `<div style="background:${s.hex};width:${CHIP}px;height:30px;"></div>`).join('');
    const lbl = probeSwatches().map((s) =>
      `<div style="width:${CHIP}px;" class="spec">L ${s.authored.L.toFixed(2)}<br>${s.hex}</div>`).join('');
    return `<div style="width:${COL}px;">` + cap2(candLabel(c)) +
      `<div style="background:${WORLD};padding:${PADCOL}px;">` +
        sp(COPY.deep.section, R.sectionTitle, c.hex) +
        sp(COPY.deep.paras[0], R.body, c.hex, { mt: 14 }) +
        sp(COPY.deep.supporting, R.supporting, SECONDARY, { mt: 20 }) +
        sp(COPY.deep.meta, R.metadata, TERTIARY, { mt: 14, weight: METADATA_WEIGHT }) +
        `<div style="margin-top:26px;display:flex;gap:6px;">${chips}</div>` +
      `</div>` +
      `<div style="display:flex;gap:6px;margin-top:8px;">${lbl}</div>` +
      specOf(c.hex) + `</div>`;
  };
  const html = page('HEAD', `<div class="board">` +
    head('A3.5 - LUMINOUS HEADROOM CONTROL (ACHROMATIC DIAGNOSTIC)',
      `The four chips are a TEMPORARY ACHROMATIC DIAGNOSTIC PROBE - chroma exactly 0.0000, no hue, no glow, no bloom, no gradient, no aura. They are NOT QANDEEL Light, they are NOT a ` +
      `proposal for it, and this board derives no Light tokens and states no number of Light levels. QANDEEL Light remains entirely undesigned and non-canonical. The only question here is ` +
      `whether the chosen Primary leaves credible perceptual headroom above the reading for a future earned emphasis. The probe is identical in all three columns and cannot differ between candidates.`) +
    `<div class="row">${CANDIDATES.map(col).join('')}</div>` +
    `<div class="note">Lightness remaining above the Primary: control ${f(1 - oklchOf(CONTROL.hex)[0])}, P1 ${f(1 - oklchOf(P1.hex)[0])}, P2 ${f(1 - oklchOf(P2.hex)[0])} on the OKLCH axis. ` +
    `The numbers say how much room exists; only the raster can say whether that room is usable, and only for the kind of expression actually drawn here, which is a solid fill.</div>` +
    `</div>`, { width: WIDE });
  return record(await render(html, join(OUT, 'HEADROOM_P1_P2.png'), 'HEADROOM_P1_P2', { cond: COND_WIDE }));
}

/* ============================================================ A3.6 true-size metadata == */

/**
 * Board 5 - Metadata at true logical size, weight 500 with a weight 400 control.
 *
 * A2 found 12/20/400 visually fragile and dusty at its raster condition and 12/20/500
 * materially better at the same colour. Weight 500 is already inside the frozen role, so A3
 * uses it in the Product proofs and keeps 400 here as the control that maintains traceability.
 *
 * Nothing is enlarged for this board, nothing else is shrunk, and the Tertiary colour is NOT
 * raised to compensate for a weight problem. Each block carries the Primary Body and Supporting
 * Body the metadata will really sit beside, so it is judged in company rather than alone.
 */
async function metadataTrueSize() {
  const block = (c, s) => {
    const line = (w) => sp(COPY.quiet.meta, R.metadata, TERTIARY,
      { mt: 10, weight: w, rect: `${c.key}-${s.hex}-${w}` });
    return `<div style="width:${COL}px;">` + cap2(`${s.name}   ${s.hex}`) +
      `<div style="background:${s.hex};padding:${PADCOL}px;">` +
        sp(COPY.deep.paras[1], R.body, c.hex) +
        sp(COPY.deep.supporting, R.supporting, SECONDARY, { mt: 18 }) +
        line(400) + line(500) +
      `</div>` +
      `<div class="spec">Tertiary 12/20 ${TERTIARY}: ${contrastHex(TERTIARY, s.hex).toFixed(3)}:1 vs ${s.hex} ` +
      `- clears WCAG 4.5:1, below the 7:1 Apple asks of custom colours in Dark Mode, especially in small text</div></div>`;
  };
  const row = (c) => `<div class="sect">` + cap(candLabel(c)) +
    `<div class="row">${SURFACES.map((s) => block(c, s)).join('')}</div></div>`;
  const html = page('META', `<div class="board">` +
    head('A3.6 - TRUE-SIZE METADATA: 12/20 AT WEIGHT 400 (CONTROL) AND WEIGHT 500',
      `Rendered at true logical size. Nothing is enlarged for the board, nothing else is shrunk to manufacture hierarchy, and no screenshot is zoomed. The two metadata lines in each block are ` +
      `the SAME STRING in the SAME COLOUR at weight 400 and weight 500 - both inside the frozen 12/20/400-500 role. The Tertiary ${TERTIARY} was NOT brightened to compensate. The question is ` +
      `narrow: does the already-permitted 500 weight remove enough of the fragility that the Tertiary colour does not need to change? A WCAG pass is not the answer - every value here clears 4.5:1.`) +
    FINALISTS.map(row).join('') +
    `</div>`, { width: BOARD });
  const r = record(await render(html, join(OUT, 'METADATA_TRUE_SIZE.png'), 'METADATA_TRUE_SIZE'));

  /* The magnification must show the PIXELS CHROME DREW, so it is cropped out of the raster
     above and scaled nearest-neighbour. The crop is taken from the RIGHT edge of each line:
     the text is right-aligned RTL, so a left-edge crop would magnify empty run-out. */
  const F = 4, CROPW = 232, CROPH = 22;
  const tiles = [];
  for (const c of FINALISTS) {
    for (const s of SURFACES) {
      for (const w of [400, 500]) {
        const key = `${c.key}-${s.hex}-${w}`;
        const rc = r.rects[key];
        if (!rc) throw new Error(`missing rect ${key}`);
        tiles.push({ label: `${c.key} / ${s.name} / WEIGHT ${w}`,
          img: inkTile(r.img, rc, r.dpr, s.hex, { cropW: CROPW, cropH: CROPH, factor: F }) });
      }
    }
  }
  const TW = Math.max(...tiles.map((t) => t.img.width));
  const TH = Math.max(...tiles.map((t) => t.img.height));
  const PAD = 18, LBL = 30;
  const canvas = blank(PAD * 2 + TW, PAD + tiles.length * (TH + LBL + PAD), hexToRgb8(BENCH.bg));
  tiles.forEach((t, i) => {
    const y = PAD + i * (TH + LBL + PAD);
    drawText(canvas, t.label, PAD, y + 6, hexToRgb8(BENCH.ink), 3);
    paste(canvas, t.img, PAD, y + LBL);
  });
  writeFileSync(join(OUT, 'METADATA_MAGNIFIED.png'), encode(canvas));
  console.log(`  METADATA_MAGNIFIED (4x nearest-neighbour)   ${canvas.width}x${canvas.height}px`);
  record({ name: 'METADATA_MAGNIFIED', path: join(OUT, 'METADATA_MAGNIFIED.png'),
    width: canvas.width, height: canvas.height, order: tiles.map((t) => t.label) });
  return r;
}

/* ===================================================== A3.4 product environments ====== */

async function envBoard(cand, envKey, { g = DESKTOP, cond = COND_A2, outDir = OUT, name = null, headline = null, note = '', vars = null } = {}) {
  const env = ENVIRONMENTS[envKey];
  const v = vars ?? varsFor(cand.hex);
  const frame = productFrame(envKey, v, g);
  const id = name ?? `ENV_${cand.key}_${env.n}_${envKey.toUpperCase()}`;
  assertNoDecor(frame, id);
  const varRow = Object.entries(v).map(([k, val]) =>
    `<td><b>${k.replace('--', '')}</b><br><span class="mono">${val}</span></td>`).join('');
  const html = page('ENV', `<div class="board">` +
    head(headline ?? `ENVIRONMENT ${env.n} - ${env.title.toUpperCase()}   /   ${candLabel(cand)}`,
      `${env.sub}. Rendered through the single shared product template: geometry, DOM, copy, type roles, spacing and direction are literal constants and cannot vary by candidate. ` +
      `Of the six values below, FIVE are identical in every render in this package; only <b>ink-1</b> is the candidate. subtle and edge are NON-CANONICAL diagnostics carried from A2 - ` +
      `no Subtle ladder, no edge system and no surface hierarchy is being designed or frozen here. Metadata is set at weight ${METADATA_WEIGHT}, inside the frozen 12/20/400-500 role. ` +
      `No logo, no mark, no glow, no gradient, no shadow, no blur, no glass, no card, no accent, no brass, no brand light - asserted against this exact markup before it was rasterised. ${note}`) +
    `<table class="t" style="margin-bottom:22px;"><tr>${varRow}</tr></table>` +
    `<div style="width:${g.frameW}px;">${frame}</div>` +
    `</div>`, { width: BOARD });
  const r = record(await render(html, join(outDir, `${id}.png`), id, { cond }));
  /* Only the SHIPPED environment boards feed the fairness proof. A failure capture carries a
     longer explanatory header, which moves the product frame down the page, and the geometry
     fingerprint is in absolute page coordinates - so letting a capture into the comparison
     would make an honest board look like a structural difference. Worse, two of the captures
     are also P1 / deep, so without this they would overwrite the fingerprint of the board they
     are captures OF. Captures are evidence about a defect, not members of the A/B comparison. */
  if (name === null) geo[`${cand.key}:${envKey}:${cond.key}`] = r.geo;
  return r;
}

/* ========================================================= A3.7 robustness renders ==== */

/**
 * The mobile condition. The document IS the product frame - no bench, no caption, no English
 * chrome - because this must be what a phone viewport actually produces rather than a picture
 * of one. 390 CSS px at deviceScaleFactor 3.
 *
 * The reading measure here is 350px, below the frozen 520-600 comfort zone, because a phone
 * does not have 560px to give. That is a property of the device and it is recorded as a limit
 * on what this condition proves, not smoothed over. Within the condition the two finalists are
 * identical to each other, which is what the robustness question asks.
 */
async function mobileRender(cand) {
  const v = varsFor(cand.hex);
  const frame = productFrame('deep', v, MOBILE);
  const id = `ROBUSTNESS_MOBILE_${cand.key}`;
  assertNoDecor(frame, id);
  const html = barePage('MOB', frame, { width: COND_MOBILE.viewport });
  /* Rendered to the work directory first. The shipped board is the PRODUCT FRAME cut out of
     that raster by its own reported box, so what ships is exactly 390 CSS px at dpr 3 and
     carries none of the host's minimum-window padding. */
  const raw = await render(html, join(PKG, '..', '.i08b31-a3-work', `${id}-raw.png`), id,
    { cond: COND_MOBILE, benchRgb: hexToRgb8(WORLD) });
  const rc = raw.rects.frame;
  if (!rc) throw new Error(`${id}: no frame rect`);
  if (rc.w !== MOBILE.frameW) throw new Error(`${id}: frame laid out ${rc.w}px wide, expected ${MOBILE.frameW}`);
  const frameImg = crop(raw.img, rc.x * raw.dpr, rc.y * raw.dpr, rc.w * raw.dpr, rc.h * raw.dpr);
  const out = join(OUT, `${id}.png`);
  writeFileSync(out, encode(frameImg));
  console.log(`  ${id} (frame cut from the raster)   ${frameImg.width}x${frameImg.height}px`);
  geo[`${cand.key}:deep:${COND_MOBILE.key}`] = raw.geo;
  record({ name: id, path: out, width: frameImg.width, height: frameImg.height, cond: COND_MOBILE });
  return { ...raw, frameImg };
}

/** Side by side, cut from the two mobile rasters. Native pixels, no rescaling. */
async function mobilePair(m1, m2) {
  const CUT = 1000;   // CSS px of reading, from the top of the frame
  const h = Math.min(CUT * COND_MOBILE.dpr, m1.frameImg.height, m2.frameImg.height);
  const a = crop(m1.frameImg, 0, 0, m1.frameImg.width, h);
  const b = crop(m2.frameImg, 0, 0, m2.frameImg.width, h);
  const PAD = 30, GAP = 34, LBL = 46;
  const W = PAD * 2 + GAP + a.width + b.width;
  const H = PAD * 2 + LBL + h;
  const canvas = blank(W, H, hexToRgb8(BENCH.bg));
  paste(canvas, a, PAD, PAD + LBL);
  paste(canvas, b, PAD + a.width + GAP, PAD + LBL);
  drawText(canvas, `P1 ${P1.hex.toUpperCase()} - 390 CSS PX AT DPR 3`, PAD + 4, PAD + 8, hexToRgb8(BENCH.ink), 3);
  drawText(canvas, `P2 ${P2.hex.toUpperCase()} - 390 CSS PX AT DPR 3`, PAD + a.width + GAP + 4, PAD + 8, hexToRgb8(BENCH.ink), 3);
  writeFileSync(join(OUT, 'ROBUSTNESS_MOBILE_PAIR.png'), encode(canvas));
  console.log(`  ROBUSTNESS_MOBILE_PAIR (cut from the two)   ${W}x${H}px`);
  return record({ name: 'ROBUSTNESS_MOBILE_PAIR', path: join(OUT, 'ROBUSTNESS_MOBILE_PAIR.png'), width: W, height: H });
}

/**
 * The same Metadata line, cropped from BOTH raster conditions for BOTH finalists and magnified
 * nearest-neighbour to the SAME logical scale - 6 CSS px per logical pixel in every tile, so
 * the desktop crop is upscaled 3x from a 2x raster and the mobile crop 2x from a 3x raster.
 *
 * This is the pixel-level answer to A3.7. It is a comparison of two BROWSER raster conditions
 * and establishes nothing whatever about a native iOS point.
 */
async function robustnessMetadata(deskByCand, mobileByCand) {
  const F = 6, CROPW = 190, CROPH = 20;
  const tiles = [];
  const add = (label, r) => {
    const rc = r.rects['meta-tail'];
    if (!rc) throw new Error(`${r.name}: no meta-tail rect`);
    tiles.push({ label, img: inkTile(r.img, rc, r.dpr, WORLD, { cropW: CROPW, cropH: CROPH, factor: F }) });
  };
  for (const c of FINALISTS) add(`${c.key} - A2 CONDITION - 1440 CSS PX AT DPR 2 - WEIGHT ${METADATA_WEIGHT}`, deskByCand[c.key]);
  for (const c of FINALISTS) add(`${c.key} - MOBILE CONDITION - 390 CSS PX AT DPR 3 - WEIGHT ${METADATA_WEIGHT}`, mobileByCand[c.key]);
  const TW = Math.max(...tiles.map((t) => t.img.width)), TH = Math.max(...tiles.map((t) => t.img.height));
  const PAD = 18, LBL = 30;
  const canvas = blank(PAD * 2 + TW, PAD + tiles.length * (TH + LBL + PAD), hexToRgb8(BENCH.bg));
  tiles.forEach((t, i) => {
    const y = PAD + i * (TH + LBL + PAD);
    drawText(canvas, t.label, PAD, y + 6, hexToRgb8(BENCH.ink), 3);
    paste(canvas, t.img, PAD, y + LBL);
  });
  writeFileSync(join(OUT, 'ROBUSTNESS_METADATA_4X.png'), encode(canvas));
  console.log(`  ROBUSTNESS_METADATA_4X (both conditions)    ${canvas.width}x${canvas.height}px`);
  return record({ name: 'ROBUSTNESS_METADATA_4X', path: join(OUT, 'ROBUSTNESS_METADATA_4X.png'),
    width: canvas.width, height: canvas.height, order: tiles.map((t) => t.label) });
}

/* ------------------------------------------------------------ minimal bitmap font ---- */
/* Five-by-seven uppercase, digits and a few marks. Used only for labels on boards that are
   assembled from pixels rather than rendered, so those boards never re-enter the layout engine
   and cannot pick up a font, a tracking value or a colour by accident. */
const FONT5x7 = {
  A: '01110100011000110001111111000110001', B: '11110100011000111110100011000111110',
  C: '01110100011000010000100001000101110', D: '11110100011000110001100011000111110',
  E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001',
  I: '11111001000010000100001000010011111', J: '00111000100001000010000101001001100',
  K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110001100011000110001', N: '10001110011010110011100011000110001',
  O: '01110100011000110001100011000101110', P: '11110100011000111110100001000010000',
  Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100',
  U: '10001100011000110001100011000101110', V: '10001100011000110001100010101000100',
  W: '10001100011000110001101011101110001', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
  '0': '01110100011001110101110011000101110', '1': '00100011000010000100001000010001110',
  '2': '01110100010000100010001000100011111', '3': '11111000100010000010000011000101110',
  '4': '00010001100101010010111110001000010', '5': '11111100001111000001000011000101110',
  '6': '00110010001000011110100011000101110', '7': '11111000010001000100001000010000100',
  '8': '01110100011000101110100011000101110', '9': '01110100011000101111000010001001100',
  '-': '00000000000000011111000000000000000', ' ': '00000000000000000000000000000000000',
  '.': '00000000000000000000000000110001100', '/': '00001000100010001000100010000000000',
  '+': '00000001000010011111001000010000000', ':': '00000001100110000000011001100000000',
  '#': '01010111110101011111010100000000000',
};
export function drawText(img, text, x0, y0, rgb, s = 3) {
  let x = x0;
  for (const ch of text.toUpperCase()) {
    const g = FONT5x7[ch];
    if (!g) { x += 6 * s; continue; }
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
      if (g[r * 5 + c] !== '1') continue;
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
        const px = x + c * s + dx, py = y0 + r * s + dy;
        if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue;
        const d = (py * img.width + px) * 4;
        img.rgba[d] = rgb[0]; img.rgba[d + 1] = rgb[1]; img.rgba[d + 2] = rgb[2]; img.rgba[d + 3] = 255;
      }
    }
    x += 6 * s;
  }
}

/* =============================================================== failure captures ===== */

/**
 * The Tertiary is the one reading value in the system that clears WCAG 2.2 at 4.5:1 and does
 * NOT reach the 7:1 that Apple's Dark Mode guidance asks of custom foreground and background
 * colours - and Apple attaches that recommendation "especially in small text", which is
 * exactly what the Metadata role is.
 *
 * A3 is forbidden to brighten the Tertiary to compensate, and does not. The capture states the
 * gap instead of closing it. It is rendered ONCE because the Tertiary is not a finalist
 * variable: its ratios against both surfaces are identical under P1 and under P2.
 */
async function failTertiaryApple() {
  const id = 'FAILURE_TERTIARY_BELOW_APPLE_7TO1';
  const wB = contrastHex(TERTIARY, WORLD), wS = contrastHex(TERTIARY, SUB);
  return envBoard(P1, 'deep', {
    outDir: FAIL, name: id,
    headline: 'FAILURE CAPTURE - TERTIARY IS BELOW APPLE\'S DARK-MODE 7:1 FOR CUSTOM COLOURS',
    note: `THE FAILURE: the Tertiary ${TERTIARY} measures ${wB.toFixed(3)}:1 on the World Base and ${wS.toFixed(3)}:1 on the diagnostic Subtle. Both clear WCAG 2.2 SC 1.4.3 at 4.5:1. ` +
      `Neither reaches the 7:1 that Apple's Dark Mode guidance asks of custom foreground and background colours "especially in small text" - and the Metadata role IS the small text. ` +
      `A3 is forbidden to brighten the Tertiary to compensate for a weight problem and has not done so; the only lever the brief permits is the already-frozen 500 weight, which is what ` +
      `A3.6 tests. This capture is rendered once because the Tertiary is not a finalist variable - its ratios are identical under P1 and under P2.`,
  });
}

/** The weight-400 product screen: the condition A2 measured, kept so the change is traceable. */
async function failMetadata400() {
  const id = 'FAILURE_METADATA_400_IN_PRODUCT';
  return envBoard(P1, 'deep', {
    outDir: FAIL, name: id, g: { ...DESKTOP, metaWeight: 400 },
    headline: 'FAILURE CAPTURE - METADATA AT WEIGHT 400 IN A REAL PRODUCT SCREEN',
    note: `THE FAILURE: identical to ENVIRONMENT 3 in every respect except that Metadata is drawn at weight 400 instead of 500 - the condition A2 rendered and found visually fragile and ` +
      `dusty at true size. Same size, same leading, same tracking, same Tertiary colour, same measure. This is what the A3 brief's move to weight 500 is a response to, kept here so the ` +
      `change stays traceable rather than assumed.`,
  });
}

/**
 * The zero-separation control the hierarchy question needs: Primary set to the Secondary value,
 * so the top two levels of the reading ramp are the same colour. Any Primary candidate that
 * cannot be told apart from this panel has genuinely compressed the hierarchy.
 */
async function controlCollapsed() {
  const id = 'CONTROL_COLLAPSED_HIERARCHY';
  return envBoard({ key: 'X', hex: SECONDARY, name: 'COLLAPSED CONTROL', drop: 0 }, 'deep', {
    outDir: FAIL, name: id, vars: varsFor(SECONDARY),
    headline: 'CONTROL CAPTURE - ZERO PRIMARY/SECONDARY SEPARATION',
    note: `THE CONTROL: the Primary is set to the Secondary value ${SECONDARY}, so the top two levels of the reading ramp are literally the same colour and the Primary/Secondary hierarchy ` +
      `is gone. This is the floor the A3.2 question is measured against: any Primary candidate that cannot be told apart from this panel has compressed the hierarchy too far. ` +
      `Nothing else differs from ENVIRONMENT 3. This is not a candidate and never was.`,
  });
}

/* ======================================================================= main ========= */

export async function buildAll() {
  const ver = await chromeVersion();
  console.log(`\n${ver}`);
  console.log(`world ${WORLD}   diagnostic subtle ${SUB} (dL +${DIAG_SUBTLE_DELTA_L})   diagnostic edge ${EDGE}`);

  console.log('\nA3.1 / A3.3 reading');
  await readingRoleMatrix();
  const longForm = await readingLongForm();
  await blindReading(longForm);

  console.log('\nA3.2 hierarchy');
  await hierarchyRamp();

  console.log('\nA3.5 headroom and A3.6 true-size metadata');
  await headroom();
  await metadataTrueSize();

  console.log('\nA3.4 product environments (one shared template, a candidate is ONE variable)');
  const deskDeep = {};
  for (const c of FINALISTS) {
    for (const envKey of Object.keys(ENVIRONMENTS)) {
      const r = await envBoard(c, envKey);
      if (envKey === 'deep') deskDeep[c.key] = r;
    }
  }

  console.log('\nA3.7 robustness - second raster condition');
  const mob = {};
  for (const c of FINALISTS) mob[c.key] = await mobileRender(c);
  await mobilePair(mob.P1, mob.P2);
  await robustnessMetadata(deskDeep, mob);

  console.log('\nfailure and control captures');
  await failTertiaryApple();
  await failMetadata400();
  await controlCollapsed();

  writeFileSync(join(PKG, '..', '.i08b31-a3-work', 'geo.json'), JSON.stringify(geo, null, 0));
  return { results, chrome: ver };
}

/* The entry guard compares RESOLVED PATHS, not strings. `import.meta.url` percent-encodes the
   space in "QANDEEL PROJECT" and `process.argv[1]` does not, so the obvious string comparison
   is false on this host and the module would exit silently having done nothing. */
if (fileURLToPath(import.meta.url) === resolvePath(process.argv[1])) {
  buildAll().then(({ results: r }) => console.log(`\n${r.length} rasters written to review/`));
}
