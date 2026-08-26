import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryDataApiService } from './memory-data-api.service';
import { MemoryServiceRoleApiService } from './memory-service-role-api.service';
import { MemoryRepository } from './memory.repository';

describe('MemoryRepository', () => {
  let dataApi: jest.Mocked<MemoryDataApiService>;
  let serverAuthority: jest.Mocked<MemoryServiceRoleApiService>;
  let repository: MemoryRepository;

  beforeEach(() => {
    dataApi = { request: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<MemoryDataApiService>;
    serverAuthority = { rpc: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<MemoryServiceRoleApiService>;
    repository = new MemoryRepository(dataApi, serverAuthority);
  });

  it('scopes authenticated reads to the owner', async () => {
    await repository.find('token-a', 'user-a', 'memory-a');
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

  it('creates through the narrow server command instead of a direct table write', async () => {
    serverAuthority.rpc.mockResolvedValue([{ id: 'memory-a' }]);
    await repository.create('memory-a', 'user-a', {
      type: 'PERSONAL_FACT', content: 'a fact', source: 'USER_STATED', confidence: 1, importance: 0.8, status: 'ACTIVE',
    });
    const [name, body] = serverAuthority.rpc.mock.calls[0];
    expect(name).toBe('server_create_memory_v1');
    expect(body).toEqual({
      p_user_id: 'user-a', p_memory_id: 'memory-a', p_type: 'PERSONAL_FACT', p_content: 'a fact',
      p_source: 'USER_STATED', p_confidence: 1, p_importance: 0.8, p_status: 'ACTIVE', p_expires_at: null,
    });
    // Server-owned columns are derived in the database, never submitted here.
    for (const forbidden of ['p_scope', 'p_version', 'p_created_at', 'p_updated_at', 'p_supersedes_memory_id']) {
      expect(body).not.toHaveProperty(forbidden);
    }
    expect(dataApi.request).not.toHaveBeenCalled();
  });

  it('marks deleted through the narrow owner-checked server command', async () => {
    serverAuthority.rpc.mockResolvedValue([{ id: 'memory-a', status: 'DELETED' }]);
    await repository.markDeleted('user-a', 'memory-a');
    expect(serverAuthority.rpc).toHaveBeenCalledWith('server_mark_memory_deleted_v1', {
      p_user_id: 'user-a', p_memory_id: 'memory-a',
    });
    expect(dataApi.request).not.toHaveBeenCalled();
  });

  it('supersedes through the atomic server command with an explicit owner', async () => {
    await repository.supersede('user-a', 'old', 'new', {
      type: 'PERSONAL_FACT', content: 'new fact', source: 'USER_CONFIRMED', confidence: 1,
      importance: 0.8, status: 'ACTIVE',
    });
    const [name, body] = serverAuthority.rpc.mock.calls[0];
    expect(name).toBe('server_supersede_memory_v1');
    expect(body).toMatchObject({ p_user_id: 'user-a', p_old_memory_id: 'old', p_new_memory_id: 'new' });
    expect(body).not.toHaveProperty('p_version');
    expect(dataApi.request).not.toHaveBeenCalled();
  });

  it('retains no direct authenticated Memory write and no generic update path', () => {
    const source = readFileSync(join(__dirname, 'memory.repository.ts'), 'utf8');
    // Every user-token call is a plain owner-scoped read.
    expect(source).not.toMatch(/dataApi\.request[\s\S]{0,400}?method:\s*'(?:POST|PATCH|PUT|DELETE)'/u);
    // The legacy generic mutation RPC is gone from the authenticated path.
    expect(source).not.toMatch(/rpc\/supersede_memory/u);
    // No broad "update arbitrary columns" method survives.
    expect(MemoryRepository.prototype).not.toHaveProperty('update');
  });
});
