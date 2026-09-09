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

  // T-06 re-anchor: `COMMIT_MOMENT_AND_LOCATE` and `CHOOSE_LOCUS` left the later-owner set when
  // T-06 landed their substrate. T-07 re-anchor: the six return identities left it too, behind their
  // OWN runtime authority, so the set is now empty. The T-04 guarantee is unweakened and is stated
  // positively instead: the Map family is EXACTLY its three acts, every other promoted identity
  // belongs to a different family, and the fail-closed rule over the later-owner LEVEL still exists
  // for the next frozen act registered at it.
  const metadataOnly = actionsCode.match(/METADATA_ONLY_ACTION_TYPES = Object\.freeze\(\[([\s\S]*?)\] as const\)/u);
  assert.ok(metadataOnly, 'METADATA_ONLY_ACTION_TYPES must be a literal array');
  assert.deepEqual([...metadataOnly[1].matchAll(/'([A-Z_]+)'/gu)].map((match) => match[1]), [], 'the later-owner set is empty');
  assert.match(actionsCode, /TEMPORAL_ACTION_TYPES = Object\.freeze\(\['COMMIT_MOMENT_AND_LOCATE', 'CHOOSE_LOCUS'\] as const\);/u);
  const returnTypes = actionsCode.match(/RETURN_ACTION_TYPES = Object\.freeze\(\[([\s\S]*?)\] as const\)/u);
  assert.ok(returnTypes, 'RETURN_ACTION_TYPES must be a literal array');
  assert.deepEqual(
    [...returnTypes[1].matchAll(/'([A-Z_]+)'/gu)].map((match) => match[1]).sort(),
    ['BACK_ONE_STEP', 'EXACT_RETURN', 'GO_LIVE_AND_LOCATE', 'RETURN_LIVE_FOCUS', 'RETURN_LIVE_HEAD', 'RETURN_WORLD'],
  );

  // The general rule is still stated once, over the level, rather than per identity.
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
  // T-07 re-anchor: the six return identities are exactly the return family, still owned by T-07,
  // and still unreachable from the Map seam and from raw dispatch — a strictly stronger statement
  // than the level alone, and the guarantee the T-04 gate actually exists to protect.
  for (const id of ['RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'GO_LIVE_AND_LOCATE', 'RETURN_WORLD', 'EXACT_RETURN', 'BACK_ONE_STEP']) {
    assert.match(actionsSource, new RegExp(`id: '${id}',[\\s\\S]*?owner: 'T-07',`, 'u'), `${id} is still owned by T-07`);
    assert.equal(mapText.includes(id), false, `${id} must not be reachable from the Map layer`);
  }
  assert.match(storeCode, /if \(!isMapActionType\(entry\.id\)\) \{\s*\n\s*throw new UnauthorizedActionClass\(/u);
  assert.match(storeCode, /if \(isReturnActionType\(entry\.id\)\) \{\s*\n\s*throw new UnauthorizedReturnAction\(/u);
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

  // `expo-sqlite` left this denylist under T-12P §2.4 (authentication session store only). The
  // T-04 invariant is unaffected and still exactly proven by the import census above: the Map
  // layer may import only @qandeel/runtime, Skia, react, react-native and Gesture Handler.
  for (const name of ['zustand', 'redux', '@reduxjs/toolkit', 'react-redux', 'immer', 'xstate', 'jotai', 'mobx', 'valtio', 'recoil', 'react-native-mmkv', '@react-native-async-storage/async-storage', 'expo-secure-store', 'react-native-svg', 'react-native-webview']) {
    const copies = Object.keys(lock.packages).filter((key) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`));
    assert.deepEqual(copies, [], `${name} must not be installed`);
  }
});

test('no second navigation store, no generic navigate, no router-as-Product-truth', () => {
  for (const forbidden of ['createCanonicalStore', 'useReducer', 'MAP_FOCUS_OBJECT', "'NAVIGATE'", 'expo-router', 'useRouter', 'router.push', 'router.back', 'usePathname', 'useSegments', '<Link', 'Linking']) {
    assert.equal(mapText.includes(forbidden), false, `the Map layer must not contain ${forbidden}`);
  }
  assert.doesNotMatch(mapText, /export (?:function|const) navigate\b/u);
  // Exactly one place reaches each canonical entry point, and both are the shared outcome helper.
  assert.equal((mapText.match(/store\.dispatch\(/gu) ?? []).length, 1);
  assert.equal((mapText.match(/store\.dispatchMap\(/gu) ?? []).length, 1);
  assert.match(mapCode['outcome.ts'], /export function dispatchKernelAction\(store: CanonicalStore, action: KernelAction\)/u);
  assert.match(mapCode['outcome.ts'], /export function dispatchAuthorizedMapAction\(/u);
});

// R1-01 — the Map act entitlement authority. The public raw dispatch surface must not be able to
// reach a Map transition, and the minting side of the authority must not be reachable at all.
test('R1-01 — a promoted Map act reaches canonical state only through an authorized seam', () => {
  // The kernel splits the two entry points and refuses a Map act on the raw one.
  assert.match(storeCode, /dispatch\(action: KernelAction\): DispatchResult;/u);
  assert.match(storeCode, /dispatchMap\(action: MapAction\): DispatchResult;/u);
  // T-06 re-anchor: the EXECUTABLE branch of the raw dispatch surface still ALWAYS throws, and it
  // now names which boundary was crossed. Both refusals are pinned, and the branch is proven to
  // contain nothing but refusals, so no promoted act of any family can fall through it.
  const executableBranch = storeCode.slice(
    storeCode.indexOf("if (entry.level === 'EXECUTABLE') {"),
    storeCode.indexOf('return runTransaction(action, entry);\n  }\n\n  function dispatchMap'),
  );
  assert.ok(executableBranch.length > 0, 'the raw dispatch surface refuses every promoted act');
  assert.match(executableBranch, /throw new UnauthorizedMapAction\(entry\.id, 'a Map act reaches canonical state only through the authorized Map seam'\)/u);
  assert.match(executableBranch, /throw new UnauthorizedTemporalAction\(/u);
  // T-07 re-anchor: a third promoted family means a third refusal in this branch. The guarantee is
  // unweakened and strictly more specific — the branch still does NOTHING but refuse, and now names
  // one boundary per promoted family, so no act of any family can fall through it.
  assert.match(executableBranch, /throw new UnauthorizedReturnAction\(/u);
  assert.equal((executableBranch.match(/\bthrow new\b/gu) ?? []).length, 3, 'the EXECUTABLE branch does nothing but refuse, once per promoted family');
  assert.doesNotMatch(executableBranch, /runTransaction/u, 'no promoted act ever runs on the raw dispatch surface');
  // The Map seam consults an authority it cannot mint from, and fails closed without one.
  assert.match(storeCode, /if \(mapActionAuthority === undefined\) \{\s*\n\s*throw new UnauthorizedMapAction\(/u);
  assert.match(storeCode, /if \(mapActionAuthority\.consume\(action\) !== true\) \{\s*\n\s*throw new UnauthorizedMapAction\(/u);
  // T-06 re-anchor: the Map seam now admits by FAMILY, not merely by level, so the neighbouring
  // promoted family is refused by identity before any authority is consulted.
  assert.match(storeCode, /if \(!isMapActionType\(entry\.id\)\) \{\s*\n\s*throw new UnauthorizedActionClass\(/u);
  // The kernel neither reads `V` nor re-implements an entitlement rule.
  const authorityInterface = storeCode.slice(storeCode.indexOf('export interface MapActionAuthority'), storeCode.indexOf('export interface TemporalActionAuthority'));
  assert.ok(authorityInterface.length > 0, 'the MapActionAuthority interface exists');
  assert.match(authorityInterface, /consume\(action: MapAction\): boolean;/u);
  assert.equal((authorityInterface.match(/^\s{2}\w+\(/gmu) ?? []).length, 1, 'the authority exposes exactly one member: it can answer, never mint');
  for (const forbidden of ['Disclosed', 'HistoricalDisclosure', 'entitle', 'Entitle', 'MapScene', 'resolveEntitled']) {
    assert.equal(storeCode.includes(forbidden), false, `the kernel must not learn ${forbidden}`);
  }

  // The minting side is module-local to the executors: declared once, exported nowhere.
  const executors = mapCode['inspection/map-actions.ts'];
  assert.match(executors, /const authorized = new WeakSet<MapAction>\(\);/u);
  assert.match(
    executors,
    /^function authorizeIfProjectionCurrent<A extends MapAction>\(/mu,
    'the mint is a module-local function declaration',
  );
  assert.doesNotMatch(executors, /export (?:function|const) authorizeIfProjectionCurrent\b/u);
  assert.doesNotMatch(executors, /export \{[^}]*\bauthorizeIfProjectionCurrent\b/u);
  assert.equal((executors.match(/authorized\.add\(/gu) ?? []).length, 1, 'exactly one place adds an authorization');
  assert.equal(
    (executors.match(/\bauthorizeIfProjectionCurrent\(/gu) ?? []).length,
    3,
    'exactly the three promoted acts are minted, and nothing else',
  );
  // The authorization is consumed on use, so a granted act cannot be replayed.
  assert.match(executors, /authorized\.delete\(action\);/u);
  // The mint is never re-exported, so no caller outside this module can authorize an act.
  for (const [name, text] of Object.entries(mapCode)) {
    if (name === 'inspection/map-actions.ts') continue;
    assert.equal(/\bauthorizeIfProjectionCurrent\b/u.test(text), false, `${name} must not reference the minting function`);
  }
  assert.match(mapCode['inspection/index.ts'], /MAP_ACTION_AUTHORITY/u, 'only the verifier crosses the module boundary');

  // The authority is object identity in a WeakSet, never a flag, a string token or a type brand.
  for (const forbidden of ['authorized: true', 'as MapActionAuthority', 'unique symbol']) {
    assert.equal(executors.includes(forbidden), false, `the authority must not rest on ${forbidden}`);
  }
});

// R2-01 — the stale-`V` firewall. A disclosed projection is authority for exactly the canonical
// tuple it was disclosed for, and the rule that says so exists exactly once.
test('R2-01 — one shared freshness rule guards every render, hit, accessibility and act boundary', () => {
  const scene = mapCode['projection/map-scene.ts'];

  // THE rule: exactly one place compares a tuple against the store's current projection request.
  assert.match(scene, /export function projectionTupleFreshness\(state: CanonicalState, tuple: DisclosedProjectionTuple\): MapProjectionFreshness \{/u);
  assert.match(scene, /export function mapContextFreshness\(state: CanonicalState, context: DisclosedProjectionContext\): MapProjectionFreshness \{/u);
  assert.equal(
    (scene.match(/mapProjectionRequest\(state\)/gu) ?? []).length,
    1,
    'the current projection request is read in exactly one place: the shared rule',
  );
  for (const field of ['sessionId', 'tc', 'depth']) {
    assert.match(scene, new RegExp(`tuple\\.${field} !== request\\.${field}`, 'u'), `the rule compares ${field}`);
  }
  // The context form adds the one check a tuple cannot make, and then delegates to the same rule.
  assert.match(scene, /return projectionTupleFreshness\(state, \{ sessionId: scene\.sessionId, tc: scene\.tc, depth: scene\.depth \}\);/u);
  assert.match(scene, /CONTEXT_INCOHERENT/u);

  // Nobody re-implements it. Every consumer calls the shared rule (directly or through the one
  // context adapter), and no second comparison against the current request exists anywhere.
  for (const [name, text] of Object.entries(mapCode)) {
    if (name === 'projection/map-scene.ts') continue;
    assert.equal(text.includes('mapProjectionRequest(store.getState())'), false, `${name} must not re-derive the current request`);
    assert.doesNotMatch(text, /scene\.depth !== \w+\.depth|scene\.tc !== \w+\.tc/u, `${name} must not re-implement the freshness comparison`);
  }
  assert.match(mapCode['inspection/map-actions.ts'], /export function isCurrentMapContext\(store: CanonicalStore, context: MapInspectionContext\)/u);
  assert.match(mapCode['inspection/map-actions.ts'], /return mapContextFreshness\(store\.getState\(\), context\);/u);

  // Action side: every promoted act proves freshness, and the mint itself cannot run without it.
  const executors = mapCode['inspection/map-actions.ts'];
  assert.match(executors, /const freshness = projectionTupleFreshness\(store\.getState\(\), tuple\);\s*\n\s*if \(!freshness\.fresh\) \{/u);
  assert.equal((executors.match(/staleOutcome\(store, context\)/gu) ?? []).length, 3, 'inspect, switch and direct jump each check the context');
  // The entitlement carries the tuple it was minted from, so a context-free shortcut is covered.
  assert.match(mapCode['inspection/entitlement.ts'], /readonly projection: DisclosedProjectionTuple;/u);
  assert.match(mapCode['inspection/entitlement.ts'], /projection: Object\.freeze\(\{ sessionId: disclosure\.sessionId, tc: disclosure\.tc, depth: disclosure\.depth \}\)/u);

  // Surface side: both store-aware surfaces subscribe to canonical state, not the camera alone.
  for (const file of ['renderer/MapSurface.tsx', 'accessibility/MapAccessibilityLayer.tsx']) {
    assert.match(mapCode[file], /useSyncExternalStore\(store\.subscribe, store\.getState\)/u, `${file} subscribes to canonical state`);
    assert.match(mapCode[file], /mapContextFreshness\(state, context\)/u, `${file} asks the shared rule`);
  }
  // A stale scene is never placed, never hit-tested and never announced.
  assert.match(mapCode['renderer/MapSurface.tsx'], /const usable = camera !== null && freshness\.fresh;/u);
  assert.match(mapCode['renderer/MapSurface.tsx'], /usable && camera !== null \? placeScene\(/u);
  // R2-FIX-01 — a stale projection produces no scene-derived tree at all, so the container's role
  // and label cannot leak disclosure semantics either. `buildMapAccessibilityTree` is the only
  // scene-reading builder, and it is reachable only on the fresh branch.
  const layer = mapCode['accessibility/MapAccessibilityLayer.tsx'];
  assert.match(layer, /freshness\.fresh \? buildMapAccessibilityTree\(context\.scene, camera, envelope, focus\) : mapAccessibilityWithoutProjection\(\)/u);
  assert.equal((layer.match(/buildMapAccessibilityTree\(/gu) ?? []).length, 1, 'the scene-reading builder is called in exactly one place');
  assert.doesNotMatch(layer, /context\.scene\./u, 'the layer never reads the scene outside the fresh branch');
  const neutral = mapCode['accessibility/map-accessibility.ts'].slice(
    mapCode['accessibility/map-accessibility.ts'].indexOf('export function mapAccessibilityWithoutProjection'),
    mapCode['accessibility/map-accessibility.ts'].indexOf('export function buildMapAccessibilityTree'),
  );
  assert.ok(neutral.length > 0, 'the no-projection tree exists');
  assert.match(neutral, /containerRole: 'none'/u);
  assert.match(neutral, /containerLabel: MAP_CONTAINER_NEUTRAL_LABEL/u);
  assert.match(neutral, /nodes: Object\.freeze\(\[\]\)/u);
  for (const forbidden of ['scene', 'depth', 'MapScene', 'disclosed']) {
    assert.equal(neutral.includes(forbidden), false, `the no-projection tree must not derive ${forbidden}`);
  }
  assert.match(mapCode['accessibility/map-accessibility.ts'], /MAP_CONTAINER_NEUTRAL_LABEL = 'Living Analysis Map';/u);
  // No stale fallback of any kind.
  for (const forbidden of ['opacity: 0', 'fallbackScene', 'previousScene', 'lastScene', 'cachedScene']) {
    assert.equal(mapText.includes(forbidden), false, `a stale projection must not survive as ${forbidden}`);
  }
  // The canonical store learns nothing about projections: no V, no MapScene, no third cursor.
  for (const forbidden of ['MapScene', 'Disclosed', 'freshness', 'projectionTuple']) {
    assert.equal(storeCode.includes(forbidden), false, `the kernel must not learn ${forbidden}`);
  }
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
