import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  ALWAYS_INCLUDED_PREFIXES,
  EXCLUDED_PREFIXES,
  FINGERPRINT_DOMAIN,
  FINGERPRINT_SCHEMA_VERSION,
  classifyBuildInput,
  computeFingerprint,
  readTreeEntries,
} from '../scripts/phase-m/native-build-fingerprint.mjs';
import {
  BUILD_RECIPES,
  CONFIGURATION_KEYS,
  MANIFEST_SCHEMA,
  PRODUCT_ENTRY,
  VALIDATION_ENTRY,
  digestConfigurationValue,
} from '../scripts/phase-m/native-artifact-manifest.mjs';
import { verifyManifest } from '../scripts/phase-m/verify-native-artifact-manifest.mjs';

// QAN-INF-04 — Native CI Build / Validation Decoupling v1. Static executable contract.
//
// > **A failed emulator, simulator or Maestro validation must be rerunnable against the already-built
// > native artifact, and an artifact may only be reused when deterministic provenance proves it is
// > build-compatible with the current checkout and public build configuration.**
//
// T-13's cloud runs rebuilt an unchanged Release binary every time a flow, an ADB transport or a
// simulator misbehaved, because the build and the validation were one job. This gate guards the split
// that fixed it, and — far more importantly — it guards the thing the split makes possible and
// dangerous at the same time: INSTALLING A BINARY THIS RUN DID NOT BUILD.
//
// ## What is actually at risk
//
// Not build time. The risk is a PASS attributed to code that was never inside the artifact — a green
// T-13 recovery report produced by a binary built from a different `apps/mobile/src`, a different
// bundled `__validation__` harness, or for a Cloudflare Quick Tunnel that died two days ago. That
// result would be worse than a failure, because nothing about it looks wrong.
//
// So the direction of every rule here is one-way: FALSE NEGATIVES FOR REUSE ARE ACCEPTABLE, FALSE
// POSITIVES ARE NOT. A refused reuse costs one rebuild. An accepted bad reuse costs the truth of the
// evidence.
//
// ## Forward safety
//
// Nothing here is a ceiling on the repository. No whole-file hash of a shared workflow, no total job
// count, no file census, no dependency census. Every claim is either a PERMANENT INVARIANT of the
// build/validation boundary or a statement about the four files QAN-INF-04 itself owns. A later task
// may add jobs, steps, platforms and recipes freely; it may not make a consumer build, nor make a
// reuse accept something it cannot prove.
//
// ## Non-vacuity
//
// Every absence predicate is paired with a planted defect: the predicate is run against a mutated copy
// of the real source and required to REJECT it. A guard that cannot fail is not a guard.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');

const PHASE_M = '.github/workflows/t12-phase-m-cloud-validation.yml';
const MOBILE_CI = '.github/workflows/mobile-ci.yml';
const DEMONSTRATION = '.github/workflows/qan-inf-04-artifact-reuse-demonstration.yml';

/** Code only: a comment may name a forbidden pattern in order to forbid it. */
const stripYamlComments = (text) => text.replace(/^\s*#[^\n]*$/gmu, '');

/**
 * Splits a workflow into its job blocks.
 *
 * Deliberately not a YAML library: the root contracts run on a bare clone with `node --test` and no
 * production dependency, and a parser reached through a transitive hoist is a gate that can vanish
 * with an unrelated lockfile change. Jobs are the only two-space keys after `jobs:`, so the shape is
 * unambiguous in this file family.
 */
function jobBlocks(text) {
  const blocks = new Map();
  let started = false;
  let current = null;
  for (const line of text.split('\n')) {
    if (!started) {
      if (line === 'jobs:') started = true;
      continue;
    }
    if (/^[A-Za-z]/u.test(line)) break; // a later top-level key ends the jobs section
    const header = /^ {2}([A-Za-z0-9_-]+):\s*$/u.exec(line);
    if (header) {
      current = header[1];
      blocks.set(current, []);
      continue;
    }
    if (current !== null) blocks.get(current).push(line);
  }
  return new Map([...blocks].map(([name, lines]) => [name, lines.join('\n')]));
}

/** The T-13 recovery chains: `[producer, consumer]` per platform. */
const T13_CHAINS = Object.freeze({
  android: { producer: 'android-t13-build', consumer: 'android-t13-recovery-emulator' },
  ios: { producer: 'ios-t13-build', consumer: 'ios-t13-recovery-simulator' },
});

/**
 * Commands that COMPILE a native application. A consumer that runs any of these has not been
 * decoupled from its build, whatever its name says.
 */
const NATIVE_BUILD_COMMANDS = Object.freeze([
  'gradlew',
  'assembleRelease',
  'xcodebuild',
  'pod install',
  'prebuild:android',
  'prebuild:ios',
  'expo prebuild',
]);

/**
 * Constructs that would retry a native validation automatically. The task forbids every one of them:
 * a flaky native failure must be a human decision to re-run, because an automatic retry turns an
 * intermittent Product defect into a green run nobody looked at.
 */
const AUTOMATIC_RETRY_CONSTRUCTS = Object.freeze([
  'nick-fields/retry',
  'nick-invision/retry',
  'Wandalen/wretry',
  'retry-action',
  'max_attempts',
  'retry_on',
  'rerun-failed',
  'gh run rerun',
]);

// ---------------------------------------------------------------------------------------------
// 1 — the consumers do not build
// ---------------------------------------------------------------------------------------------

test('1 — every T-13 validation consumer contains no Android or iOS build command', () => {
  const jobs = jobBlocks(read(PHASE_M));
  for (const [platform, { consumer }] of Object.entries(T13_CHAINS)) {
    assert.ok(jobs.has(consumer), `${consumer} exists`);
    const code = stripYamlComments(jobs.get(consumer));
    for (const command of NATIVE_BUILD_COMMANDS) {
      assert.equal(code.includes(command), false, `the ${platform} consumer must not run ${command}`);
    }
    // `npm ci` too: a consumer with no `node_modules` cannot acquire a build step by accident, and
    // every script it runs — preconditions, provenance gate, sequencer, evidence, phase gate — needs
    // only Node builtins, Maestro and the platform tools.
    assert.equal(/\bnpm ci\b/u.test(code), false, `the ${platform} consumer installs no dependencies`);
    // It still runs the sequence it is the consumer of.
    assert.match(code, /bash scripts\/phase-m\/run-t13-recovery-phases\.sh/u, `the ${platform} consumer runs the T-13 sequencer`);
  }

  // Non-vacuity: the predicate must reject a consumer that regained its build.
  const planted = `${stripYamlComments(jobs.get(T13_CHAINS.android.consumer))}\n      - run: ./gradlew :app:assembleRelease\n`;
  assert.equal(NATIVE_BUILD_COMMANDS.some((command) => planted.includes(command)), true, 'the predicate rejects a planted Gradle step');
});

test('1b — the producers DO build, so the split moved the build rather than deleting it', () => {
  const jobs = jobBlocks(read(PHASE_M));
  assert.match(stripYamlComments(jobs.get(T13_CHAINS.android.producer)), /\.\/gradlew :app:assembleRelease -PreactNativeArchitectures=x86_64/u);
  assert.match(stripYamlComments(jobs.get(T13_CHAINS.ios.producer)), /xcodebuild .*-sdk iphonesimulator/u);
  // The validation entry is what a T-13 artifact must register, and the producer is where that happens.
  for (const { producer } of Object.values(T13_CHAINS)) {
    assert.match(stripYamlComments(jobs.get(producer)), /select-validation-entry\.mjs --apply/u);
    assert.match(stripYamlComments(jobs.get(producer)), /assert-validation-preconditions\.mjs entry validation/u);
    assert.match(stripYamlComments(jobs.get(producer)), /assert-validation-preconditions\.mjs configuration/u);
  }
});

// ---------------------------------------------------------------------------------------------
// 2 — producers upload the binary AND its identity
// ---------------------------------------------------------------------------------------------

test('2 — each producer uploads the app artifact and its identity manifest, together, or fails', () => {
  const jobs = jobBlocks(read(PHASE_M));
  for (const [platform, { producer }] of Object.entries(T13_CHAINS)) {
    const code = stripYamlComments(jobs.get(producer));
    assert.match(code, /native-artifact-manifest\.mjs/u, `the ${platform} producer writes a machine identity manifest`);
    assert.match(code, /--out "\$out\/native-artifact-manifest\.json"/u, `the ${platform} manifest lands beside the binary`);
    assert.match(code, /record-artifact-identity\.mjs/u, `the ${platform} producer keeps the human evidence record`);
    assert.match(code, /uses: actions\/upload-artifact@v4/u);
    // ONE directory is uploaded, so a binary can never travel without the manifest that describes it.
    assert.match(code, /path: \$\{\{ runner\.temp \}\}\/native-build/u, `the ${platform} producer uploads the staged directory`);
    // An empty upload must fail the producer, never produce a consumer that downloads nothing.
    assert.match(code, /if-no-files-found: error/u, `the ${platform} producer refuses to upload nothing`);
    assert.equal(code.includes('if-no-files-found: ignore'), false, `the ${platform} producer never ignores a missing artifact`);
  }
  assert.match(stripYamlComments(jobs.get(T13_CHAINS.android.producer)), /name: t13-recovery-android-build/u);
  assert.match(stripYamlComments(jobs.get(T13_CHAINS.ios.producer)), /name: t13-recovery-ios-build/u);
  // A `.app` is a directory; an uploaded directory loses the symlinks and the executable bit that a
  // simulator install needs. It must be packaged before it is recorded or shipped.
  assert.match(stripYamlComments(jobs.get(T13_CHAINS.ios.producer)), /ditto -c -k --keepParent/u);
});

// ---------------------------------------------------------------------------------------------
// 3 and 4 — the consumers download, then PROVE, then install. In that order.
// ---------------------------------------------------------------------------------------------

test('3, 4 — a consumer downloads, verifies provenance, and only then installs', () => {
  const jobs = jobBlocks(read(PHASE_M));
  for (const [platform, { consumer, producer }] of Object.entries(T13_CHAINS)) {
    const code = stripYamlComments(jobs.get(consumer));

    const download = code.indexOf('uses: actions/download-artifact@v4');
    const verify = code.indexOf('verify-native-artifact-manifest.mjs');
    assert.ok(download >= 0, `the ${platform} consumer downloads the build artifact`);
    assert.ok(verify >= 0, `the ${platform} consumer verifies the artifact identity`);
    assert.ok(download < verify, `the ${platform} consumer downloads BEFORE it verifies`);

    // Every install command must come after the verification. This is the whole ordering claim, and
    // it is asserted over the install verbs themselves rather than over a step name.
    for (const install of ['adb install', 'simctl install']) {
      const at = code.indexOf(install);
      if (at >= 0) assert.ok(verify < at, `the ${platform} consumer verifies BEFORE ${install}`);
    }

    // The verification names what THIS consumer consumes: platform, role and recipe are arguments,
    // not defaults, so a consumer cannot accept an artifact built for a different purpose.
    assert.match(code, new RegExp(`--platform ${platform}\\b`, 'u'));
    assert.match(code, /--role AUTH_VALIDATION/u);
    assert.match(code, /--recipe t13-recovery-validation/u);
    assert.match(code, /--mode "\$MODE"/u);

    // Same-run and prior-run are the only two modes, chosen by the presence of the reuse input alone.
    assert.match(code, /MODE: \$\{\{ inputs\.reuse_artifacts_from_run_id == '' && 'same-run' \|\| 'prior-run' \}\}/u);

    // The consumer is bound to ITS OWN producer, and holds the minimum token scope for a cross-run read.
    assert.match(jobs.get(consumer), new RegExp(`needs: \\[${producer}\\]`, 'u'));
    assert.match(jobs.get(consumer), /permissions:\n\s+contents: read\n(\s+#[^\n]*\n)*\s+actions: read/u,
      `the ${platform} consumer takes actions:read and nothing more`);
    assert.equal(/actions: write/u.test(jobs.get(consumer)), false);
  }

  // Non-vacuity: an ordering predicate that cannot fail proves nothing. Reverse the two markers.
  const reversed = 'adb install -r "$APK"\nverify-native-artifact-manifest.mjs';
  assert.equal(reversed.indexOf('verify-native-artifact-manifest.mjs') < reversed.indexOf('adb install'), false,
    'the ordering predicate rejects an install placed before the verification');
});

test('4b — prior-run reuse is manual, explicit, and skips only the producer it replaces', () => {
  const workflow = read(PHASE_M);
  const jobs = jobBlocks(workflow);
  assert.match(workflow, /^      reuse_artifacts_from_run_id:$/mu, 'the reuse input exists');
  assert.match(workflow, /reuse_artifacts_from_run_id:\n(\s+#[^\n]*\n)*\s+description:[^\n]*\n\s+required: false\n\s+type: string\n\s+default: ''/u,
    'reuse is opt-in: an ordinary dispatch builds');

  for (const { producer, consumer } of Object.values(T13_CHAINS)) {
    // The producer is skipped exactly when a prior run is named.
    assert.match(jobs.get(producer), /if: [^\n]*inputs\.reuse_artifacts_from_run_id == ''/u);
    // The consumer runs on its own producer's success OR on an explicit reuse, and on nothing else —
    // in particular never after a FAILED producer.
    assert.match(jobs.get(consumer),
      new RegExp(`if: always\\(\\)[^\\n]*needs\\.${producer}\\.result == 'success' \\|\\| inputs\\.reuse_artifacts_from_run_id != ''`, 'u'));
    // The cross-run download is the only one that carries a run id and a token.
    assert.match(jobs.get(consumer), /run-id: \$\{\{ inputs\.reuse_artifacts_from_run_id \}\}\n\s+github-token: \$\{\{ github\.token \}\}/u);
  }
});

// ---------------------------------------------------------------------------------------------
// 5, 6, 7 — what the fingerprint must and must not notice
// ---------------------------------------------------------------------------------------------

/**
 * The real tree, so these are claims about this repository and not about a fixture.
 *
 * `tests/forward-safety-contract.test.mjs` runs every contract inside a faithful COPY of the
 * repository with `.git` deliberately absent, so `git ls-tree` has nothing to read there. Every claim
 * below is COMPARATIVE — change one entry and the digest must move, or must not — so any stable
 * per-path content id serves equally well, and the fallback keeps this gate meaningful in the mirror
 * instead of excluding it from the forward-safety sweep.
 *
 * The production tooling has no such fallback and must never grow one: a provenance tool that quietly
 * changes how it identifies content is itself a provenance hazard. The fallback lives here, alone.
 */
function loadTreeEntries() {
  try {
    return readTreeEntries('HEAD', rootPath);
  } catch {
    const skip = /^(?:node_modules|\.git|\.expo|\.turbo|coverage|build|android|ios)$/u;
    const entries = [];
    const walk = (dir, prefix) => {
      for (const entry of readdirSync(dir)) {
        if (skip.test(entry)) continue;
        const full = join(dir, entry);
        const path = prefix === '' ? entry : `${prefix}/${entry}`;
        if (statSync(full).isDirectory()) walk(full, path);
        else entries.push({ path, oid: createHash('sha1').update(readFileSync(full)).digest('hex') });
      }
    };
    walk(rootPath, '');
    return entries;
  }
}

const treeEntries = loadTreeEntries();
const baseline = computeFingerprint(treeEntries);

/** Returns the fingerprint of the real tree with one path's content changed. */
function fingerprintWithChange(path) {
  const found = treeEntries.some((entry) => entry.path === path);
  assert.equal(found, true, `${path} is tracked, so this is a real change and not a hypothetical one`);
  return computeFingerprint(treeEntries.map((entry) => (
    entry.path === path ? { ...entry, oid: 'f'.repeat(40) } : entry
  ))).value;
}

test('5 — a change to build-affecting mobile Product source invalidates reuse', () => {
  for (const path of [
    'apps/mobile/src/integration/runtime/integration-runtime.ts',
    'apps/mobile/src/integration/composition/ProductRoot.tsx',
    'apps/mobile/app.config.js',
    'apps/mobile/package.json',
    'package-lock.json',
  ]) {
    assert.notEqual(fingerprintWithChange(path), baseline.value, `${path} must invalidate the artifact`);
  }
});

test('6 — a change to the BUNDLED validation harness invalidates reuse', () => {
  // This is the exclusion that must never be written. `__validation__` sits beside `__tests__` and
  // `__fixtures__` and reads exactly like test scaffolding, but it is the REGISTERED ROOT COMPONENT of
  // every validation build: changing it changes the app under test.
  for (const path of [
    'apps/mobile/src/integration/__validation__/validation-entry.tsx',
    'apps/mobile/src/integration/__validation__/recovery-validation.ts',
    'apps/mobile/src/integration/__validation__/AuthStorageValidationHarness.tsx',
  ]) {
    assert.notEqual(fingerprintWithChange(path), baseline.value, `${path} is bundled and must invalidate the artifact`);
  }

  // And it survives an exclusion rule that would otherwise swallow the whole directory: the override
  // wins. Without this, a future "exclude the dunder directories" tidy-up silently breaks the gate.
  const swallowing = { excludedPrefixes: ['apps/mobile/src/integration/__'] };
  assert.equal(classifyBuildInput('apps/mobile/src/integration/__tests__/recovery.test.ts', swallowing).included, false,
    'the planted exclusion really does match this directory family');
  assert.equal(classifyBuildInput('apps/mobile/src/integration/__validation__/validation-entry.tsx', swallowing).included, true,
    'the bundled harness is included even against an exclusion that matches it');
  assert.deepEqual([...ALWAYS_INCLUDED_PREFIXES], ['apps/mobile/src/integration/__validation__/']);
});

test('7 — a runner-only Phase-M orchestration or flow change stays reusable, by explicit classification', () => {
  for (const path of [
    'scripts/phase-m/run-t13-recovery-phases.sh',
    'scripts/phase-m/gate-t13-recovery-phases.sh',
    'scripts/phase-m/collect-validation-evidence.mjs',
    'apps/mobile/.maestro/t13-recovery-after.yaml',
    'docs/recovery-persistence-v1.md',
  ]) {
    assert.equal(fingerprintWithChange(path), baseline.value, `${path} runs outside the binary and must NOT invalidate it`);
  }

  // The classification is explicit and reasoned, never incidental.
  for (const prefix of ['scripts/phase-m/', 'apps/mobile/.maestro/', 'docs/']) {
    assert.ok(EXCLUDED_PREFIXES.includes(prefix), `${prefix} is an explicit exclusion`);
  }
  assert.equal(classifyBuildInput('scripts/phase-m/run-t13-recovery-phases.sh').reason, 'EXCLUDED_PREFIX:scripts/phase-m/');
  assert.equal(classifyBuildInput('apps/mobile/src/app/index.tsx').reason, 'BUILD_INPUT');

  // The exclusions are only safe because nothing in the bundle reaches them. Proven, not assumed:
  // every import specifier in the mobile workspace is walked, and none may resolve into an excluded
  // tree. A comment may NAME an excluded path in order to talk about it; code may not import one.
  const sources = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(?:ts|tsx|js|jsx|mjs)$/u.test(entry)) sources.push(full);
    }
  };
  walk(join(rootPath, 'apps/mobile/src'));
  sources.push(join(rootPath, 'apps/mobile/app.config.js'));

  for (const file of sources) {
    const code = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/\/\/[^\n]*/gu, '');
    const relative = posix.dirname(file.replace(/\\/gu, '/').slice(rootPath.replace(/\\/gu, '/').length));
    for (const match of code.matchAll(/(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/gu)) {
      const specifier = match[1];
      if (!specifier.startsWith('.')) {
        // A bare specifier is a package, resolved from `node_modules`; it can never name a repository
        // path. The one thing to refuse is a specifier that pretends otherwise.
        assert.equal(/^(?:scripts|tests|database|docs|apps)\//u.test(specifier), false,
          `${file} imports the repository path ${specifier} as if it were a package`);
        continue;
      }
      const resolved = posix.normalize(posix.join(relative, specifier));
      assert.equal(classifyBuildInput(resolved).included, true,
        `${file} imports ${specifier}, which resolves to the EXCLUDED path ${resolved}`);
    }
  }
});

test('7c — every excluded-from-the-fingerprint Maestro flow is still parseable text', () => {
  // Measured, the expensive way. Excluding `apps/mobile/.maestro/` from the fingerprint is what makes
  // a flow fix cheap — the binary is reused rather than rebuilt — and that same exclusion means NO
  // gate downstream of this one ever looks at a flow again before a runner feeds it to Maestro.
  //
  // A comment edit to `boot-smoke.yaml` in this very task inserted a raw BEL (0x07) through a shell
  // escaping mistake. Every static gate passed it: the byte sat inside a comment, so the token and
  // absence predicates the T-12 and T-13 contracts run were all still satisfied. Maestro then failed
  // with `Parsing Failed at boot-smoke.yaml:1:1` on two platforms, after the artifacts were built,
  // downloaded and installed — the most expensive possible place to discover a one-byte defect.
  //
  // So the file that reuse makes cheap to change is the file that gets a cheap check.
  const dir = join(rootPath, 'apps/mobile/.maestro');
  const flows = readdirSync(dir).filter((file) => file.endsWith('.yaml'));
  assert.ok(flows.length > 0, 'there are flows to check');
  for (const flow of flows) {
    const text = readFileSync(join(dir, flow), 'utf8');
    const control = [...text].findIndex((ch) => {
      const code = ch.codePointAt(0);
      return code < 0x20 && ch !== '\n' && ch !== '\t';
    });
    assert.equal(control, -1,
      `${flow} carries a control character at offset ${control} (0x${text.codePointAt(Math.max(control, 0)).toString(16)}); `
      + 'Maestro refuses the whole file and the failure surfaces only on a runner');
    assert.equal(text.includes('﻿'), false, `${flow} carries a byte-order mark`);
    // The two structural lines Maestro needs before it will run anything at all.
    assert.match(text, /^appId: com\.qandeel\.mobile$/mu, `${flow} declares the app id`);
    assert.match(text, /^---$/mu, `${flow} separates its header from its commands`);
  }

  // Non-vacuity: the predicate must reject the exact byte that got through.
  const planted = 'appId: com.qandeel.mobile\n# a comment with a  in it\n---\n';
  assert.notEqual([...planted].findIndex((ch) => ch.codePointAt(0) < 0x20 && ch !== '\n' && ch !== '\t'), -1,
    'the predicate rejects a planted control character');
});

test('7b — the fingerprint is deterministic, order-independent, and self-protecting against rule drift', () => {
  assert.equal(computeFingerprint(treeEntries).value, baseline.value, 'the same tree gives the same digest');
  assert.equal(computeFingerprint([...treeEntries].reverse()).value, baseline.value, 'input order cannot change it');
  assert.ok(baseline.includedFileCount > 0 && baseline.excludedFileCount > 0, 'both sides of the classification are non-empty');
  assert.equal(baseline.algorithm, 'sha256');
  assert.equal(baseline.schemaVersion, FINGERPRINT_SCHEMA_VERSION);

  // The digest covers the RULES as well as the content, without hashing the rule file: any rule change
  // that alters the included set alters the digest, because the set is what is digested. A rule change
  // that does not alter the set cannot change the answer, and is therefore harmless by construction.
  const narrower = computeFingerprint(treeEntries, { excludedPrefixes: [...EXCLUDED_PREFIXES, 'apps/mobile/src/'] });
  assert.notEqual(narrower.value, baseline.value, 'a rule that drops real build inputs cannot reproduce the digest');
  assert.ok(narrower.includedFileCount < baseline.includedFileCount);

  // Corrupt input is refused rather than digested into a plausible answer.
  assert.throws(() => computeFingerprint([{ path: 'a', oid: 'not-an-oid' }]), /no usable object id/u);
  assert.throws(() => computeFingerprint([
    { path: 'apps/mobile/x.ts', oid: 'a'.repeat(40) },
    { path: 'apps/mobile/x.ts', oid: 'b'.repeat(40) },
  ]), /appears twice with different object ids/u);
  assert.throws(() => computeFingerprint('not an array'), /must be an array/u);
});

// ---------------------------------------------------------------------------------------------
// 8, 9, 10, 11 — the verifier refuses everything it cannot prove
// ---------------------------------------------------------------------------------------------

const CONFIG_PRESENT = Object.fromEntries(CONFIGURATION_KEYS.map((key) => [key, digestConfigurationValue(key, `value-for-${key}`)]));

/** A manifest that verifies cleanly, so each test can break exactly one thing about it. */
function goodManifest(overrides = {}) {
  return {
    schema: MANIFEST_SCHEMA,
    buildRecipe: { id: 't13-recovery-validation', version: BUILD_RECIPES['t13-recovery-validation'] },
    commit: 'a'.repeat(40),
    platform: 'android',
    role: 'AUTH_VALIDATION',
    entry: VALIDATION_ENTRY,
    artifact: { name: 'app-release.apk', bytes: 1024, sha256: 'b'.repeat(64) },
    buildInputFingerprint: {
      algorithm: 'sha256',
      domain: FINGERPRINT_DOMAIN,
      schemaVersion: FINGERPRINT_SCHEMA_VERSION,
      value: 'c'.repeat(64),
      includedFileCount: 322,
      excludedFileCount: 982,
    },
    target: { kind: 'android-device', abis: ['x86_64'] },
    toolchain: { node: 'v22.13.0', expo: '57.0.21', reactNative: '0.86.3' },
    configuration: { ...CONFIG_PRESENT, apiBaseUrlHost: 'tunnel-one.trycloudflare.com' },
    provenance: { runId: '1', runAttempt: '1', recordedAt: '2026-01-01T00:00:00.000Z' },
    ...overrides,
  };
}

function goodExpectation(overrides = {}) {
  return {
    platform: 'android',
    role: 'AUTH_VALIDATION',
    recipe: 't13-recovery-validation',
    abis: ['x86_64'],
    mode: 'same-run',
    commit: 'a'.repeat(40),
    artifactSha256: 'b'.repeat(64),
    artifactBytes: 1024,
    fingerprint: 'c'.repeat(64),
    configuration: CONFIG_PRESENT,
    ...overrides,
  };
}

/** Asserts that one mutation is refused, and names the refusal code that must appear. */
function refuses(code, manifest, expectation = goodExpectation()) {
  const verdict = verifyManifest(manifest, expectation);
  assert.equal(verdict.ok, false, `expected a refusal carrying ${code}`);
  assert.ok(verdict.refusals.some((refusal) => refusal.startsWith(`${code}:`)),
    `expected ${code}, got: ${verdict.refusals.join(' | ')}`);
}

test('the baseline manifest verifies — without this, every refusal below would be vacuous', () => {
  const verdict = verifyManifest(goodManifest(), goodExpectation());
  assert.equal(verdict.ok, true, `the good manifest must pass: ${verdict.refusals.join(' | ')}`);
});

test('8 — a build-time configuration mismatch rejects reuse, and the API origin is one of them', () => {
  // The dead-tunnel case, exactly. The origin is embedded at BUILD time by `app.config.js`, so an
  // artifact built for one tunnel cannot be validated against another however fresh the tunnel is.
  refuses('CONFIGURATION_VALUE_MISMATCH', goodManifest(), goodExpectation({
    configuration: {
      ...CONFIG_PRESENT,
      QANDEEL_API_BASE_URL: digestConfigurationValue('QANDEEL_API_BASE_URL', 'https://a-different-tunnel.trycloudflare.com'),
    },
  }));
  for (const key of CONFIGURATION_KEYS) {
    refuses('CONFIGURATION_VALUE_MISMATCH', goodManifest(), goodExpectation({
      configuration: { ...CONFIG_PRESENT, [key]: digestConfigurationValue(key, 'something-else') },
    }));
  }

  // "Unset" is a recorded value, not a gap: a Mobile CI artifact built with no configuration is
  // provably not interchangeable with a Phase-M artifact built with it, in either direction.
  const unconfigured = Object.fromEntries(CONFIGURATION_KEYS.map((key) => [key, digestConfigurationValue(key, undefined)]));
  refuses('CONFIGURATION_PRESENCE_MISMATCH', goodManifest({ configuration: unconfigured }), goodExpectation());
  refuses('CONFIGURATION_PRESENCE_MISMATCH', goodManifest(), goodExpectation({ configuration: unconfigured }));

  // And the whole section is required.
  refuses('MANIFEST_FIELD_MISSING', goodManifest({ configuration: null }));
  refuses('CONFIGURATION_FIELD_MALFORMED', goodManifest({ configuration: { ...CONFIG_PRESENT, QANDEEL_API_BASE_URL: 'a string' } }));
});

test('9 — an artifact hash, size or build-input mismatch rejects reuse', () => {
  refuses('ARTIFACT_HASH_MISMATCH', goodManifest(), goodExpectation({ artifactSha256: 'd'.repeat(64) }));
  refuses('ARTIFACT_SIZE_MISMATCH', goodManifest(), goodExpectation({ artifactBytes: 999 }));
  refuses('BUILD_INPUT_FINGERPRINT_MISMATCH', goodManifest(), goodExpectation({ fingerprint: 'e'.repeat(64) }));
  // A fingerprint computed under different rules is not comparable and must not be compared.
  refuses('FINGERPRINT_SCHEMA_MISMATCH', goodManifest({
    buildInputFingerprint: { ...goodManifest().buildInputFingerprint, schemaVersion: FINGERPRINT_SCHEMA_VERSION + 1 },
  }));
  refuses('FINGERPRINT_SCHEMA_MISMATCH', goodManifest({
    buildInputFingerprint: { ...goodManifest().buildInputFingerprint, domain: 'something.else' },
  }));
});

test('10 — a missing, malformed or wrong-schema identity rejects reuse', () => {
  refuses('MANIFEST_NOT_AN_OBJECT', null);
  refuses('MANIFEST_NOT_AN_OBJECT', 'a string');
  refuses('MANIFEST_NOT_AN_OBJECT', ['an', 'array']);
  refuses('SCHEMA_MISMATCH', goodManifest({ schema: undefined }));
  refuses('SCHEMA_MISMATCH', goodManifest({ schema: 'qandeel.native-artifact-identity/2' }));

  // Every required field, one at a time. A manifest short one field is refused for that, and the
  // refusal names the field rather than surfacing later as a confusing mismatch.
  for (const [path, mutation] of [
    ['commit', { commit: undefined }],
    ['platform', { platform: undefined }],
    ['role', { role: undefined }],
    ['entry', { entry: undefined }],
    ['buildRecipe.id', { buildRecipe: { version: 1 } }],
    ['artifact.sha256', { artifact: { name: 'a', bytes: 1 } }],
    ['buildInputFingerprint.value', { buildInputFingerprint: { domain: FINGERPRINT_DOMAIN, schemaVersion: 1 } }],
    ['target.kind', { target: {} }],
    ['toolchain.node', { toolchain: {} }],
  ]) {
    const verdict = verifyManifest(goodManifest(mutation), goodExpectation());
    assert.equal(verdict.ok, false, `a manifest missing ${path} must be refused`);
    assert.ok(verdict.refusals.includes(`MANIFEST_FIELD_MISSING: ${path}`),
      `the refusal must name ${path}, got: ${verdict.refusals.join(' | ')}`);
  }

  refuses('COMMIT_MALFORMED', goodManifest({ commit: 'HEAD' }), goodExpectation({ commit: 'HEAD' }));
  refuses('ARTIFACT_DIGEST_MALFORMED', goodManifest({ artifact: { name: 'a', bytes: 1024, sha256: 'short' } }),
    goodExpectation({ artifactSha256: 'short' }));
  refuses('MODE_INVALID', goodManifest(), goodExpectation({ mode: 'whatever' }));
});

test('11 — a platform, role, entry, recipe or device-target mismatch rejects reuse', () => {
  refuses('PLATFORM_MISMATCH', goodManifest({ platform: 'ios' }));
  refuses('ROLE_MISMATCH', goodManifest({ role: 'PRODUCT', entry: PRODUCT_ENTRY }));
  // A manifest that claims a role its own entry contradicts is refused on that alone: this is the
  // check that catches a job which selected the harness entry and recorded itself as Product.
  refuses('ENTRY_ROLE_DISAGREEMENT', goodManifest({ entry: PRODUCT_ENTRY }));
  refuses('RECIPE_MISMATCH', goodManifest({ buildRecipe: { id: 'mobile-ci-boot-smoke', version: 1 } }));
  refuses('RECIPE_VERSION_MISMATCH', goodManifest({ buildRecipe: { id: 't13-recovery-validation', version: 99 } }));
  // An arm64-only APK installs on no x86_64 emulator, and a different simulator runtime is a different
  // artifact. Both are the device target, and both refuse.
  refuses('TARGET_ABI_MISMATCH', goodManifest({ target: { kind: 'android-device', abis: ['arm64-v8a'] } }));
  refuses('TARGET_ABI_MISMATCH', goodManifest({ target: { kind: 'android-device', abis: ['x86_64', 'arm64-v8a'] } }));

  const iosGood = goodManifest({
    platform: 'ios',
    target: { kind: 'ios-simulator', sdk: 'iphonesimulator', configuration: 'Release', simulatorName: 'iPhone 17', simulatorRuntime: 'iOS-26-5' },
  });
  const iosExpect = goodExpectation({ platform: 'ios', abis: [], simulatorName: 'iPhone 17', simulatorRuntime: 'iOS-26-5' });
  assert.equal(verifyManifest(iosGood, iosExpect).ok, true, 'the iOS baseline verifies');
  refuses('TARGET_SIMULATOR_MISMATCH', iosGood, { ...iosExpect, simulatorRuntime: 'iOS-27-0' });
  refuses('TARGET_KIND_MISMATCH', goodManifest({ platform: 'ios', target: { kind: 'android-device', abis: ['x86_64'] } }), iosExpect);
});

test('prior-run mode relaxes the commit and nothing else', () => {
  const prior = goodExpectation({ mode: 'prior-run', commit: '9'.repeat(40) });
  assert.equal(verifyManifest(goodManifest(), prior).ok, true, 'a different commit with identical inputs is accepted');
  // Same-run mode does NOT relax it: an artifact from another commit inside one run is a defect.
  refuses('COMMIT_MISMATCH', goodManifest(), goodExpectation({ commit: '9'.repeat(40) }));
  // Everything else still refuses in prior-run mode — the relaxation is exactly one field wide.
  refuses('BUILD_INPUT_FINGERPRINT_MISMATCH', goodManifest(), { ...prior, fingerprint: 'e'.repeat(64) });
  refuses('ARTIFACT_HASH_MISMATCH', goodManifest(), { ...prior, artifactSha256: 'd'.repeat(64) });
  refuses('CONFIGURATION_VALUE_MISMATCH', goodManifest(), {
    ...prior,
    configuration: { ...CONFIG_PRESENT, QANDEEL_API_BASE_URL: digestConfigurationValue('QANDEEL_API_BASE_URL', 'https://other') },
  });
});

// ---------------------------------------------------------------------------------------------
// 12, 13 — platform isolation, and no automatic retry
// ---------------------------------------------------------------------------------------------

test('12 — the two platform chains are independent: neither can rebuild or rerun the other', () => {
  const jobs = jobBlocks(read(PHASE_M));
  const needsOf = (job) => [...jobs.get(job).matchAll(/^\s+needs: (.+)$/gmu)].map((match) => match[1].trim()).join(' ');

  // Android names no iOS job anywhere in its `needs`, and vice versa. A shared dependency would make
  // a failed iOS simulator re-run Gradle, which is the exact cost this task removes.
  assert.equal(needsOf(T13_CHAINS.android.consumer).includes('ios'), false);
  assert.equal(needsOf(T13_CHAINS.ios.consumer).includes('android'), false);
  assert.equal(needsOf(T13_CHAINS.android.producer), '', 'the Android producer waits for nothing');
  assert.equal(needsOf(T13_CHAINS.ios.producer), '', 'the iOS producer waits for nothing');

  // The chains carry separate artifacts, so one platform's retry cannot consume the other's binary.
  assert.notEqual('t13-recovery-android-build', 't13-recovery-ios-build');
  for (const [platform, { producer, consumer }] of Object.entries(T13_CHAINS)) {
    const other = platform === 'android' ? 'ios' : 'android';
    assert.equal(jobs.get(producer).includes(`t13-recovery-${other}-build`), false);
    assert.equal(jobs.get(consumer).includes(`t13-recovery-${other}-build`), false);
  }

  // A failing platform does not suppress the other's evidence: both consumers still upload and gate.
  for (const { consumer } of Object.values(T13_CHAINS)) {
    assert.match(jobs.get(consumer), /gate-t13-recovery-phases\.sh/u, 'the phase gate survives the split');
    assert.match(jobs.get(consumer), /continue-on-error: true/u, 'the sequence step records outcomes, and the GATE decides');
  }
});

test('13 — no automatic retry loop exists in any of the three workflows', () => {
  for (const workflow of [PHASE_M, MOBILE_CI, DEMONSTRATION]) {
    const code = stripYamlComments(read(workflow));
    for (const construct of AUTOMATIC_RETRY_CONSTRUCTS) {
      assert.equal(code.includes(construct), false, `${workflow} must not ${construct}`);
    }
    // Nor a hand-rolled one: a shell loop around an install or a Maestro run is the same thing.
    assert.equal(/(?:while|until|for)\b[^\n]*\n(?:[^\n]*\n){0,6}?[^\n]*maestro test/u.test(code), false,
      `${workflow} must not loop a Maestro run`);
  }
  // Non-vacuity.
  assert.equal(AUTOMATIC_RETRY_CONSTRUCTS.some((construct) => 'uses: nick-fields/retry@v3'.includes(construct)), true);
});

// ---------------------------------------------------------------------------------------------
// Mobile CI — reuse without weakening the gate
// ---------------------------------------------------------------------------------------------

test('Mobile CI reuses a build-compatible binary, and proves it before installing it', () => {
  const jobs = jobBlocks(read(MOBILE_CI));
  for (const [job, platform, artifact] of [
    ['verify-android', 'android', 'app-release.apk'],
    ['verify-ios', 'ios', 'qandeel-ios-simulator.app.zip'],
  ]) {
    const code = stripYamlComments(jobs.get(job));
    // The key IS the provenance: a restore can only ever hand back a binary whose build inputs match.
    assert.match(code, /native-build-fingerprint\.mjs/u, `${job} keys its artifact by build inputs`);
    assert.match(code, /key: qandeel-native-[A-Za-z0-9_-]+-mobile-ci-boot-smoke-v1-\$\{\{ steps\.fingerprint\.outputs\.value \}\}/u,
      `${job}'s cache key is the fingerprint, not the run or the branch`);
    // And the restore is still only a hint: the gate re-derives everything.
    const verify = code.indexOf('verify-native-artifact-manifest.mjs');
    assert.ok(verify >= 0, `${job} verifies provenance`);
    assert.match(code, /--recipe mobile-ci-boot-smoke/u);
    assert.match(code, /--role PRODUCT/u, `${job} builds and validates the Product root, as it always did`);
    assert.match(code, new RegExp(`--platform ${platform}\\b`, 'u'));
    // A restored artifact is honestly declared as prior-run: its commit is expected to differ.
    assert.match(code, /MODE: \$\{\{ steps\.native-build-cache\.outputs\.cache-hit == 'true' && 'prior-run' \|\| 'same-run' \}\}/u);
    for (const install of ['adb install', 'simctl install']) {
      const at = code.indexOf(install);
      if (at >= 0) assert.ok(verify < at, `${job} verifies before ${install}`);
    }
    assert.ok(code.includes(artifact), `${job} installs the artifact it verified`);

    // The gate is NOT weakened: the build still happens on a miss, and it is the same build.
    assert.match(code, /if: steps\.native-build-cache\.outputs\.cache-hit != 'true'/u, `${job} still builds when nothing is reusable`);
  }
  assert.match(stripYamlComments(jobs.get('verify-android')), /\.\/gradlew :app:assembleRelease -PreactNativeArchitectures=x86_64/u);
  assert.match(stripYamlComments(jobs.get('verify-ios')), /xcodebuild .*-configuration Release -sdk iphonesimulator/u);
  assert.match(stripYamlComments(jobs.get('verify-android')), /maestro test apps\/mobile\/\.maestro\/boot-smoke\.yaml/u);
  assert.match(stripYamlComments(jobs.get('verify-ios')), /maestro --device "\$IOS_SIM_UDID" test apps\/mobile\/\.maestro\/boot-smoke\.yaml/u);

  // The native-impact classifier is untouched by this task: deciding WHEN native smoke runs is its
  // job, and reuse must not become a reason to skip a gate the classifier said was needed.
  const classifier = read('scripts/classify-mobile-native-impact.mjs');
  assert.match(classifier, /export const NATIVE_IMPACT_PREFIXES = Object\.freeze\(\['apps\/mobile\/'\]\);/u);
  assert.match(classifier, /export const NATIVE_IMPACT_FILES = Object\.freeze\(\['package-lock\.json', '\.github\/workflows\/mobile-ci\.yml'\]\);/u);
  assert.match(read(MOBILE_CI), /if: needs\.verify-mobile-contracts\.outputs\.native_impact == 'true'/u);
});

// ---------------------------------------------------------------------------------------------
// The demonstration workflow — it proves the pipeline, and it may claim nothing else
// ---------------------------------------------------------------------------------------------

test('the demonstration workflow is a producer/consumer pair that makes no Product claim', () => {
  const text = read(DEMONSTRATION);
  const jobs = jobBlocks(text);
  const CHAINS = {
    android: { producer: 'android-demonstration-build', consumer: 'android-demonstration-validate' },
    ios: { producer: 'ios-demonstration-build', consumer: 'ios-demonstration-validate' },
  };

  for (const [platform, { producer, consumer }] of Object.entries(CHAINS)) {
    const build = stripYamlComments(jobs.get(producer));
    const validate = stripYamlComments(jobs.get(consumer));

    // The producer builds ONCE and ships the binary with its manifest.
    assert.match(build, /native-artifact-manifest\.mjs/u);
    assert.match(build, /--recipe qan-inf-04-demonstration/u);
    assert.match(build, /if-no-files-found: error/u);
    assert.match(build, new RegExp(`name: qan-inf-04-${platform}-build`, 'u'));

    // The consumer builds NOTHING.
    for (const command of NATIVE_BUILD_COMMANDS) {
      assert.equal(validate.includes(command), false, `the ${platform} demonstration consumer must not run ${command}`);
    }
    assert.equal(/\bnpm ci\b/u.test(validate), false, `the ${platform} demonstration consumer installs no dependencies`);

    // Download, then prove, then install and launch — in that order.
    const download = validate.indexOf('uses: actions/download-artifact@v4');
    const verify = validate.indexOf('verify-native-artifact-manifest.mjs');
    assert.ok(download >= 0 && verify > download, `the ${platform} demonstration consumer downloads before it verifies`);
    for (const install of ['adb install', 'simctl install']) {
      const at = validate.indexOf(install);
      if (at >= 0) assert.ok(verify < at, `the ${platform} demonstration consumer verifies before ${install}`);
    }
    assert.match(validate, /maestro (?:--device "\$IOS_SIM_UDID" )?test apps\/mobile\/\.maestro\/boot-smoke\.yaml/u,
      `the ${platform} demonstration consumer launches the artifact it verified`);
    assert.match(validate, new RegExp(`--platform ${platform}\\b`, 'u'));
    assert.match(validate, /--role PRODUCT/u);
    assert.match(jobs.get(consumer), new RegExp(`needs: \\[${producer}\\]`, 'u'));
  }

  // Platform isolation, again, in this workflow.
  assert.equal(jobs.get(CHAINS.android.consumer).includes('ios-demonstration'), false);
  assert.equal(jobs.get(CHAINS.ios.consumer).includes('android-demonstration'), false);

  // IT CAN MAKE NO PRODUCT CLAIM, and the reason is structural rather than declared: it sets no
  // QANDEEL_* configuration anywhere, so the binary embeds a null API origin and null Supabase
  // values; it touches no credential; it never selects the validation entry; and the only flow it
  // runs is the boot smoke, which asserts one integration identifier.
  for (const forbidden of [
    'QANDEEL_API_BASE_URL', 'QANDEEL_SUPABASE_URL', 'QANDEEL_SUPABASE_PUBLIC_KEY',
    'T12_TEST_EMAIL', 'T12_TEST_PASSWORD', 'secrets.',
    'select-validation-entry', 'run-t13-recovery-phases', 'gate-t13-recovery-phases',
    't13_seeded_session_id', 'AUTH_VALIDATION',
  ]) {
    assert.equal(stripYamlComments(text).includes(forbidden), false,
      `the demonstration workflow must not reference ${forbidden}: it proves the pipeline, never a Product or recovery fact`);
  }
  const flows = [...stripYamlComments(text).matchAll(/apps\/mobile\/\.maestro\/([a-z0-9-]+\.yaml)/gu)].map((match) => match[1]);
  assert.deepEqual([...new Set(flows)], ['boot-smoke.yaml'], 'the ONLY flow it runs is the boot smoke');
  // Non-vacuity: the sweep must reject a workflow that reached for a credential.
  assert.equal(['secrets.'].some((f) => 'EMAIL_A: ${{ secrets.T12_TEST_EMAIL_A }}'.includes(f)), true);

  // And the frozen recovery workflow is untouched by it: Phase M still requires the live API and a
  // seeded Session for every claim it makes.
  const phaseM = read(PHASE_M);
  assert.match(phaseM, /t13_seeded_session_id is required for the T-13 recovery sequence/u);
  assert.match(phaseM, /assert-validation-preconditions\.mjs configuration/u);
  assert.equal(phaseM.includes('qan-inf-04-demonstration'), false, 'the demonstration recipe never appears in Phase M');
});

// ---------------------------------------------------------------------------------------------
// Security, evidence and registration
// ---------------------------------------------------------------------------------------------

test('the manifest carries no credential, and the evidence still names the binary that produced it', () => {
  const writer = read('scripts/phase-m/native-artifact-manifest.mjs');
  // Configuration values are digested, never written. The API HOST is recorded in clear on purpose —
  // it is a public dispatch input, and `assert-validation-preconditions.mjs` has already refused any
  // URL carrying userinfo, a query or a fragment — but the values themselves never appear.
  assert.match(writer, /export function digestConfigurationValue/u);
  assert.match(writer, /createHash\('sha256'\)\.update\(`qandeel\.mobile-build-config\/1/u);
  const code = writer.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');
  for (const forbidden of ['T12_TEST_PASSWORD', 'T12_TEST_EMAIL', 'SUPABASE_SECRET', 'sb_secret_']) {
    assert.equal(code.includes(forbidden), false, `the manifest writer must not touch ${forbidden}`);
  }
  // Non-vacuity for that sweep.
  assert.equal(['T12_TEST_PASSWORD'].some((f) => 'env.T12_TEST_PASSWORD_A'.includes(f)), true);

  // The Phase-M evidence must still be able to name its artifact: the human identity record and the
  // machine manifest both travel into the evidence bundle, together with the accepted verdict.
  const jobs = jobBlocks(read(PHASE_M));
  for (const { consumer } of Object.values(T13_CHAINS)) {
    const text = stripYamlComments(jobs.get(consumer));
    assert.match(text, /Carry the artifact provenance into the evidence/u);
    assert.match(text, /for file in [a-z-]+-recovery-validation-identity\.txt native-artifact-manifest\.json; do/u,
      'both the human identity record and the machine manifest reach the evidence');
    assert.match(text, /cp "\$RUNNER_TEMP\/native-build\/\$file" "\$RUNNER_TEMP\/t13-evidence\/\$file"/u);
    assert.match(text, /artifact-provenance-verdict\.txt/u);
    assert.match(text, /collect-validation-evidence\.mjs/u, 'credential redaction is unchanged');
  }
});

test('the gate registers itself and the four owned files exist', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['test:qan-inf-04-native-ci-artifact-reuse-contract'],
    'node --test tests/qan-inf-04-native-ci-artifact-reuse-contract.test.mjs');
  const workflow = read(MOBILE_CI);
  assert.equal((workflow.match(/run: npm run test:qan-inf-04-native-ci-artifact-reuse-contract\b/gu) ?? []).length, 1, 'exactly one gate step');
  assert.equal((workflow.match(/'tests\/qan-inf-04-native-ci-artifact-reuse-contract\.test\.mjs'/gu) ?? []).length, 1, 'exactly one trigger path');
  for (const file of [
    'scripts/phase-m/native-build-fingerprint.mjs',
    'scripts/phase-m/native-artifact-manifest.mjs',
    'scripts/phase-m/verify-native-artifact-manifest.mjs',
    'docs/native-ci-build-validation-decoupling-v1.md',
  ]) {
    assert.ok(read(file).length > 0, `${file} exists`);
  }
  // The three recipes, and only deliberate ones: an artifact built for one purpose can never be
  // installed by a job validating another.
  assert.deepEqual(Object.keys(BUILD_RECIPES).sort(),
    ['mobile-ci-boot-smoke', 'qan-inf-04-demonstration', 't13-recovery-validation']);
  assert.equal(MANIFEST_SCHEMA, 'qandeel.native-artifact-identity/1');
  // A digest of the canonical rule set, recomputed here from the module's own exports, so a silent
  // widening of the exclusions changes this file too rather than passing unnoticed.
  assert.equal(
    createHash('sha256').update([...EXCLUDED_PREFIXES, '|', ...ALWAYS_INCLUDED_PREFIXES].join('\n')).digest('hex').slice(0, 16),
    createHash('sha256').update([
      'docs/', 'infra/', 'apps/api/', 'database/', 'tests/', 'apps/mobile/.maestro/', 'scripts/phase-m/',
      '|', 'apps/mobile/src/integration/__validation__/',
    ].join('\n')).digest('hex').slice(0, 16),
    'the exclusion set is exactly the reasoned one; widening it is a deliberate act, not a drift',
  );
});

test('no Product semantics moved: this task owns infrastructure only', () => {
  // The committed entry is untouched, the Product route set is untouched, and no generated native
  // project appeared. T-13 is CLOSED and this task may not have reinterpreted any of it.
  assert.equal(JSON.parse(read('apps/mobile/package.json')).main, PRODUCT_ENTRY);
  assert.deepEqual(readdirSync(join(rootPath, 'apps/mobile/src/app')).sort(), ['_layout.tsx', 'index.tsx']);
  // The sequencer, the phase gate and the flows are the T-13 authority and stay byte-owned by T-13:
  // this task moved WHERE they run, never WHAT they assert.
  const sequencer = read('scripts/phase-m/run-t13-recovery-phases.sh');
  assert.equal((sequencer.match(/^run_phase (phase-\d\d-[a-z-]+) /gmu) ?? []).length, 13, 'thirteen sequenced phases, unchanged');
  assert.match(read('scripts/phase-m/gate-t13-recovery-phases.sh'), /^EXPECTED_PHASES="/mu);
  assert.equal((read(PHASE_M).match(/bash scripts\/phase-m\/run-t13-recovery-phases\.sh/gu) ?? []).length, 2,
    'one sequencer, both platforms — as T-13 froze it');
});
