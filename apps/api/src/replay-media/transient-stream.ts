import type { ServerResponse } from 'node:http';
import { Transform, type Readable, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/**
 * S8B-07 CP1-B (contract §15, §19.1) — one bounded response of a processing file, and its termination.
 *
 * A response ends at the FIRST of:
 *   SOURCE_END   the database's `serve_until`, armed as a timer for `serve_until − db_now` (database time, no skew);
 *   RECHECK      the in-stream re-check (every 5 s; the first 5 s after the response starts) refusing, failing, or not
 *                answering within 2 s (fail-closed): an early deletion, an account erasure, a release elsewhere or a
 *                version leaving CURRENT, committed through ANY instance;
 *   LIFETIME     the response lifetime cap (10 min), so no single request ever spans a whole recording: the phone
 *                resumes with Range from its exact position (V-35);
 *   IDLE         nothing sent for 30 s;
 *   CLIENT_GONE  the client left;
 *   STORE_FAILED the store's body failed;
 * or it COMPLETEs. Every termination DESTROYS the response (a socket reset), never a clean `end()` a player could read as
 * the end of the media; the gate in front of the socket forwards nothing after the termination instant, and counts what
 * it refused (V-32's instrumented counter, which stays 0 by construction). Nothing is logged.
 */
export type StreamTermination = 'SOURCE_END' | 'RECHECK' | 'LIFETIME' | 'IDLE' | 'CLIENT_GONE' | 'STORE_FAILED';
export type StreamOutcome = 'COMPLETE' | StreamTermination;

export interface TransientStreamTiming {
  /** The response lifetime cap (contract §19.1: 10 min). */
  readonly lifetimeMs: number;
  /** The in-stream re-check period and its fail-closed answer budget (A-2: 5 s and 2 s, initial and configurable). */
  readonly recheckEveryMs: number;
  readonly recheckTimeoutMs: number;
  readonly idleMs: number;
}

export const DEFAULT_STREAM_TIMING: TransientStreamTiming = {
  lifetimeMs: 600_000, recheckEveryMs: 5_000, recheckTimeoutMs: 2_000, idleMs: 30_000,
};

/** Content-free facts of one response, for the V-32 / V-35 proofs (bytes and instants only; never a key or an id). */
export interface StreamReport {
  readonly outcome: StreamOutcome;
  readonly bytesSent: number;
  readonly bytesRefusedAfterTermination: number;
  /** `Date.now()` at the termination instant (or the completion). */
  readonly endedAt: number;
}

export interface OpenedTransient {
  readonly status: 200 | 206;
  readonly contentLength: number;
  readonly contentRange: string | null;
  readonly body: Readable;
  /** `serve_until − db_now`, read by this request. */
  readonly serveForMs: number;
}

function boundedInteger(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];
  const n = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer in [${min}, ${max}]`);
  return n;
}

/** The timing from the environment, each within its bound (the 10 min cap is a maximum: a lower value only cuts sooner). */
export function streamTimingFrom(env: NodeJS.ProcessEnv): TransientStreamTiming {
  return {
    lifetimeMs: boundedInteger(env, 'REPLAY_RESPONSE_LIFETIME_MS', DEFAULT_STREAM_TIMING.lifetimeMs, 1_000, 600_000),
    recheckEveryMs: boundedInteger(env, 'REPLAY_STREAM_RECHECK_MS', DEFAULT_STREAM_TIMING.recheckEveryMs, 1_000, 10_000),
    recheckTimeoutMs: boundedInteger(env, 'REPLAY_STREAM_RECHECK_TIMEOUT_MS', DEFAULT_STREAM_TIMING.recheckTimeoutMs, 500, 5_000),
    idleMs: DEFAULT_STREAM_TIMING.idleMs,
  };
}

/** A re-check that answers false on a refusal, an error, or no answer within `timeoutMs` (fail-closed). */
export function boundedRecheck(check: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  return Promise.race([check().then((ok) => ok === true, () => false), late]).finally(() => clearTimeout(timer));
}

/**
 * Sends one opened processing file. `Cache-Control: no-store, private` is set by the caller first; there is never a
 * Content-Disposition. Resolves with the response's content-free report once it completed or was terminated.
 */
export async function streamTransient(response: ServerResponse, opened: OpenedTransient, timing: TransientStreamTiming,
  recheck: () => Promise<boolean>): Promise<StreamReport> {
  let ended: StreamOutcome | null = null;
  let endedAt = 0;
  let bytesSent = 0;
  let bytesRefused = 0;
  const timers: NodeJS.Timeout[] = [];
  let idle: NodeJS.Timeout | null = null;
  let checking = false;

  const gate = new Transform({
    transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback) {
      if (ended !== null) {
        bytesRefused += chunk.length;
        done();
        return;
      }
      bytesSent += chunk.length;
      idle?.refresh();
      done(null, chunk);
    },
  });
  const stopTimers = () => {
    for (const t of timers) clearTimeout(t);
    if (idle) clearTimeout(idle);
  };
  const terminate = (cause: StreamTermination) => {
    if (ended !== null) return;
    ended = cause;
    endedAt = Date.now();
    stopTimers();
    opened.body.destroy();
    gate.destroy();
    response.destroy();
  };

  response.statusCode = opened.status;
  response.setHeader('Content-Type', 'audio/mp4');
  response.setHeader('Content-Length', String(opened.contentLength));
  response.setHeader('Accept-Ranges', 'bytes');
  if (opened.contentRange !== null) response.setHeader('Content-Range', opened.contentRange);
  response.once('close', () => {
    if (!response.writableFinished) terminate('CLIENT_GONE');
  });

  timers.push(setTimeout(() => terminate('SOURCE_END'), Math.max(0, opened.serveForMs)));
  timers.push(setTimeout(() => terminate('LIFETIME'), timing.lifetimeMs));
  const tick = () => {
    if (ended !== null) return;
    if (!checking) {
      checking = true;
      void boundedRecheck(recheck, timing.recheckTimeoutMs).then((ok) => {
        checking = false;
        if (!ok) terminate('RECHECK');
      });
    }
    timers.push(setTimeout(tick, timing.recheckEveryMs));
  };
  timers.push(setTimeout(tick, timing.recheckEveryMs));
  idle = setTimeout(() => terminate('IDLE'), timing.idleMs);

  await pipeline(opened.body, gate, response).then(() => {
    if (ended === null) {
      ended = 'COMPLETE';
      endedAt = Date.now();
    }
  }, () => {
    // A store failure mid-body, or the termination above: the headers are sent, so the connection is cut.
    terminate('STORE_FAILED');
  });
  stopTimers();
  return { outcome: ended ?? 'STORE_FAILED', bytesSent, bytesRefusedAfterTermination: bytesRefused, endedAt };
}
