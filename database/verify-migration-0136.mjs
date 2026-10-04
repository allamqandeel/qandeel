// A3-01 — Activity & Attention Core: the real-PostgreSQL verifier for migration 0136.
//
// It proves, against a fully migrated database (never grep alone):
//   1. catalog and privilege boundary: every 0136 function's schema, security mode and empty search_path; no account
//      parameter on any owner command; the exact client-executable set; the server passes reachable by service_role
//      only; RLS on every table; owner SELECT only; no client write anywhere; the members table reachable by no client;
//      nothing for anon; and no 0136 object references a HIM / HSE attention object or a Connected Worlds table;
//   2. publication → projection: the candidate becomes ONE item for ONE recipient; a replay is DUPLICATE and changes
//      nothing (D57); the projection holds no copy of any source table; the frozen authority constraints refuse a
//      cross-World Direct Entry, QANDEEL voice outside QANDEEL, critical outside SECURITY, Class 1 without critical;
//   3. account isolation: another account sees none of it, cannot open, see, settle or mute it;
//   4. coalescing (D09): same category + context + kind + entry, Class ≥ 3, not actionable, still unseen → one item;
//      a different World, a different kind, an actionable item, a Class 2 item, or an already-seen item → its own row;
//   5. attention is not resolution (D31, D40, D47): NEW → SEEN → OPENED only; opening a withdrawn or expired item
//      answers STALE; nothing outside the Activity tables changes;
//   6. withdrawal: a source withdrawn → its item stale, never resurrected by a later replay; a coalesced item stays
//      valid until all its members are withdrawn;
//   7. in-app evidence: one presented, the rest settled; nothing moves twice;
//   8. preferences: defaults absent a row; save; Snooze bounds (now < until ≤ 7 days) and end; Quiet Hours window
//      refused when empty; per-World mute only for a Shared context the caller's Activity holds;
//   9. bounded retention: a publish removes the recipient's items older than 90 days and nothing of another account;
//  10. the governed Personal erasure (0130) leaves no Activity row of the erased account, and another account untouched.
// Every stage runs inside a transaction that is rolled back.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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

/** A Shared candidate by default; overrides change any field. */
function candidate(user, o = {}) {
  const c = {
    user, key: `k-${randomUUID()}`, source: `s-${randomUUID()}`, category: 'SHARED', kind: 'SHARED_ACTIVITY', cls: 3,
    critical: false, requested: false, contextKind: 'SHARED_WORLD', contextRef: 'world-1', labelAr: null, labelEn: null,
    destination: 'SHARED_WORLD', ref: 'world-1', speaker: 'PRODUCT', bodyAr: 'نشاط', bodyEn: 'activity', secondaryAr: null,
    secondaryEn: null, actionable: false, disclosure: 'L2', occurredAt: new Date().toISOString(), expiresAt: null, ...o,
  };
  return [c.user, c.key, c.source, c.category, c.kind, c.cls, c.critical, c.requested, c.contextKind, c.contextRef, c.labelAr,
    c.labelEn, c.destination, c.ref, c.speaker, c.bodyAr, c.bodyEn, c.secondaryAr, c.secondaryEn, c.actionable, c.disclosure,
    c.occurredAt, c.expiresAt];
}

async function publish(user, o = {}) {
  await actAs('service_role');
  const answer = await one(PUBLISH, candidate(user, o));
  await asPostgres();
  return answer;
}

const PERSONAL = { category: 'QANDEEL', kind: 'PROACTIVE', contextKind: 'PERSONAL', contextRef: null, destination: 'PERSONAL_CONVERSATION', ref: null, speaker: 'QANDEEL' };
const ACCOUNT = { category: 'SYSTEM', kind: 'ACCOUNT', contextKind: 'ACCOUNT', contextRef: null, destination: 'GENERAL_SETTINGS', ref: 'ACCOUNT' };

const FUNCTIONS = ['server_publish_activity_candidate_v1', 'server_withdraw_activity_source_v1', 'mark_own_activity_items_seen_v1',
  'open_own_activity_item_v1', 'record_own_activity_strip_v1', 'set_own_activity_preferences_v1', 'set_own_activity_snooze_v1',
  'set_own_activity_context_mute_v1'];
const OWNER = FUNCTIONS.slice(2);
const TABLES = ['activity_items', 'activity_item_members', 'activity_preferences', 'activity_context_mutes'];

async function verifyCatalog() {
  stage = 'catalog: every 0136 function, its schema, its security mode, its search_path';
  const fns = await rows(`SELECT n.nspname AS schema, p.proname, p.prosecdef, p.proconfig, pg_get_functiondef(p.oid) AS body
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.proname = ANY($1) ORDER BY 1, 2`, [FUNCTIONS]);
  assert.deepEqual(fns.map((f) => `${f.schema}.${f.proname} ${f.prosecdef ? 'DEFINER' : 'INVOKER'}`), [
    ...OWNER.map((name) => `activity_private.${name} DEFINER`).sort(),
    ...[...OWNER.map((name) => `public.${name} INVOKER`), 'public.server_publish_activity_candidate_v1 DEFINER',
      'public.server_withdraw_activity_source_v1 DEFINER'].sort(),
  ]);
  for (const f of fns) assert.ok((f.proconfig ?? []).includes('search_path=""'), `${f.schema}.${f.proname} pins an empty search_path`);

  stage = 'catalog: no 0136 object reads HIM / HSE attention or a Connected Worlds table';
  for (const f of fns) {
    // The context vocabulary ('SHARED_WORLD', …) is Activity's own; the TABLES of other domains are what must not appear.
    assert.doesNotMatch(f.body, /\bhse_|\bhim_|human_model|decision_attention|shared_worlds\b|shared_world_membership|public_experience|introduction_|replay_|memories\b|hypotheses\b/iu, `${f.proname} touches no other domain`);
  }

  stage = 'catalog: no account parameter on any owner command';
  const [{ accountParameters }] = await rows(`SELECT count(*)::int AS "accountParameters" FROM pg_proc p
    WHERE p.proname = ANY($1) AND pg_get_function_identity_arguments(p.oid) ~ 'p_(user|account|actor|owner)(_id)? '`, [OWNER]);
  assert.equal(accountParameters, 0, 'the owner is the token’s, never a parameter');

  stage = 'catalog: the exact executable set per role';
  const executable = await rows(`SELECT r.rolname, n.nspname || '.' || p.proname AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT 'anon' AS rolname UNION ALL SELECT 'authenticated' UNION ALL SELECT 'service_role') r
    WHERE p.proname = ANY($1) AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`, [FUNCTIONS]);
  assert.deepEqual(executable, [
    ...OWNER.flatMap((name) => [`activity_private.${name}`, `public.${name}`]).sort().map((fn) => ({ rolname: 'authenticated', fn })),
    { rolname: 'service_role', fn: 'public.server_publish_activity_candidate_v1' },
    { rolname: 'service_role', fn: 'public.server_withdraw_activity_source_v1' },
  ], 'owner commands for authenticated only; the two server passes for service_role only; nothing for anon');

  stage = 'catalog: RLS on every table; owner SELECT only; no client write; the members table unreachable';
  for (const table of TABLES) {
    const [{ relrowsecurity }] = await rows(`SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1`, [table]);
    assert.equal(relrowsecurity, true, `${table} has row-level security`);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal((await one(`SELECT has_table_privilege($1, $2, 'INSERT,UPDATE,DELETE,TRUNCATE') AS w`, [role, `public.${table}`])).w, false, `${role} cannot write ${table}`);
    }
    assert.equal((await one(`SELECT has_table_privilege('anon', $1, 'SELECT') AS r`, [`public.${table}`])).r, false, `anon cannot read ${table}`);
  }
  assert.equal((await one(`SELECT has_table_privilege('authenticated', 'public.activity_item_members', 'SELECT') AS r`)).r, false);
  assert.equal((await one(`SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activity_item_members'`)).n, 0);
}

async function verifyPublication() {
  stage = 'publication: one candidate → one item for one recipient; a replay changes nothing';
  await client.query('BEGIN');
  try {
    const alice = await account();
    const bob = await account();
    const c = candidate(alice);
    await actAs('service_role');
    const first = await one(PUBLISH, c);
    const replay = await one(PUBLISH, c);
    await asPostgres();
    assert.equal(first.outcome, 'PUBLISHED');
    assert.deepEqual(replay, { outcome: 'DUPLICATE', item_id: first.item_id });
    assert.equal(await count('SELECT count(*) AS n FROM public.activity_items WHERE user_id = $1', [alice]), 1);
    assert.equal(await count('SELECT count(*) AS n FROM public.activity_items WHERE user_id = $1', [bob]), 0);

    stage = 'publication: the frozen authority constraints refuse every cross-scope candidate';
    await actAs('service_role');
    for (const bad of [
      { destination: 'PERSONAL_CONVERSATION', ref: null },             // a Shared item cannot enter the Personal world (D43)
      { speaker: 'QANDEEL' },                                           // D18
      { critical: true },                                               // only SECURITY
      { cls: 1 },                                                       // Class 1 needs critical
      { contextRef: null },                                             // a Shared item names its World
      { bodyAr: null, bodyEn: null },
      { disclosure: 'L4' },
      { ...ACCOUNT, destination: 'SHARED_WORLD', ref: 'world-1' },
    ]) {
      await rejected(() => client.query(PUBLISH, candidate(alice, bad)), ['23514', '22023']);
    }
    await rejected(() => client.query(PUBLISH, candidate(alice, { occurredAt: new Date().toISOString(), expiresAt: new Date(Date.now() - 1000).toISOString() })), ['22023']);
    await rejected(() => client.query(PUBLISH, candidate(randomUUID())), ['22023']);
    await asPostgres();

    stage = 'isolation: another account sees, opens, settles and mutes nothing of it';
    await actAs('authenticated', bob);
    assert.equal(await count('SELECT count(*) AS n FROM public.activity_items'), 0, 'RLS hides another account’s Activity');
    assert.equal((await one('SELECT * FROM public.open_own_activity_item_v1($1)', [first.item_id])).outcome, 'NOT_FOUND');
    assert.equal((await one('SELECT * FROM public.mark_own_activity_items_seen_v1($1::uuid[])', [[first.item_id]])).seen, 0);
    assert.deepEqual(await one('SELECT * FROM public.record_own_activity_strip_v1($1, $2::uuid[])', [first.item_id, []]), { presented: 0, settled: 0 });
    assert.equal((await one('SELECT * FROM public.set_own_activity_context_mute_v1($1, true)', ['world-1'])).outcome, 'UNKNOWN_CONTEXT');
    await asPostgres();
    assert.equal((await one('SELECT attention FROM public.activity_items WHERE id = $1', [first.item_id])).attention, 'NEW');

    await actAs('authenticated', alice);
    assert.equal(await count('SELECT count(*) AS n FROM public.activity_items'), 1, 'the owner reads their own item');
    await rejected(() => client.query('SELECT * FROM public.activity_item_members'), ['42501']);
    await rejected(() => client.query("UPDATE public.activity_items SET attention = 'OPENED'"), ['42501']);
    await rejected(() => client.query(PUBLISH, candidate(alice)), ['42501']);
    await asPostgres();
    await actAs('anon');
    await rejected(() => client.query('SELECT * FROM public.activity_items'), ['42501']);
    await rejected(() => client.query('SELECT * FROM public.open_own_activity_item_v1($1)', [first.item_id]), ['42501']);
    await asPostgres();
  } finally {
    await client.query('ROLLBACK');
  }
}

async function verifyCoalescing() {
  stage = 'coalescing: same exact context only; never across Worlds, kinds, actionable, Class 2 or a seen item';
  await client.query('BEGIN');
  try {
    const alice = await account();
    const a = await publish(alice);
    const b = await publish(alice);
    assert.equal(b.outcome, 'COALESCED');
    assert.equal(b.item_id, a.item_id);
    assert.equal((await one('SELECT member_count FROM public.activity_items WHERE id = $1', [a.item_id])).member_count, 2);
    const separate = [];
    for (const o of [{ contextRef: 'world-2', ref: 'world-2' }, { destination: 'REPLAY', ref: 'r-1' }, { actionable: true }, { cls: 2 }]) {
      const answer = await publish(alice, o);
      assert.equal(answer.outcome, 'PUBLISHED', `${JSON.stringify(o)} is not coalesced`);
      separate.push(answer.item_id);
    }
    await actAs('authenticated', alice);
    await one('SELECT * FROM public.mark_own_activity_items_seen_v1($1::uuid[])', [[a.item_id]]);
    await asPostgres();
    const after = await publish(alice);
    assert.equal(after.outcome, 'PUBLISHED', 'a seen item is never extended');
    assert.notEqual(after.item_id, a.item_id);
    // Exactly the distinct rows the publications named: the coalesced one, each refused coalescing, and the later one.
    const expected = [a.item_id, ...separate, after.item_id].sort();
    assert.equal(new Set(expected).size, expected.length, 'every refused coalescing is its own row');
    assert.deepEqual((await rows('SELECT id FROM public.activity_items WHERE user_id = $1 ORDER BY id', [alice])).map((r) => r.id).sort(), expected);
  } finally {
    await client.query('ROLLBACK');
  }
}

async function verifyAttentionAndWithdrawal() {
  stage = 'attention is not resolution: NEW → SEEN → OPENED; stale answers STALE; nothing else changes';
  await client.query('BEGIN');
  try {
    const alice = await account();
    const personal = await publish(alice, PERSONAL);
    const expired = await publish(alice, { ...ACCOUNT, occurredAt: new Date(Date.now() - 7_200_000).toISOString(), expiresAt: new Date(Date.now() - 3_600_000).toISOString() });
    const membersBefore = await rows('SELECT * FROM public.activity_item_members WHERE user_id = $1 ORDER BY candidate_key', [alice]);
    await actAs('authenticated', alice);
    assert.equal((await one('SELECT * FROM public.mark_own_activity_items_seen_v1($1::uuid[])', [[personal.item_id]])).seen, 1);
    assert.equal((await one('SELECT * FROM public.mark_own_activity_items_seen_v1($1::uuid[])', [[personal.item_id]])).seen, 0, 'SEEN never moves back');
    assert.deepEqual(await one('SELECT * FROM public.open_own_activity_item_v1($1)', [personal.item_id]), {
      outcome: 'OPENED', category: 'QANDEEL', context_kind: 'PERSONAL', context_ref: null, entry_destination: 'PERSONAL_CONVERSATION', entry_ref: null,
    });
    assert.equal((await one('SELECT * FROM public.open_own_activity_item_v1($1)', [expired.item_id])).outcome, 'STALE');
    await rejected(() => client.query('SELECT * FROM public.mark_own_activity_items_seen_v1($1::uuid[])', [Array.from({ length: 65 }, randomUUID)]), ['22023']);
    await asPostgres();
    assert.equal((await one('SELECT attention FROM public.activity_items WHERE id = $1', [personal.item_id])).attention, 'OPENED');
    assert.deepEqual(await rows('SELECT * FROM public.activity_item_members WHERE user_id = $1 ORDER BY candidate_key', [alice]), membersBefore, 'opening writes nothing but attention');

    stage = 'withdrawal: the source withdrawn → stale, never resurrected; a coalesced row survives until every member is withdrawn';
    const first = candidate(alice);
    await actAs('service_role');
    const item = await one(PUBLISH, first);
    const second = await one(PUBLISH, candidate(alice, { source: 'second-source' }));
    assert.equal(second.item_id, item.item_id);
    assert.equal((await one('SELECT * FROM public.server_withdraw_activity_source_v1($1, $2)', [alice, first[2]])).withdrawn_items, 0, 'one member left');
    assert.equal((await one('SELECT * FROM public.server_withdraw_activity_source_v1($1, $2)', [alice, 'second-source'])).withdrawn_items, 1);
    assert.equal((await one(PUBLISH, first)).outcome, 'DUPLICATE', 'a replay never resurrects a withdrawn item');
    await asPostgres();
    assert.ok((await one('SELECT withdrawn_at FROM public.activity_items WHERE id = $1', [item.item_id])).withdrawn_at !== null);
    await actAs('authenticated', alice);
    assert.equal((await one('SELECT * FROM public.open_own_activity_item_v1($1)', [item.item_id])).outcome, 'STALE');
    await asPostgres();

    stage = 'in-app evidence: one presented, the rest settled; nothing moves twice';
    const p1 = await publish(alice, { contextRef: 'world-9', ref: 'world-9', cls: 2 });
    const p2 = await publish(alice, { contextRef: 'world-8', ref: 'world-8', cls: 2 });
    await actAs('authenticated', alice);
    assert.deepEqual(await one('SELECT * FROM public.record_own_activity_strip_v1($1, $2::uuid[])', [p1.item_id, [p2.item_id]]), { presented: 1, settled: 1 });
    assert.deepEqual(await one('SELECT * FROM public.record_own_activity_strip_v1($1, $2::uuid[])', [p2.item_id, []]), { presented: 0, settled: 0 }, 'a settled item is never presented later');
    await rejected(() => client.query('SELECT * FROM public.record_own_activity_strip_v1(NULL, $1::uuid[])', [[]]), ['22023']);
    await rejected(() => client.query('SELECT * FROM public.record_own_activity_strip_v1($1, $2::uuid[])', [p1.item_id, [p1.item_id]]), ['22023']);
    await asPostgres();
  } finally {
    await client.query('ROLLBACK');
  }
}

async function verifyPreferences() {
  stage = 'preferences: defaults, save, Snooze bounds, Quiet Hours window, per-World mute';
  await client.query('BEGIN');
  try {
    const alice = await account();
    const save = (start = 1380, end = 480) => one(`SELECT * FROM public.set_own_activity_preferences_v1('REDUCE', false, true, true, true,
      false, true, $1, $2, 'L1', 'L3', 'L2', 'L1', 'L0', 'L2', 'L2', 'L2')`, [start, end]);
    await actAs('authenticated', alice);
    assert.equal(await count('SELECT count(*) AS n FROM public.activity_preferences'), 0, 'no row: the frozen defaults apply');
    assert.equal((await save(1350, 420)).outcome, 'SAVED');
    const row = await one('SELECT proactive, shared_alerts, public_discovery, quiet_hours_start, quiet_hours_end, lock_shared FROM public.activity_preferences');
    assert.deepEqual(row, { proactive: 'REDUCE', shared_alerts: false, public_discovery: true, quiet_hours_start: 1350, quiet_hours_end: 420, lock_shared: 'L3' });
    await rejected(() => save(600, 600), ['23514']);
    await rejected(() => one(`SELECT * FROM public.set_own_activity_preferences_v1('SOMETIMES', true, true, false, true, true, true, 1380, 480, 'L1', 'L2', 'L2', 'L1', 'L0', 'L2', 'L2', 'L2')`), ['23514']);
    assert.equal((await one("SELECT * FROM public.set_own_activity_snooze_v1(now() + interval '8 hours')")).outcome, 'SNOOZED');
    assert.equal((await one('SELECT * FROM public.set_own_activity_snooze_v1(NULL)')).outcome, 'ENDED');
    await rejected(() => client.query("SELECT * FROM public.set_own_activity_snooze_v1(now() - interval '1 minute')"), ['22023']);
    await rejected(() => client.query("SELECT * FROM public.set_own_activity_snooze_v1(now() + interval '8 days')"), ['22023']);
    assert.equal((await one("SELECT * FROM public.set_own_activity_context_mute_v1('world-1', true)")).outcome, 'UNKNOWN_CONTEXT');
    await asPostgres();
    await publish(alice);
    await actAs('authenticated', alice);
    assert.equal((await one("SELECT * FROM public.set_own_activity_context_mute_v1('world-1', true)")).outcome, 'MUTED');
    assert.equal(await count("SELECT count(*) AS n FROM public.activity_context_mutes WHERE context_ref = 'world-1'"), 1);
    assert.equal((await one("SELECT * FROM public.set_own_activity_context_mute_v1('world-1', false)")).outcome, 'UNMUTED');
    await asPostgres();
  } finally {
    await client.query('ROLLBACK');
  }
}

async function verifyRetentionAndErasure() {
  stage = 'bounded retention: a publish removes the recipient’s items older than 90 days, and nothing of another account';
  await client.query('BEGIN');
  try {
    const alice = await account();
    const bob = await account();
    const old = new Date(Date.now() - 91 * 86_400_000).toISOString();
    const aliceOld = await publish(alice, { occurredAt: old, contextRef: 'w-old', ref: 'w-old' });
    const bobOld = await publish(bob, { occurredAt: old });
    await publish(alice, { contextRef: 'w-new', ref: 'w-new' });
    assert.equal(await count('SELECT count(*) AS n FROM public.activity_items WHERE id = $1', [aliceOld.item_id]), 0);
    assert.equal(await count('SELECT count(*) AS n FROM public.activity_items WHERE id = $1', [bobOld.item_id]), 1, 'another account’s retention is its own');

    stage = 'erasure: the governed Personal erasure leaves no Activity row of the erased account';
    await actAs('authenticated', alice);
    await one(`SELECT * FROM public.set_own_activity_preferences_v1('OFF', true, true, false, true, true, true, 1380, 480, 'L1', 'L2', 'L2', 'L1', 'L0', 'L2', 'L2', 'L2')`);
    await asPostgres();
    await client.query('INSERT INTO public.activity_context_mutes (user_id, context_ref) VALUES ($1, $2)', [alice, 'w-new']);
    const footprint = (user) => count(`SELECT (SELECT count(*) FROM public.activity_items WHERE user_id = $1)
      + (SELECT count(*) FROM public.activity_item_members WHERE user_id = $1) + (SELECT count(*) FROM public.activity_preferences WHERE user_id = $1)
      + (SELECT count(*) FROM public.activity_context_mutes WHERE user_id = $1) AS n`, [user]);
    const bobBefore = await footprint(bob);
    assert.ok(await footprint(alice) > 0 && bobBefore > 0);
    const deletionId = randomUUID();
    await client.query(`INSERT INTO personal_data_private.account_deletions (id, user_id, command_id, status, requested_at, final_at)
      VALUES ($1, $2, $3, 'SCHEDULED', now() - interval '8 days', now() - interval '1 day')`, [deletionId, alice, randomUUID()]);
    await actAs('service_role');
    assert.equal((await one('SELECT public.server_erase_personal_account_v1($1) AS outcome', [deletionId])).outcome, 'ERASED');
    await asPostgres();
    assert.equal(await footprint(alice), 0, 'no Activity row of the erased account remains');
    assert.equal(await footprint(bob), bobBefore, 'another account is untouched');
  } finally {
    await client.query('ROLLBACK');
  }
}

try {
  await client.connect();
  await verifyCatalog();
  await verifyPublication();
  await verifyCoalescing();
  await verifyAttentionAndWithdrawal();
  await verifyPreferences();
  await verifyRetentionAndErasure();
  console.log('Verified migration 0136: A3-01 Activity projection, attention state, preferences, isolation, coalescing, withdrawal, retention and erasure.');
} catch (error) {
  console.error(`Database verification failed at ${stage} (${error?.code ?? 'no code'})`);
  console.error(error?.message ?? error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
