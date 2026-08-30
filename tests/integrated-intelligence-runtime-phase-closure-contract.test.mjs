import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

// QIR-008 Integrated Intelligence Runtime phase closure contract.
//
// The phase (QIR-001 -> QIR-007 + Addendum A) is CLOSED and FROZEN. This is the
// compact phase integration/freeze guard: it proves the closure ARTIFACT exists
// and stays coherent, that every QIR-001 obligation still maps to a real owner,
// a real executable proof file and a live package/CI registration, and that the
// load-bearing live constants of the frozen constitution stay coherent.
//
// It deliberately does NOT duplicate the body of any constituent static test.
// Each of QIR-001..QIR-007 keeps its own anti-vacuity suite; this guard
// re-verifies wiring, identity and a compact live-constitution set only.
//
// It also freezes the QIR-008 forward-safety repair itself: the two historical
// guards that once froze the live repository to "latest migration = 0063 / no
// 0064" now prove only that the 0063 terminal phase baseline EXISTS. A
// hypothetical later migration is legal by number and by name, proven in those
// guards with listing-entry fixtures only - no real migration 0064 exists or is
// ever created, and migration 0063 is never modified.
//
// Forward-safe: nothing here freezes a global inventory count, the live
// repository's future migration numbering, a provider or model identifier, a
// routing threshold, a local Memory/Hypothesis cap, or the shape of any later,
// separately reviewed phase. The closed QIR-001..008 inventory is exact because
// it is a closed HISTORICAL set, never a live census: this guard never scans
// future task names to ban them globally.
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const FREEZE_DOC = 'docs/integrated-intelligence-runtime-phase-freeze-v1.md';
const SOURCES = Object.freeze({
  freezeDoc: FREEZE_DOC,
  docsReadme: 'docs/README.md',
  packageJson: 'package.json',
  ci: '.github/workflows/api-ci.yml',
  // The compact live-constitution surface. These are canonical, stable wiring
  // points - never formatting-sensitive prose.
  budgetContract: 'apps/api/src/intelligence-runtime/integrated-context-budget-contract.ts',
  providerBudget: 'apps/api/src/post-response-intelligence/post-response-provider-budget.ts',
  gathererTypes: 'apps/api/src/intelligence-runtime/bounded-foreground-intelligence-gatherer.types.ts',
  questionSelectionTypes: 'apps/api/src/question/question-foreground-selection.types.ts',
  orchestrator: 'apps/api/src/conversation/conversation-orchestrator.service.ts',
  // The Addendum A capacity proof and the QIR-007 dynamic gate that carries
  // C5-C8. Both are verification-only sources under apps/api/scripts.
  capacityProof: 'apps/api/scripts/integrated-brain-e2e-hardening-v2/human-intelligence-capacity.ts',
  hardeningVerifier: 'apps/api/scripts/verify-integrated-brain-end-to-end-hardening-v2.ts',
  // The two repaired historical guards.
  questionGuard: 'tests/question-information-gap-closed-loop-v1-contract.test.mjs',
  hardeningGuard: 'tests/integrated-brain-e2e-hardening-v2-contract.test.mjs',
});
const shipped = Object.freeze({
  ...Object.fromEntries(Object.entries(SOURCES).map(([key, path]) => [key, read(path)])),
  migrations: Object.freeze(readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql'))),
});

const TERMINAL_MIGRATION = '0063_question_information_gap_closed_loop_v1.sql';
const CLOSURE_SCRIPT = 'test:integrated-intelligence-runtime-phase-closure-contract';
const CLOSURE_COMMAND = 'node --test tests/integrated-intelligence-runtime-phase-closure-contract.test.mjs';

// The frozen phase component inventory. Exactness is legal on this side: it is
// a closed historical set, never a live census.
const PHASE_COMPONENTS = Object.freeze([
  'QIR-001 — Integrated Intelligence Runtime Contract v1',
  'QIR-002 — FAST / DEEP Runtime Decision Policy v2',
  'QIR-003 — Bounded Foreground Intelligence Gatherer v1',
  'QIR-004 — Integrated Context Budget & Conflict Resolution v1',
  'QIR-005 — Post-Response Intelligence Scheduler & Provider Budget v1',
  'QIR-006 — Question / Information-Gap Closed Loop v1',
  'QIR-007 — Integrated Brain E2E Hardening v2',
  'QIR-007 Addendum A — Cross-Context Adversarial & HI Capacity Proof v1',
  'QIR-008 — Integrated Intelligence Runtime Phase Closure / Freeze v1',
]);

// The exact QIR-001 downstream obligations, and the owner each one closes
// under. The freeze document's reconciliation table must be exactly this set,
// in this order.
const QIR_001_OBLIGATIONS = Object.freeze([
  ['deterministic provider-neutral FAST/DEEP decision', 'QIR-002'],
  ['bounded dependency-aware Memory/Hypothesis foreground acquisition', 'QIR-003'],
  ['server-owned integrated context budget + conflict resolution', 'QIR-004'],
  ['durable post-response provider lifecycle budget', 'QIR-005'],
  ['formal Question / Information-Gap closed loop', 'QIR-006'],
  ['adversarial integrated E2E hardening', 'QIR-007'],
  ['cross-context integrated adversarial + reachable HI capacity proof', 'QIR-007 Addendum A'],
  ['final census / freeze / regression closure', 'QIR-008'],
]);

// Constituent frozen proofs that must stay REGISTERED: package script -> its
// exact command, and each must also be reachable from CI.
const REGISTERED_SCRIPTS = Object.freeze({
  'test:integrated-intelligence-runtime-contract':
    'node --test tests/integrated-intelligence-runtime-contract.test.mjs',
  'test:fast-deep-runtime-decision-policy-v2-contract':
    'node --test tests/fast-deep-runtime-decision-policy-v2-contract.test.mjs',
  'verify:fast-deep-runtime-decision-policy-v2:integration':
    'node --env-file-if-exists=.env database/verify-migration-0062.mjs',
  'test:bounded-foreground-intelligence-gatherer-v1-contract':
    'node --test tests/bounded-foreground-intelligence-gatherer-v1-contract.test.mjs',
  'test:integrated-context-budget-conflict-resolution-v1-contract':
    'node --test tests/integrated-context-budget-conflict-resolution-v1-contract.test.mjs',
  'test:post-response-intelligence-scheduler-provider-budget-v1-contract':
    'node --test tests/post-response-intelligence-scheduler-provider-budget-v1-contract.test.mjs',
  'test:question-information-gap-closed-loop-v1-contract':
    'node --test tests/question-information-gap-closed-loop-v1-contract.test.mjs',
  'verify:question-information-gap-closed-loop:integration':
    'node --env-file-if-exists=.env database/verify-migration-0063.mjs',
  'test:integrated-brain-e2e-hardening-v2-contract':
    'node --test tests/integrated-brain-e2e-hardening-v2-contract.test.mjs',
  'verify:a2-e2e-runtime-smoke':
    'node --env-file-if-exists=.env node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/verify-a2-end-to-end-runtime-smoke.ts',
  'verify:full-intelligence-e2e-runtime':
    'node --env-file-if-exists=.env node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/verify-full-intelligence-end-to-end-runtime.ts',
  'verify:integrated-brain:e2e-hardening-v2':
    'node --env-file-if-exists=.env node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/verify-integrated-brain-end-to-end-hardening-v2.ts',
  [CLOSURE_SCRIPT]: CLOSURE_COMMAND,
});

// The frozen runtime tail. Exactly these three runtime E2E gates exist, in this
// order, and no fourth may appear.
const RUNTIME_E2E_GATES = Object.freeze([
  'verify:a2-e2e-runtime-smoke',
  'verify:full-intelligence-e2e-runtime',
  'verify:integrated-brain:e2e-hardening-v2',
]);

// Required load-bearing statements of the freeze document, checked against
// whitespace-flattened text so markdown wrapping never splits a marker.
const REQUIRED_FREEZE_STATEMENTS = Object.freeze([
  '# QANDEEL — Integrated Intelligence Runtime Phase Freeze v1',
  '**Status: CLOSED / FROZEN**',
  '**Task:** QIR-008 — Integrated Intelligence Runtime Phase Closure / Freeze v1',
  // The historical baseline, exactly.
  'a2d4c3390edebfd93dcc6003ba1165d8988a07e8',
  '91a082effdff16ad165ed763f5186ab4ede3828f',
  '33339907674',
  '**Terminal migration at QIR closure: `0063_question_information_gap_closed_loop_v1.sql`.**',
  'it is **not a live future repository ceiling**',
  // Closure is not product completion.
  '`Integrated Intelligence Runtime CLOSED` is **NOT** the statement `QANDEEL PRODUCT COMPLETE`.',
  '**QIR closure is NOT QANDEEL product completion.**',
  '**QIR v1 has no planned QIR-009.**',
  'Addendum A is **merged closure evidence carried under QIR-007**',
  // Reconciliation.
  '**No QIR-001 obligation is unresolved. No `QIR-008 Closure Blocker` was raised.**',
  // Constitution.
  '**There is no source voting**',
  'is **never** fabricated, defaulted, or silently replaced by stale data',
  'Provider output owns **no independent QANDEEL product authority**',
  'deterministic, provider-neutral and Unicode-aware',
  '**no LLM routing classifier**',
  'QHIA shared Human Intelligence wait class = 300 ms',
  'QIR-003 Memory + Hypothesis shared ceiling = 5000 ms',
  'QIR-006 Question selection ceiling = 300 ms',
  'ZERO incremental wait no dedicated timeout never directly awaited late settlement discarded rejection / late / malformed = omission no direct per-channel fallback no cross-turn cache',
  'exactly ONE normal conversational provider call per provider-generating turn',
  'Mandatory Core 65536 History 16384 Memory 8192 Human Intelligence 8192 Hypothesis + Recommendation 24576 Question 8192 TOTAL 131072',
  '**no borrowing between slices**',
  // Human Intelligence capacity closure evidence.
  'canonical all-active QHIA-013 fixture bytes: 6427',
  'current maximum REACHABLE coherent HI footprint: 7518',
  'Human Intelligence slice bytes: 8192',
  'headroom bytes: 674',
  'capacity verdict: PASS',
  'searches 2000 coherent candidates',
  '`HimInteractionAdaptationService.derive(...)`',
  '`HimFastDeepConsumptionService.project(\'DEEP\', ...)`',
  '**The superseded synthetic figure `7536` is verification history only and is NOT current authority.**',
  'derived driver ENERGY_LOW_OR_VERY_LOW',
  'reflection directive GENTLE_REFLECTION_INVITATION',
  // Addendum A cross-context conclusions.
  'C5 — cross-context rejection isolation PASS',
  'C6 — cross-context late-settlement isolation PASS',
  'C7 — malformed aggregate isolation PASS',
  'C8 — all-four-contexts ACTIVE composition PASS',
  'exactly **one aggregate-v3 read** per turn',
  'no aggregate-v1/v2 fallback',
  '**ONE Human Intelligence provider envelope**',
  '**set union with deduplication**',
  '**no vote, count, weight, confidence, strength or amplification**',
  // Background + Question + recovery.
  'POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3',
  '**there is no `QUESTION_PROVIDER`**',
  'Information Gap: OPEN / RESOLVED / SUPERSEDED',
  'Formal binding: SELECTED / BOUND / RELEASED',
  '**a user turn by itself never means answered or resolved**',
  'real Redis reclaim uses the **original pending entry**',
  'indeterminate CLAIMED provider work is never speculatively replayed',
  // The accepted G3 observation.
  'cannot naturally reach `QUESTION / OMITTED_BUDGET`',
  '**This split proof is accepted.**',
  // Deferrals.
  '**QANDEEL has NOT selected its final conversational Provider or LLM.**',
  '**These are deliberate deferrals, not QIR closure defects.**',
]);

// Required section headings of the freeze document.
const REQUIRED_FREEZE_SECTIONS = Object.freeze([
  '## Pre-closure canonical baseline (historical record)',
  '## Closed QIR v1 inventory',
  '## QIR-001 obligation reconciliation',
  '## Frozen integrated runtime constitution',
  '## Verification evidence at closure',
  '## Known non-blocking observation',
  '## Historical guard forward-safety repair',
  '## Deferred beyond this phase',
  '## Change-control rule',
  '## Non-claims',
]);

// Deferred-work statements: closure is NOT product completion.
const DEFERRED_STATEMENTS = Object.freeze([
  'final Provider selection',
  'final LLM/model selection',
  'provider quality bake-off',
  'real-provider latency and cost',
  'provider token/context-window fit',
  'future provider reliability/fallback architecture',
  'voice / realtime audio runtime',
  'UI/UX and product experience',
  'onboarding product surfaces',
  'subscriptions, credits, and payments',
  'notifications and proactive product behavior',
  'deployment and operations',
  'product monitoring dashboards and alert policy',
  'future scientific HIM calibration/validation',
  'a freshness/decay model',
  'a HIM metric confidence model',
  'higher-order composites',
  'trend-aware provider consumption',
  'broader future Brain slots',
]);

// The compact live-constitution set: canonical exported constants and stable
// wiring, never formatting regexes over prose.
const LIVE_CONSTITUTION = Object.freeze([
  ['budgetContract', 'export const GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES = 131072;', 'the global model-input text budget stays 131072'],
  ['budgetContract', 'export const MANDATORY_CORE_BUDGET_BYTES = 65536;', 'the Mandatory Core slice stays 65536'],
  ['budgetContract', 'export const HISTORY_BUDGET_BYTES = 16384;', 'the History slice stays 16384'],
  ['budgetContract', 'export const MEMORY_BUDGET_BYTES = 8192;', 'the Memory slice stays 8192'],
  ['budgetContract', 'export const HUMAN_INTELLIGENCE_BUDGET_BYTES = 8192;', 'the Human Intelligence slice stays 8192'],
  ['budgetContract', 'export const HYPOTHESIS_RECOMMENDATION_BUDGET_BYTES = 24576;', 'the Hypothesis + Recommendation slice stays 24576'],
  ['budgetContract', 'export const QUESTION_BUDGET_BYTES = 8192;', 'the Question slice stays 8192'],
  ['gathererTypes', 'export const QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS = 5000;', 'the QIR-003 shared non-HI foreground ceiling stays 5000 ms'],
  ['questionSelectionTypes', 'export const QUESTION_FOREGROUND_WAIT_BUDGET_MS = 300;', 'the QIR-006 Question selection ceiling stays 300 ms'],
  ['orchestrator', 'const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300;', 'the QHIA shared Human Intelligence wait class stays 300 ms'],
  ['providerBudget', "export const POST_RESPONSE_PROVIDER_EFFECTS_V1 = [\n  'ASSOCIATION_PROVIDER',\n  'INTENT_PROVIDER',\n  'CANDIDATE_PROVIDER',\n] as const;", 'the provider-backed registry stays exactly the three frozen effects'],
  ['providerBudget', 'export const POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3;', 'the hard lifecycle provider-call budget stays exactly 3'],
  ['capacityProof', 'export const CANONICAL_ALL_ACTIVE_HUMAN_INTELLIGENCE_BYTES = 6427;', 'the canonical all-active QHIA-013 fixture footprint stays 6427'],
  ['capacityProof', 'export const EXPECTED_CURRENT_MAX_HUMAN_INTELLIGENCE_INCREMENTAL_BYTES = 7518;', 'the measured current maximum reachable Human Intelligence footprint stays 7518'],
  ['capacityProof', 'interactionAdaptation.derive(reasoningContext)', 'the reachable-capacity proof derives Interaction Adaptation from the candidate reasoning context'],
  ['capacityProof', "fastDeepConsumption.project('DEEP', reasoningContext)", 'the reachable-capacity proof projects DEEP from that SAME reasoning context'],
]);

// The frozen QIR-004 slice partition. The closure guard recomputes the total
// rather than restating it, so a silently re-partitioned budget fails here.
const SLICE_CONSTANTS = Object.freeze([
  'MANDATORY_CORE_BUDGET_BYTES', 'HISTORY_BUDGET_BYTES', 'MEMORY_BUDGET_BYTES',
  'HUMAN_INTELLIGENCE_BUDGET_BYTES', 'HYPOTHESIS_RECOMMENDATION_BUDGET_BYTES', 'QUESTION_BUDGET_BYTES',
]);

// Addendum A scenario markers that must remain live in the QIR-007 dynamic
// gate: C5-C8 are represented by executable proof, never documentation.
const CROSS_CONTEXT_SCENARIO_MARKERS = Object.freeze([
  "'C5: ", "'C6: ", "'C7: ", "'C8: ",
  "'C5 anti-vacuity: ", "'C6 anti-vacuity: ", "'C7 anti-vacuity: ", "'C8 anti-vacuity: ",
  "stage = 'C_CROSS_CONTEXT_ADVERSARIAL_MATRIX'",
]);

// The QIR-008 forward-safety repair markers each repaired historical guard must
// carry, and the ceiling/filename-ban shapes neither may carry again. The
// needles are assembled at run time so this contract's own source never
// contains the executable shapes it forbids.
const REPAIRED_GUARDS = Object.freeze(['questionGuard', 'hardeningGuard']);
const CEILING_NEEDLES = Object.freeze([
  ['highest !== ', 'TERMINAL_MIGRATION'].join(''),
  ['reduce((max, name) => (name > max', ' ? name : max)'].join(''),
  ['sort()', 'at(-1)'].join('.'),
  ["startsWith('006", '4'].join(''),
  ['^006', '[4-9]'].join(''),
]);
const FILENAME_BAN_NEEDLES = Object.freeze([
  ['.includes(', "'0064_"].join(''),
  ['.includes(', "'0065_"].join(''),
  ['.includes(', "'0066_"].join(''),
]);
const FUTURE_MIGRATION_FIXTURES = Object.freeze([
  '0064_future_product_phase.sql',
  '0065_voice_runtime_v1.sql',
  '0066_subscription_runtime_v1.sql',
]);
const FORWARD_SAFETY_PROOF_MARKERS = Object.freeze([
  'QIR-008 phase closure repair',
  'migration 0063 remains historically REQUIRED even when later migrations exist',
]);

function violated(property) {
  throw new Error(`QIR-008 Integrated Intelligence Runtime phase closure contract violated: ${property}`);
}

/** The freeze document's reconciliation rows, as [obligation, owner, proof, registration, verdict]. */
function reconciliationRows(freezeDoc) {
  const start = freezeDoc.indexOf('## QIR-001 obligation reconciliation');
  if (start < 0) return [];
  const end = freezeDoc.indexOf('\n## ', start + 1);
  return freezeDoc.slice(start, end < 0 ? undefined : end)
    .split('\n')
    .filter((line) => line.startsWith('| '))
    .map((line) => line.slice(1, line.lastIndexOf('|')).split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length === 5 && !/^-+$/u.test(cells[0]) && cells[0] !== 'QIR-001 obligation');
}

/** Backticked tokens of one table cell. */
const backticked = (cell) => [...cell.matchAll(/`([^`]+)`/gu)].map((match) => match[1]);

function assertIntegratedIntelligenceRuntimePhaseClosureContract(world) {
  // 1. The freeze document exists, is substantive, and is the closure statement.
  if (typeof world.freezeDoc !== 'string' || world.freezeDoc.length < 8000)
    violated('the freeze document exists and is substantive');
  const flattened = world.freezeDoc.replace(/\s+/gu, ' ');
  for (const statement of REQUIRED_FREEZE_STATEMENTS) {
    if (!flattened.includes(statement.replace(/\s+/gu, ' ')))
      violated(`the freeze document records: ${statement}`);
  }
  for (const section of REQUIRED_FREEZE_SECTIONS) {
    if (!world.freezeDoc.includes(`\n${section}\n`))
      violated(`the freeze document carries the section: ${section}`);
  }
  for (const statement of DEFERRED_STATEMENTS) {
    if (!flattened.includes(statement)) violated(`the freeze document defers: ${statement}`);
  }

  // 2. The closed QIR v1 inventory is exact and complete.
  for (const component of PHASE_COMPONENTS) {
    if (!flattened.includes(component)) violated(`the freeze document names the phase component: ${component}`);
  }

  // 3. QIR-001 obligation reconciliation: every downstream obligation maps to
  //    an owner, an executable proof that really exists on disk, and a live
  //    package/CI registration. Documentation alone is never enough.
  const rows = reconciliationRows(world.freezeDoc);
  assert.deepEqual(
    rows.map(([obligation, owner]) => [obligation, owner]),
    QIR_001_OBLIGATIONS.map(([obligation, owner]) => [obligation, owner]),
    'the reconciliation table is exactly the frozen QIR-001 obligation set, in order, with its owners',
  );
  const packageJson = JSON.parse(world.packageJson);
  for (const [obligation, , proofCell, registrationCell, verdict] of rows) {
    if (verdict !== 'SATISFIED') violated(`the QIR-001 obligation is SATISFIED: ${obligation}`);
    const proofPaths = backticked(proofCell).filter((token) => token.includes('/'));
    if (proofPaths.length === 0) violated(`the obligation names at least one executable proof: ${obligation}`);
    for (const proofPath of proofPaths) {
      if (!world.exists(proofPath)) violated(`the executable proof really exists: ${proofPath} (${obligation})`);
    }
    const registrations = backticked(registrationCell);
    if (registrations.length === 0) violated(`the obligation names at least one registration: ${obligation}`);
    for (const script of registrations) {
      if (typeof packageJson.scripts?.[script] !== 'string')
        violated(`the registration is a live package script: ${script} (${obligation})`);
      if (!world.ci.includes(script)) violated(`CI still runs the registration: ${script} (${obligation})`);
    }
  }

  // 4. Every constituent frozen proof stays REGISTERED in package scripts with
  //    its exact command and reachable from CI - including this closure
  //    contract itself, which runs before the database bootstrap.
  for (const [script, command] of Object.entries(REGISTERED_SCRIPTS)) {
    if (packageJson.scripts?.[script] !== command)
      violated(`the package script remains registered exactly: ${script}`);
    if (!world.ci.includes(script)) violated(`CI still runs: ${script}`);
  }
  const closureAt = world.ci.indexOf(CLOSURE_SCRIPT);
  const bootstrapAt = world.ci.indexOf('Apply all migrations to fresh PostgreSQL');
  if (!(closureAt > 0 && bootstrapAt > 0 && closureAt < bootstrapAt))
    violated('the closure contract runs in CI before the database bootstrap: a pure static guard needs no database');

  // 5. The frozen runtime tail: A2 -> Full Intelligence -> Integrated Brain E2E
  //    Hardening v2, in that order, and NO fourth runtime E2E gate exists.
  const gateAt = RUNTIME_E2E_GATES.map((script) => world.ci.indexOf(`run: npm run ${script}`));
  if (gateAt.some((index) => index < 0)) violated('all three frozen runtime E2E gates remain wired in CI');
  if (!(gateAt[0] < gateAt[1] && gateAt[1] < gateAt[2]))
    violated('the frozen runtime tail order is A2 -> Full Intelligence -> Integrated Brain E2E Hardening v2');
  const runtimeGatesInCi = [...new Set(
    [...world.ci.matchAll(/run: npm run (verify:[\w:-]+)/gu)]
      .map((match) => match[1])
      .filter((script) => /e2e|end-to-end/iu.test(script)),
  )].sort();
  assert.deepEqual(runtimeGatesInCi, [...RUNTIME_E2E_GATES].sort(),
    'exactly the three frozen runtime E2E gates exist in CI - there is no fourth');
  const runtimeGatesInPackage = Object.keys(packageJson.scripts ?? {})
    .filter((script) => script.startsWith('verify:') && /e2e|end-to-end/iu.test(script)).sort();
  assert.deepEqual(runtimeGatesInPackage, [...RUNTIME_E2E_GATES].sort(),
    'exactly the three frozen runtime E2E gates are registered as package scripts - there is no fourth');

  // 6. The compact live constitution is still coherent.
  for (const [source, required, property] of LIVE_CONSTITUTION) {
    if (!world[source].includes(required)) violated(`${property}: missing ${required}`);
  }
  // The six isolated slices really sum to the frozen global budget - recomputed
  // from the live declarations, never restated.
  const declared = Object.fromEntries(
    [...world.budgetContract.matchAll(/export const ([A-Z_]+_BYTES) = (\d+);/gu)].map((m) => [m[1], Number(m[2])]),
  );
  const sliceTotal = SLICE_CONSTANTS.reduce((total, name) => total + (declared[name] ?? Number.NaN), 0);
  if (sliceTotal !== declared.GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES)
    violated(`the six isolated slices sum to the frozen global budget: ${sliceTotal} != ${declared.GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES}`);
  // The Addendum A capacity arithmetic is recomputed from the live sources.
  const measuredMax = Number(/EXPECTED_CURRENT_MAX_HUMAN_INTELLIGENCE_INCREMENTAL_BYTES = (\d+);/u.exec(world.capacityProof)?.[1]);
  const headroom = declared.HUMAN_INTELLIGENCE_BUDGET_BYTES - measuredMax;
  if (!(measuredMax > 0 && headroom === 674))
    violated(`the frozen Human Intelligence headroom is 674 bytes: got ${headroom}`);
  if (!(measuredMax <= declared.HUMAN_INTELLIGENCE_BUDGET_BYTES))
    violated('the current maximum reachable Human Intelligence footprint fits the frozen slice: verdict PASS');
  if (!flattened.includes(`current maximum REACHABLE coherent HI footprint: ${measuredMax}`))
    violated('the freeze document records the SAME measured maximum the live proof locks');
  if (!flattened.includes(`headroom bytes: ${headroom}`))
    violated('the freeze document records the SAME headroom the live constants imply');
  // No Question provider, and exactly one conversational provider call.
  if (/QUESTION_PROVIDER/u.test(world.providerBudget))
    violated('no QUESTION_PROVIDER exists in the frozen provider-effect registry');
  if ((world.orchestrator.match(/this\.router\.generate\(/gu) ?? []).length !== 1)
    violated('exactly one conversational provider invocation exists on the turn path');
  // Migration 0063 exists in the real listing - the terminal migration of the
  // closed QIR v1 historical baseline. No numbering ceiling is asserted.
  if (!Array.isArray(world.migrations) || !world.migrations.includes(TERMINAL_MIGRATION))
    violated('the terminal migration of the closed QIR v1 historical baseline exists in the real listing');

  // 7. Addendum A C5-C8 remain represented by EXECUTABLE QIR-007 proof.
  for (const marker of CROSS_CONTEXT_SCENARIO_MARKERS) {
    if (!world.hardeningVerifier.includes(marker))
      violated(`the QIR-007 dynamic gate still carries the cross-context proof marker: ${marker}`);
  }

  // 8. The QIR-008 forward-safety repair holds: both repaired historical guards
  //    prove 0063 EXISTS, carry the repair marker and their acceptance
  //    fixtures, and carry neither a migration-numbering ceiling nor a future
  //    filename ban.
  for (const guard of REPAIRED_GUARDS) {
    if (!world[guard].includes(TERMINAL_MIGRATION))
      violated(`the historical guard ${guard} proves the 0063 terminal phase baseline exists`);
    for (const marker of FORWARD_SAFETY_PROOF_MARKERS) {
      if (!world[guard].includes(marker))
        violated(`the historical guard ${guard} carries the QIR-008 forward-safety proof: ${marker}`);
    }
    for (const fixture of FUTURE_MIGRATION_FIXTURES) {
      if (!world[guard].includes(fixture))
        violated(`the historical guard ${guard} proves the future migration ${fixture} stays legal`);
    }
    for (const needle of [...CEILING_NEEDLES, ...FILENAME_BAN_NEEDLES]) {
      if (world[guard].includes(needle))
        violated(`the historical guard ${guard} carries no migration-numbering ceiling and no future filename ban: found ${needle}`);
    }
  }

  // 9. The docs index represents the phase as CLOSED / FROZEN, links the freeze
  //    document, and still links every frozen constituent contract.
  if (!world.docsReadme.includes('integrated-intelligence-runtime-phase-freeze-v1.md'))
    violated('docs/README.md links the phase freeze document');
  if (!world.docsReadme.includes('**QANDEEL — Integrated Intelligence Runtime & Hardening v1 — CLOSED / FROZEN.**'))
    violated('docs/README.md represents the phase as CLOSED / FROZEN');
  if (!world.docsReadme.includes('QIR-008 = phase closure authority'))
    violated('docs/README.md records QIR-008 as the phase closure authority');
  if (!world.docsReadme.includes('QIR-007 Addendum A — Cross-Context Adversarial & HI Capacity Proof v1** — merged closure evidence carried under QIR-007'))
    violated('docs/README.md represents Addendum A as merged closure evidence under QIR-007');
  for (const contract of [
    'integrated-intelligence-runtime-contract-v1.md',
    'fast-deep-runtime-decision-policy-v2.md',
    'bounded-foreground-intelligence-gatherer-v1.md',
    'integrated-context-budget-conflict-resolution-v1.md',
    'post-response-intelligence-scheduler-provider-budget-v1.md',
    'question-information-gap-closed-loop-v1.md',
    'integrated-brain-e2e-hardening-v2.md',
  ]) {
    if (!world.docsReadme.includes(contract))
      violated(`docs/README.md still links the frozen constituent contract: ${contract}`);
  }
}

const shippedWorld = Object.freeze({
  ...shipped,
  exists: (path) => existsSync(new URL(path, root)),
});

test('C1 - the shipped repository satisfies the QIR-008 phase closure contract', () => {
  assert.doesNotThrow(() => assertIntegratedIntelligenceRuntimePhaseClosureContract(shippedWorld));
});

test('C2 - anti-vacuity: the real guard rejects every named regression', () => {
  const drifts = [
    ['the freeze document was deleted', { freezeDoc: '' }],
    ['the CLOSED / FROZEN status was withdrawn', {
      freezeDoc: shipped.freezeDoc.replace('**Status: CLOSED / FROZEN**', '**Status: DRAFT**'),
    }],
    ['the historical baseline SHA was altered', {
      freezeDoc: shipped.freezeDoc.replaceAll('a2d4c3390edebfd93dcc6003ba1165d8988a07e8', 'deadbeef'),
    }],
    ['the historical baseline tree was altered', {
      freezeDoc: shipped.freezeDoc.replaceAll('91a082effdff16ad165ed763f5186ab4ede3828f', 'deadbeef'),
    }],
    ['the canonical post-merge CI run was dropped', {
      freezeDoc: shipped.freezeDoc.replaceAll('33339907674', 'unrecorded'),
    }],
    ['the terminal migration record was dropped', {
      freezeDoc: shipped.freezeDoc.replace(
        '**Terminal migration at QIR closure: `0063_question_information_gap_closed_loop_v1.sql`.**',
        'Terminal migration: unrecorded'),
    }],
    ['the historical baseline was turned into a live repository ceiling', {
      freezeDoc: shipped.freezeDoc.replace('it is **not a live future repository ceiling**',
        'it is the permanent ceiling of the repository'),
    }],
    ['the closed/complete distinction was erased', {
      freezeDoc: shipped.freezeDoc.replaceAll('**QIR closure is NOT QANDEEL product completion.**', 'the product is complete'),
    }],
    ['the no-QIR-009 statement was withdrawn', {
      freezeDoc: shipped.freezeDoc.replace('**QIR v1 has no planned QIR-009.**', 'QIR-009 is next.'),
    }],
    ['a phase component vanished from the inventory', {
      freezeDoc: shipped.freezeDoc.replace('8. QIR-007 Addendum A — Cross-Context Adversarial & HI Capacity Proof v1\n', ''),
    }],
    ['a QIR-001 obligation vanished from the reconciliation table', {
      freezeDoc: shipped.freezeDoc.replace(/^\| formal Question \/ Information-Gap closed loop \|.*$\n/mu, ''),
    }],
    ['a QIR-001 obligation changed owner', {
      freezeDoc: shipped.freezeDoc.replace('| durable post-response provider lifecycle budget | QIR-005 |',
        '| durable post-response provider lifecycle budget | QIR-009 |'),
    }],
    ['an obligation was marked satisfied without an executable proof', {
      freezeDoc: shipped.freezeDoc.replace(
        '`tests/bounded-foreground-intelligence-gatherer-v1-contract.test.mjs`',
        '`tests/bounded-foreground-intelligence-gatherer-v1-contract-retired.test.mjs`'),
    }],
    ['an obligation lost its live registration', {
      freezeDoc: shipped.freezeDoc.replace('| `test:integrated-context-budget-conflict-resolution-v1-contract` |',
        '| `test:retired-context-budget-contract` |'),
    }],
    ['an obligation verdict was downgraded', {
      freezeDoc: shipped.freezeDoc.replace(
        '`test:post-response-intelligence-scheduler-provider-budget-v1-contract` | SATISFIED |',
        '`test:post-response-intelligence-scheduler-provider-budget-v1-contract` | PENDING |'),
    }],
    ['a deferred-work statement was dropped', {
      freezeDoc: shipped.freezeDoc.replaceAll('trend-aware provider consumption', 'trend consumption is enabled'),
    }],
    ['the Provider/LLM deferral was withdrawn', {
      freezeDoc: shipped.freezeDoc.replace('**QANDEEL has NOT selected its final conversational Provider or LLM.**',
        'QANDEEL has selected its final Provider.'),
    }],
    ['the change-control section was removed', {
      freezeDoc: shipped.freezeDoc.replace('\n## Change-control rule\n', '\n## Notes\n'),
    }],
    ['the non-claims section was removed', {
      freezeDoc: shipped.freezeDoc.replace('\n## Non-claims\n', '\n## Closing\n'),
    }],
    ['the accepted G3 observation was rewritten as a defect-free claim', {
      freezeDoc: shipped.freezeDoc.replace('**This split proof is accepted.**', 'This is unproven.'),
    }],
    ['the superseded 7536 figure was reinstated as current authority', {
      freezeDoc: shipped.freezeDoc.replace(
        '**The superseded synthetic figure `7536` is verification history only and is NOT current authority.**',
        'The current maximum is `7536`.'),
    }],
    ['the two Human Intelligence figures were conflated in the freeze document', {
      freezeDoc: shipped.freezeDoc.replace('canonical all-active QHIA-013 fixture bytes:            6427',
        'canonical all-active QHIA-013 fixture bytes:            7518'),
    }],
    ['the measured maximum was re-baselined in the live proof', {
      capacityProof: shipped.capacityProof.replace(
        'export const EXPECTED_CURRENT_MAX_HUMAN_INTELLIGENCE_INCREMENTAL_BYTES = 7518;',
        'export const EXPECTED_CURRENT_MAX_HUMAN_INTELLIGENCE_INCREMENTAL_BYTES = 7000;'),
    }],
    ['the canonical all-active fixture footprint was deleted from the live proof', {
      capacityProof: shipped.capacityProof.replace('export const CANONICAL_ALL_ACTIVE_HUMAN_INTELLIGENCE_BYTES = 6427;', ''),
    }],
    ['the reachable-capacity proof stopped deriving adaptation from the candidate context', {
      capacityProof: shipped.capacityProof.replaceAll('interactionAdaptation.derive(reasoningContext)', 'stubAdaptation()'),
    }],
    ['the reachable-capacity proof stopped projecting DEEP from that same context', {
      capacityProof: shipped.capacityProof.replaceAll("fastDeepConsumption.project('DEEP', reasoningContext)", 'stubProjection()'),
    }],
    ['the Human Intelligence slice was widened', {
      budgetContract: shipped.budgetContract.replace('export const HUMAN_INTELLIGENCE_BUDGET_BYTES = 8192;',
        'export const HUMAN_INTELLIGENCE_BUDGET_BYTES = 16384;'),
    }],
    ['the global budget was raised', {
      budgetContract: shipped.budgetContract.replace('export const GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES = 131072;',
        'export const GLOBAL_MODEL_INPUT_TEXT_BUDGET_BYTES = 262144;'),
    }],
    ['a slice was silently re-partitioned so the six no longer sum to the global budget', {
      budgetContract: shipped.budgetContract.replace('export const MEMORY_BUDGET_BYTES = 8192;',
        'export const MEMORY_BUDGET_BYTES = 4096;'),
    }],
    ['the QIR-003 shared non-HI ceiling was raised', {
      gathererTypes: shipped.gathererTypes.replace('export const QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS = 5000;',
        'export const QIR_NON_HI_FOREGROUND_WAIT_BUDGET_MS = 9000;'),
    }],
    ['the Question selection ceiling was raised', {
      questionSelectionTypes: shipped.questionSelectionTypes.replace('export const QUESTION_FOREGROUND_WAIT_BUDGET_MS = 300;',
        'export const QUESTION_FOREGROUND_WAIT_BUDGET_MS = 5000;'),
    }],
    ['the shared Human Intelligence wait class was raised', {
      orchestrator: shipped.orchestrator.replace('const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300;',
        'const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 5000;'),
    }],
    ['a second conversational provider invocation appeared on the turn path', {
      orchestrator: `${shipped.orchestrator}\n// drift\nconst second = () => this.router.generate({});\n`,
    }],
    ['a fourth provider-backed background effect appeared', {
      providerBudget: shipped.providerBudget.replace(
        "export const POST_RESPONSE_PROVIDER_EFFECTS_V1 = [\n  'ASSOCIATION_PROVIDER',\n  'INTENT_PROVIDER',\n  'CANDIDATE_PROVIDER',\n] as const;",
        "export const POST_RESPONSE_PROVIDER_EFFECTS_V1 = [\n  'ASSOCIATION_PROVIDER',\n  'INTENT_PROVIDER',\n  'CANDIDATE_PROVIDER',\n  'QUESTION_PROVIDER',\n] as const;"),
    }],
    ['the provider cap was raised', {
      providerBudget: shipped.providerBudget.replace('export const POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 3;',
        'export const POST_RESPONSE_PROVIDER_CALL_BUDGET_V1 = 4;'),
    }],
    ['a constituent contract was deregistered from package scripts', {
      packageJson: shipped.packageJson.replace('"test:integrated-intelligence-runtime-contract":',
        '"test:integrated-intelligence-runtime-contract-retired":'),
    }],
    ['the closure contract itself was deregistered from CI', {
      ci: shipped.ci.replaceAll(CLOSURE_SCRIPT, 'echo skipped'),
    }],
    ['the closure contract was moved after the database bootstrap', {
      ci: shipped.ci
        .replace(`      - {name: Verify Integrated Intelligence Runtime phase closure contract, run: npm run ${CLOSURE_SCRIPT}}\n`, '')
        .replace('      - {name: Verify authenticated database foundation,',
          `      - {name: Verify Integrated Intelligence Runtime phase closure contract, run: npm run ${CLOSURE_SCRIPT}}\n      - {name: Verify authenticated database foundation,`),
    }],
    ['the QIR-007 runtime gate was removed from CI', {
      ci: shipped.ci.replaceAll('run: npm run verify:integrated-brain:e2e-hardening-v2', 'run: echo skipped'),
    }],
    ['the runtime tail was reordered', {
      ci: shipped.ci
        .replace('      - {name: Verify Integrated Brain end-to-end hardening v2, run: npm run verify:integrated-brain:e2e-hardening-v2}\n', '')
        .replace('      - {name: Verify A2 end-to-end runtime smoke, run: npm run verify:a2-e2e-runtime-smoke}',
          '      - {name: Verify Integrated Brain end-to-end hardening v2, run: npm run verify:integrated-brain:e2e-hardening-v2}\n      - {name: Verify A2 end-to-end runtime smoke, run: npm run verify:a2-e2e-runtime-smoke}'),
    }],
    ['a fourth runtime E2E gate was added', {
      packageJson: shipped.packageJson.replace('"test:a2-e2e-smoke-contract":',
        '"verify:qir-009-e2e-runtime": "node scripts/qir-009.mjs",\n    "test:a2-e2e-smoke-contract":'),
      ci: shipped.ci.replace('      - {name: Verify Integrated Brain end-to-end hardening v2, run: npm run verify:integrated-brain:e2e-hardening-v2}',
        '      - {name: Verify Integrated Brain end-to-end hardening v2, run: npm run verify:integrated-brain:e2e-hardening-v2}\n      - {name: Verify QIR-009 E2E, run: npm run verify:qir-009-e2e-runtime}'),
    }],
    ['a cross-context adversarial scenario was gutted from the QIR-007 gate', {
      hardeningVerifier: shipped.hardeningVerifier.replaceAll("'C7: ", "'RETIRED-C7: "),
    }],
    ['the cross-context adversarial stage was removed from the QIR-007 gate', {
      hardeningVerifier: shipped.hardeningVerifier.replaceAll("stage = 'C_CROSS_CONTEXT_ADVERSARIAL_MATRIX'", "stage = 'RETIRED'"),
    }],
    ['a migration-numbering ceiling was reintroduced into a repaired historical guard', {
      questionGuard: shipped.questionGuard.replace(
        "  if (!Array.isArray(world.migrations) || !world.migrations.includes(TERMINAL_MIGRATION))",
        `  if ([...world.migrations].${['sort()', 'at(-1)'].join('.')} !== TERMINAL_MIGRATION) violated('frozen forever');\n`
        + '  if (!Array.isArray(world.migrations) || !world.migrations.includes(TERMINAL_MIGRATION))'),
    }],
    ['a future filename ban was reintroduced into a repaired historical guard', {
      hardeningGuard: `${shipped.hardeningGuard}\n// drift\nif (list${['.includes(', "'0064_"].join('')}x.sql')) throw new Error('banned');\n`,
    }],
    ['a repaired historical guard lost its 0063 baseline proof', {
      questionGuard: shipped.questionGuard.replaceAll(TERMINAL_MIGRATION, '0062_fast_deep_runtime_decision_policy_v2.sql'),
    }],
    ['the forward-safety repair marker was stripped from a repaired historical guard', {
      hardeningGuard: shipped.hardeningGuard.replaceAll('QIR-008 phase closure repair', 'no repair'),
    }],
    ['a future-migration acceptance fixture was deleted from a repaired historical guard', {
      questionGuard: shipped.questionGuard.replaceAll('0065_voice_runtime_v1.sql', '0065_unrelated.sql'),
    }],
    ['the still-required 0063 proof was deleted from a repaired historical guard', {
      hardeningGuard: shipped.hardeningGuard.replaceAll(
        'migration 0063 remains historically REQUIRED even when later migrations exist', 'skipped'),
    }],
    ['the terminal phase migration disappeared from the real listing', {
      migrations: Object.freeze(shipped.migrations.filter((name) => name !== TERMINAL_MIGRATION)),
    }],
    ['the docs index lost the freeze link', {
      docsReadme: shipped.docsReadme.replaceAll('integrated-intelligence-runtime-phase-freeze-v1.md', 'missing.md'),
    }],
    ['the docs index stopped representing the phase as CLOSED / FROZEN', {
      docsReadme: shipped.docsReadme.replace('**QANDEEL — Integrated Intelligence Runtime & Hardening v1 — CLOSED / FROZEN.**',
        'The phase is in progress.'),
    }],
    ['the docs index lost a frozen constituent contract', {
      docsReadme: shipped.docsReadme.replaceAll('post-response-intelligence-scheduler-provider-budget-v1.md', 'missing.md'),
    }],
    ['Addendum A stopped being represented as merged QIR-007 closure evidence', {
      docsReadme: shipped.docsReadme.replace(
        'QIR-007 Addendum A — Cross-Context Adversarial & HI Capacity Proof v1** — merged closure evidence carried under QIR-007',
        'Addendum A** — pending'),
    }],
  ];

  for (const [label, overrides] of drifts) {
    const mutated = { ...shippedWorld, ...overrides };
    for (const key of Object.keys(overrides)) {
      assert.notDeepEqual(mutated[key], shippedWorld[key], `the "${label}" mutation actually replaced its source`);
    }
    assert.throws(
      () => assertIntegratedIntelligenceRuntimePhaseClosureContract(mutated),
      (error) => error instanceof Error,
      `the guard rejects: ${label}`,
    );
  }
});

test('C3 - forward safety: a later, separately reviewed phase stays legal', () => {
  // A later, separately reviewed migration is legal by number and by name. The
  // fixtures are listing entries only; no real migration exists or is created.
  for (const fixture of FUTURE_MIGRATION_FIXTURES) {
    assert.doesNotThrow(() => assertIntegratedIntelligenceRuntimePhaseClosureContract({
      ...shippedWorld, migrations: Object.freeze([...shipped.migrations, fixture]),
    }), `a future ${fixture} stays legal for the closure contract`);
  }
  assert.doesNotThrow(() => assertIntegratedIntelligenceRuntimePhaseClosureContract({
    ...shippedWorld, migrations: Object.freeze([...shipped.migrations, ...FUTURE_MIGRATION_FIXTURES]),
  }), 'all future migrations together stay legal for the closure contract');
  // A later reviewed static-contract CI step, package script, documentation
  // amendment or production service changes nothing here.
  const closureLine = shipped.ci.match(/^.*test:integrated-intelligence-runtime-phase-closure-contract.*$/mu)[0];
  assert.doesNotThrow(() => assertIntegratedIntelligenceRuntimePhaseClosureContract({
    ...shippedWorld,
    ci: shipped.ci.replace(closureLine, `${closureLine}\n      - {name: Verify a later reviewed static contract, run: npm run test:future-phase-contract}`),
  }), 'a later reviewed static-contract CI step stays legal');
  assert.doesNotThrow(() => assertIntegratedIntelligenceRuntimePhaseClosureContract({
    ...shippedWorld,
    freezeDoc: `${shipped.freezeDoc}\n\n## Amendment A1 (later reviewed task)\n\nRecorded under its own reviewed contract.\n`,
  }), 'a later reviewed freeze-document amendment stays legal');
  assert.doesNotThrow(() => assertIntegratedIntelligenceRuntimePhaseClosureContract({
    ...shippedWorld,
    docsReadme: `${shipped.docsReadme}\n\n## A later product phase\n\n- Recorded under its own reviewed contract.\n`,
  }), 'a later reviewed docs section stays legal');
  // A later reviewed NON-provider background effect stays legal: the closure
  // guard freezes the PROVIDER registry and the cap, never the whole effect
  // list.
  assert.doesNotThrow(() => assertIntegratedIntelligenceRuntimePhaseClosureContract({
    ...shippedWorld,
    providerBudget: shipped.providerBudget.replace(
      "  HIM_BRAIN_CONTEXT_MATERIALIZATION: 'NON_PROVIDER',",
      "  HIM_BRAIN_CONTEXT_MATERIALIZATION: 'NON_PROVIDER',\n  FUTURE_LEDGER_EFFECT: 'NON_PROVIDER',"),
  }), 'a later reviewed NON-provider effect classification stays legal');
});

test('C4 - the closure contract is wired into package scripts and CI', () => {
  const packageJson = JSON.parse(shipped.packageJson);
  assert.equal(packageJson.scripts[CLOSURE_SCRIPT], CLOSURE_COMMAND);
  const step = shipped.ci.indexOf(CLOSURE_SCRIPT);
  assert.ok(step > 0, 'CI runs the QIR-008 phase closure contract');
  assert.ok(step < shipped.ci.indexOf('Apply all migrations to fresh PostgreSQL'),
    'it runs before the database bootstrap: a pure static guard needs no database');
});

test('C5 - the guard is structurally independent of every mutable census gap', () => {
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
  // The guard function itself never names a mutable-gap literal: not a vendor
  // model identifier, not a routing threshold, and not a local cap VALUE.
  const guardSource = assertIntegratedIntelligenceRuntimePhaseClosureContract.toString();
  for (const forbidden of [
    'DEEP_INPUT_LENGTH',
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

test('C6 - QIR-008 changes no production, database, or migration file', () => {
  // The world listing the guard consumed IS the real migrations directory, and
  // no migration 0064 was created.
  const realMigrations = readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql'));
  assert.deepEqual([...shipped.migrations], realMigrations,
    'the world migration listing is exactly the real database/migrations directory');
  assert.ok(realMigrations.includes(TERMINAL_MIGRATION),
    'the terminal migration of the closed QIR v1 historical baseline exists');
  assert.ok(!realMigrations.some((name) => name.startsWith('0064_')),
    'QIR-008 created no migration 0064');
  // The freeze artifacts perform no database work and ship no runtime code.
  for (const forbidden of ['INSERT INTO', 'DROP TABLE', 'CREATE POLICY', 'GRANT ALL']) {
    assert.ok(!shipped.freezeDoc.includes(forbidden), `the freeze document performs no database work: found ${forbidden}`);
  }
});
