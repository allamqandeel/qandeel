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

// S8A-03 CP2: the ONE atomic capture command (v1 0171, v2 0172; v3 0173 since Open Understanding, CP2 amendment §10).
// Parallel arrays only (no jsonb argument on a Memory writer); the database derives the owner from the execution.
describe('PostResponseIntelligenceRepository.completeUnderstandingCapture', () => {
  const executionId = '10000000-0000-4000-8000-000000000005';
  const originalFetch = globalThis.fetch;
  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  beforeEach(() => { process.env.SUPABASE_URL = 'https://database.example.test/'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key'; });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (saved.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
  });
  const respond = (body: unknown, ok = true) => {
    const mock = jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body });
    globalThis.fetch = mock as unknown as typeof fetch;
    return mock;
  };
  const command = {
    items: [{ memoryId: 'a1', type: 'PERSONAL_FACT' as const, content: 'أنا ساكن في المعادي.', importance: 0.65, expiresAt: null, slot: 'RESIDENCE' as const,
      temporal: 'CURRENT' as const, subject: 'SELF' as const, personName: null, personRelation: null, terms: ['ساكن', 'معاد'] },
    { memoryId: 'a2', type: 'PERSONAL_FACT' as const, content: 'سلمى بقت مدرسة إنجليزي.', importance: 0.65, expiresAt: null, slot: null,
      temporal: 'CURRENT' as const, subject: 'OTHER' as const, personName: 'سلمى', personRelation: 'مراتي', terms: ['مدرس'] }],
    index: [{ memoryId: 'b2', slot: null, temporal: 'CURRENT' as const, terms: ['شغل'] }],
    reaffirmed: ['c3'],
    ended: ['d4'],
    forget: ['e5'],
    corrections: [{ targetMemoryId: 'f6', memoryId: 'g7', type: 'PERSONAL_FACT' as const, content: 'ليلى عندها 8 سنين.', importance: 0.65, slot: null,
      temporal: 'CURRENT' as const, terms: ['ليلى'] }],
    audit: [{ part: 'fact' as const, index: 0, verdict: 'KEPT' }],
  };

  it('sends one service-role RPC with aligned parallel arrays, person labels, forget / correct and the flattened terms', async () => {
    const fetchMock = respond('COMPLETED');
    await expect(new PostResponseIntelligenceRepository().completeUnderstandingCapture(executionId, command)).resolves.toBe('COMPLETED');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://database.example.test/rest/v1/rpc/complete_post_response_personal_capture_v3');
    expect(JSON.parse(init.body)).toEqual({
      p_execution_id: executionId, p_memory_ids: ['a1', 'a2'], p_types: ['PERSONAL_FACT', 'PERSONAL_FACT'],
      p_contents: ['أنا ساكن في المعادي.', 'سلمى بقت مدرسة إنجليزي.'], p_importances: [0.65, 0.65], p_expires_at: [null, null],
      p_slots: ['RESIDENCE', null], p_temporals: ['CURRENT', 'CURRENT'], p_subjects: ['SELF', 'OTHER'],
      p_person_names: [null, 'سلمى'], p_person_relations: [null, 'مراتي'], p_index_memory_ids: ['b2'],
      p_index_slots: [null], p_index_temporals: ['CURRENT'], p_term_memory_ids: ['a1', 'a1', 'a2', 'b2', 'g7'], p_terms: ['ساكن', 'معاد', 'مدرس', 'شغل', 'ليلى'],
      p_reaffirmed_memory_ids: ['c3'], p_ended_memory_ids: ['d4'], p_forget_memory_ids: ['e5'],
      p_correct_memory_ids: ['f6'], p_correct_new_ids: ['g7'], p_correct_types: ['PERSONAL_FACT'], p_correct_contents: ['ليلى عندها 8 سنين.'],
      p_correct_importances: [0.65], p_correct_slots: [null], p_correct_temporals: ['CURRENT'],
    });
    // No identity the database derives itself, no address form (not adopted), and the content-free audit never leaves the API.
    expect(JSON.parse(init.body)).not.toHaveProperty('p_user_id');
    expect(init.body).not.toMatch(/address|audit|KEPT/u);
  });

  it('maps NO_OP and fails closed on any other answer or transport failure', async () => {
    respond('NO_OP');
    await expect(new PostResponseIntelligenceRepository().completeUnderstandingCapture(executionId, command)).resolves.toBe('NO_OP');
    for (const [body, ok] of [[true, true], [null, true], ['COMPLETED', false]] as const) {
      respond(body, ok);
      await expect(new PostResponseIntelligenceRepository().completeUnderstandingCapture(executionId, command)).rejects.toThrow('POST_RESPONSE_DATABASE_UNAVAILABLE');
    }
  });
});
