// S4-01 — Shared World Reachability, Invitation & Birth v1: secret-free structural contract over migration 0138.
//
// Every "must not contain" assertion runs against executable SQL only. Live semantics — the gate, the sealed rotation,
// the non-enumerating invitation, decline, the launch-gated birth, the reads and concurrency — are proven by the
// real-PostgreSQL verifier this file pins into the toolchain and API CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATION_NAME = '0138_shared_world_reachability_invitation_birth_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const verifier = read('../verify-migration-0138.mjs');
const packageJson = JSON.parse(read('../../package.json'));
const workflow = read('../../.github/workflows/api-ci.yml');
const sql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const fnBody = (qualified) => {
  const start = sql.indexOf(`CREATE FUNCTION ${qualified}(`);
  assert.ok(start >= 0, `migration defines ${qualified}`);
  const end = sql.indexOf('$$;', sql.indexOf('AS $$', start));
  return sql.slice(start, end);
};

test('0138 is the one forward migration after 0137 and edits no historical object', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.equal(migrations.filter((n) => n.startsWith('0138_')).length, 1);
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf('0137_push_platform_delivery_v1.sql'));
  assert.match(migration, /^-- S4-01/u);
  assert.match(sql, /^BEGIN;/mu);
  assert.match(sql, /COMMIT;\s*$/u);
  assert.doesNotMatch(sql, /DROP (?:TABLE|FUNCTION|TRIGGER|CONSTRAINT|POLICY|INDEX|SCHEMA)/iu);
  assert.doesNotMatch(sql, /CREATE OR REPLACE|ALTER TABLE public\.|ALTER FUNCTION public\.(?:rotate_shared|submit_shared_world_direct|commit_shared)/iu,
    'no frozen table or function is rewritten');
  assert.doesNotMatch(sql, /CREATE (?:TABLE|FUNCTION) public\.shared_world/iu, 'no second Shared World, membership or invitation model');
  assert.doesNotMatch(sql, /CREATE TRIGGER|CREATE POLICY|CREATE EXTENSION|pg_advisory|LOCK TABLE/iu);
  assert.doesNotMatch(sql, /INSERT INTO public\.shared_worlds|INSERT INTO public\.shared_world_membership_episodes/iu,
    'only the frozen 0082 core births a World');
});

test('every privileged part is a pinned SECURITY DEFINER in shared_private; every exposed wrapper is INVOKER', () => {
  const privateFns = [...sql.matchAll(/CREATE FUNCTION shared_private\.(\w+)\(/gu)].map((m) => m[1]);
  assert.equal(privateFns.length, 12);
  for (const name of privateFns) {
    const body = fnBody(`shared_private.${name}`);
    assert.match(body, /SECURITY DEFINER SET search_path = ''/u, `${name} is a pinned definer`);
  }
  const publicFns = [...sql.matchAll(/CREATE FUNCTION public\.(\w+)\(/gu)].map((m) => m[1]);
  assert.equal(publicFns.length, 10);
  for (const name of publicFns) {
    const body = fnBody(`public.${name}`);
    assert.match(body, /SECURITY INVOKER SET search_path = ''/u, `${name} is an invoker wrapper`);
    assert.match(body, new RegExp(`FROM shared_private\\.${name}\\(`, 'u'), `${name} calls only its own definer`);
  }
});

test('the legacy client path is retired by a privilege adjustment, never by editing 0081', () => {
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.rotate_shared_world_invite_credential_v1\(uuid, text, bigint\) FROM authenticated;/u);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.submit_shared_world_direct_invitation_v1\(uuid, uuid, text\) FROM authenticated;/u);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION public\.(?:rotate_shared_world_invite_credential_v1|submit_shared_world_direct_invitation_v1|commit_shared_world_direct_acceptance_birth_v1)/u);
  assert.doesNotMatch(sql, /GRANT[^;]*shared_private\.(?:set_shared_launch_capability_v1|bind_shared_launch_gate_v1)[^;]*TO/u,
    'no application role moves or binds the gate directly');
  const grants = sql.slice(sql.indexOf('GRANT USAGE ON SCHEMA shared_private TO authenticated;'));
  assert.doesNotMatch(grants.slice(0, grants.indexOf('DO $')), /set_shared_launch_capability_v1|bind_shared_launch_gate_v1|service_role|anon/u);
});

test('the gate fails closed: ALLOW needs ENABLED + SATISFIED / WAIVED, and no migration configures it', () => {
  const bind = fnBody('shared_private.bind_shared_launch_gate_v1');
  assert.match(bind, /FOR SHARE/u);
  assert.match(bind, /IF v_state\.feature_flag_state = 'ENABLED'\s+AND v_state\.launch_requirements_state IN \('SATISFIED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE'\)/u);
  assert.match(bind, /'UNCONFIGURED'/u);
  assert.doesNotMatch(sql, /INSERT INTO shared_private\.shared_launch_capability_states[^;]*VALUES \('SHARED/u, 'no capability is seeded open');
  assert.match(sql, /a migration configures no launch capability/u);
});

test('the birth binds the gate, then invokes the frozen core under the human\'s own auth.uid(), then binds the evidence', () => {
  const acceptBody = fnBody('shared_private.accept_shared_world_invitation_v1');
  const gate = acceptBody.indexOf("bind_shared_launch_gate_v1('SHARED_DIRECT_WORLD_BIRTH')");
  const core = acceptBody.indexOf('public.commit_shared_world_direct_acceptance_birth_v1(');
  const evidence = acceptBody.indexOf('INSERT INTO shared_private.shared_direct_birth_launch_evidence');
  assert.ok(gate > 0 && gate < core && core < evidence);
  assert.doesNotMatch(acceptBody, /set_config|request\.jwt/u, 'no principal is substituted');
});

test('the Shared ID is sealed and rotated in one transaction; no clear value is stored', () => {
  const rotate = fnBody('shared_private.rotate_own_sealed_shared_id_v1');
  assert.ok(rotate.indexOf('public.rotate_shared_world_invite_credential_v1(') < rotate.indexOf('INSERT INTO shared_private.shared_id_sealed_values'));
  assert.match(rotate, /account_private\.shared_id_lookup_ref_v1\(v_canonical\)/u);
  assert.doesNotMatch(sql, /^\s+\w*shared_id\w* (?:text|bytea)\b|pgp_sym|encrypt\(/imu, 'no table column holds a clear Shared ID');
  const read = fnBody('shared_private.read_own_shared_id_v1');
  assert.match(read, /v\.credential_epoch = v_state\.epoch AND v\.credential_lookup_ref = v_state\.credential_lookup_ref/u,
    'a sealed value is served only for the exact current epoch and reference');
});

test('the invitation answers one non-enumerating outcome and never returns a target', () => {
  const submitBody = fnBody('shared_private.submit_shared_world_invitation_v1');
  assert.match(submitBody, /RETURNS TABLE \(outcome text\)/u);
  assert.match(submitBody, /WHEN no_data_found THEN/u);
  assert.doesNotMatch(submitBody, /RETURN QUERY SELECT[^;]*(?:v_target|user_id|epoch)/u);
});

test('the verifier is real PostgreSQL and is wired into the toolchain and API CI after 0137', () => {
  assert.equal(packageJson.scripts['verify:shared-world-reachability-invitation-birth:integration'],
    'node --env-file-if-exists=.env database/verify-migration-0138.mjs');
  const step = workflow.indexOf('run: npm run verify:shared-world-reachability-invitation-birth:integration');
  assert.ok(step > workflow.indexOf('run: npm run verify:push-platform-delivery:integration'));
  assert.match(verifier, /import pg from 'pg';/u);
  assert.doesNotMatch(verifier, /readFileSync|migrations\//u);
  for (const proof of ['the legacy client rotation and submission are refused', 'ALLOW births exactly one World',
    'a retry births nothing new', 'an emergency disable waits for the in-flight birth', 'former membership']) {
    assert.ok(verifier.includes(proof), `the verifier proves ${proof}`);
  }
});
