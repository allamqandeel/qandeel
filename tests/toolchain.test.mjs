import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const packageLock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
const preflight = await readFile(new URL('scripts/preflight.mjs', root), 'utf8');
const diagnostic = await readFile(new URL('scripts/diagnose-integrations.mjs', root), 'utf8');
const claudeSmoke = await readFile(new URL('apps/api/scripts/verify-claude-smoke.ts', root), 'utf8');
const openAISmoke = await readFile(new URL('apps/api/scripts/verify-openai-smoke.ts', root), 'utf8');
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
    'verify:claude:smoke',
    'verify:openai:smoke',
    'eval:brain:validate',
    'eval:brain:run',
    'eval:brain:dry-run',
    'eval:brain:summarize',
  ]) assert.equal(typeof packageJson.scripts[name], 'string', `missing ${name}`);

  assert.doesNotMatch(packageJson.scripts['test:api'], /eval:brain:run/iu);

  const commands = Object.values(packageJson.scripts).join('\n');
  assert.doesNotMatch(commands, /(?:rm|rmdir|remove-item|rename-item|mv|move).*node_modules/iu);
});

test('keeps the real Claude smoke explicit, single-attempt, and privacy-safe', () => {
  assert.doesNotMatch(packageJson.scripts['test:api'], /claude|anthropic/iu);
  assert.match(claudeSmoke, /ANTHROPIC_API_KEY/u);
  assert.match(claudeSmoke, /NOT RUN/u);
  assert.match(claudeSmoke, /ClaudeModelRouter\.fromEnvironment\(\)\.generate/u);
  assert.doesNotMatch(
    claudeSmoke,
    /console\.(?:log|error)\([^\n]*(?:\$\{|result\.content|process\.env|apiKey)/u,
  );
});

test('keeps the real OpenAI smoke explicit, single-attempt, and privacy-safe', () => {
  assert.doesNotMatch(packageJson.scripts['test:api'], /openai/iu);
  assert.match(openAISmoke, /OPENAI_API_KEY/u);
  assert.match(openAISmoke, /NOT RUN/u);
  assert.match(openAISmoke, /OpenAIModelRouter\.fromEnvironment\(\)\.generate/u);
  assert.doesNotMatch(
    openAISmoke,
    /console\.(?:log|error)\([^\n]*(?:\$\{|result\.content|process\.env|apiKey)/u,
  );
});

test('keeps preflight and diagnostics privacy-safe', () => {
  assert.match(preflight, /values were not displayed/u);
  assert.doesNotMatch(preflight, /console\.log\([^\n]*(?:DATABASE_URL|SUPABASE_URL|PASSWORD)/u);
  assert.match(diagnostic, /response bodies were displayed/u);
  assert.doesNotMatch(diagnostic, /response\.(?:json|text)\(/u);
  assert.doesNotMatch(diagnostic, /console\.log\([^\n]*environment\[/u);
});

test('keeps API CI aligned with the complete safe PostgreSQL 17 baseline', () => {
  assert.match(apiCi, /image: postgres:17/u);
  assert.match(apiCi, /image: redis:7/u);
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
