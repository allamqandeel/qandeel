/** T-12P adversarial matrix — Conversation Session, P13…P20. */
import { ConversationSessionApiClient } from '../conversation/conversation-session-api';
import { SESSION_A, httpDouble } from '../__fixtures__/runtime-entry';

const BASE = 'https://api.example.test/v1';
const createdBody = {
  id: SESSION_A,
  user_id: 'user-1',
  status: 'ACTIVE',
  channel: 'TEXT',
  created_at: 'now',
  updated_at: 'now',
  last_activity_at: 'now',
  closed_at: null,
};

function client(http = httpDouble()) {
  return { http, api: new ConversationSessionApiClient({ baseUrl: BASE, fetch: http.fetch }) };
}

test('P13 — the create POST goes to the one existing route with the current bearer token', async () => {
  const { http, api } = client();
  http.on('/conversation/sessions', () => ({ status: 201, body: createdBody }));
  const outcome = await api.createSession('token-now');
  expect(outcome).toEqual({ kind: 'CREATED', session: { sessionId: SESSION_A } });
  expect(http.calls).toHaveLength(1);
  expect(http.calls[0].url).toBe(`${BASE}/conversation/sessions`);
  expect(http.calls[0].method).toBe('POST');
  expect(http.calls[0].authorization).toBe('Bearer token-now');
});

test('P13 — a refreshed token is used because the caller passes it per call', async () => {
  const { http, api } = client();
  http.on('/conversation/sessions', () => ({ status: 201, body: createdBody }));
  await api.createSession('token-1');
  await api.createSession('token-2');
  expect(http.calls.map((call) => call.authorization)).toEqual(['Bearer token-1', 'Bearer token-2']);
});

test('P14 — a malformed body is never accepted as a Session', async () => {
  for (const body of [null, 42, 'text', [], {}, { id: 'not-a-uuid', status: 'ACTIVE' }]) {
    const { http, api } = client();
    http.on('/conversation/sessions', () => ({ status: 201, body }));
    const outcome = await api.createSession('t');
    expect(outcome.kind).toBe('OUTCOME_UNKNOWN');
  }
});

test('P15 — a created Session that is not ACTIVE is refused rather than adopted', async () => {
  const { http, api } = client();
  http.on('/conversation/sessions', () => ({ status: 201, body: { ...createdBody, status: 'CLOSED' } }));
  const outcome = await api.createSession('t');
  expect(outcome.kind).toBe('OUTCOME_UNKNOWN');
  if (outcome.kind !== 'OUTCOME_UNKNOWN') throw new Error('unreachable');
  expect(outcome.reason).toBe('MALFORMED_RESPONSE');
});

test('an unexpected extra column does not break the client', async () => {
  // The body is a database row projection and already differs between the create and read routes.
  // Rejecting an added column would break the client against a server change that cannot hurt it.
  const { http, api } = client();
  http.on('/conversation/sessions', () => ({ status: 201, body: { ...createdBody, a_new_column: 'x' } }));
  const outcome = await api.createSession('t');
  expect(outcome).toEqual({ kind: 'CREATED', session: { sessionId: SESSION_A } });
});

test('a rejected token is reported as definitively unauthenticated', async () => {
  for (const status of [401, 403]) {
    const { http, api } = client();
    http.on('/conversation/sessions', () => ({ status, body: {} }));
    expect(await api.createSession('t')).toEqual({ kind: 'UNAUTHENTICATED' });
  }
});

test('a definitive client-side refusal is REFUSED, and no Session was created', async () => {
  const { http, api } = client();
  http.on('/conversation/sessions', () => ({ status: 422, body: {} }));
  expect(await api.createSession('t')).toEqual({ kind: 'REFUSED', status: 422 });
});

test('P18 — a transport failure is OUTCOME_UNKNOWN, never a silent retry', async () => {
  const { http, api } = client();
  http.failEverything('socket hang up');
  const outcome = await api.createSession('t');
  expect(outcome.kind).toBe('OUTCOME_UNKNOWN');
  if (outcome.kind !== 'OUTCOME_UNKNOWN') throw new Error('unreachable');
  expect(outcome.reason).toBe('NETWORK');
  // Exactly one attempt was made. The route is not idempotent, so a retry would create a second
  // orphaned Session on every flaky network.
  expect(http.calls).toHaveLength(1);
});

test('P18 — a 5xx is OUTCOME_UNKNOWN because the INSERT may already have committed', async () => {
  // The API aborts its upstream Supabase verification at five seconds and surfaces that as a 503,
  // by which time the database INSERT may have committed. The client cannot tell, and says so.
  for (const status of [500, 502, 503, 504]) {
    const { http, api } = client();
    http.on('/conversation/sessions', () => ({ status, body: {} }));
    const outcome = await api.createSession('t');
    expect(outcome.kind).toBe('OUTCOME_UNKNOWN');
    if (outcome.kind !== 'OUTCOME_UNKNOWN') throw new Error('unreachable');
    expect(outcome.reason).toBe('SERVER_ERROR');
  }
});

test('P18 — an unreadable 2xx body is OUTCOME_UNKNOWN: the Session exists and its id is lost', async () => {
  // A 2xx whose body cannot be parsed. The server created a Session and the client can never learn
  // which one, so this is ambiguous in the worst way: an orphan definitely exists.
  const api = new ConversationSessionApiClient({
    baseUrl: BASE,
    fetch: async () => ({ ok: true, status: 201, json: () => Promise.reject(new Error('unreadable')) }),
  });
  const outcome = await api.createSession('t');
  expect(outcome.kind).toBe('OUTCOME_UNKNOWN');
  if (outcome.kind !== 'OUTCOME_UNKNOWN') throw new Error('unreachable');
  expect(outcome.reason).toBe('MALFORMED_RESPONSE');
});

test('the client holds no memo: it never hides a duplicate by returning a previous Session', async () => {
  // Preventing duplicates is the bootstrap owner's job. A client that quietly replayed a previous
  // result would make a real duplicate invisible instead of preventing it.
  const { http, api } = client();
  http.on('/conversation/sessions', () => ({ status: 201, body: createdBody }));
  await api.createSession('t');
  await api.createSession('t');
  expect(http.matching('/conversation/sessions')).toHaveLength(2);
});

test('no outcome ever carries the bearer token', async () => {
  const { http, api } = client();
  http.on('/conversation/sessions', () => ({ status: 500, body: {} }));
  const outcome = await api.createSession('super-secret-token');
  expect(JSON.stringify(outcome)).not.toContain('super-secret-token');
});
