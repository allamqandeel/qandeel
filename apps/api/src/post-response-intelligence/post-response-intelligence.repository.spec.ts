import { PostResponseIntelligenceRepository } from './post-response-intelligence.repository';

// Focused transport contract for the migration-0038 Information Gap sync
// boundary: exactly one narrow service-role RPC carrying only the execution
// identity, a strictly parsed typed result, and sanitized failures. No user
// token, user ID, target list, version, missing code or Question text ever
// leaves the process.
describe('PostResponseIntelligenceRepository.syncInformationGaps', () => {
  const executionId = '10000000-0000-4000-8000-000000000005';
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://database.example.test/';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });

  const respond = (body: unknown, ok = true) => {
    const mock = jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body });
    globalThis.fetch = mock as unknown as typeof fetch;
    return mock;
  };

  it('POSTs only the execution identity to the exact narrow RPC with service-role authority', async () => {
    const mock = respond({ status: 'NO_INFORMATION_GAPS', gaps: [] });
    await expect(new PostResponseIntelligenceRepository().syncInformationGaps(executionId))
      .resolves.toEqual({ status: 'NO_INFORMATION_GAPS', gaps: [] });
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('https://database.example.test/rest/v1/rpc/sync_post_response_information_gaps_v1');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ p_execution_id: executionId });
    expect(init.headers.apikey).toBe('service-role-test-key');
    expect(init.headers.Authorization).toBe('Bearer service-role-test-key');
    const serialized = JSON.stringify({ url, body: init.body, headers: init.headers });
    expect(serialized).not.toMatch(/user_id|hypothesis|target_version|missing_information|question|token|jwt/iu);
  });

  it('returns the strictly parsed typed result for a canonical gap payload', async () => {
    const gaps = [{
      ordinal: 1,
      informationGapId: '20000000-0000-4000-8000-000000000001',
      hypothesisId: '30000000-0000-4000-8000-000000000001',
      targetVersion: 2,
      missingInformationCode: 'UNVERIFIED_ASSUMPTIONS',
    }];
    respond({ status: 'INFORMATION_GAPS_AVAILABLE', gaps });
    await expect(new PostResponseIntelligenceRepository().syncInformationGaps(executionId))
      .resolves.toEqual({ status: 'INFORMATION_GAPS_AVAILABLE', gaps });
  });

  it('returns the bounded QUARANTINED result instead of throwing', async () => {
    respond({ status: 'QUARANTINED', reason: 'SOURCE_INTEGRITY_FAILURE' });
    await expect(new PostResponseIntelligenceRepository().syncInformationGaps(executionId))
      .resolves.toEqual({ status: 'QUARANTINED', reason: 'SOURCE_INTEGRITY_FAILURE' });
  });

  it.each([
    ['an unknown status', { status: 'GAPS_READY', gaps: [] }],
    ['an unparseable gap entry', { status: 'INFORMATION_GAPS_AVAILABLE', gaps: [{ ordinal: 1 }] }],
    ['a bare boolean', true],
  ])('never trusts HTTP 2xx alone: %s is a sanitized failure', async (_label, body) => {
    respond(body);
    await expect(new PostResponseIntelligenceRepository().syncInformationGaps(executionId))
      .rejects.toThrow('POST_RESPONSE_DATABASE_UNAVAILABLE');
  });

  it('sanitizes a non-2xx response', async () => {
    respond({ message: 'permission denied for function sync_post_response_information_gaps_v1' }, false);
    await expect(new PostResponseIntelligenceRepository().syncInformationGaps(executionId))
      .rejects.toThrow('POST_RESPONSE_DATABASE_UNAVAILABLE');
  });

  it('sanitizes a transport-level failure', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED 10.0.0.1:5432')) as unknown as typeof fetch;
    await expect(new PostResponseIntelligenceRepository().syncInformationGaps(executionId))
      .rejects.toThrow('POST_RESPONSE_DATABASE_UNAVAILABLE');
  });

  it('fails closed when the service-role configuration is absent', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const mock = respond({ status: 'NO_INFORMATION_GAPS', gaps: [] });
    await expect(new PostResponseIntelligenceRepository().syncInformationGaps(executionId))
      .rejects.toThrow('POST_RESPONSE_DATABASE_DISABLED');
    expect(mock).not.toHaveBeenCalled();
  });
});
