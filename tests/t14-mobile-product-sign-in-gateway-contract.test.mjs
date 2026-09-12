import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// T-14 — Mobile Product Sign-In Gateway v1. Static executable contract.
//
// > **A signed-out reader has one real Product entry, and it calls the authentication system that
// > already exists.**
//
// The Jest suites under `apps/mobile/src/integration/__tests__` prove the BEHAVIOUR — the exact
// bilingual copy, the trimmed email and the byte-exact password, the three typed failures mapped to
// frozen sentences, the single in-flight request, the password disposition after each failure, the
// accessible tree, and the end-to-end handover to the existing runtime over T-12P's own seams. This
// gate guards what a passing component test cannot: that the things T-14 must NOT have are absent by
// CONSTRUCTION rather than merely unused, and that an adapter did not quietly become a second
// authentication system while adapting.
//
// ## Forward safety
//
// Nothing here is a ceiling on the repository. There is no file count, no line count, no whole-file
// hash of anything shared, no dependency census beyond the manifest T-14 itself must not change, and
// no "no migration after N". Every claim is either a PERMANENT INVARIANT of this boundary or a
// statement about files T-14 itself owns. The frozen copy is deliberately NOT pinned string by
// string here — the Jest suite owns that, where a wording change belongs — and what is asserted
// instead is the structural fact that outlives any wording: every reader-facing word lives in the
// one copy module, and the component writes none.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));

/** Code only: a comment may name a forbidden pattern in order to forbid it. */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');

const MOBILE_SRC = 'apps/mobile/src';
const GATEWAY_DIR = `${MOBILE_SRC}/integration/auth-gateway`;
const PRODUCT_ROOT = `${MOBILE_SRC}/integration/composition/ProductRoot.tsx`;
const INTEGRATION_RUNTIME = `${MOBILE_SRC}/integration/runtime/integration-runtime.ts`;
const DOC = 'docs/mobile-product-sign-in-gateway-v1.md';
const BACKLOG = 'docs/qandeel-canonical-backlog-v1.md';

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

const gatewayFiles = listFiles(join(rootPath, GATEWAY_DIR))
  .map((file) => file.slice(join(rootPath, GATEWAY_DIR).length + 1).replace(/\\/gu, '/'))
  .sort();
const gatewayRaw = Object.fromEntries(gatewayFiles.map((name) => [name, read(`${GATEWAY_DIR}/${name}`)]));
const gatewayText = Object.values(gatewayRaw).join('\n');
const gatewayCode = stripComments(gatewayText);

const component = stripComments(gatewayRaw['ProductSignInGateway.tsx']);
const copyModule = stripComments(gatewayRaw['product-sign-in-copy.ts']);
const productRoot = stripComments(read(PRODUCT_ROOT));

/** `predicate(corpus)` must be true, and `predicate(corpus + defect)` must be false. */
function guards(name, corpus, predicate, defect) {
  assert.equal(predicate(corpus), true, `${name}: the real source must satisfy the invariant`);
  assert.equal(predicate(`${corpus}\n${defect}\n`), false, `${name}: the guard does not reject its own planted defect`);
}

// ---------------------------------------------------------------------------------------------
// §3.2 — one route remains one route
// ---------------------------------------------------------------------------------------------

test('§3.2 — the router root is still exactly two files, and the gateway is not a second route', () => {
  // Signed-out versus signed-in is an integration PHASE. It is not route topology, and T-14 does not
  // make it one: no auth stack, no protected group, no redirect between groups.
  assert.deepEqual(readdirSync(join(rootPath, `${MOBILE_SRC}/app`)).sort(), ['_layout.tsx', 'index.tsx']);
  const index = read(`${MOBILE_SRC}/app/index.tsx`);
  assert.match(index, /return <ProductRoot \/>;/u, 'the one route still renders the integrated root');

  for (const routing of ['expo-router', 'useRouter', 'router.push', 'router.replace', 'usePathname', 'useSegments', '<Link', '<Redirect', 'navigate(', 'Stack.Screen', 'createNativeStackNavigator']) {
    assert.equal(gatewayCode.includes(routing), false, `the gateway reaches no router: ${routing}`);
  }

  guards(
    'no route stack in the gateway',
    gatewayCode,
    (text) => !/expo-router|useRouter|<Redirect/u.test(text),
    "import { useRouter } from 'expo-router';",
  );
});

// ---------------------------------------------------------------------------------------------
// §3.3 — the ONE auth action, and nothing that could become a second authority
// ---------------------------------------------------------------------------------------------

test('§3.3 — the gateway consumes MobileAuthAuthority through its barrel and calls exactly one capability', () => {
  // It may consume the frozen authority — that is the whole point of the task — and it reaches it
  // the way every consumer reaches an owner: through the public barrel, never a submodule.
  assert.match(component, /import type \{ MobileAuthAuthority \} from '\.\.\/\.\.\/runtime-entry';/u,
    'the gateway consumes the frozen auth authority by type, through the barrel');
  assert.doesNotMatch(gatewayCode, /from\s+'[^']*runtime-entry\/[^']+'/u, 'and never through a deep internal');

  // ONE call expression. Not "one import", not "one mention": one place where a credential is spent.
  const calls = [...gatewayCode.matchAll(/signInWithPassword\(/gu)];
  assert.equal(calls.length, 1, `the credential is spent in exactly one place, found ${calls.length}`);
  assert.match(component, /await auth\.signInWithPassword\(address, password\)/u,
    'the trimmed address and the untouched password, to the existing capability');

  // And no other auth command is reachable from here at all.
  for (const other of ['signOut(', 'signUp', 'signInWithOAuth', 'signInWithOtp', 'resetPasswordForEmail', 'verifyOtp', 'setSession', 'refreshSession', 'getSession', 'onAuthStateChange', 'startAutoRefresh']) {
    assert.equal(gatewayCode.includes(other), false, `the gateway owns no second auth command: ${other}`);
  }
});

test('§3.3 / §14 — the gateway constructs no client, no storage and no second authority', () => {
  for (const second of [
    '@supabase/supabase-js',
    'createClient',
    'createSupabaseAuthPort',
    'createMobileAuthAuthority',
    'createEphemeralAuthSessionStorage',
    'AuthSessionStorage',
    'expo-sqlite',
    'AsyncStorage',
    'SecureStore',
    'localStorage',
    'sessionStorage',
    'MMKV',
    'expo-file-system',
    'kv-store',
  ]) {
    assert.equal(gatewayCode.includes(second), false, `the gateway must not build or touch ${second}`);
  }
  // No token is inspected, decoded or reasoned about here. The authority forwards credentials; this
  // surface never learns what one is.
  for (const credential of ['accessToken', 'access_token', 'refresh_token', 'refreshToken', 'Bearer', 'jwt', 'JWT', 'atob(', 'authGeneration']) {
    assert.equal(gatewayCode.includes(credential), false, `the gateway inspects no auth material: ${credential}`);
  }
  // Nor is one hardcoded.
  for (const secret of ['eyJ', 'sb_publishable_', 'sb_secret_', 'service_role', 'apikey=']) {
    assert.equal(gatewayText.includes(secret), false, `no credential-shaped literal: ${secret}`);
  }

  guards(
    'no second Supabase client',
    gatewayCode,
    (text) => !/createClient|@supabase\/supabase-js/u.test(text),
    "const client = createClient(url, key);",
  );
  guards(
    'no storage in the gateway',
    gatewayCode,
    (text) => !/AsyncStorage|SecureStore|expo-sqlite/u.test(text),
    "await SecureStore.setItemAsync('k', password);",
  );
});

test('§3.3 — the gateway holds no recovery, no Session, no API client and no canonical state', () => {
  for (const forbidden of [
    '../../recovery',
    'ProductRecovery',
    'createProductRecoveryStore',
    'RecoveryWriter',
    'ConversationSessionApiClient',
    'HistoricalProjectionApiClient',
    'existingSessionId',
    'sessionId',
    'bootstrap',
    'CanonicalStore',
    'createCanonicalStore',
    'dispatch(',
    'fetch(',
    '@qandeel/runtime',
  ]) {
    assert.equal(gatewayCode.includes(forbidden), false, `the gateway is an adapter, not an owner: ${forbidden}`);
  }

  guards(
    'no recovery in the gateway',
    gatewayCode,
    (text) => !/\.\.\/\.\.\/recovery|createProductRecoveryStore/u.test(text),
    "import { createProductRecoveryStore } from '../../recovery';",
  );
  guards(
    'no QANDEEL API client in the gateway',
    gatewayCode,
    (text) => !/ConversationSessionApiClient|fetch\(/u.test(text),
    'const response = await fetch(`${base}/conversation/sessions`);',
  );
});

// ---------------------------------------------------------------------------------------------
// §5 / §21 — the v1 feature scope, and what may not grow beside it
// ---------------------------------------------------------------------------------------------

test('§5 / §21 — no sign-up, reset, social, magic link, OTP, biometric, passkey or visibility toggle exists', () => {
  for (const absent of [
    'signUp',
    'SignUp',
    'createAccount',
    'forgotPassword',
    'ForgotPassword',
    'resetPassword',
    'magicLink',
    'MagicLink',
    'OAuth',
    'GoogleSignin',
    'AppleAuthentication',
    'LocalAuthentication',
    'passkey',
    'Passkey',
    'biometric',
    'rememberMe',
    'Onboarding',
    'Carousel',
    'Paywall',
  ]) {
    assert.equal(gatewayCode.includes(absent), false, `T-14 authorizes no ${absent}`);
  }

  // The password field is masked unconditionally. A visibility toggle would make `secureTextEntry` a
  // BOUND expression, so requiring the bare boolean prop is what forbids the control by construction
  // rather than by remembering not to add it.
  assert.match(component, /\n\s+secureTextEntry\n/u, 'the password field is unconditionally masked');
  assert.equal(component.includes('secureTextEntry='), false, 'the masking is not bound to state');

  guards(
    'no password visibility toggle',
    component,
    (text) => !/secureTextEntry=/u.test(text),
    '<TextInput secureTextEntry={!visible} />',
  );
});

// ---------------------------------------------------------------------------------------------
// §3.1 / §15 — the phase mapping: ONE phase becomes a Product state, and no other
// ---------------------------------------------------------------------------------------------

test('§3.1 / §15 — ProductRoot maps only SIGNED_OUT to the gateway, and every other non-READY phase stays technical', () => {
  // The two reader-facing phases are the only two the root compares against at all. A technical
  // failure or a loading phase cannot be dressed as a Product state here, because there is no branch
  // in which it could be — and that is the thing T-14 most needed to be unable to do.
  const compared = [...productRoot.matchAll(/phase\.kind === '([A-Z_]+)'/gu)].map((match) => match[1]).sort();
  assert.deepEqual(compared, ['READY', 'SIGNED_OUT'], 'exactly two reader-facing phases, and they are these two');

  assert.equal((productRoot.match(/<SignedOutEntry\b/gu) ?? []).length, 1, 'one signed-out entry');
  assert.equal((productRoot.match(/<ProductSignInGateway\b/gu) ?? []).length, 1, 'rendered in one place');
  const entryAt = productRoot.indexOf('<SignedOutEntry');
  const guardAt = productRoot.lastIndexOf("if (phase.kind === 'SIGNED_OUT')", entryAt);
  assert.ok(guardAt >= 0, 'the entry is rendered inside the SIGNED_OUT guard');
  assert.equal((productRoot.slice(guardAt, entryAt).match(/if \(phase\.kind/gu) ?? []).length, 1,
    'no other phase guard stands between SIGNED_OUT and the entry');

  // Everything else falls through to the technical state view, in engineering vocabulary.
  assert.match(productRoot, /return <RuntimeState phase=\{phase\.kind\} \/>;/u);
  assert.match(productRoot, /accessibilityLanguage="en"/u, 'the technical state still names its own language');
  assert.match(productRoot, /runtime: \$\{phase\}/u, 'and still names the phase in engineering vocabulary');
  // The root identity is still present in every phase, which is what keeps the boot smoke honest.
  assert.match(productRoot, /testID=\{PRODUCT_ROOT_TEST_ID\}/u);

  // The phase vocabulary itself is untouched: T-14 adds no member and redefines none.
  const runtime = stripComments(read(INTEGRATION_RUNTIME));
  for (const kind of ['CONFIG_REFUSED', 'RESTORING', 'SIGNED_OUT', 'AUTH_ERROR', 'RECOVERING', 'BOOTSTRAPPING', 'BOOTSTRAP_FAILED', 'RECOVERY_FAILED', 'READY']) {
    assert.ok(runtime.includes(`kind: '${kind}'`), `${kind} is still a phase of the one integration runtime`);
  }

  guards(
    'no invented Product state over a technical phase',
    productRoot,
    (text) => [...text.matchAll(/phase\.kind === '([A-Z_]+)'/gu)].every((match) => match[1] === 'READY' || match[1] === 'SIGNED_OUT'),
    "if (phase.kind === 'RECOVERING') return <SignedOutEntry auth={runtime.auth} />;",
  );
});

test('§3.3 / §15 — the gateway is handed the runtime’s own authority, and creates no second runtime', () => {
  assert.match(productRoot, /<SignedOutEntry auth=\{runtime\.auth\} \/>/u, 'the ONE authority the runtime exposes');
  // One runtime per mount, exactly as before: the root still builds it once and T-14 adds no second.
  assert.equal((productRoot.match(/createIntegrationRuntime\(/gu) ?? []).length, 1, 'one runtime per mount');
  assert.equal(gatewayCode.includes('createIntegrationRuntime'), false, 'the gateway builds no runtime');
});

// ---------------------------------------------------------------------------------------------
// §6 / §8 — the failure mapping takes a KIND, and the provider's own words reach no surface
// ---------------------------------------------------------------------------------------------

test('§6 / §8 — raw auth failure detail is never rendered, and cannot be: the mapping takes only the kind', () => {
  // The whole corpus, not just the component: a helper one hop away that interpolated the detail
  // would be just as much of a leak.
  assert.equal(gatewayCode.includes('.detail'), false, 'no expression in the gateway reads a failure detail');
  assert.match(component, /signInFailureMessage\(copy, outcome\.failure\.kind\)/u, 'the KIND selects the sentence');
  // The mapping is total over the frozen vocabulary, and the compiler enforces that rather than a
  // default arm quietly rendering nothing for a kind nobody anticipated.
  assert.match(copyModule, /export type SignInFailureKind = AuthPortFailure\['kind'\];/u,
    'the vocabulary is taken from the frozen port, never re-declared');
  for (const kind of ['INVALID_CREDENTIALS', 'NETWORK', 'UNEXPECTED']) {
    assert.ok(copyModule.includes(`case '${kind}':`), `${kind} is mapped explicitly`);
  }
  assert.equal((copyModule.match(/const exhaustive: never = kind;/gu) ?? []).length, 2,
    'both mappings are exhaustive over the frozen vocabulary');

  guards(
    'no provider detail on a Product surface',
    gatewayCode,
    (text) => !/\.detail/u.test(text),
    'setFailure(outcome.failure.detail);',
  );
});

test('§6 — every reader-facing word lives in the ONE copy module, and the component writes none', () => {
  // Arabic in the component would mean a second place a word can be written, which is how two
  // languages start to disagree. The structural claim outlives any wording change.
  assert.doesNotMatch(component, /[؀-ۿ]/u, 'the component contains no Arabic');
  assert.match(copyModule, /[؀-ۿ]/u, 'the copy module does');
  // Both packs implement ONE interface, so a phrase cannot exist in one language and be missing from
  // the other: the compiler refuses the pack rather than the reader meeting the wrong language.
  assert.match(copyModule, /const ARABIC: ProductSignInCopy = Object\.freeze\(\{/u);
  assert.match(copyModule, /const ENGLISH: ProductSignInCopy = Object\.freeze\(\{/u);
  assert.match(copyModule, /Readonly<Record<ChromeLanguage, ProductSignInCopy>>/u, 'one pack per Product language');
  // And no sentence is assembled in the component either.
  assert.doesNotMatch(component, /["'][A-Z][a-z]+ [a-z]+[^"']*["']/u, 'the component writes no Product sentence');

  guards(
    'no second place a word is written',
    component,
    (text) => !/[؀-ۿ]/u.test(text),
    "const title = 'تسجيل الدخول';",
  );
});

// ---------------------------------------------------------------------------------------------
// §8 / §14 — one request state, no retry loop, and no credential in a log
// ---------------------------------------------------------------------------------------------

test('§8 — there is one in-flight request, refused by a synchronous guard, with no queue and no retry', () => {
  assert.match(component, /if \(inFlight\.current\) return;/u, 'a second submit while pending is refused');
  assert.match(component, /inFlight\.current = true;/u);
  // No timer of any kind, so there is no cadence to argue about and no automatic second attempt.
  for (const scheduled of ['setTimeout', 'setInterval', 'requestAnimationFrame', 'InteractionManager', 'backoff', 'retryCount', 'maxAttempts']) {
    assert.equal(gatewayCode.includes(scheduled), false, `the gateway schedules nothing: ${scheduled}`);
  }
  // And no loop that could turn one reader instruction into several attempts.
  assert.doesNotMatch(component, /\bwhile\s*\(/u, 'no loop around the one call');
  // Surface-local lifecycle only. The authority remains the judge of whether a completion is current.
  assert.match(component, /if \(!live\.current\) return;/u, 'a completion after unmount mutates nothing');
  assert.equal(gatewayCode.includes('AbortController'), false, 'no cancellation the frozen capability does not support');

  guards(
    'no automatic retry loop',
    gatewayCode,
    (text) => !/setTimeout|setInterval|backoff/u.test(text),
    'setTimeout(() => void submit(), 1000);',
  );
});

test('§14 — no credential is logged, echoed, persisted or copied anywhere', () => {
  for (const sink of ['console.', 'Alert.alert', 'Sentry', 'analytics', 'track(', 'logEvent', 'captureException']) {
    assert.equal(gatewayCode.includes(sink), false, `the gateway must not send anything to ${sink}`);
  }
  // The password is component state, and it crosses exactly one boundary: the frozen capability.
  const passwordUses = [...component.matchAll(/\bpassword\b/gu)];
  assert.ok(passwordUses.length > 0, 'the component really does hold a password');
  assert.doesNotMatch(component, /\$\{password/u, 'never interpolated into a string');
  assert.doesNotMatch(component, /\+\s*password\b|\bpassword\s*\+/u, 'never concatenated into one');
  // No credential default and no placeholder: a screenshot of this surface is safe to attach to a
  // review, and a shipped default would be a credential in the repository.
  assert.doesNotMatch(gatewayCode, /(?:email|password)\s*[:=]\s*'[^']+'/u, 'no credential default');
  assert.doesNotMatch(gatewayCode, /(?:email|password)\s*[:=]\s*"[^"]+"/u, 'no credential default');
  assert.equal(gatewayCode.includes('placeholder='), false, 'no credential placeholder');
  // The password is never trimmed or transformed; only the email is, and only at submit.
  assert.match(component, /const address = email\.trim\(\);/u, 'the email is trimmed once, at submit');
  assert.equal(component.includes('password.trim('), false, 'the password is never trimmed');
  assert.equal(component.includes('toLowerCase('), false, 'and nothing is normalized');

  guards(
    'no credential in a log',
    gatewayCode,
    (text) => !/console\.|\$\{password/u.test(text),
    'console.log(`sign-in ${password}`);',
  );
});

// ---------------------------------------------------------------------------------------------
// §10 / §11 / §12 — locale independence, keyboard safety, and the accessible surface
// ---------------------------------------------------------------------------------------------

test('§10 — language and direction stay independent, and no second locale authority appears', () => {
  assert.match(component, /locale\.language/u, 'the words follow the language');
  assert.match(component, /locale\.direction === 'RTL'/u, 'the layout follows the direction');
  // The forbidden derivation, in either spelling.
  assert.doesNotMatch(gatewayCode, /language === 'ar' \?\s*'RTL'/u, 'direction is never derived from language');
  assert.doesNotMatch(gatewayCode, /direction === 'RTL' \?\s*'ar'/u, 'nor language from direction');
  for (const second of ['I18nManager', 'expo-localization', 'getLocales', 'deviceProductLocale', 'productLocale(']) {
    assert.equal(gatewayCode.includes(second), false, `the gateway resolves no locale of its own: ${second}`);
  }
  // It is HANDED the one app-level locale, which the root resolves exactly as it resolves it for the
  // composed world.
  assert.match(component, /readonly locale: ProductLocale;/u);
  assert.match(productRoot, /const locale = useMemo\(\(\) => deviceProductLocale\(\), \[\]\);/u);

  guards(
    'no derived direction',
    gatewayCode,
    (text) => !/language === 'ar' \? 'RTL'/u.test(text),
    "const direction = locale.language === 'ar' ? 'RTL' : 'LTR';",
  );
});

test('§11 — the surface scrolls rather than clips, and nothing is positioned out of reach', () => {
  assert.match(component, /<KeyboardAvoidingView/u, 'the keyboard is accounted for with an existing primitive');
  assert.match(component, /<ScrollView/u, 'and the content scrolls rather than clipping');
  for (const forbidden of ["position: 'absolute'", "overflow: 'hidden'", 'Dimensions.get', 'useWindowDimensions', 'heightPercentageTo', 'vh']) {
    assert.equal(component.includes(forbidden), false, `no fixed-viewport assumption: ${forbidden}`);
  }
  // Font scaling is never disabled, on any label, field or message.
  assert.equal(gatewayCode.includes('allowFontScaling'), false, 'nothing opts out of the reader’s text size');
  assert.equal(gatewayCode.includes('maxFontSizeMultiplier'), false);
  // Every control is a FLOOR for its content, never a fixed height that could clip it.
  assert.doesNotMatch(component, /\bheight: \d/u, 'no fixed control height');
  assert.match(component, /minHeight: 4[48]/u, 'the targets are at least the platform minimum');
  // And no new package was needed for any of it.
  const manifest = readJson('apps/mobile/package.json');
  const declared = new Set([...Object.keys(manifest.dependencies), ...Object.keys(manifest.devDependencies)]);
  for (const match of gatewayCode.matchAll(/from\s+'([^'.][^']*)'/gu)) {
    const specifier = match[1];
    if (specifier.startsWith('@qandeel/')) continue;
    const pkg = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    if (pkg === 'react' || pkg === 'react-native') continue;
    assert.ok(declared.has(pkg), `the gateway imports ${pkg}, which is not declared`);
  }

  guards(
    'no clipped form',
    component,
    (text) => !/overflow: 'hidden'/u.test(text),
    "const styles = { form: { overflow: 'hidden' } };",
  );
});

test('§12 — the accessible surface: a header, two labelled fields, a button, and one polite live region', () => {
  assert.match(component, /accessibilityRole="header"/u, 'the title is a header');
  assert.equal((component.match(/accessibilityLabel=\{copy\.(emailLabel|passwordLabel|submit)\}/gu) ?? []).length, 3,
    'both fields and the control carry an explicit accessible name');
  assert.match(component, /accessibilityRole="button"/u);
  assert.match(component, /accessibilityState=\{\{ disabled: submitting, busy: submitting \}\}/u,
    'disabled and busy are stated while the one request is in flight');
  assert.equal((component.match(/accessibilityLiveRegion="polite"/gu) ?? []).length, 1, 'exactly one live region');
  assert.match(component, /accessibilityLanguage=\{locale\.language\}/u, 'the surface names the language it is written in');
  // Return moves on from the email and submits from the password.
  assert.match(component, /returnKeyType="next"/u);
  assert.match(component, /returnKeyType="done"/u);
  assert.match(component, /onSubmitEditing=\{focusPassword\}/u);
  assert.match(component, /onSubmitEditing=\{onSubmitPress\}/u);
  // The platform autofill and keyboard intent §7 requires.
  assert.match(component, /autoComplete="email"/u);
  assert.match(component, /autoComplete="current-password"/u);
  assert.match(component, /keyboardType="email-address"/u);
  assert.equal((component.match(/autoCapitalize="none"/gu) ?? []).length, 2);
  assert.equal((component.match(/autoCorrect=\{false\}/gu) ?? []).length, 2);
  // Errors are words, not a colour — and the layer names no colour at all, because the final Graphic
  // Language is VI-03's and T-14 freezes none of it.
  assert.doesNotMatch(gatewayCode, /#[0-9a-fA-F]{3,8}\b|rgba?\(|\bcolor:/u, 'T-14 defines no colour');
  for (const visual of ['palette', 'gradient', 'shadowColor', 'fontFamily', 'letterSpacing', 'react-native-reanimated', 'withTiming', 'Animated']) {
    assert.equal(gatewayCode.includes(visual), false, `T-14 is not a visual or motion task: ${visual}`);
  }

  guards(
    'no colour-only error',
    gatewayCode,
    (text) => !/\bcolor:/u.test(text),
    "const styles = { noticeText: { color: '#b00020' } };",
  );
});

// ---------------------------------------------------------------------------------------------
// §19 / §20 — the gate registers itself, and the governance record is reconciled
// ---------------------------------------------------------------------------------------------

test('§19 — the gate registers itself exactly once, and the implementation document exists', () => {
  const manifest = readJson('package.json');
  assert.equal(manifest.scripts['test:t14-mobile-product-sign-in-gateway-contract'],
    'node --test tests/t14-mobile-product-sign-in-gateway-contract.test.mjs');
  const workflow = read('.github/workflows/mobile-ci.yml');
  // Registered exactly once. The two registrations are different strings — the script invocation and
  // the trigger path — so each is counted on its own, and neither is a census of the workflow.
  assert.equal((workflow.match(/run: npm run test:t14-mobile-product-sign-in-gateway-contract\b/gu) ?? []).length, 1,
    'exactly one gate step');
  assert.equal((workflow.match(/'tests\/t14-mobile-product-sign-in-gateway-contract\.test\.mjs'/gu) ?? []).length, 1,
    'exactly one trigger path');
  assert.equal(existsSync(new URL(DOC, root)), true, 'the implementation document exists');
});

test('§2 / §20 — BG-08 reconciliation: the two closed items are tombstones and the security item is untouched', () => {
  const backlog = read(BACKLOG);
  // The LAST block for an id, deliberately. The register's own convention — established by
  // `QAN-BL-T12-04` — is that a closed item keeps its historical pre-closure schema in §5, clearly
  // labelled as historical, and carries its current lifecycle state in the §6 tombstone. Reading the
  // first block would read the history and call it the state.
  const item = (id) => {
    const start = backlog.lastIndexOf(`### \`${id}\``);
    assert.ok(start >= 0, `${id} is a canonical backlog item`);
    const bounds = [backlog.indexOf('\n### ', start + 1), backlog.indexOf('\n## ', start + 1)].filter((at) => at >= 0);
    return backlog.slice(start, bounds.length === 0 ? backlog.length : Math.min(...bounds));
  };

  // T-13 closed; its item is reconciled to a tombstone carrying the closing task, PR and merge SHA.
  const t13 = item('QAN-BL-T13-01');
  assert.match(t13, /\*\*Status:\*\* `CLOSED — TOMBSTONE`/u);
  assert.match(t13, /T-13 — Recovery \/ Persistence v1/u);
  assert.match(t13, /#223/u);
  assert.match(t13, /5d9ba46efc6cf2d391096fcb3784bf2a5588ae15/u);

  // T-14 owns and closes the gateway item.
  const auth = item('QAN-BL-AUTH-01');
  assert.match(auth, /\*\*Status:\*\* `CLOSED — TOMBSTONE`/u);
  assert.match(auth, /T-14 — Mobile Product Sign-In Gateway v1/u);

  // The security residue stays exactly where T-12 left it. T-14 inherits none of it.
  const sec = item('QAN-BL-SEC-01');
  assert.match(sec, /\*\*Status:\*\* `DEFERRED — OWNED`/u);
  assert.match(sec, /\*\*Owner task:\*\* `QAN-SEC-01 — Pre-release Mobile Credential Security`/u);
  // And nothing in the gateway implements it.
  for (const hardening of ['allowBackup', 'Keychain', 'Keystore', 'DataProtection', 'encrypt', 'crypto']) {
    assert.equal(gatewayCode.includes(hardening), false, `QAN-BL-SEC-01 stays deferred: ${hardening}`);
  }

  // The index agrees with the items. A register that disagrees with itself is not a register.
  const index = backlog.slice(backlog.indexOf('## 4. Index'), backlog.indexOf('## 5. Items'));
  assert.match(index, /\| `QAN-BL-T13-01` \|[^\n]*\| `CLOSED — TOMBSTONE` \|/u);
  assert.match(index, /\| `QAN-BL-AUTH-01` \|[^\n]*\| `CLOSED — TOMBSTONE` \|/u);
  assert.match(index, /\| `QAN-BL-SEC-01` \|[^\n]*\| `DEFERRED — OWNED` \|/u);
});

test('§21 — T-14 touches no backend, no database, no migration and no native project', () => {
  // The anti-scope that is checkable rather than merely stated.
  assert.equal(existsSync(new URL('apps/mobile/ios', root)), false, 'no generated native project is committed');
  assert.equal(existsSync(new URL('apps/mobile/android', root)), false);
  for (const forbidden of ['CREATE TABLE', 'migration', 'sql`', 'supabase.from', 'apps/api']) {
    assert.equal(gatewayText.includes(forbidden), false, `T-14 is a Product integration task: ${forbidden}`);
  }
  // And the frozen auth owner itself is unchanged by this task: it still declares the capability the
  // gateway calls, and still owns the storage and the one client.
  const authority = stripComments(read(`${MOBILE_SRC}/runtime-entry/auth/mobile-auth-authority.ts`));
  assert.match(authority, /signInWithPassword\(email: string, password: string\)/u, 'the frozen capability is unchanged');
  const port = stripComments(read(`${MOBILE_SRC}/runtime-entry/auth/supabase-auth-port.ts`));
  assert.equal((port.match(/createClient\(/gu) ?? []).length, 1, 'still exactly one Supabase client in the repository');
});
