// S6-07 (CP2) - static contract for the forward dispatcher (migration 0166, Controlled Amendment CA-SYS-02, Q5').
//
// The real behaviour is proven against PostgreSQL (database/verify-migration-0166.mjs) and on the wire through every live
// PostgREST line with the compiled worker (database/prove-0166-forward-dispatch-postgrest.mjs). This contract pins the
// shape those proofs rely on, so a later edit cannot quietly widen it: ONE service_role dispatcher and ONE read-only
// service_role lister, nothing granted to a client; the pair lock FIRST and the proposal row never locked before it; one
// attempt per transaction; the ledger's ids reused, never minted per attempt; exactly one permitted conclusion, never
// invented; 40001 / PT409 absorbed, nothing re-raised, no dynamic SQL; no transition, view, binding or seam written by
// the dispatcher itself; the ledger readable by nobody and removed with its proposal; the census naming the second
// SYSTEM exception exactly; a worker with no route that ends its cycle at BUSY and binds no Activity notifier yet; and the
// proofs wired into CI. Each detector is shown to catch a planted defect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const sql = (text) => text.replace(/--[^\n]*/gu, '');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/[^\n]*/gu, '$1');
const MIGRATIONS = 'database/migrations';
const M0166 = '0166_matching_forward_dispatch_v1.sql';
const API = 'apps/api/src/introductions-dispatch';
const DISPATCHER = 'public.server_forward_approved_matching_proposals_v1';
const LISTER = 'public.server_list_proposal_delivery_activity_reconciliation_v1';

const shipped = () => ({
  migration: read(`${MIGRATIONS}/${M0166}`),
  migrations: readdirSync(new URL(`../${MIGRATIONS}/`, import.meta.url)).filter((n) => n.endsWith('.sql')).sort(),
  verify0149: read('database/verify-migration-0149.mjs'),
  verify0150: read('database/verify-migration-0150.mjs'),
  repository: read(`${API}/introductions-forward-dispatch.repository.ts`),
  worker: read(`${API}/introductions-forward-dispatcher.worker.ts`),
  module: read(`${API}/introductions-dispatch.module.ts`),
  account: read('apps/api/src/account/account.module.ts'),
  telemetry: read('apps/api/src/observability/telemetry.service.ts'),
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
const at = (text, needle) => text.indexOf(needle);

function migrationViolations(w) {
  const out = [];
  const statements = sql(w.migration);
  const fns = bodies(w.migration);
  if (w.migrations[w.migrations.indexOf(M0166) - 1] !== '0165_matching_governed_enrollment_v1.sql') out.push('0166 directly follows 0165');
  const created = [...statements.matchAll(/CREATE (OR REPLACE )?FUNCTION ([a-z_]+\.[a-z0-9_]+)\(/gu)].map((m) => `${m[1] ?? ''}${m[2]}`);
  if (JSON.stringify(created) !== JSON.stringify([DISPATCHER, LISTER])) out.push(`exactly the dispatcher and the lister are created, nothing replaced (got ${created})`);
  if (/\b(?:ALTER|DROP)\s+FUNCTION\s+public\.(?!server_)/iu.test(statements) || /\bALTER TABLE public\.|\bDROP\s+(?:TABLE|TRIGGER|CONSTRAINT)\b/iu.test(statements)) {
    out.push('no earlier function or relation is altered or dropped');
  }
  // Privileges: the two service_role grants and nothing else.
  const grants = [...statements.matchAll(/\bGRANT\b[^;']*/giu)].map((m) => m[0].replace(/\s+/gu, ' ').trim());
  if (JSON.stringify(grants) !== JSON.stringify([
    `GRANT EXECUTE ON FUNCTION ${DISPATCHER}(integer) TO service_role`, `GRANT EXECUTE ON FUNCTION ${LISTER}(integer) TO service_role`])) {
    out.push(`exactly two grants, both to service_role (got ${grants})`);
  }
  if (/\bTO\s+(?:anon|authenticated|PUBLIC)\b/iu.test(statements) || /ALTER\s+DEFAULT\s+PRIVILEGES/iu.test(statements)) out.push('nothing is granted to a client role');
  if (!/REVOKE ALL ON TABLE matching_forward_private\.proposal_forward_attempts FROM service_role;/u.test(statements)
      || !/ENABLE ROW LEVEL SECURITY/u.test(statements)) out.push('the ledger is readable by no application role, RLS on');
  if (!/FOREIGN KEY \(proposal_id\) REFERENCES public\.matching_proposals \(id\) ON DELETE CASCADE/u.test(statements)
      || (statements.match(/\bREFERENCES public\./gu) ?? []).length !== 1) out.push('the ledger references only its proposal, ON DELETE CASCADE');
  if (!/\('matching_forward_private\.proposal_forward_attempts', 'MATCHING_INTRODUCTIONS'\);/u.test(statements)) out.push('the ledger is registered for the governed erasure');

  const d = sql(fns[DISPATCHER] ?? '');
  if (!/SECURITY DEFINER SET search_path = '' SET lock_timeout = '2s' AS \$\$/u.test(w.migration)) out.push('the dispatcher pins search_path and a 2 s lock_timeout');
  if (!/IF p_max IS DISTINCT FROM 1 THEN/u.test(d)) out.push('one attempt per transaction: p_max must be 1');
  // The lock order: the pair lock first, the proposal row only re-read under it, then the ledger, then the core.
  const order = ['PERFORM public.lock_matching_pair_humans_v1(v_due.lower_user_id, v_due.higher_user_id);',
    'SELECT * INTO v_proposal FROM public.matching_proposals p WHERE p.id = v_due.id;',
    'ON CONFLICT (proposal_id) DO NOTHING;', 'PERFORM 1 FROM public.forward_matching_proposal_to_second_core_v1('].map((n) => at(d, n));
  if (order.some((i) => i < 0) || order.some((i, k) => k > 0 && i <= order[k - 1])) out.push('the pair lock first, then the re-read, the ledger and the core');
  if (/FOR UPDATE|SKIP LOCKED|FOR SHARE/u.test(d.slice(0, order[0])) || /matching_proposals[^;]*FOR (?:UPDATE|SHARE)/u.test(d)) {
    out.push('the proposal row is never locked by the dispatcher, least of all before the pair lock');
  }
  // The CP2 correction: both account rows FOR KEY SHARE after the pair lock, inside its BUSY block, and a pending deletion of
  // either human (anything but CANCELLED) refuses before the core, without ending the ledger row.
  const keyShare = at(d, 'PERFORM 1 FROM public.users u WHERE u.id IN (v_due.lower_user_id, v_due.higher_user_id) ORDER BY u.id FOR KEY SHARE;');
  const guard = at(d, "WHERE d.user_id IN (v_proposal.lower_user_id, v_proposal.higher_user_id)\n                AND d.status IN ('SCHEDULED', 'BLOCKED', 'ERASED', 'COMPLETED')) THEN\n    v_outcome := 'SKIPPED_DELETION_PENDING';");
  if (keyShare < order[0] || keyShare > at(d, 'EXCEPTION WHEN lock_not_available OR deadlock_detected THEN')
      || guard < order[2] || guard > order[3]) {
    out.push('both account rows held after the pair lock; a pending deletion of either human refuses before the core');
  }
  if (!/'SKIPPED_DELETION_PENDING'/u.test(w.migration.match(/CONSTRAINT proposal_forward_attempts_outcome_check[^;]*/u)?.[0] ?? '')
      || /CONSTRAINT proposal_forward_attempts_terminal[^;]*SKIPPED_DELETION_PENDING/u.test(w.migration)) {
    out.push('a deletion refusal is a recorded, non-terminal outcome');
  }
  if ((d.match(/forward_matching_proposal_to_second_core_v1\(/gu) ?? []).length !== 1
      || !/forward_matching_proposal_to_second_core_v1\(\s+v_attempt\.forward_command_id, v_proposal\.id, v_attempt\.forwarded_view_id, v_conclusions\[1\]\)/u.test(d)) {
    out.push('the core is called once, with the ledger\'s ids minted once');
  }
  if (!/IF cardinality\(v_conclusions\) <> 1 THEN\s+v_outcome := 'SKIPPED_NO_CONCLUSION';/u.test(d)
      || !/c\.for_recipient_user_id = v_proposal\.candidate_user_id\s+AND c\.about_user_id = v_proposal\.first_recipient_user_id/u.test(d)
      || !/k\.eligibility_snapshot_id = v_proposal\.eligibility_snapshot_id/u.test(d)) {
    out.push('exactly one permitted conclusion of the proposal\'s own snapshot, for the candidate, about the first recipient');
  }
  if (!/WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN/u.test(d) || /ERRCODE = '(?:40001|PT409)'/u.test(d)) out.push('40001 / PT409 absorbed, neither raised');
  if (/\bRAISE;|\bEXECUTE\s|ISOLATION|auth\.uid/iu.test(d)) out.push('nothing re-raised, no dynamic SQL, no session identity');
  if (/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\./iu.test(d) || /append_matching_proposal_transition_v1|materialize_matching_recipient_view_core_v1|resolve_matching_proposal_prerequisites_v1|'CLEARED'/u.test(d)) {
    out.push('the dispatcher writes no transition, view or binding itself and never consults or answers the CW2-08 seam');
  }
  if (!/WHEN v_outcome IN \('FORWARDED', 'HELD_INTEGRITY'\) THEN NULL/u.test(d) || !/least\(interval '6 hours'/u.test(d) || !/v_proposal\.expires_at\)/u.test(d)) {
    out.push('terminal outcomes hold; the backoff is bounded and never outlives the deadline');
  }
  const l = sql(fns[LISTER] ?? '');
  if (!/LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS \$\$\nBEGIN\n  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN/u.test(w.migration)
      || /(INSERT\s+INTO|UPDATE\s|DELETE\s+FROM|_core_v1|lock_matching|\bEXECUTE\s)/iu.test(l) || !/'PUBLISH'::text/u.test(l)
      || !/p\.current_transition_id = b\.delivery_transition_id/u.test(l)) {
    out.push('the lister is STABLE, bounded, writes nothing and lists only current deliveries');
  }
  if (/INSERT INTO public\.(?:matching_proposal_policy|matching_permitted_safe_conclusions|matching_safe_conclusion_candidates|activity_items)/u.test(statements)
      || /resolve_matching_proposal_prerequisites_v1\s*\([^)]*\)\s*RETURNS/u.test(statements)) {
    out.push('no policy, conclusion, Activity item or seam is installed');
  }
  return out;
}

function censusViolations(w) {
  const out = [];
  if (!w.verify0149.includes("const S6_07_FORWARD_DISPATCH = 'public.server_forward_approved_matching_proposals_v1(integer)';")) out.push('0149 names the dispatcher by exact signature');
  if (!w.verify0149.includes('const SYSTEM_EXCEPTIONS = [ACCT_DEL_01_ACCOUNT_ERASURE, S6_07_FORWARD_DISPATCH];')) out.push('0149 holds exactly two SYSTEM exceptions apart');
  if (!w.verify0149.includes('&& !SYSTEM_EXCEPTIONS.map(nameOf).includes(f.proname));')) out.push('0149 excludes the system exceptions by exact name only');
  if (!w.verify0149.includes("'NO_BACKDOOR the forward dispatcher is service_role-only'")) out.push('0149 proves the dispatcher is service_role-only');
  for (const probe of ['f18 the census refuses a second service_role wrapper around the forward dispatcher',
    'f19 the census refuses the forward dispatcher granted to a client role']) if (!w.verify0149.includes(probe)) out.push(`0149 probe: ${probe}`);
  if (!/ {2}'server_forward_approved_matching_proposals_v1',\n\];/u.test(w.verify0150)) out.push('0150 ABSORBED names the dispatcher');
  return out;
}

function apiViolations(w) {
  const out = [];
  const rpcs = [...w.repository.matchAll(/rpc<unknown>\('([a-z0-9_]+)'/gu)].map((m) => m[1]);
  if (JSON.stringify(rpcs) !== JSON.stringify(['server_forward_approved_matching_proposals_v1', 'server_list_proposal_delivery_activity_reconciliation_v1'])) {
    out.push(`exactly the two 0166 entry points (got ${rpcs})`);
  }
  if (!/\{ p_max: 1 \}/u.test(w.repository)) out.push('the dispatcher is called with p_max = 1 only');
  if (/@Controller|controllers:|@(?:Get|Post|Put|Patch|Delete)\(/u.test(code(w.module) + code(w.worker) + code(w.repository))) out.push('no controller and no route');
  if (/INTRODUCTIONS_DELIVERY_NOTIFIER|provide:/u.test(code(w.module))) out.push('no Activity notifier is bound before CP3');
  if (/console\.|Logger/u.test(code(w.worker) + code(w.repository))) out.push('the pass logs nothing');
  if (!/export const FORWARD_ATTEMPTS_PER_CYCLE = 10;/u.test(w.worker) || !/for \(let i = 0; i < FORWARD_ATTEMPTS_PER_CYCLE; i \+= 1\)/u.test(w.worker)) out.push('a bounded cycle');
  if (!/if \(outcome === 'NONE_DUE'\) break;/u.test(w.worker) || !/if \(outcome === 'BUSY'\) break;/u.test(w.worker)) out.push('the cycle ends at NONE_DUE and at BUSY');
  if (!/process\.env\.NODE_ENV !== 'test'/u.test(w.worker) || !/this\.timer\.unref\(\);/u.test(w.worker)
      || !/INTRODUCTIONS_FORWARD_DISPATCH_DISABLED !== 'true'/u.test(w.worker)) out.push('off under tests, switchable off, and a timer that never keeps the process alive');
  if ((w.account.match(/\bIntroductionsDispatchModule\b/gu) ?? []).length !== 3
      || !/IntroductionsContinuationModule, IntroductionsEnrollmentModule, IntroductionsDispatchModule\]/u.test(w.account)) out.push('composed once through AccountModule');
  if (!w.telemetry.includes("['INTRODUCTIONS_FORWARD',new Map([['dispatch',new Set(['success','superseded_expected','blocked_expected','retry_expected',...OPERATION_FAILURES])],['reconcile',new Set(['success',...OPERATION_FAILURES])]])],")) {
    out.push('the telemetry relation for the dispatcher is exact');
  }
  return out;
}

function wiringViolations(w) {
  const out = [];
  for (const [script, file] of [['verify:matching-forward-dispatch:integration', 'database/verify-migration-0166.mjs'],
    ['prove:forward-dispatch:postgrest', 'database/prove-0166-forward-dispatch-postgrest.mjs'],
    ['test:s6-07-forward-dispatch-contract', 'tests/s6-07-forward-dispatch-contract.test.mjs']]) {
    if (!w.packageJson.includes(`"${script}": "`) || !w.packageJson.includes(file)) out.push(`package.json ${script}`);
  }
  if (!w.workflow.includes('run: npm run verify:matching-forward-dispatch:integration')) out.push('CI runs verify-0166');
  if (!w.workflow.includes('run: npm run test:s6-07-forward-dispatch-contract}')) out.push('CI runs this contract');
  const wire = w.workflow.indexOf('npm run --silent prove:forward-dispatch:postgrest');
  if (!(wire > w.workflow.indexOf('docker run -d --rm --name "postgrest-$version"') && wire < w.workflow.indexOf('docker stop "postgrest-$version"'))) out.push('the wire proof runs inside the PostgREST loop');
  return out;
}

const DETECTORS = { migrationViolations, censusViolations, apiViolations, wiringViolations };
const plant = (key, from, to) => {
  const w = shipped();
  assert.ok(w[key].includes(from), `planted anchor exists in ${key}: ${from.slice(0, 60)}`);
  return { ...w, [key]: w[key].replace(from, to) };
};

test('1 - the shipped migration, census verifiers, worker and wiring hold every property', () => {
  const w = shipped();
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(w), [], name);
});

test('2 - every detector catches a planted defect', () => {
  for (const [label, detector, world] of [
    ['the dispatcher granted to authenticated', 'migrationViolations', () => plant('migration',
      "    EXECUTE 'GRANT EXECUTE ON FUNCTION public.server_forward_approved_matching_proposals_v1(integer) TO service_role';",
      "    EXECUTE 'GRANT EXECUTE ON FUNCTION public.server_forward_approved_matching_proposals_v1(integer) TO service_role';\n  GRANT EXECUTE ON FUNCTION public.server_forward_approved_matching_proposals_v1(integer) TO authenticated;")],
    ['a batch per transaction', 'migrationViolations', () => plant('migration', '  IF p_max IS DISTINCT FROM 1 THEN', '  IF p_max IS NULL OR p_max < 1 OR p_max > 50 THEN')],
    ['the proposal row locked before the pair lock', 'migrationViolations', () => plant('migration',
      '   ORDER BY coalesce(a.next_attempt_at, p.prepared_at), p.id\n   LIMIT 1;', '   ORDER BY coalesce(a.next_attempt_at, p.prepared_at), p.id\n   LIMIT 1 FOR UPDATE OF p SKIP LOCKED;')],
    ['the pair lock taken after the re-read', 'migrationViolations', () => {
      const w = shipped();
      const lock = '    PERFORM public.lock_matching_pair_humans_v1(v_due.lower_user_id, v_due.higher_user_id);\n';
      assert.ok(w.migration.includes(lock), 'planted anchor exists');
      return { ...w, migration: w.migration.replace(lock, '    NULL;\n').replace('  -- 4. The ledger row', `${lock}  -- 4. The ledger row`) };
    }],
    ['a fresh id per attempt', 'migrationViolations', () => plant('migration', '          v_attempt.forward_command_id, v_proposal.id, v_attempt.forwarded_view_id, v_conclusions[1]);',
      '          gen_random_uuid(), v_proposal.id, gen_random_uuid(), v_conclusions[1]);')],
    ['the first of several conclusions taken', 'migrationViolations', () => plant('migration', '    IF cardinality(v_conclusions) <> 1 THEN', '    IF cardinality(v_conclusions) = 0 THEN')],
    ['the absorber naming 40001 only', 'migrationViolations', () => plant('migration', "        WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN", "        WHEN SQLSTATE '40001' THEN")],
    ['an integrity refusal re-raised', 'migrationViolations', () => plant('migration', "          v_outcome := 'HELD_INTEGRITY';\n          v_sqlstate := SQLSTATE;",
      "          RAISE;")],
    ['the dispatcher consulting the seam', 'migrationViolations', () => plant('migration', '    IF cardinality(v_conclusions) <> 1 THEN',
      "    IF (SELECT r.clearance FROM public.resolve_matching_proposal_prerequisites_v1(v_proposal.id) r) <> 'CLEARED' THEN\n      v_outcome := 'SKIPPED_NOT_CLEARED';\n    ELSIF cardinality(v_conclusions) <> 1 THEN")],
    ['a transition written directly', 'migrationViolations', () => plant('migration', "        v_outcome := 'FORWARDED';",
      "        PERFORM 1 FROM public.append_matching_proposal_transition_v1(gen_random_uuid(), v_proposal.id, 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND', NULL, NULL, NULL);\n        v_outcome := 'FORWARDED';")],
    ['the account rows not held', 'migrationViolations', () => plant('migration',
      '    PERFORM 1 FROM public.users u WHERE u.id IN (v_due.lower_user_id, v_due.higher_user_id) ORDER BY u.id FOR KEY SHARE;\n', '')],
    ['only the first recipient\'s deletion checked', 'migrationViolations', () => plant('migration',
      '              WHERE d.user_id IN (v_proposal.lower_user_id, v_proposal.higher_user_id)', '              WHERE d.user_id = v_proposal.first_recipient_user_id')],
    ['a BLOCKED deletion let through', 'migrationViolations', () => plant('migration',
      "                AND d.status IN ('SCHEDULED', 'BLOCKED', 'ERASED', 'COMPLETED')) THEN\n    v_outcome := 'SKIPPED_DELETION_PENDING';",
      "                AND d.status IN ('SCHEDULED', 'ERASED', 'COMPLETED')) THEN\n    v_outcome := 'SKIPPED_DELETION_PENDING';")],
    ['the ledger readable by service_role', 'migrationViolations', () => plant('migration', '    REVOKE ALL ON TABLE matching_forward_private.proposal_forward_attempts FROM service_role;\n', '')],
    ['the ledger restricting the erasure', 'migrationViolations', () => plant('migration', 'REFERENCES public.matching_proposals (id) ON DELETE CASCADE', 'REFERENCES public.matching_proposals (id) ON DELETE RESTRICT')],
    ['the lister writing', 'migrationViolations', () => plant('migration', "   ORDER BY t.occurred_at, b.delivery_transition_id\n   LIMIT p_limit;",
      "   ORDER BY t.occurred_at, b.delivery_transition_id\n   LIMIT p_limit;\n  DELETE FROM public.activity_item_members m WHERE false;")],
    ['the census exceptions generalized', 'censusViolations', () => plant('verify0149', '&& !SYSTEM_EXCEPTIONS.map(nameOf).includes(f.proname));', "&& !f.proname.startsWith('server_'));")],
    ['a third system exception', 'censusViolations', () => plant('verify0149', 'const SYSTEM_EXCEPTIONS = [ACCT_DEL_01_ACCOUNT_ERASURE, S6_07_FORWARD_DISPATCH];',
      "const SYSTEM_EXCEPTIONS = [ACCT_DEL_01_ACCOUNT_ERASURE, S6_07_FORWARD_DISPATCH, 'public.server_anything_v1()'];")],
    ['the absorber dropped', 'censusViolations', () => plant('verify0150', "  'server_forward_approved_matching_proposals_v1',\n", '')],
    ['a route', 'apiViolations', () => plant('module', '@Module({\n  imports: [ObservabilityModule],', '@Module({\n  imports: [ObservabilityModule],\n  controllers: [IntroductionsForwardDispatcherWorker],')],
    ['the cycle looping on BUSY', 'apiViolations', () => plant('worker', "        if (outcome === 'BUSY') break;\n", '')],
    ['a notifier bound before CP3', 'apiViolations', () => plant('module', '  providers: [SupabaseServiceRoleApiService,',
      '  providers: [{ provide: INTRODUCTIONS_DELIVERY_NOTIFIER, useValue: {} }, SupabaseServiceRoleApiService,')],
    ['a batch on the wire', 'apiViolations', () => plant('repository', '{ p_max: 1 }', '{ p_max: 10 }')],
    ['the wire proof outside the loop', 'wiringViolations', () => plant('workflow', '            POSTGREST_VERSION="$version" npm run --silent prove:forward-dispatch:postgrest', '            echo skipped')],
  ]) {
    assert.notDeepEqual(DETECTORS[detector](world()), [], `the contract catches: ${label}`);
  }
});

test('3 - 0166 changes no frozen source and opens nothing', () => {
  const text = sql(read(`${MIGRATIONS}/${M0166}`));
  assert.doesNotMatch(text, /CREATE OR REPLACE FUNCTION/u, '0166 replaces no earlier function');
  assert.doesNotMatch(text, /\b(?:set_gate_v1|install_consent_text_v1|install_matching_proposal_polic)/u, 'no gate, consent text or policy is configured');
  assert.doesNotMatch(text, /INSERT INTO matching_enrollment_private\./u, 'nothing of the enrollment gate is written');
});
