import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// T-02 — Canonical Client State + Action Foundation: static executable contract.
// Guards the approved boundary (Pre-Flight Report v2 + Targeted Revision R1 + Execution Authorization v1).
// Semantic behaviour is proven by the Jest suites under apps/mobile/src/state/__tests__.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFile(new URL(path, root), 'utf8');
const readJson = async (path) => JSON.parse(await read(path));

const STATE_DIR = 'apps/mobile/src/state';
const PRODUCTION_FILES = [
  'classes.ts',
  'actions.ts',
  'authority.ts',
  'transitions.ts',
  'history.ts',
  'selectors.ts',
  'store.ts',
  'CanonicalStateProvider.tsx',
  'index.ts',
];

function gitBlobId(content) {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');

const productionSources = Object.fromEntries(
  await Promise.all(PRODUCTION_FILES.map(async (name) => [name, await read(`${STATE_DIR}/${name}`)])),
);
/** Code only: comments may name a forbidden pattern in order to forbid it. */
const productionCode = Object.fromEntries(Object.entries(productionSources).map(([name, text]) => [name, stripComments(text)]));
const productionText = Object.values(productionCode).join('\n');

test('the authorized T-02 file surface exists and is the only production surface of the state layer', () => {
  for (const name of PRODUCTION_FILES) {
    assert.equal(existsSync(new URL(`${STATE_DIR}/${name}`, root)), true, `missing ${STATE_DIR}/${name}`);
  }
  const stateDir = join(rootPath, STATE_DIR);
  const production = listFiles(stateDir)
    .filter((file) => !file.includes(`${join(stateDir, '__tests__')}`))
    .map((file) => file.slice(stateDir.length + 1).replace(/\\/g, '/'))
    .sort();
  assert.deepEqual(production, [...PRODUCTION_FILES].sort());
  const tests = readdirSync(join(stateDir, '__tests__')).filter((file) => /\.test\.tsx?$/u.test(file));
  assert.ok(tests.length >= 9, `expected the nine T-02 suites, found ${tests.length}`);
});

test('the T-01 technical shell is byte-identical and does not mount the state layer', async () => {
  const entries = readdirSync(new URL('apps/mobile/src/app/', root)).sort();
  assert.deepEqual(entries, ['_layout.tsx', 'index.tsx']);
  assert.equal(gitBlobId(await read('apps/mobile/src/app/_layout.tsx')), '90179f6d13026e9b0e2345e0418012214b9c9aab');
  assert.equal(gitBlobId(await read('apps/mobile/src/app/index.tsx')), 'ef38d10c76a957163bf00f7b7b60fb8aa25841f4');
  assert.equal(gitBlobId(await read('apps/mobile/src/shell/FoundationShell.tsx')), 'e2286ba1a35c2e40def475af5deed2d8ba8120d3');
  for (const file of ['apps/mobile/src/app/_layout.tsx', 'apps/mobile/src/app/index.tsx', 'apps/mobile/src/shell/FoundationShell.tsx']) {
    const text = await read(file);
    assert.doesNotMatch(text, /state\//u, `${file} must not import the canonical state layer in T-02`);
    assert.doesNotMatch(text, /CanonicalState/u, `${file} must not mount the canonical state layer in T-02`);
  }
});

test('Expo Router owns no Product navigation truth in the state layer', () => {
  for (const [name, text] of Object.entries(productionCode)) {
    for (const forbidden of ['expo-router', 'router.push', 'router.back', 'useRouter', 'usePathname', 'useSegments', '<Link', 'navigate(', 'Linking']) {
      assert.equal(text.includes(forbidden), false, `${name} must not reference ${forbidden}`);
    }
  }
});

test('the state layer adds no dependency: its only external import is react', () => {
  for (const [name, text] of Object.entries(productionCode)) {
    const imports = [...text.matchAll(/from\s+'([^']+)'/gu)].map((match) => match[1]);
    for (const specifier of imports) {
      if (specifier.startsWith('.')) continue;
      assert.equal(specifier, 'react', `${name} imports ${specifier}; only react and relative modules are allowed`);
    }
    assert.doesNotMatch(text, /require\(/u, `${name} must not use require()`);
  }
});

test('no generic navigation identity, focus-traversal action or generic authoritative event exists', () => {
  for (const forbidden of [
    "'NAVIGATE'",
    "'RESET'",
    "'HOME'",
    "'GO_LIVE'",
    "'MAP_FOCUS_OBJECT'",
    'WORLD_TRUTH',
    "'INVALIDATE'",
    "'REFRESH'",
    "'SYNC_ALL'",
    "'RESET_FROM_SERVER'",
    'FOCUS_MOVED',
  ]) {
    assert.equal(productionText.includes(forbidden), false, `production state layer must not contain ${forbidden}`);
  }
});

test('the closed event catalog and the per-identity authority follow the Execution Authorization', () => {
  const actions = productionSources['actions.ts'];
  const eventTypes = actions.match(/AUTHORITATIVE_EVENT_TYPES = \[([^\]]*)\]/u);
  assert.ok(eventTypes, 'AUTHORITATIVE_EVENT_TYPES must be a literal array');
  assert.deepEqual(
    [...eventTypes[1].matchAll(/'([A-Z_]+)'/gu)].map((match) => match[1]),
    ['LIVE_HEAD_ADVANCED', 'LIVE_FOCUS_TRANSITION'],
  );

  const blocks = [...actions.matchAll(/id: '([A-Z_]+)',[\s\S]*?authority: fields\(([^)]*)\)/gu)];
  assert.ok(blocks.length >= 27, `expected every registry entry to declare authority, found ${blocks.length}`);
  const authority = Object.fromEntries(
    blocks.map((match) => [match[1], [...match[2].matchAll(/'([A-Za-z_.]+)'/gu)].map((inner) => inner[1]).sort()]),
  );
  for (const [id, fields] of Object.entries(authority)) {
    if (id === 'LIVE_HEAD_ADVANCED') assert.deepEqual(fields, ['LH']);
    else if (id === 'LIVE_FOCUS_TRANSITION') assert.deepEqual(fields, ['LF']);
    else {
      assert.equal(fields.includes('LH'), false, `${id} must not hold LH authority`);
      assert.equal(fields.includes('LF'), false, `${id} must not hold LF authority`);
    }
  }
  assert.deepEqual(authority.PAN, ['MC.anchor', 'MC.destination']);
  assert.deepEqual(authority.ZOOM_SEMANTIC, ['MC.anchor', 'MC.depth', 'MC.scale']);
  assert.deepEqual(authority.COMMIT_MOMENT, ['TM']);
  assert.deepEqual(authority.COMMIT_LIVE_EDGE, ['TM']);
  assert.match(actions, /'ANALYTICAL_OBJECT'|SemanticDepth/u);
});

test('the semantic depth rungs are the frozen five and no envelope geometry enters Class A', () => {
  const classes = productionCode['classes.ts'];
  assert.match(classes, /SEMANTIC_DEPTHS = \['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'\]/u);
  for (const forbidden of ['width', 'height', 'aspect', 'footprint', 'viewport', 'clipping', 'READING', 'MATERIAL', 'UNKNOWN']) {
    const pattern = new RegExp(`(^|[^A-Za-z_])${forbidden}(?![A-Za-z_])`, 'u');
    assert.doesNotMatch(classes, pattern, `classes.ts must not encode ${forbidden} in Class A`);
  }
});

test('no persistence, no state library and no dependency change', async () => {
  const mobilePackage = await readJson('apps/mobile/package.json');
  assert.deepEqual(Object.keys(mobilePackage.dependencies).sort(), [
    'expo',
    'expo-constants',
    'expo-dev-client',
    'expo-linking',
    'expo-router',
    'expo-status-bar',
    'react',
    'react-native',
    'react-native-gesture-handler',
    'react-native-reanimated',
    'react-native-safe-area-context',
    'react-native-screens',
    'react-native-worklets',
  ]);
  const lock = await readJson('package-lock.json');
  for (const name of [
    'zustand',
    'redux',
    '@reduxjs/toolkit',
    'react-redux',
    'immer',
    'xstate',
    'jotai',
    'mobx',
    'valtio',
    '@legendapp/state',
    'use-sync-external-store',
    'recoil',
    'react-native-mmkv',
    '@react-native-async-storage/async-storage',
    'expo-secure-store',
    'expo-sqlite',
  ]) {
    const copies = Object.keys(lock.packages).filter((key) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`));
    assert.deepEqual(copies, [], `${name} must not be installed`);
  }
  for (const forbidden of ['AsyncStorage', 'SecureStore', 'MMKV', 'SQLite', 'FileSystem', 'localStorage', 'persist(']) {
    assert.equal(productionText.includes(forbidden), false, `state layer must not reference ${forbidden}`);
  }
  assert.equal(existsSync(new URL('apps/mobile/package-lock.json', root)), false);
});

test('no credential or public runtime secret in the state layer', () => {
  for (const [name, text] of Object.entries(productionSources)) {
    assert.equal(typeof text, 'string');
    assert.doesNotMatch(
      text,
      /(?:ANTHROPIC|OPENAI|GOOGLE_AI|SUPABASE_SERVICE_ROLE)_(?:API_)?KEY|SUPABASE_PUBLISHABLE_KEY|EXPO_PUBLIC_|sk-ant-/u,
      `${name} references a credential or public runtime secret`,
    );
  }
});

test('the T-02 gate is registered at the root and in Mobile CI without a new native job', async () => {
  const rootPackage = await readJson('package.json');
  assert.equal(rootPackage.scripts['test:mobile-canonical-state-contract'], 'node --test tests/mobile-canonical-state-contract.test.mjs');
  const mobileCi = await read('.github/workflows/mobile-ci.yml');
  assert.match(mobileCi, /run: npm run test:mobile-canonical-state-contract/u);
  assert.match(mobileCi, /'tests\/mobile-canonical-state-contract\.test\.mjs'/u);
  assert.equal((mobileCi.match(/node-version: '\d+'/gu) ?? []).length, 2, 'no mobile job may be added or removed');
  assert.equal((mobileCi.match(/runs-on: /gu) ?? []).length, 2, 'no new job');
  const readme = await read('apps/mobile/README.md');
  assert.match(readme, /Canonical state kernel \(T-02\)/u);
});
