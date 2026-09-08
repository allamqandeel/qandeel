import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// T-11 — Responsive Recomposition v1. Static executable contract over the frozen boundary.
//
// > **The window changes. The world does not.**
// > **Recompose density, never meaning.**
//
// The Jest suites under `apps/mobile/src/responsive/__tests__` prove the BEHAVIOUR — the plan, the
// bands, the parity across the whole envelope, the mid-scrub geometry ownership, the rigid shift
// under a travel. This gate guards what a passing unit test cannot: that a measurement never
// became authority, that the things the contract rejects are absent by CONSTRUCTION rather than
// merely unused, and that the responsive owner's boundary is a closure rather than a convention.
//
// ## Forward safety
//
// Nothing here is a ceiling on the repository. There is no whole-repo file count, no whole-file
// hash of a shared workflow or manifest, no dependency census, no "no migration after N" and no
// assertion that a mutable global has a particular size. Every claim is either a PERMANENT
// INVARIANT of the frozen architecture or a statement about files T-11 itself owns.
//
// Two facts that were true at closure are deliberately NOT frozen here, because freezing them
// would fail on authorized future work rather than on a defect: that the app shell mounts no
// Product surface at all, and that `react-native-safe-area-context` is imported nowhere. Mounting
// the surfaces and binding the safe-area provider is precisely T-12's job. What IS permanent — and
// is guarded below — is that the shell may only ever reach the responsive owner through its public
// barrel, and that the owner itself can never reach a store, an executor or a provider. Both facts
// are recorded as closure evidence in `docs/responsive-recomposition-v1.md`.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));

const RESPONSIVE_DIR = 'apps/mobile/src/responsive';
const CHROME_DIR = 'apps/mobile/src/orientation-chrome';
const MAP_DIR = 'apps/mobile/src/map';

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

function production(dir) {
  const absolute = join(rootPath, dir);
  return listFiles(absolute)
    .map((file) => file.slice(absolute.length + 1).replace(/\\/gu, '/'))
    .filter((file) => !file.startsWith('__tests__/') && !file.startsWith('__fixtures__/'))
    .sort();
}

const responsiveFiles = production(RESPONSIVE_DIR);
const responsiveSources = Object.fromEntries(responsiveFiles.map((file) => [file, read(`${RESPONSIVE_DIR}/${file}`)]));
const responsiveCode = Object.fromEntries(Object.entries(responsiveSources).map(([file, text]) => [file, stripComments(text)]));
const responsiveText = Object.values(responsiveCode).join('\n');

const chromeFiles = production(CHROME_DIR);
const chromeCode = Object.fromEntries(chromeFiles.map((file) => [file, stripComments(read(`${CHROME_DIR}/${file}`))]));
const chromeText = Object.values(chromeCode).join('\n');

const mapFiles = production(MAP_DIR);
const mapCode = Object.fromEntries(mapFiles.map((file) => [file, stripComments(read(`${MAP_DIR}/${file}`))]));
const mapText = Object.values(mapCode).join('\n');

const scrubCode = stripComments(read('apps/mobile/src/temporal-navigation/timeline-integration/useTemporalScrub.ts'));

/**
 * The T-08 modules that decide what is TRUE. Frozen by T-08's own contract as unable to reach an
 * animation, a measurement, a scheduler or a gesture; T-11 adds the reason the list matters here —
 * a truth module that could read a layout would let a window size decide a Product answer.
 */
const TRUTH_MODULES = [
  'types.ts',
  'inspection-orientation.ts',
  'return-orientation.ts',
  'context-orientation.ts',
  'model.ts',
  'product-copy.ts',
  'exact-return-origin.ts',
];

// ---------------------------------------------------------------------------------------------
// 1. The owner exists, and it is a closed presentation layer.
// ---------------------------------------------------------------------------------------------

test('the responsive owner is a narrow presentation layer with a stated file surface', () => {
  assert.ok(responsiveFiles.includes('index.ts'), 'the owner has one public barrel');
  for (const required of [
    'surface.ts',
    'plan.ts',
    'useResponsiveSurface.ts',
    'ResponsiveSurface.tsx',
    'ResponsiveMapFrame.tsx',
    'ResponsiveTimelineRow.tsx',
    'ResponsiveChromeBand.tsx',
  ]) {
    assert.ok(responsiveFiles.includes(required), `${required} is part of the responsive owner`);
  }
  // The plan is decided in plain arithmetic, before any component exists: the measurement
  // normalizer imports NOTHING, and the plan imports only it. No library, runtime, store,
  // projection or platform can reach the numbers.
  assert.equal((responsiveCode['surface.ts'].match(/^import /gmu) ?? []).length, 0, 'the surface normalizer imports nothing');
  const planImports = responsiveCode['plan.ts'].match(/from\s+'([^']+)'/gu) ?? [];
  assert.deepEqual(planImports, ["from './surface'"], 'the plan imports only its own measurement normalizer');
});

test('the owner names only packages the mobile app already declares, and only two of them', () => {
  const declared = new Set(Object.keys(readJson('apps/mobile/package.json').dependencies ?? {}));
  const specifiers = new Set();
  for (const [file, text] of Object.entries(responsiveCode)) {
    for (const match of text.matchAll(/from\s+'([^']+)'/gu)) if (!match[1].startsWith('.')) specifiers.add(match[1]);
    assert.doesNotMatch(text, /require\(/u, `${file} uses no dynamic require`);
  }
  // T-11 adds NO dependency, and needs none: a measured rect, a plan and three containers.
  for (const specifier of specifiers) {
    const pkg = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    assert.ok(declared.has(pkg), `T-11 adds no dependency: ${specifier} is not declared by the mobile app`);
  }
  assert.deepEqual([...specifiers].sort(), ['react', 'react-native'], 'the responsive owner reaches for nothing else at all');
});

test('the owner can reach no store, executor, projection, act or provider — by construction', () => {
  // Not "does not currently"; cannot. A relative import out of the owner is the only way any of
  // these could arrive, and there is none.
  for (const [file, text] of Object.entries(responsiveCode)) {
    for (const match of text.matchAll(/from\s+'(\.[^']+)'/gu)) {
      assert.match(match[1], /^\.\/[A-Za-z-]+$/u, `${file} may import only its own siblings, got ${match[1]}`);
    }
  }
  for (const forbidden of [
    'CanonicalStore',
    'createCanonicalStore',
    'dispatch',
    'useSyncExternalStore',
    'returnWorld',
    'returnLiveHead',
    'returnLiveFocus',
    'backOneStep',
    'exactReturn',
    'goLiveAndLocate',
    'commitPreviewedTarget',
    'commitMoment',
    'panByTranslation',
    'zoomSemanticStep',
    'exploreViewport',
    'inspectObject',
    'directJump',
    'switchContext',
    'deriveMapScene',
    'orientationModel',
    'SafeAreaProvider',
    'useSafeAreaInsets',
    'react-native-safe-area-context',
  ]) {
    assert.doesNotMatch(responsiveText, new RegExp(`\\b${forbidden}\\b`, 'u'), `the responsive owner never names ${forbidden}`);
  }
});

test('the owner holds no Product vocabulary, so no Product answer can be spelled here', () => {
  for (const forbidden of ['TC', 'PTC', 'FOLLOW_LIVE', 'PINNED', 'LiveFocus', 'SessionPosition', 'InspectionRef', 'checkpoint', 'RH']) {
    assert.doesNotMatch(responsiveText, new RegExp(`\\b${forbidden}\\b`, 'u'), `the responsive owner never names ${forbidden}`);
  }
  // Not one reader-facing word: every string it produces is a layout token, never a sentence.
  const strings = [...responsiveText.matchAll(/'([^']*)'/gu)].map((match) => match[1]);
  for (const value of strings) {
    assert.ok(value.length < 40 && !value.includes(' '), `the responsive owner writes no reader-facing copy, found ${JSON.stringify(value)}`);
  }
});

// ---------------------------------------------------------------------------------------------
// 2. Bands are consequences, never identities.
// ---------------------------------------------------------------------------------------------

test('no device, brand, model or platform is a responsive category anywhere', () => {
  const surfaces = [responsiveText, chromeText, mapText, scrubCode].join('\n');
  for (const forbidden of [
    'Platform\\.OS',
    'Platform\\.select',
    'isTablet',
    'isPhone',
    'isPad',
    'iPhone',
    'iPad',
    'Android',
    'deviceType',
    'DeviceInfo',
    'phone',
    'tablet',
    'desktop',
  ]) {
    assert.doesNotMatch(surfaces, new RegExp(forbidden, 'iu'), `no responsive surface branches on ${forbidden}`);
  }
});

test('no reusable surface takes the display as its authority', () => {
  // A Product surface does not own the display: it is composed inside something. The measured
  // container is the only responsive authority, in the owner and in every surface it composes.
  const surfaces = [responsiveText, chromeText, mapText, scrubCode].join('\n');
  // `Platform` is here as well as in the device guard above: importing it into a reusable surface
  // has no purpose except to branch on the machine, which is the same defect approached from the
  // other side.
  for (const forbidden of ['Dimensions', 'useWindowDimensions', 'PixelRatio', 'Screen\\b', 'screenWidth', 'screenHeight', 'windowWidth', '\\bPlatform\\b']) {
    assert.doesNotMatch(surfaces, new RegExp(forbidden, 'u'), `no reusable surface reads ${forbidden}`);
  }
  // and the one place a layout is measured at all is the responsive owner's own containers.
  const measuring = Object.entries(responsiveCode)
    .filter(([, text]) => /onLayout/u.test(text))
    .map(([file]) => file)
    .sort();
  assert.deepEqual(measuring, ['ResponsiveMapFrame.tsx', 'ResponsiveSurface.tsx', 'useResponsiveSurface.ts'], 'measurement lives in one owner');
  assert.doesNotMatch(chromeText, /onLayout/u, 'the chrome measures nothing');
});

test('the world is sized first, and the support around it yields', () => {
  const plan = responsiveCode['plan.ts'];
  const frame = responsiveCode['ResponsiveMapFrame.tsx'];
  const band = responsiveCode['ResponsiveChromeBand.tsx'];
  const row = responsiveCode['ResponsiveTimelineRow.tsx'];
  // The world's share is a FLOOR on its size, taken before the support asks for anything.
  assert.match(plan, /basisPoints: Math\.max\(MAP_MIN_HEIGHT_POINTS, Math\.round\(height \/ WORLD_SHARE_DENOMINATOR\)\)/u, 'the world is sized first');
  assert.match(frame, /frame: \{ flexGrow: 1, flexShrink: 0 \}/u, 'the world does not yield to the support around it');
  assert.match(frame, /flexBasis: frame\.basisPoints, minHeight: frame\.minHeightPoints/u, 'the world carries its share and its floor');
  // Both support regions yield, clip to what they were given, and keep the remainder reachable.
  assert.match(band, /flexShrink: 1, flexGrow: 0, overflow: 'hidden'/u, 'the chrome band yields and clips to the room it was given');
  assert.match(row, /flexShrink: TIMELINE_ROW_SHRINK,[\s\S]*?minHeight: TIMELINE_ROW_POINTS,[\s\S]*?overflow: 'hidden',/u, 'the temporal row yields to its own interactive minimum');
  assert.match(row, /TIMELINE_ROW_SHRINK = 2/u, 'the instrument yields before the orientation');
  for (const [name, text] of [['the chrome band', band], ['the temporal row', row]]) {
    assert.match(text, /<ScrollView/u, `${name} keeps what does not fit reachable inside itself`);
    // Bounce is suppressed only where there is NOTHING to reach. Disabling it outright would
    // remove the boundary damping in the one case that matters — when the region really is
    // holding more than it can show — and turn the end of the content into an invisible wall.
    assert.match(text, /alwaysBounceVertical=\{false\}/u, `${name} does not spring back over content that does not exist`);
    assert.doesNotMatch(text, /bounces=\{false\}/u, `${name} keeps the boundary damping it needs when it really is scrollable`);
  }
  // Only the WORDS are clamped to a reading measure. A Timeline is not prose, and every extra
  // point of it is one more disclosed Moment the reader can see and reach at once.
  assert.match(plan, /timelineWidthPoints: available,/u, 'the Timeline gets the whole available width');
  assert.match(plan, /const measurePoints = Math\.min\(available, CHROME_MAX_MEASURE_POINTS \+ 2 \* CHROME_OWN_HORIZONTAL_PADDING\);/u, 'only the chrome is clamped');
  // No region asserts a height it cannot know. A ceiling computed from a constant for a surface
  // whose height depends on unlaid-out words is what put a Return act off the screen.
  for (const [name, text] of [['the chrome band', band], ['the temporal row', row], ['the plan', plan]]) {
    assert.doesNotMatch(text, /maxHeight/u, `${name} asserts no height ceiling`);
  }
  assert.doesNotMatch(plan, /maxHeightPoints/u, 'the plan hands out no vertical ceiling at all');
});

test('R1 — the settled band is keyed to the usable width, not to the event that happened to move it', () => {
  const hook = responsiveCode['useResponsiveSurface.ts'];
  // The usable width has three authorities and only one of them is an event. A settlement taken in
  // the layout handler is correct for the measured width and stale for either inset (T11-R1-01), so
  // the handler stores the rect and NOTHING else, and carries no inset in its dependencies.
  assert.doesNotMatch(hook, /bandFor\([^)]*width - left - right/u, 'the band is not settled from the layout event');
  assert.match(hook, /const onLayout = useCallback\(\(event: LayoutChangeEvent\) => \{[\s\S]*?\}, \[\]\);/u, 'the layout handler depends on nothing');
  const measuredBlock = hook.match(/interface Measured \{[^}]*\}/u);
  assert.ok(measuredBlock !== null, 'the measurement shape is still declared');
  assert.doesNotMatch(measuredBlock[0], /band/u, 'the measurement does not carry a band');

  // The settlement is keyed to the usable width it was taken at, so it can never be reused across a
  // width it does not belong to, and the predecessor handed to `bandFor` is the band the
  // immediately preceding composition actually settled.
  assert.match(hook, /const usable = measured === null \? null : measured\.width - left - right;/u, 'the usable width comes from all three authorities');
  assert.match(hook, /interface Settled \{\s*\n\s*readonly usable: number;\s*\n\s*readonly band: PresentationBand;\s*\n\}/u, 'a settlement carries the width it was taken at');
  assert.match(
    hook,
    /if \(usable !== null && \(settled === null \|\| settled\.usable !== usable\)\) \{\s*\n\s*band = bandFor\(usable, settled === null \? null : settled\.band\);\s*\n\s*setSettled\(\{ usable, band \}\);/u,
    'the predecessor is the band the preceding composition settled, and the update is guarded',
  );

  // And it is done without any of the mechanisms the finding rules out.
  assert.doesNotMatch(hook, /useEffect|useLayoutEffect/u, 'no effect drives the settlement');
  assert.doesNotMatch(hook, /useRef/u, 'no ref is read during render');
  assert.doesNotMatch(hook, /setTimeout|setInterval|requestAnimationFrame|Date\.now/u, 'no timer decides a band');
  assert.doesNotMatch(hook, /key=/u, 'nothing is remounted to re-settle a band');
});

test('the two thresholds are derived quantities, and the hysteresis is bounded and pure', () => {
  const plan = responsiveCode['plan.ts'];
  // The width boundary is COMPOSED from the content-stress quantities rather than written down, so
  // it cannot drift away from the reasoning that produced it.
  assert.match(
    plan,
    /EXPANSIVE_MIN_WIDTH\s*=\s*\n?\s*2 \* PAIRED_MIN_CELL_POINTS \+ PAIRED_COLUMN_GAP_POINTS \+ 2 \* CHROME_OWN_HORIZONTAL_PADDING \+ 2 \* EXPANSIVE_BAND_PADDING/u,
    'the width boundary is derived from the readable cell, the touch gap and the two paddings',
  );
  assert.match(plan, /BAND_HYSTERESIS_POINTS = 8/u, 'the hysteresis is the 8-point rhythm');
  // Exactly two bands, and the hysteresis takes the settled band as an ARGUMENT rather than holding
  // state, so the same pair of inputs always produces the same band.
  assert.match(plan, /PRESENTATION_BANDS = Object\.freeze\(\['COMPACT', 'EXPANSIVE'\] as const\)/u, 'two bands, and only two');
  assert.match(plan, /export function bandFor\(usable: number, previous: PresentationBand \| null = null\): PresentationBand/u, 'the band is pure');
  assert.doesNotMatch(responsiveText, /setTimeout|setInterval|requestAnimationFrame|Date\.now|performance\.now/u, 'no timer is correctness authority');
});

// ---------------------------------------------------------------------------------------------
// 3. A measurement decides no Product answer.
// ---------------------------------------------------------------------------------------------

test('no T-08 truth module can see a layout, a measurement or the responsive owner', () => {
  for (const module of TRUTH_MODULES) {
    const text = chromeCode[module];
    assert.ok(text !== undefined, `${module} is still part of the chrome layer`);
    for (const forbidden of [
      'responsive',
      'width',
      'height',
      'breakpoint',
      'onLayout',
      'Dimensions',
      'measure',
      'viewport',
      'arrangement',
      'PAIRED',
      'STACKED',
    ]) {
      assert.doesNotMatch(text, new RegExp(`\\b${forbidden}\\b`, 'iu'), `${module} may not name ${forbidden}: what is true cannot depend on how large the screen is`);
    }
  }
});

test('the arrangement seam is an already-decided token, and it reaches only the layout', () => {
  // Two components take it, both by the same two-value union, and neither derives it.
  for (const component of ['OrientationChrome.tsx', 'ReturnControls.tsx']) {
    assert.match(chromeCode[component], /'STACKED' \| 'PAIRED'/u, `${component} takes an arrangement, never a measurement`);
  }
  assert.match(chromeCode['OrientationChrome.tsx'], /returnArrangement = 'STACKED'/u, 'the truthful arrangement is the default');
  assert.match(chromeCode['ReturnControls.tsx'], /arrangement = 'STACKED'/u, 'the truthful arrangement is the default');
  // It selects a style and nothing else: it never reaches the offered set, the order or a word.
  assert.match(chromeCode['ReturnControls.tsx'], /arrangement === 'PAIRED' \? styles\.pairedGroup : styles\.group/u, 'the arrangement selects a style');
  assert.doesNotMatch(chromeCode['ReturnControls.tsx'], /arrangement[^\n]*offered/u, 'the arrangement never filters the offered set');
  assert.doesNotMatch(chromeCode['ReturnControls.tsx'], /offered[^\n]*arrangement/u, 'the offered set never depends on the arrangement');
  assert.doesNotMatch(chromeCode['product-copy.ts'], /arrangement|paired|stacked/iu, 'no word depends on an arrangement');
});

test('compactness removes space, never truth', () => {
  // Nothing clips, truncates or hides an act behind an indirection anywhere in the chrome.
  for (const forbidden of ['numberOfLines', 'ellipsizeMode', 'adjustsFontSizeToFit', 'allowFontScaling', 'maxFontSizeMultiplier']) {
    assert.doesNotMatch(chromeText, new RegExp(`\\b${forbidden}\\b`, 'u'), `the chrome never uses ${forbidden}`);
  }
  for (const forbidden of ['More', 'showMore', 'overflowMenu', 'collapsed', 'truncate', 'Ellipsis']) {
    assert.doesNotMatch(responsiveText, new RegExp(`\\b${forbidden}\\b`, 'u'), `the responsive owner never introduces ${forbidden}`);
  }
  // The touch minimum is a FLOOR in the frozen chrome, and the paired cell adds no ceiling to it.
  assert.match(chromeCode['ReturnControls.tsx'], /minHeight: 44/u, 'a control is at least 44 points tall');
  assert.doesNotMatch(chromeCode['ReturnControls.tsx'], /maxHeight|maxWidth|numberOfLines/u, 'no cell caps the words it contains');
  assert.match(chromeCode['ReturnControls.tsx'], /pairedControl: \{ flexBasis: '48%', flexGrow: 1 \}/u, 'the paired cell is a basis, never a width');
});

test('every layout property the owner writes is direction-neutral', () => {
  // Language and layout direction are independent axes, and this layer must not quietly couple
  // them. It never reads a direction at all — and it never writes a PHYSICAL one either, so there
  // is nothing here for a right-to-left layout to mirror into a different meaning.
  for (const [file, text] of Object.entries(responsiveCode)) {
    for (const physical of [
      'marginLeft', 'marginRight', 'paddingLeft', 'paddingRight',
      'borderLeftWidth', 'borderRightWidth', 'left:', 'right:',
      "'row-reverse'", "textAlign: 'left'", "textAlign: 'right'",
    ]) {
      assert.ok(!text.includes(physical), `${file} writes a physical direction: ${physical}`);
    }
    for (const forbidden of ['I18nManager', 'isRTL', 'writingDirection', 'direction']) {
      assert.doesNotMatch(text, new RegExp(`\\b${forbidden}\\b`, 'u'), `${file} never reads a layout direction`);
    }
  }
  // The one place a physical side is named is the safe-area FACT, which is physical in the world:
  // a notch is on one side of a device, not on its start edge.
  assert.match(responsiveCode['surface.ts'], /readonly insetLeft: number;/u, 'insets name the physical edges they are');
  // The paired arrangement is logical too: React Native reverses `row` under a right-to-left
  // layout, so the frozen order of the acts survives in both directions.
  assert.match(chromeCode['ReturnControls.tsx'], /pairedGroup: \{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8 \}/u, 'the paired row is logical');
  assert.doesNotMatch(chromeCode['ReturnControls.tsx'], /row-reverse/u, 'nothing is mirrored by hand');
});

test('no responsive container can swallow the controls inside it', () => {
  // The Android defect T-08 documented and designed around: an `accessibilityLabel` on a grouping
  // container becomes its `contentDescription`, TalkBack focuses the container, and traversal into
  // it stops — so the independent controls become one unreadable node. Every container this layer
  // introduces is declared a non-element and carries no accessibility metadata of its own.
  for (const component of ['ResponsiveSurface.tsx', 'ResponsiveMapFrame.tsx', 'ResponsiveTimelineRow.tsx', 'ResponsiveChromeBand.tsx']) {
    const text = responsiveCode[component];
    assert.doesNotMatch(text, /accessibilityLabel/u, `${component} names nothing to a screen reader`);
    assert.doesNotMatch(text, /accessibilityHint/u, `${component} hints nothing`);
    assert.doesNotMatch(text, /accessible(?!\w)/u, `${component} declares itself no element`);
    assert.doesNotMatch(text, /accessibilityActions/u, `${component} claims no action route it does not have`);
  }
  // The two scroll containers say what they are: layout, not a node to stop on.
  for (const component of ['ResponsiveTimelineRow.tsx', 'ResponsiveChromeBand.tsx']) {
    assert.match(responsiveCode[component], /accessibilityRole="none"/u, `${component} is a layout container`);
  }
  // and the touch a control did not claim is never swallowed on its way to the world.
  assert.match(responsiveCode['ResponsiveChromeBand.tsx'], /pointerEvents="box-none"/u, 'the band claims no touch of its own');
  assert.match(responsiveCode['ResponsiveTimelineRow.tsx'], /pointerEvents="box-none"/u, 'the temporal row claims no touch of its own');
});

// ---------------------------------------------------------------------------------------------
// 4. The world.
// ---------------------------------------------------------------------------------------------

test('the Map world is never mirrored, and never refits itself to a window', () => {
  for (const forbidden of ['I18nManager', 'isRTL', 'writingDirection', 'scaleX', 'row-reverse', 'flexDirection']) {
    assert.doesNotMatch(mapText, new RegExp(`\\b${forbidden}\\b`, 'u'), `the Map never reads or applies ${forbidden}`);
  }
  const surfaces = [mapText, responsiveText].join('\n');
  for (const forbidden of ['fitTo', 'fitBounds', 'zoomToFit', 'recenter', 'reCenter', 'centerOn', 'autoFit', 'fitContent', 'compact\\(']) {
    assert.doesNotMatch(surfaces, new RegExp(forbidden, 'iu'), `resize recomputes the visible footprint only: ${forbidden} is absent`);
  }
  // The envelope is Class D by construction: it reaches the projection and the cull rectangle, and
  // nothing writes a canonical field from it.
  assert.match(read(`${MAP_DIR}/camera/viewport.ts`), /A rotation or a resize therefore recomputes what is \*visible\* and\n \* nothing else/u, 'T-04 resize law intact');
});

test('nothing is keyed by a width, a height or a band, so no measurement can remount a world', () => {
  const surfaces = [responsiveText, chromeText, mapText].join('\n');
  for (const match of surfaces.matchAll(/key=\{([^}]*)\}/gu)) {
    assert.doesNotMatch(match[1], /width|height|band|breakpoint|size|arrangement/iu, `a key may not carry a measurement: ${match[0]}`);
  }
  // and the responsive owner's containers are plain: they mount their children, they never key them.
  assert.doesNotMatch(responsiveText, /key=\{/u, 'the responsive containers key nothing');
});

test('a travel in flight is neither re-issued nor re-culled by a geometry change', () => {
  const surface = mapCode['renderer/MapSurface.tsx'];
  const rebase = mapCode['renderer/MapCanvas.tsx'];
  // The rebase runs only for a canonical camera CHANGE. A resize produces no transition, so a
  // travel already scheduled keeps its targets and its durations: nothing restarts, nothing snaps.
  assert.match(rebase, /if \(reset\) motion\.reset\(\);\s*\n\s*else if \(transition !== null\) motion\.applyCanonicalChange\(transition\);/u, 'the rebase is driven by a canonical transition');
  assert.match(surface, /const transition = cameraChanged && history !== null && camera !== null \? cameraTransition\(history\.camera, camera, envelope\) : null;/u, 'a transition exists only when the canonical camera changed');
  // The travel corridor is a RESIDUAL envelope. It is rebased through the canonical transition and
  // retired when the presentation reaches rest — neither of which a resize can cause — so a resize
  // can neither widen it, retain it, nor mix two viewports inside it.
  assert.match(surface, /rebasedEnvelope\(corridor, transition\.k, transition\.destination\)/u, 'the corridor is rebased by the transition, never by the envelope');
  assert.doesNotMatch(surface, /rebasedEnvelope\([^)]*envelope/u, 'the corridor is never derived from the envelope');
  assert.match(surface, /node\.region === 'UNGEOGRAPHIC_REGISTER' \? RESIDUAL_ENVELOPE_AT_REST : travelCorridor/u, 'the screen-space register never inherits the world residual');
});

// ---------------------------------------------------------------------------------------------
// 5. An interaction belongs to the geometry it began under.
// ---------------------------------------------------------------------------------------------

test('a coordinate taken under a replaced mapping can never commit a Moment', () => {
  // The generation exists, it advances only for the two quantities the MAPPING is taken through,
  // and a live interaction is retired through T-06's OWN interruption route rather than a new one.
  assert.match(scrubCode, /const geometryGeneration = useSharedValue\(FIRST_GEOMETRY_GENERATION\)/u, 'the mapping carries a generation');
  assert.match(scrubCode, /const gestureGeometry = useSharedValue\(FIRST_GEOMETRY_GENERATION\)/u, 'an interaction carries the generation it began under');
  assert.match(scrubCode, /gestureGeometry\.set\(geometryGeneration\.get\(\)\)/u, 'the generation is stamped at the first point of the gesture');
  assert.match(
    scrubCode,
    /if \(previous === null \|\| \(previous\.viewport === geometry\.viewport && previous\.rtl === geometry\.rtl\)\) return;/u,
    'only the viewport and the direction replace a mapping',
  );
  assert.match(scrubCode, /if \(tracking\.get\(\) === 1\) handlers\.settle\(epoch\.get\(\), false\);/u, 'a live interaction is retired through the interruption route');
  assert.match(
    scrubCode,
    /if \(geometryGeneration\.get\(\) !== gestureGeometry\.get\(\)\) return NO_STEP;/u,
    'a stale coordinate is dropped rather than converted',
  );
  // The window offset is deliberately NOT a mapping change: scrolling during a scrub is a
  // presentation move T-05 and T-06 already support, and the finger keeps pointing where it points.
  assert.doesNotMatch(scrubCode, /previous\.windowOffset/u, 'a window offset change is not a mapping change');
  // No timer decides any of it, and the responsive owner is not in the dependency path.
  assert.doesNotMatch(scrubCode, /setTimeout|setInterval|Date\.now/u, 'no timer is correctness authority');
  assert.doesNotMatch(scrubCode, /from '\.\.\/\.\.\/responsive'/u, 'the temporal guard needs no presentation layer to be mounted');
});

// ---------------------------------------------------------------------------------------------
// 6. No new Product state, act, mode, motion or backend.
// ---------------------------------------------------------------------------------------------

test('responsive recomposition stays the Class-D identity the kernel already froze it as', () => {
  // T-02's frozen catalog ALREADY carries `RESPONSIVE_RECOMPOSITION`, registered for
  // classification only, owned by T-11, with no authority and no transactional category. T-11
  // landing does not promote it: the whole point of the entry is that a layout event is not a
  // Product act, and the store refuses the class rather than the payload.
  const actions = stripComments(read('apps/mobile/src/state/actions.ts'));
  assert.match(actions, /NON_STORE_IDENTITY_TYPES = Object\.freeze\(\[[\s\S]*?'RESPONSIVE_RECOMPOSITION',/u, 'the identity is a non-store one');
  assert.match(
    actions,
    /RESPONSIVE_RECOMPOSITION: \{\s*\n\s*id: 'RESPONSIVE_RECOMPOSITION',\s*\n\s*frozenName: 'Responsive recomposition \(layout event\)',\s*\n\s*cls: 'D',\s*\n\s*level: 'NOT_STORE_ACTION',\s*\n\s*owner: 'T-11',\s*\n\s*substrateOwner: null,\s*\n\s*authority: fields\(\),\s*\n\s*transactional: 'NEVER',/u,
    'T-11 did not promote its own identity: Class D, not a store action, no authority, never transactional',
  );
  // and it is not a member of any executable action union.
  for (const union of ['KernelAction', 'MapAction', 'TemporalAction', 'ReturnAction']) {
    const match = actions.match(new RegExp(`export type ${union} =([\\s\\S]*?);\\n`, 'u'));
    assert.ok(match !== null, `${union} is still declared`);
    assert.doesNotMatch(match[1], /RESPONSIVE|BREAKPOINT|LAYOUT|VIEWPORT/u, `${union} gains no responsive member`);
  }
  // No canonical FIELD learned about a layout either.
  const classes = stripComments(read('apps/mobile/src/state/classes.ts'));
  for (const forbidden of ['responsive', 'breakpoint', 'viewportWidth', 'fontScale', 'arrangement', 'insetBottom']) {
    assert.doesNotMatch(classes, new RegExp(`\\b${forbidden}\\b`, 'iu'), `canonical state never learns about ${forbidden}`);
  }
  // The two temporal modes are still the only two.
  assert.match(classes, /'FOLLOW_LIVE'/u, 'FOLLOW_LIVE remains');
  assert.match(classes, /'PINNED'/u, 'PINNED remains');
  assert.doesNotMatch(classes, /'RESPONSIVE'|'COMPACT_MODE'|'WIDE_MODE'/u, 'no third temporal mode');
});

test('T-11 invents no motion vocabulary, and cannot fire a cue', () => {
  for (const forbidden of [
    'react-native-reanimated',
    'withTiming',
    'withSpring',
    'withDelay',
    'withSequence',
    'Animated',
    'Easing',
    'useSharedValue',
    'LayoutAnimation',
    'duration',
    'easing',
    'ignition',
    'Ignition',
  ]) {
    assert.doesNotMatch(responsiveText, new RegExp(`\\b${forbidden}\\b`, 'u'), `the responsive owner never names ${forbidden}`);
  }
  // Continuous resize tracks the container directly. A band that eased into place would make a
  // window resize read as navigation, and a window is not a destination.
  assert.match(responsiveSources['ResponsiveChromeBand.tsx'], /Nothing in this file animates/u, 'the band states its own KEEP STILL');
});

test('T-11 touches no backend, database, schema or migration', () => {
  const changed = [...responsiveFiles.map((file) => `${RESPONSIVE_DIR}/${file}`), 'apps/mobile/src/temporal-navigation/timeline-integration/useTemporalScrub.ts'];
  for (const file of changed) {
    const text = read(file);
    for (const forbidden of ['fetch(', 'axios', 'supabase', 'CREATE TABLE', 'migration', 'sql`', 'pg.', 'http://', 'https://']) {
      assert.ok(!text.includes(forbidden), `${file} never names ${forbidden}`);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// 7. Boundaries with the tasks on either side.
// ---------------------------------------------------------------------------------------------

test('T-11 never reaches for the app shell, and the shell may reach T-11 only through its barrel', () => {
  assert.doesNotMatch(responsiveText, /from '\.\.\/(app|shell)/u, 'the responsive owner never reaches the shell');
  for (const file of ['apps/mobile/src/app/_layout.tsx', 'apps/mobile/src/app/index.tsx', 'apps/mobile/src/shell/FoundationShell.tsx']) {
    const text = read(file);
    for (const match of text.matchAll(/from\s+'([^']*responsive[^']*)'/gu)) {
      assert.match(match[1], /responsive$/u, `${file} may reach T-11 only through its barrel, got ${match[1]}`);
    }
  }
});

test('the barrel is an allowlist, and the deep modules are not a second public surface', () => {
  const barrel = responsiveSources['index.ts'];
  assert.doesNotMatch(stripComments(barrel), /export \* from/u, 'the public surface is an allowlist, never a wildcard');
  // Every consumer outside the owner comes through the barrel. A deep import would reach past it.
  const mobileRoot = join(rootPath, 'apps/mobile/src');
  for (const file of listFiles(mobileRoot)) {
    const relative = file.slice(mobileRoot.length + 1).replace(/\\/gu, '/');
    if (relative.startsWith('responsive/')) continue;
    const text = stripComments(readFileSync(file, 'utf8'));
    for (const match of text.matchAll(/from\s+'([^']*\/responsive\/[^']*)'/gu)) {
      assert.fail(`${relative} deep-imports the responsive owner: ${match[1]}`);
    }
  }
});

test('T-12 and T-13 remain unstarted: no provider, no locale authority, no journey origin, no persistence', () => {
  for (const forbidden of [
    'SafeAreaProvider',
    'SafeAreaView',
    'useSafeAreaInsets',
    'LocaleProvider',
    'i18n',
    'bindExactReturnOrigin',
    'journeyOrigin',
    'AsyncStorage',
    'MMKV',
    'persist',
    'restore',
    'rehydrate',
  ]) {
    assert.doesNotMatch(responsiveText, new RegExp(`\\b${forbidden}\\b`, 'u'), `T-11 never names ${forbidden}`);
  }
  // Insets and the font scale are SEAMS with neutral defaults, not ownership.
  assert.match(responsiveCode['useResponsiveSurface.ts'], /readonly insets\?: ResponsiveInsets/u, 'insets arrive as an explicit seam');
  assert.match(responsiveCode['useResponsiveSurface.ts'], /readonly fontScale\?: number/u, 'the font scale arrives as an explicit seam');
  assert.match(responsiveCode['useResponsiveSurface.ts'], /quantizeFontScale\(fontScale \?\? 1\)/u, 'the neutral default is 1');
});

// ---------------------------------------------------------------------------------------------
// 8. Governance and CI.
// ---------------------------------------------------------------------------------------------

test('the canonical backlog still says T-11 inherits nothing, and T-11 records it', () => {
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  assert.match(backlog, /\| `T-11` \| none \|/u, 'the register says T-11 inherits none');
  assert.match(backlog, /T-11 inherits nothing from this backlog/u, 'and says so in prose');
  const doc = read('docs/responsive-recomposition-v1.md');
  assert.match(doc, /T-11 backlog inheritance: NONE/u, 'T-11 records the kickoff gate verbatim');
});

test('the gate is registered exactly once, and runs on the paths it guards', () => {
  const scripts = readJson('package.json').scripts ?? {};
  assert.equal(scripts['test:t11-responsive-contract'], 'node --test tests/t11-responsive-contract.test.mjs', 'the gate has one script');
  const workflow = read('.github/workflows/mobile-ci.yml');
  const registrations = [...workflow.matchAll(/npm run test:t11-responsive-contract/gu)];
  assert.equal(registrations.length, 1, 'the gate is registered exactly once');
  assert.match(workflow, /'tests\/t11-responsive-contract\.test\.mjs'/u, 'the gate runs when its own file changes');
  assert.match(workflow, /Verify Responsive Recomposition contract \(T-11\)/u, 'the gate is named by its owner');
});

test('the documentation records the contract this gate enforces', () => {
  const doc = read('docs/responsive-recomposition-v1.md');
  for (const required of [
    'The window changes. The world does not.',
    'Recompose density, never meaning.',
    'EXPANSIVE_MIN_WIDTH',
    'SHORT_HEIGHT_POINTS',
    'MAP_MIN_HEIGHT_POINTS',
    'CHROME_MAX_MEASURE_POINTS',
  ]) {
    assert.ok(doc.includes(required), `the responsive document records ${required}`);
  }
  const traceability = read('docs/responsive-recomposition-v1-traceability.md');
  for (const marker of ['T11-A01', 'T11-A80', 'PM-01', 'PM-30']) {
    assert.ok(traceability.includes(marker), `the traceability matrix covers ${marker}`);
  }
});
