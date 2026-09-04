import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  classifyChangedFiles,
  classifyMobileNativeImpact,
  isNativeImpactPath,
  normalizePath,
} from '../scripts/classify-mobile-native-impact.mjs';

// MOB-CI-01 - the native-impact classifier decides whether an expensive Android
// Release + emulator smoke and iOS Release + simulator smoke must run. It is
// tested directly rather than through YAML regexes.

const SCRIPT = fileURLToPath(new URL('../scripts/classify-mobile-native-impact.mjs', import.meta.url));
const runCli = (files) =>
  execFileSync(process.execPath, [SCRIPT, ...files], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

test('a root package.json-only change is NOT native impact', () => {
  assert.equal(classifyMobileNativeImpact(['package.json']), false);
  assert.equal(classifyChangedFiles(['package.json']).nativeImpact, false);
  assert.equal(runCli(['package.json']), 'false');
});

test('any apps/mobile change IS native impact', () => {
  for (const file of [
    'apps/mobile/package.json',
    'apps/mobile/app.json',
    'apps/mobile/src/app/index.tsx',
    'apps/mobile/.maestro/boot-smoke.yaml',
    'apps/mobile/README.md',
  ]) {
    assert.equal(isNativeImpactPath(file), true, `${file} must be native impact`);
    assert.equal(classifyMobileNativeImpact([file]), true, `${file} must be native impact`);
  }
  assert.equal(runCli(['apps/mobile/src/app/index.tsx']), 'true');
});

test('package-lock.json IS native impact', () => {
  assert.equal(classifyMobileNativeImpact(['package-lock.json']), true);
  assert.equal(runCli(['package-lock.json']), 'true');
  // A dependency edit normally moves the lockfile, so dependency changes always
  // force native smoke.
  assert.equal(classifyMobileNativeImpact(['apps/mobile/package.json', 'package-lock.json']), true);
});

test('the mobile CI workflow itself IS native impact', () => {
  assert.equal(classifyMobileNativeImpact(['.github/workflows/mobile-ci.yml']), true);
  assert.equal(runCli(['.github/workflows/mobile-ci.yml']), 'true');
  // The API workflow is not the native gate.
  assert.equal(classifyMobileNativeImpact(['.github/workflows/api-ci.yml']), false);
});

test('a backend / root-script-only change set stays non-native', () => {
  const changed = [
    'package.json',
    'scripts/preflight.mjs',
    'scripts/classify-mobile-native-impact.mjs',
    'tests/mobile-foundation-toolchain-contract.test.mjs',
    'tests/mobile-canonical-state-contract.test.mjs',
    'apps/api/src/conversation-unit/conversation-unit.types.ts',
    'database/migrations/0064_committed_conversational_unit_substrate_v1.sql',
    'docs/committed-conversational-unit-substrate-v1.md',
    'README.md',
  ];
  const result = classifyChangedFiles(changed);
  assert.equal(result.nativeImpact, false);
  assert.equal(result.reason, 'NO_NATIVE_IMPACT_PATH_CHANGED');
  assert.deepEqual(result.matched, []);
  assert.equal(runCli(changed), 'false');
});

test('one native path inside a large non-native set still forces native smoke', () => {
  const changed = ['package.json', 'docs/a.md', 'apps/api/src/x.ts', 'apps/mobile/app.json', 'README.md'];
  const result = classifyChangedFiles(changed);
  assert.equal(result.nativeImpact, true);
  assert.deepEqual(result.matched, ['apps/mobile/app.json']);
});

test('an unestablished or empty change set fails SAFE to native impact', () => {
  for (const input of [[], ['', '   '], undefined, null, 'not-an-array']) {
    const result = classifyChangedFiles(input);
    assert.equal(result.nativeImpact, true, `${JSON.stringify(input)} must fail safe`);
    assert.equal(result.reason, 'FAIL_SAFE_EMPTY_CHANGE_SET');
  }
  assert.equal(classifyMobileNativeImpact('not-an-array'), true, 'a non-list input never claims safety');
  assert.equal(runCli([]).length > 0, true);
});

test('paths are normalized before matching so no separator or prefix can evade the gate', () => {
  assert.equal(normalizePath('./apps/mobile/app.json'), 'apps/mobile/app.json');
  assert.equal(normalizePath('apps\\mobile\\app.json'), 'apps/mobile/app.json');
  assert.equal(isNativeImpactPath('  ./apps/mobile/app.json  '), true);
  assert.equal(isNativeImpactPath('apps\\mobile\\src\\app\\index.tsx'), true);
  // A lookalike outside the workspace is not native impact.
  assert.equal(isNativeImpactPath('apps/mobile-docs/readme.md'), false);
  assert.equal(isNativeImpactPath('docs/package-lock.json'), false);
});

test('the classifier is deterministic and dependency-free', async () => {
  const source = await import('node:fs').then(({ readFileSync }) => readFileSync(SCRIPT, 'utf8'));
  const imports = [...source.matchAll(/^import .*? from '([^']+)';$/gmu)].map((match) => match[1]);
  assert.deepEqual([...new Set(imports)].sort(), ['node:fs', 'node:process'], 'only Node builtins may be imported');
  const first = classifyChangedFiles(['package.json', 'apps/mobile/app.json']);
  const second = classifyChangedFiles(['package.json', 'apps/mobile/app.json']);
  assert.deepEqual(first, second);
});
