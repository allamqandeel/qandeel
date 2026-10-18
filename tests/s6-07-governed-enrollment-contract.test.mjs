// S6-07 (CP1) - static contract for the governed Matching enrollment (migration 0165).
//
// The real behaviour is proven against PostgreSQL (database/verify-migration-0165.mjs) and on the wire through every live
// PostgREST line (database/prove-0165-governed-enrollment-postgrest.mjs). This contract pins the shape those proofs rely
// on, so a later edit cannot quietly widen it: ONE named authenticated boundary is the only function besides the six that
// names them; none of the six is granted, re-created, dropped or re-owned; no gate row and no consent text is installed;
// the canonical facts reader requires the promotion record; the census verifiers name the exception exactly; the API is
// two owner-only routes on the caller's token; and the proofs are wired into CI. Each detector is shown to catch a
// planted defect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const sql = (text) => text.replace(/--[^\n]*/gu, '');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/[^\n]*/gu, '$1');
const MIGRATIONS = 'database/migrations';
const M0165 = '0165_matching_governed_enrollment_v1.sql';
const SIX = ['activate_matching_participation_v1', 'resume_matching_participation_v1', 'grant_matching_context_v1',
  'set_introduction_profile_v1', 'set_matching_requirements_v1', 'grant_pre_match_disclosure_authority_v1'];
const API = 'apps/api/src/introductions-enrollment';

const shipped = () => ({
  migration: read(`${MIGRATIONS}/${M0165}`),
  migrations: readdirSync(new URL(`../${MIGRATIONS}/`, import.meta.url)).filter((n) => n.endsWith('.sql')).sort(),
  verify0149: read('database/verify-migration-0149.mjs'),
  verify0150: read('database/verify-migration-0150.mjs'),
  verify0156: read('database/verify-migration-0156.mjs'),
  repository: read(`${API}/introductions-enrollment.repository.ts`),
  service: read(`${API}/introductions-enrollment.service.ts`),
  controller: read(`${API}/introductions-enrollment.controller.ts`),
  module: read(`${API}/introductions-enrollment.module.ts`),
  account: read('apps/api/src/account/account.module.ts'),
  census: read('apps/api/src/http-security/route-rate-limit.census.ts'),
  workflow: read('.github/workflows/api-ci.yml'),
  packageJson: read('package.json'),
});

/** The function bodies of a migration, by name: the text between AS $$ and the closing $$. */
function bodies(text) {
  const out = {};
  for (const match of text.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([a-z_]+\.[a-z0-9_]+)\(/gu)) {
    const tail = text.slice(match.index);
    const open = tail.indexOf('AS $$') + 'AS $$'.length;
    out[match[1]] = tail.slice(open, tail.indexOf('$$', open));
  }
  return out;
}

function migrationViolations(w) {
  const out = [];
  const statements = sql(w.migration);
  const fns = bodies(w.migration);
  if (w.migrations[w.migrations.indexOf(M0165) - 1] !== '0164_account_deletion_matching_introductions_v1.sql') out.push('0165 directly follows 0164');
  for (const name of SIX) {
    for (const [kind, pattern] of [
      ['GRANT', new RegExp(String.raw`\bGRANT\b[^;]*\b${name}\b`, 'iu')],
      ['CREATE', new RegExp(String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?${name}\b`, 'iu')],
      ['DROP', new RegExp(String.raw`\bDROP\s+FUNCTION\b[^;]*\b${name}\b`, 'iu')],
      ['ALTER', new RegExp(String.raw`\bALTER\s+FUNCTION\s+(?:public\.)?${name}\b`, 'iu')],
    ]) if (pattern.test(statements)) out.push(`0165 must never ${kind} ${name}`);
  }
  const naming = Object.entries(fns).filter(([, body]) => SIX.some((name) => new RegExp(String.raw`\b${name}\b`, 'u').test(body))).map(([n]) => n);
  if (JSON.stringify(naming) !== JSON.stringify(['public.enroll_my_matching_setup_v1'])) out.push(`exactly one function names a suspended command (got ${naming})`);
  const boundary = sql(fns['public.enroll_my_matching_setup_v1'] ?? '');
  if (/\bgrant_pre_match_disclosure_authority_v1\b/u.test(boundary)) out.push('the boundary never calls the field-bearing disclosure grant');
  if (!/u uuid := auth\.uid\(\);/u.test(boundary)) out.push('the boundary derives its human from auth.uid()');
  if (!/WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN/u.test(boundary) || /ERRCODE = '(?:40001|PT409)'/u.test(boundary)) out.push('the boundary absorbs 40001 / PT409 and raises neither');
  if (/\bEXECUTE\s/iu.test(boundary) || /\bRAISE;/u.test(boundary)) out.push('the boundary runs no dynamic SQL and re-raises nothing');
  if (/INSERT\s+INTO\s+public\.matching_/iu.test(boundary)) out.push('the boundary writes no I-07 relation directly (0149 NO OTHER WRITER)');
  const grants = [...statements.matchAll(/\bGRANT\b[^;]*;/giu)].map((m) => m[0].replace(/\s+/gu, ' '));
  if (grants.length !== 1 || !/GRANT EXECUTE ON FUNCTION public\.enroll_my_matching_setup_v1\(uuid, text, bigint, text, text, text\), public\.read_my_matching_enrollment_v1\(\) TO authenticated;/u.test(grants[0])) {
    out.push(`exactly one GRANT, of the boundary and the read, to authenticated (got ${grants})`);
  }
  if (/\bTO\s+(?:service_role|anon|PUBLIC)\b/iu.test(statements)) out.push('nothing is granted to service_role, anon or PUBLIC');
  if (/ALTER\s+DEFAULT\s+PRIVILEGES|GRANT[^;]*ON\s+ALL\s+FUNCTIONS/iu.test(statements)) out.push('no default or blanket privilege');
  if (/INSERT INTO matching_enrollment_private\.gate_states\s*\(/u.test(statements.replace(/CREATE FUNCTION[\s\S]*?\$\$;/gu, ''))) out.push('no gate row is installed');
  if (/INSERT INTO matching_enrollment_private\.consent_texts[^;]*VALUES\s*\('/u.test(statements)) out.push('no consent text is installed (Copy Gate)');
  if (!/JOIN matching_enrollment_private\.fact_promotions p\s+ON p\.fact_version_id = f\.id AND p\.user_id = f\.owner_user_id/u.test(fns['public.resolve_matching_confirmed_facts_v1'] ?? '')) {
    out.push('the canonical facts reader requires the promotion record (CW2-06B-02 §5)');
  }
  for (const core of ['public.set_empty_matching_requirements_core_v1', 'public.grant_zero_field_pre_match_disclosure_authority_core_v1']) {
    if (/auth\.uid|INSERT INTO public\.pre_match_disclosure_authority_fields|INSERT INTO public\.matching_requirement_items/u.test(fns[core] ?? 'missing')) {
      out.push(`${core} reads no session identity and writes no field or item row`);
    }
  }
  if (!/\('matching_enrollment_private\.command_ledger', 'ACCOUNT_CASCADE'\),\n {2}\('matching_enrollment_private\.enrollment_acts', 'ACCOUNT_CASCADE'\),\n {2}\('matching_enrollment_private\.fact_promotions', 'ACCOUNT_CASCADE'\);/u.test(w.migration)) {
    out.push('the three evidence relations are registered ACCOUNT_CASCADE for the governed erasure');
  }
  if (/ON DELETE RESTRICT/u.test(statements.replace(/REFERENCES matching_enrollment_private\.(?:gate_states|consent_texts) \([a-z_]+\) ON DELETE RESTRICT/gu, ''))) {
    out.push('only the gate and consent-text references restrict; every account reference cascades');
  }
  return out;
}

function censusViolations(w) {
  const out = [];
  if (!w.verify0149.includes("const S6_07_GOVERNED_ENROLLMENT = 'public.enroll_my_matching_setup_v1(uuid, text, bigint, text, text, text)';")) out.push('0149 names the exception by exact signature');
  if (!/\.\.\.S6_06_INTRODUCTION_CONTINUATION\.map\(nameOf\), nameOf\(S6_07_GOVERNED_ENROLLMENT\)\]\.sort\(\)/u.test(w.verify0149)) out.push('0149 NO_BACKDOOR admits it once');
  if (!/f\.proname !== nameOf\(S6_07_GOVERNED_ENROLLMENT\)/u.test(w.verify0149)) out.push('0149 "names a suspended boundary" admits only it');
  for (const probe of ['f14 the census refuses a second client-executable wrapper around the enrollment boundary',
    'f15 the census refuses the enrollment boundary granted beyond authenticated',
    'f16 the census refuses a client-executable wrapper around the 0156 facts writer',
    'f17 the census refuses an internal enrollment core granted to a client role']) if (!w.verify0149.includes(probe)) out.push(`0149 probe: ${probe}`);
  if (!/ {2}'enroll_my_matching_setup_v1',\n\];/u.test(w.verify0150)) out.push('0150 ABSORBED names the boundary');
  if (!w.verify0156.includes("['enroll_my_matching_setup_v1(uuid,text,bigint,text,text,text)']")) out.push('0156 A02 admits exactly the boundary as the writer\'s one wrapper');
  return out;
}

function apiViolations(w) {
  const out = [];
  const rpcs = [...w.repository.matchAll(/'rpc\/([a-z0-9_]+)'/gu)].map((m) => m[1]).sort();
  if (JSON.stringify(rpcs) !== JSON.stringify(['enroll_my_matching_setup_v1', 'read_my_matching_enrollment_v1'])) out.push(`exactly the two 0165 entry points (got ${rpcs})`);
  if (/ServiceRole|service_role'|SUPABASE_SERVICE_ROLE/u.test(code(w.repository) + code(w.service) + code(w.module))) out.push('no service_role path');
  if (/p_user|user_?id|userId/iu.test(code(w.repository))) out.push('no account parameter reaches the database');
  const routes = [...w.controller.matchAll(/@(Get|Post)\('([^']+)'\)/gu)].map((m) => `${m[1].toUpperCase()} /introductions/${m[2]}`).sort();
  if (JSON.stringify(routes) !== JSON.stringify(['GET /introductions/enrollment', 'POST /introductions/enrollment'])) out.push(`exactly two routes (got ${routes})`);
  if (!w.census.includes("'GET /introductions/enrollment': 'AUTHENTICATED',") || !w.census.includes("'POST /introductions/enrollment': 'SECURITY_SENSITIVE',")) out.push('the route census classes');
  if ((w.account.match(/\bIntroductionsEnrollmentModule\b/gu) ?? []).length < 2 || !/IntroductionsContinuationModule, IntroductionsEnrollmentModule\]/u.test(w.account)) out.push('composed once through AccountModule');
  if (!/exactKeys\(body, \['commandId', 'kind', 'expectedDraftVersion', 'consents'\]\)/u.test(w.service)) out.push('the exact request shape');
  return out;
}

function wiringViolations(w) {
  const out = [];
  for (const [script, file] of [['verify:matching-governed-enrollment:integration', 'database/verify-migration-0165.mjs'],
    ['prove:governed-enrollment:postgrest', 'database/prove-0165-governed-enrollment-postgrest.mjs'],
    ['test:s6-07-governed-enrollment-contract', 'tests/s6-07-governed-enrollment-contract.test.mjs']]) {
    if (!w.packageJson.includes(`"${script}": "`) || !w.packageJson.includes(file)) out.push(`package.json ${script}`);
  }
  if (!w.workflow.includes('run: npm run verify:matching-governed-enrollment:integration')) out.push('CI runs verify-0165');
  if (!w.workflow.includes('run: npm run test:s6-07-governed-enrollment-contract}')) out.push('CI runs this contract');
  const wire = w.workflow.indexOf('npm run --silent prove:governed-enrollment:postgrest');
  if (!(wire > w.workflow.indexOf('docker run -d --rm --name "postgrest-$version"') && wire < w.workflow.indexOf('docker stop "postgrest-$version"'))) out.push('the wire proof runs inside the PostgREST loop');
  return out;
}

const DETECTORS = { migrationViolations, censusViolations, apiViolations, wiringViolations };
const plant = (key, from, to) => {
  const w = shipped();
  assert.ok(w[key].includes(from), `planted anchor exists in ${key}: ${from.slice(0, 60)}`);
  return { ...w, [key]: w[key].replace(from, to) };
};

test('1 - the shipped migration, census verifiers, API and wiring hold every property', () => {
  const w = shipped();
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(w), [], name);
});

test('2 - every detector catches a planted defect', () => {
  for (const [label, detector, world] of [
    ['a direct grant of a suspended command', 'migrationViolations', () => plant('migration', 'GRANT EXECUTE ON FUNCTION\n  public.enroll_my_matching_setup_v1',
      'GRANT EXECUTE ON FUNCTION public.activate_matching_participation_v1(uuid, text, uuid) TO authenticated;\nGRANT EXECUTE ON FUNCTION\n  public.enroll_my_matching_setup_v1')],
    ['the boundary granted to service_role', 'migrationViolations', () => plant('migration', '  public.read_my_matching_enrollment_v1()\n  TO authenticated;',
      '  public.read_my_matching_enrollment_v1()\n  TO authenticated, service_role;')],
    ['a core naming a suspended command', 'migrationViolations', () => plant('migration', "    RAISE EXCEPTION 'MATCHING_AUTHORITY_ID_INVALID' USING ERRCODE = '22023';",
      "    PERFORM 1 FROM public.grant_matching_context_v1(NULL, NULL, NULL);\n    RAISE EXCEPTION 'MATCHING_AUTHORITY_ID_INVALID' USING ERRCODE = '22023';")],
    ['the 40001 handler removed', 'migrationViolations', () => plant('migration', "    WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN", '    WHEN serialization_failure THEN')],
    ['the evidence join removed', 'migrationViolations', () => plant('migration', '    JOIN matching_enrollment_private.fact_promotions p\n      ON p.fact_version_id = f.id AND p.user_id = f.owner_user_id\n', '')],
    ['a consent text seeded', 'migrationViolations', () => plant('migration', '-- 9. DELETION COVERAGE',
      "INSERT INTO matching_enrollment_private.consent_texts (consent_version, purpose, text_ar, text_en, sha256_ar, sha256_en, is_current) VALUES ('X_V1', 'MATCHING_PARTICIPATION', 'a', 'b', 'c', 'd', true);\n-- 9. DELETION COVERAGE")],
    ['an account reference that restricts', 'migrationViolations', () => plant('migration', 'CONSTRAINT fact_promotions_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE',
      'CONSTRAINT fact_promotions_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT')],
    ['the census exception generalized', 'censusViolations', () => plant('verify0149', 'f.proname !== nameOf(S6_07_GOVERNED_ENROLLMENT)', "!f.proname.startsWith('enroll_')")],
    ['the absorber dropped', 'censusViolations', () => plant('verify0150', "  'enroll_my_matching_setup_v1',\n];", '];')],
    ['a third route', 'apiViolations', () => plant('controller', "  @Post('enrollment')", "  @Post('enrollment/admin')\n  admin() { return null; }\n\n  @Post('enrollment')")],
    ['a service_role call', 'apiViolations', () => plant('repository', 'constructor(private readonly dataApi: SupabaseDataApiService) {}',
      'constructor(private readonly dataApi: SupabaseDataApiService, private readonly serviceRole: SupabaseServiceRoleApiService) {}')],
    ['the wire proof outside the loop', 'wiringViolations', () => plant('workflow', '            POSTGREST_VERSION="$version" npm run --silent prove:governed-enrollment:postgrest', '            echo skipped')],
  ]) {
    assert.notDeepEqual(DETECTORS[detector](world()), [], `the contract catches: ${label}`);
  }
});

test('3 - 0165 changes no frozen source: 0108, 0109, 0149, 0150, 0154, 0156 and 0164 stay byte-identical in the tree', () => {
  // The bytes of the historical migrations are pinned by their own contracts (sec-match-00, s6-01, s6-03, acct-del-01);
  // here: 0165 re-creates exactly one earlier function, the canonical facts reader, and nothing else.
  const replaced = [...sql(read(`${MIGRATIONS}/${M0165}`)).matchAll(/CREATE OR REPLACE FUNCTION ([a-z_]+\.[a-z0-9_]+)\(/gu)].map((m) => m[1]);
  assert.deepEqual(replaced, ['public.resolve_matching_confirmed_facts_v1']);
  assert.doesNotMatch(sql(read(`${MIGRATIONS}/${M0165}`)), /\bALTER TABLE public\.|\bDROP\s+(?:TABLE|FUNCTION|TRIGGER|CONSTRAINT)\b/iu,
    'no earlier relation is altered and nothing is dropped');
});
