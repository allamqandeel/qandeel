import { readFile } from 'node:fs/promises';

export const integrationVariables = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_TEST_EMAIL',
  'SUPABASE_TEST_PASSWORD',
];

export async function loadLocalEnvironment() {
  const local = {};
  try {
    const contents = await readFile(new URL('../.env', import.meta.url), 'utf8');
    for (const line of contents.split(/\r?\n/u)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);
      if (!match) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      local[match[1]] = value;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return Object.fromEntries(
    integrationVariables.map((name) => [name, process.env[name] || local[name] || '']),
  );
}
