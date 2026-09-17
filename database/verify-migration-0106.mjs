// Real-PostgreSQL verifier for migration 0106 - I-06D post-finalization source
// availability and current complete-Replay usability.
//
// Runs against a FULLY migrated database and proves, from live catalogs and live
// rows, the ONE distinction this slice exists to make: a Replay Version that was
// historically FINALIZED stays historically finalized forever, while whether the
// source it represents is still usable is a SEPARATE answer that may change.
//
//   S01 a finalized Replay Version stays historically finalized after its source
//       stops being current: not one immutable row moves
//   S02 a source-current finalized version is a complete Replay, currently usable
//   S03 a source that became unavailable answers NOT currently usable
//   S04 a source that changed answers NOT currently usable
//   S05 the analytical layer stays SEALED historical evidence through both, and
//       the source layer alone becomes NOT_DEREFERENCEABLE
//   S06 the captured digest is never evidence that the source still exists
//   S07 nothing repairs, trims or re-composes the immutable Replay Version
//   S08 a NEW Replay Version cannot be built over the unavailable source
//   S09 the creator boundary leaks no source identity and no private staleness
//   S10 a stranger, another human's Replay and a nonexistent version all answer
//       ZERO ROWS, so the boundary is no existence oracle
//   S11 a Replay Version that was never finalized is not a complete Replay
//   S12 source currentness RECOVERS when the exact source returns, because the
//       answer is a live derivation and never a tombstone
//   S17 incomplete sealed analytical evidence is reachable and refuses on its
//       own, which is a different refusal from a source loss
//   S13 the availability derivation DELEGATES: a canonical answer this fixture
//       cannot produce is carried through, and SOURCE_CONTRADICTORY fails harder
//       than NOT_CURRENT
//   S14 no application role reaches the internal derivation or the relation
//   S15 the evidence relation carries no source content and no private cause
//   S16 the evidence relation is append-only for every role including its owner
//
//   f1..f4 the refused weakenings: a delegation replaced by a permissive
//          constant, an unavailable source that stays usable, an analytical
//          layer standing in for the missing source layer, and an append-only
//          guard that no longer fires
//
// Every scenario reports INDEPENDENTLY through the permanent aggregator and the
// run fails ONCE at the end naming all of them, so one defect cannot hide the
// rest and cost a whole focused round per finding.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createReplayClosureRuntime, C, CFN, I06D_IMMUTABLE, USABILITY_CLASSES,
  CLOSURE_DISCLOSURE_BAN, runVerifier, APP_ROLES, R, V,
} from './replay-closure-verifier-support.mjs';

const rt = createReplayClosureRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const OWN_TABLES = [C.SOURCE_EVENTS];

/** One source-availability observation, as postgres, for the persistence proofs. */
const eventRow = (base, over = {}) => ({
  id: randomUUID(), replay_id: base.replay, replay_version_id: base.version,
  source_manifest_version_id: base.manifest, observed_availability_state: 'NOT_CURRENT', ...over,
});
const insertEvent = (row) => q(
  `INSERT INTO ${C.SOURCE_EVENTS}
     (id, replay_id, replay_version_id, source_manifest_version_id, observed_availability_state, observed_at)
   VALUES ($1, $2, $3, $4, $5, clock_timestamp())`,
  [row.id, row.replay_id, row.replay_version_id, row.source_manifest_version_id,
    row.observed_availability_state]);

// ---------------------------------------------------------------- 1. catalog
async function verifyCatalog() {
  await asRole('postgres');
  await rt.verifyPosture({
    internal: [CFN.AVAILABILITY],
    reading: [CFN.AVAILABILITY, CFN.USABILITY],
    triggers: [CFN.MUTATION_TRIGGER],
    tables: OWN_TABLES,
    immutable: [I06D_IMMUTABLE[0]],
  });

  // THE CREATOR BOUNDARY IS SERVICE-TIER ONLY AND DISCLOSURE-BOUNDED. It is not
  // asserted through `resolvers`, because that spec is the PUBLIC surface
  // contract - it requires the canonical Public visibility state and the
  // audience admission gate, which a creator-private boundary has no business
  // consulting at all.
  const boundary = await rt.functionPosture(CFN.USABILITY);
  assert.equal(boundary.owner, 'postgres', 'S09 the usability boundary is postgres-owned');
  assert.equal(boundary.secdef, true, 'S09 and SECURITY DEFINER');
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.equal(await rt.canExecute(role, CFN.USABILITY), false,
      `S09 ${role} must not execute the creator usability boundary`);
  }
  assert.equal(await rt.canExecute('service_role', CFN.USABILITY), true,
    'S09 the service tier executes the creator usability boundary');
  const columns = await rt.resultColumns(CFN.USABILITY);
  assert.ok(columns.length > 0, 'S09 the boundary declares result columns');
  for (const column of columns) {
    assert.doesNotMatch(column, CLOSURE_DISCLOSURE_BAN, `S09 the boundary must not return ${column}`);
  }

  // IT COMPOSES THE CANONICAL DERIVATIONS AND WRITES NO SECOND ONE.
  const availability = await rt.functionPosture(CFN.AVAILABILITY);
  assert.ok(availability.prosrc.includes('derive_replay_source_manifest_currency_v1'),
    'S13 current source availability consumes the ONE canonical I-06A source currency');
  for (const forbidden of ['conversation_units', 'shared_world_materials', 'encode(sha256',
    'replay_version_finalizations']) {
    assert.ok(!availability.prosrc.includes(forbidden),
      `S06 the availability derivation must not consult ${forbidden}: it re-derives no source truth and treats no digest or historical finalization as evidence of a current source`);
  }
  assert.ok(boundary.prosrc.includes('derive_replay_version_current_availability_v1')
    && boundary.prosrc.includes('replay_analytical_projection_points'),
  'S05 the usability boundary consumes the ONE source availability derivation and establishes the sealed analytical evidence of its own exact version');
  // AND IT DOES NOT COMPOSE THE OWNER-SCOPED I-06B TRUTH CURRENCY. That
  // derivation reaches the canonical historical projection, which is scoped to
  // auth.uid() and raises FORBIDDEN for anyone but the Session owner; this
  // boundary names its human as a PARAMETER, so composing the two would make the
  // answer depend on which session asked rather than on which human was named.
  assert.ok(!boundary.prosrc.includes('derive_replay_version_truth_currency_v1')
    && !boundary.prosrc.includes('get_session_historical_projection_v1'),
  'S05 a boundary whose human is a parameter composes no auth.uid()-scoped derivation');
  const canonical = await rt.functionPosture(CFN.TRUTH_CURRENCY);
  assert.ok(canonical.prosrc.includes('get_session_historical_projection_v1'),
    'S05 and the frozen I-06B truth currency is untouched, still asking its own owner-scoped question');

  // S15 THE EVIDENCE RELATION CARRIES NO SOURCE CONTENT AND NO PRIVATE CAUSE.
  const eventColumns = await rows(
    `SELECT a.attname, ty.typname FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
      WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped`, [C.SOURCE_EVENTS]);
  assert.ok(eventColumns.length > 0, 'S15 the evidence relation declares columns to check');
  for (const { attname, typname } of eventColumns) {
    assert.doesNotMatch(attname,
      /(committed_text|transcript|audio|body|content|payload|url|uri|path|object_key|bucket|storage|staleness|provenance|digest|session|turn|conversation_unit|shared_|material|history_item)/u,
      `S15 the evidence relation may not carry ${attname}`);
    assert.ok(!['json', 'jsonb', 'bytea'].includes(typname),
      `S15 ${attname} may not be an untyped payload column`);
  }

  // AND IT BINDS THE EXACT FINALIZED VERSION OF ITS EXACT REPLAY, AS ONE ROW.
  await rt.assertExactBinding(C.SOURCE_EVENTS, 'public.replay_versions',
    ['replay_version_id', 'replay_id', 'source_manifest_version_id'],
    ['id', 'replay_id', 'source_manifest_version_id']);
  await rt.assertExactBinding(C.SOURCE_EVENTS, 'public.replay_version_finalizations',
    ['replay_version_id', 'replay_id'], ['replay_version_id', 'replay_id']);
}

// ------------------------------------------------------- 2. the row scenarios
/**
 * A committed fixture: two humans, one covered Personal Session, and one
 * historically FINALIZED Replay Version whose two selected segments are the
 * creator's OWN committed sentences at sealed positions.
 */
async function provisionFixture(humans) {
  await asRole('postgres');
  await q('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [humans]);
  const finalized = await rt.provisionFinalizedReplay(humans[0]);
  await asRole('postgres');
  return finalized;
}

async function verifyAvailability(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    const [creator] = f.humans;
    const stranger = f.humans[1];

    await report.isolated('S02 a source-current finalized version is a complete Replay, currently usable', async () => {
      const [current] = await rt.availability(base.replay, base.version);
      assert.equal(current.availability_state, 'CURRENT', 'S02 the bound source is still exactly what was captured');
      assert.equal(current.source_staleness_class, null, 'S02 with no staleness cause');
      const [usable] = await rt.usability(base.replay, base.version, creator);
      assert.equal(usable.usability_state, 'COMPLETE_REPLAY_CURRENTLY_USABLE');
      assert.equal(usable.source_content_bearing_layer, 'DEREFERENCEABLE');
      assert.equal(usable.analytical_visual_layer, 'SEALED_HISTORICAL_EVIDENCE');
      assert.equal(usable.unavailable_class, null, 'S02 and no actionable refusal');
    });

    await report.isolated('S01 S03 S05 S07 an unavailable source leaves every immutable row untouched', async () => {
      const before = { ...await rt.replaySnapshot(base.replay), ...await rt.versionSnapshot(base.replay) };
      const finalizedBefore = await rows(
        `SELECT replay_version_id, finalized_by_user_id, finalized_at::text AS at
           FROM ${V.FINALIZATIONS} WHERE replay_id = $1 ORDER BY replay_version_id`, [base.replay]);
      assert.equal(finalizedBefore.length, 1, 'S01 exactly one historical finalization exists to preserve');

      await rt.detachSourceUnit(base.selectedUnits[0], stranger);
      await asRole('postgres');
      const [after] = await rt.availability(base.replay, base.version);
      assert.equal(after.availability_state, 'NOT_CURRENT', 'S03 the exact captured row is no longer the creator own');
      assert.equal(after.source_staleness_class, 'SOURCE_UNAVAILABLE',
        'S03 and the internal class is the canonical I-06A one, passed straight through');

      // S01 THE HISTORICAL FACT IS UNCHANGED, byte for byte, including the
      // database-native instant text rather than a JavaScript Date.
      const finalizedAfter = await rows(
        `SELECT replay_version_id, finalized_by_user_id, finalized_at::text AS at
           FROM ${V.FINALIZATIONS} WHERE replay_id = $1 ORDER BY replay_version_id`, [base.replay]);
      assert.deepEqual(finalizedAfter, finalizedBefore,
        'S01 the historical finalization is exactly what it was: source loss rewrites no history');
      // S07 AND NEITHER IS ANY OTHER IMMUTABLE COMPONENT.
      const nowSnapshot = { ...await rt.replaySnapshot(base.replay), ...await rt.versionSnapshot(base.replay) };
      assert.deepEqual(nowSnapshot, before,
        'S07 no manifest item was dropped, no selection shrank, no projection or contract moved');

      // S05 THE TWO LAYERS DIVERGE EXACTLY AS THE ARCHITECTURE SAYS.
      const [usable] = await rt.usability(base.replay, base.version, creator);
      assert.equal(usable.usability_state, 'COMPLETE_REPLAY_NOT_CURRENTLY_USABLE');
      assert.equal(usable.source_content_bearing_layer, 'NOT_DEREFERENCEABLE',
        'S05 the source-content-bearing layer can no longer be dereferenced');
      assert.equal(usable.analytical_visual_layer, 'SEALED_HISTORICAL_EVIDENCE',
        'S05 and the analytical evidence is NOT erased merely because the source moved');
      assert.equal(usable.unavailable_class, 'SOURCE_NOT_CURRENTLY_AVAILABLE');
      // AND THE INTACT ANALYTICAL LAYER DOES NOT MAKE A COMPLETE REPLAY: an
      // analytical-only rendering can never be served under this Replay's name.
      assert.notEqual(usable.usability_state, 'COMPLETE_REPLAY_CURRENTLY_USABLE',
        'S05 sealed analytical evidence never stands in for a source layer that is gone');
    });

    await report.isolated('S04 S06 a source that CHANGED is not current, and its captured digest proves nothing', async () => {
      const original = await rt.sourceTextOf(base.selectedUnits[1]);
      assert.ok(original, 'S04 the fixture source text is readable');
      const [digest] = await rows(
        `SELECT i.captured_source_digest d FROM ${R.MANIFEST_ITEMS} i
          WHERE i.manifest_version_id = $1 AND i.personal_conversation_unit_id = $2`,
        [base.manifest, base.selectedUnits[1]]);
      assert.match(digest.d, /^sha256:[0-9a-f]{64}$/u, 'S06 the manifest still carries the captured digest');

      await rt.changeSourceText(base.selectedUnits[1]);
      await asRole('postgres');
      const [after] = await rt.availability(base.replay, base.version);
      assert.equal(after.availability_state, 'NOT_CURRENT');
      assert.equal(after.source_staleness_class, 'SOURCE_CHANGED');
      // S06 THE DIGEST IS STILL THERE AND STILL EXACTLY WHAT IT WAS, and it
      // makes the answer NO rather than YES: a digest records what the source
      // WAS, never that it still IS.
      const [stillThere] = await rows(
        `SELECT i.captured_source_digest d FROM ${R.MANIFEST_ITEMS} i
          WHERE i.manifest_version_id = $1 AND i.personal_conversation_unit_id = $2`,
        [base.manifest, base.selectedUnits[1]]);
      assert.equal(stillThere.d, digest.d, 'S06 the captured digest is immutable and unchanged');
      const [usable] = await rt.usability(base.replay, base.version, creator);
      assert.equal(usable.usability_state, 'COMPLETE_REPLAY_NOT_CURRENTLY_USABLE');
      assert.equal(usable.unavailable_class, 'SOURCE_NOT_CURRENTLY_AVAILABLE');
    });

    await report.isolated('S12 source currentness RECOVERS when the exact source returns', async () => {
      const original = await rt.sourceTextOf(base.selectedUnits[0]);
      await rt.changeSourceText(base.selectedUnits[0], 'Q');
      await asRole('postgres');
      assert.equal((await rt.availability(base.replay, base.version))[0].availability_state, 'NOT_CURRENT',
        'S12 the changed source is not current');
      await rt.restoreSourceText(base.selectedUnits[0], original);
      await asRole('postgres');
      const [recovered] = await rt.availability(base.replay, base.version);
      assert.equal(recovered.availability_state, 'CURRENT',
        'S12 the answer is a LIVE derivation, not a one-way tombstone');
      const [usable] = await rt.usability(base.replay, base.version, creator);
      assert.equal(usable.usability_state, 'COMPLETE_REPLAY_CURRENTLY_USABLE',
        'S12 and the complete Replay is usable again');
    });

    await report.isolated('S08 a NEW Replay Version cannot be built over the unavailable source', async () => {
      // The creator reopens for revision while the source is still current, and
      // only THEN does the source stop being current. The frozen I-06B preview
      // path revalidates it and refuses: a new Replay Version can never be built
      // over source that is no longer available.
      await actAs(creator);
      const [reopened] = await rt.reopen({ command: randomUUID(), replay: base.replay, version: base.version });
      assert.equal(reopened.outcome, 'REPLAY_REOPENED_FOR_REVISION', 'S08 the Replay reopened for revision');
      await rt.detachSourceUnit(base.selectedUnits[0], stranger);
      await asRole('postgres');
      const revision = await rt.draftRevision(base.replay);
      await actAs(creator);
      await rejected(() => rt.preview(rt.freshPreview(base.replay, revision)), ['40001', '55000', 'P0001'],
        /REPLAY_SOURCE_STALE|REPLAY_STALE|REPLAY_CONTRADICTORY_STATE/u);
      await asRole('postgres');
      // AND THE OLD IMMUTABLE VERSION IS STILL THERE, still historically
      // finalized: reopening changes the Replay's current lifecycle and erases
      // no evidence.
      assert.equal(await count(V.FINALIZATIONS, 'replay_version_id = $1', [base.version]), 1,
        'S08 the historical finalization of the old version survives the reopen');
    });

    await report.isolated('S09 S10 the creator boundary is creator-exact and no existence oracle', async () => {
      // S10 THREE DIFFERENT PRIVATE FACTS, ONE IDENTICAL ANSWER.
      assert.deepEqual(await rt.usability(base.replay, base.version, stranger), [],
        'S10 another human learns nothing about this Replay');
      assert.deepEqual(await rt.usability(randomUUID(), randomUUID(), creator), [],
        'S10 a nonexistent Replay and version answer the same way');
      assert.deepEqual(await rt.usability(randomUUID(), base.version, creator), [],
        'S10 and so does a real version named under the wrong Replay');

      // S09 THE CREATOR'S OWN ANSWER IS BOUNDED. The private I-06A staleness
      // class never crosses the boundary, in either direction.
      await rt.detachSourceUnit(base.selectedUnits[0], stranger);
      await asRole('postgres');
      const [internal] = await rt.availability(base.replay, base.version);
      const [creatorAnswer] = await rt.usability(base.replay, base.version, creator);
      assert.equal(internal.source_staleness_class, 'SOURCE_UNAVAILABLE',
        'S09 the internal derivation does hold the private class');
      assert.ok(USABILITY_CLASSES.includes(creatorAnswer.unavailable_class),
        `S09 and the creator receives one of the bounded classes, not ${creatorAnswer.unavailable_class}`);
      for (const value of Object.values(creatorAnswer)) {
        if (typeof value !== 'string') continue;
        assert.ok(!['SOURCE_UNAVAILABLE', 'SOURCE_CHANGED', 'SOURCE_ACCESS_LOST',
          'SOURCE_CONTRADICTORY', 'SOURCE_VERSION_NOT_CURRENT'].includes(value),
        `S09 the private staleness class ${value} must never reach the creator boundary`);
      }
      // AND NO COLUMN OF THE ANSWER IS AN IDENTIFIER OF ANYTHING PRIVATE.
      assert.deepEqual(Object.keys(creatorAnswer).sort(),
        ['analytical_visual_layer', 'replay_id', 'replay_version_id', 'source_content_bearing_layer',
          'unavailable_class', 'usability_state'],
        'S09 the boundary returns exactly its bounded surface');
    });

    await report.isolated('S17 incomplete sealed analytical evidence is reachable, and refuses', async () => {
      // The negative half of the analytical layer. It is unreachable in
      // production because every I-06B component binds restrictively and is
      // append-only - which is exactly why it is produced here by fixture
      // surgery, so the state is proven to be a real check rather than a
      // decorative constant that could never answer anything else.
      const [{ n: before }] = await rows(
        `SELECT count(*)::int n FROM ${V.POINTS} WHERE projection_version_id = $1`, [base.projection]);
      assert.ok(before > 0, 'S17 the sealed projection really has points to lose');
      await rt.asReplica(() => q(
        `DELETE FROM ${V.POINTS} WHERE projection_version_id = $1 AND selected_ordinal = 1`,
        [base.projection]));
      await asRole('postgres');
      const [{ n: after }] = await rows(
        `SELECT count(*)::int n FROM ${V.POINTS} WHERE projection_version_id = $1`, [base.projection]);
      assert.equal(after, before - 1, 'S17 one sealed point really is gone');
      const [answer] = await rt.usability(base.replay, base.version, creator);
      assert.equal(answer.analytical_visual_layer, 'SEALED_EVIDENCE_INCOMPLETE');
      assert.equal(answer.usability_state, 'COMPLETE_REPLAY_NOT_CURRENTLY_USABLE');
      assert.equal(answer.unavailable_class, 'ANALYTICAL_EVIDENCE_INCOMPLETE',
        'S17 and the complete Replay is refused on the analytical layer, with the source still current');
      assert.equal(answer.source_content_bearing_layer, 'DEREFERENCEABLE',
        'S17 which is a different refusal from a source loss, and says so');
    });

    await report.isolated('S11 a Replay Version that was never finalized is not a complete Replay', async () => {
      await actAs(creator);
      const [reopened] = await rt.reopen({ command: randomUUID(), replay: base.replay, version: base.version });
      assert.equal(reopened.outcome, 'REPLAY_REOPENED_FOR_REVISION');
      await asRole('postgres');
      const second = rt.freshPreview(base.replay, await rt.draftRevision(base.replay));
      await actAs(creator);
      const [previewed] = await rt.preview(second);
      assert.equal(previewed.outcome, 'REPLAY_PREVIEW_READY', 'S11 a SECOND version exists but was never finalized');
      await asRole('postgres');
      const [answer] = await rt.usability(base.replay, second.version, creator);
      assert.equal(answer.usability_state, 'COMPLETE_REPLAY_NOT_CURRENTLY_USABLE');
      assert.equal(answer.unavailable_class, 'REPLAY_VERSION_NOT_FINALIZED',
        'S11 the complete-Replay question does not apply to a version that was never finalized');
      // And the source is current, so this refusal is about finalization alone.
      assert.equal((await rt.availability(base.replay, second.version))[0].availability_state, 'CURRENT',
        'S11 the refusal is the missing finalization, not the source');
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('the catalog is intact after the rolled-back source surgery', verifyCatalog);
}

// ------------------------------------------------- 3. the evidence relation
async function verifyEvidence(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    await report.isolated('S16 the evidence relation is append-only for every role including its owner', async () => {
      const row = eventRow(base);
      await insertEvent(row);
      assert.equal(await count(C.SOURCE_EVENTS, 'id = $1', [row.id]), 1, 'S16 the observation was recorded');
      await rejected(() => q(
        `UPDATE ${C.SOURCE_EVENTS} SET observed_availability_state = 'CURRENT' WHERE id = $1`, [row.id]),
      ['55000'], /REPLAY_POST_FINALIZATION_IS_IMMUTABLE/u);
      await rejected(() => q(`DELETE FROM ${C.SOURCE_EVENTS} WHERE id = $1`, [row.id]),
        ['55000'], /REPLAY_POST_FINALIZATION_IS_IMMUTABLE/u);
      assert.equal(await count(C.SOURCE_EVENTS, "id = $1 AND observed_availability_state = 'NOT_CURRENT'",
        [row.id]), 1, 'S16 and the observation is exactly what was observed');
    });

    await report.isolated('S15 an observation can only spell the bounded answer', async () => {
      await rejected(() => insertEvent(eventRow(base, { observed_availability_state: 'PROBABLY_FINE' })),
        ['23514'], /_state_check/u);
      await rejected(() => insertEvent(eventRow(base, { observed_availability_state: 'SOURCE_UNAVAILABLE' })),
        ['23514'], /_state_check/u);
    });

    await report.isolated('S15 an observation cannot name a version of another Replay or a foreign manifest', async () => {
      await rejected(() => insertEvent(eventRow(base, { replay_id: randomUUID() })),
        ['23503'], /_target_fk|_final_fk/u);
      await rejected(() => insertEvent(eventRow(base, { source_manifest_version_id: randomUUID() })),
        ['23503'], /_target_fk/u);
      await rejected(() => insertEvent(eventRow(base, { replay_version_id: randomUUID() })),
        ['23503'], /_target_fk|_final_fk/u);
    });

    await report.isolated('S14 no application role reaches the derivation, the boundary table or the guard', async () => {
      for (const role of APP_ROLES) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
          const [{ allowed }] = await rows('SELECT has_table_privilege($1, $2::regclass, $3) allowed',
            [role, C.SOURCE_EVENTS, privilege]);
          assert.equal(allowed, false, `S14 ${role} must hold no ${privilege} on ${C.SOURCE_EVENTS}`);
        }
        assert.equal(await rt.canExecute(role, CFN.AVAILABILITY), false,
          `S14 ${role} must not execute the internal availability derivation`);
        assert.equal(await rt.canExecute(role, CFN.MUTATION_TRIGGER), false,
          `S14 ${role} must not execute the append-only guard directly`);
      }
    });
  } finally {
    await q('ROLLBACK');
  }
}

// ------------------------------------------------------------- 4. delegation
async function verifyDelegation(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    const currency = await rt.captureSeamDefinition(CFN.SOURCE_CURRENCY, {
      expect: ['CURRENT', 'SOURCE_UNAVAILABLE'], forbid: ['I-06D VERIFIER PROBE'] });

    await report.isolated('S13 the availability derivation DELEGATES rather than re-deriving', async () => {
      // A canonical answer this MY_WORLD fixture cannot produce on its own. If
      // the 0106 derivation re-derived source truth instead of consuming the
      // canonical one, this would change nothing.
      await rt.simulateSourceCurrency('STALE', 'SOURCE_CONTRADICTORY');
      const [contradictory] = await rt.availability(base.replay, base.version);
      assert.equal(contradictory.availability_state, 'CONTRADICTORY',
        'S13 a contradictory source fails CLOSED harder than a merely stale one');
      assert.equal(contradictory.source_staleness_class, 'SOURCE_CONTRADICTORY');
      const [creatorAnswer] = await rt.usability(base.replay, base.version, f.humans[0]);
      assert.equal(creatorAnswer.unavailable_class, 'SOURCE_STATE_CONTRADICTORY',
        'S13 and the creator receives the bounded contradiction class');

      await rt.simulateSourceCurrency('STALE', 'SOURCE_ACCESS_LOST');
      const [lost] = await rt.availability(base.replay, base.version);
      assert.equal(lost.availability_state, 'NOT_CURRENT', 'S13 an access loss is NOT_CURRENT');
      assert.equal(lost.source_staleness_class, 'SOURCE_ACCESS_LOST',
        'S13 and the canonical class is carried through unchanged, never re-spelled');

      await rt.simulateSourceCurrency('CURRENT', null);
      assert.equal((await rt.availability(base.replay, base.version))[0].availability_state, 'CURRENT',
        'S13 and a canonical CURRENT is carried through too, so the probe is load-bearing in both directions');
    });

    await rt.restoreSeamDefinition(currency);
    await report.section('the frozen canonical source currency is restored byte for byte', async () => {
      await asRole('postgres');
      const posture = await rt.functionPosture(CFN.SOURCE_CURRENCY);
      assert.equal(posture.prosrc, currency.prosrc,
        'the production I-06A source-currency derivation is exactly what it was');
      assert.ok(!posture.prosrc.includes('I-06D VERIFIER PROBE'),
        'and carries no trace of the verifier probe');
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('the catalog is intact after the rolled-back delegation probe', verifyCatalog);
}

// --------------------------------------------------------- 5. forward safety
async function verifyForwardSafety(report, f, base) {
  await asRole('postgres');
  await q('BEGIN');
  try {
    const [guard] = await rows(
      'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
      [CFN.MUTATION_TRIGGER]);
    await report.isolated('f4 the append-only guard is what refuses a mutation by the table owner', async () => {
      const row = eventRow(base);
      await insertEvent(row);
      await rejected(() => q(
        `UPDATE ${C.SOURCE_EVENTS} SET observed_availability_state = 'CURRENT' WHERE id = $1`, [row.id]),
      ['55000'], /REPLAY_POST_FINALIZATION_IS_IMMUTABLE/u);
      const weakened = guard.definition.replace(
        "RAISE EXCEPTION 'REPLAY_POST_FINALIZATION_IS_IMMUTABLE'",
        "RETURN NEW; RAISE EXCEPTION 'REPLAY_POST_FINALIZATION_IS_IMMUTABLE'");
      assert.notEqual(weakened, guard.definition, 'f4 the weakening changed the guard');
      assert.ok(weakened.includes('RETURN NEW; RAISE EXCEPTION'), 'f4 and it introduced the early return');
      await q(weakened);
      await q(`UPDATE ${C.SOURCE_EVENTS} SET observed_availability_state = 'CURRENT' WHERE id = $1`, [row.id]);
      assert.equal(await count(C.SOURCE_EVENTS, "id = $1 AND observed_availability_state = 'CURRENT'", [row.id]), 1,
        'f4 without the guard the owner really can rewrite an observation, so the guard is load-bearing');
      await q(guard.definition);
      const [{ prosrc }] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
        [CFN.MUTATION_TRIGGER]);
      assert.equal(prosrc, guard.prosrc, 'f4 the production append-only guard is restored byte for byte');
    });

    const [derivation] = await rows(
      'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
      [CFN.AVAILABILITY]);
    await report.isolated('f1 replacing the canonical delegation with a permissive constant is caught', async () => {
      await rt.detachSourceUnit(base.selectedUnits[0], f.humans[1]);
      await asRole('postgres');
      assert.equal((await rt.availability(base.replay, base.version))[0].availability_state, 'NOT_CURRENT',
        'f1 the production derivation answers NOT_CURRENT over the unavailable source');
      // The anchor is taken from the BODY, which `pg_get_functiondef` returns
      // verbatim - never from the signature, which PostgreSQL regenerates in its
      // own canonical form and which no anchor would match.
      const weakened = derivation.definition.replace(
        "IF currency.currency_state = 'CURRENT' THEN",
        "IF true OR currency.currency_state = 'CURRENT' THEN");
      assert.notEqual(weakened, derivation.definition, 'f1 the weakening changed the derivation');
      assert.ok(weakened.includes('IF true OR currency.currency_state'), 'f1 and it introduced the constant');
      await q(weakened);
      assert.equal((await rt.availability(base.replay, base.version))[0].availability_state, 'CURRENT',
        'f1 without the delegation an unavailable source really does read CURRENT, so the delegation is load-bearing');

      // AND THE CATALOG CONTRACT IS NOT VACUOUS EITHER: a derivation that stops
      // consulting the canonical source currency at all - the second evaluator
      // this slice is forbidden to write - is refused by the catalog check.
      const detached = derivation.definition.replace(
        'FROM public.derive_replay_source_manifest_currency_v1(version.source_manifest_version_id) c;',
        "FROM (SELECT 'CURRENT'::text AS currency_state, NULL::text AS staleness_class) c;");
      assert.notEqual(detached, derivation.definition, 'f1 the second weakening changed the derivation');
      assert.ok(!detached.includes('derive_replay_source_manifest_currency_v1'),
        'f1 and it removed the canonical delegation entirely');
      await q(detached);
      let refused = false;
      try { await verifyCatalog(); } catch { refused = true; }
      assert.ok(refused,
        'f1 the catalog check really refuses a derivation that no longer consumes the ONE canonical source currency');

      await q(derivation.definition);
      const [{ prosrc }] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
        [CFN.AVAILABILITY]);
      assert.equal(prosrc, derivation.prosrc, 'f1 the production derivation is restored byte for byte');
      assert.equal((await rt.availability(base.replay, base.version))[0].availability_state, 'NOT_CURRENT',
        'f1 and it refuses the unavailable source again');
    });

    const [boundary] = await rows(
      'SELECT pg_get_functiondef(pr.oid) definition, pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
      [CFN.USABILITY]);
    await report.isolated('f2 f3 an unavailable source that stays usable, and an analytical stand-in, are both caught', async () => {
      await rt.detachSourceUnit(base.selectedUnits[0], f.humans[1]);
      await asRole('postgres');
      assert.equal((await rt.usability(base.replay, base.version, f.humans[0]))[0].usability_state,
        'COMPLETE_REPLAY_NOT_CURRENTLY_USABLE', 'f2 the production boundary refuses the unavailable source');
      // f3 THE ANALYTICAL LAYER STANDING IN FOR THE MISSING SOURCE LAYER is
      // exactly the shape "an analytical-only fallback branded as the original
      // Replay" takes in code: the source gate is answered from the analytical
      // one. The weakening is a single clause.
      const weakened = boundary.definition.replace(
        "IF current_availability IS DISTINCT FROM 'CURRENT' THEN",
        "IF analytical_layer <> 'SEALED_HISTORICAL_EVIDENCE' AND current_availability IS DISTINCT FROM 'CURRENT' THEN");
      assert.notEqual(weakened, boundary.definition, 'f3 the weakening changed the boundary');
      assert.ok(weakened.includes("IF analytical_layer <> 'SEALED_HISTORICAL_EVIDENCE' AND current_availability"),
        'f3 and it introduced the analytical stand-in');
      await q(weakened);
      const [standIn] = await rt.usability(base.replay, base.version, f.humans[0]);
      assert.equal(standIn.usability_state, 'COMPLETE_REPLAY_CURRENTLY_USABLE',
        'f3 without the source gate the intact analytical layer really does carry the Replay, so the gate is load-bearing');
      assert.equal(standIn.source_content_bearing_layer, 'NOT_DEREFERENCEABLE',
        'f3 and it would be served while its own source layer says it cannot be dereferenced, which is the defect');
      await q(boundary.definition);
      const [{ prosrc }] = await rows('SELECT pr.prosrc FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
        [CFN.USABILITY]);
      assert.equal(prosrc, boundary.prosrc, 'f2 f3 the production boundary is restored byte for byte');
      assert.equal((await rt.usability(base.replay, base.version, f.humans[0]))[0].usability_state,
        'COMPLETE_REPLAY_NOT_CURRENTLY_USABLE', 'f2 and it refuses the unavailable source again');
    });

    await report.isolated('f5 a later reviewed slice may add relations, a column and an index', async () => {
      // The roadmap, as a real migration: a reviewed media delivery boundary
      // with a real storage handle, a reviewed external-provider receipt, an
      // additive column and an index. None of it may be forbidden by anything
      // 0106 asserted, because 0106 bans what is banned ON ITS OWN RELATIONS.
      await q(`CREATE TABLE public.i06d_probe_delivery_receipts (
                 id uuid PRIMARY KEY,
                 distribution_package_version_id uuid NOT NULL
                   REFERENCES public.replay_distribution_package_versions (id) ON DELETE RESTRICT,
                 storage_object_key text NOT NULL, delivered_at timestamptz NOT NULL)`);
      await q(`CREATE TABLE public.i06d_probe_external_copies (
                 id uuid PRIMARY KEY, receipt_id uuid NOT NULL
                   REFERENCES public.i06d_probe_delivery_receipts (id) ON DELETE RESTRICT,
                 remote_url text NOT NULL)`);
      await q(`ALTER TABLE ${C.SOURCE_EVENTS} ADD COLUMN probe_client_ref text`);
      await q(`CREATE INDEX i06d_probe_source_events_at_idx ON ${C.SOURCE_EVENTS} (observed_at)`);
      const [current] = await rt.availability(base.replay, base.version);
      assert.equal(current.availability_state, 'CURRENT',
        'f5 a later delivery boundary, an external-copy record, a column and an index leave the derivation answering');
      await verifyCatalog();
    });
  } finally {
    await q('ROLLBACK');
  }
  await report.section('the catalog is intact after the rolled-back weakenings', verifyCatalog);
}

// ---------------------------------------------------------------------- main
await runVerifier('0106', async (stage) => {
  await rt.client.connect();
  const report = createScenarioReport('0106', { query: q, restore: () => asRole('postgres') });
  const f = { humans: [randomUUID(), randomUUID()] };
  let base = null;
  try {
    stage('catalog');
    await report.section('the catalog is exactly what the migration installed', verifyCatalog);
    stage('fixture');
    base = await provisionFixture(f.humans);
    stage('availability');
    await verifyAvailability(report, f, base);
    stage('evidence');
    await verifyEvidence(report, f, base);
    stage('delegation');
    await verifyDelegation(report, f, base);
    stage('forward safety');
    await verifyForwardSafety(report, f, base);
  } finally {
    stage('fixture removal');
    await rt.removeCommittedReconciliations(f.humans);
    await rt.removeCommittedReplayVersions(f.humans);
    await rt.removeCommittedReplays(f.humans);
    await rt.removeHistoricalFixture(f.humans);
    await rt.removeFixtureHumans(f.humans);
  }

  stage('report');
  await asRole('postgres');
  await report.section('the catalog is exactly what the migration installed, after every fixture is gone',
    verifyCatalog);
  report.print();
  report.assertAllPassed();
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${C.SOURCE_EVENTS} WHERE replay_id IN
               (SELECT id FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[])))
          + (SELECT count(*) FROM ${R.REPLAYS} WHERE created_by_user_id = ANY($1::uuid[]))
          + (SELECT count(*) FROM public.conversation_sessions WHERE user_id = ANY($1::uuid[])) AS residue`,
    [f.humans]);
  assert.equal(Number(residue), 0, 'every fixture this verifier created was rolled back or removed');
}, () => rt.client.end().catch(() => undefined));
