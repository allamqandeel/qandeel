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
// stays open for a short while after the process exits, so the recursive remove hits `EBUSY` or
// `EPERM` on the one node it cannot skip — the root. `rmSync` threw out of the `finally`, the rest
// of the teardown never ran, and the tree was stranded. One I-04C run left 817 mirrors behind in a
// single minute; 828 of them held 5.6 GB across 243,327 files on the system drive.
//
// Three things fix it, and this module owns all three so no harness has to remember them:
//
//   1. the mirror root comes from `QANDEEL_TMP` when it is set, so a machine that wants its mirrors
//      on another volume says so through the environment — nothing here knows about any drive;
//   2. the child runs OUTSIDE the tree that is about to be removed, so the handle Windows keeps is
//      on a directory nobody deletes;
//   3. the removal retries a bounded number of times against the transient lock errors, and when it
//      finally gives up it says so on stderr instead of throwing over whatever the test found.
//
// Nothing here changes what any contract proves. It changes only where the mirror lives and how it
// is taken down.

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

/**
 * The working directory for a child spawned against `mirror`.
 *
 * It is the directory that CONTAINS the mirror, which is the narrowest choice that is still outside
 * the tree the parent is about to delete. Two properties matter and both are load-bearing:
 *
 *   it is never removed by a harness, so the handle Windows holds on a child's working directory
 *   cannot block the one remove that has to succeed;
 *
 *   it is not the repository, so a contract that ever started reading a cwd-relative path would fail
 *   loudly against an empty temp directory instead of quietly reading the real tree and reporting
 *   that the mutated mirror was fine.
 *
 * Nothing in these contracts resolves anything from `cwd` today — they derive their root from
 * `import.meta.url`, and Node resolves a child's imports from the test file's own directory — so
 * this changes where the child stands, not what it can see.
 */
export function harnessChildCwd(mirror) {
  return dirname(resolve(mirror));
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
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      rm(mirror);
      return { removed: true, attempts: attempt + 1 };
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

  warn(`QANDEEL harness cleanup: could not remove ${resolve(mirror)} after ${retries + 1} attempts`
    + ` (${lastError?.code ?? 'unknown'}: ${lastError?.message ?? lastError}).`
    + ' The test result above is unaffected; remove the directory manually.');
  return { removed: false, attempts: retries + 1, error: lastError };
}
