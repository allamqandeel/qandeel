import type { InteractionPreferences } from '../interaction-preferences/interaction-preferences.types';
import type { ModelRouterContextMessage, ProcessingPath } from '../model-router/model-router.types';

export type EvaluationProvider = 'ANTHROPIC' | 'OPENAI';

/**
 * ACE-01 (WP3) — what a Golden Conversation case is about: the twelve measurement items of conversational-personality-v1
 * §7.1 (P8). A tag for reviewers and for suite coverage; it never reaches the provider.
 */
export const STYLE_FOCUS = [
  'NATURALNESS',
  'PERSONALITY_CONSISTENCY',
  'REGISTER_FIT',
  'HUMOUR_INITIATIVE',
  'SERIOUSNESS',
  'EMPATHY',
  'BREVITY',
  'DIALECT_SWITCHING',
  'DISAGREEMENT',
  'DECLARED_PREFERENCES',
  'MULTI_TURN_TRANSITION',
  'NEGATIVE_CONTROL',
] as const;
export type StyleFocus = typeof STYLE_FOCUS[number];

export interface BrainEvaluationCase {
  id: string;
  path: ProcessingPath;
  locale: 'ar' | 'en' | 'und';
  context: ReadonlyArray<ModelRouterContextMessage>;
  reviewNotes: ReadonlyArray<string>;
  /** Golden Conversations only: the measurement items this case exercises. */
  styleFocus?: ReadonlyArray<StyleFocus>;
  /**
   * Golden Conversations only: the owner's durable preferences as the canonical Interaction Preferences record would hold
   * them. They reach the request exactly as production renders them (the Behavioral Runtime's compiled guidance); a line
   * of dialogue alone never stands in for an active durable setting.
   */
  interactionPreferences?: InteractionPreferences;
  /** Golden Conversations only: the production Safety gate must decide GUIDED for this case; its guidance is used. */
  safety?: 'GUIDED';
}

export interface CandidateResult {
  caseId: string;
  path: ProcessingPath;
  provider: EvaluationProvider;
  profile: `${EvaluationProvider}_${ProcessingPath}`;
  modelId: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  success: boolean;
  response: string;
  estimatedCostUsd: number | null;
  error?: string;
}

export const RUBRIC = [
  'Naturalness / non-robotic conversation',
  'Language / dialect quality',
  'Understanding of user intent / context',
  'Concision / no unnecessary lecture',
  'Emotional appropriateness without canned empathy',
  'Uncertainty / evidence discipline',
  'Usefulness of advice',
  'Question discipline',
  'Behavioral Policy consistency',
] as const;

/** ACE-01 (WP3) — the four approved style-specific dimensions (conversational-personality-v1 §7.2), after the nine. */
export const GOLDEN_CONVERSATION_STYLE_RUBRIC = [
  'Register fit (warm / serious / playful / direct as the moment asks)',
  'Personality consistency across the conversation',
  'Humour initiative: fitting when present, absent where it must be',
  'Adherence to declared preferences',
] as const;

export const GOLDEN_CONVERSATION_RUBRIC = [...RUBRIC, ...GOLDEN_CONVERSATION_STYLE_RUBRIC] as const;
