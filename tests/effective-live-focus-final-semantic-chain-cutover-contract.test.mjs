// T-03D - Effective Live Focus + FINAL Same-SP Semantic Chain + Production
// Authority Cutover v1: the static contract.
//
// Secret-free and CI-runnable. Behaviour is proven by the Jest suites under
// apps/api/src/live-focus and apps/mobile/src/temporal, and by the
// real-PostgreSQL 0071 verifier. This contract guards the SHAPE across the
// repository: the ONE authorized cutover (the FINAL B1 + B2 + B3 + LF chain is
// the live post-finalization authority, the temporary T-03A2-only writer is
// retired with no fallback, every superseded runtime stays unregistered), the
// frozen Live Focus constitution (NONE / EMERGING / THREAD, current live
// conversational attention only, a deterministic reducer with NO provider,
// the conservative departure), the frozen same-SP rule (B1 seq 1, the Thread
// layer at most one seq 2, an LF transition at seq 2 or 3, nothing for an
// unchanged LF), the additive wire, the passive client ingestion into the
// frozen T-02 kernel, and the anti-scope (no T-03C, no Return-to-Live-Focus,
// no visual UI, no new dependency).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isNativeImpactPath } from '../scripts/classify-mobile-native-impact.mjs';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const stripSql = (text) => text.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
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

const LF_DIR = 'apps/api/src/live-focus';
const MIGRATION = '0071_effective_live_focus_final_semantic_chain_cutover_v1.sql';
const LF_FILES = [
  'live-focus.types.ts',
  'live-focus-reducer.ts',
  'durable-live-focus-payload.types.ts',
  'durable-live-focus-canonicalizer.ts',
  'conversation-semantic-runtime.types.ts',
  'conversation-semantic-runtime-mapper.ts',
  'conversation-semantic-runtime.repository.ts',
  'live-focus-wire.ts',
  'conversation-semantic-establishment.service.ts',
];
const LF_SPECS = [
  'live-focus-reducer.spec.ts',
  'durable-live-focus-canonicalizer.spec.ts',
  'conversation-semantic-runtime-mapper.spec.ts',
  'conversation-semantic-runtime.repository.spec.ts',
  'live-focus-wire.spec.ts',
  'conversation-semantic-establishment.service.spec.ts',
];
const MOBILE_TEMPORAL_DIR = 'apps/mobile/src/temporal';

const migration = read(`database/migrations/${MIGRATION}`);
const executable = stripSql(migration);
const selfAssertionsAt = migration.indexOf('-- 15. Terminal self-assertions');
assert.ok(selfAssertionsAt > 0, 'the terminal self-assertion section exists');
const executableBody = stripSql(migration.slice(0, selfAssertionsAt));
const service = stripComments(read(`${LF_DIR}/conversation-semantic-establishment.service.ts`));
const repository = stripComments(read(`${LF_DIR}/conversation-semantic-runtime.repository.ts`));
const mapper = stripComments(read(`${LF_DIR}/conversation-semantic-runtime-mapper.ts`));
const runtimeTypes = read(`${LF_DIR}/conversation-semantic-runtime.types.ts`);
const reducer = stripComments(read(`${LF_DIR}/live-focus-reducer.ts`));
const lfTypes = read(`${LF_DIR}/live-focus.types.ts`);
const canonicalizer = read(`${LF_DIR}/durable-live-focus-canonicalizer.ts`);
const wire = read(`${LF_DIR}/live-focus-wire.ts`);
const productionCode = LF_FILES.map((name) => stripComments(read(`${LF_DIR}/${name}`))).join('\n');
const conversationModule = read('apps/api/src/conversation/conversation.module.ts');
const conversationService = read('apps/api/src/conversation/conversation.service.ts');
const temporalController = read('apps/api/src/conversation/conversation-temporal.controller.ts');
const deliveryRepository = read('apps/api/src/conversation-unit/temporal-delivery.repository.ts');
const establishment = read('apps/api/src/conversation-unit/conversation-temporal-establishment.service.ts');
const b3Service = read('apps/api/src/thread-lifecycle/conversation-thread-lifecycle-establishment.service.ts');
const runtimeIndex = read('packages/runtime/src/index.d.ts');
const runtimeTemporal = read('packages/runtime/src/temporal.d.ts');
const runtimeLiveFocus = read('packages/runtime/src/live-focus.d.ts');
const mobileWire = read(`${MOBILE_TEMPORAL_DIR}/temporal-wire.ts`);
const mobileApi = read(`${MOBILE_TEMPORAL_DIR}/temporal-api.ts`);
const mobileLfSync = stripComments(read(`${MOBILE_TEMPORAL_DIR}/live-focus-sync.ts`));
const mobileLhSync = read(`${MOBILE_TEMPORAL_DIR}/live-head-sync.ts`);
const mobileIndex = read(`${MOBILE_TEMPORAL_DIR}/index.ts`);
const rootPackage = readJson('package.json');
const apiPackage = readJson('apps/api/package.json');
const mobilePackage = readJson('apps/mobile/package.json');
const apiCi = read('.github/workflows/api-ci.yml');
const mobileCi = read('.github/workflows/mobile-ci.yml');

test('migration 0071 is the newest, 0064 - 0070 keep their exact pins, the delivered surface exists, and no split-task marker exists', () => {
  const migrations = readdirSync(join(rootPath, 'database/migrations')).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1), MIGRATION);
  assert.deepEqual(migrations.filter((name) => /0071_/u.test(name)), [MIGRATION], 'T-03D ships exactly ONE migration');
  for (const [file, blob] of [
    ['database/migrations/0064_committed_conversational_unit_substrate_v1.sql', '0a2ee63980e59072b3e9f52a643efa8220e95b08'],
    ['database/migrations/0065_session_semantic_clock_sp_lh_delivery_v1.sql', '3dc061c71bcb237cec648abb2d1fa02f450cd57f'],
    ['database/migrations/0066_durable_reference_emerging_focus_sp_substrate_v1.sql', '9f0588d5ca46329a8721ee30302f49d227a357ae'],
    ['database/migrations/0067_conversation_focus_runtime_integration_readiness_v1.sql', 'd12a3f552e80709ee1d20887f55f1c84e84f9208'],
    ['database/migrations/0068_durable_thread_home_same_sp_substrate_v1.sql', '5ea270424059acd40c0a6bf7dc040efc3aa693d3'],
    ['database/migrations/0069_thread_runtime_integration_readiness_v1.sql', 'fc2531a5a880f440b7086a3a63ba6557527413a7'],
    ['database/migrations/0070_thread_lifecycle_cross_session_continuity_v1.sql', '8436717bcf23877e1c1048b248b51717f5a9a8a6'],
  ]) {
    assert.equal(gitBlobId(read(file)), blob, `${file} is byte-identical`);
  }
  for (const file of ['database/verify-migration-0071.mjs', 'database/tests/effective-live-focus-final-semantic-chain-cutover-v1.test.mjs',
    'docs/effective-live-focus-final-semantic-chain-cutover-v1.md', 'packages/runtime/src/live-focus.d.ts', `${MOBILE_TEMPORAL_DIR}/live-focus-sync.ts`, `${MOBILE_TEMPORAL_DIR}/__tests__/live-focus-sync.test.ts`]) {
    assert.ok(existsSync(new URL(file, root)), `${file} exists`);
  }
  assert.match(read('docs/README.md'), /\[Effective Live Focus \+ Final Semantic-Chain Cutover v1\]\(effective-live-focus-final-semantic-chain-cutover-v1\.md\)/u);
  assert.match(read('apps/mobile/README.md'), /## Live Focus ingestion \(T-03D\)/u);
  // ONE Architecture-sized task: no T-03Da / T-03Db split marker anywhere in the delivered surface.
  const delivered = [migration, productionCode, read('database/verify-migration-0071.mjs'), read('docs/effective-live-focus-final-semantic-chain-cutover-v1.md')].join('\n');
  assert.doesNotMatch(delivered, /T-03D[a-z]\b|T-03D-[0-9]|\bD[ab]\b task|split task|sub-task|subtask/iu, 'T-03D is one task');
  // The frozen semantic authorities this chain RUNS are untouched.
  for (const [file, blob] of [
    ['apps/api/src/thread-establishment/thread-establishment-evaluator.service.ts', '8440bf21a042ced27c710eee06ea5e016f122e86'],
    ['apps/api/src/thread-establishment/conversation-thread-establishment.service.ts', '105f5097dc10bcb8e717b2ac1db6aed6618c4015'],
    ['apps/api/src/conversational-focus/conversation-focus-establishment.service.ts', '88455500c66585b8d40dd4077e185e669a398a89'],
    ['apps/api/src/conversational-focus/conversational-focus-evaluator.service.ts', '2a3044324a4655f3255ade554aec3b693616eef8'],
    ['apps/api/src/thread-lifecycle/thread-continuity-evaluator.service.ts', '023ad216c5db39438dffedae4ff615c82204b124'],
    ['apps/api/src/thread-lifecycle/thread-lifecycle-reducer.ts', 'a435a0746a20ca872dae3d623691837cfe05e2df'],
    ['apps/api/src/runtime-identity/uuid-v5.ts', '90d8f820a13f2b75f416448f881ebdbc8de12590'],
    ['apps/api/src/conversation-unit/conversation-unit.repository.ts', 'ceb86c3047067055c5a7b1b8699097f9e045a271'],
    ['apps/api/src/conversation-unit/conversation-temporal-establishment.service.ts', '6ddcaf4fcfdaa0c1c437cdad374a134e198b922e'],
    ['apps/api/src/app.module.ts', 'fc3ce9c12b67552fb54214d0b6b4931b89601da6'],
    // The T-03B3 walk is exported for reuse (its body is unchanged); pinned as the T-03D baseline.
    ['apps/api/src/thread-lifecycle/conversation-thread-lifecycle-establishment.service.ts', '4d9c55a59841bd007fa9825040bc2e99bc3d510a'],
  ]) {
    assert.equal(gitBlobId(read(file)), blob, `${file} is byte-identical to the T-03D baseline`);
  }
  assert.match(b3Service, /export class ThreadLayerWalk \{/u, 'the frozen T-03B3 Thread-layer walk is reused, never re-implemented');
  assert.doesNotMatch(productionCode, /class ThreadLayerWalk|continuityScreen|loadDossiers\(\) \{/u, 'no second Thread-layer walk');
});

test('the FINAL runtime exists as plain classes and pure modules; LF has NO provider, NO model and NO prompt (D-01)', () => {
  for (const name of [...LF_FILES, ...LF_SPECS]) assert.ok(existsSync(new URL(`${LF_DIR}/${name}`, root)), `${name} exists`);
  assert.deepEqual(listFiles(join(rootPath, LF_DIR)).map(relative).map((file) => file.slice(LF_DIR.length + 1)).sort(), [...LF_FILES, ...LF_SPECS].sort(),
    'the directory holds exactly the listed files: no index barrel, no provider adapter, no prompt, no config module');
  assert.match(service, /export class ConversationSemanticEstablishmentService \{/u);
  assert.match(repository, /export class ConversationSemanticRuntimeRepository implements ConversationSemanticRuntimeBoundary \{/u);
  assert.doesNotMatch(productionCode, /@Injectable\(|@Module\(|@Controller\(/u, 'no Nest decorator anywhere in the runtime');
  assert.equal((productionCode.match(/from '@nestjs\//gu) ?? []).length, 1, 'exactly one Nest import: the live boundary surfaces a retryable service-unavailable response');
  assert.match(service, /import \{ ServiceUnavailableException \} from '@nestjs\/common';/u);
  for (const name of ['live-focus-reducer.ts', 'durable-live-focus-canonicalizer.ts', 'live-focus.types.ts', 'durable-live-focus-payload.types.ts', 'live-focus-wire.ts']) {
    assert.doesNotMatch(stripComments(read(`${LF_DIR}/${name}`)), /\bawait\b|Promise|fetch\(|rpc\(|process\.env|Date\.now|new Date|Math\.random|setTimeout|setInterval|randomUUID/u, `${name} is pure`);
  }
  assert.match(reducer, /export function reduceLiveFocus\(input: LiveFocusReductionInput\): LiveFocusReduction/u);
  for (const forbidden of ['LiveFocusProvider', 'live-focus-provider', 'openAiLiveFocus', 'OpenAiLiveFocus', 'LIVE_FOCUS_PROMPT', 'live-focus-prompt', 'LiveFocusProposal', 'live_focus_model', 'lfModel', 'LiveFocusBinding']) {
    assert.equal(productionCode.includes(forbidden), false, `no LF provider, model, prompt or binding exists: ${forbidden}`);
  }
  assert.doesNotMatch(reducer, /provider|openai|fetch\(|rpc\(|prompt|embedding|similar|score|confidence|importance|centrality|Date\.|setTimeout|setInterval|elapsed|MapState|camera|viewport|inspection|analysis|reading|hypothes/iu,
    'the reducer reads no provider, no similarity, no importance, no time, no Map / camera / inspection and no analytical input');
  assert.match(stripComments(lfTypes), /export const LIVE_FOCUS_KINDS = Object\.freeze\(\['NONE', 'EMERGING', 'THREAD'\] as const\);/u, 'exactly three LF values');
  assert.match(stripComments(lfTypes), /export const LIVE_FOCUS_TRANSITION_REASONS = Object\.freeze\(\[\s*'NEW_INDEPENDENT_FOCUS',\s*'THREAD_PROMOTION',\s*'RETURN_TO_THREAD',\s*'FOCUS_REPLACEMENT',\s*'STABLE_DEPARTURE_NO_REPLACEMENT',\s*\] as const\);/u);
  assert.match(stripComments(lfTypes), /export const LIVE_FOCUS_REDUCER_VERSION = 'live-focus-reducer-v1';/u);
  assert.match(migration, /lf_reducer_version/u, 'the reducer version is captured as provenance');
  // LF-01 .. LF-04 in the TypeScript mirror.
  for (const rule of ["current.functions.includes('FOCUS_SHIFT')", "current.attention.reason !== 'LOCAL_CLARIFICATION_OR_CORRECTION'", '!anchoredToPrior(current, prior, semanticsByCuId, focusThreadBindings)',
    // R1-01 (B3 -> D same-Moment closure): a departure from a Thread is only as stable as the frozen lifecycle says.
    'departureIsStable(prior, priorThreadLifecycleState)', "return priorThreadLifecycleState === 'DORMANT';", "if (priorThreadLifecycleState === null) throw new LiveFocusRejectedError('LIVE_FOCUS_CONTEXT_NOT_CLOSED');",
    "const FOCUS_BEARING = Object.freeze(['START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS'] as const);", "const BOUND_OUTCOMES = Object.freeze(['ESTABLISH_NEW', 'ATTEND_EXISTING', 'ACTIVATE_EXISTING_IN_SESSION', 'REOPEN_EXISTING'] as const);",
    "if (effective.kind === 'NONE') return 'STABLE_DEPARTURE_NO_REPLACEMENT';", "if (prior.kind === 'NONE') return 'NEW_INDEPENDENT_FOCUS';",
    "if (prior.kind === 'EMERGING' && prior.emergingFocusId === current.attention.emerging_focus_id) return 'THREAD_PROMOTION';", "if (outcome === 'ESTABLISH_NEW') return 'FOCUS_REPLACEMENT';", "return 'RETURN_TO_THREAD';"]) {
    assert.ok(reducer.includes(rule), `the TypeScript reducer carries: ${rule}`);
  }
  // The SQL mirror (D-01) re-derives every CU; the TypeScript mirror reads no future CU.
  assert.match(migration, /CREATE FUNCTION public\.derive_conversation_effective_live_focus_v1\(p_cu public\.conversation_units\)/u);
  assert.match(migration, /derived FROM public\.derive_conversation_effective_live_focus_v1\(p_cu\);/u);
  assert.match(migration, /LIVE_FOCUS_NOT_CANONICAL/u);
  assert.doesNotMatch(reducer, /laterCus|nextCu|followingCus|futureCu/u);
});

test('the frozen same-SP rule: B1 seq 1, the Thread layer at most one seq 2, an LF transition at seq 2 or 3, nothing for an unchanged LF, no sealed SP reopened', () => {
  assert.match(migration, /session_position >= 1 AND same_sp_event_sequence IN \(2, 3\)/u);
  assert.match(migration, /reserved_sequence IS DISTINCT FROM 1::bigint/u);
  assert.match(migration, /reserved_sequence IS DISTINCT FROM 2::bigint/u);
  assert.match(migration, /reserved_sequence IS DISTINCT FROM \(CASE WHEN has_change THEN 3::bigint ELSE 2::bigint END\)/u);
  assert.match(migration, /IF lf_decision\.changed THEN/u, 'an unchanged LF reserves nothing');
  const writer = executable.slice(executable.indexOf('CREATE FUNCTION public.commit_conversation_units_with_full_semantic_chain_v1('), executable.indexOf('CREATE FUNCTION public.commit_finalized_exchange_with_full_semantic_chain_v1('));
  assert.equal((writer.match(/reserve_session_same_sp_event_v1/gu) ?? []).length, 3, 'the ONE 0065 seam, at most three reservations per CU');
  assert.doesNotMatch(executableBody, /same_sp_event_sequence \+ 1|CREATE SEQUENCE|nextval\(|same_sp_event_sequence = 4|IN \(2, 3, 4\)/u, 'no fourth sequence, no second sequence authority');
  const lfValidate = writer.indexOf('validate_conversation_live_focus_decision_v1(inserted_cu, lf_unit)');
  const lifecyclePersist = writer.indexOf('persist_conversation_thread_lifecycle_layer_v1(inserted_cu, p_batch_id, lifecycle, reserved_sequence)');
  const nextCu = writer.indexOf('END LOOP;', lfValidate);
  assert.ok(lifecyclePersist > 0 && lfValidate > lifecyclePersist && nextCu > lfValidate, 'LF is derived AFTER the FINAL Thread-layer truth of the same CU and BEFORE the next CU advances the clock');
  assert.match(migration, /SET current_sp = this_sp, same_sp_event_sequence = 0/u);
  assert.doesNotMatch(executableBody, /current_sp = this_sp - 1|current_sp - 1|SET session_position|UPDATE public\.conversation_units|UPDATE public\.conversation_live_focus/u, 'no sealed SP is reopened or backdated');
  // The service mirrors the order: walk THEN reduce, the binding of this CU visible to its own LF, later CUs isolated.
  const loop = service.indexOf('for (const [index, cu] of sequence.entries()) {');
  const walk = service.indexOf('const step = await walk.evaluate(cu, bundle);', loop);
  const binding = service.indexOf('focusThreadBindings.set(step.decision.emergingFocusId, step.decision.threadId);', loop);
  const reduce = service.indexOf('const reduction = reduceLiveFocus({', loop);
  const chain = service.indexOf('liveFocus = reduction.effective;', loop);
  const later = service.indexOf('semanticsByCuId.set(cu.cuId, bundle);', loop);
  assert.ok(loop > 0 && walk > loop && binding > walk && reduce > binding && chain > reduce && later > chain,
    'per CU: the frozen Thread-layer walk -> this CU\'s binding visible -> the LF reduction -> the LF of CU i becomes the prior LF of CU i+1 -> only then does this CU\'s bundle join the history');
  assert.match(service, /priorLiveFocus: liveFocus,/u);
  assert.match(service, /let liveFocus: EffectiveLiveFocus = context\.currentLiveFocus;/u, 'the prior LF of the first CU is the context\'s current LF');
  // R1-01: the frozen B3 lifecycle states, advanced by THIS CU's own transitions before its LF is reduced, feed the departure gate.
  assert.match(service, /const threadStates = sessionThreadStates\(context\);/u);
  const states = service.indexOf('for (const transition of step.decision.transitions) threadStates.set(transition.threadId, transition.toState);', loop);
  assert.ok(states > walk && states < reduce, 'this CU\'s Thread-layer transitions are applied to the lifecycle states before its LF reduction');
  assert.match(service, /priorThreadLifecycleState: liveFocus\.kind === 'THREAD' \? threadStates\.get\(liveFocus\.threadId\) \?\? null : null,/u);
  assert.match(migration, /departure_stable := prior_kind <> 'THREAD'\s*\n\s*OR public\.conversation_thread_session_lifecycle_state_v1\(prior_ref, p_cu\.session_id, p_cu\.session_position \+ 1\) = 'DORMANT';/u,
    'the SQL mirror gates the departure on the same frozen lifecycle state after the same Moment');
  assert.match(migration, /LIVE_FOCUS_DEPARTURE_LIFECYCLE_CONTRADICTION/u);
  assert.doesNotMatch(service.slice(loop), /sequence\[index \+ 1\]|sequence\.slice\(index \+ 1\)/u, 'no later CU alters an earlier LF');
});

test('THE CUTOVER: ONLY the FINAL chain is wired, the temporary T-03A2-only writer is retired with no fallback, every superseded runtime stays unregistered', () => {
  // ConversationService: every orchestrated path re-enters the FINAL chain; nothing temporal-only remains.
  assert.match(conversationService, /private readonly semantic: ConversationSemanticEstablishmentService/u);
  assert.match(conversationService, /return this\.establishSemanticChain\(userId, await this\.orchestrator\.orchestrate\(/u);
  assert.equal((stripComments(conversationService).match(/this\.establishSemanticChain\(/gu) ?? []).length, 3);
  assert.equal((stripComments(conversationService).match(/this\.orchestrator\.orchestrate\(/gu) ?? []).length, 3);
  assert.doesNotMatch(stripComments(conversationService), /ConversationTemporalEstablishmentService|establishTemporal|ConversationFocusEstablishmentService|ConversationThreadEstablishmentService|ConversationThreadLifecycleEstablishmentService|ConversationUnitRepository|catch \(\w+\) \{[^}]*temporal/u,
    'no temporal-only, B1-only, B1+B2-only or B3-only path and no fallback catch');
  // ConversationModule: the FINAL service, its service-role repository and the four lazy binding FACTORIES, nothing superseded.
  const moduleCode = stripComments(conversationModule);
  assert.match(moduleCode, /provide: ConversationSemanticEstablishmentService,/u);
  assert.match(moduleCode, /provide: ConversationSemanticRuntimeRepository,/u);
  assert.match(moduleCode, /new ConversationSemanticRuntimeRepository\(serviceApi\)/u, 'the FINAL repository runs as service_role');
  assert.match(moduleCode, /\{ provide: CU_SEGMENTATION_BINDING_FACTORY, useValue: openAiSegmentationBinding \}/u, 'the segmentation FACTORY, never its product');
  assert.match(moduleCode, /\{ provide: FOCUS_RESOLUTION_BINDING_FACTORY, useValue: openAiFocusResolutionBinding\(\) \}/u);
  assert.match(moduleCode, /\{ provide: THREAD_ESTABLISHMENT_BINDING_FACTORY, useValue: openAiThreadEstablishmentBinding\(\) \}/u);
  assert.match(moduleCode, /\{ provide: THREAD_CONTINUITY_BINDING_FACTORY, useValue: openAiThreadContinuityBinding\(\) \}/u);
  assert.doesNotMatch(moduleCode, /ConversationTemporalEstablishmentService|ConversationUnitRepository|ConversationFocusEstablishmentService|ConversationFocusRuntimeRepository|ConversationThreadEstablishmentService|ConversationThreadRuntimeRepository|ConversationThreadLifecycleEstablishmentService|ConversationThreadLifecycleRuntimeRepository/u,
    'no superseded runtime and no temporal-only fallback is registered');
  assert.doesNotMatch(moduleCode, /OpenAiFocusResolutionProvider|OpenAiThreadEstablishmentProvider|OpenAiThreadContinuityProvider|loadFocusResolutionOpenAIConfig|loadThreadEstablishmentOpenAIConfig|loadThreadContinuityOpenAIConfig/u,
    'no provider adapter and no credential is constructed at bootstrap');
  assert.match(conversationModule, /controllers: \[ConversationController, ConversationContextActivationController, ConversationTemporalController\]/u);
  // The FINAL repository: exactly the two 0071 reads, the 0070 dossier page and the ONE 0071 coordinator.
  for (const rpc of ["'get_conversation_full_semantic_integrated_batch_snapshot_v1'", "'get_conversation_full_semantic_runtime_context_v1'", "'get_conversation_thread_identity_dossier_page_v1'", "'commit_finalized_exchange_with_full_semantic_chain_v1'"]) {
    assert.ok(repository.includes(rpc), `the repository calls ${rpc}`);
  }
  assert.equal((repository.match(/this\.serviceApi\.rpc</gu) ?? []).length, 4, 'exactly four RPC call sites');
  assert.doesNotMatch(productionCode, /commit_conversation_units_v1|commit_finalized_exchange_conversation_units_v1|with_focus_v1|with_focus_and_thread_v1|with_focus_thread_lifecycle_v1|commit_conversation_units_with_full_semantic_chain_v1/u,
    'no legacy, predecessor or per-batch writer is ever called from the runtime');
  // The T-03A2 delivery reads: the snapshot now comes from the authenticated LF snapshot read; the LF catch-up read exists beside the committed-CU one.
  for (const rpc of ["'rpc/get_session_live_state_v1'", "'rpc/get_conversational_units_committed_events_v1'", "'rpc/get_live_focus_transition_events_v1'"]) {
    assert.ok(deliveryRepository.includes(rpc), `the delivery repository calls ${rpc}`);
  }
  assert.doesNotMatch(deliveryRepository, /get_session_temporal_state_v1/u, 'the LH + LF snapshot replaces the LH-only read on the API');
  const controller = stripComments(temporalController);
  assert.match(controller, /@Get\('sessions\/:sessionId\/temporal\/live-focus-events'\)/u);
  assert.equal((controller.match(/@Get\(|@Post\(|@Patch\(|@Put\(|@Delete\(/gu) ?? []).length, 3, 'exactly three read routes: snapshot, committed-CU catch-up, LF catch-up');
  assert.match(controller, /@UseGuards\(SupabaseAuthGuard\)/u);
  assert.doesNotMatch(controller, /WebSocket|Sse|@Sse|EventEmitter|observable|\/timeline|\/history|\/projection|\/locate|\/return/u);
  // Database: exactly one committing function for service_role, the T-03A2 writers revoked, the LF reads opened.
  const cutover = executable.slice(executable.indexOf('ALTER TABLE public.conversation_live_focus_transitions OWNER TO postgres;'), selfAssertionsAt > 0 ? executable.length : undefined);
  assert.match(cutover, /GRANT EXECUTE ON FUNCTION public\.commit_finalized_exchange_with_full_semantic_chain_v1\([^)]*\) TO service_role/u);
  assert.match(cutover, /REVOKE ALL ON FUNCTION public\.commit_conversation_units_v1\([^)]*\) FROM service_role/u);
  assert.match(cutover, /REVOKE ALL ON FUNCTION public\.commit_finalized_exchange_conversation_units_v1\([^)]*\) FROM service_role/u);
  assert.match(cutover, /GRANT EXECUTE ON FUNCTION public\.get_session_live_state_v1\(uuid\) TO authenticated;/u);
  assert.match(cutover, /GRANT EXECUTE ON FUNCTION public\.get_live_focus_transition_events_v1\(uuid,integer,integer\) TO authenticated;/u);
  assert.match(migration, /exactly ONE committing function is executable by service_role after T-03D/u);
  assert.doesNotMatch(executable, /GRANT EXECUTE ON FUNCTION public\.(?:commit_conversation_units_with_focus|commit_finalized_exchange_with_focus|commit_conversation_units_with_full_semantic_chain_v1|reserve_session_same_sp_event_v1)/u,
    'no predecessor writer, the per-batch writer or the seam is granted');
  assert.doesNotMatch(executable, /GRANT [^;]*TO anon|GRANT [^;]*TO PUBLIC/u);
  // The migration itself backfills nothing and alters no frozen table.
  const topLevel = executableBody.replace(/\$\$[\s\S]*?\$\$/gu, '');
  assert.doesNotMatch(topLevel, /INSERT INTO|UPDATE public|DELETE FROM|TRUNCATE/u, 'no semantic backfill, update or delete at migration time');
  assert.doesNotMatch(executableBody, /ALTER TABLE public\.(?:conversation_units|conversation_threads|conversation_thread_homes|conversation_emerging_focuses|session_semantic_clocks|conversation_thread_focus_bindings|conversation_thread_semantic_unit_results)\b/u);
  assert.doesNotMatch(executable, /CREATE OR REPLACE|DROP /u);
});

test('bounded recovery: ONE shared semantic retry over BOTH exact stale tokens, the database winner first, no resegmentation, no third stale authority', () => {
  assert.match(runtimeTypes, /export const MAX_SEMANTIC_STALE_CONTEXT_RETRIES = 1;/u);
  assert.match(service, /let retriesLeft = MAX_SEMANTIC_STALE_CONTEXT_RETRIES;/u);
  assert.match(service, /const stale = error instanceof StaleConversationalFocusContextError \|\| error instanceof StaleThreadIdentityContextError;\s*if \(!stale\) throw error;/u);
  assert.match(service, /if \(retriesLeft === 0\) throw new ConversationSemanticUnavailableError\('STALE_CONTEXT_RETRY_EXHAUSTED'/u);
  assert.equal((service.match(/retriesLeft -= 1;/gu) ?? []).length, 1);
  const loop = service.indexOf('for (;;) {');
  assert.ok(service.indexOf('const halves = await Promise.all([userHalf, assistantHalf]);') < loop, 'segmentation happens once, before the retry loop');
  assert.ok(service.indexOf('const winner = this.canonicalDelivery(userTurn.session_id, fresh);', loop) < service.indexOf('if (!stale) throw error;', loop), 'the database winner is checked BEFORE the stale branch');
  assert.doesNotMatch(service.slice(loop), /this\.segment\(/u, 'no segmentation inside the retry loop');
  assert.match(service, /SEGMENTATION_FRONTIER_MOVED/u);
  assert.ok(service.indexOf('context = await this.repository.readRuntimeContext(', loop) > loop, 'the retry re-reads the context (and, through it, the identity version, the dossiers and the current LF)');
  assert.match(repository, /import \{ isStaleConversationalFocusContext \} from '\.\.\/conversational-focus\/conversation-focus-runtime\.repository';/u);
  assert.match(repository, /import \{ isStaleThreadIdentityContext \} from '\.\.\/thread-lifecycle\/conversation-thread-lifecycle-runtime\.repository';/u);
  assert.doesNotMatch(repository, /\.includes\(|new RegExp|startsWith\(/u, 'exact equality, never a substring');
  assert.doesNotMatch(productionCode, /STALE_LIVE_FOCUS|StaleLiveFocus|LIVE_FOCUS_STALE|liveFocusVersion|lf_version/u, 'LF introduces no third stale authority');
  assert.equal((executable.match(/USING ERRCODE='40001'/gu) ?? []).length, 2, 'exactly two exact typed stale conditions in the database');
  for (const reason of ['INVALID_FINALIZED_EXCHANGE_RELATION', 'PARTIAL_INTEGRATED_EXCHANGE', 'INCOMPLETE_FULL_SEMANTIC_CAPTURE', 'INVALID_INTEGRATED_SNAPSHOT', 'INVALID_SEMANTIC_RUNTIME_CONTEXT',
    'LIVE_FOCUS_CONTEXT_NOT_CLOSED', 'LIVE_FOCUS_NOT_CANONICAL', 'LIVE_FOCUS_DELIVERY_MISMATCH', 'FOCUS_SEMANTICS_MISMATCH', 'PROVENANCE_DISAGREEMENT', 'COMMITTED_WITHOUT_DELIVERY_EVENT',
    'DELIVERY_RANGE_MISMATCH', 'LIVE_HEAD_NOT_ESTABLISHED', 'SEGMENTATION_FRONTIER_MOVED']) {
    assert.ok(runtimeTypes.includes(reason), `the integrity vocabulary includes ${reason}`);
  }
  for (const reason of ['PROVIDER_UNAVAILABLE', 'TRANSPORT_UNAVAILABLE', 'STALE_CONTEXT_RETRY_EXHAUSTED']) assert.ok(runtimeTypes.includes(reason));
  assert.doesNotMatch(productionCode, /failTurn|FAILED|regenerat|markFailed/u, 'a technical failure never fails or regenerates a completed turn');
  // The replay / partial gate precedes the context read; the context precedes any provider; the relation gate is first and outside the try.
  assert.match(service, /async establishExchange\(userId: string, userTurn: ConversationTurn, assistantTurn: ConversationTurn\): Promise<ConversationLiveDelivery> \{\s*assertFinalizedExchangeRelation\(userTurn, assistantTurn\);\s*try \{/u);
  assert.ok(service.indexOf('const replayed = this.canonicalDelivery(userTurn.session_id, snapshots);') < service.indexOf('await this.repository.readRuntimeContext('));
  assert.ok(service.indexOf('await this.repository.readRuntimeContext(') < service.indexOf('this.segment(userId, userTurn'));
  for (const rule of ["if (user.full_semantic_capture_state === 'PARTIAL' || assistant.full_semantic_capture_state === 'PARTIAL') {",
    "if (user.full_semantic_capture_state === 'ABSENT' && assistant.full_semantic_capture_state === 'ABSENT') return undefined;",
    "if (user.full_semantic_capture_state !== 'COMPLETE' || assistant.full_semantic_capture_state !== 'COMPLETE') {"]) {
    assert.ok(service.includes(rule), `the replay gate enforces: ${rule}`);
  }
  assert.doesNotMatch(mapper, /full_semantic_capture_state: '(?:ABSENT|COMPLETE|PARTIAL)'|full_semantic_capture_state = /u, 'the mapper never rewrites the capture state');
  assert.doesNotMatch(mapper, /\.filter\(\(entry\)|delete /u, 'invalid context is rejected, never filtered');
  // The lazy bindings: nothing is constructed at construction, no credential is read in the runtime.
  const constructorEnd = service.indexOf('async establish(');
  assert.doesNotMatch(service.slice(0, constructorEnd), /createContinuityBinding\(\)|createThreadBinding\(\)|createFocusBinding\(\)|createSegmentationBinding\(\)|process\.env/u);
  for (const lazy of ['this.segmentation ??= this.createSegmentationBinding();', 'this.focus ??= this.createFocusBinding();', 'this.thread ??= this.createThreadBinding();', 'this.continuity ??= this.createContinuityBinding();']) {
    assert.ok(service.includes(lazy), `lazy: ${lazy}`);
  }
  assert.doesNotMatch(productionCode, /OPENAI_API_KEY|process\.env\./u);
});

test('the wire is additive and closed: the LF reference identity and its effective SP, the frozen T-03A2 fields untouched, no label / Home / sequence / content', () => {
  const files = listFiles(join(rootPath, 'packages/runtime')).map(relative).sort();
  assert.deepEqual(files, ['packages/runtime/README.md', 'packages/runtime/package.json', 'packages/runtime/src/index.d.ts', 'packages/runtime/src/live-focus.d.ts', 'packages/runtime/src/temporal.d.ts']);
  assert.equal(gitBlobId(read('packages/runtime/package.json')), '932b837629f23b5cb765eda196fb659418d07916', 'the type-only package declaration is byte-identical');
  const lf = stripComments(runtimeLiveFocus);
  assert.match(lf, /export type LiveFocusTransitionType = 'LIVE_FOCUS_TRANSITION';/u);
  assert.match(lf, /export type LiveFocusWireValue =\s*\|\s*\{ readonly kind: 'NONE' \}\s*\|\s*\{ readonly kind: 'EMERGING'; readonly emergingFocusId: string \}\s*\|\s*\{ readonly kind: 'THREAD'; readonly threadId: string \};/u,
    'exactly three LF values, each with exactly its reference identity');
  assert.match(lf, /export interface LiveFocusTransitionWireEvent \{\s*readonly type: LiveFocusTransitionType;\s*readonly version: 1;\s*readonly sessionId: string;\s*readonly atSp: number;\s*readonly value: LiveFocusWireValue;\s*\}/u);
  const wireCode = stripComments(`${runtimeTemporal}\n${runtimeIndex}\n${runtimeLiveFocus}`);
  for (const forbidden of ['label', 'name:', 'title', 'home', 'Home', 'direction', 'relationCount', 'confidence', 'importance', 'score', 'rank', 'content', 'committedText', 'text:', 'sameSp', 'eventSequence', 'sequence',
    'reason', 'projection', 'knowledge', 'PRE_FIRST_SP', 'timestamp', 'createdAt', 'locat', 'lifecycle', 'dormant', 'binding', 'origin', 'EMERGING_FOCUS', 'ESTABLISHED_THREAD']) {
    assert.equal(wireCode.includes(forbidden), false, `the wire must not carry ${forbidden}`);
  }
  assert.match(runtimeTemporal, /export interface SessionTemporalSnapshot \{\s*readonly sessionId: string;\s*readonly liveHead: number \| null;\s*readonly liveFocus: LiveFocusWireValue;\s*readonly liveFocusAtSp: number \| null;\s*\}/u);
  assert.match(runtimeTemporal, /export interface ConversationTemporalDelivery \{\s*readonly liveHead: number \| null;\s*readonly committedEvents: readonly ConversationalUnitsCommittedWireEvent\[\];\s*\}/u, 'the T-03A2 delivery keeps exactly its two frozen fields');
  assert.match(runtimeTemporal, /export interface ConversationLiveDelivery extends ConversationTemporalDelivery \{\s*readonly liveFocus: LiveFocusWireValue;\s*readonly liveFocusTransitions: readonly LiveFocusTransitionWireEvent\[\];\s*\}/u);
  assert.match(runtimeIndex, /from '\.\/live-focus'/u);
  assert.match(stripComments(wire), /export const LIVE_FOCUS_TRANSITION = 'LIVE_FOCUS_TRANSITION';/u);
  assert.match(stripComments(wire), /export const LIVE_FOCUS_TRANSITION_VERSION = 1;/u);
  assert.doesNotMatch(stripComments(wire), /same_sp_event_sequence|sessionPosition: transition\.sessionPosition, sequence|reason_code|label/u);
  // Every consumer imports the shared contract as a type only.
  for (const path of ['apps/api/src/conversation-unit/temporal-delivery.repository.ts', 'apps/api/src/conversation/conversation-temporal.controller.ts', 'apps/api/src/conversation/conversation.types.ts',
    `${LF_DIR}/live-focus-wire.ts`, `${LF_DIR}/conversation-semantic-establishment.service.ts`, `${MOBILE_TEMPORAL_DIR}/temporal-wire.ts`, `${MOBILE_TEMPORAL_DIR}/temporal-api.ts`, `${MOBILE_TEMPORAL_DIR}/live-focus-sync.ts`, `${MOBILE_TEMPORAL_DIR}/index.ts`]) {
    const source = stripComments(read(path));
    for (const match of source.matchAll(/^(export\s+)?import(\s+type)?\s[^\n]*'@qandeel\/runtime'/gmu)) assert.match(match[0], /import type|export type/u, `${path} imports @qandeel/runtime as a type`);
    for (const match of source.matchAll(/^export\s+(type\s+)?\{[\s\S]*?\}\s+from\s+'@qandeel\/runtime'/gmu)) assert.match(match[0], /export type/u, `${path} re-exports @qandeel/runtime as types`);
  }
  // The delivery is proven coherent before it leaves, and carries reference identity only.
  const delivery = service.slice(service.indexOf('private delivery('), service.indexOf('private async segment('));
  assert.ok(delivery.includes("throw new ConversationSemanticIntegrityError('LIVE_FOCUS_DELIVERY_MISMATCH')"));
  assert.match(delivery, /return \{ liveHead, liveFocus: toLiveFocusWireValue\(liveFocus\), committedEvents: ordered, liveFocusTransitions \};/u);
  assert.doesNotMatch(delivery.replace(/ConversationSemanticIntegrityError/gu, ''), /thread_|origin|home|emerging_focus|lifecycle|binding|dormant|reopen|reason|label/iu);
});

test('the client ingests LF passively into the frozen T-02 kernel through the ONE seam: no LF write, no Product action, no camera, no follow, no kernel or shell change', () => {
  const dir = join(rootPath, MOBILE_TEMPORAL_DIR);
  const production = listFiles(dir).filter((file) => !file.includes(join(dir, '__tests__'))).map((file) => file.slice(dir.length + 1).replace(/\\/gu, '/')).sort();
  assert.deepEqual(production, ['index.ts', 'live-focus-sync.ts', 'live-head-sync.ts', 'temporal-api.ts', 'temporal-wire.ts']);
  assert.deepEqual(readdirSync(join(dir, '__tests__')).filter((file) => /\.test\.tsx?$/u.test(file)).sort(), ['live-focus-sync.test.ts', 'live-head-sync.test.ts', 'temporal-api.test.ts', 'temporal-wire.test.ts']);
  assert.match(mobileLfSync, /store\.ingest\(\{ type: 'LIVE_FOCUS_TRANSITION', value: toMirrorLiveFocus\(event\.value\), atSp: sessionPosition\(atSp\) \}\)/u);
  assert.equal((mobileLfSync.match(/store\.ingest\(/gu) ?? []).length, 1, 'exactly one ingestion call site');
  assert.equal((mobileLfSync.match(/\.dispatch\(/gu) ?? []).length, 0, 'no Product action is ever dispatched');
  assert.match(mobileLfSync, /case 'EMERGING':\s*return \{ kind: 'EMERGING_FOCUS', emergingFocusId: value\.emergingFocusId \};/u);
  assert.match(mobileLfSync, /case 'THREAD':\s*return \{ kind: 'ESTABLISHED_THREAD', threadId: value\.threadId \};/u);
  assert.match(mobileLfSync, /error instanceof OutOfOrderTransition\) return \{ outcome: 'OUT_OF_ORDER', atSp \}/u, 'a lower or conflicting SP is CLASSIFIED, never applied backward');
  assert.match(mobileLfSync, /event\.sessionId !== state\.session\.id/u, 'a cross-Session delivery is refused');
  for (const forbidden of ['live.LF =', 'live.LH =', 'LIVE_HEAD_ADVANCED', 'history.push', 'captureCheckpoint', 'RhEntry', 'camera', 'anchor:', 'scale:', 'PAN', 'ZOOM', 'COMMIT_MOMENT', 'COMMIT_LIVE_EDGE',
    'follow', 'RETURN_TO_LIVE_FOCUS', 'GO_LIVE', 'LOCATE', 'locate', 'label', 'home', 'setTimeout', 'setInterval', 'Date.now']) {
    assert.equal(mobileLfSync.includes(forbidden), false, `the LF seam must not touch ${forbidden}`);
  }
  assert.doesNotMatch(stripComments(mobileLhSync), /LIVE_FOCUS_TRANSITION|liveFocus|LF/u, 'the LH seam never learned about LF');
  assert.equal(gitBlobId(mobileLhSync), '77ec84982d9202c81152907ac6844af1d3e18883', 'the T-03A2 LH seam is byte-identical');
  for (const decoder of ['decodeLiveFocusWireValue', 'decodeLiveFocusTransitionEvent', 'decodeLiveFocusEventsPage', 'decodeLiveFocusEventsResponse']) {
    assert.match(mobileWire, new RegExp(`export function ${decoder}\\(`, 'u'));
    assert.ok(mobileIndex.includes(decoder), `${decoder} is exported`);
  }
  assert.match(mobileWire, /\| 'INVALID_LIVE_FOCUS';/u);
  assert.match(mobileWire, /const SNAPSHOT_KEYS = \['sessionId', 'liveHead', 'liveFocus', 'liveFocusAtSp'\] as const;/u);
  assert.match(mobileWire, /const LIVE_FOCUS_EVENT_KEYS = \['type', 'version', 'sessionId', 'atSp', 'value'\] as const;/u, 'exact keys, no label, no sequence');
  assert.match(mobileApi, /async fetchLiveFocusEvents\(/u);
  assert.equal((mobileApi.match(/assertRequestedSession\(sessionId, /gu) ?? []).length, 3, 'the LF route binds the requested Session too');
  const mobileText = [mobileWire, mobileApi, read(`${MOBILE_TEMPORAL_DIR}/live-focus-sync.ts`), mobileLhSync, mobileIndex].map(stripComments).join('\n');
  for (const forbidden of ['expo-router', 'useRouter', 'usePathname', '<Link', 'react-native', 'View', 'AsyncStorage', 'SecureStore', 'MMKV', 'SQLite', 'localStorage', 'persist(', 'EXPO_PUBLIC_', 'process.env', 'WebSocket', 'EventSource']) {
    assert.equal(mobileText.includes(forbidden), false, `the mobile temporal boundary must not reference ${forbidden}`);
  }
  for (const [name, text] of [['temporal-wire.ts', mobileWire], ['temporal-api.ts', mobileApi], ['live-focus-sync.ts', read(`${MOBILE_TEMPORAL_DIR}/live-focus-sync.ts`)], ['index.ts', mobileIndex]]) {
    for (const specifier of [...stripComments(text).matchAll(/from\s+'([^']+)'/gu)].map((m) => m[1])) {
      if (!specifier.startsWith('.')) assert.equal(specifier, '@qandeel/runtime', `${name} imports ${specifier}; only @qandeel/runtime and relative modules are allowed`);
    }
  }
  // The T-02 kernel, the shell and the router root are byte-identical; nothing is mounted.
  for (const [file, blob] of [
    ['apps/mobile/src/state/actions.ts', '0fa63f31ebeb47575244e827d7ffd2090eec090c'],
    ['apps/mobile/src/state/authority.ts', '1920ec550ad7b3b8eca02fb690f790654ce4609a'],
    ['apps/mobile/src/state/classes.ts', 'f0d17c675c148e26c523291e07769c3ed764f263'],
    ['apps/mobile/src/state/history.ts', 'e12caa557ab719611d11e43392723a1bb2389c62'],
    ['apps/mobile/src/state/index.ts', 'a70c2d61d112f62dfa11cc7209b35d0466eb4141'],
    ['apps/mobile/src/state/selectors.ts', '72c156c298c5914a578fd41f3243c7bb596756ae'],
    ['apps/mobile/src/state/store.ts', '8933e3ef05c10bd28a748cc4896871c8e50e658e'],
    ['apps/mobile/src/state/transitions.ts', 'a078c6bc025b8c6ea9bdd321d2f03c1fcbe5c0ef'],
    ['apps/mobile/src/state/CanonicalStateProvider.tsx', 'b7ea8b6e775f74f7d331843e4783dc7291b11b49'],
    ['apps/mobile/src/shell/FoundationShell.tsx', 'e2286ba1a35c2e40def475af5deed2d8ba8120d3'],
    ['apps/mobile/src/app/_layout.tsx', '90179f6d13026e9b0e2345e0418012214b9c9aab'],
    ['apps/mobile/src/app/index.tsx', 'ef38d10c76a957163bf00f7b7b60fb8aa25841f4'],
  ]) {
    assert.equal(gitBlobId(read(file)), blob, `${file} is byte-identical: the kernel, the shell and the router root are untouched`);
  }
  for (const file of ['apps/mobile/src/app/_layout.tsx', 'apps/mobile/src/app/index.tsx', 'apps/mobile/src/shell/FoundationShell.tsx']) {
    assert.doesNotMatch(read(file), /temporal|live-focus|LiveFocus|TemporalApiClient/u, `${file} mounts nothing temporal`);
  }
  // Native CI RUNS for this change: the mobile source change is a native-impact path by the frozen MOB-CI-01 classifier.
  assert.equal(isNativeImpactPath(`${MOBILE_TEMPORAL_DIR}/live-focus-sync.ts`), true, 'the Android / iOS smoke gates run for T-03D');
  assert.equal(gitBlobId(mobileCi), '8efe44a2d2e95688c7612a2429b8f3ab106ecb8c', 'mobile-ci.yml is byte-identical (MOB-CI-01 preserved)');
  assert.equal(gitBlobId(read('apps/mobile/package.json')), 'a259368e87baeca24d7374dd922d866bbe6a6f88', 'the mobile package declaration is byte-identical');
});

test('deterministic identities: RFC 4122 v5 over the documented URI, derived in TypeScript and re-derived by the database; payload exact', () => {
  assert.match(canonicalizer, /import \{ CANONICAL_UUID_PATTERN, RFC4122_URL_NAMESPACE, uuidV5 \} from '\.\.\/runtime-identity\/uuid-v5';/u);
  assert.match(canonicalizer, /export const LIVE_FOCUS_TRANSITION_NAMESPACE = uuidV5\(RFC4122_URL_NAMESPACE, 'https:\/\/qandeel\.app\/runtime\/live-focus-transition\/v1'\);/u);
  assert.match(canonicalizer, /`\$\{sessionId\}:\$\{cuId\}:\$\{to\.kind\}:\$\{ref \?\? 'NONE'\}`/u);
  assert.match(migration, /'14cd67f4-be9d-54f6-b735-cbe38a7cb311'/u, 'the LF namespace is pinned in SQL');
  assert.match(migration, /p_session_id::text \|\| ':' \|\| p_cu_id::text \|\| ':' \|\| p_to_kind \|\| ':' \|\| COALESCE\(p_to_ref::text, 'NONE'\)/u);
  assert.match(migration, /public\.canonical_uuid_v5_v1\(/u, 'the database re-derives through the frozen 0068 v5 authority');
  assert.doesNotMatch(productionCode, /randomUUID|crypto\.randomUUID|uuidv4|v4\(\)/u, 'no random identity anywhere in the runtime');
  const payload = stripComments(read(`${LF_DIR}/durable-live-focus-payload.types.ts`));
  assert.match(payload, /readonly unit_id: string;\s*readonly effective_kind: LiveFocusKind;\s*readonly effective_ref: string \| null;\s*readonly transition: boolean;\s*readonly reason_code: LiveFocusTransitionReason \| null;\s*readonly transition_event_id: string \| null;/u,
    'the payload is exactly the six frozen keys: no from value, no SP, no sequence, no label');
  assert.match(canonicalizer, /if \(JSON\.stringify\(units\)\.includes\('prepared:'\)\) throw fail\('PREPARED_IDENTITY_LEAKED', null\);/u);
  assert.match(migration, /CANONICAL_LIVE_FOCUS_ROW_IS_IMMUTABLE/u);
});

test('no T-03C, no Return-to-Live-Focus / Go Live + Locate, no visual UI, no LF label / Home / content, no new dependency, no lockfile change', () => {
  for (const forbidden of ['knowledgeFrontier', 'knowledge_frontier', 'PRE_FIRST_SP', 'historical', 'projection', 'Projection', 'K(TC)', 'neighborhood', 'Neighborhood', 'Reading', 'reading_id',
    'RETURN_TO_LIVE_FOCUS', 'GO_LIVE', 'goLive', 'Locate', 'locate', 'focusFollow', 'follow', 'camera', 'viewport', 'inspection', 'MAP_FOCUS', 'label', 'displayName', 'home_anchor', 'homeAnchor', 'placement',
    'importance', 'confidence', 'centrality', 'expo-router', 'react-native', 'apps/mobile', 'thread_enabled', 'analysis_enabled', 'semantic_version', 'lf_enabled']) {
    assert.equal(productionCode.includes(forbidden), false, `the runtime must not contain ${forbidden}`);
  }
  const lfDdl = executable.slice(executable.indexOf('CREATE TABLE public.conversation_live_focus_transitions'), executable.indexOf('CREATE FUNCTION public.reject_conversation_live_focus_mutation_v1'));
  assert.doesNotMatch(lfDdl, /label|name text|title|home_|placement_|coordinate|direction|content|score|confidence|importance|rank|weight|centrality|priority|viewport|camera|inspection|timeline|projection|knowledge|historical|reading|analysis/iu,
    'the LF substrate carries reference identity only');
  const delivery = executable.slice(executable.indexOf('CREATE FUNCTION public.get_session_live_state_v1('), executable.indexOf('CREATE FUNCTION public.assert_conversation_full_semantic_chain_cutover_ready_v1('));
  assert.doesNotMatch(delivery, /same_sp_event_sequence|reason_code|label|home|committed_text|created_at|projection|knowledge|historical|pre_first_sp/u, 'the delivery reads expose no sequence, reason, label, Home, content or history');
  assert.deepEqual(Object.keys(rootPackage.devDependencies), ['pg']);
  for (const name of ['uuid', 'zod', 'p-retry', 'async-retry', 'retry', 'bottleneck', 'xstate', 'immer', 'rxjs-live', 'socket.io', 'ws']) {
    assert.equal(name in (apiPackage.dependencies ?? {}) || name in (apiPackage.devDependencies ?? {}) || name in (mobilePackage.dependencies ?? {}) || name in (mobilePackage.devDependencies ?? {}), false, `${name} must not be introduced`);
  }
  assert.equal(gitBlobId(read('package-lock.json')), 'da9e64f217db91c4e72da27073c578a108a99bad', 'the lockfile is byte-identical: no dependency change');
  assert.doesNotMatch(read('package-lock.json'), /live-focus|effective-live-focus/u, 'the lockfile knows nothing of T-03D');
  assert.doesNotMatch(stripComments(establishment), /liveFocus|LIVE_FOCUS|live-focus/u, 'the retired T-03A2 establishment service never learned about LF');
});

test('the gates are registered at the root and in API CI, in the frozen order', () => {
  assert.equal(rootPackage.scripts['test:effective-live-focus-final-semantic-chain-cutover-contract'], 'node --test tests/effective-live-focus-final-semantic-chain-cutover-contract.test.mjs');
  assert.equal(rootPackage.scripts['verify:effective-live-focus-final-semantic-chain-cutover:integration'], 'node --env-file-if-exists=.env database/verify-migration-0071.mjs');
  assert.match(apiCi, /run: npm run test:effective-live-focus-final-semantic-chain-cutover-contract/u);
  assert.match(apiCi, /run: npm run verify:effective-live-focus-final-semantic-chain-cutover:integration/u);
  assert.ok(apiCi.indexOf('test:effective-live-focus-final-semantic-chain-cutover-contract') > apiCi.indexOf('test:thread-lifecycle-cross-session-continuity-contract'));
  assert.ok(apiCi.indexOf('test:effective-live-focus-final-semantic-chain-cutover-contract') < apiCi.indexOf('Apply all migrations to fresh PostgreSQL'));
  assert.ok(apiCi.indexOf('verify:effective-live-focus-final-semantic-chain-cutover:integration') > apiCi.indexOf('verify:thread-lifecycle-cross-session-continuity:integration'));
  for (const line of apiCi.split('\n').filter((entry) => entry.includes('effective-live-focus'))) {
    assert.doesNotMatch(line.slice(line.indexOf('name:'), line.indexOf(', run:')), /,/u, 'a flow-mapping step name carries no comma');
  }
  assert.doesNotMatch(mobileCi, /0071|live-focus/u, 'MOB-CI-01 is untouched: native smoke runs because the mobile source changed, not because the workflow did');
});
