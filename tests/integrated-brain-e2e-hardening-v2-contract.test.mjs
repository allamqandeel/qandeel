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
const SOURCES = Object.freeze({
  contractDoc: CONTRACT_DOC,
  docsReadme: 'docs/README.md',
  packageJson: 'package.json',
  ci: '.github/workflows/api-ci.yml',
  verifier: VERIFIER,
  harness: HARNESS,
  providerBudget: 'apps/api/src/post-response-intelligence/post-response-provider-budget.ts',
  budgetContract: 'apps/api/src/intelligence-runtime/integrated-context-budget-contract.ts',
  questionSelectionTypes: 'apps/api/src/question/question-foreground-selection.types.ts',
  gathererTypes: 'apps/api/src/intelligence-runtime/bounded-foreground-intelligence-gatherer.types.ts',
  orchestrator: 'apps/api/src/conversation/conversation-orchestrator.service.ts',
  questionSelectionService: 'apps/api/src/question/question-foreground-selection.service.ts',
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
]);

// Substantive per-scenario coverage markers. Each entry is a live assertion
// LABEL PREFIX the dynamic verifier attaches to real assertions, so deleting a
// scenario - not merely renaming a comment - breaks this guard.
const SCENARIO_MARKERS = Object.freeze({
  A: ["'A: ", "stage = 'A_TURN_1_LEARN'", "stage = 'A_TURN_2_ASK'", "stage = 'A_TURN_3_INFORMATION'", 'HYPOTHESIS_VERSION_ADVANCED'],
  B: ["'B: ", "'B anti-vacuity: ", "stage = 'B_DEEP_PARITY_AND_D_AUTHORITY'"],
  C: ["'C1: ", "'C1b: ", "'C2: ", "'C3: ", "'C4/E3: ", "stage = 'C_FOREGROUND_FAILURE_ISOLATION'"],
  D: ["'D: ", "'D anti-vacuity: ", "stage = 'D_GLOBAL_CONTEXT_PRESSURE'"],
  E: ["'E1: ", "'E2: ", "'E4: ", "stage = 'E1_SAFETY_BLOCK'", "stage = 'E2_SAFETY_GUIDED'"],
  F: ["'F1: ", "'F2: ", "'F3: ", "'F4: ", "stage = 'F_RECOVERY_AND_E4'"],
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
  for (const path of [VERIFIER, HARNESS]) {
    assert.ok(path.startsWith('apps/api/scripts/'), `${path} lives in the verification-only scripts tree`);
  }
  assert.ok(!readdirSync(new URL('database/migrations/', root)).includes('0064_integrated_brain_e2e_hardening_v2.sql'),
    'QIR-007 added no migration 0064');
  const helperDirectory = readdirSync(new URL('apps/api/scripts/integrated-brain-e2e-hardening-v2/', root));
  assert.ok(helperDirectory.length > 0, 'the verification-only helper directory exists');
  assert.ok(helperDirectory.every((name) => name.endsWith('.ts')),
    'the verification-only helper directory holds only TypeScript helpers');
});
