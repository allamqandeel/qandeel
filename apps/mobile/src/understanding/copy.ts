/**
 * W3-MEGA-U — the ONE place the «فهم قنديل» / QANDEEL Understanding surface's words are written.
 *
 * Frozen or approved, byte-for-byte:
 *   - «فهم قنديل» / QANDEEL Understanding — the surface and its entry (P1 §10; P4-C3 registry `understanding`, CANON);
 *   - «واضح» / Clear, «يتشكّل» / Taking shape, «يحتاج سياقًا أكثر» / Needs more to go on and «الثقة: {state}» /
 *     Confidence: {state} (P4-C4 §3 `confClear`, `confForming`, `confMore`, `confName`), and «يوجد تعارض» / Mixed
 *     (P4-C3R, `confMixed`);
 *   - «الأدلة» / Evidence, «التناقضات» / Contradictions, «البدائل» / Alternatives, «نقاط غير محسومة» / Unresolved
 *     points, «تطور التحليل» / Analysis evolution — the I-08A4 §9 detail names P1 §10 preserves;
 *   - «رجوع» / Back (P4-C4 `p3.back`) and «إعادة المحاولة» / Try again (VI-01 T03, APPROVED).
 *
 * TASK-APPROVED DELEGATED COPY (W3-MEGA-U §7.6, recorded in the implementation record): the six theme titles, the empty
 * and unavailable sentences, "talk to QANDEEL about this", its failure sentence, the discussion strip and the evolution
 * phrases, and (U3) the disagreement act, its two outcomes and the under-review words for P1 §11.4's own concept.
 * Plain, non-diagnostic, in QANDEEL's formal T1 register; none names a new Product concept.
 */
import type { ChromeLanguage } from '../orientation-chrome';
import type { UnderstandingConfidence, UnderstandingEvolutionKind, UnderstandingTheme } from '../runtime-entry';

export interface UnderstandingCopy {
  readonly name: string;
  readonly backName: string;
  readonly tryAgain: string;
  readonly theme: Readonly<Record<UnderstandingTheme, string>>;
  readonly confidence: Readonly<Record<UnderstandingConfidence, string>>;
  readonly confidenceName: (state: string) => string;
  readonly evidence: string;
  readonly contradictions: string;
  readonly alternatives: string;
  readonly unresolved: string;
  readonly evolution: string;
  readonly evolutionKind: Readonly<Record<UnderstandingEvolutionKind, string>>;
  readonly empty: string;
  readonly unavailable: string;
  readonly talk: string;
  readonly talkFailed: string;
  readonly discussing: (title: string) => string;
  readonly endDiscussion: string;
  readonly disagree: string;
  readonly disagreeRecorded: string;
  readonly disagreeFailed: string;
  readonly underReview: string;
  readonly underReviewNote: string;
}

const AR: UnderstandingCopy = Object.freeze({
  name: 'فهم قنديل',
  backName: 'رجوع',
  tryAgain: 'إعادة المحاولة',
  theme: Object.freeze({
    YOU: 'عنك',
    RELATIONSHIPS: 'علاقاتك',
    WORK: 'عملك',
    DECISIONS: 'قراراتك',
    GOALS: 'أهدافك',
    HOW_WE_TALK: 'طريقة حديثنا',
  }),
  confidence: Object.freeze({
    CLEAR: 'واضح',
    TAKING_SHAPE: 'يتشكّل',
    MIXED: 'يوجد تعارض',
    NEEDS_MORE: 'يحتاج سياقًا أكثر',
  }),
  confidenceName: (state: string) => `الثقة: ${state}`,
  evidence: 'الأدلة',
  contradictions: 'التناقضات',
  alternatives: 'البدائل',
  unresolved: 'نقاط غير محسومة',
  evolution: 'تطور التحليل',
  evolutionKind: Object.freeze({
    FIRST_SEEN: 'بدأ قنديل يرى الأمر هكذا',
    SUPPORT_ADDED: 'أضاف كلامك ما يدعمه',
    CHALLENGE_ADDED: 'أضاف كلامك ما يعارضه',
    STRENGTHENED: 'ازداد وضوحًا',
    WEAKENED: 'ضعُف',
    BECAME_MIXED: 'ظهر فيه تعارض',
    WITHDRAWN: 'تركه قنديل جانبًا',
    RECONSIDERED: 'أعاد قنديل النظر فيه',
    YOU_DISAGREED: 'سُجّل رأيك المختلف',
  }),
  empty: 'لم يتكوّن لدى قنديل فهمٌ يعرضه بعد.',
  unavailable: 'تعذّر عرض فهم قنديل.',
  talk: 'الحديث مع قنديل عن هذا',
  talkFailed: 'تعذّر نقل هذا إلى المحادثة.',
  discussing: (title: string) => `الحديث عن: ${title}`,
  endDiscussion: 'إنهاء الحديث عن هذا',
  disagree: 'أراه بشكل مختلف',
  disagreeRecorded: 'سُجّل رأيك، وسيعيد قنديل النظر في هذا الفهم.',
  disagreeFailed: 'تعذّر تسجيل رأيك.',
  underReview: 'قيد المراجعة',
  underReviewNote: 'أخذ قنديل برأيك، وهذا الفهم قيد المراجعة.',
});

const EN: UnderstandingCopy = Object.freeze({
  name: 'QANDEEL Understanding',
  backName: 'Back',
  tryAgain: 'Try again',
  theme: Object.freeze({
    YOU: 'About you',
    RELATIONSHIPS: 'Your relationships',
    WORK: 'Your work',
    DECISIONS: 'Your decisions',
    GOALS: 'Your goals',
    HOW_WE_TALK: 'How we talk',
  }),
  confidence: Object.freeze({
    CLEAR: 'Clear',
    TAKING_SHAPE: 'Taking shape',
    MIXED: 'Mixed',
    NEEDS_MORE: 'Needs more to go on',
  }),
  confidenceName: (state: string) => `Confidence: ${state}`,
  evidence: 'Evidence',
  contradictions: 'Contradictions',
  alternatives: 'Alternatives',
  unresolved: 'Unresolved points',
  evolution: 'Analysis evolution',
  evolutionKind: Object.freeze({
    FIRST_SEEN: 'QANDEEL began to see it this way',
    SUPPORT_ADDED: 'Something you said supported it',
    CHALLENGE_ADDED: 'Something you said challenged it',
    STRENGTHENED: 'It grew clearer',
    WEAKENED: 'It grew weaker',
    BECAME_MIXED: 'It became mixed',
    WITHDRAWN: 'QANDEEL set it aside',
    RECONSIDERED: 'QANDEEL reconsidered it',
    YOU_DISAGREED: 'Your different view was noted',
  }),
  empty: "QANDEEL hasn't formed an understanding to show yet.",
  unavailable: "QANDEEL Understanding couldn't be shown.",
  talk: 'Talk to QANDEEL about this',
  talkFailed: "This couldn't be brought into the conversation.",
  discussing: (title: string) => `Talking about: ${title}`,
  endDiscussion: 'Stop talking about this',
  disagree: 'I see it differently',
  disagreeRecorded: 'Your view is noted. QANDEEL will reconsider this understanding.',
  disagreeFailed: "Your view couldn't be recorded.",
  underReview: 'Under review',
  underReviewNote: 'QANDEEL took your view into account. This understanding is under review.',
});

export function understandingCopy(language: ChromeLanguage): UnderstandingCopy {
  return language === 'ar' ? AR : EN;
}
