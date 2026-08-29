import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// QHIA-011 application static contract.
//
// Freezes the APPLICATION side of the cross-context foreground architecture -
// the half that no database verifier and no Jest spec can freeze on its own:
//
//   * the production repository issues EXACTLY ONE external request, against
//     the migration-0060 aggregate-v3 endpoint and never the retired
//     aggregate-v1 or aggregate-v2 endpoints;
//   * the application transport contract is an explicit FOUR-slot v3 envelope
//     in the frozen order 1/SITUATION_STRESS 2/DECISION_ATTENTION
//     3/GOAL_MOTIVATION 4/RELATIONSHIP_COMMUNICATION, while the symbol named V2
//     keeps meaning exactly the three-slot contract it always meant;
//   * the aggregate service delegates every channel to its REAL existing
//     semantic consumer - including the real QHIA-011 Relationship consumer -
//     and interprets nothing itself;
//   * the Conversation Orchestrator launches exactly one cross-context
//     foreground read, never a direct Relationship read, and adds no timeout,
//     barrier, await, or Promise.all member of its own - the pre-existing 300 ms
//     QHIA-005 Reflection budget stays the only foreground wait;
//   * the provider receives a SEPARATE optional Relationship field, rendered
//     only when that field is ACTIVE, through the one common
//     composeServerGuidance boundary with exact-match dedup, and never borrows
//     an unrelated burden-reduction constant;
//   * the QHIA-011 consumer pins the EXPECTED canonical HRS / UNRESOLVED / null
//     identity - accepting it rather than rejecting it - and the shared QHIA-004
//     projection stays generic;
//   * the Full Intelligence smoke transport allowlist and census really name the
//     v3 endpoint, really separate ATTEMPT from COMPLETION, and really refuse
//     every retired transport.
//
// Every rule below is executed by ONE guard function, and the anti-vacuity
// fixtures drive that same real guard over deliberately drifted sources - so
// "this contract would catch regression X" is proven, never assumed.
//
// Forward-safe: nothing here forbids a later slot, a later consumer, a later
// aggregate version, a later migration, or a later resolution of the HRS
// Foundation semantic mapping. It freezes this task's own wiring only.
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
// Negatives run on EXECUTABLE source only: every file's own prose legitimately
// names the shapes it documents the absence of, exactly as the database
// contracts do.
const executable = (source) => source
  .split('\n')
  .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*'))
  .join('\n');

const SOURCES = Object.freeze({
  aggregateRepository: 'apps/api/src/human-model/him-cross-context-foreground.repository.ts',
  aggregateTypes: 'apps/api/src/human-model/him-cross-context-foreground.types.ts',
  aggregateService: 'apps/api/src/human-model/him-cross-context-foreground-aggregation.service.ts',
  relationshipRepository: 'apps/api/src/human-model/him-relationship-communication.repository.ts',
  relationshipService: 'apps/api/src/human-model/him-relationship-communication-consumption.service.ts',
  relationshipTypes: 'apps/api/src/human-model/him-relationship-communication-consumption.types.ts',
  orchestrator: 'apps/api/src/conversation/conversation-orchestrator.service.ts',
  modelRouter: 'apps/api/src/model-router/model-router.types.ts',
  // QHIA-013 moved the source -> provider-instruction mapping here. The
  // Relationship channel is still ACTIVE-gated, still bounded to exactly its own
  // three instructions, and still rendered through the one shared composition.
  providerSemantics: 'apps/api/src/model-router/human-intelligence-provider-semantics.ts',
  himModule: 'apps/api/src/human-model/him.module.ts',
  smokeAdapters: 'apps/api/scripts/full-intelligence-e2e-smoke/pg-foreground-intelligence.adapters.ts',
  smokeRuntime: 'apps/api/scripts/verify-full-intelligence-end-to-end-runtime.ts',
});

const shipped = Object.freeze(Object.fromEntries(
  Object.entries(SOURCES).map(([key, path]) => [key, read(path)]),
));

const AGGREGATE_V3_RPC = 'rpc/read_him_session_cross_context_foreground_v3';
const AGGREGATE_V2_RPC = 'rpc/read_him_session_cross_context_foreground_v2';
const AGGREGATE_V1_RPC = 'rpc/read_him_session_cross_context_foreground_v1';
const RELATIONSHIP_RPC = 'rpc/read_him_session_relationship_communication_v1';
const EXPLICIT_WORDING_INSTRUCTION = 'When relationship-related communication guidance is otherwise appropriate, make any suggested wording explicit and concrete rather than relying on hints, implied meaning, or the other person inferring the main point.';
const ONE_MAIN_POINT_INSTRUCTION = 'Keep any suggested message or exchange focused on one main point or request at a time rather than bundling several issues together.';
const CLARITY_INSTRUCTION = 'Aim for clear expression and workable understanding; do not make immediate agreement, persuasion, or winning the exchange the goal.';

function violated(property) {
  throw new Error(`QHIA-011 application transport contract violated: ${property}`);
}

/**
 * The single guard. It receives the whole source map so a drift fixture can
 * replace exactly one file and still be checked against every cross-file rule.
 */
function assertCrossContextForegroundApplicationContract(sources) {
  const exe = Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, executable(source)]));

  // 1. ONE external request, against the v3 endpoint, and never a retired one.
  if ((exe.aggregateRepository.match(/this\.dataApi\.request/gu) ?? []).length !== 1)
    violated('the aggregate repository holds exactly one external Data API call site');
  if (!exe.aggregateRepository.includes(`'${AGGREGATE_V3_RPC}'`))
    violated('the production repository requests the migration-0060 aggregate-v3 endpoint');
  for (const retired of [AGGREGATE_V2_RPC, AGGREGATE_V1_RPC]) {
    if (exe.aggregateRepository.includes(retired))
      violated(`the retired ${retired} endpoint is never requested by the application`);
  }
  for (const perChannel of [RELATIONSHIP_RPC, 'rpc/read_him_session_goal_motivation_v1', 'rpc/read_him_session_situation_stress_v1', 'rpc/read_him_session_decision_attention_v1', 'rpc/read_him_session_context_bindings_v1']) {
    if (exe.aggregateRepository.includes(perChannel))
      violated(`the aggregate repository issues no direct per-channel request: found ${perChannel}`);
  }
  if ((exe.relationshipRepository.match(/this\.dataApi\.request/gu) ?? []).length !== 1)
    violated('the direct Relationship repository holds exactly one external Data API call site');
  if (!exe.relationshipRepository.includes(`'${RELATIONSHIP_RPC}'`))
    violated('the direct Relationship repository requests the migration-0060 Relationship authority');

  // 2. The frozen four-slot v3 application envelope, in transport order, and
  //    the UNMUTATED three-slot meaning of the symbol named V2.
  for (const [order, slot] of [[1, 'SITUATION_STRESS'], [2, 'DECISION_ATTENTION'], [3, 'GOAL_MOTIVATION'], [4, 'RELATIONSHIP_COMMUNICATION']]) {
    if (!new RegExp(`order:\\s*${order},\\s*slot:\\s*HIM_CROSS_CONTEXT_FOREGROUND_${slot}_SLOT`, 'u').test(exe.aggregateTypes))
      violated(`the v3 envelope declares slot ${order}/${slot} in its frozen transport position`);
  }
  if (!/HIM_CROSS_CONTEXT_FOREGROUND_RELATIONSHIP_COMMUNICATION_SLOT = 'RELATIONSHIP_COMMUNICATION'/u.test(exe.aggregateTypes))
    violated('the fourth frozen slot label is RELATIONSHIP_COMMUNICATION');
  const slotTable = (symbol) => {
    const start = exe.aggregateTypes.indexOf(`${symbol} = Object.freeze([`);
    if (start < 0) violated(`the ${symbol} slot table exists`);
    return exe.aggregateTypes.slice(start, exe.aggregateTypes.indexOf('] as const);', start));
  };
  const declaredOrder = (symbol) => [...slotTable(symbol).matchAll(/HIM_CROSS_CONTEXT_FOREGROUND_([A-Z_]+)_SLOT\b/gu)]
    .map((match) => match[1]).join(',');
  if (declaredOrder('HIM_CROSS_CONTEXT_FOREGROUND_V3_SLOTS') !== 'SITUATION_STRESS,DECISION_ATTENTION,GOAL_MOTIVATION,RELATIONSHIP_COMMUNICATION')
    violated('the v3 envelope is exactly four slots in exactly the frozen transport order');
  if (declaredOrder('HIM_CROSS_CONTEXT_FOREGROUND_V2_SLOTS') !== 'SITUATION_STRESS,DECISION_ATTENTION,GOAL_MOTIVATION')
    violated('the symbol named V2 still means exactly the frozen three-slot contract: its meaning is never silently mutated');
  if (!/contractVersion: 3;/u.test(exe.aggregateTypes))
    violated('the application aggregate guidance contract is explicitly versioned to 3');
  if (!/relationshipCommunication: HimRelationshipCommunicationGuidance;/u.test(exe.aggregateTypes))
    violated('the v3 guidance contract carries a separate Relationship Communication channel');

  // 3. The aggregate delegates meaning to the REAL existing consumers only.
  if (!exe.aggregateService.includes('HimRelationshipCommunicationConsumptionService'))
    violated('the aggregate service delegates the Relationship slot to the real QHIA-011 consumer');
  if ((exe.aggregateService.match(/consumeSourceRows/gu) ?? []).length !== 4)
    violated('the aggregate service delegates exactly four channels to their existing pure consumers');
  if (!/contractVersion: 3,/u.test(exe.aggregateService))
    violated('the aggregate service returns the explicit v3 guidance contract');
  if (!exe.aggregateService.includes('HIM_CROSS_CONTEXT_FOREGROUND_V3_SLOTS.length'))
    violated('the aggregate service validates the envelope against the frozen v3 slot table');
  for (const forbidden of ['numeric_value', 'semantic_type', 'guidanceState', 'directive', 'hrs.', 'hse.', 'projectHimContextualCurrentSlot']) {
    if (exe.aggregateService.includes(forbidden))
      violated(`the aggregate service interprets no channel content: found ${forbidden}`);
  }

  // 4. The QHIA-011 consumer owns Communication meaning and pins the EXPECTED
  //    canonical identity - accepting UNRESOLVED / null rather than rejecting it.
  if (!exe.relationshipService.includes('projectHimContextualCurrentSlot'))
    violated('the Relationship consumer reuses the shared QHIA-004 projection');
  if (!/HIM_RELATIONSHIP_COMMUNICATION_SEMANTIC_MAPPING_STATUS = 'UNRESOLVED'/u.test(exe.relationshipTypes))
    violated('the frozen Foundation semantic mapping status stays UNRESOLVED');
  if (!/HIM_RELATIONSHIP_COMMUNICATION_SEMANTIC_TYPE = null/u.test(exe.relationshipTypes))
    violated('the frozen Foundation semantic type stays null: no semantic type is invented');
  if (!/HIM_RELATIONSHIP_COMMUNICATION_HIF_OWNER = 'HRS'/u.test(exe.relationshipTypes))
    violated('the frozen HIF owner stays HRS');
  if (!/HIM_RELATIONSHIP_COMMUNICATION_METRIC_KEY = 'hrs\.communication'/u.test(exe.relationshipTypes))
    violated('the frozen metric identity stays hrs.communication');
  if (!/HIM_RELATIONSHIP_COMMUNICATION_CONTEXT_KIND = 'RELATIONSHIP'/u.test(exe.relationshipTypes))
    violated('the frozen context kind stays RELATIONSHIP');
  if (!/HimRelationshipCommunicationDirective = 'DEFAULT' \| 'STRUCTURE_RELATIONSHIP_COMMUNICATION';/u.test(exe.relationshipTypes))
    violated('exactly one non-default directive exists: there is no second, stronger, or opposite direction');
  for (const forbidden of ['hrs.relationship-trust', 'hrs.repair', 'hrs.emotional-safety', "'STATE'", "'RESOLVED'", "'SITUATION'", "'DECISION'", "'GOAL'"]) {
    if (exe.relationshipService.includes(forbidden) || exe.relationshipTypes.includes(forbidden))
      violated(`the QHIA-011 boundary activates exactly RELATIONSHIP + hrs.communication@1: found ${forbidden}`);
  }
  const projection = executable(read('apps/api/src/human-model/him-contextual-current-projection.ts'));
  for (const forbidden of ['hrs.communication', 'RelationshipCommunication', "'RELATIONSHIP'", 'STRUCTURE_RELATIONSHIP_COMMUNICATION', "'HRS'"]) {
    if (projection.includes(forbidden)) violated(`the shared QHIA-004 projection stays generic: ${forbidden}`);
  }
  // Anti-over-fix control: the shared projection must keep BOTH generic
  // semantic branches. A QHIA-011 boundary rule pushed down into it would break
  // every other HIM consumer.
  for (const generic of ["row.semantic_mapping_status === 'RESOLVED'", "row.semantic_mapping_status === 'UNRESOLVED'"]) {
    if (!projection.includes(generic))
      violated(`the shared QHIA-004 projection keeps its generic semantic branches: ${generic}`);
  }

  // 5. The Orchestrator: one launch, no direct Relationship read, no new wait.
  if ((exe.orchestrator.match(/this\.himCrossContextForeground\.read\(/gu) ?? []).length !== 1)
    violated('the Orchestrator launches exactly one cross-context foreground read');
  for (const forbidden of [
    'HimRelationshipCommunicationConsumptionService', 'HimRelationshipCommunicationRepository',
    'HimGoalMotivationConsumptionService', 'HimGoalMotivationRepository',
    'HimSituationStressConsumptionService', 'HimDecisionAttentionConsumptionService',
    RELATIONSHIP_RPC, AGGREGATE_V2_RPC, AGGREGATE_V1_RPC,
  ]) {
    if (exe.orchestrator.includes(forbidden))
      violated(`the Orchestrator reaches every cross-context channel through the aggregate only: found ${forbidden}`);
  }
  // QHIA-014A: the foreground owns exactly TWO bounded Human Intelligence
  // budget timers - the pre-existing QHIA-005 Reflection budget and the
  // QHIA-014A Snapshot budget - both driven by the SAME shared constant. The
  // aggregate-v3 read still contributes NEITHER of them and still adds no
  // timer, no barrier member and no awaited wait of its own.
  if (!/const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300;/u.test(exe.orchestrator))
    violated('the ONE shared Human Intelligence foreground wait budget stays exactly 300 ms');
  if ((exe.orchestrator.match(/setTimeout\(/gu) ?? []).length !== 2)
    violated('no third foreground timer exists: the aggregate adds none');
  if ((exe.orchestrator.match(/Promise\.all\(/gu) ?? []).length !== 1)
    violated('no second foreground barrier exists: the existing Promise.all stays the only one');
  if (!/await Promise\.all\(\[snapshotReadPromise, reflectionReadPromise\]\)/u.test(exe.orchestrator))
    violated('the existing barrier still awaits exactly the bounded Snapshot and Reflection promises');
  if (/await\s+crossContextForegroundReadPromise/u.test(exe.orchestrator))
    violated('the cross-context aggregate is never awaited: zero incremental foreground wait');
  // The decoded Relationship guidance is handed to the ONE provider compiler and
  // nowhere else: after QHIA-013 it is no longer its own provider request field.
  if (!/\.\.\.\(himRelationshipCommunicationGuidance \? \{ himRelationshipCommunicationGuidance \} : \{\}\),/u.test(exe.orchestrator))
    violated('the decoded Relationship guidance is compiled into the one provider envelope');
  if (exe.orchestrator.includes('himRelationshipCommunicationGuidance,\n'))
    violated('the Relationship guidance never reaches the Model Router as its own request field');

  // 6. The provider contract: after QHIA-013 the Relationship channel is an
  //    ACTIVE-gated source of bounded instruction IDs inside the ONE envelope,
  //    still rendered through the one common boundary, still deduplicated - now
  //    by semantic instruction ID rather than by matching instruction strings.
  if (exe.modelRouter.includes('himRelationshipCommunicationGuidance?: HimRelationshipCommunicationGuidance;'))
    violated('the retired per-channel Relationship provider request field is gone');
  for (const [id, text] of [
    ['EXPLICIT_RELATIONSHIP_COMMUNICATION_WORDING', EXPLICIT_WORDING_INSTRUCTION],
    ['ONE_MAIN_RELATIONSHIP_COMMUNICATION_POINT', ONE_MAIN_POINT_INSTRUCTION],
    ['CLARITY_NOT_FORCED_AGREEMENT', CLARITY_INSTRUCTION],
  ]) {
    if ((exe.providerSemantics.match(new RegExp(`  ${id}: '`, 'gu')) ?? []).length !== 1)
      violated(`the bounded instruction ${id} carries exactly one frozen text`);
    if (!exe.providerSemantics.includes(text)) violated(`the exact frozen instruction text is preserved: ${id}`);
  }
  const relationshipInstructions = exe.providerSemantics.slice(
    exe.providerSemantics.indexOf('STRUCTURE_RELATIONSHIP_COMMUNICATION: Object.freeze(['),
    exe.providerSemantics.indexOf('] as const)', exe.providerSemantics.indexOf('STRUCTURE_RELATIONSHIP_COMMUNICATION: Object.freeze([')),
  );
  for (const required of ['EXPLICIT_RELATIONSHIP_COMMUNICATION_WORDING', 'ONE_MAIN_RELATIONSHIP_COMMUNICATION_POINT', 'CLARITY_NOT_FORCED_AGREEMENT']) {
    if (!relationshipInstructions.includes(required))
      violated(`the ACTIVE Relationship directive maps to the exact ${required}`);
  }
  for (const forbidden of ['REDUCE_COGNITIVE_LOAD', 'SINGLE_CONVERSATIONAL_TRACK', 'CALMER_DELIVERY', 'REDUCE_STEERING_PRESSURE', 'ONE_STEP_AT_A_TIME', 'SMALL_IMMEDIATE_GOAL_ACTION', 'COMPACT']) {
    if (relationshipInstructions.includes(forbidden))
      violated(`Relationship Communication alone never authorizes ${forbidden}`);
  }
  // ACTIVE-gating now lives in the one shared compiler guard, so a NONE guidance
  // is identical to an absent one for every cross-context channel at once.
  if (!/if \(guidance\?\.guidanceState !== 'ACTIVE'\) return;/u.test(exe.providerSemantics))
    violated('the compiler maps a cross-context directive only for an ACTIVE guidance state');
  // Deduplication is by semantic instruction ID, never by comparing rendered
  // instruction strings.
  if (!/const authorized = new Set<HumanIntelligenceProviderInstructionId>\(\);/u.test(exe.providerSemantics))
    violated('deduplication is a set union over semantic instruction IDs');
  if (/renderedReductionInstructions|\.has\(instruction\)/u.test(exe.providerSemantics + exe.modelRouter))
    violated('string-value matching is no longer the deduplication authority');
  // The rendered behavioral block never names this channel or its directive.
  const behavioralBlockStart = exe.modelRouter.indexOf('HUMAN_INTELLIGENCE_BEHAVIORAL_PREAMBLE = ');
  if (behavioralBlockStart < 0) violated('the one behavioral scaffolding preamble exists');
  const behavioralBlock = exe.modelRouter.slice(behavioralBlockStart, exe.modelRouter.indexOf('\n', behavioralBlockStart));
  if (!behavioralBlock.includes('Multiple Human Intelligence sources authorizing the same instruction do not strengthen it'))
    violated('the rendered block states that agreeing sources never strengthen an instruction');
  for (const forbidden of [
    'Relationship-bound communication scaffolding guidance', 'STRUCTURE_RELATIONSHIP_COMMUNICATION',
    'numericValue', 'numeric_value', 'binding_context_id', 'metric_key', 'hrs.communication',
    'ordinalCategory', 'observedAt', 'display_text', 'target_label',
  ]) {
    if (behavioralBlock.includes(forbidden))
      violated(`the provider never receives source provenance or raw measurement identity: found ${forbidden}`);
  }

  // 7. Module wiring: both new boundaries are registered and exported.
  for (const provider of ['HimRelationshipCommunicationRepository', 'HimRelationshipCommunicationConsumptionService']) {
    if ((exe.himModule.match(new RegExp(`\\b${provider}\\b`, 'gu')) ?? []).length < 3)
      violated(`${provider} is imported, provided, and exported by the HIM module`);
  }

  // 8. The Full Intelligence smoke transport really points at v3, really
  //    separates ATTEMPT from COMPLETION, and really refuses every retired
  //    transport - so a green smoke cannot mean "degraded gracefully".
  if (!exe.smokeAdapters.includes("'read_him_session_cross_context_foreground_v3'"))
    violated('the smoke authenticated RPC allowlist recognises the aggregate-v3 transport');
  for (const retired of [
    'read_him_session_cross_context_foreground_v1', 'read_him_session_cross_context_foreground_v2',
    'read_him_session_situation_stress_v1', 'read_him_session_decision_attention_v1',
    'read_him_session_goal_motivation_v1', 'read_him_session_relationship_communication_v1',
    'read_him_session_context_bindings_v1',
  ]) {
    if (exe.smokeAdapters.includes(`'${retired}'`))
      violated(`${retired} is not accepted as the smoke cross-context orchestrator transport: found it on the allowlist`);
  }
  const attemptIndex = exe.smokeAdapters.indexOf('census?.recordAttempt(name)');
  const allowlistIndex = exe.smokeAdapters.indexOf('if (!rpcAllowlist.has(name))');
  if (attemptIndex < 0 || allowlistIndex < 0 || attemptIndex > allowlistIndex)
    violated('the smoke records the ATTEMPT before the allowlist decision, so a refused direct request is still counted');
  if (!exe.smokeAdapters.includes('census?.recordCompletion(name)'))
    violated('the smoke records COMPLETION separately from attempt');
  if (!exe.smokeRuntime.includes("const CROSS_CONTEXT_FOREGROUND_RPC = 'read_him_session_cross_context_foreground_v3'"))
    violated('the smoke censuses the aggregate-v3 endpoint by name');
  if (!/census\.completions\(CROSS_CONTEXT_FOREGROUND_RPC\), expectedTurns/u.test(exe.smokeRuntime))
    violated('the smoke asserts one COMPLETION per eligible turn, not merely one attempt');
  if (!/census\.attempts\(CROSS_CONTEXT_FOREGROUND_RPC\), expectedTurns/u.test(exe.smokeRuntime))
    violated('the smoke asserts one attempt per eligible turn');
  if (!/census\.failures\(CROSS_CONTEXT_FOREGROUND_RPC\), 0/u.test(exe.smokeRuntime))
    violated('the smoke asserts zero aggregate transport failures: graceful degradation is never counted as success');
  for (const censused of ['read_him_session_relationship_communication_v1', 'read_him_session_goal_motivation_v1', 'read_him_session_cross_context_foreground_v2', 'read_him_session_cross_context_foreground_v1', 'read_him_session_context_bindings_v1']) {
    if (!exe.smokeRuntime.includes(`'${censused}'`))
      violated(`the smoke censuses ${censused} by name and proves zero attempts`);
  }
  if (!exe.smokeRuntime.includes("[4, 'RELATIONSHIP_COMMUNICATION', 'NO_ACTIVE_RELATIONSHIP']"))
    violated('the smoke proves the fourth slot is an authoritative NO_ACTIVE_RELATIONSHIP row');
  if (!/himRelationshipCommunicationService\.consumeSourceRows\(\[aggregateRows\[3\]\]\)/u.test(exe.smokeRuntime))
    violated('the smoke decodes the fourth raw row through the REAL QHIA-011 consumer');
}

test('A1 - the shipped application sources satisfy the frozen QHIA-011 transport contract', () => {
  assert.doesNotThrow(() => assertCrossContextForegroundApplicationContract(shipped));
});

test('A2 - anti-vacuity: the real guard rejects every named application regression', () => {
  const drifts = [
    ['the repository still calls the aggregate-v2 endpoint', {
      aggregateRepository: shipped.aggregateRepository.replace(AGGREGATE_V3_RPC, AGGREGATE_V2_RPC),
    }],
    ['the repository still calls the aggregate-v1 endpoint', {
      aggregateRepository: shipped.aggregateRepository.replace(AGGREGATE_V3_RPC, AGGREGATE_V1_RPC),
    }],
    ['the repository added a second direct Relationship request', {
      aggregateRepository: shipped.aggregateRepository.replace(
        '    return rows ?? [];',
        `    await this.dataApi.request(token, '${RELATIONSHIP_RPC}', { method: 'POST', body: '{}' });\n    return rows ?? [];`,
      ),
    }],
    ['the fourth slot is missing from the application envelope', {
      aggregateTypes: shipped.aggregateTypes.replace(
        '  Object.freeze({ order: 4, slot: HIM_CROSS_CONTEXT_FOREGROUND_RELATIONSHIP_COMMUNICATION_SLOT }),\n', '',
      ),
    }],
    ['the fourth slot was reordered ahead of the frozen three', {
      aggregateTypes: shipped.aggregateTypes.replace(
        '  Object.freeze({ order: 1, slot: HIM_CROSS_CONTEXT_FOREGROUND_SITUATION_STRESS_SLOT }),\n  Object.freeze({ order: 2, slot: HIM_CROSS_CONTEXT_FOREGROUND_DECISION_ATTENTION_SLOT }),\n  Object.freeze({ order: 3, slot: HIM_CROSS_CONTEXT_FOREGROUND_GOAL_MOTIVATION_SLOT }),\n  Object.freeze({ order: 4, slot: HIM_CROSS_CONTEXT_FOREGROUND_RELATIONSHIP_COMMUNICATION_SLOT }),',
        '  Object.freeze({ order: 4, slot: HIM_CROSS_CONTEXT_FOREGROUND_RELATIONSHIP_COMMUNICATION_SLOT }),\n  Object.freeze({ order: 1, slot: HIM_CROSS_CONTEXT_FOREGROUND_SITUATION_STRESS_SLOT }),\n  Object.freeze({ order: 2, slot: HIM_CROSS_CONTEXT_FOREGROUND_DECISION_ATTENTION_SLOT }),\n  Object.freeze({ order: 3, slot: HIM_CROSS_CONTEXT_FOREGROUND_GOAL_MOTIVATION_SLOT }),',
      ),
    }],
    ['the symbol named V2 was silently mutated into the four-slot contract', {
      aggregateTypes: shipped.aggregateTypes.replace(
        'export const HIM_CROSS_CONTEXT_FOREGROUND_V2_SLOTS = Object.freeze([\n  Object.freeze({ order: 1, slot: HIM_CROSS_CONTEXT_FOREGROUND_SITUATION_STRESS_SLOT }),\n  Object.freeze({ order: 2, slot: HIM_CROSS_CONTEXT_FOREGROUND_DECISION_ATTENTION_SLOT }),\n  Object.freeze({ order: 3, slot: HIM_CROSS_CONTEXT_FOREGROUND_GOAL_MOTIVATION_SLOT }),',
        'export const HIM_CROSS_CONTEXT_FOREGROUND_V2_SLOTS = Object.freeze([\n  Object.freeze({ order: 1, slot: HIM_CROSS_CONTEXT_FOREGROUND_SITUATION_STRESS_SLOT }),\n  Object.freeze({ order: 2, slot: HIM_CROSS_CONTEXT_FOREGROUND_DECISION_ATTENTION_SLOT }),\n  Object.freeze({ order: 3, slot: HIM_CROSS_CONTEXT_FOREGROUND_GOAL_MOTIVATION_SLOT }),\n  Object.freeze({ order: 4, slot: HIM_CROSS_CONTEXT_FOREGROUND_RELATIONSHIP_COMMUNICATION_SLOT }),',
      ),
    }],
    ['the application contract silently stayed at version 2', {
      aggregateTypes: shipped.aggregateTypes.replace('contractVersion: 3;', 'contractVersion: 2;'),
    }],
    ['the aggregate service does not use the real Relationship consumer', {
      aggregateService: shipped.aggregateService
        .replace('      relationshipCommunication: this.relationshipCommunication.consumeSourceRows([relationshipRow]),', "      relationshipCommunication: { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' },"),
    }],
    ['the aggregate service started interpreting channel content', {
      aggregateService: shipped.aggregateService.replace(
        '      const row = rows[index];',
        '      const row = rows[index];\n      if (row.numeric_value === 1) throw new Error("INTEGRITY_FAILURE");',
      ),
    }],
    ['the aggregate service validates against the retired v2 slot table', {
      aggregateService: shipped.aggregateService.replaceAll('HIM_CROSS_CONTEXT_FOREGROUND_V3_SLOTS', 'HIM_CROSS_CONTEXT_FOREGROUND_V2_SLOTS'),
    }],
    ['the QHIA-011 consumer expects a RESOLVED semantic mapping', {
      relationshipTypes: shipped.relationshipTypes.replace(
        "HIM_RELATIONSHIP_COMMUNICATION_SEMANTIC_MAPPING_STATUS = 'UNRESOLVED'",
        "HIM_RELATIONSHIP_COMMUNICATION_SEMANTIC_MAPPING_STATUS = 'RESOLVED'",
      ),
    }],
    ['the QHIA-011 consumer invented a semantic type', {
      relationshipTypes: shipped.relationshipTypes.replace(
        'HIM_RELATIONSHIP_COMMUNICATION_SEMANTIC_TYPE = null',
        "HIM_RELATIONSHIP_COMMUNICATION_SEMANTIC_TYPE = 'STATE'",
      ),
    }],
    ['a sibling HRS metric leaked into the QHIA-011 boundary', {
      relationshipTypes: shipped.relationshipTypes.replace(
        "export const HIM_RELATIONSHIP_COMMUNICATION_METRIC_KEY = 'hrs.communication' as const;",
        "export const HIM_RELATIONSHIP_COMMUNICATION_METRIC_KEY = 'hrs.communication' as const;\nexport const SIBLING = 'hrs.relationship-trust' as const;",
      ),
    }],
    ['a second, stronger directive was added', {
      relationshipTypes: shipped.relationshipTypes.replace(
        "export type HimRelationshipCommunicationDirective = 'DEFAULT' | 'STRUCTURE_RELATIONSHIP_COMMUNICATION';",
        "export type HimRelationshipCommunicationDirective = 'DEFAULT' | 'STRUCTURE_RELATIONSHIP_COMMUNICATION' | 'STRUCTURE_RELATIONSHIP_COMMUNICATION_STRONGLY';",
      ),
    }],
    ['the Orchestrator launches a direct Relationship read', {
      orchestrator: shipped.orchestrator.replace(
        '      let crossContextForegroundSettled: HimCrossContextForegroundGuidance | undefined;',
        '      void HimRelationshipCommunicationConsumptionService;\n      let crossContextForegroundSettled: HimCrossContextForegroundGuidance | undefined;',
      ),
    }],
    ['the Orchestrator races a second cross-context read', {
      orchestrator: shipped.orchestrator.replace(
        '      crossContextForegroundReadPromise.then(',
        '      void this.himCrossContextForeground.read(userId, accessToken, himSelection.contextId);\n      crossContextForegroundReadPromise.then(',
      ),
    }],
    ['the Orchestrator awaits the aggregate and adds a foreground wait', {
      orchestrator: shipped.orchestrator.replace(
        '      crossContextForegroundBarrierClosed = true;',
        '      await crossContextForegroundReadPromise.catch(() => undefined);\n      crossContextForegroundBarrierClosed = true;',
      ),
    }],
    ['the Orchestrator added a second foreground barrier', {
      orchestrator: shipped.orchestrator.replace(
        '      crossContextForegroundBarrierClosed = true;',
        '      await Promise.all([crossContextForegroundReadPromise.catch(() => undefined)]);\n      crossContextForegroundBarrierClosed = true;',
      ),
    }],
    ['the shared Human Intelligence foreground budget was changed', {
      orchestrator: shipped.orchestrator.replace(
        'const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300;',
        'const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 500;',
      ),
    }],
    ['a second foreground timer was introduced', {
      orchestrator: shipped.orchestrator.replace(
        '      crossContextForegroundReadPromise.then(',
        '      setTimeout(() => undefined, 50);\n      crossContextForegroundReadPromise.then(',
      ),
    }],
    ['the decoded Relationship guidance stopped reaching the provider compiler', {
      orchestrator: shipped.orchestrator.replace(
        '        ...(himRelationshipCommunicationGuidance ? { himRelationshipCommunicationGuidance } : {}),\n',
        '',
      ),
    }],
    ['the compiler maps a directive regardless of guidance state', {
      providerSemantics: shipped.providerSemantics.replace(
        "  if (guidance?.guidanceState !== 'ACTIVE') return;",
        '  if (!guidance) return;',
      ),
    }],
    ['the Relationship directive borrowed an instruction that is not its own', {
      providerSemantics: shipped.providerSemantics.replace(
        "  STRUCTURE_RELATIONSHIP_COMMUNICATION: Object.freeze([\n    'EXPLICIT_RELATIONSHIP_COMMUNICATION_WORDING',",
        "  STRUCTURE_RELATIONSHIP_COMMUNICATION: Object.freeze([\n    'REDUCE_COGNITIVE_LOAD',\n    'EXPLICIT_RELATIONSHIP_COMMUNICATION_WORDING',",
      ),
    }],
    ['the Relationship directive dropped one of its three frozen instructions', {
      providerSemantics: shipped.providerSemantics.replace(
        "    'ONE_MAIN_RELATIONSHIP_COMMUNICATION_POINT',\n    'CLARITY_NOT_FORCED_AGREEMENT',\n  ] as const),",
        "    'ONE_MAIN_RELATIONSHIP_COMMUNICATION_POINT',\n  ] as const),",
      ),
    }],
    ['a frozen instruction text drifted', {
      providerSemantics: shipped.providerSemantics.replace(
        'do not make immediate agreement, persuasion, or winning the exchange the goal.',
        'aim for agreement where possible.',
      ),
    }],
    ['string matching became the deduplication authority again', {
      providerSemantics: shipped.providerSemantics.replace(
        '  const authorized = new Set<HumanIntelligenceProviderInstructionId>();',
        '  const renderedReductionInstructions = new Set<string>();\n  const authorized = new Set<HumanIntelligenceProviderInstructionId>();',
      ),
    }],
    ['the agreeing-sources-never-strengthen statement was dropped', {
      modelRouter: shipped.modelRouter.replace(
        'Multiple Human Intelligence sources authorizing the same instruction do not strengthen it. ',
        '',
      ),
    }],
    ['a source label leaked into the rendered behavioral block', {
      modelRouter: shipped.modelRouter.replace(
        "HUMAN_INTELLIGENCE_BEHAVIORAL_PREAMBLE = 'The following Human Intelligence behavioral instructions",
        "HUMAN_INTELLIGENCE_BEHAVIORAL_PREAMBLE = 'The following Relationship-bound communication scaffolding guidance behavioral instructions",
      ),
    }],
    ['the Relationship boundaries were dropped from the HIM module', {
      himModule: shipped.himModule.replaceAll('HimRelationshipCommunicationConsumptionService', 'HimGoalMotivationConsumptionService'),
    }],
    ['the smoke allowlist still names the retired aggregate-v2 endpoint', {
      smokeAdapters: shipped.smokeAdapters.replace(
        "  'read_him_session_cross_context_foreground_v3',",
        "  'read_him_session_cross_context_foreground_v2',",
      ),
    }],
    ['the smoke allowlist accepts the direct Relationship RPC as the orchestrator transport', {
      smokeAdapters: shipped.smokeAdapters.replace(
        "  'read_him_session_cross_context_foreground_v3',",
        "  'read_him_session_cross_context_foreground_v3',\n  'read_him_session_relationship_communication_v1',",
      ),
    }],
    ['the smoke records the attempt only after the allowlist decision', {
      smokeAdapters: shipped.smokeAdapters
        .replace('    census?.recordAttempt(name);\n', '')
        .replace('      if (!rpcAllowlist.has(name)) unsupported(`rpc:${name}`);', '      if (!rpcAllowlist.has(name)) unsupported(`rpc:${name}`);\n      census?.recordAttempt(name);'),
    }],
    ['the smoke counts attempts but not completions', {
      smokeRuntime: shipped.smokeRuntime.replace(
        '      assert.equal(census.completions(CROSS_CONTEXT_FOREGROUND_RPC), expectedTurns,',
        '      assert.equal(census.completions(CROSS_CONTEXT_FOREGROUND_RPC), census.completions(CROSS_CONTEXT_FOREGROUND_RPC),',
      ),
    }],
    ['the smoke tolerates aggregate transport failures (graceful degradation counted as success)', {
      smokeRuntime: shipped.smokeRuntime.replace(
        '      assert.equal(census.failures(CROSS_CONTEXT_FOREGROUND_RPC), 0,',
        '      assert.equal(census.failures(CROSS_CONTEXT_FOREGROUND_RPC), census.failures(CROSS_CONTEXT_FOREGROUND_RPC),',
      ),
    }],
    ['the smoke stopped censusing the direct Relationship authority', {
      smokeRuntime: shipped.smokeRuntime.replace("  'read_him_session_relationship_communication_v1',\n", ''),
    }],
    ['the smoke stopped proving the fourth slot is authoritatively unbound', {
      smokeRuntime: shipped.smokeRuntime.replace(", [4, 'RELATIONSHIP_COMMUNICATION', 'NO_ACTIVE_RELATIONSHIP']", ''),
    }],
    ['the smoke stopped decoding the fourth row through the real QHIA-011 consumer', {
      smokeRuntime: shipped.smokeRuntime.replace(
        'himRelationshipCommunicationService.consumeSourceRows([aggregateRows[3]])',
        "{ contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' }",
      ),
    }],
  ];

  for (const [label, overrides] of drifts) {
    const mutated = { ...shipped, ...overrides };
    for (const key of Object.keys(overrides)) {
      assert.notEqual(mutated[key], shipped[key], `the "${label}" mutation actually replaced its source text`);
    }
    assert.throws(
      () => assertCrossContextForegroundApplicationContract(mutated),
      /QHIA-011 application transport contract violated/u,
      `the guard rejects: ${label}`,
    );
  }

  // Positive control and formatting-insensitivity.
  assert.doesNotThrow(() => assertCrossContextForegroundApplicationContract(shipped));
  const reformatted = { ...shipped, aggregateService: `\n${shipped.aggregateService}` };
  assert.notEqual(reformatted.aggregateService, shipped.aggregateService);
  assert.doesNotThrow(() => assertCrossContextForegroundApplicationContract(reformatted),
    'formatting alone never fails the guard');
});

test('A3 - the direct Relationship authority stays independently callable and out of the Orchestrator path', () => {
  // The direct repository EXISTS - QHIA-011 keeps it as the canonical
  // independently callable authority - and is registered in the module, but is
  // reachable from no foreground turn.
  assert.match(shipped.relationshipRepository, /export class HimRelationshipCommunicationRepository/u);
  assert.match(shipped.relationshipService, /export class HimRelationshipCommunicationConsumptionService/u);
  assert.match(shipped.himModule, /HimRelationshipCommunicationRepository/u);
  assert.ok(!executable(shipped.orchestrator).includes('HimRelationshipCommunicationRepository'));
  // The Relationship consumer owns Communication meaning: it pins the exact
  // frozen identity locally, after the SHARED QHIA-004 projection, and never
  // specializes that projection.
  const relationshipExecutable = executable(shipped.relationshipService);
  assert.ok(relationshipExecutable.includes('projectHimContextualCurrentSlot'));
  for (const required of [
    'HIM_RELATIONSHIP_COMMUNICATION_METRIC_KEY', 'HIM_RELATIONSHIP_COMMUNICATION_DEFINITION_VERSION',
    'HIM_RELATIONSHIP_COMMUNICATION_HIF_OWNER', 'HIM_RELATIONSHIP_COMMUNICATION_SEMANTIC_MAPPING_STATUS',
    'HIM_RELATIONSHIP_COMMUNICATION_SEMANTIC_TYPE', 'HIM_RELATIONSHIP_COMMUNICATION_CONTEXT_KIND',
  ]) assert.ok(relationshipExecutable.includes(required), `the Relationship consumer enforces ${required}`);
  // The three prior per-channel boundaries are untouched by this task.
  for (const [path, marker] of [
    ['apps/api/src/human-model/him-situation-stress-consumption.service.ts', 'HIM_SITUATION_STRESS_METRIC_KEY'],
    ['apps/api/src/human-model/him-decision-attention-consumption.service.ts', 'HIM_DECISION_ATTENTION_METRIC_KEY'],
    ['apps/api/src/human-model/him-goal-motivation-consumption.service.ts', 'HIM_GOAL_MOTIVATION_METRIC_KEY'],
  ]) {
    const source = read(path);
    assert.ok(source.includes(marker), `${path} keeps its own frozen identity`);
    assert.ok(!source.includes('hrs.communication'), `${path} activates no HRS metric`);
    assert.ok(!source.includes('RelationshipCommunication'), `${path} gains no Relationship coupling`);
  }
});

test('A4 - the contract is wired into package scripts and CI', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(
    packageJson.scripts['test:cross-context-foreground-application-transport-contract'],
    'node --test tests/him-cross-context-foreground-application-transport-contract.test.mjs',
  );
  const ci = read('.github/workflows/api-ci.yml');
  const step = ci.indexOf('test:cross-context-foreground-application-transport-contract');
  assert.ok(step > 0, 'CI runs this static contract');
  assert.ok(step > ci.indexOf('test:full-intelligence-e2e-runtime-contract'),
    'it runs after the Full Intelligence static contract');
  assert.ok(step < ci.indexOf('Apply all migrations to fresh PostgreSQL'),
    'it runs before the database bootstrap: a pure static guard needs no database');
});
