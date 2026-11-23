import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// S8B-07 RB-2 / S2, Alternative A (PO direction D-S2-12, provisional; execution scope v1.2, A-02) - the bounded
// historical observation sweeper. This is the STATIC contract: the one database call, the one opt-in flag, the ceilings,
// the closed telemetry, the yield wired to the existing permit gate's observer, and nothing of S1's ledger or of an
// immediate observation path reachable from the API or the app. The behaviour (A-03 .. A-14) is proven against real
// PostgreSQL by apps/api/scripts/rb2-s2-semantic-commit-sweeper-proof.ts in API CI. Each detector is shown to catch a
// planted defect.

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/gu, '\n');
const WORKER = 'apps/api/src/live-focus/semantic-commit-sweeper.worker.ts';
const REPOSITORY = 'apps/api/src/live-focus/conversation-semantic-runtime.repository.ts';
const MODULE = 'apps/api/src/conversation/conversation.module.ts';
const TELEMETRY = 'apps/api/src/observability/telemetry.service.ts';
const MIGRATION = 'database/migrations/0201_s8b_07_semantic_commit_instants_v1.sql';
/** 0201 as S1 merged it (f45400a8): S2 adds no migration and changes none. */
const MIGRATION_0201_SHA256 = '66e01ee577c850fcef6d03cb7d5543d560bc713b76d4c0da2d23e095c69af7d5';

const walk = (dir) => readdirSync(join(ROOT, dir)).flatMap((name) => {
  const path = `${dir}/${name}`;
  if (name === 'node_modules' || name.startsWith('.')) return [];
  if (statSync(join(ROOT, path)).isDirectory()) return walk(path);
  return /\.(?:[cm]?[jt]sx?)$/u.test(name) ? [path] : [];
});
/** Source without comments, so a sentence in a header is never mistaken for code. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/[^\n]*/gu, '$1');

function sources() {
  const runtime = [...walk('apps/api/src'), ...walk('apps/mobile/src')];
  return {
    worker: read(WORKER),
    repository: read(REPOSITORY),
    module: read(MODULE),
    telemetry: read(TELEMETRY),
    migration: read(MIGRATION),
    migrations: Object.fromEntries(readdirSync(join(ROOT, 'database/migrations')).filter((name) => name.endsWith('.sql'))
      .map((name) => [name, read(`database/migrations/${name}`)])),
    runtime: Object.fromEntries(runtime.map((path) => [relative(ROOT, join(ROOT, path)).replace(/\\/gu, '/'), read(path)])),
    packageJson: JSON.parse(read('package.json')),
    workflow: read('.github/workflows/api-ci.yml'),
  };
}

export function violations({ worker, repository, module, telemetry, migration, migrations, runtime, packageJson, workflow }) {
  const out = [];
  const shipped = Object.entries(runtime).filter(([path]) => !/\.spec\.[jt]sx?$/u.test(path));
  const naming = (re) => shipped.filter(([, text]) => re.test(code(text))).map(([path]) => path).sort();
  const w = code(worker);
  // ── the one database call, made only by the repository's one method and the worker that drives it ──
  if (naming(/observe_unobserved_semantic_commits/u).join() !== REPOSITORY) out.push('only the repository\'s one method calls 0201\'s sweeper definer');
  if (naming(/\bsweepUnobservedSemanticCommits\b/u).join() !== [REPOSITORY, WORKER].sort().join()) {
    out.push('only the worker calls the repository\'s sweep method');
  }
  // No commit site observes: the repository only declares the method (interface and class), and the worker calls it once.
  if ((code(repository).match(/\bsweepUnobservedSemanticCommits\b/gu) ?? []).length !== 2
    || /\.sweepUnobservedSemanticCommits\(/u.test(code(repository))) out.push('no commit site in the repository calls the sweep');
  if ((w.match(/\.sweepUnobservedSemanticCommits\(/gu) ?? []).length !== 1) out.push('the worker makes the one sweep call');
  if (!/this\.serviceApi\.rpc<unknown>\('server_observe_unobserved_semantic_commits_v1', \{ p_limit: limit \}, \{ timeoutMs \}\)/u.test(code(repository))) {
    out.push('the repository calls the sweeper definer with the limit only, under a client timeout');
  }
  if (!/const SWEEP_DEFINER_LIMIT = Object\.freeze\(\{ min: 1, max: 1000 \}\);/u.test(code(repository))
    || !/if \(!Number\.isSafeInteger\(limit\) \|\| limit < SWEEP_DEFINER_LIMIT\.min \|\| limit > SWEEP_DEFINER_LIMIT\.max\) throw/u.test(code(repository))) out.push('the repository refuses a limit 0201 would refuse');
  if (!/stamped > limit\) throw new Error\('SEMANTIC_COMMIT_SWEEP_INTEGRITY'\)/u.test(code(repository))) out.push('the repository refuses an answer larger than the limit');
  // ── nothing of S1's ledger, and no immediate observation ──
  const ledger = Object.entries(runtime).filter(([, text]) => /observe_session_semantic_commits|session_semantic_commit_instants/u.test(code(text)));
  if (ledger.length) out.push(`no API or app file calls the per-Session observer or reads the ledger (${ledger.map(([p]) => p).join(', ')})`);
  if (naming(/SEMANTIC_COMMIT_OBSERVATION_ENABLED|observeAfterCommit|afterSemanticCommit/u).length) out.push('no immediate (after-commit) observation path');
  const importers = naming(/from '[./]*(?:live-focus\/)?semantic-commit-sweeper\.worker'/u);
  if (importers.join() !== MODULE) out.push(`only the conversation module wires the worker (found ${importers.join(', ') || 'none'})`);
  // ── 0201 unchanged and still the sole definer ──
  if (createHash('sha256').update(migration).digest('hex') !== MIGRATION_0201_SHA256) out.push('0201 is unchanged');
  const definers = Object.entries(migrations).filter(([, text]) =>
    /CREATE (?:OR REPLACE )?FUNCTION public\.server_observe_(?:unobserved|session)_semantic_commits_v1|CREATE TABLE public\.session_semantic_commit_instants/u.test(code(text)))
    .map(([name]) => name);
  if (definers.join() !== '0201_s8b_07_semantic_commit_instants_v1.sql') out.push('no later migration redefines 0201\'s observers or ledger');
  // ── the ceilings, the shipped settings and the one flag ──
  if (!/export const SEMANTIC_COMMIT_SWEEP_CEILINGS = Object\.freeze\(\{ batch: 500, rounds: 10 \}\);/u.test(w)) out.push('the ceilings are 500 rows and 10 rounds, literally');
  const defaults = /export const SEMANTIC_COMMIT_SWEEP_DEFAULTS = Object\.freeze\(\{\s*intervalMs: (\d[\d_]*),\s*batch: (\d+),\s*rounds: (\d+),\s*tickBudgetMs: ([\d_]+),\s*statementTimeoutMs: ([\d_]+),\s*\}\);/u.exec(w);
  const n = (s) => Number(s.replaceAll('_', ''));
  if (!defaults) out.push('the shipped settings are literal');
  else {
    if (n(defaults[1]) !== 30_000) out.push('the shipped interval is 30 s');
    if (n(defaults[2]) > 500 || n(defaults[3]) > 10) out.push('the shipped settings stay within the ceilings');
  }
  if (!/batch: \[1, SEMANTIC_COMMIT_SWEEP_CEILINGS\.batch\],\s*rounds: \[1, SEMANTIC_COMMIT_SWEEP_CEILINGS\.rounds\],/u.test(w)) out.push('no configuration exceeds a ceiling');
  if (!/const requested = env\.SEMANTIC_COMMIT_SWEEP_ENABLED === 'true' && env\.NODE_ENV !== 'test';/u.test(w)
    || !/enabled: requested && channel,/u.test(w) || !/misconfigured: requested && !channel,/u.test(w)) {
    out.push('only SEMANTIC_COMMIT_SWEEP_ENABLED=true enables the sweeper; credentials alone never do');
  }
  if (/process\.env/u.test(w)) out.push('the worker reads no environment of its own');
  if (!/new SemanticCommitSweeperWorker\(repository, telemetry, pressure, semanticCommitSweepConfig\(process\.env\)\)/u.test(code(module))) out.push('the module builds the worker from the one configuration');
  if (!/return databaseCode === 'PGRST202' \|\| databaseCode === '42883' \|\| databaseCode === '42501';/u.test(w)
    || !/this\.off = true;\s*this\.halt\(\);/u.test(w)) out.push('a missing or forbidden definer turns the sweeper OFF, without further requests');
  // ── bounded, never overlapping, never retrying, yielding to Live Voice first ──
  if (/\bwhile\s*\(|\bretry|\bretries\b|\bbackoff\b/iu.test(w)) out.push('no retry loop: a failure is retried only by the next tick');
  if (!/if \(this\.running \|\| !this\.enabled\) return null;/u.test(w)) out.push('a tick never overlaps the previous one');
  const loop = /for \(;;\) \{([\s\S]*?)\n {4}\}\n {2}\}/u.exec(w)?.[1] ?? '';
  const at = (re) => { const m = re.exec(loop); return m ? m.index : -1; };
  const yieldAt = at(/if \(this\.pressure\.pressing\(\)\) return this\.close\('yielded'\);/u);
  const boundAt = at(/if \(done >= rounds \|\| this\.clock\.now\(\) - started >= tickBudgetMs\) return this\.close\('capacity_reached'\);/u);
  const callAt = at(/await this\.sweeps\.sweepUnobservedSemanticCommits\(batch, statementTimeoutMs\)/u);
  if (yieldAt < 0 || callAt < 0 || yieldAt > callAt) out.push('the tick yields before every statement');
  if (boundAt < 0 || callAt < 0 || boundAt > callAt) out.push('no statement starts past the rounds or the time budget');
  if (!/if \(reason !== 'WAIT_USER_LIMIT'\) this\.lastAt = this\.now\(\);/u.test(w)) out.push('a person\'s own limit is not capacity pressure');
  if (!/new DatabaseBackgroundPermitGate\(serviceApi, \{ observer: pressure \}\)/u.test(code(module))
    || !/inject: \[SupabaseServiceRoleApiService, SEMANTIC_COMMIT_SWEEP_PRESSURE\]/u.test(code(module))) out.push('the pressure is the shared permit gate\'s observer');
  // ── the closed telemetry: names only, no count, age, Session or error ──
  const entry = "['SEMANTIC_COMMIT_OBSERVATION',new Map([['activation',new Set(['enabled','misconfigured','unavailable'])],['sweep_round',new Set(['work_found','drained_visible',...OPERATION_FAILURES])],['sweep_tick',new Set(['drained_visible','capacity_reached','yielded','unknown'])],['detector',new Set(['no_sweep_opportunity','ceiling_sustained','sweep_failing'])]])],";
  if (!telemetry.includes(entry)) out.push('the telemetry registry carries exactly the C-2 / C-3.2 outcomes');
  if (/\bRECORDED\b|\bPENDING\b/u.test(w)) out.push('no signal claims a row was recorded or is pending');
  if ((w.match(/this\.telemetry\.\w+\(/gu) ?? []).join() !== 'this.telemetry.recordOperationalOutcome(') out.push('the worker reports only closed operational outcomes');
  if (!/this\.telemetry\.recordOperationalOutcome\(DOMAIN, operation, outcome\);/u.test(w)) out.push('a signal passes only its domain, operation and outcome');
  if (/\b(?:pendingCount|backlogAge|oldestAge|ageMs|rowCount)\b/u.test(w)) out.push('no count or age of pending rows is stated (OR-1)');
  // ── wired into the gates ──
  if (packageJson.scripts?.['test:rb2-s2-semantic-commit-sweeper-contract'] !== 'node --test tests/rb2-s2-semantic-commit-sweeper-contract.test.mjs') out.push('the static contract has its script');
  if (!/apps\/api\/scripts\/rb2-s2-semantic-commit-sweeper-proof\.ts$/u.test(packageJson.scripts?.['prove:rb2-s2-semantic-commit-sweeper:integration'] ?? '')) out.push('the integration proof has its script');
  if (!/run: npm run test:rb2-s2-semantic-commit-sweeper-contract/u.test(workflow)) out.push('API CI runs the static contract');
  if (!/npm run prove:rb2-s2-semantic-commit-sweeper:integration/u.test(workflow)) out.push('API CI runs the integration proof');
  return out;
}

test('S2 Alternative A: one bounded, opt-in, yielding sweeper and nothing else', () => {
  assert.deepEqual(violations(sources()), []);
});

test('each detector catches a planted defect', () => {
  const base = sources();
  const plant = (key, from, to) => {
    assert.ok(base[key].includes(from), `plant anchor missing in ${key}: ${from}`);
    return { ...base, [key]: base[key].replace(from, to) };
  };
  const addRuntime = (path, text) => ({ ...base, runtime: { ...base.runtime, [path]: text } });
  const cases = [
    ['a per-Session observer call', addRuntime('apps/api/src/live-focus/observe.ts', "rpc('server_observe_session_semantic_commits_v1', { p_session_id })")],
    ['a ledger read from the app', addRuntime('apps/mobile/src/replay/ledger.ts', "from('session_semantic_commit_instants')")],
    ['a second caller of the definer', addRuntime('apps/api/src/live-analysis/sweep.ts', "rpc('server_observe_unobserved_semantic_commits_v1', { p_limit: 5 })")],
    ['an edited commit site in the repository', plant('repository', "    const stamped = await this.serviceApi.rpc<unknown>(", "    void this.sweepUnobservedSemanticCommits(1, timeoutMs);\n    const stamped = await this.serviceApi.rpc<unknown>(")],
    ['an edited commit site elsewhere', addRuntime('apps/api/src/live-focus/live-focus-commit.ts', 'await this.repository.commitSemanticTurn(input);\nvoid this.repository.sweepUnobservedSemanticCommits(1, 2000);')],
    ['an immediate path after a commit', addRuntime('apps/api/src/live-focus/after.ts', 'if (process.env.SEMANTIC_COMMIT_OBSERVATION_ENABLED) void observe();')],
    ['a second importer of the worker', addRuntime('apps/api/src/live-analysis/live-analysis.module.ts', "import { SemanticCommitSweeperWorker } from '../live-focus/semantic-commit-sweeper.worker';")],
    ['0201 edited', plant('migration', 'xact_id xid8 NOT NULL,', 'xact_id xid8,')],
    ['a later migration redefining the sweeper', { ...base, migrations: { ...base.migrations, '0202_s8b_07_sweep_v2.sql': 'CREATE OR REPLACE FUNCTION public.server_observe_unobserved_semantic_commits_v1(p_limit integer)' } }],
    ['a raised ceiling', plant('worker', 'Object.freeze({ batch: 500, rounds: 10 })', 'Object.freeze({ batch: 5000, rounds: 10 })')],
    ['a default past the ceiling', plant('worker', '  batch: 500,\n  rounds: 10,\n  tickBudgetMs', '  batch: 900,\n  rounds: 10,\n  tickBudgetMs')],
    ['enabled by credentials', plant('worker', 'enabled: requested && channel,', 'enabled: requested || channel,')],
    ['enabled by any truthy flag', plant('worker', "env.SEMANTIC_COMMIT_SWEEP_ENABLED === 'true'", '!!env.SEMANTIC_COMMIT_SWEEP_ENABLED')],
    ['unavailable keeps asking', plant('worker', "databaseCode === '42883' || ", '')],
    ['a retry loop', plant('worker', '        return this.failed(error);', '        while (attempts++ < 3) await sleep(100);\n        return this.failed(error);')],
    ['overlapping ticks', plant('worker', 'if (this.running || !this.enabled) return null;', 'if (!this.enabled) return null;')],
    ['pressure ignored', plant('worker', "      if (this.pressure.pressing()) return this.close('yielded');\n", '')],
    ['the budget ignored', plant('worker', ' || this.clock.now() - started >= tickBudgetMs', '')],
    ['the observer unwired', plant('module', 'new DatabaseBackgroundPermitGate(serviceApi, { observer: pressure })', 'new DatabaseBackgroundPermitGate(serviceApi)')],
    ['an open telemetry outcome', plant('telemetry', "'ceiling_sustained','sweep_failing'", "'ceiling_sustained','sweep_failing','pending_rows'")],
    ['a count in a signal', plant('worker', 'this.telemetry.recordOperationalOutcome(DOMAIN, operation, outcome);', 'this.telemetry.recordOperationalOutcome(DOMAIN, operation, outcome, pendingCount);')],
    ['a privacy-state write', plant('worker', '      this.telemetry.recordOperationalOutcome(DOMAIN', "      this.telemetry.recordPrivacyOperationState('X', 'RECORDED');\n      this.telemetry.recordOperationalOutcome(DOMAIN")],
    ['the CI step removed', plant('workflow', 'run: npm run test:rb2-s2-semantic-commit-sweeper-contract', 'run: true')],
  ];
  for (const [name, planted] of cases) assert.notDeepEqual(violations(planted), [], `not caught: ${name}`);
});
