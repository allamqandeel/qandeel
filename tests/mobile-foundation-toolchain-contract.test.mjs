import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

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
  expo: '~57.0.19',
  'expo-constants': '~57.0.17',
  'expo-dev-client': '~57.0.18',
  'expo-linking': '~57.0.9',
  'expo-router': '~57.0.18',
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
  assert.equal(expo.name, 'Qandeel');
  assert.equal(expo.slug, 'qandeel');
  assert.equal(expo.scheme, 'qandeel');
  assert.equal(expo.ios.bundleIdentifier, 'com.qandeel.mobile');
  assert.equal(expo.android.package, 'com.qandeel.mobile');
  assert.deepEqual(expo.platforms, ['ios', 'android']);
  assert.deepEqual(expo.plugins, ['expo-router']);
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
  for (const file of tracked) {
    const text = await read(file);
    assert.doesNotMatch(text, /withDangerousMod/u, `${file} uses a Level-4 dangerous mod`);
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
  assert.equal(nodeVersions.length, 2, 'both mobile jobs must set up Node explicitly');
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
