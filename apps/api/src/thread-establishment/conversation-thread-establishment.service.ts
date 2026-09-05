// T-03B2b3 - the production-inert post-finalization B1+B2 orchestration.
//
// Turns ONE durable COMPLETED USER -> ASSISTANT finalized exchange into
// canonical Session time PLUS its reference / focus semantics PLUS its
// optional Thread establishment and permanent Home, per Moment, through the
// integrated coordinator of migration 0068:
//
//   A  relation gate (zero providers, zero mutation on an invalid pair)
//   B  stable automatic batch identities (exactly T-03A2's derivation)
//   C  integrated B1+B2 snapshots BEFORE any provider: COMPLETE + COMPLETE is
//      canonical replay with zero calls; ABSENT + ABSENT is a new exchange;
//      every other combination fails closed with no repair and no backfill
//   D  ONE authoritative combined B1+B2 context + clock token, read outside
//      any database lock
//   E  USER and ASSISTANT segmentation, separately (T-03A2 semantics kept)
//   F  exact prepared CurrentCu inputs from the proposed spans (code points)
//   G  sequential whole-exchange B1 focus evaluation, no hindsight
//   H  ONE whole-exchange B1 canonicalization, then an exact split
//   I  the exact canonical B1 bundle paired to the exact B2 CU
//   J  sequential whole-exchange B2 Thread evaluation, no hindsight
//   K  deterministic grounded Conversational Origin (ED-B2B3-02, no provider)
//   L  ONE whole-exchange Thread canonicalization, then an exact split
//   M  one existing 0068 coordinator commit against the exact token
//   N  the SAME external temporal delivery shape T-03A2 returns
//
// Bounded recovery: on a commit failure, re-read the integrated snapshots
// first (a canonical winner is returned, partial history fails closed); only
// the exact typed stale-context error, with neither batch present, earns ONE
// semantic re-evaluation against a re-read context - segmentation is never
// repeated. A second stale failure is retryable unavailability.
//
// AC-B2B3-01: this service is a plain class with no Nest decorator, is not
// registered in ConversationModule and is not called by ConversationService.
// The live T-03A2 path stays exactly live; T-03D performs the final cutover
// once effective LF joins the same per-Moment transaction. It is a
// POST-FINALIZATION phase: it never marks a completed turn FAILED, never calls
// failTurn, and regenerates nothing.

import type { ConversationTemporalDelivery, ConversationalUnitsCommittedWireEvent } from '@qandeel/runtime';
import type { ConversationTurn, OrchestratedTurnResult } from '../conversation/conversation.types';
import { ConversationUnitCommitmentService } from '../conversation-unit/conversation-unit-commitment.service';
import type { CuSegmentationBinding, CuSegmentationBindingFactory } from '../conversation-unit/conversation-temporal-establishment.service';
import { CommitmentRejectedError, type CommitConversationUnitsRequest, type CommittedConversationUnitEventRow } from '../conversation-unit/conversation-unit.types';
import { sliceByCodePoints } from '../conversation-unit/cu-anchor-mapper';
import { automaticCommitBatchId, automaticCommitUnitId } from '../conversation-unit/deterministic-runtime-id';
import { toCommittedWireEvent } from '../conversation-unit/temporal-delivery.repository';
import { ConversationalFocusEvaluatorService, orderFinalizedExchange } from '../conversational-focus/conversational-focus-evaluator.service';
import {
  FOCUS_EVALUATOR_VERSION,
  FOCUS_POLICY_VERSION,
  FocusEvaluationRejectedError,
  type CurrentCuInput,
  type PreparedConversationalFocusResult,
  type PriorContext,
} from '../conversational-focus/conversational-focus.types';
import { canonicalizePreparedFocusSequence } from '../conversational-focus/durable-focus-canonicalizer';
import type { CanonicalCuFocusSemanticPayload, CanonicalFocusBatchProvenance } from '../conversational-focus/durable-focus-payload.types';
import { FOCUS_RESOLUTION_PROMPT_VERSION } from '../conversational-focus/focus-resolution-provider.config';
import { FOCUS_RESOLUTION_SCHEMA_VERSION, FocusResolutionProviderError } from '../conversational-focus/focus-resolution-provider.types';
import type { FocusResolutionBinding, FocusResolutionBindingFactory } from '../conversational-focus/focus-resolution-binding';
import { canonicalizePreparedThreadSequence, durableThreadId } from './durable-thread-canonicalizer';
import type {
  CanonicalThreadBatchProvenance,
  CanonicalThreadEstablishmentPayload,
  PreparedConversationalOrigin,
} from './durable-thread-payload.types';
import { deriveConversationalOrigin, type OriginEstablishedThread } from './conversational-origin-mapper';
import { THREAD_ESTABLISHMENT_PROMPT_VERSION } from './thread-establishment-provider.config';
import { THREAD_ESTABLISHMENT_SCHEMA_VERSION, ThreadEstablishmentProviderError } from './thread-establishment-provider.types';
import type { ThreadEstablishmentBinding, ThreadEstablishmentBindingFactory } from './thread-establishment-binding';
import { ThreadEstablishmentEvaluatorService, type SequencedCuFocusSemantics } from './thread-establishment-evaluator.service';
import {
  THREAD_ESTABLISHMENT_EVALUATOR_VERSION,
  THREAD_ESTABLISHMENT_POLICY_VERSION,
  ThreadEstablishmentRejectedError,
  type PreparedThreadEstablishmentResult,
  type ThreadEstablishmentPriorContext,
} from './thread-establishment.types';
import type { ConversationThreadRuntimeBoundary } from './conversation-thread-runtime.repository';
import {
  ConversationThreadEstablishmentUnavailableError,
  ConversationThreadIntegrityError,
  MAX_THREAD_STALE_CONTEXT_RETRIES,
  type ConversationThreadRuntimeContext,
  type FinalizedExchangeWithFocusAndThreadResult,
  type IntegratedFocusThreadBatchSnapshot,
} from './conversation-thread-runtime.types';
import { StaleConversationalFocusContextError } from '../conversational-focus/conversation-focus-runtime.types';

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
  readonly focusProvenance: CanonicalFocusBatchProvenance;
  readonly threadProvenance: CanonicalThreadBatchProvenance;
}

export class ConversationThreadEstablishmentService {
  private segmentation: CuSegmentationBinding | undefined;
  private focus: FocusResolutionBinding | undefined;
  private thread: ThreadEstablishmentBinding | undefined;

  constructor(
    private readonly repository: ConversationThreadRuntimeBoundary,
    private readonly createSegmentationBinding: CuSegmentationBindingFactory,
    private readonly createFocusBinding: FocusResolutionBindingFactory,
    private readonly createThreadBinding: ThreadEstablishmentBindingFactory,
  ) {}

  /**
   * The same entry shape as T-03A2: a result that is not yet a completed pair
   * is returned untouched; a completed pair gains the additive `temporal`
   * delivery. No Thread, Home or Origin payload exists on the wire, and no
   * client schema changes.
   */
  async establish(userId: string, result: OrchestratedTurnResult): Promise<OrchestratedTurnResult> {
    const { userTurn, assistantTurn } = result;
    if (!assistantTurn) return result;
    if (userTurn.status !== 'COMPLETED' || assistantTurn.status !== 'COMPLETED') return result;
    return { ...result, temporal: await this.establishExchange(userId, userTurn, assistantTurn) };
  }

  async establishExchange(userId: string, userTurn: ConversationTurn, assistantTurn: ConversationTurn): Promise<ConversationTemporalDelivery> {
    // A. The relation gate: before any provider call and any database write.
    assertFinalizedExchangeRelation(userTurn, assistantTurn);
    try {
      return await this.run(userId, userTurn, assistantTurn);
    } catch (error) {
      if (error instanceof ConversationThreadIntegrityError || error instanceof ConversationThreadEstablishmentUnavailableError) throw error;
      // A segmentation outage or rejection (T-03A1), a focus provider outage
      // or rejected focus proposal (T-03B1a), or a Thread provider outage or
      // rejected promotion (T-03B2a): retryable, never a lifecycle failure of
      // the completed turns, and never reinterpreted as NO_ESTABLISHMENT.
      if (error instanceof CommitmentRejectedError || error instanceof FocusResolutionProviderError
        || error instanceof FocusEvaluationRejectedError || error instanceof ThreadEstablishmentProviderError
        || error instanceof ThreadEstablishmentRejectedError) {
        throw new ConversationThreadEstablishmentUnavailableError('PROVIDER_UNAVAILABLE', { cause: error });
      }
      throw new ConversationThreadEstablishmentUnavailableError('TRANSPORT_UNAVAILABLE', { cause: error });
    }
  }

  private async run(userId: string, userTurn: ConversationTurn, assistantTurn: ConversationTurn): Promise<ConversationTemporalDelivery> {
    // B. Stable automatic identities: technical idempotency, exactly T-03A2's.
    const userBatchId = automaticCommitBatchId(userTurn.id);
    const assistantBatchId = automaticCommitBatchId(assistantTurn.id);

    // C. Integrated B1+B2 snapshots before any provider.
    const snapshots = await this.readSnapshots(userId, userTurn, assistantTurn, userBatchId, assistantBatchId);
    const replayed = this.canonicalDelivery(snapshots);
    if (replayed) return replayed;

    // D. One authoritative combined context, read outside any database lock.
    let context = await this.repository.readRuntimeContext({ sessionId: userTurn.session_id, userId });

    // E. Segmentation, USER and ASSISTANT separately (may run concurrently).
    const userHalf = this.segment(userId, userTurn, userBatchId, snapshots[0].source_frontier);
    const assistantHalf = this.segment(userId, assistantTurn, assistantBatchId, snapshots[1].source_frontier);
    userHalf.catch(() => undefined);
    assistantHalf.catch(() => undefined);
    const halves = await Promise.all([userHalf, assistantHalf]);
    const segmentationProvenance = segmentationProvenanceOf(halves[0].batch, halves[1].batch);

    let retriesLeft = MAX_THREAD_STALE_CONTEXT_RETRIES;
    for (;;) {
      // F -> L: prepared inputs, sequential B1, one B1 canonicalization,
      // sequential B2, deterministic Origin, one Thread canonicalization.
      const evaluated = await this.evaluateExchange(userTurn.session_id, userId, halves, context);
      try {
        // M. One integrated commit against the exact token the context carried.
        const committed = await this.repository.commitFinalizedExchangeWithFocusAndThread({
          sessionId: userTurn.session_id,
          userId,
          userSourceTurnId: userTurn.id,
          userBatchId,
          userUnits: halves[0].batch.units,
          userFocusUnits: evaluated.userFocusUnits,
          userThreadUnits: evaluated.userThreadUnits,
          assistantSourceTurnId: assistantTurn.id,
          assistantBatchId,
          assistantUnits: halves[1].batch.units,
          assistantFocusUnits: evaluated.assistantFocusUnits,
          assistantThreadUnits: evaluated.assistantThreadUnits,
          ...segmentationProvenance,
          ...evaluated.focusProvenance,
          ...evaluated.threadProvenance,
          expectedCurrentSp: context.token.currentSp,
          expectedSameSpEventSequence: context.token.sameSpEventSequence,
        });
        // N. The T-03A2-compatible delivery.
        return this.deliveryFromCommit(committed);
      } catch (error) {
        // Recovery step 1: the database is authoritative. A canonical winner is
        // returned as is; partial or legacy history fails closed.
        const fresh = await this.readSnapshots(userId, userTurn, assistantTurn, userBatchId, assistantBatchId);
        const winner = this.canonicalDelivery(fresh);
        if (winner) return winner;
        // Recovery step 2: only the exact typed stale condition, with neither
        // batch present, earns ONE semantic re-evaluation. Segmentation is
        // reused; the source frontiers must not have moved.
        if (!(error instanceof StaleConversationalFocusContextError)) throw error;
        if (retriesLeft === 0) throw new ConversationThreadEstablishmentUnavailableError('STALE_CONTEXT_RETRY_EXHAUSTED', { cause: error });
        retriesLeft -= 1;
        if (fresh[0].source_frontier !== halves[0].sourceFrontier || fresh[1].source_frontier !== halves[1].sourceFrontier) {
          throw new ConversationThreadIntegrityError('SEGMENTATION_FRONTIER_MOVED');
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
  ): Promise<[IntegratedFocusThreadBatchSnapshot, IntegratedFocusThreadBatchSnapshot]> {
    const user = this.repository.readIntegratedBatchSnapshot({ sessionId: userTurn.session_id, userId, sourceTurnId: userTurn.id, batchId: userBatchId });
    const assistant = this.repository.readIntegratedBatchSnapshot({ sessionId: assistantTurn.session_id, userId, sourceTurnId: assistantTurn.id, batchId: assistantBatchId });
    user.catch(() => undefined);
    assistant.catch(() => undefined);
    return Promise.all([user, assistant]);
  }

  /**
   * Resolves an ALREADY canonical, B1+B2-complete exchange, or `undefined`
   * when the exchange is absent at all three capture layers. Every other
   * combination fails closed BEFORE any provider is called:
   *
   *   COMPLETE + COMPLETE  canonical replay, stored delivery, zero providers
   *   ABSENT   + ABSENT    a new exchange
   *   PARTIAL involved     INCOMPLETE_THREAD_CAPTURE (legacy T-03A2-only and
   *                        B1-only history land here; never upgraded)
   *   ABSENT / COMPLETE    PARTIAL_INTEGRATED_EXCHANGE (never "finished")
   *
   * The state is the 0068 structural authority's, read through 0069. This
   * side never recomputes it and never repairs anything.
   */
  private canonicalDelivery([user, assistant]: readonly [IntegratedFocusThreadBatchSnapshot, IntegratedFocusThreadBatchSnapshot]): ConversationTemporalDelivery | undefined {
    if (user.thread_capture_state === 'PARTIAL' || assistant.thread_capture_state === 'PARTIAL') {
      throw new ConversationThreadIntegrityError('INCOMPLETE_THREAD_CAPTURE');
    }
    if (user.thread_capture_state === 'ABSENT' && assistant.thread_capture_state === 'ABSENT') return undefined;
    if (user.thread_capture_state !== 'COMPLETE' || assistant.thread_capture_state !== 'COMPLETE') {
      throw new ConversationThreadIntegrityError('PARTIAL_INTEGRATED_EXCHANGE');
    }
    const events = [verifiedEvent(user), verifiedEvent(assistant)].filter(isPresent);
    return this.delivery(maxLiveHead(user.live_head, assistant.live_head), events);
  }

  private deliveryFromCommit(committed: FinalizedExchangeWithFocusAndThreadResult): ConversationTemporalDelivery {
    const events = [committed.user_event, committed.assistant_event].filter(isPresent).map(toCommittedWireEvent);
    return this.delivery(committed.live_head, events);
  }

  private delivery(liveHead: number | null, events: readonly ConversationalUnitsCommittedWireEvent[]): ConversationTemporalDelivery {
    const ordered = [...events].sort((a, b) => a.firstSp - b.firstSp);
    const highest = ordered.reduce((max, event) => Math.max(max, event.lastSp), 0);
    if (ordered.length > 0 && (liveHead === null || liveHead < highest)) {
      throw new ConversationThreadIntegrityError('LIVE_HEAD_NOT_ESTABLISHED');
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
   * F -> L for the whole exchange against ONE context. Both semantic bindings
   * are created here, on first actual need; a zero/zero exchange needs them
   * only for their deterministic provenance and issues no proposal at all.
   */
  private async evaluateExchange(
    sessionId: string,
    userId: string,
    [user, assistant]: readonly [SegmentedHalf, SegmentedHalf],
    context: ConversationThreadRuntimeContext,
  ): Promise<EvaluatedExchange> {
    this.focus ??= this.createFocusBinding();
    this.thread ??= this.createThreadBinding();
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

    // F. Exact prepared CurrentCu inputs from the proposed spans.
    const userCus = buildPreparedThreadCuInputs(user.turn, user.batch.units, context.priorContext);
    const assistantCus = buildPreparedThreadCuInputs(assistant.turn, assistant.batch.units, context.priorContext);
    const sequence = orderFinalizedExchange(userCus, assistantCus);

    // G. USER CUs in source order, then ASSISTANT CUs; strictly sequential.
    let focusResults: readonly PreparedConversationalFocusResult[] = [];
    if (sequence.length > 0) {
      const evaluator = new ConversationalFocusEvaluatorService(this.focus.provider, this.focus.providerName, this.focus.providerModel);
      focusResults = (await evaluator.evaluateSequence(sessionId, sequence, context.priorContext)).results;
    }

    // H. ONE B1 canonicalization across the whole exchange, before any B2 work.
    const canonicalFocus = canonicalizePreparedFocusSequence(focusResults, { sessionId, priorFocusCandidates: context.priorContext.focusCandidates });
    if (canonicalFocus.units.length !== sequence.length) throw new ConversationThreadIntegrityError('INVALID_THREAD_RUNTIME_CONTEXT');

    // I. The exact canonical B1 bundle paired to the exact B2 CU.
    const paired: SequencedCuFocusSemantics[] = sequence.map((cu, index) => {
      const focusSemantics = canonicalFocus.units[index];
      if (focusSemantics.unit_id !== cu.cuId) throw new ConversationThreadIntegrityError('FOCUS_SEMANTICS_MISMATCH');
      return { cu, focusSemantics };
    });

    // J. Sequential whole-exchange Thread evaluation, prior context only.
    let threadResults: readonly PreparedThreadEstablishmentResult[] = [];
    if (paired.length > 0) {
      const threadPriorContext: ThreadEstablishmentPriorContext = {
        priorCus: context.priorContext.priorCus,
        focusAttentionHistory: context.focusAttentionHistory,
        establishedFocusIds: context.establishedThreadBindings.map((binding) => binding.emergingFocusId),
      };
      const evaluator = new ThreadEstablishmentEvaluatorService(this.thread.provider, this.thread.providerName, this.thread.providerModel);
      threadResults = (await evaluator.evaluateSequence(sessionId, paired, threadPriorContext)).results;
    }
    assertThreadProvenanceAgreement(threadResults, threadProvenance);

    // K. Deterministic grounded Conversational Origin, per establishment.
    const originsByCuId = this.deriveOrigins(userId, paired, threadResults, context);

    // L. ONE Thread canonicalization across the whole exchange, then the split.
    const canonicalThread = canonicalizePreparedThreadSequence(threadResults, { userId, originsByCuId });
    if (canonicalThread.units.length !== sequence.length) throw new ConversationThreadIntegrityError('INVALID_THREAD_RUNTIME_CONTEXT');

    return {
      userFocusUnits: canonicalFocus.units.slice(0, userCus.length),
      assistantFocusUnits: canonicalFocus.units.slice(userCus.length),
      userThreadUnits: canonicalThread.units.slice(0, userCus.length),
      assistantThreadUnits: canonicalThread.units.slice(userCus.length),
      focusProvenance,
      threadProvenance,
    };
  }

  /**
   * K. ED-B2B3-02, applied strictly forward. The visible prefix grows CU by CU
   * in exact evaluation order, so an establishment decision can never see a
   * later CU, a later ASSISTANT CU, or a later same-exchange establishment. A
   * Thread established EARLIER in this same exchange becomes an origin
   * candidate only after its own CU has been added to the prefix - sequential
   * technical state, never parenthood.
   */
  private deriveOrigins(
    userId: string,
    paired: readonly SequencedCuFocusSemantics[],
    threadResults: readonly PreparedThreadEstablishmentResult[],
    context: ConversationThreadRuntimeContext,
  ): ReadonlyMap<string, PreparedConversationalOrigin> {
    const origins = new Map<string, PreparedConversationalOrigin>();
    if (threadResults.length === 0) return origins;

    // The visible canonical B1 material: the authoritative prior history first.
    const semanticsByCuId = new Map<string, CanonicalCuFocusSemanticPayload>();
    for (const bundle of context.priorFocusSemantics) semanticsByCuId.set(bundle.unit_id, bundle);

    // focus -> grounding handles, from the authoritative focus candidates.
    const focusGroundingHandleIds = new Map<string, readonly string[]>();
    for (const candidate of context.priorContext.focusCandidates) {
      focusGroundingHandleIds.set(candidate.focusCandidateId, candidate.groundingHandleIds);
    }

    const establishedThreads: OriginEstablishedThread[] = context.establishedThreadBindings.map((binding) => ({
      threadId: binding.threadId,
      emergingFocusId: binding.emergingFocusId,
    }));

    for (const [index, result] of threadResults.entries()) {
      const bundle = paired[index].focusSemantics;
      // The establishing CU's OWN canonical bundle is legitimately visible; no
      // later CU ever is.
      semanticsByCuId.set(bundle.unit_id, bundle);

      if (result.decision === 'ESTABLISH_THREAD' && result.emergingFocusId !== null) {
        origins.set(result.cuId, deriveConversationalOrigin(
          {
            establishingCuId: result.cuId,
            targetEmergingFocusId: result.emergingFocusId,
            evidenceCuIds: result.evidenceCuIds,
          },
          { semanticsByCuId, focusGroundingHandleIds, establishedThreads },
        ));
      }

      // The canonical grounding this CU created becomes selectable for later
      // CUs exactly as migration 0066 records it: a START_NEW_FOCUS bundle's
      // grounding reference is the focus's canonical grounding handle.
      const attention = bundle.attention;
      if (attention.creates_focus && attention.emerging_focus_id !== null && attention.grounding_reference_index !== null) {
        const grounding = bundle.references[attention.grounding_reference_index];
        if (grounding !== undefined && grounding.state === 'RESOLVED' && grounding.resolved_handle_id !== null) {
          focusGroundingHandleIds.set(attention.emerging_focus_id, [grounding.resolved_handle_id]);
        }
      }
      // Only AFTER this CU's own decision does its Thread become canonical
      // enough to be a later CU's Conversational Origin.
      if (result.decision === 'ESTABLISH_THREAD' && result.emergingFocusId !== null) {
        establishedThreads.push({
          threadId: durableThreadId(userId, result.emergingFocusId),
          emergingFocusId: result.emergingFocusId,
        });
      }
    }
    return origins;
  }
}

/**
 * F. Exact prepared CurrentCu inputs. The wording is the code-point slice of
 * the locked source at the proposed span (the database re-slices it as the
 * final authority), and the ordinal is the GLOBAL turn ordinal exactly as the
 * producer allocates it - `COALESCE(MAX(ordinal_within_turn) + 1, 0)` over the
 * authoritative prior CUs of the same source turn, then the batch's own order.
 * UTF-16 offsets are never used.
 */
export function buildPreparedThreadCuInputs(
  turn: Pick<ConversationTurn, 'id' | 'role' | 'content'>,
  units: readonly { readonly unitId: string; readonly spanStart: number; readonly spanEnd: number }[],
  prior: PriorContext,
): CurrentCuInput[] {
  const priorOrdinals = prior.priorCus.filter((cu) => cu.sourceTurnId === turn.id).map((cu) => cu.ordinalWithinTurn);
  const nextOrdinal = priorOrdinals.length === 0 ? 0 : Math.max(...priorOrdinals) + 1;
  return units.map((unit, index) => ({
    cuId: unit.unitId,
    sourceTurnId: turn.id,
    sourceRole: turn.role,
    committedText: sliceByCodePoints(turn.content, { start: unit.spanStart, end: unit.spanEnd }),
    ordinalWithinTurn: nextOrdinal + index,
  }));
}

/** FIX-T03A2-01 application-side gate, unchanged in meaning; never marks a turn FAILED. */
function assertFinalizedExchangeRelation(userTurn: ConversationTurn, assistantTurn: ConversationTurn): void {
  if (
    userTurn.role !== 'USER'
    || assistantTurn.role !== 'ASSISTANT'
    || userTurn.session_id !== assistantTurn.session_id
    || assistantTurn.source_turn_id !== userTurn.id
  ) {
    throw new ConversationThreadIntegrityError('INVALID_FINALIZED_EXCHANGE_RELATION');
  }
}

/**
 * Every Thread decision of ONE finalized exchange is produced by ONE binding
 * and ONE evaluator, so its provenance is identical by construction. A
 * disagreement means two different semantic authorities reached the same
 * batch, which may never be recorded as one capture.
 */
export function assertThreadProvenanceAgreement(
  results: readonly PreparedThreadEstablishmentResult[],
  provenance: CanonicalThreadBatchProvenance,
): void {
  for (const result of results) {
    if (
      result.provenance.evaluatorVersion !== provenance.threadEvaluatorVersion
      || result.provenance.policyVersion !== provenance.threadPolicyVersion
      || result.provenance.provider !== provenance.threadProvider
      || result.provenance.model !== provenance.threadModel
      || result.provenance.promptVersion !== provenance.threadPromptVersion
      || result.provenance.schemaVersion !== provenance.threadSchemaVersion
    ) {
      throw new ConversationThreadIntegrityError('THREAD_PROVENANCE_DISAGREEMENT');
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

function verifiedEvent(snapshot: IntegratedFocusThreadBatchSnapshot): ConversationalUnitsCommittedWireEvent | undefined {
  const event: CommittedConversationUnitEventRow | null = snapshot.commit_event;
  if (snapshot.committed_unit_count === 0) {
    if (event) throw new ConversationThreadIntegrityError('DELIVERY_RANGE_MISMATCH');
    return undefined;
  }
  if (!event) throw new ConversationThreadIntegrityError('COMMITTED_WITHOUT_DELIVERY_EVENT');
  const positions = snapshot.units.map((unit) => unit.session_position);
  if (
    positions.length !== snapshot.committed_unit_count
    || event.unit_count !== snapshot.committed_unit_count
    || event.last_sp - event.first_sp + 1 !== snapshot.committed_unit_count
    || event.first_sp !== Math.min(...positions)
    || event.last_sp !== Math.max(...positions)
  ) {
    throw new ConversationThreadIntegrityError('DELIVERY_RANGE_MISMATCH');
  }
  return toCommittedWireEvent(event);
}

/** Both halves segment through ONE binding, so their provenance is identical by construction. */
function segmentationProvenanceOf(user: CommitConversationUnitsRequest, assistant: CommitConversationUnitsRequest) {
  const fields = ['evaluatorVersion', 'policyVersion', 'segmentationProvider', 'segmentationModel', 'segmentationPromptVersion'] as const;
  if (fields.some((field) => user[field] !== assistant[field])) throw new ConversationThreadIntegrityError('PROVENANCE_DISAGREEMENT');
  return {
    evaluatorVersion: user.evaluatorVersion,
    policyVersion: user.policyVersion,
    segmentationProvider: user.segmentationProvider,
    segmentationModel: user.segmentationModel,
    segmentationPromptVersion: user.segmentationPromptVersion,
  };
}
