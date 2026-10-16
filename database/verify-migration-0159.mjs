// S6-05 / migration 0159 - real-PostgreSQL proof of the second recipient's Mutual Match acceptance (CP2).
//
//   A  posture: one authenticated-only acceptance and the redefined private helper; the frozen 0114 core and every I-07
//      core still executable by nobody; the 0114 core byte-identical to its migration; the helper is the 0158 helper
//      with exactly the ACCEPT delta; the human is auth.uid(); the shell takes a command, a proposal and a view only,
//      enters the lock, asks the helper, calls the core once and absorbs its 40001 with PT409 named
//   B  production stays closed: the CW2-08 seam answers NOT_EVALUATED; nothing exists to accept; anonymous and claim-less
//      callers are refused; a real forwarded proposal shows no ACCEPT and accepting it is NOT_AVAILABLE_NOW, writing
//      nothing - not even a lock row version
//   C  presentation: the second recipient awaiting a decision is offered ACCEPT and DECLINE; nobody else is offered it
//   D  the Match: MATCHED with the World the core bound; exactly one Match, World, two episodes, one Introduction Record,
//      both facts, two claims, two pauses and one handoff, all at one instant, all under the nine DERIVED identities; both
//      humans read MATCH_CONCLUDED; no grant, no material, nothing private in the answer; the born Introduction is the one
//      S6-02 END ends with the launch seam closed again, and the acceptance still replays after it
//   E  refusals change nothing: another human, a guessed id, a view that is not the caller's current one, a passed
//      deadline, a failed revalidation, a withdrawn or declined proposal, a stale first approval, a reused command id,
//      and an identity collision in the core's write region (no ghost World, claim, pause or handoff)
//   F  idempotency: a replay answers the original World and writes nothing
//   G  races, on two real connections: the same command twice; two commands of one human; acceptance against the first
//      party's withdrawal, in both orders; acceptance waiting on the pair lock across the deadline; two candidates of one
//      first recipient accepting at once - exactly one Match every time, and the loser decides nothing
//
// Positive paths run on SYNTHETIC fixture humans inside transactions that roll back, with the CW2-08 seam replaced for
// the run and restored byte for byte; the races commit their fixtures and remove them. Nothing permissive survives.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { createMatchRuntime, P, PFN, MATCH, MFN_MATCH, runVerifier, APP_ROLES } from './matching-match-verifier-support.mjs';

const rt = createMatchRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const FN = Object.freeze({
  ACCEPT: 'public.accept_my_matching_proposal_v1(uuid,uuid,uuid)',
  PRESENT: 'public.resolve_my_matching_proposal_presentation_v1(uuid)',
  GET: 'public.get_my_matching_proposal_v1(uuid)',
  WITHDRAW: 'public.withdraw_my_matching_proposal_v1(uuid,uuid,uuid)',
  DECLINE: 'public.decline_my_matching_proposal_v1(uuid,uuid,uuid)',
  END: 'public.end_own_introduction_v1(uuid,uuid)',
});
const HIDDEN = [FN.PRESENT, MFN_MATCH.COMMIT, PFN.APPROVE, PFN.DECLINE_FIRST, PFN.DECLINE_SECOND, PFN.WITHDRAW, PFN.MY_PROPOSAL,
  PFN.MY_FIELDS, 'public.forward_matching_proposal_to_second_core_v1(uuid,uuid,uuid,uuid)', 'public.enter_matching_proposal_decision_v1(uuid,uuid)',
  PFN.PREREQUISITES];
const ANSWERS = ['MATCHED', 'CHANGED', 'UNAVAILABLE', 'NOT_AVAILABLE_NOW', 'COMMAND_CONFLICT'];
const nameOf = (fn) => fn.slice('public.'.length, fn.indexOf('('));
const MIGRATION = (prefix) => new URL(`./migrations/${prefix}`, import.meta.url);

// ------------------------------------------------------------------ the derivation, recomputed independently
const TAG = 'QANDEEL_S6_05_MUTUAL_MATCH_IDENTITY_V1';
const SLOTS = {
  world: 'WORLD', record: 'INTRODUCTION_RECORD', firstEpisode: 'FIRST_RECIPIENT_EPISODE', candidateEpisode: 'CANDIDATE_EPISODE',
  firstClaim: 'FIRST_RECIPIENT_CLAIM', candidateClaim: 'CANDIDATE_CLAIM', firstPause: 'FIRST_RECIPIENT_PAUSE',
  candidatePause: 'CANDIDATE_PAUSE', handoff: 'HANDOFF_PACKAGE_VERSION',
};
function derive(slot, human, proposal, command) {
  const h = createHash('sha256').update([TAG, slot, ...[human, proposal, command].map((v) => v.toLowerCase())].join('\n'), 'utf8').digest('hex');
  const x = `${h.slice(0, 12)}4${h.slice(13, 16)}8${h.slice(17, 20)}${h.slice(20, 32)}`;
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
/** The ten identities one acceptance binds, in the shape the support's effect readers take. */
const derivedIds = (human, proposal, command) => ({
  command, ...Object.fromEntries(Object.entries(SLOTS).map(([key, slot]) => [key, derive(slot, human, proposal, command)])),
});

// ------------------------------------------------------------------ calls, as the real client role
async function asHuman(human, body) {
  await asRole('authenticated', human);
  try { return await body(); } finally { await asRole('postgres'); }
}
async function accept(human, proposal, view, command = randomUUID()) {
  const [answer] = await asHuman(human, () => rows(`SELECT * FROM ${nameOf(FN.ACCEPT)}($1, $2, $3)`, [command, proposal, view]));
  assert.deepEqual(Object.keys(answer), ['outcome', 'introduction_world_id'], 'the acceptance answers exactly { outcome, introduction_world_id }');
  assert.ok(ANSWERS.includes(answer.outcome), `the acceptance answers one fixed word, not ${answer.outcome}`);
  if (answer.outcome !== 'MATCHED') assert.equal(answer.introduction_world_id, null, 'only a Match names a World');
  return { ...answer, command };
}
async function shown(human, proposal) {
  const [one] = await asHuman(human, () => rows(`SELECT * FROM ${nameOf(FN.GET)}($1)`, [proposal]));
  return one ? { outcome: one.neutral_outcome, actions: [...one.available_actions] } : null;
}
async function withdrawAs(human, proposal, view) {
  const [answer] = await asHuman(human, () => rows(`SELECT * FROM ${nameOf(FN.WITHDRAW)}($1, $2, $3)`, [randomUUID(), proposal, view]));
  return answer.outcome;
}

/** Everything an acceptance could write about one proposal and its humans. */
async function footprint(proposal, humans) {
  await asRole('postgres');
  const [p] = await rows(`SELECT proposal_state, current_transition_id FROM ${P.PROPOSALS} WHERE id = $1`, [proposal]);
  return {
    proposal: p ?? null,
    transitions: await count(P.TRANSITIONS, 'proposal_id = $1', [proposal]),
    commits: await count(MATCH.COMMITS, 'lower_user_id = ANY($1::uuid[]) OR higher_user_id = ANY($1::uuid[])', [humans]),
    records: await count(MATCH.RECORDS, 'lower_user_id = ANY($1::uuid[]) OR higher_user_id = ANY($1::uuid[])', [humans]),
    episodes: await count('public.shared_world_membership_episodes', 'user_id = ANY($1::uuid[])', [humans]),
    claims: await count(MATCH.CLAIMS, 'user_id = ANY($1::uuid[])', [humans]),
    pointers: (await rows(`SELECT participant_user_id::text u, current_event_id::text e FROM public.matching_participation_state
                            WHERE participant_user_id = ANY($1::uuid[]) ORDER BY 1`, [humans])).map((r) => `${r.u}:${r.e}`),
    locks: await count('public.matching_setup_locks', 'user_id = ANY($1::uuid[])', [humans]),
    // A rolled-back upsert leaves the row's version unchanged; a committed one, even with the same values, does not.
    lockVersions: (await rows('SELECT user_id::text u, xmin::text x FROM public.matching_setup_locks WHERE user_id = ANY($1::uuid[]) ORDER BY 1', [humans]))
      .map((r) => `${r.u}:${r.x}`),
  };
}
const semantic = async (proposal, humans) => { const { lockVersions, ...rest } = await footprint(proposal, humans); return rest; };

async function facts(pairs) {
  for (const [human, sex, firstName] of pairs) await rt.recordFacts(human, { sex, firstName });
}

/** The CREATE [OR REPLACE] FUNCTION public.<name> body in a migration, between its dollar quotes, CR-free. */
function bodyOf(prefixFile, name) {
  const text = readFileSync(MIGRATION(prefixFile), 'utf8').replace(/\r\n/gu, '\n');
  const start = text.search(new RegExp(String.raw`CREATE (OR REPLACE )?FUNCTION public\.${name}\(`, 'u'));
  assert.ok(start >= 0, `${prefixFile} defines ${name}`);
  const open = text.indexOf('AS $$', start) + 'AS $$'.length;
  return text.slice(open, text.indexOf('$$;', open));
}
const flat = (src) => src.replace(/\r\n/gu, '\n').replace(/--[^\n]*/gu, '').replace(/\s+/gu, ' ').trim();

// ------------------------------------------------------------------ A. posture
async function verifyPosture(report) {
  await report.section('A01 one authenticated-only acceptance and the private helper; postgres-owned, DEFINER, pinned; every core still closed', async () => {
    for (const fn of [FN.ACCEPT, FN.PRESENT]) {
      const p = await rt.functionPosture(fn);
      assert.equal(p.owner, 'postgres', `A01 ${fn} is postgres-owned`);
      assert.equal(p.secdef, true, `A01 ${fn} is SECURITY DEFINER`);
      assert.deepEqual(p.config, ['search_path=""'], `A01 ${fn} pins an empty search_path`);
    }
    assert.equal(await rt.canExecute('authenticated', FN.ACCEPT), true, 'A01 authenticated executes the acceptance');
    for (const role of ['public', 'anon', 'service_role']) assert.equal(await rt.canExecute(role, FN.ACCEPT), false, `A01 ${role} must not accept`);
    for (const fn of HIDDEN) {
      for (const role of ['public', ...APP_ROLES]) assert.equal(await rt.canExecute(role, fn), false, `A01 ${role} must not execute ${fn}`);
    }
    const [{ n }] = await rows(`SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
      WHERE s.nspname = 'public' AND p.proname = $1`, [nameOf(FN.ACCEPT)]);
    assert.equal(n, 1, 'A01 the acceptance has no overload');
  });

  await report.section('A02 the human is auth.uid(); the client supplies a command, a proposal and a view, and nothing else', async () => {
    assert.deepEqual(await rt.inputParameters(FN.ACCEPT), ['p_command_id', 'p_proposal_id', 'p_expected_view_id']);
    assert.deepEqual(await rt.resultColumns(FN.ACCEPT), ['outcome', 'introduction_world_id']);
    const src = (await rt.functionPosture(FN.ACCEPT)).prosrc;
    assert.match(src, /u uuid := auth\.uid\(\);/u, 'A02 the human is derived from auth.uid()');
    assert.doesNotMatch(src.replace(/--[^\n]*/gu, ''),
      /first_name|permitted_text|disclosed_value|private_reason_code|subject_user_id|_fields_v1|first_recipient_user_id|candidate_user_id/iu,
      'A02 the shell reads no name, conclusion, field, reason or counterpart identity');
  });

  await report.section('A03 lock first, then the offered decision, then the frozen core exactly once; 40001 absorbed with PT409 named', async () => {
    const src = (await rt.functionPosture(FN.ACCEPT)).prosrc.replace(/--[^\n]*/gu, '');
    const enter = src.indexOf('public.enter_matching_proposal_decision_v1(p_proposal_id, u)');
    const ask = src.indexOf('public.resolve_my_matching_proposal_presentation_v1(p_proposal_id)');
    const core = src.indexOf('public.commit_matching_mutual_match_v1(');
    assert.ok(enter > 0 && ask > enter && core > ask, 'A03 the lock, then the helper, then the core');
    assert.equal(src.split('public.commit_matching_mutual_match_v1(').length - 1, 1, 'A03 the core is called exactly once');
    assert.doesNotMatch(src, /INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|EXECUTE\s|RAISE;|ISOLATION|_core_v1\(/iu, 'A03 a shell: no write, no dynamic SQL, no re-raise, no other core');
    assert.match(src, /WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN/u, 'A03 absorbs the core\'s 40001 and names PT409 (PROD-RETRY-01)');
    assert.ok(src.includes(`'${TAG}'`), 'A03 the derivation tag is the documented one');
    for (const slot of Object.values(SLOTS)) assert.ok(src.includes(`'${slot}'`), `A03 the ${slot} slot is derived`);
  });

  await report.section('A04 the frozen 0114 core is byte-identical; the helper is the 0158 helper plus exactly the ACCEPT delta', async () => {
    const live = (await rt.functionPosture(MFN_MATCH.COMMIT)).prosrc.replace(/\r\n/gu, '\n');
    assert.equal(live, bodyOf('0114_matching_mutual_match_commit_transaction_v1.sql', nameOf(MFN_MATCH.COMMIT)), 'A04 0114 is untouched');
    const helper0158 = flat(bodyOf('0158_matching_private_proposal_review_decisions_v1.sql', nameOf(FN.PRESENT)));
    const expected = helper0158
      .replace("role_of = 'CANDIDATE' THEN actions := ARRAY['DECLINE'];", "role_of = 'CANDIDATE' THEN actions := ARRAY['ACCEPT', 'DECLINE'];")
      .replace("actions && ARRAY['APPROVE_FORWARD', 'DECLINE']", "actions && ARRAY['APPROVE_FORWARD', 'DECLINE', 'ACCEPT']")
      .replace("array_remove(array_remove(actions, 'APPROVE_FORWARD'), 'DECLINE')",
        "array_remove(array_remove(array_remove(actions, 'APPROVE_FORWARD'), 'DECLINE'), 'ACCEPT')");
    assert.notEqual(expected, helper0158, 'A04 the delta applies to the 0158 helper');
    assert.equal(flat((await rt.functionPosture(FN.PRESENT)).prosrc), expected, 'A04 nothing else in the helper changed');
  });
}

// ------------------------------------------------------------------ B. production stays closed
async function verifyProductionClosed(report, [first, a, , , , fresh], gateSeam) {
  await report.section('B01 with the production seams nothing exists to accept; anonymous and claim-less callers are refused; nothing is written', async () => {
    assert.equal((await rows(`SELECT * FROM ${nameOf(PFN.PREREQUISITES)}($1)`, [randomUUID()]))[0].clearance, 'NOT_EVALUATED',
      'B01 the CW2-08 seam is fail-closed');
    await q('BEGIN');
    try {
      for (const human of [first, a, fresh]) {
        assert.deepEqual((await accept(human, randomUUID(), randomUUID())).outcome, 'UNAVAILABLE', 'B01 nothing to accept');
      }
      assert.equal(await count('public.matching_setup_locks', 'user_id = $1', [fresh]), 0, 'B01 no lock row for a human with no Matching history');
      await asRole('anon');
      await rejected(() => q(`SELECT * FROM ${nameOf(FN.ACCEPT)}(gen_random_uuid(), gen_random_uuid(), gen_random_uuid())`), ['42501'], /permission denied/u);
      await asRole('authenticated');
      await rejected(() => q(`SELECT * FROM ${nameOf(FN.ACCEPT)}(gen_random_uuid(), gen_random_uuid(), gen_random_uuid())`), ['42501'], /MATCHING_AUTHENTICATION_REQUIRED/u);
      await asRole('authenticated', fresh);
      for (const args of ['NULL, gen_random_uuid(), gen_random_uuid()', 'gen_random_uuid(), NULL, gen_random_uuid()', 'gen_random_uuid(), gen_random_uuid(), NULL']) {
        await rejected(() => q(`SELECT * FROM ${nameOf(FN.ACCEPT)}(${args})`), ['22023']);
      }
      await asRole('postgres');
    } finally {
      await q('ROLLBACK');
    }
  });

  await report.section('B02 a real forwarded proposal with the launch seam closed: no ACCEPT shown; accepting is NOT_AVAILABLE_NOW and writes nothing', async () => {
    await q('BEGIN');
    try {
      await rt.clearProposalPrerequisites();
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToForwarded(first, a);
      await rt.restoreMatchingSeam(gateSeam);
      assert.deepEqual(await shown(a, f.proposal), { outcome: 'AWAITING_YOU', actions: [] }, 'B02 nothing consequential is presented');
      const before = await footprint(f.proposal, [first, a]);
      assert.equal((await accept(a, f.proposal, f.secondView)).outcome, 'NOT_AVAILABLE_NOW', 'B02 the core refuses at the CW2-08 gate, last');
      assert.deepEqual(await footprint(f.proposal, [first, a]), before, 'B02 nothing written, not even a lock row version');
      assert.equal(await count('public.shared_worlds', "birth_basis = 'MUTUAL_MATCH'", []), 0, 'B02 no World');
    } finally {
      await q('ROLLBACK');
    }
  });
}

// ------------------------------------------------------------------ C .. F, inside one rolled-back transaction
async function verifyRuntime(report, humans, gateSeam) {
  const [first, a, b, c, outsider, fresh] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('C01 the second recipient awaiting a decision is offered ACCEPT and DECLINE; nobody else is offered ACCEPT', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const offered = await rt.bringToOffered(first, a);
      assert.deepEqual(await shown(first, offered.proposal), { outcome: 'AWAITING_YOU', actions: ['APPROVE_FORWARD', 'DECLINE'] });
      assert.equal(await shown(a, offered.proposal), null, 'C01 nothing for the candidate before forwarding');
      await actAs(first);
      await rt.approveForward(randomUUID(), offered.proposal, offered.firstView);
      await rt.forward(randomUUID(), offered.proposal, randomUUID(), offered.conclusionForCandidate);
      assert.deepEqual(await shown(a, offered.proposal), { outcome: 'AWAITING_YOU', actions: ['ACCEPT', 'DECLINE'] });
      assert.deepEqual(await shown(first, offered.proposal), { outcome: 'IN_PROGRESS', actions: ['WITHDRAW'] }, 'C01 the first recipient is never offered ACCEPT');
      for (const human of [outsider, fresh]) assert.equal(await shown(human, offered.proposal), null);
    });

    await report.isolated('D01 MATCHED: exactly one Match, World, Introduction, two episodes, claims and pauses, one handoff, at one instant, under the derived identities', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToForwarded(first, a);
      const answer = await accept(a, f.proposal, f.secondView);
      const ids = derivedIds(a, f.proposal, answer.command);
      assert.deepEqual([answer.outcome, answer.introduction_world_id], ['MATCHED', ids.world], 'D01 the answer names the World the core bound');
      const commit = await rt.commitRow(answer.command);
      assert.ok(commit, 'D01 the Match commit exists under the command id');
      assert.deepEqual([commit.world_id, commit.introduction_record_id, commit.first_recipient_membership_episode_id, commit.candidate_membership_episode_id,
        commit.first_recipient_claim_id, commit.candidate_claim_id, commit.first_recipient_pause_event_id, commit.candidate_pause_event_id,
        commit.handoff_package_version_id],
      [ids.world, ids.record, ids.firstEpisode, ids.candidateEpisode, ids.firstClaim, ids.candidateClaim, ids.firstPause, ids.candidatePause, ids.handoff],
      'D01 every one of the nine identities is the server derivation');
      assert.deepEqual([commit.candidate_user_id, commit.first_recipient_user_id, commit.candidate_accepted_view_id, commit.first_approved_view_id],
        [a, first, f.secondView, f.firstView], 'D01 the accepting human, their exact view and the bound first approval');
      assert.deepEqual(await rt.matchEffects(ids, f.proposal), {
        commits: 1, matchTransitions: 1, worlds: 1, episodes: 2, records: 1, births: 1, starts: 1,
        claims: 2, pauses: 2, cancellations: 0, packages: 1, subjects: 2,
      }, 'D01 exactly once each');
      const world = await rt.worldRow(ids.world);
      assert.deepEqual([world.lifecycle, world.phase, world.birth_basis, world.closed_at], ['ACTIVE', 'INTRODUCTION', 'MUTUAL_MATCH', null]);
      assert.deepEqual((await rt.episodesOf(ids.world)).map((e) => e.user_id).sort(), [first, a].sort(), 'D01 exactly the matched pair');
      assert.equal((await rt.instantCoherence(ids)).coherent, true, 'D01 one instant');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'MUTUAL_MATCH_COMMITTED');
      for (const human of [a, first]) {
        assert.deepEqual(await shown(human, f.proposal), { outcome: 'MATCH_CONCLUDED', actions: [] }, 'D01 both humans read MATCH_CONCLUDED');
      }
    });

    await report.isolated('D02 nothing private crosses: the answer holds no name or person, no grant is transferred, the World holds no material', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToForwarded(first, a);
      const grantsBefore = await count('public.matching_context_grants', 'grantor_user_id = ANY($1::uuid[])', [[first, a]]);
      const answer = await accept(a, f.proposal, f.secondView);
      assert.equal(answer.outcome, 'MATCHED');
      const text = JSON.stringify(answer);
      for (const forbidden of ['Mona', 'Omar', first, a, f.firstView]) assert.ok(!text.includes(forbidden), `D02 ${forbidden} is not in the answer`);
      assert.equal(await count('public.shared_world_standing_context_grants', 'world_id = $1', [answer.introduction_world_id]), 0,
        'D02 no Matching Context Grant becomes a Shared standing grant');
      assert.equal(await count('public.matching_context_grants', 'grantor_user_id = ANY($1::uuid[])', [[first, a]]), grantsBefore,
        'D02 the Matching Context Grants are neither copied nor moved');
      assert.equal(await count('public.shared_world_history_items', 'world_id = $1', [answer.introduction_world_id]), 0,
        'D02 the World starts with no material: no AI message, no welcome row (R-3), no analysis');
    });

    await report.isolated('D03 the born Introduction is the one S6-02 END ends with the launch seam closed again; the acceptance still replays', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToForwarded(first, a);
      const answer = await accept(a, f.proposal, f.secondView);
      const ids = derivedIds(a, f.proposal, answer.command);
      await rt.restoreMatchingSeam(gateSeam);
      const [ended] = await asHuman(a, () => rows(`SELECT * FROM ${nameOf(FN.END)}($1, $2)`, [randomUUID(), answer.introduction_world_id]));
      assert.equal(ended.outcome, 'ENDED', 'D03 END is independent of the Matching gates (D5)');
      const effects = await rt.matchEffects(ids, f.proposal);
      const again = await accept(a, f.proposal, f.secondView, answer.command);
      assert.deepEqual([again.outcome, again.introduction_world_id], ['MATCHED', answer.introduction_world_id], 'D03 the historical answer, not the live World');
      assert.deepEqual(await rt.matchEffects(ids, f.proposal), effects, 'D03 and nothing new');
    });

    await report.isolated('E01 another human, a guessed proposal and the first recipient are one answer, and write nothing', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToForwarded(first, a);
      const before = await footprint(f.proposal, [first, a, outsider, fresh]);
      for (const human of [outsider, fresh, first]) {
        assert.equal((await accept(human, f.proposal, f.secondView)).outcome, 'UNAVAILABLE', 'E01 not the candidate');
        assert.equal((await accept(human, randomUUID(), f.secondView)).outcome, 'UNAVAILABLE', 'E01 the same as a guessed id');
      }
      assert.deepEqual(await footprint(f.proposal, [first, a, outsider, fresh]), before, 'E01 nothing written, not even a lock row version');
      assert.equal(await count('public.matching_setup_locks', 'user_id = ANY($1::uuid[])', [[outsider, fresh]]), 0);
    });

    await report.isolated('E02 a view that is not the caller\'s current one - superseded, the other human\'s, or invented - is CHANGED and writes nothing', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToForwarded(first, a);
      const newer = randomUUID();
      await rt.materialize(newer, f.proposal, a, f.conclusionForCandidate);
      assert.equal(await rt.currentViewOf(f.proposal, a), newer);
      const before = await footprint(f.proposal, [first, a]);
      for (const view of [f.secondView, f.firstView, randomUUID()]) {
        assert.equal((await accept(a, f.proposal, view)).outcome, 'CHANGED', 'E02 read again');
        assert.deepEqual(await footprint(f.proposal, [first, a]), before, 'E02 nothing written');
      }
      assert.equal((await accept(a, f.proposal, newer)).outcome, 'MATCHED', 'E02 the current view still accepts');
    });

    await report.isolated('E03 past its deadline, after a failed revalidation, a withdrawal or a decline: UNAVAILABLE, the read agrees, nothing written', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali'], [c, 'MALE', 'Yusuf']]);
      const late = await rt.bringToForwarded(first, a);
      await rt.backdate(late.proposal);
      const paused = await rt.bringToForwarded(first, b);
      await actAs(first);
      await rt.pause(randomUUID(), paused.byUser[first].event);
      await asRole('postgres');
      for (const [human, f] of [[a, late], [b, paused]]) {
        assert.deepEqual(await shown(human, f.proposal), { outcome: 'NO_LONGER_AVAILABLE', actions: [] }, 'E03 the read offers nothing');
        const before = await footprint(f.proposal, [first, human]);
        assert.equal((await accept(human, f.proposal, f.secondView)).outcome, 'UNAVAILABLE');
        assert.deepEqual(await footprint(f.proposal, [first, human]), before, 'E03 nothing written');
      }
    });

    await report.isolated('E04 a withdrawn or a declined proposal is UNAVAILABLE, and the candidate cannot tell which', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali']]);
      const withdrawn = await rt.bringToForwarded(first, a);
      assert.equal(await withdrawAs(first, withdrawn.proposal, withdrawn.firstView), 'RECORDED');
      const declined = await rt.bringToForwarded(first, b);
      const [d] = await asHuman(b, () => rows(`SELECT * FROM ${nameOf(FN.DECLINE)}($1, $2, $3)`, [randomUUID(), declined.proposal, declined.secondView]));
      assert.equal(d.outcome, 'RECORDED');
      const answers = [];
      for (const [human, f] of [[a, withdrawn], [b, declined]]) {
        const before = await footprint(f.proposal, [first, human]);
        answers.push((await accept(human, f.proposal, f.secondView)).outcome);
        assert.deepEqual(await footprint(f.proposal, [first, human]), before, 'E04 nothing written');
      }
      assert.deepEqual(answers, ['UNAVAILABLE', 'UNAVAILABLE']);
    });

    await report.isolated('E05 a first approval whose bound view is no longer current is not carried forward: UNAVAILABLE, nothing written', async () => {
      // No production path supersedes the first recipient's view after forwarding (only offer and forward materialize a
      // view, 0120); a direct core call does, and the frozen core refuses it as NOT_COMMITTABLE, answered without a reason.
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToForwarded(first, a);
      await rt.materialize(randomUUID(), f.proposal, first, f.conclusionForFirst);
      const before = await footprint(f.proposal, [first, a]);
      assert.equal((await accept(a, f.proposal, f.secondView)).outcome, 'UNAVAILABLE');
      assert.deepEqual(await footprint(f.proposal, [first, a]), before, 'E05 nothing written');
    });

    await report.isolated('E06 a reused command id is COMMAND_CONFLICT and writes nothing', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali']]);
      const f = await rt.bringToForwarded(first, a);
      const other = await rt.bringToForwarded(first, b);
      let before = await footprint(f.proposal, [first, a]);
      assert.equal((await accept(a, f.proposal, f.secondView, f.approval)).outcome, 'COMMAND_CONFLICT', 'E06 an id this proposal used for another act');
      assert.equal((await accept(a, f.proposal, f.secondView, other.approval)).outcome, 'COMMAND_CONFLICT',
        'E06 an id another proposal already used: the caller\'s conflict, not a colliding identity');
      assert.deepEqual(await footprint(f.proposal, [first, a]), before, 'E06 nothing written');
      assert.deepEqual(await shown(a, f.proposal), { outcome: 'AWAITING_YOU', actions: ['ACCEPT', 'DECLINE'] }, 'E06 and a fresh command still may accept');
      const answer = await accept(a, f.proposal, f.secondView);
      assert.equal(answer.outcome, 'MATCHED');
      before = await footprint(f.proposal, [first, a]);
      const newer = randomUUID();
      assert.equal((await accept(a, f.proposal, newer, answer.command)).outcome, 'COMMAND_CONFLICT', 'E06 the Match id with another view');
      assert.deepEqual(await footprint(f.proposal, [first, a]), before, 'E06 nothing written, not even a lock row version');
    });

    await report.isolated('E07 an identity collision in the core\'s write region rolls the whole Match back: no ghost World, claim, pause or handoff', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToForwarded(first, a);
      const command = randomUUID();
      const ids = derivedIds(a, f.proposal, command);
      // The derived World identity is already taken (only the owner can do this): the late failure is in the write region.
      await q(`INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis) VALUES ($1, 'ACTIVE', 'INTRODUCTION', 'MUTUAL_MATCH')`, [ids.world]);
      const before = await footprint(f.proposal, [first, a]);
      assert.equal((await accept(a, f.proposal, f.secondView, command)).outcome, 'UNAVAILABLE', 'E07 the collision names nothing');
      assert.deepEqual(await footprint(f.proposal, [first, a]), before, 'E07 nothing written');
      const effects = await rt.matchEffects(ids, f.proposal);
      assert.deepEqual({ ...effects, worlds: 0 }, {
        commits: 0, matchTransitions: 0, worlds: 0, episodes: 0, records: 0, births: 0, starts: 0,
        claims: 0, pauses: 0, cancellations: 0, packages: 0, subjects: 0,
      }, 'E07 no partial Match');
      assert.equal(effects.worlds, 1, 'E07 only the pre-existing World is there');
      assert.equal((await accept(a, f.proposal, f.secondView)).outcome, 'MATCHED', 'E07 a new command accepts');
    });

    await report.isolated('F01 a replay answers the original World and writes nothing', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToForwarded(first, a);
      const one = await accept(a, f.proposal, f.secondView);
      const after = await semantic(f.proposal, [first, a]);
      const again = await accept(a, f.proposal, f.secondView, one.command);
      assert.deepEqual([again.outcome, again.introduction_world_id], [one.outcome, one.introduction_world_id], 'F01 the same answer');
      // A replay passes the frozen pair lock, whose upsert is a no-op version bump, so it is compared without row versions.
      assert.deepEqual(await semantic(f.proposal, [first, a]), after, 'F01 and nothing new');
      assert.equal(await count(MATCH.COMMITS, 'proposal_id = $1', [f.proposal]), 1);
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ G. races on two real connections
/** One race: the primary runs `mine` inside an open transaction, the extra connection runs `theirs` and must wait. */
async function race(label, { mine, theirsAs, theirs }) {
  const extra = await rt.openExtra();
  try {
    await q('BEGIN');
    const first = await mine();
    await extra.qx('BEGIN');
    await extra.qx('SET LOCAL ROLE authenticated');
    await extra.qx("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: theirsAs, role: 'authenticated' })]);
    const pending = extra.qx(theirs.sql, theirs.values);
    assert.equal(await rt.waitForLockWait((t, v) => q(t, v), extra.pid), true, `${label}: the second attempt waits on the pair lock`);
    await q('COMMIT');
    const [late] = (await pending).rows;
    await extra.qx('COMMIT');
    return { first, late };
  } finally {
    await q('ROLLBACK').catch(() => undefined);
    await extra.close();
  }
}
const acceptSql = (command, proposal, view) => ({ sql: `SELECT * FROM ${nameOf(FN.ACCEPT)}($1, $2, $3)`, values: [command, proposal, view] });
const withdrawSql = (proposal, view) => ({ sql: `SELECT * FROM ${nameOf(FN.WITHDRAW)}($1, $2, $3)`, values: [randomUUID(), proposal, view] });
async function worldsOf(humans) {
  await asRole('postgres');
  return Number((await rows(`SELECT count(DISTINCT e.world_id) n FROM public.shared_world_membership_episodes e
    JOIN public.shared_worlds w ON w.id = e.world_id WHERE w.birth_basis = 'MUTUAL_MATCH' AND e.user_id = ANY($1::uuid[])`, [humans]))[0].n);
}

async function verifyRaces(report, rh) {
  await report.section('G01 the same command twice at once: both answer the one Match, and there is one World', async () => {
    const [first, a] = rh.g1;
    await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
    const f = await rt.bringToForwarded(first, a);
    const command = randomUUID();
    const { first: mine, late } = await race('G01', {
      mine: () => asHuman(a, () => rows(acceptSql(command, f.proposal, f.secondView).sql, acceptSql(command, f.proposal, f.secondView).values)),
      theirsAs: a, theirs: acceptSql(command, f.proposal, f.secondView),
    });
    assert.deepEqual([mine[0].outcome, late.outcome], ['MATCHED', 'MATCHED']);
    assert.equal(late.introduction_world_id, mine[0].introduction_world_id, 'G01 the same World');
    assert.equal(await worldsOf([first, a]), 1);
  });

  await report.section('G02 two commands of one human at once: exactly one Match; the other accepts nothing', async () => {
    const [first, a] = rh.g2;
    await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
    const f = await rt.bringToForwarded(first, a);
    const { first: mine, late } = await race('G02', {
      mine: () => asHuman(a, () => rows(acceptSql(randomUUID(), f.proposal, f.secondView).sql, acceptSql(randomUUID(), f.proposal, f.secondView).values)),
      theirsAs: a, theirs: acceptSql(randomUUID(), f.proposal, f.secondView),
    });
    assert.deepEqual([mine[0].outcome, late.outcome], ['MATCHED', 'UNAVAILABLE']);
    assert.equal(await count(MATCH.COMMITS, 'proposal_id = $1', [f.proposal]), 1);
    assert.equal(await worldsOf([first, a]), 1);
  });

  await report.section('G03 acceptance first, the first party\'s withdrawal waiting: one Match, and nothing to withdraw', async () => {
    const [first, a] = rh.g3;
    await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
    const f = await rt.bringToForwarded(first, a);
    const { first: mine, late } = await race('G03', {
      mine: () => asHuman(a, () => rows(acceptSql(randomUUID(), f.proposal, f.secondView).sql, acceptSql(randomUUID(), f.proposal, f.secondView).values)),
      theirsAs: first, theirs: withdrawSql(f.proposal, f.firstView),
    });
    assert.deepEqual([mine[0].outcome, late.outcome], ['MATCHED', 'UNAVAILABLE']);
    assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'MUTUAL_MATCH_COMMITTED');
    assert.equal(await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'WITHDRAWN'", [f.proposal]), 0);
  });

  await report.section('G04 the withdrawal first, the acceptance waiting: no Match, no World, and the acceptance decides nothing', async () => {
    const [first, a] = rh.g4;
    await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
    const f = await rt.bringToForwarded(first, a);
    const { first: mine, late } = await race('G04', {
      mine: () => asHuman(first, () => rows(withdrawSql(f.proposal, f.firstView).sql, withdrawSql(f.proposal, f.firstView).values)),
      theirsAs: a, theirs: acceptSql(randomUUID(), f.proposal, f.secondView),
    });
    assert.deepEqual([mine[0].outcome, late.outcome], ['RECORDED', 'UNAVAILABLE']);
    assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'WITHDRAWN');
    assert.equal(await count(MATCH.COMMITS, 'proposal_id = $1', [f.proposal]), 0);
    assert.equal(await worldsOf([first, a]), 0);
  });

  // The deadline is decided twice against the database clock after the lock: by the helper the shell asks (which is what
  // refuses here) and by the frozen core at its birth instant (proven by verify-migration-0114.mjs, not reachable
  // separately from here, since no instant can pass between the two inside one statement).
  await report.section('G05 an acceptance that waited on the pair lock past the deadline commits nothing (decided under the lock)', async () => {
    const [first, a] = rh.g5;
    await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
    const f = await rt.bringToForwarded(first, a);
    const deadline = await rt.deadlineIn(f.proposal, '1500 milliseconds');
    const extra = await rt.openExtra();
    let late;
    try {
      await q('BEGIN');
      await q('SELECT 1 FROM public.matching_setup_locks WHERE user_id = ANY($1::uuid[]) FOR UPDATE', [[first, a]]);
      await extra.qx('BEGIN');
      await extra.qx('SET LOCAL ROLE authenticated');
      await extra.qx("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: a, role: 'authenticated' })]);
      const { sql, values } = acceptSql(randomUUID(), f.proposal, f.secondView);
      const pending = extra.qx(sql, values);
      assert.equal(await rt.waitForLockWait((t, v) => q(t, v), extra.pid), true, 'G05 the acceptance waits on the pair lock');
      assert.equal(await rt.waitForInstant(deadline), true, 'G05 the database clock passes the deadline while it waits');
      await q('COMMIT');
      [late] = (await pending).rows;
      await extra.qx('COMMIT');
    } finally {
      await q('ROLLBACK').catch(() => undefined);
      await extra.close();
    }
    assert.equal(late.outcome, 'UNAVAILABLE', 'G05 decided against the real clock, after the lock');
    assert.equal(await count(MATCH.COMMITS, 'proposal_id = $1', [f.proposal]), 0);
    assert.equal(await worldsOf([first, a]), 0);
  });

  await report.section('G06 two candidates of one first recipient accept at once: one Match; the other proposal is cancelled and its acceptance decides nothing', async () => {
    const [first, b, c] = rh.g6;
    await facts([[first, 'FEMALE', 'Mona'], [b, 'MALE', 'Ali'], [c, 'MALE', 'Yusuf']]);
    const won = await rt.bringToForwarded(first, b);
    const lost = await rt.bringToForwarded(first, c);
    const { first: mine, late } = await race('G06', {
      mine: () => asHuman(b, () => rows(acceptSql(randomUUID(), won.proposal, won.secondView).sql, acceptSql(randomUUID(), won.proposal, won.secondView).values)),
      theirsAs: c, theirs: acceptSql(randomUUID(), lost.proposal, lost.secondView),
    });
    assert.deepEqual([mine[0].outcome, late.outcome], ['MATCHED', 'UNAVAILABLE']);
    assert.equal((await rt.proposalRow(lost.proposal)).proposal_state, 'CANCELLED_BY_COMPETING_MATCH');
    assert.equal(await count(MATCH.COMMITS, 'proposal_id = $1', [lost.proposal]), 0);
    assert.equal(await worldsOf([first, b, c]), 1, 'G06 exactly one World for the shared human');
    assert.deepEqual(await shown(c, lost.proposal), { outcome: 'NO_LONGER_AVAILABLE', actions: [] });
  });
}

// ------------------------------------------------------------------ the run
const humans = Array.from({ length: 6 }, () => randomUUID());
const rh = {
  g1: [randomUUID(), randomUUID()], g2: [randomUUID(), randomUUID()], g3: [randomUUID(), randomUUID()],
  g4: [randomUUID(), randomUUID()], g5: [randomUUID(), randomUUID()], g6: [randomUUID(), randomUUID(), randomUUID()],
};
const raceHumans = Object.values(rh).flat();

await runVerifier('0159', async (setStage) => {
  await rt.client.connect();
  setStage('fixtures');
  await rt.provisionHumans([...humans, ...raceHumans]);
  const report = createScenarioReport('0159', { query: q, restore: () => asRole('postgres') });

  setStage('posture');
  await verifyPosture(report);
  const gateSeam = await rt.captureMatchingSeam(PFN.PREREQUISITES);
  setStage('production closed');
  await verifyProductionClosed(report, humans, gateSeam);

  try {
    // The CW2-08 seam answers NOT_EVALUATED in production; it is cleared for these scenarios and restored byte for byte
    // below. The first-name seam is NOT replaced: every proposal runs on the real resolver over confirmed facts.
    await rt.clearProposalPrerequisites();
    setStage('runtime');
    await verifyRuntime(report, humans, gateSeam);
    setStage('races');
    await verifyRaces(report, rh);
  } finally {
    await asRole('postgres');
    await rt.restoreMatchingSeam(gateSeam);
  }
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  await asRole('postgres');
  assert.equal((await rows(`SELECT * FROM ${nameOf(PFN.PREREQUISITES)}($1)`, [randomUUID()]))[0].clearance,
    'NOT_EVALUATED', 'the CW2-08 seam is fail-closed again after the run');
  await rt.cleanupRace(raceHumans);
  await rt.removeCommittedProposalState(humans);
  await rt.removeCommittedMatchingSetup(humans);
  await rt.removeFixtureHumans([...humans, ...raceHumans]);
  for (const table of [P.PROPOSALS, P.POLICY_STATE, P.FACT_VERSIONS, MATCH.COMMITS]) {
    assert.equal(await count(table, 'true', []), 0, `${table} is empty again: every fixture this verifier committed was removed`);
  }
  assert.equal(await count('public.shared_worlds', "birth_basis = 'MUTUAL_MATCH'", []), 0, 'no Mutual Match World survives the run');
}, () => rt.client.end().catch(() => undefined));
