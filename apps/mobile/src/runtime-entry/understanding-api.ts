/**
 * W3-MEGA-U (E2E-D-14) — the client for the «فهم قنديل» / QANDEEL Understanding routes.
 *
 *   GET    /understanding/items                   — the reader's current understanding
 *   GET    /understanding/items/:ref              — one item, with its user-facing explanation
 *   POST   /understanding/items/:ref/discussion   — "talk to QANDEEL about this", at the revision the reader saw
 *   DELETE /understanding/items/:ref/discussion   — close that discussion
 *   POST   /understanding/items/:ref/disagreement — an explicit disagreement (U3): Contested / Under Review
 *
 * A transport and nothing else, exactly like the account clients: it holds no credential (it goes through the AC-01
 * request-time seam its caller hands it), sends no user id, never repeats a request and never decides what an outcome
 * means to the reader. It decodes STRICTLY: an answer with a missing, extra or mistyped field — a number, an id, a
 * status, a score — is not an answer, so nothing the Product view model does not name can reach a surface.
 */
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

/** The four P1 §11.3 concepts, as the server projects them. The words are the surface's approved copy. */
export type UnderstandingConfidence = 'CLEAR' | 'TAKING_SHAPE' | 'MIXED' | 'NEEDS_MORE';
export type UnderstandingTheme = 'YOU' | 'RELATIONSHIPS' | 'WORK' | 'DECISIONS' | 'GOALS' | 'HOW_WE_TALK';
export type UnderstandingEvolutionKind =
  | 'FIRST_SEEN' | 'SUPPORT_ADDED' | 'CHALLENGE_ADDED' | 'STRENGTHENED' | 'WEAKENED' | 'BECAME_MIXED' | 'WITHDRAWN' | 'RECONSIDERED'
  | 'YOU_DISAGREED';

const CONFIDENCES: readonly string[] = Object.freeze(['CLEAR', 'TAKING_SHAPE', 'MIXED', 'NEEDS_MORE']);
const THEMES: readonly string[] = Object.freeze(['YOU', 'RELATIONSHIPS', 'WORK', 'DECISIONS', 'GOALS', 'HOW_WE_TALK']);
const EVOLUTION_KINDS: readonly string[] = Object.freeze([
  'FIRST_SEEN', 'SUPPORT_ADDED', 'CHALLENGE_ADDED', 'STRENGTHENED', 'WEAKENED', 'BECAME_MIXED', 'WITHDRAWN', 'RECONSIDERED',
  'YOU_DISAGREED',
]);
const TOKEN = /^[A-Za-z0-9_-]{22}$/u;
const COMMAND = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const MAX_ITEMS = 32;
const MAX_CONTEXT = 8;
const MAX_ALTERNATIVES = 4;
const MAX_EVOLUTION = 16;

export interface UnderstandingItemView {
  /** Opaque; it names nothing and resolves only for this reader. */
  readonly ref: string;
  /** Opaque token of the exact interpretation shown. */
  readonly revision: string;
  readonly theme: UnderstandingTheme;
  readonly summary: string;
  readonly confidence: UnderstandingConfidence;
  /** U3: the reader explicitly disagreed; the item is Contested / Under Review. */
  readonly underReview: boolean;
}

export interface UnderstandingEvolutionView {
  readonly kind: UnderstandingEvolutionKind;
  readonly at: string;
}

export interface UnderstandingDetailView extends UnderstandingItemView {
  readonly evidence: readonly string[];
  readonly contradictions: readonly string[];
  readonly alternatives: readonly string[];
  readonly unresolved: readonly string[];
  readonly evolution: readonly UnderstandingEvolutionView[];
}

export type UnderstandingListOutcome =
  | { readonly kind: 'READ'; readonly items: readonly UnderstandingItemView[] }
  | { readonly kind: 'UNAVAILABLE' };

export type UnderstandingDetailOutcome =
  | { readonly kind: 'READ'; readonly view: UnderstandingDetailView }
  /** Not one of the reader's current items any more. */
  | { readonly kind: 'GONE' }
  | { readonly kind: 'UNAVAILABLE' };

export type UnderstandingDiscussionOutcome =
  | { readonly kind: 'OPENED' }
  /** The item changed since the reader saw it; nothing was recorded. */
  | { readonly kind: 'CHANGED' }
  | { readonly kind: 'GONE' }
  /** No usable answer: it is not known to have been recorded. */
  | { readonly kind: 'FAILED' };

export type UnderstandingDisagreementOutcome =
  /** Recorded (now, as a replay, or already): the item is under review, at this revision. */
  | { readonly kind: 'UNDER_REVIEW'; readonly revision: string }
  /** The item changed since the reader saw it; nothing was recorded. */
  | { readonly kind: 'CHANGED' }
  | { readonly kind: 'GONE' }
  /** This command identity was already spent on something else; nothing was recorded. */
  | { readonly kind: 'CONFLICT' }
  /** No usable answer: it is not known whether it was recorded. The SAME command may be sent again. */
  | { readonly kind: 'FAILED' };

export interface UnderstandingApiConfig {
  /** Origin plus any base path, without a trailing slash. */
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]) => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
};
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 4000;
const isTextList = (value: unknown, max: number): value is string[] => Array.isArray(value) && value.length <= max && value.every(isText);

const SUMMARY_KEYS = ['ref', 'revision', 'theme', 'summary', 'confidence', 'underReview'];
const DETAIL_KEYS = [...SUMMARY_KEYS, 'evidence', 'contradictions', 'alternatives', 'unresolved', 'evolution'];

function decodeSummaryFields(value: Record<string, unknown>): UnderstandingItemView | null {
  const { ref, revision, theme, summary, confidence, underReview } = value;
  if (typeof underReview !== 'boolean' || (underReview && confidence !== 'MIXED')) return null;
  if (typeof ref !== 'string' || !TOKEN.test(ref) || typeof revision !== 'string' || !TOKEN.test(revision)) return null;
  if (typeof theme !== 'string' || !THEMES.includes(theme) || typeof confidence !== 'string' || !CONFIDENCES.includes(confidence)) return null;
  if (!isText(summary)) return null;
  return { ref, revision, theme: theme as UnderstandingTheme, summary, confidence: confidence as UnderstandingConfidence, underReview };
}

export function decodeUnderstandingList(body: unknown): readonly UnderstandingItemView[] | null {
  if (!isRecord(body) || !hasExactly(body, ['items']) || !Array.isArray(body.items) || body.items.length > MAX_ITEMS) return null;
  const items: UnderstandingItemView[] = [];
  for (const entry of body.items as unknown[]) {
    if (!isRecord(entry) || !hasExactly(entry, SUMMARY_KEYS)) return null;
    const item = decodeSummaryFields(entry);
    if (item === null || items.some((existing) => existing.ref === item.ref)) return null;
    items.push(item);
  }
  return items;
}

export function decodeUnderstandingDetail(body: unknown): UnderstandingDetailView | null {
  if (!isRecord(body) || !hasExactly(body, DETAIL_KEYS)) return null;
  const summary = decodeSummaryFields(body);
  if (summary === null) return null;
  const { evidence, contradictions, alternatives, unresolved, evolution } = body;
  if (!isTextList(evidence, MAX_CONTEXT) || !isTextList(contradictions, MAX_CONTEXT) || !isTextList(alternatives, MAX_ALTERNATIVES) ||
    !isTextList(unresolved, MAX_CONTEXT) || !Array.isArray(evolution) || evolution.length > MAX_EVOLUTION) return null;
  const entries: UnderstandingEvolutionView[] = [];
  for (const entry of evolution as unknown[]) {
    if (!isRecord(entry) || !hasExactly(entry, ['kind', 'at'])) return null;
    const { kind, at } = entry;
    if (typeof kind !== 'string' || !EVOLUTION_KINDS.includes(kind) || typeof at !== 'string' || !INSTANT.test(at)) return null;
    entries.push({ kind: kind as UnderstandingEvolutionKind, at });
  }
  return { ...summary, evidence, contradictions, alternatives, unresolved, evolution: entries };
}

/** The signed-in Understanding client. Built on the AC-01 seam bound to one identity. */
export class UnderstandingApiClient {
  constructor(private readonly config: UnderstandingApiConfig) {}

  async readItems(): Promise<UnderstandingListOutcome> {
    const body = await this.readJson('/understanding/items');
    if (body === undefined) return { kind: 'UNAVAILABLE' };
    const items = decodeUnderstandingList(body);
    return items === null ? { kind: 'UNAVAILABLE' } : { kind: 'READ', items };
  }

  async readItem(ref: string): Promise<UnderstandingDetailOutcome> {
    if (!TOKEN.test(ref)) return { kind: 'GONE' };
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/understanding/items/${ref}`, { method: 'GET', headers: { Accept: 'application/json' } });
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
    if (response.status === 404) return { kind: 'GONE' };
    if (!response.ok) return { kind: 'UNAVAILABLE' };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
    const view = decodeUnderstandingDetail(body);
    return view === null || view.ref !== ref ? { kind: 'UNAVAILABLE' } : { kind: 'READ', view };
  }

  /** Issued once. The body is the revision the reader saw, and nothing else. */
  async openDiscussion(ref: string, revision: string): Promise<UnderstandingDiscussionOutcome> {
    if (!TOKEN.test(ref) || !TOKEN.test(revision)) return { kind: 'GONE' };
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/understanding/items/${ref}/discussion`, {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ revision }),
      });
    } catch {
      return { kind: 'FAILED' };
    }
    if (response.status === 204) return { kind: 'OPENED' };
    if (response.status === 409) return { kind: 'CHANGED' };
    if (response.status === 404) return { kind: 'GONE' };
    return { kind: 'FAILED' };
  }

  /**
   * U3 — an explicit disagreement, issued once. The body is the command identity and the revision the reader saw,
   * and nothing else: no words the reader typed, no user id.
   */
  async disagree(ref: string, commandId: string, revision: string): Promise<UnderstandingDisagreementOutcome> {
    if (!TOKEN.test(ref) || !TOKEN.test(revision) || !COMMAND.test(commandId)) return { kind: 'GONE' };
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/understanding/items/${ref}/disagreement`, {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ commandId, revision }),
      });
    } catch {
      return { kind: 'FAILED' };
    }
    if (response.status === 404) return { kind: 'GONE' };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'FAILED' };
    }
    if (response.status === 409) {
      const code = isRecord(body) && isRecord(body.message) ? body.message.code : isRecord(body) ? body.code : undefined;
      if (code === 'UNDERSTANDING_ITEM_CHANGED') return { kind: 'CHANGED' };
      if (code === 'UNDERSTANDING_COMMAND_CONFLICT') return { kind: 'CONFLICT' };
      return { kind: 'FAILED' };
    }
    if (!response.ok || !isRecord(body) || !hasExactly(body, ['underReview', 'revision']) || body.underReview !== true ||
      typeof body.revision !== 'string' || !TOKEN.test(body.revision)) return { kind: 'FAILED' };
    return { kind: 'UNDER_REVIEW', revision: body.revision };
  }

  /** Issued once; whether it landed is reported and nothing is repeated here. */
  async closeDiscussion(ref: string): Promise<boolean> {
    if (!TOKEN.test(ref)) return false;
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}/understanding/items/${ref}/discussion`, { method: 'DELETE', headers: { Accept: 'application/json' } });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** One GET; `undefined` for any failure before a JSON body was in hand. */
  private async readJson(path: string): Promise<unknown> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}${path}`, { method: 'GET', headers: { Accept: 'application/json' } });
    } catch {
      return undefined;
    }
    if (!response.ok) return undefined;
    try {
      return (await response.json()) as unknown;
    } catch {
      return undefined;
    }
  }
}
