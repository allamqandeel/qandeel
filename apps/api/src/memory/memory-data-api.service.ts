import { Injectable, ServiceUnavailableException } from '@nestjs/common';

// QHIA-011A Fix 01: the structured upstream failure identity this transport
// preserves.
//
// Deliberately EXACTLY three facts: the HTTP status, and the PostgREST /
// PostgreSQL `code` and `message`. `details`, `hint`, the raw response body,
// the request headers, the caller access token, and the publishable key are
// never captured, so no secret and no request payload can be carried into an
// error object, a log line, or an error reporter. The generic
// `Error.message` of MemoryDataApiError is unchanged, so nothing that already
// logs or reports these errors starts emitting database text.
//
// A string is only accepted when it is non-empty and within a small bound: an
// oversized or non-string field is treated as absent, which fails closed
// everywhere the identity is read.
const MAX_UPSTREAM_IDENTITY_LENGTH = 256;

export class MemoryDataApiError extends Error {
  constructor(
    readonly status: number,
    readonly upstreamCode?: string,
    readonly upstreamMessage?: string,
  ) {
    super(`Memory Data API request failed with status ${status}.`);
  }
}

function upstreamIdentity(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_UPSTREAM_IDENTITY_LENGTH
    ? value
    : undefined;
}

// A malformed, empty, or non-JSON error body NEVER replaces the original
// transport failure: the status is still reported and the structured identity
// is simply unavailable.
async function readUpstreamFailureIdentity(response: Response): Promise<[string | undefined, string | undefined]> {
  try {
    const body: unknown = await response.json();
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return [undefined, undefined];
    const record = body as Record<string, unknown>;
    return [upstreamIdentity(record.code), upstreamIdentity(record.message)];
  } catch {
    return [undefined, undefined];
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
      const [upstreamCode, upstreamMessage] = await readUpstreamFailureIdentity(response);
      throw new MemoryDataApiError(response.status, upstreamCode, upstreamMessage);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
