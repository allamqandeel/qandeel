// Shared support for the I-07A real-PostgreSQL verifiers (migrations 0108 and 0109).
//
// The Matching setup verifiers need almost none of the Connected Worlds fixture
// machinery - there is no World, no Session, no material and no Experience in
// I-07A - so this module composes the Public runtime ONLY for the primitives
// every verifier in this repository shares: the client, the role and identity
// switches, the savepoint-taking `rejected`, the catalog posture helpers and the
// exact-binding assertion. Everything Matching-specific is here: the relation
// and function names, the eleven human boundaries as named wrappers, a fixture
// that is two humans and nothing else, and a teardown that peels the immutable
// act and version CHAINS leaf-first because their self references are
// restrictive by design.
//
// Nothing in this module asserts anything about a migration on its own.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRuntime } from './public-runtime-verifier-support.mjs';

// ------------------------------------------------------------------ relations
export const M = Object.freeze({
  LOCKS: 'public.matching_setup_locks',
  ACTS: 'public.matching_participation_events',
  PARTICIPATION: 'public.matching_participation_state',
  GRANTS: 'public.matching_context_grants',
  CONSENT: 'public.matching_context_consent_events',
  PROFILE_VERSIONS: 'public.introduction_profile_versions',
  PROFILE_FIELDS: 'public.introduction_profile_field_values',
  PROFILE_STATE: 'public.introduction_profile_state',
  REQUIREMENT_VERSIONS: 'public.matching_requirement_versions',
  REQUIREMENT_ITEMS: 'public.matching_requirement_items',
  REQUIREMENT_STATE: 'public.matching_requirement_state',
  AUTHORITIES: 'public.pre_match_disclosure_authorities',
  AUTHORITY_FIELDS: 'public.pre_match_disclosure_authority_fields',
  AUTHORITY_EVENTS: 'public.pre_match_disclosure_authority_events',
});

/** Every relation 0108 creates, in the order the terminal self-assertion names them. */
export const MATCHING_TABLES = [
  M.LOCKS, M.ACTS, M.PARTICIPATION, M.GRANTS, M.CONSENT,
  M.PROFILE_VERSIONS, M.PROFILE_FIELDS, M.PROFILE_STATE,
  M.REQUIREMENT_VERSIONS, M.REQUIREMENT_ITEMS, M.REQUIREMENT_STATE,
  M.AUTHORITIES, M.AUTHORITY_FIELDS, M.AUTHORITY_EVENTS,
];

/** The append-only relations, with the trigger that refuses UPDATE and DELETE. */
export const MATCHING_IMMUTABLE = [
  [M.ACTS, 'matching_participation_events_immutable'],
  [M.CONSENT, 'matching_context_consent_events_immutable'],
  [M.PROFILE_VERSIONS, 'introduction_profile_versions_immutable'],
  [M.PROFILE_FIELDS, 'introduction_profile_field_values_immutable'],
  [M.REQUIREMENT_VERSIONS, 'matching_requirement_versions_immutable'],
  [M.REQUIREMENT_ITEMS, 'matching_requirement_items_immutable'],
  [M.AUTHORITY_FIELDS, 'pre_match_disclosure_authority_fields_immutable'],
  [M.AUTHORITY_EVENTS, 'pre_match_disclosure_authority_events_immutable'],
];

/** The controlled relations, with the truth guard that bounds how they may change. */
export const MATCHING_GUARDED = [
  [M.LOCKS, 'matching_setup_locks_truth'],
  [M.PARTICIPATION, 'matching_participation_state_truth'],
  [M.GRANTS, 'matching_context_grants_status_truth'],
  [M.PROFILE_STATE, 'introduction_profile_state_truth'],
  [M.REQUIREMENT_STATE, 'matching_requirement_state_truth'],
  [M.AUTHORITIES, 'pre_match_disclosure_authorities_status_truth'],
];

/**
 * The candidate / proposal / pair / eligibility words a Matching relation NAME
 * may carry only if a reviewed later slice owns it. This is the JavaScript half
 * of the two censuses below; the SQL half lives in the verifiers that use it.
 */
export const MATCHING_LIFECYCLE_WORDS =
  /(candidate|proposal|pair|mutual|commit|slot|snapshot|eligibility|compatib|leaderboard|rank|score)/u;

/**
 * Every relation in the `matching_` / `introduction_` / `pre_match_` namespace
 * whose name carries one of those words, and which a REVIEWED LATER SLICE owns
 * rather than I-07A. Today that is exactly the eleven I-07B adds in migrations
 * 0110-0112.
 *
 * The `0108` and `0109` censuses compare this against the LIVE catalog, which is
 * precisely what lets them catch a lifecycle relation nobody declared - and
 * I-07B legitimately adds proposal, pair and eligibility state to that same
 * namespace. The intended answer to one being added is to put it HERE, named and
 * owned, exactly as `I-06C` put its new outward Public resolver into the `I-05C`
 * census rather than renaming it out of the pattern. Renaming to dodge a census
 * is the dodge the census exists to prevent.
 *
 * The censuses therefore assert an EQUALITY rather than an emptiness, and they
 * keep both halves of what I-07A actually claimed: every lifecycle-shaped
 * relation in the namespace is one a named later slice owns, AND none of them is
 * one of the fourteen relations 0108 creates.
 */
export const I07B_LIFECYCLE_RELATIONS = [
  'matching_eligibility_snapshots',
  'matching_pairs',
  'matching_proposal_policy_state',
  'matching_proposal_policy_versions',
  'matching_proposal_safe_field_keys',
  'matching_proposal_transitions',
  'matching_proposals',
  'matching_recipient_proposal_view_fields',
  'matching_recipient_proposal_view_state',
  'matching_recipient_proposal_views',
  'matching_safe_conclusion_candidates',
];

/**
 * Every relation I-07C adds in migrations 0113 / 0114: the Mutual Match commit,
 * the Introduction Record, the two birth facts, the active-Introduction claim,
 * the first-approval view binding, the competing-cancellation link and the three
 * handoff relations. They are named here for the same reason the I-07B list is:
 * a census that compares the live catalog must name what a reviewed later slice
 * owns rather than be dodged by renaming. Only `matching_match_commits` carries
 * one of the I-07A census words (`commit`); the 0110 verifier's own census
 * reaches the rest through its own predicate, and each census filters this one
 * reviewed list by the predicate it actually evaluates, so two censuses with
 * different predicates share one ownership registry rather than two lists.
 */
export const I07C_LIFECYCLE_RELATIONS = [
  'introduction_records',
  'matching_active_introduction_claims',
  'matching_forward_approval_view_bindings',
  'matching_match_commits',
  'matching_match_competing_cancellations',
  'matching_match_handoff_fields',
  'matching_match_handoff_package_versions',
  'matching_match_handoff_subjects',
  'shared_world_introduction_started_events',
  'shared_world_matching_birth_events',
];

/**
 * Every relation I-07D adds in migrations 0115 / 0116 / 0117 that ANY lifecycle
 * census predicate can reach.
 *
 * Exactly one of them carries a census word: `introduction_terminal_commits`
 * matches `commit`, because it genuinely is one - the durable one-winner
 * substrate both terminal Introduction transitions converge on. It is NAMED
 * here rather than renamed out of the pattern, which is what the 0108 and 0110
 * censuses ask for in so many words: the point of comparing the LIVE catalog is
 * that a lifecycle relation nobody declared cannot hide from it, and the answer
 * to a reviewed later slice legitimately adding one is to declare it.
 *
 * I-07D's other fifteen relations - the disclosure resource versions and their
 * two typed payloads, the grant fact, the disclosure command, the two
 * Introduction closed-view entitlement relations, the success transition
 * version, its derived required approvers, its approval act chain and current
 * pointer, the two terminal facts and the reactivation record - carry no census
 * word at all, so no census can reach them and none demands them.
 */
export const I07D_LIFECYCLE_RELATIONS = [
  'introduction_terminal_commits',
];

/**
 * The relation `QAN-CW-REM-02` adds in migration 0120: the durable exact-view
 * binding of a TERMINAL human proposal decision.
 *
 * It carries the census word `proposal` because it genuinely is proposal
 * lifecycle state, and it is NAMED here rather than renamed out of the pattern -
 * which is what the 0108, 0109 and 0110 censuses ask for in so many words. A
 * remediation is still a reviewed slice, so it owns what it adds under its own
 * name rather than borrowing I-07B's or I-07C's.
 */
export const REM02_LIFECYCLE_RELATIONS = [
  'matching_proposal_decision_view_bindings',
];

/** The ONE reviewed ownership list every lifecycle census compares against. */
export const LATER_SLICE_LIFECYCLE_RELATIONS = [
  ...I07B_LIFECYCLE_RELATIONS, ...I07C_LIFECYCLE_RELATIONS, ...I07D_LIFECYCLE_RELATIONS,
  ...REM02_LIFECYCLE_RELATIONS,
].sort();

/**
 * The subset of the reviewed ownership list that one census's own predicate can
 * reach. A census asserts equality against exactly this, so a relation the
 * predicate cannot see is never demanded of it and a relation it can see is
 * never allowed to hide.
 */
export const lifecycleCensusOf = (words) => LATER_SLICE_LIFECYCLE_RELATIONS.filter((name) => words.test(name));

/** Chains whose self reference is restrictive, so teardown peels them leaf-first. */
export const MATCHING_CHAINS = [
  [M.ACTS, 'id', 'prior_event_id', 'participant_user_id'],
  [M.PROFILE_VERSIONS, 'id', 'prior_profile_version_id', 'owner_user_id'],
  [M.REQUIREMENT_VERSIONS, 'id', 'prior_requirement_version_id', 'owner_user_id'],
];

// ------------------------------------------------------------------ functions
export const MFN = Object.freeze({
  ACTIVATE: 'public.activate_matching_participation_v1(uuid, text, uuid)',
  PAUSE: 'public.pause_matching_participation_v1(uuid, uuid)',
  RESUME: 'public.resume_matching_participation_v1(uuid, uuid)',
  TURN_OFF: 'public.turn_off_matching_participation_v1(uuid, uuid)',
  GRANT_CONTEXT: 'public.grant_matching_context_v1(uuid, uuid, uuid)',
  REVOKE_CONTEXT: 'public.revoke_matching_context_v1(uuid, uuid)',
  SET_PROFILE: 'public.set_introduction_profile_v1(uuid, text[], text[], uuid)',
  SET_REQUIREMENTS: 'public.set_matching_requirements_v1(uuid, text[], text[], text[], uuid)',
  GRANT_DISCLOSURE: 'public.grant_pre_match_disclosure_authority_v1(uuid, uuid, uuid, text[], uuid)',
  REVOKE_DISCLOSURE: 'public.revoke_pre_match_disclosure_authority_v1(uuid, uuid)',
  SETUP: 'public.get_my_matching_setup_v1()',
});

/** The ten mutations; the projection is deliberately not one of them. */
export const MATCHING_COMMANDS = [
  MFN.ACTIVATE, MFN.PAUSE, MFN.RESUME, MFN.TURN_OFF,
  MFN.GRANT_CONTEXT, MFN.REVOKE_CONTEXT, MFN.SET_PROFILE, MFN.SET_REQUIREMENTS,
  MFN.GRANT_DISCLOSURE, MFN.REVOKE_DISCLOSURE,
];

/** The six trigger functions 0108 installs. */
export const MATCHING_TRIGGER_FUNCTIONS = [
  'public.reject_matching_setup_mutation_v1()',
  'public.matching_authority_status_truth_v1()',
  'public.matching_participation_state_truth_v1()',
  'public.introduction_profile_state_truth_v1()',
  'public.matching_requirement_state_truth_v1()',
  'public.matching_setup_lock_truth_v1()',
];

/** The frozen CW2-06 vocabularies, as the database must be able to spell them. */
export const PARTICIPATION_STATES = ['OFF', 'ACTIVE', 'PAUSED'];
export const PAUSE_REASONS = ['USER_PAUSED', 'ACTIVE_INTRODUCTION', 'POST_INTRODUCTION', 'POST_SUCCESS', 'SYSTEM_POLICY'];
/** The four with NO I-07A producer: representable, never writable by a command here. */
export const RESERVED_PAUSE_REASONS = PAUSE_REASONS.filter((reason) => reason !== 'USER_PAUSED');
export const ENTRY_CHANNELS = ['CONVERSATIONAL_ENTRY', 'MANUAL_MY_WORLD_ENTRY'];
export const REQUIREMENT_STRENGTHS = ['HARD_DEALBREAKER', 'SOFT_PREFERENCE'];

/**
 * Result columns no Matching boundary may ever declare.
 *
 * A Matching setup answer is identities and bounded states. It is never a
 * profile or requirement VALUE, never another human, never a proposal or
 * candidate, and never a contact route: if one of these ever appears as a result
 * column the boundary has stopped being a setup mirror.
 */
export const MATCHING_DISCLOSURE_BAN =
  /field_value|requirement_value|auth_subject|email|phone|contact|credential|candidate|proposal|recipient|pair|mutual|score|rank|percent|compat|world_id|session|turn|conversation_unit|shared_|material|replay|photo|image|audio/u;

// -------------------------------------------------------------------- runtime
export function createMatchingRuntime(databaseUrl) {
  const rt = createRuntime(databaseUrl);
  const { q, rows } = rt;

  // ---- the eleven boundaries, as named wrappers
  const activate = (command, channel, expected = null) =>
    rows('SELECT * FROM public.activate_matching_participation_v1($1, $2, $3)', [command, channel, expected]);
  const pause = (command, expected) =>
    rows('SELECT * FROM public.pause_matching_participation_v1($1, $2)', [command, expected]);
  const resume = (command, expected) =>
    rows('SELECT * FROM public.resume_matching_participation_v1($1, $2)', [command, expected]);
  const turnOff = (command, expected) =>
    rows('SELECT * FROM public.turn_off_matching_participation_v1($1, $2)', [command, expected]);
  const grantContext = (command, grant, expected = null) =>
    rows('SELECT * FROM public.grant_matching_context_v1($1, $2, $3)', [command, grant, expected]);
  const revokeContext = (command, expected) =>
    rows('SELECT * FROM public.revoke_matching_context_v1($1, $2)', [command, expected]);
  const setProfile = (command, fields, expected = null) =>
    rows('SELECT * FROM public.set_introduction_profile_v1($1, $2::text[], $3::text[], $4)',
      [command, fields.map(([key]) => key), fields.map(([, value]) => value), expected]);
  const setRequirements = (command, items, expected = null) =>
    rows('SELECT * FROM public.set_matching_requirements_v1($1, $2::text[], $3::text[], $4::text[], $5)',
      [command, items.map(([key]) => key), items.map(([, strength]) => strength),
        items.map(([, , value]) => value), expected]);
  const grantDisclosure = (command, authority, version, keys, expected = null) =>
    rows('SELECT * FROM public.grant_pre_match_disclosure_authority_v1($1, $2, $3, $4::text[], $5)',
      [command, authority, version, keys, expected]);
  const revokeDisclosure = (command, expected) =>
    rows('SELECT * FROM public.revoke_pre_match_disclosure_authority_v1($1, $2)', [command, expected]);
  const setup = () => rows('SELECT * FROM public.get_my_matching_setup_v1()');

  /** The caller's current participation act id, read as postgres. */
  const currentActOf = async (human) => {
    const [row] = await rows(
      `SELECT s.current_event_id id FROM ${M.PARTICIPATION} s WHERE s.participant_user_id = $1`, [human]);
    return row?.id ?? null;
  };
  /** One act row, in full, read as postgres. */
  const actRow = async (id) => (await rows(`SELECT * FROM ${M.ACTS} e WHERE e.id = $1`, [id]))[0] ?? null;

  /**
   * Writes one participation act DIRECTLY, as postgres, to produce a state that
   * I-07A deliberately has no command for.
   *
   * The four reserved pause reasons belong to I-07C / I-07D, and refusing to
   * fabricate their producer is the point of section 5.1 - but a resume ceiling
   * that were never shown a reserved pause would be a decorative constant. So
   * the verifier reaches the state the only honest way: as the table owner,
   * inside a transaction it rolls back.
   */
  async function simulatePause(human, reason, prior = null) {
    const id = randomUUID();
    await q(
      `INSERT INTO ${M.ACTS} (id, participant_user_id, participation_act, resulting_state,
                              resulting_pause_reason, activation_entry_channel, prior_event_id)
       VALUES ($1, $2, 'PAUSE', 'PAUSED', $3, NULL, $4)`, [id, human, reason, prior]);
    if (prior === null) {
      await q(`INSERT INTO ${M.PARTICIPATION} (participant_user_id, current_event_id) VALUES ($1, $2)`, [human, id]);
    } else {
      await q(`UPDATE ${M.PARTICIPATION} s SET current_event_id = $2, updated_at = CURRENT_TIMESTAMP
                WHERE s.participant_user_id = $1`, [human, id]);
    }
    return id;
  }

  /** Two humans, provisioned through auth.users exactly as every verifier does. */
  async function provisionHumans(humans) {
    await rt.asRole('postgres');
    await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [humans]);
    const [{ n }] = await rows('SELECT count(*)::int n FROM public.users WHERE id = ANY($1::uuid[])', [humans]);
    assert.equal(n, humans.length, 'the auth provisioning trigger created one public.users row per fixture human');
  }

  /**
   * Remove every COMMITTED Matching row of the given humans.
   *
   * Every guard is lifted inside ONE transaction and put back inside the same
   * one, and the three self-referencing chains are peeled leaf-first because
   * their prior-identity references are restrictive on purpose: a single DELETE
   * of a whole chain would be refused row by row.
   */
  async function removeCommittedMatchingSetup(humans) {
    await rt.asRole('postgres');
    await q('BEGIN');
    try {
      for (const [table, trigger] of [...MATCHING_IMMUTABLE, ...MATCHING_GUARDED]) {
        await q(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
      }
      await q(`DELETE FROM ${M.AUTHORITY_EVENTS} WHERE grantor_user_id = ANY($1::uuid[])`, [humans]);
      await q(`DELETE FROM ${M.AUTHORITY_FIELDS} f WHERE f.authority_id IN
                 (SELECT a.id FROM ${M.AUTHORITIES} a WHERE a.grantor_user_id = ANY($1::uuid[]))`, [humans]);
      await q(`DELETE FROM ${M.AUTHORITIES} WHERE grantor_user_id = ANY($1::uuid[])`, [humans]);
      await q(`DELETE FROM ${M.CONSENT} WHERE grantor_user_id = ANY($1::uuid[])`, [humans]);
      await q(`DELETE FROM ${M.GRANTS} WHERE grantor_user_id = ANY($1::uuid[])`, [humans]);
      await q(`DELETE FROM ${M.PARTICIPATION} WHERE participant_user_id = ANY($1::uuid[])`, [humans]);
      await q(`DELETE FROM ${M.PROFILE_STATE} WHERE owner_user_id = ANY($1::uuid[])`, [humans]);
      await q(`DELETE FROM ${M.REQUIREMENT_STATE} WHERE owner_user_id = ANY($1::uuid[])`, [humans]);
      await q(`DELETE FROM ${M.PROFILE_FIELDS} f WHERE f.profile_version_id IN
                 (SELECT v.id FROM ${M.PROFILE_VERSIONS} v WHERE v.owner_user_id = ANY($1::uuid[]))`, [humans]);
      await q(`DELETE FROM ${M.REQUIREMENT_ITEMS} i WHERE i.requirement_version_id IN
                 (SELECT v.id FROM ${M.REQUIREMENT_VERSIONS} v WHERE v.owner_user_id = ANY($1::uuid[]))`, [humans]);
      for (const [table, id, prior, human] of MATCHING_CHAINS) {
        for (let pass = 0; pass < 64; pass += 1) {
          const result = await q(
            `DELETE FROM ${table} t WHERE t.${human} = ANY($1::uuid[])
               AND NOT EXISTS (SELECT 1 FROM ${table} c WHERE c.${prior} = t.${id})`, [humans]);
          if (result.rowCount === 0) break;
        }
      }
      await q(`DELETE FROM ${M.LOCKS} WHERE user_id = ANY($1::uuid[])`, [humans]);
      for (const [table, trigger] of [...MATCHING_IMMUTABLE, ...MATCHING_GUARDED]) {
        await q(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
      }
      await q('COMMIT');
    } catch (error) {
      await q('ROLLBACK').catch(() => undefined);
      throw error;
    }
    for (const [table, trigger] of [...MATCHING_IMMUTABLE, ...MATCHING_GUARDED]) {
      assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} is enabled again after Matching teardown`);
    }
  }

  /** Remove the fixture humans themselves, after every Matching row is gone. */
  async function removeFixtureHumans(humans) {
    await rt.asRole('postgres');
    await q('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [humans]);
    await q('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [humans]);
  }

  return {
    ...rt, M, MFN,
    activate, pause, resume, turnOff, grantContext, revokeContext,
    setProfile, setRequirements, grantDisclosure, revokeDisclosure, setup,
    currentActOf, actRow, simulatePause,
    provisionHumans, removeCommittedMatchingSetup, removeFixtureHumans,
  };
}

export { runVerifier, APP_ROLES } from './public-runtime-verifier-support.mjs';
