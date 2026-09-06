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
    expect(request.mock.calls[0][1]).toBe('rpc/get_session_historical_projection_v1');
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
