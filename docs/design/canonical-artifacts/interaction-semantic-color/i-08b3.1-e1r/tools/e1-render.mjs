/**
 * I-08B3.1-E1 — RENDER THE BOARDS, then derive the accessibility transforms FROM THE
 * RASTERS rather than from a second render.
 *
 * That distinction is the whole reason the greyscale and dichromacy boards are evidence:
 * re-rendering the scene with desaturated tokens would prove that a different scene looks
 * different. Transforming the PIXELS Chrome actually drew proves what happens to the one
 * everybody else is looking at.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { launch, openPage, findChrome } from './e1-cdp.mjs';
import { BOARDS } from './e1-boards.mjs';
import { decode, encode } from '../vendor/lib/png.mjs';
import { simulate8 } from './e1-cvd.mjs';
import { relativeLuminance } from '../vendor/lib/color.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const BUILD = join(PKG, '.build');
const OUT = join(PKG, 'review/board');

/** WCAG's own relative-luminance transform, not a saturation slider and not a channel
 *  average. The point is to remove hue while keeping exactly the quantity the contrast
 *  requirements are defined over. */
function greyscale(img) {
  const out = Buffer.from(img.rgba);
  for (let i = 0; i < img.width * img.height; i++) {
    const Y = relativeLuminance([out[i * 4], out[i * 4 + 1], out[i * 4 + 2]]);
    const s = Math.round(255 * (Y <= 0.0031308 ? 12.92 * Y : 1.055 * Math.pow(Y, 1 / 2.4) - 0.055));
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = Math.min(255, Math.max(0, s));
  }
  return { width: img.width, height: img.height, rgba: out };
}

function dichromatic(img, kind) {
  const out = Buffer.from(img.rgba);
  const cache = new Map();
  for (let i = 0; i < img.width * img.height; i++) {
    const k = (out[i * 4] << 16) | (out[i * 4 + 1] << 8) | out[i * 4 + 2];
    let v = cache.get(k);
    if (!v) { v = simulate8([out[i * 4], out[i * 4 + 1], out[i * 4 + 2]], kind); cache.set(k, v); }
    out[i * 4] = v[0]; out[i * 4 + 1] = v[1]; out[i * 4 + 2] = v[2];
  }
  return { width: img.width, height: img.height, rgba: out };
}

/** A board that rasterised to nothing must not pass silently. */
function census(img) {
  const hist = new Map();
  for (let i = 0; i < img.width * img.height; i++) {
    const k = ((img.rgba[i * 4] << 16) | (img.rgba[i * 4 + 1] << 8) | img.rgba[i * 4 + 2]) >>> 0;
    hist.set(k, (hist.get(k) ?? 0) + 1);
  }
  let chromatic = 0;
  for (const [k, n] of hist) {
    const r = (k >> 16) & 255, g = (k >> 8) & 255, b = k & 255;
    if (Math.max(r, g, b) - Math.min(r, g, b) >= 6) chromatic += n;
  }
  return { distinctColours: hist.size, pixels: img.width * img.height, chromatic };
}

export async function render({ dpr = 2 } = {}) {
  mkdirSync(BUILD, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const chrome = findChrome();
  if (!chrome) throw new Error('e1-render: no Chrome or Edge found on this host');
  const browser = await launch({ chrome });
  const report = [];
  try {
    for (const b of BOARDS) {
      const html = b.html();
      const src = join(BUILD, b.file + '.html');
      writeFileSync(src, html, 'utf8');
      // A board is captured at its CONTENT height. The device metrics give a short
      // viewport and captureBeyondViewport extends the shot to the full scroll height,
      // so a board is never padded out with dead World and never silently cropped.
      const pg = await openPage(browser, { url: pathToFileURL(src).href, width: b.width, height: b.width === 390 ? 844 : 320, dpr });
      const fontWidth = await pg.evalIn('document.documentElement.getAttribute("data-qd-font")');
      const fallbackWidth = await pg.evalIn('document.documentElement.getAttribute("data-qd-font-fallback")');
      const overflow = Number(await pg.evalIn('document.documentElement.getAttribute("data-qd-overflow")') ?? 0);
      const png = await pg.shot({ full: b.width !== 390 });
      await pg.close();
      const dst = join(OUT, b.file + '.png');
      writeFileSync(dst, png);
      const img = decode(png);
      const c = census(img);
      report.push({ id: b.id, file: 'review/board/' + b.file + '.png', what: b.what, width: img.width, height: img.height, dpr, ...c, overflow,
        fontWidth: Number(fontWidth), fallbackWidth: Number(fallbackWidth), fontIsEstedad: Number(fontWidth) !== Number(fallbackWidth) });
      console.log(b.id, b.file.padEnd(28), img.width + 'x' + img.height, c.distinctColours + ' colours', c.chromatic + ' chromatic px',
        'font ' + fontWidth + (Number(fontWidth) === Number(fallbackWidth) ? ' *** FALLBACK ***' : ''),
        overflow ? ' *** OVERFLOW ' + overflow + 'px ***' : '');
    }
  } finally {
    await browser.close();
  }

  // --- the transforms, taken from the raster of the integrated screen ------------------
  const base = decode(readFileSync(join(OUT, 'b10-integrated-screen.png')));
  for (const [suffix, fn, what] of [
    ['b12-integrated-greyscale', () => greyscale(base), 'the integrated screen under the WCAG relative-luminance transform'],
    ['b13-integrated-protanopia', () => dichromatic(base, 'protan'), 'the integrated screen under simulated protanopia'],
    ['b14-integrated-deuteranopia', () => dichromatic(base, 'deutan'), 'the integrated screen under simulated deuteranopia'],
  ]) {
    const img = fn();
    writeFileSync(join(OUT, suffix + '.png'), encode(img));
    const c = census(img);
    report.push({ id: suffix.slice(0, 3).toUpperCase(), file: 'review/board/' + suffix + '.png', what, width: img.width, height: img.height, dpr, ...c, derivedFrom: 'review/board/b10-integrated-screen.png' });
    console.log(suffix.slice(0, 3).toUpperCase(), suffix.padEnd(28), img.width + 'x' + img.height, c.distinctColours + ' colours', c.chromatic + ' chromatic px');
  }
  writeFileSync(join(PKG, 'data/E1_BOARDS.json'), JSON.stringify({ generatedBy: 'tools/e1-render.mjs', dpr, boards: report }, null, 2) + '\n');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await render();
  const bad = r.filter((b) => b.fontIsEstedad === false);
  if (bad.length) { console.log('\n*** FONT FALLBACK on ' + bad.length + ' board(s) — the captures are not Estedad'); process.exit(1); }
  if (r.some((b) => b.distinctColours < 8)) { console.log('\n*** a board rasterised to almost nothing'); process.exit(1); }
  const over = r.filter((b) => b.overflow > 0);
  if (over.length) { console.log('\n*** ' + over.length + ' board(s) squeezed their own content: ' + over.map((b) => b.id + ' ' + b.overflow + 'px').join(', ')); process.exit(1); }
  console.log('\n' + r.length + ' boards written to review/board/');
}
