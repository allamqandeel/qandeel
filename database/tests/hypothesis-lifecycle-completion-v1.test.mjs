import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../migrations/0036_hypothesis_lifecycle_completion_v1.sql');
const generation = read('../migrations/0033_hypothesis_generation_atomicity_recovery_v1.sql');
const historical = read('../migrations/0005_hypothesis_runtime.sql');
const updateLoop = read('../migrations/0008_hypothesis_update_loop.sql');
const serverUpdate = read('../migrations/0032_server_authorized_hypothesis_update_invocation_v1.sql');
const autoUpdate = read('../migrations/0034_automatic_hypothesis_update_invocation_recovery_v1.sql');
const confidenceBatch = read('../migrations/0035_confidence_batch_reliability_v1.sql');
const verifier = read('../verify-migration-0036.mjs');
const lifecycleTs = read('../../apps/api/src/hypothesis/hypothesis-lifecycle.ts');
const repository = read('../../apps/api/src/hypothesis/hypothesis.repository.ts');
const service = read('../../apps/api/src/hypothesis/hypothesis.service.ts');
const dispatcher = read('../../apps/api/src/post-response-intelligence/post-response-intelligence-dispatcher.service.ts');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const STATUSES = ['CANDIDATE', 'ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK', 'REJECTED', 'RETIRED', 'REOPENED'];

test('0036 adds exactly the lifecycle policy, the immutable audit, the internal core and one authenticated wrapper', () => {
  assert.match(migration, /^BEGIN;/mu); assert.match(migration, /COMMIT;\s*$/u);
  const tables = [...migration.matchAll(/CREATE TABLE public\.(\w+)/gu)].map((m) => m[1]);
  assert.deepEqual(tables, ['hypothesis_lifecycle_transitions'], 'exactly one new table: no second ledger, no queue');
  const created = [...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(created, [
    'hypothesis_lifecycle_transition_allowed_v1',
    'persist_post_response_hypothesis_generation_v1',
    'transition_hypothesis_core_v1',
    'transition_hypothesis_v2',
  ], 'exactly the lifecycle policy, the replaced persistence command, the internal core and the v2 wrapper');
  // Forward-only: nothing dropped, truncated, backfilled or rewritten, and no
  // new column on an existing table.
  assert.doesNotMatch(migration, /DROP (?:TABLE|FUNCTION|COLUMN|CONSTRAINT|POLICY)|TRUNCATE|DELETE FROM|ADD COLUMN|CREATE SEQUENCE|CREATE TRIGGER/iu);
  const executable = migration.replace(/^\s*--.*$/gmu, '');
  assert.doesNotMatch(executable, /UPDATE public\.hypotheses SET (?!status=p_status)/u, 'no historical Hypothesis rewrite');
  assert.doesNotMatch(executable, /INSERT INTO public\.hypothesis_lifecycle_transitions[\s\S]{0,400}?SELECT[\s\S]{0,200}?FROM public\.hypotheses/u,
    'no lifecycle audit backfill from existing Hypothesis rows');
  // No new post-response effect key, no queue, no scheduler.
  assert.doesNotMatch(executable, /effect_key='(?!HYPOTHESIS_PERSISTENCE|CANDIDATE_PROVIDER')/u);
  assert.doesNotMatch(migration, /LIFECYCLE_BATCH|LIFECYCLE_QUEUE|pg_cron|CREATE EXTENSION/iu);
});

test('every explicit identifier 0036 introduces fits the PostgreSQL 63-byte identifier limit', () => {
  // PostgreSQL truncates an over-long identifier to NAMEDATALEN-1 with a NOTICE
  // rather than an error, so a too-long name silently creates a different object.
  const identifiers = [...migration.matchAll(/\b(?:TABLE|FUNCTION|CONSTRAINT|INDEX|POLICY)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gu)].map((m) => m[1]);
  assert.ok(identifiers.length > 0, 'identifiers were actually scanned');
  const oversized = [...new Set(identifiers)].filter((name) => Buffer.byteLength(name, 'utf8') > 63);
  assert.deepEqual(oversized, [], `identifiers exceed PostgreSQL's 63-byte limit: ${oversized.join(', ')}`);
});

test('the lifecycle policy primitive is the frozen canonical graph, pure and internal-only', () => {
  const policy = migration.slice(
    migration.indexOf('CREATE FUNCTION public.hypothesis_lifecycle_transition_allowed_v1'),
    migration.indexOf('ALTER FUNCTION public.hypothesis_lifecycle_transition_allowed_v1'),
  );
  assert.match(policy, /IMMUTABLE PARALLEL SAFE SET search_path=''/u);
  assert.match(policy, /IF p_from_status IS NULL OR p_to_status IS NULL THEN RETURN false/u, 'a NULL status is a hard false');
  assert.doesNotMatch(policy, /\b(?:SELECT|INSERT|UPDATE|DELETE)\b/u, 'the policy reads no table');
  assert.doesNotMatch(policy, /auth\.uid/u, 'the policy holds no caller-controlled authority');
  const edges = {
    CANDIDATE: ['ACTIVE'],
    ACTIVE: ['SUPPORTED', 'MIXED', 'WEAK', 'REJECTED', 'RETIRED'],
    SUPPORTED: ['MIXED', 'WEAK', 'REJECTED', 'RETIRED'],
    MIXED: ['SUPPORTED', 'WEAK', 'REJECTED', 'RETIRED'],
    WEAK: ['ACTIVE', 'MIXED', 'REJECTED', 'RETIRED'],
    REJECTED: ['REOPENED'],
    RETIRED: ['REOPENED'],
    REOPENED: ['ACTIVE'],
  };
  const parsed = {};
  for (const [, from, single, list] of policy.matchAll(
    /WHEN\s+'([A-Z_]+)'\s+THEN\s+p_to_status\s+(?:=\s+'([A-Z_]+)'|IN\s+\(([^)]*)\))/gu,
  )) parsed[from] = single ? [single] : (list ?? '').split(',').map((value) => value.trim().replace(/'/gu, ''));
  assert.deepEqual(parsed, edges, 'the database graph is exactly the frozen canonical graph');
  assert.deepEqual(Object.keys(parsed).sort(), [...STATUSES].sort(), 'every canonical status has an explicit rule');
  assert.doesNotMatch(migration, /CONFIRMED/u, 'no CONFIRMED status is introduced');
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.hypothesis_lifecycle_transition_allowed_v1\(text,text\) FROM PUBLIC,anon,authenticated,service_role;/u);
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.hypothesis_lifecycle_transition_allowed_v1/u);
});

test('the TypeScript mirror still states the identical frozen graph', () => {
  const parsed = {};
  for (const [, from, list] of lifecycleTs.matchAll(/([A-Z_]+):\s*\[([^\]]*)\]/gu)) {
    parsed[from] = list.split(',').map((value) => value.trim().replace(/'/gu, '')).filter(Boolean);
  }
  const policy = migration.slice(migration.indexOf('RETURN CASE p_from_status'), migration.indexOf('ELSE false'));
  for (const status of STATUSES) {
    assert.ok(parsed[status], `TypeScript graph is missing ${status}`);
    for (const target of parsed[status]) {
      assert.match(policy, new RegExp(`WHEN '${status}'[\\s\\S]{0,160}?'${target}'`, 'u'),
        `the database graph is missing the TypeScript edge ${status} -> ${target}`);
    }
  }
  assert.match(lifecycleTs, /CANDIDATE: \['ACTIVE'\]/u);
  assert.doesNotMatch(lifecycleTs, /CONFIRMED/u);
});

test('the lifecycle audit is immutable, owner-scoped, bounded and carries facts only', () => {
  const table = migration.slice(
    migration.indexOf('CREATE TABLE public.hypothesis_lifecycle_transitions'),
    migration.indexOf('CREATE INDEX hypothesis_lifecycle_transitions_history_idx'),
  );
  assert.match(table, /user_id uuid NOT NULL REFERENCES public\.users\(id\) ON DELETE RESTRICT/u);
  assert.match(table, /FOREIGN KEY \(hypothesis_id,user_id\)\s*\n?\s*REFERENCES public\.hypotheses\(id,user_id\) ON DELETE RESTRICT/u);
  assert.match(table, /CHECK \(before_version > 0 AND after_version = before_version \+ 1\)/u);
  assert.match(table, /CHECK \(public\.hypothesis_lifecycle_transition_allowed_v1\(before_status,after_status\)\)/u);
  assert.match(table, /CHECK \(source IN \('AUTHENTICATED_TRANSITION','SYSTEM_GENERATION_ACTIVATION'\)\)/u);
  for (const status of STATUSES) {
    assert.match(table, new RegExp(`before_status IN \\([^)]*'${status}'`, 'u'));
    assert.match(table, new RegExp(`after_status IN \\([^)]*'${status}'`, 'u'));
  }
  // Facts only: no narrative, no transcript, no provider payload, no hidden
  // reasoning, no arbitrary error or content column.
  const columns = [...table.matchAll(/^\s{2}(\w+) (?:uuid|text|integer|timestamptz)/gmu)].map((m) => m[1]);
  assert.deepEqual(columns, ['id', 'user_id', 'hypothesis_id', 'before_status', 'after_status', 'before_version', 'after_version', 'source', 'created_at']);
  assert.doesNotMatch(table, /rationale|reason|explanation|transcript|payload|jsonb|content|message|error|prompt|chain|thought|score|confidence/iu);
  // RLS on, owner-scoped read only, and no write grant for any application role.
  assert.match(migration, /ALTER TABLE public\.hypothesis_lifecycle_transitions ENABLE ROW LEVEL SECURITY;/u);
  assert.match(migration, /REVOKE ALL ON TABLE public\.hypothesis_lifecycle_transitions FROM PUBLIC,anon,authenticated,service_role;/u);
  assert.match(migration, /GRANT SELECT ON TABLE public\.hypothesis_lifecycle_transitions TO authenticated;/u);
  assert.doesNotMatch(migration, /GRANT (?:INSERT|UPDATE|DELETE|ALL)[^;]*ON TABLE public\.hypothesis_lifecycle_transitions/u);
  assert.match(migration, /CREATE POLICY hypothesis_lifecycle_transitions_select_own ON public\.hypothesis_lifecycle_transitions\s*\n\s*FOR SELECT TO authenticated USING \(user_id=\(SELECT auth\.uid\(\)\)\);/u);
  assert.equal((migration.match(/CREATE POLICY/gu) ?? []).length, 1, 'exactly one policy, and it is a read policy');
});

test('the internal transition core is exact-version, atomic, audited and reachable by no application role', () => {
  const core = migration.slice(
    migration.indexOf('CREATE FUNCTION public.transition_hypothesis_core_v1'),
    migration.indexOf('ALTER FUNCTION public.transition_hypothesis_core_v1'),
  );
  assert.match(core, /SECURITY DEFINER SET search_path=''/u);
  assert.match(core, /WHERE id=p_hypothesis_id AND user_id=p_user_id FOR UPDATE/u, 'owner-scoped row lock');
  assert.match(core, /IF current_hypothesis\.version <> p_expected_version THEN\s*\n?\s*RAISE EXCEPTION 'Stale hypothesis version\.' USING ERRCODE='40001'/u);
  assert.match(core, /public\.hypothesis_lifecycle_transition_allowed_v1\(current_hypothesis\.status, p_status\)/u);
  assert.match(core, /SET status=p_status, version=version\+1, updated_at=CURRENT_TIMESTAMP/u);
  assert.match(core, /WHERE id=current_hypothesis\.id AND user_id=p_user_id AND version=p_expected_version/u,
    'the UPDATE re-asserts the exact expected version');
  assert.match(core, /IF NOT FOUND THEN RAISE EXCEPTION 'Stale hypothesis version\.' USING ERRCODE='40001'/u);
  assert.match(core, /INSERT INTO public\.hypothesis_lifecycle_transitions\(/u, 'mutation and audit share one transaction');
  assert.ok(core.indexOf('UPDATE public.hypotheses') < core.indexOf('INSERT INTO public.hypothesis_lifecycle_transitions'));
  // The audit identity is generated in the database, so no caller can choose,
  // replay or collide one.
  assert.match(core, /pg_catalog\.gen_random_uuid\(\)/u);
  assert.doesNotMatch(core, /p_transition_id|p_before_|p_after_|p_created_at/u);
  // The core is not a generic Hypothesis mutation surface.
  assert.doesNotMatch(core, /statement=|scope=|origin=|assumptions=|supporting_evidence_ids=|contradicting_evidence_ids=|competing_hypothesis_ids=|user_id=p_user_id,/u);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.transition_hypothesis_core_v1\(uuid,uuid,integer,text,text\) FROM PUBLIC,anon,authenticated,service_role;/u);
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.transition_hypothesis_core_v1/u);
});

test('the authenticated wrapper derives the owner and forces the source', () => {
  const wrapper = migration.slice(
    migration.indexOf('CREATE FUNCTION public.transition_hypothesis_v2'),
    migration.indexOf('ALTER FUNCTION public.transition_hypothesis_v2'),
  );
  assert.match(wrapper, /CREATE FUNCTION public\.transition_hypothesis_v2\(\s*\n?\s*p_hypothesis_id uuid, p_expected_version integer, p_status text\s*\n?\) RETURNS SETOF public\.hypotheses/u);
  assert.match(wrapper, /canonical_user uuid := \(SELECT auth\.uid\(\)\)/u);
  assert.match(wrapper, /IF canonical_user IS NULL THEN RAISE EXCEPTION 'Authentication required\.' USING ERRCODE='42501'/u);
  assert.match(wrapper, /public\.transition_hypothesis_core_v1\(\s*\n?\s*canonical_user, p_hypothesis_id, p_expected_version, p_status, 'AUTHENTICATED_TRANSITION'\)/u);
  assert.doesNotMatch(wrapper, /p_user_id|p_source|p_before|p_after|p_transition_id/u);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.transition_hypothesis_v2\(uuid,integer,text\) FROM PUBLIC,anon,service_role;/u);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.transition_hypothesis_v2\(uuid,integer,text\) TO authenticated;/u);
});

test('the legacy transition RPC loses its application authority without being dropped', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.transition_hypothesis\(uuid,text\) FROM PUBLIC,anon,authenticated,service_role;/u);
  assert.doesNotMatch(migration, /DROP FUNCTION public\.transition_hypothesis/u, 'the historical object survives for provenance');
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.transition_hypothesis\(uuid,text\)/u,
    'no compatibility wrapper re-opens the bypass');
  // Migration 0005 stays historical source-of-truth text.
  assert.match(historical, /GRANT EXECUTE ON FUNCTION public\.transition_hypothesis\(uuid,text\)[^;]*TO authenticated;/u);
  assert.match(historical, /CREATE FUNCTION public\.transition_hypothesis\(p_hypothesis_id uuid, p_status text\)/u);
});

test('generated activation is the ONLY automatic transition and lands inside the atomic persistence command', () => {
  const persist = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.persist_post_response_hypothesis_generation_v1'));
  // The activation loop replays the durable generated-ID order and never
  // reconstructs targets from current Hypothesis rows.
  assert.match(persist, /FOREACH new_id IN ARRAY created_ids LOOP[\s\S]*?transition_hypothesis_core_v1\(\s*\n?\s*execution_row\.user_id, new_id, activation_version, 'ACTIVE', 'SYSTEM_GENERATION_ACTIVATION'\)/u);
  assert.equal((persist.match(/transition_hypothesis_core_v1/gu) ?? []).length, 1, 'exactly one activation call site');
  // Ordering: graph construction, then activation, then durable completion.
  assert.ok(persist.indexOf('background_link_competing_hypotheses_v1') < persist.indexOf('FOREACH new_id IN ARRAY created_ids LOOP'));
  assert.ok(persist.indexOf('FOREACH new_id IN ARRAY created_ids LOOP') < persist.indexOf("result_code='HYPOTHESES_PERSISTED'"));
  // The no-target path is untouched, so NO_ACCEPTED_CANDIDATES writes no audit.
  assert.match(persist, /result_code='NO_HYPOTHESES_PERSISTED'/u);
  assert.ok(persist.indexOf("result_code='NO_HYPOTHESES_PERSISTED'") < persist.indexOf('FOREACH new_id IN ARRAY created_ids LOOP'));
  // Every migration-0033 guarantee is preserved verbatim.
  for (const preserved of [
    'PERSISTENCE_CANDIDATE_UNAVAILABLE', 'HYPOTHESIS_PERSISTENCE_FAILED',
    'background_create_system_hypothesis_v1', 'background_attach_hypothesis_evidence_v1',
    'background_link_competing_hypotheses_v1', 'post_response_generation_candidates_valid_v1',
  ]) assert.match(persist, new RegExp(preserved, 'u'), `${preserved} was dropped from the persistence command`);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.persist_post_response_hypothesis_generation_v1\(uuid\) TO service_role;/u);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.persist_post_response_hypothesis_generation_v1\(uuid\) FROM PUBLIC,anon,authenticated;/u);
  // Migration 0033 remains untouched historical text.
  assert.match(generation, /CREATE FUNCTION public\.persist_post_response_hypothesis_generation_v1\(p_execution_id uuid\)/u);
  assert.doesNotMatch(generation, /transition_hypothesis_core_v1|SYSTEM_GENERATION_ACTIVATION/u);
});

test('no semantic Evidence or Confidence threshold is invented anywhere', () => {
  const executable = migration.replace(/^\s*--.*$/gmu, '');
  // The only literal status this migration ever asks the core to write is ACTIVE.
  const targets = [...executable.matchAll(/transition_hypothesis_core_v1\([^)]*'([A-Z_]+)',\s*'[A-Z_]+'\)/gu)].map((m) => m[1]);
  assert.deepEqual(targets, ['ACTIVE'], 'the only automatic transition target is ACTIVE');
  assert.deepEqual([...executable.matchAll(/SET\s+status\s*=\s*([^,\s]+)/gu)].map((m) => m[1]), ['p_status'],
    'the single status write assigns the requested status, never a rule-chosen literal');
  assert.doesNotMatch(executable, /confidence_evaluations|post_response_confidence_batch_items|numeric_score|confidence_band|calibration_state/iu);
  assert.doesNotMatch(executable, /(?:cardinality|array_length|count)\s*\(\s*(?:supporting_evidence_ids|contradicting_evidence_ids)/iu);
  // Nothing here turns the Hypothesis Update Loop into a lifecycle engine.
  assert.doesNotMatch(executable, /apply_hypothesis_evidence_update/u);
  assert.doesNotMatch(executable, /server_create_hypothesis_v1|background_create_confidence_evaluation_v1|execute_post_response_confidence_batch_v1/u);
  // Creation compatibility: no origin is auto-activated at creation time.
  assert.doesNotMatch(executable, /HUMAN_REVIEWED|USER_PROPOSED|ADMIN_CONTROLLED/u);
});

test('historical migrations 0005, 0008, 0032, 0034 and 0035 are untouched', () => {
  for (const [label, sql] of [
    ['0008', updateLoop], ['0032', serverUpdate], ['0034', autoUpdate], ['0035', confidenceBatch],
  ]) {
    assert.doesNotMatch(sql, /hypothesis_lifecycle_transitions|transition_hypothesis_v2|transition_hypothesis_core_v1|SYSTEM_GENERATION_ACTIVATION/u,
      `migration ${label} was edited`);
  }
  // The Update Loop still changes only Evidence arrays, version and timestamp.
  const update = updateLoop.match(/UPDATE public\.hypotheses SET[\s\S]*?RETURNING \* INTO updated_hypothesis/u)?.[0] ?? '';
  assert.doesNotMatch(update, /status=/u, 'Evidence attachment still never touches lifecycle status');
  // Migration 0035 still freezes the target version from the canonical
  // post-persistence Hypothesis row, so activation lands before that freeze.
  assert.match(confidenceBatch, /SELECT p_execution_id,entry\.ordinality::smallint,generated\.id,generated\.version/u);
});

test('the application uses the exact-version v2 boundary with a server-derived owner and source', () => {
  assert.match(repository, /'rpc\/transition_hypothesis_v2'/u);
  assert.doesNotMatch(repository, /'rpc\/transition_hypothesis'/u, 'the legacy RPC is no longer called');
  assert.match(repository, /p_hypothesis_id: id, p_expected_version: expectedVersion, p_status: status/u);
  // Scoped to the transition method: `p_user_id` legitimately appears in the
  // unchanged migration-0027 server creation call above it.
  const transition = repository.slice(repository.indexOf('async transition('), repository.indexOf('async attachEvidence('));
  for (const forbidden of ['p_user_id', 'p_source', 'p_transition_id', 'p_before_version', 'p_after_version']) {
    assert.doesNotMatch(transition, new RegExp(forbidden, 'u'), forbidden);
  }
  // The expected version comes from the owned current Hypothesis, and the
  // external service signature is unchanged.
  assert.match(service, /async transition\(userId: string, token: string, id: string, status: HypothesisStatus\): Promise<HypothesisRecord>/u);
  assert.match(service, /this\.repository\.transition\(token, id, current\.version, status\)/u);
  assert.match(service, /canTransitionHypothesis\(current\.status, status\)/u, 'early TypeScript validation is preserved');
  // Confidence still runs strictly after durable persistence; no dispatcher-side
  // lifecycle step was introduced.
  assert.ok(dispatcher.indexOf('persistHypothesisGeneration(execution.id)') < dispatcher.indexOf('this.confidenceBatch(execution,effects,acceptedHypothesisIds)'));
  assert.doesNotMatch(dispatcher, /transition_hypothesis|hypothesis_lifecycle_transitions|SYSTEM_GENERATION_ACTIVATION/u,
    'lifecycle activation stays inside the atomic database command');
});

test('the real PostgreSQL verifier is wired, secret-free and adversarial', () => {
  assert.match(packageJson, /"verify:hypothesis-lifecycle-completion:integration": "node --env-file-if-exists=\.env database\/verify-migration-0036\.mjs"/u);
  assert.match(workflow, /run: npm run verify:hypothesis-lifecycle-completion:integration/u);
  assert.ok(workflow.indexOf('verify:hypothesis-lifecycle-completion:integration') > workflow.indexOf('verify:confidence-batch-reliability:integration'));
  assert.ok(workflow.indexOf('verify:hypothesis-lifecycle-completion:integration') < workflow.indexOf('verify:post-response-dispatch:integration'));
  assert.match(verifier, /process\.env\.DATABASE_URL/u);
  assert.match(verifier, /SET LOCAL ROLE/u);
  assert.match(verifier, /request\.jwt\.claims/u);
  assert.match(verifier, /has_function_privilege/u);
  assert.match(verifier, /has_table_privilege/u);
  assert.match(verifier, /ROLLBACK/u);
  assert.doesNotMatch(verifier, /supabase\.co|postgres(?:ql)?:\/\//iu, 'no connection string or host is embedded');
  assert.doesNotMatch(verifier, /TRUNCATE public\.|DELETE FROM public\./u, 'the verifier repairs and deletes nothing');
  for (const proof of [
    'pre-0036', 'SYSTEM_GENERATION_ACTIVATION', 'AUTHENTICATED_TRANSITION',
    '40001', 'VERIFIER_ACTIVATION_ORDER_VIOLATION',
    'no lifecycle audit row survives the failed activation',
    'the upgrade fabricates no lifecycle audit history',
    'no historical CANDIDATE row is backfilled or reinterpreted',
  ]) assert.match(verifier, new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), `verifier is missing ${proof}`);
});
