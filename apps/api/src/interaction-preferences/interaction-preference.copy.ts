import type { InteractionPreferenceField, InteractionPreferenceOutcome, InteractionPreferenceValue } from './interaction-preferences.types';

// IP-IMP-01 — the conversation command's deterministic replies. Every word below is the Product Owner's APPROVED
// IP-IMP-01 UI copy (labels and the three result messages), used verbatim. Only the composition — the result message
// followed by «<field label>: <value label>.» — is new, and is IP-IMP-01 PO Copy Addendum CA-1 (APPROVED).

type Language = 'ar' | 'en';

const FIELD_LABEL: Readonly<Record<Language, Readonly<Record<InteractionPreferenceField, string>>>> = {
  ar: { REPLY_LENGTH: 'طول الرد', REPLY_LANGUAGE: 'اللغة واللهجة', HUMOUR: 'الفكاهة', EXPLANATION_STYLE: 'طريقة الشرح' },
  en: { REPLY_LENGTH: 'Reply Length', REPLY_LANGUAGE: 'Reply Language & Dialect', HUMOUR: 'Humour', EXPLANATION_STYLE: 'Explanation Style' },
};

const VALUE_LABEL: Readonly<Record<Language, Readonly<Record<InteractionPreferenceField, Readonly<Record<string, string>>>>>> = {
  ar: {
    REPLY_LENGTH: { DEFAULT: 'تلقائي', ALWAYS_BRIEF: 'مختصر دائمًا' },
    REPLY_LANGUAGE: {
      DEFAULT: 'تلقائي', EGYPTIAN_ARABIC: 'مصري', MODERN_STANDARD_ARABIC: 'فصحى', LEVANTINE_ARABIC: 'شامي',
      GULF_ARABIC: 'خليجي', MAGHREBI_ARABIC: 'مغاربي', ENGLISH: 'إنجليزي',
    },
    HUMOUR: { DEFAULT: 'تلقائي', WELCOME: 'مرحب بها', DECLINED: 'بدون فكاهة' },
    EXPLANATION_STYLE: { DEFAULT: 'تلقائي', SIMPLER: 'مبسّط', DIRECT: 'مباشر', SIMPLER_AND_DIRECT: 'مبسّط ومباشر' },
  },
  en: {
    REPLY_LENGTH: { DEFAULT: 'Automatic', ALWAYS_BRIEF: 'Always brief' },
    REPLY_LANGUAGE: {
      DEFAULT: 'Automatic', EGYPTIAN_ARABIC: 'Egyptian Arabic', MODERN_STANDARD_ARABIC: 'Modern Standard Arabic',
      LEVANTINE_ARABIC: 'Levantine Arabic', GULF_ARABIC: 'Gulf Arabic', MAGHREBI_ARABIC: 'Maghrebi Arabic', ENGLISH: 'English',
    },
    HUMOUR: { DEFAULT: 'Automatic', WELCOME: 'Welcome', DECLINED: 'No humour' },
    EXPLANATION_STYLE: { DEFAULT: 'Automatic', SIMPLER: 'Simpler', DIRECT: 'Direct', SIMPLER_AND_DIRECT: 'Simple & direct' },
  },
};

const SAVED: Readonly<Record<Language, string>> = { ar: 'تم حفظ التفضيل.', en: 'Preference saved.' };
const RESET: Readonly<Record<Language, string>> = { ar: 'تمت إعادة التفضيل إلى تلقائي.', en: 'Preference reset to Automatic.' };
const NOT_SAVED: Readonly<Record<Language, string>> = { ar: 'لم يُحفظ التغيير. حاول مرة أخرى.', en: "Your change wasn't saved. Try again." };

/**
 * The reply for one committed outcome. SAVED and UNCHANGED both truthfully report the preference now in effect (an
 * UNCHANGED command found it already held); STALE is the not-saved message and never acknowledges a change.
 */
export function interactionPreferenceReply(
  language: Language, outcome: InteractionPreferenceOutcome, field: InteractionPreferenceField, value: InteractionPreferenceValue,
): string {
  if (outcome === 'STALE') return NOT_SAVED[language];
  const lead = value === 'DEFAULT' ? RESET[language] : SAVED[language];
  return `${lead} ${FIELD_LABEL[language][field]}: ${VALUE_LABEL[language][field][value]}.`;
}
