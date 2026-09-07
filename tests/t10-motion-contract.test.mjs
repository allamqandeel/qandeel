import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// T-10 — Living Analysis Map Motion System v1. Static executable contract over the frozen boundary.
//
// > **Nothing teleports. Meaning resolves.**
//
// The Jest suites under `apps/mobile/src/motion/__tests__` prove the BEHAVIOUR — the rebase
// arithmetic, the six return choreographies, the one canonical `PAN`, the Scene Truth Cut. This
// gate guards what a passing unit test cannot: that motion never became authority, that the things
// §16 rejects are absent by construction rather than merely unused, and that the owner's boundary
// is a closure rather than a convention.
//
// ## Forward safety
//
// Nothing here is a ceiling on the repository. There is no whole-repo file count, no "no migration
// after N", no exact global test count, no whole-file hash of a shared workflow, and no assertion
// that a mutable global — the root toolchain, the mobile manifest, the CI step list — has a
// particular size. Every claim is either a PERMANENT INVARIANT of the frozen architecture or a
// statement about T-10's OWN files, which only T-10's owner can change.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const readJson = (path) => JSON.parse(read(path));

const MOTION_DIR = 'apps/mobile/src/motion';
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

const motionAbsolute = join(rootPath, MOTION_DIR);
const motionFiles = listFiles(motionAbsolute)
  .map((file) => file.slice(motionAbsolute.length + 1).replace(/\\/gu, '/'))
  .sort();
const motionProduction = motionFiles.filter((file) => !file.startsWith('__tests__/') && !file.startsWith('__fixtures__/'));
const motionSources = Object.fromEntries(motionProduction.map((file) => [file, read(`${MOTION_DIR}/${file}`)]));
const motionCode = Object.fromEntries(Object.entries(motionSources).map(([file, text]) => [file, stripComments(text)]));
const motionText = Object.values(motionCode).join('\n');

const mapAbsolute = join(rootPath, MAP_DIR);
const mapProduction = listFiles(mapAbsolute)
  .map((file) => file.slice(mapAbsolute.length + 1).replace(/\\/gu, '/'))
  .filter((file) => !file.startsWith('__tests__/') && !file.startsWith('__fixtures__/'))
  .sort();
const mapCode = Object.fromEntries(mapProduction.map((file) => [file, stripComments(read(`${MAP_DIR}/${file}`))]));
const mapText = Object.values(mapCode).join('\n');

const temporalMotion = stripComments(read('apps/mobile/src/temporal-navigation/motion/temporal-motion.ts'));
const temporalBinding = stripComments(read('apps/mobile/src/temporal-navigation/motion/useTemporalMotion.ts'));
const actionsCode = stripComments(read('apps/mobile/src/state/actions.ts'));
const classesCode = stripComments(read('apps/mobile/src/state/classes.ts'));

/** Every production surface T-10 is allowed to have moved, as one body of code. */
const productionText = [motionText, mapText, temporalMotion, temporalBinding].join('\n');

// ---------------------------------------------------------------------------------------------
// 1. The owner exists, and it is the only place the animation packages are named.
// ---------------------------------------------------------------------------------------------

test('the motion owner is a narrow presentation layer with a stated file surface', () => {
  assert.ok(motionProduction.length >= 8, `the motion owner has modules, found ${motionProduction.length}`);
  assert.ok(motionProduction.includes('index.ts'), 'the owner has one public barrel');
  for (const required of [
    'tokens.ts',
    'presentation-camera/residual.ts',
    'presentation-camera/travel-plan.ts',
    'presentation-camera/usePresentationCamera.ts',
    'presence/arrival.ts',
    'presence/DisclosureArrival.tsx',
    'cause/motion-cause.ts',
    'runtime/bridge.ts',
  ]) {
    assert.ok(motionProduction.includes(required), `${required} is part of the motion owner`);
  }
  // The vocabulary is decided in plain arithmetic, before any animation exists: the tokens and the
  // rebase import NOTHING, so no library, runtime or store can reach the numbers.
  assert.equal((motionCode['tokens.ts'].match(/^import /gmu) ?? []).length, 0, 'the tokens import nothing');
  assert.equal((motionCode['presentation-camera/residual.ts'].match(/^import /gmu) ?? []).length, 0, 'the rebase imports nothing');
});

test('every animation package is named inside the motion owner, and nowhere else in the Map', () => {
  const declared = new Set(Object.keys(readJson('apps/mobile/package.json').dependencies ?? {}));
  const specifiers = new Set();
  for (const text of Object.values(motionCode)) {
    for (const match of text.matchAll(/from\s+'([^']+)'/gu)) if (!match[1].startsWith('.')) specifiers.add(match[1]);
    assert.doesNotMatch(text, /require\(/u, 'the motion owner uses no dynamic require');
  }
  // T-10 adds NO dependency: every package it names is one the mobile app already declares.
  for (const specifier of specifiers) {
    const pkg = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    assert.ok(declared.has(pkg), `T-10 adds no dependency: ${specifier} is not declared by the mobile app`);
  }
  assert.ok(specifiers.has('react-native-reanimated'), 'the owner is where Reanimated is named');
  assert.ok(specifiers.has('react-native-worklets'), 'the owner is where the runtime crossing is named');

  // And the Map layer's own dependency surface is unchanged: it still names exactly its five, so a
  // presentation camera reached it through a relative import rather than through a new package.
  const mapSpecifiers = new Set();
  for (const text of Object.values(mapCode)) {
    for (const match of text.matchAll(/from\s+'([^']+)'/gu)) if (!match[1].startsWith('.')) mapSpecifiers.add(match[1]);
  }
  assert.deepEqual(
    [...mapSpecifiers].sort(),
    ['@qandeel/runtime', '@shopify/react-native-skia', 'react', 'react-native', 'react-native-gesture-handler'],
  );

  // No second animation library entered the tree under any name.
  const lock = readJson('package-lock.json');
  for (const name of ['framer-motion', 'moti', 'lottie-react-native', 'react-native-animatable', '@legendapp/motion', 'react-spring', 'popmotion', 'react-native-redash']) {
    const copies = Object.keys(lock.packages).filter((key) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`));
    assert.deepEqual(copies, [], `${name} must not be installed`);
  }
});

// ---------------------------------------------------------------------------------------------
// 2. Motion is never authority. (§2.4, PM-01)
// ---------------------------------------------------------------------------------------------

test('the motion owner cannot reach a store, an executor, a projection or a Product act', () => {
  // A CLOSURE, not a denylist: the owner may import from itself and from packages, and from no
  // other layer of this app at all. A helper added tomorrow is guarded the day it is imported.
  for (const [file, text] of Object.entries(motionCode)) {
    for (const match of text.matchAll(/from\s+'(\.[^']*)'/gu)) {
      assert.ok(
        !match[1].includes('..' + '/..'),
        `${file} reaches outside the motion owner: ${match[1]}`,
      );
    }
  }
  for (const forbidden of [
    'CanonicalStore',
    'CanonicalState',
    'createCanonicalStore',
    'dispatch',
    'dispatchMap',
    'dispatchTemporal',
    'dispatchReturn',
    'getState',
    'subscribe',
    'ingest(',
    'MapScene',
    'MapInspectionContext',
    'HistoricalDisclosure',
    'entitle',
    'locatab',
    'PTC',
    'RhEntry',
    'checkpoint',
  ]) {
    assert.equal(motionText.includes(forbidden), false, `the motion owner must not reach ${forbidden}`);
  }
  // Every frozen Product identity is unreachable from here by name.
  for (const id of ['PAN', 'ZOOM_SEMANTIC', 'COMMIT_MOMENT', 'COMMIT_LIVE_EDGE', 'INSPECT_OBJECT', 'SWITCH_CONTEXT', 'DIRECT_JUMP', 'COMMIT_MOMENT_AND_LOCATE', 'CHOOSE_LOCUS', 'RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'RETURN_WORLD', 'EXACT_RETURN', 'BACK_ONE_STEP']) {
    assert.equal(motionText.includes(id), false, `the motion owner must not name the act ${id}`);
  }
  // The ONE exception is the composite identity, matched by value so the beat can exist at all.
  // It is compared, never constructed, never dispatched, and never returned to a caller.
  const cause = motionCode['cause/motion-cause.ts'];
  assert.match(cause, /const COMPOSITE_RETURN_ID = 'GO_LIVE_AND_LOCATE';/u);
  // Exactly two modules may name it: the cause TYPE that the plan reads, and the channel that
  // matches it by value. Neither constructs, dispatches or returns a Product act.
  const namesComposite = Object.entries(motionCode)
    .filter(([, text]) => text.includes('GO_LIVE_AND_LOCATE'))
    .map(([file]) => file)
    .sort();
  assert.deepEqual(namesComposite, ['cause/motion-cause.ts', 'presentation-camera/travel-plan.ts']);
  assert.match(motionCode['presentation-camera/travel-plan.ts'], /export type PresentationMotionCause = 'GO_LIVE_AND_LOCATE';/u);
});

test('no animation completion can reach canonical state (§2.4, PM-01)', () => {
  // Reanimated hands a completion callback as the LAST argument of an animation function. The
  // owner passes none: not to timing, not to spring, not to sequence, not to delay. There is
  // therefore no callback in production motion that could dispatch, commit, cancel or authorize.
  for (const call of ['withTiming', 'withSpring', 'withDelay', 'withSequence']) {
    for (const match of motionText.matchAll(new RegExp(`${call}\\(`, 'gu')) ) {
      const tail = motionText.slice(match.index, match.index + 400);
      assert.doesNotMatch(tail, /,\s*\(\s*finished/u, `${call} must take no completion callback`);
      assert.doesNotMatch(tail, /,\s*\(\)\s*=>/u, `${call} must take no completion callback`);
    }
  }
  assert.equal(motionText.includes('finished'), false, 'no production motion observes its own completion');
  // The single crossing to the Product runtime exists once, is a worklet, and is a plain forward.
  const bridge = motionCode['runtime/bridge.ts'];
  assert.match(bridge, /export function handoffToProduct/u);
  assert.match(bridge, /scheduleOnRN\(fn, \.\.\.args\);/u);
  assert.equal((motionText.match(/scheduleOnRN\(/gu) ?? []).length, 1, 'the crossing exists in exactly one place');
  assert.equal(productionText.includes('runOnJS'), false, 'runOnJS is removed in Reanimated 4');
});

// ---------------------------------------------------------------------------------------------
// 3. The frozen vocabularies are unchanged. (§21.1, §21.2, §21.3)
// ---------------------------------------------------------------------------------------------

test('T-10 adds no canonical field, no Product act and no temporal mode', () => {
  assert.match(classesCode, /CANONICAL_STATE_KEYS = Object\.freeze\(\['session', 'live', 'temporal', 'inspection', 'camera', 'history'\] as const\)/u);
  assert.match(classesCode, /export type TemporalMode = \{ readonly kind: 'FOLLOW_LIVE' \} \| \{ readonly kind: 'PINNED'; readonly at: SessionPosition \};/u);
  assert.match(actionsCode, /KERNEL_ACTION_TYPES = Object\.freeze\(\['PAN', 'ZOOM_SEMANTIC', 'COMMIT_MOMENT', 'COMMIT_LIVE_EDGE'\] as const\);/u);
  assert.match(actionsCode, /MAP_ACTION_TYPES = Object\.freeze\(\['INSPECT_OBJECT', 'SWITCH_CONTEXT', 'DIRECT_JUMP'\] as const\);/u);
  assert.match(actionsCode, /TEMPORAL_ACTION_TYPES = Object\.freeze\(\['COMMIT_MOMENT_AND_LOCATE', 'CHOOSE_LOCUS'\] as const\);/u);
  const returnTypes = actionsCode.match(/RETURN_ACTION_TYPES = Object\.freeze\(\[([\s\S]*?)\] as const\)/u);
  assert.ok(returnTypes, 'the return family is a literal array');
  assert.deepEqual(
    [...returnTypes[1].matchAll(/'([A-Z_]+)'/gu)].map((match) => match[1]).sort(),
    ['BACK_ONE_STEP', 'EXACT_RETURN', 'GO_LIVE_AND_LOCATE', 'RETURN_LIVE_FOCUS', 'RETURN_LIVE_HEAD', 'RETURN_WORLD'],
  );
  // Reduced motion was ALREADY T-10's, and it is still a Class-D non-store identity.
  assert.match(actionsCode, /id: 'REDUCED_MOTION_PREFERENCE',[\s\S]*?cls: 'D',[\s\S]*?level: 'NOT_STORE_ACTION',[\s\S]*?owner: 'T-10',/u);
});

// ---------------------------------------------------------------------------------------------
// 4. Q1 — the frozen PAN mechanic. (§5 Q1, §21.14, §21.15)
// ---------------------------------------------------------------------------------------------

test('Q1 — one completed drag is one PAN, from the finger, with no momentum anywhere', () => {
  const gesture = mapCode['camera/useMapPanGesture.ts'];
  // `panFromTranslation` remains the authority, reached through the one executor, once.
  assert.match(mapCode['camera/pan.ts'], /export function panFromTranslation\(camera: MapCamera, translationX: number, translationY: number\): PanResolution \{/u);
  assert.equal((gesture.match(/panByTranslation\(/gu) ?? []).length, 1, 'exactly one place commits a drag');
  assert.match(gesture, /const outcome = panByTranslation\(current\.store, translationX, translationY\);/u);
  // ...and it is reached ONLY from a successful gesture end, with the finger's own translation AND
  // the authority generation the drag began under (R1-01 re-anchor).
  assert.match(gesture, /if \(success\) handoffToProduct\(settle, event\.translationX, event\.translationY, authority\.captured\.get\(\)\);/u);

  // No momentum, in any form, anywhere in production motion.
  for (const forbidden of ['withDecay', 'deceleration', 'velocityX', 'velocityY', 'momentum', 'fling', 'inertia']) {
    assert.equal(productionText.includes(forbidden), false, `no canonical momentum: ${forbidden} must not exist`);
  }
  // No second commit boundary: nothing dispatches from a settle, a rest, a frame or a completion.
  for (const forbidden of ['onRest', 'atRestCommit', 'commitAtRest', 'settleCommit']) {
    assert.equal(productionText.includes(forbidden), false, `no settle commit: ${forbidden}`);
  }
  // The per-frame path writes shared values and nothing else: no React state, no crossing.
  const perFrame = gesture.slice(gesture.indexOf('.onChange('), gesture.indexOf('.onEnd('));
  assert.ok(perFrame.length > 0, 'the gesture has a per-frame path to check');
  assert.deepEqual([...perFrame.matchAll(/camera\.(\w+)\(/gu)].map((match) => match[1]), ['dragBy']);
  assert.equal(perFrame.includes('handoffToProduct'), false, 'no runtime crossing per gesture frame');
  assert.equal(perFrame.includes('setState'), false, 'no React state per gesture frame');
  assert.equal(perFrame.includes('panByTranslation'), false, 'no Product act per gesture frame');
  // The old per-frame React-state path is gone entirely.
  for (const forbidden of ['MapPanProgress', 'IDLE_PAN_PROGRESS', 'panTranslationX', 'panTranslationY', 'setProgress']) {
    assert.equal(mapText.includes(forbidden), false, `the per-frame React-state pan path is gone: ${forbidden}`);
  }
});

// ---------------------------------------------------------------------------------------------
// 5. §6 — the Scene Truth Cut. There is no exit path to fail.
// ---------------------------------------------------------------------------------------------

test('§6.1 — nothing in production can keep an object the current V no longer discloses', () => {
  for (const forbidden of [
    'exiting',
    'Exiting',
    'onExited',
    'presentedNodes',
    'presentedSet',
    'previousScene',
    'lastScene',
    'cachedScene',
    'fallbackScene',
    'crossfade',
    'crossFade',
    'foldBack',
    'fold-back',
    'LayoutAnimation',
    'FadeOut',
    'exitAnimation',
    'snapshot(',
  ]) {
    assert.equal(productionText.includes(forbidden), false, `an object that left V must not survive as ${forbidden}`);
  }
  // The renderer paints from the set the SURFACE presented, and from nothing else.
  //
  // R1-02 re-anchor. It used to cull against the final canonical viewport itself, which made an
  // object still in current `V` vanish the moment the camera it was travelling toward no longer
  // contained it — culling wearing the clothes of semantic absence. The decision moved to the
  // surface, which makes it against the PRESENTED viewport; the renderer now has no culling
  // vocabulary at all, which is the strongest form of "it cannot confuse the two".
  const canvas = mapCode['renderer/MapCanvas.tsx'];
  assert.equal(canvas.includes('visibleNodes'), false, 'the renderer holds no culling decision of its own');
  assert.equal(canvas.includes('withinViewport'), false, 'the renderer holds no culling decision of its own');
  assert.match(canvas, /const planeNodes = presented\.filter\(\(node\) => node\.region === 'WORLD_PLANE'\);/u);
  assert.match(canvas, /const registerNodes = presented\.filter\(\(node\) => node\.region === 'UNGEOGRAPHIC_REGISTER'\);/u);
  // And the surface derives it from the FULL placement through the presentation-aware test, so an
  // object leaves the paint set only when the travel can no longer put it on the glass.
  const surface = mapCode['renderer/MapSurface.tsx'];
  assert.match(surface, /placed\.nodes\.filter\(\(node\) =>\s*\n?\s*isPresentedDuringTravel\(/u);
  assert.match(motionCode['presentation-camera/culling.ts'], /export function isPresentedDuringTravel\(/u);
  // The residual it culls against OUTLIVES the commit that armed it: an incidental re-render during
  // a travel must not collapse the presented viewport back onto the destination.
  assert.match(surface, /readonly startResidual: PresentationResidual;/u);
  assert.match(surface, /history\.startResidual/u);
  // The one shared freshness rule is unweakened.
  assert.match(mapCode['renderer/MapSurface.tsx'], /const usable = camera !== null && freshness\.fresh;/u);
  assert.match(mapCode['renderer/MapSurface.tsx'], /usable && camera !== null \? placeScene\(/u);
  assert.match(mapCode['renderer/MapSurface.tsx'], /useSyncExternalStore\(store\.subscribe, store\.getState\)/u);
});

test('§13 — the rebase is issued from inside the Skia root, after the positions it assumes', () => {
  const canvas = mapCode['renderer/MapCanvas.tsx'];
  // The component exists, renders nothing, and is the ONLY caller of the rebase.
  assert.match(canvas, /function PresentationCameraRebase\(/u);
  assert.equal((canvas.match(/motion\.applyCanonicalChange\(/gu) ?? []).length, 1, 'exactly one place rebases');
  assert.equal((mapText.match(/applyCanonicalChange\(/gu) ?? []).length, 1);
  // It is a CHILD of the transformed plane, and the LAST one: siblings run their layout effects in
  // order, so the residual lands in the same inner commit as the node positions it preserves.
  const plane = canvas.slice(canvas.indexOf('<Group transform={motion.planeTransform}'), canvas.indexOf('</Group>', canvas.indexOf('<PresentationCameraRebase')));
  assert.ok(plane.length > 0, 'the plane group contains the rebase');
  assert.match(plane, /<PresentationCameraRebase motion=\{motion\} cameraCommit=\{cameraCommit\} \/>\s*$/u);
  assert.match(canvas, /useLayoutEffect\(/u, 'the rebase is issued in a layout effect, not a passive one');
  // And it drops the residual outright when the surface stops painting this world.
  assert.match(canvas, /useLayoutEffect\(\(\) => \(\) => motion\.reset\(\), \[motion\]\);/u);

  // A preserved frame keeps its SIZES too. An object's radius and a tether's stroke are screen
  // quantities at every rung, so the plane's residual zoom is undone per object and per stroke —
  // otherwise a depth step shrinks the world to an eighth and grows it back, which is an optical
  // zoom rather than a disclosure (PM-04).
  // Nesting order is load-bearing: the arrival is OUTSIDE so its from-host travel is measured in
  // the placement's own space and starts exactly at the host as drawn; the counter-scale is INSIDE
  // so it corrects only the object's size.
  assert.match(
    canvas,
    /<DisclosureArrival key=\{node\.key\}[^>]*>\s*<Group transform=\{motion\.objectTransform\} origin=\{vec\(node\.x, node\.y\)\}>/u,
  );
  assert.match(canvas, /strokeWidth=\{motion\.objectScale\}/u);
  assert.match(motionCode['presentation-camera/residual.ts'], /export function counterScale\(zoom: number\): number \{/u);
});

// ---------------------------------------------------------------------------------------------
// 5a. R1 — the five integration seams the independent review found, guarded structurally.
// ---------------------------------------------------------------------------------------------

test('R1-01 — an in-flight drag cannot be re-routed into a replacement store', () => {
  const gesture = mapCode['camera/useMapPanGesture.ts'];
  // The generation is stamped when the drag BEGINS, carried across the crossing, and compared
  // before anything is dispatched. A drag that outlived its owner reaches no store at all.
  assert.match(gesture, /authority\.capture\(\);/u, 'the drag is stamped at begin');
  assert.match(gesture, /if \(generation !== authority\.current\(\)\) \{/u, 'the crossing re-checks the authority');
  const settle = gesture.slice(gesture.indexOf('const settle = useCallback('), gesture.indexOf('const discard = useCallback('));
  assert.ok(settle.length > 0, 'the completion path exists');
  // The refusal comes BEFORE the only dispatch in the file, so no ordering can put an act first.
  assert.ok(
    settle.indexOf('authority.current()') < settle.indexOf('panByTranslation('),
    'staleness is decided before anything is dispatched',
  );
  assert.match(settle, /camera\.reset\(\);\s*\n\s*return;/u, 'a stale drag drops its residual and returns');
  // And the presentation makes the same distinction: a replaced authority has no continuity to
  // preserve, so the camera is reset rather than rebased across two unrelated worlds.
  assert.match(mapCode['renderer/MapSurface.tsx'], /const authorityReplaced = history !== null && history\.owner !== store;/u);
  assert.match(
    mapCode['renderer/MapCanvas.tsx'],
    /if \(reset\) motion\.reset\(\);\s*\n\s*else if \(transition !== null\) motion\.applyCanonicalChange\(transition\);/u,
  );
  assert.match(motionCode['runtime/authority.ts'], /export function useAuthorityGeneration\(owner: unknown\): AuthorityGeneration \{/u);
});

test('R1-03 — semantic arrival can never be derived from culling or from a mount', () => {
  const arrival = motionCode['presence/arrival.ts'];
  // The recipe's own input is a MEMBERSHIP transition. There is no mount, viewport, visibility or
  // culling vocabulary in it at all, so there is nothing for a viewport to be mistaken for.
  assert.match(arrival, /readonly newlyDisclosed: boolean;/u);
  for (const forbidden of ['visible', 'visibleNodes', 'mount', 'established', 'viewport', 'culled', 'onScreen']) {
    assert.equal(arrival.includes(forbidden), false, `an arrival must not know about ${forbidden}`);
  }
  // The diff is over the FULL placement of the previous commit, so a node that was merely off the
  // glass is not new when culling lets it back in.
  assert.match(
    arrival,
    /export function newlyDisclosedKeys\(previous: ReadonlySet<string> \| null, currentKeys: readonly string\[\]\): ReadonlySet<string>/u,
  );
  const surface = mapCode['renderer/MapSurface.tsx'];
  assert.match(
    surface,
    /newlyDisclosedKeys\(authorityReplaced \? null : disclosureHistory\.get\(\), placed\.nodes\.map\(\(node\) => node\.key\)\)/u,
  );
  // The comparison is against the FULL previous placement, never against what was on the glass.
  assert.equal(surface.includes('placed.visibleNodes.map((node) => node.key)'), false);
  // And a REPLACED authority has no earlier `V` of its own, so its first placement discloses
  // nothing: the history belongs to the store it was recorded under, exactly as the drag does.
  // Without this, swapping the store would announce an entire world as newly disclosed.
  assert.match(surface, /newlyDisclosedKeys\(authorityReplaced \? null :/u);
  assert.match(surface, /disclosureHistory\.set\(placed === null \? null : new Set\(placed\.nodes\.map\(\(node\) => node\.key\)\)\);/u);
  // And the renderer asks the set, never the tree it happens to be rendering.
  assert.match(mapCode['renderer/MapCanvas.tsx'], /newlyDisclosed: newlyDisclosed\.has\(node\.key\),/u);
});

test('R1-04 — pointer parity covers the object-local motion, not only the plane residual', () => {
  const surface = mapCode['renderer/MapSurface.tsx'];
  const tap = surface.slice(surface.indexOf('const onTap = useCallback('), surface.indexOf('if (camera === null || placed === null)'));
  assert.ok(tap.length > 0, 'the pointer route exists');
  // BOTH transforms, in the one place a touch becomes an act.
  assert.match(tap, /motion\.canonicalPointAt\(\{ x, y \}\)/u, 'the plane residual is undone');
  assert.match(tap, /arrivals\.presentationOf\(node\.key\)/u, 'the object-local arrival is undone too');
  assert.match(tap, /radius: node\.radius \* shown\.scale/u, 'the hit radius follows the drawn size');
  // Paint and pointer read ONE progress through ONE recipe: there is no second copy to drift from.
  assert.match(
    motionCode['presence/arrival.ts'],
    /export function arrivalPresentation\(plan: DisclosureArrivalPlan, progress: number\): ArrivalPresentation \{/u,
  );
  assert.match(motionCode['presence/DisclosureArrival.tsx'], /const shown = arrivalPresentation\(entry, progress\.get\(\)\);/u);
  assert.match(motionCode['presence/arrival-registry.ts'], /arrivalPresentation\(entry\.plan, entry\.progress\.get\(\)\)/u);
  // And no interaction is gated on an animation finishing.
  for (const forbidden of ['disablePointer', 'interactionsDisabled', 'awaitAnimation', 'pointerEvents="none"']) {
    assert.equal(mapText.includes(forbidden), false, `animation completion must not gate interaction: ${forbidden}`);
  }
});

test('R1-05 — the composite cause cannot outlive the spatial phase it explains', () => {
  const cause = motionCode['cause/motion-cause.ts'];
  // It arms on the SPATIAL result of an outcome T-07 already returned — never on "applied" alone,
  // which the composite is whenever its temporal half succeeded and no camera moved at all.
  assert.match(cause, /const LANDED = 'LANDED';/u);
  assert.match(cause, /const landed = id === COMPOSITE_RETURN_ID && outcome\.outcome === 'APPLIED' && outcome\.locate === LANDED;/u);
  // Any outcome clears what was pending, so nothing can be inherited by a later, unrelated act.
  assert.match(cause, /pending = landed \? COMPOSITE_RETURN_ID : null;/u);
  assert.match(cause, /take: \(\) => \{[\s\S]*?pending = null;[\s\S]*?return cause;/u, 'reading consumes');
  // The channel still decides nothing about the world: it reads a status and holds one flag. Its
  // own import path is excluded, which is where the only remaining spatial word lives.
  const causeBody = cause.replace(/^import [^\n]*\n/gmu, '');
  for (const forbidden of ['locatab', 'entitle', 'projection', 'camera', 'anchor', 'depth', 'Thread', 'focus']) {
    assert.equal(causeBody.includes(forbidden), false, `the cause channel must not reason about ${forbidden}`);
  }
});

test('R1-06 — camera opacity reaches the world plane and nothing else', () => {
  const canvas = mapCode['renderer/MapCanvas.tsx'];
  // The plane's opacity group opens, contains the plane, and CLOSES before the register is painted.
  const opacityGroup = canvas.indexOf('<Group opacity={motion.planeOpacity}>');
  assert.ok(opacityGroup >= 0, 'the plane carries the camera opacity');
  assert.ok(canvas.indexOf('planeNodes.map(') > opacityGroup, 'the world plane is inside it');
  assert.ok(
    canvas.indexOf('registerNodes.map(') > canvas.lastIndexOf('</Group>'),
    'the screen-space register is painted outside every camera group',
  );
  // The register is not translated or scaled by the camera either: its own coordinates, unmodified.
  const registerBlock = canvas.slice(canvas.indexOf('registerNodes.map('));
  assert.equal(registerBlock.includes('motion.planeTransform'), false);
  assert.equal(registerBlock.includes('motion.objectTransform'), false);
  assert.equal(registerBlock.includes('motion.planeOpacity'), false);
  // It may still arrive on its own account, if its own membership changed.
  assert.match(registerBlock, /<DisclosureArrival/u);
});


// ---------------------------------------------------------------------------------------------
// 6. §16 — the hard creative rejections, absent by construction.
// ---------------------------------------------------------------------------------------------

const REJECTED_TOKENS = [
  'fieldResponse',
  'neighbour',
  'neighbor',
  'breath',
  'Breath',
  'ambientMotion',
  'velocitySize',
  'arrivalBreath',
  'particle',
  'shimmer',
  'skeleton',
  'pageSlide',
  'sharedElement',
  'morphTo',
  'bounce',
  'Bounce',
  'stagger',
  'Stagger',
  'staggerMs',
  'ghost',
  'Ghost',
  'trail',
  'Trail',
  'tetherTension',
  'inspectionDim',
  'withRepeat',
  'lockFrame',
  'previewVeil',
  'worldVeil',
  'rubberBand',
  'cinematic',
  'overshoot',
  'withDecay',
  'deceleration',
  'momentum',
  'inertia',
  'useFrameCallback',
  'setInterval',
  'setTimeout',
  'requestAnimationFrame',
  'InteractionManager',
];

test('§16 — no rejected pattern exists in any production motion surface', () => {
  for (const forbidden of REJECTED_TOKENS) {
    assert.equal(productionText.includes(forbidden), false, `§16 rejects ${forbidden}`);
  }
  for (const forbidden of [/\bring\b/iu, /\bbloom\b/iu, /\bripple\b/iu, /\bglow\b/iu, /\bbrass\b/iu, /\bignition\b/iu, /\bpulse\b/iu, /\bparallax\b/iu, /\bhalo\b/iu]) {
    assert.doesNotMatch(motionText, forbidden, `§16 rejects ${String(forbidden)}`);
  }
  // No underdamped act-driven motion can be written: the one damping token is critical, and it is
  // the only damping value the owner has.
  assert.match(motionCode['tokens.ts'], /export const ACT_DAMPING_RATIO = 1;/u);
  assert.equal((motionText.match(/dampingRatio:\s*0/gu) ?? []).length, 0, 'no dampingRatio below 1');
  assert.match(temporalMotion, /export const CANCEL_DAMPING_RATIO = 1;/u);
  // No stagger can be expressed: the arrival plan has no delay of any kind to carry an order in.
  const arrival = motionCode['presence/arrival.ts'];
  assert.doesNotMatch(arrival, /delay/iu, 'an arrival carries no delay, so it can carry no order');
  assert.doesNotMatch(arrival, /index|ordinal|position/iu, 'an arrival knows nothing about its place in a set');

  // Nothing appears from nothing. Every STANDARD-motion arrival carries the entry scale — a pure
  // opacity entrance with no initial transform is a comes-from-nowhere (`/review-animations`).
  // Reduced motion is the one exception, and it is the rule working: movement is what goes there.
  assert.match(arrival, /return PLACED;/u, 'the first painted frame is not an arrival');
  assert.match(arrival, /fromScale: DISCLOSURE_ENTRY_SCALE,/u, 'a standard arrival is never a pure fade');
  assert.equal((arrival.match(/fromScale: 1,/gu) ?? []).length, 2, 'only the placed and reduced plans carry no scale');

  // And the cut-and-resolve RETARGETS rather than restarts, so two acts inside one resolve cannot
  // re-seed the dip and read as a blink. A running resolve is CONTINUED — nothing is sampled ahead
  // of when it is applied, so the composite beat cannot make the seed stale and drop the plane
  // backwards. The only seeded case is a plane already at full weight (`/review-animations` R2).
  assert.match(motionCode['tokens.ts'], /export function resolveFromOpacity\(shownOpacity: number\): number \{/u);
  const camera = motionCode['presentation-camera/usePresentationCamera.ts'];
  assert.match(camera, /const shownOpacity = planeOpacity\.get\(\);/u);
  assert.match(camera, /shownOpacity < 1\s*\n\s*\? withTiming\(1, \{ duration: plan\.resolveMs/u, 'a running resolve is continued, not re-seeded');
  assert.match(camera, /withTiming\(resolveFromOpacity\(shownOpacity\), \{ duration: 0/u, 'only a plane at full weight is seeded');
  assert.equal(camera.includes('const resolveFrom = resolveFromOpacity(planeOpacity.get());'), false, 'no weight is sampled ahead of use');
});

test('a cut and the dip that covers it land in the same frame, beat or no beat', () => {
  // `/review-animations` R2. A cut is acceptable ONLY because the resolve covers it. Dropping the
  // residual immediately while delaying the dip by the composite beat showed the world jump to the
  // new viewpoint at full weight and explained it 110 ms later — a teleport with a late apology,
  // and reachable on every composite act under reduced motion, where every travel is a cut.
  //
  // TRAVEL is deliberately not held this way: its rebase PRESERVES the on-glass frame, so holding
  // that frame for the beat reads as the world waiting. Only a discarded frame needs the cover.
  const camera = motionCode['presentation-camera/usePresentationCamera.ts'];
  const cut = camera.slice(camera.indexOf("if (plan.kind === 'CUT_AND_RESOLVE') {"), camera.indexOf('if (plan.translationMs > 0) {'));
  assert.ok(cut.length > 0, 'the cut-and-resolve branch exists');
  assert.match(cut, /if \(plan\.spatialDelayMs > 0\) \{/u, 'the beat is the only thing that changes the cut');
  assert.match(
    cut,
    /const held = \(target: number\) =>\s*\n\s*withDelay\(plan\.spatialDelayMs, withTiming\(target, \{ duration: 0, reduceMotion: ReduceMotion\.Never \}\)\);/u,
  );
  for (const axis of ['tx', 'ty', 'zoom']) {
    assert.match(cut, new RegExp(`${axis}\\.set\\(held\\(RESIDUAL_AT_REST\\.${axis === 'zoom' ? 'zoom' : axis}\\)\\);`, 'u'), `${axis} is held for the beat`);
  }
  // The delay reaching the residual is the SAME quantity the opacity is delayed by: one beat, not
  // two, so the position change can never fall outside the dip.
  assert.equal((cut.match(/plan\.spatialDelayMs/gu) ?? []).length, 3, 'one beat, applied to the cut and to the dip');
});

test('§2.8, §2.9 — no Preview world veil and no Exact Return lock frame exist', () => {
  // The motion owner cannot see a Preview at all, so it cannot dim the world because one is open.
  for (const forbidden of ['Preview', 'preview', 'PTC', 'temporal-navigation']) {
    assert.equal(motionText.includes(forbidden), false, `the motion owner must not reach ${forbidden}`);
  }
  // The plane's opacity is written in exactly two places: the cut-and-resolve, and the reset.
  const binding = motionCode['presentation-camera/usePresentationCamera.ts'];
  assert.equal((binding.match(/planeOpacity\.set\(/gu) ?? []).length, 2, 'the plane opacity has exactly two writers');
  // Exactness is geometry: no frame, border, inset chrome or special primitive marks it.
  for (const forbidden of ['RoundedRect', 'strokeWidth={1.5}', 'lockOpacity', 'arrivalLock', 'exactFrame']) {
    assert.equal(productionText.includes(forbidden), false, `Exact Return gets no special chrome: ${forbidden}`);
  }
});

// ---------------------------------------------------------------------------------------------
// 7. §4 — the exploration is evidence, never production source. (§21.16, §21.17)
// ---------------------------------------------------------------------------------------------

test('the motion lab is not in production, is not importable, and left no trace', () => {
  assert.equal(existsSync(new URL('apps/mobile/src/motion-lab', root)), false, 'the lab is not in the production tree');
  const mobileSources = listFiles(join(rootPath, 'apps/mobile/src')).filter((file) => /\.tsx?$/u.test(file));
  for (const file of mobileSources) {
    const text = readFileSync(file, 'utf8');
    assert.equal(text.includes('motion-lab'), false, `${file} must not reference the motion lab`);
    assert.equal(text.includes('MotionLab'), false, `${file} must not reference the motion lab`);
    assert.equal(text.includes('bdbf6115'), false, `${file} must not reference the exploration head`);
  }
  // No A/B/C profile architecture entered production.
  for (const forbidden of ['MotionProfile', 'motionProfile', 'profiles.ts', 'DIRECTION_A', 'directionA']) {
    assert.equal(productionText.includes(forbidden), false, `the lab's profile architecture must not be copied: ${forbidden}`);
  }
});

// ---------------------------------------------------------------------------------------------
// 8. Scope — no app shell, no backend, no T-11, no T-12, no Product copy. (§21.5, 6, 18, 19, 20)
// ---------------------------------------------------------------------------------------------

test('the app shell still mounts no world, and T-10 shipped no route', () => {
  const entries = readdirSync(new URL('apps/mobile/src/app/', root)).sort();
  assert.deepEqual(entries, ['_layout.tsx', 'index.tsx']);
  for (const file of ['apps/mobile/src/app/_layout.tsx', 'apps/mobile/src/app/index.tsx', 'apps/mobile/src/shell/FoundationShell.tsx']) {
    const text = read(file);
    assert.doesNotMatch(text, /MapSurface|MapCanvas/u, `${file} must not mount the Map`);
    assert.doesNotMatch(text, /from\s+'[^']*\/motion'/u, `${file} must not mount the motion owner`);
    assert.doesNotMatch(text, /usePresentationCamera|DisclosureArrival/u, `${file} must not mount the motion owner`);
  }
});

test('T-10 is mobile-only: it ships no database artifact and reaches no backend', () => {
  assert.deepEqual(listFiles(motionAbsolute).filter((file) => file.endsWith('.sql')), [], 'the owner ships no database artifact');
  for (const reach of ['database/', 'migrations/', 'supabase', 'postgres', 'SELECT ', 'INSERT ', 'apps/api', '@qandeel/api']) {
    assert.equal(motionText.includes(reach), false, `T-10 must not reach ${reach}`);
  }
});

test('T-11 responsive policy and T-12 integration/copy are untouched by this owner', () => {
  // T-11: nothing here measures, breaks points, or recomposes. The envelope arrives as a prop.
  for (const forbidden of ['useWindowDimensions', 'Dimensions', 'onLayout', 'breakpoint', 'isNarrow', 'isTablet', 'isCompact', 'RESPONSIVE_RECOMPOSITION']) {
    assert.equal(motionText.includes(forbidden), false, `T-11 owns ${forbidden}`);
  }
  assert.match(actionsCode, /id: 'RESPONSIVE_RECOMPOSITION',[\s\S]*?owner: 'T-11',/u);
  // T-12: no Product copy anywhere in this owner, in either language, and no copy module is reached.
  for (const forbidden of ['product-copy', 'ChromeLanguage', 'accessibilityLabel', 'accessibilityHint']) {
    assert.equal(motionText.includes(forbidden), false, `T-12 owns ${forbidden}`);
  }
  // No Arabic, and no sentence-shaped literal: the owner's only strings are identifiers.
  assert.doesNotMatch(motionText, /[؀-ۿ]/u, 'the motion owner contains no Arabic copy');
  for (const match of motionText.matchAll(/'([^'\\\n]{12,})'/gu)) {
    assert.doesNotMatch(match[1], /\s[a-z]+\s/u, `the motion owner must not carry a sentence: ${match[1]}`);
  }
});

test('§14 — the accessible layer can never take a touch from the world it describes', () => {
  const layer = mapCode['accessibility/MapAccessibilityLayer.tsx'];
  // It covers the whole plane, so without this it could swallow a drag or a pointer miss on the
  // way to the world underneath — a real Android hazard the frozen layer was exposed to.
  assert.match(layer, /pointerEvents="box-none"/u);
  assert.match(layer, /style=\{StyleSheet\.absoluteFill\}/u);
  // Its own nodes stay individually addressable: accessibility does not route through pointers.
  assert.match(layer, /accessible\s*\n\s*accessibilityRole=\{node\.role\}/u);
  assert.match(layer, /onAccessibilityAction=\{\(event: AccessibilityActionEvent\) => runNodeAction\(node, event\.nativeEvent\.actionName\)\}/u);
  // And nothing in the accessible route waits for a settle: no motion, no timer, no completion.
  for (const forbidden of ['setTimeout', 'withTiming', 'withSpring', 'useSharedValue', 'settle', 'animation']) {
    assert.equal(layer.includes(forbidden), false, `the accessible route must not depend on ${forbidden}`);
  }
});

test('the world is a world, not reading-order content: no motion knows a direction', () => {
  // A map is not text. The plane is placed from canonical addresses through ONE transform, and no
  // module in this owner can branch on writing direction, mirror an axis, or name a side of the
  // screen — so a drag is physical in both languages and the world is identical in both.
  for (const forbidden of ['I18nManager', 'isRTL', 'writingDirection', 'marginStart', 'marginEnd', 'paddingStart', 'paddingEnd', 'flexDirection']) {
    assert.equal(motionText.includes(forbidden), false, `the motion owner must not know ${forbidden}`);
  }
  for (const forbidden of [/\brtl\b/iu, /\bltr\b/iu, /\bmirror\b/iu, /\bdirection\b/iu]) {
    assert.doesNotMatch(motionText, forbidden, `the motion owner must not know ${String(forbidden)}`);
  }
  // The Timeline's mirroring stays where it was frozen: ONE presentation-geometry rule in T-06,
  // which T-10 refined the durations of and did not touch the geometry of.
  const geometry = stripComments(read('apps/mobile/src/temporal-navigation/timeline-integration/presentation-geometry.ts'));
  for (const rule of ['markerTranslateX', 'restingMarkerX', 'presentationX']) {
    assert.ok(geometry.includes(rule), `T-06's one presentation rule still owns ${rule}`);
  }
  // The commit acknowledgement rides a VERTICAL scale, so it carries no direction in either language.
  assert.match(temporalBinding, /\{ scaleY: 1 \+ settle\.get\(\) \* COMMIT_SETTLE_SCALE \}/u);
  assert.equal(temporalBinding.includes('scaleX'), false, 'the acknowledgement is direction-neutral');
});

test('the static visual language was not redesigned by T-10', () => {
  const canvas = mapCode['renderer/MapCanvas.tsx'];
  for (const value of [
    "const GROUND = 'rgb(246,246,244)';",
    "const AMBIENT = 'rgb(226,226,222)';",
    "const EMPTY_SPACE = 'rgb(208,208,204)';",
    "const HOME_FILL = 'rgb(64,64,62)';",
    "const APPEARANCE_FILL = 'rgb(126,126,122)';",
    "const TETHER = 'rgb(178,178,174)';",
    "const REGISTER_FILL = 'rgb(150,150,146)';",
  ]) {
    assert.ok(canvas.includes(value), `T-10 changed no colour: ${value}`);
  }
  const geometry = mapCode['renderer/map-geometry.ts'];
  for (const value of ['HOME_RADIUS_POINTS = 13', 'APPEARANCE_RADIUS_POINTS = 6', 'APPEARANCE_RING_RADIUS_POINTS = 40', 'REGISTER_RADIUS_POINTS = 6']) {
    assert.ok(geometry.includes(value), `T-10 changed no geometry: ${value}`);
  }
  // Phase VI owns the final language. A later visual task re-anchors this test; T-10 does not.
  assert.equal(motionText.includes('rgb('), false, 'the motion owner paints no colour of its own');
  assert.equal(motionText.includes('#'), false, 'the motion owner paints no colour of its own');
});

// ---------------------------------------------------------------------------------------------
// 9. The tuning bands are bands, and every one of them is honoured. (§15)
// ---------------------------------------------------------------------------------------------

test('every duration token sits inside its frozen band', () => {
  const tokens = motionCode['tokens.ts'];
  const numberOf = (name) => {
    const match = tokens.match(new RegExp(`${name}:\\s*(\\d+)`, 'u'));
    assert.ok(match, `${name} is a literal duration`);
    return Number(match[1]);
  };
  assert.equal(numberOf('directManipulation'), 0, 'a finger owns the frame: zero easing');
  assert.ok(numberOf('localResolve') >= 120 && numberOf('localResolve') <= 200);
  assert.ok(numberOf('disclosure') >= 180 && numberOf('disclosure') <= 260);
  assert.ok(numberOf('disclosureReinforcement') >= 240 && numberOf('disclosureReinforcement') <= 320);
  assert.ok(numberOf('disclosureReinforcementDelay') >= 0 && numberOf('disclosureReinforcementDelay') <= 60);
  // ONE budget: the reinforcement is finished 320 ms after the act, lead included.
  assert.ok(numberOf('disclosureReinforcementDelay') + numberOf('disclosureReinforcement') <= 320,
    'the reinforcement lead and duration are one budget');
  // And the disclosure leads the geometry that explains it, or starts with it.
  assert.ok(numberOf('disclosure') <= numberOf('disclosureReinforcementDelay') + numberOf('disclosureReinforcement'));
  assert.ok(numberOf('travelMin') >= 260 && numberOf('travelMin') <= 380);
  assert.ok(numberOf('travelMax') >= 260 && numberOf('travelMax') <= 380);
  assert.ok(numberOf('travelLongMax') >= 520 && numberOf('travelLongMax') <= 560);
  assert.ok(numberOf('reducedResolve') >= 120 && numberOf('reducedResolve') <= 180);
  assert.ok(numberOf('compositeSpatialBeat') >= 80 && numberOf('compositeSpatialBeat') <= 140);
  // The entry scale is never zero and never near it.
  assert.match(tokens, /DISCLOSURE_ENTRY_SCALE = 0\.(8[89]|9[012])/u);
  // One curve, and it is an ease-out. `ease-in` delays the moment the reader is watching.
  assert.match(tokens, /QANDEEL_EASE_OUT = Object\.freeze\(\[0\.23, 1, 0\.32, 1\] as const\)/u);
  assert.equal((motionText.match(/Easing\.bezier\(/gu) ?? []).length, 2, 'both bindings use the one curve');
  assert.equal(motionText.includes('Easing.in('), false, 'never ease-in on a UI surface');

  // T-06's refinement stayed inside its own bands (§10).
  const cancelMs = Number(temporalMotion.match(/cancelMs:\s*(\d+)/u)[1]);
  assert.ok(cancelMs <= 200, `a cancellation is a system response, not a performance: ${cancelMs}ms`);
  const commitMs = Number(temporalMotion.match(/commitSettleMs:\s*(\d+)/u)[1]);
  assert.ok(commitMs <= 200, `the commit acknowledgement stays restrained: ${commitMs}ms`);
  const settleScale = Number(temporalMotion.match(/COMMIT_SETTLE_SCALE = ([\d.]+)/u)[1]);
  assert.ok(settleScale > 0 && settleScale <= 0.12, `perceptible but never a gesture: ${settleScale}`);
});

// ---------------------------------------------------------------------------------------------
// 10. Meaning Ignition — MEANING_IGNITION_TRIGGER_DEFERRED_TO_T12. (§5 Q4, A64-A72)
// ---------------------------------------------------------------------------------------------

test('Meaning Ignition ships no trigger and no cue, and could not be wired to one', () => {
  // The disposition is recorded where the decision lives, not only in a report.
  const doc = read('docs/living-analysis-map-motion-system-v1.md');
  assert.match(doc, /MEANING_IGNITION_TRIGGER_DEFERRED_TO_T12/u);
  // No authoritative cause is observable from this owner, so no cue can be attached to one later
  // by accident: the owner cannot see a live advance, a Live Focus transition or a fetch at all.
  for (const forbidden of ['LIVE_HEAD_ADVANCED', 'LIVE_FOCUS_TRANSITION', 'liveHead', 'LiveFocus', 'FOLLOW_LIVE', 'PINNED', 'fetch(']) {
    assert.equal(motionText.includes(forbidden), false, `no Ignition trigger surface: ${forbidden}`);
  }
});

// ---------------------------------------------------------------------------------------------
// 11. Registration, and the negative half.
// ---------------------------------------------------------------------------------------------

test('the T-10 gate is registered at the root and in Mobile CI without a new native job', () => {
  const rootPackage = readJson('package.json');
  assert.equal(rootPackage.scripts['test:t10-motion-contract'], 'node --test tests/t10-motion-contract.test.mjs');
  const mobileCi = read('.github/workflows/mobile-ci.yml');
  assert.match(mobileCi, /run: npm run test:t10-motion-contract/u);
  assert.match(mobileCi, /'tests\/t10-motion-contract\.test\.mjs'/u);
  assert.match(mobileCi, /'apps\/mobile\/\*\*'/u);
  // The native set is unchanged: still exactly the fast gate plus Android and iOS, both gated.
  assert.equal((mobileCi.match(/runs-on: /gu) ?? []).length, 3, 'no job beyond the fast gate and the two native jobs');
  assert.equal((mobileCi.match(/if: needs\.verify-mobile-contracts\.outputs\.native_impact == 'true'/gu) ?? []).length, 2);
  assert.equal(existsSync(new URL('docs/living-analysis-map-motion-system-v1.md', root)), true);
});

/**
 * The negative half. A gate that only proves "everything is absent" would be satisfied by a scan
 * that reads nothing, so the scan is made to FAIL on a tree that carries the defect.
 */
test('the scans really do refuse the things they claim to refuse', () => {
  const mirror = mkdtempSync(join(tmpdir(), 'qandeel-t10-'));
  try {
    cpSync(motionAbsolute, join(mirror, 'motion'), { recursive: true });
    const scan = () => {
      const files = listFiles(join(mirror, 'motion'))
        .filter((file) => /\.tsx?$/u.test(file) && !file.includes('__tests__') && !file.includes('__fixtures__'));
      return files.map((file) => stripComments(readFileSync(file, 'utf8'))).join('\n');
    };
    // Baseline: the mirrored owner is clean, exactly as the real one is.
    for (const forbidden of REJECTED_TOKENS) assert.equal(scan().includes(forbidden), false);
    assert.equal(scan().includes('withDecay'), false);

    // Now plant each class of defect and require the scan to see it.
    const probe = join(mirror, 'motion', 'probe.ts');
    for (const defect of [
      "export const staggerMs = 28;\n",
      "import { withDecay } from 'react-native-reanimated';\nexport const fling = withDecay;\n",
      "export const breath = 1.05;\n",
      "export const previewVeil = 0.86;\n",
      "export const lockFrame = 240;\n",
      "import { withRepeat } from 'react-native-reanimated';\nexport const forever = withRepeat;\n",
    ]) {
      writeFileSync(probe, defect);
      const planted = scan();
      assert.ok(
        REJECTED_TOKENS.some((token) => planted.includes(token)),
        `a planted defect must be caught: ${defect.trim()}`,
      );
      rmSync(probe, { force: true });
    }

    // And an authority leak is caught by the closure check, not by a denylist of names.
    writeFileSync(probe, "import type { CanonicalStore } from '../../state';\nexport type Leak = CanonicalStore;\n");
    const leaked = scan();
    assert.ok(leaked.includes('CanonicalStore'), 'an authority leak must be caught');
    assert.ok(leaked.includes('..' + '/../state'), 'a reach outside the owner must be visible');
    rmSync(probe, { force: true });
  } finally {
    rmSync(mirror, { recursive: true, force: true, maxRetries: 3 });
  }
});
