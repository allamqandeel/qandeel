/**
 * IP-IMP-01 — the Interaction Preferences vocabulary the page iterates: the four fields in the page's order and each
 * field's approved values, Automatic (`DEFAULT`) first. The wire types are the runtime-entry layer's own.
 */
import type { InteractionPreferenceField, InteractionPreferences } from '../runtime-entry';

export const INTERACTION_PREFERENCE_FIELDS: readonly InteractionPreferenceField[] = Object.freeze(['REPLY_LENGTH', 'REPLY_LANGUAGE', 'HUMOUR', 'EXPLANATION_STYLE']);
export const INTERACTION_PREFERENCE_VALUES: Readonly<Record<InteractionPreferenceField, readonly string[]>> = Object.freeze({
  REPLY_LENGTH: Object.freeze(['DEFAULT', 'ALWAYS_BRIEF']),
  REPLY_LANGUAGE: Object.freeze(['DEFAULT', 'EGYPTIAN_ARABIC', 'MODERN_STANDARD_ARABIC', 'LEVANTINE_ARABIC', 'GULF_ARABIC', 'MAGHREBI_ARABIC', 'ENGLISH']),
  HUMOUR: Object.freeze(['DEFAULT', 'WELCOME', 'DECLINED']),
  EXPLANATION_STYLE: Object.freeze(['DEFAULT', 'SIMPLER', 'DIRECT', 'SIMPLER_AND_DIRECT']),
});
/** The record key of each field. */
export const INTERACTION_PREFERENCE_KEYS: Readonly<Record<InteractionPreferenceField, keyof InteractionPreferences>> = Object.freeze({
  REPLY_LENGTH: 'replyLength', REPLY_LANGUAGE: 'replyLanguage', HUMOUR: 'humour', EXPLANATION_STYLE: 'explanationStyle',
});
