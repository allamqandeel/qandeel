// T-03A1 - the commitment evaluator.
//
// Turns canonical committed source into a durable commitment batch candidate:
//   eligibility gate -> provider-proposed anchors -> deterministic mapping ->
//   deterministic validation -> batch payload.
//
// It is NOT a Nest provider and this directory contains no module file, so
// nothing here can be imported into AppModule. Combined with the migration
// granting the producer to no application role, T-03A1 is production-inert
// until T-03A2 attaches the temporal establishment boundary.
//
// The four INPUT-01 commitment conditions are established here as a fail-fast
// gate and re-established authoritatively inside the database producer. The
// current TEXT-runtime eligibility signal is a COMPLETED source turn: a turn
// that terminalized as CANCELLED or FAILED never entered the conversation, and
// a turn still in flight has no stable boundary. That signal is NOT the Product
// definition of commitment, and `completed_at` is never read.

import { randomUUID } from 'node:crypto';
import {
  CU_BOUNDARY_EVALUATOR_VERSION,
  CU_COMMITMENT_POLICY_VERSION,
  CommitmentRejectedError,
  MAX_COMMITTABLE_SOURCE_CHARS,
  MAX_SOURCE_EXCERPT_CHARS,
  MAX_UNITS_PER_COMMIT_BATCH,
  type CommitConversationUnitsRequest,
  type CommitmentSource,
  type ProposedCommitUnit,
} from './conversation-unit.types';
import { codePointLength, mapAnchorsToSpans } from './cu-anchor-mapper';
import { CU_SEGMENTATION_PROMPT_VERSION } from './cu-segmentation-provider.config';
import {
  CU_SEGMENTATION_SCHEMA_VERSION,
  CuSegmentationProviderError,
  type CuSegmentationProvider,
} from './cu-segmentation-provider.types';
import { validateNewBatchFrontier, validateUnitStructure } from './cu-span-validator';

export interface CommitmentEvaluationOptions {
  /** Stable identity for this batch. A retry MUST reuse the same value. */
  readonly batchId?: string;
  readonly newUnitId?: () => string;
}

export class ConversationUnitCommitmentService {
  constructor(
    private readonly provider: CuSegmentationProvider,
    private readonly providerName: string,
    private readonly providerModel: string,
  ) {}

  /**
   * Produces the exact payload the durable producer accepts, or throws a typed
   * fail-closed rejection. Nothing is written here.
   *
   * On any provider or validation failure the whole batch is abandoned. The
   * turn is never collapsed to a single CU, and a later batch with a NEW batch
   * id may retry - the frozen grammar allows `1 turn = 0..N committed CUs`.
   */
  async evaluate(
    source: CommitmentSource,
    options: CommitmentEvaluationOptions = {},
  ): Promise<CommitConversationUnitsRequest> {
    // Condition 3 (speaker-state stability) and the v1 source-role domain: role
    // is server-forced and immutable; SYSTEM is not committable.
    if (source.role !== 'USER' && source.role !== 'ASSISTANT') {
      throw new CommitmentRejectedError('UNSUPPORTED_SOURCE_ROLE');
    }
    // Condition 2 (boundary stability): a turn has no continuation mechanism, so
    // a terminal COMPLETED turn is the whole contribution; provisional,
    // cancelled, failed and superseded source is never committable.
    if (source.status !== 'COMPLETED') {
      throw new CommitmentRejectedError('SOURCE_TURN_NOT_COMMITTABLE');
    }
    if (source.channel !== 'TEXT') {
      throw new CommitmentRejectedError('UNSUPPORTED_SOURCE_MODALITY');
    }
    // Condition 1 (source stability) and condition 4 (provenance stability) are
    // structural: `conversation_turns.content` is write-once and the producer
    // re-derives the digest, the span bounds and the committed wording from the
    // locked canonical row.
    const sourceLength = codePointLength(source.content);
    if (sourceLength === 0 || sourceLength > MAX_COMMITTABLE_SOURCE_CHARS) {
      throw new CommitmentRejectedError('SOURCE_TURN_NOT_COMMITTABLE');
    }
    if (!Number.isSafeInteger(source.sourceFrontier) || source.sourceFrontier < 0 || source.sourceFrontier > sourceLength) {
      throw new CommitmentRejectedError('SPAN_BEFORE_SOURCE_FRONTIER');
    }

    let proposal;
    try {
      proposal = await this.provider.propose({
        sourceText: source.content,
        sourceRole: source.role,
        maxUnits: MAX_UNITS_PER_COMMIT_BATCH,
        maxExcerptChars: MAX_SOURCE_EXCERPT_CHARS,
        schemaVersion: CU_SEGMENTATION_SCHEMA_VERSION,
      });
    } catch (error) {
      // Outage, timeout, or malformed structured output. Fail closed with zero
      // committed batches - never a whole-turn fallback CU.
      if (error instanceof CuSegmentationProviderError) throw new CommitmentRejectedError('SEGMENTATION_UNAVAILABLE');
      throw error;
    }

    const mapped = mapAnchorsToSpans(source.content, proposal.units, source.sourceFrontier);
    if (mapped.outcome === 'REJECTED') throw new CommitmentRejectedError(mapped.reason, mapped.index);

    const newUnitId = options.newUnitId ?? randomUUID;
    const units: ProposedCommitUnit[] = mapped.spans.map((span) => ({
      unitId: newUnitId(),
      spanStart: span.start,
      spanEnd: span.end,
    }));

    const structure = validateUnitStructure(source.content, units);
    if (structure.outcome === 'REJECTED') throw new CommitmentRejectedError(structure.reason, structure.index);
    const forward = validateNewBatchFrontier(units, source.sourceFrontier);
    if (forward.outcome === 'REJECTED') throw new CommitmentRejectedError(forward.reason, forward.index);

    return {
      sessionId: source.sessionId,
      userId: source.userId,
      sourceTurnId: source.turnId,
      batchId: options.batchId ?? newUnitId(),
      units,
      evaluatorVersion: CU_BOUNDARY_EVALUATOR_VERSION,
      policyVersion: CU_COMMITMENT_POLICY_VERSION,
      segmentationProvider: this.providerName,
      segmentationModel: this.providerModel,
      segmentationPromptVersion: CU_SEGMENTATION_PROMPT_VERSION,
    };
  }
}
