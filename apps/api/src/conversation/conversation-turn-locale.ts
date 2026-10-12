import { interpretExplicitReplyLanguageRequest } from '../interaction-preferences/interaction-preference-command.interpreter';
import type { InteractionPreferences, InteractionPreferenceValue } from '../interaction-preferences/interaction-preferences.types';

// ACE-01 (WP2) — the conversational request's `locale`, from reliable deterministic facts only.
//
// Pure, synchronous, provider-neutral and bounded (one pass over the current message): no I/O, no model, no classifier,
// nothing stored. It reports a LANGUAGE (`ar` | `en`), never a dialect and never a tone: Arabic script does not say
// Egyptian, Levantine, Gulf or Maghrebi, and nuanced dialect stays with the model in its one main generation, under the
// approved personality core and the owner's durable `replyLanguage` preference (the compiled guidance, IP-IMP-01).
//
// Precedence (P4): an explicit language request in the current message > the durable `replyLanguage` preference (0153) >
// a conservative script indication of the current message > `und`. Mixed, ambiguous or too-short text is `und`.
//
// `locale` is request metadata: no provider adapter renders it into the model input, so this changes no model-facing text.

export type ConversationLocale = 'ar' | 'en' | 'und';

export interface ConversationLocaleInput {
  readonly currentUserContent: string;
  readonly preferences: InteractionPreferences;
}

/** Fewer letters than this (e.g. «اه», "ok") is no reliable indication. */
export const MIN_SCRIPT_LETTERS = 3;

// The core Arabic letters U+0621–U+063A and U+0641–U+064A. Letters outside them — Persian / Urdu (پ چ ژ گ ک ی ے …),
// supplements, presentation forms — do not reliably indicate Arabic, so they make the indication `und`.
const ARABIC_LETTER = /[ء-غف-ي]/u;
// Harakat, superscript alef, tatweel, Arabic-Indic digits and Arabic punctuation carry no language signal.
const ARABIC_NEUTRAL = /[ً-ٰٟـ٠-٩،؛؟٪-٭]/u;
const ASCII_LETTER = /[A-Za-z]/u;
const ANY_LETTER = /\p{L}/u;
// Arabizi: a Latin word carrying a digit used as an Arabic letter («3ayez», «7elw», «2ana») is not English.
const ARABIZI_WORD = /(?:[A-Za-z][2356789]|[2356789][A-Za-z])/u;

const localeOfReplyLanguage = (value: InteractionPreferenceValue): ConversationLocale =>
  value === 'ENGLISH' ? 'en' : value === 'DEFAULT' ? 'und' : 'ar';

/** The conservative script indication of one message: a single reliable script, or `und`. */
export function scriptLocaleOf(content: string): ConversationLocale {
  let arabic = 0;
  let latin = 0;
  for (const character of content) {
    if (ARABIC_LETTER.test(character)) arabic += 1;
    else if (ASCII_LETTER.test(character)) latin += 1;
    else if (ARABIC_NEUTRAL.test(character)) continue;
    else if (ANY_LETTER.test(character)) return 'und';
  }
  if (arabic > 0 && latin > 0) return 'und';
  if (arabic >= MIN_SCRIPT_LETTERS) return 'ar';
  if (latin >= MIN_SCRIPT_LETTERS && !ARABIZI_WORD.test(content)) return 'en';
  return 'und';
}

export function resolveConversationLocale(input: ConversationLocaleInput): ConversationLocale {
  const explicit = interpretExplicitReplyLanguageRequest(input.currentUserContent);
  if (explicit !== null) return localeOfReplyLanguage(explicit);
  const durable = localeOfReplyLanguage(input.preferences.replyLanguage);
  if (durable !== 'und') return durable;
  return scriptLocaleOf(input.currentUserContent);
}
