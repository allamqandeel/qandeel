// A3-02 — Native Push, Permission & Platform Delivery: the static root contract (Task Contract §16).
//
// It pins what a reviewer would otherwise have to re-derive by reading every file: ONE notification model (A3-01's),
// platform delivery only through the A3-01 verdict, no third-party relay, no committed credential, no raw token or
// content in any log, no badge count, Direct Entry only through Activity's `open`, the disclosure words byte-exact from
// the approved registry, the permission-education copy's status stated (never silently final), and the schema / verifier
// wiring. It is forward-safe: nothing here assumes 0137 is the newest migration.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const walk = (dir) => readdirSync(join(root, dir)).flatMap((name) => {
  const path = `${dir}/${name}`;
  return statSync(join(root, path)).isDirectory() ? walk(path) : [path];
});
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/.*$/gmu, '$1');

const MIGRATION = 'database/migrations/0137_push_platform_delivery_v1.sql';
const VERIFIER = 'database/verify-migration-0137.mjs';
const API = 'apps/api/src/push';
const MOBILE = 'apps/mobile/src/push';
const apiProduction = () => walk(API).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
const mobileProduction = () => walk(MOBILE).filter((f) => /\.tsx?$/u.test(f) && !f.includes('__tests__'));
const REGISTRY = JSON.parse(read('docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/data/COPY_REGISTRY.json')).rows;
const registry = (key) => {
  const row = REGISTRY.find((r) => r.k === key);
  assert.ok(row, `registry row ${key}`);
  return row;
};

test('1 — schema: the two tables, server-only, erased with the account; the verifier is wired', () => {
  const sql = read(MIGRATION);
  assert.match(sql, /CREATE TABLE public\.push_devices/u);
  assert.match(sql, /CREATE TABLE public\.push_delivery_attempts/u);
  assert.equal((sql.match(/user_id uuid NOT NULL REFERENCES public\.users \(id\) ON DELETE CASCADE/gu) ?? []).length, 2, 'both tables erase with the account');
  assert.match(sql, /REVOKE ALL ON TABLE public\.push_devices, public\.push_delivery_attempts FROM PUBLIC, anon, authenticated;/u);
  assert.doesNotMatch(sql, /GRANT SELECT ON TABLE public\.push_/u, 'no client may read a token or per-device evidence');
  assert.doesNotMatch(sql, /CREATE POLICY/u, 'no client policy at all');
  // Unknown stays unknown (D41, D56): no column claims delivery or presentation.
  assert.doesNotMatch(sql.replace(/--.*$/gmu, ''), /delivered_at|presented_at|\bDELIVERED\b|\bPRESENTED\b/u);
  // One intent per (item, device) — D57.
  assert.match(sql, /CONSTRAINT push_delivery_attempts_intent_unique UNIQUE \(item_id, device_id\)/u);
  // No 0137 function writes the user-level attention lifecycle (D53).
  assert.doesNotMatch(sql, /UPDATE public\.activity_items/u);
  assert.ok(existsSync(join(root, VERIFIER)));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['verify:push-platform-delivery:integration'], 'node --env-file-if-exists=.env database/verify-migration-0137.mjs');
  assert.match(read('.github/workflows/api-ci.yml'), /run: npm run verify:push-platform-delivery:integration\b/u);
});

test('2 — ONE notification model: the dispatcher asks A3-01 `platformVerdict` and renders at A3-01 `disclosureLevel`', () => {
  const decision = read(`${API}/push-dispatch-decision.ts`);
  assert.match(decision, /import \{[^}]*platformVerdict[^}]*\} from '\.\.\/activity\/activity-decision'/u);
  assert.doesNotMatch(stripComments(decision), /function (interruptionVerdict|budgetVerdict|disclosureLevel|silenceOf)\b/u, 'no second copy of the A3-01 law');
  const projection = read(`${API}/push-projection.ts`);
  assert.match(projection, /lockSubjectOf/u);
  // The Activity module still exports exactly its one boundary; A3-02 adds no second publisher.
  assert.match(read('apps/api/src/activity/activity.module.ts'), /exports: \[ActivityPublisher\]/u);
  for (const file of apiProduction()) assert.doesNotMatch(stripComments(read(file)), /server_publish_activity_candidate_v1|ActivityPublisher/u, `${file} publishes nothing`);
});

test('3 — platform services only: no third-party relay, no SDK, no new server dependency', () => {
  for (const file of [...apiProduction(), ...mobileProduction()]) {
    const text = stripComments(read(file));
    assert.doesNotMatch(text, /getExpoPushTokenAsync|exp\.host|expo-server-sdk|onesignal|pusher|firebase-admin|@parse\/node-apn|node-apn|web-push/iu, `${file}: no relay or third-party gateway`);
  }
  const transport = stripComments(read(`${API}/push-transport.ts`));
  assert.match(transport, /https:\/\/fcm\.googleapis\.com\/v1\/projects\//u);
  assert.match(transport, /https:\/\/api\.push\.apple\.com/u);
  assert.match(transport, /from 'node:http2'/u);
  const api = JSON.parse(read('apps/api/package.json'));
  for (const name of Object.keys({ ...api.dependencies, ...api.devDependencies })) assert.doesNotMatch(name, /firebase|apn|push|notif/iu, `API dependency ${name}`);
  const mobile = JSON.parse(read('apps/mobile/package.json'));
  assert.equal(mobile.dependencies['expo-notifications'], '~57.0.17', 'the SDK-57 bundled first-party module, and only it');
  for (const name of Object.keys({ ...mobile.dependencies, ...mobile.devDependencies })) {
    if (name !== 'expo-notifications') assert.doesNotMatch(name, /firebase|onesignal|push|notifee/iu, `mobile dependency ${name}`);
  }
});

test('4 — secrets: none committed; credentials only by name, from the deployment', () => {
  const tracked = [...walk('apps/api/src'), ...walk('apps/mobile/src'), ...walk('apps/mobile/plugins'), 'apps/mobile/app.json', 'apps/mobile/app.config.js', MIGRATION, VERIFIER];
  for (const file of tracked) {
    const text = read(file);
    assert.doesNotMatch(text, /-----BEGIN (RSA |EC )?PRIVATE KEY-----/u, `${file}: no private key`);
    assert.doesNotMatch(text, /AIza[0-9A-Za-z_-]{35}|"private_key_id"\s*:/u, `${file}: no Firebase key or service account`);
  }
  assert.equal(existsSync(join(root, 'apps/mobile/google-services.json')), false);
  assert.equal(existsSync(join(root, 'apps/mobile/GoogleService-Info.plist')), false);
  const transport = read(`${API}/push-transport.ts`);
  for (const name of ['QANDEEL_FCM_PROJECT_ID', 'QANDEEL_FCM_CLIENT_EMAIL', 'QANDEEL_FCM_PRIVATE_KEY', 'QANDEEL_APNS_TEAM_ID', 'QANDEEL_APNS_KEY_ID', 'QANDEEL_APNS_PRIVATE_KEY', 'QANDEEL_APNS_TOPIC']) {
    assert.match(transport, new RegExp(`env\\.${name}\\b`, 'u'), `${name} is read from the environment`);
  }
  assert.match(read('apps/mobile/app.config.js'), /process\.env\.QANDEEL_ANDROID_GOOGLE_SERVICES_FILE/u, 'the Firebase client file is a build input, never committed');
});

test('5 — observability without content: no log in the push module; telemetry labels are finite', () => {
  for (const file of [...apiProduction(), ...mobileProduction()]) {
    const text = stripComments(read(file));
    assert.doesNotMatch(text, /console\.|Logger|logger\.|Sentry\.capture/u, `${file} logs nothing`);
  }
  const worker = stripComments(read(`${API}/push-dispatcher.worker.ts`));
  for (const call of worker.matchAll(/recordOperationalOutcome\(([^)]*)\)/gu)) assert.match(call[1], /^'PUSH_DELIVERY', operation, outcome$/u);
  const telemetry = read('apps/api/src/observability/telemetry.service.ts');
  assert.match(telemetry, /\['PUSH_DELIVERY',new Map\(\[/u);
  // The device-side API answers are one outcome word: no token is ever echoed.
  const service = stripComments(read(`${API}/push.service.ts`));
  assert.doesNotMatch(service, /return \{[^}]*(token|pushToken)/u);
});

test('6 — no badge count anywhere outside the app (P3 §6, D44–D48)', () => {
  for (const file of [...apiProduction(), ...mobileProduction()]) {
    const text = stripComments(read(file));
    assert.doesNotMatch(text, /setBadgeCountAsync|notification_count|"badge"|\bbadge:/u, `${file}: no badge`);
  }
  assert.match(read(`${MOBILE}/expo-push-platform.ts`), /allowBadge: false/u);
  assert.match(read(`${MOBILE}/expo-push-platform.ts`), /showBadge: false/u);
  assert.match(read(`${MOBILE}/expo-push-platform.ts`), /shouldSetBadge: false/u);
});

test('7 — native Direct Entry is Activity `open`, never a second deep-link authority (D38–D43)', () => {
  const composition = read('apps/mobile/src/integration/composition/DepthComposition.tsx');
  assert.match(composition, /const enterItem = useCallback\(async \(itemId: string\) => \{\n\s+const outcome = await runtime\.activityFeed\.open\(itemId\);/u);
  assert.match(composition, /void enterItem\(tap\.itemId\);/u);
  assert.match(composition, /await enterItem\(taken\.item\.id\);/u, 'the strip and the notification share ONE entry');
  for (const file of mobileProduction()) {
    assert.doesNotMatch(stripComments(read(file)), /Linking\.(addEventListener|getInitialURL)|useURL|router\.push/u, `${file}: no deep-link handler`);
  }
  assert.match(read(`${MOBILE}/platform-port.ts`), /record\.qandeel === 'a3' && typeof record\.item === 'string' && UUID\.test\(record\.item\)/u, 'the tap payload is read strictly');
  const runtime = read('apps/mobile/src/integration/runtime/integration-runtime.ts');
  assert.match(runtime, /if \(state\.kind === 'SIGNED_OUT' \|\| state\.kind === 'ERROR'\) notificationEntries\.drop\(\);/u, 'signed out drops a pending tap');
  assert.match(runtime, /if \(kind !== 'SIGNED_OUT' && kind !== 'ERROR'\) notificationEntries\.put\(tap\);/u, 'a tap while signed out is not held');
  // The server's message carries an opaque item id only.
  assert.match(read(`${API}/push-projection.ts`), /data: \{ qandeel: 'a3', item: item\.id \}/u);
});

test('8 — the Lock Screen words are the approved registry bytes; L0 is one sentence for every category', () => {
  const projection = read(`${API}/push-projection.ts`);
  const pair = (key) => {
    const row = registry(key);
    return `{ ar: '${row.ar}', en: '${row.en}' }`;
  };
  assert.ok(projection.includes(`l0: ${pair('p3.l0')}`));
  const generic = { QANDEEL: 'p3.generic.qandeel', SHARED: 'p3.generic.shared', PUBLIC: 'p3.generic.public', DISCOVERY: 'p3.generic.discovery', INTRODUCTIONS: 'p3.generic.intro', REMINDERS: 'p3.generic.reminder', ACCOUNT: 'p3.generic.system', SECURITY: 'p3.generic.security' };
  for (const [subject, key] of Object.entries(generic)) assert.ok(projection.includes(`${subject}: ${pair(key)}`), `${subject} ← ${key}`);
  for (const [subject, key] of [['REMINDERS', 'p3.ctxTitle.reminder'], ['ACCOUNT', 'p3.ctxTitle.system'], ['SECURITY', 'p3.ctxTitle.security']]) {
    assert.ok(projection.includes(`${subject}: ${pair(key)}`), `title ${subject} ← ${key}`);
  }
  assert.match(projection, /const channel: PushChannelId = neutral \? 'qandeel'/u, 'L0 uses the neutral channel');
  const copy = read(`${MOBILE}/copy.ts`);
  assert.ok(copy.includes(`'${registry('p3.osOff').ar}'`) && copy.includes(`'${registry('p3.osOff').en}'`), 'p3.osOff byte-exact');
});

test('9 — permission education: the copy authority is explicit; nothing asks at launch; Not now is remembered', () => {
  const copy = read(`${MOBILE}/copy.ts`);
  assert.match(copy, /status: '(PROPOSED — A3-02 PRODUCT COPY GATE — AWAITING THE PRODUCT OWNER|APPROVED BY THE PRODUCT OWNER — A3-02 PRODUCT COPY GATE)'/u);
  for (const key of ['eduTitle', 'eduAllow', 'eduNotNow', 'notNowNote']) assert.equal(registry(`p3.${key}`).st, 'AUDIT_OWNED', `p3.${key} was audit-owned before this gate`);
  const controller = stripComments(read(`${MOBILE}/push-controller.ts`));
  assert.match(controller, /async allow\(\) \{\n\s+if \(!live\(\) \|\| !state\.education\) return;/u, 'the OS prompt only follows the education');
  assert.equal((controller.match(/port\.requestPermission\(\)/gu) ?? []).length, 1, 'ONE call site of the OS prompt');
  assert.doesNotMatch(stripComments(read('apps/mobile/src/integration/runtime/integration-runtime.ts')), /requestPermission/u, 'nothing asks at start');
  assert.match(controller, /store\.declineEducation\(\)/u);
});

test('10 — the gate is wired', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:a3-02-native-push-platform-delivery-contract'], 'node --test tests/a3-02-native-push-platform-delivery-contract.test.mjs');
  assert.match(read('.github/workflows/mobile-ci.yml'), /run: npm run test:a3-02-native-push-platform-delivery-contract\b/u);
  assert.match(read('.github/workflows/api-ci.yml'), /run: npm run test:a3-02-native-push-platform-delivery-contract\b/u);
  assert.equal(relative(root, join(root, MIGRATION)).replace(/\\/gu, '/'), MIGRATION);
});
