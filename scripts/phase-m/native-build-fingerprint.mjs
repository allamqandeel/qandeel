/**
 * QAN-INF-04 — the native build-input fingerprint.
 *
 * A native artifact may be reused across workflow runs ONLY when the inputs that could have changed
 * the binary are provably identical. This module computes that proof: one deterministic digest over
 * the COMMITTED content of every repository path that can reach a built Android APK or iOS `.app`.
 *
 * ## Why the committed tree and not the working tree
 *
 * The fingerprint is taken from `git ls-tree -r <ref>` blob object ids, never from bytes read off the
 * runner's disk. Three reasons, each of which broke an earlier draft:
 *
 *   1. A validation job runs `apps/mobile/scripts/select-validation-entry.mjs --apply`, which rewrites
 *      `apps/mobile/package.json`'s `main` field BEFORE the build. Hashing the working tree would make
 *      a PRODUCT build and an AUTH_VALIDATION build of the same commit produce different fingerprints
 *      for a reason that is already carried, exactly and separately, by the manifest's `role`/`entry`.
 *   2. Git stores normalized content, so a blob id is identical on a CRLF checkout and an LF one. A
 *      digest of on-disk bytes is not, and this repository is developed on Windows and built on Linux
 *      and macOS.
 *   3. Blob ids are already computed. Reading and hashing ~1,800 files on every job is work spent to
 *      reach the same answer less reliably.
 *
 * ## The conservative direction
 *
 * FALSE NEGATIVES ARE ACCEPTABLE; FALSE POSITIVES ARE NOT. A fingerprint that changes when it did not
 * strictly have to costs one rebuild. A fingerprint that fails to change when the binary would have
 * differed produces a test result attributed to code that was never in the artifact — the single
 * failure mode this whole task exists to make impossible.
 *
 * So classification is DEFAULT-INCLUDE. Every tracked path is a build input unless it appears in an
 * exclusion rule below, and every exclusion rule carries its own proof obligation, discharged by
 * `tests/qan-inf-04-native-ci-artifact-reuse-contract.test.mjs`.
 *
 * ## What is excluded, and on what proof
 *
 *   `docs/`, `infra/`, any `*.md`   Prose. Nothing in the mobile import closure reads a Markdown file,
 *                                   and Metro bundles no `.md` asset.
 *   `apps/api/`, `database/`        The server and its migrations. The mobile bundle reaches the API
 *                                   over HTTPS at runtime; it imports no file from either tree.
 *   `tests/`                        Root `node:test` contracts. Executed by Node on a runner, never by
 *                                   Metro, and absent from the mobile workspace entirely.
 *   `apps/mobile/.maestro/`         Maestro FLOW FILES. Maestro interprets these on the runner and
 *                                   drives the installed app from outside it. They are not compiled,
 *                                   not bundled, and changing one cannot change a binary. This is the
 *                                   exclusion that makes a flow fix rerunnable without a rebuild.
 *   `scripts/phase-m/`              Runner-only Phase-M orchestration — the sequencer, the gate, the
 *                                   evidence collector, the world seeder, this file. They run on the
 *                                   runner or against the server. Nothing under `apps/mobile` imports
 *                                   `scripts/`, and the contract proves that by walking every import
 *                                   specifier in the mobile workspace.
 *
 * Everything else is included, deliberately including some paths that are not literally bundled
 * (`eslint.config.js`, `jest.setup.js`, root `scripts/*.mjs`, `.github/workflows/`). Each is a safe
 * false negative, and `.github/workflows/` in particular is included ON PURPOSE: a workflow file IS
 * the build recipe — it carries the ABI flag, the Xcode selection, the Gradle invocation — and no
 * static rule here can prove a given workflow edit did not change how the binary is produced.
 *
 * ## The one exclusion that must never be added
 *
 * `apps/mobile/src/integration/__validation__/` is the root component of every validation build. It
 * sits under a dunder directory beside `__tests__` and `__fixtures__` and reads exactly like test
 * scaffolding, which is precisely why a future exclusion rule could swallow it by accident. It is
 * therefore listed in `ALWAYS_INCLUDED_PREFIXES`, which wins over every exclusion rule, and the
 * contract plants an exclusion that would otherwise match it and requires it to survive.
 *
 * VALIDATION TOOLING. It reads the git object store and writes nothing.
 *
 * Usage:
 *   node scripts/phase-m/native-build-fingerprint.mjs                 # the digest, one line
 *   node scripts/phase-m/native-build-fingerprint.mjs --json          # digest + counts, as JSON
 *   node scripts/phase-m/native-build-fingerprint.mjs --ref <commit>  # against another commit
 *   node scripts/phase-m/native-build-fingerprint.mjs --explain <path># why one path is in or out
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

/**
 * The fingerprint schema version. It is mixed into the digest itself, so changing ANY rule in this
 * file must be accompanied by a bump here: an artifact fingerprinted under the old rules then cannot
 * compare equal to one fingerprinted under the new rules, and reuse across the change fails closed
 * rather than comparing two digests that mean different things.
 */
export const FINGERPRINT_SCHEMA_VERSION = 1;

/** The domain separator. Present so a bare digest of this shape cannot be mistaken for another one. */
export const FINGERPRINT_DOMAIN = 'qandeel.native-build-fingerprint';

/** Path prefixes whose contents are proven unable to reach a built native artifact. */
export const EXCLUDED_PREFIXES = Object.freeze([
  'docs/',
  'infra/',
  'apps/api/',
  'database/',
  'tests/',
  'apps/mobile/.maestro/',
  'scripts/phase-m/',
]);

/** Individual tracked files that are prose or environment samples and reach no build. */
export const EXCLUDED_FILES = Object.freeze(['.env.example', '.gitignore', 'AGENTS.md']);

/** Any file with one of these suffixes is prose wherever it lives. */
export const EXCLUDED_SUFFIXES = Object.freeze(['.md']);

/**
 * Prefixes that are build inputs NO MATTER WHAT an exclusion rule says.
 *
 * `__validation__` is the bundled validation harness — the registered root component of every
 * validation build. A change to it changes the app under test, so it must invalidate the artifact.
 */
export const ALWAYS_INCLUDED_PREFIXES = Object.freeze(['apps/mobile/src/integration/__validation__/']);

/** Normalizes a tree entry to a repository-relative POSIX path. */
export function normalizePath(entry) {
  return String(entry).trim().replace(/\\/gu, '/').replace(/^\.\//u, '');
}

/**
 * Classifies ONE path. Returns `{ included, reason }` — the reason is carried so a refused reuse can
 * name the file that refused it rather than only reporting two unequal digests.
 */
export function classifyBuildInput(entry, rules = {}) {
  const prefixes = rules.excludedPrefixes ?? EXCLUDED_PREFIXES;
  const files = rules.excludedFiles ?? EXCLUDED_FILES;
  const suffixes = rules.excludedSuffixes ?? EXCLUDED_SUFFIXES;
  const always = rules.alwaysIncludedPrefixes ?? ALWAYS_INCLUDED_PREFIXES;

  const path = normalizePath(entry);
  if (path.length === 0) return { included: false, reason: 'EMPTY_PATH' };

  const override = always.find((prefix) => path.startsWith(prefix));
  if (override !== undefined) return { included: true, reason: `ALWAYS_INCLUDED:${override}` };

  const prefix = prefixes.find((candidate) => path.startsWith(candidate));
  if (prefix !== undefined) return { included: false, reason: `EXCLUDED_PREFIX:${prefix}` };

  if (files.includes(path)) return { included: false, reason: 'EXCLUDED_FILE' };

  const suffix = suffixes.find((candidate) => path.endsWith(candidate));
  if (suffix !== undefined) return { included: false, reason: `EXCLUDED_SUFFIX:${suffix}` };

  return { included: true, reason: 'BUILD_INPUT' };
}

/**
 * Computes the fingerprint over `{ path, oid }` tree entries.
 *
 * The digested text is canonical and self-describing: the domain and schema version first, then one
 * `<oid> <path>` line per included path, sorted by path with a plain code-unit comparison so the
 * order cannot drift with a runner's locale. Entries are deduplicated by path; a duplicate path with
 * a conflicting oid is a corrupt input and throws rather than silently picking one.
 */
export function computeFingerprint(entries, rules = {}) {
  if (!Array.isArray(entries)) throw new TypeError('computeFingerprint: entries must be an array');

  const included = new Map();
  let excludedCount = 0;

  for (const entry of entries) {
    const path = normalizePath(entry?.path ?? '');
    const oid = String(entry?.oid ?? '').trim();
    if (path.length === 0) continue;
    if (!/^[0-9a-f]{40,64}$/u.test(oid)) {
      throw new TypeError(`computeFingerprint: entry for ${path} has no usable object id`);
    }
    if (!classifyBuildInput(path, rules).included) {
      excludedCount += 1;
      continue;
    }
    const seen = included.get(path);
    if (seen !== undefined && seen !== oid) {
      throw new TypeError(`computeFingerprint: ${path} appears twice with different object ids`);
    }
    included.set(path, oid);
  }

  const paths = [...included.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const canonical = [`${FINGERPRINT_DOMAIN}/${FINGERPRINT_SCHEMA_VERSION}`]
    .concat(paths.map((path) => `${included.get(path)} ${path}`))
    .join('\n');

  return {
    algorithm: 'sha256',
    domain: FINGERPRINT_DOMAIN,
    schemaVersion: FINGERPRINT_SCHEMA_VERSION,
    value: createHash('sha256').update(`${canonical}\n`, 'utf8').digest('hex'),
    includedFileCount: paths.length,
    excludedFileCount: excludedCount,
  };
}

/**
 * Reads `{ path, oid }` entries from the committed tree at `ref`.
 *
 * `-z` because a repository path may contain characters git would otherwise quote, and a quoted path
 * silently changes the digest input.
 */
export function readTreeEntries(ref = 'HEAD', cwd = fileURLToPath(new URL('../../', import.meta.url))) {
  const result = spawnSync('git', ['ls-tree', '-r', '-z', '--full-tree', ref], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ls-tree ${ref} failed: ${(result.stderr ?? '').trim() || `status ${result.status}`}`);
  }
  const entries = [];
  for (const record of (result.stdout ?? '').split('\0')) {
    if (record.length === 0) continue;
    // `<mode> <type> <oid>\t<path>`
    const tab = record.indexOf('\t');
    if (tab < 0) continue;
    const [, type, oid] = record.slice(0, tab).split(/\s+/u);
    if (type !== 'blob') continue;
    entries.push({ path: record.slice(tab + 1), oid });
  }
  return entries;
}

function main() {
  const argv = process.argv.slice(2);
  const at = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const explain = at('--explain');
  if (explain !== undefined) {
    const verdict = classifyBuildInput(explain);
    process.stdout.write(`${verdict.included ? 'INCLUDED' : 'excluded'}  ${normalizePath(explain)}  (${verdict.reason})\n`);
    return;
  }

  const fingerprint = computeFingerprint(readTreeEntries(at('--ref') ?? 'HEAD'));
  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(fingerprint, null, 2)}\n`);
    return;
  }
  process.stderr.write(
    `build-input fingerprint: ${fingerprint.includedFileCount} included, ${fingerprint.excludedFileCount} excluded\n`,
  );
  process.stdout.write(`${fingerprint.value}\n`);
}

if (process.argv[1] !== undefined && normalizePath(process.argv[1]).endsWith('scripts/phase-m/native-build-fingerprint.mjs')) {
  main();
}
