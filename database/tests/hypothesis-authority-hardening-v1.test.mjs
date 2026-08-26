import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../migrations/0027_hypothesis_authority_hardening_v1.sql', import.meta.url), 'utf8');

const CREATE = 'server_create_hypothesis_v1(uuid,uuid,text,text,text,text,text,text[],text[])';
const GUARD = 'assert_canonical_hypothesis_text_array_v1(text[],integer,integer)';
const escape = (signature) => signature.replace(/[()[\]]/gu, '\\$&');

test('removes direct hypotheses mutation authority while preserving the owner read surface', () => {
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.hypotheses FROM authenticated/iu);
  assert.match(migration, /REVOKE ALL ON TABLE public\.hypotheses FROM PUBLIC, anon/iu);
  assert.match(migration, /GRANT SELECT ON TABLE public\.hypotheses TO authenticated/iu);
  // The server REST role keeps the background intelligence read path but loses
  // direct write, so possession of the privileged API role is not
  // table-mutation authority.
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.hypotheses FROM service_role/iu);
  assert.match(migration, /GRANT SELECT ON TABLE public\.hypotheses TO service_role/iu);
  // No INSERT/UPDATE/DELETE is re-granted on the table to any role.
  assert.doesNotMatch(migration, /GRANT[^;]*\b(?:INSERT|UPDATE|DELETE)\b[^;]*ON TABLE public\.hypotheses/iu);
  assert.doesNotMatch(migration, /DISABLE ROW LEVEL SECURITY/iu);
});

test('drops the superseded INSERT policy and keeps the owner-scoped read policy', () => {
  assert.match(migration, /DROP POLICY IF EXISTS hypotheses_insert_own ON public\.hypotheses/iu);
  assert.doesNotMatch(migration, /CREATE POLICY hypotheses_insert_own/iu);
  assert.doesNotMatch(migration, /DROP POLICY[^;]*hypotheses_select_own/iu);
});

test('adds exactly one narrow server-only creation command plus its pure shape guard', () => {
  const created = [...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map((match) => match[1]);
  assert.deepEqual(created.sort(), [
    'assert_canonical_hypothesis_text_array_v1',
    'server_create_hypothesis_v1',
  ]);
  // No broad "update arbitrary columns" or generic CRUD RPC is introduced.
  assert.doesNotMatch(migration, /CREATE FUNCTION public\.\w*(?:update|delete|upsert)_hypothes/iu);
  assert.doesNotMatch(migration, /p_(?:column|field|patch|updates|payload|json)\b/iu);
});

test('keeps the creation command SECURITY DEFINER with a fixed search_path', () => {
  assert.match(
    migration,
    /CREATE FUNCTION public\.server_create_hypothesis_v1\([\s\S]*?LANGUAGE plpgsql SECURITY DEFINER SET search_path=''/u,
  );
  // The shape guard reads no rows and is deliberately not SECURITY DEFINER.
  assert.match(migration, /CREATE FUNCTION public\.assert_canonical_hypothesis_text_array_v1\([\s\S]*?LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=''/u);
  assert.equal((migration.match(/SET search_path=''/gu) ?? []).length, 2);
});

test('accepts only the values a legitimate internal creation may choose', () => {
  const signature = migration.slice(
    migration.indexOf('CREATE FUNCTION public.server_create_hypothesis_v1'),
    migration.indexOf('RETURNS SETOF public.hypotheses', migration.indexOf('CREATE FUNCTION public.server_create_hypothesis_v1')),
  );
  assert.deepEqual([...signature.matchAll(/\bp_\w+/gu)].map((match) => match[0]), [
    'p_user_id', 'p_hypothesis_id', 'p_statement', 'p_type', 'p_domain',
    'p_scope', 'p_origin', 'p_assumptions', 'p_disconfirming_conditions',
  ]);
  // There is no parameter capable of setting status, version, Evidence,
  // competitors or timestamps.
  assert.doesNotMatch(migration, /p_(?:status|version|supporting|contradicting|competing|evidence|created_at|updated_at)\b/iu);
});

test('forces every authoritative column and validates the owner on creation', () => {
  const create = migration.slice(migration.indexOf('CREATE FUNCTION public.server_create_hypothesis_v1'));
  assert.match(create, /p_user_id IS NULL OR p_hypothesis_id IS NULL THEN\s*\n?\s*RAISE EXCEPTION 'INVALID_HYPOTHESIS_IDENTITY'/u);
  assert.match(create, /NOT EXISTS\(SELECT 1 FROM public\.users u WHERE u\.id=p_user_id\) THEN\s*\n?\s*RAISE EXCEPTION 'FORBIDDEN'/u);
  // status, version, both Evidence lists, competitors and both timestamps are
  // derived here, never caller-supplied.
  assert.match(
    create,
    /VALUES \(\s*p_hypothesis_id, p_user_id, canonical_statement, p_type, p_domain, canonical_scope, p_origin, 'CANDIDATE', 1,\s*'\{\}', '\{\}', '\{\}',[\s\S]*?CURRENT_TIMESTAMP, CURRENT_TIMESTAMP\s*\)/u,
  );
  // The supplied canonical UUID is stored verbatim and no ownership transfer
  // path exists: the command only ever inserts.
  assert.doesNotMatch(create, /UPDATE public\.hypotheses|DELETE FROM public\.hypotheses/iu);
});

test('enforces the canonical Hypothesis vocabulary and bounds inside the command', () => {
  const create = migration.slice(migration.indexOf('CREATE FUNCTION public.server_create_hypothesis_v1'));
  for (const value of [
    'CAUSAL', 'BEHAVIORAL', 'MOTIVATIONAL', 'SITUATIONAL', 'RELATIONAL', 'DECISION', 'PREDICTIVE',
    'INTERPRETIVE', 'STRATEGIC', 'GENERAL', 'RELATIONSHIP', 'WORK', 'GOAL', 'INTERACTION',
    'SYSTEM_GENERATED', 'HUMAN_REVIEWED', 'USER_PROPOSED', 'ADMIN_CONTROLLED',
  ]) assert.match(create, new RegExp(`'${value}'`, 'u'), `command covers ${value}`);
  assert.match(create, /length\(canonical_statement\) = 0 OR length\(canonical_statement\) > 2000/u);
  assert.match(create, /length\(canonical_scope\) = 0 OR length\(canonical_scope\) > 500/u);
  assert.equal((create.match(/assert_canonical_hypothesis_text_array_v1\(p_\w+, 8, 500\)/gu) ?? []).length, 2);
  const guard = migration.slice(
    migration.indexOf('CREATE FUNCTION public.assert_canonical_hypothesis_text_array_v1'),
    migration.indexOf('CREATE FUNCTION public.server_create_hypothesis_v1'),
  );
  assert.match(guard, /p_values IS NULL OR array_ndims\(p_values\) > 1/u);
  assert.match(guard, /cardinality\(p_values\) > p_max_count/u);
  assert.match(guard, /length\(item\) = 0 OR length\(item\) > p_max_length/u);
  assert.match(guard, /item = ANY\(canonical\)/u);
});

test('grants server-only execution to the server role and to no end-user role', () => {
  for (const signature of [CREATE, GUARD]) {
    assert.match(
      migration,
      new RegExp(`REVOKE ALL ON FUNCTION public\\.${escape(signature)} FROM PUBLIC,anon,authenticated`, 'u'),
      `${signature} revoked from end-user roles`,
    );
    assert.match(
      migration,
      new RegExp(`ALTER FUNCTION public\\.${escape(signature)} OWNER TO postgres`, 'u'),
      `${signature} ownership`,
    );
  }
  assert.match(
    migration,
    new RegExp(`GRANT EXECUTE ON FUNCTION\\s*\\n\\s*public\\.${escape(CREATE)}\\s*\\n\\s*TO service_role`, 'u'),
  );
  // The pure shape guard is granted to nobody at all.
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION[^;]*assert_canonical_hypothesis_text_array_v1/u);
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION[^;]*TO (?:PUBLIC|anon|authenticated)/iu);
});

test('leaves the existing constrained Hypothesis commands and Hypothesis history untouched', () => {
  for (const name of [
    'transition_hypothesis', 'attach_hypothesis_evidence', 'link_competing_hypotheses',
    'apply_hypothesis_evidence_update', 'background_create_system_hypothesis_v1',
    'background_attach_hypothesis_evidence_v1', 'background_link_competing_hypotheses_v1',
    'bounded_nonempty_text_array',
  ]) {
    assert.doesNotMatch(migration, new RegExp(`(?:CREATE|DROP|CREATE OR REPLACE|ALTER) FUNCTION public\\.${name}`, 'u'), name);
    assert.doesNotMatch(migration, new RegExp(`(?:GRANT|REVOKE)[^;]*FUNCTION public\\.${name}`, 'u'), `${name} ACL`);
  }
  // Outside the new function bodies the migration only moves privileges: no DML
  // against existing rows and no table surgery.
  const outsideFunctionBodies = migration.replace(/\$\$[\s\S]*?\$\$/gu, '<<body>>');
  assert.doesNotMatch(outsideFunctionBodies, /\b(?:UPDATE|INSERT INTO|DELETE FROM)\s+public\.hypotheses/iu);
  assert.doesNotMatch(migration, /ALTER TABLE public\.hypotheses/iu);
  assert.doesNotMatch(migration, /DROP (?:TABLE|CONSTRAINT|COLUMN)/iu);
});

test('keeps migration 0005 as untouched historical source-of-truth text', async () => {
  const historical = await readFile(new URL('../migrations/0005_hypothesis_runtime.sql', import.meta.url), 'utf8');
  // The historical vulnerability is not erased from history; the forward
  // migration establishes the hardened effective state instead.
  assert.match(historical, /GRANT SELECT, INSERT ON TABLE public\.hypotheses TO authenticated/u);
  assert.match(historical, /CREATE POLICY hypotheses_insert_own ON public\.hypotheses/u);
});

test('provides a secret-free real PostgreSQL adversarial verifier', async () => {
  const verifier = await readFile(new URL('../verify-migration-0027.mjs', import.meta.url), 'utf8');
  assert.match(verifier, /process\.env\.DATABASE_URL/u);
  assert.match(verifier, /SET LOCAL ROLE/iu);
  assert.match(verifier, /request\.jwt\.claims/u);
  assert.match(verifier, /has_table_privilege/u);
  assert.match(verifier, /has_function_privilege/u);
  assert.match(verifier, /ROLLBACK/u);
  assert.doesNotMatch(verifier, /supabase\.co|postgres(?:ql)?:\/\//iu);
});

test('wires the Hypothesis creation path to the narrow server command and no user token', async () => {
  const repository = await readFile(new URL('../../apps/api/src/hypothesis/hypothesis.repository.ts', import.meta.url), 'utf8');
  assert.match(repository, /serverAuthority\.rpc<HypothesisRecord\[\]>\('server_create_hypothesis_v1'/u);
  // The direct authenticated table POST is gone; every user-token call is a
  // plain owner-scoped read or a pre-existing constrained RPC.
  assert.doesNotMatch(repository, /dataApi\.request<[^>]*>\(token, 'hypotheses'/u);
  // The creation call submits no authority column. `p_status` still appears in
  // the unchanged transition RPC below it, so the check is scoped to create.
  const create = repository.slice(repository.indexOf('async create('), repository.indexOf('async find('));
  assert.match(create, /server_create_hypothesis_v1/u);
  for (const forbidden of [
    'p_status', 'p_version', 'p_supporting_evidence_ids', 'p_contradicting_evidence_ids',
    'p_competing_hypothesis_ids', 'p_created_at', 'p_updated_at',
  ]) assert.doesNotMatch(create, new RegExp(forbidden, 'u'), forbidden);

  const adapter = await readFile(new URL('../../apps/api/src/hypothesis/hypothesis-service-role-api.service.ts', import.meta.url), 'utf8');
  assert.match(adapter, /SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(adapter, /ServiceUnavailableException/u);
  // No caller access token is accepted, forwarded, or reconstructed.
  assert.doesNotMatch(adapter.replace(/\/\/[^\n]*/gu, ''), /accessToken|SUPABASE_PUBLISHABLE_KEY|jwt/iu);

  const service = await readFile(new URL('../../apps/api/src/hypothesis/hypothesis.service.ts', import.meta.url), 'utf8');
  assert.match(service, /async create\(userId: string, input: CreateHypothesisInput\)/u);

  // The migration-0021 background creation path is unchanged and stays
  // service-role only.
  const background = await readFile(
    new URL('../../apps/api/src/background-intelligence/background-intelligence-data-api.service.ts', import.meta.url),
    'utf8',
  );
  assert.match(background, /rpc\/background_create_system_hypothesis_v1/u);
  assert.doesNotMatch(background, /this\.request<HypothesisRecord\[\]>\('hypotheses'/u);

  // No public Hypothesis controller exists.
  const controllers = await readFile(new URL('../../apps/api/src/conversation/conversation.controller.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(controllers, /ypothes/u);
});
