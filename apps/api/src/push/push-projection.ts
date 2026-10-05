import { lockSubjectOf } from '../activity/activity-decision';
import { INTERRUPTION_FRESHNESS_MS, type ActivityCategory, type DisclosureLevel, type LockSubject } from '../activity/activity.types';
import type { ClaimedItem, PlatformMessage, PushChannelId, PushLocale } from './push.types';

/**
 * A3-02 — the bounded safe projection a platform notification may carry (I-08N-01 D14–D17, §10; P3 §10, §10.2).
 *
 * "Native outside, QANDEEL inside": QANDEEL owns only the WORDS it hands the platform, and it never relies on the device
 * to hide what its own level must not say. So the message itself is rendered at the level A3-01's `disclosureLevel`
 * returned — the lower of the reader's ceiling and the event's own projection, never raised by importance — and the
 * OS can only ever show less.
 *
 *   L0  «إشعار جديد» / New notification — the same words for every category, on the neutral channel
 *   L1  the category's generic line only (p3.generic.*) — no context, no content
 *   L2  a context title + the producer's bounded sentence ("where and who did what, without the content")
 *   L3  L2 + the producer's secondary line (a content preview)
 *
 * Every fixed string below is Product-approved, byte-exact from the P4-C3 copy registry (status approved by P4-C4) or
 * CANON; the API contract pins each against the registry. The L2 / L3 sentences are the producer's own bounded
 * rendering (A3-01 `ActivityCandidate.body` / `.secondary`), which a producer may publish at `disclosureMax` L2 / L3 only
 * when that sentence is safe at that level (D17) — no producer exists yet (A3-01 record §3.2).
 */
export const LOCK_SCREEN_COPY = Object.freeze({
  /** p3.l0 */
  l0: { ar: 'إشعار جديد', en: 'New notification' },
  /** p3.generic.* — the L1 line per Lock Screen subject (D15). */
  generic: {
    QANDEEL: { ar: 'رسالة من قنديل', en: 'A message from QANDEEL' },
    SHARED: { ar: 'نشاط جديد في العالم المشترك', en: 'New activity in Shared World' },
    PUBLIC: { ar: 'نشاط جديد في العالم العام', en: 'New activity in the Public World' },
    DISCOVERY: { ar: 'جديد في العالم العام', en: 'Something new in the Public World' },
    INTRODUCTIONS: { ar: 'تحديث في التعارف', en: 'An Introductions update' },
    REMINDERS: { ar: 'تذكير', en: 'Reminder' },
    ACCOUNT: { ar: 'تحديث في الحساب', en: 'Account update' },
    SECURITY: { ar: 'تنبيه أمان', en: 'Security alert' },
  } satisfies Record<LockSubject, { ar: string; en: string }>,
  /**
   * The L2 title when the producer gave no context label: p3.ctxTitle.reminder / .system / .security, and the CANON
   * product / World / capability names (p3.lockSubjects.*) for the rest.
   */
  title: {
    QANDEEL: { ar: 'قنديل', en: 'QANDEEL' },
    SHARED: { ar: 'العالم المشترك', en: 'Shared World' },
    PUBLIC: { ar: 'العالم العام', en: 'Public World' },
    DISCOVERY: { ar: 'العالم العام', en: 'Public World' },
    INTRODUCTIONS: { ar: 'التعارف', en: 'Introductions' },
    REMINDERS: { ar: 'تذكير', en: 'Reminder' },
    ACCOUNT: { ar: 'الحساب', en: 'Account' },
    SECURITY: { ar: 'الأمان', en: 'Security' },
  } satisfies Record<LockSubject, { ar: string; en: string }>,
});

/**
 * Android channel names: the CANON / approved Activity filter names (p3.filters.*, the same words the reader sees in
 * Activity), and the CANON product name for the neutral L0 channel. The device registers them; the server only names
 * the channel id.
 */
export const CHANNEL_OF_CATEGORY: Readonly<Record<ActivityCategory, PushChannelId>> = Object.freeze({
  QANDEEL: 'category-qandeel', SHARED: 'category-shared', PUBLIC: 'category-public', INTRODUCTIONS: 'category-introductions',
  SYSTEM: 'category-system',
});

const pick = (pair: { readonly ar: string | null; readonly en: string | null }, locale: PushLocale): string | null =>
  (locale === 'ar' ? pair.ar ?? pair.en : pair.en ?? pair.ar);

/** D59 + the A3-01 freshness bound: how long a provider may keep the message. Zero means "do not send". */
export function ttlSecondsOf(item: Pick<ClaimedItem, 'expires_at' | 'last_occurred_at'>, now: number): number {
  const fresh = Date.parse(item.last_occurred_at) + INTERRUPTION_FRESHNESS_MS;
  const expires = item.expires_at === null ? fresh : Math.min(fresh, Date.parse(item.expires_at));
  return Math.max(0, Math.floor((expires - now) / 1000));
}

/** Renders ONE item for ONE device at ONE level. The level is the caller's (A3-01 `disclosureLevel`); this never raises it. */
export function projectForPlatform(item: ClaimedItem, level: DisclosureLevel, locale: PushLocale, now: number): PlatformMessage {
  const subject = lockSubjectOf(item);
  const neutral = level === 'L0';
  const channel: PushChannelId = neutral ? 'qandeel' : CHANNEL_OF_CATEGORY[item.category];
  let title: string | null = null;
  let body: string;
  if (level === 'L0') {
    body = LOCK_SCREEN_COPY.l0[locale];
  } else if (level === 'L1') {
    body = LOCK_SCREEN_COPY.generic[subject][locale];
  } else {
    title = pick({ ar: item.context_label_ar, en: item.context_label_en }, locale) ?? LOCK_SCREEN_COPY.title[subject][locale];
    const sentence = pick({ ar: item.body_ar, en: item.body_en }, locale);
    // A producer's sentence is required by 0136; if it were ever absent, the generic line is the safe fallback.
    body = sentence ?? LOCK_SCREEN_COPY.generic[subject][locale];
    if (level === 'L3') {
      const preview = pick({ ar: item.secondary_ar, en: item.secondary_en }, locale);
      if (preview !== null) body = `${body}\n${preview}`;
    }
  }
  return {
    level, title, body, androidChannel: channel, threadId: channel,
    data: { qandeel: 'a3', item: item.id }, collapseId: item.id, ttlSeconds: ttlSecondsOf(item, now),
  };
}
