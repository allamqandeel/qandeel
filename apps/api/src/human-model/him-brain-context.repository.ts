import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { HimBrainContextForegroundRow } from './him-brain-context.types';

// QHIA-012: the foreground Brain Context transport boundary.
//
// EXACTLY ONE Data API / PostgREST request per eligible turn, against the single
// narrow migration-0061 authenticated RPC. This repository has no second method,
// no per-slot request, no binding request, no metric request, no fallback
// request and no retry - so "one request per slot", "read the bindings first",
// "reread the metric to check freshness" and "fall back to an older turn" are
// structurally impossible here rather than merely unused.
//
// The request body carries only the authenticated user, the exact owned
// conversation session, and the exact current USER turn. There is no context
// kind, no context id, no target, no metric key, no metric list, no slot list,
// no previous-turn id and no registry to supply: the immediate-previous-turn
// selection, the durable-result recovery and the CURRENT-binding revalidation
// are all resolved server-side by the authorities migration 0061 composes.
@Injectable()
export class HimBrainContextRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}

  async readBrainContextForTurn(
    token: string,
    userId: string,
    sessionId: string,
    currentTurnId: string,
  ): Promise<HimBrainContextForegroundRow[]> {
    const rows = await this.dataApi.request<HimBrainContextForegroundRow[]>(
      token,
      'rpc/read_him_brain_context_for_turn_v1',
      {
        method: 'POST',
        body: JSON.stringify({ p_user_id: userId, p_session_id: sessionId, p_current_turn_id: currentTurnId }),
      },
    );
    return rows ?? [];
  }
}
