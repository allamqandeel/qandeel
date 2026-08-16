import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const requiredEnvironment = {
  DATABASE_URL: process.env.DATABASE_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_TEST_EMAIL: process.env.SUPABASE_TEST_EMAIL,
  SUPABASE_TEST_PASSWORD: process.env.SUPABASE_TEST_PASSWORD,
};

for (const [name, value] of Object.entries(requiredEnvironment)) {
  if (!value) {
    throw new Error(`${name} is required in the ignored local .env file.`);
  }
}

const database = new Client({ connectionString: requiredEnvironment.DATABASE_URL });
const ownSessionId = randomUUID();
const ownTurnId = randomUUID();
const otherUserId = randomUUID();
const otherSessionId = randomUUID();
const otherTurnId = randomUUID();
let accessToken;
let authenticatedUserId;
let databaseConnected = false;
let stage = 'configuration';

class SmokeRequestError extends Error {
  constructor(label, status, apiCode) {
    super(`${label} failed with HTTP status ${status}. Response details were suppressed.`);
    this.status = status;
    this.apiCode = apiCode;
  }
}

function endpoint(path) {
  return new URL(path, `${requiredEnvironment.SUPABASE_URL.replace(/\/$/, '')}/`);
}

async function requestJson(label, url, options = {}, expectedStatus = null) {
  const method = options.method ?? 'GET';
  const attempts = method === 'GET' ? 3 : 1;
  let response;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    response = await fetch(url, options);
    const transient = [502, 503, 504].includes(response.status);
    if (!transient || attempt === attempts) break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 250));
  }
  if (!response.ok || (expectedStatus !== null && response.status !== expectedStatus)) {
    let apiCode = 'unavailable';
    try {
      const failure = await response.json();
      if (typeof failure?.code === 'string' && /^[A-Z0-9_]{2,32}$/i.test(failure.code)) {
        apiCode = failure.code;
      }
    } catch {
      // Failure bodies are intentionally ignored.
    }
    throw new SmokeRequestError(label, response.status, apiCode);
  }
  if (response.status === 204) return null;
  return response.json();
}

function publicHeaders(extra = {}) {
  return {
    apikey: requiredEnvironment.SUPABASE_PUBLISHABLE_KEY,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function authenticatedHeaders(extra = {}) {
  return publicHeaders({
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  });
}

async function createCrossUserFixture() {
  await database.query('BEGIN');
  try {
    stage = 'cross-user user fixture insert';
    await database.query(
      'INSERT INTO public.users (id, auth_subject) VALUES ($1::uuid, $1::text)',
      [otherUserId],
    );
    stage = 'cross-user session fixture insert';
    await database.query(
      `INSERT INTO public.conversation_sessions (id, user_id, status, channel)
       VALUES ($1, $2, 'ACTIVE', 'TEXT')`,
      [otherSessionId, otherUserId],
    );
    stage = 'cross-user turn fixture insert';
    await database.query(
      `INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
       VALUES ($1, $2, $3, 'USER', 'RECEIVED', 'auth-smoke-fixture')`,
      [otherTurnId, otherSessionId, otherUserId],
    );
    stage = 'cross-user fixture commit';
    await database.query('COMMIT');
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  }
}

async function signIn() {
  const payload = await requestJson(
    'Supabase Auth sign-in',
    endpoint('/auth/v1/token?grant_type=password'),
    {
      method: 'POST',
      headers: publicHeaders(),
      body: JSON.stringify({
        email: requiredEnvironment.SUPABASE_TEST_EMAIL,
        password: requiredEnvironment.SUPABASE_TEST_PASSWORD,
      }),
    },
  );
  assert.match(payload?.user?.id ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(typeof payload?.access_token, 'string');
  assert.ok(payload.access_token.length > 0);
  authenticatedUserId = payload.user.id;
  accessToken = payload.access_token;

  const currentUser = await requestJson('authenticated user lookup', endpoint('/auth/v1/user'), {
    headers: authenticatedHeaders(),
  });
  assert.equal(currentUser?.id, authenticatedUserId, 'Auth UUID changed within the authenticated session');
}

function tableUrl(table, query = {}) {
  const url = endpoint(`/rest/v1/${table}`);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  return url;
}

async function verifyIdentityMapping() {
  const rows = await requestJson(
    'canonical user mapping lookup',
    tableUrl('users', { select: 'id,auth_subject', id: `eq.${authenticatedUserId}` }),
    { headers: authenticatedHeaders() },
  );
  assert.deepEqual(rows, [{ id: authenticatedUserId, auth_subject: authenticatedUserId }]);
}

async function verifyOwnOperations() {
  const sessions = await requestJson('own session insert', tableUrl('conversation_sessions'), {
    method: 'POST',
    headers: authenticatedHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify({
      id: ownSessionId,
      user_id: authenticatedUserId,
      status: 'ACTIVE',
      channel: 'TEXT',
    }),
  });
  assert.deepEqual(sessions.map(({ id, user_id, status }) => ({ id, user_id, status })), [
    { id: ownSessionId, user_id: authenticatedUserId, status: 'ACTIVE' },
  ]);

  const turns = await requestJson('own turn insert', tableUrl('conversation_turns'), {
    method: 'POST',
    headers: authenticatedHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify({
      id: ownTurnId,
      session_id: ownSessionId,
      user_id: authenticatedUserId,
      role: 'USER',
      status: 'RECEIVED',
      content: 'auth-smoke',
    }),
  });
  assert.equal(turns.length, 1);
  assert.equal(turns[0].id, ownTurnId);

  const updatedTurns = await requestJson(
    'own turn update',
    tableUrl('conversation_turns', { id: `eq.${ownTurnId}`, select: 'id,status' }),
    {
      method: 'PATCH',
      headers: authenticatedHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({ status: 'COMPLETED' }),
    },
  );
  assert.deepEqual(updatedTurns, [{ id: ownTurnId, status: 'COMPLETED' }]);

  const updatedSessions = await requestJson(
    'own session update',
    tableUrl('conversation_sessions', { id: `eq.${ownSessionId}`, select: 'id,status' }),
    {
      method: 'PATCH',
      headers: authenticatedHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({ status: 'CLOSED' }),
    },
  );
  assert.deepEqual(updatedSessions, [{ id: ownSessionId, status: 'CLOSED' }]);
}

async function verifyCrossUserIsolation() {
  for (const [table, id] of [
    ['users', otherUserId],
    ['conversation_sessions', otherSessionId],
    ['conversation_turns', otherTurnId],
  ]) {
    const rows = await requestJson(
      `cross-user ${table} lookup`,
      tableUrl(table, { select: 'id', id: `eq.${id}` }),
      { headers: authenticatedHeaders() },
    );
    assert.deepEqual(rows, [], `cross-user ${table} row was visible`);
  }

  const mutationRows = await requestJson(
    'cross-user session mutation',
    tableUrl('conversation_sessions', { id: `eq.${otherSessionId}`, select: 'id' }),
    {
      method: 'PATCH',
      headers: authenticatedHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({ status: 'CLOSED' }),
    },
  );
  assert.deepEqual(mutationRows, [], 'cross-user session mutation reached a protected row');

  const fixture = await database.query(
    'SELECT status FROM public.conversation_sessions WHERE id = $1',
    [otherSessionId],
  );
  assert.deepEqual(fixture.rows, [{ status: 'ACTIVE' }], 'cross-user fixture was mutated');
}

async function signOut() {
  if (!accessToken) return;
  await requestJson('Supabase Auth sign-out', endpoint('/auth/v1/logout'), {
    method: 'POST',
    headers: authenticatedHeaders(),
  });
  accessToken = undefined;
}

async function cleanupRows() {
  await database.query('BEGIN');
  try {
    await database.query('DELETE FROM public.conversation_turns WHERE id = ANY($1::uuid[])', [
      [ownTurnId, otherTurnId],
    ]);
    await database.query('DELETE FROM public.conversation_sessions WHERE id = ANY($1::uuid[])', [
      [ownSessionId, otherSessionId],
    ]);
    await database.query('DELETE FROM public.users WHERE id = $1', [otherUserId]);
    await database.query('COMMIT');
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  let primaryError;
  try {
    stage = 'database connection';
    await database.connect();
    databaseConnected = true;
    stage = 'cross-user fixture setup';
    await createCrossUserFixture();
    stage = 'real Supabase Auth sign-in';
    await signIn();
    stage = 'canonical identity mapping';
    await verifyIdentityMapping();
    stage = 'authenticated own-row operations';
    await verifyOwnOperations();
    stage = 'cross-user isolation';
    await verifyCrossUserIsolation();
    console.log('Verified real Supabase Auth sign-in, canonical identity mapping, own-row operations, and that the cross-user fixture is hidden and immutable.');
  } catch (error) {
    primaryError = error;
    error.smokeStage = stage;
    throw error;
  } finally {
    let finalizationError;
    try {
      await signOut();
    } catch (signOutError) {
      signOutError.smokeStage = 'Supabase Auth sign-out';
      if (primaryError) console.error('Auth smoke sign-out failed. Sensitive details were suppressed.');
      else finalizationError = signOutError;
    }
    try {
      if (databaseConnected) await cleanupRows();
    } catch (cleanupError) {
      cleanupError.smokeStage = 'fixture cleanup';
      if (primaryError || finalizationError) {
        console.error('Auth smoke cleanup failed. Sensitive details were suppressed.');
      } else {
        finalizationError = cleanupError;
      }
    } finally {
      if (databaseConnected) await database.end();
    }
    if (!primaryError && finalizationError) throw finalizationError;
  }
}

main().catch((error) => {
  const kind = error instanceof SmokeRequestError
    ? `request HTTP ${error.status}, code ${error.apiCode}`
    : 'verification';
  console.error(`Auth smoke failed at ${error.smokeStage ?? stage} (${kind}). Sensitive details were suppressed.`);
  process.exitCode = 1;
});
