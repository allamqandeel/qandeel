// Real-PostgreSQL verifier for migration 0117 - I-07D explicit post-Introduction
// Matching reactivation and the I-07 phase-closing forward contracts.
//
// Runs against a FULLY migrated database and proves, from live catalogs, live
// rows and live concurrent connections, that a human who has been through an
// Introduction re-enters Matching only by asking, only after every current
// truth is revalidated, only through an exact immutable lineage, and without
// reviving one single thing from before.
//
// Every fixture reaches a real terminal Introduction through the REAL I-07A,
// I-07B, I-07C and I-07D boundaries as the humans involved.
//
//   P01 posture: the record relation is sealed; the boundary is postgres-owned
//       SECURITY DEFINER, search_path-pinned and executable by no application
//       role; it derives its human from auth.uid() and accepts no user id; it
//       takes exactly a one-human lock order; it proves lineage from identity
//       rather than from time; the seam is fail-closed and LAST
//
//   R01 PAUSED / POST_INTRODUCTION reactivates to ACTIVE by explicit RESUME
//   R02 PAUSED / POST_SUCCESS reactivates to ACTIVE by explicit RESUME
//   R03 an exact OFF lineage reactivates only by explicit ACTIVATE, through one
//       of the two frozen entry channels
//   R04 the generic I-07A resume still refuses both reserved pauses, and the
//       ceiling is load-bearing
//   R05 the generic I-07A activation still refuses the OFF lineage, and that
//       ceiling is load-bearing too
//   R06 a revoked grant, an absent profile and an absent requirement version
//       each fail closed: Matching setup is preserved, never restored
//   R07 a HELD active-Introduction claim anywhere fails closed
//   R08 a currently active Introduction fails closed
//   R09 every other participation state is refused rather than forced
//   R10 the production seam is the LAST gate and refuses with ZERO effects
//   R11 reactivation revives no proposal and reopens nothing
//   R12 one exact lineage can be crossed at most once
//   R13 an equivalent retry is idempotent; a different request fails closed
//
//   F01 the I-07 phase-closing forward contracts hold on the live catalog
//
//   C10 two concurrent reactivations of one human: exactly one act
//   C11 reactivation vs a seam that changes while it waits
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createIntroductionRuntime, D, DFN, MATCH, I07D_REACTIVATION_TABLES, I07D_GUARDS, I07D_SEAM_PARAMETERS,
  I07D_RESULT_BAN, terminalIds, runVerifier, APP_ROLES, PFN,
} from './introduction-lifecycle-verifier-support.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const INVALID = ['22023'];
const CONTRADICTORY = ['P0001'];
const CONFLICT = ['23505'];
const REFUSED = ['55000'];
const STALE = ['40001'];

/** Strips `--` comment lines, so a positional assertion cannot be satisfied by prose. */
const stripComments = (source) => source.split('\n').filter((line) => !/^\s*--/u.test(line)).join('\n');

/** The error one operation raised, or null - for sections that commit as they go. */
const outcomeOf = (promise) => promise.then(() => null, (error) => error);

/** A live Introduction ended unilaterally: both humans end PAUSED / POST_INTRODUCTION. */
async function endedIntroduction(a, b) {
  const f = await rt.bringToIntroduction(a, b);
  await actAs(f.lower);
  await rt.commitEnd(terminalIds(), f.world);
  await asRole('postgres');
  return f;
}

/** A live Introduction completed by both humans: both end PAUSED / POST_SUCCESS. */
async function completedIntroduction(a, b) {
  const f = await rt.bringToSuccessApproved(a, b);
  await rt.commitSuccess(terminalIds(), f.version);
  return f;
}

// ------------------------------------------------------------------ 1. posture
async function verifyPosture() {
  await asRole('postgres');

  for (const table of I07D_REACTIVATION_TABLES) {
    const [{ rls, owner }] = await rows(
      'SELECT c.relrowsecurity rls, pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.oid = $1::regclass', [table]);
    assert.equal(rls, true, `P01 ${table} has RLS enabled`);
    assert.equal(owner, 'postgres', `P01 ${table} is postgres-owned`);
    const [{ policies }] = await rows('SELECT count(*) policies FROM pg_policy WHERE polrelid = $1::regclass', [table]);
    assert.equal(Number(policies), 0, `P01 ${table} carries zero policies`);
    for (const role of ['public', ...APP_ROLES]) {
      const [{ any_privilege }] = await rows(
        `SELECT bool_or(has_table_privilege($1, $2::regclass, p)) any_privilege
           FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) p`, [role, table]);
      assert.equal(any_privilege, false, `P01 ${role} holds no privilege on ${table}`);
    }
  }

  await rt.verifyPosture({ internal: [DFN.REACTIVATE] });
  const boundary = await rt.functionPosture(DFN.REACTIVATE);
  assert.equal(boundary.volatility, 'v', 'P01 the reactivation boundary is VOLATILE');
  assert.match(boundary.prosrc, /u uuid := auth\.uid\(\);/u,
    'P01 the reactivating human is derived from the session subject, never supplied');
  const inputs = await rt.inputParameters(DFN.REACTIVATE);
  assert.deepEqual(inputs, ['p_command_id', 'p_participation_event_id', 'p_expected_current_event_id', 'p_entry_channel'],
    'P01 the reactivation boundary accepts exactly the frozen v1 surface');
  for (const name of inputs) {
    assert.doesNotMatch(name, /user_id|actor|human|subject|on_behalf|owner|counterpart|record|claim|grant|profile|requirement|timestamp|instant|_at$|clock/u,
      `P01 the reactivation boundary must not accept ${name}: the human is auth.uid() and every truth is derived`);
  }
  for (const column of await rt.resultColumns(DFN.REACTIVATE)) {
    assert.doesNotMatch(column, I07D_RESULT_BAN, `P01 the reactivation boundary must not return ${column}`);
  }

  const body = stripComments(boundary.prosrc);
  // A ONE-HUMAN ACT: no Shared World lock and no second human's lock.
  assert.doesNotMatch(body, /shared_worlds|lock_matching_pair_humans_v1/u,
    'P01 reactivation locks no Shared World and no second human');
  assert.doesNotMatch(body, /pg_advisory|LOCK TABLE|TRUNCATE|DELETE FROM/u,
    'P01 reactivation takes only canonical row locks and deletes nothing');
  // LINEAGE IS EXACT IDENTITY, never time or a latest-record inference.
  assert.doesNotMatch(body, /ORDER BY|MAX\(|max\(|LIMIT|occurred_at >|occurred_at </u,
    'P01 eligibility is proven from exact immutable identity, never by ordering or time comparison');
  assert.match(body, /introduction_terminal_commits/u, 'P01 and from the exact I-07D terminal linkage');
  assert.match(body, /matching_match_commits/u, 'P01 composed with the exact I-07C Match/pause linkage');
  // THE CANONICAL TRUTHS ARE CONSUMED, never re-implemented.
  assert.match(body, /resolve_matching_active_introduction_v1/u,
    'P01 the canonical active-Introduction truth is consumed');
  assert.match(body, /resolve_matching_setup_state_v1/u, 'P01 and so is the canonical setup state');
  assert.doesNotMatch(body, /matching_context_consent_events|introduction_profile_field_values|matching_requirement_items/u,
    'P01 rather than re-implemented from the underlying relations');
  // IT REVIVES NO PROPOSAL AND REOPENS NOTHING.
  assert.doesNotMatch(body, /matching_proposal|matching_recipient_proposal|matching_eligibility_snapshots|matching_pairs/u,
    'P01 reactivation changes participation only');
  assert.doesNotMatch(body, /UPDATE public\.introduction_records|UPDATE public\.matching_active_introduction_claims/u,
    'P01 and reopens no Introduction and no claim');
  // THE PUBLISHED ORDER: the setup lock, the pointer, the lineage, the gate LAST.
  const at = (needle) => {
    const position = body.indexOf(needle);
    assert.ok(position >= 0, `P01 the reactivation boundary carries ${needle}`);
    return position;
  };
  const lock = at('INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)');
  const pointer = at('WHERE s.participant_user_id = u FOR UPDATE');
  const lineage = at('FROM public.introduction_terminal_commits t');
  const gate = at('resolve_matching_reactivation_prerequisites_v1');
  const write = at('INSERT INTO public.matching_participation_events');
  assert.ok(lock < pointer && pointer < lineage && lineage < gate && gate < write,
    'P01 the order is the setup lock, then the pointer, then the exact lineage, then the gate LAST, then the write');
  assert.equal(body.split('clock_timestamp()').length - 1, 1, 'P01 exactly one instant is captured');
  assert.doesNotMatch(body, /now\(\)|localtimestamp|current_timestamp|transaction_timestamp|statement_timestamp/iu,
    'P01 and no transaction clock is read at all');

  assert.equal(await rt.seamClearance('public.resolve_matching_reactivation_prerequisites_v1'), 'NOT_EVALUATED',
    'P01 the reactivation prerequisite seam is fail-closed in production');
}

// ------------------------------------------------------------ 2. reactivation
// A human who has been through an Introduction is PAUSED or OFF, and the frozen
// I-07A activation refuses both - so `seedMatchable` cannot climb them back to
// ACTIVE. Any scenario that needs a SECOND Introduction therefore builds it from
// a FRESH pair rather than reusing a human the first one left paused: reusing
// one made a scenario pass or fail on which of the two canonical user ids
// happened to sort lower, which is a coin flip rather than a proof.
async function verifyReactivation(report, humans) {
  const [one, two, three, four] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    for (const [label, build, reason] of [
      ['R01 PAUSED / POST_INTRODUCTION', endedIntroduction, 'POST_INTRODUCTION'],
      ['R02 PAUSED / POST_SUCCESS', completedIntroduction, 'POST_SUCCESS'],
    ]) {
      await report.isolated(`${label} reactivates to ACTIVE by explicit RESUME`, async () => {
        const f = await build(one, two);
        const paused = await rt.currentActOf(f.lower);
        assert.equal(paused.resulting_pause_reason, reason, `${label} the human starts in the reserved pause`);
        const command = randomUUID();
        const event = randomUUID();
        await actAs(f.lower);
        const [result] = await rt.reactivate(command, event, paused.id, null);
        await asRole('postgres');
        assert.equal(result.outcome, 'MATCHING_REACTIVATED', `${label} reactivation succeeds`);
        assert.equal(result.participation_act, 'RESUME', `${label} through an explicit RESUME`);
        assert.equal(result.participation_state, 'ACTIVE', `${label} to ACTIVE`);
        assert.equal(result.reactivated_from_record_id, f.record, `${label} naming the exact prior Introduction`);
        const now = await rt.currentActOf(f.lower);
        assert.deepEqual([now.id, now.participation_act, now.resulting_state, now.resulting_pause_reason,
          now.activation_entry_channel, now.prior_event_id],
        [event, 'RESUME', 'ACTIVE', null, null, paused.id],
        `${label} the act carries no pause reason and no entry channel, and supersedes exactly the reserved pause`);
        // The reactivation record carries the exact lineage it was authorized by.
        const recorded = await rt.reactivationOf(command);
        assert.equal(recorded.introduction_record_id, f.record, `${label} the record names the exact Introduction`);
        assert.equal(recorded.reactivation_act, 'RESUME', `${label} and the exact act`);
        const claim = (await rt.claimsOf(f.lower)).find((c) => c.introduction_record_id === f.record);
        assert.equal(recorded.released_claim_id, claim.id, `${label} and the exact released claim`);
        // The OTHER human is untouched: reactivation decides nothing about them.
        assert.equal((await rt.currentActOf(f.higher)).resulting_pause_reason, reason,
          `${label} the counterpart is exactly where the terminal transition left them`);
      });
    }

    await report.isolated('R03 an exact OFF lineage reactivates only by explicit ACTIVATE', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await rt.turnOffDuringIntroduction(f.lower);
      await actAs(f.higher);
      await rt.commitEnd(terminalIds(), f.world);
      await asRole('postgres');
      const off = await rt.currentActOf(f.lower);
      assert.equal(off.resulting_state, 'OFF', 'R03 the terminal transition left the explicit opt-out alone');
      await actAs(f.lower);
      // A RESUME shape is refused on the OFF path: an entry channel is required,
      // because an activation is a fresh entry and carries its provenance.
      await rejected(() => rt.reactivate(randomUUID(), randomUUID(), off.id, null), INVALID,
        /MATCHING_REACTIVATION_ENTRY_CHANNEL_INVALID/u);
      await rejected(() => rt.reactivate(randomUUID(), randomUUID(), off.id, 'QANDEEL_OFFER'), INVALID,
        /MATCHING_REACTIVATION_ENTRY_CHANNEL_INVALID/u);
      const event = randomUUID();
      const [result] = await rt.reactivate(randomUUID(), event, off.id, 'MANUAL_MY_WORLD_ENTRY');
      await asRole('postgres');
      assert.equal(result.participation_act, 'ACTIVATE', 'R03 the OFF path produces an explicit activation');
      const now = await rt.currentActOf(f.lower);
      assert.deepEqual([now.participation_act, now.resulting_state, now.activation_entry_channel, now.prior_event_id],
        ['ACTIVATE', 'ACTIVE', 'MANUAL_MY_WORLD_ENTRY', off.id],
        'R03 carrying one of the two frozen entry channels and superseding exactly the OFF act');
      // And an entry channel is refused on the RESUME path, for the same reason.
      const g = await completedIntroduction(three, four);
      const paused = await rt.currentActOf(g.lower);
      await actAs(g.lower);
      await rejected(() => rt.reactivate(randomUUID(), randomUUID(), paused.id, 'MANUAL_MY_WORLD_ENTRY'),
        INVALID, /MATCHING_REACTIVATION_ENTRY_CHANNEL_INVALID/u);
      await asRole('postgres');
    });

    await report.isolated('R04/R05 the two frozen I-07A ceilings still refuse, and are load-bearing', async () => {
      const f = await endedIntroduction(one, two);
      const paused = await rt.currentActOf(f.lower);
      await actAs(f.lower);
      // R04: the generic resume refuses the reserved pause.
      await rejected(() => rt.resume(randomUUID(), paused.id), REFUSED, /MATCHING_PAUSE_NOT_USER_RESUMABLE/u);
      // R05: the generic activation refuses an OFF that descends from one.
      await rt.turnOff(randomUUID(), paused.id);
      const off = await rt.currentActOf(f.lower);
      await rejected(() => rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY', off.id), REFUSED,
        /MATCHING_REACTIVATION_REQUIRES_REVALIDATION/u);
      await asRole('postgres');
      // Both ceilings are load-bearing: with the reason comparison weakened, the
      // generic resume really does lift a reserved pause. The weakening is
      // applied to the CANONICAL definition pg_get_functiondef emits, is proven
      // to have changed the text, and is restored byte for byte.
      const pristine = (await rows(
        'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
        [rt.MFN.RESUME]))[0];
      const weakened = pristine.definition.replace(
        "IF current_act.resulting_pause_reason <> 'USER_PAUSED' THEN",
        "IF current_act.resulting_pause_reason = 'NEVER_MATCHES' THEN");
      assert.notEqual(weakened, pristine.definition, 'R04 the weakening really changed the canonical text');
      await q('SAVEPOINT ceiling');
      try {
        await q(weakened);
        const g = await completedIntroduction(three, four);
        const gPaused = await rt.currentActOf(g.lower);
        await actAs(g.lower);
        const [lifted] = await rt.resume(randomUUID(), gPaused.id);
        await asRole('postgres');
        assert.equal(lifted.participation_state, 'ACTIVE',
          'R04 without the ceiling a reserved post-terminal pause really does resume, so the ceiling is load-bearing');
      } finally {
        await q('ROLLBACK TO SAVEPOINT ceiling');
        await q('RELEASE SAVEPOINT ceiling');
        await asRole('postgres');
      }
      const [restored] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [rt.MFN.RESUME]);
      assert.equal(restored.prosrc, pristine.prosrc, 'R04 the production resume path is restored byte for byte');
    });

    await report.isolated('R06 Matching setup is preserved across an Introduction, never restored by one', async () => {
      const f = await endedIntroduction(one, two);
      const paused = await rt.currentActOf(f.lower);
      // A revoked Matching Context Grant fails closed: reactivating does not
      // hand back an authority the human took away.
      await actAs(f.lower);
      await rt.revokeContext(randomUUID(), f.byUser[f.lower].grant);
      await rejected(() => rt.reactivate(randomUUID(), randomUUID(), paused.id, null), REFUSED,
        /MATCHING_REACTIVATION_NOT_ELIGIBLE/u);
      await asRole('postgres');
      assert.equal((await rt.currentActOf(f.lower)).id, paused.id, 'R06 and nothing moved');
      // Re-granting it makes the same reactivation succeed, so the gate is the
      // grant rather than anything incidental.
      await actAs(f.lower);
      await rt.grantContext(randomUUID(), randomUUID(), null);
      const [result] = await rt.reactivate(randomUUID(), randomUUID(), paused.id, null);
      await asRole('postgres');
      assert.equal(result.participation_state, 'ACTIVE', 'R06 a current grant is what the gate actually required');
      // An absent Introduction Profile and an absent requirement version fail
      // closed too, proven by removing the current pointer directly.
      const g = await endedIntroduction(three, four);
      const gPaused = await rt.currentActOf(g.lower);
      // A current pointer is durable truth: the frozen 0108 guard refuses to
      // DELETE one, for every role including the owner. That guard is exactly
      // right and is not on trial here, so it is lifted for the length of the
      // probe and put back by the rollback, which also restores the row.
      for (const [state, trigger, what] of [
        ['public.introduction_profile_state', 'introduction_profile_state_truth', 'Introduction Profile'],
        ['public.matching_requirement_state', 'matching_requirement_state_truth', 'Matching Requirements version'],
      ]) {
        await q('SAVEPOINT missing');
        await q(`ALTER TABLE ${state} DISABLE TRIGGER ${trigger}`);
        await q(`DELETE FROM ${state} WHERE owner_user_id = $1`, [g.lower]);
        await actAs(g.lower);
        await rejected(() => rt.reactivate(randomUUID(), randomUUID(), gPaused.id, null), REFUSED,
          /MATCHING_REACTIVATION_NOT_ELIGIBLE/u);
        await asRole('postgres');
        await q('ROLLBACK TO SAVEPOINT missing');
        await q('RELEASE SAVEPOINT missing');
        assert.equal(await rt.triggerEnabled(state, trigger), true,
          `R06 the frozen ${trigger} guard is enabled again immediately`);
        assert.equal(await count(state, 'owner_user_id = $1', [g.lower]), 1,
          `R06 and an absent ${what} fails closed without leaving the fixture damaged`);
      }
    });

    await report.isolated('R07/R08 a HELD claim or a live Introduction fails closed', async () => {
      // The human ends one Introduction, reactivates, and is matched again: they
      // now hold a HELD claim and a live Introduction. A second reactivation
      // attempt over the OLD lineage must fail on both counts.
      const f = await endedIntroduction(one, two);
      const paused = await rt.currentActOf(f.lower);
      await actAs(f.lower);
      await rt.reactivate(randomUUID(), randomUUID(), paused.id, null);
      await asRole('postgres');
      const g = await rt.bringToIntroduction(f.lower, three);
      assert.ok(await rt.heldClaimOf(f.lower), 'R07 the human now holds a HELD claim again');
      const live = await rt.currentActOf(f.lower);
      assert.equal(live.resulting_pause_reason, 'ACTIVE_INTRODUCTION', 'R08 and is in a live Introduction');
      await actAs(f.lower);
      await rejected(() => rt.reactivate(randomUUID(), randomUUID(), live.id, null), REFUSED,
        /MATCHING_REACTIVATION_NOT_ELIGIBLE/u);
      await asRole('postgres');
      assert.equal((await rt.currentActOf(f.lower)).id, live.id, 'R08 and nothing moved');
      assert.ok(g.record, 'R08 the live Introduction is untouched');
    });

    await report.isolated('R09 every other participation state is refused rather than forced', async () => {
      const f = await rt.bringToIntroduction(one, two);
      // ACTIVE_INTRODUCTION: the Introduction is live, so there is nothing to
      // reactivate from.
      const live = await rt.currentActOf(f.lower);
      await actAs(f.lower);
      await rejected(() => rt.reactivate(randomUUID(), randomUUID(), live.id, null), REFUSED,
        /MATCHING_REACTIVATION_NOT_ELIGIBLE/u);
      await asRole('postgres');
      // A plain USER_PAUSED, a plain ACTIVE and a SYSTEM_POLICY pause all belong
      // to their own frozen commands and are refused here.
      const g = await rt.seedMatchable(three, four);
      for (const shape of ['ACTIVE', 'USER_PAUSED', 'SYSTEM_POLICY']) {
        await q('SAVEPOINT shape');
        let current = await rt.currentActOf(three);
        if (shape === 'USER_PAUSED') {
          await actAs(three);
          await rt.pause(randomUUID(), current.id);
          await asRole('postgres');
          current = await rt.currentActOf(three);
        } else if (shape === 'SYSTEM_POLICY') {
          await rt.simulatePause(three, 'SYSTEM_POLICY', current.id);
          current = await rt.currentActOf(three);
        }
        await actAs(three);
        await rejected(() => rt.reactivate(randomUUID(), randomUUID(), current.id, null), REFUSED,
          /MATCHING_REACTIVATION_NOT_ELIGIBLE/u);
        await asRole('postgres');
        await q('ROLLBACK TO SAVEPOINT shape');
        await q('RELEASE SAVEPOINT shape');
      }
      assert.ok(g.pair, 'R09 the fixture pair exists');
      // An OFF that does NOT descend from an Introduction is refused too: this
      // boundary crosses exactly the reserved lineage and nothing else.
      const h = await rt.seedMatchable(three, four);
      await actAs(three);
      const active = await rt.currentActOf(three);
      await rt.turnOff(randomUUID(), active.id);
      const off = await rt.currentActOf(three);
      await rejected(() => rt.reactivate(randomUUID(), randomUUID(), off.id, 'MANUAL_MY_WORLD_ENTRY'), REFUSED,
        /MATCHING_REACTIVATION_NOT_ELIGIBLE/u);
      await asRole('postgres');
      assert.ok(h.pair, 'R09 and an ordinary OFF still activates through the frozen I-07A command');
    });

    await report.isolated('R10 the production seam is the LAST gate and refuses with ZERO effects', async () => {
      const f = await endedIntroduction(one, two);
      const paused = await rt.currentActOf(f.lower);
      const command = randomUUID();
      try {
        await q(`CREATE OR REPLACE FUNCTION public.resolve_matching_reactivation_prerequisites_v1(p_user_id uuid)
                 RETURNS TABLE(clearance text, basis text)
                 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $probe$
                 BEGIN
                   RETURN QUERY SELECT 'NOT_EVALUATED'::text, 'probe'::text;
                 END$probe$`);
        await actAs(f.lower);
        await rejected(() => rt.reactivate(command, randomUUID(), paused.id, null), REFUSED,
          /MATCHING_REACTIVATION_PREREQUISITE_UNRESOLVED/u);
        await asRole('postgres');
        assert.equal((await rt.currentActOf(f.lower)).id, paused.id,
          'R10 the gate is LAST and refuses with no participation effect at all');
        assert.equal(await rt.reactivationOf(command), null, 'R10 and no reactivation record');
      } finally {
        await asRole('postgres');
        await rt.clearSeam(I07D_SEAM_PARAMETERS[2]);
      }
      // With the seam cleared, the SAME command now succeeds: the seam was the
      // only thing in the way, which is what makes it the last gate.
      await actAs(f.lower);
      const [result] = await rt.reactivate(command, randomUUID(), paused.id, null);
      await asRole('postgres');
      assert.equal(result.participation_state, 'ACTIVE', 'R10 and it is the only thing in the way');
    });

    await report.isolated('R11 reactivation revives no proposal and reopens nothing', async () => {
      const f = await endedIntroduction(one, two);
      const paused = await rt.currentActOf(f.lower);
      const proposalsBefore = await rows(
        'SELECT id, proposal_state, current_transition_id FROM public.matching_proposals ORDER BY id');
      const transitionsBefore = await count('public.matching_proposal_transitions', 'TRUE', []);
      const viewsBefore = await count('public.matching_recipient_proposal_views', 'TRUE', []);
      await actAs(f.lower);
      await rt.reactivate(randomUUID(), randomUUID(), paused.id, null);
      await asRole('postgres');
      assert.deepEqual(await rows('SELECT id, proposal_state, current_transition_id FROM public.matching_proposals ORDER BY id'),
        proposalsBefore, 'R11 every proposal is in exactly the state it was: none revived, none cloned, none created');
      assert.equal(await count('public.matching_proposal_transitions', 'TRUE', []), transitionsBefore,
        'R11 no proposal transition appeared');
      assert.equal(await count('public.matching_recipient_proposal_views', 'TRUE', []), viewsBefore,
        'R11 and no recipient view pointer was restored');
      assert.equal((await rt.recordRow(f.record)).introduction_status, 'CLOSED',
        'R11 the terminal Introduction stays terminal');
      assert.equal(await count(MATCH.CLAIMS, "introduction_record_id = $1 AND claim_state = 'HELD'", [f.record]), 0,
        'R11 and its released claims stay released');
      const world = await rt.worldRow(f.world);
      assert.deepEqual([world.lifecycle, world.phase], ['READ_ONLY_CLOSED', 'INTRODUCTION'],
        'R11 the closed World is not reopened');
      assert.equal(await count(D.EPISODES, 'world_id = $1 AND ended_at IS NULL', [f.world]), 0,
        'R11 and no membership is recreated');
    });

    await report.isolated('R12/R13 one lineage is crossed at most once, and retries are exact', async () => {
      const f = await endedIntroduction(one, two);
      const paused = await rt.currentActOf(f.lower);
      const command = randomUUID();
      const event = randomUUID();
      await actAs(f.lower);
      const [first] = await rt.reactivate(command, event, paused.id, null);
      const [retry] = await rt.reactivate(command, event, paused.id, null);
      assert.deepEqual(retry, first, 'R13 an equivalent retry is answered from the committed row, byte for byte');
      // A different produced act, a different superseded act, and a different
      // human are each a different request under the same command id.
      await rejected(() => rt.reactivate(command, randomUUID(), paused.id, null), CONFLICT,
        /MATCHING_REACTIVATION_COMMAND_ID_CONFLICT/u);
      await rejected(() => rt.reactivate(command, event, randomUUID(), null), CONFLICT,
        /MATCHING_REACTIVATION_COMMAND_ID_CONFLICT/u);
      await asRole('postgres');
      await actAs(f.higher);
      await rejected(() => rt.reactivate(command, event, paused.id, null), CONFLICT,
        /MATCHING_REACTIVATION_COMMAND_ID_CONFLICT/u);
      await asRole('postgres');
      // R12: the same lineage cannot be crossed twice under a NEW command id.
      // The human pauses themselves and resumes through the ordinary path, then
      // tries to reuse the exhausted post-terminal act.
      await actAs(f.lower);
      await rejected(() => rt.reactivate(randomUUID(), randomUUID(), paused.id, null), STALE,
        /MATCHING_REACTIVATION_STALE_STATE/u);
      await asRole('postgres');
      assert.equal(await count(D.REACTIVATIONS, 'prior_participation_event_id = $1', [paused.id]), 1,
        'R12 exactly one reactivation ever crossed that exact lineage');
    });
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

// ------------------------------------------ 3. the phase-closing contracts
async function verifyForwardContracts(report) {
  await asRole('postgres');
  await report.section('F01 the I-07 phase-closing forward contracts hold on the live catalog', async () => {
    const producersOf = async (pattern) => (await rows(
      `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
        WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
          AND pr.prosrc ~ $1 ORDER BY 1`, [pattern])).map((r) => r.proname);

    // 0113 / 0114: the I-07C Match and birth semantics remain frozen.
    assert.deepEqual(await producersOf('INSERT INTO public\\.matching_match_commits'),
      ['commit_matching_mutual_match_v1'], 'F01 the frozen I-07C Match commit is still the only Match producer');
    assert.deepEqual(await producersOf('INSERT INTO public\\.introduction_records'),
      ['commit_matching_mutual_match_v1'], 'F01 and the only Introduction Record birth producer');
    assert.deepEqual(await producersOf('INSERT INTO public\\.matching_active_introduction_claims'),
      ['commit_matching_mutual_match_v1'], 'F01 and the only claim producer');

    // 0113: exactly the two reviewed terminal cores reach a terminal outcome.
    assert.deepEqual(await producersOf('UPDATE public\\.introduction_records'),
      ['commit_introduction_end_v1', 'commit_introduction_success_v1'],
      'F01 exactly the two reviewed terminal cores move an Introduction Record to a terminal state');
    assert.deepEqual(await producersOf('UPDATE public\\.matching_active_introduction_claims'),
      ['commit_introduction_end_v1', 'commit_introduction_success_v1'],
      'F01 and release an active-Introduction claim');

    // 0108 / 0109: the reserved pauses have exactly the reviewed producers, the
    // generic resume is still USER_PAUSED-only, and exactly one boundary crosses
    // a post-Introduction pause.
    assert.deepEqual(await producersOf('INSERT INTO public\\.matching_introduction_reactivation_commands'),
      ['reactivate_matching_after_introduction_v1'],
      'F01 exactly the one reviewed reactivation boundary crosses a post-Introduction pause');
    const resume = await rt.functionPosture('public.resume_matching_participation_v1(uuid, uuid)');
    assert.match(resume.prosrc, /current_act\.resulting_pause_reason <> 'USER_PAUSED'/u,
      'F01 the generic I-07A resume remains USER_PAUSED-only');
    // The QUOTED literal, because that is what a code path is: prosrc carries
    // comments, and 0109's resume explains the four reserved reasons by name.
    assert.doesNotMatch(resume.prosrc, /'POST_SUCCESS'|'POST_INTRODUCTION'|introduction_terminal_commits/u,
      'F01 and has learned no reserved pause reason or terminal linkage');
    const activate = await rt.functionPosture('public.activate_matching_participation_v1(uuid, text, uuid)');
    assert.match(activate.prosrc, /MATCHING_REACTIVATION_REQUIRES_REVALIDATION/u,
      'F01 the generic I-07A activation still refuses an OFF that descends from a pause it may not lift');
    assert.doesNotMatch(activate.prosrc, /introduction_terminal_commits|POST_SUCCESS|POST_INTRODUCTION/u,
      'F01 and has not learned the post-Introduction lineage');

    // 0089 / 0090: one disclosure producer, and one thing that destroys content.
    assert.deepEqual(await producersOf('INSERT INTO public\\.introduction_disclosure_resource_versions'),
      ['commit_introduction_progressive_disclosure_v1'],
      'F01 exactly the reviewed I-07D producer writes a disclosure resource version');
    const destroyers = await rows(
      `SELECT DISTINCT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
        WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
          AND (pr.prosrc ~ 'DELETE FROM public\\.shared_world_text_material_bodies'
            OR pr.prosrc ~ 'DELETE FROM public\\.shared_world_voice_note_material_bodies'
            OR pr.prosrc ~ 'DELETE FROM public\\.introduction_disclosure_text_payloads'
            OR pr.prosrc ~ 'DELETE FROM public\\.introduction_disclosure_media_payloads') ORDER BY 1`);
    assert.deepEqual(destroyers.map((r) => r.proname), ['delete_shared_world_owned_material_v1'],
      'F01 exactly the one canonical owner-deletion primitive destroys a body or a disclosure payload');

    // 0087 / 0088: one historical visibility entry point, and one internal reader.
    assert.equal(await rt.canExecute('service_role', DFN.VISIBILITY), true,
      'F01 service_role still executes the ONE historical visibility entry point');
    for (const role of ['public', ...APP_ROLES]) {
      assert.equal(await rt.canExecute(role, DFN.CLOSED_VISIBILITY), false,
        `F01 ${role} must not execute the internal closed reader`);
    }

    // The three I-07D seams all answer NOT_EVALUATED, and END consults none.
    for (const [name] of I07D_SEAM_PARAMETERS) {
      assert.equal(await rt.seamClearance(name), 'NOT_EVALUATED', `F01 ${name} is fail-closed`);
    }
    const ending = await rt.functionPosture(DFN.END);
    assert.doesNotMatch(ending.prosrc, /prerequisites_v1/u,
      'F01 ending an Introduction consults no prerequisite seam at all');

    // No application role executes any I-07D consequential boundary.
    const reachable = await rows(
      `SELECT pr.proname, r.rolename FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace,
            LATERAL unnest(ARRAY['anon','authenticated','service_role']) AS r(rolename)
        WHERE n.nspname = 'public'
          AND pr.proname IN ('commit_introduction_progressive_disclosure_v1',
                             'prepare_introduction_success_transition_v1',
                             'record_introduction_success_approval_core_v1',
                             'approve_introduction_success_v1',
                             'withdraw_introduction_success_approval_v1',
                             'commit_introduction_success_v1',
                             'commit_introduction_end_v1',
                             'reactivate_matching_after_introduction_v1')
          AND EXISTS (SELECT 1 FROM pg_roles ro WHERE ro.rolname = r.rolename)
          AND has_function_privilege(r.rolename, pr.oid, 'EXECUTE') ORDER BY 1, 2`);
    assert.deepEqual(reachable, [],
      'F01 no application role executes any I-07D consequential boundary before the CW2-08 Launch Gate exists');
  });
}

// ------------------------------------------------------------------ 4. races
async function verifyRaces(report, humans) {
  const [one, two] = humans;
  const extra = await rt.openExtra();
  const { qx, actAsX } = extra;
  const waitExtra = () => rt.waitForLockWait(q, extra.pid);
  const reactivateX = (command, event, expected, channel = null) =>
    qx('SELECT * FROM public.reactivate_matching_after_introduction_v1($1,$2,$3,$4)',
      [command, event, expected, channel]);
  const noDeadlock = (error, label) => {
    if (!error) return;
    assert.notEqual(error.code, '40P01', `${label} no deadlock`);
    assert.notEqual(error.code, '55P03', `${label} no lock timeout`);
  };

  try {
    await report.section('C10 two concurrent reactivations of one human produce exactly one act', async () => {
      const f = await endedIntroduction(one, two);
      const paused = await rt.currentActOf(f.lower);
      const actsBefore = await count(D.ACTS, 'participant_user_id = $1', [f.lower]);
      await q('BEGIN');
      await actAs(f.lower);
      await rt.reactivate(randomUUID(), randomUUID(), paused.id, null);
      await actAsX(f.lower);
      const contender = outcomeOf(reactivateX(randomUUID(), randomUUID(), paused.id, null));
      assert.equal(await waitExtra(), true,
        'C10 the second reactivation is observably waiting on the setup lock the first holds');
      await q('COMMIT');
      const outcome = await contender;
      await asRole('postgres');
      noDeadlock(outcome, 'C10');
      assert.ok(outcome, 'C10 exactly one reactivation may cross one lineage');
      assert.match(String(outcome.message), /MATCHING_REACTIVATION_STALE_STATE/u,
        'C10 and the loser is refused as stale rather than forking the chain');
      assert.equal(await count(D.ACTS, 'participant_user_id = $1', [f.lower]), actsBefore + 1,
        'C10 exactly one participation act was appended');
      assert.equal((await rt.currentActOf(f.lower)).resulting_state, 'ACTIVE', 'C10 and the human is ACTIVE once');
      assert.equal(await count(D.REACTIVATIONS, 'participant_user_id = $1', [f.lower]), 1,
        'C10 with exactly one reactivation record');
      await rt.cleanupIntroductionRace([one, two]);
    });

    await report.section('C11 a seam that changes while a reactivation waits is read at decision time', async () => {
      const f = await endedIntroduction(one, two);
      const paused = await rt.currentActOf(f.lower);
      // The main connection holds the caller's setup lock; the reactivation
      // waits behind it. While it waits, the seam is restored to its production
      // fail-closed answer - and because the gate is read AFTER the wait, the
      // reactivation observes the CURRENT answer rather than a settled one.
      await q('BEGIN');
      await q('INSERT INTO public.matching_setup_locks AS l (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at',
        [f.lower]);
      await actAsX(f.lower);
      const contender = outcomeOf(reactivateX(randomUUID(), randomUUID(), paused.id, null));
      assert.equal(await waitExtra(), true, 'C11 the reactivation is observably waiting on the setup lock');
      try {
        await q(`CREATE OR REPLACE FUNCTION public.resolve_matching_reactivation_prerequisites_v1(p_user_id uuid)
                 RETURNS TABLE(clearance text, basis text)
                 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $probe$
                 BEGIN
                   RETURN QUERY SELECT 'NOT_EVALUATED'::text, 'probe'::text;
                 END$probe$`);
        await q('COMMIT');
        const outcome = await contender;
        noDeadlock(outcome, 'C11');
        assert.ok(outcome, 'C11 the reactivation reads the seam at decision time, not at transaction start');
        assert.match(String(outcome.message), /MATCHING_REACTIVATION_PREREQUISITE_UNRESOLVED/u,
          'C11 so a prerequisite that became unresolved while it waited fails it closed');
      } finally {
        await asRole('postgres');
        await rt.clearSeam(I07D_SEAM_PARAMETERS[2]);
      }
      assert.equal((await rt.currentActOf(f.lower)).id, paused.id, 'C11 and nothing moved');
      await rt.cleanupIntroductionRace([one, two]);
    });
  } finally {
    await extra.close();
    await asRole('postgres');
  }
}

// ------------------------------------------------------------------ the run
//
// FOUR humans, not three: a scenario that needs a SECOND Introduction builds it
// from a fresh pair, because the first one leaves both of its humans paused and
// the frozen I-07A activation refuses to climb either back to ACTIVE.
const humans = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
await runVerifier('0117', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '30s'");
  setStage('fixtures');
  await rt.provisionHumans(humans);

  setStage('posture');
  await verifyPosture();

  const report = createScenarioReport('0117', { query: q, restore: () => asRole('postgres') });
  const seams = [];
  for (const fn of [PFN.FIRST_NAME, PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE]) {
    seams.push(await rt.captureMatchingSeam(fn));
  }
  try {
    await rt.resolveFirstName({
      [humans[0]]: 'Sara', [humans[1]]: 'Omar', [humans[2]]: 'Layla', [humans[3]]: 'Adam',
    });
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();

    setStage('reactivation');
    await verifyReactivation(report, humans);
    setStage('races');
    await verifyRaces(report, humans);
  } finally {
    await asRole('postgres');
    for (const seam of seams) await rt.restoreMatchingSeam(seam);
  }

  // The forward contracts are asserted with every seam back at its PRODUCTION
  // definition, because "production stays fail-closed" is exactly what they say.
  setStage('forward contracts');
  await verifyForwardContracts(report);

  report.print();
  report.assertAllPassed();

  setStage('teardown');
  await asRole('postgres');
  for (const [table, trigger] of I07D_GUARDS) {
    assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} is enabled at the end of the run`);
  }
  await rt.cleanupIntroductionRace(humans);
  await rt.removeFixtureHumans(humans);
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${D.REACTIVATIONS}) + (SELECT count(*) FROM ${D.TERMINAL})
          + (SELECT count(*) FROM ${MATCH.RECORDS}) + (SELECT count(*) FROM ${MATCH.CLAIMS})
          + (SELECT count(*) FROM public.shared_worlds WHERE birth_basis = 'MUTUAL_MATCH')
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans]);
  assert.equal(Number(residue), 0, 'every fixture this verifier committed was removed again');
}, () => rt.client.end().catch(() => undefined));
