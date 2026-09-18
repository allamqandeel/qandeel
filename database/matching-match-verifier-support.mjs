// Shared support for the I-07C real-PostgreSQL verifiers (migrations 0113 and 0114).
//
// It composes the I-07B proposal runtime, because every I-07C fixture is a
// proposal brought to FORWARDED_TO_SECOND through the REAL I-07A and I-07B
// boundaries - never by a direct write - and adds everything I-07C needs: the
// relation and function names, the twelve-identity Match command as one
// wrapper, readers over every Match relation, the fixture ladder from two
// matchable humans to a forwarded proposal, and the lock-wait barrier every race
// must pin its interleaving with.
//
// The two fail-closed seams (the CW2-08 prerequisite and the canonical first
// name) are replaced and restored exactly as the I-07B verifiers do, through the
// inherited helpers, and for the same reason: a verifier that only ever saw the
// refusal would prove that I-07C refuses and nothing else.
//
// Nothing in this module asserts anything about a migration on its own.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createProposalRuntime, P, PFN, MATCH, MATCH_TABLES, MATCH_GUARDS, I07C_MATCH_PRODUCER } from './matching-proposal-verifier-support.mjs';

// ------------------------------------------------------------------ catalog
/** The five trigger functions 0113 installs. */
export const MATCH_TRIGGER_FUNCTIONS = [
  'public.reject_matching_match_mutation_v1()',
  'public.introduction_record_truth_v1()',
  'public.matching_active_introduction_claim_truth_v1()',
  'public.matching_match_commit_truth_v1()',
  'public.matching_match_handoff_truth_v1()',
];

/** The append-only relations, with the trigger that refuses UPDATE and DELETE. */
export const MATCH_IMMUTABLE = MATCH_GUARDS.filter(([, trigger]) => trigger.endsWith('_immutable'));

/** The six reverse bindings onto the commit: DEFERRABLE INITIALLY DEFERRED, and nothing else is. */
export const DEFERRED_REVERSE_BINDINGS = [
  'introduction_records_match_commit_fk',
  'shared_world_matching_birth_events_commit_fk',
  'shared_world_introduction_started_events_commit_fk',
  'matching_active_introduction_claims_commit_fk',
  'matching_match_competing_cancellations_commit_fk',
  'matching_match_handoff_packages_commit_fk',
];

/** The additive candidate keys 0113 places on predecessor relations. */
export const ADDITIVE_PREDECESSOR_KEYS = [
  [P.TRANSITIONS, 'matching_proposal_transitions_first_actor_identity_key', ['id', 'first_recipient_actor_id']],
  [P.TRANSITIONS, 'matching_proposal_transitions_candidate_actor_identity_key', ['id', 'candidate_actor_id']],
  [P.PROPOSALS, 'matching_proposals_pair_identity_key', ['id', 'pair_id', 'lower_user_id', 'higher_user_id']],
  [P.VIEWS, 'matching_recipient_proposal_views_audience_subject_key', ['id', 'recipient_user_id', 'subject_user_id']],
  [P.VIEWS, 'matching_recipient_proposal_views_first_name_key', ['id', 'subject_first_name']],
  [P.VIEWS, 'matching_recipient_proposal_views_conclusion_key', ['id', 'permitted_conclusion_id']],
  ['public.shared_world_membership_episodes', 'shared_world_membership_episodes_world_member_identity_key', ['id', 'world_id', 'user_id']],
];

// ------------------------------------------------------------------ functions
export const MFN_MATCH = Object.freeze({
  COMMIT: 'public.commit_matching_mutual_match_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid)',
  APPROVE: PFN.APPROVE,
});

export const MATCH_COMMIT_SQL =
  'SELECT * FROM public.commit_matching_mutual_match_v1($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)';

/** The twelve input parameter names of the Match core, in order. */
export const MATCH_INPUT_PARAMETERS = [
  'p_command_id', 'p_proposal_id', 'p_expected_view_id', 'p_world_id', 'p_introduction_record_id',
  'p_first_recipient_membership_episode_id', 'p_candidate_membership_episode_id',
  'p_first_recipient_claim_id', 'p_candidate_claim_id',
  'p_first_recipient_pause_event_id', 'p_candidate_pause_event_id', 'p_handoff_package_version_id',
];

/** The nine bounded result columns of the Match core, in order. */
export const MATCH_RESULT_COLUMNS = [
  'outcome', 'committed_match_id', 'matched_proposal_id', 'born_world_id', 'born_introduction_record_id',
  'world_lifecycle', 'world_phase', 'world_birth_basis', 'introduction_record_status',
];

// ---------------------------------------------------------------- vocabularies
export const INTRODUCTION_RECORD_STATUSES = ['ACTIVE', 'COMPLETED', 'CLOSED'];
export const CLAIM_STATES = ['HELD', 'RELEASED'];
export const COMPETING_REASON = 'COMPETING_MATCH_COMMITTED';
export const I07B_PRIVATE_REASONS = [
  'RECIPIENT_DECLINED', 'WITHDRAWN_BY_FIRST_PARTY', 'PROPOSAL_EXPIRED',
  'PARTICIPATION_NOT_ACTIVE', 'MATCHING_CONTEXT_GRANT_CHANGED',
  'INTRODUCTION_PROFILE_VERSION_CHANGED', 'MATCHING_REQUIREMENT_VERSION_CHANGED',
  'DISCLOSURE_AUTHORITY_CHANGED', 'PROPOSAL_POLICY_CHANGED',
  'ACTIVE_INTRODUCTION_PRESENT', 'RECIPIENT_VIEW_SUPERSEDED',
];

/**
 * Result columns the Match core may never declare. A Match answer is the
 * operation, opaque identities the caller supplied and the frozen birth
 * constants: never a counterparty identifier, an authority, a snapshot, evidence,
 * a reason, a competing proposal or anything ranked.
 */
export const MATCH_RESULT_BAN =
  /user_id|counterpart|candidate_user|first_recipient_user|auth|email|phone|contact|handle|snapshot|authority|profile_version|requirement|evidence|provenance|source|private|reason|score|rank|percent|competing|winner|claim/u;

// ------------------------------------------------------------------ fixtures
export const PROFILE = [['life_stage', 'settled and ready'], ['children_plan', 'yes in time'], ['home_city_region', 'the quieter side of town']];
export const REQUIREMENTS = [
  ['faith_practice_level', 'HARD_DEALBREAKER', 'practising'],
  ['shared_language', 'SOFT_PREFERENCE', 'arabic and english'],
];
/** The fields each fixture human approves AND Product permits; `home_city_region` is approved by nobody. */
export const APPROVED = ['life_stage', 'children_plan'];
export const CLEAN = 'You both treat a calm ordinary week as the point of a week.';

/** One fresh set of the ten opaque identities a Match commit creates. */
export const matchIds = () => ({
  command: randomUUID(), world: randomUUID(), record: randomUUID(),
  firstEpisode: randomUUID(), candidateEpisode: randomUUID(),
  firstClaim: randomUUID(), candidateClaim: randomUUID(),
  firstPause: randomUUID(), candidatePause: randomUUID(),
  handoff: randomUUID(),
});

/** The twelve arguments of the Match core, in signature order. */
export const matchArgs = (ids, proposal, view) => [
  ids.command, proposal, view, ids.world, ids.record,
  ids.firstEpisode, ids.candidateEpisode, ids.firstClaim, ids.candidateClaim,
  ids.firstPause, ids.candidatePause, ids.handoff,
];

// -------------------------------------------------------------------- runtime
export function createMatchRuntime(databaseUrl) {
  const rt = createProposalRuntime(databaseUrl);
  const { q, rows, asRole, actAs } = rt;

  // ---- the I-07C boundary, as one wrapper
  const commitMatch = (ids, proposal, view) => rows(MATCH_COMMIT_SQL, matchArgs(ids, proposal, view));

  // ---- readers over every Match relation, as postgres
  const commitRow = async (id) => (await rows(`SELECT * FROM ${MATCH.COMMITS} c WHERE c.id = $1`, [id]))[0] ?? null;
  const recordRow = async (id) => (await rows(`SELECT * FROM ${MATCH.RECORDS} r WHERE r.id = $1`, [id]))[0] ?? null;
  const bindingOf = async (proposal) =>
    (await rows(`SELECT * FROM ${MATCH.BINDINGS} b WHERE b.proposal_id = $1`, [proposal]))[0] ?? null;
  const claimsOf = (human) => rows(`SELECT * FROM ${MATCH.CLAIMS} c WHERE c.user_id = $1 ORDER BY c.claimed_at`, [human]);
  const heldClaimOf = async (human) =>
    (await rows(`SELECT * FROM ${MATCH.CLAIMS} c WHERE c.user_id = $1 AND c.claim_state = 'HELD'`, [human]))[0] ?? null;
  const packageOf = async (commit) =>
    (await rows(`SELECT * FROM ${MATCH.PACKAGES} h WHERE h.match_commit_id = $1`, [commit]))[0] ?? null;
  const subjectsOf = (pkg) =>
    rows(`SELECT * FROM ${MATCH.SUBJECTS} s WHERE s.package_version_id = $1 ORDER BY s.subject_user_id`, [pkg]);
  const fieldsOf = (pkg) =>
    rows(`SELECT * FROM ${MATCH.FIELDS} f WHERE f.package_version_id = $1 ORDER BY f.subject_user_id, f.field_key`, [pkg]);
  const cancellationsOf = (commit) =>
    rows(`SELECT * FROM ${MATCH.CANCELLATIONS} c WHERE c.match_commit_id = $1 ORDER BY c.cancelled_proposal_id`, [commit]);
  const worldRow = async (id) => (await rows('SELECT * FROM public.shared_worlds w WHERE w.id = $1', [id]))[0] ?? null;
  const episodesOf = (world) =>
    rows('SELECT * FROM public.shared_world_membership_episodes e WHERE e.world_id = $1 ORDER BY e.user_id', [world]);
  /** The act one human's current participation pointer names, in full, as postgres. */
  const currentParticipationOf = async (human) => {
    const [row] = await rows(
      `SELECT e.* FROM public.matching_participation_state s
         JOIN public.matching_participation_events e ON e.id = s.current_event_id
        WHERE s.participant_user_id = $1`, [human]);
    return row ?? null;
  };

  /**
   * Everything a Match commit produces, counted by the identities the commit row
   * binds, so a scenario can prove "exactly once" or "nothing at all" with one
   * call. Every count is a semantic cardinality (0, 1 or 2), never a running
   * fixture total.
   */
  async function matchEffects(ids, proposal) {
    const one = async (table, where, values) => Number((await rows(`SELECT count(*) n FROM ${table} WHERE ${where}`, values))[0].n);
    return {
      commits: await one(MATCH.COMMITS, 'id = $1', [ids.command]),
      matchTransitions: await one(P.TRANSITIONS, "proposal_id = $1 AND resulting_state = 'MUTUAL_MATCH_COMMITTED'", [proposal]),
      worlds: await one('public.shared_worlds', 'id = $1', [ids.world]),
      episodes: await one('public.shared_world_membership_episodes', 'world_id = $1', [ids.world]),
      records: await one(MATCH.RECORDS, 'id = $1', [ids.record]),
      births: await one(MATCH.BIRTHS, 'world_id = $1', [ids.world]),
      starts: await one(MATCH.STARTS, 'introduction_record_id = $1', [ids.record]),
      claims: await one(MATCH.CLAIMS, 'match_commit_id = $1', [ids.command]),
      pauses: await one('public.matching_participation_events', "id = ANY($1::uuid[]) AND resulting_pause_reason = 'ACTIVE_INTRODUCTION'", [[ids.firstPause, ids.candidatePause]]),
      cancellations: await one(MATCH.CANCELLATIONS, 'match_commit_id = $1', [ids.command]),
      packages: await one(MATCH.PACKAGES, 'id = $1', [ids.handoff]),
      subjects: await one(MATCH.SUBJECTS, 'package_version_id = $1', [ids.handoff]),
    };
  }

  /** The instant one Match persisted, compared in SQL at full precision. */
  async function instantCoherence(ids) {
    const [row] = await rows(
      `SELECT c.committed_at::text AS committed,
              (SELECT bool_and(x = c.committed_at) FROM unnest(ARRAY[
                 (SELECT w.born_at FROM public.shared_worlds w WHERE w.id = c.world_id),
                 (SELECT min(e.joined_at) FROM public.shared_world_membership_episodes e WHERE e.world_id = c.world_id),
                 (SELECT max(e.joined_at) FROM public.shared_world_membership_episodes e WHERE e.world_id = c.world_id),
                 (SELECT r.started_at FROM ${MATCH.RECORDS} r WHERE r.id = c.introduction_record_id),
                 (SELECT b.occurred_at FROM ${MATCH.BIRTHS} b WHERE b.world_id = c.world_id),
                 (SELECT s.occurred_at FROM ${MATCH.STARTS} s WHERE s.introduction_record_id = c.introduction_record_id),
                 (SELECT min(k.claimed_at) FROM ${MATCH.CLAIMS} k WHERE k.match_commit_id = c.id),
                 (SELECT max(k.claimed_at) FROM ${MATCH.CLAIMS} k WHERE k.match_commit_id = c.id),
                 (SELECT p.occurred_at FROM public.matching_participation_events p WHERE p.id = c.first_recipient_pause_event_id),
                 (SELECT p.occurred_at FROM public.matching_participation_events p WHERE p.id = c.candidate_pause_event_id),
                 (SELECT h.created_at FROM ${MATCH.PACKAGES} h WHERE h.id = c.handoff_package_version_id)
               ]) AS x) AS coherent
         FROM ${MATCH.COMMITS} c WHERE c.id = $1`, [ids.command]);
    return row ?? null;
  }

  // ---- the fixture ladder, through the REAL boundaries
  /**
   * Two humans, each MATCHABLE by construction through the I-07A human commands,
   * and idempotent: a human who is already matchable keeps their identities.
   * The policies are reused when configured, because there is one current
   * pointer per policy kind.
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
      await rt.grantDisclosure(randomUUID(), authority, profile, options.approved ?? APPROVED, null);
      const [state] = await rt.setupState(human);
      byUser[human] = { event: state.participation_event_id, grant, profile, requirements, authority };
    }
    await asRole('postgres');
    const configured = await rows(`SELECT policy_kind, current_policy_version_id id FROM ${P.POLICY_STATE}`);
    const policy = options.reusePolicy ?? (configured.length === 5
      ? Object.fromEntries(configured.map((r) => [{
        PROPOSAL_CADENCE: 'cadence', PENDING_PROPOSAL_LIMIT: 'pending', PROPOSAL_EXPIRY: 'expiry',
        PROPOSAL_SAFE_FIELDS: 'fields', SENSITIVE_CONCLUSION_FILTER: 'filter',
      }[r.policy_kind], r.id]))
      : await rt.installPolicies({
        cadenceMax: options.cadenceMax ?? 8,
        pendingMax: options.pendingMax ?? 4,
        expiryHours: options.expiryHours ?? 72,
        safeFieldKeys: options.safeFieldKeys ?? APPROVED,
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

  /** A permitted conclusion, minted by the REAL filter. */
  async function permitted(snapshot, forRecipient, about, text) {
    const candidateId = randomUUID();
    await rt.submitConclusion(candidateId, snapshot, forRecipient, about, text);
    const [verdict] = await rt.filterConclusion(randomUUID(), candidateId);
    assert.equal(verdict.filter_verdict, 'PERMITTED', 'the fixture conclusion is permitted by the real filter');
    return { id: verdict.permitted_conclusion_id, candidateId };
  }

  /** A proposal OFFERED to the first recipient, through the real boundaries. */
  async function bringToOffered(first, candidate, options = {}) {
    const f = await seedEligible(first, candidate, options);
    const forFirst = await permitted(f.snapshot, first, candidate,
      options.conclusionForFirst ?? `${CLEAN} A settled and unhurried outlook on both sides.`);
    const forCandidate = await permitted(f.snapshot, candidate, first,
      options.conclusionForCandidate ?? `${CLEAN} The same unhurried outlook, from the other side of it.`);
    const proposal = randomUUID();
    await rt.prepare(proposal, f.snapshot, first);
    const firstView = randomUUID();
    const offerCommand = randomUUID();
    await rt.offer(offerCommand, proposal, firstView, forFirst.id);
    return {
      ...f, first, candidate, proposal, firstView, offerCommand,
      conclusionForFirst: forFirst.id, conclusionForCandidate: forCandidate.id,
      candidateConclusionCandidate: forCandidate.candidateId,
    };
  }

  async function bringToApproved(first, candidate, options = {}) {
    const f = await bringToOffered(first, candidate, options);
    await actAs(first);
    const approval = randomUUID();
    await rt.approveForward(approval, f.proposal, f.firstView);
    await asRole('postgres');
    return { ...f, approval };
  }

  /** A proposal FORWARDED to the candidate: the state the Match commit starts from. */
  async function bringToForwarded(first, candidate, options = {}) {
    const f = await bringToApproved(first, candidate, options);
    const secondView = randomUUID();
    await rt.forward(randomUUID(), f.proposal, secondView, f.conclusionForCandidate);
    return { ...f, secondView };
  }

  /**
   * Move one proposal's preparation instant AND its deadline into the past, as
   * the 0112 verifier does: CURRENT_TIMESTAMP is the transaction timestamp, so
   * moving only the deadline back is unsatisfiable against `expires_at >
   * prepared_at`. The identity trigger is lifted for exactly this statement.
   */
  async function backdate(proposal) {
    await asRole('postgres');
    await q(`ALTER TABLE ${P.PROPOSALS} DISABLE TRIGGER matching_proposals_state_truth`);
    await q(`UPDATE ${P.PROPOSALS}
                SET prepared_at = CURRENT_TIMESTAMP - interval '3 hours',
                    expires_at = CURRENT_TIMESTAMP - interval '1 hour'
              WHERE id = $1`, [proposal]);
    await q(`ALTER TABLE ${P.PROPOSALS} ENABLE TRIGGER matching_proposals_state_truth`);
    assert.equal(await rt.triggerEnabled(P.PROPOSALS, 'matching_proposals_state_truth'), true,
      'the proposal identity trigger is enabled again immediately');
  }

  /**
   * Move one proposal's deadline to a REAL instant a short interval from now,
   * read from the database clock rather than the transaction clock, and answer
   * with that exact instant. A race that has to cross a deadline while it waits
   * on a lock needs the moment it must cross, at full precision.
   */
  async function deadlineIn(proposal, interval) {
    await asRole('postgres');
    await q(`ALTER TABLE ${P.PROPOSALS} DISABLE TRIGGER matching_proposals_state_truth`);
    const [row] = await rows(`UPDATE ${P.PROPOSALS}
                                 SET expires_at = clock_timestamp() + $2::interval
                               WHERE id = $1 RETURNING expires_at`, [proposal, interval]);
    await q(`ALTER TABLE ${P.PROPOSALS} ENABLE TRIGGER matching_proposals_state_truth`);
    assert.equal(await rt.triggerEnabled(P.PROPOSALS, 'matching_proposals_state_truth'), true,
      'the proposal identity trigger is enabled again immediately');
    return row.expires_at;
  }

  /** Waits until the database clock - not any transaction clock - is past one instant. */
  async function waitForInstant(deadline) {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const [{ past }] = await rows('SELECT clock_timestamp() > $1::timestamptz AS past', [deadline]);
      if (past) return true;
      await new Promise((resolve) => { setTimeout(resolve, 25); });
    }
    return false;
  }

  /** A bare ACTIVE / INTRODUCTION World with one open episode, written as the owner. */
  async function seedBareIntroductionWorld(human) {
    const world = randomUUID();
    await q(`INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis) VALUES ($1, 'ACTIVE', 'INTRODUCTION', 'MUTUAL_MATCH')`, [world]);
    await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`, [randomUUID(), world, human]);
    return world;
  }

  // ---- the barrier every race pins its interleaving with
  /**
   * Waits until one backend is observably WAITING FOR A LOCK, observed from
   * another connection because the one being watched is busy. A race whose
   * interleaving is not pinned is not a proof: whichever side happens to arrive
   * first decides the outcome and the scenario reports a pass it did not earn.
   */
  async function waitForLockWait(watcher, pid) {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const { rows: [{ waiting }] } = await watcher(
        `SELECT count(*)::int waiting FROM pg_stat_activity
          WHERE pid = $1 AND state = 'active' AND wait_event_type = 'Lock'`, [pid]);
      if (waiting > 0) return true;
      await new Promise((resolve) => { setTimeout(resolve, 25); });
    }
    return false;
  }

  /** A fresh connection with the same wait bounds the secondary uses. */
  async function openExtra() {
    const { Client } = await import('pg');
    const extra = new Client({ connectionString: databaseUrl });
    await extra.connect();
    const qx = (text, values = []) => extra.query(text, values);
    const actAsX = async (uid) => {
      await qx('RESET ROLE');
      await qx("SELECT set_config('request.jwt.claims', $1, false)",
        [uid ? JSON.stringify({ sub: uid, role: 'authenticated' }) : '']);
    };
    await qx("SET lock_timeout = '10s'");
    await qx("SET statement_timeout = '15s'");
    const [{ pid }] = (await qx('SELECT pg_backend_pid() AS pid')).rows;
    const close = async () => {
      await qx('ROLLBACK').catch(() => undefined);
      await extra.end().catch(() => undefined);
    };
    return { qx, actAsX, pid, close };
  }

  /** Remove everything a race committed: Match rows, proposals, policies, setup. */
  async function cleanupRace(humans) {
    await asRole('postgres');
    await rt.removeCommittedProposalState(humans);
    await rt.removeCommittedPolicies();
    await rt.removeCommittedMatchingSetup(humans);
  }

  return {
    ...rt, MATCH, MFN_MATCH,
    commitMatch, commitRow, recordRow, bindingOf, claimsOf, heldClaimOf, packageOf, subjectsOf, fieldsOf,
    cancellationsOf, worldRow, episodesOf, currentParticipationOf, matchEffects, instantCoherence,
    seedMatchable, seedEligible, permitted, bringToOffered, bringToApproved, bringToForwarded, backdate,
    deadlineIn, waitForInstant, seedBareIntroductionWorld, waitForLockWait, openExtra, cleanupRace,
  };
}

export { runVerifier, APP_ROLES } from './matching-proposal-verifier-support.mjs';
export { P, PFN, MATCH, MATCH_TABLES, MATCH_GUARDS, I07C_MATCH_PRODUCER } from './matching-proposal-verifier-support.mjs';
export {
  PROPOSAL_TABLES, PROPOSAL_BOUNDARIES, HUMAN_DECISIONS, DECISION_ENTRY_ORDER, RESERVED_I07C_STATES, LIVE_STATES,
  ABSENT_ACCEPTANCE_STATES, NEUTRAL_OUTCOMES,
} from './matching-proposal-verifier-support.mjs';
export {
  MATCHING_TABLES, I07C_LIFECYCLE_RELATIONS, I07D_LIFECYCLE_RELATIONS, LATER_SLICE_LIFECYCLE_RELATIONS,
} from './matching-proposal-verifier-support.mjs';
