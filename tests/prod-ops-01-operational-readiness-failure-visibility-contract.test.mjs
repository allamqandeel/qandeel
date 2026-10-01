// PROD-OPS-01 - static source contract for Operational Readiness & Silent-Failure Visibility.
//
// Real behaviour is proven by database/verify-migration-0132.mjs (PostgreSQL), database/prove-0132-readiness-postgrest.mjs
// (live PostgREST, the API's compiled probe and repository) and the API specs. This contract pins the shape a refactor
// could silently erode, and every detector is proven to reject the planted defect the task names (§13).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
/** Source without comments, so a rule about code is never tripped by prose that explains the rule. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/.*$/gmu, '$1');
const sql = (text) => text.replace(/--.*$/gmu, '');

const FILES = {
  probe: 'apps/api/src/health/database-health.probe.ts',
  healthService: 'apps/api/src/health/health.service.ts',
  healthModule: 'apps/api/src/health/health.module.ts',
  worker: 'apps/api/src/account/privacy-maintenance.worker.ts',
  repository: 'apps/api/src/account/privacy-maintenance.repository.ts',
  understanding: 'apps/api/src/understanding/understanding.service.ts',
  telemetry: 'apps/api/src/observability/telemetry.service.ts',
  failure: 'apps/api/src/observability/operational-failure.ts',
  migration: 'database/migrations/0132_operational_readiness_failure_visibility_v1.sql',
  m0130: 'database/migrations/0130_personal_privacy_export_account_deletion_v1.sql',
};
const shipped = Object.fromEntries(Object.entries(FILES).map(([key, path]) => [key, read(path)]));
const plant = (key, from, to) => {
  assert.ok(shipped[key].includes(from), `planting anchor missing in ${key}: ${from}`);
  return { ...shipped, [key]: shipped[key].replace(from, to) };
};
const fn = (text, header) => {
  const start = text.indexOf(header);
  if (start < 0) return '';
  const open = text.indexOf('$$', start);
  return text.slice(start, text.indexOf('$$', open + 2) + 2);
};

// ---------------------------------------------------------------------------------------------------------------
// Detectors. Each returns a list of violations (empty = compliant).
// ---------------------------------------------------------------------------------------------------------------

function readinessViolations(w) {
  const out = [];
  const probe = code(w.probe);
  if (/\/rest\/v1\/`|\/rest\/v1\/'|method:'HEAD'/u.test(probe)) out.push('the probe still targets the Data API root');
  if (!/\/rest\/v1\/rpc\/\$\{DATABASE_READINESS_RPC\}/u.test(probe) || !/DATABASE_READINESS_RPC='server_database_ready_v1'/u.test(probe)) out.push('the probe does not call the readiness RPC');
  if (/SUPABASE_PUBLISHABLE_KEY|SUPABASE_ANON_KEY/u.test(probe) || !/SUPABASE_SERVICE_ROLE_KEY/u.test(probe)) out.push('the probe does not use the canonical server credential');
  if (!/response\.status!==200\)return'unavailable'/u.test(probe) || !/answer\.trim\(\)==='true'\?'available':'unavailable'/u.test(probe)) out.push('available is not the exact successful answer');
  if (/return\s*(?:answer|response)\b(?!!==null&&answer\.trim\(\)==='true'\?'available':'unavailable';)|JSON\.parse|console\./u.test(probe)) out.push('the probe can leak the upstream answer');
  if (!/readBounded\(response,MAX_READINESS_ANSWER_BYTES\)/u.test(probe) || !/if\(total>limit\)\{await reader\.cancel\(\)/u.test(probe)) out.push('the readiness answer is read without a bound');
  if (!/return this\.inflight\?\?=this\.probe\(\)/u.test(probe) || !/DATABASE_READINESS_REUSE_MS=1000;/u.test(probe)) out.push('unauthenticated readiness checks are not coalesced (database amplification)');
  const ready = sql(fn(w.migration, 'CREATE FUNCTION public.server_database_ready_v1()'));
  if (!/RETURNS boolean\s+LANGUAGE sql\s+STABLE\s+SECURITY INVOKER\s+SET search_path = ''\s+AS \$\$ SELECT true \$\$/u.test(ready)) out.push('the readiness RPC is not a read-only, row-free `SELECT true`');
  if (/\bFROM\b|INSERT|UPDATE|DELETE/iu.test(ready)) out.push('the readiness RPC reads or writes a table');
  const m = sql(w.migration);
  if (!/REVOKE ALL ON FUNCTION public\.server_database_ready_v1\(\) FROM PUBLIC, anon, authenticated;/u.test(m)) out.push('the readiness RPC is not revoked from clients');
  if (/GRANT EXECUTE ON FUNCTION public\.server_database_ready_v1\(\) TO (?!service_role;)/u.test(m) || !/GRANT EXECUTE ON FUNCTION public\.server_database_ready_v1\(\) TO service_role;/u.test(m)) out.push('the readiness RPC is executable by a client role');
  return out;
}

function healthIsolationViolations(w) {
  const out = [];
  const health = code(w.healthService) + code(w.healthModule);
  if (/privacy|PrivacyMaintenance|AccountModule|TelemetryService|server_read_privacy_operations_summary/u.test(health)) out.push('operational / stuck state is wired into /health/ready');
  if (!/const requiredReady=database==='available'&&modelProvider==='configured';/u.test(code(w.healthService))) out.push('readiness requires more than the database and model provider');
  return out;
}

const ID_IN_SIGNAL = /(?:recordOperationalOutcome|recordPrivacyOperationState|recordPrivacyExportRecentFailures|this\.signal|recordReevaluation)\([^;]*(?:deletion\.|deletionId|userId|hypothesisId|evaluationId|\.message|String\(error|error\.name|databaseCode|status\b)/u;

function telemetryContentViolations(w) {
  const out = [];
  for (const key of ['worker', 'understanding']) {
    if (ID_IN_SIGNAL.test(code(w[key]))) out.push(`${key} passes an identifier or error text to telemetry`);
    if (/console\.|Logger|captureException/u.test(code(w[key]))) out.push(`${key} logs a private workflow`);
  }
  const t = code(w.telemetry);
  for (const literal of [
    "['PRIVACY_EXPORT',new Map([['prepare',new Set(['success',...OPERATION_FAILURES])],['stuck_scan',new Set(['success',...OPERATION_FAILURES])]])],",
    "['UNDERSTANDING_CONFIDENCE',new Map([['confidence_reevaluate',new Set(['success','retry_pending'])]])],",
    "const OPERATION_FAILURES=['transport_failure','integrity_failure'] as const;",
    "const OPERATIONAL_FAILURE_CLASSES:ReadonlySet<string>=new Set(['TRANSPORT','INTEGRITY']);",
    "const PRIVACY_EXPORT_FAILURE_CLASSES:ReadonlySet<string>=new Set(['TRANSIENT_DATABASE','CONSTRAINT_OR_INTEGRITY','RESOURCE_OR_CAPACITY','INTERNAL_OTHER']);",
    "if(!OPERATIONAL_OUTCOMES.get(domain)?.get(operation)?.has(outcome))return;",
  ]) if (!t.includes(literal)) out.push(`the finite registry drifted: ${literal.slice(0, 60)}`);
  if (/sqlstate|databaseCode|databaseMessage/iu.test(t + code(w.failure).replace(/import[^;]+;/gu, ''))) out.push('a database code can reach a label');
  if (/\.message\b/u.test(code(w.failure))) out.push('the failure class reads an error message');
  return out;
}

function failSoftViolations(w) {
  const out = [];
  const worker = code(w.worker);
  if (!/private signal\(domain: Domain, operation: string, outcome: string\): void \{\n\s+this\.quietly\(\(\) => this\.telemetry\.recordOperationalOutcome\(domain, operation, outcome\)\);/u.test(worker)) out.push('a worker signal is not fail-soft');
  if ((worker.match(/this\.telemetry\./gu) ?? []).length !== 1 || !/this\.quietly\(\(\) => \{\n\s+const t = this\.telemetry;/u.test(worker)) out.push('the worker reaches telemetry outside the fail-soft wrapper');
  const understanding = code(w.understanding);
  if (!/try \{\n\s+this\.telemetry\.recordOperationalOutcome\('UNDERSTANDING_CONFIDENCE', 'confidence_reevaluate', outcome, failureClass\);\n\s+\} catch \{/u.test(understanding)) out.push('the Understanding signal is not fail-soft');
  return out;
}

function semanticsViolations(w) {
  const out = [];
  const worker = code(w.worker);
  if (/\battempts?\b|maxAttempts|MAX_ATTEMPT|\bretries\b|giveUp/iu.test(worker)) out.push('the deletion pass gained an attempt cutoff');
  if (!/outcome === 'BLOCKED' \? 'blocked_expected'/u.test(worker)) out.push('BLOCKED is not the expected answer');
  const m = sql(w.migration);
  if (/CREATE (?:OR REPLACE )?FUNCTION personal_data_private\.(?:claim_due_account_deletions_v1|erase_personal_account_v1|complete_account_deletion_v1)|ALTER TABLE personal_data_private\.account_deletions/u.test(m)) out.push('deletion semantics are redefined');
  // The preparation pass is 0130's, plus only the marked additions.
  const strip = (body) => sql(body).replace(/\s+v_sqlstate text;|,\s+failure_class = NULL,\s+last_failure_at = NULL|\s+GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;|,\s+failure_class = personal_data_private\.export_failure_class_v1\(v_sqlstate\),\s+last_failure_at = clock_timestamp\(\)/gu, '').replace(/CREATE (?:OR REPLACE )?FUNCTION/u, 'CREATE FUNCTION').replace(/\s+/gu, ' ');
  const before = strip(fn(w.m0130, 'CREATE FUNCTION personal_data_private.prepare_data_exports_v1(p_limit integer)'));
  const after = strip(fn(w.migration, 'CREATE OR REPLACE FUNCTION personal_data_private.prepare_data_exports_v1(p_limit integer)'));
  if (!before || before !== after) out.push('export preparation semantics changed beyond the classification');
  const prepare = fn(m, 'CREATE OR REPLACE FUNCTION personal_data_private.prepare_data_exports_v1(p_limit integer)');
  if (/SQLERRM|MESSAGE_TEXT|PG_EXCEPTION_DETAIL|failure_class = v_sqlstate/u.test(prepare)) out.push('raw SQL error text or a raw SQLSTATE is persisted');
  const summary = sql(fn(w.migration, 'CREATE FUNCTION public.server_read_privacy_operations_summary_v1()'));
  if (/BLOCKED|uuid|user_id\b(?!\s)|\bid\b/u.test(summary.replace(/RETURNS TABLE \([\s\S]*?\)\s+LANGUAGE/u, ''))) out.push('the summary counts BLOCKED or returns an identity');
  const understanding = code(w.understanding);
  const reevaluate = understanding.match(/private async reevaluateConfidence\([\s\S]*?\n {2}\}/u)?.[0] ?? '';
  if ((reevaluate.match(/ensureHypothesisVersionEvaluation/gu) ?? []).length !== 1 || /for \(|while|setTimeout|setInterval|retry\(/u.test(reevaluate)) out.push('an automatic Confidence retry was added');
  return out;
}

const DETECTORS = { readinessViolations, healthIsolationViolations, telemetryContentViolations, failSoftViolations, semanticsViolations };

test('the shipped corrective is clean under every detector', () => {
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(shipped), [], name);
});

const PLANTED = [
  ['readiness probe still calling the /rest/v1/ root', 'readinessViolations', () => plant('probe', '`${base}/rest/v1/rpc/${DATABASE_READINESS_RPC}`', '`${base}/rest/v1/`')],
  ['readiness probe on the publishable key', 'readinessViolations', () => plant('probe', 'key=process.env.SUPABASE_SERVICE_ROLE_KEY', 'key=process.env.SUPABASE_PUBLISHABLE_KEY')],
  ['readiness RPC executable by anon', 'readinessViolations', () => plant('migration', 'GRANT EXECUTE ON FUNCTION public.server_database_ready_v1() TO service_role;', 'GRANT EXECUTE ON FUNCTION public.server_database_ready_v1() TO anon, service_role;')],
  ['readiness RPC executable by authenticated (not revoked)', 'readinessViolations', () => plant('migration', 'REVOKE ALL ON FUNCTION public.server_database_ready_v1() FROM PUBLIC, anon, authenticated;', 'REVOKE ALL ON FUNCTION public.server_database_ready_v1() FROM PUBLIC, anon;')],
  ['readiness response leaking the upstream body', 'readinessViolations', () => plant('probe', "return answer!==null&&answer.trim()==='true'?'available':'unavailable';", 'return answer as never;')],
  ['readiness body read without a bound', 'readinessViolations', () => plant('probe', 'const answer=await readBounded(response,MAX_READINESS_ANSWER_BYTES);', 'const answer=await response.text();')],
  ['every unauthenticated readiness call reaching the database', 'readinessViolations', () => plant('probe', 'return this.inflight??=this.probe()', 'return this.probe()')],
  ['readiness depending on a table / user row', 'readinessViolations', () => plant('migration', 'AS $$ SELECT true $$;', 'AS $$ SELECT EXISTS (SELECT 1 FROM public.users) $$;')],
  ['readiness mutating the database', 'readinessViolations', () => plant('migration', 'AS $$ SELECT true $$;', 'AS $$ UPDATE public.users SET name = name; SELECT true $$;')],
  ['readiness accepting any 2xx', 'readinessViolations', () => plant('probe', "if(response.status!==200)return'unavailable';", "if(!response.ok)return'unavailable';")],
  ['stuck-state metrics wired into required /health/ready', 'healthIsolationViolations', () => plant('healthModule', "imports:[RuntimeEventsModule]", "imports:[RuntimeEventsModule,AccountModule]")],
  ['maintenance telemetry carrying a deletion id', 'telemetryContentViolations', () => plant('worker', "this.signal('ACCOUNT_DELETION', 'erase', 'success');", "this.signal('ACCOUNT_DELETION', 'erase', deletion.deletionId);")],
  ['exception text used as a label', 'telemetryContentViolations', () => plant('worker', "this.signal('ACCOUNT_DELETION', step, step === 'provider_remove' ? 'provider_unavailable' : failureOutcome(error));", "this.signal('ACCOUNT_DELETION', step, (error as Error).message);")],
  ['a hypothesis id in the Confidence signal', 'telemetryContentViolations', () => plant('understanding', "this.recordReevaluation('success');", "this.recordReevaluation(hypothesisId as never);")],
  ['console.error(error) on a private workflow path', 'telemetryContentViolations', () => plant('worker', '// The database lease expires and a later cycle resumes from the committed state.', 'console.error(error);')],
  ['an arbitrary SQLSTATE as a metric label', 'telemetryContentViolations', () => plant('failure', "return error.status >= 500 || error.status === 408 || error.status === 429 ? 'TRANSPORT' : 'INTEGRITY';", "return (error as { databaseCode?: string }).databaseCode as never;")],
  ['a high-cardinality / widened outcome registry', 'telemetryContentViolations', () => plant('telemetry', "const OPERATION_FAILURES=['transport_failure','integrity_failure'] as const;", "const OPERATION_FAILURES=['transport_failure','integrity_failure',String(Date.now())] as const;")],
  ['telemetry failure able to fail the deletion pass', 'failSoftViolations', () => plant('worker', '    this.quietly(() => this.telemetry.recordOperationalOutcome(domain, operation, outcome));', '    this.telemetry.recordOperationalOutcome(domain, operation, outcome);')],
  ['telemetry failure able to fail the Understanding answer', 'failSoftViolations', () => plant('understanding', "    } catch {\n      // Losing a signal is acceptable; changing the answer is not.\n    }", "    } finally {\n      // Losing a signal is acceptable; changing the answer is not.\n    }")],
  ['BLOCKED Connected Worlds deletion counted as an Ops failure', 'semanticsViolations', () => plant('worker', "outcome === 'BLOCKED' ? 'blocked_expected'", "outcome === 'BLOCKED' ? 'integrity_failure'")],
  ['BLOCKED counted in the stuck summary', 'semanticsViolations', () => plant('migration', "WHERE d.status = 'SCHEDULED' AND d.final_at <= b.stuck_before", "WHERE d.status IN ('SCHEDULED', 'BLOCKED') AND d.final_at <= b.stuck_before")],
  ['a deletion max-attempt cutoff', 'semanticsViolations', () => plant('worker', '  private async advance(deletion: DueDeletion): Promise<void> {', '  private attempts = new Map<string, number>();\n  private async advance(deletion: DueDeletion): Promise<void> {')],
  ['export retry / FAILED semantics changed', 'semanticsViolations', () => plant('migration', "SET status = CASE WHEN e.attempt_count >= 3 THEN 'FAILED' ELSE 'PREPARING' END,", "SET status = CASE WHEN e.attempt_count >= 5 THEN 'FAILED' ELSE 'PREPARING' END,")],
  ['export backoff changed', 'semanticsViolations', () => plant('migration', "lease_until = CASE WHEN e.attempt_count >= 3 THEN NULL ELSE clock_timestamp() + interval '1 minute' END,", "lease_until = CASE WHEN e.attempt_count >= 3 THEN NULL ELSE clock_timestamp() + interval '10 minutes' END,")],
  ['raw SQL error text persisted', 'semanticsViolations', () => plant('migration', 'GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;', 'GET STACKED DIAGNOSTICS v_sqlstate = MESSAGE_TEXT;')],
  ['a raw SQLSTATE persisted as the class', 'semanticsViolations', () => plant('migration', 'failure_class = personal_data_private.export_failure_class_v1(v_sqlstate),', 'failure_class = v_sqlstate,')],
  ['new automatic Confidence retry behaviour', 'semanticsViolations', () => plant('understanding', "      await this.confidenceRuntime.ensureHypothesisVersionEvaluation(userId, token, hypothesisId, version, evaluationId);\n    } catch (error) {", "      for (let i = 0; i < 3; i += 1) await this.confidenceRuntime.ensureHypothesisVersionEvaluation(userId, token, hypothesisId, version, evaluationId);\n    } catch (error) {")],
];

for (const [name, detector, world] of PLANTED) {
  test(`planted defect is rejected: ${name}`, () => {
    assert.notDeepEqual(DETECTORS[detector](world()), [], `${detector} must reject: ${name}`);
  });
}

test('the verifier, the wire proof and this contract are registered in API CI', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['verify:operational-readiness-failure-visibility:integration'], 'node --env-file-if-exists=.env database/verify-migration-0132.mjs');
  assert.equal(pkg.scripts['prove:operational-readiness:postgrest'], 'node --env-file-if-exists=.env database/prove-0132-readiness-postgrest.mjs');
  assert.equal(pkg.scripts['test:prod-ops-01-operational-readiness-failure-visibility-contract'], 'node --test tests/prod-ops-01-operational-readiness-failure-visibility-contract.test.mjs');
  const ci = read('.github/workflows/api-ci.yml');
  assert.equal((ci.match(/run: npm run verify:operational-readiness-failure-visibility:integration\b/gu) ?? []).length, 1);
  assert.match(ci, /npm run --silent prove:operational-readiness:postgrest/u);
  assert.ok(ci.indexOf('run: npm run test:prod-ops-01-operational-readiness-failure-visibility-contract}') < ci.indexOf('Apply all migrations to fresh PostgreSQL'), 'the static gate runs before the database');
  assert.ok(ci.indexOf('npm run verify:him-measurement-preflight') < ci.indexOf('prove:operational-readiness:postgrest'), 'the API is built (by the preflight) before the wire proof loads it');
});
