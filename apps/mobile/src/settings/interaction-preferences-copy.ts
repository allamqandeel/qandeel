/**
 * IP-IMP-01 — «تفضيلات التعامل» / Interaction Preferences copy.
 *
 * APPROVED — PRODUCT OWNER (IP-IMP-01 R1 Task Contract, FINAL PRODUCT OWNER APPROVAL): every string below is the approved
 * UI copy table, verbatim. Nothing here may be reworded without a new Product decision. The seven reply languages /
 * dialects are all approved test candidates; their reply quality is proven in Stage 8A, and none may be removed.
 */
import type { ChromeLanguage } from '../orientation-chrome';
import type { InteractionPreferenceField } from '../runtime-entry';

export type CopyGateStatus = 'APPROVED BY THE PRODUCT OWNER — IP-IMP-01 R1 APPROVED UI COPY';

export interface InteractionPreferencesCopy {
  readonly row: string;
  readonly fields: Readonly<Record<InteractionPreferenceField, string>>;
  readonly values: Readonly<Record<InteractionPreferenceField, Readonly<Record<string, string>>>>;
  readonly review: string;
  readonly apply: string;
  readonly skip: string;
  readonly replace: string;
  readonly saved: string;
  readonly reset: string;
  readonly notSaved: string;
  readonly loadFailed: string;
  readonly noCandidates: string;
}

export const INTERACTION_PREFERENCES_COPY_GATE = Object.freeze({
  status: 'APPROVED BY THE PRODUCT OWNER — IP-IMP-01 R1 APPROVED UI COPY' as CopyGateStatus,
  ar: Object.freeze<InteractionPreferencesCopy>({
    row: 'تفضيلات التعامل',
    fields: { REPLY_LENGTH: 'طول الرد', REPLY_LANGUAGE: 'اللغة واللهجة', HUMOUR: 'الفكاهة', EXPLANATION_STYLE: 'طريقة الشرح' },
    values: {
      REPLY_LENGTH: { DEFAULT: 'تلقائي', ALWAYS_BRIEF: 'مختصر دائمًا' },
      REPLY_LANGUAGE: {
        DEFAULT: 'تلقائي', EGYPTIAN_ARABIC: 'مصري', MODERN_STANDARD_ARABIC: 'فصحى', LEVANTINE_ARABIC: 'شامي',
        GULF_ARABIC: 'خليجي', MAGHREBI_ARABIC: 'مغاربي', ENGLISH: 'إنجليزي',
      },
      HUMOUR: { DEFAULT: 'تلقائي', WELCOME: 'مرحب بها', DECLINED: 'بدون فكاهة' },
      EXPLANATION_STYLE: { DEFAULT: 'تلقائي', SIMPLER: 'مبسّط', DIRECT: 'مباشر', SIMPLER_AND_DIRECT: 'مبسّط ومباشر' },
    },
    review: 'مراجعة تفضيلات سابقة',
    apply: 'اعتماد التفضيل',
    skip: 'تخطي',
    replace: 'استبدال التفضيل الحالي',
    saved: 'تم حفظ التفضيل.',
    reset: 'تمت إعادة التفضيل إلى تلقائي.',
    // Arabic amended by LANG-01 CA-10 (IP-01).
    notSaved: 'لم يُحفظ التغيير. يمكنك المحاولة مرة أخرى.',
    // Arabic amended by LANG-01 CA-10 (IP-02).
    loadFailed: 'تعذّر تحميل تفضيلاتك. يمكنك المحاولة مرة أخرى.',
    noCandidates: 'لا توجد تفضيلات سابقة مؤهلة للمراجعة.',
  }),
  en: Object.freeze<InteractionPreferencesCopy>({
    row: 'Interaction Preferences',
    fields: { REPLY_LENGTH: 'Reply Length', REPLY_LANGUAGE: 'Reply Language & Dialect', HUMOUR: 'Humour', EXPLANATION_STYLE: 'Explanation Style' },
    values: {
      REPLY_LENGTH: { DEFAULT: 'Automatic', ALWAYS_BRIEF: 'Always brief' },
      REPLY_LANGUAGE: {
        DEFAULT: 'Automatic', EGYPTIAN_ARABIC: 'Egyptian Arabic', MODERN_STANDARD_ARABIC: 'Modern Standard Arabic',
        LEVANTINE_ARABIC: 'Levantine Arabic', GULF_ARABIC: 'Gulf Arabic', MAGHREBI_ARABIC: 'Maghrebi Arabic', ENGLISH: 'English',
      },
      HUMOUR: { DEFAULT: 'Automatic', WELCOME: 'Welcome', DECLINED: 'No humour' },
      EXPLANATION_STYLE: { DEFAULT: 'Automatic', SIMPLER: 'Simpler', DIRECT: 'Direct', SIMPLER_AND_DIRECT: 'Simple & direct' },
    },
    review: 'Review previous preferences',
    apply: 'Apply preference',
    skip: 'Skip',
    replace: 'Replace current preference',
    saved: 'Preference saved.',
    reset: 'Preference reset to Automatic.',
    notSaved: "Your change wasn't saved. Try again.",
    loadFailed: "Couldn't load your preferences. Try again.",
    noCandidates: 'No eligible previous preferences to review.',
  }),
});

export function interactionPreferencesCopy(language: ChromeLanguage): InteractionPreferencesCopy {
  return language === 'ar' ? INTERACTION_PREFERENCES_COPY_GATE.ar : INTERACTION_PREFERENCES_COPY_GATE.en;
}
