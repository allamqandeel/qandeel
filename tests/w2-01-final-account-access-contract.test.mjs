import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// W2-01 — Final Account Access Lifecycle (E2E-A-06, A-07, A-08, A-11, A-12). Static contract.
//
// The Jest suites, the API spec and the real-PostgreSQL verifier prove the BEHAVIOUR. This gate guards
// what they cannot: that the Product Owner's decisions and the security posture are true BY CONSTRUCTION
// of the files W2-01 owns — approved copy only; no client-visible Login-ID → Email mapping; one relay of
// the provider's own password grant, rate-limited per reader; recovery authority that can never become a
// signed-in state; "Unknown ≠ Signed Out"; and a proof of its own.
//
// Forward safety: every claim is about a file W2-01 created or a seam it added. No whole-file hash, no
// dependency pin, no repository census and no ceiling on later work. Every predicate is proven to reject
// a planted defect before it is trusted.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));
/** Code only: a comment may name a forbidden thing in order to forbid it. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/[^\n]*/gu, '$1');

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(join(rootPath, dir))) {
    const full = `${dir}/${entry}`;
    if (statSync(join(rootPath, full)).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

/** `predicate(corpus)` must be true, and `predicate(corpus + defect)` must be false. */
function guards(name, corpus, predicate, defect) {
  assert.equal(predicate(corpus), true, `${name}: the real source must satisfy the invariant`);
  assert.equal(predicate(`${corpus}\n${defect}\n`), false, `${name}: the guard does not reject its own planted defect`);
}

const MOBILE_PRODUCTION = listFiles('apps/mobile/src').filter((file) => /\.tsx?$/u.test(file) && !/__tests__|__fixtures__|__validation__/u.test(file));
const ACCESS_COPY = 'apps/mobile/src/account/access/copy.ts';
const SIGN_IN_COPY = 'apps/mobile/src/integration/auth-gateway/product-sign-in-copy.ts';
const PORT = 'apps/mobile/src/runtime-entry/auth/supabase-auth-port.ts';
const AUTHORITY = 'apps/mobile/src/runtime-entry/auth/mobile-auth-authority.ts';
const RECORD = 'docs/e2e/QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md';
const MIGRATION = 'database/migrations/0124_login_id_sign_in_resolution_v1.sql';

// ---------------------------------------------------------------------------------------------
// §2 — Product copy: exactly the approved strings, verbatim, in their one module each
// ---------------------------------------------------------------------------------------------

const APPROVED_ACCESS = {
  ar: [
    'نسيت كلمة المرور؟', 'إعادة تعيين كلمة المرور', 'البريد الإلكتروني', 'إرسال الرمز', 'أدخل بريدًا إلكترونيًا صحيحًا.',
    'إذا كان هذا البريد مرتبطًا بحساب قنديل، أرسلنا لك رمزًا لإعادة تعيين كلمة المرور.', 'رمز إعادة التعيين', 'متابعة',
    'أدخل رمز إعادة التعيين المكوّن من 6 أرقام.', 'تعذّر التحقق من الرمز. تأكد منه أو أرسل رمزًا جديدًا.', 'لم يصلك الرمز؟ إعادة الإرسال',
    'كلمة المرور الجديدة', 'تأكيد كلمة المرور الجديدة', 'كلمتا المرور غير متطابقتين.', 'تغيير كلمة المرور', 'كلمة المرور لا تستوفي المتطلبات.',
    'تعذّر تغيير كلمة المرور الآن. حاول مرة أخرى.', 'تم تغيير كلمة المرور.', 'العودة لتسجيل الدخول', 'تعذّر الاتصال. حاول مرة أخرى.',
    'تعذّر التحقق من جلستك الآن. تحقق من اتصالك وحاول مرة أخرى.', 'إعادة المحاولة',
    // W2-01 R1 — the Login-ID-origin Verify Email instruction (Product Owner approved).
    'أدخل رمز التأكيد الذي أُرسل إلى البريد الإلكتروني المرتبط بحسابك.',
  ],
  en: [
    'Forgot password?', 'Reset password', 'Email', 'Send code', 'Enter a valid email address.',
    'If this email is linked to a QANDEEL account, we sent a password reset code.', 'Reset code', 'Continue', 'Enter the 6-digit reset code.',
    "We couldn't verify this code. Check it or send a new one.", "Didn't get the code? Send again", 'New password', 'Confirm new password',
    "The passwords don't match.", 'Change password', "The password doesn't meet the requirements.", 'We couldn’t change your password right now. Try again.',
    'Password changed.', 'Back to sign in', 'Couldn’t connect. Try again.', 'We couldn’t verify your session right now. Check your connection and try again.', 'Try again',
    'Enter the verification code sent to the email linked to your account.',
  ],
};

const APPROVED_SIGN_IN = {
  ar: ['معرّف الدخول أو البريد الإلكتروني', 'نسيت معرّف الدخول؟ يمكنك استخدام بريدك الإلكتروني بدلًا منه.', 'أدخل معرّف الدخول أو البريد الإلكتروني.',
    'تعذّر تسجيل الدخول بهذه البيانات. تأكد منها وحاول مرة أخرى.', 'انتهت جلستك. سجّل الدخول للمتابعة.'],
  en: ['Login ID or email', 'Forgot your Login ID? You can use your email instead.', 'Enter your Login ID or email.',
    'We couldn’t sign you in with these details. Check them and try again.', 'Your session has ended. Sign in to continue.'],
};

/** The literals of a copy module. */
const literals = (path) => [...code(read(path)).matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*)\1/gu)].map((match) => match[2]);

test('§2 — every approved W2-01 string is in its one copy module, verbatim, and the access module holds nothing else', () => {
  const access = new Set(literals(ACCESS_COPY));
  for (const text of [...APPROVED_ACCESS.ar, ...APPROVED_ACCESS.en]) assert.ok(access.has(text), `approved access string missing or altered: ${text}`);
  const approved = new Set([...APPROVED_ACCESS.ar, ...APPROVED_ACCESS.en]);
  for (const literal of access) {
    if (literal === 'ar' || literal.startsWith('../')) continue;
    assert.ok(approved.has(literal), `an unapproved string is in the access copy module: ${literal}`);
  }
  const signIn = new Set(literals(SIGN_IN_COPY));
  for (const text of [...APPROVED_SIGN_IN.ar, ...APPROVED_SIGN_IN.en]) assert.ok(signIn.has(text), `approved sign-in string missing or altered: ${text}`);
  // T-14's superseded Email-only failure is gone from the Product copy.
  for (const superseded of ['Email or password is incorrect.', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.']) {
    assert.equal(signIn.has(superseded), false, `superseded wording is still Product copy: ${superseded}`);
  }
  // The Product Owner's two copy-gate edits: the local code-shape sentence never claims "incorrect".
  const accessSource = read(ACCESS_COPY);
  assert.doesNotMatch(accessSource, /رمز إعادة التعيين غير صحيح|reset code is incorrect/u, 'the rejected N6 wording must not return');

  guards(
    'no unapproved access string',
    literals(ACCESS_COPY).join('\n'),
    (text) => text.split('\n').every((literal) => literal === 'ar' || literal.startsWith('../') || approved.has(literal)),
    'A new code was sent.',
  );
});

test('§2 — no sentence says an account exists, and a resend never claims a code was sent', () => {
  const access = code(read(ACCESS_COPY));
  const recovery = code(read('apps/mobile/src/account/access/PasswordRecovery.tsx'));
  assert.equal(recovery.includes('resendSucceeded'), false, 'the W1B "A new code was sent." sentence is never used by recovery');
  assert.match(recovery, /say\(outcome\.ok \? \{ text: copy\.recoveryRequested, tone: 'status' \} : \{ text: copy\.network, tone: 'error' \}\);/u,
    'a resend repeats the ONE generic result');
  for (const leak of ['not found', "doesn't exist", 'no account', 'غير موجود', 'لا يوجد حساب']) assert.equal(access.toLowerCase().includes(leak), false, `an enumerating phrase: ${leak}`);
  // Every other file of the account layer and the gateway writes no Product word.
  const arabic = /[؀-ۿ]/u;
  for (const file of MOBILE_PRODUCTION.filter((f) => /\/account\/access\//u.test(f) && !f.endsWith('/copy.ts'))) {
    assert.doesNotMatch(code(read(file)), arabic, `${file} writes Arabic outside the copy module`);
  }
  guards('resend never claims delivery', recovery, (text) => !/resendSucceeded/u.test(text), 'say({ text: copy.resendSucceeded, tone: "status" });');
});

// ---------------------------------------------------------------------------------------------
// §4 / §6 — Login ID sign-in: no client-visible Login-ID → Email directory
// ---------------------------------------------------------------------------------------------

test('§6 — the device never resolves a Login ID to an Email; it sends ONE bounded body and adopts the provider’s tokens', () => {
  for (const file of MOBILE_PRODUCTION) {
    assert.doesNotMatch(code(read(file)), /login_?id\w*(?:To|For|Of)Email|email\w*(?:For|Of|By)LoginId|resolveLoginId|resolve_login_id/iu, `${file} resolves a Login ID to an Email`);
  }
  const port = code(read(PORT));
  assert.match(port, /rest\(`\$\{config\.apiBaseUrl\}\/account\/login-id-sign-in`, 'POST', \{ Accept: 'application\/json' \}, \{ loginId, password \}\)/u,
    'the Login ID and the password travel in a body, and nothing else does');
  assert.match(port, /client\.auth\.setSession\(\{ access_token: accessToken, refresh_token: refreshToken \}\)/u, 'adopted into the ONE client');
  assert.equal((port.match(/client\.auth\.setSession\(/gu) ?? []).length, 1, 'one adoption site, shared by the Login ID sign-in and its verification');
  // W2-01 R1: no Email ever arrives — see the R1 test below.
  // One Supabase client in the whole app.
  assert.deepEqual(MOBILE_PRODUCTION.filter((file) => /createClient\(/u.test(code(read(file)))), ['apps/mobile/src/runtime-entry/auth/supabase-auth-port.ts']);

  guards(
    'no client-side Login ID resolution',
    MOBILE_PRODUCTION.map((file) => code(read(file))).join('\n'),
    (text) => !/resolveLoginId|emailForLoginId/iu.test(text),
    'const email = await resolveLoginId(loginId);',
  );
});

test('§6 — the server: resolution on the service channel only, the provider’s own password grant, and one answer for every refusal', () => {
  const service = code(read('apps/api/src/account/login-id-sign-in.service.ts'));
  const relay = code(read('apps/api/src/account/supabase-password-grant.service.ts'));
  const controller = code(read('apps/api/src/account/login-id-sign-in.controller.ts'));
  const repository = code(read('apps/api/src/account/login-id-sign-in.repository.ts'));
  // An unresolved Login ID is NOT answered early: it spends the same upstream grant on a reserved address.
  assert.match(service, /UNRESOLVED_LOGIN_ID_ADDRESS = 'no-account@login-id\.invalid'/u);
  assert.match(service, /return resolution\.kind === 'RESOLVED' \? resolution\.email : UNRESOLVED_LOGIN_ID_ADDRESS;/u);
  assert.match(service, /this\.passwordGrant\.grant\(addressOf\(resolution\), password, clientIp as string\)/u);
  assert.match(service, /if \(resolution\.kind === 'UNRESOLVED'\) return verdict\.kind === 'UNAVAILABLE' \? verdict : \{ kind: 'INVALID_CREDENTIALS' \};/u);
  // Fail closed before any lookup without a secret key or the reader's address.
  assert.match(service, /if \(!this\.passwordGrant\.isConfigured\(\) \|\| typeof clientIp !== 'string' \|\| clientIp === ''\) return \{ kind: 'UNAVAILABLE' \};/u);
  // The provider validates the password; the reader's address is forwarded so its per-IP limit applies.
  assert.match(relay, /\/auth\/v1\/token\?grant_type=password/u);
  assert.match(relay, /'Sb-Forwarded-For': clientIp/u);
  assert.match(relay, /apikey: secretKey/u);
  assert.match(relay, /process\.env\.SUPABASE_SECRET_KEY/u);
  assert.doesNotMatch(relay, /SERVICE_ROLE|service_role|PUBLISHABLE/u, 'never a legacy or publishable key, which forwarding does not honour');
  // W2-01 R1: no answer carries an Email — not even the 409 for a PROVED password.
  assert.match(controller, /throw new ConflictException\(\{ outcome: 'EMAIL_NOT_CONFIRMED' \}\);/u);
  assert.match(controller, /throw new UnauthorizedException\(\{ outcome: 'INVALID_CREDENTIALS' \}\);/u);
  assert.match(controller, /@Post\('login-id-sign-in'\)\n\s*@HttpCode\(200\)\n\s*async signInWithLoginId\(@Body\(\) body: unknown, @Req\(\) request/u, 'a body, never a URL');
  assert.match(repository, /this\.serviceApi\.rpc<unknown>\('resolve_login_id_sign_in_email_v1', \{ p_login_id: canonicalLoginId \}\)/u);
  // No log, no Sentry breadcrumb, in any of them.
  for (const [name, text] of Object.entries({ service, relay, controller, repository })) {
    assert.doesNotMatch(text, /console\.|Logger|Sentry|captureException/u, `${name} logs nothing`);
  }
  // The W1B service still never handles an Email.
  assert.doesNotMatch(code(read('apps/api/src/account/account.service.ts')), /email/iu);

  guards('no early answer for an unknown Login ID', service, (text) => !/if \(resolution\.kind === 'UNRESOLVED'\) return \{ kind: '\w+' \};\n\s*const verdict/u.test(text),
    "if (resolution.kind === 'UNRESOLVED') return { kind: 'INVALID_CREDENTIALS' };\n    const verdict = await this.passwordGrant.grant(email, password, clientIp);");
  guards('the relay forwards the reader', relay, (text) => /'Sb-Forwarded-For': clientIp/u.test(text) && !/'Sb-Forwarded-For': '/u.test(text), "headers['Sb-Forwarded-For'] = '0.0.0.0'; const h = { 'Sb-Forwarded-For': '0.0.0.0' };");
});

test('W2-01 R1 — a client never learns which Email belongs to a Login ID, including after password proof', () => {
  // (1) The carrier is gone, everywhere: production, fixtures, tests, proof worlds and the API.
  const everywhere = [...listFiles('apps/mobile/src'), ...listFiles('apps/api/src')].filter((file) => /\.(ts|tsx)$/u.test(file));
  for (const file of everywhere) assert.equal(read(file).includes('confirmationEmail'), false, `${file} carries confirmationEmail`);

  // (2) The API: the unconfirmed answer is the bare outcome, and no Login-ID answer carries an Email.
  const service = code(read('apps/api/src/account/login-id-sign-in.service.ts'));
  const controller = code(read('apps/api/src/account/login-id-sign-in.controller.ts'));
  assert.match(service, /\| \{ readonly kind: 'EMAIL_NOT_CONFIRMED' \}\n/u, 'the outcome type holds no Email');
  assert.match(service, /if \(verdict\.kind === 'EMAIL_NOT_CONFIRMED'\) return \{ kind: 'EMAIL_NOT_CONFIRMED' \};/u);
  /** Every object literal an answer is built from — a thrown body or a returned one. */
  const answers = [...controller.matchAll(/(?:Exception\(|return )(\{[^\n]*\})\)?;/gu)].map((match) => match[1]);
  assert.ok(answers.length >= 9, `the controller's answers were located (${answers.length})`);
  const namesAnAddress = (literal) => /\bemail\b|\baddress\b|\baccountId\b|\buserId\b|\buser\b|mask/iu.test(literal.replace(/'EMAIL_NOT_CONFIRMED'/gu, ''));
  for (const literal of answers) assert.equal(namesAnAddress(literal), false, `a Login ID answer names an address or an account: ${literal}`);
  // Verify and resend: resolved on the server, the reserved address for the unresolved, bounded answers.
  assert.match(service, /const verdict = await this\.passwordGrant\.verifyEmailCode\(addressOf\(resolution\), code, clientIp as string\);\n\s*if \(resolution\.kind === 'UNRESOLVED'\) return verdict\.kind === 'UNAVAILABLE' \? verdict : \{ kind: 'CODE_REJECTED' \};/u);
  assert.match(service, /return this\.passwordGrant\.resendEmailCode\(addressOf\(resolution\), clientIp as string\);/u);
  assert.match(controller, /throw new UnauthorizedException\(\{ outcome: 'CODE_REJECTED' \}\);/u);
  assert.match(controller, /return \{ outcome: 'ACCEPTED' \};/u);
  assert.match(controller, /@Post\('login-id-verify-email'\)\n\s*@HttpCode\(200\)\n\s*async verifyLoginIdEmail\(@Body\(\) body: unknown, @Req\(\) request/u, 'a body, never a URL');
  assert.match(controller, /@Post\('login-id-resend-verification'\)\n\s*@HttpCode\(200\)\n\s*async resendLoginIdVerification\(@Body\(\) body: unknown, @Req\(\) request/u);
  const relay = code(read('apps/api/src/account/supabase-password-grant.service.ts'));
  assert.match(relay, /this\.ask\('\/auth\/v1\/verify', \{ type: 'email', email, token: code \}, clientIp\)/u);
  assert.match(relay, /this\.ask\('\/auth\/v1\/resend', \{ type: 'signup', email \}, clientIp\)/u);
  assert.match(relay, /return answer === null \? \{ kind: 'UNAVAILABLE' \} : \{ kind: 'ACCEPTED' \};/u, 'every answered resend is one result');

  // (3) The device: the 409 is read as the bare kind, and no Email field of any answer is ever read.
  const port = code(read(PORT));
  assert.match(port, /if \(answer\.status === 409 && answer\.body\?\.outcome === 'EMAIL_NOT_CONFIRMED'\) return \{ ok: false, failure: \{ kind: 'EMAIL_NOT_CONFIRMED', detail: 'email not confirmed' \} \};/u);
  assert.doesNotMatch(port, /answer\.body\??\.email/u, 'the port never reads an Email out of an API answer');
  assert.match(port, /rest\(`\$\{config\.apiBaseUrl\}\/account\/login-id-verify-email`, 'POST', \{ Accept: 'application\/json' \}, \{ loginId, code \}\)/u);
  assert.match(port, /rest\(`\$\{config\.apiBaseUrl\}\/account\/login-id-resend-verification`, 'POST', \{ Accept: 'application\/json' \}, \{ loginId \}\)/u);
  const authority = code(read(AUTHORITY));
  assert.match(authority, /\| \{ readonly via: 'LOGIN_ID'; readonly loginId: string \};/u, 'the Login-ID branch remembers the Login ID, and nothing else');

  // (4) The Verify Email step: the Login-ID branch shows the approved generic instruction and asks the server.
  const verify = code(read('apps/mobile/src/account/entry/VerifyEmailForm.tsx'));
  assert.match(verify, /const instruction = target\.via === 'EMAIL' \? copy\.verifyInstruction\(target\.email\) : accountAccessCopy\(locale\.language\)\.verifyLinkedEmailInstruction;/u);
  assert.match(verify, /<EntryText text=\{instruction\} /u);
  assert.match(verify, /target\.via === 'EMAIL' \? await auth\.verifyEmailCode\(target\.email, code\) : await auth\.verifyLoginIdEmailCode\(target\.loginId, code\)/u);
  assert.match(verify, /target\.via === 'EMAIL' \? await auth\.resendEmailCode\(target\.email\) : await auth\.resendLoginIdEmailCode\(target\.loginId\)/u);
  const access = new Set(literals(ACCESS_COPY));
  assert.ok(access.has('أدخل رمز التأكيد الذي أُرسل إلى البريد الإلكتروني المرتبط بحسابك.'), 'the approved Arabic instruction, verbatim');
  assert.ok(access.has('Enter the verification code sent to the email linked to your account.'), 'the approved English instruction, verbatim');

  guards('no confirmationEmail anywhere', everywhere.map((file) => read(file)).join('\n'), (text) => !text.includes('confirmationEmail'), 'readonly confirmationEmail?: string;');
  guards('no Login ID answer names an Email', answers.join('\n'), (text) => text.split('\n').every((literal) => !namesAnAddress(literal)), "{ outcome: 'EMAIL_NOT_CONFIRMED', email: outcome.email }");
  guards('the port reads no Email from an answer', port, (text) => !/answer\.body\??\.email/u.test(text), 'const address = answer.body?.email;');
  const INSTRUCTIONS = { en: 'Enter the verification code sent to the email linked to your account.', ar: 'أدخل رمز التأكيد الذي أُرسل إلى البريد الإلكتروني المرتبط بحسابك.' };
  const noDrift = (text) => text.split('\n').filter((literal) => /^Enter the verification code|^أدخل رمز التأكيد/u.test(literal)).sort().join('|') === [INSTRUCTIONS.en, INSTRUCTIONS.ar].sort().join('|');
  guards('the generic instruction does not drift (English)', [...access].join('\n'), noDrift, 'Enter the verification code sent to your email.');
  guards('the generic instruction does not drift (Arabic)', [...access].join('\n'), noDrift, 'أدخل رمز التأكيد الذي أُرسل إلى بريدك.');
});
test('§6 — migration 0124: additive, server channel only, never a client role, and verified in API CI', () => {
  const migration = read(MIGRATION);
  assert.match(migration, /CREATE FUNCTION public\.resolve_login_id_sign_in_email_v1\(p_login_id text\)\nRETURNS text/u);
  assert.match(migration, /SECURITY DEFINER\nSET search_path = ''/u);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.resolve_login_id_sign_in_email_v1\(text\) FROM PUBLIC, anon, authenticated;/u);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.resolve_login_id_sign_in_email_v1\(text\) TO service_role;/u);
  assert.doesNotMatch(migration, /GRANT [^;]*resolve_login_id_sign_in_email_v1[^;]*TO [^;]*(anon|authenticated)/u);
  assert.doesNotMatch(migration, /ALTER TABLE|DROP |CREATE TABLE|CREATE TRIGGER|CREATE OR REPLACE/u, 'one additive function and nothing else');
  assert.equal(readJson('package.json').scripts['verify:login-id-sign-in-resolution:integration'], 'node --env-file-if-exists=.env database/verify-migration-0124.mjs');
  assert.equal((read('.github/workflows/api-ci.yml').match(/run: npm run verify:login-id-sign-in-resolution:integration\b/gu) ?? []).length, 1);
  assert.match(read('database/README.md'), /## W2-01 - Login ID sign-in resolution \(migration 0124\)/u);

  guards('no client role may resolve', migration, (text) => !/TO [^;]*\b(anon|authenticated)\b/u.test(text.replace(/FROM PUBLIC, anon, authenticated/u, '')),
    'GRANT EXECUTE ON FUNCTION public.resolve_login_id_sign_in_email_v1(text) TO authenticated;');
});

// ---------------------------------------------------------------------------------------------
// §7 — password recovery: a temporary authority that can never become the signed-in state
// ---------------------------------------------------------------------------------------------

test('§7 — recovery never passes through the SDK session: no verifyOtp for recovery, no updateUser, no storage', () => {
  const port = code(read(PORT));
  const verify = port.slice(port.indexOf('async verifyRecoveryCode('), port.indexOf('async updateRecoveredPassword('));
  const update = port.slice(port.indexOf('async updateRecoveredPassword('), port.indexOf('async retireRecoveryGrant('));
  assert.match(verify, /authRest\('\/verify', 'POST', null, \{ type: 'recovery', email, token: code \}\)/u, 'recovery semantics, as the SDK sends them');
  for (const forbidden of [/client\.auth\./u, /setSession/u, /storage/u]) {
    assert.doesNotMatch(verify, forbidden, `verifyRecoveryCode reaches ${forbidden}`);
    assert.doesNotMatch(update, forbidden, `updateRecoveredPassword reaches ${forbidden}`);
  }
  assert.match(update, /authRest\('\/user', 'PUT', grant\.accessToken, \{ password \}\)/u);
  assert.match(update, /await retireGrant\(grant\);\n\s*return \{ ok: true \};/u, 'the grant is retired once the password is set');
  assert.match(port, /authRest\('\/logout\?scope=local', 'POST', grant\.accessToken\)/u);
  // Nowhere in the app is the SDK's recovery path used.
  for (const file of MOBILE_PRODUCTION) {
    const text = code(read(file));
    assert.doesNotMatch(text, /type: 'recovery'[^\n]*verifyOtp|verifyOtp\([^)]*recovery|auth\.updateUser\(|PASSWORD_RECOVERY/u, `${file} uses the SDK's persisting recovery path`);
  }

  guards('recovery stays out of the SDK', verify, (text) => !/client\.auth\./u.test(text), "await client.auth.verifyOtp({ email, token: code, type: 'recovery' });");
});

test('§7 — the authority holds the grant in memory and never publishes, authenticates or bootstraps from it', () => {
  const authority = code(read(AUTHORITY));
  /** One method of the authority object, from its signature to its own closing brace. */
  const method = (signature) => {
    const start = authority.indexOf(signature);
    assert.ok(start >= 0, `${signature} was located`);
    return authority.slice(start, authority.indexOf('\n    },', start) + 7);
  };
  const verify = method('async verifyRecoveryCode(');
  const complete = method('async completePasswordRecovery(');
  for (const [name, slice] of Object.entries({ verify, complete })) {
    assert.ok(slice.length > 200, `${name} was located`);
    assert.doesNotMatch(slice, /authenticate\(|acceptExplicitSignInCompletion|acceptObservedAuthChange|publish\(/u, `${name} establishes or publishes nothing`);
  }
  assert.match(verify, /if \(state\.kind !== 'SIGNED_OUT'\) return/u, 'recovery belongs to a signed-out reader only');
  assert.match(verify, /recoveryHold = \{ epoch, grant: result\.value \};\n[\s\S]{0,120}?return \{ ok: true \};/u, 'the entry learns only that the code verified');
  assert.match(complete, /hold\.epoch !== operationEpoch/u, 'a superseded authority is refused');
  assert.match(authority, /function authenticate\(session: AuthSessionSnapshot\): void \{\n\s*discardRecoveryHold\(\);/u, 'an identity retires any recovery authority');
  // The UI never holds it.
  for (const file of MOBILE_PRODUCTION.filter((f) => /\/account\//u.test(f))) {
    assert.doesNotMatch(code(read(file)), /RecoveryGrant|accessToken|refreshToken/u, `${file} holds recovery authority`);
  }

  guards('recovery never authenticates', verify, (text) => !/authenticate\(/u.test(text), 'authenticate({ userId: grant.userId, accessToken: grant.accessToken });');
});

// ---------------------------------------------------------------------------------------------
// §9 — Unknown ≠ Signed Out; a confirmed ended session → Sign in with its notice
// ---------------------------------------------------------------------------------------------

test('§9 — ended versus unknown is the auth owner’s evidence, and no clock decides it', () => {
  const authority = code(read(AUTHORITY));
  assert.equal((authority.match(/publish\(\{ kind: 'SIGNED_OUT', sessionEnded: true \}\)/gu) ?? []).length, 2, 'two evidence sites');
  assert.match(authority, /const ended = state\.kind === 'AUTHENTICATED' && !epochRetired;/u, 'an explicit sign-out (retired epoch) is never an ending');
  assert.match(authority, /if \(restored\.failure\.kind === 'SESSION_ENDED'\) \{/u);
  assert.match(authority, /publish\(\{ kind: 'ERROR', failure: restored\.failure \}\);/u, 'anything else stays unknown');
  const retry = authority.slice(authority.indexOf('retrySessionVerification() {'), authority.indexOf('async signInWithIdentifier('));
  assert.match(retry, /if \(disposed \|\| state\.kind !== 'ERROR'\) return Promise\.resolve\(state\);/u);
  assert.doesNotMatch(retry, /kind: 'RESTORING'/u, 'a retry never passes back through RESTORING');
  const port = code(read(PORT));
  assert.match(port, /if \(error\?\.name === 'AuthRetryableFetchError'\) return false;/u, 'a retryable failure proves nothing');
  for (const file of [PORT, AUTHORITY]) assert.doesNotMatch(code(read(file)), /Date\.now|expires_at|expiresAt/u, `${file} holds no credential clock`);
  const productRoot = code(read('apps/mobile/src/integration/composition/ProductRoot.tsx'));
  assert.match(productRoot, /const sessionEnded = authState\.kind === 'SIGNED_OUT' && authState\.sessionEnded === true;/u, 'the notice is read from the auth owner');
  assert.match(productRoot, /if \(phase\.kind === 'AUTH_ERROR'\) \{\n\s*return \(\n\s*<SafeAreaProvider[^>]*>\n\s*<SessionUnverifiedEntry auth=\{runtime\.auth\} \/>/u);

  guards('no clock-made ending', authority, (text) => !/Date\.now/u.test(text), "if (Date.now() > expiry) publish({ kind: 'SIGNED_OUT', sessionEnded: true });");
});

// ---------------------------------------------------------------------------------------------
// §16 — proof: W2's own, and the W1B proof untouched; §8 the external Email gate; the record
// ---------------------------------------------------------------------------------------------

test('§16 — the W2 proof is its own: own script, own flows, own workflow, own selector; nothing sources the W1B script', () => {
  assert.ok(existsSync(new URL('scripts/w2/run-w2-01-proof.sh', root)));
  const script = read('scripts/w2/run-w2-01-proof.sh');
  assert.doesNotMatch(script.replace(/^#[^\n]*$/gmu, ''), /run-w1b-proof\.sh/u, 'the W2 proof does not source or run the W1B script');
  for (const flow of ['w2-01-choose.yaml', 'w2-01-sign-in-recovery.yaml', 'w2-01-session-states.yaml', 'w2-01-sign-in-keyboard.yaml', 'w2-01-new-password-keyboard.yaml', 'w2-01-login-id-unverified.yaml']) {
    assert.ok(existsSync(new URL(`apps/mobile/.maestro/${flow}`, root)), `${flow} exists`);
    assert.ok(script.includes(flow) || flow === 'w2-01-choose.yaml', `${flow} is driven`);
  }
  const workflow = read('.github/workflows/w2-01-visual-proof.yml');
  assert.match(workflow, /branches: \['feat\/w2-01-final-account-access'\]/u, 'scoped to the W2-01 branch');
  assert.match(workflow, /script: bash scripts\/w2\/run-w2-01-proof\.sh/u);
  assert.match(read('apps/mobile/scripts/select-w2-proof-entry.mjs'), /process\.env\.W201_VISUAL_PROOF !== '1'/u);
  // The proof root is validation only: no Product module imports it.
  for (const file of MOBILE_PRODUCTION) assert.doesNotMatch(code(read(file)), /__validation__/u, `${file} imports validation tooling`);
  assert.equal(readJson('apps/mobile/package.json').main, 'expo-router/entry', 'the Product build still registers the Product root');
});

test('§8 / §14 — the record carries every approval verbatim, the external Email gate stays open, and the gate is registered once', () => {
  assert.ok(existsSync(new URL(RECORD, root)), 'the implementation record exists');
  const record = read(RECORD);
  for (const text of [...APPROVED_ACCESS.ar, ...APPROVED_ACCESS.en, ...APPROVED_SIGN_IN.ar, ...APPROVED_SIGN_IN.en]) {
    assert.ok(record.includes(text), `the record must carry the approved string: ${text}`);
  }
  assert.match(record, /Live branded transactional Email delivery = EXTERNAL \/ NOT PROVED/u, 'the external Email-delivery gate is recorded, open');
  assert.doesNotMatch(record, /Live branded transactional Email delivery = (?:PROVED|CLOSED)/u, 'and never marked closed');
  assert.match(record, /\*\*Status:\*\* IMPLEMENTED ON A DRAFT PR — NOT MERGED/u, 'lifecycle truth: not merged until merged');
  assert.ok(record.includes('A client never learns which Email belongs to a Login ID — including after password proof.'), 'W2-01 R1: the Product Owner clarification, verbatim');
  const manifest = readJson('package.json');
  assert.equal(manifest.scripts['test:w2-01-final-account-access-contract'], 'node --test tests/w2-01-final-account-access-contract.test.mjs');
  const workflow = read('.github/workflows/mobile-ci.yml');
  assert.equal((workflow.match(/run: npm run test:w2-01-final-account-access-contract\b/gu) ?? []).length, 1, 'exactly one gate step');
  assert.equal((workflow.match(/'tests\/w2-01-final-account-access-contract\.test\.mjs'/gu) ?? []).length, 1, 'exactly one trigger path');
  // No Email-delivery vendor was chosen or wired.
  for (const file of [...MOBILE_PRODUCTION, ...listFiles('apps/api/src').filter((f) => f.endsWith('.ts'))]) {
    assert.doesNotMatch(code(read(file)), /\bresend\.com|@sendgrid|postmark|aws-sdk\/client-ses|nodemailer|SMTP_/iu, `${file} wires an Email vendor`);
  }
});
