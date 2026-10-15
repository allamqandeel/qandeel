// S6-03 / migration 0157 - real-PostgreSQL proof of CW2-06B-14, CW2-06B-15 and the R4-A / R4-B preparation instant.
//
//   K  the continuing automatic re-proposal block, D6.6 cases 1-13 one for one (R1, R2)
//   L  R4-A: the age-certainty horizon at preparation under two expiry values, the lock-wait test with its byte-for-byte
//      restored unit seam, the discrimination control, the retry
//   M  R4-B: no intermediate decision gets around the delivery gate or the commit
//   N  the pre-preparation admission, the orchestrator (zero writes in production, preparation under synthetic seams)
//      and the sweeper (expiry and staleness without clearance)
//
// Every fact row written here belongs to a SYNTHETIC fixture human created and removed by this verifier.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createIntroductionRuntime, terminalIds, DFN, P, PFN, MATCH, matchIds, runVerifier, APP_ROLES,
} from './introduction-lifecycle-verifier-support.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const FN = Object.freeze({
  BLOCK: 'public.resolve_matching_pair_reproposal_block_v1(uuid,uuid)',
  READINESS: 'public.resolve_matching_compatibility_producer_readiness_v1()',
  PAIR_SEAM: 'public.resolve_matching_pair_prerequisites_v1(uuid,uuid)',
  ADMISSION: 'public.resolve_matching_pair_admission_v1(uuid,uuid)',
  ORCHESTRATE: 'public.orchestrate_matching_proposal_preparation_core_v1(uuid,integer)',
  SWEEP: 'public.sweep_matching_proposals_core_v1(integer)',
});
const outcomeOf = (promise) => promise.then(() => null, (error) => error);
const stripComments = (source) => source.split('\n').filter((line) => !/^\s*--/u.test(line)).join('\n');

const blocked = async (a, b) => (await rows('SELECT * FROM public.resolve_matching_pair_reproposal_block_v1($1, $2)', [a, b]))[0].blocked;
const admission = async (a, b) => (await rows('SELECT * FROM public.resolve_matching_pair_admission_v1($1, $2)', [a, b]))[0].admission;
const orchestrate = async (human, max = 10) =>
  (await rows('SELECT * FROM public.orchestrate_matching_proposal_preparation_core_v1($1, $2)', [human, max]))[0];
const sweep = async (max = 50) => (await rows('SELECT * FROM public.sweep_matching_proposals_core_v1($1)', [max]))[0];
const candidatesOf = async (human) => (await rt.discover(human, 50)).map((r) => r.candidate_user_id);

/** A fresh snapshot of an already-matchable pair, evaluated PASS on the fixture dealbreaker, ready to prepare. */
async function freshSnapshot(a, b) {
  await asRole('postgres');
  const [pair] = await rt.ensurePair(randomUUID(), a, b);
  const snapshot = randomUUID();
  await rt.capture(snapshot, pair.pair_id, a, b);
  await rt.evaluate(snapshot, a, 'faith_practice_level', 'PASS', 'EXPLICIT_MATCHING_ANSWER');
  await rt.evaluate(snapshot, b, 'faith_practice_level', 'PASS', 'EXPLICIT_MATCHING_ANSWER');
  return snapshot;
}

/** The preparation attempt any automatic producer would make next, in BOTH directions: each is refused as blocked. */
async function assertBlocked(a, b, label) {
  assert.equal(await blocked(a, b), true, `${label}: the block resolver answers blocked`);
  assert.equal(await blocked(b, a), true, `${label}: in the reverse direction too`);
  const snapshot = await freshSnapshot(a, b);
  for (const first of [a, b]) {
    await rejected(() => rt.prepare(randomUUID(), snapshot, first), ['55000'], /MATCHING_PAIR_REPROPOSAL_BLOCKED/u);
  }
}

/** Swap one fail-closed seam for a synthetic answer; the caller restores it byte for byte. */
async function replaceSeam(fn, answer) {
  await asRole('postgres');
  if (fn === FN.READINESS) {
    await q(`CREATE OR REPLACE FUNCTION public.resolve_matching_compatibility_producer_readiness_v1()
             RETURNS TABLE(readiness text, basis text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $seam$
             BEGIN RETURN QUERY SELECT '${answer}'::text, 'verifier fixture'::text; END$seam$`);
  } else {
    await q(`CREATE OR REPLACE FUNCTION public.resolve_matching_pair_prerequisites_v1(p_user_a uuid, p_user_b uuid)
             RETURNS TABLE(clearance text, basis text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $seam$
             BEGIN RETURN QUERY SELECT '${answer}'::text, 'verifier fixture'::text; END$seam$`);
  }
}

// ------------------------------------------------------------------ posture
async function verifyPosture(report) {
  await report.section('P01 the block, seams, admission, orchestrator and sweeper are executable by no role; no worker exists', async () => {
    for (const fn of [...Object.values(FN), PFN.DISCOVER, PFN.PREPARE]) {
      const p = await rt.functionPosture(fn);
      assert.equal(p.owner, 'postgres', `P01 ${fn} is postgres-owned`);
      assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'), `P01 ${fn} pins an empty search_path`);
      for (const role of ['public', ...APP_ROLES]) assert.equal(await rt.canExecute(role, fn), false, `P01 ${role} must not execute ${fn}`);
    }
    // NO WORKER, SCHEDULE OR WRAPPER: no other function reaches the orchestrator or the sweeper.
    const callers = await rows(`SELECT p.oid::regprocedure::text fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND (p.prosrc LIKE '%orchestrate_matching_proposal_preparation_core_v1%' OR p.prosrc LIKE '%sweep_matching_proposals_core_v1%')`);
    assert.deepEqual(callers, [], 'P01 nothing calls the orchestrator or the sweeper');
    const [{ cron }] = await rows("SELECT to_regnamespace('cron') IS NOT NULL AS cron");
    if (cron) assert.equal(await count('cron.job', "command ILIKE '%matching%'", []), 0, 'P01 and no schedule names them');
  });

  await report.section('P02 the seams answer only their one truthful value, and the admission never admits today', async () => {
    assert.deepEqual((await rows('SELECT readiness FROM public.resolve_matching_compatibility_producer_readiness_v1()')), [{ readiness: 'UNAVAILABLE' }]);
    const [pair] = await rows('SELECT clearance, basis FROM public.resolve_matching_pair_prerequisites_v1($1, $2)', [randomUUID(), randomUUID()]);
    assert.equal(pair.clearance, 'NOT_EVALUATED');
    assert.match(pair.basis, /CW2-08/u);
    for (const fn of [FN.READINESS, FN.PAIR_SEAM]) {
      const body = stripComments((await rt.functionPosture(fn)).prosrc);
      assert.equal(body.split('RETURN QUERY').length - 1, 1, `P02 ${fn} has exactly one answer`);
      assert.doesNotMatch(body, /\bIF\b|\bFROM\s+public\.|router|model_|'READY'|'CLEARED'/iu, `P02 ${fn} cannot answer otherwise`);
    }
    const [prerequisites] = await rows('SELECT clearance FROM public.resolve_matching_proposal_prerequisites_v1($1)', [randomUUID()]);
    assert.equal(prerequisites.clearance, 'NOT_EVALUATED', 'P02 the proposal-scoped CW2-08 seam is untouched and not cleared');
  });

  await report.section('P03 R4-A posture: preparation reads one real instant, after the deadline and H_min, only in its refusals', async () => {
    const body = stripComments((await rt.functionPosture(PFN.PREPARE)).prosrc);
    const at = (needle) => { const i = body.indexOf(needle); assert.ok(i >= 0, `P03 preparation carries ${needle}`); return i; };
    const order = ['lock_matching_pair_humans_v1', 'RETURN QUERY SELECT committed.id', 'resolve_matching_snapshot_validity_v1',
      'resolve_matching_pair_reproposal_block_v1', 'MATCHING_PROPOSAL_CADENCE_EXCEEDED', 'MATCHING_PENDING_PROPOSAL_LIMIT_EXCEEDED',
      'deadline := CURRENT_TIMESTAMP + make_interval(hours => expiry_hours);', 'INTO horizon', 'checked_at := clock_timestamp();',
      'IF deadline <= checked_at THEN', 'IF deadline >= horizon THEN', 'INSERT INTO public.matching_proposals'].map(at);
    for (let i = 1; i < order.length; i += 1) assert.ok(order[i] > order[i - 1], `P03 preparation step ${i} follows step ${i - 1}`);
    assert.equal(body.split('clock_timestamp').length - 1, 1, 'P03 exactly one real instant');
    assert.equal(body.split('deadline :=').length - 1, 1, 'P03 it is never assigned to the deadline');
    assert.doesNotMatch(body.slice(order[10]), /RAISE[\s\S]*RAISE[\s\S]*RAISE[\s\S]*INSERT INTO public\.matching_proposals/u,
      'P03 the two refusals are the last statements before the first write');
    assert.doesNotMatch(body, /resolve_matching_pair_admission_v1|resolve_matching_pair_prerequisites_v1/u,
      'P03 preparation itself consults no seam: the admission is the orchestrator\'s');
  });
}

// ------------------------------------------------------------------ K. the re-proposal block
async function verifyBlock(report, humans) {
  const [a, b, c, d] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('K01 EXPIRED blocks automatic re-proposal of the pair, in Discovery and Prepare (case 1)', async () => {
      const f = await rt.bringToOffered(a, b);
      await rt.backdate(f.proposal);
      await rt.expire(randomUUID(), f.proposal);
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'EXPIRED');
      assert.ok(!(await candidatesOf(a)).includes(b), 'K01 discovery excludes the pair');
      assert.ok(!(await candidatesOf(b)).includes(a), 'K01 from either side');
      await assertBlocked(a, b, 'K01');
      assert.equal(await admission(a, b), 'REPROPOSAL_BLOCKED', 'K01 and the admission refuses it');
    });

    await report.isolated('K02 the protection holds with the direction reversed (case 2)', async () => {
      const f = await rt.bringToOffered(b, a);
      await rt.backdate(f.proposal);
      await rt.expire(randomUUID(), f.proposal);
      await assertBlocked(a, b, 'K02');
    });

    await report.isolated('K03 PREPARED -> EXPIRED that no human saw blocks, and is no human rejection (cases 3, 4)', async () => {
      const f = await rt.seedEligible(a, b);
      const proposal = randomUUID();
      await rt.prepare(proposal, f.snapshot, a);
      await rt.backdate(proposal);
      const command = randomUUID();
      await rt.expire(command, proposal);
      const [t] = await rows(`SELECT * FROM ${P.TRANSITIONS} WHERE id = $1`, [command]);
      assert.deepEqual([t.prior_state, t.resulting_state, t.first_recipient_actor_id, t.candidate_actor_id, t.private_reason_code],
        ['PREPARED', 'EXPIRED', null, null, 'PROPOSAL_EXPIRED'], 'K03 an unseen expiry: no actor, and the expiry reason, never a decline');
      assert.equal(await count(P.VIEWS, 'proposal_id = $1', [proposal]), 0, 'K03 no human ever saw it');
      assert.equal(await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state IN ('FIRST_DECLINED', 'SECOND_DECLINED')", [proposal]), 0);
      for (const human of [a, b]) {
        await actAs(human);
        await rejected(() => rt.myProposal(proposal), ['P0002'], /MATCHING_PROPOSAL_NOT_FOUND/u);
      }
      await asRole('postgres');
      await assertBlocked(a, b, 'K03');
      // Case 4: what a human who WAS shown an expired proposal is told carries no reason and no counterpart decision.
      const g = await rt.bringToOffered(c, d);
      await rt.backdate(g.proposal);
      await rt.expire(randomUUID(), g.proposal);
      await actAs(c);
      const [answer] = await rt.myProposal(g.proposal);
      assert.deepEqual(Object.keys(answer).sort(), ['action_available', 'matching_proposal_id', 'neutral_outcome', 'presented_first_name',
        'recipient_view_id', 'safe_compatibility_conclusion'], 'K03 the answer has no reason column');
      assert.equal(answer.neutral_outcome, 'NO_LONGER_AVAILABLE', 'K03 expiry reads as no longer available, never as a refusal');
      assert.doesNotMatch(JSON.stringify(answer), /EXPIRED|DECLINED|REJECT|REFUS/u);
      await asRole('postgres');
    });

    await report.isolated('K04 no automatic retry after restart, resume or an arbitrary elapsed period (case 5)', async () => {
      const f = await rt.seedEligible(a, b);
      const proposal = randomUUID();
      await rt.prepare(proposal, f.snapshot, a);
      await rt.backdate(proposal);
      await rt.expire(randomUUID(), proposal);
      // Elapsed: the whole history moved a year into the past changes nothing.
      for (const [table, trigger] of [[P.TRANSITIONS, 'matching_proposal_transitions_immutable'], [P.PROPOSALS, 'matching_proposals_state_truth']]) {
        await q(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
      }
      await q(`UPDATE ${P.TRANSITIONS} SET occurred_at = occurred_at - interval '400 days' WHERE proposal_id = $1`, [proposal]);
      await q(`UPDATE ${P.PROPOSALS} SET prepared_at = prepared_at - interval '400 days', expires_at = expires_at - interval '400 days' WHERE id = $1`, [proposal]);
      for (const [table, trigger] of [[P.TRANSITIONS, 'matching_proposal_transitions_immutable'], [P.PROPOSALS, 'matching_proposals_state_truth']]) {
        await q(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
      }
      assert.equal(await blocked(a, b), true, 'K04 after an arbitrary elapsed period');
      // Resume: a pause and an explicit resume of either human lifts nothing.
      const [paused] = await rt.setupState(a);
      await actAs(a);
      const [p] = await rt.pause(randomUUID(), paused.participation_event_id);
      await rt.resume(randomUUID(), p.participation_event_id);
      await asRole('postgres');
      assert.equal((await rt.setupState(a))[0].matchable, true, 'K04 the human is matchable again');
      await assertBlocked(a, b, 'K04 after resume');
    });

    await report.isolated('K05 an unrelated pair is never blocked by another pair\'s expiry (case 6)', async () => {
      const f = await rt.bringToOffered(a, b);
      await rt.backdate(f.proposal);
      await rt.expire(randomUUID(), f.proposal);
      await rt.seedMatchable(a, c);
      await rt.assignSex(c, (await rt.currentFacts(b)).sex);
      assert.equal(await blocked(a, c), false, 'K05 the pair (a, c) is not blocked');
      const snapshot = await freshSnapshot(a, c);
      const [prepared] = await rt.prepare(randomUUID(), snapshot, a);
      assert.equal(prepared.prepared_state, 'PREPARED', 'K05 and prepares');
    });

    await report.isolated('K06 STALE and CANCELLED_BY_COMPETING_MATCH block nothing and are never human rejections (case 7)', async () => {
      const f = await rt.seedEligible(a, b);
      const proposal = randomUUID();
      await rt.prepare(proposal, f.snapshot, a);
      await rt.recordFacts(b, { sex: (await rt.currentFacts(b)).sex, maritalStatus: 'NEVER_MARRIED' });
      const [stale] = await rt.revalidate(randomUUID(), proposal);
      assert.equal(stale.current_state, 'STALE');
      assert.equal(await blocked(a, b), false, 'K06 STALE does not block');
      // A competing Match: (c, d) is live while c matches with a.
      await rt.assignSex(c, (await rt.currentFacts(a)).sex === 'MALE' ? 'FEMALE' : 'MALE');
      await rt.assignSex(d, (await rt.currentFacts(a)).sex);
      const live = await rt.bringToOffered(c, d);
      const winner = await rt.bringToForwarded(a, c);
      await actAs(c);
      await rt.commitMatch(matchIds(), winner.proposal, winner.secondView);
      await asRole('postgres');
      const [cancelled] = await rows(`SELECT * FROM ${P.TRANSITIONS} WHERE proposal_id = $1 AND resulting_state = 'CANCELLED_BY_COMPETING_MATCH'`, [live.proposal]);
      assert.ok(cancelled, 'K06 the competing proposal was cancelled');
      assert.deepEqual([cancelled.first_recipient_actor_id, cancelled.candidate_actor_id], [null, null], 'K06 by no human');
      assert.equal(await blocked(c, d), false, 'K06 CANCELLED_BY_COMPETING_MATCH does not block');
      const stateRows = await rows(`SELECT t.resulting_state s FROM ${P.TRANSITIONS} t WHERE t.proposal_id = ANY($1::uuid[])`, [[proposal, live.proposal]]);
      assert.ok(stateRows.every((r) => !['FIRST_DECLINED', 'SECOND_DECLINED'].includes(r.s)), 'K06 neither is recorded as a decline');
    });

    await report.section('K07 Stage 9 policy is absent and no policy kind was added (case 8)', async () => {
      const [{ d: kinds }] = await rows(`SELECT pg_get_constraintdef(c.oid) d FROM pg_constraint c
          WHERE c.conrelid = $1::regclass AND c.conname = 'matching_proposal_policy_versions_kind_check'`, [P.POLICY_VERSIONS]);
      assert.deepEqual((kinds.match(/'[A-Z_]+'/gu) ?? []).sort(), ["'PENDING_PROPOSAL_LIMIT'", "'PROPOSAL_CADENCE'", "'PROPOSAL_EXPIRY'",
        "'PROPOSAL_SAFE_FIELDS'", "'SENSITIVE_CONCLUSION_FILTER'"], 'K07 exactly the five canonical kinds');
      const body = (await rt.functionPosture(FN.BLOCK)).prosrc;
      assert.doesNotMatch(body, /interval|CURRENT_TIMESTAMP|clock_timestamp|now\(\)|policy/iu, 'K07 the block has no cooldown and reads no policy');
    });

    await report.isolated('K08 a decline and a withdrawal block exactly as an EXPIRED does', async () => {
      const f = await rt.bringToOffered(a, b);
      await actAs(a);
      await rt.declineFirst(randomUUID(), f.proposal, f.firstView);
      await asRole('postgres');
      await assertBlocked(a, b, 'K08 FIRST_DECLINED');
      const g = await rt.bringToForwarded(c, d);
      await actAs(d);
      await rt.declineSecond(randomUUID(), g.proposal, g.secondView);
      await asRole('postgres');
      await assertBlocked(c, d, 'K08 SECOND_DECLINED');
    });

    await report.isolated('K09 a withdrawal blocks too', async () => {
      const f = await rt.bringToOffered(a, b);
      await actAs(a);
      await rt.withdraw(randomUUID(), f.proposal, f.firstView, 'OFFERED_TO_FIRST');
      await asRole('postgres');
      await assertBlocked(a, b, 'K09 WITHDRAWN');
    });
  } finally {
    await q('ROLLBACK');
  }
}

/** R1: a prior Mutual Match blocks after BOTH Introduction outcomes, after reactivation, both ways (cases 10, 11, 12). */
async function verifyMatchBlock(report, humans) {
  const [a, b, c] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    for (const [label, conclude] of [
      ['K10 CLOSED / INTRODUCTION_ENDED', async (f) => { await actAs(f.lower); await rt.commitEnd(terminalIds(), f.world); await asRole('postgres'); }],
      ['K11 COMPLETED / INTRODUCTION_COMPLETED', async (f) => { await rt.commitSuccess(terminalIds(), f.version); }],
    ]) {
      await report.isolated(`${label}: a prior Mutual Match blocks after the Introduction, after reactivation, both ways`, async () => {
        const f = label.startsWith('K10') ? await rt.bringToIntroduction(a, b) : await rt.bringToSuccessApproved(a, b);
        await conclude(f);
        const record = await rt.recordRow(f.record);
        assert.equal(record.introduction_status, label.startsWith('K10') ? 'CLOSED' : 'COMPLETED', `${label} the Introduction concluded`);
        for (const human of [a, b]) {
          const paused = await rt.currentActOf(human);
          await actAs(human);
          const [result] = await rt.reactivate(randomUUID(), randomUUID(), paused.id, null);
          await asRole('postgres');
          assert.equal(result.participation_state, 'ACTIVE', `${label} ${human === a ? 'a' : 'b'} reactivated`);
        }
        assert.ok(!(await candidatesOf(a)).includes(b) && !(await candidatesOf(b)).includes(a), `${label} discovery excludes the pair`);
        await assertBlocked(a, b, label);
        // Case 12: a different pair is not blocked because one of its humans matched someone else.
        await rt.seedMatchable(a, c);
        await rt.assignSex(c, (await rt.currentFacts(b)).sex);
        assert.equal(await blocked(a, c), false, `${label} (a, c) is not blocked`);
        assert.ok((await candidatesOf(a)).includes(c), `${label} and c is a candidate of a`);
      });
    }
  } finally {
    await q('ROLLBACK');
  }
}

/** Cases 9 and 13: a committed terminal event or Match commit and a re-proposal attempt serialize; no fresh proposal. */
async function verifyBlockRaces(report, humans) {
  const [a, b, c, d] = humans;
  await report.section('K12 a decline racing a re-proposal: the preparation waits, then is refused as blocked; the retry answers history (case 9)', async () => {
    const f = await rt.bringToOffered(a, b);
    const snapshot = await freshSnapshot(a, b);
    const extra = await rt.openExtra();
    try {
      await extra.qx('BEGIN');
      await extra.actAsX(a);
      await extra.qx('SELECT * FROM public.decline_matching_proposal_as_first_core_v1($1, $2, $3)', [randomUUID(), f.proposal, f.firstView]);
      await extra.qx('RESET ROLE');
      const [{ pid }] = await rows('SELECT pg_backend_pid() pid');
      const attempt = randomUUID();
      const waiting = outcomeOf(rt.prepare(attempt, snapshot, b));
      assert.equal(await rt.waitForLockWait(extra.qx, pid), true, 'K12 the preparation waits on the decision\'s pair lock');
      await extra.qx('COMMIT');
      const outcome = await waiting;
      assert.equal(outcome?.code, '55000', 'K12 refused');
      assert.match(outcome.message, /MATCHING_PAIR_REPROPOSAL_BLOCKED/u, 'K12 as blocked, after the committed decline');
      assert.equal(await count(P.PROPOSALS, 'id = $1', [attempt]), 0, 'K12 no second proposal');
      const [retry] = await rt.prepare(f.proposal, f.snapshot, a);
      assert.equal(retry.prepared_state, 'FIRST_DECLINED', 'K12 an equivalent retry of the original preparation answers from history');
    } finally {
      await extra.close();
      await rt.cleanupRace([a, b]);
    }
  });

  await report.section('K13 a Match commit racing a re-proposal: no fresh automatic proposal survives the commit (case 13)', async () => {
    const f = await rt.bringToForwarded(c, d);
    const snapshot = await freshSnapshot(c, d);
    const extra = await rt.openExtra();
    try {
      await extra.qx('BEGIN');
      await extra.actAsX(d);
      const ids = matchIds();
      await extra.qx(`SELECT * FROM public.commit_matching_mutual_match_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [ids.command, f.proposal, f.secondView, ids.world, ids.record, ids.firstEpisode, ids.candidateEpisode,
          ids.firstClaim, ids.candidateClaim, ids.firstPause, ids.candidatePause, ids.handoff]);
      await extra.qx('RESET ROLE');
      const [{ pid }] = await rows('SELECT pg_backend_pid() pid');
      const attempt = randomUUID();
      const waiting = outcomeOf(rt.prepare(attempt, snapshot, c));
      assert.equal(await rt.waitForLockWait(extra.qx, pid), true, 'K13 the preparation waits on the Match commit');
      await extra.qx('COMMIT');
      const outcome = await waiting;
      assert.ok(outcome && ['55000', '40001'].includes(outcome.code), 'K13 the preparation is refused');
      assert.match(outcome.message, /MATCHING_PAIR_REPROPOSAL_BLOCKED|MATCHING_ELIGIBILITY_NO_LONGER_CURRENT/u,
        'K13 because the pair is blocked or its humans are no longer eligible - never by preparing');
      assert.equal(await count(P.PROPOSALS, 'id = $1', [attempt]), 0, 'K13 no fresh proposal after the Match commit');
      assert.equal(await blocked(c, d), true, 'K13 and the committed Match blocks the pair');
    } finally {
      await extra.close();
      await rt.cleanupIntroductionRace([c, d]);
    }
  });
}

// ------------------------------------------------------------------ L. R4-A
/** A birth month two months ahead, so a [30, 40] PASS has its horizon at the first of that month, 30-62 days away. */
async function agedWithNearHorizon() {
  const [r] = await rows(`SELECT extract(year FROM t)::int y, extract(month FROM t)::int m,
      extract(epoch FROM (date_trunc('month', t) + interval '2 months') - (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) / 3600 AS hours
      FROM (SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + interval '2 months' AS t) x`);
  // Born in month r.m of year r.y - 41: the [30, 40] PASS is certain until (r.y - 41 + 41)-(r.m)-01 = the first of that month.
  const [h] = await rows(`SELECT extract(epoch FROM (make_timestamp($1, $2, 1, 0, 0, 0) AT TIME ZONE 'UTC') - clock_timestamp()) / 3600 AS hours`, [r.y, r.m]);
  return { birthYear: r.y - 41, birthMonth: r.m, hoursToHorizon: Number(h.hours) };
}

async function verifyHorizon(report, humans) {
  const [a, b] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    const born = await agedWithNearHorizon();
    assert.ok(born.hoursToHorizon > 24 * 28 && born.hoursToHorizon < 24 * 63, 'the fixture horizon is 4-9 weeks away');
    const below = [Math.floor(born.hoursToHorizon) - 1, 72];
    const above = [Math.ceil(born.hoursToHorizon) + 1, Math.ceil(born.hoursToHorizon) + 48];
    for (const [expiry, expected] of [...below.map((e) => [e, 'PREPARED']), ...above.map((e) => [e, 'HORIZON'])]) {
      await report.isolated(`L01 expiry ${expiry}h against an age horizon ${born.hoursToHorizon.toFixed(1)}h away: ${expected}`, async () => {
        await rt.provisionMatchableHuman(a, { profile: [['life_stage', 'settled']], requirements: [['age_range_v1', 'HARD_DEALBREAKER', 'min=30;max=40']], approvedKeys: ['life_stage'] });
        await rt.provisionMatchableHuman(b, { profile: [['life_stage', 'settled']], requirements: [['shared_language', 'SOFT_PREFERENCE', 'arabic']], approvedKeys: ['life_stage'] });
        await rt.recordFacts(a, { sex: 'MALE' });
        await rt.recordFacts(b, { sex: 'FEMALE', birthYear: born.birthYear, birthMonth: born.birthMonth });
        await rt.installPolicies({ expiryHours: expiry, safeFieldKeys: ['life_stage'] });
        const [pair] = await rt.ensurePair(randomUUID(), a, b);
        const snapshot = randomUUID();
        await rt.capture(snapshot, pair.pair_id, a, b);
        const [result] = await rows('SELECT * FROM public.evaluate_matching_structured_requirements_core_v1($1)', [snapshot]);
        assert.equal(result.requirement_outcome, 'PASS', 'L01 the age requirement is PASS at capture');
        const proposal = randomUUID();
        if (expected === 'PREPARED') {
          const [prepared] = await rt.prepare(proposal, snapshot, a);
          assert.equal(prepared.prepared_state, 'PREPARED', 'L01 expires_at < H_min prepares');
        } else {
          await rejected(() => rt.prepare(proposal, snapshot, a), ['55000'], /MATCHING_ELIGIBILITY_HORIZON_EXCEEDED/u);
          assert.equal(await count(P.PROPOSALS, 'pair_id = $1', [pair.pair_id]), 0, 'L01 and nothing is written');
          assert.equal(await blocked(a, b), false, 'L01 and the pair is not blocked: nothing terminal happened');
        }
      });
    }
    await report.isolated('L02 a snapshot with no AGE_RANGE PASS has no horizon condition, whatever the expiry', async () => {
      const f = await rt.seedEligible(a, b, { expiryHours: 24 * 365 * 50 });
      const [prepared] = await rt.prepare(randomUUID(), f.snapshot, a);
      assert.equal(prepared.prepared_state, 'PREPARED');
    });
  } finally {
    await q('ROLLBACK');
  }
}

/** The ONE seam of the lock-wait test: the deadline mint's unit, hours -> seconds. Nothing else in the body changes. */
const DEADLINE_LINE = 'deadline := CURRENT_TIMESTAMP + make_interval(hours => expiry_hours);';
const SECONDS_LINE = 'deadline := CURRENT_TIMESTAMP + make_interval(secs => expiry_hours);';

async function verifyPreparationInstant(report, humans) {
  const [a, b, c, d] = humans;
  const prepareSeam = await rt.captureMatchingSeam(PFN.PREPARE);
  assert.equal(prepareSeam.definition.split(DEADLINE_LINE).length - 1, 1, 'the deadline mint occurs exactly once');
  const install = async (definition) => { await asRole('postgres'); await q(definition); };
  const raceOnce = async (x, y, label) => {
    // Committed fixtures, so a second connection can see them; a 2-unit expiry, read as SECONDS under the seam.
    const f = await rt.seedEligible(x, y, { expiryHours: 2 });
    const extra = await rt.openExtra();
    try {
      await extra.qx('BEGIN');
      const lo = x < y ? x : y;
      const hi = x < y ? y : x;
      await extra.qx('SELECT public.lock_matching_pair_humans_v1($1, $2)', [lo, hi]);
      const [{ pid }] = await rows('SELECT pg_backend_pid() pid');
      const proposal = randomUUID();
      const waiting = outcomeOf(rt.prepare(proposal, f.snapshot, x));
      assert.equal(await rt.waitForLockWait(extra.qx, pid), true, `${label} preparation is observably blocked on the canonical pair lock`);
      const { rows: [{ started }] } = await extra.qx('SELECT xact_start::text started FROM pg_stat_activity WHERE pid = $1', [pid]);
      // Hold the lock until the REAL deadline (transaction instant + 2 s) has passed while the waiter is still blocked.
      for (let i = 0; i < 200; i += 1) {
        const { rows: [{ past }] } = await extra.qx("SELECT clock_timestamp() > $1::timestamptz + interval '2.5 seconds' AS past", [started]);
        if (past) break;
        await new Promise((resolve) => { setTimeout(resolve, 50); });
      }
      const { rows: [{ still }] } = await extra.qx(`SELECT count(*)::int still FROM pg_stat_activity WHERE pid = $1 AND wait_event_type = 'Lock'`, [pid]);
      assert.equal(still, 1, `${label} the deadline passed while the waiter was still blocked`);
      await extra.qx('COMMIT');
      return { outcome: await waiting, proposal, f, started };
    } finally {
      await extra.close();
    }
  };
  try {
    await install(prepareSeam.definition.replace(DEADLINE_LINE, SECONDS_LINE));
    await report.section('L03 a preparation that waited on the pair lock past its deadline is refused 55000, and writes nothing', async () => {
      const { outcome, proposal, f, started } = await raceOnce(a, b, 'L03');
      assert.ok(outcome, 'L03 refused');
      assert.equal(outcome.code, '55000', 'L03 with 55000, not 40P01: no deadlock');
      assert.match(outcome.message, /^MATCHING_PROPOSAL_EXPIRED$/u, 'L03 MATCHING_PROPOSAL_EXPIRED');
      const [{ precedes }] = await rows("SELECT $1::timestamptz + interval '2 seconds' < clock_timestamp() AS precedes", [started]);
      assert.equal(precedes, true, 'L03 the waiter\'s transaction instant preceded the deadline it was refused against');
      assert.equal(await count(P.PROPOSALS, 'pair_id = $1', [f.pair]), 0, 'L03 zero proposals');
      assert.equal(await count(P.TRANSITIONS, 'proposal_id = $1', [proposal]), 0, 'L03 zero transitions');
      assert.equal(await blocked(a, b), false, 'L03 no re-proposal block: nothing terminal happened');
      // Cadence and pending are derived from proposals, so they are unchanged; and the same pair prepares afterwards.
      const [again] = await rt.prepare(randomUUID(), f.snapshot, a);
      assert.equal(again.prepared_state, 'PREPARED', 'L03 the same pair prepares successfully afterwards');
      // The retry of a preparation committed BEFORE its deadline, sent after it, answers from the committed row.
      await new Promise((resolve) => { setTimeout(resolve, 2500); });
      const [retry] = await rt.prepare(again.prepared_proposal_id, f.snapshot, a);
      assert.equal(retry.prepared_proposal_id, again.prepared_proposal_id, 'L03 the retry answers from history after the deadline');
      await rt.cleanupRace([a, b]);
    });
    // THE DISCRIMINATION CONTROL: the same seam and the same interleaving, with the refusal comparing the TRANSACTION
    // instant instead of the real one, creates the PREPARED row - so the test above tells the two clocks apart.
    const defective = prepareSeam.definition.replace(DEADLINE_LINE, SECONDS_LINE)
      .replace('IF deadline <= checked_at THEN', 'IF deadline <= CURRENT_TIMESTAMP THEN');
    assert.notEqual(defective, prepareSeam.definition.replace(DEADLINE_LINE, SECONDS_LINE), 'the control really differs');
    await install(defective);
    await report.section('L04 discrimination control: comparing the transaction instant instead creates a dead PREPARED', async () => {
      const { outcome, f } = await raceOnce(c, d, 'L04');
      assert.equal(outcome, null, 'L04 the defective comparison lets the late preparation through');
      assert.equal(await count(P.PROPOSALS, "pair_id = $1 AND proposal_state = 'PREPARED' AND expires_at < clock_timestamp()", [f.pair]), 1,
        'L04 and leaves a PREPARED whose deadline has already passed');
      await rt.cleanupRace([c, d]);
    });
  } finally {
    await rt.restoreMatchingSeam(prepareSeam);
  }
}

// ------------------------------------------------------------------ M. R4-B
async function verifyIntermediateDecisions(report, humans) {
  const [a, b, c, d] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('M01 a late forward approval is inert: the forward is refused and nothing is disclosed or committed', async () => {
      const f = await rt.bringToOffered(a, b);
      await rt.backdate(f.proposal);
      await actAs(a);
      const approval = randomUUID();
      await rt.approveForward(approval, f.proposal, f.firstView);
      await asRole('postgres');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'FIRST_FORWARD_APPROVED', 'M01 existing behaviour: the approval is written');
      const secondView = randomUUID();
      await rejected(() => rt.forward(randomUUID(), f.proposal, secondView, f.conclusionForCandidate), ['55000'], /MATCHING_PROPOSAL_EXPIRED/u);
      assert.equal(await count(P.VIEWS, 'proposal_id = $1 AND recipient_user_id = $2', [f.proposal, b]), 0, 'M01 no candidate view');
      assert.equal(await count(P.VIEW_STATE, 'proposal_id = $1 AND recipient_user_id = $2', [f.proposal, b]), 0, 'M01 no pointer');
      assert.equal(await count(P.DELIVERY_BINDINGS, 'proposal_id = $1 AND delivered_view_id = $2', [f.proposal, secondView]), 0, 'M01 no binding');
      assert.equal(await count(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'FORWARDED_TO_SECOND'", [f.proposal]), 0, 'M01 no transition');
      await actAs(b);
      await rejected(() => rt.commitMatch(matchIds(), f.proposal, f.firstView), ['55000', '40001', '22023', 'P0002'], /MATCHING_/u);
      await asRole('postgres');
      assert.equal(await count(MATCH.COMMITS, 'proposal_id = $1', [f.proposal]), 0, 'M01 no Match');
      // The sweeper still expires the late FIRST_FORWARD_APPROVED.
      const swept = await sweep();
      assert.ok(swept.expired >= 1, 'M01 the sweeper expires it');
      assert.equal((await rt.proposalRow(f.proposal)).proposal_state, 'EXPIRED');
    });

    await report.isolated('M02 a proposal forwarded in time is refused at commit after its deadline, and nothing is born', async () => {
      const f = await rt.bringToForwarded(a, b);
      await rt.backdate(f.proposal);
      await actAs(b);
      const ids = matchIds();
      await rejected(() => rt.commitMatch(ids, f.proposal, f.secondView), ['55000'], /MATCHING_PROPOSAL_EXPIRED/u);
      await asRole('postgres');
      assert.deepEqual(Object.values(await rt.matchEffects(ids, f.proposal)).every((n) => n === 0), true, 'M02 nothing is born');
    });

    await report.isolated('M03 an offer after the deadline discloses nothing', async () => {
      const f = await rt.seedEligible(a, b);
      const proposal = randomUUID();
      await rt.prepare(proposal, f.snapshot, a);
      const conclusion = await rt.permitted(f.snapshot, a, b, 'You both treat a calm ordinary week as the point of a week.');
      await rt.backdate(proposal);
      await rejected(() => rt.offer(randomUUID(), proposal, randomUUID(), conclusion.id), ['55000'], /MATCHING_PROPOSAL_EXPIRED/u);
      assert.equal(await count(P.VIEWS, 'proposal_id = $1', [proposal]), 0, 'M03 no view');
    });

    await report.isolated('M04 a late decline or withdrawal ends the proposal, discloses nothing, and blocks exactly as EXPIRED', async () => {
      const f = await rt.bringToOffered(a, b);
      await rt.backdate(f.proposal);
      const views = await count(P.VIEWS, 'proposal_id = $1', [f.proposal]);
      await actAs(a);
      await rt.declineFirst(randomUUID(), f.proposal, f.firstView);
      await asRole('postgres');
      assert.equal(await count(P.VIEWS, 'proposal_id = $1', [f.proposal]), views, 'M04 the late decline disclosed nothing');
      assert.equal(await blocked(a, b), true, 'M04 FIRST_DECLINED blocks as EXPIRED would');
      const g = await rt.bringToOffered(c, d);
      await rt.backdate(g.proposal);
      await actAs(c);
      await rt.withdraw(randomUUID(), g.proposal, g.firstView, 'OFFERED_TO_FIRST');
      await asRole('postgres');
      assert.equal(await blocked(c, d), true, 'M04 WITHDRAWN blocks as EXPIRED would');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------------ N. admission, orchestrator, sweeper
async function verifyAdmissionAndOrchestration(report, humans, productionGate) {
  const [a, b, c, d, e] = humans;
  const readiness = await rt.captureMatchingSeam(FN.READINESS);
  const pairSeam = await rt.captureMatchingSeam(FN.PAIR_SEAM);
  await asRole('postgres');
  await q('BEGIN');
  try {
    const familyOnly = (human, facts) => rt.provisionMatchableHuman(human, {
      profile: [['life_stage', 'settled']], requirements: [['marital_status_v1', 'HARD_DEALBREAKER', 'accepted=DIVORCED,NEVER_MARRIED']],
      approvedKeys: ['life_stage'],
    }).then(() => rt.recordFacts(human, facts));

    await report.isolated('N01 the admission refuses on each dimension, and never admits in production', async () => {
      await familyOnly(a, { sex: 'MALE', maritalStatus: 'NEVER_MARRIED' });
      await familyOnly(b, { sex: 'FEMALE', maritalStatus: 'DIVORCED' });
      await familyOnly(c, { sex: 'MALE', maritalStatus: 'NEVER_MARRIED' });
      assert.equal(await admission(a, e), 'NOT_MATCHABLE', 'N01 a human who is not matchable');
      assert.equal(await admission(a, c), 'PAIR_RULE_NOT_SATISFIED', 'N01 a same-sex pair');
      assert.equal(await admission(a, b), 'POLICY_UNCONFIGURED', 'N01 an unconfigured policy');
      await rt.installPolicies({ safeFieldKeys: ['life_stage'] });
      assert.equal(await admission(a, b), 'PRODUCER_UNAVAILABLE', 'N01 production: the Stage 8A producer is unavailable');
      await replaceSeam(FN.READINESS, 'READY');
      assert.equal(await admission(a, b), 'PREREQUISITES_NOT_CLEARED', 'N01 then the pair-scoped CW2-08 seam is not cleared');
      await replaceSeam(FN.PAIR_SEAM, 'CLEARED');
      assert.equal(await admission(b, a), 'ADMITTED', 'N01 only with both synthetic seams does it admit');
      await rt.restoreMatchingSeam(readiness);
      await rt.restoreMatchingSeam(pairSeam);
    });

    await report.isolated('N02 the orchestrator writes nothing in the production posture', async () => {
      await familyOnly(a, { sex: 'MALE', maritalStatus: 'NEVER_MARRIED' });
      await familyOnly(b, { sex: 'FEMALE', maritalStatus: 'DIVORCED' });
      await rt.installPolicies({ safeFieldKeys: ['life_stage'] });
      const before = await rows(`SELECT (SELECT count(*) FROM ${P.PAIRS}) p, (SELECT count(*) FROM ${P.SNAPSHOTS}) s,
          (SELECT count(*) FROM ${P.PROPOSALS}) r, (SELECT count(*) FROM ${P.PRIVATE_NOTES}) n`);
      const result = await orchestrate(a);
      assert.deepEqual(result, { examined: 1, admitted: 0, prepared: 0 }, 'N02 one candidate examined, none admitted');
      assert.deepEqual(await rows(`SELECT (SELECT count(*) FROM ${P.PAIRS}) p, (SELECT count(*) FROM ${P.SNAPSHOTS}) s,
          (SELECT count(*) FROM ${P.PROPOSALS}) r, (SELECT count(*) FROM ${P.PRIVATE_NOTES}) n`), before,
      'N02 zero pairs, snapshots, proposals or private notes written');
    });

    await report.isolated('N03 under synthetic seams it prepares exactly the eligible candidate, once, and never a blocked one', async () => {
      await familyOnly(a, { sex: 'MALE', maritalStatus: 'NEVER_MARRIED' });
      await familyOnly(b, { sex: 'FEMALE', maritalStatus: 'DIVORCED' });
      await familyOnly(d, { sex: 'FEMALE', maritalStatus: 'WIDOWED' }); // a FAIL on a's hard requirement
      await rt.installPolicies({ safeFieldKeys: ['life_stage'] });
      await replaceSeam(FN.READINESS, 'READY');
      await replaceSeam(FN.PAIR_SEAM, 'CLEARED');
      const snapshotsBefore = await count(P.SNAPSHOTS, 'true', []);
      assert.deepEqual(await orchestrate(a), { examined: 2, admitted: 2, prepared: 1 }, 'N03 b is prepared; d is admitted and refused');
      assert.equal(await count(P.PROPOSALS, 'first_recipient_user_id = $1 AND candidate_user_id = $2', [a, b]), 1, 'N03 a -> b PREPARED');
      assert.equal(await count(P.SNAPSHOTS, 'true', []) - snapshotsBefore, 1, 'N03 the refused attempt left no snapshot behind');
      assert.deepEqual(await orchestrate(a), { examined: 1, admitted: 1, prepared: 0 }, 'N03 a second run prepares nothing new');
      await rt.restoreMatchingSeam(readiness);
      await rt.restoreMatchingSeam(pairSeam);
    });

    await report.isolated('N04 the sweeper expires and stales live proposals without any clearance', async () => {
      const f = await rt.seedEligible(a, b);
      const expiring = randomUUID();
      await rt.prepare(expiring, f.snapshot, a);
      await rt.backdate(expiring);
      const g = await rt.seedEligible(c, d);
      const staling = randomUUID();
      await rt.prepare(staling, g.snapshot, c);
      await rt.recordFacts(d, { sex: (await rt.currentFacts(d)).sex, maritalStatus: 'WIDOWED' });
      // The PRODUCTION CW2-08 seam, inside this rolled-back scenario: protective maintenance needs no clearance.
      await q(productionGate.definition);
      assert.equal((await rows('SELECT clearance FROM public.resolve_matching_proposal_prerequisites_v1($1)', [expiring]))[0].clearance,
        'NOT_EVALUATED', 'N04 the CW2-08 seam is not cleared');
      const swept = await sweep();
      assert.ok(swept.expired >= 1 && swept.staled >= 1, 'N04 one expired and one staled');
      assert.equal((await rt.proposalRow(expiring)).proposal_state, 'EXPIRED');
      assert.equal((await rt.proposalRow(staling)).proposal_state, 'STALE');
      assert.equal(await count(P.VIEWS, 'proposal_id = ANY($1::uuid[])', [[expiring, staling]]), 0, 'N04 and disclosed nothing');
    });
  } finally {
    await q('ROLLBACK');
    await rt.restoreMatchingSeam(readiness);
    await rt.restoreMatchingSeam(pairSeam);
  }
}

// ------------------------------------------------------------------ the run
const humans = Array.from({ length: 6 }, () => randomUUID());

await runVerifier('0157', async (setStage) => {
  await rt.client.connect();
  setStage('fixtures');
  await rt.provisionHumans(humans);
  const report = createScenarioReport('0157', { query: q, restore: () => asRole('postgres') });

  setStage('posture');
  await verifyPosture(report);

  const seams = [];
  for (const fn of [PFN.FIRST_NAME, PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE]) {
    seams.push(await rt.captureMatchingSeam(fn));
  }
  try {
    await rt.resolveFirstName(Object.fromEntries(humans.map((h, i) => [h, ['Sara', 'Omar', 'Layla', 'Adam', 'Mona', 'Ali'][i]])));
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();
    setStage('re-proposal block');
    await verifyBlock(report, humans);
    await verifyMatchBlock(report, humans);
    setStage('re-proposal races');
    await verifyBlockRaces(report, humans);
    setStage('horizon');
    await verifyHorizon(report, humans);
    setStage('preparation instant');
    await verifyPreparationInstant(report, humans);
    setStage('intermediate decisions');
    await verifyIntermediateDecisions(report, humans);
    setStage('admission and orchestration');
    await verifyAdmissionAndOrchestration(report, humans, seams[1]);
  } finally {
    await asRole('postgres');
    for (const seam of seams) await rt.restoreMatchingSeam(seam);
  }
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  await asRole('postgres');
  assert.equal((await rows('SELECT readiness FROM public.resolve_matching_compatibility_producer_readiness_v1()'))[0].readiness, 'UNAVAILABLE');
  assert.equal((await rows('SELECT clearance FROM public.resolve_matching_pair_prerequisites_v1($1, $2)', [humans[0], humans[1]]))[0].clearance, 'NOT_EVALUATED');
  assert.equal((await rows('SELECT * FROM public.resolve_matching_proposal_prerequisites_v1($1)', [randomUUID()]))[0].clearance, 'NOT_EVALUATED');
  await rt.cleanupIntroductionRace(humans);
  await rt.removeFixtureHumans(humans);
  for (const table of [P.FACT_VERSIONS, P.FACT_BINDINGS, P.PROPOSALS, P.POLICY_STATE, MATCH.COMMITS]) {
    assert.equal(await count(table, 'true', []), 0, `${table} is empty again: every fixture this verifier committed was removed`);
  }
}, () => rt.client.end().catch(() => undefined));
