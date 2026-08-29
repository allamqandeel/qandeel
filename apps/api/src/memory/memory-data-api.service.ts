import { Injectable, ServiceUnavailableException } from '@nestjs/common';

// QHIA-011A Fix 02: the structured upstream failure identity is OPAQUE.
//
// A failed PostgREST request preserves exactly three facts: the HTTP status,
// which stays an ordinary property because it carries no database text, and the
// upstream `code` and `message`, which do NOT live on the error object at all.
// They are held in module-private WeakMap storage keyed by the exact error
// instance, so ordinary JavaScript reflection, serialization and logging cannot
// discover them:
//
//   Object.keys / Object.entries / Object.getOwnPropertyNames,
//   JSON.stringify(error) / JSON.stringify({ error }),
//   { ...error } / Object.assign({}, error),
//   util.inspect(error) - including showHidden,
//   error.message / error.stack / String(error),
//   and every Nest logger and Sentry serialization path built on those.
//
// This is a REPRESENTATION fix, not a redaction fix: nothing depends on logger
// configuration, on the global exception filter, or on the Sentry sanitizer to
// keep database text out of an outward channel. Those boundaries are unchanged
// and are separately frozen by their own non-leakage proofs.
//
// `details`, `hint`, the raw response body, the request headers, the caller
// access token and the publishable key are never captured at all. A string is
// accepted only when it is non-empty and within a small bound, so an oversized
// or non-string field is treated as absent, which fails closed everywhere the
// identity is read.
const MAX_UPSTREAM_IDENTITY_LENGTH = 256;

export type MemoryDataApiUpstreamIdentity = Readonly<{ code?: string; message?: string }>;

// Module-private and never exported: there is no way to enumerate it, no
// registry of errors, and no strong reference to any error instance, so an
// error becomes collectable exactly when its last real reference goes away.
const upstreamFailureIdentity = new WeakMap<MemoryDataApiError, MemoryDataApiUpstreamIdentity>();

export class MemoryDataApiError extends Error {
  constructor(readonly status: number, identity?: MemoryDataApiUpstreamIdentity) {
    super(`Memory Data API request failed with status ${status}.`);
    // Only string values are ever stored, whatever a caller passes, and the
    // stored record is frozen so no later holder can mutate it.
    upstreamFailureIdentity.set(this, Object.freeze({
      ...(typeof identity?.code === 'string' ? { code: identity.code } : {}),
      ...(typeof identity?.message === 'string' ? { message: identity.message } : {}),
    }));
  }
}

/**
 * QHIA-011A Fix 02: the ONE narrow accessor for the opaque upstream identity.
 *
 * Its only sanctioned production caller is the QHIA-011A activation mapper
 * (ConversationContextActivationService), which compares the identity against
 * an exact frozen allowlist and returns a sanitized product failure. It exists
 * for that semantic comparison and for nothing else: no logging helper, no
 * telemetry enricher, no Sentry enricher, no error-inspection middleware, and
 * no generic domain mapper may read it. A static contract enforces that scope.
 *
 * Each call returns a fresh copy, so a caller can never mutate what is stored,
 * and a non-transport error (or a spread/cloned object that is no longer the
 * exact instance) simply has no identity.
 */
export function readMemoryDataApiUpstreamIdentity(error: MemoryDataApiError): MemoryDataApiUpstreamIdentity {
  const identity = upstreamFailureIdentity.get(error);
  return identity ? { ...identity } : {};
}

function boundedIdentityValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_UPSTREAM_IDENTITY_LENGTH
    ? value
    : undefined;
}

// A malformed, empty, or non-JSON error body NEVER replaces the original
// transport failure: the status is still reported and the structured identity
// is simply unavailable.
async function parseUpstreamFailureIdentity(response: Response): Promise<MemoryDataApiUpstreamIdentity> {
  try {
    const body: unknown = await response.json();
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return {};
    const record = body as Record<string, unknown>;
    const code = boundedIdentityValue(record.code);
    const message = boundedIdentityValue(record.message);
    return { ...(code !== undefined ? { code } : {}), ...(message !== undefined ? { message } : {}) };
  } catch {
    return {};
  }
}

@Injectable()
export class MemoryDataApiService {
  async request<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!baseUrl || !publishableKey) {
      throw new ServiceUnavailableException('Memory persistence is not configured.');
    }
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/rest/v1/${path}`, {
        ...init,
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException('Memory persistence is unavailable.');
    }
    if (!response.ok) {
      throw new MemoryDataApiError(response.status, await parseUpstreamFailureIdentity(response));
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
