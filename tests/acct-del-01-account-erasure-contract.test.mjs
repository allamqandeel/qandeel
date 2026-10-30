// ACCT-DEL-01 — the static contract of the governed account erasure across Matching / Introductions (migration 0164, the
// API pass, the records). Real-PostgreSQL behaviour is verify-migration-0164's; this proves, from the shipped text, the
// properties that must not silently drift, and that each detector refuses a planted weakening.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { SUBSTITUTIONS, substitutedStatement } from '../database/voice-foundation-0183-substitutions.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const M0164 = 'database/migrations/0164_account_deletion_matching_introductions_v1.sql';
const sql = (text) => text.replace(/--[^\n]*/gu, '');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/[^\n]*/gu, '$1');

const GUARDS = [
  'public.introduction_disclosure_verifier_erasure_guard_v1()', 'public.introduction_profile_state_truth_v1()',
  'public.introduction_record_truth_v1()', 'introduction_sharing_private.refuse_name_display_event_rewrite_v1()',
  'public.introduction_success_approval_pointer_truth_v1()', 'public.matching_active_introduction_claim_truth_v1()',
  'public.matching_authority_status_truth_v1()', 'public.matching_confirmed_fact_state_truth_v1()',
  'public.matching_participation_state_truth_v1()', 'public.matching_proposal_state_truth_v1()',
  'public.matching_recipient_view_state_truth_v1()', 'public.matching_requirement_state_truth_v1()',
  'public.matching_setup_lock_truth_v1()', 'public.reject_introduction_disclosure_mutation_v1()',
  'public.reject_introduction_terminal_mutation_v1()', 'public.reject_matching_confirmed_fact_mutation_v1()',
  'public.reject_matching_match_mutation_v1()', 'public.reject_matching_proposal_mutation_v1()',
  'public.reject_matching_reactivation_mutation_v1()', 'public.reject_matching_setup_mutation_v1()',
];
const SERVER = ['public.server_erase_account_v1(uuid)', 'public.server_rearm_blocked_account_deletions_v1(integer)',
  'public.server_read_account_erasure_operations_v1()', 'public.server_read_account_erasure_coverage_v1()'];
const REPLACED = ['public.resolve_shared_world_closed_history_visibility_v1', 'public.read_my_introduction_history_v1',
  'public.list_my_introduction_worlds_v1', 'public.read_my_introduction_messages_v1', 'public.reactivate_matching_after_introduction_v1'];

const shipped = {
  migration: read(M0164),
  migrations: readdirSync(new URL('../database/migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => [f, read(`database/migrations/${f}`)]),
  repository: read('apps/api/src/account/privacy-maintenance.repository.ts'),
  worker: read('apps/api/src/account/privacy-maintenance.worker.ts'),
  recovery: read('apps/api/src/account/account-erasure-recovery.worker.ts'),
  module: read('apps/api/src/account/account.module.ts'),
  apiSources: readdirSync(new URL('../apps/api/src/', import.meta.url), { recursive: true })
    .filter((f) => String(f).endsWith('.ts') && !String(f).endsWith('.spec.ts'))
    .map((f) => [String(f), read(`apps/api/src/${String(f).replace(/\\/gu, '/')}`)]),
  workflow: read('.github/workflows/api-ci.yml'),
  pkg: read('package.json'),
  runtime: read('docs/matching-introduction-runtime-v1.md'),
  record: read('docs/e2e/QANDEEL_ACCT_DEL_01_IMPLEMENTATION_RECORD_v1.md'),
  backlog: read('docs/qandeel-canonical-backlog-v1.md'),
};

function migrationViolations(w) {
  const out = [];
  const m = sql(w.migration);
  // Statements only: the migration's own self-assertions quote these words inside string literals.
  const statements = m.replace(/'(?:[^']|'')*'/gu, "''");
  if (/session_replication_role|DISABLE\s+TRIGGER|TRUNCATE|\bDROP\s+(TABLE|FUNCTION|TRIGGER|POLICY|SCHEMA)/iu.test(statements)) out.push('a guard is disabled, or something is dropped or truncated');
  if (/ALTER\s+TABLE\s+(?!account_erasure_private\.|public\.introduction_retained_view|public\.matching_counterpart_erasure_)/iu.test(m.replace(/EXECUTE format\('ALTER TABLE %s[^)]*\)/gu, ''))) out.push('an existing relation is altered');
  for (const fk of m.matchAll(/REFERENCES\s+[a-z_.]+\s*\([^)]*\)\s+ON DELETE\s+(\w+)/giu)) {
    if (fk[1].toUpperCase() !== 'RESTRICT') out.push(`a new foreign key is ON DELETE ${fk[1]}`);
  }
  if (/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+personal_data_private\./iu.test(m) || /qandeel\.personal_erasure|personal_data_private\.erasure_authorizations/u.test(m)) out.push('0130 is touched');
  if (/GRANT[^;]*TO\s+(anon|authenticated|PUBLIC)\b/iu.test(m)) out.push('a client role is granted something');
  const grantStatements = [...m.matchAll(/GRANT EXECUTE ON FUNCTION ([\s\S]*?)TO service_role/gu)].map((g) => g[1]).join(' ');
  const granted = [...grantStatements.matchAll(/(public\.[a-z0-9_]+\([a-z ,]*\))/gu)].map((g) => g[1].replace(/ /gu, '')).sort();
  if (JSON.stringify(granted) !== JSON.stringify(SERVER.map((s) => s.replace(/ /gu, '')).sort())) out.push(`service_role is granted exactly the four server functions (got ${granted})`);
  const guardBlock = m.slice(m.indexOf('guards constant text[] := ARRAY['), m.indexOf('];', m.indexOf('guards constant text[] := ARRAY[')));
  const guards = [...guardBlock.matchAll(/'([a-z0-9_.]+\(\))'/gu)].map((g) => g[1]).sort();
  if (JSON.stringify(guards) !== JSON.stringify([...GUARDS].sort())) out.push('the narrowed guards are not exactly the twenty');
  if (!/IF TG_OP = ''DELETE'' THEN\\n'/u.test(w.migration) || /TG_OP = ''UPDATE''/u.test(w.migration)) out.push('the guard prefix admits more than a DELETE');
  // The 0130 call sits INSIDE the one subtransaction and any answer but ERASED is raised (0130 does not raise BLOCKED).
  const call = m.indexOf('v_personal := personal_data_private.erase_personal_account_v1(p_deletion_id);');
  const begin = m.lastIndexOf('BEGIN\n    INSERT INTO account_erasure_private.erasure_authorizations', call);
  const handler = m.indexOf('EXCEPTION\n    WHEN lock_not_available', call);
  if (call < 0 || begin < 0 || handler < 0 || !/IF v_personal IS DISTINCT FROM 'ERASED' THEN\s+RAISE EXCEPTION 'ACCOUNT_ERASURE_PERSONAL_REFUSED'/u.test(m.slice(call, handler))) {
    out.push('the 0130 call is not inside the erasure subtransaction with a raise on every answer but ERASED');
  }
  if (m.indexOf('account_erasure_private.residue_classes_v1(v_user, v_worlds)') > begin) out.push('the census runs after the erasure began');
  const replaced = [...m.matchAll(/CREATE OR REPLACE FUNCTION ([a-z0-9_.]+)\(/gu)].map((r) => r[1]).sort();
  if (JSON.stringify(replaced) !== JSON.stringify([...REPLACED].sort())) out.push(`0164 replaces exactly the four readers and the 0117 core (got ${replaced})`);
  return out;
}

function ownershipViolations(w) {
  const out = [];
  // RE-ANCHORED by S7-01 (migration 0169): 0169 forward-replaces the coordinator (to lock and erase the Personal Replay
  // footprint) and narrows two I-06 guards with the same prefix. The rule is unchanged and now stated exactly: only the ONE
  // coordinator, account_erasure_private.erase_account_v1, ever opens qandeel.account_erasure or writes the authorization;
  // 0164 defines it and 0169 alone forward-replaces it, and every other mention is a guard READING the setting.
  const COORDINATOR = /CREATE (?:OR REPLACE )?FUNCTION account_erasure_private\.erase_account_v1\(p_deletion_id uuid\)[\s\S]*?\nEND\$\$;/u;
  // S8B-02 CP1 RE-ANCHOR (2026-10-30): 0183 forward-replaces the coordinator once more (to erase the voice module) as its
  // declared substitution `account-erasure` - the 0169 statement plus exact, tagged edits, proven byte-for-byte by
  // verify-migration-0183 (S0d). The rule is unchanged: one coordinator, and every replacement of it is named here.
  const OWNERS = ['0164_account_deletion_matching_introductions_v1.sql', '0169_replay_personal_secure_integration_erasure_v1.sql', '0183_s8b_02_voice_foundation_v1.sql'];
  const definers = w.migrations.filter(([, t]) => COORDINATOR.test(t)).map(([f]) => f);
  if (JSON.stringify(definers) !== JSON.stringify(OWNERS)) {
    out.push(`the coordinator is defined by 0164 and forward-replaced by 0169 and 0183 alone (got ${definers})`);
  }
  const voice = w.migrations.find(([f]) => f === OWNERS[2]);
  const erasure = SUBSTITUTIONS.find((substitution) => substitution.key === 'account-erasure');
  if (voice && (!erasure || !voice[1].includes(substitutedStatement(erasure)) || !COORDINATOR.test(substitutedStatement(erasure)))) {
    out.push('0183 replaces the coordinator with something other than its declared substitution');
  }
  for (const [f, t] of w.migrations) {
    const outside = t.replace(new RegExp(COORDINATOR.source, 'gu'), '');
    if (/set_config\('qandeel\.account_erasure'/u.test(outside)) out.push(`${f} opens qandeel.account_erasure outside the coordinator`);
    if (/INSERT INTO account_erasure_private\.erasure_authorizations \(/u.test(outside)) out.push(`${f} writes the account erasure authorization outside the coordinator`);
  }
  const owners = w.migrations.filter(([, t]) => /qandeel\.account_erasure/u.test(t)).map(([f]) => f);
  if (JSON.stringify(owners) !== JSON.stringify(OWNERS)) {
    out.push(`only 0164, 0169 and 0183 name qandeel.account_erasure (got ${owners})`);
  }
  return out;
}

function apiViolations(w) {
  const out = [];
  const repository = code(w.repository);
  if (!/rpc<unknown>\('server_erase_account_v1', \{ p_deletion_id: deletionId \},\s+\{ timeoutMs: ACCOUNT_ERASURE_TIMEOUT_MS \}\)/u.test(repository)) out.push('the pass does not call the governed account erasure under its own bound');
  if (!/export const ACCOUNT_ERASURE_TIMEOUT_MS = 60_000;/u.test(repository)) out.push('the erase call bound drifted');
  const legacy = w.apiSources.filter(([, t]) => /server_erase_personal_account_v1/u.test(code(t))).map(([f]) => f);
  if (legacy.length > 0) out.push(`an API path still calls the Personal-only erasure: ${legacy}`);
  const worker = code(w.worker);
  if (!/outcome === 'BLOCKED' \? 'blocked_expected'/u.test(worker)) out.push('BLOCKED is not the expected answer');
  if (!/outcome === 'RETRY' \? 'retry_expected' : 'integrity_failure'/u.test(worker)) out.push('RETRY is not an expected answer, or INTEGRITY is not a failure');
  if (!/AccountErasureRecoveryWorker,\n\s+\]/u.test(w.module)) out.push('the recovery pass is not composed');
  if (/console\.|Logger|deletionId|userId/u.test(code(w.recovery))) out.push('the recovery pass logs or labels an identity');
  return out;
}

function wiringViolations(w) {
  const out = [];
  if (!/"verify:account-deletion-matching-introductions:integration": "node --env-file-if-exists=\.env database\/verify-migration-0164\.mjs"/u.test(w.pkg)) out.push('the verifier script is missing');
  if (!/"test:acct-del-01-account-erasure-contract": "node --test tests\/acct-del-01-account-erasure-contract\.test\.mjs"/u.test(w.pkg)) out.push('the contract script is missing');
  if (!/run: npm run verify:account-deletion-matching-introductions:integration/u.test(w.workflow)) out.push('CI does not run the verifier');
  if (!/run: npm run test:acct-del-01-account-erasure-contract/u.test(w.workflow)) out.push('CI does not run this contract');
  if (!/^## 49\. `ACCT-DEL-01` — controlled forward amendment for account deletion across Matching \/ Introductions$/mu.test(w.runtime)) out.push('the I-07 record does not carry the §49 amendment');
  if (!/^\*\*Phase:\*\* `I-07 — Introductions \/ Matching Runtime` — \*\*CLOSED \/ FROZEN\*\*$/mu.test(w.runtime)) out.push('the I-07 phase banner changed');
  // The closure (CP2, P-1): QAN-BL-ACCT-01 stays open with ACCT-DEL-02 (Shared STANDARD / Public), Replay is its own item
  // with Stage 7, and the release gate is HOSTED-DEPLOY-01's mandatory condition. None may be closed by this task.
  if (!/^\| `QAN-BL-ACCT-01` \| .* \| `ACCT-DEL-02 — Account Deletion Across Shared STANDARD \/ Public` \| `HIGH` \| `DEFERRED — OWNED` \|$/mu.test(w.backlog)) out.push('QAN-BL-ACCT-01 is not owned by ACCT-DEL-02, or was closed');
  // RE-ANCHORED by S7-01 (2026-10-19): Stage 7's first task delivered the Personal Replay erasure module in the same change
  // as the first user-reachable Replay relation (0169), so the item is tombstoned by it; the residue outside the Personal
  // Replay is QAN-BL-ACCT-03's. Closing it by anything else, or reopening it silently, still fails here.
  if (!/^\| `QAN-BL-ACCT-02` \| .* \| `S7-01 — Replay Secure Integration & Account Erasure` \| `HIGH` \| `CLOSED — TOMBSTONE` \|$/mu.test(w.backlog)) out.push('Replay account deletion is not closed by S7-01');
  if (!/^\| `QAN-BL-ACCT-03` \| .* \| `HIGH` \| `DEFERRED — OWNED` \|$/mu.test(w.backlog)) out.push('the residue outside the Personal Replay is not owned');
  if (!/^\| `QAN-BL-PROD-09` \| .* \| `HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate` \| `HIGH` \| `DEFERRED — OWNED` \|$/mu.test(w.backlog)) out.push('the release gate is not a HOSTED-DEPLOY-01 condition, or was closed');
  for (const required of ['P-1', 'P-2', 'P-3', 'P-4', 'ACCT-DEL-02', 'Stage 7', 'NOT_DEPLOYED', '0130']) {
    if (!w.record.includes(required)) out.push(`the record does not state ${required}`);
  }
  return out;
}

const DETECTORS = { migrationViolations, ownershipViolations, apiViolations, wiringViolations };

test('the shipped erasure is clean under every detector', () => {
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(shipped), [], name);
});

const plant = (key, from, to) => {
  assert.ok(shipped[key].includes(from), `the planted defect's anchor exists in ${key}: ${from.slice(0, 60)}`);
  return { ...shipped, [key]: shipped[key].replace(from, to) };
};
const PLANTED = [
  ['a guard disabled to let the erasure through', 'migrationViolations', () => plant('migration', 'CREATE SCHEMA account_erasure_private;', 'CREATE SCHEMA account_erasure_private;\nALTER TABLE public.matching_pairs DISABLE TRIGGER ALL;')],
  ['a new foreign key that cascades', 'migrationViolations', () => plant('migration', 'FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,\n    CONSTRAINT introduction_retained_views_episode_fk', 'FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,\n    CONSTRAINT introduction_retained_views_episode_fk')],
  ['the account erasure granted to a client', 'migrationViolations', () => plant('migration', "|| 'TO service_role';", "|| 'TO service_role'; GRANT EXECUTE ON FUNCTION public.server_erase_account_v1(uuid) TO authenticated;")],
  ['0130 BLOCKED swallowed instead of raised', 'migrationViolations', () => plant('migration', "RAISE EXCEPTION 'ACCOUNT_ERASURE_PERSONAL_REFUSED' USING ERRCODE = 'P0001';", 'NULL;')],
  ['a twenty-first guard narrowed', 'migrationViolations', () => plant('migration', "    'public.reject_matching_setup_mutation_v1()'];", "    'public.reject_matching_setup_mutation_v1()',\n    'public.reject_shared_world_mutation_v1()'];")],
  ['a second migration opening the erasure', 'ownershipViolations', () => ({ ...shipped, migrations: [...shipped.migrations, ['0165_x.sql', "SELECT set_config('qandeel.account_erasure', '1', true)"]] })],
  ['the pass back on the Personal-only erasure', 'apiViolations', () => plant('repository', "'server_erase_account_v1', { p_deletion_id: deletionId }", "'server_erase_personal_account_v1', { p_deletion_id: deletionId }")],
  ['BLOCKED counted as an operational failure', 'apiViolations', () => plant('worker', "outcome === 'BLOCKED' ? 'blocked_expected'", "outcome === 'BLOCKED' ? 'integrity_failure'")],
  ['RETRY counted as a failure', 'apiViolations', () => plant('worker', "outcome === 'RETRY' ? 'retry_expected'", "outcome === 'RETRY' ? 'integrity_failure'")],
  ['the verifier dropped from CI', 'wiringViolations', () => plant('workflow', 'run: npm run verify:account-deletion-matching-introductions:integration', 'run: echo skipped')],
  ['QAN-BL-ACCT-01 closed', 'wiringViolations', () => plant('backlog', "`ACCT-DEL-02 — Account Deletion Across Shared STANDARD / Public` | `HIGH` | `DEFERRED — OWNED` |", "`ACCT-DEL-02 — Account Deletion Across Shared STANDARD / Public` | `HIGH` | `CLOSED — TOMBSTONE` |")],
  // RE-ANCHORED by S7-01: the planted defects now reopen the tombstone silently, and drop the residue's owner.
  ['Replay deletion reopened to no one', 'wiringViolations', () => plant('backlog', "`S7-01 — Replay Secure Integration & Account Erasure` | `HIGH` | `CLOSED — TOMBSTONE` |", "`UNASSIGNED` | `HIGH` | `OPEN — UNASSIGNED` |")],
  ['the Replay residue outside the Personal path handed to no one', 'wiringViolations', () => plant('backlog', "`Stage 9 — Economy + Launch Closure (Replay distribution / CW2-08)` | `HIGH` | `DEFERRED — OWNED` |", "`UNASSIGNED` | `HIGH` | `OPEN — UNASSIGNED` |")],
  ['the release gate closed', 'wiringViolations', () => plant('backlog', "| `QAN-BL-PROD-09` | No World Opens in Production Without an Automated Account-Deletion Coverage Check | `HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate` | `HIGH` | `DEFERRED — OWNED` |", "| `QAN-BL-PROD-09` | No World Opens in Production Without an Automated Account-Deletion Coverage Check | `HOSTED-DEPLOY-01 — Hosted Database Catch-up Deployment & Data API Retry Gate` | `HIGH` | `CLOSED — TOMBSTONE` |")],
];

for (const [name, detector, world] of PLANTED) {
  test(`planted defect is refused: ${name}`, () => {
    assert.notDeepEqual(DETECTORS[detector](world()), [], `${detector} must refuse: ${name}`);
  });
}
