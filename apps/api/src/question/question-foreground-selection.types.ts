import type { ProcessingPath } from '../model-router/model-router.types';
import type { QuestionContextV1 } from './question-context.types';

// QIR-006 - the ONE bounded foreground wait ceiling for formal Question
// selection. It is a foreground orchestration wait ceiling ONLY: not a
// database SLA, not a provider SLA, and not a whole-turn budget. On expiry the
// turn continues without a formal Question opportunity; the late settlement is
// discarded for this turn, never cached into another turn, and never allowed
// to mutate an already assembled provider request. The constant lives in this
// module deliberately - the Conversation Orchestrator gains no new timer.
export const QUESTION_FOREGROUND_WAIT_BUDGET_MS = 300;

export const QUESTION_FOREGROUND_SELECTION_POLICY_VERSION = '1';

/** The caller identity triple for one foreground selection. Nothing else may be supplied. */
export interface QuestionForegroundSelectionInput {
  readonly userId: string;
  readonly sessionId: string;
  readonly sourceTurnId: string;
  readonly path: ProcessingPath;
}

export const QUESTION_LEGITIMATE_EMPTY_REASONS = ['NO_ELIGIBLE_GAP', 'OUTSTANDING_OPEN_QUESTION'] as const;
export type QuestionLegitimateEmptyReason = typeof QUESTION_LEGITIMATE_EMPTY_REASONS[number];

/**
 * The typed QIR-006 foreground selection outcomes. SELECTED carries the durable
 * reservation identity (consumed ONLY by the versioned finalization authority)
 * plus the sanitized provider-safe Question context. The degraded outcomes
 * carry no value: an unavailable or expired selection is OMISSION - never a
 * fabricated empty answer and never a stale reservation from another turn.
 * HARD failures are not an outcome value: they reject the selection promise
 * with the ORIGINAL error and fail the turn closed before provider generation.
 */
export type QuestionForegroundOutcome =
  | { readonly state: 'SELECTED'; readonly bindingId: string; readonly questionContext: QuestionContextV1 }
  | { readonly state: 'LEGITIMATE_EMPTY'; readonly reason: QuestionLegitimateEmptyReason }
  | { readonly state: 'OPTIONAL_AVAILABILITY_FAILURE' }
  | { readonly state: 'FOREGROUND_BUDGET_EXPIRY' };
