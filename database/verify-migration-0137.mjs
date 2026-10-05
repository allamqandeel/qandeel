// A3-02 — Native Push, Permission & Platform Delivery: the real-PostgreSQL verifier for migration 0137.
//
// It proves, against a fully migrated database (never grep alone):
//   1. catalog and privilege boundary: every 0137 function's schema, security mode and empty search_path; no account
//      parameter on any owner command; the server passes reachable by service_role only; RLS on both tables; NO client
//      privilege on either table (tokens and per-device evidence are server-only); nothing for anon;
//   2. device registration: register → REGISTERED; the same token again → UPDATED; a new token → ROTATED (and the old
//      token's waiting intent is suppressed); the digest is the token's SHA-256 and the token is never readable by a
//      client; the platform / transport / APNs-environment pairing is enforced;
//   3. a token is not identity: the same installation or the same token signing in under another account detaches the
//      first account's registration, which then receives nothing;
//   4. sign-out: detach forgets the token and suppresses waiting intents; "sign out other devices" detaches every other
//      live registration of the caller only; at most 10 live registrations per account;
//   5. planning: one intent per (eligible item, live granted device) — none for a denied device, a token-less device, a
//      seen / settled / withdrawn / expired / ambient item, an item older than the device, or another account's device;
//      a second plan adds nothing (D57);
//   6. claim and record: the claim answers the CURRENT item projection, preferences, mute and the reader's own evidence;
//      a lease excludes a second claimant; a record under the wrong claim token changes nothing; ACCEPTED needs a level;
//      DEFERRED marks re-evaluation; TOKEN_INVALID invalidates the device and suppresses its other waiting intents;
//   7. per-device evidence: opened only for an ACCEPTED intent on the CALLER's installation — never for another device or
//      another account (D53); the user-level attention state (0136) is untouched by every 0137 command;
//   8. the governed Personal erasure (0130) leaves no 0137 row of the erased account, and another account untouched.
// Every stage runs inside a transaction that is rolled back.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = []) => (await client.query(text, values)).rows;
const one = async (text, values = []) => (await rows(text, values))[0];
const count = async (text, values = []) => Number((await one(text, values)).n);

async function rejected(operation, codes) {
  let refusal;
  await client.query('SAVEPOINT expected_refusal');
  try {
    await operation();
  } catch (error) {
    refusal = error;
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await client.query('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(refusal, 'the operation was expected to be refused, and it succeeded');
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code} (${refusal.message})`);
  return refusal;
}

async function actAs(role, userId = null) {
  await client.query('RESET ROLE');
  await client.query(`SET LOCAL ROLE ${role}`);
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role } : {})]);
}
const asPostgres = () => client.query('RESET ROLE');

async function account() {
  const id = randomUUID();
  await client.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  return id;
}

const PUBLISH = `SELECT * FROM public.server_publish_activity_candidate_v1(
  $1::uuid, $2, $3, $4, $5, $6::integer, $7::boolean, $8::boolean, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
  $20::boolean, $21, $22::timestamptz, $23::timestamptz)`;

/** An account update by default (Class 2, never coalesced); overrides change any field. */
async function publish(user, o = {}) {
  const c = {
    key: `k-${randomUUID()}`, source: `s-${randomUUID()}`, category: 'SYSTEM', kind: 'ACCOUNT', cls: 2, critical: false,
    requested: false, contextKind: 'ACCOUNT', contextRef: null, destination: 'GENERAL_SETTINGS', ref: 'ACCOUNT',
    speaker: 'PRODUCT', bodyAr: 'تحديث', bodyEn: 'update', disclosure: 'L2', occurredAt: new Date().toISOString(), expiresAt: null, ...o,
  };
  await actAs('service_role');
  const answer = await one(PUBLISH, [user, c.key, c.source, c.category, c.kind, c.cls, c.critical, c.requested, c.contextKind,
    c.contextRef, null, null, c.destination, c.ref, c.speaker, c.bodyAr, c.bodyEn, null, null, false, c.disclosure,
    c.occurredAt, c.expiresAt]);
  await asPostgres();
  return answer.item_id;
}

// The migration's own policy (0137 header): at most this many live registrations per account.
const LIVE_REGISTRATION_CEILING = 10;
const SYNC = 'SELECT * FROM public.sync_own_push_device_v1($1::uuid, $2, $3, $4, $5, $6, $7, $8)';
async function sync(user, installation, o = {}) {
  const d = { platform: 'ANDROID', token: `fcm-${randomUUID()}`, env: null, permission: 'GRANTED', zone: 'Africa/Cairo', locale: 'ar', version: '0.1.0', ...o };
  await actAs('authenticated', user);
  const answer = await one(SYNC, [installation, d.platform, d.token, d.env, d.permission, d.zone, d.locale, d.version]);
  await asPostgres();
  return answer.outcome;
}

const intentsFor = (item) => count('SELECT count(*) AS n FROM public.push_delivery_attempts WHERE item_id = $1', [item]);
const device = (user, installation) => one('SELECT * FROM public.push_devices WHERE user_id = $1 AND installation_id = $2', [user, installation]);

async function plan(limit = 500) {
  await actAs('service_role');
  const answer = await one('SELECT * FROM public.server_plan_push_attempts_v1($1)', [limit]);
  await asPostgres();
  return answer.planned;
}

async function claim(token = randomUUID(), limit = 100) {
  await asPostgres();
  // Every planned intent waits 60 s after projection; inside one transaction the clock does not move, so the verifier
  // makes them due explicitly.
  await client.query("UPDATE public.push_delivery_attempts SET next_attempt_at = now() - interval '1 second' WHERE state IN ('PENDING', 'DEFERRED')");
  await actAs('service_role');
  const claimed = (await rows('SELECT claim FROM public.server_claim_push_attempts_v1($1, 60, $2)', [limit, token])).map((r) => r.claim);
  await asPostgres();
  return { token, claimed };
}

const RECORD = 'SELECT * FROM public.server_record_push_attempt_v1($1, $2, $3, $4, $5::timestamptz, $6, $7)';
async function record(attemptId, token, state, o = {}) {
  await actAs('service_role');
  const answer = await one(RECORD, [attemptId, token, state, o.reason ?? null, o.next ?? null, o.level ?? null, o.counted ?? true]);
  await asPostgres();
  return answer.outcome;
}

const OWNER = ['sync_own_push_device_v1', 'detach_own_push_device_v1', 'detach_own_other_push_devices_v1', 'record_own_push_open_v1'];
const SERVER = ['server_plan_push_attempts_v1', 'server_claim_push_attempts_v1', 'server_record_push_attempt_v1'];
const TABLES = ['push_devices', 'push_delivery_attempts'];

async function verifyCatalog() {
  stage = 'catalog: every 0137 function, its schema, its security mode, its search_path';
  const fns = await rows(`SELECT n.nspname AS schema, p.proname, p.prosecdef, p.proconfig, pg_get_functiondef(p.oid) AS body
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.proname = ANY($1) ORDER BY 1, 2`, [[...OWNER, ...SERVER]]);
  assert.deepEqual(fns.map((f) => `${f.schema}.${f.proname} ${f.prosecdef ? 'DEFINER' : 'INVOKER'}`).sort(), [
    ...[...OWNER.map((name) => `public.${name} INVOKER`), ...SERVER.map((name) => `public.${name} DEFINER`)].sort(),
    ...OWNER.map((name) => `push_private.${name} DEFINER`).sort(),
  ].sort());
  for (const f of fns) assert.ok((f.proconfig ?? []).includes('search_path=""'), `${f.schema}.${f.proname} pins an empty search_path`);
  for (const f of fns) {
    assert.doesNotMatch(f.body, /\bhse_|\bhim_|human_model|decision_attention|shared_worlds\b|public_experience|introduction_|replay_|memories\b/iu, `${f.proname} touches no other domain`);
    // No 0137 function writes the user-level attention lifecycle or the in-app evidence of 0136 (D53).
    assert.doesNotMatch(f.body, /UPDATE\s+public\.activity_items/iu, `${f.proname} never writes the Activity projection`);
  }

  stage = 'catalog: no account parameter on any owner command';
  const params = await rows(`SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname IN ('public', 'push_private') AND p.proname = ANY($1)`, [OWNER]);
  for (const p of params) assert.doesNotMatch(p.args, /user/iu, `${p.proname} takes no account parameter`);

  stage = 'catalog: RLS on, and no client privilege on either table';
  for (const table of TABLES) {
    const t = await one('SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass', [`public.${table}`]);
    assert.equal(t.relrowsecurity, true, `${table} has RLS`);
    for (const role of ['anon', 'authenticated']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal((await one('SELECT has_table_privilege($1, $2, $3) AS ok', [role, `public.${table}`, privilege])).ok, false, `${role} ${privilege} ${table}`);
      }
    }
    assert.equal(await count('SELECT count(*) AS n FROM pg_policies WHERE schemaname = $1 AND tablename = $2', ['public', table]), 0, `${table} has no policy`);
  }

  stage = 'catalog: the server passes are service_role only; the owner commands are authenticated only';
  const signatures = await rows(`SELECT p.oid::regprocedure::text AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY($1)`, [[...OWNER, ...SERVER]]);
  for (const { sig, proname } of signatures) {
    const can = async (role) => (await one('SELECT has_function_privilege($1, $2, $3) AS ok', [role, sig, 'EXECUTE'])).ok;
    assert.equal(await can('anon'), false, `anon cannot run ${sig}`);
    assert.equal(await can('authenticated'), OWNER.includes(proname), `authenticated ${OWNER.includes(proname) ? 'can' : 'cannot'} run ${sig}`);
    assert.equal(await can('service_role'), SERVER.includes(proname), `service_role ${SERVER.includes(proname) ? 'can' : 'cannot'} run ${sig}`);
  }
}

async function verifyRegistration() {
  await client.query('BEGIN');
  try {
    stage = 'registration: register, refresh, rotate; the digest; no client read of the token';
    const alice = await account();
    const installation = randomUUID();
    assert.equal(await sync(alice, installation, { token: 'token-a1' }), 'REGISTERED');
    const first = await device(alice, installation);
    assert.equal(first.token_digest, createHash('sha256').update('token-a1', 'utf8').digest('hex'));
    assert.equal(first.status, 'ACTIVE');
    assert.equal(first.transport, 'FCM');
    assert.equal(await sync(alice, installation, { token: 'token-a1', zone: 'Europe/London' }), 'UPDATED');
    assert.equal((await device(alice, installation)).time_zone, 'Europe/London');
    assert.equal((await device(alice, installation)).token_updated_at.getTime(), first.token_updated_at.getTime(), 'a refresh is not a rotation');

    const item = await publish(alice);
    await plan();
    assert.equal(await intentsFor(item), 1, 'one intent: the item on its one live device');
    assert.equal(await sync(alice, installation, { token: 'token-a2' }), 'ROTATED');
    assert.equal((await one('SELECT state, reason FROM public.push_delivery_attempts WHERE item_id = $1', [item])).reason, 'device_changed',
      'an intent planned for the old token is never sent to the new one');

    await actAs('authenticated', alice);
    await rejected(() => client.query('SELECT push_token FROM public.push_devices'), ['42501']);
    await rejected(() => client.query('SELECT id FROM public.push_delivery_attempts'), ['42501']);
    await asPostgres();

    stage = 'registration: the platform / transport pairing';
    await actAs('authenticated', alice);
    await rejected(() => one(SYNC, [randomUUID(), 'IOS', 'apns-1', null, 'GRANTED', 'Africa/Cairo', 'en', null]), ['23514']);
    await rejected(() => one(SYNC, [randomUUID(), 'ANDROID', 'fcm-1', 'PRODUCTION', 'GRANTED', 'Africa/Cairo', 'en', null]), ['23514']);
    await rejected(() => one(SYNC, [randomUUID(), 'WEB', 'x', null, 'GRANTED', 'Africa/Cairo', 'en', null]), ['22023']);
    await rejected(() => one(SYNC, [randomUUID(), 'ANDROID', 'x', null, 'MAYBE', 'Africa/Cairo', 'en', null]), ['23514']);
    await asPostgres();
    const ios = randomUUID();
    assert.equal(await sync(alice, ios, { platform: 'IOS', token: 'apns-a', env: 'SANDBOX' }), 'REGISTERED');
    assert.equal((await device(alice, ios)).transport, 'APNS');
    await actAs('anon');
    await rejected(() => one(SYNC, [randomUUID(), 'ANDROID', 'x', null, 'GRANTED', 'Africa/Cairo', 'en', null]), ['42501']);
    await asPostgres();

    stage = 'a token is not identity: the installation or the token under another account detaches the first';
    const bob = await account();
    assert.equal(await sync(bob, installation, { token: 'token-b1' }), 'REGISTERED');
    const aliceAfter = await device(alice, installation);
    assert.equal(aliceAfter.status, 'DETACHED');
    assert.equal(aliceAfter.push_token, null, 'a detached registration keeps no token');
    const shared = randomUUID();
    assert.equal(await sync(alice, shared, { token: 'token-moving' }), 'REGISTERED');
    assert.equal(await sync(bob, randomUUID(), { token: 'token-moving' }), 'REGISTERED');
    assert.equal((await device(alice, shared)).status, 'DETACHED', 'the token now addresses Bob only');
    assert.equal(await count("SELECT count(*) AS n FROM public.push_devices WHERE token_digest = $1 AND status = 'ACTIVE'",
      [createHash('sha256').update('token-moving', 'utf8').digest('hex')]), 1);

    stage = 'sign-out: detach; detach others; at most 10 live registrations';
    const carol = await account();
    const here = randomUUID();
    const there = randomUUID();
    await sync(carol, here);
    await sync(carol, there);
    const carolItem = await publish(carol);
    // The plan pass is global; this transaction also holds other accounts' items, so count only this item's intents.
    await plan();
    assert.equal(await intentsFor(carolItem), 2, 'one intent per live device of the reader');
    await actAs('authenticated', carol);
    assert.equal((await one('SELECT * FROM public.detach_own_push_device_v1($1)', [there])).outcome, 'DETACHED');
    assert.equal((await one('SELECT * FROM public.detach_own_push_device_v1($1)', [there])).outcome, 'NOT_ATTACHED');
    await asPostgres();
    assert.equal((await device(carol, there)).push_token, null);
    assert.equal(await count(`SELECT count(*) AS n FROM public.push_delivery_attempts a JOIN public.push_devices d ON d.id = a.device_id
      WHERE a.item_id = $1 AND d.installation_id = $2 AND a.state = 'SUPPRESSED' AND a.reason = 'device_detached'`, [carolItem, there]), 1);
    const others = [randomUUID(), randomUUID()];
    for (const other of others) await sync(carol, other);
    await sync(bob, randomUUID());
    await actAs('authenticated', carol);
    assert.equal((await one('SELECT * FROM public.detach_own_other_push_devices_v1($1)', [here])).detached, 2);
    await asPostgres();
    assert.equal(await count("SELECT count(*) AS n FROM public.push_devices WHERE user_id = $1 AND status = 'ACTIVE'", [carol]), 1);
    assert.ok(await count("SELECT count(*) AS n FROM public.push_devices WHERE user_id = $1 AND status = 'ACTIVE'", [bob]) >= 2,
      'another account’s registrations are untouched');
    for (let i = 0; i < 12; i += 1) await sync(carol, randomUUID());
    assert.equal(await count("SELECT count(*) AS n FROM public.push_devices WHERE user_id = $1 AND status = 'ACTIVE'", [carol]), LIVE_REGISTRATION_CEILING);
  } finally {
    await client.query('ROLLBACK');
  }
}

async function verifyPlanClaimRecord() {
  await client.query('BEGIN');
  try {
    stage = 'planning: one intent per eligible item × live granted device, nothing else';
    const alice = await account();
    const bob = await account();
    const phone = randomUUID();
    const tablet = randomUUID();
    await sync(alice, phone);
    await sync(alice, tablet, { platform: 'IOS', token: `apns-${randomUUID()}`, env: 'PRODUCTION', locale: 'en' });
    await sync(alice, randomUUID(), { permission: 'DENIED' });
    await sync(alice, randomUUID(), { token: null });
    await sync(bob, randomUUID());
    const eligible = await publish(alice);
    const seen = await publish(alice);
    const settled = await publish(alice);
    const withdrawnSource = `s-${randomUUID()}`;
    const withdrawn = await publish(alice, { source: withdrawnSource });
    const expired = await publish(alice, { occurredAt: new Date(Date.now() - 3_600_000).toISOString(), expiresAt: new Date(Date.now() - 60_000).toISOString() });
    const ambient = await publish(alice, { cls: 4 });
    await client.query("UPDATE public.activity_items SET attention = 'SEEN', seen_at = now() WHERE id = $1", [seen]);
    await client.query('UPDATE public.activity_items SET interruption_settled_at = now() WHERE id = $1', [settled]);
    await actAs('service_role');
    await one('SELECT * FROM public.server_withdraw_activity_source_v1($1, $2)', [alice, withdrawnSource]);
    await asPostgres();
    const before = await one('SELECT attention, seen_at, opened_at, presented_in_app_at, interruption_settled_at FROM public.activity_items WHERE id = $1', [eligible]);

    assert.equal(await plan(), 2, 'the eligible item, on the two live granted devices with a token');
    assert.equal(await plan(), 0, 'a second plan adds nothing (D57)');
    assert.equal(await count('SELECT count(*) AS n FROM public.push_delivery_attempts WHERE item_id = ANY($1)', [[seen, settled, withdrawn, expired, ambient]]), 0);
    assert.equal(await count('SELECT count(*) AS n FROM public.push_delivery_attempts WHERE user_id = $1', [bob]), 0, 'no intent for an account with no item');
    const late = randomUUID();
    await client.query("UPDATE public.activity_items SET created_at = now() - interval '1 minute' WHERE id = $1", [eligible]);
    await sync(alice, late);
    assert.equal(await plan(), 0, 'an item older than the device registration is never sent to it');

    stage = 'claim: current facts, a lease, and the claim token';
    const { token, claimed } = await claim();
    assert.equal(claimed.length, 2);
    const forPhone = claimed.find((c) => c.device.platform === 'ANDROID');
    assert.equal(forPhone.item.id, eligible);
    assert.equal(forPhone.item.attention, 'NEW');
    assert.equal(forPhone.preferences, null, 'no preference row = the frozen defaults (the API applies them)');
    assert.equal(forPhone.muted, false);
    assert.deepEqual(forPhone.evidence, []);
    assert.equal(typeof forPhone.device.token, 'string');
    assert.equal(forPhone.device.timeZone, 'Africa/Cairo');
    assert.equal('source_ref' in forPhone.item, false, 'the claim carries the projection, never the member / source rows');
    assert.equal((await claim()).claimed.length, 0, 'a leased intent is not claimed twice');

    stage = 'record: wrong token, ACCEPTED, DEFERRED, TOKEN_INVALID';
    assert.equal(await record(forPhone.attemptId, randomUUID(), 'ACCEPTED', { level: 'L2' }), 'NOT_CLAIMED');
    await rejected(() => record(forPhone.attemptId, token, 'ACCEPTED'), ['22023']);
    assert.equal(await record(forPhone.attemptId, token, 'ACCEPTED', { level: 'L2', reason: 'accepted' }), 'RECORDED');
    assert.equal(await record(forPhone.attemptId, token, 'ACCEPTED', { level: 'L2' }), 'NOT_CLAIMED', 'a terminal intent never moves again');
    const accepted = await one('SELECT * FROM public.push_delivery_attempts WHERE id = $1', [forPhone.attemptId]);
    assert.equal(accepted.state, 'ACCEPTED');
    assert.equal(accepted.disclosure_level, 'L2');
    assert.ok(accepted.provider_accepted_at instanceof Date);
    assert.equal(accepted.opened_at, null, 'accepted is never opened (D41)');
    const forTablet = claimed.find((c) => c.device.platform === 'IOS');
    const next = new Date(Date.now() + 3_600_000).toISOString();
    assert.equal(await record(forTablet.attemptId, token, 'DEFERRED', { reason: 'quiet_hours', next, counted: false }), 'RECORDED');
    const deferred = await one('SELECT * FROM public.push_delivery_attempts WHERE id = $1', [forTablet.attemptId]);
    assert.equal(deferred.reevaluation, true);
    assert.equal(deferred.attempt_count, 0, 'a deferral is not a transport attempt');
    await rejected(() => client.query(`UPDATE public.push_delivery_attempts SET reason = 'Quiet Hours!' WHERE id = $1`, [forTablet.attemptId]), ['23514']);

    stage = 'evidence: the next claim sees the accepted interruption, once per item';
    const second = await publish(alice);
    await plan();
    const again = await claim();
    const secondPhone = again.claimed.find((c) => c.item.id === second && c.device.platform === 'ANDROID');
    assert.equal(secondPhone.evidence.length, 1);
    assert.equal(secondPhone.evidence[0].kind, 'ACCOUNT');

    stage = 'record: a dead token invalidates the device and every other waiting intent for it';
    const third = await publish(alice);
    await plan();
    assert.equal(await record(secondPhone.attemptId, again.token, 'TOKEN_INVALID', { reason: 'unregistered' }), 'RECORDED');
    const phoneRow = await device(alice, phone);
    assert.equal(phoneRow.status, 'INVALIDATED');
    assert.equal(phoneRow.push_token, null);
    assert.equal((await one(`SELECT a.state, a.reason FROM public.push_delivery_attempts a WHERE a.item_id = $1 AND a.device_id = $2`, [third, phoneRow.id])).reason, 'device_invalidated');

    stage = 'per-device evidence: opened only on the caller’s own installation, for an accepted intent';
    await actAs('authenticated', alice);
    assert.equal((await one('SELECT * FROM public.record_own_push_open_v1($1, $2)', [tablet, eligible])).outcome, 'NO_EVIDENCE',
      'the tablet was never sent this item: nothing is claimed for it');
    assert.equal((await one('SELECT * FROM public.record_own_push_open_v1($1, $2)', [phone, eligible])).outcome, 'RECORDED');
    await asPostgres();
    await actAs('authenticated', bob);
    assert.equal((await one('SELECT * FROM public.record_own_push_open_v1($1, $2)', [phone, eligible])).outcome, 'NO_EVIDENCE', 'another account records nothing');
    await asPostgres();
    assert.ok((await one('SELECT opened_at FROM public.push_delivery_attempts WHERE id = $1', [forPhone.attemptId])).opened_at instanceof Date);
    assert.equal((await one('SELECT opened_at FROM public.push_delivery_attempts WHERE id = $1', [forTablet.attemptId])).opened_at, null);
    await rejected(() => client.query('UPDATE public.push_delivery_attempts SET opened_at = now() WHERE id = $1', [forTablet.attemptId]), ['23514']);

    stage = 'user-level attention is untouched by every 0137 command (D53)';
    const after = await one('SELECT attention, seen_at, opened_at, presented_in_app_at, interruption_settled_at FROM public.activity_items WHERE id = $1', [eligible]);
    assert.deepEqual(after, before);
  } finally {
    await client.query('ROLLBACK');
  }
}

async function verifyErasure() {
  stage = 'erasure: the governed Personal erasure leaves no 0137 row of the erased account';
  await client.query('BEGIN');
  try {
    const alice = await account();
    const bob = await account();
    await sync(alice, randomUUID());
    await sync(bob, randomUUID());
    await publish(alice);
    await publish(bob);
    await plan();
    const footprint = (user) => count(`SELECT (SELECT count(*) FROM public.push_devices WHERE user_id = $1)
      + (SELECT count(*) FROM public.push_delivery_attempts WHERE user_id = $1) AS n`, [user]);
    const bobBefore = await footprint(bob);
    assert.ok(await footprint(alice) >= 2 && bobBefore >= 2);
    const deletionId = randomUUID();
    await client.query(`INSERT INTO personal_data_private.account_deletions (id, user_id, command_id, status, requested_at, final_at)
      VALUES ($1, $2, $3, 'SCHEDULED', now() - interval '8 days', now() - interval '1 day')`, [deletionId, alice, randomUUID()]);
    await actAs('service_role');
    assert.equal((await one('SELECT public.server_erase_personal_account_v1($1) AS outcome', [deletionId])).outcome, 'ERASED');
    await asPostgres();
    assert.equal(await footprint(alice), 0, 'no device or delivery row of the erased account remains');
    assert.equal(await footprint(bob), bobBefore, 'another account is untouched');
  } finally {
    await client.query('ROLLBACK');
  }
}

try {
  await client.connect();
  await verifyCatalog();
  await verifyRegistration();
  await verifyPlanClaimRecord();
  await verifyErasure();
  console.log('Verified migration 0137: A3-02 device registration, token lifecycle, isolation, planning, claim / record, per-device evidence and erasure.');
} catch (error) {
  console.error(`Database verification failed at ${stage} (${error?.code ?? 'no code'})`);
  console.error(error?.message ?? error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
