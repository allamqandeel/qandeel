import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// QHIA-010 application static contract.
//
// Freezes the APPLICATION side of the cross-context foreground architecture -
// the half that no database verifier and no Jest spec can freeze on its own:
//
//   * the production repository issues EXACTLY ONE external request, against
//     the migration-0059 aggregate-v2 endpoint and never the retired
//     aggregate-v1 endpoint;
//   * the application transport contract is an explicit THREE-slot v2 envelope
//     in the frozen order 1/SITUATION_STRESS 2/DECISION_ATTENTION
//     3/GOAL_MOTIVATION;
//   * the aggregate service delegates every channel to its REAL existing
//     semantic consumer - including the real QHIA-010 Goal consumer - and
//     interprets nothing itself;
//   * the Conversation Orchestrator launches exactly one cross-context
//     foreground read, never a direct Goal read, and adds no timeout, barrier,
//     await, or Promise.all member of its own - the pre-existing 300 ms
//     QHIA-005 Reflection budget stays the only foreground wait;
//   * the provider receives a SEPARATE optional Goal field, rendered only when
//     that field is ACTIVE, through the one common composeServerGuidance
//     boundary with exact-match dedup.
//
// Every rule below is executed by ONE guard function, and the anti-vacuity
// fixtures drive that same real guard over deliberately drifted sources - so
// "this contract would catch regression X" is proven, never assumed.
//
// Forward-safe: nothing here forbids a later slot, a later consumer, a later
// aggregate version, or a later migration. It freezes this task's own wiring
// only.
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
  goalRepository: 'apps/api/src/human-model/him-goal-motivation.repository.ts',
  goalService: 'apps/api/src/human-model/him-goal-motivation-consumption.service.ts',
  goalTypes: 'apps/api/src/human-model/him-goal-motivation-consumption.types.ts',
  orchestrator: 'apps/api/src/conversation/conversation-orchestrator.service.ts',
  modelRouter: 'apps/api/src/model-router/model-router.types.ts',
  himModule: 'apps/api/src/human-model/him.module.ts',
});

const shipped = Object.freeze(Object.fromEntries(
  Object.entries(SOURCES).map(([key, path]) => [key, read(path)]),
));

const AGGREGATE_V2_RPC = 'rpc/read_him_session_cross_context_foreground_v2';
const AGGREGATE_V1_RPC = 'rpc/read_him_session_cross_context_foreground_v1';
const GOAL_RPC = 'rpc/read_him_session_goal_motivation_v1';
const SMALL_IMMEDIATE_ACTION_INSTRUCTION = 'When goal-related action guidance is otherwise appropriate, keep the immediate action small and bounded rather than expanding it into a larger task bundle.';

function violated(property) {
  throw new Error(`QHIA-010 application transport contract violated: ${property}`);
}

/**
 * The single guard. It receives the whole source map so a drift fixture can
 * replace exactly one file and still be checked against every cross-file rule.
 */
function assertCrossContextForegroundApplicationContract(sources) {
  const exe = Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, executable(source)]));

  // 1. ONE external request, against the v2 endpoint, and never the retired v1.
  if ((exe.aggregateRepository.match(/this\.dataApi\.request/gu) ?? []).length !== 1)
    violated('the aggregate repository holds exactly one external Data API call site');
  if (!exe.aggregateRepository.includes(`'${AGGREGATE_V2_RPC}'`))
    violated('the production repository requests the migration-0059 aggregate-v2 endpoint');
  if (exe.aggregateRepository.includes(AGGREGATE_V1_RPC))
    violated('the retired aggregate-v1 endpoint is never requested by the application');
  for (const retired of [GOAL_RPC, 'rpc/read_him_session_situation_stress_v1', 'rpc/read_him_session_decision_attention_v1', 'rpc/read_him_session_context_bindings_v1']) {
    if (exe.aggregateRepository.includes(retired))
      violated(`the aggregate repository issues no direct per-channel request: found ${retired}`);
  }
  if ((exe.goalRepository.match(/this\.dataApi\.request/gu) ?? []).length !== 1)
    violated('the direct Goal repository holds exactly one external Data API call site');
  if (!exe.goalRepository.includes(`'${GOAL_RPC}'`))
    violated('the direct Goal repository requests the migration-0059 Goal authority');

  // 2. The frozen three-slot v2 application envelope, in transport order.
  for (const [order, slot] of [[1, 'SITUATION_STRESS'], [2, 'DECISION_ATTENTION'], [3, 'GOAL_MOTIVATION']]) {
    if (!new RegExp(`order:\\s*${order},\\s*slot:\\s*HIM_CROSS_CONTEXT_FOREGROUND_${slot}_SLOT`, 'u').test(exe.aggregateTypes))
      violated(`the v2 envelope declares slot ${order}/${slot} in its frozen transport position`);
  }
  if (!/HIM_CROSS_CONTEXT_FOREGROUND_GOAL_MOTIVATION_SLOT = 'GOAL_MOTIVATION'/u.test(exe.aggregateTypes))
    violated('the third frozen slot label is GOAL_MOTIVATION');
  const slotTable = exe.aggregateTypes.slice(
    exe.aggregateTypes.indexOf('HIM_CROSS_CONTEXT_FOREGROUND_V2_SLOTS'),
    exe.aggregateTypes.indexOf('] as const);', exe.aggregateTypes.indexOf('HIM_CROSS_CONTEXT_FOREGROUND_V2_SLOTS')),
  );
  const declaredOrder = [...slotTable.matchAll(/HIM_CROSS_CONTEXT_FOREGROUND_([A-Z_]+)_SLOT\b/gu)].map((match) => match[1]);
  if (declaredOrder.join(',') !== 'SITUATION_STRESS,DECISION_ATTENTION,GOAL_MOTIVATION')
    violated('the v2 envelope is exactly three slots in exactly the frozen transport order');
  if (!/contractVersion: 2;/u.test(exe.aggregateTypes))
    violated('the application aggregate guidance contract is explicitly versioned to 2');
  if (!/goalMotivation: HimGoalMotivationGuidance;/u.test(exe.aggregateTypes))
    violated('the v2 guidance contract carries a separate Goal Motivation channel');

  // 3. The aggregate delegates meaning to the REAL existing consumers only.
  if (!exe.aggregateService.includes('HimGoalMotivationConsumptionService'))
    violated('the aggregate service delegates the Goal slot to the real QHIA-010 consumer');
  if ((exe.aggregateService.match(/consumeSourceRows/gu) ?? []).length !== 3)
    violated('the aggregate service delegates exactly three channels to their existing pure consumers');
  if (!/contractVersion: 2,/u.test(exe.aggregateService))
    violated('the aggregate service returns the explicit v2 guidance contract');
  if (!exe.aggregateService.includes('HIM_CROSS_CONTEXT_FOREGROUND_V2_SLOTS.length'))
    violated('the aggregate service validates the envelope against the frozen v2 slot table');
  for (const forbidden of ['numeric_value', 'semantic_type', 'guidanceState', 'directive', 'hse.', 'projectHimContextualCurrentSlot']) {
    if (exe.aggregateService.includes(forbidden))
      violated(`the aggregate service interprets no channel content: found ${forbidden}`);
  }

  // 4. The Orchestrator: one launch, no direct Goal read, no new wait.
  if ((exe.orchestrator.match(/this\.himCrossContextForeground\.read\(/gu) ?? []).length !== 1)
    violated('the Orchestrator launches exactly one cross-context foreground read');
  for (const forbidden of [
    'HimGoalMotivationConsumptionService', 'HimGoalMotivationRepository',
    'HimSituationStressConsumptionService', 'HimDecisionAttentionConsumptionService',
    GOAL_RPC, AGGREGATE_V1_RPC,
  ]) {
    if (exe.orchestrator.includes(forbidden))
      violated(`the Orchestrator reaches every cross-context channel through the aggregate only: found ${forbidden}`);
  }
  if (!/const SESSION_REFLECTION_FOREGROUND_WAIT_BUDGET_MS = 300;/u.test(exe.orchestrator))
    violated('the existing QHIA-005 Reflection foreground wait budget stays exactly 300 ms');
  if ((exe.orchestrator.match(/setTimeout\(/gu) ?? []).length !== 1)
    violated('no second foreground timer exists: the Reflection budget is the only one');
  if ((exe.orchestrator.match(/Promise\.all\(/gu) ?? []).length !== 1)
    violated('no second foreground barrier exists: the existing Promise.all stays the only one');
  if (!/await Promise\.all\(\[himSnapshotPromise, reflectionReadPromise\]\)/u.test(exe.orchestrator))
    violated('the existing barrier still awaits exactly the Snapshot and Reflection promises');
  if (/await\s+crossContextForegroundReadPromise/u.test(exe.orchestrator))
    violated('the cross-context aggregate is never awaited: zero incremental foreground wait');
  // The provider field is passed ONLY when the decoded guidance is ACTIVE.
  if (!/\.\.\.\(himGoalMotivationGuidance\?\.guidanceState === 'ACTIVE' \? \{ himGoalMotivationGuidance \} : \{\}\)/u.test(exe.orchestrator))
    violated('the Goal provider field is passed only when the decoded guidance is ACTIVE');

  // 5. The provider contract: a separate optional field, ACTIVE-gated, rendered
  //    through the one common boundary with exact-match dedup.
  if (!/himGoalMotivationGuidance\?: HimGoalMotivationGuidance;/u.test(exe.modelRouter))
    violated('the provider request carries a separate optional Goal guidance field');
  if ((exe.modelRouter.match(/const SMALL_IMMEDIATE_GOAL_ACTION_INSTRUCTION = /gu) ?? []).length !== 1)
    violated('the one new bounded reduction instruction is declared exactly once');
  if (!exe.modelRouter.includes(SMALL_IMMEDIATE_ACTION_INSTRUCTION))
    violated('the exact frozen small-immediate-action instruction text is preserved');
  const goalInstructions = exe.modelRouter.slice(
    exe.modelRouter.indexOf('REDUCE_GOAL_ACTION_BURDEN: ['),
    exe.modelRouter.indexOf('];', exe.modelRouter.indexOf('REDUCE_GOAL_ACTION_BURDEN: [')),
  );
  for (const required of ['SMALL_IMMEDIATE_GOAL_ACTION_INSTRUCTION', 'REDUCE_STEERING_PRESSURE_INSTRUCTION', 'ONE_STEP_AT_A_TIME_INSTRUCTION']) {
    if (!goalInstructions.includes(required))
      violated(`the ACTIVE Goal directive renders the exact ${required}`);
  }
  for (const forbidden of ['REDUCE_COGNITIVE_LOAD_INSTRUCTION', 'SINGLE_CONVERSATIONAL_TRACK_INSTRUCTION', 'CALMER_DELIVERY_PACING_INSTRUCTION', 'COMPACT']) {
    if (goalInstructions.includes(forbidden))
      violated(`Goal Motivation alone never authorizes ${forbidden}`);
  }
  if (!/if \(request\.himGoalMotivationGuidance\?\.guidanceState === 'ACTIVE'\) \{/u.test(exe.modelRouter))
    violated('the Goal provider block renders only for an ACTIVE guidance state');
  // Exactly the Goal rendering branch: from its own guard to the start of the
  // next server-owned channel, so the negatives below never run over another
  // channel's legitimate prose.
  const goalBlockStart = exe.modelRouter.indexOf("if (request.himGoalMotivationGuidance?.guidanceState === 'ACTIVE') {");
  const goalBlockEnd = exe.modelRouter.indexOf('\n  if (request.', goalBlockStart + 1);
  if (goalBlockStart < 0 || goalBlockEnd < 0) violated('the Goal rendering branch is a bounded block of the common composition');
  const goalBlock = exe.modelRouter.slice(goalBlockStart, goalBlockEnd);
  if (!/\.filter\(\(instruction\) => !renderedReductionInstructions\.has\(instruction\)\)/u.test(goalBlock))
    violated('the Goal block deduplicates against every instruction another channel already rendered');
  if (!/Goal-bound action-pacing guidance follows/u.test(goalBlock))
    violated('the rendered block is framed as goal-bound action-pacing guidance');
  for (const forbidden of ['numericValue', 'numeric_value', 'binding_context_id', 'metric_key', 'hse.motivation', 'ordinalCategory', 'observedAt']) {
    if (goalBlock.includes(forbidden))
      violated(`the provider never receives raw measurement data through this field: found ${forbidden}`);
  }

  // 6. Module wiring: both new boundaries are registered and exported.
  for (const provider of ['HimGoalMotivationRepository', 'HimGoalMotivationConsumptionService']) {
    if ((exe.himModule.match(new RegExp(`\\b${provider}\\b`, 'gu')) ?? []).length < 3)
      violated(`${provider} is imported, provided, and exported by the HIM module`);
  }
}

test('A1 - the shipped application sources satisfy the frozen QHIA-010 transport contract', () => {
  assert.doesNotThrow(() => assertCrossContextForegroundApplicationContract(shipped));
});

test('A2 - anti-vacuity: the real guard rejects every named application regression', () => {
  const drifts = [
    ['the repository still calls the aggregate-v1 endpoint', {
      aggregateRepository: shipped.aggregateRepository.replace(AGGREGATE_V2_RPC, AGGREGATE_V1_RPC),
    }],
    ['the repository added a second direct Goal request', {
      aggregateRepository: shipped.aggregateRepository.replace(
        '    return rows ?? [];',
        `    await this.dataApi.request(token, '${GOAL_RPC}', { method: 'POST', body: '{}' });\n    return rows ?? [];`,
      ),
    }],
    ['the third slot is missing from the application envelope', {
      aggregateTypes: shipped.aggregateTypes.replace(
        '  Object.freeze({ order: 3, slot: HIM_CROSS_CONTEXT_FOREGROUND_GOAL_MOTIVATION_SLOT }),\n', '',
      ),
    }],
    ['the third slot was reordered ahead of the frozen two', {
      aggregateTypes: shipped.aggregateTypes.replace(
        '  Object.freeze({ order: 1, slot: HIM_CROSS_CONTEXT_FOREGROUND_SITUATION_STRESS_SLOT }),',
        '  Object.freeze({ order: 1, slot: HIM_CROSS_CONTEXT_FOREGROUND_GOAL_MOTIVATION_SLOT }),',
      ),
    }],
    ['the application contract silently stayed at version 1', {
      aggregateTypes: shipped.aggregateTypes.replace('contractVersion: 2;', 'contractVersion: 1;'),
    }],
    ['the aggregate service does not use the real Goal consumer', {
      aggregateService: shipped.aggregateService
        .replace("      goalMotivation: this.goalMotivation.consumeSourceRows([goalRow]),", "      goalMotivation: { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' },"),
    }],
    ['the aggregate service started interpreting channel content', {
      aggregateService: shipped.aggregateService.replace(
        '      const row = rows[index];',
        '      const row = rows[index];\n      if (row.numeric_value === 1) throw new Error("INTEGRITY_FAILURE");',
      ),
    }],
    ['the Orchestrator launches a direct Goal read', {
      orchestrator: shipped.orchestrator.replace(
        '      let crossContextForegroundSettled: HimCrossContextForegroundGuidance | undefined;',
        '      void HimGoalMotivationConsumptionService;\n      let crossContextForegroundSettled: HimCrossContextForegroundGuidance | undefined;',
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
    ['the existing Reflection budget was changed', {
      orchestrator: shipped.orchestrator.replace(
        'const SESSION_REFLECTION_FOREGROUND_WAIT_BUDGET_MS = 300;',
        'const SESSION_REFLECTION_FOREGROUND_WAIT_BUDGET_MS = 500;',
      ),
    }],
    ['a second foreground timer was introduced', {
      orchestrator: shipped.orchestrator.replace(
        '      crossContextForegroundReadPromise.then(',
        '      setTimeout(() => undefined, 50);\n      crossContextForegroundReadPromise.then(',
      ),
    }],
    ['the provider field bypasses the ACTIVE-only gate', {
      orchestrator: shipped.orchestrator.replace(
        "        ...(himGoalMotivationGuidance?.guidanceState === 'ACTIVE' ? { himGoalMotivationGuidance } : {}),",
        '        ...(himGoalMotivationGuidance ? { himGoalMotivationGuidance } : {}),',
      ),
    }],
    ['the provider block renders regardless of guidance state', {
      modelRouter: shipped.modelRouter.replace(
        "  if (request.himGoalMotivationGuidance?.guidanceState === 'ACTIVE') {",
        '  if (request.himGoalMotivationGuidance) {',
      ),
    }],
    ['the Goal directive borrowed a reduction that is not its own', {
      modelRouter: shipped.modelRouter.replace(
        '  REDUCE_GOAL_ACTION_BURDEN: [\n    SMALL_IMMEDIATE_GOAL_ACTION_INSTRUCTION,',
        '  REDUCE_GOAL_ACTION_BURDEN: [\n    REDUCE_COGNITIVE_LOAD_INSTRUCTION,\n    SMALL_IMMEDIATE_GOAL_ACTION_INSTRUCTION,',
      ),
    }],
    ['the Goal directive dropped the shared reduced-steering-pressure instruction', {
      modelRouter: shipped.modelRouter.replace(
        '    SMALL_IMMEDIATE_GOAL_ACTION_INSTRUCTION,\n    REDUCE_STEERING_PRESSURE_INSTRUCTION,\n    ONE_STEP_AT_A_TIME_INSTRUCTION,',
        '    SMALL_IMMEDIATE_GOAL_ACTION_INSTRUCTION,\n    ONE_STEP_AT_A_TIME_INSTRUCTION,',
      ),
    }],
    ['the provider dedup filter was removed from the Goal block', {
      modelRouter: shipped.modelRouter.replace(
        "    const instructions = (HIM_GOAL_MOTIVATION_DIRECTIVE_INSTRUCTIONS[request.himGoalMotivationGuidance.directive] ?? [])\n      .filter((instruction) => !renderedReductionInstructions.has(instruction));",
        '    const instructions = HIM_GOAL_MOTIVATION_DIRECTIVE_INSTRUCTIONS[request.himGoalMotivationGuidance.directive] ?? [];',
      ),
    }],
    ['raw measurement data leaked into the provider block', {
      modelRouter: shipped.modelRouter.replace(
        'Goal-bound action-pacing guidance follows',
        'Goal-bound action-pacing guidance for metric_key follows',
      ),
    }],
    ['the Goal boundaries were dropped from the HIM module', {
      himModule: shipped.himModule.replaceAll('HimGoalMotivationConsumptionService', 'HimSituationStressConsumptionService'),
    }],
  ];

  for (const [label, overrides] of drifts) {
    const mutated = { ...shipped, ...overrides };
    for (const key of Object.keys(overrides)) {
      assert.notEqual(mutated[key], shipped[key], `the "${label}" mutation actually replaced its source text`);
    }
    assert.throws(
      () => assertCrossContextForegroundApplicationContract(mutated),
      /QHIA-010 application transport contract violated/u,
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

test('A3 - the direct Goal authority stays independently callable and out of the Orchestrator path', () => {
  // The direct repository EXISTS - QHIA-010 keeps it as the canonical
  // independently callable authority - and is registered in the module, but is
  // reachable from no foreground turn.
  assert.match(shipped.goalRepository, /export class HimGoalMotivationRepository/u);
  assert.match(shipped.goalService, /export class HimGoalMotivationConsumptionService/u);
  assert.match(shipped.himModule, /HimGoalMotivationRepository/u);
  assert.ok(!executable(shipped.orchestrator).includes('HimGoalMotivationRepository'));
  // The Goal consumer owns Motivation meaning: it pins the exact frozen
  // identity locally, after the SHARED QHIA-004 projection, and never
  // specializes that projection.
  const goalExecutable = executable(shipped.goalService);
  assert.ok(goalExecutable.includes('projectHimContextualCurrentSlot'));
  for (const required of [
    "HIM_GOAL_MOTIVATION_METRIC_KEY", 'HIM_GOAL_MOTIVATION_DEFINITION_VERSION', 'HIM_GOAL_MOTIVATION_HIF_OWNER',
    'HIM_GOAL_MOTIVATION_SEMANTIC_MAPPING_STATUS', 'HIM_GOAL_MOTIVATION_SEMANTIC_TYPE', 'HIM_GOAL_MOTIVATION_CONTEXT_KIND',
  ]) assert.ok(goalExecutable.includes(required), `the Goal consumer enforces ${required}`);
  const goalTypes = executable(shipped.goalTypes);
  assert.match(goalTypes, /HIM_GOAL_MOTIVATION_CONTEXT_KIND = 'GOAL'/u);
  assert.match(goalTypes, /HIM_GOAL_MOTIVATION_METRIC_KEY = 'hse\.motivation'/u);
  assert.match(goalTypes, /HIM_GOAL_MOTIVATION_SEMANTIC_MAPPING_STATUS = 'RESOLVED'/u);
  assert.match(goalTypes, /HIM_GOAL_MOTIVATION_SEMANTIC_TYPE = 'STATE'/u);
  // Situation-bound Motivation stays dormant across the whole boundary.
  for (const key of ['goalRepository', 'goalService', 'goalTypes']) {
    assert.ok(!executable(shipped[key]).includes('SITUATION'), `${key} activates no SITUATION context`);
  }
  // The shared QHIA-004 projection gained no Goal-specific or Motivation-
  // specific rule.
  const projection = executable(read('apps/api/src/human-model/him-contextual-current-projection.ts'));
  for (const forbidden of ['hse.motivation', 'GoalMotivation', "'STATE'", "'GOAL'"]) {
    assert.ok(!projection.includes(forbidden), `the shared projection stays generic: ${forbidden}`);
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
