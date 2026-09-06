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
  assert.ok(suites.length >= 11, `expected the T-06 adversarial suites, found ${suites.length}`);
  // R1 added two adversarial suites by name; neither may be dropped while the code they guard stays.
  for (const suite of ['interaction-race.test.ts', 'locus-choice.test.tsx']) {
    assert.ok(suites.includes(suite), `the R1 suite ${suite} must exist`);
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
  // An interaction acts only on the preview it established.
  assert.match(scrub, /const ownsLivePreview = owned !== null && deps\.preview\.isCurrent\(owned\);/u);
  assert.match(scrub, /if \(ownsLivePreview\) deps\.preview\.cancel\(\);/u);
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
  assert.match(pending, /if \(outcome\.outcome !== 'LOCUS_SELECTION_REQUIRED'\) return null;/u);
  assert.match(pending, /return loci\.length >= 2 \? Object\.freeze\(\{ kind: 'SPATIAL'/u);
  // Only an offered choice may be submitted, and it goes through the existing executors.
  assert.match(pending, /if \(!pending\.loci\.some\(\(candidate\) => candidate === locus\)\) \{/u);
  assert.match(pending, /\? commitMomentAndLocate\(store, \{ moment: pending\.moment, context: pending\.context, target: pending\.target, locus \}\)/u);
  assert.match(pending, /: chooseLocus\(store, \{ context: pending\.context, target: pending\.target, locus \}\);/u);
  // Every legitimate option is offered, exactly once, with no preselection and no ranking.
  assert.match(pending, /const options = pending\.loci\.map\(\(locus\) =>/u);
  assert.match(pending, /orderingNote: CONTEXT_ORDER_NOTE,/u);
  assert.match(pending, /The order is not a ranking\./u);
  for (const forbidden of ['slice(0, 1)', 'sort(', 'filter(', 'reverse(', 'preselect', 'defaultOption']) {
    assert.equal(pending.includes(forbidden), false, `the chooser must not ${forbidden} the legitimate options`);
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
  assert.match(surface, /const option = model\.options\.find\(\(candidate\) => candidate\.key === key\);\s*\n\s*if \(option === undefined\) return;/u);
});

test('the T-01 technical shell stays byte-identical: the temporal layer is not mounted in the app container', async () => {
  const entries = readdirSync(new URL('apps/mobile/src/app/', root)).sort();
  assert.deepEqual(entries, ['_layout.tsx', 'index.tsx']);
  assert.equal(gitBlobId(await read('apps/mobile/src/app/_layout.tsx')), '90179f6d13026e9b0e2345e0418012214b9c9aab');
  assert.equal(gitBlobId(await read('apps/mobile/src/app/index.tsx')), 'ef38d10c76a957163bf00f7b7b60fb8aa25841f4');
  assert.equal(gitBlobId(await read('apps/mobile/src/shell/FoundationShell.tsx')), 'e2286ba1a35c2e40def475af5deed2d8ba8120d3');
  for (const file of ['apps/mobile/src/app/_layout.tsx', 'apps/mobile/src/app/index.tsx', 'apps/mobile/src/shell/FoundationShell.tsx']) {
    const text = await read(file);
    assert.doesNotMatch(text, /temporal-navigation|TemporalTargetLayer|TemporalNavigator/u, `${file} must not mount the temporal layer in T-06`);
  }
});

test('exactly two frozen acts were promoted to executable, by name, and no T-07 act moved', () => {
  assert.match(actionsCode, /TEMPORAL_ACTION_TYPES = Object\.freeze\(\['COMMIT_MOMENT_AND_LOCATE', 'CHOOSE_LOCUS'\] as const\);/u);
  assert.match(actionsCode, /export type StoreAction = KernelAction \| MapAction \| TemporalAction;/u);
  assert.match(actionsCode, /export type RhActionId = KernelActionType \| MapActionType \| TemporalActionType \| MetadataOnlyActionType;/u);

  const metadataOnly = actionsCode.match(/METADATA_ONLY_ACTION_TYPES = Object\.freeze\(\[([\s\S]*?)\] as const\)/u);
  assert.ok(metadataOnly, 'METADATA_ONLY_ACTION_TYPES must be a literal array');
  assert.deepEqual(
    [...metadataOnly[1].matchAll(/'([A-Z_]+)'/gu)].map((match) => match[1]).sort(),
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
  // Every T-07 identity is still later-owner metadata, owned by T-07, and none was promoted.
  for (const id of ['RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'GO_LIVE_AND_LOCATE', 'RETURN_WORLD', 'EXACT_RETURN', 'BACK_ONE_STEP']) {
    assert.equal(entries[id].level, 'METADATA_ONLY', `${id} is still owned by a later task`);
    assert.equal(entries[id].owner, 'T-07');
  }
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
  const authorityInterface = storeCode.slice(
    storeCode.indexOf('export interface TemporalActionAuthority'),
    storeCode.indexOf('export interface StoreDependencies'),
  );
  assert.ok(authorityInterface.length > 0, 'the TemporalActionAuthority interface exists');
  assert.match(authorityInterface, /consume\(action: TemporalAction\): boolean;/u);
  assert.equal((authorityInterface.match(/^\s{2}\w+\(/gmu) ?? []).length, 1, 'the authority exposes exactly one member: it can answer, never mint');
  // The two promoted families never share an authority.
  assert.equal((storeCode.match(/mapActionAuthority = deps\.mapActionAuthority/gu) ?? []).length, 1);
  assert.equal((storeCode.match(/temporalActionAuthority = deps\.temporalActionAuthority/gu) ?? []).length, 1);

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
  // lookup, and it runs the addressability gate BEFORE that lookup.
  const projection = code['preview/preview-projection.ts'];
  assert.match(projection, /export type PreviewDisclosureLookup = \(sessionId: string, tc: number, depth: SemanticDepth\) => HistoricalDisclosureEntry;/u);
  assert.match(projection, /const resolved = resolveTemporalTarget\(temporalBounds\(state\), candidate\);\s*\n\s*if \(!resolved\.ok\) return \{ status: 'NOT_ADDRESSABLE'/u);
  assert.equal((projection.match(/lookup\(/gu) ?? []).length, 1, 'exactly one lookup, and it is downstream of the gate');
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
  assert.match(binding, /\{ translateX: committedTrack\.get\(\) - windowOffset\.get\(\) \},\s*\n[\s\S]*?\{ scaleY: 1 \+ settle\.get\(\) \* COMMIT_SETTLE_SCALE \},/u);
  assert.equal(binding.includes('settleStyle'), false, 'the dead acknowledgement overlay is gone');
  assert.equal(code['timeline-integration/TemporalTargetLayer.tsx'].includes('settleStyle'), false);
  // Reduced motion never depends on a spring's zero-duration behaviour.
  assert.match(binding, /\} else if \(cancelMs === 0\) \{\s*\n\s*cursorTrack\.set\(withTiming\(committedTarget, \{ duration: 0 \}\)\);/u);
  // The commit acknowledgement is called with the store's answer already in hand.
  assert.match(code['timeline-integration/scrub.ts'], /const outcome = commitPreviewedTarget\(deps\.store, deps\.preview, targeting\(\)\);\s*\n\s*deps\.onOutcome\?\.\(outcome\);/u);
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
