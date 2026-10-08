// SHARED-VIS-01 — Shared World Living Analysis Map: the real-PostgreSQL verifier for migration 0148.
//
// It proves, against a fully migrated database:
//   1. the boundary: every 0148 private function is a pinned postgres-owned SECURITY DEFINER in `shared_semantic_private`
//      and every exposed wrapper a SECURITY INVOKER; `authenticated` executes exactly the four member reads, `service_role`
//      exactly the four pass commands, anon nothing, and nobody an internal derivation; the four relations are private,
//      RLS-enabled and unreachable; the frozen 0090 QANDEEL core and the 0089 resolver keep their ACL; no relation
//      references an account; the S4-01 … S4-04 `shared_private` surface gains nothing;
//   2. the place: a pass needs a committed human message of this exact ACTIVE World and an open conversation capability;
//      one live pass per World; the current lease holder commits ONE QANDEEL_ANALYSIS material per pass and ordinal
//      through the frozen core — its sources are exact MATERIAL_DEPENDENCY edges, its required approvers the sources'
//      authors, its body the meaning; a retry answers the committed place; a source of another World, another place or a
//      foreign kind is refused; forged evidence is 22023 and a stale audience STALE; a completed pass starts nothing again;
//      the place is append-only and can be inserted only for a QANDEEL_ANALYSIS material of its own World;
//   3. visibility (D3): every current member who may see every source reads the place at its committed coordinates, with
//      its themes and its exact sources (self / Name / QANDEEL); a non-member reads nothing; a newcomer who cannot see one
//      source does not read the place — until a history grant lets them see that source; a member who left reads nothing;
//   4. deletion (D4): an owner deletion of ANY source removes the place's meaning, themes, region and coordinates at once
//      (the frozen MATERIAL_DEPENDENCY closure + ON DELETE CASCADE) for every reader and from the interpreter's context;
//      QANDEEL's conversational reply (never an eligible source) stays;
//   5. the ended World: the v2 closed read is the 0140 read without semantic places (the 0140 read is unchanged).
//
// Everything runs inside one transaction that is rolled back.
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
const first = async (text, values = [], on = client) => (await rows(text, values, on))[0];

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

async function actAs(role, userId = null, on = client) {
  await on.query('RESET ROLE');
  await on.query(`SET LOCAL ROLE ${role}`);
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role } : { role })]);
}
async function asOwner(userId = null, on = client) {
  await on.query('RESET ROLE');
  await on.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId } : {})]);
}

const digest = (text) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
const readinessRef = (e) => `sha256:${createHash('sha256').update([
  'QANDEEL_CWV2_SHARED_PRIVACY_AUTHORITY_DELIVERY_READINESS_V1',
  `effectiveContext=${e.effectiveContextRef}`, `output=${e.outputDigest}`,
  `sourceDisclosureGate=${e.sourceDisclosureGateRef}`, `authorityRevalidation=${e.authorityRevalidationRef}`,
].join('\n'), 'utf8').digest('hex')}`;
async function audienceRef(worldId) {
  await asOwner();
  const members = await rows('SELECT user_id, membership_episode_id FROM public.resolve_shared_world_human_audience_snapshot_v1($1)', [worldId]);
  const byCodeUnit = (l, r) => (l < r ? -1 : l > r ? 1 : 0);
  const rendered = members.map((m) => ({ user: String(m.user_id).toLowerCase(), episode: String(m.membership_episode_id).toLowerCase() }))
    .sort((l, r) => byCodeUnit(l.user, r.user) || byCodeUnit(l.episode, r.episode)).map((m) => `${m.user}@${m.episode}`).join(',');
  return `sha256:${createHash('sha256').update(['QANDEEL_CWV2_SHARED_HUMAN_AUDIENCE_SNAPSHOT_V1', 'state=RESOLVED',
    `world=${String(worldId).toLowerCase()}`, `members=${rendered}`].join('\n'), 'utf8').digest('hex')}`;
}
function evidenceFor(body, audienceSnapshotRef) {
  const e = { effectiveContextRef: `ec:svis:${randomUUID()}`, outputDigest: digest(body), sourceDisclosureGateRef: `gate:svis:${randomUUID()}`,
    authorityRevalidationRef: `rev:svis:${randomUUID()}`, audienceSnapshotRef };
  return { ...e, readiness: readinessRef(e) };
}

const setGate = async (scope, flag, requirements) =>
  first('SELECT * FROM shared_private.set_shared_launch_capability_v1($1, $2, $3, $4, $5)', [scope, flag, requirements, 'shared-vis-01-verifier', 'verification fixture']);
const send = async (worldId, content) => first('SELECT * FROM public.send_shared_world_human_text_v1($1, $2, $3)', [randomUUID(), worldId, content]);
const deleteOwn = async (worldId, materialId) =>
  (await first('SELECT * FROM public.delete_own_shared_world_material_v1($1, $2, $3)', [randomUUID(), worldId, materialId])).outcome;
const commandOf = async (materialId) => {
  await asOwner();
  return (await first('SELECT id FROM public.shared_world_material_commit_commands WHERE material_id = $1', [materialId])).id;
};

// The member reads.
const field = async (worldId) => rows('SELECT * FROM public.list_own_shared_semantic_field_v1($1)', [worldId]);
const place = async (worldId, placeId) => rows('SELECT * FROM public.read_own_shared_semantic_place_v1($1, $2)', [worldId, placeId]);
const sources = async (worldId, placeId) => rows('SELECT * FROM public.list_own_shared_semantic_place_sources_v1($1, $2)', [worldId, placeId]);
// The server's acts.
const begin = async (passCommandId, worldId) => first('SELECT * FROM public.begin_shared_semantic_work_v1($1, $2)', [passCommandId, worldId]);
const context = async (leaseId, worldId) => rows('SELECT * FROM public.read_shared_semantic_context_v1($1, $2)', [leaseId, worldId]);
const end = async (passCommandId, leaseId, completed) =>
  (await first('SELECT public.end_shared_semantic_work_v1($1, $2, $3) AS returned', [passCommandId, leaseId, completed])).returned;
const PLACE = { primary: ['family'], secondary: ['trust'], region: 'family', layout: 'test.deterministic.v1', x: '123456789', y: '-987654321' };
async function complete(leaseId, passCommandId, ordinal, worldId, meaning, sourceIds, e, shape = PLACE) {
  return first(`SELECT * FROM public.complete_shared_semantic_place_v1($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [leaseId, passCommandId, ordinal, worldId, meaning, e.effectiveContextRef, e.outputDigest, e.sourceDisclosureGateRef,
      e.authorityRevalidationRef, e.readiness, e.audienceSnapshotRef, sourceIds, shape.primary, shape.secondary, shape.region,
      shape.layout, shape.x, shape.y]);
}
/** One whole server pass committing ONE place, exactly as the API runs it (begin, complete, end). */
async function pass(passCommandId, worldId, meaning, sourceIds, shape = PLACE) {
  const e = evidenceFor(meaning, await audienceRef(worldId));
  await actAs('service_role');
  const work = await begin(passCommandId, worldId);
  assert.equal(work.work_outcome, 'GRANTED');
  const done = await complete(work.work_lease_id, passCommandId, 1, worldId, meaning, sourceIds, e, shape);
  assert.equal(done.outcome, 'MATERIAL_COMMITTED');
  assert.equal(await end(passCommandId, work.work_lease_id, true), true);
  await asOwner();
  return done.material_id;
}

async function signUp(id, name, loginId) {
  await client.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  await client.query('UPDATE public.users SET name = $2, login_id = $3 WHERE id = $1', [id, name, loginId]);
}
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
/** A governed add-member through the frozen 0085 cores, driven as the owner with each exact human's claims (fixture only). */
async function addMember(worldId, newcomer, current) {
  await asOwner();
  const proposal = randomUUID();
  const [prepared] = await rows('SELECT outcome FROM public.prepare_shared_world_add_member_governance_v1($1, $2, $3, $4, $5)',
    [proposal, randomUUID(), randomUUID(), worldId, newcomer]);
  assert.equal(prepared.outcome, 'PREPARED');
  for (const human of current) {
    await asOwner(human);
    await rows('SELECT outcome FROM public.commit_shared_world_governance_approval_v1($1, $2)', [randomUUID(), proposal]);
  }
  await asOwner();
  const invitation = randomUUID();
  await rows('SELECT outcome FROM public.dispatch_shared_world_member_invitation_v1($1, $2)', [invitation, proposal]);
  await asOwner(newcomer);
  const [joined] = await rows('SELECT outcome FROM public.accept_shared_world_member_invitation_v1($1, $2, $3, $4)',
    [randomUUID(), invitation, randomUUID(), randomUUID()]);
  assert.equal(joined.outcome, 'JOINED');
  await asOwner();
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
}
async function qandeelReply(requester, humanCommandId, worldId, body) {
  const e = evidenceFor(body, await audienceRef(worldId));
  await actAs('service_role');
  const [work] = await rows('SELECT * FROM public.begin_shared_qandeel_reply_work_v1($1, $2, $3)', [humanCommandId, worldId, requester]);
  assert.equal(work.work_outcome, 'GRANTED');
  const [done] = await rows('SELECT * FROM public.complete_shared_world_qandeel_reply_v1($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
    [work.work_lease_id, humanCommandId, worldId, body, e.effectiveContextRef, e.outputDigest, e.sourceDisclosureGateRef, e.authorityRevalidationRef,
      e.readiness, e.audienceSnapshotRef, [], []]);
  assert.equal(done.outcome, 'MATERIAL_COMMITTED');
  await asOwner();
  return done.material_id;
}

const MEMBER_READS = {
  list_own_shared_semantic_field_v1: '(uuid)',
  read_own_shared_semantic_place_v1: '(uuid,uuid)',
  list_own_shared_semantic_place_sources_v1: '(uuid,uuid)',
  list_own_closed_shared_world_material_v2: '(uuid,timestamp with time zone,uuid,integer)',
};
const SERVER_ACTS = {
  begin_shared_semantic_work_v1: '(uuid,uuid)',
  read_shared_semantic_context_v1: '(uuid,uuid)',
  complete_shared_semantic_place_v1: '(uuid,uuid,integer,uuid,text,text,text,text,text,text,text,uuid[],text[],text[],text,text,bigint,bigint)',
  end_shared_semantic_work_v1: '(uuid,uuid,boolean)',
};
const RELATIONS = ['semantic_places', 'semantic_passes', 'semantic_work_leases', 'semantic_work_grants'];

// ------------------------------------------------------------------------------------------------------
// Stage 1 — the boundary.
// ------------------------------------------------------------------------------------------------------
async function verifyBoundary() {
  stage = 'boundary: pinned definers, INVOKER wrappers';
  await asOwner();
  const privateFns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'shared_semantic_private'`);
  assert.ok(privateFns.length >= 15);
  for (const f of privateFns) {
    assert.equal(f.prosecdef, true, `shared_semantic_private.${f.proname} is SECURITY DEFINER`);
    assert.equal(f.owner, 'postgres');
    assert.deepEqual(f.proconfig, ['search_path=""'], `shared_semantic_private.${f.proname} pins an empty search_path`);
  }
  const names = [...Object.keys(MEMBER_READS), ...Object.keys(SERVER_ACTS)];
  const wrappers = await rows(`SELECT p.proname, p.prosecdef, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [names]);
  assert.equal(wrappers.length, names.length);
  for (const f of wrappers) {
    assert.equal(f.prosecdef, false, `public.${f.proname} is SECURITY INVOKER`);
    assert.deepEqual(f.proconfig, ['search_path=""']);
  }

  stage = 'boundary: authenticated executes exactly the member reads; service_role exactly the pass commands';
  const executable = await rows(`SELECT r.rolname, n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role'), ('public')) AS r(rolname)
    WHERE (n.nspname = 'shared_semantic_private' OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND (r.rolname = 'public' OR EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2, 3`, [names]);
  const key = (r) => `${r.rolname} ${r.nspname}.${r.proname}`;
  const expected = [];
  for (const proname of Object.keys(MEMBER_READS)) for (const nspname of ['public', 'shared_semantic_private']) expected.push(key({ rolname: 'authenticated', nspname, proname }));
  for (const proname of Object.keys(SERVER_ACTS)) for (const nspname of ['public', 'shared_semantic_private']) expected.push(key({ rolname: 'service_role', nspname, proname }));
  assert.deepEqual(executable.map(key).sort(), expected.sort());

  stage = 'boundary: the relations are private, RLS-enabled and unreachable; no account reference';
  for (const table of RELATIONS) {
    const [{ rls }] = await rows('SELECT relrowsecurity AS rls FROM pg_class WHERE oid = $1::regclass', [`shared_semantic_private.${table}`]);
    assert.equal(rls, true, `${table} has row level security`);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const [{ reach }] = await rows('SELECT has_table_privilege($1, $2, $3) AS reach', [role, `shared_semantic_private.${table}`, 'SELECT,INSERT,UPDATE,DELETE']);
      assert.equal(reach, false, `${role} cannot reach ${table}`);
    }
  }
  const accounts = await rows(`SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'shared_semantic_private' AND c.contype = 'f' AND c.confrelid = 'public.users'::regclass`);
  assert.deepEqual(accounts, []);
  const [cascade] = await rows(`SELECT c.confdeltype FROM pg_constraint c WHERE c.conname = 'semantic_places_body_fk'`);
  assert.equal(cascade.confdeltype, 'c', 'the place is erased with its meaning body');

  stage = 'boundary: the frozen QANDEEL core and resolver keep their ACL; shared_private gains no server command';
  for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
    const [{ allowed }] = await rows("SELECT has_function_privilege($1, 'public.commit_shared_world_qandeel_material_v1(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,uuid[],text[])', 'EXECUTE') AS allowed", [role]);
    assert.equal(allowed, false, `${role} must not execute the frozen QANDEEL core`);
  }
  const [{ resolver }] = await rows("SELECT has_function_privilege('authenticated', 'public.resolve_shared_world_material_v1(uuid,uuid)', 'EXECUTE') AS resolver");
  assert.equal(resolver, false);
  const serverReach = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'shared_private' AND has_function_privilege('service_role', p.oid, 'EXECUTE') ORDER BY 1`);
  assert.deepEqual(serverReach.map((r) => r.proname),
    ['begin_shared_qandeel_reply_work_v1', 'complete_shared_world_qandeel_reply_v1', 'end_shared_qandeel_reply_work_v1']);
  const committing = await rows(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'commit\\_%' AND p.prosrc ~ 'shared_semantic_private'`);
  assert.deepEqual(committing, [], 'no `commit_%` endpoint joins the T-03D census');
}

// ------------------------------------------------------------------------------------------------------
// Stage 2 — the place.
// ------------------------------------------------------------------------------------------------------
async function verifyPlace(h, w) {
  stage = 'place: the closed capability starts no pass';
  await actAs('authenticated', h.a);
  const m1 = await send(w.one, 'We keep postponing the conversation about moving.');
  assert.equal(m1.outcome, 'COMMITTED');
  await asOwner();
  await setGate('SHARED_CONVERSATION', 'DISABLED', 'UNSATISFIED');
  await actAs('service_role');
  assert.equal((await begin(await commandOf(m1.material_id), w.one)).work_outcome, 'UNAVAILABLE');
  await asOwner();
  await setGate('SHARED_CONVERSATION', 'ENABLED', 'SATISFIED');

  stage = 'place: the sources — two humans (QANDEEL\'s conversational reply is in the conversation, never a source)';
  await actAs('authenticated', h.b);
  const m2 = await send(w.one, 'Because every time we start, it turns into a fight.');
  const replyId = await qandeelReply(h.b, await commandOf(m2.material_id), w.one, 'It sounds like the topic itself feels unsafe to open.');
  await actAs('authenticated', h.a);
  const m3 = await send(w.one, 'Maybe we should agree on a time first.');
  const pass3 = await commandOf(m3.material_id);

  stage = 'place: a pass needs a committed human message of this exact World';
  await actAs('service_role');
  assert.equal((await begin(randomUUID(), w.one)).work_outcome, 'UNAVAILABLE', 'an unknown command');
  assert.equal((await begin(pass3, w.two)).work_outcome, 'UNAVAILABLE', 'another World');
  const reply = await asOwner().then(() => first('SELECT id FROM public.shared_world_material_commit_commands WHERE material_id = $1', [replyId]));
  await actAs('service_role');
  assert.equal((await begin(reply.id, w.one)).work_outcome, 'UNAVAILABLE', 'QANDEEL\'s reply starts nothing');

  stage = 'place: one live pass per World';
  const work = await begin(pass3, w.one);
  assert.equal(work.work_outcome, 'GRANTED');
  assert.equal((await begin(pass3, w.one)).work_outcome, 'IN_PROGRESS');
  assert.equal((await begin(await commandOf(m1.material_id).then(async (id) => { await actAs('service_role'); return id; }), w.one)).work_outcome, 'IN_PROGRESS',
    'a second message of the same World waits for the live pass');
  assert.deepEqual(await context(work.work_lease_id, w.one), [], 'nothing placed yet');
  assert.deepEqual(await context(randomUUID(), w.one), [], 'no context without the live lease');

  stage = 'place: the shape is the API\'s, and is refused otherwise';
  const meaning = 'Moving keeps being postponed because opening it feels unsafe';
  const sourceIds = [m1.material_id, m2.material_id];
  const e = evidenceFor(meaning, await audienceRef(w.one));
  await actAs('service_role');
  for (const [what, args, shape] of [
    ['an ordinal beyond three', [work.work_lease_id, pass3, 4, w.one, meaning, sourceIds, e]],
    ['a multi-line meaning', [work.work_lease_id, pass3, 1, w.one, 'two\nlines', sourceIds, e]],
    ['no source', [work.work_lease_id, pass3, 1, w.one, meaning, [], e]],
    ['a meaning naming an identifier', [work.work_lease_id, pass3, 1, w.one, `about ${randomUUID()}`, sourceIds, e]],
    ['a repeated theme', [work.work_lease_id, pass3, 1, w.one, meaning, sourceIds, e], { ...PLACE, primary: ['a', 'A'] }],
    ['a theme both primary and secondary', [work.work_lease_id, pass3, 1, w.one, meaning, sourceIds, e], { ...PLACE, primary: ['a'], secondary: ['A'] }],
    ['a region that is not a key', [work.work_lease_id, pass3, 1, w.one, meaning, sourceIds, e], { ...PLACE, region: 'Not A Key' }],
    ['a coordinate beyond the bound', [work.work_lease_id, pass3, 1, w.one, meaning, sourceIds, e], { ...PLACE, x: '4611686018427387904' }],
    ['evidence for other bytes', [work.work_lease_id, pass3, 1, w.one, meaning, sourceIds, { ...e, outputDigest: digest('other') }]],
  ]) {
    stage = `place: refused — ${what}`;
    await rejected(() => complete(...args, shape), ['22023']);
  }
  stage = 'place: sources';

  stage = 'place: sources are this World\'s conversation only; only the lease holder commits';
  await actAs('authenticated', h.c);
  const foreign = await send(w.two, 'Words of another World');
  await actAs('service_role');
  assert.equal((await complete(work.work_lease_id, pass3, 1, w.one, meaning, [m1.material_id, foreign.material_id], e)).outcome, 'UNAVAILABLE');
  assert.equal((await complete(randomUUID(), pass3, 1, w.one, meaning, sourceIds, e)).outcome, 'UNAVAILABLE', 'not the lease holder');
  assert.equal((await complete(work.work_lease_id, pass3, 1, w.one, meaning, [...sourceIds, replyId], e)).outcome, 'UNAVAILABLE',
    'QANDEEL\'s conversational output is not an eligible source (its human requirement is UNRESOLVED under the frozen core)');

  stage = 'place: the holder commits ONE QANDEEL_ANALYSIS material, provenanced by its exact sources';
  const done = await complete(work.work_lease_id, pass3, 1, w.one, meaning, sourceIds, e);
  assert.equal(done.outcome, 'MATERIAL_COMMITTED');
  const again = await complete(work.work_lease_id, pass3, 1, w.one, meaning, sourceIds, evidenceFor(meaning, e.audienceSnapshotRef));
  assert.deepEqual([again.outcome, again.material_id], ['MATERIAL_COMMITTED', done.material_id], 'a retry answers the committed place');
  await asOwner();
  const [material] = await rows(`SELECT m.material_kind, m.producer_kind, m.author_user_id, b.body_text FROM public.shared_world_materials m
    JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id WHERE m.id = $1`, [done.material_id]);
  assert.deepEqual(material, { material_kind: 'QANDEEL_ANALYSIS', producer_kind: 'QANDEEL', author_user_id: null, body_text: meaning });
  const edges = await rows(`SELECT dependency_kind, source_material_id FROM public.shared_world_material_dependencies WHERE target_material_id = $1`, [done.material_id]);
  assert.deepEqual(edges.map((d) => [d.dependency_kind, d.source_material_id]).sort(), sourceIds.map((id) => ['MATERIAL_DEPENDENCY', id]).sort());
  const approvers = await rows(`SELECT ra.approver_user_id FROM public.shared_world_history_item_required_approvers ra
    JOIN public.shared_world_materials m ON m.history_item_id = ra.history_item_id WHERE m.id = $1 ORDER BY 1`, [done.material_id]);
  assert.deepEqual(approvers.map((r) => r.approver_user_id).sort(), [h.a, h.b].sort(), 'the sources\' human authors, never "every member"');
  const [stored] = await rows('SELECT world_x::text AS x, world_y::text AS y, semantic_region, coordinate_scheme, primary_themes FROM shared_semantic_private.semantic_places WHERE material_id = $1', [done.material_id]);
  assert.deepEqual(stored, { x: PLACE.x, y: PLACE.y, semantic_region: 'family', coordinate_scheme: 'QANDEEL_SHARED_FIELD_V1', primary_themes: ['family'] });

  stage = 'place: a place cannot be a source; a stale audience is STALE';
  await actAs('service_role');
  const e2 = evidenceFor('A second reading', await audienceRef(w.one));
  await actAs('service_role');
  assert.equal((await complete(work.work_lease_id, pass3, 2, w.one, 'A second reading', [done.material_id], e2)).outcome, 'UNAVAILABLE', 'no meaning of a meaning');
  assert.equal((await complete(work.work_lease_id, pass3, 2, w.one, 'A second reading', [m3.material_id],
    evidenceFor('A second reading', `sha256:${'0'.repeat(64)}`))).outcome, 'STALE');

  stage = 'place: the pass ends once; a completed pass starts nothing again; the context carries the place and its sources';
  assert.equal(await end(pass3, randomUUID(), true), false, 'only the exact holder returns the lease');
  const ctx = await context(work.work_lease_id, w.one);
  assert.deepEqual(ctx.map((r) => [r.material_id, r.meaning, [...r.source_material_ids].sort()]), [[done.material_id, meaning, [...sourceIds].sort()]]);
  assert.equal(await end(pass3, work.work_lease_id, true), true);
  assert.equal((await begin(pass3, w.one)).work_outcome, 'DONE');
  await asOwner();
  assert.equal(Number((await first('SELECT place_count FROM shared_semantic_private.semantic_passes WHERE pass_command_id = $1', [pass3])).place_count), 1);

  stage = 'place: append-only; only a QANDEEL_ANALYSIS material of its own World is a place';
  await rejected(() => rows('UPDATE shared_semantic_private.semantic_places SET world_x = 0 WHERE material_id = $1', [done.material_id]), ['55000']);
  await rejected(() => rows('DELETE FROM shared_semantic_private.semantic_places WHERE material_id = $1', [done.material_id]), ['55000']);
  await rejected(() => rows('DELETE FROM shared_semantic_private.semantic_passes WHERE pass_command_id = $1', [pass3]), ['55000']);
  await rejected(() => rows(`INSERT INTO shared_semantic_private.semantic_places (material_id, world_id, pass_command_id, place_ordinal, interpretation_contract,
      primary_themes, secondary_themes, semantic_region, spatial_contract, layout_version, coordinate_scheme, world_x, world_y, committed_at)
    VALUES ($1, $2, $3, 3, 'SHARED_SEMANTIC_INTERPRETATION_V1', ARRAY['x'], ARRAY[]::text[], 'x', 'SHARED_SPATIAL_PLACEMENT_V1', 'v1', 'QANDEEL_SHARED_FIELD_V1', 0, 0, now())`,
  [m3.material_id, w.one, pass3]), ['55000']);
  return { m1, m2, m3, replyId, placeId: done.material_id, meaning };
}

// ------------------------------------------------------------------------------------------------------
// Stage 3 — visibility.
// ------------------------------------------------------------------------------------------------------
async function verifyVisibility(h, w, p) {
  stage = 'visibility: every current member who sees every source reads the place';
  for (const reader of [h.a, h.b]) {
    await actAs('authenticated', reader);
    const seen = await field(w.one);
    assert.deepEqual(seen.map((r) => [r.place_id, String(r.world_x), String(r.world_y), r.meaning, r.semantic_region]),
      [[p.placeId, PLACE.x, PLACE.y, p.meaning, 'family']]);
    const [one] = await place(w.one, p.placeId);
    assert.deepEqual([one.meaning, one.primary_themes, one.secondary_themes], [p.meaning, ['family'], ['trust']]);
    const from = await sources(w.one, p.placeId);
    assert.deepEqual(from.map((s) => s.material_id), [p.m1.material_id, p.m2.material_id], 'oldest first');
    assert.deepEqual(from.map((s) => [s.producer_kind, s.is_self, s.author_name]), [
      ['HUMAN', reader === h.a, 'Amal One'],
      ['HUMAN', reader === h.b, 'Bassem Two'],
    ]);
  }

  stage = 'visibility: a non-member and another World read nothing';
  await actAs('authenticated', h.x);
  assert.deepEqual(await field(w.one), []);
  assert.deepEqual(await place(w.one, p.placeId), []);
  assert.deepEqual(await sources(w.one, p.placeId), []);
  await actAs('authenticated', h.c);
  assert.deepEqual(await field(w.two), [], 'another World has its own (empty) field');
  assert.deepEqual(await place(w.two, p.placeId), [], 'a place is read only in its own World');

  stage = 'visibility: the active conversation carries the place\'s kind, so its Product projection can exclude it';
  await actAs('authenticated', h.a);
  const conversation = await rows('SELECT material_id, material_kind FROM public.list_own_shared_world_material_v1($1, NULL, NULL, 50)', [w.one]);
  assert.equal(conversation.find((r) => r.material_id === p.placeId)?.material_kind, 'QANDEEL_ANALYSIS');

  stage = 'visibility: a newcomer who cannot see one source does not read the place (D3)';
  await addMember(w.one, h.d, [h.a, h.b]);
  await actAs('authenticated', h.d);
  const dWords = await send(w.one, 'I am new here; what did I miss?');
  const late = await pass(await commandOf(dWords.material_id), w.one, 'The newcomer asks what they missed', [dWords.material_id, p.m3.material_id],
    { ...PLACE, primary: ['belonging'], region: 'belonging', x: '-5', y: '7' });
  await actAs('authenticated', h.d);
  assert.deepEqual((await field(w.one)).map((r) => r.place_id), [], 'm3 was said before D joined: the place reading it stays unseen');
  assert.deepEqual(await sources(w.one, late), []);
  await actAs('authenticated', h.a);
  assert.deepEqual((await field(w.one)).map((r) => r.place_id).sort(), [p.placeId, late].sort(), 'the members who see every source read both');
  const lateOnly = await pass(await (async () => { await actAs('authenticated', h.d); const said = await send(w.one, 'Thank you for including me.'); return commandOf(said.material_id); })(),
    w.one, 'The newcomer feels included', [dWords.material_id], { ...PLACE, primary: ['belonging'], region: 'belonging', x: '9', y: '9' });
  await actAs('authenticated', h.d);
  assert.deepEqual((await field(w.one)).map((r) => r.place_id), [lateOnly], 'a place read only from what D can see is D\'s too');

  stage = 'visibility: a history grant of the missing source lets the newcomer read the place';
  await asOwner();
  await setGate('SHARED_HISTORY_ACCESS', 'ENABLED', 'SATISFIED');
  await actAs('authenticated', h.a);
  const handle = (await rows('SELECT * FROM public.list_own_shared_world_member_handles_v1($1)', [w.one])).find((m) => m.member_name === 'Dalia Four').member_handle;
  const proposed = await first('SELECT * FROM public.propose_shared_world_history_share_v1($1, $2, $3, $4)', [randomUUID(), w.one, handle, [p.m3.material_id]]);
  assert.equal(proposed.outcome, 'PROPOSED');
  const approved = await first('SELECT * FROM public.approve_shared_world_history_share_v1($1, $2, $3)', [randomUUID(), w.one, proposed.package_id]);
  assert.equal(approved.outcome, 'GRANTED');
  await actAs('authenticated', h.d);
  assert.deepEqual((await field(w.one)).map((r) => r.place_id).sort(), [late, lateOnly].sort(), 'm3 is now D\'s to see, and so is the place reading it');

  stage = 'visibility: a member who left reads nothing';
  await actAs('authenticated', h.d);
  assert.equal((await first('SELECT * FROM public.leave_shared_world_v1($1, $2)', [randomUUID(), w.one])).outcome, 'LEFT');
  assert.deepEqual(await field(w.one), []);
  assert.deepEqual(await place(w.one, lateOnly), []);
  return { late, lateOnly };
}

// ------------------------------------------------------------------------------------------------------
// Stage 4 — deletion.
// ------------------------------------------------------------------------------------------------------
async function verifyDeletion(h, w, p, v) {
  stage = 'deletion: an owner deletion of one source removes the place — meaning, themes, region, coordinates — at once';
  await actAs('authenticated', h.b);
  assert.equal(await deleteOwn(w.one, p.m2.material_id), 'DELETED');
  for (const reader of [h.a, h.b]) {
    await actAs('authenticated', reader);
    assert.ok(!(await field(w.one)).some((r) => r.place_id === p.placeId), 'gone from the field');
    assert.deepEqual(await place(w.one, p.placeId), []);
    assert.deepEqual(await sources(w.one, p.placeId), []);
  }
  await asOwner();
  assert.deepEqual(await rows('SELECT 1 FROM shared_semantic_private.semantic_places WHERE material_id = $1', [p.placeId]), [], 'no derived text survives');
  assert.deepEqual(await rows('SELECT 1 FROM public.shared_world_text_material_bodies WHERE material_id = $1', [p.placeId]), [], 'no meaning survives');
  const [item] = await rows(`SELECT i.availability_state FROM public.shared_world_history_items i JOIN public.shared_world_materials m ON m.history_item_id = i.id
    WHERE m.id = $1`, [p.placeId]);
  assert.equal(item.availability_state, 'UNAVAILABLE', 'the envelope and its time remain as non-content history');
  assert.equal((await rows('SELECT 1 FROM public.shared_world_text_material_bodies WHERE material_id = $1', [p.replyId])).length, 1,
    'QANDEEL\'s conversational reply stays as historical discussion');
  assert.ok((await rows('SELECT 1 FROM shared_semantic_private.semantic_places WHERE material_id = $1', [v.late])).length === 1, 'an unrelated place stays');

  stage = 'deletion: the interpreter\'s context no longer carries it, and nothing regenerates it';
  await actAs('authenticated', h.a);
  const next = await send(w.one, 'Let us try again on Sunday.');
  await actAs('service_role');
  const work = await begin(await asOwner().then(() => commandOf(next.material_id)).then(async (id) => { await actAs('service_role'); return id; }), w.one);
  assert.equal(work.work_outcome, 'GRANTED');
  assert.ok(!(await context(work.work_lease_id, w.one)).some((r) => r.material_id === p.placeId));
  const e = evidenceFor('Trying again', await audienceRef(w.one));
  await actAs('service_role');
  assert.equal((await complete(work.work_lease_id, await asOwner().then(() => commandOf(next.material_id)).then(async (id) => { await actAs('service_role'); return id; }),
    1, w.one, 'Trying again', [p.m2.material_id, next.material_id], e)).outcome, 'STALE', 'a deleted source never acquires a new place');
}

// ------------------------------------------------------------------------------------------------------
// Stage 5 — the ended World.
// ------------------------------------------------------------------------------------------------------
async function verifyClosed(h, w) {
  stage = 'ended World: the v2 closed read excludes semantic places; the 0140 read is unchanged';
  await actAs('authenticated', h.c);
  const said = await send(w.two, 'A thought before the end');
  const placeId = await pass(await commandOf(said.material_id), w.two, 'A thought shared before the end', [said.material_id]);
  await actAs('authenticated', h.c);
  const proposed = await first('SELECT * FROM public.propose_shared_world_end_v1($1, $2)', [randomUUID(), w.two]);
  assert.equal((await first('SELECT * FROM public.approve_shared_world_proposal_v1($1, $2, $3)', [randomUUID(), w.two, proposed.proposal_id])).outcome, 'APPROVED');
  await actAs('authenticated', h.e);
  assert.equal((await first('SELECT * FROM public.approve_shared_world_proposal_v1($1, $2, $3)', [randomUUID(), w.two, proposed.proposal_id])).outcome, 'COMMITTED');
  await actAs('authenticated', h.c);
  const v1 = await rows('SELECT material_id FROM public.list_own_closed_shared_world_material_v1($1, NULL, NULL, 50)', [w.two]);
  const v2 = await rows('SELECT material_id FROM public.list_own_closed_shared_world_material_v2($1, NULL, NULL, 50)', [w.two]);
  assert.ok(v1.some((r) => r.material_id === placeId), 'the 0140 read is unchanged');
  assert.ok(!v2.some((r) => r.material_id === placeId) && v2.some((r) => r.material_id === said.material_id));
  assert.deepEqual(await field(w.two), [], 'an ended World has no active field');
  await actAs('authenticated', h.x);
  assert.deepEqual(await rows('SELECT * FROM public.list_own_closed_shared_world_material_v2($1, NULL, NULL, 50)', [w.two]), []);
}

async function main() {
  try {
    await client.connect();
    await client.query('BEGIN');
    try {
      await verifyBoundary();
      stage = 'fixtures';
      const h = { a: randomUUID(), b: randomUUID(), c: randomUUID(), d: randomUUID(), e: randomUUID(), x: randomUUID() };
      const suffix = randomUUID().slice(0, 8).replace(/[^a-z0-9]/gu, 'x');
      for (const [k, name] of [['a', 'Amal One'], ['b', 'Bassem Two'], ['c', 'Chadi Three'], ['d', 'Dalia Four'], ['e', 'Ehab Five'], ['x', 'Xena Outsider']]) {
        await signUp(h[k], name, `svis${k}${suffix}`);
      }
      const w = { one: await bornWorld(h.a, h.b), two: await bornWorld(h.c, h.e) };
      await asOwner();
      await setGate('SHARED_CONVERSATION', 'ENABLED', 'SATISFIED');
      await setGate('SHARED_GOVERNANCE', 'ENABLED', 'SATISFIED');
      const p = await verifyPlace(h, w);
      const v = await verifyVisibility(h, w, p);
      await verifyDeletion(h, w, p, v);
      await verifyClosed(h, w);
    } finally {
      await client.query('ROLLBACK');
    }
    console.log('Verified migration 0148: Shared semantic places — a pinned server-owned boundary; one live pass per World under the conversation capability; ONE QANDEEL_ANALYSIS material per place through the frozen core with exact MATERIAL_DEPENDENCY provenance and source-author approvers; append-only World-local placement; served only to current members who may see every source (history grants respected, newcomers and leavers excluded); erased with its meaning on any source deletion while conversational replies stay; ended-World conversation without places.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Database verification failed at ${stage} (${code}). Connection details were suppressed.`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  else if (typeof error?.code === 'string' && typeof error?.message === 'string') console.error(error.message.slice(0, 300), process.env.SVIS_DEBUG ? error.where : '');
  process.exitCode = 1;
});
