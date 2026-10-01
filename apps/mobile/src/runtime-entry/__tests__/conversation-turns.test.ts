/**
 * W1A-01 — the Conversation turn transport: what it sends, what it accepts, and whose credential it
 * carries.
 */
import { ConversationTurnApiClient, CONVERSATION_HISTORY_PAGE_LIMIT, createMobileRuntimeEntry } from '..';
import { createAuthorizedFetch } from '../auth/request-credential';
import { exchange, historyBody, submitBody } from '../../conversation/__fixtures__/conversation';
import { SESSION_A, TEST_CONFIG, authPortDouble, httpDouble, settle } from '../__fixtures__/runtime-entry';
import { createManualForegroundSignal } from '../lifecycle/foreground-signal';

const BASE = TEST_CONFIG.apiBaseUrl;

function client(http = httpDouble()) {
  return { http, api: new ConversationTurnApiClient({ baseUrl: BASE, fetch: http.fetch }) };
}

describe('W1A-01 — POST /conversation/sessions/:sessionId/turns', () => {
  it('sends exactly the words and the key, as JSON, to the Session’s own turns route — nothing server-owned', async () => {
    const { http, api } = client();
    const view = exchange('fixture: مرحبا', { key: 'k-1' });
    http.on('/turns', () => ({ status: 201, body: submitBody(view, SESSION_A) }));
    const outcome = await api.submitTurn(SESSION_A, { content: 'fixture: مرحبا', idempotencyKey: 'k-1' });

    expect(outcome).toEqual({ kind: 'ANSWERED', exchange: view });
    const [call] = http.calls;
    expect(call.method).toBe('POST');
    expect(call.url).toBe(`${BASE}/conversation/sessions/${SESSION_A}/turns`);
    expect(JSON.parse(call.body!)).toEqual({ content: 'fixture: مرحبا', idempotencyKey: 'k-1' });
    expect(Object.keys(JSON.parse(call.body!))).toEqual(['content', 'idempotencyKey']);
  });

  it('decodes a FAILED reply and a PENDING reply without inventing one', async () => {
    const { http, api } = client();
    const failed = exchange('fixture: words', { key: 'k-1', replyState: 'FAILED' });
    http.on('/turns', () => ({ status: 200, body: submitBody(failed, SESSION_A) }));
    await expect(api.submitTurn(SESSION_A, { content: 'fixture: words', idempotencyKey: 'k-1' })).resolves.toEqual({ kind: 'ANSWERED', exchange: failed });
    const pending = exchange('fixture: words', { key: 'k-2', replyState: 'PENDING' });
    http.on('/turns', () => ({ status: 200, body: submitBody(pending, SESSION_A, 'GENERATING') }));
    await expect(api.submitTurn(SESSION_A, { content: 'fixture: words', idempotencyKey: 'k-2' })).resolves.toEqual({ kind: 'ANSWERED', exchange: pending });
  });

  it('a transport failure, a 5xx and an unreadable or mismatched body are OUTCOME_UNKNOWN — never "not sent"', async () => {
    const view = exchange('fixture: words', { key: 'k-1' });
    const cases: [string, (http: ReturnType<typeof httpDouble>) => void, string][] = [
      ['network', (http) => http.failEverything(), 'NETWORK'],
      ['503', (http) => http.on('/turns', () => ({ status: 503, body: { message: 'Conversation generation failed.' } })), 'SERVER_ERROR'],
      ['500', (http) => http.on('/turns', () => ({ status: 500, body: {} })), 'SERVER_ERROR'],
      ['garbage', (http) => http.on('/turns', () => ({ status: 200, body: { userTurn: { id: 1 } } })), 'MALFORMED_RESPONSE'],
      ['foreign key', (http) => http.on('/turns', () => ({ status: 200, body: submitBody({ ...view, userTurn: { ...view.userTurn, idempotencyKey: 'someone-else' } }, SESSION_A) })), 'MALFORMED_RESPONSE'],
      ['cancelled', (http) => http.on('/turns', () => ({ status: 200, body: submitBody({ ...view, replyState: 'PENDING', reply: null }, SESSION_A, 'CANCELLED') })), 'MALFORMED_RESPONSE'],
      ['orphan reply', (http) => http.on('/turns', () => {
        const body = submitBody(view, SESSION_A) as { assistantTurn: { source_turn_id: string } };
        body.assistantTurn.source_turn_id = 'another-turn';
        return { status: 200, body };
      }), 'MALFORMED_RESPONSE'],
    ];
    for (const [, arrange, reason] of cases) {
      const { http, api } = client();
      arrange(http);
      await expect(api.submitTurn(SESSION_A, { content: 'fixture: words', idempotencyKey: 'k-1' })).resolves.toEqual({ kind: 'OUTCOME_UNKNOWN', reason });
    }
  });

  it('a 4xx is a definitive REFUSAL: the controller refused before admission', async () => {
    for (const status of [400, 401, 403, 404, 409]) {
      const { http, api } = client();
      http.on('/turns', () => ({ status, body: {} }));
      await expect(api.submitTurn(SESSION_A, { content: 'fixture: words', idempotencyKey: 'k-1' })).resolves.toEqual({ kind: 'REFUSED', status });
    }
  });

  it('PROD-SEC-02: the typed admission limit (429) is a definitive REFUSAL carrying its own status, never a generic failure', async () => {
    // The server answers 429 { code: 'TURN_ADMISSION_LIMITED' } only when it committed nothing, so the existing
    // "not sent" presentation is truthful and no new copy exists; the status keeps the condition distinguishable.
    const { http, api } = client();
    http.on('/turns', () => ({ status: 429, body: { code: 'TURN_ADMISSION_LIMITED' } }));
    await expect(api.submitTurn(SESSION_A, { content: 'fixture: words', idempotencyKey: 'k-1' })).resolves.toEqual({ kind: 'REFUSED', status: 429 });
  });

  it('issues exactly one request per call — the transport never repeats a submission', async () => {
    const { http, api } = client();
    http.on('/turns', () => ({ status: 503, body: {} }));
    await api.submitTurn(SESSION_A, { content: 'fixture: words', idempotencyKey: 'k-1' });
    expect(http.matching('/turns')).toHaveLength(1);
  });
});

describe('W1A-01 — GET /conversation/sessions/:sessionId/turns', () => {
  it('asks for one bounded page, and the next older page by the oldest held turn', async () => {
    const { http, api } = client();
    const views = [exchange('fixture: one'), exchange('fixture: two', { replyState: 'FAILED' })];
    http.on('/turns', () => ({ status: 200, body: historyBody(views, true) }));
    await expect(api.readHistory(SESSION_A)).resolves.toEqual({ kind: 'PAGE', page: { exchanges: views, hasOlder: true } });
    await api.readHistory(SESSION_A, { before: views[0].userTurn.id });
    expect(http.calls.map((call) => [call.method, call.url])).toEqual([
      ['GET', `${BASE}/conversation/sessions/${SESSION_A}/turns?limit=${CONVERSATION_HISTORY_PAGE_LIMIT}`],
      ['GET', `${BASE}/conversation/sessions/${SESSION_A}/turns?limit=${CONVERSATION_HISTORY_PAGE_LIMIT}&before=${views[0].userTurn.id}`],
    ]);
  });

  it('refuses a page whose reply and reply state disagree, or that is not a page at all', async () => {
    const view = exchange('fixture: one');
    const lying = historyBody([view]) as { exchanges: { replyState: string }[] };
    lying.exchanges[0].replyState = 'FAILED';
    for (const body of [lying, { exchanges: 'no' }, { exchanges: [], hasOlder: 'no' }, null]) {
      const { http, api } = client();
      http.on('/turns', () => ({ status: 200, body }));
      await expect(api.readHistory(SESSION_A)).resolves.toEqual({ kind: 'UNAVAILABLE', reason: 'MALFORMED_RESPONSE' });
    }
  });

  it('reports an unavailable history by kind, never as an empty conversation', async () => {
    const { http, api } = client();
    http.on('/turns', () => ({ status: 404, body: {} }));
    await expect(api.readHistory(SESSION_A)).resolves.toEqual({ kind: 'UNAVAILABLE', reason: 'REFUSED' });
    http.on('/turns', () => ({ status: 502, body: {} }));
    await expect(api.readHistory(SESSION_A)).resolves.toEqual({ kind: 'UNAVAILABLE', reason: 'SERVER_ERROR' });
    http.failEverything();
    await expect(api.readHistory(SESSION_A)).resolves.toEqual({ kind: 'UNAVAILABLE', reason: 'NETWORK' });
  });
});

describe('W1A-01 — the credential is decided at each request, by the AC-01 seam', () => {
  it('a refreshed token is carried by the next request; a replaced identity’s request is never issued', async () => {
    const http = httpDouble();
    http.on('/turns', () => ({ status: 200, body: historyBody([]) }));
    let current: { accessToken: string; authGeneration: number } | null = { accessToken: 'token-1', authGeneration: 1 };
    const api = new ConversationTurnApiClient({
      baseUrl: BASE,
      fetch: createAuthorizedFetch({ credential: () => current, authGeneration: 1, fetch: http.fetch }),
    });

    await api.readHistory(SESSION_A);
    current = { accessToken: 'token-1-refreshed', authGeneration: 1 };
    await api.readHistory(SESSION_A);
    expect(http.calls.map((call) => call.authorization)).toEqual(['Bearer token-1', 'Bearer token-1-refreshed']);

    current = { accessToken: 'token-2', authGeneration: 2 };
    await expect(api.submitTurn(SESSION_A, { content: 'fixture: words', idempotencyKey: 'k-1' })).resolves.toEqual({ kind: 'NOT_ISSUED' });
    await expect(api.readHistory(SESSION_A)).resolves.toEqual({ kind: 'UNAVAILABLE', reason: 'NOT_ISSUED' });
    current = null;
    await expect(api.submitTurn(SESSION_A, { content: 'fixture: words', idempotencyKey: 'k-1' })).resolves.toEqual({ kind: 'NOT_ISSUED' });
    expect(http.calls).toHaveLength(2);
  });

  it('the runtime entry builds the transport on the seam bound to the bundle’s own identity', async () => {
    const http = httpDouble();
    http.on('/turns', () => ({ status: 200, body: historyBody([]) }));
    const auth = authPortDouble({ userId: 'user-1', accessToken: 'token-1' });
    const built = createMobileRuntimeEntry({ config: TEST_CONFIG, authPort: auth, foreground: createManualForegroundSignal('INACTIVE'), httpFetch: http.fetch });
    if (!built.ok) throw new Error('the entry could not be built');
    await built.runtime.start();
    await settle();
    const state = built.runtime.auth.getState();
    if (state.kind !== 'AUTHENTICATED') throw new Error('not authenticated');
    const bundle = { authGeneration: state.authGeneration, sessionId: SESSION_A } as Parameters<typeof built.runtime.conversationTurnsFor>[0];
    const api = built.runtime.conversationTurnsFor(bundle);
    await api.readHistory(SESSION_A);
    auth.emit({ userId: 'user-1', accessToken: 'token-1-refreshed' });
    await api.readHistory(SESSION_A);
    expect(http.matching('/turns').map((call) => call.authorization)).toEqual(['Bearer token-1', 'Bearer token-1-refreshed']);
    built.runtime.dispose();
  });
});
