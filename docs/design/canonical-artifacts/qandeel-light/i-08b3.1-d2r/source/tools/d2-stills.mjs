/**
 * I-08B3.1-D2R — THE STILL PROOFS.
 *
 * Keyframes, contact sheets, a four-category coherence grid, a reduced-motion comparison, and
 * one board that is not a screenshot of anything: the LIGHT SEPARATION PROOF, which draws the
 * arithmetic that chose the Light so a reviewer can look at the thing the number is about.
 *
 * Everything here is composited in Node from the captured PNGs and from colour arithmetic. No
 * browser, no text rendering — the labels live on the review board, which has a typeface.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './d2-main.mjs';
import { decode, encode, blank, paste } from '../vendor/png.mjs';
import { T, TA, VIEW, FOUNDATION, LIGHT, LIGHT_DIAGNOSTIC } from '../scene/d2-foundation.mjs';
import { compositeHex, separationFromBrass, BRASS, WORLD } from './d2-lightsearch.mjs';
import { hexToRgb8 } from '../vendor/color.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..', '..');
const FRAMES = join(PKG, '..', '.i08b31-d2-work', 'frames');

const load = (seq, f) => decode(readFileSync(join(FRAMES, seq, `${String(f).padStart(4, '0')}.png`)));
const save = (rel, img) => {
  const p = join(PKG, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, encode(img));
  return { rel, bytes: readFileSync(p).length, w: img.width, h: img.height };
};

/** Box downscale by an integer factor. Averaged, not sampled: a sampled thumbnail of a hairline
 *  scene loses the hairlines, and the hairlines are what half of these proofs are about. */
function downscale(img, f) {
  const w = Math.floor(img.width / f), h = Math.floor(img.height / f);
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let j = 0; j < f; j++) {
        for (let i = 0; i < f; i++) {
          const s = ((y * f + j) * img.width + (x * f + i)) * 4;
          r += img.rgba[s]; g += img.rgba[s + 1]; b += img.rgba[s + 2];
        }
      }
      const d = (y * w + x) * 4, n = f * f;
      out[d] = Math.round(r / n); out[d + 1] = Math.round(g / n); out[d + 2] = Math.round(b / n); out[d + 3] = 255;
    }
  }
  return { width: w, height: h, rgba: out };
}

const GAP = 12;
const RULE = [0x2a, 0x2a, 0x2a];

function grid(panels, cols, gap = GAP) {
  const pw = panels[0].width, ph = panels[0].height;
  const rows = Math.ceil(panels.length / cols);
  const sheet = blank(cols * pw + (cols + 1) * gap, rows * ph + (rows + 1) * gap, hexToRgb8(FOUNDATION.WORLD));
  panels.forEach((p, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    paste(sheet, p, gap + c * (pw + gap), gap + r * (ph + gap));
  });
  return sheet;
}

/* ------------------------------------------------------------- the light separation --- */
/**
 * THE PROOF THAT IS NOT A SCREENSHOT.
 *
 * Two strips, each the compositing path of a Light family over the World, from alpha 0 to 1 —
 * the whole life of a light, from nothing to full strength. Between them, a band of the identity
 * material. The question the whole derivation answers is: DOES THE PATH EVER PASS THROUGH THE
 * MATERIAL'S COLOUR? and this is that question drawn.
 *
 * The diagnostic family's strip meets the Brass band; the candidate's does not. A tick marks the
 * alpha at which each is closest, which is where the arithmetic said to look.
 */
function lightSeparationBoard() {
  const W = 1080, STRIP = 132, BRASS_H = 96, PAD = 40, TICK = 22;
  const H = PAD * 2 + STRIP * 2 + BRASS_H + TICK * 2 + 36;
  const board = blank(W, H, hexToRgb8(FOUNDATION.WORLD));
  const inner = W - PAD * 2;

  const drawStrip = (family, y) => {
    const strip = blank(inner, STRIP, hexToRgb8(WORLD));
    for (let x = 0; x < inner; x++) {
      const alpha = x / (inner - 1);
      const hex = compositeHex(WORLD, family.LOW, alpha);
      const [r, g, b] = hexToRgb8(hex);
      for (let y2 = 0; y2 < STRIP; y2++) {
        const i = (y2 * inner + x) * 4;
        strip.rgba[i] = r; strip.rgba[i + 1] = g; strip.rgba[i + 2] = b; strip.rgba[i + 3] = 255;
      }
    }
    paste(board, strip, PAD, y);
    const sep = separationFromBrass(family);
    const tx = PAD + Math.round(sep.alpha * (inner - 1));
    const tick = blank(3, TICK, hexToRgb8(FOUNDATION.PRIMARY));
    paste(board, tick, Math.min(W - 4, Math.max(PAD, tx - 1)), y + STRIP);
    return sep;
  };

  let y = PAD;
  const diag = drawStrip(LIGHT_DIAGNOSTIC, y);
  y += STRIP + TICK + 18;

  const band = blank(inner, BRASS_H, hexToRgb8(BRASS));
  paste(board, band, PAD, y);
  y += BRASS_H + 18;

  const cand = drawStrip({ CORE: LIGHT.CORE, MID: LIGHT.MID, LOW: LIGHT.LOW }, y);

  /* Hairlines at the edges of the material band, so the eye has something to align against. */
  for (const ry of [PAD + STRIP + TICK + 18 - 1, PAD + STRIP + TICK + 18 + BRASS_H]) {
    for (let x = PAD; x < W - PAD; x++) {
      const i = (ry * W + x) * 4;
      board.rgba[i] = RULE[0]; board.rgba[i + 1] = RULE[1]; board.rgba[i + 2] = RULE[2]; board.rgba[i + 3] = 255;
    }
  }
  return { board, diag, cand };
}

/* ================================================================== the keyframes ===== */
const KEY = {
  ambient: [['01_PERSONAL', Math.round((1600 / 1000) * TA.FPS)], ['02_PARALLAX', Math.round((2800 / 1000) * TA.FPS)],
    ['03_SHARED', Math.round((4400 / 1000) * TA.FPS)], ['04_PUBLIC', Math.round((7200 / 1000) * TA.FPS)]],
  connection: [['01_REST', Math.round((700 / 1000) * T.FPS)], ['02_EVENT', Math.round((2900 / 1000) * T.FPS)], ['03_SETTLED', T.FRAMES - 1]],
  pattern: [['01_REST', Math.round((700 / 1000) * T.FPS)], ['02_EVENT', Math.round((3200 / 1000) * T.FPS)], ['03_SETTLED', T.FRAMES - 1]],
  insight: [['01_REST', Math.round((700 / 1000) * T.FPS)], ['02_EVENT', Math.round((3500 / 1000) * T.FPS)], ['03_SETTLED', T.FRAMES - 1]],
};

const LETTER = { ambient: 'A', connection: 'B', pattern: 'C', insight: 'D' };

export function build() {
  const written = [];

  /* ---- 1. keyframes, full resolution ---- */
  for (const [cat, list] of Object.entries(KEY)) {
    for (const [name, f] of list) {
      written.push(save(join('frames', LETTER[cat], `D2_${LETTER[cat]}_${name}.png`), load(cat, f)));
    }
  }

  /* ---- 2. one contact sheet per category ---- */
  for (const cat of Object.keys(KEY)) {
    const total = readdirSync(join(FRAMES, cat)).filter((x) => x.endsWith('.png')).length;
    const picks = Array.from({ length: 12 }, (_, i) => Math.round((i / 11) * (total - 1)));
    const panels = picks.map((f) => downscale(load(cat, f), 3));
    written.push(save(join('frames', 'contact', `D2_${LETTER[cat]}_CONTACT_SHEET.png`), grid(panels, 6)));
  }

  /* ---- 3. THE COHERENCE GRID — the four categories, three moments each, one picture ---- */
  {
    const panels = [];
    for (const cat of ['ambient', 'connection', 'pattern', 'insight']) {
      const list = cat === 'ambient'
        ? [KEY.ambient[0][1], KEY.ambient[2][1], KEY.ambient[3][1]]
        : KEY[cat].map(([, f]) => f);
      for (const f of list) panels.push(downscale(load(cat, f), 2));
    }
    written.push(save(join('frames', 'proof', 'D2_COHERENCE_GRID.png'), grid(panels, 3)));
  }

  /* ---- 4. reduced motion beside full motion, at the same millisecond ---- */
  {
    const panels = [];
    for (const cat of ['connection', 'pattern', 'insight']) {
      const f = KEY[cat][1][1];
      panels.push(downscale(load(cat, f), 2));
      panels.push(downscale(load(`${cat}-rm`, f), 2));
    }
    written.push(save(join('frames', 'proof', 'D2_REDUCED_MOTION_PAIRS.png'), grid(panels, 2)));
  }

  /* ---- 5. the three worlds, side by side ---- */
  {
    const panels = [KEY.ambient[0][1], KEY.ambient[2][1], KEY.ambient[3][1]].map((f) => downscale(load('ambient', f), 2));
    written.push(save(join('frames', 'proof', 'D2_THREE_WORLDS.png'), grid(panels, 3)));
  }

  /* ---- 6. the light separation proof ---- */
  const sep = lightSeparationBoard();
  written.push(save(join('frames', 'proof', 'D2_LIGHT_SEPARATION.png'), sep.board));

  const report = {
    generated: 'source/tools/d2-stills.mjs',
    files: written,
    lightSeparation: {
      diagnostic: { family: LIGHT_DIAGNOSTIC, ...sep.diag },
      candidate: { family: { CORE: LIGHT.CORE, MID: LIGHT.MID, LOW: LIGHT.LOW }, ...sep.cand },
    },
  };
  mkdirSync(join(PKG, 'data'), { recursive: true });
  writeFileSync(join(PKG, 'data', 'D2_STILLS_REPORT.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (isMain(import.meta.url)) {
  console.log('D2 STILLS');
  const r = build();
  for (const f of r.files) console.log(`  ${f.rel.replace(/\\/g, '/').padEnd(48)} ${f.w}x${f.h}  ${f.bytes.toLocaleString()} B`);
  console.log(`  light separation — diagnostic ${r.lightSeparation.diagnostic.dE.toFixed(4)} at alpha ${r.lightSeparation.diagnostic.alpha.toFixed(3)}`);
  console.log(`                     candidate  ${r.lightSeparation.candidate.dE.toFixed(4)} at alpha ${r.lightSeparation.candidate.alpha.toFixed(3)}`);
  console.log('  wrote data/D2_STILLS_REPORT.json');
}
