/**
 * COSMOS E-2 corrections, Slice B (the Product Owner's D-2, 2026-11-20) — the Personal conversation catalog: the wire
 * client, the presentation controller and the copy gate.
 */
import { ConversationCatalogApiClient, ConversationSessionApiClient, type RuntimeHttpFetch } from '../../runtime-entry';
import { CONVERSATION_CATALOG_COPY_GATE, conversationCatalogCopy } from '../catalog/copy';
import { conversationDisplayName, createConversationCatalogController } from '../conversation-catalog-controller';

const SESSION_1 = '11111111-1111-4111-8111-111111111111';
const SESSION_2 = '22222222-2222-4222-8222-222222222222';
const row = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, status: 'ACTIVE', channel: 'TEXT', created_at: '2026-01-02T00:00:00.000Z', updated_at: 'n', last_activity_at: 'n', closed_at: null,
  client_request_id: null, title: null, title_at: null, opening: null, last_turn_at: null, turn_count: 0, ...overrides,
});

type Call = { url: string; method: string; body: string | null; headers: Record<string, string> };
function http(responder: (call: Call) => { status: number; body: unknown }) {
  const calls: Call[] = [];
  const fetch: RuntimeHttpFetch = async (url, init) => {
    const call = { url, method: init?.method ?? 'GET', body: init?.body ?? null, headers: init?.headers ?? {} };
    calls.push(call);
    const { status, body } = responder(call);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { calls, fetch };
}

describe('Slice B — the catalog wire client', () => {
  it('lists the caller’s conversations from GET /conversation/sessions and decodes exactly what the rows carry', async () => {
    const h = http(() => ({ status: 200, body: [row(SESSION_1, { title: 'Named', opening: 'first words', last_turn_at: '2026-02-01T00:00:00.000Z', turn_count: 3 }), row(SESSION_2)] }));
    const client = new ConversationCatalogApiClient({ baseUrl: 'https://api.test', fetch: h.fetch });
    const outcome = await client.listSessions();
    expect(h.calls).toEqual([expect.objectContaining({ url: 'https://api.test/conversation/sessions', method: 'GET', body: null })]);
    expect(outcome).toEqual({
      kind: 'LISTED',
      entries: [
        { sessionId: SESSION_1, status: 'ACTIVE', createdAt: '2026-01-02T00:00:00.000Z', title: 'Named', opening: 'first words', lastTurnAt: '2026-02-01T00:00:00.000Z', turnCount: 3 },
        { sessionId: SESSION_2, status: 'ACTIVE', createdAt: '2026-01-02T00:00:00.000Z', title: null, opening: null, lastTurnAt: null, turnCount: 0 },
      ],
    });
  });

  it('refuses a malformed list whole, and names the three typed failures', async () => {
    const malformed = new ConversationCatalogApiClient({ baseUrl: 'https://api.test', fetch: http(() => ({ status: 200, body: [row(SESSION_1), { id: 'nope' }] })).fetch });
    expect(await malformed.listSessions()).toEqual({ kind: 'UNAVAILABLE', detail: 'a catalog row is malformed' });
    const unauthenticated = new ConversationCatalogApiClient({ baseUrl: 'https://api.test', fetch: http(() => ({ status: 401, body: {} })).fetch });
    expect(await unauthenticated.listSessions()).toEqual({ kind: 'UNAUTHENTICATED' });
    const down = new ConversationCatalogApiClient({ baseUrl: 'https://api.test', fetch: async () => { throw new Error('offline'); } });
    expect(await down.listSessions()).toEqual({ kind: 'UNAVAILABLE', detail: 'offline' });
    const notList = new ConversationCatalogApiClient({ baseUrl: 'https://api.test', fetch: http(() => ({ status: 200, body: { items: [] } })).fetch });
    expect(await notList.listSessions()).toEqual({ kind: 'UNAVAILABLE', detail: 'the catalog is not a list' });
  });

  it('renames through PATCH /conversation/sessions/:id/title with the words only, and reads the server’s own answer', async () => {
    const h = http(() => ({ status: 200, body: { session_id: SESSION_1, title: 'My topic', created_at: 'now' } }));
    const client = new ConversationCatalogApiClient({ baseUrl: 'https://api.test', fetch: h.fetch });
    expect(await client.renameSession(SESSION_1, '  My   topic ')).toEqual({ kind: 'RENAMED', sessionId: SESSION_1, title: 'My topic' });
    expect(h.calls[0].url).toBe(`https://api.test/conversation/sessions/${SESSION_1}/title`);
    expect(h.calls[0].method).toBe('PATCH');
    expect(JSON.parse(h.calls[0].body as string)).toEqual({ title: '  My   topic ' });
    expect(await new ConversationCatalogApiClient({ baseUrl: 'https://api.test', fetch: http(() => ({ status: 404, body: {} })).fetch }).renameSession(SESSION_1, 'x')).toEqual({ kind: 'NOT_FOUND' });
    expect(await new ConversationCatalogApiClient({ baseUrl: 'https://api.test', fetch: http(() => ({ status: 400, body: {} })).fetch }).renameSession(SESSION_1, '')).toEqual({ kind: 'REFUSED', status: 400 });
    // An answer naming another Session is refused: the row shown must be the one renamed.
    expect(await new ConversationCatalogApiClient({ baseUrl: 'https://api.test', fetch: http(() => ({ status: 200, body: { session_id: SESSION_2, title: 'x', created_at: 'n' } })).fetch }).renameSession(SESSION_1, 'x'))
      .toEqual({ kind: 'UNAVAILABLE', detail: 'the renamed row is malformed' });
  });

  it('the Session client sends the client request identity only when one is given, and the 0030 shape otherwise', async () => {
    const h = http(() => ({ status: 201, body: row(SESSION_1) }));
    const client = new ConversationSessionApiClient({ baseUrl: 'https://api.test', fetch: h.fetch });
    expect((await client.createSession('token')).kind).toBe('CREATED');
    expect(h.calls[0].body).toBeNull();
    expect(h.calls[0].headers['Content-Type']).toBeUndefined();
    expect((await client.createSession('token', 'request-1')).kind).toBe('CREATED');
    expect(JSON.parse(h.calls[1].body as string)).toEqual({ clientRequestId: 'request-1' });
    expect(h.calls[1].headers['Content-Type']).toBe('application/json');
  });
});

describe('Slice B — the catalog controller', () => {
  const transport = (list: ConversationCatalogApiClient['listSessions'], rename?: ConversationCatalogApiClient['renameSession']) => ({
    listSessions: list,
    renameSession: rename ?? (async () => ({ kind: 'UNAVAILABLE' as const, detail: 'none' })),
  });
  const entry = (sessionId: string, title: string | null = null) => ({ sessionId, status: 'ACTIVE' as const, createdAt: 'n', title, opening: null, lastTurnAt: null, turnCount: 0 });

  it('reads the list on refresh, marks the open Session, and never doubles a read in flight', async () => {
    let resolve: (value: Awaited<ReturnType<ConversationCatalogApiClient['listSessions']>>) => void = () => undefined;
    let reads = 0;
    const controller = createConversationCatalogController({
      transport: transport(() => { reads += 1; return new Promise((r) => { resolve = r; }); }),
      currentSessionId: SESSION_1,
      isCurrent: () => true,
    });
    expect(controller.getState()).toEqual({ status: 'IDLE', entries: [], currentSessionId: SESSION_1, renaming: null, renameFailed: false });
    controller.refresh();
    controller.refresh();
    expect(reads).toBe(1);
    expect(controller.getState().status).toBe('LOADING');
    resolve({ kind: 'LISTED', entries: [entry(SESSION_2), entry(SESSION_1)] });
    await Promise.resolve(); await Promise.resolve();
    expect(controller.getState().status).toBe('READY');
    expect(controller.getState().entries.map((e) => e.sessionId)).toEqual([SESSION_2, SESSION_1]);
  });

  it('an unavailable list is UNAVAILABLE, never an empty list', async () => {
    const controller = createConversationCatalogController({ transport: transport(async () => ({ kind: 'UNAVAILABLE', detail: 'x' })), currentSessionId: SESSION_1, isCurrent: () => true });
    controller.refresh();
    await Promise.resolve(); await Promise.resolve();
    expect(controller.getState().status).toBe('UNAVAILABLE');
    expect(controller.getState().entries).toEqual([]);
  });

  it('a rename updates the row from the server’s answer; a refused rename is reported and changes nothing', async () => {
    const controller = createConversationCatalogController({
      transport: transport(async () => ({ kind: 'LISTED', entries: [entry(SESSION_1, 'Old')] }), async (sessionId, title) => (title === 'bad' ? { kind: 'REFUSED', status: 400 } : { kind: 'RENAMED', sessionId, title })),
      currentSessionId: SESSION_1,
      isCurrent: () => true,
    });
    controller.refresh();
    await Promise.resolve(); await Promise.resolve();
    controller.beginRename(SESSION_1);
    expect(controller.getState().renaming).toBe(SESSION_1);
    expect(await controller.rename(SESSION_1, 'bad')).toBe(false);
    expect(controller.getState()).toEqual(expect.objectContaining({ renaming: SESSION_1, renameFailed: true }));
    expect(controller.getState().entries[0].title).toBe('Old');
    expect(await controller.rename(SESSION_1, 'New')).toBe(true);
    expect(controller.getState()).toEqual(expect.objectContaining({ renaming: null, renameFailed: false }));
    expect(controller.getState().entries[0].title).toBe('New');
  });

  it('a retired controller applies nothing late', async () => {
    let current = true;
    const controller = createConversationCatalogController({ transport: transport(async () => ({ kind: 'LISTED', entries: [entry(SESSION_1)] })), currentSessionId: SESSION_1, isCurrent: () => current });
    controller.refresh();
    current = false;
    controller.retire();
    await Promise.resolve(); await Promise.resolve();
    expect(controller.getState().entries).toEqual([]);
  });

  it('a row is shown under the person’s title, else their first words, else nothing', () => {
    expect(conversationDisplayName({ title: 'Mine', opening: 'first' })).toBe('Mine');
    expect(conversationDisplayName({ title: '  ', opening: 'first' })).toBe('first');
    expect(conversationDisplayName({ title: null, opening: null })).toBeNull();
  });
});

describe('Slice B — the copy gate', () => {
  it('holds 14 rows PROPOSED and none APPROVED until the Product Owner decides', () => {
    expect(CONVERSATION_CATALOG_COPY_GATE.approved).toEqual([]);
    expect(CONVERSATION_CATALOG_COPY_GATE.proposed).toHaveLength(14);
    for (const language of ['ar', 'en'] as const) {
      const copy = conversationCatalogCopy(language);
      expect(Object.keys(copy).sort()).toEqual([...CONVERSATION_CATALOG_COPY_GATE.proposed].sort());
      for (const value of Object.values(copy)) expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(conversationCatalogCopy('ar').untitled).toBe('محادثة بلا عنوان');
    expect(conversationCatalogCopy('ar').newChat).toBe('محادثة جديدة');
  });
});
