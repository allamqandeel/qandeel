import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// QHIA-015 Human Intelligence Activation phase closure contract.
//
// The phase (QHIA-001 -> QHIA-014A) is CLOSED and FROZEN. This is the compact
// phase integration/freeze guard: it proves the closure ARTIFACTS exist and
// stay coherent, and that every constituent frozen proof remains REGISTERED -
// it deliberately re-verifies wiring and identity, never duplicating the body
// of any constituent test, which each keep their own anti-vacuity suites.
//
// It also freezes the QHIA-015 forward-compatibility repair itself: the four
// historical guards that once froze the live repository to "latest migration =
// 0061 / no 0062" now prove only that the 0061 terminal phase baseline EXISTS
// and that no migration claims their own task identity. A hypothetical later
// phase migration is legal by number, proven here with a listing-entry fixture
// only - no real migration 0062 exists or is ever created.
//
// Forward-safe: nothing here freezes a global inventory count, the live
// repository's future migration numbering, or the shape of any later,
// separately reviewed phase.
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const FREEZE_DOC = 'docs/human-intelligence-activation-freeze-v1.md';
const SOURCES = Object.freeze({
  freezeDoc: FREEZE_DOC,
  docsReadme: 'docs/README.md',
  packageJson: 'package.json',
  ci: '.github/workflows/api-ci.yml',
  orchestrator: 'apps/api/src/conversation/conversation-orchestrator.service.ts',
  providerSemanticsTypes: 'apps/api/src/model-router/human-intelligence-provider-semantics.types.ts',
  footprintSpec: 'apps/api/src/model-router/human-intelligence-prompt-footprint.spec.ts',
  latencyContract: 'tests/him-snapshot-foreground-latency-safe-degradation-contract.test.mjs',
  providerContract: 'tests/human-intelligence-provider-semantics-consolidation-contract.test.mjs',
  brainBridgeContract: 'tests/him-brain-context-bridge-contract.test.mjs',
  brainBridgeDatabaseTest: 'database/tests/him-brain-context-bridge-v1.test.mjs',
});
const shipped = Object.freeze({
  ...Object.fromEntries(Object.entries(SOURCES).map(([key, path]) => [key, read(path)])),
  migrations: Object.freeze(readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql'))),
});

// The frozen phase component inventory. Exactness is legal on this side: it is
// a closed historical set, never a live census.
const PHASE_COMPONENTS = Object.freeze([
  'QHIA-001 — HSE Current-State Interaction Adaptation v1',
  'QHIA-002 — HIM Runtime Consumption Matrix v1',
  'QHIA-003 — Cross-Family Contextual Current Intelligence v1',
  'QHIA-004 — Latency-Bounded Contextual HIM Batch Read v1',
  'QHIA-005 — Session Reflection Consumption v1',
  'QHIA-006 — Authoritative Cross-Context Binding/Relevance v1',
  'QHIA-007 — Situation-Bound Stress Foreground Consumption v1',
  'QHIA-008 — Decision-Bound Attention Foreground Consumption v1',
  'QHIA-009 — Cross-Context Foreground Aggregation v1',
  'QHIA-010 — Goal-Bound Motivation Foreground Consumption v1',
  'QHIA-011 — Relationship-Bound Communication Foreground Consumption v1',
  'QHIA-011A — Explicit Session Context Activation Application Entry v1',
  'QHIA-012 — Background Human Intelligence → Brain Context Bridge v1',
  'QHIA-013 — Human Intelligence Provider Semantics Consolidation v1',
  'QHIA-014 — Human Intelligence Activation Latency & Degradation Evaluation v1',
  'QHIA-014A — HSE Snapshot Foreground Latency-Safe Degradation v1',
  'QHIA-015 — Human Intelligence Activation Phase Closure / Freeze v1',
]);

// The frozen 17 canonical v1 metric identities - a closed historical set.
const CANONICAL_METRICS = Object.freeze([
  'hse.stress', 'hse.energy', 'hse.motivation', 'hse.self-confidence', 'hse.attention',
  'hbs.avoidance', 'hbs.consistency', 'hbs.initiative', 'hbs.reflection',
  'hrs.relationship-trust', 'hrs.communication', 'hrs.repair', 'hrs.emotional-safety',
  'hgs.self-awareness', 'hgs.resilience', 'hgs.purpose-alignment', 'hgs.habit-strength',
]);

const TERMINAL_MIGRATION = '0061_him_brain_context_bridge_v1.sql';

// Constituent frozen proofs that must stay REGISTERED: package script -> its
// exact command, and each must also be reachable from CI.
const REGISTERED_SCRIPTS = Object.freeze({
  'test:him-snapshot-foreground-latency-safe-degradation-contract':
    'node --test tests/him-snapshot-foreground-latency-safe-degradation-contract.test.mjs',
  'test:human-intelligence-provider-semantics-consolidation-contract':
    'node --test tests/human-intelligence-provider-semantics-consolidation-contract.test.mjs',
  'test:him-brain-context-bridge-contract':
    'node --test tests/him-brain-context-bridge-contract.test.mjs',
  'test:cross-context-foreground-application-transport-contract':
    'node --test tests/him-cross-context-foreground-application-transport-contract.test.mjs',
  'test:explicit-session-context-activation-entry-contract':
    'node --test tests/explicit-session-context-activation-entry-contract.test.mjs',
  'test:full-intelligence-e2e-runtime-contract':
    'node --test tests/full-intelligence-e2e-runtime-contract.test.mjs',
  'test:a2-e2e-smoke-contract':
    'node --test tests/a2-e2e-runtime-smoke-contract.test.mjs',
  'test:human-intelligence-activation-phase-closure-contract':
    'node --test tests/human-intelligence-activation-phase-closure-contract.test.mjs',
  'verify:him-brain-context-bridge:integration':
    'node --env-file-if-exists=.env database/verify-migration-0061.mjs',
  'verify:full-intelligence-e2e-runtime':
    'node --env-file-if-exists=.env node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/verify-full-intelligence-end-to-end-runtime.ts',
});
// Composite/CI-only registrations proven by CI reference alone.
const REGISTERED_CI_REFERENCES = Object.freeze([
  'verify:him-measurement-preflight',
  'verify:foundation-integration-gate',
  'verify:a2-e2e-runtime-smoke',
  'verify:explicit-session-context-activation:integration',
]);

// Required deferred-work statements: closure is NOT product completion.
const DEFERRED_STATEMENTS = Object.freeze([
  'realtime voice',
  'UI/UX',
  'onboarding',
  'subscriptions, credits, and payments',
  'notifications and proactive product behavior',
  'Provider Registry',
  'future scientific validation/calibration versions',
  'freshness/decay model',
  'metric confidence model',
  'higher-order composites',
  'trend-aware provider consumption',
  'broader Brain slots',
  'production monitoring dashboards',
  'future system-integration and product-runtime phases',
]);

// The four repaired historical guards: each must prove the 0061 terminal
// baseline EXISTS, carry the QHIA-015 repair marker, and carry NO numbering
// ceiling. The ceiling needles are assembled at run time so this contract's
// own source never contains the executable ceiling shapes it forbids.
const REPAIRED_GUARDS = Object.freeze(['latencyContract', 'providerContract', 'brainBridgeContract', 'brainBridgeDatabaseTest']);
const CEILING_NEEDLES = Object.freeze([
  ['sort()', 'at(-1)'].join('.'),
  ["startsWith('006", '2'].join(''),
  ['^006', '[2-9]'].join(''),
]);

const FUTURE_MIGRATION_FIXTURE = '0062_future_phase_change.sql';

function violated(property) {
  throw new Error(`QHIA-015 Human Intelligence Activation phase closure contract violated: ${property}`);
}

function assertHumanIntelligenceActivationPhaseClosureContract(world) {
  // 1. The freeze document exists and is the closure statement.
  if (typeof world.freezeDoc !== 'string' || world.freezeDoc.length < 1000)
    violated('the freeze document exists and is substantive');
  if (!world.freezeDoc.includes('Status: CLOSED / FROZEN'))
    violated('the freeze document declares Status CLOSED / FROZEN');
  for (const required of [
    'c9ec8564a7b47f142b7e7e4cca7f68bb3d9424eb',
    '66ad3b531d8ed26153bf87c28a7507eae7dd37b1',
    'Human Intelligence must make QANDEEL smarter without making the foreground',
    'QHIA closure is not product completion',
    'Human Intelligence Activation CLOSED',
    'QANDEEL PRODUCT COMPLETE',
    '## Change-control rule',
    '## Non-claims',
    '## Deferred beyond this phase',
    '## Historical guard forward-compatibility repair',
    'max(Snapshot <= 300 ms, Reflection <= 300 ms)',
    '6,427 bytes',
  ]) {
    if (!world.freezeDoc.includes(required)) violated(`the freeze document records: ${required}`);
  }
  if (!world.freezeDoc.includes(`Terminal migration at QHIA closure: \`${TERMINAL_MIGRATION}\``))
    violated('the freeze document records the terminal migration 0061');

  // 2. Every phase component is named, exactly and completely.
  for (const component of PHASE_COMPONENTS) {
    if (!world.freezeDoc.includes(component)) violated(`the freeze document names the phase component: ${component}`);
  }

  // 3. The 17-metric inventory appears EXACTLY: the doc's fenced inventory
  //    block is byte-for-byte the frozen canonical set - a doc-content rule
  //    over a closed historical set, never a live-inventory census.
  const blockStart = world.freezeDoc.indexOf('```text');
  const blockEnd = world.freezeDoc.indexOf('```', blockStart + 7);
  if (blockStart < 0 || blockEnd < 0) violated('the freeze document carries the fenced 17-metric inventory block');
  const documented = world.freezeDoc.slice(blockStart + 7, blockEnd).split('\n').map((line) => line.trim()).filter(Boolean);
  assert.deepEqual(documented, [...CANONICAL_METRICS], 'the documented inventory is exactly the frozen 17 canonical v1 identities');
  if (!world.freezeDoc.includes('CALIBRATED'))
    violated('the freeze document states the inventory is CALIBRATED');

  // 4. The runtime consumption matrix appears with all five context kinds.
  for (const contextKind of ['CONVERSATION_SESSION', 'SITUATION', 'GOAL', 'DECISION', 'RELATIONSHIP']) {
    if (!world.freezeDoc.includes(`| ${contextKind} |`)) violated(`the runtime matrix row exists: ${contextKind}`);
  }

  // 5. Deferred work: closure is not product completion.
  for (const statement of DEFERRED_STATEMENTS) {
    if (!world.freezeDoc.includes(statement)) violated(`the freeze document defers: ${statement}`);
  }

  // 6. The docs index links the freeze document.
  if (!world.docsReadme.includes('human-intelligence-activation-freeze-v1.md'))
    violated('docs/README.md links the phase freeze document');

  // 7. Every constituent frozen proof remains registered in package scripts
  //    and reachable from CI - including this closure contract itself.
  const packageJson = JSON.parse(world.packageJson);
  for (const [script, command] of Object.entries(REGISTERED_SCRIPTS)) {
    if (packageJson.scripts?.[script] !== command)
      violated(`the package script remains registered exactly: ${script}`);
  }
  for (const reference of [...Object.keys(REGISTERED_SCRIPTS), ...REGISTERED_CI_REFERENCES]) {
    if (!world.ci.includes(reference)) violated(`CI still runs: ${reference}`);
  }
  const closureStep = world.ci.indexOf('test:human-intelligence-activation-phase-closure-contract');
  if (!(closureStep > 0 && closureStep < world.ci.indexOf('Apply all migrations to fresh PostgreSQL')))
    violated('the closure contract runs in CI before the database bootstrap: a pure static guard needs no database');

  // 8. The QHIA-014 300 ms proof and zero-wait topology remain live in the
  //    orchestrator, and the latency contract still freezes them.
  for (const [source, required, property] of [
    ['orchestrator', 'const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300;', 'the ONE shared 300 ms Human Intelligence foreground budget'],
    ['orchestrator', 'await Promise.all([snapshotReadPromise, reflectionReadPromise])', 'the ONE foreground barrier'],
    ['orchestrator', 'crossContextForegroundBarrierClosed = true;', 'the aggregate-v3 zero-wait barrier flag'],
    ['orchestrator', 'brainContextBarrierClosed = true;', 'the Brain Context zero-wait barrier flag'],
    ['latencyContract', 'const SHARED_BUDGET_DECLARATION = \'const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300;\';', 'the latency contract freezes the 300 ms budget'],
    ['latencyContract', 'advanceTimersByTimeAsync(299)', 'the latency contract requires the deterministic fake-timer boundary proof'],
    ['latencyContract', 'jest.getTimerCount()', 'the latency contract requires the timer-leak proof'],
  ]) {
    if (!world[source].includes(required)) violated(`${property}: missing ${required}`);
  }
  if ((world.orchestrator.match(/this\.router\.generate\(/gu) ?? []).length !== 1)
    violated('exactly one provider invocation exists on the turn path');

  // 9. The QHIA-013 provider semantics guard remains live: the frozen 12
  //    behavioral instruction IDs in canonical order, and the exact measured
  //    footprint stays a locked result.
  const expectedIds = [
    'COMPACT_RESPONSE', 'REDUCE_COGNITIVE_LOAD', 'SINGLE_CONVERSATIONAL_TRACK', 'REDUCE_STEERING_PRESSURE',
    'CALMER_DELIVERY', 'ONE_STEP_AT_A_TIME', 'GENTLE_REFLECTION_INVITATION', 'AVOID_REDUNDANT_REFLECTION',
    'SMALL_IMMEDIATE_GOAL_ACTION', 'EXPLICIT_RELATIONSHIP_COMMUNICATION_WORDING',
    'ONE_MAIN_RELATIONSHIP_COMMUNICATION_POINT', 'CLARITY_NOT_FORCED_AGREEMENT',
  ];
  const registry = world.providerSemanticsTypes.slice(
    world.providerSemanticsTypes.indexOf('HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS = Object.freeze(['),
    world.providerSemanticsTypes.indexOf('] as const);'),
  );
  if (!registry) violated('the frozen provider instruction registry exists');
  const foundIds = [...registry.matchAll(/'([A-Z_]+)'/gu)].map((match) => match[1])
    .filter((id) => id !== 'HUMAN_INTELLIGENCE_PROVIDER_INSTRUCTION_IDS');
  assert.deepEqual(foundIds, expectedIds, 'exactly the 12 canonical behavioral instruction IDs in canonical order');
  if (!world.footprintSpec.includes('EXPECTED_QHIA_013_HUMAN_INTELLIGENCE_BYTES = 6427'))
    violated('the exact 6,427-byte footprint proof remains a locked result');

  // 10. The historical migration guards are forward-safe. Each repaired guard
  //     proves the 0061 terminal baseline EXISTS, carries the repair marker,
  //     and carries no numbering ceiling; and the real migration listing
  //     still contains the terminal phase migration.
  for (const guard of REPAIRED_GUARDS) {
    if (!world[guard].includes(TERMINAL_MIGRATION))
      violated(`the historical guard ${guard} proves the 0061 terminal phase baseline exists`);
    if (!world[guard].includes('QHIA-015 phase closure repair'))
      violated(`the historical guard ${guard} carries the forward-compatibility repair`);
    for (const needle of CEILING_NEEDLES) {
      if (world[guard].includes(needle))
        violated(`the historical guard ${guard} carries no migration-numbering ceiling: found ${needle}`);
    }
  }
  if (!world.latencyContract.includes(FUTURE_MIGRATION_FIXTURE))
    violated('the latency contract proves a later phase migration is legal by number');
  if (!Array.isArray(world.migrations) || !world.migrations.includes(TERMINAL_MIGRATION))
    violated('the terminal Human Intelligence Activation phase migration 0061 exists in the real listing');
  if (world.migrations.some((name) => /phase.closure|activation.freeze/iu.test(name)))
    violated('QHIA-015 adds no migration: no migration claims the phase-closure identity');
}

test('P1 - the shipped repository satisfies the phase closure contract', () => {
  assert.doesNotThrow(() => assertHumanIntelligenceActivationPhaseClosureContract(shipped));
});

test('P2 - anti-vacuity: the real guard rejects every named regression', () => {
  const drifts = [
    ['the freeze document was deleted', { freezeDoc: '' }],
    ['the CLOSED / FROZEN status was withdrawn', {
      freezeDoc: shipped.freezeDoc.replace('Status: CLOSED / FROZEN', 'Status: DRAFT'),
    }],
    ['a phase component vanished from the inventory', {
      freezeDoc: shipped.freezeDoc.replace('12. QHIA-011A — Explicit Session Context Activation Application Entry v1\n', ''),
    }],
    ['a canonical metric vanished from the documented inventory', {
      freezeDoc: shipped.freezeDoc.replace('hgs.habit-strength\n', ''),
    }],
    ['an 18th metric appeared in the documented inventory', {
      freezeDoc: shipped.freezeDoc.replace('hgs.habit-strength\n', 'hgs.habit-strength\nhgs.discipline\n'),
    }],
    ['the closed/complete distinction was erased', {
      freezeDoc: shipped.freezeDoc.replaceAll('QHIA closure is not product completion', 'the product is complete'),
    }],
    ['a deferred-work statement was dropped', {
      freezeDoc: shipped.freezeDoc.replaceAll('trend-aware provider consumption', 'trend consumption is enabled'),
    }],
    ['the terminal migration record was dropped', {
      freezeDoc: shipped.freezeDoc.replace(`Terminal migration at QHIA closure: \`${TERMINAL_MIGRATION}\``, 'Terminal migration: unrecorded'),
    }],
    ['the docs index lost the freeze link', {
      docsReadme: shipped.docsReadme.replaceAll('human-intelligence-activation-freeze-v1.md', 'missing.md'),
    }],
    ['a constituent contract was deregistered from package scripts', {
      packageJson: shipped.packageJson.replace('"test:him-brain-context-bridge-contract":', '"test:him-brain-context-bridge-contract-retired":'),
    }],
    ['the closure contract itself was deregistered from CI', {
      ci: shipped.ci.replaceAll('test:human-intelligence-activation-phase-closure-contract', 'echo skipped'),
    }],
    ['the Full Intelligence E2E runtime step was deleted from CI', {
      ci: shipped.ci.replaceAll('verify:full-intelligence-e2e-runtime', 'echo skipped'),
    }],
    ['the shared 300 ms budget was raised', {
      orchestrator: shipped.orchestrator.replace('const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 300;', 'const HUMAN_INTELLIGENCE_FOREGROUND_WAIT_BUDGET_MS = 5000;'),
    }],
    ['a second provider invocation appeared on the turn path', {
      orchestrator: `${shipped.orchestrator}\n// drift\nconst second = (o) => o.engine('model_router', 'FAST', () => this.router.generate({}));\n`,
    }],
    ['the deterministic fake-timer proof requirement was dropped from the latency contract', {
      latencyContract: shipped.latencyContract.replaceAll('advanceTimersByTimeAsync(299)', 'advanceTimersByTimeAsync(0)'),
    }],
    ['a behavioral instruction ID was removed from the frozen registry', {
      providerSemanticsTypes: shipped.providerSemanticsTypes.replace("  'CLARITY_NOT_FORCED_AGREEMENT',\n", ''),
    }],
    ['a 13th behavioral instruction ID entered the frozen registry', {
      providerSemanticsTypes: shipped.providerSemanticsTypes.replace(
        "  'CLARITY_NOT_FORCED_AGREEMENT',\n",
        "  'CLARITY_NOT_FORCED_AGREEMENT',\n  'PUSH_FOR_AGREEMENT',\n",
      ),
    }],
    ['the exact footprint result was unlocked', {
      footprintSpec: shipped.footprintSpec.replace('EXPECTED_QHIA_013_HUMAN_INTELLIGENCE_BYTES = 6427', 'EXPECTED_QHIA_013_HUMAN_INTELLIGENCE_BYTES = 9999'),
    }],
    ['a migration-numbering ceiling was reintroduced into a historical guard', {
      latencyContract: shipped.latencyContract.replace(
        "if (!world.migrations.includes('0061_him_brain_context_bridge_v1.sql'))",
        `if ([...world.migrations].${CEILING_NEEDLES[0]} !== '0061_him_brain_context_bridge_v1.sql') violated('frozen forever');\n  if (!world.migrations.includes('0061_him_brain_context_bridge_v1.sql'))`,
      ),
    }],
    ['a historical guard lost its 0061 terminal-baseline proof', {
      brainBridgeDatabaseTest: shipped.brainBridgeDatabaseTest.replaceAll(TERMINAL_MIGRATION, '0060_him_relationship_communication_foreground_consumption_v1.sql'),
    }],
    ['the forward-compatibility repair marker was stripped from a historical guard', {
      providerContract: shipped.providerContract.replaceAll('QHIA-015 phase closure repair', 'no repair'),
    }],
    ['the terminal phase migration disappeared from the real listing', {
      migrations: Object.freeze(shipped.migrations.filter((name) => name !== TERMINAL_MIGRATION)),
    }],
    ['a migration claiming the phase-closure identity was added', {
      migrations: Object.freeze([...shipped.migrations, '0062_him_activation_freeze_phase_closure_v1.sql']),
    }],
  ];

  for (const [label, overrides] of drifts) {
    const mutated = { ...shipped, ...overrides };
    for (const key of Object.keys(overrides)) {
      assert.notDeepEqual(mutated[key], shipped[key], `the "${label}" mutation actually replaced its source`);
    }
    assert.throws(
      () => assertHumanIntelligenceActivationPhaseClosureContract(mutated),
      (error) => error instanceof Error,
      `the guard rejects: ${label}`,
    );
  }
});

test('P3 - forward safety: a later, separately reviewed phase stays legal', () => {
  // A hypothetical later phase migration is legal by number - the fixture is a
  // listing entry only, and no real migration 0062 exists or is created.
  assert.doesNotThrow(() => assertHumanIntelligenceActivationPhaseClosureContract({
    ...shipped,
    migrations: Object.freeze([...shipped.migrations, FUTURE_MIGRATION_FIXTURE]),
  }));
  // A later, separately reviewed provider surface changes nothing here.
  assert.doesNotThrow(() => assertHumanIntelligenceActivationPhaseClosureContract({
    ...shipped,
    providerSemanticsTypes: `${shipped.providerSemanticsTypes}\n// a later reviewed surface may be added here\n`,
  }));
});

test('P4 - the closure contract is wired into package scripts and CI', () => {
  const packageJson = JSON.parse(shipped.packageJson);
  assert.equal(
    packageJson.scripts['test:human-intelligence-activation-phase-closure-contract'],
    'node --test tests/human-intelligence-activation-phase-closure-contract.test.mjs',
  );
  const step = shipped.ci.indexOf('test:human-intelligence-activation-phase-closure-contract');
  assert.ok(step > 0, 'CI runs the phase closure contract');
  assert.ok(step < shipped.ci.indexOf('Apply all migrations to fresh PostgreSQL'),
    'it runs before the database bootstrap: a pure static guard needs no database');
});

test('P5 - QHIA-015 changes no production, database, or migration file', () => {
  // The world listing the guard consumed IS the real migrations directory.
  assert.deepEqual(
    [...shipped.migrations],
    readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql')),
    'the world migration listing is exactly the real database/migrations directory',
  );
  // The freeze artifacts perform no database work and ship no runtime code:
  // the freeze document and this contract are the only surfaces QHIA-015 owns,
  // and neither carries an executable database statement.
  for (const forbidden of ['INSERT INTO', 'DROP TABLE', 'CREATE POLICY', 'GRANT ALL']) {
    assert.ok(!shipped.freezeDoc.includes(forbidden), `the freeze document performs no database work: found ${forbidden}`);
  }
});
