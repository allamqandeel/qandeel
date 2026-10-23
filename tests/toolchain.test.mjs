import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import YAML from 'yaml';

const root = new URL('../', import.meta.url);
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const packageLock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
const preflight = await readFile(new URL('scripts/preflight.mjs', root), 'utf8');
const diagnostic = await readFile(new URL('scripts/diagnose-integrations.mjs', root), 'utf8');
const apiCi = await readFile(new URL('.github/workflows/api-ci.yml', root), 'utf8');

function isIgnored(path) {
  const result = spawnSync('git', ['check-ignore', '--quiet', '--no-index', path], {
    cwd: fileURLToPath(root),
  });
  assert.equal(result.error, undefined, `git check-ignore failed for ${path}`);
  assert.ok([0, 1].includes(result.status), `git check-ignore exited ${result.status} for ${path}`);
  return result.status === 0;
}

test('standardizes the repository on npm and the root lockfile', () => {
  assert.equal(packageJson.engines.npm, '>=10');
  assert.equal(packageLock.lockfileVersion, 3);
  assert.equal(packageLock.packages[''].name, packageJson.name);
  const commands = Object.values(packageJson.scripts).join('\n');
  assert.doesNotMatch(commands, /\b(?:pnpm|yarn|npx)\b/u);
});

test('ignores PostgreSQL backup archives without hiding normal source files', () => {
  assert.equal(isIgnored('qandeel-cert-test.dump'), true);
  assert.equal(isIgnored('qandeel-cert-test.backup'), true);
  assert.equal(isIgnored('qandeel-cert-test.ts'), false);
});

test('keeps verification commands explicit and non-destructive', () => {
  for (const name of [
    'preflight',
    'test:database',
    'test:toolchain',
    'test:api',
    'build:api',
    'verify:integrations:diagnose',
    'verify:database:integration',
    'verify:auth:smoke',
    'eval:brain:validate',
    'eval:brain:dry-run',
    'eval:brain:summarize',
  ]) assert.equal(typeof packageJson.scripts[name], 'string', `missing ${name}`);


  const commands = Object.values(packageJson.scripts).join('\n');
  assert.doesNotMatch(commands, /(?:rm|rmdir|remove-item|rename-item|mv|move).*node_modules/iu);
});

// RE-ANCHORED by S8A-03 (D1): DeepSeek is the only production AI provider, so the paid Claude and OpenAI smokes and
// the live bake-off runner were removed with their providers. No live-provider command remains, and none is reachable
// from the API test command.
test('keeps no live paid-provider smoke or bake-off runner after the DeepSeek-only migration', () => {
  for (const name of ['verify:claude:smoke', 'verify:openai:smoke', 'eval:brain:run']) {
    assert.equal(packageJson.scripts[name], undefined, `${name} is removed`);
  }
  for (const file of ['apps/api/scripts/verify-claude-smoke.ts', 'apps/api/scripts/verify-openai-smoke.ts']) {
    assert.equal(existsSync(new URL(file, root)), false, `${file} is removed`);
  }
  assert.doesNotMatch(packageJson.scripts['test:api'], /claude|anthropic|openai|gemini|deepseek|eval:brain/iu);
});

test('keeps preflight and diagnostics privacy-safe', () => {
  assert.match(preflight, /values were not displayed/u);
  assert.doesNotMatch(preflight, /console\.log\([^\n]*(?:DATABASE_URL|SUPABASE_URL|PASSWORD)/u);
  assert.match(diagnostic, /response bodies were displayed/u);
  assert.doesNotMatch(diagnostic, /response\.(?:json|text)\(/u);
  assert.doesNotMatch(diagnostic, /console\.log\([^\n]*environment\[/u);
});

test('keeps API CI aligned with the complete safe PostgreSQL 17 baseline', () => {
  // RE-ANCHORED (ACCT-DEL-01, CI infrastructure correction): this pinned the two service images to digests on Amazon
  // ECR Public, whose anonymous data quota refused them before any step ran. The truth it protects is unchanged -
  // PostgreSQL 17 and Redis 7 at exact, verified versions - now as packages from each project's signed apt repository.
  const verifyApi = YAML.parse(apiCi).jobs['verify-api'];
  assert.equal(verifyApi.services, undefined, 'no service container: no registry pull can fail the job before it starts');
  assert.equal(verifyApi['runs-on'], 'ubuntu-24.04', 'the runner the pinned noble packages are built for');
  const [install, start] = verifyApi.steps.slice(1, 3);
  assert.match(install.env.PG_PACKAGE_VERSION, /^17\.\d+-\d+\.pgdg24\.04\+\d+$/u);
  assert.match(install.env.REDIS_PACKAGE_VERSION, /^\d+:7\.4\.\d+-\d+rl\d+~noble\d+$/u);
  assert.equal(install.env.PG_KEY_FINGERPRINT, 'B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8', 'the PostgreSQL Debian Repository key');
  assert.equal(install.env.REDIS_KEY_FINGERPRINT, '54318FA4052D1E61A6B6F7BB5F4349D6BF53AA0C', 'the Redis package signing key');
  assert.match(install.run, /signed-by=\/etc\/apt\/keyrings\/qandeel-ci-pgdg\.asc/u);
  assert.match(install.run, /signed-by=\/etc\/apt\/keyrings\/qandeel-ci-redis\.asc/u);
  assert.match(install.run, /"postgresql-17=\$PG_PACKAGE_VERSION"/u);
  assert.match(install.run, /"redis-server=\$REDIS_PACKAGE_VERSION"/u);
  assert.doesNotMatch(install.run, /trusted=yes|allow-unauthenticated|allow-insecure/u, 'no signature check is waived');
  assert.match(start.run, /SHOW server_version/u);
  assert.match(start.run, /17\.\*\) ;;/u);
  assert.match(start.run, /7\.4\.\*\) ;;/u);
  assert.match(start.run, /redis-cli -u "\$REDIS_URL" ping/u);
  assert.deepEqual(
    { DATABASE_URL: verifyApi.env.DATABASE_URL, REDIS_URL: verifyApi.env.REDIS_URL },
    { DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/qandeel_test', REDIS_URL: 'redis://localhost:6379' },
  );
  assert.match(apiCi, /run: npm run test:toolchain/u);
  assert.match(apiCi, /paths: \[[^\n]*'tests\/\*\*'[^\n]*'package-lock\.json'/u);
  for (const command of [
    'verify:database:integration',
    'verify:conversation-authority:integration',
    'verify:foreground-generating-turn-recovery:integration',
    'verify:memory:integration',
    'verify:memory-authority:integration',
    'verify:hypothesis:integration',
    'verify:confidence:integration',
    'verify:question:integration',
    'verify:hypothesis-update:integration',
    'verify:him:integration',
    'verify:initial-him:integration',
    'verify:him-calculation:integration',
    'verify:hse-energy:integration',
    'verify:hse-motivation:integration',
    'verify:hse-attention:integration',
    'verify:hse-self-confidence:integration',
    'verify:hse-stress:integration',
    'verify:hbs-avoidance:integration',
    'verify:hbs-consistency-initiative:integration',
    'verify:hbs-reflection:integration',
    'verify:hrs-relationship-trust:integration',
    'verify:him-trends:integration',
    'verify:him-snapshot:integration',
    'verify:runtime-events:integration',
    'verify:runtime-event-publisher-startup-recovery:integration',
    'verify:background-intelligence-adapters:integration',
    'verify:post-response-intelligence-db:integration',
    'verify:durable-association-provider-result:integration',
    'verify:server-hypothesis-update:integration',
    'verify:hypothesis-update-auto-invocation:integration',
    'verify:confidence-batch-reliability:integration',
    'verify:information-gap-question-integration:integration',
    'verify:post-response-dispatch:integration',
    'verify:a2-e2e-runtime-smoke',
    'test:full-intelligence-e2e-runtime-contract',
    'verify:full-intelligence-e2e-runtime',
  ]) assert.match(apiCi, new RegExp(`run: npm run ${command}`,'u'), `missing ${command}`);
  assert.doesNotMatch(apiCi, /verify:(?:claude|openai|auth):smoke|eval:brain:(?:run|validate|summarize)/u);
});

test('lets CI-provided database configuration run safe historical verifiers without a local env file', () => {
  for (const command of [
    'verify:database:integration',
    'verify:conversation-authority:integration',
    'verify:foreground-generating-turn-recovery:integration',
    'verify:memory:integration',
    'verify:memory-authority:integration',
    'verify:hypothesis:integration',
    'verify:confidence:integration',
    'verify:question:integration',
    'verify:hypothesis-update:integration',
    'verify:him:integration',
    'verify:background-intelligence-adapters:integration',
    'verify:post-response-intelligence-db:integration',
    'verify:durable-association-provider-result:integration',
    'verify:server-hypothesis-update:integration',
  ]) assert.match(packageJson.scripts[command], /--env-file-if-exists=\.env/u, `${command} requires a physical .env file`);
});
