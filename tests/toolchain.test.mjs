import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const packageLock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
const preflight = await readFile(new URL('scripts/preflight.mjs', root), 'utf8');
const diagnostic = await readFile(new URL('scripts/diagnose-integrations.mjs', root), 'utf8');

test('standardizes the repository on npm and the root lockfile', () => {
  assert.equal(packageJson.engines.npm, '>=10');
  assert.equal(packageLock.lockfileVersion, 3);
  assert.equal(packageLock.packages[''].name, packageJson.name);
  const commands = Object.values(packageJson.scripts).join('\n');
  assert.doesNotMatch(commands, /\b(?:pnpm|yarn|npx)\b/u);
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
  ]) assert.equal(typeof packageJson.scripts[name], 'string', `missing ${name}`);

  const commands = Object.values(packageJson.scripts).join('\n');
  assert.doesNotMatch(commands, /(?:rm|rmdir|remove-item|rename-item|mv|move).*node_modules/iu);
});

test('keeps preflight and diagnostics privacy-safe', () => {
  assert.match(preflight, /values were not displayed/u);
  assert.doesNotMatch(preflight, /console\.log\([^\n]*(?:DATABASE_URL|SUPABASE_URL|PASSWORD)/u);
  assert.match(diagnostic, /response bodies were displayed/u);
  assert.doesNotMatch(diagnostic, /response\.(?:json|text)\(/u);
  assert.doesNotMatch(diagnostic, /console\.log\([^\n]*environment\[/u);
});
