// QIR-006 - the provider-safe formal Question context contract. This module is
// deliberately a LEAF: it imports nothing, so the provider-neutral request
// surface (model-router.types) and the Question foreground selection service
// can both consume it without an import cycle.

// The provider-safe formal question taxonomy QIR-006 v1 can select. It is the
// server-owned image of the three actionable migration-0038 missing-information
// categories; the literal internal missing-information code itself never
// crosses the provider boundary.
export const FORMAL_QUESTION_TYPES = ['FACT_FINDING', 'VALIDATION', 'DISCRIMINATING'] as const;
export type FormalQuestionType = typeof FORMAL_QUESTION_TYPES[number];

export const QUESTION_CONTEXT_CONTRACT_VERSION = 1;
export const QUESTION_CONTEXT_SOURCE = 'QANDEEL_QUESTION_ENGINE';

/**
 * QIR-006 - the ONE provider-neutral, provider-safe Question context.
 *
 * It carries ONLY the sanitized information objective the server selected. It
 * MUST NEVER carry: an Information Gap id, a Hypothesis id, a Confidence
 * evaluation id, a missing-information code, a Hypothesis statement, a
 * Confidence score or band, an internal ranking, hidden reasoning, or any
 * user/session/turn identifier. The provider phrases one natural follow-up
 * question; the server alone chose the opportunity.
 */
export interface QuestionContextV1 {
  readonly contractVersion: typeof QUESTION_CONTEXT_CONTRACT_VERSION;
  readonly source: typeof QUESTION_CONTEXT_SOURCE;
  readonly questionType: FormalQuestionType;
  readonly answerFormat: 'FREE_TEXT';
  readonly informationObjective: string;
}

// The server-owned objective mapping for the three actionable automatic
// missing-information categories. Fixed controlled text: the underlying
// Hypothesis statement is never reproduced here, and the literal internal
// source code never enters provider-visible text.
export const QUESTION_INFORMATION_OBJECTIVES: Readonly<Record<FormalQuestionType, string>> = Object.freeze({
  FACT_FINDING: 'Ask for one concrete example, event, observation, or experience detail that could provide direct evidence relevant to the current topic.',
  VALIDATION: 'Ask the user to confirm, reject, or clarify one important unresolved assumption in the current topic.',
  DISCRIMINATING: 'Ask for one detail that may help distinguish between plausible interpretations of the current situation.',
});
