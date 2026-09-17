// Real-PostgreSQL verifier for migration 0109 - I-07A Matching setup human
// authority commands and private self-inspection.
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// rows, the behaviour I-07A exists to guarantee: three independent human
// authorities, none of which can create, revoke or gate another; participation
// that fails closed to OFF and cannot launder a pause it may not resume; and a
// boundary that cannot be asked a question about anyone but its own caller.
//
//   A01 absence is OFF, and OFF is never inferred into ACTIVE by a profile, a
//       requirement set, a Matching Context Grant or a disclosure authority
//   A02 activation is an explicit authenticated human act with bounded entry
//       provenance, and an unauthenticated or invented one is refused
//   A03 the human participation walk: activate, pause, resume, turn off
//   A04 the I-07A resume path lifts USER_PAUSED and refuses the four reserved
//       pause reasons that require later revalidation
//   A05 turning off never launders a pause I-07A may not resume, and opting out
//       still works from one
//   A06 durable idempotency: an equivalent retry returns the COMMITTED answer
//       and writes nothing; the same id carrying a different request fails closed
//   A07 a stale expected state is refused and never applied to whatever is current
//   A08 no command can name another human, and a caller only ever sees itself
//
//   B01 the Matching Context Grant is separate truth: participation creates no
//       grant, a grant creates no participation, and turning off revokes neither
//       the grant nor the disclosure authority
//   B02 grant, reconfirm and revoke are exact-human, history-preserving and
//       idempotent, and a revoked grant is never reactivated
//   B03 revocation works while participation is OFF and while it is PAUSED
//   B04 another human's grant is reported as not found, exactly as a nonexistent
//       one is, so an error is no existence oracle
//
//   C01 an Introduction Profile update is a NEW immutable version with an exact
//       current identity, and the old version and its fields are untouched
//   C02 a stale expected version is refused, and a malformed field set is refused
//   C03 no profile field value is inferred from anything but the caller's own
//       arguments: the command reads no account, conversation, Shared, Public or
//       Replay relation at all
//
//   D01 a requirement update is a NEW immutable version preserving the exact
//       HARD_DEALBREAKER / SOFT_PREFERENCE distinction
//   D02 nothing evaluates a candidate, scores compatibility or ranks anyone
//
//   E01 a disclosure authority binds the caller's CURRENT profile version and an
//       exact approved subset of ITS fields
//   E02 an authority over V1 never silently covers V2, and a new authority over
//       a superseded version is refused
//   E03 reconfirmation and revocation preserve history; no proposal, recipient
//       or pair identifier exists anywhere in the authority substrate
//
//   G01 every boundary is executable by `authenticated` and by nobody else, and
//       no application role reaches a table directly
//   G02 a service credential can manufacture no human Matching consent
//
//   X01 two concurrent first activations serialize on the caller's own lock row,
//       and the loser is refused as stale rather than forking the history
//
//   f1..f3 the refused weakenings: a resume ceiling that no longer names
//          USER_PAUSED, a reactivation check that no longer fires, and a later
//          reviewed slice that adds a boundary and is refused by nothing
//
// Every scenario reports INDEPENDENTLY through the permanent aggregator and the
// run fails ONCE at the end naming all of them.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createMatchingRuntime, M, MFN, MATCHING_TABLES, MATCHING_COMMANDS, RESERVED_PAUSE_REASONS,
  ENTRY_CHANNELS, MATCHING_DISCLOSURE_BAN, runVerifier, APP_ROLES,
} from './matching-setup-verifier-support.mjs';

const rt = createMatchingRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const PROFILE_V1 = [['life_stage', 'settled and ready'], ['children_plan', 'yes, in time']];
const PROFILE_V2 = [['life_stage', 'settled and ready'], ['relocation_openness', 'same city only']];
const REQUIREMENTS = [
  ['faith_practice_level', 'HARD_DEALBREAKER', 'practising'],
  ['relocation_openness', 'SOFT_PREFERENCE', 'prefers the same city'],
];

// ---------------------------------------------------------------- 1. catalog
async function verifyCatalog() {
  await asRole('postgres');
  // Every boundary is a postgres-owned, search_path-pinned SECURITY DEFINER
  // function that derives its human from auth.uid() and is executable by
  // `authenticated` alone.
  for (const fn of [...MATCHING_COMMANDS, MFN.SETUP]) {
    const posture = await rt.functionPosture(fn);
    assert.equal(posture.owner, 'postgres', `G01 ${fn} is postgres-owned`);
    assert.equal(posture.secdef, true, `G01 ${fn} is SECURITY DEFINER`);
    assert.ok((posture.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'),
      `G01 ${fn} pins an empty search_path`);
    assert.match(posture.prosrc, /auth\.uid\(\)/u, `G01 ${fn} derives its human from auth.uid()`);
    for (const role of ['public', 'anon', 'service_role']) {
      assert.equal(await rt.canExecute(role, fn), false, `G02 ${role} must not execute ${fn}`);
    }
    assert.equal(await rt.canExecute('authenticated', fn), true, `G01 authenticated executes ${fn}`);
    // No boundary accepts an identity, a state, a reason or a timestamp: the
    // human is auth.uid() and every state literal is the function's own identity.
    const parameters = await rt.inputParameters(fn);
    for (const parameter of parameters) {
      assert.doesNotMatch(parameter,
        /user|human|actor|grantor|owner|participant|subject|recipient|candidate|pair|proposal|status|state|pause|reason|event_type|purpose|scope|permission|timestamp|occurred/u,
        `G01 ${fn} must not accept the parameter ${parameter}`);
    }
    // No boundary DISCLOSES a value, another human or a proposal.
    for (const column of await rt.resultColumns(fn)) {
      assert.doesNotMatch(column, MATCHING_DISCLOSURE_BAN, `G01 ${fn} must not return ${column}`);
    }
  }
  // The ten mutations are VOLATILE; the one projection is STABLE and writes nothing.
  for (const fn of MATCHING_COMMANDS) {
    assert.equal((await rt.functionPosture(fn)).volatility, 'v', `G01 ${fn} is a mutation and is VOLATILE`);
  }
  await rt.verifyPosture({ reading: [MFN.SETUP], tables: MATCHING_TABLES });

  // THE SELF-INSPECTION PROJECTION TAKES NO PARAMETER AT ALL, so a caller cannot
  // phrase a question about another human.
  assert.deepEqual(await rt.inputParameters(MFN.SETUP), [],
    'A08 the self-inspection projection takes no parameter: there is nothing to point at someone else');

  // THE THREE AUTHORITIES STAY INDEPENDENT in the bodies themselves.
  for (const fn of [MFN.GRANT_CONTEXT, MFN.REVOKE_CONTEXT, MFN.SET_PROFILE, MFN.SET_REQUIREMENTS,
    MFN.GRANT_DISCLOSURE, MFN.REVOKE_DISCLOSURE]) {
    const posture = await rt.functionPosture(fn);
    assert.ok(!/matching_participation/iu.test(posture.prosrc),
      `B01 ${fn} must not read or write participation state: the three authorities are independent`);
  }
  // NO COMMAND READS SHARED, PUBLIC, REPLAY OR PRIVATE MY_WORLD STATE. I-07A
  // creates authority, not the later candidate-evaluation context resolver.
  for (const fn of [...MATCHING_COMMANDS, MFN.SETUP]) {
    const posture = await rt.functionPosture(fn);
    assert.doesNotMatch(posture.prosrc,
      /public\.(shared_world|public_world|public_experience|replay|conversation_units|conversation_turns|conversation_sessions|him_)/u,
      `C03 ${fn} may not read Shared, Public, Replay or private MY_WORLD state`);
    assert.doesNotMatch(posture.prosrc, /pg_advisory|LOCK TABLE|TRUNCATE/iu,
      `${fn} takes no advisory lock, table lock or truncation`);
  }
  // EVERY CONSEQUENTIAL COMMAND SERIALIZES ON THE CALLER'S OWN LOCK ROW FIRST.
  for (const fn of MATCHING_COMMANDS) {
    const posture = await rt.functionPosture(fn);
    assert.ok(posture.prosrc.includes('INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)'),
      `${fn} must serialize on the caller's own Matching lock row`);
  }
  // THE I-02B / I-03C SHARED STANDING CONTEXT BOUNDARY IS UNTOUCHED.
  const shared = 'public.grant_shared_world_standing_context_v1(uuid, uuid, uuid, uuid[], uuid)';
  assert.equal(await rt.canExecute('authenticated', shared), true, 'B01 the Shared consent boundary is unchanged');
  assert.equal(await rt.canExecute('service_role', shared), false, 'B01 and still not service-role executable');
}

// ------------------------------------------------------- 2. participation law
async function verifyParticipation(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('A01 absence is OFF, and nothing infers ACTIVE from another authority', async () => {
      await actAs(one);
      const [before] = await rt.setup();
      assert.equal(before.participation_state, 'OFF', 'A01 a human with no history is not participating');
      assert.equal(before.pause_reason, null);
      assert.equal(before.participation_event_id, null);
      // A profile, a requirement set and a Matching Context Grant, all at once.
      await rt.setProfile(randomUUID(), PROFILE_V1);
      await rt.setRequirements(randomUUID(), REQUIREMENTS);
      await rt.grantContext(randomUUID(), randomUUID());
      const [after] = await rt.setup();
      assert.equal(after.participation_state, 'OFF',
        'A01 a profile, a requirement set and a private-context grant create NO participation');
      assert.ok(after.introduction_profile_version_id && after.matching_requirement_version_id
        && after.matching_context_grant_id, 'A01 and all three authorities really do exist');
      await asRole('postgres');
      assert.equal(await count(M.ACTS, 'participant_user_id = $1', [one]), 0,
        'A01 no participation act was written by any of them');
    });

    await report.isolated('A02 activation is explicit, authenticated and bounded in provenance', async () => {
      // No identity: auth.uid() is NULL and the command refuses.
      await actAs(null);
      await rejected(() => rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY'),
        ['42501'], /MATCHING_AUTHENTICATION_REQUIRED/u);
      await actAs(one);
      // An offer, a prompt or a suggestion is not an entry channel.
      for (const invented of ['QANDEEL_SUGGESTED', 'OFFERED', 'AUTOMATIC', '']) {
        await rejected(() => rt.activate(randomUUID(), invented), ['22023'], /MATCHING_ENTRY_CHANNEL_INVALID/u);
      }
      await rejected(() => rt.activate(randomUUID(), null), ['22023'], /MATCHING_COMMAND_INVALID/u);
      // Both frozen channels are real activation provenance, reached the way a
      // human reaches them: activate, opt out, activate again.
      const conversational = randomUUID();
      const [first] = await rt.activate(conversational, 'CONVERSATIONAL_ENTRY');
      assert.equal(first.participation_state, 'ACTIVE');
      const [off] = await rt.turnOff(randomUUID(), first.participation_event_id);
      const manual = randomUUID();
      const [second] = await rt.activate(manual, 'MANUAL_MY_WORLD_ENTRY', off.participation_event_id);
      assert.equal(second.participation_state, 'ACTIVE');
      await asRole('postgres');
      const provenance = await rows(
        `SELECT e.id, e.activation_entry_channel c FROM ${M.ACTS} e
          WHERE e.id = ANY($1::uuid[]) ORDER BY e.activation_entry_channel`, [[conversational, manual]]);
      assert.deepEqual(provenance.map((r) => r.c), ENTRY_CHANNELS.slice().sort(),
        'A02 each activation records exactly the channel the human entered through');
    });

    await report.isolated('A03 the human participation walk: activate, pause, resume, turn off', async () => {
      await actAs(one);
      const [activated] = await rt.activate(randomUUID(), 'CONVERSATIONAL_ENTRY');
      assert.equal(activated.participation_state, 'ACTIVE');
      assert.equal(activated.pause_reason, null);
      assert.equal(activated.superseded_event_id, null, 'A03 the first act is a chain root');

      const [paused] = await rt.pause(randomUUID(), activated.participation_event_id);
      assert.equal(paused.participation_state, 'PAUSED');
      assert.equal(paused.pause_reason, 'USER_PAUSED',
        'A03 the user pause reason is the function identity, not a parameter');

      const [resumed] = await rt.resume(randomUUID(), paused.participation_event_id);
      assert.equal(resumed.participation_state, 'ACTIVE');
      assert.equal(resumed.pause_reason, null);

      const [off] = await rt.turnOff(randomUUID(), resumed.participation_event_id);
      assert.equal(off.participation_state, 'OFF');
      const [current] = await rt.setup();
      assert.equal(current.participation_state, 'OFF', 'A03 opting out prevents current participation');
      await asRole('postgres');
      // Four immutable acts, and the pointer names the last of them. The walk is
      // read along the CHAIN and never by timestamp: `occurred_at` is the
      // TRANSACTION clock, so four acts committed by one verifier transaction
      // share an instant and a time ordering would be reading noise.
      const acts = await rows(
        `SELECT e.id, e.participation_act a, e.prior_event_id p FROM ${M.ACTS} e WHERE e.participant_user_id = $1`,
        [one]);
      const bySupersededId = new Map(acts.map((row) => [row.p, row]));
      const chain = [];
      for (let node = bySupersededId.get(null); node; node = bySupersededId.get(node.id)) chain.push(node.a);
      assert.deepEqual(chain, ['ACTIVATE', 'PAUSE', 'RESUME', 'TURN_OFF'],
        'A03 every act is still there, in one chain: the walk is history, not a mutable state field');
      assert.equal(chain.length, acts.length, 'A03 and the chain is the whole history, with nothing off it');
      assert.equal(await rt.currentActOf(one), off.participation_event_id,
        'A03 the current pointer names the exact last act');
    });

    // The four reserved pause reasons have NO I-07A producer on purpose, so the
    // state is reached the only honest way - as the table owner, inside a
    // scenario that rolls back - and each one gets its OWN scenario, so one
    // failure cannot hide the other three.
    assert.equal(RESERVED_PAUSE_REASONS.length, 4, 'A04 four pause reasons are reserved for I-07C and I-07D');
    for (const reason of RESERVED_PAUSE_REASONS) {
      await report.isolated(`A04 a ${reason} pause is not resumable in I-07A`, async () => {
        await actAs(one);
        const [activated] = await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY');
        await asRole('postgres');
        const paused = await rt.simulatePause(one, reason, activated.participation_event_id);
        await actAs(one);
        await rejected(() => rt.resume(randomUUID(), paused), ['55000'], /MATCHING_PAUSE_NOT_USER_RESUMABLE/u);
        // ... and activation is not a second door into the same pause.
        await rejected(() => rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY', paused),
          ['55000'], /MATCHING_PAUSE_NOT_USER_RESUMABLE/u);
        await asRole('postgres');
        assert.equal(await rt.currentActOf(one), paused, 'A04 the refusals changed nothing');
      });
    }

    await report.isolated('A04 a pause the human made is theirs to lift', async () => {
      await actAs(one);
      const [activated] = await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY');
      const [paused] = await rt.pause(randomUUID(), activated.participation_event_id);
      assert.equal(paused.pause_reason, 'USER_PAUSED');
      const [resumed] = await rt.resume(randomUUID(), paused.participation_event_id);
      assert.equal(resumed.participation_state, 'ACTIVE', 'A04 the one resumable pause really does resume');
    });

    await report.isolated('A05 turning off never launders a pause I-07A may not resume', async () => {
      await actAs(one);
      const [activated] = await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY');
      await asRole('postgres');
      const paused = await rt.simulatePause(one, 'ACTIVE_INTRODUCTION', activated.participation_event_id);
      await actAs(one);
      // Opting out ALWAYS works: it is the human's own privacy authority.
      const [off] = await rt.turnOff(randomUUID(), paused);
      assert.equal(off.participation_state, 'OFF', 'A05 a human may opt out from any state');
      // ... and the two-step bypass is exactly what is refused.
      await rejected(() => rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY', off.participation_event_id),
        ['55000'], /MATCHING_REACTIVATION_REQUIRES_REVALIDATION/u);
      await asRole('postgres');
      assert.equal(await rt.currentActOf(one), off.participation_event_id,
        'A05 the refusal changed nothing: the human is still OFF');
    });

    await report.isolated('A05 an OFF reached from a USER_PAUSED pause reactivates normally', async () => {
      await actAs(one);
      const [activated] = await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY');
      const [paused] = await rt.pause(randomUUID(), activated.participation_event_id);
      const [off] = await rt.turnOff(randomUUID(), paused.participation_event_id);
      const [again] = await rt.activate(randomUUID(), 'CONVERSATIONAL_ENTRY', off.participation_event_id);
      assert.equal(again.participation_state, 'ACTIVE',
        'A05 the one-hop check refuses a reserved pause and nothing else');
    });

    await report.isolated('A06 durable idempotency and command-id conflict', async () => {
      await actAs(one);
      const command = randomUUID();
      const [first] = await rt.activate(command, 'MANUAL_MY_WORLD_ENTRY');
      const [retry] = await rt.activate(command, 'MANUAL_MY_WORLD_ENTRY');
      assert.deepEqual(retry, first, 'A06 an equivalent retry returns the already committed answer');
      await asRole('postgres');
      assert.equal(await count(M.ACTS, 'participant_user_id = $1', [one]), 1,
        'A06 and writes no second act');
      await actAs(one);
      // The WHOLE immutable request is compared: a different entry channel under
      // the same id is a different command.
      await rejected(() => rt.activate(command, 'CONVERSATIONAL_ENTRY'), ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
      // ... and so is a different expected predecessor.
      await rejected(() => rt.activate(command, 'MANUAL_MY_WORLD_ENTRY', randomUUID()),
        ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
      // ... and so is the same id used for a different ACT entirely.
      await rejected(() => rt.pause(command, first.participation_event_id),
        ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
    });

    await report.isolated('A07 a stale expected state is refused and applied to nothing', async () => {
      await actAs(one);
      const [activated] = await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY');
      // Expecting nothing when something is current.
      await rejected(() => rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY'), ['40001'], /MATCHING_STALE_STATE/u);
      // Expecting the wrong act.
      await rejected(() => rt.pause(randomUUID(), randomUUID()), ['40001'], /MATCHING_STALE_STATE/u);
      // Expecting a real but superseded act.
      const [paused] = await rt.pause(randomUUID(), activated.participation_event_id);
      await rejected(() => rt.pause(randomUUID(), activated.participation_event_id),
        ['40001'], /MATCHING_STALE_STATE/u);
      // Pausing something that is not ACTIVE, and resuming something that is not PAUSED.
      await rejected(() => rt.pause(randomUUID(), paused.participation_event_id),
        ['55000'], /MATCHING_PARTICIPATION_NOT_ACTIVE/u);
      const [resumed] = await rt.resume(randomUUID(), paused.participation_event_id);
      await rejected(() => rt.resume(randomUUID(), resumed.participation_event_id),
        ['55000'], /MATCHING_PARTICIPATION_NOT_PAUSED/u);
      const [off] = await rt.turnOff(randomUUID(), resumed.participation_event_id);
      await rejected(() => rt.turnOff(randomUUID(), off.participation_event_id),
        ['55000'], /MATCHING_PARTICIPATION_ALREADY_OFF/u);
      await asRole('postgres');
      assert.equal(await rt.currentActOf(one), off.participation_event_id,
        'A07 nothing was applied to whatever was current');
    });

    await report.isolated('A08 a caller only ever sees and moves itself', async () => {
      await actAs(one);
      const [activated] = await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY');
      // The other human's own answer is their own OFF, and names nothing of the first.
      await actAs(two);
      const [other] = await rt.setup();
      assert.equal(other.participation_state, 'OFF', 'A08 the other human is not participating');
      assert.equal(other.participation_event_id, null, 'A08 and learns no identifier of anyone else');
      // They cannot move the first human's state: the act they name is not theirs
      // and the answer is the ordinary stale one, never "that is someone else's".
      await rejected(() => rt.pause(randomUUID(), activated.participation_event_id),
        ['40001'], /MATCHING_STALE_STATE/u);
      await asRole('postgres');
      assert.equal(await rt.currentActOf(one), activated.participation_event_id,
        'A08 the first human is exactly where they were');
      assert.equal(await rt.currentActOf(two), null, 'A08 and the second human still has no participation');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------ 3. the three families
async function verifyIndependentAuthorities(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('B01 turning participation off revokes no separately owned authority', async () => {
      await actAs(one);
      const grant = randomUUID();
      await rt.grantContext(randomUUID(), grant);
      const profileVersion = randomUUID();
      await rt.setProfile(profileVersion, PROFILE_V1);
      const authority = randomUUID();
      await rt.grantDisclosure(randomUUID(), authority, profileVersion, ['life_stage']);
      const [activated] = await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY');
      const [paused] = await rt.pause(randomUUID(), activated.participation_event_id);
      await rt.turnOff(randomUUID(), paused.participation_event_id);
      const [after] = await rt.setup();
      assert.equal(after.participation_state, 'OFF');
      assert.equal(after.matching_context_grant_id, grant,
        'B01 the Matching Context Grant is untouched by opting out');
      assert.equal(after.pre_match_disclosure_authority_id, authority,
        'B01 and so is the Pre-Match Disclosure Authority');
      assert.equal(after.introduction_profile_version_id, profileVersion);
      await asRole('postgres');
      assert.equal(await count(M.GRANTS, "id = $1 AND status = 'ACTIVE'", [grant]), 1,
        'B01 authority history is separate truth, gated later rather than erased now');
    });

    await report.isolated('B02 grant, reconfirm and revoke preserve history and never reactivate', async () => {
      await actAs(one);
      const first = randomUUID();
      const [granted] = await rt.grantContext(randomUUID(), first);
      assert.equal(granted.consent_event_type, 'GRANTED');
      assert.equal(granted.grant_status, 'ACTIVE');
      assert.equal(granted.superseded_grant_id, null);

      const second = randomUUID();
      const [reconfirmed] = await rt.grantContext(randomUUID(), second, first);
      assert.equal(reconfirmed.consent_event_type, 'RECONFIRMED');
      assert.equal(reconfirmed.superseded_grant_id, first,
        'B02 a reconfirmation is a NEW authority identity that names the one it replaced');
      await asRole('postgres');
      assert.equal(await count(M.GRANTS, "id = $1 AND status = 'REVOKED'", [first]), 1,
        'B02 the replaced grant is revoked history, not a rewritten row');
      assert.equal(await count(M.GRANTS, "grantor_user_id = $1 AND status = 'ACTIVE'", [one]), 1,
        'B02 and exactly one grant is current');

      await actAs(one);
      const [revoked] = await rt.revokeContext(randomUUID(), second);
      assert.equal(revoked.consent_event_type, 'REVOKED');
      assert.equal(revoked.grant_status, 'REVOKED');
      // A revoked grant is never revoked twice, and never comes back.
      await rejected(() => rt.revokeContext(randomUUID(), second), ['40001'], /MATCHING_STALE_STATE/u);
      await asRole('postgres');
      assert.equal(await count(M.GRANTS, 'grantor_user_id = $1', [one]), 2,
        'B02 both authority identities survive as history');
      assert.equal(await count(M.CONSENT, 'grantor_user_id = $1', [one]), 3,
        'B02 and so does every consent act that produced them');
    });

    await report.isolated('B03 revocation works while participation is OFF and while it is PAUSED', async () => {
      await actAs(one);
      const grant = randomUUID();
      await rt.grantContext(randomUUID(), grant);
      const [activated] = await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY');
      const [paused] = await rt.pause(randomUUID(), activated.participation_event_id);
      const [whilePaused] = await rt.revokeContext(randomUUID(), grant);
      assert.equal(whilePaused.grant_status, 'REVOKED', 'B03 a paused human may withdraw their private context');
      const second = randomUUID();
      await rt.grantContext(randomUUID(), second);
      await rt.turnOff(randomUUID(), paused.participation_event_id);
      const [whileOff] = await rt.revokeContext(randomUUID(), second);
      assert.equal(whileOff.grant_status, 'REVOKED', 'B03 and so may a human who has opted out entirely');
    });

    await report.isolated('B04 another human grant is reported exactly as a nonexistent one', async () => {
      await actAs(one);
      const grant = randomUUID();
      await rt.grantContext(randomUUID(), grant);
      await actAs(two);
      const mine = await rejected(() => rt.revokeContext(randomUUID(), grant), ['P0002'], /MATCHING_GRANT_NOT_FOUND/u);
      const nothing = await rejected(() => rt.revokeContext(randomUUID(), randomUUID()),
        ['P0002'], /MATCHING_GRANT_NOT_FOUND/u);
      assert.equal(mine.message, nothing.message,
        'B04 an error never discloses whether another human holds a Matching authority');
      await asRole('postgres');
      assert.equal(await count(M.GRANTS, "id = $1 AND status = 'ACTIVE'", [grant]), 1,
        'B04 and the other human grant is untouched');
    });

    await report.isolated('B02 grant idempotency and command-id conflict', async () => {
      await actAs(one);
      const command = randomUUID();
      const grant = randomUUID();
      const [first] = await rt.grantContext(command, grant);
      const [retry] = await rt.grantContext(command, grant);
      assert.deepEqual(retry, first, 'B02 an equivalent retry returns the already committed answer');
      await asRole('postgres');
      assert.equal(await count(M.GRANTS, 'grantor_user_id = $1', [one]), 1, 'B02 and creates no second grant');
      await actAs(one);
      await rejected(() => rt.grantContext(command, randomUUID()), ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
      await rejected(() => rt.revokeContext(command, grant), ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
      // A stale expectation is refused rather than applied to whatever is current.
      await rejected(() => rt.grantContext(randomUUID(), randomUUID(), randomUUID()),
        ['40001'], /MATCHING_STALE_STATE/u);
      await rejected(() => rt.grantContext(randomUUID(), randomUUID()), ['40001'], /MATCHING_STALE_STATE/u);
    });
  } finally {
    await q('ROLLBACK');
  }
}

// --------------------------------------------------- 4. versions and profiles
async function verifyVersions(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('C01 a profile update is a NEW immutable version with an exact current identity', async () => {
      await actAs(one);
      const v1 = randomUUID();
      const [created] = await rt.setProfile(v1, PROFILE_V1);
      assert.equal(created.introduction_profile_version_id, v1);
      assert.equal(created.superseded_version_id, null);
      assert.equal(created.field_count, 2);
      const v2 = randomUUID();
      const [updated] = await rt.setProfile(v2, PROFILE_V2, v1);
      assert.equal(updated.superseded_version_id, v1, 'C01 the new version names the one it supersedes');
      await asRole('postgres');
      // The OLD version and its exact fields are untouched.
      const original = await rows(
        `SELECT f.field_key k, f.field_value v FROM ${M.PROFILE_FIELDS} f
          WHERE f.profile_version_id = $1 ORDER BY f.field_key`, [v1]);
      assert.deepEqual(original.map((r) => [r.k, r.v]).sort(), [...PROFILE_V1].sort(),
        'C01 the historical version is exactly what it was: an update rewrites nothing');
      const [state] = await rows(
        `SELECT s.current_profile_version_id c FROM ${M.PROFILE_STATE} s WHERE s.owner_user_id = $1`, [one]);
      assert.equal(state.c, v2, 'C01 exactly one current version identity, chosen by pointer and not by timestamp');
      assert.equal(await count(M.PROFILE_VERSIONS, 'owner_user_id = $1', [one]), 2,
        'C01 and both versions exist');
    });

    await report.isolated('C02 a stale expected version and a malformed field set are refused', async () => {
      await actAs(one);
      const v1 = randomUUID();
      await rt.setProfile(v1, PROFILE_V1);
      await rejected(() => rt.setProfile(randomUUID(), PROFILE_V2), ['40001'], /MATCHING_STALE_STATE/u);
      await rejected(() => rt.setProfile(randomUUID(), PROFILE_V2, randomUUID()), ['40001'], /MATCHING_STALE_STATE/u);
      // Malformed field sets.
      await rejected(() => rt.setProfile(randomUUID(), [], v1), ['22023'], /MATCHING_FIELD_SET_INVALID/u);
      await rejected(() => rt.setProfile(randomUUID(), [['life_stage', 'x'], ['life_stage', 'y']], v1),
        ['22023'], /MATCHING_FIELD_KEY_DUPLICATE/u);
      await rejected(() => rows(
        'SELECT * FROM public.set_introduction_profile_v1($1, $2::text[], $3::text[], $4)',
        [randomUUID(), ['life_stage', 'children_plan'], ['only one value'], v1]),
      ['22023'], /MATCHING_FIELD_SET_INVALID/u);
      // A contact route can never enter a profile, even through the command.
      await rejected(() => rt.setProfile(randomUUID(), [['whatsapp_handle', '+000']], v1),
        ['23514'], /_contact_route_ban_check/u);
      await asRole('postgres');
      assert.equal(await count(M.PROFILE_VERSIONS, 'owner_user_id = $1', [one]), 1,
        'C02 not one refusal created a version');
    });

    await report.isolated('C01 profile idempotency, conflict and cross-human isolation', async () => {
      await actAs(one);
      const command = randomUUID();
      const [first] = await rt.setProfile(command, PROFILE_V1);
      const [retry] = await rt.setProfile(command, PROFILE_V1);
      assert.deepEqual(retry, first, 'C01 an equivalent retry returns the already committed version');
      await rejected(() => rt.setProfile(command, PROFILE_V2), ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
      // The other human's profile is their own, and they see nothing of this one.
      await actAs(two);
      const [other] = await rt.setup();
      assert.equal(other.introduction_profile_version_id, null, 'C01 the other human has no profile and learns of none');
      const theirs = randomUUID();
      await rt.setProfile(theirs, PROFILE_V2);
      const [mine] = await rt.setup();
      assert.equal(mine.introduction_profile_version_id, theirs);
      await actAs(one);
      const [still] = await rt.setup();
      assert.equal(still.introduction_profile_version_id, command,
        'C01 each human own current version is their own');
    });

    await report.isolated('D01 a requirement update is a NEW immutable version preserving hard vs soft', async () => {
      await actAs(one);
      const v1 = randomUUID();
      const [created] = await rt.setRequirements(v1, REQUIREMENTS);
      assert.equal(created.requirement_count, 2);
      await asRole('postgres');
      const items = await rows(
        `SELECT i.requirement_key k, i.requirement_strength s FROM ${M.REQUIREMENT_ITEMS} i
          WHERE i.requirement_version_id = $1 ORDER BY i.requirement_key`, [v1]);
      assert.deepEqual(items.map((r) => [r.k, r.s]),
        [['faith_practice_level', 'HARD_DEALBREAKER'], ['relocation_openness', 'SOFT_PREFERENCE']],
        'D01 the exact hard / soft distinction is stored as declared');
      // The human softens one requirement: a NEW version, with the old one intact.
      await actAs(one);
      const v2 = randomUUID();
      await rt.setRequirements(v2, [['faith_practice_level', 'SOFT_PREFERENCE', 'practising'],
        ['relocation_openness', 'SOFT_PREFERENCE', 'prefers the same city']], v1);
      await asRole('postgres');
      const [old] = await rows(
        `SELECT i.requirement_strength s FROM ${M.REQUIREMENT_ITEMS} i
          WHERE i.requirement_version_id = $1 AND i.requirement_key = 'faith_practice_level'`, [v1]);
      assert.equal(old.s, 'HARD_DEALBREAKER',
        'D01 a soft preference never silently overwrites the hard dealbreaker it replaced');
      const [now] = await rows(
        `SELECT i.requirement_strength s FROM ${M.REQUIREMENT_ITEMS} i
          WHERE i.requirement_version_id = $1 AND i.requirement_key = 'faith_practice_level'`, [v2]);
      assert.equal(now.s, 'SOFT_PREFERENCE', 'D01 and the new version carries the new truth');
    });

    await report.isolated('D02 nothing evaluates, scores or ranks a candidate', async () => {
      await actAs(one);
      const v1 = randomUUID();
      await rt.setRequirements(v1, REQUIREMENTS);
      // The I-07B candidate-side vocabulary is unrepresentable as a strength,
      // including through the command, so a requirement set can never quietly
      // become an evaluation.
      for (const invented of ['PASS', 'FAIL', 'UNKNOWN', 'WEIGHTED']) {
        await rejected(() => rt.setRequirements(randomUUID(), [['x_key', invented, 'v']], v1),
          ['23514'], /_strength_check/u);
      }
      await asRole('postgres');
      const evaluated = await rows(
        `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p')
            AND c.relname ~* '^(matching_|introduction_|pre_match_)'
            AND c.relname ~* '(candidate|proposal|pair|mutual|eligibility|compatib|rank|score|leaderboard)'`);
      assert.deepEqual(evaluated, [], 'D02 no candidate, proposal, ranking or compatibility relation exists');
    });

    await report.isolated('C03 a profile field comes from the caller arguments and nowhere else', async () => {
      // The command reads no account, conversation, Shared, Public or Replay
      // relation at all, so no eligibility-critical value can be inferred from a
      // name, a voice, a photo, a language style or a third-party claim.
      const posture = await rt.functionPosture(MFN.SET_PROFILE);
      const relations = [...posture.prosrc.matchAll(/public\.(\w+)/gu)].map((m) => m[1]);
      assert.deepEqual([...new Set(relations)].sort(),
        ['introduction_profile_field_values', 'introduction_profile_state', 'introduction_profile_versions',
          'matching_setup_locks'].sort(),
        'C03 the profile command touches exactly its own family and the lock row');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------ 5. pre-match disclosure law
async function verifyDisclosureAuthority(report, humans) {
  const [one, two] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('E01 an authority binds the CURRENT profile version and an exact approved subset', async () => {
      await actAs(one);
      const v1 = randomUUID();
      await rt.setProfile(v1, PROFILE_V1);
      const authority = randomUUID();
      const [granted] = await rt.grantDisclosure(randomUUID(), authority, v1, ['life_stage']);
      assert.equal(granted.authority_event_type, 'GRANTED');
      assert.equal(granted.bound_profile_version_id, v1, 'E01 the authority names one exact profile version');
      assert.equal(granted.approved_field_count, 1, 'E01 and one exact approved field');
      // A field the version does not carry is refused by name.
      await rejected(() => rt.grantDisclosure(randomUUID(), randomUUID(), v1, ['relocation_openness'], authority),
        ['22023'], /MATCHING_APPROVED_FIELD_NOT_IN_PROFILE_VERSION/u);
      await rejected(() => rt.grantDisclosure(randomUUID(), randomUUID(), v1, [], authority),
        ['22023'], /MATCHING_APPROVED_FIELD_SET_INVALID/u);
      await asRole('postgres');
      const approved = await rows(
        `SELECT f.field_key k FROM ${M.AUTHORITY_FIELDS} f WHERE f.authority_id = $1 ORDER BY f.field_key`,
        [authority]);
      assert.deepEqual(approved.map((r) => r.k), ['life_stage'],
        'E01 exactly the approved field, and no value of it, is recorded');
    });

    await report.isolated('E02 an authority over V1 never silently covers V2', async () => {
      await actAs(one);
      const v1 = randomUUID();
      await rt.setProfile(v1, PROFILE_V1);
      const authority = randomUUID();
      await rt.grantDisclosure(randomUUID(), authority, v1, ['life_stage', 'children_plan']);
      // The human edits the profile.
      const v2 = randomUUID();
      await rt.setProfile(v2, PROFILE_V2, v1);
      await asRole('postgres');
      const [bound] = await rows(
        `SELECT a.introduction_profile_version_id v FROM ${M.AUTHORITIES} a WHERE a.id = $1`, [authority]);
      assert.equal(bound.v, v1, 'E02 the existing authority stays bound to the version it approved');
      const approved = await rows(
        `SELECT f.field_key k FROM ${M.AUTHORITY_FIELDS} f WHERE f.authority_id = $1 ORDER BY f.field_key`,
        [authority]);
      assert.deepEqual(approved.map((r) => r.k), ['children_plan', 'life_stage'],
        'E02 including a field the new version no longer even has');
      // And a NEW authority cannot be granted over the superseded version.
      await actAs(one);
      await rejected(() => rt.grantDisclosure(randomUUID(), randomUUID(), v1, ['life_stage'], authority),
        ['40001'], /MATCHING_PROFILE_VERSION_NOT_CURRENT/u);
      // Re-approving is an explicit act over the version the human is looking at.
      const next = randomUUID();
      const [reconfirmed] = await rt.grantDisclosure(randomUUID(), next, v2, ['life_stage'], authority);
      assert.equal(reconfirmed.authority_event_type, 'RECONFIRMED');
      assert.equal(reconfirmed.bound_profile_version_id, v2);
      assert.equal(reconfirmed.superseded_authority_id, authority);
      await asRole('postgres');
      assert.equal(await count(M.AUTHORITIES, "id = $1 AND status = 'REVOKED'", [authority]), 1,
        'E02 the old authority is revoked history, never rewritten to point at the new version');
    });

    await report.isolated('E03 a disclosure authority creates no proposal and names no recipient', async () => {
      await actAs(one);
      const v1 = randomUUID();
      await rt.setProfile(v1, PROFILE_V1);
      const authority = randomUUID();
      await rt.grantDisclosure(randomUUID(), authority, v1, ['life_stage']);
      await asRole('postgres');
      for (const table of [M.AUTHORITIES, M.AUTHORITY_FIELDS, M.AUTHORITY_EVENTS]) {
        const columns = (await rows(
          'SELECT a.attname FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped',
          [table])).map((r) => r.attname);
        for (const column of columns) {
          assert.doesNotMatch(column, /recipient|proposal|candidate|pair|mutual|match_commit|conclusion|contact/u,
            `E03 ${table}.${column} would be a proposal identifier, and no proposal exists in I-07A`);
        }
      }
      // The authority authorizes a FIELD KEY, and no field key can be a contact route.
      await actAs(one);
      await rejected(() => rt.setProfile(randomUUID(), [['phone_number', '+000']], v1),
        ['23514'], /_contact_route_ban_check/u);
    });

    await report.isolated('E03 disclosure revocation, idempotency, conflict and cross-human isolation', async () => {
      await actAs(one);
      const v1 = randomUUID();
      await rt.setProfile(v1, PROFILE_V1);
      const command = randomUUID();
      const authority = randomUUID();
      const [first] = await rt.grantDisclosure(command, authority, v1, ['life_stage']);
      const [retry] = await rt.grantDisclosure(command, authority, v1, ['life_stage']);
      assert.deepEqual(retry, first, 'E03 an equivalent retry returns the already committed answer');
      await rejected(() => rt.grantDisclosure(command, authority, v1, ['life_stage', 'children_plan']),
        ['23505'], /MATCHING_COMMAND_ID_CONFLICT/u);
      // Another human cannot revoke it, and hears the same answer as for nothing.
      await actAs(two);
      const mine = await rejected(() => rt.revokeDisclosure(randomUUID(), authority),
        ['P0002'], /MATCHING_DISCLOSURE_AUTHORITY_NOT_FOUND/u);
      const nothing = await rejected(() => rt.revokeDisclosure(randomUUID(), randomUUID()),
        ['P0002'], /MATCHING_DISCLOSURE_AUTHORITY_NOT_FOUND/u);
      assert.equal(mine.message, nothing.message, 'E03 the refusal is no existence oracle');
      // ... and a human with no profile cannot grant one at all.
      await rejected(() => rt.grantDisclosure(randomUUID(), randomUUID(), v1, ['life_stage']),
        ['P0002', '40001'], /MATCHING_PROFILE_NOT_FOUND|MATCHING_PROFILE_VERSION_NOT_CURRENT/u);
      await actAs(one);
      const [revoked] = await rt.revokeDisclosure(randomUUID(), authority);
      assert.equal(revoked.authority_event_type, 'REVOKED');
      assert.equal(revoked.bound_profile_version_id, v1, 'E03 revocation still names what was authorized');
      await asRole('postgres');
      assert.equal(await count(M.AUTHORITY_FIELDS, 'authority_id = $1', [authority]), 1,
        'E03 the approved-field history survives revocation');
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ---------------------------------------------------------- 6. access posture
async function verifyAccess(report, humans) {
  const [one] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('G01 authenticated is the only executor, and identity still comes from auth.uid()', async () => {
      await asRole('authenticated', one);
      const [current] = await rt.setup();
      assert.equal(current.participation_state, 'OFF', 'G01 a real authenticated session reaches the projection');
      const [activated] = await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY');
      assert.equal(activated.participation_state, 'ACTIVE', 'G01 and reaches a command');
      // An authenticated session with no subject claim has no identity at all.
      await asRole('authenticated', null);
      await rejected(() => rt.setup(), ['42501'], /MATCHING_AUTHENTICATION_REQUIRED/u);
      await rejected(() => rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY'),
        ['42501'], /MATCHING_AUTHENTICATION_REQUIRED/u);
    });

    await report.isolated('G02 no system credential manufactures human Matching consent', async () => {
      for (const role of ['anon', 'service_role']) {
        await asRole(role, one);
        // Every consequential command is unreachable: not refused on a rule, but
        // not callable at all.
        await rejected(() => rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY'), ['42501'], /permission denied/iu);
        await rejected(() => rt.grantContext(randomUUID(), randomUUID()), ['42501'], /permission denied/iu);
        await rejected(() => rt.setProfile(randomUUID(), PROFILE_V1), ['42501'], /permission denied/iu);
        await rejected(() => rt.grantDisclosure(randomUUID(), randomUUID(), randomUUID(), ['life_stage']),
          ['42501'], /permission denied/iu);
        await rejected(() => rt.setup(), ['42501'], /permission denied/iu);
      }
    });

    await report.isolated('G02 no application role reaches a Matching table directly', async () => {
      for (const role of APP_ROLES) {
        await asRole(role, one);
        for (const table of MATCHING_TABLES) {
          await rejected(() => q(`SELECT 1 FROM ${table} LIMIT 1`), ['42501'], /permission denied/iu);
        }
      }
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('the catalog is intact after the rolled-back access probes', verifyCatalog);
}

// ----------------------------------------------------------- 7. serialization
async function verifySerialization(report, humans) {
  // A THIRD human, because this is the one section that COMMITS. Racing on a
  // human the rolled-back sections also use would leave committed participation
  // behind, and every later probe that activates from nothing would then be
  // refused as stale - a fixture defect reading as a runtime one.
  const one = humans[2];
  const { q2, actAs2, close } = await rt.openSecondary();
  try {
    await report.section('X01 two concurrent first activations serialize on the caller own lock row', async () => {
      await actAs(one);
      await q('BEGIN');
      const [winner] = await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY');
      assert.equal(winner.participation_state, 'ACTIVE', 'X01 the first activation holds the caller lock row');

      await actAs2(one);
      await q2('BEGIN');
      const contender = q2('SELECT * FROM public.activate_matching_participation_v1($1, $2, $3)',
        [randomUUID(), 'CONVERSATIONAL_ENTRY', null]);
      assert.equal(await rt.stillPending(contender), true,
        'X01 the second activation waits on the lock row rather than racing past it');
      await q('COMMIT');

      let refusal = null;
      try {
        await contender;
      } catch (error) {
        refusal = error;
      }
      assert.ok(refusal, 'X01 the loser is refused rather than silently forking the history');
      assert.equal(refusal.code, '40001', 'X01 and the refusal is the bounded stale-state one');
      await q2('ROLLBACK');

      await asRole('postgres');
      assert.equal(await count(M.ACTS, 'participant_user_id = $1', [one]), 1,
        'X01 exactly one activation committed');
      assert.equal(await rt.currentActOf(one), winner.participation_event_id,
        'X01 and the pointer names it');
    });
  } finally {
    await close();
  }
}

// --------------------------------------------------------- 8. forward safety
async function verifyForwardSafety(report, humans) {
  const [one] = humans;
  await asRole('postgres');
  await q('BEGIN');
  try {
    const resumeFn = (await rows(
      'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
      [MFN.RESUME]))[0];
    await report.isolated('f1 the USER_PAUSED resume ceiling is load-bearing', async () => {
      await actAs(one);
      const [activated] = await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY');
      await asRole('postgres');
      const paused = await rt.simulatePause(one, 'POST_SUCCESS', activated.participation_event_id);
      await actAs(one);
      await rejected(() => rt.resume(randomUUID(), paused), ['55000'], /MATCHING_PAUSE_NOT_USER_RESUMABLE/u);
      await asRole('postgres');
      const weakened = resumeFn.definition.replace(
        "IF current_act.resulting_pause_reason <> 'USER_PAUSED' THEN",
        "IF false AND current_act.resulting_pause_reason <> 'USER_PAUSED' THEN");
      assert.notEqual(weakened, resumeFn.definition, 'f1 the weakening changed the resume path');
      assert.ok(weakened.includes("IF false AND current_act.resulting_pause_reason"),
        'f1 and it introduced the constant');
      await q(weakened);
      await actAs(one);
      const [lifted] = await rt.resume(randomUUID(), paused);
      assert.equal(lifted.participation_state, 'ACTIVE',
        'f1 without the ceiling a POST_SUCCESS pause really does resume, so the ceiling is load-bearing');
      await asRole('postgres');
      await q(resumeFn.definition);
      const [restored] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [MFN.RESUME]);
      assert.equal(restored.prosrc, resumeFn.prosrc, 'f1 the production resume path is restored byte for byte');
    });

    const activateFn = (await rows(
      'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
      [MFN.ACTIVATE]))[0];
    await report.isolated('f2 the reactivation check is load-bearing', async () => {
      await actAs(one);
      const [activated] = await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY');
      await asRole('postgres');
      const paused = await rt.simulatePause(one, 'ACTIVE_INTRODUCTION', activated.participation_event_id);
      await actAs(one);
      const [off] = await rt.turnOff(randomUUID(), paused);
      await rejected(() => rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY', off.participation_event_id),
        ['55000'], /MATCHING_REACTIVATION_REQUIRES_REVALIDATION/u);
      await asRole('postgres');
      const weakened = activateFn.definition.replace(
        "IF prior_act.resulting_state = 'PAUSED' AND prior_act.resulting_pause_reason <> 'USER_PAUSED' THEN",
        "IF false AND prior_act.resulting_state = 'PAUSED' AND prior_act.resulting_pause_reason <> 'USER_PAUSED' THEN");
      assert.notEqual(weakened, activateFn.definition, 'f2 the weakening changed the activation path');
      assert.ok(weakened.includes("IF false AND prior_act.resulting_state"), 'f2 and it introduced the constant');
      await q(weakened);
      await actAs(one);
      const [laundered] = await rt.activate(randomUUID(), 'MANUAL_MY_WORLD_ENTRY', off.participation_event_id);
      assert.equal(laundered.participation_state, 'ACTIVE',
        'f2 without the check the two-step bypass really does work, so the check is load-bearing');
      await asRole('postgres');
      await q(activateFn.definition);
      const [restored] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure', [MFN.ACTIVATE]);
      assert.equal(restored.prosrc, activateFn.prosrc, 'f2 the production activation path is restored byte for byte');
    });

    await report.isolated('f3 a later reviewed slice may add its own boundary and column', async () => {
      // I-07B's candidate work, as a real migration would add it: a service-tier
      // derivation over the sealed I-07A state plus an additive column. Nothing
      // 0109 asserted refuses it, because 0109 asserted about ITS OWN boundaries
      // at ITS OWN deploy time.
      await q(`CREATE FUNCTION public.i07a_probe_candidate_reasoning_v1(p_for_user_id uuid)
               RETURNS TABLE(has_current_requirements boolean)
               LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $probe$
               BEGIN
                 RETURN QUERY SELECT EXISTS (SELECT 1 FROM public.matching_requirement_state s
                                              WHERE s.owner_user_id = p_for_user_id);
               END$probe$`);
      await q("ALTER TABLE public.matching_context_grants ADD COLUMN probe_reviewed_note text");
      await actAs(one);
      const [granted] = await rt.grantContext(randomUUID(), randomUUID());
      assert.equal(granted.grant_status, 'ACTIVE',
        'f3 a later derivation and an additive column leave every I-07A boundary working');
      await asRole('postgres');
      await verifyCatalog();
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('the catalog is intact after the rolled-back weakenings', verifyCatalog);
}

// ---------------------------------------------------------------------- main
await runVerifier('0109', async (stage) => {
  await rt.client.connect();
  const report = createScenarioReport('0109', { query: q, restore: () => asRole('postgres') });
  // Two humans for the rolled-back sections, and a third for the ONE section
  // that commits.
  const humans = [randomUUID(), randomUUID(), randomUUID()];
  try {
    stage('catalog');
    await report.section('the catalog is exactly what the migration installed', verifyCatalog);
    stage('fixture');
    await rt.provisionHumans(humans);
    stage('participation');
    await verifyParticipation(report, humans);
    stage('independent authorities');
    await verifyIndependentAuthorities(report, humans);
    stage('versions');
    await verifyVersions(report, humans);
    stage('disclosure authority');
    await verifyDisclosureAuthority(report, humans);
    stage('access posture');
    await verifyAccess(report, humans);
    stage('serialization');
    await verifySerialization(report, humans);
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
  report.print();
  report.assertAllPassed();
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${M.ACTS} WHERE participant_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${M.GRANTS} WHERE grantor_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${M.PROFILE_VERSIONS} WHERE owner_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${M.AUTHORITIES} WHERE grantor_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM ${M.LOCKS} WHERE user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans]);
  assert.equal(Number(residue), 0, 'every fixture this verifier created was rolled back or removed');
}, () => rt.client.end().catch(() => undefined));
