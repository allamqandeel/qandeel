// T-03A2 - the runtime commitment coordinator.
//
// It turns ONE finalized conversational exchange into canonical Session time:
//
//   A  derive the two stable automatic batch identities;
//   B  read both batch snapshots - if BOTH are already committed, return the
//      stored canonical delivery with ZERO provider calls;
//   C  evaluate the USER and the ASSISTANT source SEPARATELY (concurrently, but
//      never merged into one segmentation request);
//   D  commit both through ONE atomic Session-clock transaction, USER first;
//   E  on a race lost to an already-committed winner, re-read the canonical
//      result instead of overwriting or re-segmenting it.
//
// This service is a POST-FINALIZATION phase. It is invoked only after the
// durable USER and ASSISTANT turns are already COMPLETED, and it holds no path
// that can mark a completed turn FAILED, call `fail_conversation_turn`, record
// a generation-failure outcome, or regenerate an assistant response. A failure
// here surfaces as a retryable service-unavailable response while the durable
// completed turns remain completed.
//
// It carries no Nest decorator: `ConversationModule` registers it through an
// explicit factory, so this directory stays framework-agnostic.

import { ServiceUnavailableException } from '@nestjs/common';
import type { ConversationTemporalDelivery, ConversationalUnitsCommittedWireEvent } from '@qandeel/runtime';
import type { ConversationTurn, OrchestratedTurnResult } from '../conversation/conversation.types';
import { ConversationUnitCommitmentService } from './conversation-unit-commitment.service';
import type { ConversationUnitRepository } from './conversation-unit.repository';
import type { CuSegmentationProvider } from './cu-segmentation-provider.types';
import {
  ConversationTemporalIntegrityError,
  type CommitBatchSnapshot,
  type CommitConversationUnitsRequest,
  type CommittedConversationUnitEventRow,
  type FinalizedExchangeCommitResult,
} from './conversation-unit.types';
import { automaticCommitBatchId, automaticCommitUnitId } from './deterministic-runtime-id';
import { toCommittedWireEvent } from './temporal-delivery.repository';

/** The segmentation binding actually used for one evaluation. */
export interface CuSegmentationBinding {
  readonly provider: CuSegmentationProvider;
  readonly providerName: string;
  readonly providerModel: string;
}

/**
 * The lazy provider seam.
 *
 * The real OpenAI adapter is constructed on FIRST ACTUAL EVALUATION, never at
 * Nest bootstrap, so starting the application - or running any unrelated test -
 * never requires `OPENAI_API_KEY`. Tests inject a deterministic fake through
 * the same seam.
 */
export type CuSegmentationBindingFactory = () => CuSegmentationBinding;

export class ConversationTemporalEstablishmentService {
  private binding: CuSegmentationBinding | undefined;

  constructor(
    private readonly units: ConversationUnitRepository,
    private readonly createBinding: CuSegmentationBindingFactory,
  ) {}

  /**
   * Establishes Session time for a completed exchange and returns the result
   * with the additive `temporal` block. Existing `userTurn` / `assistantTurn`
   * are never removed or reinterpreted.
   *
   * An exchange that is NOT YET a completed pair - a still generating turn, a
   * cancelled or failed turn, a replay with no assistant turn yet - is returned
   * untouched: there is nothing committed to establish, and nothing is
   * invented.
   *
   * A pair that IS both present and completed, but is structurally not a
   * finalized exchange, is a different thing entirely and fails closed
   * (FIX-T03A2-01). Silently returning "nothing to establish" there would let a
   * broken upstream drop a real Moment on the floor without anyone noticing.
   */
  async establish(userId: string, result: OrchestratedTurnResult): Promise<OrchestratedTurnResult> {
    const { userTurn, assistantTurn } = result;
    if (!assistantTurn) return result;
    if (userTurn.status !== 'COMPLETED' || assistantTurn.status !== 'COMPLETED') return result;
    return { ...result, temporal: await this.establishExchange(userId, userTurn, assistantTurn) };
  }

  private async establishExchange(
    userId: string,
    userTurn: ConversationTurn,
    assistantTurn: ConversationTurn,
  ): Promise<ConversationTemporalDelivery> {
    try {
      // Before ANY provider call and before any database write: the durable
      // pair must actually be one finalized exchange.
      assertFinalizedExchangeRelation(userTurn, assistantTurn);
      return await this.run(userId, userTurn, assistantTurn);
    } catch (error) {
      if (error instanceof ConversationTemporalIntegrityError) {
        throw new ServiceUnavailableException('Conversation temporal establishment failed an integrity check.', { cause: error });
      }
      throw new ServiceUnavailableException('Conversation temporal establishment is unavailable.', { cause: error });
    }
  }

  private async run(
    userId: string,
    userTurn: ConversationTurn,
    assistantTurn: ConversationTurn,
  ): Promise<ConversationTemporalDelivery> {
    // Step A - stable automatic identities. Technical idempotency only: not SP,
    // not Product temporal state, and not a one-batch-per-turn constraint.
    const userBatchId = automaticCommitBatchId(userTurn.id);
    const assistantBatchId = automaticCommitBatchId(assistantTurn.id);

    // Step B - existence read before any provider call.
    const snapshots = await this.readSnapshots(userId, userTurn, assistantTurn, userBatchId, assistantBatchId);
    const alreadyCommitted = this.canonicalDelivery(snapshots);
    if (alreadyCommitted) return alreadyCommitted;

    // Step C - separate evaluations. The two sources are never merged into one
    // segmentation request; concurrency here only avoids serial provider
    // latency. Both handlers are attached immediately so the slower rejection
    // can never become an unhandled rejection while the other is awaited.
    const userEvaluation = this.evaluate(userId, userTurn, userBatchId, snapshots[0].source_frontier);
    const assistantEvaluation = this.evaluate(userId, assistantTurn, assistantBatchId, snapshots[1].source_frontier);
    userEvaluation.catch(() => undefined);
    assistantEvaluation.catch(() => undefined);
    const [userBatch, assistantBatch] = await Promise.all([userEvaluation, assistantEvaluation]);

    // Step D - one atomic coordinator call, USER block then ASSISTANT block.
    try {
      return this.deliveryFromCommit(await this.units.commitFinalizedExchange({
        sessionId: userTurn.session_id,
        userId,
        userSourceTurnId: userTurn.id,
        userBatchId,
        userUnits: userBatch.units,
        assistantSourceTurnId: assistantTurn.id,
        assistantBatchId,
        assistantUnits: assistantBatch.units,
        ...provenanceOf(userBatch, assistantBatch),
      }));
    } catch (error) {
      // Step E - the database is authoritative. Two identical requests may both
      // have evaluated before either transaction won; duplicate provider
      // compute under that rare race is acceptable, duplicate canonical truth
      // is not. The loser re-reads and returns the winner's committed result,
      // and never overwrites or re-segments it. Anything else fails closed with
      // the original error.
      const canonical = this.canonicalDelivery(
        await this.readSnapshots(userId, userTurn, assistantTurn, userBatchId, assistantBatchId),
      );
      if (canonical) return canonical;
      throw error;
    }
  }

  private readSnapshots(
    userId: string,
    userTurn: ConversationTurn,
    assistantTurn: ConversationTurn,
    userBatchId: string,
    assistantBatchId: string,
  ): Promise<[CommitBatchSnapshot, CommitBatchSnapshot]> {
    const user = this.units.readBatchSnapshot({
      sessionId: userTurn.session_id, userId, sourceTurnId: userTurn.id, batchId: userBatchId,
    });
    const assistant = this.units.readBatchSnapshot({
      sessionId: assistantTurn.session_id, userId, sourceTurnId: assistantTurn.id, batchId: assistantBatchId,
    });
    user.catch(() => undefined);
    assistant.catch(() => undefined);
    return Promise.all([user, assistant]);
  }

  /**
   * Resolves an ALREADY canonical exchange, or `undefined` when neither
   * automatic batch exists yet.
   *
   * A committed zero-CU batch counts as complete: it exists, holds no unit and
   * holds no delivery event. A structurally partial pair is never silently
   * repaired - the missing half is not invented, and the present half is not
   * discarded; it fails closed as an integrity error.
   */
  private canonicalDelivery(
    [user, assistant]: readonly [CommitBatchSnapshot, CommitBatchSnapshot],
  ): ConversationTemporalDelivery | undefined {
    if (!user.batch_exists && !assistant.batch_exists) return undefined;
    if (user.batch_exists !== assistant.batch_exists) {
      throw new ConversationTemporalIntegrityError('PARTIAL_AUTOMATIC_EXCHANGE_COMMITMENT');
    }
    const events = [verifiedEvent(user), verifiedEvent(assistant)].filter(isPresent);
    // LH never retracts, so the later of two concurrent authoritative reads is
    // the safe answer.
    const liveHead = maxLiveHead(user.live_head, assistant.live_head);
    return this.delivery(liveHead, events);
  }

  private deliveryFromCommit(committed: FinalizedExchangeCommitResult): ConversationTemporalDelivery {
    const events = [committed.user_event, committed.assistant_event]
      .filter(isPresent)
      .map(toCommittedWireEvent);
    return this.delivery(committed.live_head, events);
  }

  private delivery(
    liveHead: number | null,
    events: readonly ConversationalUnitsCommittedWireEvent[],
  ): ConversationTemporalDelivery {
    const ordered = [...events].sort((a, b) => a.firstSp - b.firstSp);
    const highest = ordered.reduce((max, event) => Math.max(max, event.lastSp), 0);
    if (ordered.length > 0 && (liveHead === null || liveHead < highest)) {
      throw new ConversationTemporalIntegrityError('LIVE_HEAD_NOT_ESTABLISHED');
    }
    return { liveHead, committedEvents: ordered };
  }

  /**
   * Evaluates ONE source turn. The database re-establishes every commitment
   * condition authoritatively inside the producer; the modality asserted here
   * mirrors the TEXT-only admission that already gated this turn and is never
   * the authority.
   */
  private async evaluate(
    userId: string,
    turn: ConversationTurn,
    batchId: string,
    sourceFrontier: number,
  ): Promise<CommitConversationUnitsRequest> {
    this.binding ??= this.createBinding();
    const commitment = new ConversationUnitCommitmentService(
      this.binding.provider, this.binding.providerName, this.binding.providerModel,
    );
    return commitment.evaluate(
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
  }
}

/**
 * FIX-T03A2-01: the application-side fail-fast on the finalized-exchange
 * relation. The database coordinator re-establishes this authoritatively from
 * the locked source rows; this check exists so a structurally invalid completed
 * pair costs zero provider calls and zero database commitment, and surfaces as
 * a retryable temporal-establishment failure instead of being mistaken for
 * "nothing to establish".
 *
 * It never marks a turn FAILED and never regenerates an assistant response:
 * both durable turns stay COMPLETED exactly as the orchestrator left them.
 */
function assertFinalizedExchangeRelation(userTurn: ConversationTurn, assistantTurn: ConversationTurn): void {
  if (
    userTurn.role !== 'USER'
    || assistantTurn.role !== 'ASSISTANT'
    || userTurn.session_id !== assistantTurn.session_id
    || assistantTurn.source_turn_id !== userTurn.id
  ) {
    throw new ConversationTemporalIntegrityError('INVALID_FINALIZED_EXCHANGE_RELATION');
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

/**
 * Verifies that a stored batch and its delivery event agree, and returns the
 * wire event of a non-zero batch. A non-zero batch with no event, or an event
 * whose range disagrees with the stored Session Positions, fails closed.
 */
function verifiedEvent(snapshot: CommitBatchSnapshot): ConversationalUnitsCommittedWireEvent | undefined {
  const event: CommittedConversationUnitEventRow | null = snapshot.event;
  if (snapshot.committed_unit_count === 0) {
    if (event) throw new ConversationTemporalIntegrityError('DELIVERY_RANGE_MISMATCH');
    return undefined;
  }
  if (!event) throw new ConversationTemporalIntegrityError('COMMITTED_WITHOUT_DELIVERY_EVENT');
  const positions = snapshot.units.map((unit) => unit.session_position);
  if (
    positions.length !== snapshot.committed_unit_count
    || event.unit_count !== snapshot.committed_unit_count
    || event.last_sp - event.first_sp + 1 !== snapshot.committed_unit_count
    || event.first_sp !== Math.min(...positions)
    || event.last_sp !== Math.max(...positions)
  ) {
    throw new ConversationTemporalIntegrityError('DELIVERY_RANGE_MISMATCH');
  }
  return toCommittedWireEvent(event);
}

/**
 * Both halves of one exchange are evaluated through the SAME binding, so their
 * provenance is identical by construction. A disagreement would silently store
 * the wrong provenance on one batch, so it fails closed instead.
 */
function provenanceOf(user: CommitConversationUnitsRequest, assistant: CommitConversationUnitsRequest) {
  const fields = ['evaluatorVersion', 'policyVersion', 'segmentationProvider', 'segmentationModel', 'segmentationPromptVersion'] as const;
  if (fields.some((field) => user[field] !== assistant[field])) {
    throw new ConversationTemporalIntegrityError('PROVENANCE_DISAGREEMENT');
  }
  return {
    evaluatorVersion: user.evaluatorVersion,
    policyVersion: user.policyVersion,
    segmentationProvider: user.segmentationProvider,
    segmentationModel: user.segmentationModel,
    segmentationPromptVersion: user.segmentationPromptVersion,
  };
}
