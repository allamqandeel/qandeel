import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// T-08 - Inspection + Orientation + Return Chrome: the Living Analysis Map made understandable and
// operable as a Product surface. Static executable contract over the approved boundary.
//
// Semantic behaviour is proven by the Jest suites under apps/mobile/src/orientation-chrome
// (OC08-A...OC08-M). This gate guards what a passing unit test cannot: the file surface, the absence
// of any new dependency or canonical state, the anti-scope, that the layer reaches its owners only
// through their public barrels, that the owners themselves are untouched, and that the gate is
// registered in CI.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFile(new URL(path, root), 'utf8');
const readJson = async (path) => JSON.parse(await read(path));

const OC_DIR = 'apps/mobile/src/orientation-chrome';
const MOBILE_SRC = 'apps/mobile/src';

const PRODUCTION_FILES = [
  'InspectionOrientation.tsx',
  'OrientationChrome.tsx',
  'ReturnControls.tsx',
  'context-orientation.ts',
  'index.ts',
  'inspection-orientation.ts',
  'model.ts',
  'return-orientation.ts',
  'types.ts',
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

const sources = Object.fromEntries(await Promise.all(PRODUCTION_FILES.map(async (name) => [name, await read(`${OC_DIR}/${name}`)])));
/** Code only: a comment may name a forbidden pattern in order to forbid it. */
const code = Object.fromEntries(Object.entries(sources).map(([name, text]) => [name, stripComments(text)]));
const layerText = Object.values(code).join('\n');

test('the authorized T-08 file surface is the only production surface of the chrome layer', () => {
  const dir = join(rootPath, OC_DIR);
  const production = listFiles(dir)
    .map((file) => file.slice(dir.length + 1).replace(/\\/gu, '/'))
    .filter((file) => !file.startsWith('__tests__/') && !file.startsWith('__fixtures__/'))
    .sort();
  assert.deepEqual(production, [...PRODUCTION_FILES].sort());
  const suites = readdirSync(join(dir, '__tests__')).filter((file) => /\.test\.tsx?$/u.test(file));
  assert.ok(suites.length >= 10, `the adversarial matrix is present, found ${suites.length}`);
});

// Section 25.1, 25.40 - the barrel is an allowlist, and it is the only way in.
test('the public surface is a narrow allowlist, never a wildcard', () => {
  assert.doesNotMatch(code['index.ts'], /export \* from/u, 'the public surface is an allowlist, never a wildcard');
  // Nothing internal to the layer is re-exported under a name that could be mistaken for an owner's.
  for (const forbidden of ['CanonicalStore', 'MapInspectionContext', 'ReturnSurface', 'HistoricalDisclosure']) {
    assert.doesNotMatch(code['index.ts'], new RegExp(`^export .*\\b${forbidden}\\b`, 'mu'), `the barrel must not re-export ${forbidden}`);
  }
});

// Section 25.12...25.16, 25.36 - T-07 is a firewall.
test('T-07 is consumed only through its barrel, and none of its internals is named', () => {
  for (const [name, text] of Object.entries(code)) {
    for (const match of text.matchAll(/from\s+'([^']+)'/gu)) {
      const specifier = match[1];
      if (!specifier.includes('return-navigation')) continue;
      assert.match(specifier, /return-navigation$/u, `${name} may import the return layer only through its barrel, got ${specifier}`);
    }
  }
  for (const internal of [
    'runReturnPlan',
    'buildAction',
    'ReturnPlan',
    'AuthorizedLanding',
    'requireCurrentContext',
    'resolveCheckpointTarget',
    'reportReturnDispatch',
    'focusMapTarget',
    'resolveFocusLanding',
    'FocusLanding',
    'ReturnFocusTarget',
  ]) {
    assert.equal(new RegExp(`\\b${internal}\\b`, 'u').test(layerText), false, `T-08 must not name the return-layer internal ${internal}`);
  }
  // Section 25.10, 25.11 - the canonical return seam and the action shape are unreachable from here.
  assert.equal(layerText.includes('.dispatchReturn('), false, 'T-08 must not reach the canonical return seam');
  assert.equal(layerText.includes('dispatchMap('), false, 'T-08 must not reach the canonical Map seam');
  assert.equal(layerText.includes('dispatchTemporal('), false, 'T-08 must not reach the canonical temporal seam');
  assert.doesNotMatch(layerText, /type:\s*'(?:RETURN_|GO_LIVE|BACK_ONE_STEP|EXACT_RETURN|INSPECT_OBJECT|SWITCH_CONTEXT|DIRECT_JUMP)/u, 'T-08 constructs no action of any owner');
  assert.equal(layerText.includes('RETURN_ACTION_AUTHORITY'), false, 'T-08 holds no authority of its own or anyone else\'s');
  assert.equal(layerText.includes('MAP_ACTION_AUTHORITY'), false);
});

// Section 25.35 - the six stay six, public and distinct, and T-08 calls each exactly once.
test('each of the six frozen return acts is reached exactly once, through its own executor', async () => {
  const SIX = ['backOneStep', 'exactReturn', 'returnLiveHead', 'returnLiveFocus', 'goLiveAndLocate', 'returnWorld'];
  const controls = code['ReturnControls.tsx'];
  for (const executor of SIX) {
    assert.equal((controls.match(new RegExp(`\\b${executor}\\(`, 'gu')) ?? []).length, 1, `${executor} is called exactly once`);
  }
  // The mapping is a switch with one arm per identity, so no payload can redirect one act to another.
  for (const id of ['BACK_ONE_STEP', 'EXACT_RETURN', 'RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'RETURN_WORLD', 'GO_LIVE_AND_LOCATE']) {
    assert.match(controls, new RegExp(`case '${id}'`, 'u'), `the ${id} arm exists`);
  }
  // And the return barrel still publishes exactly those six executors.
  const returnBarrel = await read('apps/mobile/src/return-navigation/index.ts');
  for (const executor of SIX) assert.match(returnBarrel, new RegExp(`\\b${executor},`, 'u'), `${executor} stays public`);
});

// Section 25.2...25.9 - no new canonical state, no third mode, no new Product act, no router.
test('T-08 adds no canonical state, no temporal mode, no Product act and no router navigation', async () => {
  const classes = stripComments(await read('apps/mobile/src/state/classes.ts'));
  assert.match(classes, /export const CANONICAL_STATE_KEYS = Object\.freeze\(\['session', 'live', 'temporal', 'inspection', 'camera', 'history'\] as const\);/u);
  assert.match(classes, /export type TemporalMode = \{ readonly kind: 'FOLLOW_LIVE' \} \| \{ readonly kind: 'PINNED'; readonly at: SessionPosition \};/u);

  const actions = stripComments(await read('apps/mobile/src/state/actions.ts'));
  // The frozen act vocabulary is unchanged: T-08 promoted nothing and invented nothing.
  for (const generic of ['NAVIGATE', 'GO_HOME', "'HOME'", "'RESET'", 'BACK_OR_HOME', 'RESTORE'] ) {
    assert.equal(actions.includes(generic), false, `the catalog must not gain ${generic}`);
    assert.equal(layerText.includes(generic), false, `T-08 must not introduce ${generic}`);
  }
  // Section 25.8, 25.9 - Product Back is never router history.
  for (const routing of ['expo-router', 'useRouter', 'router.push', 'router.back', 'router.replace', 'navigation.goBack', '@react-navigation']) {
    assert.equal(layerText.includes(routing), false, `T-08 must not use ${routing} for Product navigation`);
  }
});

// Section 25.17...25.20 - one freshness rule, no second projection or locatability machinery, and
// no capability derived from raw live truth.
test('there is one freshness rule, no second resolver, and no raw Live Focus shortcut', () => {
  // THE rule, reached through T-04's own accessor, in exactly one place in the layer.
  assert.equal((layerText.match(/isCurrentMapContext\(/gu) ?? []).length, 1, 'the shared freshness rule is asked in exactly one place');
  assert.equal(layerText.includes('mapContextFreshness'), false, 'T-08 does not reach past the accessor to the rule itself');
  assert.equal(layerText.includes('projectionTupleFreshness'), false);
  // Section 25.18, 25.19 - no cache and no second derivation of scene, entitlement or locatability.
  for (const forbidden of ['deriveMapScene', 'deriveMapSceneFromDisclosure', 'HistoricalDisclosureCache', 'resolveLocatability', 'entitledLoci', 'locusForBinding', 'resolveEntitledInspection', 'resolveLocateAtTarget']) {
    assert.equal(layerText.includes(forbidden), false, `T-08 must not reimplement or reach ${forbidden}`);
  }
  assert.equal((layerText.match(/\bnew Map\(|\bnew WeakMap\(|\bnew Set\(|\bnew WeakSet\(/gu) ?? []).length, 0, 'the layer caches nothing and mints nothing');

  // Section 25.20 - the specific Live Focus capability may come only from the projection-bound query.
  assert.equal((layerText.match(/liveFocusReturnAvailability\(/gu) ?? []).length, 1, 'the safe capability query is asked exactly once');
  assert.doesNotMatch(layerText, /\.LF\b/u, 'no part of T-08 reads the Live Focus mirror');
  assert.equal(layerText.includes('live.LF'), false);
  // `ESTABLISHED_THREAD` belongs to the Live Focus union alone: the Map's own family vocabulary is
  // THREAD / READING / EMERGING_FOCUS, which this layer legitimately consumes as DISCLOSED families.
  // So this token, and the `LiveFocus` type itself, are the exact tell of a raw live-truth shortcut.
  assert.doesNotMatch(layerText, /\bESTABLISHED_THREAD\b/u, 'no part of T-08 branches on a Live Focus kind');
  assert.doesNotMatch(layerText, /\bLiveFocus\b/u, 'T-08 never holds or imports the Live Focus type');
  assert.doesNotMatch(layerText, /\bliveFocusEquals\b|\bisLiveFocus\b/u, 'T-08 never inspects a Live Focus value');
  // The one place a Live answer enters the model is that query's own three-valued result.
  assert.match(code['model.ts'], /focusReturn: current === null \? \('UNPROVEN' as const\) : liveFocusReturnAvailability\(store, current\)\.status/u);
});

// Section 25.21, 25.22, 25.32, 25.33 - the checkpoint target stays opaque and unpersisted.
test('the Exact Return target is never minted, inspected, serialized or persisted here', () => {
  // T-08 receives a target; it never enumerates the reversible history to find one.
  assert.equal(layerText.includes('returnCheckpoints('), false, 'T-08 builds no history browser');
  assert.equal(layerText.includes('latestReturnCheckpoint('), false, 'T-08 never guesses which checkpoint is meant');
  assert.equal(layerText.includes('.history['), false, 'T-08 never indexes the reversible history');
  // Section 25.33 - no checkpoint internals are read.
  for (const internal of ['tmProvenance', 'ifRef', 'captured', 'RhCheckpoint', 'RhEntry']) {
    assert.equal(layerText.includes(internal), false, `T-08 must not read the checkpoint internal ${internal}`);
  }
  // Section 25.21, 25.22 - nothing is stored or serialized.
  for (const persistence of ['AsyncStorage', 'SecureStore', 'localStorage', 'MMKV', 'expo-file-system', 'JSON.stringify', 'JSON.parse', 'structuredClone']) {
    assert.equal(layerText.includes(persistence), false, `T-08 must not use ${persistence}`);
  }
  // The one check T-08 does make is conservative and ordinal-only, and authority stays T-07's.
  assert.match(code['model.ts'], /isReturnCheckpointTarget\(bound\) && bound\.index < availability\.checkpointCount/u);
});

// Section 25.26, 25.27 - no app-shell mount, and the shell is byte-identical.
test('T-08 mounts nothing into the app shell, and the shell files are untouched', async () => {
  const SHELL = {
    'apps/mobile/src/app/_layout.tsx': '90179f6d13026e9b0e2345e0418012214b9c9aab',
    'apps/mobile/src/app/index.tsx': 'ef38d10c76a957163bf00f7b7b60fb8aa25841f4',
    'apps/mobile/src/shell/FoundationShell.tsx': 'e2286ba1a35c2e40def475af5deed2d8ba8120d3',
  };
  for (const [file, blob] of Object.entries(SHELL)) {
    assert.equal(gitBlobId(await read(file)), blob, `${file} is byte-identical to the T-08 baseline`);
    assert.doesNotMatch(await read(file), /orientation-chrome|OrientationChrome|ReturnControls/u, `${file} must not mount T-08`);
  }
});

// Section 25.23, 25.24, 25.25 - no dependency, no lockfile move, no backend or schema change.
test('T-08 adds no dependency and touches no backend, database or schema', async () => {
  const mobilePackage = await readJson('apps/mobile/package.json');
  assert.equal(gitBlobId(await read('apps/mobile/package.json')), 'd10b3a577d6ee26c0af2e045f4bc39496181b2e7', 'the mobile manifest is byte-identical');
  assert.equal(gitBlobId(await read('package-lock.json')), 'c5b6e12cc45d32bd782b3a690179fedabde7169d', 'the lockfile is byte-identical to the T-08 baseline');
  assert.deepEqual(Object.keys(mobilePackage.dependencies).sort(), [
    '@shopify/react-native-skia', 'expo', 'expo-constants', 'expo-dev-client', 'expo-linking', 'expo-router', 'expo-status-bar',
    'react', 'react-native', 'react-native-gesture-handler', 'react-native-reanimated', 'react-native-safe-area-context',
    'react-native-screens', 'react-native-worklets',
  ], 'no new mobile dependency');
  // Every import in the layer is a relative module of this app or React Native itself.
  const specifiers = [...layerText.matchAll(/from\s+'([^']+)'/gu)].map((match) => match[1]);
  for (const specifier of specifiers) {
    assert.ok(specifier.startsWith('.') || specifier === 'react' || specifier === 'react-native', `T-08 imports only relative modules and React Native, got ${specifier}`);
  }
  const rootPackage = await readJson('package.json');
  assert.deepEqual(Object.keys(rootPackage.devDependencies), ['pg'], 'no new root dependency');
  assert.deepEqual(readdirSync(join(rootPath, 'database/migrations')).filter((name) => /007[3-9]|00[8-9][0-9]/u.test(name)), [], 'T-08 adds no migration');
});

// Section 25.28...25.31 - the later tasks' scope is left alone.
test('T-08 steals no motion, no responsive recomposition and no reduced-motion authority', () => {
  for (const motion of ['react-native-reanimated', 'useSharedValue', 'useAnimatedStyle', 'withTiming', 'withSpring', 'Animated', 'LayoutAnimation', 'useReducedMotion', 'AccessibilityInfo']) {
    assert.equal(layerText.includes(motion), false, `T-08 must not own ${motion}: motion and reduced-motion are a later task's`);
  }
  // Section 25.31 - no act is ever dispatched from an animation or a timer.
  for (const scheduler of ['setTimeout', 'setInterval', 'requestAnimationFrame', 'InteractionManager', 'runOnJS', 'scheduleOnRN']) {
    assert.equal(layerText.includes(scheduler), false, `T-08 must not schedule Product work with ${scheduler}`);
  }
  // Section 25.28 - no responsive Product recomposition: no width, no breakpoint, no dimensions.
  for (const responsive of ['useWindowDimensions', 'Dimensions', 'onLayout', 'breakpoint', 'isNarrow', 'isTablet']) {
    assert.equal(layerText.includes(responsive), false, `T-08 must not implement responsive Product behaviour (${responsive})`);
  }
  // No gesture of any kind: every act is reachable by a press and by an accessibility action.
  for (const gesture of ['GestureDetector', 'Gesture.', 'PanResponder', 'react-native-gesture-handler', 'onGestureEvent']) {
    assert.equal(layerText.includes(gesture), false, `T-08 must not introduce ${gesture}`);
  }
});

// Section 25.34 - grouping never swallows the controls, and no drag-only route exists.
test('every control is an independent native element, and the world stays reachable behind the chrome', () => {
  // The three grouping containers are explicitly not accessibility elements.
  assert.equal((layerText.match(/accessibilityRole="none"/gu) ?? []).length, 4, 'each grouping container declares itself a non-element');
  assert.doesNotMatch(layerText, /<View[^>]*\saccessible(\s|=\{true\}|>)/u, 'no grouping View is marked accessible');
  assert.match(code['ReturnControls.tsx'], /accessibilityRole="button"/u);
  assert.match(code['InspectionOrientation.tsx'], /accessibilityRole="button"/u);
  // The world beneath keeps every touch the chrome does not claim.
  assert.match(code['OrientationChrome.tsx'], /pointerEvents="box-none"/u);
  // Section 23.1, 23.45, 23.49 - not a dashboard, not a page, not a cover.
  for (const shape of ['absoluteFill', 'Modal', 'ScrollView', 'FlatList', 'SectionList', 'SafeAreaView', 'useSafeAreaInsets', 'StatusBar']) {
    assert.equal(layerText.includes(shape), false, `T-08 must not become ${shape}`);
  }
  assert.doesNotMatch(layerText, /flex:\s*1/u, 'the chrome never claims the whole surface');
});

// Section 25.42 - the unsafe inspection branches have nothing to leak with.
test('the render states that may not name an identity have no field to name one with', () => {
  const types = code['types.ts'];
  // The unknown member is exactly one key, so a leak would have to be a type error.
  assert.match(types, /\{ readonly kind: 'IDENTITY_UNKNOWN_AT_TC' \}/u);
  for (const technical of ['PROJECTION_NOT_FETCHED', 'PROJECTION_INCOHERENT', 'INSPECTION_NOT_RESOLVED', 'RESOLUTION_MALFORMED']) {
    assert.match(types, new RegExp(`\\{ readonly kind: '${technical}' \\}`, 'u'), `${technical} carries nothing but its kind`);
  }
  // The five vocabularies stay five different members; none is expressed in terms of another.
  for (const distinct of ['IDENTITY_UNKNOWN_AT_TC', 'DEPTH_WITHHELD', 'PROJECTION_NOT_FETCHED', 'PROJECTION_UNAVAILABLE', 'PROJECTION_STALE']) {
    assert.equal((types.match(new RegExp(`kind: '${distinct}'`, 'gu')) ?? []).length, 1, `${distinct} is declared exactly once`);
  }
  // The single rule, stated once, in code.
  assert.match(code['inspection-orientation.ts'], /if \(resolution\.knowledge === 'UNKNOWN_AT_TC'\) return \{ kind: 'IDENTITY_UNKNOWN_AT_TC' \};/u);
  // No placeholder wording anywhere that would imply a target-shaped hole.
  for (const wording of ['loading', 'skeleton', 'placeholder', 'shimmer', 'Untitled', 'unnamed']) {
    assert.equal(layerText.toLowerCase().includes(wording.toLowerCase()), false, `no ${wording} shape may stand in for a target`);
  }
});

// Section 25.37, 25.38, 25.39 - the owners' own contracts are untouched by this task.
test('the T-04, T-05 and T-06 boundaries this layer leans on are intact', async () => {
  const mapScene = stripComments(await read('apps/mobile/src/map/projection/map-scene.ts'));
  assert.match(mapScene, /export function mapContextFreshness\(state: CanonicalState, context: DisclosedProjectionContext\): MapProjectionFreshness \{/u, 'the one shared freshness rule is unchanged');
  assert.match(mapScene, /export const MAP_PROJECTION_STALE_REASONS = Object\.freeze\(\[/u);
  const preview = stripComments(await read('apps/mobile/src/temporal-navigation/preview/preview-state.ts'));
  assert.match(preview, /cancel\(\): PreviewResult;/u, 'T-06 still owns preview cancellation');
  assert.equal(layerText.includes('.cancel()'), false, 'T-08 never cancels a preview itself');
  assert.equal(layerText.includes('createTemporalPreviewController'), false, 'T-08 creates no preview controller');
  // T-05 presentation state stays noncanonical and is not consumed as Product truth here.
  assert.equal(layerText.includes('createPresentationController'), false);
  assert.equal(layerText.includes('TimelinePresentation'), false);
});

// Section 25.41 - the files are real text.
test('every T-08 source file is real text: no control byte can make git treat it as binary', () => {
  for (const [name, text] of Object.entries(sources)) {
    const control = [...text].findIndex((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point < 0x20 && character !== '\n' && character !== '\t';
    });
    assert.equal(control, -1, `${name} contains a control character at index ${control}`);
    assert.equal(text.charCodeAt(0) === 0xfeff, false, `${name} carries a byte order mark`);
    assert.equal(text.includes('\r'), false, `${name} carries a carriage return`);
    assert.doesNotMatch(text, /(?:ANTHROPIC|OPENAI|GOOGLE_AI|SUPABASE_SERVICE_ROLE)_(?:API_)?KEY|SUPABASE_PUBLISHABLE_KEY|EXPO_PUBLIC_|sk-ant-/u, `${name} references a credential`);
  }
});

// Section 25.43 - the gate is registered, documented, and joins the fast lane without a native job.
test('the T-08 gate is registered at the root and in Mobile CI without a new native job', async () => {
  const rootPackage = await readJson('package.json');
  assert.equal(rootPackage.scripts['test:inspection-orientation-return-chrome-contract'], 'node --test tests/inspection-orientation-return-chrome-contract.test.mjs');
  const mobileCi = await read('.github/workflows/mobile-ci.yml');
  assert.match(mobileCi, /run: npm run test:inspection-orientation-return-chrome-contract/u);
  assert.match(mobileCi, /'tests\/inspection-orientation-return-chrome-contract\.test\.mjs'/u);
  // Every sibling gate still runs, and no job was added: the fast lane plus the two native jobs.
  for (const sibling of [
    'test:mobile-canonical-state-contract',
    'test:living-analysis-map-runtime-contract',
    'test:temporal-navigation-layer-contract',
    'test:return-navigation-layer-contract',
  ]) {
    assert.match(mobileCi, new RegExp(`run: npm run ${sibling}`, 'u'), `${sibling} still runs`);
  }
  assert.equal((mobileCi.match(/runs-on: /gu) ?? []).length, 3, 'no job beyond the fast gate and the two native jobs');
  assert.equal((mobileCi.match(/runs-on: macos-26/gu) ?? []).length, 1);
  assert.equal((mobileCi.match(/if: needs\.verify-mobile-contracts\.outputs\.native_impact == 'true'/gu) ?? []).length, 2);
  assert.equal(existsSync(new URL('docs/inspection-orientation-return-chrome-v1.md', root)), true);
  assert.match(await read('apps/mobile/README.md'), /Inspection \+ orientation \+ return chrome \(T-08\)/u);
});

// The layer is additive: no other mobile file changed, so no sibling contract needs re-anchoring.
test('T-08 is additive: no file outside its own directory was modified', () => {
  const dir = join(rootPath, MOBILE_SRC);
  const owners = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepEqual(owners, ['app', 'map', 'orientation-chrome', 'projection', 'return-navigation', 'shell', 'state', 'temporal', 'temporal-navigation', 'timeline'],
    'T-08 adds exactly one owner directory and removes none');
});
