import { Injectable, ServiceUnavailableException } from '@nestjs/common';

/**
 * T-03B1b2 - the bounded, OPAQUE upstream failure identity of a Data API
 * transport error: the PostgREST/PostgreSQL `code` (SQLSTATE or PostgREST
 * code) and `message`, when the error body carried them as strings.
 *
 * It exists so a server-internal caller can distinguish ONE exact database
 * condition (the integrated focus coordinator's
 * `STALE_CONVERSATIONAL_FOCUS_CONTEXT`, SQLSTATE 40001) from a generic HTTP
 * failure. It is stored opaquely - never as a property of the error - so no
 * serializer, logger, reporter or user-facing response can reach the raw
 * database detail; only the narrow accessor below returns a copy.
 */
export interface DataApiUpstreamIdentity {
  readonly databaseCode?: string;
  readonly databaseMessage?: string;
}

const MAX_UPSTREAM_IDENTITY_LENGTH = 512;
const upstreamFailureIdentity = new WeakMap<DataApiError, DataApiUpstreamIdentity>();

export class DataApiError extends Error {
  /** `status` alone remains the whole public surface; the identity is additive and optional. */
  constructor(readonly status: number, identity?: DataApiUpstreamIdentity) {
    super(`Data API request failed with status ${status}.`);
    upstreamFailureIdentity.set(this, Object.freeze({
      ...(typeof identity?.databaseCode === 'string' ? { databaseCode: identity.databaseCode } : {}),
      ...(typeof identity?.databaseMessage === 'string' ? { databaseMessage: identity.databaseMessage } : {}),
    }));
  }
}

/** A fresh copy of the opaque identity; a status-only error has none. */
export function readDataApiUpstreamIdentity(error: DataApiError): DataApiUpstreamIdentity {
  const identity = upstreamFailureIdentity.get(error);
  return identity ? { ...identity } : {};
}

function boundedIdentityValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_UPSTREAM_IDENTITY_LENGTH ? value : undefined;
}

/**
 * Parses only the two bounded string fields from a PostgREST error body. A
 * malformed, empty or non-JSON body NEVER replaces the original transport
 * failure: the status is still reported and the identity is simply absent.
 */
export async function parseDataApiUpstreamIdentity(response: Response): Promise<DataApiUpstreamIdentity> {
  try {
    const body: unknown = await response.json();
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return {};
    const record = body as Record<string, unknown>;
    const databaseCode = boundedIdentityValue(record.code);
    const databaseMessage = boundedIdentityValue(record.message);
    return {
      ...(databaseCode !== undefined ? { databaseCode } : {}),
      ...(databaseMessage !== undefined ? { databaseMessage } : {}),
    };
  } catch {
    return {};
  }
}

@Injectable()
export class SupabaseDataApiService {
  async request<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!baseUrl || !publishableKey) {
      throw new ServiceUnavailableException('Conversation persistence is not configured.');
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
      throw new ServiceUnavailableException('Conversation persistence is unavailable.');
    }
    if (!response.ok) throw new DataApiError(response.status, await parseDataApiUpstreamIdentity(response));
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
