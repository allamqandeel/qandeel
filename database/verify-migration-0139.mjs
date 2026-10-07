// S4-02 — Shared Conversation & Material Production Integration v1: the real-PostgreSQL verifier for migration 0139.
//
// It proves, against a fully migrated database:
//   1. the boundary: the eight S4-02 definers are pinned SECURITY DEFINERs in `shared_private`; every exposed wrapper is
//      SECURITY INVOKER; `authenticated` executes exactly the four human commands; `service_role` executes exactly the
//      three QANDEEL reply-work commands and reaches no shared_private table and no human command; no application role
//      reaches the two work-bound tables or the internal policy; no public `commit_%` function joins the T-03D census; the frozen 0090 primitives and
//      the 0089 resolver keep their pre-S4-02 ACL; the gate scope CHECK carries three scopes; no conversation scope is
//      configured by a migration;
//   2. closed gate: a current member cannot send (nothing written) and the server cannot commit a reply; the read is
//      still truthful; owner deletion is not held hostage by the ordinary gate;
//   3. human text: a current member commits exactly one HUMAN_TEXT per command in the exact ACTIVE / STANDARD World;
//      the author is auth.uid(); the audience is derived; a retry answers the committed material; the same command
//      with different text conflicts; another human's command conflicts; a non-member, an unknown World and a closed
//      World answer one neutral UNAVAILABLE; the request is bounded;
//   4. the Product-safe read: current members see exactly the frozen resolver's visible text material, newest first,
//      cursored; attribution (self / other Name / QANDEEL) and deletability come from server truth; a non-member and a
//      former member read nothing; no hidden or deleted row, count or placeholder;
//   5. the QANDEEL reply: committed by the server only, kind QANDEEL_OUTPUT, no human author; at most one reply per
//      human command (a second generation answers the first); evidence is re-checked by the frozen core — a wrong
//      digest or a non-derived readiness is 22023, stale audience evidence (a leave; another World's evidence; a
//      deleted source) is STALE; a reply needs a committed human command of this exact World; an authenticated client
//      cannot execute the commit;
//   5b. the work lease (the provider-work bound): one live lease per human command (a second request is IN_PROGRESS), for
//      the command's own human only; the in-flight bound (two per requester) freed by an exact-holder return; an expired
//      lease frees its slot by itself and a superseded lease commits and returns nothing; the current holder commits and
//      the lease is returned; a committed reply starts nothing again; the rolling 10-minute and 24-hour work-start budget
//      refuse, roll and are pruned; refusals are never charged; a closed capability grants nothing; no client starts, ends
//      or reads the work; a requester who left starts no new work, and a lease taken before a leave commits nothing;
//   6. owner deletion: non-owner deletion and QANDEEL deletion are UNAVAILABLE; the owner deletes once; a retry is
//      idempotent; the deleted body disappears from every reader's resolver; a deleted material cannot become a new
//      source; the QANDEEL reply (an analytical derivative) stays; a closed World still permits it;
//   7. concurrency on committed state: two identical sends commit one material; two replies for one human command
//      commit one reply; concurrent begins across connections grant one lease (the second waits on the requester lock).
//
// Stages 1–6 run inside one transaction that is rolled back. Stage 7 needs committed rows; its fixtures (and the gate row
// it configured) are removed afterwards and the removal is checked.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const rows = async (text, values = [], on = client) => (await on.query(text, values)).rows;

/** Expect `operation` to be refused with one of `codes`. Must run inside an open transaction. */
async function rejected(operation, codes, on = client) {
  let refusal;
  await on.query('SAVEPOINT expected_refusal');
  try {
    await operation();
  } catch (error) {
    refusal = error;
  } finally {
    await on.query('ROLLBACK TO SAVEPOINT expected_refusal');
    await on.query('RELEASE SAVEPOINT expected_refusal');
  }
  assert.ok(refusal, 'the operation was expected to be refused, and it succeeded');
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code}: ${refusal.message}`);
  return refusal;
}

/** A principal acting through the Data API: role `authenticated` with that human's claims, or `service_role` with none. */
async function actAs(role, userId = null, on = client) {
  await on.query('RESET ROLE');
  await on.query(`SET LOCAL ROLE ${role}`);
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role } : { role })]);
}

/** The database owner (operator / fixture setup), optionally carrying a human's claims. */
async function asOwner(userId = null, on = client) {
  await on.query('RESET ROLE');
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId } : {})]);
}

const digest = (text) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
/** The frozen I-03G readiness fingerprint, reproduced from its own definition (the core recomputes it). */
const readinessRef = (e) => `sha256:${createHash('sha256').update([
  'QANDEEL_CWV2_SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_V1',
  `effectiveContext=${e.effectiveContextRef}`, `output=${e.outputDigest}`,
  `sourceDisclosureGate=${e.sourceDisclosureGateRef}`, `authorityRevalidation=${e.authorityRevalidationRef}`,
].join('\n'), 'utf8').digest('hex')}`;
/** The frozen I-03D audience fingerprint of a World's CURRENT audience (per user AND episode; carries the World). */
async function audienceRef(worldId) {
  await asOwner();
  const members = await rows('SELECT user_id, membership_episode_id FROM public.resolve_shared_world_human_audience_snapshot_v1($1)', [worldId]);
  const byCodeUnit = (l, r) => (l < r ? -1 : l > r ? 1 : 0);
  const rendered = members.map((m) => ({ user: String(m.user_id).toLowerCase(), episode: String(m.membership_episode_id).toLowerCase() }))
    .sort((l, r) => byCodeUnit(l.user, r.user) || byCodeUnit(l.episode, r.episode)).map((m) => `${m.user}@${m.episode}`).join(',');
  return `sha256:${createHash('sha256').update(['QANDEEL_CWV2_SHARED_HUMAN_AUDIENCE_SNAPSHOT_V1', 'state=RESOLVED',
    `world=${String(worldId).toLowerCase()}`, `members=${rendered}`].join('\n'), 'utf8').digest('hex')}`;
}
/** One internally consistent I-03 evidence bundle for one exact body and one audience reference. */
function evidenceFor(body, audienceSnapshotRef) {
  const e = { effectiveContextRef: `ec:s402:${randomUUID()}`, outputDigest: digest(body), sourceDisclosureGateRef: `gate:s402:${randomUUID()}`,
    authorityRevalidationRef: `rev:s402:${randomUUID()}`, audienceSnapshotRef };
  return { ...e, readiness: readinessRef(e) };
}

const send = async (commandId, worldId, content, on = client) =>
  (await rows('SELECT * FROM public.send_shared_world_human_text_v1($1, $2, $3)', [commandId, worldId, content], on))[0];
const listMaterial = async (worldId, limit = 50, cursor = null) =>
  rows('SELECT * FROM public.list_own_shared_world_material_v1($1, $2, $3, $4)', [worldId, cursor?.established_at ?? null, cursor?.material_id ?? null, limit]);
const deleteOwn = async (commandId, worldId, materialId) =>
  (await rows('SELECT * FROM public.delete_own_shared_world_material_v1($1, $2, $3)', [commandId, worldId, materialId]))[0];
const capability = async () => (await rows('SELECT * FROM public.read_shared_conversation_capability_v1()'))[0];
const beginWork = async (humanCommandId, worldId, requester, on = client) =>
  (await rows('SELECT * FROM public.begin_shared_qandeel_reply_work_v1($1, $2, $3)', [humanCommandId, worldId, requester], on))[0];
const endWork = async (humanCommandId, leaseId, on = client) =>
  (await rows('SELECT public.end_shared_qandeel_reply_work_v1($1, $2) AS returned', [humanCommandId, leaseId], on))[0].returned;
const complete = async (leaseId, humanCommandId, worldId, body, e, sources = [], reasoning = [], on = client) =>
  (await rows('SELECT * FROM public.complete_shared_world_qandeel_reply_v1($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
    [leaseId, humanCommandId, worldId, body, e.effectiveContextRef, e.outputDigest, e.sourceDisclosureGateRef, e.authorityRevalidationRef,
      e.readiness, e.audienceSnapshotRef, sources, reasoning], on))[0];
/**
 * The server's whole reply act for one requesting human, exactly as the API runs it: begin the work lease, then complete
 * under it. A refused begin grants no lease, so the completion is attempted under a lease nobody holds — which commits
 * nothing, and answers an already committed reply.
 */
const reply = async (requester, humanCommandId, worldId, body, e, sources = [], reasoning = [], on = client) => {
  const work = await beginWork(humanCommandId, worldId, requester, on);
  return complete(work.work_lease_id ?? randomUUID(), humanCommandId, worldId, body, e, sources, reasoning, on);
};
const setGate = async (scope, flag, requirements, on = client) =>
  (await rows('SELECT * FROM shared_private.set_shared_launch_capability_v1($1, $2, $3, $4, $5)', [scope, flag, requirements, 's4-02-verifier', 'verification fixture'], on))[0];

async function materialCounts(worldId) {
  const [row] = await rows(`SELECT (SELECT count(*) FROM public.shared_world_materials WHERE world_id = $1)::int AS materials,
    (SELECT count(*) FROM public.shared_world_text_material_bodies b JOIN public.shared_world_materials m ON m.id = b.material_id WHERE m.world_id = $1)::int AS bodies,
    (SELECT count(*) FROM public.shared_world_material_commit_commands WHERE world_id = $1)::int AS commands,
    (SELECT count(*) FROM public.shared_world_history_items WHERE world_id = $1)::int AS items`, [worldId]);
  return row;
}

async function signUp(on, id, name, loginId) {
  await on.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  await on.query('UPDATE public.users SET name = $2, login_id = $3 WHERE id = $1', [id, name, loginId]);
}

/** A born ACTIVE / STANDARD World through the frozen 0081 / 0082 primitives, driven as the owner with the exact human's claims. */
async function bornWorld(inviter, target) {
  await asOwner();
  const [state] = await rows('SELECT epoch FROM public.shared_world_invite_credential_state WHERE user_id = $1', [target]);
  const ref = `sid1:${createHash('sha256').update(randomUUID(), 'utf8').digest('hex')}`;
  await asOwner(target);
  await rows('SELECT * FROM public.rotate_shared_world_invite_credential_v1($1, $2, $3)', [randomUUID(), ref, state ? state.epoch : null]);
  await asOwner(inviter);
  const invitationId = randomUUID();
  await rows('SELECT * FROM public.submit_shared_world_direct_invitation_v1($1, $2, $3)', [randomUUID(), invitationId, ref]);
  await asOwner(target);
  const worldId = randomUUID();
  const [born] = await rows('SELECT outcome FROM public.commit_shared_world_direct_acceptance_birth_v1($1, $2, $3, $4, $5)',
    [randomUUID(), invitationId, worldId, randomUUID(), randomUUID()]);
  assert.equal(born.outcome, 'BORN');
  await asOwner();
  return worldId;
}

const SERVER_COMMANDS = ['begin_shared_qandeel_reply_work_v1', 'complete_shared_world_qandeel_reply_v1', 'end_shared_qandeel_reply_work_v1'];
const HUMAN_COMMANDS = ['read_shared_conversation_capability_v1', 'list_own_shared_world_material_v1', 'send_shared_world_human_text_v1', 'delete_own_shared_world_material_v1'];
const S402_DEFINERS = ['derive_shared_conversation_identity_v1', ...HUMAN_COMMANDS, ...SERVER_COMMANDS];
const WORK_TABLES = ['shared_qandeel_reply_work_leases', 'shared_qandeel_reply_work_grants'];
const FROZEN_PRIMITIVES = [
  'public.commit_shared_world_human_material_v1(uuid,uuid,uuid,uuid,text,text,text,text,integer)',
  'public.commit_shared_world_human_text_v1(uuid,uuid,uuid,uuid,text)',
  'public.commit_shared_world_human_voice_note_v1(uuid,uuid,uuid,uuid,text,text,integer)',
  'public.commit_shared_world_qandeel_material_v1(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,uuid[],text[])',
  'public.delete_shared_world_owned_material_v1(uuid,uuid,uuid,uuid)',
  'shared_private.set_shared_launch_capability_v1(text,text,text,text,text)',
  'shared_private.bind_shared_launch_gate_v1(text)',
];

// ------------------------------------------------------------------------------------------------------
// Stage 1 — the boundary.
// ------------------------------------------------------------------------------------------------------
async function verifyBoundary() {
  stage = 'boundary: the S4-02 definers are pinned; the wrappers are INVOKER';
  const privateFns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'shared_private' AND p.proname = ANY($1::text[]) ORDER BY 1`, [S402_DEFINERS]);
  assert.deepEqual(privateFns.map((f) => f.proname).sort(), [...S402_DEFINERS].sort());
  for (const f of privateFns) {
    assert.equal(f.prosecdef, true, `shared_private.${f.proname} is SECURITY DEFINER`);
    assert.equal(f.owner, 'postgres');
    assert.ok((f.proconfig ?? []).includes('search_path=""'), `shared_private.${f.proname} pins an empty search_path`);
  }
  const publicFns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY($1::text[]) ORDER BY 1`, [[...HUMAN_COMMANDS, ...SERVER_COMMANDS]]);
  assert.equal(publicFns.length, 7);
  for (const f of publicFns) {
    assert.equal(f.prosecdef, false, `public.${f.proname} is SECURITY INVOKER`);
    assert.ok((f.proconfig ?? []).includes('search_path=""'));
  }

  stage = 'boundary: authenticated runs exactly the human commands; service_role exactly the three QANDEEL reply-work commands';
  const executable = await rows(`SELECT r.rolname, n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role'), ('public')) AS r(rolname)
    WHERE ((n.nspname = 'shared_private' AND p.proname = ANY($1::text[])) OR (n.nspname = 'public' AND p.proname = ANY($2::text[])))
      AND (r.rolname = 'public' OR EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2, 3`,
  [S402_DEFINERS, [...HUMAN_COMMANDS, ...SERVER_COMMANDS]]);
  const key = (r) => `${r.rolname} ${r.nspname}.${r.proname}`;
  assert.deepEqual(executable.map(key).sort(), [
    ...HUMAN_COMMANDS.map((proname) => key({ rolname: 'authenticated', nspname: 'public', proname })),
    ...HUMAN_COMMANDS.map((proname) => key({ rolname: 'authenticated', nspname: 'shared_private', proname })),
    ...SERVER_COMMANDS.map((proname) => key({ rolname: 'service_role', nspname: 'public', proname })),
    ...SERVER_COMMANDS.map((proname) => key({ rolname: 'service_role', nspname: 'shared_private', proname })),
  ].sort(), 'the human commands are the human\'s; the QANDEEL reply work is the server\'s; the identity derivation is nobody\'s');
  for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
    const [{ allowed }] = await rows("SELECT has_function_privilege($1, 'shared_private.shared_qandeel_reply_work_policy_v1()', 'EXECUTE') AS allowed", [role]);
    assert.equal(allowed, false, `${role} must not execute the internal work policy`);
  }
  // The T-03D single-committing-authority census (verify-migration-0071) is untouched: S4-02 adds no public `commit_%`
  // function the server channel can execute, and the historical FINAL coordinator keeps its authority.
  //
  // S5-03B proof-scope correction (no DB authority changed): this proof is LOCAL to S4-02, not a repository-wide ceiling.
  // A later, separately owned and reviewed server command (S5-03B's `commit_public_spatial_placement_v1`, proven by
  // verify-migration-0145) is outside the S4-02 surface and outside this assertion.
  assert.ok(S402_DEFINERS.every((name) => !name.startsWith('commit_')), 'S4-02 owns no `commit_%` command');
  const committing = await rows(`SELECT p.proname, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'commit\\_%' AND has_function_privilege('service_role', p.oid, 'EXECUTE') ORDER BY 1`);
  assert.deepEqual(committing.filter((f) => /\bshared_private\./u.test(f.prosrc)).map((f) => f.proname), [],
    'no service_role `commit_%` endpoint reaches the S4-02 shared_private surface');
  assert.ok(committing.some((f) => f.proname === 'commit_finalized_exchange_with_full_semantic_chain_v1'),
    'the historical T-03D FINAL coordinator keeps its service_role authority');

  stage = 'boundary: no application role reaches a shared_private table; the server channel reaches no 0138 human command';
  for (const table of ['shared_id_sealed_values', 'shared_launch_capability_states', 'shared_launch_capability_events',
    'shared_direct_birth_launch_evidence', 'shared_direct_invitation_decline_commands', ...WORK_TABLES]) {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const [{ reach }] = await rows('SELECT has_table_privilege($1, $2, $3) AS reach', [role, `shared_private.${table}`, 'SELECT,INSERT,UPDATE,DELETE']);
      assert.equal(reach, false, `${role} cannot reach ${table}`);
    }
  }
  for (const table of WORK_TABLES) {
    const [{ rls }] = await rows('SELECT relrowsecurity AS rls FROM pg_class WHERE oid = $1::regclass', [`shared_private.${table}`]);
    assert.equal(rls, true, `${table} has row level security enabled`);
  }
  const serverReach = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'shared_private' AND has_function_privilege('service_role', p.oid, 'EXECUTE') ORDER BY 1`);
  assert.deepEqual(serverReach.map((r) => r.proname), [...SERVER_COMMANDS].sort());

  stage = 'boundary: the frozen 0090 primitives, the operator change and the bare gate stay executable by no application role';
  for (const fn of FROZEN_PRIMITIVES) {
    for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
      const [{ allowed }] = await rows('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, fn, 'EXECUTE']);
      assert.equal(allowed, false, `${role} must not execute ${fn}`);
    }
  }
  const [{ resolver }] = await rows("SELECT has_function_privilege('service_role', 'public.resolve_shared_world_material_v1(uuid,uuid)', 'EXECUTE') AS resolver");
  assert.equal(resolver, true, 'the frozen 0089 resolver keeps its service_role grant');
  for (const role of ['anon', 'authenticated']) {
    const [{ allowed }] = await rows("SELECT has_function_privilege($1, 'public.resolve_shared_world_material_v1(uuid,uuid)', 'EXECUTE') AS allowed", [role]);
    assert.equal(allowed, false, `${role} still cannot execute the raw material resolver`);
  }

  stage = 'boundary: the gate scope CHECK carries three scopes and no conversation scope is configured by a migration';
  const [{ def }] = await rows(`SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
    WHERE c.conrelid = 'shared_private.shared_launch_capability_states'::regclass AND c.conname = 'shared_launch_capability_states_scope_check'`);
  for (const scope of ['SHARED_DIRECT_INVITATION', 'SHARED_DIRECT_WORLD_BIRTH', 'SHARED_CONVERSATION']) assert.ok(def.includes(scope), def);
  const [{ configured }] = await rows("SELECT count(*)::int AS configured FROM shared_private.shared_launch_capability_states WHERE capability_scope = 'SHARED_CONVERSATION'");
  assert.equal(configured, 0);
  await rejected(() => setGate('SHARED_LIVE_CALL', 'ENABLED', 'SATISFIED'), ['23514']);

  stage = 'boundary: the derived identities are deterministic, namespaced and never a client\'s to choose';
  const command = randomUUID();
  const derived = await rows(`SELECT shared_private.derive_shared_conversation_identity_v1('HUMAN_TEXT_MATERIAL', $1) AS a,
    shared_private.derive_shared_conversation_identity_v1('HUMAN_TEXT_MATERIAL', $1) AS b,
    shared_private.derive_shared_conversation_identity_v1('HUMAN_TEXT_HISTORY_ITEM', $1) AS c`, [command]);
  assert.equal(derived[0].a, derived[0].b);
  assert.notEqual(derived[0].a, derived[0].c);
  assert.match(derived[0].a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/u);
  for (const role of ['authenticated', 'service_role']) {
    await actAs(role, role === 'authenticated' ? randomUUID() : null);
    await rejected(() => rows("SELECT shared_private.derive_shared_conversation_identity_v1('HUMAN_TEXT_MATERIAL', $1)", [command]), ['42501']);
  }
  await asOwner();
}

// ------------------------------------------------------------------------------------------------------
// Stages 2–6 — behaviour, inside one rolled-back transaction.
// ------------------------------------------------------------------------------------------------------
async function verifyClosedGate({ a, b, c }, worldId) {
  stage = 'closed gate: a current member cannot send, the server cannot reply, nothing is written';
  await asOwner();
  const before = await materialCounts(worldId);
  await actAs('authenticated', a);
  assert.deepEqual(await capability(), { conversation_available: false });
  assert.deepEqual(await send(randomUUID(), worldId, 'مرحبًا'), { outcome: 'UNAVAILABLE', material_id: null, established_at: null, qandeel_reply_material_id: null });
  assert.deepEqual(await listMaterial(worldId), [], 'the read is truthful: nothing yet');
  await actAs('service_role');
  const closedReply = await reply(a, randomUUID(), worldId, 'a reply nobody asked for', evidenceFor('a reply nobody asked for', await audienceRef(worldId)));
  await actAs('service_role');
  assert.deepEqual(closedReply, { outcome: 'UNAVAILABLE', material_id: null, established_at: null });
  await asOwner();
  assert.deepEqual(await materialCounts(worldId), before);
  for (const [flag, requirements] of [['DISABLED', 'SATISFIED'], ['ENABLED', 'UNKNOWN'], ['ENABLED', 'UNSATISFIED'],
    ['INTERNAL', 'SATISFIED'], ['LIMITED_ROLLOUT', 'SATISFIED'], ['EMERGENCY_DISABLED', 'SATISFIED']]) {
    await asOwner();
    await setGate('SHARED_CONVERSATION', flag, requirements);
    await actAs('authenticated', b);
    assert.equal((await send(randomUUID(), worldId, 'still closed')).outcome, 'UNAVAILABLE', `${flag} / ${requirements} denies`);
    assert.deepEqual(await capability(), { conversation_available: false });
  }
  await asOwner();
  assert.deepEqual(await materialCounts(worldId), before);
  await actAs('authenticated', c);
  await rejected(() => setGate('SHARED_CONVERSATION', 'ENABLED', 'SATISFIED'), ['42501']);
  await asOwner();
}

async function verifyHumanText({ a, b, c }, worldId, otherWorldId) {
  stage = 'human text: the gate opens; a current member commits exactly one HUMAN_TEXT per command';
  await asOwner();
  await setGate('SHARED_CONVERSATION', 'ENABLED', 'SATISFIED');
  const before = await materialCounts(worldId);
  await actAs('authenticated', a);
  assert.deepEqual(await capability(), { conversation_available: true });
  const first = randomUUID();
  const committed = await send(first, worldId, 'أول كلمة في عالمنا');
  assert.equal(committed.outcome, 'COMMITTED');
  assert.match(committed.material_id, /^[0-9a-f-]{36}$/u);
  assert.equal(committed.qandeel_reply_material_id, null);
  await asOwner();
  const [material] = await rows(`SELECT m.material_kind, m.producer_kind, m.author_user_id, m.world_id, b.body_text, i.authority_requirement_mode,
      (SELECT count(*)::int FROM public.shared_world_history_item_baseline_viewers v WHERE v.history_item_id = m.history_item_id) AS viewers,
      (SELECT array_agg(ra.approver_user_id::text) FROM public.shared_world_history_item_required_approvers ra WHERE ra.history_item_id = m.history_item_id) AS approvers
    FROM public.shared_world_materials m JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
    JOIN public.shared_world_history_items i ON i.id = m.history_item_id WHERE m.id = $1`, [committed.material_id]);
  assert.deepEqual(material, { material_kind: 'HUMAN_TEXT', producer_kind: 'HUMAN', author_user_id: a, world_id: worldId, body_text: 'أول كلمة في عالمنا',
    authority_requirement_mode: 'EXACT_HUMAN_APPROVER_SET', viewers: 2, approvers: [a] },
  'the author is auth.uid(); the audience is the derived current audience; the only authority is the author');
  const after = await materialCounts(worldId);
  assert.deepEqual(after, { materials: before.materials + 1, bodies: before.bodies + 1, commands: before.commands + 1, items: before.items + 1 });

  stage = 'human text: a retry of the same command answers the committed material and writes nothing';
  await actAs('authenticated', a);
  const retried = await send(first, worldId, 'أول كلمة في عالمنا');
  assert.deepEqual([retried.outcome, retried.material_id], ['COMMITTED', committed.material_id]);
  await asOwner();
  assert.deepEqual(await materialCounts(worldId), after);

  stage = 'human text: the same command with different text conflicts; another human\'s command conflicts; the request is bounded';
  await actAs('authenticated', a);
  await rejected(() => send(first, worldId, 'كلمة مختلفة'), ['23505']);
  await rejected(() => send(first, otherWorldId, 'أول كلمة في عالمنا'), ['23505']);
  await actAs('authenticated', b);
  await rejected(() => send(first, worldId, 'أول كلمة في عالمنا'), ['23505']);
  await rejected(() => send(randomUUID(), worldId, '   '), ['22023']);
  await rejected(() => send(randomUUID(), worldId, 'x'.repeat(20001)), ['22023']);
  await rejected(() => send(null, worldId, 'no command'), ['22023']);

  stage = 'human text: a non-member and an unknown World answer one neutral UNAVAILABLE; anon and no subject are refused';
  await actAs('authenticated', c);
  assert.equal((await send(randomUUID(), worldId, 'not my world')).outcome, 'UNAVAILABLE');
  await actAs('authenticated', a);
  assert.equal((await send(randomUUID(), randomUUID(), 'no such world')).outcome, 'UNAVAILABLE');
  await actAs('authenticated');
  await rejected(() => send(randomUUID(), worldId, 'nobody'), ['42501']);
  await actAs('anon');
  await rejected(() => send(randomUUID(), worldId, 'nobody'), ['42501']);
  await rejected(() => listMaterial(worldId), ['42501']);
  await asOwner();
  assert.deepEqual(await materialCounts(worldId), after);

  stage = 'human text: the other member commits too, in canonical order';
  await actAs('authenticated', b);
  const second = await send(randomUUID(), worldId, 'And a reply from the other side');
  assert.equal(second.outcome, 'COMMITTED');
  await asOwner();
  return { firstCommand: first, firstMaterial: committed.material_id, secondMaterial: second.material_id };
}

async function verifyRead({ a, b, c }, worldId, otherWorldId, { firstMaterial, secondMaterial }) {
  stage = 'read: both members see the same visible material, newest first, with server-owned attribution and deletability';
  await actAs('authenticated', a);
  const seenByA = await listMaterial(worldId);
  assert.deepEqual(seenByA.map((m) => [m.material_id, m.material_kind, m.producer_kind, m.is_self, m.author_name, m.text_body, m.can_delete]), [
    [secondMaterial, 'HUMAN_TEXT', 'HUMAN', false, 'Bassem Inviter', 'And a reply from the other side', false],
    [firstMaterial, 'HUMAN_TEXT', 'HUMAN', true, 'Amal Invitee', 'أول كلمة في عالمنا', true],
  ]);
  assert.deepEqual(Object.keys(seenByA[0]).sort(), ['author_name', 'can_delete', 'established_at', 'is_self', 'material_id', 'material_kind', 'producer_kind', 'text_body']);
  await actAs('authenticated', b);
  const seenByB = await listMaterial(worldId);
  assert.deepEqual(seenByB.map((m) => [m.material_id, m.is_self, m.can_delete]), [[secondMaterial, true, true], [firstMaterial, false, false]]);

  stage = 'read: the cursor pages without overlap; the bound is enforced';
  const page = await listMaterial(worldId, 1);
  assert.deepEqual(page.map((m) => m.material_id), [secondMaterial]);
  const next = await listMaterial(worldId, 1, page[0]);
  assert.deepEqual(next.map((m) => m.material_id), [firstMaterial]);
  assert.deepEqual(await listMaterial(worldId, 1, next[0]), []);
  await rejected(() => listMaterial(worldId, 0), ['22023']);
  await rejected(() => listMaterial(worldId, 201), ['22023']);
  await rejected(() => rows('SELECT * FROM public.list_own_shared_world_material_v1($1, $2, NULL, 10)', [worldId, page[0].established_at]), ['22023']);

  stage = 'read: a non-member, another World and a World that never existed read nothing, in one way';
  await actAs('authenticated', c);
  assert.deepEqual(await listMaterial(worldId), []);
  await actAs('authenticated', a);
  assert.deepEqual(await listMaterial(otherWorldId), [], 'another World\'s material is not visible');
  assert.deepEqual(await listMaterial(randomUUID()), []);
  await asOwner();
}

async function verifyQandeelReply({ a, b }, worldId, otherWorldId, { firstCommand, firstMaterial }) {
  stage = 'reply: the server commits exactly QANDEEL_OUTPUT with no human author, bound to the current audience';
  const body = 'أهلًا بكما. سمعت كلمتكما الأولى.';
  const evidence = evidenceFor(body, await audienceRef(worldId));
  await actAs('service_role');
  const committed = await reply(a, firstCommand, worldId, body, evidence);
  assert.equal(committed.outcome, 'MATERIAL_COMMITTED');
  await asOwner();
  const [material] = await rows(`SELECT m.material_kind, m.producer_kind, m.author_user_id, ev.readiness_state, ev.output_digest,
      (SELECT count(*)::int FROM public.shared_world_history_item_baseline_viewers v WHERE v.history_item_id = m.history_item_id) AS viewers,
      (SELECT count(*)::int FROM public.shared_world_history_item_required_approvers ra WHERE ra.history_item_id = m.history_item_id) AS approvers,
      (SELECT array_agg(d.dependency_kind) FROM public.shared_world_material_dependencies d WHERE d.target_material_id = m.id) AS provenance
    FROM public.shared_world_materials m JOIN public.shared_world_qandeel_material_evidence ev ON ev.material_id = m.id WHERE m.id = $1`, [committed.material_id]);
  assert.deepEqual(material, { material_kind: 'QANDEEL_OUTPUT', producer_kind: 'QANDEEL', author_user_id: null, readiness_state: 'READY_FOR_LATER_DELIVERY_GATES',
    output_digest: digest(body), viewers: 2, approvers: 0, provenance: ['INDEPENDENT_TARGET_TRUTH'] });

  stage = 'reply: at most one reply per human command — a second generation answers the first and commits nothing';
  const counts = await materialCounts(worldId);
  await actAs('service_role');
  const again = await reply(a, firstCommand, worldId, 'a different second generation', evidenceFor('a different second generation', await audienceRef(worldId)));
  await actAs('service_role');
  assert.deepEqual([again.outcome, again.material_id], ['MATERIAL_COMMITTED', committed.material_id]);
  await asOwner();
  assert.deepEqual(await materialCounts(worldId), counts);
  await actAs('authenticated', a);
  const retry = await send(firstCommand, worldId, 'أول كلمة في عالمنا');
  assert.equal(retry.qandeel_reply_material_id, committed.material_id, 'a retry of the human send reports the reply already committed');
  const thread = await listMaterial(worldId);
  assert.deepEqual(thread.map((m) => [m.producer_kind, m.is_self, m.author_name, m.can_delete]).slice(0, 1), [['QANDEEL', false, null, false]]);
  await actAs('authenticated', b);
  assert.deepEqual((await listMaterial(worldId))[0].can_delete, false, 'QANDEEL material is nobody\'s to delete');

  stage = 'reply: a reply needs a committed human text command of this exact World';
  await asOwner();
  const bodyB = 'B asked in the other world';
  await actAs('authenticated', b);
  const otherSend = await send(randomUUID(), otherWorldId, bodyB);
  assert.equal(otherSend.outcome, 'UNAVAILABLE', 'B is not a member of the other World');
  const unknownCommand = randomUUID();
  await actAs('service_role');
  assert.equal((await reply(a, unknownCommand, worldId, 'x', evidenceFor('x', await audienceRef(worldId)))).outcome, 'UNAVAILABLE');
  await asOwner();
  const before = [await materialCounts(worldId), await materialCounts(otherWorldId)];
  await actAs('service_role');
  assert.equal((await reply(a, firstCommand, otherWorldId, 'x', evidenceFor('x', await audienceRef(otherWorldId)))).outcome, 'UNAVAILABLE',
    'a human command of World A initiates nothing in World B');
  await actAs('service_role');
  const crossWorld = await complete(randomUUID(), firstCommand, otherWorldId, 'x', evidenceFor('x', await audienceRef(otherWorldId)));
  assert.deepEqual([crossWorld.outcome, crossWorld.material_id, crossWorld.established_at], ['UNAVAILABLE', null, null],
    'World A\'s committed reply is never answered through World B');
  await asOwner();
  assert.deepEqual([await materialCounts(worldId), await materialCounts(otherWorldId)], before, 'a cross-World request commits nothing anywhere');

  stage = 'reply: invalid or forged evidence is refused by the frozen core before anything is written';
  await actAs('authenticated', a);
  const thirdCommand = randomUUID();
  assert.equal((await send(thirdCommand, worldId, 'third')).outcome, 'COMMITTED');
  const good = evidenceFor('reply three', await audienceRef(worldId));
  await actAs('service_role');
  await rejected(() => reply(a, thirdCommand, worldId, 'reply three', { ...good, outputDigest: digest('other bytes') }), ['22023']);
  await rejected(() => reply(a, thirdCommand, worldId, 'reply three', { ...good, readiness: digest('not the fingerprint') }), ['22023']);
  await rejected(() => reply(a, thirdCommand, worldId, '   ', good), ['22023']);
  stage = 'reply: stale audience evidence is refused — another World\'s audience, a fabricated audience';
  await actAs('service_role');
  assert.equal((await reply(a, thirdCommand, worldId, 'reply three', evidenceFor('reply three', await audienceRef(otherWorldId)))).outcome, 'STALE');
  await actAs('service_role');
  assert.equal((await reply(a, thirdCommand, worldId, 'reply three', evidenceFor('reply three', `sha256:${'f'.repeat(64)}`))).outcome, 'STALE');
  await asOwner();
  const [{ replies }] = await rows(`SELECT count(*)::int AS replies FROM public.shared_world_materials WHERE world_id = $1 AND producer_kind = 'QANDEEL'`, [worldId]);
  assert.equal(replies, 1, 'no refused reply left a material behind');

  stage = 'reply: a client cannot commit QANDEEL material';
  await actAs('authenticated', a);
  await rejected(() => reply(a, thirdCommand, worldId, 'reply three', good), ['42501']);
  await actAs('anon');
  await rejected(() => reply(a, thirdCommand, worldId, 'reply three', good), ['42501']);
  await asOwner();
  return { replyMaterial: committed.material_id, thirdCommand, firstMaterial };
}

async function verifyWorkLease({ a, b }, worldId) {
  stage = 'work lease: one live lease per human command, for the command\'s own human only';
  await actAs('authenticated', a);
  const [c1, c2, c3, c4] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  for (const [command, text] of [[c1, 'lease one'], [c2, 'lease two'], [c3, 'lease three'], [c4, 'lease four']]) {
    assert.equal((await send(command, worldId, text)).outcome, 'COMMITTED');
  }
  await asOwner();
  const [{ grantsBefore }] = await rows('SELECT count(*)::int AS "grantsBefore" FROM shared_private.shared_qandeel_reply_work_grants WHERE requester_user_id = $1', [a]);
  await actAs('service_role');
  const first = await beginWork(c1, worldId, a);
  assert.equal(first.work_outcome, 'GRANTED');
  assert.deepEqual(await beginWork(c1, worldId, a), { work_outcome: 'IN_PROGRESS', work_lease_id: null, reply_material_id: null },
    'one live lease per human command: a second request for it starts no provider work');
  assert.equal((await beginWork(c1, worldId, b)).work_outcome, 'UNAVAILABLE', 'only the human whose command it answers');
  assert.equal((await beginWork(randomUUID(), worldId, a)).work_outcome, 'UNAVAILABLE', 'no committed command, no lease');

  stage = 'work lease: the in-flight bound — two live leases per requester, freed by a return';
  const second = await beginWork(c2, worldId, a);
  assert.equal(second.work_outcome, 'GRANTED');
  assert.equal((await beginWork(c3, worldId, a)).work_outcome, 'LIMITED', 'the in-flight bound holds across every World and instance');
  assert.equal(await endWork(c2, randomUUID()), false, 'only the exact holder returns a lease');
  assert.equal(await endWork(c2, second.work_lease_id), true);
  const third = await beginWork(c3, worldId, a);
  assert.equal(third.work_outcome, 'GRANTED', 'a returned slot is free at once');

  stage = 'work lease: an expired lease frees its slot by itself; a superseded lease commits and returns nothing';
  await asOwner();
  await client.query(`UPDATE shared_private.shared_qandeel_reply_work_leases SET acquired_at = CURRENT_TIMESTAMP - interval '200 seconds',
    expires_at = CURRENT_TIMESTAMP - interval '80 seconds' WHERE human_command_id = $1`, [c1]);
  await actAs('service_role');
  const renewed = await beginWork(c1, worldId, a);
  assert.equal(renewed.work_outcome, 'GRANTED', 'an expired lease frees its slot by itself (crash recovery)');
  assert.notEqual(renewed.work_lease_id, first.work_lease_id);
  const evidence = evidenceFor('lease reply', await audienceRef(worldId));
  await actAs('service_role');
  assert.equal((await complete(first.work_lease_id, c1, worldId, 'lease reply', evidence)).outcome, 'UNAVAILABLE', 'a superseded lease commits nothing');
  assert.equal(await endWork(c1, first.work_lease_id), false, 'a superseded holder cannot return the newer lease');
  assert.equal((await complete(randomUUID(), c1, worldId, 'lease reply', evidence)).outcome, 'UNAVAILABLE', 'no lease, no commit');
  const done = await complete(renewed.work_lease_id, c1, worldId, 'lease reply', evidence);
  assert.equal(done.outcome, 'MATERIAL_COMMITTED', 'the current holder commits');
  assert.deepEqual(await beginWork(c1, worldId, a), { work_outcome: 'ALREADY_COMMITTED', work_lease_id: null, reply_material_id: done.material_id },
    'a committed reply starts no provider work again');
  assert.equal(await endWork(c3, third.work_lease_id), true);
  await asOwner();
  const [{ live }] = await rows('SELECT count(*)::int AS live FROM shared_private.shared_qandeel_reply_work_leases WHERE requester_user_id = $1', [a]);
  assert.equal(live, 0, 'completing and returning leave no lease behind');
  const [{ granted }] = await rows('SELECT count(*)::int AS granted FROM shared_private.shared_qandeel_reply_work_grants WHERE requester_user_id = $1', [a]);
  assert.equal(granted, grantsBefore + 4, 'every GRANTED lease is charged exactly once; refusals are never charged');

  stage = 'work lease: the work-start budget — the rolling 10-minute and 24-hour windows';
  await client.query(`INSERT INTO shared_private.shared_qandeel_reply_work_grants (requester_user_id, granted_at)
    SELECT $1, CURRENT_TIMESTAMP - interval '1 minute' FROM generate_series(1, 40 - $2::int)`, [a, granted]);
  await actAs('service_role');
  assert.equal((await beginWork(c4, worldId, a)).work_outcome, 'LIMITED', 'the 10-minute work-start budget is spent');
  await asOwner();
  await client.query(`UPDATE shared_private.shared_qandeel_reply_work_grants SET granted_at = CURRENT_TIMESTAMP - interval '11 minutes' WHERE requester_user_id = $1`, [a]);
  await client.query(`INSERT INTO shared_private.shared_qandeel_reply_work_grants (requester_user_id, granted_at)
    SELECT $1, CURRENT_TIMESTAMP - interval '1 hour' FROM generate_series(1, 560)`, [a]);
  await actAs('service_role');
  assert.equal((await beginWork(c4, worldId, a)).work_outcome, 'LIMITED', 'the 24-hour work-start budget is spent');
  await asOwner();
  await client.query(`UPDATE shared_private.shared_qandeel_reply_work_grants SET granted_at = CURRENT_TIMESTAMP - interval '25 hours' WHERE requester_user_id = $1`, [a]);
  await actAs('service_role');
  const after = await beginWork(c4, worldId, a);
  assert.equal(after.work_outcome, 'GRANTED', 'the windows roll: grants older than the longest window no longer count');
  await asOwner();
  const [{ pruned }] = await rows(`SELECT count(*)::int AS pruned FROM shared_private.shared_qandeel_reply_work_grants
    WHERE requester_user_id = $1 AND granted_at <= CURRENT_TIMESTAMP - interval '24 hours'`, [a]);
  assert.equal(pruned, 0, 'this requester\'s expired grants were pruned (bounded housekeeping)');
  await actAs('service_role');
  assert.equal(await endWork(c4, after.work_lease_id), true);

  stage = 'work lease: a closed conversation capability grants no lease';
  await asOwner();
  await setGate('SHARED_CONVERSATION', 'EMERGENCY_DISABLED', 'SATISFIED');
  await actAs('service_role');
  assert.equal((await beginWork(c4, worldId, a)).work_outcome, 'UNAVAILABLE');
  await asOwner();
  await setGate('SHARED_CONVERSATION', 'ENABLED', 'SATISFIED');

  stage = 'work lease: no client starts, ends or reads QANDEEL work';
  for (const [role, user] of [['authenticated', a], ['anon', null]]) {
    await actAs(role, user);
    await rejected(() => beginWork(c4, worldId, a), ['42501']);
    await rejected(() => endWork(c4, randomUUID()), ['42501']);
    await rejected(() => rows('SELECT * FROM shared_private.shared_qandeel_reply_work_leases'), ['42501']);
    await rejected(() => rows('SELECT * FROM shared_private.shared_qandeel_reply_work_grants'), ['42501']);
  }
  await actAs('service_role');
  await rejected(() => rows('SELECT * FROM shared_private.shared_qandeel_reply_work_leases'), ['42501']);
  await asOwner();
  // Later stages start from a clean budget for this requester.
  await client.query('DELETE FROM shared_private.shared_qandeel_reply_work_grants WHERE requester_user_id = $1', [a]);
}

async function verifyDeletion({ a, b }, worldId, { firstMaterial, secondMaterial, replyMaterial, thirdCommand }) {
  stage = 'deletion: non-owner deletion and QANDEEL deletion are one neutral UNAVAILABLE';
  await asOwner();
  const before = await materialCounts(worldId);
  await actAs('authenticated', b);
  assert.deepEqual(await deleteOwn(randomUUID(), worldId, firstMaterial), { outcome: 'UNAVAILABLE' });
  assert.deepEqual(await deleteOwn(randomUUID(), worldId, replyMaterial), { outcome: 'UNAVAILABLE' });
  await actAs('authenticated', a);
  assert.deepEqual(await deleteOwn(randomUUID(), worldId, replyMaterial), { outcome: 'UNAVAILABLE' });
  assert.deepEqual(await deleteOwn(randomUUID(), worldId, randomUUID()), { outcome: 'UNAVAILABLE' });
  assert.deepEqual(await deleteOwn(randomUUID(), randomUUID(), firstMaterial), { outcome: 'UNAVAILABLE' }, 'material from another World is not reachable through this one');
  await asOwner();
  assert.deepEqual(await materialCounts(worldId), before);

  stage = 'deletion: the owner deletes once; the retry is idempotent; a second command finds nothing to delete';
  await actAs('authenticated', a);
  const command = randomUUID();
  assert.deepEqual(await deleteOwn(command, worldId, firstMaterial), { outcome: 'DELETED' });
  assert.deepEqual(await deleteOwn(command, worldId, firstMaterial), { outcome: 'DELETED' });
  assert.deepEqual(await deleteOwn(randomUUID(), worldId, firstMaterial), { outcome: 'UNAVAILABLE' });
  await rejected(() => deleteOwn(command, worldId, secondMaterial), ['23505']);
  await asOwner();
  const [item] = await rows(`SELECT i.availability_state, (SELECT count(*)::int FROM public.shared_world_text_material_bodies b WHERE b.material_id = m.id) AS bodies,
      (SELECT count(*)::int FROM public.shared_world_material_deleted_events ev WHERE ev.material_id = m.id) AS events
    FROM public.shared_world_materials m JOIN public.shared_world_history_items i ON i.id = m.history_item_id WHERE m.id = $1`, [firstMaterial]);
  assert.deepEqual(item, { availability_state: 'DELETED_BY_OWNER', bodies: 0, events: 1 });
  assert.deepEqual(await materialCounts(worldId), { ...before, bodies: before.bodies - 1 }, 'only the body is gone; the envelope and history identity remain');

  stage = 'deletion: the deleted body disappears from every reader\'s resolver; the QANDEEL reply (an analytical derivative) stays';
  for (const reader of [a, b]) {
    await actAs('authenticated', reader);
    const ids = (await listMaterial(worldId)).map((m) => m.material_id);
    assert.ok(!ids.includes(firstMaterial), 'no row, count or placeholder for the deleted material');
    assert.ok(ids.includes(replyMaterial) && ids.includes(secondMaterial));
  }

  stage = 'deletion: a deleted material cannot become a new source of a reply';
  const evidence = evidenceFor('quoting the deleted words', await audienceRef(worldId));
  await actAs('service_role');
  assert.equal((await reply(a, thirdCommand, worldId, 'quoting the deleted words', evidence, [firstMaterial])).outcome, 'STALE');
  await asOwner();
  const [{ replies }] = await rows(`SELECT count(*)::int AS replies FROM public.shared_world_materials WHERE world_id = $1 AND producer_kind = 'QANDEEL'`, [worldId]);
  assert.equal(replies, 1);
}

async function verifyFormerMemberAndClosure({ a, b }, worldId, { thirdCommand }) {
  stage = 'former member: evidence produced before a leave is stale after it, even under a lease granted before it';
  const beforeLeave = evidenceFor('late reply', await audienceRef(worldId));
  await actAs('service_role');
  const held = await beginWork(thirdCommand, worldId, a);
  assert.equal(held.work_outcome, 'GRANTED');
  await asOwner(a);
  const [left] = await rows('SELECT outcome FROM public.commit_shared_world_standard_voluntary_leave_v1($1, $2, $3)', [randomUUID(), worldId, randomUUID()]);
  assert.equal(left.outcome, 'LEFT');
  await actAs('service_role');
  assert.equal((await complete(held.work_lease_id, thirdCommand, worldId, 'late reply', beforeLeave)).outcome, 'STALE');
  await actAs('service_role');
  assert.equal(await endWork(thirdCommand, held.work_lease_id), false, 'completing returned the lease, whatever the outcome');
  assert.deepEqual(await beginWork(thirdCommand, worldId, a), { work_outcome: 'UNAVAILABLE', work_lease_id: null, reply_material_id: null },
    'a requester who left starts no new provider work in the World');
  stage = 'former member: a former member reads nothing and cannot send; the remaining member still can';
  await actAs('authenticated', a);
  assert.deepEqual(await listMaterial(worldId), []);
  assert.equal((await send(randomUUID(), worldId, 'from outside')).outcome, 'UNAVAILABLE');
  await actAs('authenticated', b);
  assert.ok((await listMaterial(worldId)).length > 0);
  const aloneCommand = randomUUID();
  const alone = await send(aloneCommand, worldId, 'still here');
  assert.equal(alone.outcome, 'COMMITTED');
  const currentEvidence = evidenceFor('reply to the one who stayed', await audienceRef(worldId));
  await actAs('service_role');
  const current = await reply(b, aloneCommand, worldId, 'reply to the one who stayed', currentEvidence);
  assert.equal(current.outcome, 'MATERIAL_COMMITTED', 'generated under the current audience, the remaining member\'s reply commits');

  stage = 'closed gate: a committed command still replays; new sends and replies are refused; deletion is untouched';
  await asOwner();
  await setGate('SHARED_CONVERSATION', 'EMERGENCY_DISABLED', 'SATISFIED');
  await actAs('authenticated', b);
  assert.equal((await send(randomUUID(), worldId, 'after the disable')).outcome, 'UNAVAILABLE');
  const replayed = await send(thirdCommand === null ? randomUUID() : thirdCommand, worldId, 'third');
  assert.equal(replayed.outcome, 'UNAVAILABLE', 'another human\'s committed command is not this human\'s replay');
  await actAs('authenticated', b);
  assert.deepEqual(await deleteOwn(randomUUID(), worldId, alone.material_id), { outcome: 'DELETED' });
  await actAs('service_role');
  assert.equal((await reply(b, randomUUID(), worldId, 'x', evidenceFor('x', await audienceRef(worldId)))).outcome, 'UNAVAILABLE');
  await asOwner();
  await setGate('SHARED_CONVERSATION', 'ENABLED', 'SATISFIED');

  stage = 'closed World: ordinary sends are refused, the owner still deletes their own material';
  await actAs('authenticated', b);
  const lastWord = await send(randomUUID(), worldId, 'last word before closing');
  assert.equal(lastWord.outcome, 'COMMITTED');
  await asOwner();
  const proposal = randomUUID();
  const [prepared] = await rows('SELECT outcome FROM public.prepare_shared_world_standard_end_governance_v1($1, $2, $3, $4)', [proposal, randomUUID(), randomUUID(), worldId]);
  assert.equal(prepared.outcome, 'PREPARED');
  await asOwner(b);
  const [approved] = await rows('SELECT outcome FROM public.commit_shared_world_governance_approval_v1($1, $2)', [randomUUID(), proposal]);
  assert.equal(approved.outcome, 'APPROVED');
  await asOwner();
  const [ended] = await rows('SELECT outcome FROM public.commit_shared_world_standard_end_v1($1, $2, $3)', [randomUUID(), proposal, randomUUID()]);
  assert.equal(ended.outcome, 'WORLD_ENDED');
  await actAs('authenticated', b);
  assert.equal((await send(randomUUID(), worldId, 'after closure')).outcome, 'UNAVAILABLE');
  assert.deepEqual(await listMaterial(worldId), [], 'a closed World is not entered through the ordinary conversation read (S4-03 owns the closed view)');
  assert.deepEqual(await deleteOwn(randomUUID(), worldId, lastWord.material_id), { outcome: 'DELETED' }, 'a privacy mutation survives closure');
  await asOwner();
  const [world] = await rows('SELECT lifecycle FROM public.shared_worlds WHERE id = $1', [worldId]);
  assert.equal(world.lifecycle, 'READ_ONLY_CLOSED', 'deletion never reopened the World');
}

// ------------------------------------------------------------------------------------------------------
// Stage 7 — concurrency on committed state.
// ------------------------------------------------------------------------------------------------------
async function waitUntilBlocked(pid) {
  for (let i = 0; i < 200; i += 1) {
    const [row] = await rows('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
    if (row?.wait_event_type === 'Lock') return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('the second transaction never blocked on the first');
}

async function verifyConcurrency() {
  const humans = [randomUUID(), randomUUID()];
  const [inviter, target] = humans;
  const suffix = randomUUID().slice(0, 8).replace(/[^a-z0-9]/gu, 'x');
  await client.query('CREATE TEMP TABLE s402_prior_gate ON COMMIT PRESERVE ROWS AS SELECT * FROM shared_private.shared_launch_capability_states');
  const [{ priorGateRows }] = await rows('SELECT count(*)::int AS "priorGateRows" FROM s402_prior_gate');
  const [{ lastEvent }] = await rows('SELECT COALESCE(max(id), 0)::bigint AS "lastEvent" FROM shared_private.shared_launch_capability_events');
  let failed = false;
  let worldId = null;
  const one = new Client({ connectionString: databaseUrl });
  const two = new Client({ connectionString: databaseUrl });
  await one.connect();
  await two.connect();
  try {
    stage = 'concurrency: committed fixtures';
    await client.query('BEGIN');
    await asOwner();
    await signUp(client, inviter, 'Racer Inviter', `s402racer0${suffix}`);
    await signUp(client, target, 'Racer Target', `s402racer1${suffix}`);
    worldId = await bornWorld(inviter, target);
    await setGate('SHARED_CONVERSATION', 'ENABLED', 'SATISFIED');
    await asOwner();
    await client.query('COMMIT');
    await client.query('RESET ROLE');

    stage = 'concurrency: two identical sends commit one material';
    const command = randomUUID();
    const [{ pid }] = await rows('SELECT pg_backend_pid() AS pid', [], two);
    await one.query('BEGIN');
    await actAs('authenticated', target, one);
    const winner = await send(command, worldId, 'said twice at once', one);
    assert.equal(winner.outcome, 'COMMITTED');
    await two.query('BEGIN');
    await actAs('authenticated', target, two);
    const loser = send(command, worldId, 'said twice at once', two);
    await waitUntilBlocked(pid);
    await one.query('COMMIT');
    const lost = await loser;
    assert.deepEqual([lost.outcome, lost.material_id], ['COMMITTED', winner.material_id]);
    await two.query('COMMIT');
    const [{ materials }] = await rows(`SELECT count(*)::int AS materials FROM public.shared_world_materials WHERE world_id = $1 AND producer_kind = 'HUMAN'`, [worldId]);
    assert.equal(materials, 1);

    stage = 'concurrency: two replies for one human command commit one reply';
    const evidenceA = evidenceFor('reply one', await audienceRef(worldId));
    const evidenceB = evidenceFor('reply two', await audienceRef(worldId));
    await client.query('RESET ROLE');
    const [{ pid: pidTwo }] = await rows('SELECT pg_backend_pid() AS pid', [], two);
    await one.query('BEGIN');
    await actAs('service_role', null, one);
    const firstReply = await reply(target, command, worldId, 'reply one', evidenceA, [], [], one);
    assert.equal(firstReply.outcome, 'MATERIAL_COMMITTED');
    await two.query('BEGIN');
    await actAs('service_role', null, two);
    const secondReply = reply(target, command, worldId, 'reply two', evidenceB, [], [], two);
    await waitUntilBlocked(pidTwo);
    await one.query('COMMIT');
    const second = await secondReply;
    assert.deepEqual([second.outcome, second.material_id], ['MATERIAL_COMMITTED', firstReply.material_id]);
    await two.query('COMMIT');
    const [{ replies }] = await rows(`SELECT count(*)::int AS replies FROM public.shared_world_materials WHERE world_id = $1 AND producer_kind = 'QANDEEL'`, [worldId]);
    assert.equal(replies, 1);

    stage = 'concurrency: concurrent begins across connections grant one lease — the second waits on the requester lock and starts nothing';
    const leaseCommand = randomUUID();
    await one.query('BEGIN');
    await actAs('authenticated', target, one);
    assert.equal((await send(leaseCommand, worldId, 'asked from two devices', one)).outcome, 'COMMITTED');
    await one.query('COMMIT');
    await one.query('BEGIN');
    await actAs('service_role', null, one);
    const won = await beginWork(leaseCommand, worldId, target, one);
    assert.equal(won.work_outcome, 'GRANTED');
    await two.query('BEGIN');
    await actAs('service_role', null, two);
    const racing = beginWork(leaseCommand, worldId, target, two);
    await waitUntilBlocked(pidTwo);
    await one.query('COMMIT');
    assert.deepEqual(await racing, { work_outcome: 'IN_PROGRESS', work_lease_id: null, reply_material_id: null });
    await two.query('COMMIT');
    await client.query('RESET ROLE');
    const [{ leases }] = await rows('SELECT count(*)::int AS leases FROM shared_private.shared_qandeel_reply_work_leases WHERE human_command_id = $1', [leaseCommand]);
    assert.equal(leases, 1, 'one live lease, whichever instance asked');
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (!failed) stage = 'concurrency: fixture removal';
    for (const extra of [one, two]) await extra.query('ROLLBACK').catch((error) => { if (error?.code !== '25P01') throw error; });
    await one.end();
    await two.end();
    await client.query('ROLLBACK').catch((error) => { if (error?.code !== '25P01') throw error; });
    await client.query('RESET ROLE');
    const worldIds = (await rows('SELECT world_id FROM public.shared_world_membership_episodes WHERE user_id = ANY($1::uuid[])', [humans])).map((r) => r.world_id);
    const scoped = async (table, column = 'world_id') => client.query(`DELETE FROM public.${table} WHERE ${column} = ANY($1::uuid[])`, [worldIds]);
    await scoped('shared_world_material_delete_commands');
    await scoped('shared_world_material_deleted_events');
    await scoped('shared_world_material_commit_commands');
    await scoped('shared_world_material_historical_authority');
    await scoped('shared_world_qandeel_material_evidence');
    await scoped('shared_world_material_dependencies');
    await client.query('DELETE FROM public.shared_world_text_material_bodies WHERE material_id IN (SELECT id FROM public.shared_world_materials WHERE world_id = ANY($1::uuid[]))', [worldIds]);
    await scoped('shared_world_materials');
    await client.query('DELETE FROM public.shared_world_history_item_required_approvers WHERE history_item_id IN (SELECT id FROM public.shared_world_history_items WHERE world_id = ANY($1::uuid[]))', [worldIds]);
    await client.query('DELETE FROM public.shared_world_history_item_baseline_viewers WHERE history_item_id IN (SELECT id FROM public.shared_world_history_items WHERE world_id = ANY($1::uuid[]))', [worldIds]);
    await scoped('shared_world_history_items');
    await scoped('shared_world_direct_acceptance_commands');
    await scoped('shared_world_direct_birth_events');
    await scoped('shared_world_membership_episodes');
    await client.query('DELETE FROM public.shared_worlds WHERE id = ANY($1::uuid[])', [worldIds]);
    await client.query('DELETE FROM public.shared_world_invitation_commands WHERE actor_user_id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM public.shared_world_direct_invitations WHERE inviter_user_id = ANY($1::uuid[]) OR target_user_id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM public.shared_world_invite_credential_state WHERE user_id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM shared_private.shared_launch_capability_events WHERE id > $1', [lastEvent]);
    await client.query('DELETE FROM shared_private.shared_launch_capability_states s WHERE NOT EXISTS (SELECT 1 FROM s402_prior_gate p WHERE p.capability_scope = s.capability_scope)');
    await client.query(`UPDATE shared_private.shared_launch_capability_states s SET feature_flag_state = p.feature_flag_state,
      launch_requirements_state = p.launch_requirements_state, restriction_version = p.restriction_version, decided_by = p.decided_by,
      policy_basis = p.policy_basis, decided_at = p.decided_at FROM s402_prior_gate p WHERE p.capability_scope = s.capability_scope`);
    await client.query('DROP TABLE s402_prior_gate');
    const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM public.shared_world_membership_episodes WHERE user_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM public.shared_worlds WHERE id = ANY($2::uuid[]))
      + (SELECT count(*) FROM public.shared_world_materials WHERE world_id = ANY($2::uuid[]))
      + (SELECT count(*) FROM shared_private.shared_qandeel_reply_work_leases WHERE requester_user_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM shared_private.shared_qandeel_reply_work_grants WHERE requester_user_id = ANY($1::uuid[])) AS residue`, [humans, worldIds]);
    assert.equal(Number(residue), 0, 'the committed fixtures are gone');
    const [{ gateRows }] = await rows('SELECT count(*)::int AS "gateRows" FROM shared_private.shared_launch_capability_states');
    assert.equal(gateRows, priorGateRows, 'the gate is restored');
  }
}

async function main() {
  try {
    await client.connect();
    await client.query('BEGIN');
    try {
      await verifyBoundary();
      stage = 'fixtures';
      const humans = { a: randomUUID(), b: randomUUID(), c: randomUUID(), d: randomUUID() };
      const suffix = randomUUID().slice(0, 8).replace(/[^a-z0-9]/gu, 'x');
      await signUp(client, humans.a, 'Amal Invitee', `s402amal${suffix}`);
      await signUp(client, humans.b, 'Bassem Inviter', `s402bassem${suffix}`);
      await signUp(client, humans.c, 'Chadi Outsider', `s402chadi${suffix}`);
      await signUp(client, humans.d, 'Dalia Elsewhere', `s402dalia${suffix}`);
      const worldId = await bornWorld(humans.b, humans.a);
      const otherWorldId = await bornWorld(humans.d, humans.c);
      await verifyClosedGate(humans, worldId);
      const sent = await verifyHumanText(humans, worldId, otherWorldId);
      await verifyRead(humans, worldId, otherWorldId, sent);
      const replied = await verifyQandeelReply(humans, worldId, otherWorldId, sent);
      // In the other World, between its own two members, so the main World's reply counts stay exact.
      await verifyWorkLease({ a: humans.c, b: humans.d }, otherWorldId);
      await verifyDeletion(humans, worldId, { ...sent, ...replied });
      await verifyFormerMemberAndClosure(humans, worldId, replied);
    } finally {
      await client.query('ROLLBACK');
    }
    await verifyConcurrency();
    console.log('Verified migration 0139: server-owned boundary, fail-closed conversation gate, idempotent human text, Product-safe read, one QANDEEL reply per human command with re-checked evidence under a durable work lease (one per command, in-flight bound, work-start budget, expiry), owner deletion, former membership, closure, concurrency.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Database verification failed at ${stage} (${code}). Connection details were suppressed.`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  // A PostgreSQL refusal's own message names the object, never the connection.
  else if (typeof error?.code === 'string' && typeof error?.message === 'string') console.error(error.message.slice(0, 300));
  process.exitCode = 1;
});
