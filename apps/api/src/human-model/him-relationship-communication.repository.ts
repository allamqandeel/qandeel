import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { HimRelationshipCommunicationSourceRow } from './him-relationship-communication-consumption.types';

// QHIA-011: the Relationship-communication foreground transport boundary.
//
// EXACTLY ONE Data API / PostgREST request per read, against the single narrow
// migration-0060 composition RPC. The forbidden two-round-trip shape (read the
// QHIA-006 binding, await, then read the QHIA-004 metric, await) does not exist
// here and cannot: this repository has no binding method, no metric method, and
// no dependency on HimSessionContextBindingRepository or HimRepository. The
// relationship is resolved server-side inside the RPC, so the application never
// learns a context id in order to ask a second question.
//
// The request body carries only the authenticated user and the exact owned
// conversation session: there is no context kind, no context id, no metric key,
// no metric list, no relationship label, and no target parameter to supply.
//
// This is the independently callable canonical DIRECT authority. The
// Conversation Orchestrator does NOT call it: after QHIA-011 the turn reaches
// Relationship Communication only through the single migration-0060
// aggregate-v3 transport, which wraps this authority server-side.
@Injectable()
export class HimRelationshipCommunicationRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}

  async readSessionRelationshipCommunication(
    token: string,
    userId: string,
    sessionId: string,
  ): Promise<HimRelationshipCommunicationSourceRow[]> {
    const rows = await this.dataApi.request<HimRelationshipCommunicationSourceRow[]>(
      token,
      'rpc/read_him_session_relationship_communication_v1',
      {
        method: 'POST',
        body: JSON.stringify({ p_user_id: userId, p_session_id: sessionId }),
      },
    );
    return rows ?? [];
  }
}
