// S4-02 — Shared Conversation & Material Production Integration v1: secret-free structural contract over migration 0139.
//
// Every "must not contain" assertion runs against executable SQL only. Live semantics — the gate, the human text commit
// and its idempotency, the QANDEEL reply (one per human command, evidence re-checked by the frozen core, made only under
// its durable work lease), the Product-safe read, owner deletion and concurrency — are proven by the real-PostgreSQL
// verifier this file pins into the toolchain and API CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION_NAME = '0139_shared_world_conversation_material_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0139.mjs');
const packageJson = JSON.parse(read('../../package.json'));
const workflow = read('../../.github/workflows/api-ci.yml');
const sql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const fnBody = (qualified) => {
  const start = sql.indexOf(`CREATE FUNCTION ${qualified}(`);
  assert.ok(start >= 0, `migration defines ${qualified}`);
  const end = sql.indexOf('$$;', sql.indexOf('AS $$', start));
  return sql.slice(start, end);
};
const SERVER = ['begin_shared_qandeel_reply_work_v1', 'end_shared_qandeel_reply_work_v1', 'complete_shared_world_qandeel_reply_v1'];
const HUMAN = ['read_shared_conversation_capability_v1', 'list_own_shared_world_material_v1', 'send_shared_world_human_text_v1', 'delete_own_shared_world_material_v1'];
const DEFINERS = ['derive_shared_conversation_identity_v1', ...HUMAN, ...SERVER];
const POLICY = 'shared_qandeel_reply_work_policy_v1';
const PUBLIC = [...HUMAN, ...SERVER];
const WORK_TABLES = ['shared_private.shared_qandeel_reply_work_leases', 'shared_private.shared_qandeel_reply_work_grants'];

test('0139 is the one forward migration after 0138 and edits no historical object; its only tables are the work bound', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.equal(migrations.filter((n) => n.startsWith('0139_')).length, 1);
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0138_shared_world_reachability_invitation_birth_v1.sql'));
  assert.match(migration, /^-- S4-02/u);
  assert.match(sql, /^BEGIN;/mu);
  assert.match(sql, /COMMIT;\s*$/u);
  assert.doesNotMatch(sql, /DROP (?:TABLE|FUNCTION|TRIGGER|POLICY|INDEX|SCHEMA)/iu);
  assert.doesNotMatch(sql, /CREATE OR REPLACE|CREATE TRIGGER|CREATE POLICY|CREATE EXTENSION|LOCK TABLE/iu, 'no frozen function is rewritten');
  // No second message, history, ownership, audience or QANDEEL material model: the only tables are the two runtime-
  // authority tables of the provider-work bound, in the private schema, holding no content.
  assert.deepEqual([...sql.matchAll(/CREATE TABLE ([\w.]+)/gu)].map((m) => m[1]).sort(), [...WORK_TABLES].sort());
  for (const table of WORK_TABLES) {
    const body = sql.slice(sql.indexOf(`CREATE TABLE ${table}`), sql.indexOf(');', sql.indexOf(`CREATE TABLE ${table}`)));
    assert.doesNotMatch(body, /text|body|content|digest|jsonb/iu, `${table} holds no content`);
    assert.match(sql, new RegExp(`ALTER TABLE ${table.replace('.', '\\.')} ENABLE ROW LEVEL SECURITY`, 'u'));
  }
  assert.doesNotMatch(sql, /ALTER TABLE public\.|ALTER FUNCTION public\.(?:commit_shared_world_human|commit_shared_world_qandeel_material|delete_shared_world_owned|resolve_shared_world)/iu,
    'no frozen public relation or primitive is altered');
  // Every row this migration's commands write is a work-bound row; the migration itself seeds nothing.
  for (const m of sql.matchAll(/(?:INSERT INTO|DELETE FROM|UPDATE) ([\w.]+)/gu)) {
    assert.ok(WORK_TABLES.includes(m[1]), `only the work-bound tables are written (found ${m[1]})`);
  }
  assert.doesNotMatch(sql.slice(sql.lastIndexOf('$$;')), /INSERT INTO/u, 'the migration writes no row of its own');
  assert.equal([...sql.matchAll(/PERFORM pg_catalog\.pg_advisory_xact_lock\(/gu)].length, 1, 'one advisory lock, the requester work lock');
  // The one forward alteration of a 0138 relation: the gate scope CHECK, replaced by the same CHECK plus one literal.
  const drops = [...sql.matchAll(/DROP CONSTRAINT (\w+)/gu)].map((m) => m[1]);
  assert.deepEqual(drops, ['shared_launch_capability_states_scope_check']);
  assert.match(sql, /ADD CONSTRAINT shared_launch_capability_states_scope_check\s+CHECK \(capability_scope IN \('SHARED_DIRECT_INVITATION', 'SHARED_DIRECT_WORLD_BIRTH', 'SHARED_CONVERSATION'\)\)/u);
});

test('every privileged part is a pinned SECURITY DEFINER in shared_private; every exposed wrapper is INVOKER', () => {
  const privateFns = [...sql.matchAll(/CREATE FUNCTION shared_private\.(\w+)\(/gu)].map((m) => m[1]);
  assert.deepEqual(privateFns.sort(), [...DEFINERS, POLICY].sort());
  for (const name of DEFINERS) {
    assert.match(fnBody(`shared_private.${name}`), /SECURITY DEFINER SET search_path = ''/u, `${name} is a pinned definer`);
  }
  // The policy is an internal constant executed only inside the definers.
  assert.match(fnBody(`shared_private.${POLICY}`), /LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = ''/u);
  const publicFns = [...sql.matchAll(/CREATE FUNCTION public\.(\w+)\(/gu)].map((m) => m[1]);
  assert.deepEqual(publicFns.sort(), [...PUBLIC].sort());
  for (const name of PUBLIC) {
    const body = fnBody(`public.${name}`);
    assert.match(body, /SECURITY INVOKER SET search_path = ''/u, `${name} is an invoker wrapper`);
    assert.match(body, new RegExp(`shared_private\\.${name}\\(`, 'u'), `${name} calls only its own definer`);
  }
  // No public function name joins the T-03D single-committing-authority census (verify-migration-0071: exactly one
  // service_role-executable public `commit_%` function).
  assert.ok(PUBLIC.every((name) => !name.startsWith('commit_')));
});

test('the human is auth.uid(); the client supplies no author, audience, kind, viewer, authority or persistence identity', () => {
  for (const name of HUMAN) {
    assert.match(fnBody(`shared_private.${name}`), /auth\.uid\(\)/u, `${name} derives the human`);
    const signature = fnBody(`shared_private.${name}`).split('RETURNS')[0];
    assert.doesNotMatch(signature, /p_(?:user|actor|author|viewer|member|audience|authority|material_kind|history_item|baseline|approver|requester|lease)/u,
      `${name} accepts no identity, audience, authority or kind claim`);
  }
  const send = fnBody('shared_private.send_shared_world_human_text_v1');
  assert.match(send, /derive_shared_conversation_identity_v1\('HUMAN_TEXT_MATERIAL', p_command_id\)/u);
  assert.match(send, /derive_shared_conversation_identity_v1\('HUMAN_TEXT_HISTORY_ITEM', p_command_id\)/u);
  assert.ok(send.indexOf("bind_shared_launch_gate_v1('SHARED_CONVERSATION')") < send.indexOf('public.commit_shared_world_human_text_v1('),
    'the gate is bound before the frozen commit');
  assert.doesNotMatch(send, /set_config|request\.jwt/u, 'no principal is substituted');
  assert.match(send, /length\(p_content\) > 20000/u, 'the Personal route\'s submission bound is reused, not a new Product limit');
});

test('Shared generation is bounded at the database: one live lease per command, two per requester, a rolling budget, a lease that expires', () => {
  const policy = fnBody(`shared_private.${POLICY}`);
  assert.match(policy, /SELECT 2, interval '10 minutes', 40, interval '24 hours', 600/u, 'the engineering defaults live in one internal function');
  const begin = fnBody('shared_private.begin_shared_qandeel_reply_work_v1');
  assert.doesNotMatch(begin, /auth\.uid/u, 'the server names the requester explicitly, as for every server-named actor');
  assert.match(begin, /v_human\.actor_user_id IS DISTINCT FROM p_requester_user_id/u, 'only the human whose committed command it answers');
  assert.match(begin, /e\.ended_at IS NULL\s+AND w\.lifecycle = 'ACTIVE'/u, 'no provider work for a former member or a closed World');
  const gate = begin.indexOf("bind_shared_launch_gate_v1('SHARED_CONVERSATION')");
  const lock = begin.indexOf("pg_advisory_xact_lock(\n    pg_catalog.hashtextextended('qandeel.shared-qandeel-reply-work.v1:' || p_requester_user_id::text, 0))");
  const live = begin.indexOf("RETURN QUERY SELECT 'IN_PROGRESS'");
  const limited = begin.indexOf("RETURN QUERY SELECT 'LIMITED'");
  const insert = begin.indexOf('INSERT INTO shared_private.shared_qandeel_reply_work_leases');
  assert.ok(gate > 0 && lock > gate && live > lock && limited > live && insert > limited,
    'gate, then the requester lock (own namespace, keyed by the requester only), then one live lease per command, then the bounds, then the grant');
  assert.match(begin, /CURRENT_TIMESTAMP \+ public\.foreground_generation_lease_interval_v1\(\)/u, 'the lease expires on its own: the frozen 120-second foreground lease');
  assert.match(begin, /INSERT INTO shared_private\.shared_qandeel_reply_work_grants/u, 'every granted lease is charged durably');
  assert.match(begin, /l\.requester_user_id = p_requester_user_id\) >= v_policy\.user_in_flight_limit/u);
  assert.match(begin, />= v_policy\.short_window_limit/u);
  assert.match(begin, />= v_policy\.long_window_limit/u);
  assert.match(begin, /'ALREADY_COMMITTED'/u, 'a committed reply starts nothing');
  const end = fnBody('shared_private.end_shared_qandeel_reply_work_v1');
  assert.match(end, /l\.human_command_id = p_human_command_id AND l\.lease_id = p_lease_id/u, 'only the exact holder returns a lease');
});

test('the QANDEEL reply is the server\'s act: QANDEEL_OUTPUT only, one per human command, under its lease, evidence handed to the frozen core unchanged', () => {
  const reply = fnBody('shared_private.complete_shared_world_qandeel_reply_v1');
  assert.doesNotMatch(reply, /auth\.uid/u, 'QANDEEL is a system actor and never a human principal');
  const signature = reply.split('RETURNS')[0];
  assert.doesNotMatch(signature, /p_(?:user|actor|author_|viewer|member|episode|audience_human|audience_user|approver|baseline|material_kind|history_item|requester)/u);
  assert.match(reply, /derive_shared_conversation_identity_v1\('QANDEEL_REPLY_COMMAND', p_human_command_id\)/u);
  assert.match(reply, /v_human\.producer_kind <> 'HUMAN'\s+OR v_human\.material_kind <> 'HUMAN_TEXT'/u, 'a human text command initiated the generation');
  const gate = reply.indexOf("bind_shared_launch_gate_v1('SHARED_CONVERSATION')");
  const lease = reply.indexOf('l.lease_id = p_lease_id AND l.world_id = p_world_id\n     FOR UPDATE');
  const core = reply.indexOf('public.commit_shared_world_qandeel_material_v1(');
  assert.ok(gate > 0 && lease > gate && core > lease, 'the gate, then the current lease holder only, then the frozen core');
  assert.match(reply, /'QANDEEL_OUTPUT', p_body_text/u, 'the kind is a literal, never a caller choice');
  assert.doesNotMatch(reply, /QANDEEL_ANALYSIS/u);
  assert.match(reply, /WHEN serialization_failure THEN/u, 'the frozen 40001 (stale audience, foreign World, unavailable source) is a STALE outcome, never a silent retarget');
  // The server channel reaches exactly the three reply-work commands.
  const grants = sql.slice(sql.indexOf('GRANT USAGE ON SCHEMA shared_private TO service_role'));
  const serviceGrant = grants.slice(0, grants.indexOf('END IF; END$$;'));
  assert.doesNotMatch(serviceGrant, /send_shared_world_human_text_v1|delete_own_shared_world_material_v1|list_own_shared_world_material_v1|read_shared_conversation_capability_v1|set_shared_launch_capability_v1|bind_shared_launch_gate_v1|shared_qandeel_reply_work_policy_v1|ON TABLE/u);
  for (const name of SERVER) assert.match(serviceGrant, new RegExp(`shared_private\\.${name}\\(`, 'u'));
  const clientGrantEnd = sql.indexOf('TO authenticated;');
  const clientGrant = sql.slice(sql.lastIndexOf('GRANT EXECUTE ON FUNCTION', clientGrantEnd), clientGrantEnd);
  assert.match(clientGrant, /send_shared_world_human_text_v1/u, 'the slice is the authenticated grant');
  assert.doesNotMatch(clientGrant, /qandeel_reply|commit_shared_world_qandeel_material_v1|commit_shared_world_human_text_v1|delete_shared_world_owned_material_v1/u,
    'no client starts, ends or commits QANDEEL work, or executes a frozen 0090 primitive');
  assert.doesNotMatch(sql, /GRANT[^;]*public\.(?:commit_shared_world_human|commit_shared_world_qandeel_material|delete_shared_world_owned|resolve_shared_world_material)/u);
  assert.doesNotMatch(sql, /GRANT[^;]*ON TABLE/u, 'no table grant of any kind');
  for (const table of WORK_TABLES) assert.match(sql, new RegExp(`REVOKE ALL ON TABLE[^;]*${table.replace('.', '\\.')}`, 'u'));
});

test('the read is the frozen 0089 resolver, bounded and cursored, for a current member only; deletion is an ungated privacy mutation', () => {
  const list = fnBody('shared_private.list_own_shared_world_material_v1');
  assert.match(list, /FROM public\.resolve_shared_world_material_v1\(p_world_id, v_user\)/u, 'visibility is the frozen resolver\'s, never re-derived');
  assert.match(list, /e\.ended_at IS NULL AND w\.lifecycle = 'ACTIVE'/u, 'the S4-01 entry law gates the read');
  assert.match(list, /p_limit < 1 OR p_limit > 200/u);
  assert.match(list, /\(m\.established_at, m\.material_id\) < \(p_before_established_at, p_before_material_id\)/u, 'a keyset cursor, strictly older');
  assert.match(list, /WHERE m\.text_body IS NOT NULL/u, 'no body form without a Product source is faked');
  assert.match(list, /COALESCE\(m\.author_user_id = v_user, false\),/u, 'QANDEEL (no author) is never the reader: is_self is FALSE, never NULL');
  assert.doesNotMatch(list, /shared_world_material_dependencies|required_approvers|source_context_ref|audio_object_ref|transcript_text(?!\b.*FROM public\.resolve)/u,
    'no provenance, authority, approver or audio reference reaches the projection');
  const del = fnBody('shared_private.delete_own_shared_world_material_v1');
  assert.doesNotMatch(del, /bind_shared_launch_gate_v1/u, 'owner deletion is never bound to the ordinary conversation gate');
  assert.match(del, /public\.delete_shared_world_owned_material_v1\(p_command_id, p_world_id, p_material_id, v_event\)/u);
  assert.match(sql, /a migration configures no launch capability/u);
  assert.doesNotMatch(sql, /INSERT INTO shared_private\.shared_launch_capability_states/u, 'no capability is seeded open');
});

test('the verifier is real PostgreSQL and is wired into the toolchain and API CI after 0138', () => {
  assert.equal(packageJson.scripts['verify:shared-world-conversation-material:integration'],
    'node --env-file-if-exists=.env database/verify-migration-0139.mjs');
  const step = workflow.indexOf('run: npm run verify:shared-world-conversation-material:integration');
  assert.ok(step > workflow.indexOf('run: npm run verify:shared-world-reachability-invitation-birth:integration'));
  assert.match(verifier, /import pg from 'pg';/u);
  assert.doesNotMatch(verifier, /readFileSync|migrations\//u);
  for (const proof of ['closed gate', 'same command with different text conflicts', 'at most one reply per human command',
    'stale audience evidence is refused', 'non-owner deletion', 'deleted body disappears', 'former member', 'closed World',
    'one live lease per human command', 'in-flight bound', 'work-start budget', 'expired lease', 'superseded lease',
    'concurrent begins across connections']) {
    assert.ok(verifier.includes(proof), `the verifier proves ${proof}`);
  }
});
