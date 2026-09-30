// W3-MEGA-M R1: migration 0026's verifier proves the Memory authority posture
// over a discovered surface instead of a closed list of names. These cases pin
// both halves without a database: every real Memory writer in the migrations
// holds the posture, and each dangerous shape the closed list used to stand in
// for is still rejected, whatever it is called.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { MEMORY_WRITE, memoryReaderViolations, memoryWriterViolations } from '../memory-authority-surface-v1.mjs';

const migration = (name) => readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
const sources = (await Promise.all([
  '0004_memory_runtime.sql', '0026_memory_authority_hardening_v1.sql', '0128_conversational_memory_control_v1.sql',
].map(migration))).join('\n');

// A function as the catalog would describe it after its migration's ACL statements.
function command(name, overrides = {}) {
  const match = new RegExp(`CREATE FUNCTION public\\.${name}\\(([\\s\\S]*?)\\)\\s*RETURNS[\\s\\S]*?END;\\$\\$;`, 'u').exec(sources);
  assert.ok(match, `${name} is defined in the migrations`);
  return {
    name, owner: 'postgres', definer: true, config: ['search_path=""'], executors: ['postgres', 'service_role'],
    arguments: match[1].replace(/\s+DEFAULT\s+NULL/giu, '').replace(/\s+/gu, ' ').trim(), definition: match[0], ...overrides,
  };
}

const SERVER_COMMANDS = ['server_create_memory_v1', 'server_mark_memory_deleted_v1', 'server_supersede_memory_v1', 'server_disable_memory_v1'];

test('every Memory writer in the migrations is discovered and holds the 0026 posture — including 0128', () => {
  for (const name of SERVER_COMMANDS) {
    const fn = command(name);
    assert.ok(MEMORY_WRITE.test(fn.definition), `${name} is discovered as a Memory writer`);
    assert.deepEqual(memoryWriterViolations(fn), [], name);
  }
});

test('the legacy generic RPC could never pass as a narrow command', () => {
  const legacy = command('supersede_memory', { definer: false, config: null, executors: ['authenticated', 'postgres', 'service_role'] });
  assert.ok(MEMORY_WRITE.test(legacy.definition));
  const violations = memoryWriterViolations(legacy).join('\n');
  for (const rule of ['not SECURITY DEFINER', 'search_path', 'EXECUTE held by authenticated', 'not owner-bound']) {
    assert.match(violations, new RegExp(rule, 'u'));
  }
});

const disable = () => command('server_disable_memory_v1');
const planted = [
  ['end-user EXECUTE', { executors: ['authenticated', 'postgres', 'service_role'] }, /EXECUTE held by authenticated/u],
  ['anonymous EXECUTE', { executors: ['anon', 'postgres', 'service_role'] }, /EXECUTE held by anon/u],
  ['default PUBLIC EXECUTE', { executors: ['PUBLIC', 'postgres'] }, /EXECUTE held by PUBLIC/u],
  ['any other grantee', { executors: ['postgres', 'service_role', 'reporting'] }, /EXECUTE held by reporting/u],
  ['SECURITY INVOKER', { definer: false }, /not SECURITY DEFINER/u],
  ['mutable search_path', { config: null }, /search_path not pinned/u],
  ['public search_path', { config: ['search_path=public'] }, /search_path not pinned/u],
  ['other owner', { owner: 'service_role' }, /owned by service_role/u],
  ['no owner binding', { arguments: 'p_memory_id uuid' }, /not owner-bound/u],
].map(([label, overrides, rule]) => [label, () => ({ ...disable(), ...overrides }), rule]);

const body = (sql, args = 'p_user_id uuid, p_memory_id uuid') => () => ({
  ...disable(), name: 'update_memory_anything', arguments: args,
  definition: `CREATE OR REPLACE FUNCTION public.update_memory_anything(${args})\n RETURNS SETOF memories\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO ''\nAS $function$\nBEGIN\n  ${sql}\nEND;$function$\n`,
});
planted.push(
  ['jsonb patch interface', body("UPDATE public.memories m SET status='DELETED' WHERE m.user_id=p_user_id;", 'p_user_id uuid, p_patch jsonb'), /generic argument p_patch jsonb/u],
  ['record interface', body('INSERT INTO public.memories SELECT (p_row).*;', 'p_user_id uuid, p_row record'), /generic argument p_row record/u],
  ['polymorphic interface', body('INSERT INTO public.memories SELECT 1;', 'p_user_id uuid, p_value anyelement'), /generic argument p_value anyelement/u],
  ['dynamic column update', body("EXECUTE format('UPDATE public.memories SET %I=$1 WHERE user_id=$2', p_column) USING p_value, p_user_id;", 'p_user_id uuid, p_column text, p_value text'), /dynamic SQL/u],
  ['content rewrite', body("UPDATE public.memories m SET content='rewritten', updated_at=CURRENT_TIMESTAMP WHERE m.user_id=p_user_id;"), /not content=/u],
  ['provenance rewrite', body("UPDATE public.memories SET source='USER_CONFIRMED' WHERE user_id=p_user_id;"), /not source=/u],
  ['owner transfer', body('UPDATE public.memories m SET user_id=p_other WHERE m.user_id=p_user_id;'), /not user_id=/u],
  ['caller-chosen status', body('UPDATE public.memories m SET status=p_status WHERE m.user_id=p_user_id;', 'p_user_id uuid, p_status text'), /not status=p_status/u],
  ['unknown status literal', body("UPDATE public.memories m SET status='ARCHIVED' WHERE m.user_id=p_user_id;"), /not status='ARCHIVED'/u],
  ['forged timestamp', body('UPDATE public.memories m SET updated_at=p_at WHERE m.user_id=p_user_id;', 'p_user_id uuid, p_at timestamptz'), /not updated_at=p_at/u],
  ['multi-column assignment', body("UPDATE public.memories m SET (status, content)=('ACTIVE', 'x') WHERE m.user_id=p_user_id;"), /unrecognised Memory UPDATE assignment/u],
  ['one lifecycle column hiding a second write', body("UPDATE public.memories m SET status='DISABLED', version=99 WHERE m.user_id=p_user_id;"), /not version=99/u],
  ['physical delete', body('DELETE FROM public.memories m WHERE m.user_id=p_user_id;'), /physical DELETE/u],
);

for (const [label, fn, rule] of planted) {
  test(`a Memory writer is rejected, whatever its name: ${label}`, () => {
    const candidate = fn();
    assert.ok(MEMORY_WRITE.test(candidate.definition) || candidate.name === 'server_disable_memory_v1', 'it is discovered');
    assert.match(memoryWriterViolations(candidate).join('\n'), rule);
  });
}

test('a Memory-returning reader that end users run must stay under owner RLS', () => {
  assert.deepEqual(memoryReaderViolations({ definer: false, executors: ['authenticated'] }), []);
  assert.deepEqual(memoryReaderViolations({ definer: true, executors: ['postgres', 'service_role'] }), []);
  assert.equal(memoryReaderViolations({ definer: true, executors: ['authenticated'] }).length, 1);
  assert.equal(memoryReaderViolations({ definer: true, executors: ['PUBLIC'] }).length, 1);
});

test('the 0026 verifier discovers the surface instead of enumerating it', async () => {
  const verifier = await readFile(new URL('../verify-migration-0026.mjs', import.meta.url), 'utf8');
  assert.match(verifier, /from '\.\/memory-authority-surface-v1\.mjs'/u);
  assert.match(verifier, /memoryWriterViolations\(fn\)/u);
  assert.match(verifier, /memoryReaderViolations\(/u);
  assert.match(verifier, /no end-user-executable SECURITY DEFINER calls a Memory writer/u);
  // The closed ceiling that failed on the first legitimate later command is gone.
  assert.doesNotMatch(verifier, /'Memory command surface'/u);
  assert.doesNotMatch(verifier, /'server_supersede_memory_v1',\s*'supersede_memory',?\s*\]/u);
});
