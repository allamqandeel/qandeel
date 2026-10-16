// S6-05 — Mutual Match & Introduction World, CP2 (Mutual Match Secure Integration): the cross-layer static contract.
//
// It pins what a later change could silently erode: migration 0159 directly follows 0158, is forward-only and leaves the
// frozen Mutual Match core (0113 / 0114), the S6-02 isolation and END boundary (0155) and the S6-04 boundaries (0158)
// byte-identical; it adds exactly ONE authenticated acceptance - a thin shell over the 0114 core that takes a command, a
// proposal and a view only, derives the nine other identities on the server, enters the lock, asks the one presentation
// helper, calls the core once and absorbs its 40001 with PT409 named - and redefines that helper with exactly the ACCEPT
// branch, gated on the CW2-08 seam; the acceptance is the one named S6-05 exception of the 0149 NO_BACKDOOR census, a
// named absorber of the 0150 retry guard and the one shell admitted by the 0112 acceptance census; the API route takes
// { commandId, viewId } only and only MATCHED names a World; and the proofs are wired into CI. Live behaviour is proven
// by database/verify-migration-0159.mjs (real PostgreSQL) and database/prove-0159-mutual-match-acceptance-postgrest.mjs
// (live PostgREST); this file proves structure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const sql = (text) => text.replace(/--[^\n]*/gu, '');
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const MIGRATIONS = 'database/migrations';
const MIGRATION = `${MIGRATIONS}/0159_matching_mutual_match_acceptance_v1.sql`;
const VERIFIER = 'database/verify-migration-0159.mjs';
const WIRE = 'database/prove-0159-mutual-match-acceptance-postgrest.mjs';
const API = 'apps/api/src/introductions-proposals';
const blob = (path) => {
  const bytes = Buffer.from(read(path), 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
/** The frozen authority S6-05 CP2 composes, byte-identical (git blob ids at the S6-05 base, main 35ad4e19). */
const FROZEN = {
  [`${MIGRATIONS}/0113_matching_mutual_match_introduction_persistence_v1.sql`]: '56fdb8f961047cf2848deda2f991cf436897ccb7',
  [`${MIGRATIONS}/0114_matching_mutual_match_commit_transaction_v1.sql`]: 'c1f45248f37a0f0f30cc62ac1ccb4e1397797632',
  [`${MIGRATIONS}/0116_introduction_terminal_lifecycle_v1.sql`]: '93cd217f96c2b3562e94cb1eaead0019097d654f',
  [`${MIGRATIONS}/0118_introduction_ordinary_shared_material_v1.sql`]: '4a5e81de210007f905a2fc6012becdcd90bffa3a',
  [`${MIGRATIONS}/0149_matching_setup_pre_launch_direct_execute_narrowing_v1.sql`]: 'bf15ade251615caa54c6ba754e0c684c2ec79d6a',
  [`${MIGRATIONS}/0150_data_api_stale_state_non_retryable_sqlstate_v1.sql`]: '9d620c42b14a173253250fccf965cc1f91159ac7',
  [`${MIGRATIONS}/0155_introduction_privacy_isolation_end_boundary_v1.sql`]: 'be25d95ba8eb8f17d883d7b442089d03bf3f2d38',
  [`${MIGRATIONS}/0156_matching_confirmed_facts_eligibility_neutral_disclosure_v1.sql`]: '184dd3d33ef1934f14529bf651cb15de4ad7055e',
  [`${MIGRATIONS}/0157_matching_reproposal_admission_orchestration_v1.sql`]: 'f9c3ed87b1882b6f1fe7a2a0bb06b44302d15906',
  [`${MIGRATIONS}/0158_matching_private_proposal_review_decisions_v1.sql`]: 'efc792bbd9a9c4b797e5471761bd60210ff0e4c7',
};
const SLOTS = ['WORLD', 'INTRODUCTION_RECORD', 'FIRST_RECIPIENT_EPISODE', 'CANDIDATE_EPISODE', 'FIRST_RECIPIENT_CLAIM',
  'CANDIDATE_CLAIM', 'FIRST_RECIPIENT_PAUSE', 'CANDIDATE_PAUSE', 'HANDOFF_PACKAGE_VERSION'];
/** `FUNCTION public.<name>(` ... through its closing dollar tag. */
function statementOf(text, name) {
  const start = text.indexOf(`FUNCTION public.${name}(`);
  assert.ok(start >= 0, `0159 defines ${name}`);
  const tag = /AS (\$[A-Za-z_]*\$)/u.exec(text.slice(start));
  const open = start + tag.index + tag[0].length;
  return text.slice(start, text.indexOf(tag[1], open) + tag[1].length);
}

test('1 — 0159 directly follows 0158, is forward-only and leaves the frozen authority byte-identical', () => {
  const files = readdirSync(new URL(`${MIGRATIONS}/`, root)).filter((f) => /^\d{4}_.*\.sql$/u.test(f)).sort();
  assert.equal(files.filter((f) => f.startsWith('0159_')).length, 1, 'exactly one 0159');
  assert.equal(files[files.indexOf('0159_matching_mutual_match_acceptance_v1.sql') - 1], '0158_matching_private_proposal_review_decisions_v1.sql');
  for (const [file, id] of Object.entries(FROZEN)) assert.equal(blob(file), id, `${file} is byte-identical`);
  const body = sql(read(MIGRATION));
  assert.match(body, /^BEGIN;$/mu); assert.match(body, /^COMMIT;$/mu);
  assert.doesNotMatch(body, /\b(ALTER|CREATE|DROP) TABLE\b|\bDROP FUNCTION\b|\bALTER DEFAULT PRIVILEGES\b|\bON ALL FUNCTIONS\b|\bINSERT INTO\b|\bUPDATE public\b|\bDELETE FROM\b/u,
    'no relation, no direct write, no blanket grant');
  assert.deepEqual([...body.matchAll(/^CREATE FUNCTION public\.([a-z_0-9]+)\(/gmu)].map((m) => m[1]), ['accept_my_matching_proposal_v1'], 'exactly one new function');
  assert.deepEqual([...body.matchAll(/^CREATE OR REPLACE FUNCTION public\.([a-z_0-9]+)\(/gmu)].map((m) => m[1]), ['resolve_my_matching_proposal_presentation_v1'],
    'exactly one redefinition: the private presentation helper');
});

test('2 — one authenticated-only acceptance: no identity, World or internal id from the client; the human is auth.uid()', () => {
  const text = read(MIGRATION);
  const grants = [...sql(text).matchAll(/\bGRANT EXECUTE ON FUNCTION ([^\n]+?) TO ([a-z_]+);/gu)].map((m) => [m[1], m[2]]);
  assert.deepEqual(grants, [['public.accept_my_matching_proposal_v1(uuid, uuid, uuid)', 'authenticated']], 'nothing else is granted');
  assert.doesNotMatch(sql(text), /TO (anon|service_role|PUBLIC)/u);
  const accept = statementOf(text, 'accept_my_matching_proposal_v1');
  assert.match(accept, /^FUNCTION public\.accept_my_matching_proposal_v1\(p_command_id uuid, p_proposal_id uuid, p_expected_view_id uuid\)\nRETURNS TABLE\(outcome text, introduction_world_id uuid\)\nLANGUAGE plpgsql SECURITY DEFINER SET search_path = ''/u);
  assert.match(accept, /u uuid := auth\.uid\(\);/u);
  assert.doesNotMatch(sql(accept), /first_name|permitted_text|disclosed_value|private_reason_code|subject_user_id|_fields_v1|first_recipient_user_id|candidate_user_id/u,
    'it reads no name, conclusion, field, reason or counterpart identity');
});

test('3 — the nine identities are derived on the server, deterministically, from the human, the proposal and the command', () => {
  const body = sql(statementOf(read(MIGRATION), 'accept_my_matching_proposal_v1'));
  assert.match(body, /sha256\(convert_to\('QANDEEL_S6_05_MUTUAL_MATCH_IDENTITY_V1' \|\| E'\\n' \|\| s\.slot \|\| E'\\n'\s+\|\| lower\(u::text\) \|\| E'\\n' \|\| lower\(p_proposal_id::text\) \|\| E'\\n' \|\| lower\(p_command_id::text\), 'UTF8'\)\)/u);
  assert.match(body, /substr\(d\.h, 1, 12\) \|\| '4' \|\| substr\(d\.h, 14, 3\) \|\| '8' \|\| substr\(d\.h, 18, 3\) \|\| substr\(d\.h, 21, 12\)/u, 'the 0155 version and variant nibbles');
  const slots = /unnest\(ARRAY\[([\s\S]*?)\]\) WITH ORDINALITY/u.exec(body);
  assert.deepEqual([...slots[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]), SLOTS, 'the nine slots, in the core\'s parameter order');
  assert.match(body, /public\.commit_matching_mutual_match_v1\(\n\s+p_command_id, p_proposal_id, p_expected_view_id,\n\s+ids\[1\], ids\[2\], ids\[3\], ids\[4\], ids\[5\], ids\[6\], ids\[7\], ids\[8\], ids\[9\]\)/u);
  assert.doesNotMatch(body, /gen_random_uuid|random\(|clock_timestamp|now\(\)/u, 'nothing random or time-based enters an identity');
});

test('4 — a thin shell: the lock, then the one offered decision, then the frozen core exactly once; 40001 absorbed without a CATCH_TRAP', () => {
  const body = sql(statementOf(read(MIGRATION), 'accept_my_matching_proposal_v1'));
  const enter = body.indexOf('public.enter_matching_proposal_decision_v1(p_proposal_id, u)');
  const ask = body.indexOf('public.resolve_my_matching_proposal_presentation_v1(p_proposal_id)');
  const core = body.indexOf('public.commit_matching_mutual_match_v1(');
  assert.ok(enter > 0 && ask > enter && core > ask, 'the lock, then the helper, then the core');
  assert.equal((body.match(/public\.commit_matching_mutual_match_v1\(/gu) ?? []).length, 1);
  assert.match(body, /IF NOT \('ACCEPT' = ANY \(here\.decision_actions\)\) THEN/u, 'ACCEPT must be a decision the helper offers under the lock');
  assert.match(body, /WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN/u);
  assert.doesNotMatch(body, /RAISE;|ISOLATION|EXECUTE |INSERT|UPDATE|DELETE|_core_v1\(|40P01/u, 'no re-raise, no dynamic SQL, no write, no other core, no deadlock conversion');
  const words = new Set([...body.matchAll(/'(MATCHED|CHANGED|UNAVAILABLE|NOT_AVAILABLE_NOW|COMMAND_CONFLICT)'/gu)].map((m) => m[1]));
  assert.deepEqual([...words].sort(), ['CHANGED', 'COMMAND_CONFLICT', 'MATCHED', 'NOT_AVAILABLE_NOW', 'UNAVAILABLE']);
  assert.match(body, /SQLERRM IN \('MATCHING_RECIPIENT_VIEW_STALE', 'MATCHING_STALE_STATE'\) THEN 'CHANGED'\s+ELSE 'UNAVAILABLE'/u,
    'only a moved view or proposal is CHANGED; NOT_COMMITTABLE carries no reason');
  assert.match(body, /SQLERRM = 'MATCHING_PROPOSAL_LAUNCH_PREREQUISITE_UNRESOLVED' THEN 'NOT_AVAILABLE_NOW'\s+ELSE 'UNAVAILABLE'/u,
    'the closed seam is NOT_AVAILABLE_NOW; an expiry at the birth instant is one more ending');
});

test('5 — the helper is the 0158 helper with exactly the ACCEPT branch, presented only when the CW2-08 seam is CLEARED', () => {
  const flat = (s) => sql(s).replace(/\s+/gu, ' ').trim();
  const before = flat(statementOf(read(`${MIGRATIONS}/0158_matching_private_proposal_review_decisions_v1.sql`), 'resolve_my_matching_proposal_presentation_v1'));
  const after = flat(statementOf(read(MIGRATION), 'resolve_my_matching_proposal_presentation_v1'));
  const expected = before
    .replace("role_of = 'CANDIDATE' THEN actions := ARRAY['DECLINE'];", "role_of = 'CANDIDATE' THEN actions := ARRAY['ACCEPT', 'DECLINE'];")
    .replace("actions && ARRAY['APPROVE_FORWARD', 'DECLINE']", "actions && ARRAY['APPROVE_FORWARD', 'DECLINE', 'ACCEPT']")
    .replace("array_remove(array_remove(actions, 'APPROVE_FORWARD'), 'DECLINE')", "array_remove(array_remove(array_remove(actions, 'APPROVE_FORWARD'), 'DECLINE'), 'ACCEPT')");
  assert.notEqual(expected, before);
  assert.equal(after, expected, 'nothing else in the helper changed');
  assert.match(read(MIGRATION), /'public\.resolve_my_matching_proposal_presentation_v1\(uuid\)',\n\s+'public\.accept_my_matching_proposal_v1\(uuid,uuid,uuid\)'\] LOOP/u,
    'the redefined helper is revoked again explicitly (CREATE OR REPLACE keeps an ACL)');
});

test('6 — the named exceptions: 0149 NO_BACKDOOR, 0150 ABSORBED and the 0112 acceptance census each admit exactly the one shell', () => {
  const nb = read('database/verify-migration-0149.mjs');
  assert.match(nb, /const S6_05_MUTUAL_MATCH_ACCEPT = 'public\.accept_my_matching_proposal_v1\(uuid, uuid, uuid\)';/u);
  assert.match(nb, /nameOf\(S6_05_MUTUAL_MATCH_ACCEPT\)\]\.sort\(\)/u);
  assert.equal((nb.match(/S6_05_MUTUAL_MATCH_ACCEPT/gu) ?? []).length, 4, 'the exception is named, not generalized');
  for (const probe of ['f8 the census refuses a second client-executable wrapper around the Mutual Match core',
    'f9 the census refuses the S6-05 acceptance boundary granted beyond authenticated']) assert.ok(nb.includes(probe), probe);
  assert.match(read('database/verify-migration-0150.mjs'), /'withdraw_my_matching_proposal_v1',\n  'accept_my_matching_proposal_v1',\n\];/u);
  assert.match(read('database/verify-migration-0112.mjs'), /\['accept_my_matching_proposal_v1', I07C_MATCH_PRODUCER\]\.sort\(\)/u);
  const v0158 = read('database/verify-migration-0158.mjs');
  assert.match(v0158, /actions: \['ACCEPT', 'DECLINE'\], view: secondView/u, 'the S6-04 pin is re-anchored to the offered acceptance');
  assert.match(v0158, /if \(fn !== FN\.PRESENT\) assert\.doesNotMatch\(src, \/accept\/iu/u, 'and no S6-04 boundary accepts anything');
});

test('7 — the API: one acceptance route, { commandId, viewId } only, the caller token, MATCHED alone names a World', () => {
  const controller = code(`${API}/introduction-proposals.controller.ts`);
  assert.match(controller, /@Post\('proposals\/:proposalId\/acceptance'\)\n\s+@HttpCode\(200\)\n\s+accept\(/u);
  assert.doesNotMatch(controller, /worldId|userId|counterpart/iu);
  const service = code(`${API}/introduction-proposals.service.ts`);
  assert.match(service, /key !== 'commandId' && key !== 'viewId'/u, 'the body is exactly { commandId, viewId }');
  assert.match(service, /outcome === 'MATCHED' \? typeof world !== 'string' \|\| !UUID\.test\(world\) : world !== null/u, 'only MATCHED carries a World');
  assert.match(service, /const ACTIONS: readonly ProposalAction\[\] = \['APPROVE_FORWARD', 'DECLINE', 'WITHDRAW', 'ACCEPT'\];/u);
  assert.doesNotMatch(service, /retry|setTimeout|console\.|Logger/u);
  const repository = code(`${API}/introduction-proposals.repository.ts`);
  assert.match(repository, /this\.rpc\(accessToken, 'accept_my_matching_proposal_v1', \{ p_command_id: commandId, p_proposal_id: proposalId, p_expected_view_id: viewId \}\)/u);
  assert.doesNotMatch(repository, /_core_v1|commit_matching|service_role|ServiceRole/u, 'the caller\'s own token, never the core');
  assert.match(read('apps/api/src/http-security/route-rate-limit.census.ts'), /'POST \/introductions\/proposals\/:proposalId\/acceptance': 'AUTHENTICATED'/u);
});

test('8 — the verifier, the wire proof and the contract are wired into the toolchain and API CI', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['verify:matching-mutual-match-acceptance:integration'], `node --env-file-if-exists=.env ${VERIFIER}`);
  assert.equal(manifest.scripts['prove:mutual-match-acceptance:postgrest'], `node --env-file-if-exists=.env ${WIRE}`);
  assert.equal(manifest.scripts['test:s6-05-mutual-match-acceptance-contract'], 'node --test tests/s6-05-mutual-match-acceptance-contract.test.mjs');
  const workflow = read('.github/workflows/api-ci.yml');
  assert.equal((workflow.match(/npm run verify:matching-mutual-match-acceptance:integration/gu) ?? []).length, 1);
  assert.ok(workflow.indexOf('npm run verify:matching-mutual-match-acceptance:integration') > workflow.indexOf('name: Apply all migrations to fresh PostgreSQL'));
  const wire = workflow.indexOf('npm run --silent prove:mutual-match-acceptance:postgrest');
  assert.ok(wire > workflow.indexOf('docker run -d --rm --name "postgrest-$version"') && wire < workflow.indexOf('docker stop "postgrest-$version"'),
    'the wire proof runs against every live PostgREST line, inside the loop');
  assert.match(workflow, /run: npm run test:s6-05-mutual-match-acceptance-contract\}/u);
  for (const file of [VERIFIER, WIRE]) {
    assert.ok(existsSync(new URL(file, root)));
    assert.doesNotMatch(read(file), /supabase\.co|postgres(?:ql)?:\/\/[^'`$]/iu, `${file} embeds no connection detail`);
  }
  const verifier = read(VERIFIER);
  for (const scenario of ['A01 ', 'A02 ', 'A03 ', 'A04 ', 'B01 ', 'B02 ', 'C01 ', 'D01 ', 'D02 ', 'D03 ', 'E01 ', 'E02 ', 'E03 ', 'E04 ', 'E05 ',
    'E06 ', 'E07 ', 'F01 ', 'G01 ', 'G02 ', 'G03 ', 'G04 ', 'G05 ', 'G06 ', 'report.assertAllPassed()', 'every fixture this verifier committed was removed']) {
    assert.ok(verifier.includes(scenario), `the 0159 verifier proves ${scenario.trim()}`);
  }
});
