// T-03A2 - Session Semantic Clock + SP Allocation/Sealing + LH Establishment +
// Committed-CU Delivery: the application and client static contract.
//
// Secret-free and CI-runnable. Database semantics are proven against real
// PostgreSQL by database/verify-migration-0065.mjs and statically by
// database/tests/session-semantic-clock-sp-lh-delivery-v1.test.mjs; runtime
// behaviour is proven by the Jest suites in apps/api and apps/mobile. This
// contract guards the SHAPE of the boundary: what exists, what may reach it,
// what it is forbidden to pull forward, and how it is wired into CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = async (path) => (await readFile(new URL(path, root), 'utf8')).replace(/\r\n/gu, '\n');
const readJson = async (path) => JSON.parse(await read(path));

/** Code only: comments may name a forbidden pattern in order to forbid it. */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

const MOBILE_TEMPORAL_DIR = 'apps/mobile/src/temporal';
// (T-03D added live-focus-sync.ts: the ONE seam from the authoritative
// LIVE_FOCUS_TRANSITION wire event to the T-02 LF mirror; pinned by the T-03D contract.)
const MOBILE_TEMPORAL_FILES = ['temporal-wire.ts', 'temporal-api.ts', 'live-head-sync.ts', 'live-focus-sync.ts', 'index.ts'];
const API_BOUNDARY_FILES = [
  'apps/api/src/conversation-unit/conversation-temporal-establishment.service.ts',
  'apps/api/src/conversation-unit/deterministic-runtime-id.ts',
  'apps/api/src/conversation-unit/temporal-delivery.repository.ts',
  'apps/api/src/conversation/conversation-temporal.controller.ts',
];

const rootPackage = await readJson('package.json');
const rootLock = await readJson('package-lock.json');
const apiPackage = await readJson('apps/api/package.json');
const mobilePackage = await readJson('apps/mobile/package.json');
const runtimePackage = await readJson('packages/runtime/package.json');
const temporalTypes = await read('packages/runtime/src/temporal.d.ts');
const runtimeIndex = await read('packages/runtime/src/index.d.ts');
const establishment = await read('apps/api/src/conversation-unit/conversation-temporal-establishment.service.ts');
const temporalController = await read('apps/api/src/conversation/conversation-temporal.controller.ts');
const conversationModule = await read('apps/api/src/conversation/conversation.module.ts');
const conversationService = await read('apps/api/src/conversation/conversation.service.ts');
const orchestrator = await read('apps/api/src/conversation/conversation-orchestrator.service.ts');
const apiCi = await read('.github/workflows/api-ci.yml');
const mobileCi = await read('.github/workflows/mobile-ci.yml');

const mobileSources = Object.fromEntries(
  await Promise.all(MOBILE_TEMPORAL_FILES.map(async (name) => [name, await read(`${MOBILE_TEMPORAL_DIR}/${name}`)])),
);
const mobileCode = Object.fromEntries(Object.entries(mobileSources).map(([name, text]) => [name, stripComments(text)]));
const mobileText = Object.values(mobileCode).join('\n');

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

/** Repository-relative POSIX path of an absolute file path. */
const relative = (file, base = rootPath) => file.slice(base.length).replace(/^[\\/]/u, '').replace(/\\/gu, '/');

test('@qandeel/runtime is a TYPE-ONLY workspace package that ships no JavaScript', async () => {
  assert.equal(runtimePackage.name, '@qandeel/runtime');
  assert.equal(runtimePackage.private, true);
  assert.equal(runtimePackage.types, './src/index.d.ts');
  assert.equal('main' in runtimePackage, false, 'a type-only package declares no runtime entry point');
  assert.equal('dependencies' in runtimePackage, false, 'the shared contract adds no dependency');
  assert.deepEqual(runtimePackage.exports, { '.': { types: './src/index.d.ts' } });

  const files = listFiles(join(rootPath, 'packages/runtime')).map((file) => relative(file)).sort();
  // (T-03D added src/live-focus.d.ts: the authoritative LF wire value and transition event.)
  assert.deepEqual(files, ['packages/runtime/README.md', 'packages/runtime/package.json',
    'packages/runtime/src/index.d.ts', 'packages/runtime/src/live-focus.d.ts', 'packages/runtime/src/temporal.d.ts']);

  // It joins the existing root workspace and the ONE root lockfile.
  assert.deepEqual(rootPackage.workspaces, ['apps/*', 'packages/*']);
  assert.equal(rootLock.packages['packages/runtime'].name, '@qandeel/runtime');
  assert.equal(rootLock.packages['node_modules/@qandeel/runtime'].link, true);
  assert.equal(rootLock.packages['node_modules/@qandeel/runtime'].resolved, 'packages/runtime');
  // Declared where it is used, and only as a build-time contract.
  assert.equal(apiPackage.devDependencies['@qandeel/runtime'], '*');
  assert.equal(mobilePackage.devDependencies['@qandeel/runtime'], '*');
  assert.equal('@qandeel/runtime' in (apiPackage.dependencies ?? {}), false);
  assert.equal('@qandeel/runtime' in (mobilePackage.dependencies ?? {}), false);
});

test('every import of the shared contract is erased at compile time', async () => {
  const consumers = [
    'apps/api/src/conversation-unit/conversation-temporal-establishment.service.ts',
    'apps/api/src/conversation-unit/temporal-delivery.repository.ts',
    'apps/api/src/conversation/conversation-temporal.controller.ts',
    'apps/api/src/conversation/conversation.types.ts',
    `${MOBILE_TEMPORAL_DIR}/temporal-wire.ts`,
    `${MOBILE_TEMPORAL_DIR}/temporal-api.ts`,
    `${MOBILE_TEMPORAL_DIR}/live-head-sync.ts`,
    `${MOBILE_TEMPORAL_DIR}/index.ts`,
  ];
  let seen = 0;
  for (const path of consumers) {
    const source = stripComments(await read(path));
    for (const match of source.matchAll(/^(export\s+)?import(\s+type)?\s[^\n]*'@qandeel\/runtime'/gmu)) {
      seen += 1;
      assert.match(match[0], /import type|export type/u, `${path} must import @qandeel/runtime with import type`);
    }
    for (const match of source.matchAll(/^export\s+(type\s+)?\{[\s\S]*?\}\s+from\s+'@qandeel\/runtime'/gmu)) {
      assert.match(match[0], /export type/u, `${path} must re-export @qandeel/runtime types with export type`);
    }
    assert.doesNotMatch(source, /require\('@qandeel\/runtime'\)/u);
  }
  assert.ok(seen >= 5, `expected the shared contract to be consumed on both sides, saw ${seen}`);
});

test('the shared wire contract carries the frozen fields and nothing analytical', () => {
  assert.match(temporalTypes, /readonly type: ConversationalUnitsCommittedType;/u);
  assert.match(temporalTypes, /readonly version: 1;/u);
  for (const field of ['sessionId: string', 'batchId: string', 'sourceTurnId: string',
    'firstSp: number', 'lastSp: number', 'unitCount: number']) {
    assert.ok(temporalTypes.includes(`readonly ${field};`), `the wire event carries ${field}`);
  }
  assert.match(temporalTypes, /export type ConversationalUnitsCommittedType = 'CONVERSATIONAL_UNITS_COMMITTED';/u);
  assert.match(temporalTypes, /readonly liveHead: number \| null;/u, 'LH is null, never a zero sentinel');
  // The two names are deliberately different layers and neither is renamed.
  assert.doesNotMatch(temporalTypes, /LIVE_HEAD_ADVANCED|WORLD_TRUTH_UPDATED/u);
  // T-03D extended the wire ADDITIVELY with the authoritative Live Focus: the
  // closed reference identity (NONE / EMERGING / THREAD) and the SP it became
  // effective at - never a label, Home, confidence, sequence or content.
  const code = stripComments(`${temporalTypes}\n${runtimeIndex}`);
  for (const forbidden of ['committedText', 'text', 'analysis', 'reading', 'evidence', 'confidence', 'knowledge',
    'timestamp', 'createdAt', 'sameSp', 'eventSequence', 'label', 'home', 'Home', 'importance', 'direction']) {
    assert.ok(!code.includes(forbidden), `the wire contract must not carry ${forbidden}`);
  }
  assert.match(temporalTypes, /readonly liveFocus: LiveFocusWireValue;\s*\n\s*readonly liveFocusAtSp: number \| null;/u, 'the snapshot carries LF and its effective SP beside LH');
  assert.match(temporalTypes, /readonly liveHead: number \| null;\s*\n\s*readonly committedEvents: readonly ConversationalUnitsCommittedWireEvent\[\];\s*\n\}/u, 'the T-03A2 temporal delivery keeps exactly its two frozen fields');
});

test('the API temporal boundary exists and holds no conversation-lifecycle authority', async () => {
  for (const path of API_BOUNDARY_FILES) {
    assert.equal(existsSync(new URL(path, root)), true, `missing ${path}`);
  }
  const code = stripComments(establishment);
  for (const forbidden of ['failTurn', 'fail_conversation_turn', 'finalizeTurn', 'claimTurn',
    'recoverExpiredGeneratingTurn', 'router', 'ModelRouter', 'generate(']) {
    assert.ok(!code.includes(forbidden), `the establishment service must not reference ${forbidden}`);
  }
  // The two sources are evaluated separately and committed through ONE atomic
  // coordinator call, USER block first.
  assert.match(code, /userEvaluation[\s\S]*assistantEvaluation[\s\S]*Promise\.all\(\[userEvaluation, assistantEvaluation\]\)/u);
  assert.match(code, /commitFinalizedExchange\(\{[\s\S]*userSourceTurnId[\s\S]*assistantSourceTurnId/u);
  assert.equal((code.match(/commitFinalizedExchange\(/gu) ?? []).length, 1, 'exactly one atomic commit call site');
  // FIX-T03A2-01: the finalized-exchange relation is proven BEFORE the run, so
  // a structurally invalid completed pair costs zero provider calls and zero
  // database commitment - and is never mistaken for "nothing to establish".
  const gate = code.indexOf('assertFinalizedExchangeRelation(userTurn, assistantTurn)');
  assert.ok(gate > 0 && gate < code.indexOf('return await this.run('), 'the relation gate precedes establishment');
  for (const clause of [
    "userTurn.role !== 'USER'",
    "assistantTurn.role !== 'ASSISTANT'",
    'userTurn.session_id !== assistantTurn.session_id',
    'assistantTurn.source_turn_id !== userTurn.id',
  ]) {
    assert.ok(code.includes(clause), `the relation gate requires: ${clause}`);
  }
  assert.match(code, /throw new ConversationTemporalIntegrityError\('INVALID_FINALIZED_EXCHANGE_RELATION'\)/u);
  // The provider is created lazily, never at bootstrap.
  assert.match(code, /this\.binding \?\?= this\.createBinding\(\);/u);
  assert.doesNotMatch(code, /OPENAI_API_KEY/u, 'no provider credential is read here');
  assert.match(conversationModule, /useValue: openAiSegmentationBinding/u,
    'the module registers the FACTORY, never its product, so nothing is constructed at bootstrap');
  assert.doesNotMatch(stripComments(conversationModule), /useValue: openAiSegmentationBinding\(\)/u);
});

test('turn handling is two distinct technical phases', () => {
  // Phase 2 is invoked from the composition layer, strictly after the
  // orchestrator has produced durable COMPLETED turns.
  // (T-03D: phase 2 is the FINAL semantic chain - Session time PLUS B1, the
  // Thread layer and the effective Live Focus in ONE transaction - and the
  // temporal-only service is retired with no fallback.)
  assert.match(conversationService, /private readonly semantic: ConversationSemanticEstablishmentService/u);
  assert.match(conversationService, /return this\.establishSemanticChain\(userId, await this\.orchestrator\.orchestrate\(/u);
  assert.equal((stripComments(conversationService).match(/this\.establishSemanticChain\(/gu) ?? []).length, 3,
    'every orchestrated path - new turn, idempotency replay and the unique-violation replay - re-enters establishment');
  assert.doesNotMatch(stripComments(conversationService), /ConversationTemporalEstablishmentService|establishTemporal\(/u, 'no temporal-only fallback path exists');
  assert.equal((stripComments(conversationService).match(/this\.orchestrator\.orchestrate\(/gu) ?? []).length, 3,
    'and every one of those three paths goes through the generation phase exactly once');
  // Phase 1 is untouched and remains the ONLY owner of generation failure.
  const orchestratorCode = stripComments(orchestrator);
  assert.match(orchestratorCode, /await this\.repository\.failTurn\(/u);
  assert.doesNotMatch(orchestratorCode, /temporal|Temporal|conversation-unit|session_position|liveHead/u,
    'the orchestrator cannot reach temporal establishment, so a temporal failure can never falsify the lifecycle');
});

test('the temporal HTTP surface is delivery and catch-up only', () => {
  const code = stripComments(temporalController);
  assert.match(code, /@Get\('sessions\/:sessionId\/temporal'\)/u);
  assert.match(code, /@Get\('sessions\/:sessionId\/temporal\/events'\)/u);
  // (T-03D added the LF transition catch-up read beside the two T-03A2 reads.)
  assert.match(code, /@Get\('sessions\/:sessionId\/temporal\/live-focus-events'\)/u);
  assert.equal((code.match(/@Get\(|@Post\(|@Patch\(|@Put\(|@Delete\(/gu) ?? []).length, 3, 'exactly three read routes');
  assert.match(code, /@UseGuards\(SupabaseAuthGuard\)/u, 'all routes are authenticated');
  for (const forbidden of ['/timeline', '/history', '/projection', 'WebSocket', 'Sse', '@Sse', 'EventEmitter', 'observable']) {
    assert.ok(!code.includes(forbidden), `the temporal surface must not expose ${forbidden}`);
  }
  assert.match(code, /MAX_TEMPORAL_EVENT_PAGE/u, 'the catch-up page is bounded');
  assert.match(code, /afterSp[\s\S]*?parseBoundedInteger\(afterSp, 'afterSp', 1,/u, 'SP(0) is not a cursor');
  assert.match(conversationModule, /controllers: \[ConversationController, ConversationContextActivationController, ConversationTemporalController\]/u);
});

test('the mobile temporal boundary is exactly the authorized non-UI surface', () => {
  const dir = join(rootPath, MOBILE_TEMPORAL_DIR);
  const production = listFiles(dir)
    .filter((file) => !file.includes(join(dir, '__tests__')))
    .map((file) => relative(file, dir))
    .sort();
  assert.deepEqual(production, [...MOBILE_TEMPORAL_FILES].sort());
  const suites = readdirSync(join(dir, '__tests__')).filter((file) => /\.test\.tsx?$/u.test(file)).sort();
  assert.deepEqual(suites, ['live-focus-sync.test.ts', 'live-head-sync.test.ts', 'temporal-api.test.ts', 'temporal-wire.test.ts']);

  // Its only non-relative imports are the shared type contract.
  for (const [name, text] of Object.entries(mobileCode)) {
    const specifiers = [...text.matchAll(/from\s+'([^']+)'/gu)].map((match) => match[1]);
    for (const specifier of specifiers) {
      if (specifier.startsWith('.')) continue;
      assert.equal(specifier, '@qandeel/runtime', `${name} imports ${specifier}; only @qandeel/runtime and relative modules are allowed`);
    }
    assert.doesNotMatch(text, /require\(/u, `${name} must not use require()`);
  }
  // No UI, no Router, no persistence, no credential storage.
  for (const forbidden of ['expo-router', 'useRouter', 'usePathname', '<Link', 'react-native', 'View', 'Text',
    'AsyncStorage', 'SecureStore', 'MMKV', 'SQLite', 'localStorage', 'persist(', 'EXPO_PUBLIC_', 'process.env']) {
    assert.equal(mobileText.includes(forbidden), false, `the mobile temporal boundary must not reference ${forbidden}`);
  }
  // The transport owns nothing ambient: base URL, token and fetch are injected.
  assert.match(mobileCode['temporal-api.ts'], /readonly baseUrl: string;[\s\S]*readonly accessToken: string;[\s\S]*readonly fetch: FetchLike;/u);
});

test('FIX-T03A2-02: the transport binds every decoded response to the requested Session', () => {
  const api = mobileCode['temporal-api.ts'];
  // Both routes bind, and they bind BEFORE returning a value.
  // (T-03D added the LF catch-up route under the same binding rule.)
  assert.equal((api.match(/assertRequestedSession\(sessionId, /gu) ?? []).length, 3,
    'the snapshot route and both catch-up routes each bind the requested Session');
  assert.match(api, /assertRequestedSession\(sessionId, decoded\.value\.sessionId, 'snapshot'\);\s*\n\s*return decoded\.value;/u);
  assert.equal((api.match(/assertRequestedSession\(sessionId, decoded\.value\.sessionId, 'response'\);\s*\n\s*return decoded\.value\.events;/gu) ?? []).length, 2);
  assert.match(api, /reason: 'INVALID_IDENTITY'/u, 'a foreign-Session payload is an identity rejection');
  assert.match(api, /throw new TemporalTransportError\(\{/u, 'and it fails closed rather than returning a value');
  // The envelope Session identity survives decoding, so an EMPTY catch-up page
  // carrying a foreign envelope cannot pass: there is no event to disagree.
  const wire = mobileCode['temporal-wire.ts'];
  assert.match(wire, /export interface CommittedUnitsResponse \{\s*\n\s*readonly sessionId: string;/u);
  assert.match(wire, /return \{ ok: true, value: \{ sessionId, events: page\.value \} \};/u);
});

test('the client mirror is written only through the T-02 authoritative event seam', () => {
  const sync = mobileCode['live-head-sync.ts'];
  assert.match(sync, /store\.ingest\(\{ type: 'LIVE_HEAD_ADVANCED', toSp: sessionPosition\(toSp\) \}\)/u);
  assert.equal((sync.match(/store\.ingest\(/gu) ?? []).length, 1, 'exactly one ingestion call site');
  assert.equal((sync.match(/\.dispatch\(/gu) ?? []).length, 0, 'no Product action is ever dispatched');
  // The block head is mirrored once; individual Moments stay addressable by SP.
  assert.match(sync, /const toSp = event\.lastSp;/u);
  // A stale lower-SP delivery is CLASSIFIED, never applied backward.
  assert.match(sync, /error instanceof RetractionRejected\) return \{ outcome: 'STALE', toSp \}/u);
  assert.match(sync, /event\.sessionId !== state\.session\.id/u, 'a cross-Session delivery is refused');
  for (const forbidden of ['live.LH =', 'LH:', 'history.push', 'RhEntry', 'captureCheckpoint', 'LF', 'liveFocus']) {
    assert.equal(sync.includes(forbidden), false, `the mirror seam must not touch ${forbidden}`);
  }
  // T-03A2 delivers LH only through this seam. T-03D wires LF ingestion in its
  // OWN seam (live-focus-sync.ts) through the same T-02 authoritative-event
  // path; the LH seam never learned about LF, and no LF value is invented here.
  assert.equal(sync.includes('LIVE_FOCUS_TRANSITION'), false, 'LF ingestion is not wired in the LH seam');
  assert.equal(sync.includes("kind: 'NONE'"), false, 'no LF value is invented in the LH seam');
  const lfSync = mobileCode['live-focus-sync.ts'];
  assert.equal((lfSync.match(/store\.ingest\(\{ type: 'LIVE_FOCUS_TRANSITION'/gu) ?? []).length, 1, 'exactly one LF ingestion call site, through the same seam');
  assert.equal((lfSync.match(/\.dispatch\(/gu) ?? []).length, 0, 'the LF seam dispatches no Product action either');
  for (const forbidden of ['live.LF =', 'live.LH =', 'LIVE_HEAD_ADVANCED', 'history.push', 'captureCheckpoint']) {
    assert.equal(lfSync.includes(forbidden), false, `the LF seam must not touch ${forbidden}`);
  }
});

test('the T-02 canonical state kernel is unchanged and is still not mounted', async () => {
  const frozen = {
    'classes.ts': 'f0d17c675c148e26c523291e07769c3ed764f263',
    'actions.ts': '0fa63f31ebeb47575244e827d7ffd2090eec090c',
    'authority.ts': '1920ec550ad7b3b8eca02fb690f790654ce4609a',
    'transitions.ts': 'a078c6bc025b8c6ea9bdd321d2f03c1fcbe5c0ef',
    'history.ts': 'e12caa557ab719611d11e43392723a1bb2389c62',
    'selectors.ts': '72c156c298c5914a578fd41f3243c7bb596756ae',
    'store.ts': '8933e3ef05c10bd28a748cc4896871c8e50e658e',
    'CanonicalStateProvider.tsx': 'b7ea8b6e775f74f7d331843e4783dc7291b11b49',
    'index.ts': 'a70c2d61d112f62dfa11cc7209b35d0466eb4141',
  };
  for (const [name, blob] of Object.entries(frozen)) {
    assert.equal(gitBlobId(await read(`apps/mobile/src/state/${name}`)), blob,
      `T-03A2 redesigns no T-02 state: ${name} is byte-identical`);
  }
  // The shell still mounts nothing: T-03D owns the complete live snapshot.
  for (const file of ['apps/mobile/src/app/_layout.tsx', 'apps/mobile/src/app/index.tsx', 'apps/mobile/src/shell/FoundationShell.tsx']) {
    const text = await read(file);
    assert.doesNotMatch(text, /temporal|CanonicalState|state\//u, `${file} must not mount the temporal boundary in T-03A2`);
  }
});

test('no new third-party dependency is introduced anywhere', async () => {
  const declared = [
    ...Object.keys(apiPackage.dependencies ?? {}), ...Object.keys(apiPackage.devDependencies ?? {}),
    ...Object.keys(mobilePackage.dependencies ?? {}), ...Object.keys(mobilePackage.devDependencies ?? {}),
    ...Object.keys(rootPackage.devDependencies ?? {}),
  ];
  const workspaceOwned = declared.filter((name) => name.startsWith('@qandeel/'));
  assert.deepEqual([...new Set(workspaceOwned)], ['@qandeel/runtime'], 'the only new workspace package is the type-only contract');
  // `pg` is the pre-existing root devDependency the database verifiers use; it
  // is deliberately absent from this list.
  for (const name of ['uuid', 'nanoid', 'zod', 'ws', 'socket.io', 'socket.io-client', 'eventsource',
    'sse', 'knex', 'prisma', 'axios', 'node-fetch', 'undici']) {
    assert.equal(declared.includes(name), false, `${name} must not be introduced`);
  }
  assert.deepEqual(Object.keys(rootPackage.devDependencies), ['pg'], 'the root toolchain gains no dependency');
  // The runtime derives identities from Node's built-in crypto alone. Since
  // T-03B1b1 the version-5 derivation lives in the neutral runtime-identity
  // helper (so the focus canonicalizer shares the exact algorithm without
  // reaching into conversation-unit); that helper imports nothing but
  // node:crypto, and the T-03A2 module imports nothing but that helper.
  const identity = stripComments(await read('apps/api/src/conversation-unit/deterministic-runtime-id.ts'));
  const imports = [...identity.matchAll(/from\s+'([^']+)'/gu)].map((match) => match[1]);
  assert.deepEqual(imports, ['../runtime-identity/uuid-v5']);
  const helper = stripComments(await read('apps/api/src/runtime-identity/uuid-v5.ts'));
  assert.deepEqual([...helper.matchAll(/from\s+'([^']+)'/gu)].map((match) => match[1]), ['node:crypto']);
  assert.match(helper, /createHash\('sha1'\)\.update\(uuidToBytes\(namespace\)\)\.update\(Buffer\.from\(name, 'utf8'\)\)\.digest\(\)/u,
    'the extracted helper is the same RFC 4122 version-5 derivation');
  assert.match(helper, /bytes\[6\] = \(bytes\[6\] & 0x0f\) \| 0x50;\s*bytes\[8\] = \(bytes\[8\] & 0x3f\) \| 0x80;/u);
});

test('the T-03A2 gates are registered at the root and in both CI workflows', () => {
  assert.equal(rootPackage.scripts['test:session-semantic-clock-sp-lh-delivery-contract'],
    'node --test tests/session-semantic-clock-sp-lh-delivery-contract.test.mjs');
  assert.equal(rootPackage.scripts['verify:session-semantic-clock-sp-lh-delivery:integration'],
    'node --env-file-if-exists=.env database/verify-migration-0065.mjs');

  assert.match(apiCi, /run: npm run test:session-semantic-clock-sp-lh-delivery-contract/u);
  assert.match(apiCi, /run: npm run verify:session-semantic-clock-sp-lh-delivery:integration/u);
  assert.ok(apiCi.indexOf('test:session-semantic-clock-sp-lh-delivery-contract') < apiCi.indexOf('Apply all migrations to fresh PostgreSQL'),
    'the static contract runs before the database bootstrap');

  assert.match(mobileCi, /run: npm run test:session-semantic-clock-sp-lh-delivery-contract/u);
  assert.match(mobileCi, /'tests\/session-semantic-clock-sp-lh-delivery-contract\.test\.mjs'/u);
  // MOB-CI-01 is not weakened: still exactly the fast gate plus two CONDITIONAL
  // native jobs, and this task's real mobile source + lockfile change means the
  // classifier will demand full Android and iOS smoke on its own PR.
  assert.equal((mobileCi.match(/runs-on: /gu) ?? []).length, 3, 'no job was added or removed');
  assert.equal(
    (mobileCi.match(/if: needs\.verify-mobile-contracts\.outputs\.native_impact == 'true'/gu) ?? []).length, 2,
    'both native smoke jobs stay gated exactly as MOB-CI-01 left them',
  );
});
