// T-03A2 - the authenticated temporal read seam.
//
// Two owner-scoped reads and nothing else:
//
//   * the current Session temporal state (`LH`, derived from the Session
//     Semantic Clock's `current_sp`);
//   * committed-CU delivery catch-up.
//
// Both run through the AUTHENTICATED Data API channel with the caller's own
// token, and the database derives the owner from `auth.uid()` - a
// caller-supplied user id is never client authorization. Neither table carries
// a direct client SELECT grant.
//
// This is a delivery/recovery transport for LH, NOT a Timeline API: it returns
// no committed text, no analysis, no Reading, no Thread, no Live Focus, no
// K/V and no historical projection. T-03C owns history.

import type { ConversationalUnitsCommittedWireEvent, SessionTemporalSnapshot } from '@qandeel/runtime';
import type { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** The maximum number of delivery events one catch-up request may return. */
export const MAX_TEMPORAL_EVENT_PAGE = 256;
export const DEFAULT_TEMPORAL_EVENT_PAGE = 64;

interface SessionTemporalStateRow {
  readonly session_id: string;
  readonly live_head: number | null;
}

interface CommittedEventRow {
  readonly commit_batch_id: string;
  readonly session_id: string;
  readonly source_turn_id: string;
  readonly first_sp: number;
  readonly last_sp: number;
  readonly unit_count: number;
}

/** The one place a durable delivery row becomes the frozen wire event. */
export function toCommittedWireEvent(row: CommittedEventRow): ConversationalUnitsCommittedWireEvent {
  return {
    type: 'CONVERSATIONAL_UNITS_COMMITTED',
    version: 1,
    sessionId: row.session_id,
    batchId: row.commit_batch_id,
    sourceTurnId: row.source_turn_id,
    firstSp: row.first_sp,
    lastSp: row.last_sp,
    unitCount: row.unit_count,
  };
}

export class TemporalDeliveryRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  /**
   * Current Session temporal truth. `liveHead` is `null` when no
   * user-addressable committed CU exists yet; zero is never produced.
   * Undefined means the Session is not visible to this caller.
   */
  async getSessionTemporalState(accessToken: string, sessionId: string): Promise<SessionTemporalSnapshot | undefined> {
    const rows = await this.dataApi.request<SessionTemporalStateRow[]>(accessToken, 'rpc/get_session_temporal_state_v1', {
      method: 'POST',
      body: JSON.stringify({ p_session_id: sessionId }),
    });
    const row = rows[0];
    if (!row) return undefined;
    return { sessionId: row.session_id, liveHead: row.live_head };
  }

  /**
   * Committed-CU delivery catch-up, ascending by `firstSp`.
   *
   * `afterSp` omitted means the start of available delivery events. When
   * supplied it is an addressable Session Position >= 1: SP(0) is not a cursor
   * and the database refuses it.
   */
  async getCommittedEvents(
    accessToken: string,
    sessionId: string,
    page: { afterSp?: number; limit?: number } = {},
  ): Promise<ConversationalUnitsCommittedWireEvent[]> {
    const rows = await this.dataApi.request<CommittedEventRow[]>(
      accessToken,
      'rpc/get_conversational_units_committed_events_v1',
      {
        method: 'POST',
        body: JSON.stringify({
          p_session_id: sessionId,
          p_after_sp: page.afterSp ?? null,
          p_limit: page.limit ?? DEFAULT_TEMPORAL_EVENT_PAGE,
        }),
      },
    );
    return rows.map(toCommittedWireEvent);
  }
}
