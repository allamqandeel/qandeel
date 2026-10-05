// S4-02 — Shared Conversation & Material Production Integration v1: secret-free structural contract over migration 0139.
//
// Every "must not contain" assertion runs against executable SQL only. Live semantics — the gate, the human text commit
// and its idempotency, the QANDEEL reply (one per human command, evidence re-checked by the frozen core), the Product-safe
// read, owner deletion and concurrency — are proven by the real-PostgreSQL verifier this file pins into the toolchain and
// API CI.
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
const PRIVATE = ['derive_shared_conversation_identity_v1', 'read_shared_conversation_capability_v1', 'list_own_shared_world_material_v1',
  'send_shared_world_human_text_v1', 'commit_shared_world_qandeel_reply_v1', 'delete_own_shared_world_material_v1'];
const PUBLIC = PRIVATE.filter((name) => name !== 'derive_shared_conversation_identity_v1');

test('0139 is the one forward migration after 0138, creates no table and edits no historical object', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.equal(migrations.filter((n) => n.startsWith('0139_')).length, 1);
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0138_shared_world_reachability_invitation_birth_v1.sql'));
  assert.match(migration, /^-- S4-02/u);
  assert.match(sql, /^BEGIN;/mu);
  assert.match(sql, /COMMIT;\s*$/u);
  assert.doesNotMatch(sql, /DROP (?:TABLE|FUNCTION|TRIGGER|POLICY|INDEX|SCHEMA)/iu);
  assert.doesNotMatch(sql, /CREATE OR REPLACE|CREATE TABLE|CREATE TRIGGER|CREATE POLICY|CREATE EXTENSION|pg_advisory|LOCK TABLE/iu,
    'no frozen function is rewritten; no second message, history, ownership, audience or QANDEEL material model');
  assert.doesNotMatch(sql, /ALTER TABLE public\.|ALTER FUNCTION public\.(?:commit_shared_world_human|commit_shared_world_qandeel_material|delete_shared_world_owned|resolve_shared_world)/iu,
    'no frozen public relation or primitive is altered');
  assert.doesNotMatch(sql, /INSERT INTO|UPDATE public\.|UPDATE shared_private\.|DELETE FROM/iu, 'the migration writes no row of its own');
  // The one forward alteration of a 0138 relation: the gate scope CHECK, replaced by the same CHECK plus one literal.
  const drops = [...sql.matchAll(/DROP CONSTRAINT (\w+)/gu)].map((m) => m[1]);
  assert.deepEqual(drops, ['shared_launch_capability_states_scope_check']);
  assert.match(sql, /ADD CONSTRAINT shared_launch_capability_states_scope_check\s+CHECK \(capability_scope IN \('SHARED_DIRECT_INVITATION', 'SHARED_DIRECT_WORLD_BIRTH', 'SHARED_CONVERSATION'\)\)/u);
});

test('every privileged part is a pinned SECURITY DEFINER in shared_private; every exposed wrapper is INVOKER', () => {
  const privateFns = [...sql.matchAll(/CREATE FUNCTION shared_private\.(\w+)\(/gu)].map((m) => m[1]);
  assert.deepEqual(privateFns.sort(), [...PRIVATE].sort());
  for (const name of PRIVATE) {
    assert.match(fnBody(`shared_private.${name}`), /SECURITY DEFINER SET search_path = ''/u, `${name} is a pinned definer`);
  }
  const publicFns = [...sql.matchAll(/CREATE FUNCTION public\.(\w+)\(/gu)].map((m) => m[1]);
  assert.deepEqual(publicFns.sort(), [...PUBLIC].sort());
  for (const name of PUBLIC) {
    const body = fnBody(`public.${name}`);
    assert.match(body, /SECURITY INVOKER SET search_path = ''/u, `${name} is an invoker wrapper`);
    assert.match(body, new RegExp(`FROM shared_private\\.${name}\\(`, 'u'), `${name} calls only its own definer`);
  }
});

test('the human is auth.uid(); the client supplies no author, audience, kind, viewer, authority or persistence identity', () => {
  for (const name of ['read_shared_conversation_capability_v1', 'list_own_shared_world_material_v1', 'send_shared_world_human_text_v1', 'delete_own_shared_world_material_v1']) {
    assert.match(fnBody(`shared_private.${name}`), /auth\.uid\(\)/u, `${name} derives the human`);
  }
  for (const name of PRIVATE.filter((n) => n !== 'commit_shared_world_qandeel_reply_v1')) {
    const signature = fnBody(`shared_private.${name}`).split('RETURNS')[0];
    assert.doesNotMatch(signature, /p_(?:user|actor|author|viewer|member|audience|authority|material_kind|history_item|baseline|approver)/u,
      `${name} accepts no identity, audience, authority or kind claim`);
  }
  // The server's reply carries the frozen I-03 evidence references (0090's own vocabulary — opaque fingerprints the core
  // recomputes) and nothing that names a human, a viewer list, an approver or a kind: 0090's own ban, applied here.
  const replySignature = fnBody('shared_private.commit_shared_world_qandeel_reply_v1').split('RETURNS')[0];
  assert.doesNotMatch(replySignature, /p_(?:user|actor|author_|viewer|member|episode|audience_human|audience_user|approver|baseline|material_kind|history_item)/u);
  const send = fnBody('shared_private.send_shared_world_human_text_v1');
  assert.match(send, /derive_shared_conversation_identity_v1\('HUMAN_TEXT_MATERIAL', p_command_id\)/u);
  assert.match(send, /derive_shared_conversation_identity_v1\('HUMAN_TEXT_HISTORY_ITEM', p_command_id\)/u);
  assert.ok(send.indexOf("bind_shared_launch_gate_v1('SHARED_CONVERSATION')") < send.indexOf('public.commit_shared_world_human_text_v1('),
    'the gate is bound before the frozen commit');
  assert.doesNotMatch(send, /set_config|request\.jwt/u, 'no principal is substituted');
  assert.match(send, /length\(p_content\) > 20000/u, 'the Personal route\'s submission bound is reused, not a new Product limit');
});

test('the QANDEEL reply is the server\'s act: QANDEEL_OUTPUT only, one per human command, evidence handed to the frozen core unchanged', () => {
  const reply = fnBody('shared_private.commit_shared_world_qandeel_reply_v1');
  assert.doesNotMatch(reply, /auth\.uid/u, 'QANDEEL is a system actor and never a human principal');
  assert.match(reply, /derive_shared_conversation_identity_v1\('QANDEEL_REPLY_COMMAND', p_human_command_id\)/u);
  assert.match(reply, /v_human\.producer_kind <> 'HUMAN'\s+OR v_human\.material_kind <> 'HUMAN_TEXT'/u, 'a human text command initiated the generation');
  assert.ok(reply.indexOf("bind_shared_launch_gate_v1('SHARED_CONVERSATION')") < reply.indexOf('public.commit_shared_world_qandeel_material_v1('));
  assert.match(reply, /'QANDEEL_OUTPUT', p_body_text/u, 'the kind is a literal, never a caller choice');
  assert.doesNotMatch(reply, /QANDEEL_ANALYSIS/u);
  assert.match(reply, /WHEN serialization_failure THEN/u, 'the frozen 40001 (stale audience, foreign World, unavailable source) is a STALE outcome, never a silent retarget');
  // The server channel reaches exactly this one act.
  const grants = sql.slice(sql.indexOf('GRANT USAGE ON SCHEMA shared_private TO service_role'));
  const serviceGrant = grants.slice(0, grants.indexOf('END IF; END$$;'));
  assert.doesNotMatch(serviceGrant, /send_shared_world_human_text_v1|delete_own_shared_world_material_v1|list_own_shared_world_material_v1|read_shared_conversation_capability_v1|set_shared_launch_capability_v1|bind_shared_launch_gate_v1|ON TABLE/u);
  assert.match(serviceGrant, /GRANT EXECUTE ON FUNCTION shared_private\.commit_shared_world_qandeel_reply_v1/u);
  const clientGrantEnd = sql.indexOf('TO authenticated;');
  const clientGrant = sql.slice(sql.lastIndexOf('GRANT EXECUTE ON FUNCTION', clientGrantEnd), clientGrantEnd);
  assert.match(clientGrant, /send_shared_world_human_text_v1/u, 'the slice is the authenticated grant');
  assert.doesNotMatch(clientGrant, /commit_shared_world_qandeel_reply_v1|commit_shared_world_qandeel_material_v1|commit_shared_world_human_text_v1|delete_shared_world_owned_material_v1/u,
    'no client executes the QANDEEL commit or a frozen 0090 primitive');
  assert.doesNotMatch(sql, /GRANT[^;]*public\.(?:commit_shared_world_human|commit_shared_world_qandeel_material|delete_shared_world_owned|resolve_shared_world_material)/u);
});

test('the read is the frozen 0089 resolver, bounded and cursored, for a current member only; deletion is an ungated privacy mutation', () => {
  const list = fnBody('shared_private.list_own_shared_world_material_v1');
  assert.match(list, /FROM public\.resolve_shared_world_material_v1\(p_world_id, v_user\)/u, 'visibility is the frozen resolver\'s, never re-derived');
  assert.match(list, /e\.ended_at IS NULL AND w\.lifecycle = 'ACTIVE'/u, 'the S4-01 entry law gates the read');
  assert.match(list, /p_limit < 1 OR p_limit > 200/u);
  assert.match(list, /WHERE m\.text_body IS NOT NULL/u, 'no body form without a Product source is faked');
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
    'stale audience evidence is refused', 'non-owner deletion', 'deleted body disappears', 'former member', 'closed World']) {
    assert.ok(verifier.includes(proof), `the verifier proves ${proof}`);
  }
});
