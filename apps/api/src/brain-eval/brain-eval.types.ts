import type { ModelRouterContextMessage, ProcessingPath } from '../model-router/model-router.types';

export type EvaluationProvider = 'ANTHROPIC' | 'OPENAI';

export interface BrainEvaluationCase {
  id: string;
  path: ProcessingPath;
  locale: 'ar' | 'en' | 'und';
  context: ReadonlyArray<ModelRouterContextMessage>;
  reviewNotes: ReadonlyArray<string>;
}

export interface CandidateResult {
  caseId: string;
  path: ProcessingPath;
  provider: EvaluationProvider;
  profile: `${EvaluationProvider}_${ProcessingPath}`;
  modelId: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
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
