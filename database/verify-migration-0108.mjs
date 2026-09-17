// Real-PostgreSQL verifier for migration 0108 - I-07A private Matching
// participation, authority and versioned setup foundation.
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// rows, that the Matching setup substrate is private, version-exact and unable
// to represent the things I-07A is forbidden to build.
//
//   P01 every relation is postgres-owned, RLS-enabled, policy-free and
//       unreachable by every application role
//   P02 the six trigger functions are postgres-owned, return trigger, pin an
//       empty search_path and are callable directly by nobody
//   P03 every append-only guard and every truth guard is enabled
//   P04 no generic, disclosure-shaped, world-scoped, ranked or untyped column
//       exists on any Matching relation, and none of them cascades
//   P05 the four load-bearing bindings are ONE EXACT ROW each, not two
//       independently satisfiable references
//   P06 the serialization row is a lock anchor and nothing else
//
//   S01 all five CW2-06 pause reasons are representable, and an act may spell
//       nothing outside the frozen vocabularies
//   S02 act coherence: a pause without a reason, an activation without a
//       channel, a resume carrying one and a state that contradicts the act are
//       each unrepresentable
//   S03 the act chain is a chain: no act supersedes itself, no act supersedes
//       another human's act, and no act is superseded twice
//   S04 the participation pointer names an exact act of its own human, may only
//       move forward along that chain, and is never deleted
//   S05 every append-only relation refuses UPDATE and DELETE for the table OWNER
//   S06 an authority moves ACTIVE to REVOKED and nowhere else: no reactivation,
//       no in-place edit, no deletion, no identity rewrite
//   S07 exactly one ACTIVE grant and one ACTIVE disclosure authority per human,
//       with revoked history coexisting freely
//   S08 a profile field key is bounded, and can never name a contact route, a
//       media handle or an identity document
//   S09 a profile field value is bounded and never empty
//   S10 a requirement item carries exactly HARD_DEALBREAKER or SOFT_PREFERENCE,
//       and no score, rank or weight column exists to carry anything else
//   S11 a disclosure authority binds the GRANTOR'S OWN profile version, and an
//       approved field must be a real field of THAT EXACT version
//   S12 a V1 authority cannot name a V2 field, structurally
//   S13 the consent and authority histories can only ever concern their own
//       human's own grant, with event type and prior identity coherent
//   S14 the profile and requirement version chains are chains, per human
//   S15 no Matching state is reachable through the three independent families'
//       cross references: there is no world_id, and nothing binds Matching to a
//       Shared World, a Public Experience or a Replay
//
//   f1..f4 the refused weakenings: an append-only guard that no longer fires, a
//          pointer guard that lets a human's history fork, an authority guard
//          that lets a revoked authority come back, and a later reviewed slice
//          that adds relations, a column and an index and is refused by nothing
//
// Every scenario reports INDEPENDENTLY through the permanent aggregator and the
// run fails ONCE at the end naming all of them.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createMatchingRuntime, M, MATCHING_TABLES, MATCHING_IMMUTABLE, MATCHING_GUARDED,
  MATCHING_TRIGGER_FUNCTIONS, PAUSE_REASONS, RESERVED_PAUSE_REASONS, ENTRY_CHANNELS,
  REQUIREMENT_STRENGTHS, LATER_SLICE_LIFECYCLE_RELATIONS, MATCHING_LIFECYCLE_WORDS,
  runVerifier, APP_ROLES,
} from './matching-setup-verifier-support.mjs';

const rt = createMatchingRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, rejected } = rt;

/** The exact column ban migration 0108 refuses to deploy against. */
const COLUMN_BAN = new RegExp('(scope|permission|privilege|admin|actor|on_behalf|impersonat|service'
  + '|world|shared|public_|replay|disclos|quote|copy|publish|export|provenance|transfer'
  + '|score|rank|weight|priorit|percent|compat|candidate|proposal|recipient|pair'
  + '|mutual|match_commit|introduction_slot|ttl|expir)', 'iu');

const act = (over = {}) => ({
  id: randomUUID(), participant_user_id: null, participation_act: 'ACTIVATE', resulting_state: 'ACTIVE',
  resulting_pause_reason: null, activation_entry_channel: 'MANUAL_MY_WORLD_ENTRY', prior_event_id: null, ...over,
});
const insertAct = (row) => q(
  `INSERT INTO ${M.ACTS} (id, participant_user_id, participation_act, resulting_state,
                          resulting_pause_reason, activation_entry_channel, prior_event_id)
   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  [row.id, row.participant_user_id, row.participation_act, row.resulting_state,
    row.resulting_pause_reason, row.activation_entry_channel, row.prior_event_id]);

const insertGrant = (id, human, status = 'ACTIVE') => q(
  `INSERT INTO ${M.GRANTS} (id, grantor_user_id, status, revoked_at)
   VALUES ($1, $2, $3, CASE WHEN $3 = 'REVOKED' THEN CURRENT_TIMESTAMP END)`, [id, human, status]);

const insertProfileVersion = (id, human, prior = null) => q(
  `INSERT INTO ${M.PROFILE_VERSIONS} (id, owner_user_id, prior_profile_version_id) VALUES ($1, $2, $3)`,
  [id, human, prior]);
const insertField = (version, key, value = 'a bounded private answer') => q(
  `INSERT INTO ${M.PROFILE_FIELDS} (profile_version_id, field_key, field_value) VALUES ($1, $2, $3)`,
  [version, key, value]);

// ---------------------------------------------------------------- 1. catalog
async function verifyCatalog() {
  await asRole('postgres');
  await rt.verifyPosture({
    triggers: MATCHING_TRIGGER_FUNCTIONS,
    tables: MATCHING_TABLES,
    immutable: [...MATCHING_IMMUTABLE, ...MATCHING_GUARDED],
  });

  // P04 NO GENERIC, DISCLOSURE-SHAPED, WORLD-SCOPED, RANKED OR UNTYPED COLUMN.
  const columns = await rows(
    `SELECT c.table_name, c.column_name, c.data_type FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = ANY($1::text[])
      ORDER BY c.table_name, c.column_name`,
    [MATCHING_TABLES.map((t) => t.replace('public.', ''))]);
  assert.ok(columns.length > 40, `P04 the Matching relations declare columns to check, found ${columns.length}`);
  for (const column of columns) {
    assert.doesNotMatch(column.column_name, COLUMN_BAN,
      `P04 ${column.table_name}.${column.column_name} is a generic, disclosure-shaped, world-scoped or ranked column`);
    assert.ok(!['json', 'jsonb', 'ARRAY', 'bytea'].includes(column.data_type),
      `P04 ${column.table_name}.${column.column_name} may not be an untyped payload column`);
  }
  // Matching capability scope is WORLDLESS, so there is no world column at all.
  assert.equal(columns.filter((c) => /world/iu.test(c.column_name)).length, 0,
    'P04 Matching Context Admission has no target World, so no relation carries one');

  // P04 NOTHING CASCADES: Matching authority truth is never deleted by a parent.
  const cascading = await rows(
    `SELECT con.conname, cl.relname FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname = 'public' AND con.contype = 'f' AND con.confdeltype <> 'r'
        AND ('public.' || cl.relname) = ANY($1::text[])`, [MATCHING_TABLES]);
  assert.deepEqual(cascading, [], 'P04 every Matching foreign key is ON DELETE RESTRICT');

  // P05 THE FOUR LOAD-BEARING BINDINGS ARE ONE EXACT ROW EACH.
  await rt.assertExactBinding(M.PARTICIPATION, M.ACTS,
    ['current_event_id', 'participant_user_id'], ['id', 'participant_user_id']);
  await rt.assertExactBinding(M.AUTHORITIES, M.PROFILE_VERSIONS,
    ['introduction_profile_version_id', 'grantor_user_id'], ['id', 'owner_user_id']);
  await rt.assertExactBinding(M.AUTHORITY_FIELDS, M.PROFILE_FIELDS,
    ['introduction_profile_version_id', 'field_key'], ['profile_version_id', 'field_key']);
  await rt.assertExactBinding(M.AUTHORITY_FIELDS, M.AUTHORITIES,
    ['authority_id', 'introduction_profile_version_id'], ['id', 'introduction_profile_version_id']);
  await rt.assertExactBinding(M.PROFILE_STATE, M.PROFILE_VERSIONS,
    ['current_profile_version_id', 'owner_user_id'], ['id', 'owner_user_id']);
  await rt.assertExactBinding(M.REQUIREMENT_STATE, M.REQUIREMENT_VERSIONS,
    ['current_requirement_version_id', 'owner_user_id'], ['id', 'owner_user_id']);

  // P06 THE SERIALIZATION ROW IS A LOCK ANCHOR AND NOTHING ELSE.
  const lockColumns = columns.filter((c) => c.table_name === 'matching_setup_locks').map((c) => c.column_name);
  assert.deepEqual(lockColumns.sort(), ['created_at', 'user_id'],
    'P06 the per-human serialization row carries a human and a birth instant, and nothing else');

  // S15 NOTHING BINDS MATCHING TO A SHARED WORLD, A PUBLIC EXPERIENCE OR A REPLAY.
  const foreign = await rows(
    `SELECT cl.relname child, parent.relname parent FROM pg_constraint con
       JOIN pg_class cl ON cl.oid = con.conrelid JOIN pg_class parent ON parent.oid = con.confrelid
       JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname = 'public' AND con.contype = 'f' AND ('public.' || cl.relname) = ANY($1::text[])
        AND ('public.' || parent.relname) <> ALL($1::text[]) ORDER BY 1, 2`, [MATCHING_TABLES]);
  assert.deepEqual([...new Set(foreign.map((f) => f.parent))], ['users'],
    'S15 the only relation outside Matching that any Matching relation references is public.users');

  // P07 I-07A CREATED NO CANDIDATE, PROPOSAL, PAIR, MUTUAL MATCH OR INTRODUCTION
  // LIFECYCLE RELATION.
  //
  // This census compares the LIVE catalog, which is what lets it catch a
  // lifecycle relation nobody declared - and a reviewed later slice legitimately
  // adds one to this namespace. The answer to that is to name it in
  // LATER_SLICE_LIFECYCLE_RELATIONS, not to rename it out of the pattern, so the
  // assertion is an EQUALITY and both halves of I-07A's claim stay proven: every
  // lifecycle-shaped relation here is one a named later slice owns, and none of
  // them is one of the fourteen relations 0108 creates.
  const lifecycle = await rows(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p')
        AND c.relname ~* '^(matching_|introduction_|pre_match_)'
        AND c.relname ~* '(candidate|proposal|pair|mutual|commit|slot|snapshot|eligibility|compatib|leaderboard|rank|score)'
      ORDER BY 1`);
  assert.deepEqual(lifecycle.map((r) => r.relname), LATER_SLICE_LIFECYCLE_RELATIONS,
    'P07 every candidate / proposal / pair / eligibility relation in the Matching namespace is one a reviewed later slice owns');
  assert.deepEqual(
    MATCHING_TABLES.map((t) => t.replace('public.', '')).filter((name) => MATCHING_LIFECYCLE_WORDS.test(name)),
    [], 'P07 and none of them is one of the fourteen relations I-07A creates');
}

// ------------------------------------------------------- 2. the row scenarios
async function verifyRepresentability(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('S01 all five CW2-06 pause reasons are representable', async () => {
      for (const reason of PAUSE_REASONS) {
        const row = act({ participant_user_id: one, participation_act: 'PAUSE',
          resulting_state: 'PAUSED', resulting_pause_reason: reason, activation_entry_channel: null });
        await insertAct(row);
        assert.equal(await count(M.ACTS, 'id = $1 AND resulting_pause_reason = $2', [row.id, reason]), 1,
          `S01 ${reason} is representable`);
      }
      // ... and the four with no I-07A producer are exactly the reserved ones.
      assert.equal(RESERVED_PAUSE_REASONS.length, 4, 'S01 four pause reasons are reserved for I-07C and I-07D');
    });

    await report.isolated('S01 an act may spell nothing outside the frozen vocabularies', async () => {
      // Each probe violates EXACTLY ONE constraint, because PostgreSQL does not
      // promise which of several failing CHECKs it reports first: an act with an
      // invented name must therefore carry no entry channel, or the coherence
      // check would fire too and the assertion would be testing the weather.
      await rejected(() => insertAct(act({ participant_user_id: one, participation_act: 'SUSPEND',
        activation_entry_channel: null })), ['23514'], /_act_check/u);
      await rejected(() => insertAct(act({ participant_user_id: one, resulting_state: 'DORMANT' })),
        ['23514'], /_state_check|_act_state_check/u);
      await rejected(() => insertAct(act({ participant_user_id: one, participation_act: 'PAUSE',
        resulting_state: 'PAUSED', resulting_pause_reason: 'BECAUSE', activation_entry_channel: null })),
      ['23514'], /_pause_reason_check/u);
      await rejected(() => insertAct(act({ participant_user_id: one, activation_entry_channel: 'QANDEEL_SUGGESTED' })),
        ['23514'], /_entry_channel_check/u);
      assert.equal(ENTRY_CHANNELS.length, 2, 'S01 there are exactly two frozen entry channels');
    });

    await report.isolated('S02 act coherence is structural, not a convention', async () => {
      // A pause with no reason, and a non-pause carrying one.
      await rejected(() => insertAct(act({ participant_user_id: one, participation_act: 'PAUSE',
        resulting_state: 'PAUSED', resulting_pause_reason: null, activation_entry_channel: null })),
      ['23514'], /_pause_coherence_check/u);
      await rejected(() => insertAct(act({ participant_user_id: one, resulting_pause_reason: 'USER_PAUSED' })),
        ['23514'], /_pause_coherence_check/u);
      // An activation with no entry channel, and a resume carrying one.
      await rejected(() => insertAct(act({ participant_user_id: one, activation_entry_channel: null })),
        ['23514'], /_entry_coherence_check/u);
      await rejected(() => insertAct(act({ participant_user_id: one, participation_act: 'RESUME' })),
        ['23514'], /_entry_coherence_check/u);
      // An act whose resulting state contradicts the act itself.
      await rejected(() => insertAct(act({ participant_user_id: one, participation_act: 'TURN_OFF',
        resulting_state: 'ACTIVE', activation_entry_channel: null })),
      ['23514'], /_act_state_check|_entry_coherence_check/u);
    });

    await report.isolated('S03 the act chain is a chain, per human', async () => {
      const first = act({ participant_user_id: one });
      await insertAct(first);
      // No act supersedes itself.
      const selfish = act({ participant_user_id: one });
      await rejected(() => insertAct({ ...selfish, prior_event_id: selfish.id }), ['23514'], /_prior_event_check/u);
      // No act supersedes another human's act: the composite reference forbids it.
      await rejected(() => insertAct(act({ participant_user_id: two, prior_event_id: first.id })),
        ['23503'], /_prior_event_fk/u);
      // An act is superseded at most once.
      const second = act({ participant_user_id: one, participation_act: 'TURN_OFF', resulting_state: 'OFF',
        activation_entry_channel: null, prior_event_id: first.id });
      await insertAct(second);
      await rejected(() => insertAct(act({ participant_user_id: one, participation_act: 'TURN_OFF',
        resulting_state: 'OFF', activation_entry_channel: null, prior_event_id: first.id })),
      ['23505'], /_prior_event_idx/u);
    });

    await report.isolated('S04 the participation pointer is exact, forward-only and undeletable', async () => {
      const first = act({ participant_user_id: one });
      await insertAct(first);
      // It cannot name another human's act.
      await rejected(() => q(
        `INSERT INTO ${M.PARTICIPATION} (participant_user_id, current_event_id) VALUES ($1, $2)`, [two, first.id]),
      ['23503'], /_current_event_fk/u);
      // A first pointer may only name a chain root.
      const second = act({ participant_user_id: one, participation_act: 'PAUSE', resulting_state: 'PAUSED',
        resulting_pause_reason: 'USER_PAUSED', activation_entry_channel: null, prior_event_id: first.id });
      await insertAct(second);
      await rejected(() => q(
        `INSERT INTO ${M.PARTICIPATION} (participant_user_id, current_event_id) VALUES ($1, $2)`, [one, second.id]),
      ['55000'], /MATCHING_CURRENT_STATE_NOT_A_FORWARD_MOVE/u);
      await q(`INSERT INTO ${M.PARTICIPATION} (participant_user_id, current_event_id) VALUES ($1, $2)`,
        [one, first.id]);
      // It may only move to the act that supersedes the one it replaces.
      const unrelated = act({ participant_user_id: one });
      await insertAct(unrelated);
      await rejected(() => q(
        `UPDATE ${M.PARTICIPATION} s SET current_event_id = $2 WHERE s.participant_user_id = $1`, [one, unrelated.id]),
      ['55000'], /MATCHING_CURRENT_STATE_NOT_A_FORWARD_MOVE/u);
      await q(`UPDATE ${M.PARTICIPATION} s SET current_event_id = $2 WHERE s.participant_user_id = $1`,
        [one, second.id]);
      assert.equal(await count(M.PARTICIPATION, 'participant_user_id = $1 AND current_event_id = $2',
        [one, second.id]), 1, 'S04 the forward move committed');
      // And it is never deleted, and never re-homed to another human.
      await rejected(() => q(`DELETE FROM ${M.PARTICIPATION} WHERE participant_user_id = $1`, [one]),
        ['55000'], /MATCHING_CURRENT_STATE_IS_DURABLE/u);
      await rejected(() => q(
        `UPDATE ${M.PARTICIPATION} s SET participant_user_id = $2 WHERE s.participant_user_id = $1`, [one, two]),
      ['55000'], /MATCHING_CURRENT_STATE_HUMAN_IS_FROZEN|MATCHING_CURRENT_STATE_NOT_A_FORWARD_MOVE/u);
    });
  } finally {
    await q('ROLLBACK');
  }
}

async function verifyImmutability(report, humans) {
  const [one] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('S05 every append-only relation refuses UPDATE and DELETE for its OWNER', async () => {
      const row = act({ participant_user_id: one });
      await insertAct(row);
      await rejected(() => q(`UPDATE ${M.ACTS} SET resulting_state = 'OFF' WHERE id = $1`, [row.id]),
        ['55000'], /MATCHING_SETUP_RECORD_IS_IMMUTABLE/u);
      await rejected(() => q(`DELETE FROM ${M.ACTS} WHERE id = $1`, [row.id]),
        ['55000'], /MATCHING_SETUP_RECORD_IS_IMMUTABLE/u);

      const version = randomUUID();
      await insertProfileVersion(version, one);
      await insertField(version, 'life_stage');
      await rejected(() => q(
        `UPDATE ${M.PROFILE_FIELDS} SET field_value = 'rewritten' WHERE profile_version_id = $1`, [version]),
      ['55000'], /MATCHING_SETUP_RECORD_IS_IMMUTABLE/u);
      await rejected(() => q(`DELETE FROM ${M.PROFILE_VERSIONS} WHERE id = $1`, [version]),
        ['55000'], /MATCHING_SETUP_RECORD_IS_IMMUTABLE/u);

      const requirement = randomUUID();
      await q(`INSERT INTO ${M.REQUIREMENT_VERSIONS} (id, owner_user_id) VALUES ($1, $2)`, [requirement, one]);
      await q(`INSERT INTO ${M.REQUIREMENT_ITEMS}
                 (requirement_version_id, requirement_key, requirement_strength, requirement_value)
               VALUES ($1, 'faith_practice_level', 'HARD_DEALBREAKER', 'practising')`, [requirement]);
      await rejected(() => q(
        `UPDATE ${M.REQUIREMENT_ITEMS} SET requirement_strength = 'SOFT_PREFERENCE'
          WHERE requirement_version_id = $1`, [requirement]),
      ['55000'], /MATCHING_SETUP_RECORD_IS_IMMUTABLE/u);
      assert.equal(await count(M.REQUIREMENT_ITEMS,
        "requirement_version_id = $1 AND requirement_strength = 'HARD_DEALBREAKER'", [requirement]), 1,
      'S05 a hard dealbreaker is never silently converted into a soft preference');
    });

    await report.isolated('S06 an authority moves ACTIVE to REVOKED and nowhere else', async () => {
      const grant = randomUUID();
      await insertGrant(grant, one);
      // No deletion, ever.
      await rejected(() => q(`DELETE FROM ${M.GRANTS} WHERE id = $1`, [grant]),
        ['55000'], /MATCHING_AUTHORITY_IS_APPEND_ONLY/u);
      // No identity rewrite.
      await rejected(() => q(`UPDATE ${M.GRANTS} SET granted_at = CURRENT_TIMESTAMP + interval '1 day'
                               WHERE id = $1`, [grant]),
      ['55000'], /MATCHING_AUTHORITY_IDENTITY_IS_FROZEN/u);
      // No in-place no-op edit that leaves it ACTIVE.
      await rejected(() => q(`UPDATE ${M.GRANTS} SET status = 'ACTIVE' WHERE id = $1`, [grant]),
        ['55000'], /MATCHING_AUTHORITY_TRANSITION_INVALID/u);
      // The one legal transition.
      await q(`UPDATE ${M.GRANTS} SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP WHERE id = $1`, [grant]);
      assert.equal(await count(M.GRANTS, "id = $1 AND status = 'REVOKED'", [grant]), 1, 'S06 the revocation committed');
      // And a revoked authority never comes back.
      await rejected(() => q(`UPDATE ${M.GRANTS} SET status = 'ACTIVE', revoked_at = NULL WHERE id = $1`, [grant]),
        ['55000'], /MATCHING_AUTHORITY_TRANSITION_INVALID/u);
      assert.equal(await count(M.GRANTS, 'id = $1', [grant]), 1,
        'S06 the revoked grant is still there: revocation is history, never erasure');
    });

    await report.isolated('S07 exactly one ACTIVE authority per human, with history coexisting', async () => {
      const first = randomUUID();
      const second = randomUUID();
      await insertGrant(first, one);
      await rejected(() => insertGrant(second, one), ['23505'], /matching_context_grants_one_active_idx/u);
      await q(`UPDATE ${M.GRANTS} SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP WHERE id = $1`, [first]);
      await insertGrant(second, one);
      assert.equal(await count(M.GRANTS, "grantor_user_id = $1 AND status = 'ACTIVE'", [one]), 1,
        'S07 exactly one current ACTIVE grant');
      assert.equal(await count(M.GRANTS, "grantor_user_id = $1 AND status = 'REVOKED'", [one]), 1,
        'S07 and the replaced one stays as history');
    });

    await report.isolated('S05 the serialization row is a lock anchor, immutable and undeletable', async () => {
      await q(`INSERT INTO ${M.LOCKS} (user_id) VALUES ($1)`, [one]);
      // The upsert-and-lock idiom every command uses: a NO-OP touch is allowed,
      // because that is how it takes the row lock without changing anything.
      await q(`INSERT INTO ${M.LOCKS} AS l (user_id) VALUES ($1)
               ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at`, [one]);
      assert.equal(await count(M.LOCKS, 'user_id = $1', [one]), 1, 'S05 the upsert-and-lock touched exactly one row');
      await rejected(() => q(`UPDATE ${M.LOCKS} SET created_at = CURRENT_TIMESTAMP + interval '1 day'
                               WHERE user_id = $1`, [one]),
      ['55000'], /MATCHING_SETUP_LOCK_IS_IMMUTABLE/u);
      await rejected(() => q(`DELETE FROM ${M.LOCKS} WHERE user_id = $1`, [one]),
        ['55000'], /MATCHING_SETUP_LOCK_IS_DURABLE/u);
    });
  } finally {
    await q('ROLLBACK');
  }
}

async function verifyBoundedRepresentation(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    const version = randomUUID();
    await insertProfileVersion(version, one);

    await report.isolated('S08 a profile field key can never name a contact route, a media handle or a document', async () => {
      for (const banned of ['phone_number', 'email', 'whatsapp_handle', 'instagram_username', 'postal_address',
        'street_name', 'gps_latitude', 'profile_photo', 'selfie_image', 'voice_audio', 'passport_number',
        'national_id', 'id_number', 'kyc_document', 'contact_route', 'profile_url', 'social_link']) {
        await rejected(() => insertField(version, banned), ['23514'], /_contact_route_ban_check|_field_key_shape_check/u);
      }
      // ... and the ban is TOKEN-aware, so an ordinary descriptive field is fine
      // and the Product catalogue CW2-06 defers stays open.
      const before = await count(M.PROFILE_FIELDS, 'profile_version_id = $1', [version]);
      for (const allowed of ['handles_conflict_well', 'life_stage', 'children_plan', 'relocation_openness']) {
        await insertField(version, allowed);
      }
      const after = await count(M.PROFILE_FIELDS, 'profile_version_id = $1', [version]);
      assert.equal(after - before, 4, 'S08 every descriptive field was accepted and no banned one was');
    });

    await report.isolated('S08 a profile field key is a bounded identifier', async () => {
      for (const malformed of ['Ab', 'x', 'UPPER_CASE', '9leading', 'trailing-dash', 'with space', 'a'.repeat(49)]) {
        await rejected(() => insertField(version, malformed), ['23514'], /_field_key_shape_check|_contact_route_ban_check/u);
      }
    });

    await report.isolated('S09 a profile field value is bounded and never empty', async () => {
      await rejected(() => insertField(version, 'life_stage', ''), ['23514'], /_field_value_check/u);
      await rejected(() => insertField(version, 'life_stage', '   '), ['23514'], /_field_value_check/u);
      await rejected(() => insertField(version, 'life_stage', 'x'.repeat(4097)), ['23514'], /_field_value_check/u);
      await insertField(version, 'life_stage', 'x'.repeat(4096));
      assert.equal(await count(M.PROFILE_FIELDS, 'profile_version_id = $1', [version]), 1,
        'S09 the structural ceiling is a ceiling, not a Product field length');
    });

    await report.isolated('S10 a requirement carries exactly the frozen hard / soft distinction', async () => {
      const requirement = randomUUID();
      await q(`INSERT INTO ${M.REQUIREMENT_VERSIONS} (id, owner_user_id) VALUES ($1, $2)`, [requirement, one]);
      for (const strength of REQUIREMENT_STRENGTHS) {
        await q(`INSERT INTO ${M.REQUIREMENT_ITEMS}
                   (requirement_version_id, requirement_key, requirement_strength, requirement_value)
                 VALUES ($1, $2, $3, 'a bounded self-declared answer')`,
        [requirement, `k_${strength.toLowerCase()}`, strength]);
      }
      assert.equal(REQUIREMENT_STRENGTHS.length, 2, 'S10 there are exactly two frozen strengths');
      for (const invented of ['MEDIUM_PREFERENCE', 'WEIGHTED', 'PASS', 'FAIL', 'UNKNOWN']) {
        await rejected(() => q(`INSERT INTO ${M.REQUIREMENT_ITEMS}
                                  (requirement_version_id, requirement_key, requirement_strength, requirement_value)
                                VALUES ($1, 'k_invented', $2, 'x')`, [requirement, invented]),
        ['23514'], /_strength_check/u);
      }
      // No column exists that could carry a score, a rank or a weight instead.
      const columns = (await rows(
        `SELECT a.attname FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped`,
        [M.REQUIREMENT_ITEMS])).map((r) => r.attname);
      assert.deepEqual(columns.sort(),
        ['requirement_key', 'requirement_strength', 'requirement_value', 'requirement_version_id'],
        'S10 a requirement item is a key, a strength and a value: nothing scores, ranks or weights a candidate');
    });

    await report.isolated('S14 the profile and requirement version chains are chains, per human', async () => {
      const second = randomUUID();
      // A version cannot chain onto another human's version.
      await rejected(() => insertProfileVersion(second, two, version), ['23503'], /_prior_version_fk/u);
      await insertProfileVersion(second, one, version);
      // ... and a version is superseded at most once.
      await rejected(() => insertProfileVersion(randomUUID(), one, version),
        ['23505'], /introduction_profile_versions_prior_version_idx/u);
      const requirementOne = randomUUID();
      const requirementTwo = randomUUID();
      await q(`INSERT INTO ${M.REQUIREMENT_VERSIONS} (id, owner_user_id) VALUES ($1, $2)`, [requirementOne, one]);
      await rejected(() => q(`INSERT INTO ${M.REQUIREMENT_VERSIONS}
                                (id, owner_user_id, prior_requirement_version_id) VALUES ($1, $2, $3)`,
      [requirementTwo, two, requirementOne]), ['23503'], /_prior_version_fk/u);
    });
  } finally {
    await q('ROLLBACK');
  }
}

async function verifyDisclosureBinding(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    const v1 = randomUUID();
    const v2 = randomUUID();
    await insertProfileVersion(v1, one);
    await insertField(v1, 'life_stage');
    await insertField(v1, 'children_plan');
    await insertProfileVersion(v2, one, v1);
    await insertField(v2, 'life_stage');
    await insertField(v2, 'relocation_openness');
    const otherVersion = randomUUID();
    await insertProfileVersion(otherVersion, two);
    await insertField(otherVersion, 'life_stage');

    const insertAuthority = (id, human, version) => q(
      `INSERT INTO ${M.AUTHORITIES} (id, grantor_user_id, introduction_profile_version_id, status)
       VALUES ($1, $2, $3, 'ACTIVE')`, [id, human, version]);
    const approveField = (authority, version, key) => q(
      `INSERT INTO ${M.AUTHORITY_FIELDS} (authority_id, introduction_profile_version_id, field_key)
       VALUES ($1, $2, $3)`, [authority, version, key]);

    await report.isolated('S11 an authority binds the GRANTOR OWN profile version', async () => {
      await rejected(() => insertAuthority(randomUUID(), one, otherVersion),
        ['23503'], /_profile_version_fk/u);
      await rejected(() => insertAuthority(randomUUID(), two, v1), ['23503'], /_profile_version_fk/u);
      const mine = randomUUID();
      await insertAuthority(mine, one, v1);
      assert.equal(await count(M.AUTHORITIES, 'id = $1 AND introduction_profile_version_id = $2', [mine, v1]), 1,
        'S11 a human authorizes exactly one version of their own profile');
    });

    await report.isolated('S11 an approved field must be a real field of THAT exact version', async () => {
      const authority = randomUUID();
      await insertAuthority(authority, one, v1);
      await approveField(authority, v1, 'life_stage');
      // A key that is in no version at all.
      await rejected(() => approveField(authority, v1, 'invented_field'),
        ['23503'], /_profile_field_fk/u);
      // A key the authority's own version does not carry, even though a LATER
      // version does: the binding is to the exact version, not to the profile.
      await rejected(() => approveField(authority, v1, 'relocation_openness'),
        ['23503'], /_profile_field_fk/u);
      assert.equal(await count(M.AUTHORITY_FIELDS, 'authority_id = $1', [authority]), 1,
        'S11 exactly the one real approved field survived');
    });

    await report.isolated('S12 a V1 authority cannot name a V2 field, structurally', async () => {
      const authority = randomUUID();
      await insertAuthority(authority, one, v1);
      // The field row cannot claim a different version than the authority binds,
      // even when that version really does carry the key.
      await rejected(() => approveField(authority, v2, 'relocation_openness'),
        ['23503'], /_authority_version_fk/u);
      await rejected(() => approveField(authority, v2, 'life_stage'),
        ['23503'], /_authority_version_fk/u);
      assert.equal(await count(M.AUTHORITY_FIELDS, 'authority_id = $1', [authority]), 0,
        'S12 an authority over one version never reaches the next one');
    });

    await report.isolated('S13 consent and authority history concern their own human own authority', async () => {
      const grant = randomUUID();
      await insertGrant(grant, one);
      // A consent act cannot be recorded against another human's grant.
      await rejected(() => q(
        `INSERT INTO ${M.CONSENT} (id, grantor_user_id, event_type, subject_grant_id, prior_grant_id)
         VALUES ($1, $2, 'GRANTED', $3, NULL)`, [randomUUID(), two, grant]),
      ['23503'], /_subject_grant_fk/u);
      // GRANTED carries no prior; RECONFIRMED must carry one that is not itself.
      await rejected(() => q(
        `INSERT INTO ${M.CONSENT} (id, grantor_user_id, event_type, subject_grant_id, prior_grant_id)
         VALUES ($1, $2, 'GRANTED', $3, $3)`, [randomUUID(), one, grant]),
      ['23514'], /_prior_grant_check/u);
      await rejected(() => q(
        `INSERT INTO ${M.CONSENT} (id, grantor_user_id, event_type, subject_grant_id, prior_grant_id)
         VALUES ($1, $2, 'RECONFIRMED', $3, NULL)`, [randomUUID(), one, grant]),
      ['23514'], /_prior_grant_check/u);
      await q(`INSERT INTO ${M.CONSENT} (id, grantor_user_id, event_type, subject_grant_id, prior_grant_id)
               VALUES ($1, $2, 'GRANTED', $3, NULL)`, [randomUUID(), one, grant]);
      // A grant identity is born exactly once and revoked at most once.
      await rejected(() => q(
        `INSERT INTO ${M.CONSENT} (id, grantor_user_id, event_type, subject_grant_id, prior_grant_id)
         VALUES ($1, $2, 'GRANTED', $3, NULL)`, [randomUUID(), one, grant]),
      ['23505'], /_birth_event_idx/u);
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('the catalog is intact after the rolled-back representation probes', verifyCatalog);
}

// --------------------------------------------------------- 3. forward safety
async function verifyForwardSafety(report, humans) {
  const [one] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    // Every anchor below is taken from the function BODY, which
    // `pg_get_functiondef` returns verbatim - never from the signature, which
    // PostgreSQL regenerates in its own canonical form and which no anchor
    // would match. Each weakening is bound to a name and proven to have CHANGED
    // the text, so a mutation that matched nothing can never read as "the guard
    // accepted a weakening".
    const guard = (await rows(
      'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
      ['public.reject_matching_setup_mutation_v1()']))[0];
    await report.isolated('f1 the append-only guard is what refuses an owner rewrite', async () => {
      // THE MUTATION REWRITES ACTIVATION PROVENANCE, which is exactly the harm
      // the guard exists to prevent and which no CHECK constrains: both entry
      // channels are legal for an ACTIVATE act. A mutation that a CHECK would
      // refuse anyway proves nothing about the guard, because the weakened run
      // would fail for the other reason and read as "the guard still held".
      const row = act({ participant_user_id: one, activation_entry_channel: 'MANUAL_MY_WORLD_ENTRY' });
      await insertAct(row);
      const rewrite = `UPDATE ${M.ACTS} SET activation_entry_channel = 'CONVERSATIONAL_ENTRY' WHERE id = $1`;
      await rejected(() => q(rewrite, [row.id]), ['55000'], /MATCHING_SETUP_RECORD_IS_IMMUTABLE/u);
      const weakened = guard.definition.replace(
        "RAISE EXCEPTION 'MATCHING_SETUP_RECORD_IS_IMMUTABLE'",
        "RETURN NEW; RAISE EXCEPTION 'MATCHING_SETUP_RECORD_IS_IMMUTABLE'");
      assert.notEqual(weakened, guard.definition, 'f1 the weakening changed the guard');
      assert.ok(weakened.includes('RETURN NEW; RAISE EXCEPTION'), 'f1 and it introduced the early return');
      await q(weakened);
      await q(rewrite, [row.id]);
      assert.equal(await count(M.ACTS, "id = $1 AND activation_entry_channel = 'CONVERSATIONAL_ENTRY'",
        [row.id]), 1,
      'f1 without the guard the owner really can rewrite a human recorded entry channel, so the guard is load-bearing');
      await q(guard.definition);
      const [restored] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
        ['public.reject_matching_setup_mutation_v1()']);
      assert.equal(restored.prosrc, guard.prosrc, 'f1 the production guard is restored byte for byte');
      await rejected(() => q(
        `UPDATE ${M.ACTS} SET activation_entry_channel = 'MANUAL_MY_WORLD_ENTRY' WHERE id = $1`, [row.id]),
      ['55000'], /MATCHING_SETUP_RECORD_IS_IMMUTABLE/u);
    });

    const pointer = (await rows(
      'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
      ['public.matching_participation_state_truth_v1()']))[0];
    await report.isolated('f2 the pointer guard is what stops a human history forking', async () => {
      const first = act({ participant_user_id: one });
      const unrelated = act({ participant_user_id: one });
      await insertAct(first);
      await insertAct(unrelated);
      await q(`INSERT INTO ${M.PARTICIPATION} (participant_user_id, current_event_id) VALUES ($1, $2)`,
        [one, first.id]);
      await rejected(() => q(
        `UPDATE ${M.PARTICIPATION} s SET current_event_id = $2 WHERE s.participant_user_id = $1`,
        [one, unrelated.id]), ['55000'], /MATCHING_CURRENT_STATE_NOT_A_FORWARD_MOVE/u);
      const weakened = pointer.definition.replace(
        'IF expected_prior IS DISTINCT FROM replaced THEN',
        'IF false AND expected_prior IS DISTINCT FROM replaced THEN');
      assert.notEqual(weakened, pointer.definition, 'f2 the weakening changed the guard');
      assert.ok(weakened.includes('IF false AND expected_prior'), 'f2 and it introduced the constant');
      await q(weakened);
      await q(`UPDATE ${M.PARTICIPATION} s SET current_event_id = $2 WHERE s.participant_user_id = $1`,
        [one, unrelated.id]);
      assert.equal(await count(M.PARTICIPATION, 'participant_user_id = $1 AND current_event_id = $2',
        [one, unrelated.id]), 1,
      'f2 without the guard the pointer really can jump to an unrelated act, so the guard is load-bearing');
      await q(pointer.definition);
      const [restored] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
        ['public.matching_participation_state_truth_v1()']);
      assert.equal(restored.prosrc, pointer.prosrc, 'f2 the production guard is restored byte for byte');
      await rejected(() => q(
        `UPDATE ${M.PARTICIPATION} s SET current_event_id = $2 WHERE s.participant_user_id = $1`,
        [one, first.id]), ['55000'], /MATCHING_CURRENT_STATE_NOT_A_FORWARD_MOVE/u);
    });

    const authority = (await rows(
      'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
      ['public.matching_authority_status_truth_v1()']))[0];
    await report.isolated('f3 the authority guard is what stops a revoked authority coming back', async () => {
      const grant = randomUUID();
      await insertGrant(grant, one, 'REVOKED');
      await rejected(() => q(`UPDATE ${M.GRANTS} SET status = 'ACTIVE', revoked_at = NULL WHERE id = $1`, [grant]),
        ['55000'], /MATCHING_AUTHORITY_TRANSITION_INVALID/u);
      const weakened = authority.definition.replace(
        "IF NOT (OLD.status = 'ACTIVE' AND NEW.status = 'REVOKED' AND NEW.revoked_at IS NOT NULL) THEN",
        "IF false AND NOT (OLD.status = 'ACTIVE' AND NEW.status = 'REVOKED' AND NEW.revoked_at IS NOT NULL) THEN");
      assert.notEqual(weakened, authority.definition, 'f3 the weakening changed the guard');
      assert.ok(weakened.includes('IF false AND NOT (OLD.status'), 'f3 and it introduced the constant');
      await q(weakened);
      await q(`UPDATE ${M.GRANTS} SET status = 'ACTIVE', revoked_at = NULL WHERE id = $1`, [grant]);
      assert.equal(await count(M.GRANTS, "id = $1 AND status = 'ACTIVE'", [grant]), 1,
        'f3 without the guard a revoked grant really does come back, so the guard is load-bearing');
      await q(`UPDATE ${M.GRANTS} SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP WHERE id = $1`, [grant]);
      await q(authority.definition);
      const [restored] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
        ['public.matching_authority_status_truth_v1()']);
      assert.equal(restored.prosrc, authority.prosrc, 'f3 the production guard is restored byte for byte');
      await rejected(() => q(`UPDATE ${M.GRANTS} SET status = 'ACTIVE', revoked_at = NULL WHERE id = $1`, [grant]),
        ['55000'], /MATCHING_AUTHORITY_TRANSITION_INVALID/u);
    });

    await report.isolated('f4 a later reviewed slice may add relations, a column and an index', async () => {
      // The roadmap, as a real migration: I-07B's candidate evaluation substrate
      // and I-07C's Introduction slot, an additive column and an index. None of
      // it may be refused by anything 0108 asserted, because 0108 bans what is
      // banned ON ITS OWN RELATIONS at ITS OWN deploy time.
      await q(`CREATE TABLE public.i07a_probe_candidate_eligibility (
                 id uuid PRIMARY KEY,
                 evaluated_for_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
                 requirement_version_id uuid NOT NULL
                   REFERENCES public.matching_requirement_versions (id) ON DELETE RESTRICT,
                 evaluation_state text NOT NULL CHECK (evaluation_state IN ('PASS','FAIL','UNKNOWN')))`);
      await q(`CREATE TABLE public.i07a_probe_introduction_slots (
                 id uuid PRIMARY KEY, holder_user_id uuid NOT NULL
                   REFERENCES public.users (id) ON DELETE RESTRICT,
                 opened_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await q(`ALTER TABLE ${M.ACTS} ADD COLUMN probe_client_ref text`);
      await q(`CREATE INDEX i07a_probe_acts_occurred_idx ON ${M.ACTS} (occurred_at)`);
      const row = act({ participant_user_id: one });
      await insertAct(row);
      assert.equal(await count(M.ACTS, 'id = $1', [row.id]), 1,
        'f4 a later candidate substrate, an Introduction slot, a column and an index leave the substrate working');
      await rejected(() => q(`UPDATE ${M.ACTS} SET probe_client_ref = 'x' WHERE id = $1`, [row.id]),
        ['55000'], /MATCHING_SETUP_RECORD_IS_IMMUTABLE/u);
      // And nothing 0108 asserted refuses any of it.
      await verifyCatalog();
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('the catalog is intact after the rolled-back weakenings', verifyCatalog);
}

// ---------------------------------------------------------------------- main
await runVerifier('0108', async (stage) => {
  await rt.client.connect();
  const report = createScenarioReport('0108', { query: q, restore: () => asRole('postgres') });
  const humans = [randomUUID(), randomUUID()];
  try {
    stage('catalog');
    await report.section('the catalog is exactly what the migration installed', verifyCatalog);
    stage('fixture');
    await rt.provisionHumans(humans);
    stage('representability');
    await verifyRepresentability(report, humans);
    stage('immutability');
    await verifyImmutability(report, humans);
    stage('bounded representation');
    await verifyBoundedRepresentation(report, humans);
    stage('disclosure binding');
    await verifyDisclosureBinding(report, humans);
    stage('forward safety');
    await verifyForwardSafety(report, humans);
  } finally {
    stage('fixture removal');
    await rt.removeCommittedMatchingSetup(humans);
    await rt.removeFixtureHumans(humans);
  }

  stage('report');
  await asRole('postgres');
  await report.section('the catalog is exactly what the migration installed, after every fixture is gone',
    verifyCatalog);
  // Every application role still holds nothing, with the fixtures gone.
  for (const role of APP_ROLES) {
    for (const table of MATCHING_TABLES) {
      const [{ allowed }] = await rows('SELECT has_table_privilege($1, $2::regclass, $3) allowed',
        [role, table, 'SELECT']);
      assert.equal(allowed, false, `${role} must hold no SELECT on ${table}`);
    }
  }
  report.print();
  report.assertAllPassed();
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${M.ACTS} WHERE participant_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${M.GRANTS} WHERE grantor_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${M.PROFILE_VERSIONS} WHERE owner_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${M.REQUIREMENT_VERSIONS} WHERE owner_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${M.AUTHORITIES} WHERE grantor_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${M.LOCKS} WHERE user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans]);
  assert.equal(Number(residue), 0, 'every fixture this verifier created was rolled back or removed');
}, () => rt.client.end().catch(() => undefined));
