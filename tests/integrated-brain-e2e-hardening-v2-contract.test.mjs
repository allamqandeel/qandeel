import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// QIR-007 Integrated Brain E2E Hardening v2 static contract.
//
// The DYNAMIC verifier is the authority: this file is only a fail-closed drift
// guard for the things that must stay true without any infrastructure. It
// freezes exactly the QIR-007-owned invariants:
//
//   1. the dynamic verifier exists and is substantive;
//   2. the package script exists and points at it;
//   3. API CI runs it AFTER the A2 and Full Intelligence runtime gates;
//   4. the existing A2 and Full Intelligence gates remain, unbloated;
//   5. migration 0063 is still terminal and QIR-007 adds no 0064;
//   6. the QIR-005 provider-effect registry stays exactly three and the cap 3;
//   7. no Question provider exists in the registry or on the Question path;
//   8. the frozen 300 / 5000 / 300 ms foreground ceilings remain;
//   9. the total context budget remains 131072 bytes;
//  10. the Question slice remains 8192 bytes;
//  11. the dynamic verifier carries substantive coverage markers for A-H;
//  12. QIR-007 introduces no new production runtime service.
//
// FORWARD-SAFETY NOTES. This guard must never freeze: provider/model
// identifiers (final Provider/LLM selection stays deferred; no provider adapter
// or model-profile source enters this world), routing thresholds, local
// Memory/Hypothesis caps, fixture wording, assertion prose, or any future
// reviewed telemetry recorder, CI step, or documentation amendment. The
// migration-terminal assertion is the one deliberate freeze QIR-007 inherits
// from QIR-006: the next reviewed migration-adding task re-anchors BOTH guards
// in the same reviewed change.
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const CONTRACT_DOC = 'docs/integrated-brain-e2e-hardening-v2.md';
const VERIFIER = 'apps/api/scripts/verify-integrated-brain-end-to-end-hardening-v2.ts';
const HARNESS = 'apps/api/scripts/integrated-brain-e2e-hardening-v2/hardening-harness.ts';
const CAPACITY = 'apps/api/scripts/integrated-brain-e2e-hardening-v2/human-intelligence-capacity.ts';
const SOURCES = Object.freeze({
  contractDoc: CONTRACT_DOC,
  docsReadme: 'docs/README.md',
  packageJson: 'package.json',
  ci: '.github/workflows/api-ci.yml',
  verifier: VERIFIER,
  harness: HARNESS,
  capacity: CAPACITY,
  providerBudget: 'apps/api/src/post-response-intelligence/post-response-provider-budget.ts',
  budgetContract: 'apps/api/src/intelligence-runtime/integrated-context-budget-contract.ts',
  questionSelectionTypes: 'apps/api/src/question/question-foreground-selection.types.ts',
  gathererTypes: 'apps/api/src/intelligence-runtime/bounded-foreground-intelligence-gatherer.types.ts',
  orchestrator: 'apps/api/src/conversation/conversation-orchestrator.service.ts',
  questionSelectionService: 'apps/api/src/question/question-foreground-selection.service.ts',
  redisConsumer: 'apps/api/src/post-response-intelligence/redis-post-response-consumer.ts',
  // QIR-007 Addendum A: the frozen Brain Context registry and the preserved
  // QHIA-013 all-active footprint proof.
  brainContextTypes: 'apps/api/src/human-model/him-brain-context.types.ts',
  humanIntelligenceFootprintSpec: 'apps/api/src/model-router/human-intelligence-prompt-footprint.spec.ts',
});
const shipped = Object.freeze({
  ...Object.fromEntries(Object.entries(SOURCES).map(([key, path]) => [key, read(path)])),
  migrations: Object.freeze(readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql'))),
});

const VERIFIER_SCRIPT = 'verify:integrated-brain:e2e-hardening-v2';
const VERIFIER_COMMAND = 'node --env-file-if-exists=.env node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/verify-integrated-brain-end-to-end-hardening-v2.ts';
const CONTRACT_SCRIPT = 'test:integrated-brain-e2e-hardening-v2-contract';
const CONTRACT_COMMAND = 'node --test tests/integrated-brain-e2e-hardening-v2-contract.test.mjs';
const A2_SCRIPT = 'verify:a2-e2e-runtime-smoke';
const FULL_INTELLIGENCE_SCRIPT = 'verify:full-intelligence-e2e-runtime';
const TERMINAL_MIGRATION = '0063_question_information_gap_closed_loop_v1.sql';

// Required statements of the normative document, checked against
// whitespace-flattened text so markdown wrapping never splits a marker.
const REQUIRED_DOC_STATEMENTS = Object.freeze([
  '# QANDEEL — Integrated Brain End-to-End Hardening v2',
  '**Status: ACTIVE / NORMATIVE**',
  '**Task:** QIR-007 — Integrated Brain E2E Hardening v2',
  '> **Prove the frozen production architecture. Do not redesign it.**',
  'Its default rule is **ZERO new production semantics**',
  'no database schema change and **no migration 0064**',
  '`database/migrations/0063_question_information_gap_closed_loop_v1.sql`',
  'no fourth background provider effect and no `QUESTION_PROVIDER`',
  'no second conversational provider call and no reconciliation LLM pass',
  'no Question or Information-Gap semantics and **no answer detector**',
  'An existing **production semantic defect** may never be silently repaired',
  'QANDEEL has not selected its final Provider or LLM.',
  'INTEGRATED_BRAIN_E2E_HARDENING_V2_EXTERNAL_HTTP_FORBIDDEN',
  '**real PostgreSQL 17** and **real Redis 7**',
  'Deterministic in-process doubles exist **only** at the external model/provider transport boundaries',
  '**There is no parallel fake intelligence architecture.**',
  'ONE `BEGIN ... ROLLBACK` transaction',
  '### A — Full three-turn cognitive loop',
  '**There is no Question-specific answer detector, and Question Runtime never resolves a gap directly.**',
  '### B — FAST / DEEP integrated parity',
  '### C — Foreground failure isolation matrix',
  '### D — Authority conflict + global context pressure',
  '### E — Safety / fail-closed integration',
  '### F — Crash / reclaim / recovery',
  '**F1 = duplicate delivery.**',
  'This is the ONLY place the verifier publishes a synthetic duplicate.',
  '**F2 and F3 = real production Redis reclaim** of the ORIGINAL pending entry.',
  '-> RedisPostResponseConsumer.reclaim() -> XAUTOCLAIM',
  'The frozen 30,000 ms stale-idle threshold is production-owned and unchanged.',
  '**verification-only Redis pending-entry setup**',
  '**production `RedisPostResponseConsumer.reclaim()` method composed with durable dispatcher, effect-ledger and provider-budget recovery**',
  '### G — Integrated Question isolation',
  '### H — Privacy + hidden-work census',
  'ASSOCIATION_PROVIDER <= 1',
  'INTENT_PROVIDER <= 1',
  'CANDIDATE_PROVIDER <= 1',
  'TOTAL <= 3',
  'The budget is per **durable execution lifecycle**, never per Redis delivery or attempt',
  'There is no `QUESTION_PROVIDER`.',
  'QHIA shared Human Intelligence wait: 300 ms',
  'QIR-003 Memory + Hypothesis shared: 5000 ms',
  'QIR-006 Question selection ceiling: 300 ms',
  'TOTAL 131072',
  'Question 8192',
  'npm run verify:integrated-brain:e2e-hardening-v2',
  '1. `verify:a2-e2e-runtime-smoke` — A2 End-to-End Runtime Smoke',
  '2. `verify:full-intelligence-e2e-runtime` — Full Intelligence End-to-End Runtime Smoke',
  '3. `verify:integrated-brain:e2e-hardening-v2` — **Integrated Brain E2E Hardening v2**',
  'QIR-007 Production Blocker',
  '**A production bug is never fixed opportunistically inside QIR-007.**',
  '**No production semantic changes were made by QIR-007.**',
  // QIR-007 Addendum A - Cross-Context Adversarial & Human Intelligence
  // Capacity Proof v1.
  '## 11. Addendum A — Cross-Context Adversarial & Human Intelligence Capacity Proof v1',
  '**C5 — cross-context rejection isolation.**',
  '**C6 — cross-context late-settlement isolation.**',
  '**C7 — malformed aggregate isolation.**',
  '**C8 — all four cross-context contexts ACTIVE together.**',
  'exactly ONE aggregate-v3 foreground read',
  'ZERO incremental wait, no dedicated timeout, and it is never directly awaited',
  'A rejected, late, or malformed aggregate is an OMISSION, never an authoritative all-four `NONE` answer.',
  'There is no direct per-channel fallback, no aggregate-v1/v2 fallback, and no cross-turn cache.',
  '`6427` is the frozen canonical **all-active QHIA-013 fixture** footprint',
  'it is NOT the maximum reachable envelope',
  'CURRENT_MAX_HUMAN_INTELLIGENCE_INCREMENTAL_BYTES = 7518',
  'headroom_bytes=674',
  'verdict=PASS',
  // Fix 04: the measured ceiling is a REACHABLE coherent runtime state.
  'Maximality is SEARCHED over **reachable coherent runtime states**',
  '-> HimInteractionAdaptationService.derive(...)',
  'There is no hard-coded adaptation object',
  'derived drivers: ENERGY_LOW_OR_VERY_LOW',
  'The superseded synthetic figure was `7536`',
  'Brain Context slots in the maximum fixture: 8',
  'session reasoning metrics in the maximum fixture: 3',
  'cross-context ACTIVE channels in the maximum fixture: 4',
  '**No production semantic changes were made by QIR-007 Addendum A.**',
]);

// Substantive per-scenario coverage markers. Each entry is a live assertion
// LABEL PREFIX the dynamic verifier attaches to real assertions, so deleting a
// scenario - not merely renaming a comment - breaks this guard.
const SCENARIO_MARKERS = Object.freeze({
  A: ["'A: ", "stage = 'A_TURN_1_LEARN'", "stage = 'A_TURN_2_ASK'", "stage = 'A_TURN_3_INFORMATION'", 'HYPOTHESIS_VERSION_ADVANCED'],
  B: ["'B: ", "'B anti-vacuity: ", "stage = 'B_DEEP_PARITY_AND_D_AUTHORITY'"],
  C: ["'C1: ", "'C1b: ", "'C2: ", "'C3: ", "'C4/E3: ", "stage = 'C_FOREGROUND_FAILURE_ISOLATION'",
    // QIR-007 Addendum A extends scenario C rather than inventing a scenario I.
    "'C5: ", "'C6: ", "'C7: ", "'C8: ", "'C5 anti-vacuity: ", "'C6 anti-vacuity: ",
    "'C7 anti-vacuity: ", "'C8 anti-vacuity: ", "stage = 'C_CROSS_CONTEXT_ADVERSARIAL_MATRIX'"],
  D: ["'D: ", "'D anti-vacuity: ", "stage = 'D_GLOBAL_CONTEXT_PRESSURE'"],
  E: ["'E1: ", "'E2: ", "'E4: ", "stage = 'E1_SAFETY_BLOCK'", "stage = 'E2_SAFETY_GUIDED'"],
  F: ["'F1: ", "'F2: ", "'F3: ", "'F4: ", "stage = 'F_RECOVERY_AND_E4'", 'await consumer.reclaim()'],
  G: ["'G1: ", "'G2: ", "'G3: ", "'G4: ", "'G5: ", "stage = 'G3_QUESTION_BUDGET_OMISSION'"],
  H: ["'H: ", "'H anti-vacuity: ", "stage = 'H_CENSUS_AND_PRIVACY'"],
});

// The REAL production classes the verifier must compose. A verifier that stops
// driving one of these has stopped proving the integrated brain.
const REQUIRED_PRODUCTION_CLASSES = Object.freeze([
  'ConversationOrchestratorService', 'ConversationRepository', 'ContextBuilderService',
  'SafetyResponseGateService', 'BehavioralResponsePolicyService', 'MemoryRetrieverService',
  'MemoryRuntimeService', 'EvidenceService', 'HypothesisReasoningContextService',
  'RecommendationGroundingService', 'BoundedForegroundIntelligenceGathererService',
  'IntegratedContextBudgetAssemblerService', 'QuestionForegroundSelectionService',
  'RuntimeEventPublisher', 'RedisStreamsTransport', 'RedisPostResponseConsumer',
  'PostResponseIntelligenceDispatcherService', 'BackgroundIntelligenceAuthorityService',
  'BackgroundIntelligenceEnrichmentService', 'CorrelationService', 'TelemetryService',
  // QIR-007 Addendum A: the cross-context aggregate, its transport, the four
  // real semantic consumers, the Brain Context lane, and the REAL explicit
  // relevance-activation entry the all-four fixture is built through.
  'HimCrossContextForegroundAggregationService', 'HimCrossContextForegroundRepository',
  'HimSituationStressConsumptionService', 'HimDecisionAttentionConsumptionService',
  'HimGoalMotivationConsumptionService', 'HimRelationshipCommunicationConsumptionService',
  'HimBrainContextService', 'ConversationContextActivationService', 'HimSessionContextBindingService',
]);

// QIR-007 Addendum A. Each entry is a live assertion LABEL or a real
// service/fault/census INVOCATION in the dynamic verifier - never a comment -
// so deleting the proof, not merely renaming a heading, breaks this guard.
const ADDENDUM_A_VERIFIER_PROOFS = Object.freeze([
  // C5 - rejection isolation.
  'the canonical aggregate really RAN against real PostgreSQL and the injected rejection hit THAT request',
  'no direct per-channel fallback read was issued',
  'no retired aggregate fallback was issued',
  'REJECTED is omission, never an authoritative all-four NONE answer',
  'the Snapshot-derived Human Intelligence lane continued unaffected',
  // C6 - zero-incremental-wait late settlement isolation.
  'the successful aggregate settlement was STILL PENDING when the existing Human Intelligence barrier closed',
  'provider generation and canonical finalization proceeded WITHOUT the pending aggregate',
  'releasing the late aggregate triggers NO second provider call and NO second finalization',
  'the already-built provider request is not mutated by the late settlement',
  'the finalized assistant response is untouched by the late settlement',
  'the next turn performs its OWN current aggregate read - no cross-turn cache exists to inherit',
  // C7 - malformed aggregate isolation.
  'REJECTS the malformed successful envelope - it is never sorted, padded, repaired, or partially salvaged',
  'the malformed successful payload really crossed the real aggregate boundary',
  'NO partial channel salvage',
  // C8 - all four ACTIVE together, compiled into ONE envelope.
  'ALL FOUR context bindings are genuinely ACTIVE on the SAME session at the same time',
  'all FOUR real semantic consumers ran and all FOUR results are ACTIVE simultaneously on the same session',
  'the four channels compile into ONE humanIntelligence envelope - there is no separate per-channel ModelRouter field',
  'agreement between sources creates no vote, count, weight, confidence, strength or amplification field of any kind',
  'instruction order is the frozen canonical registry order',
  'no internal context, binding, metric, slot or directive identity reaches the provider through the cross-context behavioral path',
]);

// The real fault/service invocations the addendum's proofs are built on.
const ADDENDUM_A_VERIFIER_INVOCATIONS = Object.freeze([
  "kind: 'REJECT_AFTER_CALL'",
  "kind: 'GATE_AFTER_CALL'",
  "kind: 'MALFORMED_SUCCESS', value: malformedAggregateRows",
  'himCrossContextForegroundService.read(',
  'contextActivationService.activateContext(',
  'read_him_session_cross_context_foreground_v3',
  'proveCurrentMaximumHumanIntelligenceCapacity(',
  'formatCurrentMaximumHumanIntelligenceProof(',
]);

// The REAL canonical rendering identity the capacity proof must keep using.
const ADDENDUM_A_CAPACITY_CANONICAL_SOURCES = Object.freeze([
  "from '../../src/model-router/human-intelligence-provider-semantics'",
  "from '../../src/model-router/model-router.types'",
  "from '../../src/intelligence-runtime/integrated-context-budget-assembler.service'",
  'buildHumanIntelligenceProviderSemantics(',
  'composeServerGuidance(',
  "Buffer.byteLength(value, 'utf8')",
  'HUMAN_INTELLIGENCE_BUDGET_BYTES',
  'GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES',
  // QIR-007 Addendum A Fix 04: Interaction Adaptation must come from the REAL
  // derivation authority, never from a fixture.
  "from '../../src/human-model/him-interaction-adaptation.service'",
  "from '../../src/human-model/him-reasoning-consumption.service'",
  "from '../../src/human-model/him-fast-deep-consumption.service'",
  'new HimInteractionAdaptationService()',
]);

// QIR-007 Addendum A Fix 04. Each entry is an executable expression or a live
// assertion label proving the capacity search measures only REACHABLE coherent
// runtime states: one canonical reasoning context per candidate, feeding BOTH
// production derivations.
const ADDENDUM_A_REACHABILITY_PROOFS = Object.freeze([
  // One shared source state, both derivations from it.
  'const reasoningContext = candidateReasoningContext(shapes);',
  'const adaptation = interactionAdaptation.derive(reasoningContext);',
  "const modelContext = fastDeepConsumption.project('DEEP', reasoningContext);",
  // The Orchestrator's own ACTIVE gate is mirrored, not bypassed.
  "adaptation.adaptationState === 'ACTIVE' ? { himInteractionAdaptation: adaptation } : {}",
  // The winner is re-derived and the whole envelope recompiled from one state.
  'const rederivedAdaptation = interactionAdaptation.derive(winningReasoningContext);',
  'the winning Interaction Adaptation is EXACTLY what the real service derives from the winning reasoning context',
  'the winning DEEP projection comes from that SAME reasoning context',
  'the measured maximum is exactly the envelope one coherent runtime state compiles to',
  'driver is backed by a genuinely KNOWN',
  'adaptationState follows the derived drivers, never a fixture decision',
  'an always-maximal adaptation is reachable ONLY from a context that derives every frozen driver',
  'the one Adaptation-exclusive instruction is present EXACTLY when the real derivation authorized it',
]);

// The frozen A2 / Full Intelligence helpers QIR-007 REUSES instead of forking.
const REQUIRED_VERIFIER_HELPERS = Object.freeze([
  "from './a2-e2e-smoke/smoke-db'",
  "from './a2-e2e-smoke/deterministic-providers'",
  "from './a2-e2e-smoke/pg-background-intelligence-data.adapter'",
  "from './a2-e2e-smoke/pg-post-response-intelligence.adapter'",
  "from './a2-e2e-smoke/pg-runtime-event-admin.adapter'",
]);
const REQUIRED_HARNESS_HELPERS = Object.freeze([
  "from '../a2-e2e-smoke/pg-post-response-intelligence.adapter'",
  "from '../full-intelligence-e2e-smoke/deterministic-conversational-router'",
  "from '../full-intelligence-e2e-smoke/pg-foreground-intelligence.adapters'",
]);

// Deliberately module-level: the guard FUNCTION must never carry a vendor or
// model literal of its own (QIR7-4), so the negative provider-surface patterns
// live here and are referenced by name.
const PROVIDER_ADAPTER_IMPORT = /from '[^\n']*(?:providers\/|openai|anthropic|claude|gemini)[^\n']*'/iu;
const PROVIDER_KEY_READ = /process\.env\.[A-Z_]*API_KEY|process\.env\.(?:ANTHROPIC|OPENAI|GEMINI|GOOGLE|XAI|MISTRAL)[A-Z_]*/u;

const executable = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

function violated(property) {
  throw new Error(`QIR-007 Integrated Brain E2E Hardening v2 contract violated: ${property}`);
}

function assertIntegratedBrainHardeningContract(world) {
  const exeVerifier = executable(world.verifier);
  const exeHarness = executable(world.harness);

  // 1. The dynamic verifier exists, is substantive, and the normative document
  //    records every frozen statement.
  if (typeof world.verifier !== 'string' || world.verifier.length < 20000)
    violated('the QIR-007 dynamic verifier exists and is substantive');
  if (typeof world.harness !== 'string' || world.harness.length < 3000)
    violated('the verification-only QIR-007 harness exists and is substantive');
  if (typeof world.contractDoc !== 'string' || world.contractDoc.length < 8000)
    violated('the QIR-007 normative document exists and is substantive');
  const flattened = world.contractDoc.replace(/\s+/gu, ' ');
  for (const statement of REQUIRED_DOC_STATEMENTS) {
    if (!flattened.includes(statement)) violated(`the document records: ${statement}`);
  }
  if (!world.docsReadme.includes('integrated-brain-e2e-hardening-v2.md'))
    violated('docs/README.md links the QIR-007 normative document');

  // 2. Package scripts: the dynamic gate and the static guard, registered
  //    exactly, both pointing at the intended files.
  const packageJson = JSON.parse(world.packageJson);
  if (packageJson.scripts?.[VERIFIER_SCRIPT] !== VERIFIER_COMMAND)
    violated(`the package script remains registered exactly: ${VERIFIER_SCRIPT}`);
  if (packageJson.scripts?.[CONTRACT_SCRIPT] !== CONTRACT_COMMAND)
    violated(`the package script remains registered exactly: ${CONTRACT_SCRIPT}`);
  if (!packageJson.scripts?.[VERIFIER_SCRIPT].includes('--env-file-if-exists=.env'))
    violated('the dynamic gate runs from CI-provided configuration without a physical .env');

  // 3./4. CI: the QIR-007 gate runs AFTER both existing runtime gates, each of
  //       which still runs independently exactly once.
  const ciOccurrences = (needle) => (world.ci.match(new RegExp(`run: npm run ${needle.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\b`, 'gu')) ?? []).length;
  if (ciOccurrences(A2_SCRIPT) !== 1) violated('the frozen A2 runtime smoke still runs in CI exactly once');
  if (ciOccurrences(FULL_INTELLIGENCE_SCRIPT) !== 1) violated('the frozen Full Intelligence runtime smoke still runs in CI exactly once');
  if (ciOccurrences(VERIFIER_SCRIPT) !== 1) violated('CI runs the QIR-007 dynamic gate exactly once');
  const a2At = world.ci.indexOf(`run: npm run ${A2_SCRIPT}`);
  const fullAt = world.ci.indexOf(`run: npm run ${FULL_INTELLIGENCE_SCRIPT}`);
  const hardeningAt = world.ci.indexOf(`run: npm run ${VERIFIER_SCRIPT}`);
  if (!(a2At > 0 && fullAt > a2At && hardeningAt > fullAt))
    violated('the QIR-007 dynamic gate runs AFTER the A2 smoke and AFTER the Full Intelligence smoke');
  const staticAt = world.ci.indexOf(CONTRACT_SCRIPT);
  const bootstrapAt = world.ci.indexOf('Apply all migrations to fresh PostgreSQL');
  if (staticAt < 0) violated('CI runs the QIR-007 static contract');
  if (!(staticAt < bootstrapAt))
    violated('the QIR-007 static contract runs before the database bootstrap: a pure static guard needs no database');
  // The existing gates are prerequisite regression gates, not QIR-007 scope.
  if (!world.ci.includes('run: npm run test:a2-e2e-smoke-contract'))
    violated('the frozen A2 static contract remains wired');
  if (!world.ci.includes('run: npm run test:full-intelligence-e2e-runtime-contract'))
    violated('the frozen Full Intelligence static contract remains wired');

  // 5. Migration 0063 is still the terminal migration: QIR-007 adds no 0064.
  if (!Array.isArray(world.migrations) || !world.migrations.includes(TERMINAL_MIGRATION))
    violated('migration 0063 exists');
  const numbered = world.migrations.filter((name) => /^\d{4}_/u.test(name));
  const highest = numbered.reduce((max, name) => (name > max ? name : max), numbered[0] ?? '');
  if (highest !== TERMINAL_MIGRATION) violated('migration 0063 is still the terminal migration - QIR-007 adds no 0064');

  // 6./7. The QIR-005 provider registry and cap stay EXACT, and no Question
  //       provider exists in the registry, the Question path, or the harness.
  if (!world.providerBudget.includes("export const POST_RESPONSE_PROVIDER_EFFECTS_V1 = [\n  'ASSOCIATION_PROVIDER',\n  'INTENT_PROVIDER',\n  'CANDIDATE_PROVIDER',\n] as const;"))
    violated('the provider-backed registry remains exactly the three frozen effects');
  if (!world.providerBudget.includes('export const POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3;'))
    violated('the hard lifecycle provider-call budget remains exactly 3');
  for (const [label, source] of [
    ['the provider registry', executable(world.providerBudget)],
    ['the Question selection service', executable(world.questionSelectionService)],
    ['the QIR-007 harness', exeHarness],
  ]) {
    if (/QUESTION_PROVIDER/u.test(source)) violated(`no QUESTION_PROVIDER effect exists in ${label}`);
  }
  if (/router\.generate|ModelRouter\b/u.test(executable(world.questionSelectionService)))
    violated('the Question selection service makes no provider or LLM call of its own');
  // The verifier proves the registry/cap DYNAMICALLY from production constants
  // rather than restating them, so a widened cap fails the runtime gate too.
  for (const canonical of [
    'POST_RESPONSE_PROVIDER_EFFECTS_V1', 'POST_RESPONSE_PROVIDER_CALL_BUDGET_V1',
    'POST_RESPONSE_EFFECT_PROVIDER_CLASSIFICATION_V1', 'reconstructSpentProviderSlots',
  ]) {
    if (!world.verifier.includes(canonical))
      violated(`the verifier censuses the canonical production constant ${canonical}`);
  }

  // 8. The three frozen foreground ceilings, read from production.
  if (!world.questionSelectionTypes.includes('export const QUESTION_FOREGROUND_WAIT_BUDGET_MS = 300;'))
    violated('the QIR-006 Question foreground ceiling remains exactly 300 ms');
  if (!world.gathererTypes.includes('export const QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS = 5000;'))
    violated('the QIR-003 Memory+Hypothesis shared foreground ceiling remains exactly 5000 ms');
  if (!world.orchestrator.includes('const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300;'))
    violated('the shared QHIA Human Intelligence foreground wait budget remains exactly 300 ms');
  for (const constant of ['QUESTION_FOREGROUND_WAIT_BUDGET_MS', 'QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS']) {
    if (!world.verifier.includes(constant))
      violated(`the verifier asserts the frozen ceiling ${constant} from production, never a restated literal`);
  }

  // 9./10. The global ceiling and the atomic Question slice.
  if (!world.budgetContract.includes('export const GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES = 131072;'))
    violated('the global normalized model-input ceiling remains exactly 131072 bytes');
  if (!world.budgetContract.includes('export const QUESTION_BUDGET_BYTES = 8192;'))
    violated('the atomic Question slice remains exactly 8192 bytes');
  if (!world.verifier.includes('GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES') || !world.verifier.includes('QUESTION_BUDGET_BYTES'))
    violated('the verifier asserts the frozen context-budget ceilings from production');

  // 11. Substantive A-H coverage in the dynamic verifier.
  for (const [scenario, markers] of Object.entries(SCENARIO_MARKERS)) {
    for (const marker of markers) {
      if (!world.verifier.includes(marker))
        violated(`scenario ${scenario} coverage is missing the substantive marker ${marker}`);
    }
  }
  // The verifier drives the REAL production composition and REUSES the frozen
  // helpers rather than forking a parallel intelligence architecture.
  for (const productionClass of REQUIRED_PRODUCTION_CLASSES) {
    if (!new RegExp(`\\b${productionClass}\\b`, 'u').test(world.verifier))
      violated(`the verifier composes the real production ${productionClass}`);
  }
  if (!world.verifier.includes('orchestrator.orchestrate('))
    violated('the verifier drives real turns through the real Conversation Orchestrator');
  for (const helper of REQUIRED_VERIFIER_HELPERS) {
    if (!world.verifier.includes(helper))
      violated(`the frozen verification helper is reused, not duplicated: ${helper}`);
  }
  for (const helper of REQUIRED_HARNESS_HELPERS) {
    if (!world.harness.includes(helper))
      violated(`the frozen verification helper is reused, not duplicated: ${helper}`);
  }
  // 11b. QIR-007 Fix 02 - Scenario F re-enters the canonical crash/checkpoint
  //      recoveries through the REAL production Redis reclaim seam. F1 stays
  //      duplicate delivery; F2/F3 must reclaim the ORIGINAL pending entry.
  //
  //      The exactly-one-synthetic-duplicate freeze is deliberate for QIR-007's
  //      own contract: a later reviewed task that legitimately adds another
  //      duplicate-delivery scenario re-anchors it in the same reviewed change,
  //      exactly like the migration-terminal freeze above.
  if (!world.redisConsumer.includes("this.client.xAutoClaim(this.stream,this.group,this.consumer,30000,'0-0',{COUNT:10})"))
    violated('the production reclaim seam and its frozen 30,000 ms stale-idle threshold are unchanged');
  if (!world.verifier.includes('const PRODUCTION_RECLAIM_IDLE_THRESHOLD_MS = 30000;'))
    violated('the verifier mirrors the frozen production stale-idle threshold exactly, and never redefines it');
  if (!exeVerifier.includes('await consumer.reclaim()'))
    violated('Scenario F re-enters recovery through the REAL RedisPostResponseConsumer.reclaim()');
  for (const invocation of ["reclaimOriginalPendingEntry('F2'", "reclaimOriginalPendingEntry('F3'"]) {
    if (!exeVerifier.includes(invocation))
      violated(`the canonical crash/checkpoint recovery re-enters through the real reclaim seam: ${invocation}`);
  }
  const syntheticDuplicates = (exeVerifier.match(/redisObserver\.xAdd\(/gu) ?? []).length;
  if (syntheticDuplicates !== 1)
    violated('exactly ONE synthetic duplicate delivery exists (F1); F2/F3 never republish a copy for recovery');
  if (!exeVerifier.includes('redisObserver.xClaim(') || !exeVerifier.includes('redisObserver.xPendingRange('))
    violated('the pending-entry staleness setup and its proof use verification-side Redis instrumentation only');
  for (const proof of [
    'the ORIGINAL Redis entry is genuinely PENDING before reclaim',
    'the stale-idle threshold the frozen production reclaim requires is genuinely satisfied',
    'reclaim returned the ORIGINAL Redis message ID - never a duplicate',
    'the reclaimed envelope is byte-identical to the original',
    'recovery created NO new stream entry - the original pending entry was reclaimed, not re-published',
    'XAUTOCLAIM transferred ownership to the production consumer - the real reclaim really executed',
    'both canonical F2 and F3 recoveries re-entered through the REAL RedisPostResponseConsumer.reclaim()',
  ]) {
    if (!exeVerifier.includes(proof)) violated(`the real-reclaim proof is substantive: missing "${proof}"`);
  }

  // No paid provider call is possible and no provider key is read.
  if (!world.verifier.includes('INTEGRATED_BRAIN_E2E_HARDENING_V2_EXTERNAL_HTTP_FORBIDDEN') || !world.verifier.includes('globalThis.fetch'))
    violated('the verifier seals the external HTTP boundary explicitly');
  if (!world.verifier.includes('delete process.env.SUPABASE_URL') || !world.verifier.includes('delete process.env.SUPABASE_SERVICE_ROLE_KEY'))
    violated('the real Supabase transport cannot activate inside the verifier');
  const harnessWorld = `${exeVerifier}\n${exeHarness}`;
  if (PROVIDER_ADAPTER_IMPORT.test(harnessWorld))
    violated('no real provider adapter is imported by the QIR-007 artifacts');
  if (PROVIDER_KEY_READ.test(harnessWorld))
    violated('no provider API key is read by the QIR-007 artifacts');
  // Canonical authority is never bypassed: no direct DML against derived or
  // authority-owned tables, and the retired finalization signature is unused.
  if (/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:public\.)?(?:memories|evidence|hypotheses|confidence_evaluations|information_gaps|question_candidates|hypothesis_updates|hypothesis_lifecycle_transitions|information_gap_confidence_sources|formal_question_turn_bindings|post_response_intelligence_executions|post_response_intelligence_effects|runtime_event_outbox|conversation_turns|conversation_sessions)\b/iu.test(harnessWorld))
    violated('the QIR-007 artifacts issue no direct DML against canonical or derived authority-owned tables');
  if (!world.verifier.includes('INSERT INTO auth.users'))
    violated('fixture bootstrap follows the established auth.users pattern');
  if (!/RETIRED_FINALIZATION_RPC\s*=\s*'finalize_conversation_turn'/u.test(world.verifier))
    violated('the verifier censuses the retired finalization signature by name and proves it is never reached');

  // 12. QIR-007 introduces NO new production runtime service: no production
  //     module may reference the QIR-007 artifacts, and the harness registers
  //     no Nest provider or module of its own.
  if (/@Injectable\(|@Module\(|@Controller\(/u.test(harnessWorld))
    violated('the QIR-007 artifacts declare no Nest provider, module, or controller');
  for (const source of world.productionSources ?? []) {
    if (/integrated-brain-e2e-hardening-v2|verify-integrated-brain-end-to-end-hardening-v2/u.test(source))
      violated('a production module references the QIR-007 verification harness');
  }

  // -------------------------------------------------------------------------
  // 13. QIR-007 ADDENDUM A - Cross-Context Adversarial & HI Capacity Proof v1.
  // -------------------------------------------------------------------------
  const exeCapacity = executable(world.capacity);
  if (typeof world.capacity !== 'string' || world.capacity.length < 6000)
    violated('the QIR-007 Addendum A capacity proof module exists and is substantive');

  // 13a. C5-C8 keep SUBSTANTIVE executable proof, not comments or headings.
  for (const proof of ADDENDUM_A_VERIFIER_PROOFS) {
    if (!exeVerifier.includes(proof)) violated(`the Addendum A cross-context proof is substantive: missing "${proof}"`);
  }
  for (const invocation of ADDENDUM_A_VERIFIER_INVOCATIONS) {
    if (!exeVerifier.includes(invocation))
      violated(`the Addendum A proof really invokes the named service/fault/census seam: ${invocation}`);
  }
  // The three verification-side fault kinds the addendum needs exist at the
  // ONE authenticated transport seam - and nowhere near production.
  for (const kind of ['REJECT_AFTER_CALL', 'GATE_AFTER_CALL', 'MALFORMED_SUCCESS']) {
    if (!exeHarness.includes(kind))
      violated(`the verification-only authenticated fault seam still supports ${kind}`);
  }

  // 13b. The integrated verifier issues NO direct per-channel and NO retired
  //      aggregate read of its own: the census names them, production never
  //      calls them, and a fallback appearing here would be caught.
  if (/public\.read_him_session_(?:situation_stress|decision_attention|goal_motivation|relationship_communication)_v1\(/u.test(exeVerifier))
    violated('the integrated verifier issues no direct per-channel cross-context read of its own');
  if (/public\.read_him_session_cross_context_foreground_v[12]\(/u.test(exeVerifier))
    violated('the integrated verifier issues no retired aggregate-v1/v2 read');
  for (const census of ['DIRECT_CROSS_CONTEXT_RPCS', 'RETIRED_CROSS_CONTEXT_AGGREGATE_RPCS', 'RELEVANCE_AUTHORITY_RPC']) {
    if (!exeVerifier.includes(census))
      violated(`the verifier censuses the forbidden cross-context transport by name: ${census}`);
  }

  // 13c. The FROZEN zero-incremental-wait aggregate architecture in production
  //      wiring: launched concurrently, recorded through a non-blocking
  //      settlement handler, never directly awaited, no dedicated timer, and
  //      accepted only before the ONE existing Human Intelligence barrier.
  if (!world.orchestrator.includes('crossContextForegroundReadPromise.then('))
    violated('the cross-context aggregate is recorded through a non-blocking settlement handler');
  if (/await\s+(?:this\.)?crossContextForegroundReadPromise/u.test(world.orchestrator))
    violated('the cross-context aggregate lane is never directly awaited');
  if (!world.orchestrator.includes('crossContextForegroundBarrierClosed = true'))
    violated('the cross-context aggregate is accepted only before the existing Human Intelligence barrier closes');
  if (/CROSS_CONTEXT[A-Z_]*(?:WAIT|TIMEOUT|DEADLINE|BUDGET)[A-Z_]*_MS|withCrossContext[A-Za-z]*(?:Budget|Timeout|Deadline)/u.test(world.orchestrator))
    violated('the cross-context aggregate lane gains no dedicated timer, timeout, or incremental wait budget');

  // 13d. CURRENT_MAX_HUMAN_INTELLIGENCE is measured through the REAL canonical
  //      renderer and decided against the FROZEN production slice.
  for (const canonical of ADDENDUM_A_CAPACITY_CANONICAL_SOURCES) {
    if (!world.capacity.includes(canonical))
      violated(`the current-maximum proof measures through the REAL canonical rendering identity: ${canonical}`);
  }
  if (!exeCapacity.includes('const sliceBytes = HUMAN_INTELLIGENCE_BUDGET_BYTES;'))
    violated('the capacity verdict uses the frozen production Human Intelligence slice, never a restated literal');
  if (!exeCapacity.includes('incrementalBytes <= sliceBytes'))
    violated('the capacity verdict compares the measured bytes against HUMAN_INTELLIGENCE_BUDGET_BYTES');
  if (!exeCapacity.includes("assert.equal(decision!.outcome, 'INCLUDED_FULL',"))
    violated('the PASS path is proven through the REAL QIR-004 assembler as INCLUDED_FULL');
  if (!world.budgetContract.includes('export const HUMAN_INTELLIGENCE_BUDGET_BYTES = 8192;'))
    violated('the atomic Human Intelligence slice remains exactly 8192 bytes');
  if (!world.capacity.includes('export const EXPECTED_CURRENT_MAX_HUMAN_INTELLIGENCE_INCREMENTAL_BYTES = 7518;'))
    violated('the measured current-maximum Human Intelligence footprint remains the exact locked result');

  // 13d-bis (Fix 04). The capacity search measures only REACHABLE coherent
  // runtime states: ONE canonical reasoning context per candidate, feeding BOTH
  // the real Interaction Adaptation derivation and the DEEP projection.
  for (const proof of ADDENDUM_A_REACHABILITY_PROOFS) {
    if (!exeCapacity.includes(proof))
      violated(`the capacity proof measures only reachable coherent states: missing "${proof}"`);
  }
  // No hard-coded adaptation fixture may exist. A usable one needs a literal
  // directives object or a literal drivers array, so forbidding both is what
  // structurally prevents the unreachable always-maximal pairing Fix 04 removed.
  // (`adaptationState` is deliberately NOT pattern-matched: it appears
  // legitimately in the exported result TYPE.)
  if (/\bdirectives:\s*\{/u.test(exeCapacity))
    violated('the capacity proof declares no hard-coded Interaction Adaptation directives object');
  if (/\bdrivers:\s*\[/u.test(exeCapacity))
    violated('the capacity proof never pins an Interaction Adaptation driver list literal');

  // 13e. The maximum fixture really is maximal: all eight frozen Brain Context
  //      slots, all three currently legal session metrics, all four ACTIVE
  //      cross-context channels, and an EXHAUSTIVE legal search rather than a
  //      hand-picked shape.
  if (!world.brainContextTypes.includes('export const HIM_BRAIN_CONTEXT_MAX_SIGNALS = 8 as const;'))
    violated('the frozen Brain Context registry still allows exactly eight slots');
  const brainMetricKeys = [...world.brainContextTypes.matchAll(/metricKey: '([a-z.-]+)'/gu)].map((match) => match[1]);
  if (brainMetricKeys.length !== 8) violated('the frozen Brain Context registry still declares exactly eight slot metrics');
  for (const metricKey of brainMetricKeys) {
    if (!exeCapacity.includes(`'${metricKey}'`))
      violated(`the eight-slot Brain Context maximum fixture still carries ${metricKey}`);
  }
  if (!exeCapacity.includes('HIM_BRAIN_CONTEXT_MAX_SIGNALS'))
    violated('the maximum fixture is pinned to the frozen eight-slot Brain Context ceiling');
  for (const metricKey of ['hse.stress', 'hse.energy', 'hse.attention']) {
    if (!exeCapacity.includes(`'${metricKey}'`))
      violated(`the maximum fixture carries the currently legal session reasoning metric ${metricKey}`);
  }
  for (const directive of [
    'REDUCE_INTERACTION_BURDEN', 'REDUCE_PRESENTATION_BURDEN',
    'REDUCE_GOAL_ACTION_BURDEN', 'STRUCTURE_RELATIONSHIP_COMMUNICATION',
  ]) {
    if (!exeCapacity.includes(directive))
      violated(`the maximum fixture keeps the ACTIVE cross-context channel ${directive}`);
  }
  if (!exeCapacity.includes('the maximality search really enumerated the whole legal shape space'))
    violated('the current maximum is SEARCHED over the legal shape space, never hand-picked');

  // 13f. The frozen 6427 evidence is preserved and correctly classified: it
  //      remains the canonical ALL-ACTIVE fixture footprint and is never
  //      renamed as the maximum.
  if (!world.humanIntelligenceFootprintSpec.includes('const EXPECTED_QHIA_013_HUMAN_INTELLIGENCE_BYTES = 6427;'))
    violated('the frozen QHIA-013 all-active 6427-byte footprint proof is preserved, not deleted');
  if (!world.capacity.includes('export const CANONICAL_ALL_ACTIVE_HUMAN_INTELLIGENCE_BYTES = 6427;'))
    violated('the canonical all-active fixture footprint stays recorded as exactly 6427, beside the measured maximum');
  if (!exeCapacity.includes('incrementalBytes > CANONICAL_ALL_ACTIVE_HUMAN_INTELLIGENCE_BYTES'))
    violated('the two figures stay distinct: the measured maximum is proven strictly larger than the all-active fixture');
}

function listProductionSources() {
  const base = fileURLToPath(new URL('apps/api/src/', root));
  return readdirSync(base, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => readFileSync(join(entry.parentPath ?? entry.path ?? base, entry.name), 'utf8'));
}

const productionSources = listProductionSources();
const shippedWorld = Object.freeze({ ...shipped, productionSources: Object.freeze(productionSources) });

test('QIR7-1 - the shipped repository satisfies the QIR-007 contract', () => {
  assert.ok(productionSources.length > 100, 'production sources were actually scanned');
  assert.doesNotThrow(() => assertIntegratedBrainHardeningContract(shippedWorld));
});

test('QIR7-2 - anti-vacuity: the real guard rejects every named regression', () => {
  const drifts = [
    ['the normative document was deleted', { contractDoc: '' }],
    ['the zero-semantics rule was withdrawn from the document', {
      contractDoc: shipped.contractDoc.replace('Its default rule is **ZERO new production\nsemantics**', 'Its default rule is flexible'),
    }],
    ['the no-answer-detector rule was withdrawn from the document', {
      contractDoc: shipped.contractDoc.replace('**There is no Question-specific answer detector, and Question Runtime never\nresolves a gap directly.**', 'An answer detector closes the loop.'),
    }],
    ['the no-migration-0064 rule was withdrawn from the document', {
      contractDoc: shipped.contractDoc.replace('no database schema change and **no migration 0064**', 'a schema change is allowed'),
    }],
    ['the docs index lost the document link', {
      docsReadme: shipped.docsReadme.replaceAll('integrated-brain-e2e-hardening-v2.md', 'missing.md'),
    }],
    ['the dynamic verifier was hollowed out', { verifier: 'retired' }],
    ['the verification harness was hollowed out', { harness: 'retired' }],
    ['the dynamic gate was deregistered from package scripts', {
      packageJson: shipped.packageJson.replace('"verify:integrated-brain:e2e-hardening-v2":', '"verify:integrated-brain:e2e-hardening-v2-retired":'),
    }],
    ['the static guard was deregistered from package scripts', {
      packageJson: shipped.packageJson.replace('"test:integrated-brain-e2e-hardening-v2-contract":', '"test:integrated-brain-e2e-hardening-v2-contract-retired":'),
    }],
    ['the dynamic gate was deregistered from CI', {
      ci: shipped.ci.replaceAll(`run: npm run ${VERIFIER_SCRIPT}`, 'run: echo skipped'),
    }],
    ['the static guard was deregistered from CI', {
      ci: shipped.ci.replaceAll(CONTRACT_SCRIPT, 'echo skipped'),
    }],
    ['the QIR-007 gate was moved AHEAD of the Full Intelligence smoke', {
      ci: shipped.ci
        .replace(`      - {name: Verify Integrated Brain end-to-end hardening v2, run: npm run ${VERIFIER_SCRIPT}}\n`, '')
        .replace(`      - {name: Verify Full Intelligence end-to-end runtime smoke, run: npm run ${FULL_INTELLIGENCE_SCRIPT}}`,
          `      - {name: Verify Integrated Brain end-to-end hardening v2, run: npm run ${VERIFIER_SCRIPT}}\n      - {name: Verify Full Intelligence end-to-end runtime smoke, run: npm run ${FULL_INTELLIGENCE_SCRIPT}}`),
    }],
    ['the frozen A2 runtime gate was removed', {
      ci: shipped.ci.replaceAll(`run: npm run ${A2_SCRIPT}`, 'run: echo skipped'),
    }],
    ['the frozen Full Intelligence runtime gate was removed', {
      ci: shipped.ci.replaceAll(`run: npm run ${FULL_INTELLIGENCE_SCRIPT}`, 'run: echo skipped'),
    }],
    ['the frozen Full Intelligence static contract was removed', {
      ci: shipped.ci.replace('run: npm run test:full-intelligence-e2e-runtime-contract', 'run: echo skipped'),
    }],
    ['a later migration silently landed without re-anchoring the terminal baseline', {
      migrations: Object.freeze([...shipped.migrations, '0064_unreviewed_future_change.sql']),
    }],
    ['migration 0063 disappeared', {
      migrations: Object.freeze(shipped.migrations.filter((name) => name !== TERMINAL_MIGRATION)),
    }],
    ['a fourth provider-backed background effect appeared', {
      providerBudget: shipped.providerBudget.replace(
        "export const POST_RESPONSE_PROVIDER_EFFECTS_V1 = [\n  'ASSOCIATION_PROVIDER',\n  'INTENT_PROVIDER',\n  'CANDIDATE_PROVIDER',\n] as const;",
        "export const POST_RESPONSE_PROVIDER_EFFECTS_V1 = [\n  'ASSOCIATION_PROVIDER',\n  'INTENT_PROVIDER',\n  'CANDIDATE_PROVIDER',\n  'QUESTION_PROVIDER',\n] as const;",
      ),
    }],
    ['the provider cap was raised', {
      providerBudget: shipped.providerBudget.replace('export const POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3;', 'export const POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 4;'),
    }],
    ['a Question provider entered the Question selection path', {
      questionSelectionService: `${shipped.questionSelectionService}\n// drift\nconst leak = 'QUESTION_PROVIDER';\n`,
    }],
    ['the Question selection service grew a provider call', {
      questionSelectionService: `${shipped.questionSelectionService}\n// drift\nconst leak = (router) => router.generate({});\n`,
    }],
    ['the Question foreground ceiling was raised', {
      questionSelectionTypes: shipped.questionSelectionTypes.replace('export const QUESTION_FOREGROUND_WAIT_BUDGET_MS = 300;', 'export const QUESTION_FOREGROUND_WAIT_BUDGET_MS = 5000;'),
    }],
    ['the QIR-003 shared foreground ceiling was raised', {
      gathererTypes: shipped.gathererTypes.replace('export const QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS = 5000;', 'export const QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS = 30000;'),
    }],
    ['the shared Human Intelligence wait budget was raised', {
      orchestrator: shipped.orchestrator.replace('const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300;', 'const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 5000;'),
    }],
    ['the global context ceiling moved', {
      budgetContract: shipped.budgetContract.replace('export const GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES = 131072;', 'export const GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES = 139264;'),
    }],
    ['the Question slice was widened', {
      budgetContract: shipped.budgetContract.replace('export const QUESTION_BUDGET_BYTES = 8192;', 'export const QUESTION_BUDGET_BYTES = 16384;'),
    }],
    ['the external HTTP seal was removed from the verifier', {
      verifier: shipped.verifier.replaceAll('INTEGRATED_BRAIN_E2E_HARDENING_V2_EXTERNAL_HTTP_FORBIDDEN', 'ALLOWED'),
    }],
    ['a real provider adapter was imported by the verifier', {
      verifier: `${shipped.verifier}\nimport { RealRouter } from '../src/model-router/providers/anthropic.adapter';\n`,
    }],
    ['a provider API key was read', {
      harness: `${shipped.harness}\nconst key = process.env.ANTHROPIC_API_KEY;\n`,
    }],
    ['the verifier started writing canonical authority-owned rows directly', {
      verifier: `${shipped.verifier}\nconst drift = 'UPDATE public.information_gaps SET status = 1';\n`,
    }],
    ['the harness became a production Nest provider', {
      harness: `${shipped.harness}\n@Injectable()\nexport class Leak {}\n`,
    }],
    ['a production module started importing the verification harness', {
      productionSources: Object.freeze([...productionSources, "import { x } from '../../scripts/integrated-brain-e2e-hardening-v2/hardening-harness';"]),
    }],
    ['the verifier stopped driving the real orchestrator', {
      verifier: shipped.verifier.replaceAll('orchestrator.orchestrate(', 'fakeOrchestrator.run('),
    }],
    ['the verifier stopped reusing the frozen A2 database session', {
      verifier: shipped.verifier.replace("from './a2-e2e-smoke/smoke-db'", "from './integrated-brain-e2e-hardening-v2/forked-db'"),
    }],
    ['the verifier stopped reusing the frozen conversational router double', {
      harness: shipped.harness.replace("from '../full-intelligence-e2e-smoke/deterministic-conversational-router'", "from './forked-router'"),
    }],
    ['the verifier stopped reusing the frozen authenticated transport substitute', {
      harness: shipped.harness.replace("from '../full-intelligence-e2e-smoke/pg-foreground-intelligence.adapters'", "from './forked-adapters'"),
    }],
    ['the retired finalization census was deleted', {
      verifier: shipped.verifier.replace("const RETIRED_FINALIZATION_RPC = 'finalize_conversation_turn';", ''),
    }],
    // QIR-007 Fix 02 regressions: the real Redis reclaim seam and its neighbours.
    ['the real reclaim invocation was replaced by an ordinary consumer read', {
      verifier: shipped.verifier.replace('const reclaimed = await consumer.reclaim();', 'const reclaimed = await consumer.read();'),
    }],
    ['F2 stopped recovering through the real reclaim seam', {
      verifier: shipped.verifier.replace("reclaimOriginalPendingEntry('F2'", "legacyDuplicateRecovery('F2'"),
    }],
    ['F3 stopped recovering through the real reclaim seam', {
      verifier: shipped.verifier.replace("reclaimOriginalPendingEntry('F3'", "legacyDuplicateRecovery('F3'"),
    }],
    ['a synthetic duplicate stream entry was reintroduced for the reclaim recoveries', {
      verifier: `${shipped.verifier}\nconst drift = async () => { await redisObserver.xAdd(STREAM, '*', { envelope: 'copy' }); };\n`,
    }],
    ['the production reclaim stale-idle threshold drifted', {
      redisConsumer: shipped.redisConsumer.replace("30000,'0-0'", "5000,'0-0'"),
    }],
    ['the verifier stopped mirroring the frozen production stale-idle threshold', {
      verifier: shipped.verifier.replace('const PRODUCTION_RECLAIM_IDLE_THRESHOLD_MS = 30000;', 'const PRODUCTION_RECLAIM_IDLE_THRESHOLD_MS = 1;'),
    }],
    ['the pending-before-reclaim proof was gutted', {
      verifier: shipped.verifier.replaceAll('the ORIGINAL Redis entry is genuinely PENDING before reclaim', 'skipped'),
    }],
    ['the stale-idle-threshold proof was gutted', {
      verifier: shipped.verifier.replaceAll('the stale-idle threshold the frozen production reclaim requires is genuinely satisfied', 'skipped'),
    }],
    ['the original-message-ID reclaim proof was gutted', {
      verifier: shipped.verifier.replaceAll('reclaim returned the ORIGINAL Redis message ID - never a duplicate', 'skipped'),
    }],
    ['the byte-identical-envelope reclaim proof was gutted', {
      verifier: shipped.verifier.replaceAll('the reclaimed envelope is byte-identical to the original', 'skipped'),
    }],
    ['the no-new-stream-entry proof was gutted', {
      verifier: shipped.verifier.replaceAll('recovery created NO new stream entry - the original pending entry was reclaimed, not re-published', 'skipped'),
    }],
    ['the XAUTOCLAIM ownership-transfer proof was gutted', {
      verifier: shipped.verifier.replaceAll('XAUTOCLAIM transferred ownership to the production consumer - the real reclaim really executed', 'skipped'),
    }],
    ['the both-recoveries reclaim census was gutted', {
      verifier: shipped.verifier.replaceAll('both canonical F2 and F3 recoveries re-entered through the REAL RedisPostResponseConsumer.reclaim()', 'skipped'),
    }],
    ['the verification-side pending-entry instrumentation was removed', {
      verifier: shipped.verifier.replaceAll('redisObserver.xPendingRange(', 'noopPendingRange('),
    }],
    ['the F1/F2/F3 seam separation was withdrawn from the document', {
      contractDoc: shipped.contractDoc.replace('**F2 and F3 = real production Redis reclaim**', 'F2 and F3 also use duplicate delivery'),
    }],
    // QIR-007 Addendum A regressions: the cross-context adversarial subsection
    // and the current-maximum Human Intelligence capacity proof.
    ['the Addendum A capacity proof module was hollowed out', { capacity: 'retired' }],
    ['the C5 rejection-really-reached-the-request proof was gutted', {
      verifier: shipped.verifier.replaceAll(
        'the canonical aggregate really RAN against real PostgreSQL and the injected rejection hit THAT request', 'skipped'),
    }],
    ['the C5 no-fabricated-NONE proof was gutted', {
      verifier: shipped.verifier.replaceAll('REJECTED is omission, never an authoritative all-four NONE answer', 'skipped'),
    }],
    ['the C6 still-pending-at-the-barrier proof was gutted', {
      verifier: shipped.verifier.replaceAll(
        'the successful aggregate settlement was STILL PENDING when the existing Human Intelligence barrier closed', 'skipped'),
    }],
    ['the C6 no-late-mutation proof was gutted', {
      verifier: shipped.verifier.replaceAll('the already-built provider request is not mutated by the late settlement', 'skipped'),
    }],
    ['the C6 no-cross-turn-cache proof was gutted', {
      verifier: shipped.verifier.replaceAll(
        'the next turn performs its OWN current aggregate read - no cross-turn cache exists to inherit', 'skipped'),
    }],
    ['the C7 real-aggregate-rejection proof was gutted', {
      verifier: shipped.verifier.replaceAll(
        'REJECTS the malformed successful envelope - it is never sorted, padded, repaired, or partially salvaged', 'skipped'),
    }],
    ['the C7 no-partial-salvage proof was gutted', {
      verifier: shipped.verifier.replaceAll('NO partial channel salvage', 'skipped'),
    }],
    ['the C8 all-four-bindings proof was gutted', {
      verifier: shipped.verifier.replaceAll('ALL FOUR context bindings are genuinely ACTIVE on the SAME session at the same time', 'skipped'),
    }],
    ['the C8 four-real-consumers proof was gutted', {
      verifier: shipped.verifier.replaceAll(
        'all FOUR real semantic consumers ran and all FOUR results are ACTIVE simultaneously on the same session', 'skipped'),
    }],
    ['the C8 one-envelope proof was gutted', {
      verifier: shipped.verifier.replaceAll(
        'the four channels compile into ONE humanIntelligence envelope - there is no separate per-channel ModelRouter field', 'skipped'),
    }],
    ['the C8 no-voting/no-amplification proof was gutted', {
      verifier: shipped.verifier.replaceAll(
        'agreement between sources creates no vote, count, weight, confidence, strength or amplification field of any kind', 'skipped'),
    }],
    ['the real fault seam was replaced by an assertion about nothing', {
      verifier: shipped.verifier.replaceAll("kind: 'REJECT_AFTER_CALL'", "kind: 'RETIRED'"),
    }],
    ['the deterministic late-settlement gate was removed from the aggregate lane', {
      verifier: shipped.verifier.replaceAll("kind: 'GATE_AFTER_CALL'", "kind: 'RETIRED'"),
    }],
    ['the malformed-aggregate fixture stopped crossing the real boundary', {
      verifier: shipped.verifier.replaceAll("kind: 'MALFORMED_SUCCESS', value: malformedAggregateRows", "kind: 'RETIRED'"),
    }],
    ['the verification-only authenticated aggregate fault seam was removed', {
      harness: shipped.harness.replaceAll('MALFORMED_SUCCESS', 'RETIRED_SUCCESS'),
    }],
    ['the real aggregation service stopped being driven directly', {
      verifier: shipped.verifier.replaceAll('himCrossContextForegroundService.read(', 'fakeAggregate.read('),
    }],
    ['the all-four fixture stopped using the real explicit activation authority', {
      verifier: shipped.verifier.replaceAll('contextActivationService.activateContext(', 'directBindingWrite('),
    }],
    ['a direct per-channel fallback read appeared in the integrated verifier', {
      verifier: `${shipped.verifier}\nconst drift = 'SELECT * FROM public.read_him_session_situation_stress_v1($1, $2)';\n`,
    }],
    ['a retired aggregate fallback read appeared in the integrated verifier', {
      verifier: `${shipped.verifier}\nconst drift = 'SELECT * FROM public.read_him_session_cross_context_foreground_v2($1, $2)';\n`,
    }],
    ['the cross-context aggregate disappeared from the QIR-007 composition', {
      verifier: shipped.verifier.replaceAll('HimCrossContextForegroundAggregationService', 'FakeAggregateStub'),
    }],
    ['a dedicated timer was introduced on the zero-wait aggregate lane', {
      orchestrator: `${shipped.orchestrator}\nconst CROSS_CONTEXT_FOREGROUND_WAIT_BUDGET_MS = 300;\n`,
    }],
    ['the aggregate lane became directly awaited', {
      orchestrator: shipped.orchestrator.replace(
        'crossContextForegroundReadPromise.then(', 'await crossContextForegroundReadPromise;\n      crossContextForegroundReadPromise.then('),
    }],
    ['the non-blocking aggregate settlement handler disappeared', {
      orchestrator: shipped.orchestrator.replaceAll('crossContextForegroundReadPromise.then(', 'crossContextForegroundReadPromise.finally('),
    }],
    ['the aggregate stopped being bounded by the existing Human Intelligence barrier', {
      orchestrator: shipped.orchestrator.replaceAll('crossContextForegroundBarrierClosed = true', 'crossContextForegroundBarrierClosed = false'),
    }],
    ['the capacity proof stopped using the real canonical renderer', {
      capacity: shipped.capacity.replaceAll('composeServerGuidance(', 'approximateServerGuidance('),
    }],
    ['the capacity proof stopped measuring in UTF-8 bytes', {
      capacity: shipped.capacity.replace("Buffer.byteLength(value, 'utf8')", 'value.length'),
    }],
    ['the capacity verdict stopped comparing against the frozen Human Intelligence slice', {
      capacity: shipped.capacity.replace('const sliceBytes = HUMAN_INTELLIGENCE_BUDGET_BYTES;', 'const sliceBytes = 16384;'),
    }],
    ['the PASS path stopped being proven through the real QIR-004 assembler', {
      capacity: shipped.capacity.replace("assert.equal(decision!.outcome, 'INCLUDED_FULL',", "assert.ok(true, ("),
    }],
    ['the eight-slot Brain Context maximum fixture silently shrank', {
      capacity: shipped.capacity.replaceAll("'hgs.habit-strength'", "'hgs.retired'"),
    }],
    ['a session reasoning metric was dropped from the maximum fixture', {
      capacity: shipped.capacity.replaceAll("'hse.energy'", "'hse.retired'"),
    }],
    ['a cross-context channel was dropped from the maximum fixture', {
      capacity: shipped.capacity.replaceAll('STRUCTURE_RELATIONSHIP_COMMUNICATION', 'RETIRED_DIRECTIVE'),
    }],
    ['the exhaustive legal maximality search was replaced by a hand-picked fixture', {
      capacity: shipped.capacity.replaceAll('the maximality search really enumerated the whole legal shape space', 'skipped'),
    }],
    ['the measured current maximum was silently re-baselined', {
      capacity: shipped.capacity.replace(
        'export const EXPECTED_CURRENT_MAX_HUMAN_INTELLIGENCE_INCREMENTAL_BYTES = 7518;',
        'export const EXPECTED_CURRENT_MAX_HUMAN_INTELLIGENCE_INCREMENTAL_BYTES = 9999;'),
    }],
    // QIR-007 Addendum A Fix 04 regressions: reachability coherence.
    ['the real adaptation derivation was replaced by a hard-coded object', {
      capacity: shipped.capacity.replace(
        'const adaptation = interactionAdaptation.derive(reasoningContext);',
        "const adaptation = { contractVersion: 1, adaptationState: 'ACTIVE', directives: { responseDensity: 'COMPACT' }, drivers: ['STRESS_HIGH_OR_VERY_HIGH'] };"),
    }],
    ['the adaptation candidate was decoupled from the reasoning context used for the DEEP projection', {
      capacity: shipped.capacity.replace(
        'const adaptation = interactionAdaptation.derive(reasoningContext);',
        'const adaptation = interactionAdaptation.derive(candidateReasoningContext(shapes));'),
    }],
    ['a synthetic all-directives-ACTIVE adaptation fixture returned', {
      capacity: `${shipped.capacity}\nconst MAXIMUM_INTERACTION_ADAPTATION = { directives: { responseDensity: 'COMPACT', cognitiveLoad: 'REDUCED' } };\n`,
    }],
    ['a synthetic adaptation driver list was pinned back into the capacity fixture', {
      capacity: `${shipped.capacity}\nconst PINNED = { drivers: ['STRESS_HIGH_OR_VERY_HIGH', 'ENERGY_LOW_OR_VERY_LOW'] };\n`,
    }],
    ['the real Interaction Adaptation service stopped being instantiated', {
      capacity: shipped.capacity.replaceAll('new HimInteractionAdaptationService()', 'stubAdaptationDerivation()'),
    }],
    ['the real Interaction Adaptation service import was dropped', {
      capacity: shipped.capacity.replace(
        "from '../../src/human-model/him-interaction-adaptation.service'", "from './local-adaptation-stub'"),
    }],
    ["the Orchestrator's own ACTIVE adaptation gate was bypassed in the capacity proof", {
      capacity: shipped.capacity.replace(
        "adaptation.adaptationState === 'ACTIVE' ? { himInteractionAdaptation: adaptation } : {}",
        'himInteractionAdaptation: adaptation'),
    }],
    ['the winning adaptation is no longer re-derived from its own reasoning context', {
      capacity: shipped.capacity.replaceAll(
        'the winning Interaction Adaptation is EXACTLY what the real service derives from the winning reasoning context', 'skipped'),
    }],
    ['the same-context DEEP projection proof was gutted', {
      capacity: shipped.capacity.replaceAll('the winning DEEP projection comes from that SAME reasoning context', 'skipped'),
    }],
    ['the whole-envelope recompilation proof was gutted', {
      capacity: shipped.capacity.replaceAll(
        'the measured maximum is exactly the envelope one coherent runtime state compiles to', 'skipped'),
    }],
    ['the driver-backing proof was gutted', {
      capacity: shipped.capacity.replaceAll('driver is backed by a genuinely KNOWN', 'skipped'),
    }],
    ['the always-maximal negative control was gutted', {
      capacity: shipped.capacity.replaceAll(
        'an always-maximal adaptation is reachable ONLY from a context that derives every frozen driver', 'skipped'),
    }],
    ['the Adaptation-exclusive instruction coherence proof was gutted', {
      capacity: shipped.capacity.replaceAll(
        'the one Adaptation-exclusive instruction is present EXACTLY when the real derivation authorized it', 'skipped'),
    }],
    ['the reachability correction was withdrawn from the document', {
      contractDoc: shipped.contractDoc.replace(
        'Maximality is SEARCHED over **reachable coherent runtime states**', 'Maximality is assumed'),
    }],
    ['the superseded synthetic figure was hidden from the document', {
      contractDoc: shipped.contractDoc.replace('The superseded synthetic figure was `7536`', 'No prior figure existed'),
    }],
    ['the Human Intelligence slice was widened to make the maximum fit', {
      budgetContract: shipped.budgetContract.replace(
        'export const HUMAN_INTELLIGENCE_BUDGET_BYTES = 8192;', 'export const HUMAN_INTELLIGENCE_BUDGET_BYTES = 16384;'),
    }],
    ['the frozen 6427 all-active footprint proof was deleted', {
      humanIntelligenceFootprintSpec: shipped.humanIntelligenceFootprintSpec.replace(
        'const EXPECTED_QHIA_013_HUMAN_INTELLIGENCE_BYTES = 6427;', ''),
    }],
    ['the all-active fixture footprint was re-labelled as the maximum', {
      capacity: shipped.capacity.replace(
        'export const CANONICAL_ALL_ACTIVE_HUMAN_INTELLIGENCE_BYTES = 6427;',
        'export const CURRENT_MAX_HUMAN_INTELLIGENCE_BYTES = 6427;'),
    }],
    ['the two footprint figures stopped being proven distinct', {
      capacity: shipped.capacity.replaceAll('incrementalBytes > CANONICAL_ALL_ACTIVE_HUMAN_INTELLIGENCE_BYTES', 'true'),
    }],
    ['the frozen Brain Context registry ceiling moved', {
      brainContextTypes: shipped.brainContextTypes.replace(
        'export const HIM_BRAIN_CONTEXT_MAX_SIGNALS = 8 as const;', 'export const HIM_BRAIN_CONTEXT_MAX_SIGNALS = 9 as const;'),
    }],
    ['the Addendum A section was withdrawn from the document', {
      contractDoc: shipped.contractDoc.replace(
        '## 11. Addendum A — Cross-Context Adversarial & Human Intelligence Capacity Proof v1', '## 11. Retired'),
    }],
    ['the measured capacity result was withdrawn from the document', {
      contractDoc: shipped.contractDoc.replace(
        'CURRENT_MAX_HUMAN_INTELLIGENCE_INCREMENTAL_BYTES = 7518', 'measurement pending'),
    }],
    ['the no-fallback rule was withdrawn from the document', {
      contractDoc: shipped.contractDoc.replace('no aggregate-v1/v2 fallback', 'a per-channel fallback read is allowed'),
    }],
    ...Object.entries(SCENARIO_MARKERS).map(([scenario, markers]) => [
      `scenario ${scenario} coverage was gutted`,
      { verifier: shipped.verifier.replaceAll(markers[0], `'RETIRED-${scenario}: `) },
    ]),
    ...REQUIRED_PRODUCTION_CLASSES.slice(0, 6).map((productionClass) => [
      `the verifier stopped composing the real ${productionClass}`,
      { verifier: shipped.verifier.replaceAll(productionClass, `Fake${productionClass}Stub`) },
    ]),
  ];

  for (const [label, overrides] of drifts) {
    const mutated = { ...shippedWorld, ...overrides };
    for (const key of Object.keys(overrides)) {
      assert.notDeepEqual(mutated[key], shippedWorld[key], `the "${label}" mutation actually replaced its source`);
    }
    assert.throws(
      () => assertIntegratedBrainHardeningContract(mutated),
      /QIR-007 Integrated Brain E2E Hardening v2 contract violated/u,
      `the guard rejects: ${label}`,
    );
  }
});

test('QIR7-3 - forward safety: legitimate later evolution stays legal', () => {
  // A later reviewed QIR-008 CI step may be appended after the QIR-007 gate.
  const gateLine = shipped.ci.match(/^.*verify:integrated-brain:e2e-hardening-v2.*$/mu)[0];
  assert.doesNotThrow(() => assertIntegratedBrainHardeningContract({
    ...shippedWorld,
    ci: shipped.ci.replace(gateLine, `${gateLine}\n      - {name: Verify QIR-008 phase closure, run: npm run verify:qir-008-phase-closure}`),
  }), 'a later reviewed QIR gate stays legal');
  // A later reviewed documentation amendment stays legal.
  assert.doesNotThrow(() => assertIntegratedBrainHardeningContract({
    ...shippedWorld,
    contractDoc: `${shipped.contractDoc}\n\n## Amendment A1 (QIR-008)\n\nRecorded under its own reviewed contract.\n`,
  }), 'a later reviewed document amendment stays legal');
  // A later reviewed NON-provider background effect stays legal: the guard
  // freezes the PROVIDER registry and the cap, never the whole effect list.
  assert.doesNotThrow(() => assertIntegratedBrainHardeningContract({
    ...shippedWorld,
    providerBudget: shipped.providerBudget.replace(
      "  HIM_BRAIN_CONTEXT_MATERIALIZATION: 'NON_PROVIDER',",
      "  HIM_BRAIN_CONTEXT_MATERIALIZATION: 'NON_PROVIDER',\n  FUTURE_LEDGER_EFFECT: 'NON_PROVIDER',",
    ),
  }), 'a later reviewed NON-provider effect classification stays legal');
  // A later reviewed scenario may be APPENDED to the dynamic verifier.
  assert.doesNotThrow(() => assertIntegratedBrainHardeningContract({
    ...shippedWorld,
    verifier: `${shipped.verifier}\n// A later reviewed adversarial scenario may be appended here.\n`,
  }), 'appending a later reviewed scenario stays legal');
  // A later reviewed production service may be added: the guard only forbids
  // production referencing the QIR-007 harness.
  assert.doesNotThrow(() => assertIntegratedBrainHardeningContract({
    ...shippedWorld,
    productionSources: Object.freeze([...productionSources, '@Injectable()\nexport class FutureReviewedService {}\n']),
  }), 'a later reviewed production service stays legal');
});

test('QIR7-4 - the guard is structurally independent of every mutable census gap', () => {
  const worldPaths = Object.values(SOURCES);
  for (const excluded of [
    'apps/api/src/model-router/model-profile.registry.ts',
    'apps/api/src/memory/memory-retriever.service.ts',
    'apps/api/src/hypothesis/hypothesis-reasoning-context.types.ts',
    'apps/api/src/intelligence-runtime/fast-deep-runtime-decision-policy-v2.ts',
    'apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts',
  ]) {
    assert.ok(!worldPaths.includes(excluded), `the guard world never includes ${excluded}`);
  }
  assert.ok(worldPaths.every((path) => !path.includes('providers/')),
    'the guard world never includes a provider adapter source');
  const guardSource = assertIntegratedBrainHardeningContract.toString();
  for (const forbidden of [
    'DEEP_INPUT_SCALE_CODE_POINTS',
    'MAX_SELECTED_MEMORIES',
    'MAX_MODEL_HYPOTHESES',
    'RUNTIME_ROUTING_V2_',
    ['claude', '-'].join(''),
    ['gpt', '-'].join(''),
    ['gem', 'ini'].join(''),
    ['ki', 'mi'].join(''),
  ]) {
    assert.ok(!guardSource.includes(forbidden), `the guard never depends on the mutable census literal ${forbidden}`);
  }
});

test('QIR7-5 - the QIR-007 diff scope changed no production source or migration', () => {
  // The dynamic verifier and its harness are the ONLY QIR-007 runtime code, and
  // they live entirely under apps/api/scripts. A production module that ever
  // needs them would be a new production runtime service by definition.
  for (const path of [VERIFIER, HARNESS, CAPACITY]) {
    assert.ok(path.startsWith('apps/api/scripts/'), `${path} lives in the verification-only scripts tree`);
  }
  assert.ok(!readdirSync(new URL('database/migrations/', root)).includes('0064_integrated_brain_e2e_hardening_v2.sql'),
    'QIR-007 added no migration 0064');
  const helperDirectory = readdirSync(new URL('apps/api/scripts/integrated-brain-e2e-hardening-v2/', root));
  assert.ok(helperDirectory.length > 0, 'the verification-only helper directory exists');
  assert.ok(helperDirectory.every((name) => name.endsWith('.ts')),
    'the verification-only helper directory holds only TypeScript helpers');
});
