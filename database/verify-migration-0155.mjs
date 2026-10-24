// Real-PostgreSQL verifier for migration 0155 - S6-02 Introduction-Phase Privacy Isolation & Safe END Boundary v1.
//
// Runs against a FULLY migrated database. Every Matching-born World is built through the REAL I-07A..I-07D boundaries
// (as the exact humans, with the I-07B / I-07C / I-07D seams cleared by this verifier and restored after it), so no
// scenario proves something the real consent path would refuse. Every Stage 4 / S5-02 read and command is called as
// the client calls it: SET LOCAL ROLE authenticated with that human's claims, or service_role for the server channel.
//
//   P01..P06  posture: the three helpers are postgres-owned definers no application role executes; the END boundary is
//             authenticated-only, ungated, and calls exactly the frozen core; the frozen I-04 / I-07 cores are their
//             defining bodies byte for byte; 0155 creates exactly its named functions; the 0119 resolver keeps its exact
//             consumer set; no Shared Product read projects an account Name except through the projection
//   I01..I04  INTRODUCTION (D4): every Stage 4 read refuses the World like a non-member's (list, members, entry, material,
//             alerts, field); send and QANDEEL reply work are refused and write nothing; no Activity source row; the
//             owner's deletion right stands; the ordinary Standard World beside it answers exactly as before
//   N01..N05  names (A / D2): after SUCCESS every projection (members, handles, material, proposals, Activity, closed
//             members and material) answers the handoff first name to the other human and NULL for the reader's own
//             row - never the account Name, never a 0154 draft name, never a FULL_NAME disclosure, whoever disclosed;
//             no proven provenance is NULL; an ordinary World answers the account Name exactly as before
//   M01..M05  membership (A1 / D3): no ADD and no REJOIN is created, approved or accepted in a Matching-born World, even
//             one seeded before the fence; leaving and the Standard end still work; an ordinary World still adds
//   E01..E08  END (D1): either human alone, ENDED with the frozen core's full effect; a retry is the same answer; the
//             same command id for another request, an outsider and an unknown World are one UNAVAILABLE (an outsider
//             never learns that a World is settled); SUCCESS and the other human's END answer ALREADY_SETTLED; OFF is
//             respected; anon and service_role cannot call it; the author keeps deleting after END
//   R01..R06  Replay (GATE-35 / D5): Introduction-era material is refused at capture before SUCCESS, after END and,
//             for pre-SUCCESS items, after SUCCESS; post-SUCCESS material is captured and counted alone; an item AT the
//             SUCCESS instant is Introduction-era; a manifest that already holds one is never CURRENT, which every
//             preview / finalization / distribution path consults; an ordinary World's Replay is unchanged
//   A01..A02  S5-02 Public authoring lists no Introduction-era source and refuses to package one
//   X01..X02  real two-connection races through the END boundary: END x END and END x SUCCESS have exactly one winner,
//             no deadlock, and the loser is ALREADY_SETTLED
//
// Every in-transaction scenario runs in its own SAVEPOINT inside one transaction that is rolled back. The races commit;
// their fixtures are removed and the removal is checked. Every scenario reports INDEPENDENTLY and the run fails ONCE.
import assert from 'node:assert/strict';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import process from 'node:process';
import {
  APP_ROLES, D, DFN, PFN, createIntroductionRuntime, disclosureIds, runVerifier, terminalIds,
} from './introduction-lifecycle-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, asRole, actAs, rejected } = rt;

const MIGRATIONS = new URL('./migrations/', import.meta.url);
const M0155 = '0155_introduction_privacy_isolation_end_boundary_v1.sql';
const END = 'public.end_own_introduction_v1(uuid, uuid)';
const HELPERS = ['shared_private.shared_person_name_v1(uuid, uuid, uuid)',
  'shared_private.is_introduction_era_history_item_v1(uuid, uuid)',
  'shared_private.without_introduction_era_history_v1(uuid, uuid[])'];
const SUSPENDED = ['public.activate_matching_participation_v1(uuid, text, uuid)', 'public.resume_matching_participation_v1(uuid, uuid)',
  'public.grant_matching_context_v1(uuid, uuid, uuid)', 'public.set_introduction_profile_v1(uuid, text[], text[], uuid)',
  'public.set_matching_requirements_v1(uuid, text[], text[], text[], uuid)',
  'public.grant_pre_match_disclosure_authority_v1(uuid, uuid, uuid, text[], uuid)'];
/** The frozen cores S6-02 composes and must not have changed: name -> its live signature. */
const FROZEN = {
  commit_introduction_end_v1: 'public.commit_introduction_end_v1(uuid, uuid, uuid, uuid)',
  commit_introduction_success_v1: 'public.commit_introduction_success_v1(uuid, uuid, uuid, uuid)',
  commit_introduction_progressive_disclosure_v1: null,
  commit_shared_world_human_material_v1: null,
  commit_shared_world_qandeel_material_v1: null,
  resolve_shared_world_history_visibility_v1: null,
  resolve_shared_world_material_v1: null,
  delete_shared_world_owned_material_v1: null,
  prepare_shared_world_add_member_governance_v1: null,
  prepare_shared_world_rejoin_governance_v1: null,
  dispatch_shared_world_member_invitation_v1: null,
  accept_shared_world_member_invitation_v1: null,
  commit_shared_world_member_rejoin_v1: null,
  commit_shared_world_governance_approval_v1: null,
  commit_shared_world_standard_end_v1: null,
  resolve_matching_canonical_first_name_v1: null,
};
/** Exactly what 0155 creates or replaces. */
const CREATED = [
  'public.end_own_introduction_v1', 'shared_private.is_introduction_era_history_item_v1', 'shared_private.shared_person_name_v1',
  'shared_private.without_introduction_era_history_v1',
  'public.derive_replay_source_manifest_currency_v1', 'public.replay_capture_source_manifest_v1', 'public.server_read_shared_activity_source_v1',
  'public_authoring_private.list_own_public_authoring_sources_v1', 'public_authoring_private.prepare_own_public_experience_package_v1',
  'shared_private.accept_shared_membership_request_v1', 'shared_private.approve_shared_world_proposal_v1',
  'shared_private.begin_shared_qandeel_reply_work_v1', 'shared_private.complete_shared_world_qandeel_reply_v1',
  'shared_private.list_own_closed_shared_world_material_v1', 'shared_private.list_own_closed_shared_world_members_v1',
  'shared_private.list_own_shared_history_share_candidates_v1', 'shared_private.list_own_shared_history_share_requests_v1',
  'shared_private.list_own_shared_membership_requests_v1', 'shared_private.list_own_shared_world_alerts_v1',
  'shared_private.list_own_shared_world_material_v1', 'shared_private.list_own_shared_world_member_handles_v1',
  'shared_private.list_own_shared_world_members_v1', 'shared_private.list_own_shared_world_proposals_v1',
  'shared_private.list_own_shared_worlds_v1', 'shared_private.propose_shared_world_member_v1',
  'shared_private.resolve_own_shared_world_entry_v1', 'shared_private.send_shared_world_human_text_v1',
  'shared_private.set_own_shared_world_alerts_v1', 'shared_semantic_private.is_current_member_v1',
  'shared_semantic_private.list_own_closed_shared_world_material_v2', 'shared_semantic_private.list_own_shared_semantic_place_sources_v1',
].sort();

// ------------------------------------------------------------------ small helpers
const source = (file) => readFileSync(new URL(file, MIGRATIONS), 'utf8').replace(/\r\n/gu, '\n');
const migrationFiles = () => readdirSync(MIGRATIONS).filter((f) => /^\d{4}_.*\.sql$/u.test(f)).sort();
/**
 * RE-ANCHORED by S6-03: a frozen core a REVIEWED later migration redefines forward, with that migration. S6-02 did not
 * change it, and it is compared against its definition in that later migration instead. CW2-06B-01 (migration 0156)
 * replaces the first-name resolver's body so it reads the confirmed Introduction First Name; its signature, its
 * answers and its posture are unchanged, and P04 still proves 0155 itself does not define it.
 */
const REDEFINED_AFTER_0155 = Object.freeze({
  resolve_matching_canonical_first_name_v1: '0156_matching_confirmed_facts_eligibility_neutral_disclosure_v1.sql',
});
/** The body of the LAST `CREATE [OR REPLACE] FUNCTION public.<name>(` before 0155 (or in its named later redefinition), between its dollar tags. */
function definingBody(name) {
  let found = null;
  for (const file of migrationFiles().filter((f) => f < M0155 || f === REDEFINED_AFTER_0155[name])) {
    const text = source(file);
    const pattern = new RegExp(String.raw`CREATE (?:OR REPLACE )?FUNCTION public\.${name}\(`, 'gu');
    for (const match of text.matchAll(pattern)) {
      const tail = text.slice(match.index);
      const open = /\bAS\s+(\$[A-Za-z_]*\$)/u.exec(tail);
      const start = open.index + open[0].length;
      found = { file, body: tail.slice(start, tail.indexOf(open[1], start)) };
    }
  }
  assert.ok(found, `a migration before 0155 defines public.${name}`);
  return found;
}
const can = async (role, fn) => (await rows('SELECT has_function_privilege($1, $2, $3) AS ok', [role, fn, 'EXECUTE']))[0].ok;
const one1 = async (sql, values = []) => (await rows(sql, values))[0];
/** As the client: the authenticated role with this human's claims (Data API shaped). */
const as = (uid) => asRole('authenticated', uid);
const server = () => asRole('service_role');
const owner = () => asRole('postgres');
const count = async (sql, values = []) => { await owner(); return Number((await one1(sql, values)).n); };
const setGate = async (scope) => {
  await owner();
  await rows('SELECT * FROM shared_private.set_shared_launch_capability_v1($1, $2, $3, $4, $5)',
    [scope, 'ENABLED', 'SATISFIED', 's6-02-verifier', 'verification fixture']);
};
const openSharedGates = async () => {
  for (const scope of ['SHARED_CONVERSATION', 'SHARED_GOVERNANCE', 'SHARED_HISTORY_ACCESS']) await setGate(scope);
};
/** Every string a projection must never answer: account Names, a 0154 draft name, a FULL_NAME disclosure. */
const FORBIDDEN = [];
const leaksNothing = (value, label) => {
  const text = JSON.stringify(value);
  for (const forbidden of FORBIDDEN) assert.ok(!text.includes(forbidden), `${label} must never answer ${JSON.stringify(forbidden)}`);
};

// ---- the Stage 4 / S5-02 calls, exactly as the client makes them
const worldsOf = async (uid) => { await as(uid); return rows('SELECT * FROM public.list_own_shared_worlds_v1()'); };
const membersOf = async (uid) => { await as(uid); return rows('SELECT * FROM public.list_own_shared_world_members_v1()'); };
const entryOf = async (uid, world) => { await as(uid); return (await one1('SELECT * FROM public.resolve_own_shared_world_entry_v1($1)', [world])).outcome; };
const materialOf = async (uid, world) => {
  await as(uid);
  return rows('SELECT * FROM public.list_own_shared_world_material_v1($1, $2, $3, $4)', [world, null, null, 50]);
};
const sendAs = async (uid, world, text, command = randomUUID()) => {
  await as(uid);
  return { ...(await one1('SELECT * FROM public.send_shared_world_human_text_v1($1, $2, $3)', [command, world, text])), command };
};
const handlesOf = async (uid, world) => { await as(uid); return rows('SELECT * FROM public.list_own_shared_world_member_handles_v1($1)', [world]); };
const proposalsOf = async (uid, world) => { await as(uid); return rows('SELECT * FROM public.list_own_shared_world_proposals_v1($1)', [world]); };
const alertsOf = async (uid) => { await as(uid); return rows('SELECT * FROM public.list_own_shared_world_alerts_v1()'); };
const setAlerts = async (uid, world, muted) => {
  await as(uid);
  return (await one1('SELECT * FROM public.set_own_shared_world_alerts_v1($1, $2)', [world, muted])).outcome;
};
// RE-ANCHORED by S8A-04 CP2 (2026-10-24): migration 0175 revokes the bare v1 field read from members and serves the field
// through list_own_shared_semantic_field_v2 (the composed meaning). The refusal proven here is the same on either read.
const fieldOf = async (uid, world) => {
  await as(uid);
  const v2 = (await one1("SELECT to_regprocedure('public.list_own_shared_semantic_field_v2(uuid, text)') IS NOT NULL AS v2")).v2;
  return rows(v2 ? 'SELECT * FROM public.list_own_shared_semantic_field_v2($1, NULL)' : 'SELECT * FROM public.list_own_shared_semantic_field_v1($1)', [world]);
};
const closedMembersOf = async (uid) => { await as(uid); return rows('SELECT * FROM public.list_own_closed_shared_world_members_v1()'); };
const closedMaterialOf = async (uid, world) => {
  await as(uid);
  return rows('SELECT * FROM public.list_own_closed_shared_world_material_v2($1, $2, $3, $4)', [world, null, null, 50]);
};
const proposeSettings = async (uid, world, name, command = randomUUID()) => {
  await as(uid);
  return { ...(await one1('SELECT * FROM public.propose_shared_world_settings_v1($1, $2, $3, $4, $5)', [command, world, name, null, null])), command };
};
const proposeEnd = async (uid, world) => { await as(uid); return one1('SELECT * FROM public.propose_shared_world_end_v1($1, $2)', [randomUUID(), world]); };
const approve = async (uid, world, proposal) => {
  await as(uid);
  return (await one1('SELECT * FROM public.approve_shared_world_proposal_v1($1, $2, $3)', [randomUUID(), world, proposal])).outcome;
};
const proposeMember = async (uid, world, sharedId) => {
  await as(uid);
  return (await one1('SELECT * FROM public.propose_shared_world_member_v1($1, $2, $3)', [randomUUID(), world, sharedId])).outcome;
};
const acceptRequest = async (uid, world, request) => {
  await as(uid);
  return (await one1('SELECT * FROM public.accept_shared_membership_request_v1($1, $2, $3)', [randomUUID(), world, request])).outcome;
};
const leaveAs = async (uid, world) => { await as(uid); return (await one1('SELECT * FROM public.leave_shared_world_v1($1, $2)', [randomUUID(), world])).outcome; };
const deleteOwn = async (uid, world, material) => {
  await as(uid);
  return (await one1('SELECT * FROM public.delete_own_shared_world_material_v1($1, $2, $3)', [randomUUID(), world, material])).outcome;
};
const endAs = async (uid, world, command = randomUUID()) => {
  await as(uid);
  return (await one1(`SELECT * FROM ${END.replace('(uuid, uuid)', '($1, $2)')}`, [command, world])).outcome;
};
const activitySource = async (kind, id) => {
  await server();
  return rows('SELECT * FROM public.server_read_shared_activity_source_v1($1, $2)', [kind, id]);
};
const authoringSources = async (uid) => { await as(uid); return rows('SELECT * FROM public.list_own_public_authoring_sources_v1()'); };
const personName = async (world, subject, viewer) => {
  await owner();
  return (await one1('SELECT shared_private.shared_person_name_v1($1, $2, $3) AS name', [world, subject, viewer])).name;
};
const era = async (world, item) => {
  await owner();
  return (await one1('SELECT shared_private.is_introduction_era_history_item_v1($1, $2) AS era', [world, item])).era;
};

/** A canonical Shared ID (12 characters of the 0129 alphabet, grouped by four) and its 0081 lookup reference. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function drawSharedId() {
  let out = '';
  for (let i = 0; i < 12; i += 1) { out += ALPHABET[randomInt(32)]; if (i === 3 || i === 7) out += '-'; }
  return out;
}
const refOf = (canonical) => `sid1:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
/** Gives (or rotates) a human's Shared ID through the frozen 0081 rotation; returns the canonical value. */
async function giveSharedId(user) {
  await owner();
  const [state] = await rows('SELECT epoch FROM public.shared_world_invite_credential_state WHERE user_id = $1', [user]);
  const canonical = drawSharedId();
  await actAs(user);
  await rows('SELECT * FROM public.rotate_shared_world_invite_credential_v1($1, $2, $3)', [randomUUID(), refOf(canonical), state ? state.epoch : null]);
  await owner();
  return canonical;
}
/** An ACTIVE / STANDARD, ACCEPTED_INVITATION World of two humans, born through the frozen 0081 / 0082 primitives. */
async function ordinaryWorld(inviter, target) {
  const ref = refOf(await giveSharedId(target));
  await actAs(inviter);
  const invitation = randomUUID();
  await rows('SELECT * FROM public.submit_shared_world_direct_invitation_v1($1, $2, $3)', [randomUUID(), invitation, ref]);
  await actAs(target);
  const world = randomUUID();
  const [born] = await rows('SELECT outcome FROM public.commit_shared_world_direct_acceptance_birth_v1($1, $2, $3, $4, $5)',
    [randomUUID(), invitation, world, randomUUID(), randomUUID()]);
  assert.equal(born.outcome, 'BORN', 'the ordinary fixture World is born through the frozen birth primitive');
  await owner();
  return world;
}
/** A seeded ADD_MEMBER governance proposal through the frozen 0085 core, as the owner (fixture only). */
async function seedAddProposal(world, target, approvers = []) {
  await owner();
  const proposal = randomUUID();
  const [prepared] = await rows('SELECT outcome FROM public.prepare_shared_world_add_member_governance_v1($1, $2, $3, $4, $5)',
    [proposal, randomUUID(), randomUUID(), world, target]);
  assert.equal(prepared.outcome, 'PREPARED', 'the fixture add-member proposal is prepared by the frozen core');
  for (const human of approvers) {
    await actAs(human);
    await rows('SELECT outcome FROM public.commit_shared_world_governance_approval_v1($1, $2)', [randomUUID(), proposal]);
  }
  await owner();
  return proposal;
}
/** One live Introduction and, if asked, its SUCCESS: through the real I-07C / I-07D boundaries. */
async function introduction(humans, { success = false } = {}) {
  const [first, candidate] = humans;
  const f = success ? await rt.bringToSuccessApproved(first, candidate) : await rt.bringToIntroduction(first, candidate);
  if (success) {
    await owner();
    await rt.commitSuccess(terminalIds(), f.version);
    const [w] = await rows('SELECT lifecycle, phase, birth_basis FROM public.shared_worlds WHERE id = $1', [f.world]);
    assert.deepEqual(w, { lifecycle: 'ACTIVE', phase: 'STANDARD', birth_basis: 'MUTUAL_MATCH' }, 'SUCCESS continued the SAME Matching-born World as Standard');
  }
  await owner();
  return f;
}

// ---------------------------------------------------------------------- P: posture
async function verifyPosture(report) {
  await report.section('P01 the three helpers are postgres-owned SECURITY DEFINERs no application role executes', async () => {
    for (const fn of HELPERS) {
      const [p] = await rows(`SELECT p.prosecdef, pg_get_userbyid(p.proowner) owner, p.proconfig FROM pg_proc p WHERE p.oid = $1::regprocedure`, [fn]);
      assert.deepEqual(p, { prosecdef: true, owner: 'postgres', proconfig: ['search_path=""'] }, `P01 ${fn} posture`);
      for (const role of ['public', ...APP_ROLES]) assert.equal(await can(role, fn), false, `P01 ${role} must not execute ${fn}`);
    }
  });
  await report.section('P02 the END boundary is authenticated-only, ungated, and calls exactly the frozen END core', async () => {
    const [p] = await rows(`SELECT p.prosecdef, pg_get_userbyid(p.proowner) owner, p.proconfig, p.prosrc,
        pg_get_function_identity_arguments(p.oid) args, pg_get_function_result(p.oid) result
        FROM pg_proc p WHERE p.oid = $1::regprocedure`, [END]);
    assert.equal(p.prosecdef, true); assert.equal(p.owner, 'postgres'); assert.deepEqual(p.proconfig, ['search_path=""']);
    assert.equal(p.args, 'p_command_id uuid, p_world_id uuid', 'P02 the client supplies only the command and the World');
    assert.equal(p.result, 'TABLE(outcome text)', 'P02 one neutral outcome, nothing about the World or the other human');
    assert.equal(await can('authenticated', END), true, 'P02 authenticated executes the END boundary');
    for (const role of ['public', 'anon', 'service_role']) assert.equal(await can(role, END), false, `P02 ${role} must not execute it`);
    const code = p.prosrc.replace(/--[^\n]*/gu, '');
    assert.equal((code.match(/public\.commit_introduction_end_v1\(/gu) ?? []).length, 1, 'P02 the frozen core is called exactly once');
    assert.match(code, /\(SELECT auth\.uid\(\)\)/u, 'P02 the human is auth.uid()');
    assert.doesNotMatch(code, /launch_gate|prerequisites_v1|CLEARED|NOT_EVALUATED|seam/iu, 'P02 no gate and no seam: ending is an exit');
    assert.doesNotMatch(code, /INSERT|UPDATE|DELETE/u, 'P02 the boundary writes nothing of its own: every effect is the core\'s');
    for (const fn of [...SUSPENDED, FROZEN.commit_introduction_end_v1, FROZEN.commit_introduction_success_v1]) {
      assert.ok(!code.includes(fn.slice('public.'.length, fn.indexOf('('))) || fn === FROZEN.commit_introduction_end_v1, `P02 it names no ${fn}`);
      for (const role of ['public', ...APP_ROLES]) assert.equal(await can(role, fn), false, `P02 ${role} still cannot execute ${fn}`);
    }
  });
  await report.section('P03 every frozen core S6-02 composes is its defining body byte for byte', async () => {
    for (const name of Object.keys(FROZEN)) {
      const { body } = definingBody(name);
      const live = await rows(`SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = $1`, [name]);
      assert.equal(live.length, 1, `P03 exactly one public.${name}`);
      assert.equal(live[0].prosrc.replace(/\r\n/gu, '\n'), body, `P03 public.${name} is unchanged by 0155`);
    }
  });
  await report.section('P04 0155 creates or replaces exactly its named functions, and nothing frozen', async () => {
    const text = source(M0155);
    const created = [...text.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([a-z_]+\.[a-z0-9_]+)\(/gu)].map((m) => m[1]).sort();
    assert.deepEqual(created, CREATED, 'P04 the exact 0155 function set');
    for (const name of Object.keys(FROZEN)) assert.ok(!created.includes(`public.${name}`), `P04 0155 does not redefine public.${name}`);
    assert.doesNotMatch(text.replace(/--[^\n]*/gu, ''), /ALTER TABLE|CREATE TABLE|DROP |GRANT [^;]*TO (anon|service_role|PUBLIC)/u,
      'P04 no relation changes and no grant beyond the END boundary to authenticated');
    assert.deepEqual([...text.matchAll(/^GRANT [^;]+;/gmu)].map((m) => m[0]),
      ['GRANT EXECUTE ON FUNCTION public.end_own_introduction_v1(uuid, uuid) TO authenticated;'], 'P04 the one grant');
  });
  await report.section('P05 the ONE history-visibility resolver keeps its exact consumer set', async () => {
    const consumers = await rows(`SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prosrc ~ 'public\\.resolve_shared_world_history_visibility_v1\\('
        AND pr.proname <> 'resolve_shared_world_history_visibility_v1' ORDER BY 1`);
    assert.deepEqual(consumers.map((r) => r.proname), ['commit_introduction_end_v1', 'commit_shared_world_standard_end_v1',
      'derive_replay_source_manifest_currency_v1', 'prepare_public_experience_manifest_v1', 'publish_public_experience_v1',
      'replay_capture_source_manifest_v1', 'resolve_shared_world_introduction_disclosure_v1', 'resolve_shared_world_material_v1']);
    for (const fn of HELPERS) {
      const [{ prosrc }] = await rows('SELECT prosrc FROM pg_proc WHERE oid = $1::regprocedure', [fn]);
      assert.doesNotMatch(prosrc, /resolve_shared_world_history_visibility_v1/u, `P05 ${fn} calls no history-visibility resolver`);
    }
  });
  await report.section('P06 no Shared Product read projects an account Name except through the S6-02 projection', async () => {
    const leaking = await rows(`SELECT n.nspname || '.' || p.proname fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE (n.nspname IN ('shared_private', 'shared_semantic_private', 'public_authoring_private')
             OR (n.nspname = 'public' AND p.proname = 'server_read_shared_activity_source_v1'))
        AND EXISTS (SELECT 1 FROM regexp_matches(p.prosrc, 'public\\.users\\s+(?:AS\\s+)?([a-z_]+)', 'g') a(m)
                     WHERE p.prosrc ~ ('\\m' || a.m[1] || '\\.name\\M')) ORDER BY 1`);
    // The projection itself, and the pre-World direct invitation (always an ACCEPTED_INVITATION birth, so it never
    // concerns a Matching-born World) are the only two.
    assert.deepEqual(leaking.map((r) => r.fn), ['shared_private.list_own_shared_world_invitations_v1', 'shared_private.shared_person_name_v1']);
    for (const [schema, fn] of [['shared_private', 'list_own_shared_world_material_v1'], ['shared_private', 'list_own_shared_world_members_v1'],
      ['shared_private', 'list_own_shared_world_proposals_v1'], ['public', 'server_read_shared_activity_source_v1']]) {
      const [{ prosrc }] = await rows(`SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = $1 AND p.proname = $2`, [schema, fn]);
      assert.match(prosrc, /shared_private\.shared_person_name_v1\(/u, `P06 ${schema}.${fn} uses the projection`);
    }
  });
}

// ---------------------------------------------------------- the in-transaction run
async function verifyBehaviour(report, H) {
  const [one, two, three, four] = H;
  await owner();
  await q('BEGIN');
  try {
    await openSharedGates();
    // Distinct account Names, set with a Login ID exactly as sign-up writes them.
    for (const [uid, name] of [[one, 'Sara Account Fullname'], [two, 'Omar Account Fullname'], [three, 'Layla Account Fullname'], [four, 'Nour Account Fullname']]) {
      await q('UPDATE public.users SET name = $2, login_id = $3 WHERE id = $1', [uid, name, `s602${randomUUID().slice(0, 8)}`]);
    }
    FORBIDDEN.push('Sara Account Fullname', 'Omar Account Fullname', 'Draftname', 'Omar Disclosed Fullname');
    // A CONFIRMED 0154 draft first name that S6-02 must never read.
    for (const uid of [one, two]) {
      await q('INSERT INTO introductions_preparation_private.drafts (user_id, draft_version) VALUES ($1, 1)', [uid]);
      await q(`INSERT INTO introductions_preparation_private.declared_facts (user_id, first_name, first_name_state, first_name_confirmed_at)
               VALUES ($1, 'Draftname', 'CONFIRMED', clock_timestamp())`, [uid]);
    }
    await runIntroductionPhase(report, H);
    await runNames(report, H);
    await runMembership(report, H);
    await runEnd(report, H);
    await runReplay(report, H);
    await runAuthoring(report, H);
  } finally {
    await q('ROLLBACK');
    await owner();
    FORBIDDEN.length = 0;
  }
}

// ---------------------------------------------------------------- I: INTRODUCTION
async function runIntroductionPhase(report, [one, two, three]) {
  await report.isolated('I01 INTRODUCTION: every Stage 4 read refuses the World exactly as a non-member\'s', async () => {
    const f = await introduction([one, two]);
    const said = await rt.commitText(f.world, two, 'said inside the Introduction through the 0118 core');
    const ordinary = await ordinaryWorld(one, three);
    const mine = (await worldsOf(one)).map((w) => w.world_id);
    assert.ok(!mine.includes(f.world) && mine.includes(ordinary), 'I01 the Stage 4 list holds the ordinary World and not the Introduction');
    const members = await membersOf(one);
    assert.ok(members.every((m) => m.world_id !== f.world), 'I01 no member row of the Introduction');
    assert.deepEqual(members.filter((m) => m.world_id === ordinary).map((m) => [m.is_self, m.member_name]).sort(),
      [[false, 'Layla Account Fullname'], [true, 'Sara Account Fullname']].sort(), 'I01 the ordinary World answers the account Names exactly as before');
    assert.equal(await entryOf(one, f.world), 'UNAVAILABLE', 'I01 the Stage 4 entry verdict is UNAVAILABLE');
    assert.equal(await entryOf(one, ordinary), 'ALLOW', 'I01 the ordinary World still enters');
    assert.equal(await entryOf(one, randomUUID()), 'UNAVAILABLE', 'I01 and an unknown World answers the same');
    assert.deepEqual(await materialOf(one, f.world), [], 'I01 no material is read');
    assert.deepEqual(await materialOf(two, f.world), [], 'I01 not even by its own author');
    assert.deepEqual(await fieldOf(one, f.world), [], 'I01 no semantic field');
    assert.ok((await alertsOf(one)).every((a) => a.world_id !== f.world), 'I01 no per-World alerts row');
    assert.equal(await setAlerts(one, f.world, true), 'UNAVAILABLE', 'I01 and its alerts cannot be set');
    assert.deepEqual(await activitySource('HUMAN_TEXT', said.material), [], 'I01 no Stage 4 Activity is derived from its material');
  });

  await report.isolated('I02 INTRODUCTION: Stage 4 send and QANDEEL reply work are refused and write nothing', async () => {
    const f = await introduction([one, two]);
    const commands = await count('SELECT count(*) n FROM public.shared_world_material_commit_commands WHERE world_id = $1', [f.world]);
    const sent = await sendAs(one, f.world, 'a Stage 4 message into an Introduction');
    assert.equal(sent.outcome, 'UNAVAILABLE', 'I02 the send is the bounded UNAVAILABLE');
    assert.equal(await count('SELECT count(*) n FROM public.shared_world_material_commit_commands WHERE world_id = $1', [f.world]), commands,
      'I02 nothing was committed');
    const human = await rt.commitText(f.world, one, 'a human line committed through the 0118 core');
    await server();
    const [work] = await rows('SELECT * FROM public.begin_shared_qandeel_reply_work_v1($1, $2, $3)', [human.command, f.world, one]);
    assert.equal(work.work_outcome, 'UNAVAILABLE', 'I02 no QANDEEL reply work starts for an Introduction');
    const [done] = await rows('SELECT * FROM public.complete_shared_world_qandeel_reply_v1($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      [randomUUID(), human.command, f.world, 'a reply', 'ec', 'sha256:x', 'g', 'r', 'sha256:y', 'sha256:z', [], []]);
    assert.equal(done.outcome, 'UNAVAILABLE', 'I02 and no reply is completed into it');
    assert.equal(await count(`SELECT count(*) n FROM public.shared_world_materials WHERE world_id = $1 AND producer_kind = 'QANDEEL'`, [f.world]), 0);
  });

  await report.isolated('I03 INTRODUCTION: the owner\'s deletion right stands', async () => {
    const f = await introduction([one, two]);
    const said = await rt.commitText(f.world, one, 'mine to delete during the Introduction');
    assert.equal(await deleteOwn(one, f.world, said.material), 'DELETED', 'I03 the author deletes their own material through the Stage 4 boundary');
    assert.equal(await deleteOwn(two, f.world, said.material), 'UNAVAILABLE', 'I03 and nobody else can');
    await owner();
    assert.equal((await rt.itemRow(said.item)).availability_state, 'DELETED_BY_OWNER');
  });

  await report.isolated('I04 the projection itself: NULL for every unproven pair, never the account Name', async () => {
    const f = await introduction([one, two]);
    assert.equal(await personName(f.world, two, one), 'Omar', 'I04 the handoff first name presented to this viewer about this subject');
    assert.equal(await personName(f.world, one, two), 'Sara');
    assert.equal(await personName(f.world, one, one), null, 'I04 the viewer\'s own row');
    assert.equal(await personName(f.world, two, three), null, 'I04 a viewer who is not the other matched human');
    assert.equal(await personName(f.world, three, one), null, 'I04 a subject who is not the other matched human');
    assert.equal(await personName(randomUUID(), two, one), null, 'I04 an unknown World');
    // A Matching-born World with no Introduction Record, Match commit or handoff at all (owner-seeded): nothing is proven.
    const bare = await rt.seedBareIntroductionWorld(one);
    assert.equal(await personName(bare, two, one), null, 'I04 no provenance is NULL');
    const ordinary = await ordinaryWorld(one, three);
    assert.equal(await personName(ordinary, three, one), 'Layla Account Fullname', 'I04 an ordinary World answers the account Name as before');
  });
}

// ------------------------------------------------------------------- N: names
async function runNames(report, [one, two, three]) {
  await report.isolated('N01 after SUCCESS every projection answers the handoff first name and NULL for the reader, never an account Name', async () => {
    const f = await introduction([one, two]);
    const early = await rt.commitText(f.world, two, 'said by Omar during the Introduction');
    // Omar discloses his FULL_NAME during the Introduction; Sara discloses nothing. Neither consent is a display consent.
    await actAs(two);
    await rt.discloseText(disclosureIds(), f.world, 'FULL_NAME', 'Omar Disclosed Fullname');
    await owner();
    const version = randomUUID();
    await rt.prepareSuccess(version, f.world);
    for (const human of [f.lower, f.higher]) { await actAs(human); await rt.approveSuccess(randomUUID(), version, null); }
    await owner();
    await rt.commitSuccess(terminalIds(), version);

    assert.equal(await entryOf(one, f.world), 'ALLOW', 'N01 the continued Standard World enters');
    const members = (await membersOf(one)).filter((m) => m.world_id === f.world);
    assert.deepEqual(members.map((m) => [m.is_self, m.member_name]).sort(), [[false, 'Omar'], [true, null]].sort(), 'N01 members');
    leaksNothing(members, 'N01 members');
    const handles = await handlesOf(one, f.world);
    assert.deepEqual(handles.map((m) => [m.is_self, m.member_name]).sort(), [[false, 'Omar'], [true, null]].sort(), 'N01 member handles');
    const sent = await sendAs(one, f.world, 'said by Sara after SUCCESS through Stage 4');
    assert.equal(sent.outcome, 'COMMITTED', 'N01 Stage 4 send works in the Standard World');
    const material = await materialOf(one, f.world);
    const byId = Object.fromEntries(material.map((m) => [m.material_id, m]));
    assert.equal(byId[early.material].author_name, 'Omar', 'N01 the other human\'s words carry the handoff first name');
    assert.equal(byId[sent.material_id].author_name, null, 'N01 and the reader\'s own words carry no name (the self flag renders it)');
    assert.equal(byId[sent.material_id].is_self, true);
    leaksNothing(material, 'N01 material');
    const forOmar = await materialOf(two, f.world);
    assert.equal(forOmar.find((m) => m.material_id === sent.material_id).author_name, 'Sara', 'N01 Omar sees Sara\'s handoff first name');
    leaksNothing(forOmar, 'N01 material for Omar');
    // The model sees exactly what this read answers (shared-world-conversation.service.ts): no account Name reaches it.
    const activity = await activitySource('HUMAN_TEXT', sent.material_id);
    assert.deepEqual(activity.map((r) => [r.recipient_user_id, r.actor_name]), [[two, 'Sara']], 'N01 Activity names the actor to the recipient');
    leaksNothing(activity, 'N01 Activity');
    const proposal = await proposeSettings(one, f.world, 'Our continued World');
    const listed = await proposalsOf(two, f.world);
    assert.deepEqual(listed.map((p) => [p.proposal_id, p.proposer_name, p.proposer_is_self]), [[proposal.proposal_id, 'Sara', false]],
      `N01 Omar sees Sara's proposal by her handoff first name (${proposal.outcome})`);
    assert.deepEqual((await proposalsOf(one, f.world)).map((p) => [p.proposer_name, p.proposer_is_self]), [[null, true]],
      'N01 and Sara sees her own proposal with no name');
    leaksNothing(listed, 'N01 proposals');
    const proposalActivity = await activitySource('PROPOSAL', proposal.command);
    assert.deepEqual(proposalActivity.map((r) => [r.recipient_user_id, r.actor_name]), [[two, 'Sara']], 'N01 proposal Activity');
    leaksNothing(proposalActivity, 'N01 proposal Activity');
  });

  await report.isolated('N02 a closed Matching-born Standard World keeps the projection; closure and SUCCESS widen nothing', async () => {
    const f = await introduction([one, two], { success: true });
    const said = await rt.commitText(f.world, two, 'said by Omar before the Standard end');
    const proposed = await proposeEnd(one, f.world);
    const listed = await proposalsOf(one, f.world);
    const end = listed.find((p) => p.operation_kind === 'END_WORLD');
    assert.ok(end, `N02 the Standard end is proposed (${proposed.outcome})`);
    for (const human of [one, two]) await approve(human, f.world, end.proposal_id);
    await owner();
    const [w] = await rows('SELECT lifecycle, phase FROM public.shared_worlds WHERE id = $1', [f.world]);
    assert.deepEqual(w, { lifecycle: 'READ_ONLY_CLOSED', phase: 'STANDARD' }, 'N02 the unanimous Standard end closed it');
    const closed = (await closedMembersOf(one)).filter((m) => m.world_id === f.world);
    assert.deepEqual(closed.map((m) => [m.is_self, m.member_name]).sort(), [[false, 'Omar'], [true, null]].sort(), 'N02 closed members');
    const material = await closedMaterialOf(one, f.world);
    assert.equal(material.find((m) => m.material_id === said.material)?.author_name, 'Omar', 'N02 closed material');
    leaksNothing([closed, material], 'N02 closed views');
  });

  await report.isolated('N03 an ordinary Standard World answers account Names exactly as before', async () => {
    const world = await ordinaryWorld(one, three);
    const sent = await sendAs(three, world, 'said by Layla in an ordinary World');
    assert.equal(sent.outcome, 'COMMITTED');
    const row = (await materialOf(one, world)).find((m) => m.material_id === sent.material_id);
    assert.equal(row.author_name, 'Layla Account Fullname', 'N03 the ordinary author name is the account Name');
    assert.equal((await materialOf(three, world)).find((m) => m.material_id === sent.material_id).author_name, 'Layla Account Fullname',
      'N03 and the author\'s own row still carries it in an ordinary World');
    const activity = await activitySource('HUMAN_TEXT', sent.material_id);
    assert.deepEqual(activity.map((r) => [r.recipient_user_id, r.actor_name]), [[one, 'Layla Account Fullname']], 'N03 ordinary Activity');
  });
}

// --------------------------------------------------------------- M: membership
async function runMembership(report, [one, two, three, four]) {
  await report.isolated('M01 a Matching-born Standard World creates no ADD for a third human', async () => {
    const f = await introduction([one, two], { success: true });
    const before = await count('SELECT count(*) n FROM public.shared_world_governance_proposals WHERE world_id = $1', [f.world]);
    assert.equal(await proposeMember(one, f.world, await giveSharedId(three)), 'UNAVAILABLE', 'M01 no third member is proposed');
    assert.equal(await count('SELECT count(*) n FROM public.shared_world_governance_proposals WHERE world_id = $1', [f.world]), before,
      'M01 and nothing was created');
  });

  await report.isolated('M02 leaving still works, and an original human is never proposed back (no REJOIN)', async () => {
    const f = await introduction([one, two], { success: true });
    assert.equal(await leaveAs(two, f.world), 'LEFT', 'M02 the right to leave is unchanged');
    const before = await count('SELECT count(*) n FROM public.shared_world_governance_proposals WHERE world_id = $1', [f.world]);
    assert.equal(await proposeMember(one, f.world, await giveSharedId(two)), 'UNAVAILABLE', 'M02 the original human is not proposed back');
    assert.equal(await count('SELECT count(*) n FROM public.shared_world_governance_proposals WHERE world_id = $1', [f.world]), before);
    assert.equal(await count('SELECT count(*) n FROM public.shared_world_membership_episodes WHERE world_id = $1 AND ended_at IS NULL', [f.world]), 1);
  });

  await report.isolated('M03 an add-member proposal seeded before the fence is never approved or dispatched', async () => {
    const f = await introduction([one, two], { success: true });
    await giveSharedId(three);
    const proposal = await seedAddProposal(f.world, three);
    const approvals = await count('SELECT count(*) n FROM public.shared_world_governance_approvals WHERE proposal_id = $1', [proposal]);
    assert.equal(await approve(one, f.world, proposal), 'UNAVAILABLE', 'M03 the approval is refused');
    assert.equal(await count('SELECT count(*) n FROM public.shared_world_governance_approvals WHERE proposal_id = $1', [proposal]), approvals,
      'M03 and no approval was recorded');
    assert.equal(await count('SELECT count(*) n FROM public.shared_world_member_invitations WHERE governance_proposal_id = $1', [proposal]), 0,
      'M03 and no invitation was dispatched');
  });

  await report.isolated('M04 a complete request seeded before the fence is never accepted', async () => {
    const f = await introduction([one, two], { success: true });
    await giveSharedId(three);
    const proposal = await seedAddProposal(f.world, three, [one, two]);
    await owner();
    await rows('SELECT outcome FROM public.dispatch_shared_world_member_invitation_v1($1, $2)', [randomUUID(), proposal]);
    assert.equal(await acceptRequest(three, f.world, proposal), 'UNAVAILABLE', 'M04 the target cannot join');
    assert.equal(await count('SELECT count(*) n FROM public.shared_world_membership_episodes WHERE world_id = $1 AND user_id = $2', [f.world, three]), 0,
      'M04 and no membership episode exists');
  });

  await report.isolated('M05 an ordinary Standard World still adds a member', async () => {
    const world = await ordinaryWorld(one, three);
    assert.equal(await proposeMember(one, world, await giveSharedId(four)), 'SUBMITTED', 'M05 the ordinary add is submitted');
    assert.equal(await count(`SELECT count(*) n FROM public.shared_world_governance_proposals WHERE world_id = $1 AND operation_kind = 'ADD_MEMBER'`, [world]), 1,
      'M05 and its proposal exists');
  });
}

// ---------------------------------------------------------------------- E: END
async function runEnd(report, [one, two, three]) {
  const endState = async (f) => {
    await owner();
    const [w] = await rows('SELECT lifecycle, phase FROM public.shared_worlds WHERE id = $1', [f.world]);
    return { world: w, effects: await rt.terminalEffects(f.record, f.world), terminal: await rt.terminalRow(f.record) };
  };
  for (const [label, actor] of [['E01 the lower human', 'lower'], ['E02 the higher human', 'higher']]) {
    await report.isolated(`${label} ends the Introduction alone, ungated, with the frozen core's whole effect`, async () => {
      const f = await introduction([one, two]);
      const human = f[actor];
      const other = actor === 'lower' ? f.higher : f.lower;
      const command = randomUUID();
      assert.equal(await endAs(human, f.world, command), 'ENDED', `${label} ENDED`);
      const s = await endState(f);
      assert.deepEqual(s.world, { lifecycle: 'READ_ONLY_CLOSED', phase: 'INTRODUCTION' }, `${label} the World is archived, still INTRODUCTION`);
      assert.equal(s.terminal.terminal_outcome, 'CLOSED'); assert.equal(s.terminal.ending_actor_user_id, human);
      assert.equal(s.terminal.id, command, `${label} the terminal commit is this command`);
      assert.equal((await rt.recordRow(f.record)).introduction_status, 'CLOSED');
      for (const h of [f.lower, f.higher]) {
        assert.equal((await rt.heldClaimOf(h)), null, `${label} no claim is still HELD`);
        const act = await rt.currentParticipationOf(h);
        assert.deepEqual([act.resulting_state, act.resulting_pause_reason], ['PAUSED', 'POST_INTRODUCTION'], `${label} both are POST_INTRODUCTION`);
        assert.ok(await rt.entitlementOf(f.world, h), `${label} each keeps the closed-view entitlement`);
      }
      // A retry of the committed command is the same answer and changes nothing.
      assert.equal(await endAs(human, f.world, command), 'ENDED', `${label} a retry is ENDED`);
      assert.deepEqual((await endState(f)).effects, s.effects, `${label} and changes nothing`);
      // The other human, with the same command id, is another request: one bounded UNAVAILABLE.
      assert.equal(await endAs(other, f.world, command), 'UNAVAILABLE', `${label} a reused command id for another request is refused`);
      // ... and with a fresh command: the Introduction is already settled.
      assert.equal(await endAs(other, f.world), 'ALREADY_SETTLED', `${label} the other human learns only that it is settled`);
      assert.deepEqual((await endState(f)).effects, s.effects, `${label} exactly one terminal outcome`);
    });
  }

  await report.isolated('E03 an outsider and an unknown World are one UNAVAILABLE, before and after the END', async () => {
    const f = await introduction([one, two]);
    const before = await endState(f);
    assert.equal(await endAs(three, f.world), 'UNAVAILABLE', 'E03 an outsider cannot end it');
    assert.equal(await endAs(three, randomUUID()), 'UNAVAILABLE', 'E03 an unknown World answers the same');
    assert.deepEqual(await endState(f), before, 'E03 nothing moved');
    assert.equal(await endAs(one, f.world), 'ENDED');
    assert.equal(await endAs(three, f.world), 'UNAVAILABLE', 'E03 after the END an outsider still learns nothing (not ALREADY_SETTLED)');
    const command = randomUUID();
    assert.equal(await endAs(one, randomUUID(), command), 'UNAVAILABLE', 'E03 a human\'s END of a World that is not theirs');
  });

  await report.isolated('E04 after SUCCESS the END is ALREADY_SETTLED and the Standard World continues', async () => {
    const f = await introduction([one, two], { success: true });
    assert.equal(await endAs(one, f.world), 'ALREADY_SETTLED', 'E04 SUCCESS already won');
    const s = await endState(f);
    assert.deepEqual(s.world, { lifecycle: 'ACTIVE', phase: 'STANDARD' }, 'E04 the World is still the continued Standard World');
    assert.equal(s.terminal.terminal_outcome, 'COMPLETED');
  });

  await report.isolated('E05 a human who turned Matching OFF stays OFF; the other is POST_INTRODUCTION', async () => {
    const f = await introduction([one, two]);
    await rt.turnOffDuringIntroduction(f.higher);
    assert.equal(await endAs(f.lower, f.world), 'ENDED');
    await owner();
    assert.equal((await rt.currentParticipationOf(f.higher)).resulting_state, 'OFF', 'E05 OFF is respected, never resumed or paused');
    assert.equal((await rt.currentParticipationOf(f.lower)).resulting_pause_reason, 'POST_INTRODUCTION');
  });

  await report.isolated('E06 anon and service_role cannot call the END boundary; no claims is the authentication refusal', async () => {
    const f = await introduction([one, two]);
    await asRole('anon');
    await rejected(() => rows(`SELECT * FROM public.end_own_introduction_v1($1, $2)`, [randomUUID(), f.world]), ['42501']);
    await server();
    await rejected(() => rows(`SELECT * FROM public.end_own_introduction_v1($1, $2)`, [randomUUID(), f.world]), ['42501']);
    await as(null);
    await rejected(() => rows(`SELECT * FROM public.end_own_introduction_v1($1, $2)`, [randomUUID(), f.world]), ['42501'],
      /INTRODUCTION_END_AUTHENTICATION_REQUIRED/u);
    await as(one);
    await rejected(() => rows(`SELECT * FROM public.end_own_introduction_v1($1, $2)`, [null, f.world]), ['22023']);
    await owner();
    assert.equal((await rt.recordRow(f.record)).introduction_status, 'ACTIVE', 'E06 nothing ended');
  });

  await report.isolated('E07 the author keeps deleting their own words after the END', async () => {
    const f = await introduction([one, two]);
    const said = await rt.commitText(f.world, one, 'mine, said before the end');
    assert.equal(await endAs(two, f.world), 'ENDED');
    await actAs(one);
    const [deleted] = await rt.deleteMaterial(randomUUID(), f.world, said.material, randomUUID());
    assert.ok(deleted, 'E07 the canonical owner deletion still answers after the END');
    await owner();
    assert.equal((await rt.itemRow(said.item)).availability_state, 'DELETED_BY_OWNER', 'E07 and the item is deleted');
  });

  await report.isolated('E08 the END boundary derives the same two participation events for the same command', async () => {
    const f = await introduction([one, two]);
    const command = randomUUID();
    assert.equal(await endAs(f.lower, f.world, command), 'ENDED');
    await owner();
    const t = await rt.terminalRow(f.record);
    assert.ok(t.lower_participation_event_id && t.higher_participation_event_id, 'E08 both events were written');
    assert.notEqual(t.lower_participation_event_id, t.higher_participation_event_id);
    const derive = (slot) => {
      const h = createHash('sha256').update(`QANDEEL_S6_02_INTRODUCTION_END_PARTICIPATION_EVENT_V1\n${slot}\n${command.toLowerCase()}`, 'utf8').digest('hex');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
    };
    assert.deepEqual([t.lower_participation_event_id, t.higher_participation_event_id], [derive('LOWER'), derive('HIGHER')],
      'E08 the events are the command\'s deterministic LOWER / HIGHER identities');
  });
}

// ------------------------------------------------------------------- R: Replay
async function runReplay(report, [one, two, three]) {
  const fresh = (extra) => ({ command: randomUUID(), replay: randomUUID(), manifest: randomUUID(), selection: randomUUID(), ...extra });
  const createDraft = (s) => rows(
    'SELECT * FROM public.create_replay_draft_v1($1, $2, $3, $4, $5, $6, $7, $8::uuid[], $9::uuid[], $10::integer[], $11::integer[], $12)',
    [s.command, s.replay, s.manifest, s.selection, 'SHARED_WORLD', s.context, null, s.items, s.items, s.items.map(() => null), s.items.map(() => null), 'SELECTED_EXCERPT']);
  const refused = async (uid, world, items, label) => {
    await actAs(uid);
    await rejected(() => createDraft(fresh({ context: world, items })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
    await owner();
    assert.equal(await count('SELECT count(*) n FROM public.replay_source_manifest_versions WHERE shared_world_id = $1', [world]), 0, `${label} no manifest`);
  };

  await report.isolated('R01 before SUCCESS no Introduction material is a Replay source, for either human', async () => {
    const f = await introduction([one, two]);
    const a = await rt.commitText(f.world, one, 'Sara during the Introduction');
    const b = await rt.commitText(f.world, two, 'Omar during the Introduction');
    for (const uid of [one, two]) await refused(uid, f.world, [a.material], 'R01');
    await refused(two, f.world, [b.material], 'R01 own words');
    assert.equal(await era(f.world, a.item), true, 'R01 the item is Introduction-era');
  });

  await report.isolated('R02 after END without SUCCESS everything stays excluded', async () => {
    const f = await introduction([one, two]);
    const a = await rt.commitText(f.world, one, 'Sara before the END');
    assert.equal(await endAs(two, f.world), 'ENDED');
    await refused(one, f.world, [a.material], 'R02');
  });

  await report.isolated('R03 after SUCCESS: pre-SUCCESS material is refused, post-SUCCESS material is captured and counted alone', async () => {
    const f = await introduction([one, two]);
    const early = await rt.commitText(f.world, two, 'Omar during the Introduction');
    const version = randomUUID();
    await rt.prepareSuccess(version, f.world);
    for (const human of [f.lower, f.higher]) { await actAs(human); await rt.approveSuccess(randomUUID(), version, null); }
    await owner();
    await rt.commitSuccess(terminalIds(), version);
    const late = await rt.commitText(f.world, two, 'Omar after SUCCESS');
    assert.equal(await era(f.world, early.item), true, 'R03 the pre-SUCCESS item is Introduction-era');
    assert.equal(await era(f.world, late.item), false, 'R03 the post-SUCCESS item is not');
    await refused(one, f.world, [early.material], 'R03 pre-SUCCESS');
    await actAs(one);
    await rejected(() => createDraft(fresh({ context: f.world, items: [late.material, early.material] })), ['P0002'], /REPLAY_SOURCE_NOT_AVAILABLE/u);
    const spec = fresh({ context: f.world, items: [late.material] });
    const [created] = await createDraft(spec);
    assert.ok(created, 'R03 the post-SUCCESS material is captured');
    await owner();
    const [manifest] = await rows('SELECT item_count, authorized_universe_item_count FROM public.replay_source_manifest_versions WHERE id = $1', [spec.manifest]);
    assert.deepEqual(manifest, { item_count: 1, authorized_universe_item_count: 1 },
      'R03 the authorized universe counts only the post-SUCCESS material: the Introduction era is not even counted');
    assert.deepEqual((await rows('SELECT * FROM public.derive_replay_source_manifest_currency_v1($1)', [spec.manifest])).map((r) => r.currency_state), ['CURRENT']);
  });

  await report.isolated('R04 an item AT the SUCCESS instant is Introduction-era; one strictly after it is not', async () => {
    const f = await introduction([one, two], { success: true });
    // Two synthetic history items of this World at exact instants, as the owner, inside this savepoint only. The instants
    // are taken from the SUCCESS fact in SQL: a JavaScript Date would round the microseconds away.
    const atItem = randomUUID();
    const afterItem = randomUUID();
    await q(`INSERT INTO public.shared_world_history_items
               (id, world_id, occurred_at, registered_at, authority_requirement_mode, availability_state, availability_revision)
             SELECT x.id, ce.world_id, ce.occurred_at + x.shift, ce.occurred_at + x.shift, 'NO_HUMAN_APPROVAL_REQUIRED', 'AVAILABLE', 1
               FROM public.introduction_completed_events ce
              CROSS JOIN (VALUES ($1::uuid, interval '0'), ($2::uuid, interval '1 microsecond')) AS x(id, shift)
              WHERE ce.world_id = $3`, [atItem, afterItem, f.world]);
    const [{ same }] = await rows(`SELECT i.occurred_at = ce.occurred_at AS same FROM public.shared_world_history_items i
      JOIN public.introduction_completed_events ce ON ce.world_id = i.world_id WHERE i.id = $1`, [atItem]);
    assert.equal(same, true, 'R04 (fixture: the first item occurred exactly at the SUCCESS instant)');
    assert.equal(await era(f.world, atItem), true, 'R04 occurred_at = SUCCESS is excluded');
    assert.equal(await era(f.world, afterItem), false, 'R04 occurred_at > SUCCESS is not');
    assert.equal(await era(f.world, randomUUID()), true, 'R04 an unknown item is excluded (fail-closed)');
  });

  await report.isolated('R05 a manifest that already holds Introduction-era material is never CURRENT, so no later path can use it', async () => {
    const f = await introduction([one, two]);
    const a = await rt.commitText(f.world, one, 'Sara during the Introduction');
    // A manifest captured as if before this fence existed: the filter is lifted for exactly one capture, then put back.
    const [{ def }] = await rows(`SELECT pg_get_functiondef('shared_private.without_introduction_era_history_v1(uuid, uuid[])'::regprocedure) def`);
    const [{ prosrc: filterBefore }] = await rows(`SELECT prosrc FROM pg_proc WHERE oid = 'shared_private.without_introduction_era_history_v1(uuid, uuid[])'::regprocedure`);
    await q(`CREATE OR REPLACE FUNCTION shared_private.without_introduction_era_history_v1(p_world_id uuid, p_history_item_ids uuid[])
             RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $legacy$ SELECT p_history_item_ids $legacy$`);
    const spec = fresh({ context: f.world, items: [a.material] });
    await actAs(one);
    const [created] = await createDraft(spec);
    await owner();
    await q(def);
    const [{ prosrc: filterAfter }] = await rows(`SELECT prosrc FROM pg_proc WHERE oid = 'shared_private.without_introduction_era_history_v1(uuid, uuid[])'::regprocedure`);
    assert.equal(filterAfter, filterBefore, 'R05 the production filter is restored byte for byte');
    const [currency] = await rows('SELECT * FROM public.derive_replay_source_manifest_currency_v1($1)', [spec.manifest]);
    assert.deepEqual(currency, { currency_state: 'STALE', staleness_class: 'SOURCE_ACCESS_LOST' }, 'R05 the captured Introduction item is not current');
    // Every later Replay path - revision, preview, finalization, availability, distribution - acts on this one derivation.
    const consumers = await rows(`SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prosrc ~ 'derive_replay_source_manifest_currency_v1\\(' AND pr.proname <> 'derive_replay_source_manifest_currency_v1' ORDER BY 1`);
    assert.deepEqual(consumers.map((r) => r.proname), ['approve_replay_distribution_v1', 'authorize_replay_distribution_v1',
      'derive_replay_version_current_availability_v1', 'finalize_replay_version_v1', 'prepare_replay_distribution_package_v1',
      'prepare_replay_preview_v1', 'resolve_replay_draft_composition_v1', 'revise_replay_draft_v1'],
    'R05 the derivation every revision, composition, preview, finalization, availability and distribution path consults');
    await actAs(one);
    await rejected(() => rows('SELECT * FROM public.revise_replay_draft_v1($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid[], $10::uuid[], $11::integer[], $12::integer[], $13)',
      [randomUUID(), spec.replay, created.resulting_draft_revision, null, randomUUID(), null, null, null, null, [a.material], [null], [null], 'SELECTED_EXCERPT']),
    ['40001'], /REPLAY_SOURCE_STALE/u);
    await owner();
  });

  await report.isolated('R06 an ordinary World\'s Replay is unchanged', async () => {
    const world = await ordinaryWorld(one, three);
    const a = await sendAs(one, world, 'an ordinary sentence for Replay');
    const b = await sendAs(three, world, 'another ordinary sentence');
    await actAs(one);
    const spec = fresh({ context: world, items: [a.material_id, b.material_id] });
    await createDraft(spec);
    await owner();
    const [manifest] = await rows('SELECT item_count, authorized_universe_item_count FROM public.replay_source_manifest_versions WHERE id = $1', [spec.manifest]);
    assert.deepEqual(manifest, { item_count: 2, authorized_universe_item_count: 2 }, 'R06 captured and counted exactly as before');
    assert.equal(await era(world, (await rt.materialRow(a.material_id)).history_item_id), false, 'R06 an ordinary World has no Introduction era');
  });
}

// -------------------------------------------------------- A: S5-02 Public authoring
async function runAuthoring(report, [one, two]) {
  await report.isolated('A01 Public authoring lists no Introduction-era source, and names the other human only by the projection', async () => {
    const f = await introduction([one, two]);
    const early = await rt.commitText(f.world, two, 'Omar during the Introduction, never a Public source');
    const sourcesDuring = (await authoringSources(one)).filter((s) => s.world_id === f.world);
    assert.deepEqual(sourcesDuring, [], 'A01 nothing of a live Introduction');
    await owner();
    const version = randomUUID();
    await rt.prepareSuccess(version, f.world);
    for (const human of [f.lower, f.higher]) { await actAs(human); await rt.approveSuccess(randomUUID(), version, null); }
    await owner();
    await rt.commitSuccess(terminalIds(), version);
    const late = await rt.commitText(f.world, two, 'Omar after SUCCESS');
    const sources = (await authoringSources(one)).filter((s) => s.world_id === f.world);
    assert.deepEqual(sources.map((s) => s.source_id), [late.material], 'A01 only the post-SUCCESS material');
    assert.equal(sources[0].author_name, 'Omar', 'A01 with the handoff first name');
    assert.ok(!sources.some((s) => s.source_id === early.material));
    leaksNothing(sources, 'A01 sources');
  });

  await report.isolated('A02 Public authoring refuses to package Introduction-era material, exactly as an unseen source', async () => {
    const f = await introduction([one, two]);
    const early = await rt.commitText(f.world, one, 'Sara during the Introduction, never Public');
    const version = randomUUID();
    await rt.prepareSuccess(version, f.world);
    for (const human of [f.lower, f.higher]) { await actAs(human); await rt.approveSuccess(randomUUID(), version, null); }
    await owner();
    await rt.commitSuccess(terminalIds(), version);
    const late = await rt.commitText(f.world, one, 'Sara after SUCCESS');
    await as(one);
    const [draft] = await rows('SELECT * FROM public.start_own_public_experience_draft_v1($1)', [randomUUID()]);
    const prepare = async (material) => {
      await as(one);
      return (await one1('SELECT * FROM public.prepare_own_public_experience_package_v1($1, $2, $3, $4, $5)',
        [randomUUID(), draft.experience_id, [], [f.world], [material]])).outcome;
    };
    assert.equal(await prepare(early.material), 'UNAVAILABLE', 'A02 the Introduction-era material is refused');
    assert.equal(await prepare(randomUUID()), 'UNAVAILABLE', 'A02 with the same answer a nonexistent source gets');
    assert.equal(await count('SELECT count(*) n FROM public.publication_package_manifest_versions WHERE experience_id = $1', [draft.experience_id]), 0,
      'A02 and no package exists');
    assert.equal(await prepare(late.material), 'PREPARED', 'A02 the post-SUCCESS material of the same World is packaged as before');
  });
}

// ------------------------------------------------------------------- X: races
async function verifyRaces(report, H) {
  const [one, two] = H;
  const extra = await rt.openExtra();
  const { qx, actAsX } = extra;
  const waitExtra = () => rt.waitForLockWait(q, extra.pid);
  const outcomeOf = (promise) => promise.then((r) => r.rows[0]?.outcome ?? null, (error) => error);
  const endX = (world) => qx('SELECT * FROM public.end_own_introduction_v1($1, $2)', [randomUUID(), world]);
  const race = (name, body) => report.section(name, async () => {
    try { await body(); } finally {
      await q('ROLLBACK').catch(() => undefined);
      await owner();
      await rt.cleanupIntroductionRace([one, two]);
    }
  });
  try {
    await race('X01 END x END: two humans end at once, exactly one wins, the other is ALREADY_SETTLED, no deadlock', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await q('BEGIN');
      await as(f.lower);
      const [mine] = await rows('SELECT * FROM public.end_own_introduction_v1($1, $2)', [randomUUID(), f.world]);
      assert.equal(mine.outcome, 'ENDED', 'X01 the first END holds the World row');
      await owner();
      await actAsX(f.higher);
      await qx('BEGIN');
      await qx('SET LOCAL ROLE authenticated');
      const contender = outcomeOf(endX(f.world));
      assert.equal(await waitExtra(), true, 'X01 the second END is observably waiting on the World lock');
      await q('COMMIT');
      const outcome = await contender;
      await qx('COMMIT').catch(() => undefined);
      assert.ok(!(outcome instanceof Error), `X01 the loser is answered, not failed: ${outcome?.code ?? ''} ${outcome?.message ?? ''}`);
      assert.equal(outcome, 'ALREADY_SETTLED', 'X01 the loser is told only that it is settled');
      await owner();
      assert.equal((await rt.terminalRow(f.record)).ending_actor_user_id, f.lower, 'X01 exactly one terminal winner');
    });

    await race('X02 END x SUCCESS: SUCCESS holds the World first; END is ALREADY_SETTLED; no hybrid', async () => {
      const f = await rt.bringToSuccessApproved(one, two);
      await q('BEGIN');
      await owner();
      await rt.commitSuccess(terminalIds(), f.version);
      await actAsX(f.lower);
      await qx('BEGIN');
      await qx('SET LOCAL ROLE authenticated');
      const contender = outcomeOf(endX(f.world));
      assert.equal(await waitExtra(), true, 'X02 END is observably waiting on the World lock SUCCESS holds');
      await q('COMMIT');
      const outcome = await contender;
      await qx('COMMIT').catch(() => undefined);
      assert.ok(!(outcome instanceof Error), `X02 the loser is answered, not failed: ${outcome?.code ?? ''} ${outcome?.message ?? ''}`);
      assert.equal(outcome, 'ALREADY_SETTLED', 'X02 END lost to SUCCESS and says only that');
      await owner();
      const [w] = await rows('SELECT lifecycle, phase FROM public.shared_worlds WHERE id = $1', [f.world]);
      assert.deepEqual(w, { lifecycle: 'ACTIVE', phase: 'STANDARD' }, 'X02 the World continued as Standard');
      assert.equal((await rt.terminalRow(f.record)).terminal_outcome, 'COMPLETED', 'X02 exactly one terminal outcome');
    });
  } finally {
    await extra.close();
  }
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
await runVerifier('0155', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '60s'");
  setStage('fixtures');
  await rt.provisionHumans(humans);
  const report = createScenarioReport('0155', { query: q, restore: () => owner() });

  setStage('posture');
  await verifyPosture(report);

  const seams = [];
  for (const fn of [PFN.FIRST_NAME, PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE]) {
    seams.push(await rt.captureMatchingSeam(fn));
  }
  try {
    await rt.resolveFirstName({ [humans[0]]: 'Sara', [humans[1]]: 'Omar', [humans[2]]: 'Layla', [humans[3]]: 'Nour' });
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();
    setStage('behaviour');
    await verifyBehaviour(report, humans);
    setStage('races');
    await verifyRaces(report, humans);
  } finally {
    await owner();
    for (const seam of seams) await rt.restoreMatchingSeam(seam);
  }

  setStage('teardown');
  await report.section('the run leaves nothing behind and every seam is fail-closed again', async () => {
    for (const seam of ['public.resolve_introduction_disclosure_prerequisites_v1', 'public.resolve_introduction_success_prerequisites_v1',
      'public.resolve_matching_reactivation_prerequisites_v1']) {
      assert.equal(await rt.seamClearance(seam), 'NOT_EVALUATED', `${seam} is fail-closed again`);
    }
    await rt.cleanupIntroductionRace(humans);
    await rt.removeFixtureHumans(humans);
    const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
        + (SELECT count(*) FROM public.introduction_records WHERE lower_user_id = ANY($1::uuid[]) OR higher_user_id = ANY($1::uuid[]))
        + (SELECT count(*) FROM shared_private.shared_launch_capability_states) AS residue`, [humans]);
    assert.equal(Number(residue), 0, 'every fixture this verifier created was rolled back or removed, and no Shared gate is configured');
  });
  report.print();
  report.assertAllPassed();
}, () => rt.client.end().catch(() => undefined));
