import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { HimDecisionAttentionSourceRow } from './him-decision-attention-consumption.types';

// QHIA-008: the Decision-attention foreground transport boundary.
//
// EXACTLY ONE Data API / PostgREST request per read, against the single narrow
// migration-0057 composition RPC. The forbidden two-round-trip shape
// (read the QHIA-006 binding, await, then read the QHIA-004 metric, await)
// does not exist here and cannot: this repository has no binding method, no
// metric method, and no dependency on HimSessionContextBindingRepository or
// HimRepository. The Decision is resolved server-side inside the RPC, so the
// application never learns a context id in order to ask a second question.
//
// The request body carries only the authenticated user and the exact owned
// conversation session: there is no context kind, no context id, no metric
// key, no metric list, and no target parameter to supply.
@Injectable()
export class HimDecisionAttentionRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}

  async readSessionDecisionAttention(
    token: string,
    userId: string,
    sessionId: string,
  ): Promise<HimDecisionAttentionSourceRow[]> {
    const rows = await this.dataApi.request<HimDecisionAttentionSourceRow[]>(
      token,
      'rpc/read_him_session_decision_attention_v1',
      {
        method: 'POST',
        body: JSON.stringify({ p_user_id: userId, p_session_id: sessionId }),
      },
    );
    return rows ?? [];
  }
}
