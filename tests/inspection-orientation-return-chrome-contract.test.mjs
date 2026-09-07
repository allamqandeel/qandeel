import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// T-08 - Inspection + Orientation + Return Chrome: the Living Analysis Map made understandable and
// operable as a Product surface. Static executable contract over the approved boundary.
//
// Semantic behaviour is proven by the Jest suites under apps/mobile/src/orientation-chrome
// (OC08-A...OC08-M plus the R1 suites). This gate guards what a passing unit test cannot: the file
// surface, the absence of any new dependency or canonical state, the anti-scope, that the layer
// reaches its owners only through their public barrels, and that the gate is registered in CI.
//
// ## R1: this contract guards T-08 invariants, never a mutable global repository ceiling
//
// The first version asserted that no migration numbered beyond the T-08 baseline existed anywhere.
// That freezes the FUTURE rather than the past: PR #209 legitimately landed an unrelated Supabase
// keep-alive migration while T-08 was in review, GitHub tests a merge ref against current main, and
// a mobile chrome contract failed over a database keep-alive it has nothing to do with.
//
// Every assertion below is therefore scoped to something T-08 itself owns, or to a genuinely
// permanent invariant. Deliberately absent: any global migration census, any hash of a file a later
// authorized task is expected to change (the lockfile, the mobile manifest, the app shell), and any
// enumeration of the mobile source tree that a sibling task would break by adding its own owner.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFile(new URL(path, root), 'utf8');
const readJson = async (path) => JSON.parse(await read(path));

const OC_DIR = 'apps/mobile/src/orientation-chrome';

const PRODUCTION_FILES = [
  'InspectionOrientation.tsx',
  'OrientationChrome.tsx',
  'ReturnControls.tsx',
  'context-orientation.ts',
  'exact-return-origin.ts',
  'index.ts',
  'inspection-orientation.ts',
  'model.ts',
  'product-copy.ts',
  'return-orientation.ts',
  'types.ts',
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

/**
 * Every production module of the layer AS IT IS ON DISK, not a fixed list.
 *
 * FORWARD-SAFE (R2-02): the guards below have to apply to a module a later authorized task adds to
 * this layer just as much as to the eleven delivered here. Reading the directory is what makes that
 * true; `PRODUCTION_FILES` is then a floor — what must still be here — rather than a ceiling.
 */
const productionFiles = listFiles(join(rootPath, OC_DIR))
  .map((file) => file.slice(join(rootPath, OC_DIR).length + 1).replace(/\\/gu, '/'))
  .filter((file) => !file.startsWith('__tests__/') && !file.startsWith('__fixtures__/'))
  .sort();

const sources = Object.fromEntries(await Promise.all(productionFiles.map(async (name) => [name, await read(`${OC_DIR}/${name}`)])));
/** Code only: a comment may name a forbidden pattern in order to forbid it. */
const code = Object.fromEntries(Object.entries(sources).map(([name, text]) => [name, stripComments(text)]));
const layerText = Object.values(code).join('\n');

/**
 * The modules that decide what is TRUE, as opposed to the components that show it.
 *
 * The separation is the point of the R2 forward-safety rule below: T-10 owns motion in this layer and
 * T-11 owns its responsive behaviour, so banning their primitives from the components forever would
 * be a guard against authorized work. Banning them from the truth modules forever is a different and
 * permanent claim — what is true may never depend on a frame clock, a viewport size or a measurement.
 */
const TRUTH_MODULES = ['types.ts', 'inspection-orientation.ts', 'return-orientation.ts', 'context-orientation.ts', 'model.ts', 'product-copy.ts', 'exact-return-origin.ts'];

// FORWARD-SAFE (R2-02). The first version asserted this directory contains EXACTLY these files. That
// is a ceiling on T-10, which is authorized to bring motion into this very layer and will bring its
// own module with it. What is permanent is the other direction: every file T-08 delivered still
// exists and still carries its own responsibility, and this directory never becomes a home for
// something that is not a chrome module.
test('the authorized T-08 file surface is present, and the directory stays a chrome layer', () => {
  for (const file of PRODUCTION_FILES) assert.ok(productionFiles.includes(file), `${file} is still delivered`);
  for (const file of productionFiles) {
    assert.match(file, /^[\w.-]+\.tsx?$/u, `${file} is a TypeScript module at the top of the layer: no asset, no config, no nested surface`);
  }
  const suites = readdirSync(join(rootPath, OC_DIR, '__tests__')).filter((file) => /\.test\.tsx?$/u.test(file));
  assert.ok(suites.length >= 12, `the adversarial matrix is present, found ${suites.length}`);
});

// The barrel is an allowlist, and it is the only way in.
test('the public surface is a narrow allowlist, never a wildcard', () => {
  assert.doesNotMatch(code['index.ts'], /export \* from/u, 'the public surface is an allowlist, never a wildcard');
  for (const forbidden of ['CanonicalStore', 'MapInspectionContext', 'ReturnSurface', 'HistoricalDisclosure']) {
    assert.doesNotMatch(code['index.ts'], new RegExp(`^export .*\\b${forbidden}\\b`, 'mu'), `the barrel must not re-export ${forbidden}`);
  }
});

// T-07 is a firewall.
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
  // The canonical seams and the action shapes are unreachable from here.
  assert.equal(layerText.includes('.dispatchReturn('), false, 'T-08 must not reach the canonical return seam');
  assert.equal(layerText.includes('dispatchMap('), false, 'T-08 must not reach the canonical Map seam');
  assert.equal(layerText.includes('dispatchTemporal('), false, 'T-08 must not reach the canonical temporal seam');
  assert.doesNotMatch(layerText, /type:\s*'(?:RETURN_|GO_LIVE|BACK_ONE_STEP|EXACT_RETURN|INSPECT_OBJECT|SWITCH_CONTEXT|DIRECT_JUMP)/u, 'T-08 constructs no action of any owner');
  assert.equal(layerText.includes('RETURN_ACTION_AUTHORITY'), false, 'T-08 holds no authority of its own or anyone else\'s');
  assert.equal(layerText.includes('MAP_ACTION_AUTHORITY'), false);
});

// The six stay six, public and distinct, and T-08 calls each exactly once.
test('each of the six frozen return acts is reached exactly once, through its own executor', async () => {
  const SIX = ['backOneStep', 'exactReturn', 'returnLiveHead', 'returnLiveFocus', 'goLiveAndLocate', 'returnWorld'];
  const controls = code['ReturnControls.tsx'];
  for (const executor of SIX) {
    assert.equal((controls.match(new RegExp(`\\b${executor}\\(`, 'gu')) ?? []).length, 1, `${executor} is called exactly once`);
  }
  for (const id of ['BACK_ONE_STEP', 'EXACT_RETURN', 'RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'RETURN_WORLD', 'GO_LIVE_AND_LOCATE']) {
    assert.match(controls, new RegExp(`case '${id}'`, 'u'), `the ${id} arm exists`);
  }
  const returnBarrel = await read('apps/mobile/src/return-navigation/index.ts');
  for (const executor of SIX) assert.match(returnBarrel, new RegExp(`\\b${executor},`, 'u'), `${executor} stays public`);
});

// REV-T08-01 — the rendered set is context-sensitive; the six MEANINGS are still six.
test('the return chrome offers a context-sensitive set without collapsing any meaning', () => {
  const orientation = code['return-orientation.ts'];
  // The offered list is filtered, and the frozen vocabulary is what it is filtered FROM.
  assert.match(orientation, /offered: Object\.freeze\(RETURN_OPPORTUNITY_IDS\.filter\(\(id\) => isMeaningful\(id, inputs\)\)\.map\(\(id\) => SHAPES\[id\]\)\)/u);
  assert.match(code['types.ts'], /readonly offered: readonly ReturnOpportunity\[\];/u);
  // No control carries an availability flag any more, and none is rendered disabled: an act is
  // offered or it is absent. A permanently rendered disabled matrix is not the Product solution.
  assert.doesNotMatch(code['types.ts'], /readonly available:/u, 'a return opportunity has no availability flag');
  assert.doesNotMatch(code['ReturnControls.tsx'], /\bdisabled\b/u, 'no control is rendered as a disabled affordance');
  assert.doesNotMatch(code['ReturnControls.tsx'], /accessibilityState/u, 'no control publishes a disabled accessibility state');
  assert.equal(code['ReturnControls.tsx'].includes('orientation.offered.map'), true, 'only the offered acts are rendered');
  assert.match(code['ReturnControls.tsx'], /if \(orientation\.offered\.length === 0\) return null;/u, 'an empty group is not a surface');
  // The six meanings remain constants of their identity, reachable whether or not they are offered.
  assert.match(orientation, /export function returnMeaning\(id: ReturnOpportunityId\): ReturnOpportunity \{\s*return SHAPES\[id\];/u);
  for (const id of ['BACK_ONE_STEP', 'EXACT_RETURN', 'RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'RETURN_WORLD', 'GO_LIVE_AND_LOCATE']) {
    assert.match(orientation, new RegExp(`${id}: Object\\.freeze\\(`, 'u'), `${id} keeps its own frozen meaning`);
  }
  assert.match(code['types.ts'], /export const RETURN_OPPORTUNITY_IDS = Object\.freeze\(\[/u);
});

// REV-T08-02, closed in R2-03 — the centralization claim is now literally true, and proved.
//
// R1 asserted "every reader-facing word comes from the one copy module" while the six control labels
// and hints lived in `return-orientation.ts`, three region names lived in their components and the
// ordering note lived in `context-orientation.ts`. The words moved; what is asserted here is the
// claim itself, not a proxy for it: outside `product-copy.ts` no module of this layer contains a
// reader-facing string AT ALL — no literal carrying whitespace, and no JSX text node.
test('every reader-facing word comes from the one copy module, and none of it is engineering surface', () => {
  for (const [name, text] of Object.entries(code)) {
    if (name === 'product-copy.ts') continue;
    for (const match of text.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/gu)) {
      const value = match[1] ?? match[2] ?? match[3] ?? '';
      assert.doesNotMatch(value, /\s/u, `${name} contains the reader-facing string "${value}"; every word belongs in product-copy.ts`);
    }
    assert.doesNotMatch(text, />\s*[A-Za-z][^<>{}\n]*[a-z]\s*</u, `${name} renders literal text; every word belongs in product-copy.ts`);
    assert.doesNotMatch(text, /accessibilityLabel="[^"]*\$\{/u, `${name} must not interpolate a label of its own`);
  }
  // And the copy module is where all of it actually is.
  const copy = code['product-copy.ts'];
  assert.match(copy, /export function returnActWords\(id: ReturnOpportunityId\)/u, 'the six control labels and hints are written here');
  for (const name of ['CONTEXT_CHOICE_TITLE', 'CONTEXT_ORDERING_NOTE', 'ORIENTATION_CHROME_LABEL', 'INSPECTION_ORIENTATION_LABEL', 'RETURN_CONTROLS_LABEL']) {
    assert.match(copy, new RegExp(`export const ${name} = '`, 'u'), `${name} is written here`);
  }
  // The plain-language tables exist, and nothing renders a frozen token directly.
  assert.match(copy, /const FAMILY: Readonly<Record<HistoricalFamily, string>>/u);
  assert.match(copy, /const DEPTH: Readonly<Record<SemanticDepth, string>>/u);
  // A transport refusal code is never interpolated into a sentence.
  assert.doesNotMatch(layerText, /\$\{render\.code\}|\$\{.*\.reason\}/u, 'no refusal code or stale reason is ever spoken');
  // No identifier of any kind is interpolated into reader-facing copy.
  for (const forbidden of ['${render.id}', '${identity.id}', '${where.bindingId}', '${where.threadId}', '${locus.key}', '${step.id}', '${render.family}']) {
    assert.equal(copy.includes(forbidden), false, `no reader-facing sentence may interpolate ${forbidden}`);
    assert.equal(layerText.includes(forbidden), false, `no reader-facing sentence may interpolate ${forbidden}`);
  }
  // The contextual chooser distinguishes options by Moment and by "current", never by a handle.
  assert.match(copy, /export function contextChoiceLabel\(current: boolean, boundAtMoment: number\): string/u);
  assert.match(code['context-orientation.ts'], /const distinguishable = labels\.size === options\.length;/u, 'the chooser fails closed when options cannot be told apart');
});

// R2-01 — presentation provenance is ASKED of T-07, never inferred here.
test('the Exact Return opportunity is proven by T-07 provenance, and reads no checkpoint internals', () => {
  const origin = code['exact-return-origin.ts'];
  // Binding CHECKS the claim rather than recording it: a target this store did not mint never binds.
  assert.match(origin, /export function bindExactReturnOrigin\(store: CanonicalStore, target: unknown\): ExactReturnOrigin \| null \{\s*if \(!isCurrentReturnCheckpointTargetForStore\(store, target\)\) return null;/u,
    'binding is refused unless T-07 confirms this store minted the target and still records it');
  assert.match(origin, /if \(record\.store !== store\) return null;/u, 'a foreign or replaced store yields no opportunity');
  // Validity is re-asked of T-07 on every read, against the entry itself...
  assert.match(origin, /return isCurrentReturnCheckpointTargetForStore\(store, record\.target\) \? record\.target : null;/u,
    'the opportunity holds only while T-07 still records this exact entry');
  // ...and there is no ordinal, depth or count anywhere in the module, so a consumed origin cannot be
  // resurrected by history regrowing past its old position. The handle carries nothing at all.
  assert.match(origin, /export interface ExactReturnOrigin \{\s*readonly \[ORIGIN\]: true;\s*\}/u, 'the handle is opaque and empty');
  for (const revived of ['ordinal', 'checkpointCount', 'returnAvailability', 'length', 'index']) {
    assert.equal(origin.includes(revived), false, `presentation validity must not be re-derived from ${revived}`);
  }
  // T-07 stays the independent final authority: the resolver is never exported to or called from here.
  assert.equal(layerText.includes('resolveCheckpointTarget'), false, 'T-08 never calls the T-07 resolver');
  // Exactly one provenance registry exists in the layer, and it lives here. It is not a cache: it
  // holds one handle a caller bound, never a list, and it grants nothing.
  assert.equal((layerText.match(/new WeakMap[<(]/gu) ?? []).length, 1, 'exactly one presentation registry exists');
  assert.equal((origin.match(/new WeakMap[<(]/gu) ?? []).length, 1, 'and it lives in the origin module');
  // Nothing else is HELD between calls. A `new Set` inside a pure function is a local computation
  // (the chooser's distinguishability check); what would be a cache is a MODULE-LEVEL registry, and
  // the only one of those in the layer is the presentation binding above.
  const moduleLevelRegistries = [...layerText.matchAll(/^const \w+ = new (?:Map|Set|WeakSet|WeakMap)[<(]/gmu)].map((match) => match[0]);
  assert.equal(moduleLevelRegistries.length, 1, `the layer holds exactly one module-level registry, found ${moduleLevelRegistries.join(', ')}`);
  assert.match(moduleLevelRegistries[0], /new WeakMap[<(]/u, 'and it is the presentation binding, not a cache');
  // T-08 never enumerates the reversible history and never reads a checkpoint's contents.
  assert.equal(layerText.includes('returnCheckpoints('), false, 'T-08 builds no history browser');
  assert.equal(layerText.includes('latestReturnCheckpoint('), false, 'T-08 never guesses which checkpoint is meant');
  assert.equal(layerText.includes('.history['), false, 'T-08 never indexes the reversible history');
  for (const internal of ['tmProvenance', 'ifRef', 'captured', 'RhCheckpoint', 'RhEntry']) {
    assert.equal(layerText.includes(internal), false, `T-08 must not read the checkpoint internal ${internal}`);
  }
  for (const persistence of ['AsyncStorage', 'SecureStore', 'localStorage', 'MMKV', 'expo-file-system', 'JSON.stringify', 'JSON.parse', 'structuredClone']) {
    assert.equal(layerText.includes(persistence), false, `T-08 must not use ${persistence}`);
  }
});

// REV-T08-05 — the accessibility surface claims only what React Native provides.
test('no non-focusable container advertises custom actions as an accessibility route', () => {
  // The grouping Views stay non-elements so they cannot swallow the buttons — and therefore they
  // must not publish custom actions either, because a container nothing can focus is not a route.
  assert.equal(layerText.includes('accessibilityActions'), false, 'a non-focusable container publishes no custom actions');
  assert.equal(layerText.includes('onAccessibilityAction'), false);
  // A floor, not a census: T-11 may legitimately add a container, and the invariant is that a
  // container is a non-element, never that there are exactly this many of them.
  for (const component of ['OrientationChrome.tsx', 'InspectionOrientation.tsx', 'ReturnControls.tsx']) {
    assert.match(code[component], /accessibilityRole="none"/u, `${component} declares its grouping container a non-element`);
  }
  assert.doesNotMatch(layerText, /<View[^>]*\saccessible(\s|=\{true\}|>)/u, 'no grouping View is marked accessible');
  // Each control is its own native button, which is the route that actually exists.
  assert.match(code['ReturnControls.tsx'], /accessibilityRole="button"/u);
  assert.match(code['InspectionOrientation.tsx'], /accessibilityRole="button"/u);
});

// No new canonical state, no temporal mode, no Product act, no router.
test('T-08 adds no canonical state, no temporal mode, no Product act and no router navigation', async () => {
  const classes = stripComments(await read('apps/mobile/src/state/classes.ts'));
  assert.match(classes, /export const CANONICAL_STATE_KEYS = Object\.freeze\(\['session', 'live', 'temporal', 'inspection', 'camera', 'history'\] as const\);/u);
  assert.match(classes, /export type TemporalMode = \{ readonly kind: 'FOLLOW_LIVE' \} \| \{ readonly kind: 'PINNED'; readonly at: SessionPosition \};/u);

  const actions = stripComments(await read('apps/mobile/src/state/actions.ts'));
  for (const generic of ['NAVIGATE', 'GO_HOME', "'HOME'", "'RESET'", 'BACK_OR_HOME', 'RESTORE']) {
    assert.equal(actions.includes(generic), false, `the catalog must not gain ${generic}`);
    assert.equal(layerText.includes(generic), false, `T-08 must not introduce ${generic}`);
  }
  for (const routing of ['expo-router', 'useRouter', 'router.push', 'router.back', 'router.replace', 'navigation.goBack', '@react-navigation']) {
    assert.equal(layerText.includes(routing), false, `T-08 must not use ${routing} for Product navigation`);
  }
});

// One freshness rule, no second projection or locatability machinery, no raw live-truth shortcut.
test('there is one freshness rule, no second resolver, and no raw Live Focus shortcut', () => {
  assert.equal((layerText.match(/isCurrentMapContext\(/gu) ?? []).length, 1, 'the shared freshness rule is asked in exactly one place');
  assert.equal(layerText.includes('mapContextFreshness'), false, 'T-08 does not reach past the accessor to the rule itself');
  assert.equal(layerText.includes('projectionTupleFreshness'), false);
  for (const forbidden of ['deriveMapScene', 'deriveMapSceneFromDisclosure', 'HistoricalDisclosureCache', 'resolveLocatability', 'entitledLoci', 'locusForBinding', 'resolveEntitledInspection', 'resolveLocateAtTarget']) {
    assert.equal(layerText.includes(forbidden), false, `T-08 must not reimplement or reach ${forbidden}`);
  }
  assert.equal((layerText.match(/liveFocusReturnAvailability\(/gu) ?? []).length, 1, 'the safe capability query is asked exactly once');
  assert.doesNotMatch(layerText, /\.LF\b/u, 'no part of T-08 reads the Live Focus mirror');
  assert.equal(layerText.includes('live.LF'), false);
  // `ESTABLISHED_THREAD` belongs to the Live Focus union alone: the Map's own family vocabulary is
  // THREAD / READING / EMERGING_FOCUS, which this layer legitimately consumes as DISCLOSED families.
  assert.doesNotMatch(layerText, /\bESTABLISHED_THREAD\b/u, 'no part of T-08 branches on a Live Focus kind');
  assert.doesNotMatch(layerText, /\bLiveFocus\b/u, 'T-08 never holds or imports the Live Focus type');
  assert.match(code['model.ts'], /focusReturn: current === null \? \('UNPROVEN' as const\) : liveFocusReturnAvailability\(store, current\)\.status/u);
});

// FORWARD-SAFE (R2-02). "The shell does not import T-08" is a DELIVERY fact of this candidate, and
// T-12 is authorized to invert it — a perpetual guard against it would be a guard against authorized
// work. The permanent invariants are the two that survive that integration:
//
//   - T-08 never reaches for the shell. A chrome layer that imported the app root would invert
//     control and could never be mounted twice, or tested without one;
//   - whenever the shell does mount T-08, it does so through the public barrel. A deep import would
//     reach past the allowlist into a module the layer does not publish.
//
// That the shell mounts nothing today is recorded as closure evidence in
// docs/inspection-orientation-return-chrome-v1.md, not frozen here.
test('T-08 never reaches for the app shell, and the shell may reach T-08 only through its barrel', async () => {
  for (const file of ['apps/mobile/src/app/_layout.tsx', 'apps/mobile/src/app/index.tsx', 'apps/mobile/src/shell/FoundationShell.tsx']) {
    for (const match of (await read(file)).matchAll(/from\s+'([^']+)'/gu)) {
      if (!match[1].includes('orientation-chrome')) continue;
      assert.match(match[1], /orientation-chrome$/u, `${file} may reach T-08 only through its barrel, got ${match[1]}`);
    }
  }
  // And the layer does not reach for the shell either. This one never changes.
  assert.equal(layerText.includes('src/app/'), false);
  assert.equal(layerText.includes('FoundationShell'), false);
});

// No dependency, no backend, no database, no schema. Scoped to what T-08 imports and declares.
test('T-08 adds no dependency and touches no backend, database or schema', async () => {
  const mobilePackage = await readJson('apps/mobile/package.json');
  // FORWARD-SAFE (R2-02): an exhaustive census of the mobile manifest is a ceiling on a package
  // T-08 does not own — T-11 and T-12 may legitimately add to it. The permanent, SCOPED proof that
  // T-08 adds no dependency is the import scan below: every import in the layer is a relative
  // module of this app, `react`, or `react-native`. A dependency T-08 cannot import is not T-08's.
  for (const name of ['zustand', 'redux', '@reduxjs/toolkit', 'jotai', 'mobx', 'valtio', 'recoil', 'react-native-mmkv',
    '@react-native-async-storage/async-storage', 'expo-secure-store', 'expo-sqlite', 'moment', 'dayjs', 'date-fns', 'luxon']) {
    assert.equal(name in (mobilePackage.dependencies ?? {}) || name in (mobilePackage.devDependencies ?? {}), false, `${name} must not be introduced`);
  }
  const rootPackage = await readJson('package.json');
  // FORWARD-SAFE (R2-02): an exhaustive census of the ROOT toolchain is a global ceiling that
  // any authorized future task trips. What is permanent is that the verifier database driver is
  // declared, alongside the forward-safe denylists this contract already carries.
  assert.ok('pg' in rootPackage.devDependencies, 'the verifier database driver is still declared');

  // FORWARD-SAFE (R2-02): "only relative modules, `react` and `react-native`" would forbid T-10 from
  // using the renderer and the animation driver this app ALREADY declares — a guard against
  // authorized work. The permanent claim is the one that matters: T-08 adds no dependency. Every
  // non-relative import it makes is already declared by the mobile app, so a new package cannot enter
  // the repository through this layer.
  const declared = new Set([...Object.keys(mobilePackage.dependencies ?? {}), 'react', 'react-native']);
  for (const match of layerText.matchAll(/from\s+'([^']+)'/gu)) {
    const specifier = match[1];
    if (specifier.startsWith('.')) continue;
    const pkg = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    assert.ok(declared.has(pkg), `T-08 adds no dependency: ${specifier} is not declared by the mobile app`);
  }
  // T-08 is a mobile-only layer: it ships no database artifact and reaches nothing in the database.
  // Deliberately NOT a census of the migration chain, which grows for reasons that are not T-08's.
  assert.deepEqual(listFiles(join(rootPath, OC_DIR)).filter((file) => file.endsWith('.sql')), [], 'the layer ships no database artifact');
  for (const reach of ['database/', 'migrations/', 'supabase', 'postgres', 'rpc/', 'SELECT ', 'INSERT ']) {
    assert.equal(layerText.includes(reach), false, `T-08 must not reach ${reach}`);
  }
});

// FORWARD-SAFE (R2-02). The first version banned every motion, measurement, scheduling and gesture
// primitive from the WHOLE layer, forever. T-10 is authorized to bring motion into these components
// and T-11 to make them responsive, so that guard was written to be violated by correct future work.
//
// What is permanent, and what this now says, is the separation of powers inside the layer: the truth
// modules may never touch any of it. A frame clock, a viewport size, a measured layout or a gesture
// stream must never be an input to what the reader is told is true — otherwise the answer would start
// depending on how it is shown, which is the whole failure T-08 exists to prevent.
test('no truth in this layer may ever depend on animation, measurement, scheduling or a gesture', () => {
  const APIS = [
    'react-native-reanimated', 'useSharedValue', 'useAnimatedStyle', 'withTiming', 'withSpring', 'Animated', 'LayoutAnimation',
    'useReducedMotion', 'AccessibilityInfo', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'InteractionManager',
    'runOnJS', 'scheduleOnRN', 'useWindowDimensions', 'Dimensions', 'onLayout', 'breakpoint', 'isNarrow', 'isTablet',
    'GestureDetector', 'Gesture.', 'PanResponder', 'react-native-gesture-handler', 'onGestureEvent',
  ];
  for (const name of TRUTH_MODULES) {
    for (const api of APIS) {
      assert.equal(code[name].includes(api), false, `${name} decides what is true and must never reach ${api}`);
    }
    // A truth module renders nothing, so it imports no view layer either.
    assert.doesNotMatch(code[name], /from\s+'react-native'/u, `${name} is a truth module and imports no view layer`);
  }
  // Two layer-wide bans that no later task makes legitimate either:
  //   - polling. The kernel publishes a subscription seam, so a chrome layer that sampled on a timer
  //     would be re-deriving state that is already pushed to it, and would drift from it.
  assert.equal(layerText.includes('setInterval'), false, 'T-08 polls nothing: it subscribes');
  //   - Product navigation by gesture or otherwise. Motion may move pixels; it may never move the
  //     reader. Every act still runs through exactly one T-07 executor, proven above.
  assert.equal(layerText.includes('navigate('), false, 'T-08 introduces no generic navigation act');
});

// The world stays the world.
test('the chrome is support around the Map, never a panel over it', () => {
  assert.match(code['OrientationChrome.tsx'], /pointerEvents="box-none"/u);
  for (const shape of ['absoluteFill', 'Modal', 'ScrollView', 'FlatList', 'SectionList', 'SafeAreaView', 'useSafeAreaInsets', 'StatusBar']) {
    assert.equal(layerText.includes(shape), false, `T-08 must not become ${shape}`);
  }
  assert.doesNotMatch(layerText, /flex:\s*1/u, 'the chrome never claims the whole surface');
});

// The unsafe inspection branches have nothing to leak with.
test('the render states that may not name an identity have no field to name one with', () => {
  const types = code['types.ts'];
  assert.match(types, /\{ readonly kind: 'IDENTITY_UNKNOWN_AT_TC' \}/u);
  for (const technical of ['PROJECTION_NOT_FETCHED', 'PROJECTION_INCOHERENT', 'INSPECTION_NOT_RESOLVED', 'RESOLUTION_MALFORMED']) {
    assert.match(types, new RegExp(`\\{ readonly kind: '${technical}' \\}`, 'u'), `${technical} carries nothing but its kind`);
  }
  for (const distinct of ['IDENTITY_UNKNOWN_AT_TC', 'DEPTH_WITHHELD', 'PROJECTION_NOT_FETCHED', 'PROJECTION_UNAVAILABLE', 'PROJECTION_STALE']) {
    assert.equal((types.match(new RegExp(`kind: '${distinct}'`, 'gu')) ?? []).length, 1, `${distinct} is declared exactly once`);
  }
  assert.match(code['inspection-orientation.ts'], /if \(resolution\.knowledge === 'UNKNOWN_AT_TC'\) return \{ kind: 'IDENTITY_UNKNOWN_AT_TC' \};/u);
  for (const wording of ['loading', 'skeleton', 'placeholder', 'shimmer', 'Untitled', 'unnamed']) {
    assert.equal(layerText.toLowerCase().includes(wording.toLowerCase()), false, `no ${wording} shape may stand in for a target`);
  }
});

// The owners' own boundaries this layer leans on are intact.
test('the T-04, T-05 and T-06 boundaries this layer leans on are intact', async () => {
  const mapScene = stripComments(await read('apps/mobile/src/map/projection/map-scene.ts'));
  assert.match(mapScene, /export function mapContextFreshness\(state: CanonicalState, context: DisclosedProjectionContext\): MapProjectionFreshness \{/u, 'the one shared freshness rule is unchanged');
  const preview = stripComments(await read('apps/mobile/src/temporal-navigation/preview/preview-state.ts'));
  assert.match(preview, /cancel\(\): PreviewResult;/u, 'T-06 still owns preview cancellation');
  assert.equal(layerText.includes('.cancel()'), false, 'T-08 never cancels a preview itself');
  assert.equal(layerText.includes('createTemporalPreviewController'), false, 'T-08 creates no preview controller');
  assert.equal(layerText.includes('createPresentationController'), false);
  assert.equal(layerText.includes('TimelinePresentation'), false);
});

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

test('the T-08 gate is registered at the root and in Mobile CI without a new native job', async () => {
  const rootPackage = await readJson('package.json');
  assert.equal(rootPackage.scripts['test:inspection-orientation-return-chrome-contract'], 'node --test tests/inspection-orientation-return-chrome-contract.test.mjs');
  const mobileCi = await read('.github/workflows/mobile-ci.yml');
  assert.match(mobileCi, /run: npm run test:inspection-orientation-return-chrome-contract/u);
  assert.match(mobileCi, /'tests\/inspection-orientation-return-chrome-contract\.test\.mjs'/u);
  for (const sibling of [
    'test:mobile-canonical-state-contract',
    'test:living-analysis-map-runtime-contract',
    'test:temporal-navigation-layer-contract',
    'test:return-navigation-layer-contract',
  ]) {
    assert.match(mobileCi, new RegExp(`run: npm run ${sibling}`, 'u'), `${sibling} still runs`);
  }
  assert.equal((mobileCi.match(/runs-on: /gu) ?? []).length, 3, 'no job beyond the fast gate and the two native jobs');
  assert.equal((mobileCi.match(/if: needs\.verify-mobile-contracts\.outputs\.native_impact == 'true'/gu) ?? []).length, 2);
  assert.equal(existsSync(new URL('docs/inspection-orientation-return-chrome-v1.md', root)), true);
  assert.match(await read('apps/mobile/README.md'), /Inspection \+ orientation \+ return chrome \(T-08\)/u);
});

// The layer is additive. Stated as "T-08's directory exists and is T-08's", never as a census of the
// mobile source tree, which a sibling task would legitimately change by adding its own owner.
test('T-08 is additive: it owns exactly one directory and takes over none', () => {
  const owners = readdirSync(join(rootPath, 'apps/mobile/src'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  assert.ok(owners.includes('orientation-chrome'), 'the T-08 owner directory exists');
  for (const existing of ['app', 'map', 'projection', 'return-navigation', 'shell', 'state', 'temporal', 'temporal-navigation', 'timeline']) {
    assert.ok(owners.includes(existing), `${existing} is untouched by T-08`);
  }
});
