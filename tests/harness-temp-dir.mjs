import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

// QAN-INF-02 — the temporary mirror a forward-safety harness builds, and how it is taken down.
//
// ## Why this exists
//
// Several contracts prove their forward safety by mirroring part of the repository into a temporary
// directory, mutating the copy, and running a real contract against it in a spawned child. That is
// the right shape: it proves the property instead of asserting it. What was wrong was the teardown.
//
// Each harness spawned `node --test` with the MIRROR ROOT ITSELF as the child's `cwd`, then removed
// that same directory in `finally`. On Windows a directory that was a process's working directory
// stays open for a short while after the process exits, so the recursive remove sometimes hit
// `EBUSY` or `EPERM` on the one node it cannot skip — the root. `rmSync` threw out of the `finally`,
// the rest of the teardown never ran, and the tree was stranded. One I-04C run left 817 mirrors
// behind in a single minute; 828 of them held 5.6 GB across 243,327 files on the system drive.
//
// The obvious-looking fix — spawn the child somewhere OTHER than the mirror, so nothing is holding a
// handle on the directory being removed — turns out to be wrong. At least one contract
// (`tests/him-foundation-integration-regression-gate.test.mjs`) reads its subject files with bare
// relative paths (`readFileSync('apps/api/src/...')`), which resolve against the CHILD's `cwd` and
// only exist relative to the mirror root. Moving the child elsewhere makes that contract — and any
// other contract with the same, entirely reasonable, "I'm running from the repository root" pattern
// — fail to find its own files. That is a correctness regression, not a fix.
//
// So the child's `cwd` stays exactly what it always was: the mirror root, indistinguishable from the
// real repository for anything that reads a cwd-relative path. Two things fix the leak instead:
//
//   1. the mirror root comes from `QANDEEL_TMP` when it is set, so a machine that wants its mirrors
//      on another volume says so through the environment — nothing here knows about any drive;
//   2. the removal retries a bounded number of times against the transient lock errors — a released
//      Windows handle comes back within tens of milliseconds, well inside the retry window — and
//      when it finally gives up it says so on stderr instead of throwing over whatever the test
//      found. This alone is enough: it was verified directly, spawning a child with the mirror as
//      its own `cwd` and nothing else, that the retry loop clears the lock with zero residue.
//
// Nothing here changes what any contract proves, or where a spawned child runs. It changes only
// where the mirror lives and how it is taken down.

/** Every mirror this module will create or remove is named for the project. */
const MIRROR_PREFIX = 'qandeel-';

/**
 * Errors that mean "something still has a handle on this, try again in a moment".
 *
 * `EBUSY` and `EPERM` are what a Windows directory handle produces; `ENOTEMPTY` is what a recursive
 * remove reports when a child it had already listed was re-created or could not go; `EACCES`,
 * `EMFILE` and `ENFILE` are the scanner-and-descriptor variants of the same "not right now".
 * Anything outside this set is a real filesystem problem and is reported rather than retried.
 */
const TRANSIENT = new Set(['EBUSY', 'EPERM', 'ENOTEMPTY', 'EACCES', 'EMFILE', 'ENFILE']);

/** Blocks the calling thread. Teardown also runs from `process.on('exit')`, where nothing may await. */
function sleepSync(milliseconds) {
  if (milliseconds <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

/**
 * Where harness mirrors are created.
 *
 * `QANDEEL_TMP` is an override, never a default: unset — which is every CI run and every clean
 * checkout — this is exactly the platform temp directory the harnesses have always used, so nothing
 * about their behaviour changes. A developer whose system drive is small points the variable at
 * another volume and the mirrors follow, without a single path in this repository knowing which
 * volume that is.
 */
export function harnessTmpRoot() {
  const override = process.env.QANDEEL_TMP?.trim();
  if (!override) return tmpdir();
  const root = resolve(override);
  mkdirSync(root, { recursive: true });
  return root;
}

/**
 * Creates one mirror directory under {@link harnessTmpRoot}.
 *
 * The prefix is required to name the project so that {@link removeHarnessMirror} — and the operator
 * tooling that sweeps up after an interrupted run — can tell a harness mirror from anything else
 * that shares the temp directory.
 */
export function createHarnessMirror(prefix) {
  if (typeof prefix !== 'string' || !prefix.startsWith(MIRROR_PREFIX)) {
    throw new TypeError(`a harness mirror prefix must start with "${MIRROR_PREFIX}", got ${JSON.stringify(prefix)}`);
  }
  return mkdtempSync(join(harnessTmpRoot(), prefix));
}

/** A path is removable here only if it is a directory this module would have created. */
function refuseUnlessHarnessMirror(target) {
  const full = resolve(target);
  const parent = dirname(full);
  if (parent === full) return `refusing to remove a filesystem root: ${full}`;
  const name = full.slice(parent.length + sep.length);
  if (!name.startsWith(MIRROR_PREFIX)) {
    return `refusing to remove ${full}: a harness mirror is named "${MIRROR_PREFIX}…"`;
  }
  const roots = [resolve(tmpdir())];
  const override = process.env.QANDEEL_TMP?.trim();
  if (override) roots.push(resolve(override));
  if (!roots.some((root) => parent === root)) {
    return `refusing to remove ${full}: it is not directly inside a harness temp root (${roots.join(', ')})`;
  }
  return null;
}

/**
 * Removes one harness mirror, tolerating the transient Windows locks that used to strand it.
 *
 * NEVER THROWS. Every call site is a `finally`, and a teardown that throws there replaces whatever
 * the test actually found with a filesystem error — the failure the developer needs to read is the
 * one that gets lost. A failure is returned and written to stderr instead, so it is impossible to
 * miss and impossible to mistake for the test result.
 *
 * `rm`, `sleep` and `warn` are injectable so the regression contract can drive the retry path
 * deterministically rather than waiting for a real lock to happen to occur.
 *
 * @returns {{ removed: boolean, attempts: number, error?: Error, refused?: string }}
 */
export function removeHarnessMirror(mirror, {
  retries = 12,
  baseDelayMs = 20,
  rm = (target) => rmSync(target, { recursive: true, force: true, maxRetries: 0 }),
  sleep = sleepSync,
  warn = (message) => process.stderr.write(`${message}\n`),
} = {}) {
  const refused = refuseUnlessHarnessMirror(mirror);
  if (refused) {
    warn(`QANDEEL harness cleanup: ${refused}`);
    return { removed: false, attempts: 0, refused };
  }

  let lastError;
  // The real count of `rm` calls made, not the bound on how many were allowed. A non-transient
  // error breaks out on the first attempt, and reporting `retries + 1` there would claim a dozen
  // tries were made when there was exactly one — the count in both the return value and the
  // warning must be what actually happened.
  let attemptsMade = 0;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    attemptsMade = attempt + 1;
    try {
      rm(mirror);
      return { removed: true, attempts: attemptsMade };
    } catch (error) {
      lastError = error;
      if (!TRANSIENT.has(error?.code)) break;
      if (attempt === retries) break;
      // Linear backoff. A released Windows handle comes back within a few tens of milliseconds, so
      // this converges long before the ceiling; the ceiling exists so a genuinely held file cannot
      // hang a test run.
      sleep(baseDelayMs * (attempt + 1));
    }
  }

  const plural = attemptsMade === 1 ? 'attempt' : 'attempts';
  warn(`QANDEEL harness cleanup: could not remove ${resolve(mirror)} after ${attemptsMade} ${plural}`
    + ` (${lastError?.code ?? 'unknown'}: ${lastError?.message ?? lastError}).`
    + ' The test result above is unaffected; remove the directory manually.');
  return { removed: false, attempts: attemptsMade, error: lastError };
}
