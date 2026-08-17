import { MemoryDataApiService } from './memory-data-api.service';
import { MemoryRepository } from './memory.repository';

describe('MemoryRepository', () => {
  let dataApi: jest.Mocked<MemoryDataApiService>;
  let repository: MemoryRepository;

  beforeEach(() => {
    dataApi = { request: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<MemoryDataApiService>;
    repository = new MemoryRepository(dataApi);
  });

  it('scopes reads and updates to the authenticated owner', async () => {
    await repository.find('token-a', 'user-a', 'memory-a');
    await repository.update('token-a', 'user-a', 'memory-a', { content: 'updated' });
    await repository.markDeleted('token-a', 'user-a', 'memory-a');
    for (const [, path] of dataApi.request.mock.calls) {
      const query = new URL(`https://local/${path}`).searchParams;
      expect(query.get('id')).toBe('eq.memory-a');
      expect(query.get('user_id')).toBe('eq.user-a');
    }
  });

  it('returns only ACTIVE and unexpired rows from active queries', async () => {
    const now = new Date('2026-08-17T12:00:00.000Z');
    await repository.listActiveForUser('token-a', 'user-a', 32, now);
    const query = new URL(`https://local/${dataApi.request.mock.calls[0][1]}`).searchParams;
    expect(query.get('user_id')).toBe('eq.user-a');
    expect(query.get('status')).toBe('eq.ACTIVE');
    expect(query.get('or')).toBe('(expires_at.is.null,expires_at.gt.2026-08-17T12:00:00.000Z)');
    expect(query.get('limit')).toBe('32');
  });

  it('uses an atomic database operation for supersession without a client user id', async () => {
    await repository.supersede('token-a', 'old', 'new', {
      type: 'PERSONAL_FACT', content: 'new fact', source: 'USER_CONFIRMED', confidence: 1,
      importance: 0.8, status: 'ACTIVE',
    });
    const [token, path, init] = dataApi.request.mock.calls[0];
    expect(token).toBe('token-a');
    expect(path).toBe('rpc/supersede_memory');
    expect(JSON.parse(String(init?.body))).not.toHaveProperty('p_user_id');
  });
});
