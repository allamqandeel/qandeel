import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// T-06 — Temporal Navigation Layer: the interaction and substrate around the frozen temporal
// primitives. Static executable contract over the approved boundary.
//
// Semantic behaviour is proven by the Jest suites under apps/mobile/src/temporal-navigation
// (TN06-01…TN06-24). This gate guards what a passing unit test cannot: the file surface, the
// absence of any new dependency, the exact registry promotion, the anti-scope, the one-way T-05
// boundary, the separation of motion from authority, and that the gate itself is registered in CI.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFile(new URL(path, root), 'utf8');
const readJson = async (path) => JSON.parse(await read(path));

const TN_DIR = 'apps/mobile/src/temporal-navigation';
const STATE_DIR = 'apps/mobile/src/state';

const PRODUCTION_FILES = [
  'accessibility/TemporalNavigator.tsx',
  'accessibility/index.ts',
  'accessibility/temporal-accessibility.ts',
  'continuation/forward.ts',
  'continuation/index.ts',
  'index.ts',
  'locus-choice/LocusChoiceSurface.tsx',
  'locus-choice/index.ts',
  'locus-choice/pending-locus-choice.ts',
  'motion/index.ts',
  'motion/temporal-motion.ts',
  'motion/useTemporalMotion.ts',
  'outcome.ts',
  'preview/index.ts',
  'preview/preview-projection.ts',
  'preview/preview-state.ts',
  'targeting/addressability.ts',
  'targeting/commit.ts',
  'targeting/disclosed-availability.ts',
  'targeting/index.ts',
  'targeting/locate.ts',
  'targeting/temporal-actions.ts',
  'timeline-integration/TemporalTargetLayer.tsx',
  'timeline-integration/disclosed-bridge.ts',
  'timeline-integration/index.ts',
  'timeline-integration/presentation-geometry.ts',
  'timeline-integration/scrub.ts',
  'timeline-integration/useTemporalScrub.ts',
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

const sources = Object.fromEntries(await Promise.all(PRODUCTION_FILES.map(async (name) => [name, await read(`${TN_DIR}/${name}`)])));
/** Code only: a comment may name a forbidden pattern in order to forbid it. */
const code = Object.fromEntries(Object.entries(sources).map(([name, text]) => [name, stripComments(text)]));
const layerText = Object.values(code).join('\n');

const actionsSource = await read(`${STATE_DIR}/actions.ts`);
const actionsCode = stripComments(actionsSource);
const transitionsCode = stripComments(await read(`${STATE_DIR}/transitions.ts`));
const storeCode = stripComments(await read(`${STATE_DIR}/store.ts`));
const classesCode = stripComments(await read(`${STATE_DIR}/classes.ts`));

test('the authorized T-06 file surface is the only production surface of the temporal navigation layer', () => {
  const dir = join(rootPath, TN_DIR);
  const production = listFiles(dir)
    .map((file) => file.slice(dir.length + 1).replace(/\\/g, '/'))
    .filter((file) => !file.startsWith('__tests__/') && !file.startsWith('__fixtures__/'))
    .sort();
  assert.deepEqual(production, [...PRODUCTION_FILES].sort());
  const suites = readdirSync(join(dir, '__tests__')).filter((file) => /\.test\.tsx?$/u.test(file));
  assert.ok(suites.length >= 13, `expected the T-06 adversarial suites, found ${suites.length}`);
  // R1 added two adversarial suites by name and the final closure review two more; none may be
  // dropped while the code they guard stays.
  for (const suite of ['interaction-race.test.ts', 'locus-choice.test.tsx', 'interaction-ownership.test.tsx', 'rtl-geometry.test.tsx']) {
    assert.ok(suites.includes(suite), `the adversarial suite ${suite} must exist`);
  }
});

/**
 * The source of ONE JSX element: from its opening `<Tag` up to and including its matching close
 * (or its own `/>`). JSX expression containers are skipped by brace counting, so an arrow function
 * or a template literal inside a prop cannot end a tag early.
 */
function elementSubtree(text, start) {
  const opener = /^<(>|[A-Za-z][\w.]*)/u;
  const root = opener.exec(text.slice(start, start + 64));
  assert.ok(root, `no JSX element opens at ${start}`);
  // Every element opened inside is tracked, whatever its name: the root's subtree ends exactly when
  // the stack it started empties, whether by its own `</Tag>` or its own `/>`.
  const stack = [];
  let index = start;
  let braces = 0;
  while (index < text.length) {
    const character = text[index];
    if (character === '{') {
      braces += 1;
      index += 1;
      continue;
    }
    if (character === '}') {
      braces -= 1;
      index += 1;
      continue;
    }
    if (braces > 0) {
      index += 1;
      continue;
    }
    if (text.startsWith('</', index)) {
      const end = text.indexOf('>', index);
      stack.pop();
      if (stack.length === 0) return text.slice(start, end + 1);
      index = end + 1;
      continue;
    }
    if (text.startsWith('/>', index)) {
      stack.pop();
      if (stack.length === 0) return text.slice(start, index + 2);
      index += 2;
      continue;
    }
    const open = character === '<' ? opener.exec(text.slice(index, index + 64)) : null;
    if (open) {
      stack.push(open[1]);
      index += open[0].length;
      continue;
    }
    index += 1;
  }
  throw new Error(`unterminated <${root[1]}> at ${start}`);
}

// FCR-01 — interaction ownership is one coordinator per mounted surface. It is never a memo whose
// lifetime depends on observer identity, and a retired surface's callbacks are inert.
test('FCR-01 — scrub interaction ownership survives handler reconfiguration, replacement and unmount', () => {
  const hook = code['timeline-integration/useTemporalScrub.ts'];
  const scrub = code['timeline-integration/scrub.ts'];

  // The hook never builds the state machine from fixed dependencies, and builds exactly one.
  assert.equal(hook.includes('createScrubHandlers('), false, 'the hook must not build a per-dependency handler set');
  assert.equal((hook.match(/createScrubCoordinator\(/gu) ?? []).length, 1, 'exactly one coordinator construction');
  // Constructed in a layout effect keyed on the SURFACE only, attached to a forwarder created once
  // per hook, retired and detached in the cleanup, and floored at every epoch the UI runtime has
  // already minted.
  assert.match(hook, /const \[forwarder\] = useState\(createScrubForwarder\);\s*\n\s*const handlers = forwarder\.handlers;/u);
  assert.equal((hook.match(/createScrubForwarder/gu) ?? []).length, 2, 'the forwarder is imported and created exactly once');
  assert.match(
    hook,
    /useLayoutEffect\(\(\) => \{\s*\n\s*const coordinator = createScrubCoordinator\(\{ store, preview \}, \(\) => latest\.current, \{ after: epoch\.get\(\) \}\);\s*\n\s*forwarder\.attach\(coordinator\);\s*\n\s*return \(\) => \{\s*\n\s*coordinator\.retire\(\);\s*\n\s*forwarder\.detach\(\);\s*\n\s*\};\s*\n\s*\}, \[store, preview, epoch, forwarder\]\);/u,
  );
  assert.equal(hook.includes('useRef<ScrubCoordinator'), false, 'no coordinator is ever held in a React ref');
  // The observers are read at CALL time, through a ref refreshed on every commit.
  assert.match(hook, /const latest = useRef<ScrubObservers>\(\{ snapshot, onCommitted, onCancelled, onOutcome, onPreview \}\);/u);
  assert.match(hook, /useLayoutEffect\(\(\) => \{\s*\n\s*latest\.current = \{ snapshot, onCommitted, onCancelled, onOutcome, onPreview \};\s*\n\s*\}\);/u);
  // No memo or callback in the hook lists an observer, the snapshot or an authority as a dependency:
  // interaction ownership cannot return to a memo whose lifetime follows callback identity.
  const memos = [...hook.matchAll(/use(?:Memo|Callback)(?:<[^>]*>)?\(([\s\S]*?)\n\s*\[([^\]]*)\],?\s*\n?\s*\);/gu)];
  assert.equal(memos.length, 1, 'only the gesture is memoized; no handler set is');
  for (const memo of memos) {
    for (const forbidden of ['onOutcome', 'onCommitted', 'onCancelled', 'onPreview', 'snapshot', 'store', 'preview']) {
      assert.equal(new RegExp(`\\b${forbidden}\\b`, 'u').test(memo[2]), false, `interaction ownership must not depend on ${forbidden}`);
    }
  }
  assert.match(hook, /\[enabled, fingerX, tracking, epoch, handlers\],\s*\n\s*\);/u);
  // What the gesture and the reaction schedule is the forwarder's stable handler set, which
  // reaches whichever coordinator is attached at DELIVERY, and nothing after retirement.
  assert.match(scrub, /export function createScrubForwarder\(\): ScrubForwarder \{\s*\n\s*let live: ScrubCoordinator \| null = null;/u);
  assert.match(scrub, /targetIndex: \(epoch, index\) => live\?\.handlers\.targetIndex\(epoch, index\) \?\? RETIRED,/u);
  assert.match(scrub, /settle: \(epoch, committed\) => live\?\.handlers\.settle\(epoch, committed\),/u);
  assert.match(scrub, /liveInteraction: \(\) => live\?\.handlers\.liveInteraction\(\) \?\? NO_INTERACTION,/u);
  assert.match(scrub, /detach: \(\) => \{\s*\n\s*live = null;/u);

  // The coordinator is bound to its surface at construction and reads only observers later.
  assert.match(
    scrub,
    /export function createScrubCoordinator\(\s*\n\s*surface: ScrubSurface,\s*\n\s*latest: \(\) => ScrubObservers,\s*\n\s*options: ScrubCoordinatorOptions = \{\},\s*\n\s*\): ScrubCoordinator \{/u,
  );
  assert.match(scrub, /const \{ store, preview \} = surface;/u);
  assert.equal(/latest\(\)\.(?:store|preview)\b/u.test(scrub), false, 'the surface is never read through latest()');
  assert.equal(/observers\.(?:store|preview)\b/u.test(scrub), false, 'the surface is never read through the observers');
  // Admission refuses a retired coordinator before anything else, and honours the successor floor.
  assert.match(scrub, /function admit\(candidate: number\): 'CURRENT' \| 'IGNORED' \{\s*\n\s*if \(retired\) return 'IGNORED';/u);
  assert.match(scrub, /let epoch = Number\.isSafeInteger\(after\) && after > 0 \? after : 0;/u);
  // Retirement is one-way, answers without consulting the observers, and touches only its own preview.
  assert.match(scrub, /function retire\(\): void \{\s*\n\s*if \(retired\) return;\s*\n\s*retired = true;/u);
  assert.equal((scrub.match(/retired = true;/gu) ?? []).length, 1);
  assert.equal((scrub.match(/(?<!let )retired = false/gu) ?? []).length, 0, 'retirement is one-way');
  assert.match(scrub, /if \(retired\) return RETIRED;/u);
  assert.match(scrub, /if \(owned !== null && preview\.isCurrent\(owned\)\) preview\.cancel\(\);/u);
  // The fixed-dependency shape is the same machine, so the R1-02 proofs still describe it.
  assert.match(scrub, /export function createScrubHandlers\(deps: ScrubDependencies\): ScrubHandlers \{\s*\n\s*return createScrubCoordinator\(deps, \(\) => deps\)\.handlers;/u);
});

// FCR-02 — an accessibility element must not own an interactive descendant. `accessible={true}`
// makes a View ONE native element and collapses the controls beneath it for VoiceOver and TalkBack.
test('FCR-02 — no accessibility element in the layer groups an interactive descendant', () => {
  const INTERACTIVE = /<(?:TextInput|Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|Switch|Button)\b/u;
  for (const [name, text] of Object.entries(code)) {
    if (!name.endsWith('.tsx')) continue;
    for (const match of text.matchAll(/\baccessible(?:=\{true\})?(?=[\s>])/gu)) {
      const start = text.lastIndexOf('<', match.index);
      const subtree = elementSubtree(text, start);
      assert.equal(INTERACTIVE.test(subtree), false, `${name}: the accessibility element at ${start} owns an interactive descendant`);
    }
  }

  const navigator = code['accessibility/TemporalNavigator.tsx'];
  // The container that owns the input and the controls carries no accessibility prop at all.
  const container = elementSubtree(navigator, navigator.indexOf('<View testID={TEMPORAL_NAVIGATOR_TEST_ID}'));
  const containerTag = container.slice(0, container.indexOf('>') + 1);
  assert.equal(/\baccessib/u.test(containerTag), false, 'the navigator container must not be an accessibility element');
  assert.equal((container.match(/<TextInput\b/gu) ?? []).length, 1);
  assert.equal((container.match(/<Pressable\b/gu) ?? []).length, 4);
  // The summary is a dedicated leaf element: its own name, the one announcement, the named
  // actions, and nothing interactive beneath it.
  const summary = elementSubtree(navigator, navigator.indexOf('<View\n        testID={TEMPORAL_SUMMARY_TEST_ID}'));
  assert.match(summary, /\n\s*accessible\n/u);
  assert.match(summary, /accessibilityLabel=\{model\.surfaceLabel\}/u);
  assert.match(summary, /accessibilityValue=\{\{ text: temporalAnnouncement\(model\) \}\}/u);
  assert.match(summary, /accessibilityActions=\{model\.actions\.map\(\(action\) => \(\{ name: action\.name, label: action\.label \}\)\)\}/u);
  assert.equal(INTERACTIVE.test(summary), false, 'the summary must contain nothing interactive');
  assert.equal((summary.match(/<View\b/gu) ?? []).length, 1, 'the summary nests no further View');
  // Exact entry stays an ordinary, editable, individually labelled input.
  assert.match(navigator, /<TextInput\s*\n\s*testID=\{TEMPORAL_EXACT_ENTRY_TEST_ID\}/u);
  assert.equal(/editable=\{false\}/u.test(navigator), false);
  assert.match(navigator, /accessibilityLabel="Exact Moment number"/u);
});

// FCR-03 — one logical↔physical presentation geometry, defined once, consulted by the pointer side
// and the motion side alike, and never by anything that judges Product truth.
test('FCR-03 — the temporal strip and its markers share one RTL-aware presentation geometry with T-05', () => {
  const geometry = code['timeline-integration/presentation-geometry.ts'];
  const bridge = code['timeline-integration/disclosed-bridge.ts'];
  const hook = code['timeline-integration/useTemporalScrub.ts'];
  const binding = code['motion/useTemporalMotion.ts'];
  const layer = code['timeline-integration/TemporalTargetLayer.tsx'];

  assert.equal((geometry.match(/^import /gmu) ?? []).length, 0, 'the presentation geometry imports nothing');
  assert.equal((geometry.match(/'worklet';/gu) ?? []).length, 4, 'every rule is evaluable on the UI runtime');
  assert.match(geometry, /export function presentationX\(x: number, viewport: number, rtl: boolean\): number \| null \{/u);
  assert.match(geometry, /export function physicalPresentationX\(logicalX: number, viewport: number, rtl: boolean\): number \{\s*\n\s*'worklet';\s*\n\s*return rtl \? viewport - logicalX : logicalX;/u);
  assert.match(geometry, /export function markerTranslateX\(x: number, viewport: number, rtl: boolean\): number \{\s*\n\s*'worklet';\s*\n\s*return rtl \? x - viewport : x;/u);
  assert.match(geometry, /export function restingMarkerX\(logicalX: number, viewport: number, rtl: boolean\): number \{\s*\n\s*'worklet';\s*\n\s*return markerTranslateX\(physicalPresentationX\(logicalX, viewport, rtl\), viewport, rtl\);/u);
  // The mirror is defined ONCE: no other production file spells a viewport subtraction or the epsilon.
  for (const [name, text] of Object.entries(code)) {
    if (name === 'timeline-integration/presentation-geometry.ts' || name.endsWith('/index.ts')) continue;
    assert.doesNotMatch(text, /viewport\s*-\s*\w+|\w+\s*-\s*viewport\b/u, `${name} must not carry a second mirror formula`);
    assert.equal(text.includes('MIRROR_EPSILON'), false, `${name} must not re-apply the mirror epsilon`);
  }
  // The pointer side asks it; the bridge no longer holds a copy.
  assert.match(bridge, /import \{ presentationX \} from '\.\/presentation-geometry';/u);
  assert.equal(bridge.includes('export function presentationX'), false);
  assert.match(hook, /import \{ presentationX \} from '\.\/presentation-geometry';/u);
  assert.match(hook, /const logical = presentationX\(fingerX\.get\(\), viewport\.get\(\), rtl\.get\(\) === 1\);/u);
  // The motion side asks it too, with the viewport and the direction in never-animated shared values.
  assert.match(
    binding,
    /import \{\s*\n\s*markerTranslateX,\s*\n\s*presentationX,\s*\n\s*restingMarkerX,\s*\n\s*type PresentationStripGeometry,\s*\n\s*\} from '\.\.\/timeline-integration\/presentation-geometry';/u,
  );
  assert.match(binding, /const viewport = useSharedValue\(geometry\.viewport\);\s*\n\s*const rtl = useSharedValue\(geometry\.rtl \? 1 : 0\);/u);
  assert.doesNotMatch(binding, /with(?:Timing|Spring)\([^)]*\b(?:viewport|rtl)\b/u, 'neither the viewport nor the direction is ever animated');
  assert.match(
    binding,
    /\? markerTranslateX\(fingerX\.get\(\), viewport\.get\(\), rtl\.get\(\) === 1\)\s*\n\s*: restingMarkerX\(cursorTrack\.get\(\) - windowOffset\.get\(\), viewport\.get\(\), rtl\.get\(\) === 1\),/u,
  );
  // The strip is exactly T-05's viewport at the row's START edge, clipping what falls outside, and
  // the markers are anchored at the logical start — never placed by a physical inset, and never by
  // arithmetic over T-05's outboard extents.
  assert.match(layer, /style=\{\[styles\.strip, \{ width: window\.viewport \}\]\}/u);
  assert.match(layer, /strip: \{ height: STRIP_HEIGHT, alignSelf: 'flex-start', overflow: 'hidden' \},/u);
  assert.match(layer, /marker: \{ position: 'absolute', top: MARKER_INSET, start: 0, width: MARKER_WIDTH, height: MARKER_HEIGHT \},/u);
  // FCR-MOTION-02 — the strip clips, so the markers are inset far enough that the commit
  // acknowledgement's growth never enters the clipped region.
  assert.match(layer, /const MARKER_INSET = 2;\s*\n\s*const MARKER_HEIGHT = STRIP_HEIGHT - 2 \* MARKER_INSET;/u);
  // FCR-MOTION-01 — releasing a finger continues the cursor from under the finger to its rest
  // position, on the UI runtime, through the same geometry the finger branch drew with.
  assert.match(binding, /const restTrack = useSharedValue\(cursorTarget \?\? committedTarget \?\? 0\);/u);
  assert.match(binding, /restTrack\.set\(cursorTo\);/u);
  assert.doesNotMatch(binding, /restTrack\.set\(with/u, 'the rest target is never animated');
  assert.match(
    binding,
    /useAnimatedReaction\(\s*\n\s*\(\) => tracking\.get\(\),\s*\n\s*\(now, before\) => \{\s*\n\s*if \(before !== 1 \|\| now !== 0\) return;\s*\n\s*const logical = presentationX\(fingerX\.get\(\), viewport\.get\(\), rtl\.get\(\) === 1\);\s*\n\s*if \(logical === null\) return;\s*\n\s*cursorTrack\.set\(logical \+ windowOffset\.get\(\)\);\s*\n\s*cursorTrack\.set\(withTiming\(restTrack\.get\(\), \{ duration: cursorMs, easing: EASE_OUT \}\)\);/u,
  );
  assert.equal(binding.includes('scheduleOnRN'), false, 'the release handoff never crosses to the RN runtime');
  // FCR-MOTION-03 — the never-animated geometry lands in a layout effect, with the content.
  assert.match(binding, /useLayoutEffect\(\(\) => \{\s*\n\s*windowOffset\.set\(geometry\.windowOffset\);\s*\n\s*viewport\.set\(geometry\.viewport\);\s*\n\s*rtl\.set\(geometry\.rtl \? 1 : 0\);/u);
  for (const forbidden of ['left:', 'right:', 'marginLeft', 'marginRight', 'OUTBOARD_LIVE_EXTENT', 'DISCONTINUITY', 'onLayout']) {
    assert.equal(layer.includes(forbidden), false, `the layer must not place the strip by ${forbidden}`);
  }
  // ONE geometry object, from T-05's snapshot and the platform direction, feeds both hooks.
  assert.match(layer, /const geometry = useMemo<TemporalMarkerGeometry>\(\s*\n\s*\(\) => \(\{ stepWidth: TIMELINE_STEP, windowOffset: window\.offset, viewport: window\.viewport, rtl \}\),/u);
  assert.match(layer, /useTemporalMotion\(\s*\n[\s\S]*?\},\s*\n\s*geometry,\s*\n\s*\);/u);
  assert.match(layer, /useTemporalScrub\(\{\s*\n\s*store,\s*\n\s*preview,\s*\n\s*snapshot,\s*\n\s*geometry,/u);
  assert.equal((layer.match(/I18nManager\.isRTL/gu) ?? []).length, 1, 'the direction is read once, for the geometry');
  // No coordinate gains Product authority: nothing that judges truth consults the geometry.
  for (const [name, text] of Object.entries(code)) {
    if (/^(?:targeting|preview|continuation|locus-choice)\//u.test(name) || name === 'outcome.ts') {
      assert.equal(text.includes('presentation-geometry'), false, `${name} must not consult presentation geometry`);
    }
  }
});

// R1-01 — canonical Moment addressability and disclosed interaction availability are two different
// questions, and the interaction routes must ask the second one.
test('R1-01 — disclosed interaction availability is a separate, narrower gate that every route asks', () => {
  const disclosed = code['targeting/disclosed-availability.ts'];
  const canonical = code['targeting/addressability.ts'];

  // The canonical rule is unchanged and still knows nothing about presentation or disclosure.
  assert.match(canonical, /export function resolveTemporalTarget\(bounds: TemporalBounds, candidate: unknown\): TargetResolution \{/u);
  for (const forbidden of ['DisclosedTrack', 'disclosed', 'track', 'horizon', 'PresentationSnapshot']) {
    assert.equal(canonical.includes(forbidden), false, `the canonical gate must not become presentation-aware (${forbidden})`);
  }

  // The interaction gate composes the canonical one rather than restating it, and asks it FIRST so
  // the two refusals stay distinguishable.
  assert.match(disclosed, /export function resolveDisclosedTarget\(targeting: TemporalTargeting, candidate: unknown\): TargetResolution \{/u);
  assert.match(disclosed, /const canonical = resolveTemporalTarget\(bounds, candidate\);\s*\n\s*if \(!canonical\.ok\) return canonical;/u);
  assert.match(disclosed, /if \(!disclosed\.has\(canonical\.sp\)\) \{/u);
  assert.match(disclosed, /refuse\(\s*\n?\s*'NOT_DISCLOSED',/u);
  // Session-scoped: a Track from another Session authorizes nothing.
  assert.match(disclosed, /if \(disclosed\.sessionId !== bounds\.sessionId\) \{/u);
  // Membership is verified against the Track's own row, never inferred from its length alone.
  assert.match(disclosed, /return targets\[candidate - 1\]\?\.sessionPosition === candidate;/u);
  // Forward continuation composes the canonical bound and then the horizon, and reports which.
  assert.match(disclosed, /const canonical = nextForwardTarget\(targeting\.bounds, current\.sp\);/u);
  assert.match(disclosed, /outcome: 'AT_DISCLOSURE_HORIZON'/u);
  // The horizon is never derived from the Live Head, and never from presentation geometry.
  for (const forbidden of ['liveHead + 1', 'bounds.liveHead ??', 'viewport', 'offset', 'pixel', 'percent', 'PresentationSnapshot']) {
    assert.equal(disclosed.includes(forbidden), false, `the disclosed gate must not derive membership from ${forbidden}`);
  }

  // Every interaction route asks the disclosed gate, and none of them reaches past it to the
  // canonical one — which is what stops exact entry or forward continuation regressing to LH-only.
  const previewState = code['preview/preview-state.ts'];
  assert.equal(previewState.includes('resolveTemporalTarget('), false, 'the preview controller must not use the canonical gate directly');
  assert.equal(previewState.includes('nextForwardTarget('), false, 'forward continuation must not use the canonical step directly');
  assert.equal((previewState.match(/resolveDisclosedTarget\(/gu) ?? []).length, 2, 'preview and reconcile both ask the disclosed gate');
  assert.match(previewState, /const step = nextDisclosedTarget\(targeting, from\);/u);
  assert.match(previewState, /preview\(targeting: TemporalTargeting, candidate: unknown, source: PreviewSource\): PreviewResult;/u);
  assert.match(previewState, /stepForward\(targeting: TemporalTargeting\): PreviewResult;/u);
  // The pointer bridge asks the same rule, so it gains no second one of its own.
  assert.match(code['timeline-integration/disclosed-bridge.ts'], /return resolveDisclosedTarget\(targeting, target\.sessionPosition\);/u);
  // The commit boundary re-checks disclosure, and the CANONICAL commit keeps T-02's bound alone.
  assert.match(code['targeting/commit.ts'], /const disclosed = resolveDisclosedTarget\(targeting, snapshot\.ptc\);/u);
  assert.match(code['targeting/commit.ts'], /export function commitMoment\(store: CanonicalStore, candidate: unknown\): TemporalOutcome \{\s*\n\s*const resolved = resolveTemporalTarget\(/u);
  // The accessible route is bounded by the horizon, not by the Live Head.
  assert.match(code['accessibility/temporal-accessibility.ts'], /exactTargetMaximum: targeting\.disclosed\.horizon,/u);
  assert.match(code['accessibility/temporal-accessibility.ts'], /const forwardAvailable = nextDisclosedTarget\(targeting, cursor\)\.outcome === 'STEP';/u);
  assert.equal(code['accessibility/temporal-accessibility.ts'].includes('exactTargetMaximum: bounds.liveHead'), false);
});

// R1-02 — a scheduled callback from a closed or superseded gesture changes nothing.
test('R1-02 — every scheduled scrub callback carries its interaction, and a closed one is inert', () => {
  const scrub = code['timeline-integration/scrub.ts'];
  const hook = code['timeline-integration/useTemporalScrub.ts'];

  // The epoch is minted once per gesture on the UI runtime and carried by every callback.
  assert.match(hook, /const epoch = useSharedValue\(0\);/u);
  assert.match(hook, /epoch\.set\(epoch\.get\(\) \+ 1\);/u);
  assert.equal((hook.match(/epoch\.set\(/gu) ?? []).length, 1, 'exactly one place increments the interaction epoch');
  assert.match(hook, /scheduleOnRN\(handlers\.targetIndex, epoch\.get\(\), index\)/u);
  assert.equal((hook.match(/scheduleOnRN\(handlers\.settle, epoch\.get\(\),/gu) ?? []).length, 2, 'both endings carry the epoch');
  assert.equal((hook.match(/scheduleOnRN\([^)]*\)/gu) ?? []).length, 3, 'still exactly three cross-runtime hops');

  // The handlers own the state machine, and admission is order-independent.
  assert.match(scrub, /readonly targetIndex: \(epoch: number, index: number\) => PreviewResult;/u);
  assert.match(scrub, /readonly settle: \(epoch: number, committed: boolean\) => void;/u);
  assert.match(scrub, /function admit\(candidate: number\): 'CURRENT' \| 'IGNORED' \{/u);
  assert.match(scrub, /if \(candidate < epoch\) return 'IGNORED';/u);
  assert.match(scrub, /return open \? 'CURRENT' : 'IGNORED';/u);
  // Both entry points admit first and do nothing at all when the interaction is not current.
  assert.match(scrub, /if \(admit\(candidateEpoch\) === 'IGNORED'\) \{/u);
  assert.match(scrub, /if \(admit\(candidateEpoch\) === 'IGNORED'\) return;/u);
  // A settle closes its interaction BEFORE acting, so its own in-flight callbacks are already inert.
  assert.match(scrub, /open = false;\s*\n\s*const owned = generation;/u);
  // An interaction acts only on the preview it established — through the preview controller the
  // coordinator was bound to at construction, never one read later.
  assert.match(scrub, /const ownsLivePreview = owned !== null && preview\.isCurrent\(owned\);/u);
  assert.match(scrub, /if \(ownsLivePreview\) preview\.cancel\(\);/u);
  assert.match(scrub, /if \(!ownsLivePreview\) \{/u);
  // Correctness never rests on timing.
  for (const forbidden of ['setTimeout', 'setInterval', 'Date.now', 'performance.now', 'requestAnimationFrame', 'queueMicrotask', 'Promise.resolve']) {
    assert.equal(scrub.includes(forbidden), false, `interaction ownership must not rest on ${forbidden}`);
  }
});

// R1-03 — `CHOOSE_LOCUS` resolves a genuine ambiguity and is not a generic spatial locate.
test('R1-03 — CHOOSE_LOCUS is applicable only to a genuine multiple-locus ambiguity', () => {
  const locate = code['targeting/locate.ts'];
  const executors = code['targeting/temporal-actions.ts'];

  assert.match(locate, /export function resolveLocusChoice\(/u);
  // The loci are counted BEFORE the offered handle is looked at.
  assert.match(
    locate,
    /const locatability = resolveLocatability\(context\.scene, target\.family, target\.id\);\s*\n\s*if \(locatability\.outcome === 'NO_LEGITIMATE_LOCUS'\) \{[\s\S]*?if \(locatability\.outcome === 'UNIQUE_LOCUS'\) \{\s*\n\s*return refuse\(\s*\n?\s*'NOT_A_LOCUS_CHOICE',/u,
  );
  // Membership is still checked, and the runtime brand still required.
  assert.match(locate, /if \(!isEntitledLocus\(chosen\)\) return refuse\('INVALID_INPUT'/u);
  assert.match(locate, /const match = locatability\.loci\.find\(\(candidate\) => candidate\.key === chosen\.key\);/u);
  // The act uses the choice resolver, never the general landing resolver.
  assert.match(executors, /const located = resolveLocusChoice\(request\.context, request\.target, request\.locus\);/u);
  assert.equal((executors.match(/resolveLocusChoice\(/gu) ?? []).length, 1);
  const chooseLocusBody = executors.slice(executors.indexOf('export function chooseLocus('));
  assert.equal(chooseLocusBody.includes('resolveLocateAtTarget('), false, 'CHOOSE_LOCUS must not use the general landing resolver');
  // The composite act keeps the general resolver, so a unique locus still lands without a chooser.
  assert.match(executors, /const located = resolveLocateAtTarget\(request\.context, request\.target, request\.locus\);/u);
  // Nothing elects, ranks or prefers anywhere in the layer.
  for (const forbidden of ['primaryContext', 'preferredLocus', 'nearestLocus', 'lastUsedLocus', 'defaultLocus', 'rankLoci', 'sortByImportance']) {
    assert.equal(layerText.includes(forbidden), false, `no locus may be elected by ${forbidden}`);
  }
});

// R1-04 — a Product state that says a choice is required comes with a route that makes it.
test('R1-04 — the pending contextual-locus choice has a pointer route and a non-pointer route', () => {
  const pending = code['locus-choice/pending-locus-choice.ts'];
  const surface = code['locus-choice/LocusChoiceSurface.tsx'];

  // A chooser can be built only from a genuine ambiguity.
  assert.match(pending, /outcome\.outcome !== 'LOCUS_SELECTION_REQUIRED'\) return null;/u);
  // Only an offered choice may be submitted, and it goes through the existing executors.
  assert.match(pending, /if \(!pending\.loci\.some\(\(candidate\) => candidate === locus\)\) \{/u);
  assert.match(pending, /\? commitMomentAndLocate\(store, \{ moment: pending\.moment, context: pending\.context, target: pending\.target, locus \}\)/u);
  assert.match(pending, /: chooseLocus\(store, \{ context: pending\.context, target: pending\.target, locus \}\);/u);
  // Every legitimate option is offered, exactly once, with no preselection and no ranking.
  assert.match(pending, /const options = pending\.loci\.map\(\(locus\) =>/u);
  assert.match(pending, /orderingNote: CONTEXT_ORDER_NOTE,/u);
  assert.match(pending, /The order is not a ranking\./u);
  // The options are built by mapping the pending set one-to-one: nothing is trimmed, reordered,
  // padded, preselected or elected on the way to the surface.
  const modelBody = pending.slice(pending.indexOf('export function locusChoiceModel'), pending.indexOf('export function resolvePendingLocusChoice'));
  assert.ok(modelBody.length > 0, 'the presentable model is built in one place');
  for (const forbidden of ['slice(', 'sort(', 'filter(', 'reverse(', 'preselect', 'defaultOption', 'shift(', 'pop(']) {
    assert.equal(modelBody.includes(forbidden), false, `the chooser must not ${forbidden} the legitimate options`);
  }

  // Both routes exist and converge on ONE resolver.
  assert.equal((surface.match(/resolvePendingLocusChoice\(/gu) ?? []).length, 1, 'both routes reach exactly one executor');
  assert.match(surface, /accessibilityActions=\{\[\s*\n\s*\.\.\.model\.options\.map\(\(option\) => \(\{ name: option\.key, label: option\.label \}\)\),/u);
  assert.match(surface, /accessibilityRole="button"/u);
  assert.match(surface, /accessibilityState=\{\{ selected: false \}\}/u);
  assert.match(surface, /onPress=\{\(\) => choose\(option\.key\)\}/u);
  // Backing out performs no act at all: on either route it calls the observer and nothing else.
  assert.match(surface, /if \(action === LOCUS_CHOICE_CANCEL_ACTION\) \{\s*\n\s*onCancel\?\.\(\);\s*\n\s*return;/u);
  assert.match(surface, /testID=\{LOCUS_CHOICE_CANCEL_TEST_ID\}[\s\S]*?onPress=\{\(\) => onCancel\?\.\(\)\}/u);
  // The ONLY route to the executor is `choose`, and `choose` is reached only from an offered option.
  assert.equal((surface.match(/\bchoose\(/gu) ?? []).length, 2, 'choose is called from exactly the two option routes and nowhere else');
  for (const forbidden of ['commitMomentAndLocate', 'chooseLocus(', 'dispatch', 'store.']) {
    assert.equal(surface.includes(forbidden), false, `the chooser surface must not reach ${forbidden} directly`);
  }
  // A submission the chooser does not offer cannot reach the executor at all.
  assert.match(surface, /const option = model\?\.options\.find\(\(candidate\) => candidate\.key === key\);\s*\n\s*if \(option === undefined\) return;/u);
});

// R3-03 — provenance is checked at the PRESENTATION boundary, not only at execution. A forged
// pending choice must never be shown to a reader with the Product's authority behind it.
test('R3-03 — an unbranded pending choice produces no model and renders no option', () => {
  const pending = code['locus-choice/pending-locus-choice.ts'];
  const surface = code['locus-choice/LocusChoiceSurface.tsx'];

  // The model builder refuses first, before anything presentable exists.
  assert.match(pending, /export function locusChoiceModel\(pending: PendingLocusChoice\): LocusChoiceModel \| null \{\s*\n\s*if \(!isPendingLocusChoice\(pending\)\) return null;/u);
  // The type is opaque too, so a hand-assembled object cannot even be passed without a cast.
  assert.match(pending, /declare const PENDING_PROVENANCE: unique symbol;/u);
  assert.match(pending, /interface PendingProvenance \{\s*\n\s*readonly \[PENDING_PROVENANCE\]: true;\s*\n\s*\}/u);
  assert.match(pending, /export type PendingLocusChoice = PendingCompositeLocusChoice \| PendingSpatialLocusChoice;/u);
  // The raw shapes are not exported, so the branded types are the only way to name one.
  for (const shape of ['CompositeChoice', 'SpatialChoice', 'PendingProvenance']) {
    assert.doesNotMatch(pending, new RegExp(`export interface ${shape}\\b`, 'u'), `${shape} must stay module-private`);
  }

  // The surface cannot reach the option list without the model, and the model is null when forged.
  assert.match(surface, /const model = useMemo\(\(\) => locusChoiceModel\(pending\), \[pending\]\);/u);
  assert.match(surface, /if \(model === null\) \{/u);
  assert.equal((surface.match(/locusChoiceModel\(/gu) ?? []).length, 1, 'the model is built in exactly one place');
  // The fail-closed branch publishes no locus action and no option, and reaches no executor.
  const failClosed = surface.slice(surface.indexOf('if (model === null) {'), surface.indexOf('  return (\n    <View\n      testID={LOCUS_CHOICE_TEST_ID}\n      style={styles.surface}\n      accessibilityRole="none"\n      accessibilityLabel={model.title}'));
  assert.ok(failClosed.length > 0, 'the fail-closed branch exists and precedes the real surface');
  for (const forbidden of ['accessibilityActions', 'model.options', 'choose(', 'resolvePendingLocusChoice']) {
    assert.equal(failClosed.includes(forbidden), false, `the fail-closed surface must not contain ${forbidden}`);
  }
  assert.match(failClosed, /accessibilityLabel=\{LOCUS_CHOICE_UNAVAILABLE_LABEL\}/u);
  // Backing out stays reachable, and still performs no act.
  assert.match(failClosed, /onPress=\{\(\) => onCancel\?\.\(\)\}/u);
});

// R2-02 — a chooser cannot be constructed from a list somebody supplied. Both factories DERIVE the
// legitimate set, and the composite one binds the executor's answer to that derivation.
test('R2-02 — pending-choice construction is provenance-bound, not shape-bound', () => {
  const pending = code['locus-choice/pending-locus-choice.ts'];

  // Neither factory takes a locus list at all: the spatial one takes exactly two parameters and the
  // composite one exactly three, and every one of them is evidence rather than an offered set.
  assert.match(pending, /export function pendingSpatialChoice\(context: MapInspectionContext, target: TemporalLocateTarget\): PendingSpatialLocusChoice \| null \{/u);
  assert.match(pending, /export function pendingCompositeChoice\(\s*\n\s*outcome: CommitMomentAndLocateOutcome,\s*\n\s*context: MapInspectionContext,\s*\n\s*target: TemporalLocateTarget,\s*\n\s*\): PendingCompositeLocusChoice \| null \{/u);
  assert.doesNotMatch(pending, /pendingSpatialChoice\([^)]*loci/u, 'the spatial factory must not accept a caller-supplied locus list');
  assert.doesNotMatch(pending, /pendingCompositeChoice\([^)]*loci/u, 'the composite factory must not accept a caller-supplied locus list');
  assert.equal(pending.includes('loci.length >= 2'), false, 'a length check is not provenance');

  // The set is DERIVED, once, from the resolver — which by R1-03 answers only for a real ambiguity.
  assert.match(pending, /function ambiguityOf\(context: MapInspectionContext, target: TemporalLocateTarget\): readonly EntitledLocus\[\] \| null \{/u);
  assert.match(pending, /const resolution = resolveLocusChoice\(context, target, undefined\);\s*\n\s*return resolution\.outcome === 'LOCUS_SELECTION_REQUIRED' \? resolution\.loci : null;/u);
  assert.equal((pending.match(/resolveLocusChoice\(/gu) ?? []).length, 1, 'the ambiguity is derived in exactly one place');
  assert.equal((pending.match(/ambiguityOf\(context, target\)/gu) ?? []).length, 2, 'both factories derive their own set');

  // The composite factory binds the outcome to that derivation: same position, same complete set.
  assert.match(pending, /context\.scene\.tc !== outcome\.moment\) return null;/u);
  assert.match(pending, /if \(!sameLocusSet\(loci, outcome\.loci\)\) return null;/u);
  // Same members AND same count, so a subset, a superset and a duplicate are each refused.
  assert.match(pending, /if \(!Array\.isArray\(a\) \|\| !Array\.isArray\(b\) \|\| a\.length !== b\.length\) return false;/u);
  assert.match(pending, /return left\.every\(\(key, index\) => key === right\[index\]\);/u);

  // What the chooser offers is the RE-DERIVED set, never a caller's array.
  assert.equal((pending.match(/loci: Object\.freeze\(\[\.\.\.loci\]\)/gu) ?? []).length, 2, 'both factories carry the derived set');
  assert.equal(pending.includes('loci: outcome.loci'), false, 'the outcome list is evidence, never the offered set');

  // The result is branded, and execution re-checks the brand as defence in depth.
  assert.match(pending, /const minted = new WeakSet<object>\(\);/u);
  assert.equal((pending.match(/minted\.add\(/gu) ?? []).length, 2, 'exactly the two factories mint a pending choice');
  assert.match(pending, /export function isPendingLocusChoice\(value: unknown\): value is PendingLocusChoice \{/u);
  assert.match(pending, /if \(!isPendingLocusChoice\(pending\)\) \{/u);
  // Nothing outside this module can mint one.
  for (const [name, text] of Object.entries(code)) {
    if (name === 'locus-choice/pending-locus-choice.ts') continue;
    assert.equal(text.includes('minted.add('), false, `${name} must not mint a pending choice`);
  }
});

test('the T-01 technical shell keeps its two-file router root: the temporal layer is not mounted in the app container', async () => {
  // The two-file router root is a frozen architectural decision — the Product is not a route stack —
  // so the CENSUS stays exact.
  const entries = readdirSync(new URL('apps/mobile/src/app/', root)).sort();
  assert.deepEqual(entries, ['_layout.tsx', 'index.tsx']);
  // FORWARD-SAFE (R2-02): a byte hash of the shell is not. Mounting the Product surfaces into the
  // app shell is a later authorized task's entire job. The permanent claim is the one below.
  for (const file of ['apps/mobile/src/app/_layout.tsx', 'apps/mobile/src/app/index.tsx', 'apps/mobile/src/shell/FoundationShell.tsx']) {
    const text = await read(file);
    assert.doesNotMatch(text, /temporal-navigation|TemporalTargetLayer|TemporalNavigator/u, `${file} must not mount the temporal layer in T-06`);
  }
});

test('exactly two frozen acts were promoted to executable, by name, and no T-07 act moved', () => {
  assert.match(actionsCode, /TEMPORAL_ACTION_TYPES = Object\.freeze\(\['COMMIT_MOMENT_AND_LOCATE', 'CHOOSE_LOCUS'\] as const\);/u);
  // T-07 re-anchor: the return family joined the executable union and the RH-eligible identity type.
  // T-06's guarantee is unweakened — the temporal family is still exactly its two acts, and no T-07
  // identity is in it — and the union is pinned in full so a fourth family cannot appear unnoticed.
  assert.match(actionsCode, /export type StoreAction = KernelAction \| MapAction \| TemporalAction \| ReturnAction;/u);
  assert.match(actionsCode, /export type RhActionId = KernelActionType \| MapActionType \| TemporalActionType \| ReturnActionType \| MetadataOnlyActionType;/u);

  const metadataOnly = actionsCode.match(/METADATA_ONLY_ACTION_TYPES = Object\.freeze\(\[([\s\S]*?)\] as const\)/u);
  assert.ok(metadataOnly, 'METADATA_ONLY_ACTION_TYPES must be a literal array');
  assert.deepEqual([...metadataOnly[1].matchAll(/'([A-Z_]+)'/gu)].map((match) => match[1]), [], 'the later-owner set is empty');
  const returnTypes = actionsCode.match(/RETURN_ACTION_TYPES = Object\.freeze\(\[([\s\S]*?)\] as const\)/u);
  assert.ok(returnTypes, 'RETURN_ACTION_TYPES must be a literal array');
  assert.deepEqual(
    [...returnTypes[1].matchAll(/'([A-Z_]+)'/gu)].map((match) => match[1]).sort(),
    ['BACK_ONE_STEP', 'EXACT_RETURN', 'GO_LIVE_AND_LOCATE', 'RETURN_LIVE_FOCUS', 'RETURN_LIVE_HEAD', 'RETURN_WORLD'],
  );

  // The two promoted acts keep their frozen name, owner, authority and transactional category.
  const blocks = [...actionsSource.matchAll(/id: '([A-Z_]+)',\n\s*frozenName: '([^']+)',[\s\S]*?level: '([A-Z_]+)',\n\s*owner: '([A-Z0-9-]+)',[\s\S]*?authority: fields\(([^)]*)\),\n\s*transactional: '([A-Z_]+)'/gu)];
  const entries = Object.fromEntries(
    blocks.map((match) => [match[1], { frozenName: match[2], level: match[3], owner: match[4], authority: match[5], transactional: match[6] }]),
  );
  assert.deepEqual(entries.COMMIT_MOMENT_AND_LOCATE, {
    frozenName: 'P3a Temporal + Locate',
    level: 'EXECUTABLE',
    owner: 'T-06',
    authority: "'TM', ...SPATIAL",
    transactional: 'COMPOSITE_TRANSACTION',
  });
  assert.deepEqual(entries.CHOOSE_LOCUS, {
    frozenName: 'Contextual-locus choice (D4)',
    level: 'EXECUTABLE',
    owner: 'T-06',
    authority: '...SPATIAL',
    transactional: 'EFFECTIVE_TRANSACTION',
  });
  // Neither promoted act may reach the semantic depth, the inspection or the live mirrors.
  for (const id of ['COMMIT_MOMENT_AND_LOCATE', 'CHOOSE_LOCUS']) {
    for (const forbidden of ['MC.depth', 'IF_ref', 'LH', 'LF']) {
      assert.equal(entries[id].authority.includes(`'${forbidden}'`), false, `${id} must not hold ${forbidden} authority`);
    }
  }
  // T-07 re-anchor: every T-07 identity is owned by T-07 and lives in the RETURN family, not this
  // one — a strictly stronger statement than the level alone, and the guarantee this gate protects.
  for (const id of ['RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'GO_LIVE_AND_LOCATE', 'RETURN_WORLD', 'EXACT_RETURN', 'BACK_ONE_STEP']) {
    assert.equal(entries[id].owner, 'T-07');
    assert.equal(layerText.includes(id), false, `${id} must not be reachable from the temporal layer`);
  }
  assert.match(storeCode, /if \(!isTemporalActionType\(entry\.id\)\) \{\s*\n\s*throw new UnauthorizedActionClass\(/u);
  assert.match(storeCode, /if \(isReturnActionType\(entry\.id\)\) \{\s*\n\s*throw new UnauthorizedReturnAction\(/u);
  // The Class C temporal identities stay non-store identities: preview, cancellation and relative
  // forward continuation never become Product acts.
  for (const id of ['PREVIEW_TEMPORAL_TARGET', 'CANCEL_PREVIEW', 'RELATIVE_FORWARD_CONTINUATION', 'INPUT_CANCELLATION']) {
    assert.match(actionsSource, new RegExp(`id: '${id}',[\\s\\S]*?level: 'NOT_STORE_ACTION',`, 'u'), `${id} is a non-store identity`);
  }
});

test('the temporal transitions write no live field, resolve no locus and never touch the semantic depth', () => {
  const temporal = transitionsCode.slice(
    transitionsCode.indexOf('function assertLocateLanding'),
    transitionsCode.indexOf('export const TEMPORAL_ACTION_TRANSITIONS'),
  );
  assert.ok(temporal.length > 0, 'the two temporal transitions must exist in the kernel');
  for (const pattern of [/state\.live\.LF/u, /LiveFocus/u, /depth/u, /inspection: action/u]) {
    assert.doesNotMatch(temporal, pattern, `the temporal transitions must not touch ${String(pattern)}`);
  }
  // `IF_ref` is carried through unchanged by both: locating is not inspecting.
  assert.equal((temporal.match(/inspection: state\.inspection/gu) ?? []).length, 2);
  // The locus choice carries the temporal mode through unchanged: it can never be a temporal move.
  assert.match(temporal, /const chooseLocus: ActionTransition<[\s\S]*?> = \(state, action\) => \{\s*\n\s*assertLocateLanding\('CHOOSE_LOCUS', action\.to\);\s*\n\s*return \{ temporal: state\.temporal,/u);
  // Entitlement and locatability live in the temporal layer, never in the kernel.
  for (const forbidden of ['HistoricalDisclosure', 'disclosure', 'MapScene', 'entitled', 'EntitledLocus', 'resolveLocatability']) {
    assert.equal(temporal.includes(forbidden), false, `the kernel must not resolve ${forbidden}`);
  }
});

test('the temporal act reaches canonical state only through its own authorized seam', () => {
  // The kernel splits a THIRD entry point with a SEPARATE authority; the raw surface refuses both
  // promoted families, and each seam admits only identities of its own family.
  assert.match(storeCode, /dispatchTemporal\(action: TemporalAction\): DispatchResult;/u);
  assert.match(storeCode, /if \(!isTemporalActionType\(entry\.id\)\) \{\s*\n\s*throw new UnauthorizedActionClass\(/u);
  assert.match(storeCode, /if \(!isMapActionType\(entry\.id\)\) \{\s*\n\s*throw new UnauthorizedActionClass\(/u);
  assert.match(storeCode, /if \(temporalActionAuthority === undefined\) \{\s*\n\s*throw new UnauthorizedTemporalAction\(/u);
  assert.match(storeCode, /if \(temporalActionAuthority\.consume\(action\) !== true\) \{\s*\n\s*throw new UnauthorizedTemporalAction\(/u);
  // T-07 re-anchor: the slice now ends at the THIRD authority interface rather than at
  // `StoreDependencies`. The assertion is unchanged and unweakened — this interface still exposes
  // exactly one member — and the T-07 gate makes the same statement about the return authority.
  const authorityInterface = storeCode.slice(
    storeCode.indexOf('export interface TemporalActionAuthority'),
    storeCode.indexOf('export interface ReturnActionAuthority'),
  );
  assert.ok(authorityInterface.length > 0, 'the TemporalActionAuthority interface exists');
  assert.match(authorityInterface, /consume\(action: TemporalAction\): boolean;/u);
  assert.equal((authorityInterface.match(/^\s{2}\w+\(/gmu) ?? []).length, 1, 'the authority exposes exactly one member: it can answer, never mint');
  // The three promoted families never share an authority.
  assert.equal((storeCode.match(/mapActionAuthority = deps\.mapActionAuthority/gu) ?? []).length, 1);
  assert.equal((storeCode.match(/temporalActionAuthority = deps\.temporalActionAuthority/gu) ?? []).length, 1);
  assert.equal((storeCode.match(/returnActionAuthority = deps\.returnActionAuthority/gu) ?? []).length, 1);

  // The minting side is module-local to the executors: declared once, exported nowhere.
  const executors = code['targeting/temporal-actions.ts'];
  assert.match(executors, /const authorized = new WeakSet<TemporalAction>\(\);/u);
  assert.match(executors, /^function authorizeIfLandingMatchesPostAct<A extends TemporalAction>\(/mu, 'the mint is a module-local function declaration');
  assert.doesNotMatch(executors, /export (?:function|const) authorizeIfLandingMatchesPostAct\b/u);
  assert.doesNotMatch(executors, /export \{[^}]*\bauthorizeIfLandingMatchesPostAct\b/u);
  assert.equal((executors.match(/authorized\.add\(/gu) ?? []).length, 1, 'exactly one place adds an authorization');
  assert.equal((executors.match(/\bauthorizeIfLandingMatchesPostAct\(/gu) ?? []).length, 2, 'exactly the two promoted acts are minted, and nothing else');
  assert.match(executors, /authorized\.delete\(action\);/u, 'the authorization is consumed on use, so a granted act cannot be replayed');
  for (const [name, text] of Object.entries(code)) {
    if (name === 'targeting/temporal-actions.ts') continue;
    assert.equal(/\bauthorizeIfLandingMatchesPostAct\b/u.test(text), false, `${name} must not reference the minting function`);
  }
  assert.match(code['targeting/index.ts'], /TEMPORAL_ACTION_AUTHORITY/u, 'only the verifier crosses the module boundary');
  for (const forbidden of ['authorized: true', 'as TemporalActionAuthority', 'unique symbol']) {
    assert.equal(executors.includes(forbidden), false, `the authority must not rest on ${forbidden}`);
  }
});

test('the landing of a promoted act is judged by the ONE shared freshness rule, against the post-act viewpoint', () => {
  const executors = code['targeting/temporal-actions.ts'];
  // The rule is T-04's, called — never re-implemented, and never re-derived from the current request.
  assert.match(executors, /const current = mapContextFreshness\(postActState\(store\.getState\(\), action\), context\);/u);
  assert.match(executors, /function postActState\(state: CanonicalState, action: TemporalAction\): CanonicalState \{/u);
  assert.equal((executors.match(/mapContextFreshness\(/gu) ?? []).length, 1, 'the shared rule is consulted in exactly one place');
  for (const [name, text] of Object.entries(code)) {
    assert.equal(text.includes('mapProjectionRequest('), false, `${name} must not re-derive the current projection request`);
    assert.doesNotMatch(text, /scene\.depth !== \w+\.depth|scene\.tc !== \w+\.tc/u, `${name} must not re-implement the freshness comparison`);
  }
  // The composite act proves the caller's stated destination IS the projection it landed from.
  assert.match(executors, /if \(request\.context\.scene\.tc !== resolved\.sp\) \{/u);
});

test('no second canonical store, no second temporal cursor, no generic navigation', () => {
  for (const forbidden of ['createCanonicalStore', 'useReducer', "'NAVIGATE'", 'MAP_FOCUS_OBJECT', 'expo-router', 'useRouter', 'router.push', 'router.back', 'usePathname', 'useSegments', '<Link', 'Linking']) {
    assert.equal(layerText.includes(forbidden), false, `the temporal layer must not contain ${forbidden}`);
  }
  assert.doesNotMatch(layerText, /export (?:function|const) navigate\b/u);
  // Exactly one place reaches each canonical entry point, and both are the shared outcome helper.
  assert.equal((layerText.match(/store\.dispatch\(/gu) ?? []).length, 1);
  assert.equal((layerText.match(/store\.dispatchTemporal\(/gu) ?? []).length, 1);
  assert.equal((layerText.match(/store\.dispatchMap\(/gu) ?? []).length, 0, 'the temporal layer never reaches the Map seam');
  assert.equal((layerText.match(/store\.ingest\(/gu) ?? []).length, 0, 'the temporal layer never ingests an authoritative event');
  assert.match(code['outcome.ts'], /export function dispatchKernelCommit\(store: CanonicalStore, action: KernelAction\)/u);
  assert.match(code['outcome.ts'], /export function dispatchAuthorizedTemporalAction\(/u);
  // The only kernel identities this layer sends are the two frozen commit primitives.
  const commitCode = code['targeting/commit.ts'];
  assert.equal((commitCode.match(/type: 'COMMIT_MOMENT'/gu) ?? []).length, 1);
  assert.equal((commitCode.match(/type: 'COMMIT_LIVE_EDGE'/gu) ?? []).length, 1);
  for (const forbidden of ["type: 'PAN'", "type: 'ZOOM_SEMANTIC'", "type: 'INSPECT_OBJECT'", "type: 'SWITCH_CONTEXT'", "type: 'DIRECT_JUMP'"]) {
    assert.equal(layerText.includes(forbidden), false, `the temporal layer must not dispatch ${forbidden}`);
  }
});

test('PTC is Class C: no preview, presentation or animation state can enter CanonicalState', () => {
  assert.match(classesCode, /export const CANONICAL_STATE_KEYS = Object\.freeze\(\['session', 'live', 'temporal', 'inspection', 'camera', 'history'\] as const\);/u);
  for (const forbidden of ['ptc', 'PTC', 'preview', 'Preview']) {
    const pattern = new RegExp(`(^|[^A-Za-z_])${forbidden}(?![A-Za-z_])`, 'u');
    assert.doesNotMatch(classesCode, pattern, `classes.ts must not encode ${forbidden} in Class A`);
  }
  for (const forbidden of ['PTC', 'preview', 'Preview', 'PREVIEW']) {
    assert.equal(storeCode.includes(forbidden), false, `the kernel must not learn ${forbidden}`);
    assert.equal(transitionsCode.includes(forbidden), false, `the kernel transitions must not learn ${forbidden}`);
  }
  // The preview controller has no store, no dispatch, no persistence and no transport.
  const preview = code['preview/preview-state.ts'];
  for (const forbidden of ['CanonicalStore', 'dispatch', 'store', 'fetch', 'persist', 'AsyncStorage', 'SecureStore', 'MMKV', 'SQLite', 'localStorage']) {
    assert.equal(preview.includes(forbidden), false, `the preview controller must not reference ${forbidden}`);
  }
});

test('no future-history fetch path, no transport and no persistence exists in the layer', () => {
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'HistoricalProjectionApiClient', 'TemporalApiClient', 'HistoricalDisclosureCache', 'supabase', 'axios', 'AsyncStorage', 'SecureStore', 'MMKV', 'SQLite', 'localStorage', 'persist(', 'process.env', 'EXPO_PUBLIC_']) {
    assert.equal(layerText.includes(forbidden), false, `the temporal layer must not contain ${forbidden}`);
  }
  // The preview projection reads what the projection boundary already holds, through an injected
  // lookup, and it runs BOTH gates before that lookup (R2-01).
  const projection = code['preview/preview-projection.ts'];
  assert.match(projection, /export type PreviewDisclosureLookup = \(sessionId: string, tc: number, depth: SemanticDepth\) => HistoricalDisclosureEntry;/u);
  assert.equal((projection.match(/lookup\(/gu) ?? []).length, 1, 'exactly one lookup, and it is downstream of the gates');
});

// R2-01 — the preview projection consumes the same disclosed interaction authority as targeting, so
// a canonically valid but undisclosed Moment cannot be looked up however the cache is populated.
test('R2-01 — no preview projection lookup can happen without the disclosed authority', () => {
  const projection = code['preview/preview-projection.ts'];

  // The canonical gate is never the only thing consulted here any more.
  assert.equal(projection.includes('resolveTemporalTarget('), false, 'the preview projection must not use the canonical gate directly');
  assert.equal(projection.includes('disclosedTargetAuthority('), false, 'the preview projection must not build its own disclosed authority');
  // Canonical bounds are derived, never assembled ad hoc: exactly one derivation exists in the file,
  // and R3-01 pins it inside the one authorizing function.
  assert.equal((projection.match(/temporalBounds\(/gu) ?? []).length, 1, 'canonical bounds are derived exactly once');
  // Both public entry points require the disclosed targeting authority.
  assert.match(projection, /export function previewProjectionRequest\(state: CanonicalState, targeting: TemporalTargeting, candidate: unknown\): MapProjectionRequest \| null \{/u);
  assert.match(
    projection,
    /export function previewProjection\(\s*\n\s*state: CanonicalState,\s*\n\s*targeting: TemporalTargeting,\s*\n\s*candidate: unknown,\s*\n\s*lookup: PreviewDisclosureLookup,\s*\n\s*\): PreviewProjection \{/u,
  );
  // Authorization is the one gate, it delegates to the shared disclosed rule, and it is the only
  // thing either entry point consults before projecting.
  assert.match(projection, /^function authorizePreviewTarget\(state: CanonicalState, targeting: TemporalTargeting, candidate: unknown\): PreviewTargetAuthorization \{/mu);
  assert.match(projection, /const resolved = resolveDisclosedTarget\(current, candidate\);\s*\n\s*if \(!resolved\.ok\) return \{ ok: false, code: resolved\.code, detail: resolved\.detail \};/u);
  assert.equal((projection.match(/resolveDisclosedTarget\(/gu) ?? []).length, 1, 'the disclosed rule is consulted in exactly one place');
  assert.equal((projection.match(/authorizePreviewTarget\(state, targeting, candidate\)/gu) ?? []).length, 2, 'both entry points authorize the same way');
  // Session, position and depth are all read from canonical state, never taken from the caller.
  assert.match(projection, /return \{ ok: true, target: \{ sessionId: state\.session\.id, tc: resolved\.sp, depth: state\.camera\.depth \} \};/u);
  assert.equal((projection.match(/state\.camera\.depth/gu) ?? []).length, 1, 'the camera depth is read from canonical state, once');

  // The cache is never an authorization source. Authorization is decided entirely before the lookup
  // exists: the authorizing function neither takes nor mentions one.
  const authorizeBody = projection.slice(projection.indexOf('function authorizePreviewTarget'), projection.indexOf('export type PreviewProjection'));
  assert.ok(authorizeBody.length > 0, 'the authorizing function is defined before the projection answers');
  for (const forbidden of ['lookup', 'entry', 'cache']) {
    assert.equal(authorizeBody.includes(forbidden), false, `authorization must not consult ${forbidden}`);
  }
  // Every refusal stays distinct rather than collapsing into one.
  for (const status of ['PROJECTION', 'NOT_FETCHED', 'UNAVAILABLE', 'MALFORMED', 'NOT_ADDRESSABLE']) {
    assert.ok(projection.includes(`status: '${status}'`), `${status} remains a distinct answer`);
  }
});

// R3-01 — canonical validity for a preview is judged from the state being projected, never from a
// caller-supplied bounds snapshot that could carry a later Live Head for the same Session.
test('R3-01 — a foreign or stale bounds snapshot cannot widen current canonical authority', () => {
  const projection = code['preview/preview-projection.ts'];
  const authorizeBody = projection.slice(projection.indexOf('function authorizePreviewTarget'), projection.indexOf('export type PreviewProjection'));

  // Current bounds are re-derived from the state, and composed with ONLY the disclosed authority.
  assert.match(authorizeBody, /const current: TemporalTargeting = \{ bounds: temporalBounds\(state\), disclosed: targeting\.disclosed \};/u);
  assert.equal((authorizeBody.match(/temporalBounds\(state\)/gu) ?? []).length, 1, 'canonical bounds come from the state, once');
  // The caller's own bounds are never read for anything.
  assert.equal(authorizeBody.includes('targeting.bounds'), false, 'the caller-supplied bounds snapshot must never be trusted');
  assert.equal(projection.includes('targeting.bounds'), false, 'nothing in this module may read a caller bounds snapshot');
  // Disclosure is taken from the caller and can only narrow: it carries no Live Head of its own.
  assert.match(authorizeBody, /disclosed: targeting\.disclosed/u);
  assert.equal(authorizeBody.includes('liveHead'), false, 'authorization must not read a Live Head directly');
  // A malformed authority is refused outright rather than partially trusted.
  assert.match(authorizeBody, /targeting\.disclosed === undefined/u);
});

// R3-02 — authorization is a fact about a moment, not a capability. Nothing reusable is exported.
test('R3-02 — no reusable or replayable preview-projection capability exists', () => {
  const projection = code['preview/preview-projection.ts'];
  const barrel = code['preview/index.ts'];

  // The token, its authorization result and the low-level projector are all module-private.
  for (const symbol of ['AuthorizedPreviewTarget', 'PreviewTargetAuthorization', 'authorizePreviewTarget', 'projectAuthorized']) {
    assert.doesNotMatch(projection, new RegExp(`export (?:function|const|interface|type) ${symbol}\\b`, 'u'), `${symbol} must not be exported`);
    assert.equal(barrel.includes(symbol), false, `${symbol} must not cross the layer boundary`);
  }
  // The public surface is exactly the two atomic entry points.
  const exported = [...barrel.matchAll(/export \{([^}]*)\} from '\.\/preview-projection';/gu)].flatMap((match) =>
    match[1].split(',').map((name) => name.trim()).filter(Boolean),
  );
  assert.deepEqual(exported.sort(), ['previewProjection', 'previewProjectionRequest']);
  // Neither holds state between calls: both authorize against the state handed to that very call.
  for (const entry of ['previewProjectionRequest', 'previewProjection']) {
    const body = projection.slice(projection.indexOf(`export function ${entry}(`));
    assert.match(body, /const authorization = authorizePreviewTarget\(state, targeting, candidate\);/u, `${entry} authorizes on every call`);
  }
  // No module-level mutable authority survives a call.
  assert.equal(projection.includes('WeakSet'), false, 'a brand is not freshness; there is no capability left to brand');
  assert.doesNotMatch(projection, /^(?:const|let) \w+ = new (?:Map|Set|WeakMap)\(/mu, 'the module keeps no cross-call state');
});

test('no temporal act can be reached from a camera act, an animation or a presentation movement', () => {
  // Map pan and semantic zoom are not referenced at all, so no camera act can imply a temporal one.
  for (const forbidden of ['panByTranslation', 'zoomSemanticStep', 'exploreViewport', 'useMapPanGesture']) {
    assert.equal(layerText.includes(forbidden), false, `the temporal layer must not contain ${forbidden}`);
  }
  // The motion modules are import-isolated from every route to canonical state.
  for (const name of ['motion/temporal-motion.ts', 'motion/useTemporalMotion.ts']) {
    const text = code[name];
    for (const forbidden of [
      'store',
      'dispatch',
      'commitMoment',
      'commitLiveEdge',
      'commitPreviewedTarget',
      'commitTemporalIntent',
      'chooseLocus',
      'CanonicalStore',
      'CanonicalState',
      'TemporalOutcome',
      'TemporalPreviewController',
      '../targeting',
      '../outcome',
      '../preview',
      '../../state',
      '../../map',
      '../../timeline',
    ]) {
      assert.equal(text.includes(forbidden), false, `${name} must not reference ${forbidden}`);
    }
  }
  // The pure motion contract imports NOTHING at all: it is arithmetic over numbers.
  assert.equal((code['motion/temporal-motion.ts'].match(/^import /gmu) ?? []).length, 0, 'the motion contract imports nothing');
  // Reduced motion and finger tracking are the only two things that zero a duration.
  assert.match(code['motion/temporal-motion.ts'], /cursorMs: reduced \|\| tracking \? 0 : TEMPORAL_MOTION_DURATIONS\.cursorMs,/u);
  assert.match(code['motion/temporal-motion.ts'], /temporalStance: input\.mode === 'FOLLOW_LIVE' \? 'FOLLOWING_LIVE' : 'PINNED_TO_MOMENT',/u);

  // R1-MOTION-04 — reduced motion drops MOVEMENT and keeps the opacity bridge. Every duration that
  // moves something is zeroed; the preview's presence fade is not, because it is not movement.
  for (const moving of ['cursorMs', 'cancelMs', 'commitSettleMs']) {
    assert.match(code['motion/temporal-motion.ts'], new RegExp(`${moving}: reduced[^\\n]*\\? 0 :`, 'u'), `${moving} is zeroed under reduced motion`);
  }
  assert.match(code['motion/temporal-motion.ts'], /presenceMs: TEMPORAL_MOTION_DURATIONS\.presenceMs,/u);

  // R1-MOTION-01 — the presentation window offset is never animated. Scrolling is a
  // hundreds-of-times-a-day action, and easing the markers against it would both animate that action
  // and blur presentation movement into temporal traversal.
  const binding = code['motion/useTemporalMotion.ts'];
  assert.match(binding, /const windowOffset = useSharedValue\(geometry\.windowOffset\);/u);
  assert.match(binding, /windowOffset\.set\(geometry\.windowOffset\);/u);
  assert.doesNotMatch(binding, /with(?:Timing|Spring)\([^)]*windowOffset/u, 'the window offset must never be animated');
  assert.equal((binding.match(/- windowOffset\.get\(\)/gu) ?? []).length, 2, 'both markers subtract the offset outside the animated value');
  // Positions animate in TRACK space, which the window cannot move.
  const motion = code['motion/temporal-motion.ts'];
  assert.match(motion, /export function trackOffsetFor\(sp: number \| null, stepWidth: number\): number \| null \{/u);
  const trackOffsetBody = motion.slice(motion.indexOf('export function trackOffsetFor'), motion.indexOf('export interface TemporalMotionGeometry'));
  assert.ok(trackOffsetBody.length > 0, 'track space is defined before the window geometry');
  assert.equal(trackOffsetBody.includes('windowOffset'), false, 'track space must not know about the presentation window');

  // R1-MOTION-02 — the first real position is SET, never animated to, so nothing slides in from the
  // Track origin on mount or on the first mirrored Moment.
  assert.match(binding, /const placed = useRef\(false\);/u);
  assert.match(binding, /placed\.current = true;\s*\n\s*committedTrack\.set\(committedTarget\);\s*\n\s*cursorTrack\.set\(cursorTo\);\s*\n\s*return;/u);

  // R1-MOTION-03 — the commit acknowledgement rides the committed marker itself; there is no
  // separate element that could animate while painting nothing.
  assert.match(
    binding,
    /\{ translateX: restingMarkerX\(committedTrack\.get\(\) - windowOffset\.get\(\), viewport\.get\(\), rtl\.get\(\) === 1\) \},\s*\n[\s\S]*?\{ scaleY: 1 \+ settle\.get\(\) \* COMMIT_SETTLE_SCALE \},/u,
  );
  assert.equal(binding.includes('settleStyle'), false, 'the dead acknowledgement overlay is gone');
  assert.equal(code['timeline-integration/TemporalTargetLayer.tsx'].includes('settleStyle'), false);
  // Reduced motion never depends on a spring's zero-duration behaviour.
  assert.match(binding, /\} else if \(cancelMs === 0\) \{\s*\n\s*cursorTrack\.set\(withTiming\(committedTarget, \{ duration: 0 \}\)\);/u);
  // The commit acknowledgement is called with the store's answer already in hand.
  assert.match(code['timeline-integration/scrub.ts'], /const outcome = commitPreviewedTarget\(store, preview, targeting\(observers\)\);\s*\n\s*observers\.onOutcome\?\.\(outcome\);/u);
  // Per-frame work never crosses to the RN runtime: only a threshold crossing and the ending do.
  const scrubHook = code['timeline-integration/useTemporalScrub.ts'];
  assert.equal((scrubHook.match(/scheduleOnRN\(/gu) ?? []).length, 3, 'exactly one reaction crossing and the two gesture endings');
  // The two gesture-phase callbacks write shared values and nothing else: no runtime crossing while
  // the finger is moving, and no Product handler reachable from a frame.
  const beforeEnd = scrubHook.slice(scrubHook.indexOf('.onBegin('), scrubHook.indexOf('.onEnd('));
  assert.ok(beforeEnd.length > 0, 'the gesture has a per-frame path to check');
  assert.equal(beforeEnd.includes('scheduleOnRN'), false, 'scheduleOnRN is never called per frame');
  assert.equal(beforeEnd.includes('handlers.'), false, 'no Product handler is reached per frame');
  // `onBegin` mints the interaction epoch once; `onUpdate` — the actual per-frame callback — writes
  // exactly one shared value and nothing else at all.
  assert.deepEqual([...beforeEnd.matchAll(/(\w+)\.set\(/gu)].map((match) => match[1]).sort(), ['epoch', 'fingerX', 'fingerX', 'tracking']);
  const perFrame = scrubHook.slice(scrubHook.indexOf('.onUpdate('), scrubHook.indexOf('.onEnd('));
  assert.deepEqual([...perFrame.matchAll(/(\w+)\.set\(/gu)].map((match) => match[1]), ['fingerX']);
  // Shared values are read and written through `get`/`set`: the React Compiler cannot see through
  // direct `.value` access, and the repository lints with its rules as errors.
  for (const name of ['motion/useTemporalMotion.ts', 'timeline-integration/useTemporalScrub.ts']) {
    assert.doesNotMatch(code[name], /\.value\s*=/u, `${name} must not assign through .value`);
  }
  assert.equal(scrubHook.includes('runOnJS'), false, 'runOnJS is removed in Reanimated 4');
  assert.equal(layerText.includes('runOnJS'), false, 'runOnJS is removed in Reanimated 4');
});

test('T-05 stays presentation-only: every T-05 file is byte-identical and gains no store authority', async () => {
  for (const [file, blob] of [
    ['apps/mobile/src/timeline/index.ts', '99ce579be9d3543658d226c6634db6e9b01499eb'],
    ['apps/mobile/src/timeline/model/disclosedTrack.ts', '1348a13e8fe20aebffc3ebf44b3b64db747d67ac'],
    ['apps/mobile/src/timeline/position/scale.ts', '57da822559485677e319c928b4123a6cf160ea98'],
    ['apps/mobile/src/timeline/window/controller.ts', '83b9bc86de9240f85bac209e862c3b80576d059b'],
    ['apps/mobile/src/timeline/accessibility/commands.ts', '8debbb68131e6f34739ea8abf7ff067089e26276'],
    ['apps/mobile/src/timeline/accessibility/PresentationNavigator.tsx', '35efaa9286b98c8670f767e04b7aa3e2c00639a0'],
    ['apps/mobile/src/timeline/virtualization/TimelinePresentation.tsx', '388037bc524dca8a7abbe1cad240a6517585cb5d'],
    ['apps/mobile/src/timeline/testing/fixtures.ts', 'f59c962d13e6af81088e69168c0c00f307acbf8e'],
    ['apps/mobile/src/timeline/__tests__/controller.test.ts', '8453bae72e867c13788384a81f3eaca17cde2ada'],
    ['apps/mobile/src/timeline/__tests__/firewall.test.tsx', 'ab260d5034ba9ac291c4c89f858fa1254529b6e8'],
    ['apps/mobile/src/timeline/__tests__/large-history.test.tsx', '88bf84b0df0cca20dc68335768c62a5245d22197'],
  ]) {
    assert.equal(gitBlobId(await read(file)), blob, `${file} is byte-identical: T-05 gains nothing from the temporal layer`);
  }
  // The bridge runs one way: T-06 reads T-05's model and writes nothing back into it.
  const bridge = code['timeline-integration/disclosed-bridge.ts'];
  assert.match(bridge, /import \{ hitTest, type DisclosedMomentTarget, type DisclosedTrack, type PresentationSnapshot \} from '\.\.\/\.\.\/timeline';/u);
  for (const forbidden of ['controller.move', 'controller.page', 'controller.adjust', 'setViewport', 'replaceDisclosed']) {
    assert.equal(bridge.includes(forbidden), false, `the bridge must not drive the presentation controller (${forbidden})`);
  }
  assert.equal(layerText.includes('controller.move('), false, 'the temporal layer never moves the presentation window');
  // The Track's Session is checked before any target is admitted, against BOTH authorities: the
  // mirrored Session and the Track that is currently authorizing interaction.
  assert.match(bridge, /if \(track\.sessionId !== targeting\.bounds\.sessionId \|\| track\.sessionId !== targeting\.disclosed\.sessionId\) \{/u);
});

test('the temporal layer adds no dependency, and no state, persistence or navigation library', async () => {
  const mobilePackage = await readJson('apps/mobile/package.json');
  const specifiers = new Set();
  for (const text of Object.values(code)) {
    for (const match of text.matchAll(/from\s+'([^']+)'/gu)) if (!match[1].startsWith('.')) specifiers.add(match[1]);
    assert.doesNotMatch(text, /require\(/u);
  }
  assert.deepEqual(
    [...specifiers].sort(),
    ['@qandeel/runtime', 'react', 'react-native', 'react-native-gesture-handler', 'react-native-reanimated', 'react-native-worklets'],
  );
  // Every one of them is already an authorized dependency of the mobile package; T-06 adds none.
  for (const specifier of specifiers) {
    if (specifier === '@qandeel/runtime') continue;
    if (specifier === 'react-native-gesture-handler' || specifier === 'react-native-reanimated' || specifier === 'react-native-worklets') {
      assert.ok(mobilePackage.dependencies[specifier], `${specifier} is already an authorized dependency`);
    }
  }
  const lock = await readJson('package-lock.json');
  for (const name of ['zustand', 'redux', '@reduxjs/toolkit', 'react-redux', 'immer', 'xstate', 'jotai', 'mobx', 'valtio', 'recoil', 'react-native-mmkv', '@react-native-async-storage/async-storage', 'expo-secure-store', 'expo-sqlite', 'moment', 'dayjs', 'date-fns', 'luxon']) {
    const copies = Object.keys(lock.packages).filter((key) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`));
    assert.deepEqual(copies, [], `${name} must not be installed`);
  }
  assert.equal(existsSync(new URL('apps/mobile/package-lock.json', root)), false);
});

test('no timestamp, wall clock or presentation quantity is ever temporal authority', () => {
  const judging = [
    code['targeting/addressability.ts'],
    code['targeting/commit.ts'],
    code['targeting/locate.ts'],
    code['targeting/temporal-actions.ts'],
    code['preview/preview-state.ts'],
    code['preview/preview-projection.ts'],
  ].join('\n');
  for (const forbidden of ['Date.now', 'new Date', 'performance.now', 'timestamp', 'wallClock', 'createdAt', 'updatedAt', 'velocity', 'duration', 'percent', 'scrollOffset', 'pixel']) {
    assert.equal(judging.includes(forbidden), false, `temporal judgement must not read ${forbidden}`);
  }
  // The one addressability gate, consulted everywhere and defined once.
  assert.match(code['targeting/addressability.ts'], /export function resolveTemporalTarget\(bounds: TemporalBounds, candidate: unknown\): TargetResolution \{/u);
  assert.equal((code['targeting/addressability.ts'].match(/candidate > lh/gu) ?? []).length, 1, 'the Live Head bound is stated once');
  // The Live Edge is a mode intent with no route from a Moment target.
  assert.match(code['targeting/addressability.ts'], /export type TemporalTargetIntent =\s*\n\s*\| \{ readonly kind: 'MOMENT'; readonly sp: SessionPosition \}\s*\n\s*\| \{ readonly kind: 'LIVE_EDGE' \};/u);
  // The commit router switches on the two shapes and has no path from the Moment branch into the
  // Live one, so reaching or selecting SP(LH) can never quietly mean FOLLOW_LIVE.
  assert.match(
    code['targeting/commit.ts'],
    /case 'MOMENT':\s*\n\s*return commitMoment\(store, intent\.sp\);\s*\n\s*case 'LIVE_EDGE':\s*\n\s*return commitLiveEdge\(store\);/u,
  );
  assert.equal((code['targeting/commit.ts'].match(/commitLiveEdge\(store\)/gu) ?? []).length, 2, 'the Live Edge is committed from exactly the two explicit Live routes');
});

test('every T-06 source file is real text: no control byte can make git treat it as binary', () => {
  // A stray NUL renders a file binary to git, so it stops being diffable and reviewable — and it is
  // invisible in every editor. It is worth one assertion to keep the layer readable.
  for (const [name, text] of Object.entries(sources)) {
    const control = [...text].findIndex((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 0x20 && character !== '\n' && character !== '\t';
    });
    assert.equal(control, -1, `${name} contains a control character at index ${control}`);
  }
});

test('no credential or public runtime secret in the temporal layer', () => {
  for (const [name, text] of Object.entries(sources)) {
    assert.doesNotMatch(
      text,
      /(?:ANTHROPIC|OPENAI|GOOGLE_AI|SUPABASE_SERVICE_ROLE)_(?:API_)?KEY|SUPABASE_PUBLISHABLE_KEY|EXPO_PUBLIC_|sk-ant-/u,
      `${name} references a credential or public runtime secret`,
    );
  }
});

test('the T-06 gate is registered at the root and in Mobile CI without a new native job', async () => {
  const rootPackage = await readJson('package.json');
  assert.equal(rootPackage.scripts['test:temporal-navigation-layer-contract'], 'node --test tests/temporal-navigation-layer-contract.test.mjs');
  const mobileCi = await read('.github/workflows/mobile-ci.yml');
  assert.match(mobileCi, /run: npm run test:temporal-navigation-layer-contract/u);
  assert.match(mobileCi, /'tests\/temporal-navigation-layer-contract\.test\.mjs'/u);
  // The native set is unchanged: exactly the fast gate plus Android and iOS, both still gated.
  assert.equal((mobileCi.match(/runs-on: /gu) ?? []).length, 3, 'no job beyond the fast gate and the two native jobs');
  assert.equal((mobileCi.match(/runs-on: macos-26/gu) ?? []).length, 1);
  assert.equal((mobileCi.match(/if: needs\.verify-mobile-contracts\.outputs\.native_impact == 'true'/gu) ?? []).length, 2);
  assert.equal(existsSync(new URL('docs/temporal-navigation-layer-v1.md', root)), true);
  assert.match(await read('apps/mobile/README.md'), /Temporal navigation layer \(T-06\)/u);
});

test('no generated native project or dangerous mod entered the tree', async () => {
  for (const [name, text] of Object.entries(sources)) {
    assert.doesNotMatch(text, /withDangerousMod/u, `${name} uses a Level-4 dangerous mod`);
  }
  const appConfig = await readJson('apps/mobile/app.json');
  assert.deepEqual(appConfig.expo.plugins, ['expo-router']);
  assert.equal(existsSync(new URL('apps/mobile/ios', root)), false);
  assert.equal(existsSync(new URL('apps/mobile/android', root)), false);
});
