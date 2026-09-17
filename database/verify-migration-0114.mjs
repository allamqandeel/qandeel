// Real-PostgreSQL verifier for migration 0114 - I-07C atomic Mutual Match commit
// and Introduction birth runtime.
//
// Runs against a FULLY migrated database and proves, from live catalogs, live
// rows and live concurrent connections, that the one Match core commits exactly
// what the frozen CW2-03 / CW2-06 law describes, all of it or none of it, once,
// for one winner, and discloses nothing beyond it. Every fixture reaches
// FORWARDED_TO_SECOND through the REAL I-07A and I-07B boundaries as the humans
// involved. The two fail-closed seams are replaced for the run and restored byte
// for byte on every path, exactly as the I-07B verifiers do.
//
//   P01 posture: the core and the revised approval are postgres-owned SECURITY
//       DEFINER, search_path-pinned, executable by no application role; the core
//       accepts exactly twelve opaque identities and returns exactly the bounded
//       committed result; it enters the serialized region before it reads any
//       currentness, locks every mutable proposal row in canonical order first,
//       and requires CLEARED as the last gate; the live producer censuses hold
//
//   A01 the happy path: one commit, one World, two episodes, one record, both
//       facts, two claims, two pauses, one handoff, every competitor cancelled,
//       all at ONE instant
//   A02 an equivalent retry is answered from the committed row and creates nothing,
//       even after the humans are PAUSED, the proposal terminal and the World moved on
//   A03 a reused command id naming a different request fails closed
//   A04 a terminal proposal, a human with no candidate view, a stranger and
//       nobody are each refused with the bounded class
//   A05 a superseded candidate view is refused, and the current one accepted
//   A06 a superseded first-approval view is refused, though the candidate view is current
//   A07 every changed current setup authority is refused with the one bounded class
//   A08 the production CW2-08 seam refuses after every other gate has passed
//   A09 an active Introduction already present is refused
//   A10 an occupied active-Introduction claim is refused on its own
//   A11 NO GHOST: a late transactional failure leaves ZERO surviving effects
//   A12 a second command on the same proposal after the Match is refused
//   A13 the matched pair cannot birth a second World
//   A14 the third-member freeze: the born World admits nobody through governance
//   A15 a committed forward approval whose exact-view binding is missing fails
//       closed on retry, inferring and backfilling nothing (I07C-AUTH-01)
//
//   R01 both humans are paused with exactly ACTIVE_INTRODUCTION, superseding their
//       exact ACTIVE acts; no USER_PAUSED exists; the human can still turn off
//       and cannot resume the reserved pause
//   W01 the Shared World is exactly the frozen birth shape and carries no direct
//       birth, no Standing Context Grant, no third human
//
//   H01 the handoff is exactly the two exact views: names, conclusions, fields;
//       nothing private crossed
//   N01 a competing cancellation and an expiry are indistinguishable to the
//       recipient, and the winner is invisible
//
//   C01..C15 real two-connection races, each pinned with a lock-wait barrier
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createMatchRuntime, P, MATCH, MATCH_GUARDS, MATCH_INPUT_PARAMETERS, MATCH_RESULT_COLUMNS, MATCH_RESULT_BAN,
  MFN_MATCH, PFN, I07C_MATCH_PRODUCER, HUMAN_DECISIONS, DECISION_ENTRY_ORDER, APPROVED, PROFILE,
  COMPETING_REASON, matchIds, matchArgs, MATCH_COMMIT_SQL, runVerifier, APP_ROLES,
} from './matching-match-verifier-support.mjs';

const rt = createMatchRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

/** Strips `--` comment lines, so a positional assertion cannot be satisfied by prose. */
const stripComments = (source) => source.split('\n').filter((line) => !/^\s*--/u.test(line)).join('\n');

/** A commit produced nothing: every semantic cardinality is zero. */
const NOTHING = Object.freeze({
  commits: 0, matchTransitions: 0, worlds: 0, episodes: 0, records: 0, births: 0, starts: 0,
  claims: 0, pauses: 0, cancellations: 0, packages: 0, subjects: 0,
});

/** A commit produced everything exactly once, with `cancellations` competitors. */
const everything = (cancellations) => ({
  commits: 1, matchTransitions: 1, worlds: 1, episodes: 2, records: 1, births: 1, starts: 1,
  claims: 2, pauses: 2, cancellations, packages: 1, subjects: 2,
});

/** The error one operation raised, or null - for sections that run in autocommit. */
const outcomeOf = (promise) => promise.then(() => null, (error) => error);

/** An expected refusal, asserted WITHOUT a savepoint, for sections that commit as they go. */
async function refused(operation, code, message) {
  const error = await outcomeOf(operation());
  assert.ok(error, 'operation unexpectedly succeeded');
  assert.equal(error.code, code, `unexpected rejection code ${error.code}: ${error.message}`);
  assert.match(String(error.message), message);
  return error;
}

/** The two exact I-07B setup changes a human can make that stale a proposal, as that human. */
const changedProfile = (f, human) => rt.setProfile(randomUUID(), [...PROFILE, ['faith_practice_level', 'practising']], f.byUser[human].profile);
const changedRequirements = (f, human) => rt.setRequirements(randomUUID(), [['shared_language', 'HARD_DEALBREAKER', 'arabic']], f.byUser[human].requirements);

// ------------------------------------------------------------------ 1. posture
async function verifyPosture() {
  await asRole('postgres');
  await rt.verifyPosture({ internal: [MFN_MATCH.COMMIT, PFN.APPROVE] });
  for (const role of ['public', ...APP_ROLES]) {
    assert.equal(await rt.canExecute(role, MFN_MATCH.COMMIT), false, `P01 ${role} must not execute the Match core`);
    assert.equal(await rt.canExecute(role, PFN.APPROVE), false, `P01 ${role} must not execute the revised approval`);
  }
  const core = await rt.functionPosture(MFN_MATCH.COMMIT);
  assert.equal(core.volatility, 'v', 'P01 the Match core is VOLATILE');
  assert.ok(core.prosrc.includes('auth.uid()'), 'P01 the accepting human is derived from auth.uid()');

  // The core accepts exactly the twelve opaque identities and nothing that
  // names a human, a state, a reason or a clock.
  const inputs = await rt.inputParameters(MFN_MATCH.COMMIT);
  assert.deepEqual(inputs, MATCH_INPUT_PARAMETERS, 'P01 the Match core accepts exactly the twelve identities, in order');
  for (const name of inputs) {
    assert.doesNotMatch(name, /user|human|actor|grantor|owner|subject|on_behalf|recipient_user|status|state|reason|basis|lifecycle|phase|timestamp|_at$|occurred|clock/u,
      `P01 the Match core must not accept ${name}: the human is auth.uid() and every state is derived`);
  }
  const [{ types }] = await rows(
    `SELECT array_agg(DISTINCT t::regtype::text) types FROM pg_proc pr, unnest(pr.proargtypes::oid[]) t
      WHERE pr.oid = $1::regprocedure`, [MFN_MATCH.COMMIT]);
  assert.deepEqual(types, ['uuid'], 'P01 every input is an opaque uuid identity');
  const outputs = await rt.resultColumns(MFN_MATCH.COMMIT);
  assert.deepEqual(outputs, MATCH_RESULT_COLUMNS, 'P01 the Match core returns exactly the bounded committed result');
  for (const column of outputs) {
    assert.doesNotMatch(column, MATCH_RESULT_BAN, `P01 the Match core must not return ${column}`);
  }

  // The published order, over the comment-stripped body.
  const body = stripComments(core.prosrc);
  const at = (needle) => {
    const position = body.indexOf(needle);
    assert.ok(position >= 0, `P01 the Match core carries ${needle}`);
    return position;
  };
  const entry = at('enter_matching_proposal_decision_v1');
  assert.equal(body.split('enter_matching_proposal_decision_v1').length - 1, 1,
    'P01 the core enters the two-human serialization region exactly once');
  assert.ok(!body.includes('lock_matching_pair_humans_v1') && !body.includes('INSERT INTO public.matching_setup_locks'),
    'P01 the core reaches the setup locks only through the one entry point');
  const rowLocks = at('ORDER BY p.id');
  const view = at("assert_matching_recipient_view_current_v1(p_proposal_id, u, p_expected_view_id, 'CANDIDATE')");
  const binding = at('FROM public.matching_forward_approval_view_bindings b');
  const validity = at('resolve_matching_proposal_validity_v1');
  const claim = at("c.claim_state = 'HELD'");
  const pointer = at('FROM public.matching_participation_state s');
  const gate = at("gate.clearance <> 'CLEARED'");
  const clock = at('birth_at := clock_timestamp()');
  const deadline = at('proposal.expires_at <= birth_at');
  const writer = at("'FORWARDED_TO_SECOND', 'MUTUAL_MATCH_COMMITTED'");
  const commit = at('INSERT INTO public.matching_match_commits');
  assert.ok(entry < rowLocks && rowLocks < view && view < binding && binding < validity && validity < claim
    && claim < pointer && pointer < gate && gate < clock && clock < deadline && deadline < writer && writer < commit,
  'P01 the core enters, locks every mutable proposal row, proves both exact views, revalidates, guards, gates, captures one instant, decides the deadline against it, writes and commits last');
  assert.equal(body.split('clock_timestamp()').length - 1, 1, 'P01 exactly one instant is captured');
  // A transaction-fixed clock is settled before the canonical lock wait, so it
  // can decide no deadline of a command that waited (I07C-TIME-01).
  assert.doesNotMatch(body, /now\(\)|localtimestamp|current_timestamp|transaction_timestamp|statement_timestamp/iu,
    'P01 the captured instant is the only clock the core reads at all');
  assert.doesNotMatch(body, /pg_advisory|LOCK TABLE|DELETE FROM|TRUNCATE/u, 'P01 no advisory lock, no table lock, no deletion');
  assert.ok(!body.includes('INSERT INTO public.matching_proposal_transitions'),
    'P01 every transition goes through append_matching_proposal_transition_v1');
  assert.doesNotMatch(body, /SECOND_ACCEPTED|USER_PAUSED|READ_ONLY_CLOSED|'STANDARD'|ACCEPTED_INVITATION/u,
    'P01 no second-acceptance state, no user pause, no I-07D lifecycle and no direct birth is spelled');

  // The four I-07B human decisions still enter before they check (the revised
  // approval included), and the approval binds AFTER it appends.
  for (const fn of HUMAN_DECISIONS) {
    const decision = stripComments((await rt.functionPosture(fn)).prosrc);
    const [enter, check] = DECISION_ENTRY_ORDER.map((name) => decision.indexOf(name.split('(')[0].replace('public.', '')));
    assert.ok(enter >= 0 && check > enter, `P01 ${fn} enters the serialized region before it checks the exact view`);
  }
  const approval = stripComments((await rt.functionPosture(PFN.APPROVE)).prosrc);
  assert.ok(approval.indexOf("'OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED'") < approval.indexOf('INSERT INTO public.matching_forward_approval_view_bindings'),
    'P01 the approval appends its transition through the one writer, then binds the exact approved view');
  assert.doesNotMatch(approval, /MUTUAL_MATCH|shared_worlds|introduction_record|handoff|claim/u,
    'P01 forward approval is not a Mutual Match');

  // Live producer censuses.
  const census = async (where) => (await rows(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind = 'f' AND (${where}) ORDER BY 1`)).map((r) => r.proname);
  assert.deepEqual(await census(`(p.prosrc LIKE '%''MUTUAL_MATCH_COMMITTED''%' OR p.prosrc LIKE '%''CANCELLED_BY_COMPETING_MATCH''%')
                                  AND p.prosrc LIKE '%append_matching_proposal_transition_v1(%'`),
  [I07C_MATCH_PRODUCER], 'P01 exactly the Match core produces the two I-07C proposal states');
  assert.deepEqual(await census(`p.prosrc LIKE '%INSERT INTO public.matching_participation_events%' AND p.prosrc LIKE '%''ACTIVE_INTRODUCTION''%'`),
    [I07C_MATCH_PRODUCER], 'P01 exactly the Match core produces the ACTIVE_INTRODUCTION pause');
  assert.deepEqual(await census(`p.prosrc LIKE '%INSERT INTO public.shared_worlds%'`),
    [I07C_MATCH_PRODUCER, 'commit_shared_world_direct_acceptance_birth_v1'], 'P01 exactly the two frozen birth paths create a Shared World');
  assert.deepEqual(await census(`p.prosrc LIKE '%INSERT INTO public.matching_forward_approval_view_bindings%'`),
    ['approve_matching_proposal_forward_core_v1'], 'P01 exactly the revised approval writes a first-acceptance binding');
}

// ------------------------------------------------ 2. atomicity and refusals
async function verifyAtomicity(report, humans, gateSeam) {
  const [one, two, three] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('A01 the happy path commits every effect once at one instant', async () => {
      const f = await rt.bringToForwarded(one, two);
      // A live competitor involving the first recipient: OFFERED to `one` about `three`.
      const competitor = await rt.bringToOffered(one, three, { reusePolicy: f.policy });
      const ids = matchIds();
      await actAs(two);
      const [result] = await rt.commitMatch(ids, f.proposal, f.secondView);
      await asRole('postgres');
      assert.deepEqual(result, {
        outcome: 'MATCHED', committed_match_id: ids.command, matched_proposal_id: f.proposal,
        born_world_id: ids.world, born_introduction_record_id: ids.record,
        world_lifecycle: 'ACTIVE', world_phase: 'INTRODUCTION', world_birth_basis: 'MUTUAL_MATCH',
        introduction_record_status: 'ACTIVE',
      }, 'A01 the bounded committed result, and nothing else');
      assert.deepEqual(await rt.matchEffects(ids, f.proposal), everything(1), 'A01 every effect exactly once');
      assert.equal((await rt.instantCoherence(ids)).coherent, true, 'A01 every persisted moment is the ONE captured instant');

      const commit = await rt.commitRow(ids.command);
      assert.equal(commit.proposal_id, f.proposal, 'A01 the commit names the proposal');
      assert.equal(commit.first_approval_transition_id, f.approval, 'A01 and the exact first-acceptance transition');
      assert.equal(commit.first_approved_view_id, f.firstView, 'A01 and the exact first-approved view');
      assert.equal(commit.candidate_accepted_view_id, f.secondView, 'A01 and the exact accepted candidate view');
      assert.equal(commit.candidate_user_id, two, 'A01 the acting human is the candidate');
      const proposal = await rt.proposalRow(f.proposal);
      assert.equal(proposal.proposal_state, 'MUTUAL_MATCH_COMMITTED', 'A01 the winner is MUTUAL_MATCH_COMMITTED');
      assert.equal(proposal.current_transition_id, ids.command, 'A01 and its current transition IS the command id');
      const [transition] = await rows(`SELECT * FROM ${P.TRANSITIONS} t WHERE t.id = $1`, [ids.command]);
      assert.equal(transition.candidate_actor_id, two, 'A01 the Match transition is the candidate act');
      assert.equal(transition.first_recipient_actor_id, null, 'A01 and not the first party act');
      assert.equal(transition.private_reason_code, null, 'A01 a Match carries no private reason');
      for (const human of [one, two]) {
        assert.equal(await rt.neutral(f.proposal, human), 'MATCH_CONCLUDED', 'A01 both humans are told the Match concluded');
      }

      const world = await rt.worldRow(ids.world);
      assert.deepEqual([world.lifecycle, world.phase, world.birth_basis, world.closed_at],
        ['ACTIVE', 'INTRODUCTION', 'MUTUAL_MATCH', null], 'A01 the World is exactly the Matching birth shape');
      const episodes = await rt.episodesOf(ids.world);
      assert.deepEqual(episodes.map((e) => e.user_id).sort(), [one, two].sort(), 'A01 exactly the matched pair are members');
      assert.ok(episodes.every((e) => e.ended_at === null), 'A01 both episodes are open');
      const record = await rt.recordRow(ids.record);
      assert.deepEqual([record.introduction_status, record.world_id, record.match_commit_id, record.ended_at],
        ['ACTIVE', ids.world, ids.command, null], 'A01 the Introduction Record is ACTIVE and names the commit and World');
      for (const human of [one, two]) {
        const claim = await rt.heldClaimOf(human);
        assert.ok(claim, 'A01 each matched human holds a claim');
        assert.deepEqual([claim.introduction_record_id, claim.world_id, claim.match_commit_id],
          [ids.record, ids.world, ids.command], 'A01 bound to the one record, World and commit');
        assert.equal(await rt.activeIntroduction(human), true, 'A01 and the canonical Shared-World truth says so too');
      }

      // The competitor is terminal, INSIDE the same commit, with the private reason.
      assert.equal((await rt.proposalRow(competitor.proposal)).proposal_state, 'CANCELLED_BY_COMPETING_MATCH',
        'A01 the competitor was cancelled by the Match');
      const [link] = await rt.cancellationsOf(ids.command);
      assert.equal(link.cancelled_proposal_id, competitor.proposal, 'A01 the cancellation link names the competitor');
      // The transition chain's instants belong to the 0112 writer (the 0110
      // default, the transaction timestamp), so "inside the same transaction"
      // is proven by equality with the winning transition's own instant.
      const [cancellation] = await rows(
        `SELECT t.prior_state, t.resulting_state, t.private_reason_code, t.first_recipient_actor_id, t.candidate_actor_id,
                (t.occurred_at = w.occurred_at) AS same_transaction
           FROM ${P.TRANSITIONS} t, ${P.TRANSITIONS} w WHERE t.id = $1 AND w.id = $2`, [link.cancellation_transition_id, ids.command]);
      assert.deepEqual(cancellation, {
        prior_state: 'OFFERED_TO_FIRST', resulting_state: 'CANCELLED_BY_COMPETING_MATCH', private_reason_code: COMPETING_REASON,
        first_recipient_actor_id: null, candidate_actor_id: null, same_transaction: true,
      }, 'A01 moved from the exact state read under its row lock, by no human, with the private reason, in the same transaction as the winner');
      assert.equal(await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'STALE'", [competitor.proposal]), 0,
        'A01 the competitor was not left to become STALE later');
      await actAs(one);
      const [seen] = await rt.myProposal(competitor.proposal);
      assert.equal(seen.neutral_outcome, 'NO_LONGER_AVAILABLE', 'A01 its recipient is told only that it is no longer available');
      await asRole('postgres');
    });

    await report.isolated('A02 an equivalent retry creates nothing and answers from history', async () => {
      const f = await rt.bringToForwarded(one, two);
      const ids = matchIds();
      await actAs(two);
      const [first] = await rt.commitMatch(ids, f.proposal, f.secondView);
      const before = await rt.matchEffects(ids, f.proposal);
      const transitions = await count(P.TRANSITIONS, 'proposal_id = $1', [f.proposal]);
      const [again] = await rt.commitMatch(ids, f.proposal, f.secondView);
      assert.deepEqual(again, first, 'A02 the retry returns the identical committed result');
      assert.deepEqual(await rt.matchEffects(ids, f.proposal), before, 'A02 and created nothing');
      assert.equal(await count(P.TRANSITIONS, 'proposal_id = $1', [f.proposal]), transitions, 'A02 not even a transition');
      // Even after a later reviewed slice moves the World and the record on: the
      // answer is the committed history, not the live state.
      await asRole('postgres');
      await q("UPDATE public.shared_worlds SET phase = 'STANDARD' WHERE id = $1", [ids.world]);
      await q(`UPDATE ${MATCH.RECORDS} SET introduction_status = 'COMPLETED', ended_at = clock_timestamp() WHERE id = $1`, [ids.record]);
      await actAs(two);
      const [later] = await rt.commitMatch(ids, f.proposal, f.secondView);
      assert.deepEqual(later, first, 'A02 the historical committed answer never reads the live World or record');
      // A retry by anyone else is a different request under a reused id.
      await actAs(one);
      await rejected(() => rt.commitMatch(ids, f.proposal, f.secondView), ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
      await asRole('postgres');
    });

    await report.isolated('A03 a reused command id naming a different request fails closed', async () => {
      const f = await rt.bringToForwarded(one, two);
      const ids = matchIds();
      await actAs(two);
      await rt.commitMatch(ids, f.proposal, f.secondView);
      const before = await rt.matchEffects(ids, f.proposal);
      for (const [label, changed] of [
        ['World', { ...ids, world: randomUUID() }],
        ['record', { ...ids, record: randomUUID() }],
        ['claim', { ...ids, candidateClaim: randomUUID() }],
        ['pause', { ...ids, firstPause: randomUUID() }],
        ['handoff', { ...ids, handoff: randomUUID() }],
      ]) {
        await rejected(() => rt.commitMatch(changed, f.proposal, f.secondView), ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
        assert.deepEqual(await rt.matchEffects(ids, f.proposal), before, `A03 a different ${label} under the same id created nothing`);
      }
      await rejected(() => rt.commitMatch(ids, f.proposal, f.firstView), ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
      // Twelve identities, present and pairwise distinct.
      await rejected(() => rt.commitMatch({ ...matchIds(), record: ids.world, world: ids.world }, f.proposal, f.secondView),
        ['22023'], /MATCHING_COMMAND_INVALID/u);
      await rejected(() => rows(MATCH_COMMIT_SQL, [randomUUID(), f.proposal, f.secondView, null, ...Array.from({ length: 8 }, () => randomUUID())]),
        ['22023'], /MATCHING_COMMAND_INVALID/u);
      await asRole('postgres');
    });

    await report.isolated('A04 a terminal proposal, a human with no candidate view, a stranger and nobody are each refused', async () => {
      const f = await rt.bringToForwarded(one, two);
      await actAs(two);
      await rt.declineSecond(randomUUID(), f.proposal, f.secondView);
      const ids = matchIds();
      await rejected(() => rt.commitMatch(ids, f.proposal, f.secondView), ['40001'], /MATCHING_STALE_STATE/u);
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(ids, f.proposal), NOTHING, 'A04 nothing was written');
      // The candidate of a proposal that was never forwarded holds no view: the
      // same bounded not-found as for a proposal that never existed.
      const g = await rt.bringToApproved(one, three, { reusePolicy: f.policy });
      await actAs(three);
      await rejected(() => rt.commitMatch(matchIds(), g.proposal, randomUUID()), ['P0002'], /MATCHING_PROPOSAL_NOT_FOUND/u);
      // A human who is no part of it, and the first party acting as the candidate.
      await rejected(() => rt.commitMatch(matchIds(), f.proposal, f.secondView), ['P0002'], /MATCHING_PROPOSAL_NOT_FOUND/u);
      await actAs(one);
      await rejected(() => rt.commitMatch(matchIds(), f.proposal, f.secondView), ['P0002'], /MATCHING_PROPOSAL_NOT_FOUND/u);
      // Nobody at all is refused before anything is read.
      await actAs(null);
      await rejected(() => rt.commitMatch(matchIds(), f.proposal, f.secondView), ['42501'], /MATCHING_AUTHENTICATION_REQUIRED/u);
      await asRole('postgres');
    });

    await report.isolated('A05 a superseded candidate view is refused and the current one accepted', async () => {
      const f = await rt.bringToForwarded(one, two);
      const superseding = randomUUID();
      await rt.materialize(superseding, f.proposal, two, f.conclusionForCandidate);
      const ids = matchIds();
      await actAs(two);
      await rejected(() => rt.commitMatch(ids, f.proposal, f.secondView), ['40001'], /RECIPIENT_VIEW_STALE/u);
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(ids, f.proposal), NOTHING, 'A05 the stale view wrote nothing');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'FORWARDED_TO_SECOND', 'A05 the proposal is where it was');
      await actAs(two);
      const [result] = await rt.commitMatch(ids, f.proposal, superseding);
      assert.equal(result.outcome, 'MATCHED', 'A05 the CURRENT view authorizes the Match, which is what makes the refusal meaningful');
      await asRole('postgres');
      assert.equal((await rt.commitRow(ids.command)).candidate_accepted_view_id, superseding, 'A05 and the commit binds the current view');
    });

    await report.isolated('A06 a superseded first-approval view is refused though the candidate view is current', async () => {
      const f = await rt.bringToForwarded(one, two);
      const binding = await rt.bindingOf(f.proposal);
      assert.deepEqual([binding.approval_transition_id, binding.approver_user_id, binding.approved_view_id],
        [f.approval, one, f.firstView], 'A06 the first acceptance is durably bound to the exact view the first party approved');
      const superseding = randomUUID();
      await rt.materialize(superseding, f.proposal, one, f.conclusionForFirst);
      assert.equal(await rt.currentViewOf(f.proposal, one), superseding, 'A06 the first party now sees a different view');
      const ids = matchIds();
      await actAs(two);
      await rejected(() => rt.commitMatch(ids, f.proposal, f.secondView), ['40001'], /MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE/u);
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(ids, f.proposal), NOTHING, 'A06 a first acceptance over a superseded view is not carried forward');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'FORWARDED_TO_SECOND', 'A06 and the proposal is untouched');
      // A binding that is absent is refused the same way: the approval IS the binding.
      const g = await rt.bringToForwarded(one, three, { reusePolicy: f.policy });
      await q(`ALTER TABLE ${MATCH.BINDINGS} DISABLE TRIGGER matching_forward_approval_view_bindings_immutable`);
      await q(`DELETE FROM ${MATCH.BINDINGS} WHERE proposal_id = $1`, [g.proposal]);
      await q(`ALTER TABLE ${MATCH.BINDINGS} ENABLE TRIGGER matching_forward_approval_view_bindings_immutable`);
      await actAs(three);
      await rejected(() => rt.commitMatch(matchIds(), g.proposal, g.secondView), ['40001'], /MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE/u);
      await asRole('postgres');
    });

    await report.isolated('A15 a committed forward approval whose exact-view binding is missing fails closed on retry', async () => {
      // I07C-AUTH-01. The approval writes its transition and its binding in one
      // transaction, so the state cannot arise through the boundary; it is
      // constructed as the owner inside this rolled-back scenario, exactly as a
      // contradictory history would present itself.
      const f = await rt.bringToApproved(one, two);
      await actAs(one);
      const [same] = await rt.approveForward(f.approval, f.proposal, f.firstView);
      assert.equal(same.approved_state, 'FIRST_FORWARD_APPROVED', 'A15 the equivalent retry is answered from the committed rows');
      await rejected(() => rt.approveForward(f.approval, f.proposal, randomUUID()), ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
      await asRole('postgres');
      const transitions = await count(P.TRANSITIONS, 'proposal_id = $1', [f.proposal]);
      await q(`ALTER TABLE ${MATCH.BINDINGS} DISABLE TRIGGER matching_forward_approval_view_bindings_immutable`);
      await q(`DELETE FROM ${MATCH.BINDINGS} WHERE approval_transition_id = $1`, [f.approval]);
      await q(`ALTER TABLE ${MATCH.BINDINGS} ENABLE TRIGGER matching_forward_approval_view_bindings_immutable`);
      assert.equal(await count(P.TRANSITIONS, "id = $1 AND resulting_state = 'FIRST_FORWARD_APPROVED'", [f.approval]), 1,
        'A15 the committed approval transition exists');
      assert.equal(await rt.bindingOf(f.proposal), null, 'A15 and its exact-view binding does not');
      await actAs(one);
      for (const view of [f.firstView, randomUUID()]) {
        await rejected(() => rt.approveForward(f.approval, f.proposal, view), ['P0001'], /MATCHING_MATCH_CONTRADICTORY_STATE/u);
      }
      await asRole('postgres');
      assert.equal(await rt.bindingOf(f.proposal), null, 'A15 no binding was inferred or backfilled from the current view');
      assert.equal(await count(P.TRANSITIONS, 'proposal_id = $1', [f.proposal]), transitions, 'A15 and nothing was appended');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'FIRST_FORWARD_APPROVED', 'A15 the proposal is where it was');
      assert.equal(await rt.triggerEnabled(MATCH.BINDINGS, 'matching_forward_approval_view_bindings_immutable'), true, 'A15 the guard is enabled again');
    });

    await report.isolated('A07 every changed current setup authority is refused with one bounded class', async () => {
      const f = await rt.bringToForwarded(one, two);
      const changes = [
        ['profile', async () => { await actAs(two); await changedProfile(f, two); }],
        ['requirements', async () => { await actAs(one); await changedRequirements(f, one); }],
        ['disclosure authority', async () => { await actAs(two); await rt.revokeDisclosure(randomUUID(), f.byUser[two].authority); }],
        ['context grant', async () => { await actAs(one); await rt.revokeContext(randomUUID(), f.byUser[one].grant); }],
        ['participation pause', async () => { await actAs(one); await rt.pause(randomUUID(), f.byUser[one].event); }],
        ['participation off', async () => { await actAs(two); await rt.turnOff(randomUUID(), f.byUser[two].event); }],
        ['proposal policy', async () => { await asRole('postgres'); await rt.supersedePolicy('PROPOSAL_EXPIRY', f.policy.expiry, { expiryHours: 48 }); }],
      ];
      for (const [label, change] of changes) {
        await q('SAVEPOINT authority');
        await change();
        const ids = matchIds();
        await actAs(two);
        await rejected(() => rt.commitMatch(ids, f.proposal, f.secondView), ['40001'], /MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE/u);
        await asRole('postgres');
        assert.deepEqual(await rt.matchEffects(ids, f.proposal), NOTHING, `A07 a changed ${label} wrote nothing`);
        assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'FORWARDED_TO_SECOND',
          `A07 a changed ${label} is refused without terminalizing the proposal here`);
        await q('ROLLBACK TO SAVEPOINT authority');
        await q('RELEASE SAVEPOINT authority');
      }
      // An expired deadline is its own bounded class.
      await asRole('postgres');
      await rt.backdate(f.proposal);
      await actAs(two);
      await rejected(() => rt.commitMatch(matchIds(), f.proposal, f.secondView), ['55000'], /MATCHING_PROPOSAL_EXPIRED/u);
      await asRole('postgres');
    });

    await report.isolated('A08 the production CW2-08 seam refuses after every other gate has passed', async () => {
      const f = await rt.bringToForwarded(one, two);
      await q(gateSeam.definition);
      const [gate] = await rows('SELECT * FROM public.resolve_matching_proposal_prerequisites_v1($1)', [f.proposal]);
      assert.equal(gate.clearance, 'NOT_EVALUATED', 'A08 the production seam is in place and fails closed');
      const ids = matchIds();
      await actAs(two);
      await rejected(() => rt.commitMatch(ids, f.proposal, f.secondView), ['55000'], /MATCHING_PROPOSAL_LAUNCH_PREREQUISITE_UNRESOLVED/u);
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(ids, f.proposal), NOTHING, 'A08 an unresolved prerequisite writes nothing');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'FORWARDED_TO_SECOND', 'A08 and terminalizes nothing');
      // The same request, with the seam cleared again, commits: the gate was the only thing in the way.
      await rt.clearProposalPrerequisites();
      await actAs(two);
      const [result] = await rt.commitMatch(ids, f.proposal, f.secondView);
      assert.equal(result.outcome, 'MATCHED', 'A08 the gate was the last thing in the way');
      await asRole('postgres');
    });

    await report.isolated('A09 an active Introduction already present is refused', async () => {
      const f = await rt.bringToForwarded(one, two);
      await rt.seedBareIntroductionWorld(two);
      assert.equal(await rt.activeIntroduction(two), true, 'A09 the canonical Shared-World truth sees the Introduction');
      const ids = matchIds();
      await actAs(two);
      await rejected(() => rt.commitMatch(ids, f.proposal, f.secondView), ['40001'], /MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE/u);
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(ids, f.proposal), NOTHING, 'A09 nothing was written');
    });

    await report.isolated('A10 an occupied active-Introduction claim is refused on its own', async () => {
      // A HELD claim with NO active INTRODUCTION World behind it (a STANDARD
      // one), so the canonical resolver passes and only the internal guard can
      // refuse. The record's deferred commit binding stays pending inside this
      // rolled-back scenario; the core refuses before it ever flushes.
      const f = await rt.bringToForwarded(one, two);
      const world = randomUUID();
      const record = randomUUID();
      await q(`INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis) VALUES ($1, 'ACTIVE', 'STANDARD', 'MUTUAL_MATCH')`, [world]);
      await q('SET CONSTRAINTS public.introduction_records_match_commit_fk, public.matching_active_introduction_claims_commit_fk DEFERRED');
      await q(`INSERT INTO ${MATCH.RECORDS} (id, match_commit_id, world_id, pair_id, lower_user_id, higher_user_id, introduction_status, started_at)
               VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', clock_timestamp())`, [record, randomUUID(), world, f.pair, f.lower, f.higher]);
      await q(`INSERT INTO ${MATCH.CLAIMS} (id, user_id, match_commit_id, introduction_record_id, world_id, claim_state, claimed_at)
               SELECT $1, $2, r.match_commit_id, r.id, r.world_id, 'HELD', r.started_at FROM ${MATCH.RECORDS} r WHERE r.id = $3`,
      [randomUUID(), two, record]);
      assert.equal(await rt.activeIntroduction(two), false, 'A10 the canonical resolver sees no active Introduction');
      const ids = matchIds();
      await actAs(two);
      await rejected(() => rt.commitMatch(ids, f.proposal, f.secondView), ['40001'], /MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE/u);
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(ids, f.proposal), NOTHING, 'A10 the internal guard refused before any write');
    });

    await report.isolated('A12 a second command on the same proposal after the Match is refused', async () => {
      const f = await rt.bringToForwarded(one, two);
      const ids = matchIds();
      await actAs(two);
      await rt.commitMatch(ids, f.proposal, f.secondView);
      const second = matchIds();
      await rejected(() => rt.commitMatch(second, f.proposal, f.secondView), ['40001'], /MATCHING_STALE_STATE/u);
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(second, f.proposal), { ...NOTHING, matchTransitions: 1 },
        'A12 one proposal has exactly one Match transition and the second command produced nothing');
      assert.equal(await count('public.shared_worlds', 'id = $1', [second.world]), 0, 'A12 one proposal cannot birth two Worlds');
    });

    await report.isolated('A13 the matched pair cannot birth a second World while the Introduction is active', async () => {
      const f = await rt.bringToForwarded(one, two);
      const ids = matchIds();
      await actAs(two);
      await rt.commitMatch(ids, f.proposal, f.secondView);
      await asRole('postgres');
      for (const human of [one, two]) {
        assert.equal((await rt.setupState(human))[0].matchable, false, 'A13 a matched human is paused and not matchable');
      }
      await rejected(() => rt.capture(randomUUID(), f.pair, one, two), ['55000'], /MATCHING_PAIR_NOT_ELIGIBLE|MATCHING_ACTIVE_INTRODUCTION_PRESENT/u);
      assert.equal(await count(MATCH.RECORDS, 'pair_id = $1', [f.pair]), 1, 'A13 one Introduction Record for the pair');
      assert.equal(await count('public.shared_worlds', "birth_basis = 'MUTUAL_MATCH' AND id = $1", [ids.world]), 1, 'A13 one World');
    });

    await report.isolated('A14 the born World admits nobody through governance while it is an Introduction', async () => {
      const f = await rt.bringToForwarded(one, two);
      const ids = matchIds();
      await actAs(two);
      await rt.commitMatch(ids, f.proposal, f.secondView);
      await asRole('postgres');
      // The frozen 0084 capture refuses every governed operation - add-member
      // included - for a World that is not ACTIVE / STANDARD; the frozen 0085
      // add-member preparation goes through it. CW2-03 section 9: no third human
      // may join while the phase is INTRODUCTION.
      await rejected(() => rows('SELECT * FROM public.prepare_shared_world_add_member_governance_v1($1, $2, $3, $4, $5)',
        [randomUUID(), randomUUID(), randomUUID(), ids.world, three]), ['P0002'], /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u);
      await rejected(() => rows('SELECT * FROM public.capture_shared_world_governance_proposal_v1($1, $2, $3, $4, $5, $6, $7)',
        [randomUUID(), randomUUID(), ids.world, 'ADD_MEMBER', randomUUID(), 'ALL_CURRENT_MEMBERS', null]),
      ['P0002'], /SHARED_WORLD_GOVERNANCE_NOT_AVAILABLE/u);
      assert.equal(await count('public.shared_world_membership_episodes', 'world_id = $1', [ids.world]), 2,
        'A14 the World still has exactly two members');
      assert.equal(await count('public.shared_world_direct_birth_events', 'world_id = $1', [ids.world]), 0,
        'A14 no direct-invitation birth fact names the Matching World');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------- 3. participation and the World
async function verifyParticipationAndWorld(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('R01 both humans are paused with exactly ACTIVE_INTRODUCTION, and keep their I-07A authority', async () => {
      const f = await rt.bringToForwarded(one, two);
      const priorOne = await rt.currentParticipationOf(one);
      const priorTwo = await rt.currentParticipationOf(two);
      assert.deepEqual([priorOne.resulting_state, priorTwo.resulting_state], ['ACTIVE', 'ACTIVE'], 'R01 both start ACTIVE');
      const ids = matchIds();
      await actAs(two);
      await rt.commitMatch(ids, f.proposal, f.secondView);
      await asRole('postgres');
      const afterOne = await rt.currentParticipationOf(one);
      const afterTwo = await rt.currentParticipationOf(two);
      for (const [after, prior, pause] of [[afterOne, priorOne, ids.firstPause], [afterTwo, priorTwo, ids.candidatePause]]) {
        assert.equal(after.id, pause, 'R01 the pointer names the pause act the commit created');
        assert.deepEqual([after.participation_act, after.resulting_state, after.resulting_pause_reason, after.prior_event_id],
          ['PAUSE', 'PAUSED', 'ACTIVE_INTRODUCTION', prior.id], 'R01 a PAUSE act, PAUSED / ACTIVE_INTRODUCTION, superseding the exact ACTIVE act');
      }
      assert.equal(await count('public.matching_participation_events',
        "participant_user_id = ANY($1::uuid[]) AND resulting_pause_reason = 'USER_PAUSED'", [[one, two]]), 0,
      'R01 no USER_PAUSED was faked');
      assert.equal((await rt.setupState(one))[0].matchable, false, 'R01 a paused human is not matchable');
      // I-07A human authority is untouched: the human may still turn off, and
      // cannot resume a pause that is not theirs to resume.
      await actAs(one);
      await rejected(() => rt.resume(randomUUID(), afterOne.id), ['55000'], /MATCHING_PAUSE_NOT_USER_RESUMABLE/u);
      const [off] = await rt.turnOff(randomUUID(), afterOne.id);
      assert.equal(off.participation_state, 'OFF', 'R01 the human can still turn Matching off after a Match');
      await asRole('postgres');
      const world = await rt.worldRow(ids.world);
      assert.deepEqual([world.lifecycle, world.phase], ['ACTIVE', 'INTRODUCTION'],
        'R01 and the World is independent of Matching participation, exactly as CW2-06 section 24 requires');
    });

    await report.isolated('W01 the Shared World is exactly the frozen birth shape and nothing else', async () => {
      const f = await rt.bringToForwarded(one, two);
      const ids = matchIds();
      await actAs(two);
      await rt.commitMatch(ids, f.proposal, f.secondView);
      await asRole('postgres');
      const [birth] = await rows(`SELECT * FROM ${MATCH.BIRTHS} b WHERE b.world_id = $1`, [ids.world]);
      const [start] = await rows(`SELECT * FROM ${MATCH.STARTS} s WHERE s.introduction_record_id = $1`, [ids.record]);
      assert.deepEqual([birth.match_commit_id, birth.introduction_record_id], [ids.command, ids.record], 'W01 one WORLD_BIRTH naming the commit and record');
      assert.deepEqual([start.world_id, start.match_commit_id], [ids.world, ids.command], 'W01 one INTRODUCTION_STARTED naming the World and commit');
      assert.equal(await count('public.shared_world_standing_context_grants', 'world_id = $1', [ids.world]), 0,
        'W01 no Shared Standing Context Grant is manufactured by a Match');
      assert.equal(await count('public.shared_world_direct_birth_events', 'world_id = $1', [ids.world]), 0,
        'W01 no direct-invitation birth fact');
      const columns = (await rows(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'
          AND table_name IN ('shared_worlds', 'shared_world_membership_episodes')`)).map((r) => r.column_name);
      for (const column of columns) {
        assert.doesNotMatch(column, /owner|admin|role|creator|initiator/u, `W01 the World has no ${column}`);
      }
      await actAs(two);
      const [retry] = await rt.commitMatch(ids, f.proposal, f.secondView);
      assert.deepEqual([retry.world_lifecycle, retry.world_phase, retry.world_birth_basis], ['ACTIVE', 'INTRODUCTION', 'MUTUAL_MATCH'],
        'W01 the committed birth constants');
      await asRole('postgres');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------ 4. handoff and neutrality
async function verifyHandoffAndNeutrality(report, humans) {
  const [one, two, three, four] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('H01 the handoff package is exactly the two exact views and nothing private crossed', async () => {
      const f = await rt.bringToForwarded(one, two);
      // Private material that MUST NOT cross: a reasoning note and a refused candidate.
      const note = randomUUID();
      await rt.privateNote(note, f.snapshot, two, 'EXPLICIT_MATCHING_ANSWER', 'private reasoning about the candidate that never leaves Matching');
      const refusedCandidate = randomUUID();
      await rt.submitConclusion(refusedCandidate, f.snapshot, one, two, 'They mentioned their phone number is 0100 555 0199 and want you to call.');
      const [verdict] = await rt.filterConclusion(randomUUID(), refusedCandidate);
      assert.notEqual(verdict.filter_verdict, 'PERMITTED', 'H01 the fixture refused candidate really is refused');
      const ids = matchIds();
      await actAs(two);
      await rt.commitMatch(ids, f.proposal, f.secondView);
      await asRole('postgres');
      const pkg = await rt.packageOf(ids.command);
      assert.deepEqual([pkg.id, pkg.introduction_record_id, pkg.world_id, pkg.proposal_id, pkg.first_recipient_view_id, pkg.candidate_view_id],
        [ids.handoff, ids.record, ids.world, f.proposal, f.firstView, f.secondView], 'H01 the package binds exactly the two exact views');
      const subjects = await rt.subjectsOf(ids.handoff);
      assert.equal(subjects.length, 2, 'H01 exactly two subjects');
      for (const subject of subjects) {
        const [view] = await rows(
          `SELECT v.*, c.permitted_text FROM ${P.VIEWS} v JOIN ${P.PERMITTED_CONCLUSIONS} c ON c.id = v.permitted_conclusion_id WHERE v.id = $1`,
          [subject.source_view_id]);
        assert.deepEqual(
          [subject.subject_user_id, subject.presented_to_user_id, subject.presented_first_name, subject.safe_compatibility_conclusion, subject.permitted_conclusion_id],
          [view.subject_user_id, view.recipient_user_id, view.subject_first_name, view.permitted_text, view.permitted_conclusion_id],
          'H01 each subject is a copy of its view and of the permitted conclusion text');
      }
      assert.deepEqual(subjects.map((s) => s.presented_first_name).sort(), ['Omar', 'Sara'], 'H01 the two canonical first names');
      const fields = await rt.fieldsOf(ids.handoff);
      const viewFields = await rows(
        `SELECT v.subject_user_id, f.view_id, f.field_key, f.disclosed_value FROM ${P.VIEW_FIELDS} f JOIN ${P.VIEWS} v ON v.id = f.view_id
          WHERE f.view_id = ANY($1::uuid[]) ORDER BY v.subject_user_id, f.field_key`, [[f.firstView, f.secondView]]);
      assert.deepEqual(fields.map((x) => [x.subject_user_id, x.source_view_id, x.field_key, x.disclosed_value]),
        viewFields.map((x) => [x.subject_user_id, x.view_id, x.field_key, x.disclosed_value]),
        'H01 the fields are exactly the view fields, no more and no less');
      assert.deepEqual([...new Set(fields.map((x) => x.field_key))].sort(), [...APPROVED].sort(),
        'H01 exactly the fields both humans approved and Product permits; home_city_region crossed nowhere');

      // NOTHING PRIVATE CROSSED: not by identity, not by text, not by column.
      const serialized = JSON.stringify([pkg, ...subjects, ...fields]);
      for (const [label, needle] of [
        ['private note id', note], ['refused candidate id', refusedCandidate], ['snapshot id', f.snapshot],
        ['context grant', f.byUser[one].grant], ['context grant', f.byUser[two].grant],
        ['disclosure authority', f.byUser[one].authority], ['disclosure authority', f.byUser[two].authority],
        ['profile version', f.byUser[one].profile], ['profile version', f.byUser[two].profile],
        ['private reasoning text', 'private reasoning'], ['contact route', '0100 555'], ['unapproved field value', 'quieter side of town'],
      ]) {
        assert.ok(!serialized.includes(needle), `H01 the handoff carries no ${label}`);
      }
      for (const table of [MATCH.PACKAGES, MATCH.SUBJECTS, MATCH.FIELDS]) {
        const cols = (await rows(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
          [table.replace('public.', '')])).map((r) => r.column_name);
        for (const column of cols) {
          assert.doesNotMatch(column, /reason|evidence|provenance|refusal|snapshot|grant|requirement|note|source_class|phone|email|contact|competing/u,
            `H01 ${table}.${column} is not a private column`);
        }
      }
    });

    await report.isolated('N01 a competing cancellation and an expiry are indistinguishable to the recipient', async () => {
      // `three` is the first recipient from the SAME audience position of a
      // proposal the Match between `one` and `two` cancels, and of a proposal
      // about `four` that expires.
      const winner = await rt.bringToForwarded(one, two);
      const cancelled = await rt.bringToOffered(three, one, { reusePolicy: winner.policy });
      const expiring = await rt.bringToOffered(three, four, { reusePolicy: winner.policy });
      const ids = matchIds();
      await actAs(two);
      await rt.commitMatch(ids, winner.proposal, winner.secondView);
      await asRole('postgres');
      assert.equal((await rt.proposalRow(cancelled.proposal)).proposal_state, 'CANCELLED_BY_COMPETING_MATCH', 'N01 the competitor was cancelled');
      assert.equal((await rt.proposalRow(expiring.proposal)).proposal_state, 'OFFERED_TO_FIRST', 'N01 the unrelated proposal was not');
      await rt.backdate(expiring.proposal);
      await rt.expire(randomUUID(), expiring.proposal);
      assert.equal((await rt.proposalRow(expiring.proposal)).proposal_state, 'EXPIRED', 'N01 the peer proposal expired');

      await actAs(three);
      const [seenCancelled] = await rt.myProposal(cancelled.proposal);
      const [seenExpired] = await rt.myProposal(expiring.proposal);
      assert.equal(seenCancelled.neutral_outcome, 'NO_LONGER_AVAILABLE', 'N01 the cancelled proposal is NO_LONGER_AVAILABLE');
      assert.equal(seenExpired.neutral_outcome, 'NO_LONGER_AVAILABLE', 'N01 and so is the expired one');
      assert.deepEqual(Object.keys(seenCancelled).sort(), Object.keys(seenExpired).sort(), 'N01 the same columns, so no column can distinguish them');
      const proposalScoped = ['recipient_view_id', 'matching_proposal_id', 'presented_first_name', 'safe_compatibility_conclusion'];
      for (const key of Object.keys(seenCancelled)) {
        if (proposalScoped.includes(key)) continue;
        assert.deepEqual(seenCancelled[key], seenExpired[key], `N01 ${key} does not distinguish a competing cancellation from an expiry`);
      }
      assert.equal(seenCancelled.action_available, false, 'N01 and neither offers an action');
      const leak = JSON.stringify([seenCancelled, seenExpired]);
      for (const [label, needle] of [['the winning proposal', winner.proposal], ['the Match commit', ids.command],
        ['the born World', ids.world], ['the private reason', COMPETING_REASON], ['the state name', 'CANCELLED_BY_COMPETING_MATCH'],
        ['the counterparty', two]]) {
        assert.ok(!leak.includes(needle), `N01 the recipient projection never carries ${label}`);
      }
      const keysOf = async (proposal) => (await rt.myFields(proposal)).map((r) => r.disclosed_field_key);
      assert.deepEqual(await keysOf(cancelled.proposal), await keysOf(expiring.proposal),
        'N01 the field projection is the same shape for both endings');
      await asRole('postgres');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ 5. races
//
// Real concurrency needs COMMITTED state on two connections, so this section
// commits its fixtures and removes them afterwards. Every race pins its
// interleaving with the lock-wait barrier: the primary is not released until the
// competitor is OBSERVABLY waiting for a lock the primary holds.
async function verifyRaces(report, humans) {
  const [one, two, three, four] = humans;
  const extra = await rt.openExtra();
  const { qx, actAsX } = extra;
  const waitExtra = () => rt.waitForLockWait(q, extra.pid);
  const commitX = (ids, proposal, view) => qx(MATCH_COMMIT_SQL, matchArgs(ids, proposal, view));
  const noDeadlock = (error, label) => {
    if (!error) return;
    assert.notEqual(error.code, '40P01', `${label} no deadlock: every lock is taken in one canonical order`);
    assert.notEqual(error.code, '55P03', `${label} no lock timeout`);
  };

  try {
    await report.section('A11 NO GHOST: a late transactional failure leaves zero surviving effects', async () => {
      // Committed fixture, autocommit call, a verifier-local BEFORE INSERT trigger
      // on the LAST write of the transaction that raises AFTER every other effect
      // was written. Installed and dropped with try/finally; the trigger set is
      // proven restored.
      const f = await rt.bringToForwarded(one, two);
      const competitor = await rt.bringToOffered(one, three, { reusePolicy: f.policy });
      const guardsOf = () => rows('SELECT tgname FROM pg_trigger WHERE tgrelid = $1::regclass AND NOT tgisinternal ORDER BY 1', [MATCH.COMMITS]);
      const guardsBefore = await guardsOf();
      const probe = async (errcode, message) => {
        await asRole('postgres');
        await q(`CREATE OR REPLACE FUNCTION public.i07c_probe_late_failure_v1() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $probe$
                 BEGIN RAISE EXCEPTION '${message}' USING ERRCODE='${errcode}'; END$probe$`);
        await q(`DROP TRIGGER IF EXISTS i07c_probe_late_failure ON ${MATCH.COMMITS}`);
        await q(`CREATE TRIGGER i07c_probe_late_failure BEFORE INSERT ON ${MATCH.COMMITS} FOR EACH ROW EXECUTE FUNCTION public.i07c_probe_late_failure_v1()`);
      };
      const nothingSurvived = async (ids, label) => {
        await asRole('postgres');
        assert.deepEqual(await rt.matchEffects(ids, f.proposal), NOTHING, `A11 ${label} left ZERO surviving effects`);
        assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'FORWARDED_TO_SECOND', `A11 ${label}: the winner is untouched`);
        assert.equal((await rt.proposalRow(competitor.proposal)).proposal_state, 'OFFERED_TO_FIRST', `A11 ${label}: the competitor is untouched`);
        assert.equal(await count(P.TRANSITIONS,
          "proposal_id = ANY($1::uuid[]) AND resulting_state IN ('MUTUAL_MATCH_COMMITTED','CANCELLED_BY_COMPETING_MATCH')",
          [[f.proposal, competitor.proposal]]), 0, `A11 ${label}: no Match and no cancellation transition survived`);
        for (const human of [one, two]) {
          assert.equal((await rt.currentParticipationOf(human)).resulting_state, 'ACTIVE', `A11 ${label}: nobody was paused`);
          assert.equal(await rt.heldClaimOf(human), null, `A11 ${label}: no claim survived`);
          assert.equal(await rt.activeIntroduction(human), false, `A11 ${label}: no Introduction exists`);
        }
        assert.equal(await count('public.shared_worlds', 'id = $1', [ids.world]), 0, `A11 ${label}: no World`);
        assert.equal(await count(MATCH.PACKAGES, 'proposal_id = $1', [f.proposal]), 0, `A11 ${label}: no handoff`);
        assert.equal(await count(MATCH.BINDINGS, 'proposal_id = $1', [f.proposal]), 1, `A11 ${label}: the first-acceptance binding is as it was`);
      };
      try {
        // A late failure of any class propagates and rolls the whole Match back.
        await probe('P0001', 'I07C_PROBE_LATE_FAILURE');
        const late = matchIds();
        await actAs(two);
        await refused(() => rt.commitMatch(late, f.proposal, f.secondView), 'P0001', /I07C_PROBE_LATE_FAILURE/u);
        await nothingSurvived(late, 'a late failure');
        // A late UNIQUE violation takes the handler path: it classifies, and commits nothing.
        await probe('23505', 'I07C_PROBE_LATE_UNIQUE');
        const collided = matchIds();
        await actAs(two);
        await refused(() => rt.commitMatch(collided, f.proposal, f.secondView), '23505', /MATCHING_MATCH_ID_CONFLICT/u);
        await nothingSurvived(collided, 'a late unique violation');
      } finally {
        await asRole('postgres');
        await q(`DROP TRIGGER IF EXISTS i07c_probe_late_failure ON ${MATCH.COMMITS}`);
        await q('DROP FUNCTION IF EXISTS public.i07c_probe_late_failure_v1()');
      }
      assert.deepEqual(await guardsOf(), guardsBefore, 'A11 the trigger set of the commit relation is exactly as it was');
      // And the same request now commits: the probe was the only thing in the way.
      const ids = matchIds();
      await actAs(two);
      const [result] = await rt.commitMatch(ids, f.proposal, f.secondView);
      assert.equal(result.outcome, 'MATCHED', 'A11 the probe was the only thing in the way');
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(ids, f.proposal), everything(1), 'A11 and everything then commits once');
      await rt.cleanupRace([one, two, three]);
    });

    await report.section('C01 the same command retried concurrently commits exactly once', async () => {
      const f = await rt.bringToForwarded(one, two);
      const ids = matchIds();
      await q('BEGIN');
      await actAs(two);
      await rt.commitMatch(ids, f.proposal, f.secondView);
      await actAsX(two);
      const retry = outcomeOf(commitX(ids, f.proposal, f.secondView));
      assert.equal(await waitExtra(), true, 'C01 the retry is waiting on the human locks the first holds');
      await q('COMMIT');
      const outcome = await retry;
      noDeadlock(outcome, 'C01');
      assert.equal(outcome, null, 'C01 the concurrent retry is answered from the committed row');
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(ids, f.proposal), everything(0), 'C01 exactly one of everything');
      await rt.cleanupRace([one, two]);
    });

    await report.section('C02 two different commands on one proposal yield exactly one Match', async () => {
      const f = await rt.bringToForwarded(one, two);
      const a = matchIds();
      const b = matchIds();
      await q('BEGIN');
      await actAs(two);
      await rt.commitMatch(a, f.proposal, f.secondView);
      await actAsX(two);
      const second = outcomeOf(commitX(b, f.proposal, f.secondView));
      assert.equal(await waitExtra(), true, 'C02 the second command is waiting on the human locks');
      await q('COMMIT');
      const outcome = await second;
      noDeadlock(outcome, 'C02');
      assert.ok(outcome, 'C02 the second command must fail closed');
      assert.equal(outcome.code, '40001', 'C02 with the bounded stale class');
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(a, f.proposal), everything(0), 'C02 the first committed everything once');
      assert.deepEqual(await rt.matchEffects(b, f.proposal), { ...NOTHING, matchTransitions: 1 }, 'C02 the second created nothing');
      await rt.cleanupRace([one, two]);
    });

    /**
     * Two forwarded proposals sharing exactly one human. Whichever commits first
     * cancels the other INSIDE its transaction; the loser, released from the
     * shared human's lock, reads its terminal state under the row lock and fails
     * closed. Both never succeed.
     */
    const competingPair = async (label, primaryPair, secondaryPair) => {
      const [pa, pb] = primaryPair;
      const [sa, sb] = secondaryPair;
      const f = await rt.bringToForwarded(pa, pb);
      const g = await rt.bringToForwarded(sa, sb, { reusePolicy: f.policy });
      const fi = matchIds();
      const gi = matchIds();
      await q('BEGIN');
      await actAs(pb);
      await rt.commitMatch(fi, f.proposal, f.secondView);
      await actAsX(sb);
      const loser = outcomeOf(commitX(gi, g.proposal, g.secondView));
      assert.equal(await waitExtra(), true, `${label} the competing Match is waiting on the shared human's lock`);
      await q('COMMIT');
      const outcome = await loser;
      noDeadlock(outcome, label);
      assert.ok(outcome, `${label} the competing Match must fail closed`);
      assert.equal(outcome.code, '40001', `${label} with the bounded stale class`);
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(fi, f.proposal), everything(1), `${label} the winner committed everything once and cancelled the competitor`);
      assert.deepEqual(await rt.matchEffects(gi, g.proposal), NOTHING, `${label} the loser created nothing`);
      assert.equal((await rt.proposalRow(g.proposal)).proposal_state, 'CANCELLED_BY_COMPETING_MATCH', `${label} the loser proposal was cancelled by the winner`);
      const shared = primaryPair.find((h) => secondaryPair.includes(h));
      assert.equal(await count(MATCH.CLAIMS, "user_id = $1 AND claim_state = 'HELD'", [shared]), 1, `${label} the shared human holds exactly one claim`);
      await rt.cleanupRace([...new Set([...primaryPair, ...secondaryPair])]);
    };
    await report.section('C03 A-B against A-C: one winner, the loser cancelled inside the winner', () => competingPair('C03', [one, two], [one, three]));
    await report.section('C04 A-B against C-B: one winner, the loser cancelled inside the winner', () => competingPair('C04', [one, two], [three, two]));
    await report.section('C05 reversed UUID ordering: the lock order is canonical, not proposal direction', async () => {
      // The pair whose FIRST recipient is the HIGHER user id against a pair whose
      // first recipient is the LOWER: opposite-looking directions over a shared
      // human. Neither deadlocks, because the human locks are taken in ascending
      // user id and the proposal rows in ascending proposal id.
      const [lo, mid, hi] = [one, two, three].sort();
      await competingPair('C05', [hi, mid], [lo, mid]);
    });

    await report.section('C06 the four-human competing lock set: two disjoint winners both succeed and cancel every competitor', async () => {
      // P1 (one,two) and P4 (three,four) are disjoint winners; P2 (one,three)
      // and P3 (two,four) cross them. Each winner locks exactly its two humans
      // and every live proposal involving them, in canonical order, so the two
      // Matches serialize on the crossing proposal rows and BOTH commit, each
      // cancelling the crossing proposals it finds still live.
      const p1 = await rt.bringToForwarded(one, two);
      const p4 = await rt.bringToForwarded(three, four, { reusePolicy: p1.policy });
      const p2 = await rt.bringToOffered(one, three, { reusePolicy: p1.policy });
      const p3 = await rt.bringToOffered(two, four, { reusePolicy: p1.policy });
      const i1 = matchIds();
      const i4 = matchIds();
      await q('BEGIN');
      await actAs(two);
      await rt.commitMatch(i1, p1.proposal, p1.secondView);
      await actAsX(four);
      const other = outcomeOf(commitX(i4, p4.proposal, p4.secondView));
      assert.equal(await waitExtra(), true, 'C06 the second Match is waiting on a crossing proposal row the first holds');
      await q('COMMIT');
      const outcome = await other;
      noDeadlock(outcome, 'C06');
      assert.equal(outcome, null, 'C06 the disjoint Match succeeds once the crossing rows are released');
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(i1, p1.proposal), everything(2), 'C06 the first winner cancelled both crossing proposals');
      assert.deepEqual(await rt.matchEffects(i4, p4.proposal), everything(0), 'C06 the second winner found them already terminal and skipped them');
      for (const p of [p2, p3]) {
        assert.equal((await rt.proposalRow(p.proposal)).proposal_state, 'CANCELLED_BY_COMPETING_MATCH', 'C06 every crossing proposal is cancelled');
        assert.equal(await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'CANCELLED_BY_COMPETING_MATCH'", [p.proposal]), 1, 'C06 exactly once');
      }
      for (const human of [one, two, three, four]) {
        assert.equal(await count(MATCH.CLAIMS, "claim_state = 'HELD' AND user_id = $1", [human]), 1, 'C06 each of the four humans holds exactly one claim');
      }
      for (const world of [i1.world, i4.world]) {
        assert.equal(await count('public.shared_worlds', 'id = $1', [world]), 1, 'C06 each winner bore its own World');
      }
      await rt.cleanupRace([one, two, three, four]);
    });

    await report.section('C07 two disjoint Matches with no crossing proposal both succeed without waiting on each other', async () => {
      const p1 = await rt.bringToForwarded(one, two);
      const p2 = await rt.bringToForwarded(three, four, { reusePolicy: p1.policy });
      const i1 = matchIds();
      const i2 = matchIds();
      await q('BEGIN');
      await actAs(two);
      await rt.commitMatch(i1, p1.proposal, p1.secondView);
      await actAsX(four);
      // No shared human, no shared proposal row: the second must NOT wait.
      const outcome = await outcomeOf(commitX(i2, p2.proposal, p2.secondView));
      noDeadlock(outcome, 'C07');
      assert.equal(outcome, null, 'C07 the disjoint Match commits while the first is still open');
      await q('COMMIT');
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(i1, p1.proposal), everything(0), 'C07 the first');
      assert.deepEqual(await rt.matchEffects(i2, p2.proposal), everything(0), 'C07 and the second, each once');
      await rt.cleanupRace([one, two, three, four]);
    });

    /**
     * T2 holds the human locks (through a real I-07A command as the human, or a
     * materialization under the pair lock) while T1's Match is in flight; T2
     * commits only once T1 is observably waiting. T1 then revalidates under the
     * lock and must fail closed, and must have written nothing.
     */
    const authorityRace = async (label, change) => {
      const f = await rt.bringToForwarded(one, two);
      const ids = matchIds();
      await q('BEGIN');
      await change(f);
      await actAsX(two);
      const inFlight = outcomeOf(commitX(ids, f.proposal, f.secondView));
      assert.equal(await waitExtra(), true, `${label} the Match reached the serialization point and is waiting on the lock T2 holds`);
      await q('COMMIT');
      const outcome = await inFlight;
      noDeadlock(outcome, label);
      assert.ok(outcome, `${label} the Match must fail closed against the concurrent change`);
      assert.equal(outcome.code, '40001', `${label} with the bounded class`);
      assert.match(String(outcome.message), /MATCHING_MUTUAL_MATCH_NOT_COMMITTABLE|RECIPIENT_VIEW_STALE/u, `${label} naming staleness, nothing else`);
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(ids, f.proposal), NOTHING, `${label} and wrote nothing`);
      await rt.cleanupRace([one, two]);
    };
    await report.section('C08 a concurrent pause defeats the Match', () =>
      authorityRace('C08', async (f) => { await actAs(one); await rt.pause(randomUUID(), f.byUser[one].event); }));
    await report.section('C09 a concurrent opt-out defeats the Match', () =>
      authorityRace('C09', async (f) => { await actAs(two); await rt.turnOff(randomUUID(), f.byUser[two].event); }));
    await report.section('C10 a concurrent profile change defeats the Match', () =>
      authorityRace('C10', async (f) => { await actAs(two); await changedProfile(f, two); }));
    await report.section('C11 a concurrent requirement change defeats the Match', () =>
      authorityRace('C11', async (f) => { await actAs(one); await changedRequirements(f, one); }));
    await report.section('C12 a concurrent disclosure-authority revocation defeats the Match', () =>
      authorityRace('C12', async (f) => { await actAs(two); await rt.revokeDisclosure(randomUUID(), f.byUser[two].authority); }));
    await report.section('C13 a candidate view superseded under the pair lock defeats the Match that read it first', () =>
      authorityRace('C13', async (f) => {
        await asRole('postgres');
        await q('SELECT public.lock_matching_pair_humans_v1($1, $2)', [f.lower, f.higher]);
        await rt.materialize(randomUUID(), f.proposal, two, f.conclusionForCandidate);
      }));
    await report.section('C14 a first-approval view superseded under the pair lock defeats the Match', () =>
      authorityRace('C14', async (f) => {
        await asRole('postgres');
        await q('SELECT public.lock_matching_pair_humans_v1($1, $2)', [f.lower, f.higher]);
        await rt.materialize(randomUUID(), f.proposal, one, f.conclusionForFirst);
      }));
    await report.section('C15 a Match against another Introduction birth for the same human: exactly one', () =>
      // `two` is the candidate of both P1 (one,two) and P2 (three,two): the
      // second serializes on `two`'s lock and finds its proposal cancelled.
      competingPair('C15', [one, two], [three, two]));

    await report.section('C16 a Match that waits on the canonical lock past the deadline is refused at the real instant', async () => {
      // I07C-TIME-01. A transaction clock is fixed BEFORE the lock wait, so a
      // command that entered while the proposal was live and resumed after the
      // deadline would compare a moment that had already gone by and commit a
      // Match the proposal no longer authorized. The deadline is decided
      // against the real birth instant instead, and only this interleaving can
      // tell the two apart: the waiter's own transaction timestamp is proven to
      // PRECEDE the deadline it is then refused against.
      const f = await rt.bringToForwarded(one, two);
      const ids = matchIds();
      const deadline = await rt.deadlineIn(f.proposal, '2 seconds');
      await asRole('postgres');
      await q('BEGIN');
      // Exactly the statement the canonical two-human lock takes, on the lower
      // human's row: the Match blocks at its entry point, having read nothing.
      await q(`INSERT INTO public.matching_setup_locks AS l (user_id) VALUES ($1)
               ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at`, [f.lower]);
      await actAsX(two);
      const inFlight = outcomeOf(commitX(ids, f.proposal, f.secondView));
      assert.equal(await waitExtra(), true, 'C16 the Match is observably waiting on the canonical human lock');
      const [waiter] = await rows('SELECT xact_start FROM pg_stat_activity WHERE pid = $1', [extra.pid]);
      assert.ok(new Date(waiter.xact_start) < new Date(deadline),
        'C16 the waiting Match entered while the proposal was still live: its transaction clock precedes the deadline it will be refused against');
      assert.equal(await rt.waitForInstant(deadline), true, 'C16 the deadline passes while the Match is still blocked');
      assert.equal(await waitExtra(), true, 'C16 and it is STILL waiting, so it can only resume after the deadline');
      await q('COMMIT');
      const outcome = await inFlight;
      noDeadlock(outcome, 'C16');
      assert.ok(outcome, 'C16 a Match that resumes past the deadline must fail closed');
      assert.equal(outcome.code, '55000', 'C16 with the deadline class');
      assert.match(String(outcome.message), /MATCHING_PROPOSAL_EXPIRED/u, 'C16 named as an expiry and nothing else');
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(ids, f.proposal), NOTHING, 'C16 ZERO Match effects survived');
      assert.equal(await count(P.TRANSITIONS,
        "proposal_id = $1 AND resulting_state IN ('MUTUAL_MATCH_COMMITTED','CANCELLED_BY_COMPETING_MATCH')",
        [f.proposal]), 0, 'C16 no Match transition and no competing cancellation');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'FORWARDED_TO_SECOND',
        'C16 and the refusal terminalizes nothing: expiry is the I-07B boundary that does that');
      for (const human of [one, two]) {
        assert.equal((await rt.currentParticipationOf(human)).resulting_state, 'ACTIVE', 'C16 nobody was paused');
        assert.equal(await rt.heldClaimOf(human), null, 'C16 no claim survived');
        assert.equal(await rt.activeIntroduction(human), false, 'C16 no Introduction was born');
      }
      assert.equal(await count('public.shared_worlds', 'id = $1', [ids.world]), 0, 'C16 no World');
      assert.equal(await count(MATCH.PACKAGES, 'proposal_id = $1', [f.proposal]), 0, 'C16 no handoff');
      // The deadline was the only thing in the way: the same request commits
      // once the proposal is live again.
      await rt.deadlineIn(f.proposal, '2 hours');
      await actAs(two);
      const [committed] = await rt.commitMatch(ids, f.proposal, f.secondView);
      assert.equal(committed.outcome, 'MATCHED', 'C16 the deadline was the only thing in the way');
      await asRole('postgres');
      assert.deepEqual(await rt.matchEffects(ids, f.proposal), everything(0), 'C16 and then everything commits once');
      await rt.cleanupRace([one, two]);
    });
  } finally {
    await extra.close();
  }
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
await runVerifier('0114', async (setStage) => {
  await rt.client.connect();
  setStage('fixtures');
  await rt.provisionHumans(humans);

  setStage('posture');
  await verifyPosture();

  const report = createScenarioReport('0114', { query: q, restore: () => asRole('postgres') });
  const nameSeam = await rt.captureMatchingSeam(PFN.FIRST_NAME);
  const gateSeam = await rt.captureMatchingSeam(PFN.PREREQUISITES);
  try {
    // Both seams answer fail-closed in production and are proven to do so by the
    // 0111 verifier. A Match verifier that only ever saw the refusal would prove
    // that I-07C refuses and nothing else, so both are replaced here and restored
    // - byte for byte - in the finally below, on every path.
    await rt.resolveFirstName({ [humans[0]]: 'Sara', [humans[1]]: 'Omar', [humans[2]]: 'Layla', [humans[3]]: 'Adam' });
    await rt.clearProposalPrerequisites();

    setStage('atomicity');
    await verifyAtomicity(report, humans, gateSeam);
    setStage('participation');
    await verifyParticipationAndWorld(report, humans);
    setStage('handoff');
    await verifyHandoffAndNeutrality(report, humans);
    setStage('races');
    await verifyRaces(report, humans);
  } finally {
    await asRole('postgres');
    await rt.restoreMatchingSeam(nameSeam);
    await rt.restoreMatchingSeam(gateSeam);
  }
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  await asRole('postgres');
  const [gate] = await rows('SELECT * FROM public.resolve_matching_proposal_prerequisites_v1($1)', [randomUUID()]);
  assert.equal(gate.clearance, 'NOT_EVALUATED', 'the CW2-08 seam is fail-closed again after the run');
  const [name] = await rows('SELECT * FROM public.resolve_matching_canonical_first_name_v1($1)', [humans[0]]);
  assert.equal(name.resolution, 'UNRESOLVED_NO_CANONICAL_SOURCE', 'and the canonical first-name seam is fail-closed again');
  for (const [table, trigger] of MATCH_GUARDS) {
    assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} is enabled at the end of the run`);
  }
  await rt.removeCommittedProposalState(humans);
  await rt.removeCommittedPolicies();
  await rt.removeCommittedMatchingSetup(humans);
  await rt.removeFixtureHumans(humans);
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${MATCH.COMMITS}) + (SELECT count(*) FROM ${MATCH.RECORDS})
          + (SELECT count(*) FROM ${MATCH.CLAIMS}) + (SELECT count(*) FROM ${MATCH.BINDINGS})
          + (SELECT count(*) FROM ${P.PROPOSALS}) + (SELECT count(*) FROM ${P.POLICY_STATE})
          + (SELECT count(*) FROM public.shared_worlds WHERE birth_basis = 'MUTUAL_MATCH')
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans]);
  assert.equal(Number(residue), 0, 'every fixture this verifier committed was removed again');
}, () => rt.client.end().catch(() => undefined));
