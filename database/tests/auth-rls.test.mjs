import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../migrations/0002_supabase_auth_identity_rls.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

test('provisions the canonical Qandeel identity from Supabase Auth', () => {
  assert.match(sql, /CREATE FUNCTION public\.handle_new_auth_user\(\)/i);
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/i);
  assert.match(sql, /INSERT INTO public\.users \(id, auth_subject\)\s+VALUES \(NEW\.id, NEW\.id::text\)/i);
  assert.match(sql, /AFTER INSERT ON auth\.users[\s\S]*EXECUTE FUNCTION public\.handle_new_auth_user\(\)/i);
  assert.doesNotMatch(sql, /NEW\.(email|raw_user_meta_data|user_metadata)/i);
});

test('enables RLS on every user-scoped table', () => {
  for (const table of ['users', 'conversation_sessions', 'conversation_turns']) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'));
  }
});

test('keeps anon denied and grants authenticated only the baseline operations', () => {
  assert.match(sql, /REVOKE ALL ON TABLE public\.users FROM anon, authenticated/i);
  assert.match(sql, /REVOKE ALL ON TABLE public\.conversation_sessions FROM anon, authenticated/i);
  assert.match(sql, /REVOKE ALL ON TABLE public\.conversation_turns FROM anon, authenticated/i);
  assert.doesNotMatch(sql, /GRANT\s+[\s\S]*?\sTO anon/i);
  assert.match(sql, /GRANT SELECT ON TABLE public\.users TO authenticated/i);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.conversation_sessions TO authenticated/i);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.conversation_turns TO authenticated/i);
});

test('defines explicit authenticated owner policies with cached auth uid checks', () => {
  const policies = [...sql.matchAll(/CREATE POLICY\s+([a-z_]+)[\s\S]*?TO authenticated[\s\S]*?(?=CREATE POLICY|COMMIT;)/gi)];
  assert.deepEqual(policies.map((match) => match[1]), [
    'users_select_own',
    'conversation_sessions_select_own',
    'conversation_sessions_insert_own',
    'conversation_sessions_update_own',
    'conversation_turns_select_own',
    'conversation_turns_insert_own',
    'conversation_turns_update_own',
  ]);
  assert.equal((sql.match(/\(SELECT auth\.uid\(\)\)/gi) ?? []).length, 9);
  assert.doesNotMatch(sql, /user_metadata/i);
});

test('provides a secret-free real PostgreSQL verifier for migration 0002', async () => {
  const verifierUrl = new URL('../verify-migration-0002.mjs', import.meta.url);
  const verifier = await readFile(verifierUrl, 'utf8');

  assert.match(verifier, /process\.env\.DATABASE_URL/);
  assert.match(verifier, /SET LOCAL ROLE authenticated/i);
  assert.match(verifier, /request\.jwt\.claims/i);
  assert.match(verifier, /ROLLBACK/i);
  assert.doesNotMatch(verifier, /supabase\.co|postgres(?:ql)?:\/\//i);
});
