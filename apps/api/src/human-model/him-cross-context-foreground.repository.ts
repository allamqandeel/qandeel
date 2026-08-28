import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { HimCrossContextForegroundEnvelopeRow } from './him-cross-context-foreground.types';

// QHIA-009: the cross-context foreground transport boundary, upgraded by
// QHIA-010 to the migration-0059 aggregate v2 endpoint.
//
// EXACTLY ONE Data API / PostgREST request per turn, against the single narrow
// aggregate RPC, carrying all three already-approved foreground channels. The
// endpoint moved from the two-slot v1 aggregate to the three-slot v2 aggregate
// - it did NOT gain a second call site: QHIA-010 adds ZERO external foreground
// requests. The rejected shapes do not exist here and cannot: this repository
// has no second method, no fallback request, no retry, and no dependency on
// HimSituationStressRepository, HimDecisionAttentionRepository,
// HimGoalMotivationRepository, HimSessionContextBindingRepository, or
// HimRepository - so "aggregate v2 plus a direct Goal read", "aggregate v1 then
// Goal", "keep v1 as a fallback", and "race v2 against v1" are structurally
// impossible rather than merely unused.
//
// The request body carries only the authenticated user and the exact owned
// conversation session: there is no context kind, no context id, no target, no
// metric key, no metric list, and no slot list to supply. All three channels
// are resolved server-side by the authorities the aggregate wraps.
@Injectable()
export class HimCrossContextForegroundRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}

  async readSessionCrossContextForeground(
    token: string,
    userId: string,
    sessionId: string,
  ): Promise<HimCrossContextForegroundEnvelopeRow[]> {
    const rows = await this.dataApi.request<HimCrossContextForegroundEnvelopeRow[]>(
      token,
      'rpc/read_him_session_cross_context_foreground_v2',
      {
        method: 'POST',
        body: JSON.stringify({ p_user_id: userId, p_session_id: sessionId }),
      },
    );
    return rows ?? [];
  }
}
