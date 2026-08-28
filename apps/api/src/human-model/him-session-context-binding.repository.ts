import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { HimCrossContextKind, HimSessionContextBindingSourceRow } from './him-session-context-binding.types';

// QHIA-006: the separate Runtime-relevance repository. Deliberately NOT part
// of HimRepository - that boundary is measurement-read-oriented, while this
// one carries the explicit session-to-cross-context binding authority.
//
// Every method is exactly ONE Data API request against exactly one of the
// three narrow migration-0055 RPCs. There is no per-kind loop, no direct
// table route, no free-text input, and no dependency on any measurement
// repository. All authority - authentication, exact ownership, session
// runtime state, kind/target integrity, idempotency, race safety, and the
// protected lifecycle - lives in the database commands themselves.
@Injectable()
export class HimSessionContextBindingRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}

  async setBinding(
    token: string,
    userId: string,
    sessionId: string,
    contextKind: HimCrossContextKind,
    contextId: string,
  ): Promise<HimSessionContextBindingSourceRow> {
    const rows = await this.dataApi.request<HimSessionContextBindingSourceRow[]>(
      token,
      'rpc/set_him_session_context_binding_v1',
      {
        method: 'POST',
        body: JSON.stringify({
          p_user_id: userId,
          p_session_id: sessionId,
          p_context_kind: contextKind,
          p_context_id: contextId,
        }),
      },
    );
    return rows?.[0] as HimSessionContextBindingSourceRow;
  }

  async clearBinding(
    token: string,
    userId: string,
    sessionId: string,
    contextKind: HimCrossContextKind,
  ): Promise<HimSessionContextBindingSourceRow | undefined> {
    const rows = await this.dataApi.request<HimSessionContextBindingSourceRow[]>(
      token,
      'rpc/clear_him_session_context_binding_v1',
      {
        method: 'POST',
        body: JSON.stringify({
          p_user_id: userId,
          p_session_id: sessionId,
          p_context_kind: contextKind,
        }),
      },
    );
    return rows?.[0];
  }

  async readActiveBindings(
    token: string,
    userId: string,
    sessionId: string,
  ): Promise<HimSessionContextBindingSourceRow[]> {
    const rows = await this.dataApi.request<HimSessionContextBindingSourceRow[]>(
      token,
      'rpc/read_him_session_context_bindings_v1',
      {
        method: 'POST',
        body: JSON.stringify({ p_user_id: userId, p_session_id: sessionId }),
      },
    );
    return rows ?? [];
  }
}
