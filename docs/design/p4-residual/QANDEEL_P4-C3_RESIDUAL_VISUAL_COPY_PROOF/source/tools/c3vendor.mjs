// P4-C3 — copies the frozen material this proof consumes, BYTE-EXACT, and records where each byte came from
// (source/PROVENANCE.json). Nothing vendored here is ever edited; tools/c3checks.mjs re-hashes every file against its
// canonical origin on every run (C-PROV-1).
//
//   node source/tools/c3vendor.mjs
//
// Origins:
//   P2-A package (P2 CLOSED / FROZEN)   — the signature family (mic / muted, route, End Call, call, send, play / pause,
//                                         depth, replay, the navigation family), Call Rail A, the utility sourcing, the
//                                         token tree, Estedad v8.5, and the CDP driver + static server
//   P3-A package (P3 CLOSED / FROZEN)   — Open Ledger, the Activity entry glyph (P3 §5.1)
//   I-08B2.5 brand package (P4-C2 §1)   — the canonical Q master; the Android adaptive foreground layer and its flat
//                                         background value (app-icon bytes are copied, never re-rendered or re-hashed)
//   G3.2 final proof (G3 CLOSED / FROZEN) — the reviewed prototype, loaded unchanged in a frame for the Analysis states
//   P4-C proof (this PR)                — its Q adapter (qmark.mjs) and its sheet renderer (lib/sheet.mjs)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(HERE, '..');
const PKG = resolve(SOURCE, '..');
const REPO = resolve(PKG, '..', '..', '..', '..');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const posix = (p) => p.split('\\').join('/');

const P2A = 'docs/design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/source';
const P3A = 'docs/design/p3-notifications/QANDEEL_P3-A_NOTIFICATION_ACTIVITY_INTEGRATED_VISUAL_PROOF/source';
const P4C = 'docs/design/p4-shell/QANDEEL_P4-C_SHELL_CHROME_INTEGRATED_DECISION_PROOF/source';
const BRAND = 'docs/design/canonical-artifacts/brand/i-08b2.5';
const G32 = 'docs/design/canonical-artifacts/product-proofs/g3/g3.2/prototype/index.html';

const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

const plan = [];
for (const f of ['src/sig.mjs', 'src/utility.mjs', 'src/machines.mjs', 'src/tokens.mjs', 'tools/lib/cdp.mjs', 'tools/lib/server.mjs']) plan.push({ from: `${P2A}/${f}`, to: f, origin: 'P2-A' });
for (const d of ['vendor/fonts', 'vendor/utility', 'vendor/tokens']) {
  for (const abs of walk(join(REPO, ...`${P2A}/${d}`.split('/')))) {
    const rel = posix(relative(join(REPO, ...P2A.split('/')), abs));
    plan.push({ from: `${P2A}/${rel}`, to: rel, origin: 'P2-A' });
  }
}
plan.push({ from: `${P3A}/src/p3glyphs.mjs`, to: 'src/p3glyphs.mjs', origin: 'P3-A' });
plan.push({ from: `${P4C}/src/qmark.mjs`, to: 'src/qmark.mjs', origin: 'P4-C' });
plan.push({ from: `${P4C}/tools/lib/sheet.mjs`, to: 'tools/lib/sheet.mjs', origin: 'P4-C' });
plan.push({ from: `${BRAND}/masters/QANDEEL_Q_BASE_MASTER.svg`, to: 'vendor/brand/QANDEEL_Q_BASE_MASTER.svg', origin: 'I-08B2.5 brand package' });
plan.push({ from: `${BRAND}/app-icon/android/res/mipmap-xxxhdpi/ic_launcher_foreground.png`, to: 'vendor/brand/android/ic_launcher_foreground.xxxhdpi.png', origin: 'I-08B2.5 brand package' });
plan.push({ from: `${BRAND}/app-icon/android/res/values/ic_launcher_background.xml`, to: 'vendor/brand/android/ic_launcher_background.xml', origin: 'I-08B2.5 brand package' });
plan.push({ from: `${BRAND}/app-icon/android/res/mipmap-anydpi-v26/ic_launcher.xml`, to: 'vendor/brand/android/ic_launcher.xml', origin: 'I-08B2.5 brand package' });
plan.push({ from: `${BRAND}/app-icon/ios/AppIcon.appiconset/AppIcon-180.png`, to: 'vendor/brand/ios/AppIcon-180.png', origin: 'I-08B2.5 brand package' });

const out = { note: 'Byte-exact copies of frozen upstream material. Never edited here; re-verified against their origin by tools/c3checks.mjs (C-PROV-1).', files: {} };
for (const p of plan) {
  const b = readFileSync(join(REPO, ...p.from.split('/')));
  const to = join(SOURCE, ...p.to.split('/'));
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, b);
  out.files[p.to] = { origin: p.origin, from: p.from, bytes: b.length, sha256: sha(b) };
}
const g = readFileSync(join(REPO, ...G32.split('/')));
mkdirSync(join(PKG, 'prototype', 'g3.2'), { recursive: true });
writeFileSync(join(PKG, 'prototype', 'g3.2', 'index.html'), g);
out.g32 = { note: 'G3.2 reviewed prototype, byte-exact (G3 CLOSED / FROZEN). Loaded unchanged in a frame for the Analysis states; P4-C3 changes its copy object and hides its pre-P2 call line at runtime only.', from: G32, to: 'prototype/g3.2/index.html', bytes: g.length, sha256: sha(g) };
writeFileSync(join(SOURCE, 'PROVENANCE.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`vendored ${Object.keys(out.files).length} files + G3.2 prototype ${out.g32.sha256.slice(0, 8)}`);
