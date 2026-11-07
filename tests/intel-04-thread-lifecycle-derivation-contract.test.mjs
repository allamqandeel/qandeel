// INTEL-04 — Thread Lifecycle Derivation Correction (QAN-BL-INTEL-04): the static half of the correction.
//
// The behaviour is proven against real PostgreSQL by database/verify-migration-0194.mjs (T1 - T4 and the T6 counter-test)
// and by apps/api/scripts/intel-04-thread-lifecycle-proof.ts (the integrated written and call path). This pins what those
// proofs rely on and what the Product Owner's order forbids changing: 0070 stays byte-identical, 0194 replaces exactly one
// predicate of exactly one function and nothing else, both proofs run in API CI after the migrations, the reducer keeps
// the reading the database now agrees with, and the task's record and backlog entry say what was decided.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const codeOnly = (sql) => sql.replace(/--[^\n]*/gu, '');

const M0070 = '0070_thread_lifecycle_cross_session_continuity_v1.sql';
const M0194 = '0194_intel_04_lifecycle_relation_at_binding_sp_v1.sql';
const RECORD = 'docs/e2e/QANDEEL_INTEL_04_THREAD_LIFECYCLE_DERIVATION_CORRECTION_RECORD_v1.md';
const STRICT = 'b.bound_sp < cu.session_position';
const AT_OR_BEFORE = 'b.bound_sp <= cu.session_position';

/** The relation function's own text in a migration, from its CREATE to its closing dollar quote. */
function relationOf(sql) {
  const match = /CREATE (?:OR REPLACE )?FUNCTION public\.conversation_thread_cu_relation_v1\([\s\S]*?\nEND;\$\$;/u.exec(sql);
  assert.ok(match, 'the relation function is present');
  return match[0].replace(/^CREATE (?:OR REPLACE )?/u, '');
}

test('0070 is the historical migration and stays byte-identical (the Product Owner: do not edit 0070)', () => {
  const digest = createHash('sha256').update(readFileSync(join(root, 'database/migrations', M0070))).digest('hex');
  assert.equal(digest, 'da16b228251cb3948d5d185c7cf51ea6bee09eae547c75284cc994edabc25e13', '0070 is unchanged');
  assert.equal(relationOf(read(`database/migrations/${M0070}`)).split(STRICT).length - 1, 2,
    '0070 itself still reads both of its relation predicates strictly');
});

test('0194 is forward-only, followed only by 0195, and replaces exactly one predicate of exactly one function', () => {
  const migrations = readdirSync(join(root, 'database/migrations')).filter((file) => file.endsWith('.sql')).sort();
  // RE-ANCHORED by S8B-07 CP1-A (was: 0194 is the last migration; the Product Owner's CP1-A authorization, a declared
  // re-anchor): exactly 0195, the original-audio source truth, follows 0194 and nothing else does.
  // RE-ANCHORED by S8B-07 CP1-B (was: 0195 is the last migration; the Product Owner's CP1-B execution authorization, a
  // declared re-anchor): exactly 0196, the transient media authority, follows 0195 and nothing else does (verify-migration-0196).
  assert.equal(migrations.at(-1), '0196_s8b_07_transient_media_v1.sql', 'exactly 0196 follows 0195');
  assert.equal(migrations.at(-2), '0195_s8b_07_replay_original_audio_source_truth_v1.sql', 'exactly 0195 follows 0194');
  assert.equal(migrations.at(-3), M0194, '0194 is followed only by 0195');
  assert.equal(migrations.at(-4), '0193_s8b_06_session_finished_calls_read_v1.sql', '0194 directly follows 0193');
  const sql = read(`database/migrations/${M0194}`);
  const code = codeOnly(sql);
  assert.equal((code.match(/^BEGIN;$/gmu) ?? []).length, 1);
  assert.equal((code.match(/^COMMIT;$/gmu) ?? []).length, 1);
  assert.equal((code.match(/CREATE (?:OR REPLACE )?FUNCTION/gu) ?? []).length, 1, 'exactly one function');
  assert.match(code, /CREATE OR REPLACE FUNCTION public\.conversation_thread_cu_relation_v1\(/u);
  assert.doesNotMatch(code, /CREATE (?:TABLE|INDEX|VIEW|TRIGGER|POLICY|ROLE|SCHEMA|TYPE)\b/u, 'no new object but the function');
  assert.doesNotMatch(code, /ALTER TABLE|DROP (?:TABLE|FUNCTION|INDEX|POLICY)\b/u, 'no structural change');
  assert.doesNotMatch(code, /^\s*(?:INSERT INTO|UPDATE\s+\S+\s+SET|DELETE FROM|TRUNCATE)\b/gmu, 'no write: no backfill, no rewrite');
  assert.doesNotMatch(code, /call_analysis_queue|PARKED/u, 'no queue item is reset, re-queued or reprocessed');
  assert.doesNotMatch(code, /\bGRANT\b/u, 'no privilege is granted');
  assert.match(code, /REVOKE ALL ON FUNCTION public\.conversation_thread_cu_relation_v1\([^)]*\) FROM PUBLIC, anon, authenticated;/u);
  const relation = relationOf(sql);
  assert.match(relation, /\) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS \$\$/u, 'the security posture is kept');
  assert.equal(codeOnly(relation).split(AT_OR_BEFORE).length - 1, 1, 'attention_on reads a binding made at or before the CU');
  assert.equal(codeOnly(relation).split(STRICT).length - 1, 1, 'targets_thread keeps the strict reading');
  // The whole body is 0070's, with that one predicate replaced: nothing else of the relation changes.
  const historical = relationOf(read(`database/migrations/${M0070}`));
  const firstStrict = historical.indexOf(STRICT);
  const expected = historical.slice(0, firstStrict) + AT_OR_BEFORE + historical.slice(firstStrict + STRICT.length);
  assert.equal(codeOnly(relation).replace(/\s+/gu, ' '), codeOnly(expected).replace(/\s+/gu, ' '),
    "0194's relation is 0070's with exactly the attention_on predicate replaced");
  assert.ok(historical.indexOf(STRICT) < historical.indexOf('targets_thread :='), 'the replaced predicate is attention_on');
});

test('every other strict reading of 0070 is deliberately unchanged: 0194 touches no other function', () => {
  const code = codeOnly(read(`database/migrations/${M0194}`));
  for (const name of ['derive_conversation_thread_lifecycle_transitions_v1', 'conversation_thread_lifecycle_state_v1',
    'validate_conversation_thread_lifecycle_decision_v1', 'commit_finalized_exchange_with_focus_thread_lifecycle_v1']) {
    assert.doesNotMatch(code, new RegExp(`FUNCTION public\\.${name}\\(`, 'u'), `${name} is not replaced`);
  }
});

test('the reducer keeps the reading the database now agrees with, and its spec carries the INTEL-04 cases', () => {
  const spec = read('apps/api/src/thread-lifecycle/thread-lifecycle-reducer.spec.ts');
  assert.match(spec, /describe\('INTEL-04: the establishing CU is on its own Thread/u);
  assert.doesNotMatch(read('apps/api/src/thread-lifecycle/thread-lifecycle-reducer.ts'), /INTEL-04/u,
    'the reducer itself is not changed: it was already canonical');
});

test('the verifier and the integrated proof are package scripts and run in API CI after the migrations and 0070', () => {
  const scripts = JSON.parse(read('package.json')).scripts;
  assert.equal(scripts['verify:intel-04-lifecycle-relation:integration'],
    'node --env-file-if-exists=.env database/verify-migration-0194.mjs');
  assert.equal(scripts['prove:intel-04-lifecycle-synthetic:integration'],
    'node --env-file-if-exists=.env node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/intel-04-thread-lifecycle-proof.ts');
  assert.equal(scripts['test:intel-04-thread-lifecycle-derivation-contract'],
    'node --test tests/intel-04-thread-lifecycle-derivation-contract.test.mjs');
  const ci = read('.github/workflows/api-ci.yml');
  const at = (needle) => { const index = ci.indexOf(needle); assert.notEqual(index, -1, `${needle} is in API CI`); return index; };
  const migrations = at('for migration in database/migrations/*.sql');
  const verify0070 = at('npm run verify:thread-lifecycle-cross-session-continuity:integration');
  const verify0193 = at('npm run verify:session-finished-calls:integration');
  const verify0194 = at('npm run verify:intel-04-lifecycle-relation:integration');
  const proof = at('npm run prove:intel-04-lifecycle-synthetic:integration');
  assert.ok(migrations < verify0070 && verify0070 < verify0194, '0070 is verified unchanged on top of 0194');
  assert.ok(verify0193 < verify0194 && verify0194 < proof, 'the 0194 steps follow 0193');
  assert.equal(ci.split('npm run verify:intel-04-lifecycle-relation:integration').length - 1, 1);
  assert.equal(ci.split('npm run prove:intel-04-lifecycle-synthetic:integration').length - 1, 1);
  assert.match(ci.slice(proof - 600, proof + 300), /TEMPLATE[\s\S]*DROP DATABASE[^\n]*WITH \(FORCE\)/u,
    'the integrated proof runs on a throwaway clone that is dropped afterwards');
});

test('the proofs are free and touch no graphics: no paid provider, no map module, no Golden Image', () => {
  const proof = read('apps/api/scripts/intel-04-thread-lifecycle-proof.ts');
  const verifier = read('database/verify-migration-0194.mjs');
  for (const text of [proof, verifier, read(`database/migrations/${M0194}`)]) {
    assert.doesNotMatch(text, /apps\/mobile|WorldCanvas|MapCanvas|MapSurface|WorldViewSurface|map\/visual|golden/iu);
    assert.doesNotMatch(text, /DEEPSEEK_API_KEY|OPENAI_API_KEY|SPEECHMATICS_API_KEY|GEMINI_API_KEY|api\.deepseek\.com/u);
  }
  assert.match(proof, /INTEL04_EXPECT/u, 'the proof states which database it expects to run on');
});

test('the record and the backlog say what was decided (BG-08 / BG-09)', () => {
  const record = read(RECORD);
  assert.match(record, /^\*\*Status:\*\* `INTEL-04 — CLOSED \/ READY FOR PO MERGE DECISION`/mu, 'the record carries its final state');
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  assert.match(backlog, /^\| `QAN-BL-INTEL-04` \|[^\n]*\| `INTEL-04 — Thread Lifecycle Derivation Correction` \| `HIGH` \| `CLOSED — TOMBSTONE` \|$/mu,
    'QAN-BL-INTEL-04 is tombstoned in the index');
  const entry = backlog.slice(backlog.indexOf('### `QAN-BL-INTEL-04`'));
  assert.match(entry.slice(0, entry.indexOf('\n### ', 5)), /- \*\*Status:\*\* `CLOSED — TOMBSTONE`/u, 'and in its entry');
});
