// T-03B1a - the prepared reference / attention evaluator.
//
// Turns ONE committed CU plus its PRIOR context into a prepared, in-memory
// resolution:
//
//   input boundary gate -> provider-proposed structured resolution
//   -> deterministic mapping + validation -> prepared result with provenance.
//
// It writes nothing. It allocates no reference handle, no emerging_focus_id
// and no SP. It is not a Nest provider, has no module, and is imported by no
// runtime path: T-03B1b will call it inside the SP-native atomic transaction,
// one Moment at a time, in canonical order.
//
// THE NO-HINDSIGHT RULE (§16) is enforced here twice. The one-CU evaluator
// refuses any input whose "prior" context contains the current CU or a later
// CU of the same source turn, and the sequential helper builds each later
// CU's context ONLY from history plus the prepared results of the CUs already
// evaluated before it. The provider call for CU-1 therefore cannot see CU-2.

import {
  FOCUS_EVALUATOR_VERSION,
  FOCUS_POLICY_VERSION,
  FocusEvaluationRejectedError,
  MAX_FOCUS_SOURCE_CHARS,
  type ConversationalFocusEvaluationInput,
  type CurrentCuInput,
  type FocusCandidate,
  type FocusEvaluationProvenance,
  type PreparedConversationalFocusResult,
  type PriorContext,
  type PriorCuContext,
  type ReferenceHandleCandidate,
} from './conversational-focus.types';
import { codePointLength } from '../conversation-unit/cu-anchor-mapper';
import { FOCUS_RESOLUTION_PROMPT_VERSION } from './focus-resolution-provider.config';
import {
  FOCUS_RESOLUTION_SCHEMA_VERSION,
  FocusResolutionProviderError,
  type FocusResolutionProposal,
  type FocusResolutionProvider,
} from './focus-resolution-provider.types';
import { validateFocusResolutionProposal } from './focus-resolution-validator';

/**
 * Every identity minted by the sequential helper carries this prefix. It is a
 * PREPARED, transient, batch-local identity: not canonical, not client-visible,
 * not historically queryable. T-03B1b assigns durable identity and writes.
 */
export const PREPARED_ID_PREFIX = 'prepared:';

/** A reference first grounded by a CU of this sequence, with its transient id. */
export interface PreparedReferenceHandle {
  readonly preparedHandleId: string;
  readonly cuId: string;
  readonly referenceIndex: number;
  readonly exactSurface: string;
}

/** An Emerging Focus candidate first proposed by a CU of this sequence. */
export interface PreparedFocusCandidate extends FocusCandidate {
  readonly startedByCuId: string;
}

export interface PreparedSequenceEvaluation {
  readonly sessionId: string;
  /** One prepared result per CU, in the exact evaluation order. */
  readonly results: readonly PreparedConversationalFocusResult[];
  /** History plus every prepared candidate: the transient context after the last CU. */
  readonly preparedContext: PriorContext;
  readonly preparedReferenceHandles: readonly PreparedReferenceHandle[];
  readonly preparedFocusCandidates: readonly PreparedFocusCandidate[];
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isOrdinal = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export class ConversationalFocusEvaluatorService {
  constructor(
    private readonly provider: FocusResolutionProvider,
    private readonly providerName: string,
    private readonly providerModel: string,
  ) {}

  /**
   * Evaluates ONE committed CU with PRIOR context only and returns the
   * prepared result, or throws a typed fail-closed rejection. Nothing is
   * written and no failure is ever reported as an attention value.
   */
  async evaluateOne(input: ConversationalFocusEvaluationInput): Promise<PreparedConversationalFocusResult> {
    assertEvaluationInput(input);

    let proposal: FocusResolutionProposal;
    try {
      proposal = await this.provider.propose({
        schemaVersion: FOCUS_RESOLUTION_SCHEMA_VERSION,
        currentCu: input.currentCu,
        priorCus: input.priorContext.priorCus,
        referenceHandles: input.priorContext.referenceHandles,
        focusCandidates: input.priorContext.focusCandidates,
        currentFocusCandidateId: input.priorContext.currentFocusCandidateId,
      });
    } catch (error) {
      // Outage, timeout or malformed structured output: fail closed. A
      // technical failure is not "no independent focus".
      if (error instanceof FocusResolutionProviderError) {
        throw new FocusEvaluationRejectedError(
          error.code === 'INVALID_STRUCTURED_OUTPUT' ? 'INVALID_PROVIDER_PAYLOAD' : 'FOCUS_PROVIDER_UNAVAILABLE',
        );
      }
      throw error;
    }

    const validated = validateFocusResolutionProposal(proposal, input);
    if (validated.outcome === 'REJECTED') throw new FocusEvaluationRejectedError(validated.reason, validated.index);

    return {
      sessionId: input.sessionId,
      cuId: input.currentCu.cuId,
      sourceTurnId: input.currentCu.sourceTurnId,
      // Canonical conversational speaker: copied from the committed CU, never
      // from the proposal (CU-13).
      sourceRole: input.currentCu.sourceRole,
      ...validated.resolution,
      provenance: this.provenance(),
    };
  }

  /**
   * Evaluates an ordered sequence of committed CUs one at a time, threading a
   * PREPARED transient context between them (§16/§17):
   *
   *   evaluate CU-1 with history only -> update transient context
   *   evaluate CU-2 with history + CU-1 prepared result -> update
   *   evaluate CU-3 ...
   *
   * The sequence must be in canonical order: CUs of one source turn strictly
   * ascending by ordinal and never interleaved with another turn. For a
   * finalized exchange, build it with `orderFinalizedExchange`. The history
   * may not already contain any CU or turn of the sequence - that would be
   * hindsight smuggled in as history.
   *
   * Everything returned is in-memory only.
   */
  async evaluateSequence(
    sessionId: string,
    sequence: readonly CurrentCuInput[],
    history: PriorContext,
  ): Promise<PreparedSequenceEvaluation> {
    assertCanonicalSequence(sequence);
    assertHistoryPrecedesSequence(history, sequence);

    const results: PreparedConversationalFocusResult[] = [];
    const preparedReferenceHandles: PreparedReferenceHandle[] = [];
    const preparedFocusCandidates: PreparedFocusCandidate[] = [];
    let context: PriorContext = history;

    for (const currentCu of sequence) {
      const result = await this.evaluateOne({ sessionId, currentCu, priorContext: context });
      results.push(result);

      // New references grounded by THIS CU become selectable candidates for
      // every LATER CU, with exact grounding back to this CU.
      const newHandles: ReferenceHandleCandidate[] = [];
      const handleForReferenceIndex = new Map<number, string>();
      result.references.forEach((reference, index) => {
        if (reference.state === 'RESOLVED' && reference.resolvedHandleId !== null) {
          handleForReferenceIndex.set(index, reference.resolvedHandleId);
          return;
        }
        if (reference.state !== 'RESOLVED' || !reference.newReference) return;
        const preparedHandleId = `${PREPARED_ID_PREFIX}reference:${currentCu.cuId}:${index}`;
        handleForReferenceIndex.set(index, preparedHandleId);
        preparedReferenceHandles.push({ preparedHandleId, cuId: currentCu.cuId, referenceIndex: index, exactSurface: reference.anchor.text });
        newHandles.push({ handleId: preparedHandleId, grounding: [{ cuId: currentCu.cuId, exactSurface: reference.anchor.text }] });
      });

      let focusCandidates: readonly FocusCandidate[] = context.focusCandidates;
      let currentFocusCandidateId = context.currentFocusCandidateId;
      const { attention } = result;
      if (attention.kind === 'START_NEW_FOCUS' && attention.grounding !== null) {
        const groundingAnchor = attention.grounding.anchor;
        const groundingIndex = result.references.findIndex(
          (reference) => reference.anchor.text === groundingAnchor.text && reference.anchor.occurrence === groundingAnchor.occurrence,
        );
        const groundingHandleId = handleForReferenceIndex.get(groundingIndex);
        // The validator guarantees a RESOLVED grounding reference exists.
        if (groundingHandleId === undefined) throw new FocusEvaluationRejectedError('FOCUS_GROUNDING_REQUIRED');
        const candidate: PreparedFocusCandidate = {
          focusCandidateId: `${PREPARED_ID_PREFIX}focus:${currentCu.cuId}`,
          groundingHandleIds: [groundingHandleId],
          priorGroundingCuIds: [currentCu.cuId],
          startedByCuId: currentCu.cuId,
        };
        preparedFocusCandidates.push(candidate);
        focusCandidates = [...focusCandidates, candidate];
        currentFocusCandidateId = candidate.focusCandidateId;
      } else if (attention.kind === 'ATTEND_EXISTING_FOCUS' && attention.existingFocusCandidateId !== null) {
        const attended = attention.existingFocusCandidateId;
        focusCandidates = focusCandidates.map((focus) =>
          focus.focusCandidateId === attended
            ? { ...focus, priorGroundingCuIds: [...focus.priorGroundingCuIds, currentCu.cuId] }
            : focus,
        );
        currentFocusCandidateId = attended;
      }

      const priorCu: PriorCuContext = {
        cuId: currentCu.cuId,
        sourceTurnId: currentCu.sourceTurnId,
        sourceRole: currentCu.sourceRole,
        committedText: currentCu.committedText,
        ordinalWithinTurn: currentCu.ordinalWithinTurn,
        functions: result.functions,
        sequencePosition: result.sequencePosition,
        targetCuId: result.targetCuId,
      };
      context = {
        priorCus: [...context.priorCus, priorCu],
        referenceHandles: [...context.referenceHandles, ...newHandles],
        focusCandidates,
        currentFocusCandidateId,
      };
    }

    return { sessionId, results, preparedContext: context, preparedReferenceHandles, preparedFocusCandidates };
  }

  private provenance(): FocusEvaluationProvenance {
    return {
      evaluatorVersion: FOCUS_EVALUATOR_VERSION,
      policyVersion: FOCUS_POLICY_VERSION,
      provider: this.providerName,
      model: this.providerModel,
      promptVersion: FOCUS_RESOLUTION_PROMPT_VERSION,
      schemaVersion: FOCUS_RESOLUTION_SCHEMA_VERSION,
    };
  }
}

/**
 * The canonical evaluation order of one finalized USER -> ASSISTANT exchange:
 * every USER CU in source order, then every ASSISTANT CU in source order.
 * Assistant CUs may consume the prepared USER results; USER CUs can never see
 * assistant material, because it is not in the sequence before them.
 */
export function orderFinalizedExchange(
  userCus: readonly CurrentCuInput[],
  assistantCus: readonly CurrentCuInput[],
): readonly CurrentCuInput[] {
  if (userCus.some((cu) => cu.sourceRole !== 'USER') || assistantCus.some((cu) => cu.sourceRole !== 'ASSISTANT')) {
    throw new FocusEvaluationRejectedError('INVALID_EVALUATION_INPUT');
  }
  const bySource = (left: CurrentCuInput, right: CurrentCuInput) => left.ordinalWithinTurn - right.ordinalWithinTurn;
  return [...[...userCus].sort(bySource), ...[...assistantCus].sort(bySource)];
}

function assertCurrentCu(cu: CurrentCuInput): void {
  if (
    !cu ||
    !isNonEmptyString(cu.cuId) ||
    !isNonEmptyString(cu.sourceTurnId) ||
    (cu.sourceRole !== 'USER' && cu.sourceRole !== 'ASSISTANT') ||
    !isNonEmptyString(cu.committedText) ||
    codePointLength(cu.committedText) > MAX_FOCUS_SOURCE_CHARS ||
    !isOrdinal(cu.ordinalWithinTurn)
  ) {
    throw new FocusEvaluationRejectedError('INVALID_EVALUATION_INPUT');
  }
}

/**
 * The input boundary (§6): one committed CU, and a prior context that holds
 * nothing from this CU or after it. Later CUs of the same source turn are
 * detectable by ordinal and are refused as FUTURE_CONTEXT_FORBIDDEN.
 *
 * FIX-T03B1A-01 - prior-grounding CLOSURE. Every reference-handle grounding
 * CU and every focus-candidate grounding CU must exist in the supplied
 * `priorCus`: opaque grounding from outside the supplied prior-history cut
 * cannot be smuggled into the provider request, and unknown grounding is
 * never silently discarded. Responsibilities are exact:
 *   T-03B1a forbids current/later-CU leakage within the supplied sequence and
 *           requires every grounding to be closed over the supplied priorCus;
 *   T-03B1b constructs that priorCus set from the authoritative SP-native
 *           historical cut when the evaluator becomes production-active.
 * T-03B1a alone does not prove global cross-turn chronology.
 */
function assertEvaluationInput(input: ConversationalFocusEvaluationInput): void {
  if (!input || !isNonEmptyString(input.sessionId) || !input.priorContext) {
    throw new FocusEvaluationRejectedError('INVALID_EVALUATION_INPUT');
  }
  const { currentCu, priorContext } = input;
  assertCurrentCu(currentCu);
  const invalid = () => new FocusEvaluationRejectedError('INVALID_EVALUATION_INPUT');
  const future = () => new FocusEvaluationRejectedError('FUTURE_CONTEXT_FORBIDDEN');
  const unavailable = () => new FocusEvaluationRejectedError('PRIOR_GROUNDING_NOT_AVAILABLE');

  if (!Array.isArray(priorContext.priorCus) || !Array.isArray(priorContext.referenceHandles) || !Array.isArray(priorContext.focusCandidates)) {
    throw invalid();
  }
  const priorCuIds = new Set<string>();
  for (const prior of priorContext.priorCus) {
    if (
      !prior ||
      !isNonEmptyString(prior.cuId) ||
      !isNonEmptyString(prior.sourceTurnId) ||
      (prior.sourceRole !== 'USER' && prior.sourceRole !== 'ASSISTANT') ||
      typeof prior.committedText !== 'string' ||
      !isOrdinal(prior.ordinalWithinTurn) ||
      priorCuIds.has(prior.cuId)
    ) {
      throw invalid();
    }
    if (prior.cuId === currentCu.cuId) throw future();
    if (prior.sourceTurnId === currentCu.sourceTurnId && prior.ordinalWithinTurn >= currentCu.ordinalWithinTurn) throw future();
    priorCuIds.add(prior.cuId);
  }

  const handleIds = new Set<string>();
  for (const handle of priorContext.referenceHandles) {
    if (!handle || !isNonEmptyString(handle.handleId) || handleIds.has(handle.handleId) || !Array.isArray(handle.grounding) || handle.grounding.length === 0) {
      throw invalid();
    }
    for (const grounding of handle.grounding) {
      if (!grounding || !isNonEmptyString(grounding.cuId) || !isNonEmptyString(grounding.exactSurface)) throw invalid();
      if (grounding.cuId === currentCu.cuId) throw future();
      if (!priorCuIds.has(grounding.cuId)) throw unavailable();
    }
    handleIds.add(handle.handleId);
  }

  const focusIds = new Set<string>();
  for (const focus of priorContext.focusCandidates) {
    if (!focus || !isNonEmptyString(focus.focusCandidateId) || focusIds.has(focus.focusCandidateId)) throw invalid();
    if (!Array.isArray(focus.groundingHandleIds) || focus.groundingHandleIds.length === 0 || !Array.isArray(focus.priorGroundingCuIds)) throw invalid();
    for (const handleId of focus.groundingHandleIds) if (!handleIds.has(handleId)) throw invalid();
    for (const cuId of focus.priorGroundingCuIds) {
      if (!isNonEmptyString(cuId)) throw invalid();
      if (cuId === currentCu.cuId) throw future();
      if (!priorCuIds.has(cuId)) throw unavailable();
    }
    focusIds.add(focus.focusCandidateId);
  }
  if (priorContext.currentFocusCandidateId !== null && !focusIds.has(priorContext.currentFocusCandidateId)) throw invalid();
}

function assertCanonicalSequence(sequence: readonly CurrentCuInput[]): void {
  if (!Array.isArray(sequence)) throw new FocusEvaluationRejectedError('INVALID_EVALUATION_INPUT');
  const seenTurns = new Set<string>();
  const seenCus = new Set<string>();
  let currentTurn: string | null = null;
  let lastOrdinal = -1;
  for (const cu of sequence) {
    assertCurrentCu(cu);
    if (seenCus.has(cu.cuId)) throw new FocusEvaluationRejectedError('INVALID_EVALUATION_INPUT');
    seenCus.add(cu.cuId);
    if (cu.sourceTurnId !== currentTurn) {
      // A turn, once left, never resumes: no interleaving.
      if (seenTurns.has(cu.sourceTurnId)) throw new FocusEvaluationRejectedError('FUTURE_CONTEXT_FORBIDDEN');
      seenTurns.add(cu.sourceTurnId);
      currentTurn = cu.sourceTurnId;
      lastOrdinal = -1;
    }
    if (cu.ordinalWithinTurn <= lastOrdinal) throw new FocusEvaluationRejectedError('FUTURE_CONTEXT_FORBIDDEN');
    lastOrdinal = cu.ordinalWithinTurn;
  }
}

function assertHistoryPrecedesSequence(history: PriorContext, sequence: readonly CurrentCuInput[]): void {
  if (!history || !Array.isArray(history.priorCus)) throw new FocusEvaluationRejectedError('INVALID_EVALUATION_INPUT');
  const cuIds = new Set(sequence.map((cu) => cu.cuId));
  const turnIds = new Set(sequence.map((cu) => cu.sourceTurnId));
  for (const prior of history.priorCus) {
    if (cuIds.has(prior.cuId) || turnIds.has(prior.sourceTurnId)) throw new FocusEvaluationRejectedError('FUTURE_CONTEXT_FORBIDDEN');
  }
}
