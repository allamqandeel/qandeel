// W3-MEGA-M R2: migration 0026's verifier proves the permanent Memory authority
// invariants it owns over a discovered surface - not a closed list of names, and
// not a lint of every later command's behaviour. These cases pin both halves
// without a database: the real catalog shape passes, including 0128's
// server_disable_memory_v1 and a later command 0026 never saw, and every way of
// reopening client or generic Memory authority is rejected by name.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { MEMORY_WRITE, describeViolations, memoryAuthorityViolations } from '../memory-authority-surface-v1.mjs';

const sources = (await Promise.all([
  '0004_memory_runtime.sql', '0026_memory_authority_hardening_v1.sql', '0128_conversational_memory_control_v1.sql',
].map((name) => readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8')))).join('\n');

// A function as the catalog describes it after its migration's ACL statements.
function fromMigration(name, overrides = {}) {
  const match = new RegExp(`CREATE FUNCTION public\\.${name}\\(([\\s\\S]*?)\\)\\s*RETURNS([\\s\\S]*?)END;\\$\\$;`, 'u').exec(sources);
  assert.ok(match, `${name} is defined in the migrations`);
  return {
    signature: `public.${name}`, name, owner: 'postgres', legacy: false, definer: true, config: ['search_path=""'],
    executors: ['postgres', 'service_role'], endUser: false, returnsMemory: /SETOF public\.memories/u.test(match[2]),
    arguments: match[1].replace(/\s+DEFAULT\s+NULL/giu, '').replace(/\s+/gu, ' ').trim(), definition: match[0], ...overrides,
  };
}

function hardenedCatalog() {
  const tablePrivileges = [];
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      tablePrivileges.push({ role, privilege, allowed: privilege === 'SELECT' && role !== 'anon' });
    }
  }
  return {
    tablePrivileges,
    functions: [
      fromMigration('supersede_memory', { legacy: true, definer: false, config: null, executors: ['postgres'] }),
      fromMigration('server_create_memory_v1'), fromMigration('server_mark_memory_deleted_v1'),
      fromMigration('server_supersede_memory_v1'), fromMigration('server_disable_memory_v1'),
      // Server-only callers of the writers (0072, 0128) and an owner-token INVOKER read.
      { ...fromMigration('server_disable_memory_v1'), signature: 'public.server_finalize_memory_control_turn_v1', name: 'server_finalize_memory_control_turn_v1',
        returnsMemory: false, definition: 'BEGIN SELECT * INTO changed FROM public.server_disable_memory_v1(p_user_id, p_target_memory_id); END' },
      { signature: 'public.pending_memory_clarification_v1', name: 'pending_memory_clarification_v1', owner: 'postgres', legacy: false,
        definer: false, config: ['search_path=""'], executors: ['authenticated', 'postgres'], endUser: true, returnsMemory: false,
        arguments: 'p_session_id uuid, p_source_turn_id uuid', definition: 'SELECT c.id FROM public.memory_control_commands c' },
      { signature: 'auth.uid()', name: 'uid', owner: 'postgres', legacy: false, definer: false, config: null,
        executors: ['anon', 'authenticated', 'postgres'], endUser: true, returnsMemory: false, arguments: '', definition: 'SELECT 1' },
    ],
  };
}

const plant = (mutate) => { const catalog = hardenedCatalog(); mutate(catalog); return memoryAuthorityViolations(catalog); };
const fn = (catalog, name) => catalog.functions.find((f) => f.name === name);
const writer = (name, sql, args = 'p_user_id uuid, p_memory_id uuid', overrides = {}) => ({
  signature: `public.${name}(${args})`, name, owner: 'postgres', legacy: false, definer: true, config: ['search_path=""'],
  executors: ['postgres', 'service_role'], endUser: false, returnsMemory: true, arguments: args,
  definition: `CREATE OR REPLACE FUNCTION public.${name}(${args})\n RETURNS SETOF memories\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO ''\nAS $function$\nBEGIN\n  ${sql}\nEND;$function$\n`,
  ...overrides,
});

test('the hardened catalog holds — 0026 commands, server_disable_memory_v1 as it stands, and their server-only callers', () => {
  const catalog = hardenedCatalog();
  for (const name of ['server_create_memory_v1', 'server_mark_memory_deleted_v1', 'server_supersede_memory_v1', 'server_disable_memory_v1']) {
    assert.ok(MEMORY_WRITE.test(fn(catalog, name).definition), `${name} is discovered as a Memory writer`);
  }
  assert.deepEqual(memoryAuthorityViolations(catalog), []);
});

test('a later narrow server-only command is legal although 0026 never saw it — its shape belongs to its own migration', () => {
  assert.deepEqual(plant((c) => c.functions.push(
    writer('server_restore_memory_v9', "UPDATE public.memories m SET status='ACTIVE', content=btrim(content) WHERE m.id=p_memory;", 'p_owner uuid, p_memory uuid'),
  )), []);
});

const planted = [
  ['authenticated direct INSERT', (c) => { c.tablePrivileges.find((p) => p.role === 'authenticated' && p.privilege === 'INSERT').allowed = true; }, 'public.memories', 'CLIENT_TABLE_WRITE'],
  ['authenticated direct UPDATE', (c) => { c.tablePrivileges.find((p) => p.role === 'authenticated' && p.privilege === 'UPDATE').allowed = true; }, 'public.memories', 'CLIENT_TABLE_WRITE'],
  ['anon SELECT', (c) => { c.tablePrivileges.find((p) => p.role === 'anon' && p.privilege === 'SELECT').allowed = true; }, 'public.memories', 'CLIENT_TABLE_WRITE'],
  ['service_role direct DELETE', (c) => { c.tablePrivileges.find((p) => p.role === 'service_role' && p.privilege === 'DELETE').allowed = true; }, 'public.memories', 'SERVER_TABLE_WRITE'],
  ['legacy supersede_memory reopened to authenticated', (c) => { fn(c, 'supersede_memory').executors.push('authenticated'); }, 'public.supersede_memory', 'LEGACY_RPC_REOPENED'],
  ['legacy supersede_memory reopened to service_role', (c) => { fn(c, 'supersede_memory').executors.push('service_role'); }, 'public.supersede_memory', 'LEGACY_RPC_REOPENED'],
  ['a writer executable by authenticated', (c) => { fn(c, 'server_disable_memory_v1').executors.push('authenticated'); }, 'public.server_disable_memory_v1', 'END_USER_WRITER'],
  ['a writer executable by PUBLIC', (c) => { fn(c, 'server_create_memory_v1').executors.push('PUBLIC'); }, 'public.server_create_memory_v1', 'END_USER_WRITER'],
  ['a writer reachable through role membership', (c) => { fn(c, 'server_mark_memory_deleted_v1').endUser = true; }, 'public.server_mark_memory_deleted_v1', 'END_USER_WRITER'],
  ['a definer writer with a mutable search_path', (c) => { fn(c, 'server_disable_memory_v1').config = null; }, 'public.server_disable_memory_v1', 'WRITER_SEARCH_PATH'],
  ['a definer writer with search_path=public', (c) => { fn(c, 'server_supersede_memory_v1').config = ['search_path=public']; }, 'public.server_supersede_memory_v1', 'WRITER_SEARCH_PATH'],
  ['update_memory_anything with a jsonb patch', (c) => c.functions.push(writer('update_memory_anything', "UPDATE public.memories m SET status='DELETED' WHERE m.user_id=p_user_id;", 'p_user_id uuid, p_patch jsonb')), 'public.update_memory_anything(p_user_id uuid, p_patch jsonb)', 'GENERIC_MUTATION'],
  ['a record-typed writer', (c) => c.functions.push(writer('put_memory', 'INSERT INTO public.memories SELECT (p_row).*;', 'p_user_id uuid, p_row record')), 'public.put_memory(p_user_id uuid, p_row record)', 'GENERIC_MUTATION'],
  ['a dynamic column updater', (c) => c.functions.push(writer('set_memory_column', "EXECUTE format('UPDATE public.memories SET %I=$1 WHERE user_id=$2', p_column) USING p_value, p_user_id;", 'p_user_id uuid, p_column text, p_value text')), 'public.set_memory_column(p_user_id uuid, p_column text, p_value text)', 'GENERIC_MUTATION'],
  ['a generic status updater', (c) => c.functions.push(writer('set_memory_status', 'UPDATE public.memories m SET status=p_status WHERE m.user_id=p_user_id;', 'p_user_id uuid, p_status text')), 'public.set_memory_status(p_user_id uuid, p_status text)', 'GENERIC_MUTATION'],
  ['a status hidden in a multi-column assignment', (c) => c.functions.push(writer('set_memory_pair', 'UPDATE public.memories m SET (status, content)=(p_status, p_content) WHERE m.user_id=p_user_id;', 'p_user_id uuid, p_status text, p_content text')), 'public.set_memory_pair(p_user_id uuid, p_status text, p_content text)', 'GENERIC_MUTATION'],
  ['an end-user definer calling a writer', (c) => c.functions.push({ ...fromMigration('server_disable_memory_v1'), signature: 'public.forget_mine(uuid)', name: 'forget_mine', executors: ['authenticated', 'postgres'], endUser: true, returnsMemory: false, definition: 'SELECT * FROM public.server_mark_memory_deleted_v1(auth.uid(), $1)' }), 'public.forget_mine(uuid)', 'END_USER_BRIDGE'],
  ['an end-user definer calling the legacy RPC', (c) => c.functions.push({ ...fn(c, 'pending_memory_clarification_v1'), signature: 'public.legacy_bridge()', name: 'legacy_bridge', definer: true, definition: 'SELECT * FROM public.supersede_memory($1,$2)' }), 'public.legacy_bridge()', 'END_USER_BRIDGE'],
  ['an end-user definer running dynamic SQL on memories', (c) => c.functions.push({ ...fn(c, 'pending_memory_clarification_v1'), signature: 'public.dynamic_bridge(text)', name: 'dynamic_bridge', definer: true, definition: "BEGIN EXECUTE 'UPDATE public.' || 'memories SET status=' || quote_literal($1); END" }), 'public.dynamic_bridge(text)', 'END_USER_BRIDGE'],
  ['an end-user definer returning Memory rows', (c) => c.functions.push({ ...fn(c, 'pending_memory_clarification_v1'), signature: 'public.all_memories()', name: 'all_memories', definer: true, returnsMemory: true, definition: 'SELECT * FROM public.memories' }), 'public.all_memories()', 'END_USER_DEFINER_READ'],
  ['executors that did not decode (name[] as a string)', (c) => { fn(c, 'server_create_memory_v1').executors = '{postgres,service_role}'; }, 'public.server_create_memory_v1', 'CATALOG_SHAPE'],
];

for (const [label, mutate, subject, invariant] of planted) {
  test(`rejected, naming the function and the invariant: ${label}`, () => {
    const violations = plant(mutate);
    assert.ok(violations.some((v) => v.subject === subject && v.invariant === invariant),
      `expected ${subject} ${invariant}, got:\n${describeViolations(violations)}`);
    const message = describeViolations(violations);
    assert.match(message, new RegExp(`${subject.replace(/[().]/gu, '\\$&')}: ${invariant} - \\S`, 'u'));
  });
}

test('the 0026 verifier applies these invariants to a discovered, decoded surface and prints what failed', async () => {
  const verifier = await readFile(new URL('../verify-migration-0026.mjs', import.meta.url), 'utf8');
  assert.match(verifier, /from '\.\/memory-authority-surface-v1\.mjs'/u);
  assert.match(verifier, /memoryAuthorityViolations\(\{ tablePrivileges, functions \}\)/u);
  assert.match(verifier, /assert\.deepEqual\(violations, \[\], describeViolations\(violations\)\)/u);
  assert.match(verifier, /\)::text\[\] executors/u, 'grantee arrays are decoded as text[]');
  assert.match(verifier, /error\?\.code === 'ERR_ASSERTION'\) console\.error\(error\.message\)/u);
  // No closed ceiling over later commands.
  assert.doesNotMatch(verifier, /'Memory command surface'/u);
  assert.doesNotMatch(verifier, /server_disable_memory_v1/u);
});
