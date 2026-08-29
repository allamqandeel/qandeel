import { Injectable } from '@nestjs/common';
import { HimBrainContextRepository } from './him-brain-context.repository';
import { HIM_UUID, HIM_V1_STRUCTURED_SCALE_MAX, HIM_V1_STRUCTURED_SCALE_MIN } from './him-contextual-current-projection';
import {
  HIM_BRAIN_CONTEXT_MAX_SIGNALS,
  himBrainContextRegistryEntry,
  type HimBrainContext,
  type HimBrainContextForegroundRow,
  type HimBrainContextNumericValue,
} from './him-brain-context.types';

// QHIA-012: the narrow foreground Brain Context consumption boundary.
//
// One repository call - and therefore exactly ONE external Data API request -
// yields the already-materialized, already-revalidated signals of the
// IMMEDIATELY preceding canonical USER turn. This service:
//
//   * infers no relevance and binds no context;
//   * rereads no metric, no measurement, no snapshot and no binding;
//   * calls no canonical-latest authority and no QHIA-004 batch;
//   * derives no freshness, confidence, trend, improvement, worsening,
//     baseline, decay, average, score, ranking or correlation;
//   * never substitutes an older materialization, an older value, a sibling
//     metric, a family average, or any inferred value;
//   * caches nothing across turns and writes nothing anywhere.
//
// It validates the transport fail-closed and then STRIPS every internal
// identity - context ids, source turn id, slot ordinals, database identities -
// before the result can reach a provider.
//
// Absence is a first-class answer: zero surviving signals returns undefined, so
// the caller omits the provider field entirely rather than sending an empty
// block to prove the feature ran.
@Injectable()
export class HimBrainContextService {
  constructor(private readonly repository: HimBrainContextRepository) {}

  async read(
    userId: string,
    token: string,
    sessionId: string,
    currentTurnId: string,
  ): Promise<HimBrainContext | undefined> {
    if (typeof userId !== 'string' || !HIM_UUID.test(userId)) throw new Error('INVALID_BRAIN_CONTEXT_REQUEST');
    if (typeof sessionId !== 'string' || !HIM_UUID.test(sessionId)) throw new Error('INVALID_BRAIN_CONTEXT_REQUEST');
    if (typeof currentTurnId !== 'string' || !HIM_UUID.test(currentTurnId)) throw new Error('INVALID_BRAIN_CONTEXT_REQUEST');

    return this.consumeSourceRows(await this.repository.readBrainContextForTurn(token, userId, sessionId, currentTurnId));
  }

  // The PURE Brain Context consumption boundary: raw migration-0061 rows in,
  // provider-safe advisory context (or nothing) out, no transport of any kind.
  //
  // Every rule below is fail-closed integrity, never interpretation. A malformed
  // row is an INTEGRITY_FAILURE rather than a silently repaired or dropped
  // signal, because a Brain Context answer that quietly loses a slot is
  // indistinguishable from one whose binding was legitimately cleared.
  consumeSourceRows(rows: HimBrainContextForegroundRow[]): HimBrainContext | undefined {
    if (!Array.isArray(rows)) throw new Error('INTEGRITY_FAILURE');
    // Zero surviving signals is the authoritative empty answer: no previous
    // turn, an unusable previous turn, no durable materialization, an
    // authoritative NO_HIM_BRAIN_CONTEXT, or every materialized signal dropped
    // by the current-binding revalidation all arrive here as zero rows.
    if (rows.length === 0) return undefined;
    if (rows.length > HIM_BRAIN_CONTEXT_MAX_SIGNALS) throw new Error('INTEGRITY_FAILURE');

    const signals: HimBrainContext['signals'][number][] = [];
    let previousSlotOrder = 0;
    for (const row of rows) {
      if (row === null || typeof row !== 'object') throw new Error('INTEGRITY_FAILURE');
      // Fixed registry order and no duplicate slot, proven by one rule.
      if (typeof row.slot_order !== 'number' || row.slot_order <= previousSlotOrder) throw new Error('INTEGRITY_FAILURE');
      previousSlotOrder = row.slot_order;
      const entry = himBrainContextRegistryEntry(row.slot_order);
      if (!entry) throw new Error('INTEGRITY_FAILURE');
      // Each slot answers for exactly its one frozen context kind: a GOAL
      // reading can never arrive under a DECISION slot.
      if (row.slot !== entry.slot || row.context_kind !== entry.contextKind) throw new Error('INTEGRITY_FAILURE');
      // The context identity is verified for integrity and then deliberately
      // DROPPED: it never reaches the provider-facing contract below.
      if (typeof row.context_id !== 'string' || !HIM_UUID.test(row.context_id)) throw new Error('INTEGRITY_FAILURE');
      if (
        typeof row.numeric_value !== 'number' || !Number.isSafeInteger(row.numeric_value)
        || row.numeric_value < HIM_V1_STRUCTURED_SCALE_MIN || row.numeric_value > HIM_V1_STRUCTURED_SCALE_MAX
      ) throw new Error('INTEGRITY_FAILURE');
      // The exact persisted semantic mapping is preserved, never coerced - the
      // same rule the shared QHIA-004 projection already applies. hgs.purpose
      // alignment@1 is legitimately RESOLVED / ALIGNMENT while the other seven
      // frozen slots are legitimately UNRESOLVED / null, so both branches are
      // valid and neither is forced into the other.
      if (row.semantic_mapping_status === 'RESOLVED') {
        if (typeof row.semantic_type !== 'string' || row.semantic_type.length === 0) throw new Error('INTEGRITY_FAILURE');
      } else if (row.semantic_mapping_status === 'UNRESOLVED') {
        if (row.semantic_type !== null) throw new Error('INTEGRITY_FAILURE');
      } else {
        throw new Error('INTEGRITY_FAILURE');
      }
      // This channel assesses neither, ever.
      if (row.freshness_state !== 'UNASSESSED' || row.confidence_state !== 'UNASSESSED') throw new Error('INTEGRITY_FAILURE');
      signals.push({
        slot: entry.slot,
        numericValue: row.numeric_value as HimBrainContextNumericValue,
        semanticMappingStatus: row.semantic_mapping_status,
        semanticType: row.semantic_type,
        freshnessState: 'UNASSESSED',
        confidenceState: 'UNASSESSED',
      });
    }

    return {
      contractVersion: 1,
      source: 'QANDEEL_HIM_BRAIN_CONTEXT_V1',
      availability: 'AVAILABLE',
      signals,
    };
  }
}
