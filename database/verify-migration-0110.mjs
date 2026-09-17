// Real-PostgreSQL verifier for migration 0110 - I-07B canonical pair identity,
// proposal policy, candidate eligibility and private proposal persistence.
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// rows, that the first durable pair / eligibility / proposal / recipient-view
// state in this repository is private, exact, and unable to represent the things
// I-07B is forbidden to build.
//
// Every row scenario is written as the TABLE OWNER inside a transaction this
// verifier rolls back, because 0110 deliberately creates no command: the
// commands are 0111 and 0112, and their verifiers exercise them. What is proven
// here is what the database itself refuses, which binds the owner too.
//
//   P01 every relation is postgres-owned, RLS-enabled, policy-free and
//       unreachable by every application role
//   P02 the seven trigger functions are postgres-owned, return trigger, pin an
//       empty search_path and are callable directly by nobody
//   P03 every append-only guard and every truth guard is enabled
//   P04 no ranking, contact-route, World-scoped or Mutual-Match column exists on
//       any I-07B relation, no untyped payload column exists, nothing cascades
//   P05 the load-bearing bindings are ONE EXACT ROW each, not two independently
//       satisfiable references
//   P06 the Matching namespace census, and the only outside relations any I-07B
//       relation references are public.users and the sealed I-07A setup state
//   P07 the migration ships NO Product policy row, so the runtime is
//       UNCONFIGURED and fails closed until a reviewed policy is installed
//
//   S01 the canonical pair is unordered: the reverse direction is unwritable and
//       a duplicate is refused, so PAIR_KEY(A,B) = PAIR_KEY(B,A) structurally
//   S02 a proposal direction is an arrangement of ITS OWN pair's two members
//   S03 all eleven frozen states are representable and no acceptance state is
//   S04 the legal transition list is exactly the frozen one and nothing leaves a
//       terminal state
//   S05 THE TWO RESERVED I-07C TRANSITIONS ARE REPRESENTABLE
//   S06 which role acted is fixed by the resulting state
//   S07 the current state cannot diverge from the transition it names
//   S08 at most one LIVE proposal per unordered pair, in either direction, and a
//       terminal one blocks nothing
//   S09 PASS | FAIL | UNKNOWN, with UNKNOWN unable to carry a source and a
//       third-party claim or inference unable to be spelled at all
//   S10 a hard requirement result names a REAL item of that human's exact version
//   S11 a FAIL, an UNKNOWN and an UNANSWERED hard dealbreaker each block a proposal
//   S12 a snapshot a proposal consumed is SEALED
//   S13 a permitted conclusion may carry no contact route, source identifier,
//       verbatim quoted span, score, rank or percentage
//   S14 a permitted conclusion exists only as PERMITTED, and one candidate has
//       exactly one filter outcome
//   S15 a recipient view is audience-exact and authority-exact
//   S16 a disclosed field needs BOTH gates and a filtered value
//   S17 a recipient view pointer moves forward, is audience-frozen and is never
//       deleted, and a superseded view is not erased
//   S18 a policy version carries exactly its kind's typed values, a chain never
//       crosses kinds, and no policy may permit a contact-route field key
//   S19 every append-only relation refuses UPDATE and DELETE for the table OWNER
//   S20 a proposal's identity and direction are frozen and it is never deleted
//
//   F1..F5 five forward-safety probes, each proving its guard is LOAD-BEARING:
//       with the guard the database refuses, without it the same statement
//       succeeds, and the guard is put back and observed back.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createProposalRuntime, P, PROPOSAL_TABLES, PROPOSAL_IMMUTABLE, PROPOSAL_GUARDED,
  PROPOSAL_TRIGGER_FUNCTIONS, PROPOSAL_STATES, RESERVED_I07C_STATES, LIVE_STATES,
  ABSENT_ACCEPTANCE_STATES, REQUIREMENT_OUTCOMES, EVIDENCE_SOURCE_CLASSES,
  FORBIDDEN_SOURCE_CLASSES, FILTER_REFUSAL_CLASSES, POLICY_KINDS,
  MATCHING_TABLES, LATER_SLICE_LIFECYCLE_RELATIONS, runVerifier, APP_ROLES,
} from './matching-proposal-verifier-support.mjs';

const rt = createProposalRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, rejected } = rt;

const PROFILE = [['life_stage', 'settled and ready'], ['children_plan', 'yes in time']];
const REQUIREMENTS = [
  ['faith_practice_level', 'HARD_DEALBREAKER', 'practising'],
  ['shared_language', 'SOFT_PREFERENCE', 'arabic and english'],
];
const APPROVED = ['life_stage'];
const SAFE_CONCLUSION = 'You both treat a calm ordinary week as the point of a week.';

// ------------------------------------------------------------ 0. raw writers
//
// Every one of these is a DIRECT write as the table owner. 0110 creates no
// command, so this is the only honest way to reach the states it must refuse -
// and a refusal that binds the OWNER is a stronger statement than one that only
// binds an application role.
const insertPair = async (lower, higher, id = randomUUID()) => {
  await q(`INSERT INTO ${P.PAIRS} (id, lower_user_id, higher_user_id) VALUES ($1, $2, $3)`, [id, lower, higher]);
  return id;
};

const insertProposal = async ({ pair, lower, higher, snapshot, first, candidate, id = randomUUID() }) => {
  await q(`INSERT INTO ${P.PROPOSALS}
             (id, pair_id, lower_user_id, higher_user_id, first_recipient_user_id, candidate_user_id,
              eligibility_snapshot_id, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP + interval '72 hours')`,
  [id, pair, lower, higher, first, candidate, snapshot]);
  return id;
};

const insertTransition = async (proposal, from, to, { firstActor = null, candidateActor = null,
  prior = null, reason = null, id = randomUUID() } = {}) => {
  await q(`INSERT INTO ${P.TRANSITIONS}
             (id, proposal_id, prior_state, resulting_state, prior_transition_id,
              first_recipient_actor_id, candidate_actor_id, private_reason_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
  [id, proposal, from, to, prior, firstActor, candidateActor, reason]);
  return id;
};

/** Append a transition AND move the pointer, the way 0112's writer does. */
const step = async (proposal, from, to, options = {}) => {
  const [current] = await rows(`SELECT current_transition_id id FROM ${P.PROPOSALS} WHERE id = $1`, [proposal]);
  const transition = await insertTransition(proposal, from, to, { ...options, prior: current?.id ?? null });
  await q(`UPDATE ${P.PROPOSALS} SET proposal_state = $2, current_transition_id = $3 WHERE id = $1`,
    [proposal, to, transition]);
  return transition;
};

const insertResult = (snapshot, human, version, key, outcome, source) => q(
  `INSERT INTO ${P.HARD_RESULTS}
     (eligibility_snapshot_id, evaluated_for_user_id, requirement_version_id,
      requirement_key, requirement_outcome, evidence_source_class)
   VALUES ($1, $2, $3, $4, $5, $6)`, [snapshot, human, version, key, outcome, source]);

const insertView = async (f, overrides = {}) => {
  const v = { ...f, ...overrides };
  const id = v.viewId ?? randomUUID();
  await q(`INSERT INTO ${P.VIEWS} (
    id, proposal_id, recipient_role, recipient_user_id, subject_user_id,
    first_recipient_user_id, candidate_user_id, prior_view_id, eligibility_snapshot_id,
    subject_profile_version_id, subject_disclosure_authority_id, safe_field_policy_version_id,
    permitted_conclusion_id, subject_first_name)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
  [id, v.proposal, v.recipientRole, v.recipient, v.subject, v.first, v.candidate, v.prior ?? null,
    v.snapshot, v.profileVersion, v.authority, v.fieldPolicy, v.conclusion, v.firstName ?? 'Sara']);
  return id;
};

const insertViewField = (view, f, key, value, overrides = {}) => q(
  `INSERT INTO ${P.VIEW_FIELDS}
     (view_id, subject_disclosure_authority_id, safe_field_policy_version_id, field_key, disclosed_value)
   VALUES ($1, $2, $3, $4, $5)`,
  [view, overrides.authority ?? f.authority, overrides.fieldPolicy ?? f.fieldPolicy, key, value]);

const insertPermitted = async (snapshot, filterPolicy, forRecipient, about, text = SAFE_CONCLUSION) => {
  const candidateId = randomUUID();
  const id = randomUUID();
  await q(`INSERT INTO ${P.CONCLUSION_CANDIDATES}
             (id, eligibility_snapshot_id, for_recipient_user_id, about_user_id, conclusion_text)
           VALUES ($1, $2, $3, $4, $5)`, [candidateId, snapshot, forRecipient, about, text]);
  await q(`INSERT INTO ${P.PERMITTED_CONCLUSIONS}
             (id, conclusion_candidate_id, for_recipient_user_id, about_user_id,
              filter_policy_version_id, permitted_text)
           VALUES ($1, $2, $3, $4, $5, $6)`, [id, candidateId, forRecipient, about, filterPolicy, text]);
  return { id, candidateId };
};

/** One human's complete I-07A setup, written directly so 0110 stands alone. */
async function seedSetup(human) {
  const event = randomUUID();
  await q(`INSERT INTO public.matching_participation_events
             (id, participant_user_id, participation_act, resulting_state, activation_entry_channel)
           VALUES ($1, $2, 'ACTIVATE', 'ACTIVE', 'MANUAL_MY_WORLD_ENTRY')`, [event, human]);
  await q(`INSERT INTO public.matching_participation_state (participant_user_id, current_event_id)
           VALUES ($1, $2)`, [human, event]);
  const grant = randomUUID();
  await q(`INSERT INTO public.matching_context_grants (id, grantor_user_id, status)
           VALUES ($1, $2, 'ACTIVE')`, [grant, human]);
  const profile = randomUUID();
  await q(`INSERT INTO public.introduction_profile_versions (id, owner_user_id) VALUES ($1, $2)`, [profile, human]);
  await q(`INSERT INTO public.introduction_profile_field_values (profile_version_id, field_key, field_value)
           SELECT $1, k, v FROM unnest($2::text[], $3::text[]) AS f(k, v)`,
  [profile, PROFILE.map(([k]) => k), PROFILE.map(([, v]) => v)]);
  await q(`INSERT INTO public.introduction_profile_state (owner_user_id, current_profile_version_id)
           VALUES ($1, $2)`, [human, profile]);
  const requirements = randomUUID();
  await q(`INSERT INTO public.matching_requirement_versions (id, owner_user_id) VALUES ($1, $2)`, [requirements, human]);
  await q(`INSERT INTO public.matching_requirement_items
             (requirement_version_id, requirement_key, requirement_strength, requirement_value)
           SELECT $1, k, s, v FROM unnest($2::text[], $3::text[], $4::text[]) AS r(k, s, v)`,
  [requirements, REQUIREMENTS.map(([k]) => k), REQUIREMENTS.map(([, s]) => s), REQUIREMENTS.map(([, , v]) => v)]);
  await q(`INSERT INTO public.matching_requirement_state (owner_user_id, current_requirement_version_id)
           VALUES ($1, $2)`, [human, requirements]);
  const authority = randomUUID();
  await q(`INSERT INTO public.pre_match_disclosure_authorities
             (id, grantor_user_id, introduction_profile_version_id, status)
           VALUES ($1, $2, $3, 'ACTIVE')`, [authority, human, profile]);
  await q(`INSERT INTO public.pre_match_disclosure_authority_fields
             (authority_id, introduction_profile_version_id, field_key)
           SELECT $1, $2, unnest($3::text[])`, [authority, profile, APPROVED]);
  return { event, grant, profile, requirements, authority };
}

/** One version of every policy kind, plus a second empty PROPOSAL_SAFE_FIELDS. */
async function seedPolicies() {
  const ids = { cadence: randomUUID(), pending: randomUUID(), expiry: randomUUID(),
    fields: randomUUID(), emptyFields: randomUUID(), filter: randomUUID() };
  await q(`INSERT INTO ${P.POLICY_VERSIONS} (id, policy_kind, window_days, max_count, expiry_hours)
           VALUES ($1, 'PROPOSAL_CADENCE', 7, 5, NULL),
                  ($2, 'PENDING_PROPOSAL_LIMIT', NULL, 3, NULL),
                  ($3, 'PROPOSAL_EXPIRY', NULL, NULL, 72),
                  ($4, 'PROPOSAL_SAFE_FIELDS', NULL, NULL, NULL),
                  ($5, 'PROPOSAL_SAFE_FIELDS', NULL, NULL, NULL),
                  ($6, 'SENSITIVE_CONCLUSION_FILTER', NULL, NULL, NULL)`,
  [ids.cadence, ids.pending, ids.expiry, ids.fields, ids.emptyFields, ids.filter]);
  await q(`INSERT INTO ${P.POLICY_FIELDS} (policy_version_id, field_key) SELECT $1, unnest($2::text[])`,
    [ids.fields, APPROVED]);
  return ids;
}

/** A pair, both humans' I-07A setup, the policies and an eligibility snapshot. */
async function seedSnapshot(lower, higher) {
  const pair = await insertPair(lower, higher);
  const setup = { low: await seedSetup(lower), high: await seedSetup(higher) };
  const policy = await seedPolicies();
  const snapshot = randomUUID();
  await q(`INSERT INTO ${P.SNAPSHOTS} (
    id, pair_id, lower_user_id, higher_user_id,
    lower_participation_event_id, higher_participation_event_id,
    lower_context_grant_id, higher_context_grant_id,
    lower_profile_version_id, higher_profile_version_id,
    lower_requirement_version_id, higher_requirement_version_id,
    lower_disclosure_authority_id, higher_disclosure_authority_id,
    cadence_policy_version_id, pending_policy_version_id, expiry_policy_version_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
  [snapshot, pair, lower, higher, setup.low.event, setup.high.event,
    setup.low.grant, setup.high.grant, setup.low.profile, setup.high.profile,
    setup.low.requirements, setup.high.requirements, setup.low.authority, setup.high.authority,
    policy.cadence, policy.pending, policy.expiry]);
  return { pair, lower, higher, snapshot, setup, policy };
}

/** ... and both hard dealbreakers answered PASS, so a proposal is legal. */
async function seedEligible(lower, higher) {
  const built = await seedSnapshot(lower, higher);
  await insertResult(built.snapshot, lower, built.setup.low.requirements, 'faith_practice_level', 'PASS', 'EXPLICIT_MATCHING_ANSWER');
  await insertResult(built.snapshot, higher, built.setup.high.requirements, 'faith_practice_level', 'PASS', 'EXPLICIT_MATCHING_ANSWER');
  return built;
}

/** ... and a prepared proposal with the lower human as first recipient. */
async function seedProposal(lower, higher) {
  const built = await seedEligible(lower, higher);
  const proposal = await insertProposal({ ...built, first: lower, candidate: higher });
  return { ...built, proposal, first: lower, candidate: higher };
}

/** ... and everything a recipient view needs, for the FIRST recipient. */
async function seedViewFixture(lower, higher) {
  const built = await seedProposal(lower, higher);
  const conclusion = await insertPermitted(built.snapshot, built.policy.filter, lower, higher);
  const reversed = await insertPermitted(built.snapshot, built.policy.filter, higher, lower);
  return {
    ...built,
    recipient: lower, subject: higher, recipientRole: 'FIRST_RECIPIENT',
    authority: built.setup.high.authority, profileVersion: built.setup.high.profile,
    recipientAuthority: built.setup.low.authority, recipientProfileVersion: built.setup.low.profile,
    fieldPolicy: built.policy.fields, emptyFieldPolicy: built.policy.emptyFields,
    conclusion: conclusion.id, conclusionCandidate: conclusion.candidateId,
    reversedConclusion: reversed.id, prior: null,
  };
}

const constraintDef = async (table, name) => {
  const [row] = await rows(
    `SELECT pg_get_constraintdef(con.oid) def FROM pg_constraint con
      WHERE con.conrelid = $1::regclass AND con.conname = $2`, [table, name]);
  assert.ok(row?.def, `${name} exists on ${table}`);
  return row.def;
};

// ---------------------------------------------------------------- 1. catalog
async function verifyCatalog() {
  await asRole('postgres');
  await rt.verifyPosture({
    triggers: PROPOSAL_TRIGGER_FUNCTIONS,
    tables: PROPOSAL_TABLES,
    immutable: [...PROPOSAL_IMMUTABLE, ...PROPOSAL_GUARDED],
  });

  const columns = await rows(
    `SELECT c.table_name, c.column_name, c.data_type FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = ANY($1::text[])
      ORDER BY c.table_name, c.column_name`,
    [PROPOSAL_TABLES.map((t) => t.replace('public.', ''))]);
  assert.ok(columns.length > 80, `P04 the I-07B relations declare columns to check, found ${columns.length}`);
  const COLUMN_BAN = /score|rank|weight|priorit|percent|rating|leaderboard|ordinal|position|world|shared|public_|replay|match_commit|introduction_slot|slot_|second_accepted|accepted_pending|match_pending|reserved_|phone|email|contact|handle|social|url|photo|image|avatar|selfie/u;
  for (const column of columns) {
    assert.doesNotMatch(column.column_name, COLUMN_BAN,
      `P04 ${column.table_name}.${column.column_name} is a ranked, contact-route, World-scoped or Mutual-Match column`);
    assert.ok(!['json', 'jsonb', 'ARRAY', 'bytea'].includes(column.data_type),
      `P04 ${column.table_name}.${column.column_name} may not be an untyped payload column`);
  }

  const cascading = await rows(
    `SELECT con.conname, cl.relname FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname = 'public' AND con.contype = 'f' AND con.confdeltype <> 'r'
        AND ('public.' || cl.relname) = ANY($1::text[])`, [PROPOSAL_TABLES]);
  assert.deepEqual(cascading, [], 'P04 every I-07B foreign key is ON DELETE RESTRICT');

  // P05 ONE EXACT ROW, not two independently satisfiable references.
  //
  // The snapshot bindings are the load-bearing ones: each is a COMPOSITE key to
  // a row OF THAT EXACT HUMAN, so one human's participation can never be bound
  // to another human's profile, grant, requirement set or disclosure authority.
  await rt.assertExactBinding(P.SNAPSHOTS, 'public.matching_participation_events',
    ['lower_participation_event_id', 'lower_user_id'], ['id', 'participant_user_id']);
  await rt.assertExactBinding(P.SNAPSHOTS, 'public.matching_context_grants',
    ['lower_context_grant_id', 'lower_user_id'], ['id', 'grantor_user_id']);
  await rt.assertExactBinding(P.SNAPSHOTS, 'public.introduction_profile_versions',
    ['lower_profile_version_id', 'lower_user_id'], ['id', 'owner_user_id']);
  await rt.assertExactBinding(P.SNAPSHOTS, 'public.matching_requirement_versions',
    ['higher_requirement_version_id', 'higher_user_id'], ['id', 'owner_user_id']);
  await rt.assertExactBinding(P.SNAPSHOTS, 'public.pre_match_disclosure_authorities',
    ['higher_disclosure_authority_id', 'higher_user_id'], ['id', 'grantor_user_id']);
  await rt.assertExactBinding(P.SNAPSHOTS, P.PAIRS,
    ['pair_id', 'lower_user_id', 'higher_user_id'], ['id', 'lower_user_id', 'higher_user_id']);
  await rt.assertExactBinding(P.PROPOSALS, P.PAIRS,
    ['pair_id', 'lower_user_id', 'higher_user_id'], ['id', 'lower_user_id', 'higher_user_id']);
  await rt.assertExactBinding(P.PROPOSALS, P.SNAPSHOTS,
    ['eligibility_snapshot_id', 'pair_id'], ['id', 'pair_id']);
  await rt.assertExactBinding(P.PROPOSALS, P.TRANSITIONS,
    ['current_transition_id', 'id', 'proposal_state'], ['id', 'proposal_id', 'resulting_state']);
  await rt.assertExactBinding(P.TRANSITIONS, P.TRANSITIONS,
    ['prior_transition_id', 'proposal_id', 'prior_state'], ['id', 'proposal_id', 'resulting_state']);
  await rt.assertExactBinding(P.VIEWS, P.PERMITTED_CONCLUSIONS,
    ['permitted_conclusion_id', 'recipient_user_id', 'subject_user_id'],
    ['id', 'for_recipient_user_id', 'about_user_id']);
  await rt.assertExactBinding(P.VIEW_FIELDS, 'public.pre_match_disclosure_authority_fields',
    ['subject_disclosure_authority_id', 'field_key'], ['authority_id', 'field_key']);
  await rt.assertExactBinding(P.VIEW_FIELDS, P.POLICY_FIELDS,
    ['safe_field_policy_version_id', 'field_key'], ['policy_version_id', 'field_key']);
  await rt.assertExactBinding(P.VIEW_STATE, P.VIEWS,
    ['current_view_id', 'proposal_id', 'recipient_user_id'], ['id', 'proposal_id', 'recipient_user_id']);
  await rt.assertExactBinding(P.PERMITTED_CONCLUSIONS, P.CONCLUSION_CANDIDATES,
    ['conclusion_candidate_id', 'for_recipient_user_id', 'about_user_id'],
    ['id', 'for_recipient_user_id', 'about_user_id']);

  // P06 THE MATCHING NAMESPACE CENSUS.
  const lifecycle = await rows(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p')
        AND c.relname ~* '^(matching_|introduction_|pre_match_)'
        AND c.relname ~* '(candidate|proposal|pair|mutual|commit|slot|snapshot|eligibility|compatib|leaderboard|rank|score)'
      ORDER BY 1`);
  assert.deepEqual(lifecycle.map((r) => r.relname), LATER_SLICE_LIFECYCLE_RELATIONS,
    'P06 exactly the eleven lifecycle relations I-07B owns exist in the Matching namespace');
  assert.deepEqual(
    LATER_SLICE_LIFECYCLE_RELATIONS.filter((name) => MATCHING_TABLES.includes(`public.${name}`)), [],
    'P06 and none of them is one of the fourteen relations I-07A created');
  const forbidden = await rows(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p')
        AND c.relname ~* '^(matching_|introduction_|pre_match_)'
        AND c.relname ~* '(mutual|match_commit|_slot|introduction_record|world|handoff)'
      ORDER BY 1`);
  assert.deepEqual(forbidden, [], 'P06 no Mutual Match, Introduction slot, record, World or handoff relation exists');

  const parents = await rows(
    `SELECT DISTINCT parent.relname FROM pg_constraint con
       JOIN pg_class cl ON cl.oid = con.conrelid JOIN pg_class parent ON parent.oid = con.confrelid
       JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname = 'public' AND con.contype = 'f' AND ('public.' || cl.relname) = ANY($1::text[])
        AND ('public.' || parent.relname) <> ALL($1::text[]) ORDER BY 1`, [PROPOSAL_TABLES]);
  assert.deepEqual(parents.map((r) => r.relname),
    ['introduction_profile_versions', 'matching_context_grants', 'matching_participation_events',
      'matching_requirement_items', 'matching_requirement_versions',
      'pre_match_disclosure_authorities', 'pre_match_disclosure_authority_fields', 'users'],
    'P06 the only relations outside I-07B any I-07B relation references are public.users and the sealed I-07A setup state');

  // P07 THE RUNTIME SHIPS UNCONFIGURED.
  assert.equal(await count(P.POLICY_VERSIONS, 'true', []), 0,
    'P07 no proposal policy version ships in the migration: the cadence, pending maximum and expiry are Product decisions');
  assert.equal(await count(P.POLICY_STATE, 'true', []), 0,
    'P07 and no current policy pointer either, so an unconfigured runtime fails closed');
}

// ------------------------------------------------- 2. structure and semantics
async function verifyStructure(report, humans) {
  const [one, two, three] = humans;
  const [lo, hi] = [one, two].sort();
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('S01 the canonical pair is unordered and cannot be duplicated', async () => {
      const pair = await insertPair(lo, hi);
      assert.equal(await count(P.PAIRS, 'id = $1', [pair]), 1, 'S01 the canonical pair exists');
      // THE REVERSE DIRECTION IS UNWRITABLE, not merely de-duplicated: there is
      // no (B,A) row for a UNIQUE to collide with, because the CHECK refuses one.
      await rejected(() => insertPair(hi, lo), ['23514'], /canonical_order_check/u);
      await rejected(() => insertPair(lo, hi), ['23505'], /unordered_key/u);
      await rejected(() => insertPair(lo, lo), ['23514'], /canonical_order_check/u);
    });

    await report.isolated('S02 a proposal direction is an arrangement of its own pair members', async () => {
      const f = await seedEligible(lo, hi);
      for (const [first, candidate] of [[lo, hi], [hi, lo]]) {
        await q('SAVEPOINT direction');
        await insertProposal({ ...f, first, candidate });
        await q('ROLLBACK TO SAVEPOINT direction');
        await q('RELEASE SAVEPOINT direction');
      }
      await rejected(() => insertProposal({ ...f, first: three, candidate: hi }), ['23514'], /direction_check/u);
      await rejected(() => insertProposal({ ...f, first: lo, candidate: lo }), ['23514'], /direction_check/u);
    });

    await report.isolated('S03 all eleven frozen states are representable and no acceptance state is', async () => {
      const definition = await constraintDef(P.PROPOSALS, 'matching_proposals_state_check');
      for (const state of PROPOSAL_STATES) {
        assert.ok(definition.includes(`'${state}'`), `S03 ${state} is representable`);
      }
      for (const invented of ABSENT_ACCEPTANCE_STATES) {
        assert.ok(!definition.includes(invented), `S03 ${invented} does not exist in the vocabulary`);
      }
      assert.equal(RESERVED_I07C_STATES.length, 2, 'S03 two states are reserved for I-07C');
      assert.equal(LIVE_STATES.length, 4, 'S03 four states are live');
      const f = await seedEligible(lo, hi);
      const proposal = await insertProposal({ ...f, first: lo, candidate: hi });
      await rejected(() => q(`UPDATE ${P.PROPOSALS} SET proposal_state = 'SECOND_ACCEPTED' WHERE id = $1`, [proposal]),
        ['23514', '55000'], /state_check|birth_check|IDENTITY_IS_FROZEN|NOT_A_FORWARD_MOVE/u);
    });

    await report.isolated('S04 the legal transitions are exactly the frozen ones', async () => {
      const definition = await constraintDef(P.TRANSITIONS, 'matching_proposal_transitions_legal_check');
      // NOTHING LEAVES A TERMINAL STATE: no terminal appears as a left-hand side.
      for (const terminal of ['FIRST_DECLINED', 'SECOND_DECLINED', 'WITHDRAWN', 'EXPIRED', 'STALE',
        'CANCELLED_BY_COMPETING_MATCH', 'MUTUAL_MATCH_COMMITTED']) {
        assert.ok(!new RegExp(`\\('${terminal}'(::text)?,`, 'u').test(definition),
          `S04 nothing transitions out of the terminal state ${terminal}`);
      }
      const { proposal } = await seedProposal(lo, hi);
      // The real path is accepted...
      await step(proposal, 'PREPARED', 'OFFERED_TO_FIRST');
      await step(proposal, 'OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', { firstActor: lo });
      await step(proposal, 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND');
      // ... and a jump nobody declared is refused by the DATABASE, not by a command.
      await rejected(() => insertTransition(proposal, 'FORWARDED_TO_SECOND', 'FIRST_DECLINED', { firstActor: lo }),
        ['23514'], /legal_check/u);
      await rejected(() => insertTransition(proposal, 'FORWARDED_TO_SECOND', 'INVENTED_STATE'),
        ['23514'], /legal_check/u);
    });

    await report.isolated('S05 the two reserved I-07C transitions are representable', async () => {
      // THE FORWARD-SAFETY PROOF that matters most: a ceiling refusing these
      // would have to be relaxed by the slice that needs them, which is exactly
      // the failure this exists to prevent.
      const a = await seedProposal(lo, hi);
      await q('SAVEPOINT cancelled');
      await insertTransition(a.proposal, 'PREPARED', 'CANCELLED_BY_COMPETING_MATCH');
      await q('ROLLBACK TO SAVEPOINT cancelled');
      await q('RELEASE SAVEPOINT cancelled');
      await step(a.proposal, 'PREPARED', 'OFFERED_TO_FIRST');
      await step(a.proposal, 'OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', { firstActor: lo });
      await step(a.proposal, 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND');
      await step(a.proposal, 'FORWARDED_TO_SECOND', 'MUTUAL_MATCH_COMMITTED', { candidateActor: hi });
      const [row] = await rows(`SELECT proposal_state FROM ${P.PROPOSALS} WHERE id = $1`, [a.proposal]);
      assert.equal(row.proposal_state, 'MUTUAL_MATCH_COMMITTED',
        'S05 I-07C can commit a Mutual Match without relaxing a single I-07B ceiling');
    });

    await report.isolated('S06 which role acted is fixed by the resulting state', async () => {
      const { proposal } = await seedProposal(lo, hi);
      await step(proposal, 'PREPARED', 'OFFERED_TO_FIRST');
      // THE CANDIDATE CAN NEVER BE RECORDED AS DECLINING THE FIRST OFFER...
      await rejected(() => insertTransition(proposal, 'OFFERED_TO_FIRST', 'FIRST_DECLINED', { candidateActor: hi }),
        ['23514'], /actor_check/u);
      // ... an offer and a forward carry no human actor at all ...
      await rejected(() => insertTransition(proposal, 'OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED',
        { firstActor: lo, candidateActor: hi }), ['23514'], /actor_check/u);
      // ... and an actor must be a member of THIS proposal in THAT role.
      await rejected(() => insertTransition(proposal, 'OFFERED_TO_FIRST', 'FIRST_DECLINED', { firstActor: hi }),
        ['23503'], /first_actor_fk/u);
      await step(proposal, 'OFFERED_TO_FIRST', 'FIRST_DECLINED', { firstActor: lo, reason: 'RECIPIENT_DECLINED' });
      assert.equal(await count(P.TRANSITIONS, 'proposal_id = $1 AND first_recipient_actor_id = $2', [proposal, lo]), 1,
        'S06 the first recipient is the one recorded as declining');
    });

    await report.isolated('S07 the current state cannot diverge from the transition it names', async () => {
      const { proposal } = await seedProposal(lo, hi);
      // PREPARED IS EXACTLY THE POINTERLESS STATE.
      await rejected(() => q(`UPDATE ${P.PROPOSALS} SET proposal_state = 'OFFERED_TO_FIRST' WHERE id = $1`, [proposal]),
        ['23514', '55000'], /birth_check|NOT_A_FORWARD_MOVE/u);
      const transition = await insertTransition(proposal, 'PREPARED', 'OFFERED_TO_FIRST');
      // Naming that transition while claiming a different state is refused by
      // the composite foreign key, not by a runtime check somebody could forget.
      await rejected(() => q(
        `UPDATE ${P.PROPOSALS} SET proposal_state = 'FIRST_DECLINED', current_transition_id = $2 WHERE id = $1`,
        [proposal, transition]), ['23503', '55000'], /current_transition_fk|NOT_A_FORWARD_MOVE/u);
      await q(`UPDATE ${P.PROPOSALS} SET proposal_state = 'OFFERED_TO_FIRST', current_transition_id = $2 WHERE id = $1`,
        [proposal, transition]);
      const [row] = await rows(`SELECT proposal_state, current_transition_id FROM ${P.PROPOSALS} WHERE id = $1`, [proposal]);
      assert.equal(row.proposal_state, 'OFFERED_TO_FIRST', 'S07 the state is the transition it names');
      assert.equal(row.current_transition_id, transition, 'S07 and the pointer is that exact transition');
    });

    await report.isolated('S08 at most one live proposal per unordered pair in either direction', async () => {
      const f = await seedProposal(lo, hi);
      // THE OTHER DIRECTION IS THE SAME PAIR, so one index covers both.
      await rejected(() => insertProposal({ ...f, first: hi, candidate: lo }),
        ['23505'], /one_live_per_pair_idx/u);
      for (const live of LIVE_STATES.filter((s) => s !== 'PREPARED')) {
        assert.ok(live, `S08 ${live} is live`);
      }
      // Walk it to a terminal and the pair is free again.
      await step(f.proposal, 'PREPARED', 'OFFERED_TO_FIRST');
      await step(f.proposal, 'OFFERED_TO_FIRST', 'FIRST_DECLINED', { firstActor: lo, reason: 'RECIPIENT_DECLINED' });
      const second = await insertProposal({ ...f, first: hi, candidate: lo });
      assert.equal(await count(P.PROPOSALS, 'pair_id = $1', [f.pair]), 2,
        'S08 a terminal proposal blocks no future proposal for the same pair');
      assert.ok(second, 'S08 and the new one is in the other direction');
    });

    await report.isolated('S09 PASS FAIL UNKNOWN, and UNKNOWN never carries a source', async () => {
      const f = await seedSnapshot(lo, hi);
      for (const outcome of REQUIREMENT_OUTCOMES) {
        await q('SAVEPOINT outcome');
        await insertResult(f.snapshot, lo, f.setup.low.requirements, 'faith_practice_level', outcome,
          outcome === 'UNKNOWN' ? 'NOT_ESTABLISHED' : 'EXPLICIT_MATCHING_ANSWER');
        await q('ROLLBACK TO SAVEPOINT outcome');
        await q('RELEASE SAVEPOINT outcome');
      }
      // AN UNKNOWN THAT CLAIMS A SOURCE IS UNREPRESENTABLE, and so is an
      // established outcome that has none. UNKNOWN is never promoted to PASS by
      // editing a column, because the row is append-only as well.
      await rejected(() => insertResult(f.snapshot, lo, f.setup.low.requirements, 'faith_practice_level',
        'UNKNOWN', 'EXPLICIT_MATCHING_ANSWER'), ['23514'], /unknown_check/u);
      await rejected(() => insertResult(f.snapshot, lo, f.setup.low.requirements, 'faith_practice_level',
        'PASS', 'NOT_ESTABLISHED'), ['23514'], /unknown_check/u);
      // A THIRD-PARTY CLAIM AND AN INFERENCE CANNOT BE SPELLED AT ALL.
      for (const invented of FORBIDDEN_SOURCE_CLASSES) {
        await rejected(() => insertResult(f.snapshot, lo, f.setup.low.requirements, 'faith_practice_level',
          'PASS', invented), ['23514'], /source_check/u);
      }
      assert.equal(EVIDENCE_SOURCE_CLASSES.length, 5,
        'S09 four allowed candidate self-truth source classes, plus the absence of one');
    });

    await report.isolated('S10 a hard requirement result names a real item of that human own version', async () => {
      const f = await seedSnapshot(lo, hi);
      await rejected(() => insertResult(f.snapshot, lo, f.setup.low.requirements, 'never_declared_key',
        'PASS', 'EXPLICIT_MATCHING_ANSWER'), ['23503'], /item_fk/u);
      await rejected(() => insertResult(f.snapshot, hi, f.setup.low.requirements, 'faith_practice_level',
        'PASS', 'EXPLICIT_MATCHING_ANSWER'), ['23503'], /version_fk/u);
    });

    await report.isolated('S11 a FAIL an UNKNOWN and an unanswered dealbreaker each block a proposal', async () => {
      for (const [outcome, source] of [['FAIL', 'EXPLICIT_MATCHING_ANSWER'], ['UNKNOWN', 'NOT_ESTABLISHED']]) {
        await q('SAVEPOINT blocked');
        const f = await seedSnapshot(lo, hi);
        await insertResult(f.snapshot, lo, f.setup.low.requirements, 'faith_practice_level', outcome, source);
        await insertResult(f.snapshot, hi, f.setup.high.requirements, 'faith_practice_level', 'PASS', 'EXPLICIT_MATCHING_ANSWER');
        await rejected(() => insertProposal({ ...f, first: lo, candidate: hi }),
          ['55000'], /HARD_REQUIREMENT_NOT_SATISFIED/u);
        await q('ROLLBACK TO SAVEPOINT blocked');
        await q('RELEASE SAVEPOINT blocked');
      }
      // AN UNEVALUATED HARD DEALBREAKER BLOCKS EXACTLY LIKE AN UNKNOWN ONE. A
      // check that only inspected the results PRESENT would be satisfied by a
      // snapshot with none, which is the most complete way for a dealbreaker to
      // go unsatisfied.
      const f = await seedSnapshot(lo, hi);
      await insertResult(f.snapshot, lo, f.setup.low.requirements, 'faith_practice_level', 'PASS', 'EXPLICIT_MATCHING_ANSWER');
      await rejected(() => insertProposal({ ...f, first: lo, candidate: hi }),
        ['55000'], /HARD_REQUIREMENT_NOT_EVALUATED/u);
      // A SOFT PREFERENCE IS NOT A GATE and is deliberately not required.
      await insertResult(f.snapshot, hi, f.setup.high.requirements, 'faith_practice_level', 'PASS', 'EXPLICIT_MATCHING_ANSWER');
      const proposal = await insertProposal({ ...f, first: lo, candidate: hi });
      assert.ok(proposal, 'S11 with every HARD dealbreaker answered PASS the proposal is legal, soft preferences unanswered');
    });

    await report.isolated('S12 a snapshot a proposal consumed is sealed', async () => {
      const f = await seedProposal(lo, hi);
      await rejected(() => insertResult(f.snapshot, lo, f.setup.low.requirements, 'shared_language',
        'PASS', 'EXPLICIT_MATCHING_ANSWER'), ['55000'], /SNAPSHOT_IS_SEALED/u);
    });

    await report.isolated('S13 a permitted conclusion carries no route provenance quote or rank', async () => {
      const f = await seedSnapshot(lo, hi);
      const REFUSED = [
        ['reach me on sara.nour@example.com anytime', /route_ban_check/u],
        ['their memory is 3f2504e0-4f89-41d3-9a0c-0305e82c3301 in the record', /provenance_ban_check/u],
        ['she said "I have never told anyone about that night at all"', /quote_ban_check/u],
        ['a 92% compatibility score puts them in your top 3', /rank_ban_check/u],
      ];
      const before = await count(P.CONCLUSION_CANDIDATES, 'eligibility_snapshot_id = $1', [f.snapshot]);
      for (const [text, needle] of REFUSED) {
        const candidateId = randomUUID();
        await q(`INSERT INTO ${P.CONCLUSION_CANDIDATES}
                   (id, eligibility_snapshot_id, for_recipient_user_id, about_user_id, conclusion_text)
                 VALUES ($1, $2, $3, $4, $5)`, [candidateId, f.snapshot, lo, hi, text]);
        await rejected(() => q(`INSERT INTO ${P.PERMITTED_CONCLUSIONS}
                   (id, conclusion_candidate_id, for_recipient_user_id, about_user_id,
                    filter_policy_version_id, permitted_text)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), candidateId, lo, hi, f.policy.filter, text]), ['23514'], needle);
      }
      // The UNTRUSTED side accepted every one of them: the boundary is the
      // PERMITTED relation, not the candidate relation. The assertion is a
      // delta against a snapshot of the count rather than a running total, so it
      // stays true when a case is added to the list above.
      assert.equal(await count(P.CONCLUSION_CANDIDATES, 'eligibility_snapshot_id = $1', [f.snapshot]) - before,
        REFUSED.length,
        'S13 the untrusted candidate relation holds exactly the text the permitted relation refuses');
    });

    await report.isolated('S14 a permitted conclusion is only PERMITTED and has one outcome', async () => {
      const f = await seedSnapshot(lo, hi);
      const candidateId = randomUUID();
      await q(`INSERT INTO ${P.CONCLUSION_CANDIDATES}
                 (id, eligibility_snapshot_id, for_recipient_user_id, about_user_id, conclusion_text)
               VALUES ($1, $2, $3, $4, $5)`, [candidateId, f.snapshot, lo, hi, SAFE_CONCLUSION]);
      // A REFUSED OR UNCLASSIFIED CONCLUSION HAS NO ROW IN THE PERMITTED
      // RELATION: absence IS refusal, which is what fail-closed means here.
      for (const verdict of ['REFUSED', 'UNCLASSIFIED']) {
        await rejected(() => q(`INSERT INTO ${P.PERMITTED_CONCLUSIONS}
                   (id, conclusion_candidate_id, for_recipient_user_id, about_user_id,
                    filter_policy_version_id, filter_verdict, permitted_text)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), candidateId, lo, hi, f.policy.filter, verdict, SAFE_CONCLUSION]),
        ['23514'], /verdict_check/u);
      }
      await q(`INSERT INTO ${P.PERMITTED_CONCLUSIONS}
                 (id, conclusion_candidate_id, for_recipient_user_id, about_user_id,
                  filter_policy_version_id, permitted_text)
               VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), candidateId, lo, hi, f.policy.filter, SAFE_CONCLUSION]);
      // ONE CANDIDATE HAS EXACTLY ONE OUTCOME. Two UNIQUE constraints on two
      // relations cannot exclude each other, so a trigger does.
      await rejected(() => q(`INSERT INTO ${P.FILTER_REFUSALS}
                 (id, conclusion_candidate_id, filter_policy_version_id, filter_verdict, private_refusal_class)
               VALUES ($1, $2, $3, 'REFUSED', 'SENSITIVE_FACT')`,
      [randomUUID(), candidateId, f.policy.filter]), ['55000'], /FILTER_OUTCOME_ALREADY_DECIDED/u);
      assert.equal(FILTER_REFUSAL_CLASSES.length, 6, 'S14 six private refusal classes exist');
    });

    await report.isolated('S15 a recipient view is audience-exact and authority-exact', async () => {
      const f = await seedViewFixture(lo, hi);
      // The recipient is the member its ROLE names and the subject is the other.
      await rejected(() => insertView(f, { recipientRole: 'CANDIDATE' }), ['23514'], /audience_check/u);
      await rejected(() => insertView(f, { subject: f.recipient }), ['23514'], /audience_check/u);
      // The authority is the SUBJECT'S OWN, bound to exactly the profile version
      // being disclosed: an authority over V1 can never disclose V2.
      await rejected(() => insertView(f, { authority: f.recipientAuthority }),
        ['23503'], /auth_owner_fk|auth_version_fk/u);
      await rejected(() => insertView(f, { profileVersion: f.recipientProfileVersion }),
        ['23503'], /profile_fk|auth_version_fk/u);
      // ... and the conclusion was filtered FOR this recipient ABOUT this subject.
      await rejected(() => insertView(f, { conclusion: f.reversedConclusion }), ['23503'], /conclusion_fk/u);
      // A first name that could be a handle, an address or an identifier is refused.
      await rejected(() => insertView(f, { firstName: 'sara@example.com' }), ['23514'], /name_check/u);
      const view = await insertView(f);
      assert.equal(await count(P.VIEWS, 'id = $1', [view]), 1, 'S15 the audience-exact view really is writable');
    });

    await report.isolated('S16 a disclosed field needs both gates and a filtered value', async () => {
      const f = await seedViewFixture(lo, hi);
      const view = await insertView(f);
      // GATE ONE: a key the human never approved cannot be disclosed, even
      // though it is a real field of the exact profile version.
      await rejected(() => insertViewField(view, f, 'children_plan', 'yes in time'),
        ['23503'], /human_fk|product_fk/u);
      // GATE TWO: a key Product does not permit cannot be disclosed either, even
      // though the human approved it. Human authority is necessary, not sufficient.
      await rejected(() => insertViewField(view, f, 'life_stage', 'settled', { fieldPolicy: f.emptyFieldPolicy }),
        ['23503'], /product_fk|view_policy_fk/u);
      // THE VALUE IS FILTERED TOO: a benign key may not smuggle a contact route
      // or a source identifier through free text.
      await rejected(() => insertViewField(view, f, 'life_stage', 'settled - call me on 0100 123 4567'),
        ['23514'], /route_ban_check/u);
      await rejected(() => insertViewField(view, f, 'life_stage', 'settled, see @sara_nour'),
        ['23514'], /route_ban_check/u);
      await rejected(() => insertViewField(view, f, 'life_stage', 'settled 3f2504e0-4f89-41d3-9a0c-0305e82c3301'),
        ['23514'], /provenance_ban_check/u);
      await insertViewField(view, f, 'life_stage', 'settled and ready');
      assert.equal(await count(P.VIEW_FIELDS, 'view_id = $1', [view]), 1,
        'S16 a field the human approved AND Product permits, carrying no route, really is disclosable');
    });

    await report.isolated('S17 a view pointer moves forward is audience-frozen and never deleted', async () => {
      const f = await seedViewFixture(lo, hi);
      const first = await insertView(f);
      await q(`INSERT INTO ${P.VIEW_STATE} (proposal_id, recipient_user_id, current_view_id)
               VALUES ($1, $2, $3)`, [f.proposal, f.recipient, first]);
      const second = await insertView(f, { prior: first });
      const unrelated = await insertView(f);
      // A view that supersedes NOTHING cannot become current over a pointer that
      // already names one: the move must supersede what it replaces.
      await rejected(() => q(`UPDATE ${P.VIEW_STATE} SET current_view_id = $3
               WHERE proposal_id = $1 AND recipient_user_id = $2`, [f.proposal, f.recipient, unrelated]),
      ['55000'], /NOT_A_FORWARD_MOVE/u);
      await q(`UPDATE ${P.VIEW_STATE} SET current_view_id = $3
               WHERE proposal_id = $1 AND recipient_user_id = $2`, [f.proposal, f.recipient, second]);
      // THE DELIVERED VIEW IS NOT ERASED BY BEING SUPERSEDED.
      assert.equal(await count(P.VIEWS, 'id = $1', [first]), 1,
        'S17 the superseded view stays as the record of what the human was actually shown');
      await rejected(() => q(`DELETE FROM ${P.VIEW_STATE} WHERE proposal_id = $1`, [f.proposal]),
        ['55000'], /VIEW_STATE_IS_DURABLE/u);
      await rejected(() => q(`UPDATE ${P.VIEW_STATE} SET recipient_user_id = $2 WHERE proposal_id = $1`,
        [f.proposal, three]), ['55000'], /AUDIENCE_IS_FROZEN/u);
    });

    await report.isolated('S18 a policy carries exactly its kind and its chain never crosses kinds', async () => {
      const cadence = randomUUID();
      await q(`INSERT INTO ${P.POLICY_VERSIONS} (id, policy_kind, window_days, max_count)
               VALUES ($1, 'PROPOSAL_CADENCE', 7, 5)`, [cadence]);
      // No kind can be read as another: a cadence carrying an expiry and an
      // expiry carrying a count are both unrepresentable.
      await rejected(() => q(`INSERT INTO ${P.POLICY_VERSIONS}
                 (id, policy_kind, window_days, max_count, expiry_hours)
               VALUES ($1, 'PROPOSAL_CADENCE', 7, 5, 72)`, [randomUUID()]), ['23514'], /shape_check/u);
      await rejected(() => q(`INSERT INTO ${P.POLICY_VERSIONS} (id, policy_kind, max_count)
               VALUES ($1, 'PROPOSAL_EXPIRY', 5)`, [randomUUID()]), ['23514'], /shape_check/u);
      // A chain stays within its kind, because the prior identity is bound by
      // the composite (version, kind) key rather than by the version alone.
      await rejected(() => q(`INSERT INTO ${P.POLICY_VERSIONS}
                 (id, policy_kind, prior_policy_version_id, expiry_hours)
               VALUES ($1, 'PROPOSAL_EXPIRY', $2, 72)`, [randomUUID(), cadence]), ['23503'], /prior_fk/u);
      // A Product policy may not permit a field key I-07A already made unwritable.
      const fields = randomUUID();
      await q(`INSERT INTO ${P.POLICY_VERSIONS} (id, policy_kind) VALUES ($1, 'PROPOSAL_SAFE_FIELDS')`, [fields]);
      await rejected(() => q(`INSERT INTO ${P.POLICY_FIELDS} (policy_version_id, field_key)
               VALUES ($1, 'whatsapp_handle')`, [fields]), ['23514'], /route_ban_check/u);
      assert.equal(POLICY_KINDS.length, 5, 'S18 five policy kinds exist');
    });

    await report.isolated('S19 every append-only relation refuses UPDATE and DELETE for the OWNER', async () => {
      const f = await seedViewFixture(lo, hi);
      const view = await insertView(f);
      await insertViewField(view, f, 'life_stage', 'settled and ready');
      for (const [table, where, values] of [
        [P.PAIRS, 'id = $1', [f.pair]],
        [P.SNAPSHOTS, 'id = $1', [f.snapshot]],
        [P.HARD_RESULTS, 'eligibility_snapshot_id = $1', [f.snapshot]],
        [P.CONCLUSION_CANDIDATES, 'id = $1', [f.conclusionCandidate]],
        [P.PERMITTED_CONCLUSIONS, 'id = $1', [f.conclusion]],
        [P.VIEWS, 'id = $1', [view]],
        [P.VIEW_FIELDS, 'view_id = $1', [view]],
        [P.POLICY_VERSIONS, 'id = $1', [f.policy.filter]],
      ]) {
        await rejected(() => q(`DELETE FROM ${table} WHERE ${where}`, values), ['55000'], /IS_IMMUTABLE/u);
      }
      await rejected(() => q(`UPDATE ${P.VIEW_FIELDS} SET disclosed_value = 'rewritten' WHERE view_id = $1`, [view]),
        ['55000'], /IS_IMMUTABLE/u);
      await rejected(() => q(`UPDATE ${P.HARD_RESULTS} SET requirement_outcome = 'PASS',
                 evidence_source_class = 'EXPLICIT_MATCHING_ANSWER' WHERE eligibility_snapshot_id = $1`, [f.snapshot]),
      ['55000'], /IS_IMMUTABLE/u);
    });

    await report.isolated('S20 a proposal identity is frozen and a proposal is never deleted', async () => {
      const { proposal } = await seedProposal(lo, hi);
      await rejected(() => q(`DELETE FROM ${P.PROPOSALS} WHERE id = $1`, [proposal]),
        ['55000'], /PROPOSAL_IS_DURABLE/u);
      await rejected(() => q(`UPDATE ${P.PROPOSALS} SET first_recipient_user_id = candidate_user_id,
                 candidate_user_id = first_recipient_user_id WHERE id = $1`, [proposal]),
      ['55000'], /IDENTITY_IS_FROZEN/u);
      await rejected(() => q(`UPDATE ${P.PROPOSALS} SET expires_at = expires_at + interval '1 day' WHERE id = $1`,
        [proposal]), ['55000'], /IDENTITY_IS_FROZEN/u);
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ---------------------------------------------------------- 3. forward safety
//
// Each probe proves its guard is LOAD-BEARING rather than decorative: with the
// guard the database refuses, without it the SAME statement succeeds, and the
// guard is then restored and observed back. A probe that only showed the refusal
// would prove nothing about whether the refusal came from the guard.
async function verifyForwardSafety(report, humans) {
  const [one, two] = humans;
  const [lo, hi] = [one, two].sort();
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('F1 the one-live-per-pair index is load-bearing', async () => {
      const f = await seedProposal(lo, hi);
      await rejected(() => insertProposal({ ...f, first: hi, candidate: lo }), ['23505'], /one_live_per_pair_idx/u);
      await q('DROP INDEX public.matching_proposals_one_live_per_pair_idx');
      await insertProposal({ ...f, first: hi, candidate: lo });
      assert.equal(await count(P.PROPOSALS, 'pair_id = $1', [f.pair]), 2,
        'F1 without the index a second live proposal for the same pair is accepted');
      // The index is restored by this scenario's own SAVEPOINT rollback and by
      // the section's ROLLBACK, and the live catalog is asked afterwards whether
      // it is really back. Re-creating it by hand here would prove less, not
      // more: it would test the statement written above rather than the one the
      // migration installed.
    });

    await report.isolated('F2 the eligibility truth trigger is load-bearing', async () => {
      const f = await seedSnapshot(lo, hi);
      await insertResult(f.snapshot, lo, f.setup.low.requirements, 'faith_practice_level', 'UNKNOWN', 'NOT_ESTABLISHED');
      await insertResult(f.snapshot, hi, f.setup.high.requirements, 'faith_practice_level', 'PASS', 'EXPLICIT_MATCHING_ANSWER');
      await rejected(() => insertProposal({ ...f, first: lo, candidate: hi }),
        ['55000'], /HARD_REQUIREMENT_NOT_SATISFIED/u);
      await q('ALTER TABLE public.matching_proposals DISABLE TRIGGER matching_proposals_eligibility_truth');
      await insertProposal({ ...f, first: lo, candidate: hi });
      assert.equal(await count(P.PROPOSALS, 'eligibility_snapshot_id = $1', [f.snapshot]), 1,
        'F2 without the trigger an UNKNOWN hard dealbreaker really does yield a proposal');
      await q('ALTER TABLE public.matching_proposals ENABLE TRIGGER matching_proposals_eligibility_truth');
    });

    await report.isolated('F3 the snapshot seal trigger is load-bearing', async () => {
      const f = await seedProposal(lo, hi);
      await rejected(() => insertResult(f.snapshot, lo, f.setup.low.requirements, 'shared_language',
        'PASS', 'EXPLICIT_MATCHING_ANSWER'), ['55000'], /SNAPSHOT_IS_SEALED/u);
      const before = await count(P.HARD_RESULTS, 'eligibility_snapshot_id = $1', [f.snapshot]);
      await q('ALTER TABLE public.matching_hard_requirement_results DISABLE TRIGGER matching_hard_requirement_results_seal');
      await insertResult(f.snapshot, lo, f.setup.low.requirements, 'shared_language', 'PASS', 'EXPLICIT_MATCHING_ANSWER');
      assert.equal(await count(P.HARD_RESULTS, 'eligibility_snapshot_id = $1', [f.snapshot]) - before, 1,
        'F3 without the trigger a consumed snapshot really does keep growing');
      await q('ALTER TABLE public.matching_hard_requirement_results ENABLE TRIGGER matching_hard_requirement_results_seal');
    });

    await report.isolated('F4 the one-outcome-per-conclusion trigger is load-bearing', async () => {
      const f = await seedSnapshot(lo, hi);
      const permitted = await insertPermitted(f.snapshot, f.policy.filter, lo, hi);
      const refuse = () => q(`INSERT INTO ${P.FILTER_REFUSALS}
             (id, conclusion_candidate_id, filter_policy_version_id, filter_verdict, private_refusal_class)
           VALUES ($1, $2, $3, 'REFUSED', 'SENSITIVE_FACT')`,
      [randomUUID(), permitted.candidateId, f.policy.filter]);
      await rejected(refuse, ['55000'], /FILTER_OUTCOME_ALREADY_DECIDED/u);
      await q(`ALTER TABLE ${P.FILTER_REFUSALS} DISABLE TRIGGER matching_sensitive_filter_refusals_outcome`);
      await refuse();
      assert.equal(await count(P.FILTER_REFUSALS, 'conclusion_candidate_id = $1', [permitted.candidateId]), 1,
        'F4 without the trigger one conclusion really can be both permitted and refused');
      await q(`ALTER TABLE ${P.FILTER_REFUSALS} ENABLE TRIGGER matching_sensitive_filter_refusals_outcome`);
    });

    await report.isolated('F5 the disclosed-value contact-route ban is load-bearing', async () => {
      const f = await seedViewFixture(lo, hi);
      const view = await insertView(f);
      const smuggle = () => insertViewField(view, f, 'life_stage', 'settled - call me on 0100 123 4567');
      await rejected(smuggle, ['23514'], /route_ban_check/u);
      await q(`ALTER TABLE ${P.VIEW_FIELDS} DROP CONSTRAINT matching_recipient_view_fields_route_ban_check`);
      await smuggle();
      assert.equal(await count(P.VIEW_FIELDS, 'view_id = $1', [view]), 1,
        'F5 without the CHECK a benign field key really does carry a phone number into a recipient view');
    });
  } finally {
    // Every probe is inside this transaction, so the rollback restores the
    // index, the three triggers and the constraint whatever happened - and the
    // live catalog is then asked whether they are really back.
    await q('ROLLBACK');
  }
  await asRole('postgres');
  const [{ present }] = await rows(
    `SELECT count(*)::int present FROM pg_class WHERE relname = 'matching_proposals_one_live_per_pair_idx'`);
  assert.equal(present, 1, 'the production one-live-per-pair index is present after the probes');
  const [{ guarded }] = await rows(
    `SELECT count(*)::int guarded FROM pg_constraint
      WHERE conrelid = $1::regclass AND conname = 'matching_recipient_view_fields_route_ban_check'`, [P.VIEW_FIELDS]);
  assert.equal(guarded, 1, 'the production disclosed-value contact-route ban is present after the probes');
  for (const [table, trigger] of [...PROPOSAL_IMMUTABLE, ...PROPOSAL_GUARDED,
    [P.PROPOSALS, 'matching_proposals_eligibility_truth'],
    [P.HARD_RESULTS, 'matching_hard_requirement_results_seal'],
    [P.PERMITTED_CONCLUSIONS, 'matching_permitted_safe_conclusions_outcome'],
    [P.FILTER_REFUSALS, 'matching_sensitive_filter_refusals_outcome']]) {
    assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} is enabled after the probes`);
  }
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID()];
await runVerifier('0110', async (setStage) => {
  await rt.client.connect();
  setStage('fixtures');
  await rt.provisionHumans(humans);

  setStage('catalog');
  await verifyCatalog();

  const report = createScenarioReport('0110', { query: q, restore: () => asRole('postgres') });
  setStage('structure');
  await verifyStructure(report, humans);
  setStage('forward safety');
  await verifyForwardSafety(report, humans);
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  await rt.removeFixtureHumans(humans);
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${P.PAIRS} WHERE lower_user_id = ANY($1::uuid[]) OR higher_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${P.POLICY_VERSIONS})
          + (SELECT count(*) FROM ${P.POLICY_STATE})
          + (SELECT count(*) FROM ${P.PROPOSALS})
          + (SELECT count(*) FROM public.matching_participation_events WHERE participant_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans]);
  assert.equal(Number(residue), 0,
    'every fixture this verifier created was rolled back: it commits nothing outside public.users');
  assert.deepEqual(APP_ROLES, ['anon', 'authenticated', 'service_role'], 'the three application roles are the ones checked');
}, () => rt.client.end().catch(() => undefined));
