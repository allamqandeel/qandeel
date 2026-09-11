import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// QAN-INF-03 - Deterministic Expo SDK 57 Dependency Validation.
//
// `expo install --check` and (for SDK 54+) `expo-doctor`'s dependency-version
// check both validate the committed `apps/mobile` dependency set against the
// LIVE Expo compatibility registry by default, so a previously green, unchanged
// commit can go red the moment Expo publishes a newer recommended patch, with
// no repository change (this recurred after MOB-CI-01 and QAN-INF-02). This
// contract proves the mandatory gate no longer derives pass/fail authority from
// that mutable remote source, while the committed dependency baseline is still
// explicitly, and correctly, validated.

const root = new URL('../', import.meta.url);
const rootDir = fileURLToPath(root);
const read = (path) => readFile(new URL(path, root), 'utf8');
const readJson = async (path) => JSON.parse(await read(path));

const rootPackage = await readJson('package.json');
const mobilePackage = await readJson('apps/mobile/package.json');
const mobileCi = await read('.github/workflows/mobile-ci.yml');
const advisory = await read('.github/workflows/mobile-expo-dependency-drift-advisory.yml');
const bundledNativeModules = await readJson('node_modules/expo/bundledNativeModules.json');

// The exact packages the live Expo registry flagged in the CI run this task closes
// (GitHub Actions run 34599101911). All five are keys in `expo`'s own bundled,
// deterministic compatibility map (`expo` itself is not, by design: see the test
// below).
const PREVIOUSLY_FLAGGED_PACKAGES = [
  'expo-constants',
  'expo-dev-client',
  'expo-linking',
  'expo-router',
  'expo-sqlite',
];

const require = createRequire(import.meta.url);
const { isDependencyVersionIncorrect } = require(
  '../node_modules/@expo/cli/build/src/start/doctor/dependencies/validateDependenciesVersions.js',
);

function jobSlice(name, next) {
  const start = mobileCi.indexOf(`\n  ${name}:`);
  assert.notEqual(start, -1, `job ${name} must exist`);
  const end = next === undefined ? mobileCi.length : mobileCi.indexOf(`\n  ${next}:`);
  return mobileCi.slice(start, end === -1 ? mobileCi.length : end);
}

function stepLine(job, stepName) {
  const marker = `name: ${stepName},`;
  const idx = job.indexOf(marker);
  assert.notEqual(idx, -1, `step "${stepName}" must exist`);
  const lineStart = job.lastIndexOf('\n', idx) + 1;
  const lineEnd = job.indexOf('\n', idx);
  return job.slice(lineStart, lineEnd === -1 ? job.length : lineEnd);
}

function runNpmScript(scriptName, extraEnv) {
  // A single command string (not an argv array) with `shell: true` is required for
  // `npm`/`npm.cmd` to resolve correctly on Windows, and avoids Node's DEP0190
  // (unescaped array args under a shell) at the same time.
  const result = spawnSync(`npm run ${scriptName}`, {
    cwd: rootDir,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  assert.equal(result.error, undefined, `npm run ${scriptName} failed to start: ${result.error}`);
  return result;
}

test('the mandatory fast gate pins Expo dependency validation to the deterministic offline compatibility source', () => {
  const fast = jobSlice('verify-mobile-contracts', 'verify-android');
  const depsLine = stepLine(fast, 'Expo dependency validation (intentional typescript exclusion)');
  assert.match(depsLine, /run: npm run deps:check:mobile/u);
  assert.match(depsLine, /EXPO_OFFLINE:\s*'1'/u, 'deps:check:mobile must not depend on the live Expo registry');

  const doctorLine = stepLine(fast, 'Expo Doctor');
  assert.match(doctorLine, /run: npm run doctor:mobile/u);
  assert.match(doctorLine, /EXPO_OFFLINE:\s*'1'/u, 'doctor:mobile must not depend on the live Expo registry');
  assert.match(
    doctorLine,
    /EXPO_DOCTOR_ENABLE_DIRECTORY_CHECK:\s*'0'/u,
    'doctor:mobile must not depend on the live React Native Directory either',
  );

  // The determinism fix must not become a soft-failure: the existing toolchain
  // contract already forbids `continue-on-error` and `run: npm run ... ||` inside
  // this job; this re-anchors it in the same file the fix lives in.
  assert.doesNotMatch(fast, /continue-on-error/u);
  assert.doesNotMatch(fast, /run: npm run [^\n]*\|\|/u);

  // This very contract test must itself run inside the fast, unconditional gate.
  assert.match(
    fast,
    /run: npm run test:qan-inf-03-deterministic-expo-dependency-validation-contract/u,
  );
});

test('a live, non-blocking Expo dependency drift advisory exists and can never gate a pull request', () => {
  assert.doesNotMatch(advisory, /\bpull_request:/u, 'the advisory must never be a pull_request check');
  assert.doesNotMatch(advisory, /\bpush:/u, 'the advisory must never be a push check');
  assert.match(advisory, /\bschedule:/u);
  assert.match(advisory, /\bworkflow_dispatch:/u);
  assert.match(advisory, /run: npm run deps:check:mobile/u);
  assert.match(advisory, /run: npm run doctor:mobile/u);
  // The advisory exists specifically to keep querying the mutable live registry;
  // it must not silently inherit the deterministic override (a comment merely
  // explaining that override, as this file's header does, is fine).
  assert.doesNotMatch(advisory, /EXPO_OFFLINE:/u);

  // mobile-ci.yml's own PR trigger must watch both this fix and the advisory file.
  const trigger = mobileCi.slice(mobileCi.indexOf('paths:'), mobileCi.indexOf('push:'));
  assert.ok(trigger.includes("'tests/qan-inf-03-deterministic-expo-dependency-validation-contract.test.mjs'"));
  assert.ok(trigger.includes("'.github/workflows/mobile-expo-dependency-drift-advisory.yml'"));
});

test('QAN-INF-03 did not change any mobile dependency version', () => {
  // The live registry's six recommendations were noise, not a real
  // incompatibility: the deterministic local map (checked below) already proves
  // the committed pins are SDK 57 compatible, so no package version moved.
  assert.equal(mobilePackage.dependencies.expo, '~57.0.21');
  assert.equal(mobilePackage.dependencies['expo-constants'], '~57.0.17');
  assert.equal(mobilePackage.dependencies['expo-dev-client'], '~57.0.18');
  assert.equal(mobilePackage.dependencies['expo-linking'], '~57.0.9');
  assert.equal(mobilePackage.dependencies['expo-router'], '~57.0.20');
  assert.equal(mobilePackage.dependencies['expo-sqlite'], '~57.0.2');
  assert.equal(
    typeof rootPackage.scripts['test:qan-inf-03-deterministic-expo-dependency-validation-contract'],
    'string',
  );
});

test('the committed SDK 57 dependency baseline is explicitly validated against the deterministic local compatibility map', async () => {
  // `expo` itself is deliberately absent from `expo/bundledNativeModules.json`: it
  // is the file's own source, so there is nothing local to compare it against.
  // Its own SDK/patch line is already pinned exactly by
  // mobile-foundation-toolchain-contract.test.mjs (`expo: '~57.0.21'`); freshness
  // beyond that pin is what the live advisory reports, not a compatibility fact.
  assert.equal(Object.hasOwn(bundledNativeModules, 'expo'), false);

  for (const packageName of PREVIOUSLY_FLAGGED_PACKAGES) {
    const expectedRange = bundledNativeModules[packageName];
    assert.equal(typeof expectedRange, 'string', `${packageName} must be a known bundled native module`);
    const installed = await readJson(`node_modules/${packageName}/package.json`);
    assert.equal(
      isDependencyVersionIncorrect(packageName, installed.version, expectedRange),
      false,
      `${packageName}@${installed.version} must satisfy the deterministic range ${expectedRange}`,
    );
  }
});

test('a real SDK 57 incompatibility fails the exact comparison the deterministic gate uses', () => {
  const expectedRange = bundledNativeModules['expo-router'];
  assert.equal(typeof expectedRange, 'string');
  assert.equal(isDependencyVersionIncorrect('expo-router', '1.0.0', expectedRange), true);
  assert.equal(isDependencyVersionIncorrect('expo-router', expectedRange.replace('~', ''), expectedRange), false);
});

test('expo install --check and expo-doctor both pass deterministically, offline, on the committed baseline', () => {
  const deps = runNpmScript('deps:check:mobile', { EXPO_OFFLINE: '1' });
  assert.equal(
    deps.status,
    0,
    `deps:check:mobile must pass offline on the committed baseline\nstdout: ${deps.stdout}\nstderr: ${deps.stderr}`,
  );

  const doctor = runNpmScript('doctor:mobile', {
    EXPO_OFFLINE: '1',
    EXPO_DOCTOR_ENABLE_DIRECTORY_CHECK: '0',
  });
  assert.equal(
    doctor.status,
    0,
    `doctor:mobile must pass offline on the committed baseline\nstdout: ${doctor.stdout}\nstderr: ${doctor.stderr}`,
  );
});
