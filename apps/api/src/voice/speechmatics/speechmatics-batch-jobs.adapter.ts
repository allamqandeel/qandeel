import * as nodeHttp from 'node:http';
import * as nodeHttps from 'node:https';
import type { Socket } from 'node:net';
import type {
  BatchFailure,
  BatchSubmitRequest,
  BatchTranscriptionJobs,
  FetchOutcome,
  FindOutcome,
  JobStatus,
  ProviderJobId,
  RecognizedWord,
  RemovalOutcome,
  SubmitOutcome,
} from '../batch-transcription-jobs.port';
import type { SpeechmaticsBatchConfig } from './speechmatics-batch.config';

/**
 * S8B-03 (CP1, contract §4.10.3) — the Speechmatics batch adapter: the ONE owner of HTTP to Speechmatics, its
 * authentication, the streamed multipart upload, json-v2 parsing, response classification and the per-instance rate
 * limit. It keeps no durable state and records nothing: the worker records every outcome through the 0186 definers.
 *
 *   - no SDK. The upload is ONE `node:http(s)` POST of a hand-built multipart body streamed from the note under the
 *     socket's backpressure (PR #370, A19): `fetch` kept every chunk it had already sent reachable until the request
 *     ended - a whole note held - so it serves the small reads only. TLS and its certificate check are node's defaults,
 *     never relaxed;
 *   - `submit` is never retried here. NOT_SENT only when it failed before the connection (and TLS) was up - nothing is
 *     written before then - or on the local rate limit or a decisive 429 / 503; after that, any timeout, drop or abort
 *     without a decisive answer is UNKNOWN, never "not created";
 *   - `status` / `fetchResult` / `remove` / `findByReference` retry once on a network error only;
 *   - DELETE never carries `force`: a running job answers LOCKED and is deleted once it is terminal;
 *   - `findByReference` is UNSUPPORTED unless reconciliation by reference is enabled (PC-S2);
 *   - no transcript, audio, job id, reference or key is ever logged, and no error carries one.
 */
const MAX_RESULT_BYTES = 8 * 1024 * 1024;
const MAX_RETRY_AFTER_MS = 60_000;
const LIST_PAGE = 100;
const LIST_PAGES = 10;

type Lane = 'create' | 'read';

/** A per-instance sliding one-second window per lane, paused by a provider Retry-After. */
class RateLimiter {
  private readonly stamps: Record<Lane, number[]> = { create: [], read: [] };
  private readonly pausedUntil: Record<Lane, number> = { create: 0, read: 0 };

  constructor(private readonly limits: Record<Lane, number>, private readonly now: () => number = Date.now) {}

  pause(lane: Lane, ms: number): void {
    this.pausedUntil[lane] = Math.max(this.pausedUntil[lane], this.now() + Math.min(ms, MAX_RETRY_AFTER_MS));
  }

  /** Waits for a slot; false when the signal ended first. */
  async acquire(lane: Lane, signal: AbortSignal): Promise<boolean> {
    for (;;) {
      if (signal.aborted) return false;
      const now = this.now();
      const window = this.stamps[lane].filter((t) => now - t < 1000);
      this.stamps[lane] = window;
      const wait = Math.max(this.pausedUntil[lane] - now, window.length < this.limits[lane] ? 0 : 1000 - (now - window[0]));
      if (wait <= 0) {
        window.push(now);
        return true;
      }
      if (!(await sleep(wait, signal))) return false;
    }
  }
}

const sleep = (ms: number, signal: AbortSignal) => new Promise<boolean>((resolve) => {
  if (signal.aborted) return resolve(false);
  const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(true); }, ms);
  const onAbort = () => { clearTimeout(timer); resolve(false); };
  signal.addEventListener('abort', onAbort, { once: true });
});

/** Retry-After as seconds or an HTTP date, in milliseconds; undefined when absent or unreadable. */
/** The job identity the database stores (0186): anything else is not a usable answer (UNKNOWN). */
const JOB_ID = /^[A-Za-z0-9_-]{1,128}$/;
const isJobId = (value: unknown): value is string => typeof value === 'string' && JOB_ID.test(value);

export function retryAfterMs(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.min(Math.max(0, date - now), MAX_RETRY_AFTER_MS) : undefined;
}

/** Connection-establishment failures: DNS, refusal, unreachable host, connect timeout, TLS handshake. */
const CONNECT_FAILURES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_CONNECT_TIMEOUT',
  'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID']);
function neverConnected(error: unknown): boolean {
  for (let cause: unknown = error, depth = 0; cause && depth < 4; cause = (cause as { cause?: unknown }).cause, depth += 1) {
    const code = (cause as { code?: unknown }).code;
    if (typeof code === 'string' && CONNECT_FAILURES.has(code)) return true;
  }
  return false;
}

const transientOf = (status: number): BatchFailure => (status === 429 ? 'RATE_LIMITED' : 'UNAVAILABLE');
const isTimeout = (error: unknown) => error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

/**
 * One streamed POST: nothing is written before the connection (and, for https, the TLS handshake) is up; each write
 * waits for the socket to drain before the next chunk is read, so the bytes in flight stay bounded and a chunk is no
 * longer referenced once it is written; and the first answer stops the writing (the provider stopped reading).
 */
class StreamedPost {
  answer: nodeHttp.IncomingMessage | null = null;
  wasConnected = false;
  readonly response: Promise<nodeHttp.IncomingMessage>;
  private readonly ready: Promise<void>;

  constructor(private readonly request: nodeHttp.ClientRequest, secure: boolean) {
    request.on('error', () => undefined); // every failure is read through the promises below, never thrown unhandled
    this.response = new Promise((resolve, reject) => {
      request.once('response', (response: nodeHttp.IncomingMessage) => { this.answer = response; resolve(response); });
      request.once('error', reject);
      request.once('close', () => reject(new Error('REQUEST_CLOSED')));
    });
    this.response.catch(() => undefined);
    this.ready = new Promise((resolve, reject) => {
      const up = () => { this.wasConnected = true; resolve(); };
      request.once('socket', (socket: Socket) => {
        // A pooled socket is already connected (and its TLS session established); a new one is not, yet.
        if (!socket.connecting) up();
        else socket.once(secure ? 'secureConnect' : 'connect', up);
      });
      request.once('error', reject);
      request.once('close', () => reject(new Error('REQUEST_CLOSED')));
    });
    this.ready.catch(() => undefined);
  }

  connected(): Promise<void> {
    return this.ready;
  }

  write(chunk: Buffer): Promise<void> {
    return this.flushed(this.request.write(chunk));
  }

  /** The last bytes; a failure from here on surfaces through `response`. */
  end(chunk: Buffer): void {
    if (this.request.destroyed) throw new Error('REQUEST_CLOSED');
    this.request.end(chunk);
  }

  destroy(): void {
    this.request.destroy();
  }

  /** Resolves once the socket can take more (or the provider answered); rejects when the request failed or closed. */
  private flushed(accepted: boolean): Promise<void> {
    const request = this.request;
    if (request.destroyed) return Promise.reject(new Error('REQUEST_CLOSED'));
    if (accepted || this.answer !== null) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const done = () => { off(); resolve(); };
      const fail = (error?: Error) => { off(); reject(error ?? new Error('REQUEST_CLOSED')); };
      const closed = () => fail();
      const off = () => {
        request.off('drain', done).off('response', done).off('error', fail).off('close', closed);
      };
      request.once('drain', done).once('response', done).once('error', fail).once('close', closed);
    });
  }
}

export class SpeechmaticsBatchJobsAdapter implements BatchTranscriptionJobs {
  readonly provider = 'SPEECHMATICS' as const;
  private readonly limiter: RateLimiter;

  constructor(
    private readonly config: SpeechmaticsBatchConfig & { readonly apiKey: string },
    private readonly http: typeof fetch = fetch,
  ) {
    this.limiter = new RateLimiter({ create: config.createsPerSecond, read: config.readsPerSecond });
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { authorization: `Bearer ${this.config.apiKey}`, ...extra };
  }

  private url(path: string): string {
    return `${this.config.baseUrl}${path}`;
  }

  async submit(request: BatchSubmitRequest): Promise<SubmitOutcome> {
    if (!(await this.limiter.acquire('create', request.signal))) return { kind: 'NOT_SENT', failure: 'RATE_LIMITED' };
    const boundary = `qandeel-${request.reference.replace(/[^0-9a-f]/giu, '')}`;
    const config = JSON.stringify({
      type: 'transcription',
      transcription_config: { language: request.language, operating_point: 'enhanced' },
      tracking: { reference: request.reference },
    });
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="config"\r\n\r\n${config}\r\n`
      + `--${boundary}\r\nContent-Disposition: form-data; name="data_file"; filename="note.m4a"\r\nContent-Type: ${request.contentType}\r\n\r\n`,
      'utf8',
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const url = new URL(this.url('/v2/jobs/'));
    const iterator = request.audio[Symbol.asyncIterator]();
    // node's https verifies the provider's certificate and host name by default: no agent, CA or check is passed here.
    const post = new StreamedPost((url.protocol === 'https:' ? nodeHttps : nodeHttp).request(url, {
      method: 'POST',
      headers: this.headers({
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': String(head.length + request.byteSize + tail.length),
      }),
      signal: request.signal,
    }), url.protocol === 'https:');
    let response: nodeHttp.IncomingMessage;
    let whole = false;
    try {
      await post.connected();
      await post.write(head);
      let streamed = 0;
      while (post.answer === null) {
        const next = await iterator.next();
        if (next.done) {
          // The declared size is exact; a short note is never sent as if it were whole.
          if (streamed !== request.byteSize) throw new Error('NOTE_SIZE_MISMATCH');
          post.end(tail);
          whole = true;
          break;
        }
        streamed += next.value.length;
        // Nor a long one: not one byte beyond the declared size is written.
        if (streamed > request.byteSize) throw new Error('NOTE_SIZE_MISMATCH');
        await post.write(next.value);
      }
      response = await post.response;
    } catch (error) {
      if (post.answer === null) {
        post.destroy();
        await iterator.return?.().catch(() => undefined);
        // Nothing is written before the connection (and TLS) is up, so a failure before then proves that no byte reached
        // the provider. Anything after may have reached it.
        return !post.wasConnected || neverConnected(error) ? { kind: 'NOT_SENT', failure: 'NETWORK' } : { kind: 'UNKNOWN' };
      }
      response = post.answer; // the provider answered, then stopped reading the body: its answer decides
    }
    if (!whole) {
      // An early answer: the rest of the note is never sent, and the half-written request is closed.
      await iterator.return?.().catch(() => undefined);
    }
    const status = response.statusCode ?? 0;
    if (status === 201 || status === 200) {
      const id = await readNodeJson(response).then((json) => (json && isJobId(json.id) ? json.id : null)).catch(() => null);
      if (!whole) post.destroy();
      return id ? { kind: 'CREATED', jobId: id as ProviderJobId } : { kind: 'UNKNOWN' };
    }
    response.on('error', () => undefined).resume();
    if (!whole) post.destroy();
    if (status === 429 || status === 503) {
      const header = response.headers['retry-after'];
      const after = retryAfterMs(typeof header === 'string' ? header : null);
      if (after !== undefined) this.limiter.pause('create', after);
      return { kind: 'NOT_SENT', failure: status === 429 ? 'RATE_LIMITED' : 'UNAVAILABLE', ...(after !== undefined ? { retryAfterMs: after } : {}) };
    }
    if (status === 401 || status === 403) return { kind: 'REJECTED', failure: 'AUTH' };
    if (status === 413) return { kind: 'REJECTED', failure: 'TOO_LARGE' };
    if (status === 415) return { kind: 'REJECTED', failure: 'UNSUPPORTED_AUDIO' };
    if (status === 400 || status === 422) return { kind: 'REJECTED', failure: 'CONFIG_REJECTED' };
    // Any other answer (another 5xx, a redirect, an unexpected code) may follow a created job: never "not created".
    return { kind: 'UNKNOWN' };
  }

  async status(jobId: ProviderJobId, signal: AbortSignal): Promise<JobStatus> {
    const answer = await this.read(`/v2/jobs/${encodeURIComponent(jobId)}`, 'GET', signal);
    if (answer.kind !== 'RESPONSE') return answer.kind === 'ABSENT' ? { kind: 'ABSENT' } : { kind: 'TRANSIENT', failure: answer.kind === 'TRANSIENT' ? answer.failure : 'UNAVAILABLE' };
    const json = await readJson(answer.response).catch(() => null);
    const state = json?.job?.status;
    if (state === 'running') return { kind: 'RUNNING' };
    if (state === 'done') return { kind: 'DONE' };
    if (state === 'rejected') return { kind: 'FAILED', failure: 'UNSUPPORTED_AUDIO' };
    if (state === 'deleted' || state === 'expired') return { kind: 'ABSENT' };
    return { kind: 'TRANSIENT', failure: 'UNAVAILABLE' };
  }

  async fetchResult(jobId: ProviderJobId, signal: AbortSignal): Promise<FetchOutcome> {
    const answer = await this.read(`/v2/jobs/${encodeURIComponent(jobId)}/transcript?format=json-v2`, 'GET', signal);
    if (answer.kind !== 'RESPONSE') return answer.kind === 'ABSENT' ? { kind: 'ABSENT' } : { kind: 'TRANSIENT', failure: answer.kind === 'TRANSIENT' ? answer.failure : 'UNAVAILABLE' };
    const json = await readJson(answer.response).catch(() => undefined);
    if (json === undefined) return { kind: 'MALFORMED' };
    return parseJsonV2(json);
  }

  async remove(jobId: ProviderJobId, signal: AbortSignal): Promise<RemovalOutcome> {
    const answer = await this.read(`/v2/jobs/${encodeURIComponent(jobId)}`, 'DELETE', signal);
    if (answer.kind === 'ABSENT') return { kind: 'ABSENT' };
    if (answer.kind === 'LOCKED') return { kind: 'LOCKED' };
    if (answer.kind !== 'RESPONSE') return { kind: 'TRANSIENT', failure: answer.failure };
    await discard(answer.response);
    return { kind: 'REQUESTED' };
  }

  async findByReference(reference: string, signal: AbortSignal): Promise<FindOutcome> {
    if (!this.config.reconcileByReference) return { kind: 'UNSUPPORTED' };
    let before: string | null = null;
    for (let page = 0; page < LIST_PAGES; page += 1) {
      const query = `?limit=${LIST_PAGE}${before ? `&created_before=${encodeURIComponent(before)}` : ''}`;
      const answer = await this.read(`/v2/jobs/${query}`, 'GET', signal);
      if (answer.kind !== 'RESPONSE') return { kind: 'TRANSIENT', failure: answer.kind === 'TRANSIENT' ? answer.failure : 'UNAVAILABLE' };
      const json = await readJson(answer.response).catch(() => null);
      const jobs: unknown[] | null = Array.isArray(json?.jobs) ? json.jobs : null;
      if (!jobs) return { kind: 'TRANSIENT', failure: 'UNAVAILABLE' };
      for (const job of jobs as { id?: unknown; created_at?: unknown; tracking?: { reference?: unknown } }[]) {
        if (job?.tracking?.reference === reference && isJobId(job.id)) return { kind: 'FOUND', jobId: job.id as ProviderJobId };
      }
      if (jobs.length < LIST_PAGE) return { kind: 'NOT_FOUND_IN_COMPLETE_LISTING' };
      const last = jobs[jobs.length - 1] as { created_at?: unknown };
      if (typeof last?.created_at !== 'string') return { kind: 'TRANSIENT', failure: 'UNAVAILABLE' };
      before = last.created_at;
    }
    return { kind: 'TRANSIENT', failure: 'UNAVAILABLE' }; // the listing was not read to its end: nothing is concluded
  }

  /** One read lane request, retried once on a network error only. */
  private async read(path: string, method: 'GET' | 'DELETE', signal: AbortSignal): Promise<
    | { kind: 'RESPONSE'; response: Response }
    | { kind: 'ABSENT' }
    | { kind: 'LOCKED' }
    | { kind: 'TRANSIENT'; failure: BatchFailure }
  > {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (!(await this.limiter.acquire('read', signal))) return { kind: 'TRANSIENT', failure: signal.aborted ? 'TIMEOUT' : 'RATE_LIMITED' };
      let response: Response;
      try {
        response = await this.http(this.url(path), { method, headers: this.headers(), signal });
      } catch (error) {
        if (isTimeout(error) || signal.aborted) return { kind: 'TRANSIENT', failure: 'TIMEOUT' };
        if (attempt === 0) continue;
        return { kind: 'TRANSIENT', failure: 'NETWORK' };
      }
      if (response.ok) return { kind: 'RESPONSE', response };
      await discard(response);
      if (response.status === 404 || response.status === 410) return { kind: 'ABSENT' };
      if (response.status === 423) return { kind: 'LOCKED' };
      if (response.status === 401 || response.status === 403) return { kind: 'TRANSIENT', failure: 'AUTH' };
      if (response.status === 429) {
        const after = retryAfterMs(response.headers.get('retry-after'));
        if (after !== undefined) this.limiter.pause('read', after);
      }
      return { kind: 'TRANSIENT', failure: transientOf(response.status) };
    }
    return { kind: 'TRANSIENT', failure: 'NETWORK' };
  }
}

/** json-v2: the words (type `word`, first alternative), punctuation excluded; the provider's duration when reported. */
export function parseJsonV2(json: unknown): FetchOutcome {
  const document = json as { results?: unknown; job?: { duration?: unknown } } | null;
  if (!document || !Array.isArray(document.results)) return { kind: 'MALFORMED' };
  const words: RecognizedWord[] = [];
  for (const result of document.results as { type?: unknown; start_time?: unknown; end_time?: unknown; alternatives?: unknown }[]) {
    if (!result || typeof result !== 'object') return { kind: 'MALFORMED' };
    if (result.type !== 'word') continue;
    const first = Array.isArray(result.alternatives) ? (result.alternatives[0] as { content?: unknown; confidence?: unknown } | undefined) : undefined;
    if (!first || typeof first.content !== 'string' || typeof result.start_time !== 'number' || typeof result.end_time !== 'number') return { kind: 'MALFORMED' };
    if (!(result.start_time >= 0) || !(result.end_time >= result.start_time)) return { kind: 'MALFORMED' };
    const confidence = typeof first.confidence === 'number' && Number.isFinite(first.confidence) ? first.confidence : null;
    words.push({ text: first.content, confidence, startMs: Math.round(result.start_time * 1000), endMs: Math.round(result.end_time * 1000) });
  }
  const duration = document.job?.duration;
  return { kind: 'RESULT', words, providerDurationMs: typeof duration === 'number' && Number.isFinite(duration) && duration >= 0 ? Math.round(duration * 1000) : null };
}

/** Reads a bounded JSON body; anything larger or unreadable is refused. */
async function readJson(response: Response): Promise<any> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_RESULT_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error('RESPONSE_TOO_LARGE');
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** The same bound for the upload's answer, read from node's response stream. */
async function readNodeJson(response: nodeHttp.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > MAX_RESULT_BYTES) {
      response.destroy();
      throw new Error('RESPONSE_TOO_LARGE');
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function discard(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}
