import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// T-04 — Living Analysis Map: canonical world projection, camera mechanics, inspection and
// context navigation. Static executable contract over the approved boundary.
//
// Semantic behaviour is proven by the Jest suites under apps/mobile/src/map/__tests__ (the
// M04-01…M04-15 adversarial matrix). This gate guards the things a passing unit test cannot:
// the file surface, the single authorized dependency, the exact registry promotion, the
// anti-scope, and that the gate itself is registered in CI.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFile(new URL(path, root), 'utf8');
const readJson = async (path) => JSON.parse(await read(path));

const MAP_DIR = 'apps/mobile/src/map';
const STATE_DIR = 'apps/mobile/src/state';

const PRODUCTION_FILES = [
  'accessibility/MapAccessibilityLayer.tsx',
  'accessibility/index.ts',
  'accessibility/map-accessibility.ts',
  'camera/camera.ts',
  'camera/index.ts',
  'camera/map-camera-actions.ts',
  'camera/pan.ts',
  'camera/useMapPanGesture.ts',
  'camera/viewport.ts',
  'camera/zoom.ts',
  'index.ts',
  'inspection/entitlement.ts',
  'inspection/index.ts',
  'inspection/locatability.ts',
  'inspection/map-actions.ts',
  'outcome.ts',
  'projection/index.ts',
  'projection/map-scene.ts',
  'renderer/MapCanvas.tsx',
  'renderer/MapSurface.tsx',
  'renderer/index.ts',
  'renderer/map-geometry.ts',
  'renderer/render-style.ts',
  'world/exact-math.ts',
  'world/index.ts',
  'world/osdap.ts',
  'world/world-refs.ts',
];

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

const mapSources = Object.fromEntries(
  await Promise.all(PRODUCTION_FILES.map(async (name) => [name, await read(`${MAP_DIR}/${name}`)])),
);
/** Code only: a comment may name a forbidden pattern in order to forbid it. */
const mapCode = Object.fromEntries(Object.entries(mapSources).map(([name, text]) => [name, stripComments(text)]));
const mapText = Object.values(mapCode).join('\n');

const actionsSource = await read(`${STATE_DIR}/actions.ts`);
const actionsCode = stripComments(actionsSource);
const transitionsCode = stripComments(await read(`${STATE_DIR}/transitions.ts`));
const storeCode = stripComments(await read(`${STATE_DIR}/store.ts`));

test('the authorized T-04 file surface is the only production surface of the Map layer', () => {
  const mapDir = join(rootPath, MAP_DIR);
  const production = listFiles(mapDir)
    .map((file) => file.slice(mapDir.length + 1).replace(/\\/g, '/'))
    .filter((file) => !file.startsWith('__tests__/') && !file.startsWith('__fixtures__/'))
    .sort();
  assert.deepEqual(production, [...PRODUCTION_FILES].sort());
  const suites = readdirSync(join(mapDir, '__tests__')).filter((file) => /\.test\.tsx?$/u.test(file));
  assert.ok(suites.length >= 10, `expected the T-04 adversarial suites, found ${suites.length}`);
});

test('the T-01 technical shell stays byte-identical: the Map is not mounted in the app container', async () => {
  const entries = readdirSync(new URL('apps/mobile/src/app/', root)).sort();
  assert.deepEqual(entries, ['_layout.tsx', 'index.tsx']);
  for (const file of ['apps/mobile/src/app/_layout.tsx', 'apps/mobile/src/app/index.tsx', 'apps/mobile/src/shell/FoundationShell.tsx']) {
    const text = await read(file);
    assert.doesNotMatch(text, /map\//u, `${file} must not mount the Map layer in T-04`);
    assert.doesNotMatch(text, /MapSurface|MapCanvas/u, `${file} must not mount the Map layer in T-04`);
  }
});

test('exactly three frozen acts were promoted to executable, by name, and nothing else moved', () => {
  assert.match(actionsCode, /MAP_ACTION_TYPES = Object\.freeze\(\['INSPECT_OBJECT', 'SWITCH_CONTEXT', 'DIRECT_JUMP'\] as const\);/u);
  assert.match(actionsCode, /export type CatalogLevel = 'KERNEL' \| 'EXECUTABLE' \| 'METADATA_ONLY' \| 'NOT_STORE_ACTION';/u);

  const metadataOnly = actionsCode.match(/METADATA_ONLY_ACTION_TYPES = Object\.freeze\(\[([\s\S]*?)\] as const\)/u);
  assert.ok(metadataOnly, 'METADATA_ONLY_ACTION_TYPES must be a literal array');
  assert.deepEqual(
    [...metadataOnly[1].matchAll(/'([A-Z_]+)'/gu)].map((match) => match[1]).sort(),
    ['BACK_ONE_STEP', 'CHOOSE_LOCUS', 'COMMIT_MOMENT_AND_LOCATE', 'EXACT_RETURN', 'GO_LIVE_AND_LOCATE', 'RETURN_LIVE_FOCUS', 'RETURN_LIVE_HEAD', 'RETURN_WORLD'],
  );

  // The store still fails closed for every remaining later-owner act, and the general rule is
  // stated once, over the level, rather than per identity.
  assert.match(storeCode, /if \(entry\.level === 'METADATA_ONLY'\) throw new OwnedByLaterTask\(entry\.id, entry\.owner\);/u);

  // The three promoted acts keep their frozen authority and their frozen transactional category.
  const blocks = [...actionsSource.matchAll(/id: '([A-Z_]+)',[\s\S]*?level: '([A-Z_]+)',[\s\S]*?authority: fields\(([^)]*)\),\n\s*transactional: '([A-Z_]+)'/gu)];
  const entries = Object.fromEntries(blocks.map((match) => [match[1], { level: match[2], authority: match[3], transactional: match[4] }]));
  for (const id of ['INSPECT_OBJECT', 'SWITCH_CONTEXT', 'DIRECT_JUMP']) {
    assert.equal(entries[id].level, 'EXECUTABLE', `${id} must be executable in T-04`);
    assert.equal(entries[id].transactional, 'RH_CHECKPOINT', `${id} keeps its frozen RH behaviour`);
  }
  assert.equal(entries.INSPECT_OBJECT.authority, "'IF_ref'");
  assert.equal(entries.SWITCH_CONTEXT.authority, "'IF_ref'");
  assert.equal(entries.DIRECT_JUMP.authority, "'IF_ref', 'MC.depth', ...SPATIAL");
  assert.match(actionsCode, /const SPATIAL = \['MC\.anchor', 'MC\.orientation', 'MC\.scale', 'MC\.destination'\] as const;/u);
  for (const id of ['PAN', 'ZOOM_SEMANTIC', 'COMMIT_MOMENT', 'COMMIT_LIVE_EDGE']) assert.equal(entries[id].level, 'KERNEL');
  for (const id of ['COMMIT_MOMENT_AND_LOCATE', 'CHOOSE_LOCUS', 'RETURN_LIVE_HEAD', 'RETURN_WORLD', 'EXACT_RETURN', 'BACK_ONE_STEP']) {
    assert.equal(entries[id].level, 'METADATA_ONLY', `${id} is still owned by a later task`);
  }
});

test('the Map transitions write no temporal and no live field, and resolve no entitlement', () => {
  const mapTransitions = transitionsCode.slice(
    transitionsCode.indexOf('const inspectObject'),
    transitionsCode.indexOf('export const MAP_ACTION_TRANSITIONS'),
  );
  assert.ok(mapTransitions.length > 0, 'the three Map transitions must exist in the kernel');
  for (const pattern of [/state\.live/u, /temporal: \{/u, /LiveFocus/u, /sessionPosition/u]) {
    assert.doesNotMatch(mapTransitions, pattern, `the Map transitions must not touch ${String(pattern)}`);
  }
  // Temporal state is carried through unchanged by every Map transition.
  assert.equal((mapTransitions.match(/temporal: state\.temporal/gu) ?? []).length, 3);
  // Entitlement lives in the Map layer, never in the kernel.
  for (const forbidden of ['HistoricalDisclosure', 'disclosure', 'MapScene', 'entitled']) {
    assert.equal(mapTransitions.includes(forbidden), false, `the kernel must not resolve ${forbidden}`);
  }
});

test('the Map layer adds exactly one dependency, and no state, persistence or navigation library', async () => {
  const mobilePackage = await readJson('apps/mobile/package.json');
  assert.equal(mobilePackage.dependencies['@shopify/react-native-skia'], '2.6.2');
  const lock = await readJson('package-lock.json');
  assert.equal(lock.packages['node_modules/@shopify/react-native-skia'].version, '2.6.2');
  assert.equal(lock.packages['apps/mobile'].dependencies['@shopify/react-native-skia'], '2.6.2');
  assert.equal(existsSync(new URL('apps/mobile/package-lock.json', root)), false);

  const specifiers = new Set();
  for (const text of Object.values(mapCode)) {
    for (const match of text.matchAll(/from\s+'([^']+)'/gu)) if (!match[1].startsWith('.')) specifiers.add(match[1]);
    assert.doesNotMatch(text, /require\(/u);
  }
  assert.deepEqual([...specifiers].sort(), ['@qandeel/runtime', '@shopify/react-native-skia', 'react', 'react-native', 'react-native-gesture-handler']);

  for (const name of ['zustand', 'redux', '@reduxjs/toolkit', 'react-redux', 'immer', 'xstate', 'jotai', 'mobx', 'valtio', 'recoil', 'react-native-mmkv', '@react-native-async-storage/async-storage', 'expo-secure-store', 'expo-sqlite', 'react-native-svg', 'react-native-webview']) {
    const copies = Object.keys(lock.packages).filter((key) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`));
    assert.deepEqual(copies, [], `${name} must not be installed`);
  }
});

test('no second navigation store, no generic navigate, no router-as-Product-truth', () => {
  for (const forbidden of ['createCanonicalStore', 'useReducer', 'MAP_FOCUS_OBJECT', "'NAVIGATE'", 'expo-router', 'useRouter', 'router.push', 'router.back', 'usePathname', 'useSegments', '<Link', 'Linking']) {
    assert.equal(mapText.includes(forbidden), false, `the Map layer must not contain ${forbidden}`);
  }
  assert.doesNotMatch(mapText, /export (?:function|const) navigate\b/u);
  // Exactly one dispatch site: the shared outcome helper. Every act goes through it.
  assert.equal((mapText.match(/store\.dispatch\(/gu) ?? []).length, 1);
  assert.match(mapCode['outcome.ts'], /const result = store\.dispatch\(action\);/u);
});

test('no later-task act, no Timeline, no Preview and no temporal write exists in the Map layer', () => {
  for (const forbidden of [
    'COMMIT_MOMENT_AND_LOCATE',
    'CHOOSE_LOCUS',
    'RETURN_LIVE_HEAD',
    'RETURN_LIVE_FOCUS',
    'GO_LIVE_AND_LOCATE',
    'RETURN_WORLD',
    'EXACT_RETURN',
    'BACK_ONE_STEP',
    'PREVIEW_TEMPORAL_TARGET',
    'CANCEL_PREVIEW',
    'COMMIT_MOMENT',
    'COMMIT_LIVE_EDGE',
    'PTC',
    'ingest(',
    'LIVE_HEAD_ADVANCED',
    'LIVE_FOCUS_TRANSITION',
    'bookmark',
    'Bookmark',
  ]) {
    assert.equal(mapText.includes(forbidden), false, `the Map layer must not contain ${forbidden}`);
  }
});

test('canonical world coordinates are exact: no float ever reaches a canonical address', () => {
  assert.match(mapCode['world/osdap.ts'], /OSDAP_MIN_COORD: bigint = -\(2n \*\* 62n\)/u);
  assert.match(mapCode['world/osdap.ts'], /OSDAP_MAX_COORD: bigint = 2n \*\* 62n - 1n/u);
  assert.match(mapCode['world/osdap.ts'], /OSDAP_V1_SCHEME = 'QANDEEL_OSDAP_V1'/u);
  for (const forbidden of ['parseFloat', 'parseInt', 'Math.round(', 'Number(']) {
    assert.equal(mapCode['world/osdap.ts'].includes(forbidden), false, `osdap.ts must not use ${forbidden}`);
  }
  // The canonical address type is bigint, and the wire text is never widened to a number.
  assert.match(mapCode['world/osdap.ts'], /readonly x: bigint;/u);
  assert.match(mapCode['world/osdap.ts'], /readonly y: bigint;/u);
});

test('the presentation envelope is Class D: it cannot be expressed in canonical camera intent', () => {
  for (const forbidden of ['width', 'height', 'aspect', 'inset', 'footprint', 'viewport', 'pixelRatio']) {
    const pattern = new RegExp(`(^|[^A-Za-z_])${forbidden}(?![A-Za-z_])`, 'iu');
    assert.doesNotMatch(mapCode['world/world-refs.ts'], pattern, `the opaque ref encodings must not carry ${forbidden}`);
  }
  // Placement and the accessible tree never see the OPEN-17 channels.
  for (const file of ['projection/map-scene.ts', 'renderer/map-geometry.ts', 'accessibility/map-accessibility.ts', 'inspection/entitlement.ts', 'inspection/locatability.ts']) {
    assert.equal(mapCode[file].includes('RenderStyle'), false, `${file} must not take a RenderStyle`);
  }
  assert.match(mapCode['renderer/render-style.ts'], /RENDER_STYLE_CHANNELS = Object\.freeze\(\['ambient', 'emptySpace'\] as const\)/u);
  const channels = mapCode['renderer/render-style.ts'].match(/readonly (\w+): number;/gu) ?? [];
  assert.equal(channels.length, 2, 'exactly two OPEN-17 channels may exist');
});

test('the Map derives from the disclosed projection only: no raw truth, no second query', () => {
  assert.match(mapCode['projection/map-scene.ts'], /import type \{[\s\S]*?HistoricalDisclosure/u);
  // The Map never queries anything itself: it reads a disclosure the projection boundary already
  // fetched and validated. (`K(TC)` names raw truth in a refusal message; naming it is the point.)
  for (const forbidden of ['fetch(', 'HistoricalProjectionApiClient', 'HistoricalDisclosureCache', 'supabase', 'axios', 'XMLHttpRequest']) {
    assert.equal(mapText.includes(forbidden), false, `the Map layer must not contain ${forbidden}`);
  }
});

test('no credential or public runtime secret in the Map layer', () => {
  for (const [name, text] of Object.entries(mapSources)) {
    assert.doesNotMatch(
      text,
      /(?:ANTHROPIC|OPENAI|GOOGLE_AI|SUPABASE_SERVICE_ROLE)_(?:API_)?KEY|SUPABASE_PUBLISHABLE_KEY|EXPO_PUBLIC_|sk-ant-/u,
      `${name} references a credential or public runtime secret`,
    );
  }
});

test('the T-04 gate is registered at the root and in Mobile CI without a new native job', async () => {
  const rootPackage = await readJson('package.json');
  assert.equal(rootPackage.scripts['test:living-analysis-map-runtime-contract'], 'node --test tests/living-analysis-map-runtime-contract.test.mjs');
  const mobileCi = await read('.github/workflows/mobile-ci.yml');
  assert.match(mobileCi, /run: npm run test:living-analysis-map-runtime-contract/u);
  assert.match(mobileCi, /'tests\/living-analysis-map-runtime-contract\.test\.mjs'/u);
  // The native set is unchanged: exactly the fast gate plus Android and iOS, both still gated.
  assert.equal((mobileCi.match(/runs-on: /gu) ?? []).length, 3, 'no job beyond the fast gate and the two native jobs');
  assert.equal((mobileCi.match(/runs-on: macos-26/gu) ?? []).length, 1);
  assert.equal((mobileCi.match(/if: needs\.verify-mobile-contracts\.outputs\.native_impact == 'true'/gu) ?? []).length, 2);
  assert.equal(existsSync(new URL('docs/living-analysis-map-runtime-v1.md', root)), true);
});

test('no generated native project or dangerous mod entered the tree', async () => {
  for (const [name, text] of Object.entries(mapSources)) {
    assert.doesNotMatch(text, /withDangerousMod/u, `${name} uses a Level-4 dangerous mod`);
  }
  const appConfig = await readJson('apps/mobile/app.json');
  // Skia needs no config plugin on this SDK line; the plugin list is unchanged.
  assert.deepEqual(appConfig.expo.plugins, ['expo-router']);
  assert.equal(existsSync(new URL('apps/mobile/ios', root)), false);
  assert.equal(existsSync(new URL('apps/mobile/android', root)), false);
});
