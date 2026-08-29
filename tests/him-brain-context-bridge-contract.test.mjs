import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// QHIA-012 static anti-vacuity contract.
//
// Freezes the whole Background Human Intelligence -> Brain Context Bridge
// architecture - the half that no single database verifier and no single Jest
// spec can freeze on its own:
//
//   * the registry is EXACTLY the eight frozen slots, with no ninth, no HRS
//     signal, and none of the four metrics that already have their own
//     dedicated foreground consumption;
//   * the materializer calls no model, provider, embedding, reranker or text
//     interpreter, and the background source accepts ONLY an execution ID;
//   * service_role gains no generic latest/batch HIM read, no JWT or set_config
//     impersonation appears, and no second latest/currentness algorithm exists;
//   * the Brain effect is MANAGED - excluded from the claimable set, rejected by
//     the generic claim path and by the generic result-less completion path, and
//     its all-null (CLAIMED) row is structurally unrepresentable;
//   * the durable payload gains no transcript, free text, timestamp, metric key
//     or measurement identity;
//   * the foreground RPC reads no measurement or currentness table, selects the
//     immediate predecessor WITHOUT filtering status first, and has no older
//     fallback, while the foreground APPLICATION performs no separate relevance
//     read;
//   * the Orchestrator never awaits Brain Context, adds no timeout, sleep,
//     barrier or Promise.all member, and triggers no second provider call;
//   * `himBrainContext` is a SEPARATE provider channel that is never merged into
//     an existing HIM guidance field, exposes no context id, metric key,
//     timestamp or internal contract, and keeps confidence and freshness
//     UNASSESSED.
//
// Every rule below is executed by ONE guard function, and the anti-vacuity
// fixtures drive that same real guard over deliberately drifted sources - so
// "this contract would catch regression X" is proven, never assumed.
//
// Forward-safe: nothing here forbids a later migration, a later slot introduced
// by a separately reviewed task, a later provider channel, or a later
// consumption boundary. It freezes this task's own wiring only.
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
// Negatives run on EXECUTABLE source only: every file's own prose legitimately
// names the shapes it documents the absence of, exactly as the database
// contracts do.
const executable = (source) => source
  .split('\n')
  .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*') && !line.trim().startsWith('--'))
  .join('\n');
// The migration's precondition/postcondition DO blocks name every forbidden
// identifier as DATA - that is how they prove absence - so the installed
// statements are what the negatives run over.
const installedStatements = (source) => executable(source).replace(/DO \$\$[\s\S]*?END\$\$;/gu, '');

const SOURCES = Object.freeze({
  brainTypes: 'apps/api/src/human-model/him-brain-context.types.ts',
  brainRepository: 'apps/api/src/human-model/him-brain-context.repository.ts',
  brainService: 'apps/api/src/human-model/him-brain-context.service.ts',
  durableResult: 'apps/api/src/post-response-intelligence/durable-him-brain-context-result.ts',
  postResponseTypes: 'apps/api/src/post-response-intelligence/post-response-intelligence.types.ts',
  postResponseRepository: 'apps/api/src/post-response-intelligence/post-response-intelligence.repository.ts',
  dispatcher: 'apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts',
  enrichment: 'apps/api/src/background-intelligence/background-intelligence-enrichment.service.ts',
  backgroundDataApi: 'apps/api/src/background-intelligence/background-intelligence-data-api.service.ts',
  orchestrator: 'apps/api/src/conversation/conversation-orchestrator.service.ts',
  modelRouter: 'apps/api/src/model-router/model-router.types.ts',
  himModule: 'apps/api/src/human-model/him.module.ts',
  projection: 'apps/api/src/human-model/him-contextual-current-projection.ts',
  migration: 'database/migrations/0061_him_brain_context_bridge_v1.sql',
  smokeAdapters: 'apps/api/scripts/full-intelligence-e2e-smoke/pg-foreground-intelligence.adapters.ts',
  smokeRuntime: 'apps/api/scripts/verify-full-intelligence-end-to-end-runtime.ts',
});
const shipped = Object.freeze(Object.fromEntries(Object.entries(SOURCES).map(([key, path]) => [key, read(path)])));

const FOREGROUND_RPC = 'rpc/read_him_brain_context_for_turn_v1';
const BACKGROUND_SOURCE_RPC = 'rpc/background_read_him_brain_context_source_v1';
const COMPLETION_RPC = 'rpc/complete_post_response_him_brain_context_materialization_v1';
const EFFECT_KEY = 'HIM_BRAIN_CONTEXT_MATERIALIZATION';
const REGISTRY = [
  [1, 'DECISION_SELF_CONFIDENCE', 'DECISION', 'hse.self-confidence'],
  [2, 'SITUATION_AVOIDANCE_FREQUENCY', 'SITUATION', 'hbs.avoidance'],
  [3, 'SITUATION_SELF_AWARENESS', 'SITUATION', 'hgs.self-awareness'],
  [4, 'SITUATION_RESILIENCE', 'SITUATION', 'hgs.resilience'],
  [5, 'GOAL_CONSISTENCY', 'GOAL', 'hbs.consistency'],
  [6, 'GOAL_INITIATIVE', 'GOAL', 'hbs.initiative'],
  [7, 'GOAL_PURPOSE_ALIGNMENT', 'GOAL', 'hgs.purpose-alignment'],
  [8, 'GOAL_HABIT_STRENGTH', 'GOAL', 'hgs.habit-strength'],
];
// Deliberately excluded: the four metrics that already have their own dedicated
// foreground consumption, plus every HRS metric and every other surface's own.
const EXCLUDED_METRICS = ['hse.stress', 'hse.attention', 'hse.motivation', 'hse.energy', 'hbs.reflection', 'hrs.communication', 'hrs.relationship-trust', 'hrs.repair', 'hrs.emotional-safety'];

function violated(property) {
  throw new Error(`QHIA-012 Brain Context bridge contract violated: ${property}`);
}

/** The single guard. It receives the whole source map so a drift fixture can replace exactly one file and still be checked against every cross-file rule. */
function assertBrainContextBridgeContract(sources) {
  const exe = Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, executable(source)]));
  const migration = installedStatements(sources.migration);
  // Always the FIRST `end` that follows `start`, so an earlier identical
  // delimiter elsewhere in the file can never collapse a slice to nothing and
  // make a rule vacuously true.
  const slice = (source, start, end) => {
    const from = source.indexOf(start);
    if (from < 0) return '';
    const to = source.indexOf(end, from + start.length);
    return to < 0 ? source.slice(from) : source.slice(from, to);
  };

  // 1. The registry is EXACTLY the eight frozen slots.
  const registryTable = slice(exe.brainTypes, 'export const HIM_BRAIN_CONTEXT_REGISTRY = Object.freeze([', '] as const);');
  if (!registryTable) violated('the frozen Brain Context registry table exists');
  const declared = [...registryTable.matchAll(/slotOrder: (\d+), slot: '([A-Z_]+)', contextKind: '([A-Z_]+)', metricKey: '([a-z.-]+)'/gu)]
    .map((match) => [Number(match[1]), match[2], match[3], match[4]]);
  if (JSON.stringify(declared) !== JSON.stringify(REGISTRY))
    violated('the registry is exactly the eight frozen slots, in exactly the frozen order, each pinned to one context kind and one metric');
  if (!/HIM_BRAIN_CONTEXT_MAX_SIGNALS = 8 as const;/u.test(exe.brainTypes)) violated('the signal bound is exactly eight');
  for (const metric of EXCLUDED_METRICS) {
    for (const [key, source] of [['brainTypes', exe.brainTypes], ['brainService', exe.brainService], ['durableResult', exe.durableResult]]) {
      if (source.includes(`'${metric}'`)) violated(`${key} activates no ${metric}: it already has its own surface or is out of scope`);
    }
    if (migration.includes(`'${metric}'`)) violated(`the migration activates no ${metric}`);
  }
  for (const excludedKind of ["'RELATIONSHIP'", "'GLOBAL'", "'CONVERSATION_SESSION'"]) {
    if (exe.brainTypes.includes(excludedKind)) violated(`the Brain Context registry activates no ${excludedKind} context kind`);
  }

  // 2. The materializer calls no model, provider, embedding, reranker or text
  //    interpreter, and reuses the SHARED QHIA-004 projection.
  const materializer = slice(exe.enrichment, 'async readHimBrainContextMaterialization(', 'async readCanonicalSourceTurn(');
  if (!materializer) violated('the background materializer exists');
  if (!materializer.includes('projectHimContextualCurrentSlot(')) violated('the materializer reuses the shared QHIA-004 projection');
  for (const forbidden of ['generator', 'generate(', 'ModelRouter', 'router', 'provider', 'embedding', 'rerank', 'llm', 'openai', 'anthropic', 'classifier', 'transcript', 'statement', '.content']) {
    if (materializer.toLowerCase().includes(forbidden.toLowerCase())) violated(`the materializer invokes no model, provider, or text interpretation: found ${forbidden}`);
  }
  if (!materializer.includes("knowledgeState!=='KNOWN')continue")) violated('only KNOWN canonical values become durable signals: UNKNOWN stays absent');

  // 3. The background source accepts ONLY the post-response execution ID.
  const backgroundMethod = slice(exe.backgroundDataApi, 'async readHimBrainContextSource(', 'private async request<T>');
  if (!backgroundMethod.includes(`'${BACKGROUND_SOURCE_RPC}'`)) violated('the background source calls the one execution-bound service-role RPC');
  for (const forbidden of ['p_user_id', 'p_session_id', 'p_context_kind', 'p_context_id', 'p_metric_key', 'p_metric_keys', 'p_definition_version', 'p_slot', 'p_registry', 'p_source_turn_id']) {
    if (backgroundMethod.includes(forbidden)) violated(`the background source supplies no ${forbidden}: the callable surface cannot be aimed`);
  }

  // 4. The service role gains no generic latest/batch HIM read, and no JWT or
  //    set_config impersonation appears anywhere.
  if (/GRANT EXECUTE ON FUNCTION public\.read_him_latest_measurement_v1/u.test(migration))
    violated('the authenticated canonical latest ACL is never re-issued or widened');
  if (/GRANT EXECUTE ON FUNCTION public\.read_him_latest_measurement_core_v1/u.test(migration))
    violated('the trusted internal core is granted to no role at all');
  if (/GRANT EXECUTE ON FUNCTION public\.read_him_contextual_current_intelligence_batch_v1[^;]*service_role/u.test(migration))
    violated('the service role never gains the QHIA-004 batch authority');
  if (/set_config|request\.jwt/u.test(migration)) violated('no JWT or set_config impersonation appears in the migration');
  if (/GRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)[^;]*ON\s+(?:TABLE\s+)?public\./iu.test(migration))
    violated('no direct table grant appears for any role');

  // 5. No second latest/currentness algorithm.
  if ((migration.match(/ORDER BY me\.created_at DESC,me\.id DESC/gu) ?? []).length !== 1)
    violated('exactly one newest-event chronology exists: no second currentness algorithm was created');
  if ((migration.match(/him_current_structured_measurements/gu) ?? []).length !== 1)
    violated('the structured-current view is read from exactly one place');

  // 6. The Brain effect is MANAGED and excluded from the claimable set.
  if (!exe.postResponseTypes.includes(`'${EFFECT_KEY}'`)) violated('the Brain effect joins the canonical effect registry');
  if (!/export type ManagedIntelligenceEffect='HYPOTHESIS_UPDATE_BATCH'\|'CONFIDENCE_BATCH'\|'HIM_BRAIN_CONTEXT_MATERIALIZATION';/u.test(exe.postResponseTypes))
    violated('the Brain effect is a MANAGED effect, so the claimable set excludes it at compile time');
  if (!/export type ClaimableIntelligenceEffect=Exclude<IntelligenceEffect,ManagedIntelligenceEffect>;/u.test(exe.postResponseTypes))
    violated('the claimable set stays the exclusion of the managed set');
  if (!migration.includes(`IF p_effect_key='${EFFECT_KEY}' THEN RAISE EXCEPTION 'HIM_BRAIN_CONTEXT_MATERIALIZATION_MANAGED'`))
    violated('the generic claim path rejects the Brain effect');
  if (!migration.includes(`IF p_effect_key='${EFFECT_KEY}' THEN RAISE EXCEPTION 'HIM_BRAIN_CONTEXT_MATERIALIZATION_COMMAND_REQUIRED'`))
    violated('the generic result-less completion path rejects the Brain effect');
  const resultDomain = slice(migration, 'ADD CONSTRAINT post_response_intelligence_effects_brain_context_result_check', 'CREATE OR REPLACE FUNCTION public.claim_post_response_intelligence_effect_v1');
  if (/OR \(result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL\)/u.test(resultDomain))
    violated('the Brain result domain has no all-null alternative: a CLAIMED Brain row must stay unrepresentable');
  const completionCommand = slice(migration, 'CREATE FUNCTION public.complete_post_response_him_brain_context_materialization_v1(', 'ALTER FUNCTION public.complete_post_response_him_brain_context_materialization_v1');
  if (completionCommand.includes("'CLAIMED'")) violated('the managed completion never writes a CLAIMED state');
  if (!completionCommand.includes("RETURN 'ALREADY_COMPLETED'")) violated('the first durable result is immutable');
  if (exe.dispatcher.includes(`this.ledger.claim(execution.id,'${EFFECT_KEY}')`)) violated('the dispatcher never claims the managed Brain effect');

  // 7. The durable payload carries nothing but the bounded contract.
  const signalKeys = slice(exe.durableResult, 'const SIGNAL_KEYS = [', '] as const;');
  for (const forbidden of ['metricKey', 'observedAt', 'temporalWindow', 'measurementEventId', 'observationId', 'snapshotId', 'canonicalBindingId', 'activeBindingId', 'confidenceReference', 'freshnessReference', 'transcript', 'freeText', 'rawText', 'content', 'timestamp', 'label', 'memory', 'hypothesis']) {
    if (signalKeys.includes(forbidden)) violated(`the durable signal contract can never carry ${forbidden}`);
  }
  if (!signalKeys.includes("'slotOrder'") || !signalKeys.includes("'contextId'") || !signalKeys.includes("'numericValue'"))
    violated('the durable signal contract keeps its exact bounded key set');
  if (!exe.durableResult.includes("signal.freshnessState !== 'UNASSESSED' || signal.confidenceState !== 'UNASSESSED'"))
    violated('the durable receipt keeps freshness and confidence exactly UNASSESSED');

  // 8. The foreground database read owns the immediate-previous-turn rule and
  //    rereads no metric.
  const foregroundFunction = slice(migration, 'CREATE FUNCTION public.read_him_brain_context_for_turn_v1(', 'ALTER FUNCTION public.read_him_brain_context_for_turn_v1');
  const predecessorSelection = slice(foregroundFunction, 'SELECT * INTO previous_turn', 'IF NOT FOUND THEN RETURN;END IF;');
  if (predecessorSelection.includes('status'))
    violated('the previous-turn query filters by NO status while selecting the immediate predecessor');
  if (foregroundFunction.indexOf("previous_turn.status<>'COMPLETED'") < foregroundFunction.indexOf('ORDER BY t.created_at DESC,t.id DESC LIMIT 1'))
    violated('usability is decided AFTER selection, so an intervening unusable turn is never skipped over');
  for (const forbidden of ['OFFSET', 'LIMIT 2', 'him_metric_snapshots', 'him_measurement_events', 'him_measurement_observations', 'him_current_structured_measurements', 'him_metric_definitions', 'public.him_session_context_bindings', 'public.read_him_latest_measurement_v1', 'public.read_him_contextual_current_intelligence_batch_v1']) {
    if (foregroundFunction.includes(forbidden)) violated(`the foreground read has no older fallback and rereads no metric: found ${forbidden}`);
  }
  if (!foregroundFunction.includes('public.read_him_session_context_bindings_v1('))
    violated('relevance revalidation delegates to the QHIA-006 authority inside the SAME one foreground RPC');

  // 9. The foreground APPLICATION issues exactly one request and performs no
  //    relevance, metric, or currentness read of its own.
  if ((exe.brainRepository.match(/this\.dataApi\.request/gu) ?? []).length !== 1)
    violated('the Brain Context repository holds exactly one external Data API call site');
  if (!exe.brainRepository.includes(`'${FOREGROUND_RPC}'`)) violated('the repository requests the migration-0061 foreground endpoint');
  for (const forbidden of [BACKGROUND_SOURCE_RPC, COMPLETION_RPC, 'rpc/read_him_session_context_bindings_v1', 'rpc/read_him_contextual_current_intelligence_batch_v1', 'rpc/read_him_latest_measurement_v1', 'HimSessionContextBindingRepository', 'HimRepository', 'PostResponseIntelligenceRepository']) {
    if (exe.brainRepository.includes(forbidden) || exe.brainService.includes(forbidden))
      violated(`the foreground application performs no separate relevance, metric, or background read: found ${forbidden}`);
  }
  if (!exe.brainService.includes('himBrainContextRegistryEntry(')) violated('the consumer validates every row against the frozen registry');
  if (!exe.brainService.includes("freshnessState: 'UNASSESSED'") || !exe.brainService.includes("confidenceState: 'UNASSESSED'"))
    violated('the provider-facing contract keeps freshness and confidence exactly UNASSESSED');
  // The shared QHIA-004 projection stays generic: no Brain slot, metric, or
  // context kind is pushed down into it.
  const projection = executable(read(SOURCES.projection));
  for (const forbidden of ['BRAIN', 'brainSlot', 'brain_slot', 'hbs.consistency', 'GOAL_CONSISTENCY']) {
    if (projection.includes(forbidden)) violated(`the shared QHIA-004 projection stays generic: found ${forbidden}`);
  }

  // 10. The dispatcher materializes FIRST and never strands a CLAIMED effect.
  if (!exe.dispatcher.includes('const brainContext=await this.materializeHimBrainContext(execution,effects,context);'))
    violated('the dispatcher runs Brain Context materialization as its own stage');
  const brainStage = exe.dispatcher.indexOf('const brainContext=await this.materializeHimBrainContext(');
  for (const later of ["completed.has('HYPOTHESIS_PERSISTENCE')", 'this.enrichment.evaluateAndWriteMemory(', 'this.enrichment.evaluateGenerationEligibility(', 'this.extraction.extract(', 'this.enrichment.generateHypothesisCandidatePlan(', 'this.ledger.executeConfidenceBatch(']) {
    const index = exe.dispatcher.indexOf(later);
    if (index < 0 || index < brainStage)
      violated(`Brain Context materialization runs BEFORE ${later}, so a later legitimate skip can never erase it`);
  }
  for (const earlier of ["execution.safety_disposition!=='ALLOW'", 'this.enrichment.readCanonicalSourceTurn(context)', 'this.authority.authorize(event)']) {
    const index = exe.dispatcher.indexOf(earlier);
    if (index < 0 || index > brainStage)
      violated(`Brain Context materialization runs AFTER ${earlier}`);
  }
  if (!exe.dispatcher.includes("recoverHimBrainContextResult(persisted,execution.source_turn_id).status==='INDETERMINATE'?'QUARANTINED':'MATERIALIZED'"))
    violated('an already-valid durable materialization is reused and a malformed one fails closed');
  if (!exe.dispatcher.includes("try{result=await this.enrichment.readHimBrainContextMaterialization(context,execution.id);}catch{return'FAILED';}"))
    violated('a source-read failure writes no effect row and leaves the execution retryable');

  // 11. The Orchestrator: one launch, no await, no new wait, no second provider
  //     call.
  if ((exe.orchestrator.match(/this\.himBrainContext\.read\(/gu) ?? []).length !== 1)
    violated('the Orchestrator launches exactly one Brain Context read');
  if (/await\s+brainContextReadPromise/u.test(exe.orchestrator))
    violated('the Brain Context promise is never awaited: zero incremental foreground wait');
  if (!/await Promise\.all\(\[himSnapshotPromise, reflectionReadPromise\]\)/u.test(exe.orchestrator))
    violated('the existing barrier still awaits exactly the Snapshot and Reflection promises');
  if ((exe.orchestrator.match(/Promise\.all\(/gu) ?? []).length !== 1)
    violated('no second foreground barrier exists: the existing Promise.all stays the only one');
  if ((exe.orchestrator.match(/setTimeout\(/gu) ?? []).length !== 1)
    violated('no second foreground timer exists: the pre-existing Reflection budget is the only one');
  if (!/const SESSION_REFLECTION_FOREGROUND_WAIT_BUDGET_MS = 300;/u.test(exe.orchestrator))
    violated('the existing QHIA-005 Reflection foreground wait budget stays exactly 300 ms');
  if (/setInterval\(|sleep\(|delay\(/u.test(exe.orchestrator)) violated('no sleep or interval is added to the foreground');
  if ((exe.orchestrator.match(/this\.router\.generate\(/gu) ?? []).length !== 1)
    violated('exactly one Model Router invocation exists: Brain Context adds no second provider call');
  if (!/brainContextReadPromise\.then\(\s*\(value\) => \{ if \(!brainContextBarrierClosed\) brainContextSettled = value; \},\s*\(\) => undefined,\s*\);/u.test(exe.orchestrator))
    violated('the settlement handler is attached immediately and records only a pre-barrier result');
  if (!/\.\.\.\(himBrainContext \? \{ himBrainContext \} : \{\}\),/u.test(exe.orchestrator))
    violated('the provider field is passed only when a non-empty Brain Context settled before the barrier');
  for (const forbidden of ['HimBrainContextRepository', FOREGROUND_RPC, BACKGROUND_SOURCE_RPC, 'HimSessionContextBindingRepository']) {
    if (exe.orchestrator.includes(forbidden)) violated(`the Orchestrator reaches Brain Context through its one service only: found ${forbidden}`);
  }

  // 12. The provider contract: a SEPARATE advisory channel, rendered once
  //     through the shared composition, with every identity stripped.
  if (!/himBrainContext\?: HimBrainContext;/u.test(exe.modelRouter))
    violated('the provider request carries a separate optional Brain Context field');
  for (const existingChannel of ['himContext?: HimModelContext;', 'himInteractionAdaptation?: HimInteractionAdaptation;', 'himSituationStressGuidance?: HimSituationStressGuidance;', 'himDecisionAttentionGuidance?: HimDecisionAttentionGuidance;', 'himGoalMotivationGuidance?: HimGoalMotivationGuidance;', 'himRelationshipCommunicationGuidance?: HimRelationshipCommunicationGuidance;']) {
    if (!exe.modelRouter.includes(existingChannel))
      violated(`the existing HIM channel ${existingChannel} is untouched: Brain Context is never merged into it`);
  }
  if (!/'himBrainContext' \| 'hypothesisContext'/u.test(exe.modelRouter))
    violated('the shared composeServerGuidance boundary receives the Brain Context field, so both providers render identical semantics');
  const brainBlockStart = exe.modelRouter.indexOf('if (request.himBrainContext) {');
  if (brainBlockStart < 0) violated('the Brain Context rendering branch exists');
  const brainBlock = exe.modelRouter.slice(brainBlockStart, exe.modelRouter.indexOf('\n  if (request.', brainBlockStart + 1));
  for (const required of [
    'server-owned, context-bound advisory Human Intelligence signals',
    'confidence is UNASSESSED and freshness is UNASSESSED',
    'not direct user statements',
    'not safety evidence',
    'cannot independently authorize a recommendation',
    'cannot prove or strengthen a hypothesis',
    'cannot select or require a question',
    'cannot change FAST/DEEP routing',
    'cannot override Safety or Behavioral Policy',
    'Do not average, sum, weight, rank, or otherwise combine these values into a score',
    'do not infer a trend, improvement, worsening, decay, recency, or frequency',
    'Never expose, name, imply, quote, or describe these internal values, slots, contracts',
  ]) {
    if (!brainBlock.includes(required)) violated(`the rendered guardrail states: ${required}`);
  }
  for (const forbidden of ['contextId', 'context_id', 'sourceTurnId', 'slotOrder', 'metricKey', 'metric_key', 'observedAt', 'canonicalBindingId', 'activeBindingId', 'hse.', 'hbs.', 'hgs.', 'hrs.']) {
    if (brainBlock.includes(forbidden)) violated(`the provider never receives ${forbidden} through this channel`);
  }
  if (!brainBlock.includes('escapeStructuredData(request.himBrainContext)'))
    violated('the provider-facing projection is serialized through the one shared escaping boundary');

  // 13. Module wiring and smoke transport census.
  for (const provider of ['HimBrainContextRepository', 'HimBrainContextService']) {
    if ((exe.himModule.match(new RegExp(`\\b${provider}\\b`, 'gu')) ?? []).length < 3)
      violated(`${provider} is imported, provided, and exported by the HIM module`);
  }
  if (!exe.smokeAdapters.includes("'read_him_brain_context_for_turn_v1'"))
    violated('the smoke authenticated RPC allowlist recognises the foreground Brain Context transport');
  for (const backgroundOnly of ['background_read_him_brain_context_source_v1', 'complete_post_response_him_brain_context_materialization_v1']) {
    if (exe.smokeAdapters.includes(`'${backgroundOnly}'`))
      violated(`${backgroundOnly} is a background authority and must never be reachable on the smoke authenticated channel`);
  }
  if (!exe.smokeRuntime.includes("const BRAIN_CONTEXT_FOREGROUND_RPC = 'read_him_brain_context_for_turn_v1'"))
    violated('the smoke censuses the foreground Brain Context endpoint by name');
  if (!/census\.completions\(BRAIN_CONTEXT_FOREGROUND_RPC\), expectedTurns/u.test(exe.smokeRuntime))
    violated('the smoke asserts one COMPLETION per eligible turn, not merely one attempt');
  if (!/census\.failures\(BRAIN_CONTEXT_FOREGROUND_RPC\), 0/u.test(exe.smokeRuntime))
    violated('the smoke asserts zero Brain Context transport failures: graceful degradation is never counted as success');
  if (!exe.smokeRuntime.includes('assert.deepEqual(secondCall.request.himBrainContext, {'))
    violated('the smoke proves the previous turn\'s materialization reached the one normal provider request');
  if (!exe.smokeRuntime.includes('const deterministicBrainContextService = {') || !exe.smokeRuntime.includes('const deterministicSnapshotService = {'))
    violated('the smoke uses a controlled deterministic barrier rather than winning a wall-clock race');
  if (/setTimeout|sleep\(/u.test(slice(exe.smokeRuntime, 'let releaseSnapshotGate', 'const conversationalRouter =')))
    violated('the smoke deterministic barrier uses no sleep or timer');
  if (!exe.smokeRuntime.includes('pgDataAdapter.himBrainContextSourceReadCount, 1'))
    violated('the smoke proves exactly one execution-bound background source request');
  if (!exe.smokeRuntime.includes('pgLedgerAdapter.himBrainContextCompletionCount, 1'))
    violated('the smoke proves exactly one managed typed durable completion');

  // 14. This task owns exactly one migration.
  const migrations = readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql'));
  if (!migrations.includes('0061_him_brain_context_bridge_v1.sql')) violated('migration 0061 exists');
  if (migrations.some((name) => name.startsWith('0062'))) violated('this task adds no migration 0062');
}

test('B1 - the shipped sources satisfy the frozen QHIA-012 Brain Context bridge contract', () => {
  assert.doesNotThrow(() => assertBrainContextBridgeContract(shipped));
});

test('B2 - anti-vacuity: the real guard rejects every named regression', () => {
  const drifts = [
    ['a ninth Brain slot was added', {
      brainTypes: shipped.brainTypes.replace(
        "  Object.freeze({ slotOrder: 8, slot: 'GOAL_HABIT_STRENGTH', contextKind: 'GOAL', metricKey: 'hgs.habit-strength' }),",
        "  Object.freeze({ slotOrder: 8, slot: 'GOAL_HABIT_STRENGTH', contextKind: 'GOAL', metricKey: 'hgs.habit-strength' }),\n  Object.freeze({ slotOrder: 9, slot: 'SITUATION_ENERGY', contextKind: 'SITUATION', metricKey: 'hse.energy' }),",
      ),
    }],
    ['an HRS signal entered the registry', {
      brainTypes: shipped.brainTypes.replace("metricKey: 'hgs.habit-strength' }", "metricKey: 'hrs.communication' }"),
    }],
    ['an already-dedicated foreground metric entered the registry', {
      brainTypes: shipped.brainTypes.replace("metricKey: 'hbs.avoidance' }", "metricKey: 'hse.stress' }"),
    }],
    ['a registry slot was reordered', {
      brainTypes: shipped.brainTypes.replace(
        "  Object.freeze({ slotOrder: 1, slot: 'DECISION_SELF_CONFIDENCE', contextKind: 'DECISION', metricKey: 'hse.self-confidence' }),\n  Object.freeze({ slotOrder: 2, slot: 'SITUATION_AVOIDANCE_FREQUENCY', contextKind: 'SITUATION', metricKey: 'hbs.avoidance' }),",
        "  Object.freeze({ slotOrder: 2, slot: 'SITUATION_AVOIDANCE_FREQUENCY', contextKind: 'SITUATION', metricKey: 'hbs.avoidance' }),\n  Object.freeze({ slotOrder: 1, slot: 'DECISION_SELF_CONFIDENCE', contextKind: 'DECISION', metricKey: 'hse.self-confidence' }),",
      ),
    }],
    ['a slot was re-pointed at a different context kind', {
      brainTypes: shipped.brainTypes.replace("slot: 'GOAL_CONSISTENCY', contextKind: 'GOAL'", "slot: 'GOAL_CONSISTENCY', contextKind: 'SITUATION'"),
    }],
    ['the signal bound was widened', {
      brainTypes: shipped.brainTypes.replace('HIM_BRAIN_CONTEXT_MAX_SIGNALS = 8 as const;', 'HIM_BRAIN_CONTEXT_MAX_SIGNALS = 17 as const;'),
    }],
    ['the materializer invoked a provider', {
      enrichment: shipped.enrichment.replace(
        '  const rows=await this.data.readHimBrainContextSource(context,executionId);',
        '  await this.classifier.classify({text:"x",safetyDisposition:"ALLOW"});\n  const rows=await this.data.readHimBrainContextSource(context,executionId);',
      ),
    }],
    ['the materializer stopped using the shared QHIA-004 projection', {
      enrichment: shipped.enrichment.replace(
        '   const metric=projectHimContextualCurrentSlot(row,registry.metricKey,registry.slotOrder,registry.contextKind,row.context_id);',
        '   const metric={knowledgeState:row.has_canonical_current_value?"KNOWN":"UNKNOWN",numericValue:row.numeric_value,semanticMappingStatus:row.semantic_mapping_status,semanticType:row.semantic_type} as never;',
      ),
    }],
    ['the materializer substituted an UNKNOWN signal', {
      enrichment: shipped.enrichment.replace("   if(metric.knowledgeState!=='KNOWN')continue;\n", ''),
    }],
    ['the background source gained a caller-supplied context selector', {
      backgroundDataApi: shipped.backgroundDataApi.replace(
        'body:JSON.stringify({p_execution_id:executionId})',
        'body:JSON.stringify({p_execution_id:executionId,p_context_id:executionId})',
      ),
    }],
    ['the trusted internal core gained an EXECUTE grant', {
      migration: shipped.migration.replace(
        'REVOKE ALL ON FUNCTION public.read_him_latest_measurement_core_v1(uuid,text,integer,text,text) FROM PUBLIC,anon,authenticated,service_role;',
        'REVOKE ALL ON FUNCTION public.read_him_latest_measurement_core_v1(uuid,text,integer,text,text) FROM PUBLIC,anon,authenticated,service_role;\nGRANT EXECUTE ON FUNCTION public.read_him_latest_measurement_core_v1(uuid,text,integer,text,text) TO service_role;',
      ),
    }],
    ['the authenticated latest ACL was re-issued', {
      migration: shipped.migration.replace(
        'ALTER TABLE public.post_response_intelligence_effects\n  DROP CONSTRAINT post_response_intelligence_effects_effect_key_check,',
        'GRANT EXECUTE ON FUNCTION public.read_him_latest_measurement_v1(uuid,text,integer,text,text) TO service_role;\nALTER TABLE public.post_response_intelligence_effects\n  DROP CONSTRAINT post_response_intelligence_effects_effect_key_check,',
      ),
    }],
    ['a set_config identity impersonation appeared', {
      migration: shipped.migration.replace(
        'DECLARE u uuid:=p_trusted_user_id;valid_kinds text[];owned boolean:=false;',
        "DECLARE u uuid:=p_trusted_user_id;valid_kinds text[];owned boolean:=false;forged text:=set_config('request.jwt.claims','{}',true);",
      ),
    }],
    ['a second currentness algorithm appeared', {
      migration: shipped.migration.replace(
        ' RETURN QUERY\n WITH registry(brain_order,brain_label,brain_kind,brain_metric) AS(',
        ' PERFORM 1 FROM public.him_measurement_events me2 ORDER BY me.created_at DESC,me.id DESC;\n RETURN QUERY\n WITH registry(brain_order,brain_label,brain_kind,brain_metric) AS(',
      ),
    }],
    ['a direct table grant appeared', {
      migration: shipped.migration.replace(
        'GRANT EXECUTE ON FUNCTION public.background_read_him_brain_context_source_v1(uuid) TO service_role;',
        'GRANT EXECUTE ON FUNCTION public.background_read_him_brain_context_source_v1(uuid) TO service_role;\nGRANT SELECT ON TABLE public.him_session_context_bindings TO service_role;',
      ),
    }],
    ['the Brain effect became ordinarily claimable', {
      postResponseTypes: shipped.postResponseTypes.replace(
        "export type ManagedIntelligenceEffect='HYPOTHESIS_UPDATE_BATCH'|'CONFIDENCE_BATCH'|'HIM_BRAIN_CONTEXT_MATERIALIZATION';",
        "export type ManagedIntelligenceEffect='HYPOTHESIS_UPDATE_BATCH'|'CONFIDENCE_BATCH';",
      ),
    }],
    ['the generic claim path stopped rejecting the Brain effect', {
      migration: shipped.migration.replace(
        " IF p_effect_key='HIM_BRAIN_CONTEXT_MATERIALIZATION' THEN RAISE EXCEPTION 'HIM_BRAIN_CONTEXT_MATERIALIZATION_MANAGED' USING ERRCODE='22023';END IF;\n",
        '',
      ),
    }],
    ['the generic result-less completion stopped rejecting the Brain effect', {
      migration: shipped.migration.replace(
        " IF p_effect_key='HIM_BRAIN_CONTEXT_MATERIALIZATION' THEN RAISE EXCEPTION 'HIM_BRAIN_CONTEXT_MATERIALIZATION_COMMAND_REQUIRED' USING ERRCODE='22023';END IF;\n",
        '',
      ),
    }],
    ['the durable result domain gained an all-null (CLAIMED) alternative', {
      migration: shipped.migration.replace(
        "    effect_key<>'HIM_BRAIN_CONTEXT_MATERIALIZATION'\n    OR (state='COMPLETED' AND result_code='NO_HIM_BRAIN_CONTEXT'",
        "    effect_key<>'HIM_BRAIN_CONTEXT_MATERIALIZATION'\n    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)\n    OR (state='COMPLETED' AND result_code='NO_HIM_BRAIN_CONTEXT'",
      ),
    }],
    ['the durable payload gained a metric key', {
      durableResult: shipped.durableResult.replace(
        "  'semanticMappingStatus', 'semanticType', 'freshnessState', 'confidenceState',",
        "  'semanticMappingStatus', 'semanticType', 'freshnessState', 'confidenceState', 'metricKey',",
      ),
    }],
    ['the durable payload gained a timestamp', {
      durableResult: shipped.durableResult.replace(
        "  'semanticMappingStatus', 'semanticType', 'freshnessState', 'confidenceState',",
        "  'semanticMappingStatus', 'semanticType', 'freshnessState', 'confidenceState', 'observedAt',",
      ),
    }],
    ['the durable receipt stopped freezing freshness and confidence', {
      durableResult: shipped.durableResult.replace(
        "    if (signal.freshnessState !== 'UNASSESSED' || signal.confidenceState !== 'UNASSESSED') return undefined;",
        '    if (typeof signal.freshnessState !== \'string\') return undefined;',
      ),
    }],
    ['the previous-turn query filters status BEFORE selecting the predecessor', {
      migration: shipped.migration.replace(
        "  WHERE t.session_id=p_session_id AND t.user_id=u AND t.role='USER'\n   AND (t.created_at,t.id)<(current_turn.created_at,current_turn.id)",
        "  WHERE t.session_id=p_session_id AND t.user_id=u AND t.role='USER' AND t.status='COMPLETED'\n   AND (t.created_at,t.id)<(current_turn.created_at,current_turn.id)",
      ),
    }],
    ['an older fallback appeared in the foreground read', {
      migration: shipped.migration.replace(
        '  ORDER BY t.created_at DESC,t.id DESC LIMIT 1;\n IF NOT FOUND THEN RETURN;END IF;\n -- Step 2',
        '  ORDER BY t.created_at DESC,t.id DESC LIMIT 2 OFFSET 1;\n IF NOT FOUND THEN RETURN;END IF;\n -- Step 2',
      ),
    }],
    ['the foreground read reached a measurement substrate', {
      migration: shipped.migration.replace(
        ' IF NOT FOUND THEN RETURN;END IF;\n -- An authoritative "there was nothing to materialize" is a normal empty answer.',
        ' PERFORM 1 FROM public.him_metric_snapshots LIMIT 1;\n IF NOT FOUND THEN RETURN;END IF;\n -- An authoritative "there was nothing to materialize" is a normal empty answer.',
      ),
    }],
    ['the foreground application added a separate relevance read', {
      brainService: shipped.brainService.replace(
        '    return this.consumeSourceRows(await this.repository.readBrainContextForTurn(token, userId, sessionId, currentTurnId));',
        "    void 'rpc/read_him_session_context_bindings_v1';\n    return this.consumeSourceRows(await this.repository.readBrainContextForTurn(token, userId, sessionId, currentTurnId));",
      ),
    }],
    ['the repository added a second external request', {
      brainRepository: shipped.brainRepository.replace(
        '    return rows ?? [];',
        "    await this.dataApi.request(token, 'rpc/read_him_session_context_bindings_v1', { method: 'POST', body: '{}' });\n    return rows ?? [];",
      ),
    }],
    ['the dispatcher claimed the managed Brain effect', {
      dispatcher: shipped.dispatcher.replace(
        '  const brainContext=await this.materializeHimBrainContext(execution,effects,context);',
        "  await this.ledger.claim(execution.id,'HIM_BRAIN_CONTEXT_MATERIALIZATION');\n  const brainContext=await this.materializeHimBrainContext(execution,effects,context);",
      ),
    }],
    ['materialization moved after the Memory write', {
      dispatcher: shipped.dispatcher.replace(
        '  const brainContext=await this.materializeHimBrainContext(execution,effects,context);\n  if(brainContext===\'FAILED\')return false;\n  if(brainContext===\'QUARANTINED\')return this.terminal(execution,\'QUARANTINED\',\'INDETERMINATE_EFFECT\',\'HIM_BRAIN_CONTEXT_MATERIALIZATION\');\n  if(brainContext===\'MATERIALIZED\')completed.add(\'HIM_BRAIN_CONTEXT_MATERIALIZATION\');\n',
        '',
      ).replace(
        '  return this.confidenceBatch(execution,effects,acceptedHypothesisIds);}',
        '  const brainContext=await this.materializeHimBrainContext(execution,effects,context);\n  if(brainContext===\'FAILED\')return false;\n  return this.confidenceBatch(execution,effects,acceptedHypothesisIds);}',
      ),
    }],
    ['a source-read failure started writing a durable effect anyway', {
      dispatcher: shipped.dispatcher.replace(
        "  try{result=await this.enrichment.readHimBrainContextMaterialization(context,execution.id);}catch{return'FAILED';}",
        "  try{result=await this.enrichment.readHimBrainContextMaterialization(context,execution.id);}catch{result={code:'NO_HIM_BRAIN_CONTEXT'};}",
      ),
    }],
    ['the Orchestrator awaited the Brain Context read', {
      orchestrator: shipped.orchestrator.replace(
        '      crossContextForegroundBarrierClosed = true;\n      brainContextBarrierClosed = true;',
        '      await brainContextReadPromise.catch(() => undefined);\n      crossContextForegroundBarrierClosed = true;\n      brainContextBarrierClosed = true;',
      ),
    }],
    ['the Orchestrator added a second barrier', {
      orchestrator: shipped.orchestrator.replace(
        '      brainContextBarrierClosed = true;',
        '      await Promise.all([brainContextReadPromise.catch(() => undefined)]);\n      brainContextBarrierClosed = true;',
      ),
    }],
    ['the Orchestrator added a second timer', {
      orchestrator: shipped.orchestrator.replace(
        '      brainContextReadPromise.then(',
        '      setTimeout(() => undefined, 25);\n      brainContextReadPromise.then(',
      ),
    }],
    ['the existing Reflection budget was changed', {
      orchestrator: shipped.orchestrator.replace(
        'const SESSION_REFLECTION_FOREGROUND_WAIT_BUDGET_MS = 300;',
        'const SESSION_REFLECTION_FOREGROUND_WAIT_BUDGET_MS = 450;',
      ),
    }],
    ['the Orchestrator launched a second Brain Context read', {
      orchestrator: shipped.orchestrator.replace(
        '      brainContextReadPromise.then(',
        '      void this.himBrainContext.read(userId, accessToken, himSelection.contextId, claimed.id);\n      brainContextReadPromise.then(',
      ),
    }],
    ['a late Brain Context result can still mutate the turn', {
      orchestrator: shipped.orchestrator.replace(
        '      brainContextReadPromise.then(\n        (value) => { if (!brainContextBarrierClosed) brainContextSettled = value; },\n        () => undefined,\n      );',
        '      brainContextReadPromise.then(\n        (value) => { brainContextSettled = value; },\n        () => undefined,\n      );',
      ),
    }],
    ['the provider field bypasses the settled-and-non-empty gate', {
      orchestrator: shipped.orchestrator.replace(
        '        ...(himBrainContext ? { himBrainContext } : {}),',
        '        himBrainContext,',
      ),
    }],
    ['Brain Context was merged into an existing HIM channel', {
      modelRouter: shipped.modelRouter.replace('  himContext?: HimModelContext;', '  himContext?: HimModelContext & { brain?: HimBrainContext };'),
    }],
    ['the Brain Context field was dropped from the shared composition', {
      modelRouter: shipped.modelRouter.replace("'himBrainContext' | 'hypothesisContext'", "'hypothesisContext'"),
    }],
    ['the guardrail dropped the not-safety-evidence statement', {
      modelRouter: shipped.modelRouter.replace('and they are not safety evidence. A signal cannot independently authorize a recommendation', 'A signal cannot independently authorize a recommendation'),
    }],
    ['the guardrail dropped the no-averaging statement', {
      modelRouter: shipped.modelRouter.replace('Do not average, sum, weight, rank, or otherwise combine these values into a score, index, profile, or composite; ', ''),
    }],
    ['a metric key leaked into the provider block', {
      modelRouter: shipped.modelRouter.replace('<him_brain_context>\\n${escapeStructuredData(request.himBrainContext)}', '<him_brain_context metric="hbs.consistency">\\n${escapeStructuredData(request.himBrainContext)}'),
    }],
    ['the Brain boundaries were dropped from the HIM module', {
      himModule: shipped.himModule.replaceAll('HimBrainContextService', 'HimGoalMotivationConsumptionService'),
    }],
    ['the smoke allowlist exposed the background source to the authenticated channel', {
      smokeAdapters: shipped.smokeAdapters.replace(
        "  'read_him_brain_context_for_turn_v1',",
        "  'read_him_brain_context_for_turn_v1',\n  'background_read_him_brain_context_source_v1',",
      ),
    }],
    ['the smoke counts attempts but not completions', {
      smokeRuntime: shipped.smokeRuntime.replace(
        'assert.equal(census.completions(BRAIN_CONTEXT_FOREGROUND_RPC), expectedTurns,',
        'assert.equal(census.completions(BRAIN_CONTEXT_FOREGROUND_RPC), census.completions(BRAIN_CONTEXT_FOREGROUND_RPC),',
      ),
    }],
    ['the smoke tolerates Brain Context transport failures', {
      smokeRuntime: shipped.smokeRuntime.replace(
        'assert.equal(census.failures(BRAIN_CONTEXT_FOREGROUND_RPC), 0,',
        'assert.equal(census.failures(BRAIN_CONTEXT_FOREGROUND_RPC), census.failures(BRAIN_CONTEXT_FOREGROUND_RPC),',
      ),
    }],
    ['the smoke stopped proving the provider received the previous turn materialization', {
      smokeRuntime: shipped.smokeRuntime.replace('assert.deepEqual(secondCall.request.himBrainContext, {', 'assert.ok(true || secondCall.request.himBrainContext === undefined, JSON.stringify({'),
    }],
    ['the smoke replaced its deterministic barrier with a race', {
      smokeRuntime: shipped.smokeRuntime.replace('const deterministicBrainContextService = {', 'const racingBrainContextService = {'),
    }],
    ['the smoke stopped proving one background source request', {
      smokeRuntime: shipped.smokeRuntime.replaceAll('pgDataAdapter.himBrainContextSourceReadCount, 1', 'pgDataAdapter.himBrainContextSourceReadCount, pgDataAdapter.himBrainContextSourceReadCount'),
    }],
  ];

  for (const [label, overrides] of drifts) {
    const mutated = { ...shipped, ...overrides };
    for (const key of Object.keys(overrides)) {
      assert.notEqual(mutated[key], shipped[key], `the "${label}" mutation actually replaced its source text`);
    }
    assert.throws(
      () => assertBrainContextBridgeContract(mutated),
      /QHIA-012 Brain Context bridge contract violated/u,
      `the guard rejects: ${label}`,
    );
  }

  // Positive control and formatting-insensitivity.
  assert.doesNotThrow(() => assertBrainContextBridgeContract(shipped));
  const reformatted = { ...shipped, brainService: `\n${shipped.brainService}` };
  assert.notEqual(reformatted.brainService, shipped.brainService);
  assert.doesNotThrow(() => assertBrainContextBridgeContract(reformatted), 'formatting alone never fails the guard');
});

test('B3 - the existing HIM foreground channels are untouched by QHIA-012', () => {
  // The four already-shipped cross-context consumption boundaries keep their own
  // frozen identities and gain no Brain coupling.
  for (const [path, marker] of [
    ['apps/api/src/human-model/him-situation-stress-consumption.service.ts', 'HIM_SITUATION_STRESS_METRIC_KEY'],
    ['apps/api/src/human-model/him-decision-attention-consumption.service.ts', 'HIM_DECISION_ATTENTION_METRIC_KEY'],
    ['apps/api/src/human-model/him-goal-motivation-consumption.service.ts', 'HIM_GOAL_MOTIVATION_METRIC_KEY'],
    ['apps/api/src/human-model/him-relationship-communication-consumption.service.ts', 'HIM_RELATIONSHIP_COMMUNICATION_METRIC_KEY'],
  ]) {
    const source = read(path);
    assert.ok(source.includes(marker), `${path} keeps its own frozen identity`);
    assert.ok(!source.includes('HimBrainContext'), `${path} gains no Brain Context coupling`);
  }
  // The aggregate-v3 transport is unchanged: QHIA-012 is an ADDITIONAL
  // independent optional read, not an aggregate-v4.
  const aggregateRepository = read('apps/api/src/human-model/him-cross-context-foreground.repository.ts');
  assert.ok(aggregateRepository.includes("'rpc/read_him_session_cross_context_foreground_v3'"));
  assert.ok(!aggregateRepository.includes('brain_context'), 'the aggregate transport gains no Brain Context slot');
  assert.ok(!aggregateRepository.includes('_v4'), 'no aggregate v4 was created');
});

test('B4 - the contract is wired into package scripts and CI', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(
    packageJson.scripts['test:him-brain-context-bridge-contract'],
    'node --test tests/him-brain-context-bridge-contract.test.mjs',
  );
  assert.equal(
    packageJson.scripts['verify:him-brain-context-bridge:integration'],
    'node --env-file-if-exists=.env database/verify-migration-0061.mjs',
  );
  const ci = read('.github/workflows/api-ci.yml');
  const staticStep = ci.indexOf('test:him-brain-context-bridge-contract');
  assert.ok(staticStep > 0, 'CI runs this static contract');
  assert.ok(staticStep < ci.indexOf('Apply all migrations to fresh PostgreSQL'),
    'it runs before the database bootstrap: a pure static guard needs no database');
  const verifierStep = ci.indexOf('verify:him-brain-context-bridge:integration');
  assert.ok(verifierStep > ci.indexOf('Apply all migrations to fresh PostgreSQL'), 'the real-PostgreSQL verifier runs after the bootstrap');
  assert.ok(verifierStep < ci.indexOf('verify:full-intelligence-e2e-runtime'), 'it runs before the Full Intelligence smoke');
});
