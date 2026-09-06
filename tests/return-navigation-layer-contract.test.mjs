import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// T-07 — Return Semantics + Reversible History Restoration: static executable contract.
//
// Semantic behaviour is proven by the Jest suites under apps/mobile/src/return-navigation
// (RN07-A…RN07-I). This gate guards what a passing unit test cannot: the file surface, the absence
// of any dependency at all, the exact registry promotion, the separation of the RH-consumption
// transaction from the append one, the anti-scope, and that the gate itself is registered in CI.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFile(new URL(path, root), 'utf8');
const readJson = async (path) => JSON.parse(await read(path));

const RN_DIR = 'apps/mobile/src/return-navigation';
const STATE_DIR = 'apps/mobile/src/state';

const PRODUCTION_FILES = [
  'authority.ts',
  'availability.ts',
  'focus-target.ts',
  'go-live-and-locate.ts',
  'history-restoration.ts',
  'index.ts',
  'live-focus.ts',
  'live-head.ts',
  'outcomes.ts',
  'return-world.ts',
  'surface.ts',
];

const SIX = ['RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'GO_LIVE_AND_LOCATE', 'RETURN_WORLD', 'EXACT_RETURN', 'BACK_ONE_STEP'];

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

const sources = Object.fromEntries(await Promise.all(PRODUCTION_FILES.map(async (name) => [name, await read(`${RN_DIR}/${name}`)])));
/** Code only: a comment may name a forbidden pattern in order to forbid it. */
const code = Object.fromEntries(Object.entries(sources).map(([name, text]) => [name, stripComments(text)]));
const layerText = Object.values(code).join('\n');

const actionsSource = await read(`${STATE_DIR}/actions.ts`);
const actionsCode = stripComments(actionsSource);
const transitionsSource = await read(`${STATE_DIR}/transitions.ts`);
const transitionsCode = stripComments(transitionsSource);
const storeCode = stripComments(await read(`${STATE_DIR}/store.ts`));
const classesCode = stripComments(await read(`${STATE_DIR}/classes.ts`));
const historyCode = stripComments(await read(`${STATE_DIR}/history.ts`));
const stateIndexCode = stripComments(await read(`${STATE_DIR}/index.ts`));

test('the authorized T-07 file surface is the only production surface of the return layer', () => {
  const dir = join(rootPath, RN_DIR);
  const production = listFiles(dir)
    .map((file) => file.slice(dir.length + 1).replace(/\\/g, '/'))
    .filter((file) => !file.startsWith('__tests__/') && !file.startsWith('__fixtures__/'))
    .sort();
  assert.deepEqual(production, [...PRODUCTION_FILES].sort());
  const suites = readdirSync(join(dir, '__tests__')).filter((file) => /\.test\.tsx?$/u.test(file));
  for (const suite of ['authority.test.ts', 'back.test.ts', 'exact-return.test.ts', 'preview.test.ts', 'live-head.test.ts', 'live-focus.test.ts', 'return-world.test.ts', 'go-live-and-locate.test.ts', 'chains.test.ts']) {
    assert.ok(suites.includes(suite), `the adversarial suite ${suite} must exist`);
  }
});

// §30.1, §30.2, §30.27 — exactly six identities were promoted, by name, and nothing else moved.
test('exactly the six frozen return identities were promoted, keeping name, owner, authority and category', () => {
  assert.match(
    actionsCode,
    /RETURN_ACTION_TYPES = Object\.freeze\(\[\s*\n\s*'RETURN_LIVE_HEAD',\s*\n\s*'RETURN_LIVE_FOCUS',\s*\n\s*'GO_LIVE_AND_LOCATE',\s*\n\s*'RETURN_WORLD',\s*\n\s*'EXACT_RETURN',\s*\n\s*'BACK_ONE_STEP',\s*\n\] as const\);/u,
  );
  assert.match(actionsCode, /export type StoreAction = KernelAction \| MapAction \| TemporalAction \| ReturnAction;/u);
  assert.match(actionsCode, /export type RhActionId = KernelActionType \| MapActionType \| TemporalActionType \| ReturnActionType \| MetadataOnlyActionType;/u);
  assert.match(actionsCode, /RH_CONSUMING_ACTION_TYPES = Object\.freeze\(\['EXACT_RETURN', 'BACK_ONE_STEP'\] as const\);/u);

  // The earlier promotions are untouched: T-04's three and T-06's two, by exact name.
  assert.match(actionsCode, /MAP_ACTION_TYPES = Object\.freeze\(\['INSPECT_OBJECT', 'SWITCH_CONTEXT', 'DIRECT_JUMP'\] as const\);/u);
  assert.match(actionsCode, /TEMPORAL_ACTION_TYPES = Object\.freeze\(\['COMMIT_MOMENT_AND_LOCATE', 'CHOOSE_LOCUS'\] as const\);/u);

  // The later-owner set is now EMPTY, and its fail-closed rule is stated over the LEVEL, so the next
  // frozen later-owner act registered at it still fails closed the moment it exists.
  assert.match(actionsCode, /METADATA_ONLY_ACTION_TYPES = Object\.freeze\(\[\] as const\);/u);
  assert.match(actionsCode, /export type CatalogLevel = 'KERNEL' \| 'EXECUTABLE' \| 'METADATA_ONLY' \| 'NOT_STORE_ACTION';/u);
  assert.match(storeCode, /if \(entry\.level === 'METADATA_ONLY'\) throw new OwnedByLaterTask\(entry\.id, entry\.owner\);/u);

  const blocks = [
    ...actionsSource.matchAll(
      /id: '([A-Z_]+)',\n\s*frozenName: '([^']+)',[\s\S]*?level: '([A-Z_]+)',\n\s*owner: '([A-Z0-9-]+)',[\s\S]*?authority: fields\(([^)]*)\),\n\s*transactional: '([A-Z_]+)'/gu,
    ),
  ];
  const entries = Object.fromEntries(blocks.map((m) => [m[1], { frozenName: m[2], level: m[3], owner: m[4], authority: m[5], transactional: m[6] }]));

  const expected = {
    RETURN_LIVE_HEAD: ['P4 Return to Live Head', "'TM'", 'EFFECTIVE_TRANSACTION'],
    RETURN_LIVE_FOCUS: ['Return to Live Focus (D1)', '...SPATIAL', 'EFFECTIVE_TRANSACTION'],
    GO_LIVE_AND_LOCATE: ['P5 Go Live + Locate', "'TM', ...SPATIAL", 'COMPOSITE_TRANSACTION'],
    RETURN_WORLD: ['Return to World', "'MC.depth', ...SPATIAL", 'EFFECTIVE_TRANSACTION'],
    EXACT_RETURN: ['P7 Exact Return / Original Inspection', "'TM', 'IF_ref', 'MC.depth', ...SPATIAL", 'CONSUMES_RH'],
    BACK_ONE_STEP: ['P8 Back One Step', "'TM', 'IF_ref', 'MC.depth', ...SPATIAL", 'CONSUMES_RH'],
  };
  for (const [id, [frozenName, authority, transactional]] of Object.entries(expected)) {
    assert.ok(entries[id], `${id} must be registered`);
    assert.equal(entries[id].level, 'EXECUTABLE', `${id} is executable`);
    assert.equal(entries[id].owner, 'T-07');
    assert.equal(entries[id].frozenName, frozenName, `${id} keeps its frozen name`);
    assert.equal(entries[id].authority, authority, `${id} keeps its frozen Class-A authority`);
    assert.equal(entries[id].transactional, transactional, `${id} keeps its frozen transactional category`);
    // No return act can reach live truth or the Session.
    for (const forbidden of ['LH', 'LF']) assert.equal(entries[id].authority.includes(`'${forbidden}'`), false, `${id} must not hold ${forbidden} authority`);
  }
  // The three earlier promotions are unchanged, and no Class C / D identity became dispatchable.
  for (const id of ['INSPECT_OBJECT', 'SWITCH_CONTEXT', 'DIRECT_JUMP', 'COMMIT_MOMENT_AND_LOCATE', 'CHOOSE_LOCUS']) {
    assert.equal(entries[id].level, 'EXECUTABLE', `${id} stays executable`);
  }
  for (const id of ['PREVIEW_TEMPORAL_TARGET', 'CANCEL_PREVIEW', 'RELATIVE_FORWARD_CONTINUATION', 'INPUT_CANCELLATION', 'PRESENTATION_WINDOW_MOVE', 'PRESENTATION_POSITION_MOVE', 'PRESENTATION_POSITION_REFINE', 'PRESENTATION_POSITION_WIDEN', 'RESPONSIVE_RECOMPOSITION', 'REDUCED_MOTION_PREFERENCE']) {
    assert.equal(entries[id].level, 'NOT_STORE_ACTION', `${id} never reaches the store`);
  }
});

// §30.2, §30.3 — no generic identity, and Product history is never route history.
test('no generic navigation identity and no router-as-Product-Back exists anywhere in the layer', () => {
  for (const forbidden of ["'NAVIGATE'", "'HOME'", "'RESET'", "'GO_LIVE'", "'BACK'", "'RESTORE'", 'MAP_FOCUS_OBJECT', 'expo-router', 'useRouter', 'router.push', 'router.back', 'usePathname', 'useSegments', '<Link', 'Linking', 'createCanonicalStore', 'useReducer']) {
    assert.equal(layerText.includes(forbidden), false, `the return layer must not contain ${forbidden}`);
  }
  for (const pattern of [/export (?:function|const) navigate\b/u, /export (?:function|const) goHome\b/u, /export (?:function|const) reset\b/u, /export (?:function|const) goLive\b/u, /export (?:function|const) restore\b/u, /export (?:function|const) backOrHome\b/u]) {
    assert.doesNotMatch(layerText, pattern, `the six acts must not be collapsed into ${String(pattern)}`);
  }
  // Six identities, six public executors, one each. No route reaches two of them.
  const barrel = code['index.ts'];
  for (const executor of ['returnLiveHead', 'returnLiveFocus', 'goLiveAndLocate', 'returnWorld', 'exactReturn', 'backOneStep']) {
    assert.ok(barrel.includes(executor), `${executor} is exported`);
  }
  // Outside the mint — which declares the plan union and switches on it — each identity is planned
  // in exactly one place, so no executor can quietly run a second act.
  const executors = Object.entries(code)
    .filter(([name]) => name !== 'authority.ts')
    .map(([, text]) => text)
    .join('\n');
  for (const id of ['RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'RETURN_WORLD', 'EXACT_RETURN', 'BACK_ONE_STEP']) {
    assert.equal((executors.match(new RegExp(`act: '${id}'`, 'gu')) ?? []).length, 1, `${id} is planned in exactly one place`);
  }
  // P5 plans itself in exactly two places — with a landing and without one — and never delegates to
  // another return identity, which is what would turn it into two transactions.
  assert.equal((code['go-live-and-locate.ts'].match(/act: 'GO_LIVE_AND_LOCATE'/gu) ?? []).length, 2);
  for (const other of SIX.filter((id) => id !== 'GO_LIVE_AND_LOCATE')) {
    assert.equal(code['go-live-and-locate.ts'].includes(other), false, `P5 must not reference ${other}`);
  }
});

// §30.4, §30.5, §30.6 — a third, independent seam and a third, independent authority.
test('a return act reaches canonical state only through its own authorized seam', () => {
  assert.match(storeCode, /dispatchReturn\(action: ReturnAction\): DispatchResult;/u);
  assert.match(storeCode, /if \(!isReturnActionType\(entry\.id\)\) \{\s*\n\s*throw new UnauthorizedActionClass\(/u);
  assert.match(storeCode, /if \(returnActionAuthority === undefined\) \{\s*\n\s*throw new UnauthorizedReturnAction\(/u);
  assert.match(storeCode, /if \(returnActionAuthority\.consume\(action\) !== true\) \{\s*\n\s*throw new UnauthorizedReturnAction\(/u);
  // §30.6 — the neighbouring seams admit by FAMILY, before any authority is consulted, so a return
  // act is refused at each of them by identity rather than by a WeakSet miss.
  assert.match(storeCode, /if \(!isMapActionType\(entry\.id\)\) \{\s*\n\s*throw new UnauthorizedActionClass\(/u);
  assert.match(storeCode, /if \(!isTemporalActionType\(entry\.id\)\) \{\s*\n\s*throw new UnauthorizedActionClass\(/u);
  assert.match(storeCode, /const isReturnActionType = \(id: string\): boolean => \(RETURN_ACTION_TYPES as readonly string\[\]\)\.includes\(id\);/u);

  // The raw dispatch surface refuses EVERY promoted family, and its EXECUTABLE branch does nothing
  // but refuse — so no promoted act of any family can fall through it.
  const executableBranch = storeCode.slice(
    storeCode.indexOf("if (entry.level === 'EXECUTABLE') {"),
    storeCode.indexOf('return runTransaction(action, entry);\n  }\n\n  function dispatchMap'),
  );
  assert.ok(executableBranch.length > 0, 'the raw dispatch surface refuses every promoted act');
  assert.match(executableBranch, /throw new UnauthorizedReturnAction\(entry\.id, 'a return act reaches canonical state only through the authorized return seam'\)/u);
  assert.equal((executableBranch.match(/\bthrow new\b/gu) ?? []).length, 3, 'the EXECUTABLE branch does nothing but refuse, once per family');
  assert.doesNotMatch(executableBranch, /runTransaction/u);

  // The three promoted families never share an authority.
  const authorityInterface = storeCode.slice(storeCode.indexOf('export interface ReturnActionAuthority'), storeCode.indexOf('export interface StoreDependencies'));
  assert.ok(authorityInterface.length > 0, 'the ReturnActionAuthority interface exists');
  assert.match(authorityInterface, /consume\(action: ReturnAction\): boolean;/u);
  assert.equal((authorityInterface.match(/^\s{2}\w+\(/gmu) ?? []).length, 1, 'the authority exposes exactly one member: it can answer, never mint');
  assert.equal((storeCode.match(/mapActionAuthority = deps\.mapActionAuthority/gu) ?? []).length, 1);
  assert.equal((storeCode.match(/temporalActionAuthority = deps\.temporalActionAuthority/gu) ?? []).length, 1);
  assert.equal((storeCode.match(/returnActionAuthority = deps\.returnActionAuthority/gu) ?? []).length, 1);

  // The minting side is module-local, and the granted action never leaves the module that built it.
  const authority = code['authority.ts'];
  assert.match(authority, /const authorized = new WeakSet<ReturnAction>\(\);/u);
  assert.match(authority, /^function buildAction\(plan: ReturnPlan\): ReturnAction \{/mu, 'the action constructor is a module-local function declaration');
  assert.doesNotMatch(authority, /export (?:function|const) buildAction\b/u);
  assert.equal((authority.match(/authorized\.add\(/gu) ?? []).length, 1, 'exactly one place adds an authorization');
  assert.match(authority, /authorized\.delete\(action\);/u, 'the authorization is consumed on use, so a granted act cannot be replayed');
  assert.equal((layerText.match(/buildAction\(/gu) ?? []).length, 2, 'declared once, called once, and nowhere else');
  for (const [name, text] of Object.entries(code)) {
    if (name === 'authority.ts') continue;
    assert.equal(text.includes('buildAction'), false, `${name} must not construct a return action`);
  }
  assert.equal((layerText.match(/store\.dispatchReturn\(/gu) ?? []).length, 1, 'exactly one place reaches the canonical return seam');
  for (const [name, text] of Object.entries(code)) {
    if (name === 'authority.ts') continue;
    assert.equal(/\bauthorized\b/u.test(text), false, `${name} must not reference the authorization set`);
  }
  // Only the verifier crosses the barrel; the mint stays inside the layer.
  assert.match(code['index.ts'], /export \{ RETURN_ACTION_AUTHORITY \} from '\.\/authority';/u);
  assert.equal(code['index.ts'].includes('runReturnPlan'), false, 'minting is not a public capability');
  for (const forbidden of ['authorized: true', 'as ReturnActionAuthority', 'unique symbol']) {
    assert.equal(authority.includes(forbidden), false, `the authority must not rest on ${forbidden}`);
  }
  // Neither neighbouring seam appears in this layer at all.
  assert.equal((layerText.match(/store\.dispatchMap\(/gu) ?? []).length, 0);
  assert.equal((layerText.match(/store\.dispatchTemporal\(/gu) ?? []).length, 0);
  assert.equal((layerText.match(/store\.dispatch\(/gu) ?? []).length, 0);
  assert.equal((layerText.match(/store\.ingest\(/gu) ?? []).length, 0);
});

// §30.7, §30.8 — the RH-consumption transaction is a SEPARATE path, and no transition writes history.
test('Back and Exact Return use the RH-consumption path, and nothing else may reduce RH', () => {
  assert.match(storeCode, /return entry\.transactional === 'CONSUMES_RH' \? runConsumptionTransaction\(action, entry\) : runTransaction\(action, entry\);/u);
  assert.equal((storeCode.match(/runConsumptionTransaction\(/gu) ?? []).length, 2, 'declared once, reached from exactly one place');
  assert.equal((storeCode.match(/appendIfEffective\(/gu) ?? []).length, 1, 'the append happens in exactly one place');

  const consumption = storeCode.slice(storeCode.indexOf('function runConsumptionTransaction'), storeCode.indexOf('function admitIdentity'));
  assert.ok(consumption.length > 0, 'the consumption transaction exists');
  assert.equal(consumption.includes('appendIfEffective'), false, 'a restoration never appends');
  assert.equal(consumption.includes('captureCheckpoint'), false, 'a restoration never captures a checkpoint');
  // The target is located by IDENTITY in this store's own history, before any state is produced.
  assert.match(consumption, /const index = before\.history\.findIndex\(\(candidate\) => candidate === target\);/u);
  assert.match(consumption, /if \(index < 0\) \{\s*\n\s*throw new PreconditionFailed\(/u);
  assert.match(consumption, /if \(entry\.id === 'BACK_ONE_STEP' && index !== before\.history\.length - 1\) \{/u);
  // Everything the append path proves is proved here too.
  assert.match(consumption, /admit\(before, restored, entry\.id\);/u);
  assert.match(consumption, /assertAuthorizedClassAWrites\(before, restored, entry\.authority, entry\.id\);/u);
  assert.match(consumption, /history: before\.history\.slice\(0, index\)/u);
  assert.equal((consumption.match(/publish\(/gu) ?? []).length, 1, 'one atomic publish; no partially applied restore');
  assert.match(consumption, /return \{ outcome: 'APPLIED', entry: null \};/u, 'a consumption appends no entry');

  // No transition can reach `history` at all: the writable type excludes it.
  assert.match(transitionsCode, /export type ClientWritable = Pick<CanonicalState, 'temporal' \| 'inspection' \| 'camera'>;/u);
  assert.equal(/(^|[^A-Za-z_.])history\b/u.test(transitionsCode), false, 'no transition mentions history');
  // Only the store writes RH, and the two consuming identities are named by the registry, not here.
  assert.equal(historyCode.includes('slice('), false, 'the append boundary never unwinds');
  assert.equal(layerText.includes('.history ='), false, 'the return layer never mutates the history array');
  assert.equal(layerText.includes('history.push'), false);
  assert.equal(layerText.includes('history.splice'), false);
});

// §30.12, §30.13 — every restoration is PINNED(capturedTC); provenance is never read.
test('every history restoration normalizes to PINNED(capturedTC) and never reattaches Live', () => {
  const restore = transitionsCode.slice(transitionsCode.indexOf('function restoreCheckpoint'), transitionsCode.indexOf('export const RETURN_ACTION_TRANSITIONS'));
  assert.ok(restore.length > 0, 'the shared restoration rule exists');
  assert.match(restore, /return \{ temporal: \{ kind: 'PINNED', at: captured\.tc \}, inspection: captured\.ifRef, camera: captured\.camera \};/u);
  assert.equal(restore.includes('tmProvenance'), false, 'the restoration never reads the provenance');
  assert.equal(restore.includes('FOLLOW_LIVE'), false, 'a restoration can never establish FOLLOW_LIVE');
  assert.equal((restore.match(/kind: 'PINNED'/gu) ?? []).length, 1, 'the rule is stated exactly once');
  // Both consuming transitions delegate to that one rule, and neither has its own.
  assert.match(transitionsCode, /const backOneStep: ActionTransition<[\s\S]*?> = \(state, action\) =>\s*\n\s*restoreCheckpoint\('BACK_ONE_STEP', state, action\.target\);/u);
  assert.match(transitionsCode, /const exactReturn: ActionTransition<[\s\S]*?> = \(state, action\) =>\s*\n\s*restoreCheckpoint\('EXACT_RETURN', state, action\.target\);/u);
  // Nothing anywhere in the layer reads the provenance either.
  assert.equal(layerText.includes('tmProvenance'), false, 'the return layer never reads the provenance');
  // Only the two Live identities may establish FOLLOW_LIVE, and each does it once.
  const returnSection = transitionsCode.slice(transitionsCode.indexOf('const returnLiveHead'), transitionsCode.indexOf('export const RETURN_ACTION_TRANSITIONS'));
  assert.equal((returnSection.match(/temporal: \{ kind: 'FOLLOW_LIVE' \}/gu) ?? []).length, 2, 'exactly Return to Live Head and P5 establish FOLLOW_LIVE');
});

// §30.14, §30.15, §30.16 — per-act write sets, proven on the transitions themselves.
test('each return transition writes exactly what its frozen identity permits', () => {
  const section = (start, end) => transitionsCode.slice(transitionsCode.indexOf(start), transitionsCode.indexOf(end));

  const liveHead = section('const returnLiveHead', 'const returnLiveFocus');
  assert.match(liveHead, /inspection: state\.inspection, camera: state\.camera/u, 'Return to Live Head writes neither camera nor inspection');
  for (const forbidden of ['locatedCamera', 'action.to', 'captured']) assert.equal(liveHead.includes(forbidden), false, `Return to Live Head must not use ${forbidden}`);

  const liveFocus = section('const returnLiveFocus', 'const goLiveAndLocate');
  assert.match(liveFocus, /return \{ temporal: state\.temporal, inspection: state\.inspection, camera: locatedCamera\(state, action\.to\) \};/u);
  assert.equal(liveFocus.includes('FOLLOW_LIVE'), false, 'Return to Live Focus never writes the temporal mode');
  assert.equal(liveFocus.includes('depth'), false, 'Return to Live Focus never writes the semantic depth');

  const world = section('const returnWorld', '/**');
  assert.match(world, /return \{ temporal: state\.temporal, inspection: state\.inspection, camera: action\.to \};/u);
  assert.equal(world.includes('FOLLOW_LIVE'), false, 'Return to World never writes the temporal mode');

  // The World target is the existing canonical helper, called once, never composed locally.
  assert.match(code['return-world.ts'], /initialCameraIntent\(\)/u);
  assert.equal((code['return-world.ts'].match(/initialCameraIntent\(/gu) ?? []).length, 1);
  for (const forbidden of ['WORLD_ORIGIN', 'DEFAULT_MAP_SCALE', 'worldAnchorRef', 'scaleIntentRef', 'fit', 'bounds', 'center']) {
    assert.equal(code['return-world.ts'].includes(forbidden), false, `Return to World must not compose ${forbidden} itself`);
  }
});

// §30.9, §30.10, §30.21, §38 — no new canonical state, no third mode, no persistent return state.
test('no persistent return, settle or focus-target state exists anywhere', () => {
  assert.match(classesCode, /export const CANONICAL_STATE_KEYS = Object\.freeze\(\['session', 'live', 'temporal', 'inspection', 'camera', 'history'\] as const\);/u);
  assert.match(classesCode, /export type TemporalMode = \{ readonly kind: 'FOLLOW_LIVE' \} \| \{ readonly kind: 'PINNED'; readonly at: SessionPosition \};/u);
  assert.match(classesCode, /const issue = exactShapeIssue\(value, path, \['tmProvenance', 'tc', 'ifRef', 'camera'\]\);/u, 'the checkpoint payload is exactly the four frozen keys');
  assert.match(classesCode, /const issue = exactShapeIssue\(value, path, \['act', 'captured'\]\);/u);

  for (const forbidden of ['RETURNING', 'SETTLING', 'RETURN_TARGET', 'ORIGINAL_INSPECTION', 'BACK_CURSOR', 'P5_LF', 'RETURN_EPOCH', 'RETURN_STACK', 'PTC', 'IF_render']) {
    for (const [name, text] of [['classes.ts', classesCode], ['store.ts', storeCode], ['transitions.ts', transitionsCode], ['history.ts', historyCode]]) {
      assert.equal(text.includes(forbidden), false, `${name} must not encode ${forbidden}`);
    }
    assert.equal(layerText.includes(forbidden), false, `the return layer must not hold ${forbidden}`);
  }
  // The bound referent is a local constant, never a module-level or exported one.
  assert.doesNotMatch(layerText, /^(?:export )?(?:const|let|var) (?:bound|captured|lastFocus|returnTarget)\b/mu);
  // The only persistent structure the layer holds is the two provenance registries, and neither is
  // a canonical field: one authorizes an action once, the other identifies a recorded checkpoint.
  const weak = [...layerText.matchAll(/new (?:WeakSet|WeakMap|Set|Map)</gu)].map((m) => m[0]);
  assert.deepEqual(weak, ['new WeakSet<', 'new WeakMap<']);
});

// §30.11 — Exact Return targets a present checkpoint by provenance, never a caller-built payload.
test('no arbitrary checkpoint payload is accepted as Exact Return public authority', () => {
  const restoration = code['history-restoration.ts'];
  assert.match(restoration, /export interface ReturnCheckpointTarget \{\s*\n\s*readonly index: number;\s*\n\}/u, 'the public handle discloses an ordinal and nothing else');
  assert.match(restoration, /const minted = new WeakMap<ReturnCheckpointTarget, TargetProvenance>\(\);/u);
  assert.match(restoration, /if \(provenance === undefined \|\| provenance\.store !== store\)/u, 'a handle from another store is refused');
  assert.match(restoration, /if \(!store\.getState\(\)\.history\.includes\(provenance\.entry\)\)/u, 'a consumed or stale target is refused');
  assert.match(restoration, /export function exactReturn\(surface: ReturnSurface, target: ReturnCheckpointTarget\): ReturnOutcome \{/u);
  // The public signature cannot take a checkpoint payload at all.
  assert.equal(restoration.includes('RhCheckpoint'), false, 'no public API accepts a checkpoint payload');
  assert.equal(layerText.includes('RhCheckpoint'), false);
  // Back derives its own target from the store's current history; no caller can influence it.
  assert.match(restoration, /return runReturnPlan\(store, \{ act: 'BACK_ONE_STEP', target: history\[history\.length - 1\] \}\);/u);
  assert.match(restoration, /export function backOneStep\(surface: ReturnSurface\): ReturnOutcome \{/u, 'Back takes no target from a caller');
  assert.match(restoration, /if \(history\.length === 0\) return returnNoOp\('EMPTY_HISTORY', 'NOT_ATTEMPTED'\);/u);
});

// §14 — Preview precedence, for every committed act, through T-06's own seam.
test('every committed return act cancels Preview first, and nothing resolves from PTC', () => {
  const surface = code['surface.ts'];
  assert.match(surface, /export function committedReturn\(surface: ReturnSurface, run: \(store: CanonicalStore\) => ReturnOutcome\): ReturnOutcome \{\s*\n\s*surface\.preview\.cancel\(\);\s*\n\s*return run\(surface\.store\);\s*\n\}/u);
  assert.equal((layerText.match(/preview\.cancel\(\)/gu) ?? []).length, 1, 'the T-06 cancellation seam is consumed in exactly one place');
  assert.equal((layerText.match(/committedReturn\(/gu) ?? []).length, 7, 'the gate is defined once and used by exactly the six public acts');
  // Nothing in the layer can read ephemeral preview intent at all.
  for (const forbidden of ['getSnapshot', 'ptc', 'PTC', 'ActiveTemporalPreview', 'previewProjection', 'stepForward', 'reconcile', 'isCurrent']) {
    assert.equal(layerText.includes(forbidden), false, `the return layer must not read ${forbidden}`);
  }
  // T-07 owns no preview state and builds no second controller.
  assert.equal(layerText.includes('createTemporalPreviewController'), false);
});

// §17, §18, §30.18, §30.19, §30.25 — entitlement stays T-04's, and no result reveals geography.
test('spatial entitlement is T-04 substrate, judged by the ONE freshness rule, and nothing leaks', () => {
  const authority = code['authority.ts'];
  assert.match(authority, /const current = mapContextFreshness\(postActState\(store\.getState\(\), plan\), landing\.context\);/u);
  assert.match(authority, /function postActState\(state: CanonicalState, plan: ReturnPlan\): CanonicalState \{/u);
  assert.equal((layerText.match(/mapContextFreshness\(/gu) ?? []).length, 1, 'the shared rule is consulted in exactly one place');
  assert.equal((layerText.match(/mapProjectionRequest\(/gu) ?? []).length, 1, 'the projection request is derived once, for the post-live viewpoint');
  for (const [name, text] of Object.entries(code)) {
    assert.doesNotMatch(text, /scene\.depth !== \w+\.depth|scene\.tc !== \w+\.tc/u, `${name} must not re-implement the freshness comparison`);
  }
  // Locatability is asked of the existing resolver; no second algorithm and no second cache exists.
  assert.match(code['focus-target.ts'], /const resolved = resolveLocateAtTarget\(context, \{ family: target\.family, id: target\.id \}\);/u);
  assert.equal((layerText.match(/resolveLocateAtTarget\(/gu) ?? []).length, 1);
  for (const forbidden of ['resolveLocatability', 'entitledLoci', 'resolveEntitledInspection', 'deriveMapScene', 'HistoricalDisclosureCache', 'HistoricalProjectionApiClient', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'supabase', 'axios', 'AsyncStorage', 'SecureStore', 'MMKV', 'SQLite', 'localStorage', 'persist(', 'process.env', 'EXPO_PUBLIC_']) {
    assert.equal(layerText.includes(forbidden), false, `the return layer must not contain ${forbidden}`);
  }
  assert.equal((layerText.match(/mapInspectionContext\(/gu) ?? []).length, 1, 'the held disclosure is read through the existing context builder, once');
  // A technical projection answer is never a semantic one.
  const focus = code['focus-target.ts'];
  const technical = focus.slice(focus.indexOf('export function returnMapContext'));
  assert.equal(technical.includes('NOT_LOCATABLE'), false, 'an unavailable projection is never reported as unlocatable');

  // Nothing a historical surface could read names a target, a place, a direction or a count.
  const availability = code['availability.ts'];
  for (const forbidden of ['threadId', 'emergingFocusId', 'anchor', 'destination', 'locus', 'coordinate', 'direction', 'distance', 'label', 'displayName', 'title', 'home', 'Home']) {
    assert.equal(availability.includes(forbidden), false, `the availability model must not expose ${forbidden}`);
  }
  const outcomes = code['outcomes.ts'];
  for (const forbidden of ['threadId', 'emergingFocusId', 'label', 'displayName', 'anchor:', 'destination:', 'locus:']) {
    assert.equal(outcomes.includes(forbidden), false, `a return outcome must not carry ${forbidden}`);
  }
});

// §24, §25, §26, §27 — the layer is pure TypeScript: no component, no geometry, no motion.
test('T-07 introduces no component, no hook, no geometry and no motion', () => {
  const files = listFiles(join(rootPath, RN_DIR)).map((file) => file.slice(join(rootPath, RN_DIR).length + 1).replace(/\\/g, '/'));
  assert.deepEqual(files.filter((file) => file.endsWith('.tsx')), [], 'no React component or hook exists in the layer');
  for (const forbidden of ['react', 'react-native', 'useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useSyncExternalStore', 'JSX', 'accessible', 'accessibilityRole', 'accessibilityLabel', 'StyleSheet', 'I18nManager', 'RTL']) {
    assert.equal(layerText.includes(forbidden), false, `the return layer must not reference ${forbidden}`);
  }
  for (const forbidden of ['withTiming', 'withSpring', 'useSharedValue', 'useAnimatedStyle', 'Animated', 'reanimated', 'requestAnimationFrame', 'setTimeout', 'setInterval', 'duration', 'easing', 'Easing', 'useReducedMotion', 'REDUCED_MOTION_PREFERENCE']) {
    assert.equal(layerText.includes(forbidden), false, `the return layer must not own motion (${forbidden})`);
  }
  // No physical geometry at all, so RTL parity is a non-question at the geometry level.
  for (const forbidden of ['translateX', 'left:', 'right:', 'start:', 'end:', 'pixel', 'offset', 'viewport', 'width', 'height']) {
    assert.equal(layerText.includes(forbidden), false, `the return layer must not hold geometry (${forbidden})`);
  }
  // Every act is reachable as a plain function: no drag, no pointer, no coordinate.
  for (const forbidden of ['Gesture', 'onPress', 'pointer', 'drag', 'touch', 'clientX', 'locationX']) {
    assert.equal(layerText.includes(forbidden), false, `the return layer must not require ${forbidden}`);
  }
});

// §30.20, §30.21, §30.22, §38 — anti-scope.
test('no T-05 presentation mutation, no T-08 chrome, no T-10 motion ownership, no anti-scope feature', () => {
  for (const forbidden of ['../timeline', 'DisclosedTrack', 'PresentationSnapshot', 'controller.move', 'controller.page', 'setViewport', 'replaceDisclosed', 'TimelinePresentation', 'PresentationNavigator']) {
    assert.equal(layerText.includes(forbidden), false, `the return layer must not reach T-05 presentation (${forbidden})`);
  }
  for (const forbidden of ['bookmark', 'Bookmark', 'Replay', 'replay', 'coarseStep', 'versionJump', 'acknowledgement', 'crossSession', 'recompose', 'responsive', 'colour', 'color', 'icon', 'typography']) {
    assert.equal(layerText.includes(forbidden), false, `the return layer must not implement ${forbidden}`);
  }
});

// §30.23 — no dependency change at all.
test('the return layer adds no dependency: every import is a relative module of this app', async () => {
  const specifiers = new Set();
  for (const text of Object.values(code)) {
    for (const match of text.matchAll(/from\s+'([^']+)'/gu)) if (!match[1].startsWith('.')) specifiers.add(match[1]);
    assert.doesNotMatch(text, /require\(/u);
  }
  assert.deepEqual([...specifiers], [], 'the return layer imports nothing outside this app');

  const mobilePackage = await readJson('apps/mobile/package.json');
  assert.deepEqual(Object.keys(mobilePackage.dependencies).sort(), [
    '@shopify/react-native-skia',
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
  for (const name of ['zustand', 'redux', '@reduxjs/toolkit', 'react-redux', 'immer', 'xstate', 'jotai', 'mobx', 'valtio', 'recoil', 'react-native-mmkv', '@react-native-async-storage/async-storage', 'expo-secure-store', 'expo-sqlite', 'history', 'react-router', 'moment', 'dayjs', 'date-fns', 'luxon']) {
    const copies = Object.keys(lock.packages).filter((key) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`));
    assert.deepEqual(copies, [], `${name} must not be installed`);
  }
  assert.equal(existsSync(new URL('apps/mobile/package-lock.json', root)), false);
});

// §30.24 — every source file stays real, diffable text.
test('every T-07 source file is real text: no control byte can make git treat it as binary', () => {
  for (const [name, text] of Object.entries(sources)) {
    const control = [...text].findIndex((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point < 0x20 && character !== '\n' && character !== '\t';
    });
    assert.equal(control, -1, `${name} contains a control character at index ${control}`);
    assert.doesNotMatch(text, /(?:ANTHROPIC|OPENAI|GOOGLE_AI|SUPABASE_SERVICE_ROLE)_(?:API_)?KEY|SUPABASE_PUBLISHABLE_KEY|EXPO_PUBLIC_|sk-ant-/u, `${name} references a credential`);
    assert.doesNotMatch(text, /withDangerousMod/u, `${name} uses a Level-4 dangerous mod`);
  }
});

// §30.26 — the promotion is reflected everywhere, with no stale later-owner assumption left.
test('no source-level later-owner assumption survives for the six promoted identities', async () => {
  assert.match(stateIndexCode, /RETURN_ACTION_TYPES,/u);
  assert.match(stateIndexCode, /ReturnActionAuthority,/u);
  assert.match(stateIndexCode, /RETURN_ACTION_TRANSITIONS,/u);
  assert.match(stateIndexCode, /UnauthorizedReturnAction,/u);
  // The one remaining `OwnedByLaterTask` use is the general rule over the LEVEL, in the store.
  const mobileDir = join(rootPath, 'apps/mobile/src');
  for (const file of listFiles(mobileDir).filter((f) => /\.tsx?$/u.test(f))) {
    const relative = file.slice(mobileDir.length + 1).replace(/\\/g, '/');
    const text = stripComments(await read(`apps/mobile/src/${relative}`));
    if (relative.includes('__tests__')) continue;
    for (const id of SIX) {
      assert.doesNotMatch(text, new RegExp(`OwnedByLaterTask\\([^)]*${id}`, 'u'), `${relative} must not treat ${id} as later-owner`);
    }
  }
});

test('the T-07 gate is registered at the root and in Mobile CI without a new native job', async () => {
  const rootPackage = await readJson('package.json');
  assert.equal(rootPackage.scripts['test:return-navigation-layer-contract'], 'node --test tests/return-navigation-layer-contract.test.mjs');
  const mobileCi = await read('.github/workflows/mobile-ci.yml');
  assert.match(mobileCi, /run: npm run test:return-navigation-layer-contract/u);
  assert.match(mobileCi, /'tests\/return-navigation-layer-contract\.test\.mjs'/u);
  // The native set is unchanged: exactly the fast gate plus Android and iOS, both still gated.
  assert.equal((mobileCi.match(/runs-on: /gu) ?? []).length, 3, 'no job beyond the fast gate and the two native jobs');
  assert.equal((mobileCi.match(/runs-on: macos-26/gu) ?? []).length, 1);
  assert.equal((mobileCi.match(/if: needs\.verify-mobile-contracts\.outputs\.native_impact == 'true'/gu) ?? []).length, 2);
  assert.equal(existsSync(new URL('docs/return-navigation-layer-v1.md', root)), true);
  assert.match(await read('apps/mobile/README.md'), /Return navigation layer \(T-07\)/u);
  // Nothing is mounted: the T-01 technical shell is untouched by this task.
  for (const file of ['apps/mobile/src/app/_layout.tsx', 'apps/mobile/src/app/index.tsx', 'apps/mobile/src/shell/FoundationShell.tsx']) {
    assert.doesNotMatch(await read(file), /return-navigation|returnLiveHead|backOneStep/u, `${file} must not mount the return layer in T-07`);
  }
  const appConfig = await readJson('apps/mobile/app.json');
  assert.deepEqual(appConfig.expo.plugins, ['expo-router']);
  assert.equal(existsSync(new URL('apps/mobile/ios', root)), false);
  assert.equal(existsSync(new URL('apps/mobile/android', root)), false);
});
