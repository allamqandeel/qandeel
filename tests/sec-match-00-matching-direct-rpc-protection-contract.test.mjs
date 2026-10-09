// SEC-MATCH-00 - static contract for the Matching setup pre-launch direct-execute narrowing (migration 0149).
//
// Real behaviour is proven by database/verify-migration-0149.mjs (PostgreSQL, real SET ROLE sessions) and by
// database/prove-0149-matching-direct-rpc-postgrest.mjs (live PostgREST). This contract pins what a later change could
// silently erode: 0149 is a privileges-only forward migration that names exactly the six suspended boundaries and none of
// the five retained ones; the frozen 0108 / 0109 sources are byte-identical; NO later migration may reopen, re-create,
// re-own or blanket-grant one of the six (the forward regression check - a reviewed Stage 6 launch path that needs to
// must amend this contract under QAN-BL-MATCH-01); and the verifier, the wire proof and the canonical records are wired.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
/** SQL without comments, so a rule about statements is never tripped by prose that explains the rule. */
const sql = (text) => text.replace(/--[^\n]*/gu, '');
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

const MIGRATIONS = 'database/migrations';
const MIGRATION = '0149_matching_setup_pre_launch_direct_execute_narrowing_v1.sql';
const SUSPENDED = [
  'public.activate_matching_participation_v1(uuid, text, uuid)',
  'public.resume_matching_participation_v1(uuid, uuid)',
  'public.grant_matching_context_v1(uuid, uuid, uuid)',
  'public.set_introduction_profile_v1(uuid, text[], text[], uuid)',
  'public.set_matching_requirements_v1(uuid, text[], text[], text[], uuid)',
  'public.grant_pre_match_disclosure_authority_v1(uuid, uuid, uuid, text[], uuid)',
];
const RETAINED = [
  'pause_matching_participation_v1', 'turn_off_matching_participation_v1', 'revoke_matching_context_v1',
  'revoke_pre_match_disclosure_authority_v1', 'get_my_matching_setup_v1',
];
const nameOf = (signature) => signature.slice('public.'.length, signature.indexOf('('));
const migrations = () => readdirSync(new URL(`../${MIGRATIONS}/`, import.meta.url)).filter((name) => name.endsWith('.sql')).sort();

/**
 * The forward regression check: every way a later migration could hand one of the six back to a client role. A grant on
 * the function, a re-creation (DROP + CREATE comes back under the hosted default privileges), a change of owner, or a
 * blanket grant / default privilege over every function in `public`.
 */
function reopenings(text) {
  const statements = sql(text);
  const found = [];
  for (const name of SUSPENDED.map(nameOf)) {
    for (const [kind, pattern] of [
      ['GRANT', new RegExp(String.raw`\bGRANT\b[^;]*\b${name}\b`, 'iu')],
      ['CREATE', new RegExp(String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?${name}\b`, 'iu')],
      ['DROP', new RegExp(String.raw`\bDROP\s+FUNCTION\b[^;]*\b${name}\b`, 'iu')],
      ['ALTER', new RegExp(String.raw`\bALTER\s+FUNCTION\s+(?:public\.)?${name}\b`, 'iu')],
    ]) {
      if (pattern.test(statements)) found.push(`${kind} ${name}`);
    }
  }
  if (/\bGRANT\b[^;]*\bON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+public\b[^;]*\bTO\b[^;]*\b(?:PUBLIC|anon|authenticated|service_role)\b/iu.test(statements)) {
    found.push('GRANT ON ALL FUNCTIONS IN SCHEMA public');
  }
  if (/\bALTER\s+DEFAULT\s+PRIVILEGES\b[^;]*\bGRANT\b[^;]*\bON\s+FUNCTIONS\b[^;]*\bTO\b[^;]*\b(?:PUBLIC|anon|authenticated)\b/iu.test(statements)) {
    found.push('ALTER DEFAULT PRIVILEGES GRANT ON FUNCTIONS');
  }
  return found;
}

test('0149 is the forward migration directly after 0148, and the frozen 0108 / 0109 sources are byte-identical', () => {
  const names = migrations();
  assert.ok(names.includes(MIGRATION), `${MIGRATION} exists`);
  assert.equal(names[names.indexOf(MIGRATION) - 1], '0148_shared_semantic_field_living_analysis_v1.sql', '0149 directly follows 0148');
  assert.equal(names.filter((name) => name.startsWith('0149_')).length, 1, 'one migration holds the number');
  // Controlled forward amendment, not an edit: the I-07A sources stay exactly what was frozen.
  assert.equal(sha256(read(`${MIGRATIONS}/0108_matching_participation_private_setup_foundation_v1.sql`)),
    '1459e73dbd3c450e17afdbe3b00a3c8bee9c09bb5ebe53968b476eae63e864bc', '0108 is byte-identical');
  assert.equal(sha256(read(`${MIGRATIONS}/0109_matching_setup_human_authority_commands_v1.sql`)),
    '7edf8e53a9f2f4dffb9468b835f260d39c1fb5e7dd2f582ab5b7301b6fd0bc84', '0109 is byte-identical');
  for (const name of names.filter((n) => n < '0149')) {
    assert.doesNotMatch(read(`${MIGRATIONS}/${name}`), /SEC-MATCH-00/u, `${name} is historical and carries no SEC-MATCH-00 change`);
  }
});

test('0149 changes privileges only, and only by narrowing', () => {
  const statements = sql(read(`${MIGRATIONS}/${MIGRATION}`));
  assert.doesNotMatch(statements, /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE|TABLE|VIEW|POLICY|TRIGGER|ROLE|SCHEMA|INDEX)\b/iu,
    'no object is created');
  assert.doesNotMatch(statements, /\bALTER\s+(?:FUNCTION|TABLE|POLICY|DEFAULT\s+PRIVILEGES|ROLE|SCHEMA)\b|\bDROP\s+\w+/iu,
    'no object, owner, policy or default privilege is altered or dropped');
  assert.doesNotMatch(statements, /\bINSERT\s+INTO\b|\bUPDATE\s+\w+(?:\.\w+)?\s+SET\b|\bDELETE\s+FROM\b|\bTRUNCATE\b/iu, 'no row is written');
  assert.doesNotMatch(statements, /\bGRANT\s+(?:ALL|EXECUTE|USAGE|SELECT|INSERT|UPDATE|DELETE|\w+\s+TO)\b/iu, 'nothing is granted');
  assert.match(statements, /^BEGIN;$/mu);
  assert.match(statements, /^COMMIT;$/mu);
});

test('0149 revokes exactly the six suspended boundaries, from every application role, and none of the five retained', () => {
  const statements = sql(read(`${MIGRATIONS}/${MIGRATION}`));
  const revoke = /REVOKE ALL ON FUNCTION\s+([\s\S]*?)\s+FROM PUBLIC, anon, authenticated;/u.exec(statements);
  assert.ok(revoke, 'one REVOKE names PUBLIC, anon and authenticated');
  assert.deepEqual(revoke[1].split(/,\s*\n\s*/u).map((s) => s.trim()), SUSPENDED, 'and exactly the six signatures, in the frozen 0109 form');
  // The sweep: service_role wherever it exists, then every other non-owner grantee.
  assert.match(statements, /REVOKE ALL ON FUNCTION %s FROM service_role/u);
  assert.match(statements, /a\.grantee <> p\.proowner[\s\S]*REVOKE ALL ON FUNCTION %s FROM %I/u);
  const sweep = /FOREACH boundary IN ARRAY ARRAY\[([\s\S]*?)\]::regprocedure\[\]/u.exec(statements);
  assert.ok(sweep, 'the sweep iterates one explicit list');
  assert.deepEqual([...sweep[1].matchAll(/'([^']+)'/gu)].map((m) => m[1]), SUSPENDED.map((s) => s.replace(/, /gu, ',')),
    'and the sweep list is exactly the six');
  for (const name of RETAINED) {
    for (const match of statements.matchAll(/REVOKE[^;]*;/gu)) {
      assert.ok(!match[0].includes(name), `${name} is never revoked`);
    }
    assert.ok(!sweep[1].includes(name), `${name} is not swept`);
  }
  // The terminal assertions judge effective privilege and refuse every weakened posture.
  for (const assertion of [
    "RAISE EXCEPTION 'SEC-MATCH-00: % must not execute % before a reviewed Stage 6 launch path exists'",
    "RAISE EXCEPTION 'SEC-MATCH-00: % is still granted to %'",
    "RAISE EXCEPTION 'SEC-MATCH-00: authenticated must keep %",
    "RAISE EXCEPTION 'SEC-MATCH-00: an application role can still write Matching setup state through %'",
    "has_function_privilege('public', fn, 'EXECUTE')",
  ]) {
    assert.ok(statements.includes(assertion), `0149 asserts ${assertion}`);
  }
});

test('no later migration reopens, re-creates, re-owns or blanket-grants one of the six (forward regression check)', () => {
  const later = migrations().filter((name) => name > MIGRATION);
  for (const name of later) {
    assert.deepEqual(reopenings(read(`${MIGRATIONS}/${name}`)), [],
      `${name} would hand a suspended Matching setup command back to a client role; a reviewed Stage 6 launch path must amend this contract (QAN-BL-MATCH-01)`);
  }
  // 0149 itself names the six only to revoke them.
  assert.deepEqual(reopenings(read(`${MIGRATIONS}/${MIGRATION}`)), [], '0149 grants, creates, drops and re-owns nothing');
});

test('the forward regression check is not vacuous: every planted reopening is caught', () => {
  for (const [planted, expected] of [
    ['GRANT EXECUTE ON FUNCTION public.activate_matching_participation_v1(uuid, text, uuid) TO authenticated;', 'GRANT activate_matching_participation_v1'],
    ['grant all on function public.set_introduction_profile_v1(uuid, text[], text[], uuid) to anon;', 'GRANT set_introduction_profile_v1'],
    ['DROP FUNCTION public.resume_matching_participation_v1(uuid, uuid);', 'DROP resume_matching_participation_v1'],
    ['CREATE OR REPLACE FUNCTION public.grant_matching_context_v1(p uuid) RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;', 'CREATE grant_matching_context_v1'],
    ['ALTER FUNCTION public.set_matching_requirements_v1(uuid, text[], text[], text[], uuid) OWNER TO authenticated;', 'ALTER set_matching_requirements_v1'],
    ['GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;', 'GRANT ON ALL FUNCTIONS IN SCHEMA public'],
    ['ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;', 'ALTER DEFAULT PRIVILEGES GRANT ON FUNCTIONS'],
  ]) {
    assert.ok(reopenings(planted).includes(expected), `the check catches: ${planted}`);
  }
  // ... and a comment that merely explains the rule is not a reopening.
  assert.deepEqual(reopenings('-- never GRANT EXECUTE ON FUNCTION public.activate_matching_participation_v1 again\nSELECT 1;'), []);
  // ... and the retained five may be granted by a later reviewed migration without tripping it.
  assert.deepEqual(reopenings('GRANT EXECUTE ON FUNCTION public.pause_matching_participation_v1(uuid, uuid) TO authenticated;'), []);
});

test('the 0149 verifier proves the contract scenarios under real roles, with rolled-back fixtures', () => {
  const verifier = read('database/verify-migration-0149.mjs');
  for (const proof of [
    'process.env.DATABASE_URL', 'createScenarioReport',
    'DIRECT_RPC_DENY the six are executable by no application role',
    'DIRECT_RPC_DENY every application role is refused all six, fresh human',
    'DIRECT_RPC_DENY an existing human cannot widen or correct their setup',
    'NEW_FOOTPRINT_ZERO a fresh human who tries all eleven boundaries commits nothing',
    'SELF_INSPECTION_ALLOWED', 'EXISTING_TURN_OFF_ALLOWED', 'EXISTING_REVOKE_ALLOWED', 'OWNER_ONLY', 'IDEMPOTENT_RETRY',
    'X01 two concurrent retained commands of one human serialize on the caller own lock row',
    'NO_BACKDOOR', 'DELETION_BASELINE_UNCHANGED', 'HOSTED_DEFAULT_PRIVILEGES', 'BODIES_UNCHANGED',
    'f1 the terminal assertion refuses a posture in which authenticated inherits the owner',
    'f2 the regression check refuses a reopened direct grant',
    'f3 the census refuses a client-executable wrapper around a suspended command',
    "asRole('authenticated'", 'report.probe(', 'report.assertAllPassed()',
    'every fixture this verifier created was rolled back or removed',
  ]) {
    assert.ok(verifier.includes(proof), `the 0149 verifier is missing ${proof}`);
  }
  assert.doesNotMatch(verifier, /supabase\.co|postgres(?:ql)?:\/\//iu, 'no connection detail is embedded');
  const support = read('database/matching-setup-verifier-support.mjs');
  assert.match(support, /export const SEC_MATCH_00_SUSPENDED = \[\n\s+MFN\.ACTIVATE, MFN\.RESUME, MFN\.GRANT_CONTEXT, MFN\.SET_PROFILE, MFN\.SET_REQUIREMENTS, MFN\.GRANT_DISCLOSURE,\n\];/u);
  assert.match(support, /export const SEC_MATCH_00_RETAINED = \[MFN\.PAUSE, MFN\.TURN_OFF, MFN\.REVOKE_CONTEXT, MFN\.REVOKE_DISCLOSURE, MFN\.SETUP\];/u);
});

test('the re-anchored 0109 verifier keeps its historical I-07A checks and names the amendment', () => {
  const verifier = read('database/verify-migration-0109.mjs');
  assert.match(verifier, /assert\.equal\(await rt\.canExecute\('authenticated', fn\), !SEC_MATCH_00_SUSPENDED\.includes\(fn\),/u,
    'only the current authenticated grant is re-anchored');
  assert.match(verifier, /for \(const role of \['public', 'anon', 'service_role'\]\) \{\n\s+assert\.equal\(await rt\.canExecute\(role, fn\), false, `G02 \$\{role\} must not execute \$\{fn\}`\);/u,
    'PUBLIC, anon and service_role are still refused all eleven');
  assert.match(verifier, /assert\.equal\(posture\.secdef, true, `G01 \$\{fn\} is SECURITY DEFINER`\);/u, 'the definer posture check stands');
  assert.match(verifier, /SEC-MATCH-00 controlled forward amendment \(migration 0149\)/u);
});

test('the verifier and the wire proof are wired into the toolchain, API CI and the database README', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.scripts['verify:matching-setup-direct-rpc-narrowing:integration'],
    'node --env-file-if-exists=.env database/verify-migration-0149.mjs');
  assert.equal(packageJson.scripts['prove:matching-direct-rpc-refusal:postgrest'],
    'node --env-file-if-exists=.env database/prove-0149-matching-direct-rpc-postgrest.mjs');
  assert.equal(packageJson.scripts['test:sec-match-00-matching-direct-rpc-protection-contract'],
    'node --test tests/sec-match-00-matching-direct-rpc-protection-contract.test.mjs');
  const workflow = read('.github/workflows/api-ci.yml');
  assert.equal((workflow.match(/npm run verify:matching-setup-direct-rpc-narrowing:integration/gu) ?? []).length, 1, 'registered once in API CI');
  assert.ok(workflow.indexOf('npm run verify:matching-setup-direct-rpc-narrowing:integration') > workflow.indexOf('name: Apply all migrations to fresh PostgreSQL'),
    'the verifier runs after fresh migrations are applied');
  const wire = workflow.indexOf('npm run --silent prove:matching-direct-rpc-refusal:postgrest');
  assert.ok(wire > workflow.indexOf('docker run -d --rm --name "postgrest-$version"') && wire < workflow.indexOf('docker stop "postgrest-$version"'),
    'the wire proof runs against every live PostgREST line, inside the loop');
  assert.match(workflow, /run: npm run test:sec-match-00-matching-direct-rpc-protection-contract/u);
  const readme = read('database/README.md');
  assert.match(readme, /## SEC-MATCH-00 - Matching setup pre-launch direct-execute narrowing \(migration 0149\)/u);
  assert.match(readme, /npm run verify:matching-setup-direct-rpc-narrowing:integration/u);
});

test('the canonical records carry the amendment, and QAN-BL-ACCT-01 stays open', () => {
  const runtime = read('docs/matching-introduction-runtime-v1.md');
  assert.match(runtime, /^## 47\. `SEC-MATCH-00` — controlled forward amendment to the `I-07A` direct-execute surface$/mu);
  assert.match(runtime, /^\*\*Phase:\*\* `I-07 — Introductions \/ Matching Runtime` — \*\*CLOSED \/ FROZEN\*\*$/mu, 'the phase banner is unchanged');
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  assert.match(backlog, /^\| `QAN-BL-ACCT-01` \| Account Deletion Across Connected Worlds — Explicit Connected-Worlds Deletion Blocker \| `UNASSIGNED` \| `HIGH` \| `OPEN — UNASSIGNED` \|$/mu,
    'QAN-BL-ACCT-01 is not closed or absorbed');
  assert.match(backlog, /^\| `QAN-BL-MATCH-01` \| .* \| `S6-01 — Intelligent Matching Onboarding` \| `HIGH` \| `DEFERRED — OWNED` \|$/mu);
  assert.match(backlog, /^### `QAN-BL-MATCH-01` — /mu);
  assert.match(backlog, /\*\*Current-truth note \(SEC-MATCH-00, 2026-10-09; implemented, not merged\)\.\*\*/u);
  const record = read('docs/e2e/QANDEEL_SEC_MATCH_00_MATCHING_DIRECT_RPC_PROTECTION_IMPLEMENTATION_RECORD_v1.md');
  for (const required of ['APPROVE_C2_PATCH_B', 'NOT_DEPLOYED', 'QAN-BL-ACCT-01', 'QAN-BL-MATCH-01', '## 11. Deployment requirement']) {
    assert.ok(record.includes(required), `the record states ${required}`);
  }
});
