/**
 * A3-01 — the client for the «النشاط» / Activity routes (I-08N-01 + P3).
 *
 *   GET  /activity/items?limit=N&before=<id>&category=C — the reader's Activity, newest first
 *   GET  /activity/attention?timeZone=<IANA>            — presence, category indicators, interruption-eligible items
 *   POST /activity/items/seen                            — attention only: NEW → SEEN
 *   POST /activity/items/:itemId/open                    — attention only: OPENED; Direct Entry revalidated at that moment
 *   POST /activity/strip                                 — in-app presentation evidence
 *   GET / PUT /activity/preferences, PUT /activity/snooze, PUT /activity/mutes
 *
 * A transport and nothing else, exactly like the account and Understanding clients: no credential of its own (the AC-01
 * request-time seam its caller hands it), no user id, no retry, no meaning. It decodes STRICTLY: a missing, extra or
 * mistyped field — a number where presence is meant, a count on the global indicator, an unknown category — is not an
 * answer, so nothing the Product does not name can reach a surface.
 */
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

export type ActivityCategory = 'QANDEEL' | 'SHARED' | 'PUBLIC' | 'INTRODUCTIONS' | 'SYSTEM';
export const ACTIVITY_CATEGORIES: readonly ActivityCategory[] = Object.freeze(['QANDEEL', 'SHARED', 'PUBLIC', 'INTRODUCTIONS', 'SYSTEM']);
export type ActivityAttention = 'NEW' | 'SEEN' | 'OPENED';
export type ActivityContextKind = 'PERSONAL' | 'SHARED_WORLD' | 'PUBLIC_WORLD' | 'INTRODUCTIONS' | 'ACCOUNT';
export type DisclosureLevel = 'L0' | 'L1' | 'L2' | 'L3';
export type LockSubject = 'QANDEEL' | 'SHARED' | 'PUBLIC' | 'DISCOVERY' | 'INTRODUCTIONS' | 'REMINDERS' | 'ACCOUNT' | 'SECURITY';
export const LOCK_SUBJECTS: readonly LockSubject[] = Object.freeze(['QANDEEL', 'SHARED', 'PUBLIC', 'DISCOVERY', 'INTRODUCTIONS', 'REMINDERS', 'ACCOUNT', 'SECURITY']);
export const DISCLOSURE_LEVELS: readonly DisclosureLevel[] = Object.freeze(['L0', 'L1', 'L2', 'L3']);
export type ProactiveChoice = 'ALLOW' | 'REDUCE' | 'OFF';
export type SettingsSection = 'SECURITY' | 'ACCOUNT' | 'NOTIFICATIONS';

export interface BilingualText { readonly ar: string | null; readonly en: string | null }

export interface ActivityItem {
  readonly id: string;
  readonly category: ActivityCategory;
  readonly speaker: 'QANDEEL' | 'PRODUCT';
  readonly at: string;
  readonly context: BilingualText | null;
  readonly body: BilingualText;
  readonly secondary: BilingualText | null;
  readonly attention: ActivityAttention;
  /** P3 §4: needs the user; keeps a WAITING mark once seen, until opened. */
  readonly actionable: boolean;
  readonly waiting: boolean;
  readonly stale: boolean;
  readonly muted: boolean;
  readonly mark: boolean;
  readonly entry: 'AVAILABLE' | 'UNAVAILABLE' | 'NONE';
}

export interface ActivityIndicators {
  /** Presence only. There is no global count, by construction (P3 §6, D45). */
  readonly present: boolean;
  readonly categories: {
    readonly QANDEEL: { readonly present: boolean };
    readonly SHARED: { readonly present: boolean; readonly count: number | null };
    readonly PUBLIC: { readonly present: boolean };
    readonly INTRODUCTIONS: { readonly present: boolean };
    readonly SYSTEM: { readonly present: boolean; readonly count: number | null };
  };
}

export interface InterruptionCandidate {
  readonly item: ActivityItem;
  readonly interruptionClass: 1 | 2 | 3 | 4;
  readonly contextKind: ActivityContextKind;
  readonly callSafe: boolean;
}

export interface ActivityAttentionSnapshot extends ActivityIndicators {
  readonly interruptions: readonly InterruptionCandidate[];
}

export type DirectEntryDestination =
  | { readonly kind: 'PERSONAL_CONVERSATION' }
  | { readonly kind: 'QANDEEL_UNDERSTANDING' }
  | { readonly kind: 'GENERAL_SETTINGS'; readonly section: SettingsSection }
  /** S4-04: the exact Shared World, already re-authorized at open; the device opens it through the Shared entry authority. */
  | { readonly kind: 'SHARED_WORLD'; readonly worldId: string };

export type ActivityOpenOutcome =
  | { readonly kind: 'ENTER'; readonly destination: DirectEntryDestination }
  | { readonly kind: 'STALE' | 'UNAVAILABLE' | 'NO_ENTRY'; readonly fallback: DirectEntryDestination | null }
  | { readonly kind: 'GONE' }
  | { readonly kind: 'FAILED' };

export interface ActivityPreferences {
  readonly proactive: ProactiveChoice;
  readonly shared: { readonly alerts: boolean };
  readonly public: { readonly interactions: boolean; readonly discovery: boolean };
  readonly introductions: { readonly available: boolean; readonly alerts: boolean };
  readonly account: { readonly updates: boolean };
  readonly quietHours: { readonly enabled: boolean; readonly start: string; readonly end: string };
  readonly snoozeUntil: string | null;
  readonly lockScreen: Readonly<Record<LockSubject, DisclosureLevel>>;
}

/** What may be written: everything but Snooze (its own act) and the server-owned availability. */
export type ActivityPreferencesInput = Omit<ActivityPreferences, 'snoozeUntil' | 'introductions'> & { readonly introductions: { readonly alerts: boolean } };

export type ActivityPage = { readonly kind: 'READ'; readonly items: readonly ActivityItem[]; readonly before: string | null } | { readonly kind: 'UNAVAILABLE' };
export type ActivityAttentionOutcome = { readonly kind: 'READ'; readonly snapshot: ActivityAttentionSnapshot } | { readonly kind: 'UNAVAILABLE' };
export type ActivityPreferencesOutcome = { readonly kind: 'READ'; readonly preferences: ActivityPreferences } | { readonly kind: 'UNAVAILABLE' };

export interface ActivityApiConfig {
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/u;
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/u;
const MAX_PAGE = 50;
const MAX_INTERRUPTIONS = 8;
const ITEM_KEYS = ['id', 'category', 'speaker', 'at', 'context', 'body', 'secondary', 'attention', 'actionable', 'waiting', 'stale', 'muted', 'mark', 'entry'];

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]) => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
};
const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const isBool = (value: unknown): value is boolean => typeof value === 'boolean';
const presence = (value: unknown, withCount: boolean) => {
  if (!isRecord(value) || !hasExactly(value, withCount ? ['present', 'count'] : ['present']) || !isBool(value.present)) return false;
  if (!withCount) return true;
  return value.count === null || (typeof value.count === 'number' && Number.isSafeInteger(value.count) && value.count > 0 && value.present);
};

function decodeBilingual(value: unknown, max: number, nullable: boolean): BilingualText | null | undefined {
  if (value === null) return nullable ? null : undefined;
  if (!isRecord(value) || !hasExactly(value, ['ar', 'en'])) return undefined;
  const { ar, en } = value;
  if ((ar !== null && !isText(ar, max)) || (en !== null && !isText(en, max)) || (ar === null && en === null)) return undefined;
  return { ar: ar as string | null, en: en as string | null };
}

export function decodeActivityItem(value: unknown): ActivityItem | null {
  if (!isRecord(value) || !hasExactly(value, ITEM_KEYS)) return null;
  const { id, category, speaker, at, attention, actionable, waiting, stale, muted, mark, entry } = value;
  if (typeof id !== 'string' || !UUID.test(id) || !ACTIVITY_CATEGORIES.includes(category as ActivityCategory)) return null;
  if ((speaker !== 'QANDEEL' && speaker !== 'PRODUCT') || (speaker === 'QANDEEL' && category !== 'QANDEEL')) return null;
  if (typeof at !== 'string' || !INSTANT.test(at)) return null;
  if (attention !== 'NEW' && attention !== 'SEEN' && attention !== 'OPENED') return null;
  if (!isBool(actionable) || !isBool(waiting) || !isBool(stale) || !isBool(muted) || !isBool(mark)) return null;
  if (entry !== 'AVAILABLE' && entry !== 'UNAVAILABLE' && entry !== 'NONE') return null;
  const context = decodeBilingual(value.context, 120, true);
  const body = decodeBilingual(value.body, 280, false);
  const secondary = decodeBilingual(value.secondary, 280, true);
  if (context === undefined || body === undefined || body === null || secondary === undefined) return null;
  return {
    id, category: category as ActivityCategory, speaker, at, context, body, secondary, attention, actionable, waiting, stale, muted, mark,
    entry,
  };
}

export function decodeActivityPage(body: unknown): { readonly items: readonly ActivityItem[]; readonly before: string | null } | null {
  if (!isRecord(body) || !hasExactly(body, ['items', 'before']) || !Array.isArray(body.items) || body.items.length > MAX_PAGE) return null;
  const items: ActivityItem[] = [];
  for (const entry of body.items as unknown[]) {
    const item = decodeActivityItem(entry);
    if (item === null || items.some((existing) => existing.id === item.id)) return null;
    items.push(item);
  }
  const { before } = body;
  if (before !== null && (typeof before !== 'string' || !UUID.test(before))) return null;
  return { items, before };
}

export function decodeAttention(body: unknown): ActivityAttentionSnapshot | null {
  if (!isRecord(body) || !hasExactly(body, ['present', 'categories', 'interruptions']) || !isBool(body.present)) return null;
  const c = body.categories;
  if (!isRecord(c) || !hasExactly(c, [...ACTIVITY_CATEGORIES])) return null;
  if (!presence(c.QANDEEL, false) || !presence(c.SHARED, true) || !presence(c.PUBLIC, false) || !presence(c.INTRODUCTIONS, false) || !presence(c.SYSTEM, true)) return null;
  if (!Array.isArray(body.interruptions) || body.interruptions.length > MAX_INTERRUPTIONS) return null;
  const interruptions: InterruptionCandidate[] = [];
  for (const entry of body.interruptions as unknown[]) {
    if (!isRecord(entry) || !hasExactly(entry, ['item', 'interruptionClass', 'contextKind', 'callSafe'])) return null;
    const item = decodeActivityItem(entry.item);
    const cls = entry.interruptionClass;
    if (item === null || ![1, 2, 3, 4].includes(cls as number) || !isBool(entry.callSafe)) return null;
    if (!['PERSONAL', 'SHARED_WORLD', 'PUBLIC_WORLD', 'INTRODUCTIONS', 'ACCOUNT'].includes(entry.contextKind as string)) return null;
    interruptions.push({ item, interruptionClass: cls as 1 | 2 | 3 | 4, contextKind: entry.contextKind as ActivityContextKind, callSafe: entry.callSafe });
  }
  return { present: body.present, categories: c as unknown as ActivityIndicators['categories'], interruptions };
}

function decodeDestination(value: unknown): DirectEntryDestination | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (value.kind === 'PERSONAL_CONVERSATION' || value.kind === 'QANDEEL_UNDERSTANDING') return hasExactly(value, ['kind']) ? { kind: value.kind } : undefined;
  if (value.kind === 'SHARED_WORLD' && hasExactly(value, ['kind', 'worldId']) && typeof value.worldId === 'string' && UUID.test(value.worldId)) {
    return { kind: 'SHARED_WORLD', worldId: value.worldId };
  }
  if (value.kind === 'GENERAL_SETTINGS' && hasExactly(value, ['kind', 'section']) && ['SECURITY', 'ACCOUNT', 'NOTIFICATIONS'].includes(value.section as string)) {
    return { kind: 'GENERAL_SETTINGS', section: value.section as SettingsSection };
  }
  return undefined;
}

export function decodeOpen(body: unknown): ActivityOpenOutcome {
  if (!isRecord(body)) return { kind: 'FAILED' };
  if (body.outcome === 'ENTER' && hasExactly(body, ['outcome', 'destination'])) {
    const destination = decodeDestination(body.destination);
    return destination ? { kind: 'ENTER', destination } : { kind: 'FAILED' };
  }
  if ((body.outcome === 'STALE' || body.outcome === 'UNAVAILABLE' || body.outcome === 'NO_ENTRY') && hasExactly(body, ['outcome', 'fallback'])) {
    const fallback = decodeDestination(body.fallback);
    return fallback === undefined ? { kind: 'FAILED' } : { kind: body.outcome, fallback };
  }
  return { kind: 'FAILED' };
}

export function decodePreferences(body: unknown): ActivityPreferences | null {
  if (!isRecord(body) || !hasExactly(body, ['proactive', 'shared', 'public', 'introductions', 'account', 'quietHours', 'snoozeUntil', 'lockScreen'])) return null;
  const { proactive, shared, account, quietHours, snoozeUntil, lockScreen, introductions } = body;
  const pub = body.public;
  if (proactive !== 'ALLOW' && proactive !== 'REDUCE' && proactive !== 'OFF') return null;
  if (!isRecord(shared) || !hasExactly(shared, ['alerts']) || !isBool(shared.alerts)) return null;
  if (!isRecord(pub) || !hasExactly(pub, ['interactions', 'discovery']) || !isBool(pub.interactions) || !isBool(pub.discovery)) return null;
  if (!isRecord(introductions) || !hasExactly(introductions, ['available', 'alerts']) || !isBool(introductions.available) || !isBool(introductions.alerts)) return null;
  if (!isRecord(account) || !hasExactly(account, ['updates']) || !isBool(account.updates)) return null;
  if (!isRecord(quietHours) || !hasExactly(quietHours, ['enabled', 'start', 'end']) || !isBool(quietHours.enabled) ||
    typeof quietHours.start !== 'string' || !TIME.test(quietHours.start) || typeof quietHours.end !== 'string' || !TIME.test(quietHours.end)) return null;
  if (snoozeUntil !== null && (typeof snoozeUntil !== 'string' || !INSTANT.test(snoozeUntil))) return null;
  if (!isRecord(lockScreen) || !hasExactly(lockScreen, [...LOCK_SUBJECTS]) || !LOCK_SUBJECTS.every((s) => DISCLOSURE_LEVELS.includes(lockScreen[s] as DisclosureLevel))) return null;
  return {
    proactive, shared: { alerts: shared.alerts }, public: { interactions: pub.interactions, discovery: pub.discovery },
    introductions: { available: introductions.available, alerts: introductions.alerts }, account: { updates: account.updates },
    quietHours: { enabled: quietHours.enabled, start: quietHours.start, end: quietHours.end }, snoozeUntil,
    lockScreen: lockScreen as Record<LockSubject, DisclosureLevel>,
  };
}

/** The signed-in Activity client. Built on the AC-01 seam bound to one identity. */
export class ActivityApiClient {
  constructor(private readonly config: ActivityApiConfig) {}

  async readPage(options: { readonly category: ActivityCategory | null; readonly before: string | null; readonly limit: number }): Promise<ActivityPage> {
    const query = new URLSearchParams({ limit: String(options.limit) });
    if (options.category !== null) query.set('category', options.category);
    if (options.before !== null) query.set('before', options.before);
    const body = await this.request('GET', `/activity/items?${query}`);
    const page = body === undefined ? null : decodeActivityPage(body);
    return page === null ? { kind: 'UNAVAILABLE' } : { kind: 'READ', ...page };
  }

  async readAttention(timeZone: string): Promise<ActivityAttentionOutcome> {
    const body = await this.request('GET', `/activity/attention?${new URLSearchParams({ timeZone })}`);
    const snapshot = body === undefined ? null : decodeAttention(body);
    return snapshot === null ? { kind: 'UNAVAILABLE' } : { kind: 'READ', snapshot };
  }

  async markSeen(itemIds: readonly string[]): Promise<boolean> {
    if (itemIds.length === 0 || !itemIds.every((id) => UUID.test(id))) return false;
    return (await this.status('POST', '/activity/items/seen', { itemIds })) === 204;
  }

  async open(itemId: string): Promise<ActivityOpenOutcome> {
    if (!UUID.test(itemId)) return { kind: 'GONE' };
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/activity/items/${itemId}/open`, {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}',
      });
    } catch {
      return { kind: 'FAILED' };
    }
    if (response.status === 404) return { kind: 'GONE' };
    if (!response.ok) return { kind: 'FAILED' };
    try {
      return decodeOpen(await response.json());
    } catch {
      return { kind: 'FAILED' };
    }
  }

  async recordStrip(presentedItemId: string | null, settledItemIds: readonly string[]): Promise<boolean> {
    return (await this.status('POST', '/activity/strip', { presentedItemId, settledItemIds })) === 204;
  }

  async readPreferences(): Promise<ActivityPreferencesOutcome> {
    return this.preferencesFrom(await this.request('GET', '/activity/preferences'));
  }

  async savePreferences(input: ActivityPreferencesInput): Promise<ActivityPreferencesOutcome> {
    return this.preferencesFrom(await this.request('PUT', '/activity/preferences', input));
  }

  /** `minutes` from the server's clock, or `null` to end Snooze. */
  async setSnooze(minutes: number | null): Promise<ActivityPreferencesOutcome> {
    return this.preferencesFrom(await this.request('PUT', '/activity/snooze', { minutes }));
  }

  private preferencesFrom(body: unknown): ActivityPreferencesOutcome {
    const preferences = body === undefined ? null : decodePreferences(body);
    return preferences === null ? { kind: 'UNAVAILABLE' } : { kind: 'READ', preferences };
  }

  private async status(method: string, path: string, payload: unknown): Promise<number> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method, headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      return response.status;
    } catch {
      return 0;
    }
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
