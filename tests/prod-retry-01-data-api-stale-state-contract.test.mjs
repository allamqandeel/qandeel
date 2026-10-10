// PROD-RETRY-01 - static contract for the Data API stale-state SQLSTATE change (migration 0150, QAN-BL-PROD-06).
//
// Real behaviour is proven by database/verify-migration-0150.mjs (PostgreSQL, role-switched sessions, the cross-schema
// guard) and by database/prove-0150-stale-refusal-postgrest.mjs (live PostgREST on every supported line). This contract
// pins what a later change could silently erode:
//
//   * 0150 is one forward transaction made of a self-check and twelve CREATE OR REPLACE statements, each of which is its
//     defining statement with exactly the approved substitution - nothing else: no grant, owner, table, policy or row;
//   * 40P01 is never converted, and PT409 is raised nowhere but in the eleven and 0135's two AI-usage conflicts;
//   * the guard's PL/pgSQL reading is right on the constructs its proofs depend on (unit cases below);
//   * the API recognises the exact stale identities under PT409 and 40001 by equality, never by HTTP status;
//   * the verifier, the wire proof and this contract are wired into API CI, the proof bounded on every line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { conditionMatches, lex, parseBlocks, raiseSites } from '../database/data-api-retry-hazard-guard.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MIGRATIONS = 'database/migrations';
const migrations = () => readdirSync(new URL(`../${MIGRATIONS}/`, import.meta.url)).filter((name) => name.endsWith('.sql')).sort();
const migration = (prefix) => {
  const name = migrations().find((file) => file.startsWith(prefix));
  assert.ok(name, `migration ${prefix} exists`);
  return read(`${MIGRATIONS}/${name}`);
};
const M0150_NAME = '0150_data_api_stale_state_non_retryable_sqlstate_v1.sql';
const M0150 = read(`${MIGRATIONS}/${M0150_NAME}`);
const OLD_HANDLER = "WHEN SQLSTATE '40001' OR SQLSTATE '22023' THEN";
const NEW_HANDLER = "WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' OR SQLSTATE '22023' THEN";

/** [live name, name in the defining migration, defining migration, ERRCODE sites | 'CATCHER']. */
const TARGETS = [
  ['transition_hypothesis_core_v1', 'transition_hypothesis_core_v1', '0036', 2],
  ['apply_hypothesis_evidence_update_core_v1', 'apply_hypothesis_evidence_update_core_v1', '0032', 2],
  ['execute_post_response_hypothesis_update_batch_v1_core', 'execute_post_response_hypothesis_update_batch_v1', '0034', 'CATCHER'],
  ['commit_finalized_exchange_with_full_semantic_chain_v1', 'commit_finalized_exchange_with_full_semantic_chain_v1', '0071', 2],
  ['get_conversation_thread_identity_dossier_page_v1', 'get_conversation_thread_identity_dossier_page_v1', '0070', 1],
  ['grant_shared_world_standing_context_v1', 'grant_shared_world_standing_context_v1', '0078', 2],
  ['revoke_shared_world_standing_context_v1', 'revoke_shared_world_standing_context_v1', '0078', 2],
  ['rotate_shared_world_invite_credential_v1', 'rotate_shared_world_invite_credential_v1', '0081', 4],
  ['pause_matching_participation_v1', 'pause_matching_participation_v1', '0109', 2],
  ['turn_off_matching_participation_v1', 'turn_off_matching_participation_v1', '0109', 2],
  ['revoke_matching_context_v1', 'revoke_matching_context_v1', '0109', 2],
  ['revoke_pre_match_disclosure_authority_v1', 'revoke_pre_match_disclosure_authority_v1', '0109', 2],
];

function statementOf(text, name) {
  const start = Math.max(text.indexOf(`CREATE FUNCTION public.${name}(`), text.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`));
  assert.ok(start >= 0, `public.${name} is created`);
  const open = text.indexOf('AS $$', start) + 'AS $$'.length;
  const close = text.indexOf('$$;', open);
  return { statement: text.slice(start, close + '$$;'.length), body: text.slice(open, close) };
}

test('0150 is the one forward migration of PROD-RETRY-01, one transaction with its search_path pinned', () => {
  assert.equal(migrations().filter((name) => name.startsWith('0150_')).length, 1);
  assert.ok(migrations().includes(M0150_NAME));
  assert.equal(M0150.match(/^BEGIN;$/gmu)?.length, 1);
  assert.equal(M0150.match(/^COMMIT;$/gmu)?.length, 1);
  assert.ok(M0150.indexOf("SET LOCAL search_path = '';") < M0150.indexOf('CREATE TEMP TABLE'), 'every name is resolved schema-qualified');
});

test('each of the twelve statements is its defining statement with exactly the approved substitution', () => {
  let sites = 0;
  for (const [live, origin, prefix, expected] of TARGETS) {
    const original = statementOf(migration(prefix), origin);
    const renamed = original.statement.replace(/^CREATE (OR REPLACE )?FUNCTION public\.\w+\(/u, `CREATE OR REPLACE FUNCTION public.${live}(`);
    let substituted;
    if (expected === 'CATCHER') {
      assert.equal(original.body.split(OLD_HANDLER).length - 1, 1, `${live}: one batch handler`);
      substituted = renamed.replace(OLD_HANDLER, NEW_HANDLER);
    } else {
      assert.equal(original.body.split("ERRCODE='40001'").length - 1, expected, `${live}: ${expected} stale-state sites`);
      assert.equal(original.body.split('40001').length - 1, expected, `${live}: and no other 40001`);
      substituted = renamed.replaceAll("ERRCODE='40001'", "ERRCODE='PT409'");
      sites += expected;
    }
    assert.notEqual(substituted, renamed);
    assert.equal(statementOf(M0150, live).statement, substituted, `${live}: 0150 carries exactly the substituted defining statement`);
  }
  assert.equal(sites, 23, 'twenty-three stale-state sites');
  assert.equal(M0150.match(/^CREATE OR REPLACE FUNCTION /gmu)?.length, 12, 'twelve bodies and no other function');
});

test('outside the twelve bodies 0150 is only its self-check: no grant, owner, table, policy, RLS or row change', () => {
  let rest = M0150;
  for (const [live] of TARGETS) rest = rest.replace(statementOf(rest, live).statement, '');
  const code = rest.replace(/--[^\n]*/gu, '').replace(/DO \$\$[\s\S]*?\n\$\$;/gu, 'DO;');
  assert.equal((rest.match(/^DO \$\$$/gmu) ?? []).length, 2, 'a pre-condition block and a terminal self-check block');
  assert.doesNotMatch(code.replaceAll('ON COMMIT DROP', ''), /\b(GRANT|REVOKE|ALTER|DROP|DELETE|UPDATE|TRUNCATE|POLICY|SECURITY\s+LABEL|COMMENT\s+ON)\b/iu);
  const tables = [...code.matchAll(/CREATE\s+(TEMP\s+)?TABLE\s+(\S+)/giu)];
  assert.deepEqual(tables.map((m) => [Boolean(m[1]), m[2]]), [[true, 'prod_retry_01_before'], [true, 'prod_retry_01_targets']], 'only the two temporary tables');
  assert.equal((code.match(/ON COMMIT DROP/gu) ?? []).length, 2);
  assert.deepEqual([...code.matchAll(/INSERT\s+INTO\s+(\S+)/giu)].map((m) => m[1]), ['prod_retry_01_targets'], 'it writes nothing but its own target list');
  for (const marker of ['PROD_RETRY_01_0150_PRECONDITION', 'PROD_RETRY_01_0150_SELF_CHECK', 'outside the approved twelve changed, appeared or disappeared',
    'is not exactly the approved substitution', 'the posture of %']) {
    assert.ok(M0150.includes(marker), `the self-check carries: ${marker}`);
  }
});

test('40P01 is never converted, and PT409 is raised only by the eleven and the two 0135 AI-usage conflicts', () => {
  assert.doesNotMatch(M0150.replace(/--[^\n]*/gu, ''), /40P01|deadlock_detected/u);
  const raisingPt409 = migrations().filter((name) => /ERRCODE\s*=\s*'PT409'/u.test(read(`${MIGRATIONS}/${name}`).replace(/--[^\n]*/gu, '')));
  assert.deepEqual(raisingPt409, ['0135_ai_usage_cost_credit_ledger_v1.sql', M0150_NAME]);
});

test('the guard lexes literals and comments as data, never as code', () => {
  const tokens = lex(`-- RAISE EXCEPTION 'x' USING ERRCODE='40001';
    /* BEGIN END */ v := 'BEGIN; EXCEPTION WHEN OTHERS'; w := $q$END;$q$; x := E'it\\'s'; "End" := 1;`);
  assert.equal(tokens.filter((t) => t.t === 'word' && !t.quoted && ['BEGIN', 'END', 'EXCEPTION', 'RAISE'].includes(t.u)).length, 0);
  assert.deepEqual(tokens.filter((t) => t.t === 'str').map((t) => t.v), ['BEGIN; EXCEPTION WHEN OTHERS', 'END;', "it's"]);
  assert.equal(raiseSites(tokens).length, 0);
});

test('the guard reads raise sites: ERRCODE literals, SQLSTATE, condition names, levels and dynamic codes', () => {
  const sites = raiseSites(lex(`
    RAISE EXCEPTION 'A' USING ERRCODE='40001';
    RAISE EXCEPTION 'B' USING ERRCODE = 'serialization_failure', DETAIL = 'd';
    RAISE SQLSTATE '40P01';
    RAISE deadlock_detected;
    RAISE EXCEPTION 'C' USING ERRCODE='PT409';
    RAISE EXCEPTION USING MESSAGE = 'D', ERRCODE = v_code;
    RAISE NOTICE 'not an error';
    RAISE;`));
  assert.deepEqual(sites.map((s) => [s.code, s.message, s.dynamic, s.bare]), [
    ['40001', 'A', false, false], ['40001', 'B', false, false], ['40P01', null, false, false], ['40P01', null, false, false],
    ['PT409', 'C', false, false], [null, 'D', true, false], [null, null, false, true],
  ]);
  assert.ok(conditionMatches(['serialization_failure'], '40001') && conditionMatches(['transaction_rollback'], '40P01'));
  assert.ok(conditionMatches(['others'], 'PT409') && conditionMatches(['40001'], '40001') && conditionMatches(['PT409'], 'PT409'));
  assert.ok(!conditionMatches(['serialization_failure'], 'PT409') && !conditionMatches(['unique_violation'], '40001'));
});

test('the guard knows which handlers protect a site: nesting, CASE expressions, EXIT WHEN, and handler bodies', () => {
  const source = `
DECLARE x int;
BEGIN
  x := CASE WHEN a THEN 1 ELSE 2 END;
  LOOP EXIT WHEN x > 3; x := x + 1; END LOOP;
  BEGIN
    PERFORM public.inner_call();
    IF x THEN PERFORM public.guarded_call(); END IF;
  EXCEPTION
    WHEN unique_violation THEN
      PERFORM public.in_handler_call();
    WHEN serialization_failure OR SQLSTATE 'PT409' THEN
      RETURN;
  END;
  PERFORM public.outer_call();
EXCEPTION WHEN OTHERS THEN
  RAISE;
END`;
  const tokens = lex(source);
  const { frames, protectors } = parseBlocks(tokens);
  assert.equal(frames.length, 2);
  const at = (name) => tokens.findIndex((t) => t.v === name);
  const conditions = (name) => protectors(at(name)).map((f) => f.clauses.map((c) => c.conditions.join('|')).join(','));
  assert.deepEqual(conditions('inner_call'), ['unique_violation,serialization_failure|PT409', 'others']);
  assert.deepEqual(conditions('guarded_call'), ['unique_violation,serialization_failure|PT409', 'others']);
  assert.deepEqual(conditions('in_handler_call'), ['others'], 'a handler body is protected only by the blocks around its block');
  assert.deepEqual(conditions('outer_call'), ['others']);
});

test('the API recognises the exact stale identities under PT409 and 40001, by equality, never by HTTP status', () => {
  const focus = read('apps/api/src/conversational-focus/conversation-focus-runtime.repository.ts');
  assert.match(focus, /export const STALE_CONTEXT_SQLSTATE = 'PT409';/u);
  assert.match(focus, /export const STALE_CONTEXT_LEGACY_SQLSTATE = '40001';/u);
  assert.match(focus, /return isStaleContextSqlstate\(databaseCode\)\s*&& databaseMessage === STALE_CONVERSATIONAL_FOCUS_CONTEXT_TOKEN;/u);
  const lifecycle = read('apps/api/src/thread-lifecycle/conversation-thread-lifecycle-runtime.repository.ts');
  assert.match(lifecycle, /return isStaleContextSqlstate\(databaseCode\) && databaseMessage === STALE_THREAD_IDENTITY_CONTEXT_TOKEN;/u);
  const shared = read('apps/api/src/shared-world/shared-world.service.ts');
  assert.match(shared, /const isStaleRotation = \(error: unknown\): boolean => \(databaseCode\(error\) === 'PT409' \|\| databaseCode\(error\) === '40001'\)\s*&& databaseMessage\(error\) === 'SHARED_INVITE_CREDENTIAL_STALE_STATE';/u);
  assert.match(shared, /if \(isStaleRotation\(error\)\) break;/u);
  assert.doesNotMatch(shared, /databaseCode\(error\) === '40001'\) break/u, 'no bare-code lost-race test remains');
  for (const source of [focus, lifecycle]) assert.doesNotMatch(source, /status === 409|\.status\s*===\s*500/u, 'the stale condition is never an HTTP status');
});

test('the verifier, the wire proof and this contract are wired into API CI; the proof is bounded on every line', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['verify:data-api-stale-state-non-retryable:integration'], 'node --env-file-if-exists=.env database/verify-migration-0150.mjs');
  assert.equal(pkg.scripts['prove:data-api-stale-refusal:postgrest'], 'node --env-file-if-exists=.env database/prove-0150-stale-refusal-postgrest.mjs');
  assert.equal(pkg.scripts['test:prod-retry-01-data-api-stale-state-contract'], 'node --test tests/prod-retry-01-data-api-stale-state-contract.test.mjs');
  const ci = read('.github/workflows/api-ci.yml');
  assert.equal((ci.match(/npm run test:prod-retry-01-data-api-stale-state-contract/gu) ?? []).length, 1);
  assert.equal((ci.match(/npm run verify:data-api-stale-state-non-retryable:integration/gu) ?? []).length, 1);
  assert.ok(ci.indexOf('verify:matching-setup-direct-rpc-narrowing:integration') < ci.indexOf('verify:data-api-stale-state-non-retryable:integration'),
    'the 0150 verifier runs after the 0149 one');
  const loop = ci.slice(ci.indexOf('for version in v12.2.9 v13.0.8 v14.18 v16.4; do'), ci.indexOf('\n          done\n', ci.indexOf('for version in v12.2.9')));
  assert.match(loop, /POSTGREST_VERSION="\$version" npm run --silent prove:data-api-stale-refusal:postgrest/u, 'the wire proof runs on every line');
  assert.match(ci, /trap 'docker ps -q --filter "name=postgrest-v" \| xargs -r docker stop/u, 'no engine container outlives the step');
  const proof = read('database/prove-0150-stale-refusal-postgrest.mjs');
  assert.match(proof, /signal: AbortSignal\.timeout\(RPC_TIMEOUT_MS\)/u, 'every request is bounded');
  assert.match(proof, /const RETRIES_40001 = !\(major >= 16\);/u, 'a 40001 is never sent to a line that re-runs it');
});
