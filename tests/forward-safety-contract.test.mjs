import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// R2-02 — the forward-safety gate: this repository's static contracts must not be ceilings.
//
// ## Why this exists
//
// A static contract can be written in two shapes that look identical while it passes:
//
//   a PERMANENT INVARIANT — "the Map is the only spatial authority", "no truth may depend on a frame
//   clock" — which must hold at every future commit, and belongs in a perpetual guard;
//
//   a DELIVERY FACT — "the workflow contains exactly these seven gates", "no migration exists after
//   0072", "this manifest has exactly these dependencies" — which was true when it was written and
//   is guaranteed to become false the moment anyone does authorized work elsewhere.
//
// The second shape is a ceiling on the repository. It fails on correct future changes made by people
// who have never read the contract that stops them, and it has already happened here more than once:
// an unrelated Supabase keep-alive migration failed a mobile chrome contract, and a whole-file hash
// of `mobile-ci.yml` failed three database contracts that have nothing to do with mobile CI.
//
// Removing those ceilings is only half a fix, because nothing prevents the next one. So this gate
// PROVES the property directly: it mirrors the repository into a temporary directory, performs the
// authorized future changes that are known to be coming, and runs every real contract against the
// mutated tree. Not a re-implementation of their assertions — the contracts themselves, so this can
// never drift from what they actually check.
//
// The negative half matters just as much. A gate that only proved "everything still passes" would be
// satisfied by contracts that assert nothing at all, so each mutation that SHOULD be refused is
// performed too, and the contract that owns it is required to fail.

const rootPath = fileURLToPath(new URL('../', import.meta.url));
const SELF = 'forward-safety-contract.test.mjs';

/** Everything a root contract may read. Generated and installed trees are not part of the source. */
const MIRRORED = ['.github', 'apps', 'database', 'docs', 'infra', 'packages', 'scripts', 'tests',
  'package.json', 'package-lock.json', 'tsconfig.base.json', 'README.md', 'AGENTS.md', '.env.example', '.gitignore'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

const mirrorPath = mkdtempSync(join(tmpdir(), 'qandeel-forward-safety-'));
for (const entry of MIRRORED) {
  const from = join(rootPath, entry);
  if (!existsSync(from)) continue;
  cpSync(from, join(mirrorPath, entry), { recursive: true, filter: (src) => !SKIP.test(src.slice(rootPath.length)) });
}
// Installed dependencies are linked, never copied: a contract that spawns a runner needs to resolve
// them, and no contract writes into them. `junction` is the Windows form that needs no privilege and
// is ignored on every other platform.
for (const modules of ['node_modules', join('apps', 'mobile', 'node_modules'), join('apps', 'api', 'node_modules')]) {
  const from = join(rootPath, modules);
  if (!existsSync(from)) continue;
  try {
    symlinkSync(from, join(mirrorPath, modules), 'junction');
  } catch {
    // A platform that refuses the link leaves the dependent contracts to fail loudly below, which is
    // the correct outcome: this gate never silently proves less than it claims.
  }
}
process.on('exit', () => {
  try {
    rmSync(mirrorPath, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // A temporary directory that outlives the process is not a test failure.
  }
});

/**
 * Contracts that assert properties of the WORKING TREE rather than of the source.
 *
 * Both interrogate git itself — which paths are tracked, which are ignored — so they are meaningless
 * against a copy that is not a repository, and initialising one would prove something about the copy
 * instead. They are excluded from the mutation runs and covered instead by the static sweep at the
 * end of this file, which proves they carry none of the ceiling shapes this gate exists to prevent.
 */
const WORKING_TREE_CONTRACTS = ['toolchain', 'mobile-foundation-toolchain-contract'];

const ALL_CONTRACTS = readdirSync(join(rootPath, 'tests'))
  .filter((file) => file.endsWith('.test.mjs') && file !== SELF)
  .map((file) => file.slice(0, -'.test.mjs'.length));

/** Every root contract except this one. Running this file inside itself would not terminate. */
const CONTRACTS = ALL_CONTRACTS.filter((name) => !WORKING_TREE_CONTRACTS.includes(name));

/**
 * Contracts that cost more than a second because they compile and execute production TypeScript.
 *
 * Running the whole set once per scenario would spend four minutes of CI proving the same thing five
 * times. These run in the COMBINED scenario at the end, where all four authorized changes are in
 * place at once — which is the stronger claim anyway — while the per-class scenarios use the fast set
 * so a failure still says which change caused it.
 */
const SLOW_CONTRACTS = ['canonical-home-placement-engine-contract'];
const FAST_CONTRACTS = CONTRACTS.filter((name) => !SLOW_CONTRACTS.includes(name));

/**
 * The child environment, with this file's own test-runner context removed.
 *
 * Inherited, `NODE_TEST_CONTEXT` makes the spawned Node believe it is a reporting child of THIS
 * runner: it switches to the parent's serialization protocol and exits 0 whatever its tests did. The
 * whole negative half of this gate would then pass vacuously — every refusal would read as an
 * acceptance — so the variable is stripped rather than trusted.
 */
const CHILD_ENV = { ...process.env };
delete CHILD_ENV.NODE_TEST_CONTEXT;

function runContract(name) {
  const result = spawnSync(process.execPath, ['--test', join(mirrorPath, 'tests', `${name}.test.mjs`)],
    { cwd: mirrorPath, encoding: 'utf8', env: CHILD_ENV });
  assert.equal(result.error, undefined, `${name} could not be started: ${result.error?.message}`);
  assert.notEqual(result.status, null, `${name} did not exit normally`);
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/**
 * Runs every mirrored contract in ONE test-runner process.
 *
 * Node's runner starts a child per file and runs them concurrently, so the whole set costs about
 * what the slowest few cost rather than the sum. The TAP reporter is requested explicitly so the
 * failure attribution below does not depend on whether CI attaches a terminal.
 */
function assertAllSurvive(reason, names = FAST_CONTRACTS) {
  const files = names.map((name) => join(mirrorPath, 'tests', `${name}.test.mjs`));
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files],
    { cwd: mirrorPath, encoding: 'utf8', env: CHILD_ENV, maxBuffer: 128 * 1024 * 1024 });
  assert.equal(result.error, undefined, `the contract set could not be started: ${result.error?.message}`);
  if (result.status === 0) return;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const evidence = output.split('\n')
    .filter((line) => /^not ok |AssertionError|error: '/u.test(line.trim()))
    .slice(0, 40)
    .join('\n');
  assert.fail(`${reason}\n\n${evidence}`);
}

function assertRefused(name, reason) {
  const result = runContract(name);
  assert.equal(result.ok, false, `${name} must refuse this: ${reason}`);
}

/**
 * Requires ONE named contract to survive a mutation.
 *
 * `assertAllSurvive` is the stronger claim and stays the default, but it attributes nothing: any one
 * of forty contracts failing for any reason reads as a failure of the scenario. Where a scenario
 * exists to prove something about a PARTICULAR contract, saying so directly means a failure names
 * the contract that actually broke.
 */
function assertSurvives(name, reason) {
  const result = runContract(name);
  assert.ok(result.ok, `${name} must accept this: ${reason}\n\n${result.output}`);
}

/** Reverts one mirrored path to the real repository's version, or removes a file that was added. */
function restore(...paths) {
  for (const relative of paths) {
    const from = join(rootPath, relative);
    const to = join(mirrorPath, relative);
    if (existsSync(from)) copyFileSync(from, to);
    else rmSync(to, { force: true });
  }
}

/**
 * Runs one mutation scenario and ALWAYS puts the mirror back.
 *
 * Without the `finally` a failing scenario would leave its mutation in place, and every scenario
 * after it would fail for a reason it did not cause — turning one real finding into six misleading
 * ones and hiding whichever came second.
 */
function scenario(paths, body) {
  try {
    body();
  } finally {
    restore(...paths);
  }
}

/**
 * Rewrites one mirrored file, and PROVES the rewrite happened.
 *
 * A mutation that silently matched nothing would leave the tree unchanged and turn the whole test
 * into a tautology — it would report that an authorized future change breaks nothing, having never
 * made one. So the transform must produce different text, and the expected marker must appear.
 */
function patch(relative, transform, marker) {
  const target = join(mirrorPath, relative);
  const before = readFileSync(target, 'utf8');
  const after = transform(before);
  assert.notEqual(after, before, `the ${relative} mutation matched nothing`);
  assert.ok(after.includes(marker), `the ${relative} mutation did not introduce ${marker}`);
  writeFileSync(target, after);
}

test('the mirror is a faithful, independently runnable copy of the repository', () => {
  // The baseline. Every claim below is worthless if the untouched mirror does not already pass.
  assert.ok(CONTRACTS.length >= 30, `the mirror carries the contract set, found ${CONTRACTS.length}`);
  assertAllSurvive('the untouched mirror must reproduce the repository exactly');
});

// ---------------------------------------------------------------------------------------------
// Authorized future work. Each of these WILL happen, and none of it may break a contract.
// ---------------------------------------------------------------------------------------------

/**
 * T-13 re-anchor, for the same reason as the T-10, T-11 and T-12 ones before it.
 *
 * The hypothetical was T-10's gate, then T-11's, then T-12's, then T-13's; each in turn registered
 * it for real, and re-using a registered name would insert a DUPLICATE registration — which several
 * contracts correctly refuse. A hypothetical has to stay hypothetical, so it moves on to the next
 * gate that is genuinely still in the future. The claim is unchanged and unweakened: a later task
 * registering its own Node-only mobile gate is authorized work.
 *
 * This is the mechanism working, not drifting: the assertion that survives is a property of gate
 * registration in general, and the name it is demonstrated with is deliberately disposable.
 * `QAN-SEC-01` is NOT authorized and nothing here starts it — this is a name for a gate that does not
 * exist, which is precisely what makes it a usable hypothetical.
 */
const FUTURE_GATE = 'test:qan-sec-01-mobile-credential-security-contract';
const FUTURE_GATE_FILE = 'tests/qan-sec-01-mobile-credential-security-contract.test.mjs';

test('a future authorized Mobile CI gate breaks no historical contract', () => scenario(
  ['.github/workflows/mobile-ci.yml', 'package.json', FUTURE_GATE_FILE],
  () => {
  const gate = FUTURE_GATE;
  patch('.github/workflows/mobile-ci.yml',
    (text) => text
      .replace(/^(\s*)- \{name: Verify Session Semantic Clock/mu,
        (match, indent) => `${indent}- {name: Verify hypothetical future responsive contract (T-11), run: npm run ${gate}}\n${match}`)
      .replace("'tests/session-semantic-clock-sp-lh-delivery-contract.test.mjs'",
        `'${FUTURE_GATE_FILE}', 'tests/session-semantic-clock-sp-lh-delivery-contract.test.mjs'`),
    gate);
  patch('package.json',
    (text) => text.replace(/^(\s*)"test:inspection-orientation-return-chrome-contract":/mu,
      (match, indent) => `${indent}"${gate}": "node --test ${FUTURE_GATE_FILE}",\n${match}`),
    gate);
  writeFileSync(join(mirrorPath, FUTURE_GATE_FILE), "import test from 'node:test';\ntest('probe', () => {});\n");

  assertAllSurvive('a later task registering its own Node-only mobile gate is authorized work');
}));

/**
 * An ADDITIVE NATIVE JOB, which is the ceiling class QAN-INF-04-FIX-01 had to clear.
 *
 * That task split each Mobile CI native job into a build producer and a separately re-runnable
 * validation consumer, so a flaked emulator stops costing a full Gradle or Xcode rebuild. It took the
 * workflow from three jobs to five — and NINETEEN contracts had frozen the COUNT: `runs-on: ` seen
 * exactly three times, the native-impact condition seen exactly twice, a job slice bounded by the
 * NAME of the job that follows it. Every one of them belonged to a task that does not own
 * `mobile-ci.yml`, and every one of them failed on a change that weakened nothing.
 *
 * They were re-anchored to the jobs that must durably EXIST and to the gating ratio. This scenario is
 * what stops the ceiling growing back: the next additive native job must cost nobody a re-anchor.
 */
const FUTURE_NATIVE_JOB = 'build-android-arm64';

test('a future authorized additive native job breaks no historical contract', () => scenario(
  ['.github/workflows/mobile-ci.yml'],
  () => {
  patch('.github/workflows/mobile-ci.yml',
    (text) => text.replace(/^ {2}build-ios:$/mu, [
      `  ${FUTURE_NATIVE_JOB}:`,
      '    name: Android Release APK (arm64) — HYPOTHETICAL FUTURE PRODUCER',
      '    needs: verify-mobile-contracts',
      "    if: needs.verify-mobile-contracts.outputs.native_impact == 'true'",
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - {name: Checkout, uses: actions/checkout@v4}',
      '  build-ios:',
    ].join('\n')),
    FUTURE_NATIVE_JOB);

  assertAllSurvive('a later task adding a native job to Mobile CI is authorized work');
}));

const PROBE_MIGRATION = 'database/migrations/0099_forward_safety_probe_v1.sql';

test('a future authorized migration breaks no T-03C, T-03D or Thread-layer contract', () => scenario([PROBE_MIGRATION], () => {
  // Numbered past every migration that exists, owning its own object and touching nobody else's —
  // which is exactly the shape of the keep-alive migration that broke the first T-08 candidate.
  writeFileSync(join(mirrorPath, PROBE_MIGRATION),
    '-- Forward-safety probe: an ordinary later migration that owns its own object.\n' +
    'CREATE TABLE public.forward_safety_probe_v1 (id uuid PRIMARY KEY);\n');

  assertAllSurvive('a later authorized migration on any track is not a mobile or Thread contract failure');
}));

const CHROME_MUTATIONS = ['apps/mobile/src/orientation-chrome/motion.ts', 'apps/mobile/src/orientation-chrome/OrientationChrome.tsx',
  'apps/mobile/src/orientation-chrome/ReturnControls.tsx', 'apps/mobile/src/shell/FoundationShell.tsx', 'apps/mobile/package.json'];

test('authorized T-10 motion, T-11 responsive work and T-12 shell integration break no T-08 contract', () => scenario(CHROME_MUTATIONS, () => {
  const chrome = 'apps/mobile/src/orientation-chrome';
  // T-10: motion arrives as its own module AND inside the components it animates. Both use packages
  // the app already declares, and neither touches a module that decides what is true.
  writeFileSync(join(mirrorPath, chrome, 'motion.ts'),
    "import { withTiming } from 'react-native-reanimated';\n\n" +
    'export const presence = (to: number) => withTiming(to, { duration: 160 });\n');
  patch(`${chrome}/OrientationChrome.tsx`,
    (text) => text.replace("import { StyleSheet, Text, View } from 'react-native';",
      "import { StyleSheet, Text, View } from 'react-native';\nimport Animated, { useSharedValue } from 'react-native-reanimated';"),
    'react-native-reanimated');
  // T-11 re-anchor: responsive work in the components is authorized, and this is the SHAPE it took.
  //
  // The mutation used to add `useWindowDimensions` here. T-11 has now landed, and it deliberately
  // did NOT teach the chrome to measure: the recomposition layer decides the arrangement from a
  // measured container and passes an already-decided token, which is what T-08 Â§11 meant by "it has
  // no width, breakpoint or layout input". A chrome that read the window would now be a defect, so
  // that mutation has moved to the refused half below, where it belongs — the authorized claim is
  // demonstrated with the presentation change T-11 actually makes.
  patch(`${chrome}/ReturnControls.tsx`,
    (text) => text.replace('  pressed: { opacity: 0.6 },', "  wrapped: { flexDirection: 'row', flexWrap: 'wrap' },\n  pressed: { opacity: 0.6 },"),
    'wrapped:');
  // T-12: the app shell mounts the chrome — through the public barrel, as the boundary requires.
  patch('apps/mobile/src/shell/FoundationShell.tsx',
    (text) => `import { OrientationChrome } from '../orientation-chrome';\n${text}`,
    "from '../orientation-chrome'");
  // T-11: the mobile app gains a dependency for responsive typography.
  patch('apps/mobile/package.json',
    (text) => text.replace(/^(\s*)"expo-status-bar":/mu, (match, indent) => `${indent}"expo-font": "~14.0.0",\n${match}`),
    'expo-font');

  assertAllSurvive('T-10 motion, T-11 responsive work and T-12 shell integration are all authorized');
}));

test('a future authorized root devDependency breaks no contract', () => scenario(['package.json'], () => {
  patch('package.json',
    (text) => text.replace('"devDependencies": {"pg":', '"devDependencies": {"c8": "^10.1.3", "pg":'),
    '"c8"');
  assertAllSurvive('the root toolchain is a shared mutable global, not any one task\'s to freeze');
}));

// ---------------------------------------------------------------------------------------------
// The other half: what must still be refused. Without these, a contract that asserts nothing at all
// would satisfy every test above.
// ---------------------------------------------------------------------------------------------

const MODEL = 'apps/mobile/src/orientation-chrome/model.ts';

test('a truth module that reaches an animation API is refused', () => scenario([MODEL], () => {
  patch(MODEL,
    (text) => text.replace("import { returnOrientation } from './return-orientation';",
      "import { useSharedValue } from 'react-native-reanimated';\nimport { returnOrientation } from './return-orientation';"),
    'useSharedValue');
  assertRefused('inspection-orientation-return-chrome-contract', 'what is true may never depend on a frame clock');
}));

test('a shell that reaches past the T-08 barrel is refused', () => scenario(['apps/mobile/src/shell/FoundationShell.tsx'], () => {
  patch('apps/mobile/src/shell/FoundationShell.tsx',
    (text) => `import { OrientationChrome } from '../orientation-chrome/OrientationChrome';\n${text}`,
    'orientation-chrome/OrientationChrome');
  assertRefused('inspection-orientation-return-chrome-contract', 'the barrel is the layer\'s whole public surface');
}));

test('a new chrome module that writes its own reader-facing words is refused', () => scenario(['apps/mobile/src/orientation-chrome/banner.ts'], () => {
  writeFileSync(join(mirrorPath, 'apps/mobile/src/orientation-chrome/banner.ts'),
    "export const BANNER = 'Something happened here';\n");
  assertRefused('inspection-orientation-return-chrome-contract', 'every word belongs in the one copy module');
}));

test('a chrome module that imports an undeclared package is refused', () => scenario([MODEL], () => {
  patch(MODEL,
    (text) => text.replace("import { returnOrientation } from './return-orientation';",
      "import { produce } from 'immer';\nimport { returnOrientation } from './return-orientation';"),
    "from 'immer'");
  assertRefused('inspection-orientation-return-chrome-contract', 'T-08 adds no dependency');
}));

test('a later migration that re-declares an owned substrate is refused', () => scenario([PROBE_MIGRATION], () => {
  writeFileSync(join(mirrorPath, PROBE_MIGRATION),
    'CREATE TABLE public.conversation_live_focus_transitions (id uuid PRIMARY KEY);\n' +
    'CREATE TABLE public.conversation_thread_lifecycle_events (id uuid PRIMARY KEY);\n');
  assertRefused('effective-live-focus-final-semantic-chain-cutover-contract', '0071 is the sole LF authority');
  assertRefused('thread-lifecycle-cross-session-continuity-contract', '0070 is the sole lifecycle authority');
}));

test('a duplicated Mobile CI gate registration is refused', () => scenario(['.github/workflows/mobile-ci.yml'], () => {
  patch('.github/workflows/mobile-ci.yml',
    (text) => text.replace(/^(\s*)(- \{name: Verify Inspection \+ Orientation \+ Return Chrome contract \(T-08\), run: npm run test:inspection-orientation-return-chrome-contract\})$/mu,
      (match, indent, step) => `${indent}${step}\n${indent}${step}`),
    'test:inspection-orientation-return-chrome-contract');
  for (const contract of ['durable-thread-home-same-sp-substrate-contract', 'effective-live-focus-final-semantic-chain-cutover-contract', 'historical-projection-contract']) {
    assertRefused(contract, 'a gate registered twice is a workflow defect, not growth');
  }
}));

/** The four authorized future changes, applied together. */
function applyEveryAuthorizedChange() {
  const gate = FUTURE_GATE;
  patch('.github/workflows/mobile-ci.yml',
    (text) => text
      .replace(/^(\s*)- \{name: Verify Session Semantic Clock/mu,
        (match, indent) => `${indent}- {name: Verify hypothetical future responsive contract (T-11), run: npm run ${gate}}\n${match}`)
      .replace("'tests/session-semantic-clock-sp-lh-delivery-contract.test.mjs'",
        `'${FUTURE_GATE_FILE}', 'tests/session-semantic-clock-sp-lh-delivery-contract.test.mjs'`),
    gate);
  patch('package.json',
    (text) => text
      .replace(/^(\s*)"test:inspection-orientation-return-chrome-contract":/mu,
        (match, indent) => `${indent}"${gate}": "node --test ${FUTURE_GATE_FILE}",\n${match}`)
      .replace('"devDependencies": {"pg":', '"devDependencies": {"c8": "^10.1.3", "pg":'),
    gate);
  writeFileSync(join(mirrorPath, FUTURE_GATE_FILE), "import test from 'node:test';\ntest('probe', () => {});\n");
  writeFileSync(join(mirrorPath, PROBE_MIGRATION),
    '-- Forward-safety probe: an ordinary later migration that owns its own object.\n' +
    'CREATE TABLE public.forward_safety_probe_v1 (id uuid PRIMARY KEY);\n');
  writeFileSync(join(mirrorPath, 'apps/mobile/src/orientation-chrome/motion.ts'),
    "import { withTiming } from 'react-native-reanimated';\n\n" +
    'export const presence = (to: number) => withTiming(to, { duration: 160 });\n');
  patch('apps/mobile/src/orientation-chrome/OrientationChrome.tsx',
    (text) => text.replace("import { StyleSheet, Text, View } from 'react-native';",
      "import { StyleSheet, Text, View } from 'react-native';\nimport Animated, { useSharedValue } from 'react-native-reanimated';"),
    'react-native-reanimated');
  // T-11 re-anchor, matching the scenario above: responsive work in the components is authorized,
  // and the shape it took is a presentation arrangement rather than a window measurement. Reading
  // the display here is now a defect, and is proven refused in the negative half.
  patch('apps/mobile/src/orientation-chrome/ReturnControls.tsx',
    (text) => text.replace('  pressed: { opacity: 0.6 },', "  wrapped: { flexDirection: 'row', flexWrap: 'wrap' },\n  pressed: { opacity: 0.6 },"),
    'wrapped:');
  patch('apps/mobile/src/shell/FoundationShell.tsx',
    (text) => `import { OrientationChrome } from '../orientation-chrome';\n${text}`,
    "from '../orientation-chrome'");
  patch('apps/mobile/package.json',
    (text) => text.replace(/^(\s*)"expo-status-bar":/mu, (match, indent) => `${indent}"expo-font": "~14.0.0",\n${match}`),
    'expo-font');
}

test('every authorized future change at once breaks nothing, including the contracts that execute production code', () => scenario(
  ['.github/workflows/mobile-ci.yml', 'package.json', FUTURE_GATE_FILE, PROBE_MIGRATION, ...CHROME_MUTATIONS],
  () => {
    applyEveryAuthorizedChange();
    // The FULL set this time: a repository one authorized step into its own future must be green.
    assertAllSurvive('the repository one authorized step into its future must still be green', CONTRACTS);
  }));

test('the mirror is back to the real repository after every mutation', () => {
  assertAllSurvive('every mutation above was reverted');
});

// ---------------------------------------------------------------------------------------------
// The class itself, kept out. Mutation proves today's contracts are forward-safe; this proves the
// SHAPES that made them ceilings cannot come back — including in the two contracts above that
// interrogate git and therefore cannot be run against a copy.
// ---------------------------------------------------------------------------------------------

test('no root contract carries a mutable-global ceiling of any known shape', () => {
  const CEILINGS = [
    // A whole-file hash of something no single task owns. The file legitimately grows.
    [/gitBlobId\(\s*(?:read\(\s*)?'(?:\.github\/workflows\/[\w.-]+|package\.json|package-lock\.json|apps\/[\w-]+\/package\.json|packages\/[\w-]+\/package\.json)'/u,
      'a whole-file hash of a shared workflow or manifest'],
    // A hash of the app shell or the router root. Mounting the Product surfaces there is a later
    // authorized task's entire job, so this freezes work the roadmap already schedules.
    [/'apps\/mobile\/src\/(?:shell\/FoundationShell\.tsx|app\/(?:_layout|index)\.tsx)'\s*,\s*'[0-9a-f]{40}'|gitBlobId\([^)]*'apps\/mobile\/src\/(?:shell|app)\//u,
      'a byte hash of the app shell or the router root'],
    // An exhaustive census of a manifest. The next authorized dependency breaks it.
    [/deepEqual\(\s*Object\.keys\(\s*\w*[Pp]ackage\.(?:dependencies|devDependencies)/u,
      'an exhaustive census of a manifest'],
    [/deepEqual\(\s*Object\.keys\(\s*\w*[Pp]ackage\.(?:dependencies|devDependencies)\s*\)\.sort\(\)/u,
      'an exhaustive sorted census of a manifest'],
    // An exhaustive list of the workflow's gate steps. The next authorized task adds one.
    [/deepEqual\(\s*\[\s*\.\.\.\s*\w+\.matchAll\(\/run: npm run/u,
      'an exhaustive list of a workflow\'s gate steps'],
    // A COUNT of a shared workflow's jobs. QAN-INF-04-FIX-01 split each Mobile CI native job into a
    // build producer and a separately re-runnable validation consumer — infrastructure that weakened
    // nothing — and had to clear this shape out of NINETEEN contracts, almost all belonging to closed
    // tasks that do not own `mobile-ci.yml`. What a contract may durably claim is which jobs EXIST and
    // that each one stays behind the classifier; never how many there are.
    [/\.match\(\/runs-on:[^/]*\/gu\)\s*\?\?\s*\[\]\)\.length,\s*\d/u,
      "a count of a shared workflow's jobs"],
    [/native_impact == 'true'\/gu\)\s*\?\?\s*\[\]\)\.length,\s*\d/u,
      "a count of a shared workflow's gated jobs"],
    // An enumeration of everything that follows a migration. The next migration breaks it.
    [/deepEqual\(\s*migrations\.filter\(\([\w\s)]*\)\s*=>\s*\w+\s*>\s*\w+\)/u,
      'an enumeration of every migration that follows this one'],
    [/deepEqual\(\s*migrations\.filter\(\([\w\s)]*\)\s*=>\s*\/00\\?d/u,
      'an enumeration of a whole migration band'],
  ];
  const offenders = [];
  for (const name of ALL_CONTRACTS) {
    const text = readFileSync(join(rootPath, 'tests', `${name}.test.mjs`), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/^\s*\/\/[^\n]*$/gmu, '');
    for (const [pattern, shape] of CEILINGS) {
      if (pattern.test(text)) offenders.push(`${name}: ${shape}`);
    }
  }
  assert.deepEqual(offenders, [],
    'a static contract may freeze what its own task permanently owns; it may not put a ceiling on a file the whole repository shares');
});

test('this gate is registered, and every contract it protects is still reachable from it', () => {
  const rootPackage = JSON.parse(readFileSync(join(rootPath, 'package.json'), 'utf8'));
  assert.equal(rootPackage.scripts['test:forward-safety-contract'], 'node --test tests/forward-safety-contract.test.mjs');
  assert.match(readFileSync(join(rootPath, '.github/workflows/api-ci.yml'), 'utf8'), /run: npm run test:forward-safety-contract/u);
  // Every contract is either mutated against, or explicitly named as working-tree dependent. There
  // is no third category, so a new contract cannot quietly escape this gate.
  assert.deepEqual([...CONTRACTS, ...WORKING_TREE_CONTRACTS].sort(), [...ALL_CONTRACTS].sort());
});

// ---------------------------------------------------------------------------------------------
// R3-05 — the semantic firewall follows the import graph, not a list of today's filenames.
//
// Each of these adds a module that did not exist when the guard was written, and each is reachable
// from a semantic root only THROUGH another module. A filename census passes every one of them.
// ---------------------------------------------------------------------------------------------

const RETURN_ORIENTATION = 'apps/mobile/src/orientation-chrome/return-orientation.ts';
const HELPER = 'apps/mobile/src/orientation-chrome/semantic-helper.ts';
const HELPER_A = 'apps/mobile/src/orientation-chrome/semantic-a.ts';
const HELPER_B = 'apps/mobile/src/orientation-chrome/semantic-b.ts';

/** Writes a brand-new module into the mirrored layer. */
function addModule(relative, source) {
  const target = join(mirrorPath, relative);
  assert.equal(existsSync(target), false, `${relative} must not already exist`);
  writeFileSync(target, source);
}

test('a semantic helper one hop from the model that reads the viewport is refused', () => scenario([MODEL, HELPER], () => {
  addModule(HELPER, "import { useWindowDimensions } from 'react-native';\nexport const width = (): number => useWindowDimensions().width;\n");
  patch(MODEL, (text) => `import { width } from './semantic-helper';\n${text}`, "from './semantic-helper'");
  assertRefused('inspection-orientation-return-chrome-contract', 'what is true may never depend on the size of the viewport');
}));

test('a semantic helper one hop from the return orientation that reaches an animation API is refused', () => scenario([RETURN_ORIENTATION, HELPER], () => {
  addModule(HELPER, "import { withTiming } from 'react-native-reanimated';\nexport const settle = (value: number): number => withTiming(value);\n");
  patch(RETURN_ORIENTATION, (text) => `import { settle } from './semantic-helper';\n${text}`, "from './semantic-helper'");
  assertRefused('inspection-orientation-return-chrome-contract', 'an act is meaningful or not; an animation cannot decide it');
}));

test('a frame clock TWO hops from the model is refused', () => scenario([MODEL, HELPER_A, HELPER_B], () => {
  // Neither new module is named in any guard, and only the first is imported by a root. The second
  // is reachable only through the first, which is exactly what a census cannot see.
  addModule(HELPER_B, 'export const tick = (): void => {\n  requestAnimationFrame(() => undefined);\n};\n');
  addModule(HELPER_A, "import { tick } from './semantic-b';\nexport const relay = (): void => tick();\n");
  patch(MODEL, (text) => `import { relay } from './semantic-a';\n${text}`, "from './semantic-a'");
  assertRefused('inspection-orientation-return-chrome-contract', 'the closure is transitive, at any depth');
}));

test('a semantic helper that reads a gesture is refused', () => scenario([MODEL, HELPER], () => {
  addModule(HELPER, "import { Gesture } from 'react-native-gesture-handler';\nexport const pan = () => Gesture.Pan();\n");
  patch(MODEL, (text) => `import { pan } from './semantic-helper';\n${text}`, "from './semantic-helper'");
  // The package is declared by the mobile app, so the dependency guard does NOT catch this one.
  // Only the semantic closure does, which is the point.
  assertRefused('inspection-orientation-return-chrome-contract', 'a gesture stream may never decide what is true');
}));

test('a semantic module that reaches sideways into a future presentation layer is refused', () => scenario([RETURN_ORIENTATION], () => {
  patch(RETURN_ORIENTATION, (text) => `import { breakpointOf } from '../responsive';\n${text}`, "from '../responsive'");
  assertRefused('inspection-orientation-return-chrome-contract', 'a semantic module may only reach an authorized owner layer');
}));

// ---------------------------------------------------------------------------------------------
// T-11's own half of the refusals. The responsive owner is a closure, not a convention: what it may
// never reach must fail when reached, or the boundary is only a comment.
// ---------------------------------------------------------------------------------------------

const CHROME_COMPONENT = 'apps/mobile/src/orientation-chrome/OrientationChrome.tsx';
const RESPONSIVE_PLAN = 'apps/mobile/src/responsive/plan.ts';
const RESPONSIVE_HELPER = 'apps/mobile/src/responsive/helper.ts';

test('a Product surface that takes the DISPLAY as its responsive authority is refused', () => scenario([CHROME_COMPONENT], () => {
  // The mutation the old authorized scenario used to perform. A reusable surface does not own the
  // display: it is composed inside something, and answering "how big is the screen" confidently is
  // how one Product becomes two.
  patch(CHROME_COMPONENT,
    (text) => text.replace("import { StyleSheet, Text, View } from 'react-native';", "import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';"),
    'useWindowDimensions');
  assertRefused('t11-responsive-contract', 'the measured container is the only responsive authority');
}));

test('a responsive module that reaches a canonical executor is refused', () => scenario([RESPONSIVE_PLAN], () => {
  patch(RESPONSIVE_PLAN, (text) => `import { returnWorld } from '../return-navigation';\n${text}`, "from '../return-navigation'");
  assertRefused('t11-responsive-contract', 'a layout may never reach an act');
}));

test('a responsive helper that names a Product concept is refused', () => scenario([RESPONSIVE_PLAN, RESPONSIVE_HELPER], () => {
  addModule(RESPONSIVE_HELPER, 'export const FOLLOW_LIVE = 1;\n');
  patch(RESPONSIVE_PLAN, (text) => `import { FOLLOW_LIVE } from './helper';\n${text}`, "from './helper'");
  assertRefused('t11-responsive-contract', 'no Product answer can be spelled in a layout');
}));

test('a responsive module that invents its own motion vocabulary is refused', () => scenario([RESPONSIVE_PLAN], () => {
  patch(RESPONSIVE_PLAN, (text) => `import { withTiming } from 'react-native-reanimated';\nexport const ease = () => withTiming(1);\n${text}`, 'withTiming');
  assertRefused('t11-responsive-contract', 'a window is not a destination, and a resize is not a transition');
}));

test('a chrome that branches on a device class is refused', () => scenario([CHROME_COMPONENT], () => {
  patch(CHROME_COMPONENT, (text) => text.replace("import { useCallback", "import { Platform } from 'react-native';\nimport { useCallback"), 'Platform');
  assertRefused('t11-responsive-contract', 'a breakpoint that names a device becomes a Product concept');
}));

// ---------------------------------------------------------------------------------------------
// QAN-GOV-03 — the closure-governance gate's own halves.
//
// That gate derives its subjects from the canonical backlog precisely so it is not a ceiling, and
// that claim is worth exactly as much as a test of it. The positive scenario grows the repository in
// the two ways task work actually grows it — one task opening, one task closing — and requires the
// gate to stay green without being edited. The refusals below are the planted defects it exists to
// catch; without them a gate that asserted nothing would satisfy the positive half.
// ---------------------------------------------------------------------------------------------

const CLOSURE_GATE = 'task-closure-governance-contract';
const BACKLOG_DOC = 'docs/qandeel-canonical-backlog-v1.md';
const T13_DOC = 'docs/recovery-persistence-v1.md';
const T14_DOC = 'docs/mobile-product-sign-in-gateway-v1.md';
const FUTURE_OPEN_DOC = 'docs/hypothetical-future-task-v1.md';
const FUTURE_CLOSED_DOC = 'docs/hypothetical-closed-task-v1.md';
const STALE_BANNER = '**Status:** CANDIDATE — awaiting independent review';

test('a future task opening and a future task closing break no closure-governance contract', () => scenario(
  [FUTURE_OPEN_DOC, FUTURE_CLOSED_DOC, BACKLOG_DOC],
  () => {
    // A task genuinely still in review. Its banner is the exact phrase QAN-GOV-03 repaired — and it
    // is CORRECT here, because the register makes no closure claim about T-99. A gate that simply
    // banned the phrase would fail this, and would teach the next author to lie in a banner.
    writeFileSync(join(mirrorPath, FUTURE_OPEN_DOC),
      '# Hypothetical Future Task v1 — T-99\n\n' +
      `${STALE_BANNER}\n**Owner of:** nothing; this document exists only inside the forward-safety mirror.\n`);

    // A task that closes CORRECTLY after this contract was written: a tombstone naming it, and a
    // primary document whose banner agrees. The gate must pick it up with no edit to the gate.
    writeFileSync(join(mirrorPath, FUTURE_CLOSED_DOC),
      '# Hypothetical Closed Task v1 — T-98\n\n' +
      '**Status:** CLOSED / FROZEN — merged by a hypothetical future PR.\n');
    patch(BACKLOG_DOC,
      (text) => text.replace('| `QAN-BL-NAV-01` |',
        '| `QAN-BL-FS-01` | Hypothetical forward-safety probe | `T-98 — Hypothetical Closed Task` | `LOW` | `CLOSED — TOMBSTONE` |\n| `QAN-BL-NAV-01` |'),
      'QAN-BL-FS-01');

    // The claim this scenario exists for, named directly: the gate covers the newly closed task
    // without being edited, and does not fire on the open one merely because the phrase appears.
    assertSurvives(CLOSURE_GATE, 'a task opening and a task closing are ordinary growth, not a governance failure');
    // And the broader claim: no other contract minds two new documents and a new register row.
    assertAllSurvive('a task opening and a task closing are ordinary growth, not a governance failure');
  }));

test('a closed task reverted to a candidate banner is refused', () => scenario([T13_DOC], () => {
  patch(T13_DOC,
    (text) => text.replace(/\*\*Status:\*\*[^\r\n]*/u, STALE_BANNER),
    STALE_BANNER);
  assertRefused(CLOSURE_GATE, 'T-13 is recorded closed; its own document may not still be awaiting review');
}));

test('a second closed task reverted to a candidate banner is refused', () => scenario([T14_DOC], () => {
  patch(T14_DOC,
    (text) => text.replace(/\*\*Status:\*\*[^\r\n]*/u, STALE_BANNER),
    STALE_BANNER);
  assertRefused(CLOSURE_GATE, 'T-14 is recorded closed; its own document may not still be awaiting review');
}));

test('removing the BG-08 closure-reconciliation authority is refused', () => scenario([BACKLOG_DOC], () => {
  patch(BACKLOG_DOC,
    (text) => text.replace('**BG-08 — Closure reconciliation / backlog admission.**', '**BG-08 — Reserved.**'),
    '**BG-08 — Reserved.**');
  assertRefused(CLOSURE_GATE, 'BG-08 is the one closure-reconciliation authority and QAN-GOV-03 did not replace it');
}));

test('weakening BG-08 so reconciliation may happen after closure is refused', () => scenario([BACKLOG_DOC], () => {
  // The subtle half. The rule still exists, still names the backlog, still lists the dispositions —
  // it has only stopped requiring that any of it happen BEFORE the task is called closed, which is
  // the single property that made it a gate rather than a suggestion.
  patch(BACKLOG_DOC,
    (text) => text.replace('the complete schema of §2, *before* closure.', 'the complete schema of §2, after closure.'),
    'the complete schema of §2, after closure.');
  assertRefused(CLOSURE_GATE, 'reconciliation after closure is the defect BG-08 exists to prevent');
}));

test('removing the BG-09 closure-state synchronization rule is refused', () => scenario([BACKLOG_DOC], () => {
  patch(BACKLOG_DOC,
    (text) => {
      const start = text.indexOf('**BG-09 — Same-task closure-state synchronization.**');
      assert.ok(start > 0, 'BG-09 must be present in order to be removed');
      const end = text.indexOf('\n---', start);
      assert.ok(end > start, 'the BG-09 section must be bounded by the rules-section break');
      return `${text.slice(0, start)}<!-- BG-09 removed by the forward-safety probe -->${text.slice(end)}`;
    },
    '<!-- BG-09 removed by the forward-safety probe -->');
  assertRefused(CLOSURE_GATE, 'the rule whose absence let two closed tasks advertise candidate banners may not simply be deleted');
}));

test('the mirror is back to the real repository after the transitive mutations', () => {
  for (const added of [HELPER, HELPER_A, HELPER_B, FUTURE_OPEN_DOC, FUTURE_CLOSED_DOC]) {
    assert.equal(existsSync(join(mirrorPath, added)), false, `${added} was removed again`);
  }
  assertAllSurvive('the transitive scenarios left the mirror exactly as they found it');
});
