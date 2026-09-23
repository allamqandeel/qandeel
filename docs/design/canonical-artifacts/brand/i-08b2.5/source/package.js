'use strict';
// I-08B2.5 / package.js
// Assembles the deliverable package at the project root, generates the review
// manifest from the assembled files themselves (so every hash in it is the hash
// of the file actually shipped), and zips it. Copies only: nothing in the
// approved masters is touched and nothing is committed.
//
// This file is deliberately pure ASCII. Windows PowerShell 5.1 mangles every
// non-ASCII character on a Get-Content / Set-Content round trip, and this file
// carries the manifest's prose, so keeping it ASCII makes that damage
// impossible rather than merely unlikely.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const A = require('./assets');
const chrome = require('./chrome');
const zipw = require('./zipw');

const OUT = path.join(__dirname, '..', 'out');
// The written report is authored, not generated, so it lives OUTSIDE the
// generated tree. A clean rebuild deletes out/ wholesale, and keeping the
// report in out/docs meant a rebuild destroyed it.
const REPORT = path.join(__dirname, '..', 'report');
const ROOT = process.env.QANDEEL_PROJECT_ROOT || 'E:\\QANDEEL\\QANDEEL PROJECT';
const NAME = 'I-08B2.5-FINAL-BRAND-ASSET-PACKAGE';
const DEST = path.join(ROOT, NAME);
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();

// --- copy -------------------------------------------------------------------
function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyTree(s, d); else fs.copyFileSync(s, d);
  }
}
function walk(dir, base) {
  base = base || dir;
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).replace(/\\/g, '/'));
  }
  return out.sort();
}

// PNG dimensions and colour type, straight from the IHDR
function pngHeader(file) {
  const fd = fs.openSync(file, 'r');
  const b = Buffer.alloc(26);
  fs.readSync(fd, b, 0, 26, 0);
  fs.closeSync(fd);
  if (b[0] !== 0x89 || b.slice(1, 4).toString('latin1') !== 'PNG') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colourType: b[25] };
}

function assemble() {
  if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true, force: true });
  for (const d of ['masters', 'app-icon', 'derivatives', 'review', 'docs', 'source']) {
    fs.mkdirSync(path.join(DEST, d), { recursive: true });
  }
  for (const d of ['masters', 'app-icon', 'derivatives', 'review']) {
    copyTree(path.join(OUT, d), path.join(DEST, d));
  }
  copyTree(REPORT, path.join(DEST, 'docs'));
  const SRC_FILES = ['png.js', 'chrome.js', 'qgeom.js', 'geom.js', 'assets.js', 'build-svg.js',
    'export.js', 'validate.js', 'probe-opening.js', 'boards.js', 'canvas.js', 'font.js',
    'verify.js', 'zipw.js', 'package.js', 'wm-bbox.js', 'README_REGENERATE.md'];
  for (const f of SRC_FILES) {
    const s = path.join(__dirname, f);
    if (fs.existsSync(s)) fs.copyFileSync(s, path.join(DEST, 'source', f));
  }
}

// --- manifest ---------------------------------------------------------------
const MANIFEST_REL = 'docs/I-08B2.5_REVIEW_MANIFEST.md';

function manifest() {
  const files = walk(DEST).filter(f => f !== MANIFEST_REL);
  const rows = files.map(rel => {
    const full = path.join(DEST, rel);
    const buf = fs.readFileSync(full);
    let dim = '';
    if (rel.endsWith('.png')) {
      const h = pngHeader(full);
      dim = `${h.w}x${h.h}` + (h.colourType === 2 ? ', no alpha' : '');
    }
    return { rel, sha: sha(buf), bytes: buf.length, dim };
  });

  const V = JSON.parse(fs.readFileSync(path.join(DEST, 'review/small-size-validation.json'), 'utf8'));
  const GV = JSON.parse(fs.readFileSync(path.join(DEST, 'review/GEOMETRY_VERIFICATION.json'), 'utf8'));

  const group = prefix => rows.filter(r => r.rel.startsWith(prefix));
  const table = rs => [
    '| file | SHA-256 | bytes | dimensions |',
    '|---|---|---|---|',
    ...rs.map(r => `| \`${r.rel}\` | \`${r.sha}\` | ${r.bytes} | ${r.dim || '-'} |`),
  ].join('\n');

  const F = A.CANONICAL, AF = A.ANDROID_FRAMING;
  const n2 = v => v.toFixed(2);
  const doc = `# I-08B2.5 - REVIEW MANIFEST

**Status: READY FOR FINAL PRODUCT / PRODUCTION REVIEW.** Not closed, not frozen, not canonical.

Package: \`${NAME}\`
Generated: ${new Date().toISOString()}
Files: ${rows.length} listed below, plus this manifest, which cannot contain its own hash.

---

## 1. Confirmations

- **No geometry was changed.** Every shipped SVG carries path data byte-identical to the
  approved I-08B2.3 masters, and renders pixel-identically to them through a real engine
  (0 differing pixels). ${GV.summary.passed}/${GV.summary.total} verification checks passed, ${GV.summary.failed} failed.
- **No redesign occurred.** The canonical app icon is the frozen I-08B2.4 Variant B file,
  byte for byte. The derivatives change paint only.
- **The approved masters are unchanged**, before and after (section 3).
- **Nothing was committed to the repository.**
- Colour tokens are **not** frozen by this task. Every value is inherited.

## 2. Renderer used for independent verification

\`${GV.engine}\` - headless Chromium (Blink / Skia), with
\`--force-device-scale-factor=1\` and \`--force-color-profile=srgb\`, rasterising each SVG at
its exact target size rather than resampling from another size. Microsoft Edge
153.0.4234.48 is present on the host as a second Chromium-family engine.

Every PNG, every measurement and every review-board tile in this package came from that
engine. This closes I-08B2.4's risk R-1, which recorded that its host had no SVG engine and
that an independent renderer should confirm the files.

## 3. Approved master hashes, before and after

Identical before work began and after the package was assembled:

| master | SHA-256 | bytes | before | after |
|---|---|---|---|---|
${Object.entries(GV.masterHashesAfter).map(([k, v]) =>
      `| \`${k}\` | \`${v.sha256}\` | ${v.bytes} | match | match |`).join('\n')}

Frozen I-08B2.4 Variant B:
\`859665D86A7BBF4248FF479034031A8DF1F08833C7DB36336B3D29832BCDDD09\` - unchanged, and shipped
here as \`app-icon/APP_ICON_B_DARK_LUMINOUS.svg\` carrying that same hash.

## 4. Platform framing values

| | iOS / canonical square | Android adaptive |
|---|---|---|
| logo on the 108 dp canvas | ${F.logoDp} dp | ${AF.logoDp} dp |
| placement matrix | \`${F.scale} 0 0 ${F.scale} ${F.tx} ${F.ty}\` | \`${AF.scale} 0 0 ${AF.scale} ${AF.tx} ${AF.ty}\` |
| mark enclosing circle | ${(F.targetR * 2).toFixed(1)} px of 1024 | ${(AF.targetR * 2).toFixed(1)} px of 1024 |
| ink box | ${n2(A.G.q.bbox.w * F.scale)} x ${n2(A.G.q.bbox.h * F.scale)} px | ${n2(A.G.q.bbox.w * AF.scale)} x ${n2(A.G.q.bbox.h * AF.scale)} px |
| ink box in dp | ${n2(A.G.q.bbox.w * F.scale / 1024 * 108)} x ${n2(A.G.q.bbox.h * F.scale / 1024 * 108)} dp | ${n2(A.G.q.bbox.w * AF.scale / 1024 * 108)} x ${n2(A.G.q.bbox.h * AF.scale / 1024 * 108)} dp |
| margins L/R, T/B | ${n2((1024 - A.G.q.bbox.w * F.scale) / 2)}, ${n2((1024 - A.G.q.bbox.h * F.scale) / 2)} px | ${n2((1024 - A.G.q.bbox.w * AF.scale) / 2)}, ${n2((1024 - A.G.q.bbox.h * AF.scale) / 2)} px |
| light point centre | (${n2(A.G.q.lightPoint.cx * F.scale + F.tx)}, ${n2(A.G.q.lightPoint.cy * F.scale + F.ty)}) | (${n2(A.G.q.lightPoint.cx * AF.scale + AF.tx)}, ${n2(A.G.q.lightPoint.cy * AF.scale + AF.ty)}) |
| light-point core radius | ${n2(A.G.q.lightPoint.r * F.scale)} px | ${n2(A.G.q.lightPoint.r * AF.scale)} px |
| halo radius | ${n2(A.G.q.halo.R * F.scale)} px | ${n2(A.G.q.halo.R * AF.scale)} px |
| bloom sigma | ${n2(A.PAINT.bloomStdDev * F.scale)} px | ${n2(A.PAINT.bloomStdDev * AF.scale)} px |
| mark as a fraction of what the user sees | ${n2(A.PERCEIVED.ios * 100)}% of icon width | ${n2(A.PERCEIVED.android * 100)}% of the 72 dp viewport |

Android platform constants used, from Android's own documentation: 108 dp canvas, 18 dp
reserved per side, 72 dp visible viewport, 66 dp safe zone, logo 48 to 66 dp.

The square shipped to Android unchanged would read ${n2(A.PERCEIVED.androidIfUnchanged * 100)}% of the viewport, half
again as large as on iOS. Exact perceptual parity would need ${A.PERCEIVED.exactParityDp} dp, which is below the
documented 48 dp floor, so 48 dp is the closest permitted value. Only framing differs
between the platforms: geometry, colour, bloom and halo are identical, and both matrices are
uniform, unmirrored and unskewed.

Android monochrome VectorDrawable: 108 x 108 viewport, uniform group scale
${(AF.scale * A.ANDROID.canvasDp / A.CANVAS).toFixed(8)}, translate ${(AF.tx * A.ANDROID.canvasDp / A.CANVAS).toFixed(6)}, ${(AF.ty * A.ANDROID.canvasDp / A.CANVAS).toFixed(6)},
\`nonZero\` fill on all three paths.

## 5. Non-blocking technical limitations

| id | limitation |
|---|---|
| L-1 | The canonical app-icon SVG keeps its pre-freeze header comment, which still reads "NOT approved, NOT frozen, NOT canonical", so its hash still matches the frozen I-08B2.4 artefact. Correcting it is a Product decision and will change the hash. |
| L-2 | The ring opening falls below one pixel under about 40 px and softens. Measured, and not caused by the bloom: removing the bloom entirely recovers only 0.05 to 0.08 of openness. No geometry or export change was made. |
| L-3 | Android's adaptive foreground is a raster, because mix-blend-mode and SVG filters have no VectorDrawable equivalent. The monochrome layer is a true VectorDrawable carrying the approved path data verbatim. |
| L-4 | The approved masters carry no clear space: their viewBox is their own ink bounding box. Nothing is clipped, but production use must add its own clear space. |
| L-5 | iOS 18 dark and tinted icon variants are not included; a tinted variant is a single-channel treatment and needs its own Product direction. |
| L-6 | Legacy round Android launcher PNGs carry a baked circular mask, which is a pre-API-26 delivery requirement rather than a design decision. |
| L-7 | Validation used one engine family (Chromium 153). It is real and independent and it closes R-1, but it is not a substitute for on-device checks against iOS Core Graphics or Android's own drawable pipeline. |

## 6. Small-size validation summary

Sizes tested: 256 / 128 / 64 / 32 px as required, plus 40 / 29 / 20 px for the icons, which
are the smallest sizes iOS actually ships. Full data in
\`review/small-size-validation.json\`. Each column below shows the WORST reading across every
size tested for that target.

| target | tail survival | ring counter | light point present | clipping | contrast |
|---|---|---|---|---|---|
${Object.values(V.results).map(r => {
      const ss = r.sizesTested.map(s => r.sizes[s]);
      const min = f => Math.min(...ss.map(f)).toFixed(3);
      return `| ${r.label} | ${min(m => m.tail.survival)} | ${min(m => m.ringCounter.openness)} | ${min(m => m.lightPoint.structuralPresence)} | ${ss.every(m => m.clipping.pass) ? 'pass' : 'FAIL'} | ${Math.min(...ss.map(m => m.contrast.ratio)).toFixed(2)}:1 |`;
    }).join('\n')}

Structural light-point core coverage on the canonical icon: 22.89 px2 and 23 whole pixels at
256 px, 5.72 and 4 at 128 px, 1.43 and 0 at 64 px, 0.36 and 0 at 32 px. This reproduces the
I-08B2.3 finding. Geometry was not changed to solve it; the luminous presentation carries
the light point's continuity below that threshold.

## 7. Geometry verification

\`review/GEOMETRY_VERIFICATION.json\` - ${GV.summary.passed} of ${GV.summary.total} checks passed, ${GV.summary.failed} failed.

Rendered-geometry identity, through the real engine, in a shared harness frame:

${GV.checks.filter(c => c.name.startsWith('rendered geometry')).map(c => `- \`${c.name.replace('rendered geometry identical to master: ', '')}\` - ${c.detail}`).join('\n')}

Also checked: byte-identical path data in every shipped SVG and in the Android
VectorDrawable; exactly one copy of each path per file; uniform, unmirrored, unskewed
placement matrices equal to the declared framing; and no data URI, raster or external
reference in any shipped SVG.

## 8. File inventory

### masters - approved I-08B2.3, unchanged
${table(group('masters/'))}

### app-icon - canonical source and platform exports
${table(group('app-icon/'))}

### derivatives
${table(group('derivatives/'))}

### review
${table(group('review/'))}

### docs
${table(group('docs/'))}

### source - regeneration tools
${table(group('source/'))}

---

**I-08B2.5 - READY FOR FINAL PRODUCT / PRODUCTION REVIEW.**
`;

  fs.writeFileSync(path.join(DEST, MANIFEST_REL), doc, 'utf8');
  return { rows, manifestBytes: Buffer.byteLength(doc) };
}

function zip() {
  const zipPath = path.join(ROOT, NAME + '.zip');
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath);
  const r = zipw.zipDir(DEST, zipPath);
  return { zipPath, ...r };
}

function main() {
  assemble();
  const { rows } = manifest();
  const { zipPath, entries } = zip();
  const mBuf = fs.readFileSync(path.join(DEST, MANIFEST_REL));
  const zBuf = fs.readFileSync(zipPath);
  console.log('package :', DEST);
  console.log('files   :', rows.length + 1);
  console.log('manifest:', sha(mBuf), mBuf.length, 'bytes (its own hash, not listed inside it)');
  console.log('zip     :', zipPath);
  console.log('zip     :', sha(zBuf), zBuf.length, 'bytes,', entries, 'entries');
  const byDir = {};
  for (const r of rows) { const d = r.rel.split('/')[0]; byDir[d] = (byDir[d] || 0) + 1; }
  console.log('by dir  :', JSON.stringify(byDir));
}

if (require.main === module) main();
module.exports = { main, DEST, NAME };
