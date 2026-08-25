import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../migrations/0025_conversation_authority_hardening_v1.sql', import.meta.url), 'utf8');

test('removes direct conversation_turns mutation authority while preserving read access', () => {
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.conversation_turns FROM authenticated/i);
  assert.match(migration, /REVOKE ALL ON TABLE public\.conversation_turns FROM PUBLIC, anon/i);
  // The server REST role loses direct write but keeps SELECT for the background read path.
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.conversation_turns FROM service_role/i);
  assert.match(migration, /GRANT SELECT ON TABLE public\.conversation_turns TO service_role/i);
  assert.match(migration, /GRANT SELECT ON TABLE public\.conversation_turns TO authenticated/i);
  // No direct INSERT/UPDATE/DELETE is re-granted on the table to any role.
  assert.doesNotMatch(migration, /GRANT[^;]*\b(?:INSERT|UPDATE|DELETE)\b[^;]*ON TABLE public\.conversation_turns/i);
});

test('drops the obsolete permissive write policies so drift cannot reactivate them', () => {
  assert.match(migration, /DROP POLICY IF EXISTS conversation_turns_insert_own ON public\.conversation_turns/i);
  assert.match(migration, /DROP POLICY IF EXISTS conversation_turns_update_own ON public\.conversation_turns/i);
  assert.doesNotMatch(migration, /CREATE POLICY conversation_turns_(?:insert|update)_own/i);
});

test('exposes a narrow authenticated user-turn command that forces the canonical server shape', () => {
  assert.match(migration, /CREATE FUNCTION public\.create_user_conversation_turn\(\s*p_id uuid, p_session_id uuid, p_content text, p_idempotency_key text/i);
  assert.match(migration, /SECURITY DEFINER SET search_path=''/i);
  // Identity is derived from auth.uid(); caller cannot supply it.
  assert.match(migration, /DECLARE u uuid := auth\.uid\(\)/i);
  assert.match(migration, /VALUES\(p_id,p_session_id,u,'USER','RECEIVED',p_content,NULL,NULL,NULL,p_idempotency_key,NULL\)/i);
  // Session ownership is validated.
  assert.match(migration, /conversation_sessions s WHERE s\.id=p_session_id AND s\.user_id=u/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.create_user_conversation_turn\(uuid,uuid,text,text\) TO authenticated/i);
});

test('makes claim, finalize, and fail server-only with explicit ownership and state validation', () => {
  for (const name of ['claim_conversation_turn', 'finalize_conversation_turn', 'fail_conversation_turn']) {
    assert.match(migration, new RegExp(`CREATE FUNCTION public\\.${name}\\([\\s\\S]*?SECURITY DEFINER SET search_path=''`, 'i'), `${name} definer`);
  }
  // finalize/fail no longer rely on auth.uid(); they validate session ownership explicitly for the server caller.
  assert.doesNotMatch(migration, /auth\.uid\(\) IS DISTINCT FROM p_user_id/i);
  assert.match(migration, /DROP FUNCTION public\.finalize_conversation_turn\(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid\)/i);
  assert.match(migration, /DROP FUNCTION public\.fail_conversation_turn\(uuid,uuid,uuid,uuid,uuid,uuid\)/i);
  // claim validates the RECEIVED USER source turn and owned session; finalize keeps the GENERATING USER lock.
  assert.match(migration, /role='USER' AND status='RECEIVED'\s*\n?\s*FOR UPDATE/i);
  assert.match(migration, /role='USER' AND status='GENERATING' FOR UPDATE/i);
  // Atomic finalization still writes the assistant, completes the source, and emits one outbox event in one function.
  assert.match(migration, /INSERT INTO public\.conversation_turns\([^)]*\)\s*VALUES\(p_assistant_turn_id[\s\S]*?'ASSISTANT','COMPLETED'[\s\S]*?INSERT INTO public\.runtime_event_outbox/i);
  assert.match(migration, /'qandeel\.runtime\.conversation-turn-completed\.v2'/);
});

test('grants server lifecycle execution to service_role only, never to end-user roles', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.claim_conversation_turn\(uuid,uuid,uuid,text,text\) FROM PUBLIC,anon,authenticated/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.finalize_conversation_turn\(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid\) FROM PUBLIC,anon,authenticated/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.fail_conversation_turn\(uuid,uuid,uuid,uuid,uuid,uuid\) FROM PUBLIC,anon,authenticated/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]*?public\.claim_conversation_turn[\s\S]*?public\.finalize_conversation_turn[\s\S]*?public\.fail_conversation_turn[\s\S]*?TO service_role/i);
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION\s+public\.(?:claim|finalize|fail)_conversation_turn[^;]*TO authenticated/i);
});

test('sets explicit postgres ownership on every new or replaced authority function', () => {
  for (const signature of [
    'create_user_conversation_turn(uuid,uuid,text,text)',
    'claim_conversation_turn(uuid,uuid,uuid,text,text)',
    'finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid)',
    'fail_conversation_turn(uuid,uuid,uuid,uuid,uuid,uuid)',
  ]) {
    assert.match(migration, new RegExp(`ALTER FUNCTION public\\.${signature.replace(/[()]/g, '\\$&')} OWNER TO postgres`, 'i'), `${signature} ownership`);
  }
});

test('does not weaken the surviving read policy or rewrite history', () => {
  assert.doesNotMatch(migration, /DROP POLICY[^;]*conversation_turns_select_own/i);
  assert.doesNotMatch(migration, /DISABLE ROW LEVEL SECURITY/i);
});
