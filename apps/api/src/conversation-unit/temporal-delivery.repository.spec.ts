import type { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { DEFAULT_TEMPORAL_EVENT_PAGE, TemporalDeliveryRepository, toCommittedWireEvent } from './temporal-delivery.repository';

function dataApi(rows: unknown) {
  const request = jest.fn().mockResolvedValue(rows);
  return { request, api: { request } as unknown as SupabaseDataApiService };
}

const ROW = {
  commit_batch_id: 'batch-1',
  session_id: 'session-1',
  source_turn_id: 'turn-1',
  first_sp: 20,
  last_sp: 23,
  unit_count: 4,
};

describe('the authenticated temporal read seam', () => {
  it('reads the Session temporal state through the owner-scoped definer command', async () => {
    const { request, api } = dataApi([{ session_id: 'session-1', live_head: 12 }]);
    await expect(new TemporalDeliveryRepository(api).getSessionTemporalState('token-a', 'session-1'))
      .resolves.toEqual({ sessionId: 'session-1', liveHead: 12 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('token-a');
    expect(request.mock.calls[0][1]).toBe('rpc/get_session_temporal_state_v1');
    // The caller supplies no user id: the database derives the owner from auth.uid().
    expect(JSON.parse(request.mock.calls[0][2].body as string)).toEqual({ p_session_id: 'session-1' });
  });

  it('returns the technical absence sentinel, never a zero Live Head', async () => {
    const { api } = dataApi([{ session_id: 'session-1', live_head: null }]);
    await expect(new TemporalDeliveryRepository(api).getSessionTemporalState('token-a', 'session-1'))
      .resolves.toEqual({ sessionId: 'session-1', liveHead: null });
  });

  it('reports an invisible Session as absent rather than inventing one', async () => {
    const { api } = dataApi([]);
    await expect(new TemporalDeliveryRepository(api).getSessionTemporalState('token-a', 'session-x')).resolves.toBeUndefined();
  });

  it('maps a durable delivery row onto the frozen wire event and nothing else', () => {
    expect(toCommittedWireEvent(ROW)).toEqual({
      type: 'CONVERSATIONAL_UNITS_COMMITTED',
      version: 1,
      sessionId: 'session-1',
      batchId: 'batch-1',
      sourceTurnId: 'turn-1',
      firstSp: 20,
      lastSp: 23,
      unitCount: 4,
    });
    const serialized = JSON.stringify(toCommittedWireEvent({ ...ROW, ...{ created_at: 'now', user_id: 'user-1' } }));
    for (const forbidden of ['created_at', 'user_id', 'committed_text', 'liveFocus', 'thread', 'reading', 'confidence']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('requests the catch-up page with an explicit cursor and a bounded limit', async () => {
    const { request, api } = dataApi([ROW]);
    const events = await new TemporalDeliveryRepository(api).getCommittedEvents('token-a', 'session-1', { afterSp: 7, limit: 32 });
    expect(events).toHaveLength(1);
    expect(events[0].lastSp).toBe(23);
    expect(request.mock.calls[0][1]).toBe('rpc/get_conversational_units_committed_events_v1');
    expect(JSON.parse(request.mock.calls[0][2].body as string)).toEqual({
      p_session_id: 'session-1', p_after_sp: 7, p_limit: 32,
    });
  });

  it('omits the cursor as null when catching up from the start of delivery', async () => {
    const { request, api } = dataApi([]);
    await new TemporalDeliveryRepository(api).getCommittedEvents('token-a', 'session-1');
    expect(JSON.parse(request.mock.calls[0][2].body as string)).toEqual({
      p_session_id: 'session-1', p_after_sp: null, p_limit: DEFAULT_TEMPORAL_EVENT_PAGE,
    });
  });

  it('preserves the delivered order', async () => {
    const { api } = dataApi([
      { ...ROW, commit_batch_id: 'a', first_sp: 1, last_sp: 2, unit_count: 2 },
      { ...ROW, commit_batch_id: 'b', first_sp: 3, last_sp: 3, unit_count: 1 },
    ]);
    const events = await new TemporalDeliveryRepository(api).getCommittedEvents('token-a', 'session-1');
    expect(events.map((event) => event.batchId)).toEqual(['a', 'b']);
  });

  it('never reaches the service-role channel: temporal reads are owner-scoped', () => {
    const source = `${TemporalDeliveryRepository.prototype.getSessionTemporalState.toString()}\n${TemporalDeliveryRepository.prototype.getCommittedEvents.toString()}`;
    expect(source).not.toMatch(/serviceApi|SERVICE_ROLE/u);
    expect(source).toMatch(/dataApi\.request/u);
  });
});
