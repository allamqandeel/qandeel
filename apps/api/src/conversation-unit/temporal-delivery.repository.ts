// T-03A2 - the authenticated temporal read seam, extended ADDITIVELY by T-03D
// with the authoritative current Live Focus and the LF transition catch-up.
//
// Three owner-scoped reads and nothing else:
//
//   * the current Session live state (`LH`, derived from the Session Semantic
//     Clock's `current_sp`, and `LF`, derived from the LF transition history);
//   * committed-CU delivery catch-up;
//   * LF transition delivery catch-up.
//
// All run through the AUTHENTICATED Data API channel with the caller's own
// token, and the database derives the owner from `auth.uid()` - a
// caller-supplied user id is never client authorization. No table carries a
// direct client SELECT grant.
//
// This is a delivery/recovery transport for LH and LF, NOT a Timeline API: it
// returns no committed text, no analysis, no Reading, no Thread name, no Home,
// no same-SP sequence, no K/V and no historical projection. T-03C owns history.

import type { ConversationalUnitsCommittedWireEvent, LiveFocusTransitionWireEvent, SessionTemporalSnapshot } from '@qandeel/runtime';
import type { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { mapLiveFocusValue, mapStoredLiveFocusTransitions } from '../live-focus/conversation-semantic-runtime-mapper';
import { ConversationSemanticIntegrityError } from '../live-focus/conversation-semantic-runtime.types';
import { toLiveFocusTransitionWireEvent, toLiveFocusWireValue } from '../live-focus/live-focus-wire';

/** The maximum number of delivery events one catch-up request may return. */
export const MAX_TEMPORAL_EVENT_PAGE = 256;
export const DEFAULT_TEMPORAL_EVENT_PAGE = 64;

interface SessionLiveStateRow {
  readonly session_id: string;
  readonly live_head: number | null;
  readonly live_focus_kind: string;
  readonly live_focus_ref: string | null;
  readonly live_focus_sp: number | null;
}

interface CommittedEventRow {
  readonly commit_batch_id: string;
  readonly session_id: string;
  readonly source_turn_id: string;
  readonly first_sp: number;
  readonly last_sp: number;
  readonly unit_count: number;
}

interface LiveFocusTransitionRow {
  readonly session_id: string;
  readonly session_position: number;
  readonly to_kind: string;
  readonly to_ref: string | null;
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

const invalidDelivery = (): never => { throw new ConversationSemanticIntegrityError('LIVE_FOCUS_DELIVERY_MISMATCH'); };

export class TemporalDeliveryRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  /**
   * Current Session live truth. `liveHead` is `null` when no user-addressable
   * committed CU exists yet, and then `liveFocus` is `NONE`; zero is never
   * produced. Undefined means the Session is not visible to this caller.
   */
  async getSessionTemporalState(accessToken: string, sessionId: string): Promise<SessionTemporalSnapshot | undefined> {
    const rows = await this.dataApi.request<SessionLiveStateRow[]>(accessToken, 'rpc/get_session_live_state_v1', {
      method: 'POST',
      body: JSON.stringify({ p_session_id: sessionId }),
    });
    const row = rows[0];
    if (!row) return undefined;
    const liveFocus = mapLiveFocusValue(row.live_focus_kind, row.live_focus_ref, invalidDelivery);
    if (row.live_focus_sp !== null && !(Number.isSafeInteger(row.live_focus_sp) && row.live_focus_sp >= 1)) return invalidDelivery();
    if (row.live_head === null && (liveFocus.kind !== 'NONE' || row.live_focus_sp !== null)) return invalidDelivery();
    return { sessionId: row.session_id, liveHead: row.live_head, liveFocus: toLiveFocusWireValue(liveFocus), liveFocusAtSp: row.live_focus_sp };
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

  /**
   * LF transition delivery catch-up, ascending by `atSp`, current Session
   * only, reference identity only. The same cursor rules as the committed-CU
   * catch-up: `afterSp` omitted means the start of available transitions.
   */
  async getLiveFocusEvents(
    accessToken: string,
    sessionId: string,
    page: { afterSp?: number; limit?: number } = {},
  ): Promise<LiveFocusTransitionWireEvent[]> {
    const rows = await this.dataApi.request<LiveFocusTransitionRow[]>(
      accessToken,
      'rpc/get_live_focus_transition_events_v1',
      {
        method: 'POST',
        body: JSON.stringify({
          p_session_id: sessionId,
          p_after_sp: page.afterSp ?? null,
          p_limit: page.limit ?? DEFAULT_TEMPORAL_EVENT_PAGE,
        }),
      },
    );
    if (!Array.isArray(rows)) return invalidDelivery();
    if (rows.some((row) => row.session_id !== sessionId)) return invalidDelivery();
    const transitions = mapStoredLiveFocusTransitions(rows.map((row) => ({ session_position: row.session_position, to_kind: row.to_kind, to_ref: row.to_ref })), invalidDelivery);
    return transitions.map((transition) => toLiveFocusTransitionWireEvent(sessionId, transition));
  }
}
