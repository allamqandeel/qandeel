// MOB-CI-01 - the mobile native-impact classifier.
//
// Mobile CI is triggered by root toolchain/script changes on purpose: those must
// still receive mobile contract validation. What must NOT follow from them is a
// full Android Release build + emulator smoke and a ~17-minute Xcode Release
// simulator build. This classifier decides, from a changed-file set alone,
// whether native generation/build/install/boot can actually be affected.
//
// It is deterministic and dependency-free, and it is unit-tested directly rather
// than through fragile YAML regexes.
//
// Usage (either form; both print exactly `true` or `false` on stdout):
//   node scripts/classify-mobile-native-impact.mjs <file> [<file> ...]
//   printf '%s\n' <file> ... | node scripts/classify-mobile-native-impact.mjs

import { readFileSync } from 'node:fs';
import process from 'node:process';

/**
 * Paths whose change can alter the generated native projects, native dependency
 * resolution, or the native gate itself.
 *
 *   apps/mobile/**                      - the mobile workspace: sources, app
 *                                         config, manifest, Maestro flow, and
 *                                         everything Continuous Native
 *                                         Generation templates from.
 *   package-lock.json                   - resolved native dependency graph. A
 *                                         real dependency edit moves the lock,
 *                                         so a dependency change always forces
 *                                         native smoke.
 *   .github/workflows/mobile-ci.yml     - the native gate itself.
 */
export const NATIVE_IMPACT_PREFIXES = Object.freeze(['apps/mobile/']);
export const NATIVE_IMPACT_FILES = Object.freeze(['package-lock.json', '.github/workflows/mobile-ci.yml']);

/** Normalizes a changed-file entry to a repository-relative POSIX path. */
export function normalizePath(entry) {
  return String(entry).trim().replace(/\\/gu, '/').replace(/^\.\//u, '');
}

/** True when this single path can affect native generation, build or boot. */
export function isNativeImpactPath(entry) {
  const path = normalizePath(entry);
  if (path.length === 0) return false;
  if (NATIVE_IMPACT_FILES.includes(path)) return true;
  return NATIVE_IMPACT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Classifies a changed-file set. Returns true when ANY entry is native-impact.
 *
 * This is the honest classification of a KNOWN change set. The fail-safe for an
 * unknown or unestablished change set lives in `classifyChangedFiles` below, so
 * that the two concerns stay separable and testable.
 */
export function classifyMobileNativeImpact(files) {
  if (!Array.isArray(files)) return true;
  return files.map(normalizePath).filter((path) => path.length > 0).some(isNativeImpactPath);
}

/**
 * Fail-safe entry point. An empty or unusable change set means the comparison
 * base could not be established, so native smoke MUST still run: never assume a
 * change is safe merely because the diff could not be computed.
 */
export function classifyChangedFiles(files) {
  const paths = Array.isArray(files) ? files.map(normalizePath).filter((path) => path.length > 0) : [];
  if (paths.length === 0) {
    return { nativeImpact: true, reason: 'FAIL_SAFE_EMPTY_CHANGE_SET', matched: [], files: paths };
  }
  const matched = paths.filter(isNativeImpactPath);
  return {
    nativeImpact: matched.length > 0,
    reason: matched.length > 0 ? 'NATIVE_IMPACT_PATH_CHANGED' : 'NO_NATIVE_IMPACT_PATH_CHANGED',
    matched,
    files: paths,
  };
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8').split(/\r?\n/u);
  } catch {
    return [];
  }
}

function main() {
  const fromArgv = process.argv.slice(2);
  const result = classifyChangedFiles(fromArgv.length > 0 ? fromArgv : readStdin());
  process.stderr.write(`changed files (${result.files.length}):\n`);
  for (const file of result.files) {
    process.stderr.write(`  ${isNativeImpactPath(file) ? '[native]' : '[     ]'} ${file}\n`);
  }
  process.stderr.write(`classification: native_impact=${result.nativeImpact} (${result.reason})\n`);
  process.stdout.write(`${result.nativeImpact}\n`);
}

if (process.argv[1] !== undefined && normalizePath(process.argv[1]).endsWith('scripts/classify-mobile-native-impact.mjs')) {
  main();
}
