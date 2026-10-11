import { NotFoundException } from '@nestjs/common';
import { MemoryRepository } from './memory.repository';
import { MemoryRuntimeService } from './memory-runtime.service';
import type { MemoryRecord } from './memory.types';

describe('MemoryRuntimeService', () => {
  let repository: jest.Mocked<MemoryRepository>;
  let runtime: MemoryRuntimeService;
  const record = (overrides: Partial<MemoryRecord> = {}): MemoryRecord => ({
    id: '81d1f48c-3f7d-4a6f-8c1b-2a7d9c74b63d', user_id: 'user-a', scope: 'USER',
    type: 'PERSONAL_FACT', content: 'I live in Cairo.', source: 'USER_STATED', confidence: 0.9,
    importance: 0.7, status: 'ACTIVE', version: 1, created_at: '2026-08-17T00:00:00.000Z',
    updated_at: '2026-08-17T00:00:00.000Z', expires_at: null, supersedes_memory_id: null, subject: 'SELF', ...overrides,
  });

  beforeEach(() => {
    repository = { find: jest.fn(), listActiveForUser: jest.fn() } as unknown as jest.Mocked<MemoryRepository>;
    runtime = new MemoryRuntimeService(repository);
  });

  it('reads an owned Memory with the caller token', async () => {
    repository.find.mockResolvedValue(record());
    await expect(runtime.find('user-a', 'token-a', 'memory-a')).resolves.toEqual(record());
    expect(repository.find).toHaveBeenCalledWith('token-a', 'user-a', 'memory-a');
  });

  it('fails closed when another user memory is invisible', async () => {
    repository.find.mockResolvedValue(undefined);
    await expect(runtime.find('user-a', 'token-a', 'memory-b')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists the owner\'s active Memories through the bounded owner-scoped read', async () => {
    repository.listActiveForUser.mockResolvedValue([record()]);
    await expect(runtime.listActiveForUser('user-a', 'token-a', 64)).resolves.toHaveLength(1);
    expect(repository.listActiveForUser).toHaveBeenCalledWith('token-a', 'user-a', 64);
  });

  it('MEM-AR-01C: exposes no Memory mutation (writes belong to finalize v2 and background_record_memory_v1)', () => {
    for (const writer of ['create', 'markDeleted', 'supersede']) expect(MemoryRuntimeService.prototype).not.toHaveProperty(writer);
  });
});
