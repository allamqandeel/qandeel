import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../migrations/0026_memory_authority_hardening_v1.sql', import.meta.url), 'utf8');

const CREATE = 'server_create_memory_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamptz)';
const DELETE_CMD = 'server_mark_memory_deleted_v1(uuid,uuid)';
const SUPERSEDE = 'server_supersede_memory_v1(uuid,uuid,uuid,text,text,text,double precision,double precision,text,timestamptz)';
const GUARD = 'assert_canonical_memory_shape_v1(text,text,text,double precision,double precision,text,timestamptz)';
const escape = (signature) => signature.replace(/[()]/gu, '\\$&');

test('removes direct memories mutation authority while preserving the owner read surface', () => {
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.memories FROM authenticated/iu);
  assert.match(migration, /REVOKE ALL ON TABLE public\.memories FROM PUBLIC, anon/iu);
  assert.match(migration, /GRANT SELECT ON TABLE public\.memories TO authenticated/iu);
  // The server REST role keeps the background read path but loses direct write,
  // so possession of the privileged API role is not table-mutation authority.
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.memories FROM service_role/iu);
  assert.match(migration, /GRANT SELECT ON TABLE public\.memories TO service_role/iu);
  // No INSERT/UPDATE/DELETE is re-granted on the table to any role, and no
  // physical DELETE authority is introduced anywhere.
  assert.doesNotMatch(migration, /GRANT[^;]*\b(?:INSERT|UPDATE|DELETE)\b[^;]*ON TABLE public\.memories/iu);
  assert.doesNotMatch(migration, /DELETE FROM public\.memories/iu);
  assert.doesNotMatch(migration, /DISABLE ROW LEVEL SECURITY/iu);
});

test('drops the superseded write policies and keeps the owner-scoped read policy', () => {
  assert.match(migration, /DROP POLICY IF EXISTS memories_insert_own ON public\.memories/iu);
  assert.match(migration, /DROP POLICY IF EXISTS memories_update_own ON public\.memories/iu);
  assert.doesNotMatch(migration, /CREATE POLICY memories_(?:insert|update)_own/iu);
  assert.doesNotMatch(migration, /DROP POLICY[^;]*memories_select_own/iu);
});

test('closes the legacy generic supersede_memory RPC for every application role', () => {
  // service_role is named explicitly: a Supabase installation may carry an
  // explicit or default EXECUTE grant for the server REST role, so the contract
  // must not depend on the starting ACL state.
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.supersede_memory\(uuid, uuid, text, text, text, double precision, double precision, text, timestamptz\)\s*\n?\s*FROM PUBLIC, anon, authenticated, service_role;/iu,
  );
  // It is re-granted to nobody, so no role recreates the generic bypass, and
  // the historical definition is neither dropped nor rewritten.
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.supersede_memory/iu);
  assert.doesNotMatch(migration, /(?:DROP|CREATE OR REPLACE) FUNCTION public\.supersede_memory/iu);
});

test('adds exactly the three narrow server-only Memory mutation commands', () => {
  const created = [...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map((match) => match[1]);
  assert.deepEqual(created.sort(), [
    'assert_canonical_memory_shape_v1',
    'server_create_memory_v1',
    'server_mark_memory_deleted_v1',
    'server_supersede_memory_v1',
  ]);
  // No broad "update arbitrary columns" RPC is introduced.
  assert.doesNotMatch(migration, /CREATE FUNCTION public\.\w*update_memory/iu);
  assert.doesNotMatch(migration, /p_(?:column|field|patch|updates|payload|json)\b/iu);
});

test('keeps every privileged command SECURITY DEFINER with a fixed search_path', () => {
  for (const name of ['server_create_memory_v1', 'server_mark_memory_deleted_v1', 'server_supersede_memory_v1']) {
    assert.match(
      migration,
      new RegExp(`CREATE FUNCTION public\\.${name}\\([\\s\\S]*?LANGUAGE plpgsql SECURITY DEFINER SET search_path=''`, 'u'),
      `${name} definer posture`,
    );
  }
  // The shape guard mutates nothing and is deliberately not SECURITY DEFINER.
  assert.match(migration, /CREATE FUNCTION public\.assert_canonical_memory_shape_v1\([\s\S]*?LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''/u);
  assert.equal((migration.match(/SET search_path=''/gu) ?? []).length, 4);
});

test('forces every server-owned column and validates the owner on creation', () => {
  const create = migration.slice(migration.indexOf('CREATE FUNCTION public.server_create_memory_v1'));
  // Owner must be a real, non-null user; malformed identity fails closed.
  assert.match(create, /p_user_id IS NULL OR p_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_IDENTITY'/u);
  assert.match(create, /NOT EXISTS\(SELECT 1 FROM public\.users u WHERE u\.id=p_user_id\) THEN RAISE EXCEPTION 'FORBIDDEN'/u);
  // scope, version, lineage and both timestamps are derived, never caller-supplied.
  assert.match(create, /VALUES \(\s*p_memory_id, p_user_id, 'USER', p_type, btrim\(p_content\), p_source, p_confidence, p_importance, p_status,\s*1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, p_expires_at, NULL\s*\)/u);
  assert.doesNotMatch(create, /p_version|p_scope|p_created_at|p_updated_at|p_supersedes/u);
});

test('enforces the canonical vocabulary and bounds in the shared shape guard', () => {
  const guard = migration.slice(
    migration.indexOf('CREATE FUNCTION public.assert_canonical_memory_shape_v1'),
    migration.indexOf('CREATE FUNCTION public.server_create_memory_v1'),
  );
  for (const value of [
    'STABLE_PREFERENCE', 'PERSONAL_FACT', 'GOAL', 'DECISION_COMMITMENT', 'RELATIONSHIP_CONTEXT',
    'INTERACTION_PREFERENCE', 'TEMPORARY_STATE', 'DERIVED_INSIGHT', 'USER_STATED', 'USER_CONFIRMED',
    'SYSTEM_DERIVED', 'IMPORTED', 'ADMIN_CONTROLLED', 'ACTIVE', 'SUPERSEDED', 'EXPIRED', 'DELETED',
    'DISABLED', 'PENDING_CONFIRMATION',
  ]) assert.match(guard, new RegExp(`'${value}'`, 'u'), `guard covers ${value}`);
  assert.match(guard, /p_source='SYSTEM_DERIVED' AND p_status='ACTIVE'/u);
  assert.match(guard, /NOT \(p_confidence BETWEEN 0 AND 1\) OR NOT \(p_importance BETWEEN 0 AND 1\)/u);
  assert.match(guard, /p_expires_at <= CURRENT_TIMESTAMP/u);
});

test('keeps deletion a status-only transition over any owned row, unchanged from the pre-hardening semantics', () => {
  const remove = migration.slice(
    migration.indexOf('CREATE FUNCTION public.server_mark_memory_deleted_v1'),
    migration.indexOf('CREATE FUNCTION public.server_supersede_memory_v1'),
  );
  // Ownership is the only predicate: the target lookup must not narrow the
  // legitimate internal behaviour by filtering on the current lifecycle status.
  assert.match(remove, /WHERE m\.id=p_memory_id AND m\.user_id=p_user_id\s*\n?\s*FOR UPDATE/u);
  assert.doesNotMatch(remove, /m\.status\s*(?:IN|=|<>|!=)/u);
  // Only status and updated_at move; no provenance, scoring, version or lineage.
  const setClause = remove.match(/UPDATE public\.memories m SET ([\s\S]*?)\s+WHERE /u);
  assert.ok(setClause, 'deletion performs one scoped UPDATE');
  assert.equal(setClause[1].replace(/\s+/gu, ' ').trim(), "status='DELETED', updated_at=CURRENT_TIMESTAMP");
});

test('keeps supersession atomic, owner-bound, and lineage preserving', () => {
  const supersede = migration.slice(migration.indexOf('CREATE FUNCTION public.server_supersede_memory_v1'));
  assert.match(supersede, /p_old_memory_id = p_new_memory_id THEN\s*\n?\s*RAISE EXCEPTION 'A memory cannot supersede itself\.'/u);
  assert.match(supersede, /m\.id=p_old_memory_id AND m\.user_id=p_user_id AND m\.status='ACTIVE'\s*\n?\s*FOR UPDATE/u);
  // Successor inherits owner and scope from the predecessor: no ownership transfer.
  assert.match(supersede, /p_new_memory_id, predecessor\.user_id, predecessor\.scope,/u);
  assert.match(supersede, /predecessor\.version \+ 1/u);
  assert.match(supersede, /p_expires_at, predecessor\.id/u);
  // Successor insert and predecessor transition are in the same function body.
  assert.match(supersede, /INSERT INTO public\.memories\([\s\S]*?UPDATE public\.memories m SET status='SUPERSEDED'/u);
});

test('grants server-only execution to the server role and to no end-user role', () => {
  for (const signature of [CREATE, DELETE_CMD, SUPERSEDE, GUARD]) {
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
    new RegExp(`GRANT EXECUTE ON FUNCTION\\s*\\n\\s*public\\.${escape(CREATE)},\\s*\\n\\s*public\\.${escape(DELETE_CMD)},\\s*\\n\\s*public\\.${escape(SUPERSEDE)}\\s*\\n\\s*TO service_role`, 'u'),
  );
  // The shape guard is granted to nobody at all.
  assert.doesNotMatch(migration, new RegExp(`GRANT EXECUTE ON FUNCTION[^;]*assert_canonical_memory_shape_v1`, 'u'));
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION[^;]*TO (?:PUBLIC|anon|authenticated)/iu);
});

test('does not rewrite Memory history or reinterpret provenance', () => {
  // Outside the new command bodies the migration only moves privileges: it
  // issues no DML against existing rows and no table surgery.
  const outsideFunctionBodies = migration.replace(/\$\$[\s\S]*?\$\$/gu, '<<body>>');
  assert.doesNotMatch(outsideFunctionBodies, /\b(?:UPDATE|INSERT INTO|DELETE FROM)\s+public\.memories/iu);
  assert.doesNotMatch(migration, /ALTER TABLE public\.memories/iu);
  assert.doesNotMatch(migration, /DROP (?:TABLE|CONSTRAINT|COLUMN)/iu);
});

test('provides a secret-free real PostgreSQL adversarial verifier', async () => {
  const verifier = await readFile(new URL('../verify-migration-0026.mjs', import.meta.url), 'utf8');
  assert.match(verifier, /process\.env\.DATABASE_URL/u);
  assert.match(verifier, /SET LOCAL ROLE/iu);
  assert.match(verifier, /request\.jwt\.claims/u);
  assert.match(verifier, /has_table_privilege/u);
  assert.match(verifier, /has_function_privilege/u);
  assert.match(verifier, /ROLLBACK/u);
  assert.doesNotMatch(verifier, /supabase\.co|postgres(?:ql)?:\/\//iu);
});

test('wires the background Memory write and the repository to the narrow server command', async () => {
  const background = await readFile(
    new URL('../../apps/api/src/background-intelligence/background-intelligence-data-api.service.ts', import.meta.url),
    'utf8',
  );
  assert.match(background, /rpc\/server_create_memory_v1/u);
  assert.match(background, /p_user_id: context\.userId/u);
  // No direct Memory table write survives on the background path.
  assert.doesNotMatch(background, /this\.request<MemoryRecord\[\]>\('memories'/u);

  const repository = await readFile(new URL('../../apps/api/src/memory/memory.repository.ts', import.meta.url), 'utf8');
  for (const command of ['server_create_memory_v1', 'server_mark_memory_deleted_v1', 'server_supersede_memory_v1']) {
    assert.match(repository, new RegExp(`serverAuthority\\.rpc<MemoryRecord\\[\\]>\\('${command}'`, 'u'), command);
  }
  // Every authenticated (user-token) call is a plain owner-scoped read.
  assert.doesNotMatch(repository, /dataApi\.request[\s\S]{0,400}?method: '(?:POST|PATCH|PUT|DELETE)'/u);
  assert.doesNotMatch(repository, /rpc\/supersede_memory/u);
});
