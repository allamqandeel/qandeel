// Real-PostgreSQL verifier for migration 0113 - I-07C Mutual Match, Introduction
// Record, active-Introduction claim, first-approval view binding and Match
// Handoff Package persistence.
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// rows, that the Match persistence is private, exact, and unable to represent
// the things I-07C is forbidden to build - independently of the 0114 core. Every
// row scenario writes the Match graph DIRECTLY as the table owner, on top of a
// proposal brought to FORWARDED_TO_SECOND through the REAL I-07A and I-07B
// boundaries, inside a transaction this verifier rolls back: what is proven here
// is what the database itself refuses, which binds the owner too. The one
// boundary 0114 revises - forward approval - is exercised as the human, because
// its durable view binding is the first acceptance every scenario starts from.
//
//   P01 every relation is postgres-owned, RLS-enabled, policy-free and
//       unreachable by every application role; the five trigger functions are
//       callable by nobody; every guard is enabled
//   P02 no ranking, contact-route, owner, payload, reason or evidence column
//       exists on any I-07C relation, nothing cascades, and matching_proposals
//       carries exactly the eleven columns 0110 gave it - the I-07B column ban
//       is preserved rather than dodged
//   P03 the load-bearing bindings are ONE EXACT ROW each
//   P04 exactly the six reverse bindings onto the commit are deferred and
//       nothing else is
//   P05 the private reason vocabulary is the eleven 0110 codes plus exactly
//       COMPETING_MATCH_COMMITTED
//   P06 the Match-scope census of the Matching namespace is exactly this slice,
//       the seven additive predecessor keys exist, a handoff relation can reach
//       only the exact-view sources, and no Match relation binds a private one
//   P07 exactly the reviewed I-07C core produces a commit, a claim, a record or
//       a handoff, and exactly the revised forward approval produces a binding
//
//   S01 the whole Match graph is representable, bound exactly once, at ONE instant
//   S02 one proposal -> at most one commit; one commit -> one World, one record,
//       one of each fact, one handoff
//   S03 the commit IS the Match transition of its own proposal
//   S04 the first acceptance is a durable binding onto the exact approving
//       transition, human and FIRST_RECIPIENT view, written by the real approval
//   S05 an Introduction Record is born ACTIVE; COMPLETED and CLOSED are
//       representable, reached only by the one terminal move, never reopened
//   S06 a claim is born HELD for a matched human, at most one HELD per human,
//       RELEASED representable and reached only by the one release move, and two
//       claims of one commit always reference one record and one World
//   S07 the commit truth guard: a World that is not ACTIVE / INTRODUCTION /
//       MUTUAL_MATCH, a third member, a pause that is not ACTIVE_INTRODUCTION
//       and a second instant are each refused
//   S08 one WORLD_BIRTH per World and one INTRODUCTION_STARTED per record
//   S09 the handoff ceiling is structural: a field not in the view, a value not
//       the view's, a name not the view's, a conclusion not the view's, a refused
//       candidate, a view not in the package and a stranger subject are each
//       refused
//   S10 COMPETING_MATCH_COMMITTED is representable and an invented reason is not
//   S11 the competing cancellation link binds exactly one CANCELLED_BY_COMPETING_MATCH
//       transition per proposal
//   S12 a deferred reverse binding is enforcement, not absence: it is refused
//       at the flush
//   S13 every immutable relation refuses UPDATE and DELETE for the OWNER
//
//   F1..F4 forward-safety probes, each proving its guard LOAD-BEARING
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createMatchRuntime, P, MATCH, MATCH_TABLES, MATCH_GUARDS, MATCH_IMMUTABLE, MATCH_TRIGGER_FUNCTIONS,
  DEFERRED_REVERSE_BINDINGS, ADDITIVE_PREDECESSOR_KEYS, INTRODUCTION_RECORD_STATUSES, CLAIM_STATES,
  COMPETING_REASON, I07B_PRIVATE_REASONS, I07C_LIFECYCLE_RELATIONS, I07C_MATCH_PRODUCER, PROPOSAL_TABLES,
  MFN_MATCH, PFN, matchIds, runVerifier, APP_ROLES,
} from './matching-match-verifier-support.mjs';

const rt = createMatchRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const DEFERRED_LIST = DEFERRED_REVERSE_BINDINGS.map((name) => `public.${name}`).join(', ');
/** The eleven columns 0110 gave `matching_proposals`, which I-07C may not extend. */
const PROPOSAL_COLUMNS_0110 = [
  'candidate_user_id', 'current_transition_id', 'eligibility_snapshot_id', 'expires_at',
  'first_recipient_user_id', 'higher_user_id', 'id', 'lower_user_id', 'pair_id', 'prepared_at', 'proposal_state',
];

// ------------------------------------------------------------ 0. raw writers
//
// Every one of these is a DIRECT write as the table owner. 0113 creates no
// command, so this is the only honest way to reach the states it must refuse -
// and a refusal that binds the OWNER is a stronger statement than one that only
// binds an application role.

/** One database-owned instant, carried as TEXT so no JavaScript Date can truncate it. */
const instantNow = async () => (await rows('SELECT clock_timestamp()::text AS at'))[0].at;

async function insertCommit(f, ids, instant, overrides = {}) {
  const c = {
    id: ids.command, proposal: f.proposal, pair: f.pair, lower: f.lower, higher: f.higher,
    first: f.first, candidate: f.candidate, approvalTransition: f.approval, approvedView: f.firstView,
    secondView: f.secondView, record: ids.record, world: ids.world,
    firstEpisode: ids.firstEpisode, candidateEpisode: ids.candidateEpisode,
    firstClaim: ids.firstClaim, candidateClaim: ids.candidateClaim,
    firstPause: ids.firstPause, candidatePause: ids.candidatePause, handoff: ids.handoff,
    committedAt: instant, ...overrides,
  };
  await q(`INSERT INTO ${MATCH.COMMITS}
             (id, proposal_id, pair_id, lower_user_id, higher_user_id, first_recipient_user_id, candidate_user_id,
              first_approval_transition_id, first_approved_view_id, candidate_accepted_view_id,
              introduction_record_id, world_id,
              first_recipient_membership_episode_id, candidate_membership_episode_id,
              first_recipient_claim_id, candidate_claim_id,
              first_recipient_pause_event_id, candidate_pause_event_id,
              handoff_package_version_id, committed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::timestamptz)`,
  [c.id, c.proposal, c.pair, c.lower, c.higher, c.first, c.candidate, c.approvalTransition, c.approvedView,
    c.secondView, c.record, c.world, c.firstEpisode, c.candidateEpisode, c.firstClaim, c.candidateClaim,
    c.firstPause, c.candidatePause, c.handoff, c.committedAt]);
}

/**
 * The whole Match graph, written directly in the order 0114 writes it, with one
 * instant carried as text so every persisted moment is byte-equal. `options`
 * bend exactly one dimension at a time, so a refusal names the invariant under
 * test and nothing else.
 */
async function seedMatchGraph(f, options = {}) {
  const ids = { ...matchIds(), ...(options.ids ?? {}) };
  const instant = options.instant ?? await instantNow();
  const transitionId = options.transitionId ?? ids.command;
  await q(`SET CONSTRAINTS ${DEFERRED_LIST} DEFERRED`);
  const [current] = await rows(`SELECT current_transition_id id FROM ${P.PROPOSALS} WHERE id = $1`, [f.proposal]);
  await q(`INSERT INTO ${P.TRANSITIONS}
             (id, proposal_id, prior_state, resulting_state, prior_transition_id,
              first_recipient_actor_id, candidate_actor_id, private_reason_code)
           VALUES ($1, $2, 'FORWARDED_TO_SECOND', 'MUTUAL_MATCH_COMMITTED', $3, NULL, $4, NULL)`,
  [transitionId, f.proposal, current.id, f.candidate]);
  await q(`UPDATE ${P.PROPOSALS} SET proposal_state = 'MUTUAL_MATCH_COMMITTED', current_transition_id = $2 WHERE id = $1`,
    [f.proposal, transitionId]);
  const world = { lifecycle: 'ACTIVE', phase: 'INTRODUCTION', basis: 'MUTUAL_MATCH', bornAt: instant, ...(options.world ?? {}) };
  await q(`INSERT INTO public.shared_worlds (id, lifecycle, phase, birth_basis, born_at, closed_at)
           VALUES ($1, $2, $3, $4, $5::timestamptz, CASE WHEN $2 = 'READ_ONLY_CLOSED' THEN $5::timestamptz ELSE NULL END)`,
  [ids.world, world.lifecycle, world.phase, world.basis, world.bornAt]);
  await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at)
           VALUES ($1, $3, $4, $6::timestamptz, NULL), ($2, $3, $5, $6::timestamptz, NULL)`,
  [ids.firstEpisode, ids.candidateEpisode, ids.world, f.first, f.candidate, instant]);
  if (options.thirdMember) {
    await q(`INSERT INTO public.shared_world_membership_episodes (id, world_id, user_id, joined_at, ended_at)
             VALUES ($1, $2, $3, $4::timestamptz, NULL)`, [randomUUID(), ids.world, options.thirdMember, instant]);
  }
  await q(`INSERT INTO ${MATCH.RECORDS}
             (id, match_commit_id, world_id, pair_id, lower_user_id, higher_user_id, introduction_status, started_at, ended_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7::timestamptz, NULL)`,
  [ids.record, ids.command, ids.world, f.pair, f.lower, f.higher, instant]);
  await q(`INSERT INTO ${MATCH.BIRTHS} (world_id, match_commit_id, introduction_record_id, occurred_at)
           VALUES ($1, $2, $3, $4::timestamptz)`, [ids.world, ids.command, ids.record, instant]);
  await q(`INSERT INTO ${MATCH.STARTS} (introduction_record_id, world_id, match_commit_id, occurred_at)
           VALUES ($1, $2, $3, $4::timestamptz)`, [ids.record, ids.world, ids.command, instant]);
  await q(`INSERT INTO ${MATCH.CLAIMS} (id, user_id, match_commit_id, introduction_record_id, world_id, claim_state, claimed_at)
           VALUES ($1, $3, $5, $6, $7, 'HELD', $8::timestamptz), ($2, $4, $5, $6, $7, 'HELD', $8::timestamptz)`,
  [ids.firstClaim, ids.candidateClaim, f.first, f.candidate, ids.command, ids.record, ids.world, instant]);
  const firstAct = await rt.currentParticipationOf(f.first);
  const candidateAct = await rt.currentParticipationOf(f.candidate);
  const reason = options.pauseReason ?? 'ACTIVE_INTRODUCTION';
  await q(`INSERT INTO public.matching_participation_events
             (id, participant_user_id, participation_act, resulting_state, resulting_pause_reason,
              activation_entry_channel, prior_event_id, occurred_at)
           VALUES ($1, $3, 'PAUSE', 'PAUSED', $7, NULL, $5, $8::timestamptz),
                  ($2, $4, 'PAUSE', 'PAUSED', $7, NULL, $6, $8::timestamptz)`,
  [ids.firstPause, ids.candidatePause, f.first, f.candidate, firstAct.id, candidateAct.id, reason, instant]);
  await q(`UPDATE public.matching_participation_state SET current_event_id = $2, updated_at = $3::timestamptz
            WHERE participant_user_id = $1`, [f.first, ids.firstPause, instant]);
  await q(`UPDATE public.matching_participation_state SET current_event_id = $2, updated_at = $3::timestamptz
            WHERE participant_user_id = $1`, [f.candidate, ids.candidatePause, instant]);
  await q(`INSERT INTO ${MATCH.PACKAGES}
             (id, match_commit_id, introduction_record_id, world_id, proposal_id,
              first_recipient_user_id, candidate_user_id, first_recipient_view_id, candidate_view_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)`,
  [ids.handoff, ids.command, ids.record, ids.world, f.proposal, f.first, f.candidate, f.firstView, f.secondView, instant]);
  await q(`INSERT INTO ${MATCH.SUBJECTS}
             (package_version_id, proposal_id, presented_to_user_id, subject_user_id, source_view_id,
              permitted_conclusion_id, presented_first_name, safe_compatibility_conclusion)
           SELECT $1, v.proposal_id, v.recipient_user_id, v.subject_user_id, v.id,
                  v.permitted_conclusion_id, v.subject_first_name, c.permitted_text
             FROM ${P.VIEWS} v JOIN ${P.PERMITTED_CONCLUSIONS} c ON c.id = v.permitted_conclusion_id
            WHERE v.id = ANY($2::uuid[])`, [ids.handoff, [f.firstView, f.secondView]]);
  await q(`INSERT INTO ${MATCH.FIELDS} (package_version_id, subject_user_id, source_view_id, field_key, disclosed_value)
           SELECT $1, v.subject_user_id, fl.view_id, fl.field_key, fl.disclosed_value
             FROM ${P.VIEW_FIELDS} fl JOIN ${P.VIEWS} v ON v.id = fl.view_id
            WHERE fl.view_id = ANY($2::uuid[])`, [ids.handoff, [f.firstView, f.secondView]]);
  if (options.skipCommit) return { ids, instant };
  await insertCommit(f, ids, instant, options.commit ?? {});
  await q(`SET CONSTRAINTS ${DEFERRED_LIST} IMMEDIATE`);
  return { ids, instant };
}

const constraintDef = async (table, name) => {
  const [row] = await rows(
    `SELECT pg_get_constraintdef(con.oid) def FROM pg_constraint con
      WHERE con.conrelid = $1::regclass AND con.conname = $2`, [table, name]);
  assert.ok(row?.def, `${name} exists on ${table}`);
  return row.def;
};

/** `table` carries a restrictive foreign key mapping exactly `local` onto `parentColumns` of `parent`. */
async function assertBinding(table, parent, local, parentColumns) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const bindings = await rt.foreignKeysInto(table, parent);
  assert.ok(bindings.some((b) => b.confdeltype === 'r' && same(b.local_columns, local) && same(b.parent_columns, parentColumns)),
    `${table} binds ${parent} as ONE exact row: (${local.join(', ')}) -> (${parentColumns.join(', ')}), restrictively`);
}

// ---------------------------------------------------------------- 1. catalog
async function verifyCatalog() {
  await asRole('postgres');
  await rt.verifyPosture({ triggers: MATCH_TRIGGER_FUNCTIONS, tables: MATCH_TABLES, immutable: MATCH_GUARDS });

  // P02 SEMANTICS ARE FIXED BY TABLE IDENTITY.
  const columns = await rows(
    `SELECT c.table_name, c.column_name, c.data_type FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = ANY($1::text[])
      ORDER BY c.table_name, c.column_name`, [MATCH_TABLES.map((t) => t.replace('public.', ''))]);
  assert.ok(columns.length > 60, `P02 the I-07C relations declare columns to check, found ${columns.length}`);
  const COLUMN_BAN = /score|rank|weight|priorit|percent|rating|leaderboard|ordinal|position|owner|admin|creator|initiator|privilege|role|capability|kind|event_type|payload|metadata|scope|permission|second_accepted|accepted_pending|match_pending|reserved_|phone|email|contact|handle|social|url|photo|image|avatar|selfie|reason|evidence|provenance|refusal|snapshot|grant|requirement|note|source_class/u;
  for (const column of columns) {
    assert.doesNotMatch(column.column_name, COLUMN_BAN,
      `P02 ${column.table_name}.${column.column_name} is a ranked, contact-route, owner, payload, reason or evidence column`);
    assert.ok(!['json', 'jsonb', 'ARRAY', 'bytea'].includes(column.data_type),
      `P02 ${column.table_name}.${column.column_name} may not be an untyped payload column`);
  }
  const cascading = await rows(
    `SELECT con.conname FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname = 'public' AND con.contype = 'f' AND con.confdeltype <> 'r'
        AND ('public.' || cl.relname) = ANY($1::text[])`, [MATCH_TABLES]);
  assert.deepEqual(cascading, [], 'P02 every I-07C foreign key is ON DELETE RESTRICT');
  // THE I-07B COLUMN BAN IS PRESERVED, not dodged: the proposal row is exactly
  // what 0110 made it, and MATCH_COMMIT_ID, the claim, the World link and the
  // handoff link live in dedicated relations.
  const proposalColumns = (await rows(
    `SELECT c.column_name FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'matching_proposals' ORDER BY 1`)).map((r) => r.column_name);
  assert.deepEqual(proposalColumns, PROPOSAL_COLUMNS_0110,
    'P02 matching_proposals carries exactly the eleven columns 0110 gave it: no match-commit, claim, World or handoff column');

  // P03 ONE EXACT ROW, not two independently satisfiable references.
  await assertBinding(MATCH.COMMITS, P.TRANSITIONS, ['id', 'proposal_id', 'match_state'], ['id', 'proposal_id', 'resulting_state']);
  await assertBinding(MATCH.COMMITS, P.TRANSITIONS, ['id', 'candidate_user_id'], ['id', 'candidate_actor_id']);
  await assertBinding(MATCH.COMMITS, P.PROPOSALS, ['proposal_id', 'pair_id', 'lower_user_id', 'higher_user_id'], ['id', 'pair_id', 'lower_user_id', 'higher_user_id']);
  await assertBinding(MATCH.COMMITS, MATCH.BINDINGS, ['first_approval_transition_id', 'proposal_id', 'first_approved_view_id'], ['approval_transition_id', 'proposal_id', 'approved_view_id']);
  await assertBinding(MATCH.COMMITS, P.VIEWS, ['candidate_accepted_view_id', 'proposal_id', 'candidate_user_id'], ['id', 'proposal_id', 'recipient_user_id']);
  await assertBinding(MATCH.COMMITS, MATCH.RECORDS, ['introduction_record_id', 'world_id'], ['id', 'world_id']);
  await assertBinding(MATCH.COMMITS, MATCH.RECORDS, ['introduction_record_id', 'pair_id', 'lower_user_id', 'higher_user_id'], ['id', 'pair_id', 'lower_user_id', 'higher_user_id']);
  await assertBinding(MATCH.COMMITS, 'public.shared_world_membership_episodes', ['first_recipient_membership_episode_id', 'world_id', 'first_recipient_user_id'], ['id', 'world_id', 'user_id']);
  await assertBinding(MATCH.COMMITS, 'public.shared_world_membership_episodes', ['candidate_membership_episode_id', 'world_id', 'candidate_user_id'], ['id', 'world_id', 'user_id']);
  await assertBinding(MATCH.COMMITS, MATCH.CLAIMS, ['first_recipient_claim_id', 'introduction_record_id', 'first_recipient_user_id'], ['id', 'introduction_record_id', 'user_id']);
  await assertBinding(MATCH.COMMITS, MATCH.CLAIMS, ['candidate_claim_id', 'introduction_record_id', 'candidate_user_id'], ['id', 'introduction_record_id', 'user_id']);
  await assertBinding(MATCH.COMMITS, 'public.matching_participation_events', ['first_recipient_pause_event_id', 'first_recipient_user_id'], ['id', 'participant_user_id']);
  await assertBinding(MATCH.COMMITS, MATCH.PACKAGES, ['handoff_package_version_id', 'introduction_record_id', 'first_approved_view_id', 'candidate_accepted_view_id'], ['id', 'introduction_record_id', 'first_recipient_view_id', 'candidate_view_id']);
  await assertBinding(MATCH.BINDINGS, P.TRANSITIONS, ['approval_transition_id', 'proposal_id', 'approval_state'], ['id', 'proposal_id', 'resulting_state']);
  await assertBinding(MATCH.BINDINGS, P.TRANSITIONS, ['approval_transition_id', 'approver_user_id'], ['id', 'first_recipient_actor_id']);
  await assertBinding(MATCH.BINDINGS, P.PROPOSALS, ['proposal_id', 'approver_user_id'], ['id', 'first_recipient_user_id']);
  await assertBinding(MATCH.BINDINGS, P.VIEWS, ['approved_view_id', 'proposal_id', 'approver_user_id'], ['id', 'proposal_id', 'recipient_user_id']);
  await assertBinding(MATCH.CLAIMS, MATCH.RECORDS, ['introduction_record_id', 'world_id', 'match_commit_id'], ['id', 'world_id', 'match_commit_id']);
  await assertBinding(MATCH.BIRTHS, MATCH.RECORDS, ['introduction_record_id', 'world_id', 'match_commit_id'], ['id', 'world_id', 'match_commit_id']);
  await assertBinding(MATCH.STARTS, MATCH.RECORDS, ['introduction_record_id', 'world_id', 'match_commit_id'], ['id', 'world_id', 'match_commit_id']);
  await assertBinding(MATCH.CANCELLATIONS, P.TRANSITIONS, ['cancellation_transition_id', 'cancelled_proposal_id', 'cancellation_state'], ['id', 'proposal_id', 'resulting_state']);
  await assertBinding(MATCH.SUBJECTS, P.VIEWS, ['source_view_id', 'presented_first_name'], ['id', 'subject_first_name']);
  await assertBinding(MATCH.SUBJECTS, P.VIEWS, ['source_view_id', 'permitted_conclusion_id'], ['id', 'permitted_conclusion_id']);
  await assertBinding(MATCH.SUBJECTS, P.VIEWS, ['source_view_id', 'presented_to_user_id', 'subject_user_id'], ['id', 'recipient_user_id', 'subject_user_id']);
  await assertBinding(MATCH.FIELDS, P.VIEW_FIELDS, ['source_view_id', 'field_key'], ['view_id', 'field_key']);

  // P04 EXACTLY THE SIX REVERSE BINDINGS ARE DEFERRED, and nothing else is.
  const deferrable = await rows(
    `SELECT con.conname, con.condeferred, parent.relname AS parent
       FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = cl.relnamespace
       LEFT JOIN pg_class parent ON parent.oid = con.confrelid
      WHERE n.nspname = 'public' AND ('public.' || cl.relname) = ANY($1::text[]) AND con.condeferrable
      ORDER BY con.conname`, [MATCH_TABLES]);
  assert.deepEqual(deferrable.map((r) => r.conname), [...DEFERRED_REVERSE_BINDINGS].sort(),
    'P04 exactly the six reverse bindings onto the commit are deferrable');
  for (const row of deferrable) {
    assert.equal(row.condeferred, true, `P04 ${row.conname} is INITIALLY DEFERRED`);
    assert.equal(row.parent, 'matching_match_commits', `P04 ${row.conname} points at the Match commit`);
  }

  // P05 THE PRIVATE REASON VOCABULARY.
  const reasons = await constraintDef(P.TRANSITIONS, 'matching_proposal_transitions_reason_check');
  for (const reason of [...I07B_PRIVATE_REASONS, COMPETING_REASON]) {
    assert.ok(reasons.includes(`'${reason}'`), `P05 ${reason} is representable`);
  }
  assert.equal((reasons.match(/'[A-Z_]+'/gu) ?? []).length, I07B_PRIVATE_REASONS.length + 1,
    'P05 the vocabulary is the eleven 0110 codes plus exactly COMPETING_MATCH_COMMITTED');

  // P06 THE MATCH-SCOPE CENSUS IS EXACTLY THIS SLICE.
  for (const name of I07C_LIFECYCLE_RELATIONS) {
    assert.equal(await count('pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace',
      "n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'", [name]), 1, `P06 ${name} exists`);
  }
  assert.deepEqual([...I07C_LIFECYCLE_RELATIONS].sort(), MATCH_TABLES.map((t) => t.replace('public.', '')).sort(),
    'P06 the reviewed ownership list names exactly the relations 0113 creates');
  const scoped = await rows(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p')
        AND c.relname ~* '^(matching_|introduction_|pre_match_)'
        AND c.relname ~* '(mutual|match_commit|_slot|_claim|introduction_record|world|handoff)'
      ORDER BY 1`);
  assert.deepEqual(scoped.map((r) => r.relname),
    I07C_LIFECYCLE_RELATIONS.filter((name) => /^(matching_|introduction_|pre_match_)/u.test(name)
      && /(mutual|match_commit|_slot|_claim|introduction_record|world|handoff)/u.test(name)),
    'P06 every Match-shaped relation in the Matching namespace is one I-07C owns');
  assert.deepEqual(I07C_LIFECYCLE_RELATIONS.filter((name) => PROPOSAL_TABLES.includes(`public.${name}`)), [],
    'P06 and none of them is an I-07B relation');
  for (const [table, name, columns] of ADDITIVE_PREDECESSOR_KEYS) {
    assert.deepEqual(await rt.uniqueKeyColumns(table, name), columns, `P06 the additive candidate key ${name} exists on ${table}`);
  }
  const handoffParents = await rows(
    `SELECT DISTINCT parent.relname FROM pg_constraint con
       JOIN pg_class cl ON cl.oid = con.conrelid JOIN pg_class parent ON parent.oid = con.confrelid
      WHERE con.contype = 'f' AND ('public.' || cl.relname) = ANY($1::text[]) ORDER BY 1`,
    [[MATCH.PACKAGES, MATCH.SUBJECTS, MATCH.FIELDS]]);
  assert.deepEqual(handoffParents.map((r) => r.relname),
    ['introduction_records', 'matching_match_commits', 'matching_match_handoff_package_versions',
      'matching_match_handoff_subjects', 'matching_permitted_safe_conclusions', 'matching_proposals',
      'matching_recipient_proposal_view_fields', 'matching_recipient_proposal_views'],
    'P06 a handoff relation can reach only the package, the commit, the record, the proposal, the exact views, their fields and the PERMITTED conclusion');
  const privateParents = await rows(
    `SELECT DISTINCT format('%s -> %s', cl.relname, parent.relname) AS edge FROM pg_constraint con
       JOIN pg_class cl ON cl.oid = con.conrelid JOIN pg_class parent ON parent.oid = con.confrelid
      WHERE con.contype = 'f' AND ('public.' || cl.relname) = ANY($1::text[])
        AND parent.relname = ANY($2::text[]) ORDER BY 1`,
    [MATCH_TABLES, ['matching_private_reasoning_notes', 'matching_safe_conclusion_candidates',
      'matching_sensitive_filter_refusals', 'matching_hard_requirement_results', 'matching_eligibility_snapshots',
      'matching_context_grants', 'matching_context_consent_events', 'pre_match_disclosure_authorities',
      'pre_match_disclosure_authority_fields', 'introduction_profile_field_values', 'introduction_profile_versions',
      'matching_requirement_versions', 'matching_requirement_items']]);
  assert.deepEqual(privateParents, [], 'P06 no Match relation binds private reasoning, evidence, source rows or any authority relation');

  // P07 EXACT PRODUCER OWNERSHIP, live.
  const producers = await rows(
    `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
        AND (pr.prosrc ~ 'INSERT INTO public\\.matching_match_commits'
          OR pr.prosrc ~ 'INSERT INTO public\\.matching_active_introduction_claims'
          OR pr.prosrc ~ 'INSERT INTO public\\.introduction_records'
          OR pr.prosrc ~ 'INSERT INTO public\\.matching_match_handoff'
          OR pr.prosrc ~ 'INSERT INTO public\\.shared_world_matching_birth_events'
          OR pr.prosrc ~ 'INSERT INTO public\\.shared_world_introduction_started_events'
          OR pr.prosrc ~ 'INSERT INTO public\\.matching_match_competing_cancellations') ORDER BY 1`);
  assert.deepEqual(producers.map((r) => r.proname), [I07C_MATCH_PRODUCER],
    'P07 exactly the reviewed I-07C core writes a commit, a claim, a record, a fact, a cancellation link or a handoff');
  const binders = await rows(
    `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prosrc ~ 'INSERT INTO public\\.matching_forward_approval_view_bindings' ORDER BY 1`);
  assert.deepEqual(binders.map((r) => r.proname), ['approve_matching_proposal_forward_core_v1'],
    'P07 exactly the revised forward approval writes a first-acceptance view binding');
  for (const role of ['public', ...APP_ROLES]) {
    assert.equal(await rt.canExecute(role, MFN_MATCH.COMMIT), false, `P07 ${role} must not execute the Match core`);
    assert.equal(await rt.canExecute(role, PFN.APPROVE), false, `P07 ${role} must not execute the revised approval`);
  }
}

// ------------------------------------------------- 2. structure and semantics
async function verifyStructure(report, humans) {
  const [one, two, three] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('S01 the whole Match graph is representable bound once at one instant', async () => {
      const f = await rt.bringToForwarded(one, two);
      const { ids } = await seedMatchGraph(f);
      const effects = await rt.matchEffects(ids, f.proposal);
      assert.deepEqual(effects, {
        commits: 1, matchTransitions: 1, worlds: 1, episodes: 2, records: 1, births: 1, starts: 1,
        claims: 2, pauses: 2, cancellations: 0, packages: 1, subjects: 2,
      }, 'S01 exactly one of everything and exactly two of each pair-wise effect');
      const coherence = await rt.instantCoherence(ids);
      assert.equal(coherence.coherent, true, 'S01 every persisted moment is the ONE commit instant, compared in SQL');
      const commit = await rt.commitRow(ids.command);
      assert.equal(commit.first_approved_view_id, f.firstView, 'S01 the commit binds the exact first-recipient view the approval bound');
      assert.equal(commit.candidate_accepted_view_id, f.secondView, 'S01 and the exact candidate view');
      assert.equal(commit.candidate_user_id, two, 'S01 the second human is the candidate');
    });

    await report.isolated('S02 one proposal one commit and one commit one of each effect', async () => {
      const f = await rt.bringToForwarded(one, two);
      const { ids, instant } = await seedMatchGraph(f);
      // A second commit over the same proposal or the same effects is refused
      // before it can exist. The truth guard refuses first because it runs
      // BEFORE the row is inserted; F1 proves the uniqueness keys refuse on
      // their own with the guard lifted.
      await rejected(() => insertCommit(f, { ...ids, command: randomUUID() }, instant),
        ['23505', '55000', '23503'], /proposal_key|record_key|world_key|INCOHERENT|transition_fk/u);
      assert.equal(await count(MATCH.COMMITS, 'proposal_id = $1', [f.proposal]), 1, 'S02 one proposal produced exactly one commit');
      await rejected(() => q(`INSERT INTO ${MATCH.RECORDS}
                 (id, match_commit_id, world_id, pair_id, lower_user_id, higher_user_id, introduction_status, started_at)
               VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7::timestamptz)`,
      [randomUUID(), ids.command, ids.world, f.pair, f.lower, f.higher, instant]), ['23505'], /match_commit_key|world_key/u);
      await rejected(() => q(`INSERT INTO ${MATCH.PACKAGES}
                 (id, match_commit_id, introduction_record_id, world_id, proposal_id,
                  first_recipient_user_id, candidate_user_id, first_recipient_view_id, candidate_view_id, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)`,
      [randomUUID(), ids.command, ids.record, ids.world, f.proposal, f.first, f.candidate, f.firstView, f.secondView, instant]),
      ['23505'], /commit_key|record_key|world_key|proposal_key|view_key/u);
    });

    await report.isolated('S03 the commit is the Match transition of its own proposal', async () => {
      const f = await rt.bringToForwarded(one, two);
      // The commit id is NOT the transition id: every child names the commit
      // coherently, so the truth guard passes and the structural key refuses.
      const stranger = randomUUID();
      await rejected(() => seedMatchGraph(f, { transitionId: stranger }), ['23503'], /transition_fk|actor_fk/u);
    });

    await report.isolated('S04 the first acceptance is a durable exact-view binding', async () => {
      const f = await rt.bringToForwarded(one, two);
      const binding = await rt.bindingOf(f.proposal);
      assert.ok(binding, 'S04 the real forward approval wrote the binding');
      assert.equal(binding.approval_transition_id, f.approval, 'S04 bound to the exact approval transition');
      assert.equal(binding.approver_user_id, one, 'S04 by the exact first recipient');
      assert.equal(binding.approved_view_id, f.firstView, 'S04 over the exact FIRST_RECIPIENT view the human saw');
      const [offer] = await rows(`SELECT id FROM ${P.TRANSITIONS} WHERE proposal_id = $1 AND resulting_state = 'OFFERED_TO_FIRST'`, [f.proposal]);
      const insertBinding = (transition, approver, view) => q(
        `INSERT INTO ${MATCH.BINDINGS} (approval_transition_id, proposal_id, approver_user_id, approved_view_id)
         VALUES ($1, $2, $3, $4)`, [transition, f.proposal, approver, view]);
      // Exactly once: a second binding for the proposal collides before any key
      // is reached...
      await rejected(() => insertBinding(f.approval, one, f.firstView), ['23505'], /pkey|proposal_key/u);
      // ... so the structural keys are probed with the real binding lifted, the
      // only way the probes can reach them. The lift itself needs the append-only
      // guard suspended for one statement, inside this rolled-back scenario.
      await q(`ALTER TABLE ${MATCH.BINDINGS} DISABLE TRIGGER matching_forward_approval_view_bindings_immutable`);
      await q(`DELETE FROM ${MATCH.BINDINGS} WHERE proposal_id = $1`, [f.proposal]);
      await q(`ALTER TABLE ${MATCH.BINDINGS} ENABLE TRIGGER matching_forward_approval_view_bindings_immutable`);
      // Only a FIRST_FORWARD_APPROVED transition of THIS proposal can be bound...
      await rejected(() => insertBinding(offer.id, one, f.firstView), ['23503'], /transition_fk|actor_fk/u);
      // ... by its approver, who is the first recipient, never the candidate ...
      await rejected(() => insertBinding(f.approval, two, f.secondView), ['23503'], /actor_fk|approver_fk|view_fk/u);
      // ... over the first recipient's view, never the candidate's ...
      await rejected(() => insertBinding(f.approval, one, f.secondView), ['23503'], /view_fk/u);
      // ... and the exact binding the approval wrote really is the one writable row.
      await insertBinding(f.approval, one, f.firstView);
      assert.equal(await count(MATCH.BINDINGS, 'proposal_id = $1', [f.proposal]), 1, 'S04 the exact binding is writable, and only it');
      await rejected(() => q(`UPDATE ${MATCH.BINDINGS} SET approved_view_id = $2 WHERE proposal_id = $1`, [f.proposal, f.secondView]),
        ['55000'], /IS_IMMUTABLE/u);
      await rejected(() => q(`DELETE FROM ${MATCH.BINDINGS} WHERE proposal_id = $1`, [f.proposal]), ['55000'], /IS_IMMUTABLE/u);
    });

    await report.isolated('S05 an Introduction Record is born ACTIVE and moves exactly once', async () => {
      const f = await rt.bringToForwarded(one, two);
      const { ids } = await seedMatchGraph(f);
      const definition = await constraintDef(MATCH.RECORDS, 'introduction_records_status_check');
      for (const status of INTRODUCTION_RECORD_STATUSES) assert.ok(definition.includes(`'${status}'`), `S05 ${status} is representable`);
      // Born active only.
      await rejected(() => q(`INSERT INTO ${MATCH.RECORDS}
                 (id, match_commit_id, world_id, pair_id, lower_user_id, higher_user_id, introduction_status, started_at, ended_at)
               VALUES ($1, $2, $3, $4, $5, $6, 'CLOSED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [randomUUID(), randomUUID(), randomUUID(), f.pair, f.lower, f.higher]), ['55000'], /BORN_ACTIVE/u);
      // Coherence: a status without its end instant, and an end without its status.
      await rejected(() => q(`UPDATE ${MATCH.RECORDS} SET introduction_status = 'CLOSED' WHERE id = $1`, [ids.record]),
        ['23514', '55000'], /closure_consistency_check|TRANSITION_INVALID/u);
      await rejected(() => q(`UPDATE ${MATCH.RECORDS} SET ended_at = clock_timestamp() WHERE id = $1`, [ids.record]),
        ['23514', '55000'], /closure_consistency_check|TRANSITION_INVALID/u);
      // Identity frozen, never deleted.
      await rejected(() => q(`UPDATE ${MATCH.RECORDS} SET world_id = $2 WHERE id = $1`, [ids.record, randomUUID()]),
        ['55000'], /IDENTITY_IS_FROZEN/u);
      await rejected(() => q(`DELETE FROM ${MATCH.RECORDS} WHERE id = $1`, [ids.record]), ['55000'], /IS_DURABLE/u);
      // THE TERMINAL MOVE IS REPRESENTABLE - and I-07C has no producer for it,
      // which P07 proves - so I-07D adds a producer rather than relaxing this.
      // The end instant is read from the clock: the record was started at a
      // clock instant inside this transaction, and the transaction timestamp
      // precedes it.
      await q('SAVEPOINT terminal');
      await q(`UPDATE ${MATCH.RECORDS} SET introduction_status = 'CLOSED', ended_at = clock_timestamp() WHERE id = $1`, [ids.record]);
      assert.equal((await rt.recordRow(ids.record)).introduction_status, 'CLOSED', 'S05 CLOSED is reachable by the one terminal move');
      await rejected(() => q(`UPDATE ${MATCH.RECORDS} SET introduction_status = 'ACTIVE', ended_at = NULL WHERE id = $1`, [ids.record]),
        ['55000'], /TRANSITION_INVALID/u);
      await q('ROLLBACK TO SAVEPOINT terminal');
      await q('RELEASE SAVEPOINT terminal');
      await q(`UPDATE ${MATCH.RECORDS} SET introduction_status = 'COMPLETED', ended_at = clock_timestamp() WHERE id = $1`, [ids.record]);
      assert.equal((await rt.recordRow(ids.record)).introduction_status, 'COMPLETED', 'S05 and COMPLETED by the other');
    });

    await report.isolated('S06 a claim is born HELD for a matched human and one HELD per human', async () => {
      const f = await rt.bringToForwarded(one, two);
      const { ids, instant } = await seedMatchGraph(f);
      const definition = await constraintDef(MATCH.CLAIMS, 'matching_active_introduction_claims_state_check');
      for (const state of CLAIM_STATES) assert.ok(definition.includes(`'${state}'`), `S06 ${state} is representable`);
      const insertClaim = (id, human, record, world, commit, state = 'HELD') => q(
        `INSERT INTO ${MATCH.CLAIMS} (id, user_id, match_commit_id, introduction_record_id, world_id, claim_state, claimed_at, released_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, CASE WHEN $6 = 'RELEASED' THEN $7::timestamptz ELSE NULL END)`,
        [id, human, commit, record, world, state, instant]);
      // AT MOST ONE HELD CLAIM PER HUMAN: the single-winner guarantee itself.
      await rejected(() => insertClaim(randomUUID(), one, ids.record, ids.world, ids.command),
        ['23505'], /one_held_idx|record_human_key|commit_human_key/u);
      // Born HELD only, and only for a matched human.
      await rejected(() => insertClaim(randomUUID(), three, ids.record, ids.world, ids.command, 'RELEASED'), ['55000'], /BORN_HELD/u);
      await rejected(() => insertClaim(randomUUID(), three, ids.record, ids.world, ids.command), ['55000'], /NOT_A_MATCHED_HUMAN/u);
      // A12: two claims of one commit reference ONE record and ONE World, as one
      // row - a claim naming the record with a different World cannot exist. The
      // membership guard would refuse the stranger first, so it is suspended for
      // this probe inside the rolled-back scenario: what is proven is the KEY.
      await q('SAVEPOINT structural');
      await q(`ALTER TABLE ${MATCH.CLAIMS} DISABLE TRIGGER matching_active_introduction_claims_truth`);
      await rejected(() => insertClaim(randomUUID(), three, ids.record, randomUUID(), ids.command), ['23503'], /record_fk/u);
      await q('ROLLBACK TO SAVEPOINT structural');
      await q('RELEASE SAVEPOINT structural');
      const held = await rt.claimsOf(one);
      assert.equal(held.length, 1, 'S06 one HELD claim for the first human');
      assert.equal(held[0].introduction_record_id, (await rt.claimsOf(two))[0].introduction_record_id,
        'S06 both claims reference the same Introduction Record');
      // RELEASE IS REPRESENTABLE, reached only by the one move, never re-held,
      // identity frozen, never deleted. I-07C has no producer for it.
      await rejected(() => q(`UPDATE ${MATCH.CLAIMS} SET claim_state = 'RELEASED' WHERE id = $1`, [ids.firstClaim]),
        ['23514', '55000'], /release_consistency_check|TRANSITION_INVALID/u);
      await rejected(() => q(`UPDATE ${MATCH.CLAIMS} SET user_id = $2 WHERE id = $1`, [ids.firstClaim, three]),
        ['55000'], /IDENTITY_IS_FROZEN/u);
      await rejected(() => q(`DELETE FROM ${MATCH.CLAIMS} WHERE id = $1`, [ids.firstClaim]), ['55000'], /IS_DURABLE/u);
      await q(`UPDATE ${MATCH.CLAIMS} SET claim_state = 'RELEASED', released_at = clock_timestamp() WHERE id = $1`, [ids.firstClaim]);
      await rejected(() => q(`UPDATE ${MATCH.CLAIMS} SET claim_state = 'HELD', released_at = NULL WHERE id = $1`, [ids.firstClaim]),
        ['55000'], /TRANSITION_INVALID/u);
      // Once released, a NEW claim for that human is representable again, which
      // is exactly what a later Match after a closed Introduction needs.
      assert.equal(await rt.heldClaimOf(one), null, 'S06 the released claim no longer occupies the human');
    });

    await report.isolated('S07 the commit truth guard refuses an incoherent World member pause or instant', async () => {
      const f = await rt.bringToForwarded(one, two);
      for (const [label, options, needle] of [
        ['a World that is not INTRODUCTION', { world: { phase: 'STANDARD' } }, /WORLD_INCOHERENT/u],
        ['a World born at another instant', { world: { bornAt: '2020-01-01T00:00:00Z' } }, /WORLD_INCOHERENT/u],
        ['a third human at birth', { thirdMember: three }, /MEMBERSHIP_INCOHERENT/u],
        ['a pause that is not ACTIVE_INTRODUCTION', { pauseReason: 'USER_PAUSED' }, /PAUSE_INCOHERENT/u],
      ]) {
        await q('SAVEPOINT incoherent');
        await rejected(() => seedMatchGraph(f, options), ['55000'], needle);
        await q('ROLLBACK TO SAVEPOINT incoherent');
        await q('RELEASE SAVEPOINT incoherent');
        assert.equal(await count(MATCH.COMMITS, 'proposal_id = $1', [f.proposal]), 0, `S07 ${label} left no commit`);
      }
      // The instant is one: a commit whose committed_at differs from what the
      // effects carry is refused by the same guard.
      const { ids, instant } = await seedMatchGraph(f, { skipCommit: true });
      await rejected(() => insertCommit(f, ids, instant, { committedAt: '2020-01-01T00:00:00Z' }), ['55000'], /INCOHERENT/u);
    });

    await report.isolated('S08 one WORLD_BIRTH per World and one INTRODUCTION_STARTED per record', async () => {
      const f = await rt.bringToForwarded(one, two);
      const { ids, instant } = await seedMatchGraph(f);
      await rejected(() => q(`INSERT INTO ${MATCH.BIRTHS} (world_id, match_commit_id, introduction_record_id, occurred_at)
               VALUES ($1, $2, $3, $4::timestamptz)`, [ids.world, ids.command, ids.record, instant]), ['23505'], /_pk|_key/u);
      await rejected(() => q(`INSERT INTO ${MATCH.STARTS} (introduction_record_id, world_id, match_commit_id, occurred_at)
               VALUES ($1, $2, $3, $4::timestamptz)`, [ids.record, ids.world, ids.command, instant]), ['23505'], /_pk|_key/u);
      assert.equal(await count(MATCH.BIRTHS, 'match_commit_id = $1', [ids.command]), 1, 'S08 one birth fact');
      assert.equal(await count(MATCH.STARTS, 'match_commit_id = $1', [ids.command]), 1, 'S08 one started fact');
    });

    await report.isolated('S09 the handoff ceiling is structural', async () => {
      const f = await rt.bringToForwarded(one, two);
      // A later materialization for the first recipient, made BEFORE the Match
      // graph pauses both humans: a real view of this proposal, presented to
      // this human, about this subject, with this conclusion - and not one of
      // the two views the package binds.
      const later = randomUUID();
      await rt.materialize(later, f.proposal, one, f.conclusionForFirst);
      const { ids } = await seedMatchGraph(f);
      const subjects = await rt.subjectsOf(ids.handoff);
      assert.equal(subjects.length, 2, 'S09 one subject per exact view');
      const fields = await rt.fieldsOf(ids.handoff);
      assert.equal(fields.length, 4, 'S09 the two approved and permitted fields, once per subject');
      const [aboutTwo] = subjects.filter((s) => s.subject_user_id === two);
      // A field the view never disclosed - a real profile field, approved by
      // nobody. The truth guard (BEFORE ROW) meets it before the foreign key
      // does, so both refusals are proven: the guard as deployed, and the key
      // on its own with the guard lifted inside a savepoint.
      const undisclosed = () => q(`INSERT INTO ${MATCH.FIELDS} (package_version_id, subject_user_id, source_view_id, field_key, disclosed_value)
               VALUES ($1, $2, $3, 'home_city_region', 'the quieter side of town')`, [ids.handoff, two, aboutTwo.source_view_id]);
      await rejected(undisclosed, ['55000'], /NOT_VIEW_VALUE/u);
      await q('SAVEPOINT undisclosed');
      await q(`ALTER TABLE ${MATCH.FIELDS} DISABLE TRIGGER matching_match_handoff_fields_truth`);
      await rejected(undisclosed, ['23503'], /view_field_fk/u);
      await q('ROLLBACK TO SAVEPOINT undisclosed');
      await q('RELEASE SAVEPOINT undisclosed');
      assert.equal(await rt.triggerEnabled(MATCH.FIELDS, 'matching_match_handoff_fields_truth'), true, 'S09 the guard is enabled again');
      // A value that differs from the view's, under a real disclosed key. The
      // copied row is append-only, so the probe lifts it for one statement
      // inside a savepoint and tries to write a different value in its place.
      await rejected(() => q(`UPDATE ${MATCH.FIELDS} SET disclosed_value = 'rewritten' WHERE package_version_id = $1`, [ids.handoff]),
        ['55000'], /IS_IMMUTABLE/u);
      await q('SAVEPOINT rewritten');
      await q(`ALTER TABLE ${MATCH.FIELDS} DISABLE TRIGGER matching_match_handoff_fields_immutable`);
      await q(`DELETE FROM ${MATCH.FIELDS} WHERE package_version_id = $1 AND subject_user_id = $2 AND field_key = 'life_stage'`, [ids.handoff, two]);
      await rejected(() => q(`INSERT INTO ${MATCH.FIELDS} (package_version_id, subject_user_id, source_view_id, field_key, disclosed_value)
               VALUES ($1, $2, $3, 'life_stage', 'settled and ready to call 0100 123 4567')`,
      [ids.handoff, two, aboutTwo.source_view_id]), ['23514', '55000'], /route_ban_check|NOT_VIEW_VALUE/u);
      await rejected(() => q(`INSERT INTO ${MATCH.FIELDS} (package_version_id, subject_user_id, source_view_id, field_key, disclosed_value)
               VALUES ($1, $2, $3, 'life_stage', 'settled and rewritten')`,
      [ids.handoff, two, aboutTwo.source_view_id]), ['55000'], /NOT_VIEW_VALUE/u);
      await q('ROLLBACK TO SAVEPOINT rewritten');
      await q('RELEASE SAVEPOINT rewritten');
      // A subject can present only the view's own name and the view's own
      // PERMITTED conclusion, from a view of the package, about a human the
      // view is about.
      const insertSubject = (overrides) => {
        const s = { ...aboutTwo, ...overrides };
        return q(`INSERT INTO ${MATCH.SUBJECTS}
                    (package_version_id, proposal_id, presented_to_user_id, subject_user_id, source_view_id,
                     permitted_conclusion_id, presented_first_name, safe_compatibility_conclusion)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [s.package_version_id, s.proposal_id, s.presented_to_user_id, s.subject_user_id, s.source_view_id,
          s.permitted_conclusion_id, s.presented_first_name, s.safe_compatibility_conclusion]);
      };
      // The subject about `two` is lifted the same way, fields first because they
      // bind it, so each probe below can reach the key or guard it names.
      await q(`ALTER TABLE ${MATCH.FIELDS} DISABLE TRIGGER matching_match_handoff_fields_immutable`);
      await q(`ALTER TABLE ${MATCH.SUBJECTS} DISABLE TRIGGER matching_match_handoff_subjects_immutable`);
      await q(`DELETE FROM ${MATCH.FIELDS} WHERE package_version_id = $1 AND subject_user_id = $2`, [ids.handoff, two]);
      await q(`DELETE FROM ${MATCH.SUBJECTS} WHERE package_version_id = $1 AND subject_user_id = $2`, [ids.handoff, two]);
      await q(`ALTER TABLE ${MATCH.SUBJECTS} ENABLE TRIGGER matching_match_handoff_subjects_immutable`);
      await q(`ALTER TABLE ${MATCH.FIELDS} ENABLE TRIGGER matching_match_handoff_fields_immutable`);
      await rejected(() => insertSubject({ presented_first_name: 'Someone' }), ['23503'], /first_name_fk/u);
      await rejected(() => insertSubject({ safe_compatibility_conclusion: 'A composed sentence nobody permitted.' }),
        ['55000'], /NOT_PERMITTED_TEXT/u);
      // A conclusion the filter PERMITTED - for the other recipient - with its
      // own exact text, so the guard passes and the KEY refuses: a permitted
      // conclusion is never re-aimed at a view that did not bind it.
      const [other] = await rows(`SELECT c.permitted_text FROM ${P.PERMITTED_CONCLUSIONS} c WHERE c.id = $1`, [f.conclusionForCandidate]);
      await rejected(() => insertSubject({ permitted_conclusion_id: f.conclusionForCandidate, safe_compatibility_conclusion: other.permitted_text }),
        ['23503'], /conclusion_fk/u);
      // The candidate's UNFILTERED conclusion candidate is not a permitted row:
      // the guard refuses it as deployed, and the key refuses it on its own.
      await rejected(() => insertSubject({ permitted_conclusion_id: f.candidateConclusionCandidate }), ['55000'], /NOT_PERMITTED_TEXT/u);
      await q('SAVEPOINT unfiltered');
      await q(`ALTER TABLE ${MATCH.SUBJECTS} DISABLE TRIGGER matching_match_handoff_subjects_truth`);
      await rejected(() => insertSubject({ permitted_conclusion_id: f.candidateConclusionCandidate }), ['23503'], /conclusion_fk|permitted_fk/u);
      await q('ROLLBACK TO SAVEPOINT unfiltered');
      await q('RELEASE SAVEPOINT unfiltered');
      assert.equal(await rt.triggerEnabled(MATCH.SUBJECTS, 'matching_match_handoff_subjects_truth'), true, 'S09 the subject guard is enabled again');
      await rejected(() => insertSubject({ subject_user_id: three }), ['23503'], /subject_fk/u);
      // The package's OTHER view is about the other human and was presented to
      // the other human: one subject per view refuses it first, and the audience
      // key would refuse it next.
      await rejected(() => insertSubject({ source_view_id: f.secondView }), ['23505', '23503'], /subjects_view_key|audience_fk|subject_fk/u);
      // The later view satisfies every key - it is a real view of this exact
      // audience, subject, name and conclusion - and only the guard refuses it,
      // because it is not one of the two views the package binds.
      await rejected(() => insertSubject({ source_view_id: later }), ['55000'], /VIEW_NOT_IN_PACKAGE/u);
      await insertSubject({});
      assert.equal(await count(MATCH.SUBJECTS, 'package_version_id = $1', [ids.handoff]), 2, 'S09 the exact copy really is writable');
    });

    await report.isolated('S10 the competing private reason is representable and an invented one is not', async () => {
      const f = await rt.bringToForwarded(one, two);
      const [current] = await rows(`SELECT current_transition_id id FROM ${P.PROPOSALS} WHERE id = $1`, [f.proposal]);
      const cancel = (reason, id = randomUUID()) => q(`INSERT INTO ${P.TRANSITIONS}
               (id, proposal_id, prior_state, resulting_state, prior_transition_id, private_reason_code)
             VALUES ($1, $2, 'FORWARDED_TO_SECOND', 'CANCELLED_BY_COMPETING_MATCH', $3, $4)`, [id, f.proposal, current.id, reason]);
      await rejected(() => cancel('INVENTED_REASON'), ['23514'], /reason_check/u);
      await q('SAVEPOINT original');
      await cancel('PROPOSAL_EXPIRED');
      await q('ROLLBACK TO SAVEPOINT original');
      await q('RELEASE SAVEPOINT original');
      const cancellation = randomUUID();
      await cancel(COMPETING_REASON, cancellation);
      await q(`UPDATE ${P.PROPOSALS} SET proposal_state = 'CANCELLED_BY_COMPETING_MATCH', current_transition_id = $2 WHERE id = $1`,
        [f.proposal, cancellation]);
      assert.equal(await count(P.TRANSITIONS, 'id = $1 AND private_reason_code = $2', [cancellation, COMPETING_REASON]), 1,
        'S10 COMPETING_MATCH_COMMITTED is representable on a competing cancellation');
    });

    await report.isolated('S11 a cancellation link binds one competing cancellation per proposal', async () => {
      const f = await rt.bringToForwarded(one, two);
      const [current] = await rows(`SELECT current_transition_id id FROM ${P.PROPOSALS} WHERE id = $1`, [f.proposal]);
      const cancellation = randomUUID();
      await q(`INSERT INTO ${P.TRANSITIONS} (id, proposal_id, prior_state, resulting_state, prior_transition_id, private_reason_code)
               VALUES ($1, $2, 'FORWARDED_TO_SECOND', 'CANCELLED_BY_COMPETING_MATCH', $3, $4)`, [cancellation, f.proposal, current.id, COMPETING_REASON]);
      await q(`UPDATE ${P.PROPOSALS} SET proposal_state = 'CANCELLED_BY_COMPETING_MATCH', current_transition_id = $2 WHERE id = $1`,
        [f.proposal, cancellation]);
      await q(`SET CONSTRAINTS ${DEFERRED_LIST} DEFERRED`);
      const commit = randomUUID();
      // The link binds a CANCELLED_BY_COMPETING_MATCH transition of that proposal, never the offer.
      await rejected(() => q(`INSERT INTO ${MATCH.CANCELLATIONS} (cancellation_transition_id, match_commit_id, cancelled_proposal_id)
               VALUES ($1, $2, $3)`, [current.id, commit, f.proposal]), ['23503'], /transition_fk/u);
      await q(`INSERT INTO ${MATCH.CANCELLATIONS} (cancellation_transition_id, match_commit_id, cancelled_proposal_id) VALUES ($1, $2, $3)`,
        [cancellation, commit, f.proposal]);
      await rejected(() => q(`INSERT INTO ${MATCH.CANCELLATIONS} (cancellation_transition_id, match_commit_id, cancelled_proposal_id)
               VALUES ($1, $2, $3)`, [randomUUID(), randomUUID(), f.proposal]), ['23503', '23505'], /proposal_key|transition_fk/u);
      // And the deferred link onto a commit that never arrives is refused at the flush.
      await rejected(() => q(`SET CONSTRAINTS ${DEFERRED_LIST} IMMEDIATE`), ['23503'], /cancellations_commit_fk/u);
    });

    await report.isolated('S12 a deferred reverse binding is enforcement not absence', async () => {
      const f = await rt.bringToForwarded(one, two);
      const { ids } = await seedMatchGraph(f, { skipCommit: true });
      // Every child names a commit that does not exist yet. That is accepted at
      // INSERT because the binding is deferred, and refused the moment the
      // transaction is asked to check it without the commit having arrived.
      assert.equal(await count(MATCH.RECORDS, 'id = $1', [ids.record]), 1, 'S12 the record exists before its commit');
      await rejected(() => q(`SET CONSTRAINTS ${DEFERRED_LIST} IMMEDIATE`), ['23503'], /_commit_fk/u);
    });

    await report.isolated('S13 every immutable relation refuses UPDATE and DELETE for the OWNER', async () => {
      const f = await rt.bringToForwarded(one, two);
      const { ids } = await seedMatchGraph(f);
      for (const [table, where, values] of [
        [MATCH.COMMITS, 'id = $1', [ids.command]],
        [MATCH.BIRTHS, 'world_id = $1', [ids.world]],
        [MATCH.STARTS, 'introduction_record_id = $1', [ids.record]],
        [MATCH.PACKAGES, 'id = $1', [ids.handoff]],
        [MATCH.SUBJECTS, 'package_version_id = $1', [ids.handoff]],
        [MATCH.FIELDS, 'package_version_id = $1', [ids.handoff]],
        [MATCH.BINDINGS, 'proposal_id = $1', [f.proposal]],
      ]) {
        await rejected(() => q(`DELETE FROM ${table} WHERE ${where}`, values), ['55000'], /IS_IMMUTABLE/u);
      }
      await rejected(() => q(`UPDATE ${MATCH.COMMITS} SET candidate_user_id = $2 WHERE id = $1`, [ids.command, three]),
        ['55000'], /IS_IMMUTABLE/u);
      await rejected(() => q(`UPDATE ${MATCH.SUBJECTS} SET presented_first_name = 'Other' WHERE package_version_id = $1`, [ids.handoff]),
        ['55000'], /IS_IMMUTABLE/u);
      assert.equal(MATCH_IMMUTABLE.length, 8, 'S13 eight relations are append-only');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ---------------------------------------------------------- 3. forward safety
//
// Each probe proves its guard is LOAD-BEARING: with the guard the database
// refuses, without it the SAME statement succeeds, and the guard is restored
// and observed back.
async function verifyForwardSafety(report, humans) {
  const [one, two, three] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('F1 the one-held-claim index is load-bearing', async () => {
      const f = await rt.bringToForwarded(one, two);
      const { ids, instant } = await seedMatchGraph(f);
      const second = () => q(`INSERT INTO ${MATCH.CLAIMS} (id, user_id, match_commit_id, introduction_record_id, world_id, claim_state, claimed_at)
             VALUES ($1, $2, $3, $4, $5, 'HELD', $6::timestamptz)`, [randomUUID(), one, ids.command, ids.record, ids.world, instant]);
      await rejected(second, ['23505'], /one_held_idx|record_human_key|commit_human_key/u);
      await q('DROP INDEX public.matching_active_introduction_claims_one_held_idx');
      await q(`ALTER TABLE ${MATCH.CLAIMS} DROP CONSTRAINT matching_active_introduction_claims_record_human_key`);
      await q(`ALTER TABLE ${MATCH.CLAIMS} DROP CONSTRAINT matching_active_introduction_claims_commit_human_key`);
      await second();
      assert.equal(await count(MATCH.CLAIMS, "user_id = $1 AND claim_state = 'HELD'", [one]), 2,
        'F1 without the guards one human really can hold two active Introductions');
    });

    await report.isolated('F2 the commit truth guard is load-bearing', async () => {
      const f = await rt.bringToForwarded(one, two);
      await rejected(() => seedMatchGraph(f, { pauseReason: 'USER_PAUSED' }), ['55000'], /PAUSE_INCOHERENT/u);
      await q(`ALTER TABLE ${MATCH.COMMITS} DISABLE TRIGGER matching_match_commits_truth`);
      const { ids } = await seedMatchGraph(f, { pauseReason: 'USER_PAUSED' });
      assert.equal(await count(MATCH.COMMITS, 'id = $1', [ids.command]), 1,
        'F2 without the guard a Match really can commit over a USER_PAUSED pause');
      await q(`ALTER TABLE ${MATCH.COMMITS} ENABLE TRIGGER matching_match_commits_truth`);
    });

    await report.isolated('F3 the handoff value guard is load-bearing', async () => {
      const f = await rt.bringToForwarded(one, two);
      const { ids } = await seedMatchGraph(f);
      const [aboutTwo] = (await rt.subjectsOf(ids.handoff)).filter((s) => s.subject_user_id === two);
      await q(`ALTER TABLE ${MATCH.FIELDS} DISABLE TRIGGER matching_match_handoff_fields_immutable`);
      await q(`DELETE FROM ${MATCH.FIELDS} WHERE package_version_id = $1 AND subject_user_id = $2 AND field_key = 'life_stage'`, [ids.handoff, two]);
      const rewrite = () => q(`INSERT INTO ${MATCH.FIELDS} (package_version_id, subject_user_id, source_view_id, field_key, disclosed_value)
             VALUES ($1, $2, $3, 'life_stage', 'settled and rewritten')`, [ids.handoff, two, aboutTwo.source_view_id]);
      await rejected(rewrite, ['55000'], /NOT_VIEW_VALUE/u);
      await q(`ALTER TABLE ${MATCH.FIELDS} DISABLE TRIGGER matching_match_handoff_fields_truth`);
      await rewrite();
      assert.equal(await count(MATCH.FIELDS, "package_version_id = $1 AND disclosed_value = 'settled and rewritten'", [ids.handoff]), 1,
        'F3 without the guard a handoff really can present a value the view never disclosed');
      await q(`ALTER TABLE ${MATCH.FIELDS} ENABLE TRIGGER matching_match_handoff_fields_truth`);
      await q(`ALTER TABLE ${MATCH.FIELDS} ENABLE TRIGGER matching_match_handoff_fields_immutable`);
    });

    await report.isolated('F4 the record truth guard is load-bearing', async () => {
      const f = await rt.bringToForwarded(one, two);
      const born = () => q(`INSERT INTO ${MATCH.RECORDS}
               (id, match_commit_id, world_id, pair_id, lower_user_id, higher_user_id, introduction_status, started_at, ended_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'CLOSED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [randomUUID(), randomUUID(), randomUUID(), f.pair, f.lower, f.higher]);
      await rejected(born, ['55000'], /BORN_ACTIVE/u);
      await q(`ALTER TABLE ${MATCH.RECORDS} DISABLE TRIGGER introduction_records_truth`);
      await q(`SET CONSTRAINTS ${DEFERRED_LIST} DEFERRED`);
      // Without the guard the row is no longer refused for being born CLOSED: it
      // travels on to the World binding, which is what refuses it now.
      await rejected(born, ['23503'], /world_fk/u);
      await q(`ALTER TABLE ${MATCH.RECORDS} ENABLE TRIGGER introduction_records_truth`);
      await rejected(born, ['55000'], /BORN_ACTIVE/u);
      assert.ok(three, 'F4 the third fixture human exists for the sibling probes');
    });
  } finally {
    await q('ROLLBACK');
  }
  await asRole('postgres');
  const [{ present }] = await rows(
    "SELECT count(*)::int present FROM pg_class WHERE relname = 'matching_active_introduction_claims_one_held_idx'");
  assert.equal(present, 1, 'the production one-held-claim index is present after the probes');
  for (const [table, trigger] of MATCH_GUARDS) {
    assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} is enabled after the probes`);
  }
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID()];
await runVerifier('0113', async (setStage) => {
  await rt.client.connect();
  setStage('fixtures');
  await rt.provisionHumans(humans);

  setStage('catalog');
  await verifyCatalog();

  const report = createScenarioReport('0113', { query: q, restore: () => asRole('postgres') });
  const nameSeam = await rt.captureMatchingSeam(PFN.FIRST_NAME);
  const gateSeam = await rt.captureMatchingSeam(PFN.PREREQUISITES);
  try {
    // Both seams answer fail-closed in production and are proven to do so by the
    // 0111 verifier; the fixture ladder cannot climb to FORWARDED_TO_SECOND
    // without them, so both are replaced here and restored byte for byte.
    await rt.resolveFirstName({ [humans[0]]: 'Sara', [humans[1]]: 'Omar', [humans[2]]: 'Layla' });
    await rt.clearProposalPrerequisites();
    setStage('structure');
    await verifyStructure(report, humans);
    setStage('forward safety');
    await verifyForwardSafety(report, humans);
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
  await rt.removeFixtureHumans(humans);
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${MATCH.COMMITS}) + (SELECT count(*) FROM ${MATCH.RECORDS})
          + (SELECT count(*) FROM ${MATCH.CLAIMS}) + (SELECT count(*) FROM ${MATCH.BINDINGS})
          + (SELECT count(*) FROM ${P.PROPOSALS}) + (SELECT count(*) FROM ${P.POLICY_STATE})
          + (SELECT count(*) FROM public.shared_worlds WHERE birth_basis = 'MUTUAL_MATCH')
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans]);
  assert.equal(Number(residue), 0,
    'every fixture this verifier created was rolled back: it commits nothing outside public.users');
  assert.deepEqual(APP_ROLES, ['anon', 'authenticated', 'service_role'], 'the three application roles are the ones checked');
}, () => rt.client.end().catch(() => undefined));
