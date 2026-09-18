// QAN-CW-REM-03 - Introduction disclosure deletion-time privacy erasure v1:
// secret-free structural contract over migration 0122.
//
// ASSURE-F06. Migration 0115 destroys the payload of an owner-deleted
// EXPLICIT_DISCLOSURE and keeps its audit identity, which is the right shape.
// What it also kept was `introduction_disclosure_commands.payload_digest`, an
// UNSALTED SHA-256 of the exact disclosed bytes, and `request_ref`, a digest
// over the whole request with that digest inside it. Every other input of the
// request survives deletion in plain form on the same row, so both are
// practical offline verifiers of a payload drawn from a deliberately
// low-entropy vocabulary - a name, a contact route, one bounded field.
//
// This contract proves the SHAPE before deploy: the explicit verifier state,
// the structural biconditional, the one-way guard and its canonical
// precondition, the atomic erasure inside owner deletion, the fail-closed
// retry, and the absence of any erasure command of its own. Live semantics -
// the real deletion, the real retry, the legacy reconciliation, the
// contradictory refusal and the counterpart's view - are proven by
// database/verify-migration-0122.mjs against real PostgreSQL, which this file
// also pins into CI, the package manifest and the database README.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const NAME = '0122_introduction_disclosure_privacy_erasure_v1.sql';
const SOURCE = read(`../migrations/${NAME}`);
const SOURCE_0115 = read('../migrations/0115_introduction_progressive_disclosure_history_visibility_v1.sql');
const VERIFIER = read('../verify-migration-0122.mjs');
const SUPPORT = read('../introduction-lifecycle-verifier-support.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');

const stripComments = (sql) => sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const sliceOf = (source, from, to) => {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `the source contains "${from}"`);
  const end = source.indexOf(to, start);
  assert.ok(end > start, `the source contains "${to}" after "${from}"`);
  return stripComments(source.slice(start, end)).replace(/COMMENT ON [\s\S]*?';\n/gu, '');
};
const body = () => sliceOf(SOURCE, 'BEGIN;', 'TERMINAL SELF-ASSERTIONS');
const prosrcOf = (name, source = SOURCE) => {
  const start = source.indexOf(`FUNCTION public.${name}(`);
  assert.ok(start >= 0, `${name} is declared`);
  const open = source.indexOf('AS $$', start);
  assert.ok(open > start, `${name} has a body`);
  const close = source.indexOf('END$$;', open);
  assert.ok(close > open, `${name} has a body terminator`);
  return source.slice(open + 'AS $$'.length, close + 'END'.length);
};
const prologueOf = (source, name) => {
  const start = source.indexOf(`FUNCTION public.${name}(`);
  assert.ok(start >= 0, `${name} is declared`);
  const end = source.indexOf('LANGUAGE plpgsql', start);
  assert.ok(end > start, `${name} has a language clause`);
  return source.slice(start, end).trim();
};

const COMMANDS = 'introduction_disclosure_commands';
const GUARD = 'introduction_disclosure_verifier_erasure_guard_v1';
const DELETE_FN = 'delete_shared_world_owned_material_v1';
const DISCLOSE_FN = 'commit_introduction_progressive_disclosure_v1';
/** The audit identity that must survive an erasure, in full. */
const AUDIT_IDENTITY = ['id', 'world_id', 'introduction_record_id', 'resource_version_id', 'material_id',
  'history_item_id', 'disclosure_granted_event_id', 'owner_user_id', 'counterpart_user_id',
  'resource_type', 'baseline_viewer_count', 'committed_at'];

test('migration 0122 is one forward-only transaction, ordered at the end of the chain', () => {
  const migrations = readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  assert.equal(migrations.filter((name) => name.startsWith('0122_')).length, 1, 'exactly one migration carries 0122');
  assert.equal(migrations.indexOf(NAME),
    migrations.indexOf('0121_public_replay_consistency_historical_retry_remediation_v1.sql') + 1,
    'ordering directly after the Public/Replay half of the same task');
  assert.match(SOURCE, /^-- QAN-CW-REM-03/u, 'the migration declares its task');
  assert.equal((SOURCE.match(/\nBEGIN;\n/gu) ?? []).length, 1, 'it is one transaction');
  assert.match(SOURCE, /COMMIT;\n$/u, 'and it commits');

  const executable = body();
  // PRIVACY ERASURE DESTROYS TWO COLUMNS OF ONE RELATION AND NOTHING ELSE. No
  // row of history is deleted, no relation is dropped, nothing is renamed.
  assert.doesNotMatch(executable, /DROP (?:TABLE|FUNCTION|POLICY|INDEX|COLUMN|CONSTRAINT|SCHEMA|ROLE)/iu,
    'it drops no object');
  assert.doesNotMatch(executable, /TRUNCATE|RENAME/iu, 'it truncates and renames nothing');
  assert.doesNotMatch(executable, /\bGRANT\b/u, 'and it grants nothing to anybody');
  // The ONE dropped object is the blanket trigger it REPLACES, in place, under
  // the same name - which is what keeps every frozen guard census pointed at it.
  const dropped = [...executable.matchAll(/DROP TRIGGER (\w+) ON public\.(\w+)/gu)].map((m) => [m[1], m[2]]);
  assert.deepEqual(dropped, [['introduction_disclosure_commands_immutable', COMMANDS]],
    'exactly one trigger is replaced, on exactly one relation');
  assert.match(executable, /CREATE TRIGGER introduction_disclosure_commands_immutable\s*\n\s*BEFORE UPDATE OR DELETE ON public\.introduction_disclosure_commands/u,
    'and it is recreated at the same position under the same name');
  // The two sibling relations keep the blanket refusal they always had.
  assert.ok(!executable.includes('introduction_disclosure_resource_versions_immutable'),
    'the resource version guard is untouched');
  assert.ok(!executable.includes('introduction_disclosure_granted_events_immutable'),
    'and so is the grant fact guard');
});

test('the verifier state and the verifier columns are ONE structural fact', () => {
  const executable = body();
  assert.match(executable, /ADD COLUMN verifier_state text NOT NULL DEFAULT 'PRESENT'/u,
    'the state is explicit, typed and defaulted for every existing row');
  assert.match(executable, /ADD COLUMN verifier_erased_at timestamptz/u, 'the erasure instant is a time');
  assert.match(executable, /ALTER COLUMN payload_digest DROP NOT NULL/u, 'the digest becomes destroyable');
  assert.match(executable, /ALTER COLUMN request_ref DROP NOT NULL/u, 'and so does the request reference');
  assert.match(executable, /verifier_state IN \('PRESENT', 'ERASED_BY_OWNER'\)/u,
    'the vocabulary is exactly two values');
  // THE BICONDITIONAL, IN BOTH DIRECTIONS. A state that could disagree with the
  // columns would let "erased" be claimed while a verifier survived.
  const shape = executable.slice(executable.indexOf('introduction_disclosure_commands_verifier_shape_check'));
  for (const clause of [
    /verifier_state = 'PRESENT'\s*\n\s*AND payload_digest IS NOT NULL AND request_ref IS NOT NULL\s*\n\s*AND verifier_erased_at IS NULL/u,
    /verifier_state = 'ERASED_BY_OWNER'\s*\n\s*AND payload_digest IS NULL AND request_ref IS NULL\s*\n\s*AND verifier_erased_at IS NOT NULL/u,
  ]) {
    assert.match(shape, clause, 'both directions of the verifier-state biconditional are CHECKed');
  }
  // NO STORED SALT. The rejected solution, named so its absence is checked.
  assert.doesNotMatch(executable, /salt|pepper|hmac|secret_key/iu,
    'no stored salt, no keyed verifier and no secret lifecycle is introduced');
});

test('the guard permits exactly one transition and proves the deletion itself', () => {
  const guard = prosrcOf(GUARD);
  assert.match(guard, /IF TG_OP = 'DELETE' THEN/u, 'DELETE is refused first, for every role');
  assert.match(guard, /OLD\.verifier_state <> 'PRESENT' OR NEW\.verifier_state <> 'ERASED_BY_OWNER'/u,
    'exactly one transition is permitted, in exactly one direction');
  // EVERY AUDIT IDENTITY COLUMN IS PINNED BY NAME. A guard that pinned some of
  // them would let the others move under cover of a privacy erasure.
  for (const column of AUDIT_IDENTITY) {
    assert.match(guard, new RegExp(`NEW\\.${column} IS DISTINCT FROM OLD\\.${column}`, 'u'),
      `the guard pins the audit column ${column}`);
  }
  // NOTHING TAKES THE VERIFIERS' PLACE.
  assert.match(guard, /NEW\.payload_digest IS NOT NULL OR NEW\.request_ref IS NOT NULL\s*\n\s*OR NEW\.verifier_erased_at IS NULL/u,
    'no replacement digest, no payload-derived tombstone, and an erasure instant is required');
  // CANONICAL TRUTH IS READ HERE, not trusted from the caller. This is what
  // makes the erasure unreachable outside a proven owner deletion, and what
  // stops a contradictory row from being auto-redacted.
  assert.match(guard, /m\.material_kind = 'EXPLICIT_DISCLOSURE'/u, 'the material really is a disclosure');
  assert.match(guard, /i\.availability_state = 'DELETED_BY_OWNER'/u, 'its owner really did delete it');
  assert.match(guard, /introduction_disclosure_text_payloads tp/u, 'and no text payload survives');
  assert.match(guard, /introduction_disclosure_media_payloads mp/u, 'and no media payload survives');
  assert.match(guard, /INTRODUCTION_DISCLOSURE_CONTRADICTORY_STATE/u,
    'a row that fails any of those is contradictory state, not an owner deletion');
});

test('owner deletion destroys the payload and the verifiers atomically', () => {
  const deletion = prosrcOf(DELETE_FN);
  // The payload deletion is the frozen 0115 branch, unchanged.
  assert.match(deletion, /IF owned\.material_kind = 'EXPLICIT_DISCLOSURE' THEN\s*\n\s*DELETE FROM public\.introduction_disclosure_text_payloads/u,
    'the frozen payload-destruction branch is preserved exactly');
  // The erasure is the same transaction, the same instant, and AFTER the
  // terminal transition the guard requires as its proof.
  assert.match(deletion, /verifier_erased_at = delete_instant/u,
    'the erasure carries the ONE canonical deletion instant, never a second clock');
  const terminal = deletion.indexOf("SET availability_state = 'DELETED_BY_OWNER'");
  const erasure = deletion.indexOf("SET verifier_state = 'ERASED_BY_OWNER'");
  assert.ok(terminal >= 0 && erasure > terminal,
    'the verifier erasure follows the terminal transition that proves the deletion to the guard');
  const payload = deletion.indexOf('DELETE FROM public.introduction_disclosure_text_payloads');
  assert.ok(payload >= 0 && payload < erasure,
    'and follows the payload destruction: a verifier is never erased while its payload lives');
  // FAIL CLOSED, BOTH WAYS. Exactly one command row, and nothing left carrying
  // a verifier afterwards, or the whole deletion rolls back.
  assert.match(deletion, /GET DIAGNOSTICS affected = ROW_COUNT;\s*\n\s*IF affected <> 1 THEN\s*\n\s*RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE'/u,
    'a deletion that moved no command row, or more than one, fails closed');
  assert.match(deletion, /c\.payload_digest IS NOT NULL OR c\.request_ref IS NOT NULL\)\) THEN\s*\n\s*RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE'/u,
    'and a deletion may not report success while a verifier survives');
  // THE COMMITTED ANSWER RE-PROVES IT, so a retry cannot claim a deletion the
  // database did not perform.
  assert.match(deletion, /NOT EXISTS \(SELECT 1 FROM public\.introduction_disclosure_commands dc\s*\n\s*WHERE dc\.material_id = committed\.material_id\s*\n\s*AND \(dc\.payload_digest IS NOT NULL OR dc\.request_ref IS NOT NULL\)\)/u,
    'the historical answer proves no payload-derived verifier of the deleted material survives');

  // EVERYTHING ELSE 0115 OWNED IS PRESERVED.
  assert.equal(prologueOf(SOURCE, DELETE_FN).replace(/^CREATE OR REPLACE /u, 'CREATE '),
    prologueOf(SOURCE_0115, DELETE_FN).replace(/^CREATE OR REPLACE /u, 'CREATE '),
    'the owner-deletion signature is byte-identical to its frozen declaration');
  for (const frozen of ['auth.uid()', "world.lifecycle NOT IN ('ACTIVE', 'READ_ONLY_CLOSED')",
    'WITH RECURSIVE reachable', "SET availability_state = 'UNAVAILABLE'",
    'shared_world_material_deleted_events']) {
    assert.ok(deletion.includes(frozen), `owner deletion still carries its frozen behaviour: ${frozen}`);
  }
  assert.doesNotMatch(deletion, /p_owner|p_actor|p_force/u, 'and it still takes no owner, actor or force parameter');
});

test('a retry after erasure fails closed in every idempotency pass', () => {
  const disclose = prosrcOf(DISCLOSE_FN);
  const erased = [...disclose.matchAll(/INTRODUCTION_DISCLOSURE_ERASED_BY_OWNER/gu)];
  assert.equal(erased.length, 3,
    'all three durable-idempotency passes answer an erased command with the bounded class');
  // THE ERASED BRANCH IS GATED ON THE SAME IDENTITY EQUALITY AS THE SUCCESS
  // BRANCH, so a stranger and a guessed command id still meet the frozen
  // conflict and learn nothing about whether a disclosure was deleted.
  const guarded = [...disclose.matchAll(/committed\.verifier_state = 'ERASED_BY_OWNER'/gu)];
  assert.equal(guarded.length, 3, 'each erased branch tests the verifier state');
  for (const field of ['owner_user_id = u', 'world_id = p_world_id', 'resource_version_id = p_resource_version_id',
    'material_id = p_material_id', 'history_item_id = p_history_item_id',
    'disclosure_granted_event_id = p_disclosure_granted_event_id']) {
    assert.ok((disclose.match(new RegExp(field.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'gu')) ?? []).length >= 6,
      `both the erased branch and the success branch bind ${field}, in all three passes`);
  }
  // IT RECONSTRUCTS NOTHING.
  assert.ok(!disclose.includes('UPDATE public.introduction_disclosure_commands'),
    'the disclosure command neither erases nor restores a verifier');
  assert.ok(!disclose.includes('verifier_erased_at'), 'and never writes the erasure instant');
  assert.match(disclose, /INSERT INTO public\.introduction_disclosure_commands/u,
    'a fresh disclosure still records its own verifiers');
  // EVERYTHING ELSE 0115 OWNED IS PRESERVED.
  assert.equal(prologueOf(SOURCE, DISCLOSE_FN).replace(/^CREATE OR REPLACE /u, 'CREATE '),
    prologueOf(SOURCE_0115, DISCLOSE_FN).replace(/^CREATE OR REPLACE /u, 'CREATE '),
    'the disclosure signature is byte-identical to its frozen declaration');
  for (const frozen of ['QANDEEL_CWV2_INTRODUCTION_DISCLOSURE_REQUEST_V1', 'shared_worlds w WHERE w.id = p_world_id FOR UPDATE',
    'introduction_records r', 'resolve_introduction_disclosure_prerequisites_v1',
    'disclose_at := clock_timestamp();', "'EXACT_HUMAN_APPROVER_SET'"]) {
    assert.ok(disclose.includes(frozen), `the disclosure boundary still carries: ${frozen}`);
  }
});

test('already-deleted rows are reconciled, and contradictory ones are not', () => {
  const executable = body();
  const reconciliation = executable.slice(executable.indexOf('contradictory integer'));
  // THE CONTRADICTORY CASE IS CHECKED FIRST AND FAILS DEPLOYMENT.
  const contradictory = reconciliation.indexOf("i.availability_state <> 'DELETED_BY_OWNER'");
  const update = reconciliation.indexOf('UPDATE public.introduction_disclosure_commands');
  assert.ok(contradictory >= 0 && contradictory < update,
    'a payload-absent row whose history is not DELETED_BY_OWNER is refused BEFORE anything is erased');
  assert.match(reconciliation, /IF contradictory <> 0 THEN\s*\n\s*RAISE EXCEPTION/u,
    'and deployment fails rather than silently normalising it');
  // EVERY CLAUSE OF THE QUALIFYING PREDICATE.
  for (const clause of [
    /m\.material_kind = 'EXPLICIT_DISCLOSURE'/u,
    /i\.availability_state = 'DELETED_BY_OWNER'/u,
    /rv\.id = c\.resource_version_id AND rv\.material_id = c\.material_id/u,
    /NOT EXISTS \(SELECT 1 FROM public\.introduction_disclosure_text_payloads/u,
    /NOT EXISTS \(SELECT 1 FROM public\.introduction_disclosure_media_payloads/u,
    /c\.verifier_state = 'PRESENT'/u,
  ]) {
    assert.match(reconciliation, clause, 'the reconciliation qualifies a row on canonical truth alone');
  }
  // AND IT PROVES ITS OWN RESULT.
  assert.match(reconciliation, /a disclosure whose payload no longer exists still carries a payload-derived verifier/u,
    'the migration refuses to finish while any payload-less row still carries a verifier');
});

test('privacy erasure is reachable through owner deletion and nothing else', () => {
  const executable = body();
  // NO RPC. The erasure is a consequence of a deletion, never a command.
  assert.doesNotMatch(executable, /CREATE (?:OR REPLACE )?FUNCTION public\.\w*eras\w*\(uuid/u,
    'there is no privacy-erasure command');
  const creates = [...executable.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/gu)].map((m) => m[1]);
  assert.deepEqual(creates.sort(), [DELETE_FN, DISCLOSE_FN, GUARD].sort(),
    '0122 creates or replaces exactly the guard and the two canonical boundaries');
  // AND NO APPLICATION ROLE GAINS ANYTHING.
  assert.match(executable, /REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated/u,
    'both replaced boundaries are re-revoked');
  assert.match(executable, /REVOKE ALL ON FUNCTION %s FROM service_role/u, 'service_role included');
  assert.match(executable, /REVOKE ALL ON FUNCTION public\.introduction_disclosure_verifier_erasure_guard_v1\(\) FROM PUBLIC, anon, authenticated/u,
    'and the guard is callable by nobody');
});

test('0122 implements no part of ASSURE-F05', () => {
  // ASSURE-F05 is Public DRAFT recall when a source becomes unavailable, and it
  // was explicitly rejected as a current frozen-contract defect. Owner deletion
  // must not have grown a reach into Public derivative state here.
  const deletion = prosrcOf(DELETE_FN);
  for (const forbidden of ['public_experience', 'publication_package', 'publication_manifest',
    'replay_', 'recall', 'RECALL']) {
    assert.ok(!deletion.includes(forbidden),
      `owner deletion reaches no Public or Replay derivative state: ${forbidden} does not appear`);
  }
  assert.ok(!body().includes('publication_package_manifest_items'),
    'and the migration touches no Public package relation at all');
});

// ------------------------------------------------------- registration + pins
test('the 0122 verifier is registered everywhere it has to run', () => {
  assert.match(packageJson,
    /"verify:introduction-disclosure-privacy-erasure:integration": "node --env-file-if-exists=\.env database\/verify-migration-0122\.mjs"/u,
    'the verifier has an npm script');
  assert.match(workflow, /run: npm run verify:introduction-disclosure-privacy-erasure:integration/u,
    'and API CI runs it: an unregistered verifier is a file nobody executes');
  assert.match(readme, /QAN-CW-REM-03[\s\S]{0,6000}migration 0122/u, 'and the database README documents it');
});

test('the verifier proves the privacy semantics this contract only shapes', () => {
  for (const scenario of ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08',
    'D09', 'D10', 'D11', 'D12', 'D13', 'D14']) {
    assert.ok(VERIFIER.includes(`${scenario} `), `the verifier carries scenario ${scenario}`);
  }
  // THE OFFLINE-GUESS PROOF is the one that actually names the defect: a
  // correct guess of the deleted payload must match nothing that survived.
  assert.match(VERIFIER, /a correct guess of the deleted payload matches nothing that survived/u,
    'the verifier tests the exact attack the retained digest enabled');
  assert.match(VERIFIER, /const textDigest = /u,
    'and reproduces the frozen two-part digest from its own definition rather than reading it back');
  assert.match(VERIFIER, /assertAllPassed/u, 'and reports every independent scenario in one round');
  // The frozen guard census still names the trigger by the name 0122 kept.
  assert.match(SUPPORT, /\['public\.introduction_disclosure_commands', 'introduction_disclosure_commands_immutable'\]/u,
    'the frozen I-07D guard census still points at the trigger, which is why its name did not change');
});
