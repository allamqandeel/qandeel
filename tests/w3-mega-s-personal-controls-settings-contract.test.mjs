import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

// W3-MEGA-S — Personal Controls & Settings Integration v1 (E2E-D-11 App Language, D-12 Accessibility parity, D-16 Export
// My Data, the Personal-world part of D-17 Delete Account, D-02 advanced). Static contract.
//
// The behaviour is proven where it runs:
//   database/verify-migration-0130.mjs                                        (real PostgreSQL, API CI)
//   apps/api/src/account/privacy-data.spec.ts                                 (the server boundary, the pass, the provider)
//   apps/mobile/src/settings/__tests__/privacy-data-controller.test.ts        (nothing is guessed)
//   apps/mobile/src/settings/__tests__/privacy-data-settings.test.tsx         (AR / EN Product surface, accessibility)
//   apps/mobile/src/integration/__tests__/w3-mega-s-privacy-data.test.tsx     (the production phase surface)
//   apps/mobile/src/conversation/__tests__/reduce-motion.test.tsx             (Reduce Motion followed mid-session)
// This gate guards what must be true BY CONSTRUCTION. Every predicate that carries a critical invariant is shown to
// reject a planted defect before it is trusted. No whole-file hash.

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));
/** Code only: a comment may name a forbidden thing in order to forbid it. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/[^\n]*/gu, '$1');
const sql = (text) => text.replace(/--[^\n]*/gu, '');

/** `predicate(corpus)` must be true, and `predicate(corpus + defect)` must be false. */
function guards(name, corpus, predicate, defect) {
  assert.equal(predicate(corpus), true, `${name}: the real source must satisfy the invariant`);
  assert.equal(predicate(`${corpus}\n${defect}\n`), false, `${name}: the guard does not reject its own planted defect`);
}

/** The body of one SQL function, `AS $$ … $$`, by its exact header. */
function body(text, header) {
  const at = text.indexOf(header);
  assert.ok(at >= 0, `${header} is defined`);
  const open = text.indexOf('$$', at);
  const close = text.indexOf('$$;', open + 2);
  return text.slice(open + 2, close);
}

const MIGRATION = 'database/migrations/0130_personal_privacy_export_account_deletion_v1.sql';
const API = 'apps/api/src/account';
const SETTINGS = 'apps/mobile/src/settings';
const RECORD = 'docs/e2e/QANDEEL_W3_MEGA_S_PERSONAL_CONTROLS_SETTINGS_IMPLEMENTATION_RECORD_v1.md';
const migration = read(MIGRATION);
const migrationSql = sql(migration);
const migrations = readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql')).sort();

const GUARDS = ['reject_him_runtime_mutation', 'reject_him_energy_immutable_mutation', 'guard_him_session_context_binding_mutation',
  'guard_information_gap_lifecycle_mutation', 'guard_formal_question_turn_binding_mutation', 'reject_committed_conversational_unit_mutation_v1',
  'reject_conversation_unit_commit_event_mutation_v1', 'reject_conversation_focus_semantic_mutation_v1', 'reject_conversation_thread_mutation_v1',
  'guard_conversation_world_thread_identity_clock_v1', 'reject_conversation_thread_lifecycle_mutation_v1', 'reject_conversation_live_focus_mutation_v1',
  'guard_historical_world_semantic_clock_v1', 'guard_thread_reading_binding_mutation_v1', 'reject_historical_projection_mutation_v1',
  'guard_historical_canonical_row_preservation_v1'];
const PREFIX = /IF TG_OP = 'DELETE' THEN\n\s+IF pg_catalog\.current_setting\('qandeel\.personal_erasure', true\) = pg_catalog\.txid_current\(\)::text THEN\n\s+IF personal_data_private\.personal_erasure_authorized_v1\(\) THEN RETURN OLD; END IF;\n\s+END IF;\n\s+END IF;/u;

// ---------------------------------------------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------------------------------------------

test('0130 is the next migration after 0129, and the only one of its number', () => {
  assert.equal(migrations[migrations.indexOf('0129_account_identity_completion_security_v1.sql') + 1], '0130_personal_privacy_export_account_deletion_v1.sql');
  assert.equal(migrations.filter((name) => name.startsWith('0130_')).length, 1);
  assert.doesNotMatch(migrationSql, /DROP |DISABLE TRIGGER|session_replication_role|ALTER TABLE public\./u, 'no guard is disabled or dropped, and no existing table is altered');
});

test('each of the sixteen guards is narrowed by the SAME prefix — DELETE only, transaction-bound, row-authorized — and keeps its refusal', () => {
  const narrowed = (text) => GUARDS.every((name) => {
    const header = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(\\)`, 'u');
    const at = text.search(header);
    if (at < 0) return false;
    const definition = text.slice(at, text.indexOf('$$;', text.indexOf('$$', at) + 2));
    return PREFIX.test(definition) && /RAISE EXCEPTION/u.test(definition) && !/SECURITY DEFINER/u.test(definition);
  });
  assert.equal(narrowed(migrationSql), true, 'the real migration narrows all sixteen');
  assert.equal(narrowed(migrationSql.replace("IF TG_OP = 'DELETE' THEN\n    IF pg_catalog.current_setting", "IF TG_OP IN ('DELETE', 'UPDATE') THEN\n    IF pg_catalog.current_setting")), false,
    'a guard that also admitted an UPDATE is refused');
  assert.equal(narrowed(migrationSql.replace(/IF personal_data_private\.personal_erasure_authorized_v1\(\) THEN RETURN OLD; END IF;/u, 'RETURN OLD;')), false,
    'a guard that trusted the setting alone is refused');
  assert.equal((migrationSql.match(/CREATE OR REPLACE FUNCTION public\.(?:reject|guard)_/gu) ?? []).length, 16, 'exactly the sixteen');
});

test('only the governed erasure opens the boundary, in every migration', () => {
  const opens = (texts) => texts.filter((text) => /set_config\('qandeel\.personal_erasure'|INSERT INTO personal_data_private\.erasure_authorizations/u.test(text));
  const all = migrations.map((name) => sql(read(`database/migrations/${name}`)));
  assert.equal(opens(all).length, 1, 'one migration');
  const erase = body(migrationSql, 'CREATE FUNCTION personal_data_private.erase_personal_account_v1(p_deletion_id uuid)');
  const elsewhere = migrationSql.replace(erase, '');
  guards('boundary-opened-by-the-erasure-alone', elsewhere, (text) => !/set_config\('qandeel\.personal_erasure', pg_catalog\.txid_current|INSERT INTO personal_data_private\.erasure_authorizations/u.test(text),
    "PERFORM pg_catalog.set_config('qandeel.personal_erasure', pg_catalog.txid_current()::text, true);");
  // The erasure takes a deletion request, never an account; it is SCHEDULED past its grace period only.
  assert.match(erase, /ELSIF v_request\.final_at > clock_timestamp\(\) THEN\n\s+RETURN 'NOT_DUE';/u);
  assert.match(erase, /ELSIF v_request\.status = 'CANCELLED' THEN\n\s+RETURN 'CANCELLED';/u);
});

test('HARD STOP: the erasure deletes no Connected Worlds row — a referencing one BLOCKS it, whole', () => {
  const erase = body(migrationSql, 'CREATE FUNCTION personal_data_private.erase_personal_account_v1(p_deletion_id uuid)');
  const deletes = [...erase.matchAll(/DELETE FROM ([\w.]+)/gu)].map((m) => m[1]);
  const personalOnly = (list) => list.every((table) => !/shared_world|public_(?:experience|identit|discussion)|publication_|replay|matching_|introduction_/u.test(table));
  assert.equal(personalOnly(deletes), true, `deleted: ${deletes.join(', ')}`);
  assert.equal(personalOnly([...deletes, 'public.shared_world_materials']), false, 'a planted Connected Worlds delete is refused');
  assert.match(erase, /DELETE FROM public\.users x WHERE x\.id = v_user;\n\s+EXCEPTION WHEN foreign_key_violation THEN/u, 'the account row last, and a foreign key refusal undoes the whole erasure');
  assert.match(erase, /SET status = 'BLOCKED'/u);
});

test('the owner acts take no account parameter and demand the reused re-authentication', () => {
  const headers = [...migrationSql.matchAll(/CREATE FUNCTION (?:public|personal_data_private)\.(\w+)\(([^)]*)\)/gu)];
  guards('no-account-parameter', headers.map((m) => m[2]).join('\n'), (text) => !/p_(?:user|account|actor|owner)/u.test(text), 'p_user_id uuid');
  for (const header of ['CREATE FUNCTION personal_data_private.request_own_data_export_v1(p_command_id uuid)', 'CREATE FUNCTION personal_data_private.request_own_account_deletion_v1(p_command_id uuid)']) {
    assert.match(body(migrationSql, header), /IF NOT account_private\.has_recent_password_proof_v1\(\) THEN/u, `${header} reuses 0129's proof`);
  }
  assert.doesNotMatch(migrationSql, /CREATE (?:OR REPLACE )?FUNCTION account_private\.has_recent_password_proof/u, 'no second reauthentication mechanism');
});

test('the verifier is registered once in API CI, and this contract in both CI gates', () => {
  const rootPackage = readJson('package.json');
  assert.equal(rootPackage.scripts['verify:personal-privacy-export-account-deletion:integration'], 'node --env-file-if-exists=.env database/verify-migration-0130.mjs');
  assert.equal(rootPackage.scripts['test:w3-mega-s-personal-controls-settings-contract'], 'node --test tests/w3-mega-s-personal-controls-settings-contract.test.mjs');
  const api = read('.github/workflows/api-ci.yml');
  assert.equal((api.match(/run: npm run verify:personal-privacy-export-account-deletion:integration\b/gu) ?? []).length, 1);
  assert.ok(api.indexOf('run: npm run test:w3-mega-s-personal-controls-settings-contract}') < api.indexOf('Apply all migrations to fresh PostgreSQL'), 'the static gate runs before the database');
  const mobile = read('.github/workflows/mobile-ci.yml');
  assert.match(mobile, /run: npm run test:w3-mega-s-personal-controls-settings-contract\}/u);
  assert.match(mobile, /'tests\/w3-mega-s-personal-controls-settings-contract\.test\.mjs'/u);
});

// ---------------------------------------------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------------------------------------------

test('the owner routes are guarded, account-free and silent; only the provider-removal file reaches an admin endpoint', () => {
  const controller = read(`${API}/privacy-data.controller.ts`);
  assert.match(controller, /@Controller\('account\/privacy'\)\n@UseGuards\(SupabaseAuthGuard\)\nexport class PrivacyDataController/u);
  assert.deepEqual([...code(controller).matchAll(/@(Get|Post)\(([^)]*)\)/gu)].map((m) => `${m[1]} ${m[2]}`), ["Get ", "Post 'export'", "Get 'export/download'", "Post 'deletion'", "Post 'deletion/cancel'"]);
  const files = readdirSync(new URL(`${API}/`, root)).filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'));
  const adminReachers = files.filter((name) => /\/auth\/v1\/admin\//u.test(code(read(`${API}/${name}`))));
  assert.deepEqual(adminReachers, ['provider-account-removal.service.ts']);
  const privacyFiles = files.filter((name) => /^(?:privacy|provider-account)/u.test(name)).map((name) => code(read(`${API}/${name}`))).join('\n');
  guards('nothing-logged', privacyFiles, (text) => !/console\.|Logger|Sentry|captureException/u.test(text), 'console.log(pkg);');
  const service = code(read(`${API}/privacy-data.service.ts`));
  guards('no-account-in-body', service, (text) => !/record\.(?:userId|accountId|user_id)|body\.userId/u.test(text), 'const target = record.userId;');
  // The pass never runs under tests and never outside a configured server.
  assert.match(code(read(`${API}/privacy-maintenance.worker.ts`)), /process\.env\.NODE_ENV !== 'test'/u);
  // The relay W3-MEGA-A pins is unchanged in shape: still one grant, and no admin call.
  const relay = code(read(`${API}/supabase-password-grant.service.ts`));
  assert.equal((relay.match(/grant_type=/gu) ?? []).length, 1);
  assert.doesNotMatch(relay, /admin/u);
});

// ---------------------------------------------------------------------------------------------------------------
// Mobile
// ---------------------------------------------------------------------------------------------------------------

test('App language: the system’s own setting — no in-app switch, no stored language, no second locale authority', () => {
  const language = code(read(`${SETTINGS}/language-settings.ts`));
  guards('system-setting-only', language, (text) => !/AsyncStorage|SecureStore|sqlite|forceRTL|allowRTL|setItem|I18nManager/u.test(text), 'I18nManager.forceRTL(true);');
  assert.match(language, /Linking\.openSettings\(\)/u);
  assert.match(language, /Linking\.sendIntent\('android\.settings\.LOCALE_SETTINGS'\)/u);
  const app = readJson('apps/mobile/app.json');
  assert.deepEqual(app.expo.ios.infoPlist.CFBundleLocalizations, ['ar', 'en'], 'iOS offers the per-app language');
  assert.deepEqual(app.expo.plugins, ['expo-router', './plugins/with-qandeel-launch-identity'], 'no new native plugin and no new Level-4 step');
  // The one locale authority is unchanged: the device is still read once, by the same call.
  assert.match(read('apps/mobile/src/integration/composition/ProductRoot.tsx'), /const locale = useMemo\(\(\) => deviceProductLocale\(\), \[\]\);/u);
});

test('Accessibility: no in-app accessibility switch; Reduce Motion is followed mid-session where the surfaces read it', () => {
  const settingsCode = readdirSync(new URL(`${SETTINGS}/`, root)).filter((name) => /\.tsx?$/u.test(name)).map((name) => code(read(`${SETTINGS}/${name}`))).join('\n');
  guards('no-accessibility-switch', settingsCode, (text) => !/<Switch\b|reduceMotion(?:Preference|Override)|textSizePreference|boldTextPreference/u.test(text), '<Switch value={reduceMotionOverride} />');
  const hook = code(read('apps/mobile/src/conversation/visual/reduce-motion.ts'));
  assert.match(hook, /AccessibilityInfo\.addEventListener\('reduceMotionChanged'/u);
  for (const file of ['apps/mobile/src/integration/composition/DepthComposition.tsx', 'apps/mobile/src/conversation/ConversationSurface.tsx']) {
    const text = code(read(file));
    assert.match(text, /useReduceMotion\(\)/u, `${file} follows the platform setting mid-session`);
    assert.doesNotMatch(text, /useReducedMotion\(\)/u, `${file} no longer reads the launch-only value`);
  }
});

test('Privacy & Data: one destination, approved group names, copy isolated and flagged, never “deleted” before the end', () => {
  const copy = read(`${SETTINGS}/copy.ts`);
  const registry = readJson('docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/data/COPY_REGISTRY.json');
  const rows = Array.isArray(registry) ? registry : registry.rows ?? Object.values(registry).find(Array.isArray);
  for (const key of ['gQandeel', 'gPrivacy']) {
    const row = rows.find((r) => r.k === key);
    assert.ok(copy.includes(`'${row.ar}'`) && copy.includes(`'${row.en}'`), `${key}, byte-for-byte`);
  }
  const proposed = copy.slice(copy.indexOf('const PROPOSED_W3_MEGA_S'), copy.indexOf('function privacyCopy'));
  assert.match(proposed, /PRODUCT COPY DECISION REQUIRED/u);
  // Never "deleted" as a done fact before the final deletion: every deletion line is a future, a process or a refusal.
  const deletionLines = [...proposed.matchAll(/delete\w*: '([^']*)'|delete\w*: "([^"]*)"/gu)].map((m) => m[1] ?? m[2]);
  guards('no-premature-deleted', deletionLines.join('\n'), (text) => !/\b(?:has been|was) deleted\b|\bAccount deleted\b|تم حذف/u.test(text), 'Your account has been deleted.');
  const surface = code(read(`${SETTINGS}/SettingsSurface.tsx`));
  assert.equal((surface.match(/<SettingsSurface\b/gu) ?? []).length, 0);
  assert.doesNotMatch(surface, /Alert\.alert|<Modal|router\.(?:push|navigate|replace)/u, 'every request is a state of the ONE destination');
  assert.doesNotMatch(code(read(`${SETTINGS}/export-file.ts`)), /email|mailto|Share\.share/iu, 'emailing the file is not a route');
});

// ---------------------------------------------------------------------------------------------------------------
// Record and governance
// ---------------------------------------------------------------------------------------------------------------

test('the record states exactly the D-17 truth, never a wider claim, and the backlog blockers stay open', () => {
  const record = read(RECORD);
  assert.match(record, /D-17 PERSONAL-WORLD IMPLEMENTATION — READY/u);
  assert.match(record, /D-17 FULL ACCOUNT DELETION — BLOCKED BY CONNECTED WORLDS/u);
  assert.match(record, /NOT YET INCLUDED — WORLD-SCOPED EXPORT AUTHORITY NOT IMPLEMENTED/u);
  assert.match(record, /PRODUCT COPY DECISION REQUIRED/u);
  const overClaim = (text) => /E2E-D-17[^\n|]*\|\s*(?:CLOSED|COMPLETE)\b/u.test(text) || /account deletion is (?:complete|production-ready)/iu.test(text);
  guards('no-d17-overclaim', record, (text) => !overClaim(text), '| `E2E-D-17` | CLOSED |');
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  for (const id of ['QAN-BL-ACCT-01', 'QAN-BL-CW-01']) {
    assert.match(backlog, new RegExp(`\\| \`${id}\` \\|[^\\n]*\\| \`OPEN — UNASSIGNED\` \\|`, 'u'), `${id} stays OPEN — UNASSIGNED`);
  }
});
