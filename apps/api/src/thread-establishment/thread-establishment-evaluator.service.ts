// T-03B2a - the prepared Thread-establishment evaluator.
//
// Turns ONE committed CU, its canonical B1 semantic bundle and its PRIOR
// context into a prepared, in-memory establishment decision:
//
//   input boundary gates -> deterministic NO / ALREADY_ESTABLISHED short-circuit
//   -> provider-proposed evidence path -> deterministic validation
//   -> prepared result with provenance.
//
// It writes nothing. It allocates no Thread id, no Home Anchor, no Canonical
// Spatial Address and no SP. It is not a Nest provider, has no module, and is
// imported by no runtime path: T-03B2b will call it inside the SP-native
// per-Moment transaction, after B1 and before LF, and will canonicalize and
// persist what it prepares.
//
// THE NO-HINDSIGHT RULE is enforced here twice. The one-CU evaluator refuses
// any input whose "prior" context contains the current CU or a later CU of the
// same source turn, and the sequential helper builds each later CU's context
// ONLY from history plus the CUs already evaluated before it. The provider
// request for USER CU-1 therefore cannot see USER CU-2 or any assistant CU.

import { codePointLength } from '../conversation-unit/cu-anchor-mapper';
import {
  ATTENTION_KINDS,
  ATTENTION_REASONS_BY_KIND,
  CLAIM_FRAMES,
  MAX_FOCUS_SOURCE_CHARS,
  type CurrentCuInput,
  type PriorCuContext,
} from '../conversational-focus/conversational-focus.types';
import type { CanonicalClaimAttribution, CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';
import { THREAD_ESTABLISHMENT_PROMPT_VERSION } from './thread-establishment-provider.config';
import {
  THREAD_ESTABLISHMENT_SCHEMA_VERSION,
  ThreadEstablishmentProviderError,
  type ThreadEstablishmentProposal,
  type ThreadEstablishmentProvider,
} from './thread-establishment-provider.types';
import { establishmentTarget, validateThreadEstablishmentProposal } from './thread-establishment-validator';
import {
  STABLE_FOCUS_ID_PATTERN,
  THREAD_ESTABLISHMENT_EVALUATOR_VERSION,
  THREAD_ESTABLISHMENT_POLICY_VERSION,
  ThreadEstablishmentRejectedError,
  type FocusAttentionHistoryEntry,
  type NoEstablishmentReason,
  type PreparedThreadEstablishmentResult,
  type ThreadEstablishmentEvaluationInput,
  type ThreadEstablishmentPriorContext,
  type ThreadEstablishmentProvenance,
} from './thread-establishment.types';

/** One CU of a sequence together with its canonical B1 semantic bundle. */
export interface SequencedCuFocusSemantics {
  readonly cu: CurrentCuInput;
  readonly focusSemantics: CanonicalCuFocusSemanticPayload;
}

export interface PreparedThreadEstablishmentSequence {
  readonly sessionId: string;
  /** One prepared result per CU, in the exact evaluation order. */
  readonly results: readonly PreparedThreadEstablishmentResult[];
  /** History plus every evaluated CU: the transient context after the last CU. */
  readonly preparedContext: ThreadEstablishmentPriorContext;
  /**
   * The stable focus ids this sequence decided to establish, in order. Technical
   * sequence state only: it allocates no Thread id and creates no canonical truth.
   */
  readonly establishedInSequence: readonly string[];
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isOrdinal = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isMember = <T extends string>(vocabulary: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (vocabulary as readonly string[]).includes(value);
const isStableFocusId = (value: unknown): value is string => typeof value === 'string' && STABLE_FOCUS_ID_PATTERN.test(value);

export class ThreadEstablishmentEvaluatorService {
  constructor(
    private readonly provider: ThreadEstablishmentProvider,
    private readonly providerName: string,
    private readonly providerModel: string,
  ) {}

  /**
   * Evaluates ONE committed CU with PRIOR context only and returns the
   * prepared decision, or throws a typed fail-closed rejection. Nothing is
   * written, and a technical failure is never reported as NO_ESTABLISHMENT.
   */
  async evaluateOne(input: ThreadEstablishmentEvaluationInput): Promise<PreparedThreadEstablishmentResult> {
    assertEvaluationInput(input);

    // Gate 8 - THR-01/02/04/11: without a stable independent focus from B1,
    // identity-specific establishment is impossible for this CU. Deterministic
    // NO, zero provider.
    const target = establishmentTarget(input.currentFocusSemantics);
    if (target === null) return this.noEstablishment(input, null, 'NO_INDEPENDENT_FOCUS');

    // Gate 9 - THR-14: an already-established focus is recognized ONLY to
    // prevent duplicate establishment. Deterministic, zero provider. Lifecycle
    // (dormancy, reopening) is T-03B3 and is not implemented here.
    if (input.priorContext.establishedFocusIds.includes(target)) return this.noEstablishment(input, target, 'ALREADY_ESTABLISHED');

    let proposal: ThreadEstablishmentProposal;
    try {
      proposal = await this.provider.propose({
        schemaVersion: THREAD_ESTABLISHMENT_SCHEMA_VERSION,
        currentCu: input.currentCu,
        currentFocusSemantics: input.currentFocusSemantics,
        priorCus: input.priorContext.priorCus,
        focusAttentionHistory: input.priorContext.focusAttentionHistory,
      });
    } catch (error) {
      // Outage, timeout or malformed structured output: fail closed. A
      // technical failure is not "no establishment".
      if (error instanceof ThreadEstablishmentProviderError) {
        throw new ThreadEstablishmentRejectedError(
          error.code === 'INVALID_STRUCTURED_OUTPUT' ? 'INVALID_PROVIDER_PAYLOAD' : 'THREAD_PROVIDER_UNAVAILABLE',
        );
      }
      throw error;
    }

    const validated = validateThreadEstablishmentProposal(proposal, input);
    if (validated.outcome === 'REJECTED') throw new ThreadEstablishmentRejectedError(validated.reason, validated.index);

    return {
      sessionId: input.sessionId,
      cuId: input.currentCu.cuId,
      sourceTurnId: input.currentCu.sourceTurnId,
      // Canonical conversational speaker: copied from the committed CU, never
      // from the proposal.
      sourceRole: input.currentCu.sourceRole,
      emergingFocusId: target,
      ...validated.establishment,
      provenance: this.provenance(),
    };
  }

  /**
   * Evaluates an ordered sequence of committed CUs one at a time, threading a
   * PREPARED transient context between them (task §12):
   *
   *   evaluate CU-1 with history only            -> append CU-1 + its attention
   *   evaluate CU-2 with history + CU-1          -> append
   *   evaluate CU-3 ...
   *
   * The sequence must be in the frozen finalized-exchange order: every USER CU
   * in source order, then every ASSISTANT CU (`orderFinalizedExchange` of the
   * B1 evaluator yields it). A CU that ESTABLISHES a focus adds that focus id
   * to the in-memory established set, so a later same-focus CU short-circuits
   * as ALREADY_ESTABLISHED with zero provider calls. No request contains a
   * later CU; no assistant CU can help establish an earlier USER CU.
   *
   * Everything returned is in-memory only.
   */
  async evaluateSequence(
    sessionId: string,
    sequence: readonly SequencedCuFocusSemantics[],
    history: ThreadEstablishmentPriorContext,
  ): Promise<PreparedThreadEstablishmentSequence> {
    assertCanonicalSequence(sequence);
    assertHistoryPrecedesSequence(history, sequence);

    const results: PreparedThreadEstablishmentResult[] = [];
    const establishedInSequence: string[] = [];
    let context: ThreadEstablishmentPriorContext = history;

    for (const { cu: currentCu, focusSemantics } of sequence) {
      const result = await this.evaluateOne({ sessionId, currentCu, currentFocusSemantics: focusSemantics, priorContext: context });
      results.push(result);

      // Only AFTER the evaluation does the current CU become prior context for
      // the CUs that follow it: its committed wording and B1 function context,
      // and its canonical attention as one append-preserved history entry.
      const priorCu: PriorCuContext = {
        cuId: currentCu.cuId,
        sourceTurnId: currentCu.sourceTurnId,
        sourceRole: currentCu.sourceRole,
        committedText: currentCu.committedText,
        ordinalWithinTurn: currentCu.ordinalWithinTurn,
        functions: focusSemantics.functions,
        sequencePosition: focusSemantics.sequence_position,
        targetCuId: focusSemantics.target_cu_id,
      };
      const attention: FocusAttentionHistoryEntry = {
        cuId: currentCu.cuId,
        attentionKind: focusSemantics.attention.kind,
        attentionReason: focusSemantics.attention.reason,
        emergingFocusId: focusSemantics.attention.emerging_focus_id,
      };
      let establishedFocusIds = context.establishedFocusIds;
      if (result.decision === 'ESTABLISH_THREAD' && result.emergingFocusId !== null) {
        establishedInSequence.push(result.emergingFocusId);
        establishedFocusIds = [...establishedFocusIds, result.emergingFocusId];
      }
      context = {
        priorCus: [...context.priorCus, priorCu],
        focusAttentionHistory: [...context.focusAttentionHistory, attention],
        establishedFocusIds,
      };
    }

    return { sessionId, results, preparedContext: context, establishedInSequence };
  }

  private noEstablishment(
    input: ThreadEstablishmentEvaluationInput,
    emergingFocusId: string | null,
    reason: NoEstablishmentReason,
  ): PreparedThreadEstablishmentResult {
    return {
      sessionId: input.sessionId,
      cuId: input.currentCu.cuId,
      sourceTurnId: input.currentCu.sourceTurnId,
      sourceRole: input.currentCu.sourceRole,
      emergingFocusId,
      decision: 'NO_ESTABLISHMENT',
      path: null,
      noEstablishmentReason: reason,
      evidenceCuIds: [],
      explicitSelectionGrounding: null,
      provenance: this.provenance(),
    };
  }

  private provenance(): ThreadEstablishmentProvenance {
    return {
      evaluatorVersion: THREAD_ESTABLISHMENT_EVALUATOR_VERSION,
      policyVersion: THREAD_ESTABLISHMENT_POLICY_VERSION,
      provider: this.providerName,
      model: this.providerModel,
      promptVersion: THREAD_ESTABLISHMENT_PROMPT_VERSION,
      schemaVersion: THREAD_ESTABLISHMENT_SCHEMA_VERSION,
    };
  }
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
    throw new ThreadEstablishmentRejectedError('INVALID_EVALUATION_INPUT');
  }
}

/**
 * The canonical B1 bundle must be exactly this CU's, and the parts this
 * evaluator reads must be within the frozen B1 vocabulary: attention kind and
 * reason, a stable focus id exactly when attention is focus-bearing, and
 * code-point claim spans inside the committed text. Nothing is re-derived.
 */
function assertFocusSemantics(semantics: CanonicalCuFocusSemanticPayload, currentCu: CurrentCuInput): void {
  const invalid = () => new ThreadEstablishmentRejectedError('INVALID_EVALUATION_INPUT');
  if (!semantics || typeof semantics !== 'object') throw invalid();
  if (semantics.unit_id !== currentCu.cuId) throw new ThreadEstablishmentRejectedError('FOCUS_SEMANTICS_MISMATCH');
  const { attention } = semantics;
  if (!attention || typeof attention !== 'object' || !isMember(ATTENTION_KINDS, attention.kind) || !isMember(ATTENTION_REASONS_BY_KIND[attention.kind], attention.reason)) {
    throw invalid();
  }
  if (attention.kind === 'NO_INDEPENDENT_FOCUS') {
    if (attention.emerging_focus_id !== null) throw invalid();
  } else if (!isStableFocusId(attention.emerging_focus_id)) {
    throw invalid();
  }
  if (!Array.isArray(semantics.claim_attributions)) throw invalid();
  const claims: readonly CanonicalClaimAttribution[] = semantics.claim_attributions;
  const length = codePointLength(currentCu.committedText);
  for (const claim of claims) {
    if (
      !claim ||
      !isMember(CLAIM_FRAMES, claim.claim_frame) ||
      !isOrdinal(claim.span_start) ||
      !isOrdinal(claim.span_end) ||
      claim.span_end <= claim.span_start ||
      claim.span_end > length
    ) {
      throw invalid();
    }
  }
}

/**
 * The input boundary (task §10, gates 1-7): one committed CU with ITS canonical
 * B1 bundle, and a prior context that holds nothing from this CU or after it.
 * A malformed context is never treated as truthful non-establishment: every
 * violation throws before the provider is consulted.
 */
function assertEvaluationInput(input: ThreadEstablishmentEvaluationInput): void {
  if (!input || !isNonEmptyString(input.sessionId) || !input.priorContext || !input.currentFocusSemantics) {
    throw new ThreadEstablishmentRejectedError('INVALID_EVALUATION_INPUT');
  }
  const { currentCu, priorContext } = input;
  assertCurrentCu(currentCu);
  assertFocusSemantics(input.currentFocusSemantics, currentCu);
  const invalid = () => new ThreadEstablishmentRejectedError('INVALID_EVALUATION_INPUT');
  const future = () => new ThreadEstablishmentRejectedError('FUTURE_CONTEXT_FORBIDDEN');
  const unavailable = () => new ThreadEstablishmentRejectedError('PRIOR_EVIDENCE_NOT_AVAILABLE');
  const invalidHistory = () => new ThreadEstablishmentRejectedError('INVALID_ATTENTION_HISTORY');

  if (!Array.isArray(priorContext.priorCus) || !Array.isArray(priorContext.focusAttentionHistory) || !Array.isArray(priorContext.establishedFocusIds)) {
    throw invalid();
  }
  const priorCus: readonly PriorCuContext[] = priorContext.priorCus;
  const focusAttentionHistory: readonly FocusAttentionHistoryEntry[] = priorContext.focusAttentionHistory;
  const establishedFocusIds: readonly string[] = priorContext.establishedFocusIds;

  // Gates 3 and 5: ordered, unique prior CUs; the current CU or a later CU of
  // its turn is hindsight. Within one source turn the frozen committed-CU
  // contract allows forward progress, so an EARLIER committed CU of the current
  // turn is legitimate prior context (FIX-T03B2A-01), and one source turn has
  // exactly one canonical source role (FIX-T03B2A-03).
  const priorCuIds = new Set<string>();
  const seenTurns = new Set<string>();
  let currentTurn: string | null = null;
  let currentTurnRole: 'USER' | 'ASSISTANT' | null = null;
  let lastOrdinal = -1;
  for (const prior of priorCus) {
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
    if (prior.sourceTurnId === currentCu.sourceTurnId) {
      if (prior.ordinalWithinTurn >= currentCu.ordinalWithinTurn) throw future();
      if (prior.sourceRole !== currentCu.sourceRole) throw invalid();
    }
    if (prior.sourceTurnId !== currentTurn) {
      // A turn, once left, never resumes; within a turn ordinals ascend.
      if (seenTurns.has(prior.sourceTurnId)) throw invalid();
      seenTurns.add(prior.sourceTurnId);
      currentTurn = prior.sourceTurnId;
      currentTurnRole = prior.sourceRole;
      lastOrdinal = -1;
    } else if (prior.sourceRole !== currentTurnRole) {
      throw invalid();
    }
    if (prior.ordinalWithinTurn <= lastOrdinal) throw invalid();
    lastOrdinal = prior.ordinalWithinTurn;
    priorCuIds.add(prior.cuId);
  }

  // Gates 4, 6 and 7: every history CU exists in priorCus; the attention
  // vocabulary is exactly B1's; every non-null focus id is a stable identity,
  // never a transient `prepared:` one.
  const historyCuIds = new Set<string>();
  for (const entry of focusAttentionHistory) {
    if (!entry || !isNonEmptyString(entry.cuId) || historyCuIds.has(entry.cuId)) throw invalidHistory();
    if (entry.cuId === currentCu.cuId) throw future();
    if (!priorCuIds.has(entry.cuId)) throw unavailable();
    if (!isMember(ATTENTION_KINDS, entry.attentionKind) || !isMember(ATTENTION_REASONS_BY_KIND[entry.attentionKind], entry.attentionReason)) {
      throw invalidHistory();
    }
    if (entry.attentionKind === 'NO_INDEPENDENT_FOCUS') {
      if (entry.emergingFocusId !== null) throw invalidHistory();
    } else if (!isStableFocusId(entry.emergingFocusId)) {
      throw invalidHistory();
    }
    historyCuIds.add(entry.cuId);
  }

  const established = new Set<string>();
  for (const focusId of establishedFocusIds) {
    if (!isStableFocusId(focusId) || established.has(focusId)) throw invalid();
    established.add(focusId);
  }
}

function assertCanonicalSequence(sequence: readonly SequencedCuFocusSemantics[]): void {
  if (!Array.isArray(sequence)) throw new ThreadEstablishmentRejectedError('INVALID_EVALUATION_INPUT');
  const seenTurns = new Set<string>();
  const seenCus = new Set<string>();
  let currentTurn: string | null = null;
  let currentTurnRole: 'USER' | 'ASSISTANT' | null = null;
  let lastOrdinal = -1;
  let assistantSeen = false;
  for (const item of sequence) {
    if (!item) throw new ThreadEstablishmentRejectedError('INVALID_EVALUATION_INPUT');
    const { cu } = item;
    assertCurrentCu(cu);
    assertFocusSemantics(item.focusSemantics, cu);
    if (seenCus.has(cu.cuId)) throw new ThreadEstablishmentRejectedError('INVALID_EVALUATION_INPUT');
    seenCus.add(cu.cuId);
    // The frozen finalized-exchange order: every USER CU before any ASSISTANT CU.
    if (cu.sourceRole === 'ASSISTANT') assistantSeen = true;
    else if (assistantSeen) throw new ThreadEstablishmentRejectedError('FUTURE_CONTEXT_FORBIDDEN');
    if (cu.sourceTurnId !== currentTurn) {
      // A turn, once left, never resumes: no interleaving.
      if (seenTurns.has(cu.sourceTurnId)) throw new ThreadEstablishmentRejectedError('FUTURE_CONTEXT_FORBIDDEN');
      seenTurns.add(cu.sourceTurnId);
      currentTurn = cu.sourceTurnId;
      currentTurnRole = cu.sourceRole;
      lastOrdinal = -1;
    } else if (cu.sourceRole !== currentTurnRole) {
      // FIX-T03B2A-03: one source turn carries exactly one canonical source
      // role; a mixed-role turn cannot represent T-03A source truth.
      throw new ThreadEstablishmentRejectedError('INVALID_EVALUATION_INPUT');
    }
    if (cu.ordinalWithinTurn <= lastOrdinal) throw new ThreadEstablishmentRejectedError('FUTURE_CONTEXT_FORBIDDEN');
    lastOrdinal = cu.ordinalWithinTurn;
  }
}

/** The per-turn boundary of one sequence: its first ordinal and its one canonical source role. */
interface SequenceTurnBoundary {
  readonly firstOrdinal: number;
  readonly sourceRole: 'USER' | 'ASSISTANT';
}

/**
 * The history boundary of one sequence (task §12, FIX-T03B2A-01/03).
 *
 * A CU id shared with the sequence is hindsight. Within one SOURCE TURN the
 * frozen committed-CU contract allows forward progress: an earlier committed CU
 * of the same turn - ordinal below the first sequence ordinal of that turn,
 * same canonical source role - is legitimate prior context, while the first
 * sequence ordinal or any later ordinal is overlapping / current / future
 * material and is refused. A same-turn prior CU with a different source role
 * is malformed source truth and is refused rather than re-labelled.
 *
 * Across DIFFERENT source turns this slice invents no global chronology from
 * opaque turn ids: T-03B2a carries no SP in its boundary. T-03B2b constructs
 * the global `priorCus` and `focusAttentionHistory` order from the
 * authoritative SP-native canonical history; T-03B2a validates the supplied
 * ordered cut and the same-turn past / current / future boundary.
 */
function assertHistoryPrecedesSequence(history: ThreadEstablishmentPriorContext, sequence: readonly SequencedCuFocusSemantics[]): void {
  if (!history || !Array.isArray(history.priorCus) || !Array.isArray(history.focusAttentionHistory)) {
    throw new ThreadEstablishmentRejectedError('INVALID_EVALUATION_INPUT');
  }
  const cuIds = new Set(sequence.map(({ cu }) => cu.cuId));
  const turnBoundaries = new Map<string, SequenceTurnBoundary>();
  for (const { cu } of sequence) {
    const boundary = turnBoundaries.get(cu.sourceTurnId);
    if (boundary === undefined || cu.ordinalWithinTurn < boundary.firstOrdinal) {
      turnBoundaries.set(cu.sourceTurnId, { firstOrdinal: cu.ordinalWithinTurn, sourceRole: cu.sourceRole });
    }
  }
  for (const prior of history.priorCus) {
    if (cuIds.has(prior.cuId)) throw new ThreadEstablishmentRejectedError('FUTURE_CONTEXT_FORBIDDEN');
    const boundary = turnBoundaries.get(prior.sourceTurnId);
    if (boundary === undefined) continue;
    if (prior.ordinalWithinTurn >= boundary.firstOrdinal) throw new ThreadEstablishmentRejectedError('FUTURE_CONTEXT_FORBIDDEN');
    if (prior.sourceRole !== boundary.sourceRole) throw new ThreadEstablishmentRejectedError('INVALID_EVALUATION_INPUT');
  }
  for (const entry of history.focusAttentionHistory) {
    if (cuIds.has(entry.cuId)) throw new ThreadEstablishmentRejectedError('FUTURE_CONTEXT_FORBIDDEN');
  }
}
