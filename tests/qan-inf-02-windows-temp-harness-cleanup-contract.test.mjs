import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createHarnessMirror, harnessChildCwd, harnessTmpRoot, removeHarnessMirror } from './harness-temp-dir.mjs';

// QAN-INF-02 — the forward-safety harnesses must not strand their mirrors on Windows.
//
// ## What went wrong
//
// A harness mirrors part of the repository into a temporary directory and runs a real contract
// against the copy in a spawned child. Every one of them spawned that child with the MIRROR ROOT as
// its `cwd`, then removed that same directory in `finally`. On Windows the working directory of a
// process stays open briefly after it exits, so the recursive remove hit `EBUSY`/`EPERM` on the one
// node it could not skip. `rmSync` threw out of the `finally`, the remaining teardown never ran, and
// the tree stayed on disk. A single I-04C run left 817 mirrors behind in one minute.
//
// ## What this contract holds
//
// The three properties that make that impossible, and it holds them over every harness that builds
// a mirror — discovered by scanning, not from a list of today's filenames, so a harness added
// tomorrow cannot quietly reintroduce the shape.
//
// The retry and failure paths are driven through injected doubles rather than by hoping a real
// Windows lock occurs while the suite happens to be running. A test that can only fail when the
// timing is unlucky proves nothing on the runs where the timing is kind.

const rootPath = fileURLToPath(new URL('../', import.meta.url));
const SELF = 'qan-inf-02-windows-temp-harness-cleanup-contract.test.mjs';
const OWN_SCRIPT = 'test:qan-inf-02-windows-temp-harness-cleanup-contract';

/** Every harness that builds a temporary mirror, found by what the file does rather than by name. */
function harnessSources() {
  const found = [];
  for (const relative of ['tests', join('database', 'tests')]) {
    const directory = join(rootPath, relative);
    if (!existsSync(directory)) continue;
    for (const file of readdirSync(directory)) {
      if (!file.endsWith('.test.mjs') || file === SELF) continue;
      const text = readFileSync(join(directory, file), 'utf8');
      if (!/createHarnessMirror\(|mkdtempSync\(/u.test(text)) continue;
      found.push({ name: `${relative.replace(/\\/gu, '/')}/${file}`, text });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------------------------
// 1 + 2 — where a mirror is created.
// ---------------------------------------------------------------------------------------------

test('QANDEEL_TMP moves the harness temp root, and its absence leaves the platform default untouched', () => {
  const before = process.env.QANDEEL_TMP;
  try {
    delete process.env.QANDEEL_TMP;
    assert.equal(harnessTmpRoot(), tmpdir(),
      'unset - which is every CI run and every clean checkout - the harnesses must behave exactly as they always have');

    const override = join(tmpdir(), `qandeel-inf02-root-${process.pid}`);
    rmSync(override, { recursive: true, force: true });
    process.env.QANDEEL_TMP = override;
    assert.equal(harnessTmpRoot(), resolve(override), 'an explicit QANDEEL_TMP is the root');
    assert.ok(existsSync(override), 'the override root is created rather than required to pre-exist');

    const mirror = createHarnessMirror('qandeel-inf02-probe-');
    try {
      assert.equal(dirname(mirror), resolve(override), 'the mirror is created inside the override root');
    } finally {
      removeHarnessMirror(mirror);
    }

    // Whitespace-only is not a choice of directory.
    process.env.QANDEEL_TMP = '   ';
    assert.equal(harnessTmpRoot(), tmpdir(), 'a blank override falls back to the platform temp root');
    rmSync(override, { recursive: true, force: true });
  } finally {
    if (before === undefined) delete process.env.QANDEEL_TMP;
    else process.env.QANDEEL_TMP = before;
  }
});

test('no tracked harness hardcodes a drive or a machine-specific temp path', () => {
  const offenders = harnessSources()
    .concat([{ name: 'tests/harness-temp-dir.mjs', text: readFileSync(join(rootPath, 'tests', 'harness-temp-dir.mjs'), 'utf8') }])
    .filter(({ text }) => /['"][A-Za-z]:[\\/]/u.test(text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/[^\n]*$/gmu, '')))
    .map(({ name }) => name);
  assert.deepEqual(offenders, [],
    'the temp root is chosen by the environment; the repository may not know which volume a developer uses');
});

// ---------------------------------------------------------------------------------------------
// 3 — the child never stands in the directory that is about to be removed.
// ---------------------------------------------------------------------------------------------

test('the child working directory is outside the mirror, and no harness spawns with the mirror as cwd', () => {
  const mirror = createHarnessMirror('qandeel-inf02-cwd-');
  try {
    const cwd = harnessChildCwd(mirror);
    assert.notEqual(resolve(cwd), resolve(mirror), 'the child must not stand in the mirror root');
    assert.ok(!resolve(cwd).startsWith(resolve(mirror)), 'the child must not stand anywhere inside the mirror');
    assert.equal(resolve(cwd), resolve(dirname(mirror)), 'and it is the containing directory, not something broader');
    assert.ok(existsSync(cwd), 'the chosen working directory exists');
    assert.notEqual(resolve(cwd), resolve(rootPath), 'it is not the repository, so a cwd-relative read would fail loudly');
  } finally {
    removeHarnessMirror(mirror);
  }

  const offenders = harnessSources()
    .filter(({ text }) => /cwd:\s*(mirror|mirrorPath)\s*[,}]/u.test(text))
    .map(({ name }) => name);
  assert.deepEqual(offenders, [], 'a harness that spawns with its mirror as cwd reopens the Windows leak this contract closes');
});

test('a mirror is removable immediately after a child that ran against it has exited', () => {
  const mirror = createHarnessMirror('qandeel-inf02-spawned-');
  writeFileSync(join(mirror, 'probe.mjs'), 'process.exitCode = 0;\n');
  const result = spawnSync(process.execPath, [join(mirror, 'probe.mjs')], { cwd: harnessChildCwd(mirror), encoding: 'utf8' });
  assert.equal(result.error, undefined, 'the probe child could not be started');
  assert.equal(result.status, 0, 'the probe child must exit cleanly');

  const outcome = removeHarnessMirror(mirror);
  assert.ok(outcome.removed, `the mirror must be removable right after its child exits: ${outcome.error?.message ?? ''}`);
  assert.equal(existsSync(mirror), false, 'and it is gone');
});

// ---------------------------------------------------------------------------------------------
// 4 + 5 — the removal itself.
// ---------------------------------------------------------------------------------------------

/** An `rm` that fails the first `failures` calls with `code`, then succeeds. */
function flakyRemover(failures, code) {
  let calls = 0;
  return {
    get calls() { return calls; },
    rm() {
      calls += 1;
      if (calls <= failures) {
        const error = new Error(`simulated ${code}`);
        error.code = code;
        throw error;
      }
    },
  };
}

for (const code of ['EBUSY', 'EPERM']) {
  test(`cleanup retries a transient ${code} and then succeeds`, () => {
    const remover = flakyRemover(2, code);
    const slept = [];
    const warnings = [];
    const outcome = removeHarnessMirror(join(tmpdir(), 'qandeel-inf02-retry'),
      { rm: remover.rm, sleep: (ms) => slept.push(ms), warn: (m) => warnings.push(m) });

    assert.ok(outcome.removed, `a transient ${code} must not be treated as a failure`);
    assert.equal(outcome.attempts, 3, 'it succeeded on the third attempt');
    assert.equal(remover.calls, 3);
    assert.deepEqual(slept, [20, 40], 'it backed off between attempts rather than spinning');
    assert.deepEqual(warnings, [], 'a recovered cleanup is not worth a warning');
  });
}

test('a lock that never clears is bounded, reported, and does not throw', () => {
  const remover = flakyRemover(Number.MAX_SAFE_INTEGER, 'EBUSY');
  const warnings = [];
  const outcome = removeHarnessMirror(join(tmpdir(), 'qandeel-inf02-stuck'),
    { retries: 3, rm: remover.rm, sleep: () => {}, warn: (m) => warnings.push(m) });

  assert.equal(outcome.removed, false);
  assert.equal(remover.calls, 4, 'bounded: retries + the first attempt, and not one more');
  // The reported count must be the real number of rm calls, not the retry ceiling restated —
  // here they happen to coincide (every attempt was exhausted), so this also pins the exact
  // bounded count the requirement asks for.
  assert.equal(outcome.attempts, 4, 'the exact bounded attempt count is reported, not just the ceiling');
  assert.equal(warnings.length, 1, 'the failure is stated exactly once');
  assert.match(warnings[0], /QANDEEL harness cleanup/u);
  assert.match(warnings[0], /EBUSY/u, 'the warning names the error it gave up on');
  assert.match(warnings[0], /after 4 attempts/u, 'the warning states the real attempt count, not the ceiling restated');
  assert.match(warnings[0], /test result above is unaffected/u, 'and says the test result is not what failed');
});

test('a non-transient error is surfaced at once rather than retried', () => {
  const remover = flakyRemover(Number.MAX_SAFE_INTEGER, 'ENOSPC');
  const slept = [];
  const warnings = [];
  const outcome = removeHarnessMirror(join(tmpdir(), 'qandeel-inf02-enospc'),
    { retries: 12, rm: remover.rm, sleep: (ms) => slept.push(ms), warn: (m) => warnings.push(m) });

  assert.equal(outcome.removed, false);
  assert.equal(remover.calls, 1, 'a real filesystem problem is not a lock to wait out');
  // With retries: 12 the ceiling is 13 possible attempts; only one ever happened, and both the
  // returned outcome and the warning text must say ONE, never the ceiling.
  assert.equal(outcome.attempts, 1, 'exactly one rm call was made, so attempts must be 1, not the retry ceiling');
  assert.deepEqual(slept, [], 'and nothing is slept away');
  assert.equal(outcome.error?.code, 'ENOSPC', 'the original error is returned, not swallowed');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /after 1 attempt\b/u, 'the warning must not claim 13 attempts when only 1 rm call occurred');
  assert.doesNotMatch(warnings[0], /after 13 attempts/u, 'the retry ceiling is not the same thing as what actually happened');
});

test('a failing cleanup cannot replace the failure the test actually found', () => {
  const remover = flakyRemover(Number.MAX_SAFE_INTEGER, 'EBUSY');
  const sentinel = new Error('the assertion the developer needs to read');
  assert.throws(() => {
    try {
      throw sentinel;
    } finally {
      removeHarnessMirror(join(tmpdir(), 'qandeel-inf02-masking'),
        { retries: 1, rm: remover.rm, sleep: () => {}, warn: () => {} });
    }
  }, (thrown) => thrown === sentinel,
  'the error leaving the try/finally must still be the one the test raised');
});

test('cleanup refuses anything that is not a harness mirror', () => {
  const warnings = [];
  const ordinary = join(tmpdir(), 'some-unrelated-directory');
  const outside = removeHarnessMirror(ordinary, { rm: () => assert.fail('must not be removed'), warn: (m) => warnings.push(m) });
  assert.equal(outside.removed, false);
  assert.match(outside.refused ?? '', /named "qandeel-/u, 'only a directory this module would have created may be removed');

  const nested = removeHarnessMirror(join(rootPath, '.git'), { rm: () => assert.fail('must not be removed'), warn: (m) => warnings.push(m) });
  assert.equal(nested.removed, false, 'cleanup never walks into a repository outside the mirror');

  const elsewhere = join(rootPath, 'qandeel-not-a-mirror');
  const wrongRoot = removeHarnessMirror(elsewhere, { rm: () => assert.fail('must not be removed'), warn: (m) => warnings.push(m) });
  assert.equal(wrongRoot.removed, false);
  assert.match(wrongRoot.refused ?? '', /harness temp root/u, 'the name alone is not enough - it must live in the temp root');
  assert.equal(warnings.length, 3, 'every refusal is stated');
});

// ---------------------------------------------------------------------------------------------
// 6 + 7 — nothing is left behind, and every harness is held to the same shape.
// ---------------------------------------------------------------------------------------------

test('a completed harness cycle leaves no mirror behind', () => {
  const before = new Set(readdirSync(harnessTmpRoot()).filter((entry) => entry.startsWith('qandeel-')));
  const mirror = createHarnessMirror('qandeel-inf02-cycle-');
  mkdirSync(join(mirror, 'database', 'migrations'), { recursive: true });
  writeFileSync(join(mirror, 'database', 'migrations', '0001_probe.sql'), '-- probe\n');
  assert.ok(existsSync(mirror), 'the mirror exists while the cycle runs');

  assert.ok(removeHarnessMirror(mirror).removed, 'and the cycle removes it');
  assert.equal(existsSync(mirror), false);

  const after = readdirSync(harnessTmpRoot()).filter((entry) => entry.startsWith('qandeel-') && !before.has(entry));
  assert.deepEqual(after, [], 'a completed cycle adds no qandeel- directory to the temp root');
});

test('every harness that builds a mirror uses the shared lifecycle, and none builds one by hand', () => {
  const sources = harnessSources();
  assert.ok(sources.length >= 5, `the harnesses that build mirrors must be discoverable; found ${sources.length}`);

  const byHand = sources.filter(({ text }) => /mkdtempSync\(/u.test(text)).map(({ name }) => name);
  assert.deepEqual(byHand, [],
    'a mirror built with mkdtempSync bypasses QANDEEL_TMP, the child-cwd rule and the bounded retry all at once');

  const unimported = sources.filter(({ text }) => !/from '(\.\.\/)*(\.\/)?(tests\/)?harness-temp-dir\.mjs'/u.test(text))
    .map(({ name }) => name);
  assert.deepEqual(unimported, [], 'each of them takes the lifecycle from the one module that owns it');

  const unremoved = sources.filter(({ text }) => !/removeHarnessMirror\(/u.test(text)).map(({ name }) => name);
  assert.deepEqual(unremoved, [], 'and each of them removes what it created');
});

test('this contract is registered', () => {
  const manifest = JSON.parse(readFileSync(join(rootPath, 'package.json'), 'utf8'));
  assert.equal(manifest.scripts[OWN_SCRIPT], `node --test tests/${SELF}`);
  const workflow = readFileSync(join(rootPath, '.github/workflows/api-ci.yml'), 'utf8');
  assert.equal((workflow.match(new RegExp(`run: npm run ${OWN_SCRIPT}\\b`, 'gu')) ?? []).length, 1, 'exactly one gate step');
});
