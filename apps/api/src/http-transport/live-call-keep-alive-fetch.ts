import { Agent, request as httpsRequest, type RequestOptions } from 'node:https';
import type { ClientRequest, IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';

/**
 * S8B-05 CP2 (contract §5, L1) — the live call's OWN keep-alive HTTPS transport: one dedicated agent whose warm
 * connections serve only the call's reply generation and the call's reply synthesis. Background work (post-response
 * intelligence, structured adapters, voice notes) keeps the process default and never queues in front of a spoken reply,
 * and a call reply never waits behind it.
 *
 * It is a `fetch` because the two callers already take one (the DeepSeek SDK client and the Vertex speech adapter). It
 * implements only what they send: a URL or a string, a method, headers, a string or byte body and an AbortSignal. It never
 * follows a redirect (a 3xx is returned as itself, so `redirect: 'error'` callers still refuse it) and it asks for an
 * identity encoding, so the body is the provider's bytes. Nothing here reads, keeps or logs a body.
 */
export const LIVE_CALL_KEEP_ALIVE = { maxSockets: 8, maxFreeSockets: 4, keepAliveMsecs: 15_000, freeSocketTimeoutMs: 30_000 } as const;

type HttpsRequest = (url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => ClientRequest;

export function liveCallKeepAliveAgent(): Agent {
  return new Agent({
    keepAlive: true,
    keepAliveMsecs: LIVE_CALL_KEEP_ALIVE.keepAliveMsecs,
    maxSockets: LIVE_CALL_KEEP_ALIVE.maxSockets,
    maxFreeSockets: LIVE_CALL_KEEP_ALIVE.maxFreeSockets,
    timeout: LIVE_CALL_KEEP_ALIVE.freeSocketTimeoutMs,
    scheduling: 'lifo',
  });
}

const abortError = (): Error => Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
const NO_BODY_STATUS = new Set([101, 204, 205, 304]);

function bodyBytes(body: unknown): Buffer | null {
  if (body === undefined || body === null) return null;
  if (typeof body === 'string') return Buffer.from(body, 'utf8');
  if (body instanceof Uint8Array) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  throw new TypeError('LIVE_CALL_FETCH_BODY_UNSUPPORTED');
}

export function liveCallKeepAliveFetch(agent: Agent = liveCallKeepAliveAgent(), requestImpl: HttpsRequest = httpsRequest): typeof fetch {
  const keepAliveFetch = (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    if (input instanceof Request) return Promise.reject(new TypeError('LIVE_CALL_FETCH_REQUEST_UNSUPPORTED'));
    const url = new URL(String(input));
    if (url.protocol !== 'https:') return Promise.reject(new TypeError('LIVE_CALL_FETCH_HTTPS_ONLY'));
    const signal = init.signal ?? undefined;
    if (signal?.aborted) return Promise.reject(abortError());
    let body: Buffer | null;
    try {
      body = bodyBytes(init.body);
    } catch (error) {
      return Promise.reject(error);
    }
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, name) => { headers[name] = value; });
    headers['accept-encoding'] = 'identity';
    if (body) headers['content-length'] = String(body.byteLength);

    return new Promise<Response>((resolve, reject) => {
      let settled = false;
      const request = requestImpl(url, { method: init.method ?? 'GET', headers, agent }, (response) => {
        settled = true;
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) value.forEach((item) => responseHeaders.append(name, item));
          else if (value !== undefined) responseHeaders.set(name, value);
        }
        const status = response.statusCode ?? 502;
        const onAbort = (): void => { response.destroy(abortError()); };
        signal?.addEventListener('abort', onAbort, { once: true });
        response.once('close', () => signal?.removeEventListener('abort', onAbort));
        if (NO_BODY_STATUS.has(status)) {
          response.resume();
          resolve(new Response(null, { status, headers: responseHeaders }));
          return;
        }
        resolve(new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, { status, headers: responseHeaders }));
      });
      const onAbort = (): void => {
        request.destroy(abortError());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      request.once('close', () => signal?.removeEventListener('abort', onAbort));
      request.once('error', (error) => {
        if (!settled) {
          settled = true;
          reject(signal?.aborted ? abortError() : error);
        }
      });
      request.end(body ?? undefined);
    });
  };
  return keepAliveFetch as typeof fetch;
}

let processLiveCallFetch: typeof fetch | undefined;

/** The ONE process-wide live call transport: the call's reply generation and its reply synthesis share its warm pool. */
export function liveCallFetch(): typeof fetch {
  processLiveCallFetch ??= liveCallKeepAliveFetch();
  return processLiveCallFetch;
}
