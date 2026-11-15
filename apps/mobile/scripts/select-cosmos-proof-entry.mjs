/**
 * COSMOS (experimental, isolated) — the proof entry selector. VALIDATION TOOLING ONLY.
 *
 * The COSMOS experiment proof needs a build whose ROOT COMPONENT is the proof root
 * (`src/cosmos/__validation__/cosmos-proof-entry.tsx`) instead of the Product root. Exactly one line
 * differs between that build and the Product build:
 *
 *   apps/mobile/package.json  "main": "expo-router/entry"
 *                          -> "main": "src/cosmos/__validation__/cosmos-proof-entry.tsx"
 *
 * It follows the W1A-01 selector's rules exactly: an explicit `--apply` / `--restore` verb; it applies
 * only over the exact Product entry; and it refuses unless `COSMOS_PROOF=1` is set, so no
 * ordinary script, `postinstall` or Product build job can reach it. It rewrites only an ephemeral CI
 * checkout and touches no file other than the `main` field of the mobile manifest.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PRODUCT_ENTRY = 'expo-router/entry';
const PROOF_ENTRY = 'src/cosmos/__validation__/cosmos-proof-entry.tsx';

const manifestPath = fileURLToPath(new URL('../package.json', import.meta.url));

function fail(message) {
  process.stderr.write(`select-cosmos-proof-entry: ${message}\n`);
  process.exit(1);
}

const verb = process.argv[2];
if (verb !== '--apply' && verb !== '--restore') {
  fail('usage: node scripts/select-cosmos-proof-entry.mjs --apply | --restore  (requires COSMOS_PROOF=1)');
}
if (process.env.COSMOS_PROOF !== '1') {
  fail('refused: COSMOS_PROOF=1 is required. This is validation tooling and never runs in a Product build.');
}

const original = readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(original);
const from = verb === '--apply' ? PRODUCT_ENTRY : PROOF_ENTRY;
const to = verb === '--apply' ? PROOF_ENTRY : PRODUCT_ENTRY;
if (manifest.main !== from) fail(`refused: expected "main" to be ${JSON.stringify(from)}, found ${JSON.stringify(manifest.main)}`);

const needle = `"main": ${JSON.stringify(from)}`;
if (!original.includes(needle)) fail(`refused: ${needle} does not appear literally in the manifest`);
writeFileSync(manifestPath, original.replace(needle, `"main": ${JSON.stringify(to)}`));

process.stdout.write(
  `select-cosmos-proof-entry: ${verb === '--apply' ? 'COSMOS PROOF' : 'PRODUCT'} entry selected — ` +
    `main ${JSON.stringify(from)} -> ${JSON.stringify(to)}\n` +
    'This changes which ROOT COMPONENT the build registers, and nothing else. Record it in the evidence.\n',
);
