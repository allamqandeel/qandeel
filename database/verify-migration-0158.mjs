// S6-04 / migration 0158 - real-PostgreSQL proof of the private proposal review and decision boundaries.
//
//   A  posture: five authenticated-only boundaries, one private helper, every I-07 core still executable by nobody; the
//      human is auth.uid() and no boundary takes an actor, recipient or role; no body reads a name, conclusion or field
//   B  production stays closed: the CW2-08 seam answers NOT_EVALUATED, no proposal exists, a signed-in human lists
//      nothing, every decision answers UNAVAILABLE and nothing is written - not even a lock row
//   C  the listing: own delivered views only, the second recipient sees nothing before forward approval, bounded pages
//      with a non-oracle cursor, no first name, conclusion, field, role, state or date
//   D  the decisions: forward approval, first and second decline, withdrawal, each over its existing core, each offered
//      only when the server says so; the second recipient is never offered acceptance
//   E  neutrality: every ending the other human caused reads the same; the second recipient keeps a neutral view after a
//      withdrawal
//   F  refusals change nothing: another human, a stale view, an expired proposal, a proposal that failed revalidation,
//      a closed launch seam, a reused command id; withdrawal is never blocked by the launch seam
//   G  idempotency: a replay answers from the committed row and writes nothing
//   H  no Mutual Match, no World and no Introduction can come from any S6-04 boundary
//   I  races, on two real connections: two decisions of one human; a withdrawal against the second decline
//
// Positive paths run on SYNTHETIC fixture humans inside transactions that roll back, with the CW2-08 seam replaced for
// the run and restored byte for byte; the two races commit their fixtures and remove them. Nothing permissive survives.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { createMatchRuntime, P, PFN, MATCH, matchIds, runVerifier, APP_ROLES } from './matching-match-verifier-support.mjs';

const rt = createMatchRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const FN = Object.freeze({
  PRESENT: 'public.resolve_my_matching_proposal_presentation_v1(uuid)',
  LIST: 'public.list_my_matching_proposals_v1(uuid,integer)',
  GET: 'public.get_my_matching_proposal_v1(uuid)',
  APPROVE: 'public.approve_my_matching_proposal_forward_v1(uuid,uuid,uuid)',
  DECLINE: 'public.decline_my_matching_proposal_v1(uuid,uuid,uuid)',
  WITHDRAW: 'public.withdraw_my_matching_proposal_v1(uuid,uuid,uuid)',
});
const EXPOSED = [FN.LIST, FN.GET, FN.APPROVE, FN.DECLINE, FN.WITHDRAW];
const DECISIONS = [FN.APPROVE, FN.DECLINE, FN.WITHDRAW];
const CORES = [PFN.APPROVE, PFN.DECLINE_FIRST, PFN.DECLINE_SECOND, PFN.WITHDRAW, PFN.MY_PROPOSAL, PFN.MY_FIELDS];
const ROW_COLUMNS = ['recipient_view_id', 'matching_proposal_id', 'neutral_outcome', 'available_actions'];
const ANSWERS = ['RECORDED', 'CHANGED', 'UNAVAILABLE', 'NOT_AVAILABLE_NOW', 'COMMAND_CONFLICT'];
const nameOf = (fn) => fn.slice('public.'.length, fn.indexOf('('));

// ------------------------------------------------------------------ calls, as the real client role
/** Runs `body` as `authenticated` with exactly this human's claims, and returns to the owner afterwards. */
async function asHuman(human, body) {
  await asRole('authenticated', human);
  try { return await body(); } finally { await asRole('postgres'); }
}
const list = (human, after = null, limit = 20) =>
  asHuman(human, () => rows(`SELECT * FROM ${nameOf(FN.LIST)}($1, $2)`, [after, limit]));
const get = (human, proposal) => asHuman(human, () => rows(`SELECT * FROM ${nameOf(FN.GET)}($1)`, [proposal]));
async function decide(fn, human, proposal, view, command = randomUUID()) {
  const [answer] = await asHuman(human, () => rows(`SELECT * FROM ${nameOf(fn)}($1, $2, $3)`, [command, proposal, view]));
  assert.ok(ANSWERS.includes(answer.outcome), `${nameOf(fn)} answers one fixed word, not ${answer.outcome}`);
  return { ...answer, command };
}
const approve = (...a) => decide(FN.APPROVE, ...a);
const decline = (...a) => decide(FN.DECLINE, ...a);
const withdraw = (...a) => decide(FN.WITHDRAW, ...a);

/** What one human is shown about one proposal, as the listing and the single read present it (they must agree). */
async function shown(human, proposal) {
  const one = await get(human, proposal);
  const all = (await list(human)).filter((r) => r.matching_proposal_id === proposal);
  assert.deepEqual(one, all, 'the single read and the listing present the same row');
  return one.length === 0 ? null : { outcome: one[0].neutral_outcome, actions: [...one[0].available_actions], view: one[0].recipient_view_id };
}

/** Everything a decision could write about one proposal and its two humans. */
async function footprint(proposal, humans = []) {
  await asRole('postgres');
  const [p] = await rows(`SELECT proposal_state, current_transition_id FROM ${P.PROPOSALS} WHERE id = $1`, [proposal]);
  return {
    proposal: p ?? null,
    transitions: await count(P.TRANSITIONS, 'proposal_id = $1', [proposal]),
    decisionBindings: await count(P.DECISION_BINDINGS, 'proposal_id = $1', [proposal]),
    approvalBindings: await count(MATCH.BINDINGS, 'proposal_id = $1', [proposal]),
    views: await count(P.VIEWS, 'proposal_id = $1', [proposal]),
    locks: await count('public.matching_setup_locks', 'user_id = ANY($1::uuid[])', [humans]),
  };
}

/** One confirmed first name and sex per fixture human, so the real resolver and the pair rule admit the proposal. */
async function facts(pairs) {
  for (const [human, sex, firstName] of pairs) await rt.recordFacts(human, { sex, firstName });
}

// ------------------------------------------------------------------ A. posture
async function verifyPosture(report) {
  await report.section('A01 five authenticated-only boundaries and one private helper; postgres-owned, DEFINER, pinned', async () => {
    for (const fn of [...EXPOSED, FN.PRESENT]) {
      const p = await rt.functionPosture(fn);
      assert.equal(p.owner, 'postgres', `A01 ${fn} is postgres-owned`);
      assert.equal(p.secdef, true, `A01 ${fn} is SECURITY DEFINER`);
      assert.deepEqual(p.config, ['search_path=""'], `A01 ${fn} pins an empty search_path`);
    }
    for (const fn of EXPOSED) {
      assert.equal(await rt.canExecute('authenticated', fn), true, `A01 authenticated executes ${fn}`);
      for (const role of ['public', 'anon', 'service_role']) assert.equal(await rt.canExecute(role, fn), false, `A01 ${role} must not execute ${fn}`);
    }
    for (const fn of [FN.PRESENT, ...CORES]) {
      for (const role of ['public', ...APP_ROLES]) assert.equal(await rt.canExecute(role, fn), false, `A01 ${role} must not execute ${fn}`);
    }
    const overloads = await rows(`SELECT p.proname, count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = ANY($1::text[]) GROUP BY 1`, [[...EXPOSED, FN.PRESENT].map(nameOf)]);
    assert.equal(overloads.length, 6, 'A01 all six exist');
    for (const o of overloads) assert.equal(o.n, 1, `A01 ${o.proname} has no overload`);
  });

  await report.section('A02 the human is auth.uid(); no boundary takes an actor, recipient, role or state', async () => {
    assert.deepEqual(await rt.inputParameters(FN.LIST), ['p_after_proposal_id', 'p_limit']);
    assert.deepEqual(await rt.inputParameters(FN.GET), ['p_proposal_id']);
    assert.deepEqual(await rt.inputParameters(FN.PRESENT), ['p_proposal_id']);
    for (const fn of DECISIONS) assert.deepEqual(await rt.inputParameters(fn), ['p_command_id', 'p_proposal_id', 'p_expected_view_id'], `A02 ${fn}`);
    for (const fn of [...EXPOSED, FN.PRESENT]) {
      assert.match((await rt.functionPosture(fn)).prosrc, /u uuid := auth\.uid\(\);/u, `A02 ${fn} derives its human from auth.uid()`);
    }
    for (const fn of [FN.LIST, FN.GET]) assert.deepEqual(await rt.resultColumns(fn), ROW_COLUMNS, `A02 ${fn} returns exactly the four neutral columns`);
    for (const fn of DECISIONS) assert.deepEqual(await rt.resultColumns(fn), ['outcome', 'neutral_outcome'], `A02 ${fn}`);
  });

  await report.section('A03 no S6-04 body reads a name, conclusion, field or reason, or reaches a Match, World or acceptance', async () => {
    for (const fn of [...EXPOSED, FN.PRESENT]) {
      const src = (await rt.functionPosture(fn)).prosrc;
      assert.doesNotMatch(src, /first_name|permitted_text|disclosed_value|private_reason_code|subject_user_id|_fields_v1/iu, `A03 ${fn}`);
      assert.doesNotMatch(src, /commit_matching_mutual_match|shared_worlds|introduction_records|accept/iu, `A03 ${fn} accepts nothing and births nothing`);
    }
  });

  await report.section('A04 each decision enters through the lock, asks the one presentation helper, then calls exactly its core', async () => {
    const order = { [FN.APPROVE]: [PFN.APPROVE], [FN.DECLINE]: [PFN.DECLINE_SECOND, PFN.DECLINE_FIRST], [FN.WITHDRAW]: [PFN.WITHDRAW] };
    for (const [fn, cores] of Object.entries(order)) {
      const src = (await rt.functionPosture(fn)).prosrc.replace(/--[^\n]*/gu, '');
      const enter = src.indexOf('enter_matching_proposal_decision_v1(');
      const helper = src.indexOf(`${nameOf(FN.PRESENT)}(`);
      assert.ok(enter > 0 && helper > enter, `A04 ${fn} takes the lock before it asks what is offered`);
      for (const core of cores) assert.ok(src.indexOf(`${nameOf(core)}(`) > helper, `A04 ${fn} calls ${core} last`);
      const named = [PFN.APPROVE, PFN.DECLINE_FIRST, PFN.DECLINE_SECOND, PFN.WITHDRAW].filter((c) => src.includes(`${nameOf(c)}(`));
      assert.deepEqual(named.sort(), [...cores].sort(), `A04 ${fn} names no other core`);
      assert.match(src, /WHEN SQLSTATE '40001' OR SQLSTATE 'PT409'/u, `A04 ${fn} absorbs the cores' 40001 and names PT409 (no CATCH_TRAP)`);
    }
    const withdrawal = (await rt.functionPosture(FN.WITHDRAW)).prosrc;
    assert.doesNotMatch(withdrawal, /prerequisite|CLEARED|NOT_AVAILABLE_NOW/u, 'A04 withdrawal names no launch seam (D7)');
    assert.doesNotMatch(withdrawal, /p_expected_state/u, 'A04 the client never supplies the expected state');
  });
}

// ------------------------------------------------------------------ B. production stays closed
async function verifyProductionClosed(report, [first, candidate, , , , fresh]) {
  await report.section('B01 with the production seams nothing exists, nothing is listed, every decision is UNAVAILABLE, nothing is written', async () => {
    assert.equal((await rows(`SELECT * FROM ${PFN.PREREQUISITES.split('(')[0]}($1)`, [randomUUID()]))[0].clearance, 'NOT_EVALUATED',
      'B01 the CW2-08 seam is fail-closed');
    assert.equal(await count(P.PROPOSALS, 'true', []), 0, 'B01 no proposal exists');
    await q('BEGIN');
    try {
      for (const human of [first, candidate, fresh]) {
        assert.deepEqual(await list(human), [], 'B01 nothing to list');
        assert.deepEqual(await get(human, randomUUID()), [], 'B01 nothing to read');
        for (const fn of DECISIONS) {
          const answer = await decide(fn, human, randomUUID(), randomUUID());
          assert.deepEqual([answer.outcome, answer.neutral_outcome], ['UNAVAILABLE', null], `B01 ${fn}`);
        }
      }
      assert.equal(await count('public.matching_setup_locks', 'user_id = $1', [fresh]), 0, 'B01 no lock row for a human with no Matching history');
      // Anonymous and claim-less callers are refused before anything is read.
      for (const fn of EXPOSED) {
        const args = fn === FN.LIST ? 'NULL, 20' : fn === FN.GET ? 'gen_random_uuid()' : 'gen_random_uuid(), gen_random_uuid(), gen_random_uuid()';
        await asRole('anon');
        await rejected(() => q(`SELECT * FROM ${nameOf(fn)}(${args})`), ['42501'], /permission denied/u);
        await asRole('authenticated');
        await rejected(() => q(`SELECT * FROM ${nameOf(fn)}(${args})`), ['42501'], /MATCHING_AUTHENTICATION_REQUIRED/u);
        await asRole('postgres');
      }
      await asRole('authenticated', fresh);
      await rejected(() => q(`SELECT * FROM ${nameOf(FN.LIST)}(NULL, 0)`), ['22023']);
      await rejected(() => q(`SELECT * FROM ${nameOf(FN.LIST)}(NULL, 21)`), ['22023']);
      await rejected(() => q(`SELECT * FROM ${nameOf(FN.APPROVE)}(NULL, gen_random_uuid(), gen_random_uuid())`), ['22023']);
      await asRole('postgres');
      assert.equal(await count('public.matching_setup_locks', 'user_id = $1', [fresh]), 0, 'B01 still no lock row');
    } finally {
      await q('ROLLBACK');
    }
  });
}

// ------------------------------------------------------------------ C .. H, inside one rolled-back transaction
async function verifyRuntime(report, humans, gateSeam) {
  const [first, a, b, c, outsider, fresh] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('C01 own delivered views only: the second recipient holds nothing before forward approval', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToOffered(first, a);
      assert.deepEqual(await shown(first, f.proposal), { outcome: 'AWAITING_YOU', actions: ['APPROVE_FORWARD', 'DECLINE'], view: f.firstView });
      // The candidate, an outsider and a fresh human: the same empty answer as a proposal that never existed.
      for (const human of [a, outsider, fresh]) {
        assert.deepEqual(await list(human), [], 'C01 nothing listed');
        assert.deepEqual(await get(human, f.proposal), [], 'C01 the real proposal reads exactly as a nonexistent one');
        assert.deepEqual(await get(human, randomUUID()), []);
      }
      const answer = await approve(first, f.proposal, f.firstView);
      assert.deepEqual([answer.outcome, answer.neutral_outcome], ['RECORDED', 'IN_PROGRESS'], 'C01 forward approval');
      assert.deepEqual(await shown(first, f.proposal), { outcome: 'IN_PROGRESS', actions: ['WITHDRAW'], view: f.firstView });
      assert.equal(await shown(a, f.proposal), null, 'C01 approval alone delivers nothing to the candidate');
      const secondView = randomUUID();
      await rt.forward(randomUUID(), f.proposal, secondView, f.conclusionForCandidate);
      assert.deepEqual(await shown(a, f.proposal), { outcome: 'AWAITING_YOU', actions: ['DECLINE'], view: secondView },
        'C01 the second recipient may decline and is never offered acceptance (S6-05)');
      assert.deepEqual(await shown(first, f.proposal), { outcome: 'IN_PROGRESS', actions: ['WITHDRAW'], view: f.firstView });
    });

    await report.isolated('C02 no first name, conclusion, field, role, state, date or counterparty reaches a reader', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToForwarded(first, a);
      const views = await rows(`SELECT id, subject_first_name, subject_user_id FROM ${P.VIEWS} WHERE proposal_id = $1`, [f.proposal]);
      assert.equal(views.length, 2, 'C02 both views bind a first name internally');
      for (const human of [first, a]) {
        for (const row of [...await list(human), ...await get(human, f.proposal)]) {
          assert.deepEqual(Object.keys(row).sort(), [...ROW_COLUMNS].sort(), 'C02 exactly the four columns');
          const text = JSON.stringify(row);
          assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}/u, 'C02 no date or time');
          for (const forbidden of ['Mona', 'Omar', first, a, 'FIRST_RECIPIENT', 'CANDIDATE', 'FORWARDED_TO_SECOND', 'FIRST_FORWARD_APPROVED']) {
            assert.ok(!text.includes(forbidden), `C02 ${forbidden} never appears in what ${human === first ? 'the first' : 'the second'} recipient reads`);
          }
          for (const v of views) assert.ok(!text.includes(v.subject_first_name));
        }
      }
    });

    await report.isolated('C03 bounded pages, newest delivery first; a cursor that is not the caller\'s own ends the list', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali'], [c, 'MALE', 'Yusuf']]);
      const ids = [];
      for (const candidate of [a, b, c]) ids.push((await rt.bringToOffered(first, candidate)).proposal);
      const expected = (await rows(`SELECT v.proposal_id FROM ${P.VIEWS} v WHERE v.recipient_user_id = $1
          GROUP BY v.proposal_id ORDER BY min(v.materialized_at) DESC, v.proposal_id DESC`, [first])).map((r) => r.proposal_id);
      assert.deepEqual([...expected].sort(), [...ids].sort());
      const page1 = await list(first, null, 2);
      assert.deepEqual(page1.map((r) => r.matching_proposal_id), expected.slice(0, 2), 'C03 the first page');
      const page2 = await list(first, page1[1].matching_proposal_id, 2);
      assert.deepEqual(page2.map((r) => r.matching_proposal_id), expected.slice(2), 'C03 the second page');
      assert.deepEqual(await list(first, expected[2], 2), [], 'C03 past the end');
      assert.deepEqual(await list(first, randomUUID(), 20), [], 'C03 an unknown cursor is the end of the list');
      assert.deepEqual(await list(outsider, ids[0], 20), [], 'C03 another human\'s proposal is the end of the list too');
      assert.deepEqual(await list(a, ids[0], 20), [], 'C03 and so is one the candidate holds no view of');
    });

    await report.isolated('D01 forward approval binds the exact view and creates no Match, World or Introduction', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToOffered(first, a);
      const answer = await approve(first, f.proposal, f.firstView);
      assert.equal(answer.outcome, 'RECORDED');
      const [binding] = await rows(`SELECT * FROM ${MATCH.BINDINGS} WHERE approval_transition_id = $1`, [answer.command]);
      assert.equal(binding.approved_view_id, f.firstView, 'D01 the approval binds the exact view the human saw');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'FIRST_FORWARD_APPROVED');
      assert.equal(await count(MATCH.COMMITS, 'lower_user_id = ANY($1::uuid[]) OR higher_user_id = ANY($1::uuid[])', [[first, a]]), 0);
      assert.equal(await count(MATCH.RECORDS, 'lower_user_id = ANY($1::uuid[]) OR higher_user_id = ANY($1::uuid[])', [[first, a]]), 0);
      assert.equal(await count('public.shared_worlds', "birth_basis = 'MUTUAL_MATCH'", []), 0, 'D01 no World is born');
    });

    await report.isolated('D02 the first decline is terminal and private; the candidate never learns of it', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToOffered(first, a);
      const answer = await decline(first, f.proposal, f.firstView);
      assert.deepEqual([answer.outcome, answer.neutral_outcome], ['RECORDED', 'CLOSED_BY_YOU']);
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'FIRST_DECLINED', 'D02 the first-recipient core decided it');
      assert.deepEqual(await shown(first, f.proposal), { outcome: 'CLOSED_BY_YOU', actions: [], view: f.firstView });
      assert.equal(await shown(a, f.proposal), null, 'D02 the candidate holds nothing at all');
    });

    await report.isolated('D03 the second decline goes to the second-recipient core; the first recipient reads NO_LONGER_AVAILABLE', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToForwarded(first, a);
      const answer = await decline(a, f.proposal, f.secondView);
      assert.deepEqual([answer.outcome, answer.neutral_outcome], ['RECORDED', 'CLOSED_BY_YOU']);
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'SECOND_DECLINED', 'D03 the role was chosen on the server');
      assert.deepEqual(await shown(a, f.proposal), { outcome: 'CLOSED_BY_YOU', actions: [], view: f.secondView });
      assert.deepEqual(await shown(first, f.proposal), { outcome: 'NO_LONGER_AVAILABLE', actions: [], view: f.firstView });
    });

    await report.isolated('D04 withdrawal after approval and after delivery to the second recipient; the server supplies the state', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali']]);
      const approved = await rt.bringToApproved(first, a);
      const one = await withdraw(first, approved.proposal, approved.firstView);
      assert.deepEqual([one.outcome, one.neutral_outcome], ['RECORDED', 'CLOSED_BY_YOU'], 'D04 from FIRST_FORWARD_APPROVED');
      const [t1] = await rows(`SELECT prior_state FROM ${P.TRANSITIONS} WHERE id = $1`, [one.command]);
      assert.equal(t1.prior_state, 'FIRST_FORWARD_APPROVED', 'D04 the exact state was read under the lock');
      const forwarded = await rt.bringToForwarded(first, b);
      const two = await withdraw(first, forwarded.proposal, forwarded.firstView);
      assert.equal(two.outcome, 'RECORDED', 'D04 from FORWARDED_TO_SECOND');
      assert.equal((await rows(`SELECT prior_state FROM ${P.TRANSITIONS} WHERE id = $1`, [two.command]))[0].prior_state, 'FORWARDED_TO_SECOND');
      assert.deepEqual(await shown(first, forwarded.proposal), { outcome: 'CLOSED_BY_YOU', actions: [], view: forwarded.firstView });
      assert.deepEqual(await shown(b, forwarded.proposal), { outcome: 'NO_LONGER_AVAILABLE', actions: [], view: forwarded.secondView },
        'D04 the second recipient keeps their delivered view, neutrally');
    });

    await report.isolated('D05 a decision not offered now is UNAVAILABLE and writes nothing', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali']]);
      const offered = await rt.bringToOffered(first, a);
      let before = await footprint(offered.proposal, [first, a]);
      assert.equal((await withdraw(first, offered.proposal, offered.firstView)).outcome, 'UNAVAILABLE', 'D05 nothing to withdraw before approval');
      assert.deepEqual(await footprint(offered.proposal, [first, a]), before);
      const forwarded = await rt.bringToForwarded(first, b);
      before = await footprint(forwarded.proposal, [first, b]);
      for (const [human, fn, view, why] of [
        [b, FN.APPROVE, forwarded.secondView, 'the second recipient cannot approve forwarding'],
        [b, FN.WITHDRAW, forwarded.secondView, 'the second recipient cannot withdraw'],
        [first, FN.DECLINE, forwarded.firstView, 'the first recipient cannot decline after approving'],
        [first, FN.APPROVE, forwarded.firstView, 'nor approve twice'],
      ]) {
        assert.equal((await decide(fn, human, forwarded.proposal, view)).outcome, 'UNAVAILABLE', `D05 ${why}`);
        assert.deepEqual(await footprint(forwarded.proposal, [first, b]), before, `D05 ${why}: nothing written`);
      }
    });

    await report.isolated('E01 every ending the other side caused reads the same to the first recipient', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali'], [c, 'MALE', 'Yusuf']]);
      const declined = await rt.bringToForwarded(first, a);
      await decline(a, declined.proposal, declined.secondView);
      const expired = await rt.bringToForwarded(first, b);
      await rt.backdate(expired.proposal);
      await rt.expire(randomUUID(), expired.proposal);
      assert.equal((await rt.proposalRow(expired.proposal)).proposal_state, 'EXPIRED');
      const staled = await rt.bringToForwarded(first, c);
      await rt.supersedePolicy('PROPOSAL_EXPIRY', staled.policy.expiry, { expiryHours: 48 });
      await rt.revalidate(randomUUID(), staled.proposal);
      assert.equal((await rt.proposalRow(staled.proposal)).proposal_state, 'STALE');
      const answers = [];
      for (const f of [declined, expired, staled]) answers.push(await shown(first, f.proposal));
      for (const answer of answers) assert.deepEqual({ ...answer, view: null }, { outcome: 'NO_LONGER_AVAILABLE', actions: [], view: null });
    });

    await report.isolated('E02 a competing Mutual Match reads NO_LONGER_AVAILABLE to both humans of the cancelled proposal', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali']]);
      const won = await rt.bringToForwarded(first, a);
      const lost = await rt.bringToForwarded(first, b);
      await actAs(a);
      await rt.commitMatch(matchIds(), won.proposal, won.secondView);
      await asRole('postgres');
      assert.equal((await rt.proposalRow(lost.proposal)).proposal_state, 'CANCELLED_BY_COMPETING_MATCH');
      assert.deepEqual(await shown(first, lost.proposal), { outcome: 'NO_LONGER_AVAILABLE', actions: [], view: lost.firstView });
      assert.deepEqual(await shown(b, lost.proposal), { outcome: 'NO_LONGER_AVAILABLE', actions: [], view: lost.secondView });
      assert.deepEqual(await shown(first, won.proposal), { outcome: 'MATCH_CONCLUDED', actions: [], view: won.firstView },
        'E02 the matched proposal offers no S6-04 decision');
      assert.equal((await withdraw(first, won.proposal, won.firstView)).outcome, 'UNAVAILABLE', 'E02 nothing to withdraw after Mutual Match');
    });

    await report.isolated('E03 the second recipient cannot tell a withdrawal from an expiry', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali']]);
      const withdrawn = await rt.bringToForwarded(first, a);
      await withdraw(first, withdrawn.proposal, withdrawn.firstView);
      const expired = await rt.bringToForwarded(first, b);
      await rt.backdate(expired.proposal);
      await rt.expire(randomUUID(), expired.proposal);
      const one = await shown(a, withdrawn.proposal);
      const two = await shown(b, expired.proposal);
      assert.deepEqual({ ...one, view: null }, { ...two, view: null });
      assert.equal(one.outcome, 'NO_LONGER_AVAILABLE');
    });

    await report.isolated('F01 another human\'s proposal, a guessed id and a candidate before forwarding are one answer, and write nothing', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToOffered(first, a);
      const before = await footprint(f.proposal, [first, a, outsider, fresh]);
      for (const human of [outsider, fresh, a]) {
        for (const fn of DECISIONS) {
          const answer = await decide(fn, human, f.proposal, f.firstView);
          assert.equal(answer.outcome, 'UNAVAILABLE', `F01 ${fn} as a non-recipient`);
          assert.equal((await decide(fn, human, randomUUID(), f.firstView)).outcome, answer.outcome, 'F01 the same as a guessed id');
        }
      }
      assert.deepEqual(await footprint(f.proposal, [first, a, outsider, fresh]), before, 'F01 not even a lock row was written');
      assert.equal(await count('public.matching_setup_locks', 'user_id = ANY($1::uuid[])', [[outsider, fresh]]), 0);
    });

    await report.isolated('F02 a superseded view authorizes nothing: CHANGED, and nothing is written', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToOffered(first, a);
      const newer = randomUUID();
      await rt.materialize(newer, f.proposal, first, f.conclusionForFirst);
      assert.equal(await rt.currentViewOf(f.proposal, first), newer, 'F02 the view moved on');
      const before = await footprint(f.proposal, [first, a]);
      for (const fn of [FN.APPROVE, FN.DECLINE]) {
        assert.equal((await decide(fn, first, f.proposal, f.firstView)).outcome, 'CHANGED', `F02 ${fn} on the old view`);
        assert.deepEqual(await footprint(f.proposal, [first, a]), before, `F02 ${fn}: nothing written`);
      }
      assert.equal((await approve(first, f.proposal, newer)).outcome, 'RECORDED', 'F02 the current view still decides');
    });

    await report.isolated('F03 past its deadline a live proposal decides nothing and reads NO_LONGER_AVAILABLE', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali']]);
      const offered = await rt.bringToOffered(first, a);
      const approved = await rt.bringToApproved(first, b);
      for (const f of [offered, approved]) await rt.backdate(f.proposal);
      for (const f of [offered, approved]) {
        assert.equal((await rt.proposalRow(f.proposal)).proposal_state === 'EXPIRED', false, 'F03 nobody expired it yet');
        assert.deepEqual(await shown(first, f.proposal), { outcome: 'NO_LONGER_AVAILABLE', actions: [], view: f.firstView });
        const before = await footprint(f.proposal, [first]);
        for (const fn of DECISIONS) {
          assert.equal((await decide(fn, first, f.proposal, f.firstView)).outcome, 'UNAVAILABLE', `F03 ${fn} after the deadline`);
        }
        assert.deepEqual(await footprint(f.proposal, [first]), before, 'F03 nothing written');
      }
    });

    await report.isolated('F04 a proposal that failed its revalidation is UNAVAILABLE to forward approval (no reason), and writes nothing', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToOffered(first, a);
      await actAs(a);
      await rt.pause(randomUUID(), f.byUser[a].event);
      await asRole('postgres');
      const before = await footprint(f.proposal, [first, a]);
      assert.equal((await approve(first, f.proposal, f.firstView)).outcome, 'UNAVAILABLE');
      assert.deepEqual(await footprint(f.proposal, [first, a]), before);
    });

    await report.isolated('F05 with the launch seam closed: no consequential decision is presented or taken; withdrawal still works (D7)', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali']]);
      const offered = await rt.bringToOffered(first, a);
      const forwarded = await rt.bringToForwarded(first, b);
      await rt.restoreMatchingSeam(gateSeam);
      assert.deepEqual(await shown(first, offered.proposal), { outcome: 'AWAITING_YOU', actions: [], view: offered.firstView });
      assert.deepEqual(await shown(b, forwarded.proposal), { outcome: 'AWAITING_YOU', actions: [], view: forwarded.secondView });
      assert.deepEqual(await shown(first, forwarded.proposal), { outcome: 'IN_PROGRESS', actions: ['WITHDRAW'], view: forwarded.firstView },
        'F05 withdrawal is never hidden because launch is closed');
      const before = await footprint(offered.proposal, [first, a]);
      assert.equal((await approve(first, offered.proposal, offered.firstView)).outcome, 'NOT_AVAILABLE_NOW');
      assert.equal((await decline(first, offered.proposal, offered.firstView)).outcome, 'NOT_AVAILABLE_NOW');
      assert.equal((await decline(b, forwarded.proposal, forwarded.secondView)).outcome, 'NOT_AVAILABLE_NOW');
      assert.deepEqual(await footprint(offered.proposal, [first, a]), before, 'F05 nothing written');
      const answer = await withdraw(first, forwarded.proposal, forwarded.firstView);
      assert.deepEqual([answer.outcome, answer.neutral_outcome], ['RECORDED', 'CLOSED_BY_YOU'], 'F05 the ungated core withdrew it');
    });

    await report.isolated('G01 a replay answers from the committed row and writes nothing; a reused id for another act is refused', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali']]);
      const f = await rt.bringToOffered(first, a);
      const command = randomUUID();
      const one = await approve(first, f.proposal, f.firstView, command);
      const after = await footprint(f.proposal, [first, a]);
      const again = await approve(first, f.proposal, f.firstView, command);
      assert.deepEqual([again.outcome, again.neutral_outcome], [one.outcome, one.neutral_outcome], 'G01 the same answer');
      assert.deepEqual(await footprint(f.proposal, [first, a]), after, 'G01 and nothing new');
      assert.equal((await withdraw(first, f.proposal, f.firstView, command)).outcome, 'COMMAND_CONFLICT', 'G01 the approval id reused to withdraw');
      assert.equal((await approve(first, f.proposal, randomUUID(), command)).outcome, 'COMMAND_CONFLICT', 'G01 the approval id with another view');
      assert.deepEqual(await footprint(f.proposal, [first, a]), after);
      // A committed withdrawal replays even though the proposal is no longer live, with the durable prior state.
      const g = await rt.bringToApproved(first, b);
      const w = randomUUID();
      assert.equal((await withdraw(first, g.proposal, g.firstView, w)).outcome, 'RECORDED');
      const done = await footprint(g.proposal, [first, b]);
      assert.deepEqual(await withdraw(first, g.proposal, g.firstView, w), { outcome: 'RECORDED', neutral_outcome: 'CLOSED_BY_YOU', command: w });
      assert.deepEqual(await footprint(g.proposal, [first, b]), done);
    });

    await report.isolated('H01 nothing any S6-04 boundary did produced a Match, a World, an Introduction or a claim', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali'], [c, 'MALE', 'Yusuf']]);
      const x = await rt.bringToOffered(first, a);
      await approve(first, x.proposal, x.firstView);
      const y = await rt.bringToForwarded(first, b);
      await decline(b, y.proposal, y.secondView);
      const z = await rt.bringToForwarded(first, c);
      await withdraw(first, z.proposal, z.firstView);
      const humansHere = [first, a, b, c];
      for (const table of [MATCH.COMMITS, MATCH.RECORDS]) {
        assert.equal(await count(table, 'lower_user_id = ANY($1::uuid[]) OR higher_user_id = ANY($1::uuid[])', [humansHere]), 0, `H01 ${table}`);
      }
      assert.equal(await count(MATCH.CLAIMS, 'user_id = ANY($1::uuid[])', [humansHere]), 0, 'H01 no Introduction claim');
      assert.equal(await count('public.shared_worlds', "birth_basis = 'MUTUAL_MATCH'", []), 0, 'H01 no World');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ I. races on two real connections
async function verifyRaces(report, [first, a, b]) {
  await report.section('I01 two decisions of one human at once: exactly one commits, the other decides nothing', async () => {
    await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
    const f = await rt.bringToOffered(first, a);
    const extra = await rt.openExtra();
    try {
      await q('BEGIN');
      const mine = await asHuman(first, () => rows(`SELECT * FROM ${nameOf(FN.APPROVE)}($1, $2, $3)`, [randomUUID(), f.proposal, f.firstView]));
      await extra.qx('BEGIN');
      await extra.qx('SET LOCAL ROLE authenticated');
      await extra.qx("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: first, role: 'authenticated' })]);
      const theirs = extra.qx(`SELECT * FROM ${nameOf(FN.DECLINE)}($1, $2, $3)`, [randomUUID(), f.proposal, f.firstView]);
      assert.equal(await rt.waitForLockWait((t, v) => q(t, v), extra.pid), true, 'I01 the second decision waits on the pair lock');
      await q('COMMIT');
      const [late] = (await theirs).rows;
      await extra.qx('COMMIT');
      assert.equal(mine[0].outcome, 'RECORDED');
      assert.equal(late.outcome, 'UNAVAILABLE', 'I01 the decline that waited finds nothing to decline');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'FIRST_FORWARD_APPROVED');
      assert.equal(await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'FIRST_DECLINED'", [f.proposal]), 0);
    } finally {
      await q('ROLLBACK').catch(() => undefined);
      await extra.close();
    }
  });

  await report.section('I02 a withdrawal against the second decline: exactly one ending, and the loser decides nothing', async () => {
    await facts([[first, 'FEMALE', 'Mona'], [b, 'MALE', 'Ali']]);
    const f = await rt.bringToForwarded(first, b);
    const extra = await rt.openExtra();
    try {
      await q('BEGIN');
      const mine = await asHuman(b, () => rows(`SELECT * FROM ${nameOf(FN.DECLINE)}($1, $2, $3)`, [randomUUID(), f.proposal, f.secondView]));
      await extra.qx('BEGIN');
      await extra.qx('SET LOCAL ROLE authenticated');
      await extra.qx("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: first, role: 'authenticated' })]);
      const theirs = extra.qx(`SELECT * FROM ${nameOf(FN.WITHDRAW)}($1, $2, $3)`, [randomUUID(), f.proposal, f.firstView]);
      assert.equal(await rt.waitForLockWait((t, v) => q(t, v), extra.pid), true, 'I02 the withdrawal waits on the pair lock');
      await q('COMMIT');
      const [late] = (await theirs).rows;
      await extra.qx('COMMIT');
      assert.equal(mine[0].outcome, 'RECORDED');
      assert.equal(late.outcome, 'UNAVAILABLE');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'SECOND_DECLINED');
      assert.equal(await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'WITHDRAWN'", [f.proposal]), 0);
    } finally {
      await q('ROLLBACK').catch(() => undefined);
      await extra.close();
    }
  });
}

// ------------------------------------------------------------------ the run
const humans = Array.from({ length: 6 }, () => randomUUID());
const raceHumans = Array.from({ length: 3 }, () => randomUUID());

await runVerifier('0158', async (setStage) => {
  await rt.client.connect();
  setStage('fixtures');
  await rt.provisionHumans([...humans, ...raceHumans]);
  const report = createScenarioReport('0158', { query: q, restore: () => asRole('postgres') });

  setStage('posture');
  await verifyPosture(report);
  setStage('production closed');
  await verifyProductionClosed(report, humans);

  const gateSeam = await rt.captureMatchingSeam(PFN.PREREQUISITES);
  try {
    // The CW2-08 seam answers NOT_EVALUATED in production; it is cleared for these scenarios and restored byte for byte
    // below. The first-name seam is NOT replaced: every proposal runs on the real resolver over confirmed facts.
    await rt.clearProposalPrerequisites();
    setStage('runtime');
    await verifyRuntime(report, humans, gateSeam);
    setStage('races');
    await verifyRaces(report, raceHumans);
  } finally {
    await asRole('postgres');
    await rt.restoreMatchingSeam(gateSeam);
  }
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  await asRole('postgres');
  assert.equal((await rows(`SELECT * FROM ${PFN.PREREQUISITES.split('(')[0]}($1)`, [randomUUID()]))[0].clearance,
    'NOT_EVALUATED', 'the CW2-08 seam is fail-closed again after the run');
  await rt.cleanupRace(raceHumans);
  await rt.removeCommittedProposalState(humans);
  await rt.removeCommittedMatchingSetup(humans);
  await rt.removeFixtureHumans([...humans, ...raceHumans]);
  for (const table of [P.PROPOSALS, P.POLICY_STATE, P.FACT_VERSIONS]) {
    assert.equal(await count(table, 'true', []), 0, `${table} is empty again: every fixture this verifier committed was removed`);
  }
}, () => rt.client.end().catch(() => undefined));
