// QAN-INF-03 - the focused database verification runner.
//
// One command that takes a disposable PostgreSQL from empty to a verified
// answer: Supabase-compatible bootstrap, every migration from zero in canonical
// order, then ONLY the selected verifier(s), then a summary that is printed
// whether the run passed or failed.
//
// ## Why this exists
//
// Full API CI runs a hundred and forty steps, and the database verifiers are at
// the end of them. Using it to find a defect in one verifier costs about twenty
// minutes per finding, and a verifier that stops at its first failure yields
// exactly one finding per round. That is how a two-hour slice becomes a
// seven-hour one, and it is a property of the LOOP, not of the work.
//
// This runner is the same database, the same bootstrap, the same migrations and
// the same verifier command, with the hundred and thirty-five unrelated steps
// removed. Full API CI goes back to being the confirmation gate it should be.
//
// ## What a selector may be
//
// A NAME, and only a name:
//
//   i06a-all        a group from database/focused-verifiers.json
//   migration-0101  the generic form, which needs no entry anywhere
//
// It is matched against a bounded pattern, resolved against a data file, and the
// resolved paths are required to be `database/verify-<slug>.mjs`. Every child is
// spawned with an argument vector and no shell, so neither this file nor a
// workflow input can introduce a command. See §12 of the task contract.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The harness's own root: the mapping and the bootstrap are read from HERE. */
const harnessRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SELECTOR = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const GENERIC = /^migration-(\d{4})$/u;
/** A resolved verifier is a repository verifier, and can be nothing else. */
const VERIFIER_PATH = /^database\/verify-[a-z0-9][a-z0-9-]*\.mjs$/u;
/**
 * What a git ref may look like before it is handed to `actions/checkout`.
 *
 * Deliberately narrower than git's own rules: a branch, a tag or a SHA, and
 * nothing that reads as an option, a parent traversal or a reflog expression. It
 * is never interpolated into a shell - the workflow passes it through `env` and
 * this check reads it from there - so this is defence in depth rather than the
 * only thing standing between an input and a command.
 */
const TARGET_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/u;
const REF_FORBIDDEN = /\.\.|@\{|\/\/|\/$|\.lock$|[~^:?*[\\\s]/u;

function fail(message) {
  console.error(`focused verification: ${message}`);
  process.exit(2);
}

// ------------------------------------------------------------------ arguments
function parseArguments(argv) {
  const options = { selector: null, repo: process.cwd(), artifacts: null, databaseUrl: process.env.DATABASE_URL ?? null, bootstrap: true, migrate: true };
  for (let i = 0; i < argv.length; i += 1) {
    const argument = argv[i];
    const take = () => {
      const value = argv[i + 1];
      if (value === undefined) fail(`${argument} needs a value`);
      i += 1;
      return value;
    };
    if (argument === '--selector') options.selector = take();
    else if (argument === '--repo') options.repo = resolve(take());
    else if (argument === '--artifacts') options.artifacts = resolve(take());
    else if (argument === '--database-url') options.databaseUrl = take();
    else if (argument === '--skip-bootstrap') options.bootstrap = false;
    else if (argument === '--skip-migrations') options.migrate = false;
    else if (argument.startsWith('--')) fail(`unknown option ${argument}`);
    else if (options.selector === null) options.selector = argument;
    else fail(`unexpected argument ${argument}`);
  }
  if (options.selector === null) options.selector = process.env.FOCUSED_VERIFIER ?? null;
  return options;
}

/**
 * Turns one selector into an ordered list of verifier paths.
 *
 * Validation happens in three independent places on purpose: the NAME must match
 * a bounded pattern, the name must resolve to something this repository already
 * declares, and each resolved PATH must still look like a verifier. A mapping
 * file that named something else would be refused by the third check even though
 * it passed the second.
 */
function resolveSelector(selector) {
  if (!selector) fail('a selector is required, for example: i06a-all, or migration-0101');
  if (!SELECTOR.test(selector)) fail(`selector ${JSON.stringify(selector)} is not a bounded selector name`);

  const generic = GENERIC.exec(selector);
  if (generic) return { title: `migration ${generic[1]} verifier`, verifiers: [`database/verify-migration-${generic[1]}.mjs`] };

  const mappingPath = join(harnessRoot, 'database', 'focused-verifiers.json');
  const mapping = JSON.parse(readFileSync(mappingPath, 'utf8'));
  const group = mapping.groups?.[selector];
  if (!group) {
    fail(`unknown selector ${JSON.stringify(selector)}. Known groups: ${Object.keys(mapping.groups ?? {}).sort().join(', ')}`
      + ', or the generic form migration-NNNN');
  }
  return { title: group.title ?? selector, verifiers: group.verifiers ?? [] };
}

// -------------------------------------------------------------------- process
function run(command, args, { cwd, env, label }) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, shell: false });
  if (result.error) return { ok: false, status: null, output: `${label} could not be started: ${result.error.message}` };
  return { ok: result.status === 0, status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

const psqlAvailable = () => spawnSync('psql', ['--version'], { encoding: 'utf8', shell: false }).status === 0;

/**
 * The pre-checkout gate: both dispatch inputs are answered for BEFORE the ref
 * under test is fetched and before its `npm ci` runs.
 *
 * A selector that names nothing, or a ref that does not look like a ref, should
 * cost four seconds and say so - not a checkout, a full install and a confusing
 * failure three minutes later.
 */
function checkInputs() {
  const ref = process.env.FOCUSED_TARGET_REF ?? '';
  if (!TARGET_REF.test(ref) || REF_FORBIDDEN.test(ref)) fail(`target ref ${JSON.stringify(ref)} is not a plain branch, tag or SHA`);
  const { title: resolvedTitle, verifiers: resolvedVerifiers } = resolveSelector(process.env.FOCUSED_VERIFIER ?? '');
  console.log(`focused verification inputs accepted`);
  console.log(`  target ref ${ref}`);
  console.log(`  selector   ${process.env.FOCUSED_VERIFIER} -> ${resolvedTitle}`);
  console.log(`  verifiers  ${resolvedVerifiers.join(', ')}`);
  process.exit(0);
}

// ------------------------------------------------------------------------ run
if (process.argv.includes('--check-inputs')) checkInputs();

const options = parseArguments(process.argv.slice(2));
const { title, verifiers } = resolveSelector(options.selector);

if (!options.databaseUrl) fail('DATABASE_URL is required (environment, or --database-url)');
if (!existsSync(options.repo)) fail(`the repository under test does not exist: ${options.repo}`);

const artifacts = options.artifacts ?? join(options.repo, 'focused-verification-artifacts');
mkdirSync(artifacts, { recursive: true });
const artifact = (name, body) => writeFileSync(join(artifacts, name), body);

const childEnv = { ...process.env, DATABASE_URL: options.databaseUrl, PGPASSWORD: process.env.PGPASSWORD ?? 'postgres' };
// Inherited from a Node test runner, this makes every spawned Node believe it is
// a reporting child and exit 0 whatever it did - which would turn every verifier
// failure below into a pass.
delete childEnv.NODE_TEST_CONTEXT;

const resolved = [];
for (const relative of verifiers) {
  if (!VERIFIER_PATH.test(relative)) fail(`${relative} is not a repository verifier path`);
  const absolute = join(options.repo, relative);
  if (!existsSync(absolute)) {
    fail(`${relative} does not exist in the repository under test.\n`
      + '  The focused gate runs the harness from the default branch against ANOTHER ref: a selector\n'
      + '  naming a verifier that ref does not carry is a selector mistake, not a verifier failure.');
  }
  resolved.push({ relative, absolute });
}
if (resolved.length === 0) fail(`selector ${options.selector} resolves to no verifier`);

console.log(`focused database verification: ${title}`);
console.log(`  selector   ${options.selector}`);
console.log(`  repository ${options.repo}`);
console.log(`  verifiers  ${resolved.map((v) => v.relative).join(', ')}`);

// --- environment, recorded before anything can change it
//
// `psql` applies the bootstrap and the migrations, byte for byte as api-ci.yml
// does. It is NOT needed to run a verifier, which reaches PostgreSQL through
// `pg` - so a re-run against an already-prepared database does not require it.
const needsPsql = options.bootstrap || options.migrate;
if (needsPsql && !psqlAvailable()) {
  fail('psql was not found on PATH.\n'
    + '  The focused GitHub gate always has it. Locally it arrives with a portable PostgreSQL\n'
    + '  distribution - see docs/local-focused-database-verification-v1.md. This runner never\n'
    + '  installs anything and never targets a live database.\n'
    + '  To re-run a verifier against a database that is already prepared, pass\n'
    + '  --skip-bootstrap --skip-migrations.');
}
const serverVersion = needsPsql
  ? run('psql', [options.databaseUrl, '-At', '-c', 'SELECT version()'], { env: childEnv, label: 'version' })
  : { output: '(not probed: psql steps were skipped)' };
const head = run('git', ['-C', options.repo, 'log', '-1', '--format=%H %s'], { label: 'head' });
artifact('environment.txt', [
  `selector: ${options.selector}`,
  `group: ${title}`,
  `verifiers: ${resolved.map((v) => v.relative).join(' ')}`,
  `repository: ${options.repo}`,
  `target ref: ${process.env.FOCUSED_TARGET_REF ?? '(local)'}`,
  `target head: ${head.ok ? head.output.trim() : '(not a git checkout)'}`,
  `node: ${process.version}`,
  `psql: ${needsPsql ? (spawnSync('psql', ['--version'], { encoding: 'utf8', shell: false }).stdout?.trim() ?? 'unknown') : '(not used)'}`,
  `server: ${serverVersion.output.trim()}`,
  '',
].join('\n'));

// --- bootstrap
if (options.bootstrap) {
  const bootstrap = join(harnessRoot, 'database', 'supabase-compatible-bootstrap.sql');
  const result = run('psql', [options.databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', bootstrap], { env: childEnv, label: 'bootstrap' });
  artifact('bootstrap.log', result.output);
  if (!result.ok) {
    console.error(result.output);
    fail('the Supabase-compatible bootstrap failed. A database that already carries these roles is not a fresh one.');
  }
  console.log('  bootstrap  Supabase-compatible roles, auth schema and auth.uid() created');
}

// --- every migration, from zero, in canonical filename order
if (options.migrate) {
  const directory = join(options.repo, 'database', 'migrations');
  const migrations = readdirSync(directory).filter((file) => file.endsWith('.sql')).sort();
  if (migrations.length === 0) fail(`no migrations found in ${directory}`);
  const log = [];
  for (const migration of migrations) {
    const result = run('psql', [options.databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', join(directory, migration)], { env: childEnv, label: migration });
    log.push(`--- ${migration}\n${result.output}`);
    if (!result.ok) {
      artifact('migrations.log', log.join('\n'));
      console.error(result.output);
      fail(`migration ${migration} failed to apply. Nothing was verified.`);
    }
  }
  artifact('migrations.log', log.join('\n'));
  console.log(`  migrate    ${migrations.length} migration(s) applied from zero, ${migrations[0]} .. ${migrations[migrations.length - 1]}`);
}

// --- the selected verifiers, each reported on its own
console.log('');
const outcomes = [];
for (const verifier of resolved) {
  const name = verifier.relative.replace(/^database\/|\.mjs$/gu, '');
  const started = Date.now();
  const result = run(process.execPath, [verifier.absolute], { cwd: options.repo, env: childEnv, label: name });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  process.stdout.write(result.output);
  artifact(`${name}.log`, result.output);
  outcomes.push({ name, ok: result.ok, status: result.status, seconds, scenarios: readScenarioSummary(result.output) });
  console.log(`\n--- ${name}: ${result.ok ? 'PASS' : 'FAIL'} in ${seconds}s\n`);
}

/**
 * Lifts the per-scenario lines a verifier printed through `verifier-scenarios.mjs`.
 *
 * The verifier already reported them; repeating them in the final table is what
 * makes ONE focused run answer "which of the eight probes failed" without anyone
 * scrolling a log. A verifier that does not use the helper simply contributes no
 * scenario rows, and its own PASS/FAIL still stands.
 */
function readScenarioSummary(output) {
  const rows = [];
  for (const line of output.split('\n')) {
    const match = /^ {2}(PASS|FAIL) {2}(\S+) *(.*)$/u.exec(line.replace(/\r$/u, ''));
    if (match) rows.push({ ok: match[1] === 'PASS', name: match[2], detail: match[3].trim() });
  }
  return rows;
}

// --- the summary, always
const failed = outcomes.filter((o) => !o.ok);
const lines = [`focused database verification summary - ${title}`, ''];
for (const outcome of outcomes) {
  lines.push(`${outcome.ok ? 'PASS' : 'FAIL'}  ${outcome.name}  (${outcome.seconds}s, exit ${outcome.status})`);
  for (const scenario of outcome.scenarios) {
    lines.push(`      ${scenario.ok ? 'pass' : 'FAIL'}  ${scenario.name}${scenario.detail ? `  ${scenario.detail}` : ''}`);
  }
}
lines.push('', `${outcomes.length} verifier(s), ${outcomes.length - failed.length} passed, ${failed.length} failed`);
const summary = lines.join('\n');
console.log(summary);
artifact('summary.md', `${summary}\n`);
artifact('summary.json', `${JSON.stringify({ selector: options.selector, title, outcomes }, null, 2)}\n`);

if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `\`\`\`\n${summary}\n\`\`\`\n`, { flag: 'a' });
}

process.exit(failed.length === 0 ? 0 : 1);
