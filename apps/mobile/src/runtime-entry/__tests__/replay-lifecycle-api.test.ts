/**
 * S7-04 — the Replay lifecycle client: the three S7-01 commands used as they are. Strict decoders over the REAL-PATH
 * captured answers, exactly the bodies the boundary takes, no identity of its own, and an outcome never guessed. And the
 * S7-02 Replay read now keeps the current version it already carried.
 */
import { CredentialUnavailableError } from '../auth/request-credential';
import type { RuntimeHttpFetch } from '../conversation/conversation-session-api';
import { decodeReplayRead } from '../replay-api';
import { ReplayLifecycleApiClient, decodeFinalizeCommand, decodePreviewCommand, decodeReopenCommand } from '../replay-lifecycle-api';

const WIRE = require('../../replay-player/__fixtures__/replay-player-wire.json') as {
  steps: Record<string, { request: { method: string; path: string; body?: Record<string, unknown> }; status: number; body: Record<string, unknown> }>;
};
const S = WIRE.steps;
const REPLAY = S.draft.body.replayId as string;
const BASE = 'https://api.example.test';

interface Sent { url: string; method: string; body: unknown; headers: unknown }

function client(answer: (sent: Sent) => { status: number; body?: unknown } | 'THROW' | 'NOT_ISSUED' | 'BAD_JSON') {
  const sent: Sent[] = [];
  const fetch: RuntimeHttpFetch = async (url, init) => {
    const record = { url, method: init?.method ?? 'GET', body: init?.body === undefined ? undefined : JSON.parse(init.body), headers: init?.headers };
    sent.push(record);
    const a = answer(record);
    if (a === 'THROW') throw new Error('network');
    if (a === 'NOT_ISSUED') throw new CredentialUnavailableError('NOT_AUTHENTICATED');
    if (a === 'BAD_JSON') return { ok: true, status: 200, json: async () => { throw new Error('bad json'); } };
    return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => a.body };
  };
  return { api: new ReplayLifecycleApiClient({ baseUrl: BASE, fetch }), sent };
}

describe('S7-04 — the request is exactly the captured one: the command, its id and its expectation, never an identity', () => {
  it.each([
    ['preview', (api: ReplayLifecycleApiClient) => api.preview(S.preview.request.body!.commandId as string, REPLAY, 1)],
    ['finalize', (api: ReplayLifecycleApiClient) => api.finalize(S.finalize.request.body!.commandId as string, REPLAY, S.finalize.request.body!.expectedVersionId as string)],
    ['reopen', (api: ReplayLifecycleApiClient) => api.reopen(S.reopen.request.body!.commandId as string, REPLAY, S.reopen.request.body!.expectedVersionId as string)],
  ])('%s', async (step, send) => {
    const { api, sent } = client(() => ({ status: 200, body: S[step].body }));
    const result = await send(api);
    expect(sent).toEqual([{ url: `${BASE}${S[step].request.path}`, method: 'POST', body: S[step].request.body, headers: { Accept: 'application/json', 'Content-Type': 'application/json' } }]);
    expect(result.kind).toBe('ANSWERED');
  });
});

describe('S7-04 — the captured answers decode, strictly', () => {
  it('the preview, finalize and reopen answers, exactly as the real ReplayService answered', () => {
    expect(decodePreviewCommand(S.preview.body, REPLAY)).toEqual({ kind: 'ANSWERED', answer: S.preview.body });
    expect(decodeFinalizeCommand(S.finalize.body, REPLAY)).toEqual({ kind: 'ANSWERED', answer: S.finalize.body });
    expect(decodeReopenCommand(S.reopen.body, REPLAY)).toEqual({ kind: 'ANSWERED', answer: S.reopen.body });
    // A reopen from PREVIEW_READY (after a refused finalize) answers the same shape.
    expect(decodeReopenCommand(S.analysisReopen.body, S.analysisDraft.body.replayId as string)?.kind).toBe('ANSWERED');
  });

  it('every captured refusal is its own command’s bounded word', () => {
    expect(decodePreviewCommand(S.previewConflict.body, REPLAY)).toEqual({ kind: 'REFUSED_BY_SERVER', refusal: 'COMMAND_CONFLICT' });
    expect(decodePreviewCommand(S.previewAgain.body, REPLAY)).toEqual({ kind: 'REFUSED_BY_SERVER', refusal: 'LIFECYCLE_NOT_ELIGIBLE' });
    expect(decodePreviewCommand(S.openHeadPreview.body, REPLAY)).toEqual({ kind: 'REFUSED_BY_SERVER', refusal: 'MOMENT_NOT_SEALED' });
    expect(decodeFinalizeCommand(S.finalizeStale.body, REPLAY)).toEqual({ kind: 'REFUSED_BY_SERVER', refusal: 'CHANGED' });
    expect(decodeFinalizeCommand(S.finalizeAgain.body, REPLAY)).toEqual({ kind: 'REFUSED_BY_SERVER', refusal: 'LIFECYCLE_NOT_ELIGIBLE' });
    expect(decodeFinalizeCommand(S.sourceChangedFinalize.body, REPLAY)).toEqual({ kind: 'REFUSED_BY_SERVER', refusal: 'SOURCE_CHANGED' });
    expect(decodeFinalizeCommand(S.analysisChangedFinalize.body, REPLAY)).toEqual({ kind: 'REFUSED_BY_SERVER', refusal: 'ANALYSIS_CHANGED' });
    // A word from another command's set is not this command's answer.
    expect(decodeReopenCommand({ outcome: 'ANALYSIS_CHANGED' }, REPLAY)).toBeNull();
    expect(decodePreviewCommand({ outcome: 'ANALYSIS_CHANGED' }, REPLAY)).toBeNull();
    expect(decodeFinalizeCommand({ outcome: 'MOMENT_NOT_SEALED' }, REPLAY)).toBeNull();
  });

  it('an extra field, another Replay, a missing field or an unknown word is no answer', () => {
    expect(decodePreviewCommand({ ...S.preview.body, sessionId: 'x' }, REPLAY)).toBeNull();
    expect(decodePreviewCommand(S.preview.body, '44444444-4444-4444-8444-444444444444')).toBeNull();
    const { momentCount: _dropped, ...partial } = S.preview.body;
    expect(decodePreviewCommand(partial, REPLAY)).toBeNull();
    expect(decodeFinalizeCommand({ ...S.finalize.body, outcome: 'PUBLISHED' }, REPLAY)).toBeNull();
    expect(decodeReopenCommand({ ...S.reopen.body, lifecycle: 'PLAYING' }, REPLAY)).toBeNull();
    expect(decodeFinalizeCommand({ outcome: 'SHARED' }, REPLAY)).toBeNull();
  });
});

describe('S7-04 — an outcome is never guessed', () => {
  it('a dropped network, a 5xx and an unreadable 2xx are OUTCOME_UNKNOWN; so is an answer that cannot be decoded', async () => {
    for (const answer of ['THROW', { status: 503, body: { outcome: 'UNAVAILABLE' } }, { status: 500 }, 'BAD_JSON', { status: 200, body: { outcome: 'FINALIZED' } }] as const) {
      expect(await client(() => answer).api.finalize('c', REPLAY, S.finalize.request.body!.expectedVersionId as string)).toEqual({ kind: 'OUTCOME_UNKNOWN' });
    }
  });

  it('a 4xx, or a request the credential seam refused, was never admitted: NOT_ADMITTED', async () => {
    expect(await client(() => ({ status: 400 })).api.preview('c', REPLAY, 1)).toEqual({ kind: 'NOT_ADMITTED' });
    expect(await client(() => ({ status: 401 })).api.reopen('c', REPLAY, REPLAY)).toEqual({ kind: 'NOT_ADMITTED' });
    expect(await client(() => 'NOT_ISSUED').api.preview('c', REPLAY, 1)).toEqual({ kind: 'NOT_ADMITTED' });
  });
});

describe('S7-04 — the S7-02 Replay read keeps the current version it already carried (no new server field)', () => {
  it('null for a fresh draft; the version, and whether it is the private copy, once there is one', () => {
    expect(decodeReplayRead(S.readDraft.body, REPLAY)).toMatchObject({ kind: 'FOUND', replay: { lifecycle: 'DRAFT', currentVersion: null } });
    expect(decodeReplayRead(S.readPreview.body, REPLAY)).toMatchObject({ kind: 'FOUND', replay: { lifecycle: 'PREVIEW_READY', currentVersion: { versionId: S.preview.body.versionId, revision: 1, finalized: false } } });
    expect(decodeReplayRead(S.readFinalized.body, REPLAY)).toMatchObject({ kind: 'FOUND', replay: { lifecycle: 'FINALIZED', currentVersion: { finalized: true } } });
    // After a reopen: a draft whose current version is still the finalized one.
    expect(decodeReplayRead(S.readAfterReopen.body, REPLAY)).toMatchObject({ kind: 'FOUND', replay: { lifecycle: 'DRAFT', revision: 1, currentVersion: { versionId: S.preview.body.versionId, finalized: true } } });
    expect(decodeReplayRead(S.readSecond.body, REPLAY)).toMatchObject({ kind: 'FOUND', replay: { lifecycle: 'PREVIEW_READY', currentVersion: { versionId: S.previewSecond.body.versionId, revision: 2 } } });
  });

  it('a doubtful current version makes the read unusable as a whole', () => {
    const body = S.readPreview.body as { currentVersion: Record<string, unknown> };
    expect(decodeReplayRead({ ...body, currentVersion: { ...body.currentVersion, finalized: 'yes' } }, REPLAY).kind).toBe('UNAVAILABLE');
    expect(decodeReplayRead({ ...body, currentVersion: { ...body.currentVersion, shared: false } }, REPLAY).kind).toBe('UNAVAILABLE');
    expect(decodeReplayRead({ ...body, currentVersion: { ...body.currentVersion, versionId: 'v1' } }, REPLAY).kind).toBe('UNAVAILABLE');
  });
});
