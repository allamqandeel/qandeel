import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// QHIA-012 database static contract.
//
// Freezes the DATABASE half of the Background Human Intelligence -> Brain
// Context Bridge: the trusted canonical-core extraction, the frozen eight-slot
// registry, the one execution-bound service-role source, the MANAGED durable
// effect whose CLAIMED state is structurally unrepresentable, and the one
// authenticated foreground read with its immediate-previous-turn rule.
//
// WHAT IT DELIBERATELY DOES NOT ASSERT. It freezes no future migration number,
// no metric inventory, no context-kind inventory, and no ceiling on later
// migrations or later Brain slots introduced by a separately reviewed task. It
// owns migration 0061's own identity, ordering and content, and nothing else.
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const MIGRATION = '0061_him_brain_context_bridge_v1.sql';
const MIGRATION_NUMBER = 61;
const sql = read(`migrations/${MIGRATION}`);
// Negatives run on EXECUTABLE SQL only: the migration's own prose legitimately
// names every shape it documents the absence of, exactly as migrations 0052,
// 0054, 0055 and 0060 do.
const executable = sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
// The INSTALLED statements only. The precondition and postcondition DO blocks
// legitimately name every forbidden identifier as DATA - that is exactly how
// they prove those identifiers are absent from the installed definitions - so
// running the negatives over them would be self-defeating.
const statements = executable.replace(/DO \$\$[\s\S]*?END\$\$;/gu, '');
const slice = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const CORE_FUNCTION = slice(statements, 'CREATE FUNCTION public.read_him_latest_measurement_core_v1(', 'ALTER FUNCTION public.read_him_latest_measurement_core_v1');
const SOURCE_FUNCTION = slice(statements, 'CREATE FUNCTION public.background_read_him_brain_context_source_v1(', 'ALTER FUNCTION public.background_read_him_brain_context_source_v1');
const COMPLETION_FUNCTION = slice(statements, 'CREATE FUNCTION public.complete_post_response_him_brain_context_materialization_v1(', 'ALTER FUNCTION public.complete_post_response_him_brain_context_materialization_v1');
const FOREGROUND_FUNCTION = slice(statements, 'CREATE FUNCTION public.read_him_brain_context_for_turn_v1(', 'ALTER FUNCTION public.read_him_brain_context_for_turn_v1');
const VALIDATOR_FUNCTION = slice(statements, 'CREATE FUNCTION public.post_response_him_brain_context_result_valid_v1(', 'ALTER FUNCTION public.post_response_him_brain_context_result_valid_v1');
const WRAPPER_FUNCTION = slice(statements, 'CREATE OR REPLACE FUNCTION public.read_him_latest_measurement_v1(', 'ALTER TABLE public.post_response_intelligence_effects');
const verifier = read('verify-migration-0061.mjs');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', root), 'utf8'));
const ci = readFileSync(new URL('../.github/workflows/api-ci.yml', root), 'utf8');

// The frozen eight-slot Brain Context registry.
const REGISTRY = [
  ['DECISION_SELF_CONFIDENCE', 'DECISION', 'hse.self-confidence'],
  ['SITUATION_AVOIDANCE_FREQUENCY', 'SITUATION', 'hbs.avoidance'],
  ['SITUATION_SELF_AWARENESS', 'SITUATION', 'hgs.self-awareness'],
  ['SITUATION_RESILIENCE', 'SITUATION', 'hgs.resilience'],
  ['GOAL_CONSISTENCY', 'GOAL', 'hbs.consistency'],
  ['GOAL_INITIATIVE', 'GOAL', 'hbs.initiative'],
  ['GOAL_PURPOSE_ALIGNMENT', 'GOAL', 'hgs.purpose-alignment'],
  ['GOAL_HABIT_STRENGTH', 'GOAL', 'hgs.habit-strength'],
];
// The metrics QHIA-012 deliberately excludes. Four already have their own
// dedicated foreground consumption; the rest belong to other surfaces.
const EXCLUDED_METRICS = [
  'hse.stress', 'hse.attention', 'hse.motivation', 'hse.energy', 'hbs.reflection',
  'hrs.communication', 'hrs.relationship-trust', 'hrs.repair', 'hrs.emotional-safety',
];

function assertMigrationIdentity(names) {
  const migrations = [...names].sort();
  assert.ok(migrations.includes(MIGRATION), 'migration 0061 exists');
  for (let n = 1; n <= MIGRATION_NUMBER; n += 1) {
    const prefix = String(n).padStart(4, '0');
    assert.equal(migrations.filter((name) => name.startsWith(prefix)).length, 1, `exactly one migration ${prefix}`);
  }
  assert.ok(
    migrations.indexOf(MIGRATION) > migrations.indexOf('0060_him_relationship_communication_foreground_consumption_v1.sql'),
    '0061 orders after 0060',
  );
}

test('0061 exists exactly once after 0060 and this task owns exactly one migration', () => {
  const names = readdirSync(new URL('migrations/', root)).filter((name) => name.endsWith('.sql'));
  assertMigrationIdentity(names);
  // QHIA-012 owns 0061 and nothing else. This is a statement about THIS task,
  // not a permanent ceiling: the forward-safety control below proves later
  // migrations stay legal.
  assert.equal(names.filter((name) => name.startsWith('0062')).length, 0, 'this task adds no migration 0062');
});

test('the canonical latest authority is EXTRACTED, not rewritten', () => {
  // The trusted internal core carries the migration-0052 algorithm verbatim.
  assert.match(executable, /CREATE FUNCTION public\.read_him_latest_measurement_core_v1\(p_trusted_user_id uuid,p_metric_key text,p_definition_version integer,p_context_kind text,p_context_id text\)/u);
  assert.match(executable, /RETURNS SETOF public\.him_metric_snapshots LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''/u);
  for (const rule of [
    'ORDER BY me.created_at DESC,me.id DESC',
    'ORDER BY mo.created_at DESC,mo.id DESC',
    'him_current_structured_measurements',
    'supersedes_observation_id',
    'valid_context_kinds',
    'Unknown exact HIM metric definition',
    'Unsupported context kind for the exact HIM metric definition',
    'Unsupported HIM context ownership authority',
    'Unknown or unowned HIM measurement context',
  ]) assert.ok(CORE_FUNCTION.includes(rule), `the trusted core carries the canonical rule ${rule}`);
  // The core is reachable by NO request role: it is revoked from all four and
  // granted to none.
  assert.match(executable, /REVOKE ALL ON FUNCTION public\.read_him_latest_measurement_core_v1\(uuid,text,integer,text,text\) FROM PUBLIC,anon,authenticated,service_role;/u);
  assert.doesNotMatch(executable, /GRANT EXECUTE ON FUNCTION public\.read_him_latest_measurement_core_v1/u,
    'the trusted core is granted to no role at all');
  // The authenticated wrapper keeps its exact signature and is REPLACED, never
  // dropped and re-granted - so its existing ACL cannot be widened by accident.
  assert.match(executable, /CREATE OR REPLACE FUNCTION public\.read_him_latest_measurement_v1\(p_user_id uuid,p_metric_key text,p_definition_version integer,p_context_kind text,p_context_id text\)/u);
  assert.doesNotMatch(executable, /DROP FUNCTION public\.read_him_latest_measurement_v1/u);
  assert.doesNotMatch(executable, /GRANT EXECUTE ON FUNCTION public\.read_him_latest_measurement_v1/u,
    'the preserved wrapper ACL is never re-issued: CREATE OR REPLACE keeps it exactly as migration 0052 left it');
  assert.ok(WRAPPER_FUNCTION.includes('Authentication required'), 'the wrapper keeps its exact authentication error');
  assert.ok(WRAPPER_FUNCTION.includes('Canonical latest measurement reads are owner-exact'), 'the wrapper keeps its exact owner-exactness error');
  assert.ok(WRAPPER_FUNCTION.includes('RETURN QUERY SELECT core.* FROM public.read_him_latest_measurement_core_v1(u,'),
    'the wrapper delegates to the trusted core');
  // Exactly ONE latest/currentness algorithm exists in this migration: the
  // extracted core owns the chronology and the structured-current view, and no
  // other installed statement reimplements either.
  assert.equal((statements.match(/ORDER BY me\.created_at DESC,me\.id DESC/gu) ?? []).length, 1,
    'the newest-event chronology appears exactly once: no second currentness algorithm is created');
  assert.equal((statements.match(/him_current_structured_measurements/gu) ?? []).length, 1,
    'the structured-current view is read from exactly one place');
  for (const [label, body] of [['wrapper', WRAPPER_FUNCTION], ['background source', SOURCE_FUNCTION], ['managed completion', COMPLETION_FUNCTION], ['foreground read', FOREGROUND_FUNCTION]]) {
    assert.ok(!body.includes('him_current_structured_measurements'), `the ${label} owns no currentness semantics`);
    assert.ok(!body.includes('ORDER BY me.created_at'), `the ${label} owns no event chronology`);
    assert.ok(!body.includes('snapshot_version'), `the ${label} never orders by snapshot_version`);
  }
});

test('the Brain Context registry is exactly eight frozen slots', () => {
  for (const [slot, kind, metric] of REGISTRY) {
    assert.ok(SOURCE_FUNCTION.includes(`'${slot}'`), `the frozen slot ${slot} is pinned`);
    assert.ok(SOURCE_FUNCTION.includes(`'${metric}'`), `the frozen metric ${metric} is pinned`);
    assert.ok(SOURCE_FUNCTION.includes(`'${kind}'`), `the frozen context kind ${kind} is pinned`);
  }
  // No ninth slot, no HRS, no already-dedicated foreground metric.
  for (const metric of EXCLUDED_METRICS) {
    assert.ok(!SOURCE_FUNCTION.includes(`'${metric}'`), `QHIA-012 activates no ${metric}`);
  }
  assert.ok(!SOURCE_FUNCTION.includes("'RELATIONSHIP'"), 'no RELATIONSHIP kind is activated');
  assert.ok(!SOURCE_FUNCTION.includes("'GLOBAL'"), 'no GLOBAL kind is activated');
  assert.ok(!SOURCE_FUNCTION.includes("'CONVERSATION_SESSION'"), 'no CONVERSATION_SESSION kind is activated');
  // The registry VALUES table is exactly eight rows, and the payload validator
  // carries exactly the same eight slot labels and their eight frozen kinds.
  const registryTable = slice(SOURCE_FUNCTION, 'WITH registry(brain_order,brain_label,brain_kind,brain_metric) AS(', 'bound AS(');
  assert.equal((registryTable.match(/'(DECISION|SITUATION|GOAL)'/gu) ?? []).length, 8, 'exactly eight registry rows exist');
  const validatorSlots = slice(VALIDATOR_FUNCTION, 'slots constant text[] :=', 'kinds constant text[] :=');
  assert.equal((validatorSlots.match(/'[A-Z_]+'/gu) ?? []).length, 8, 'the durable payload validator pins exactly eight slot labels');
  const validatorKinds = slice(VALIDATOR_FUNCTION, 'kinds constant text[] :=', 'signals jsonb;');
  assert.deepEqual(
    (validatorKinds.match(/'[A-Z_]+'/gu) ?? []).map((value) => value.slice(1, -1)),
    REGISTRY.map(([, kind]) => kind),
    'each frozen slot is pinned to exactly its one frozen context kind, in registry order',
  );
});

test('the background source is one execution-bound service-role request with no per-slot fan-out', () => {
  assert.match(executable, /CREATE FUNCTION public\.background_read_him_brain_context_source_v1\(p_execution_id uuid\)/u);
  assert.match(executable, /GRANT EXECUTE ON FUNCTION public\.background_read_him_brain_context_source_v1\(uuid\) TO service_role;/u);
  assert.match(executable, /REVOKE ALL ON FUNCTION public\.background_read_him_brain_context_source_v1\(uuid\) FROM PUBLIC,anon,authenticated,service_role;/u);
  // The callable surface cannot be aimed: there is no user, session, turn,
  // context, target, metric, definition-version, slot, or registry parameter.
  const signature = executable.slice(
    executable.indexOf('CREATE FUNCTION public.background_read_him_brain_context_source_v1('),
    executable.indexOf('RETURNS TABLE(', executable.indexOf('CREATE FUNCTION public.background_read_him_brain_context_source_v1(')),
  );
  for (const forbidden of ['p_user_id', 'p_session_id', 'p_turn_id', 'p_context_kind', 'p_context_id', 'p_metric_key', 'p_metric_keys', 'p_definition_version', 'p_slot', 'p_registry']) {
    assert.ok(!signature.includes(forbidden), `the background source accepts no ${forbidden}`);
  }
  // Every authority is derived in the database and delegated, never rebuilt.
  const body = executable.slice(
    executable.indexOf('CREATE FUNCTION public.background_read_him_brain_context_source_v1('),
    executable.indexOf('ALTER FUNCTION public.background_read_him_brain_context_source_v1'),
  );
  assert.ok(body.includes('public.read_him_latest_measurement_core_v1('), 'every current value is delegated to the trusted core');
  assert.ok(body.includes('public.him_active_structured_binding_id('), 'binding identity comes from the existing resolver');
  assert.ok(body.includes("e.state='RUNNING'"), 'only a RUNNING execution is answerable');
  assert.ok(body.includes("execution_row.event_version<>'2.0'"), 'only the canonical v2 completed-turn event is answerable');
  assert.ok(body.includes("execution_row.safety_disposition IS DISTINCT FROM 'ALLOW'"), 'only an ALLOW disposition is answerable');
  assert.ok(body.includes("t.role='USER' AND t.status='COMPLETED'"), 'the source turn must be the owned canonical COMPLETED USER turn');
  assert.ok(body.includes("b.status='ACTIVE'"), 'only ACTIVE relevance bindings are resolved');
  // No relevance inference and no unbound fallback of any kind.
  for (const forbidden of ['ORDER BY b.created_at', 'ORDER BY t.created_at', 'display_text', 'ILIKE', 'similarity', 'LIMIT 1']) {
    assert.ok(!body.includes(forbidden), `the background source never selects a substitute target: found ${forbidden}`);
  }
});

test('the Brain Context effect is MANAGED: a CLAIMED row is structurally unrepresentable', () => {
  // The registry widens by exactly one key.
  assert.match(executable, /CHECK\(effect_key IN\('MEMORY_WRITE','INTENT_PROVIDER','CANDIDATE_PROVIDER','ASSOCIATION_PROVIDER','HYPOTHESIS_UPDATE_BATCH','HYPOTHESIS_PERSISTENCE','CONFIDENCE_BATCH','HIM_BRAIN_CONTEXT_MATERIALIZATION'\)\);/u);
  // The result domain has NO all-null alternative, so a CLAIMED (all-null) Brain
  // row cannot be stored at all. This is the load-bearing rule of the whole
  // managed contract.
  const domain = executable.slice(
    executable.indexOf('ADD CONSTRAINT post_response_intelligence_effects_him_brain_context_result_check'),
    executable.indexOf('-- 7.') > 0 ? executable.indexOf('CREATE OR REPLACE FUNCTION public.claim_post_response_intelligence_effect_v1') : executable.length,
  );
  assert.ok(domain.includes("state='COMPLETED' AND result_code='NO_HIM_BRAIN_CONTEXT'"), 'the payload-free result requires COMPLETED');
  assert.ok(domain.includes("state='COMPLETED' AND result_code='HIM_BRAIN_CONTEXT_MATERIALIZED'"), 'the materialized result requires COMPLETED');
  assert.ok(domain.includes('public.post_response_him_brain_context_result_valid_v1(result_payload)'), 'the materialized result is schema-validated');
  assert.ok(!/OR \(result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL\)/u.test(domain),
    'the Brain result domain has NO all-null alternative: a CLAIMED Brain row is unrepresentable');
  // Both generic paths reject it, and every existing rejection is preserved.
  assert.ok(executable.includes("IF p_effect_key='HIM_BRAIN_CONTEXT_MATERIALIZATION' THEN RAISE EXCEPTION 'HIM_BRAIN_CONTEXT_MATERIALIZATION_MANAGED'"));
  assert.ok(executable.includes("IF p_effect_key='HIM_BRAIN_CONTEXT_MATERIALIZATION' THEN RAISE EXCEPTION 'HIM_BRAIN_CONTEXT_MATERIALIZATION_COMMAND_REQUIRED'"));
  for (const preserved of ['HYPOTHESIS_UPDATE_BATCH_MANAGED', 'CONFIDENCE_BATCH_MANAGED', 'MEMORY_RESULT_REQUIRED', 'INTENT_RESULT_REQUIRED', 'ASSOCIATION_RESULT_REQUIRED', 'CANDIDATE_RESULT_REQUIRED', 'HYPOTHESIS_PERSISTENCE_COMMAND_REQUIRED', 'HYPOTHESIS_UPDATE_BATCH_COMMAND_REQUIRED', 'CONFIDENCE_BATCH_COMMAND_REQUIRED']) {
    assert.ok(executable.includes(preserved), `the existing rejection ${preserved} is preserved verbatim`);
  }
  // The managed command inserts COMPLETED directly and never claims.
  const command = executable.slice(
    executable.indexOf('CREATE FUNCTION public.complete_post_response_him_brain_context_materialization_v1('),
    executable.indexOf('ALTER FUNCTION public.complete_post_response_him_brain_context_materialization_v1'),
  );
  assert.ok(command.includes("'HIM_BRAIN_CONTEXT_MATERIALIZATION','COMPLETED'"), 'the effect is inserted directly as COMPLETED');
  assert.ok(!command.includes("'CLAIMED'"), 'the managed command never writes a CLAIMED state');
  assert.ok(command.includes("RETURN 'ALREADY_COMPLETED'"), 'the first durable result is immutable');
  assert.ok(command.includes('source_turn_id'), 'the durable result is bound to the execution source turn');
  assert.ok(command.includes('public.him_measurement_targets'), 'every signal context is verified against the execution owner');
  for (const forbidden of ['p_user_id', 'p_session_id', 'p_source_turn_id', 'p_metric_key', 'p_context_kind', 'p_context_id', 'p_access_token']) {
    assert.ok(!command.includes(forbidden), `the managed command accepts no caller-supplied ${forbidden}`);
  }
  assert.match(executable, /GRANT EXECUTE ON FUNCTION public\.complete_post_response_him_brain_context_materialization_v1\(uuid,text,jsonb\) TO service_role;/u);
});

test('the durable payload validator bounds the receipt and forbids every leak', () => {
  const validator = executable.slice(
    executable.indexOf('CREATE FUNCTION public.post_response_him_brain_context_result_valid_v1('),
    executable.indexOf('ALTER FUNCTION public.post_response_him_brain_context_result_valid_v1'),
  );
  // Exact key sets are what forbid a metric key, a measurement identity, a
  // timestamp, a transcript, or any other field from ever being persisted.
  assert.ok(validator.includes("ARRAY['contractVersion','signals','source','sourceTurnId']"), 'the payload key set is exact');
  assert.ok(validator.includes("ARRAY['confidenceState','contextId','contextKind','freshnessState','numericValue','semanticMappingStatus','semanticType','slot','slotOrder']"), 'the signal key set is exact');
  assert.ok(validator.includes('NOT BETWEEN 1 AND 8'), 'the receipt carries between one and eight signals');
  assert.ok(validator.includes('IF ordinal<=previous THEN RETURN false'), 'registry order is strictly increasing, so no slot can repeat');
  assert.ok(validator.includes("!~ '^[1-5]$'"), 'the v1 structured scale bound is enforced');
  assert.ok(validator.includes("(element->>'freshnessState')<>'UNASSESSED'"), 'freshness stays UNASSESSED');
  assert.ok(validator.includes("(element->>'confidenceState')<>'UNASSESSED'"), 'confidence stays UNASSESSED');
  assert.ok(validator.includes('IMMUTABLE PARALLEL SAFE'), 'the validator reads no table: a later world change can never rewrite a committed receipt');
  for (const forbidden of ['metricKey', 'observedAt', 'temporalWindow', 'measurementEventId', 'observationId', 'snapshotId', 'canonicalBindingId', 'activeBindingId', 'confidenceReference', 'freshnessReference', 'transcript', 'memory', 'hypothesis']) {
    assert.ok(!validator.includes(forbidden), `the durable payload can never carry ${forbidden}`);
  }
});

test('the foreground read consumes only the IMMEDIATE predecessor and rereads no metric', () => {
  assert.match(executable, /CREATE FUNCTION public\.read_him_brain_context_for_turn_v1\(p_user_id uuid,p_session_id uuid,p_current_turn_id uuid\)/u);
  assert.match(executable, /GRANT EXECUTE ON FUNCTION public\.read_him_brain_context_for_turn_v1\(uuid,uuid,uuid\) TO authenticated;/u);
  assert.match(executable, /REVOKE ALL ON FUNCTION public\.read_him_brain_context_for_turn_v1\(uuid,uuid,uuid\) FROM PUBLIC,anon,authenticated,service_role;/u);
  const body = executable.slice(
    executable.indexOf('CREATE FUNCTION public.read_him_brain_context_for_turn_v1('),
    executable.indexOf('ALTER FUNCTION public.read_him_brain_context_for_turn_v1'),
  );
  assert.ok(body.includes('auth.uid()'), 'the foreground read requires an authenticated caller');
  // The immediate-previous-turn rule, structurally: the predecessor is selected
  // by (created_at, id) with NO status predicate, and usability is decided only
  // afterwards.
  assert.ok(body.includes('(t.created_at,t.id)<(current_turn.created_at,current_turn.id)'), 'the predecessor uses the deterministic session ordering');
  assert.ok(body.includes('ORDER BY t.created_at DESC,t.id DESC LIMIT 1'), 'the predecessor is the greatest strictly-earlier USER turn');
  const selection = body.slice(body.indexOf('SELECT * INTO previous_turn'), body.indexOf('IF NOT FOUND THEN RETURN;END IF;', body.indexOf('SELECT * INTO previous_turn')));
  assert.ok(!selection.includes('status'), 'the predecessor query filters by NO status at all while choosing');
  assert.ok(
    body.indexOf("previous_turn.status<>'COMPLETED'") > body.indexOf('ORDER BY t.created_at DESC,t.id DESC LIMIT 1'),
    'usability is decided AFTER selection, so a FAILED predecessor is never skipped over',
  );
  assert.ok(body.includes('public.read_him_session_context_bindings_v1('), 'relevance revalidation delegates to the QHIA-006 authority');
  // Zero metric rereads and zero relevance reimplementation.
  for (const forbidden of [
    'him_metric_snapshots', 'him_measurement_events', 'him_measurement_observations',
    'him_current_structured_measurements', 'him_metric_definitions', 'him_canonical_model_bindings',
    'public.him_session_context_bindings', 'public.him_measurement_targets',
    'public.read_him_latest_measurement_v1', 'public.read_him_latest_measurement_core_v1',
    'public.read_him_contextual_current_intelligence_batch_v1', 'public.him_active_structured_binding_id',
    'OFFSET', 'LIMIT 2',
  ]) assert.ok(!body.includes(forbidden), `the foreground read never reaches ${forbidden}`);
});

test('0061 is narrow: no new table, index, trigger, policy, or history mutation', () => {
  assert.doesNotMatch(statements, /CREATE (?:OR REPLACE )?(?:MATERIALIZED )?VIEW|CREATE TABLE|CREATE INDEX|CREATE TRIGGER|CREATE POLICY/iu,
    '0061 creates no table, index, trigger, policy, or view');
  assert.doesNotMatch(statements, /DELETE\s+FROM|TRUNCATE|DROP\s+(?:TABLE|VIEW|FUNCTION|INDEX)|COPY\s+public\./iu,
    '0061 deletes, truncates and drops nothing');
  // The one preserved UPDATE is migration 0022's own generic completion body,
  // carried through byte-identically so no historical behaviour is silently
  // rewritten. No HIM, conversation, binding, or execution row is ever updated.
  assert.deepEqual(
    [...statements.matchAll(/UPDATE public\.([a-z_]+)/gu)].map((match) => match[1]),
    ['post_response_intelligence_effects'],
    '0061 updates nothing but the preserved generic effect-completion body',
  );
  assert.doesNotMatch(statements, /INSERT\s+INTO\s+public\.(?!post_response_intelligence_effects)/iu,
    '0061 writes into nothing but the durable effect ledger, and only from its own managed command');
  assert.doesNotMatch(statements, /set_config|request\.jwt/u, '0061 reconstructs and writes no request identity state');
  assert.doesNotMatch(statements, /EXECUTE\s+format|EXECUTE\s+'/iu, '0061 contains no dynamic SQL');
  assert.doesNotMatch(statements, /GRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)[^;]*ON\s+(?:TABLE\s+)?public\./iu,
    '0061 grants no direct table privilege to any role');
  assert.doesNotMatch(statements, /openai|anthropic|embedding|llm|model_router|rerank/iu,
    '0061 adds no provider, model, or embedding surface');
  // The exact new callable surface: this task's own functions and nothing else.
  const created = [...statements.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.([a-z0-9_]+)\(/gu)].map((match) => match[1]);
  assert.deepEqual([...created].sort(), [
    'background_read_him_brain_context_source_v1',
    'claim_post_response_intelligence_effect_v1',
    'complete_post_response_him_brain_context_materialization_v1',
    'complete_post_response_intelligence_effect_v1',
    'post_response_him_brain_context_result_valid_v1',
    'read_him_brain_context_for_turn_v1',
    'read_him_latest_measurement_core_v1',
    'read_him_latest_measurement_v1',
  ], '0061 creates or replaces exactly its own intended function set');
});

test('the 0061 verifier proves the frozen scenarios against real PostgreSQL and stays forward-safe', () => {
  for (const proof of [
    'read_him_latest_measurement_core_v1', 'read_him_latest_measurement_v1',
    'background_read_him_brain_context_source_v1', 'complete_post_response_him_brain_context_materialization_v1',
    'read_him_brain_context_for_turn_v1', 'set_him_session_context_binding_v1', 'clear_him_session_context_binding_v1',
    'read_him_contextual_current_intelligence_batch_v1', 'acquire_post_response_intelligence_execution_v1',
    'correct_hbs_consistency_measurement_v1', 'correct_hse_self_confidence_measurement',
  ]) assert.ok(verifier.includes(proof), `the verifier exercises ${proof}`);
  for (const scenario of [
    'must NOT fall back to an older event',
    'An intervening FAILED USER turn must end the read',
    'A COMPLETED predecessor with no durable materialization',
    'A replaced binding must drop every signal materialized against the old context',
    'A cleared binding must drop its materialized signal',
    'never a freshly reread metric',
    'No CLAIMED Brain Context row may exist anywhere',
    'must never overwrite the first durable result',
  ]) assert.ok(verifier.includes(scenario), `the verifier proves: ${scenario}`);
  // Forward safety: the verifier states no next-migration ceiling and freezes no
  // global inventory count.
  assert.doesNotMatch(verifier, /0062/u, 'the 0061 verifier asserts no next-migration ceiling');
  assert.doesNotMatch(verifier, /can never exist|must never exist/iu, 'the 0061 verifier states no permanent existence ceiling');
  assert.doesNotMatch(verifier, /\.(?:length|rowCount)\s*(?:,|!==|===|==|!=|<>)\s*17\b/u, 'the 0061 verifier freezes no global definition count');
});

test('the contract is wired into package scripts and CI after the QHIA-011 gate', () => {
  assert.equal(
    packageJson.scripts['verify:him-brain-context-bridge:integration'],
    'node --env-file-if-exists=.env database/verify-migration-0061.mjs',
  );
  const step = ci.indexOf('verify:him-brain-context-bridge:integration');
  assert.ok(step > 0, 'CI runs the migration 0061 verifier');
  assert.ok(step > ci.indexOf('verify:him-relationship-communication-foreground-consumption:integration'),
    'it runs after the QHIA-011 foreground verifier');
  assert.ok(step > ci.indexOf('Apply all migrations to fresh PostgreSQL'),
    'it runs after the fresh-PostgreSQL migration bootstrap');
});

test('the guard states no future ceiling and is independent of migration numbering', () => {
  const listing = readdirSync(new URL('migrations/', root)).filter((name) => name.endsWith('.sql'));
  assert.doesNotThrow(
    () => assertMigrationIdentity([...listing, '0062_a_future_migration.sql', '0099_a_much_later_migration.sql']),
    'future migrations are legal',
  );
  assert.throws(() => assertMigrationIdentity(listing.filter((name) => name !== MIGRATION)), /migration 0061 exists/u);
  assert.throws(() => assertMigrationIdentity([...listing, '0061_a_duplicate.sql']), /exactly one migration 0061/u);
});
