import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// T-12P — Mobile Runtime Entry Preconditions v1. Static executable contract over the frozen boundary.
//
// > **The app may now hold a Session. It still holds no Product.**
//
// The Jest suites under `apps/mobile/src/runtime-entry/__tests__` prove the BEHAVIOUR — the config
// fail-closed rules, the auth generation semantics, the non-idempotent create outcome, the
// exactly-once bootstrap, the cursor and generation rules of the driver. This gate guards what a
// passing unit test cannot: that the things this contract rejects are absent by CONSTRUCTION rather
// than merely unused, that the credential boundary is a closure rather than a convention, and that
// the layer did not quietly start doing T-12's or T-13's job.
//
// ## Forward safety
//
// Nothing here is a ceiling on the repository. There is no whole-repo file count, no whole-file hash
// of a shared workflow or manifest, no dependency census, no exhaustive census of CI steps and no
// "no migration after N". Every claim is either a PERMANENT INVARIANT of this boundary or a
// statement about files T-12P itself owns.
//
// Three facts true at closure are deliberately NOT frozen, because freezing them would fail on
// authorized future work rather than on a defect: that the app shell mounts no Product surface, that
// nothing outside this layer imports it yet, and the exact file list inside the layer. What IS
// permanent — and is guarded below — is that a consumer may only ever reach this layer through its
// public barrel, that exactly one module may construct a Supabase client, and that no module here
// may persist Product truth.
//
// ## Non-vacuity
//
// Every scan below is paired with a planted defect: the same predicate is run against a mutated copy
// of the real source and is required to REJECT it. A guard that cannot fail is not a guard, and this
// file states that claim executably rather than in a comment.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));

const ENTRY_DIR = 'apps/mobile/src/runtime-entry';
const SHELL_FILES = ['apps/mobile/src/app/_layout.tsx', 'apps/mobile/src/app/index.tsx', 'apps/mobile/src/shell/FoundationShell.tsx'];

/** Code only: a comment may name a forbidden pattern in order to forbid it. */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function relativeFiles(dir) {
  const absolute = join(rootPath, dir);
  return listFiles(absolute)
    .map((file) => file.slice(absolute.length + 1).replace(/\\/gu, '/'))
    .sort();
}

const allEntryFiles = relativeFiles(ENTRY_DIR);
const entryFiles = allEntryFiles.filter((file) => !file.startsWith('__tests__/') && !file.startsWith('__fixtures__/'));
const entrySources = Object.fromEntries(entryFiles.map((file) => [file, read(`${ENTRY_DIR}/${file}`)]));
const entryCode = Object.fromEntries(Object.entries(entrySources).map(([file, text]) => [file, stripComments(text)]));
const entryText = Object.values(entryCode).join('\n');

/** Every mobile file, production and test, that is NOT part of this layer. */
const mobileOutsideEntry = relativeFiles('apps/mobile/src')
  .filter((file) => !file.startsWith('runtime-entry/'))
  .map((file) => [file, read(`apps/mobile/src/${file}`)]);

const apiFiles = relativeFiles('apps/api/src').filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'));
const apiText = apiFiles.map((file) => stripComments(read(`apps/api/src/${file}`))).join('\n');

// ------------------------------------------------------------------------------------------------
// Non-vacuity: each predicate is proven to REJECT a planted defect before it is trusted.
// ------------------------------------------------------------------------------------------------

/**
 * Assert that `predicate` accepts the real corpus and rejects the same corpus with `defect` planted.
 *
 * `predicate` takes the joined text and returns true when the invariant HOLDS.
 */
function guards(name, corpus, predicate, defect) {
  assert.equal(predicate(corpus), true, `${name}: the real source must satisfy the invariant`);
  assert.equal(predicate(`${corpus}\n${defect}\n`), false, `${name}: the guard does not reject its own planted defect`);
}

// ------------------------------------------------------------------------------------------------

test('the layer exists, is structured as authorized, and has exactly one public barrel', () => {
  assert.ok(entryFiles.includes('index.ts'), 'the public barrel must exist');
  // Every module lives at the root of the layer or in one of the authorized areas. This is a claim
  // about STRUCTURE, not a frozen file list: a new file inside an authorized area stays legal, and a
  // new area does not — which is what keeps the layer from growing a responsibility nobody named.
  const AUTHORIZED_AREAS = ['auth', 'bootstrap', 'config', 'conversation', 'lifecycle', 'live'];
  for (const file of entryFiles) {
    if (!file.includes('/')) continue;
    const area = file.split('/')[0];
    assert.ok(AUTHORIZED_AREAS.includes(area), `unauthorized area in the runtime-entry layer: ${area}`);
  }
  // No second barrel: a nested `index.ts` would create a second public surface by accident.
  const nestedBarrels = entryFiles.filter((file) => file !== 'index.ts' && file.endsWith('/index.ts'));
  assert.deepEqual(nestedBarrels, [], 'the layer has exactly one barrel');
});

test('exactly one module may construct a Supabase client', () => {
  const constructors = entryFiles.filter((file) => /createClient\s*\(/u.test(entryCode[file]));
  assert.deepEqual(constructors, ['auth/supabase-auth-port.ts'], 'the Supabase client has exactly one construction site');
  // And that construction site is not on the public barrel, so no consumer can build a second one.
  assert.doesNotMatch(entryCode['index.ts'], /createSupabaseAuthPort/u, 'the Supabase client factory stays private');
  assert.doesNotMatch(entryCode['index.ts'], /createAuthSessionStorage\b/u, 'the storage implementation stays private');
  assert.doesNotMatch(entryCode['index.ts'], /createCatchUpSchedule/u, 'the scheduler internals stay private');

  guards(
    'one Supabase client',
    entryCode['auth/mobile-auth-authority.ts'],
    (text) => !/createClient\s*\(/u.test(text),
    'const second = createClient(url, key);',
  );
});

test('no credential, secret key or public runtime secret can enter the mobile bundle', () => {
  // The exact regex the mobile foundation contract applies to every git-tracked mobile file. Applied
  // here too, over this layer's tests and fixtures as well, because a fixture leaks just as well as
  // a production module.
  const CREDENTIAL = /(?:ANTHROPIC|OPENAI|GOOGLE_AI|SUPABASE_SERVICE_ROLE)_(?:API_)?KEY|SUPABASE_PUBLISHABLE_KEY|EXPO_PUBLIC_|sk-ant-/u;
  for (const file of allEntryFiles) {
    assert.doesNotMatch(read(`${ENTRY_DIR}/${file}`), CREDENTIAL, `${file} references a credential or public runtime secret`);
  }
  assert.doesNotMatch(read('apps/mobile/app.config.js'), CREDENTIAL, 'app.config.js references a credential');

  // A service-role / secret key must be refused at the config boundary, not merely absent today.
  const config = entryCode['config/mobile-public-config.ts'];
  // R1-04A: an ALLOWLIST of the two documented publishable shapes, not a denylist.
  assert.match(config, /SECRET_KEY_PREFIX = 'sb_secret_'/u, 'the config authority must recognise the elevated prefix');
  assert.match(config, /PUBLISHABLE_KEY_PREFIX = 'sb_publishable_'/u, 'the config authority must allowlist the publishable prefix');
  // A LEGACY elevated key is a JWT whose privilege is in the base64url `role` claim, so the
  // authority must DECODE it. A substring scan would miss the exact mistake it exists to catch.
  assert.match(config, /legacyRoleClaim/u, 'the config authority must decode the legacy role claim');
  assert.match(config, /ALLOWED_LEGACY_ROLE = 'anon'/u, 'only the legacy publishable role is acceptable');
  assert.match(config, /FORBIDDEN_SECRET/u, 'an elevated key must produce a typed refusal');
  assert.match(config, /UNSUPPORTED_KEY_SHAPE/u, 'an unrecognised key shape must fail closed rather than pass through');

  // R1-04B: a cleartext remote origin would put the bearer token and the password on the wire.
  assert.match(config, /parsed\.protocol === 'https:'/u, 'https is the accepted origin scheme');
  assert.match(config, /allowLoopbackHttp/u, 'the http seam is explicit and off by default');
  assert.match(config, /isLoopback\(parsed\.hostname\)/u, 'the http seam admits loopback hosts only');

  guards(
    'credential scan',
    entryText,
    (text) => !CREDENTIAL.test(text),
    "const key = process.env.EXPO_PUBLIC_SUPABASE_URL;",
  );
});

test('R2-01 — only an explicit sign-in completion may cross a retired auth barrier', () => {
  const port = entryCode['auth/supabase-auth-port.ts'];
  const authority = entryCode['auth/mobile-auth-authority.ts'];
  assert.match(port, /AuthChangeKind/u, 'the port must carry the auth event kind');
  assert.match(port, /onAuthStateChange\(\(event, session\)/u, 'the SDK event must not be discarded');

  // The two paths are separate by construction. `GoTrueClient.signInWithPassword` notifies
  // subscribers of SIGNED_IN and AWAITS them before its own promise resolves, so an observed event
  // is never evidence of current user intent and may not establish authentication after a
  // retirement — only the explicit completion, whose operation epoch is still current, may.
  assert.match(authority, /function acceptObservedAuthChange\(/u, 'the observed path is its own function');
  assert.match(authority, /function acceptExplicitSignInCompletion\(/u, 'the explicit path is its own function');
  assert.match(authority, /if \(epochRetired\) return;/u, 'the observed path refuses to establish across a retirement');
  assert.match(authority, /if \(epoch !== operationEpoch\) return;/u, 'a superseded explicit completion is abandoned');
  assert.match(authority, /unsubscribePort = port\.onSessionChange\(acceptObservedAuthChange\)/u, 'the subscriber uses the observed path');

  // Two shapes that were the defect, in R1 and before it, must both be gone.
  assert.doesNotMatch(authority, /epochRetired && kind !== 'SIGNED_IN'/u, 'event kind must not authorize crossing the barrier');
  assert.doesNotMatch(authority, /retired\.accessToken/u, 'token equality must not be used as provenance');

  guards(
    'observed events cannot establish across a retirement',
    authority,
    (text) => /if \(epochRetired\) return;/u.test(text) && !/epochRetired && kind !== 'SIGNED_IN'/u.test(text),
    "if (epochRetired && kind !== 'SIGNED_IN') return;",
  );
});

test('R2-02 — the new-format key prefix is necessary but not sufficient', () => {
  const config = entryCode['config/mobile-public-config.ts'];
  assert.match(config, /function isOpaqueKeyToken\(/u, 'the key must be validated as an opaque header token');

  // Supabase documents the new-format key as `sb_publishable_<22-char-random>_<8-char-checksum>`,
  // so the prefix followed by an arbitrary suffix is acceptance, not validation. The documented
  // STRUCTURE is the fail-closed boundary and must be enforced by construction.
  assert.match(config, /PUBLISHABLE_RANDOM_LENGTH = 22/u, 'the documented random-component length must be stated');
  assert.match(config, /PUBLISHABLE_CHECKSUM_LENGTH = 8/u, 'the documented checksum length must be stated');
  assert.match(config, /function hasDocumentedPublishableBody\(/u, 'the new-format body must be structurally validated');
  assert.match(config, /!hasDocumentedPublishableBody\(publishable\)/u, 'the structural check must gate acceptance');
  // The R2 rule this replaces accepted any non-empty suffix, so its return must be gone.
  assert.doesNotMatch(config, /a new-format key with an empty payload/u, 'the prefix-only rule must not survive');

  // Structure is all that may be checked here. No checksum algorithm is documented — the
  // self-hosting guide notes the API gateway itself does not validate it — so verifying one would
  // mean inventing cryptography, and no character alphabet is documented for either component.
  assert.doesNotMatch(config, /createHash|crypto\.subtle|crc32/iu, 'the client must not invent checksum verification');
  // The raw value is validated: trimming would silently repair config that a build produced wrong.
  assert.match(config, /values\[key\] = raw;/u, 'values are validated raw rather than trimmed into shape');
  assert.doesNotMatch(config, /raw\.trim\(\);/u, 'a value must not be repaired before validation');

  guards(
    'no silent repair of malformed config',
    config,
    (text) => !/raw\.trim\(\);/u.test(text),
    'values[key] = raw.trim();',
  );

  guards(
    'the documented key structure, not the prefix alone',
    config,
    (text) =>
      /!hasDocumentedPublishableBody\(publishable\)/u.test(text) &&
      !/publishable\.length === PUBLISHABLE_KEY_PREFIX\.length/u.test(text),
    'if (publishable.length === PUBLISHABLE_KEY_PREFIX.length) {',
  );

  guards(
    'no invented checksum verification',
    config,
    (text) => !/createHash|crypto\.subtle|crc32/iu.test(text),
    "const sum = createHash('sha256').update(body).digest('hex').slice(0, 8);",
  );
});

test('R1-02 — the credential is read immediately before every request', () => {
  const driver = entryCode['live/foreground-live-driver.ts'];
  assert.match(driver, /function clientForRequest\(\)/u, 'a per-request transport factory must exist');
  assert.match(driver, /current\.authGeneration !== bundle\.authGeneration/u, 'every request re-checks the identity generation');
  // Three request sites, three fresh clients: snapshot, committed page, Live Focus page.
  assert.equal((driver.match(/clientForRequest\(\)/gu) ?? []).length >= 4, true, 'every request site builds its own client');
  assert.doesNotMatch(driver, /const client = createTemporalClient\(current\.accessToken\);/u, 'no cycle-wide client may be reused');

  guards(
    'per-request credential',
    driver,
    (text) => !/const client = createTemporalClient\(current\.accessToken\);/u.test(text),
    'const client = createTemporalClient(current.accessToken);',
  );
});

test('R1-03 — catch-up is merged and applied in strict Session Position order', () => {
  const driver = entryCode['live/foreground-live-driver.ts'];
  assert.match(driver, /type DeliveryEntry/u, 'deliveries must be keyed by Session Position');
  assert.match(driver, /a\.sp === b\.sp \? a\.rank - b\.rank : a\.sp - b\.sp/u, 'entries are ordered by SP, then by the frozen same-SP rank');
  assert.match(driver, /watermark/u, 'a full page must hold back what it cannot yet order');
  // The sequential drain this replaced is what produced 10 -> 12 -> 11, so it must be gone.
  assert.doesNotMatch(driver, /catchUpCommitted|catchUpLiveFocus/u, 'the sequential per-stream drain must not return');
  // Still applied only through the frozen T-03 owners — no new temporal authority.
  assert.match(driver, /applyCommittedUnitsPage\(bundle\.store, \[entry\.event\]\)/u, 'committed deliveries go through the frozen seam');
  assert.match(driver, /applyLiveFocusEventsPage\(bundle\.store, \[entry\.event\]\)/u, 'live-focus deliveries go through the frozen seam');

  guards(
    'no sequential per-stream drain',
    driver,
    (text) => !/catchUpCommitted/u.test(text),
    'async function catchUpCommitted(client) { return; }',
  );
});

test('ambient configuration is read in exactly one module and never from process.env', () => {
  const readers = entryFiles.filter((file) => /expo-constants|Constants\./u.test(entryCode[file]));
  assert.deepEqual(readers, ['config/mobile-public-config.ts'], 'the Expo config is read in exactly one module');
  for (const file of entryFiles) {
    assert.doesNotMatch(entryCode[file], /process\.env/u, `${file} must not read process.env at runtime`);
  }
  // The build-time boundary is the ONLY place an environment variable becomes public config.
  assert.match(read('apps/mobile/app.config.js'), /process\.env\./u, 'app.config.js is the build-time env boundary');

  guards(
    'no runtime process.env',
    entryText,
    (text) => !/process\.env/u.test(text),
    'const base = process.env.QANDEEL_API_BASE_URL;',
  );
});

test('no WebSocket, no SSE, and no background polling path exists', () => {
  for (const forbidden of [/\bWebSocket\b/u, /\bEventSource\b/u, /text\/event-stream/u, /socket\.io/u, /\bws:\/\//u, /\bwss:\/\//u]) {
    assert.doesNotMatch(entryText, forbidden, `the delivery driver must not introduce ${forbidden}`);
  }
  // Every timer in the layer is injected behind a seam so a caller can prove the lifecycle. The one
  // default binding lives in the driver, and the driver stops it on background and on disposal.
  const timerFiles = entryFiles.filter((file) => /\bsetInterval\b|\bsetTimeout\b/u.test(entryCode[file]));
  assert.deepEqual(timerFiles, ['live/foreground-live-driver.ts'], 'exactly one module may own a timer');
  const driver = entryCode['live/foreground-live-driver.ts'];
  assert.match(driver, /options\.setTimer\s*\?\?/u, 'the timer is injectable');
  assert.match(driver, /options\.clearTimer\s*\?\?/u, 'the timer teardown is injectable');
  assert.match(driver, /foreground\.current\(\)\s*===\s*'ACTIVE'/u, 'requests are gated on the foreground state');

  guards(
    'no push transport',
    entryText,
    (text) => !/\bWebSocket\b|\bEventSource\b/u.test(text),
    'const live = new WebSocket(url);',
  );
});

test('the cadence has exactly one owner and is not scattered as a magic number', () => {
  const scheduler = entryCode['live/live-driver-scheduler.ts'];
  assert.match(scheduler, /export const FOREGROUND_CATCH_UP_INTERVAL_MS = 5_000;/u, 'the cadence is pinned in one owner');
  assert.match(scheduler, /export const MAX_CATCH_UP_BACKOFF_MS = 60_000;/u, 'the backoff ceiling is pinned in one owner');
  // No other module may hard-code a cadence.
  for (const file of entryFiles.filter((f) => f !== 'live/live-driver-scheduler.ts')) {
    assert.doesNotMatch(entryCode[file], /\b\d{4,}\s*\/\/?\s*ms\b|\bintervalMs\s*=\s*\d/u, `${file} must not hard-code a cadence`);
  }
});

test('no module in the layer persists Product truth', () => {
  // T-13 owns restart, recovery and persistence. The ONE thing this layer may persist is
  // authentication material, and only through the single storage module.
  const storageUsers = entryFiles.filter((file) => /expo-sqlite|SQLiteStorage/u.test(entryCode[file]));
  assert.deepEqual(storageUsers, ['auth/auth-session-storage.ts'], 'the auth store is the only storage module');

  for (const file of entryFiles) {
    for (const forbidden of [/AsyncStorage/u, /SecureStore/u, /\bMMKV\b/u, /localStorage/u, /FileSystem/u]) {
      assert.doesNotMatch(entryCode[file], forbidden, `${file} must not reach a general persistence API`);
    }
  }
  // Nothing may write canonical state, reversible history or a conversation Session to storage.
  const storage = entryCode['auth/auth-session-storage.ts'];
  for (const forbidden of [/CanonicalState/u, /RhEntry/u, /sessionId/u, /camera/u, /inspection/u]) {
    assert.doesNotMatch(storage, forbidden, 'the auth store must hold authentication material only');
  }

  guards(
    'no Product persistence',
    entryText,
    (text) => !/AsyncStorage|SecureStore|localStorage/u.test(text),
    'await AsyncStorage.setItem("canonical-state", JSON.stringify(state));',
  );
});

test('the conversation Session is never persisted and never synthesised on the client', () => {
  const conversation = entryCode['conversation/conversation-session-api.ts'];
  // The server mints the id. A client that could generate one could also adopt a foreign Session.
  for (const forbidden of [/randomUUID/u, /uuidv4/u, /crypto\.getRandomValues/u]) {
    assert.doesNotMatch(entryText, forbidden, 'the client must never synthesise a Session id');
  }
  assert.match(conversation, /OUTCOME_UNKNOWN/u, 'an ambiguous create must be a typed outcome');
  // The route is NOT idempotent, so a retry would create a second orphaned Session. The client must
  // therefore make exactly one attempt, and the guard says so structurally.
  assert.doesNotMatch(conversation, /\bretry\b|\bretries\b|\battempt\+\+/u, 'the create call must not retry');
  assert.equal((conversation.match(/this\.config\.fetch\(/gu) ?? []).length, 1, 'exactly one request is issued');

  guards(
    'no client-minted Session id',
    entryText,
    (text) => !/randomUUID/u.test(text),
    'const sessionId = randomUUID();',
  );
});

test('the backend gains no mobile token-issuance endpoint', () => {
  // The API stays a VERIFIER. If a future change made it an identity provider, the direct-Supabase
  // decision this layer rests on would silently become something else.
  assert.match(read('apps/api/src/auth/supabase-auth.service.ts'), /auth\/v1\/user/u, 'the API verifies a token');
  for (const forbidden of [/auth\/v1\/token/u, /grant_type/u, /signInWithPassword/u, /issueToken/u, /mintToken/u]) {
    assert.doesNotMatch(apiText, forbidden, `the API must not issue tokens (${forbidden})`);
  }

  guards(
    'no backend token issuance',
    apiText,
    (text) => !/grant_type/u.test(text),
    "const issued = await fetch(`${base}/auth/v1/token?grant_type=password`);",
  );
});

test('the app shell is untouched and mounts nothing from this layer', () => {
  // `FoundationShell` may remain the route output after T-12P; replacing it is T-12's entire job.
  // What is permanent is that T-12P itself mounted nothing.
  for (const file of SHELL_FILES) {
    const text = stripComments(read(file));
    assert.doesNotMatch(text, /runtime-entry/u, `${file} must not mount the runtime entry in T-12P`);
    assert.doesNotMatch(text, /supabase/iu, `${file} must not reach the auth runtime in T-12P`);
  }
  assert.match(read('apps/mobile/src/shell/FoundationShell.tsx'), /T-01 foundation shell/u, 'the technical shell is unchanged');
  // The router root is still exactly two files: no login route, no gateway route.
  assert.deepEqual(readdirSync(join(rootPath, 'apps/mobile/src/app')).sort(), ['_layout.tsx', 'index.tsx']);
  // T-12 §24 RE-ANCHOR. This assertion used to be `qandeel-foundation-shell`, with the reason stated
  // beside it: "because no Product root exists yet". One now does, so the delivery fact expired
  // exactly as its own comment predicted — and keeping it would have forced the very defect T-12's
  // contract forbids, a technical shell rendered invisibly to hold an old smoke green.
  //
  // The permanent claim survives and is what is asserted instead: the smoke names the integrated
  // Product root, and it no longer names the technical shell. T-12P's own boundary — that IT mounted
  // nothing — is unaffected and is asserted above.
  const smoke = read('apps/mobile/.maestro/boot-smoke.yaml');
  assert.match(smoke, /qandeel-product-root/u, 'the boot smoke targets the integrated Product root');
  assert.doesNotMatch(smoke, /qandeel-foundation-shell/u, 'and no longer asserts the technical shell it replaced');
});

test('a consumer may reach this layer only through its public barrel', () => {
  // Permanent: T-12 composes the runtime through the barrel, never a submodule. That is now a real
  // consumer rather than a hypothetical, and it holds — `integration/` imports `'../../runtime-entry'`
  // and nothing deeper.
  //
  // T-12 re-anchor, narrower than it looks. Every PRODUCTION module is still checked and reaching any
  // deep module is still a failure. The one thing now allowed is a TEST or FIXTURE file importing
  // this layer's own `__fixtures__` — the HTTP double, the auth port double, the wire builders — which
  // is what T-08's suites already do with T-07's. Forbidding it would force a second, drifting copy
  // of exactly the doubles this layer built to be driven by, which is a worse outcome than the
  // import: two Supabase doubles that disagree is precisely the defect the fixtures exist to prevent.
  const isTestScaffolding = (file) => /(?:^|\/)__(?:tests|fixtures)__\//u.test(file.replace(/\\/gu, '/'));
  const reachesFixtures = (specifier) => specifier.includes('runtime-entry/__fixtures__/');
  for (const [file, text] of mobileOutsideEntry) {
    const code = stripComments(text);
    for (const match of code.matchAll(/from\s+'([^']*runtime-entry\/[^']+)'/gu)) {
      if (isTestScaffolding(file) && reachesFixtures(match[1])) continue;
      assert.fail(`${file} must not deep-import the runtime entry: ${match[1]}`);
    }
  }

  // Production only: a deep import of a PRIVATE implementation is refused, which is the whole claim.
  guards(
    'no deep import',
    mobileOutsideEntry
      .filter(([file]) => !isTestScaffolding(file))
      .map(([, text]) => stripComments(text))
      .join('\n'),
    (text) => !/from\s+'[^']*runtime-entry\/[^']+'/u.test(text),
    "import { createSupabaseAuthPort } from '../runtime-entry/auth/supabase-auth-port';",
  );
});

test('the layer implements no T-12 backlog item and no T-13 persistence', () => {
  // The nine T-12 items stay T-12's, and T-13 is not authorized at all.
  for (const forbidden of [
    /ExactReturnOrigin/u,
    /bindExactReturnOrigin/u,
    /MeaningIgnition|MEANING_IGNITION/u,
    /GO_LIVE_AND_LOCATE/u,
    /PresentationMotionCause/u,
    /OUTBOARD_LIVE_EXTENT/u,
    /ResponsiveSurface/u,
    /OrientationChrome/u,
    /MapSurface|MapCanvas/u,
    /TimelinePresentation/u,
  ]) {
    assert.doesNotMatch(entryText, forbidden, `T-12P must not implement ${forbidden}`);
  }
  // The one Map symbol this layer may use is the frozen initial camera law, through the public barrel.
  const bootstrap = entryCode['bootstrap/canonical-runtime-bootstrap.ts'];
  assert.match(bootstrap, /import \{ initialCameraIntent \} from '\.\.\/\.\.\/map';/u, 'the initial camera comes from the frozen law');
  assert.match(bootstrap, /temporal: \{ kind: 'FOLLOW_LIVE' \}/u, 'the initial temporal mode is the only legal one');
  assert.match(bootstrap, /inspection: null/u, 'the initial inspection is the canonical nothing');

  guards(
    'no T-12 backlog implementation',
    entryText,
    (text) => !/OrientationChrome|MapSurface/u.test(text),
    'const chrome = <OrientationChrome store={store} />;',
  );
});

test('the layer contains no Product copy and no visual or motion behaviour', () => {
  for (const forbidden of [/react-native-reanimated/u, /useSharedValue/u, /withTiming|withSpring/u, /@shopify\/react-native-skia/u, /StyleSheet/u, /<View/u, /<Text/u]) {
    assert.doesNotMatch(entryText, forbidden, `T-12P adds no UI or motion (${forbidden})`);
  }
  // No .tsx at all: a layer with no component cannot grow a login screen by accident.
  assert.deepEqual(entryFiles.filter((file) => file.endsWith('.tsx')), [], 'the layer has no component');
});

test('the authorized dependency and config seams are declared, and no other was added', () => {
  const mobilePackage = readJson('apps/mobile/package.json');
  // The two dependencies T-12P is authorized to add, with the SDK-bundled pin for the native one.
  assert.equal(mobilePackage.dependencies['expo-sqlite'], '~57.0.2', 'the auth store is pinned to the SDK 57 bundled version');
  // Exact, not a range: the credential-handling dependency that ships must be the one that was
  // audited, and a caret would reintroduce live-registry drift.
  assert.match(mobilePackage.dependencies['@supabase/supabase-js'], /^\d+\.\d+\.\d+$/u, 'the identity SDK is pinned exactly');
  // expo-constants was already declared and is now actually used, which is the authorized config path.
  assert.ok(mobilePackage.dependencies['expo-constants'], 'the config reader is declared');
  // No HTTP or transport library: the driver uses the platform fetch, as the frozen transports do.
  for (const forbidden of ['axios', 'node-fetch', 'undici', 'ws', 'socket.io-client', 'eventsource']) {
    assert.equal(forbidden in (mobilePackage.dependencies ?? {}), false, `${forbidden} must not be introduced`);
    assert.equal(forbidden in (mobilePackage.devDependencies ?? {}), false, `${forbidden} must not be introduced`);
  }
  // app.json stays the static identity and gains no `extra`: the build-time config file owns it.
  assert.equal('extra' in readJson('apps/mobile/app.json').expo, false, 'app.json carries no extra');
  assert.ok(existsSync(new URL('apps/mobile/app.config.js', root)), 'the build-time config boundary exists');
});

test('the T-12P gate is registered at the root and in Mobile CI', () => {
  const scripts = readJson('package.json').scripts;
  assert.equal(
    scripts['test:t12p-mobile-runtime-entry-contract'],
    'node --test tests/t12p-mobile-runtime-entry-contract.test.mjs',
    'the gate is registered as a root script',
  );
  const ci = read('.github/workflows/mobile-ci.yml');
  assert.match(ci, /npm run test:t12p-mobile-runtime-entry-contract/u, 'Mobile CI runs the gate');
  assert.match(ci, /tests\/t12p-mobile-runtime-entry-contract\.test\.mjs/u, 'the gate file triggers Mobile CI');
});

test('the canonical task document exists and records the three closed gates', () => {
  const doc = read('docs/mobile-runtime-entry-preconditions-v1.md');
  for (const required of [
    /AUTHORIZED MOBILE SESSION\/CREDENTIAL SOURCE/u,
    /INITIAL CANONICAL ENTRY STATE/u,
    /LIVE DELIVERY DRIVER/u,
    /T-13/u,
  ]) {
    assert.match(doc, required, 'the task document must record what it closed and what it did not');
  }
  // The storage posture must be stated, not implied, and it must not overstate official guidance.
  assert.match(doc, /not encrypted at rest/u, 'the storage posture is stated plainly');
  assert.match(doc, /QAN-BL-T12-04/u, 'the validation residue is discoverable from the task document');
  assert.doesNotMatch(
    doc,
    /Supabase's own\s+guidance does not use it for sessions/u,
    'the document must not claim official guidance categorically avoids SecureStore',
  );
});

test('the auth-storage validation residue is admitted to the canonical backlog', () => {
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  assert.match(backlog, /\| `QAN-BL-T12-04` \|/u, 'the item appears in the index');
  assert.match(backlog, /### `QAN-BL-T12-04` — Mobile Auth Session Storage Production Security \+ Device Validation/u);
  // The complete schema: every one of the eight fields the register requires.
  const section = backlog.slice(backlog.indexOf('### `QAN-BL-T12-04`'), backlog.indexOf('### `QAN-BL-T13-01`'));
  for (const field of [
    /\*\*Title \/ Finding:\*\*/u,
    /\*\*Source:\*\*/u,
    /\*\*Why deferred:\*\*/u,
    /\*\*Owner task:\*\* `T-12 — Final Integration \/ pre-release physical validation gate`/u,
    /\*\*Severity:\*\* `HIGH`/u,
    /\*\*Reopen condition:\*\*/u,
    /\*\*Status:\*\* `VALIDATION — OPEN`/u,
    /\*\*Validation set:\*\*/u,
  ]) {
    assert.match(section, field, 'the item carries the full canonical schema');
  }
  // It is validation residue, not a T-13 land grab.
  assert.match(section, /not\*\* T-13 Product persistence/u, 'the item states what it is not');
  assert.match(backlog, /`QAN-BL-RSP-01`, `QAN-BL-T12-04`/u, 'T-12 inherits it at the physical validation gate');
  // The mobile README must make it discoverable from the workspace itself.
  assert.match(read('apps/mobile/README.md'), /QAN-BL-T12-04/u, 'the mobile README points at the validation item');
});
