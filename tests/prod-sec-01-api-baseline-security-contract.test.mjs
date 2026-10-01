// PROD-SEC-01 - static source contract for the API Baseline Security direction (SEC-A .. SEC-H).
//
// Real behaviour is proven elsewhere: the API specs in apps/api/src/http-security/ (real sockets, real Express trust
// proxy, real 429s, real headers, the real AppModule) and database/verify-migration-0133.mjs (real PostgreSQL, including
// a scratch database with hosted Supabase's default privileges). This contract pins the shape a refactor could silently
// erode, and EVERY detector is proven to reject the planted defect the Task Contract names (section 16, items 1-27).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootPath = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(rootPath, path), 'utf8').replace(/\r\n/gu, '\n');
/** Source without comments, so a rule about code is never tripped by prose that explains the rule. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/.*$/gmu, '$1');
const sql = (text) => text.replace(/--.*$/gmu, '');
const gitBlobId = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

const API = 'apps/api/src';
const FILES = {
  policy: `${API}/http-security/rate-limit.policy.ts`,
  census: `${API}/http-security/route-rate-limit.census.ts`,
  module: `${API}/http-security/http-security.module.ts`,
  address: `${API}/http-security/client-address.ts`,
  http: `${API}/http-security/http-security.ts`,
  preflight: `${API}/http-security/production-security-preflight.ts`,
  main: `${API}/main.ts`,
  appModule: `${API}/app.module.ts`,
  relay: `${API}/account/supabase-password-grant.service.ts`,
  migration: 'database/migrations/0133_supabase_default_privilege_drift_closure_v1.sql',
  edge: 'infra/LAUNCH_EDGE_SECURITY_CONTRACT_v1.md',
  backlog: 'docs/qandeel-canonical-backlog-v1.md',
  instrumentation: `${API}/observability/instrumentation.ts`,
};
const shipped = Object.fromEntries(Object.entries(FILES).map(([key, path]) => [key, read(path)]));

function listFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}
const productionSources = listFiles(join(rootPath, API))
  .filter((path) => path.endsWith('.ts') && !path.endsWith('.spec.ts'))
  .map((path) => [relative(rootPath, path).replace(/\\/gu, '/'), read(relative(rootPath, path))]);
const controllers = productionSources.filter(([path]) => path.endsWith('.controller.ts'));

const plant = (key, from, to) => {
  assert.ok(shipped[key].includes(from), `planting anchor missing in ${key}: ${from}`);
  return { ...shipped, [key]: shipped[key].replace(from, to) };
};

// ---------------------------------------------------------------------------------------------------------------
// Detectors. Each returns a list of violations (empty = compliant).
// ---------------------------------------------------------------------------------------------------------------

/** 1, 2, 17, 18 — a global guard, every route classified, no external store, health admitted. */
function rateLimitViolations(w, controllerSources = controllers) {
  const out = [];
  const module = code(w.module);
  if (!/provide: APP_GUARD, useClass: QandeelThrottlerGuard/u.test(module) || !/ThrottlerModule\.forRoot\(rateLimitModuleOptions\(\)\)/u.test(module)) out.push('no global throttler guard');
  if (!/imports: \[HttpSecurityModule,/u.test(w.appModule)) out.push('the throttler module is not composed by the application root');
  if (/SkipThrottle|skipIf: \(\) => true/u.test(code(w.policy) + code(w.census))) out.push('a route skips the throttler');
  const census = code(w.census);
  for (const [path, source] of controllerSources) {
    // A path this contract cannot read is itself a violation: the census must be checkable, never silently skipped.
    if (/@(?:Controller|Get|Post|Put|Patch|Delete)\((?!\)|'[^']*'\))/u.test(source)) out.push(`${path}: a route path is not a single-quoted literal`);
    const base = /@Controller\((?:'([^']*)')?\)/u.exec(source)?.[1] ?? '';
    for (const [, verb, sub] of source.matchAll(/@(Get|Post|Put|Patch|Delete)\((?:'([^']*)')?\)/gu)) {
      const key = `${verb.toUpperCase()} /${[base, sub ?? ''].join('/').split('/').filter(Boolean).join('/')}`;
      if (!new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\/]/gu, '\\$&')}': '[A-Z_]+'`, 'u').test(census)) out.push(`${path}: ${key} is not classified`);
    }
  }
  if (/from '\.\.\/(?:account|conversation|understanding|health)\//u.test(census)) out.push('the census imports a controller');
  if (/from '(?:redis|ioredis)'|ThrottlerStorageRedis|storage:/u.test(code(w.policy) + code(w.module))) out.push('the limiter depends on an external store');
  if (/process\.env/u.test(code(w.policy) + code(w.census) + code(w.module))) out.push('the environment can change the limits');
  const health = /HEALTH: \{ perMinute: (\d+), perHour: (null|\d+) \}/u.exec(w.policy);
  if (health === null || Number(health[1]) < 120 || health[2] !== 'null') out.push('health is not admitted at load-balancer cadence');
  return out;
}

/** 3, 26 — the key is the client address only, and the refusal is one generic answer. */
function keyAndAnswerViolations(w) {
  const out = [];
  const policy = code(w.policy);
  const tracker = /export function rateLimitTrackerOf\([^)]*\): string \{([\s\S]*?)\n\}/u.exec(policy)?.[1] ?? '';
  if (!/const address = clientAddressOf\(request\);/u.test(tracker) || /body|loginId|email|publicId|authorization|token|headers/iu.test(tracker)) out.push('the throttle key is not the client address alone');
  const keyFn = /protected override generateKey\([\s\S]*?\n {2}\}/u.exec(policy)?.[0] ?? '';
  if (/body|loginId|email|authorization|token|headers/iu.test(keyFn)) out.push('the throttle key carries request content');
  if (!/throw new HttpException\(RATE_LIMITED_BODY, HttpStatus\.TOO_MANY_REQUESTS\)/u.test(policy) || !/RATE_LIMITED_BODY = Object\.freeze\(\{ outcome: 'RATE_LIMITED' \}\)/u.test(policy)) out.push('the 429 answer is not the one generic body');
  if (!/setHeaders: false,/u.test(policy)) out.push('rate-limit counters are exposed on the wire');
  return out;
}

/** 4, 5, 6 — never trust proxy=true, never a hop count, never a hand-read forwarding header. */
function proxyViolations(w, sources = productionSources) {
  const out = [];
  const all = code(w.address) + code(w.http);
  if (/'trust proxy',\s*true|=== 'true'\s*\?\s*true/u.test(all)) out.push('trust proxy = true');
  if (/'trust proxy',\s*(?:\d|Number\(|parseInt\()/u.test(all)) out.push('a numeric hop count');
  if (!/return configuration\.mode === 'direct' \? false : \[\.\.\.configuration\.trustedProxies\];/u.test(code(w.address))) out.push('the Express setting is not false-or-explicit-list');
  if (!/app\.set\('trust proxy', expressTrustProxySetting\(proxy\)\);/u.test(code(w.http))) out.push('trust proxy is not set from the parsed topology');
  if (!/return prefix >= 1 && prefix <= \(version === 4 \? 32 : 128\);/u.test(code(w.address))) out.push('a zero-prefix (trust-everything) range is admitted');
  // The working copies under test override the same files on disk, so a planted defect is seen.
  const overridden = new Map([[FILES.address, w.address], [FILES.http, w.http], [FILES.relay, w.relay], [FILES.main, w.main]]);
  for (const [path, source] of [...sources.filter(([p]) => !overridden.has(p)), ...overridden]) {
    if (/x-forwarded-for|cf-connecting-ip|x-real-ip|\.ips\b|forwarded['"]\]/iu.test(code(source))) out.push(`${path}: reads a forwarding header by hand`);
  }
  return out;
}

/** 7, 8 — only the normalized trusted address is forwarded, only with the secret key. */
function relayViolations(w) {
  const out = [];
  const relay = code(w.relay);
  const normalized = (relay.match(/const clientIp = clientAddressOf\(\{ ip: readerAddress \}\);/gu) ?? []).length;
  const guarded = (relay.match(/if \(!baseUrl \|\| !secretKey \|\| clientIp === undefined\) return null;/gu) ?? []).length;
  const forwarded = (relay.match(/'Sb-Forwarded-For': clientIp,/gu) ?? []).length;
  if (normalized !== 2 || guarded !== 2 || forwarded !== 2) out.push('a provider request forwards an address that was not normalized and validated');
  if (/SUPABASE_(?:SERVICE_ROLE|PUBLISHABLE|ANON)_KEY/u.test(relay) || (relay.match(/const secretKey = process\.env\.SUPABASE_SECRET_KEY;/gu) ?? []).length !== 2) out.push('Sb-Forwarded-For is paired with a key other than the secret key');
  return out;
}

/** 9, 10, 11, 12, 13 — preflight before the app, no secret in an error, headers before routes, no CORS. */
function bootViolations(w, sources = productionSources) {
  const out = [];
  const main = code(w.main);
  const preflight = main.indexOf('const security = runSecurityPreflight(process.env);');
  const create = main.indexOf('await NestFactory.create<NestExpressApplication>(AppModule)');
  const configure = main.indexOf('configureHttpSecurity(app, security.proxy);');
  const listen = main.indexOf('await app.listen(');
  if (preflight < 0 || create < 0 || preflight > create) out.push('the production preflight does not run before the application is created');
  if (configure < 0 || listen < 0 || configure > listen) out.push('the header baseline is applied after the routes initialise');
  for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY']) {
    if (!w.preflight.includes(`'${name}'`)) out.push(`the preflight does not require ${name}`);
  }
  if (/problems\.push\(`[^`]*\$\{(?!name\})[^}]*\}/u.test(code(w.preflight)) || /\$\{(?:secret|value\(|url|environment\[)/u.test(code(w.preflight))) out.push('a preflight error interpolates a configured value');
  const http = code(w.http);
  if (!/app\.disable\('x-powered-by'\);/u.test(http)) out.push('X-Powered-By is not disabled');
  if (!/app\.use\(helmet\(\)\);/u.test(http)) out.push('Helmet is not registered');
  const overridden = new Map([[FILES.http, w.http], [FILES.main, w.main]]);
  for (const [path, source] of [...sources.filter(([p]) => !overridden.has(p)), ...overridden]) {
    if (/enableCors|cors\s*:|Access-Control-Allow-Origin|origin:\s*['"]\*['"]/iu.test(code(source))) out.push(`${path}: CORS is enabled`);
  }
  return out;
}

/** 14, 15, 21, 22, 23, 24, 25 — the forward migration closes the census and touches nothing else. */
function migrationViolations(w) {
  const out = [];
  const m = sql(w.migration);
  if (!/REVOKE ALL ON FUNCTION public\.login_id_is_available_v1\(text\) FROM PUBLIC, anon, authenticated;/u.test(m)) out.push('login_id_is_available_v1 stays directly executable by a client role');
  if (/ALL FUNCTIONS IN SCHEMA|ALL TABLES IN SCHEMA|ALL SEQUENCES IN SCHEMA/u.test(m)) out.push('a broad revoke over the whole schema');
  if (/REVOKE[^;]*ON FUNCTION public\.(?:read_account_first_use_v1|complete_first_use_welcome_v1)\(\) FROM [^;]*authenticated/u.test(m)) out.push('an intended authenticated owner RPC is revoked');
  if (/identifier_digest|retired_account_identifiers|sha256|hmac|vault\.|pgsodium/iu.test(m)) out.push('0133 carries half-built identifier-digest work (SEC-G is re-owned, not implemented)');
  if (/\bDELETE\b|\bTRUNCATE\b|DROP |ALTER TABLE|CREATE (?:OR REPLACE )?FUNCTION|POLICY|DISABLE ROW LEVEL/iu.test(m)) out.push('0133 changes more than privileges');
  if (/conversation_turn_admission|create_user_conversation_turn|turn_work/iu.test(m.replaceAll('conversation_turn_work_grants_id_seq', ''))) out.push('0133 touches the PROD-SEC-02 admission authority');
  return out;
}

/** 16, 19, 20 — no false distributed claim, no invented provider, no false gate pass. */
function claimViolations(w) {
  const out = [];
  if (!/It is not a distributed or global limit/u.test(w.policy) || /is a (?:global|distributed) (?:rate )?limit/iu.test(w.policy.replace('It is not a distributed or global limit', ''))) out.push('the in-memory limiter is described as distributed');
  if (/\b(?:Cloudflare|AWS|Amazon|Azure|Google Cloud|GCP|Fly\.io|Render|Railway|Fastly|Akamai|Vercel|Heroku|DigitalOcean|Netlify)\b/u.test(w.edge)) out.push('the edge contract names a provider that has not been selected');
  if (!/`LAUNCH-EDGE-SECURITY-GATE` is \*\*OPEN\*\*/u.test(w.edge)) out.push('the edge gate is not stated OPEN');
  const launchRow = /^\| `QAN-BL-LAUNCH-01` \|[^\n]*$/mu.exec(w.backlog)?.[0] ?? '';
  if (!/`DEFERRED — OWNED` \|$/u.test(launchRow)) out.push('the edge gate is recorded as passed or is missing from the backlog');
  return out;
}

/** 27 — no client address reaches telemetry or logs. */
function telemetryViolations(w, sources = productionSources) {
  const out = [];
  const safe = /const SAFE_HTTP_ATTRIBUTES=new Set\(\[([^\]]*)\]\)/u.exec(w.instrumentation)?.[1] ?? '';
  if (/client|peer|address|ip|forwarded|user_agent/iu.test(safe)) out.push('telemetry keeps a client address attribute');
  for (const [path, source] of sources.filter(([p]) => p.includes('/http-security/'))) {
    if (/console\.|Logger|telemetry|captureException|logger\./u.test(code(source))) out.push(`${path}: logs from the HTTP security boundary`);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The shipped tree is compliant.
// ---------------------------------------------------------------------------------------------------------------

test('the shipped tree satisfies every PROD-SEC-01 detector', () => {
  assert.deepEqual(rateLimitViolations(shipped), []);
  assert.deepEqual(keyAndAnswerViolations(shipped), []);
  assert.deepEqual(proxyViolations(shipped), []);
  assert.deepEqual(relayViolations(shipped), []);
  assert.deepEqual(bootViolations(shipped), []);
  assert.deepEqual(migrationViolations(shipped), []);
  assert.deepEqual(claimViolations(shipped), []);
  assert.deepEqual(telemetryViolations(shipped), []);
});

test('0133 is the next migration, forward-only, and the historical migrations and authorities are byte-identical', () => {
  const migrations = readdirSync(join(rootPath, 'database/migrations')).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1), '0133_supabase_default_privilege_drift_closure_v1.sql');
  assert.equal(migrations.at(-2), '0132_operational_readiness_failure_visibility_v1.sql');
  for (const [path, blob] of [
    ['database/migrations/0123_account_identity_first_use_v1.sql', null],
    ['database/migrations/0130_personal_privacy_export_account_deletion_v1.sql', '0ce164c15b66a55ebffee93b2f14ade48f067818'],
    ['database/migrations/0131_turn_admission_concurrency_cost_bound_v1.sql', 'e5da1036c62487fd3aae6529f84de9c203c32d6e'],
    ['apps/api/src/account/login-id-sign-in.service.ts', 'acb7e376a14e7d94655511c8679c6584bfa1aa8b'],
    ['apps/api/src/account/account.service.ts', '397840d3db9c7086b153dbd2fe1bf37689f4e4a4'],
    ['apps/api/src/observability/instrumentation.ts', 'b33772b2718e9661801f966c008c45864312ba5d'],
  ]) {
    if (blob !== null) assert.equal(gitBlobId(read(path)), blob, `${path} is unchanged (PROD-SEC-02 cost authority, P-7 digest, non-enumeration, telemetry)`);
  }
  assert.match(read('database/migrations/0123_account_identity_first_use_v1.sql'), /REVOKE ALL ON FUNCTION public\.login_id_is_available_v1\(text\) FROM PUBLIC;/u,
    '0123 is not edited: the drift is closed forward, by 0133');
});

// ---------------------------------------------------------------------------------------------------------------
// Planted defects (Task Contract section 16). Every one must be caught.
// ---------------------------------------------------------------------------------------------------------------

const PLANTED = [
  ['1 no throttler at all', rateLimitViolations, () => plant('module', 'providers: [{ provide: APP_GUARD, useClass: QandeelThrottlerGuard }],', 'providers: [],')],
  ['2 one sensitive route left unclassified', rateLimitViolations, () => plant('census', "  'POST /account/login-id-sign-in': 'PRE_AUTH_CREDENTIAL',\n", '')],
  ['3 raw Login ID in a limiter key', keyAndAnswerViolations, () => plant('policy', '  const address = clientAddressOf(request);', '  const address = clientAddressOf(request) + String((request as { body?: { loginId?: string } }).body?.loginId);')],
  ['4 trust proxy = true', proxyViolations, () => plant('http', "app.set('trust proxy', expressTrustProxySetting(proxy));", "app.set('trust proxy', true);")],
  ['5 a blind numeric hop count', proxyViolations, () => plant('http', "app.set('trust proxy', expressTrustProxySetting(proxy));", "app.set('trust proxy', 1);")],
  ['6 X-Forwarded-For read by hand', proxyViolations, () => plant('address', '  const raw = request.ip;', "  const raw = (request as { headers?: Record<string, string> }).headers?.['x-forwarded-for'] ?? request.ip;")],
  ['7 an untrusted address forwarded to Supabase', relayViolations, () => plant('relay', '    const clientIp = clientAddressOf({ ip: readerAddress });\n    if (!baseUrl || !secretKey || clientIp === undefined) return null;', '    const clientIp = readerAddress;\n    if (!baseUrl || !secretKey) return null;')],
  ['8 a substitute key on Sb-Forwarded-For', relayViolations, () => plant('relay', '    const secretKey = process.env.SUPABASE_SECRET_KEY;', '    const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;')],
  ['9 no production preflight', bootViolations, () => plant('main', '  const security = runSecurityPreflight(process.env);\n', '  const security = { proxy: { mode: "direct" as const, trustedProxies: [] } };\n')],
  ['10 a secret printed in a startup error', bootViolations, () => plant('preflight', "problems.push('SUPABASE_SECRET_KEY must not be the publishable key');", 'problems.push(`SUPABASE_SECRET_KEY ${secret} must not be the publishable key`);')],
  ['11 Helmet applied after the routes', bootViolations, () => plant('main', "  configureHttpSecurity(app, security.proxy);\n  const port = Number(process.env.PORT ?? 3000);\n\n  await app.listen(port, '0.0.0.0');", "  const port = Number(process.env.PORT ?? 3000);\n\n  await app.listen(port, '0.0.0.0');\n  configureHttpSecurity(app, security.proxy);")],
  ['12 X-Powered-By still present', bootViolations, () => plant('http', "  app.disable('x-powered-by');\n", '')],
  ['13 wildcard CORS', bootViolations, () => plant('http', '  app.use(helmet());', "  app.use(helmet());\n  app.enableCors({ origin: '*' });")],
  ['14 login_id_is_available_v1 left executable by clients', migrationViolations, () => plant('migration', 'REVOKE ALL ON FUNCTION public.login_id_is_available_v1(text) FROM PUBLIC, anon, authenticated;', 'REVOKE ALL ON FUNCTION public.login_id_is_available_v1(text) FROM PUBLIC;')],
  ['15 a broad revoke that breaks owner RPCs', migrationViolations, () => plant('migration', 'REVOKE ALL ON FUNCTION public.read_account_first_use_v1() FROM PUBLIC, anon;', 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;')],
  ['16 in-memory throttling claimed distributed', claimViolations, () => plant('policy', 'It is not a distributed or global limit', 'It is a distributed limit')],
  ['17 Redis made a hidden hard dependency', rateLimitViolations, () => plant('module', "import { ThrottlerModule } from '@nestjs/throttler';", "import { ThrottlerModule } from '@nestjs/throttler';\nimport { createClient } from 'redis';")],
  ['18 health throttled below load-balancer cadence', rateLimitViolations, () => plant('policy', 'HEALTH: { perMinute: 240, perHour: null }', 'HEALTH: { perMinute: 6, perHour: 60 }')],
  ['19 the edge contract invents a provider', claimViolations, () => plant('edge', '**Provider:** none selected.', '**Provider:** Cloudflare.')],
  ['20 the origin gate marked passed', claimViolations, () => plant('edge', '`LAUNCH-EDGE-SECURITY-GATE` is **OPEN**', '`LAUNCH-EDGE-SECURITY-GATE` is **PASSED**')],
  ['21 the unkeyed SHA renamed and called hardened', migrationViolations, () => plant('migration', 'COMMIT;', "ALTER FUNCTION personal_data_private.identifier_digest_v1(text, text) RENAME TO identifier_digest_hardened_v2;\nCOMMIT;")],
  ['22 an HMAC key committed to the repository', migrationViolations, () => plant('migration', 'COMMIT;', "SELECT encode(hmac('x', 'committed-key', 'sha256'), 'hex');\nCOMMIT;")],
  ['23 Vault assumed without proof', migrationViolations, () => plant('migration', 'COMMIT;', "SELECT decrypted_secret FROM vault.decrypted_secrets;\nCOMMIT;")],
  ['24 legacy retired digests dropped', migrationViolations, () => plant('migration', 'COMMIT;', 'DELETE FROM personal_data_private.retired_account_identifiers;\nCOMMIT;')],
  ['25 PROD-SEC-02 cost limits weakened', migrationViolations, () => plant('migration', 'COMMIT;', 'GRANT EXECUTE ON FUNCTION public.create_user_conversation_turn(uuid) TO anon;\nCOMMIT;')],
  ['26 rate limiting changes the non-enumerating answer', keyAndAnswerViolations, () => plant('policy', 'throw new HttpException(RATE_LIMITED_BODY, HttpStatus.TOO_MANY_REQUESTS);', "throw new HttpException({ outcome: 'RATE_LIMITED', loginIdKnown: true }, HttpStatus.TOO_MANY_REQUESTS);")],
  ['27 raw client IPs in telemetry', telemetryViolations, () => plant('instrumentation', "'http.status_code'", "'http.status_code','client.address'")],
];

for (const [name, detector, planted] of PLANTED) {
  test(`planted defect ${name} is caught`, () => {
    assert.notDeepEqual(detector(planted()), [], `the detector accepted planted defect ${name}`);
  });
}

test('the planted-defect suite covers all 27 items of the Task Contract', () => {
  assert.deepEqual(PLANTED.map(([name]) => Number(name.split(' ')[0])), Array.from({ length: 27 }, (_, index) => index + 1));
});

test('a controller with an unclassified route, and a hand-read forwarding header in any source, are caught', () => {
  const extra = [`${API}/probe/probe.controller.ts`, "@Controller('probe')\nexport class ProbeController {\n  @Get('x')\n  x() { return 1; }\n}\n"];
  assert.notDeepEqual(rateLimitViolations(shipped, [...controllers, extra]), []);
  const computed = [`${API}/probe/computed.controller.ts`, "@Controller('health')\nexport class ComputedController {\n  @Get(LIVE_PATH)\n  x() { return 1; }\n}\n"];
  assert.notDeepEqual(rateLimitViolations(shipped, [...controllers, computed]), [], 'a non-literal route path is not silently skipped');
  const sneaky = [`${API}/x/x.service.ts`, "const ip = request.headers['x-forwarded-for'];"];
  assert.notDeepEqual(proxyViolations(shipped, [...productionSources, sneaky]), []);
  const cors = [`${API}/x/y.ts`, 'app.enableCors();'];
  assert.notDeepEqual(bootViolations(shipped, [...productionSources, cors]), []);
});
