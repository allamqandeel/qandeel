import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../migrations/0003_conversation_orchestration.sql', import.meta.url), 'utf8');

test('enforces one authoritative assistant turn per source turn', () => {
  assert.match(migration, /UNIQUE \(source_turn_id\)/u);
  assert.match(migration, /role = 'USER' AND status = 'GENERATING'/u);
  assert.match(migration, /FOR UPDATE/u);
});

test('keeps atomic finalization under caller RLS without public execution', () => {
  assert.match(migration, /SECURITY INVOKER/u);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.finalize_conversation_turn[\s\S]*FROM PUBLIC, anon/u);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.finalize_conversation_turn[\s\S]*TO authenticated/u);
  assert.doesNotMatch(migration, /service_role/u);
});

test('persists only explicit Fast and justified Deep routing reasons', () => {
  assert.match(migration, /processing_path = 'FAST' AND routing_reason = 'FAST_DEFAULT'/u);
  assert.match(migration, /processing_path = 'DEEP' AND routing_reason = 'INPUT_LENGTH_REQUIRES_DEEP_CONTEXT'/u);
});
