import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// W1B-01 — Account Identity + Verified Sign-up + First Use (E2E-A-09, A-13, A-14, B-02, K-02; the
// Product Owner's A-10 decision). Static contract.
//
// The Jest suites and the real-PostgreSQL verifier prove the BEHAVIOUR. This gate guards what they
// cannot: that the Product Owner's decisions and the security posture are true BY CONSTRUCTION of the
// files W1B-01 owns — approved copy only, one Supabase client, no admin surface on the device, no Login
// ID directory, no service role in mobile, an additive migration, and a historical I-08A4 left intact.
//
// Forward safety: every claim is about a file W1B-01 created or a seam it added. No whole-manifest pin,
// no dependency pin, no repository census and no ceiling on later work.

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

const LAYER = 'apps/mobile/src/account';
const LAYER_PRODUCTION = listFiles(LAYER).filter((file) => /\.tsx?$/u.test(file) && !/__tests__|__fixtures__/u.test(file));
const MOBILE_PRODUCTION = listFiles('apps/mobile/src').filter((file) => /\.tsx?$/u.test(file) && !/__tests__|__fixtures__|__validation__/u.test(file));
const RECORD = 'docs/e2e/QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md';
const AMENDMENT = 'docs/canonical-authority/final-product-experience/w1b/QANDEEL_W1B01_FIRST_USE_WELCOME_FIRST_CONVERSATION_OPENING_CONTROLLED_AMENDMENT_v1.0.md';
const I08A4 = 'docs/canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md';

// ---------------------------------------------------------------------------------------------
// §2 — Product copy: exactly the approved strings, in one place, and nothing invented
// ---------------------------------------------------------------------------------------------

const DN = '{display_name}';
const APPROVED = {
  ar: [
    'إنشاء حساب', 'الاسم', 'معرّف الدخول', 'معرّف خاص تستخدمه لتسجيل الدخول إلى قنديل. احتفظ به؛ لن يظهر للآخرين.', 'البريد الإلكتروني',
    'كلمة المرور', 'إنشاء الحساب', 'أدخل الاسم.', 'أدخل معرّف الدخول.',
    'استخدم من 3 إلى 30 حرفًا أو رقمًا بالإنجليزية. ويمكن استخدام . أو - أو _ بين الحروف والأرقام.', 'أدخل بريدًا إلكترونيًا صحيحًا.',
    'كلمة المرور لا تستوفي المتطلبات.', 'معرّف الدخول هذا غير متاح. اختر معرّفًا آخر.', 'تعذّر إنشاء الحساب بهذه البيانات.', 'تعذّر الاتصال. حاول مرة أخرى.',
    'لديك حساب بالفعل؟ تسجيل الدخول', 'تأكيد البريد الإلكتروني', 'أرسلنا رمزًا إلى {email}. أدخل الرمز لتأكيد بريدك.', 'رمز التأكيد', 'تأكيد البريد',
    'لم يصلك الرمز؟ إعادة الإرسال', 'تم إرسال رمز جديد.', 'رمز التأكيد غير صحيح.', 'انتهت صلاحية رمز التأكيد. أرسل رمزًا جديدًا.',
    'تعذّر إرسال رمز التأكيد. حاول مرة أخرى.', 'تعذّر تأكيد البريد الإلكتروني الآن. حاول مرة أخرى.', 'العودة لتسجيل الدخول',
    `أهلًا يا ${DN}.`, 'أنا قنديل. كل ما نتكلم أكثر، أفهمك أكثر وأتذكر ما يهمك، علشان أساعدك تشوف نفسك وحياتك بشكل أوضح.', 'ابدأ بما يشغلك الآن.',
    `أنا معك يا ${DN}.`, 'ابدأ بما يشغلك الآن… حتى لو كان شيئًا لا تعرف كيف تصفه بعد. ونبدأ من هناك.',
    `اهلا يا ${DN} ... انا في انتظارك ... يلا نبدأ`,
  ],
  en: [
    'Create account', 'Name', 'Login ID', "A private ID you can use to sign in to QANDEEL. Keep it safe; it won't be shown to others.", 'Email', 'Password',
    'Enter your name.', 'Enter your Login ID.', 'Use 3–30 English letters or numbers. You can use . - or _ between letters and numbers.',
    'Enter a valid email address.', "The password doesn't meet the requirements.", "This Login ID isn't available. Choose another one.",
    "The account couldn't be created with these details.", 'Couldn’t connect. Try again.', 'Already have an account? Sign in', 'Verify your email',
    'We sent a code to {email}. Enter it to verify your email.', 'Verification code', 'Verify email', "Didn't get the code? Send again",
    'A new code was sent.', 'The verification code is incorrect.', 'This verification code has expired. Send a new one.',
    "The verification code couldn't be sent. Try again.", "We couldn't verify your email right now. Try again.", 'Back to sign in',
    `Welcome, ${DN}.`, "I'm QANDEEL. The more we talk, the better I understand you and remember what matters to you, so I can help you see yourself and your life more clearly.",
    "Start with what's on your mind.", `I'm with you, ${DN}.`,
    "Start with what's on your mind… even if it's something you don't quite know how to describe yet. We'll begin there.",
    `Hi ${DN} ... I'm here, ready when you are ... let's begin`,
  ],
};

/** The copy module's literals, with the isolated substitutions written as their placeholders. */
function copyLiterals() {
  const source = code(read(`${LAYER}/copy.ts`))
    .replace(/\$\{isolate\(displayName\)\}/gu, DN)
    .replace(/\$\{isolate\(email\)\}/gu, '{email}');
  return [...source.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*)\1/gu)].map((match) => match[2]);
}

test('§2 — every approved string is in the one copy module, verbatim', () => {
  const literals = new Set(copyLiterals());
  for (const text of [...APPROVED.ar, ...APPROVED.en]) assert.ok(literals.has(text), `the approved string is missing or altered: ${text}`);
});

test('§2 — the copy module contains no string the Product Owner did not approve', () => {
  const approved = new Set([...APPROVED.ar, ...APPROVED.en]);
  for (const literal of copyLiterals()) {
    if (literal === 'ar' || literal.startsWith('../') || literal === '${FSI}${value}${PDI}') continue;
    assert.ok(approved.has(literal), `an unapproved string is in the copy module: ${literal}`);
  }
  // The superseded long I-08A4 Welcome and Opening are not the production copy.
  const copy = read(`${LAYER}/copy.ts`);
  for (const superseded of ['مع كل حديث بيننا', 'Every time we talk', 'ابدأ من أي شيء يشغلك الآن', 'Start anywhere:', 'قنديل: نور يضيء لك نفسك']) {
    assert.equal(copy.includes(superseded), false, `superseded I-08A4 wording is in the production copy: ${superseded}`);
  }
});

test('§2 — no other module of the layer, and no W1B composition, writes a Product word', () => {
  const arabicLetter = /[؀-ۿ]/u;
  for (const file of [...LAYER_PRODUCTION.filter((f) => !f.endsWith('/copy.ts')), 'apps/mobile/src/integration/composition/ProductRoot.tsx', 'apps/mobile/src/integration/composition/DepthComposition.tsx']) {
    const text = code(read(file));
    assert.doesNotMatch(text, arabicLetter, `${file} writes Arabic outside the copy module`);
    assert.doesNotMatch(text, /(['"])[A-Z][a-z]+ [a-z]+[^'"]*\1/u, `${file} writes an English sentence outside the copy module`);
  }
  // The copy module holds no invisible character in its source: the isolates are written as code points.
  const invisible = [0x2066, 0x2067, 0x2068, 0x2069, 0x200e, 0x200f].map((point) => String.fromCodePoint(point));
  const copySource = read(`${LAYER}/copy.ts`);
  for (const character of invisible) assert.equal(copySource.includes(character), false, 'an invisible bidi character is written into the copy source');
});

// ---------------------------------------------------------------------------------------------
// §3 — auth: one client, the approved OTP flow, no admin surface, the explicit-completion barrier
// ---------------------------------------------------------------------------------------------

test('§3 — one Supabase client, and the port uses the Email OTP flow — never an admin call or a magic link', () => {
  const clients = MOBILE_PRODUCTION.filter((file) => /createClient\(/u.test(code(read(file))));
  assert.deepEqual(clients, ['apps/mobile/src/runtime-entry/auth/supabase-auth-port.ts'], 'exactly one Supabase client in the app');
  const port = code(read('apps/mobile/src/runtime-entry/auth/supabase-auth-port.ts'));
  assert.match(port, /client\.auth\.signUp\(\{\n\s*email,\n\s*password,\n\s*options: \{ data: \{ \[SIGN_UP_METADATA_KEYS\.name\]: identity\.name, \[SIGN_UP_METADATA_KEYS\.loginId\]: identity\.loginId \} \},/u,
    'sign-up sends the Email, the password and only the two namespaced identity values');
  assert.match(port, /client\.auth\.verifyOtp\(\{ email, token: code, type: 'email' \}\)/u, 'the approved 6-digit Email code');
  assert.match(port, /client\.auth\.resend\(\{ type: 'signup', email \}\)/u);
  assert.match(port, /export const SIGN_UP_METADATA_KEYS = Object\.freeze\(\{ name: 'qandeel_name', loginId: 'qandeel_login_id' \} as const\);/u);
  // A project that hands back a session at sign-up is refused, locally discarded, never authenticated.
  assert.match(port, /if \(data\.session !== null && data\.session !== undefined\) \{[\s\S]{0,400}?client\.auth\.signOut\(\{ scope: 'local' \}\);\n\s*return \{ ok: false, failure: \{ kind: 'REFUSED'/u);
  // Every file on the entry path. (The public-config reader names the secret-key prefix precisely in order
  // to refuse it, so it is not a place where a secret could be used.)
  const entryPath = MOBILE_PRODUCTION.filter((file) => /\/(account|runtime-entry\/auth|runtime-entry\/account|integration\/auth-gateway)\//u.test(file));
  assert.ok(entryPath.length >= 10, `the entry path was located, found ${entryPath.length}`);
  for (const file of entryPath) {
    const text = code(read(file));
    for (const forbidden of [/auth\.admin/u, /service_role|serviceRole|SERVICE_ROLE/u, /signInWithOtp|magicLink|emailRedirectTo/u, /sb_secret_/u]) {
      assert.doesNotMatch(text, forbidden, `${file} must not reach ${forbidden}`);
    }
  }
});

test('§3 — only a CURRENT verification may establish an identity, exactly like a sign-in', () => {
  const authority = code(read('apps/mobile/src/runtime-entry/auth/mobile-auth-authority.ts'));
  const verify = authority.slice(authority.indexOf('async verifyEmailCode('), authority.indexOf('async resendEmailCode('));
  assert.match(verify, /operationEpoch \+= 1;\n\s*const epoch = operationEpoch;/u, 'a verification is an explicit command with its own epoch');
  assert.match(verify, /if \(epoch !== operationEpoch\) \{/u, 'a superseded verification is abandoned');
  assert.match(verify, /if \(result\.ok\) acceptExplicitSignInCompletion\(result\.value, epoch\);/u, 'and only the current one establishes');
  const signUp = authority.slice(authority.indexOf('async signUp('), authority.indexOf('async verifyEmailCode('));
  assert.match(signUp, /operationEpoch \+= 1;/u, 'sign-up supersedes anything still in flight');
  assert.equal(signUp.includes('authenticate('), false, 'sign-up authenticates nobody');
  assert.equal(signUp.includes('acceptExplicitSignInCompletion'), false);
  // The observed-event barrier is unchanged: it still does not consult the event kind.
  assert.match(authority, /if \(epochRetired\) return;\n\s*authenticate\(session\);/u);
});

test('§3 — the T-14 gateway directory still creates no account and holds no second auth command', () => {
  const gateway = listFiles('apps/mobile/src/integration/auth-gateway').map((file) => code(read(file))).join('\n');
  for (const absent of ['signUp', 'verifyOtp', 'verifyEmailCode', 'resendEmailCode', 'createAccount', 'Onboarding']) {
    assert.equal(gateway.includes(absent), false, `the gateway directory holds no ${absent}`);
  }
  assert.equal((gateway.match(/signInWithPassword\(/gu) ?? []).length, 1, 'still one place a credential is spent there');
});

// ---------------------------------------------------------------------------------------------
// §4 — privacy: nothing logged, no Login ID directory, no provider words on a surface
// ---------------------------------------------------------------------------------------------

test('§4 — the account layer logs nothing, persists nothing and never shows a provider’s words', () => {
  for (const file of LAYER_PRODUCTION) {
    const text = code(read(file));
    for (const sink of ['console.', 'Sentry', 'analytics', 'captureException', 'AsyncStorage', 'SecureStore', 'expo-sqlite', 'localStorage']) {
      assert.equal(text.includes(sink), false, `${file} must not reach ${sink}`);
    }
    assert.equal(text.includes('.detail'), false, `${file} reads a provider detail`);
    assert.doesNotMatch(text, /\$\{password|\$\{code\b/u, `${file} interpolates a secret`);
  }
  // No Login-ID → Email directory anywhere on the client: the Login ID is sent to exactly two places —
  // the availability question and the sign-up metadata — and nothing maps it to an Email.
  for (const file of MOBILE_PRODUCTION) {
    assert.doesNotMatch(code(read(file)), /login_?id\w*(?:To|For|Of)Email|email\w*(?:For|Of|By)LoginId|resolveLoginId/iu, `${file} resolves a Login ID to an Email`);
  }
  // Nor does the server offer one: the only pre-authentication answer is a boolean.
  assert.doesNotMatch(code(read('apps/api/src/account/account.service.ts')), /email/iu, 'the account service never handles an Email');
  const api = code(read('apps/mobile/src/runtime-entry/account/account-api.ts'));
  assert.match(api, /body: JSON\.stringify\(\{ loginId \}\)/u, 'the Login ID travels in a body');
  assert.doesNotMatch(api, /login-id-availability\?|loginId=/u, 'never in a URL');
});

// ---------------------------------------------------------------------------------------------
// §5 — the database: additive, forward-only, validated server-side, registered
// ---------------------------------------------------------------------------------------------

test('§5 — migration 0123 is additive, leaves 0001/0002 untouched, and validates the sign-up values itself', () => {
  const migration = read('database/migrations/0123_account_identity_first_use_v1.sql');
  // 0001 and 0002 themselves stay byte-identical: database/tests' frozen-migration pins guard that.
  assert.doesNotMatch(migration, /DROP |ALTER TABLE public\.users (?:DROP|ALTER COLUMN)|CREATE OR REPLACE FUNCTION public\.handle_new_auth_user|DROP TRIGGER/u, 'nothing existing is dropped or replaced');
  assert.match(migration, /ADD COLUMN name text,\n\s*ADD COLUMN login_id text,\n\s*ADD COLUMN first_use_completed_at timestamptz;/u, 'three nullable columns, so every existing row stays valid');
  assert.match(migration, /CREATE UNIQUE INDEX users_login_id_key ON public\.users \(login_id\);/u);
  assert.match(migration, /login_id ~ '\^\[a-z0-9\]\+\(\[\._-\]\[a-z0-9\]\+\)\*\$'/u, 'the grammar is enforced in the database');
  assert.match(migration, /CREATE TRIGGER provision_qandeel_user_identity\n\s*AFTER INSERT ON auth\.users/u);
  assert.match(migration, /v_meta \? 'qandeel_name' OR v_meta \? 'qandeel_login_id'/u, 'only the two namespaced keys are read');
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.login_id_is_available_v1\(text\) TO service_role;/u);
  assert.doesNotMatch(migration, /GRANT [^;]*login_id_is_available_v1[^;]*TO [^;]*(anon|authenticated)/u, 'no client role may ask');
  assert.doesNotMatch(migration, /GRANT (?:UPDATE|INSERT|DELETE|ALL)[^;]*ON TABLE public\.users/u, 'no client gains a table write on the account row');
  const pkg = readJson('package.json');
  assert.equal(pkg.scripts['verify:account-identity-first-use:integration'], 'node --env-file-if-exists=.env database/verify-migration-0123.mjs');
  assert.equal((read('.github/workflows/api-ci.yml').match(/run: npm run verify:account-identity-first-use:integration\b/gu) ?? []).length, 1, 'API CI runs the verifier exactly once');
  assert.match(read('database/README.md'), /## W1B-01 - Account identity and first use \(migration 0123\)/u);
});

// ---------------------------------------------------------------------------------------------
// §6 — the API: owner-scoped reads and writes, one pre-authentication boolean
// ---------------------------------------------------------------------------------------------

test('§6 — the account routes: two guarded on the caller’s token, one pre-authentication boolean on the server channel', () => {
  const controller = read('apps/api/src/account/account.controller.ts');
  assert.match(controller, /@Controller\('account'\)\nexport class AccountController/u, 'no class-level guard, so each route states its own');
  assert.match(controller, /@Get\('first-use'\)\n\s*@UseGuards\(SupabaseAuthGuard\)/u);
  assert.match(controller, /@Post\('first-use\/welcome'\)\n\s*@UseGuards\(SupabaseAuthGuard\)/u);
  assert.match(controller, /@Post\('login-id-availability'\)\n\s*@HttpCode\(200\)\n\s*checkLoginIdAvailability\(@Body\(\) body: unknown\)/u);
  const repository = code(read('apps/api/src/account/account.repository.ts'));
  assert.equal((repository.match(/this\.serviceApi\./gu) ?? []).length, 1, 'the server channel answers only the availability question');
  assert.match(repository, /this\.serviceApi\.rpc<boolean>\('login_id_is_available_v1'/u);
  assert.match(repository, /this\.dataApi\.request<AccountFirstUseRow\[\]>\(accessToken, 'rpc\/read_account_first_use_v1'/u);
  assert.match(repository, /this\.dataApi\.request<void>\(accessToken, 'rpc\/complete_first_use_welcome_v1'/u);
  assert.match(read('apps/api/src/conversation/conversation.module.ts'), /imports: \[[^\]]*AccountModule\]/u, 'reached through ConversationModule');
  assert.doesNotMatch(read('apps/api/src/app.module.ts'), /Account/u, 'the application root is unchanged');
});

// ---------------------------------------------------------------------------------------------
// §7 — structure: one route, the Auth Gateway destination, the first-use gate, the opening slot
// ---------------------------------------------------------------------------------------------

test('§7 — the signed-out entry is the Auth Gateway destination under the one route, with no router and no Lantern', () => {
  assert.deepEqual(readdirSync(join(rootPath, 'apps/mobile/src/app')).sort(), ['_layout.tsx', 'index.tsx']);
  const productRoot = code(read('apps/mobile/src/integration/composition/ProductRoot.tsx'));
  assert.match(productRoot, /<SignedOutEntry auth=\{runtime\.auth\} loginIds=\{runtime\.loginIds\} \/>/u);
  assert.equal((productRoot.match(/<AccountEntry\b/gu) ?? []).length, 1);
  assert.equal((productRoot.match(/<ProductSignInGateway\b/gu) ?? []).length, 1, 'T-14’s form is still rendered in one place');
  for (const file of LAYER_PRODUCTION) {
    const text = code(read(file));
    for (const routing of ['expo-router', 'useRouter', 'router.push', '<Redirect', 'navigate(', 'createNativeStackNavigator']) {
      assert.equal(text.includes(routing), false, `${file} reaches a router: ${routing}`);
    }
    assert.doesNotMatch(text, /lantern/iu, `${file} implements none of the Lantern moment (QAN-BL-LANTERN-01)`);
  }
});

test('§7 — first use stands before the world, and the opening is presentation shown only over an empty READ history', () => {
  const depth = code(read('apps/mobile/src/integration/composition/DepthComposition.tsx'));
  assert.match(depth, /<FirstUseGate account=\{runtime\.account\} language=\{locale\.language\} insets=\{edges\}>/u);
  assert.match(depth, /opening=\{<ConversationOpening account=\{runtime\.account\} language=\{locale\.language\} \/>\}/u);
  const surface = code(read('apps/mobile/src/conversation/ConversationSurface.tsx'));
  assert.match(surface, /ListEmptyComponent=\{state\.history === 'READY' \? \(opening \?\? null\) : historyFailure\}/u);
  const runtime = code(read('apps/mobile/src/integration/runtime/integration-runtime.ts'));
  assert.match(runtime, /account: createAccountController\(\{ transport: entry\.accountFor\(bundle\), isCurrent \}\),/u);
  assert.match(runtime, /session\.account\.retire\(\);/u);
  const opening = code(read(`${LAYER}/first-use/ConversationOpening.tsx`));
  assert.match(opening, /if \(state\.status !== 'READY' \|\| state\.displayName === null\) return null;/u, 'no fallback name, ever');
  // An opening is never sent: the account layer holds no Conversation transport.
  for (const file of LAYER_PRODUCTION) assert.equal(code(read(file)).includes('submitTurn'), false, `${file} sends a turn`);
});

// ---------------------------------------------------------------------------------------------
// Registration, record and the controlled amendment
// ---------------------------------------------------------------------------------------------

test('the gate is registered once, the record carries the approval verbatim, and I-08A4 is untouched', () => {
  const manifest = readJson('package.json');
  assert.equal(manifest.scripts['test:w1b-01-account-identity-first-use-contract'], 'node --test tests/w1b-01-account-identity-first-use-contract.test.mjs');
  const workflow = read('.github/workflows/mobile-ci.yml');
  assert.equal((workflow.match(/run: npm run test:w1b-01-account-identity-first-use-contract\b/gu) ?? []).length, 1, 'exactly one gate step');
  assert.equal((workflow.match(/'tests\/w1b-01-account-identity-first-use-contract\.test\.mjs'/gu) ?? []).length, 1, 'exactly one trigger path');

  const record = read(RECORD);
  for (const text of [...APPROVED.ar, ...APPROVED.en]) assert.ok(record.includes(text), `the implementation record must carry the approved string: ${text}`);

  assert.ok(existsSync(new URL(AMENDMENT, root)), 'the controlled amendment exists');
  const amendment = read(AMENDMENT);
  assert.match(amendment, /\*\*Status:\*\* `CANONICAL PRODUCT DECISION RECORD \/ CONTROLLED AMENDMENT — EFFECTIVE \/ FROZEN ON MERGE`/u);
  const provenance = read('docs/canonical-authority/final-product-experience/FINAL_PRODUCT_EXPERIENCE_SOURCE_PROVENANCE.sha256');
  const [pinned] = provenance.split('\n').filter((line) => line.includes('QANDEEL_I-08A4_')).map((line) => line.split(/\s+/u)[0]);
  const actual = createHash('sha256').update(readFileSync(new URL(I08A4, root))).digest('hex');
  assert.equal(actual, pinned, 'I-08A4 is byte-identical to its provenance pin: the amendment is additive');
});
