/**
 * S7-02 — the Replay entry client: the S7-01 API used as it is. Strict decoders, the identity is the token's (no user,
 * owner or unit id is ever sent), and a command's outcome is never guessed.
 */
import { CredentialUnavailableError } from '../auth/request-credential';
import type { RuntimeHttpFetch } from '../conversation/conversation-session-api';
import { ReplayApiClient, decodeDraftCommand, decodeReplayRead, decodeReplaySummary } from '../replay-api';
import type { TemporalApiClient } from '../../temporal/temporal-api';

const SESSION = '11111111-1111-4111-8111-111111111111';
const REPLAY = '33333333-3333-4333-8333-333333333333';
const BASE = 'https://api.example.test';

interface Sent { url: string; method: string; body: unknown }

function client(answer: (sent: Sent) => { status: number; body?: unknown } | 'THROW' | 'NOT_ISSUED' | 'BAD_JSON', temporal: Partial<TemporalApiClient> = {}) {
  const sent: Sent[] = [];
  const fetch: RuntimeHttpFetch = async (url, init) => {
    const record = { url, method: init?.method ?? 'GET', body: init?.body === undefined ? undefined : JSON.parse(init.body) };
    sent.push(record);
    const a = answer(record);
    if (a === 'THROW') throw new Error('network');
    if (a === 'NOT_ISSUED') throw new CredentialUnavailableError('NOT_AUTHENTICATED');
    if (a === 'BAD_JSON') return { ok: true, status: 200, json: async () => { throw new Error('bad json'); } };
    return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => a.body };
  };
  return { api: new ReplayApiClient({ baseUrl: BASE, fetch, temporal: temporal as TemporalApiClient }), sent };
}

const CREATED = { outcome: 'CREATED', replayId: REPLAY, lifecycle: 'DRAFT', draftRevision: 1, coverageClass: 'FULL_SOURCE', selectedMomentCount: 12 };
const FOUND = {
  outcome: 'FOUND', replayId: REPLAY, lifecycle: 'DRAFT', createdAt: '2026-10-19T09:00:00.123456+00:00',
  draft: { revision: 2, coverageClass: 'SELECTED_EXCERPT', selectedMomentCount: 4, firstTc: 5, lastTc: 8, sourceState: 'CURRENT', updatedAt: '2026-10-19T09:01:00Z' },
  currentVersion: null,
};

describe('S7-02 — the request bodies carry the command and the range, never an identity', () => {
  it('create: commandId, sessionId, firstTc, lastTc — exactly', async () => {
    const { api, sent } = client(() => ({ status: 200, body: CREATED }));
    await api.createDraft('cmd-1', SESSION, { firstTc: 1, lastTc: 12 });
    expect(sent[0]).toEqual({ url: `${BASE}/replay/drafts`, method: 'POST', body: { commandId: 'cmd-1', sessionId: SESSION, firstTc: 1, lastTc: 12 } });
  });

  it('revise: commandId, expectedDraftRevision, firstTc, lastTc — exactly, on the Replay’s own path', async () => {
    const { api, sent } = client(() => ({ status: 200, body: { ...CREATED, outcome: 'REVISED', draftRevision: 3 } }));
    const result = await api.reviseDraft('cmd-2', REPLAY, 2, { firstTc: 5, lastTc: 8 });
    expect(sent[0]).toEqual({ url: `${BASE}/replay/${REPLAY}/revisions`, method: 'POST', body: { commandId: 'cmd-2', expectedDraftRevision: 2, firstTc: 5, lastTc: 8 } });
    expect(result).toMatchObject({ kind: 'ANSWERED', answer: { outcome: 'REVISED', draftRevision: 3 } });
  });

  it('reads: the capability, this conversation’s Replays and one Replay, by GET', async () => {
    const { api, sent } = client((s) => ({ status: 200, body: s.url.endsWith('/capability') ? { creationAvailable: true } : s.url.includes('/conversations/') ? { replays: [] } : FOUND }));
    await api.capability();
    await api.conversationReplays(SESSION);
    await api.replay(REPLAY);
    expect(sent.map((s) => `${s.method} ${s.url.slice(BASE.length)}`)).toEqual(['GET /replay/capability', `GET /replay/conversations/${SESSION}`, `GET /replay/${REPLAY}`]);
    expect(sent.every((s) => s.body === undefined)).toBe(true);
  });
});

describe('S7-02 — a command’s outcome is never guessed', () => {
  it.each([
    ['a 2xx success', () => ({ status: 200, body: CREATED }), 'ANSWERED'],
    ['a governed refusal word', () => ({ status: 200, body: { outcome: 'NOT_AVAILABLE_NOW' } }), 'REFUSED_BY_SERVER'],
    ['400 INVALID_REQUEST (refused before admission)', () => ({ status: 400, body: { outcome: 'INVALID_REQUEST' } }), 'NOT_ADMITTED'],
    ['a request the credential seam never issued', () => 'NOT_ISSUED' as const, 'NOT_ADMITTED'],
    ['503 (the server cannot say)', () => ({ status: 503, body: { outcome: 'UNAVAILABLE' } }), 'OUTCOME_UNKNOWN'],
    ['a network failure', () => 'THROW' as const, 'OUTCOME_UNKNOWN'],
    ['a 2xx body that cannot be read', () => 'BAD_JSON' as const, 'OUTCOME_UNKNOWN'],
    ['an unknown word', () => ({ status: 200, body: { outcome: 'MAYBE' } }), 'OUTCOME_UNKNOWN'],
    ['a success with an extra key', () => ({ status: 200, body: { ...CREATED, ownerId: 'x' } }), 'OUTCOME_UNKNOWN'],
  ])('%s', async (_name, answer, kind) => {
    const { api } = client(answer as never);
    expect((await api.createDraft('cmd', SESSION, { firstTc: 1, lastTc: 2 })).kind).toBe(kind);
  });

  it('a REVISED body answering a create is not a success', () => {
    expect(decodeDraftCommand({ ...CREATED, outcome: 'REVISED' }, 'CREATED')).toBeNull();
  });
});

describe('S7-02 — strict decoders', () => {
  it('a summary row with exactly its keys; anything doubtful is null', () => {
    const row = { replayId: REPLAY.toUpperCase(), lifecycle: 'DRAFT', createdAt: '2026-10-19T09:00:00Z', currentVersionId: null, currentVersionFinalized: null };
    expect(decodeReplaySummary(row)).toEqual({ replayId: REPLAY, lifecycle: 'DRAFT', createdAt: '2026-10-19T09:00:00Z' });
    expect(decodeReplaySummary({ ...row, sessionId: SESSION })).toBeNull();
    expect(decodeReplaySummary({ ...row, currentVersionFinalized: true })).toBeNull();
    expect(decodeReplaySummary({ ...row, lifecycle: 'PLAYING' })).toBeNull();
  });

  it('a Replay read is FOUND only for the Replay asked for; UNAVAILABLE is NOT_FOUND', () => {
    expect(decodeReplayRead(FOUND, REPLAY)).toEqual({ kind: 'FOUND', replay: { replayId: REPLAY, lifecycle: 'DRAFT', revision: 2, coverage: 'SELECTED_EXCERPT', firstTc: 5, lastTc: 8, sourceState: 'CURRENT' } });
    expect(decodeReplayRead(FOUND, '44444444-4444-4444-8444-444444444444').kind).toBe('UNAVAILABLE');
    expect(decodeReplayRead({ outcome: 'UNAVAILABLE' }, REPLAY).kind).toBe('NOT_FOUND');
    expect(decodeReplayRead({ ...FOUND, draft: { ...FOUND.draft, lastTc: 4 } }, REPLAY).kind).toBe('UNAVAILABLE');
    expect(decodeReplayRead({ ...FOUND, draft: { ...FOUND.draft, units: [] } }, REPLAY).kind).toBe('UNAVAILABLE');
  });

  it('a list with a doubtful or repeated row is unusable as a whole', async () => {
    const row = { replayId: REPLAY, lifecycle: 'DRAFT', createdAt: '2026-10-19T09:00:00Z', currentVersionId: null, currentVersionFinalized: null };
    expect((await client(() => ({ status: 200, body: { replays: [row, row] } })).api.conversationReplays(SESSION)).kind).toBe('UNAVAILABLE');
    expect((await client(() => ({ status: 200, body: { replays: [row] } })).api.conversationReplays(SESSION))).toMatchObject({ kind: 'READ', replays: [{ replayId: REPLAY }] });
    // An unowned conversation is answered with an empty list by the server: no draft, no entry into anyone else's.
    expect((await client(() => ({ status: 200, body: { replays: [] } })).api.conversationReplays(SESSION))).toEqual({ kind: 'READ', replays: [] });
  });

  it('the capability is a hint with exactly one boolean', async () => {
    expect(await client(() => ({ status: 200, body: { creationAvailable: false } })).api.capability()).toEqual({ kind: 'READ', creationAvailable: false });
    expect(await client(() => ({ status: 200, body: { creationAvailable: 'yes' } })).api.capability()).toEqual({ kind: 'UNAVAILABLE' });
    expect(await client(() => ({ status: 503 })).api.capability()).toEqual({ kind: 'UNAVAILABLE' });
  });
});

describe('S7-02 — the positions come from the frozen temporal reads', () => {
  it('asks for full pages after a position, and a failing read is UNAVAILABLE', async () => {
    const asked: unknown[] = [];
    const temporal = {
      fetchCommittedEvents: async (sessionId: string, options: unknown) => { asked.push({ sessionId, options }); return []; },
      fetchSessionTemporalState: async () => { throw new Error('down'); },
    };
    const { api, sent } = client(() => ({ status: 500 }), temporal as never);
    expect(await api.committedEvents(SESSION, 12)).toEqual({ kind: 'READ', events: [] });
    expect(asked).toEqual([{ sessionId: SESSION, options: { afterSp: 12, limit: 256 } }]);
    expect(await api.liveHead(SESSION)).toEqual({ kind: 'UNAVAILABLE' });
    expect(sent).toHaveLength(0);
  });
});
