import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../migrations/0030_conversation_session_authority_hardening_v1.sql', import.meta.url), 'utf8');
const migration0002 = await readFile(new URL('../migrations/0002_supabase_auth_identity_rls.sql', import.meta.url), 'utf8');
const migration0025 = await readFile(new URL('../migrations/0025_conversation_authority_hardening_v1.sql', import.meta.url), 'utf8');
const repository = await readFile(new URL('../../apps/api/src/conversation/conversation.repository.ts', import.meta.url), 'utf8');

test('removes direct conversation_sessions mutation authority while preserving read access', () => {
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.conversation_sessions FROM authenticated/i);
  assert.match(migration, /REVOKE ALL ON TABLE public\.conversation_sessions FROM PUBLIC, anon/i);
  assert.match(migration, /GRANT SELECT ON TABLE public\.conversation_sessions TO authenticated/i);
  // The server REST role loses direct DML but keeps SELECT for the background read path.
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.conversation_sessions FROM service_role/i);
  assert.match(migration, /GRANT SELECT ON TABLE public\.conversation_sessions TO service_role/i);
  // No direct INSERT/UPDATE/DELETE is re-granted on the table to any role.
  assert.doesNotMatch(migration, /GRANT[^;]*\b(?:INSERT|UPDATE|DELETE)\b[^;]*ON TABLE public\.conversation_sessions/i);
});

test('drops the obsolete permissive write policies and introduces no replacement write or delete policy', () => {
  assert.match(migration, /DROP POLICY IF EXISTS conversation_sessions_insert_own ON public\.conversation_sessions/i);
  assert.match(migration, /DROP POLICY IF EXISTS conversation_sessions_update_own ON public\.conversation_sessions/i);
  assert.doesNotMatch(migration, /CREATE POLICY/i);
  assert.doesNotMatch(migration, /DROP POLICY[^;]*conversation_sessions_select_own/i);
  assert.doesNotMatch(migration, /DISABLE ROW LEVEL SECURITY/i);
});

test('exposes one narrow session-creation command whose only parameter is the session UUID', () => {
  assert.match(migration, /CREATE FUNCTION public\.create_conversation_session_v1\(p_id uuid\)/i);
  // No caller-selectable owner, lifecycle, channel, timestamp, or JSON input
  // anywhere in the command definition itself.
  const [sessionFunction] = migration.match(/CREATE FUNCTION public\.create_conversation_session_v1[\s\S]*?END;\$\$;/i) ?? [];
  assert.ok(sessionFunction, 'session-creation function definition present');
  assert.doesNotMatch(sessionFunction, /p_user_id|p_status|p_channel|p_created_at|p_updated_at|p_last_activity_at|p_closed_at|jsonb/i);
  // Identity is derived from auth.uid(); the canonical user must exist.
  assert.match(migration, /DECLARE u uuid := auth\.uid\(\)/i);
  assert.match(migration, /SELECT 1 FROM public\.users usr WHERE usr\.id=u/i);
  // The insert forces ACTIVE/TEXT, database timestamps, and NULL closed_at.
  assert.match(migration, /VALUES\(p_id,u,'ACTIVE','TEXT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL\)/i);
  assert.match(migration, /CREATE FUNCTION public\.create_conversation_session_v1[\s\S]*?SECURITY DEFINER SET search_path=''/i);
});

test('scopes session-creation execution to authenticated only with explicit postgres ownership', () => {
  assert.match(migration, /ALTER FUNCTION public\.create_conversation_session_v1\(uuid\) OWNER TO postgres/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.create_conversation_session_v1\(uuid\) FROM PUBLIC,anon,authenticated/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.create_conversation_session_v1\(uuid\) TO authenticated/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.create_conversation_session_v1\(uuid\) FROM service_role/i);
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.create_conversation_session_v1[^;]*TO (?:service_role|anon|PUBLIC)/i);
});

test('hardens user-turn admission to owned ACTIVE/TEXT parents without changing the Finding-02 contract', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.create_user_conversation_turn\(\s*p_id uuid, p_session_id uuid, p_content text, p_idempotency_key text DEFAULT NULL/i);
  // Ownership is checked first on the owned row alone, then lifecycle/channel.
  assert.match(migration, /WHERE s\.id=p_session_id AND s\.user_id=u/i);
  assert.match(migration, /session_row\.status<>'ACTIVE' OR session_row\.channel<>'TEXT'/i);
  assert.match(migration, /SESSION_NOT_ACTIVE_TEXT' USING ERRCODE='55000'/i);
  // The canonical forced USER/RECEIVED shape and validations survive verbatim.
  assert.match(migration, /VALUES\(p_id,p_session_id,u,'USER','RECEIVED',p_content,NULL,NULL,NULL,p_idempotency_key,NULL\)/i);
  assert.match(migration, /length\(p_content\)>20000/i);
  assert.match(migration, /length\(p_idempotency_key\)<1 OR length\(p_idempotency_key\)>128/i);
  assert.match(migration, /ALTER FUNCTION public\.create_user_conversation_turn\(uuid,uuid,text,text\) OWNER TO postgres/i);
  // No session mutation happens inside turn admission: rejection has no side effect.
  assert.doesNotMatch(migration, /UPDATE public\.conversation_sessions/i);
});

test('invents no session lifecycle command or endpoint surface', () => {
  assert.doesNotMatch(migration, /close_session|reopen_session|expire_session|set_channel|update_session|last_activity_at\s*=/i);
});

test('rewrites no historical session data and edits no historical migration', () => {
  // Forward-only: the new migration performs no data rewrite on sessions.
  assert.doesNotMatch(migration, /UPDATE public\.conversation_sessions|DELETE FROM public\.conversation_sessions|TRUNCATE/i);
  // Historical migration texts remain intact (0002 still carries its original
  // permissive grant/policies; 0025 still carries its original admission).
  assert.match(migration0002, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.conversation_sessions TO authenticated/i);
  assert.match(migration0002, /CREATE POLICY conversation_sessions_insert_own/i);
  assert.match(migration0002, /CREATE POLICY conversation_sessions_update_own/i);
  assert.match(migration0025, /CREATE FUNCTION public\.create_user_conversation_turn/i);
  assert.doesNotMatch(migration0025, /SESSION_NOT_ACTIVE_TEXT/i);
});

test('application session creation uses the narrow RPC and serializes only the generated UUID', () => {
  assert.match(repository, /rpc\/create_conversation_session_v1/);
  assert.match(repository, /JSON\.stringify\(\{ p_id: id \}\)/);
  // The repository never POSTs the session table directly and never serializes
  // owner/status/channel/timestamps as mutation authority.
  assert.doesNotMatch(repository, /'conversation_sessions',\s*\{\s*method: 'POST'/);
  assert.doesNotMatch(repository, /user_id: userId, status: 'ACTIVE', channel: 'TEXT'/);
});
