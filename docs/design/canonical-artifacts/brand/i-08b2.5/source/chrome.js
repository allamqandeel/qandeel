'use strict';
// I-08B2.5 / chrome.js
// Independent render validation: rasterise SVG through a real browser engine
// (Chrome / Blink / Skia) instead of a numerical emulation. Every PNG this task
// ships and every measurement it reports comes through here.
//
// The SVG is placed in an <img> at an exact CSS pixel size and the page is
// screenshotted at that same window size, so the vector is rasterised by Skia
// at the target resolution — not scaled from some other resolution.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const png = require('./png');

const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

function findEngine() {
  if (process.env.QANDEEL_CHROME && fs.existsSync(process.env.QANDEEL_CHROME)) return process.env.QANDEEL_CHROME;
  for (const c of CANDIDATES) if (fs.existsSync(c)) return c;
  throw new Error('no Chromium-family engine found');
}

const ENGINE = findEngine();

function engineVersion() {
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command',
      `(Get-Item '${ENGINE}').VersionInfo.ProductVersion`], { encoding: 'utf8' }).trim();
    return `${path.basename(ENGINE, '.exe')} ${out}`;
  } catch (e) { return path.basename(ENGINE); }
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'qnd-render-'));
let seq = 0;

const fileUrl = p => 'file:///' + path.resolve(p).replace(/\\/g, '/').replace(/ /g, '%20');

// Rasterise an SVG file at exactly w x h device pixels.
//   opaque: when true the page gets an opaque backdrop, so the PNG has no
//           transparency to composite later (iOS icons must carry no alpha).
function renderFile(svgPath, w, h, opts = {}) {
  const id = 'r' + (seq++);
  const html = path.join(TMP, id + '.html');
  const out = path.join(TMP, id + '.png');
  const bg = opts.opaque ? (opts.background || '#000') : 'transparent';
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;padding:0;border:0;overflow:hidden;background:${bg}}
img{display:block;width:${w}px;height:${h}px;border:0}
</style><img src="${fileUrl(svgPath)}">`);

  const args = [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--force-color-profile=srgb',
    '--disable-lcd-text',
    `--window-size=${w},${h}`,
    `--screenshot=${out}`,
  ];
  if (!opts.opaque) args.push('--default-background-color=00000000');
  args.push(fileUrl(html));

  execFileSync(ENGINE, args, { stdio: 'ignore', timeout: 120000 });
  if (!fs.existsSync(out)) throw new Error('render produced no output: ' + svgPath);
  const img = png.decode(fs.readFileSync(out));
  if (img.w !== w || img.h !== h) throw new Error(`render size ${img.w}x${img.h}, expected ${w}x${h}`);
  fs.unlinkSync(html); fs.unlinkSync(out);
  return img;
}

// Rasterise SVG source text (written to a temp file first).
function renderText(svgText, w, h, opts = {}) {
  const p = path.join(TMP, 's' + (seq++) + '.svg');
  fs.writeFileSync(p, svgText, 'utf8');
  const img = renderFile(p, w, h, opts);
  fs.unlinkSync(p);
  return img;
}

// Render and write straight to a production PNG file.
//   alpha: false -> colour type 2 (no alpha channel at all)
function exportPNG(svgPath, w, h, dest, opts = {}) {
  const img = renderFile(svgPath, w, h, { opaque: opts.alpha === false, background: opts.background });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const buf = opts.alpha === false
    ? png.encodeRGB(img.w, img.h, img.data)
    : png.encodeRGBA(img.w, img.h, img.data);
  fs.writeFileSync(dest, buf);
  return { w: img.w, h: img.h, bytes: buf.length, img };
}

module.exports = { renderFile, renderText, exportPNG, engineVersion, ENGINE, fileUrl };

if (require.main === module) {
  console.log('engine:', engineVersion());
}
