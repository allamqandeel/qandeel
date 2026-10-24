import { MemoryDataApiService } from './memory-data-api.service';
import { MemoryRetrievalIndexRepository } from './memory-retrieval-index.repository';

// S8A-03 CP2: the semantic read is the caller's own RPC under the user token (0171 retrieve_personal_memory_candidates_v1,
// SECURITY INVOKER + RLS); the server re-checks every row and fails closed on a foreign or retired one.
describe('MemoryRetrievalIndexRepository.retrieveSemanticCandidates (S8A-03 CP2)', () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'm1', user_id: 'user-a', scope: 'USER', type: 'PERSONAL_FACT', content: 'أنا ساكن في المعادي.', source: 'USER_STATED', confidence: 0.8,
    importance: 0.65, status: 'ACTIVE', version: 1, created_at: 'x', updated_at: 'x', expires_at: null, supersedes_memory_id: null,
    subject: 'SELF', hits: 2, slot: 'RESIDENCE', unsettled: false, ...overrides,
  });

  it('posts only the terms and the limit under the user token and maps each row with its subject', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([row()]) } as unknown as jest.Mocked<MemoryDataApiService>;
    const result = await new MemoryRetrievalIndexRepository(dataApi).retrieveSemanticCandidates('token-a', 'user-a', ['سكن', 'معاد'], 12);
    const [token, path, init] = dataApi.request.mock.calls[0];
    expect([token, path]).toEqual(['token-a', 'rpc/retrieve_personal_memory_candidates_v1']);
    expect(JSON.parse(init!.body as string)).toEqual({ p_terms: ['سكن', 'معاد'], p_limit: 12 });
    expect(result).toEqual([{ memory: expect.objectContaining({ id: 'm1', subject: 'SELF', status: 'ACTIVE' }), hits: 2, slot: 'RESIDENCE', unsettled: false }]);
    expect(result[0].memory).not.toHaveProperty('hits');
  });

  it.each([
    [row({ user_id: 'user-b' })], [row({ status: 'FORGOTTEN' })], [row({ hits: '2' })], [row({ unsettled: 'no' })], [row({ slot: 3 })],
  ])('fails closed on a foreign, retired or malformed row %#', async (bad) => {
    const dataApi = { request: jest.fn().mockResolvedValue([bad]) } as unknown as jest.Mocked<MemoryDataApiService>;
    await expect(new MemoryRetrievalIndexRepository(dataApi).retrieveSemanticCandidates('token-a', 'user-a', ['x1'], 12)).rejects.toThrow('MEMORY_SEMANTIC_READ_INTEGRITY');
  });
});

// S8A-03 Open Understanding (0173): the knowledge read is personal_knowledge_sources_v2 - the 0172 read plus the person
// label of someone else's Memory - under the user token (SECURITY INVOKER + RLS), and fails closed on a malformed row.
describe('MemoryRetrievalIndexRepository.readPersonalKnowledgeSources (S8A-03)', () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'm1', type: 'PERSONAL_FACT', content: 'سلمى بقت مدرسة.', source: 'USER_STATED', importance: 0.65, created_at: 'x', expires_at: null,
    subject: 'OTHER', slot: null, temporal: 'CURRENT', last_stated_at: 'x', restated_count: 0, ended: false, unsettled: false,
    person_name: 'سلمى', person_relation: 'مراتي', ...overrides,
  });

  it('posts only the limit under the user token and returns the rows with their person labels', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([row(), row({ id: 'm2', subject: 'SELF', person_name: null, person_relation: null })]) } as unknown as jest.Mocked<MemoryDataApiService>;
    const result = await new MemoryRetrievalIndexRepository(dataApi).readPersonalKnowledgeSources('token-a', 120);
    const [token, path, init] = dataApi.request.mock.calls[0];
    expect([token, path]).toEqual(['token-a', 'rpc/personal_knowledge_sources_v2']);
    expect(JSON.parse(init!.body as string)).toEqual({ p_limit: 120 });
    expect(result.map((r) => [r.id, r.person_name, r.person_relation])).toEqual([['m1', 'سلمى', 'مراتي'], ['m2', null, null]]);
  });

  it.each([[row({ person_name: 3 })], [row({ person_relation: ['مراتي'] })], [row({ person_name: undefined })]])('fails closed on a malformed label %#', async (bad) => {
    const dataApi = { request: jest.fn().mockResolvedValue([bad]) } as unknown as jest.Mocked<MemoryDataApiService>;
    await expect(new MemoryRetrievalIndexRepository(dataApi).readPersonalKnowledgeSources('token-a', 120)).rejects.toThrow('PERSONAL_KNOWLEDGE_READ_INTEGRITY');
  });
});
