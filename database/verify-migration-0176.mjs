// S8A-04 CP3 — Personal Knowledge in Shared World: the real-PostgreSQL verifier for migration 0176.
//
// Against a database migrated through 0176, inside ONE transaction that is rolled back, it proves (amendment §3 – §6, the
// Product Owner's authorization of 2026-10-25 §6):
//   1. the boundary — the relations are private, RLS-enabled, unreachable, registered for account erasure and cascade from
//      their owner; `authenticated` executes exactly the owner's read and commands, `service_role` exactly the server's
//      reads and acts, `anon` nothing; no internal derivation is executable; the judge family is admitted;
//   2. no implicit consent and no server-made grant — before the owner answers nothing is collected; the server cannot
//      answer, allow or write a grant; another member cannot answer a request that is not theirs; an item with no decision
//      in this World and episode cannot be allowed (no advance grant);
//   3. the local relevance read (Product Owner correction 1) — it returns one word and nothing else; it asks only for an
//      eligible item, one request per call, never twice for the same item, never a member with an open request or within
//      the window; nothing for no candidate;
//   4. the consent — one answer writes one event and the two grants of one pair; the ceiling must be EXACTLY the current
//      members, otherwise nothing is written; a decline writes no grant; a replay is that answer; allow-later after a
//      decline; the owner's own view;
//   5. binding — the collector serves only consented words, at most one item per owner, never in another World, never
//      after leaving (a rejoin starts afresh), never while the audience is wider than the ceiling until reconfirmed;
//   6. ending — revoke, correction, forget and cooldown stop future use, shown to the owner as ended;
//   7. the commit with consent — the consented reply commits with exactly one REASONING_DEPENDENCY per used item and one use
//      row; malformed references are refused; an item revoked, corrected, or out-grown by a new member during generation,
//      or an owner who left, makes the commit STALE with nothing written;
//   8. history — events and uses are immutable, a grant only moves ACTIVE → REVOKED, and a lone grant or a mismatched pair
//      is refused at commit;
//   9. the ledger (Product Owner correction 2) — the judge family is begun only for the author of the causing message of
//      that World; the item's owner can never be the payer for another member's message.
import assert from 'node:assert/strict';
import { createHash, randomInt, randomUUID } from 'node:crypto';
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
/** Run the deferred constraint triggers now, as a commit would. */
async function settle() {
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
}

// ------------------------------------------------------------------------------------------------- fixtures (0175's)
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
  const e = { effectiveContextRef: `ec:cp3:${randomUUID()}`, outputDigest: digest(body), sourceDisclosureGateRef: `gate:cp3:${randomUUID()}`,
    authorityRevalidationRef: `rev:cp3:${randomUUID()}`, audienceSnapshotRef };
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
  await settle();
}
/** A former member comes back only by the governed REJOIN (0140): proposed by Shared ID, approved by all, accepted by them. */
async function rejoin(worldId, member, current) {
  await asOwner();
  const [state] = await rows('SELECT epoch FROM public.shared_world_invite_credential_state WHERE user_id = $1', [member]);
  const sharedId = Array.from({ length: 12 }, () => '0123456789ABCDEFGHJKMNPQRSTVWXYZ'[randomInt(32)]).join('').replace(/^(.{4})(.{4})/u, '$1-$2-');
  await asOwner(member);
  await rows('SELECT * FROM public.rotate_shared_world_invite_credential_v1($1, $2, $3)',
    [randomUUID(), `sid1:${createHash('sha256').update(sharedId, 'utf8').digest('hex')}`, state ? state.epoch : null]);
  await actAs('authenticated', current[0]);
  assert.equal((await first('SELECT * FROM public.propose_shared_world_member_v1($1, $2, $3)', [randomUUID(), worldId, sharedId])).outcome, 'SUBMITTED');
  const proposal = (await first('SELECT proposal_id FROM public.list_own_shared_world_proposals_v1($1)', [worldId])).proposal_id;
  for (const human of current) {
    await actAs('authenticated', human);
    await first('SELECT * FROM public.approve_shared_world_proposal_v1($1, $2, $3)', [randomUUID(), worldId, proposal]);
  }
  await actAs('authenticated', member);
  assert.equal((await first('SELECT * FROM public.accept_shared_membership_request_v1($1, $2, $3)', [randomUUID(), worldId, proposal])).outcome, 'JOINED');
  await asOwner();
  await settle();
}
async function leave(member, worldId) {
  await actAs('authenticated', member);
  assert.equal((await first('SELECT * FROM public.leave_shared_world_v1($1, $2)', [randomUUID(), worldId])).outcome, 'LEFT');
  await asOwner();
}
async function send(sender, worldId, content) {
  await actAs('authenticated', sender);
  const sent = await first('SELECT * FROM public.send_shared_world_human_text_v1($1, $2, $3)', [randomUUID(), worldId, content]);
  assert.equal(sent.outcome, 'COMMITTED');
  await asOwner();
  const { id } = await first('SELECT id FROM public.shared_world_material_commit_commands WHERE material_id = $1', [sent.material_id]);
  return { material: sent.material_id, command: id, world: worldId, sender };
}
/** One of the owner's memories, with its 0171 index terms. */
async function memory(owner, content, terms, { type = 'PERSONAL_FACT', source = 'USER_STATED', subject = 'SELF', importance = 0.5,
  expired = false } = {}) {
  const id = randomUUID();
  await asOwner();
  await client.query(`INSERT INTO public.memories (id, user_id, type, content, source, confidence, importance, status, expires_at, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 0.9, $6, 'ACTIVE', NULL, now(), now())`, [id, owner, type, content, source, importance]);
  if (subject) await client.query("INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis) VALUES ($1, $2, $3, 'EXPLICIT_STATEMENT')", [id, owner, subject]);
  // An attribution is written only with a live memory (0152), whose expiry is immutable: an expired one lapses after.
  if (expired) await client.query("UPDATE public.memories SET status = 'EXPIRED' WHERE id = $1", [id]);
  for (const term of terms) await client.query('INSERT INTO public.memory_retrieval_terms (memory_id, user_id, term) VALUES ($1, $2, $3)', [id, owner, term]);
  return id;
}

// ------------------------------------------------------------------------------------------------- the 0176 acts
const audienceOf = async (worldId) => {
  await asOwner();
  return (await rows('SELECT user_id FROM public.resolve_shared_world_human_audience_snapshot_v1($1) ORDER BY user_id', [worldId])).map((r) => r.user_id);
};
const propose = async (on, terms, windowSeconds = 3600) => {
  await actAs('service_role');
  const out = await rows('SELECT * FROM public.propose_shared_knowledge_request_v1($1, $2, $3, $4)', [on.world, on.material, terms, windowSeconds]);
  await asOwner();
  assert.equal(out.length, 1);
  assert.deepEqual(Object.keys(out[0]), ['outcome'], 'the relevance read returns one word and nothing else');
  return out[0].outcome;
};
const collect = async (on, terms) => {
  await actAs('service_role');
  const out = await rows('SELECT * FROM public.list_shared_knowledge_for_reply_v1($1, $2, $3)', [on.world, on.material, terms]);
  await asOwner();
  return out;
};
const resolveItem = async (worldId, owner, memoryId) => {
  await actAs('service_role');
  const out = await first('SELECT * FROM public.resolve_shared_knowledge_item_v1($1, $2, $3)', [worldId, owner, memoryId]);
  await asOwner();
  return out;
};
// RE-ANCHORED by S8A-04 CP3-C (migration 0177, 2026-10-25): 0177 retires the v1 read and the two ceiling commands for a
// person (they carry user ids; the v2 surface replaces them, pinned by 0177's verifier). Where 0177 is applied this file
// still proves their logic — the building blocks the v2 functions call — under the owner's own claims (auth.uid() is the
// owner), as the database owner; the boundary below proves no application role executes them.
let V1_RETIRED = false;
const asPerson = (owner) => (V1_RETIRED ? asOwner(owner) : actAs('authenticated', owner));
const view = async (owner, worldId) => {
  await asPerson(owner);
  const out = await rows('SELECT * FROM public.list_own_shared_knowledge_v1($1)', [worldId]);
  await asOwner();
  return out;
};
const answer = async (owner, requestId, decision, ceiling, command = randomUUID()) => {
  await asPerson(owner);
  const out = await first('SELECT * FROM public.answer_own_shared_knowledge_request_v1($1, $2, $3, $4)', [command, requestId, decision, ceiling]);
  await asOwner();
  return out.outcome;
};
const allow = async (owner, worldId, memoryId, ceiling, command = randomUUID()) => {
  await asPerson(owner);
  const out = await first('SELECT * FROM public.allow_own_shared_knowledge_v1($1, $2, $3, $4)', [command, worldId, memoryId, ceiling]);
  await asOwner();
  return out.outcome;
};
const revoke = async (owner, worldId, memoryId, command = randomUUID()) => {
  await actAs('authenticated', owner);
  const out = await first('SELECT * FROM public.revoke_own_shared_knowledge_v1($1, $2, $3)', [command, worldId, memoryId]);
  await asOwner();
  return out.outcome;
};
const openRequest = async (owner, worldId) => first(`SELECT id, memory_id FROM shared_knowledge_private.requests
  WHERE owner_user_id = $1 AND world_id = $2 AND state = 'OPEN'`, [owner, worldId]);
const tally = async () => ({
  events: await count('SELECT count(*) n FROM shared_knowledge_private.consent_events'),
  reasoning: await count('SELECT count(*) n FROM shared_knowledge_private.reasoning_grants'),
  disclosure: await count('SELECT count(*) n FROM shared_knowledge_private.disclosure_grants'),
  requests: await count('SELECT count(*) n FROM shared_knowledge_private.requests'),
  uses: await count('SELECT count(*) n FROM shared_knowledge_private.uses'),
  replies: await count("SELECT count(*) n FROM public.shared_world_materials WHERE material_kind = 'QANDEEL_OUTPUT'"),
});

const COMPLETE_V2 = `SELECT * FROM public.complete_shared_world_qandeel_reply_v2($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`;
/** Begin QANDEEL's reply to `on`; returns the lease and the evidence computed NOW (as the API does before generating). */
async function beginReply(on, body) {
  const e = evidenceFor(body, await audienceRef(on.world));
  await actAs('service_role');
  const work = await first('SELECT * FROM public.begin_shared_qandeel_reply_work_v1($1, $2, $3)', [on.command, on.world, on.sender]);
  await asOwner();
  assert.equal(work.work_outcome, 'GRANTED');
  return { lease: work.work_lease_id, body, e };
}
async function completeReply(on, started, grants, { refs = grants.map((g) => `shared-knowledge:${g}`), disclosed = grants.map(() => true) } = {}) {
  const { lease, body, e } = started;
  await actAs('service_role');
  const out = await first(COMPLETE_V2, [lease, on.command, on.world, body, e.effectiveContextRef, e.outputDigest, e.sourceDisclosureGateRef,
    e.authorityRevalidationRef, e.readiness, e.audienceSnapshotRef, [], refs, grants, disclosed]);
  await asOwner();
  return out;
}

// ------------------------------------------------------------------------------------------------- 1. the boundary
const OWNER_FUNCTIONS = ['list_own_shared_knowledge_v1', 'answer_own_shared_knowledge_request_v1', 'allow_own_shared_knowledge_v1',
  'revoke_own_shared_knowledge_v1'];
// RE-ANCHORED by S8A-04 CP3-C (migration 0177, 2026-10-25): the owner's v2 read and commands (member names and an
// audience reference instead of user ids) are the owner's, for a person only; the v1 read and the two ceiling commands
// are retired for every application role; 0177's own verifier pins both.
const OWNER_V2 = ['list_own_shared_knowledge_v2', 'answer_own_shared_knowledge_request_v2', 'allow_own_shared_knowledge_v2'];
const RETIRED_V1 = ['list_own_shared_knowledge_v1', 'answer_own_shared_knowledge_request_v1', 'allow_own_shared_knowledge_v1'];
const SERVER_FUNCTIONS = ['propose_shared_knowledge_request_v1', 'list_shared_knowledge_for_reply_v1', 'resolve_shared_knowledge_item_v1',
  'cool_down_shared_knowledge_v1', 'complete_shared_world_qandeel_reply_v2'];
// RE-ANCHORED by S8A-04 CP3-D V2 (migration 0178, 2026-10-26; Controlled Amendment R4): the audience Names read is one more
// server read in this schema (service_role only; a pinned STABLE definer that writes nothing); 0178's own verifier pins it.
const SERVER_V2 = ['list_shared_audience_names_v1'];
const INTERNAL = ['item_v1', 'audience_v1', 'grant_state_v1', 'open_episode_v1', 'write_grant_v1', 'reasoning_ref_v1', 'guard_history_v1',
  'require_pair_v1'];
const RELATIONS = ['consent_events', 'reasoning_grants', 'disclosure_grants', 'requests', 'cooldowns', 'uses'];

async function verifyBoundary() {
  stage = 'boundary: who executes what';
  await asOwner();
  const v2 = (await first("SELECT to_regprocedure('public.list_own_shared_knowledge_v2(uuid)') IS NOT NULL AS v2")).v2;
  V1_RETIRED = v2;
  const OWNER = v2 ? [...OWNER_FUNCTIONS.filter((name) => !RETIRED_V1.includes(name)), ...OWNER_V2] : OWNER_FUNCTIONS;
  const names = (await first("SELECT to_regprocedure('public.list_shared_audience_names_v1(uuid)') IS NOT NULL AS names")).names;
  const SERVER = names ? [...SERVER_FUNCTIONS, ...SERVER_V2] : SERVER_FUNCTIONS;
  const executable = await rows(`SELECT r.rolname, n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rolname)
    WHERE (n.nspname = 'shared_knowledge_private' OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2, 3`, [[...OWNER, ...SERVER, ...RETIRED_V1]]);
  const key = (r) => `${r.rolname} ${r.nspname}.${r.proname}`;
  const both = (rolname, names) => names.flatMap((proname) => ['public', 'shared_knowledge_private'].map((nspname) => key({ rolname, nspname, proname })));
  assert.deepEqual(executable.map(key).sort(), [...both('authenticated', OWNER), ...both('service_role', SERVER)].sort(),
    'the owner\'s read and commands for a person, the server\'s reads and acts for the server; nothing for anon; no internal derivation');
  for (const proname of INTERNAL) {
    assert.equal(await count(`SELECT count(*) n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'shared_knowledge_private' AND p.proname = $1`, [proname]), 1, `${proname} exists`);
  }
  const definers = await rows(`SELECT p.proname, p.prosecdef, pg_get_userbyid(p.proowner) AS owner, p.proconfig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'shared_knowledge_private'`);
  for (const d of definers) {
    assert.ok(d.prosecdef && d.owner === 'postgres' && JSON.stringify(d.proconfig) === JSON.stringify(['search_path=""']), `${d.proname} is a pinned definer`);
  }
  const wrappers = await rows(`SELECT p.proname, p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [[...OWNER, ...SERVER, ...(v2 ? RETIRED_V1 : [])]]);
  assert.equal(wrappers.length, OWNER.length + SERVER.length + (v2 ? RETIRED_V1.length : 0));
  for (const w of wrappers) assert.equal(w.prosecdef, false, `public.${w.proname} is SECURITY INVOKER`);

  stage = 'boundary: the relations are private, unreachable, erased with their owner, and registered for erasure';
  for (const table of RELATIONS) {
    const relation = `shared_knowledge_private.${table}`;
    assert.equal((await first('SELECT relrowsecurity AS rls FROM pg_class WHERE oid = $1::regclass', [relation])).rls, true, `${table} has RLS`);
    assert.equal(await count('SELECT count(*) n FROM pg_policy WHERE polrelid = $1::regclass', [relation]), 0, `${table} has no policy`);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal((await first('SELECT has_table_privilege($1, $2, $3) AS reach', [role, relation, 'SELECT,INSERT,UPDATE,DELETE'])).reach, false,
        `${role} cannot reach ${table}`);
    }
    assert.equal(await count(`SELECT count(*) n FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.contype = 'f'
      AND c.confrelid = 'public.users'::regclass AND c.confdeltype = 'c'`, [relation]), 1, `${table} cascades from its owner's account`);
    assert.equal(await count('SELECT count(*) n FROM account_erasure_private.coverage_registry WHERE relation = $1 AND coverage = $2',
      [relation, 'ACCOUNT_CASCADE']), 1, `${table} is registered ACCOUNT_CASCADE`);
  }
  for (const table of ['consent_events', 'reasoning_grants', 'requests', 'cooldowns']) {
    assert.equal(await count(`SELECT count(*) n FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.contype = 'f'
      AND c.confrelid = 'public.memories'::regclass AND c.confdeltype = 'c'`, [`shared_knowledge_private.${table}`]), 1,
    `${table} is erased with the memory it names`);
  }
  await actAs('service_role');
  await rejected(() => rows('SELECT * FROM shared_knowledge_private.reasoning_grants'), ['42501']);
  await asOwner();
  await actAs('anon');
  await rejected(() => rows('SELECT * FROM public.list_own_shared_knowledge_v1($1)', [randomUUID()]), ['42501']);
  await asOwner();

  stage = 'boundary: the judge family is admitted (and nothing else changed in the list)';
  const { def } = await first(`SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
    WHERE c.conrelid = 'public.ai_provider_calls'::regclass AND c.conname = 'ai_provider_calls_feature_family_check'`);
  // RE-ANCHORED by S8A-05 CP3 (2026-10-27, Controlled Amendment A-4): migration 0181 adds exactly PUBLIC_SEMANTIC_INTERPRETATION
  // (0181's own verifier pins the full list); the judge family is still admitted and nothing else in this list changes.
  // RE-ANCHORED by S8A-05 CP4 (2026-10-27, Controlled Amendment A-5): migration 0182 adds exactly PUBLIC_QANDEEL_REPLY
  // (0182's own verifier pins the full list); nothing else in this list changes.
  assert.deepEqual([...def.matchAll(/'([A-Z_]+)'::text/gu)].map((m) => m[1]).sort(), ['CONVERSATION_REPLY', 'CU_SEGMENTATION', 'FOCUS_RESOLUTION',
    'THREAD_FORMATION', 'THREAD_CONTINUITY', 'HYPOTHESIS_INTENT_EXTRACTION', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', 'HYPOTHESIS_CANDIDATE_GENERATION',
    'PERSONAL_UNDERSTANDING_CAPTURE', 'SHARED_SEMANTIC_READING', 'SHARED_KNOWLEDGE_RECALL', 'SHARED_SPATIAL_PLACEMENT', 'SHARED_DISCLOSURE_JUDGE',
    'PUBLIC_SEMANTIC_INTERPRETATION', 'PUBLIC_QANDEEL_REPLY'].sort());
}

// ------------------------------------------------------------------------------------------------- 2–4. relevance and consent
async function verifyRelevanceAndConsent(h, w, m) {
  stage = 'relevance: no candidate is no request';
  const ask = await send(h.hala, w.one, 'هل ينام أحد منكم مبكرًا؟');
  const before = await tally();
  assert.equal(await propose(ask, ['قطار']), 'NONE', 'no item carries the term');
  assert.equal(await propose(ask, []), 'NONE', 'no term');
  assert.equal(await propose({ ...ask, material: randomUUID() }, ['نوم']), 'NONE', 'not a human message of that World');
  assert.equal(await propose({ ...ask, world: w.two }, ['نوم']), 'NONE', 'the message of another World');
  assert.deepEqual(await tally(), before, 'nothing written');

  stage = 'no implicit consent: before any answer nothing is collected';
  assert.deepEqual(await collect(ask, ['نوم', 'مبكر']), []);
  assert.equal((await resolveItem(w.one, h.mohamed, m.mohamedSleep)).grant_state, 'NONE');

  stage = 'relevance: the strongest eligible item opens ONE private request, for its owner only';
  assert.equal(await propose(ask, ['نوم', 'مبكر']), 'REQUESTED');
  const mohamedRequest = await openRequest(h.mohamed, w.one);
  assert.equal(mohamedRequest.memory_id, m.mohamedSleep, 'the two-term item of Mohamed, not the sender\'s or an ineligible one');
  assert.equal(await count('SELECT count(*) n FROM shared_knowledge_private.requests'), before.requests + 1);
  assert.deepEqual(await view(h.hala, w.one), [], 'the sender sees nothing');
  assert.deepEqual(await view(h.sara, w.one), [], 'another member sees nothing');
  assert.deepEqual((await view(h.mohamed, w.one)).map((r) => [r.section, r.memory_id, r.content, r.request_id]),
    [['REQUEST', m.mohamedSleep, 'أنام مبكرًا كل يوم بسبب عملي', mohamedRequest.id]], 'the owner sees the request with their own words');
  assert.deepEqual(await collect(ask, ['نوم', 'مبكر']), [], 'a request is not a grant');

  stage = 'relevance: one per call, never a member with an open request, never an ineligible item';
  assert.equal(await propose(ask, ['نوم', 'مبكر']), 'REQUESTED');
  assert.equal((await openRequest(h.sara, w.one)).memory_id, m.saraSleep);
  assert.equal(await propose(ask, ['نوم', 'مبكر']), 'NONE', 'every member with an eligible item is already asked');
  const asked = (await rows('SELECT memory_id FROM shared_knowledge_private.requests')).map((r) => r.memory_id);
  for (const id of [m.mohamedOther, m.mohamedDerived, m.mohamedPreference, m.mohamedExpired, m.mohamedUnattributed]) {
    assert.ok(!asked.includes(id), 'an item about someone else, not stated by the owner, a preference, expired or unattributed is never asked');
  }

  stage = 'no server-made grant: the server cannot answer or write; another member cannot answer';
  await actAs('service_role');
  await rejected(() => rows('SELECT * FROM public.answer_own_shared_knowledge_request_v1($1, $2, $3, $4)',
    [randomUUID(), mohamedRequest.id, 'ALLOW', [h.hala, h.mohamed, h.sara]]), ['42501']);
  await rejected(() => rows('SELECT * FROM public.allow_own_shared_knowledge_v1($1, $2, $3, $4)',
    [randomUUID(), w.one, m.mohamedSleep, [h.hala, h.mohamed, h.sara]]), ['42501']);
  await rejected(() => client.query(`INSERT INTO shared_knowledge_private.consent_events (id, command_id, world_id, owner_user_id,
    membership_episode_id, memory_id, event_kind) VALUES ($1, $2, $3, $4, $5, $6, 'DECLINED')`,
  [randomUUID(), randomUUID(), w.one, h.mohamed, randomUUID(), m.mohamedSleep]), ['42501']);
  await asOwner();
  await actAs('authenticated', h.mohamed);
  await rejected(() => rows('SELECT * FROM shared_knowledge_private.cool_down_shared_knowledge_v1($1, $2, $3, 60)', [w.one, [h.mohamed], [m.mohamedSleep]]), ['42501']);
  await rejected(() => rows('SELECT * FROM public.list_shared_knowledge_for_reply_v1($1, $2, $3)', [w.one, ask.material, ['نوم']]), ['42501']);
  await asOwner();
  const preAnswer = await tally();
  assert.equal(await answer(h.hala, mohamedRequest.id, 'ALLOW', await audienceOf(w.one)), 'UNAVAILABLE', 'not her request');
  await rejected(() => answer(h.mohamed, mohamedRequest.id, 'ALLOW', null), ['22023']);
  await rejected(() => answer(h.mohamed, mohamedRequest.id, 'MAYBE', null), ['22023']);
  await rejected(() => answer(h.mohamed, mohamedRequest.id, 'DECLINE', [h.mohamed]), ['22023']);

  stage = 'consent: the ceiling must be exactly the current members, otherwise nothing is written';
  assert.equal(await answer(h.mohamed, mohamedRequest.id, 'ALLOW', [h.hala, h.mohamed]), 'AUDIENCE_CHANGED');
  assert.equal(await answer(h.mohamed, mohamedRequest.id, 'ALLOW', [h.hala, h.mohamed, h.sara, h.nour]), 'AUDIENCE_CHANGED');
  assert.equal(await answer(h.mohamed, mohamedRequest.id, 'ALLOW', []), 'AUDIENCE_CHANGED', 'an empty ceiling is no ceiling');
  assert.deepEqual(await tally(), preAnswer, 'no partial write on refusal');

  stage = 'consent: one answer writes one event and one pair of two families';
  const command = randomUUID();
  assert.equal(await answer(h.mohamed, mohamedRequest.id, 'ALLOW', [h.sara, h.hala, h.mohamed, h.mohamed], command), 'ALLOWED');
  await settle();
  const after = await tally();
  assert.deepEqual([after.events - preAnswer.events, after.reasoning - preAnswer.reasoning, after.disclosure - preAnswer.disclosure], [1, 1, 1]);
  const pair = await first(`SELECT r.id AS reasoning, d.id AS disclosure, r.consent_event_id, r.ceiling_user_ids, r.purpose, d.scope,
    r.content_digest, e.event_kind, e.command_id FROM shared_knowledge_private.reasoning_grants r
    JOIN shared_knowledge_private.disclosure_grants d ON d.reasoning_grant_id = r.id
    JOIN shared_knowledge_private.consent_events e ON e.id = r.consent_event_id WHERE r.memory_id = $1 AND r.status = 'ACTIVE'`, [m.mohamedSleep]);
  assert.deepEqual([pair.event_kind, pair.command_id, pair.purpose, pair.scope], ['GRANTED', command, 'SHARED_REASONING', 'MENTION_ATTRIBUTED_TO_OWNER']);
  assert.deepEqual([...pair.ceiling_user_ids].sort(), await audienceOf(w.one));
  assert.equal(pair.content_digest, digest('أنام مبكرًا كل يوم بسبب عملي'), 'the grant names the exact words (the TS digest)');
  assert.equal(await answer(h.mohamed, mohamedRequest.id, 'ALLOW', await audienceOf(w.one), command), 'ALLOWED', 'a replay is that answer');
  const saraRequest = await openRequest(h.sara, w.one);
  await rejected(() => answer(h.mohamed, saraRequest.id, 'DECLINE', null, command), ['23505']);
  assert.deepEqual(await tally(), after);

  stage = 'consent: a decline writes no grant; the declined item is not asked again';
  assert.equal(await answer(h.sara, saraRequest.id, 'DECLINE', null), 'DECLINED');
  assert.equal(await count("SELECT count(*) n FROM shared_knowledge_private.reasoning_grants WHERE owner_user_id = $1", [h.sara]), 0);
  assert.equal(await propose(ask, ['نوم', 'مبكر']), 'NONE');
  assert.deepEqual((await view(h.sara, w.one)).map((r) => [r.section, r.memory_id]), [['DECLINED', m.saraSleep]]);
  assert.deepEqual((await view(h.mohamed, w.one)).map((r) => [r.section, r.memory_id]), [['ALLOWED', m.mohamedSleep]]);

  stage = 'consent: no advance grant — an item with no decision here cannot be allowed';
  assert.equal(await allow(h.sara, w.one, m.saraTravel, await audienceOf(w.one)), 'UNAVAILABLE');
  assert.equal(await allow(h.hala, w.one, m.mohamedSleep, await audienceOf(w.one)), 'UNAVAILABLE', 'not her item');
  return { ask, mohamedGrant: pair.reasoning };
}

// ------------------------------------------------------------------------------------------------- 5–7. binding, ending, commit
async function verifyCollectorAndCommit(h, w, m, c) {
  stage = 'binding: the collector serves only consented words, one item per owner, never in another World';
  const got = await collect(c.ask, ['نوم', 'مبكر']);
  assert.deepEqual(got.map((r) => [r.owner_user_id, r.owner_name, r.memory_id, r.content, r.reasoning_grant_id]),
    [[h.mohamed, 'محمد', m.mohamedSleep, 'أنام مبكرًا كل يوم بسبب عملي', c.mohamedGrant]], 'with the owner\'s World-visible name');
  assert.deepEqual(await collect(c.ask, ['سفر']), [], 'no term of the consented item');
  const elsewhere = await send(h.hala, w.two, 'هل ينام أحد مبكرًا؟');
  assert.deepEqual(await collect(elsewhere, ['نوم', 'مبكر']), [], 'no transfer between Worlds');
  assert.equal((await resolveItem(w.two, h.mohamed, m.mohamedSleep)).grant_state, 'NONE');

  stage = 'commit: the consented reply commits with exactly one reasoning dependency and one use';
  const turn = await send(h.hala, w.one, 'نخطط لسهرة طويلة الليلة، ينفع؟');
  const started = await beginReply(turn, 'قد تكون السهرة الطويلة صعبة على محمد لأنه ينام مبكرًا بسبب عمله.');
  await rejected(() => completeReply(turn, started, [c.mohamedGrant], { refs: [] }), ['22023']);
  await rejected(() => completeReply(turn, started, [c.mohamedGrant], { refs: [`shared-knowledge:${randomUUID()}`] }), ['22023']);
  await rejected(() => completeReply(turn, started, [], { refs: [] }), ['22023']);
  await rejected(() => completeReply(turn, started, [c.mohamedGrant], { disclosed: [] }), ['22023']);
  const done = await completeReply(turn, started, [c.mohamedGrant]);
  assert.equal(done.outcome, 'MATERIAL_COMMITTED');
  assert.deepEqual((await rows(`SELECT source_context_ref FROM public.shared_world_material_dependencies
    WHERE target_material_id = $1 AND dependency_kind = 'REASONING_DEPENDENCY'`, [done.material_id])).map((r) => r.source_context_ref),
  [`shared-knowledge:${c.mohamedGrant}`]);
  const use = await first('SELECT * FROM shared_knowledge_private.uses WHERE material_id = $1', [done.material_id]);
  assert.deepEqual([use.reasoning_grant_id, use.owner_user_id, use.memory_id, use.disclosed, use.audience_snapshot_ref],
    [c.mohamedGrant, h.mohamed, m.mohamedSleep, true, started.e.audienceSnapshotRef]);

  stage = 'revoke during generation: the commit is STALE and writes nothing';
  const turn2 = await send(h.hala, w.one, 'وماذا عن الغد؟ نسهر؟');
  const started2 = await beginReply(turn2, 'محمد ينام مبكرًا، فربما الأفضل في الظهيرة.');
  assert.equal(await revoke(h.mohamed, w.one, m.mohamedSleep), 'REVOKED');
  assert.equal(await revoke(h.mohamed, w.one, m.mohamedSleep), 'UNAVAILABLE', 'nothing left to withdraw');
  const preStale = await tally();
  assert.equal((await completeReply(turn2, started2, [c.mohamedGrant])).outcome, 'STALE');
  assert.deepEqual(await tally(), preStale, 'no material, no edge, no use');
  assert.deepEqual(await collect(turn2, ['نوم']), [], 'a withdrawal stops future use');
  assert.deepEqual((await view(h.mohamed, w.one)).map((r) => [r.section, r.memory_id]), [['DECLINED', m.mohamedSleep]],
    'the owner sees the withdrawn item where allow-later lives');

  stage = 'allow-later: after a decline or a withdrawal, the owner may allow again (a new pair)';
  assert.equal(await allow(h.mohamed, w.one, m.mohamedSleep, await audienceOf(w.one)), 'ALLOWED');
  assert.equal(await allow(h.sara, w.one, m.saraSleep, await audienceOf(w.one)), 'ALLOWED');
  await settle();
  const both = await collect(turn2, ['نوم']);
  assert.deepEqual(both.map((r) => r.owner_user_id).sort(), [h.mohamed, h.sara].sort(), 'one item per owner, each under its own consent');
  assert.ok(!both.some((r) => r.reasoning_grant_id === c.mohamedGrant), 'the withdrawn pair never returns');
  const mohamedAgain = both.find((r) => r.owner_user_id === h.mohamed).reasoning_grant_id;
  const saraGrant = both.find((r) => r.owner_user_id === h.sara).reasoning_grant_id;

  stage = 'correction during generation: STALE; the owner sees it ended as corrected';
  const turn3 = await send(h.hala, w.one, 'من يحب النوم مبكرًا؟');
  const started3 = await beginReply(turn3, 'محمد ينام مبكرًا.');
  await client.query("UPDATE public.memories SET status = 'SUPERSEDED' WHERE id = $1", [m.mohamedSleep]);
  assert.equal((await completeReply(turn3, started3, [mohamedAgain])).outcome, 'STALE');
  assert.deepEqual((await resolveItem(w.one, h.mohamed, m.mohamedSleep)).grant_state, 'ENDED');
  assert.deepEqual((await view(h.mohamed, w.one)).map((r) => [r.section, r.ended_reason, r.content]), [['ENDED', 'CORRECTED', null]],
    'ended, without the old words');
  assert.deepEqual((await collect(turn3, ['نوم'])).map((r) => r.owner_user_id), [h.sara]);

  stage = 'cooldown: a withheld item is not used again before its time';
  await actAs('service_role');
  assert.equal((await first('SELECT public.cool_down_shared_knowledge_v1($1, $2, $3, 60) AS n', [w.one, [h.sara], [m.saraSleep]])).n, 1);
  await asOwner();
  assert.deepEqual(await collect(turn3, ['نوم']), []);
  await client.query('DELETE FROM shared_knowledge_private.cooldowns WHERE owner_user_id = $1', [h.sara]);

  stage = 'a new member joining during generation: STALE; NEEDS_RECONFIRMATION until the owner allows the wider audience';
  const turn4 = await send(h.hala, w.one, 'سارة، هل تنامين مبكرًا أيضًا؟');
  const started4 = await beginReply(turn4, 'سارة تنام مبكرًا كذلك.');
  await addMember(w.one, h.nour, [h.hala, h.mohamed, h.sara]);
  assert.equal((await completeReply(turn4, started4, [saraGrant])).outcome, 'STALE');
  assert.deepEqual(await collect(turn4, ['نوم']), [], 'no audience widening without reconfirmation');
  assert.deepEqual((await view(h.sara, w.one)).map((r) => [r.section, r.memory_id]), [['NEEDS_RECONFIRMATION', m.saraSleep]]);
  assert.equal(await allow(h.sara, w.one, m.saraSleep, [h.hala, h.mohamed, h.sara]), 'AUDIENCE_CHANGED');
  assert.equal(await allow(h.sara, w.one, m.saraSleep, await audienceOf(w.one)), 'ALLOWED');
  await settle();
  const saraWider = (await collect(turn4, ['نوم'])).map((r) => r.reasoning_grant_id);
  assert.equal(saraWider.length, 1);

  stage = 'leave and rejoin: the owner who left is STALE and collects nothing; a rejoin starts afresh';
  const turn5 = await send(h.hala, w.one, 'نلتقي صباحًا إذن؟');
  const started5 = await beginReply(turn5, 'الصباح يناسب سارة.');
  await leave(h.sara, w.one);
  assert.equal((await completeReply(turn5, started5, saraWider)).outcome, 'STALE');
  assert.deepEqual(await collect(turn5, ['نوم']), []);
  await rejoin(w.one, h.sara, [h.hala, h.mohamed, h.nour]);
  assert.deepEqual(await collect(turn5, ['نوم']), [], 'no transfer between membership episodes');
  assert.deepEqual(await view(h.sara, w.one), [], 'the new episode starts with nothing');
  assert.equal(await allow(h.sara, w.one, m.saraSleep, await audienceOf(w.one)), 'UNAVAILABLE', 'a fresh consent needs a fresh request');
  assert.equal((await resolveItem(w.one, h.sara, m.saraSleep)).grant_state, 'ENDED');

  stage = 'leave and rejoin: an unanswered request of an earlier episode can no longer be answered';
  const coffee = await send(h.hala, w.one, 'من يشرب القهوة؟');
  assert.equal(await propose(coffee, ['قهوة']), 'REQUESTED');
  const nourRequest = await openRequest(h.nour, w.one);
  await leave(h.nour, w.one);
  await rejoin(w.one, h.nour, [h.hala, h.mohamed, h.sara]);
  assert.deepEqual(await view(h.nour, w.one), []);
  assert.equal(await answer(h.nour, nourRequest.id, 'ALLOW', await audienceOf(w.one)), 'UNAVAILABLE');

  stage = 'forget: the forgotten item ends at once and is shown without its words';
  const sport = await send(h.mohamed, w.one, 'من يمارس الرياضة؟');
  assert.equal(await propose(sport, ['رياضة']), 'REQUESTED');
  const halaRequest = await openRequest(h.hala, w.one);
  assert.equal(halaRequest.memory_id, m.halaSport);
  assert.equal(await answer(h.hala, halaRequest.id, 'ALLOW', await audienceOf(w.one)), 'ALLOWED');
  await settle();
  assert.equal((await collect(sport, ['رياضة'])).length, 1);
  await client.query("UPDATE public.memories SET status = 'DELETED' WHERE id = $1", [m.halaSport]);
  assert.deepEqual(await collect(sport, ['رياضة']), []);
  const forgotten = await resolveItem(w.one, h.hala, m.halaSport);
  assert.deepEqual([forgotten.availability, forgotten.grant_state, forgotten.current_content_digest], ['DELETED_BY_OWNER', 'ENDED', null]);
  assert.deepEqual((await view(h.hala, w.one)).map((r) => [r.section, r.ended_reason, r.content]), [['ENDED', 'FORGOTTEN', null]]);

  stage = 'the item states: every ineligible item is unavailable';
  for (const id of [m.mohamedOther, m.mohamedDerived, m.mohamedPreference, m.mohamedExpired, m.mohamedUnattributed]) {
    assert.deepEqual([(await resolveItem(w.one, h.mohamed, id)).availability, (await resolveItem(w.one, h.mohamed, id)).current_content_digest],
      ['UNAVAILABLE', null]);
  }
  assert.equal((await resolveItem(w.one, h.mohamed, randomUUID())).availability, 'DELETED_BY_OWNER', 'a missing memory is a forgotten one');
  assert.equal((await resolveItem(w.one, h.hala, m.mohamedOther)).availability, 'DELETED_BY_OWNER', 'never another owner\'s memory');
  return { use };
}

// ------------------------------------------------------------------------------------------------- 8. history
async function verifyHistory(h, w, m) {
  stage = 'history: events and uses are immutable; a grant only moves ACTIVE → REVOKED';
  await asOwner();
  await rejected(() => client.query("UPDATE shared_knowledge_private.consent_events SET event_kind = 'DECLINED' WHERE event_kind = 'GRANTED'"), ['55000']);
  await rejected(() => client.query('UPDATE shared_knowledge_private.uses SET disclosed = false'), ['55000']);
  await rejected(() => client.query("UPDATE shared_knowledge_private.reasoning_grants SET status = 'ACTIVE', revoked_at = NULL WHERE status = 'REVOKED'"), ['55000']);
  await rejected(() => client.query("UPDATE shared_knowledge_private.reasoning_grants SET ceiling_user_ids = ARRAY[owner_user_id] WHERE status = 'ACTIVE'"), ['55000']);
  await rejected(() => client.query("UPDATE shared_knowledge_private.requests SET state = 'OPEN', answered_at = NULL, answer_event_id = NULL WHERE state <> 'OPEN'"), ['55000']);

  stage = 'history: a lone grant, or a pair revoked apart, is refused at commit';
  const episode = (await first(`SELECT id FROM public.shared_world_membership_episodes WHERE world_id = $1 AND user_id = $2 AND ended_at IS NULL`,
    [w.one, h.mohamed])).id;
  const lone = await memory(h.mohamed, 'أحب الشاي الأخضر', ['شاي']);
  await rejected(async () => {
    const event = randomUUID();
    await client.query(`INSERT INTO shared_knowledge_private.consent_events (id, command_id, world_id, owner_user_id, membership_episode_id, memory_id,
      event_kind, ceiling_user_ids, content_digest) VALUES ($1, $2, $3, $4, $5, $6, 'GRANTED', $7, $8)`,
    [event, randomUUID(), w.one, h.mohamed, episode, lone, [h.mohamed], digest('أحب الشاي الأخضر')]);
    await client.query(`INSERT INTO shared_knowledge_private.reasoning_grants (id, consent_event_id, world_id, owner_user_id, membership_episode_id,
      memory_id, content_digest, ceiling_user_ids) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [randomUUID(), event, w.one, h.mohamed, episode, lone, digest('أحب الشاي الأخضر'), [h.mohamed]]);
    await settle();
  }, ['23514']);
  await rejected(async () => {
    await client.query("UPDATE shared_knowledge_private.reasoning_grants SET status = 'REVOKED', revoked_at = now() WHERE status = 'ACTIVE' AND owner_user_id = $1", [h.mohamed]);
    await settle();
  }, ['23514']);
  assert.ok(m);
}

// ------------------------------------------------------------------------------------------------- 9. the ledger
const BEGIN_V2 = 'SELECT * FROM public.begin_ai_provider_call_v2($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::text,$7::text,$8::text,$9::text)';
async function verifyLedger(h, w) {
  stage = 'ledger: the judge is paid by the author of the causing message, never by the item\'s owner';
  const turn = await send(h.hala, w.one, 'سؤال يستحق التحقق');
  const begin = async (call, payer) => {
    await actAs('service_role');
    const row = await first(BEGIN_V2, [call, payer, w.one, turn.material, 'DEEPSEEK', 'deepseek-flash', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE',
      'SHARED_DISCLOSURE_JUDGE', null]);
    await asOwner();
    return row;
  };
  await rejected(() => begin(randomUUID(), h.mohamed), ['42501']);
  await rejected(() => begin(randomUUID(), h.sara), ['42501']);
  const call = randomUUID();
  assert.deepEqual(Object.values(await begin(call, h.hala)), ['BEGUN', 1]);
  assert.deepEqual(Object.values(await begin(call, h.hala)), ['ALREADY_BEGUN', 1]);
  assert.deepEqual(Object.values(await begin(randomUUID(), h.hala)), ['BEGUN', 2], 'one row per actual attempt');
  const row = await first('SELECT user_id, source_world_id, source_shared_material_id, feature_family FROM public.ai_provider_calls WHERE id = $1', [call]);
  assert.deepEqual(Object.values(row), [h.hala, w.one, turn.material, 'SHARED_DISCLOSURE_JUDGE']);
  assert.equal(await count("SELECT count(*) n FROM public.ai_provider_calls WHERE feature_family = 'SHARED_DISCLOSURE_JUDGE' AND user_id <> $1", [h.hala]), 0);
}

async function main() {
  await client.connect();
  try {
    await client.query('BEGIN');
    stage = 'fixtures';
    const h = { hala: randomUUID(), mohamed: randomUUID(), sara: randomUUID(), nour: randomUUID() };
    await signUp(h.hala, 'هالة', `cp3_hala_${h.hala.slice(0, 8)}`);
    await signUp(h.mohamed, 'محمد', `cp3_mohamed_${h.mohamed.slice(0, 8)}`);
    await signUp(h.sara, 'سارة', `cp3_sara_${h.sara.slice(0, 8)}`);
    await signUp(h.nour, 'نور', `cp3_nour_${h.nour.slice(0, 8)}`);
    await first('SELECT * FROM shared_private.set_shared_launch_capability_v1($1, $2, $3, $4, $5)',
      ['SHARED_CONVERSATION', 'ENABLED', 'SATISFIED', 's8a-04-cp3-verifier', 'verification fixture']);
    await first('SELECT * FROM shared_private.set_shared_launch_capability_v1($1, $2, $3, $4, $5)',
      ['SHARED_GOVERNANCE', 'ENABLED', 'SATISFIED', 's8a-04-cp3-verifier', 'verification fixture (the governed rejoin)']);
    const w = { one: await bornWorld(h.hala, h.mohamed), two: await bornWorld(h.hala, h.mohamed) };
    await addMember(w.one, h.sara, [h.hala, h.mohamed]);
    const m = {
      mohamedSleep: await memory(h.mohamed, 'أنام مبكرًا كل يوم بسبب عملي', ['نوم', 'مبكر'], { importance: 0.6 }),
      mohamedOther: await memory(h.mohamed, 'أخي ينام مبكرًا', ['نوم', 'مبكر'], { subject: 'OTHER', importance: 0.9 }),
      mohamedDerived: await memory(h.mohamed, 'يبدو أنه شخص صباحي', ['نوم', 'مبكر'], { source: 'IMPORTED', importance: 0.9 }),
      mohamedPreference: await memory(h.mohamed, 'لا تكلمني عن النوم', ['نوم', 'مبكر'], { type: 'INTERACTION_PREFERENCE', importance: 0.9 }),
      mohamedExpired: await memory(h.mohamed, 'أنام مبكرًا هذا الأسبوع', ['نوم', 'مبكر'], { importance: 0.9, expired: true }),
      mohamedUnattributed: await memory(h.mohamed, 'النوم المبكر مفيد', ['نوم', 'مبكر'], { subject: null, importance: 0.9 }),
      saraSleep: await memory(h.sara, 'أحب النوم مبكرًا', ['نوم']),
      saraTravel: await memory(h.sara, 'أسافر كثيرًا', ['سفر']),
      halaSport: await memory(h.hala, 'أمارس الرياضة صباحًا', ['رياضة']),
      nourCoffee: await memory(h.nour, 'أشرب القهوة كل صباح', ['قهوة']),
    };

    await verifyBoundary();
    const c = await verifyRelevanceAndConsent(h, w, m);
    await verifyCollectorAndCommit(h, w, m, c);
    await verifyHistory(h, w, m);
    await verifyLedger(h, w);
    console.log('Verified migration 0176 (S8A-04 CP3): a private, pinned boundary (the owner\'s read and commands for a person, the server\'s reads and acts for the server, nothing for anon, erased with the owner\'s account and with the memory); no implicit consent and no server-made grant; the local relevance read returning one word, asking only for an eligible item, once, one member at a time; one answer writing one event and one pair, the exact-ceiling rule writing nothing on refusal, a decline writing no grant, allow-later; the collector serving only consented words, one item per owner, never across Worlds or membership episodes, never to a wider audience until reconfirmed; revoke, correction, forget and cooldown ending future use; the consented reply committed with one reasoning dependency and one use, and every race (revoke, correction, a new member, a leave) STALE with nothing written; immutable history and pairs checked at commit; and the judge paid only by the author of the causing message.');
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'verification';
    console.error(`Migration 0176 verification failed at ${stage} (${code}): ${error?.message ?? error}`);
    process.exitCode = 1;
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
}

main();
