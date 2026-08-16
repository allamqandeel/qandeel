import process from 'node:process';
import pg from 'pg';
import { loadLocalEnvironment } from './local-environment.mjs';

const { Client } = pg;
const environment = await loadLocalEnvironment();
let unavailable = false;

function result(component, state, action = '') {
  console.log(`${component}: ${state}${action ? ` — ${action}` : ''}`);
  if (state !== 'available') unavailable = true;
}

async function checkPostgreSql() {
  if (!environment.DATABASE_URL) {
    result('PostgreSQL', 'configuration missing', 'set DATABASE_URL in the ignored root .env file');
    return;
  }
  const client = new Client({ connectionString: environment.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.query('SELECT 1');
    result('PostgreSQL', 'available');
  } catch {
    result('PostgreSQL', 'unavailable', 'check database reachability and DATABASE_URL');
  } finally {
    await client.end().catch(() => {});
  }
}

async function checkHttp(component, path, missingNames, unavailableAction, availableStatuses = [200]) {
  if (missingNames.some((name) => !environment[name])) {
    result(component, 'configuration missing', `set ${missingNames.join(' and ')} in the ignored root .env file`);
    return;
  }
  try {
    const base = environment.SUPABASE_URL.replace(/\/$/u, '');
    const response = await fetch(`${base}${path}`, {
      headers: { apikey: environment.SUPABASE_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(5000),
    });
    if (availableStatuses.includes(response.status)) result(component, 'available');
    else result(component, 'unavailable', unavailableAction);
  } catch {
    result(component, 'unavailable', unavailableAction);
  }
}

await Promise.all([
  checkPostgreSql(),
  checkHttp('Supabase Auth', '/auth/v1/health', ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'], 'check Auth service reachability and public client configuration'),
  checkHttp(
    'Supabase Data API',
    '/rest/v1/users?select=id&limit=0',
    ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'],
    'enable the Data API for the intended exposed schema and check public client configuration',
    [200, 401, 403],
  ),
]);

console.log('Diagnostic complete. No local environment values or remote response bodies were displayed.');
if (unavailable) process.exitCode = 1;
