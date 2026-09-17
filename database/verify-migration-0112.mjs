// Real-PostgreSQL verifier for migration 0112 - I-07B proposal choreography,
// revalidation, expiry, withdrawal and the neutral recipient projection.
//
// Runs against a FULLY migrated database and proves the whole pre-Mutual-Match
// choreography, the privacy of every ending, and the concurrency the contract
// requires - including that there is no second-party ACCEPTANCE anywhere.
//
//   A01 every boundary is postgres-owned, SECURITY DEFINER, search_path-pinned
//       and executable by NO ROLE, so no production caller has a path around the
//       CW2-08 Launch Gate that does not exist
//   A02 the four human decisions derive their human from auth.uid(), take no
//       identity parameter, and bind the exact view version the human saw -
//       INSIDE the canonical two-human serialization region, because a
//       recipient-view materialization supersedes a view while holding that same
//       lock and a check taken before it could accept a view V2 has replaced
//   A03 the CW2-08 gate is required on all five consequential boundaries and
//       ABSENT on the three protective ones, because expiry, staleness and
//       withdrawal end exposure rather than create it
//   A04 the audience contract: a recipient projection returns an opaque view
//       identity, an opaque proposal identity, a first name, the filtered
//       conclusion, a neutral outcome and one affordance - and nothing else
//   A05 THERE IS NO SECOND ACCEPTANCE: nothing in the Matching namespace can
//       spell one, exactly one function writes a transition, and no function
//       that writes one names either reserved I-07C state
//
//   B01 the whole walk: PREPARE, OFFER, FORWARD APPROVAL, FORWARD, SECOND DECLINE
//   B02 THE CANDIDATE IS NOT NOTIFIED by the first offer, and every question
//       they could ask answers exactly as for a proposal that never existed
//   B03 the first decline is terminal, and the candidate still learns nothing
//   B04 forward approval creates no World, no Introduction and no Match
//   B05 withdrawal leaves the second recipient's delivered view in place and
//       tells them only that it is no longer available
//   B06 expiry is terminal and the DATABASE CLOCK decides it
//   B07 every material change stales a live proposal: pause, opt-out, a new
//       profile version, a new requirement version, a reconfirmed grant, a new
//       disclosure authority, a moved proposal policy and a new Introduction
//   B08 cadence and pending limits are derived, so a pause accumulates no flood
//
//   C01 THE NEUTRAL PROJECTION IS THE PRIVACY PROPERTY: a first recipient cannot
//       tell a second decline from an expiry, from a private invalidation, or
//       from a competing match that cancelled the proposal
//   C02 a stale recipient view authorizes nothing
//   C03 a human who holds no view of a proposal gets the SAME bounded not-found
//       as for a proposal that does not exist
//   C04 the first party can never read the second recipient's exact view
//   C05 the private reason lives on the transition and reaches no recipient
//
//   D01 durable idempotency on every command, and the same id carrying a
//       different request fails closed
//   D02 compare-and-swap: a stale expected state is refused and applied to nothing
//
//   E01..E07 the required races, on two real connections with committed state,
//       including E06: a recipient view superseded under the canonical pair lock
//       between a human reading it and acting on it must defeat the act
//   F1..F2 forward safety
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createProposalRuntime, P, PFN, PROPOSAL_BOUNDARIES, HUMAN_DECISIONS, DECISION_ENTRY_ORDER,
  AUDIENCE_PROJECTIONS, NEUTRAL_OUTCOMES, ABSENT_ACCEPTANCE_STATES, RESERVED_I07C_STATES,
  RECIPIENT_DISCLOSURE_BAN, I07C_MATCH_PRODUCER, runVerifier, APP_ROLES,
} from './matching-proposal-verifier-support.mjs';

const rt = createProposalRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const PROFILE = [['life_stage', 'settled and ready'], ['children_plan', 'yes in time']];
const REQUIREMENTS = [
  ['faith_practice_level', 'HARD_DEALBREAKER', 'practising'],
  ['shared_language', 'SOFT_PREFERENCE', 'arabic and english'],
];
const APPROVED = ['life_stage'];
const CLEAN = 'You both treat a calm ordinary week as the point of a week.';
const CLEARED_BOUNDARIES = [PFN.OFFER, PFN.FORWARD, PFN.DECLINE_FIRST, PFN.APPROVE, PFN.DECLINE_SECOND];
const PROTECTIVE_BOUNDARIES = [PFN.EXPIRE, PFN.REVALIDATE, PFN.WITHDRAW];

// -------------------------------------------------------------- 1. posture
async function verifyPosture() {
  await asRole('postgres');
  for (const fn of PROPOSAL_BOUNDARIES) {
    const p = await rt.functionPosture(fn);
    assert.equal(p.owner, 'postgres', `A01 ${fn} is postgres-owned`);
    assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'),
      `A01 ${fn} pins an empty search_path`);
    for (const role of ['public', ...APP_ROLES]) {
      assert.equal(await rt.canExecute(role, fn), false,
        `A01 ${role} must not execute ${fn} before the CW2-08 Launch Gate exists`);
    }
  }
  // A02 THE FOUR HUMAN DECISIONS.
  for (const fn of HUMAN_DECISIONS) {
    const p = await rt.functionPosture(fn);
    assert.match(p.prosrc, /auth\.uid\(\)/u, `A02 ${fn} derives its human from auth.uid()`);
    assert.match(p.prosrc, /assert_matching_recipient_view_current_v1/u,
      `A02 ${fn} binds the exact recipient view version the human saw`);
    // A02 AND IT DOES SO INSIDE THE SERIALIZED REGION. A decision that checked
    // the view before taking the canonical two-human lock could accept V1 while
    // a concurrent materialization committed V2, and then act on a view that is
    // no longer current. Comment lines are stripped because `prosrc` includes
    // them and the body's own prose names both functions in the other order.
    const executable = p.prosrc.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
    const [entry, check] = DECISION_ENTRY_ORDER.map((name) => executable.indexOf(name.split('(')[0].replace('public.', '')));
    assert.ok(entry >= 0, `A02 ${fn} enters through the serialized decision entry point`);
    assert.ok(check >= 0, `A02 ${fn} checks the exact recipient view`);
    assert.ok(entry < check,
      `A02 ${fn} must take the canonical two-human lock BEFORE it checks the exact recipient view`);
    const parameters = await rt.inputParameters(fn);
    for (const name of parameters) {
      assert.doesNotMatch(name, /user|human|actor|grantor|owner|subject|on_behalf|candidate/u,
        `A02 ${fn} must not accept an identity parameter, found ${name}`);
    }
  }
  // A03 THE GATE IS WHERE IT MUST BE AND ABSENT WHERE IT MUST NOT.
  for (const fn of CLEARED_BOUNDARIES) {
    const p = await rt.functionPosture(fn);
    assert.match(p.prosrc, /resolve_matching_proposal_prerequisites_v1/u,
      `A03 ${fn} consumes the CW2-08 prerequisite seam`);
    assert.match(p.prosrc, /'CLEARED'/u, `A03 and requires exactly CLEARED from it`);
  }
  for (const fn of PROTECTIVE_BOUNDARIES) {
    const p = await rt.functionPosture(fn);
    assert.doesNotMatch(p.prosrc, /resolve_matching_proposal_prerequisites_v1/u,
      `A03 ${fn} ends exposure rather than creating it and must not be gated on an unavailable launch gate`);
  }
  // A04 THE AUDIENCE CONTRACT.
  for (const fn of AUDIENCE_PROJECTIONS) {
    const p = await rt.functionPosture(fn);
    assert.equal(p.volatility, 's', `A04 ${fn} is STABLE and writes nothing`);
    assert.match(p.prosrc, /auth\.uid\(\)/u, `A04 ${fn} derives its human from auth.uid()`);
    for (const column of await rt.resultColumns(fn)) {
      assert.doesNotMatch(column, RECIPIENT_DISCLOSURE_BAN, `A04 ${fn} must not return ${column}`);
    }
    assert.deepEqual(await rt.inputParameters(fn), ['p_proposal_id'],
      `A04 ${fn} takes one opaque proposal identity and no recipient parameter at all`);
  }
  // A05 THERE IS NO SECOND ACCEPTANCE ANYWHERE.
  const spelling = await rows(
    `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.proname ~* 'matching'
        AND pr.prosrc ~* $1 ORDER BY 1`, [`(${ABSENT_ACCEPTANCE_STATES.join('|')})`]);
  assert.deepEqual(spelling, [], 'A05 nothing in the Matching namespace can spell a second acceptance state');
  const writers = await rows(
    `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prosrc ~ 'INSERT INTO public\\.matching_proposal_transitions' ORDER BY 1`);
  assert.deepEqual(writers.map((r) => r.proname), ['append_matching_proposal_transition_v1'],
    'A05 exactly one function writes a proposal transition');
  // THE RESERVED-STATE PRODUCER LAW, repaired from "no producer" to EXACT
  // OWNERSHIP. At 0112's own deploy point no function beside the writer named
  // either state, and the migration's terminal self-assertion proved it. I-07C
  // is the reviewed producer of both, so the live truth is exactly the I-07C
  // Match core and nothing else - not "at least one", and not any function a
  // later slice might add without review.
  const producers = await rows(
    `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prosrc ~ 'append_matching_proposal_transition_v1'
        AND pr.prosrc ~ $1 ORDER BY 1`, [`('${RESERVED_I07C_STATES.join(`'|'`)}')`]);
  assert.deepEqual(producers.map((r) => r.proname), [I07C_MATCH_PRODUCER],
    'A05 exactly the reviewed I-07C Match core names the two reserved states beside the writer; I-07B still has no producer for them');
}

// ----------------------------------------------------------- 2. choreography
async function verifyChoreography(report, humans) {
  const [one, two, three] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('B01 the whole walk from preparation to the second decline', async () => {
      const f = await bringToOffered(one, two);
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'OFFERED_TO_FIRST',
        'B01 the proposal is offered to the first recipient');
      await actAs(one);
      const [approved] = await rt.approveForward(randomUUID(), f.proposal, f.firstView);
      assert.equal(approved.approved_state, 'FIRST_FORWARD_APPROVED', 'B01 the first recipient approves forwarding');
      await asRole('postgres');
      const secondView = randomUUID();
      const [forwarded] = await rt.forward(randomUUID(), f.proposal, secondView, f.conclusionForCandidate);
      assert.equal(forwarded.forwarded_state, 'FORWARDED_TO_SECOND', 'B01 the independent second proposal is delivered');
      assert.equal(forwarded.forwarded_field_count, 1, 'B01 disclosing exactly the intersection for that recipient');
      await actAs(two);
      const [declined] = await rt.declineSecond(randomUUID(), f.proposal, secondView);
      assert.equal(declined.declined_state, 'SECOND_DECLINED', 'B01 and the second recipient may decline');
      assert.equal(declined.neutral_outcome, 'CLOSED_BY_YOU', 'B01 which they know, because they did it');
      // AND THE ONLY ACCEPTANCE COUNTERPART IS THE ATOMIC I-07C MATCH COMMIT.
      // The asymmetry is the boundary: I-07B has no acceptance of its own, and
      // the one second-acceptance boundary that exists is the reviewed Match
      // core, exactly - no other function in the namespace accepts, matches or
      // commits a Mutual Match.
      await asRole('postgres');
      const accept = await rows(
        `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
          WHERE n.nspname = 'public' AND pr.proname ~* '(accept|mutual_match)' AND pr.proname ~* 'match' ORDER BY 1`);
      assert.deepEqual(accept.map((r) => r.proname), [I07C_MATCH_PRODUCER],
        'B01 the second acceptance exists exactly once, as the reviewed I-07C Match commit, and I-07B has none of its own');
    });

    await report.isolated('B02 the candidate is not notified by the first offer', async () => {
      const f = await bringToOffered(one, two);
      // NO CANDIDATE-SIDE ROW OF ANY KIND EXISTS.
      assert.equal(await count(P.VIEWS, 'proposal_id = $1 AND recipient_user_id = $2', [f.proposal, two]), 0,
        'B02 the offer creates no candidate-side view');
      assert.equal(await count(P.VIEW_STATE, 'proposal_id = $1 AND recipient_user_id = $2', [f.proposal, two]), 0,
        'B02 and no candidate-side pointer');
      // AND EVERY QUESTION THE CANDIDATE COULD ASK ANSWERS AS IT WOULD FOR A
      // PROPOSAL THAT WAS NEVER PREPARED.
      await actAs(two);
      const offered = await rejected(() => rt.myProposal(f.proposal), ['P0002'], /PROPOSAL_NOT_FOUND/u);
      const invented = await rejected(() => rt.myProposal(randomUUID()), ['P0002'], /PROPOSAL_NOT_FOUND/u);
      assert.equal(offered.message, invented.message,
        'B02 a proposal about them that exists and one that never existed are the same answer');
      await rejected(() => rt.myFields(f.proposal), ['P0002'], /PROPOSAL_NOT_FOUND/u);
      await rejected(() => rt.declineSecond(randomUUID(), f.proposal, f.firstView), ['P0002'], /PROPOSAL_NOT_FOUND/u);
    });

    await report.isolated('B03 the first decline is terminal and the candidate learns nothing', async () => {
      const f = await bringToOffered(one, two);
      await actAs(one);
      const [declined] = await rt.declineFirst(randomUUID(), f.proposal, f.firstView);
      assert.equal(declined.declined_state, 'FIRST_DECLINED', 'B03 the decline is terminal');
      // Terminal really is terminal: nothing advances afterwards.
      await rejected(() => rt.approveForward(randomUUID(), f.proposal, f.firstView), ['40001'], /STALE_STATE/u);
      await asRole('postgres');
      await rejected(() => rt.forward(randomUUID(), f.proposal, randomUUID(), f.conclusionForCandidate),
        ['40001'], /STALE_STATE|NO_LONGER_VALID/u);
      assert.equal(await count(P.VIEWS, 'proposal_id = $1 AND recipient_user_id = $2', [f.proposal, two]), 0,
        'B03 and the candidate still has no row of any kind');
      await actAs(two);
      await rejected(() => rt.myProposal(f.proposal), ['P0002'], /PROPOSAL_NOT_FOUND/u);
      // THE PRIVATE REASON IS ON THE TRANSITION AND NOWHERE ELSE.
      await asRole('postgres');
      const [transition] = await rows(
        `SELECT private_reason_code FROM ${P.TRANSITIONS} WHERE proposal_id = $1 AND resulting_state = 'FIRST_DECLINED'`,
        [f.proposal]);
      assert.equal(transition.private_reason_code, 'RECIPIENT_DECLINED', 'B03 the private reason is recorded');
      await actAs(one);
      const [view] = await rt.myProposal(f.proposal);
      assert.equal(view.neutral_outcome, 'CLOSED_BY_YOU', 'B03 and the decliner sees only a neutral outcome');
      assert.ok(!Object.prototype.hasOwnProperty.call(view, 'private_reason_code'),
        'B03 with no private reason column in the answer at all');
    });

    await report.isolated('B04 forward approval creates no World Introduction or Match', async () => {
      const f = await bringToOffered(one, two);
      const worldsBefore = await count('public.shared_worlds', 'true', []);
      await actAs(one);
      await rt.approveForward(randomUUID(), f.proposal, f.firstView);
      await asRole('postgres');
      assert.equal(await count('public.shared_worlds', 'true', []), worldsBefore,
        'B04 forward approval creates no Shared World');
      assert.equal(await count('public.shared_world_membership_episodes', 'user_id = ANY($1::uuid[])', [[one, two]]), 0,
        'B04 and no Introduction membership');
      // It also widens no I-07A disclosure authority: the authority set is
      // exactly what it was, unchanged and unextended.
      assert.equal(await count('public.pre_match_disclosure_authorities',
        'grantor_user_id = ANY($1::uuid[]) AND status = $2', [[one, two], 'ACTIVE']), 2,
      'B04 and widens neither human pre-Match disclosure authority');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'FIRST_FORWARD_APPROVED',
        'B04 it writes one transition, and that is the whole of what it does');
    });

    await report.isolated('B05 withdrawal leaves the delivered second view and says only unavailable', async () => {
      const f = await bringToForwarded(one, two);
      await actAs(one);
      const [withdrawn] = await rt.withdraw(randomUUID(), f.proposal, f.firstView, 'FORWARDED_TO_SECOND');
      assert.equal(withdrawn.withdrawn_state, 'WITHDRAWN', 'B05 the first party may withdraw before any Mutual Match');
      await asRole('postgres');
      // THE DELIVERED VIEW IS NOT ERASED.
      assert.equal(await count(P.VIEWS, 'id = $1', [f.secondView]), 1,
        'B05 the second recipient keeps the view they were actually shown');
      await actAs(two);
      const [seen] = await rt.myProposal(f.proposal);
      assert.equal(seen.neutral_outcome, 'NO_LONGER_AVAILABLE',
        'B05 and is told only that it is no longer available - no reason, no timing, no other activity');
      assert.equal(seen.action_available, false, 'B05 with no action left');
      await rejected(() => rt.declineSecond(randomUUID(), f.proposal, f.secondView), ['40001'], /STALE_STATE/u);
    });

    await report.isolated('B06 expiry is terminal and the database clock decides it', async () => {
      const f = await bringToOffered(one, two);
      await asRole('postgres');
      await rejected(() => rt.expire(randomUUID(), f.proposal), ['55000'], /NOT_YET_EXPIRED/u);
      await backdate(f.proposal);
      const [expired] = await rt.expire(randomUUID(), f.proposal);
      assert.equal(expired.expired_state, 'EXPIRED', 'B06 an expired proposal becomes terminal');
      await actAs(one);
      await rejected(() => rt.approveForward(randomUUID(), f.proposal, f.firstView), ['40001'], /STALE_STATE/u);
      const [seen] = await rt.myProposal(f.proposal);
      assert.equal(seen.neutral_outcome, 'NO_LONGER_AVAILABLE', 'B06 and the recipient is told only that');
    });

    await report.isolated('B07 every material change stales a live proposal', async () => {
      const changes = [
        ['a pause', 'PARTICIPATION_NOT_ACTIVE', async (f) => {
          await actAs(one);
          const [{ participation_event_id: current }] = await rt.setupState(one);
          await rt.pause(randomUUID(), current);
        }],
        ['an opt-out', 'PARTICIPATION_NOT_ACTIVE', async (f) => {
          await actAs(two);
          const [{ participation_event_id: current }] = await rt.setupState(two);
          await rt.turnOff(randomUUID(), current);
        }],
        ['a new Introduction Profile version', 'INTRODUCTION_PROFILE_VERSION_CHANGED', async (f) => {
          await actAs(two);
          await rt.setProfile(randomUUID(), PROFILE, f.byUser[two].profile);
        }],
        ['a new requirement version', 'MATCHING_REQUIREMENT_VERSION_CHANGED', async (f) => {
          await actAs(one);
          await rt.setRequirements(randomUUID(), REQUIREMENTS, f.byUser[one].requirements);
        }],
        ['a reconfirmed Matching Context Grant', 'MATCHING_CONTEXT_GRANT_CHANGED', async (f) => {
          await actAs(one);
          await rt.grantContext(randomUUID(), randomUUID(), f.byUser[one].grant);
        }],
        ['a revoked disclosure authority', 'DISCLOSURE_AUTHORITY_CHANGED', async (f) => {
          await actAs(two);
          await rt.revokeDisclosure(randomUUID(), f.byUser[two].authority);
        }],
        ['a moved proposal policy', 'PROPOSAL_POLICY_CHANGED', async (f) => {
          await asRole('postgres');
          await rt.supersedePolicy('PROPOSAL_EXPIRY', f.policy.expiry, { expiryHours: 48 });
        }],
        ['a new active Introduction', 'ACTIVE_INTRODUCTION_PRESENT', async (f) => {
          await asRole('postgres');
          await seedWorld(two, 'INTRODUCTION', 'ACTIVE');
        }],
      ];
      for (const [label, expected, apply] of changes) {
        await q('SAVEPOINT change');
        const f = await bringToOffered(one, two);
        await apply(f);
        await asRole('postgres');
        const [staled] = await rt.revalidate(randomUUID(), f.proposal);
        assert.equal(staled.current_state, 'STALE', `B07 ${label} stales a live proposal`);
        assert.equal(staled.private_reason_code, expected, `B07 recorded privately as ${expected}`);
        // THE DELIVERED VIEW IS NOT ERASED, only what may happen next changes.
        assert.equal(await count(P.VIEWS, 'proposal_id = $1', [f.proposal]), 1,
          `B07 ${label} erases no delivered view`);
        await actAs(one);
        const [seen] = await rt.myProposal(f.proposal);
        assert.equal(seen.neutral_outcome, 'NO_LONGER_AVAILABLE',
          `B07 and the recipient learns only that it is no longer available, never that ${label} happened`);
        await asRole('postgres');
        await q('ROLLBACK TO SAVEPOINT change');
        await q('RELEASE SAVEPOINT change');
      }
    });

    await report.isolated('B08 cadence and pending limits are derived not counted', async () => {
      const f = await seedEligible(one, two, { cadenceMax: 1 });
      await rt.prepare(randomUUID(), f.snapshot, one);
      // The cadence is used up for BOTH humans of the pair, so a second pair
      // involving either of them is refused.
      const g = await seedEligible(one, three, { reusePolicy: f.policy });
      await rejected(() => rt.prepare(randomUUID(), g.snapshot, one), ['55000'], /CADENCE_EXCEEDED/u);
      // A PAUSE ACCUMULATES NOTHING. Nothing is stored that could keep counting
      // while a human is away, and a derivation has no backlog to hand back.
      //
      // The one column a policy LIMIT may live in is the policy definition
      // itself, which is a configured maximum rather than a running total; the
      // assertion names any other offender so a failure says which.
      // The counter words are matched as UNDERSCORE-DELIMITED TOKENS, not as
      // substrings: `refused_at` is a timestamp that happens to contain `used`,
      // and a substring match reports it as a running counter.
      const counters = await rows(
        `SELECT c.table_name, c.column_name FROM information_schema.columns c
          WHERE c.table_schema = 'public' AND c.table_name LIKE 'matching\\_%'
            AND c.column_name ~* '(^|_)(count|counter|quota|remaining|balance|used|total|tally)(_|$)'
          ORDER BY 1, 2`);
      const named = counters.map((r) => `${r.table_name}.${r.column_name}`);
      const running = named.filter((name) => !name.startsWith('matching_proposal_policy_versions.'));
      assert.deepEqual(running, [],
        `B08 no cadence or pending counter may be stored: both are derived from the proposals that exist. Found ${running.join(', ')}`);
      // NON-VACUITY: the configured maximum really does exist, so the detector is
      // looking at a schema that has counter-shaped columns to find.
      assert.deepEqual(named.filter((name) => name.startsWith('matching_proposal_policy_versions.')),
        ['matching_proposal_policy_versions.max_count'],
        `B08 the only counter-shaped column is the configured policy maximum itself. Found ${named.join(', ')}`);
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------- 3. privacy
async function verifyPrivacy(report, humans) {
  const [one, two, three] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('C01 the first recipient cannot tell one ending from another', async () => {
      const seen = new Set();
      for (const [label, end] of [
        ['a second decline', async (f) => {
          await actAs(two);
          await rt.declineSecond(randomUUID(), f.proposal, f.secondView);
        }],
        ['an expiry', async (f) => {
          await asRole('postgres');
          await backdate(f.proposal);
          await rt.expire(randomUUID(), f.proposal);
        }],
        ['a private invalidation', async (f) => {
          await actAs(two);
          await rt.setProfile(randomUUID(), PROFILE, f.byUser[two].profile);
          await asRole('postgres');
          await rt.revalidate(randomUUID(), f.proposal);
        }],
        ['a competing match cancellation', async (f) => {
          // I-07B has no producer for this, so the state is reached the only
          // honest way: as the table owner, inside a scenario that rolls back.
          await asRole('postgres');
          await stepOwner(f.proposal, 'FORWARDED_TO_SECOND', 'CANCELLED_BY_COMPETING_MATCH');
        }],
      ]) {
        await q('SAVEPOINT ending');
        const f = await bringToForwarded(one, two);
        await end(f);
        await actAs(one);
        const [view] = await rt.myProposal(f.proposal);
        seen.add(view.neutral_outcome);
        assert.equal(view.neutral_outcome, 'NO_LONGER_AVAILABLE',
          `C01 ${label} is indistinguishable from every other ending for the first recipient`);
        assert.equal(view.action_available, false, `C01 and offers no action`);
        await asRole('postgres');
        await q('ROLLBACK TO SAVEPOINT ending');
        await q('RELEASE SAVEPOINT ending');
      }
      assert.deepEqual([...seen], ['NO_LONGER_AVAILABLE'],
        'C01 four different endings produce exactly ONE answer, which is the whole of the property');
      assert.equal(NEUTRAL_OUTCOMES.length, 5, 'C01 five neutral outcomes exist');
    });

    await report.isolated('C02 a stale recipient view authorizes nothing', async () => {
      const f = await bringToOffered(one, two);
      // A material change is revalidated into a NEW view; the old one stays
      // historical and can no longer authorize a consequential act.
      const replacement = randomUUID();
      await asRole('postgres');
      await rt.materialize(replacement, f.proposal, one, f.conclusionForFirst);
      await actAs(one);
      await rejected(() => rt.approveForward(randomUUID(), f.proposal, f.firstView),
        ['40001'], /RECIPIENT_VIEW_STALE/u);
      await rejected(() => rt.declineFirst(randomUUID(), f.proposal, f.firstView),
        ['40001'], /RECIPIENT_VIEW_STALE/u);
      // The CURRENT view does authorize it, so the refusal was the staleness.
      const [approved] = await rt.approveForward(randomUUID(), f.proposal, replacement);
      assert.equal(approved.approved_state, 'FIRST_FORWARD_APPROVED',
        'C02 the exact current view version is what authorizes the act');
      await asRole('postgres');
      assert.equal(await count(P.VIEWS, 'id = $1', [f.firstView]), 1,
        'C02 and the superseded view is not erased: it is what the human was shown');
    });

    await report.isolated('C03 a human with no view gets the same answer as for nothing', async () => {
      const f = await bringToOffered(one, two);
      await actAs(three);
      const stranger = await rejected(() => rt.myProposal(f.proposal), ['P0002'], /PROPOSAL_NOT_FOUND/u);
      const nothing = await rejected(() => rt.myProposal(randomUUID()), ['P0002'], /PROPOSAL_NOT_FOUND/u);
      assert.equal(stranger.message, nothing.message,
        'C03 somebody else proposal and a nonexistent one are one bounded answer');
      await rejected(() => rt.myFields(f.proposal), ['P0002'], /PROPOSAL_NOT_FOUND/u);
      await rejected(() => rt.declineFirst(randomUUID(), f.proposal, f.firstView), ['P0002'], /PROPOSAL_NOT_FOUND/u);
      // ... and an unauthenticated caller cannot ask at all.
      await actAs(null);
      await rejected(() => rt.myProposal(f.proposal), ['42501'], /AUTHENTICATION_REQUIRED/u);
    });

    await report.isolated('C04 the first party can never read the second recipient exact view', async () => {
      const f = await bringToForwarded(one, two);
      await actAs(one);
      const [mine] = await rt.myProposal(f.proposal);
      assert.equal(mine.recipient_view_id, f.firstView, 'C04 the first party reads their OWN view');
      assert.notEqual(mine.recipient_view_id, f.secondView, 'C04 and never the second recipient one');
      // The projection derives the human from auth.uid(), so there is no
      // parameter through which the first party could ask for the other view.
      assert.deepEqual(await rt.inputParameters(PFN.MY_PROPOSAL), ['p_proposal_id'],
        'C04 there is no recipient parameter to ask with');
      const mineFields = await rt.myFields(f.proposal);
      await actAs(two);
      const theirFields = await rt.myFields(f.proposal);
      // The two views are DIFFERENT DISCLOSURES over different subjects; they
      // are not the same wording with the names swapped.
      const [theirs] = await rt.myProposal(f.proposal);
      assert.notEqual(mine.presented_first_name, theirs.presented_first_name,
        'C04 each recipient is shown the OTHER human');
      assert.notEqual(mine.safe_compatibility_conclusion, theirs.safe_compatibility_conclusion,
        'C04 and a conclusion written for them');
      assert.ok(mineFields.length > 0 && theirFields.length > 0, 'C04 each view carries its own disclosed fields');
    });

    await report.isolated('C05 a recipient answer carries no private state at all', async () => {
      const f = await bringToForwarded(one, two);
      await actAs(one);
      const [view] = await rt.myProposal(f.proposal);
      const answer = JSON.stringify(view);
      // The counterparty's stable identity, the eligibility snapshot, the
      // authority, the profile version and the private reason are each absent
      // from the actual ANSWER, not merely from the column names.
      for (const [label, secret] of [
        ['the counterparty stable id', two],
        ['the eligibility snapshot', f.snapshot],
        ['the disclosure authority', f.byUser[two].authority],
        ['the profile version', f.byUser[two].profile],
        ['the pair identity', f.pair],
      ]) {
        assert.ok(!answer.includes(secret), `C05 ${label} does not appear in the recipient answer`);
      }
      assert.ok(!answer.includes('FORWARDED_TO_SECOND'),
        'C05 and the terminal or live state name is never returned either');
      assert.deepEqual(Object.keys(view).sort(),
        ['action_available', 'matching_proposal_id', 'neutral_outcome', 'presented_first_name',
          'recipient_view_id', 'safe_compatibility_conclusion'],
        'C05 the answer is exactly the six permitted fields');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------- 4. idempotency and CAS
async function verifyDurability(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('D01 every command answers an equivalent retry from the committed row', async () => {
      const f = await bringToOffered(one, two);
      // The OFFER.
      const [retryOffer] = await rt.offer(f.offerCommand, f.proposal, f.firstView, f.conclusionForFirst);
      assert.equal(retryOffer.offered_view_id, f.firstView, 'D01 the offer retry returns the committed view');
      assert.equal(await count(P.VIEWS, 'proposal_id = $1', [f.proposal]), 1, 'D01 and writes no second view');
      // The same id carrying a DIFFERENT view fails closed.
      await rejected(() => rt.offer(f.offerCommand, f.proposal, randomUUID(), f.conclusionForFirst),
        ['23505'], /COMMAND_ID_CONFLICT/u);
      // The HUMAN DECISION.
      await actAs(one);
      const approval = randomUUID();
      const [first] = await rt.approveForward(approval, f.proposal, f.firstView);
      const [again] = await rt.approveForward(approval, f.proposal, f.firstView);
      assert.deepEqual(again, first, 'D01 the approval retry returns the committed answer');
      assert.equal(await count(P.TRANSITIONS, 'proposal_id = $1 AND resulting_state = $2',
        [f.proposal, 'FIRST_FORWARD_APPROVED']), 1, 'D01 and appends no second transition');
      // PREPARATION, over a second pair that reuses the already-configured
      // policy: there is one current pointer per policy kind, so a second
      // install in the same state would collide on its primary key.
      await asRole('postgres');
      const g = await seedEligible(one, humans[2], { reusePolicy: f.policy });
      const command = randomUUID();
      const [prepared] = await rt.prepare(command, g.snapshot, one);
      const [preparedAgain] = await rt.prepare(command, g.snapshot, one);
      assert.deepEqual(preparedAgain, prepared, 'D01 the preparation retry returns the committed proposal');
      await rejected(() => rt.prepare(command, g.snapshot, humans[2]), ['23505'], /COMMAND_ID_CONFLICT/u);
    });

    await report.isolated('D02 a stale expected state is refused and applied to nothing', async () => {
      const f = await bringToOffered(one, two);
      await actAs(one);
      await rt.declineFirst(randomUUID(), f.proposal, f.firstView);
      // The proposal is terminal; every advancing command now names a state that
      // is not current, and nothing is applied to "whatever is current".
      await rejected(() => rt.approveForward(randomUUID(), f.proposal, f.firstView), ['40001'], /STALE_STATE/u);
      await asRole('postgres');
      await rejected(() => rt.offer(randomUUID(), f.proposal, randomUUID(), f.conclusionForFirst),
        ['40001'], /STALE_STATE|NO_LONGER_VALID/u);
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'FIRST_DECLINED',
        'D02 the proposal is exactly where the decline left it');
      assert.equal(await count(P.TRANSITIONS, 'proposal_id = $1', [f.proposal]), 2,
        'D02 and no refused command appended anything');
      // A withdrawal naming the wrong state is refused too.
      await actAs(one);
      await rejected(() => rt.withdraw(randomUUID(), f.proposal, f.firstView, 'FORWARDED_TO_SECOND'),
        ['40001'], /STALE_STATE/u);
      await rejected(() => rt.withdraw(randomUUID(), f.proposal, f.firstView, 'PREPARED'),
        ['22023'], /WITHDRAWAL_STATE_INVALID/u);
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ----------------------------------------------------------------- 5. races
//
// Real concurrency needs COMMITTED state on two connections, so this section
// commits its fixtures and removes them afterwards. The lock order is both
// humans' I-07A serialization rows in CANONICAL USER-ID ORDER, so direction
// never decides it and reverse-direction work cannot deadlock.
async function verifyRaces(report, humans) {
  const [one, two] = humans;
  const secondary = await rt.openSecondary();
  const { q2 } = secondary;
  /**
   * Waits until one backend is observably WAITING FOR A LOCK.
   *
   * A race whose interleaving is not pinned is not a proof: whichever side
   * happens to arrive first decides the outcome, and the scenario reports a pass
   * it did not earn. This is the synchronisation point - the primary connection
   * has reached the two-human lock the secondary is holding - and it is observed
   * from the OTHER connection, because the one being watched is busy.
   */
  const waitForLockWait = async (pid) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const { rows: [{ waiting }] } = await q2(
        `SELECT count(*)::int waiting FROM pg_stat_activity
          WHERE pid = $1 AND state = 'active' AND wait_event_type = 'Lock'`, [pid]);
      if (waiting > 0) return true;
      await new Promise((resolve) => { setTimeout(resolve, 25); });
    }
    return false;
  };
  try {
    await report.section('E01 simultaneous A,B and B,A preparation yield one live proposal', async () => {
      const f = await commitEligible(one, two);
      await q('BEGIN'); await q2('BEGIN');
      const forward = rt.prepare(randomUUID(), f.snapshot, one);
      const reverse = q2('SELECT * FROM public.prepare_matching_proposal_core_v1($1, $2, $3)',
        [randomUUID(), f.snapshot, two]);
      const outcomes = await Promise.allSettled([forward, reverse]);
      await q('COMMIT').catch(() => undefined);
      await q2('COMMIT').catch(() => undefined);
      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      assert.equal(fulfilled.length, 1,
        'E01 exactly one of the two directions survives, whichever arrived first');
      assert.equal(await count(P.PROPOSALS, 'pair_id = $1', [f.pair]), 1,
        'E01 and exactly one proposal row exists for the unordered pair');
      await cleanupRace([one, two]);
    });

    await report.section('E02 duplicate same-direction preparation is convergent', async () => {
      const f = await commitEligible(one, two);
      const command = randomUUID();
      await q('BEGIN'); await q2('BEGIN');
      const a = rt.prepare(command, f.snapshot, one);
      const b = q2('SELECT * FROM public.prepare_matching_proposal_core_v1($1, $2, $3)', [command, f.snapshot, one]);
      const outcomes = await Promise.allSettled([a, b]);
      await q('COMMIT').catch(() => undefined);
      await q2('COMMIT').catch(() => undefined);
      assert.ok(outcomes.some((o) => o.status === 'fulfilled'), 'E02 at least one caller gets an answer');
      assert.equal(await count(P.PROPOSALS, 'id = $1', [command]), 1,
        'E02 and the same command id produced exactly one proposal');
      await cleanupRace([one, two]);
    });

    await report.section('E03 first decline against forward approval leaves exactly one result', async () => {
      const f = await commitOffered(one, two);
      await q('BEGIN'); await q2('BEGIN');
      await rt.actAs(one);
      await secondary.actAs2(one);
      const decline = rt.declineFirst(randomUUID(), f.proposal, f.firstView);
      const approve = q2('SELECT * FROM public.approve_matching_proposal_forward_core_v1($1, $2, $3)',
        [randomUUID(), f.proposal, f.firstView]);
      const outcomes = await Promise.allSettled([decline, approve]);
      await q('COMMIT').catch(() => undefined);
      await q2('COMMIT').catch(() => undefined);
      await asRole('postgres');
      const state = (await rt.proposalRow(f.proposal)).proposal_state;
      assert.ok(['FIRST_DECLINED', 'FIRST_FORWARD_APPROVED'].includes(state),
        `E03 the proposal is in exactly one of the two results, found ${state}`);
      assert.equal(await count(P.TRANSITIONS, 'proposal_id = $1 AND prior_state = $2', [f.proposal, 'OFFERED_TO_FIRST']), 1,
        'E03 and exactly one transition left OFFERED_TO_FIRST');
      assert.equal(outcomes.filter((o) => o.status === 'fulfilled').length, 1,
        'E03 exactly one of the two callers was told it succeeded');
      await cleanupRace([one, two]);
    });

    await report.section('E04 withdrawal against forwarding leaves exactly one result', async () => {
      const f = await commitApproved(one, two);
      await q('BEGIN'); await q2('BEGIN');
      await rt.actAs(one);
      const withdraw = rt.withdraw(randomUUID(), f.proposal, f.firstView, 'FIRST_FORWARD_APPROVED');
      const forward = q2('SELECT * FROM public.forward_matching_proposal_to_second_core_v1($1, $2, $3, $4)',
        [randomUUID(), f.proposal, randomUUID(), f.conclusionForCandidate]);
      const outcomes = await Promise.allSettled([withdraw, forward]);
      await q('COMMIT').catch(() => undefined);
      await q2('COMMIT').catch(() => undefined);
      await asRole('postgres');
      const state = (await rt.proposalRow(f.proposal)).proposal_state;
      assert.ok(['WITHDRAWN', 'FORWARDED_TO_SECOND'].includes(state),
        `E04 the proposal is in exactly one of the two results, found ${state}`);
      assert.equal(outcomes.filter((o) => o.status === 'fulfilled').length, 1,
        'E04 exactly one of the two callers was told it succeeded');
      await cleanupRace([one, two]);
    });

    await report.section('E05 expiry against a human action leaves exactly one winner', async () => {
      const f = await commitOffered(one, two);
      await asRole('postgres');
      await backdate(f.proposal);
      await q('BEGIN'); await q2('BEGIN');
      await rt.actAs(one);
      const expire = q2('SELECT * FROM public.expire_matching_proposal_core_v1($1, $2)', [randomUUID(), f.proposal]);
      const approve = rt.approveForward(randomUUID(), f.proposal, f.firstView);
      const outcomes = await Promise.allSettled([expire, approve]);
      await q('COMMIT').catch(() => undefined);
      await q2('COMMIT').catch(() => undefined);
      await asRole('postgres');
      const state = (await rt.proposalRow(f.proposal)).proposal_state;
      assert.ok(['EXPIRED', 'FIRST_FORWARD_APPROVED'].includes(state),
        `E05 exactly one of expiry and the human action won, found ${state}`);
      assert.equal(outcomes.filter((o) => o.status === 'fulfilled').length, 1,
        'E05 and only one caller was told it succeeded');
      await cleanupRace([one, two]);
    });

    await report.section('E06 a view superseded under the pair lock defeats a human action that read it first', async () => {
      // THE TOCTOU THIS SLICE WAS REVIEWED FOR. A human decision reads the exact
      // recipient view it was shown; `materialize_matching_recipient_view_core_v1`
      // supersedes that view while holding the canonical two-human lock. If the
      // decision checked the view BEFORE taking that lock, this interleaving
      // would let V1 authorize a consequential act that V2 has already replaced:
      //
      //   T1  reads V1 and decides to act
      //   T2  takes the pair lock, materializes V2, moves the pointer, COMMITS
      //   T1  takes the now-free pair lock and acts on V1
      //
      // The race is constructed so the window is REAL rather than notional: T2
      // holds the lock and its uncommitted V2 while T1's call is already in
      // flight, so T1 blocks exactly where the check has to happen. T1 is
      // deliberately not awaited until T2 commits.
      // T2 does not commit until T1 is OBSERVABLY waiting for the pair lock.
      // Without that barrier the interleaving is itself a race: T2 could commit
      // before T1's statement even reached the server, T1 would then read V2 and
      // refuse for the ordinary reason, and the scenario would report a pass it
      // had not earned. It is also what makes the pre-fix half below
      // deterministic, because that half needs T1 to be PAST its unlocked read.
      const [{ pid }] = await rows('SELECT pg_backend_pid() AS pid');
      const f = await commitOffered(one, two);
      const superseding = randomUUID();
      await q2('BEGIN');
      await q2('SELECT public.lock_matching_pair_humans_v1($1, $2)', [f.lower, f.higher]);
      await q2('SELECT * FROM public.materialize_matching_recipient_view_core_v1($1, $2, $3, $4)',
        [superseding, f.proposal, one, f.conclusionForFirst]);

      await rt.actAs(one);
      const command = randomUUID();
      const inFlight = rt.declineFirst(command, f.proposal, f.firstView).then(() => null, (error) => error);
      assert.equal(await waitForLockWait(pid), true,
        'E06 the decline reached the two-human serialization point and is waiting for the lock T2 holds');
      await q2('COMMIT');
      const outcome = await inFlight;

      await asRole('postgres');
      assert.ok(outcome, 'E06 the human action must fail closed rather than act on the superseded view');
      assert.equal(outcome.code, '40001', 'E06 and fail with the bounded stale-state class');
      assert.match(String(outcome.message), /RECIPIENT_VIEW_STALE/u,
        'E06 naming the exact-view staleness, not something else that happened to go wrong');
      // AND NOTHING WAS COMMITTED FROM THE STALE VIEW.
      assert.equal(await count(P.TRANSITIONS, 'id = $1', [command]), 0,
        'E06 no transition from the stale view exists');
      assert.equal(await count(P.TRANSITIONS, 'proposal_id = $1 AND resulting_state = $2',
        [f.proposal, 'FIRST_DECLINED']), 0, 'E06 and the proposal did not decline');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'OFFERED_TO_FIRST',
        'E06 the proposal is exactly where it was');
      // The SUPERSEDING view is current, and acting on IT works - so the refusal
      // above was the staleness and not a broken fixture.
      assert.equal(await rt.currentViewOf(f.proposal, one), superseding,
        'E06 the concurrent materialization really did become current');
      await rt.actAs(one);
      const [declined] = await rt.declineFirst(randomUUID(), f.proposal, superseding);
      assert.equal(declined.declined_state, 'FIRST_DECLINED',
        'E06 the CURRENT view authorizes the same act, which is what makes the refusal meaningful');
      await asRole('postgres');
      await cleanupRace([one, two]);

      // AND THE ORDERING IS WHAT MAKES IT FAIL CLOSED. A race that only showed
      // the refusal would prove nothing about WHERE the refusal came from, so
      // the pre-fix ordering is installed - the exact-view check moved back
      // outside the serialization region - and the SAME interleaving is run
      // again. It must then accept the superseded view, which is the defect this
      // review found. The canonical definition is restored byte for byte on
      // every path, because this section is not inside a transaction.
      const pristine = await rt.captureMatchingSeam(PFN.DECLINE_FIRST);
      try {
        const entry = '  PERFORM public.enter_matching_proposal_decision_v1(p_proposal_id, u);\n';
        const check = "  PERFORM public.assert_matching_recipient_view_current_v1(p_proposal_id, u, p_expected_view_id, 'FIRST_RECIPIENT');\n";
        assert.ok(pristine.definition.includes(entry) && pristine.definition.includes(check),
          'E06 the canonical definition carries both steps, so the mutation below has something to move');
        const weakened = pristine.definition.replace(entry, '').replace(check, check + entry);
        assert.notEqual(weakened, pristine.definition, 'E06 the weakening actually changed the definition');
        assert.ok(weakened.indexOf('assert_matching_recipient_view_current_v1')
          < weakened.indexOf('enter_matching_proposal_decision_v1'),
        'E06 and it really did move the exact-view check outside the serialized region');
        await q(weakened);

        const g = await commitOffered(one, two);
        const second = randomUUID();
        await q2('BEGIN');
        await q2('SELECT public.lock_matching_pair_humans_v1($1, $2)', [g.lower, g.higher]);
        await q2('SELECT * FROM public.materialize_matching_recipient_view_core_v1($1, $2, $3, $4)',
          [second, g.proposal, one, g.conclusionForFirst]);
        await rt.actAs(one);
        const stale = rt.declineFirst(randomUUID(), g.proposal, g.firstView).then(() => null, (error) => error);
        // The SAME barrier, and here it is what makes the half deterministic: the
        // weakened order reads the view with no lock held, so T2 must not commit
        // until T1 has done that read and moved on to wait for the lock.
        assert.equal(await waitForLockWait(pid), true,
          'E06 the weakened decline read the view unlocked and is now waiting for the pair lock');
        await q2('COMMIT');
        const accepted = await stale;
        await asRole('postgres');
        assert.equal(accepted, null,
          'E06 without the ordering the superseded view really does authorize the act, so the ordering is load-bearing');
        assert.equal((await rt.proposalRow(g.proposal)).proposal_state, 'FIRST_DECLINED',
          'E06 and a transition really was committed from a view that was no longer current');
        await cleanupRace([one, two]);
      } finally {
        await asRole('postgres');
        await rt.restoreMatchingSeam(pristine);
      }
    });

    await report.section('E07 reverse-direction concurrent work does not deadlock', async () => {
      const f = await commitEligible(one, two);
      // THE STRUCTURAL HALF. The two-human lock refuses to be taken in anything
      // but canonical user-id order, so proposal direction cannot decide it -
      // which is the property that makes a cycle impossible in the first place.
      await q('BEGIN');
      await rejected(() => q('SELECT public.lock_matching_pair_humans_v1($1, $2)', [f.higher, f.lower]),
        ['22023'], /PAIR_ORDER_INVALID/u);
      await q('ROLLBACK');

      // THE LIVE HALF. Both connections do two-human work over the SAME pair
      // from opposite-looking directions. The second BLOCKS on the first rather
      // than deadlocking with it, and completes once the first commits.
      //
      // The second call is deliberately NOT awaited before the first commits: a
      // test that awaited both while holding the first transaction open would be
      // waiting for a lock only it could release, and would report its own
      // shape as a timeout.
      const before = await count(P.SNAPSHOTS, 'pair_id = $1', [f.pair]);
      await q('BEGIN'); await q2('BEGIN');
      await rt.capture(randomUUID(), f.pair, one, two);
      const blocked = q2('SELECT * FROM public.capture_matching_eligibility_snapshot_core_v1($1, $2, $3, $4)',
        [randomUUID(), f.pair, two, one]);
      await q('COMMIT');
      const outcome = await blocked.then(() => null, (error) => error);
      await q2('COMMIT').catch(() => undefined);
      if (outcome) {
        assert.notEqual(outcome.code, '40P01',
          'E07 no deadlock: the two-human lock is taken in canonical user-id order, never in proposal direction');
        assert.notEqual(outcome.code, '55P03',
          'E07 and no lock timeout once the first transaction released its locks');
        throw outcome;
      }
      assert.equal(await count(P.SNAPSHOTS, 'pair_id = $1', [f.pair]) - before, 2,
        'E07 both reverse-direction captures completed, one after the other');
      await cleanupRace([one, two]);
    });
  } finally {
    await secondary.close();
  }
}

// ------------------------------------------------------------ 6. fixtures
async function seedWorld(human, phase, lifecycle) {
  const world = randomUUID();
  await q(`INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis, closed_at)
           VALUES ($1, $2, $3, $4, CASE WHEN $2 = 'READ_ONLY_CLOSED' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
  [world, lifecycle, phase, phase === 'INTRODUCTION' ? 'MUTUAL_MATCH' : 'ACCEPTED_INVITATION']);
  await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`, [randomUUID(), world, human]);
  return world;
}

/**
 * Move one proposal's preparation instant AND its deadline into the past.
 *
 * `CURRENT_TIMESTAMP` is the TRANSACTION timestamp, so inside one transaction
 * `prepared_at` and "now" are the same instant - and `expires_at > prepared_at`
 * together with `expires_at <= now` is then unsatisfiable. Moving only the
 * deadline back produces a CHECK violation rather than an expired proposal, so
 * both instants move. The identity trigger is lifted for exactly this statement
 * because a proposal's preparation instant is frozen by design, which is the
 * property being worked around rather than tested here; the expiry boundary
 * itself takes no timestamp parameter at all, and that is what B06 proves.
 */
async function backdate(proposal) {
  await q(`ALTER TABLE ${P.PROPOSALS} DISABLE TRIGGER matching_proposals_state_truth`);
  await q(`UPDATE ${P.PROPOSALS}
              SET prepared_at = CURRENT_TIMESTAMP - interval '3 hours',
                  expires_at = CURRENT_TIMESTAMP - interval '1 hour'
            WHERE id = $1`, [proposal]);
  await q(`ALTER TABLE ${P.PROPOSALS} ENABLE TRIGGER matching_proposals_state_truth`);
  assert.equal(await rt.triggerEnabled(P.PROPOSALS, 'matching_proposals_state_truth'), true,
    'the proposal identity trigger is enabled again immediately');
}

/** Append a transition and move the pointer as the OWNER, for a state I-07B has no producer for. */
async function stepOwner(proposal, from, to) {
  const [current] = await rows(`SELECT current_transition_id id FROM ${P.PROPOSALS} WHERE id = $1`, [proposal]);
  const id = randomUUID();
  await q(`INSERT INTO ${P.TRANSITIONS}
             (id, proposal_id, prior_state, resulting_state, prior_transition_id)
           VALUES ($1, $2, $3, $4, $5)`, [id, proposal, from, to, current?.id ?? null]);
  await q(`UPDATE ${P.PROPOSALS} SET proposal_state = $2, current_transition_id = $3 WHERE id = $1`,
    [proposal, to, id]);
  return id;
}

/**
 * Two matchable humans, built through the REAL I-07A human commands rather than
 * by direct writes, so a fixture can never prove something the consent path
 * would refuse.
 *
 * It is IDEMPOTENT: a human who is already matchable keeps their identities.
 * Every I-07A command is a compare-and-swap that names the exact current state
 * it expects, so a second `activate` on an already-active human is a correct
 * `MATCHING_STALE_STATE` - and a scenario that built two pairs sharing a human,
 * or a committed race section that seeded twice, would otherwise fail on the
 * predecessor's guard rather than on anything I-07B does.
 */
async function seedMatchable(a, b, options = {}) {
  const byUser = {};
  for (const human of [a, b]) {
    await asRole('postgres');
    const [current] = await rt.setupState(human);
    if (current.matchable) {
      byUser[human] = {
        event: current.participation_event_id,
        grant: current.matching_context_grant_id,
        profile: current.introduction_profile_version_id,
        requirements: current.matching_requirement_version_id,
        authority: current.pre_match_disclosure_authority_id,
      };
      continue;
    }
    await actAs(human);
    await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY', null);
    const grant = randomUUID();
    await rt.grantContext(randomUUID(), grant, null);
    const profile = randomUUID();
    await rt.setProfile(profile, PROFILE, null);
    const requirements = randomUUID();
    await rt.setRequirements(requirements, REQUIREMENTS, null);
    const authority = randomUUID();
    await rt.grantDisclosure(randomUUID(), authority, profile, APPROVED, null);
    const [state] = await rt.setupState(human);
    byUser[human] = { event: state.participation_event_id, grant, profile, requirements, authority };
  }
  await asRole('postgres');
  // The policy pointers are one row per kind, so a second install in the same
  // state would collide on the primary key. An already-configured runtime is
  // reused, which is also what a real one looks like.
  const configured = await rows(`SELECT policy_kind, current_policy_version_id id FROM ${P.POLICY_STATE}`);
  const policy = options.reusePolicy ?? (configured.length === 5
    ? Object.fromEntries(configured.map((r) => [{
      PROPOSAL_CADENCE: 'cadence', PENDING_PROPOSAL_LIMIT: 'pending', PROPOSAL_EXPIRY: 'expiry',
      PROPOSAL_SAFE_FIELDS: 'fields', SENSITIVE_CONCLUSION_FILTER: 'filter',
    }[r.policy_kind], r.id]))
    : await rt.installPolicies({
      cadenceMax: options.cadenceMax ?? 5,
      expiryHours: options.expiryHours ?? 72,
      safeFieldKeys: APPROVED,
    }));
  const pairId = randomUUID();
  const [pair] = await rt.ensurePair(pairId, a, b);
  return { pair: pair.pair_id, lower: pair.lower_user_id, higher: pair.higher_user_id, byUser, policy };
}

async function seedEligible(a, b, options = {}) {
  const f = await seedMatchable(a, b, options);
  const snapshot = randomUUID();
  await rt.capture(snapshot, f.pair, a, b);
  await rt.evaluate(snapshot, a, 'faith_practice_level', 'PASS', 'EXPLICIT_MATCHING_ANSWER');
  await rt.evaluate(snapshot, b, 'faith_practice_level', 'PASS', 'EXPLICIT_MATCHING_ANSWER');
  return { ...f, snapshot };
}

async function permitted(snapshot, filterPolicy, forRecipient, about, text) {
  const candidateId = randomUUID();
  await rt.submitConclusion(candidateId, snapshot, forRecipient, about, text);
  const [verdict] = await rt.filterConclusion(randomUUID(), candidateId);
  assert.equal(verdict.filter_verdict, 'PERMITTED', 'the fixture conclusion is permitted by the real filter');
  return verdict.permitted_conclusion_id;
}

/** A proposal OFFERED to the first recipient, through the real boundaries. */
async function bringToOffered(first, candidate, options = {}) {
  const f = await seedEligible(first, candidate, options);
  const conclusionForFirst = await permitted(f.snapshot, f.policy.filter, first, candidate,
    `${CLEAN} A settled and unhurried outlook on both sides.`);
  const conclusionForCandidate = await permitted(f.snapshot, f.policy.filter, candidate, first,
    `${CLEAN} The same unhurried outlook, from the other side of it.`);
  const proposal = randomUUID();
  await rt.prepare(proposal, f.snapshot, first);
  const firstView = randomUUID();
  const offerCommand = randomUUID();
  await rt.offer(offerCommand, proposal, firstView, conclusionForFirst);
  return { ...f, proposal, firstView, offerCommand, conclusionForFirst, conclusionForCandidate };
}

async function bringToApproved(first, candidate, options = {}) {
  const f = await bringToOffered(first, candidate, options);
  await actAs(first);
  await rt.approveForward(randomUUID(), f.proposal, f.firstView);
  await asRole('postgres');
  return f;
}

async function bringToForwarded(first, candidate, options = {}) {
  const f = await bringToApproved(first, candidate, options);
  const secondView = randomUUID();
  await rt.forward(randomUUID(), f.proposal, secondView, f.conclusionForCandidate);
  return { ...f, secondView };
}

// The race fixtures COMMIT, because two connections cannot share one
// uncommitted transaction.
const commitEligible = (a, b, options = {}) => seedEligible(a, b, options);
const commitOffered = (a, b, options = {}) => bringToOffered(a, b, options);
const commitApproved = (a, b, options = {}) => bringToApproved(a, b, options);

async function cleanupRace(humans) {
  await asRole('postgres');
  await rt.removeCommittedProposalState(humans);
  await rt.removeCommittedPolicies();
  await rt.removeCommittedMatchingSetup(humans);
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID()];
await runVerifier('0112', async (setStage) => {
  await rt.client.connect();
  setStage('fixtures');
  await rt.provisionHumans(humans);

  setStage('posture');
  await verifyPosture();

  const report = createScenarioReport('0112', { query: q, restore: () => asRole('postgres') });
  const nameSeam = await rt.captureMatchingSeam(PFN.FIRST_NAME);
  const gateSeam = await rt.captureMatchingSeam(PFN.PREREQUISITES);
  try {
    // Both seams answer fail-closed in production and are proven to do so by the
    // 0111 verifier. A choreography verifier that only ever saw the refusal
    // would prove that I-07B refuses and nothing else, so both are replaced here
    // and restored - byte for byte - in the finally below, on every path.
    await rt.resolveFirstName({ [humans[0]]: 'Sara', [humans[1]]: 'Omar', [humans[2]]: 'Layla' });
    await rt.clearProposalPrerequisites();

    setStage('choreography');
    await verifyChoreography(report, humans);
    setStage('privacy');
    await verifyPrivacy(report, humans);
    setStage('durability');
    await verifyDurability(report, humans);
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
  assert.equal(name.resolution, 'UNRESOLVED_NO_CANONICAL_SOURCE',
    'and the canonical first-name seam is fail-closed again');
  await rt.removeCommittedProposalState(humans);
  await rt.removeCommittedPolicies();
  await rt.removeCommittedMatchingSetup(humans);
  await rt.removeFixtureHumans(humans);
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${P.PAIRS}) + (SELECT count(*) FROM ${P.PROPOSALS})
          + (SELECT count(*) FROM ${P.POLICY_STATE}) + (SELECT count(*) FROM ${P.SNAPSHOTS})
          + (SELECT count(*) FROM public.shared_worlds)
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans]);
  assert.equal(Number(residue), 0, 'every fixture this verifier committed was removed again');
}, () => rt.client.end().catch(() => undefined));
