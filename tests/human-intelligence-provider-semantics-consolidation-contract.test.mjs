import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// QHIA-013 Human Intelligence Provider Semantics Consolidation - static
// anti-vacuity contract.
//
// Freezes the architecture that no single Jest spec can freeze on its own:
//
//   * `ModelRouterRequest` exposes EXACTLY ONE Human Intelligence provider field
//     and never regains any of the eight retired ones - no alias, no deprecated
//     duplicate, no "support both" period;
//   * exactly ONE provider envelope type and ONE compiler exist;
//   * the compiler is pure and synchronous: no await, Promise, timer, service,
//     repository, network or database call, and no numeric/ordinal branch;
//   * the frozen registry is EXACTLY twelve instruction IDs, in exactly the
//     frozen canonical order, each carrying the exact pre-existing text;
//   * deduplication is a set union over semantic IDs, never string matching;
//   * Brain data never becomes a behavioral directive and the two data lanes are
//     never merged;
//   * the session contextId never reaches the provider and metricKey always does;
//   * exactly ONE authority charter and ONE behavioral block are rendered, and no
//     source-channel label, directive enum name, guidanceState, driver, QHIA task
//     name, or internal instruction ID reaches the provider;
//   * both provider adapters stay semantically blind and share one composer;
//   * the Orchestrator gains no await, timer, sleep, barrier, retry or second
//     provider call, and compiles the envelope exactly once;
//   * no Recommendation / Question / Hypothesis / Safety / routing authority is
//     created;
//   * this task touches NO database file and adds NO migration 0062.
//
// Every rule below is executed by ONE guard function, and the anti-vacuity
// fixtures drive that same real guard over deliberately drifted sources - so
// "this contract would catch regression X" is proven, never assumed.
//
// Forward-safe: nothing here forbids a later migration, a later provider
// capability, or a later separately reviewed instruction. It freezes this task's
// own wiring only.
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
// Negatives run on EXECUTABLE source only: every file's own prose legitimately
// names the shapes it documents the absence of.
const executable = (source) => source
  .split('\n')
  .filter((line) => {
    const trimmed = line.trim();
    return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
  })
  .join('\n');

const SOURCES = Object.freeze({
  providerSemantics: 'apps/api/src/model-router/human-intelligence-provider-semantics.ts',
  providerSemanticsTypes: 'apps/api/src/model-router/human-intelligence-provider-semantics.types.ts',
  modelRouter: 'apps/api/src/model-router/model-router.types.ts',
  orchestrator: 'apps/api/src/conversation/conversation-orchestrator.service.ts',
  claudeAdapter: 'apps/api/src/model-router/providers/anthropic/claude-model-router.ts',
  openaiAdapter: 'apps/api/src/model-router/providers/openai/openai-model-router.ts',
  fakeRouter: 'apps/api/src/model-router/fake-model-router.ts',
  smokeRuntime: 'apps/api/scripts/verify-full-intelligence-end-to-end-runtime.ts',
});
const shipped = Object.freeze(Object.fromEntries(Object.entries(SOURCES).map(([key, path]) => [key, read(path)])));

// The eight retired Human Intelligence provider request fields.
const RETIRED_PROVIDER_FIELDS = Object.freeze([
  ['himContext', 'HimModelContext'],
  ['himInteractionAdaptation', 'HimInteractionAdaptation'],
  ['himSessionReflectionGuidance', 'HimSessionReflectionGuidance'],
  ['himSituationStressGuidance', 'HimSituationStressGuidance'],
  ['himDecisionAttentionGuidance', 'HimDecisionAttentionGuidance'],
  ['himGoalMotivationGuidance', 'HimGoalMotivationGuidance'],
  ['himRelationshipCommunicationGuidance', 'HimRelationshipCommunicationGuidance'],
  ['himBrainContext', 'HimBrainContext'],
]);

// The frozen twelve, in exactly the frozen canonical order.
const INSTRUCTION_IDS = Object.freeze([
  'COMPACT_RESPONSE',
  'REDUCE_COGNITIVE_LOAD',
  'SINGLE_CONVERSATIONAL_TRACK',
  'REDUCE_STEERING_PRESSURE',
  'CALMER_DELIVERY',
  'ONE_STEP_AT_A_TIME',
  'GENTLE_REFLECTION_INVITATION',
  'AVOID_REDUNDANT_REFLECTION',
  'SMALL_IMMEDIATE_GOAL_ACTION',
  'EXPLICIT_RELATIONSHIP_COMMUNICATION_WORDING',
  'ONE_MAIN_RELATIONSHIP_COMMUNICATION_POINT',
  'CLARITY_NOT_FORCED_AGREEMENT',
]);

// The exact pre-existing server-authored instruction text, quoted here
// independently of the implementation so a silent rewrite fails this contract.
const INSTRUCTION_TEXT = Object.freeze({
  COMPACT_RESPONSE: 'Keep this response more compact than the normal default.',
  REDUCE_COGNITIVE_LOAD: 'Use simpler structure and avoid unnecessary detail or cognitive burden.',
  SINGLE_CONVERSATIONAL_TRACK: 'Stay on one main conversational track; avoid multiple parallel branches.',
  REDUCE_STEERING_PRESSURE: 'Reduce steering pressure; do not push the user toward an action or conclusion.',
  CALMER_DELIVERY: 'Use calmer, steadier delivery without claiming or naming the user\\\'s internal state.',
  ONE_STEP_AT_A_TIME: 'When guidance is otherwise appropriate, present one immediate step or unit at a time rather than a bundle.',
  GENTLE_REFLECTION_INVITATION: 'When reflective exploration is already appropriate under the current conversational policy, you may offer at most one simple, optional, non-pressuring invitation to examine the immediate topic. Do not force introspection; if the user is seeking concrete action or reflection would add burden, stay concrete.',
  AVOID_REDUNDANT_REFLECTION: 'Avoid redundant reflective prompting or repeatedly asking the user to revisit material already explored. When otherwise appropriate, prefer synthesis, clarification, or moving forward concretely rather than adding more introspection.',
  SMALL_IMMEDIATE_GOAL_ACTION: 'When goal-related action guidance is otherwise appropriate, keep the immediate action small and bounded rather than expanding it into a larger task bundle.',
  EXPLICIT_RELATIONSHIP_COMMUNICATION_WORDING: 'When relationship-related communication guidance is otherwise appropriate, make any suggested wording explicit and concrete rather than relying on hints, implied meaning, or the other person inferring the main point.',
  ONE_MAIN_RELATIONSHIP_COMMUNICATION_POINT: 'Keep any suggested message or exchange focused on one main point or request at a time rather than bundling several issues together.',
  CLARITY_NOT_FORCED_AGREEMENT: 'Aim for clear expression and workable understanding; do not make immediate agreement, persuasion, or winning the exchange the goal.',
});

// The frozen source -> instruction-ID mapping.
const SOURCE_MAPPING = Object.freeze([
  ['responseDensity', 'COMPACT', ['COMPACT_RESPONSE']],
  ['cognitiveLoad', 'REDUCED', ['REDUCE_COGNITIVE_LOAD']],
  ['branching', 'SINGLE_TRACK', ['SINGLE_CONVERSATIONAL_TRACK']],
  ['steeringPressure', 'REDUCED', ['REDUCE_STEERING_PRESSURE']],
  ['deliveryPacing', 'CALMER', ['CALMER_DELIVERY']],
  ['stepBatching', 'ONE_AT_A_TIME', ['ONE_STEP_AT_A_TIME']],
]);
const DIRECTIVE_MAPPING = Object.freeze([
  ['GENTLE_REFLECTION_INVITATION', ['GENTLE_REFLECTION_INVITATION']],
  ['AVOID_REDUNDANT_REFLECTION', ['AVOID_REDUNDANT_REFLECTION']],
  ['REDUCE_INTERACTION_BURDEN', ['REDUCE_COGNITIVE_LOAD', 'REDUCE_STEERING_PRESSURE', 'CALMER_DELIVERY']],
  ['REDUCE_PRESENTATION_BURDEN', ['REDUCE_COGNITIVE_LOAD', 'SINGLE_CONVERSATIONAL_TRACK', 'ONE_STEP_AT_A_TIME']],
  ['REDUCE_GOAL_ACTION_BURDEN', ['SMALL_IMMEDIATE_GOAL_ACTION', 'REDUCE_STEERING_PRESSURE', 'ONE_STEP_AT_A_TIME']],
  ['STRUCTURE_RELATIONSHIP_COMMUNICATION', ['EXPLICIT_RELATIONSHIP_COMMUNICATION_WORDING', 'ONE_MAIN_RELATIONSHIP_COMMUNICATION_POINT', 'CLARITY_NOT_FORCED_AGREEMENT']],
]);

// Every source label, enum name, and internal identifier the provider must never
// see in the behavioral rendering.
const FORBIDDEN_PROVENANCE = Object.freeze([
  'HIM interaction adaptation', 'Session Reflection guidance', 'Situation-bound interaction guidance',
  'Decision-bound presentation guidance', 'Goal-bound action-pacing guidance',
  'Relationship-bound communication scaffolding guidance',
  'STRESS_HIGH_OR_VERY_HIGH', 'ATTENTION_LOW_OR_VERY_LOW', 'ENERGY_LOW_OR_VERY_LOW',
  'REDUCE_INTERACTION_BURDEN', 'REDUCE_PRESENTATION_BURDEN', 'REDUCE_GOAL_ACTION_BURDEN',
  'STRUCTURE_RELATIONSHIP_COMMUNICATION',
  'guidanceState', 'adaptationState', 'drivers', 'QHIA-',
]);

function assertProviderSemanticsConsolidationContract(sources) {
  const exe = Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, executable(source)]));
  const violated = (rule) => { throw new Error(`QHIA-013 provider semantics consolidation contract violated: ${rule}`); };

  // 1. ONE Human Intelligence provider boundary, and the eight retired fields
  //    never return - not as an alias, not as a deprecated duplicate.
  if ((exe.modelRouter.match(/humanIntelligence\?: HumanIntelligenceProviderSemantics;/gu) ?? []).length !== 1)
    violated('ModelRouterRequest exposes exactly one Human Intelligence provider field');
  for (const [field, type] of RETIRED_PROVIDER_FIELDS) {
    if (new RegExp(`${field}\\??:\\s*${type}`, 'u').test(exe.modelRouter))
      violated(`the retired legacy provider field returned: ${field}`);
    if (new RegExp(`'${field}'`, 'u').test(exe.modelRouter))
      violated(`the retired legacy provider field is still part of the composition contract: ${field}`);
  }
  if (!/'humanIntelligence' \| 'hypothesisContext'/u.test(exe.modelRouter))
    violated('the one shared composition receives the one Human Intelligence envelope');
  // Exactly one envelope type and one compiler exist.
  if ((exe.providerSemanticsTypes.match(/export interface HumanIntelligenceProviderSemantics\w*/gu) ?? []).length !== 1)
    violated('exactly one Human Intelligence provider envelope type exists');
  if ((exe.providerSemantics.match(/export (async )?function buildHumanIntelligenceProviderSemantics\w*\(/gu) ?? []).length !== 1)
    violated('exactly one Human Intelligence provider compiler exists');

  // 2. The frozen twelve, in the frozen canonical order, with the exact text.
  const registryStart = exe.providerSemanticsTypes.indexOf('HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS = Object.freeze([');
  if (registryStart < 0) violated('the frozen instruction-ID registry exists');
  const registry = exe.providerSemanticsTypes.slice(registryStart, exe.providerSemanticsTypes.indexOf('] as const)', registryStart));
  const declared = [...registry.matchAll(/^\s*'([A-Z_]+)',$/gmu)].map((match) => match[1]);
  if (declared.length !== 12) violated(`the registry declares exactly twelve instruction IDs, found ${declared.length}`);
  if (declared.join('|') !== INSTRUCTION_IDS.join('|'))
    violated('the registry is exactly the frozen twelve IDs in exactly the frozen canonical order');
  for (const [id, text] of Object.entries(INSTRUCTION_TEXT)) {
    if ((exe.providerSemantics.match(new RegExp(`^  ${id}: '`, 'gmu')) ?? []).length !== 1)
      violated(`the instruction ${id} carries exactly one frozen text`);
    if (!exe.providerSemantics.includes(`  ${id}: '${text}',`))
      violated(`the exact pre-existing instruction text is preserved for ${id}`);
  }

  // 3. The frozen source -> instruction-ID mapping, and nothing beyond it.
  for (const [directive, activeValue, ids] of SOURCE_MAPPING) {
    if (!exe.providerSemantics.includes(`['${directive}', '${activeValue}', '${ids[0]}']`))
      violated(`QHIA-001 ${directive}=${activeValue} maps to ${ids[0]}`);
  }
  for (const [directive, ids] of DIRECTIVE_MAPPING) {
    // The mapping registries are the only place a directive is followed by a
    // frozen ID list; the instruction TEXT registry uses `ID: 'text'`, so this
    // marker never matches it.
    const marker = `${directive}: Object.freeze([`;
    const start = exe.providerSemantics.indexOf(marker);
    if (start < 0) violated(`the frozen directive ${directive} is mapped to a frozen instruction-ID list`);
    const block = exe.providerSemantics.slice(start + marker.length, exe.providerSemantics.indexOf('] as const)', start));
    const mapped = [...block.matchAll(/'([A-Z_]+)'/gu)].map((match) => match[1]);
    if (mapped.some((id) => !INSTRUCTION_IDS.includes(id)))
      violated(`the frozen directive ${directive} maps only to registry instruction IDs`);
    if (mapped.join('|') !== ids.join('|'))
      violated(`the frozen directive ${directive} maps to exactly ${ids.join(', ')} - found ${mapped.join(', ') || 'nothing'}`);
  }
  // QHIA-001 drivers are internal provenance and never a behavior source.
  if (/\.drivers\b/u.test(exe.providerSemantics))
    violated('adaptation drivers never derive a provider instruction: the directives are the authoritative output');

  // 4. The compiler is PURE and SYNCHRONOUS.
  for (const forbidden of [
    'await ', 'async ', 'Promise', 'setTimeout', 'setInterval', 'setImmediate', 'sleep(', 'fetch(',
    'require(', 'Repository', 'Service', 'this.', 'process.', 'fs.', 'http',
  ]) {
    if (exe.providerSemantics.includes(forbidden))
      violated(`the compiler performs no I/O and no async work: found ${forbidden}`);
  }
  // 5. HARD anti-second-authority: no numeric or ordinal value may create a
  //    behavioral instruction.
  if (/numericValue\s*(<|>|<=|>=|===\s*\d|!==\s*\d)/u.test(exe.providerSemantics))
    violated('the compiler never branches on a Brain numeric value');
  if (/ordinalCategory\s*(<|>|<=|>=|===\s*'|!==\s*')/u.test(exe.providerSemantics))
    violated('the compiler never branches on a session ordinal category');
  for (const forbidden of ['VERY_LOW', 'VERY_HIGH', 'MODERATE', '.some(', '.reduce(', 'Math.']) {
    if (exe.providerSemantics.includes(forbidden))
      violated(`the compiler derives no behavior from measurement data: found ${forbidden}`);
  }
  // Brain data never becomes a behavioral directive.
  const authorizedBlockStart = exe.providerSemantics.indexOf('const authorized = new Set<');
  const authorizedBlockEnd = exe.providerSemantics.indexOf('const behavioralInstructionIds', authorizedBlockStart);
  if (authorizedBlockStart < 0 || authorizedBlockEnd < 0) violated('the instruction-ID union is a bounded block');
  const authorizedBlock = exe.providerSemantics.slice(authorizedBlockStart, authorizedBlockEnd);
  for (const forbidden of ['BrainContext', 'brainContext', 'himContext', 'signals', 'metrics']) {
    if (authorizedBlock.includes(forbidden))
      violated(`no measurement lane contributes a behavioral instruction: found ${forbidden}`);
  }
  // The whole instruction-authorization and ordering region, from the union to
  // the point the two data lanes are projected. Strength, counting, ranking and
  // weighting are forbidden HERE; the preserved session metric COUNTS below are
  // untouched upstream data, not instruction strength.
  const unionRegionEnd = exe.providerSemantics.indexOf('const sessionReasoningContext =', authorizedBlockStart);
  if (unionRegionEnd < 0) violated('the instruction union precedes the data-lane projection');
  const unionRegion = exe.providerSemantics.slice(authorizedBlockStart, unionRegionEnd);

  // 6. Deduplication is a SET UNION over semantic IDs, never string matching.
  if (!/const authorized = new Set<HumanIntelligenceProviderInstructionId>\(\);/u.test(exe.providerSemantics))
    violated('deduplication is a set union over semantic instruction IDs');
  if (/renderedReductionInstructions|new Set<string>\(\)/u.test(exe.providerSemantics + exe.modelRouter))
    violated('string-value matching is never the deduplication authority');
  if (!/HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS\s*\n?\s*\.filter\(\(instructionId\) => authorized\.has\(instructionId\)\)/u.test(exe.providerSemantics))
    violated('canonical order comes from the frozen registry, never from source order');
  // No source count, vote, multiplier, or strength reaches the instruction union.
  for (const forbidden of [
    'count', 'Count', 'length', 'size', 'vote', 'Vote', 'weight', 'Weight',
    'score', 'Score', 'rank', 'Rank', 'strength', 'multiplier', 'priority', 'sort(',
  ]) {
    if (unionRegion.includes(forbidden))
      violated(`agreement between sources never strengthens an instruction: found ${forbidden}`);
  }

  // 7. The two data lanes stay SEPARATE and the session UUID never travels.
  if (!/sessionReasoningContext\?: HimProviderSessionReasoningContext;/u.test(exe.providerSemanticsTypes))
    violated('the session reasoning lane is its own optional field');
  if (!/brainContext\?: HimBrainContext;/u.test(exe.providerSemanticsTypes))
    violated('the Brain Context lane is its own optional field');
  if (/contextId/u.test(exe.providerSemanticsTypes))
    violated('the provider session projection declares no contextId');
  const projectionStart = exe.providerSemantics.indexOf('function projectSessionReasoningContext(');
  if (projectionStart < 0) violated('the provider-safe session projection exists');
  const projection = exe.providerSemantics.slice(projectionStart, exe.providerSemantics.indexOf('\nfunction copyBrainContext(', projectionStart));
  if (projection.includes('contextId')) violated('the session contextId is never copied into the provider projection');
  if (!projection.includes('metricKey: metric.metricKey'))
    violated('the session metricKey is preserved: the provider needs the metric semantic identity');
  if (projection.includes('signals')) violated('Brain signals never enter the session reasoning lane');
  const brainCopyStart = exe.providerSemantics.indexOf('function copyBrainContext(');
  if (brainCopyStart < 0) violated('the defensive Brain Context copy exists');
  const brainCopy = exe.providerSemantics.slice(brainCopyStart);
  if (brainCopy.includes('metrics')) violated('session metrics never enter the Brain lane');
  if (!/signals: brainContext\.signals\.map\(/u.test(brainCopy))
    violated('the Brain lane is a defensive copy, never a mutable runtime alias');
  // Consolidation must not silently DROP a lane-specific obligation. The two
  // QHIA-012 Brain non-inference guardrails are the ones this consolidation
  // actually lost once, so they are frozen here as three independent rules -
  // the universal charter does not cover either of them (its comparison ban is
  // score-qualified and its inference list omits `frequency`).
  const brainRenderStart = exe.modelRouter.indexOf('if (humanIntelligence?.brainContext) {');
  if (brainRenderStart < 0) violated('the Brain Context rendering branch exists');
  const brainRender = exe.modelRouter.slice(brainRenderStart, exe.modelRouter.indexOf('\n  if (request.', brainRenderStart + 1));
  if (!/compare these signals to each other/u.test(brainRender))
    violated('the Brain block explicitly prohibits comparing signals TO EACH OTHER');
  if (!/to any baseline/u.test(brainRender))
    violated('the Brain block explicitly prohibits comparing signals TO ANY BASELINE');
  if (!/frequency/u.test(brainRender))
    violated('the Brain block explicitly prohibits inferring FREQUENCY from signals');

  // 8. ONE authority charter and ONE behavioral block; no source provenance.
  if ((exe.modelRouter.match(/HUMAN_INTELLIGENCE_AUTHORITY_CHARTER/gu) ?? []).length !== 2)
    violated('the one Human Intelligence authority charter is declared once and rendered once');
  if ((exe.modelRouter.match(/HUMAN_INTELLIGENCE_BEHAVIORAL_PREAMBLE/gu) ?? []).length !== 2)
    violated('the one Human Intelligence behavioral block is declared once and rendered once');
  const charterStart = exe.modelRouter.indexOf('HUMAN_INTELLIGENCE_AUTHORITY_CHARTER = ');
  const charter = exe.modelRouter.slice(charterStart, exe.modelRouter.indexOf('\n', charterStart));
  for (const required of [
    'not a direct user statement and never a new authority',
    'Safety guidance and the base Behavioral Policy remain higher-authority instructions',
    'Recommendation, Question, Hypothesis, and FAST/DEEP routing authority remain owned by their existing systems',
    'cannot create, strengthen, replace, or override those authorities',
    'never be treated as diagnosis, trait or personality evidence',
    'wellbeing, capacity, readiness, competence, risk, urgency, or safety assessment',
    'it is not safety evidence',
    'Never invent facts about the user',
    'Never average, sum, weight, rank, vote, compare, or combine',
    'Never infer trend, improvement, worsening, decay, recency, freshness, or confidence',
    'UNKNOWN stays unknown',
    'Direct current information from the user takes precedence',
    'Never expose internal metric names, numeric values, slots, contracts, identifiers',
  ]) {
    if (!charter.includes(required)) violated(`the one authority charter states: ${required}`);
  }
  const preambleStart = exe.modelRouter.indexOf('HUMAN_INTELLIGENCE_BEHAVIORAL_PREAMBLE = ');
  const preamble = exe.modelRouter.slice(preambleStart, exe.modelRouter.indexOf('\n', preambleStart));
  for (const required of [
    'bounded modifiers of otherwise-authorized conversational content',
    'Multiple Human Intelligence sources authorizing the same instruction do not strengthen it',
    'does not make advice, action, contact, disclosure, confrontation, reflection, recommendation, or a formal question appropriate unless the instruction itself explicitly and narrowly permits that behavior',
  ]) {
    if (!preamble.includes(required)) violated(`the one behavioral block states: ${required}`);
  }
  // No retired per-source authority block survives, anywhere in the composer.
  for (const forbidden of [...FORBIDDEN_PROVENANCE, 'follows as a server-owned behavioral instruction']) {
    if (charter.includes(forbidden) || preamble.includes(forbidden))
      violated(`the rendered Human Intelligence blocks expose no source provenance: found ${forbidden}`);
  }
  // The provider receives instruction TEXT, never the internal ID names.
  if (!/HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTIONS\[instructionId\]/u.test(exe.modelRouter))
    violated('the renderer emits instruction text, never the internal instruction ID');
  // No internal instruction ID appears in any server-authored rendered string.
  for (const id of INSTRUCTION_IDS) {
    if (charter.includes(id) || preamble.includes(id))
      violated(`the internal instruction ID ${id} is never rendered into provider text`);
  }
  // Human Intelligence creates no new authority.
  for (const forbidden of ['recommendationContext =', 'hypothesisContext =', 'safetyGuidance =', 'path =', 'selectPath']) {
    if (exe.providerSemantics.includes(forbidden))
      violated(`Human Intelligence creates no Recommendation/Hypothesis/Safety/routing authority: found ${forbidden}`);
  }

  // 9. Rendering order: Safety -> charter -> behavioral -> Memory -> session data
  //    -> Brain data -> Hypothesis -> Recommendation.
  const order = [
    'Safety guidance for this turn:',
    'HUMAN_INTELLIGENCE_AUTHORITY_CHARTER}`',
    'HUMAN_INTELLIGENCE_BEHAVIORAL_PREAMBLE}${instructions}`',
    '<user_memory_context>',
    '<him_reasoning_context>',
    '<him_brain_context>',
    '<hypothesis_reasoning_context>',
    '<recommendation_grounding_context>',
  ];
  let cursor = -1;
  for (const marker of order) {
    const at = exe.modelRouter.indexOf(marker, cursor + 1);
    if (at < 0) violated(`the rendering order includes ${marker}`);
    if (at <= cursor) violated(`the rendering order places ${marker} after the preceding block`);
    cursor = at;
  }
  // Memory, Hypothesis and Recommendation stay OUTSIDE the envelope.
  for (const outside of ['memoryContext', 'hypothesisContext', 'recommendationContext']) {
    if (exe.providerSemanticsTypes.includes(outside))
      violated(`${outside} stays a separate authority and never joins the Human Intelligence envelope`);
  }

  // 10. Provider adapters stay semantically blind and share one composer.
  for (const [name, adapter] of [['Anthropic', exe.claudeAdapter], ['OpenAI', exe.openaiAdapter]]) {
    if (!adapter.includes('composeServerGuidance(request)'))
      violated(`the ${name} adapter renders through the one shared composition`);
    for (const forbidden of [
      'humanIntelligence', 'behavioralInstructionIds', 'sessionReasoningContext', 'brainContext',
      'him_reasoning_context', 'him_brain_context', ...RETIRED_PROVIDER_FIELDS.map(([field]) => field),
    ]) {
      if (adapter.includes(forbidden))
        violated(`the ${name} adapter implements no provider-specific Human Intelligence semantics: found ${forbidden}`);
    }
  }
  if (exe.fakeRouter.includes('humanIntelligence'))
    violated('the fake router stays Human-Intelligence-blind too');

  // 11. The Orchestrator: ONE synchronous compilation, zero topology change.
  if ((exe.orchestrator.match(/buildHumanIntelligenceProviderSemantics\(/gu) ?? []).length !== 1)
    violated('the provider envelope is compiled exactly once per provider-generating turn');
  if (/await\s+buildHumanIntelligenceProviderSemantics/u.test(exe.orchestrator))
    violated('the compiler is never awaited: it adds no Promise dependency');
  if (/this\.engine\('human_intelligence|this\.engine\('him_provider/u.test(exe.orchestrator))
    violated('the compiler needs no engine span: it performs no I/O');
  if (!/\.\.\.\(humanIntelligence \? \{ humanIntelligence \} : \{\}\),/u.test(exe.orchestrator))
    violated('the one envelope is passed only when provider-ready Human Intelligence exists');
  // The compiled envelope is what the router receives - never a legacy field.
  const routerCallStart = exe.orchestrator.indexOf("this.engine('model_router'");
  if (routerCallStart < 0) violated('the Model Router invocation exists');
  const routerCall = exe.orchestrator.slice(routerCallStart, exe.orchestrator.indexOf('}));', routerCallStart));
  for (const [field] of RETIRED_PROVIDER_FIELDS) {
    if (routerCall.includes(field))
      violated(`no legacy Human Intelligence field reaches the Model Router: found ${field}`);
  }
  // Zero topology change: the pre-existing waits are the only ones.
  if ((exe.orchestrator.match(/Promise\.all\(/gu) ?? []).length !== 1)
    violated('no new foreground barrier exists: the existing Promise.all stays the only one');
  // QHIA-014A amended exactly this line and the two below it: the foreground
  // now owns TWO bounded Human Intelligence budget timers - the pre-existing
  // QHIA-005 Reflection budget and the QHIA-014A Snapshot budget - both driven
  // by the SAME shared 300 ms constant and both settled by the SAME single
  // barrier. A third timer, or a budget that is no longer the shared constant,
  // still fails here.
  if ((exe.orchestrator.match(/setTimeout\(/gu) ?? []).length !== 2)
    violated('exactly the two bounded Human Intelligence foreground budgets exist: no third foreground timer');
  if (!/const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300;/u.test(exe.orchestrator))
    violated('the ONE shared Human Intelligence foreground wait budget stays exactly 300 ms');
  if (/setInterval\(|sleep\(|delay\(|retry\(/u.test(exe.orchestrator))
    violated('no sleep, interval or retry is added to the foreground');
  if ((exe.orchestrator.match(/this\.router\.generate\(/gu) ?? []).length !== 1)
    violated('exactly one Model Router invocation exists: consolidation adds no second provider call');
  if (!/await Promise\.all\(\[snapshotReadPromise, reflectionReadPromise\]\)/u.test(exe.orchestrator))
    violated('the existing barrier still awaits exactly the bounded Snapshot and Reflection promises');
  if (/await\s+brainContextReadPromise|await\s+crossContextForegroundReadPromise/u.test(exe.orchestrator))
    violated('the existing zero-wait optional reads are still never awaited');

  // 12. The Full Intelligence proof consumes the consolidated boundary.
  if (!exe.smokeRuntime.includes('assertHumanIntelligenceProviderEnvelope('))
    violated('the Full Intelligence proof asserts the one consolidated provider envelope');
  if (!exe.smokeRuntime.includes('humanIntelligence?.brainContext'))
    violated('the Full Intelligence proof still proves Brain Context reaches the provider');
  if (!exe.smokeRuntime.includes('humanIntelligence?.sessionReasoningContext'))
    violated('the Full Intelligence proof still proves session reasoning reaches the provider');

  // 13. This task changed NO database file and added NO migration - a
  //     historical fact of the frozen QHIA v1 baseline, recorded in the phase
  //     freeze document, and NOT provable by scanning the future, mutable
  //     migration listing (QHIA-015 phase closure repair, corrected by Fix 01
  //     to TRUE forward-safety). The one durable migration fact this guard
  //     owns: the terminal Human Intelligence Activation phase migration 0061
  //     EXISTS. No future migration number or filename/domain is banned - a
  //     later, separately reviewed provider-semantics migration is legal.
  const migrations = readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql'));
  if (!migrations.includes('0061_him_brain_context_bridge_v1.sql')) violated('the terminal Human Intelligence Activation phase migration 0061 exists');
}

test('C1 - the shipped sources satisfy the frozen QHIA-013 consolidation contract', () => {
  assert.doesNotThrow(() => assertProviderSemanticsConsolidationContract(shipped));
});

test('C2 - anti-vacuity: the real guard rejects every named regression', () => {
  const drifts = [
    ['a retired legacy provider field returned', {
      modelRouter: shipped.modelRouter.replace(
        '  humanIntelligence?: HumanIntelligenceProviderSemantics;',
        '  humanIntelligence?: HumanIntelligenceProviderSemantics;\n  himContext?: HimModelContext;',
      ),
    }],
    ['the old and new provider contracts coexist in the composition', {
      modelRouter: shipped.modelRouter.replace(
        "'humanIntelligence' | 'hypothesisContext'",
        "'humanIntelligence' | 'himBrainContext' | 'hypothesisContext'",
      ),
    }],
    ['a second provider envelope type appeared', {
      providerSemanticsTypes: shipped.providerSemanticsTypes.replace(
        'export interface HumanIntelligenceProviderSemantics {',
        'export interface HumanIntelligenceProviderSemanticsV2 { contractVersion: 2 }\nexport interface HumanIntelligenceProviderSemantics {',
      ),
    }],
    ['a thirteenth behavioral instruction ID appeared', {
      providerSemanticsTypes: shipped.providerSemanticsTypes.replace(
        "  'CLARITY_NOT_FORCED_AGREEMENT',\n] as const)",
        "  'CLARITY_NOT_FORCED_AGREEMENT',\n  'ENCOURAGE_LONGER_RESPONSE',\n] as const)",
      ),
    }],
    ['the frozen canonical order was changed', {
      providerSemanticsTypes: shipped.providerSemanticsTypes.replace(
        "  'COMPACT_RESPONSE',\n  'REDUCE_COGNITIVE_LOAD',",
        "  'REDUCE_COGNITIVE_LOAD',\n  'COMPACT_RESPONSE',",
      ),
    }],
    ['a frozen instruction text drifted', {
      providerSemantics: shipped.providerSemantics.replace(
        'Keep this response more compact than the normal default.',
        'Keep this response short.',
      ),
    }],
    ['a frozen source mapping was widened', {
      providerSemantics: shipped.providerSemantics.replace(
        "  REDUCE_INTERACTION_BURDEN: Object.freeze([\n    'REDUCE_COGNITIVE_LOAD',",
        "  REDUCE_INTERACTION_BURDEN: Object.freeze([\n    'COMPACT_RESPONSE',\n    'REDUCE_COGNITIVE_LOAD',",
      ),
    }],
    ['the compiler derived behavior from adaptation drivers', {
      providerSemantics: shipped.providerSemantics.replace(
        '  const directives = input.himInteractionAdaptation?.directives;',
        "  if (input.himInteractionAdaptation?.drivers.includes('STRESS_HIGH_OR_VERY_HIGH')) authorized.add('CALMER_DELIVERY');\n  const directives = input.himInteractionAdaptation?.directives;",
      ),
    }],
    ['the compiler branched on a Brain numeric value', {
      providerSemantics: shipped.providerSemantics.replace(
        '  const sessionReasoningContext = projectSessionReasoningContext(input.himContext);',
        "  if (input.himBrainContext?.signals.length && input.himBrainContext.signals[0].numericValue <= 2) authorized.add('CALMER_DELIVERY');\n  const sessionReasoningContext = projectSessionReasoningContext(input.himContext);",
      ),
    }],
    ['the compiler became asynchronous', {
      providerSemantics: shipped.providerSemantics.replace(
        'export function buildHumanIntelligenceProviderSemantics(',
        'export async function buildHumanIntelligenceProviderSemantics(',
      ),
    }],
    ['string matching became the deduplication authority', {
      providerSemantics: shipped.providerSemantics.replace(
        '  const authorized = new Set<HumanIntelligenceProviderInstructionId>();',
        '  const renderedReductionInstructions = new Set<string>();\n  const authorized = new Set<HumanIntelligenceProviderInstructionId>();',
      ),
    }],
    ['a source count reached the provider semantics', {
      providerSemantics: shipped.providerSemantics.replace(
        '  const sessionReasoningContext = projectSessionReasoningContext(input.himContext);',
        '  const authorizedCount = authorized.size;\n  void authorizedCount;\n  const sessionReasoningContext = projectSessionReasoningContext(input.himContext);',
      ),
    }],
    ['the session contextId reached the provider projection', {
      providerSemantics: shipped.providerSemantics.replace(
        '    contractVersion: himContext.contractVersion,',
        '    contextId: himContext.contextId,\n    contractVersion: himContext.contractVersion,',
      ),
    }],
    ['the session metricKey was stripped from the provider projection', {
      providerSemantics: shipped.providerSemantics.replaceAll('        metricKey: metric.metricKey,\n', ''),
    }],
    ['the Brain lane became a mutable runtime alias', {
      providerSemantics: shipped.providerSemantics.replace(
        '    signals: brainContext.signals.map((signal) => ({',
        '    signals: brainContext.signals.slice().map((signal) => ({',
      ),
    }],
    ['the two data lanes were merged', {
      providerSemantics: shipped.providerSemantics.replace(
        '  if (!brainContext) return undefined;',
        '  if (!brainContext) return undefined;\n  const metrics = brainContext.signals;\n  void metrics;',
      ),
    }],
    ['a source channel label entered the provider behavioral rendering', {
      modelRouter: shipped.modelRouter.replace(
        "HUMAN_INTELLIGENCE_BEHAVIORAL_PREAMBLE = 'The following",
        "HUMAN_INTELLIGENCE_BEHAVIORAL_PREAMBLE = 'Situation-bound interaction guidance follows. The following",
      ),
    }],
    ['the Brain-to-Brain comparison prohibition was removed', {
      modelRouter: shipped.modelRouter.replace(
        'Do not compare these signals to each other or to any baseline,',
        'Do not compare these signals to any baseline,',
      ),
    }],
    ['the Brain-to-baseline comparison prohibition was removed', {
      modelRouter: shipped.modelRouter.replace(
        'Do not compare these signals to each other or to any baseline,',
        'Do not compare these signals to each other,',
      ),
    }],
    ['the frequency prohibition was removed while trend and recency remained', {
      modelRouter: shipped.modelRouter.replace(
        'a trend, improvement, worsening, decay, recency, or frequency from them',
        'a trend, improvement, worsening, decay, or recency from them',
      ),
    }],
    ['the universal charter dropped an authority obligation', {
      modelRouter: shipped.modelRouter.replace(
        'UNKNOWN stays unknown and must never be replaced with zero, moderate, default, or an older value. ',
        '',
      ),
    }],
    ['the behavioral block dropped the no-strengthening rule', {
      modelRouter: shipped.modelRouter.replace(
        'Multiple Human Intelligence sources authorizing the same instruction do not strengthen it. ',
        '',
      ),
    }],
    ['a provider adapter rendered Human Intelligence independently', {
      claudeAdapter: shipped.claudeAdapter.replace(
        '          system: composeServerGuidance(request),',
        '          system: `${composeServerGuidance(request)}${request.humanIntelligence ? \'HI\' : \'\'}`,',
      ),
    }],
    ['the Orchestrator compiled the envelope more than once', {
      orchestrator: shipped.orchestrator.replace(
        '      const humanIntelligence = buildHumanIntelligenceProviderSemantics({',
        '      void buildHumanIntelligenceProviderSemantics({ himContext });\n      const humanIntelligence = buildHumanIntelligenceProviderSemantics({',
      ),
    }],
    ['the Orchestrator gained a Human-Intelligence-specific await', {
      orchestrator: shipped.orchestrator.replace(
        '      const humanIntelligence = buildHumanIntelligenceProviderSemantics({',
        '      await buildHumanIntelligenceProviderSemantics({',
      ),
    }],
    ['the Orchestrator gained a second foreground barrier', {
      orchestrator: shipped.orchestrator.replace(
        '      const { memory: memoryForeground, hypothesis: hypothesisForeground } = await foregroundGatherPromise;',
        '      await Promise.all([brainContextReadPromise.catch(() => undefined)]);\n      const { memory: memoryForeground, hypothesis: hypothesisForeground } = await foregroundGatherPromise;',
      ),
    }],
    ['the Orchestrator gained a second foreground timer', {
      orchestrator: shipped.orchestrator.replace(
        '      brainContextReadPromise.then(',
        '      setTimeout(() => undefined, 25);\n      brainContextReadPromise.then(',
      ),
    }],
    ['a legacy field reached the Model Router again', {
      orchestrator: shipped.orchestrator.replace(
        '        ...(humanIntelligence ? { humanIntelligence } : {}),',
        '        ...(humanIntelligence ? { humanIntelligence } : {}),\n        himContext,',
      ),
    }],
    ['the Full Intelligence proof stopped asserting the consolidated envelope', {
      smokeRuntime: shipped.smokeRuntime.replaceAll('assertHumanIntelligenceProviderEnvelope(', 'void 0 || ((...a: unknown[]) => a)('),
    }],
  ];

  for (const [label, overrides] of drifts) {
    const mutated = { ...shipped, ...overrides };
    for (const key of Object.keys(overrides)) {
      assert.notEqual(mutated[key], shipped[key], `the "${label}" mutation actually replaced its source text`);
    }
    assert.throws(
      () => assertProviderSemanticsConsolidationContract(mutated),
      /QHIA-013 provider semantics consolidation contract violated/u,
      `the guard rejects: ${label}`,
    );
  }

  // Positive control and formatting-insensitivity.
  assert.doesNotThrow(() => assertProviderSemanticsConsolidationContract(shipped));
  const reformatted = { ...shipped, providerSemantics: `\n${shipped.providerSemantics}` };
  assert.notEqual(reformatted.providerSemantics, shipped.providerSemantics);
  assert.doesNotThrow(() => assertProviderSemanticsConsolidationContract(reformatted), 'formatting alone never fails the guard');
});

test('C3 - the upstream Human Intelligence runtime contracts are untouched by QHIA-013', () => {
  // QHIA-013 consolidates DELIVERY semantics only. Every upstream measurement,
  // consumption and relevance boundary keeps its own frozen identity and gains
  // no coupling to the provider envelope.
  for (const [path, marker] of [
    ['apps/api/src/human-model/him-interaction-adaptation.service.ts', 'HimInteractionAdaptationDirectives'],
    ['apps/api/src/human-model/him-session-reflection-consumption.service.ts', 'HimSessionReflectionGuidance'],
    ['apps/api/src/human-model/him-situation-stress-consumption.service.ts', 'HIM_SITUATION_STRESS_METRIC_KEY'],
    ['apps/api/src/human-model/him-decision-attention-consumption.service.ts', 'HIM_DECISION_ATTENTION_METRIC_KEY'],
    ['apps/api/src/human-model/him-goal-motivation-consumption.service.ts', 'HIM_GOAL_MOTIVATION_METRIC_KEY'],
    ['apps/api/src/human-model/him-relationship-communication-consumption.service.ts', 'HIM_RELATIONSHIP_COMMUNICATION_METRIC_KEY'],
    ['apps/api/src/human-model/him-brain-context.service.ts', 'himBrainContextRegistryEntry'],
    ['apps/api/src/human-model/him-fast-deep-consumption.service.ts', 'consumptionMode'],
  ]) {
    const source = read(path);
    assert.ok(source.includes(marker), `${path} keeps its own frozen identity`);
    assert.ok(!source.includes('HumanIntelligenceProviderSemantics'),
      `${path} gains no provider-envelope coupling`);
    assert.ok(!source.includes('behavioralInstructionIds'),
      `${path} produces no provider instruction ID of its own`);
  }
  // The runtime session context keeps contextId: only the PROVIDER projection
  // strips it.
  const runtimeContextTypes = read('apps/api/src/human-model/him-fast-deep-consumption.types.ts');
  assert.match(runtimeContextTypes, /contextId: string;/u,
    'the runtime HimModelContext still carries its contextId');
});

test('C4 - the contract is wired into package scripts and CI', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(
    packageJson.scripts['test:human-intelligence-provider-semantics-consolidation-contract'],
    'node --test tests/human-intelligence-provider-semantics-consolidation-contract.test.mjs',
  );
  const ci = read('.github/workflows/api-ci.yml');
  const staticStep = ci.indexOf('test:human-intelligence-provider-semantics-consolidation-contract');
  assert.ok(staticStep > 0, 'CI runs this static contract');
  assert.ok(staticStep < ci.indexOf('Apply all migrations to fresh PostgreSQL'),
    'it runs before the database bootstrap: a pure static guard needs no database');
});

test('C5 - QHIA-013 changes no database file', () => {
  // Absolute: the expected database diff for this task is ZERO - a historical
  // fact of the frozen QHIA v1 baseline recorded in the phase freeze document
  // (QHIA-015 phase closure repair, corrected by Fix 01): the one durable
  // migration fact asserted here is that the terminal phase migration 0061
  // exists. Neither the live repository's future migration numbering nor any
  // future filename/domain is frozen here - a later, separately reviewed
  // provider-semantics migration is legal.
  const migrations = readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql'));
  assert.ok(migrations.includes('0061_him_brain_context_bridge_v1.sql'), 'the terminal Human Intelligence Activation phase migration 0061 exists');
  // No production application file introduced by this task touches SQL, RLS,
  // ACLs, RPCs, bindings, the post-response ledger or currentness authority.
  for (const path of [SOURCES.providerSemantics, SOURCES.providerSemanticsTypes]) {
    const source = read(path);
    for (const forbidden of ['rpc/', 'SELECT ', 'INSERT ', 'UPDATE ', 'GRANT ', 'POLICY', 'supabase', 'Repository']) {
      assert.ok(!source.includes(forbidden), `${path} performs no database work: found ${forbidden}`);
    }
  }
});
