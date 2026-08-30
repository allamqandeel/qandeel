import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { ProcessingPath } from '../model-router/model-router.types';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import {
  FORMAL_QUESTION_TYPES,
  QUESTION_CONTEXT_CONTRACT_VERSION,
  QUESTION_CONTEXT_SOURCE,
  QUESTION_INFORMATION_OBJECTIVES,
  type FormalQuestionType,
  type QuestionContextV1,
} from './question-context.types';
import {
  QUESTION_FOREGROUND_WAIT_BUDGET_MS,
  QUESTION_LEGITIMATE_EMPTY_REASONS,
  type QuestionForegroundOutcome,
  type QuestionForegroundSelectionInput,
  type QuestionLegitimateEmptyReason,
} from './question-foreground-selection.types';

// QIR-006: the module-private, structurally typed malformed-result identity.
//
// A selection result that is not one of the canonical shapes is classified by
// CONSTRUCTOR IDENTITY at the one place it is created, never by substring
// matching, and it always FAILS CLOSED: it is never exported, never converted
// into a degraded outcome, never reinterpreted as a legitimate empty result,
// and never replaced with a fabricated omission.
class QuestionForegroundMalformedResultError extends Error {
  constructor() { super('QIR_QUESTION_FOREGROUND_MALFORMED_RESULT'); }
}

// The degraded outcomes are frozen singletons carrying no value: an
// unavailable or expired selection is OMISSION - never a fabricated empty
// answer, never a stale reservation, and never a cached result from another
// turn.
const OPTIONAL_AVAILABILITY_FAILURE_OUTCOME = Object.freeze({ state: 'OPTIONAL_AVAILABILITY_FAILURE' as const });
const FOREGROUND_BUDGET_EXPIRY_OUTCOME = Object.freeze({ state: 'FOREGROUND_BUDGET_EXPIRY' as const });

// QIR-006 exact availability classifier. ONLY these two shapes may degrade to
// OPTIONAL_AVAILABILITY_FAILURE:
//
//   1. a Nest ServiceUnavailableException from the canonical service-role
//      transport/configuration boundary (missing configuration or a
//      fetch/network/AbortSignal transport failure is already sanitized into
//      exactly this identity by SupabaseServiceRoleApiService);
//   2. a canonical DataApiError whose HTTP status is 408, 429, or 500..599.
//
// Everything else - a DataApiError with any other 4xx status including 400,
// 401 and 403, a malformed successful value, and every unexpected error type -
// stays a HARD failure: the classifier rethrows and the turn fails closed
// before any provider generation. Classification is by constructor identity
// and numeric status only; no error-message substring is ever consulted.
function isApprovedAvailabilityStatus(status: number): boolean {
  return status === 408 || status === 429 || (Number.isInteger(status) && status >= 500 && status <= 599);
}
function classifyQuestionSelectionFailure(error: unknown): typeof OPTIONAL_AVAILABILITY_FAILURE_OUTCOME {
  if (error instanceof ServiceUnavailableException) return OPTIONAL_AVAILABILITY_FAILURE_OUTCOME;
  if (error instanceof DataApiError && isApprovedAvailabilityStatus(error.status)) return OPTIONAL_AVAILABILITY_FAILURE_OUTCOME;
  throw error;
}

// QIR-006: successful selection results are classified by TOTAL runtime
// validation over `unknown` - TypeScript erasure is never trusted at this
// boundary. Exactly one row must arrive, its outcome must be one of the three
// canonical selection outcomes, a SELECTED row must carry a UUID reservation
// identity plus a canonical formal question type, and a legitimate-empty row
// must carry no identity at all. Anything else is malformed and FAILS CLOSED
// through the typed identity above - never reinterpreted as empty, never
// fabricated into an omission.
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
function isFormalQuestionType(value: unknown): value is FormalQuestionType {
  return typeof value === 'string' && (FORMAL_QUESTION_TYPES as readonly string[]).includes(value);
}
function isLegitimateEmptyReason(value: unknown): value is QuestionLegitimateEmptyReason {
  return typeof value === 'string' && (QUESTION_LEGITIMATE_EMPTY_REASONS as readonly string[]).includes(value);
}
function buildQuestionContext(questionType: FormalQuestionType): QuestionContextV1 {
  return Object.freeze({
    contractVersion: QUESTION_CONTEXT_CONTRACT_VERSION,
    source: QUESTION_CONTEXT_SOURCE,
    questionType,
    answerFormat: 'FREE_TEXT' as const,
    informationObjective: QUESTION_INFORMATION_OBJECTIVES[questionType],
  });
}
function classifySelectionResult(value: unknown): QuestionForegroundOutcome {
  if (!Array.isArray(value) || value.length !== 1) throw new QuestionForegroundMalformedResultError();
  const row = value[0] as Record<string, unknown> | null;
  if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new QuestionForegroundMalformedResultError();
  if (row.outcome === 'SELECTED') {
    if (typeof row.binding_id !== 'string' || !UUID_SHAPE.test(row.binding_id)) throw new QuestionForegroundMalformedResultError();
    if (!isFormalQuestionType(row.question_type)) throw new QuestionForegroundMalformedResultError();
    return { state: 'SELECTED', bindingId: row.binding_id, questionContext: buildQuestionContext(row.question_type) };
  }
  if (isLegitimateEmptyReason(row.outcome)) {
    if (row.binding_id !== null && row.binding_id !== undefined) throw new QuestionForegroundMalformedResultError();
    if (row.question_type !== null && row.question_type !== undefined) throw new QuestionForegroundMalformedResultError();
    return { state: 'LEGITIMATE_EMPTY', reason: row.outcome };
  }
  throw new QuestionForegroundMalformedResultError();
}

/**
 * QIR-006 Question Foreground Selection v1.
 *
 * The narrow production service that owns formal Question opportunity
 * SELECTION for one provider-generating turn: exactly one service-role
 * selection RPC, total typed-result validation, the frozen 300 ms QIR-006
 * foreground wait ceiling, the exact approved availability degradation rules,
 * and bounded fail-soft telemetry.
 *
 * It is NOT the Question Candidate generator, not a ranking engine, not a
 * context budget manager (QIR-004), not a provider router, not a background
 * scheduler (QIR-005), and not an answer detector: whether the user answered
 * is decided ONLY by canonical Hypothesis/Confidence state through the
 * migration-0063 synchronization authority, never here.
 *
 * Topology: `select` is fully synchronous up to its returned promise - the one
 * RPC is launched before anything is awaited, so the Conversation Orchestrator
 * can start this lane in the same post-Safety stage as the Human Intelligence
 * lane and the QIR-003 Memory/Hypothesis gather, with none of the three lanes
 * waiting behind another.
 *
 * Late settlement: when the 300 ms deadline expires first, the outcome is
 * FOREGROUND_BUDGET_EXPIRY and the still-running RPC keeps its handlers
 * attached - a late fulfillment or rejection settles into the already-settled
 * race as a no-op, so it can never become an unhandled rejection, never
 * mutates the assembled provider request, never triggers a second provider
 * call, and is never cached into another turn. The database reservation
 * semantics own orphan safety: a late reservation cannot outlive its source
 * turn because every canonical terminalizer releases it in the same
 * transaction that terminalizes the turn.
 *
 * Failure: hard authority/integrity/malformed/unexpected failures reject the
 * selection with the ORIGINAL error (fail closed); only the exact approved
 * availability failures degrade, per the classifier above.
 */
@Injectable()
export class QuestionForegroundSelectionService {
  constructor(
    private readonly serviceApi: SupabaseServiceRoleApiService,
    private readonly correlation: CorrelationService,
    private readonly telemetry: TelemetryService,
  ) {}

  select(input: QuestionForegroundSelectionInput): Promise<QuestionForegroundOutcome> {
    // The ONE selection RPC, launched here synchronously and exactly once per
    // turn. The application supplies ONLY the caller identity triple: the
    // database derives the canonical eligible target, so no gap id, hypothesis
    // id, confidence id, missing-information code, objective, status, or epoch
    // ever travels as caller authority.
    const selectionRead = this.engine('question_selection', input.path, () =>
      this.serviceApi.rpc<unknown>('select_formal_question_opportunity_v1', {
        p_user_id: input.userId, p_session_id: input.sessionId, p_source_turn_id: input.sourceTurnId,
      }));
    const classified = selectionRead.then(
      (value) => classifySelectionResult(value),
      (error) => classifyQuestionSelectionFailure(error),
    );
    // The frozen QIR-006 foreground deadline. One timer, cleared on the
    // classified settlement, so a fast selection leaks no timer; the timer
    // resolves a shared deadline promise instead of rejecting anything, so a
    // late classified settlement is absorbed by the already-settled race.
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<typeof FOREGROUND_BUDGET_EXPIRY_OUTCOME>((resolve) => {
      deadlineTimer = setTimeout(() => resolve(FOREGROUND_BUDGET_EXPIRY_OUTCOME), QUESTION_FOREGROUND_WAIT_BUDGET_MS);
    });
    classified.then(() => clearTimeout(deadlineTimer), () => clearTimeout(deadlineTimer));
    // Exactly one bounded outcome per selection: the classified settlement
    // races the deadline, the outcome metric is emitted once at determination
    // time (a post-deadline settlement therefore emits nothing and is
    // discarded for this turn), and a hard failure records HARD_FAILURE and
    // rethrows the ORIGINAL error so the turn fails closed.
    return Promise.race([classified, deadline]).then(
      (outcome) => { this.recordOutcome(outcome.state, input.path, outcome.state === 'LEGITIMATE_EMPTY' ? outcome.reason : undefined); return outcome; },
      (error) => {
        this.recordOutcome('HARD_FAILURE', input.path, undefined);
        throw error;
      },
    );
  }

  // Bounded fail-soft selection-outcome telemetry. Finite dimensions only; a
  // throwing telemetry double can never alter a selection outcome or the turn.
  private recordOutcome(outcome: string, path: ProcessingPath, emptyReason: QuestionLegitimateEmptyReason | undefined): void {
    try { this.telemetry.recordQuestionForegroundSelection(outcome, path, emptyReason); } catch { /* fail-soft */ }
  }

  // The same engine-span idiom the Conversation Orchestrator and the QIR-003
  // gatherer use, so the selection RPC stays telemetry-visible under the same
  // correlation scope.
  private engine<T>(name: string, path: ProcessingPath, work: () => Promise<T> | T): Promise<T> {
    return this.correlation.current() ? this.telemetry.withEngine(name, path, work) : Promise.resolve().then(work);
  }
}
