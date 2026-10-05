// VAL-01 — Change-Aware Validation + Cross-Run Native Artifact Reuse. Static, deterministic contract.
//
// > QUALITY COMPLETE, VALIDATION PROPORTIONAL TO CHANGE.
//
// A3-02 measured the cost of validation that is not change-aware: a record-only head re-ran ~30 minutes of API and
// Mobile gates, a two-flow head rebuilt both proof binaries and re-ran thirteen unaffected Android legs, and an iOS
// leg idled for its full 60-minute job limit. This contract pins the fixes AND the one direction they may never
// trade away: a gate is skipped only when skipping is positively proven safe. Every claim below is driven through
// the real planner, the real fingerprint, the real verifier and the real workflows, and every absence predicate is
// paired with a planted defect it must reject. No device, no network, no GitHub run.
//
// Numbered tests 1–15 are the Task Contract §15 list, in order.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

import {
  CONTENT_ROOTS,
  DOMAINS,
  EVIDENCE_JOB_NAME,
  EVIDENCE_SCHEMA,
  GATES,
  analyzeLightPaths,
  classifyPath,
  domainsOf,
  evidenceArtifactName,
  isRootContract,
  isValidationTooling,
  planGate,
  selectPredecessorRun,
  stripFullLineComments,
  validateEvidence,
  workflowContracts,
} from '../scripts/validation/change-planner.mjs';
import { DISPOSITIONS, assertSimulatorMatrix, buildPlatformGraph, parseLegRunner, selectPlatformLegs } from '../scripts/validation/proof-legs.mjs';
import { PROOF_SUITES } from '../scripts/validation/proof-suites.mjs';
import { MAX_ATTEMPTS, EXHAUSTED, retryVerdict } from '../scripts/validation/retry-budget.mjs';
import { TIMEOUT_EXIT_CODE, parseArgs } from '../scripts/validation/bounded-run.mjs';
import { gateOutcome } from '../scripts/validation/plan-validation.mjs';
import {
  FINGERPRINT_DOMAIN,
  FINGERPRINT_SCHEMA_VERSION,
  classifyBuildInput,
  computeFingerprint,
  readTreeEntries,
} from '../scripts/phase-m/native-build-fingerprint.mjs';
import { BUILD_RECIPES, MANIFEST_SCHEMA, PROOF_ENTRIES, digestConfigurationValue, CONFIGURATION_KEYS } from '../scripts/phase-m/native-artifact-manifest.mjs';
import { verifyManifest } from '../scripts/phase-m/verify-native-artifact-manifest.mjs';
import { NATIVE_CONSUMER_FLOWS, classifyChangedFiles } from '../scripts/classify-mobile-native-impact.mjs';
import { createHarnessMirror, removeHarnessMirror } from './harness-temp-dir.mjs';

const rootPath = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(rootPath, path), 'utf8').replace(/\r\n/gu, '\n');
const readOrNull = (path) => (existsSync(join(rootPath, path)) ? read(path) : null);
const workflow = (file) => YAML.parse(read(file));

const API_CI = '.github/workflows/api-ci.yml';
const MOBILE_CI = '.github/workflows/mobile-ci.yml';
const A3 = '.github/workflows/a3-proof.yml';
const A3_RECORD = 'docs/e2e/QANDEEL_A3_02_NATIVE_PUSH_PLATFORM_DELIVERY_IMPLEMENTATION_RECORD_v1.md';

// ------------------------------------------------------------------------------------------------
// The real repository, as the planner sees it
// ------------------------------------------------------------------------------------------------

/**
 * Tracked paths with a stable per-path content id. `tests/forward-safety-contract.test.mjs` runs every contract in a
 * mirror with no `.git`, so — exactly as QAN-INF-04 does — the fallback walks the tree. Every claim is comparative or
 * about a path's classification, so any stable id serves; the production tooling has no such fallback.
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
const trackedPaths = treeEntries.map((entry) => entry.path);
const baseline = computeFingerprint(treeEntries);
const fingerprintWithChange = (path) => {
  assert.ok(trackedPaths.includes(path), `${path} is tracked, so this is a real change`);
  return computeFingerprint(treeEntries.map((entry) => (entry.path === path ? { ...entry, oid: 'f'.repeat(40) } : entry))).value;
};

const TEXT = /\.(?:[cm]?js|jsx|ts|tsx|json|ya?ml|sh|sql|toml|txt|html|css|xml|gradle|properties|plist|swift|kt|java|rb)$/u;
const sources = new Map();
for (const path of trackedPaths) {
  if (!TEXT.test(path) && !/(?:^|\/)[^./]+$/u.test(path)) continue;
  const text = readOrNull(path);
  if (text !== null && !text.includes('\0') && text.length < 4 * 1024 * 1024) sources.set(path, text);
}
const scripts = JSON.parse(read('package.json')).scripts;
const apiSuite = workflowContracts(read(API_CI), scripts);
const mobileSuite = workflowContracts(read(MOBILE_CI), scripts);
const graphs = Object.fromEntries(Object.entries(PROOF_SUITES.a3.platforms)
  .map(([platform, config]) => [platform, buildPlatformGraph({ runner: config.runner, readFile: readOrNull })]));
const allLegs = (platform) => graphs[platform].legs.map((leg) => leg.id);

const PRED = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const PR_UPDATE = Object.freeze({ event: 'pull_request', action: 'synchronize', predecessorSha: PRED });
const GREEN = Object.freeze({ ok: true, refusals: [] });

/** Plans every gate for a delta exactly as the planner CLI does, with a chosen evidence verdict. */
function planAll(delta, { evidence = GREEN, context = PR_UPDATE } = {}) {
  const light = (delta ?? []).filter((path) => ['DOC', 'FLOW', 'PROOF_RUNNER'].includes(classifyPath(path).kind));
  const analysis = analyzeLightPaths({ lightPaths: light, sources });
  const nativeConsumerFlows = [...NATIVE_CONSUMER_FLOWS];
  return {
    analysis,
    [DOMAINS.API_HEAVY]: planGate({ gate: DOMAINS.API_HEAVY, context, delta, analysis, suite: apiSuite, evidence }),
    [DOMAINS.MOBILE_CONTRACT]: planGate({ gate: DOMAINS.MOBILE_CONTRACT, context, delta, analysis, suite: mobileSuite, evidence }),
    [DOMAINS.MOBILE_NATIVE_BINARY]: planGate({ gate: DOMAINS.MOBILE_NATIVE_BINARY, context, delta, analysis, nativeConsumerFlows, evidence }),
  };
}
const legsFor = (delta) => Object.fromEntries(Object.entries(graphs).map(([p, graph]) => [p, selectPlatformLegs({ graph, delta }).legs]));

/** A predecessor evidence record that validates, so each refusal below breaks exactly one thing. */
const goodRecord = (overrides = {}) => ({
  schema: EVIDENCE_SCHEMA, workflow: 'api-ci', gate: 'API_HEAVY', outcome: 'SUCCESS', disposition: 'EXECUTED',
  headSha: PRED, baseSha: BASE, authorityDigest: 'd'.repeat(64), runId: '101', runAttempt: 1,
  sourceRunId: '101', sourceHeadSha: PRED, recordedAt: '2026-10-05T00:00:00.000Z', ...overrides,
});
const goodExpectation = (overrides = {}) => ({
  workflow: 'api-ci', gate: 'API_HEAVY', predecessorSha: PRED, baseSha: BASE, authorityDigest: 'd'.repeat(64),
  runId: 101, latestAttempt: 1, evidenceJobConclusion: 'success', ...overrides,
});

test('the baseline evidence verifies — without it every refusal below would be vacuous', () => {
  assert.deepEqual(validateEvidence(goodRecord(), goodExpectation()), { ok: true, refusals: [] });
});

// ------------------------------------------------------------------------------------------------
// 1, 2 — docs-only carry-forward, and its refusal
// ------------------------------------------------------------------------------------------------

test('1 — a docs-only delta after a PROVEN green predecessor carries the heavy API and Mobile gates forward', () => {
  const plan = planAll([A3_RECORD]);
  for (const gate of GATES) assert.equal(plan[gate].decision, 'CARRY_FORWARD', `${gate}: ${plan[gate].reason}`);

  // Carried, not ignored: the root contracts that can read that record — here, the ones that enumerate the whole
  // docs tree or filter on `.md` — re-run at this head, and only contracts of the workflow that owns them.
  assert.ok(plan.API_HEAVY.contracts.includes('tests/task-closure-governance-contract.test.mjs'), 'the governance gate reads every record');
  for (const contract of plan.API_HEAVY.contracts) assert.ok(apiSuite.includes(contract), `${contract} belongs to API CI`);
  // A doc a contract names LITERALLY binds that contract (non-vacuity of the literal token).
  const design = 'docs/native-ci-build-validation-decoupling-v1.md';
  assert.ok(read('tests/qan-inf-04-native-ci-artifact-reuse-contract.test.mjs').includes(design));
  const designPlan = planAll([design]);
  assert.equal(designPlan.MOBILE_CONTRACT.decision, 'CARRY_FORWARD');
  assert.ok(designPlan.MOBILE_CONTRACT.contracts.includes('tests/qan-inf-04-native-ci-artifact-reuse-contract.test.mjs'));
  for (const contract of plan.MOBILE_CONTRACT.contracts) assert.ok(mobileSuite.includes(contract), `${contract} belongs to Mobile CI`);
  assert.deepEqual(plan.MOBILE_NATIVE_BINARY.contracts, [], 'prose cannot reach a binary or a boot smoke');
  // The forward-safety sweep EXECUTES every contract in a mirror, so a bound contract binds it too.
  assert.ok(plan.API_HEAVY.contracts.includes('tests/forward-safety-contract.test.mjs'));
});

test('1b — a doc that a NON-contract file reads is not "docs-only": it fails safe to the heavy gate', () => {
  // The database static tests read the canonical backlog; the mobile generators read the canonical design artifacts.
  for (const doc of ['docs/qandeel-canonical-backlog-v1.md', 'docs/replay-runtime-v1.md']) {
    const plan = planAll([doc]);
    assert.equal(plan.API_HEAVY.decision, 'RUN', `${doc}: ${plan.API_HEAVY.reason}`);
    assert.match(plan.API_HEAVY.reason, /A_NON_CONTRACT_FILE_READS_A_CHANGED_PATH/u);
  }
  const artifact = trackedPaths.find((p) => p.startsWith('docs/design/canonical-artifacts/living-analysis/'));
  assert.ok(artifact, 'a canonical design artifact is tracked');
  assert.equal(planAll([artifact]).MOBILE_CONTRACT.decision, 'RUN', 'a generator input is never carried');

  // A non-contract file that names the WHOLE docs tree is how a future reader of every doc would look. Each one is
  // reviewed (they build a mirror and read named docs only, which the basename token already binds); a new one
  // fails here until it is classified.
  const reviewed = [
    'database/tests/replay-authorized-draft-runtime-v1.test.mjs',
    'database/tests/replay-distribution-export-public-bridge-v1.test.mjs',
    'database/tests/replay-distribution-reconciliation-closure-v1.test.mjs',
    'database/tests/replay-preview-finalization-runtime-v1.test.mjs',
  ];
  const wholeDocs = new RegExp(`(?:^|['"\`/(\\s])${CONTENT_ROOTS[0]}/?['"\`]`, 'u');
  const found = [...sources]
    .filter(([path]) => /\.(?:[cm]?js|jsx|ts|tsx|json|ya?ml|sh|sql)$/u.test(path))
    .filter(([path]) => classifyPath(path).kind !== 'DOC' && !isRootContract(path) && !isValidationTooling(path))
    .filter(([path, text]) => wholeDocs.test(stripFullLineComments(path, text)))
    .map(([path]) => path).sort();
  assert.deepEqual(found, reviewed, 'every non-contract file naming the whole docs tree is reviewed');
});

test('2 — a docs-only delta with a red, missing or unknown predecessor RUNS every heavy gate', () => {
  const refusals = [
    validateEvidence(null, goodExpectation()),
    validateEvidence(goodRecord({ outcome: 'FAILURE' }), goodExpectation()),
    validateEvidence(goodRecord(), goodExpectation({ evidenceJobConclusion: 'failure' })),
    validateEvidence(goodRecord(), goodExpectation({ evidenceJobConclusion: null })),
    { ok: false, refusals: ['PREDECESSOR_RUN_NOT_COMPLETE'] },
  ];
  for (const verdict of refusals) {
    assert.equal(verdict.ok, false);
    const plan = planAll([A3_RECORD], { evidence: verdict });
    for (const gate of GATES) {
      assert.equal(plan[gate].decision, 'RUN', `${gate} with ${verdict.refusals[0]}`);
      assert.equal(plan[gate].reason, 'PREDECESSOR_NOT_PROVEN_GREEN');
    }
  }
  // And an evidence argument that was never evaluated is not proof either.
  assert.equal(planGate({ gate: 'API_HEAVY', context: PR_UPDATE, delta: [A3_RECORD], analysis: { contracts: [], heavyBinders: [] } }).decision, 'RUN');
});

// ------------------------------------------------------------------------------------------------
// 3, 4 — a Maestro flow is a validation change, never a rebuild, and it runs only its legs
// ------------------------------------------------------------------------------------------------

test('3 — a Maestro-flow-only, runner-only or record-only change leaves the native fingerprint unchanged', () => {
  const flows = trackedPaths.filter((p) => p.startsWith('apps/mobile/.maestro/'));
  assert.ok(flows.length > 10, 'the flows are tracked');
  for (const path of [...flows, 'scripts/a3/run-proof-leg.sh', 'scripts/a3/run-ios-proof-leg.sh', A3_RECORD]) {
    assert.equal(fingerprintWithChange(path), baseline.value, `${path} must not move the fingerprint`);
  }
  // The planner and the fingerprint agree in the safe direction, over the WHOLE tree: every path the planner calls
  // a flow or a runner is excluded from the fingerprint, and every fingerprint input is native-relevant to the planner.
  for (const path of trackedPaths) {
    const { kind } = classifyPath(path);
    if (kind === 'FLOW' || kind === 'PROOF_RUNNER' || kind === 'DOC') {
      assert.equal(classifyBuildInput(path).included, false, `${path} (${kind}) must not be a build input`);
    }
    if (classifyBuildInput(path).included) {
      assert.ok(domainsOf(path).includes(DOMAINS.MOBILE_NATIVE_BINARY), `${path} is a build input, so the planner must treat it as native`);
    }
  }
  // Non-vacuity: a planted rule that called a Product source a flow would be rejected by the same sweep.
  assert.equal(classifyBuildInput('apps/mobile/src/app/index.tsx').included, true);
});

test('4 — one changed flow selects only the leg(s) that run it; a shared or runner change fans out', () => {
  // The A3-02 heads, replayed. 61f4515 changed only a3-02-open-notifications.yaml and ran all 14 legs.
  assert.deepEqual(legsFor(['apps/mobile/.maestro/a3-02-open-notifications.yaml']), {
    android: ['android-permission-allow', 'android-permission-deny'],
    ios: ['ios-permission-delivery-entry'],
  });
  // a7b0386 changed two iOS flows and rebuilt + re-ran all 13 Android legs.
  assert.deepEqual(legsFor(['apps/mobile/.maestro/a3-02-ios-permission.yaml', 'apps/mobile/.maestro/a3-02-ios-tap.yaml', A3_RECORD]), {
    android: [],
    ios: ['ios-permission-delivery-entry'],
  });
  assert.deepEqual(legsFor(['apps/mobile/.maestro/a3-01-light.yaml']), { android: ['en-light'], ios: [] });
  assert.deepEqual(legsFor(['apps/mobile/.maestro/a3-02-tap.yaml']).android, ['android-delivery-background', 'android-terminated-entry']);
  // Shared readiness and the runner itself legitimately fan out — to that platform only.
  assert.deepEqual(legsFor(['apps/mobile/.maestro/a3-01-readiness.yaml']), { android: allLegs('android'), ios: [] });
  assert.deepEqual(legsFor(['scripts/a3/run-proof-leg.sh']), { android: allLegs('android'), ios: [] });
  assert.deepEqual(legsFor(['scripts/a3/run-ios-proof-leg.sh']), { android: [], ios: allLegs('ios') });
  // Prose, the API and root contracts are not proof inputs.
  assert.deepEqual(legsFor([A3_RECORD, 'apps/api/src/push/push.module.ts', 'tests/a3-proof-leg-isolation-contract.test.mjs']), { android: [], ios: [] });

  // The flow change never reaches the heavy API or native gates; Mobile carries forward with the flow-reading
  // contracts (QAN-INF-04's flow-parse gate among them) re-run at this head.
  const plan = planAll(['apps/mobile/.maestro/a3-02-open-notifications.yaml']);
  assert.equal(plan.API_HEAVY.decision, 'CARRY_FORWARD');
  assert.equal(plan.MOBILE_NATIVE_BINARY.decision, 'CARRY_FORWARD');
  assert.equal(plan.MOBILE_CONTRACT.decision, 'CARRY_FORWARD');
  assert.ok(plan.MOBILE_CONTRACT.contracts.includes('tests/qan-inf-04-native-ci-artifact-reuse-contract.test.mjs'));
  // But the ONE flow Mobile CI's own device consumers run is native-relevant to Mobile CI.
  assert.equal(planAll(['apps/mobile/.maestro/boot-smoke.yaml']).MOBILE_NATIVE_BINARY.decision, 'RUN');

  // The leg graph is DERIVED from the runner, so the mapping cannot drift: the derived legs are exactly the runner's.
  for (const [platform, config] of Object.entries(PROOF_SUITES.a3.platforms)) {
    const parsed = parseLegRunner(read(config.runner));
    assert.deepEqual(allLegs(platform), parsed.legs);
    assert.ok(parsed.legs.every((leg) => read(config.runner).includes(leg)));
  }
  assert.equal(allLegs('android').length, 13);
  assert.equal(allLegs('ios').length, 1);
  // Non-vacuity: a planted dispatch branch is picked up as a leg with its own flow.
  const planted = parseLegRunner('case "$LEG" in\n  x-leg) maestro_flow planted.yaml leg ;;\nesac\n');
  assert.deepEqual(planted, { legs: ['x-leg'], legFlows: { 'x-leg': ['planted.yaml'] }, sharedFlows: [] });
});

// ------------------------------------------------------------------------------------------------
// 5, 6, 7 — Product and build inputs still invalidate
// ------------------------------------------------------------------------------------------------

test('5 — mobile Product source moves the fingerprint and runs the Mobile gates and every leg', () => {
  for (const path of ['apps/mobile/src/integration/composition/ProductRoot.tsx', 'apps/mobile/src/app/index.tsx']) {
    assert.notEqual(fingerprintWithChange(path), baseline.value, path);
    const plan = planAll([path]);
    assert.equal(plan.MOBILE_CONTRACT.decision, 'RUN');
    assert.equal(plan.MOBILE_NATIVE_BINARY.decision, 'RUN');
    assert.equal(plan.API_HEAVY.decision, 'CARRY_FORWARD', 'mobile source alone does not reach the API gate');
    assert.deepEqual(legsFor([path]), { android: allLegs('android'), ios: allLegs('ios') });
  }
});

test('6 — the bundled __validation__ harness moves the fingerprint, whatever an exclusion rule says', () => {
  const harness = trackedPaths.filter((p) => p.startsWith('apps/mobile/src/integration/__validation__/'));
  assert.ok(harness.includes(`apps/mobile/${PROOF_ENTRIES['a3-activity-push-proof']}`), 'the A3 proof root is tracked');
  for (const path of harness) {
    assert.notEqual(fingerprintWithChange(path), baseline.value, `${path} is bundled`);
    assert.equal(planAll([path]).MOBILE_NATIVE_BINARY.decision, 'RUN');
  }
  // The A3 runners read the server-rendered payloads from the harness, so it fans out to every leg as a build input.
  assert.deepEqual(legsFor(['apps/mobile/src/integration/__validation__/a302-platform-payloads.json']).android, allLegs('android'));
});

test('7 — the lockfile and native configuration move the fingerprint and run every gate they reach', () => {
  for (const path of ['package-lock.json', 'apps/mobile/app.config.js', 'apps/mobile/package.json']) {
    assert.notEqual(fingerprintWithChange(path), baseline.value, path);
    const plan = planAll([path]);
    assert.equal(plan.MOBILE_NATIVE_BINARY.decision, 'RUN', path);
    assert.equal(plan.MOBILE_CONTRACT.decision, 'RUN', path);
  }
  assert.equal(planAll(['package-lock.json']).API_HEAVY.decision, 'RUN', 'the lockfile is a shared root input');
  // API / database changes still force the API gate.
  for (const path of ['apps/api/src/main.ts', 'database/migrations/0137_push_platform_delivery_v1.sql', 'database/verify-migration-0137.mjs']) {
    assert.equal(planAll([path]).API_HEAVY.decision, 'RUN', path);
  }
});

// ------------------------------------------------------------------------------------------------
// 8, 9 — authority changes and unknowns fail safe
// ------------------------------------------------------------------------------------------------

test('8 — a provenance, fingerprint, classifier, planner or workflow change runs EVERY gate and every leg', () => {
  for (const path of [
    'scripts/phase-m/native-build-fingerprint.mjs', 'scripts/phase-m/native-artifact-manifest.mjs',
    'scripts/phase-m/verify-native-artifact-manifest.mjs', 'scripts/classify-mobile-native-impact.mjs',
    'scripts/validation/change-planner.mjs', API_CI, MOBILE_CI, A3,
  ]) {
    assert.equal(classifyPath(path).kind, 'INFRA', path);
    const plan = planAll([path]);
    for (const gate of GATES) assert.equal(plan[gate].decision, 'RUN', `${gate} after ${path}`);
    assert.deepEqual(legsFor([path]), { android: allLegs('android'), ios: allLegs('ios') }, path);
  }
  // A workflow file is also a fingerprint input on purpose: it IS the build recipe.
  assert.notEqual(fingerprintWithChange(A3), baseline.value);
  // And the authority digest the evidence carries refuses a predecessor validated under different rules.
  assert.match(validateEvidence(goodRecord(), goodExpectation({ authorityDigest: 'e'.repeat(64) })).refusals.join(), /AUTHORITY_CHANGED/u);
});

test('9 — an unknown or unestablished delta fails safe: never skip', () => {
  for (const path of ['infra/deploy.yml', 'eslint.config.js', '.nvmrc', 'scripts/preflight.mjs', 'something/new.txt']) {
    assert.equal(classifyPath(path).kind, 'UNKNOWN', path);
    const plan = planAll([path]);
    for (const gate of GATES) assert.equal(plan[gate].decision, 'RUN', `${gate} after ${path}`);
    assert.deepEqual(legsFor([path]).android, allLegs('android'));
  }
  for (const delta of [null, undefined, [], ['', '  ']]) {
    for (const gate of GATES) assert.equal(planGate({ gate, context: PR_UPDATE, delta, evidence: GREEN }).decision, 'RUN');
    assert.deepEqual(legsFor(delta).android, allLegs('android'), 'an unestablished delta selects every leg');
  }
  for (const predecessorSha of [undefined, '', '0'.repeat(39), 'HEAD']) {
    assert.equal(planGate({ gate: 'API_HEAVY', context: { ...PR_UPDATE, predecessorSha }, delta: [A3_RECORD], evidence: GREEN }).decision, 'RUN');
  }
  // The cumulative native relevance keeps its own fail-safe.
  assert.equal(classifyChangedFiles(null).nativeImpact, true);
});

// ------------------------------------------------------------------------------------------------
// 10, 11 — cross-run reuse is the EXISTING provenance model, and a hit builds nothing
// ------------------------------------------------------------------------------------------------

test('10 — a restored prior-run artifact is refused on any role, recipe, platform, target or fingerprint mismatch', () => {
  const unconfigured = Object.fromEntries(CONFIGURATION_KEYS.map((key) => [key, digestConfigurationValue(key, undefined)]));
  const manifest = (overrides = {}) => ({
    schema: MANIFEST_SCHEMA, buildRecipe: { id: 'a3-activity-push-proof', version: BUILD_RECIPES['a3-activity-push-proof'] },
    commit: '1'.repeat(40), platform: 'android', role: 'PROOF_VALIDATION', entry: PROOF_ENTRIES['a3-activity-push-proof'],
    artifact: { name: 'app-release.apk', bytes: 10, sha256: '2'.repeat(64) },
    buildInputFingerprint: { domain: FINGERPRINT_DOMAIN, schemaVersion: FINGERPRINT_SCHEMA_VERSION, value: '3'.repeat(64) },
    target: { kind: 'android-device', abis: ['x86_64'] }, toolchain: { node: 'v22' }, configuration: { ...unconfigured, apiBaseUrlHost: null },
    ...overrides,
  });
  const expectation = (overrides = {}) => ({
    platform: 'android', role: 'PROOF_VALIDATION', recipe: 'a3-activity-push-proof', abis: ['x86_64'], mode: 'prior-run',
    commit: '9'.repeat(40), artifactSha256: '2'.repeat(64), artifactBytes: 10, fingerprint: '3'.repeat(64), configuration: unconfigured, ...overrides,
  });
  assert.equal(verifyManifest(manifest(), expectation()).ok, true, 'an equivalent prior-run binary from another commit is accepted');
  const refused = (code, m, e = expectation()) => {
    const verdict = verifyManifest(m, e);
    assert.equal(verdict.ok, false, code);
    assert.ok(verdict.refusals.some((r) => r.startsWith(`${code}:`)), `${code}: ${verdict.refusals.join(' | ')}`);
  };
  refused('ROLE_MISMATCH', manifest({ role: 'PRODUCT', entry: 'expo-router/entry' }));
  refused('RECIPE_MISMATCH', manifest({ buildRecipe: { id: 'mobile-ci-boot-smoke', version: 1 } }));
  refused('RECIPE_VERSION_MISMATCH', manifest({ buildRecipe: { id: 'a3-activity-push-proof', version: 99 } }));
  refused('PLATFORM_MISMATCH', manifest({ platform: 'ios' }));
  refused('TARGET_ABI_MISMATCH', manifest({ target: { kind: 'android-device', abis: ['arm64-v8a'] } }));
  refused('BUILD_INPUT_FINGERPRINT_MISMATCH', manifest(), expectation({ fingerprint: '4'.repeat(64) }));
  refused('ARTIFACT_HASH_MISMATCH', manifest(), expectation({ artifactSha256: '5'.repeat(64) }));
  refused('TARGET_SIMULATOR_MISMATCH', manifest({ platform: 'ios', target: { kind: 'ios-simulator', sdk: 'iphonesimulator', simulatorName: 'iPhone 17', simulatorRuntime: 'iOS-26-5' } }),
    expectation({ platform: 'ios', abis: [], simulatorName: 'iPhone 17', simulatorRuntime: 'iOS-27-0' }));
  // VAL-01 changed the fingerprint RULES (scripts/a3/ is runner-only), so the schema moved: a binary fingerprinted under
  // the old rules can never compare equal to one under the new, and every older cache entry fails closed.
  assert.equal(FINGERPRINT_SCHEMA_VERSION, 2);
  refused('FINGERPRINT_SCHEMA_MISMATCH', manifest({ buildInputFingerprint: { domain: FINGERPRINT_DOMAIN, schemaVersion: 1, value: '3'.repeat(64) } }));
});

/** Commands that BUILD. A step carrying one runs only on a cache miss. */
const BUILD_STEP = /\bnpm ci\b|prebuild|gradlew|assembleRelease|pod install|xcodebuild -quiet|generate-[a-z0-9-]+\.mjs --check|select-a301-proof-entry/u;
const stepText = (step) => [step.run ?? '', step.uses ?? '', JSON.stringify(step.with ?? {})].join('\n');

/** The producer law, as a predicate over one parsed producer job — so it can be planted against. */
function producerViolations(job) {
  const violations = [];
  const steps = job.steps ?? [];
  const cache = steps.find((step) => String(step.uses ?? '').startsWith('actions/cache@'));
  if (!cache) return ['no build-input cache'];
  if (!/native-build-fingerprint|steps\.fingerprint\.outputs\.value/u.test(cache.with?.key ?? '')) violations.push('cache key is not the fingerprint');
  for (const step of steps) {
    if (BUILD_STEP.test(stepText(step)) && step.if !== "steps.native-build-cache.outputs.cache-hit != 'true'") violations.push(`builds on a hit: ${step.name}`);
    if (/setup-java/u.test(step.uses ?? '') && step.if === undefined) violations.push('sets up a build JDK on a hit');
  }
  const gate = steps.find((step) => /verify-native-artifact-manifest\.mjs/u.test(step.run ?? ''));
  if (!gate || gate.if !== undefined) violations.push('the provenance gate is missing or conditional');
  else {
    if (!/set -o pipefail/u.test(gate.run)) violations.push('the provenance gate can be swallowed by its pipe');
    if (gate.env?.MODE !== "${{ steps.native-build-cache.outputs.cache-hit == 'true' && 'prior-run' || 'same-run' }}") violations.push('the mode is not prior-run on a hit');
  }
  const upload = steps.find((step) => String(step.uses ?? '').startsWith('actions/upload-artifact@'));
  if (!upload || upload.if !== undefined) violations.push('the publish is missing or conditional');
  if (gate && upload && steps.indexOf(gate) > steps.indexOf(upload)) violations.push('published before it was proven');
  return violations;
}

test('11 — a producer that restored a prior-run binary runs no npm ci, prebuild, Gradle, CocoaPods or Xcode build', () => {
  const a3 = workflow(A3);
  for (const name of ['build-android', 'build-ios']) {
    assert.deepEqual(producerViolations(a3.jobs[name]), [], `${A3} ${name}`);
    const key = a3.jobs[name].steps.find((s) => String(s.uses ?? '').startsWith('actions/cache@')).with.key;
    // The key names platform, target, role, recipe + version, and the fingerprint (Task Contract §5.1).
    assert.match(key, name === 'build-android' ? /^qandeel-native-android-x86_64-/u : /^qandeel-native-ios-simulator-iPhone-17-iOS-26-5-/u);
    assert.match(key, /-PROOF_VALIDATION-a3-activity-push-proof-v1-\$\{\{ steps\.fingerprint\.outputs\.value \}\}$/u);
    assert.deepEqual(Object.keys(a3.jobs[name].outputs ?? {}), ['provenance_mode'], 'the producer DECLARES the mode its consumers verify under');
  }
  const mobile = workflow(MOBILE_CI);
  for (const name of ['build-android', 'build-ios']) assert.deepEqual(producerViolations(mobile.jobs[name]), [], `${MOBILE_CI} ${name}`);

  // The consumers take the producer's declared mode, never one derived from the artifact they are judging.
  for (const [consumer, producer] of [['android-leg', 'build-android'], ['ios-leg', 'build-ios']]) {
    const gate = a3.jobs[consumer].steps.find((s) => /verify-native-artifact-manifest/u.test(s.run ?? ''));
    assert.equal(gate.env.MODE, `\${{ needs.${producer}.outputs.provenance_mode == 'prior-run' && 'prior-run' || 'same-run' }}`);
  }

  // Non-vacuity: each planted defect is rejected.
  const real = a3.jobs['build-android'];
  const plant = (mutate) => { const copy = structuredClone(real); mutate(copy.steps); return producerViolations(copy); };
  assert.ok(plant((s) => { delete s.find((x) => /gradlew/u.test(x.run ?? '')).if; }).some((v) => v.startsWith('builds on a hit')));
  assert.ok(plant((s) => { delete s.find((x) => /\bnpm ci\b/u.test(x.run ?? '')).if; }).some((v) => v.startsWith('builds on a hit')));
  assert.ok(plant((s) => { s.find((x) => /verify-native/u.test(x.run ?? '')).if = 'false'; }).includes('the provenance gate is missing or conditional'));
  assert.ok(plant((s) => { s.find((x) => /verify-native/u.test(x.run ?? '')).env.MODE = 'same-run'; }).includes('the mode is not prior-run on a hit'));
  assert.ok(plant((s) => { s.find((x) => String(x.uses ?? '').startsWith('actions/cache@')).with.key = 'qandeel-native-android-${{ github.sha }}'; }).includes('cache key is not the fingerprint'));
});

// ------------------------------------------------------------------------------------------------
// 12, 13 — bounded under infrastructure failure
// ------------------------------------------------------------------------------------------------

/** Every device-driving consumer job, in every workflow VAL-01 migrated. */
const DEVICE_CONSUMERS = [[MOBILE_CI, 'verify-android'], [MOBILE_CI, 'verify-ios'], [A3, 'android-leg'], [A3, 'ios-leg']];

test('12 — the third unchanged attempt is refused: VALIDATION RETRY BUDGET EXHAUSTED', () => {
  assert.equal(MAX_ATTEMPTS, 2);
  assert.equal(retryVerdict(1).ok, true);
  assert.equal(retryVerdict(2).ok, true);
  for (const attempt of [3, 4, 17]) {
    const verdict = retryVerdict(attempt);
    assert.equal(verdict.ok, false);
    assert.ok(verdict.message.startsWith(EXHAUSTED));
  }
  for (const attempt of [undefined, '', '0', '-1', '1.5', 'two']) assert.equal(retryVerdict(attempt).ok, false, `${attempt} is not an established attempt`);
  assert.equal(EXHAUSTED, 'VALIDATION RETRY BUDGET EXHAUSTED');

  // The real CLI, as a workflow runs it.
  const cli = (attempt) => spawnSync(process.execPath, [join(rootPath, 'scripts/validation/retry-budget.mjs'), '--attempt', attempt], { encoding: 'utf8' });
  assert.equal(cli('2').status, 0);
  const third = cli('3');
  assert.equal(third.status, 1);
  assert.match(third.stdout, /VALIDATION RETRY BUDGET EXHAUSTED/u);

  // Every device consumer enforces it BEFORE it downloads, boots or drives anything, and never widens it.
  for (const [file, name] of DEVICE_CONSUMERS) {
    const steps = workflow(file).jobs[name].steps.map(stepText);
    const budget = steps.findIndex((s) => s.includes('scripts/validation/retry-budget.mjs --attempt "${{ github.run_attempt }}"'));
    const firstDevice = steps.findIndex((s) => /download-artifact|android-emulator-runner|simctl|maestro/u.test(s));
    assert.ok(budget >= 0 && budget < firstDevice, `${file} ${name} enforces the budget first`);
    assert.doesNotMatch(steps.join('\n'), /retry-budget\.mjs[^\n]*--max/u, `${file} ${name} does not widen the budget`);
  }
});

test('13 — a dead driver is terminated within its bound and classified INFRASTRUCTURE, on any OS', () => {
  // The shared QAN-INF-02 lifecycle: QANDEEL_TMP-aware, bounded removal, the child standing in the directory it uses.
  const mirror = createHarnessMirror('qandeel-val01-watchdog-');
  try {
    const marker = join(mirror, 'the-child-outlived-the-watchdog');
    const started = Date.now();
    const result = spawnSync(process.execPath, [
      join(rootPath, 'scripts/validation/bounded-run.mjs'), '--seconds', '1', '--grace-seconds', '1', '--label', 'driver-readiness', '--out', mirror, '--',
      process.execPath, '-e', `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'x'), 4000)`,
    ], { cwd: mirror, encoding: 'utf8', timeout: 30_000 });
    const elapsed = (Date.now() - started) / 1000;
    assert.equal(result.status, TIMEOUT_EXIT_CODE, `exit ${result.status}: ${result.stderr}`);
    assert.ok(elapsed < 10, `bounded: ${elapsed}s`);
    assert.match(result.stdout, /::error title=INFRASTRUCTURE — driver-readiness::INFRASTRUCTURE: driver-readiness exceeded its 1s bound/u);
    assert.match(readFileSync(join(mirror, 'watchdog-driver-readiness.txt'), 'utf8'), /^INFRASTRUCTURE: driver-readiness exceeded/u);
    spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 4500)'], { cwd: mirror });
    assert.equal(existsSync(marker), false, 'the hung command was killed, not left running');

    // A command that finishes inside its bound passes its own status straight through.
    const ok = spawnSync(process.execPath, [join(rootPath, 'scripts/validation/bounded-run.mjs'), '--seconds', '20', '--label', 'x', '--', process.execPath, '-e', 'process.exit(3)'],
      { cwd: mirror, encoding: 'utf8' });
    assert.equal(ok.status, 3);
  } finally {
    removeHarnessMirror(mirror);
  }
  for (const argv of [['--', 'x'], ['--seconds', '0', '--label', 'x', '--', 'x'], ['--seconds', '5', '--label', 'a b', '--', 'x'], ['--seconds', '5', '--label', 'x']]) {
    assert.ok(parseArgs(argv).error, `${argv.join(' ')} is refused`);
  }

  // Structural: every Maestro invocation in a device consumer or leg runner goes through the watchdog, and each
  // driver gets a bounded readiness probe of at most five minutes before its first flow.
  const logical = (text) => stripFullLineComments('x.sh', text).replace(/\\\n\s*/gu, ' ').split('\n');
  for (const runner of ['scripts/a3/run-proof-leg.sh', 'scripts/a3/run-ios-proof-leg.sh']) {
    const lines = logical(read(runner));
    const invocations = lines.filter((line) => /\bmaestro (?:--device "\$UDID" )?(?:test|hierarchy)\b/u.test(line));
    assert.ok(invocations.length >= 2, `${runner} drives Maestro`);
    for (const line of invocations) assert.match(line, /\$BOUND --seconds /u, `${runner}: unbounded Maestro call: ${line.trim()}`);
    const probe = lines.findIndex((line) => /--label driver-readiness/u.test(line) && /hierarchy/u.test(line));
    const firstFlow = lines.findIndex((line) => /maestro_flow [a-z0-9-]+\.yaml|^flow [a-z0-9-]+\.yaml|"\$FLOWS\/a3-01-readiness\.yaml"/u.test(line.trim()));
    assert.ok(probe >= 0 && probe < firstFlow, `${runner}: the driver is probed before the first flow`);
    assert.match(lines[probe], /--seconds 300 /u);
  }
  for (const [file, name] of DEVICE_CONSUMERS.filter(([f]) => f === MOBILE_CI)) {
    const text = workflow(file).jobs[name].steps.map(stepText).join('\n');
    for (const line of text.split(/\n|\\n/u).filter((l) => /\bmaestro (?:--device "\$IOS_SIM_UDID" )?(?:test|hierarchy)\b/u.test(l))) {
      assert.match(line, /bounded-run\.mjs --seconds \d+ /u, `${name}: unbounded Maestro call`);
    }
    assert.match(text, /--label (?:android|ios)-driver-readiness --quiet -- maestro (?:--device "\$IOS_SIM_UDID" )?hierarchy/u);
  }
  // Non-vacuity: the predicate sees a planted unbounded call.
  assert.doesNotMatch('  maestro test "$FLOWS/x.yaml"', /\$BOUND --seconds /u);
});

// ------------------------------------------------------------------------------------------------
// 14, 15 — main stays conservative; a red result is never laundered
// ------------------------------------------------------------------------------------------------

test('14 — main, push, dispatch and a PR\'s first head never carry forward, and the workflows skip only on proof', () => {
  for (const context of [
    { event: 'push', action: undefined, predecessorSha: PRED },
    { event: 'workflow_dispatch', predecessorSha: PRED },
    { event: 'pull_request', action: 'opened', predecessorSha: PRED },
    { event: 'pull_request', action: 'reopened', predecessorSha: PRED },
    { event: 'pull_request', action: 'ready_for_review', predecessorSha: PRED },
    { event: 'pull_request_target', action: 'synchronize', predecessorSha: PRED },
  ]) {
    for (const gate of GATES) {
      assert.equal(planGate({ gate, context, delta: [A3_RECORD], analysis: { contracts: [], heavyBinders: [] }, evidence: GREEN }).decision, 'RUN', `${gate} on ${context.event}/${context.action}`);
    }
  }
  // Each heavy job is skipped ONLY on the literal token a successful plan writes; an empty, failed or garbled plan runs it.
  const api = workflow(API_CI).jobs;
  assert.equal(api['verify-api'].if, "${{ !cancelled() && needs.plan.outputs.api_heavy != 'CARRY_FORWARD' }}");
  const mobile = workflow(MOBILE_CI).jobs;
  assert.equal(mobile['verify-mobile-contracts'].if, "${{ !cancelled() && needs.plan.outputs.mobile_contract != 'CARRY_FORWARD' }}");
  for (const name of ['build-android', 'build-ios']) {
    assert.match(mobile[name].if, /needs\.plan\.outputs\.mobile_native_binary != 'CARRY_FORWARD' && needs\.plan\.outputs\.mobile_native_binary != 'NOT_RELEVANT'/u);
    assert.match(mobile[name].if, /needs\.verify-mobile-contracts\.result == 'success' \|\| \(needs\.verify-mobile-contracts\.result == 'skipped' && needs\.plan\.outputs\.mobile_contract == 'CARRY_FORWARD'\)/u);
  }
  // Both workflows still run on every push to main, with no path filter there.
  for (const file of [API_CI, MOBILE_CI]) {
    const on = workflow(file).on;
    assert.deepEqual(on.push, { branches: ['main'] }, `${file} keeps its unconditional main push`);
  }
  // And the planner's own failure answers RUN.
  assert.match(read('scripts/validation/plan-validation.mjs'), /planner error — every gate RUNS/u);
});

test('15 — a failed gate cannot be laundered into success by an irrelevant follow-up commit', () => {
  // The run that FAILED records no evidence, and its evidence job is red.
  assert.deepEqual(gateOutcome({ decision: 'RUN', gateResult: 'failure' }), { due: true, green: false, disposition: null });
  assert.deepEqual(gateOutcome({ decision: 'RUN', gateResult: 'cancelled' }), { due: true, green: false, disposition: null });
  assert.deepEqual(gateOutcome({ decision: '', gateResult: 'failure' }), { due: true, green: false, disposition: null }, 'an unknown decision is a RUN');
  // A carry-forward whose bound contracts failed is not green either — so the NEXT head cannot carry it.
  assert.equal(gateOutcome({ decision: 'CARRY_FORWARD', boundResult: 'failure', contracts: 'tests/x.test.mjs' }).green, false);
  assert.equal(gateOutcome({ decision: 'CARRY_FORWARD', boundResult: 'skipped', contracts: 'tests/x.test.mjs' }).green, false, 'a bound set that never ran is not green');
  assert.equal(gateOutcome({ decision: 'CARRY_FORWARD', boundResult: 'skipped', contracts: '' }).disposition, 'CARRIED_FORWARD');
  assert.equal(gateOutcome({ decision: 'RUN', gateResult: 'success' }).disposition, 'EXECUTED');

  // Green in attempt 1, red when re-run in attempt 2: the attempt-1 artifact still exists, and is refused.
  const relaundered = validateEvidence(goodRecord({ runAttempt: 1 }), goodExpectation({ latestAttempt: 2, evidenceJobConclusion: 'failure' }));
  assert.ok(relaundered.refusals.some((r) => r.startsWith('EVIDENCE_NOT_FROM_LATEST_ATTEMPT')));
  assert.ok(relaundered.refusals.some((r) => r.startsWith('EVIDENCE_JOB_NOT_GREEN')));
  // An older green run of the predecessor never outvotes its newer red one.
  const runs = [
    { id: 1, run_number: 7, head_sha: PRED, conclusion: 'success' },
    { id: 2, run_number: 9, head_sha: PRED, conclusion: 'failure' },
    { id: 3, run_number: 12, head_sha: 'c'.repeat(40), conclusion: 'success' },
  ];
  assert.equal(selectPredecessorRun(runs, PRED).id, 2);
  assert.equal(selectPredecessorRun([], PRED), null);
  // Evidence from another head, another base, another gate or another workflow is not this predecessor's.
  for (const [code, record, expectation] of [
    ['NOT_THE_EXACT_PREDECESSOR', goodRecord({ headSha: 'c'.repeat(40) }), goodExpectation()],
    ['BASE_MOVED', goodRecord({ baseSha: 'c'.repeat(40) }), goodExpectation()],
    ['EVIDENCE_GATE_MISMATCH', goodRecord({ gate: 'MOBILE_CONTRACT' }), goodExpectation()],
    ['EVIDENCE_WORKFLOW_MISMATCH', goodRecord({ workflow: 'mobile-ci' }), goodExpectation()],
    ['EVIDENCE_RUN_MISMATCH', goodRecord({ runId: '55' }), goodExpectation()],
    ['EVIDENCE_SCHEMA_MISMATCH', goodRecord({ schema: 'x' }), goodExpectation()],
    ['EVIDENCE_SOURCE_MISSING', goodRecord({ sourceRunId: undefined }), goodExpectation()],
    ['EVIDENCE_DISPOSITION_INVALID', goodRecord({ disposition: 'ASSUMED' }), goodExpectation()],
  ]) {
    const verdict = validateEvidence(record, expectation);
    assert.equal(verdict.ok, false, code);
    assert.ok(verdict.refusals.some((r) => r.startsWith(`${code}:`)), `${code}: ${verdict.refusals.join(' | ')}`);
  }
});

// ------------------------------------------------------------------------------------------------
// The wiring: one evidence identity, one leg law, the physical boundary, no new dependency
// ------------------------------------------------------------------------------------------------

test('the workflows plan first, record evidence under ONE job name and artifact identity, and read only what they need', () => {
  for (const [file, key, gates] of [[API_CI, 'api-ci', ['API_HEAVY']], [MOBILE_CI, 'mobile-ci', ['MOBILE_CONTRACT', 'MOBILE_NATIVE_BINARY']]]) {
    const wf = workflow(file);
    assert.deepEqual(wf.permissions, { contents: 'read', actions: 'read' }, `${file} reads runs and artifacts, writes nothing`);
    assert.match(stepText(wf.jobs.plan.steps.at(-1)), new RegExp(`plan-validation\\.mjs plan --workflow ${key}`, 'u'));
    assert.equal(wf.jobs.plan.steps[0].with['fetch-depth'], 0, 'the delta needs real history');
    const evidence = wf.jobs.evidence;
    assert.equal(evidence.name, EVIDENCE_JOB_NAME);
    assert.equal(evidence.if, '${{ !cancelled() }}');
    for (const gate of gates) {
      const upload = evidence.steps.find((s) => s.with?.name === evidenceArtifactName(key, gate));
      assert.ok(upload, `${file} publishes ${gate} evidence`);
      assert.equal(upload.with.overwrite, true, 'a re-run replaces the record rather than colliding with it');
      assert.ok(evidence.steps.some((s) => new RegExp(`record --workflow ${key} --gate ${gate}`, 'u').test(s.run ?? '')));
    }
  }
  // Bound contracts run under the workflow's own name for them, from the plan's list only.
  assert.match(workflow(API_CI).jobs['api-bound-contracts'].if, /api_heavy == 'CARRY_FORWARD' && needs\.plan\.outputs\.api_heavy_contracts != ''/u);
  assert.match(workflow(MOBILE_CI).jobs['mobile-bound-contracts'].if, /mobile_contract == 'CARRY_FORWARD' && needs\.plan\.outputs\.mobile_contract_contracts != ''/u);
  // The suites the planner reads are real: forward-safety and the governance gate are API contracts.
  assert.ok(apiSuite.includes('tests/forward-safety-contract.test.mjs') && apiSuite.includes('tests/task-closure-governance-contract.test.mjs'));
  assert.ok(mobileSuite.includes('tests/val-01-change-aware-validation-contract.test.mjs'));
  // The native classifier's consumer flows are exactly the flows Mobile CI's device consumers run.
  const consumerFlows = ['verify-android', 'verify-ios'].flatMap((job) => [...workflow(MOBILE_CI).jobs[job].steps.map(stepText).join('\n')
    .matchAll(/apps\/mobile\/\.maestro\/[a-z0-9-]+\.yaml/gu)].map((m) => m[0]));
  assert.deepEqual([...new Set(consumerFlows)], [...NATIVE_CONSUMER_FLOWS]);
});

test('leg selection drives the A3 matrices; legs stay isolated; physical-device facts are never simulated', () => {
  const a3 = workflow(A3);
  assert.match(stepText(a3.jobs.plan.steps.at(-1)), /plan-validation\.mjs legs --suite a3/u);
  for (const [platform, config] of Object.entries(PROOF_SUITES.a3.platforms)) {
    const consumer = a3.jobs[config.consumer];
    assert.equal(consumer.strategy.matrix.leg, `\${{ fromJSON(needs.plan.outputs.${platform}_legs) }}`);
    assert.equal(consumer.strategy['fail-fast'], false);
    assert.equal(a3.jobs[config.producer].if, `\${{ needs.plan.outputs.${platform}_legs != '[]' }}`, 'no leg selected → nothing is built');
    assert.equal(consumer.if, `\${{ !cancelled() && needs.${config.producer}.result == 'success' }}`);
  }
  // The boundary is explicit: every runner leg is SIMULATOR_PROVABLE; every physical fact is PHYSICAL_DEVICE_REQUIRED,
  // owned by QAN-BL-NOTIF-05, and can never be placed in a simulator matrix.
  const facts = PROOF_SUITES.a3.physicalDeviceFacts;
  assert.deepEqual(facts.map((f) => f.id), ['PD-01', 'PD-02', 'PD-03', 'PD-04', 'PD-05', 'PD-06', 'PD-07', 'PD-08', 'PD-09']);
  assert.ok(facts.every((f) => f.disposition === DISPOSITIONS.PHYSICAL_DEVICE_REQUIRED && f.owner === 'QAN-BL-NOTIF-05'));
  for (const graph of Object.values(graphs)) {
    assert.ok(graph.legs.every((leg) => leg.disposition === DISPOSITIONS.SIMULATOR_PROVABLE));
    assert.ok(graph.legs.every((leg) => !facts.some((f) => f.id === leg.id)));
    assert.equal(assertSimulatorMatrix(graph, graph.legs.map((l) => l.id), facts), true);
  }
  const planted = { runner: 'x', legs: [{ id: 'PD-03', disposition: DISPOSITIONS.SIMULATOR_PROVABLE, flows: new Set() }] };
  assert.throws(() => assertSimulatorMatrix(planted, ['PD-03'], facts), /PHYSICAL_DEVICE_REQUIRED/u);
  assert.throws(() => assertSimulatorMatrix({ runner: 'x', legs: [{ id: 'y', disposition: 'UNKNOWN' }] }, ['y']), /not SIMULATOR_PROVABLE/u);
});

test('VAL-01 adds no dependency and touches no Product source', () => {
  for (const file of readdirSync(join(rootPath, 'scripts/validation'))) {
    const imports = [...read(`scripts/validation/${file}`).matchAll(/^import [^\n]*? from '([^']+)';$/gmu)].map((m) => m[1]);
    for (const specifier of imports) {
      assert.ok(specifier.startsWith('node:') || specifier.startsWith('./') || specifier.startsWith('../phase-m/') || specifier === '../classify-mobile-native-impact.mjs',
        `scripts/validation/${file} imports ${specifier}`);
    }
  }
  // Nothing in the app imports the validation tooling, so none of it is bundled.
  for (const [path, text] of sources) {
    if (!path.startsWith('apps/')) continue;
    assert.doesNotMatch(text, /from ['"][^'"]*scripts\/validation/u, `${path} imports validation tooling`);
  }
});

test('the gate is wired', () => {
  assert.equal(scripts['test:val-01-change-aware-validation-contract'], 'node --test tests/val-01-change-aware-validation-contract.test.mjs');
  assert.match(read(MOBILE_CI), /run: npm run test:val-01-change-aware-validation-contract\b/u);
});
