/**
 * S8B-07 CP1-B (contract §6, §14, §20) — the client of the Replay Media Service's five routes. A transport and nothing
 * else: every request goes through the AC-01 authorized seam its caller hands it (the bearer is decided at each request
 * and travels in a header, never in a URL), it never chooses a command id, never repeats a request on its own, and
 * reports what the server said as a typed outcome. No route takes a user, a key or a band; nothing here is logged.
 *
 *   POST   /voice/listening/:callId/:commandId                               one listening set (one run, the whole call)
 *   POST   /replay/:replayId/versions/:versionId/playback/:commandId          one Replay set (its runs and presentation map)
 *   GET    /voice/transient/:artifactId/status                               the file's state and how long it stays readable
 *   GET    /voice/transient/:artifactId                                      the audio (Range; read by the platform player)
 *   DELETE /voice/transient/:artifactId                                      leaving: the set is released, its erasure due
 *
 * The one ambiguity it refuses to hide: a request with no readable answer MAY have created its set. That is UNKNOWN; the
 * caller retries it with the SAME command id, which the server resolves to the same set (§14.2 step 2).
 *
 * The refusals are the server's bounded words only: NOT_FOUND (with the PROVEN reason, or null), COMMAND_REUSED,
 * LIVE_CALL_ACTIVE, BUSY (a full queue, a generation limit, `NONE`, any failure to answer), and REFUSED (400, or an
 * answer this client cannot read exactly: nothing of it is used).
 */
import { decodePresentationMap, type PresentationBoundary, type PresentationSpan } from './presentation-map';

/** The seam's fetch (the AC-01 authorized fetch in production). */
export type TransientMediaFetch = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{ readonly ok: boolean; readonly status: number; json(): Promise<unknown> }>;

export interface TransientMediaApiConfig {
  /** The Replay Media Service's origin plus any base path, without a trailing slash. */
  readonly baseUrl: string;
  readonly fetch: TransientMediaFetch;
}

export type TransientJobState = 'PENDING' | 'RUNNING' | 'READY' | 'FAILED' | 'RELEASED' | 'EXPIRED';
const JOB_STATES: readonly TransientJobState[] = ['PENDING', 'RUNNING', 'READY', 'FAILED', 'RELEASED', 'EXPIRED'];
/** The cause the database PROVES (V-30); null claims none. */
export type TransientUnavailableReason = 'EXPIRED' | 'DELETED' | null;

/** One run of a set: its file once READY, its length, and (for a Replay) its spans. A listening set has one run, no spans. */
export interface TransientRunView {
  readonly artifactId: string | null;
  readonly durationMs: number;
  readonly spans: readonly PresentationSpan[];
}

/** A set as the server describes it: prepared, failed and released whole. A terminal set carries no run. */
export interface TransientSetView {
  readonly state: TransientJobState;
  readonly runs: readonly TransientRunView[];
  readonly boundaries: readonly PresentationBoundary[];
  /** How long the set stays readable from the moment of the answer (the database's own clock: no skew). */
  readonly readableForMs: number;
  readonly reason: TransientUnavailableReason;
}

export type TransientRequestResult =
  | { readonly kind: 'SET'; readonly set: TransientSetView }
  /** The source is not readable now (or not this person's): the PROVEN reason, or null. Nothing was created. */
  | { readonly kind: 'NOT_FOUND'; readonly reason: TransientUnavailableReason }
  /** The command id names another subject's request: nothing was created (A-1: mint one new command, ask once). */
  | { readonly kind: 'COMMAND_REUSED' }
  /** The person's live call is running (RT-1, V-34): nothing was created. */
  | { readonly kind: 'LIVE_CALL_ACTIVE' }
  /** The Replay pool cannot take it now (or there is none): nothing was created. */
  | { readonly kind: 'BUSY' }
  /** Refused as invalid, or an answer this client cannot read exactly. */
  | { readonly kind: 'REFUSED' }
  /** No readable answer: the set MAY exist. Retry with the same command id. */
  | { readonly kind: 'UNKNOWN' };

export interface TransientStatusView {
  readonly state: TransientJobState;
  readonly readableForMs: number;
  readonly reason: TransientUnavailableReason;
}
export type TransientStatusResult =
  | { readonly kind: 'STATUS'; readonly status: TransientStatusView }
  | { readonly kind: 'NOT_FOUND' }
  /** BUSY, offline, or an answer this client cannot read: nothing is known, and nothing is concluded from it. */
  | { readonly kind: 'UNKNOWN' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isMs = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const jobState = (value: unknown): TransientJobState | null => ((JOB_STATES as readonly unknown[]).includes(value) ? (value as TransientJobState) : null);
const LIVE: readonly TransientJobState[] = ['PENDING', 'RUNNING', 'READY'];
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
};
/** `undefined` when the value is not one of the bounded reasons. */
const reasonOf = (value: unknown): TransientUnavailableReason | undefined =>
  (value === 'EXPIRED' || value === 'DELETED' || value === null ? value : undefined);

async function bodyOf(response: { json(): Promise<unknown> }): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** A listening answer: exactly one run (the whole call's file), whatever its state. */
export function decodeListeningAnswer(body: unknown): TransientSetView | null {
  if (!isRecord(body) || !hasExactly(body, ['artifactId', 'state', 'durationMs', 'readableForMs', 'reason'])) return null;
  const state = jobState(body.state);
  const reason = reasonOf(body.reason);
  if (state === null || reason === undefined || !isUuid(body.artifactId) || !isMs(body.durationMs) || !isMs(body.readableForMs)) return null;
  if (LIVE.includes(state) && body.durationMs < 1) return null;
  return {
    state, reason, readableForMs: body.readableForMs, boundaries: [],
    runs: [{ artifactId: body.artifactId.toLowerCase(), durationMs: body.durationMs, spans: [] }],
  };
}

/** A Replay answer: a live set with its exact presentation map (each READY run with its file), or a terminal set with none. */
export function decodeReplayAnswer(body: unknown): TransientSetView | null {
  if (!isRecord(body) || !hasExactly(body, ['state', 'runs', 'boundaries', 'readableForMs', 'reason'])) return null;
  const state = jobState(body.state);
  const reason = reasonOf(body.reason);
  if (state === null || reason === undefined || !isMs(body.readableForMs)) return null;
  const map = decodePresentationMap(body.runs, body.boundaries);
  if (map === null) return null;
  if (!LIVE.includes(state)) {
    // A known command's terminal set: its state, nothing to play.
    return map.runs.length === 0 && body.readableForMs === 0 ? { state, reason, readableForMs: 0, runs: [], boundaries: [] } : null;
  }
  if (map.runs.length === 0) return null;
  // A set is READY only when every run is; a READY run carries its file, a run still prepared carries none.
  if (state === 'READY' && map.runs.some((run) => run.artifactId === null)) return null;
  return {
    state, reason, readableForMs: body.readableForMs, boundaries: map.boundaries,
    runs: map.runs.map((run) => ({ ...run, artifactId: run.artifactId === null ? null : run.artifactId.toLowerCase() })),
  };
}

export class TransientMediaApiClient {
  constructor(private readonly config: TransientMediaApiConfig) {}

  private url(path: string): string {
    return `${this.config.baseUrl}${path}`;
  }

  private async send(method: string, path: string): Promise<{ status: number; body: unknown } | null> {
    try {
      const response = await this.config.fetch(this.url(path), { method, headers: { Accept: 'application/json' } });
      return { status: response.status, body: await bodyOf(response) };
    } catch {
      return null;
    }
  }

  private async request(path: string, decode: (body: unknown) => TransientSetView | null): Promise<TransientRequestResult> {
    const answer = await this.send('POST', path);
    if (answer === null) return { kind: 'UNKNOWN' };
    const outcome = isRecord(answer.body) ? answer.body.outcome : undefined;
    if (answer.status === 404 && outcome === 'NOT_FOUND') return { kind: 'NOT_FOUND', reason: reasonOf((answer.body as Record<string, unknown>).reason) ?? null };
    if (answer.status === 409 && outcome === 'COMMAND_REUSED') return { kind: 'COMMAND_REUSED' };
    if (answer.status === 409 && outcome === 'LIVE_CALL_ACTIVE') return { kind: 'LIVE_CALL_ACTIVE' };
    if (answer.status === 503) return { kind: 'BUSY' };
    if (answer.status >= 500) return { kind: 'UNKNOWN' };
    if (answer.status !== 200) return { kind: 'REFUSED' };
    const set = decode(answer.body);
    return set === null ? { kind: 'REFUSED' } : { kind: 'SET', set };
  }

  /** The call's listening set under the caller's command id. */
  requestListening(callId: string, commandId: string): Promise<TransientRequestResult> {
    return this.request(`/voice/listening/${encodeURIComponent(callId)}/${encodeURIComponent(commandId)}`, decodeListeningAnswer);
  }

  /** The Replay version's playback set under the caller's command id. */
  requestReplay(replayId: string, versionId: string, commandId: string): Promise<TransientRequestResult> {
    return this.request(
      `/replay/${encodeURIComponent(replayId)}/versions/${encodeURIComponent(versionId)}/playback/${encodeURIComponent(commandId)}`,
      decodeReplayAnswer,
    );
  }

  async status(artifactId: string): Promise<TransientStatusResult> {
    const answer = await this.send('GET', `/voice/transient/${encodeURIComponent(artifactId)}/status`);
    if (answer === null) return { kind: 'UNKNOWN' };
    if (answer.status === 404) return { kind: 'NOT_FOUND' };
    if (answer.status !== 200 || !isRecord(answer.body) || !hasExactly(answer.body, ['state', 'failure', 'readableForMs', 'reason'])) return { kind: 'UNKNOWN' };
    const state = jobState(answer.body.state);
    const reason = reasonOf(answer.body.reason);
    if (state === null || reason === undefined || !isMs(answer.body.readableForMs)) return { kind: 'UNKNOWN' };
    return { kind: 'STATUS', status: { state, readableForMs: answer.body.readableForMs, reason } };
  }

  /** The audio's URL for the platform player; the bearer is a header the caller adds, never a part of it. */
  audioUrl(artifactId: string): string {
    return this.url(`/voice/transient/${encodeURIComponent(artifactId)}`);
  }

  /** Leaving: the set is released and its erasure made due. Whatever the answer, nothing more is asked of this file. */
  async release(artifactId: string): Promise<void> {
    await this.send('DELETE', `/voice/transient/${encodeURIComponent(artifactId)}`);
  }
}
