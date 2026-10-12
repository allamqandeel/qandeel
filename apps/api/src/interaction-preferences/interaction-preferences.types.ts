// IP-IMP-01 — Interaction Preferences: the ONE owner-only canonical record of the four durable interaction preferences
// the owner explicitly declared (migration 0153). `DEFAULT` means "no durable declaration" (Automatic). Nothing here is
// inferred: a value exists only because the owner chose it in Settings, said it as an explicit durable command in the
// conversation, or adopted one of their own SELF legacy Memories through the optional review.

export const INTERACTION_PREFERENCE_FIELDS = ['REPLY_LENGTH', 'REPLY_LANGUAGE', 'HUMOUR', 'EXPLANATION_STYLE'] as const;
export type InteractionPreferenceField = typeof INTERACTION_PREFERENCE_FIELDS[number];

export const INTERACTION_PREFERENCE_VALUES = {
  REPLY_LENGTH: ['DEFAULT', 'ALWAYS_BRIEF'],
  REPLY_LANGUAGE: ['DEFAULT', 'EGYPTIAN_ARABIC', 'MODERN_STANDARD_ARABIC', 'LEVANTINE_ARABIC', 'GULF_ARABIC', 'MAGHREBI_ARABIC', 'ENGLISH'],
  HUMOUR: ['DEFAULT', 'WELCOME', 'DECLINED'],
  EXPLANATION_STYLE: ['DEFAULT', 'SIMPLER', 'DIRECT', 'SIMPLER_AND_DIRECT'],
} as const satisfies Readonly<Record<InteractionPreferenceField, readonly string[]>>;

export type ReplyLength = typeof INTERACTION_PREFERENCE_VALUES.REPLY_LENGTH[number];
export type ReplyLanguage = typeof INTERACTION_PREFERENCE_VALUES.REPLY_LANGUAGE[number];
export type Humour = typeof INTERACTION_PREFERENCE_VALUES.HUMOUR[number];
export type ExplanationStyle = typeof INTERACTION_PREFERENCE_VALUES.EXPLANATION_STYLE[number];
export type InteractionPreferenceValue = ReplyLength | ReplyLanguage | Humour | ExplanationStyle;

export interface InteractionPreferences {
  readonly replyLength: ReplyLength;
  readonly replyLanguage: ReplyLanguage;
  readonly humour: Humour;
  readonly explanationStyle: ExplanationStyle;
}

/** The canonical record as read: the four values and the version a compare-and-set must name. No row = version 0. */
export interface InteractionPreferenceRecord {
  readonly preferences: InteractionPreferences;
  readonly version: number;
}

export const DEFAULT_INTERACTION_PREFERENCES: InteractionPreferences = Object.freeze({
  replyLength: 'DEFAULT', replyLanguage: 'DEFAULT', humour: 'DEFAULT', explanationStyle: 'DEFAULT',
});

export const PREFERENCE_KEY: Readonly<Record<InteractionPreferenceField, keyof InteractionPreferences>> = Object.freeze({
  REPLY_LENGTH: 'replyLength', REPLY_LANGUAGE: 'replyLanguage', HUMOUR: 'humour', EXPLANATION_STYLE: 'explanationStyle',
});

/** What the database decided (0153 `apply_v1`): changed, already held (idempotent), or refused as stale. */
export type InteractionPreferenceOutcome = 'SAVED' | 'UNCHANGED' | 'STALE';
export const INTERACTION_PREFERENCE_OUTCOMES: ReadonlySet<string> = new Set(['SAVED', 'UNCHANGED', 'STALE']);
/** The legacy review adds one more: the Memory is no longer the owner's ACTIVE SELF INTERACTION_PREFERENCE. */
export type LegacyReviewOutcome = InteractionPreferenceOutcome | 'NOT_ELIGIBLE';

export function isPreferenceField(value: unknown): value is InteractionPreferenceField {
  return typeof value === 'string' && (INTERACTION_PREFERENCE_FIELDS as readonly string[]).includes(value);
}

export function isPreferenceValue(field: InteractionPreferenceField, value: unknown): value is InteractionPreferenceValue {
  return typeof value === 'string' && (INTERACTION_PREFERENCE_VALUES[field] as readonly string[]).includes(value);
}

/** A durable conversation command the interpreter recognised: exactly one field set to one value (DEFAULT = reset). */
export interface InteractionPreferenceCommand {
  readonly field: InteractionPreferenceField;
  readonly value: InteractionPreferenceValue;
  readonly language: 'ar' | 'en';
}

/** The fully planned conversation command: the change, the version it was planned against and every possible reply. */
export interface InteractionPreferenceCommandPlan {
  readonly field: InteractionPreferenceField;
  readonly value: InteractionPreferenceValue;
  readonly expectedVersion: number;
  readonly replyIfSaved: string;
  readonly replyIfUnchanged: string;
  readonly replyIfStale: string;
}
