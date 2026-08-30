export const QUESTION_TYPES = ['CLARIFICATION','FACT_FINDING','DIAGNOSTIC','DISCRIMINATING','REFLECTIVE','PREFERENCE','DECISION','VALIDATION','PREDICTION','OUTCOME','SAFETY_CRITICAL','FOLLOW_UP'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const QUESTION_ANSWER_FORMATS = ['FREE_TEXT','YES_NO','SINGLE_CHOICE','MULTIPLE_CHOICE','NUMBER','DATE'] as const;
export type QuestionAnswerFormat = (typeof QUESTION_ANSWER_FORMATS)[number];
export const MAX_GAP_TEXT_LENGTH = 2000;
export const MAX_QUESTION_TEXT_LENGTH = 1000;
export const MAX_QUESTION_TARGET_HYPOTHESES = 16;
export const MAX_QUESTION_DEPENDENCIES = 16;

// QIR-006: migration 0063 makes the durable automatic Information Gap
// lifecycle total. Closure and reopen are owned exclusively by the canonical
// post-response synchronization authority; the application only reads them.
export type InformationGapStatus = 'OPEN' | 'RESOLVED' | 'SUPERSEDED';
export interface InformationGapRecord {
  id: string; user_id: string; information_needed: string; why_it_matters: string;
  related_hypothesis_ids: string[]; confidence_evaluation_id: string | null;
  user_answerability: 'UNASSESSED' | 'USER_CAN_ANSWER' | 'USER_CANNOT_ANSWER';
  preferred_question_type: QuestionType | null; status: InformationGapStatus; version: 1;
  provenance: 'QANDEEL_QUESTION_RUNTIME'; created_at: string; updated_at: string;
}
export interface CreateInformationGapInput {
  informationNeeded: string; whyItMatters: string; relatedHypothesisIds: string[];
  confidenceEvaluationId?: string; userAnswerability?: InformationGapRecord['user_answerability'];
  preferredQuestionType?: QuestionType;
}
export interface QuestionCandidateProposal {
  questionText: string; questionType: QuestionType; informationGapId: string;
  targetHypothesisIds: string[]; informationNeeded: string; answerFormat: QuestionAnswerFormat;
  dependencyIds?: string[];
}
export interface QuestionCandidateRecord {
  id: string; user_id: string; question_text: string; question_type: QuestionType;
  information_gap_id: string; target_hypothesis_ids: string[]; information_needed: string;
  answer_format: QuestionAnswerFormat; dependency_ids: string[]; status: 'VALIDATED'; version: 1;
  expected_information_gain: null; question_utility: null; ranking_state: 'UNASSESSED';
  provenance: 'QANDEEL_QUESTION_RUNTIME'; created_at: string; updated_at: string;
}
export interface QuestionCandidateGenerator {
  generate(input: Readonly<InformationGapRecord>): Promise<ReadonlyArray<QuestionCandidateProposal>>;
}
