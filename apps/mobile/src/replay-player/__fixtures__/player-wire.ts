/**
 * S7-04 — the player's proof input: the REAL-PATH Replay lifecycle wire, served to the REAL clients.
 *
 * `replay-player-wire.json` (beside this file, so it is a mobile build input) is what the real `ReplayService` answered
 * over rows the 0169 wrappers returned on a real PostgreSQL database, for ONE owner's whole journey
 * (`database/replay-composite-proof-world.mjs --player` → `tests/fixtures/s7-04-replay-player/rows.json` →
 * `apps/api/src/replay/replay-player-proof.spec.ts`). This module serves it as HTTP to the production
 * `ReplayApiClient`, `ReplayLifecycleApiClient` and `ReplayHistoryApiClient`, so every player proof passes through the
 * real decoders and the S7-03 composite.
 *
 * It answers a request only when the captured journey made EXACTLY that request (method, path and body, command id
 * included), and a Replay read is the one captured after the last command it answered — so a proof that sends a
 * different id, a different expectation or an extra command is answered 404 and recorded in `uncaptured`. Nothing is
 * invented: a state the journey never reached has no answer here.
 */
import { ReplayApiClient, ReplayHistoryApiClient, ReplayLifecycleApiClient } from '../../runtime-entry';
import type { ReplayDraftHandoff } from '../../replay-entry';
import type { ReplayPlayerCommands, ReplayPlayerReads } from '../player-controller';

interface WireRequest {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly body?: Readonly<Record<string, unknown>>;
}
interface WireStep {
  readonly request: WireRequest;
  readonly status: number;
  readonly body: unknown;
}
interface WireScene {
  readonly replayId: string;
  readonly versionId: string;
  readonly version: unknown;
  readonly moments: unknown;
  readonly analysis: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}
interface PlayerWireFixture {
  readonly provenance: Readonly<Record<string, string>>;
  readonly steps: Readonly<Record<string, WireStep>>;
  readonly scenes: Readonly<Record<'preview' | 'second' | 'source' | 'sourceWithdrawn' | 'analysisMoved' | 'analysisSecond', WireScene>>;
}

const WIRE = require('./replay-player-wire.json') as PlayerWireFixture;
export const PLAYER_WIRE: PlayerWireFixture = WIRE;
const S = WIRE.steps;
const field = (step: string, key: string) => (S[step].body as Record<string, unknown>)[key] as string;

/** The identities the captured journey produced (a rolled-back database: no real person). */
export const PLAYER_IDS = Object.freeze({
  session: S.listBefore.request.path.split('/').pop()!,
  replay: field('draft', 'replayId'),
  v1: field('preview', 'versionId'),
  v2: field('previewSecond', 'versionId'),
  openHead: field('openHeadDraft', 'replayId'),
  source: field('sourceDraft', 'replayId'),
  sourceVersion: field('sourcePreview', 'versionId'),
  moved: field('analysisDraft', 'replayId'),
  movedVersion: field('analysisPreview', 'versionId'),
  movedSecond: field('analysisPreviewAgain', 'versionId'),
});

/** The command id one captured step sent. A player proof mints exactly these, in the order it presses. */
export function capturedCommandId(step: string): string {
  return S[step].request.body!.commandId as string;
}
/** Mints the captured ids, one per press, in order. */
export function capturedIds(...steps: string[]): () => string {
  const queue = steps.map(capturedCommandId);
  return () => {
    const next = queue.shift();
    if (next === undefined) throw new Error('a command was pressed that the captured journey did not make');
    return next;
  };
}

/** The S7-02 handoff a save in the Conversation produced for one captured draft. */
export function capturedHandoff(draftStep: 'draft' | 'openHeadDraft' | 'sourceDraft' | 'analysisDraft'): ReplayDraftHandoff {
  const body = S[draftStep].body as Record<string, unknown>;
  const sent = S[draftStep].request.body!;
  return Object.freeze({
    sessionId: PLAYER_IDS.session, replayId: body.replayId as string, draftRevision: body.draftRevision as number,
    coverage: body.coverageClass as ReplayDraftHandoff['coverage'], selectedMomentCount: body.selectedMomentCount as number,
    firstTc: sent.firstTc as number, lastTc: sent.lastTc as number, reachesOpenHead: draftStep === 'openHeadDraft',
  });
}

export const PLAYER_BASE = 'https://replay-player-proof.invalid';
const VERSION_ROUTE = /^\/replay\/([^/]+)\/versions\/([^/?]+)(\/moments(?:\/(\d+)\/analysis\?depth=([A-Z_]+))?)?$/u;

/** The Replay read, and the conversation list, each captured after the command that moved it there. */
const AFTER: Readonly<Record<string, { readonly read?: string; readonly list?: string }>> = {
  preview: { read: 'readPreview', list: 'listPreview' },
  previewRetry: { read: 'readPreview', list: 'listPreview' },
  finalize: { read: 'readFinalized', list: 'listFinalized' },
  finalizeRetry: { read: 'readFinalized', list: 'listFinalized' },
  reopen: { read: 'readAfterReopen', list: 'listAfterReopen' },
  reopenRetry: { read: 'readAfterReopen', list: 'listAfterReopen' },
  previewSecond: { read: 'readSecond' },
  sourceChangedFinalize: { read: 'readSourceAfterRefusal' },
  analysisChangedFinalize: { read: 'readAnalysisAfterRefusal' },
  analysisReopen: { read: 'readAnalysisAfterReopen' },
  analysisPreviewAgain: { read: 'readAnalysisPreviewAgain' },
};

export type PlayerAnswer = { readonly status: number; readonly body: unknown };
export interface PlayerServerOptions {
  /** Answer one request differently — a dropped answer (`'NETWORK'`), a held one (a promise), a 5xx. */
  readonly intercept?: (request: WireRequest) => PlayerAnswer | 'NETWORK' | Promise<PlayerAnswer | 'NETWORK'> | undefined;
  /** The origin the requests arrive at (default: the proof origin). */
  readonly base?: string;
  /**
   * The production composition: its command ids are minted at random and its Session is the harness's, so a request
   * is matched without its `commandId` and `sessionId` (every other field must still be exactly the captured one).
   * The id discipline itself is proven with exact matching, in the controller proofs.
   */
  readonly composition?: boolean;
}

export interface PlayerServer {
  readonly fetch: (url: string, init?: { method?: string; body?: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
  /** Every request, in order. */
  readonly requests: WireRequest[];
  /** Requests the captured journey never made (each was answered 404). A proof expects none. */
  readonly uncaptured: WireRequest[];
  /** The original message changes (the journey's own source edit): the source Replay's version reads withdrawn. */
  withdrawSource(): void;
  /** The conversation list the journey captured at this point (by step). */
  listIs(step: string): void;
}

export function playerServer(options: PlayerServerOptions = {}): PlayerServer {
  const requests: WireRequest[] = [];
  const uncaptured: WireRequest[] = [];
  const reads = new Map<string, string>([
    [PLAYER_IDS.replay, 'readDraft'], [PLAYER_IDS.openHead, 'readOpenHead'], [PLAYER_IDS.source, 'readSourcePreview'], [PLAYER_IDS.moved, 'readAnalysisPreview'],
  ]);
  let list = 'listDraft';
  let sourceWithdrawn = false;
  const scenes = (): Readonly<Record<string, WireScene>> => ({
    [PLAYER_IDS.v1]: WIRE.scenes.preview,
    [PLAYER_IDS.v2]: WIRE.scenes.second,
    [PLAYER_IDS.sourceVersion]: sourceWithdrawn ? WIRE.scenes.sourceWithdrawn : WIRE.scenes.source,
    [PLAYER_IDS.movedVersion]: WIRE.scenes.analysisMoved,
    [PLAYER_IDS.movedSecond]: WIRE.scenes.analysisSecond,
  });
  const respond = (answer: PlayerAnswer) => ({ ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => answer.body });
  const miss = (request: WireRequest) => {
    uncaptured.push(request);
    return respond({ status: 404, body: {} });
  };
  const base = options.base ?? PLAYER_BASE;
  const loose = options.composition === true;
  const shape = (body: WireRequest['body']) => {
    if (body === undefined || !loose) return JSON.stringify(body ?? null);
    const { commandId: _id, sessionId: _session, ...rest } = body;
    return JSON.stringify(rest);
  };
  const same = (a: WireRequest, b: WireRequest) => a.method === b.method && a.path === b.path && shape(a.body) === shape(b.body);

  const fetch: PlayerServer['fetch'] = async (url, init) => {
    const method = (init?.method ?? 'GET') as WireRequest['method'];
    const path = url.slice(base.length);
    const request: WireRequest = init?.body === undefined ? { method, path } : { method, path, body: JSON.parse(init.body) as Record<string, unknown> };
    requests.push(request);
    const intercepted = await options.intercept?.(request);
    if (intercepted === 'NETWORK') throw new Error('the network dropped');
    if (intercepted !== undefined) return respond(intercepted);
    if (!url.startsWith(base)) return miss(request);

    if (method === 'GET') {
      if (path.startsWith('/replay/conversations/')) return path === S[list].request.path || loose ? respond(S[list]) : miss(request);
      if (path === '/replay/capability') return respond(S.capability);
      const version = VERSION_ROUTE.exec(path);
      if (version !== null) {
        const scene = scenes()[version[2]];
        if (scene === undefined || scene.replayId !== version[1]) return miss(request);
        if (version[3] === undefined) return respond({ status: 200, body: scene.version });
        if (version[4] === undefined) return respond({ status: 200, body: scene.moments });
        const body = scene.analysis[version[4]]?.[version[5]];
        return body === undefined ? miss(request) : respond({ status: 200, body });
      }
      const read = /^\/replay\/([^/]+)$/u.exec(path);
      const step = read === null ? undefined : reads.get(read[1]);
      return step === undefined ? miss(request) : respond(S[step]);
    }
    const name = Object.keys(S).find((candidate) => S[candidate].request.method === 'POST' && same(S[candidate].request, request));
    if (name === undefined) return miss(request);
    const replayId = path.split('/')[2];
    const after = AFTER[name];
    if (after?.read !== undefined) reads.set(replayId, after.read);
    if (after?.list !== undefined) list = after.list;
    return respond(S[name]);
  };

  return {
    fetch,
    requests,
    uncaptured,
    withdrawSource() {
      sourceWithdrawn = true;
    },
    listIs(step) {
      list = step;
    },
  };
}

/** The three production clients the player is built over, on one scripted server. */
export function playerClients(server: PlayerServer): { reads: ReplayPlayerReads; commands: ReplayPlayerCommands; history: ReplayHistoryApiClient } {
  const fetch = server.fetch as never;
  return {
    // The temporal reads are not the player's: the S7-02 client is used for its Replay reads only.
    reads: new ReplayApiClient({ baseUrl: PLAYER_BASE, fetch, temporal: {} as never }),
    commands: new ReplayLifecycleApiClient({ baseUrl: PLAYER_BASE, fetch }),
    history: new ReplayHistoryApiClient({ baseUrl: PLAYER_BASE, fetch }),
  };
}
