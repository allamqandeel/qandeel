/**
 * I-08B3.1-B4 - the renderer, carried from B3's in method and pointed at B4's own work directory.
 *
 * WHY THIS FILE EXISTS RATHER THAN AN IMPORT. B3's renderer writes its intermediate pages into the
 * B3R work directory. B4 must not put its own by-products into the predecessor's workspace, because
 * the predecessor is B4's REFERENCE SET - the thing every "nothing changed" claim is measured
 * against - and the cheapest way to keep that claim honest is to never write anything near it.
 *
 * Everything that determines what a pixel LOOKS like is imported from the sealed package and not
 * re-declared here: the font, the font fingerprint, the reporter, the product stylesheet, the board
 * chrome. Only the plumbing is local.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { decode } from '../../I-08B3.1-B3R-OVERLAY-SEMANTICS-FOCUS-LIFECYCLE-VERIFICATION/tools/png.mjs';
import { FONT_PROBE } from '../../I-08B3.1-B3R-OVERLAY-SEMANTICS-FOCUS-LIFECYCLE-VERIFICATION/tools/b3-ui.mjs';
import { WORK } from './b4-tokens.mjs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export const AA = ['--disable-lcd-text', '--disable-font-subpixel-positioning'];
export const GUTTER = 24;
export const CONSTANT_FLAGS = [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  ...AA, '--force-color-profile=srgb', '--virtual-time-budget=25000',
  '--run-all-compositor-stages-before-draw',
];

/** A single product frame at its own width, which is all B4 renders. */
export const COND_FRAME = (w) => ({ key: 'FRAME', viewport: w, dpr: 2,
  label: `single product frame - ${w} CSS px, deviceScaleFactor 2` });

if (!existsSync(WORK)) mkdirSync(WORK, { recursive: true });

function run(args) {
  return new Promise((res) => {
    const c = spawn(CHROME, args, { windowsHide: true });
    let err = '';
    c.stdout.on('data', () => {});
    c.stderr.on('data', (d) => { err += d; });
    c.on('close', () => res(err));           // the output file is the authority, not the exit status
  });
}

function dumpDom(url, width, height, dpr) {
  const args = ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    ...AA, `--force-device-scale-factor=${dpr}`, '--force-color-profile=srgb',
    '--virtual-time-budget=25000', `--window-size=${width},${height}`, '--dump-dom', url];
  return new Promise((res) => {
    const chunks = [];
    const c = spawn(CHROME, args, { windowsHide: true });
    c.stdout.on('data', (d) => chunks.push(d));
    c.stderr.on('data', () => {});
    c.on('close', () => res(Buffer.concat(chunks).toString('utf8')));
  });
}

async function measure(url, width, dpr) {
  const dom = await dumpDom(url, width, 900, dpr);
  const meta = (n) => {
    const m = dom.match(new RegExp(`<meta name="${n}" content="([^"]*)">`));
    return m ? m[1] : '';
  };
  const rects = {};
  for (const m of dom.matchAll(/<meta name="qp-rect-([^"]+)" content="([^"]*)">/g)) {
    const [x, y, w, h] = m[2].split(',').map(Number);
    rects[m[1]] = { x, y, w, h };
  }
  const f = meta('qp-font');
  return {
    h: parseInt(meta('qp-height') || '0', 10),
    viewport: parseInt(meta('qp-viewport') || '0', 10),
    minLeft: parseInt(meta('qp-minleft') || '0', 10),
    maxRight: parseInt(meta('qp-maxright') || '0', 10),
    dpr: parseFloat(meta('qp-dpr') || '0'),
    font: f ? f.split(',').map(Number) : [],
    geo: meta('qp-geo'), focus: meta('qp-focus'), rects,
  };
}

function assertFont(name, widths) {
  const want = FONT_PROBE.expected;
  if (widths.length !== want.length) throw new Error(`${name}: font fingerprint reported ${widths.length} values, expected ${want.length}`);
  const bad = widths.map((v, i) => [FONT_PROBE.weights[i], v, want[i]]).filter(([, v, w]) => Math.abs(v - w) > FONT_PROBE.tol);
  if (bad.length) {
    throw new Error(`${name}: FONT FINGERPRINT FAILED - ` +
      bad.map(([w, v, e]) => `weight ${w} measured ${v}px, expected ${e}px`).join('; '));
  }
}

export async function render(html, outPng, name, { cond, benchRgb = [0x33, 0x33, 0x33] }) {
  const width = cond.viewport;
  const win = width + GUTTER;
  const pagePath = join(WORK, `page-${name}.html`);
  writeFileSync(pagePath, html, 'utf8');
  const url = `file:///${pagePath.replace(/\\/g, '/')}`;

  const m = await measure(url, win, cond.dpr);
  if (!m.h) throw new Error(`${name}: could not measure page height`);
  assertFont(name, m.font);
  if (m.viewport < width) throw new Error(`${name}: layout viewport ${m.viewport}px is narrower than the ${width}px frame`);
  if (m.minLeft < -1) throw new Error(`${name}: content extends ${-m.minLeft}px off the LEFT edge`);
  if (m.maxRight > width + 1) throw new Error(`${name}: content extends ${m.maxRight - width}px off the right edge`);
  if (Math.abs(m.dpr - cond.dpr) > 0.001) throw new Error(`${name}: devicePixelRatio ${m.dpr} but the condition asks ${cond.dpr}`);

  const height = Math.ceil(m.h);
  await run([...CONSTANT_FLAGS, `--force-device-scale-factor=${cond.dpr}`,
    `--window-size=${win},${height}`, `--screenshot=${outPng}`, url]);

  if (!existsSync(outPng)) throw new Error(`${name}: Chrome wrote no PNG`);
  const buf = readFileSync(outPng);
  const img = decode(buf);
  if (img.width !== win * cond.dpr) {
    throw new Error(`${name}: raster is ${img.width}px wide, expected ${win * cond.dpr}`);
  }
  /* A blank-render guard, kept because a board that rasterised to nothing must never pass. */
  let ink = 0;
  for (let i = 0; i < img.width * img.height; i++) {
    const [r, g, b] = [img.rgba[i * 4], img.rgba[i * 4 + 1], img.rgba[i * 4 + 2]];
    if (Math.abs(r - benchRgb[0]) + Math.abs(g - benchRgb[1]) + Math.abs(b - benchRgb[2]) > 30) ink++;
  }
  if (ink / (img.width * img.height) < 0.05) throw new Error(`${name}: render is effectively blank`);

  return { name, path: outPng, buf, img, rects: m.rects, geo: m.geo, focus: m.focus,
    width: img.width, height: img.height, cssHeight: height };
}

/** Pixel accessor in RASTER coordinates. */
export const px = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]];
};

/** The most common colour in a raster rectangle - the fill, with text and edges outvoted. */
export function dominant(img, { x, y, w, h }, dpr = 2) {
  const counts = new Map();
  for (let j = Math.round(y * dpr); j < Math.min(img.height, Math.round((y + h) * dpr)); j++) {
    for (let i = Math.round(x * dpr); i < Math.min(img.width, Math.round((x + w) * dpr)); i++) {
      const k = px(img, i, j).join(',');
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  let best = null, n = 0, total = 0;
  for (const [k, v] of counts) { total += v; if (v > n) { n = v; best = k; } }
  return { rgb: best.split(',').map(Number), share: n / total, distinct: counts.size, total };
}
