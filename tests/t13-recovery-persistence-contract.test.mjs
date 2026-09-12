import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// T-13 — Recovery / Persistence v1. Static executable contract.
//
// > **Persist the user's durable viewpoint and active Session locator. Re-fetch server-authoritative
// > truth before Product READY. Reconstruct derived state deterministically. Reset ephemeral state.
// > Never present stale local state as current truth.**
//
// The Jest suites under `apps/mobile/src/recovery/__tests__` and the two T-13 suites under
// `apps/mobile/src/integration/__tests__` prove the BEHAVIOUR: the strict codec, the migration runner,
// the namespaced serialized store, the writer, the fresh and resumed paths, the readiness gate, the
// fail-closed refusals, identity isolation, `FOLLOW_LIVE` / `PINNED(t)` recovery, no-hindsight, the
// restored `IF_ref` / `MC` / `RH`, the Exact Return reset and the foreground cursor reset. This gate
// guards what a passing unit test cannot: that the boundary is separate from auth BY CONSTRUCTION,
// that the persisted allowlist is exact and the forbidden classes have no key, that the integration
// owner sequences recovery before READY through the existing seam and holds no mechanism of its own,
// and that the ONE store is still constructed by the bootstrap from fresh server truth.
//
// ## Forward safety
//
// Nothing here is a ceiling on the repository: no whole-repo file count, no whole-file hash of a
// shared workflow or manifest, no dependency census beyond the frozen `expo-sqlite` pin the mobile
// foundation already carries. Every claim is a PERMANENT INVARIANT of the recovery boundary or a
// statement about files T-13 itself owns.
//
// ## Non-vacuity
//
// Every absence predicate is paired with a planted defect: the predicate is run against a mutated copy
// of the real source and required to REJECT it. A guard that cannot fail is not a guard.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));

const MOBILE_SRC = 'apps/mobile/src';
const RECOVERY_DIR = `${MOBILE_SRC}/recovery`;
const INTEGRATION_DIR = `${MOBILE_SRC}/integration`;
const ENTRY_DIR = `${MOBILE_SRC}/runtime-entry`;
const AUTH_STORAGE = `${ENTRY_DIR}/auth/auth-session-storage.ts`;
const RECOVERY_STORAGE = `${RECOVERY_DIR}/store/product-recovery-store.ts`;
const BOOTSTRAP = `${ENTRY_DIR}/bootstrap/canonical-runtime-bootstrap.ts`;
const INTEGRATION_RUNTIME = `${INTEGRATION_DIR}/runtime/integration-runtime.ts`;

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

const isScaffolding = (file) => /(?:^|\/)__(?:tests|fixtures|validation)__\//u.test(file.replace(/\\/gu, '/'));

/** Production files of one layer, repository-relative to the layer. */
function production(dir) {
  const absolute = join(rootPath, dir);
  return listFiles(absolute)
    .map((file) => file.slice(absolute.length + 1).replace(/\\/gu, '/'))
    .filter((file) => !isScaffolding(`/${file}`))
    .sort();
}

/** Every production TypeScript module of the mobile app, repository-relative. */
const mobileProduction = listFiles(join(rootPath, MOBILE_SRC))
  .map((file) => file.slice(rootPath.length).replace(/\\/gu, '/'))
  .filter((file) => /\.tsx?$/u.test(file) && !isScaffolding(file))
  .sort();

const recoveryFiles = production(RECOVERY_DIR);
const recoveryCode = Object.fromEntries(recoveryFiles.map((name) => [name, stripComments(read(`${RECOVERY_DIR}/${name}`))]));
const recoveryText = Object.values(recoveryCode).join('\n');

const integrationFiles = production(INTEGRATION_DIR);
const integrationCode = Object.fromEntries(integrationFiles.map((name) => [name, stripComments(read(`${INTEGRATION_DIR}/${name}`))]));
const integrationText = Object.values(integrationCode).join('\n');

const bootstrap = stripComments(read(BOOTSTRAP));
const runtime = integrationCode['runtime/integration-runtime.ts'];
const record = recoveryCode['schema/recovery-record.ts'];
const migrations = recoveryCode['schema/recovery-migrations.ts'];
const store = recoveryCode['store/product-recovery-store.ts'];
const writer = recoveryCode['writer/recovery-writer.ts'];
const decision = recoveryCode['decision/recovery-decision.ts'];
const authStorage = stripComments(read(AUTH_STORAGE));

/** `predicate(corpus)` must be true, and `predicate(corpus + defect)` must be false. */
function guards(name, corpus, predicate, defect) {
  assert.equal(predicate(corpus), true, `${name}: the real source must satisfy the invariant`);
  assert.equal(predicate(`${corpus}\n${defect}\n`), false, `${name}: the guard does not reject its own planted defect`);
}

// ---------------------------------------------------------------------------------------------
// §2 — a separate Product recovery persistence boundary
// ---------------------------------------------------------------------------------------------

test('§2 — the T-13 owner is exactly its authorized production surface, with one barrel and no component', () => {
  assert.deepEqual(recoveryFiles, [
    'decision/recovery-decision.ts',
    'index.ts',
    'schema/index.ts',
    'schema/recovery-migrations.ts',
    'schema/recovery-record.ts',
    'store/product-recovery-store.ts',
    'writer/recovery-writer.ts',
  ]);
  assert.deepEqual(recoveryFiles.filter((file) => file.endsWith('.tsx')), [], 'the boundary has no component and no view');
  assert.doesNotMatch(recoveryCode['index.ts'], /export \* from/u, 'the public surface is an allowlist, never a wildcard');
  const suites = readdirSync(join(rootPath, RECOVERY_DIR, '__tests__')).filter((file) => /\.test\.tsx?$/u.test(file));
  for (const suite of ['record-codec.test.ts', 'migrations.test.ts', 'store.test.ts', 'writer.test.ts']) {
    assert.ok(suites.includes(suite), `the focused suite ${suite} must exist`);
  }
});

test('§2 — Product recovery and auth persistence are two stores, two files, and two vocabularies', () => {
  // Exactly two production modules in the whole app may name the storage mechanism: the auth store
  // (T-12P) and the Product recovery store (T-13). A third would be a third persistence boundary.
  const storageUsers = mobileProduction.filter((file) => /expo-sqlite|SQLiteStorage/u.test(stripComments(read(file))));
  assert.deepEqual(storageUsers, [`${INTEGRATION_DIR}`.replace(INTEGRATION_DIR, RECOVERY_STORAGE), AUTH_STORAGE].sort(), 'exactly the two storage modules');

  // Two database files, pinned, and different.
  assert.match(authStorage, /export const AUTH_SESSION_DATABASE_NAME = 'qandeel-auth-session\.db';/u);
  assert.match(store, /export const PRODUCT_RECOVERY_DATABASE_NAME = 'qandeel-product-recovery\.db';/u);

  // No auth material in the Product store, in any spelling.
  const AUTH_MATERIAL = /accessToken|access_token|refresh_token|refreshToken|Bearer|supabase|createClient|password|apikey|signIn|expires/iu;
  assert.doesNotMatch(recoveryText, AUTH_MATERIAL, 'the Product recovery boundary names no credential');
  // No Product truth in the auth store (extends the T-12P guard with T-13's own vocabulary).
  const PRODUCT_TRUTH = /CanonicalState|RhEntry|sessionId|camera|inspection|viewpoint|temporal|recovery|checkpoint/u;
  assert.doesNotMatch(authStorage, PRODUCT_TRUTH, 'the auth store holds authentication material only');

  guards('no auth material in the Product store', recoveryText, (text) => !AUTH_MATERIAL.test(text), 'const bearer = state.accessToken;');
  guards('no Product truth in the auth store', authStorage, (text) => !PRODUCT_TRUTH.test(text), "store.setItemAsync('sessionId', id);");
});

test('§2 — the boundary reaches only the kernel, the Map’s encodings and the one storage mechanism', () => {
  const specifiers = new Set();
  for (const text of Object.values(recoveryCode)) {
    for (const match of text.matchAll(/from\s+'([^']+)'/gu)) if (!match[1].startsWith('.')) specifiers.add(match[1]);
    assert.doesNotMatch(text, /require\(/u);
    for (const match of text.matchAll(/from\s+'(\.\.\/\.\.\/[^']+)'/gu)) {
      assert.ok(['../../map', '../../state'].includes(match[1]), `the boundary may reach the Map and the kernel only, through their barrels, got ${match[1]}`);
    }
  }
  assert.deepEqual([...specifiers].sort(), ['expo-sqlite/kv-store'], 'the one external import is the existing storage mechanism; no persistence library was introduced');
  // It never reaches the runtime entry, the integration owner or a Product surface, and nothing
  // outside it deep-imports it.
  assert.doesNotMatch(recoveryText, /runtime-entry|\/integration|orientation-chrome|return-navigation|temporal-navigation|timeline|responsive|motion/u);
  for (const file of mobileProduction) {
    if (file.startsWith(`${RECOVERY_DIR}/`)) continue;
    assert.doesNotMatch(stripComments(read(file)), /from\s+'[^']*\/recovery\/[^']+'/u, `${file} must reach T-13 only through its barrel`);
  }
  // The frozen `expo-sqlite` pin the foundation carries is the mechanism, unchanged.
  assert.equal(readJson('apps/mobile/package.json').dependencies['expo-sqlite'], '~57.0.2');
});

// ---------------------------------------------------------------------------------------------
// §3 / §13 / §14 — the persisted allowlist, the forbidden classes, the strict codec
// ---------------------------------------------------------------------------------------------

test('§3.1 / §3.5 — the persisted allowlist is exact, and it is read by name from the four client-owned fields', () => {
  assert.match(record, /export const PRODUCT_RECOVERY_SCHEMA_VERSION = 1 as const;/u);
  assert.match(record, /export const RECOVERY_RECORD_KEYS = Object\.freeze\(\['schemaVersion', 'ownerUserId', 'sessionId', 'viewpoint', 'sequence'\] as const\);/u);
  assert.match(record, /export const RECOVERED_VIEWPOINT_KEYS = Object\.freeze\(\['temporal', 'inspection', 'camera', 'history'\] as const\);/u);
  assert.match(record, /return \{ temporal: state\.temporal, inspection: state\.inspection, camera: state\.camera, history: state\.history \};/u, 'the subset is read by name');
  // Never spread, never serialized wholesale: a future canonical key cannot be persisted by accident.
  assert.doesNotMatch(record, /\.\.\.state\b|\.\.\.record\b|JSON\.stringify\(state\)|JSON\.stringify\(record\)/u);

  // The forbidden classes have no spelling anywhere in the boundary's code.
  const FORBIDDEN = /state\.live\b|\bLH\b|\bLF\b|liveHead|liveFocus|effectiveTC|\bPTC\b|preview|cursor|Disclosure|MapScene|projection|ExactReturnOrigin|bindExactReturnOrigin|journey|Animated|reanimated|viewport|envelope/u;
  assert.doesNotMatch(recoveryText, FORBIDDEN, 'no server mirror, derived, presentation, runtime or origin state has a key');
  guards('forbidden classes', recoveryText, (text) => !FORBIDDEN.test(text), 'const LH = state.live.LH;');
});

test('§13 — decoding is the kernel’s own validators plus the Map’s decoder, exact at every level, and never repairs', () => {
  for (const validator of ['exactShapeIssue(raw, \'record\', RECOVERY_RECORD_KEYS)', 'temporalModeShapeIssue(', 'inspectionRefShapeIssue(', 'cameraIntentShapeIssue(', 'rhEntryShapeIssue(', 'decodeCameraIntent(']) {
    assert.ok(record.includes(validator), `the codec uses ${validator}`);
  }
  assert.match(record, /exactShapeIssue\(record\.viewpoint, 'record\.viewpoint', RECOVERED_VIEWPOINT_KEYS\)/u);
  assert.match(record, /const UUID_PATTERN = /u, 'the Session locator must be a server-minted UUID');
  // No silent repair of any kind: no clamp, no default for a semantic field, no partial acceptance.
  const REPAIR = /Math\.min\(|Math\.max\(|clamp|\?\? \{ kind: 'FOLLOW_LIVE' \}|\?\? initialCameraIntent|\?\? null|\?\? \[\]/u;
  assert.doesNotMatch(record, REPAIR, 'a corrupt field rejects the whole record');
  guards('no repair', record, (text) => !REPAIR.test(text), "const temporal = viewpoint.temporal ?? { kind: 'FOLLOW_LIVE' };");
});

test('§14 — one explicit schema version; older records migrate only through declared steps; newer are refused', () => {
  assert.match(migrations, /export const RECOVERY_MIGRATIONS: readonly RecoveryMigration\[\] = Object\.freeze\(\[\]\);/u, 'v1 ships no migration');
  assert.match(migrations, /reason: 'INCOMPATIBLE_SCHEMA'/u, 'a newer schema is refused');
  assert.match(migrations, /reason: 'NO_MIGRATION_PATH'/u, 'an undeclared older schema is refused');
  assert.match(migrations, /schemaVersionOf\(migrated\) !== step\.to/u, 'a step is held to the version it declared');
  // Deterministic: no clock, no randomness, no environment.
  assert.doesNotMatch(migrations, /Date\.now|Math\.random|process\.env|setTimeout/u);
  // The store runs the runner BEFORE the strict decoder, on every load.
  const load = store.slice(store.indexOf('load(ownerUserId) {'), store.indexOf('write(record, options = {}) {'));
  assert.ok(load.length > 0, 'the load implementation exists');
  assert.ok(load.indexOf('migrateRecoveryRecord(') > 0 && load.indexOf('migrateRecoveryRecord(') < load.indexOf('decodeProductRecoveryRecord('), 'migrate, then decode strictly');
});

// ---------------------------------------------------------------------------------------------
// §4 — identity
// ---------------------------------------------------------------------------------------------

test('§4 — every record is namespaced by the authenticated owner, and the owner is proven twice', () => {
  assert.match(store, /export function namespaceKeyFor\(ownerUserId: string\): string \{/u);
  assert.match(store, /if \(decoded\.record\.ownerUserId !== ownerUserId\)/u, 'the store refuses a record naming another owner');
  assert.match(decision, /if \(loaded\.record\.ownerUserId !== ownerUserId\)/u, 'the decision refuses it again, independently');
  // The owner comes from the AUTHENTICATED identity state, never from the record or a caller.
  assert.match(runtime, /bootstrapFor\(state\.authGeneration, state\.userId\)/u, 'the load is keyed by the authenticated identity');
  assert.match(runtime, /const loaded = await recovery\.load\(userId\);/u);
  assert.match(runtime, /ownerUserId: bundle\.userId,/u, 'the writer records the bundle’s own identity');
  // A signed-out runtime reaches no record: the load lives inside the authenticated bootstrap only.
  assert.equal((runtime.match(/recovery\.load\(/gu) ?? []).length, 1, 'exactly one load site, inside the authenticated bootstrap');
  assert.doesNotMatch(runtime, /recovery\.clear\(/u, 'no Product act deletes a record; sign-out retires the runtime and leaves the record inaccessible');
});

// ---------------------------------------------------------------------------------------------
// §5 / §6 / §15 — the integration owner sequences recovery before READY, through the existing seam
// ---------------------------------------------------------------------------------------------

test('§5 — a valid record resumes through the existing seam and never creates a replacement Session', () => {
  assert.match(runtime, /existingSessionId: decision\.record\.sessionId,/u, 'the seam carries the record’s own locator');
  assert.match(runtime, /initialViewpoint: decision\.record\.viewpoint,/u, 'and the record’s own viewpoint');
  // A REFUSED decision never reaches the bootstrap, so no fresh Session can be minted in its place.
  const refused = runtime.slice(runtime.indexOf("if (decision.kind === 'REFUSED') {"), runtime.indexOf("publish({ kind: 'BOOTSTRAPPING' });"));
  assert.ok(refused.length > 0, 'the refusal branch exists before the bootstrap');
  assert.match(refused, /publish\(\{ kind: 'RECOVERY_FAILED', failure: decision\.refusal \}\)/u);
  assert.match(refused, /return;/u);
  assert.equal(refused.includes('bootstrap'), false, 'a refused recovery bootstraps nothing');
  // A resumed Session the server refuses is a recovery failure, not a fresh bootstrap.
  assert.match(runtime, /if \(decision\.kind === 'RESUME'\) publish\(\{ kind: 'RECOVERY_FAILED', failure: \{ kind: 'SESSION_INVALID', failure: result\.failure \} \}\);/u);
  assert.doesNotMatch(runtime, /retry|fallback|createSession\(/u, 'no hidden fallback semantics');
});

test('§6 — READY is published exactly once, only after load, decide, and the bootstrap’s server reconciliation', () => {
  assert.equal((runtime.match(/publish\(\{ kind: 'READY'/gu) ?? []).length, 1, 'READY is published in exactly one place');
  const body = runtime.slice(runtime.indexOf('async function bootstrapFor('), runtime.indexOf('const unsubscribeAuth'));
  const at = (needle) => {
    const index = body.indexOf(needle);
    assert.ok(index >= 0, `bootstrapFor must contain ${needle}`);
    return index;
  };
  assert.ok(at("publish({ kind: 'RECOVERING' })") < at('await recovery.load(userId)'), 'the technical recovery state precedes the load');
  assert.ok(at('await recovery.load(userId)') < at('decideRecovery(userId, loaded)'), 'load, then decide');
  assert.ok(at('decideRecovery(userId, loaded)') < at('await bootstrapWithAuthorities(entry, decision)'), 'decide, then bootstrap');
  assert.ok(at('await bootstrapWithAuthorities(entry, decision)') < at("publish({ kind: 'READY'"), 'READY only after the bootstrap resolved');
  // The WORLD is rendered for exactly one phase, and it is READY.
  //
  // T-14 RE-ANCHOR, for the same reason as the T-10, T-11 and T-12 re-anchors before it. This used
  // to pin the exact line `if (phase.kind !== 'READY') return <RuntimeState phase={phase.kind} />;`
  // with the reason stated beside it: "no Product frame before READY". That was a DELIVERY FACT
  // about a Product that had no signed-out entry at all — T-12 §14 recorded the absent gateway as a
  // residual limitation, `QAN-BL-AUTH-01` registered it, and T-14 built it. Keeping the pin would
  // have frozen the shape of a `return` statement into a rule that a reader who is merely not signed
  // in must go on being shown an engineering status line, which is not a recovery claim and was
  // never this contract's to make.
  //
  // The PERMANENT claim survives and is what is asserted instead, and it is stronger than a line
  // match: the composed world exists in ONE place, it is reachable from ONE phase, and that phase is
  // READY — so no world, no Session, no viewpoint and nothing derived from a recovery record can be
  // on screen before the bootstrap has reconciled against server authority. What the signed-out
  // reader now meets instead is proven to compose no world here, and proven to read no Product
  // recovery at all by `S1-10` below.
  const productRoot = integrationCode['composition/ProductRoot.tsx'];
  assert.equal((productRoot.match(/<ComposedWorld\b/gu) ?? []).length, 1, 'the world is composed in exactly one place');
  const worldAt = productRoot.indexOf('<ComposedWorld');
  const readyAt = productRoot.lastIndexOf("if (phase.kind === 'READY')", worldAt);
  assert.ok(readyAt >= 0, 'the world is rendered inside a READY guard');
  assert.equal((productRoot.slice(readyAt, worldAt).match(/if \(phase\.kind/gu) ?? []).length, 1,
    'no other phase guard stands between READY and the world');
  // Every remaining phase still reaches the technical state view, in engineering vocabulary.
  assert.match(productRoot, /return <RuntimeState phase=\{phase\.kind\} \/>;/u, 'the other phases are technical');
  // And the signed-out entry is a surface of its own: it composes no world and holds no recovery.
  assert.equal((productRoot.match(/<SignedOutEntry\b/gu) ?? []).length, 1, 'one signed-out entry');
  const entryAt = productRoot.indexOf('<SignedOutEntry');
  const signedOutAt = productRoot.lastIndexOf("if (phase.kind === 'SIGNED_OUT')", entryAt);
  assert.ok(signedOutAt >= 0, 'the signed-out entry is rendered inside a SIGNED_OUT guard');
  assert.equal(productRoot.includes('recovery'), false, 'the Product root holds no recovery of its own');
});

test('§15 — the durable snapshot advances from the ONE store on effective acts, never on a passive delivery, and never blocks it', () => {
  assert.match(writer, /let last = recoveredViewpointOf\(store\.getState\(\)\);/u, 'the locator is written at attach');
  assert.match(writer, /if \(recoveredViewpointEquals\(last, next\)\) return;/u, 'an unchanged persisted subset issues nothing');
  assert.match(writer, /store\.subscribe\(/u, 'the writer observes the canonical store');
  assert.doesNotMatch(writer, /await recovery\.write|store\.dispatch|\.ingest\(/u, 'the writer never awaits inside the publish path and never writes canonical state');
  // Order and stale-overwrite protection are the store's: one chain, one monotonic sequence per owner.
  assert.match(store, /let tail: Promise<unknown> = Promise\.resolve\(\);/u, 'one serialized chain per store');
  assert.match(store, /if \(latest !== undefined && record\.sequence <= latest\) return \{ kind: 'SUPERSEDED'/u, 'an older sequence never overwrites');
  assert.match(store, /if \(options\.admit !== undefined && !options\.admit\(\)\) return \{ kind: 'SKIPPED' \};/u, 'admission is re-asked inside the chain');
  // Retired with the generation, like every other coordinator.
  assert.match(runtime, /session\.recovery\.writer\.retire\(\);/u);
  assert.match(runtime, /startSequence: decision\.kind === 'RESUME' \? decision\.record\.sequence : 0,/u, 'writes continue above the resumed sequence');
});

test('the integration owner holds no recovery mechanism: it loads, decides and writes through the barrel only', () => {
  assert.match(runtime, /const recovery: ProductRecoveryStore = createProductRecoveryStore\(options\.recoveryStorage\);/u);
  assert.doesNotMatch(integrationText, /createProductRecoveryStorage|SQLiteStorage|expo-sqlite|kv-store|JSON\.parse|JSON\.stringify/u, 'the integration layer never touches the mechanism');
  assert.doesNotMatch(integrationText, /decodeProductRecoveryRecord|encodeProductRecoveryRecord|namespaceKeyFor|RECOVERY_RECORD_KEYS|schemaVersion/u, 'nor the codec or the keys');
  assert.equal((integrationText.match(/createProductRecoveryStore\(/gu) ?? []).length, 1, 'exactly one Product recovery store per runtime');
});

// ---------------------------------------------------------------------------------------------
// §7 / §8 / §17 — the ONE store is constructed by the bootstrap from fresh server truth
// ---------------------------------------------------------------------------------------------

test('§17 — the bootstrap constructs the one store from the FRESH snapshot plus the validated viewpoint, after the snapshot', () => {
  const creators = mobileProduction.filter((file) => /createCanonicalStore\(/u.test(stripComments(read(file))) && !/state\/store\.ts$/u.test(file));
  assert.deepEqual(creators, [BOOTSTRAP], 'exactly one production call site creates the canonical store, and it is the bootstrap');
  // Fresh live truth is the snapshot's, never the record's; the four recovered fields replace the entry laws by name.
  assert.match(bootstrap, /live: liveTruthFromSnapshot\(snapshot\),/u);
  assert.match(bootstrap, /temporal: \{ kind: 'FOLLOW_LIVE' \}/u, 'the fresh entry law is unchanged');
  assert.match(bootstrap, /inspection: null,/u);
  assert.match(bootstrap, /camera: initialCameraIntent\(\),/u);
  assert.match(bootstrap, /live: init\.live,\s*\n\s*temporal: request\.initialViewpoint\.temporal,\s*\n\s*inspection: request\.initialViewpoint\.inspection,\s*\n\s*camera: request\.initialViewpoint\.camera,\s*\n\s*history: request\.initialViewpoint\.history,/u);
  assert.doesNotMatch(bootstrap, /live: request\.initialViewpoint|initialViewpoint\.live|initialViewpoint\.LH/u, 'a stored value never overrides server truth');
  // The snapshot is fetched BEFORE the viewpoint is touched, and the store is created LAST.
  assert.ok(bootstrap.indexOf('fetchSessionTemporalState(') < bootstrap.indexOf('request.initialViewpoint.temporal'), 'server authority first');
  assert.ok(bootstrap.indexOf('request.initialViewpoint.temporal') < bootstrap.indexOf('createCanonicalStore(init'), 'the store is created after reconciliation');
});

test('§8 / §11 — an impossible pinned time or checkpoint fails the whole attempt closed; nothing is clamped or repaired', () => {
  assert.match(bootstrap, /function viewpointCoherenceIssue\(viewpoint: InitialViewpoint, liveHead: number \| null\): string \| null \{/u);
  assert.match(bootstrap, /if \(viewpoint\.temporal\.at > liveHead\) return/u, 'PINNED(t) beyond the fresh Live Head is refused');
  assert.match(bootstrap, /if \(liveHead === null \|\| captured > liveHead\) \{/u, 'a checkpoint beyond the fresh Live Head is refused');
  assert.match(bootstrap, /return failed\(\{ kind: 'VIEWPOINT_INCOHERENT', detail: issue \}\);/u);
  const REPAIR = /Math\.min\(|Math\.max\(|clamp|\.filter\(\(entry\)|history\.slice\(/u;
  assert.doesNotMatch(bootstrap, REPAIR, 'the bootstrap never repairs a viewpoint');
  guards('no clamp in the bootstrap', bootstrap, (text) => !REPAIR.test(text), 'const at = Math.min(viewpoint.temporal.at, liveHead);');
  // The initial disclosure is requested at the viewpoint the reader will stand on: `t` when pinned.
  assert.match(bootstrap, /const initialTc = init\.temporal\.kind === 'PINNED' \? init\.temporal\.at : snapshot\.liveHead;/u);
});

test('§7 — `FOLLOW_LIVE` persists a mode and no position: the effective TC is derived by the kernel and has no storage slot', () => {
  const classes = stripComments(read(`${MOBILE_SRC}/state/classes.ts`));
  assert.match(classes, /export const CANONICAL_STATE_KEYS = Object\.freeze\(\['session', 'live', 'temporal', 'inspection', 'camera', 'history'\] as const\);/u);
  assert.match(classes, /export type TemporalMode = \{ readonly kind: 'FOLLOW_LIVE' \} \| \{ readonly kind: 'PINNED'; readonly at: SessionPosition \};/u);
  const selectors = stripComments(read(`${MOBILE_SRC}/state/selectors.ts`));
  assert.match(selectors, /return state\.temporal\.kind === 'FOLLOW_LIVE' \? state\.live\.LH : state\.temporal\.at;/u, 'the one accessor of effective TC');
  // T-13 adds no key to the kernel and no storage slot for the effective TC.
  assert.equal(recoveryText.includes('effectiveTC'), false);
});

// ---------------------------------------------------------------------------------------------
// §12 / §16 — what is intentionally reset
// ---------------------------------------------------------------------------------------------

test('§12 — the Exact Return origin is process-local and is never serialized', () => {
  assert.doesNotMatch(recoveryText, /ExactReturnOrigin|exactReturnTargetFor|bindExactReturnOrigin|origin/u, 'no origin has a key');
  const journey = stripComments(read(`${INTEGRATION_DIR}/journey/inspection-journey.ts`));
  assert.doesNotMatch(journey, /recovery|storage|JSON|persist/u, 'the journey coordinator persists nothing');
  assert.match(journey, /let bound: BoundJourney \| null = null;/u, 'and starts with no origin bound');
  assert.match(runtime, /journey: createInspectionJourneyCoordinator\(generation\),/u, 'a fresh coordinator per generation, resumed or not');
});

test('§16 — foreground delivery cursors come from the fresh snapshot, never from storage', () => {
  assert.doesNotMatch(recoveryText, /cursor|committedAfterSp|liveFocusAfterSp/u);
  assert.match(bootstrap, /committedAfterSp: snapshot\.liveHead === null \? null : sessionPosition\(snapshot\.liveHead\),/u);
  assert.match(bootstrap, /liveFocusAfterSp: snapshot\.liveFocusAtSp === null \? null : sessionPosition\(snapshot\.liveFocusAtSp\),/u);
});

// ---------------------------------------------------------------------------------------------
// Governance and registration
// ---------------------------------------------------------------------------------------------

test('the gate registers itself, the forward-safety hypothetical moved on, and the documents exist', () => {
  const manifest = readJson('package.json');
  assert.equal(manifest.scripts['test:t13-recovery-persistence-contract'], 'node --test tests/t13-recovery-persistence-contract.test.mjs');
  const workflow = read('.github/workflows/mobile-ci.yml');
  assert.equal((workflow.match(/run: npm run test:t13-recovery-persistence-contract\b/gu) ?? []).length, 1, 'exactly one gate step');
  assert.equal((workflow.match(/'tests\/t13-recovery-persistence-contract\.test\.mjs'/gu) ?? []).length, 1, 'exactly one trigger path');
  assert.equal((workflow.match(/runs-on: /gu) ?? []).length, 3, 'no job beyond the fast gate and the two native jobs');
  // The forward-safety gate no longer uses THIS gate's name as its hypothetical.
  const forwardSafety = read('tests/forward-safety-contract.test.mjs');
  assert.doesNotMatch(forwardSafety, /const FUTURE_GATE = 'test:t13-recovery-persistence-contract';/u, 'a registered gate cannot be the hypothetical');
  assert.equal(existsSync(new URL('docs/recovery-persistence-v1.md', root)), true);
  const doc = read('docs/recovery-persistence-v1.md');
  for (const required of [/T-13 backlog inheritance: 1 item/u, /QAN-BL-T13-01/u, /QAN-BL-AUTH-01/u, /QAN-BL-SEC-01/u, /Exact Return/u, /PINNED\(t\)/u]) {
    assert.match(doc, required, 'the task document records its inheritance and its boundaries');
  }
  assert.match(read('apps/mobile/README.md'), /Recovery \/ persistence \(T-13\)/u, 'the mobile README points at the layer');
});

test('§18 — the native restart proof reuses the T-12 Phase-M infrastructure: harness procedures, flows, one sequencer, two jobs', () => {
  const VALIDATION_DIR = `${INTEGRATION_DIR}/__validation__`;
  assert.equal(existsSync(new URL(`${VALIDATION_DIR}/recovery-validation.ts`, root)), true, 'the T-13 procedures exist beside the T12-04 ones');
  const procedures = stripComments(read(`${VALIDATION_DIR}/recovery-validation.ts`));
  // The procedures drive the REAL runtime and the REAL recovery store through public seams only.
  assert.match(procedures, /createIntegrationRuntime\(\)/u);
  assert.match(procedures, /from '\.\.\/\.\.\/recovery'/u, 'the store is reached through the T-13 barrel');
  assert.doesNotMatch(procedures, /from\s+'[^']*\/recovery\/[^']+'|existingSessionId|createProductRecoveryStorage|expo-sqlite/u);
  // Every interruption is real and lives OUTSIDE the flows: the procedures never restart anything.
  assert.doesNotMatch(procedures, /reload|restart\(|DevSettings|RNRestart|Updates\./u, 'a process cannot restart itself');
  for (const kind of ['RECOVERY_BEFORE', 'RECOVERY_AFTER', 'RECOVERY_AFTER_SIGNED_OUT', 'RECOVERY_AFTER_REFUSED', 'ADOPT_SESSION', 'PIN_MOMENT', 'RECOVERY_SIGN_OUT', 'RECOVERY_REPLACEMENT']) {
    assert.ok(procedures.includes(`'${kind}'`), `the ${kind} procedure exists`);
  }
  // The Product build is byte-identical: the harness is still selected by the one manifest line only.
  assert.equal(readJson('apps/mobile/package.json').main, 'expo-router/entry');
  // The flows, the one sequencer and its gate.
  const flows = readdirSync(join(rootPath, 'apps/mobile/.maestro')).filter((file) => file.startsWith('t13-recovery-')).sort();
  assert.deepEqual(flows, [
    't13-recovery-adopt-session.yaml',
    't13-recovery-after-refused.yaml',
    't13-recovery-after-signed-out.yaml',
    't13-recovery-after.yaml',
    't13-recovery-close-reopen.yaml',
    't13-recovery-phase-1-fresh-signin.yaml',
    't13-recovery-pin-moment.yaml',
    't13-recovery-replacement.yaml',
    't13-recovery-sign-out.yaml',
  ]);
  for (const flow of flows) {
    const text = read(`apps/mobile/.maestro/${flow}`);
    // Commands only: a flow's comment may name `clearState` in order to say it is absent.
    const commands = text.replace(/^\s*#[^\n]*$/gmu, '');
    assert.match(text, /^appId: com\.qandeel\.mobile$/mu);
    assert.equal(commands.includes('qandeel-product-root'), false, `${flow} drives the harness, never the Product root`);
    // Only the clean-install phase may clear state: every other flow reads back what an earlier one wrote.
    if (flow !== 't13-recovery-phase-1-fresh-signin.yaml') assert.equal(commands.includes('clearState'), false, `${flow} must not clear the store it reads back`);
    // A flow that types checks that the WHOLE value arrived (the sequencer passes each value's character
    // count beside it; the harness prints counts, never values), retrying the field until it did, and
    // dismisses the keyboard through the harness heading — never Maestro's `hideKeyboard` heuristic,
    // whose iOS fallback swipes at the centre of the screen (the first cloud run landed that swipe on
    // the new Moment input and could not dismiss the number pad it had just raised).
    if (commands.includes('inputText')) {
      assert.match(commands, /- retry:\n\s+maxRetries: 3\n\s+commands:/u, `${flow} retries typing until the whole value arrived`);
      assert.match(commands, /_CHARS\}/u, `${flow} checks the typed length against the sequencer's count`);
      assert.match(commands, /id: "t1204-heading"/u, `${flow} dismisses the keyboard through the harness heading`);
    }
  }
  // No flow at all leans on the heuristic: the harness geometry the T-13 inputs changed is the geometry
  // it swiped through, for the T-12 flows as much as these.
  for (const file of readdirSync(join(rootPath, 'apps/mobile/.maestro'))) {
    assert.equal(read(`apps/mobile/.maestro/${file}`).replace(/^\s*#[^\n]*$/gmu, '').includes('hideKeyboard'), false, `${file} must not use hideKeyboard`);
  }
  // The harness renders the report FIRST — on screen without scrolling however many controls follow
  // it (the first Android run never saw a report that sat below eleven buttons) — exposes the heading
  // the flows tap, and clears every credential field as a run starts, so Maestro's own failure
  // screenshot (taken before any flow reaches its erase step) cannot carry one.
  const harness = stripComments(read(`${VALIDATION_DIR}/AuthStorageValidationHarness.tsx`));
  assert.match(harness, /testID="t1204-heading"/u, 'the heading is addressable');
  assert.ok(harness.indexOf('testID="t1204-report"') < harness.indexOf('testID="t1204-email"'), 'the report precedes the inputs');
  assert.equal((harness.match(/clearCredentialFields\(\);/gu) ?? []).length, 2, 'both run paths clear the credential fields as they start');
  const sequencer = read('scripts/phase-m/run-t13-recovery-phases.sh');
  for (const interruption of ['xcrun simctl terminate', 'adb shell am force-stop', 'xcrun simctl shutdown', 'adb reboot', 'pressKey']) {
    assert.ok(`${sequencer}${flows.map((flow) => read(`apps/mobile/.maestro/${flow}`)).join('')}`.includes(interruption), `a real ${interruption} interruption exists`);
  }
  assert.match(sequencer, /record "\$name" blocked "requires \$r=\$\{prior:-missing\}"/u, 'a phase whose prerequisite failed is blocked, never passed');
  // macOS ships /bin/bash 3.2: the first cloud run died on `declare -A` before recording any outcome
  // and left an empty results file. No bash-4 feature; the results file is the one record.
  assert.doesNotMatch(sequencer.replace(/^\s*#[^\n]*$/gmu, ''), /declare -A|readarray|mapfile|\$\{[A-Za-z_]+\[@\]\}/u, 'the sequencer needs nothing beyond bash 3.2 (its comments may name what it avoids)');
  assert.match(sequencer, /^outcome_of\(\) \{$/mu, 'every outcome is read back from the results file');
  // The gate declares the complete phase list itself and is held to the phases the sequencer runs: an
  // empty or truncated results file can never pass (the first iOS run passed on zero rows).
  assert.equal(existsSync(new URL('scripts/phase-m/gate-t13-recovery-phases.sh', root)), true);
  const gate = read('scripts/phase-m/gate-t13-recovery-phases.sh');
  const declared = ((gate.match(/^EXPECTED_PHASES="([^"]+)"$/mu) ?? [])[1] ?? '').split(' ').filter(Boolean);
  const sequenced = [...sequencer.matchAll(/^run_phase (phase-\d\d-[a-z-]+) /gmu)].map((match) => match[1]).concat('phase-08-device-restart');
  assert.equal(declared.length, 14, 'fourteen phases are declared');
  assert.deepEqual([...declared].sort(), [...sequenced].sort(), 'the gate expects exactly the phases the sequencer runs');
  assert.match(gate, /missing\) state='NOT RECORDED/u, 'a phase the sequencer never reached is recorded as missing, not skipped over');
  assert.match(gate, /\*\)\n\s+\[ "\$outcome" = success \] \|\| failed=1/u, 'anything but success fails the gate');
  assert.match(gate, /if \[ "\$restarted" = success \]; then\n\s+\[ "\$outcome" = success \] \|\| failed=1/u, 'recovery after a successful device restart is gated like any other phase');
  assert.doesNotMatch(gate, /declare -A|readarray|mapfile/u);
  const workflow = read('.github/workflows/t12-phase-m-cloud-validation.yml');
  assert.match(workflow, /run_t13_recovery:/u, 'the recovery jobs are dispatchable from the existing Phase-M workflow');
  assert.match(workflow, /^  android-t13-recovery-emulator:$/mu);
  assert.match(workflow, /^  ios-t13-recovery-simulator:$/mu);
  assert.equal((workflow.match(/bash scripts\/phase-m\/run-t13-recovery-phases\.sh/gu) ?? []).length, 2, 'one sequencer, both platforms');
  // The canonical Mobile CI gate is untouched by the native proof: still exactly its three jobs.
  assert.equal((read('.github/workflows/mobile-ci.yml').match(/runs-on: /gu) ?? []).length, 3);
});

test('scope — no Product sign-in gateway, no credential hardening, no session browser, no replay, no background polling', () => {
  for (const forbidden of [/signInWithPassword/u, /SignIn|LoginScreen|Onboarding/u, /SecureStore|Keychain|Keystore|allowBackup/u, /sessions\/list|listSessions|SessionBrowser|Replay|replay/u, /setInterval|setTimeout|AppState/u]) {
    assert.doesNotMatch(recoveryText, forbidden, `T-13 does not own ${forbidden}`);
  }
  // No new route, no new dependency, no generated native project.
  assert.deepEqual(readdirSync(join(rootPath, `${MOBILE_SRC}/app`)).sort(), ['_layout.tsx', 'index.tsx']);
  assert.equal(existsSync(new URL('apps/mobile/ios', root)), false);
  assert.equal(existsSync(new URL('apps/mobile/android', root)), false);
});
