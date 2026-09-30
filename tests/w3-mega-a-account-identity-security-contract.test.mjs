import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

// W3-MEGA-A — Account & Identity Completion + Security v1 (E2E-D-03 Name, D-04 Change Email, D-05 Login ID, D-06
// Security & Sign-in v1, D-08 Shared ID format backend only). Static contract.
//
// The behaviour is proven where it runs:
//   database/verify-migration-0129.mjs                                      (real PostgreSQL, API CI)
//   apps/api/src/account/account-security.spec.ts                           (the server boundary and the relay)
//   apps/mobile/src/settings/__tests__/account-identity-controller.test.ts  (nothing is guessed)
//   apps/mobile/src/settings/__tests__/account-security-settings.test.tsx   (AR / EN Product surface)
//   apps/mobile/src/integration/__tests__/w3-mega-a-account-security.test.tsx (the production phase surface)
//   apps/mobile/src/runtime-entry/__tests__/account-access-port.test.ts     (recovery ends every session)
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

/** The body of one SQL function, `AS $$ … $$`, the LAST definition by that schema-qualified name. */
function functionBody(text, qualified) {
  const at = text.lastIndexOf(`CREATE FUNCTION ${qualified}(`);
  assert.ok(at >= 0, `${qualified} is defined`);
  const open = text.indexOf('$$', at);
  const close = text.indexOf('$$;', open + 2);
  return text.slice(open + 2, close);
}
const definitions = (text) => [...text.matchAll(/CREATE FUNCTION (\w+)\.(\w+)\(([\s\S]*?)AS \$\$/gu)].map((m) => ({ schema: m[1], name: m[2], header: m[3] }));

const MIGRATION = 'database/migrations/0129_account_identity_completion_security_v1.sql';
const VERIFIER = 'database/verify-migration-0129.mjs';
const API = 'apps/api/src/account';
const SETTINGS = 'apps/mobile/src/settings';
const RECORD = 'docs/e2e/QANDEEL_W3_MEGA_A_ACCOUNT_IDENTITY_SECURITY_IMPLEMENTATION_RECORD_v1.md';

const migration = read(MIGRATION);
const migrationSql = sql(migration);

// ---------------------------------------------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------------------------------------------

test('0129 is the next migration after 0128, additive and forward-only', () => {
  const names = readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(names[names.indexOf('0128_conversational_memory_control_v1.sql') + 1], '0129_account_identity_completion_security_v1.sql');
  assert.equal(names.filter((name) => name.startsWith('0129_')).length, 1);
  assert.doesNotMatch(migrationSql, /DROP |CREATE OR REPLACE|ALTER TABLE public\.|ALTER FUNCTION|DISABLE TRIGGER/u, 'nothing existing is dropped, replaced or altered');
});

test('privilege boundary: DEFINER only in the non-exposed schema; exposed functions INVOKER; exact grants; no account parameter', () => {
  const boundary = (text) => definitions(text).every((d) =>
    (d.schema === 'account_private' || (d.schema === 'public' && /SECURITY INVOKER/u.test(d.header) && !/SECURITY DEFINER/u.test(d.header))) &&
    /SET search_path = ''\n$/u.test(d.header));
  guards('definer-in-exposed-schema', migrationSql, boundary,
    "CREATE FUNCTION public.change_own_login_id_v1(p_command_id uuid, p_login_id text)\nRETURNS TABLE (outcome text)\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = ''\nAS $$ BEGIN END; $$;");
  const exactGrants = (text) => [...sql(text).matchAll(/GRANT ([^;]+);/gu)].map((m) => m[1]).join(' | ') === [
    'EXECUTE ON FUNCTION public.read_own_account_identity_v1() TO authenticated',
    'EXECUTE ON FUNCTION account_private.change_own_account_name_v1(text) TO authenticated',
    'EXECUTE ON FUNCTION public.change_own_account_name_v1(text) TO authenticated',
    'EXECUTE ON FUNCTION account_private.change_own_login_id_v1(uuid, text) TO authenticated',
    'EXECUTE ON FUNCTION public.change_own_login_id_v1(uuid, text) TO authenticated',
  ].join(' | ');
  guards('shared-id-regeneration-granted-before-w6', migration, exactGrants, 'GRANT EXECUTE ON FUNCTION account_private.regenerate_own_shared_id_v1(uuid) TO authenticated;');
  guards('ledger-granted-to-a-client', migration, exactGrants, 'GRANT SELECT ON TABLE account_private.login_id_change_commands TO authenticated;');
  guards('server-channel-reaches-the-login-id-change', migration, exactGrants, 'GRANT EXECUTE ON FUNCTION public.change_own_login_id_v1(uuid, text) TO service_role;');
  for (const d of definitions(migrationSql)) {
    assert.match(migrationSql, new RegExp(`REVOKE ALL ON FUNCTION ${d.schema}\\.${d.name}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`, 'u'), `${d.schema}.${d.name} revokes by name`);
  }
  const noAccountParameter = (text) => !/CREATE FUNCTION \w+\.\w+\([^)]*\bp_(?:user|account|actor|owner)(?:_id)?\b/u.test(sql(text));
  guards('client-supplied-account', migration, noAccountParameter, 'CREATE FUNCTION account_private.change_login_id_for_v1(p_user_id uuid, p_login_id text)');
  const noTableWrite = (text) => !/GRANT[^;]*(?:UPDATE|INSERT|DELETE|ALL)[^;]*ON (?:TABLE )?public\.users/iu.test(sql(text));
  guards('direct-client-table-write', migration, noTableWrite, 'GRANT UPDATE (login_id) ON TABLE public.users TO authenticated;');
});

test('the Login ID change demands a RECENT provider password proof before anything is read or written', () => {
  const proofFirst = (text) => {
    const body = functionBody(text, 'account_private.change_own_login_id_v1');
    const proof = body.indexOf('IF NOT account_private.has_recent_password_proof_v1() THEN');
    return proof > 0 && proof < body.indexOf('FOR UPDATE') && proof < body.indexOf('UPDATE public.users') &&
      /RAISE EXCEPTION 'LOGIN_ID_REAUTHENTICATION_REQUIRED' USING ERRCODE = '42501';/u.test(body);
  };
  guards('login-id-change-without-reauthentication', migrationSql, proofFirst,
    "CREATE FUNCTION account_private.change_own_login_id_v1(p_command_id uuid, p_login_id text)\nRETURNS TABLE (outcome text) AS $$ BEGIN UPDATE public.users SET login_id = p_login_id; END; $$;");
  // The proof is the provider's own claim — a password method, recent, not in the future — never a parameter.
  const proof = functionBody(migrationSql, 'account_private.has_recent_password_proof_v1');
  const providerClaim = (text) => /current_setting\('request\.jwt\.claims', true\)/u.test(text) && /a\.entry ->> 'method' = 'password'/u.test(text) &&
    /extract\(epoch FROM clock_timestamp\(\)\) - 60\n/u.test(text) && /extract\(epoch FROM clock_timestamp\(\)\) \+ 60/u.test(text);
  guards('any-method-counts-as-reauthentication', proof, (t) => providerClaim(t) && !/method' IN|method' <>/u.test(t), "AND a.entry ->> 'method' IN ('password', 'otp')");
  assert.match(migrationSql, /CREATE FUNCTION account_private\.has_recent_password_proof_v1\(\)\n/u, 'no parameter can assert it');
});

test('the Login ID namespace: 0123 grammar, the same-row Public ID rule, no oracle, a digest-only ledger', () => {
  const change = functionBody(migrationSql, 'account_private.change_own_login_id_v1');
  assert.match(change, /v_requested !~ '\^\[a-z0-9\]\+\(\[\._-\]\[a-z0-9\]\+\)\*\$'/u);
  assert.match(change, /char_length\(v_requested\) NOT BETWEEN 3 AND 30/u);
  assert.match(change, /IF v_requested = v_account\.public_id THEN/u, 'the caller’s OWN Public ID, from the caller’s own locked row');
  assert.match(change, /IF v_conflict = 'users_login_id_key' THEN\n\s*RETURN QUERY SELECT 'UNAVAILABLE'::text, v_account\.login_id;/u, 'the unique index decides; nobody is named');
  const sameRowOnly = (text) => !/FROM public\.users (?:\w+ )?WHERE (?!u\.id = v_user)/u.test(functionBody(text, 'account_private.change_own_login_id_v1')) &&
    !/CREATE FUNCTION \w+\.\w*(?:login_id|loginid)\w*(?:available|exists|lookup|resolve|search)/iu.test(text);
  guards('cross-account-login-id-lookup', migrationSql, sameRowOnly,
    "CREATE FUNCTION account_private.change_own_login_id_v1(p_command_id uuid, p_login_id text)\nRETURNS TABLE (outcome text) AS $$ BEGIN IF EXISTS (SELECT 1 FROM public.users o WHERE o.login_id = p_login_id) THEN RETURN; END IF; END; $$;");
  guards('login-id-availability-function', migrationSql, sameRowOnly, 'CREATE FUNCTION public.login_id_exists_v1(p text) RETURNS boolean AS $$ SELECT true $$;');
  const digestOnly = (text) => /requested_digest text NOT NULL,/u.test(text) && /CHECK \(requested_digest ~ '\^\[0-9a-f\]\{64\}\$'\)/u.test(text) &&
    !/CREATE TABLE account_private\.login_id_change_commands \([^;]*\blogin_id text/u.test(text);
  guards('ledger-keeps-the-login-id-in-clear', migrationSql, digestOnly, 'CREATE TABLE account_private.login_id_change_commands (command_id uuid, login_id text);');
});

test('the Shared ID format: server-generated from strong randomness, case-insensitive, via 0081’s frozen rotation, no surface', () => {
  const generator = functionBody(migrationSql, 'account_private.generate_shared_id_v1');
  const strong = (text) => /gen_random_uuid\(\)/u.test(text) && !/\brandom\(\)|setseed|md5\(|user_id|login_id|public_id|email/u.test(text) &&
    /'0123456789ABCDEFGHJKMNPQRSTVWXYZ'/u.test(text);
  guards('shared-id-from-weak-randomness', generator, strong, 'v_out := v_out || substr(v_alphabet, 1 + floor(random() * 32)::integer, 1);');
  guards('shared-id-derived-from-account-data', generator, strong, 'v_out := upper(substr(md5(v_user::text), 1, 12));');
  const regenerate = functionBody(migrationSql, 'account_private.regenerate_own_shared_id_v1');
  // 0081's representation boundary: only the opaque derived reference reaches persistence, never the Shared ID itself.
  const viaFrozenRotation = (text) => /FROM public\.rotate_shared_world_invite_credential_v1\(p_command_id, account_private\.shared_id_lookup_ref_v1\(v_value\), v_epoch\) r;/u.test(text) &&
    (text.match(/rotate_shared_world_invite_credential_v1\(/gu) ?? []).length === 1 &&
    !/UPDATE public\.shared_world_(?:invite_credential_state|direct_invitations)|INSERT INTO public\.shared_world/u.test(text);
  guards('shared-id-rotation-bypasses-0081', regenerate, viaFrozenRotation, 'UPDATE public.shared_world_invite_credential_state SET credential_lookup_ref = x;');
  guards('shared-id-stored-in-clear', regenerate, viaFrozenRotation, 'FROM public.rotate_shared_world_invite_credential_v1(p_command_id, v_value, v_epoch) r;');
  assert.match(functionBody(migrationSql, 'account_private.shared_id_lookup_ref_v1'), /'sid1:' \|\| encode\(sha256\(convert_to\(n\.canonical, 'UTF8'\)\), 'hex'\)/u);
  assert.match(migrationSql, /CREATE FUNCTION account_private\.regenerate_own_shared_id_v1\(p_command_id uuid\)\n/u, 'it takes a command identity, never a value');
  const normalize = functionBody(migrationSql, 'account_private.normalize_shared_id_v1');
  assert.match(normalize, /upper\(coalesce\(p_value, ''\)\)/u);
  assert.match(normalize, /'\[\[:space:\]-\]'/u);
  assert.match(normalize, /'OIL', '011'/u);
  // No Shared ID in the mobile client, the API or any route before W6.
  const mobile = [...listFiles('apps/mobile/src'), ...listFiles('apps/api/src')].filter((f) => /\.(ts|tsx)$/u.test(f) && !/__tests__|\.spec\.ts$/u.test(f));
  const noSurface = (text) => !/sharedId|shared_id|regenerate_own_shared_id|SharedIdRow|normalize_shared_id|shared_id_lookup_ref/iu.test(text);
  guards('shared-id-surface-before-w6', mobile.map((f) => code(read(f))).join('\n'), noSurface, "const sharedIdRow = { label: 'Shared ID' };");
});

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(new URL(`${dir}/`, root), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listFiles(path));
    else out.push(path);
  }
  return out;
}

test('the 0129 verifier exists, proves what it must, and runs in API CI; 0125’s verifier was re-anchored, not weakened', () => {
  assert.ok(existsSync(new URL(VERIFIER, root)));
  const verifier = read(VERIFIER);
  for (const proof of ['LOGIN_ID_REAUTHENTICATION_REQUIRED', 'passwordProof(90)', 'passwordProof(600)', "passwordProof(5, 'otp')", 'the old Login ID stops working immediately', 'the Email is unchanged',
    'the ledger holds no Login ID in clear', 'LOGIN_ID_COMMAND_CONFLICT', 'UNAVAILABLE', 'the caller’s OWN Public ID is INVALID',
    'case-insensitive; spaces ignored', 'no Shared ID is stored in clear', 'INVALIDATED', "['P0002']", 'waitUntilBlocked', 'the committed fixtures are gone', 'no client privilege on the ledger']) {
    assert.ok(verifier.includes(proof), `the verifier proves ${proof}`);
  }
  assert.equal(readJson('package.json').scripts['verify:account-identity-completion-security:integration'], 'node --env-file-if-exists=.env database/verify-migration-0129.mjs');
  assert.equal((read('.github/workflows/api-ci.yml').match(/run: npm run verify:account-identity-completion-security:integration\b/gu) ?? []).length, 1);
  assert.match(read('database/README.md'), /## W3-MEGA-A - Account identity completion and the Shared ID format \(migration 0129\)/u);
  // 0125's permanent claims are still asserted after the re-anchor.
  const v0125 = read('database/verify-migration-0125.mjs');
  assert.match(v0125, /'no broad grant on the private schema'/u);
  assert.match(v0125, /'no other Public-ID or Login-ID function \(no lookup, no availability oracle\)'/u);
  assert.match(v0125, /RE-ANCHORED by W3-MEGA-A/u);
});

// ---------------------------------------------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------------------------------------------

test('the API acts for the caller only: guarded routes, no account in any path or body', () => {
  const controller = code(read(`${API}/account-security.controller.ts`));
  assert.match(controller, /@Controller\('account'\)\n@UseGuards\(SupabaseAuthGuard\)\nexport class AccountSecurityController/u);
  const routes = [...controller.matchAll(/@(Get|Post)\('([^']+)'\)/gu)].map((m) => `${m[1]} ${m[2]}`);
  assert.deepEqual(routes, ['Get identity', 'Post name/change', 'Post login-id/change', 'Post email/change', 'Post email/confirm', 'Post password/change', 'Post sessions/sign-out-others']);
  const service = code(read(`${API}/account-security.service.ts`));
  const exactBodies = (text) => /Object\.keys\(record\)\.length !== keys\.length \|\| Object\.keys\(record\)\.some\(\(key\) => !keys\.includes\(key\)\)/u.test(text) &&
    !/record\.(?:userId|accountId|user_id)|body\.userId/u.test(text);
  guards('api-accepts-a-client-account', service, exactBodies, 'const target = body.userId;');
  // The W1B service still never handles an Email (W1B / W2 contracts), and no route logs anything.
  assert.doesNotMatch(code(read(`${API}/account.service.ts`)), /email/iu);
  for (const file of ['account-security.service.ts', 'account-security.controller.ts', 'account-identity.repository.ts', 'supabase-password-grant.service.ts']) {
    assert.doesNotMatch(code(read(`${API}/${file}`)), /console\.|Logger|Sentry|captureException/u, `${file} logs nothing`);
  }
});

test('reauthentication is the EXISTING provider password grant on the caller’s own Email — no second auth path', () => {
  const service = code(read(`${API}/account-security.service.ts`));
  assert.match(service, /const verdict = await this\.provider\.grant\(email, password, ip\);/u);
  assert.match(service, /row = await this\.repository\.changeLoginId\(proof, commandId\.toLowerCase\(\), loginId\);/u, 'the Login ID change runs on the PROOF token');
  assert.match(service, /\} finally \{\n\s*await this\.provider\.endSessions\(proof, 'local', ip\);/u, 'the proof session always ends');
  const relay = code(read(`${API}/supabase-password-grant.service.ts`));
  assert.equal((relay.match(/grant_type=/gu) ?? []).length, 1, 'still one grant, once (T-12P)');
  assert.doesNotMatch(relay, /SERVICE_ROLE|service_role|PUBLISHABLE|admin|\/admin\//u, 'no admin or service-role provider call');
  const repository = code(read(`${API}/account-identity.repository.ts`));
  assert.doesNotMatch(repository, /serviceApi|SupabaseServiceRoleApiService/u, 'never the server channel');
});

test('Change Email: non-enumerating, current Email confirmed FIRST, both before any change, then the session ends', () => {
  const relay = code(read(`${API}/supabase-password-grant.service.ts`));
  const request = relay.slice(relay.indexOf('async requestEmailChange('), relay.indexOf('async verifyEmailChangeCode('));
  const nonEnumerating = (text) => /if \(code === 'email_address_invalid' \|\| code === 'validation_failed'\) return \{ kind: 'INVALID_EMAIL' \};/u.test(text) &&
    /return \{ kind: 'ACCEPTED' \};\n\s*\}$/u.test(text.trimEnd()) && !/email_exists/u.test(text);
  guards('taken-email-revealed', request, nonEnumerating, "if (code === 'email_exists') return { kind: 'TAKEN' };");
  const service = code(read(`${API}/account-security.service.ts`));
  const confirm = service.slice(service.indexOf('async confirmEmailChange('), service.indexOf('async changePassword('));
  const currentFirst = (text) => {
    const current = text.indexOf('this.provider.verifyEmailChangeCode(owner.email, currentEmailCode, ip)');
    const next = text.indexOf('this.provider.verifyEmailChangeCode(requested, newEmailCode, ip)');
    // Exactly two verifications: the current Email's, and only after it accepted, the new Email's.
    return (text.match(/verifyEmailChangeCode\(/gu) ?? []).length === 2 && current > 0 && next > current &&
      /if \(current\.kind === 'CODE_REJECTED'\) return \{ outcome: 'CODE_REJECTED' as const \};/u.test(text.slice(current, next));
  };
  guards('new-email-verified-first', confirm, currentFirst, 'const early = await this.provider.verifyEmailChangeCode(requested, newEmailCode, ip);');
  assert.match(service, /private async finishEmailChange\([^)]*\) \{\n\s*if \(providerSession !== null\) await this\.provider\.endSessions\(providerSession, 'local', ip\);\n\s*await this\.provider\.endSessions\(accessToken, 'local', ip\);/u);
});

test('Security & Sign-in: other sessions end on a password change and on recovery; sign-out-others is the provider’s `others`', () => {
  const service = code(read(`${API}/account-security.service.ts`));
  assert.match(service, /await this\.provider\.endSessions\(accessToken, 'others', ip\);\n\s*return \{ outcome: 'CHANGED' as const \};/u);
  assert.match(service, /if \(!\(await this\.provider\.endSessions\(accessToken, 'others', ip\)\)\) throw unavailable\(\);/u, 'no success without the provider’s confirmation');
  const port = code(read('apps/mobile/src/runtime-entry/auth/supabase-auth-port.ts'));
  const update = port.slice(port.indexOf('async updateRecoveredPassword('), port.indexOf('async retireRecoveryGrant('));
  // Every successful recovery ends every session of the account first: one success, one global end, in that order.
  const recoveryEndsAll = (text) => (text.match(/return \{ ok: true \};/gu) ?? []).length === 1 &&
    (text.match(/authRest\('\/logout\?scope=global', 'POST', grant\.accessToken\)/gu) ?? []).length === 1 &&
    /await authRest\('\/logout\?scope=global', 'POST', grant\.accessToken\);\n[\s\S]*await retireGrant\(grant\);\n\s*return \{ ok: true \};/u.test(text);
  guards('recovery-leaves-other-sessions', update, recoveryEndsAll, "if (skipGlobal) { await retireGrant(grant);\n      return { ok: true }; }");
  // The final Sign out (W3-01) is still THIS device only; nothing else in the app asks the SDK for another scope.
  assert.match(port, /const \{ error \} = await signOutOwn\('local'\);/u);
});

// ---------------------------------------------------------------------------------------------------------------
// Mobile
// ---------------------------------------------------------------------------------------------------------------

test('the controller never guesses: state only from an answer or a read; passwords never reported changed without an answer', () => {
  const controller = code(read(`${SETTINGS}/account-identity-controller.ts`));
  const neverOptimistic = (text) => (text.match(/publish\(/gu) ?? []).length === 3 && /return outcome\.kind === 'FAILED' \|\| outcome\.kind === 'NETWORK' \? 'RETRY' : outcome\.kind;/u.test(text);
  guards('password-change-guessed-after-a-lost-answer', controller, neverOptimistic, "if (outcome.kind === 'NETWORK') { publish(state.identity); return 'CHANGED'; }");
  assert.match(controller, /if \(loginIdCommand === null \|\| loginIdCommand\.value !== value\) loginIdCommand = \{ value, id: newCommandId\(\) \};/u, 'one command identity per value');
  assert.match(controller, /const read = await reread\(\);\n\s*if \(read !== null && read\.loginId === value\) \{/u, 'a lost Login ID answer is reconciled by reading');
  // A typed password is never kept by the controller or written anywhere.
  assert.doesNotMatch(controller, /let \w*password|storage|setItem|AsyncStorage|SecureStore/iu);
});

test('the Product surface: one destination, real rows only, Latin content isolated, words only from copy.ts', () => {
  const surface = code(read(`${SETTINGS}/SettingsSurface.tsx`));
  const section = code(read(`${SETTINGS}/AccountSecuritySection.tsx`));
  assert.doesNotMatch(surface + section, /expo-router|router\.(?:push|navigate|replace)|useRouter|<Stack\b|<Modal\b|Alert\.alert/u, 'changes are states, not routes or dialogs');
  assert.equal((surface.match(/onSignOut\(\)/gu) ?? []).length, 1, 'ONE sign-out path (W3-01), which the Email change also ends with');
  const noWords = (text) => !/['"`][^'"`\n]*[؀-ۿ][^'"`\n]*['"`]/u.test(text) && !/['"`](?:Loading|Saving|Changed|Success|Failed|Error|Try again|Verified)[^'"`]*['"`]/u.test(text);
  guards('surfaces-write-their-own-words', surface + section, noWords, "const done = 'تم الحفظ';");
  const noDeferredRows = (text) => !/\b(?:photo|avatar|sharedId|phone|twoFactor|passkey|deviceList|activityLog)\b|coming soon|قريبًا|disabled: true/iu.test(text);
  guards('security-v1-grows-a-deferred-row', surface + section, noDeferredRows, "<ActionRow label='Passkeys' notice={null} busy={false} disabled: true />");
  assert.match(section, /const LRI = String\.fromCodePoint\(0x2066\);/u);
  assert.match(section, /\{ltr \? isolatedLtr\(value\) : value\}/u);
  assert.match(section, /<View style=\{\{ direction: traits\.ltr \? 'ltr' : writing \}\}>\s*<TextInput/u, 'a Latin field is its own LTR context');
  // Nothing is auth.updateUser'd on the device (W2-01): the password change goes through the server.
  for (const file of listFiles('apps/mobile/src').filter((f) => /\.(ts|tsx)$/u.test(f) && !/__tests__/u.test(f))) {
    assert.doesNotMatch(code(read(file)), /auth\.updateUser\(|scope: 'others'/u, file);
  }
});

// R1: the Product Owner approved the four new pairs (C1 final Arabic «تم التحقق»). They are pinned byte-for-byte, and
// they are still the ONLY words this module writes itself.
test('the copy: reused approved words by reference; exactly the four PO-approved pairs of its own', () => {
  const copy = read(`${SETTINGS}/copy.ts`);
  const registry = readJson('docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/data/COPY_REGISTRY.json');
  const rows = Array.isArray(registry) ? registry : registry.rows ?? Object.values(registry).find(Array.isArray);
  const gSecurity = rows.find((row) => row.k === 'gSecurity');
  assert.ok(copy.includes(`'${gSecurity.ar}'`) && copy.includes(`'${gSecurity.en}'`), 'gSecurity, byte-for-byte');
  assert.match(copy, /import \{ accountAccessCopy, accountEntryCopy \} from '\.\.\/account';/u, 'W1B / W2 words by reference, never re-typed');
  const own = code(copy).slice(code(copy).indexOf('const APPROVED'), code(copy).indexOf('function identityCopy'));
  const APPROVED = [
    ['emailVerified', 'تم التحقق', 'Verified'],
    ['signOutOthers', 'تسجيل الخروج من الأجهزة الأخرى', 'Sign out from other devices'],
    ['signedOutOthers', 'تم تسجيل الخروج من الأجهزة الأخرى.', 'Signed out from other devices.'],
    ['passwordIncorrect', 'كلمة المرور غير صحيحة.', 'The password is incorrect.'],
  ];
  const exactlyApproved = (text) => (text.match(/^\s+\w+: '/gmu) ?? []).length === 8 &&
    APPROVED.every(([key, ar, en]) => text.includes(`    ${key}: '${ar}',`) && text.includes(`    ${key}: '${en}',`));
  guards('an-unapproved-string', own, exactlyApproved, "    emailVerified: 'Confirmed',");
  assert.equal(exactlyApproved(own.replace("'تم التحقق'", "'مؤكَّد'")), false, 'the superseded C1 candidate is rejected');
  assert.match(read(RECORD), /APPROVED — PRODUCT OWNER \(W3-MEGA-A R1\)/u);
  assert.doesNotMatch(read(RECORD), /PRODUCT COPY DECISION REQUIRED/u, 'no open copy decision remains for C1–C4');
  // W1B's and W2's own copy modules are byte-for-byte unchanged by this task (their contracts pin them).
});

// ---------------------------------------------------------------------------------------------------------------
// Record
// ---------------------------------------------------------------------------------------------------------------

test('the implementation record tells the truth: Photo blocked, D-03 and D-02 open, D-08 surface waits for W6, not merged', () => {
  const record = read(RECORD);
  assert.match(record, /\*\*Baseline:\*\* `f3355e7e0aafacec4153d9049aa029b65a851c13`/u);
  assert.match(record, /Account Photo — BLOCKED \/ DEFERRED BY MEDIA STORAGE IMPLEMENTATION BOUNDARY/u);
  for (const row of ['E2E-D-02', 'E2E-D-03', 'E2E-D-04', 'E2E-D-05', 'E2E-D-06', 'E2E-D-08']) assert.match(record, new RegExp(row, 'u'));
  const overClaims = (text) => {
    const t = text.replace(/NOT (?:CLOSED|COMPLETE|MERGED)|not closed|is not complete|does not claim[^.]*\./giu, '');
    return /E2E-D-0(?:2|3|8)[^\n|]*\|\s*CLOSED\b/u.test(t) || /W3 is (?:fully )?(?:closed|complete)/iu.test(t) || /\bis merged\b|MERGED \/ CLOSED/u.test(t);
  };
  assert.equal(overClaims(record), false);
  assert.equal(overClaims(`${record}\n| E2E-D-03 | CLOSED |`), true, 'a planted D-03 over-claim is detected');
  assert.equal(overClaims(`${record}\nW3 is closed.`), true, 'a planted W3 over-claim is detected');
});

test('this contract runs in Mobile CI', () => {
  assert.equal(readJson('package.json').scripts['test:w3-mega-a-account-identity-security-contract'], 'node --test tests/w3-mega-a-account-identity-security-contract.test.mjs');
  const mobileCi = read('.github/workflows/mobile-ci.yml');
  assert.match(mobileCi, /run: npm run test:w3-mega-a-account-identity-security-contract\}/u);
  assert.match(mobileCi, /'tests\/w3-mega-a-account-identity-security-contract\.test\.mjs'/u);
});
