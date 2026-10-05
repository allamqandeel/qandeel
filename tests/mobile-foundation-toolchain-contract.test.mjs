import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { classifyMobileNativeImpact } from '../scripts/classify-mobile-native-impact.mjs';

// T-01 — Mobile Client Foundation + Canonical Toolchain Baseline: executable contract.
// Guards the approved foundation (Pre-Flight Report v2 + Execution Authorization v1).

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const readJson = async (path) => JSON.parse(await read(path));

const rootPackage = await readJson('package.json');
const rootLock = await readJson('package-lock.json');
const mobilePackage = await readJson('apps/mobile/package.json');
const appConfig = await readJson('apps/mobile/app.json');
const mobileTsconfig = await readJson('apps/mobile/tsconfig.json');
const mobileGitignore = await read('apps/mobile/.gitignore');
const mobileReadme = await read('apps/mobile/README.md');
const rootReadme = await read('README.md');
const preflight = await read('scripts/preflight.mjs');
const apiCi = await read('.github/workflows/api-ci.yml');
const mobileCi = await read('.github/workflows/mobile-ci.yml');
const bootSmoke = await read('apps/mobile/.maestro/boot-smoke.yaml');

const expectedDependencies = {
  // T-04: the authorized Living Analysis Map renderer, pinned exactly (not a range) because it
  // is a native dependency whose generated projects the native smoke jobs build. It is the
  // Expo SDK 57 recommended Skia version and `expo install --check` accepts it unchanged.
  '@shopify/react-native-skia': '2.6.2',
  // T-12P §2.1: the authorized direct-Supabase mobile identity authority. The mobile app obtains
  // its own Supabase Auth session and forwards the access token to the existing API, which stays
  // the verifier. No backend-issued substitute token exists, and no secret key ships here.
  //
  // Pinned EXACTLY, not as a range, for the same reason the Skia pin is exact and one more: this is
  // the credential-handling dependency, so the version an Architecture and Security review audited
  // must be the version that ships. A caret would also reintroduce the live-registry drift QAN-INF-02
  // had to close.
  '@supabase/supabase-js': '2.116.0',
  // MOB-CI-01, then QAN-INF-02: Expo SDK 57 patch baseline refreshed to what
  // `expo install --check` now requires against the live registry. Only these two patch
  // pins moved; the SDK minor is unchanged and the assertion is exact, not a range.
  expo: '~57.0.21',
  'expo-constants': '~57.0.17',
  'expo-dev-client': '~57.0.18',
  // W3-MEGA-S (E2E-D-16): the in-app download of a ready export package writes it where the reader chooses through the
  // system folder picker (Directory.pickDirectoryAsync). expo-file-system was already in the tree at exactly this
  // version as a dependency of `expo` itself (Expo SDK 57's bundled module, autolinked in every build), so declaring it
  // direct changes no installed version and no native project — the same shape as the expo-font declaration below.
  'expo-file-system': '~57.0.6',
  // W1A-01: the Product Owner authorized Estedad v8.5 for the Conversation surface, loaded through
  // expo-font. It was already in the tree at exactly this version as a dependency of `expo` itself
  // (Expo SDK 57's bundled module), so declaring it direct changes no installed version, adds no
  // native module and needs no config plugin: the app config's plugin list is unchanged.
  'expo-font': '~57.0.3',
  'expo-linking': '~57.0.9',
  // A3-02: native Push, OS notification permission, channels and taps — Expo SDK 57's first-party module at its bundled
  // version (A3-02 record §5). It talks to APNs / FCM natively; Expo's push relay is never used.
  'expo-notifications': '~57.0.17',
  'expo-router': '~57.0.20',
  // T-12P §2.4: the Supabase auth-session store, pinned to the Expo SDK 57 bundled version. It is
  // the current official Supabase-on-Expo storage recommendation and it holds AUTHENTICATION
  // material only. It is not a Product persistence permission: T-12P's own contract proves the
  // package is reachable from exactly one module and that no canonical state is ever written.
  'expo-sqlite': '~57.0.2',
  'expo-status-bar': '~57.0.1',
  react: '19.2.3',
  'react-native': '0.86.3',
  // Mechanically required by the approved container: expo-router@57 depends on
  // react-native-drawer-layout, whose non-optional peers are Reanimated and Gesture Handler
  // (Reanimated 4 requires Worklets). Pinned to the Expo SDK 57 bundled versions so that
  // npm cannot float them to incompatible releases.
  'react-native-gesture-handler': '~2.32.0',
  'react-native-reanimated': '4.5.1',
  'react-native-safe-area-context': '~5.7.0',
  'react-native-screens': '~4.26.0',
  'react-native-worklets': '0.10.1',
};

const expectedDevDependencies = {
  // T-03A2: the repository-owned, TYPE-ONLY shared wire contract. It ships no
  // JavaScript and is imported only with `import type`, so it is a build-time
  // contract rather than a shipped runtime dependency of the app bundle.
  '@qandeel/runtime': '*',
  '@testing-library/react-native': '^14.0.1',
  '@types/jest': '^29.5.14',
  '@types/react': '~19.2.2',
  eslint: '^9.39.5',
  'eslint-config-expo': '~57.0.2',
  'expo-doctor': '^1.20.4',
  jest: '~29.7.0',
  'jest-expo': '~57.0.5',
  'test-renderer': '^1.2.0',
  typescript: '~5.9.3',
};

function git(args) {
  const result = spawnSync('git', args, { cwd: fileURLToPath(root), encoding: 'utf8' });
  assert.equal(result.error, undefined, `git ${args.join(' ')} failed to start`);
  assert.equal(result.status, 0, `git ${args.join(' ')} exited ${result.status}: ${result.stderr}`);
  return result.stdout;
}

function lockfileCopies(name) {
  return Object.keys(rootLock.packages).filter(
    (key) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`),
  );
}

test('root toolchain baseline is Node >=22.13.0 on npm with one root lockfile', () => {
  assert.equal(rootPackage.engines.node, '>=22.13.0');
  assert.equal(rootPackage.engines.npm, '>=10');
  assert.deepEqual(rootPackage.workspaces, ['apps/*', 'packages/*']);
  assert.equal(rootLock.lockfileVersion, 3);
  assert.equal(rootLock.packages[''].engines.node, '>=22.13.0');
  assert.match(preflight, /major: 22, minor: 13, patch: 0/u);
  assert.match(preflight, /Node 22\.13\.0 or newer is required/u);
  assert.match(rootReadme, /Node\.js 22\.13 or newer/u);
});

test('the mobile workspace joins the root workspace and the root lockfile only', () => {
  assert.equal(mobilePackage.name, '@qandeel/mobile');
  assert.equal(mobilePackage.private, true);
  assert.equal(mobilePackage.main, 'expo-router/entry');
  assert.equal(rootLock.packages['apps/mobile'].name, '@qandeel/mobile');
  assert.equal(rootLock.packages['node_modules/@qandeel/mobile'].link, true);
  assert.equal(rootLock.packages['node_modules/@qandeel/mobile'].resolved, 'apps/mobile');
  assert.equal(existsSync(new URL('apps/mobile/package-lock.json', root)), false);
  assert.equal(
    git(['ls-files', '--', 'apps/mobile/package-lock.json', 'apps/mobile/yarn.lock', 'apps/mobile/pnpm-lock.yaml', 'apps/mobile/bun.lock']).trim(),
    '',
  );
});

test('mobile dependency pins are exactly the authorized Expo SDK 57 foundation', () => {
  assert.deepEqual(mobilePackage.dependencies, expectedDependencies);
  assert.deepEqual(mobilePackage.devDependencies, expectedDevDependencies);
  assert.deepEqual(mobilePackage.expo, { install: { exclude: ['typescript'] } });
  assert.equal(mobilePackage.jest.preset, 'jest-expo');
  assert.match(mobileReadme, /install\.exclude/u);
  assert.match(mobileReadme, /typescript ~5\.9\.3/u);
});

test('one React, one React Native and one TypeScript (5.9 line) exist in the lockfile', () => {
  assert.deepEqual(lockfileCopies('react-native'), ['node_modules/react-native']);
  assert.equal(rootLock.packages['node_modules/react-native'].version, '0.86.3');
  assert.deepEqual(lockfileCopies('react'), ['node_modules/react']);
  assert.equal(rootLock.packages['node_modules/react'].version, '19.2.3');
  assert.deepEqual(lockfileCopies('typescript'), ['node_modules/typescript']);
  assert.match(rootLock.packages['node_modules/typescript'].version, /^5\.9\./u);
});

test('app config carries provisional technical identifiers only and no architecture toggle', () => {
  const { expo } = appConfig;
  // W2-02: the display name is no longer provisional; it is the frozen Product casing (P4-C2 §5).
  assert.equal(expo.name, 'QANDEEL');
  assert.equal(expo.slug, 'qandeel');
  assert.equal(expo.scheme, 'qandeel');
  assert.equal(expo.ios.bundleIdentifier, 'com.qandeel.mobile');
  assert.equal(expo.android.package, 'com.qandeel.mobile');
  assert.deepEqual(expo.platforms, ['ios', 'android']);
  // A3-02 RE-ANCHOR: native Push adds exactly two plugins — its own typed manifest mod (no dangerous mod) and Expo's
  // first-party expo-notifications (iOS aps-environment). Nothing else may enter; the order is load-bearing (A3-02 record §5).
  assert.deepEqual(expo.plugins, ['expo-router', './plugins/with-qandeel-launch-identity', './plugins/with-qandeel-push', ['expo-notifications', { mode: 'production' }]]);
  assert.equal('newArchEnabled' in expo, false, 'New Architecture is structural on this SDK line; no toggle may be reintroduced');
  assert.equal('extra' in expo, false);
  assert.match(bootSmoke, /^appId: com\.qandeel\.mobile$/mu);
});

test('the router root is the two-file technical container, not a product route tree', () => {
  const entries = readdirSync(new URL('apps/mobile/src/app/', root)).sort();
  assert.deepEqual(entries, ['_layout.tsx', 'index.tsx']);
});

test('mobile TypeScript config extends the Expo base and stays strict', () => {
  assert.equal(mobileTsconfig.extends, 'expo/tsconfig.base');
  assert.equal(mobileTsconfig.compilerOptions.strict, true);
});

test('generated native output is never tracked, no Level-4 native mutation, no secrets', async () => {
  assert.equal(git(['ls-files', '--', 'apps/mobile/ios', 'apps/mobile/android']).trim(), '');
  assert.match(mobileGitignore, /^\/ios$/mu);
  assert.match(mobileGitignore, /^\/android$/mu);
  assert.match(mobileGitignore, /^\.expo\/$/mu);
  for (const pattern of ['*.jks', '*.p8', '*.p12', '*.key', '*.mobileprovision']) {
    assert.equal(mobileGitignore.includes(pattern), true, `missing ignore pattern ${pattern}`);
  }
  const tracked = git(['ls-files', '--', 'apps/mobile']).split(/\r?\n/u).filter(Boolean);
  assert.ok(tracked.length > 0, 'the mobile workspace must be tracked');
  // The one recorded Level-4 exception (apps/mobile/README.md, "W2-02 Level-4 exception"): the plugin that
  // installs the I-08B2.5 icon bytes and the launch resources. No other mobile file may use a dangerous mod.
  const level4Exceptions = new Set(['apps/mobile/plugins/with-qandeel-launch-identity.js']);
  for (const file of tracked) {
    const text = await read(file);
    if (!level4Exceptions.has(file)) assert.doesNotMatch(text, /withDangerousMod/u, `${file} uses a Level-4 dangerous mod`);
    assert.doesNotMatch(
      text,
      /(?:ANTHROPIC|OPENAI|GOOGLE_AI|SUPABASE_SERVICE_ROLE)_(?:API_)?KEY|SUPABASE_PUBLISHABLE_KEY|EXPO_PUBLIC_|sk-ant-/u,
      `${file} references a credential or public runtime secret`,
    );
  }
  assert.equal(git(['ls-files', '--', 'apps/mobile/.env', 'apps/mobile/.env.local', 'apps/mobile/eas.json']).trim(), '');
});

test('repository scripts stay npm-only and the mobile gates are registered at the root', () => {
  const commands = [...Object.values(rootPackage.scripts), ...Object.values(mobilePackage.scripts)].join('\n');
  assert.doesNotMatch(commands, /\b(?:pnpm|yarn|npx)\b/u);
  for (const name of [
    'start:mobile',
    'typecheck:mobile',
    'lint:mobile',
    'test:mobile',
    'deps:check:mobile',
    'doctor:mobile',
    'prebuild:mobile',
    'test:mobile-foundation-contract',
    'test:mobile-native-impact-classifier',
  ]) assert.equal(typeof rootPackage.scripts[name], 'string', `missing root script ${name}`);
  for (const name of ['start', 'typecheck', 'lint', 'test', 'deps:check', 'doctor', 'prebuild', 'prebuild:android', 'prebuild:ios', 'prebuild:verify']) {
    assert.equal(typeof mobilePackage.scripts[name], 'string', `missing mobile script ${name}`);
  }
  assert.equal(mobilePackage.scripts['deps:check'], 'expo install --check');
  assert.equal(mobilePackage.scripts.doctor, 'expo-doctor');
  assert.equal(mobilePackage.scripts['prebuild:verify'], 'node scripts/verify-prebuild-idempotency.mjs');
});

test('CI baselines: API CI on Node 22; mobile CI pins runner, Xcode, JDK, emulator and Maestro', () => {
  assert.match(apiCi, /node-version: '22'/u);
  assert.doesNotMatch(apiCi, /node-version: '20'/u);
  assert.match(apiCi, /run: npm run test:toolchain/u);

  const nodeVersions = mobileCi.match(/node-version: '\d+'/gu) ?? [];
  // RE-ANCHORED (QAN-INF-04-FIX-01): this was `=== 3`, a count that froze Mobile CI's job total. The
  // invariant it existed for is the PIN below — no job may inherit the runner's default Node — and
  // that one applies to however many jobs exist. The floor keeps the original "and there are at least
  // the fast gate and both native validations" claim without capping additive work.
  assert.ok(nodeVersions.length >= 3, 'the fast gate and both native validation jobs set up Node explicitly');
  for (const entry of nodeVersions) assert.equal(entry, "node-version: '22'");
  assert.match(mobileCi, /runs-on: ubuntu-latest/u);
  assert.match(mobileCi, /runs-on: macos-26/u);
  assert.match(mobileCi, /DEVELOPER_DIR: \/Applications\/Xcode_26\.6\.app\/Contents\/Developer/u);
  assert.match(mobileCi, /xcode-select -s \/Applications\/Xcode_26\.6\.app/u);
  assert.match(mobileCi, /grep -x 'Xcode 26\.6'/u);
  assert.match(mobileCi, /distribution: temurin/u);
  assert.match(mobileCi, /java-version: '17'/u);
  assert.match(mobileCi, /reactivecircus\/android-emulator-runner@v2\.38\.0/u);
  assert.match(mobileCi, /api-level: 36/u);
  assert.match(mobileCi, /arch: x86_64/u);
  assert.match(mobileCi, /MAESTRO_VERSION: 2\.10\.0/u);
  assert.match(mobileCi, /MAESTRO_ZIP_SHA256: 29b675e10cc12080e445e9bfb2e2b4e4dfb9c0f2e30d5884120d258b5e1cd991/u);
  assert.match(mobileCi, /sha256sum --check --strict/u);
  assert.match(mobileCi, /shasum -a 256 --check --strict/u);
  assert.doesNotMatch(mobileCi, /releases\/latest|get\.maestro\.mobile\.dev/u);
  assert.match(mobileCi, /grep -qx "\$\{MAESTRO_VERSION\}"/u);
  assert.match(mobileCi, /assembleRelease/u);
  assert.match(mobileCi, /-configuration Release/u);
  assert.match(mobileCi, /boot-smoke\.yaml/u);
  for (const command of [
    'test:toolchain',
    'test:mobile-foundation-contract',
    'typecheck:mobile',
    'lint:mobile',
    'test:mobile',
    'deps:check:mobile',
    'doctor:mobile',
    'prebuild:mobile',
  ]) assert.match(mobileCi, new RegExp(`run: npm run ${command}`, 'u'), `mobile CI must run ${command}`);
});

// MOB-CI-01 - Mobile CI is a FAST MOBILE CONTRACT GATE that always runs plus
// CONDITIONAL NATIVE SMOKE GATES. The optimization is WHEN native smoke runs,
// never what it proves when it runs.
// RE-ANCHORED (QAN-INF-04-FIX-01): the slice used to be bounded by the NAME of the job that follows,
// which froze Mobile CI's job order and count. It is bounded by the next job header instead, whatever
// that header happens to be, so an additive job can never silently widen another job's slice.
const jobSlice = (name) => {
  const start = mobileCi.indexOf(`\n  ${name}:`);
  assert.notEqual(start, -1, `job ${name} must exist`);
  const afterHeader = mobileCi.indexOf('\n', start + 1);
  const next = mobileCi.slice(afterHeader).search(/\n {2}[A-Za-z0-9_-]+:$/mu);
  return next === -1 ? mobileCi.slice(start) : mobileCi.slice(start, afterHeader + next);
};

test('mobile CI keeps root package.json in the trigger so root changes still get contract validation', () => {
  const trigger = mobileCi.slice(mobileCi.indexOf('paths:'), mobileCi.indexOf('push:'));
  for (const path of ['apps/mobile/**', 'package.json', 'package-lock.json', '.github/workflows/mobile-ci.yml']) {
    assert.ok(trigger.includes(`'${path}'`), `mobile CI must still trigger on ${path}`);
  }
});

test('the fast mobile contract gate always runs and owns every Node-only gate', () => {
  const fast = jobSlice('verify-mobile-contracts');
  assert.match(fast, /runs-on: ubuntu-latest/u);
  // VAL-01 RE-ANCHOR: the fast gate runs on every head EXCEPT a PR update the change-aware planner positively proved it
  // may carry forward (a green, same-lineage predecessor and nothing in the update that can reach this gate; the root
  // contracts that read a changed doc or flow still re-run in `mobile-bound-contracts`). It waits only for that plan, and
  // a failed or silent plan makes it run.
  assert.match(fast, /^ {4}needs: \[plan\]$/mu, 'the fast gate depends on nothing but the plan');
  assert.match(fast, /^ {4}if: \$\{\{ !cancelled\(\) && needs\.plan\.outputs\.mobile_contract != 'CARRY_FORWARD' \}\}$/mu,
    'the fast gate is skipped only on a proven carry-forward');
  // The classification it used to run first now runs in the plan job, with the same full history, the same classifier
  // over the same merge-base diff, and the same fail-safe on an unestablished base.
  const plan = jobSlice('plan');
  assert.match(plan, /fetch-depth: 0/u);
  assert.match(plan, /node scripts\/validation\/plan-validation\.mjs plan --workflow mobile-ci/u);
  const planner = readFileSync(new URL('../scripts/validation/plan-validation.mjs', import.meta.url), 'utf8');
  assert.match(planner, /from '\.\.\/classify-mobile-native-impact\.mjs'/u);
  assert.match(planner, /git\(\['merge-base'/u);
  assert.match(planner, /classifyChangedFiles\(cumulative \?\? \[\]\)/u, 'an unestablished diff fails safe to native impact');
  for (const command of [
    'preflight',
    'test:toolchain',
    'test:mobile-foundation-contract',
    'test:mobile-canonical-state-contract',
    'test:mobile-native-impact-classifier',
    'typecheck:mobile',
    'lint:mobile',
    'test:mobile',
    'deps:check:mobile',
    'doctor:mobile',
    'prebuild:mobile',
  ]) assert.match(fast, new RegExp(`run: npm run ${command}\\b`, 'u'), `the fast gate must run ${command}`);
  // Expo dependency drift is never hidden. (The classifier's own `|| true`
  // guards are the deliberate fail-safe, not a soft-failed gate.)
  assert.doesNotMatch(fast, /continue-on-error/u);
  assert.doesNotMatch(fast, /run: npm run [^\n]*\|\|/u, 'no mobile gate may be soft-failed');
});

test('both native smoke jobs are gated by native_impact and keep their full contract', () => {
  // RE-ANCHORED (QAN-INF-04-FIX-01): each platform is now a BUILD PRODUCER plus a separately
  // re-runnable VALIDATION CONSUMER, so a flaked emulator no longer costs a rebuild. Every claim
  // below is the one it always was — it is asserted against the job that now performs the thing,
  // and nothing is dropped: the same CNG generation, the same Release build, the same pinned
  // emulator/simulator and the same boot smoke are all still required.
  const androidBuild = jobSlice('build-android');
  const android = jobSlice('verify-android');
  const iosBuild = jobSlice('build-ios');
  const ios = jobSlice('verify-ios');
  // VAL-01 RE-ANCHOR: the native-impact decision is the change-aware planner's (MOB-CI-01's classifier over the PR's
  // cumulative diff, plus a proven-green carry-forward for an update that holds no native input). Each producer waits
  // for the fast gate and runs only behind that decision; each consumer runs exactly when its own producer published.
  for (const [name, job] of [['android build', androidBuild], ['ios build', iosBuild]]) {
    assert.match(job, /needs: \[plan, verify-mobile-contracts\]/u, `${name} must depend on the fast gate`);
    assert.match(job, /needs\.plan\.outputs\.mobile_native_binary != 'NOT_RELEVANT'/u, `${name} must run only for true native-impact changes`);
    assert.match(job, /needs\.verify-mobile-contracts\.result == 'success'/u, `${name} runs only behind a green fast gate`);
  }
  for (const [name, job, producer] of [['android', android, 'build-android'], ['ios', ios, 'build-ios']]) {
    assert.match(job, new RegExp(`needs: \\[plan, ${producer}\\]`, 'u'), `${name} consumes its own producer`);
    assert.match(job, new RegExp(`if: \\$\\{\\{ !cancelled\\(\\) && needs\\.${producer}\\.result == 'success' \\}\\}`, 'u'));
  }
  for (const [name, job] of [['android', android], ['ios', ios], ['android build', androidBuild], ['ios build', iosBuild]]) {
    assert.doesNotMatch(job, /continue-on-error/u, `${name} never soft-fails`);
  }
  for (const [name, job] of [['android', android], ['ios', ios]]) {
    assert.match(job, /uses: actions\/setup-java@v6/u, `${name} keeps JDK 17`);
    assert.match(job, /boot-smoke\.yaml/u, `${name} keeps boot smoke`);
    assert.match(job, /MAESTRO_VERSION\}/u, `${name} keeps the pinned Maestro guard`);
    // The consumer installs a binary it did not build, so it must prove the binary first.
    assert.match(job, /verify-native-artifact-manifest\.mjs/u, `${name} proves provenance before it installs`);
  }
  // Android: Ubuntu, CNG and the Release APK on x86_64 in the producer; the API 36 google_apis
  // emulator and the boot smoke in the consumer.
  assert.match(androidBuild, /runs-on: ubuntu-latest/u);
  assert.match(androidBuild, /run: npm run prebuild:android --workspace @qandeel\/mobile/u);
  assert.match(androidBuild, /assembleRelease -PreactNativeArchitectures=x86_64/u);
  assert.match(android, /runs-on: ubuntu-latest/u);
  assert.match(android, /api-level: 36/u);
  assert.match(android, /arch: x86_64/u);
  assert.match(android, /target: google_apis/u);
  assert.match(android, /sha256sum --check --strict/u);
  // iOS: macos-26 and Xcode 26.6 throughout; CNG, CocoaPods and the Release simulator build in the
  // producer; the install and the smoke in the consumer.
  assert.match(iosBuild, /runs-on: macos-26/u);
  assert.match(iosBuild, /Xcode_26\.6\.app/u);
  assert.match(iosBuild, /run: npm run prebuild:ios --workspace @qandeel\/mobile/u);
  assert.match(iosBuild, /run: pod install/u);
  assert.match(iosBuild, /-configuration Release -sdk iphonesimulator/u);
  assert.match(ios, /runs-on: macos-26/u);
  assert.match(ios, /Xcode_26\.6\.app/u);
  assert.match(ios, /simctl install/u);
  assert.match(ios, /shasum -a 256 --check --strict/u);
});

test('the native-impact classification is executable, not a YAML regex', () => {
  assert.equal(existsSync(new URL('scripts/classify-mobile-native-impact.mjs', root)), true);
  // A root-package.json-only change is non-native; the three native-impact
  // paths each force native smoke on their own.
  assert.equal(classifyMobileNativeImpact(['package.json']), false);
  assert.equal(classifyMobileNativeImpact(['apps/mobile/package.json']), true);
  assert.equal(classifyMobileNativeImpact(['apps/mobile/src/app/index.tsx']), true);
  assert.equal(classifyMobileNativeImpact(['package-lock.json']), true);
  assert.equal(classifyMobileNativeImpact(['.github/workflows/mobile-ci.yml']), true);
  // A backend/root-script-only set never triggers native smoke...
  assert.equal(
    classifyMobileNativeImpact(['package.json', 'scripts/preflight.mjs', 'tests/mobile-foundation-toolchain-contract.test.mjs', 'apps/api/src/main.ts', 'database/README.md']),
    false,
  );
  // ...and one native path inside it still does.
  assert.equal(classifyMobileNativeImpact(['package.json', 'apps/mobile/app.json']), true);
});
