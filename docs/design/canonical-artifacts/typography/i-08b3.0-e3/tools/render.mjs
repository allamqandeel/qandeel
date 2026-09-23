/**
 * I-08B3.0-E3 - headless Chrome page renderer.
 *
 * Two passes: measure the laid-out size, then screenshot at exactly that height. Three
 * standing guards, each of which exists because the corresponding defect shipped silently
 * once before (see the report, Rendering issues):
 *   1. greyscale antialiasing forced, so the host's LCD subpixel fringes are not compared
 *      as if they were a property of the typeface
 *   2. overflow guard - a board laid out wider than its canvas is refused, not cropped
 *   3. blank guard - a board that rasterised to nothing fails loudly
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { decode, inkCoverage } from './png.mjs';
import { WORK, FONT_PROBE } from './ui.mjs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
export const CHROME_PATH = CHROME;
export const SCALE = 2; // device pixel ratio: typography must be judged on a dense grid
export const AA = ['--disable-lcd-text', '--disable-font-subpixel-positioning'];

if (!existsSync(WORK)) mkdirSync(WORK, { recursive: true });

function run(args) {
  return new Promise((resolve) => {
    const c = spawn(CHROME, args, { windowsHide: true });
    let err = '';
    c.stdout.on('data', () => {});
    c.stderr.on('data', (d) => { err += d; });
    // Chrome reports a non-zero-looking result on this host even when it succeeds:
    // the output file is the authority, not the exit status.
    c.on('close', () => resolve(err));
  });
}

/** Loads the page and returns whatever the page wrote into <meta name="qp-*">. */
export function dumpDom(url, width, height = 900, dpr = 1) {
  const args = ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    ...AA, `--force-device-scale-factor=${dpr}`, '--virtual-time-budget=25000',
    `--window-size=${width},${height}`, '--dump-dom', url];
  return new Promise((resolve) => {
    const chunks = [];
    const c = spawn(CHROME, args, { windowsHide: true });
    c.stdout.on('data', (d) => chunks.push(d));
    c.stderr.on('data', () => {});
    c.on('close', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

async function measure(url, width) {
  const dom = await dumpDom(url, width);
  const h = dom.match(/<meta name="qp-height" content="(\d+)">/);
  const w = dom.match(/<meta name="qp-width" content="(\d+)">/);
  const f = dom.match(/<meta name="qp-font" content="([^"]*)">/);
  return {
    h: h ? parseInt(h[1], 10) : 0,
    w: w ? parseInt(w[1], 10) : 0,
    font: f ? f[1].split(',').map(Number) : [],
  };
}

/** Refuse to ship a board that was set in a substituted face, or without the weight axis. */
function assertFont(name, widths) {
  const want = FONT_PROBE.expected;
  if (widths.length !== want.length) {
    throw new Error(`${name}: font fingerprint reported ${widths.length} values, expected ${want.length}`);
  }
  const bad = widths.map((v, i) => [FONT_PROBE.weights[i], v, want[i]])
    .filter(([, v, w]) => Math.abs(v - w) > FONT_PROBE.tol);
  if (bad.length) {
    const looksFallback = widths.some((v) => Math.abs(v - FONT_PROBE.fallbackSeen) < 2);
    const allSame = new Set(widths).size === 1;
    throw new Error(
      `${name}: FONT FINGERPRINT FAILED - ` +
      bad.map(([w, v, e]) => `weight ${w} measured ${v}px, expected ${e}px`).join('; ') +
      ` (+/-${FONT_PROBE.tol}).` +
      (looksFallback ? " That is this host's fallback face: the board would be set in the wrong font." : '') +
      (allSame ? ' All three weights measured the same: the variable wght axis is not being applied.' : '')
    );
  }
}

export async function render(html, width, outPng, name) {
  const pagePath = join(WORK, `page-${name}.html`);
  writeFileSync(pagePath, html, 'utf8');
  const url = `file:///${pagePath.replace(/\\/g, '/')}`;

  const m = await measure(url, width);
  if (!m.h) throw new Error(`${name}: could not measure page height`);
  assertFont(name, m.font);
  if (m.w > width + 1) {
    throw new Error(`${name}: content is ${m.w}px wide but the canvas is ${width}px - ${m.w - width}px would be cropped off the right edge`);
  }
  const height = Math.ceil(m.h);

  await run(['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', ...AA,
    `--force-device-scale-factor=${SCALE}`, '--force-color-profile=srgb',
    '--virtual-time-budget=25000', '--run-all-compositor-stages-before-draw',
    `--window-size=${width},${height}`, `--screenshot=${outPng}`, url]);

  if (!existsSync(outPng)) throw new Error(`${name}: Chrome wrote no PNG`);
  const img = decode(readFileSync(outPng));
  const { coverage } = inkCoverage(img);
  if (coverage < 0.0008) throw new Error(`${name}: render is effectively blank (ink coverage ${(coverage * 100).toFixed(4)}%)`);
  console.log(`  ${name.padEnd(36)} ${String(img.width).padStart(5)}x${String(img.height).padStart(5)}px  ink ${(coverage * 100).toFixed(2)}%`);
  return { name, path: outPng, width: img.width, height: img.height, cssWidth: width, cssHeight: height, coverage };
}
