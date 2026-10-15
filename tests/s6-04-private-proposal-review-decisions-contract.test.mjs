// S6-04 — Private Proposal Review and Decisions: the cross-layer static contract.
//
// It pins what a later change could silently erode: migration 0158 is forward-only and leaves the frozen I-07 / S6-02 /
// S6-03 runtime byte-identical; its five boundaries are authenticated-only shells over the existing cores that take no
// actor, recipient, role or state, present no name, conclusion or field and offer no acceptance; withdrawal is never
// gated on the launch seam; the three decision boundaries are the named S6-04 exceptions of the 0149 NO_BACKDOOR census
// and the named absorbers of the 0150 retry guard; the API routes take a command id and a view only; the mobile surface
// draws only what the server answered, never a person, a score or an acceptance; and the proofs are wired into CI. Live
// behaviour is proven by database/verify-migration-0158.mjs (real PostgreSQL) and
// database/prove-0158-proposal-decisions-postgrest.mjs (live PostgREST); this file proves structure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const sql = (text) => text.replace(/--[^\n]*/gu, '');
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const MIGRATIONS = 'database/migrations';
const MIGRATION = `${MIGRATIONS}/0158_matching_private_proposal_review_decisions_v1.sql`;
const VERIFIER = 'database/verify-migration-0158.mjs';
const WIRE = 'database/prove-0158-proposal-decisions-postgrest.mjs';
const API = 'apps/api/src/introductions-proposals';
const MOBILE = 'apps/mobile/src/introductions';
const blob = (path) => {
  const bytes = Buffer.from(read(path), 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
/** The frozen authority S6-04 composes, byte-identical (git blob ids at the S6-04 base, main 869b3ca6). */
const FROZEN = {
  [`${MIGRATIONS}/0110_matching_pair_eligibility_proposal_persistence_v1.sql`]: '5cf4dab35b921fa1d2f60a2875a5863964ca9139',
  [`${MIGRATIONS}/0111_matching_candidate_evaluation_disclosure_gate_v1.sql`]: '7e2df716f935b1f8be378c0c1fd1d232b6165956',
  [`${MIGRATIONS}/0112_matching_proposal_choreography_runtime_v1.sql`]: 'd806ddf5683048a830638bd264282fee09f39d53',
  [`${MIGRATIONS}/0114_matching_mutual_match_commit_transaction_v1.sql`]: 'c1f45248f37a0f0f30cc62ac1ccb4e1397797632',
  [`${MIGRATIONS}/0120_matching_proposal_temporal_exact_view_remediation_v1.sql`]: 'b233c8bc4405e8f54668ed6306ef781227746e97',
  [`${MIGRATIONS}/0149_matching_setup_pre_launch_direct_execute_narrowing_v1.sql`]: 'bf15ade251615caa54c6ba754e0c684c2ec79d6a',
  [`${MIGRATIONS}/0150_data_api_stale_state_non_retryable_sqlstate_v1.sql`]: '9d620c42b14a173253250fccf965cc1f91159ac7',
  [`${MIGRATIONS}/0155_introduction_privacy_isolation_end_boundary_v1.sql`]: 'be25d95ba8eb8f17d883d7b442089d03bf3f2d38',
  [`${MIGRATIONS}/0156_matching_confirmed_facts_eligibility_neutral_disclosure_v1.sql`]: '184dd3d33ef1934f14529bf651cb15de4ad7055e',
  [`${MIGRATIONS}/0157_matching_reproposal_admission_orchestration_v1.sql`]: 'f9c3ed87b1882b6f1fe7a2a0bb06b44302d15906',
  // The frozen I-07B audience type file is not edited; S6-04 states its own narrower contract instead.
  'apps/api/src/connected-worlds/matching/matching-proposal.types.ts': 'd23da2af56b727f90e5b717f6c2e97b575d7d335',
};
const EXPOSED = ['list_my_matching_proposals_v1', 'get_my_matching_proposal_v1', 'approve_my_matching_proposal_forward_v1',
  'decline_my_matching_proposal_v1', 'withdraw_my_matching_proposal_v1'];
const DECISIONS = EXPOSED.slice(2);
/** `CREATE FUNCTION public.<name>(` ... through its closing dollar tag. */
function statementOf(text, name) {
  const start = text.indexOf(`FUNCTION public.${name}(`);
  assert.ok(start >= 0, `0158 defines ${name}`);
  const tag = /AS (\$[A-Za-z_]*\$)/u.exec(text.slice(start));
  const open = start + tag.index + tag[0].length;
  return text.slice(start, text.indexOf(tag[1], open) + tag[1].length);
}

test('1 — 0158 directly follows 0157, is forward-only and leaves the frozen authority byte-identical', () => {
  const files = readdirSync(new URL(`${MIGRATIONS}/`, root)).filter((f) => /^\d{4}_.*\.sql$/u.test(f)).sort();
  assert.equal(files.filter((f) => f.startsWith('0158_')).length, 1, 'exactly one 0158');
  assert.equal(files[files.indexOf('0158_matching_private_proposal_review_decisions_v1.sql') - 1], '0157_matching_reproposal_admission_orchestration_v1.sql');
  for (const [file, id] of Object.entries(FROZEN)) assert.equal(blob(file), id, `${file} is byte-identical`);
  const body = sql(read(MIGRATION));
  assert.match(body, /^BEGIN;$/mu); assert.match(body, /^COMMIT;$/mu);
  assert.doesNotMatch(body, /\b(ALTER|CREATE|DROP) TABLE\b|\bCREATE OR REPLACE\b|\bDROP FUNCTION\b|\bALTER DEFAULT PRIVILEGES\b|\bON ALL FUNCTIONS\b|\bINSERT INTO\b|\bUPDATE public\b|\bDELETE FROM\b/u,
    'no relation, no redefinition, no direct write, no blanket grant');
  assert.equal((body.match(/^CREATE FUNCTION public\.[a-z_0-9]+\(/gmu) ?? []).length, 6, 'exactly six new functions');
});

test('2 — five authenticated-only boundaries and one private helper; no actor, recipient, role or state parameter', () => {
  const text = read(MIGRATION);
  const grant = /GRANT EXECUTE ON FUNCTION\n([\s\S]*?)\n  TO authenticated;/u.exec(sql(text));
  assert.ok(grant, 'one GRANT to authenticated');
  assert.deepEqual([...grant[1].matchAll(/public\.([a-z_0-9]+)\(/gu)].map((m) => m[1]), EXPOSED);
  assert.equal((sql(text).match(/\bGRANT\b/gu) ?? []).length, 1, 'nothing else is granted');
  assert.doesNotMatch(sql(text), /TO (anon|service_role|PUBLIC)/u);
  for (const name of [...EXPOSED, 'resolve_my_matching_proposal_presentation_v1']) {
    const statement = statementOf(text, name);
    assert.match(statement, /SECURITY DEFINER SET search_path = ''/u, `${name} is DEFINER, pinned`);
    assert.match(statement, /u uuid := auth\.uid\(\);/u, `${name} derives its human from auth.uid()`);
    const signature = statement.slice(0, statement.indexOf(')'));
    assert.doesNotMatch(signature, /user|actor|recipient|role|state|candidate|subject/iu, `${name} takes no identity, role or state`);
  }
});

test('3 — the reads present only the four neutral columns; no name, conclusion or field; the frozen projection is reused', () => {
  const text = read(MIGRATION);
  for (const name of ['list_my_matching_proposals_v1', 'get_my_matching_proposal_v1']) {
    assert.match(statementOf(text, name), /RETURNS TABLE\(recipient_view_id uuid, matching_proposal_id uuid, neutral_outcome text, available_actions text\[\]\)/u);
  }
  const helper = sql(statementOf(text, 'resolve_my_matching_proposal_presentation_v1'));
  assert.match(helper, /FROM public\.resolve_my_matching_proposal_v1\(p_proposal_id\)/u, 'the frozen 0156 neutral projection is the source');
  assert.match(helper, /public\.resolve_matching_proposal_prerequisites_v1\(p_proposal_id\)/u, 'consequential decisions are presented only when cleared');
  assert.match(helper, /proposal\.expires_at <= clock_timestamp\(\)/u, 'the deadline is decided by the database clock');
  for (const name of [...EXPOSED, 'resolve_my_matching_proposal_presentation_v1']) {
    assert.doesNotMatch(sql(statementOf(text, name)), /first_name|permitted_text|disclosed_value|private_reason_code|subject_user_id|_fields_v1|ACCEPT/u,
      `${name} reads no name, conclusion, field or reason and offers no acceptance`);
  }
});

test('4 — the decisions are thin shells over the existing cores, lock first; withdrawal ungated; 40001 absorbed without a CATCH_TRAP', () => {
  const text = read(MIGRATION);
  const cores = {
    approve_my_matching_proposal_forward_v1: ['approve_matching_proposal_forward_core_v1'],
    decline_my_matching_proposal_v1: ['decline_matching_proposal_as_second_core_v1', 'decline_matching_proposal_as_first_core_v1'],
    withdraw_my_matching_proposal_v1: ['withdraw_matching_proposal_core_v1'],
  };
  for (const name of DECISIONS) {
    const body = sql(statementOf(text, name));
    const enter = body.indexOf('public.enter_matching_proposal_decision_v1(p_proposal_id, u)');
    const ask = body.indexOf('public.resolve_my_matching_proposal_presentation_v1(p_proposal_id)');
    assert.ok(enter > 0 && ask > enter, `${name} takes the lock before it asks what is offered`);
    for (const core of cores[name]) assert.ok(body.indexOf(`public.${core}(`) > ask, `${name} calls ${core} last`);
    assert.equal((body.match(/_core_v1\(/gu) ?? []).length, cores[name].length, `${name} names no other core`);
    assert.match(body, /WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN/u, `${name} absorbs 40001 and names PT409`);
    assert.doesNotMatch(body, /RAISE;|ISOLATION|EXECUTE /u, `${name} re-raises nothing and runs no dynamic SQL`);
    assert.doesNotMatch(body, /commit_matching_mutual_match|shared_worlds|introduction_records/u, `${name} births nothing`);
  }
  const withdrawal = sql(statementOf(text, 'withdraw_my_matching_proposal_v1'));
  assert.doesNotMatch(withdrawal, /prerequisite|NOT_AVAILABLE_NOW/u, 'withdrawal is never gated on the launch seam (D7)');
  assert.match(withdrawal, /expected_state := committed\.prior_state;/u, 'a replay binds the durable prior state');
  assert.match(withdrawal, /expected_state := here\.proposal_state;/u, 'otherwise the state read under the lock');
});

test('5 — the named exceptions: 0149 NO_BACKDOOR admits exactly the three decisions; 0150 names them as absorbers', () => {
  const nb = read('database/verify-migration-0149.mjs');
  assert.match(nb, /const S6_04_PROPOSAL_DECISIONS = \[\n  'public\.approve_my_matching_proposal_forward_v1\(uuid, uuid, uuid\)',\n  'public\.decline_my_matching_proposal_v1\(uuid, uuid, uuid\)',\n  'public\.withdraw_my_matching_proposal_v1\(uuid, uuid, uuid\)',\n\];/u);
  // RE-ANCHORED by S6-05 (2026-10-16, migration 0159): its one acceptance boundary is appended after the three decisions.
  assert.match(nb, /\[\.\.\.retainedWriters, nameOf\(S6_02_INTRODUCTION_END\), \.\.\.S6_04_PROPOSAL_DECISIONS\.map\(nameOf\), nameOf\(S6_05_MUTUAL_MATCH_ACCEPT\)\]\.sort\(\)/u);
  for (const probe of ['f6 the census refuses a fourth client-executable wrapper around a proposal decision core',
    'f7 the census refuses an S6-04 decision boundary granted beyond authenticated']) assert.ok(nb.includes(probe), probe);
  const guard = read('database/verify-migration-0150.mjs');
  // RE-ANCHORED by S6-05 (2026-10-16, migration 0159): the acceptance absorber follows the three decisions.
  assert.match(guard, /'approve_my_matching_proposal_forward_v1', 'decline_my_matching_proposal_v1', 'withdraw_my_matching_proposal_v1',\n  'accept_my_matching_proposal_v1',\n\];/u);
});

test('6 — the API takes a command id and a view only, calls the five boundaries with the caller token, logs and retries nothing', () => {
  const controller = code(`${API}/introduction-proposals.controller.ts`);
  // RE-ANCHORED by S6-05 (2026-10-16, migration 0159): exactly one acceptance route follows the three decisions; it takes
  // the same { commandId, viewId } body and no identity or World (tests/s6-05-mutual-match-acceptance-contract.test.mjs).
  assert.deepEqual([...controller.matchAll(/@(Get|Post)\('([^']+)'\)/gu)].map((m) => `${m[1]} ${m[2]}`), [
    'Get proposals', 'Get proposals/:proposalId', 'Post proposals/:proposalId/forward-approval',
    'Post proposals/:proposalId/decline', 'Post proposals/:proposalId/withdrawal', 'Post proposals/:proposalId/acceptance']);
  assert.doesNotMatch(controller, /userId|counterpart|worldId/iu);
  const service = code(`${API}/introduction-proposals.service.ts`);
  assert.match(service, /key !== 'commandId' && key !== 'viewId'/u, 'the body is exactly { commandId, viewId }');
  assert.doesNotMatch(service, /retry|setTimeout|console\.|Logger/u);
  const repository = code(`${API}/introduction-proposals.repository.ts`);
  for (const name of EXPOSED) assert.ok(repository.includes(`'${name}'`), `the repository names ${name}`);
  assert.doesNotMatch(repository, /_core_v1|service_role|ServiceRole/u, 'the caller\'s own token, never a core');
  const census = read('apps/api/src/http-security/route-rate-limit.census.ts');
  for (const route of ['GET /introductions/proposals', 'GET /introductions/proposals/:proposalId', 'POST /introductions/proposals/:proposalId/forward-approval',
    'POST /introductions/proposals/:proposalId/decline', 'POST /introductions/proposals/:proposalId/withdrawal']) {
    assert.ok(census.includes(`'${route}': 'AUTHENTICATED'`), `${route} is in the census`);
  }
});

test('7 — mobile draws only what the server answered: no person, score, acceptance, Match or END wiring', () => {
  const files = readdirSync(new URL(`${MOBILE}/`, root)).filter((f) => /^(Proposals|proposals-)/u.test(f));
  assert.deepEqual(files.sort(), ['ProposalsSurface.tsx', 'proposals-controller.ts', 'proposals-copy.ts']);
  for (const file of [...files.map((f) => `${MOBILE}/${f}`), 'apps/mobile/src/runtime-entry/introduction-proposals-api.ts']) {
    const text = code(file);
    assert.doesNotMatch(text, /firstName|first_name|presentedFirstName|conclusion|photo|birth|score|percent|ranking|swipe/iu, `${file} names no person or score`);
    assert.doesNotMatch(text, /'ACCEPT'|accept\(|\/accept|commit_matching|end_own_introduction|introductions\/worlds\//u, `${file} wires no acceptance, Match or END`);
  }
  const transport = code('apps/mobile/src/runtime-entry/introduction-proposals-api.ts');
  assert.match(transport, /Object\.keys\(value\)\.length !== 4/u, 'a proposal with any other field is no answer');
  const copy = read(`${MOBILE}/proposals-copy.ts`);
  assert.match(copy, /status: 'S6-04 PRODUCT COPY GATE — CLOSED/u, 'the copy gate was closed by the Product Owner (2026-10-15)');
  assert.match(copy, /retainedNotDisplayed: \['M-01'\]/u, 'M-01 is kept exactly but not displayed in S6-04 (CG-2)');
  assert.doesNotMatch(copy, /PROPOSALS_LANG01_APPROVED\.M01/u, 'no displayed row carries M-01');
  assert.doesNotMatch(code(`${MOBILE}/ProposalsSurface.tsx`), /copy\.opening|M01/u, 'the review draws no M-01');
});

test('8 — the verifier, the wire proof and the contract are wired into the toolchain and API CI', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['verify:matching-proposal-review-decisions:integration'], `node --env-file-if-exists=.env ${VERIFIER}`);
  assert.equal(manifest.scripts['prove:proposal-decisions:postgrest'], `node --env-file-if-exists=.env ${WIRE}`);
  assert.equal(manifest.scripts['test:s6-04-private-proposal-review-decisions-contract'], 'node --test tests/s6-04-private-proposal-review-decisions-contract.test.mjs');
  const workflow = read('.github/workflows/api-ci.yml');
  assert.equal((workflow.match(/npm run verify:matching-proposal-review-decisions:integration/gu) ?? []).length, 1);
  assert.ok(workflow.indexOf('npm run verify:matching-proposal-review-decisions:integration') > workflow.indexOf('name: Apply all migrations to fresh PostgreSQL'));
  const wire = workflow.indexOf('npm run --silent prove:proposal-decisions:postgrest');
  assert.ok(wire > workflow.indexOf('docker run -d --rm --name "postgrest-$version"') && wire < workflow.indexOf('docker stop "postgrest-$version"'),
    'the wire proof runs against every live PostgREST line, inside the loop');
  assert.match(workflow, /run: npm run test:s6-04-private-proposal-review-decisions-contract\}/u);
  for (const file of [VERIFIER, WIRE]) {
    assert.ok(existsSync(new URL(file, root)));
    assert.doesNotMatch(read(file), /supabase\.co|postgres(?:ql)?:\/\/[^'`$]/iu, `${file} embeds no connection detail`);
  }
  const verifier = read(VERIFIER);
  for (const scenario of ['A01 ', 'A04 ', 'B01 ', 'C01 ', 'C02 ', 'C03 ', 'D01 ', 'D04 ', 'E01 ', 'E02 ', 'E03 ', 'F01 ', 'F02 ', 'F03 ', 'F04 ',
    'F05 ', 'G01 ', 'H01 ', 'I01 ', 'I02 ', 'report.assertAllPassed()', 'every fixture this verifier committed was removed']) {
    assert.ok(verifier.includes(scenario), `the 0158 verifier proves ${scenario.trim()}`);
  }
});
