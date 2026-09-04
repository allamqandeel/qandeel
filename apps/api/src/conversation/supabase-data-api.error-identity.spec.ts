import { DataApiError, parseDataApiUpstreamIdentity, readDataApiUpstreamIdentity } from './supabase-data-api.service';

const response = (body: unknown, json = true) => ({
  json: async () => { if (!json) throw new SyntaxError('not json'); return body; },
}) as unknown as Response;

describe('the bounded opaque Data API upstream identity', () => {
  it('keeps status-only construction source-compatible and identity-free', () => {
    const error = new DataApiError(503);
    expect(error.status).toBe(503);
    expect(error.message).toBe('Data API request failed with status 503.');
    expect(readDataApiUpstreamIdentity(error)).toEqual({});
  });

  it('stores only string fields, opaquely, and hands out fresh copies', () => {
    const error = new DataApiError(500, { databaseCode: '40001', databaseMessage: 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' });
    expect(readDataApiUpstreamIdentity(error)).toEqual({ databaseCode: '40001', databaseMessage: 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' });
    // Not a property of the error: nothing that serializes the error can reach it.
    expect(Object.keys(error)).toEqual(['status']);
    expect(JSON.stringify(error)).not.toContain('40001');
    expect('databaseCode' in error).toBe(false);
    const copy = readDataApiUpstreamIdentity(error);
    (copy as { databaseCode?: string }).databaseCode = 'mutated';
    expect(readDataApiUpstreamIdentity(error).databaseCode).toBe('40001');
    expect(readDataApiUpstreamIdentity(new DataApiError(500, { databaseCode: 40001 as never, databaseMessage: null as never }))).toEqual({});
  });

  it('parses only bounded code/message strings from a PostgREST error body', async () => {
    expect(await parseDataApiUpstreamIdentity(response({ code: '40001', message: 'STALE_CONVERSATIONAL_FOCUS_CONTEXT', details: 'x', hint: 'y' })))
      .toEqual({ databaseCode: '40001', databaseMessage: 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' });
    expect(await parseDataApiUpstreamIdentity(response({ code: 40001, message: ['no'] }))).toEqual({});
    expect(await parseDataApiUpstreamIdentity(response({ code: '', message: 'x'.repeat(513) }))).toEqual({});
    expect(await parseDataApiUpstreamIdentity(response([]))).toEqual({});
    expect(await parseDataApiUpstreamIdentity(response(null))).toEqual({});
    // A malformed or non-JSON body never replaces the transport failure.
    expect(await parseDataApiUpstreamIdentity(response(undefined, false))).toEqual({});
  });
});
