/**
 * S7-02 — the client for the Personal Replay entry and selection (the S7-01 boundary, migration 0169), and for the two
 * frozen T-03A2 temporal reads the selection is proven against:
 *
 *   GET  /replay/capability                                     — { creationAvailable }        (a hint; every command re-binds the gate)
 *   GET  /replay/conversations/:sessionId                       — { replays }                   (this conversation's own; not a library)
 *   GET  /replay/:replayId                                      — FOUND | UNAVAILABLE
 *   POST /replay/drafts              { commandId, sessionId, firstTc, lastTc }              — CREATED | a bounded refusal
 *   POST /replay/:replayId/revisions { commandId, expectedDraftRevision, firstTc, lastTc } — REVISED | a bounded refusal
 *   GET  /conversation/sessions/:sessionId/temporal             — the Live Head
 *   GET  /conversation/sessions/:sessionId/temporal/events      — the committed-unit events, by Session Position
 *
 * A transport and nothing else: no credential of its own (the AC-01 request-time seam its caller hands it), no user id,
 * no owner, no source class, no unit id, no state, no retry and no persistence. The identity is the verified token on
 * the server. It decodes STRICTLY: an extra field, a missing one or an unknown word makes the answer unusable.
 *
 * ## The one ambiguity it refuses to hide
 *
 * A command that did not return a readable answer — the network dropped, the server answered 5xx, or the body could not
 * be read — may or may not have committed. That is `OUTCOME_UNKNOWN`, never "not saved". Only the caller, holding the
 * command's own id, can resolve it: by re-issuing the SAME command under the SAME id, which the server answers from its
 * committed history. A `4xx` is refused before anything is written.
 */
import type { ConversationalUnitsCommittedWireEvent } from '@qandeel/runtime';

import { MAX_TEMPORAL_EVENT_PAGE, TemporalApiClient } from '../temporal/temporal-api';
import { CredentialUnavailableError } from './auth/request-credential';
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

export interface ReplayApiConfig {
  /** Origin plus any base path, without a trailing slash. */
  readonly baseUrl: string;
  /** Always the AC-01 authorized seam in production: the bearer is decided at each request. */
  readonly fetch: RuntimeHttpFetch;
  /** The frozen T-03A2 temporal client, on the same seam. */
  readonly temporal: TemporalApiClient;
}

export type ReplayLifecycleView = 'DRAFT' | 'PREVIEW_READY' | 'FINALIZED';
/** How much of the conversation a draft covers (S7-01 §5): all of it, or one contiguous excerpt of whole messages. */
export type ReplayCoverageView = 'FULL_SOURCE' | 'SELECTED_EXCERPT' | 'HIGHLIGHT_SELECTION';
/** The bounded refusal words of the two draft commands (migration 0169 §3). */
export type ReplayDraftRefusal =
  | 'NOT_AVAILABLE_NOW'
  | 'UNAVAILABLE'
  | 'NOT_WHOLE_MESSAGES'
  | 'CHANGED'
  | 'SOURCE_CHANGED'
  | 'SELECTION_NOT_SUPPORTED'
  | 'LIFECYCLE_NOT_ELIGIBLE'
  | 'COMMAND_CONFLICT';

export interface ReplaySummaryView {
  readonly replayId: string;
  readonly lifecycle: ReplayLifecycleView;
  readonly createdAt: string;
}

export interface ReplayDraftView {
  readonly replayId: string;
  readonly lifecycle: ReplayLifecycleView;
  readonly revision: number;
  readonly coverage: ReplayCoverageView;
  readonly firstTc: number;
  readonly lastTc: number;
  readonly sourceState: 'CURRENT' | 'STALE';
}

export type ReplayCapabilityResult = { readonly kind: 'READ'; readonly creationAvailable: boolean } | { readonly kind: 'UNAVAILABLE' };
export type ReplayListResult = { readonly kind: 'READ'; readonly replays: readonly ReplaySummaryView[] } | { readonly kind: 'UNAVAILABLE' };
/** NOT_FOUND: not the caller's, or no such Replay — one answer. */
export type ReplayReadResult = { readonly kind: 'FOUND'; readonly replay: ReplayDraftView } | { readonly kind: 'NOT_FOUND' } | { readonly kind: 'UNAVAILABLE' };

export interface ReplayDraftAnswer {
  readonly outcome: 'CREATED' | 'REVISED';
  readonly replayId: string;
  readonly lifecycle: ReplayLifecycleView;
  readonly draftRevision: number;
  readonly coverage: ReplayCoverageView;
  /** The number of committed units the draft binds (the server's count; never the client's message count). */
  readonly selectedMomentCount: number;
}

export type ReplayCommandResult =
  | { readonly kind: 'ANSWERED'; readonly answer: ReplayDraftAnswer }
  | { readonly kind: 'REFUSED_BY_SERVER'; readonly refusal: ReplayDraftRefusal }
  /** Refused before admission (`4xx`), or never issued (the credential seam refused it). Nothing was written. */
  | { readonly kind: 'NOT_ADMITTED' }
  /** The command MAY have committed, and this response cannot say. See the module comment. */
  | { readonly kind: 'OUTCOME_UNKNOWN' };

export interface ReplayRange {
  readonly firstTc: number;
  readonly lastTc: number;
}

export type TemporalHeadResult = { readonly kind: 'READ'; readonly liveHead: number | null } | { readonly kind: 'UNAVAILABLE' };
export type CommittedEventsResult =
  | { readonly kind: 'READ'; readonly events: readonly ConversationalUnitsCommittedWireEvent[] }
  | { readonly kind: 'UNAVAILABLE' };

/** The largest committed-events page the server serves; the client asks for exactly this. */
export const REPLAY_EVENTS_PAGE = MAX_TEMPORAL_EVENT_PAGE;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;
const INT4_MAX = 2147483647;
const LIFECYCLES: readonly ReplayLifecycleView[] = ['DRAFT', 'PREVIEW_READY', 'FINALIZED'];
const COVERAGE: readonly ReplayCoverageView[] = ['FULL_SOURCE', 'SELECTED_EXCERPT', 'HIGHLIGHT_SELECTION'];
const REFUSALS: readonly ReplayDraftRefusal[] = ['NOT_AVAILABLE_NOW', 'UNAVAILABLE', 'NOT_WHOLE_MESSAGES', 'CHANGED', 'SOURCE_CHANGED',
  'SELECTION_NOT_SUPPORTED', 'LIFECYCLE_NOT_ELIGIBLE', 'COMMAND_CONFLICT'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
};
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isInstant = (value: unknown): value is string => typeof value === 'string' && INSTANT.test(value);
const isPosition = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= INT4_MAX;
const isOneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T => typeof value === 'string' && (allowed as readonly string[]).includes(value);

/** A summary row of `GET /replay/conversations/:sessionId`, or `null` when anything is doubtful. */
export function decodeReplaySummary(value: unknown): ReplaySummaryView | null {
  if (!isRecord(value) || !hasExactly(value, ['replayId', 'lifecycle', 'createdAt', 'currentVersionId', 'currentVersionFinalized'])) return null;
  const { replayId, lifecycle, createdAt, currentVersionId, currentVersionFinalized } = value;
  if (!isUuid(replayId) || !isOneOf(lifecycle, LIFECYCLES) || !isInstant(createdAt)) return null;
  if (currentVersionId === null ? currentVersionFinalized !== null : !isUuid(currentVersionId) || typeof currentVersionFinalized !== 'boolean') return null;
  return Object.freeze({ replayId: replayId.toLowerCase(), lifecycle, createdAt });
}

/** `GET /replay/:replayId`: FOUND with its draft, or the one UNAVAILABLE answer. */
export function decodeReplayRead(value: unknown, replayId: string): ReplayReadResult {
  if (isRecord(value) && hasExactly(value, ['outcome']) && value.outcome === 'UNAVAILABLE') return { kind: 'NOT_FOUND' };
  if (!isRecord(value) || !hasExactly(value, ['outcome', 'replayId', 'lifecycle', 'createdAt', 'draft', 'currentVersion']) || value.outcome !== 'FOUND') return { kind: 'UNAVAILABLE' };
  const { draft } = value;
  if (!isUuid(value.replayId) || value.replayId.toLowerCase() !== replayId.toLowerCase() || !isOneOf(value.lifecycle, LIFECYCLES) || !isInstant(value.createdAt)) return { kind: 'UNAVAILABLE' };
  if (!isRecord(draft) || !hasExactly(draft, ['revision', 'coverageClass', 'selectedMomentCount', 'firstTc', 'lastTc', 'sourceState', 'updatedAt'])) return { kind: 'UNAVAILABLE' };
  if (!isPosition(draft.revision) || !isOneOf(draft.coverageClass, COVERAGE) || !isPosition(draft.selectedMomentCount) || !isPosition(draft.firstTc)
      || !isPosition(draft.lastTc) || draft.lastTc < draft.firstTc || (draft.sourceState !== 'CURRENT' && draft.sourceState !== 'STALE') || !isInstant(draft.updatedAt)) {
    return { kind: 'UNAVAILABLE' };
  }
  const version = value.currentVersion;
  if (version !== null && (!isRecord(version) || !hasExactly(version, ['versionId', 'revision', 'finalized']) || !isUuid(version.versionId)
      || !isPosition(version.revision) || typeof version.finalized !== 'boolean')) return { kind: 'UNAVAILABLE' };
  return {
    kind: 'FOUND',
    replay: Object.freeze({ replayId: value.replayId.toLowerCase(), lifecycle: value.lifecycle, revision: draft.revision, coverage: draft.coverageClass,
      firstTc: draft.firstTc, lastTc: draft.lastTc, sourceState: draft.sourceState }),
  };
}

/** A draft command's 200 body: the success shape, or exactly one bounded word. Anything else is `null`. */
export function decodeDraftCommand(value: unknown, success: 'CREATED' | 'REVISED'): ReplayCommandResult | null {
  if (!isRecord(value)) return null;
  if (hasExactly(value, ['outcome'])) return isOneOf(value.outcome, REFUSALS) ? { kind: 'REFUSED_BY_SERVER', refusal: value.outcome } : null;
  if (!hasExactly(value, ['outcome', 'replayId', 'lifecycle', 'draftRevision', 'coverageClass', 'selectedMomentCount']) || value.outcome !== success) return null;
  if (!isUuid(value.replayId) || !isOneOf(value.lifecycle, LIFECYCLES) || !isPosition(value.draftRevision) || !isOneOf(value.coverageClass, COVERAGE)
      || !isPosition(value.selectedMomentCount)) return null;
  return {
    kind: 'ANSWERED',
    answer: Object.freeze({ outcome: success, replayId: value.replayId.toLowerCase(), lifecycle: value.lifecycle, draftRevision: value.draftRevision,
      coverage: value.coverageClass, selectedMomentCount: value.selectedMomentCount }),
  };
}

type Exchange = { readonly kind: 'BODY'; readonly status: number; readonly body: unknown } | { readonly kind: 'NOT_ISSUED' } | { readonly kind: 'NETWORK' };

export class ReplayApiClient {
  constructor(private readonly config: ReplayApiConfig) {}

  async capability(): Promise<ReplayCapabilityResult> {
    const answer = await this.read('/replay/capability');
    return isRecord(answer) && hasExactly(answer, ['creationAvailable']) && typeof answer.creationAvailable === 'boolean'
      ? { kind: 'READ', creationAvailable: answer.creationAvailable }
      : { kind: 'UNAVAILABLE' };
  }

  async conversationReplays(sessionId: string): Promise<ReplayListResult> {
    const answer = await this.read(`/replay/conversations/${encodeURIComponent(sessionId)}`);
    if (!isRecord(answer) || !hasExactly(answer, ['replays']) || !Array.isArray(answer.replays) || answer.replays.length > 100) return { kind: 'UNAVAILABLE' };
    const replays = answer.replays.map(decodeReplaySummary);
    if (replays.some((row) => row === null) || new Set(replays.map((row) => row!.replayId)).size !== replays.length) return { kind: 'UNAVAILABLE' };
    return { kind: 'READ', replays: Object.freeze(replays as ReplaySummaryView[]) };
  }

  async replay(replayId: string): Promise<ReplayReadResult> {
    const answer = await this.read(`/replay/${encodeURIComponent(replayId)}`);
    return answer === null ? { kind: 'UNAVAILABLE' } : decodeReplayRead(answer, replayId);
  }

  /** Issued exactly once per call. Re-issuing the SAME command under the SAME id is the caller's decision. */
  createDraft(commandId: string, sessionId: string, range: ReplayRange): Promise<ReplayCommandResult> {
    return this.command('/replay/drafts', { commandId, sessionId, firstTc: range.firstTc, lastTc: range.lastTc }, 'CREATED');
  }

  reviseDraft(commandId: string, replayId: string, expectedDraftRevision: number, range: ReplayRange): Promise<ReplayCommandResult> {
    return this.command(`/replay/${encodeURIComponent(replayId)}/revisions`,
      { commandId, expectedDraftRevision, firstTc: range.firstTc, lastTc: range.lastTc }, 'REVISED');
  }

  /** The conversation's Live Head (the frozen T-03A2 snapshot), or UNAVAILABLE. */
  async liveHead(sessionId: string): Promise<TemporalHeadResult> {
    try {
      const snapshot = await this.config.temporal.fetchSessionTemporalState(sessionId);
      return { kind: 'READ', liveHead: snapshot.liveHead };
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
  }

  /** One page of committed-unit events after `afterSp` (the frozen T-03A2 catch-up; the Session is checked by it). */
  async committedEvents(sessionId: string, afterSp?: number): Promise<CommittedEventsResult> {
    try {
      const events = await this.config.temporal.fetchCommittedEvents(sessionId, { ...(afterSp === undefined ? {} : { afterSp }), limit: REPLAY_EVENTS_PAGE });
      return { kind: 'READ', events };
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
  }

  private async read(path: string): Promise<unknown> {
    const exchange = await this.exchange('GET', path);
    return exchange.kind === 'BODY' && exchange.status >= 200 && exchange.status < 300 ? exchange.body : null;
  }

  private async command(path: string, payload: Record<string, unknown>, success: 'CREATED' | 'REVISED'): Promise<ReplayCommandResult> {
    const exchange = await this.exchange('POST', path, payload);
    if (exchange.kind === 'NOT_ISSUED') return { kind: 'NOT_ADMITTED' };
    if (exchange.kind === 'NETWORK' || exchange.status >= 500) return { kind: 'OUTCOME_UNKNOWN' };
    if (exchange.status >= 400) return { kind: 'NOT_ADMITTED' };
    return decodeDraftCommand(exchange.body, success) ?? { kind: 'OUTCOME_UNKNOWN' };
  }

  private async exchange(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<Exchange> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
    } catch (cause) {
      return cause instanceof CredentialUnavailableError ? { kind: 'NOT_ISSUED' } : { kind: 'NETWORK' };
    }
    if (!response.ok) return { kind: 'BODY', status: response.status, body: null };
    try {
      return { kind: 'BODY', status: response.status, body: (await response.json()) as unknown };
    } catch {
      // A 2xx whose body could not be read: for a command the outcome is unknown, for a read it is unusable.
      return { kind: 'NETWORK' };
    }
  }
}
