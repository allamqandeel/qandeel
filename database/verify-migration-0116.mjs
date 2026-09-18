// Real-PostgreSQL verifier for migration 0116 - I-07D Introduction terminal
// lifecycle.
//
// Runs against a FULLY migrated database and proves, from live catalogs, live
// rows and live concurrent connections, that an ACTIVE / INTRODUCTION Shared
// World has exactly ONE terminal winner, that a successful Introduction needs
// both humans and an unsuccessful one needs only one, that an exit can never be
// gated, that every terminal effect happens at one instant or not at all, and
// that Matching participation moves exactly as CW2-06 froze it and no further.
//
// Every fixture reaches a live Introduction through the REAL I-07A, I-07B and
// I-07C boundaries as the humans involved. Every seam replaced for the run is
// restored byte for byte on every path.
//
//   P01 posture: the seven relations are sealed; the one-winner key is a UNIQUE
//       index rather than a comparison; every consequential primitive is
//       postgres-owned, search_path-pinned and executable by no application
//       role; the human acts derive auth.uid() and accept no actor; the success
//       commit derives no actor and manufactures no approval; the END core
//       consults no seam at all; both cores take the published lock order and
//       read exactly one clock; the live producer censuses hold
//
//   S01 the success transition version is the exact fixed World/Record payload
//   S02 one human's approval alone cannot complete
//   S03 the other human's approval alone cannot complete
//   S04 both current approvals allow exactly one completion, at ONE instant
//   S05 a withdrawn approval blocks completion, in either direction
//   S07 an approval of a DIFFERENT version can never contribute
//   S08 no system caller can fabricate a human approval
//   S09 the World id, the history and both open episodes survive
//   S12 exactly one INTRODUCTION_COMPLETED fact, and no INTRODUCTION_ENDED
//   S13 both HELD claims become RELEASED
//   S14 both ACTIVE_INTRODUCTION pauses become POST_SUCCESS
//   S15 a human who explicitly turned Matching OFF stays OFF
//   S16 no closed-view entitlement is created
//   S18 an existing Standard capability becomes available after the transition
//   S19 the production seam blocks with ZERO terminal effects
//   S20 no relationship, engagement, exclusivity or marriage status is created
//
//   E01 either exact matched human ends unilaterally, with no counterpart act
//   E02 an outsider cannot end, and reaches the same bounded class
//   E04 END is NOT blocked by the production system/safety seam
//   E05 the World becomes READ_ONLY_CLOSED / INTRODUCTION at one instant
//   E08 both episodes close WORLD_CLOSED, and none stays open
//   E09 each human gets their OWN exact closed-view entitlement snapshot
//   E10 an entitlement may legitimately contain zero items
//   E13 both ACTIVE_INTRODUCTION pauses become POST_INTRODUCTION
//   E15 ordinary World mutation is blocked after closure
//   E16 owner privacy deletion remains possible, and narrows the closed view
//   E17 no Standing Context Grant or history grant is manufactured
//   E18 no Standard WORLD_ENDED fact is fabricated
//
//   T01 the terminal winner is structural: a second terminal cannot be written
//   T02 an equivalent terminal retry answers from the committed row, forever
//   T03 the same command id naming a different request fails closed
//
//   K01 SUCCESS continuity: Introduction history reads on as Standard history
//   K02 a later Standard World end never reactivates Matching
//
//   G01 NO GHOST (SUCCESS) and G02 NO GHOST (END)
//
//   C01..C09 real two-connection races, each pinned with a lock-wait barrier
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createIntroductionRuntime, D, DFN, MATCH, I07D_TERMINAL_TABLES, I07D_GUARDS, I07D_SEAM_PARAMETERS,
  I07D_RESULT_BAN, TERMINAL_OUTCOMES, APPROVAL_ACTS, POST_TERMINAL_REASONS,
  terminalIds, disclosureIds, runVerifier, APP_ROLES, PFN,
} from './introduction-lifecycle-verifier-support.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const INVALID = ['22023'];
const UNAVAILABLE = ['P0002'];
const CONTRADICTORY = ['P0001'];
const CONFLICT = ['23505'];
const REFUSED = ['55000'];
const STALE = ['40001'];

/** Strips `--` comment lines, so a positional assertion cannot be satisfied by prose. */
const stripComments = (source) => source.split('\n').filter((line) => !/^\s*--/u.test(line)).join('\n');

/** The error one operation raised, or null - for sections that commit as they go. */
const outcomeOf = (promise) => promise.then(() => null, (error) => error);

/** An expected refusal, asserted WITHOUT a savepoint, for sections in autocommit. */
async function refused(operation, code, message) {
  const error = await outcomeOf(operation());
  assert.ok(error, 'operation unexpectedly succeeded');
  assert.equal(error.code, code, `unexpected rejection code ${error.code}: ${error.message}`);
  assert.match(String(error.message), message);
  return error;
}

/** Nothing terminal happened: every semantic cardinality is the pre-terminal one. */
const UNTOUCHED = Object.freeze({
  terminals: 0, completed: 0, ended: 0, releasedClaims: 0, heldClaims: 2,
  openEpisodes: 2, closedEpisodes: 0, entitlements: 0, standardEnded: 0,
});

/** A completed Introduction: same World, same episodes, nothing closed. */
const COMPLETED = Object.freeze({
  terminals: 1, completed: 1, ended: 0, releasedClaims: 2, heldClaims: 0,
  openEpisodes: 2, closedEpisodes: 0, entitlements: 0, standardEnded: 0,
});

/** An ended Introduction: archived World, both episodes closed, both frozen views. */
const CLOSED = Object.freeze({
  terminals: 1, completed: 0, ended: 1, releasedClaims: 2, heldClaims: 0,
  openEpisodes: 0, closedEpisodes: 2, entitlements: 2, standardEnded: 0,
});

// ------------------------------------------------------------------ 1. posture
async function verifyPosture() {
  await asRole('postgres');

  for (const table of I07D_TERMINAL_TABLES) {
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
    // NO RELATIONSHIP, ENGAGEMENT, EXCLUSIVITY OR MARRIAGE VOCABULARY, anywhere.
    const [{ inferred }] = await rows(
      `SELECT count(*) inferred FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND ('public.' || c.table_name) = $1
          AND c.column_name ~* '(relationship|engagement|marriage|married|fiance|spouse|exclusiv|boyfriend|girlfriend|partner_status|legal_status)'`,
      [table]);
    assert.equal(Number(inferred), 0, `P01 ${table} encodes no relationship or legal status`);
  }

  // THE ONE WINNER IS A UNIQUE KEY, not a procedural comparison.
  const [winner] = await rows(
    `SELECT pg_get_constraintdef(c.oid) definition FROM pg_constraint c
      WHERE c.conrelid = $1::regclass AND c.conname = 'introduction_terminal_commits_record_key'`, [D.TERMINAL]);
  assert.equal(winner?.definition, 'UNIQUE (introduction_record_id)',
    'P01 one Introduction Record has at most one terminal commit, by unique key');

  // EVERY CONSEQUENTIAL PRIMITIVE is internal and pinned.
  const boundaries = [DFN.PREPARE_SUCCESS, DFN.APPROVAL_CORE, DFN.APPROVE, DFN.WITHDRAW, DFN.SUCCESS, DFN.END];
  await rt.verifyPosture({ internal: boundaries });
  for (const fn of boundaries) {
    const p = await rt.functionPosture(fn);
    assert.equal(p.volatility, 'v', `P01 ${fn} mutates or locks and is VOLATILE`);
    assert.doesNotMatch(p.prosrc, /matching_context_grants|pre_match_disclosure|introduction_profile|matching_requirement/u,
      `P01 ${fn} depends on no Matching setup authority: the Shared World is independent after the Match`);
    assert.doesNotMatch(p.prosrc, /relationship|engagement|marriage|exclusiv/u,
      `P01 ${fn} infers no relationship or legal status`);
    for (const column of await rt.resultColumns(fn)) {
      assert.doesNotMatch(column, I07D_RESULT_BAN, `P01 ${fn} must not return ${column}`);
    }
  }

  // THE HUMAN ACTS derive their human and accept no actor.
  for (const fn of [DFN.APPROVAL_CORE, DFN.END]) {
    const p = await rt.functionPosture(fn);
    assert.match(p.prosrc, /u uuid := auth\.uid\(\);/u, `P01 ${fn} derives its human from the session subject`);
    for (const name of await rt.inputParameters(fn)) {
      assert.doesNotMatch(name, /user_id|actor|human|approver|counterpart|recipient|owner|subject|on_behalf|timestamp|instant|_at$|clock/u,
        `P01 ${fn} must not accept ${name}: the acting human is auth.uid()`);
    }
  }

  // THE SUCCESS COMMIT is system execution and never consent manufacture.
  const success = await rt.functionPosture(DFN.SUCCESS);
  assert.doesNotMatch(success.prosrc, /auth\.uid/u,
    'P01 the success commit derives no actor: the authority IS the exact pair of current human approvals');
  assert.doesNotMatch(success.prosrc, /INSERT INTO public\.introduction_success_approval_events|UPDATE public\.introduction_success_approval_state/u,
    'P01 system execution never manufactures or moves a human approval');
  assert.match(success.prosrc, /e\.resulting_state = 'APPROVED'/u,
    'P01 only a CURRENT approval counts');
  assert.doesNotMatch(success.prosrc, /closed_at|READ_ONLY_CLOSED|WORLD_CLOSED|introduction_closed_view_entitlement|shared_world_ended_events/u,
    'P01 a successful Introduction closes nothing');

  // THE END CORE consults no seam at all: a human must always be able to leave.
  const ending = await rt.functionPosture(DFN.END);
  assert.doesNotMatch(ending.prosrc, /prerequisite|clearance|CLEARED|NOT_EVALUATED|launch|safety/u,
    'P01 ending an Introduction depends on no system, safety or launch clearance');
  assert.doesNotMatch(ending.prosrc, /introduction_success_approval|introduction_success_transition_versions/u,
    'P01 a unilateral end requires no counterpart approval and reads no success transition state');
  assert.doesNotMatch(ending.prosrc, /shared_world_ended_events|shared_world_standard_end_commands/u,
    'P01 an Introduction END never fabricates a Standard WORLD_ENDED fact');
  assert.doesNotMatch(ending.prosrc, /shared_world_standard_closed_view_entitlement/u,
    'P01 a failed Introduction freezes its OWN entitlement family, never the Standard one');

  // BOTH TERMINAL CORES take the published cross-domain lock order and read one clock.
  for (const fn of [DFN.SUCCESS, DFN.END]) {
    const body = stripComments((await rt.functionPosture(fn)).prosrc);
    const at = (needle) => {
      const position = body.indexOf(needle);
      assert.ok(position >= 0, `P01 ${fn} carries ${needle}`);
      return position;
    };
    const world = at('FROM public.shared_worlds w WHERE w.id = ');
    const record = at('FROM public.introduction_records r');
    const pair = at('PERFORM public.lock_matching_pair_humans_v1(lo, hi)');
    const episodes = at('ORDER BY e.id FOR UPDATE');
    const pointers = at('ORDER BY s.participant_user_id FOR UPDATE');
    const clock = at('terminal_instant := clock_timestamp()');
    const write = at('INSERT INTO public.introduction_terminal_commits');
    assert.ok(world < record && record < pair && pair < episodes && episodes < pointers
      && pointers < clock && clock < write,
    `P01 ${fn} takes the World, the exact Record, BOTH setup locks in canonical order, the episodes, the pointers, one instant, then the terminal commit last`);
    assert.equal(body.split('clock_timestamp()').length - 1, 1, `P01 ${fn} captures exactly one instant`);
    assert.doesNotMatch(body, /now\(\)|localtimestamp|current_timestamp|transaction_timestamp|statement_timestamp/iu,
      `P01 ${fn} reads no transaction clock: a settled clock predates the lock wait it must decide after`);
    assert.doesNotMatch(body, /INSERT INTO public\.matching_setup_locks/u,
      `P01 ${fn} reaches both setup locks only through the frozen canonical two-human helper`);
    assert.doesNotMatch(body, /pg_advisory|LOCK TABLE|DELETE FROM|TRUNCATE/u,
      `P01 ${fn} takes no advisory lock, no table lock, and deletes nothing`);
    assert.match(body, /current_act\.resulting_state = 'OFF'/u, `P01 ${fn} leaves an explicitly OFF human OFF`);
  }

  // THE SEAM answers NOT_EVALUATED, and the I-07A resume ceiling is untouched.
  assert.equal(await rt.seamClearance('public.resolve_introduction_success_prerequisites_v1'), 'NOT_EVALUATED',
    'P01 the success prerequisite seam is fail-closed in production');
  const resume = await rt.functionPosture('public.resume_matching_participation_v1(uuid, uuid)');
  assert.match(resume.prosrc, /current_act\.resulting_pause_reason <> 'USER_PAUSED'/u,
    'P01 the generic I-07A resume is still USER_PAUSED-only');
  // The QUOTED literal, because that is what a code path is: prosrc carries
  // comments, and 0109's resume explains the four reserved reasons by name in
  // its own ceiling comment.
  assert.doesNotMatch(resume.prosrc, /'POST_SUCCESS'|'POST_INTRODUCTION'|'ACTIVE_INTRODUCTION'/u,
    'P01 and has learned no reserved pause reason');

  // EXACT LIVE PRODUCER OWNERSHIP of the five previously producerless states.
  const producersOf = async (pattern) => (await rows(
    `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
        AND pr.prosrc ~ $1 ORDER BY 1`, [pattern])).map((r) => r.proname);
  assert.deepEqual(await producersOf('UPDATE public\\.introduction_records'),
    ['commit_introduction_end_v1', 'commit_introduction_success_v1'],
    'P01 exactly the two reviewed terminal cores move an Introduction Record to a terminal state');
  assert.deepEqual(await producersOf('UPDATE public\\.matching_active_introduction_claims'),
    ['commit_introduction_end_v1', 'commit_introduction_success_v1'],
    'P01 exactly the two reviewed terminal cores release an active-Introduction claim');
  assert.deepEqual(await producersOf('INSERT INTO public\\.introduction_terminal_commits'),
    ['commit_introduction_end_v1', 'commit_introduction_success_v1'],
    'P01 exactly the two reviewed terminal cores write a terminal commit');
  // The census names the VALUES shape that WRITES a reserved pause, not every
  // function that mentions one: the reactivation boundary reads a POST_* reason
  // to decide eligibility and writes an ACTIVE act, which is exactly what it
  // should do. A predicate that could not tell producing from reading would
  // convict it for doing its job.
  const posters = await rows(
    `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
        AND pr.prosrc ~ 'INSERT INTO public\\.matching_participation_events'
        AND pr.prosrc ~ '''PAUSED'', ''POST_(SUCCESS|INTRODUCTION)''' ORDER BY 1`);
  assert.deepEqual(posters.map((r) => r.proname), ['commit_introduction_end_v1', 'commit_introduction_success_v1'],
    'P01 exactly the two reviewed terminal cores WRITE a reserved post-terminal pause');
  const readers = await rows(
    `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
        AND pr.prosrc ~ 'INSERT INTO public\\.matching_participation_events'
        AND (pr.prosrc ~ '''POST_SUCCESS''' OR pr.prosrc ~ '''POST_INTRODUCTION''') ORDER BY 1`);
  assert.deepEqual(readers.map((r) => r.proname),
    ['commit_introduction_end_v1', 'commit_introduction_success_v1', 'reactivate_matching_after_introduction_v1'],
    'P01 and the only other function that names one at all is the reviewed reactivation boundary, which reads it');
  // And the frozen I-07C birth producer is still the only one.
  assert.deepEqual(await producersOf('INSERT INTO public\\.matching_match_commits'),
    ['commit_matching_mutual_match_v1'], 'P01 the frozen I-07C Match commit is untouched');

  // THE FROZEN VOCABULARIES are exactly what CW2-03 and CW2-06 freeze.
  const definitionOf = async (table, name) => (await rows(
    'SELECT pg_get_constraintdef(c.oid) definition FROM pg_constraint c WHERE c.conrelid = $1::regclass AND c.conname = $2',
    [table, name]))[0]?.definition ?? '';
  const outcomes = await definitionOf(D.TERMINAL, 'introduction_terminal_commits_outcome_check');
  for (const outcome of TERMINAL_OUTCOMES) assert.ok(outcomes.includes(`'${outcome}'`), `P01 ${outcome} is representable`);
  assert.equal((outcomes.match(/'[A-Z_]+'/gu) ?? []).length, TERMINAL_OUTCOMES.length,
    'P01 and the terminal vocabulary is exactly those two');
  const acts = await definitionOf(D.APPROVALS, 'introduction_success_approval_events_act_check');
  for (const act of APPROVAL_ACTS) assert.ok(acts.includes(`'${act}'`), `P01 ${act} is representable`);
}

// ------------------------------------------------------------------- 2. success
async function verifySuccess(report, humans) {
  const [one, two, three] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('S01 the success transition version is the exact fixed World/Record payload', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const version = randomUUID();
      const [prepared] = await rt.prepareSuccess(version, f.world);
      assert.equal(prepared.outcome, 'SUCCESS_TRANSITION_PREPARED', 'S01 a transition is proposed');
      assert.equal(prepared.prepared_introduction_record_id, f.record, 'S01 bound to the exact Introduction Record');
      assert.equal(prepared.prepared_required_approver_count, 2, 'S01 deriving exactly the two matched humans');
      const [row] = await rows(`SELECT * FROM ${D.TRANSITIONS} v WHERE v.id = $1`, [version]);
      assert.deepEqual([row.from_lifecycle, row.from_phase, row.to_lifecycle, row.to_phase],
        ['ACTIVE', 'INTRODUCTION', 'ACTIVE', 'STANDARD'],
        'S01 and the payload is the fixed ACTIVE / INTRODUCTION to ACTIVE / STANDARD mutation');
      const required = (await rows(
        `SELECT approver_user_id FROM ${D.REQUIRED} WHERE transition_version_id = $1 ORDER BY 1`, [version]))
        .map((r) => r.approver_user_id);
      assert.deepEqual(required, [f.lower, f.higher].sort(), 'S01 the required set is exactly the matched pair');
      // A proposal is not authority: nothing moved.
      assert.deepEqual(await rt.terminalEffects(f.record, f.world), UNTOUCHED,
        'S01 proposing reserves nothing and changes nothing');
      // Only the two matched humans may ever act on it, structurally.
      await actAs(three);
      await rejected(() => rt.approveSuccess(randomUUID(), version, null), UNAVAILABLE,
        /INTRODUCTION_SUCCESS_NOT_AVAILABLE/u);
      await asRole('postgres');
    });

    await report.isolated('S02/S03 one human approval alone cannot complete, in either direction', async () => {
      const f = await rt.bringToSuccessProposed(one, two);
      for (const [approver, label] of [[f.lower, 'the lower human'], [f.higher, 'the higher human']]) {
        await actAs(approver);
        await rt.approveSuccess(randomUUID(), f.version, null);
        await asRole('postgres');
        await rejected(() => rt.commitSuccess(terminalIds(), f.version), REFUSED,
          /INTRODUCTION_SUCCESS_APPROVALS_INCOMPLETE/u);
        assert.deepEqual(await rt.terminalEffects(f.record, f.world), UNTOUCHED,
          `S02 ${label} approving alone completes nothing and leaves everything as it was`);
        // Undo this half so the other direction is proven independently.
        const state = await rt.approvalStateOf(f.version, approver);
        await actAs(approver);
        await rt.withdrawSuccess(randomUUID(), f.version, state.current_event_id);
        await asRole('postgres');
      }
    });

    await report.isolated('S04 both current approvals allow exactly one completion, at ONE instant', async () => {
      const f = await rt.bringToSuccessApproved(one, two);
      const ids = terminalIds();
      const [result] = await rt.commitSuccess(ids, f.version);
      assert.equal(result.outcome, 'INTRODUCTION_COMPLETED', 'S04 the transition completes');
      assert.equal(result.terminal_result, 'COMPLETED', 'S04 with the exact terminal outcome');
      assert.equal(result.released_claim_count, 2, 'S04 releasing both claims');
      assert.equal(result.participation_transition_count, 2, 'S04 and moving both paused humans');
      assert.deepEqual(await rt.terminalEffects(f.record, f.world), COMPLETED,
        'S04 exactly one of everything, and nothing closed');
      const coherence = await rt.terminalInstantCoherence(f.record);
      assert.equal(coherence.coherent, true,
        'S04 every effect of the one terminal event carries the ONE database-owned instant');
      // A second completion cannot exist.
      await rejected(() => rt.commitSuccess(terminalIds(), f.version), REFUSED,
        /INTRODUCTION_TERMINAL_ALREADY_SETTLED/u);
      assert.deepEqual(await rt.terminalEffects(f.record, f.world), COMPLETED, 'S04 and changed nothing');
    });

    await report.isolated('S05 a withdrawn approval blocks completion, in either direction', async () => {
      const f = await rt.bringToSuccessApproved(one, two);
      for (const withdrawer of [f.lower, f.higher]) {
        const state = await rt.approvalStateOf(f.version, withdrawer);
        assert.equal(state.resulting_state, 'APPROVED', 'S05 this human currently approves');
        await actAs(withdrawer);
        const [withdrawn] = await rt.withdrawSuccess(randomUUID(), f.version, state.current_event_id);
        await asRole('postgres');
        assert.equal(withdrawn.approval_state, 'WITHDRAWN', 'S05 and withdraws it before commit');
        await rejected(() => rt.commitSuccess(terminalIds(), f.version), REFUSED,
          /INTRODUCTION_SUCCESS_APPROVALS_INCOMPLETE/u);
        assert.deepEqual(await rt.terminalEffects(f.record, f.world), UNTOUCHED,
          'S05 a stale approval cannot complete anything');
        // The act history survives the withdrawal: it is superseded, not erased.
        assert.equal(await count(D.APPROVALS, 'transition_version_id = $1 AND approver_user_id = $2',
          [f.version, withdrawer]), 2, 'S05 both acts remain in the immutable chain');
        // Changing one human's approval never touched the other's.
        const other = withdrawer === f.lower ? f.higher : f.lower;
        assert.equal((await rt.approvalStateOf(f.version, other)).resulting_state, 'APPROVED',
          'S05 and the other human is untouched');
        // Re-approve so the second direction starts from both approvals again.
        const again = await rt.approvalStateOf(f.version, withdrawer);
        await actAs(withdrawer);
        await rt.approveSuccess(randomUUID(), f.version, again.current_event_id);
        await asRole('postgres');
      }
    });

    await report.isolated('S07 an approval of a DIFFERENT version can never contribute', async () => {
      const f = await rt.bringToSuccessApproved(one, two);
      // A second proposal over the same Introduction. Both humans approved the
      // FIRST one; the second has no approval at all.
      const other = randomUUID();
      await rt.prepareSuccess(other, f.world);
      await rejected(() => rt.commitSuccess(terminalIds(), other), REFUSED,
        /INTRODUCTION_SUCCESS_APPROVALS_INCOMPLETE/u);
      assert.equal(await count(D.APPROVAL_STATE, 'transition_version_id = $1', [other]), 0,
        'S07 an approval binds its exact version and cannot be seen from another');
      // And an approval row for a human the version does not require is
      // unrepresentable, however it is produced.
      await rejected(() => q(`INSERT INTO ${D.APPROVALS}
                                (id, transition_version_id, approver_user_id, approval_act, resulting_state, occurred_at)
                              VALUES ($1, $2, $3, 'APPROVE', 'APPROVED', clock_timestamp())`,
        [randomUUID(), other, three]), ['23503'], /required_fk/u);
      // The first version still completes, because ITS approvals are current.
      const [result] = await rt.commitSuccess(terminalIds(), f.version);
      assert.equal(result.terminal_result, 'COMPLETED', 'S07 the exact approved version is the one that commits');
    });

    await report.isolated('S08 no system caller can fabricate a human approval', async () => {
      const f = await rt.bringToSuccessProposed(one, two);
      // The approval boundary has no actor parameter at all, and an
      // unauthenticated session cannot act.
      await actAs(null);
      await rejected(() => rt.approveSuccess(randomUUID(), f.version, null), ['42501'],
        /INTRODUCTION_SUCCESS_AUTHENTICATION_REQUIRED/u);
      await asRole('postgres');
      // The success commit itself writes no approval: with none recorded, it
      // refuses rather than supplying its own.
      await rejected(() => rt.commitSuccess(terminalIds(), f.version), REFUSED,
        /INTRODUCTION_SUCCESS_APPROVALS_INCOMPLETE/u);
      assert.equal(await count(D.APPROVALS, 'transition_version_id = $1', [f.version]), 0,
        'S08 and recorded nothing in passing');
    });

    await report.isolated('S09/S12/S13/S14/S16 the exact committed shape of a completed Introduction', async () => {
      const f = await rt.bringToSuccessApproved(one, two);
      const beforeEpisodes = (await rt.episodesOf(f.world)).map((e) => e.id).sort();
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      const ended = terminalIds();
      await rt.commitSuccess(ended, f.version);
      const world = await rt.worldRow(f.world);
      assert.deepEqual([world.lifecycle, world.phase, world.closed_at], ['ACTIVE', 'STANDARD', null],
        'S09 the SAME World is now ACTIVE / STANDARD and unclosed');
      assert.equal(world.birth_basis, 'MUTUAL_MATCH', 'S09 its birth basis is untouched');
      assert.deepEqual((await rt.episodesOf(f.world)).map((e) => e.id).sort(), beforeEpisodes,
        'S10 the SAME two membership episodes survive, by identity');
      assert.equal(await count(D.EPISODES, 'world_id = $1 AND ended_at IS NULL', [f.world]), 2,
        'S10 and both are still open');
      assert.equal((await rt.recordRow(f.record)).introduction_status, 'COMPLETED', 'S11 the Record is COMPLETED');
      assert.equal(await count(D.COMPLETED, 'introduction_record_id = $1', [f.record]), 1,
        'S12 exactly one INTRODUCTION_COMPLETED fact');
      assert.equal(await count(D.ENDED, 'introduction_record_id = $1', [f.record]), 0,
        'S12 and no INTRODUCTION_ENDED fact: an Introduction has ONE terminal outcome');
      assert.equal(await count(MATCH.CLAIMS, "introduction_record_id = $1 AND claim_state = 'RELEASED'", [f.record]), 2,
        'S13 both HELD claims became RELEASED');
      for (const human of [f.lower, f.higher]) {
        const act = await rt.currentActOf(human);
        assert.deepEqual([act.participation_act, act.resulting_state, act.resulting_pause_reason],
          ['PAUSE', 'PAUSED', 'POST_SUCCESS'], 'S14 each still-paused human is now PAUSED / POST_SUCCESS');
        assert.equal(await rt.heldClaimOf(human), null, 'S13 and holds no claim');
      }
      assert.equal(await count(D.ENTITLEMENTS, 'world_id = $1', [f.world]), 0,
        'S16 no closed-view entitlement is created: nothing closed');
      // S17: the Introduction-period history reads on under Standard semantics.
      assert.deepEqual((await rt.visibility(f.world, f.higher)).map((r) => r.history_item_id), [ids.item],
        'S17 the Introduction-period disclosure is still visible, now under Standard history semantics');
      assert.equal((await rt.resolveDisclosure(f.world, f.higher)).length, 1,
        'S17 and the disclosure resolver still renders it without a second rule');
    });

    await report.isolated('S15 a human who explicitly turned Matching OFF stays OFF', async () => {
      const f = await rt.bringToSuccessApproved(one, two);
      await rt.turnOffDuringIntroduction(f.higher);
      const [result] = await rt.commitSuccess(terminalIds(), f.version);
      assert.equal(result.participation_transition_count, 1, 'S15 exactly one human is transitioned');
      assert.equal((await rt.currentActOf(f.lower)).resulting_pause_reason, 'POST_SUCCESS',
        'S15 the still-paused human moves to POST_SUCCESS');
      const off = await rt.currentActOf(f.higher);
      assert.equal(off.resulting_state, 'OFF', 'S15 and the explicitly OFF human is left exactly as they are');
      assert.equal(off.participation_act, 'TURN_OFF', 'S15 carrying their own act, not a manufactured system pause');
      const terminal = await rt.terminalRow(f.record);
      const offEvent = f.higher === terminal.lower_user_id
        ? terminal.lower_participation_event_id : terminal.higher_participation_event_id;
      assert.equal(offEvent, null, 'S15 and the terminal commit records no act for them');
      assert.deepEqual(await rt.terminalEffects(f.record, f.world), COMPLETED,
        'S15 while every other terminal effect is exactly as it should be');
    });

    await report.isolated('S18 an existing Standard capability becomes available after the transition', async () => {
      const f = await rt.bringToSuccessApproved(one, two);
      // The frozen I-04C Standard voluntary leave refuses a non-STANDARD World
      // with its own bounded class. It is an EXISTING capability; nothing new is
      // implemented here, and it is the cheapest honest proof that the World is
      // genuinely Standard rather than carrying a changed phase string.
      const leave = (world) =>
        rows('SELECT * FROM public.commit_shared_world_standard_voluntary_leave_v1($1,$2,$3)',
          [randomUUID(), world, randomUUID()]);
      await actAs(f.lower);
      await rejected(() => leave(f.world), UNAVAILABLE, /SHARED_WORLD_VOLUNTARY_LEAVE_NOT_AVAILABLE/u);
      await asRole('postgres');
      await rt.commitSuccess(terminalIds(), f.version);
      await actAs(f.lower);
      const [left] = await leave(f.world);
      await asRole('postgres');
      assert.equal(left.end_reason, 'VOLUNTARY_LEAVE',
        'S18 the same frozen Standard capability that refused before the transition succeeds after it');
      assert.equal(await count(D.EPISODES, 'world_id = $1 AND ended_at IS NULL', [f.world]), 1,
        'S18 and really did move Standard membership');
    });

    await report.isolated('S19 the production seam blocks with ZERO terminal effects', async () => {
      const f = await rt.bringToSuccessApproved(one, two);
      try {
        await q(`CREATE OR REPLACE FUNCTION public.resolve_introduction_success_prerequisites_v1(p_introduction_record_id uuid)
                 RETURNS TABLE(clearance text, basis text)
                 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $probe$
                 BEGIN
                   RETURN QUERY SELECT 'NOT_EVALUATED'::text, 'probe'::text;
                 END$probe$`);
        await rejected(() => rt.commitSuccess(terminalIds(), f.version), REFUSED,
          /INTRODUCTION_SUCCESS_PREREQUISITE_UNRESOLVED/u);
        assert.deepEqual(await rt.terminalEffects(f.record, f.world), UNTOUCHED,
          'S19 the gate is LAST and refuses with no terminal effect at all, after both approvals passed');
      } finally {
        await rt.clearSeam(I07D_SEAM_PARAMETERS[1]);
      }
    });

    await report.isolated('S20 no relationship, engagement, exclusivity or marriage status is created', async () => {
      const f = await rt.bringToSuccessApproved(one, two);
      await rt.commitSuccess(terminalIds(), f.version);
      const [{ inferred }] = await rows(
        `SELECT count(*) inferred FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.column_name ~* '(relationship_status|engagement_status|marriage_status|exclusive_status|legal_status|spouse|fiance)'`);
      assert.equal(Number(inferred), 0,
        'S20 no column anywhere in the database encodes a relationship, engagement, marriage or legal status');
      const fact = (await rows(`SELECT * FROM ${D.COMPLETED} ev WHERE ev.introduction_record_id = $1`, [f.record]))[0];
      assert.deepEqual(Object.keys(fact).sort(),
        ['introduction_record_id', 'occurred_at', 'success_transition_version_id', 'world_id'],
        'S20 the INTRODUCTION_COMPLETED fact carries identity and time only');
    });
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

// ----------------------------------------------------------------------- 3. end
async function verifyEnd(report, humans) {
  const [one, two, three] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('E01/E03 either exact matched human ends unilaterally, with no counterpart act', async () => {
      for (const which of ['lower', 'higher']) {
        await q('SAVEPOINT either_human');
        const f = await rt.bringToIntroduction(one, two);
        const actor = f[which];
        await actAs(actor);
        const [result] = await rt.commitEnd(terminalIds(), f.world);
        await asRole('postgres');
        assert.equal(result.outcome, 'INTRODUCTION_ENDED', `E01 ${which} ends the Introduction alone`);
        assert.equal((await rows(`SELECT actor_user_id FROM ${D.ENDED} WHERE introduction_record_id = $1`, [f.record]))[0].actor_user_id,
          actor, 'E01 and the fact names the exact ending human');
        assert.equal(await count(D.TRANSITIONS, 'introduction_record_id = $1', [f.record]), 0,
          'E03 no success transition was ever proposed, so no counterpart approval was required or consulted');
        assert.deepEqual(await rt.terminalEffects(f.record, f.world), CLOSED, 'E01 with the exact committed shape');
        await q('ROLLBACK TO SAVEPOINT either_human');
        await q('RELEASE SAVEPOINT either_human');
      }
    });

    await report.isolated('E02 an outsider cannot end, and reaches the same bounded class', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await actAs(three);
      await rejected(() => rt.commitEnd(terminalIds(), f.world), UNAVAILABLE, /INTRODUCTION_END_NOT_AVAILABLE/u);
      // A World that does not exist reaches the SAME class, so ending is not an
      // existence oracle for a human who is not in it.
      await rejected(() => rt.commitEnd(terminalIds(), randomUUID()), UNAVAILABLE, /INTRODUCTION_END_NOT_AVAILABLE/u);
      await actAs(null);
      await rejected(() => rt.commitEnd(terminalIds(), f.world), ['42501'], /INTRODUCTION_END_AUTHENTICATION_REQUIRED/u);
      await asRole('postgres');
      assert.deepEqual(await rt.terminalEffects(f.record, f.world), UNTOUCHED, 'E02 and nothing moved');
    });

    await report.isolated('E04 END is NOT blocked by the production system/safety seam', async () => {
      const f = await rt.bringToIntroduction(one, two);
      // Every I-07D seam is restored to its PRODUCTION fail-closed answer for
      // this probe. Disclosure and SUCCESS would refuse; an exit must not.
      try {
        for (const [name, parameter] of I07D_SEAM_PARAMETERS) {
          await q(`CREATE OR REPLACE FUNCTION ${name}(${parameter} uuid)
                   RETURNS TABLE(clearance text, basis text)
                   LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $probe$
                   BEGIN
                     RETURN QUERY SELECT 'NOT_EVALUATED'::text, 'probe'::text;
                   END$probe$`);
        }
        await actAs(f.lower);
        const [result] = await rt.commitEnd(terminalIds(), f.world);
        await asRole('postgres');
        assert.equal(result.outcome, 'INTRODUCTION_ENDED',
          'E04 a human can always leave, whatever the system/safety prerequisite answers');
        assert.deepEqual(await rt.terminalEffects(f.record, f.world), CLOSED, 'E04 completely and atomically');
      } finally {
        await asRole('postgres');
        await rt.clearAllSeams();
      }
    });

    await report.isolated('E05/E08/E13/E18 the exact committed shape of an ended Introduction', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await actAs(f.lower);
      await rt.commitEnd(terminalIds(), f.world);
      await asRole('postgres');
      const world = await rt.worldRow(f.world);
      assert.deepEqual([world.lifecycle, world.phase], ['READ_ONLY_CLOSED', 'INTRODUCTION'],
        'E05 the SAME World is archived and keeps its INTRODUCTION phase');
      assert.ok(world.closed_at, 'E05 carrying a closure instant');
      assert.equal((await rt.recordRow(f.record)).introduction_status, 'CLOSED', 'E06 the Record is CLOSED');
      assert.equal(await count(D.ENDED, 'introduction_record_id = $1', [f.record]), 1,
        'E07 exactly one INTRODUCTION_ENDED fact');
      assert.equal(await count(D.COMPLETED, 'introduction_record_id = $1', [f.record]), 0,
        'E07 and no INTRODUCTION_COMPLETED fact');
      assert.equal(await count(D.EPISODES, "world_id = $1 AND end_reason = 'WORLD_CLOSED'", [f.world]), 2,
        'E08 both episodes close with WORLD_CLOSED');
      assert.equal(await count(D.EPISODES, 'world_id = $1 AND ended_at IS NULL', [f.world]), 0,
        'E11 and no active membership survives closure');
      assert.equal(await count(MATCH.CLAIMS, "introduction_record_id = $1 AND claim_state = 'RELEASED'", [f.record]), 2,
        'E12 both claims are released');
      for (const human of [f.lower, f.higher]) {
        assert.equal((await rt.currentActOf(human)).resulting_pause_reason, 'POST_INTRODUCTION',
          'E13 each still-paused human is now PAUSED / POST_INTRODUCTION');
      }
      assert.equal(await count('public.shared_world_ended_events', 'world_id = $1', [f.world]), 0,
        'E18 no Standard WORLD_ENDED fact is fabricated for an Introduction END');
      assert.equal(await count('public.shared_world_standard_closed_view_entitlements', 'world_id = $1', [f.world]), 0,
        'E18 and no Standard closed-view entitlement either');
      const coherence = await rt.terminalInstantCoherence(f.record);
      assert.equal(coherence.coherent, true,
        'E05 every effect of the one terminal event carries the ONE database-owned instant');
    });

    await report.isolated('E09/E10 each human gets their OWN exact closed-view entitlement snapshot', async () => {
      const f = await rt.bringToIntroduction(one, two);
      // Two DIFFERENT visible sets: one item both can see, and one item only the
      // lower human is in the baseline audience of.
      const shared = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      const privateItem = randomUUID();
      await q(`INSERT INTO ${D.ITEMS} (id, world_id, occurred_at, authority_requirement_mode,
                                       availability_state, availability_revision, registered_at)
               VALUES ($1, $2, clock_timestamp(), 'NO_HUMAN_APPROVAL_REQUIRED', 'AVAILABLE', 1, clock_timestamp())`,
        [privateItem, f.world]);
      await q(`INSERT INTO ${D.VIEWERS} (history_item_id, user_id) VALUES ($1, $2)`, [privateItem, f.lower]);
      const lowerBefore = (await rt.visibility(f.world, f.lower)).map((r) => r.history_item_id).sort();
      const higherBefore = (await rt.visibility(f.world, f.higher)).map((r) => r.history_item_id).sort();
      assert.notDeepEqual(lowerBefore, higherBefore, 'E09 the two humans really do see different sets');
      await actAs(f.higher);
      await rt.commitEnd(terminalIds(), f.world);
      await asRole('postgres');
      assert.deepEqual(await rt.entitlementItemsOf(f.world, f.lower), lowerBefore,
        'E09 each human is frozen with exactly what they could see immediately before closure');
      assert.deepEqual(await rt.entitlementItemsOf(f.world, f.higher), higherBefore,
        'E09 and the other with exactly theirs');
      assert.deepEqual((await rt.visibility(f.world, f.higher)).map((r) => r.history_item_id), higherBefore,
        'E09 the closed view reads back exactly the frozen set through the ONE entry point');
      assert.ok(!(await rt.visibility(f.world, f.higher)).some((r) => r.history_item_id === privateItem),
        'E09 and nobody sees an item they could not see immediately before closure');
      // A LATER item cannot widen a frozen entitlement.
      const later = randomUUID();
      await q(`INSERT INTO ${D.ITEMS} (id, world_id, occurred_at, authority_requirement_mode,
                                       availability_state, availability_revision, registered_at)
               VALUES ($1, $2, clock_timestamp(), 'NO_HUMAN_APPROVAL_REQUIRED', 'AVAILABLE', 1, clock_timestamp())`,
        [later, f.world]);
      await q(`INSERT INTO ${D.VIEWERS} (history_item_id, user_id) VALUES ($1, $2)`, [later, f.higher]);
      assert.deepEqual((await rt.visibility(f.world, f.higher)).map((r) => r.history_item_id), higherBefore,
        'E09 a row written after closure can never widen a frozen entitlement');
      assert.ok(shared.ids.item, 'E09 the disclosure this Introduction produced is part of the frozen truth');
    });

    await report.isolated('E10 an entitlement may legitimately contain zero items', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await actAs(f.lower);
      await rt.commitEnd(terminalIds(), f.world);
      await asRole('postgres');
      for (const human of [f.lower, f.higher]) {
        assert.ok(await rt.entitlementOf(f.world, human), 'E10 each matched human holds an entitlement');
        assert.deepEqual(await rt.entitlementItemsOf(f.world, human), [],
          'E10 and it legitimately carries zero items when there was nothing to see');
        assert.deepEqual(await rt.visibility(f.world, human), [], 'E10 which reads back as a truthful empty view');
      }
      assert.equal(await count(D.ENTITLEMENTS, 'world_id = $1', [f.world]), 2,
        'E10 exactly two entitlements exist, and none for anybody else');
    });

    await report.isolated('E15/E16/E17 after closure: no ordinary mutation, but privacy still works', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const kept = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      const doomed = await rt.discloseAs(f.lower, f.world, 'CONTACT_METHOD', { text: '+20 100 000 0000' });
      await actAs(f.lower);
      await rt.commitEnd(terminalIds(), f.world);
      // E15: an ordinary Shared mutation is refused on an archived World.
      await rejected(() => rt.discloseText(disclosureIds(), f.world, 'FULL_NAME', 'Sara Kamel'),
        UNAVAILABLE, /INTRODUCTION_DISCLOSURE_NOT_AVAILABLE/u);
      // E16: the owner's privacy deletion still works, and narrows the frozen view.
      const [deleted] = await rt.deleteMaterial(randomUUID(), f.world, doomed.ids.material, randomUUID());
      await asRole('postgres');
      assert.equal(deleted.outcome, 'MATERIAL_DELETED', 'E16 owner privacy deletion remains possible after closure');
      assert.equal(await rt.textPayload(doomed.ids.version), null, 'E16 and really destroys the payload');
      assert.deepEqual((await rt.visibility(f.world, f.higher)).map((r) => r.history_item_id), [kept.ids.item],
        'E16 a frozen entitlement can never preserve deleted content: availability still dominates');
      assert.equal(await count(D.ENTITLEMENT_ITEMS, 'world_id = $1 AND history_item_id = $2',
        [f.world, doomed.ids.item]), 1,
      'E16 while the entitlement itself is untouched history: what changed is availability, not the snapshot');
      // E17: no Standing Context Grant and no history grant was manufactured.
      assert.equal(await count('public.shared_world_standing_context_grants', 'world_id = $1', [f.world]), 0,
        'E17 closing an Introduction manufactures no Standing Context Grant');
      assert.equal(await count('public.shared_world_history_access_grants', 'world_id = $1', [f.world]), 0,
        'E17 and no history access grant: a closed view is entitlement, not a grant');
      // And the World lifecycle was never reopened by the privacy mutation.
      const world = await rt.worldRow(f.world);
      assert.deepEqual([world.lifecycle, world.phase], ['READ_ONLY_CLOSED', 'INTRODUCTION'],
        'E16 a privacy mutation reopens nothing');
    });
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

// -------------------------------------------- 4. one winner, retry, continuity
async function verifyWinnerAndContinuity(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('T01 the terminal winner is structural: a second terminal cannot be written', async () => {
      const f = await rt.bringToSuccessApproved(one, two);
      await rt.commitSuccess(terminalIds(), f.version);
      // The Product status refuses a second move, the one-winner key refuses a
      // second commit row, and neither depends on the other.
      await rejected(() => q(`UPDATE ${MATCH.RECORDS} SET introduction_status = 'CLOSED' WHERE id = $1`, [f.record]),
        REFUSED, /INTRODUCTION_RECORD_TRANSITION_INVALID/u);
      const terminal = await rt.terminalRow(f.record);
      // The committed instant is read as TEXT and handed back as text: a
      // timestamptz that travelled through JavaScript would become a Date with
      // MILLISECOND precision, and every microsecond of clock_timestamp() would
      // be silently truncated - which would make the truth guard below refuse
      // for the wrong reason and prove nothing.
      const [{ committed }] = await rows(
        `SELECT t.committed_at::text AS committed FROM ${D.TERMINAL} t WHERE t.id = $1`, [terminal.id]);
      /**
       * A second terminal commit row, written directly. Each probe violates
       * exactly ONE intended invariant: the DUPLICATE names the same outcome and
       * the same instant, so every truth check passes and only the one-winner key
       * can refuse it; the HYBRID names the other outcome, so the truth guard
       * refuses it before any key is reached.
       */
      const second = (outcome) => q(`INSERT INTO ${D.TERMINAL}
          (id, introduction_record_id, world_id, match_commit_id, terminal_outcome,
           lower_user_id, higher_user_id, ending_actor_user_id, success_transition_version_id,
           lower_claim_id, higher_claim_id, lower_participation_event_id, higher_participation_event_id,
           request_ref, committed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7,
                CASE WHEN $5 = 'CLOSED' THEN $6 ELSE NULL END,
                CASE WHEN $5 = 'COMPLETED' THEN $8::uuid ELSE NULL END,
                $9, $10, $11, $12, 'sha256:' || repeat('a', 64), $13::timestamptz)`,
      [randomUUID(), f.record, f.world, f.matchCommit, outcome, terminal.lower_user_id, terminal.higher_user_id,
        f.version, terminal.lower_claim_id, terminal.higher_claim_id,
        terminal.lower_participation_event_id, terminal.higher_participation_event_id, committed]);
      await rejected(() => second('COMPLETED'), CONFLICT,
        /introduction_terminal_commits_record_key|introduction_terminal_commits_world_key/u);
      await rejected(() => second('CLOSED'), REFUSED, /INTRODUCTION_TERMINAL_RECORD_INCOHERENT/u);
      // And the terminal commit itself is durable history in both directions.
      await rejected(() => q(`UPDATE ${D.TERMINAL} SET terminal_outcome = 'CLOSED' WHERE id = $1`, [terminal.id]),
        REFUSED, /INTRODUCTION_TERMINAL_RECORD_IS_DURABLE/u);
      await rejected(() => q(`DELETE FROM ${D.TERMINAL} WHERE id = $1`, [terminal.id]),
        REFUSED, /INTRODUCTION_TERMINAL_RECORD_IS_DURABLE/u);
      // THE KEY IS LOAD-BEARING, not decorative: with it suspended the duplicate
      // that every truth check accepts really does get written, which is exactly
      // what the key exists to stop.
      await q('SAVEPOINT winner');
      await q(`ALTER TABLE ${D.TERMINAL} DROP CONSTRAINT introduction_terminal_commits_record_key`);
      await q(`ALTER TABLE ${D.TERMINAL} DROP CONSTRAINT introduction_terminal_commits_world_key`);
      await second('COMPLETED');
      assert.equal(await count(D.TERMINAL, 'introduction_record_id = $1', [f.record]), 2,
        'T01 without the one-winner key a second terminal commit really is writable, so the key is load-bearing');
      await q('ROLLBACK TO SAVEPOINT winner');
      await q('RELEASE SAVEPOINT winner');
      const [{ present }] = await rows(
        `SELECT count(*)::int present FROM pg_constraint c
          WHERE c.conrelid = $1::regclass
            AND c.conname IN ('introduction_terminal_commits_record_key','introduction_terminal_commits_world_key')`,
        [D.TERMINAL]);
      assert.equal(present, 2, 'T01 both one-winner keys are restored immediately');
      assert.equal(await count(D.TERMINAL, 'introduction_record_id = $1', [f.record]), 1,
        'T01 and exactly one terminal outcome survives');
    });

    await report.isolated('T02/T03 terminal idempotency answers from committed history, forever', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const ids = terminalIds();
      await actAs(f.lower);
      const [first] = await rt.commitEnd(ids, f.world);
      const [retry] = await rt.commitEnd(ids, f.world);
      assert.deepEqual(retry, first, 'T02 an equivalent retry answers from the committed row, byte for byte');
      // The same command id naming a different request fails closed.
      await rejected(() => rt.commitEnd({ ...ids, lowerAct: randomUUID() }, f.world),
        CONFLICT, /INTRODUCTION_TERMINAL_COMMAND_ID_CONFLICT/u);
      await rejected(() => rt.commitEnd(ids, randomUUID()), CONFLICT, /INTRODUCTION_TERMINAL_COMMAND_ID_CONFLICT/u);
      await actAs(f.higher);
      await rejected(() => rt.commitEnd(ids, f.world), CONFLICT, /INTRODUCTION_TERMINAL_COMMAND_ID_CONFLICT/u);
      await asRole('postgres');
      // And a retry AFTER the World has moved on still answers the original
      // terminal result rather than re-reading live state.
      await q(`UPDATE ${D.ITEMS} SET availability_state = 'UNAVAILABLE', availability_revision = availability_revision + 1
                WHERE world_id = $1`, [f.world]);
      await actAs(f.lower);
      const [later] = await rt.commitEnd(ids, f.world);
      await asRole('postgres');
      assert.deepEqual(later, first, 'T02 a retry after later changes still answers the original terminal result');
    });

    await report.isolated('K01/K02 SUCCESS continuity, and a later Standard end never reactivates Matching', async () => {
      const f = await rt.bringToSuccessApproved(one, two);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      await rt.commitSuccess(terminalIds(), f.version);
      // K01: the Introduction-period history is ordinary Standard history now.
      assert.deepEqual((await rt.visibility(f.world, f.higher)).map((r) => r.history_item_id), [ids.item],
        'K01 the Introduction-period item reads on under Standard semantics, with no re-authorship');
      const material = await rt.materialRow(ids.material);
      assert.equal(material.author_user_id, f.lower, 'K01 authorship is unchanged');
      const item = await rt.itemRow(ids.item);
      assert.equal(item.availability_revision, 1, 'K01 and no retrospective time or availability rewrite happened');
      // K02: the humans are POST_SUCCESS. A later Standard World closure must
      // not touch that. The frozen I-04F closure needs unanimous governance,
      // which this two-human World cannot reach inside a verifier without
      // re-implementing I-04D, so the Standard closure is applied directly in
      // exactly the shape 0088 commits it - and what is proven is that NOTHING
      // in the Matching domain reacts to it.
      const before = await Promise.all([f.lower, f.higher].map((h) => rt.currentActOf(h)));
      const actsBefore = await count(D.ACTS, 'participant_user_id = ANY($1::uuid[])', [[f.lower, f.higher]]);
      const proposalsBefore = await rows(
        'SELECT id, proposal_state FROM public.matching_proposals ORDER BY id');
      await q(`UPDATE ${D.WORLDS} SET lifecycle = 'READ_ONLY_CLOSED', closed_at = clock_timestamp() WHERE id = $1`, [f.world]);
      await q(`UPDATE ${D.EPISODES} SET ended_at = clock_timestamp(), end_reason = 'WORLD_CLOSED'
                WHERE world_id = $1 AND ended_at IS NULL`, [f.world]);
      const after = await Promise.all([f.lower, f.higher].map((h) => rt.currentActOf(h)));
      assert.deepEqual(after.map((a) => a.id), before.map((a) => a.id),
        'K02 closing the Standard World later moved no participation pointer');
      assert.deepEqual(after.map((a) => a.resulting_pause_reason), ['POST_SUCCESS', 'POST_SUCCESS'],
        'K02 both humans are still exactly where the terminal transition left them');
      assert.equal(await count(D.ACTS, 'participant_user_id = ANY($1::uuid[])', [[f.lower, f.higher]]), actsBefore,
        'K02 and no RESUME or ACTIVATE act appeared');
      assert.equal(await count(D.REACTIVATIONS, 'participant_user_id = ANY($1::uuid[])', [[f.lower, f.higher]]), 0,
        'K02 nothing reactivated Matching');
      assert.deepEqual(await rows('SELECT id, proposal_state FROM public.matching_proposals ORDER BY id'),
        proposalsBefore, 'K02 and every proposal is in exactly the state it was: none revived, none created');
    });
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

// -------------------------------------------------------------- 5. no ghost
async function verifyNoGhost(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    for (const [label, build, run] of [
      ['G01 SUCCESS', (a, b) => rt.bringToSuccessApproved(a, b), (f) => rt.commitSuccess(terminalIds(), f.version)],
      ['G02 END', (a, b) => rt.bringToIntroduction(a, b), async (f) => {
        await actAs(f.lower);
        try { return await rt.commitEnd(terminalIds(), f.world); } finally { await asRole('postgres'); }
      }],
    ]) {
      await report.isolated(`${label} NO GHOST: a late transactional failure leaves ZERO surviving effects`, async () => {
        const f = await build(one, two);
        const before = {
          world: await rt.worldRow(f.world),
          acts: await Promise.all([f.lower, f.higher].map((h) => rt.currentActOf(h))),
        };
        // A verifier-local trigger on the LAST write of the transaction. Every
        // other effect - the lifecycle move, the record transition, the fact,
        // the claim releases, the entitlement snapshot and both participation
        // acts - is already in place when it fires.
        await q(`CREATE FUNCTION public.qandeel_i07d_terminal_ghost_v1() RETURNS trigger
                 LANGUAGE plpgsql AS $probe$
                 BEGIN
                   RAISE EXCEPTION 'I07D_TERMINAL_GHOST' USING ERRCODE='P0001';
                 END$probe$`);
        await q(`CREATE TRIGGER qandeel_i07d_terminal_ghost BEFORE INSERT ON ${D.TERMINAL}
                 FOR EACH ROW EXECUTE FUNCTION public.qandeel_i07d_terminal_ghost_v1()`);
        try {
          await rejected(() => run(f), CONTRADICTORY, /I07D_TERMINAL_GHOST/u);
          await asRole('postgres');
          assert.deepEqual(await rt.terminalEffects(f.record, f.world), UNTOUCHED,
            `${label} no terminal commit, no fact, no claim release, no entitlement and no episode closure survives`);
          assert.equal((await rt.recordRow(f.record)).introduction_status, 'ACTIVE',
            `${label} the Introduction Record is still ACTIVE`);
          const world = await rt.worldRow(f.world);
          assert.deepEqual([world.lifecycle, world.phase, world.closed_at],
            [before.world.lifecycle, before.world.phase, before.world.closed_at],
            `${label} the World is exactly as it was`);
          const acts = await Promise.all([f.lower, f.higher].map((h) => rt.currentActOf(h)));
          assert.deepEqual(acts.map((a) => a.id), before.acts.map((a) => a.id),
            `${label} and both humans are still on their prior participation act`);
        } finally {
          await asRole('postgres');
          await q(`DROP TRIGGER IF EXISTS qandeel_i07d_terminal_ghost ON ${D.TERMINAL}`);
          await q('DROP FUNCTION IF EXISTS public.qandeel_i07d_terminal_ghost_v1()');
        }
        // The probe was the only thing in the way.
        const [result] = await run(f);
        assert.ok(['INTRODUCTION_COMPLETED', 'INTRODUCTION_ENDED'].includes(result.outcome),
          `${label} and the same request then commits everything`);
      });
    }
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

// ------------------------------------------------------------------ 6. races
//
// Real concurrency needs COMMITTED state on two connections, so this section
// commits its fixtures and removes them afterwards. Every race pins its
// interleaving with the lock-wait barrier: the primary is never released until
// the competitor is OBSERVABLY waiting for a lock the primary holds.
async function verifyRaces(report, humans) {
  const [one, two] = humans;
  const extra = await rt.openExtra();
  const { qx, actAsX } = extra;
  const waitExtra = () => rt.waitForLockWait(q, extra.pid);
  const noDeadlock = (error, label) => {
    if (!error) return;
    assert.notEqual(error.code, '40P01', `${label} no deadlock: every lock is taken in one canonical order`);
    assert.notEqual(error.code, '55P03', `${label} no lock timeout`);
  };
  const endX = (ids, world) => qx('SELECT * FROM public.commit_introduction_end_v1($1,$2,$3,$4)',
    [ids.command, world, ids.lowerAct, ids.higherAct]);
  const successX = (ids, version) => qx('SELECT * FROM public.commit_introduction_success_v1($1,$2,$3,$4)',
    [ids.command, version, ids.lowerAct, ids.higherAct]);
  const discloseX = (ids, world, text) => qx(
    'SELECT * FROM public.commit_introduction_progressive_disclosure_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [ids.command, world, ids.version, ids.material, ids.item, ids.event, 'FULL_NAME', null, text, null]);

  try {
    await report.section('C01 SUCCESS vs END: exactly one commits, and there is no hybrid', async () => {
      // END wins the World lock first; SUCCESS waits behind it and must observe
      // a settled Introduction.
      const f = await rt.bringToSuccessApproved(one, two);
      await q('BEGIN');
      await actAs(f.lower);
      await rt.commitEnd(terminalIds(), f.world);
      const contender = outcomeOf(successX(terminalIds(), f.version));
      assert.equal(await waitExtra(), true, 'C01 the success commit is observably waiting on the World lock END holds');
      await q('COMMIT');
      const outcome = await contender;
      await asRole('postgres');
      noDeadlock(outcome, 'C01');
      assert.ok(outcome, 'C01 exactly one terminal outcome may commit: the loser is refused');
      assert.match(String(outcome.message), /INTRODUCTION_TERMINAL_ALREADY_SETTLED/u,
        'C01 and is told only that the Introduction is settled');
      assert.deepEqual(await rt.terminalEffects(f.record, f.world), CLOSED, 'C01 END won, completely and alone');
      await rt.cleanupIntroductionRace([one, two]);
    });

    await report.section('C01b SUCCESS vs END the other way: SUCCESS wins and END is refused', async () => {
      const f = await rt.bringToSuccessApproved(one, two);
      await q('BEGIN');
      await rt.commitSuccess(terminalIds(), f.version);
      await actAsX(f.higher);
      const contender = outcomeOf(endX(terminalIds(), f.world));
      assert.equal(await waitExtra(), true, 'C01b the end command is observably waiting on the World lock SUCCESS holds');
      await q('COMMIT');
      const outcome = await contender;
      await asRole('postgres');
      noDeadlock(outcome, 'C01b');
      assert.ok(outcome, 'C01b exactly one terminal outcome may commit');
      assert.match(String(outcome.message), /INTRODUCTION_TERMINAL_ALREADY_SETTLED/u, 'C01b with the same bounded class');
      assert.deepEqual(await rt.terminalEffects(f.record, f.world), COMPLETED, 'C01b SUCCESS won, completely and alone');
      await rt.cleanupIntroductionRace([one, two]);
    });

    await report.section('C02 END by A vs END by B: exactly one terminal commit and one fact', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await q('BEGIN');
      await actAs(f.lower);
      await rt.commitEnd(terminalIds(), f.world);
      await actAsX(f.higher);
      const contender = outcomeOf(endX(terminalIds(), f.world));
      assert.equal(await waitExtra(), true, 'C02 the second human is observably waiting on the World lock');
      await q('COMMIT');
      const outcome = await contender;
      await asRole('postgres');
      noDeadlock(outcome, 'C02');
      assert.ok(outcome, 'C02 the loser is refused');
      assert.match(String(outcome.message), /INTRODUCTION_TERMINAL_ALREADY_SETTLED/u,
        'C02 with a bounded already-terminal class that does not disclose who won');
      assert.doesNotMatch(String(outcome.message), new RegExp(`${f.lower}|${f.higher}`, 'u'),
        'C02 and names neither human');
      assert.deepEqual(await rt.terminalEffects(f.record, f.world), CLOSED, 'C02 exactly one closure happened');
      assert.equal((await rows(`SELECT actor_user_id FROM ${D.ENDED} WHERE introduction_record_id = $1`, [f.record]))[0].actor_user_id,
        f.lower, 'C02 attributed to the human whose transaction committed');
      await rt.cleanupIntroductionRace([one, two]);
    });

    await report.section('C03 success commit vs approval withdrawal, pinned both ways', async () => {
      // The withdrawal wins the World lock: the success commit then observes a
      // missing current approval and cannot commit.
      const f = await rt.bringToSuccessApproved(one, two);
      const state = await rt.approvalStateOf(f.version, f.lower);
      await q('BEGIN');
      await actAs(f.lower);
      await rt.withdrawSuccess(randomUUID(), f.version, state.current_event_id);
      const contender = outcomeOf(successX(terminalIds(), f.version));
      assert.equal(await waitExtra(), true, 'C03 the success commit is observably waiting on the World lock');
      await q('COMMIT');
      const outcome = await contender;
      await asRole('postgres');
      noDeadlock(outcome, 'C03');
      assert.ok(outcome, 'C03 a withdrawal that wins makes the success commit fail');
      assert.match(String(outcome.message), /INTRODUCTION_SUCCESS_APPROVALS_INCOMPLETE/u, 'C03 for the exact reason');
      assert.deepEqual(await rt.terminalEffects(f.record, f.world), UNTOUCHED, 'C03 and nothing terminal happened');

      // The other way: the success commit wins, and a withdrawal that waited
      // behind it observes a settled Introduction and writes no effective act.
      await actAs(f.lower);
      const again = await rt.approvalStateOf(f.version, f.lower);
      await rt.approveSuccess(randomUUID(), f.version, again.current_event_id);
      await asRole('postgres');
      const current = await rt.approvalStateOf(f.version, f.lower);
      await q('BEGIN');
      await rt.commitSuccess(terminalIds(), f.version);
      await actAsX(f.lower);
      const late = outcomeOf(qx('SELECT * FROM public.withdraw_introduction_success_approval_v1($1,$2,$3)',
        [randomUUID(), f.version, current.current_event_id]));
      assert.equal(await waitExtra(), true, 'C03 the late withdrawal is observably waiting on the World lock');
      await q('COMMIT');
      const lateOutcome = await late;
      await asRole('postgres');
      noDeadlock(lateOutcome, 'C03');
      assert.ok(lateOutcome, 'C03 a withdrawal after the commit cannot rewrite the transition');
      assert.match(String(lateOutcome.message), /INTRODUCTION_SUCCESS_NOT_AVAILABLE/u,
        'C03 it observes the settled Introduction and writes nothing');
      assert.equal((await rt.approvalStateOf(f.version, f.lower)).resulting_state, 'APPROVED',
        'C03 so no new effective approval state was written');
      assert.deepEqual(await rt.terminalEffects(f.record, f.world), COMPLETED, 'C03 and the completion stands');
      await rt.cleanupIntroductionRace([one, two]);
    });

    await report.section('C04 two competing success commands yield exactly one completion', async () => {
      const f = await rt.bringToSuccessApproved(one, two);
      const ids = terminalIds();
      await q('BEGIN');
      await rt.commitSuccess(ids, f.version);
      // The SAME command id concurrently: it must be answered from the
      // committed row rather than attempting a second transition.
      const retry = outcomeOf(successX(ids, f.version));
      assert.equal(await waitExtra(), true, 'C04 the concurrent retry is observably waiting on the World lock');
      await q('COMMIT');
      const retryOutcome = await retry;
      await asRole('postgres');
      noDeadlock(retryOutcome, 'C04');
      assert.equal(retryOutcome, null, 'C04 the concurrent retry is answered from the committed row');
      assert.deepEqual(await rt.terminalEffects(f.record, f.world), COMPLETED, 'C04 exactly one completion exists');
      // A DIFFERENT command id on the settled Introduction is refused outright.
      const other = await outcomeOf(successX(terminalIds(), f.version));
      assert.ok(other, 'C04 a different command id cannot complete it a second time');
      assert.match(String(other.message), /INTRODUCTION_TERMINAL_ALREADY_SETTLED/u, 'C04 with the bounded class');
      await rt.cleanupIntroductionRace([one, two]);
    });

    await report.section('C05 disclosure vs END, pinned both ways', async () => {
      // The disclosure commits first: END snapshots it into the frozen view.
      const first = await rt.bringToIntroduction(one, two);
      const delivered = await rt.discloseAs(first.lower, first.world, 'FULL_NAME', { text: 'Sara Kamel' });
      await q('BEGIN');
      await actAs(first.higher);
      await rt.commitEnd(terminalIds(), first.world);
      await q('COMMIT');
      await asRole('postgres');
      assert.deepEqual(await rt.entitlementItemsOf(first.world, first.higher), [delivered.ids.item],
        'C05 a disclosure that committed first is frozen into the closed view');
      await rt.cleanupIntroductionRace([one, two]);

      // END commits first: a disclosure that waited behind it fails because the
      // World is closed, and leaves no partial resource, material or event.
      const second = await rt.bringToIntroduction(one, two);
      const ids = disclosureIds();
      await q('BEGIN');
      await actAs(second.lower);
      await rt.commitEnd(terminalIds(), second.world);
      await actAsX(second.lower);
      const contender = outcomeOf(discloseX(ids, second.world, 'Sara Kamel'));
      assert.equal(await waitExtra(), true, 'C05 the disclosure is observably waiting on the World lock END holds');
      await q('COMMIT');
      const outcome = await contender;
      await asRole('postgres');
      noDeadlock(outcome, 'C05');
      assert.ok(outcome, 'C05 a disclosure into a closed Introduction is refused');
      assert.match(String(outcome.message), /INTRODUCTION_DISCLOSURE_NOT_AVAILABLE/u, 'C05 with the bounded class');
      assert.deepEqual(await rt.disclosureEffects(ids),
        { commands: 0, versions: 0, texts: 0, media: 0, grants: 0, materials: 0, items: 0, viewers: 0, approvers: 0, provenance: 0, authority: 0 },
        'C05 and nothing partial survives on the losing path');
      await rt.cleanupIntroductionRace([one, two]);
    });

    await report.section('C06 disclosure vs SUCCESS, pinned both ways', async () => {
      // The disclosure commits first: SUCCESS preserves it in the same World.
      const first = await rt.bringToSuccessApproved(one, two);
      const delivered = await rt.discloseAs(first.lower, first.world, 'FULL_NAME', { text: 'Sara Kamel' });
      await rt.commitSuccess(terminalIds(), first.version);
      assert.deepEqual((await rt.visibility(first.world, first.higher)).map((r) => r.history_item_id),
        [delivered.ids.item], 'C06 a disclosure that committed first survives into Standard history');
      await rt.cleanupIntroductionRace([one, two]);

      // SUCCESS commits first: an Introduction-only disclosure then fails
      // because the phase is now STANDARD.
      const second = await rt.bringToSuccessApproved(one, two);
      const ids = disclosureIds();
      await q('BEGIN');
      await rt.commitSuccess(terminalIds(), second.version);
      await actAsX(second.lower);
      const contender = outcomeOf(discloseX(ids, second.world, 'Sara Kamel'));
      assert.equal(await waitExtra(), true, 'C06 the disclosure is observably waiting on the World lock SUCCESS holds');
      await q('COMMIT');
      const outcome = await contender;
      await asRole('postgres');
      noDeadlock(outcome, 'C06');
      assert.ok(outcome, 'C06 an Introduction-only disclosure is refused once the phase is STANDARD');
      assert.match(String(outcome.message), /INTRODUCTION_DISCLOSURE_NOT_AVAILABLE/u, 'C06 with the bounded class');
      assert.equal(await count(D.VERSIONS, 'id = $1', [ids.version]), 0, 'C06 and nothing partial survives');
      await rt.cleanupIntroductionRace([one, two]);
    });

    await report.section('C07 END vs owner deletion of already-disclosed material', async () => {
      const f = await rt.bringToIntroduction(one, two);
      const doomed = await rt.discloseAs(f.lower, f.world, 'CONTACT_METHOD', { text: '+20 100 000 0000' });
      await q('BEGIN');
      await actAs(f.higher);
      await rt.commitEnd(terminalIds(), f.world);
      await actAsX(f.lower);
      const deletion = outcomeOf(qx('SELECT * FROM public.delete_shared_world_owned_material_v1($1,$2,$3,$4)',
        [randomUUID(), f.world, doomed.ids.material, randomUUID()]));
      assert.equal(await waitExtra(), true, 'C07 the owner deletion is observably waiting on the World lock END holds');
      await q('COMMIT');
      const outcome = await deletion;
      await asRole('postgres');
      noDeadlock(outcome, 'C07');
      assert.equal(outcome, null, 'C07 owner privacy deletion still commits after the Introduction closed');
      assert.equal(await rt.textPayload(doomed.ids.version), null, 'C07 and really destroyed the payload');
      assert.deepEqual(await rt.visibility(f.world, f.higher), [],
        'C07 so the frozen closed view no longer resolves the deleted item');
      assert.equal(await count(D.ENTITLEMENT_ITEMS, 'world_id = $1 AND history_item_id = $2',
        [f.world, doomed.ids.item]), 1, 'C07 while the entitlement snapshot itself is untouched history');
      await rt.cleanupIntroductionRace([one, two]);
    });

    await report.section('C08 terminal transition vs Matching TURN_OFF, pinned both ways', async () => {
      // TURN_OFF wins: the terminal commit leaves that human OFF.
      const first = await rt.bringToIntroduction(one, two);
      const current = await rt.currentActOf(first.higher);
      await q('BEGIN');
      await actAs(first.higher);
      await rt.turnOff(randomUUID(), current.id);
      await actAsX(first.lower);
      const terminal = outcomeOf(endX(terminalIds(), first.world));
      assert.equal(await waitExtra(), true, 'C08 the terminal transition is observably waiting on the setup lock TURN_OFF holds');
      await q('COMMIT');
      const outcome = await terminal;
      await asRole('postgres');
      noDeadlock(outcome, 'C08');
      assert.equal(outcome, null, 'C08 TURN_OFF never blocks a terminal transition');
      assert.equal((await rt.currentActOf(first.higher)).resulting_state, 'OFF',
        'C08 and the explicit opt-out is left exactly as the human made it');
      assert.equal((await rt.currentActOf(first.lower)).resulting_pause_reason, 'POST_INTRODUCTION',
        'C08 while the other human moves to the reserved post-terminal pause');
      assert.deepEqual(await rt.terminalEffects(first.record, first.world), CLOSED, 'C08 the closure is complete');
      await rt.cleanupIntroductionRace([one, two]);

      // The terminal transition wins: the human may still TURN_OFF afterwards,
      // over the reserved pause, with a fresh token.
      const second = await rt.bringToIntroduction(one, two);
      const stale = await rt.currentActOf(second.higher);
      await q('BEGIN');
      await actAs(second.lower);
      await rt.commitEnd(terminalIds(), second.world);
      await actAsX(second.higher);
      const turningOff = outcomeOf(qx('SELECT * FROM public.turn_off_matching_participation_v1($1,$2)',
        [randomUUID(), stale.id]));
      assert.equal(await waitExtra(), true, 'C08 the TURN_OFF is observably waiting on the setup lock the terminal holds');
      await q('COMMIT');
      const offOutcome = await turningOff;
      await asRole('postgres');
      noDeadlock(offOutcome, 'C08');
      assert.ok(offOutcome, 'C08 the TURN_OFF that named the superseded act is refused as stale');
      assert.match(String(offOutcome.message), /MATCHING_STALE_STATE/u, 'C08 rather than forking the chain');
      const moved = await rt.currentActOf(second.higher);
      assert.equal(moved.resulting_pause_reason, 'POST_INTRODUCTION', 'C08 the terminal pause stands');
      await actAs(second.higher);
      const [off] = await rt.turnOff(randomUUID(), moved.id);
      await asRole('postgres');
      assert.equal(off.participation_state, 'OFF', 'C08 and the human may still turn Matching off with a fresh token');
      await rt.cleanupIntroductionRace([one, two]);
    });

    await report.section('C09 terminal transition vs Matching Context Grant revoke: both commit', async () => {
      const f = await rt.bringToIntroduction(one, two);
      await q('BEGIN');
      await actAs(f.higher);
      await rt.revokeContext(randomUUID(), f.byUser[f.higher].grant);
      await actAsX(f.lower);
      const terminal = outcomeOf(endX(terminalIds(), f.world));
      assert.equal(await waitExtra(), true, 'C09 the terminal transition is observably waiting on the setup lock the revoke holds');
      await q('COMMIT');
      const outcome = await terminal;
      await asRole('postgres');
      noDeadlock(outcome, 'C09');
      assert.equal(outcome, null,
        'C09 a terminal Introduction never depends on a Matching Context Grant: after the Match the World is independent');
      assert.deepEqual(await rt.terminalEffects(f.record, f.world), CLOSED, 'C09 and closes completely');
      assert.equal(await count('public.matching_context_grants', "grantor_user_id = $1 AND status = 'ACTIVE'", [f.higher]), 0,
        'C09 while the revocation also stands: neither blocked the other');
      await rt.cleanupIntroductionRace([one, two]);
    });
  } finally {
    await extra.close();
    await asRole('postgres');
  }
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID()];
await runVerifier('0116', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '30s'");
  setStage('fixtures');
  await rt.provisionHumans(humans);

  setStage('posture');
  await verifyPosture();

  const report = createScenarioReport('0116', { query: q, restore: () => asRole('postgres') });
  const seams = [];
  for (const fn of [PFN.FIRST_NAME, PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE]) {
    seams.push(await rt.captureMatchingSeam(fn));
  }
  try {
    await rt.resolveFirstName({ [humans[0]]: 'Sara', [humans[1]]: 'Omar', [humans[2]]: 'Layla' });
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();

    setStage('success');
    await verifySuccess(report, humans);
    setStage('end');
    await verifyEnd(report, humans);
    setStage('winner');
    await verifyWinnerAndContinuity(report, humans);
    setStage('no-ghost');
    await verifyNoGhost(report, humans);
    setStage('races');
    await verifyRaces(report, humans);
  } finally {
    await asRole('postgres');
    for (const seam of seams) await rt.restoreMatchingSeam(seam);
  }
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  await asRole('postgres');
  for (const [name] of I07D_SEAM_PARAMETERS) {
    assert.equal(await rt.seamClearance(name), 'NOT_EVALUATED', `${name} is fail-closed again after the run`);
  }
  for (const [table, trigger] of I07D_GUARDS) {
    assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} is enabled at the end of the run`);
  }
  await rt.cleanupIntroductionRace(humans);
  await rt.removeFixtureHumans(humans);
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${D.TERMINAL}) + (SELECT count(*) FROM ${D.COMPLETED})
          + (SELECT count(*) FROM ${D.ENDED}) + (SELECT count(*) FROM ${D.TRANSITIONS})
          + (SELECT count(*) FROM ${D.APPROVALS}) + (SELECT count(*) FROM ${D.ENTITLEMENTS})
          + (SELECT count(*) FROM ${MATCH.RECORDS}) + (SELECT count(*) FROM ${MATCH.CLAIMS})
          + (SELECT count(*) FROM public.shared_worlds WHERE birth_basis = 'MUTUAL_MATCH')
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans]);
  assert.equal(Number(residue), 0, 'every fixture this verifier committed was removed again');
  assert.deepEqual(POST_TERMINAL_REASONS, ['POST_INTRODUCTION', 'POST_SUCCESS'],
    'the two reserved post-terminal pause reasons are exactly the ones this slice produces');
}, () => rt.client.end().catch(() => undefined));
