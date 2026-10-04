import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  INTRODUCTIONS_ENTERED, interruptionVerdict, isCallSafe, isExecutable, isStale, isWaiting, markOf, silenceOf,
} from './activity-decision';
import { ActivityRepository, type ActivityAnchor, type ActivityPreferencesRow } from './activity.repository';
import {
  ACTIVITY_CATEGORIES, ACTIVITY_INTERRUPTIONS_MAX, ACTIVITY_PAGE_DEFAULT_LIMIT, ACTIVITY_PAGE_MAX_LIMIT, ACTIVITY_SEEN_MAX,
  ACTIVITY_SETTLE_MAX, DEFAULT_PREFERENCES, DISCLOSURE_LEVELS, LOCK_SUBJECTS, SETTINGS_SECTIONS, SNOOZE_MAX_MINUTES,
  type ActivityAttentionView, type ActivityCategory, type ActivityItemRow, type ActivityItemView, type ActivityOpenView,
  type ActivityPageView, type ActivityPreferences, type ActivityPreferencesView, type DisclosureLevel, type InterruptionClass,
  type LockSubject, type ProactiveChoice, type SettingsSection,
} from './activity.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const TIME = /^([01][0-9]|2[0-3]):([0-5][0-9])$/u;
const PROACTIVE: readonly ProactiveChoice[] = ['ALLOW', 'REDUCE', 'OFF'];
const LOCK_COLUMN: Readonly<Record<LockSubject, keyof ActivityPreferencesRow>> = {
  QANDEEL: 'lock_qandeel', SHARED: 'lock_shared', PUBLIC: 'lock_public', DISCOVERY: 'lock_discovery',
  INTRODUCTIONS: 'lock_introductions', REMINDERS: 'lock_reminders', ACCOUNT: 'lock_account', SECURITY: 'lock_security',
};

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const exactKeys = (value: Record<string, unknown>, allowed: readonly string[], required: readonly string[] = allowed) => {
  if (Object.keys(value).some((key) => !allowed.includes(key)) || required.some((key) => !(key in value))) invalid();
};
const hhmm = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const isLevel = (value: unknown): value is DisclosureLevel => typeof value === 'string' && (DISCLOSURE_LEVELS as readonly string[]).includes(value);

/** An IANA zone the runtime can resolve. Anything else is a refusal — a device-local rule is never guessed in UTC. */
export function validTimeZone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 1 || value.length > 64 || !/^[A-Za-z0-9_+\-/]+$/u.test(value)) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

/**
 * A3-01 — the owner-only Activity application boundary (I-08N-01 + P3). Identity is the verified token only; no route
 * takes a user id. Attention state and preferences are the only things a caller can change, and no answer carries a
 * global count, an internal reference or another account's anything.
 */
@Injectable()
export class ActivityService {
  constructor(private readonly repository: ActivityRepository) {}

  async page(userId: string, token: string, query: unknown): Promise<ActivityPageView> {
    const value = record(query);
    exactKeys(value, ['limit', 'before', 'category'], []);
    const limit = value.limit === undefined ? ACTIVITY_PAGE_DEFAULT_LIMIT
      : typeof value.limit === 'string' && /^[1-9][0-9]?$/u.test(value.limit) && Number(value.limit) <= ACTIVITY_PAGE_MAX_LIMIT ? Number(value.limit) : invalid();
    const category = value.category === undefined ? null
      : typeof value.category === 'string' && (ACTIVITY_CATEGORIES as readonly string[]).includes(value.category) ? value.category as ActivityCategory : invalid();
    const before = value.before === undefined ? null : typeof value.before === 'string' && UUID.test(value.before) ? value.before : invalid();
    return this.guard(async () => {
      let anchor: ActivityAnchor | null = null;
      if (before !== null) {
        const rows = await this.repository.anchor(token, userId, before);
        if (!Array.isArray(rows) || rows.length !== 1) throw new BadRequestException({ outcome: 'INVALID_REQUEST' });
        anchor = rows[0];
      }
      const [rows, prefs, mutes] = await Promise.all([
        this.repository.page(token, userId, limit, category, anchor), this.preferencesOf(token, userId), this.mutesOf(token, userId),
      ]);
      if (!Array.isArray(rows)) throw new Error('ACTIVITY_PAGE_MALFORMED');
      const now = Date.now();
      const items = rows.slice(0, limit).map((row) => this.view(row, prefs, mutes, now));
      return { items, before: rows.length > limit ? items[items.length - 1].id : null };
    });
  }

  /**
   * The attention summary and the currently interruption-eligible items (by everything the server knows). `timeZone`
   * is the device's own IANA zone: Quiet Hours are device-local (P3 §13).
   */
  async attention(userId: string, token: string, query: unknown): Promise<ActivityAttentionView> {
    const value = record(query);
    exactKeys(value, ['timeZone']);
    const timeZone = validTimeZone(value.timeZone) ?? invalid();
    return this.guard(async () => {
      const [rows, prefs, mutes] = await Promise.all([
        this.repository.attentionItems(token, userId), this.preferencesOf(token, userId), this.mutesOf(token, userId),
      ]);
      if (!Array.isArray(rows)) throw new Error('ACTIVITY_ATTENTION_MALFORMED');
      const now = Date.now();
      const marked = rows.filter((row) => markOf(row, prefs, mutes, now));
      const by = (category: ActivityCategory) => marked.filter((row) => row.category === category);
      const eligible = rows.filter((row) => interruptionVerdict(row, { prefs, mutes, now, timeZone }) === 'ELIGIBLE')
        .sort((a, b) => a.interruption_class - b.interruption_class || Date.parse(b.last_occurred_at) - Date.parse(a.last_occurred_at))
        .slice(0, ACTIVITY_INTERRUPTIONS_MAX);
      const shared = by('SHARED').length;
      const actionableSystem = by('SYSTEM').filter((row) => row.actionable).length;
      return {
        // D45: derived from eligible attention items — presence, never a sum.
        present: marked.length > 0,
        categories: {
          QANDEEL: { present: by('QANDEEL').length > 0 },
          // P3 §6: one coalesced row counts once (rows, not members).
          SHARED: { present: shared > 0, count: shared > 0 ? shared : null },
          PUBLIC: { present: by('PUBLIC').length > 0 },
          // D48: presence only — never a candidate or inventory count.
          INTRODUCTIONS: { present: by('INTRODUCTIONS').length > 0 },
          SYSTEM: { present: by('SYSTEM').length > 0, count: actionableSystem > 0 ? actionableSystem : null },
        },
        interruptions: eligible.map((row) => ({
          item: this.view(row, prefs, mutes, now), interruptionClass: row.interruption_class as InterruptionClass,
          contextKind: row.context_kind, callSafe: isCallSafe(row),
        })),
      };
    });
  }

  async markSeen(token: string, body: unknown): Promise<void> {
    const value = record(body);
    exactKeys(value, ['itemIds']);
    const ids = this.uuidList(value.itemIds, 1, ACTIVITY_SEEN_MAX);
    await this.guard(() => this.repository.markSeen(token, ids));
  }

  /** D38–D40: opening is attention (OPENED); the destination is revalidated NOW; nothing is resolved. */
  async open(token: string, itemId: unknown): Promise<ActivityOpenView> {
    if (typeof itemId !== 'string' || !UUID.test(itemId)) throw new NotFoundException('Activity item not found.');
    return this.guard(async () => {
      const rows = await this.repository.open(token, itemId);
      const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
      if (row === null || row.outcome === 'NOT_FOUND') throw new NotFoundException('Activity item not found.');
      const fallback = row.context_kind === 'PERSONAL' ? { kind: 'PERSONAL_CONVERSATION' as const }
        : row.context_kind === 'ACCOUNT' ? { kind: 'GENERAL_SETTINGS' as const, section: 'SECURITY' as const } : null;
      // D39: a stale target never gets a guessed destination — only a safe act into its own originating context.
      if (row.outcome === 'STALE') return { outcome: 'STALE', fallback };
      if (row.outcome !== 'OPENED') throw new Error('ACTIVITY_OPEN_MALFORMED');
      const destination = row.entry_destination;
      if (destination === 'NONE') return { outcome: 'NO_ENTRY', fallback: null };
      if (destination === 'PERSONAL_CONVERSATION' || destination === 'QANDEEL_UNDERSTANDING') return { outcome: 'ENTER', destination: { kind: destination } };
      if (destination === 'GENERAL_SETTINGS') {
        if (!(SETTINGS_SECTIONS as readonly string[]).includes(row.entry_ref ?? '')) throw new Error('ACTIVITY_OPEN_MALFORMED');
        return { outcome: 'ENTER', destination: { kind: 'GENERAL_SETTINGS', section: row.entry_ref as SettingsSection } };
      }
      // Typed future destinations (Shared / Public / Introductions / Replay): no production surface and no authority seam
      // exists yet, so they fail closed. Their Stage owns opening them.
      return { outcome: 'UNAVAILABLE', fallback: null };
    });
  }

  /** In-app presentation evidence: the one strip shown, and the candidates settled without one ("no dump"). */
  async recordStrip(token: string, body: unknown): Promise<void> {
    const value = record(body);
    exactKeys(value, ['presentedItemId', 'settledItemIds']);
    const presented = value.presentedItemId === null ? null
      : typeof value.presentedItemId === 'string' && UUID.test(value.presentedItemId) ? value.presentedItemId : invalid();
    const settled = this.uuidList(value.settledItemIds, 0, ACTIVITY_SETTLE_MAX);
    if ((presented === null && settled.length === 0) || (presented !== null && settled.includes(presented))) invalid();
    await this.guard(() => this.repository.recordStrip(token, presented, settled));
  }

  async readPreferences(userId: string, token: string): Promise<ActivityPreferencesView> {
    return this.guard(async () => this.preferencesView(await this.preferencesOf(token, userId)));
  }

  async savePreferences(userId: string, token: string, body: unknown): Promise<ActivityPreferencesView> {
    const value = record(body);
    exactKeys(value, ['proactive', 'shared', 'public', 'introductions', 'account', 'quietHours', 'lockScreen']);
    const proactive = PROACTIVE.includes(value.proactive as ProactiveChoice) ? value.proactive as ProactiveChoice : invalid();
    const flag = (group: unknown, key: string): boolean => {
      const g = record(group);
      exactKeys(g, [key]);
      return typeof g[key] === 'boolean' ? g[key] as boolean : invalid();
    };
    const pub = record(value.public);
    exactKeys(pub, ['interactions', 'discovery']);
    if (typeof pub.interactions !== 'boolean' || typeof pub.discovery !== 'boolean') invalid();
    const quiet = record(value.quietHours);
    exactKeys(quiet, ['enabled', 'start', 'end']);
    const start = typeof quiet.start === 'string' && TIME.test(quiet.start) ? quiet.start : invalid();
    const end = typeof quiet.end === 'string' && TIME.test(quiet.end) ? quiet.end : invalid();
    if (typeof quiet.enabled !== 'boolean' || start === end) invalid();
    const minute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    const lock = record(value.lockScreen);
    exactKeys(lock, LOCK_SUBJECTS);
    if (!LOCK_SUBJECTS.every((subject) => isLevel(lock[subject]))) invalid();
    const row = {
      proactive, shared_alerts: flag(value.shared, 'alerts'), public_interactions: pub.interactions as boolean,
      public_discovery: pub.discovery as boolean, introductions_alerts: flag(value.introductions, 'alerts'),
      account_updates: flag(value.account, 'updates'), quiet_hours_enabled: quiet.enabled as boolean,
      quiet_hours_start: minute(start), quiet_hours_end: minute(end),
      lock_qandeel: lock.QANDEEL, lock_shared: lock.SHARED, lock_public: lock.PUBLIC, lock_discovery: lock.DISCOVERY,
      lock_introductions: lock.INTRODUCTIONS, lock_reminders: lock.REMINDERS, lock_account: lock.ACCOUNT, lock_security: lock.SECURITY,
    } as Omit<ActivityPreferencesRow, 'snooze_until'>;
    return this.guard(async () => {
      await this.repository.savePreferences(token, row);
      return this.preferencesView(await this.preferencesOf(token, userId));
    });
  }

  /** Snooze for `minutes` from the SERVER's clock (1 h / 8 h / 24 h / custom, at most 7 days), or end it with null. */
  async setSnooze(userId: string, token: string, body: unknown): Promise<ActivityPreferencesView> {
    const value = record(body);
    exactKeys(value, ['minutes']);
    const minutes = value.minutes === null ? null
      : typeof value.minutes === 'number' && Number.isSafeInteger(value.minutes) && value.minutes >= 1 && value.minutes <= SNOOZE_MAX_MINUTES ? value.minutes : invalid();
    return this.guard(async () => {
      await this.repository.setSnooze(token, minutes === null ? null : new Date(Date.now() + minutes * 60_000).toISOString());
      return this.preferencesView(await this.preferencesOf(token, userId));
    });
  }

  /** D34: mute or unmute ONE Shared context the caller's own Activity already knows. */
  async setMute(token: string, body: unknown): Promise<{ readonly outcome: 'MUTED' | 'UNMUTED' }> {
    const value = record(body);
    exactKeys(value, ['contextRef', 'muted']);
    const ref = typeof value.contextRef === 'string' && value.contextRef.length >= 1 && value.contextRef.length <= 200 ? value.contextRef : invalid();
    if (typeof value.muted !== 'boolean') invalid();
    return this.guard(async () => {
      const rows = await this.repository.setMute(token, ref, value.muted as boolean);
      const outcome = Array.isArray(rows) && rows.length === 1 ? rows[0].outcome : null;
      if (outcome === 'UNKNOWN_CONTEXT') throw new NotFoundException('Context not found.');
      if (outcome !== 'MUTED' && outcome !== 'UNMUTED') throw new Error('ACTIVITY_MUTE_MALFORMED');
      return { outcome };
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  private view(row: ActivityItemRow, prefs: ActivityPreferences, mutes: ReadonlySet<string>, now: number): ActivityItemView {
    const stale = isStale(row, now);
    const pair = (ar: string | null, en: string | null) => (ar === null && en === null ? null : { ar, en });
    return {
      id: row.id, category: row.category, speaker: row.speaker, at: row.last_occurred_at,
      context: pair(row.context_label_ar, row.context_label_en),
      body: { ar: row.body_ar, en: row.body_en },
      secondary: pair(row.secondary_ar, row.secondary_en),
      attention: row.attention, actionable: row.actionable, waiting: isWaiting(row, now), stale,
      muted: silenceOf(row, prefs, mutes) === 'MUTED_CONTEXT',
      mark: markOf(row, prefs, mutes, now),
      entry: row.entry_destination === 'NONE' ? 'NONE' : !stale && isExecutable(row) ? 'AVAILABLE' : 'UNAVAILABLE',
    };
  }

  private async preferencesOf(token: string, userId: string): Promise<ActivityPreferences> {
    const rows = await this.repository.preferences(token, userId);
    if (!Array.isArray(rows)) throw new Error('ACTIVITY_PREFERENCES_MALFORMED');
    if (rows.length === 0) return DEFAULT_PREFERENCES;
    const row = rows[0];
    const lock = Object.fromEntries(LOCK_SUBJECTS.map((subject) => [subject, row[LOCK_COLUMN[subject]]]));
    if (!PROACTIVE.includes(row.proactive as ProactiveChoice) || !LOCK_SUBJECTS.every((s) => isLevel(lock[s]))) throw new Error('ACTIVITY_PREFERENCES_MALFORMED');
    return {
      proactive: row.proactive as ProactiveChoice, sharedAlerts: row.shared_alerts, publicInteractions: row.public_interactions,
      publicDiscovery: row.public_discovery, introductionsAlerts: row.introductions_alerts, accountUpdates: row.account_updates,
      quietHours: { enabled: row.quiet_hours_enabled, start: row.quiet_hours_start, end: row.quiet_hours_end },
      snoozeUntil: row.snooze_until, lock: lock as Record<LockSubject, DisclosureLevel>,
    };
  }

  private async mutesOf(token: string, userId: string): Promise<ReadonlySet<string>> {
    const rows = await this.repository.mutes(token, userId);
    if (!Array.isArray(rows)) throw new Error('ACTIVITY_MUTES_MALFORMED');
    return new Set(rows.map((row) => row.context_ref));
  }

  private preferencesView(prefs: ActivityPreferences): ActivityPreferencesView {
    const snoozed = prefs.snoozeUntil !== null && Date.parse(prefs.snoozeUntil) > Date.now();
    return {
      proactive: prefs.proactive,
      shared: { alerts: prefs.sharedAlerts },
      public: { interactions: prefs.publicInteractions, discovery: prefs.publicDiscovery },
      introductions: { available: INTRODUCTIONS_ENTERED, alerts: prefs.introductionsAlerts },
      account: { updates: prefs.accountUpdates },
      quietHours: { enabled: prefs.quietHours.enabled, start: hhmm(prefs.quietHours.start), end: hhmm(prefs.quietHours.end) },
      snoozeUntil: snoozed ? prefs.snoozeUntil : null,
      lockScreen: prefs.lock,
    };
  }

  private uuidList(value: unknown, min: number, max: number): string[] {
    if (!Array.isArray(value) || value.length < min || value.length > max || !value.every((id) => typeof id === 'string' && UUID.test(id))) invalid();
    const ids = value as string[];
    if (new Set(ids).size !== ids.length) invalid();
    return ids;
  }

  // Refusals the caller may see stay as they are (400, 404). Everything else — an upstream failure, a malformed row —
  // fails closed as one sanitized 503 that names nothing internal.
  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
    }
  }
}
