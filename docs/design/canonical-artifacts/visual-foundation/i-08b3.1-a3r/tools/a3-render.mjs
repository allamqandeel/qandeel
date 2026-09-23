/**
 * I-08B3.1-A3 - headless Chrome renderer.
 *
 * Carried from A2 with ONE addition: the raster condition is now a parameter rather than a
 * constant, because A3.7 requires the finalists to be rendered under two controlled browser
 * conditions instead of one. Everything a condition can vary is passed in and recorded:
 * CSS viewport width, deviceScaleFactor, and the colour and antialiasing flags (which are
 * pinned identically in both conditions on purpose - they are controls, not variables).
 *
 * This is NOT native validation and does not pretend to be. Two browser raster conditions
 * answer one question only: whether the comparison between the finalists survives a change of
 * raster. Native point parity is a different claim, in a different unit system, and A3 does
 * not make it - see A3_FINDINGS.
 *
 * Two passes: measure the laid-out size, then screenshot at exactly that height. Five standing
 * guards, each of which exists because the corresponding defect has shipped silently before:
 *
 *   1. greyscale antialiasing forced. This host renders LCD subpixel fringes, which put real
 *      colour on the edge of every glyph - on a colour board that is indistinguishable from a
 *      property of the candidate. WCAG 2.2 also directs that the criterion be evaluated from
 *      the author's colours rather than the smoothed pixels, so this keeps the raster and the
 *      measured ratios talking about the same thing.
 *   2. sRGB forced, so Chrome does not colour-manage the output into the host's display
 *      profile and hand back pixels that are not the values that were authored.
 *   3. overflow guard - a board laid out wider than its canvas is refused, not cropped.
 *   4. font fingerprint - a board set in a substituted face is refused.
 *   5. blank-render guard - a board that rasterised to nothing must not pass.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { decode } from './png.mjs';
import { WORK, FONT_PROBE } from './a3-ui.mjs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/** The established A2 proof condition. Unchanged, so A3 and A2 boards are comparable. */
export const COND_A2 = { key: 'A2', viewport: 1440, dpr: 2, label: 'established A2 proof condition' };
/**
 * A modern phone-width layout at its real density.
 *
 * `frameCssPx` is the number that matters: the product is laid out at exactly 390 CSS px, the
 * logical width of the current mainstream iPhone class, at deviceScaleFactor 3, that class's
 * density. `viewport` is 780 because Chrome on Windows refuses a window narrower than about
 * 500 CSS px - ask for 390 and the layout viewport comes back 488 while the capture is still
 * 390, which silently cuts the right-hand end off the document. The frame is therefore cropped
 * out of a comfortably wider raster by its own reported box. See `barePage()`.
 */
export const COND_MOBILE = {
  key: 'MOBILE', viewport: 780, dpr: 3, frameCssPx: 390,
  label: 'mobile-scale high-density condition - product laid out at 390 CSS px, deviceScaleFactor 3',
};

/** Default scale, kept as a named export so crop maths reads the same as A2's. */
export const SCALE = COND_A2.dpr;

export const AA = ['--disable-lcd-text', '--disable-font-subpixel-positioning'];

/** Every flag that is held CONSTANT across both raster conditions. Recorded, not assumed. */
export const CONSTANT_FLAGS = [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  ...AA, '--force-color-profile=srgb', '--virtual-time-budget=25000',
  '--run-all-compositor-stages-before-draw',
];

if (!existsSync(WORK)) mkdirSync(WORK, { recursive: true });

let _version = null;
export function chromeVersion() {
  if (_version !== null) return Promise.resolve(_version);
  return new Promise((res) => {
    const c = spawn(CHROME, ['--version'], { windowsHide: true });
    let out = '';
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', () => {});
    c.on('close', () => { _version = out.trim() || '(not reported)'; res(_version); });
  });
}

function run(args) {
  return new Promise((res) => {
    const c = spawn(CHROME, args, { windowsHide: true });
    let err = '';
    c.stdout.on('data', () => {});
    c.stderr.on('data', (d) => { err += d; });
    // Chrome reports a non-zero-looking result on this host even when it succeeds:
    // the output file is the authority, not the exit status.
    c.on('close', () => res(err));
  });
}

export function dumpDom(url, width, height = 900, dpr = 1) {
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
    const [x, y, rw, rh] = m[2].split(',').map(Number);
    rects[m[1]] = { x, y, w: rw, h: rh };
  }
  const f = meta('qp-font');
  return {
    h: parseInt(meta('qp-height') || '0', 10),
    w: parseInt(meta('qp-width') || '0', 10),
    dpr: parseFloat(meta('qp-dpr') || '0'),
    font: f ? f.split(',').map(Number) : [],
    geo: meta('qp-geo'),
    rects,
  };
}

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

/** Ink coverage against a KNOWN ground. The ground is passed in, never assumed. */
export function inkCoverage(img, bg) {
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const base = lum(...bg);
  let peak = base;
  for (let i = 0; i < img.width * img.height; i++) {
    const l = lum(img.rgba[i * 4], img.rgba[i * 4 + 1], img.rgba[i * 4 + 2]);
    if (l > peak) peak = l;
  }
  if (peak - base < 1) return { coverage: 0, peak, base };
  let n = 0;
  for (let i = 0; i < img.width * img.height; i++) {
    const l = lum(img.rgba[i * 4], img.rgba[i * 4 + 1], img.rgba[i * 4 + 2]);
    if ((l - base) / (peak - base) >= 0.5) n++;
  }
  return { coverage: n / (img.width * img.height), peak, base };
}

/**
 * @param cond one of COND_A2 / COND_MOBILE. `cond.viewport` is the CSS width the page is laid
 *             out at and `cond.dpr` the deviceScaleFactor the screenshot is taken at.
 */
export async function render(html, outPng, name, { cond = COND_A2, benchRgb = [0x33, 0x33, 0x33] } = {}) {
  const width = cond.viewport;
  const pagePath = join(WORK, `page-${name}.html`);
  writeFileSync(pagePath, html, 'utf8');
  const url = `file:///${pagePath.replace(/\\/g, '/')}`;

  const m = await measure(url, width, cond.dpr);
  if (!m.h) throw new Error(`${name}: could not measure page height`);
  assertFont(name, m.font);
  if (m.w > width + 1) {
    throw new Error(`${name}: content is ${m.w}px wide but the canvas is ${width}px - ` +
      `${m.w - width}px would be cropped off the right edge`);
  }
  if (Math.abs(m.dpr - cond.dpr) > 0.001) {
    throw new Error(`${name}: page reports devicePixelRatio ${m.dpr} but the condition asks for ${cond.dpr}`);
  }
  const height = Math.ceil(m.h);

  await run([...CONSTANT_FLAGS, `--force-device-scale-factor=${cond.dpr}`,
    `--window-size=${width},${height}`, `--screenshot=${outPng}`, url]);

  if (!existsSync(outPng)) throw new Error(`${name}: Chrome wrote no PNG`);
  const img = decode(readFileSync(outPng));
  if (img.width !== width * cond.dpr) {
    throw new Error(`${name}: raster is ${img.width}px wide, expected ${width * cond.dpr} ` +
      `(${width} CSS px at deviceScaleFactor ${cond.dpr})`);
  }
  const { coverage } = inkCoverage(img, benchRgb);
  if (coverage < 0.0005) {
    throw new Error(`${name}: render is effectively blank (ink coverage ${(coverage * 100).toFixed(4)}%)`);
  }
  console.log(`  ${name.padEnd(30)} ${cond.key.padEnd(7)} ${String(img.width).padStart(5)}x${String(img.height).padStart(5)}px  ink ${(coverage * 100).toFixed(2)}%`);
  return { name, cond, path: outPng, width: img.width, height: img.height,
    cssWidth: width, cssHeight: height, dpr: cond.dpr, coverage, rects: m.rects, geo: m.geo, img };
}
