/**
 * S7-04 — the client for the three Personal Replay lifecycle commands of the S7-01 boundary (migration 0169), and
 * nothing else:
 *
 *   POST /replay/:replayId/preview  { commandId, expectedDraftRevision } — PREVIEW_READY | a bounded refusal
 *   POST /replay/:replayId/finalize { commandId, expectedVersionId }     — FINALIZED     | a bounded refusal
 *   POST /replay/:replayId/reopen   { commandId, expectedVersionId }     — the reopen word | a bounded refusal
 *
 * A transport and nothing else, exactly like the S7-02 `ReplayApiClient` beside it: no credential of its own (the AC-01
 * request-time seam its caller hands it), no user id, no owner, no Session, no state, no retry and no persistence. It
 * decodes STRICTLY: an extra field, a missing one or an unknown word makes the answer unusable.
 *
 * FINALIZED is private: there is no share, publish, export or distribution route here, and none exists on the server.
 *
 * ## The one ambiguity it refuses to hide
 *
 * A command that did not return a readable answer — the network dropped, the server answered 5xx, or the body could not
 * be read — may or may not have committed. That is `OUTCOME_UNKNOWN`, never "not done" and never "done". Only the caller,
 * holding the command's own id, can resolve it: by re-issuing the SAME command under the SAME id and the SAME body, which
 * the server answers from its committed history. A `4xx` is refused before anything is written.
 */
import { CredentialUnavailableError } from './auth/request-credential';
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';
import type { ReplayLifecycleView } from './replay-api';

export interface ReplayLifecycleApiConfig {
  /** Origin plus any base path, without a trailing slash. */
  readonly baseUrl: string;
  /** Always the AC-01 authorized seam in production: the bearer is decided at each request. */
  readonly fetch: RuntimeHttpFetch;
}

/** The bounded refusal words of the three lifecycle commands (migration 0169 §3), each command's own set. */
export type ReplayPreviewRefusal =
  | 'NOT_AVAILABLE_NOW' | 'UNAVAILABLE' | 'CHANGED' | 'SOURCE_CHANGED' | 'MOMENT_NOT_SEALED' | 'ANALYSIS_UNAVAILABLE'
  | 'SELECTION_NOT_SUPPORTED' | 'LIFECYCLE_NOT_ELIGIBLE' | 'COMMAND_CONFLICT';
export type ReplayFinalizeRefusal =
  | 'NOT_AVAILABLE_NOW' | 'UNAVAILABLE' | 'CHANGED' | 'SOURCE_CHANGED' | 'ANALYSIS_CHANGED' | 'SELECTION_NOT_SUPPORTED'
  | 'LIFECYCLE_NOT_ELIGIBLE' | 'COMMAND_CONFLICT';
export type ReplayReopenRefusal = 'NOT_AVAILABLE_NOW' | 'UNAVAILABLE' | 'CHANGED' | 'LIFECYCLE_NOT_ELIGIBLE' | 'COMMAND_CONFLICT';
export type ReplayLifecycleRefusal = ReplayPreviewRefusal | ReplayFinalizeRefusal | ReplayReopenRefusal;

export interface ReplayPreviewAnswer {
  readonly outcome: 'PREVIEW_READY';
  readonly replayId: string;
  readonly versionId: string;
  readonly versionRevision: number;
  readonly momentCount: number;
  readonly temporalDiscontinuityCount: number;
}
export interface ReplayFinalizeAnswer {
  readonly outcome: 'FINALIZED';
  readonly replayId: string;
  readonly versionId: string;
  readonly versionRevision: number;
}
export interface ReplayReopenAnswer {
  readonly outcome: 'REOPENED';
  readonly replayId: string;
  readonly lifecycle: ReplayLifecycleView;
  readonly reopenedFromVersionId: string;
}
export type ReplayLifecycleAnswer = ReplayPreviewAnswer | ReplayFinalizeAnswer | ReplayReopenAnswer;

export type ReplayLifecycleResult<A extends ReplayLifecycleAnswer, R extends ReplayLifecycleRefusal> =
  | { readonly kind: 'ANSWERED'; readonly answer: A }
  | { readonly kind: 'REFUSED_BY_SERVER'; readonly refusal: R }
  /** Refused before admission (`4xx`), or never issued (the credential seam refused it). Nothing was written. */
  | { readonly kind: 'NOT_ADMITTED' }
  /** The command MAY have committed, and this response cannot say. See the module comment. */
  | { readonly kind: 'OUTCOME_UNKNOWN' };

export type ReplayPreviewResult = ReplayLifecycleResult<ReplayPreviewAnswer, ReplayPreviewRefusal>;
export type ReplayFinalizeResult = ReplayLifecycleResult<ReplayFinalizeAnswer, ReplayFinalizeRefusal>;
export type ReplayReopenResult = ReplayLifecycleResult<ReplayReopenAnswer, ReplayReopenRefusal>;

const PREVIEW_REFUSALS: readonly ReplayPreviewRefusal[] = ['NOT_AVAILABLE_NOW', 'UNAVAILABLE', 'CHANGED', 'SOURCE_CHANGED', 'MOMENT_NOT_SEALED',
  'ANALYSIS_UNAVAILABLE', 'SELECTION_NOT_SUPPORTED', 'LIFECYCLE_NOT_ELIGIBLE', 'COMMAND_CONFLICT'];
const FINALIZE_REFUSALS: readonly ReplayFinalizeRefusal[] = ['NOT_AVAILABLE_NOW', 'UNAVAILABLE', 'CHANGED', 'SOURCE_CHANGED', 'ANALYSIS_CHANGED',
  'SELECTION_NOT_SUPPORTED', 'LIFECYCLE_NOT_ELIGIBLE', 'COMMAND_CONFLICT'];
const REOPEN_REFUSALS: readonly ReplayReopenRefusal[] = ['NOT_AVAILABLE_NOW', 'UNAVAILABLE', 'CHANGED', 'LIFECYCLE_NOT_ELIGIBLE', 'COMMAND_CONFLICT'];
const LIFECYCLES: readonly ReplayLifecycleView[] = ['DRAFT', 'PREVIEW_READY', 'FINALIZED'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const INT4_MAX = 2147483647;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
};
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isPositive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= INT4_MAX;
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= INT4_MAX;
const isOneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T => typeof value === 'string' && (allowed as readonly string[]).includes(value);
/** An answer about another Replay is no answer about this one. */
const same = (value: unknown, replayId: string): value is string => isUuid(value) && value.toLowerCase() === replayId.toLowerCase();

/** One bounded word, alone in the body, from this command's own set; anything else is `null`. */
function refusalOf<R extends ReplayLifecycleRefusal>(value: Record<string, unknown>, allowed: readonly R[]): { kind: 'REFUSED_BY_SERVER'; refusal: R } | null {
  return hasExactly(value, ['outcome']) && isOneOf(value.outcome, allowed) ? { kind: 'REFUSED_BY_SERVER', refusal: value.outcome } : null;
}

export function decodePreviewCommand(value: unknown, replayId: string): ReplayPreviewResult | null {
  if (!isRecord(value)) return null;
  if (hasExactly(value, ['outcome'])) return refusalOf(value, PREVIEW_REFUSALS);
  if (!hasExactly(value, ['outcome', 'replayId', 'versionId', 'versionRevision', 'momentCount', 'temporalDiscontinuityCount']) || value.outcome !== 'PREVIEW_READY') return null;
  if (!same(value.replayId, replayId) || !isUuid(value.versionId) || !isPositive(value.versionRevision) || !isPositive(value.momentCount)
      || !isCount(value.temporalDiscontinuityCount)) return null;
  return {
    kind: 'ANSWERED',
    answer: Object.freeze({ outcome: 'PREVIEW_READY', replayId: value.replayId.toLowerCase(), versionId: value.versionId.toLowerCase(),
      versionRevision: value.versionRevision, momentCount: value.momentCount, temporalDiscontinuityCount: value.temporalDiscontinuityCount }),
  };
}

export function decodeFinalizeCommand(value: unknown, replayId: string): ReplayFinalizeResult | null {
  if (!isRecord(value)) return null;
  if (hasExactly(value, ['outcome'])) return refusalOf(value, FINALIZE_REFUSALS);
  if (!hasExactly(value, ['outcome', 'replayId', 'versionId', 'versionRevision']) || value.outcome !== 'FINALIZED') return null;
  if (!same(value.replayId, replayId) || !isUuid(value.versionId) || !isPositive(value.versionRevision)) return null;
  return {
    kind: 'ANSWERED',
    answer: Object.freeze({ outcome: 'FINALIZED', replayId: value.replayId.toLowerCase(), versionId: value.versionId.toLowerCase(), versionRevision: value.versionRevision }),
  };
}

export function decodeReopenCommand(value: unknown, replayId: string): ReplayReopenResult | null {
  if (!isRecord(value)) return null;
  if (hasExactly(value, ['outcome'])) return refusalOf(value, REOPEN_REFUSALS);
  if (!hasExactly(value, ['outcome', 'replayId', 'lifecycle', 'reopenedFromVersionId']) || value.outcome !== 'REOPENED') return null;
  if (!same(value.replayId, replayId) || !isOneOf(value.lifecycle, LIFECYCLES) || !isUuid(value.reopenedFromVersionId)) return null;
  return {
    kind: 'ANSWERED',
    answer: Object.freeze({ outcome: 'REOPENED', replayId: value.replayId.toLowerCase(), lifecycle: value.lifecycle,
      reopenedFromVersionId: value.reopenedFromVersionId.toLowerCase() }),
  };
}

type Exchange = { readonly kind: 'BODY'; readonly status: number; readonly body: unknown } | { readonly kind: 'NOT_ISSUED' } | { readonly kind: 'NETWORK' };

export class ReplayLifecycleApiClient {
  constructor(private readonly config: ReplayLifecycleApiConfig) {}

  /** Issued exactly once per call. Re-issuing the SAME command under the SAME id is the caller's decision. */
  preview(commandId: string, replayId: string, expectedDraftRevision: number): Promise<ReplayPreviewResult> {
    return this.command(replayId, 'preview', { commandId, expectedDraftRevision }, decodePreviewCommand);
  }

  finalize(commandId: string, replayId: string, expectedVersionId: string): Promise<ReplayFinalizeResult> {
    return this.command(replayId, 'finalize', { commandId, expectedVersionId }, decodeFinalizeCommand);
  }

  reopen(commandId: string, replayId: string, expectedVersionId: string): Promise<ReplayReopenResult> {
    return this.command(replayId, 'reopen', { commandId, expectedVersionId }, decodeReopenCommand);
  }

  private async command<T>(replayId: string, act: 'preview' | 'finalize' | 'reopen', payload: Record<string, unknown>,
    decode: (value: unknown, replayId: string) => T | null): Promise<T | { kind: 'NOT_ADMITTED' } | { kind: 'OUTCOME_UNKNOWN' }> {
    const exchange = await this.exchange(`/replay/${encodeURIComponent(replayId)}/${act}`, payload);
    if (exchange.kind === 'NOT_ISSUED') return { kind: 'NOT_ADMITTED' };
    if (exchange.kind === 'NETWORK' || exchange.status >= 500) return { kind: 'OUTCOME_UNKNOWN' };
    if (exchange.status >= 400) return { kind: 'NOT_ADMITTED' };
    return decode(exchange.body, replayId) ?? { kind: 'OUTCOME_UNKNOWN' };
  }

  private async exchange(path: string, payload: unknown): Promise<Exchange> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (cause) {
      return cause instanceof CredentialUnavailableError ? { kind: 'NOT_ISSUED' } : { kind: 'NETWORK' };
    }
    if (!response.ok) return { kind: 'BODY', status: response.status, body: null };
    try {
      return { kind: 'BODY', status: response.status, body: (await response.json()) as unknown };
    } catch {
      // A 2xx whose body could not be read: the outcome is unknown.
      return { kind: 'NETWORK' };
    }
  }
}
