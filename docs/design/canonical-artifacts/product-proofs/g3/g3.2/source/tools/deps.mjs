// G3.1 canonical dependency record. Run ONCE inside the QANDEEL repository (it needs git) to (re)write
// source/CANON_DEPENDENCIES.json: every vendored canonical file, its exact path and git blob on main at the pinned
// baseline, its SHA-256 and bytes. The vendored bytes are compared with the blob read straight from git
// (`git cat-file blob`, binary-safe — no line-ending conversion can hide a difference); `--write` replaces a vendored
// copy by the blob bytes. tools/checks.mjs verifies the vendored files against this record without git.
// usage: node tools/deps.mjs [--repo <path>] [--write]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { SOURCE } from './lib/session.mjs';

export const BASELINE = 'da4cf0c9ebcb573f8f186f60b6affbf8a4bd6752';
const repo = process.argv.includes('--repo') ? process.argv[process.argv.indexOf('--repo') + 1] : join(SOURCE, '..', '..', '..');
const WRITE = process.argv.includes('--write');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const git = (args, opts = {}) => execFileSync('git', ['-C', repo, ...args], { maxBuffer: 1 << 28, ...opts });
const V = join(SOURCE, 'vendor');
const PP = 'docs/design/canonical-artifacts/product-proofs';
/* vendored path (under source/vendor) → canonical path on main */
const MAP = {
  'canon/wf-living-constellation.html': 'docs/design/canonical-artifacts/living-analysis/i-08b1/wf-living-constellation.html',
  'canon/product-copy.ts': 'apps/mobile/src/orientation-chrome/product-copy.ts',
  'canon/orientation-types.ts': 'apps/mobile/src/orientation-chrome/types.ts',
  'canon/world.types.ts': 'apps/api/src/connected-worlds/kernel/world.types.ts',
  'canon/QANDEEL_Q_BASE_MASTER.svg': 'docs/design/canonical-artifacts/brand/i-08b2.5/masters/QANDEEL_Q_BASE_MASTER.svg',
  'canon/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md': 'docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md',
  'canon/QANDEEL_G1_2_CANONICAL_CLOSURE.md': 'docs/design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md',
  'canon/g2/QANDEEL_G2_3_CANONICAL_CLOSURE.md': 'docs/design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md',
  'canon/g2/T11_RETURN_PRESENTATION_CONTROLLED_AMENDMENT.md': 'docs/design/i-08b3.1-g2.3/T11_RETURN_PRESENTATION_CONTROLLED_AMENDMENT.md',
  'canon/g2/QANDEEL_G2_CANONICAL_CLOSURE.md': 'docs/design/i-08b3.1-g2/QANDEEL_G2_CANONICAL_CLOSURE.md',
  'canon/g2/QANDEEL_G3_READINESS_HANDOFF.md': 'docs/design/i-08b3.1-g2/QANDEEL_G3_READINESS_HANDOFF.md',
  'canon/g2/G2.3-MANIFEST.json': `${PP}/g2/g2.3/data/MANIFEST.json`,
  'canon/g12-r1/R1_MANIFEST.json': `${PP}/g1.2/r1/R1_MANIFEST.json`,
  'canon/g12-r1/runtime.js': `${PP}/g1.2/source/src/runtime.js`,
  'canon/g12-r1/content.mjs': `${PP}/g1.2/source/src/content.mjs`,
  'fonts/Estedad-OFL.txt': 'docs/design/canonical-artifacts/typography/i-08b3.0-e3/fonts-info/LICENSE-OFL.txt',
};
// the token tree is the one preserved with G1.2 (identical to B4R / C3 / D2R / E1R / F1R2 / F2 + the G1.1 UTTERANCE alias)
for (const d of ['base', 'contrast', 'dark', 'light']) for (const f of readdirSync(join(V, 'tokens', d))) MAP[`tokens/${d}/${f}`] = `${PP}/g1.2/source/vendor/tokens/${d}/${f}`;

const head = git(['rev-parse', 'origin/main']).toString().trim();
const files = [];
let bad = 0;
for (const [v, p] of Object.entries(MAP)) {
  const blob = git(['rev-parse', `${BASELINE}:${p}`]).toString().trim();
  const bytes = git(['cat-file', 'blob', blob]);
  let local = readFileSync(join(V, v));
  if (sha(local) !== sha(bytes)) {
    if (WRITE) { writeFileSync(join(V, v), bytes); local = bytes; console.log('rewrote from blob', v); } else { bad++; console.log('DIFFERS', v); }
  }
  files.push({ vendored: `vendor/${v}`, canonical: p, blob, bytes: bytes.length, sha256: sha(bytes) });
}
/* Lineage: G2.3's seven build inputs, sealed here for the first time; each equals the hash the PRESERVED G2.3 manifest
   on main records for it (MANIFEST.source). */
const man = JSON.parse(readFileSync(join(V, 'canon', 'g2', 'G2.3-MANIFEST.json'), 'utf8'));
const lineage = readdirSync(join(V, 'lineage', 'g23-inputs')).sort().map((f) => {
  const b = readFileSync(join(V, 'lineage', 'g23-inputs', f)), rec = man.source.find((s) => s.path === `.i08b31-g23-work/source/src/${f}`);
  if (!rec || rec.sha256 !== sha(b)) { bad++; console.log('LINEAGE MISMATCH', f); }
  return { vendored: `vendor/lineage/g23-inputs/${f}`, bytes: b.length, sha256: sha(b), preservedManifestEntry: rec ? rec.path : null, equalsPreservedManifest: !!rec && rec.sha256 === sha(b) };
});
const other = ['fonts/Estedad-wght-v8.5.woff2', 'fonts/google/FONT_MANIFEST.json'].map((v) => { const b = readFileSync(join(V, v)); return { vendored: `vendor/${v}`, bytes: b.length, sha256: sha(b) }; });
const g21 = readdirSync(join(V, 'fonts', 'google')).filter((f) => f !== 'FONT_MANIFEST.json').sort().map((f) => { const b = readFileSync(join(V, 'fonts', 'google', f)); return { vendored: `vendor/fonts/google/${f}`, bytes: b.length, sha256: sha(b) }; });
const rec = {
  baseline: BASELINE, originMainAtRecording: head, recordedAt: new Date().toISOString().slice(0, 10),
  worldPin: '4DFD9D27D752C3A445168C0CC7067D71DF4ADA84BC61B806D12C8BB3202BC413',
  canonical: files, lineage,
  fonts: { note: 'Estedad (the E3 / G1 Product face) and the IBM Plex Sans Arabic / Mono faces the canonical world requests from Google Fonts, vendored from the sealed G2.1 package (source/vendor/fonts) and replayed byte-exactly at capture; OFL licence equals the canonical one', files: [...other, ...g21] },
  sealedArchives: {
    'G1.2 reviewed ZIP': '1b297be9402960928dfc85574cdf7fc3a88b1c59e6777af806e5a1d9f7ec3e96', 'G1.2 R1 ZIP': '2e5e0ac41b44be19b5a773aec3a8da060b4a5f5221ef6cb0d1999146f8d23e11',
    'G2.1 ZIP': '7183ed66b313080adc4545d23cc623dcea2bc20d4001928b0731ed0f3ee888e0', 'G2.2 ZIP': '887decefbce86c33be768ce05551bc9f7158e8a6ee3116b554d2c37d139451c7',
    'G2.3 ZIP': '12cca79c35d74da8bc951b87b4827029aa50b2d4eb8fca050934a46c4077c370', 'G2.3 preserved prototype': 'f0b11310ac9561bc7c14f3dfa2864eb450b78d02d9adb6e747ba1d56b9680bec' },
};
writeFileSync(join(SOURCE, 'CANON_DEPENDENCIES.json'), JSON.stringify(rec, null, 1));
console.log(`${files.length} canonical files, ${lineage.length} lineage files, ${bad} problem(s); origin/main ${head}`);
process.exit(bad ? 1 : 0);
