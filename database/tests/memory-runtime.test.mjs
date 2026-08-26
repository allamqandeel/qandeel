import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../migrations/0004_memory_runtime.sql', import.meta.url), 'utf8');
// Migration 0004 is history and its text is asserted verbatim below. The write
// authority it granted is superseded by migration 0026 (Memory Authority
// Hardening), so each superseded grant assertion is paired with the revocation
// that now governs the effective boundary.
const hardening = await readFile(new URL('../migrations/0026_memory_authority_hardening_v1.sql', import.meta.url), 'utf8');

test('defines the minimal durable memory record separately from conversation history', () => {
  assert.match(migration, /CREATE TABLE public\.memories/u);
  for (const column of [
    'id uuid PRIMARY KEY', 'user_id uuid NOT NULL', 'scope text NOT NULL', 'type text NOT NULL',
    'content text NOT NULL', 'source text NOT NULL', 'confidence double precision NOT NULL',
    'importance double precision NOT NULL', 'status text NOT NULL', 'version integer NOT NULL',
    'created_at timestamptz', 'updated_at timestamptz', 'expires_at timestamptz', 'supersedes_memory_id uuid',
  ]) assert.match(migration, new RegExp(column, 'i'));
  assert.doesNotMatch(migration, /ALTER TABLE (?:public\.)?conversation_(?:sessions|turns)/iu);
  assert.doesNotMatch(migration, /transcript|embedding|vector/iu);
});

test('constrains every canonical type, source, and lifecycle status', () => {
  for (const value of [
    'STABLE_PREFERENCE', 'PERSONAL_FACT', 'GOAL', 'DECISION_COMMITMENT', 'RELATIONSHIP_CONTEXT',
    'INTERACTION_PREFERENCE', 'TEMPORARY_STATE', 'DERIVED_INSIGHT', 'USER_STATED', 'USER_CONFIRMED',
    'SYSTEM_DERIVED', 'IMPORTED', 'ADMIN_CONTROLLED', 'ACTIVE', 'SUPERSEDED', 'EXPIRED', 'DELETED',
    'DISABLED', 'PENDING_CONFIRMATION',
  ]) assert.match(migration, new RegExp(`'${value}'`, 'u'));
  assert.match(migration, /confidence BETWEEN 0 AND 1/u);
  assert.match(migration, /importance BETWEEN 0 AND 1/u);
  assert.match(migration, /source <> 'SYSTEM_DERIVED' OR status <> 'ACTIVE'/u);
  assert.match(migration, /FOREIGN KEY \(supersedes_memory_id, user_id\)[\s\S]*REFERENCES public\.memories \(id, user_id\)/u);
});

test('enables explicit owner-only RLS and no physical delete privilege', () => {
  assert.match(migration, /ALTER TABLE public\.memories ENABLE ROW LEVEL SECURITY/u);
  assert.match(migration, /REVOKE ALL ON TABLE public\.memories FROM anon, authenticated/u);
  assert.match(migration, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.memories TO authenticated/u);
  assert.doesNotMatch(migration, /GRANT[^;]*DELETE/iu);
  for (const policy of ['memories_select_own', 'memories_insert_own', 'memories_update_own']) {
    assert.match(migration, new RegExp(`CREATE POLICY ${policy}`, 'u'));
  }
  // Effective boundary: migration 0026 revokes the INSERT/UPDATE grant above,
  // drops the two write policies, and keeps only the owner-scoped read.
  assert.match(hardening, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.memories FROM authenticated/u);
  assert.match(hardening, /GRANT SELECT ON TABLE public\.memories TO authenticated/u);
  assert.match(hardening, /DROP POLICY IF EXISTS memories_insert_own ON public\.memories/u);
  assert.match(hardening, /DROP POLICY IF EXISTS memories_update_own ON public\.memories/u);
  assert.doesNotMatch(hardening, /DROP POLICY[^;]*memories_select_own/u);
  assert.equal((migration.match(/user_id = \(SELECT auth\.uid\(\)\)/gu) ?? []).length, 5);
  assert.doesNotMatch(migration, /service_role/iu);
});

test('makes explicit supersession atomic, owner-derived, and lineage preserving', () => {
  assert.match(migration, /CREATE FUNCTION public\.supersede_memory/u);
  assert.match(migration, /SECURITY INVOKER/u);
  assert.match(migration, /FOR UPDATE/u);
  assert.match(migration, /p_old_memory_id = p_new_memory_id/u);
  assert.match(migration, /status = 'SUPERSEDED'/u);
  assert.match(migration, /old_memory\.version \+ 1/u);
  assert.match(migration, /old_memory\.id/u);
  assert.doesNotMatch(migration, /p_user_id/u);
  // Effective boundary: migration 0026 revokes the authenticated EXECUTE this
  // migration granted - and service_role explicitly, so the contract holds
  // whatever grants the installation carried - and re-grants it to nobody.
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.supersede_memory\([^)]*\) TO authenticated/u);
  assert.match(hardening, /REVOKE ALL ON FUNCTION public\.supersede_memory\([^)]*\)\s*\n?\s*FROM PUBLIC, anon, authenticated, service_role;/u);
  assert.doesNotMatch(hardening, /GRANT EXECUTE ON FUNCTION public\.supersede_memory/u);
});

test('provides a real rolled-back migration and RLS verifier', async () => {
  const verifier = await readFile(new URL('../verify-migration-0004.mjs', import.meta.url), 'utf8');
  assert.match(verifier, /process\.env\.DATABASE_URL/u);
  assert.match(verifier, /SET LOCAL ROLE authenticated/iu);
  assert.match(verifier, /request\.jwt\.claims/u);
  assert.match(verifier, /cross-user/u);
  assert.match(verifier, /ROLLBACK/u);
  assert.doesNotMatch(verifier, /service_role|supabase\.co|postgres(?:ql)?:\/\//iu);
});
