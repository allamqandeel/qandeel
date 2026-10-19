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
 * `position` and `gap`. Every English row stays PROPOSED; none is approved by that decision
 * (`docs/e2e/QANDEEL_S7_03_IMPLEMENTATION_RECORD_v1.md` §7).
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

/** Arabic APPROVED by the Product Owner (2026-10-19, S7-03 Copy Gate); English still PROPOSED. */
const arabicApproved = (ar: string, en: string, source: string): Row => ({ ar, en, status: 'APPROVED', enStatus: 'PROPOSED', source });

export const REPLAY_COMPOSITE_COPY_ROWS = Object.freeze({
  // NOT_VIEWABLE — the version's reason, then both layers, then why no analysis is shown (I-06B: both layers reported).
  notViewableVersionSuperseded: arabicApproved('هذه النسخة من إعادة العرض لم تعد الحالية.', 'This version of the Replay is no longer the current one.', 'S7-03 (VERSION_SUPERSEDED)'),
  notViewableSourceContradictory: arabicApproved('تغيّرت الرسائل الأصلية بطريقة لا تسمح بعرضها كما كانت.', "The original messages changed in a way that doesn't allow showing them as they were.", 'S7-03 (SOURCE_STATE_CONTRADICTORY)'),
  notViewableSourceUnavailable: arabicApproved('الرسائل الأصلية غير متاحة الآن.', "The original messages aren't available right now.", 'S7-03 (SOURCE_NOT_CURRENTLY_AVAILABLE)'),
  notViewableEvidenceIncomplete: arabicApproved('التحليل المحفوظ لهذه اللحظات غير مكتمل.', 'The saved analysis of these moments is incomplete.', 'S7-03 (ANALYTICAL_EVIDENCE_INCOMPLETE)'),
  sourceLayerAvailable: arabicApproved('الرسائل الأصلية: متاحة.', 'The original messages: available.', 'S7-03 (sourceLayer DEREFERENCEABLE)'),
  sourceLayerUnavailable: arabicApproved('الرسائل الأصلية: غير متاحة الآن.', "The original messages: not available right now.", 'S7-03 (sourceLayer NOT_DEREFERENCEABLE)'),
  analyticalLayerSealed: arabicApproved('التحليل المحفوظ: محفوظ كما كان.', 'The saved analysis: kept as it was.', 'S7-03 (analyticalLayer SEALED_HISTORICAL_EVIDENCE)'),
  analyticalLayerIncomplete: arabicApproved('التحليل المحفوظ: غير مكتمل.', 'The saved analysis: incomplete.', 'S7-03 (analyticalLayer SEALED_EVIDENCE_INCOMPLETE)'),
  noAnalysisWithoutText: arabicApproved('لا يُعرض التحليل من دون الرسائل التي يخصّها.', "The analysis isn't shown without the messages it belongs to.", 'S7-03 (I-06B: no analysis without its moment)'),
  // One moment's analysis.
  analysisNotCurrentlyAvailable: arabicApproved('التحليل كما كان عند هذه اللحظة غير متاح الآن.', "The analysis as it was at this moment isn't available right now.", 'S7-03 (ANALYSIS_NOT_CURRENTLY_AVAILABLE)'),
  analysisFailed: arabicApproved('تعذّر عرض التحليل الآن. هذا لا يعني أنه غير موجود.', "The analysis couldn't be shown right now. That doesn't mean there is none.", 'S7-03 (a failed analysis read)'),
  // The preview limit the S7-02 rows do not cover (MOMENT_NOT_SEALED reuses the APPROVED S7-02 `openHead`).
  previewAnalysisUnavailable: arabicApproved('لا يتوفر تحليل محفوظ لهذه المحادثة، فلا يمكن إعادة عرضها.', "There's no saved analysis of this conversation, so it can't be replayed.", 'S7-03 (preview ANALYSIS_UNAVAILABLE)'),
} satisfies Record<string, Row>);

/** The position of a moment inside the version (its ordinal), distinct from its position in the conversation (its TC). */
const POSITION = Object.freeze({
  status: 'APPROVED' as ReplayCompositeCopyStatus,
  enStatus: 'PROPOSED' as ReplayCompositeCopyStatus,
  ar: (ordinal: number, count: number) => `في إعادة العرض: ${ordinal} من ${count}.`,
  en: (ordinal: number, count: number) => `In the Replay: ${ordinal} of ${count}.`,
});

/** A perceptible discontinuity before a moment (PERCEPTIBLE_DISCONTINUITY_REQUIRED), with the approved S7-02 count inside it. */
const GAP = Object.freeze({
  status: 'APPROVED' as ReplayCompositeCopyStatus,
  enStatus: 'PROPOSED' as ReplayCompositeCopyStatus,
  ar: (count: string) => `لم تُعرض هنا ${count} من المحادثة.`,
  en: (count: string) => `${count} of the conversation ${count.startsWith('1 ') ? 'is' : 'are'} not shown here.`,
});

export const REPLAY_COMPOSITE_COPY_GATE = Object.freeze({
  status: 'S7-03 PRODUCT COPY GATE — CLOSED — 2026-10-19, Product Owner decision: all 14 Arabic rows APPROVED exactly as proposed (position and gap included); every English row stays PROPOSED',
  decidedOn: '2026-10-19',
  arabicApproved: [...Object.keys(REPLAY_COMPOSITE_COPY_ROWS), 'position', 'gap'],
  englishProposed: [...Object.keys(REPLAY_COMPOSITE_COPY_ROWS), 'position', 'gap'],
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
