/**
 * T-12 Phase M — the validation-entry selector. VALIDATION TOOLING ONLY.
 *
 * `QAN-BL-T12-04` needs a build whose ROOT COMPONENT is the isolated auth-storage harness rather than
 * the Product root. Exactly one line differs between that build and the Product build, and the Phase-M
 * runbook states it verbatim:
 *
 *   apps/mobile/package.json  "main": "expo-router/entry"
 *                          -> "main": "src/integration/__validation__/validation-entry.tsx"
 *
 * Doing that by hand is fine for one local build and wrong for a cloud one, because a hand edit leaves
 * no record of which artifact was which. This script performs the same single change deterministically,
 * announces it, and is the only thing in the repository that knows the validation entry's path.
 *
 * ## What keeps it out of the Product
 *
 * It is a build-tooling script beside `verify-prebuild-idempotency.mjs`, not a module: nothing in
 * `apps/mobile/src` imports it, it is absent from the Product import closure the T-12 static contract
 * walks, and that contract's separate assertion — that the COMMITTED `apps/mobile/package.json` still
 * says `expo-router/entry` — is untouched by it, because this script only ever rewrites an ephemeral
 * checkout and is never run in a Product build job.
 *
 * ## Fail-closed, three ways
 *
 * It refuses without the explicit `--apply` / `--restore` verb; it refuses to apply unless `main` is
 * currently exactly the Product entry, so it can never be run twice or over an unexpected value; and
 * it refuses unless `T12_PHASE_M_VALIDATION=1` is set in the environment, so no ordinary script,
 * `postinstall` or careless invocation can reach it. A Product build job sets none of those.
 *
 * ## What it does NOT do
 *
 * It changes no Product semantics, adds no route, exports nothing, and touches no file other than the
 * `main` field of the mobile manifest. The harness stays unreachable from Product navigation and from
 * the Product barrel exactly as before; which root component a BUILD registers is the whole difference.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The Product entry. The repository carries this value at every commit, and a contract proves it. */
const PRODUCT_ENTRY = 'expo-router/entry';
/** The validation entry. Referenced by nothing else in the repository, by design. */
const VALIDATION_ENTRY = 'src/integration/__validation__/validation-entry.tsx';

const manifestPath = fileURLToPath(new URL('../package.json', import.meta.url));

function fail(message) {
  process.stderr.write(`select-validation-entry: ${message}\n`);
  process.exit(1);
}

const verb = process.argv[2];
if (verb !== '--apply' && verb !== '--restore') {
  fail('usage: node scripts/select-validation-entry.mjs --apply | --restore  (requires T12_PHASE_M_VALIDATION=1)');
}
if (process.env.T12_PHASE_M_VALIDATION !== '1') {
  fail('refused: T12_PHASE_M_VALIDATION=1 is required. This is validation tooling and never runs in a Product build.');
}

const original = readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(original);
const from = verb === '--apply' ? PRODUCT_ENTRY : VALIDATION_ENTRY;
const to = verb === '--apply' ? VALIDATION_ENTRY : PRODUCT_ENTRY;

if (manifest.main !== from) {
  fail(`refused: expected "main" to be ${JSON.stringify(from)}, found ${JSON.stringify(manifest.main)}`);
}

// A targeted text replacement rather than a re-serialize: rewriting the whole manifest from the parsed
// object would reformat every unrelated line, and a diff that large in a validation checkout hides the
// one change this script is allowed to make.
const needle = `"main": ${JSON.stringify(from)}`;
if (!original.includes(needle)) fail(`refused: ${needle} does not appear literally in the manifest`);
writeFileSync(manifestPath, original.replace(needle, `"main": ${JSON.stringify(to)}`));

process.stdout.write(
  `select-validation-entry: ${verb === '--apply' ? 'VALIDATION' : 'PRODUCT'} entry selected — ` +
    `main ${JSON.stringify(from)} -> ${JSON.stringify(to)}\n` +
    'This changes which ROOT COMPONENT the build registers, and nothing else. Record it in the evidence.\n',
);
