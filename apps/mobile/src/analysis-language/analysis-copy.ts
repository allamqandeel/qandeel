/**
 * W1A-01 correction pass — the ONE place the Analysis depth's temporal, timeline and map-accessibility
 * words are written.
 *
 * Every string below is exactly as the Product Owner approved it in the W1A-01 Analysis-language
 * package (`docs/e2e/QANDEEL_W1A01_IMPLEMENTATION_RECORD_v1.md` §10.1 records it verbatim), or is the
 * already-approved T-08 / P4-C4 wording for the same fact. Nothing is paraphrased, translated on the
 * fly or composed from engineering vocabulary, and no internal identifier, enum token, Session
 * Position label or fixture id ever reaches a reader through this module.
 *
 * It is a leaf: it imports nothing, so the T-04 map, T-05 timeline and T-06 temporal owners can take
 * their words from it without reaching any other layer. Runtime terms ("live", "SP", "disclosed")
 * stay in the runtime; they are not Product copy.
 *
 * Numerals: Western digits in both languages, the same policy (and the same reason) as T-08's
 * `product-copy.ts`, so a reader never meets two numeral systems in one surface.
 */

export type AnalysisLanguage = 'ar' | 'en';

export interface AnalysisCommandWords {
  readonly first: string;
  readonly last: string;
  readonly next: string;
  readonly previous: string;
  readonly narrow: string;
  readonly widen: string;
}

export interface AnalysisCopy {
  // ------------------------------------------------------------ the current edge (PO supersession)
  /** The reader is following the conversation as it continues. */
  readonly followingConversation: string;
  /** The act that returns the reader to following the conversation. */
  readonly rejoinConversation: string;

  // ------------------------------------------------------------------------- temporal navigation
  readonly temporalNavigation: string;
  readonly momentNumber: string;
  readonly noMomentYet: string;
  readonly momentNumberHint: (max: number) => string;
  readonly momentUnavailable: string;
  readonly previewNextMoment: string;
  /** P4-C4 `previewCommit`. */
  readonly goToMoment: (n: number) => string;
  /** P4-C4 `previewCancel`. */
  readonly cancelTemporaryLook: string;
  /** T-08's committed pinned stance. */
  readonly atMoment: (n: number) => string;
  /** T-08's preview line. */
  readonly temporaryLookAt: (n: number) => string;

  // ---------------------------------------------------------------------------------- timeline
  readonly timelinePoint: (n: number) => string;
  readonly trackContinues: string;
  readonly timelineViewPosition: string;
  readonly viewPercentage: (n: number) => string;
  readonly allVisible: string;
  readonly moveView: string;
  readonly narrowView: string;
  readonly widenView: string;
  /** The approved command words of this language, in the order the helper lists them. */
  readonly commands: AnalysisCommandWords;

  // ----------------------------------------------------------------------------------------- map
  readonly map: string;
  readonly family: { readonly THREAD: string; readonly READING: string; readonly EMERGING_FOCUS: string };
  readonly permanentPlace: string;
  readonly contexts: (n: number) => string;
  readonly noPlace: string;
  readonly inspect: string;
  readonly switchContext: string;
  readonly goToPlace: string;
  readonly moreDetail: string;
  readonly lessDetail: string;
  readonly exploreUp: string;
  readonly exploreDown: string;
  readonly exploreRight: string;
  readonly exploreLeft: string;
  /** How a map object's Product type and its placement are joined into one spoken description. */
  readonly describe: (family: string, placement: string) => string;
}

const digits = (value: number): string => String(value);

const AR: AnalysisCopy = Object.freeze<AnalysisCopy>({
  followingConversation: 'تتابع المحادثة الآن',
  rejoinConversation: 'العودة لمتابعة المحادثة',

  temporalNavigation: 'التنقل الزمني',
  momentNumber: 'رقم اللحظة',
  noMomentYet: 'لا توجد لحظة متاحة بعد.',
  momentNumberHint: (max) => `أدخل رقمًا من 1 إلى ${digits(max)}. ستظهر نظرة مؤقتة على اللحظة دون الانتقال إليها.`,
  momentUnavailable: 'هذه اللحظة غير متاحة ضمن الخط الزمني الحالي.',
  previewNextMoment: 'نظرة مؤقتة على اللحظة التالية',
  goToMoment: (n) => `الانتقال إلى اللحظة ${digits(n)}`,
  cancelTemporaryLook: 'إلغاء النظرة المؤقتة',
  atMoment: (n) => `أنت عند اللحظة ${digits(n)}.`,
  temporaryLookAt: (n) => `نظرة مؤقتة على اللحظة ${digits(n)}، ولم يتغير موضعك.`,

  timelinePoint: (n) => `اللحظة ${digits(n)}`,
  trackContinues: 'يوجد المزيد على الخط الزمني.',
  timelineViewPosition: 'موضع العرض على الخط الزمني',
  viewPercentage: (n) => `${digits(n)}% من نطاق العرض`,
  allVisible: 'كل اللحظات المتاحة ظاهرة الآن.',
  moveView: 'تغيير موضع العرض',
  narrowView: 'تضييق نطاق العرض',
  widenView: 'توسيع نطاق العرض',
  commands: Object.freeze({ first: 'البداية', last: 'النهاية', next: 'التالي', previous: 'السابق', narrow: 'تضييق', widen: 'توسيع' }),

  map: 'خريطة تحليل المحادثة',
  family: Object.freeze({ THREAD: 'خيط', READING: 'قراءة', EMERGING_FOCUS: 'تركيز ناشئ' }),
  permanentPlace: 'في موضعه الثابت',
  contexts: (n) => `عدد السياقات: ${digits(n)}`,
  noPlace: 'بلا موضع على الخريطة',
  inspect: 'معاينة',
  switchContext: 'تغيير السياق',
  goToPlace: 'الانتقال إلى هذا الموضع',
  moreDetail: 'إظهار تفاصيل أكثر',
  lessDetail: 'إظهار تفاصيل أقل',
  exploreUp: 'استكشاف أعلى الخريطة',
  exploreDown: 'استكشاف أسفل الخريطة',
  exploreRight: 'استكشاف يمين الخريطة',
  exploreLeft: 'استكشاف يسار الخريطة',
  describe: (family, placement) => `${family}، ${placement}`,
});

const EN: AnalysisCopy = Object.freeze<AnalysisCopy>({
  followingConversation: 'Following the conversation',
  rejoinConversation: 'Rejoin the conversation',

  temporalNavigation: 'Temporal navigation',
  momentNumber: 'Moment number',
  noMomentYet: 'No moment is available yet.',
  momentNumberHint: (max) => `Enter a number from 1 to ${digits(max)}. This gives you a temporary look without moving there.`,
  momentUnavailable: "This moment isn't available in the current timeline.",
  previewNextMoment: 'Preview the next moment',
  goToMoment: (n) => `Go to moment ${digits(n)}`,
  cancelTemporaryLook: 'Cancel the temporary look',
  atMoment: (n) => `Reading at moment ${digits(n)}.`,
  temporaryLookAt: (n) => `A temporary look at moment ${digits(n)}. Your position has not changed.`,

  timelinePoint: (n) => `Moment ${digits(n)}`,
  trackContinues: 'More is available on the timeline.',
  timelineViewPosition: 'Timeline view position',
  viewPercentage: (n) => `${digits(n)}% of the view range`,
  allVisible: 'All available moments are visible.',
  moveView: 'Move the timeline view',
  narrowView: 'Narrow the view',
  widenView: 'Widen the view',
  commands: Object.freeze({ first: 'first', last: 'last', next: 'next', previous: 'previous', narrow: 'refine', widen: 'widen' }),

  map: 'Conversation analysis map',
  family: Object.freeze({ THREAD: 'Thread', READING: 'Reading', EMERGING_FOCUS: 'Emerging focus' }),
  permanentPlace: 'At its permanent place',
  contexts: (n) => `Contexts: ${digits(n)}`,
  noPlace: 'No place on the map',
  inspect: 'Inspect',
  switchContext: 'Switch context',
  goToPlace: 'Go to this place',
  moreDetail: 'Show more detail',
  lessDetail: 'Show less detail',
  exploreUp: 'Explore up on the map',
  exploreDown: 'Explore down on the map',
  exploreRight: 'Explore right on the map',
  exploreLeft: 'Explore left on the map',
  describe: (family, placement) => `${family}. ${placement}`,
});

/** The Analysis words for one Product language. */
export function analysisCopy(language: AnalysisLanguage): AnalysisCopy {
  return language === 'ar' ? AR : EN;
}

/** Both languages' command words. The command field ACCEPTS both, whatever the reader's language. */
export const ANALYSIS_COMMAND_WORDS: readonly AnalysisCommandWords[] = Object.freeze([AR.commands, EN.commands]);

/**
 * The command helper, derived ONLY from approved words: the approved command words of the reader's
 * language, `+` / `-`, and the percentage range. It names the reader's own words; the other
 * language's are still accepted (`timeline/accessibility/commands.ts`).
 */
export function presentationCommandHelper(language: AnalysisLanguage): string {
  const { commands } = analysisCopy(language);
  const separator = language === 'ar' ? '، ' : ', ';
  return [commands.first, commands.last, commands.next, commands.previous, commands.narrow, commands.widen, '+', '-', '0–100%'].join(separator);
}
