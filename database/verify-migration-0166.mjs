// S6-07 (CP2) / migration 0166 - real-PostgreSQL proof of the forward dispatcher (CA-SYS-02, Q5').
//
//   A  posture: ONE service_role dispatcher and ONE read-only service_role lister, postgres-owned, DEFINER, pinned, no
//      overload; the dispatcher answers one word and no identity, holds a 2 s lock_timeout and takes p_max = 1 only; the
//      ledger is readable and writable by nobody, references only its proposal (CASCADE) and is registered for the erasure;
//      every frozen body it composes (the forward core, the materializer, the transition writer, the pair lock, the
//      validity reader, the CW2-08 seam, the S6-04 decisions, the sweeper, the erasure) is byte-unchanged; the dispatcher
//      is the forward core's only caller; anon / authenticated are refused both, and every role the ledger
//   B  production stays closed: with the real CW2-08 seam a realistic fixture (conclusion present) ends SKIPPED_NOT_CLEARED
//      with ONLY a ledger row - no transition, view, binding, Activity or lock-free side effect - the candidate sees
//      nothing; the backoff holds it; a later attempt reuses the SAME ids, and once the seam clears those exact ids deliver
//   C  behaviour (seam cleared for the run): FORWARDED binds exactly the ledger's identities, the candidate sees the neutral
//      row only after the binding, the first recipient's Activity and view are untouched; a retry is the committed answer;
//      no conclusion / two conclusions / a moved authority / an expired deadline deliver nothing; one not-ready proposal
//      cannot starve the others; a reused-id integrity refusal is HELD, never retried and never raised; the backoff is
//      bounded; the reconciliation lister finds a committed delivery until its Activity member exists; the governed
//      erasure removes the ledger with the proposal; a pending account deletion of EITHER human (SCHEDULED, BLOCKED)
//      forwards nothing, binds nothing and keeps the ledger due; once cancelled, the same ids deliver once; an expired or
//      withdrawn proposal is never revived by the cancellation
//   D  races on real connections: a human decision holding the pair lock vs the dispatcher (BUSY, bounded, no 40P01) and
//      the reverse (the human waits one dispatcher transaction, then answers normally); two dispatchers (one delivery); a
//      deadline crossing while the dispatcher waits (nothing delivered); a worker killed mid-forward (nothing committed,
//      the restart delivers once); a committed forward whose publish never happened (found again, published once); a
//      held pair cannot starve the queue; a deletion request committed while the dispatcher waits on the account row is
//      seen (nothing delivered)
//
// Behaviour runs on SYNTHETIC fixture humans; sections B and C roll back, D commits its fixtures and removes them. The
// CW2-08 seam is replaced for C and D and restored byte for byte. Nothing permissive survives.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import { CLEAN, createMatchRuntime, P, PFN, MATCH, runVerifier } from './matching-match-verifier-support.mjs';

const rt = createMatchRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const DISPATCH = 'public.server_forward_approved_matching_proposals_v1(integer)';
const LISTER = 'public.server_list_proposal_delivery_activity_reconciliation_v1(integer)';
const LEDGER = 'matching_forward_private.proposal_forward_attempts';
const OUTCOMES = ['FORWARDED', 'SKIPPED_MOVED', 'SKIPPED_DELETION_PENDING', 'SKIPPED_NO_CONCLUSION', 'SKIPPED_NOT_CLEARED', 'SKIPPED_NOT_READY',
  'SKIPPED_STALE', 'HELD_INTEGRITY', 'BUSY', 'NONE_DUE'];
const KEY = (transition) => `introductions:proposal-delivered:${transition}`;
const LIST = 'public.list_my_matching_proposals_v1';
const GET = 'public.get_my_matching_proposal_v1';
const WITHDRAW = 'public.withdraw_my_matching_proposal_v1';
const MIGRATIONS = new URL('./migrations/', import.meta.url);
const PERMISSION_DENIED = /permission denied/u;

// ------------------------------------------------------------------ helpers
const owner = () => asRole('postgres');
/** One dispatcher call as service_role, inside the caller's open transaction. */
async function dispatch(max = 1) {
  await asRole('service_role');
  try {
    const answer = await rows('SELECT * FROM public.server_forward_approved_matching_proposals_v1($1)', [max]);
    assert.equal(answer.length, 1, 'the dispatcher answers exactly one row');
    assert.deepEqual(Object.keys(answer[0]), ['outcome'], 'the dispatcher answers one word and no identity');
    assert.ok(OUTCOMES.includes(answer[0].outcome), `a bounded word, not ${answer[0].outcome}`);
    return answer[0].outcome;
  } finally { await owner(); }
}
/** The reconciliation lister as service_role. */
async function reconcile(limit = 50) {
  await asRole('service_role');
  try { return await rows('SELECT * FROM public.server_list_proposal_delivery_activity_reconciliation_v1($1)', [limit]); } finally { await owner(); }
}
const ledgerOf = async (proposal) => { await owner(); return (await rows(`SELECT * FROM ${LEDGER} WHERE proposal_id = $1`, [proposal]))[0] ?? null; };
async function makeDue(proposal) {
  await owner();
  await q(`UPDATE ${LEDGER} SET next_attempt_at = clock_timestamp() - interval '1 second' WHERE proposal_id = $1 AND next_attempt_at IS NOT NULL`, [proposal]);
}
/** Everything a forward could write about one proposal. */
async function effects(proposal) {
  await owner();
  const [p] = await rows(`SELECT proposal_state, current_transition_id FROM ${P.PROPOSALS} WHERE id = $1`, [proposal]);
  return {
    state: p?.proposal_state ?? null,
    forwards: await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'FORWARDED_TO_SECOND'", [proposal]),
    transitions: await count(P.TRANSITIONS, 'proposal_id = $1', [proposal]),
    deliveries: await count(P.DELIVERY_BINDINGS, "proposal_id = $1 AND delivery_state = 'FORWARDED_TO_SECOND'", [proposal]),
    candidateViews: await count(P.VIEWS, "proposal_id = $1 AND recipient_role = 'CANDIDATE'", [proposal]),
    views: await count(P.VIEWS, 'proposal_id = $1', [proposal]),
  };
}
const activityOf = async (humans) => { await owner(); return count('public.activity_items', 'user_id = ANY($1::uuid[])', [humans]); };
/** What the candidate's own S6-04 readers show about one proposal (they must agree). */
async function candidateSees(human, proposal) {
  await asRole('authenticated', human);
  try {
    const one = await rows(`SELECT * FROM ${GET}($1)`, [proposal]);
    const all = (await rows(`SELECT * FROM ${LIST}(NULL, 20)`)).filter((r) => r.matching_proposal_id === proposal);
    assert.deepEqual(one, all, 'the single read and the listing agree');
    return one;
  } finally { await owner(); }
}
const facts = async (pairs) => { for (const [human, sex, firstName] of pairs) await rt.recordFacts(human, { sex, firstName }); };
/** A proposal in FIRST_FORWARD_APPROVED with exactly `n` permitted conclusions for the candidate, through the real cores. */
async function approvedWith(first, candidate, n) {
  const f = await rt.seedEligible(first, candidate);
  const forFirst = await rt.permitted(f.snapshot, first, candidate, `${CLEAN} A settled and unhurried outlook on both sides.`);
  const forCandidate = [];
  for (const variant of ['from the other side of it', 'seen from the other side as well'].slice(0, n)) {
    forCandidate.push((await rt.permitted(f.snapshot, candidate, first, `${CLEAN} The same unhurried outlook, ${variant}.`)).id);
  }
  const proposal = randomUUID();
  await rt.prepare(proposal, f.snapshot, first);
  const firstView = randomUUID();
  await rt.offer(randomUUID(), proposal, firstView, forFirst.id);
  await actAs(first);
  await rt.approveForward(randomUUID(), proposal, firstView);
  await owner();
  return { ...f, first, candidate, proposal, firstView, forCandidate };
}
/** A live account deletion request of `human` (as 0130 writes it), or its cancellation (as 0130 cancels it). */
async function requestDeletion(human, status = 'SCHEDULED') {
  await owner();
  const [{ id }] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, final_at, blocked_at)
    VALUES ($1, gen_random_uuid(), $2, clock_timestamp() + interval '7 days', CASE WHEN $2 = 'BLOCKED' THEN clock_timestamp() END)
    RETURNING id`, [human, status]);
  return id;
}
async function cancelDeletion(id) {
  await owner();
  await q("UPDATE personal_data_private.account_deletions SET status = 'CANCELLED', cancelled_at = clock_timestamp(), lease_until = NULL WHERE id = $1", [id]);
}
/** The body of the LAST definition of `schema.name` in the migrations before 0166, CR-free. */
function priorBody(schema, name) {
  let found = null;
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && f < '0166').sort()) {
    const text = readFileSync(new URL(file, MIGRATIONS), 'utf8').replace(/\r\n/gu, '\n');
    for (const match of text.matchAll(new RegExp(String.raw`CREATE (?:OR REPLACE )?FUNCTION ${schema}\.${name}\(`, 'gu'))) {
      const tail = text.slice(match.index);
      const open = /\bAS\s+(\$[A-Za-z_]*\$)/u.exec(tail);
      const start = open.index + open[0].length;
      found = { file, body: tail.slice(start, tail.indexOf(open[1], start)) };
    }
  }
  assert.ok(found, `${schema}.${name} is defined before 0166`);
  return found.body;
}
/** A fixture Activity publication of one listed delivery, exactly as the CP3 producer will name it (fixture copy). */
async function publishFixture(row) {
  await asRole('service_role');
  try {
    const [answer] = await rows(`SELECT * FROM public.server_publish_activity_candidate_v1($1, $2, $3, 'INTRODUCTIONS', 'INTRODUCTION', 3,
        false, false, 'INTRODUCTIONS', NULL, NULL, NULL, 'INTRODUCTIONS', $4, 'PRODUCT', NULL, 'verifier fixture', NULL, NULL,
        false, 'L0', $5, NULL)`, [row.recipient_user_id, row.candidate_key, `proposal-delivered:${row.delivery_transition_id}`,
      `proposal:${row.proposal_id}`, row.delivered_at]);
    return answer.outcome;
  } finally { await owner(); }
}

// ------------------------------------------------------------------ A. posture
async function verifyPosture(report) {
  await report.section('A01 one service_role dispatcher and one service_role lister: owned, DEFINER, pinned, exact, no overload', async () => {
    const d = await rt.functionPosture(DISPATCH);
    const l = await rt.functionPosture(LISTER);
    for (const [fn, p] of [[DISPATCH, d], [LISTER, l]]) {
      assert.equal(p.owner, 'postgres', `A01 ${fn} is postgres-owned`);
      assert.equal(p.secdef, true, `A01 ${fn} is SECURITY DEFINER`);
      assert.equal(await rt.canExecute('service_role', fn), true, `A01 service_role executes ${fn}`);
      for (const role of ['public', 'anon', 'authenticated']) assert.equal(await rt.canExecute(role, fn), false, `A01 ${role} must not execute ${fn}`);
    }
    assert.deepEqual(d.config, ['search_path=""', 'lock_timeout=2s'], 'A01 the dispatcher pins search_path and a 2 s lock_timeout');
    assert.deepEqual(l.config, ['search_path=""'], 'A01 the lister pins search_path');
    assert.equal(d.volatility, 'v', 'A01 the dispatcher is VOLATILE');
    assert.equal(l.volatility, 's', 'A01 the lister is STABLE');
    assert.deepEqual(await rt.inputParameters(DISPATCH), ['p_max']);
    assert.deepEqual(await rt.resultColumns(DISPATCH), ['outcome'], 'A01 one word, no identity');
    assert.deepEqual(await rt.inputParameters(LISTER), ['p_limit']);
    assert.deepEqual(await rt.resultColumns(LISTER), ['delivery_transition_id', 'proposal_id', 'recipient_user_id', 'candidate_key', 'delivered_at', 'action']);
    const overloads = await rows(`SELECT p.proname, count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('server_forward_approved_matching_proposals_v1',
        'server_list_proposal_delivery_activity_reconciliation_v1') GROUP BY 1 ORDER BY 1`);
    assert.deepEqual(overloads.map((o) => [o.proname, o.n]), [['server_forward_approved_matching_proposals_v1', 1],
      ['server_list_proposal_delivery_activity_reconciliation_v1', 1]]);
  });

  await report.section('A02 the ledger: nobody reads or writes it; RLS on; only its proposal, CASCADE; registered for the erasure', async () => {
    for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
      const [{ any }] = await rows(`SELECT bool_or(has_table_privilege($1, $2::regclass, p)) AS any
        FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p`, [role, LEDGER]);
      assert.equal(any, false, `A02 ${role} holds no privilege on the ledger`);
      const [{ usage }] = await rows("SELECT has_schema_privilege($1, 'matching_forward_private', 'USAGE') AS usage", [role]);
      assert.equal(usage, false, `A02 ${role} cannot use the private schema`);
    }
    const [{ rls }] = await rows(`SELECT relrowsecurity rls FROM pg_class WHERE oid = $1::regclass`, [LEDGER]);
    assert.equal(rls, true, 'A02 row level security is on');
    const keys = await rows(`SELECT c.confrelid::regclass::text target, c.confdeltype FROM pg_constraint c
      WHERE c.contype = 'f' AND c.conrelid = $1::regclass`, [LEDGER]);
    assert.deepEqual(keys, [{ target: 'matching_proposals', confdeltype: 'c' }], 'A02 the ledger references only its proposal, ON DELETE CASCADE');
    const referencing = await rows(`SELECT c.conrelid::regclass::text rel FROM pg_constraint c WHERE c.contype = 'f' AND c.confrelid = $1::regclass`, [LEDGER]);
    assert.deepEqual(referencing, [], 'A02 nothing references the ledger');
    const [registry] = await rows(`SELECT coverage FROM account_erasure_private.coverage_registry WHERE relation = $1`, [LEDGER]);
    assert.equal(registry?.coverage, 'MATCHING_INTRODUCTIONS', 'A02 registered: the governed erasure removes it with its proposals');
    const functions = await rows(`SELECT p.oid::regprocedure::text fn FROM pg_proc p WHERE p.pronamespace = 'matching_forward_private'::regnamespace`);
    assert.deepEqual(functions, [], 'A02 the private schema holds no function');
  });

  await report.section('A03 every frozen body the dispatcher composes is byte-unchanged; it is the forward core\'s ONE caller', async () => {
    // [schema, name, signature, the application roles that execute it] - the S6-04 decisions are authenticated-only.
    for (const [schema, name, signature, executors] of [
      ['public', 'forward_matching_proposal_to_second_core_v1', PFN.FORWARD, []],
      ['public', 'materialize_matching_recipient_view_core_v1', 'public.materialize_matching_recipient_view_core_v1(uuid,uuid,uuid,uuid)', []],
      ['public', 'append_matching_proposal_transition_v1', 'public.append_matching_proposal_transition_v1(uuid,uuid,text,text,uuid,uuid,text)', []],
      ['public', 'lock_matching_pair_humans_v1', 'public.lock_matching_pair_humans_v1(uuid,uuid)', []],
      ['public', 'resolve_matching_proposal_validity_v1', 'public.resolve_matching_proposal_validity_v1(uuid)', []],
      ['public', 'resolve_matching_proposal_prerequisites_v1', PFN.PREREQUISITES, []],
      ['public', 'approve_my_matching_proposal_forward_v1', 'public.approve_my_matching_proposal_forward_v1(uuid,uuid,uuid)', ['authenticated']],
      ['public', 'withdraw_my_matching_proposal_v1', 'public.withdraw_my_matching_proposal_v1(uuid,uuid,uuid)', ['authenticated']],
      ['public', 'sweep_matching_proposals_core_v1', 'public.sweep_matching_proposals_core_v1(integer)', []],
      ['account_erasure_private', 'erase_account_v1', 'account_erasure_private.erase_account_v1(uuid)', []],
      ['account_erasure_private', 'erase_matching_introductions_v1', 'account_erasure_private.erase_matching_introductions_v1(uuid,uuid,uuid[])', []],
    ]) {
      const live = (await rt.functionPosture(signature)).prosrc.replace(/\r\n/gu, '\n');
      assert.equal(live, priorBody(schema, name), `A03 ${signature} is byte-unchanged`);
      for (const role of ['anon', 'authenticated', 'service_role']) {
        assert.equal(await rt.canExecute(role, signature), executors.includes(role), `A03 ${role} ${executors.includes(role) ? 'still executes' : 'still cannot execute'} ${signature}`);
      }
    }
    const callers = await rows(`SELECT p.oid::regprocedure::text fn FROM pg_proc p
      WHERE p.prosrc ~ 'forward_matching_proposal_to_second_core_v1\\s*\\(' AND p.proname <> 'forward_matching_proposal_to_second_core_v1' ORDER BY 1`);
    assert.deepEqual(callers.map((r) => r.fn), ['server_forward_approved_matching_proposals_v1(integer)'], 'A03 exactly one function calls the forward core');
    const src = (await rt.functionPosture(DISPATCH)).prosrc.replace(/--[^\n]*/gu, '');
    assert.doesNotMatch(src, /append_matching_proposal_transition_v1|materialize_matching_recipient_view_core_v1|resolve_matching_proposal_prerequisites_v1|'CLEARED'/u,
      'A03 the dispatcher writes no transition or view itself and never consults or answers the CW2-08 seam');
    assert.doesNotMatch(src, /(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\./u, 'A03 the dispatcher writes no public relation itself');
    const order = ['lock_matching_pair_humans_v1', 'SELECT * INTO v_proposal FROM public.matching_proposals',
      'INSERT INTO matching_forward_private.proposal_forward_attempts AS a\n    (proposal_id', 'forward_matching_proposal_to_second_core_v1(']
      .map((needle) => { const i = src.lastIndexOf(needle); assert.ok(i >= 0, `A03 the dispatcher carries ${needle}`); return i; });
    for (let i = 1; i < order.length; i += 1) assert.ok(order[i] > order[i - 1], `A03 lock order step ${i} follows step ${i - 1}: the pair lock first`);
    assert.doesNotMatch(src, /FOR UPDATE SKIP LOCKED|FOR UPDATE\s*;\s*\n\s*-- 2/u, 'A03 the proposal row is never locked before the pair lock');
  });

  await report.section('A04 anon and authenticated are refused both; every role the ledger; p_max is 1 and p_limit bounded', async () => {
    await q('BEGIN');
    try {
      for (const role of ['anon', 'authenticated']) {
        await asRole(role, randomUUID());
        await rejected(() => rows('SELECT * FROM public.server_forward_approved_matching_proposals_v1(1)'), ['42501'], PERMISSION_DENIED);
        await rejected(() => rows('SELECT * FROM public.server_list_proposal_delivery_activity_reconciliation_v1(10)'), ['42501'], PERMISSION_DENIED);
      }
      for (const role of ['anon', 'authenticated', 'service_role']) {
        await asRole(role, randomUUID());
        await rejected(() => rows(`SELECT * FROM ${LEDGER}`), ['42501'], PERMISSION_DENIED);
        await rejected(() => rows(`INSERT INTO ${LEDGER} (proposal_id, forward_command_id, forwarded_view_id, next_attempt_at)
          VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), now())`), ['42501'], PERMISSION_DENIED);
        await rejected(() => rows(`SELECT * FROM public.forward_matching_proposal_to_second_core_v1(gen_random_uuid(), gen_random_uuid(),
          gen_random_uuid(), gen_random_uuid())`), ['42501'], PERMISSION_DENIED);
      }
      await asRole('service_role');
      for (const bad of [0, 2, 50, null]) {
        await rejected(() => rows('SELECT * FROM public.server_forward_approved_matching_proposals_v1($1)', [bad]), ['22023'], /MATCHING_FORWARD_REQUEST_INVALID/u);
      }
      for (const bad of [0, 101, null]) {
        await rejected(() => rows('SELECT * FROM public.server_list_proposal_delivery_activity_reconciliation_v1($1)', [bad]), ['22023']);
      }
    } finally { await q('ROLLBACK'); await owner(); }
  });
}

// ------------------------------------------------------------------ B. production closed (the real CW2-08 seam)
async function verifyProductionClosed(report, [first, candidate, other]) {
  await owner();
  // The frozen OFFER core needs the CW2-08 clearance too, so a fixture can only be built with the seam cleared; it is
  // restored byte for byte before the dispatcher runs, and the whole section rolls back.
  const realSeam = await rt.captureMatchingSeam(PFN.PREREQUISITES);
  const approvedClosed = async (a, b) => {
    await rt.clearProposalPrerequisites();
    const f = await approvedWith(a, b, 1);
    await rt.restoreMatchingSeam(realSeam);
    return f;
  };
  await q('BEGIN');
  try {
    await report.isolated('B01 nothing is due: NONE_DUE, and nothing is written - not even a lock row', async () => {
      const locks = await count('public.matching_setup_locks', 'true', []);
      assert.equal(await dispatch(), 'NONE_DUE');
      assert.equal(await count(LEDGER, 'true', []), 0, 'B01 no ledger row');
      assert.equal(await count('public.matching_setup_locks', 'true', []), locks, 'B01 no lock row');
      assert.deepEqual(await reconcile(), [], 'B01 the lister answers nothing');
    });

    await report.isolated('B02 a realistic fixture ends SKIPPED_NOT_CLEARED with only a ledger row; the same ids deliver once the seam clears', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [candidate, 'MALE', 'Omar']]);
      const f = await approvedClosed(first, candidate);
      const before = await effects(f.proposal);
      assert.equal(before.state, 'FIRST_FORWARD_APPROVED');
      assert.deepEqual(await candidateSees(candidate, f.proposal), [], 'B02 the candidate sees nothing before any attempt');
      assert.equal(await dispatch(), 'SKIPPED_NOT_CLEARED', 'B02 the frozen core stops at the CW2-08 seam');
      const one = await ledgerOf(f.proposal);
      assert.deepEqual([one.last_outcome, one.attempts, one.last_failure_sqlstate], ['SKIPPED_NOT_CLEARED', 1, null]);
      const [{ wait }] = await rows(`SELECT extract(epoch FROM $1::timestamptz - clock_timestamp())::int wait`, [one.next_attempt_at]);
      assert.ok(wait > 30 && wait <= 60, `B02 the backoff holds it about a minute (${wait} s)`);
      assert.deepEqual(await effects(f.proposal), before, 'B02 no transition, view or binding');
      assert.deepEqual(await candidateSees(candidate, f.proposal), [], 'B02 the candidate still sees nothing');
      assert.deepEqual(await reconcile(), [], 'B02 nothing to publish');
      assert.equal(await activityOf([first, candidate]), 0, 'B02 no Activity for either human');
      assert.equal(await dispatch(), 'NONE_DUE', 'B02 held by its backoff');
      await makeDue(f.proposal);
      assert.equal(await dispatch(), 'SKIPPED_NOT_CLEARED');
      const two = await ledgerOf(f.proposal);
      assert.deepEqual([two.forward_command_id, two.forwarded_view_id, two.attempts], [one.forward_command_id, one.forwarded_view_id, 2],
        'B02 the second attempt reused the ids minted once');
      const [{ wait: wait2 }] = await rows(`SELECT extract(epoch FROM $1::timestamptz - clock_timestamp())::int wait`, [two.next_attempt_at]);
      assert.ok(wait2 > 90 && wait2 <= 120, `B02 the backoff doubled (${wait2} s)`);
      // A future Launch Gate clears the seam (inside this rolled-back scenario only): the SAME identities deliver.
      await rt.clearProposalPrerequisites();
      await makeDue(f.proposal);
      assert.equal(await dispatch(), 'FORWARDED');
      const [binding] = await rows(`SELECT * FROM ${P.DELIVERY_BINDINGS} WHERE proposal_id = $1 AND delivery_state = 'FORWARDED_TO_SECOND'`, [f.proposal]);
      assert.deepEqual([binding.delivery_transition_id, binding.delivered_view_id, binding.recipient_user_id],
        [one.forward_command_id, one.forwarded_view_id, candidate], 'B02 the delivery is bound to the ledger\'s identities, for the candidate');
    });

    await report.isolated('B03 the gates stay closed whatever the dispatcher did', async () => {
      await facts([[other, 'FEMALE', 'Huda'], [candidate, 'MALE', 'Omar']]);
      await approvedClosed(other, candidate);
      assert.equal(await dispatch(), 'SKIPPED_NOT_CLEARED');
      assert.equal((await rows(`SELECT clearance FROM public.resolve_matching_proposal_prerequisites_v1($1)`, [randomUUID()]))[0].clearance, 'NOT_EVALUATED');
      assert.equal((await rows(`SELECT clearance FROM public.resolve_matching_pair_prerequisites_v1($1, $2)`, [randomUUID(), randomUUID()]))[0].clearance, 'NOT_EVALUATED');
      assert.equal((await rows('SELECT readiness FROM public.resolve_matching_compatibility_producer_readiness_v1()'))[0].readiness, 'UNAVAILABLE');
      assert.equal(await count('matching_enrollment_private.gate_states', 'true', []), 0, 'B03 the ENROLLMENT gate has no row');
      assert.equal(await count('matching_enrollment_private.consent_texts', 'true', []), 0, 'B03 no consent text');
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
  await report.section('B04 the seam is fail-closed again after the rolled-back clearance', async () => {
    assert.equal((await rows(`SELECT clearance FROM public.resolve_matching_proposal_prerequisites_v1($1)`, [randomUUID()]))[0].clearance, 'NOT_EVALUATED');
    assert.equal(await count(LEDGER, 'true', []), 0);
  });
}

// ------------------------------------------------------------------ C. behaviour (seam cleared)
async function verifyRuntime(report, [first, a, b, c, d]) {
  await owner();
  await q('BEGIN');
  try {
    await report.isolated('C01 FORWARDED binds exactly the ledger\'s ids; the candidate sees the neutral row only after it; a retry is the committed answer', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await approvedWith(first, a, 1);
      const [firstViewBefore] = await rows(`SELECT current_view_id FROM ${P.VIEW_STATE} WHERE proposal_id = $1 AND recipient_user_id = $2`, [f.proposal, first]);
      assert.deepEqual(await candidateSees(a, f.proposal), [], 'C01 nothing before the binding');
      assert.equal(await dispatch(), 'FORWARDED');
      const l = await ledgerOf(f.proposal);
      assert.deepEqual([l.last_outcome, l.attempts, l.next_attempt_at], ['FORWARDED', 1, null], 'C01 the ledger is terminal');
      const after = await effects(f.proposal);
      assert.deepEqual([after.state, after.forwards, after.deliveries, after.candidateViews], ['FORWARDED_TO_SECOND', 1, 1, 1]);
      const [t] = await rows(`SELECT * FROM ${P.TRANSITIONS} WHERE proposal_id = $1 AND resulting_state = 'FORWARDED_TO_SECOND'`, [f.proposal]);
      assert.deepEqual([t.id, t.first_recipient_actor_id, t.candidate_actor_id], [l.forward_command_id, null, null], 'C01 the transition is the ledger command, no human actor');
      const [view] = await rows(`SELECT * FROM ${P.VIEWS} WHERE id = $1`, [l.forwarded_view_id]);
      assert.deepEqual([view.recipient_user_id, view.subject_user_id, view.permitted_conclusion_id], [a, first, f.forCandidate[0]],
        'C01 the candidate\'s own view, about the first recipient, with the candidate\'s own permitted conclusion');
      const seen = await candidateSees(a, f.proposal);
      assert.equal(seen.length, 1, 'C01 the candidate now sees exactly one row');
      assert.equal(seen[0].recipient_view_id, l.forwarded_view_id, 'C01 the delivered view');
      const [firstViewAfter] = await rows(`SELECT current_view_id FROM ${P.VIEW_STATE} WHERE proposal_id = $1 AND recipient_user_id = $2`, [f.proposal, first]);
      assert.deepEqual(firstViewAfter, firstViewBefore, 'C01 the first recipient\'s view is untouched');
      assert.equal(await activityOf([first, a]), 0, 'C01 nothing is published in the forward transaction - to either human');
      assert.equal(await count(MATCH.COMMITS, 'pair_id = $1', [f.pair]), 0, 'C01 no Match');
      assert.equal(await dispatch(), 'NONE_DUE', 'C01 a forwarded proposal is never selected again');
      // The core itself, re-called with the ledger ids, is its committed answer - one binding, one view, one transition.
      const [replay] = await rt.forward(l.forward_command_id, f.proposal, l.forwarded_view_id, f.forCandidate[0]);
      assert.deepEqual([replay.forward_transition_id, replay.forwarded_view_id], [l.forward_command_id, l.forwarded_view_id]);
      assert.deepEqual(await effects(f.proposal), after, 'C01 the retry wrote nothing');
      await rejected(() => rt.forward(l.forward_command_id, f.proposal, randomUUID(), f.forCandidate[0]), ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
    });

    await report.isolated('C02 no permitted conclusion, or two, delivers nothing; the dispatcher never creates one', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali']]);
      const none = await approvedWith(first, a, 0);
      const two = await approvedWith(first, b, 2);
      const conclusions = [await count('public.matching_permitted_safe_conclusions', 'true', []), await count('public.matching_safe_conclusion_candidates', 'true', [])];
      const before = [await effects(none.proposal), await effects(two.proposal)];
      assert.deepEqual([await dispatch(), await dispatch()], ['SKIPPED_NO_CONCLUSION', 'SKIPPED_NO_CONCLUSION']);
      assert.deepEqual([await effects(none.proposal), await effects(two.proposal)], before, 'C02 nothing delivered');
      assert.deepEqual([await count('public.matching_permitted_safe_conclusions', 'true', []), await count('public.matching_safe_conclusion_candidates', 'true', [])],
        conclusions, 'C02 no conclusion was written');
      assert.deepEqual([await candidateSees(a, none.proposal), await candidateSees(b, two.proposal)], [[], []]);
      assert.equal(await dispatch(), 'NONE_DUE', 'C02 both are held by their backoff');
    });

    await report.isolated('C03 a moved authority or an expired deadline delivers nothing', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali']]);
      const moved = await approvedWith(first, a, 1);
      const expired = await approvedWith(first, b, 1);
      await rt.backdate(expired.proposal);
      // The first recipient (the subject of the candidate's view) revokes their disclosure authority: the core's own
      // revalidation refuses with 40001, which the dispatcher absorbs.
      await actAs(first);
      await rt.revokeDisclosure(randomUUID(), moved.byUser[first].authority);
      await owner();
      const before = await effects(moved.proposal);
      assert.equal(await dispatch(), 'SKIPPED_STALE');
      assert.deepEqual(await effects(moved.proposal), before, 'C03 nothing delivered on moved authority');
      assert.equal((await ledgerOf(moved.proposal)).last_outcome, 'SKIPPED_STALE');
      assert.deepEqual(await candidateSees(a, moved.proposal), []);
      assert.equal(await dispatch(), 'NONE_DUE', 'C03 an expired proposal is never due');
      assert.equal(await ledgerOf(expired.proposal), null, 'C03 and never touched');
    });

    await report.isolated('C04 one not-ready proposal cannot starve the others; the backoff is bounded', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali'], [c, 'MALE', 'Yusuf']]);
      const stuck = await approvedWith(first, a, 0);
      const x = await approvedWith(first, b, 1);
      const y = await approvedWith(first, c, 1);
      const outcomes = [await dispatch(), await dispatch(), await dispatch()];
      assert.deepEqual([...outcomes].sort(), ['FORWARDED', 'FORWARDED', 'SKIPPED_NO_CONCLUSION'], `C04 three cycles, three distinct proposals (${outcomes})`);
      assert.equal(await dispatch(), 'NONE_DUE');
      assert.deepEqual([(await effects(x.proposal)).state, (await effects(y.proposal)).state], ['FORWARDED_TO_SECOND', 'FORWARDED_TO_SECOND']);
      await makeDue(stuck.proposal);
      assert.equal(await dispatch(), 'SKIPPED_NO_CONCLUSION', 'C04 retried only once due again');
      assert.equal((await ledgerOf(stuck.proposal)).attempts, 2);
      // The backoff is capped at six hours and never outlives the deadline.
      await q(`UPDATE ${LEDGER} SET attempts = 40, next_attempt_at = clock_timestamp() - interval '1 second' WHERE proposal_id = $1`, [stuck.proposal]);
      assert.equal(await dispatch(), 'SKIPPED_NO_CONCLUSION');
      const [{ hours, past }] = await rows(`SELECT extract(epoch FROM a.next_attempt_at - clock_timestamp()) / 3600 AS hours,
          a.next_attempt_at > p.expires_at AS past FROM ${LEDGER} a JOIN ${P.PROPOSALS} p ON p.id = a.proposal_id WHERE a.proposal_id = $1`, [stuck.proposal]);
      assert.ok(Number(hours) > 5.9 && Number(hours) <= 6, `C04 capped at 6 h (${hours})`);
      assert.equal(past, false, 'C04 never past the deadline');
      await q(`ALTER TABLE ${P.PROPOSALS} DISABLE TRIGGER matching_proposals_state_truth`);
      await q(`UPDATE ${P.PROPOSALS} SET expires_at = clock_timestamp() + interval '10 minutes' WHERE id = $1`, [stuck.proposal]);
      await q(`ALTER TABLE ${P.PROPOSALS} ENABLE TRIGGER matching_proposals_state_truth`);
      await makeDue(stuck.proposal);
      assert.equal(await dispatch(), 'SKIPPED_NO_CONCLUSION');
      const [{ capped }] = await rows(`SELECT a.next_attempt_at = p.expires_at AS capped FROM ${LEDGER} a JOIN ${P.PROPOSALS} p ON p.id = a.proposal_id
        WHERE a.proposal_id = $1`, [stuck.proposal]);
      assert.equal(capped, true, 'C04 a backoff past the deadline is cut at the deadline');
    });

    await report.isolated('C05 a reused-id integrity refusal is HELD: never retried, never raised, and it starves nobody', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali']]);
      const bad = await approvedWith(first, a, 1);
      const good = await approvedWith(first, b, 1);
      // Plant a ledger row whose command id is already a committed transition of this proposal (its approval): the
      // writer refuses the reuse with 23505, a different request under a reused id.
      const [{ approval }] = await rows(`SELECT current_transition_id approval FROM ${P.PROPOSALS} WHERE id = $1`, [bad.proposal]);
      await q(`INSERT INTO ${LEDGER} (proposal_id, forward_command_id, forwarded_view_id, next_attempt_at)
               VALUES ($1, $2, gen_random_uuid(), clock_timestamp() - interval '1 hour')`, [bad.proposal, approval]);
      const before = await effects(bad.proposal);
      assert.equal(await dispatch(), 'HELD_INTEGRITY', 'C05 the planted row sorts first and is held');
      const held = await ledgerOf(bad.proposal);
      assert.deepEqual([held.last_outcome, held.last_failure_sqlstate, held.next_attempt_at, held.attempts], ['HELD_INTEGRITY', '23505', null, 1]);
      assert.deepEqual(await effects(bad.proposal), before, 'C05 nothing of the refused attempt survives');
      assert.equal(await dispatch(), 'FORWARDED', 'C05 the next proposal is forwarded');
      assert.equal((await effects(good.proposal)).state, 'FORWARDED_TO_SECOND');
      assert.equal(await dispatch(), 'NONE_DUE', 'C05 the held one is never retried automatically');
    });

    await report.isolated('C06 the lister finds a committed delivery until its Activity member exists; a replay is DUPLICATE', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali']]);
      const f = await approvedWith(first, a, 1);
      assert.deepEqual(await reconcile(), [], 'C06 nothing before the forward (the first recipient\'s offer is no longer current)');
      assert.equal(await dispatch(), 'FORWARDED');
      const l = await ledgerOf(f.proposal);
      const listed = await reconcile();
      assert.equal(listed.length, 1);
      const [row] = listed;
      const [t] = await rows(`SELECT occurred_at FROM ${P.TRANSITIONS} WHERE id = $1`, [l.forward_command_id]);
      assert.deepEqual([row.delivery_transition_id, row.proposal_id, row.recipient_user_id, row.candidate_key, row.action],
        [l.forward_command_id, f.proposal, a, KEY(l.forward_command_id), 'PUBLISH'], 'C06 the candidate, under the delivery\'s own key');
      assert.equal(new Date(row.delivered_at).getTime(), new Date(t.occurred_at).getTime());
      assert.deepEqual(await reconcile(), listed, 'C06 the lister is read-only: listed again until published');
      assert.equal(await publishFixture(row), 'PUBLISHED');
      assert.deepEqual(await reconcile(), [], 'C06 published: nothing left');
      assert.equal(await publishFixture(row), 'DUPLICATE', 'C06 a replay is never a second notification');
      assert.equal(await count('public.activity_item_members', 'user_id = $1', [a]), 1);
      assert.equal(await activityOf([first]), 0, 'C06 the first recipient gets nothing at forward time');
      // A delivery that is no longer current is never listed: the first recipient withdraws after forwarding.
      const g = await approvedWith(first, b, 1);
      assert.equal(await dispatch(), 'FORWARDED');
      assert.equal((await reconcile()).length, 1);
      await asRole('authenticated', first);
      const [w] = await rows(`SELECT * FROM ${WITHDRAW}($1, $2, $3)`, [randomUUID(), g.proposal, g.firstView]);
      await owner();
      assert.equal(w.outcome, 'RECORDED');
      assert.deepEqual(await reconcile(), [], 'C06 a withdrawn delivery is not listed');
    });

    await report.isolated('C07 the governed erasure removes the ledger with the proposal; the dispatcher then finds nothing', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [d, 'MALE', 'Karim']]);
      const f = await approvedWith(first, d, 0);
      assert.equal(await dispatch(), 'SKIPPED_NO_CONCLUSION');
      assert.ok(await ledgerOf(f.proposal), 'C07 a ledger row exists');
      const [{ id }] = await rows(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
        VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [d]);
      await asRole('service_role');
      const [{ outcome }] = await rows('SELECT public.server_erase_account_v1($1) AS outcome', [id]);
      await owner();
      assert.equal(outcome, 'ERASED');
      assert.equal(await count(P.PROPOSALS, 'id = $1', [f.proposal]), 0, 'C07 the erasure deleted the proposal');
      assert.equal(await ledgerOf(f.proposal), null, 'C07 and the ledger row with it');
      await makeDue(f.proposal);
      assert.equal(await dispatch(), 'NONE_DUE');
    });

    await report.isolated('C08 a pending account deletion of either human forwards nothing; once cancelled, the same ids deliver once; nothing is revived', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar'], [b, 'MALE', 'Ali'], [c, 'MALE', 'Yusuf']]);
      const f = await approvedWith(first, a, 1);
      const before = await effects(f.proposal);
      // The first recipient's request (SCHEDULED).
      const firstRequest = await requestDeletion(first);
      assert.equal(await dispatch(), 'SKIPPED_DELETION_PENDING', 'C08 the first recipient\'s pending deletion refuses');
      assert.deepEqual(await effects(f.proposal), before, 'C08 no transition, view or delivery binding');
      assert.deepEqual(await candidateSees(a, f.proposal), [], 'C08 the candidate sees nothing');
      const l1 = await ledgerOf(f.proposal);
      assert.deepEqual([l1.last_outcome, l1.attempts, l1.next_attempt_at !== null], ['SKIPPED_DELETION_PENDING', 1, true],
        'C08 not terminal: the proposal stays due after the backoff');
      assert.equal(await dispatch(), 'NONE_DUE', 'C08 the backoff holds it');
      // The candidate's request instead (BLOCKED counts as pending too).
      await cancelDeletion(firstRequest);
      const candidateRequest = await requestDeletion(a, 'BLOCKED');
      await makeDue(f.proposal);
      assert.equal(await dispatch(), 'SKIPPED_DELETION_PENDING', 'C08 the candidate\'s pending deletion refuses');
      assert.deepEqual(await effects(f.proposal), before, 'C08 still nothing delivered');
      // Cancelled: the still-valid proposal is evaluated again and delivered once, under the ids minted the first time.
      await cancelDeletion(candidateRequest);
      assert.equal(await dispatch(), 'NONE_DUE', 'C08 the cancellation does not bypass the backoff');
      await makeDue(f.proposal);
      assert.equal(await dispatch(), 'FORWARDED', 'C08 after the cancellation the proposal is forwarded');
      const l2 = await ledgerOf(f.proposal);
      assert.deepEqual([l2.forward_command_id, l2.forwarded_view_id], [l1.forward_command_id, l1.forwarded_view_id], 'C08 the same ids');
      const e = await effects(f.proposal);
      assert.deepEqual([e.forwards, e.deliveries, e.candidateViews], [1, 1, 1], 'C08 one transition, one binding, one view');
      assert.equal((await candidateSees(a, f.proposal)).length, 1);
      assert.equal(await dispatch(), 'NONE_DUE', 'C08 never delivered twice');
      // Nothing is revived: proposals that expired or were withdrawn during the deletion stay where they are.
      const expired = await approvedWith(first, b, 1);
      const withdrawn = await approvedWith(first, c, 1);
      const pending = await requestDeletion(first);
      assert.equal(await dispatch(), 'SKIPPED_DELETION_PENDING');
      assert.equal(await dispatch(), 'SKIPPED_DELETION_PENDING');
      await rt.backdate(expired.proposal);
      await actAs(first);
      await rows(`SELECT * FROM ${WITHDRAW}($1, $2, $3)`, [randomUUID(), withdrawn.proposal, withdrawn.firstView]);
      await cancelDeletion(pending);
      await makeDue(expired.proposal);
      await makeDue(withdrawn.proposal);
      assert.equal(await dispatch(), 'NONE_DUE', 'C08 an expired or withdrawn proposal is never selected again');
      assert.deepEqual([(await effects(expired.proposal)).deliveries, (await effects(withdrawn.proposal)).deliveries], [0, 0]);
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ D. races on real connections
/** The extra connection as service_role inside an open transaction, calling the dispatcher (not awaited). */
async function dispatchOn(extra) {
  await extra.qx('BEGIN');
  await extra.qx('SET LOCAL ROLE service_role');
  return extra.qx('SELECT outcome FROM public.server_forward_approved_matching_proposals_v1(1)');
}
async function dispatchCommitted() {
  await owner();
  await q('BEGIN');
  try { const outcome = await dispatch(); await q('COMMIT'); return outcome; } catch (error) { await q('ROLLBACK'); throw error; }
}
async function committedReconcile() {
  await q('BEGIN');
  try { const listed = await reconcile(); await q('COMMIT'); return listed; } catch (error) { await q('ROLLBACK'); throw error; }
}

async function verifyRaces(report, pool) {
  const next = () => pool.shift();

  await report.section('D01 a human decision holding the pair lock: the dispatcher is BUSY within its timeout, writes nothing of the proposal, no 40P01', async () => {
    const [first, cand] = [next(), next()];
    await facts([[first, 'FEMALE', 'Mona'], [cand, 'MALE', 'Omar']]);
    const f = await approvedWith(first, cand, 1);
    const extra = await rt.openExtra();
    try {
      await q('BEGIN');
      await asRole('authenticated', first);
      const [mine] = await rows(`SELECT * FROM ${WITHDRAW}($1, $2, $3)`, [randomUUID(), f.proposal, f.firstView]);
      await asRole('postgres');
      assert.equal(mine.outcome, 'RECORDED');
      const started = Date.now();
      const theirs = dispatchOn(extra);
      assert.equal(await rt.waitForLockWait((t, v) => q(t, v), extra.pid), true, 'D01 the dispatcher waits on the pair lock');
      const { rows: [late] } = await theirs;
      const waited = Date.now() - started;
      await extra.qx('COMMIT');
      assert.equal(late.outcome, 'BUSY');
      assert.ok(waited >= 1500 && waited < 5000, `D01 bounded by the 2 s lock_timeout (${waited} ms)`);
      await q('COMMIT');
      const e = await effects(f.proposal);
      assert.deepEqual([e.state, e.forwards, e.deliveries], ['WITHDRAWN', 0, 0], 'D01 the human decision stands; nothing was delivered');
      // The human holds the proposal row itself: even the ledger is left untouched (its key check would wait for it).
      assert.equal(await ledgerOf(f.proposal), null, 'D01 not even a ledger row');
      assert.equal(await dispatchCommitted(), 'NONE_DUE', 'D01 a withdrawn proposal is never due');
    } finally {
      await q('ROLLBACK').catch(() => undefined);
      await extra.close();
    }
  });

  await report.section('D02 the dispatcher first: the human waits one dispatcher transaction, then answers normally', async () => {
    const [first, cand] = [next(), next()];
    await facts([[first, 'FEMALE', 'Mona'], [cand, 'MALE', 'Omar']]);
    const f = await approvedWith(first, cand, 1);
    const extra = await rt.openExtra();
    try {
      await q('BEGIN');
      assert.equal(await dispatch(), 'FORWARDED');
      await extra.qx('BEGIN');
      await extra.qx('SET LOCAL ROLE authenticated');
      await extra.qx("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: first, role: 'authenticated' })]);
      const theirs = extra.qx(`SELECT * FROM ${WITHDRAW}($1, $2, $3)`, [randomUUID(), f.proposal, f.firstView]);
      assert.equal(await rt.waitForLockWait((t, v) => q(t, v), extra.pid), true, 'D02 the human waits on the pair lock');
      await q('COMMIT');
      const { rows: [late] } = await theirs;
      await extra.qx('COMMIT');
      assert.equal(late.outcome, 'RECORDED', 'D02 the waiting withdrawal answers normally');
      const [t] = await rows(`SELECT prior_state FROM ${P.TRANSITIONS} WHERE proposal_id = $1 AND resulting_state = 'WITHDRAWN'`, [f.proposal]);
      assert.equal(t.prior_state, 'FORWARDED_TO_SECOND', 'D02 it saw the committed forward');
      assert.equal((await effects(f.proposal)).forwards, 1);
    } finally {
      await q('ROLLBACK').catch(() => undefined);
      await extra.close();
    }
  });

  await report.section('D03 two dispatchers at once: one delivery; the second finds it moved', async () => {
    const [first, cand] = [next(), next()];
    await facts([[first, 'FEMALE', 'Mona'], [cand, 'MALE', 'Omar']]);
    const f = await approvedWith(first, cand, 1);
    const extra = await rt.openExtra();
    try {
      await q('BEGIN');
      assert.equal(await dispatch(), 'FORWARDED');
      const theirs = dispatchOn(extra);
      assert.equal(await rt.waitForLockWait((t, v) => q(t, v), extra.pid), true, 'D03 the second dispatcher waits on the pair lock');
      await q('COMMIT');
      const { rows: [late] } = await theirs;
      await extra.qx('COMMIT');
      assert.equal(late.outcome, 'SKIPPED_MOVED', 'D03 re-read under the lock: already forwarded');
      const e = await effects(f.proposal);
      assert.deepEqual([e.forwards, e.deliveries, e.candidateViews], [1, 1, 1], 'D03 one transition, one binding, one view');
      assert.equal((await ledgerOf(f.proposal)).last_outcome, 'FORWARDED', 'D03 the terminal ledger row is not reopened');
    } finally {
      await q('ROLLBACK').catch(() => undefined);
      await extra.close();
    }
  });

  await report.section('D04 a deadline that passes while the dispatcher waits: nothing is delivered', async () => {
    const [first, cand] = [next(), next()];
    await facts([[first, 'FEMALE', 'Mona'], [cand, 'MALE', 'Omar']]);
    const f = await approvedWith(first, cand, 1);
    const extra = await rt.openExtra();
    try {
      const deadline = await rt.deadlineIn(f.proposal, '1200 milliseconds');
      await q('BEGIN');
      await rows('SELECT public.lock_matching_pair_humans_v1($1, $2)', [f.lower, f.higher]);
      const theirs = dispatchOn(extra);
      assert.equal(await rt.waitForLockWait((t, v) => q(t, v), extra.pid), true, 'D04 the dispatcher selected it and waits');
      assert.equal(await rt.waitForInstant(deadline), true, 'D04 the deadline passed during the wait');
      await q('COMMIT');
      const { rows: [late] } = await theirs;
      await extra.qx('COMMIT');
      assert.equal(late.outcome, 'SKIPPED_MOVED', 'D04 re-read under the lock: expired');
      const e = await effects(f.proposal);
      assert.deepEqual([e.forwards, e.deliveries, e.candidateViews], [0, 0, 0], 'D04 nothing delivered past the deadline');
    } finally {
      await q('ROLLBACK').catch(() => undefined);
      await extra.close();
    }
  });

  await report.section('D05 a worker killed mid-forward commits nothing; the restart delivers once; a lost publish is found again', async () => {
    const [first, cand] = [next(), next()];
    await facts([[first, 'FEMALE', 'Mona'], [cand, 'MALE', 'Omar']]);
    const f = await approvedWith(first, cand, 1);
    // The doomed worker: its own connection, killed by the server while its forward is uncommitted.
    const { Client } = await import('pg');
    const doomed = new Client({ connectionString: process.env.DATABASE_URL });
    doomed.on('error', () => undefined);
    await doomed.connect();
    const [{ pid }] = (await doomed.query('SELECT pg_backend_pid() AS pid')).rows;
    try {
      await doomed.query('BEGIN');
      await doomed.query('SET LOCAL ROLE service_role');
      const { rows: [inFlight] } = await doomed.query('SELECT outcome FROM public.server_forward_approved_matching_proposals_v1(1)');
      assert.equal(inFlight.outcome, 'FORWARDED', 'D05 the doomed worker forwarded, uncommitted');
      await rows('SELECT pg_terminate_backend($1)', [pid]);
    } finally {
      await doomed.end().catch(() => undefined);
    }
    for (let i = 0; i < 200 && Number((await rows('SELECT count(*) n FROM pg_stat_activity WHERE pid = $1', [pid]))[0].n) > 0; i += 1) {
      await new Promise((resolve) => { setTimeout(resolve, 25); });
    }
    const gone = await effects(f.proposal);
    assert.deepEqual([gone.state, gone.forwards, gone.deliveries, gone.candidateViews], ['FIRST_FORWARD_APPROVED', 0, 0, 0], 'D05 nothing of it survived');
    assert.equal(await ledgerOf(f.proposal), null, 'D05 not even the ledger row');
    assert.equal(await dispatchCommitted(), 'FORWARDED', 'D05 the restarted worker delivers');
    const l = await ledgerOf(f.proposal);
    const e = await effects(f.proposal);
    assert.deepEqual([e.forwards, e.deliveries, e.candidateViews], [1, 1, 1]);
    // The publish never happened (the worker died again before it): the next cycle finds the delivery.
    const listed = (await committedReconcile()).filter((r) => r.proposal_id === f.proposal);
    assert.deepEqual(listed.map((r) => [r.delivery_transition_id, r.recipient_user_id, r.action]), [[l.forward_command_id, cand, 'PUBLISH']]);
    await q('BEGIN');
    try { assert.equal(await publishFixture(listed[0]), 'PUBLISHED'); await q('COMMIT'); } catch (error) { await q('ROLLBACK'); throw error; }
    assert.deepEqual((await committedReconcile()).filter((r) => r.proposal_id === f.proposal), [], 'D05 a third cycle answers nothing');
    assert.equal(await count('public.activity_item_members', 'user_id = $1 AND candidate_key = $2', [cand, KEY(l.forward_command_id)]), 1, 'D05 exactly one notification');
  });

  await report.section('D06 a held pair cannot starve the queue: BUSY defers it, the next proposal is forwarded', async () => {
    // Two pairs with no human in common: holding one pair's lock cannot touch the other.
    const [first, held, other, free] = [next(), next(), next(), next()];
    await facts([[first, 'FEMALE', 'Mona'], [held, 'MALE', 'Omar'], [other, 'FEMALE', 'Huda'], [free, 'MALE', 'Ali']]);
    const h = await approvedWith(first, held, 1);
    const g = await approvedWith(other, free, 1);
    // The held proposal sorts first: an old due ledger row.
    await q(`INSERT INTO ${LEDGER} (proposal_id, forward_command_id, forwarded_view_id, next_attempt_at)
             VALUES ($1, gen_random_uuid(), gen_random_uuid(), clock_timestamp() - interval '1 hour')`, [h.proposal]);
    const extra = await rt.openExtra();
    try {
      await extra.qx('BEGIN');
      await extra.qx('SELECT public.lock_matching_pair_humans_v1($1, $2)', [h.lower, h.higher]);
      assert.equal(await dispatchCommitted(), 'BUSY', 'D06 the held pair answers BUSY');
      assert.equal(await dispatchCommitted(), 'FORWARDED', 'D06 the next due proposal is forwarded at once');
      assert.equal(await dispatchCommitted(), 'NONE_DUE', 'D06 the held one waits its short deferral');
      await extra.qx('COMMIT');
      assert.equal((await effects(g.proposal)).state, 'FORWARDED_TO_SECOND');
      const l = await ledgerOf(h.proposal);
      const [{ wait }] = await rows(`SELECT extract(epoch FROM $1::timestamptz - clock_timestamp())::int wait`, [l.next_attempt_at]);
      assert.deepEqual([l.last_outcome, l.attempts], ['BUSY', 0], 'D06 BUSY is not counted as an attempt');
      assert.ok(wait > 15 && wait <= 30, `D06 deferred about 30 s (${wait} s)`);
      await makeDue(h.proposal);
      assert.equal(await dispatchCommitted(), 'FORWARDED', 'D06 once released, it is forwarded too');
    } finally {
      await extra.close();
    }
  });

  await report.section('D07 a deletion request committed while the dispatcher waits on the account row is seen: nothing is delivered', async () => {
    const [first, cand] = [next(), next()];
    await facts([[first, 'FEMALE', 'Mona'], [cand, 'MALE', 'Omar']]);
    const f = await approvedWith(first, cand, 1);
    const extra = await rt.openExtra();
    try {
      // The candidate's deletion request, exactly as 0130 takes it: the account row FOR UPDATE, then the request row.
      await q('BEGIN');
      await q('SELECT 1 FROM public.users WHERE id = $1 FOR UPDATE', [cand]);
      const id = await requestDeletion(cand);
      const theirs = dispatchOn(extra);
      assert.equal(await rt.waitForLockWait((t, v) => q(t, v), extra.pid), true, 'D07 the dispatcher waits on the account row');
      await q('COMMIT');
      const { rows: [late] } = await theirs;
      await extra.qx('COMMIT');
      assert.equal(late.outcome, 'SKIPPED_DELETION_PENDING', 'D07 the committed request is seen under the lock');
      const e = await effects(f.proposal);
      assert.deepEqual([e.state, e.forwards, e.deliveries, e.candidateViews], ['FIRST_FORWARD_APPROVED', 0, 0, 0], 'D07 nothing delivered');
      await q('BEGIN');
      await cancelDeletion(id);
      await q('COMMIT');
      await makeDue(f.proposal);
      assert.equal(await dispatchCommitted(), 'FORWARDED', 'D07 cancelled: the proposal is forwarded once');
      assert.equal((await effects(f.proposal)).deliveries, 1);
    } finally {
      await q('ROLLBACK').catch(() => undefined);
      await extra.close();
      await owner();
      await q('DELETE FROM personal_data_private.account_deletions WHERE user_id = $1', [cand]);
    }
  });
}

// ------------------------------------------------------------------ the run
const humans = Array.from({ length: 6 }, () => randomUUID());
const raceHumans = Array.from({ length: 17 }, () => randomUUID());

await runVerifier('0166', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '30s'");
  setStage('fixtures');
  await rt.provisionHumans([...humans, ...raceHumans]);
  const report = createScenarioReport('0166', { query: q, restore: () => asRole('postgres') });

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
    await verifyRuntime(report, humans);
    setStage('races');
    await verifyRaces(report, [...raceHumans]);
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
  for (const table of [P.PROPOSALS, P.POLICY_STATE, P.FACT_VERSIONS, LEDGER]) {
    assert.equal(await count(table, 'true', []), 0, `${table} is empty again: every fixture this verifier committed was removed`);
  }
}, () => rt.client.end().catch(() => undefined));
