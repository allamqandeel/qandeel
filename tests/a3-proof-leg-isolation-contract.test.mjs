// A3-02 — the LEG-isolation contract for the Stage-3 device proof (A3-02 Task Contract §10, §16).
//
// The A3-01 proof was ONE job that built the APK and then ran nine legs one after another: one failed leg made GitHub's
// "Re-run failed jobs" rebuild the APK and rerun every leg that had passed. This contract keeps that shape from coming
// back. It fails if the workflow is collapsed into one sequential all-leg job, if a consumer builds, if a leg loses its
// own job, artifact or provenance check, if fail-fast cancels sibling legs, or if a runner learns to run more than one
// leg — without an equivalent isolation this file would have to be changed on purpose.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

import { BUILD_RECIPES, PROOF_ENTRIES, entryFor } from '../scripts/phase-m/native-artifact-manifest.mjs';
import { verifyManifest } from '../scripts/phase-m/verify-native-artifact-manifest.mjs';
import { parseLegRunner } from '../scripts/validation/proof-legs.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const WORKFLOW = '.github/workflows/a3-proof.yml';
const ANDROID_RUNNER = 'scripts/a3/run-proof-leg.sh';
const IOS_RUNNER = 'scripts/a3/run-ios-proof-leg.sh';

/** A3-01's nine semantic legs, by their stable ids (A3-01 record §18). Their Product meaning is not CI's to change. */
const A301_LEGS = ['ar-standard', 'en-standard', 'ar-rtl-device', 'ar-narrow', 'en-narrow', 'ar-narrow-large', 'ar-increased', 'ar-reduced', 'en-light'];
/** A3-02's platform-delivery legs, one per capability (A3-02 record §17). */
const A302_ANDROID_LEGS = ['android-permission-allow', 'android-permission-deny', 'android-delivery-background', 'android-terminated-entry'];
const A302_IOS_LEGS = ['ios-permission-delivery-entry'];

const BUILD_TOOLS = [/gradlew/u, /assembleRelease/u, /xcodebuild/u, /pod install/u, /expo prebuild|prebuild:android|prebuild:ios/u, /npm ci/u, /npm install/u];

const workflow = () => YAML.parse(read(WORKFLOW));
const stepsText = (job) => (job.steps ?? []).map((step) => [step.run ?? '', step.uses ?? '', JSON.stringify(step.with ?? {})].join('\n')).join('\n');

test('1 — the sequential A3-01 proof shape is gone; one isolated workflow replaces it', () => {
  assert.equal(existsSync(join(root, '.github/workflows/a3-01-inapp-proof.yml')), false, 'the sequential all-leg workflow must not return');
  assert.equal(existsSync(join(root, 'scripts/a301/run-a301-inapp-proof.sh')), false, 'the sequential all-leg runner must not return');
  // VAL-01 RE-ANCHOR: a `plan` job selects the legs a change can affect; it builds and runs nothing.
  assert.deepEqual(Object.keys(workflow().jobs).sort(), ['android-leg', 'build-android', 'build-ios', 'ios-leg', 'plan']);
  for (const tool of BUILD_TOOLS) assert.doesNotMatch(stepsText(workflow().jobs.plan), tool, `plan must not build (${tool})`);
});

test('2 — a BUILD PRODUCER per platform builds the proof binary ONCE and uploads it with its identity', () => {
  const { jobs } = workflow();
  for (const [name, platform, artifact] of [['build-android', 'android', 'a3-proof-android-build'], ['build-ios', 'ios', 'a3-proof-ios-build']]) {
    const text = stepsText(jobs[name]);
    assert.equal(jobs[name].strategy, undefined, `${name} is one job, never a matrix`);
    assert.match(text, platform === 'android' ? /assembleRelease/u : /xcodebuild/u, `${name} builds`);
    assert.match(text, new RegExp(`native-artifact-manifest\\.mjs[\\s\\S]*--platform ${platform} --role PROOF_VALIDATION --recipe a3-activity-push-proof`, 'u'));
    assert.match(text, /select-a301-proof-entry\.mjs --apply/u, `${name} selects the proof root`);
    const upload = jobs[name].steps.find((step) => String(step.uses ?? '').startsWith('actions/upload-artifact'));
    assert.equal(upload?.with?.name, artifact);
    assert.doesNotMatch(text, /run-proof-leg|run-ios-proof-leg|maestro test/u, `${name} runs no leg`);
  }
});

test('3 — every leg is its OWN matrix job: stable ids, fail-fast off, needs only its producer', () => {
  const { jobs } = workflow();
  for (const [name, producer, platform, runner, legs] of [
    ['android-leg', 'build-android', 'android', ANDROID_RUNNER, [...A301_LEGS, ...A302_ANDROID_LEGS]],
    ['ios-leg', 'build-ios', 'ios', IOS_RUNNER, A302_IOS_LEGS],
  ]) {
    const job = jobs[name];
    // VAL-01 RE-ANCHOR: the matrix is the set `plan` selected for this change (scripts/validation/proof-legs.mjs), drawn
    // from the runner's own leg list — so the full, stable set is pinned at the runner, and a run holds a subset of it.
    assert.deepEqual(job.needs, ['plan', producer], `${name} needs its producer and the leg selection, nothing else`);
    assert.equal(job.strategy?.['fail-fast'], false, `${name}: a failed leg never cancels a sibling`);
    assert.equal(job.strategy?.matrix?.leg, `\${{ fromJSON(needs.plan.outputs.${platform}_legs) }}`, `${name}: the selected legs`);
    assert.deepEqual(parseLegRunner(read(runner)).legs, legs, `${name}: the stable leg ids, in order, as the runner accepts them`);
    assert.equal(Object.keys(job.strategy.matrix).length, 1, `${name}: one dimension — the leg — so a leg is never multiplied by another axis`);
    assert.match(job.name, /\$\{\{ matrix\.leg \}\}/u, `${name}: each job result is named by its leg`);
  }
  // The A3-01 legs keep their meaning: they are all still runner legs, none renamed.
  for (const leg of A301_LEGS) assert.ok(parseLegRunner(read(ANDROID_RUNNER)).legs.includes(leg), leg);
});

test('4 — a LEG CONSUMER builds nothing, verifies provenance BEFORE install, runs exactly ONE leg, uploads its own evidence', () => {
  const { jobs } = workflow();
  for (const [name, platform, runner] of [['android-leg', 'android', ANDROID_RUNNER], ['ios-leg', 'ios', IOS_RUNNER]]) {
    const job = jobs[name];
    const text = stepsText(job);
    for (const tool of BUILD_TOOLS) assert.doesNotMatch(text, tool, `${name} must not build (${tool})`);
    const steps = job.steps.map((step) => [step.run ?? '', step.uses ?? '', JSON.stringify(step.with ?? {})].join('\n'));
    const download = steps.findIndex((s) => s.includes('actions/download-artifact'));
    const verify = steps.findIndex((s) => s.includes('verify-native-artifact-manifest.mjs'));
    const run = steps.findIndex((s) => s.includes(runner));
    assert.ok(download >= 0 && verify > download && run > verify, `${name}: download → verify provenance → run`);
    // VAL-01 RE-ANCHOR: the mode is the one the PRODUCER declared — `prior-run` for a binary it restored by build-input
    // fingerprint, `same-run` for one it built — and a lost output resolves to the stricter `same-run`.
    assert.match(steps[verify], new RegExp(`--mode "\\$MODE" --platform ${platform} --role PROOF_VALIDATION`, 'u'));
    const producer = name === 'android-leg' ? 'build-android' : 'build-ios';
    assert.equal(job.steps[verify].env?.MODE, `\${{ needs.${producer}.outputs.provenance_mode == 'prior-run' && 'prior-run' || 'same-run' }}`);
    assert.match(steps[verify], /--recipe a3-activity-push-proof/u);
    assert.match(steps[verify], /set -o pipefail/u, `${name}: a refused provenance fails the job`);
    assert.equal(steps.filter((s) => s.includes(runner)).length, 1, `${name}: the runner is called once`);
    const runStep = job.steps[run];
    assert.match(JSON.stringify(runStep.env ?? {}), /\$\{\{ matrix\.leg \}\}/u, `${name}: the runner is given THIS job's leg`);
    assert.doesNotMatch(steps[run], /\bfor\b|\bwhile\b/u, `${name}: no loop over legs`);
    const upload = job.steps.find((step) => String(step.uses ?? '').startsWith('actions/upload-artifact'));
    assert.match(upload.with.name, /\$\{\{ matrix\.leg \}\}/u, `${name}: each leg uploads its own evidence`);
    assert.equal(upload.if, 'always()', `${name}: a failed leg still uploads its evidence`);
  }
});

test('5 — the runners run exactly ONE leg, refuse anything else, and keep the cold-start readiness gate', () => {
  for (const [runner, legs] of [[ANDROID_RUNNER, [...A301_LEGS, ...A302_ANDROID_LEGS]], [IOS_RUNNER, A302_IOS_LEGS]]) {
    const text = read(runner);
    assert.match(text, /exactly ONE leg/u);
    assert.match(text, /if \[ "\$#" -ne [34] \]/u, `${runner} takes exactly one leg argument`);
    assert.match(text, /unknown leg '\$LEG' — refusing/u);
    for (const leg of legs) assert.ok(text.includes(leg), `${runner} knows ${leg}`);
    assert.doesNotMatch(text, /for leg in|for LEG in|\$LEGS|results\.txt/u, `${runner} never loops over legs or shares a result file`);
    for (const tool of BUILD_TOOLS) assert.doesNotMatch(text, tool, `${runner} never builds (${tool})`);
  }
  const android = read(ANDROID_RUNNER);
  assert.match(android, /sys\.boot_completed/u, 'readiness waits on a real boot condition');
  assert.match(android, /a3-01-readiness\.yaml/u, 'readiness walks the cold paths before the leg (A3-01 G-32)');
  assert.match(android, /READINESS: not ready after 3 attempts; the leg was not run/u);
});

test('6 — the proof artifact is its own recipe and role: never installable as a Product or another proof', () => {
  assert.equal(BUILD_RECIPES['a3-activity-push-proof'], 1);
  assert.equal(PROOF_ENTRIES['a3-activity-push-proof'], 'src/integration/__validation__/a301-proof-entry.tsx');
  assert.equal(entryFor('PROOF_VALIDATION', 'mobile-ci-boot-smoke'), null, 'a recipe without a proof root has no proof entry');
  const manifest = {
    schema: 'qandeel.native-artifact-identity/1', buildRecipe: { id: 'a3-activity-push-proof', version: 1 }, commit: 'a'.repeat(40),
    platform: 'android', role: 'PROOF_VALIDATION', entry: PROOF_ENTRIES['a3-activity-push-proof'],
    artifact: { name: 'app-release.apk', bytes: 1, sha256: 'b'.repeat(64) },
    buildInputFingerprint: { domain: 'x', schemaVersion: 1, value: 'f' }, target: { kind: 'android-device', abis: ['x86_64'] },
    toolchain: { node: 'v22' }, configuration: {},
  };
  const asProduct = verifyManifest(manifest, { platform: 'android', role: 'PRODUCT', recipe: 'a3-activity-push-proof', abis: ['x86_64'], mode: 'same-run', configuration: {} });
  assert.ok(asProduct.refusals.some((r) => r.startsWith('ROLE_MISMATCH')), 'a proof binary is refused by a Product consumer');
  const forged = verifyManifest({ ...manifest, entry: 'expo-router/entry' }, { platform: 'android', role: 'PROOF_VALIDATION', recipe: 'a3-activity-push-proof', abis: ['x86_64'], mode: 'same-run', configuration: {} });
  assert.ok(forged.refusals.some((r) => r.startsWith('ENTRY_ROLE_DISAGREEMENT')), 'a proof manifest naming the Product root is refused');
});

test('7 — the gate is wired', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['test:a3-proof-leg-isolation-contract'], 'node --test tests/a3-proof-leg-isolation-contract.test.mjs');
  assert.match(read('.github/workflows/mobile-ci.yml'), /run: npm run test:a3-proof-leg-isolation-contract\b/u);
});
