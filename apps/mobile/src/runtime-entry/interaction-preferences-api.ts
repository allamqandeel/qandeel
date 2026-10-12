/**
 * IP-IMP-01 — the client for the «تفضيلات التعامل» / Interaction Preferences routes.
 *
 *   GET  /interaction-preferences                — the four preferences and the record version
 *   PUT  /interaction-preferences                — { field, value, expectedVersion }: one field, compare-and-set
 *   GET  /interaction-preferences/legacy-review  — the reader's eligible previous preferences (may be empty)
 *   POST /interaction-preferences/legacy-review  — { memoryId, expectedVersion }: adopt what that one states
 *
 * A transport and nothing else, exactly like the account and Activity clients: no credential of its own (the AC-01
 * request-time seam its caller hands it), no user id, no retry, no meaning. It decodes STRICTLY: a missing, extra or
 * unknown field or value is not an answer, so nothing the Product does not name can reach the page.
 */
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

export type InteractionPreferenceField = 'REPLY_LENGTH' | 'REPLY_LANGUAGE' | 'HUMOUR' | 'EXPLANATION_STYLE';
// The closed vocabulary this transport decodes against (the Settings layer iterates its own copy).
const INTERACTION_PREFERENCE_FIELDS: readonly InteractionPreferenceField[] = Object.freeze(['REPLY_LENGTH', 'REPLY_LANGUAGE', 'HUMOUR', 'EXPLANATION_STYLE']);
const INTERACTION_PREFERENCE_VALUES: Readonly<Record<InteractionPreferenceField, readonly string[]>> = Object.freeze({
  REPLY_LENGTH: Object.freeze(['DEFAULT', 'ALWAYS_BRIEF']),
  REPLY_LANGUAGE: Object.freeze(['DEFAULT', 'EGYPTIAN_ARABIC', 'MODERN_STANDARD_ARABIC', 'LEVANTINE_ARABIC', 'GULF_ARABIC', 'MAGHREBI_ARABIC', 'ENGLISH']),
  HUMOUR: Object.freeze(['DEFAULT', 'WELCOME', 'DECLINED']),
  EXPLANATION_STYLE: Object.freeze(['DEFAULT', 'SIMPLER', 'DIRECT', 'SIMPLER_AND_DIRECT']),
});
const INTERACTION_PREFERENCE_KEYS = Object.freeze({
  REPLY_LENGTH: 'replyLength', REPLY_LANGUAGE: 'replyLanguage', HUMOUR: 'humour', EXPLANATION_STYLE: 'explanationStyle',
} as const);

export interface InteractionPreferences {
  readonly replyLength: string;
  readonly replyLanguage: string;
  readonly humour: string;
  readonly explanationStyle: string;
}
export interface InteractionPreferencesRecord {
  readonly preferences: InteractionPreferences;
  readonly version: number;
}
export interface LegacyPreferenceCandidate {
  readonly memoryId: string;
  /** The reader's own remembered words, shown as they are. */
  readonly statement: string;
  readonly field: InteractionPreferenceField;
  readonly value: string;
}

export type InteractionPreferencesRead = { readonly kind: 'READ'; readonly record: InteractionPreferencesRecord } | { readonly kind: 'UNAVAILABLE' };
export type InteractionPreferenceChange =
  | { readonly kind: 'SAVED' | 'UNCHANGED' | 'STALE' | 'NOT_ELIGIBLE'; readonly record: InteractionPreferencesRecord }
  | { readonly kind: 'FAILED' };
export type LegacyPreferenceReview =
  | { readonly kind: 'READ'; readonly record: InteractionPreferencesRecord; readonly candidates: readonly LegacyPreferenceCandidate[] }
  | { readonly kind: 'UNAVAILABLE' };

export interface InteractionPreferencesApiConfig {
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);
const isField = (value: unknown): value is InteractionPreferenceField => typeof value === 'string' && (INTERACTION_PREFERENCE_FIELDS as readonly string[]).includes(value);
const isValue = (field: InteractionPreferenceField, value: unknown): value is string => typeof value === 'string' && INTERACTION_PREFERENCE_VALUES[field].includes(value);

export function decodeInteractionPreferencesRecord(body: unknown, extra: readonly string[] = []): InteractionPreferencesRecord | null {
  if (!isRecord(body) || !hasExactly(body, ['preferences', 'version', ...extra])) return null;
  const { preferences, version } = body;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) return null;
  if (!isRecord(preferences) || !hasExactly(preferences, ['replyLength', 'replyLanguage', 'humour', 'explanationStyle'])) return null;
  if (!INTERACTION_PREFERENCE_FIELDS.every((field) => isValue(field, preferences[INTERACTION_PREFERENCE_KEYS[field]]))) return null;
  return {
    preferences: Object.freeze({
      replyLength: preferences.replyLength as string, replyLanguage: preferences.replyLanguage as string,
      humour: preferences.humour as string, explanationStyle: preferences.explanationStyle as string,
    }),
    version,
  };
}

function decodeCandidate(value: unknown): LegacyPreferenceCandidate | null {
  if (!isRecord(value) || !hasExactly(value, ['memoryId', 'statement', 'field', 'value', 'replacesCurrent'])) return null;
  if (typeof value.memoryId !== 'string' || !UUID.test(value.memoryId) || typeof value.statement !== 'string' || value.statement.length === 0) return null;
  if (!isField(value.field) || !isValue(value.field, value.value) || value.value === 'DEFAULT' || typeof value.replacesCurrent !== 'boolean') return null;
  return { memoryId: value.memoryId, statement: value.statement, field: value.field, value: value.value };
}

/** The signed-in Interaction Preferences client. Built on the AC-01 seam bound to one identity. */
export class InteractionPreferencesApiClient {
  constructor(private readonly config: InteractionPreferencesApiConfig) {}

  async read(): Promise<InteractionPreferencesRead> {
    const record = decodeInteractionPreferencesRecord(await this.request('GET', '/interaction-preferences'));
    return record === null ? { kind: 'UNAVAILABLE' } : { kind: 'READ', record };
  }

  async set(field: InteractionPreferenceField, value: string, expectedVersion: number): Promise<InteractionPreferenceChange> {
    return this.changeFrom(await this.request('PUT', '/interaction-preferences', { field, value, expectedVersion }), ['SAVED', 'UNCHANGED', 'STALE']);
  }

  async legacyReview(): Promise<LegacyPreferenceReview> {
    const body = await this.request('GET', '/interaction-preferences/legacy-review');
    const record = decodeInteractionPreferencesRecord(body, ['candidates']);
    if (record === null || !isRecord(body) || !Array.isArray(body.candidates)) return { kind: 'UNAVAILABLE' };
    const candidates = body.candidates.map(decodeCandidate);
    if (candidates.some((candidate) => candidate === null)) return { kind: 'UNAVAILABLE' };
    return { kind: 'READ', record, candidates: candidates as LegacyPreferenceCandidate[] };
  }

  async applyLegacy(memoryId: string, expectedVersion: number): Promise<InteractionPreferenceChange> {
    return this.changeFrom(await this.request('POST', '/interaction-preferences/legacy-review', { memoryId, expectedVersion }), ['SAVED', 'UNCHANGED', 'STALE', 'NOT_ELIGIBLE']);
  }

  private changeFrom(body: unknown, outcomes: readonly string[]): InteractionPreferenceChange {
    const record = decodeInteractionPreferencesRecord(body, ['outcome']);
    if (record === null || !isRecord(body) || typeof body.outcome !== 'string' || !outcomes.includes(body.outcome)) return { kind: 'FAILED' };
    return { kind: body.outcome as 'SAVED' | 'UNCHANGED' | 'STALE' | 'NOT_ELIGIBLE', record };
  }

  /** The decoded JSON of a 2xx answer, or `undefined` for anything else. Never thrown. */
  private async request(method: string, path: string, payload?: unknown): Promise<unknown> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      if (!response.ok) return undefined;
      return await response.json();
    } catch {
      return undefined;
    }
  }
}
