/**
 * I-08B3.1-C3 — headless Chrome renderer.
 *
 * C3 is a SPECIFICATION stage, not a visual-exploration stage, so this file is deliberately much
 * smaller than C2's. It does exactly two things C3 needs and nothing else:
 *
 *   1. RASTERISE A PAGE under the same conditions C1R and C2 rasterised theirs, so that anything
 *      measured here is comparable with the accepted evidence rather than merely similar to it. The
 *      Chrome flags below are reproduced from `vendor/c2/c2-render.mjs` — greyscale antialiasing
 *      forced, sRGB forced, compositor stages completed — because a measurement taken under
 *      different flags is a measurement of a different thing.
 *
 *   2. KEEP ITS SCRATCH OUTSIDE THE PACKAGE. `vendor/c2/c2-render.mjs` computes its work directory
 *      from its own module URL and therefore creates `.i08b31-c2-work` INSIDE this package when it
 *      is imported. That is a side effect of vendoring, it is harmless, and `c3-manifest.mjs`
 *      asserts the directory is empty and excluded rather than pretending it does not happen.
 *
 * WHY C3 RASTERISES AT ALL. Two of its questions cannot be answered from a token file:
 *   - C3.2 asks whether the character's scale threshold is EVIDENCE-BACKED or proof-specific. The
 *     only way to know is to measure what the character actually delivers across a range of sizes.
 *   - C3.12 asks whether the production token mapping reproduces the accepted compositions. The
 *     strongest available answer is a byte-identical raster, and that requires rendering.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { decode } from '../vendor/c2/png.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');
export const PROJECT = join(PKG, '..');

/** OUTSIDE the package, beside every other stage's work directory. Nothing here is shipped. */
export const WORK = join(PROJECT, '.i08b31-c3-work');
if (!existsSync(WORK)) mkdirSync(WORK, { recursive: true });

export const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/** Reproduced from C2 unchanged. Every flag here was earned by a defect in an earlier stage. */
export const CONSTANT_FLAGS = [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--disable-lcd-text', '--disable-font-subpixel-positioning',
  '--force-color-profile=srgb', '--virtual-time-budget=25000',
  '--run-all-compositor-stages-before-draw',
];

/** Chrome's layout viewport is narrower than the window it is given. Inherited from C2. */
export const GUTTER = 24;

function run(args) {
  return new Promise((res) => {
    const c = spawn(CHROME, args, { windowsHide: true });
    let err = '';
    c.stdout.on('data', () => {});
    c.stderr.on('data', (d) => { err += d; });
    c.on('close', () => res(err));
  });
}

export async function shoot(html, outPng, name, { width, height, dpr = 2 }) {
  const pagePath = join(WORK, `raw-${name}.html`);
  writeFileSync(pagePath, html, 'utf8');
  const url = `file:///${pagePath.replace(/\\/g, '/')}`;
  await run([...CONSTANT_FLAGS, `--force-device-scale-factor=${dpr}`,
    `--window-size=${width},${height}`, `--screenshot=${outPng}`, url]);
  if (!existsSync(outPng)) throw new Error(`${name}: Chrome wrote no PNG`);
  const buf = readFileSync(outPng);
  const img = decode(buf);
  /**
   * THE BLANK-RENDER GUARD, inherited. A raster whose dimensions are right is not a raster whose
   * contents are right — and on a near-black bench a totally unstyled page is invisible rather than
   * obviously wrong. C2 lost a whole board to exactly this and found it only because of this check.
   */
  let ink = 0;
  for (let i = 0; i < img.rgba.length; i += 4) {
    if (img.rgba[i] > 40 || img.rgba[i + 1] > 40 || img.rgba[i + 2] > 40) ink++;
  }
  const frac = ink / (img.width * img.height);
  if (frac < 0.0015) {
    throw new Error(`${name}: rasterised to ${(frac * 100).toFixed(4)} % ink — treated as a blank render`);
  }
  return { png: outPng, img, buf, inkFraction: frac };
}

/** A minimal page. C3 renders measurement targets and reproduction frames, never labelled boards. */
export function page(bodyHTML, { width, bg = '#101010', extraCSS = '' } = {}) {
  return `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8">` +
    `<title>I-08B3.1-C3</title><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:${bg};}
body{width:${width}px;}
${extraCSS}
</style></head><body>${bodyHTML}</body></html>`;
}
