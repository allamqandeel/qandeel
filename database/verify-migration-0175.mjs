// S8A-04 CP2 — Shared Social Memory, Recall & Living Analysis: the real-PostgreSQL verifier for migration 0175.
//
// Against a database migrated through 0175, inside ONE transaction that is rolled back, it proves (amendment §11, Stage 0):
//   1. the boundary — the new relations are private, RLS-enabled and unreachable; the v1 writer, the unattributed context
//      read and the bare member reads are executable by nobody; `authenticated` executes exactly the v2 member reads and
//      `service_role` exactly the pass commands, the knowledge read and the Shared begin command; the composer and every
//      internal derivation by nobody; the attribution triggers are deferred to commit;
//   2. every §2.2 check of the atomic write — membership, holders and relayers as authors, the absent holder and its
//      relayer, the label rule, and every `revises` rule — and that a refusal writes nothing;
//   3. atomicity at commit — a V2 place without its attribution, or an attribution whose people break the holder rule, is
//      refused by the deferred constraint triggers;
//   4. the safe representation — P1–P6 in Arabic and English, several Names joined, a missing Name served as nothing; the
//      attribution-only readers (a V1 place is served by no reader);
//   5. deletion and history — a deleted source removes the place with its attribution, people and revision edges; the
//      earlier position stays SUPERSEDED when its successor is erased, and is served as earlier, never as current;
//   6. membership changes — the knowledge read serves only what EVERY current recipient may see, now;
//   7. isolation (§6) — the conversation reads, Public authoring (list and package by id) and Replay capture (by id) refuse
//      a place; a knowledge-bearing reply stays UNRESOLVED, is never an authoring source, and no Shared Replay can be
//      distributed;
//   8. the ledger (§5) — the Shared begin command verifies the payer is the author of the causing message of that World,
//      numbers attempts per (payer, message, family), is idempotent, and admits the two new families;
//   9. display safety on every surface (§11 condition 9) — every function `anon` or `authenticated` can execute that can
//      reach a Shared text body is enumerated from the catalogue and must be classified; then every classified function is
//      called under every member's token, and a seeded place's bare meaning (a unique marker) never appears outside its
//      composed frame.
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
const first = async (text, values = []) => (await rows(text, values))[0];
const count = async (text, values = []) => Number((await first(text, values)).n);

/** Expect `operation` to be refused with one of `codes`. Must run inside the open transaction. */
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
  assert.ok(codes.includes(refusal.code), `expected one of ${codes.join(', ')}, got ${refusal.code}: ${refusal.message}`);
  return refusal;
}

async function actAs(role, userId = null) {
  await client.query('RESET ROLE');
  await client.query(`SET LOCAL ROLE ${role}`);
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role } : { role })]);
}
async function asOwner(userId = null) {
  await client.query('RESET ROLE');
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId } : {})]);
}

// ------------------------------------------------------------------------------------------------- fixtures (0148's)
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
  const e = { effectiveContextRef: `ec:cp2:${randomUUID()}`, outputDigest: digest(body), sourceDisclosureGateRef: `gate:cp2:${randomUUID()}`,
    authorityRevalidationRef: `rev:cp2:${randomUUID()}`, audienceSnapshotRef };
  return { ...e, readiness: readinessRef(e) };
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
async function send(sender, worldId, content) {
  await actAs('authenticated', sender);
  const sent = await first('SELECT * FROM public.send_shared_world_human_text_v1($1, $2, $3)', [randomUUID(), worldId, content]);
  assert.equal(sent.outcome, 'COMMITTED');
  await asOwner();
  const { id } = await first('SELECT id FROM public.shared_world_material_commit_commands WHERE material_id = $1', [sent.material_id]);
  return { material: sent.material_id, command: id };
}
async function deleteOwn(owner, worldId, materialId) {
  await actAs('authenticated', owner);
  const { outcome } = await first('SELECT * FROM public.delete_own_shared_world_material_v1($1, $2, $3)', [randomUUID(), worldId, materialId]);
  await asOwner();
  return outcome;
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

// ------------------------------------------------------------------------------------------------- the 0175 acts
const COMPLETE_V2 = `SELECT * FROM public.complete_shared_semantic_place_v2($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
  $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`;
const SHAPE = { primary: ['family'], secondary: ['trust'], region: 'family', x: '0', y: '0' };
/**
 * One saved position: `attribution` is { nature, holders, absent, relayers, about, hedged, revises, labels }. Runs the
 * whole server pass (begin, complete, end) on the lease of `on` — the committed human message the pass rides on.
 */
async function writePosition(on, worldId, ordinal, meaning, sources, attribution, { lease = null, shape = SHAPE } = {}) {
  const e = evidenceFor(meaning, await audienceRef(worldId));
  await actAs('service_role');
  let leaseId = lease;
  if (leaseId === null) {
    const work = await first('SELECT * FROM public.begin_shared_semantic_work_v1($1, $2)', [on.command, worldId]);
    assert.equal(work.work_outcome, 'GRANTED', 'the pass is granted');
    leaseId = work.work_lease_id;
  }
  const a = { nature: 'VIEW', holders: [], absent: null, relayers: [], about: [], hedged: false, revises: null, labels: [], ...attribution };
  const row = await first(COMPLETE_V2, [leaseId, on.command, ordinal, worldId, meaning, e.effectiveContextRef, e.outputDigest,
    e.sourceDisclosureGateRef, e.authorityRevalidationRef, e.readiness, e.audienceSnapshotRef, sources, shape.primary, shape.secondary,
    shape.region, shape.x, shape.y, a.nature, a.holders, a.absent, a.relayers, a.about, a.hedged, a.revises, a.labels]);
  await asOwner();
  return { ...row, leaseId };
}
async function endPass(on, leaseId) {
  await actAs('service_role');
  await first('SELECT public.end_shared_semantic_work_v1($1, $2, true) AS returned', [on.command, leaseId]);
  await asOwner();
}
/** One whole pass committing ONE position; returns its place id. */
async function position(on, worldId, meaning, sources, attribution, shape) {
  const done = await writePosition(on, worldId, 1, meaning, sources, attribution, { shape });
  assert.equal(done.outcome, 'MATERIAL_COMMITTED', `the position «${meaning}» is committed`);
  await endPass(on, done.leaseId);
  return done.material_id;
}
const field = async (viewer, worldId, locale = null) => {
  await actAs('authenticated', viewer);
  const out = await rows('SELECT * FROM public.list_own_shared_semantic_field_v2($1, $2)', [worldId, locale]);
  await asOwner();
  return out;
};
const meaningsOf = async (viewer, worldId, locale = null) => (await field(viewer, worldId, locale)).map((r) => r.meaning);
const knowledge = async (worldId, viewer) => {
  await actAs('service_role');
  const out = await rows('SELECT * FROM public.list_shared_world_knowledge_v1($1, $2)', [worldId, viewer]);
  await asOwner();
  return out;
};
const snapshotCounts = async () => ({
  places: await count('SELECT count(*) n FROM shared_semantic_private.semantic_places'),
  attributions: await count('SELECT count(*) n FROM shared_semantic_private.semantic_place_attributions'),
  people: await count('SELECT count(*) n FROM shared_semantic_private.semantic_place_people'),
  revisions: await count('SELECT count(*) n FROM shared_semantic_private.semantic_place_revisions'),
  analyses: await count("SELECT count(*) n FROM public.shared_world_materials WHERE material_kind = 'QANDEEL_ANALYSIS'"),
});

// ------------------------------------------------------------------------------------------------- 1. the boundary
const MEMBER_READS_V2 = ['list_own_shared_semantic_field_v2', 'read_own_shared_semantic_place_v2', 'list_own_shared_semantic_place_sources_v2'];
const SERVER_ACTS_V2 = ['complete_shared_semantic_place_v2', 'read_shared_semantic_context_v2', 'list_shared_world_knowledge_v1'];
const REVOKED_V1 = ['complete_shared_semantic_place_v1', 'read_shared_semantic_context_v1', 'list_own_shared_semantic_field_v1',
  'read_own_shared_semantic_place_v1', 'list_own_shared_semantic_place_sources_v1'];
const INTERNAL = ['guard_semantic_attribution_v1', 'require_semantic_attribution_v1', 'join_names_v1', 'place_people_names_v1',
  'safe_meaning_v1', 'visible_places_v2', 'visible_places_v1', 'is_current_member_v1'];
const RELATIONS = ['semantic_place_attributions', 'semantic_place_people', 'semantic_place_revisions'];

async function verifyBoundary() {
  stage = 'boundary: who executes what in shared_semantic_private and its wrappers';
  await asOwner();
  const executable = await rows(`SELECT r.rolname, n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rolname)
    WHERE (n.nspname = 'shared_semantic_private' OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2, 3`,
  [[...MEMBER_READS_V2, ...SERVER_ACTS_V2, ...REVOKED_V1, 'begin_shared_semantic_work_v1', 'end_shared_semantic_work_v1',
    'list_own_closed_shared_world_material_v2']]);
  const key = (r) => `${r.rolname} ${r.nspname}.${r.proname}`;
  const both = (rolname, names) => names.flatMap((proname) => ['public', 'shared_semantic_private'].map((nspname) => key({ rolname, nspname, proname })));
  assert.deepEqual(executable.map(key).sort(), [
    ...both('authenticated', [...MEMBER_READS_V2, 'list_own_closed_shared_world_material_v2']),
    ...both('service_role', [...SERVER_ACTS_V2, 'begin_shared_semantic_work_v1', 'end_shared_semantic_work_v1']),
  ].sort(), 'the v2 member reads for a person, the pass, the knowledge read and the v2 writer for the server; nothing else');
  for (const proname of INTERNAL) {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const [{ allowed }] = await rows(`SELECT bool_or(has_function_privilege($1, p.oid, 'EXECUTE')) AS allowed FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'shared_semantic_private' AND p.proname = $2`, [role, proname]);
      assert.equal(allowed, false, `${role} must not execute the internal ${proname}`);
    }
  }
  const ledger = await rows(`SELECT r.rolname FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rolname)
    WHERE has_function_privilege(r.rolname, 'public.begin_ai_provider_call_v2(uuid,uuid,uuid,uuid,text,text,text,text,text)', 'EXECUTE')`);
  assert.deepEqual(ledger.map((r) => r.rolname), ['service_role'], 'the Shared begin command is the server channel\'s only');

  stage = 'boundary: the relations are private, RLS-enabled, unreachable, erased with their place, and registered for erasure';
  for (const table of RELATIONS) {
    const [{ rls }] = await rows('SELECT relrowsecurity AS rls FROM pg_class WHERE oid = $1::regclass', [`shared_semantic_private.${table}`]);
    assert.equal(rls, true, `${table} has row level security`);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const [{ reach }] = await rows('SELECT has_table_privilege($1, $2, $3) AS reach', [role, `shared_semantic_private.${table}`, 'SELECT,INSERT,UPDATE,DELETE']);
      assert.equal(reach, false, `${role} cannot reach ${table}`);
    }
    assert.equal(await count('SELECT count(*) n FROM account_erasure_private.coverage_registry WHERE relation = $1 AND coverage = $2',
      [`shared_semantic_private.${table}`, 'SHARED_STANDARD']), 1, `${table} joins the SHARED_STANDARD residue class`);
  }
  assert.deepEqual(await rows(`SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'shared_semantic_private' AND c.contype = 'f' AND c.confrelid = 'public.users'::regclass`), [], 'no relation references an account');
  const deferred = await rows(`SELECT tgname, tgdeferrable, tginitdeferred FROM pg_trigger WHERE tgconstraint <> 0 AND tgname = ANY($1::text[]) ORDER BY 1`,
    [['semantic_places_attribution_required', 'semantic_place_attributions_people_required']]);
  assert.deepEqual(deferred.map((t) => [t.tgname, t.tgdeferrable, t.tginitdeferred]),
    [['semantic_place_attributions_people_required', true, true], ['semantic_places_attribution_required', true, true]],
    'both attribution checks run at commit');
}

// ------------------------------------------------------------------------------------------------- 2–3. the write
async function verifyWrite(h, w) {
  stage = 'write: the conversation the positions rest on';
  const m1 = await send(h.mona, w.one, 'أحمد بيتعصب جدًا وقت أي خلاف');
  const m2 = await send(h.morad, w.one, 'ماما قالت إنها مش موافقة إننا نسافر الأسبوع الجاي');
  const m3 = await send(h.ahmed, w.one, 'أنا شايف إن السفر مناسب');
  const foreign = await send(h.xavier, w.two, 'Words of another World');

  stage = 'write: shape refusals (22023), before anything is read or written';
  const before = await snapshotCounts();
  const shapes = [
    ['an absent holder without a relayer', { absent: 'والدة مراد', relayers: [] }],
    ['an absent holder together with member holders', { holders: [h.morad], absent: 'والدة مراد', relayers: [h.morad] }],
    ['neither holders nor an absent holder', { holders: [] }],
    ['a person both holder and relayer', { holders: [h.mona], relayers: [h.mona] }],
    ['a nature that is not VIEW or CLAIM', { holders: [h.mona], nature: 'FACT' }],
    ['five holders', { holders: [h.mona, h.ahmed, h.morad, h.xavier, h.dalia] }],
    ['a meaning carrying a label this reading sent', { holders: [h.mona], labels: ['أحمد بيتعصب'] }],
    ['an absent label carrying a label this reading sent', { absent: 'مراد (2) ومامته', relayers: [h.morad], labels: ['مراد (2)'] }],
  ];
  for (const [what, attribution] of shapes) {
    stage = `write: refused — ${what}`;
    await client.query('SAVEPOINT shape');
    await rejected(() => writePosition(m1, w.one, 1, 'أحمد بيتعصب وقت الخلاف', [m1.material], attribution), ['22023']);
    await client.query('ROLLBACK TO SAVEPOINT shape');
  }
  assert.deepEqual(await snapshotCounts(), before, 'a refused shape writes nothing');

  stage = 'write: §2.2 refusals (ATTRIBUTION_REFUSED) write nothing';
  const refusals = [
    ['a holder who wrote none of the sources, with no relayer', [m1.material], { holders: [h.ahmed] }],
    ['a relayer who wrote none of the sources', [m2.material], { absent: 'والدة مراد', relayers: [h.mona] }],
    ['a person who is not a member of this World', [m1.material], { holders: [h.mona], about: [h.xavier] }],
    ['a holder who never joined this World', [m1.material], { holders: [h.mona, h.xavier] }],
  ];
  for (const [what, sources, attribution] of refusals) {
    stage = `write: refused — ${what}`;
    await client.query('SAVEPOINT refusal');
    const done = await writePosition(m1, w.one, 1, 'أحمد بيتعصب وقت الخلاف', sources, attribution);
    assert.equal(done.outcome, 'ATTRIBUTION_REFUSED', what);
    assert.deepEqual(await snapshotCounts(), before, `${what}: nothing of the place is written`);
    await client.query('ROLLBACK TO SAVEPOINT refusal');
  }
  stage = 'write: a source of another World is UNAVAILABLE, as in 0148';
  await client.query('SAVEPOINT foreign_world');
  assert.equal((await writePosition(m1, w.one, 1, 'أحمد بيتعصب وقت الخلاف', [m1.material, foreign.material], { holders: [h.mona] })).outcome, 'UNAVAILABLE');
  await client.query('ROLLBACK TO SAVEPOINT foreign_world');

  stage = 'write: a direct view, a relayed member view and N3 (an absent person\'s view, relayed) are saved whole';
  const monaView = await position(m1, w.one, 'أحمد بيتعصب وقت الخلاف', [m1.material], { holders: [h.mona], about: [h.ahmed] });
  const relayedView = await position(m3, w.one, 'السفر الأسبوع الجاي مناسب', [m3.material, m1.material],
    { holders: [h.ahmed], relayers: [h.mona], hedged: true });
  const n3 = await position(m2, w.one, 'مش موافقة على السفر الأسبوع الجاي', [m2.material],
    { absent: 'والدة مراد', relayers: [h.morad] });
  const people = await rows('SELECT material_id, person_role, user_id FROM shared_semantic_private.semantic_place_people WHERE material_id = ANY($1) ORDER BY 1, 2, 3',
    [[monaView, relayedView, n3]]);
  const of = (id) => people.filter((p) => p.material_id === id).map((p) => `${p.person_role}:${p.user_id}`).sort();
  assert.deepEqual(of(monaView), [`ABOUT:${h.ahmed}`, `HOLDER:${h.mona}`].sort());
  assert.deepEqual(of(relayedView), [`HOLDER:${h.ahmed}`, `RELAYER:${h.mona}`].sort());
  assert.deepEqual(of(n3), [`RELAYER:${h.morad}`], 'N3: the mother is a label, never an identity; Morad stays its relayer');
  const n3row = await first('SELECT * FROM shared_semantic_private.semantic_place_attributions WHERE material_id = $1', [n3]);
  assert.deepEqual([n3row.nature, n3row.absent_holder_label, n3row.standing], ['VIEW', 'والدة مراد', 'CURRENT']);
  const contracts = await first('SELECT interpretation_contract, spatial_contract, layout_version FROM shared_semantic_private.semantic_places WHERE material_id = $1', [n3]);
  assert.deepEqual(Object.values(contracts), ['SHARED_SEMANTIC_INTERPRETATION_V2', 'SHARED_SPATIAL_PLACEMENT_V2', 'shared_field_anchor_v1']);
  const stored = await rows(`SELECT absent_holder_label AS t FROM shared_semantic_private.semantic_place_attributions
    UNION ALL SELECT body_text FROM public.shared_world_text_material_bodies b JOIN shared_semantic_private.semantic_places p ON p.material_id = b.material_id`);
  assert.ok(stored.every((r) => r.t === null || !/(?<![\p{L}\p{N}])S[1-9][0-9]*(?![\p{L}\p{N}])/u.test(r.t)), 'no speaker token is stored');

  stage = 'write: a retry of the same pass and ordinal answers the committed place';
  const retry = await writePosition(m1, w.one, 1, 'something else entirely', [m1.material], { holders: [h.mona] }, { lease: randomUUID() });
  assert.deepEqual([retry.outcome, retry.material_id], ['MATERIAL_COMMITTED', monaView]);

  stage = 'write: revises — every refusal';
  const m4 = await send(h.mona, w.one, 'بصراحة أحمد بقى أهدى بكتير الأيام دي');
  const m5 = await send(h.morad, w.one, 'ماما رجعت قالت ممكن نسافر بعد العيد');
  const xPlace = await position(foreign, w.two, 'Words of another World, read', [foreign.material], { holders: [h.xavier] });
  const legacyWords = await send(h.ahmed, w.one, 'كلام قديم قبل الإسناد');
  const v1Place = await legacyV1Place(legacyWords, w.one);
  const revisesRefused = [
    ['a place of another World', m4, [m4.material], { holders: [h.mona], revises: xPlace }],
    ['a V1 place (no attribution)', m4, [m4.material], { holders: [h.mona], revises: v1Place }],
    ['a place held by someone else', m4, [m4.material], { holders: [h.mona], revises: relayedView }],
    ['an absent-held place, revised by a member-held one', m5, [m5.material], { holders: [h.morad], revises: n3 }],
    ['a member-held place, revised by an absent-held one', m5, [m5.material], { absent: 'والدة مراد', relayers: [h.morad], revises: monaView }],
    ['a place that does not exist', m4, [m4.material], { holders: [h.mona], revises: randomUUID() }],
  ];
  for (const [what, on, sources, attribution] of revisesRefused) {
    stage = `write: revises refused — ${what}`;
    await client.query('SAVEPOINT revises');
    const done = await writePosition(on, w.one, 1, 'موقف جديد', sources, attribution);
    assert.equal(done.outcome, 'ATTRIBUTION_REFUSED', what);
    await client.query('ROLLBACK TO SAVEPOINT revises');
  }

  stage = 'write: a revision supersedes the earlier position atomically';
  const monaLater = await position(m4, w.one, 'طريقة أحمد في الخلاف اتحسنت', [m4.material], { holders: [h.mona], about: [h.ahmed], revises: monaView });
  const n3Later = await position(m5, w.one, 'ممكن نسافر بعد العيد', [m5.material], { absent: 'والدة مراد', relayers: [h.morad], revises: n3 });
  assert.deepEqual((await rows('SELECT material_id, standing FROM shared_semantic_private.semantic_place_attributions WHERE material_id = ANY($1) ORDER BY standing, material_id',
    [[monaView, monaLater]])).map((r) => [r.material_id, r.standing]).sort(),
  [[monaLater, 'CURRENT'], [monaView, 'SUPERSEDED']].sort());
  assert.equal(await count('SELECT count(*) n FROM shared_semantic_private.semantic_place_revisions WHERE earlier_material_id = $1 AND later_material_id = $2', [n3, n3Later]), 1);

  stage = 'write: a SUPERSEDED position, or one that already has a successor, is never revised again';
  const m6 = await send(h.mona, w.one, 'لا أنا لسه شايفاه بيتعصب');
  await client.query('SAVEPOINT again');
  assert.equal((await writePosition(m6, w.one, 1, 'أحمد لسه بيتعصب', [m6.material], { holders: [h.mona], revises: monaView })).outcome, 'ATTRIBUTION_REFUSED');
  await client.query('ROLLBACK TO SAVEPOINT again');

  stage = 'write: the history is immutable for every role, the owner included';
  await rejected(() => client.query("UPDATE shared_semantic_private.semantic_place_attributions SET hedged = true WHERE material_id = $1", [monaLater]), ['55000']);
  await rejected(() => client.query("UPDATE shared_semantic_private.semantic_place_attributions SET standing = 'CURRENT' WHERE material_id = $1", [monaView]), ['55000']);
  await rejected(() => client.query("UPDATE shared_semantic_private.semantic_place_attributions SET standing = 'SUPERSEDED' WHERE material_id = $1", [relayedView]), ['55000']);
  await rejected(() => client.query('DELETE FROM shared_semantic_private.semantic_place_people WHERE material_id = $1', [monaLater]), ['55000']);
  await rejected(() => client.query('DELETE FROM shared_semantic_private.semantic_place_revisions WHERE later_material_id = $1', [monaLater]), ['55000']);

  stage = 'write: at commit, a V2 place without its attribution is refused (deferred constraint trigger)';
  await rejected(async () => {
    const m = await send(h.ahmed, w.one, 'رسالة لمكان بلا إسناد');
    const material = await coreAnalysis(m, w.one, 'مكان بلا إسناد', [m.material]);
    await client.query(`INSERT INTO shared_semantic_private.semantic_places (material_id, world_id, pass_command_id, place_ordinal,
      interpretation_contract, primary_themes, secondary_themes, semantic_region, spatial_contract, layout_version, coordinate_scheme,
      world_x, world_y, committed_at) VALUES ($1, $2, $3, 1, 'SHARED_SEMANTIC_INTERPRETATION_V2', ARRAY['x'], ARRAY[]::text[], 'x',
      'SHARED_SPATIAL_PLACEMENT_V2', 'shared_field_anchor_v1', 'QANDEEL_SHARED_FIELD_V1', 0, 0, now())`, [material, w.one, m.command]);
    await client.query('SET CONSTRAINTS shared_semantic_private.semantic_places_attribution_required IMMEDIATE');
  }, ['23514']);
  stage = 'write: at commit, an attribution whose absent holder has no relayer is refused';
  await rejected(async () => {
    const m = await send(h.ahmed, w.one, 'رسالة لإسناد ناقص');
    const material = await coreAnalysis(m, w.one, 'إسناد ناقص', [m.material]);
    await client.query(`INSERT INTO shared_semantic_private.semantic_places (material_id, world_id, pass_command_id, place_ordinal,
      interpretation_contract, primary_themes, secondary_themes, semantic_region, spatial_contract, layout_version, coordinate_scheme,
      world_x, world_y, committed_at) VALUES ($1, $2, $3, 1, 'SHARED_SEMANTIC_INTERPRETATION_V2', ARRAY['x'], ARRAY[]::text[], 'x',
      'SHARED_SPATIAL_PLACEMENT_V2', 'shared_field_anchor_v1', 'QANDEEL_SHARED_FIELD_V1', 0, 0, now())`, [material, w.one, m.command]);
    await client.query(`INSERT INTO shared_semantic_private.semantic_place_attributions (material_id, world_id, nature, absent_holder_label, hedged, standing)
      VALUES ($1, $2, 'VIEW', 'والدة مراد', false, 'CURRENT')`, [material, w.one]);
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  }, ['23514']);
  await client.query('SET CONSTRAINTS ALL DEFERRED');

  return { m1, m2, m3, m4, m5, m6, monaView, monaLater, relayedView, n3, n3Later, v1Place, xPlace, foreign };
}

/** A QANDEEL_ANALYSIS through the frozen 0090 core directly (owner), with nothing else: the atomicity fixture. */
async function coreAnalysis(on, worldId, meaning, sources) {
  const e = evidenceFor(meaning, await audienceRef(worldId));
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const row = await first(`SELECT c.committed_material_id FROM public.commit_shared_world_qandeel_material_v1($1, $2, $3, $4, 'QANDEEL_ANALYSIS', $5,
    $6, $7, $8, $9, $10, $11, $12, ARRAY[]::text[]) c`, [ids[0], worldId, ids[1], ids[2], meaning, e.effectiveContextRef, e.outputDigest,
    e.sourceDisclosureGateRef, e.authorityRevalidationRef, e.readiness, e.audienceSnapshotRef, sources]);
  void on;
  return row.committed_material_id;
}

/** A V1 place, through the 0148 writer the owner still holds (no application role does): a place with no attribution. */
async function legacyV1Place(on, worldId) {
  const meaning = 'A legacy unattributed reading';
  const e = evidenceFor(meaning, await audienceRef(worldId));
  await asOwner();
  const work = await first('SELECT * FROM shared_semantic_private.begin_shared_semantic_work_v1($1, $2)', [on.command, worldId]);
  assert.equal(work.work_outcome, 'GRANTED');
  const done = await first(`SELECT * FROM shared_semantic_private.complete_shared_semantic_place_v1($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, $10, $11,
    ARRAY['family'], ARRAY[]::text[], 'family', 'test.deterministic.v1', 5, 5)`, [work.work_lease_id, on.command, worldId, meaning,
    e.effectiveContextRef, e.outputDigest, e.sourceDisclosureGateRef, e.authorityRevalidationRef, e.readiness, e.audienceSnapshotRef, [on.material]]);
  assert.equal(done.outcome, 'MATERIAL_COMMITTED');
  await first('SELECT shared_semantic_private.end_shared_semantic_work_v1($1, $2, true)', [on.command, work.work_lease_id]);
  return done.material_id;
}

// ------------------------------------------------------------------------------------------------- 4. the safe representation
async function verifyRepresentation(h, w, p) {
  stage = 'representation: P1, P2 + P5, P6 and the absent holder, in Arabic, for every member';
  for (const viewer of [h.mona, h.ahmed, h.morad]) {
    const meanings = await meaningsOf(viewer, w.one);
    assert.deepEqual(meanings, [
      'سابقًا — رأي منى: أحمد بيتعصب وقت الخلاف',
      'رأي أحمد، كما نقله منى: السفر الأسبوع الجاي مناسب (غير مؤكد)',
      'سابقًا — رأي والدة مراد، كما نقله مراد: مش موافقة على السفر الأسبوع الجاي',
      'رأي منى: طريقة أحمد في الخلاف اتحسنت',
      'رأي والدة مراد، كما نقله مراد: ممكن نسافر بعد العيد',
    ], 'P1 / P2 / P5 / P6 — the frame first, the meaning never bare; the V1 place is served to nobody');
  }
  stage = 'representation: the same in English (P1–P6, English column)';
  assert.deepEqual(await meaningsOf(h.ahmed, w.one, 'en'), [
    'Earlier — منى\'s view: أحمد بيتعصب وقت الخلاف',
    'أحمد\'s view, as relayed by منى: السفر الأسبوع الجاي مناسب (unconfirmed)',
    'Earlier — والدة مراد\'s view, as relayed by مراد: مش موافقة على السفر الأسبوع الجاي',
    'منى\'s view: طريقة أحمد في الخلاف اتحسنت',
    'والدة مراد\'s view, as relayed by مراد: ممكن نسافر بعد العيد',
  ]);
  stage = 'representation: P3 / P4 (claims) and several Names joined';
  const c1 = await send(h.ahmed, w.one, 'الحجز اتأكد خلاص');
  const c2 = await send(h.morad, w.one, 'وأنا كمان متأكد إن الحجز اتعمل');
  const claim = await position(c2, w.one, 'الحجز اتعمل', [c1.material, c2.material], { nature: 'CLAIM', holders: [h.ahmed, h.morad] });
  const c3 = await send(h.mona, w.one, 'أحمد قال إن الفندق اتلغى');
  const relayedClaim = await position(c3, w.one, 'الفندق اتلغى', [c3.material], { nature: 'CLAIM', holders: [h.ahmed], relayers: [h.mona], hedged: true });
  const one = async (viewer, id, locale) => {
    await actAs('authenticated', viewer);
    const [row] = await rows('SELECT meaning FROM public.read_own_shared_semantic_place_v2($1, $2, $3)', [w.one, id, locale]);
    await asOwner();
    return row?.meaning;
  };
  assert.equal(await one(h.mona, claim, null), 'بحسب أحمد ومراد: الحجز اتعمل', 'P3, two Names joined by « و»');
  assert.equal(await one(h.mona, claim, 'en'), 'According to أحمد and مراد: الحجز اتعمل');
  assert.equal(await one(h.morad, relayedClaim, 'ar'), 'بحسب ما نقله منى عن أحمد: الفندق اتلغى (غير مؤكد)', 'P4 + P5');
  assert.equal(await one(h.morad, relayedClaim, 'en'), 'As relayed by منى from أحمد: الفندق اتلغى (unconfirmed)');
  await rejected(async () => { await actAs('authenticated', h.mona); await rows('SELECT * FROM public.list_own_shared_semantic_field_v2($1, $2)', [w.one, 'fr']); }, ['22023']);
  await asOwner();

  stage = 'representation: a person without a Name — the place is served as nothing, never with a bare meaning';
  await client.query('SAVEPOINT nameless');
  await client.query('UPDATE public.users SET name = NULL, login_id = NULL WHERE id = $1', [h.morad]);
  const nameless = await meaningsOf(h.mona, w.one);
  assert.ok(!nameless.some((m) => m.includes('ممكن نسافر بعد العيد') || m.includes('الحجز اتعمل')), 'a place whose attribution cannot be shown whole is not shown');
  await client.query('ROLLBACK TO SAVEPOINT nameless');

  stage = 'representation: the v2 sources are the place\'s human words; the v1 reads are refused to a person';
  await actAs('authenticated', h.ahmed);
  const sources = await rows('SELECT * FROM public.list_own_shared_semantic_place_sources_v2($1, $2)', [w.one, p.relayedView]);
  assert.deepEqual(sources.map((s) => [s.material_id, s.producer_kind]).sort(), [[p.m1.material, 'HUMAN'], [p.m3.material, 'HUMAN']].sort());
  assert.equal(sources.find((s) => s.material_id === p.m1.material).author_name, 'منى');
  assert.deepEqual(await rows('SELECT * FROM public.list_own_shared_semantic_place_sources_v2($1, $2)', [w.one, p.v1Place]), [], 'a V1 place has no sources here');
  for (const [fn, args] of [['list_own_shared_semantic_field_v1', [w.one]], ['read_own_shared_semantic_place_v1', [w.one, p.n3]],
    ['list_own_shared_semantic_place_sources_v1', [w.one, p.n3]]]) {
    await rejected(() => rows(`SELECT * FROM public.${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')})`, args), ['42501']);
  }
  await asOwner();

  stage = 'representation: the attribution-only server reads serve no V1 place';
  const k = await knowledge(w.one, h.mona);
  assert.ok(!k.some((r) => r.place_id === p.v1Place), 'the knowledge read serves only attributed places');
  assert.ok(k.some((r) => r.place_id === p.n3) && k.some((r) => r.place_id === claim));
  return { claim, relayedClaim, c1, c2, c3 };
}

// ------------------------------------------------------------------------------------------------- 5. deletion and history
async function verifyDeletion(h, w, p) {
  stage = 'deletion: the successor\'s source is deleted — the earlier position stays SUPERSEDED and is never current again';
  assert.equal(await deleteOwn(h.mona, w.one, p.m4.material), 'DELETED');
  assert.equal(await count('SELECT count(*) n FROM shared_semantic_private.semantic_places WHERE material_id = $1', [p.monaLater]), 0, 'the successor is gone');
  assert.equal(await count('SELECT count(*) n FROM shared_semantic_private.semantic_place_attributions WHERE material_id = $1', [p.monaLater]), 0);
  assert.equal(await count('SELECT count(*) n FROM shared_semantic_private.semantic_place_people WHERE material_id = $1', [p.monaLater]), 0);
  assert.equal(await count('SELECT count(*) n FROM shared_semantic_private.semantic_place_revisions WHERE earlier_material_id = $1 OR later_material_id = $1', [p.monaLater]), 0);
  const earlier = await first('SELECT standing FROM shared_semantic_private.semantic_place_attributions WHERE material_id = $1', [p.monaView]);
  assert.equal(earlier.standing, 'SUPERSEDED', 'the earlier position keeps its true history');
  const k = (await knowledge(w.one, h.ahmed)).find((r) => r.place_id === p.monaView);
  assert.deepEqual([k.standing, k.later_place_id], ['SUPERSEDED', null], 'served as history whose successor is gone');
  assert.ok((await meaningsOf(h.ahmed, w.one)).includes('سابقًا — رأي منى: أحمد بيتعصب وقت الخلاف'), 'shown as earlier (P6), with no current position');
  assert.ok(!(await meaningsOf(h.ahmed, w.one)).includes('رأي منى: أحمد بيتعصب وقت الخلاف'));

  stage = 'deletion: any source deleted removes the place, its attribution, its people and its revision edges';
  assert.equal(await deleteOwn(h.mona, w.one, p.m1.material), 'DELETED');
  for (const id of [p.monaView, p.relayedView]) {
    assert.equal(await count('SELECT count(*) n FROM shared_semantic_private.semantic_places WHERE material_id = $1', [id]), 0);
    assert.equal(await count('SELECT count(*) n FROM shared_semantic_private.semantic_place_attributions WHERE material_id = $1', [id]), 0);
  }
  assert.ok(!(await knowledge(w.one, h.mona)).some((r) => [p.monaView, p.relayedView].includes(r.place_id)));
}

// ------------------------------------------------------------------------------------------------- 6. membership
async function verifyMembership(h, w, p) {
  stage = 'membership: a newcomer who cannot see a source makes it unrecallable for the World, until they leave';
  const before = (await knowledge(w.one, h.mona)).map((r) => r.place_id);
  assert.ok(before.includes(p.n3Later));
  await addMember(w.one, h.dalia, [h.mona, h.ahmed, h.morad]);
  assert.deepEqual(await knowledge(w.one, h.mona), [], 'every current recipient must see every source: Dalia sees none of the old words');
  assert.deepEqual(await field(h.dalia, w.one), [], 'nor does the newcomer read the old places');
  const dWords = await send(h.dalia, w.one, 'أنا دالية، جديدة هنا');
  const daliaPlace = await position(dWords, w.one, 'دالية انضمت للعالم', [dWords.material], { nature: 'CLAIM', holders: [h.dalia] });
  assert.deepEqual((await knowledge(w.one, h.dalia)).map((r) => r.place_id), [daliaPlace]);
  await actAs('authenticated', h.dalia);
  assert.equal((await first('SELECT * FROM public.leave_shared_world_v1($1, $2)', [randomUUID(), w.one])).outcome, 'LEFT');
  await asOwner();
  assert.deepEqual(await knowledge(w.one, h.dalia), [], 'a former member reads nothing');
  assert.deepEqual(await field(h.dalia, w.one), []);
  const after = (await knowledge(w.one, h.mona)).map((r) => r.place_id);
  assert.ok(before.every((id) => after.includes(id)) && after.includes(daliaPlace), 'membership is read now: the old knowledge is recallable again');
  const dalia = (await knowledge(w.one, h.mona)).find((r) => r.place_id === daliaPlace);
  assert.deepEqual(dalia.people.map((x) => [x.role, x.user, x.name]), [['HOLDER', h.dalia, 'دالية']], 'a former member keeps their attribution');
  stage = 'membership: an outsider reads nothing, of any World';
  assert.deepEqual(await field(h.xavier, w.one), []);
  assert.deepEqual(await knowledge(w.one, h.xavier), []);
  return { daliaPlace };
}

// ------------------------------------------------------------------------------------------------- 7. isolation (§6)
async function verifyIsolation(h, w, p) {
  stage = 'isolation: the active and the closed conversation reads never return a place';
  for (const viewer of [h.mona, h.ahmed, h.morad]) {
    await actAs('authenticated', viewer);
    const conversation = await rows('SELECT material_id, material_kind FROM public.list_own_shared_world_material_v1($1, NULL, NULL, 200)', [w.one]);
    assert.ok(conversation.length > 0 && !conversation.some((r) => r.material_kind === 'QANDEEL_ANALYSIS'), 'the conversation stays the conversation');
  }
  await asOwner();

  stage = 'isolation: a knowledge-bearing reply is UNRESOLVED, with no dependency edge';
  const ask = await send(h.ahmed, w.one, 'قنديل، فاكر ماما مراد قالت إيه عن السفر؟');
  const reply = await qandeelReply(h.ahmed, ask.command, w.one, 'مراد نقل إن والدته كانت مش موافقة، وبعدين قالت ممكن بعد العيد.');
  const authority = await first('SELECT resolution_state FROM public.shared_world_material_historical_authority WHERE material_id = $1', [reply]);
  assert.equal(authority.resolution_state, 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT');
  assert.deepEqual((await rows('SELECT dependency_kind FROM public.shared_world_material_dependencies WHERE target_material_id = $1', [reply]))
    .map((r) => r.dependency_kind), ['INDEPENDENT_TARGET_TRUTH'],
  'only the frozen 0090 reply row: no REASONING_DEPENDENCY and no MATERIAL_DEPENDENCY is recorded for knowledge given to a reply (§3.4)');

  stage = 'isolation: Public authoring never lists a place or the reply, and refuses to package either by id';
  await actAs('authenticated', h.morad);
  const sources = await rows('SELECT * FROM public.list_own_public_authoring_sources_v1()');
  assert.ok(sources.some((s) => s.source_kind === 'SHARED'), 'the World\'s human words are listed as before');
  assert.ok(!sources.some((s) => s.material_kind === 'QANDEEL_ANALYSIS' || s.source_id === p.n3Later || s.source_id === reply));
  const [draft] = await rows('SELECT * FROM public.start_own_public_experience_draft_v1($1)', [randomUUID()]);
  const prepare = async (material) => (await first('SELECT * FROM public.prepare_own_public_experience_package_v1($1, $2, $3, $4, $5)',
    [randomUUID(), draft.experience_id, [], [w.one], [material]])).outcome;
  assert.equal(await prepare(p.n3Later), 'UNAVAILABLE', 'a place named by id is refused');
  assert.equal(await prepare(reply), 'NOT_PUBLISHABLE', 'a knowledge-bearing reply named by id is refused by its frozen UNRESOLVED authority');
  await asOwner();
  assert.equal(await count('SELECT count(*) n FROM public.publication_package_manifest_versions WHERE experience_id = $1', [draft.experience_id]), 0, 'no package exists');
  await actAs('authenticated', h.morad);
  assert.equal(await prepare(p.m5.material), 'PREPARED', 'the human words are packaged as before');
  await asOwner();

  stage = 'isolation: Replay capture refuses a place by id';
  await asOwner(h.morad);
  const capture = (items) => rows(
    'SELECT * FROM public.create_replay_draft_v1($1, $2, $3, $4, $5, $6, $7, $8::uuid[], $9::uuid[], $10::integer[], $11::integer[], $12)',
    [randomUUID(), randomUUID(), randomUUID(), randomUUID(), 'SHARED_WORLD', w.one, null, items, items, items.map(() => null), items.map(() => null), 'SELECTED_EXCERPT']);
  const refusal = await rejected(() => capture([p.m5.material, p.n3Later]), ['0A000']);
  assert.match(refusal.message, /REPLAY_SOURCE_KIND_RESERVED/u);
  await asOwner();
  stage = 'isolation: no Shared Replay can be distributed (the frozen 0104 package class), so neither can a place or a reply';
  const { def } = await first(`SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
    WHERE c.conname = 'replay_distribution_package_versions_class_check'`);
  assert.match(def, /source_class = 'MY_WORLD'/u);
  return { reply, ask };
}

// ------------------------------------------------------------------------------------------------- 8. the ledger (§5)
const BEGIN_V2 = 'SELECT * FROM public.begin_ai_provider_call_v2($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::text,$7::text,$8::text,$9::text)';
async function verifyLedger(h, w, p, iso) {
  stage = 'ledger: the Shared columns and the two families';
  const { def } = await first(`SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
    WHERE c.conrelid = 'public.ai_provider_calls'::regclass AND c.conname = 'ai_provider_calls_feature_family_check'`);
  const families = [...def.matchAll(/'([A-Z_]+)'::text/gu)].map((m) => m[1]).sort();
  // RE-ANCHORED by S8A-04 CP3 (2026-10-25, Product Owner correction 2): migration 0176 adds exactly SHARED_DISCLOSURE_JUDGE
  // (0176's own verifier pins the full list); nothing else in this list changes.
  assert.deepEqual(families, ['CONVERSATION_REPLY', 'CU_SEGMENTATION', 'FOCUS_RESOLUTION', 'THREAD_FORMATION', 'THREAD_CONTINUITY',
    'HYPOTHESIS_INTENT_EXTRACTION', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', 'HYPOTHESIS_CANDIDATE_GENERATION', 'PERSONAL_UNDERSTANDING_CAPTURE',
    'SHARED_SEMANTIC_READING', 'SHARED_KNOWLEDGE_RECALL', 'SHARED_SPATIAL_PLACEMENT', 'SHARED_DISCLOSURE_JUDGE'].sort());
  const begin = async (call, user, world, material, family, path = null) => {
    await actAs('service_role');
    const row = await first(BEGIN_V2, [call, user, world, material, 'DEEPSEEK', 'deepseek-flash', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', family, path]);
    await asOwner();
    return row;
  };
  stage = 'ledger: only the author of the causing HUMAN_TEXT message of that World pays';
  const msg = p.m5;
  await rejected(() => begin(randomUUID(), h.mona, w.one, msg.material, 'SHARED_KNOWLEDGE_RECALL'), ['42501']);
  await rejected(() => begin(randomUUID(), h.morad, w.two, msg.material, 'SHARED_KNOWLEDGE_RECALL'), ['42501']);
  await rejected(() => begin(randomUUID(), h.ahmed, w.one, iso.reply, 'CONVERSATION_REPLY', 'FAST'), ['42501']);
  await rejected(() => begin(randomUUID(), h.morad, w.one, p.n3Later, 'SHARED_SPATIAL_PLACEMENT'), ['42501']);
  await rejected(() => begin(randomUUID(), h.morad, w.one, null, 'SHARED_SPATIAL_PLACEMENT'), ['22023']);
  stage = 'ledger: one row per attempt, numbered per (payer, message, family); a replayed begin is idempotent';
  const c1 = randomUUID();
  assert.deepEqual(Object.values(await begin(c1, h.morad, w.one, msg.material, 'SHARED_KNOWLEDGE_RECALL')), ['BEGUN', 1]);
  assert.deepEqual(Object.values(await begin(c1, h.morad, w.one, msg.material, 'SHARED_KNOWLEDGE_RECALL')), ['ALREADY_BEGUN', 1]);
  assert.deepEqual(Object.values(await begin(randomUUID(), h.morad, w.one, msg.material, 'SHARED_KNOWLEDGE_RECALL')), ['BEGUN', 2], 'a retry is a second row');
  assert.deepEqual(Object.values(await begin(randomUUID(), h.morad, w.one, msg.material, 'SHARED_SPATIAL_PLACEMENT')), ['BEGUN', 1]);
  assert.deepEqual(Object.values(await begin(randomUUID(), h.ahmed, w.one, iso.ask.material, 'CONVERSATION_REPLY', 'DEEP')), ['BEGUN', 1]);
  await rejected(() => begin(c1, h.morad, w.one, msg.material, 'SHARED_SPATIAL_PLACEMENT'), ['PT409']);
  const row = await first('SELECT user_id, session_id, source_turn_id, source_world_id, source_shared_material_id, feature_family, call_state FROM public.ai_provider_calls WHERE id = $1', [c1]);
  assert.deepEqual(Object.values(row), [h.morad, null, null, w.one, msg.material, 'SHARED_KNOWLEDGE_RECALL', 'PENDING']);
  stage = 'ledger: a settled Shared call is settled once';
  await actAs('service_role');
  const settle = (outcome) => first('SELECT * FROM public.settle_ai_provider_call_v1($1, $2, $3, $4, $5)',
    [c1, h.morad, outcome, 'COMPLETE', { CACHE_READ_INPUT_TOKEN: 0, INPUT_TOKEN: 900, OUTPUT_TOKEN: 20 }]);
  assert.equal((await settle('SUCCEEDED')).settle_outcome, 'SETTLED');
  assert.equal((await settle('SUCCEEDED')).settle_outcome, 'ALREADY_SETTLED');
  await asOwner();
  await rejected(async () => { await actAs('service_role'); await settle('FAILED'); }, ['PT409']);
  await asOwner();
  stage = 'ledger: the shape is closed (both or neither; never with a Personal session or turn)';
  await rejected(() => client.query(`INSERT INTO public.ai_provider_calls (id, user_id, source_world_id, provider, requested_model, operation,
    feature_family, attempt_number, call_state, started_at) VALUES ($1, $2, $3, 'DEEPSEEK', 'deepseek-flash', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE',
    'SHARED_KNOWLEDGE_RECALL', 1, 'PENDING', now())`, [randomUUID(), h.morad, w.one]), ['23514']);
  stage = 'ledger: the Personal begin command is unchanged';
  await actAs('service_role');
  const personal = await first('SELECT * FROM public.begin_ai_provider_call_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [randomUUID(), h.mona, null, null, 'DEEPSEEK', 'deepseek-flash', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', 'SHARED_SEMANTIC_READING', null]);
  assert.equal(personal.begin_outcome, 'BEGUN');
  await asOwner();
}

// ------------------------------------------------------------------------------------------------- 9. condition 9
// Every function anon or authenticated can execute that can reach a Shared text body (through the bodies relation, the 0089
// resolver or the place tables, transitively through the functions it calls) — and how it keeps the attribution frame.
// An unclassified function fails; so does a classified one that no longer exists or no longer reaches a body.
const EXCLUDES = 'EXCLUDES_ANALYSIS';
const SAFE = 'SERVES_SAFE_MEANING';
const CLASSIFICATION = Object.freeze({
  // Shared conversation and history: QANDEEL_ANALYSIS is excluded by kind, by author (a place has none) or by phase.
  'shared_private.list_own_shared_world_material_v1': EXCLUDES, // 0175 G.1: material_kind <> 'QANDEEL_ANALYSIS'
  'shared_private.list_own_closed_shared_world_material_v1': EXCLUDES, // 0175 G.2
  'shared_semantic_private.list_own_closed_shared_world_material_v2': EXCLUDES, // 0148: material_kind <> 'QANDEEL_ANALYSIS'
  'shared_private.list_own_former_shared_world_material_v1': EXCLUDES, // HUMAN_TEXT the reader wrote
  'shared_private.list_own_shared_history_share_candidates_v1': EXCLUDES, // inner join on a human author
  'shared_private.list_own_shared_history_share_requests_v1': EXCLUDES, // the reader's own authored material
  'shared_private.list_own_former_shared_history_share_requests_v1': EXCLUDES, // the reader's own authored material
  'shared_private.propose_shared_world_history_share_v1': EXCLUDES, // returns an outcome and a package id only
  'shared_private.send_shared_world_human_text_v1': EXCLUDES, // returns outcome and ids only
  'shared_private.delete_own_shared_world_material_v1': EXCLUDES, // returns an outcome only
  // The member's map: the composed meaning only.
  'shared_semantic_private.list_own_shared_semantic_field_v2': SAFE,
  'shared_semantic_private.read_own_shared_semantic_place_v2': SAFE,
  'shared_semantic_private.list_own_shared_semantic_place_sources_v2': EXCLUDES, // HUMAN_TEXT sources of a served place
  // Introductions: an INTRODUCTION-phase World only; a place is committed only in a STANDARD World.
  'public.read_my_introduction_history_v1': EXCLUDES,
  'public.read_my_introduction_messages_v1': EXCLUDES,
  'public.send_my_introduction_text_v1': EXCLUDES,
  'public.remove_my_introduction_image_v1': EXCLUDES,
  // Public World: a Shared body enters only through authoring sources and a package, both closed to a place by 0175.
  'public_authoring_private.list_own_public_authoring_sources_v1': EXCLUDES, // 0175 G.3
  'public_authoring_private.prepare_own_public_experience_package_v1': EXCLUDES, // 0175 G.4
  'public_authoring_private.approve_own_public_package_v1': EXCLUDES,
  'public_authoring_private.commit_own_public_experience_ready_v1': EXCLUDES,
  'public_authoring_private.list_own_public_approval_requests_v1': EXCLUDES,
  'public_authoring_private.read_own_public_experience_review_v1': EXCLUDES,
  'public_discussion_private.post_own_public_discussion_v1': EXCLUDES,
  'public_discussion_private.read_public_discussion_capability_v1': EXCLUDES,
  'public_discussion_private.read_public_discussion_posts_v1': EXCLUDES,
  'public_relation_private.accept_public_relation_v1': EXCLUDES,
  'public_relation_private.cancel_public_relation_v1': EXCLUDES,
  'public_relation_private.decline_public_relation_v1': EXCLUDES,
  'public_relation_private.read_own_public_relation_experiences_v1': EXCLUDES,
  'public_relation_private.read_own_public_relations_v1': EXCLUDES,
  'public_relation_private.read_public_semantic_relations_v1': EXCLUDES,
  'public_relation_private.remove_public_relation_v1': EXCLUDES,
  'public_relation_private.request_public_relation_v1': EXCLUDES,
  'public_semantic_private.accept_own_public_semantic_proposal_v1': EXCLUDES,
  'public_semantic_private.commit_own_public_semantic_work_v1': EXCLUDES,
  'public_semantic_private.read_own_public_semantic_review_v1': EXCLUDES,
  'public_semantic_private.request_own_public_semantic_correction_v1': EXCLUDES,
  'public_semantic_private.request_own_public_semantic_proposal_v1': EXCLUDES,
  'public_spatial_private.read_own_public_spatial_preparation_v1': EXCLUDES,
  'public_spatial_private.read_public_semantic_experience_content_v1': EXCLUDES,
  'public_spatial_private.read_public_semantic_experience_v1': EXCLUDES,
  'public_spatial_private.read_public_semantic_field_v1': EXCLUDES,
  'public_spatial_private.read_public_semantic_nearby_v1': EXCLUDES,
  'public_spatial_private.request_own_public_spatial_placement_v1': EXCLUDES,
  'public_spatial_private.search_public_semantic_field_v1': EXCLUDES,
  // S8A-05 CP1 / 0179: author-written topic freeze and public title/section reads. Freeze is closed by the
  // Stage 9 clearance gate; the viewer reads use the admitted, served Public Experience (not Shared analysis text).
  // Each private function has exactly one public wrapper, included by PUBLIC_WRAPPER_OF below.
  'public_compose_private.freeze_own_topic_draft_v1': EXCLUDES,
  'public_compose_private.read_public_topic_headers_v1': EXCLUDES,
  'public_compose_private.read_public_topic_title_matches_v1': EXCLUDES,
  'public_compose_private.read_public_section_topic_matches_v1': EXCLUDES,
  // RE-ANCHORED by S8A-05 CP2 / 0180: the paged items of a served topic reach a body only through the canonical serving
  // resolver (0095), for an admitted viewer and a served field entry, exactly as 0145 E.4 above does.
  'public_compose_source_private.read_public_topic_items_v1': EXCLUDES,
  // Replay: a Shared body enters only through capture, closed to a place by 0175 G.5; a Shared Replay is never distributed.
  'replay_private.create_my_replay_draft_v1': EXCLUDES,
  'replay_private.finalize_my_replay_version_v1': EXCLUDES,
  'replay_private.prepare_my_replay_preview_v1': EXCLUDES,
  'replay_private.read_my_replay_moment_analysis_v1': EXCLUDES,
  'replay_private.read_my_replay_moments_v1': EXCLUDES,
  'replay_private.read_my_replay_v1': EXCLUDES,
  'replay_private.read_my_replay_version_v1': EXCLUDES,
  'replay_private.revise_my_replay_draft_v1': EXCLUDES,
});
const PUBLIC_WRAPPER_OF = (name) => `public.${name.split('.')[1]}`;

/** The client-executable functions that can reach a Shared text body, from the catalogue, transitively. */
async function reachingFunctions() {
  const fns = await rows(`SELECT p.oid, n.nspname || '.' || p.proname AS name, p.prosrc,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('anon', p.oid, 'EXECUTE') AS client
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prokind = 'f' AND p.prosrc IS NOT NULL`);
  const seed = /shared_world_text_material_bodies|semantic_places|semantic_place_|resolve_shared_world_material_v1/u;
  const names = [...new Set(fns.map((f) => f.name))];
  const reaches = new Map(fns.map((f) => [f.oid, seed.test(f.prosrc)]));
  const refsOf = new Map(fns.map((f) => [f.oid, names.filter((n) => f.prosrc.includes(n))]));
  const reachingName = new Set(fns.filter((f) => reaches.get(f.oid)).map((f) => f.name));
  for (let changed = true; changed;) {
    changed = false;
    for (const f of fns) {
      if (reaches.get(f.oid) || !refsOf.get(f.oid).some((n) => reachingName.has(n))) continue;
      reaches.set(f.oid, true);
      reachingName.add(f.name);
      changed = true;
    }
  }
  return [...new Set(fns.filter((f) => f.client && reaches.get(f.oid)).map((f) => f.name))].sort();
}

async function verifyDisplaySafety(h, w) {
  stage = 'condition 9: the catalogue — every client-executable function that can reach a Shared body is classified';
  await asOwner();
  const reaching = await reachingFunctions();
  const expected = Object.keys(CLASSIFICATION).flatMap((name) => (name.startsWith('public.') ? [name] : [name, PUBLIC_WRAPPER_OF(name)])).sort();
  const unclassified = reaching.filter((name) => !expected.includes(name));
  assert.deepEqual(unclassified, [], 'an unclassified function that can reach a Shared text body fails the test');
  assert.deepEqual(expected.filter((name) => !reaching.includes(name)), [], 'every classified function exists and reaches a body');
  for (const name of Object.keys(CLASSIFICATION).filter((n) => CLASSIFICATION[n] === SAFE)) {
    const [{ prosrc }] = await rows(`SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname || '.' || p.proname = $1`, [name]);
    assert.match(prosrc, /shared_semantic_private\.safe_meaning_v1\(/u, `${name} serves the composed meaning`);
  }

  stage = 'condition 9: the behaviour — a seeded place\'s bare meaning never appears outside its composed frame';
  const MARKER = 'علامة فريدة للتحقق من سلامة العرض 7Q9Z';
  const words = await send(h.mona, w.one, 'كلام منى عن علامة التحقق');
  const placeId = await position(words, w.one, MARKER, [words.material], { holders: [h.mona] });
  const framed = ['رأي منى: ' + MARKER, 'منى\'s view: ' + MARKER];
  const signatures = await rows(`SELECT n.nspname || '.' || p.proname AS name, p.oid::regprocedure::text AS sig,
      coalesce(p.proargnames, ARRAY[]::text[]) AS argnames, ARRAY(SELECT format_type(t, NULL) FROM unnest(p.proargtypes) t) AS types, p.pronargs AS nargs
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname || '.' || p.proname = ANY($1::text[])`, [expected]);
  assert.equal(new Set(signatures.map((s) => s.name)).size, expected.length);
  const value = (type, argname, profile) => {
    const name = argname ?? '';
    if (type === 'uuid') {
      if (profile === 'world') return w.one;
      if (profile === 'place') return placeId;
      if (/world/u.test(name)) return w.one;
      if (/command/u.test(name)) return randomUUID();
      return placeId;
    }
    if (type === 'uuid[]') return /world/u.test(name) && profile !== 'place' ? [w.one] : [placeId];
    if (type === 'text') return /locale/u.test(name) ? (profile === 'en' ? 'en' : 'ar') : /class/u.test(name) ? 'SHARED_WORLD' : 'x';
    if (type === 'text[]') return [];
    if (type === 'integer' || type === 'bigint' || type === 'smallint') return 50;
    if (type === 'integer[]') return null;
    if (type === 'boolean') return true;
    return null;
  };
  const leaks = [];
  let served = 0;
  for (const viewer of [h.mona, h.ahmed, h.morad]) {
    for (const s of signatures) {
      for (const profile of ['named', 'world', 'place', 'en']) {
        const args = s.types.map((type, i) => value(type, s.argnames[i], profile));
        await client.query('SAVEPOINT surface');
        try {
          await actAs('authenticated', viewer);
          const out = await rows(`SELECT * FROM ${s.name}(${args.map((_, i) => `$${i + 1}`).join(', ')})`, args);
          const text = JSON.stringify(out);
          if (text.includes(MARKER)) served += 1;
          const bare = text.split(MARKER).length - 1;
          const inFrame = framed.reduce((n, frame) => n + (text.split(frame).length - 1), 0);
          if (bare !== inFrame) leaks.push(`${s.name} (${profile})`);
        } catch {
          // A refusal serves nothing.
        } finally {
          await client.query('ROLLBACK TO SAVEPOINT surface');
          await client.query('RELEASE SAVEPOINT surface');
        }
      }
    }
  }
  await asOwner();
  assert.deepEqual(leaks, [], 'no surface serves the bare meaning');
  assert.ok(served > 0, 'the composed meaning is served (the check is not vacuous)');
  return { calls: signatures.length * 3 * 4, served };
}

async function main() {
  await client.connect();
  try {
    await client.query('BEGIN');
    const h = {
      mona: randomUUID(), ahmed: randomUUID(), morad: randomUUID(), dalia: randomUUID(), xavier: randomUUID(), yara: randomUUID(),
    };
    await signUp(h.mona, 'منى', `cp2_mona_${h.mona.slice(0, 8)}`);
    await signUp(h.ahmed, 'أحمد', `cp2_ahmed_${h.ahmed.slice(0, 8)}`);
    await signUp(h.morad, 'مراد', `cp2_morad_${h.morad.slice(0, 8)}`);
    await signUp(h.dalia, 'دالية', `cp2_dalia_${h.dalia.slice(0, 8)}`);
    await signUp(h.xavier, 'Xavier', `cp2_xavier_${h.xavier.slice(0, 8)}`);
    await signUp(h.yara, 'Yara', `cp2_yara_${h.yara.slice(0, 8)}`);
    await first('SELECT * FROM shared_private.set_shared_launch_capability_v1($1, $2, $3, $4, $5)',
      ['SHARED_CONVERSATION', 'ENABLED', 'SATISFIED', 's8a-04-cp2-verifier', 'verification fixture']);
    const w = { one: await bornWorld(h.mona, h.ahmed), two: await bornWorld(h.xavier, h.yara) };
    await addMember(w.one, h.morad, [h.mona, h.ahmed]);

    await verifyBoundary();
    const p = await verifyWrite(h, w);
    await verifyRepresentation(h, w, p);
    await verifyDeletion(h, w, p);
    await verifyMembership(h, w, p);
    const iso = await verifyIsolation(h, w, p);
    await verifyLedger(h, w, p, iso);
    const safety = await verifyDisplaySafety(h, w);
    console.log(`Verified migration 0175 (S8A-04 CP2): a private, pinned boundary with the v1 writer, context and bare member reads revoked; every §2.2 check of the atomic write, a refusal writing nothing, and the deferred attribution checks at commit; the composed meaning (P1–P6, ar/en, Names joined, a missing Name served as nothing) and attribution-only readers; deletion with the earlier position kept SUPERSEDED and never current; the knowledge read for every current recipient, now; the conversation, Public authoring and Replay capture closed to a place, the knowledge-bearing reply UNRESOLVED with no edge; the Shared ledger begin verified by payer, message and World with attempts per family; and condition 9 — ${Object.keys(CLASSIFICATION).length} classified surfaces from the catalogue, ${safety.calls} calls under three members' tokens, the bare meaning never outside its frame (${safety.served} served composed).`);
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'verification';
    console.error(`Migration 0175 verification failed at ${stage} (${code}): ${error?.message ?? error}`);
    process.exitCode = 1;
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
}

main();
