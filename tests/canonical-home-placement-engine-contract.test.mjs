// T-03B2b1 - Canonical Home Placement Engine v1 (QANDEEL OSDAP v1): the static
// anti-scope contract and the separate-process replay proof.
//
// Secret-free and CI-runnable. Behaviour is proven by the Jest suites under
// apps/api/src/thread-establishment/home-placement. This contract guards the
// SHAPE of the slice: what exists, that nothing reaches it and it reaches
// nothing durable or later (no migration, no Thread id allocation, no Home row,
// no LF, no lifecycle, no Nest, no database), the exact scheme id and constants,
// BigInt-only canonical arithmetic, the closed origin vocabulary, origin as
// datum and never hierarchy, symmetric MULTIPLE / AMBIGUOUS handling, read-only
// old Homes with no relocation API, the closed request with no semantic /
// viewport channel, an untouched T-03B2a, and - in a separate Node process -
// the byte-for-byte replay of the golden vectors and the 100 / 1,000 / 10,000
// Thread append proofs (task sections 10, 11, 14 and 17).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));
/** git blob id of the LF-normalized content: the canonical repository bytes. */
const blobId = (path) => {
  const bytes = Buffer.from(read(path), 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

/** Executable code only: prose may name a forbidden construct in order to forbid it. */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');

const THREAD_DIR = 'apps/api/src/thread-establishment';
const HOME_DIR = `${THREAD_DIR}/home-placement`;
const PRODUCTION_FILES = [
  'home-placement-engine.ts',
  'home-placement-scenario.ts',
  'home-placement-vectors.ts',
  'home-placement.types.ts',
  'index.ts',
  'sha256-canonical.ts',
];
const SPEC_FILES = ['home-placement-engine.spec.ts', 'home-placement-stress.spec.ts'];
/** The engine proper: everything but the proof fixtures. */
const ENGINE_FILES = PRODUCTION_FILES.filter((name) => name !== 'home-placement-scenario.ts' && name !== 'home-placement-vectors.ts');

/** T-03B2a at canonical main 2a4209fe: byte-identical, by git blob id. */
const T03B2A_BLOBS = {
  'fake-thread-establishment.provider.ts': 'cb6245af8b2dc2f9db773cf3e3078276a4e82694',
  'index.ts': '6e7e8fa4223413873185fe85ed6df92438cd98ec',
  'openai-thread-establishment.provider.spec.ts': 'e64dd08c083019bfa3f3088f62ac702fa8e1df83',
  'openai-thread-establishment.provider.ts': '5135e056beb4ca5facb761422703f4b69d922a81',
  'thread-establishment-evaluator.service.spec.ts': '800f3e2580c5624106f25ba93621f14d80b0e2ee',
  'thread-establishment-evaluator.service.ts': '8440bf21a042ced27c710eee06ea5e016f122e86',
  'thread-establishment-provider.config.ts': 'f80bc72dbb75f54841ca42678755206c41c907d3',
  'thread-establishment-provider.types.ts': 'e3d26e9554f50c597763c49b1676d5d123368aac',
  'thread-establishment-validator.spec.ts': 'b830569f4ff73c15139490738f305671527641d9',
  'thread-establishment-validator.ts': '9b515e4eb15491e6899a87a887683ebf1a33a92a',
  'thread-establishment.types.ts': 'b76b1c59b30582d8d5de1dde75121a05aa532702',
};

/** The pinned outcomes of the deterministic append-growth scenario (also pinned in home-placement-vectors.ts). */
const STRESS_GOLDENS = {
  100: { worldFingerprint: '58fc72e452057ab0ba2543f17b9d1db28abde94d5ebc6109644287f370635391', maxAttempt: 42 },
  1000: { worldFingerprint: 'dcba31edacfa933c442a91a043b55f12999a57a4c6707395c8a124aa2c0ebbce', maxAttempt: 184 },
  10000: { worldFingerprint: '348c972c9c024d2c5cff2e5a194e42f77b3d6a4c11611ccf6ca07665ad0b8937', maxAttempt: 603 },
};

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}
const relative = (file, base = rootPath) => file.slice(base.length).replace(/^[\\/]/u, '').replace(/\\/gu, '/');

const sources = Object.fromEntries(PRODUCTION_FILES.map((name) => [name, read(`${HOME_DIR}/${name}`)]));
const code = Object.fromEntries(Object.entries(sources).map(([name, text]) => [name, stripComments(text)]));
const allCode = Object.values(code).join('\n');
const engineCode = ENGINE_FILES.map((name) => code[name]).join('\n');
const types = code['home-placement.types.ts'];
const engine = code['home-placement-engine.ts'];
const indexModule = code['index.ts'];
const sha = code['sha256-canonical.ts'];
const vectors = code['home-placement-vectors.ts'];
const engineSpec = read(`${HOME_DIR}/home-placement-engine.spec.ts`);
const stressSpec = read(`${HOME_DIR}/home-placement-stress.spec.ts`);

const rootPackage = readJson('package.json');
const apiPackage = readJson('apps/api/package.json');
const apiCi = read('.github/workflows/api-ci.yml');
const mobileCi = read('.github/workflows/mobile-ci.yml');
const conversationModule = read('apps/api/src/conversation/conversation.module.ts');
const conversationService = read('apps/api/src/conversation/conversation.service.ts');
const appModule = read('apps/api/src/app.module.ts');
const b2aContract = read('tests/thread-establishment-evaluator-contract.test.mjs');
const doc = read('docs/canonical-home-placement-engine-v1.md');
const docsIndex = read('docs/README.md');

/** Extracts a frozen `Object.freeze([...] as const)` string vocabulary from the types module. */
function vocabulary(name) {
  const match = types.match(new RegExp(`export const ${name} = Object\\.freeze\\(\\[([\\s\\S]*?)\\] as const\\);`, 'u'));
  assert.ok(match, `${name} is a frozen as-const vocabulary`);
  return [...match[1].matchAll(/'([A-Z0-9_-]+)'/gu)].map((m) => m[1]);
}
const slice = (text, from, to) => {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start + 1);
  assert.ok(start >= 0 && end > start, `slice ${from} .. ${to} exists`);
  return text.slice(start, end);
};

test('the T-03B2b1 directory exists exactly, nested under T-03B2a, pure and framework-agnostic; T-03B2a is byte-identical', () => {
  assert.equal(existsSync(new URL(`${HOME_DIR}/`, root)), true);
  const files = listFiles(join(rootPath, HOME_DIR)).map((file) => relative(file, join(rootPath, HOME_DIR))).sort();
  assert.deepEqual(files, [...PRODUCTION_FILES, ...SPEC_FILES].sort(), 'the directory holds exactly the engine, its fixtures and its suites');
  assert.ok(!files.some((name) => /\.module\.|controller|repository|service|migration|binding|provider|\.sql$/u.test(name)), 'no module, controller, repository, service, provider, binding or migration file exists here');
  for (const [name, text] of Object.entries(code)) {
    assert.doesNotMatch(text, /@Injectable\(|@Module\(|@Controller\(|@Inject\(|@Global\(|@Get\(|@Post\(|@UseGuards\(/u, `${name} carries no Nest decorator`);
    assert.doesNotMatch(text, /from '@nestjs\//u, `${name} imports nothing from Nest`);
    assert.doesNotMatch(text, /\bclass \w+Service\b|\bclass \w+Repository\b|\bclass \w+Controller\b/u, `${name} declares no service, repository or controller`);
  }
  // T-03B2a semantics unchanged: every T-03B2a file is byte-identical to canonical main, and its index exports none of this slice.
  for (const [name, expected] of Object.entries(T03B2A_BLOBS)) {
    assert.equal(blobId(`${THREAD_DIR}/${name}`), expected, `${name} is byte-identical to T-03B2a as merged`);
  }
  const b2aTopLevel = readdirSync(join(rootPath, THREAD_DIR), { withFileTypes: true });
  // T-03B2b2 adds exactly the durable payload types, the Thread canonicalizer
  // and its suite beside the frozen T-03B2a files; that trio is pinned by
  // tests/durable-thread-home-same-sp-substrate-contract.test.mjs. No T-03B2a
  // file may be added or removed, and none of the three may reach this engine.
  const B2B2_FILES = ['durable-thread-canonicalizer.spec.ts', 'durable-thread-canonicalizer.ts', 'durable-thread-payload.types.ts'];
  // T-03B2b3 adds exactly the production-inert combined B1+B2 runtime, its lazy
  // Thread binding and the deterministic Conversational-Origin mapper, pinned by
  // tests/thread-runtime-integration-readiness-contract.test.mjs. None of them
  // may reach this engine either: the DATABASE is the only placement authority,
  // and no Home coordinate crosses the runtime boundary in either direction.
  const B2B3_FILES = [
    'conversation-thread-establishment.service.spec.ts', 'conversation-thread-establishment.service.ts',
    'conversation-thread-runtime-mapper.spec.ts', 'conversation-thread-runtime-mapper.ts',
    'conversation-thread-runtime.repository.spec.ts', 'conversation-thread-runtime.repository.ts',
    'conversation-thread-runtime.types.ts', 'conversational-origin-mapper.spec.ts',
    'conversational-origin-mapper.ts', 'thread-establishment-binding.ts',
  ];
  assert.deepEqual(b2aTopLevel.filter((entry) => entry.isFile()).map((entry) => entry.name).sort(),
    [...Object.keys(T03B2A_BLOBS), ...B2B2_FILES, ...B2B3_FILES].sort(), 'no T-03B2a file was added or removed');
  for (const name of [...B2B2_FILES, ...B2B3_FILES]) {
    assert.doesNotMatch(stripComments(read(`${THREAD_DIR}/${name}`)),
      /home-placement|placeCanonicalHome|resolveThreadHome|CanonicalHomePlacement|QANDEEL_OSDAP|OSDAP|HomePlacementRequest/u,
      `${name} carries no permanent placement: the database is the only placement authority`);
  }
  assert.deepEqual(b2aTopLevel.filter((entry) => entry.isDirectory()).map((entry) => entry.name), ['home-placement']);
  assert.match(b2aContract, /assert\.deepEqual\(directories, \['home-placement'\]/u, 'the T-03B2a contract pins this directory as the only nested slice');
  assert.match(b2aContract, /assert\.doesNotMatch\(code\['index\.ts'\], \/home-placement\/u/u, 'the T-03B2a contract pins its index as not re-exporting the engine');
});

test('the scheme id, engine version, digest domain and every v1 constant are pinned exactly, in BigInt (task sections 2, 3, 7)', () => {
  assert.match(types, /export const CANONICAL_HOME_PLACEMENT_SCHEME = 'QANDEEL_OSDAP_V1' as const;/u);
  assert.match(types, /export const CANONICAL_HOME_PLACEMENT_ENGINE_VERSION = 'canonical-home-placement-engine-v1' as const;/u);
  assert.match(types, /export const OSDAP_DIGEST_DOMAIN = 'qandeel-osdap-v1' as const;/u);
  assert.match(types, /export type WorldCoord = bigint;/u);
  assert.match(types, /export const MIN_COORD: WorldCoord = -\(2n \*\* 62n\);/u);
  assert.match(types, /export const MAX_COORD: WorldCoord = 2n \*\* 62n - 1n;/u);
  assert.match(types, /export const HOME_STEP: WorldCoord = 1_000_000n;/u);
  assert.match(types, /export const MIN_HOME_SEPARATION: WorldCoord = 250_000n;/u);
  assert.match(types, /export const CANDIDATES_PER_SHELL = 32 as const;/u);
  assert.match(types, /export const MAX_ATTEMPTS = 8192 as const;/u);
  assert.match(types, /export const CANONICAL_IDENTITY_PATTERN = \/\^\[A-Za-z0-9\]\[A-Za-z0-9\._:-\]\{0,127\}\$\/u;/u);
  assert.equal((allCode.match(/'QANDEEL_OSDAP_V/gu) ?? []).length, 1, 'exactly one scheme literal exists; every other use goes through the constant');
  assert.equal((allCode.match(/'qandeel-osdap-v/gu) ?? []).length, 1, 'exactly one digest domain literal exists');
  assert.equal((engineCode.match(/MIN_COORD|MAX_COORD|HOME_STEP|MIN_HOME_SEPARATION|CANDIDATES_PER_SHELL|MAX_ATTEMPTS/gu) ?? []).length > 6, true, 'the constants are consumed by name');
  assert.doesNotMatch(engine, /\b(?:1_000_000|1000000|250_000|250000|8192|8_192|62)n?\b/u, 'the engine never restates a constant as a literal');
  assert.match(engine, /export const SEPARATION_CELL_SHIFT = 18n;/u);
  assert.match(engine, /if \(MIN_HOME_SEPARATION > 1n << SEPARATION_CELL_SHIFT\) \{\s*throw new RangeError/u, 'the index cell is proven to cover the minimum separation at module load');
});

test('canonical arithmetic is BigInt only: no floating point, no number coordinate, no random source, no clock, no locale (task sections 3, 7, 10)', () => {
  assert.doesNotMatch(engineCode, /Math\.|parseFloat|parseInt|Number\(|toFixed|toPrecision|toExponential|toLocale|localeCompare|Intl\.|Date\.now|new Date|performance\.now|setTimeout|setInterval|randomUUID|randomBytes|randomInt|getRandomValues|process\.hrtime/u);
  assert.doesNotMatch(engineCode, /\b(?:x|y|baseX|baseY|dx|dy|radius|sumX|sumY|cellX|cellY)\s*:\s*number\b/u, 'no coordinate, offset, radius or cell is a number');
  assert.match(types, /export interface CanonicalExistingHome \{\s*readonly threadId: string;\s*readonly x: WorldCoord;\s*readonly y: WorldCoord;\s*\}/u);
  assert.match(types, /export interface CanonicalHomePlacement \{\s*readonly scheme: CanonicalHomePlacementScheme;\s*readonly x: WorldCoord;\s*readonly y: WorldCoord;\s*readonly attempt: number;\s*readonly baseX: WorldCoord;\s*readonly baseY: WorldCoord;\s*readonly worldFingerprint: string;\s*readonly originFingerprint: string;\s*\}/u,
    'the result is exactly scheme + x + y + attempt + base + fingerprints: no parent, no member, no pixel, no viewport');
  assert.match(engine, /if \(typeof x !== 'bigint' \|\| typeof y !== 'bigint'\) throw reject\('INVALID_PLACEMENT_INPUT', index\);/u, 'a number coordinate is rejected at runtime');
  // Every arithmetic step is pinned as exact integer arithmetic.
  assert.match(engine, /return dividend % divisor < 0n \? quotient - 1n : quotient;/u, 'floor division toward negative infinity');
  assert.match(engine, /return 1n \+ BigInt\(attempt\) \/ BigInt\(CANDIDATES_PER_SHELL\);/u, 'shell = 1 + floor(attempt / 32) in BigInt');
  assert.match(engine, /return HOME_STEP \* shellForAttempt\(attempt\);/u);
  assert.match(engine, /for \(let position = 0; position < 16; position \+= 1\) uX = \(uX << 8n\) \| BigInt\(digest\[position\]\);\s*for \(let position = 16; position < 32; position \+= 1\) uY = \(uY << 8n\) \| BigInt\(digest\[position\]\);/u,
    'uX / uY are the two 128-bit digest halves, big-endian, by shift and or');
  assert.match(engine, /return \(unsigned % \(2n \* radius \+ 1n\)\) - radius;/u, 'the square mapping is an exact modulus');
  assert.match(engine, /return \(radius \+ 1n\) \/ 2n;/u, 'ceil(radius / 2) in BigInt');
  assert.match(engine, /if \(maxBig\(ax, ay\) >= boundary\) return Object\.freeze\(\{ dx, dy \}\);\s*if \(ax >= ay\) return Object\.freeze\(\{ dx: signBig\(dx\) \* boundary, dy \}\);\s*return Object\.freeze\(\{ dx, dy: signBig\(dy\) \* boundary \}\);/u,
    'inner-square projection: dominant component to the nearest signed outer-half boundary, x on ties');
  assert.match(engine, /return value < 0n \? -1n : 1n;/u, 'zero counts as positive');
  assert.match(engine, /return coordinate >> SEPARATION_CELL_SHIFT;/u, 'index cells floor by arithmetic shift');
  assert.match(engine, /if \(left < right\) return -1;\s*if \(left > right\) return 1;\s*return 0;/u, 'identity order is UTF-16 code-unit order, never locale');
  assert.match(engine, /`\$\{home\.threadId\}\\t\$\{home\.x\}\\t\$\{home\.y\}\\n`/u, 'canonical line = threadId TAB x TAB y LF, decimal BigInt');
  assert.match(engine, /return sha256Hex\(`\$\{CANONICAL_HOME_PLACEMENT_SCHEME\}\\n\$\{ordered\.map\(serializeHome\)\.join\(''\)\}`\);/u, 'world fingerprint = scheme + ordered lines');
  assert.match(engine, /return sha256Hex\(`\$\{origin\.state\}\\n\$\{ordered\.map\(serializeHome\)\.join\(''\)\}`\);/u, 'origin fingerprint = state + ordered lines');
  assert.match(engine, /`\$\{OSDAP_DIGEST_DOMAIN\}\|\$\{seed\.userWorldId\}\|\$\{seed\.newThreadId\}\|\$\{seed\.originFingerprint\}\|\$\{seed\.worldFingerprint\}\|\$\{attempt\}`/u, 'the per-attempt digest input, exactly');
  assert.deepEqual([...sha.matchAll(/from\s+'([^']+)'/gu)].map((m) => m[1]), ['node:crypto'], 'the hashing primitive uses Node crypto alone');
  assert.equal((sha.match(/createHash\('sha256'\)/gu) ?? []).length, 2);
  assert.doesNotMatch(allCode, /createHash\('(?!sha256')/u, 'sha256 is the only digest');
});

test('the origin vocabulary is closed; origin guides the base and nothing else; MULTIPLE / AMBIGUOUS are symmetric; NONE fabricates no parent (task sections 1, 5, 12)', () => {
  assert.deepEqual(vocabulary('CONVERSATIONAL_ORIGIN_STATES'), ['NONE', 'RESOLVED', 'MULTIPLE', 'AMBIGUOUS']);
  assert.deepEqual(vocabulary('CANONICAL_HOME_PLACEMENT_REJECTION_REASONS'), [
    'INVALID_PLACEMENT_INPUT', 'DUPLICATE_EXISTING_THREAD_ID', 'DUPLICATE_EXISTING_PLACEMENT', 'EXISTING_HOME_OUT_OF_BOUNDS', 'THREAD_ALREADY_PLACED',
    'INVALID_ORIGIN_CARDINALITY', 'DUPLICATE_ORIGIN_HOME', 'UNKNOWN_ORIGIN_HOME', 'ORIGIN_HOME_MISMATCH', 'CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED',
  ]);
  assert.match(types, /\{ readonly state: 'NONE' \}\s*\|\s*\{ readonly state: 'RESOLVED'; readonly homes: readonly \[CanonicalExistingHome\] \}\s*\|\s*\{ readonly state: 'MULTIPLE'; readonly homes: readonly CanonicalExistingHome\[\] \}\s*\|\s*\{ readonly state: 'AMBIGUOUS'; readonly homes: readonly CanonicalExistingHome\[\] \};/u,
    'origin is exactly the four states with grounded members and nothing else - no primary, no weight, no confidence');
  assert.doesNotMatch(allCode, /PRIMARY|primaryOrigin|primaryThread|parentThread|originEdge|originHierarchy|isTrueOrigin|trueOrigin/u);
  // The seed point: datum for NONE, the one Home for RESOLVED, the same symmetric barycenter for MULTIPLE and AMBIGUOUS.
  const seed = slice(engine, 'export function originSeedPoint(', 'function serializeHome(');
  assert.match(seed, /if \(origin\.homes\.length === 0\) return Object\.freeze\(\{ baseX: 0n, baseY: 0n \}\);/u, 'NONE seeds at the world datum');
  assert.match(seed, /const count = BigInt\(origin\.homes\.length\);\s*return Object\.freeze\(\{ baseX: floorDiv\(sumX, count\), baseY: floorDiv\(sumY, count\) \}\);/u, 'the exact integer barycenter over ALL members');
  assert.doesNotMatch(seed, /RESOLVED|MULTIPLE|AMBIGUOUS|state|\[0\]|primary|first|nearest|closest|weight/u, 'the seed point never branches on the origin state and never prefers a member');
  assert.match(engine, /if \(state === 'RESOLVED' \? members\.length !== 1 : members\.length < 2\) throw reject\('INVALID_ORIGIN_CARDINALITY'\);/u);
  assert.match(engine, /if \(seen\.has\(candidate\.threadId\)\) throw reject\('DUPLICATE_ORIGIN_HOME', index\);/u);
  assert.match(engine, /if \(known === undefined\) throw reject\('UNKNOWN_ORIGIN_HOME', index\);/u);
  assert.match(engine, /if \(known\.x !== candidate\.x \|\| known\.y !== candidate\.y\) throw reject\('ORIGIN_HOME_MISMATCH', index\);/u, 'an origin member is an existing Home with identical coordinates');
  assert.match(engine, /homes: Object\.freeze\(grounded\.sort\(compareHomes\)\)/u, 'origin members are canonically ordered: permutation cannot matter');
  // The search consumes origin ONLY as the base point: no nearest-neighbour, no distance to origin, no direction constraint.
  const search = slice(engine, 'export function searchAdmissiblePlacement(', 'export function placeCanonicalHome(');
  assert.doesNotMatch(search, /origin|nearest|closest|angle|direction|quadrant|toward/u);
  assert.doesNotMatch(engineCode, /nearest|closest|angle|atan|cos\(|sin\(|sqrt|hypot|euclid/iu);
});

test('old Homes are read-only, there is no relocation API, growth is append-only and first-admissible-wins, exhaustion fails closed (task sections 7, 8, 11)', () => {
  assert.match(engine, /return Object\.freeze\(\{ threadId, x, y \}\);/u, 'every existing Home is copied once into a frozen object');
  assert.doesNotMatch(engineCode, /\.(?:x|y|threadId|baseX|baseY|attempt)\s*=[^=]/u, 'no field of a Home, a base or a result is ever assigned');
  assert.doesNotMatch(engineCode, /relocat|rebalanc|re-?layout|reflow|compact|optimi[sz]|migrat|shuffle|\.splice\(|\.reverse\(\)|second pass|retry/iu, 'no relocation, re-layout, optimization or second pass exists');
  assert.match(engine, /if \(byId\.has\(newThreadId\)\) throw reject\('THREAD_ALREADY_PLACED'\);/u, 'the engine refuses a Thread that already holds a Home');
  assert.match(engine, /if \(!index\.insertUnique\(home\)\) throw reject\('DUPLICATE_EXISTING_PLACEMENT', position\);/u);
  assert.match(engine, /if \(byId\.has\(home\.threadId\)\) throw reject\('DUPLICATE_EXISTING_THREAD_ID', position\);/u);
  assert.match(engine, /if \(!isWithinCoordinateBounds\(home\.x, home\.y\)\) throw reject\('EXISTING_HOME_OUT_OF_BOUNDS', position\);/u);
  assert.match(engine, /for \(let attempt = 0; attempt < MAX_ATTEMPTS; attempt \+= 1\) \{\s*const candidate = candidateForAttempt\(seed, base, attempt\);\s*if \(!isWithinCoordinateBounds\(candidate\.x, candidate\.y\)\) continue;\s*if \(!index\.isAdmissible\(candidate\)\) continue;\s*return Object\.freeze\(\{ x: candidate\.x, y: candidate\.y, attempt \}\);\s*\}\s*throw reject\('CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED'\);/u,
    'first admissible candidate in attempt order wins; out-of-bound candidates are skipped, never clamped; exhaustion fails closed');
  assert.doesNotMatch(engineCode, /clamp|wrap|MAX_COORD - |MIN_COORD \+ |% MAX_COORD|% \(MAX_COORD/u, 'nothing is clamped or wrapped at the technical bound');
  assert.match(engine, /if \(chebyshevDistance\(candidate, home\) < MIN_HOME_SEPARATION\) return home;/u, 'admissibility is the exact Chebyshev test against every neighbouring Home');
  assert.match(engine, /return maxBig\(absBig\(left\.x - right\.x\), absBig\(left\.y - right\.y\)\);/u);
  assert.doesNotMatch(engineCode, /(?:distance|separation|Distance|Separation)\s*(?:<|<=|>|>=)\s*\d/u, 'no separation literal beside the constant');
  // The public engine binds the search to the REAL fingerprints of the validated request, once.
  assert.match(engine, /const worldFingerprint = fingerprintWorld\(validated\.existingHomes\);\s*const originFingerprint = fingerprintOrigin\(validated\.origin\);\s*const found = searchAdmissiblePlacement\(\s*\{ userWorldId: validated\.userWorldId, newThreadId: validated\.newThreadId, originFingerprint, worldFingerprint \},\s*\{ x: baseX, y: baseY \},\s*validated\.index,\s*\);/u);
  assert.equal((engine.match(/searchAdmissiblePlacement\(/gu) ?? []).length, 2, 'declared once, called once');
  assert.equal((engine.match(/placeCanonicalHome\(/gu) ?? []).length, 1, 'the engine never calls itself');
  // The consumer rule keeps the engine off every non-establishment path.
  assert.match(engine, /if \(committedHome !== null\) return Object\.freeze\(\{ outcome: 'COMMITTED_HOME_KEPT', home: committedHome \}\);\s*return Object\.freeze\(\{ outcome: 'NEW_HOME_PLACED', placement: placeNew\(\) \}\);/u);
  assert.match(engineSpec, /resolveThreadHome\(committed, engine\)/u);
  assert.match(engineSpec, /expect\(engine\)\.not\.toHaveBeenCalled\(\)/u, 'the refinement / reopen no-op proof observes the engine spy');
  assert.match(engineSpec, /'THREAD_ALREADY_PLACED'\)/u);
  assert.match(engineSpec, /'CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED'\)/u);
  assert.match(engineSpec, /floorDiv\(-7n, 2n\)\)\.toBe\(-4n\)/u);
  assert.match(engineSpec, /projectToOuterHalf\(0n, 0n, r\)/u);
  assert.match(engineSpec, /point\(249_999n, 0n\)/u, 'one unit below the minimum is proven refused');
  assert.match(stressSpec, /runStressScenario\(100\)/u);
  assert.match(stressSpec, /runStressScenario\(1_000\)/u);
});

test('the request is closed at type level and at runtime: no semantic-geography, label, count, relation, viewport or device channel, no extension bag (task sections 4, 13)', () => {
  assert.match(types, /export interface HomePlacementRequest \{\s*readonly userWorldId: string;\s*readonly newThreadId: string;\s*readonly origin: ConversationalOrigin;\s*readonly existingHomes: readonly CanonicalExistingHome\[\];\s*\}/u,
    'the request is exactly four fields');
  assert.doesNotMatch(types, /Record<|\[key: string\]|\bunknown\b|\bany\b|metadata|\bextensions?\b|\bextra\b|\boptions\b|\bcontext\b/u, 'no extension bag, index signature or open field exists in the public types');
  assert.match(engine, /const REQUEST_KEYS = Object\.freeze\(\['existingHomes', 'newThreadId', 'origin', 'userWorldId'\] as const\);/u);
  assert.match(engine, /const HOME_KEYS = Object\.freeze\(\['threadId', 'x', 'y'\] as const\);/u);
  assert.match(engine, /const ORIGIN_NONE_KEYS = Object\.freeze\(\['state'\] as const\);/u);
  assert.match(engine, /const ORIGIN_MEMBER_KEYS = Object\.freeze\(\['homes', 'state'\] as const\);/u);
  assert.match(engine, /if \(!isRecord\(raw\) \|\| !hasExactKeys\(raw, REQUEST_KEYS\)\) throw reject\('INVALID_PLACEMENT_INPUT'\);/u, 'an extra request key is rejected at runtime');
  assert.match(engine, /if \(!isRecord\(value\) \|\| !hasExactKeys\(value, HOME_KEYS\)\) throw reject\('INVALID_PLACEMENT_INPUT', index\);/u, 'an extra Home key is rejected at runtime');
  assert.equal((engine.match(/Record<string, unknown>/gu) ?? []).length, 2, 'the only Record type is the two narrowing guards, never a field');
  for (const forbidden of ['similarity', 'embedding', 'confidence', 'importance', 'rank', 'score', 'reading', 'Reading', 'evidenceStrength', 'relationCount', 'connectionCount', 'relation',
    'emotion', 'sentiment', 'priority', 'popularity', 'viewport', 'screen', 'device', 'label', 'Label', 'committedText', 'metadata', 'weight', 'strength', 'intensity', 'frequency', 'recency',
    'timestamp', 'createdAt', 'pixel', 'render', 'camera', 'zoom', 'level', 'generation', 'hierarchy', 'parent', 'child', 'cluster', 'semantic', 'Semantic', 'TE-0', 'path']) {
    assert.equal(allCode.includes(forbidden), false, `no ${forbidden} channel exists in the engine or its fixtures`);
  }
  assert.match(engineSpec, /\/\/ @ts-expect-error - the closed request type has no similarity channel\s*similarity: 0\.9,/u, 'the type-level closure is proven');
  assert.equal((engineSpec.match(/@ts-expect-error/gu) ?? []).length, 3);
  assert.match(engineSpec, /\{ viewport: \{ width: 375 \} \},\s*\{ device: 'phone' \},/u, 'the runtime closure is proven for viewport and device');
});

test('no database, Supabase, Nest, runtime, mobile, provider or B1 / B2a import; only ./ and node:crypto; nothing reaches the slice (task sections 15, 16)', () => {
  for (const forbidden of ['serviceApi', 'dataApi', 'SupabaseClient', '.rpc(', '.rpc<', "from 'pg'", 'INSERT INTO', 'UPDATE ', 'CREATE TABLE', 'fs.', 'writeFile', 'readFile', 'fetch(',
    '@qandeel/runtime', 'apps/mobile', 'react-native', 'expo-router', 'ConversationService', 'ConversationModule', 'process.env', 'openai', 'OpenAI', 'anthropic', 'WebSocket', 'EventSource',
    'thread-establishment.types', 'thread-establishment-validator', 'thread-establishment-evaluator', 'conversational-focus', 'conversation-unit', 'durable-focus', 'ThreadEstablishment', 'validateThreadEstablishmentProposal']) {
    assert.equal(allCode.includes(forbidden), false, `the T-03B2b1 boundary must not contain ${forbidden}`);
  }
  for (const [name, text] of Object.entries(code)) {
    for (const match of text.matchAll(/from\s+'([^']+)'/gu)) {
      const specifier = match[1];
      if (specifier.startsWith('./')) continue;
      assert.equal(specifier, 'node:crypto', `${name} imports ${specifier}; only ./* and node:crypto are allowed`);
      assert.equal(name, 'sha256-canonical.ts', 'only the hashing primitive reaches node:crypto');
    }
    assert.doesNotMatch(text, /require\(/u, `${name} uses no require()`);
    assert.doesNotMatch(text, /\bimport\(/u, `${name} uses no dynamic import()`);
    assert.doesNotMatch(text, /\.\.\//u, `${name} never imports outside the directory`);
  }
  // The public surface is exactly the closed types, the engine and the consumer rule; seams and fixtures stay by-path.
  assert.equal(indexModule.trim(), "export * from './home-placement.types';\nexport { placeCanonicalHome, resolveThreadHome } from './home-placement-engine';");
  assert.doesNotMatch(vectors, /placeCanonicalHome\(/u, 'the vectors are data, not a second engine');
  // Nothing in the API runtime, scripts, database or mobile references the slice.
  const referencing = listFiles(join(rootPath, 'apps/api/src'))
    .map((file) => relative(file))
    .filter((file) => !file.startsWith(`${HOME_DIR}/`))
    .filter((file) => /home-placement|placeCanonicalHome|resolveThreadHome|CanonicalHomePlacement|QANDEEL_OSDAP|OSDAP|HomePlacementRequest/u.test(stripComments(read(file))));
  assert.deepEqual(referencing, [], 'T-03B2b1 is production-inert: no runtime path reaches it');
  for (const [name, text] of [['ConversationModule', conversationModule], ['ConversationService', conversationService], ['AppModule', appModule]]) {
    assert.doesNotMatch(stripComments(text), /home-placement|HomePlacement|OSDAP|Home Anchor|homeAnchor|home_anchor/u, `${name} is untouched by T-03B2b1`);
  }
  // T-03B2b2 owns the DURABLE side: migration 0068 mirrors QANDEEL_OSDAP_V1 in
  // PostgreSQL, and its verifier and database contract replay the golden
  // vectors against it. Those three files are the only ones under database/
  // that may name the scheme, and they never import this TypeScript engine.
  const B2B2_DATABASE_FILES = [
    'database/migrations/0068_durable_thread_home_same_sp_substrate_v1.sql',
    'database/verify-migration-0068.mjs',
    'database/tests/durable-thread-home-same-sp-substrate-v1.test.mjs',
  ];
  // T-03B3's migration 0070 CALLS the frozen 0068 persist path for a NEW
  // establishment and computes no placement of its own; its verifier and its
  // database contract read the stored Home only to prove a reused Thread keeps
  // it byte-for-byte. None of the three defines, mirrors or calls an engine.
  // T-03D's migration 0071 (the FINAL chain + cutover) likewise CALLS the frozen
  // 0068 persist path for a NEW establishment inside its own per-Moment writer
  // and computes no placement of its own; its verifier and database contract
  // read nothing spatial beyond proving a reused Thread keeps its Home.
  const B3_DATABASE_FILES = [
    'database/migrations/0070_thread_lifecycle_cross_session_continuity_v1.sql',
    'database/verify-migration-0070.mjs',
    'database/tests/thread-lifecycle-cross-session-continuity-v1.test.mjs',
    'database/migrations/0071_effective_live_focus_final_semantic_chain_cutover_v1.sql',
    'database/verify-migration-0071.mjs',
    'database/tests/effective-live-focus-final-semantic-chain-cutover-v1.test.mjs',
  ];
  for (const file of [...listFiles(join(rootPath, 'apps/api/scripts')), ...listFiles(join(rootPath, 'apps/mobile/src')), ...listFiles(join(rootPath, 'database'))].map((f) => relative(f))) {
    if (B2B2_DATABASE_FILES.includes(file)) {
      assert.doesNotMatch(read(file), /placeCanonicalHome|resolveThreadHome|HomePlacementRequest|CanonicalHomePlacement/u,
        `${file} mirrors the frozen scheme in SQL and never calls the TypeScript engine`);
      continue;
    }
    if (B3_DATABASE_FILES.includes(file)) {
      assert.doesNotMatch(read(file), /home-placement|placeCanonicalHome|resolveThreadHome|HomePlacementRequest|CanonicalHomePlacement|CREATE (?:OR REPLACE )?FUNCTION public\.(?:osdap_|compute_canonical_home_placement)/u,
        `${file} reuses the stored Home and never defines, mirrors or calls an engine`);
      continue;
    }
    assert.doesNotMatch(read(file), /home-placement|placeCanonicalHome|OSDAP|HomePlacementRequest/u, `${file} does not reach the engine`);
  }
  for (const file of B2B2_DATABASE_FILES) {
    assert.ok(read(file).includes('QANDEEL_OSDAP_V1'), `${file} carries the frozen scheme id`);
  }
});

test('no Thread id allocation, no Home durable allocation, no lifecycle / LF, no migration, no verifier, no grant (task sections 0, 16)', () => {
  for (const forbidden of ['randomUUID', 'uuidV5', 'uuid-v5', 'NAMESPACE', 'home_anchor_id', 'homeAnchorId', 'HomeAnchorId', 'ThreadEstablished', 'THREAD_ESTABLISHED', 'establishThread',
    'sessionPosition', 'session_position', 'sameSpEventSequence', 'liveHead', 'live_head', 'LIVE_FOCUS', 'liveFocus', 'LiveFocus', 'effectiveLF', 'lifecycle', 'Lifecycle', 'Dormant', 'DORMANT',
    'Reopen', 'REOPEN', 'reopen', 'knowledgeFrontier', 'timeline', 'Timeline', 'projection', 'WORLD_ANCHOR', 'MapState', 'INSERT', 'migration', 'Migration', 'GRANT', 'service_role']) {
    assert.equal(allCode.includes(forbidden), false, `the T-03B2b1 boundary must not contain ${forbidden}`);
  }
  assert.doesNotMatch(engineCode, /newThreadId\s*=|threadId\s*=\s*[^=]/u, 'no Thread identity is minted');
  // T-03B2b1 itself shipped NO migration and NO verifier. The durable Home
  // substrate arrived with T-03B2b2 as exactly ONE migration, 0068, pinned by
  // its own contract; nothing older may carry a Home, Thread or scheme token.
  const migrations = readdirSync(join(rootPath, 'database/migrations')).filter((name) => name.endsWith('.sql')).sort();
  const B2B2_MIGRATION = '0068_durable_thread_home_same_sp_substrate_v1.sql';
  // (T-03B2b3 added 0069, a READ / AUDIT-only migration that creates no table
  // and computes no placement; it is pinned by its own contract.)
  const B2B3_MIGRATION = '0069_thread_runtime_integration_readiness_v1.sql';
  // (T-03B3 added 0070, the Session-local lifecycle / cross-Session continuity
  // substrate; it CALLS compute_canonical_home_placement_v1 for a NEW Thread and
  // never recomputes, moves or exposes a Home; pinned by its own contract.)
  const B3_MIGRATION = '0070_thread_lifecycle_cross_session_continuity_v1.sql';
  // (T-03D added 0071, the effective-LF + FINAL semantic-chain cutover; its
  // per-Moment writer CALLS the frozen 0068 persist path for a NEW Thread
  // exactly as 0070 does, defines no engine and moves no Home; pinned by
  // tests/effective-live-focus-final-semantic-chain-cutover-contract.test.mjs.)
  const B3D_MIGRATION = '0071_effective_live_focus_final_semantic_chain_cutover_v1.sql';
  assert.deepEqual(migrations.filter((name) => /home|placement|osdap|spatial|thread/iu.test(name)), [B2B2_MIGRATION, B2B3_MIGRATION, B3_MIGRATION],
    'exactly one Home / Thread SUBSTRATE migration exists (T-03B2b2), plus the T-03B2b3 READ / AUDIT migration and the T-03B3 lifecycle migration');
  for (const name of [B3_MIGRATION, B3D_MIGRATION]) {
    assert.doesNotMatch(read(`database/migrations/${name}`), /CREATE FUNCTION public\.(?:osdap_|compute_canonical_home_placement)|UPDATE public\.conversation_thread_homes|placement_x\s*=|placement_y\s*=/u,
      `${name} defines no placement engine of its own and moves no Home`);
  }
  assert.doesNotMatch(read(`database/migrations/${B2B3_MIGRATION}`), /osdap|placement_x|placement_y|home_placement|compute_canonical_home_placement/iu,
    'the T-03B2b3 read/audit migration computes no placement of its own');
  for (const name of migrations.filter((candidate) => candidate !== B2B2_MIGRATION && candidate !== B2B3_MIGRATION && candidate !== B3_MIGRATION && candidate !== B3D_MIGRATION)) {
    assert.doesNotMatch(read(`database/migrations/${name}`), /home_anchor|canonical_spatial|osdap|thread_home|home_placement|conversation_threads/iu, `${name} carries no Home substrate`);
  }
  assert.deepEqual(readdirSync(join(rootPath, 'database')).filter((name) => /home|placement|osdap|thread/iu.test(name)), [],
    'no Home / placement verifier is named after the engine');
  assert.deepEqual(Object.keys(rootPackage.scripts).filter((name) => /verify:.*(?:home|placement|osdap|thread)/u.test(name)),
    ['verify:durable-thread-home-same-sp-substrate:integration', 'verify:thread-runtime-integration-readiness:integration', 'verify:thread-lifecycle-cross-session-continuity:integration'],
    'the only Home-related verifier script is the T-03B2b2 one; the T-03B2b3 and T-03B3 ones verify reads / reuse, never a placement');
  assert.deepEqual([...apiCi.matchAll(/npm run (verify:[\w:-]*(?:home|placement|osdap)[\w:-]*)/gu)].map((m) => m[1]),
    ['verify:durable-thread-home-same-sp-substrate:integration']);
});

test('the gate is registered at the root and in API CI after T-03B2a and before the database bootstrap; no new dependency; MOB-CI-01 untouched; docs indexed (task sections 15, 18)', () => {
  assert.equal(rootPackage.scripts['test:canonical-home-placement-engine-contract'], 'node --test tests/canonical-home-placement-engine-contract.test.mjs');
  assert.match(apiCi, /run: npm run test:canonical-home-placement-engine-contract/u);
  assert.equal((apiCi.match(/test:canonical-home-placement-engine-contract/gu) ?? []).length, 1);
  assert.ok(apiCi.indexOf('test:canonical-home-placement-engine-contract') > apiCi.indexOf('test:thread-establishment-evaluator-contract'), 'runs after the T-03B2a static contract');
  assert.ok(apiCi.indexOf('test:canonical-home-placement-engine-contract') < apiCi.indexOf('test:him-generic-write-authority-retirement-contract'), 'runs with the static contracts');
  assert.ok(apiCi.indexOf('test:canonical-home-placement-engine-contract') < apiCi.indexOf('Apply all migrations to fresh PostgreSQL'), 'runs before the database bootstrap');
  assert.doesNotMatch(mobileCi, /home-placement|placement|osdap/u);
  assert.equal((mobileCi.match(/runs-on: /gu) ?? []).length, 3);
  assert.equal((mobileCi.match(/if: needs\.verify-mobile-contracts\.outputs\.native_impact == 'true'/gu) ?? []).length, 2);
  assert.deepEqual(Object.keys(rootPackage.devDependencies), ['pg']);
  assert.deepEqual(Object.keys(apiPackage.dependencies), [
    '@anthropic-ai/sdk', '@nestjs/common', '@nestjs/core', '@opentelemetry/api', '@opentelemetry/exporter-metrics-otlp-http', '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/instrumentation-express', '@opentelemetry/instrumentation-http', '@opentelemetry/resources', '@opentelemetry/sdk-metrics', '@opentelemetry/sdk-node',
    '@opentelemetry/semantic-conventions', '@sentry/nestjs', 'openai', 'redis', 'reflect-metadata', 'rxjs',
  ], 'no new API dependency');
  assert.deepEqual(Object.keys(apiPackage.devDependencies), ['@nestjs/cli', '@qandeel/runtime', '@nestjs/testing', '@types/jest', '@types/node', 'jest', 'ts-jest', 'ts-node', 'typescript'], 'no new API devDependency');
  assert.match(doc, /production-inert/u);
  assert.match(doc, /QANDEEL_OSDAP_V1/u);
  assert.match(doc, /T-03B2b2/u);
  assert.match(doc, /no migration/iu);
  assert.match(doc, /x on an exact tie/u, 'the projection tie rule is documented exactly');
  assert.match(doc, /zero component counts as positive/u);
  assert.match(doc, /serialized per user world/u, 'the caller-side serialization requirement is documented');
  assert.match(docsIndex, /\(canonical-home-placement-engine-v1\.md\)/u);
});

test('the golden vectors and the 100 / 1,000 / 10,000 Thread append proofs replay byte-for-byte in a separate Node process (task sections 10, 11, 14 items 27-30)', (t) => {
  const runner = join(rootPath, 'tests', 'canonical-home-placement-engine-stress-runner.mjs');
  const register = join(rootPath, 'node_modules', 'ts-node', 'register');
  const started = Date.now();
  const result = spawnSync(process.execPath, ['-r', register, runner], {
    cwd: rootPath,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, TS_NODE_PROJECT: 'apps/api/tsconfig.json', TS_NODE_TRANSPILE_ONLY: 'true' },
  });
  assert.equal(result.status, 0, `runner failed: ${result.stderr}`);
  const report = JSON.parse(result.stdout);
  t.diagnostic(`replay on ${report.platform} ${report.node}: ${JSON.stringify(report.stress.map((entry) => ({ threads: entry.threads, maxAttempt: entry.maxAttempt, elapsedMs: entry.elapsedMs })))} total ${Date.now() - started} ms`);
  assert.equal(report.ok, true, JSON.stringify(report));
  assert.deepEqual(report.vectors.map((vector) => vector.id), ['GV-01', 'GV-02', 'GV-03', 'GV-04', 'GV-05', 'GV-06', 'GV-07']);
  for (const vector of report.vectors) assert.equal(vector.matched, true, `${vector.id} replays exactly`);
  assert.deepEqual(report.vectors.find((vector) => vector.id === 'GV-01'), { id: 'GV-01', matched: true, x: '534265', y: '944722', attempt: 0 });
  assert.deepEqual(report.vectors.find((vector) => vector.id === 'GV-07'), { id: 'GV-07', matched: true, x: '8240675', y: '9920020', attempt: 34 });
  assert.deepEqual(report.stress.map((entry) => entry.threads), [100, 1000, 10000]);
  for (const entry of report.stress) {
    const golden = STRESS_GOLDENS[entry.threads];
    assert.equal(entry.placed, entry.threads, `${entry.threads} Threads were all placed`);
    assert.equal(entry.worldFingerprint, golden.worldFingerprint, `${entry.threads}-Thread world fingerprint is pinned`);
    assert.equal(entry.fingerprintMatched, true);
    assert.equal(entry.maxAttempt, golden.maxAttempt, `${entry.threads}-Thread max attempt is pinned`);
    assert.equal(entry.withinMaxAttempts, true);
    assert.equal(entry.unique, true, `${entry.threads} distinct Threads never share one Home`);
    assert.equal(entry.separated, true, `${entry.threads} Homes keep the exact minimum separation`);
    assert.ok(entry.replayed >= 10 || entry.threads < 10);
    assert.equal(entry.replayMismatch, 0, `${entry.threads}: every replayed placement is unchanged by later growth, in any world order`);
  }
  assert.deepEqual(report.stress[2].originCounts, { NONE: 2503, RESOLVED: 2499, MULTIPLE: 2499, AMBIGUOUS: 2499 });
});
