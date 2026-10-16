/**
 * S6-05 (CP5) — the client for a human's own Introduction Worlds: the two humans' words while the Introduction lives, its
 * one unilateral END, and, after END, the closed history this human is entitled to keep.
 *
 *   GET  /introductions/worlds                                                      — { worlds }                         (CP3, 0160)
 *   GET  /introductions/worlds/:worldId/messages[/before/:materialId/:establishedAt] — ACTIVE page | ENDED | UNAVAILABLE  (CP3, 0160)
 *   POST /introductions/worlds/:worldId/messages        { commandId, content }      — COMMITTED | ENDED | UNAVAILABLE | COMMAND_CONFLICT
 *   GET  /introductions/worlds/:worldId/history[/before/:materialId/:establishedAt]  — ENDED page | UNAVAILABLE           (CP4, 0161)
 *   POST /introductions/worlds/:worldId/end             { commandId }               — ENDED | ALREADY_SETTLED | UNAVAILABLE (S6-02)
 *
 * Deleting one's own message is the existing Shared owner deletion (R-5), on the Shared client; it is not repeated here.
 *
 * A transport and nothing else: no credential of its own (the AC-01 request-time seam its caller hands it), no user id,
 * no counterpart, no audience, no state, no retry, no persistence. It decodes STRICTLY: an extra field, an unknown state
 * or a message whose deletion right is not its author's makes the whole answer unusable. `ENDED` is reported only when
 * the server itself answered it in full (IW-35 / IW-31): a network failure, a timeout, a 5xx or a doubtful body is
 * FAILED or OFFLINE, never an ending.
 */
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

export interface IntroductionWorld {
  readonly worldId: string;
  /** The proposal both humans already know: the MATCH_CONCLUDED card joins its World through it. */
  readonly proposalId: string;
  readonly state: 'ACTIVE' | 'ENDED';
  /** The first name the Match's own handoff presented to THIS reader; null when the server does not vouch for one (IW-11b). */
  readonly otherFirstName: string | null;
}
export interface IntroductionMessage {
  readonly materialId: string;
  /** SELF — the reader's own words; HUMAN — the other person's. Server truth. */
  readonly producer: 'SELF' | 'HUMAN';
  readonly text: string;
  readonly establishedAt: string;
  /** Only the reader's own words: the existing owner deletion (R-5). */
  readonly canDelete: boolean;
}
/** The oldest message the reader holds: the next page is strictly older than it. */
export interface IntroductionMessageCursor { readonly materialId: string; readonly establishedAt: string }

/** OFFLINE: no answer arrived. UNAVAILABLE: the server answered and it was not a usable list. */
export type IntroductionWorldsRead =
  | { readonly kind: 'READ'; readonly worlds: readonly IntroductionWorld[] }
  | { readonly kind: 'UNAVAILABLE' }
  | { readonly kind: 'OFFLINE' };
/**
 * PAGE: one ACTIVE page, oldest first. ENDED: the server said this human's Introduction has ended (the closed history is read
 * next). UNAVAILABLE: not theirs, no such World, no longer an Introduction — one answer. FAILED / OFFLINE: no usable answer.
 */
export type IntroductionMessagesRead =
  | { readonly kind: 'PAGE'; readonly messages: readonly IntroductionMessage[]; readonly hasOlder: boolean }
  | { readonly kind: 'ENDED' | 'UNAVAILABLE' | 'FAILED' | 'OFFLINE' };
/** PAGE: one ENDED page of what this human's own frozen entitlement still holds, oldest first. UNAVAILABLE: no entitlement. */
export type IntroductionHistoryRead =
  | { readonly kind: 'PAGE'; readonly messages: readonly IntroductionMessage[]; readonly hasOlder: boolean }
  | { readonly kind: 'UNAVAILABLE' | 'FAILED' | 'OFFLINE' };
/** FAILED / OFFLINE: the outcome is not known; sending again with the SAME command id is safe. INVALID: refused as a request. */
export type IntroductionSendResult =
  | { readonly kind: 'COMMITTED'; readonly materialId: string; readonly establishedAt: string }
  | { readonly kind: 'ENDED' | 'UNAVAILABLE' | 'COMMAND_CONFLICT' | 'INVALID' | 'FAILED' | 'OFFLINE' };
/** FAILED / OFFLINE: the outcome is not known; ending again with the SAME command id is safe. */
export type IntroductionEndResult = { readonly kind: 'ENDED' | 'ALREADY_SETTLED' | 'UNAVAILABLE' | 'INVALID' | 'FAILED' | 'OFFLINE' };

export interface IntroductionWorldsApiConfig {
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** An instant exactly as the server returns it (ISO 8601 with an offset). */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
};

/** One World of the reader's own, or `null` when anything is doubtful. */
export function decodeIntroductionWorld(value: unknown): IntroductionWorld | null {
  if (!isRecord(value) || !hasExactly(value, ['worldId', 'proposalId', 'state', 'otherFirstName'])) return null;
  const { worldId, proposalId, state, otherFirstName } = value;
  if (!isUuid(worldId) || !isUuid(proposalId) || (state !== 'ACTIVE' && state !== 'ENDED')) return null;
  if (otherFirstName !== null && (typeof otherFirstName !== 'string' || otherFirstName.trim().length === 0)) return null;
  return Object.freeze({ worldId: worldId.toLowerCase(), proposalId: proposalId.toLowerCase(), state, otherFirstName: otherFirstName as string | null });
}

/** One message, or `null` when anything is doubtful — a deletion right that is not exactly its author's included. */
export function decodeIntroductionMessage(value: unknown): IntroductionMessage | null {
  if (!isRecord(value) || !hasExactly(value, ['materialId', 'producer', 'text', 'establishedAt', 'canDelete'])) return null;
  const { materialId, producer, text, establishedAt, canDelete } = value;
  if (!isUuid(materialId) || (producer !== 'SELF' && producer !== 'HUMAN') || typeof text !== 'string' || text.length === 0) return null;
  if (typeof establishedAt !== 'string' || !INSTANT.test(establishedAt) || canDelete !== (producer === 'SELF')) return null;
  return Object.freeze({ materialId: materialId.toLowerCase(), producer, text, establishedAt, canDelete });
}

/** A page body `{ outcome, messages, hasOlder }` with exactly the given outcome, or `null`. */
function decodePage(body: unknown, outcome: 'ACTIVE' | 'ENDED'): { readonly messages: readonly IntroductionMessage[]; readonly hasOlder: boolean } | null {
  if (!isRecord(body) || !hasExactly(body, ['outcome', 'messages', 'hasOlder']) || body.outcome !== outcome) return null;
  if (!Array.isArray(body.messages) || typeof body.hasOlder !== 'boolean') return null;
  const messages = body.messages.map(decodeIntroductionMessage);
  if (messages.some((m) => m === null) || new Set(messages.map((m) => m!.materialId)).size !== messages.length) return null;
  return { messages: Object.freeze(messages as IntroductionMessage[]), hasOlder: body.hasOlder };
}

/** A body that is exactly `{ outcome }` with one of the given words, or `null`. */
function bareOutcome<T extends string>(body: unknown, allowed: readonly T[]): T | null {
  if (!isRecord(body) || !hasExactly(body, ['outcome'])) return null;
  return allowed.find((word) => word === body.outcome) ?? null;
}

type Exchange = { readonly kind: 'OK'; readonly body: unknown } | { readonly kind: 'STATUS'; readonly status: number } | { readonly kind: 'NETWORK' };

/** The signed-in Introduction World client. Built on the AC-01 seam bound to one identity. */
export class IntroductionWorldsApiClient {
  constructor(private readonly config: IntroductionWorldsApiConfig) {}

  async list(): Promise<IntroductionWorldsRead> {
    const answer = await this.exchange('GET', '/introductions/worlds');
    if (answer.kind === 'NETWORK') return { kind: 'OFFLINE' };
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['worlds']) || !Array.isArray(answer.body.worlds)) return { kind: 'UNAVAILABLE' };
    const worlds = answer.body.worlds.map(decodeIntroductionWorld);
    if (worlds.some((w) => w === null) || new Set(worlds.map((w) => w!.worldId)).size !== worlds.length) return { kind: 'UNAVAILABLE' };
    return { kind: 'READ', worlds: Object.freeze(worlds as IntroductionWorld[]) };
  }

  async messages(worldId: string, before: IntroductionMessageCursor | null): Promise<IntroductionMessagesRead> {
    const answer = await this.exchange('GET', this.pagePath(worldId, 'messages', before));
    if (answer.kind === 'NETWORK') return { kind: 'OFFLINE' };
    if (answer.kind !== 'OK') return { kind: 'FAILED' };
    const page = decodePage(answer.body, 'ACTIVE');
    if (page !== null) return { kind: 'PAGE', ...page };
    return { kind: bareOutcome(answer.body, ['ENDED', 'UNAVAILABLE'] as const) ?? 'FAILED' };
  }

  async history(worldId: string, before: IntroductionMessageCursor | null): Promise<IntroductionHistoryRead> {
    const answer = await this.exchange('GET', this.pagePath(worldId, 'history', before));
    if (answer.kind === 'NETWORK') return { kind: 'OFFLINE' };
    if (answer.kind !== 'OK') return { kind: 'FAILED' };
    const page = decodePage(answer.body, 'ENDED');
    if (page !== null) return { kind: 'PAGE', ...page };
    return { kind: bareOutcome(answer.body, ['UNAVAILABLE'] as const) ?? 'FAILED' };
  }

  async send(worldId: string, commandId: string, content: string): Promise<IntroductionSendResult> {
    const answer = await this.exchange('POST', `/introductions/worlds/${encodeURIComponent(worldId)}/messages`, { commandId, content });
    if (answer.kind === 'NETWORK') return { kind: 'OFFLINE' };
    if (answer.kind === 'STATUS') return { kind: answer.status === 400 ? 'INVALID' : 'FAILED' };
    const body = answer.body;
    if (isRecord(body) && hasExactly(body, ['outcome', 'materialId', 'establishedAt']) && body.outcome === 'COMMITTED'
        && isUuid(body.materialId) && typeof body.establishedAt === 'string' && INSTANT.test(body.establishedAt)) {
      return { kind: 'COMMITTED', materialId: body.materialId.toLowerCase(), establishedAt: body.establishedAt };
    }
    return { kind: bareOutcome(body, ['ENDED', 'UNAVAILABLE', 'COMMAND_CONFLICT'] as const) ?? 'FAILED' };
  }

  async end(worldId: string, commandId: string): Promise<IntroductionEndResult> {
    const answer = await this.exchange('POST', `/introductions/worlds/${encodeURIComponent(worldId)}/end`, { commandId });
    if (answer.kind === 'NETWORK') return { kind: 'OFFLINE' };
    if (answer.kind === 'STATUS') return { kind: answer.status === 400 ? 'INVALID' : 'FAILED' };
    return { kind: bareOutcome(answer.body, ['ENDED', 'ALREADY_SETTLED', 'UNAVAILABLE'] as const) ?? 'FAILED' };
  }

  private pagePath(worldId: string, kind: 'messages' | 'history', before: IntroductionMessageCursor | null): string {
    const base = `/introductions/worlds/${encodeURIComponent(worldId)}/${kind}`;
    return before === null ? base : `${base}/before/${encodeURIComponent(before.materialId)}/${encodeURIComponent(before.establishedAt)}`;
  }

  /** The decoded JSON of a 2xx, the status of any other answer, or NETWORK. Never thrown. */
  private async exchange(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<Exchange> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      if (!response.ok) return { kind: 'STATUS', status: response.status };
      return { kind: 'OK', body: (await response.json()) as unknown };
    } catch {
      return { kind: 'NETWORK' };
    }
  }
}
