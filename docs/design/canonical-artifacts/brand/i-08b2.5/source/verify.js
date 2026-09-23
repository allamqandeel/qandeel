'use strict';
// I-08B2.5 / verify.js
// Proves that no approved geometry changed anywhere in this package.
//
// Text equality alone would not catch a distorting placement transform, and a
// render check alone would not catch silent re-rounding of path data, so both
// are done:
//   1  the four approved masters still hash to their frozen values;
//   2  every shipped SVG's path data is byte-identical to the master's;
//   3  every placement matrix is uniform, unmirrored and unskewed, and equals
//      the framing this task declares;
//   4  the geometry each file actually carries renders pixel-identically to the
//      master's, through the real engine, in a shared harness frame;
//   5  the Android VectorDrawable's pathData is byte-identical to the masters;
//   6  purity: no raster, no data URI, no external reference, one copy of the
//      geometry per file.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const A = require('./assets');
const geom = require('./geom');
const chrome = require('./chrome');

const OUT = path.join(__dirname, '..', 'out');
const p = rel => path.join(OUT, rel);
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
const stripComments = geom.stripComments;

// The frozen values, as measured at the start of this task and as recorded by
// the I-08B2.3 and I-08B2.4 packages.
const FROZEN = {
  'QANDEEL_Q_BASE_MASTER.svg': ['6C483AADC1492AF2606539F870B878686B6C9F672C975B5E11C599D91BCEAF05', 3183],
  'QANDEEL_Q_LUMINOUS.svg': ['66BE0AE40B222D63C5E3F4AECBF042399CC66401335F070377368DC8CC21DC98', 5045],
  'QANDEEL_WORDMARK_BASE_MASTER.svg': ['BE0EE251245BB1D184AB2E716FFA13B108D1DAA38E5D8A36DC0A36D1D44BF2BD', 5871],
  'QANDEEL_WORDMARK_LUMINOUS.svg': ['7BECFACF5522E61C559227979CF3E38789CEE263680240BC21616A7851839297', 9126],
};
const FROZEN_B24_B = '859665D86A7BBF4248FF479034031A8DF1F08833C7DB36336B3D29832BCDDD09';

const checks = [];
const ok = (name, pass, detail) => { checks.push({ name, pass: !!pass, detail }); return !!pass; };

// ---------------------------------------------------------------------------
// 1. source integrity
// ---------------------------------------------------------------------------
const masterHashes = {};
for (const [file, [hash, bytes]] of Object.entries(FROZEN)) {
  const src = path.join(path.dirname(A.G.files.qBase), file);
  const buf = fs.readFileSync(src);
  const h = sha(buf);
  masterHashes[file] = { sha256: h, bytes: buf.length };
  ok(`master unchanged: ${file}`, h === hash && buf.length === bytes,
    h === hash ? `${h} (${buf.length} B)` : `EXPECTED ${hash} GOT ${h}`);
  // and the copy inside the package is byte-identical to the source
  const copy = fs.readFileSync(p(path.join('masters', file)));
  ok(`packaged copy identical: ${file}`, sha(copy) === h, sha(copy));
}
{
  const b = fs.readFileSync(A.B24_B);
  ok('frozen I-08B2.4 Variant B unchanged', sha(b) === FROZEN_B24_B, sha(b));
  const c = fs.readFileSync(p('app-icon/APP_ICON_B_DARK_LUMINOUS.svg'));
  ok('canonical app icon is the frozen Variant B, byte for byte', sha(c) === FROZEN_B24_B, sha(c));
}

// ---------------------------------------------------------------------------
// 2. path data identity
// ---------------------------------------------------------------------------
const qMaster = A.G.src.qBase;
const wmMaster = A.G.src.wmBase;
const masterQPaths = geom.allPaths(qMaster);
const masterWMPaths = geom.allPaths(wmMaster);

const SHIPPED = {
  'app-icon/APP_ICON_B_DARK_LUMINOUS.svg': 'q',
  'app-icon/android/source/ANDROID_FOREGROUND.svg': 'q',
  'derivatives/monochrome/QANDEEL_Q_MONOCHROME.svg': 'q',
  'derivatives/light-background/QANDEEL_Q_LIGHT_BG.svg': 'q',
  'derivatives/monochrome/QANDEEL_WORDMARK_MONOCHROME.svg': 'wm',
  'derivatives/light-background/QANDEEL_WORDMARK_LIGHT_BG.svg': 'wm',
};

for (const [rel, kind] of Object.entries(SHIPPED)) {
  const text = fs.readFileSync(p(rel), 'utf8');
  const got = geom.allPaths(text);
  const want = kind === 'q' ? masterQPaths : masterWMPaths;
  const ids = kind === 'q' ? ['q-ring', 'q-tail', 'q-light-core'] : Object.keys(want);
  let same = true, bad = [];
  for (const id of ids) {
    if (got[id] !== want[id]) { same = false; bad.push(id); }
  }
  ok(`path data byte-identical: ${rel}`, same, same ? `${ids.length} paths` : 'DIFFERS: ' + bad.join(', '));
  // and the file must carry exactly one copy of each
  let dup = false;
  for (const id of ids) {
    const n = (stripComments(text).match(new RegExp(`<path id="${id}"`, 'g')) || []).length;
    if (n !== 1) dup = true;
  }
  ok(`single copy of each path: ${rel}`, !dup, dup ? 'DUPLICATED' : 'one each');
}

// ---------------------------------------------------------------------------
// 3. placement matrices
// ---------------------------------------------------------------------------
function matricesIn(text) {
  const out = [];
  const re = /transform="matrix\(([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+)\)"/g;
  let m; while ((m = re.exec(stripComments(text)))) out.push(m.slice(1, 7).map(Number));
  return out;
}
for (const [rel, framing] of [
  ['app-icon/APP_ICON_B_DARK_LUMINOUS.svg', A.CANONICAL],
  ['app-icon/android/source/ANDROID_FOREGROUND.svg', A.ANDROID_FRAMING],
]) {
  const ms = matricesIn(fs.readFileSync(p(rel), 'utf8'));
  let good = ms.length > 0;
  for (const [a, b, c, d, e, f] of ms) {
    if (b !== 0 || c !== 0) good = false;                       // no skew, no rotation
    if (a <= 0 || d <= 0) good = false;                         // no mirror
    if (Math.abs(a - d) > 1e-9) good = false;                   // uniform
    if (Math.abs(a - framing.scale) > 1e-9) good = false;       // declared scale
    if (Math.abs(e - framing.tx) > 1e-6 || Math.abs(f - framing.ty) > 1e-6) good = false;
  }
  ok(`placement matrix uniform and as declared: ${rel}`, good,
    `${ms.length} matrices, scale ${framing.scale}, tx ${framing.tx}, ty ${framing.ty}`);
}

// ---------------------------------------------------------------------------
// 4. rendered geometry identity, through the real engine
// ---------------------------------------------------------------------------
// Each file's own defs block is lifted into an identical harness and rendered
// in an identical frame. Any change to the geometry a file actually carries --
// including a re-rounded coordinate that still looks like the original --
// shows up as a differing pixel.
function harness(defs, useId, vb, W, H) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="${vb.join(' ')}" width="${W}" height="${H}" fill-rule="nonzero">
 <defs>
${defs}
 </defs>
 <rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#000000"/>
 <g fill="#FFFFFF"><use href="#${useId}"/></g>
</svg>
`;
}
function renderHarness(defs, useId, vb, W) {
  const H = Math.round(W * vb[3] / vb[2]);
  return chrome.renderText(harness(defs, useId, vb, W, H), W, H, { opaque: true, background: '#000000' });
}
function diffCount(a, b) {
  if (a.w !== b.w || a.h !== b.h) return -1;
  let n = 0;
  for (let i = 0; i < a.w * a.h; i++) {
    if (a.data[i * 4] !== b.data[i * 4] || a.data[i * 4 + 1] !== b.data[i * 4 + 1]
      || a.data[i * 4 + 2] !== b.data[i * 4 + 2]) n++;
  }
  return n;
}

const RW = 1400;
const refQ = renderHarness(A.G.defs.qBase, 'q-mark', A.G.viewBox.q, RW);
const refWM = renderHarness(A.G.defs.wmBase, 'wordmark-geometry', A.G.viewBox.wm, RW);

for (const [rel, kind] of Object.entries(SHIPPED)) {
  const text = fs.readFileSync(p(rel), 'utf8');
  const defs = geom.defsBlock(text);
  const img = kind === 'q'
    ? renderHarness(defs, 'q-mark', A.G.viewBox.q, RW)
    : renderHarness(defs, 'wordmark-geometry', A.G.viewBox.wm, RW);
  const n = diffCount(kind === 'q' ? refQ : refWM, img);
  ok(`rendered geometry identical to master: ${rel}`, n === 0,
    n === 0 ? `0 differing pixels at ${img.w}x${img.h}` : `${n} DIFFERING PIXELS`);
}

// ---------------------------------------------------------------------------
// 5. Android VectorDrawable
// ---------------------------------------------------------------------------
{
  const vd = fs.readFileSync(p('app-icon/android/res/drawable/ic_launcher_monochrome.xml'), 'utf8');
  const got = [...stripComments(vd).matchAll(/android:pathData="([^"]*)"/g)].map(m => m[1]);
  const want = [masterQPaths['q-ring'], masterQPaths['q-tail'], masterQPaths['q-light-core']];
  ok('VectorDrawable pathData byte-identical to master',
    got.length === 3 && got.every((d, i) => d === want[i]),
    got.length === 3 ? '3 paths, verbatim' : `${got.length} paths found`);
  const s = +vd.match(/android:scaleX="([\d.]+)"/)[1];
  const sy = +vd.match(/android:scaleY="([\d.]+)"/)[1];
  const expect = A.ANDROID_FRAMING.scale * A.ANDROID.canvasDp / A.CANVAS;
  ok('VectorDrawable transform uniform and as declared',
    s === sy && Math.abs(s - expect) < 1e-8, `scale ${s} (expected ${expect.toFixed(8)})`);
  ok('VectorDrawable declares nonZero fill',
    (vd.match(/android:fillType="nonZero"/g) || []).length === 3, 'all three paths');
}

// ---------------------------------------------------------------------------
// 6. purity
// ---------------------------------------------------------------------------
for (const rel of Object.keys(SHIPPED)) {
  const text = fs.readFileSync(p(rel), 'utf8');
  const bad = [];
  if (/data:/i.test(text)) bad.push('data URI');
  if (/<image\b/i.test(text)) bad.push('raster image');
  if (/(href|src)\s*=\s*"(?!#)/i.test(stripComments(text))) bad.push('external reference');
  ok(`no raster and no external reference: ${rel}`, bad.length === 0, bad.join(', ') || 'clean vector');
}

// ---------------------------------------------------------------------------
const passed = checks.filter(c => c.pass).length;
const doc = {
  task: 'I-08B2.5',
  engine: chrome.engineVersion(),
  generated: new Date().toISOString(),
  masterHashesAfter: masterHashes,
  frozenExpected: Object.fromEntries(Object.entries(FROZEN).map(([k, v]) => [k, { sha256: v[0], bytes: v[1] }])),
  summary: { total: checks.length, passed, failed: checks.length - passed },
  checks,
};
fs.mkdirSync(p('review'), { recursive: true });
fs.writeFileSync(p('review/GEOMETRY_VERIFICATION.json'), JSON.stringify(doc, null, 2));

for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}  ${c.detail || ''}`);
console.log(`\n${passed}/${checks.length} checks passed`);
if (passed !== checks.length) process.exitCode = 1;
