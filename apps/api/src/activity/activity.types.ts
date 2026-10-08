/**
 * A3-01 — the Product notification / Activity vocabulary (I-08N-01 + P3). Every value here is a Product fact the frozen
 * contracts name; none is a score, weight or threshold.
 */

/** I-08N-01 D28 / D30 — the five semantic categories. Activity is never a World. */
export const ACTIVITY_CATEGORIES = ['QANDEEL', 'SHARED', 'PUBLIC', 'INTRODUCTIONS', 'SYSTEM'] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

/** The candidate kind: which frozen eligibility row (D23–D27) the source domain publishes under. */
export const ACTIVITY_KINDS = [
  'PROACTIVE', 'REMINDER', 'SHARED_ACTIVITY', 'PUBLIC_INTERACTION', 'PUBLIC_DISCOVERY', 'INTRODUCTION', 'ACCOUNT', 'SECURITY',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const KIND_CATEGORY: Readonly<Record<ActivityKind, ActivityCategory>> = Object.freeze({
  PROACTIVE: 'QANDEEL', REMINDER: 'QANDEEL', SHARED_ACTIVITY: 'SHARED', PUBLIC_INTERACTION: 'PUBLIC',
  PUBLIC_DISCOVERY: 'PUBLIC', INTRODUCTION: 'INTRODUCTIONS', ACCOUNT: 'SYSTEM', SECURITY: 'SYSTEM',
});

/** D10 — interruption value, supplied by the producer. */
export type InterruptionClass = 1 | 2 | 3 | 4;

export type ActivityContextKind = 'PERSONAL' | 'SHARED_WORLD' | 'PUBLIC_WORLD' | 'INTRODUCTIONS' | 'ACCOUNT';
export const CATEGORY_CONTEXT: Readonly<Record<ActivityCategory, ActivityContextKind>> = Object.freeze({
  QANDEEL: 'PERSONAL', SHARED: 'SHARED_WORLD', PUBLIC: 'PUBLIC_WORLD', INTRODUCTIONS: 'INTRODUCTIONS', SYSTEM: 'ACCOUNT',
});

/**
 * D38–D43 — the ONE typed Direct Entry descriptor. Every destination is typed now; only the ones a production surface
 * exists for execute. The rest fail closed (UNAVAILABLE) until their Stage owns a surface — nothing here builds one.
 * S4-04 (Stage 4) makes SHARED_WORLD executable: the exact World, re-authorized by the Shared entry verdict at open.
 * S5-04 (Stage 5) makes PUBLIC_WORLD executable: the exact Public Experience discussion or relation context, re-authorized
 * by the Public domain's own reads at open. REPLAY stays closed (generic Replay Product integration is Stage 7), as do
 * Introductions (6).
 */
export const ENTRY_DESTINATIONS = [
  'NONE', 'PERSONAL_CONVERSATION', 'QANDEEL_UNDERSTANDING', 'GENERAL_SETTINGS', 'SHARED_WORLD', 'PUBLIC_WORLD',
  'INTRODUCTIONS', 'REPLAY',
] as const;
export type EntryDestination = (typeof ENTRY_DESTINATIONS)[number];
export const EXECUTABLE_DESTINATIONS: ReadonlySet<EntryDestination> = new Set(['PERSONAL_CONVERSATION', 'QANDEEL_UNDERSTANDING', 'GENERAL_SETTINGS', 'SHARED_WORLD', 'PUBLIC_WORLD']);
export const SETTINGS_SECTIONS = ['SECURITY', 'ACCOUNT', 'NOTIFICATIONS'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/** Which destinations each context may name (D43: Direct Entry never leaves its own authority scope). */
export const CONTEXT_DESTINATIONS: Readonly<Record<ActivityContextKind, readonly EntryDestination[]>> = Object.freeze({
  PERSONAL: ['NONE', 'PERSONAL_CONVERSATION', 'QANDEEL_UNDERSTANDING'],
  SHARED_WORLD: ['NONE', 'SHARED_WORLD', 'REPLAY'],
  PUBLIC_WORLD: ['NONE', 'PUBLIC_WORLD'],
  INTRODUCTIONS: ['NONE', 'INTRODUCTIONS'],
  ACCOUNT: ['NONE', 'GENERAL_SETTINGS'],
});

/** D14 — disclosure levels, ordered. */
export const DISCLOSURE_LEVELS = ['L0', 'L1', 'L2', 'L3'] as const;
export type DisclosureLevel = (typeof DISCLOSURE_LEVELS)[number];

/** D15 / P3 §10 — the Lock Screen ceiling subjects. */
export const LOCK_SUBJECTS = ['QANDEEL', 'SHARED', 'PUBLIC', 'DISCOVERY', 'INTRODUCTIONS', 'REMINDERS', 'ACCOUNT', 'SECURITY'] as const;
export type LockSubject = (typeof LOCK_SUBJECTS)[number];
/** D15 verbatim. L3 is never a default. */
export const LOCK_DEFAULTS: Readonly<Record<LockSubject, DisclosureLevel>> = Object.freeze({
  QANDEEL: 'L1', SHARED: 'L2', PUBLIC: 'L2', DISCOVERY: 'L1', INTRODUCTIONS: 'L0', REMINDERS: 'L2', ACCOUNT: 'L2', SECURITY: 'L2',
});

export type ProactiveChoice = 'ALLOW' | 'REDUCE' | 'OFF';

/** The user's notification preferences, as the API and the decision layer read them. */
export interface ActivityPreferences {
  readonly proactive: ProactiveChoice;
  readonly sharedAlerts: boolean;
  readonly publicInteractions: boolean;
  readonly publicDiscovery: boolean;
  readonly introductionsAlerts: boolean;
  readonly accountUpdates: boolean;
  readonly quietHours: { readonly enabled: boolean; readonly start: number; readonly end: number };
  readonly snoozeUntil: string | null;
  readonly lock: Readonly<Record<LockSubject, DisclosureLevel>>;
}

/** P3 §12–§13 frozen defaults (Quiet Hours ON 23:00 → 08:00; Public Discovery OFF). */
export const DEFAULT_PREFERENCES: ActivityPreferences = Object.freeze({
  proactive: 'ALLOW', sharedAlerts: true, publicInteractions: true, publicDiscovery: false, introductionsAlerts: true,
  accountUpdates: true, quietHours: Object.freeze({ enabled: true, start: 23 * 60, end: 8 * 60 }), snoozeUntil: null,
  lock: LOCK_DEFAULTS,
});

/** Attention state on the projection (D31): never the source event's state. */
export type AttentionState = 'NEW' | 'SEEN' | 'OPENED';

/** The projection row the API reads (owner SELECT under RLS). Server-only fields are never selected. */
export interface ActivityItemRow {
  readonly id: string;
  readonly category: ActivityCategory;
  readonly kind: ActivityKind;
  readonly interruption_class: number;
  readonly critical: boolean;
  readonly requested: boolean;
  readonly context_kind: ActivityContextKind;
  readonly context_ref: string | null;
  readonly context_label_ar: string | null;
  readonly context_label_en: string | null;
  readonly entry_destination: EntryDestination;
  readonly entry_ref: string | null;
  readonly speaker: 'QANDEEL' | 'PRODUCT';
  readonly body_ar: string | null;
  readonly body_en: string | null;
  readonly secondary_ar: string | null;
  readonly secondary_en: string | null;
  readonly actionable: boolean;
  readonly disclosure_max: DisclosureLevel;
  readonly member_count: number;
  readonly occurred_at: string;
  readonly last_occurred_at: string;
  readonly expires_at: string | null;
  readonly withdrawn_at: string | null;
  readonly attention: AttentionState;
  readonly presented_in_app_at: string | null;
  readonly interruption_settled_at: string | null;
}

export interface BilingualText { readonly ar: string | null; readonly en: string | null }

/** One Activity row as the Product shows it. Presence and words only; no count, no internal reference. */
export interface ActivityItemView {
  readonly id: string;
  readonly category: ActivityCategory;
  readonly speaker: 'QANDEEL' | 'PRODUCT';
  readonly at: string;
  readonly context: BilingualText | null;
  readonly body: BilingualText;
  readonly secondary: BilingualText | null;
  readonly attention: AttentionState;
  /** P3 §4: the item needs the user (it keeps a WAITING mark once seen, until opened). */
  readonly actionable: boolean;
  /** P3 §4: seen, still needs the user (an actionable item not yet opened). */
  readonly waiting: boolean;
  readonly stale: boolean;
  /** D34: the item's Shared World is muted («مكتوم»). */
  readonly muted: boolean;
  /** The attention mark (P3 §6): attention state, never event state (D44). */
  readonly mark: boolean;
  /** Whether the row body is a Direct Entry now: AVAILABLE executes, UNAVAILABLE fails closed, NONE has none. */
  readonly entry: 'AVAILABLE' | 'UNAVAILABLE' | 'NONE';
}

export interface ActivityPageView {
  readonly items: readonly ActivityItemView[];
  /** The keyset cursor for the next (older) page, or null when there is none. */
  readonly before: string | null;
}

/** P3 §6 — global presence only (no count field exists, by construction); category indicators per the frozen table. */
export interface ActivityIndicatorsView {
  readonly present: boolean;
  readonly categories: {
    readonly QANDEEL: { readonly present: boolean };
    readonly SHARED: { readonly present: boolean; readonly count: number | null };
    readonly PUBLIC: { readonly present: boolean };
    readonly INTRODUCTIONS: { readonly present: boolean };
    readonly SYSTEM: { readonly present: boolean; readonly count: number | null };
  };
}

/** One currently interruption-eligible item, for the client's foreground presentation decision. */
export interface InterruptionCandidateView {
  readonly item: ActivityItemView;
  readonly interruptionClass: InterruptionClass;
  readonly contextKind: ActivityContextKind;
  /** P3 §9: one of the two call-safe exceptions. */
  readonly callSafe: boolean;
}

export interface ActivityAttentionView extends ActivityIndicatorsView {
  readonly interruptions: readonly InterruptionCandidateView[];
}

/** S5-04 — the exact Public context a Public item opens: one Experience's discussion, or the reader's relation management. */
export type PublicEntryTarget = { readonly kind: 'DISCUSSION'; readonly experienceId: string } | { readonly kind: 'RELATIONS'; readonly relationId: string };

export type ActivityOpenView =
  | { readonly outcome: 'ENTER'; readonly destination: { readonly kind: 'PERSONAL_CONVERSATION' | 'QANDEEL_UNDERSTANDING' } | { readonly kind: 'GENERAL_SETTINGS'; readonly section: SettingsSection } | { readonly kind: 'SHARED_WORLD'; readonly worldId: string } | { readonly kind: 'PUBLIC_WORLD'; readonly target: PublicEntryTarget } }
  | { readonly outcome: 'STALE' | 'UNAVAILABLE' | 'NO_ENTRY'; readonly fallback: { readonly kind: 'PERSONAL_CONVERSATION' } | { readonly kind: 'GENERAL_SETTINGS'; readonly section: SettingsSection } | null };

export interface ActivityPreferencesView {
  readonly proactive: ProactiveChoice;
  readonly shared: { readonly alerts: boolean };
  readonly public: { readonly interactions: boolean; readonly discovery: boolean };
  /** D26 / P3 §12.2: drawn only once the capability is legitimately entered. */
  readonly introductions: { readonly available: boolean; readonly alerts: boolean };
  readonly account: { readonly updates: boolean };
  readonly quietHours: { readonly enabled: boolean; readonly start: string; readonly end: string };
  readonly snoozeUntil: string | null;
  readonly lockScreen: Readonly<Record<LockSubject, DisclosureLevel>>;
}

// Bounds (implementation policy; none is Product law).
export const ACTIVITY_PAGE_DEFAULT_LIMIT = 30;
export const ACTIVITY_PAGE_MAX_LIMIT = 50;
export const ACTIVITY_SEEN_MAX = 64;
export const ACTIVITY_SETTLE_MAX = 64;
export const ACTIVITY_ATTENTION_READ_MAX = 500;
export const ACTIVITY_MUTES_READ_MAX = 500;
export const ACTIVITY_INTERRUPTIONS_MAX = 8;
/** A transient in-app interruption is for what is happening now; an older item stays an Activity item. */
export const INTERRUPTION_FRESHNESS_MS = 24 * 60 * 60 * 1000;
export const SNOOZE_MAX_MINUTES = 7 * 24 * 60;
