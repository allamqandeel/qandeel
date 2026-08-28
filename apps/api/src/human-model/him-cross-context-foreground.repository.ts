import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { HimCrossContextForegroundEnvelopeRow } from './him-cross-context-foreground.types';

// QHIA-009: the cross-context foreground transport boundary.
//
// EXACTLY ONE Data API / PostgREST request per turn, against the single narrow
// migration-0058 aggregate RPC, replacing the two independent QHIA-007 and
// QHIA-008 requests that preceded it. The rejected shapes do not exist here
// and cannot: this repository has no second method, no fallback request, no
// retry, and no dependency on HimSituationStressRepository,
// HimDecisionAttentionRepository, HimSessionContextBindingRepository, or
// HimRepository - so "one aggregate plus two direct backups" and "race the
// aggregate against the old reads" are structurally impossible rather than
// merely unused.
//
// The request body carries only the authenticated user and the exact owned
// conversation session: there is no context kind, no context id, no target, no
// metric key, no metric list, and no slot list to supply. Both channels are
// resolved server-side by the two authorities the aggregate wraps.
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
      'rpc/read_him_session_cross_context_foreground_v1',
      {
        method: 'POST',
        body: JSON.stringify({ p_user_id: userId, p_session_id: sessionId }),
      },
    );
    return rows ?? [];
  }
}
