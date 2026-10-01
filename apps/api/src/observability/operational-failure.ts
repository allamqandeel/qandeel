import { ServiceUnavailableException } from '@nestjs/common';
import { DataApiError } from '../conversation/supabase-data-api.service';

/**
 * PROD-OPS-01 — the closed class of a failure that a background operation catches and survives.
 *
 * Only the KIND of an error decides it, never its message: no exception text, status text, database code or upstream
 * body can reach a metric label through here, so the result is one of exactly two values.
 *
 *   TRANSPORT  the dependency could not be reached or answered with a server-side / capacity refusal: the server channel
 *              unconfigured or unreachable, a fetch that failed or timed out, a Data API 408 / 429 / 5xx;
 *   INTEGRITY  anything else: a Data API 4xx refusal, a malformed answer, an invariant the code itself refused.
 */
export type OperationalFailureClass = 'TRANSPORT' | 'INTEGRITY';

export function classifyOperationalFailure(error: unknown): OperationalFailureClass {
  if (error instanceof ServiceUnavailableException) return 'TRANSPORT';
  if (error instanceof DataApiError) return error.status >= 500 || error.status === 408 || error.status === 429 ? 'TRANSPORT' : 'INTEGRITY';
  const name = error !== null && typeof error === 'object' && 'name' in error ? (error as { name?: unknown }).name : undefined;
  if (name === 'TimeoutError' || name === 'AbortError') return 'TRANSPORT';
  // undici reports an unreachable endpoint as a TypeError carrying the network error as its cause; a TypeError without
  // a cause is a defect in our own code, and stays INTEGRITY.
  if (error instanceof TypeError && error.cause !== undefined) return 'TRANSPORT';
  return 'INTEGRITY';
}
