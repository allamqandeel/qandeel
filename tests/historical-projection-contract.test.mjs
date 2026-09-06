// T-03C - Historical Coverage Completion + Layer A Projection + Layer B
// Disclosure v1: the static, secret-free repository contract.
//
// Pins the delivered surface: migration 0072 (the only migration after 0071;
// 0001 - 0071 byte-identical), the owner-scoped Layer-A read seam and the
// server-side Layer-B disclosure under apps/api/src/historical-projection,
// the additive historical wire in packages/runtime, the passive typed mobile
// seam under apps/mobile/src/projection, the docs, the verifier and the CI
// wiring; and the anti-scope: no Return-to-Live-Focus, no Go Live + Locate,
// no Map geometry, no Timeline window, no visual UI, no K/V in the T-02
// kernel, no RH from a projection, no generic WORLD_TRUTH_UPDATED event, no
// wall-clock comparison to TC, no new dependency, no lockfile change.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { isNativeImpactPath } from '../scripts/classify-mobile-native-impact.mjs';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
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
const relative = (file) => file.slice(rootPath.length).replace(/^[\\/]/u, '').replace(/\\/gu, '/');

const MIGRATION = '0072_historical_coverage_projection_disclosure_v1.sql';
const API_DIR = 'apps/api/src/historical-projection';
const API_FILES = ['historical-projection.types.ts', 'historical-projection-mapper.ts', 'historical-disclosure.ts', 'historical-projection.repository.ts'];
const API_SPECS = ['historical-projection.fixture.spec.ts', 'historical-projection-mapper.spec.ts', 'historical-disclosure.spec.ts', 'historical-projection.repository.spec.ts'];
const MOBILE_DIR = 'apps/mobile/src/projection';
const CONTROLLER = 'apps/api/src/conversation/conversation-historical-projection.controller.ts';

const migration = read(`database/migrations/${MIGRATION}`);
const productionCode = API_FILES.map((name) => stripComments(read(`${API_DIR}/${name}`))).join('\n');
const controller = stripComments(read(CONTROLLER));
const disclosure = stripComments(read(`${API_DIR}/historical-disclosure.ts`));
const mapper = stripComments(read(`${API_DIR}/historical-projection-mapper.ts`));
const repository = stripComments(read(`${API_DIR}/historical-projection.repository.ts`));
const conversationModule = read('apps/api/src/conversation/conversation.module.ts');
const runtimeIndex = read('packages/runtime/src/index.d.ts');
const runtimeHistorical = read('packages/runtime/src/historical-projection.d.ts');
const mobileWire = read(`${MOBILE_DIR}/historical-projection-wire.ts`);
const mobileApi = read(`${MOBILE_DIR}/historical-projection-api.ts`);
const mobileCache = read(`${MOBILE_DIR}/historical-projection-cache.ts`);
const mobileIndex = read(`${MOBILE_DIR}/index.ts`);
const mobileCode = [mobileWire, mobileApi, mobileCache, mobileIndex].map(stripComments).join('\n');
const doc = read('docs/historical-projection-v1.md');
const rootPackage = readJson('package.json');
const apiPackage = readJson('apps/api/package.json');
const mobilePackage = readJson('apps/mobile/package.json');
const apiCi = read('.github/workflows/api-ci.yml');
const mobileCi = read('.github/workflows/mobile-ci.yml');

test('migration 0072 is the ONE migration after 0071, 0001 - 0071 are byte-identical, and the delivered surface exists', () => {
  const migrations = readdirSync(join(rootPath, 'database/migrations')).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1), MIGRATION);
  assert.deepEqual(migrations.filter((name) => /0072_/u.test(name)), [MIGRATION], 'T-03C ships exactly ONE migration');
  // 0001 - 0071 are frozen bytes: compared against the git blob ids the
  // canonical repository carried at 0f1a8e7ebfa53dcb2eb610a295b5e05684e51b52
  // (raw bytes, so a CRLF file is pinned exactly as git stores it).
  const pins = readJson('tests/fixtures/historical-projection-migration-pins.json');
  assert.equal(Object.keys(pins).length, 71, 'seventy-one frozen migrations are pinned');
  for (const [name, blob] of Object.entries(pins)) {
    assert.equal(gitBlobId(readFileSync(new URL(`database/migrations/${name}`, root))), blob, `${name} is byte-identical`);
  }
  for (const file of ['database/verify-migration-0072.mjs', 'database/tests/historical-projection-v1.test.mjs', 'docs/historical-projection-v1.md', 'packages/runtime/src/historical-projection.d.ts',
    ...API_FILES.map((name) => `${API_DIR}/${name}`), ...API_SPECS.map((name) => `${API_DIR}/${name}`), CONTROLLER,
    `${MOBILE_DIR}/historical-projection-wire.ts`, `${MOBILE_DIR}/historical-projection-api.ts`, `${MOBILE_DIR}/historical-projection-cache.ts`, `${MOBILE_DIR}/index.ts`]) {
    assert.ok(existsSync(new URL(file, root)), `${file} exists`);
  }
  assert.deepEqual(listFiles(join(rootPath, API_DIR)).map((file) => file.slice(join(rootPath, API_DIR).length + 1).replace(/\\/gu, '/')).sort(), [...API_FILES, ...API_SPECS].sort());
  assert.match(read('docs/README.md'), /\[Historical Coverage Completion \+ Layer A Projection \+ Layer B Disclosure v1\]\(historical-projection-v1\.md\)/u);
  assert.match(read('apps/mobile/README.md'), /## Historical disclosure seam \(T-03C\)/u);
  const delivered = [migration, productionCode, controller, read('database/verify-migration-0072.mjs'), doc].join('\n');
  assert.doesNotMatch(delivered, /T-03C[a-z]\b|T-03C-[0-9]|\bC[ab]\b task|split task|sub-task|subtask/iu, 'T-03C is one task');
});

test('the Stage 6.6 v3 matrix reconciles to 31 FULL AFTER BUILD / 4 NOT EXPOSED / 0 BLOCKER (A-1 restored by the R2 canonical Reading subject-grounding authority), and every release condition R-C1 .. R-C5 is documented and proven', () => {
  const rows = [...doc.matchAll(/^\| (C[1-3]|E[1-4]|T[1-3]|A-[134]|L[1-2]|R[1-8]|M[1-4]|U[1-2]|Q1|F1|H[1-2]|N[1-2]) \|/gmu)].map((m) => m[1]);
  assert.equal(rows.length, 35, 'thirty-five matrix rows');
  assert.equal((doc.match(/\| FULL AFTER BUILD \|/gu) ?? []).length, 31);
  assert.equal((doc.match(/\| NOT EXPOSED \|/gu) ?? []).length, 4);
  assert.equal((doc.match(/\| BLOCKER \|/gu) ?? []).length, 0);
  assert.match(doc, /31 FULL AFTER BUILD \/ 4 NOT EXPOSED \/ 0 BLOCKER/u);
  // R1-02 -> R2: A-1 is FULL only because a truthful canonical subject-grounding
  // authority now exists (D-14) and the appearance is DERIVED from it inside the
  // database - never silently, never by a heuristic, never by a caller.
  assert.match(doc, /^\| A-1 \|[^\n]*derived in production from the canonical subject grounding \(D-14\)[^\n]*\| FULL AFTER BUILD \|$/mu, 'A-1 (Thread <-> Reading appearance) is FULL AFTER BUILD through the production path');
  assert.ok(doc.includes('R1-02 RESOLVED (R2) — CANONICAL READING SUBJECT-GROUNDING AUTHORITY'), 'the document states the resolution');
  assert.doesNotMatch(doc, /R1-02 BLOCKED|AUTHORITY MISSING|waits for that authority|unpopulated in production/u, 'no stale blocker statement survives');
  assert.match(doc, /\*\*D-14 — The canonical Reading subject-grounding authority \(R2\)/u, 'the authority is a recorded architecture decision');
  // R3: the universe frontier is documented as the immutable causal cut of the
  // source exchange, and no statement survives that the scheduler-dependent
  // Live Head is the universe authority.
  assert.match(doc, /\*\*D-15 — The deterministic causal grounding frontier \(R3\)\.\*\*/u, 'the causal frontier is a recorded architecture decision');
  assert.ok(doc.includes('causal_frontier_sp'), 'the causal input frontier is named separately from the actual availability anchor');
  assert.ok(doc.includes('SOURCE_SEMANTIC_FRONTIER_NOT_ESTABLISHED'), 'the retryable not-established condition is documented');
  assert.doesNotMatch(doc, /frontier = the Session's Live Head at build time|up to the Live Head\/current_sp at build time|frontier = `LH`/u, 'no stale statement survives that the scheduler-dependent Live Head is the causal universe authority');
  assert.ok(doc.includes('Stage 1.9 freezes Reading ↔ Hypothesis as PARTIAL'), 'the ontology is the frozen PARTIAL one: analytical identity, subject grounding, Thread appearance and Evidence participation kept apart');
  assert.doesNotMatch(doc, /evaluator that decides binding is a later task|is a later task/u, 'the binding authority is not deferred to a later task (R1-04)');
  assert.ok(doc.includes('Binding from a label, string similarity, an embedding, Evidence or peer co-occurrence, the current LF at creation time, or geometry is forbidden by the frozen rule, so none is invented'),
    'the document records that no heuristic stands in for the authority');
  assert.doesNotMatch(migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n'), /similar|embedding|ILIKE|~\*/u, 'the migration carries no similarity authority that could bind a Reading');
  assert.doesNotMatch(productionCode, /bind_reading_to_thread_v1|unbind_reading_from_thread_v1|record_thread_reading_appearance_v1|persist_authorized_subject_groundings_v1/u, 'the projection runtime never writes an appearance or a grounding');
  // R1-01: the runtime of a LEGACY UNCOVERED SESSION continues; only its historical projection is disabled.
  assert.match(doc, /Conversation Runtime continues normally/u, 'the document states that a LEGACY UNCOVERED SESSION keeps its Conversation Runtime');
  assert.doesNotMatch(doc, /no Session Position can ever be committed into it|never enters committed-CU commitment|the CU gate/u, 'no stale statement about a gated runtime survives (R1-04)');
  assert.match(doc, /P66-C \| B0 \|/u, 'P66-C is the deployment-spanning proof (stage B0)');
  assert.doesNotMatch(doc, /P66-C \| D \|/u, 'later-Session baseline inheritance is not called P66-C');
  assert.doesNotMatch(doc, /lose EXECUTE/u, 'R-C3 is described as capture, not as a revoked attach path (R1-04)');
  for (const condition of ['R-C1', 'R-C2', 'R-C3', 'R-C4', 'R-C5']) assert.ok(doc.includes(`**${condition}`), `${condition} is documented`);
  for (const proof of ['P66-A', 'P66-B', 'P66-C', 'P66-D', 'P66-E', 'P66-F', 'P66-G', 'P66-H', 'Z66-03', 'Z66-04', 'Z66-05']) assert.ok(doc.includes(proof), `${proof} is documented`);
  for (const token of ['UNKNOWN_AT_TC', 'KNOWN_AND_CURRENT_AT_TC', 'KNOWN_NONCURRENT_AT_TC', 'PREVALID', 'SUPERSEDED', 'CONTEXT_UNAVAILABLE_AT_TC', 'AVAILABLE_BUT_DEPTH_WITHHELD', 'AVAILABLE_AND_RENDERABLE',
    'EMERGING_PREGEOGRAPHIC', 'ESTABLISHED_ACTIVE', 'ESTABLISHED_DORMANT', 'ESTABLISHED_REOPENED', 'LEGACY UNCOVERED SESSION', 'PRE_FIRST_SP']) {
    assert.ok(doc.includes(token), `the resolution vocabulary names ${token}`);
  }
  assert.match(doc, /no generic `WORLD_TRUTH_UPDATED`/u, 'the document records that no generic world-truth event exists');
  for (const [name, text] of [['the runtime', productionCode], ['the controller', controller], ['the wire', stripComments(runtimeHistorical)], ['the client seam', mobileCode]]) {
    assert.equal(text.includes('WORLD_TRUTH_UPDATED'), false, `${name} declares no generic world-truth event`);
  }
});

test('Layer A is ONE owner-scoped read and Layer B is a pure server function: no write, no Product action, no RH, no kernel write, no ranking', () => {
  assert.match(repository, /'rpc\/get_session_historical_projection_v1'/u);
  assert.equal((repository.match(/'rpc\//gu) ?? []).length, 1, 'exactly ONE RPC');
  assert.match(repository, /body: JSON\.stringify\(\{ p_session_id: sessionId, p_tc: tc \}\)/u, 'the caller supplies a Session and a TC, never a user id, an SP anchor or a version');
  assert.match(repository, /import \{ DataApiError, readDataApiUpstreamIdentity, type SupabaseDataApiService \} from '\.\.\/conversation\/supabase-data-api\.service';/u, 'the AUTHENTICATED channel with the caller\'s own token');
  assert.doesNotMatch(productionCode, /SupabaseServiceRoleApiService|service_role|serviceApi/u, 'no service-role read: the database derives the owner from auth.uid()');
  for (const forbidden of ['HISTORICAL_COVERAGE_UNAVAILABLE', 'LIVE_HEAD_NOT_ESTABLISHED', 'HISTORICAL_BASELINE_MISSING', 'SESSION_POSITION_NOT_ADDRESSABLE']) {
    assert.ok(repository.includes(`'${forbidden}'`), `the repository classifies ${forbidden}`);
  }
  assert.match(repository, /'SESSION_NOT_VISIBLE'/u, 'a Session the caller cannot see hides its existence');
  assert.doesNotMatch(productionCode, /INSERT|UPDATE|DELETE|rpc\/commit|rpc\/bind|rpc\/unbind|rpc\/server_create|rpc\/persist|rpc\/execute|rpc\/sync/u, 'Layer A / B never write');
  assert.doesNotMatch(productionCode, /dispatch\(|store\.|ingest\(|history\.push|RhEntry|captureCheckpoint|CanonicalState/u, 'no kernel write and no RH from a projection');
  assert.doesNotMatch(productionCode, /Date\.now|new Date|setTimeout|setInterval|Math\.random|randomUUID|process\.env/u, 'no clock, no timer, no randomness, no ambient configuration');
  assert.doesNotMatch(productionCode, /score|rank\b|centrality|similar|embedding|importance ordering|sort\(\(a, b\) => b\.(?:confidence|importance)/iu, 'no ranking or similarity authority');
  assert.match(disclosure, /export const HISTORICAL_SEMANTIC_DEPTHS: readonly HistoricalSemanticDepth\[\] = Object\.freeze\(\['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'\]\);/u, 'the five frozen rungs');
  assert.match(disclosure, /READING: 'ANALYTICAL_OBJECT'/u, 'Reading discloses at the analytical-object rung, never a depth of its own');
  assert.match(disclosure, /return disclosed \? \{ status: 'DISCLOSED', value: value\(\) \} : \{ status: 'DEPTH_WITHHELD' \};/u, 'a withheld rung is WITHHELD, never empty');
  assert.match(disclosure, /if \(!known\) return \{ knowledge: 'UNKNOWN_AT_TC' \};/u);
  assert.match(disclosure, /noncurrent = request\.version > version \? 'PREVALID' : 'SUPERSEDED';/u, 'PREVALID beyond the then-current version, SUPERSEDED before it');
  assert.match(disclosure, /'CONTEXT_UNAVAILABLE_AT_TC'/u);
  assert.match(disclosure, /'AVAILABLE_BUT_DEPTH_WITHHELD'/u);
  assert.match(disclosure, /world: \{ threads: knowledge\.threads, liveFocus: knowledge\.liveFocus \}/u, 'the WORLD rung is the floor of every disclosure');
  // The mapper renames the canonical Hypothesis to Reading (SDM-03) and the Memory to Material on the way out, and fails closed on every defect.
  assert.match(mapper, /readingId = text\(appearance\.hypothesisId/u);
  assert.match(mapper, /supersedesMaterialId: textOrNull\(row\.supersedesMemoryId/u);
  assert.match(mapper, /HISTORICAL_PROJECTION_ROW_MALFORMED/u);
  assert.match(mapper, /HISTORICAL_PROJECTION_INCOHERENT/u);
  assert.match(mapper, /if \(moments\.length !== tc \|\| moments\.some\(\(moment, index\) => moment\.sp !== index \+ 1\)\)/u, 'exactly SP(1) .. SP(TC)');
  assert.match(mapper, /integerText\(home\.x/u, 'a Home coordinate never passes through a float');
  assert.doesNotMatch(mapper, /\?\? \[\]|\?\? null|\?\? 0|\|\| \[\]/u, 'nothing is defaulted: a missing family is a transport failure, never empty knowledge');
});

test('the controller is the ONE authenticated historical read: typed refusals, no write, registered beside the temporal controller', () => {
  assert.match(controller, /@Controller\('conversation'\)/u);
  assert.match(controller, /@UseGuards\(SupabaseAuthGuard\)/u);
  assert.match(controller, /@Get\('sessions\/:sessionId\/historical-projection'\)/u);
  assert.equal((controller.match(/@(?:Get|Post|Put|Patch|Delete)\(/gu) ?? []).length, 1, 'exactly one route');
  assert.doesNotMatch(controller, /@Post|@Put|@Patch|@Delete|WebSocket|Sse|@Sse|EventEmitter|observable/u);
  assert.match(controller, /return disclose\(knowledge, semanticDepth, inspection\);/u, 'Layer B runs on the server; K\(TC\) never leaves it');
  assert.match(controller, /case 'SESSION_NOT_VISIBLE': return new NotFoundException/u);
  assert.match(controller, /case 'SESSION_POSITION_NOT_ADDRESSABLE': return new BadRequestException\(body\);/u);
  assert.match(controller, /default: return new ConflictException\(body\);/u, 'coverage / Live Head / baseline refusals are 409 with their typed code');
  assert.match(controller, /if \(raw === undefined\) return 'WORLD';/u, 'depth defaults to the WORLD floor');
  assert.match(controller, /\/\^\[0-9\]\{1,16\}\$\/u\.test\(raw\)/u, 'TC is parsed as a bounded positive integer; SP(0) is refused');
  assert.match(conversationModule, /controllers: \[ConversationController, ConversationContextActivationController, ConversationTemporalController, ConversationHistoricalProjectionController\]/u);
  assert.match(conversationModule, /provide: HistoricalProjectionRepository,\s*\n\s*useFactory: \(dataApi: SupabaseDataApiService\) => new HistoricalProjectionRepository\(dataApi\),\s*\n\s*inject: \[SupabaseDataApiService\],/u,
    'the repository is registered through an explicit factory on the AUTHENTICATED channel');
  assert.doesNotMatch(productionCode, /@Injectable\(|@Module\(|@Controller\(|from '@nestjs\//u, 'no Nest decorator and no Nest import inside historical-projection/');
  assert.doesNotMatch(stripComments(read('apps/api/src/conversation/conversation-temporal.controller.ts')), /historical|projection/u, 'the T-03D temporal controller is untouched by history');
  assert.doesNotMatch(stripComments(read('apps/api/src/conversation-unit/temporal-delivery.repository.ts')), /historical|projection/u);
  for (const file of listFiles(join(rootPath, 'apps/api/src/live-focus')).map(relative)) {
    assert.doesNotMatch(stripComments(read(file)), /historical-projection|HistoricalProjection|get_session_historical_projection_v1/u, `${file} does not reach the projection`);
  }
});

test('the wire is additive and closed: K(TC) never crosses, V crosses typed per rung with DEPTH_WITHHELD, no timestamp, no same-SP sequence, no score, no label', () => {
  assert.match(runtimeIndex, /from '\.\/historical-projection'/u);
  assert.match(stripComments(runtimeHistorical), /export type HistoricalSemanticDepth = 'WORLD' \| 'THREAD' \| 'SESSION' \| 'ANALYTICAL_OBJECT' \| 'SOURCE_PROVENANCE';/u);
  assert.match(stripComments(runtimeHistorical), /export type HistoricalRung<T> =\s*\|\s*\{ readonly status: 'DISCLOSED'; readonly value: T \}\s*\|\s*\{ readonly status: 'DEPTH_WITHHELD' \};/u);
  assert.match(stripComments(runtimeHistorical), /export type ThreadStateAtTc = 'ESTABLISHED_ACTIVE' \| 'ESTABLISHED_DORMANT' \| 'ESTABLISHED_REOPENED' \| 'ESTABLISHED_UNBOUND_IN_SESSION';/u);
  assert.match(stripComments(runtimeHistorical), /export type HistoricalExpiryMapping = 'NO_EXPIRY' \| 'PRE_FIRST_SP' \| 'SP' \| 'PENDING' \| 'NOT_IN_SESSION';/u);
  assert.match(stripComments(runtimeHistorical), /export type ConfidenceResolutionAtTc = 'CURRENT' \| 'SUPERSEDED' \| 'PREVALID';/u);
  assert.match(stripComments(runtimeHistorical), /readonly world: DisclosedWorldRung;\s*readonly thread: HistoricalRung<DisclosedThreadRung>;\s*readonly session: HistoricalRung<DisclosedSessionRung>;\s*readonly analyticalObject: HistoricalRung<DisclosedAnalyticalObjectRung>;\s*readonly sourceProvenance: HistoricalRung<DisclosedSourceProvenanceRung>;\s*readonly inspection: HistoricalInspectionResolution \| null;/u);
  assert.match(stripComments(runtimeHistorical), /readonly x: string;\s*readonly y: string;/u, 'a Home crosses as exact integer text');
  const wireCode = stripComments(runtimeHistorical);
  for (const forbidden of ['label', 'title', 'direction', 'relationCount', 'score', 'rank', 'centrality', 'sameSp', 'eventSequence', 'timestamp', 'createdAt', 'created_at', 'expiresAt', 'Date', 'camera', 'viewport',
    'locat', 'follow', 'GO_LIVE', 'RETURN_TO', 'WORLD_TRUTH_UPDATED', 'hypothesis', 'memory_id', 'reasonCode']) {
    assert.equal(wireCode.includes(forbidden), false, `the historical wire must not carry ${forbidden}`);
  }
  assert.doesNotMatch(wireCode, /readonly (?:kind|status|state|mapping|resolution): string;/u, 'every state on the wire is a closed union, never an open string');
  // Every consumer imports the shared contract as a type only.
  for (const path of [`${API_DIR}/historical-projection.types.ts`, `${API_DIR}/historical-projection-mapper.ts`, `${API_DIR}/historical-disclosure.ts`, CONTROLLER,
    `${MOBILE_DIR}/historical-projection-wire.ts`, `${MOBILE_DIR}/historical-projection-api.ts`, `${MOBILE_DIR}/historical-projection-cache.ts`, `${MOBILE_DIR}/index.ts`]) {
    const source = stripComments(read(path));
    for (const match of source.matchAll(/^(export\s+)?import(\s+type)?\s[^\n]*'@qandeel\/runtime'/gmu)) assert.match(match[0], /import type|export type/u, `${path} imports @qandeel/runtime as a type`);
    for (const match of source.matchAll(/^export\s+(type\s+)?\{[\s\S]*?\}\s+from\s+'@qandeel\/runtime'/gmu)) assert.match(match[0], /export type/u, `${path} re-exports @qandeel/runtime as types`);
  }
});

test('the client seam is passive and typed: decode, fetch, hold; NOT_FETCHED / DEPTH_WITHHELD / UNKNOWN_AT_TC / UNAVAILABLE kept apart; no kernel write, no UI, no mount', () => {
  const dir = join(rootPath, MOBILE_DIR);
  const production = listFiles(dir).filter((file) => !file.includes(join(dir, '__tests__'))).map((file) => file.slice(dir.length + 1).replace(/\\/gu, '/')).sort();
  assert.deepEqual(production, ['historical-projection-api.ts', 'historical-projection-cache.ts', 'historical-projection-wire.ts', 'index.ts']);
  assert.deepEqual(readdirSync(join(dir, '__tests__')).filter((file) => /\.test\.tsx?$/u.test(file)).sort(), ['historical-projection-api.test.ts', 'historical-projection-cache.test.ts', 'historical-projection-wire.test.ts']);
  assert.match(mobileWire, /import \{ exactShapeIssue, isPlainRecord, isSemanticDepth, isSessionPosition \} from '\.\.\/state';/u, 'ONE definition of exact shape on the client');
  assert.match(mobileWire, /export function decodeHistoricalDisclosure\(/u);
  assert.match(mobileWire, /export function decodeUnavailableBody\(/u);
  assert.match(mobileWire, /if \(\(value\.status === 'DISCLOSED'\) !== \(rank >= own\)\) return reject\('INVALID_RUNG'/u, 'depth is monotonic on the wire too');
  assert.match(mobileCache, /\{ readonly status: 'NOT_FETCHED' \}/u);
  assert.match(mobileCache, /\{ readonly status: 'UNAVAILABLE'; readonly code: HistoricalProjectionUnavailableCode \}/u);
  assert.match(mobileCache, /if \(known && entry\.status === 'FETCHED' && !entry\.sealed\) this\.entries\.delete\(key\);/u, 'the open head is dropped on a newer revision; a sealed disclosure never is');
  assert.match(mobileApi, /async fetchDisclosure\(/u);
  assert.equal((mobileApi.match(/this\.config\.fetch\(/gu) ?? []).length, 1, 'exactly one route');
  assert.match(mobileApi, /if \(decoded\.value\.sessionId !== sessionId\)/u, 'the requested Session is part of the trust boundary');
  assert.match(mobileApi, /if \(decoded\.value\.tc !== request\.tc\)/u, 'so is the requested TC');
  assert.match(mobileApi, /kind: 'UNAVAILABLE', code: refusal\.value\.code/u, 'a typed refusal is UNAVAILABLE with its exact code, never an empty disclosure');
  for (const forbidden of ['store.', 'ingest(', '.dispatch(', 'live.LF', 'live.LH', 'LIVE_HEAD_ADVANCED', 'history.push', 'captureCheckpoint', 'RhEntry', 'camera', 'anchor:', 'scale:', 'PAN', 'ZOOM', 'COMMIT_MOMENT', 'COMMIT_LIVE_EDGE',
    'RETURN_TO_LIVE_FOCUS', 'GO_LIVE', 'LOCATE', 'locate', 'setTimeout', 'setInterval', 'Date.now', 'new Date', 'Math.random',
    'expo-router', 'useRouter', 'usePathname', '<Link', 'react-native', 'View', 'AsyncStorage', 'SecureStore', 'MMKV', 'SQLite', 'localStorage', 'persist(', 'EXPO_PUBLIC_', 'process.env', 'WebSocket', 'EventSource']) {
    assert.equal(mobileCode.includes(forbidden), false, `the mobile projection boundary must not reference ${forbidden}`);
  }
  for (const [name, text] of [['historical-projection-wire.ts', mobileWire], ['historical-projection-api.ts', mobileApi], ['historical-projection-cache.ts', mobileCache], ['index.ts', mobileIndex]]) {
    for (const specifier of [...stripComments(text).matchAll(/from\s+'([^']+)'/gu)].map((m) => m[1])) {
      if (!specifier.startsWith('.')) assert.equal(specifier, '@qandeel/runtime', `${name} imports ${specifier}; only @qandeel/runtime and relative modules are allowed`);
    }
  }
  // The T-02 kernel, the shell, the router root and the T-03A2 / T-03D temporal boundary are byte-identical; nothing is mounted.
  // T-04 re-anchor: the five kernel files it touched to promote `INSPECT_OBJECT`,
  // `SWITCH_CONTEXT` and `DIRECT_JUMP`, and then to gate them behind the R1-01 authorized Map
  // seam, carry their post-promotion ids. The pins stay exact, so any further kernel change still
  // trips this gate, and T-03C itself changed none of them.
  for (const [file, blob] of [
    ['apps/mobile/src/state/actions.ts', '4e20dd4346dec252fb1b754fd510d31b710dd42e'],
    ['apps/mobile/src/state/authority.ts', 'b9d4a5b1cd354bfc529175341c59f6bc5bbd9ad8'],
    ['apps/mobile/src/state/classes.ts', 'f0d17c675c148e26c523291e07769c3ed764f263'],
    ['apps/mobile/src/state/history.ts', 'e12caa557ab719611d11e43392723a1bb2389c62'],
    ['apps/mobile/src/state/index.ts', '4e74f2e4ce2bcc83f702a5b4f9d85fd298bc93d7'],
    ['apps/mobile/src/state/selectors.ts', '72c156c298c5914a578fd41f3243c7bb596756ae'],
    ['apps/mobile/src/state/store.ts', '2054b500369ca23813c7ad90ee9c717b8f35a7e3'],
    ['apps/mobile/src/state/transitions.ts', 'a78931bf1efc1b4a05cfa0bc7c4557da041cdaca'],
    ['apps/mobile/src/state/CanonicalStateProvider.tsx', 'b7ea8b6e775f74f7d331843e4783dc7291b11b49'],
    ['apps/mobile/src/shell/FoundationShell.tsx', 'e2286ba1a35c2e40def475af5deed2d8ba8120d3'],
    ['apps/mobile/src/app/_layout.tsx', '90179f6d13026e9b0e2345e0418012214b9c9aab'],
    ['apps/mobile/src/app/index.tsx', 'ef38d10c76a957163bf00f7b7b60fb8aa25841f4'],
    ['apps/mobile/src/temporal/live-head-sync.ts', '77ec84982d9202c81152907ac6844af1d3e18883'],
  ]) {
    assert.equal(gitBlobId(read(file)), blob, `${file} is byte-identical: the kernel, the shell, the router root and the LH seam are untouched`);
  }
  for (const file of ['apps/mobile/src/app/_layout.tsx', 'apps/mobile/src/app/index.tsx', 'apps/mobile/src/shell/FoundationShell.tsx']) {
    assert.doesNotMatch(read(file), /projection|historical|Historical/u, `${file} mounts nothing historical`);
  }
  for (const file of listFiles(join(rootPath, 'apps/mobile/src/temporal')).map(relative)) {
    assert.doesNotMatch(stripComments(read(file)), /historical-projection|HistoricalDisclosure|HistoricalProjection/u, `${file} never learned about the projection`);
  }
  // Native CI RUNS for this change: the mobile source change is a native-impact path by the frozen MOB-CI-01 classifier.
  assert.equal(isNativeImpactPath(`${MOBILE_DIR}/historical-projection-wire.ts`), true, 'the Android / iOS smoke gates run for T-03C');
  // T-04 re-anchor: the workflow gained exactly one Node-only gate step and one trigger path for
  // the T-04 static contract. MOB-CI-01's structure is unchanged and is asserted structurally by
  // the T-01, T-02 and T-04 contracts: one fast gate plus two conditional native jobs.
  assert.equal(gitBlobId(mobileCi), '74ce57541a37de659fc0105d2195a61f4360143e', 'mobile-ci.yml carries only the authorized T-04 and T-06 gate steps (MOB-CI-01 preserved)');
  // T-04 re-anchor: the mobile package gained exactly the authorized Skia pin and the Jest setup
  // for it. The pin stays exact, so a further dependency change still trips this gate.
  assert.equal(gitBlobId(read('apps/mobile/package.json')), 'd10b3a577d6ee26c0af2e045f4bc39496181b2e7', 'the mobile package declaration carries only the authorized T-04 renderer pin beyond this baseline');
});

test('R2: the production A-1 path is the canonical subject-grounding authority end to end - server-built universe, opaque handles, server authorization, atomic persistence, derived appearance - and nothing else writes an appearance or a grounding', () => {
  const apiSrc = join(rootPath, 'apps/api/src');
  const production = listFiles(apiSrc).filter((file) => /\.ts$/u.test(file) && !/\.spec\.ts$/u.test(file) && !file.includes('__tests__')).map((file) => [relative(file), stripComments(read(relative(file)))]);
  assert.ok(production.length > 50, 'the API source tree was walked');
  for (const [file, text] of production) {
    assert.doesNotMatch(text, /bind_reading_to_thread_v1|unbind_reading_from_thread_v1|record_thread_reading_appearance_v1|persist_authorized_subject_groundings_v1|thread_reading_bindings|hypothesis_subject_groundings\b/u,
      `${file} reaches no appearance or grounding writer: the database derives both from the canonical grounding`);
  }
  const rpcOwners = production.filter(([, text]) => /build_hypothesis_subject_grounding_universe_v1|complete_post_response_grounded_candidates_v1/u.test(text)).map(([file]) => file);
  assert.deepEqual(rpcOwners, ['apps/api/src/post-response-intelligence/post-response-intelligence.repository.ts'], 'exactly ONE repository reaches the two service_role authority entries');
  const ledger = stripComments(read('apps/api/src/post-response-intelligence/post-response-intelligence.repository.ts'));
  assert.match(ledger, /this\.request<unknown>\('rpc\/build_hypothesis_subject_grounding_universe_v1',\{method:'POST',body:JSON\.stringify\(\{p_execution_id:id\}\)\}\)/u, 'the universe is built from the execution identity alone');
  assert.match(ledger, /this\.booleanRpc\('complete_post_response_grounded_candidates_v1',\{p_execution_id:id,p_result_code:'VALIDATED_CANDIDATES',p_result_payload:result\.candidates,p_subject_grounding:result\.subjectGroundings\}\)/u, 'the durable VALIDATED result carries the selections the server authorized, through the grounded completion');
  assert.match(ledger, /this\.booleanRpc\('complete_post_response_candidate_provider_effect_v1',\{p_execution_id:id,p_result_code:'NO_ACCEPTED_CANDIDATES',p_result_payload:null\}\)/u, 'NO_ACCEPTED_CANDIDATES is the frozen completion');
  assert.match(ledger, /parseSubjectGroundingUniverseResolution\(/u, 'the universe is parsed exactly; corruption is a database failure, never an empty universe');
  // R3: the not-yet-established causal frontier is surfaced as its own stable
  // condition - never rewritten into an empty universe, never into an
  // arbitrary database failure.
  assert.match(ledger, /if\(!resolved\|\|\(resolved\.status==='ESTABLISHED'&&resolved\.universe\.executionId!==id\)\)throw new Error\('POST_RESPONSE_DATABASE_UNAVAILABLE'\);return resolved;/u,
    'R3: only corruption is a database failure; the readiness condition is returned as itself');
  const dispatcher = stripComments(read('apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts'));
  const universeAt = dispatcher.indexOf('await this.ledger.buildSubjectGroundingUniverse(execution.id)');
  const claimAt = dispatcher.indexOf("await this.ledger.claim(execution.id,'CANDIDATE_PROVIDER')");
  assert.ok(universeAt > 0 && claimAt > universeAt, 'the universe is built from the durable execution BEFORE the CANDIDATE_PROVIDER claim, never from a caller');
  const notEstablishedAt = dispatcher.indexOf("if(resolved.status===SOURCE_SEMANTIC_FRONTIER_NOT_ESTABLISHED)return false;");
  assert.ok(notEstablishedAt > universeAt && notEstablishedAt < claimAt,
    'R3: a not-yet-established causal frontier returns non-terminal BEFORE the budget gate and the Candidate claim - no provider budget slot is spent and no provider is called');
  assert.ok(dispatcher.indexOf("budget.authorize('CANDIDATE_PROVIDER')") > notEstablishedAt, 'R3: the provider-budget invariant holds - the budget is consulted only once the causal universe is ready');
  assert.match(dispatcher, /generateHypothesisCandidatePlan\(context,assembled\.request,[^;]*himContext,subjectGroundingUniverse\)/u, 'the one provider call receives the server universe');
  const policy = stripComments(read('apps/api/src/hypothesis/hypothesis-generation.policy.ts'));
  assert.match(policy, /authorizeSubjectGroundingHandles\(value\.subjectGroundingHandles,request\.eligibleSubjectGroundings\)/u, 'every proposal is authorized against the universe of ITS request');
  const enrichment = stripComments(read('apps/api/src/background-intelligence/background-intelligence-enrichment.service.ts'));
  assert.match(enrichment, /authorizeSubjectGroundingHandles\(proposal\.subjectGroundingHandles,request\.eligibleSubjectGroundings\)/u, 'and again where the durable selection is assembled');
  assert.match(enrichment, /eligibleSubjectGroundings/u);
  const authority = stripComments(read('apps/api/src/hypothesis/hypothesis-subject-grounding.authority.ts'));
  const types = stripComments(read('apps/api/src/hypothesis/hypothesis-subject-grounding.types.ts'));
  const generator = stripComments(read('apps/api/src/hypothesis/gemini-hypothesis-candidate.generator.ts'));
  for (const [name, text] of [['the authority', authority], ['the types', types]]) {
    assert.doesNotMatch(text, /emergingFocusId|threadId|focusId|emerging_focus|thread_id|sessionId/u, `${name} never sees or accepts a focus, Thread or Session identity: handles only`);
  }
  for (const [name, text] of [['the authority', authority], ['the types', types], ['the generator', generator]]) {
    assert.doesNotMatch(text, /similar|embedding|levenshtein|cosine|normalize\(|localeCompare|placement/iu, `${name} carries no similarity, embedding, Evidence-overlap or geometry grounding`);
  }
  const authorization = authority.slice(authority.indexOf('export function authorizeSubjectGroundingHandles'));
  assert.ok(authorization.length > 0);
  assert.doesNotMatch(authorization, /subjectText|statement|startedSp|lastAttentionSp/u, 'authorization never reads wording, statements or Session Positions: only the handle set');
  assert.doesNotMatch(authority, /\.subjectText\.(?:includes|indexOf|match|search|startsWith|localeCompare)|subjectText\s*===\s*[a-z]/u, 'the universe parser validates the wording\'s shape and never compares it');
  assert.match(authority, /const allowed = new Set\(\(universe \?\? \[\]\)\.map\(\(entry\) => entry\.handle\)\);/u, 'authorization is set membership over the handles the server issued');
  assert.match(types, /export const MAX_SUBJECT_GROUNDING_CANDIDATES = 32;/u);
  assert.match(types, /export const MAX_SUBJECT_GROUNDINGS_PER_CANDIDATE = 8;/u);
  assert.match(generator, /eligibleSubjectGroundings: request\.eligibleSubjectGroundings\.map\(\(\{ handle, subjectText, startedSp, lastAttentionSp \}\) =>/u, 'the provider sees exactly the handle, the wording and the Session Positions');
  assert.match(generator, /items: \{ type: 'string', enum: \[\.\.\.handles\] \}/u, 'the provider schema enumerates exactly the issued handles');
  assert.match(generator, /grounded \? `\$\{INSTRUCTIONS\} \$\{SUBJECT_GROUNDING_INSTRUCTIONS\}` : INSTRUCTIONS/u, 'a request without a universe is the frozen request, byte for byte');
  // The wire and both decoders carry the grounding as a closed shape; the T-02 kernel (blob-pinned above) has no key for it.
  assert.match(runtimeIndex, /^\s*DisclosedSubjectGrounding,$/mu);
  assert.match(stripComments(runtimeHistorical), /export interface DisclosedSubjectGrounding \{\s*readonly emergingFocusId: string;\s*readonly groundedAtSp: number;\s*\}/u);
  assert.match(stripComments(runtimeHistorical), /readonly subjectGroundings: readonly DisclosedSubjectGrounding\[\];/u);
  assert.match(mapper, /const SUBJECT_GROUNDING_KEYS = \['emergingFocusId', 'groundedAtSp'\] as const;/u);
  assert.match(mapper, /grounded beyond TC/u);
  assert.match(mapper, /an Emerging Focus that is not known at TC/u);
  assert.match(mobileWire, /const SUBJECT_GROUNDING_KEYS = \['emergingFocusId', 'groundedAtSp'\] as const;/u);
  assert.match(read('apps/mobile/README.md'), /`subjectGroundings`/u);
  assert.doesNotMatch(stripComments(read('apps/mobile/src/state/actions.ts')), /grounding/iu, 'no Product action grounds anything');
});

test('deterministic identities: RFC 4122 v5 over the documented URIs, pinned in SQL and re-derived by the verifier; the migration and the verifier are wired into CI', () => {
  assert.match(migration, /'79466f6b-04fd-5150-aa23-59682098057c'/u);
  assert.match(migration, /'11be3a36-745a-54fd-a938-3f14eaedee14'/u);
  assert.match(migration, /https:\/\/qandeel\.app\/runtime\/historical-availability-event\/v1/u);
  assert.match(migration, /https:\/\/qandeel\.app\/runtime\/thread-reading-binding\/v1/u);
  assert.match(migration, /public\.canonical_uuid_v5_v1\(/u, 'the database derives through the frozen 0068 v5 authority');
  const verifier = read('database/verify-migration-0072.mjs');
  assert.match(verifier, /uuidV5\(RFC4122_URL_NAMESPACE, 'https:\/\/qandeel\.app\/runtime\/historical-availability-event\/v1'\)/u);
  assert.match(verifier, /uuidV5\(RFC4122_URL_NAMESPACE, 'https:\/\/qandeel\.app\/runtime\/thread-reading-binding\/v1'\)/u);
  assert.match(read('package.json'), /"test:historical-projection-contract": "node --test tests\/historical-projection-contract\.test\.mjs"/u);
  assert.match(read('package.json'), /"verify:historical-projection:integration": "node --env-file-if-exists=\.env database\/verify-migration-0072\.mjs"/u);
  assert.match(apiCi, /run: npm run test:historical-projection-contract/u);
  assert.match(apiCi, /run: npm run verify:historical-projection:integration/u);
  assert.ok(apiCi.indexOf('run: npm run test:historical-projection-contract') < apiCi.indexOf('Apply all migrations to fresh PostgreSQL'), 'the static contract runs before the migrations are applied');
  assert.ok(apiCi.indexOf('run: npm run verify:historical-projection:integration') > apiCi.indexOf('run: npm run verify:effective-live-focus-final-semantic-chain-cutover:integration'), 'the 0072 verifier runs after the 0071 verifier');
  // Every flow-mapping step name is comma-free (a comma inside `{name: ...}` fails the workflow at startup with no log).
  for (const line of apiCi.split('\n').filter((entry) => entry.includes('historical-projection'))) assert.doesNotMatch(line.slice(0, line.indexOf(', run:')), /,/u, `comma-free step name: ${line.trim()}`);
});

test('anti-scope: no Return-to-Live-Focus, no Go Live + Locate, no Map geometry, no Timeline window, no visual UI, no wall-clock comparison to TC, no new dependency, no lockfile change', () => {
  for (const forbidden of ['RETURN_TO_LIVE_FOCUS', 'GO_LIVE', 'goLive', 'Locate', 'locate', 'focusFollow', 'follow', 'camera', 'viewport', 'MAP_FOCUS', 'label', 'displayName', 'placeCanonicalHome', 'centrality',
    'expo-router', 'react-native', 'apps/mobile', 'WORLD_TRUTH_UPDATED', 'thread_enabled', 'analysis_enabled', 'semantic_version', 'lf_enabled', 'timelineWindow', 'neighborhood', 'Neighborhood']) {
    assert.equal(productionCode.includes(forbidden), false, `the runtime must not contain ${forbidden}`);
  }
  assert.doesNotMatch(productionCode, /expires_at\s*[<>]|expiresAt\s*[<>]|tc\s*[<>=]+\s*(?:now|Date)/u, 'no wall-clock comparison to TC anywhere on the server');
  assert.doesNotMatch(migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n'), /p_tc\s*[<>=]+\s*[^;]*(?:now\(\)|CURRENT_TIMESTAMP|expires_at)|expires_at\s*[<>=]+\s*p_tc/u, 'the migration never compares an expiry or a clock to TC');
  assert.deepEqual(Object.keys(rootPackage.devDependencies), ['pg']);
  for (const name of ['uuid', 'zod', 'p-retry', 'async-retry', 'retry', 'bottleneck', 'xstate', 'immer', 'rxjs-live', 'socket.io', 'ws', 'lru-cache']) {
    assert.equal(name in (apiPackage.dependencies ?? {}) || name in (apiPackage.devDependencies ?? {}) || name in (mobilePackage.dependencies ?? {}) || name in (mobilePackage.devDependencies ?? {}), false, `${name} must not be introduced`);
  }
  // T-04 re-anchor: the lockfile moved exactly once since, for the authorized Map renderer. The
  // pin stays exact, and T-03C still adds nothing to it.
  assert.equal(gitBlobId(read('package-lock.json')), 'c5b6e12cc45d32bd782b3a690179fedabde7169d', 'the lockfile carries only the authorized T-04 renderer beyond the T-03C baseline');
  assert.doesNotMatch(read('package-lock.json'), /historical-projection/u, 'the lockfile knows nothing of T-03C');
  assert.doesNotMatch(read('apps/api/src/app.module.ts'), /historical|projection/iu, 'AppModule is untouched: the controller lives in ConversationModule');
  assert.equal(gitBlobId(read('apps/api/src/app.module.ts')), 'fc3ce9c12b67552fb54214d0b6b4931b89601da6', 'AppModule is byte-identical');
});
