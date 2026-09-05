// T-03B3 - the production-inert post-finalization B1 + B2 + B3 orchestration.
//
// Turns ONE durable COMPLETED USER -> ASSISTANT finalized exchange into
// canonical Session time PLUS its reference / focus semantics PLUS the FINAL
// Thread layer - new Thread + permanent Home, cross-Session focus -> Thread
// continuity, Session-local Active / Dormant / Reopened lifecycle - per
// Moment, through the integrated coordinator of migration 0070:
//
//   A  relation gate (zero providers, zero mutation on an invalid pair)
//   B  stable automatic batch identities (exactly T-03A2's derivation)
//   C  integrated B3 snapshots BEFORE any provider: COMPLETE + COMPLETE is
//      canonical replay with zero calls; ABSENT + ABSENT is a new exchange;
//      every other combination fails closed with no repair and no backfill
//   D  ONE authoritative B3 context + Session-clock token + user/world Thread
//      identity version, read outside any database lock
//   E  USER and ASSISTANT segmentation, separately (T-03A2 semantics kept)
//   F  exact prepared CurrentCu inputs from the proposed spans (code points)
//   G  sequential whole-exchange B1 focus evaluation, no hindsight
//   H  ONE whole-exchange B1 canonicalization, then an exact split
//   I  for each focus-bearing CU in sequence, strictly sequential:
//        resolve the same-Session existing binding deterministically
//        else screen the user/world Thread dossiers exhaustively and resolve
//             continuity once (DISTINCT_NEW / BIND_EXISTING / AMBIGUOUS_EXISTING)
//        DISTINCT_NEW -> the frozen T-03B2a establishment evaluator
//        BIND_EXISTING / AMBIGUOUS -> no B2 promotion call, no new Thread
//        deterministic grounded Conversational Origin for a new Thread
//        deterministic Session lifecycle reduction
//   J  ONE whole-exchange Thread (B2) canonicalization and ONE whole-exchange
//      final Thread-layer (B3) canonicalization, then exact splits
//   K  one 0070 coordinator commit against BOTH exact tokens
//   L  the SAME external temporal delivery shape T-03A2 returns
//
// Bounded recovery: on any evaluation / commit failure, re-read the
// integrated snapshots first (a canonical winner is returned, partial history
// fails closed); only the two exact typed stale conditions - the Session
// Semantic Clock token and the user/world Thread identity version - earn ONE
// shared semantic re-evaluation against a re-read context and re-read
// dossiers. Segmentation is never repeated. A second stale failure is
// retryable unavailability.
//
// Production-inert: a plain class with no Nest decorator, not registered in
// ConversationModule, not called by ConversationService. The live T-03A2 path
// stays exactly live; T-03D performs the final cutover once effective LF joins
// the same per-Moment transaction. It is a POST-FINALIZATION phase: it never
// marks a completed turn FAILED, never calls failTurn, regenerates nothing,
// and no Thread, Home, binding or lifecycle value becomes client payload.

import type { ConversationTemporalDelivery, ConversationalUnitsCommittedWireEvent } from '@qandeel/runtime';
import type { ConversationTurn, OrchestratedTurnResult } from '../conversation/conversation.types';
import { ConversationUnitCommitmentService } from '../conversation-unit/conversation-unit-commitment.service';
import type { CuSegmentationBinding, CuSegmentationBindingFactory } from '../conversation-unit/conversation-temporal-establishment.service';
import { CommitmentRejectedError, type CommitConversationUnitsRequest, type CommittedConversationUnitEventRow } from '../conversation-unit/conversation-unit.types';
import { automaticCommitBatchId, automaticCommitUnitId } from '../conversation-unit/deterministic-runtime-id';
import { toCommittedWireEvent } from '../conversation-unit/temporal-delivery.repository';
import { ConversationalFocusEvaluatorService, orderFinalizedExchange } from '../conversational-focus/conversational-focus-evaluator.service';
import {
  FOCUS_EVALUATOR_VERSION,
  FOCUS_POLICY_VERSION,
  FocusEvaluationRejectedError,
  type CurrentCuInput,
  type PreparedConversationalFocusResult,
  type PriorCuContext,
} from '../conversational-focus/conversational-focus.types';
import { canonicalizePreparedFocusSequence } from '../conversational-focus/durable-focus-canonicalizer';
import type { CanonicalCuFocusSemanticPayload, CanonicalFocusBatchProvenance } from '../conversational-focus/durable-focus-payload.types';
import { FOCUS_RESOLUTION_PROMPT_VERSION } from '../conversational-focus/focus-resolution-provider.config';
import { FOCUS_RESOLUTION_SCHEMA_VERSION, FocusResolutionProviderError } from '../conversational-focus/focus-resolution-provider.types';
import type { FocusResolutionBinding, FocusResolutionBindingFactory } from '../conversational-focus/focus-resolution-binding';
import { StaleConversationalFocusContextError } from '../conversational-focus/conversation-focus-runtime.types';
import { assertThreadProvenanceAgreement, buildPreparedThreadCuInputs } from '../thread-establishment/conversation-thread-establishment.service';
import { ConversationThreadIntegrityError } from '../thread-establishment/conversation-thread-runtime.types';
import { deriveConversationalOrigin, type OriginEstablishedThread } from '../thread-establishment/conversational-origin-mapper';
import { canonicalizePreparedThreadSequence, durableThreadId } from '../thread-establishment/durable-thread-canonicalizer';
import type {
  CanonicalThreadBatchProvenance,
  CanonicalThreadEstablishmentPayload,
  PreparedConversationalOrigin,
} from '../thread-establishment/durable-thread-payload.types';
import { THREAD_ESTABLISHMENT_PROMPT_VERSION } from '../thread-establishment/thread-establishment-provider.config';
import { THREAD_ESTABLISHMENT_SCHEMA_VERSION, ThreadEstablishmentProviderError } from '../thread-establishment/thread-establishment-provider.types';
import type { ThreadEstablishmentBinding, ThreadEstablishmentBindingFactory } from '../thread-establishment/thread-establishment-binding';
import { ThreadEstablishmentEvaluatorService } from '../thread-establishment/thread-establishment-evaluator.service';
import {
  THREAD_ESTABLISHMENT_EVALUATOR_VERSION,
  THREAD_ESTABLISHMENT_POLICY_VERSION,
  ThreadEstablishmentRejectedError,
  type FocusAttentionHistoryEntry,
  type PreparedThreadEstablishmentResult,
  type ThreadEstablishmentPriorContext,
} from '../thread-establishment/thread-establishment.types';
import type { ConversationThreadLifecycleRuntimeBoundary } from './conversation-thread-lifecycle-runtime.repository';
import { sessionThreadStates } from './conversation-thread-lifecycle-runtime-mapper';
import {
  ConversationThreadLifecycleIntegrityError,
  ConversationThreadLifecycleUnavailableError,
  MAX_THREAD_LIFECYCLE_STALE_CONTEXT_RETRIES,
  StaleThreadIdentityContextError,
  type ConversationThreadLifecycleRuntimeContext,
  type FinalizedExchangeWithThreadLifecycleResult,
  type IntegratedThreadLifecycleBatchSnapshot,
} from './conversation-thread-lifecycle-runtime.types';
import { canonicalizePreparedThreadLayerSequence, type PreparedIdentityEvidenceRef, type PreparedThreadLayerDecision } from './durable-thread-lifecycle-canonicalizer';
import type { CanonicalThreadLifecycleBatchProvenance, CanonicalThreadLifecyclePayload, ThreadLayerOutcome } from './durable-thread-lifecycle-payload.types';
import type { ThreadContinuityBinding, ThreadContinuityBindingFactory } from './thread-continuity-binding';
import { THREAD_CONTINUITY_PROMPT_VERSION } from './thread-continuity-provider.config';
import { THREAD_CONTINUITY_SCHEMA_VERSION, ThreadContinuityProviderError } from './thread-continuity-provider.types';
import { ThreadContinuityEvaluatorService } from './thread-continuity-evaluator.service';
import {
  compareThreadIdText,
  THREAD_CONTINUITY_EVALUATOR_VERSION,
  THREAD_CONTINUITY_SCREEN_CHUNK_SIZE,
  ThreadContinuityRejectedError,
  type CurrentFocusGroundingSurface,
  type PreparedThreadContinuityResult,
  type ThreadIdentityDossier,
} from './thread-continuity.types';
import { reduceThreadLifecycle } from './thread-lifecycle-reducer';
import {
  THREAD_LIFECYCLE_POLICY_VERSION,
  THREAD_LIFECYCLE_REDUCER_VERSION,
  ThreadLifecycleRejectedError,
  type ThreadFocusBindingKind,
  type ThreadLifecycleState,
} from './thread-lifecycle.types';

/** The prepared, provider-independent segmentation of one half of the exchange. */
interface SegmentedHalf {
  readonly turn: ConversationTurn;
  readonly batch: CommitConversationUnitsRequest;
  readonly sourceFrontier: number;
}

/** The whole-exchange semantic result, already split by exact USER / ASSISTANT counts. */
interface EvaluatedExchange {
  readonly userFocusUnits: readonly CanonicalCuFocusSemanticPayload[];
  readonly assistantFocusUnits: readonly CanonicalCuFocusSemanticPayload[];
  readonly userThreadUnits: readonly CanonicalThreadEstablishmentPayload[];
  readonly assistantThreadUnits: readonly CanonicalThreadEstablishmentPayload[];
  readonly userLifecycleUnits: readonly CanonicalThreadLifecyclePayload[];
  readonly assistantLifecycleUnits: readonly CanonicalThreadLifecyclePayload[];
  readonly focusProvenance: CanonicalFocusBatchProvenance;
  readonly threadProvenance: CanonicalThreadBatchProvenance;
  readonly lifecycleProvenance: CanonicalThreadLifecycleBatchProvenance;
}

/** One Session focus -> Thread binding visible to the evaluation (prior or same-exchange). */
interface VisibleBinding {
  readonly threadId: string;
  readonly bindingKind: ThreadFocusBindingKind;
}

export class ConversationThreadLifecycleEstablishmentService {
  private segmentation: CuSegmentationBinding | undefined;
  private focus: FocusResolutionBinding | undefined;
  private thread: ThreadEstablishmentBinding | undefined;
  private continuity: ThreadContinuityBinding | undefined;

  constructor(
    private readonly repository: ConversationThreadLifecycleRuntimeBoundary,
    private readonly createSegmentationBinding: CuSegmentationBindingFactory,
    private readonly createFocusBinding: FocusResolutionBindingFactory,
    private readonly createThreadBinding: ThreadEstablishmentBindingFactory,
    private readonly createContinuityBinding: ThreadContinuityBindingFactory,
  ) {}

  /**
   * The same entry shape as T-03A2: a result that is not yet a completed pair
   * is returned untouched; a completed pair gains the additive `temporal`
   * delivery. No Thread, Home, binding or lifecycle payload exists on the
   * wire, and no client schema changes.
   */
  async establish(userId: string, result: OrchestratedTurnResult): Promise<OrchestratedTurnResult> {
    const { userTurn, assistantTurn } = result;
    if (!assistantTurn) return result;
    if (userTurn.status !== 'COMPLETED' || assistantTurn.status !== 'COMPLETED') return result;
    return { ...result, temporal: await this.establishExchange(userId, userTurn, assistantTurn) };
  }

  async establishExchange(userId: string, userTurn: ConversationTurn, assistantTurn: ConversationTurn): Promise<ConversationTemporalDelivery> {
    // A. The ONE relation gate, including both COMPLETED statuses: before any
    // read, any binding construction, any provider call and any write. It
    // throws outside the try, so an invalid pair is never unavailability.
    assertFinalizedExchangeRelation(userTurn, assistantTurn);
    try {
      return await this.run(userId, userTurn, assistantTurn);
    } catch (error) {
      if (error instanceof ConversationThreadLifecycleIntegrityError || error instanceof ConversationThreadLifecycleUnavailableError) throw error;
      // The reused T-03B2b3 mappers report their integrity failures in their own class; they stay integrity.
      if (error instanceof ConversationThreadIntegrityError) throw error;
      // A segmentation outage or rejection (T-03A1), a focus provider outage
      // or rejected focus proposal (T-03B1a), a Thread provider outage or
      // rejected promotion (T-03B2a), or a continuity provider outage or
      // rejected proposal (T-03B3): retryable, never a lifecycle failure of
      // the completed turns, and never reinterpreted as DISTINCT_NEW,
      // NO_THREAD_ACTION or NO_ESTABLISHMENT.
      if (error instanceof CommitmentRejectedError || error instanceof FocusResolutionProviderError
        || error instanceof FocusEvaluationRejectedError || error instanceof ThreadEstablishmentProviderError
        || error instanceof ThreadEstablishmentRejectedError || error instanceof ThreadContinuityProviderError
        || error instanceof ThreadContinuityRejectedError) {
        throw new ConversationThreadLifecycleUnavailableError('PROVIDER_UNAVAILABLE', { cause: error });
      }
      // A malformed lifecycle context is a runtime integrity failure, never "no transition".
      if (error instanceof ThreadLifecycleRejectedError) throw new ConversationThreadLifecycleIntegrityError('LIFECYCLE_CONTEXT_NOT_CLOSED');
      throw new ConversationThreadLifecycleUnavailableError('TRANSPORT_UNAVAILABLE', { cause: error });
    }
  }

  private async run(userId: string, userTurn: ConversationTurn, assistantTurn: ConversationTurn): Promise<ConversationTemporalDelivery> {
    // B. Stable automatic identities: technical idempotency, exactly T-03A2's.
    const userBatchId = automaticCommitBatchId(userTurn.id);
    const assistantBatchId = automaticCommitBatchId(assistantTurn.id);

    // C. Integrated B3 snapshots before any provider.
    const snapshots = await this.readSnapshots(userId, userTurn, assistantTurn, userBatchId, assistantBatchId);
    const replayed = this.canonicalDelivery(snapshots);
    if (replayed) return replayed;

    // D. One authoritative context, read outside any database lock.
    let context = await this.repository.readRuntimeContext({ sessionId: userTurn.session_id, userId });

    // E. Segmentation, USER and ASSISTANT separately (may run concurrently).
    const userHalf = this.segment(userId, userTurn, userBatchId, snapshots[0].source_frontier);
    const assistantHalf = this.segment(userId, assistantTurn, assistantBatchId, snapshots[1].source_frontier);
    userHalf.catch(() => undefined);
    assistantHalf.catch(() => undefined);
    const halves = await Promise.all([userHalf, assistantHalf]);
    const segmentationProvenance = segmentationProvenanceOf(halves[0].batch, halves[1].batch);

    let retriesLeft = MAX_THREAD_LIFECYCLE_STALE_CONTEXT_RETRIES;
    for (;;) {
      try {
        // F -> J: prepared inputs, sequential B1, one B1 canonicalization,
        // sequential continuity + B2 + Origin + lifecycle, one Thread
        // canonicalization, one final Thread-layer canonicalization.
        const evaluated = await this.evaluateExchange(userTurn.session_id, userId, halves, context);
        // K. One integrated commit against BOTH exact tokens the context carried.
        const committed = await this.repository.commitFinalizedExchangeWithThreadLifecycle({
          sessionId: userTurn.session_id,
          userId,
          userSourceTurnId: userTurn.id,
          userBatchId,
          userUnits: halves[0].batch.units,
          userFocusUnits: evaluated.userFocusUnits,
          userThreadUnits: evaluated.userThreadUnits,
          userLifecycleUnits: evaluated.userLifecycleUnits,
          assistantSourceTurnId: assistantTurn.id,
          assistantBatchId,
          assistantUnits: halves[1].batch.units,
          assistantFocusUnits: evaluated.assistantFocusUnits,
          assistantThreadUnits: evaluated.assistantThreadUnits,
          assistantLifecycleUnits: evaluated.assistantLifecycleUnits,
          ...segmentationProvenance,
          ...evaluated.focusProvenance,
          ...evaluated.threadProvenance,
          ...evaluated.lifecycleProvenance,
          expectedCurrentSp: context.token.currentSp,
          expectedSameSpEventSequence: context.token.sameSpEventSequence,
          expectedWorldThreadIdentityVersion: context.worldThreadIdentityVersion,
        });
        // L. The T-03A2-compatible delivery.
        return this.deliveryFromCommit(committed);
      } catch (error) {
        // Recovery step 1: the database is authoritative. A canonical winner is
        // returned as is; partial or legacy history fails closed.
        const fresh = await this.readSnapshots(userId, userTurn, assistantTurn, userBatchId, assistantBatchId);
        const winner = this.canonicalDelivery(fresh);
        if (winner) return winner;
        // Recovery step 2: only the two exact typed stale conditions, with
        // neither batch present, earn ONE shared semantic re-evaluation.
        // Segmentation is reused; the source frontiers must not have moved.
        const stale = error instanceof StaleConversationalFocusContextError || error instanceof StaleThreadIdentityContextError;
        if (!stale) throw error;
        if (retriesLeft === 0) throw new ConversationThreadLifecycleUnavailableError('STALE_CONTEXT_RETRY_EXHAUSTED', { cause: error });
        retriesLeft -= 1;
        if (fresh[0].source_frontier !== halves[0].sourceFrontier || fresh[1].source_frontier !== halves[1].sourceFrontier) {
          throw new ConversationThreadLifecycleIntegrityError('SEGMENTATION_FRONTIER_MOVED');
        }
        context = await this.repository.readRuntimeContext({ sessionId: userTurn.session_id, userId });
      }
    }
  }

  private readSnapshots(
    userId: string,
    userTurn: ConversationTurn,
    assistantTurn: ConversationTurn,
    userBatchId: string,
    assistantBatchId: string,
  ): Promise<[IntegratedThreadLifecycleBatchSnapshot, IntegratedThreadLifecycleBatchSnapshot]> {
    const user = this.repository.readIntegratedBatchSnapshot({ sessionId: userTurn.session_id, userId, sourceTurnId: userTurn.id, batchId: userBatchId });
    const assistant = this.repository.readIntegratedBatchSnapshot({ sessionId: assistantTurn.session_id, userId, sourceTurnId: assistantTurn.id, batchId: assistantBatchId });
    user.catch(() => undefined);
    assistant.catch(() => undefined);
    return Promise.all([user, assistant]);
  }

  /**
   * Resolves an ALREADY canonical, B3-complete exchange, or `undefined` when
   * the exchange is absent at all four capture layers. Every other combination
   * fails closed BEFORE any provider is called:
   *
   *   COMPLETE + COMPLETE  canonical replay, stored delivery, zero providers
   *   ABSENT   + ABSENT    a new exchange
   *   PARTIAL involved     INCOMPLETE_THREAD_LIFECYCLE_CAPTURE (legacy
   *                        T-03A2-only, B1-only, B2-only and B2b3-only
   *                        history land here; never upgraded)
   *   ABSENT / COMPLETE    PARTIAL_INTEGRATED_EXCHANGE (never "finished")
   */
  private canonicalDelivery([user, assistant]: readonly [IntegratedThreadLifecycleBatchSnapshot, IntegratedThreadLifecycleBatchSnapshot]): ConversationTemporalDelivery | undefined {
    if (user.thread_semantic_capture_state === 'PARTIAL' || assistant.thread_semantic_capture_state === 'PARTIAL') {
      throw new ConversationThreadLifecycleIntegrityError('INCOMPLETE_THREAD_LIFECYCLE_CAPTURE');
    }
    if (user.thread_semantic_capture_state === 'ABSENT' && assistant.thread_semantic_capture_state === 'ABSENT') return undefined;
    if (user.thread_semantic_capture_state !== 'COMPLETE' || assistant.thread_semantic_capture_state !== 'COMPLETE') {
      throw new ConversationThreadLifecycleIntegrityError('PARTIAL_INTEGRATED_EXCHANGE');
    }
    const events = [verifiedEvent(user), verifiedEvent(assistant)].filter(isPresent);
    return this.delivery(maxLiveHead(user.live_head, assistant.live_head), events);
  }

  private deliveryFromCommit(committed: FinalizedExchangeWithThreadLifecycleResult): ConversationTemporalDelivery {
    const events = [committed.user_event, committed.assistant_event].filter(isPresent).map(toCommittedWireEvent);
    return this.delivery(committed.live_head, events);
  }

  private delivery(liveHead: number | null, events: readonly ConversationalUnitsCommittedWireEvent[]): ConversationTemporalDelivery {
    const ordered = [...events].sort((a, b) => a.firstSp - b.firstSp);
    const highest = ordered.reduce((max, event) => Math.max(max, event.lastSp), 0);
    if (ordered.length > 0 && (liveHead === null || liveHead < highest)) {
      throw new ConversationThreadLifecycleIntegrityError('LIVE_HEAD_NOT_ESTABLISHED');
    }
    return { liveHead, committedEvents: ordered };
  }

  /** E. One half of the exchange through the T-03A2 commitment evaluator, unchanged in meaning. */
  private async segment(userId: string, turn: ConversationTurn, batchId: string, sourceFrontier: number): Promise<SegmentedHalf> {
    this.segmentation ??= this.createSegmentationBinding();
    const commitment = new ConversationUnitCommitmentService(
      this.segmentation.provider, this.segmentation.providerName, this.segmentation.providerModel,
    );
    const batch = await commitment.evaluate(
      {
        sessionId: turn.session_id,
        userId,
        turnId: turn.id,
        role: turn.role,
        status: turn.status,
        channel: 'TEXT',
        content: turn.content,
        sourceFrontier,
      },
      { batchId, newUnitId: (unit) => automaticCommitUnitId(batchId, unit) },
    );
    return { turn, batch, sourceFrontier };
  }

  /**
   * F -> J for the whole exchange against ONE context. The focus and Thread
   * bindings are created here on first need (their identity is their
   * provenance); the continuity binding reads its identity only, and its
   * adapter is constructed on the first real screening call.
   */
  private async evaluateExchange(
    sessionId: string,
    userId: string,
    [user, assistant]: readonly [SegmentedHalf, SegmentedHalf],
    context: ConversationThreadLifecycleRuntimeContext,
  ): Promise<EvaluatedExchange> {
    this.focus ??= this.createFocusBinding();
    this.thread ??= this.createThreadBinding();
    this.continuity ??= this.createContinuityBinding();
    const focusProvenance: CanonicalFocusBatchProvenance = {
      focusEvaluatorVersion: FOCUS_EVALUATOR_VERSION,
      focusPolicyVersion: FOCUS_POLICY_VERSION,
      focusProvider: this.focus.providerName,
      focusModel: this.focus.providerModel,
      focusPromptVersion: FOCUS_RESOLUTION_PROMPT_VERSION,
      focusSchemaVersion: FOCUS_RESOLUTION_SCHEMA_VERSION,
    };
    const threadProvenance: CanonicalThreadBatchProvenance = {
      threadEvaluatorVersion: THREAD_ESTABLISHMENT_EVALUATOR_VERSION,
      threadPolicyVersion: THREAD_ESTABLISHMENT_POLICY_VERSION,
      threadProvider: this.thread.providerName,
      threadModel: this.thread.providerModel,
      threadPromptVersion: THREAD_ESTABLISHMENT_PROMPT_VERSION,
      threadSchemaVersion: THREAD_ESTABLISHMENT_SCHEMA_VERSION,
    };
    const lifecycleProvenance: CanonicalThreadLifecycleBatchProvenance = {
      continuityEvaluatorVersion: THREAD_CONTINUITY_EVALUATOR_VERSION,
      continuityPolicyVersion: THREAD_LIFECYCLE_POLICY_VERSION,
      continuityProvider: this.continuity.providerName,
      continuityModel: this.continuity.providerModel,
      continuityPromptVersion: THREAD_CONTINUITY_PROMPT_VERSION,
      continuitySchemaVersion: THREAD_CONTINUITY_SCHEMA_VERSION,
      lifecycleReducerVersion: THREAD_LIFECYCLE_REDUCER_VERSION,
    };

    // F. Exact prepared CurrentCu inputs from the proposed spans (T-03B2b3's derivation, reused).
    const userCus = buildPreparedThreadCuInputs(user.turn, user.batch.units, context.priorContext);
    const assistantCus = buildPreparedThreadCuInputs(assistant.turn, assistant.batch.units, context.priorContext);
    const sequence = orderFinalizedExchange(userCus, assistantCus);

    // G. USER CUs in source order, then ASSISTANT CUs; strictly sequential.
    let focusResults: readonly PreparedConversationalFocusResult[] = [];
    if (sequence.length > 0) {
      const evaluator = new ConversationalFocusEvaluatorService(this.focus.provider, this.focus.providerName, this.focus.providerModel);
      focusResults = (await evaluator.evaluateSequence(sessionId, sequence, context.priorContext)).results;
    }

    // H. ONE B1 canonicalization across the whole exchange, before any Thread-layer work.
    const canonicalFocus = canonicalizePreparedFocusSequence(focusResults, { sessionId, priorFocusCandidates: context.priorContext.focusCandidates });
    if (canonicalFocus.units.length !== sequence.length) throw new ConversationThreadLifecycleIntegrityError('INVALID_THREAD_LIFECYCLE_CONTEXT');

    // I. Sequential whole-exchange final Thread-layer evaluation, prior context only.
    const walk = new ThreadLayerWalk(sessionId, userId, context, this.thread, this.continuity, this.repository);
    const threadResults: PreparedThreadEstablishmentResult[] = [];
    const decisions: PreparedThreadLayerDecision[] = [];
    const originsByCuId = new Map<string, PreparedConversationalOrigin>();
    for (const [index, cu] of sequence.entries()) {
      const bundle = canonicalFocus.units[index];
      if (bundle.unit_id !== cu.cuId) throw new ConversationThreadLifecycleIntegrityError('FOCUS_SEMANTICS_MISMATCH');
      const step = await walk.evaluate(cu, bundle);
      threadResults.push(step.threadResult);
      decisions.push(step.decision);
      if (step.origin !== null) originsByCuId.set(cu.cuId, step.origin);
    }
    assertThreadProvenanceAgreement(threadResults, threadProvenance);
    assertContinuityProvenanceAgreement(walk.continuityResults, lifecycleProvenance);

    // J. ONE Thread canonicalization and ONE final Thread-layer canonicalization, then the splits.
    const canonicalThread = canonicalizePreparedThreadSequence(threadResults, { userId, originsByCuId });
    if (canonicalThread.units.length !== sequence.length) throw new ConversationThreadLifecycleIntegrityError('INVALID_THREAD_LIFECYCLE_CONTEXT');
    const canonicalLifecycle = canonicalizePreparedThreadLayerSequence(decisions, { sessionId });
    if (canonicalLifecycle.units.length !== sequence.length) throw new ConversationThreadLifecycleIntegrityError('INVALID_THREAD_LIFECYCLE_CONTEXT');

    return {
      userFocusUnits: canonicalFocus.units.slice(0, userCus.length),
      assistantFocusUnits: canonicalFocus.units.slice(userCus.length),
      userThreadUnits: canonicalThread.units.slice(0, userCus.length),
      assistantThreadUnits: canonicalThread.units.slice(userCus.length),
      userLifecycleUnits: canonicalLifecycle.units.slice(0, userCus.length),
      assistantLifecycleUnits: canonicalLifecycle.units.slice(userCus.length),
      focusProvenance,
      threadProvenance,
      lifecycleProvenance,
    };
  }
}

/** One evaluated CU of the walk. */
export interface ThreadLayerStep {
  readonly threadResult: PreparedThreadEstablishmentResult;
  readonly decision: PreparedThreadLayerDecision;
  readonly origin: PreparedConversationalOrigin | null;
}

/**
 * The strictly forward walk over the exchange. The visible prefix grows CU by
 * CU in exact evaluation order, so a decision can never see a later CU, a
 * later ASSISTANT CU, or a later same-exchange binding; a Thread bound,
 * established or reopened EARLIER in the same exchange is known to a later CU.
 *
 * T-03D supersedes this production-inert orchestration with the FINAL chain:
 * the walk is exported so the final service runs exactly this Thread-layer
 * evaluation and reduces effective LF after each CU's final Thread-layer
 * result. The walk needs only the dossier page of the boundary.
 */
export class ThreadLayerWalk {
  readonly continuityResults: PreparedThreadContinuityResult[] = [];
  /** The visible canonical B1 material: the authoritative prior history first, then the evaluated prefix. */
  private readonly semanticsByCuId = new Map<string, CanonicalCuFocusSemanticPayload>();
  /** cu_id -> position in the visible order (prior history in SP order, then the exchange prefix). */
  private readonly positionByCuId = new Map<string, number>();
  private readonly committedTextByCuId = new Map<string, string>();
  /** stable emerging_focus_id -> canonical grounding handles (0066's `grounding_handle_id`). */
  private readonly focusGroundingHandleIds = new Map<string, readonly string[]>();
  /** stable emerging_focus_id -> the CU that started it. */
  private readonly startedCuByFocusId = new Map<string, string>();
  /** handle -> its exact committed grounding surfaces (0066's context shape, extended by the prefix). */
  private readonly handleGrounding = new Map<string, CurrentFocusGroundingSurface[]>();
  /** stable emerging_focus_id -> canonical Thread, for every Session binding visible so far. */
  private readonly bindings = new Map<string, VisibleBinding>();
  /** thread_id -> then-valid Session state, for every Thread bound so far. */
  private readonly states: Map<string, ThreadLifecycleState>;
  private readonly establishedThreads: OriginEstablishedThread[];
  private priorCus: readonly PriorCuContext[];
  private focusAttentionHistory: readonly FocusAttentionHistoryEntry[];
  private previousBundle: CanonicalCuFocusSemanticPayload | null;
  private dossiers: readonly ThreadIdentityDossier[] | undefined;
  private position: number;

  constructor(
    private readonly sessionId: string,
    private readonly userId: string,
    private readonly context: ConversationThreadLifecycleRuntimeContext,
    private readonly thread: ThreadEstablishmentBinding,
    private readonly continuity: ThreadContinuityBinding,
    private readonly repository: Pick<ConversationThreadLifecycleRuntimeBoundary, 'readIdentityDossierPage'>,
  ) {
    for (const [index, cu] of context.priorContext.priorCus.entries()) {
      this.positionByCuId.set(cu.cuId, index);
      this.committedTextByCuId.set(cu.cuId, cu.committedText);
    }
    this.position = context.priorContext.priorCus.length;
    for (const bundle of context.priorFocusSemantics) this.semanticsByCuId.set(bundle.unit_id, bundle);
    for (const candidate of context.priorContext.focusCandidates) {
      this.focusGroundingHandleIds.set(candidate.focusCandidateId, candidate.groundingHandleIds);
      if (candidate.priorGroundingCuIds.length > 0) this.startedCuByFocusId.set(candidate.focusCandidateId, candidate.priorGroundingCuIds[0]);
    }
    for (const handle of context.priorContext.referenceHandles) {
      this.handleGrounding.set(handle.handleId, handle.grounding.map((g) => ({
        cuId: g.cuId, exactSurface: g.exactSurface, committedCuText: this.committedTextByCuId.get(g.cuId) ?? '',
      })));
    }
    for (const binding of context.sessionFocusThreadBindings) {
      this.bindings.set(binding.emergingFocusId, { threadId: binding.threadId, bindingKind: binding.bindingKind });
    }
    this.states = sessionThreadStates(context);
    this.establishedThreads = context.sessionFocusThreadBindings.map((binding) => ({ threadId: binding.threadId, emergingFocusId: binding.emergingFocusId }));
    this.priorCus = context.priorContext.priorCus;
    this.focusAttentionHistory = context.focusAttentionHistory;
    const last = context.priorFocusSemantics[context.priorFocusSemantics.length - 1];
    this.previousBundle = last ?? null;
  }

  async evaluate(cu: CurrentCuInput, bundle: CanonicalCuFocusSemanticPayload): Promise<ThreadLayerStep> {
    const focusId = bundle.attention.kind === 'NO_INDEPENDENT_FOCUS' ? null : bundle.attention.emerging_focus_id;
    // The CU's own bundle - its wording, its canonical references and the focus
    // it starts - is legitimately visible to its own decision; no later CU ever is.
    this.see(cu, bundle);

    let threadResult: PreparedThreadEstablishmentResult;
    let outcome: ThreadLayerOutcome;
    let threadId: string | null = null;
    let identityEvidence: readonly PreparedIdentityEvidenceRef[] = [];
    let priorIdentityEvidence: PreparedThreadContinuityResult['priorEvidenceRefs'] = [];
    let candidateThreadIds: readonly string[] = [];
    let origin: PreparedConversationalOrigin | null = null;
    let newBindingKind: ThreadFocusBindingKind | null = null;

    if (focusId === null) {
      // Deterministic, zero providers: no independent focus, no Thread question.
      threadResult = await this.establishment(cu, bundle);
      outcome = 'NO_THREAD_ACTION';
    } else {
      const bound = this.bindings.get(focusId);
      if (bound !== undefined) {
        // Same-Session existing binding: deterministic, zero continuity provider, zero B2 provider.
        threadId = bound.threadId;
        threadResult = bound.bindingKind === 'ESTABLISHMENT'
          ? await this.establishment(cu, bundle)
          : this.noEstablishment(cu, focusId);
        if (threadResult.decision !== 'NO_ESTABLISHMENT') throw new ConversationThreadLifecycleIntegrityError('INVALID_THREAD_LIFECYCLE_CONTEXT');
        outcome = this.states.get(threadId) === 'DORMANT' ? 'REOPEN_EXISTING' : 'ATTEND_EXISTING';
      } else {
        // Cross-Session continuity: exhaustive deterministic screening, one final resolution.
        const continuity = await this.resolveContinuity(cu, bundle, focusId);
        this.continuityResults.push(continuity);
        if (continuity.decision === 'DISTINCT_NEW') {
          threadResult = await this.establishment(cu, bundle);
          if (threadResult.decision === 'ESTABLISH_THREAD') {
            threadId = durableThreadId(this.userId, focusId);
            outcome = 'ESTABLISH_NEW';
            newBindingKind = 'ESTABLISHMENT';
            identityEvidence = this.establishmentIdentityEvidence(cu, focusId, threadResult.evidenceCuIds);
            origin = deriveConversationalOrigin(
              { establishingCuId: cu.cuId, targetEmergingFocusId: focusId, evidenceCuIds: threadResult.evidenceCuIds },
              { semanticsByCuId: this.semanticsByCuId, focusGroundingHandleIds: this.focusGroundingHandleIds, establishedThreads: this.establishedThreads },
            );
          } else {
            outcome = 'NO_THREAD_ACTION';
          }
        } else if (continuity.decision === 'BIND_EXISTING') {
          threadResult = this.noEstablishment(cu, focusId);
          threadId = continuity.threadId;
          outcome = 'ACTIVATE_EXISTING_IN_SESSION';
          newBindingKind = 'SESSION_CONTINUITY';
          identityEvidence = continuity.currentEvidenceReferenceIndexes.map((referenceIndex) => ({ cuId: cu.cuId, referenceIndex }));
          priorIdentityEvidence = continuity.priorEvidenceRefs;
        } else {
          threadResult = this.noEstablishment(cu, focusId);
          outcome = 'IDENTITY_AMBIGUOUS';
          candidateThreadIds = continuity.candidateThreadIds;
        }
      }
    }

    // Deterministic lifecycle reduction over the Threads bound BEFORE this CU;
    // a Thread bound at this CU is visible as a binding, never as a state.
    const focusThreadBindings = new Map<string, string>();
    for (const [boundFocusId, binding] of this.bindings) focusThreadBindings.set(boundFocusId, binding.threadId);
    if (newBindingKind !== null && focusId !== null && threadId !== null) focusThreadBindings.set(focusId, threadId);
    const transitions = reduceThreadLifecycle({
      currentFocusSemantics: bundle,
      previousFocusSemantics: this.previousBundle,
      focusThreadBindings,
      threadStates: new Map(this.states),
      semanticsByCuId: this.semanticsByCuId,
    });

    const decision: PreparedThreadLayerDecision = {
      cuId: cu.cuId,
      outcome,
      emergingFocusId: focusId,
      threadId,
      identityEvidence,
      priorIdentityEvidence,
      candidateThreadIds,
      transitions,
    };

    // Only AFTER this CU's own decision does its truth join the visible prefix.
    this.advance(cu, bundle, focusId, threadId, newBindingKind, transitions.map((t) => [t.threadId, t.toState] as const));
    return { threadResult, decision, origin };
  }

  /** The frozen T-03B2a evaluator, with prior context only (deterministic NO for no focus / ESTABLISHMENT-bound focus). */
  private async establishment(cu: CurrentCuInput, bundle: CanonicalCuFocusSemanticPayload): Promise<PreparedThreadEstablishmentResult> {
    const evaluator = new ThreadEstablishmentEvaluatorService(this.thread.provider, this.thread.providerName, this.thread.providerModel);
    const priorContext: ThreadEstablishmentPriorContext = {
      priorCus: this.priorCus,
      focusAttentionHistory: this.focusAttentionHistory,
      // Only the grounding focuses of this Session's OWN establishments: 0068
      // ties ALREADY_ESTABLISHED strictly to the immutable grounding lineage.
      establishedFocusIds: [...this.bindings.entries()].filter(([, binding]) => binding.bindingKind === 'ESTABLISHMENT').map(([boundFocusId]) => boundFocusId),
    };
    return evaluator.evaluateOne({ sessionId: this.sessionId, currentCu: cu, currentFocusSemantics: bundle, priorContext });
  }

  /**
   * ED-B3-04: a focus that resolves to an existing Thread (by Session
   * continuity or by identity ambiguity) is never a NEW promotion, and the
   * frozen 0068 vocabulary can only record that as NO_PROMOTION_PATH_PROVEN
   * (its ALREADY_ESTABLISHED is reserved for the grounding lineage). The FINAL
   * Thread-layer truth of the CU is the 0070 unit result. Zero providers.
   */
  private noEstablishment(cu: CurrentCuInput, focusId: string): PreparedThreadEstablishmentResult {
    return {
      sessionId: this.sessionId,
      cuId: cu.cuId,
      sourceTurnId: cu.sourceTurnId,
      sourceRole: cu.sourceRole,
      emergingFocusId: focusId,
      decision: 'NO_ESTABLISHMENT',
      path: null,
      noEstablishmentReason: 'NO_PROMOTION_PATH_PROVEN',
      evidenceCuIds: [],
      explicitSelectionGrounding: null,
      provenance: {
        evaluatorVersion: THREAD_ESTABLISHMENT_EVALUATOR_VERSION,
        policyVersion: THREAD_ESTABLISHMENT_POLICY_VERSION,
        provider: this.thread.providerName,
        model: this.thread.providerModel,
        promptVersion: THREAD_ESTABLISHMENT_PROMPT_VERSION,
        schemaVersion: THREAD_ESTABLISHMENT_SCHEMA_VERSION,
      },
    };
  }

  /** Exhaustive deterministic screening over every dossier not already bound in this Session, then ONE resolution. */
  private async resolveContinuity(cu: CurrentCuInput, bundle: CanonicalCuFocusSemanticPayload, focusId: string): Promise<PreparedThreadContinuityResult> {
    const groundingHandleIds = this.focusGroundingHandleIds.get(focusId);
    if (groundingHandleIds === undefined || groundingHandleIds.length === 0) throw new ConversationThreadLifecycleIntegrityError('LIFECYCLE_CONTEXT_NOT_CLOSED');
    const boundThreadIds = new Set([...this.bindings.values()].map((binding) => binding.threadId));
    // B1 already decided that a new focus of THIS Session is a different locus
    // than every focus of this Session: a Thread bound here is never a candidate.
    const dossiers = (await this.loadDossiers()).filter((dossier) => !boundThreadIds.has(dossier.threadId));
    const evaluator = new ThreadContinuityEvaluatorService(this.continuity.provider, this.continuity.providerName, this.continuity.providerModel);
    const groundingSurfaces: CurrentFocusGroundingSurface[] = [];
    for (const handleId of groundingHandleIds) for (const surface of this.handleGrounding.get(handleId) ?? []) groundingSurfaces.push(surface);
    return evaluator.resolveOne(
      { sessionId: this.sessionId, currentCu: cu, currentFocusSemantics: bundle, currentFocusGrounding: { emergingFocusId: focusId, groundingSurfaces }, dossiers },
      { groundingHandleIds },
    );
  }

  /** Every dossier page of the user, in deterministic order, against the exact version the context carried. Read once per evaluation. */
  private async loadDossiers(): Promise<readonly ThreadIdentityDossier[]> {
    if (this.dossiers !== undefined) return this.dossiers;
    const all: ThreadIdentityDossier[] = [];
    let afterThreadId: string | null = null;
    for (;;) {
      const page = await this.repository.readIdentityDossierPage({
        userId: this.userId,
        expectedWorldThreadIdentityVersion: this.context.worldThreadIdentityVersion,
        afterThreadId,
        limit: THREAD_CONTINUITY_SCREEN_CHUNK_SIZE,
      });
      for (const dossier of page) {
        if (afterThreadId !== null && compareThreadIdText(dossier.threadId, afterThreadId) <= 0) throw new ConversationThreadLifecycleIntegrityError('INVALID_THREAD_IDENTITY_DOSSIER');
        afterThreadId = dossier.threadId;
        all.push(dossier);
      }
      if (page.length < THREAD_CONTINUITY_SCREEN_CHUNK_SIZE) break;
    }
    this.dossiers = all;
    return all;
  }

  /**
   * The identity evidence of a NEW Thread, exactly as migration 0070 derives
   * it: every canonical RESOLVED reference to the promoted focus's grounding
   * handle inside the focus's starting CU and the B2 evidence CUs, in visible
   * order then reference order.
   */
  private establishmentIdentityEvidence(cu: CurrentCuInput, focusId: string, evidenceCuIds: readonly string[]): readonly PreparedIdentityEvidenceRef[] {
    const grounding = new Set(this.focusGroundingHandleIds.get(focusId) ?? []);
    const startedCu = this.startedCuByFocusId.get(focusId);
    if (startedCu === undefined) throw new ConversationThreadLifecycleIntegrityError('LIFECYCLE_CONTEXT_NOT_CLOSED');
    const episode = [...new Set([startedCu, ...evidenceCuIds, cu.cuId])]
      .filter((cuId) => this.positionByCuId.has(cuId))
      .sort((a, b) => (this.positionByCuId.get(a) as number) - (this.positionByCuId.get(b) as number));
    const refs: PreparedIdentityEvidenceRef[] = [];
    for (const cuId of episode) {
      const bundle = this.semanticsByCuId.get(cuId);
      if (bundle === undefined) throw new ConversationThreadLifecycleIntegrityError('LIFECYCLE_CONTEXT_NOT_CLOSED');
      for (const reference of bundle.references) {
        if (reference.state === 'RESOLVED' && reference.resolved_handle_id !== null && grounding.has(reference.resolved_handle_id)) {
          refs.push({ cuId, referenceIndex: reference.reference_index });
        }
      }
    }
    return refs;
  }

  /** The CU's own canonical material joins the visible prefix BEFORE its decision: wording, RESOLVED grounding surfaces, and the focus it starts. */
  private see(cu: CurrentCuInput, bundle: CanonicalCuFocusSemanticPayload): void {
    this.semanticsByCuId.set(bundle.unit_id, bundle);
    this.positionByCuId.set(cu.cuId, this.position);
    this.committedTextByCuId.set(cu.cuId, cu.committedText);
    this.position += 1;
    // Every RESOLVED reference extends its handle's exact committed grounding
    // surfaces, exactly as migration 0066 records them.
    for (const reference of bundle.references) {
      if (reference.state === 'RESOLVED' && reference.resolved_handle_id !== null) {
        const surfaces = this.handleGrounding.get(reference.resolved_handle_id) ?? [];
        this.handleGrounding.set(reference.resolved_handle_id, [...surfaces, { cuId: cu.cuId, exactSurface: reference.anchor_text, committedCuText: cu.committedText }]);
      }
    }
    // The canonical grounding a START_NEW_FOCUS CU creates is the focus's
    // grounding handle (0066's grounding_handle_id).
    const attention = bundle.attention;
    if (attention.creates_focus && attention.emerging_focus_id !== null && attention.grounding_reference_index !== null) {
      const grounding = bundle.references[attention.grounding_reference_index];
      if (grounding !== undefined && grounding.state === 'RESOLVED' && grounding.resolved_handle_id !== null) {
        this.focusGroundingHandleIds.set(attention.emerging_focus_id, [grounding.resolved_handle_id]);
        this.startedCuByFocusId.set(attention.emerging_focus_id, cu.cuId);
      }
    }
  }

  private advance(
    cu: CurrentCuInput,
    bundle: CanonicalCuFocusSemanticPayload,
    focusId: string | null,
    threadId: string | null,
    newBindingKind: ThreadFocusBindingKind | null,
    transitions: readonly (readonly [string, ThreadLifecycleState])[],
  ): void {
    // The T-03B2a prior context grows exactly as its sequential helper grows it.
    this.priorCus = [...this.priorCus, {
      cuId: cu.cuId, sourceTurnId: cu.sourceTurnId, sourceRole: cu.sourceRole, committedText: cu.committedText,
      ordinalWithinTurn: cu.ordinalWithinTurn, functions: bundle.functions, sequencePosition: bundle.sequence_position, targetCuId: bundle.target_cu_id,
    }];
    this.focusAttentionHistory = [...this.focusAttentionHistory, {
      cuId: cu.cuId, attentionKind: bundle.attention.kind, attentionReason: bundle.attention.reason, emergingFocusId: bundle.attention.emerging_focus_id,
    }];
    // Only AFTER this CU's own decision does its binding become canonical for later CUs.
    if (newBindingKind !== null && focusId !== null && threadId !== null) {
      this.bindings.set(focusId, { threadId, bindingKind: newBindingKind });
      this.states.set(threadId, 'ACTIVE');
      this.establishedThreads.push({ threadId, emergingFocusId: focusId });
    }
    for (const [transitionThreadId, toState] of transitions) this.states.set(transitionThreadId, toState);
    this.previousBundle = bundle;
  }
}

/**
 * FIX-T03A2-01 / FIX-T03B2B3-01, applied to this boundary: the ONE gate proves
 * the WHOLE finalized-exchange relation, including that BOTH turns are already
 * COMPLETED, before any read, any binding construction and any mutation. It
 * mutates no turn state, never calls `failTurn`, regenerates nothing, and
 * stays an integrity failure: never provider or transport unavailability.
 */
function assertFinalizedExchangeRelation(userTurn: ConversationTurn, assistantTurn: ConversationTurn): void {
  if (
    userTurn.role !== 'USER'
    || assistantTurn.role !== 'ASSISTANT'
    || userTurn.status !== 'COMPLETED'
    || assistantTurn.status !== 'COMPLETED'
    || userTurn.session_id !== assistantTurn.session_id
    || assistantTurn.source_turn_id !== userTurn.id
  ) {
    throw new ConversationThreadLifecycleIntegrityError('INVALID_FINALIZED_EXCHANGE_RELATION');
  }
}

/**
 * Every continuity decision of ONE finalized exchange is produced by ONE
 * binding and ONE evaluator, so its provenance is identical by construction.
 */
export function assertContinuityProvenanceAgreement(
  results: readonly PreparedThreadContinuityResult[],
  provenance: CanonicalThreadLifecycleBatchProvenance,
): void {
  for (const result of results) {
    if (
      result.provenance.evaluatorVersion !== provenance.continuityEvaluatorVersion
      || result.provenance.policyVersion !== provenance.continuityPolicyVersion
      || result.provenance.provider !== provenance.continuityProvider
      || result.provenance.model !== provenance.continuityModel
      || result.provenance.promptVersion !== provenance.continuityPromptVersion
      || result.provenance.schemaVersion !== provenance.continuitySchemaVersion
    ) {
      throw new ConversationThreadLifecycleIntegrityError('CONTINUITY_PROVENANCE_DISAGREEMENT');
    }
  }
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function maxLiveHead(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.max(left, right);
}

function verifiedEvent(snapshot: IntegratedThreadLifecycleBatchSnapshot): ConversationalUnitsCommittedWireEvent | undefined {
  const event: CommittedConversationUnitEventRow | null = snapshot.commit_event;
  if (snapshot.committed_unit_count === 0) {
    if (event) throw new ConversationThreadLifecycleIntegrityError('DELIVERY_RANGE_MISMATCH');
    return undefined;
  }
  if (!event) throw new ConversationThreadLifecycleIntegrityError('COMMITTED_WITHOUT_DELIVERY_EVENT');
  const positions = snapshot.units.map((unit) => unit.session_position);
  if (
    positions.length !== snapshot.committed_unit_count
    || event.unit_count !== snapshot.committed_unit_count
    || event.last_sp - event.first_sp + 1 !== snapshot.committed_unit_count
    || event.first_sp !== Math.min(...positions)
    || event.last_sp !== Math.max(...positions)
  ) {
    throw new ConversationThreadLifecycleIntegrityError('DELIVERY_RANGE_MISMATCH');
  }
  return toCommittedWireEvent(event);
}

/** Both halves segment through ONE binding, so their provenance is identical by construction. */
function segmentationProvenanceOf(user: CommitConversationUnitsRequest, assistant: CommitConversationUnitsRequest) {
  const fields = ['evaluatorVersion', 'policyVersion', 'segmentationProvider', 'segmentationModel', 'segmentationPromptVersion'] as const;
  if (fields.some((field) => user[field] !== assistant[field])) throw new ConversationThreadLifecycleIntegrityError('PROVENANCE_DISAGREEMENT');
  return {
    evaluatorVersion: user.evaluatorVersion,
    policyVersion: user.policyVersion,
    segmentationProvider: user.segmentationProvider,
    segmentationModel: user.segmentationModel,
    segmentationPromptVersion: user.segmentationPromptVersion,
  };
}
