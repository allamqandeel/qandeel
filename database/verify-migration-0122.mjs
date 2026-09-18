// Real-PostgreSQL verifier for migration 0122 - QAN-CW-REM-03, Introduction
// disclosure deletion-time privacy erasure.
//
// Runs against a FULLY migrated database and proves that an owner-deleted
// disclosure leaves no practical verifier of the deleted payload behind, that
// the erasure is one-way and unreachable outside a proven owner deletion, and
// that nothing the frozen I-07D slice owned moved underneath it.
//
//   P01 posture: both replaced boundaries keep their frozen signatures, result
//       columns, postgres-owned SECURITY DEFINER shape and "executable by
//       nobody" ACL; the guard is a trigger function nobody can call; privacy
//       erasure is not a command of its own
//   P02 the verifier state and the verifier columns are ONE structural fact,
//       in both directions
//
//   D01 a text FULL_NAME disclosure carries both verifiers while the payload
//       exists
//   D02 same command + same payload before deletion is the historical success
//   D03 same command + changed payload before deletion is the command conflict
//   D04 owner deletion destroys the payload, the digest and the payload-derived
//       request reference, keeps every audit identity column, and marks the
//       history DELETED_BY_OWNER
//   D05 CONTACT_METHOD: the same erasure properties
//   D06 DEEPER_PERSONAL_FIELD: the same, and its field key goes with the payload
//   D07 a media disclosure: the same, under the same generic deletion law
//   D08 a retry after erasure fails closed, compares nothing, reconstructs
//       nothing and writes nothing
//   D09 the owner-deletion command's own retry is unaffected and re-proves that
//       no verifier survives
//   D10 a pre-0122 already-deleted row is erasable through the guard
//   D11 payload absent while the history is NOT DELETED_BY_OWNER is refused,
//       never auto-redacted as though an owner deletion had happened
//   D12 the counterpart's closed view of a deleted disclosure is unchanged
//   D13 the erasure is one-way: no return to PRESENT, no replacement digest, no
//       identity change, no DELETE, and no erasure while the payload lives
//   D14 no other relation retains a payload-derived verifier of the disclosure
//
//   REM03-ERASE-ID-01 - erasure destroys content equivalence, not request identity
//   E01 same surviving identity + the original payload   -> ERASED_BY_OWNER
//   E02 same surviving identity + a different payload    -> ERASED_BY_OWNER
//   E03 a changed TEXT resource_type                     -> COMMAND_ID_CONFLICT
//   E04 a changed IMAGE resource_type                    -> COMMAND_ID_CONFLICT
//   E05 a stranger                                       -> COMMAND_ID_CONFLICT
//   E06 a changed World, resource version, material, history item or grant
//       event                                            -> COMMAND_ID_CONFLICT
//   E07 and none of them recreates a payload or a verifier
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import process from 'node:process';
import { createScenarioReport } from './verifier-scenarios.mjs';
import {
  createIntroductionRuntime, D, DFN, I07D_GUARDS, mediaRef,
  runVerifier, APP_ROLES, PFN,
} from './introduction-lifecycle-verifier-support.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, count, asRole, actAs, rejected } = rt;

const DURABLE = ['55000'];
const CONTRADICTORY = ['P0001'];
const CONFLICT = ['23505'];

const DELETE_SIG = 'public.delete_shared_world_owned_material_v1(uuid, uuid, uuid, uuid)';
const DISCLOSE_SIG = 'public.commit_introduction_progressive_disclosure_v1(uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text)';
const GUARD_SIG = 'public.introduction_disclosure_verifier_erasure_guard_v1()';

/** Every column of the disclosure command that is AUDIT IDENTITY and must survive. */
const AUDIT_IDENTITY = ['id', 'world_id', 'introduction_record_id', 'resource_version_id', 'material_id',
  'history_item_id', 'disclosure_granted_event_id', 'owner_user_id', 'counterpart_user_id',
  'resource_type', 'baseline_viewer_count', 'committed_at'];

const commandRow = async (id) =>
  (await rows(`SELECT * FROM ${D.COMMANDS} c WHERE c.id = $1`, [id]))[0] ?? null;
const historyItem = async (id) =>
  (await rows('SELECT * FROM public.shared_world_history_items i WHERE i.id = $1', [id]))[0] ?? null;
/** The exact two-part text digest the frozen boundary computes, reproduced here. */
const textDigest = (fieldKey, text) =>
  `sha256:${createHash('sha256').update(`${fieldKey ?? ''}\n${text}`, 'utf8').digest('hex')}`;

/** One owner deletion of one disclosed material, through the canonical capability. */
async function deleteDisclosure(owner, world, material) {
  await actAs(owner);
  const [deleted] = await rt.deleteMaterial(randomUUID(), world, material, randomUUID());
  await asRole('postgres');
  assert.equal(deleted.outcome, 'MATERIAL_DELETED', 'the owner deletion committed');
  return deleted;
}

/**
 * The whole ASSURE-F06 property, asked of one disclosure after its owner
 * deleted it: the content and every verifier of it are gone, and the audit
 * identity is exactly what it was.
 */
async function assertErased(before, ids, label) {
  const after = await commandRow(ids.command);
  assert.ok(after, `${label}: the durable command row SURVIVES - audit identity is not deleted`);
  for (const column of AUDIT_IDENTITY) {
    const [was, is] = [before[column], after[column]];
    const same = was instanceof Date ? was.getTime() === is.getTime() : String(was) === String(is);
    assert.ok(same, `${label}: the audit column ${column} is unchanged (${was} -> ${is})`);
  }
  assert.equal(after.verifier_state, 'ERASED_BY_OWNER', `${label}: the verifier state records the erasure`);
  assert.equal(after.payload_digest, null, `${label}: the payload digest is GONE`);
  assert.equal(after.request_ref, null, `${label}: the payload-derived request reference is GONE`);
  assert.ok(after.verifier_erased_at instanceof Date, `${label}: and the erasure instant is recorded`);
  assert.equal(await rt.textPayload(ids.version), null, `${label}: the text payload is gone`);
  assert.equal(await rt.mediaPayload(ids.version), null, `${label}: the media payload is gone`);
  assert.ok(await rt.versionRow(ids.version), `${label}: the resource version SURVIVES its payload`);
  assert.ok(await rt.grantEvent(ids.version), `${label}: and so does the grant fact`);
  const item = await historyItem(ids.item);
  assert.equal(item.availability_state, 'DELETED_BY_OWNER', `${label}: the history is terminal`);
  assert.deepEqual((await rt.baselineViewersOf(ids.item)).length, 2,
    `${label}: and the exact original audience is still recorded`);
}

// --------------------------------------------------------------- 1. posture
async function verifyPosture() {
  await asRole('postgres');
  for (const signature of [DELETE_SIG, DISCLOSE_SIG]) {
    const p = await rt.functionPosture(signature);
    assert.equal(p.owner, 'postgres', `${signature} is postgres-owned`);
    assert.equal(p.secdef, true, `${signature} is SECURITY DEFINER`);
    assert.ok((p.config ?? []).some((c) => c === 'search_path=' || c === 'search_path=""'),
      `${signature} pins an empty search_path`);
    for (const role of ['public', ...APP_ROLES]) {
      assert.equal(await rt.canExecute(role, signature), false,
        `${role} must not execute ${signature} before the frozen CW2-08 Launch Gate exists`);
    }
    assert.doesNotMatch(p.prosrc, /pg_advisory|LOCK TABLE|TRUNCATE/iu, `${signature} takes no advisory or table lock`);
  }
  assert.deepEqual(await rt.resultColumns(DELETE_SIG),
    ['outcome', 'command_id', 'deleted_world_id', 'deleted_material_id', 'deleted_history_item_id',
      'deleted_event_id', 'invalidated_targets', 'deleted_at'],
    'owner deletion keeps its exact frozen result columns');
  assert.deepEqual(await rt.resultColumns(DISCLOSE_SIG),
    ['outcome', 'command_id', 'disclosed_world_id', 'disclosed_resource_version_id', 'disclosed_material_id',
      'disclosed_history_item_id', 'disclosed_resource_type', 'disclosed_at'],
    'and the disclosure boundary keeps its exact frozen result columns');

  // THE GUARD IS A TRIGGER FUNCTION AND NOTHING ELSE.
  const guard = await rt.functionPosture(GUARD_SIG);
  assert.equal(guard.owner, 'postgres', 'the guard is postgres-owned');
  const [{ returns }] = await rows('SELECT pr.prorettype::regtype::text returns FROM pg_proc pr WHERE pr.oid = $1::regprocedure',
    [GUARD_SIG]);
  assert.equal(returns, 'trigger', 'the guard returns trigger and is callable as nothing else');
  for (const role of ['public', ...APP_ROLES]) {
    assert.equal(await rt.canExecute(role, GUARD_SIG), false, `${role} must not execute the guard`);
  }
  assert.equal(await rt.triggerEnabled(D.COMMANDS, 'introduction_disclosure_commands_immutable'), true,
    'and it holds the disclosure command relation under the frozen trigger name');
  const [{ holder }] = await rows(
    `SELECT pr.proname holder FROM pg_trigger t JOIN pg_proc pr ON pr.oid = t.tgfoid
      WHERE t.tgrelid = $1::regclass AND t.tgname = 'introduction_disclosure_commands_immutable'
        AND NOT t.tgisinternal`, [D.COMMANDS]);
  assert.equal(holder, 'introduction_disclosure_verifier_erasure_guard_v1',
    'the blanket refusal was REPLACED by the one-way guard, not removed');

  // PRIVACY ERASURE IS NOT A COMMAND OF ITS OWN.
  const [{ n: rpcs }] = await rows(
    `SELECT count(*) n FROM pg_proc pr JOIN pg_namespace ns ON ns.oid = pr.pronamespace
      WHERE ns.nspname = 'public' AND pr.proname ~ 'eras' AND pr.prorettype <> 'trigger'::regtype::oid`);
  assert.equal(Number(rpcs), 0, 'there is no erasure RPC: the transition is reachable only through owner deletion');

  // EXACTLY ONE FUNCTION ERASES A VERIFIER, and it is owner deletion.
  const erasers = await rows(
    `SELECT pr.proname FROM pg_proc pr JOIN pg_namespace ns ON ns.oid = pr.pronamespace
      WHERE ns.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
        AND pr.prosrc ~ 'UPDATE public\\.introduction_disclosure_commands' ORDER BY pr.proname`);
  assert.deepEqual(erasers.map((e) => e.proname), ['delete_shared_world_owned_material_v1'],
    'exactly one canonical primitive erases a disclosure verifier');
}

/** P02 - the state and the columns cannot disagree, in either direction. */
async function verifyStructuralState() {
  await asRole('postgres');
  const [shape] = await rows(
    `SELECT pg_get_constraintdef(c.oid) def FROM pg_constraint c
      WHERE c.conrelid = $1::regclass AND c.conname = 'introduction_disclosure_commands_verifier_shape_check'`,
    [D.COMMANDS]);
  assert.ok(shape, 'the verifier shape check exists');
  for (const clause of ['PRESENT', 'ERASED_BY_OWNER', 'payload_digest IS NOT NULL', 'payload_digest IS NULL',
    'request_ref IS NOT NULL', 'request_ref IS NULL', 'verifier_erased_at IS NULL', 'verifier_erased_at IS NOT NULL']) {
    assert.ok(shape.def.includes(clause), `the shape check states ${clause}`);
  }
  const [state] = await rows(
    `SELECT pg_get_constraintdef(c.oid) def FROM pg_constraint c
      WHERE c.conrelid = $1::regclass AND c.conname = 'introduction_disclosure_commands_verifier_state_check'`,
    [D.COMMANDS]);
  assert.match(state.def, /PRESENT/u, 'the verifier state vocabulary is bounded');
  assert.match(state.def, /ERASED_BY_OWNER/u, 'to exactly two values');
  const columns = await rows(
    `SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'introduction_disclosure_commands'
        AND column_name IN ('payload_digest', 'request_ref', 'verifier_state', 'verifier_erased_at')
      ORDER BY column_name`);
  assert.deepEqual(columns.map((c) => [c.column_name, c.is_nullable]),
    [['payload_digest', 'YES'], ['request_ref', 'YES'], ['verifier_erased_at', 'YES'], ['verifier_state', 'NO']],
    'the two verifiers became nullable so they can be destroyed; the state never is');
}

// ----------------------------------------------------- 2. the privacy matrix
async function verifyPrivacyErasure(report, humans) {
  await q('BEGIN');
  try {
    await report.isolated('D01 a delivered text disclosure carries both verifiers', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      const row = await commandRow(ids.command);
      assert.equal(row.verifier_state, 'PRESENT');
      assert.equal(row.payload_digest, textDigest(null, 'Sara Kamel'),
        'D01 the digest is the exact two-part digest of the exact bytes');
      assert.match(row.request_ref, /^sha256:[0-9a-f]{64}$/u, 'D01 and the whole-request reference is present');
      assert.equal(row.verifier_erased_at, null, 'D01 nothing has been erased');
      assert.ok(await rt.textPayload(ids.version), 'D01 and the payload is there');
    });

    await report.isolated('D02 the same command and the same payload is the historical success', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids, answer } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      await actAs(f.lower);
      const [again] = await rt.disclose(ids, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      assert.equal(again.outcome, 'DISCLOSURE_GRANTED');
      assert.equal(again.disclosed_at.getTime(), answer.disclosed_at.getTime(),
        'D02 with the exact instant it committed');
    });

    await report.isolated('D03 the same command and a changed payload is the command conflict', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      await actAs(f.lower);
      await rejected(() => rt.disclose(ids, f.world, 'FULL_NAME', { text: 'Sara Kamal' }), CONFLICT,
        /INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT/u);
    });

    // THE DEFECT ITSELF, and the whole of the fix.
    await report.isolated('D04 owner deletion destroys the payload AND both verifiers', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      const before = await commandRow(ids.command);
      assert.ok(before.payload_digest, 'D04 the verifier exists before the deletion');
      const deleted = await deleteDisclosure(f.lower, f.world, ids.material);
      await assertErased(before, ids, 'D04');
      const after = await commandRow(ids.command);
      assert.equal(after.verifier_erased_at.getTime(), deleted.deleted_at.getTime(),
        'D04 erased at the exact instant of the deletion itself, not a second one');
      // AND THE OFFLINE GUESS NO LONGER ANSWERS. The digest of a plausible
      // guess used to be comparable against a value the database kept.
      assert.equal(await count(D.COMMANDS, 'payload_digest = $1', [textDigest(null, 'Sara Kamel')]), 0,
        'D04 a correct guess of the deleted payload matches nothing that survived');
    });

    for (const [type, payload, label] of [
      ['CONTACT_METHOD', { text: '+20 100 000 0000' }, 'D05'],
      ['DEEPER_PERSONAL_FIELD', { text: 'a private thing about me', fieldKey: 'personal_note' }, 'D06'],
    ]) {
      await report.isolated(`${label} ${type} deletion has the same erasure properties`, async () => {
        const f = await rt.bringToIntroduction(humans[0], humans[1]);
        const { ids } = await rt.discloseAs(f.lower, f.world, type, payload);
        const before = await commandRow(ids.command);
        assert.equal(before.payload_digest, textDigest(payload.fieldKey ?? null, payload.text),
          `${label} the digest binds the exact bytes`);
        await deleteDisclosure(f.lower, f.world, ids.material);
        await assertErased(before, ids, label);
        assert.equal(await count(D.COMMANDS, 'payload_digest = $1',
          [textDigest(payload.fieldKey ?? null, payload.text)]), 0,
        `${label} and a correct guess matches nothing`);
      });
    }

    await report.isolated('D07 a media disclosure erases under the same generic law', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const reference = mediaRef('rem03-full-image');
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_IMAGE', { media: reference });
      const before = await commandRow(ids.command);
      assert.ok(before.payload_digest, 'D07 the media reference has a digest too');
      await deleteDisclosure(f.lower, f.world, ids.material);
      await assertErased(before, ids, 'D07');
    });

    await report.isolated('D08 a retry after erasure fails closed and reconstructs nothing', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      await deleteDisclosure(f.lower, f.world, ids.material);
      const before = await commandRow(ids.command);
      await actAs(f.lower);
      // THE EXACT ORIGINAL PAYLOAD does not resurrect it.
      await rejected(() => rt.disclose(ids, f.world, 'FULL_NAME', { text: 'Sara Kamel' }), DURABLE,
        /INTRODUCTION_DISCLOSURE_ERASED_BY_OWNER/u);
      // NOR DOES A DIFFERENT ONE, and neither answer says which it was.
      await rejected(() => rt.disclose(ids, f.world, 'FULL_NAME', { text: 'Somebody Else' }), DURABLE,
        /INTRODUCTION_DISCLOSURE_ERASED_BY_OWNER/u);
      await asRole('postgres');
      assert.deepEqual(await commandRow(ids.command), before, 'D08 and the refused retry wrote nothing at all');
      assert.equal(await rt.textPayload(ids.version), null, 'D08 no payload was recreated');
      const after = await commandRow(ids.command);
      assert.equal(after.payload_digest, null, 'D08 and no verifier was recreated');

      // A STRANGER, AND A GUESSED COMMAND ID, STILL GET THE FROZEN CONFLICT, so
      // the new class is not an oracle for whether a disclosure was deleted.
      await actAs(f.higher);
      await rejected(() => rt.disclose(ids, f.world, 'FULL_NAME', { text: 'Sara Kamel' }), CONFLICT,
        /INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT/u);
    });

    await report.isolated('D09 the owner-deletion command retry is unaffected', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'CONTACT_METHOD', { text: 'sara at example' });
      const command = randomUUID();
      const event = randomUUID();
      await actAs(f.lower);
      const [deleted] = await rt.deleteMaterial(command, f.world, ids.material, event);
      assert.equal(deleted.outcome, 'MATERIAL_DELETED');
      const [again] = await rt.deleteMaterial(command, f.world, ids.material, event);
      assert.equal(again.outcome, 'MATERIAL_DELETED', 'D09 the historical delete still answers');
      assert.equal(again.deleted_at.getTime(), deleted.deleted_at.getTime());
      await asRole('postgres');
      assert.equal((await commandRow(ids.command)).verifier_state, 'ERASED_BY_OWNER',
        'D09 and the retry restored no verifier');
    });

    await report.isolated('D10 a pre-0122 already-deleted row is erasable through the guard', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'a legacy name' });
      const before = await commandRow(ids.command);
      // EXACTLY THE STATE A DISCLOSURE DELETED BEFORE THIS MIGRATION IS IN: the
      // payload physically gone, the history terminal, the verifier retained.
      await asRole('postgres');
      await q(`DELETE FROM ${D.TEXT} WHERE resource_version_id = $1`, [ids.version]);
      await q(`UPDATE public.shared_world_history_items
                  SET availability_state = 'DELETED_BY_OWNER', availability_revision = availability_revision + 1
                WHERE id = $1`, [ids.item]);
      assert.equal((await commandRow(ids.command)).payload_digest, before.payload_digest,
        'D10 the legacy row still carries the verifier of content that no longer exists');
      // The reconciliation the migration performs, through the same guard.
      await q(`UPDATE ${D.COMMANDS}
                  SET verifier_state = 'ERASED_BY_OWNER', payload_digest = NULL, request_ref = NULL,
                      verifier_erased_at = clock_timestamp()
                WHERE id = $1 AND verifier_state = 'PRESENT'`, [ids.command]);
      await assertErased(before, ids, 'D10');
    });

    await report.isolated('D11 payload absent while the history is AVAILABLE is refused', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'a contradictory name' });
      await asRole('postgres');
      await q(`DELETE FROM ${D.TEXT} WHERE resource_version_id = $1`, [ids.version]);
      assert.equal((await historyItem(ids.item)).availability_state, 'AVAILABLE',
        'D11 the history says nobody deleted this');
      await rejected(() => q(`UPDATE ${D.COMMANDS}
                                 SET verifier_state = 'ERASED_BY_OWNER', payload_digest = NULL, request_ref = NULL,
                                     verifier_erased_at = clock_timestamp()
                               WHERE id = $1`, [ids.command]),
      CONTRADICTORY, /INTRODUCTION_DISCLOSURE_CONTRADICTORY_STATE/u);
      assert.equal((await commandRow(ids.command)).verifier_state, 'PRESENT',
        'D11 and a contradictory row is NOT auto-redacted as though an owner deletion had happened');
    });

    await report.isolated('D12 the counterpart view of a deleted disclosure is unchanged', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      assert.equal((await rt.resolveDisclosure(f.world, f.higher)).length, 1,
        'D12 the counterpart could see it while it existed');
      await deleteDisclosure(f.lower, f.world, ids.material);
      assert.deepEqual(await rt.resolveDisclosure(f.world, f.higher), [],
        'D12 and sees nothing at all afterwards - no tombstone, no placeholder');
      assert.deepEqual(await rt.resolveDisclosure(f.world, f.lower), [],
        'D12 and neither does the owner');
      assert.equal((await rt.visibility(f.world, f.higher)).filter((r) => r.history_item_id === ids.item).length, 0,
        'D12 the canonical historical visibility is dark for it too');
    });

    await report.isolated('D13 the erasure is one-way and structurally guarded', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      const before = await commandRow(ids.command);
      await asRole('postgres');
      // WHILE THE PAYLOAD LIVES, the erasure is refused outright.
      await rejected(() => q(`UPDATE ${D.COMMANDS}
                                 SET verifier_state = 'ERASED_BY_OWNER', payload_digest = NULL, request_ref = NULL,
                                     verifier_erased_at = clock_timestamp() WHERE id = $1`, [ids.command]),
      CONTRADICTORY, /INTRODUCTION_DISCLOSURE_CONTRADICTORY_STATE/u);
      // EVERY OTHER UPDATE IS STILL REFUSED.
      await rejected(() => q(`UPDATE ${D.COMMANDS} SET resource_type = 'CONTACT_METHOD' WHERE id = $1`, [ids.command]),
        DURABLE, /INTRODUCTION_DISCLOSURE_IS_DURABLE/u);
      await rejected(() => q(`UPDATE ${D.COMMANDS} SET payload_digest = $2 WHERE id = $1`,
        [ids.command, textDigest(null, 'something else')]), DURABLE, /INTRODUCTION_DISCLOSURE_IS_DURABLE/u);
      await rejected(() => q(`DELETE FROM ${D.COMMANDS} WHERE id = $1`, [ids.command]),
        DURABLE, /INTRODUCTION_DISCLOSURE_IS_DURABLE/u);

      await deleteDisclosure(f.lower, f.world, ids.material);
      await assertErased(before, ids, 'D13');
      // NO RETURN TO PRESENT, NO REPLACEMENT DIGEST, NO IDENTITY CHANGE.
      await rejected(() => q(`UPDATE ${D.COMMANDS}
                                 SET verifier_state = 'PRESENT', payload_digest = $2, request_ref = $2,
                                     verifier_erased_at = NULL WHERE id = $1`,
      [ids.command, textDigest(null, 'Sara Kamel')]), DURABLE, /INTRODUCTION_DISCLOSURE_IS_DURABLE/u);
      await rejected(() => q(`UPDATE ${D.COMMANDS} SET payload_digest = $2 WHERE id = $1`,
        [ids.command, textDigest(null, 'Sara Kamel')]), DURABLE, /INTRODUCTION_DISCLOSURE_IS_DURABLE/u);
      await rejected(() => q(`UPDATE ${D.COMMANDS} SET owner_user_id = $2 WHERE id = $1`,
        [ids.command, f.higher]), DURABLE, /INTRODUCTION_DISCLOSURE_IS_DURABLE/u);
      await rejected(() => q(`DELETE FROM ${D.COMMANDS} WHERE id = $1`, [ids.command]),
        DURABLE, /INTRODUCTION_DISCLOSURE_IS_DURABLE/u);
    });

    // -------------------------------------------------------- REM03-ERASE-ID-01
    //
    // Erasure destroys CONTENT equivalence. It does not destroy request
    // identity that survives, and the erased branch may not discard it: every
    // surviving immutable field is still compared before the deleted class is
    // reached, so a genuinely different request is still a conflict.
    await report.isolated('E01 same surviving identity and the original payload is ERASED_BY_OWNER', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      await deleteDisclosure(f.lower, f.world, ids.material);
      await actAs(f.lower);
      await rejected(() => rt.disclose(ids, f.world, 'FULL_NAME', { text: 'Sara Kamel' }), DURABLE,
        /INTRODUCTION_DISCLOSURE_ERASED_BY_OWNER/u);
    });

    await report.isolated('E02 same surviving identity and a different payload is still ERASED_BY_OWNER', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      await deleteDisclosure(f.lower, f.world, ids.material);
      await actAs(f.lower);
      // Content equivalence is intentionally unknowable, so the answer may not
      // pretend to know it in either direction.
      await rejected(() => rt.disclose(ids, f.world, 'FULL_NAME', { text: 'Someone Entirely Different' }),
        DURABLE, /INTRODUCTION_DISCLOSURE_ERASED_BY_OWNER/u);
    });

    await report.isolated('E03 a changed text resource type is a COMMAND CONFLICT, not a deleted answer', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      await deleteDisclosure(f.lower, f.world, ids.material);
      await actAs(f.lower);
      // `resource_type` is an immutable request input, it is NOT content-derived,
      // and it survives deletion as audit identity - so the database still has
      // the evidence to prove this is a different request, and must use it.
      await rejected(() => rt.disclose(ids, f.world, 'CONTACT_METHOD', { text: 'Sara Kamel' }), CONFLICT,
        /INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT/u);
    });

    await report.isolated('E04 a changed image resource type is a COMMAND CONFLICT too', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const reference = mediaRef('rem03-erase-identity');
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_IMAGE', { media: reference });
      await deleteDisclosure(f.lower, f.world, ids.material);
      await actAs(f.lower);
      await rejected(() => rt.disclose(ids, f.world, 'PARTIAL_IMAGE', { media: reference }), CONFLICT,
        /INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT/u);
      await rejected(() => rt.disclose(ids, f.world, 'FULL_IMAGE', { media: reference }), DURABLE,
        /INTRODUCTION_DISCLOSURE_ERASED_BY_OWNER/u);
    });

    await report.isolated('E05 a stranger reaches the frozen conflict, never the deleted class', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      await deleteDisclosure(f.lower, f.world, ids.material);
      await actAs(f.higher);
      await rejected(() => rt.disclose(ids, f.world, 'FULL_NAME', { text: 'Sara Kamel' }), CONFLICT,
        /INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT/u);
    });

    await report.isolated('E06 a changed bound identity is a COMMAND CONFLICT', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      await deleteDisclosure(f.lower, f.world, ids.material);
      await actAs(f.lower);
      // Each of the four remaining bound identities, one at a time.
      for (const field of ['version', 'material', 'item', 'event']) {
        await rejected(() => rt.disclose({ ...ids, [field]: randomUUID() }, f.world, 'FULL_NAME',
          { text: 'Sara Kamel' }), CONFLICT, /INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT/u);
      }
      // And a different World, through a second real Introduction.
      const other = await rt.bringToIntroduction(humans[2], humans[3]);
      await actAs(f.lower);
      await rejected(() => rt.disclose(ids, other.world, 'FULL_NAME', { text: 'Sara Kamel' }), CONFLICT,
        /INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT/u);
    });

    await report.isolated('E07 none of those recreate a payload or a verifier', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'FULL_NAME', { text: 'Sara Kamel' });
      await deleteDisclosure(f.lower, f.world, ids.material);
      const before = await commandRow(ids.command);
      await actAs(f.lower);
      for (const [type, payload] of [
        ['FULL_NAME', { text: 'Sara Kamel' }], ['FULL_NAME', { text: 'a different name' }],
        ['CONTACT_METHOD', { text: 'Sara Kamel' }], ['DEEPER_PERSONAL_FIELD', { text: 'x', fieldKey: 'a_note' }],
      ]) {
        await rejected(() => rt.disclose(ids, f.world, type, payload), [...DURABLE, ...CONFLICT],
          /INTRODUCTION_DISCLOSURE_(ERASED_BY_OWNER|COMMAND_ID_CONFLICT)/u);
      }
      await asRole('postgres');
      assert.deepEqual(await commandRow(ids.command), before, 'E07 the command row is untouched throughout');
      assert.equal(await rt.textPayload(ids.version), null, 'E07 no payload was recreated');
      assert.equal(await rt.mediaPayload(ids.version), null, 'E07 by any of them');
      assert.equal((await commandRow(ids.command)).payload_digest, null, 'E07 and no verifier either');
      assert.equal((await commandRow(ids.command)).request_ref, null);
    });

    await report.isolated('D14 no other relation retains a payload-derived verifier', async () => {
      const f = await rt.bringToIntroduction(humans[0], humans[1]);
      const { ids } = await rt.discloseAs(f.lower, f.world, 'DEEPER_PERSONAL_FIELD',
        { text: 'a sentence nobody else should be able to confirm', fieldKey: 'private_note' });
      const digest = textDigest('private_note', 'a sentence nobody else should be able to confirm');
      await deleteDisclosure(f.lower, f.world, ids.material);
      await asRole('postgres');
      // THE WHOLE DURABLE SURFACE, asked for the digest by value.
      for (const [relation, column] of [
        [D.COMMANDS, 'payload_digest'], [D.COMMANDS, 'request_ref'],
        ['public.publication_package_item_provenance', 'captured_source_digest'],
        ['public.publication_package_manifest_items', 'public_body_digest'],
        ['public.replay_source_manifest_items', 'captured_source_digest'],
        ['public.shared_world_material_commit_commands', 'body_digest'],
        ['public.shared_world_material_commit_commands', 'request_ref'],
      ]) {
        assert.equal(await count(relation, `${column} = $1`, [digest]), 0,
          `D14 ${relation}.${column} retains no digest of the deleted payload`);
      }
      // AND THE DISCLOSURE MATERIAL COULD NEVER HAVE REACHED THE TWO PACKAGING
      // SURFACES IN THE FIRST PLACE, which is why no digest of one exists there.
      assert.equal(await count('public.publication_package_item_provenance', 'shared_material_id = $1',
        [ids.material]), 0, 'D14 no Public package ever carried this disclosure');
      assert.equal(await count('public.replay_source_manifest_items', 'shared_material_id = $1',
        [ids.material]), 0, 'D14 and no Replay source manifest did either');
      // The envelope that survives carries identity only: no digest column exists on it at all.
      const [{ n: envelopeDigests }] = await rows(
        `SELECT count(*) n FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'shared_world_materials'
            AND (column_name LIKE '%digest%' OR column_name LIKE '%fingerprint%' OR column_name LIKE '%ref%')`);
      assert.equal(Number(envelopeDigests), 0, 'D14 the surviving material envelope carries no content-derived value');
    });
  } finally {
    await q('ROLLBACK');
    await asRole('postgres');
  }
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
await runVerifier('0122', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '60s'");

  setStage('fixtures');
  await rt.provisionHumans(humans);

  const report = createScenarioReport('0122', { query: q, restore: () => asRole('postgres') });
  setStage('posture');
  await report.section('P01 posture: signatures, ACLs, the guard and the absent erasure RPC', verifyPosture);
  await report.section('P02 the verifier state and the verifier columns are one structural fact',
    verifyStructuralState);

  const seams = [];
  for (const fn of [PFN.FIRST_NAME, PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE]) {
    seams.push(await rt.captureMatchingSeam(fn));
  }
  try {
    await rt.resolveFirstName({ [humans[0]]: 'Sara', [humans[1]]: 'Omar', [humans[2]]: 'Layla', [humans[3]]: 'Karim' });
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();
    setStage('privacy erasure');
    await verifyPrivacyErasure(report, humans);
  } finally {
    await asRole('postgres');
    for (const seam of seams) await rt.restoreMatchingSeam(seam);
  }

  setStage('report');
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  await asRole('postgres');
  for (const seam of ['public.resolve_introduction_disclosure_prerequisites_v1',
    'public.resolve_introduction_success_prerequisites_v1',
    'public.resolve_matching_reactivation_prerequisites_v1']) {
    assert.equal(await rt.seamClearance(seam), 'NOT_EVALUATED', `${seam} is fail-closed again after the run`);
  }
  for (const [table, trigger] of I07D_GUARDS) {
    assert.equal(await rt.triggerEnabled(table, trigger), true, `${trigger} is enabled at the end of the run`);
  }
  await rt.removeFixtureHumans(humans);
  const [{ residue }] = await rows(
    `SELECT (SELECT count(*) FROM ${D.COMMANDS}) + (SELECT count(*) FROM ${D.VERSIONS})
          + (SELECT count(*) FROM ${D.GRANTS}) + (SELECT count(*) FROM ${D.TEXT})
          + (SELECT count(*) FROM ${D.MEDIA})
          + (SELECT count(*) FROM ${D.MATERIALS} WHERE material_kind = 'EXPLICIT_DISCLOSURE')
          + (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[])) AS residue`, [humans]);
  assert.equal(Number(residue), 0,
    'every fixture this verifier created was rolled back: it commits nothing outside public.users');
}, () => rt.client.end().catch(() => undefined));
