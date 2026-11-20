import { DataApiError, type SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { classifyProjectionFailure, HistoricalProjectionRepository } from './historical-projection.repository';
import { projectionRow, SESSION } from './historical-projection.fixture.spec';
import { HistoricalProjectionIntegrityError, HistoricalProjectionUnavailableError } from './historical-projection.types';

const api = (request: jest.Mock) => ({ request } as unknown as SupabaseDataApiService);
const TOKEN = 'caller-access-token';

describe('the owner-scoped Layer-A read seam (cases 17-22)', () => {
  it('17. calls exactly the ONE projection RPC with the Session and TC, through the caller\'s own token, and maps the row', async () => {
    const request = jest.fn().mockResolvedValue([projectionRow()]);
    const knowledge = await new HistoricalProjectionRepository(api(request)).project(TOKEN, SESSION, 2);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe(TOKEN);
    // COSMOS E-2 Slice A (D-4): the ONE read is the additive V2 (V1 decides; V2 adds each Thread's name and origin).
    expect(request.mock.calls[0][1]).toBe('rpc/get_session_historical_projection_v2');
    expect(JSON.parse(request.mock.calls[0][2].body)).toEqual({ p_session_id: SESSION, p_tc: 2 });
    expect(knowledge.tc).toBe(2);
    expect(knowledge.readings).toHaveLength(1);
  });

  it('18. the database\'s typed refusals become typed unavailability, never UNKNOWN_AT_TC and never a projection', async () => {
    for (const code of ['HISTORICAL_COVERAGE_UNAVAILABLE', 'LIVE_HEAD_NOT_ESTABLISHED', 'HISTORICAL_BASELINE_MISSING', 'SESSION_POSITION_NOT_ADDRESSABLE'] as const) {
      const request = jest.fn().mockRejectedValue(new DataApiError(400, { databaseCode: code === 'SESSION_POSITION_NOT_ADDRESSABLE' ? '22023' : '55000', databaseMessage: code }));
      await expect(new HistoricalProjectionRepository(api(request)).project(TOKEN, SESSION, 2)).rejects.toMatchObject({ name: 'HistoricalProjectionUnavailableError', code });
    }
  });

  it('19. a Session the caller cannot see is NOT VISIBLE: FORBIDDEN, 42501, 401 and 403 all hide existence', async () => {
    for (const error of [new DataApiError(403, { databaseCode: '42501', databaseMessage: 'FORBIDDEN' }), new DataApiError(403, { databaseCode: '42501' }), new DataApiError(401), new DataApiError(403)]) {
      expect(classifyProjectionFailure(error)).toMatchObject({ code: 'SESSION_NOT_VISIBLE' });
    }
    const request = jest.fn().mockResolvedValue([]);
    await expect(new HistoricalProjectionRepository(api(request)).project(TOKEN, SESSION, 2)).rejects.toMatchObject({ code: 'SESSION_NOT_VISIBLE' });
  });

  it('20. any other transport failure is rethrown untouched: no invented refusal, no invented projection', async () => {
    expect(classifyProjectionFailure(new DataApiError(500))).toBeNull();
    expect(classifyProjectionFailure(new Error('network'))).toBeNull();
    const failure = new DataApiError(503);
    const request = jest.fn().mockRejectedValue(failure);
    await expect(new HistoricalProjectionRepository(api(request)).project(TOKEN, SESSION, 2)).rejects.toBe(failure);
  });

  it('21. a row for another Session or another TC, or a malformed row, fails closed', async () => {
    await expect(new HistoricalProjectionRepository(api(jest.fn().mockResolvedValue([projectionRow({ session_id: '99999999-9999-4999-8999-999999999999' })]))).project(TOKEN, SESSION, 2))
      .rejects.toBeInstanceOf(HistoricalProjectionUnavailableError);
    await expect(new HistoricalProjectionRepository(api(jest.fn().mockResolvedValue([projectionRow()]))).project(TOKEN, SESSION, 1))
      .rejects.toBeInstanceOf(HistoricalProjectionUnavailableError);
    await expect(new HistoricalProjectionRepository(api(jest.fn().mockResolvedValue([{ ...projectionRow(), threads: 'not-a-list' }]))).project(TOKEN, SESSION, 2))
      .rejects.toBeInstanceOf(HistoricalProjectionIntegrityError);
  });

  it('22. SP(0), a negative or a non-integer TC never reaches the database', async () => {
    const request = jest.fn();
    for (const tc of [0, -1, 1.5, Number.NaN]) {
      await expect(new HistoricalProjectionRepository(api(request)).project(TOKEN, SESSION, tc)).rejects.toMatchObject({ code: 'SESSION_POSITION_NOT_ADDRESSABLE' });
    }
    expect(request).not.toHaveBeenCalled();
  });
});

describe('COSMOS E-2 Slice C — the user-level CURRENT Personal World read (PO D-5, Option U; migration 0199)', () => {
  const row = { as_of: '2026-11-20T10:00:00.000Z', threads: [{ id: 'thread-1', home: { x: '0', y: '-3' }, name: { text: 'مديري', source: 'GROUNDING_WORDING' }, origin: { sessionId: SESSION, sp: 1 } }] };

  it('calls exactly the ONE current-world RPC through the caller\'s own token, with no Session and no TC, and maps the row', async () => {
    const request = jest.fn().mockResolvedValue([row]);
    const world = await new HistoricalProjectionRepository(api(request)).currentPersonalWorld(TOKEN);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe(TOKEN);
    expect(request.mock.calls[0][1]).toBe('rpc/get_user_current_personal_world_v1');
    expect(JSON.parse(request.mock.calls[0][2].body)).toEqual({});
    expect(world.asOf).toBe('2026-11-20T10:00:00.000Z');
    expect(world.threads).toEqual([{ id: 'thread-1', home: { x: '0', y: '-3' }, name: { text: 'مديري', source: 'GROUNDING_WORDING' }, origin: { sessionId: SESSION, sp: 1 } }]);
  });

  it('a refused caller is NOT VISIBLE; an empty world is one row with no Threads; a malformed or duplicated row fails closed', async () => {
    const refused = jest.fn().mockRejectedValue(new DataApiError(403, { databaseCode: '42501', databaseMessage: 'FORBIDDEN' }));
    await expect(new HistoricalProjectionRepository(api(refused)).currentPersonalWorld(TOKEN)).rejects.toMatchObject({ code: 'SESSION_NOT_VISIBLE' });
    const empty = jest.fn().mockResolvedValue([{ as_of: '2026-11-20T10:00:00.000Z', threads: [] }]);
    await expect(new HistoricalProjectionRepository(api(empty)).currentPersonalWorld(TOKEN)).resolves.toEqual({ asOf: '2026-11-20T10:00:00.000Z', threads: [] });
    const noRow = jest.fn().mockResolvedValue([]);
    await expect(new HistoricalProjectionRepository(api(noRow)).currentPersonalWorld(TOKEN)).rejects.toMatchObject({ code: 'SESSION_NOT_VISIBLE' });
    const twice = jest.fn().mockResolvedValue([{ ...row, threads: [row.threads[0], row.threads[0]] }]);
    await expect(new HistoricalProjectionRepository(api(twice)).currentPersonalWorld(TOKEN)).rejects.toBeInstanceOf(HistoricalProjectionIntegrityError);
    const lifecycle = jest.fn().mockResolvedValue([{ ...row, threads: [{ ...row.threads[0], sessionLifecycle: 'ACTIVE' }] }]);
    await expect(new HistoricalProjectionRepository(api(lifecycle)).currentPersonalWorld(TOKEN)).rejects.toBeInstanceOf(HistoricalProjectionIntegrityError);
    const failure = new DataApiError(503);
    const other = jest.fn().mockRejectedValue(failure);
    await expect(new HistoricalProjectionRepository(api(other)).currentPersonalWorld(TOKEN)).rejects.toBe(failure);
  });
});
