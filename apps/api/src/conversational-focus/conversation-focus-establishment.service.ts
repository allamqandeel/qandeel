// T-03B1b2 - the production-inert post-finalization B1 orchestration.
//
// Turns ONE durable COMPLETED USER -> ASSISTANT finalized exchange into
// canonical Session time PLUS its reference / focus semantics, per Moment,
// through the integrated writer of migration 0066:
//
//   A  relation gate (zero providers, zero mutation on an invalid pair)
//   B  stable automatic batch identities (exactly T-03A2's derivation)
//   C  integrated snapshots BEFORE any provider: complete replay returns the
//      stored delivery with zero calls; partial / legacy history fails closed
//   D  ONE authoritative B1 context + clock token, read outside any DB lock
//   E  USER and ASSISTANT segmentation, separately (T-03A2 semantics kept)
//   F  exact prepared CurrentCu inputs from the proposed spans (code points)
//   G  sequential whole-exchange focus evaluation, no hindsight
//   H  ONE whole-exchange canonicalization (prepared -> stable identities)
//   I  one provenance tuple for the whole exchange
//   J  one integrated commit against the exact token
//   K  the SAME external temporal delivery shape T-03A2 returns
//
// Bounded recovery: on a commit failure, re-read the integrated snapshots
// first (a canonical winner is returned, partial history fails closed); only
// the exact typed stale-context error, with neither batch present, earns ONE
// focus-only re-evaluation against a re-read context - segmentation is never
// repeated. A second stale failure is retryable unavailability.
//
// AC-B1B2-01: this service is a plain class with no Nest decorator, is not
// registered in ConversationModule and is not called by ConversationService.
// The live T-03A2 path stays exactly live until T-03B2 and T-03D have
// extended the same per-Moment chain and T-03D performs the final cutover.
// It is a POST-FINALIZATION phase: it never marks a completed turn FAILED,
// never calls failTurn, and regenerates nothing.

import type { ConversationTemporalDelivery, ConversationalUnitsCommittedWireEvent } from '@qandeel/runtime';
import type { ConversationTurn, OrchestratedTurnResult } from '../conversation/conversation.types';
import { ConversationUnitCommitmentService } from '../conversation-unit/conversation-unit-commitment.service';
import type { CuSegmentationBinding, CuSegmentationBindingFactory } from '../conversation-unit/conversation-temporal-establishment.service';
import { CommitmentRejectedError, type CommitConversationUnitsRequest, type CommittedConversationUnitEventRow } from '../conversation-unit/conversation-unit.types';
import { sliceByCodePoints } from '../conversation-unit/cu-anchor-mapper';
import { automaticCommitBatchId, automaticCommitUnitId } from '../conversation-unit/deterministic-runtime-id';
import { toCommittedWireEvent } from '../conversation-unit/temporal-delivery.repository';
import { ConversationalFocusEvaluatorService, orderFinalizedExchange } from './conversational-focus-evaluator.service';
import {
  FOCUS_EVALUATOR_VERSION,
  FOCUS_POLICY_VERSION,
  FocusEvaluationRejectedError,
  type CurrentCuInput,
  type PreparedConversationalFocusResult,
  type PriorContext,
} from './conversational-focus.types';
import { canonicalizePreparedFocusSequence } from './durable-focus-canonicalizer';
import type { CanonicalCuFocusSemanticPayload, CanonicalFocusBatchProvenance } from './durable-focus-payload.types';
import { FOCUS_RESOLUTION_PROMPT_VERSION } from './focus-resolution-provider.config';
import { FOCUS_RESOLUTION_SCHEMA_VERSION, FocusResolutionProviderError } from './focus-resolution-provider.types';
import type { FocusResolutionBinding, FocusResolutionBindingFactory } from './focus-resolution-binding';
import type { ConversationFocusRuntimeBoundary } from './conversation-focus-runtime.repository';
import {
  ConversationFocusEstablishmentUnavailableError,
  ConversationFocusIntegrityError,
  MAX_STALE_CONTEXT_RETRIES,
  StaleConversationalFocusContextError,
  type ConversationFocusRuntimeContext,
  type FinalizedExchangeWithFocusResult,
  type IntegratedBatchSnapshot,
} from './conversation-focus-runtime.types';

/** The prepared, provider-independent segmentation of one half of the exchange. */
interface SegmentedHalf {
  readonly turn: ConversationTurn;
  readonly batch: CommitConversationUnitsRequest;
  readonly sourceFrontier: number;
}

export class ConversationFocusEstablishmentService {
  private segmentation: CuSegmentationBinding | undefined;
  private focus: FocusResolutionBinding | undefined;

  constructor(
    private readonly repository: ConversationFocusRuntimeBoundary,
    private readonly createSegmentationBinding: CuSegmentationBindingFactory,
    private readonly createFocusBinding: FocusResolutionBindingFactory,
  ) {}

  /**
   * The same entry shape as T-03A2: a result that is not yet a completed pair
   * is returned untouched; a completed pair gains the additive `temporal`
   * delivery. No new client payload exists.
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
      if (error instanceof ConversationFocusIntegrityError || error instanceof ConversationFocusEstablishmentUnavailableError) throw error;
      // A segmentation outage or rejection (T-03A1), a focus provider outage,
      // or a rejected focus proposal (T-03B1a): retryable, never a lifecycle
      // failure of the completed turns.
      if (error instanceof CommitmentRejectedError || error instanceof FocusResolutionProviderError || error instanceof FocusEvaluationRejectedError) {
        throw new ConversationFocusEstablishmentUnavailableError('PROVIDER_UNAVAILABLE', { cause: error });
      }
      throw new ConversationFocusEstablishmentUnavailableError('TRANSPORT_UNAVAILABLE', { cause: error });
    }
  }

  private async run(userId: string, userTurn: ConversationTurn, assistantTurn: ConversationTurn): Promise<ConversationTemporalDelivery> {
    // B. Stable automatic identities: technical idempotency, exactly T-03A2's.
    const userBatchId = automaticCommitBatchId(userTurn.id);
    const assistantBatchId = automaticCommitBatchId(assistantTurn.id);

    // C. Integrated snapshots before any provider.
    const snapshots = await this.readSnapshots(userId, userTurn, assistantTurn, userBatchId, assistantBatchId);
    const replayed = this.canonicalDelivery(snapshots);
    if (replayed) return replayed;

    // D. One authoritative B1 context, read outside any database lock.
    let context = await this.repository.readRuntimeContext({ sessionId: userTurn.session_id, userId });

    // E. Segmentation, USER and ASSISTANT separately (may run concurrently).
    const userHalf = this.segment(userId, userTurn, userBatchId, snapshots[0].source_frontier);
    const assistantHalf = this.segment(userId, assistantTurn, assistantBatchId, snapshots[1].source_frontier);
    userHalf.catch(() => undefined);
    assistantHalf.catch(() => undefined);
    const halves = await Promise.all([userHalf, assistantHalf]);
    const segmentationProvenance = segmentationProvenanceOf(halves[0].batch, halves[1].batch);

    let retriesLeft = MAX_STALE_CONTEXT_RETRIES;
    for (;;) {
      // F + G + H + I: prepared inputs -> sequential focus evaluation ->
      // one canonicalization -> one provenance tuple.
      const { userFocusUnits, assistantFocusUnits, provenance } = await this.evaluateFocus(userTurn.session_id, halves, context);
      try {
        // J. One integrated commit against the exact token the context carried.
        const committed = await this.repository.commitFinalizedExchangeWithFocus({
          sessionId: userTurn.session_id,
          userId,
          userSourceTurnId: userTurn.id,
          userBatchId,
          userUnits: halves[0].batch.units,
          userFocusUnits,
          assistantSourceTurnId: assistantTurn.id,
          assistantBatchId,
          assistantUnits: halves[1].batch.units,
          assistantFocusUnits,
          ...segmentationProvenance,
          ...provenance,
          expectedCurrentSp: context.token.currentSp,
          expectedSameSpEventSequence: context.token.sameSpEventSequence,
        });
        // K. The T-03A2-compatible delivery.
        return this.deliveryFromCommit(committed);
      } catch (error) {
        // Recovery step 1: the database is authoritative. A canonical winner is
        // returned as is; partial or legacy history fails closed.
        const winner = this.canonicalDelivery(await this.readSnapshots(userId, userTurn, assistantTurn, userBatchId, assistantBatchId));
        if (winner) return winner;
        // Recovery step 2: only the exact typed stale condition, with neither
        // batch present, earns ONE focus-only re-evaluation. Segmentation is
        // reused; the source frontiers must not have moved.
        if (!(error instanceof StaleConversationalFocusContextError)) throw error;
        if (retriesLeft === 0) throw new ConversationFocusEstablishmentUnavailableError('STALE_CONTEXT_RETRY_EXHAUSTED', { cause: error });
        retriesLeft -= 1;
        const fresh = await this.readSnapshots(userId, userTurn, assistantTurn, userBatchId, assistantBatchId);
        if (fresh[0].source_frontier !== halves[0].sourceFrontier || fresh[1].source_frontier !== halves[1].sourceFrontier) {
          throw new ConversationFocusIntegrityError('SEGMENTATION_FRONTIER_MOVED');
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
  ): Promise<[IntegratedBatchSnapshot, IntegratedBatchSnapshot]> {
    const user = this.repository.readIntegratedBatchSnapshot({ sessionId: userTurn.session_id, userId, sourceTurnId: userTurn.id, batchId: userBatchId });
    const assistant = this.repository.readIntegratedBatchSnapshot({ sessionId: assistantTurn.session_id, userId, sourceTurnId: assistantTurn.id, batchId: assistantBatchId });
    user.catch(() => undefined);
    assistant.catch(() => undefined);
    return Promise.all([user, assistant]);
  }

  /**
   * Resolves an ALREADY canonical, B1-complete exchange, or `undefined` when
   * neither automatic batch exists. A batch that exists without complete B1
   * semantics - a legacy T-03A2-only batch, or partial history - is never
   * upgraded by today's inference and never returned as delivery: it fails
   * closed as an integrity error, before any provider is called.
   */
  private canonicalDelivery([user, assistant]: readonly [IntegratedBatchSnapshot, IntegratedBatchSnapshot]): ConversationTemporalDelivery | undefined {
    if (!user.batch_exists && !assistant.batch_exists) return undefined;
    if (user.batch_exists !== assistant.batch_exists) throw new ConversationFocusIntegrityError('PARTIAL_INTEGRATED_EXCHANGE');
    if (!user.focus_complete || !assistant.focus_complete) throw new ConversationFocusIntegrityError('INCOMPLETE_FOCUS_SEMANTICS');
    const events = [verifiedEvent(user), verifiedEvent(assistant)].filter(isPresent);
    return this.delivery(maxLiveHead(user.live_head, assistant.live_head), events);
  }

  private deliveryFromCommit(committed: FinalizedExchangeWithFocusResult): ConversationTemporalDelivery {
    const events = [committed.user_event, committed.assistant_event].filter(isPresent).map(toCommittedWireEvent);
    return this.delivery(committed.live_head, events);
  }

  private delivery(liveHead: number | null, events: readonly ConversationalUnitsCommittedWireEvent[]): ConversationTemporalDelivery {
    const ordered = [...events].sort((a, b) => a.firstSp - b.firstSp);
    const highest = ordered.reduce((max, event) => Math.max(max, event.lastSp), 0);
    if (ordered.length > 0 && (liveHead === null || liveHead < highest)) {
      throw new ConversationFocusIntegrityError('LIVE_HEAD_NOT_ESTABLISHED');
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
   * F -> G -> H -> I for the whole exchange against ONE context. The focus
   * binding is created here, on first actual need; a zero/zero exchange
   * needs it only for its deterministic provenance and issues no proposal.
   */
  private async evaluateFocus(
    sessionId: string,
    [user, assistant]: readonly [SegmentedHalf, SegmentedHalf],
    context: ConversationFocusRuntimeContext,
  ): Promise<{
    userFocusUnits: readonly CanonicalCuFocusSemanticPayload[];
    assistantFocusUnits: readonly CanonicalCuFocusSemanticPayload[];
    provenance: CanonicalFocusBatchProvenance;
  }> {
    this.focus ??= this.createFocusBinding();
    const provenance: CanonicalFocusBatchProvenance = {
      focusEvaluatorVersion: FOCUS_EVALUATOR_VERSION,
      focusPolicyVersion: FOCUS_POLICY_VERSION,
      focusProvider: this.focus.providerName,
      focusModel: this.focus.providerModel,
      focusPromptVersion: FOCUS_RESOLUTION_PROMPT_VERSION,
      focusSchemaVersion: FOCUS_RESOLUTION_SCHEMA_VERSION,
    };
    const userCus = buildPreparedFocusInputs(user.turn, user.batch.units, context.priorContext);
    const assistantCus = buildPreparedFocusInputs(assistant.turn, assistant.batch.units, context.priorContext);
    let results: readonly PreparedConversationalFocusResult[] = [];
    if (userCus.length + assistantCus.length > 0) {
      const evaluator = new ConversationalFocusEvaluatorService(this.focus.provider, this.focus.providerName, this.focus.providerModel);
      // G. USER CUs in source order, then ASSISTANT CUs; strictly sequential.
      const sequence = orderFinalizedExchange(userCus, assistantCus);
      results = (await evaluator.evaluateSequence(sessionId, sequence, context.priorContext)).results;
    }
    // H. One canonicalization across the whole exchange, then an exact split.
    const canonical = canonicalizePreparedFocusSequence(results, { sessionId, priorFocusCandidates: context.priorContext.focusCandidates });
    if (canonical.units.length !== userCus.length + assistantCus.length) throw new ConversationFocusIntegrityError('INVALID_RUNTIME_CONTEXT');
    return {
      userFocusUnits: canonical.units.slice(0, userCus.length),
      assistantFocusUnits: canonical.units.slice(userCus.length),
      provenance,
    };
  }
}

/**
 * F. Exact prepared CurrentCu inputs. The wording is the code-point slice of
 * the locked source at the proposed span (the database re-slices it as the
 * final authority), and the ordinal is the GLOBAL turn ordinal exactly as the
 * producer allocates it - `COALESCE(MAX(ordinal_within_turn) + 1, 0)` over
 * the authoritative prior CUs of the same source turn, then the batch's own
 * order. UTF-16 offsets are never used.
 *
 * (The T-03B1a evaluator refuses, by its frozen no-hindsight rule, a history
 * that already holds a CU of a turn in the sequence, so a later batch of an
 * already-committed turn is never evaluated by the automatic path; the
 * derivation stays exact for it regardless.)
 */
export function buildPreparedFocusInputs(
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
    throw new ConversationFocusIntegrityError('INVALID_FINALIZED_EXCHANGE_RELATION');
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

function verifiedEvent(snapshot: IntegratedBatchSnapshot): ConversationalUnitsCommittedWireEvent | undefined {
  const event: CommittedConversationUnitEventRow | null = snapshot.commit_event;
  if (snapshot.committed_unit_count === 0) {
    if (event) throw new ConversationFocusIntegrityError('DELIVERY_RANGE_MISMATCH');
    return undefined;
  }
  if (!event) throw new ConversationFocusIntegrityError('COMMITTED_WITHOUT_DELIVERY_EVENT');
  const positions = snapshot.units.map((unit) => unit.session_position);
  if (
    positions.length !== snapshot.committed_unit_count
    || event.unit_count !== snapshot.committed_unit_count
    || event.last_sp - event.first_sp + 1 !== snapshot.committed_unit_count
    || event.first_sp !== Math.min(...positions)
    || event.last_sp !== Math.max(...positions)
  ) {
    throw new ConversationFocusIntegrityError('DELIVERY_RANGE_MISMATCH');
  }
  return toCommittedWireEvent(event);
}

/** Both halves segment through ONE binding, so their provenance is identical by construction. */
function segmentationProvenanceOf(user: CommitConversationUnitsRequest, assistant: CommitConversationUnitsRequest) {
  const fields = ['evaluatorVersion', 'policyVersion', 'segmentationProvider', 'segmentationModel', 'segmentationPromptVersion'] as const;
  if (fields.some((field) => user[field] !== assistant[field])) throw new ConversationFocusIntegrityError('PROVENANCE_DISAGREEMENT');
  return {
    evaluatorVersion: user.evaluatorVersion,
    policyVersion: user.policyVersion,
    segmentationProvider: user.segmentationProvider,
    segmentationModel: user.segmentationModel,
    segmentationPromptVersion: user.segmentationPromptVersion,
  };
}
