import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// T-12 — Final Living Analysis Map Integration v1. Static executable contract.
//
// > **One world. One truth. One composition.**
// > **Integration connects owners. Integration does not replace owners.**
//
// The Jest suites under `apps/mobile/src/integration/__tests__` prove the BEHAVIOUR — one store, the
// three authorities, the generation retirement, the projection epoch, the journey origin, the
// composite cause, the locale, and the composed accessible tree. This gate guards what a passing
// unit test cannot: that the things this contract rejects are absent by CONSTRUCTION rather than
// merely unused, and that the integration owner did not quietly become a FOURTH authority while
// composing the other three.
//
// ## Forward safety
//
// Nothing here is a ceiling on the repository. There is no whole-repo file count, no repository-wide
// test-count pin, no whole-file hash of a shared workflow or manifest, no dependency census beyond
// the manifest T-12 itself must not change, and no "no migration after N". Every claim is either a
// PERMANENT INVARIANT of the frozen architecture or a statement about files T-12 itself owns.
//
// Two facts true at closure are deliberately NOT frozen, because freezing them would fail on
// authorized future work rather than on a defect: which runtime phase the Product root happens to
// render, and that the Map's paint is currently neutral. Replacing the placeholder paint with the
// final Graphic Language is VI-03's job, and this gate must not stand in its way.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));

const INTEGRATION_DIR = 'apps/mobile/src/integration';
const MOBILE_SRC = 'apps/mobile/src';
const SHELL_FILES = ['apps/mobile/src/app/_layout.tsx', 'apps/mobile/src/app/index.tsx'];

/** Code only: a comment may name a forbidden pattern in order to forbid it. */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

/**
 * The layer's PRODUCTION files.
 *
 * `__validation__/` is excluded alongside the test scaffolding, and for the same reason: it is not
 * Product code. It is the Phase-M `QAN-BL-T12-04` harness, it ships in no production build, and the
 * separate section at the end of this file proves it is unreachable from the Product route rather
 * than merely absent from this census.
 */
function production(dir) {
  const absolute = join(rootPath, dir);
  return listFiles(absolute)
    .map((file) => file.slice(absolute.length + 1).replace(/\\/gu, '/'))
    .filter((file) => !file.startsWith('__tests__/') && !file.startsWith('__fixtures__/') && !file.startsWith('__validation__/'))
    .sort();
}

const PRODUCTION_FILES = production(INTEGRATION_DIR);
const code = Object.fromEntries(PRODUCTION_FILES.map((name) => [name, read(`${INTEGRATION_DIR}/${name}`)]));
const layerText = Object.values(code).join('\n');
const layerCode = stripComments(layerText);

// ---------------------------------------------------------------------------------------------
// §28.1–4, §28.19–20 — the integration owner is not a second authority, and not persistence
// ---------------------------------------------------------------------------------------------

test('§28.1–3 — T-12 adds no canonical field, no Product act and no temporal mode', () => {
  const classes = stripComments(read(`${MOBILE_SRC}/state/classes.ts`));
  assert.match(classes, /export const CANONICAL_STATE_KEYS = Object\.freeze\(\['session', 'live', 'temporal', 'inspection', 'camera', 'history'\] as const\);/u);
  assert.match(classes, /export type TemporalMode = \{ readonly kind: 'FOLLOW_LIVE' \} \| \{ readonly kind: 'PINNED'; readonly at: SessionPosition \};/u);

  const actions = stripComments(read(`${MOBILE_SRC}/state/actions.ts`));
  assert.match(actions, /MAP_ACTION_TYPES = Object\.freeze\(\['INSPECT_OBJECT', 'SWITCH_CONTEXT', 'DIRECT_JUMP'\] as const\);/u);
  assert.match(actions, /TEMPORAL_ACTION_TYPES = Object\.freeze\(\['COMMIT_MOMENT_AND_LOCATE', 'CHOOSE_LOCUS'\] as const\);/u);
  // The integration layer invents no identity of its own, and cannot: it dispatches nothing directly.
  for (const invented of ['NAVIGATE', 'GO_HOME', 'RESTORE', 'RESET_VIEW', 'OPEN_', 'SELECT_']) {
    assert.equal(layerCode.includes(invented), false, `T-12 must not introduce ${invented}`);
  }
});

test('§28.4 — there is exactly one canonical store implementation, and T-12 is not a second one', () => {
  const creators = listFiles(join(rootPath, MOBILE_SRC))
    .filter((file) => /\.tsx?$/u.test(file))
    .filter((file) => !/__tests__|__fixtures__/u.test(file))
    .filter((file) => /export function createCanonicalStore/u.test(readFileSync(file, 'utf8')));
  assert.equal(creators.length, 1, 'exactly one module defines the canonical store');
  assert.match(creators[0].replace(/\\/gu, '/'), /state\/store\.ts$/u);
  // The integration layer never constructs one: it consumes the bootstrap that does.
  assert.equal(layerCode.includes('createCanonicalStore'), false, 'T-12 creates no store of its own');
});

test('§28.19–20 — the integration owner persists nothing, and implements no part of T-13', () => {
  for (const persistence of [
    'AsyncStorage',
    'SecureStore',
    'localStorage',
    'sessionStorage',
    'MMKV',
    'expo-file-system',
    'expo-sqlite',
    'kv-store',
    'JSON.stringify',
    'JSON.parse',
  ]) {
    assert.equal(layerCode.includes(persistence), false, `T-12 must not persist through ${persistence}`);
  }
  for (const t13 of ['restore', 'rehydrate', 'recover', 'resume(']) {
    assert.equal(layerCode.toLowerCase().includes(t13.toLowerCase()), false, `restart and recovery are T-13's: ${t13}`);
  }
});

// ---------------------------------------------------------------------------------------------
// §28.5–6 — the composition uses public owner surfaces, and the seam changes are declared
// ---------------------------------------------------------------------------------------------

test('§28.5 — every owner is reached through its public barrel, never through a deep internal', () => {
  const OWNERS = ['state', 'map', 'timeline', 'temporal', 'temporal-navigation', 'return-navigation', 'orientation-chrome', 'motion', 'responsive', 'projection', 'runtime-entry'];
  const allowed = new Set(OWNERS.map((owner) => `../../${owner}`));
  for (const [name, text] of Object.entries(code)) {
    for (const match of stripComments(text).matchAll(/from\s+'(\.\.\/\.\.\/[^']+)'/gu)) {
      const specifier = match[1];
      const owner = specifier.split('/')[2];
      if (!OWNERS.includes(owner)) continue;
      assert.ok(allowed.has(specifier), `${name} must reach ${owner} through its barrel, got ${specifier}`);
    }
  }
});

test('§28.6 — the T-12P runtime entry is consumed through its barrel and its test seam is never used', () => {
  assert.doesNotMatch(layerCode, /from\s+'[^']*runtime-entry\/[^']+'/u, 'the runtime entry is reached only through its barrel');
  // `existingSessionId` skips authenticated Session acquisition entirely. It is T-12P's test seam and
  // the production path must never pass it.
  assert.equal(layerCode.includes('existingSessionId'), false, 'no production use of the existing-Session seam');
});

test('§28.6 — the bootstrap is called in exactly ONE place, and it cannot be called without the authorities', () => {
  const runtime = code['runtime/integration-runtime.ts'];
  // The memoization trap: `bootstrap` memoises per auth generation and IGNORES the overrides of every
  // later call, so a single call without `storeDependencies` would leave this generation with a store
  // that has no Map, temporal or Return authority — permanently, silently, and looking mounted.
  assert.match(
    runtime,
    /function bootstrapWithAuthorities\(entry: MobileRuntimeEntry\) \{\s*\n\s*return entry\.bootstrap\(\{ storeDependencies: T12_STORE_DEPENDENCIES \}\);\s*\n\}/u,
    'the one bootstrap call carries the authorities and takes no argument that could omit them',
  );
  const calls = [...stripComments(layerText).matchAll(/\.bootstrap\(/gu)];
  assert.equal(calls.length, 1, `exactly one bootstrap call site, found ${calls.length}`);
  // And the runtime entry is never published, so nothing outside this module can start a second one.
  assert.doesNotMatch(stripComments(code['runtime/integration-runtime.ts']), /^\s*entry,$/mu, 'the runtime entry is not exposed');
  assert.equal(code['index.ts'].includes('bootstrap'), false, 'the barrel exposes no bootstrap seam');
});

test('the three promoted-act authorities are the frozen production ones, wired as one value', () => {
  const runtime = code['runtime/integration-runtime.ts'];
  assert.match(
    runtime,
    /T12_STORE_DEPENDENCIES: StoreDependencies = Object\.freeze\(\{\s*\n\s*mapActionAuthority: MAP_ACTION_AUTHORITY,\s*\n\s*temporalActionAuthority: TEMPORAL_ACTION_AUTHORITY,\s*\n\s*returnActionAuthority: RETURN_ACTION_AUTHORITY,\s*\n\}\);/u,
    'all three authorities are wired, by name, from their owners',
  );
});

// ---------------------------------------------------------------------------------------------
// §28.7–9 — credentials
// ---------------------------------------------------------------------------------------------

test('§28.7–9 — no credential is hardcoded, and none reaches the public Expo config', () => {
  for (const secret of ['eyJ', 'sb_secret_', 'service_role', 'Bearer ey', 'apikey=']) {
    assert.equal(layerText.includes(secret), false, `T-12 must not carry ${secret}`);
  }
  // The one env boundary stays T-12P's `app.config.js`; the integration layer reads none.
  assert.equal(layerCode.includes('process.env'), false, 'T-12 reads no environment variable');
  assert.equal(layerCode.includes('EXPO_PUBLIC'), false);
  // Code only: the config's own comment names the secrets it forbids, in order to forbid them.
  const appConfig = stripComments(read('apps/mobile/app.config.js'));
  for (const forbidden of ['SUPABASE_SERVICE_ROLE', 'sb_secret_', 'password']) {
    assert.equal(appConfig.includes(forbidden), false, `the public config must not carry ${forbidden}`);
  }
  // `app.json` still carries no `extra` at all: the static identity of the app is unchanged.
  assert.equal('extra' in readJson('apps/mobile/app.json').expo, false);
});

test('§28.8 — no fixture Session, and no synthesised Session id, reaches the production path', () => {
  for (const fixture of ['SESSION_A', 'SESSION_B', 'test-session', 'randomUUID', 'crypto.randomUUID']) {
    assert.equal(layerCode.includes(fixture), false, `no fabricated Session in production: ${fixture}`);
  }
});

// ---------------------------------------------------------------------------------------------
// §28.10–11 — live delivery stays T-12P's
// ---------------------------------------------------------------------------------------------

test('§28.10–11 — T-12 invents no cadence, no socket and no background loop', () => {
  for (const invented of ['WebSocket', 'EventSource', 'SSE', 'setInterval', 'AppState.addEventListener']) {
    assert.equal(layerCode.includes(invented), false, `live delivery is T-12P's: ${invented}`);
  }
  // No timer at all, so there is no magic number to argue about.
  assert.equal(layerCode.includes('setTimeout'), false, 'the integration owner schedules nothing');
  // The driver is OBTAINED, never built: T-12P owns at most one per generation.
  assert.match(code['runtime/integration-runtime.ts'], /liveDriver: entry\.liveDriverFor\(bundle\)/u);
  assert.equal(layerCode.includes('createForegroundLiveDriver'), false, 'T-12 builds no driver of its own');
});

// ---------------------------------------------------------------------------------------------
// §28.12–13 — canonical navigation never becomes a route stack
// ---------------------------------------------------------------------------------------------

test('§28.12–13 — one route, and no route per depth, Thread, Reading or Return', () => {
  // The two-file router root is a frozen architectural decision, so the census stays exact.
  assert.deepEqual(readdirSync(join(rootPath, 'apps/mobile/src/app')).sort(), ['_layout.tsx', 'index.tsx']);
  for (const file of SHELL_FILES) {
    const text = stripComments(read(file));
    for (const routing of ['router.push', 'router.replace', 'router.back', 'useRouter', 'usePathname', 'useSegments', '<Link', 'navigate(']) {
      assert.equal(text.includes(routing), false, `${file} must not navigate: ${routing}`);
    }
  }
  // And the integration layer itself reaches no router at all.
  for (const routing of ['expo-router', 'router.push', 'useRouter', 'usePathname', 'useSegments', '<Link', 'navigate(']) {
    assert.equal(layerCode.includes(routing), false, `semantic navigation is canonical state, not a route: ${routing}`);
  }
});

test('the route renders the integrated Product root, and the technical shell is no longer mounted', () => {
  const index = read('apps/mobile/src/app/index.tsx');
  assert.match(index, /import \{ ProductRoot \} from '\.\.\/integration';/u, 'the route mounts the integrated root through the barrel');
  assert.match(index, /return <ProductRoot \/>;/u);
  assert.equal(index.includes('FoundationShell'), false, 'the technical shell is not the route output');
  // §28.26 / PM-34, PM-35: it is not rendered ANYWHERE, visibly or otherwise, so the boot smoke
  // cannot be satisfied by it. The file itself is retained as the unmounted T-01 artifact, which is
  // why the shell-region guards in seven older contracts still have something to read.
  for (const file of listFiles(join(rootPath, MOBILE_SRC))) {
    if (!/\.tsx?$/u.test(file) || /__tests__|__fixtures__/u.test(file)) continue;
    if (file.replace(/\\/gu, '/').endsWith('shell/FoundationShell.tsx')) continue;
    // Code only: the Product root's own comment records what it replaced, and a comment is not a
    // render. What must be absent is any reference that could put it back on screen.
    assert.equal(stripComments(readFileSync(file, 'utf8')).includes('FoundationShell'), false, `${file} must not render the technical shell`);
  }
});

test('§28.26 — the boot smoke targets the integrated root and asserts no Product semantics', () => {
  const smoke = read('apps/mobile/.maestro/boot-smoke.yaml');
  assert.match(smoke, /qandeel-product-root/u);
  assert.doesNotMatch(smoke, /qandeel-foundation-shell/u);
  // A boot smoke proves launch and mount. This build carries no configuration and no credentials, so
  // there is no Session, no viewpoint and no world for it to assert on — and it asserts none.
  for (const semantic of ['Moment', 'Thread', 'Reading', 'Live', 'Return', 'inspect']) {
    assert.equal(smoke.includes(semantic), false, `boot smoke must not assert Product semantics: ${semantic}`);
  }
  assert.equal((smoke.match(/assertVisible/gu) ?? []).length, 1, 'exactly one visibility assertion');
});

// ---------------------------------------------------------------------------------------------
// §28.14–15 — one projection cache, and it writes no Product state
// ---------------------------------------------------------------------------------------------

test('§28.14 — there is exactly one disclosure cache implementation, and T-12 constructs none', () => {
  const holders = listFiles(join(rootPath, MOBILE_SRC))
    .filter((file) => /\.tsx?$/u.test(file) && !/__tests__|__fixtures__/u.test(file))
    .filter((file) => /export class HistoricalDisclosureCache/u.test(readFileSync(file, 'utf8')));
  assert.equal(holders.length, 1, 'exactly one module defines the cache');
  // T-12 uses the ONE the bootstrap created and never builds a second.
  assert.equal(layerCode.includes('new HistoricalDisclosureCache'), false, 'T-12 constructs no cache');
  assert.match(code['runtime/integration-runtime.ts'], /cache: bundle\.projection,/u, 'the coordinator writes into the bundle’s cache');
});

test('§28.15 — projection coordination writes no canonical state', () => {
  const coordinator = code['projection/projection-coordinator.ts'];
  for (const write of ['dispatch', 'ingest(', 'getState', 'CanonicalState', 'CanonicalStore']) {
    assert.equal(stripComments(coordinator).includes(write), false, `the projection coordinator must not reach ${write}`);
  }
  // The staleness rule is an epoch per key, re-checked after every await, on both the success and the
  // refusal path. A response that lost its race writes nothing at all.
  assert.match(coordinator, /const epoch = \(epochs \+= 1\);\s*\n\s*latest\.set\(key, epoch\);/u);
  assert.equal((coordinator.match(/if \(latest\.get\(key\) !== epoch\) return 'STALE';/gu) ?? []).length, 2,
    'the epoch is re-checked on the success path AND on the refusal path');
  // Nothing is decided by a clock or by arrival order.
  for (const forbidden of ['Date.now', 'setTimeout', 'performance.now', 'timestamp']) {
    assert.equal(stripComments(coordinator).includes(forbidden), false, `staleness is identity, never ${forbidden}`);
  }
});

// ---------------------------------------------------------------------------------------------
// §28.16–18 — motion causes
// ---------------------------------------------------------------------------------------------

test('§28.16–17 — the composite cause is a binding, never a mailbox, and never a timeout', () => {
  const cause = code['motion/spatial-cause.ts'];
  // Consumed by the QUESTION rather than by a matching answer. This single line is what makes an
  // intervening act retire the binding instead of leaving it to be borrowed by the act after that.
  assert.match(cause, /const held = armed;\s*\n(?:\s*\/\/[^\n]*\n)*\s*armed = null;/u,
    'asking consumes the binding whatever the answer');
  // The arming predicate is the camera itself, never the outcome's spatial status: a composite that
  // only went Live is APPLIED and LANDED with the camera untouched.
  assert.match(cause, /if \(cameraIntentEquals\(before\.camera, after\.camera\)\) return false;/u);
  assert.equal(stripComments(cause).includes('locate'), false, 'the outcome’s locate status is not the evidence');
  for (const mailbox of ['queue', 'pending', 'inbox', 'mailbox', 'lastCause', 'Date.now', 'setTimeout', 'expires']) {
    assert.equal(stripComments(cause).includes(mailbox), false, `no mailbox and no clock: ${mailbox}`);
  }
});

test('§28.18 — no Meaning Ignition cue ships, and no excluded event is wired to one', () => {
  for (const invented of ['MEANING_IGNITION', 'MeaningIgnition', 'meaningIgnition', 'ignite', 'crystalliz']) {
    assert.equal(layerText.includes(invented), false, `no invented Meaning Ignition trigger: ${invented}`);
  }
  // Word-boundary matched, deliberately. A naive substring scan reads `ProjectionFetchOutcome` as a
  // fetch handler and fires on correct code, which is how a guard stops being believed.
  for (const excluded of ['onMount', 'didMount', 'onFetch', 'onLoad', 'inViewport', 'onVisible', 'firstSeen']) {
    assert.doesNotMatch(layerCode, new RegExp(`\\b${excluded}\\b`, 'u'), `no cue from an excluded event: ${excluded}`);
  }
  // The disposition is RECORDED, in the production document, where the reader of this task's
  // decisions looks — exactly as T-10 recorded the deferral.
  assert.match(read('docs/final-living-analysis-map-integration-v1.md'), /NO MEANING IGNITION CUE SHIPS/u);
});

// ---------------------------------------------------------------------------------------------
// §28.21–23 — the visual authority boundary
// ---------------------------------------------------------------------------------------------

test('§28.21 — T-12 adds no blanket ban on visual richness', () => {
  // QAN-GOV-02: the gate is TRUTH, not aesthetic restraint. A guard forbidding glow, halos,
  // particles, filaments, atmosphere or Living Brass would ban the visual language VI-03 has not
  // chosen yet, using this task as the excuse.
  const contract = read('tests/t12-integration-contract.test.mjs');
  for (const richness of ['glow', 'halo', 'particle', 'filament', 'atmospher', 'brass', 'luminous', 'bloom']) {
    const banned = new RegExp(`(?:assert\\.equal\\([^\\n]*includes\\('${richness}|doesNotMatch\\([^\\n]*${richness})`, 'iu');
    assert.doesNotMatch(contract, banned, `T-12 must not ban ${richness}`);
  }
});

test('§28.22–23 — no final palette, material or Graphic Language token is frozen by T-12', () => {
  const contract = read('tests/t12-integration-contract.test.mjs');
  // The integration layer paints nothing and names no colour at all.
  assert.doesNotMatch(layerCode, /#[0-9a-fA-F]{6}\b|rgba?\(/u, 'T-12 defines no colour');
  for (const visual of ['palette', 'gradient', 'shadowColor', 'fontFamily', 'letterSpacing']) {
    assert.equal(layerCode.includes(visual), false, `final Graphic Language is VI-03's: ${visual}`);
  }
  // And no guard anywhere pins the Map's placeholder colours, which would freeze the placeholder as
  // the final design and block the task that must replace it. Asserted as `no colour literal at all`:
  // naming the exact placeholder value here would put it in the file it is checking.
  assert.doesNotMatch(contract, /rgb\(\d/u, 'the neutral placeholder palette is not frozen by T-12');
});

// ---------------------------------------------------------------------------------------------
// §28.24–25 — the app-root presentation seams
// ---------------------------------------------------------------------------------------------

test('§28.24 — the safe-area provider is the already-declared package, and adds no dependency', () => {
  const manifest = readJson('apps/mobile/package.json');
  assert.equal(manifest.dependencies['react-native-safe-area-context'], '~5.7.0', 'the package was already declared');
  assert.match(code['presentation/presentation-facts.ts'], /from 'react-native-safe-area-context'/u);
  const productRoot = code['composition/ProductRoot.tsx'];
  // Mounted, and mounted with `initialMetrics`: the provider renders NOTHING until it has real
  // insets, so without this the reader sees a blank frame between READY and the world.
  assert.match(productRoot, /<SafeAreaProvider initialMetrics=\{initialWindowMetrics\}/u, 'the provider is mounted with initial metrics');
  // And the root identity is ABOVE it. A test ID inside a provider that has not yet received insets
  // is absent — which would make the boot smoke's one claim depend on a native measurement arriving.
  const rootIdAt = productRoot.indexOf('testID={PRODUCT_ROOT_TEST_ID}');
  const providerAt = productRoot.indexOf('<SafeAreaProvider');
  assert.ok(rootIdAt > 0 && providerAt > rootIdAt, 'the root identity does not depend on the safe-area provider');
  // Insets and font scale are presentation: they reach T-11's seams and nothing else.
  const facts = stripComments(code['presentation/presentation-facts.ts']);
  for (const canonical of ['dispatch', 'store', 'CanonicalState', 'camera', 'inspection']) {
    assert.equal(facts.includes(canonical), false, `a presentation fact must not reach ${canonical}`);
  }
});

test('§28.25 — the large-text Live fix keeps the slot OUTBOARD and clips nothing', () => {
  const presentation = stripComments(read('apps/mobile/src/timeline/virtualization/TimelinePresentation.tsx'));
  assert.match(presentation, /minWidth: OUTBOARD_LIVE_EXTENT, flexShrink: 0/u, 'the extent is a floor, never a fixed width');
  assert.equal(presentation.includes("overflow: 'hidden'"), false, 'essential Live wording is never clipped');
  // Still outboard: its own slot, beside the strip, separated by the discontinuity — never inside the
  // list that carries the Moments, and never a Moment.
  assert.match(presentation, /<View testID="timeline-outboard-live"/u);
  assert.match(presentation, /style=\{\{ width: DISCONTINUITY_EXTENT \}\}/u, 'the discontinuity still separates it');
  // And the Track keeps its exact invariant step, so no temporal geometry moved.
  assert.match(presentation, /style=\{\{ height: TIMELINE_STEP, flexGrow: 1, flexShrink: 1, flexBasis: 0 \}\}/u);
});

// ---------------------------------------------------------------------------------------------
// §28.27–29 — backlog inheritance, T-13, and dependency drift
// ---------------------------------------------------------------------------------------------

test('§28.27–28 — the inherited set is exactly the canonical TEN, and QAN-BL-T13-01 is not claimed', () => {
  const doc = read('docs/final-living-analysis-map-integration-v1.md');
  const INHERITED = [
    'QAN-BL-T12-01',
    'QAN-BL-T12-02',
    'QAN-BL-T12-03',
    'QAN-BL-T12-04',
    'QAN-BL-MOT-01',
    'QAN-BL-MOT-02',
    'QAN-BL-MOT-03',
    'QAN-BL-MOT-04',
    'QAN-BL-RSP-01',
    'QAN-BL-RSP-02',
  ];
  for (const id of INHERITED) assert.ok(doc.includes(id), `the integration document must disposition ${id}`);
  assert.match(doc, /T-12 backlog inheritance: 10 items/u);
  // The canonical register agrees, and it is the authority.
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  for (const id of INHERITED) assert.ok(backlog.includes(id), `${id} is a canonical backlog item`);
  // T-13's item stays T-13's: named as a boundary, never claimed as work.
  assert.equal(layerCode.includes('QAN-BL-T13-01'), false, 'T-12 claims no T-13 item in production code');
  assert.doesNotMatch(doc, /QAN-BL-T13-01[^\n]*\b(CLOSED|implemented|delivered)\b/u, 'T-13’s item is not closed here');
});

test('§28.29 — T-12 introduces no dependency and no lockfile drift', () => {
  const manifest = readJson('apps/mobile/package.json');
  const declared = new Set([...Object.keys(manifest.dependencies), ...Object.keys(manifest.devDependencies)]);
  // Every package the integration layer imports was already declared. This is a statement about
  // T-12's own imports, not a census of the manifest, so an authorized later dependency is fine.
  for (const match of layerCode.matchAll(/from\s+'([^'.][^']*)'/gu)) {
    const specifier = match[1];
    if (specifier.startsWith('@qandeel/')) continue;
    const pkg = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    if (pkg === 'react' || pkg === 'react-native') continue;
    assert.ok(declared.has(pkg), `T-12 imports ${pkg}, which is not declared`);
  }
});

// ---------------------------------------------------------------------------------------------
// The integration owner's own shape
// ---------------------------------------------------------------------------------------------

test('the barrel is an allowlist, and the deep modules are not a second public surface', () => {
  assert.doesNotMatch(stripComments(code['index.ts']), /export \* from/u, 'the public surface is an allowlist, never a wildcard');
  // Nothing outside the layer deep-imports it.
  for (const file of listFiles(join(rootPath, MOBILE_SRC))) {
    const relative = file.slice(join(rootPath, MOBILE_SRC).length + 1).replace(/\\/gu, '/');
    if (relative.startsWith('integration/')) continue;
    if (!/\.tsx?$/u.test(file)) continue;
    // The leading `/` is load-bearing: without it this fires on T-06's own
    // `../timeline-integration/…`, which is a different owner's internal directory and none of this
    // guard's business. A guard that fails on unrelated correct code is a guard nobody keeps.
    assert.doesNotMatch(stripComments(readFileSync(file, 'utf8')), /from\s+'[^']*\/integration\/[^']+'/u,
      `${relative} must reach T-12 only through its barrel`);
  }
});

test('the integration layer is composition, and holds no Product truth of its own', () => {
  // Two module-level registries would be two caches. The layer holds NONE: every coordinator's state
  // lives inside a factory call bound to one runtime generation, so nothing outlives a retirement.
  const moduleLevel = [...layerCode.matchAll(/^const \w+ = new (?:Map|Set|WeakMap|WeakSet)[<(]/gmu)];
  assert.deepEqual(moduleLevel, [], 'the layer holds no module-level registry at all');
  // It renders no reader-facing Product word: every word in the composition comes from T-08's copy
  // boundary, which is the one place any of them is written.
  const composition = stripComments(code['composition/LivingAnalysisMap.tsx']);
  assert.doesNotMatch(composition, /["'][A-Z][a-z]+ [a-z]+[^"']*["']/u, 'the composition writes no Product sentence');
});

test('the technical state view is technical: no Product copy, no Product language, no visual language', () => {
  const root = stripComments(code['composition/ProductRoot.tsx']);
  // It names the runtime phase in engineering vocabulary, which is what it is.
  assert.match(root, /runtime: \$\{phase\}/u);
  assert.equal(root.includes('ChromeLanguage'), false, 'the technical state speaks no Product language');
  for (const productCopy of ['Moment', 'Thread', 'Reading', 'inspection', 'Live edge', 'conversation']) {
    assert.equal(root.includes(productCopy), false, `the technical state must not use Product vocabulary: ${productCopy}`);
  }
  // The root's identity is present in EVERY phase, which is what makes the boot smoke honest.
  assert.match(root, /testID=\{PRODUCT_ROOT_TEST_ID\}/u);
});

// ---------------------------------------------------------------------------------------------
// Phase M — the `QAN-BL-T12-04` validation harness is unreachable from the Product route
// ---------------------------------------------------------------------------------------------

const VALIDATION_DIR = `${INTEGRATION_DIR}/__validation__`;

/**
 * The TRANSITIVE import closure of the Product route.
 *
 * A substring scan of the route file proves almost nothing here — the harness would be reachable
 * through any one of a dozen intermediate modules, and each of them looks innocent on its own. So
 * this walks the graph: start at the router root, follow every relative import, and collect every
 * module the Product can actually reach. What the harness must be absent from is THAT set.
 */
function productionClosure() {
  const seen = new Set();
  const queue = ['apps/mobile/src/app/_layout.tsx', 'apps/mobile/src/app/index.tsx'];
  const resolve = (from, specifier) => {
    const base = join(rootPath, from, '..', specifier).replace(/\\/gu, '/');
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate.slice(rootPath.length).replace(/\\/gu, '/');
    }
    return null;
  };
  while (queue.length > 0) {
    const current = queue.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    const text = stripComments(read(current));
    for (const match of text.matchAll(/from\s+'(\.[^']+)'/gu)) {
      const resolved = resolve(current, match[1]);
      if (resolved !== null && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

test('Phase M — the validation harness is unreachable from the Product route, transitively', () => {
  const closure = productionClosure();
  // The walk is real: it must have reached the composition, or it proves nothing by finding nothing.
  assert.ok(closure.has('apps/mobile/src/integration/composition/ProductRoot.tsx'), 'the closure walk reached the Product root');
  assert.ok(closure.has('apps/mobile/src/integration/composition/LivingAnalysisMap.tsx'), 'the closure walk reached the composition');
  assert.ok(closure.size > 20, `the closure walk reached the real graph, found ${closure.size} modules`);

  // And nothing in it is the harness, at any depth.
  for (const module of closure) {
    assert.equal(module.includes('__validation__'), false, `${module} is reachable from the Product route and is validation-only`);
  }
  // The barrel does not publish it either, so no consumer can import it through the layer's surface.
  assert.equal(code['index.ts'].includes('__validation__'), false, 'the public barrel does not export the harness');
  // Nor does anything else in the layer's production set.
  assert.equal(layerCode.includes('__validation__'), false, 'no production module references the harness directory');
});

test('Phase M — the harness reaches the runtime through the public seams only, and creates no second authority', () => {
  const harness = Object.fromEntries(
    readdirSync(join(rootPath, VALIDATION_DIR)).map((name) => [name, read(`${VALIDATION_DIR}/${name}`)]),
  );
  const text = Object.values(harness).map(stripComments).join('\n');
  // It drives `createIntegrationRuntime`, which owns the ONE Supabase client and the ONE auth
  // authority. A harness that built its own would be validating something the Product does not run.
  assert.match(text, /createIntegrationRuntime/u, 'the harness drives the real integration runtime');
  for (const second of ['createClient', 'createSupabaseAuthPort', 'createMobileAuthAuthority', 'createAuthSessionStorage', 'expo-sqlite']) {
    assert.equal(text.includes(second), false, `the harness must not build a second ${second}`);
  }
  // No deep import of T-12P, and no use of its Session test seam.
  assert.doesNotMatch(text, /from\s+'[^']*runtime-entry\/[^']+'/u, 'the harness reaches T-12P only through its barrel');
  assert.equal(text.includes('existingSessionId'), false, 'the harness acquires a real Session, never a supplied one');
  // No new auth semantics: it calls the frozen capability and nothing else.
  assert.match(text, /runtime\.auth\.signInWithPassword|auth\.signInWithPassword/u);
});

test('Phase M — the harness commits no credential, echoes none, and persists no Product truth', () => {
  const files = readdirSync(join(rootPath, VALIDATION_DIR));
  for (const name of files) {
    const raw = read(`${VALIDATION_DIR}/${name}`);
    const text = stripComments(raw);
    // No literal credential of any recognisable shape. `password:` is deliberately NOT in this list:
    // it is how the credential TYPE is declared, and banning it would fire on the type that exists to
    // keep credentials out of everything else. The assertion below is the one that matters — it
    // forbids a credential VALUE, which is the thing that could actually leak.
    for (const shape of ['@gmail.', '@qandeel.', 'passwd', 'pass123', 'sb_secret_', 'eyJ']) {
      assert.equal(text.includes(shape), false, `${name} must carry no credential-shaped literal: ${shape}`);
    }
    assert.doesNotMatch(text, /(?:email|password)\s*[:=]\s*'[^']+'/u, `${name} must declare no credential default`);
    assert.doesNotMatch(text, /(?:email|password)\s*[:=]\s*"[^"]+"/u, `${name} must declare no credential default`);
    assert.doesNotMatch(text, /placeholder=/u, `${name} must not carry a credential placeholder`);
    // Never logged. A console line survives into a device log, which is where a credential leaks.
    for (const sink of ['console.', 'Alert.alert', 'Sentry', 'analytics']) {
      assert.equal(text.includes(sink), false, `${name} must not send anything to ${sink}`);
    }
    // Never persisted, by the harness or through it.
    for (const store of ['AsyncStorage', 'SecureStore', 'localStorage', 'MMKV', 'expo-file-system', 'kv-store']) {
      assert.equal(text.includes(store), false, `${name} must not persist through ${store}`);
    }
  }
  // The password field is masked, and the report carries SHAPES rather than values: a screenshot of
  // this screen is evidence, so it must be safe to attach to a review.
  // Code only: the module's own comment explains the masking, and an explanation is not a field.
  const harness = stripComments(read(`${VALIDATION_DIR}/AuthStorageValidationHarness.tsx`));
  assert.equal((harness.match(/secureTextEntry/gu) ?? []).length, 2, 'both password fields are masked');
  const procedure = read(`${VALIDATION_DIR}/auth-storage-validation.ts`);
  assert.match(procedure, /token=\$\{state\.accessToken\.length\}ch/u, 'the token is reported as a LENGTH, never a value');
  assert.equal(procedure.includes('accessToken}'), false, 'no interpolation of the token itself');
  assert.match(procedure, /sign-in refused: \$\{signedIn\.failure\.kind\}/u, 'a failure reports its KIND, never the credential');
});

test('Phase M — the validation entry exists, and nothing in the repository selects it', () => {
  assert.equal(existsSync(new URL(`${VALIDATION_DIR}/validation-entry.tsx`, root)), true);
  // `main` still points at the router. The validation build is produced by ONE documented local
  // change, and the repository never carries it — so a candidate can never accidentally ship the
  // harness as its root component.
  assert.equal(readJson('apps/mobile/package.json').main, 'expo-router/entry');
  const appConfig = read('apps/mobile/app.config.js');
  assert.equal(appConfig.includes('__validation__'), false, 'the Expo config does not select the harness');
  // And the runbook states the change verbatim, so the evidence can record exactly what was built.
  assert.match(read('docs/final-living-analysis-map-integration-v1-phase-m.md'), /validation-entry/u);
});

test('§28.30 — the gate registers itself, and the documents exist', () => {
  const manifest = readJson('package.json');
  assert.equal(manifest.scripts['test:t12-integration-contract'], 'node --test tests/t12-integration-contract.test.mjs');
  const workflow = read('.github/workflows/mobile-ci.yml');
  assert.match(workflow, /run: npm run test:t12-integration-contract/u, 'the gate runs in Mobile CI');
  // Registered exactly once. A gate registered twice is a workflow defect, not growth — and the two
  // registrations are different strings: the script invocation `test:…` and the trigger path
  // `tests/….test.mjs`, which is why each is counted on its own.
  assert.equal((workflow.match(/run: npm run test:t12-integration-contract\b/gu) ?? []).length, 1, 'exactly one gate step');
  assert.equal((workflow.match(/'tests\/t12-integration-contract\.test\.mjs'/gu) ?? []).length, 1, 'exactly one trigger path');
  assert.equal(existsSync(new URL('docs/final-living-analysis-map-integration-v1.md', root)), true);
  assert.equal(existsSync(new URL('docs/final-living-analysis-map-integration-v1-traceability.md', root)), true);
});
