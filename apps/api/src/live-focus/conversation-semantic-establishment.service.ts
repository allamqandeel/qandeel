// T-03D - the FINAL post-finalization semantic establishment: B1 + B2 + B3 +
// effective Live Focus, the ONE production authority after the cutover.
//
// Turns ONE durable COMPLETED USER -> ASSISTANT finalized exchange into
// canonical Session time PLUS its reference / focus semantics PLUS the FINAL
// Thread layer PLUS the effective Live Focus, per Moment, through the
// integrated coordinator of migration 0071:
//
//   A  relation gate (zero providers, zero mutation on an invalid pair)
//   B  stable automatic batch identities (exactly T-03A2's derivation)
//   C  FINAL-chain snapshots BEFORE any provider: COMPLETE + COMPLETE is
//      canonical replay with zero calls; ABSENT + ABSENT is a new exchange;
//      every other combination fails closed with no repair and no backfill
//   D  ONE authoritative FINAL context + Session-clock token + user/world
//      Thread identity version + current effective LF, read outside any lock
//   E  USER and ASSISTANT segmentation, separately (T-03A2 semantics kept)
//   F  exact prepared CurrentCu inputs from the proposed spans (code points)
//   G  sequential whole-exchange B1 focus evaluation, no hindsight
//   H  ONE whole-exchange B1 canonicalization, then an exact split
//   I  for each CU in sequence, strictly sequential, the frozen T-03B3
//      Thread-layer walk (same-Session binding, exhaustive cross-Session
//      continuity, B2 establishment if DISTINCT_NEW, lifecycle), THEN the
//      deterministic LF reduction AFTER that CU's FINAL Thread-layer result:
//      no later CU may alter an earlier LF, and an earlier same-exchange LF
//      is the prior LF of every later CU
//   J  ONE whole-exchange Thread (B2), ONE final Thread-layer (B3) and ONE
//      LF canonicalization, then exact splits
//   K  one 0071 coordinator commit against BOTH exact tokens
//   L  the additive live delivery: LH, current LF, committed events and the
//      LF transitions of this exchange, in SP order
//
// Bounded recovery: on any evaluation / commit failure, re-read the FINAL
// snapshots first (a canonical winner is returned, partial history fails
// closed); only the two exact typed stale conditions - the Session Semantic
// Clock token and the user/world Thread identity version - earn ONE shared
// semantic re-evaluation against a re-read context and re-read dossiers. LF
// introduces no third stale authority. Segmentation is never repeated. A
// second stale failure is retryable unavailability. A generic 40001 never
// qualifies.
//
// It is a POST-FINALIZATION phase: it never marks a completed turn FAILED,
// never calls failTurn, regenerates nothing, and a technical failure is
// never reinterpreted as NONE / NO_THREAD_ACTION / DISTINCT_NEW. It surfaces
// as a retryable service-unavailable response while the durable completed
// turns stay completed; an idempotent replay re-enters establishment.
//
// LF has NO provider: the reducer is pure (D-01). The four existing lazy
// bindings (segmentation, focus, Thread, continuity) are reused exactly; no
// credential is read at construction.

import { ServiceUnavailableException } from '@nestjs/common';
import type { ConversationLiveDelivery, ConversationalUnitsCommittedWireEvent, LiveFocusTransitionWireEvent } from '@qandeel/runtime';
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
  type PreparedConversationalFocusResult,
} from '../conversational-focus/conversational-focus.types';
import { canonicalizePreparedFocusSequence } from '../conversational-focus/durable-focus-canonicalizer';
import type { CanonicalCuFocusSemanticPayload, CanonicalFocusBatchProvenance } from '../conversational-focus/durable-focus-payload.types';
import { FOCUS_RESOLUTION_PROMPT_VERSION } from '../conversational-focus/focus-resolution-provider.config';
import { FOCUS_RESOLUTION_SCHEMA_VERSION, FocusResolutionProviderError } from '../conversational-focus/focus-resolution-provider.types';
import type { FocusResolutionBinding, FocusResolutionBindingFactory } from '../conversational-focus/focus-resolution-binding';
import { StaleConversationalFocusContextError } from '../conversational-focus/conversation-focus-runtime.types';
import { assertThreadProvenanceAgreement, buildPreparedThreadCuInputs } from '../thread-establishment/conversation-thread-establishment.service';
import { ConversationThreadIntegrityError } from '../thread-establishment/conversation-thread-runtime.types';
import type { PreparedConversationalOrigin } from '../thread-establishment/durable-thread-payload.types';
import { canonicalizePreparedThreadSequence } from '../thread-establishment/durable-thread-canonicalizer';
import type { CanonicalThreadBatchProvenance } from '../thread-establishment/durable-thread-payload.types';
import { THREAD_ESTABLISHMENT_PROMPT_VERSION } from '../thread-establishment/thread-establishment-provider.config';
import { THREAD_ESTABLISHMENT_SCHEMA_VERSION, ThreadEstablishmentProviderError } from '../thread-establishment/thread-establishment-provider.types';
import type { ThreadEstablishmentBinding, ThreadEstablishmentBindingFactory } from '../thread-establishment/thread-establishment-binding';
import {
  THREAD_ESTABLISHMENT_EVALUATOR_VERSION,
  THREAD_ESTABLISHMENT_POLICY_VERSION,
  ThreadEstablishmentRejectedError,
  type PreparedThreadEstablishmentResult,
} from '../thread-establishment/thread-establishment.types';
import { assertContinuityProvenanceAgreement, ThreadLayerWalk } from '../thread-lifecycle/conversation-thread-lifecycle-establishment.service';
import {
  ConversationThreadLifecycleIntegrityError,
  StaleThreadIdentityContextError,
} from '../thread-lifecycle/conversation-thread-lifecycle-runtime.types';
import { canonicalizePreparedThreadLayerSequence, type PreparedThreadLayerDecision } from '../thread-lifecycle/durable-thread-lifecycle-canonicalizer';
import type { CanonicalThreadLifecycleBatchProvenance } from '../thread-lifecycle/durable-thread-lifecycle-payload.types';
import type { ThreadContinuityBinding, ThreadContinuityBindingFactory } from '../thread-lifecycle/thread-continuity-binding';
import { THREAD_CONTINUITY_PROMPT_VERSION } from '../thread-lifecycle/thread-continuity-provider.config';
import { THREAD_CONTINUITY_SCHEMA_VERSION, ThreadContinuityProviderError } from '../thread-lifecycle/thread-continuity-provider.types';
import { THREAD_CONTINUITY_EVALUATOR_VERSION, ThreadContinuityRejectedError } from '../thread-lifecycle/thread-continuity.types';
import { THREAD_LIFECYCLE_POLICY_VERSION, THREAD_LIFECYCLE_REDUCER_VERSION, ThreadLifecycleRejectedError } from '../thread-lifecycle/thread-lifecycle.types';
import type { ConversationSemanticRuntimeBoundary } from './conversation-semantic-runtime.repository';
import {
  ConversationSemanticIntegrityError,
  ConversationSemanticUnavailableError,
  MAX_SEMANTIC_STALE_CONTEXT_RETRIES,
  type ConversationSemanticRuntimeContext,
  type FinalizedExchangeWithFullSemanticChainResult,
  type IntegratedFullSemanticBatchSnapshot,
  type StoredLiveFocusTransition,
} from './conversation-semantic-runtime.types';
import { canonicalizePreparedLiveFocusSequence, type PreparedLiveFocusDecision } from './durable-live-focus-canonicalizer';
import { LiveFocusCanonicalizationError, type CanonicalLiveFocusBatchProvenance, type CanonicalLiveFocusPayload } from './durable-live-focus-payload.types';
import { reduceLiveFocus } from './live-focus-reducer';
import { LIVE_FOCUS_REDUCER_VERSION, LiveFocusRejectedError, type EffectiveLiveFocus } from './live-focus.types';
import { toLiveFocusTransitionWireEvent, toLiveFocusWireValue } from './live-focus-wire';

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
  readonly userThreadUnits: ReturnType<typeof canonicalizePreparedThreadSequence>['units'];
  readonly assistantThreadUnits: ReturnType<typeof canonicalizePreparedThreadSequence>['units'];
  readonly userLifecycleUnits: ReturnType<typeof canonicalizePreparedThreadLayerSequence>['units'];
  readonly assistantLifecycleUnits: ReturnType<typeof canonicalizePreparedThreadLayerSequence>['units'];
  readonly userLiveFocusUnits: readonly CanonicalLiveFocusPayload[];
  readonly assistantLiveFocusUnits: readonly CanonicalLiveFocusPayload[];
  readonly focusProvenance: CanonicalFocusBatchProvenance;
  readonly threadProvenance: CanonicalThreadBatchProvenance;
  readonly lifecycleProvenance: CanonicalThreadLifecycleBatchProvenance;
  readonly liveFocusProvenance: CanonicalLiveFocusBatchProvenance;
}

export class ConversationSemanticEstablishmentService {
  private segmentation: CuSegmentationBinding | undefined;
  private focus: FocusResolutionBinding | undefined;
  private thread: ThreadEstablishmentBinding | undefined;
  private continuity: ThreadContinuityBinding | undefined;

  constructor(
    private readonly repository: ConversationSemanticRuntimeBoundary,
    private readonly createSegmentationBinding: CuSegmentationBindingFactory,
    private readonly createFocusBinding: FocusResolutionBindingFactory,
    private readonly createThreadBinding: ThreadEstablishmentBindingFactory,
    private readonly createContinuityBinding: ThreadContinuityBindingFactory,
  ) {}

  /**
   * The same entry shape as T-03A2: a result that is not yet a completed pair
   * is returned untouched; a completed pair gains the additive `temporal`
   * delivery. A failure surfaces as a retryable service-unavailable response;
   * it never touches the conversation lifecycle.
   */
  async establish(userId: string, result: OrchestratedTurnResult): Promise<OrchestratedTurnResult> {
    const { userTurn, assistantTurn } = result;
    if (!assistantTurn) return result;
    if (userTurn.status !== 'COMPLETED' || assistantTurn.status !== 'COMPLETED') return result;
    try {
      return { ...result, temporal: await this.establishExchange(userId, userTurn, assistantTurn) };
    } catch (error) {
      if (error instanceof ConversationSemanticIntegrityError || error instanceof ConversationThreadLifecycleIntegrityError || error instanceof ConversationThreadIntegrityError) {
        throw new ServiceUnavailableException('Conversation semantic establishment failed an integrity check.', { cause: error });
      }
      throw new ServiceUnavailableException('Conversation semantic establishment is unavailable.', { cause: error });
    }
  }

  async establishExchange(userId: string, userTurn: ConversationTurn, assistantTurn: ConversationTurn): Promise<ConversationLiveDelivery> {
    // A. The ONE relation gate, including both COMPLETED statuses: before any
    // read, any binding construction, any provider call and any write. It
    // throws outside the try, so an invalid pair is never unavailability.
    assertFinalizedExchangeRelation(userTurn, assistantTurn);
    try {
      return await this.run(userId, userTurn, assistantTurn);
    } catch (error) {
      if (error instanceof ConversationSemanticIntegrityError || error instanceof ConversationSemanticUnavailableError) throw error;
      // The reused T-03B2b3 / T-03B3 mappers report their integrity failures in their own classes; they stay integrity.
      if (error instanceof ConversationThreadIntegrityError || error instanceof ConversationThreadLifecycleIntegrityError) throw error;
      // A segmentation outage or rejection (T-03A1), a focus provider outage
      // or rejected focus proposal (T-03B1a), a Thread provider outage or
      // rejected promotion (T-03B2a), or a continuity provider outage or
      // rejected proposal (T-03B3): retryable, never a lifecycle failure of
      // the completed turns, and never reinterpreted as NONE, DISTINCT_NEW,
      // NO_THREAD_ACTION or NO_ESTABLISHMENT.
      if (error instanceof CommitmentRejectedError || error instanceof FocusResolutionProviderError
        || error instanceof FocusEvaluationRejectedError || error instanceof ThreadEstablishmentProviderError
        || error instanceof ThreadEstablishmentRejectedError || error instanceof ThreadContinuityProviderError
        || error instanceof ThreadContinuityRejectedError) {
        throw new ConversationSemanticUnavailableError('PROVIDER_UNAVAILABLE', { cause: error });
      }
      // A malformed lifecycle or LF context is a runtime integrity failure, never "no transition" and never NONE.
      if (error instanceof ThreadLifecycleRejectedError) throw new ConversationThreadLifecycleIntegrityError('LIFECYCLE_CONTEXT_NOT_CLOSED');
      if (error instanceof LiveFocusRejectedError) throw new ConversationSemanticIntegrityError('LIVE_FOCUS_CONTEXT_NOT_CLOSED');
      if (error instanceof LiveFocusCanonicalizationError) throw new ConversationSemanticIntegrityError('LIVE_FOCUS_NOT_CANONICAL');
      throw new ConversationSemanticUnavailableError('TRANSPORT_UNAVAILABLE', { cause: error });
    }
  }

  private async run(userId: string, userTurn: ConversationTurn, assistantTurn: ConversationTurn): Promise<ConversationLiveDelivery> {
    // B. Stable automatic identities: technical idempotency, exactly T-03A2's.
    const userBatchId = automaticCommitBatchId(userTurn.id);
    const assistantBatchId = automaticCommitBatchId(assistantTurn.id);

    // C. FINAL-chain snapshots before any provider.
    const snapshots = await this.readSnapshots(userId, userTurn, assistantTurn, userBatchId, assistantBatchId);
    const replayed = this.canonicalDelivery(userTurn.session_id, snapshots);
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

    let retriesLeft = MAX_SEMANTIC_STALE_CONTEXT_RETRIES;
    for (;;) {
      try {
        // F -> J: prepared inputs, sequential B1, one B1 canonicalization,
        // sequential Thread layer + LF, one Thread, one final Thread-layer and
        // one LF canonicalization.
        const evaluated = await this.evaluateExchange(userTurn.session_id, userId, halves, context);
        // K. One integrated commit against BOTH exact tokens the context carried.
        const committed = await this.repository.commitFinalizedExchangeWithFullSemanticChain({
          sessionId: userTurn.session_id,
          userId,
          userSourceTurnId: userTurn.id,
          userBatchId,
          userUnits: halves[0].batch.units,
          userFocusUnits: evaluated.userFocusUnits,
          userThreadUnits: evaluated.userThreadUnits,
          userLifecycleUnits: evaluated.userLifecycleUnits,
          userLiveFocusUnits: evaluated.userLiveFocusUnits,
          assistantSourceTurnId: assistantTurn.id,
          assistantBatchId,
          assistantUnits: halves[1].batch.units,
          assistantFocusUnits: evaluated.assistantFocusUnits,
          assistantThreadUnits: evaluated.assistantThreadUnits,
          assistantLifecycleUnits: evaluated.assistantLifecycleUnits,
          assistantLiveFocusUnits: evaluated.assistantLiveFocusUnits,
          ...segmentationProvenance,
          ...evaluated.focusProvenance,
          ...evaluated.threadProvenance,
          ...evaluated.lifecycleProvenance,
          ...evaluated.liveFocusProvenance,
          expectedCurrentSp: context.token.currentSp,
          expectedSameSpEventSequence: context.token.sameSpEventSequence,
          expectedWorldThreadIdentityVersion: context.worldThreadIdentityVersion,
        });
        // L. The additive live delivery.
        return this.deliveryFromCommit(userTurn.session_id, committed);
      } catch (error) {
        // Recovery step 1: the database is authoritative. A canonical winner is
        // returned as is; partial or legacy history fails closed.
        const fresh = await this.readSnapshots(userId, userTurn, assistantTurn, userBatchId, assistantBatchId);
        const winner = this.canonicalDelivery(userTurn.session_id, fresh);
        if (winner) return winner;
        // Recovery step 2: only the two exact typed stale conditions, with
        // neither batch present, earn ONE shared semantic re-evaluation.
        // Segmentation is reused; the source frontiers must not have moved.
        const stale = error instanceof StaleConversationalFocusContextError || error instanceof StaleThreadIdentityContextError;
        if (!stale) throw error;
        if (retriesLeft === 0) throw new ConversationSemanticUnavailableError('STALE_CONTEXT_RETRY_EXHAUSTED', { cause: error });
        retriesLeft -= 1;
        if (fresh[0].source_frontier !== halves[0].sourceFrontier || fresh[1].source_frontier !== halves[1].sourceFrontier) {
          throw new ConversationSemanticIntegrityError('SEGMENTATION_FRONTIER_MOVED');
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
  ): Promise<[IntegratedFullSemanticBatchSnapshot, IntegratedFullSemanticBatchSnapshot]> {
    const user = this.repository.readIntegratedBatchSnapshot({ sessionId: userTurn.session_id, userId, sourceTurnId: userTurn.id, batchId: userBatchId });
    const assistant = this.repository.readIntegratedBatchSnapshot({ sessionId: assistantTurn.session_id, userId, sourceTurnId: assistantTurn.id, batchId: assistantBatchId });
    user.catch(() => undefined);
    assistant.catch(() => undefined);
    return Promise.all([user, assistant]);
  }

  /**
   * Resolves an ALREADY canonical, full-chain-complete exchange, or
   * `undefined` when the exchange is absent at all five capture layers. Every
   * other combination fails closed BEFORE any provider is called:
   *
   *   COMPLETE + COMPLETE  canonical replay, stored delivery, zero providers
   *   ABSENT   + ABSENT    a new exchange
   *   PARTIAL involved     INCOMPLETE_FULL_SEMANTIC_CAPTURE (legacy
   *                        T-03A2-only, B1-only, B2-only and B3-only history
   *                        land here; never upgraded)
   *   ABSENT / COMPLETE    PARTIAL_INTEGRATED_EXCHANGE (never "finished")
   */
  private canonicalDelivery(sessionId: string, [user, assistant]: readonly [IntegratedFullSemanticBatchSnapshot, IntegratedFullSemanticBatchSnapshot]): ConversationLiveDelivery | undefined {
    if (user.full_semantic_capture_state === 'PARTIAL' || assistant.full_semantic_capture_state === 'PARTIAL') {
      throw new ConversationSemanticIntegrityError('INCOMPLETE_FULL_SEMANTIC_CAPTURE');
    }
    if (user.full_semantic_capture_state === 'ABSENT' && assistant.full_semantic_capture_state === 'ABSENT') return undefined;
    if (user.full_semantic_capture_state !== 'COMPLETE' || assistant.full_semantic_capture_state !== 'COMPLETE') {
      throw new ConversationSemanticIntegrityError('PARTIAL_INTEGRATED_EXCHANGE');
    }
    const events = [verifiedEvent(user), verifiedEvent(assistant)].filter(isPresent);
    // LH and LF never retract, so the later of two concurrent authoritative
    // reads is the safe answer for both.
    const later = (assistant.session_live_focus_sp ?? 0) > (user.session_live_focus_sp ?? 0) ? assistant : user;
    return this.delivery(sessionId, maxLiveHead(user.live_head, assistant.live_head), later.session_live_focus, later.session_live_focus_sp, events,
      [...user.live_focus_transitions, ...assistant.live_focus_transitions]);
  }

  private deliveryFromCommit(sessionId: string, committed: FinalizedExchangeWithFullSemanticChainResult): ConversationLiveDelivery {
    const events = [committed.user_event, committed.assistant_event].filter(isPresent).map(toCommittedWireEvent);
    return this.delivery(sessionId, committed.live_head, committed.live_focus, committed.live_focus_sp, events, committed.live_focus_transitions);
  }

  /**
   * The additive live delivery, proven coherent before it leaves: LH covers
   * every committed event, every LF transition lies inside this exchange's
   * committed range and at most one per SP, LF is NONE before the first SP,
   * and the current LF is never older than the last transition delivered.
   */
  private delivery(
    sessionId: string,
    liveHead: number | null,
    liveFocus: EffectiveLiveFocus,
    liveFocusSp: number | null,
    events: readonly ConversationalUnitsCommittedWireEvent[],
    transitions: readonly StoredLiveFocusTransition[],
  ): ConversationLiveDelivery {
    const ordered = [...events].sort((a, b) => a.firstSp - b.firstSp);
    const highest = ordered.reduce((max, event) => Math.max(max, event.lastSp), 0);
    if (ordered.length > 0 && (liveHead === null || liveHead < highest)) {
      throw new ConversationSemanticIntegrityError('LIVE_HEAD_NOT_ESTABLISHED');
    }
    const liveFocusTransitions: LiveFocusTransitionWireEvent[] = [...transitions]
      .sort((a, b) => a.sessionPosition - b.sessionPosition)
      .map((transition) => toLiveFocusTransitionWireEvent(sessionId, transition));
    if (liveHead === null && (liveFocus.kind !== 'NONE' || liveFocusSp !== null || liveFocusTransitions.length > 0)) {
      throw new ConversationSemanticIntegrityError('LIVE_FOCUS_DELIVERY_MISMATCH');
    }
    let lastSp = 0;
    for (const transition of liveFocusTransitions) {
      if (transition.atSp <= lastSp || !ordered.some((event) => event.firstSp <= transition.atSp && transition.atSp <= event.lastSp)) {
        throw new ConversationSemanticIntegrityError('LIVE_FOCUS_DELIVERY_MISMATCH');
      }
      lastSp = transition.atSp;
    }
    if (liveFocusSp !== null && ((liveHead !== null && liveFocusSp > liveHead) || liveFocusSp < lastSp)) {
      throw new ConversationSemanticIntegrityError('LIVE_FOCUS_DELIVERY_MISMATCH');
    }
    return { liveHead, liveFocus: toLiveFocusWireValue(liveFocus), committedEvents: ordered, liveFocusTransitions };
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
   * provenance); the continuity binding reads its identity only. LF has no
   * binding to create.
   */
  private async evaluateExchange(
    sessionId: string,
    userId: string,
    [user, assistant]: readonly [SegmentedHalf, SegmentedHalf],
    context: ConversationSemanticRuntimeContext,
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
    const liveFocusProvenance: CanonicalLiveFocusBatchProvenance = { lfReducerVersion: LIVE_FOCUS_REDUCER_VERSION };

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

    // H. ONE B1 canonicalization across the whole exchange, before any Thread-layer or LF work.
    const canonicalFocus = canonicalizePreparedFocusSequence(focusResults, { sessionId, priorFocusCandidates: context.priorContext.focusCandidates });
    if (canonicalFocus.units.length !== sequence.length) throw new ConversationSemanticIntegrityError('INVALID_SEMANTIC_RUNTIME_CONTEXT');

    // I. Sequential whole-exchange FINAL Thread-layer evaluation (the frozen
    // T-03B3 walk), then the LF reduction AFTER each CU's final Thread-layer
    // result. The LF of CU i is the prior LF of CU i+1; no later CU can alter
    // an earlier LF.
    const walk = new ThreadLayerWalk(sessionId, userId, context, this.thread, this.continuity, this.repository);
    const threadResults: PreparedThreadEstablishmentResult[] = [];
    const decisions: PreparedThreadLayerDecision[] = [];
    const liveFocusDecisions: PreparedLiveFocusDecision[] = [];
    const originsByCuId = new Map<string, PreparedConversationalOrigin>();
    const semanticsByCuId = new Map<string, CanonicalCuFocusSemanticPayload>(context.priorFocusSemantics.map((bundle) => [bundle.unit_id, bundle]));
    const focusThreadBindings = new Map<string, string>(context.sessionFocusThreadBindings.map((binding) => [binding.emergingFocusId, binding.threadId]));
    let liveFocus: EffectiveLiveFocus = context.currentLiveFocus;
    for (const [index, cu] of sequence.entries()) {
      const bundle = canonicalFocus.units[index];
      if (bundle.unit_id !== cu.cuId) throw new ConversationSemanticIntegrityError('FOCUS_SEMANTICS_MISMATCH');
      const step = await walk.evaluate(cu, bundle);
      threadResults.push(step.threadResult);
      decisions.push(step.decision);
      if (step.origin !== null) originsByCuId.set(cu.cuId, step.origin);
      // A binding created at this CU is visible to this CU's own LF (the same-Moment promotion rule) and to every later CU.
      if ((step.decision.outcome === 'ESTABLISH_NEW' || step.decision.outcome === 'ACTIVATE_EXISTING_IN_SESSION')
        && step.decision.emergingFocusId !== null && step.decision.threadId !== null) {
        focusThreadBindings.set(step.decision.emergingFocusId, step.decision.threadId);
      }
      const reduction = reduceLiveFocus({
        currentFocusSemantics: bundle,
        currentThreadLayer: { outcome: step.decision.outcome, emergingFocusId: step.decision.emergingFocusId, threadId: step.decision.threadId },
        priorLiveFocus: liveFocus,
        semanticsByCuId,
        focusThreadBindings,
      });
      liveFocusDecisions.push({ cuId: cu.cuId, reduction });
      liveFocus = reduction.effective;
      semanticsByCuId.set(cu.cuId, bundle);
    }
    assertThreadProvenanceAgreement(threadResults, threadProvenance);
    assertContinuityProvenanceAgreement(walk.continuityResults, lifecycleProvenance);

    // J. ONE Thread, ONE final Thread-layer and ONE LF canonicalization, then the splits.
    const canonicalThread = canonicalizePreparedThreadSequence(threadResults, { userId, originsByCuId });
    if (canonicalThread.units.length !== sequence.length) throw new ConversationSemanticIntegrityError('INVALID_SEMANTIC_RUNTIME_CONTEXT');
    const canonicalLifecycle = canonicalizePreparedThreadLayerSequence(decisions, { sessionId });
    if (canonicalLifecycle.units.length !== sequence.length) throw new ConversationSemanticIntegrityError('INVALID_SEMANTIC_RUNTIME_CONTEXT');
    const canonicalLiveFocus = canonicalizePreparedLiveFocusSequence(liveFocusDecisions, { sessionId });
    if (canonicalLiveFocus.units.length !== sequence.length) throw new ConversationSemanticIntegrityError('INVALID_SEMANTIC_RUNTIME_CONTEXT');

    return {
      userFocusUnits: canonicalFocus.units.slice(0, userCus.length),
      assistantFocusUnits: canonicalFocus.units.slice(userCus.length),
      userThreadUnits: canonicalThread.units.slice(0, userCus.length),
      assistantThreadUnits: canonicalThread.units.slice(userCus.length),
      userLifecycleUnits: canonicalLifecycle.units.slice(0, userCus.length),
      assistantLifecycleUnits: canonicalLifecycle.units.slice(userCus.length),
      userLiveFocusUnits: canonicalLiveFocus.units.slice(0, userCus.length),
      assistantLiveFocusUnits: canonicalLiveFocus.units.slice(userCus.length),
      focusProvenance,
      threadProvenance,
      lifecycleProvenance,
      liveFocusProvenance,
    };
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
    throw new ConversationSemanticIntegrityError('INVALID_FINALIZED_EXCHANGE_RELATION');
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

function verifiedEvent(snapshot: IntegratedFullSemanticBatchSnapshot): ConversationalUnitsCommittedWireEvent | undefined {
  const event: CommittedConversationUnitEventRow | null = snapshot.commit_event;
  if (snapshot.committed_unit_count === 0) {
    if (event) throw new ConversationSemanticIntegrityError('DELIVERY_RANGE_MISMATCH');
    return undefined;
  }
  if (!event) throw new ConversationSemanticIntegrityError('COMMITTED_WITHOUT_DELIVERY_EVENT');
  const positions = snapshot.units.map((unit) => unit.session_position);
  if (
    positions.length !== snapshot.committed_unit_count
    || event.unit_count !== snapshot.committed_unit_count
    || event.last_sp - event.first_sp + 1 !== snapshot.committed_unit_count
    || event.first_sp !== Math.min(...positions)
    || event.last_sp !== Math.max(...positions)
  ) {
    throw new ConversationSemanticIntegrityError('DELIVERY_RANGE_MISMATCH');
  }
  return toCommittedWireEvent(event);
}

/** Both halves segment through ONE binding, so their provenance is identical by construction. */
function segmentationProvenanceOf(user: CommitConversationUnitsRequest, assistant: CommitConversationUnitsRequest) {
  const fields = ['evaluatorVersion', 'policyVersion', 'segmentationProvider', 'segmentationModel', 'segmentationPromptVersion'] as const;
  if (fields.some((field) => user[field] !== assistant[field])) throw new ConversationSemanticIntegrityError('PROVENANCE_DISAGREEMENT');
  return {
    evaluatorVersion: user.evaluatorVersion,
    policyVersion: user.policyVersion,
    segmentationProvider: user.segmentationProvider,
    segmentationModel: user.segmentationModel,
    segmentationPromptVersion: user.segmentationPromptVersion,
  };
}
