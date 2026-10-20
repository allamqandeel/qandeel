/**
 * S7-03 — the ONE place the composite proof's words are written.
 *
 * Most of what the composite says is already approved, and is reused VERBATIM from its owner rather than rewritten
 * here: the speaker («أنت» S4-01; «قنديل» W1A-01), the accessible names of a message (W1A-01 `userTurnName` /
 * `replyTurnName`), the temporal and spatial orientation sentences (T-08, `temporalSentence` / `spatialSentence`), the
 * scope («جزء من المحادثة» / «المحادثة كاملة», G1.1 LOCKED), the message count, the open-head preview refusal, «هذا غير
 * متاح الآن.» and «إعادة المحاولة» (S7-02 Product Copy Gate, CLOSED — not reopened).
 *
 * The rows below are the words S7-03 needs that no earlier gate approved. The S7-03 Product Copy Gate is CLOSED: on
 * 2026-10-19 the Product Owner APPROVED all 14 Arabic rows exactly as proposed, including the counting templates
 * `position` and `gap`. No English row was approved by that decision
 * (`docs/e2e/QANDEEL_S7_03_IMPLEMENTATION_RECORD_v1.md` §7); on 2026-10-20 the Product Owner APPROVED the English of
 * all 14 rows word for word (S7-05 decision D2, `docs/e2e/QANDEEL_S7_05_IMPLEMENTATION_RECORD_v1.md`), with the counting
 * rules of `position` and `gap` unchanged. No Arabic word changed.
 *
 * Fixed Arabic is simplified Modern Standard Arabic and gender-considerate (LANG-01): no second-person verb that marks
 * gender. No row names a server word, a status value, an id or an engineering term; no row characterises, summarises or
 * annotates the historical message (NO_EDITORIAL_ANNOTATION).
 */
import type { ChromeLanguage } from '../orientation-chrome';
import type { ReplayNotViewableClass } from '../runtime-entry';

export type ReplayCompositeCopyStatus = 'APPROVED' | 'LOCKED' | 'PROPOSED';

interface Row {
  readonly ar: string;
  readonly en: string;
  readonly status: ReplayCompositeCopyStatus;
  readonly enStatus: ReplayCompositeCopyStatus;
  readonly source: string;
}

/**
 * Arabic APPROVED by the Product Owner (2026-10-19, S7-03 Copy Gate); English APPROVED by the Product Owner word for word
 * (2026-10-20, S7-05 decision D2).
 */
const approved = (ar: string, en: string, source: string): Row => ({ ar, en, status: 'APPROVED', enStatus: 'APPROVED', source: `${source}; Arabic APPROVED 2026-10-19 (S7-03); English APPROVED 2026-10-20 (S7-05 D2)` });

export const REPLAY_COMPOSITE_COPY_ROWS = Object.freeze({
  // NOT_VIEWABLE — the version's reason, then both layers, then why no analysis is shown (I-06B: both layers reported).
  notViewableVersionSuperseded: approved('هذه النسخة من إعادة العرض لم تعد الحالية.', 'This version of the Replay is no longer current.', 'S7-03 (VERSION_SUPERSEDED)'),
  notViewableSourceContradictory: approved('تغيّرت الرسائل الأصلية بطريقة لا تسمح بعرضها كما كانت.', "The original messages have changed, so they can't be shown as they were.", 'S7-03 (SOURCE_STATE_CONTRADICTORY)'),
  notViewableSourceUnavailable: approved('الرسائل الأصلية غير متاحة الآن.', "The original messages aren't available right now.", 'S7-03 (SOURCE_NOT_CURRENTLY_AVAILABLE)'),
  notViewableEvidenceIncomplete: approved('التحليل المحفوظ لهذه اللحظات غير مكتمل.', 'The saved analysis of these moments is incomplete.', 'S7-03 (ANALYTICAL_EVIDENCE_INCOMPLETE)'),
  sourceLayerAvailable: approved('الرسائل الأصلية: متاحة.', 'Original messages: available.', 'S7-03 (sourceLayer DEREFERENCEABLE)'),
  sourceLayerUnavailable: approved('الرسائل الأصلية: غير متاحة الآن.', 'Original messages: not available right now.', 'S7-03 (sourceLayer NOT_DEREFERENCEABLE)'),
  analyticalLayerSealed: approved('التحليل المحفوظ: محفوظ كما كان.', 'Saved analysis: kept as it was.', 'S7-03 (analyticalLayer SEALED_HISTORICAL_EVIDENCE)'),
  analyticalLayerIncomplete: approved('التحليل المحفوظ: غير مكتمل.', 'Saved analysis: incomplete.', 'S7-03 (analyticalLayer SEALED_EVIDENCE_INCOMPLETE)'),
  noAnalysisWithoutText: approved('لا يُعرض التحليل من دون الرسائل التي يخصّها.', "The analysis isn't shown without the messages it belongs to.", 'S7-03 (I-06B: no analysis without its moment)'),
  // One moment's analysis.
  analysisNotCurrentlyAvailable: approved('التحليل كما كان عند هذه اللحظة غير متاح الآن.', "The analysis as it was at this moment isn't available right now.", 'S7-03 (ANALYSIS_NOT_CURRENTLY_AVAILABLE)'),
  analysisFailed: approved('تعذّر عرض التحليل الآن. هذا لا يعني أنه غير موجود.', "The analysis couldn't be displayed right now. This doesn't mean it doesn't exist.", 'S7-03 (a failed analysis read)'),
  // The preview limit the S7-02 rows do not cover (MOMENT_NOT_SEALED reuses the APPROVED S7-02 `openHead`).
  previewAnalysisUnavailable: approved('لا يتوفر تحليل محفوظ لهذه المحادثة، فلا يمكن إعادة عرضها.', "There's no saved analysis of this conversation, so it can't be replayed.", 'S7-03 (preview ANALYSIS_UNAVAILABLE)'),
} satisfies Record<string, Row>);

/** The position of a moment inside the version (its ordinal), distinct from its position in the conversation (its TC). */
const POSITION = Object.freeze({
  status: 'APPROVED' as ReplayCompositeCopyStatus,
  enStatus: 'APPROVED' as ReplayCompositeCopyStatus,
  ar: (ordinal: number, count: number) => `في إعادة العرض: ${ordinal} من ${count}.`,
  en: (ordinal: number, count: number) => `In the Replay: ${ordinal} of ${count}.`,
});

/** A perceptible discontinuity before a moment (PERCEPTIBLE_DISCONTINUITY_REQUIRED), with the approved S7-02 count inside it. */
const GAP = Object.freeze({
  status: 'APPROVED' as ReplayCompositeCopyStatus,
  enStatus: 'APPROVED' as ReplayCompositeCopyStatus,
  ar: (count: string) => `لم تُعرض هنا ${count} من المحادثة.`,
  en: (count: string) => `${count} of the conversation ${count.startsWith('1 ') ? 'is' : 'are'} not shown here.`,
});

export const REPLAY_COMPOSITE_COPY_GATE = Object.freeze({
  status: 'S7-03 PRODUCT COPY GATE — CLOSED — 2026-10-19, Product Owner decision: all 14 Arabic rows APPROVED exactly as proposed (position and gap included); every English row stays PROPOSED',
  decidedOn: '2026-10-19',
  arabicApproved: [...Object.keys(REPLAY_COMPOSITE_COPY_ROWS), 'position', 'gap'],
  /** S7-05 (decision D2): the English of all 14 rows, approved word for word. The Arabic gate above is unchanged. */
  englishApproval: 'S7-05 ENGLISH COPY APPROVAL — 2026-10-20, Product Owner decision D2: the English of all 14 S7-03 rows (position and gap included) APPROVED word for word; no Arabic row changed',
  englishApproved: [...Object.keys(REPLAY_COMPOSITE_COPY_ROWS), 'position', 'gap'],
  englishProposed: [] as string[],
});

export type ReplayCompositeCopy = { readonly [K in keyof typeof REPLAY_COMPOSITE_COPY_ROWS]: string } & {
  readonly position: (ordinal: number, count: number) => string;
  readonly gap: (count: string) => string;
  readonly notViewable: (reason: ReplayNotViewableClass) => string;
};

const build = (language: ChromeLanguage): ReplayCompositeCopy => {
  const rows = Object.fromEntries(Object.entries(REPLAY_COMPOSITE_COPY_ROWS).map(([key, row]) => [key, row[language]])) as {
    [K in keyof typeof REPLAY_COMPOSITE_COPY_ROWS]: string;
  };
  return Object.freeze({
    ...rows,
    position: POSITION[language],
    gap: GAP[language],
    notViewable: (reason: ReplayNotViewableClass) => ({
      VERSION_SUPERSEDED: rows.notViewableVersionSuperseded,
      SOURCE_STATE_CONTRADICTORY: rows.notViewableSourceContradictory,
      SOURCE_NOT_CURRENTLY_AVAILABLE: rows.notViewableSourceUnavailable,
      ANALYTICAL_EVIDENCE_INCOMPLETE: rows.notViewableEvidenceIncomplete,
    })[reason],
  });
};
const AR = build('ar');
const EN = build('en');

/** The copy for one Product language. There is no default language. */
export function replayCompositeCopy(language: ChromeLanguage): ReplayCompositeCopy {
  return language === 'ar' ? AR : EN;
}
