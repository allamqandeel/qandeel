import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MemoryRepository } from './memory.repository';
import { MemoryRuntimeService } from './memory-runtime.service';
import { MEMORY_SOURCES, MEMORY_TYPES, type CreateMemoryInput, type MemoryRecord } from './memory.types';

describe('MemoryRuntimeService', () => {
  let repository: jest.Mocked<MemoryRepository>;
  let runtime: MemoryRuntimeService;
  const base: CreateMemoryInput = {
    type: 'PERSONAL_FACT', content: 'I live in Cairo.', source: 'USER_STATED', confidence: 0.9, importance: 0.7,
  };
  const record = (overrides: Partial<MemoryRecord> = {}): MemoryRecord => ({
    id: '81d1f48c-3f7d-4a6f-8c1b-2a7d9c74b63d', user_id: 'user-a', scope: 'USER',
    type: 'PERSONAL_FACT', content: base.content, source: 'USER_STATED', confidence: 0.9,
    importance: 0.7, status: 'ACTIVE', version: 1, created_at: '2026-08-17T00:00:00.000Z',
    updated_at: '2026-08-17T00:00:00.000Z', expires_at: null, supersedes_memory_id: null, ...overrides,
  });

  beforeEach(() => {
    repository = {
      create: jest.fn(), find: jest.fn(), listActiveForUser: jest.fn(), markDeleted: jest.fn(), supersede: jest.fn(), update: jest.fn(),
    } as unknown as jest.Mocked<MemoryRepository>;
    runtime = new MemoryRuntimeService(repository);
  });

  it('creates an owned USER_STATED ACTIVE memory with a UUID', async () => {
    repository.create.mockImplementation(async (_token, id, userId, input) => record({ id, user_id: userId, status: input.status }));
    const created = await runtime.create('user-a', 'token-a', base);
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
    expect(repository.create).toHaveBeenCalledWith('token-a', created.id, 'user-a', expect.objectContaining({ status: 'ACTIVE' }));
  });

  it.each(MEMORY_TYPES)('accepts canonical type %s', async (type) => {
    repository.create.mockResolvedValue(record({ type }));
    await expect(runtime.create('user-a', 'token-a', { ...base, type })).resolves.toBeDefined();
  });

  it.each(MEMORY_SOURCES)('accepts canonical source %s', async (source) => {
    repository.create.mockResolvedValue(record({ source, status: source === 'SYSTEM_DERIVED' ? 'PENDING_CONFIRMATION' : 'ACTIVE' }));
    await expect(runtime.create('user-a', 'token-a', { ...base, source })).resolves.toBeDefined();
  });

  it('rejects invalid types and sources', async () => {
    await expect(runtime.create('user-a', 'token-a', { ...base, type: 'TRANSCRIPT' as never })).rejects.toBeInstanceOf(BadRequestException);
    await expect(runtime.create('user-a', 'token-a', { ...base, source: 'MODEL_GUESSED' as never })).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['confidence', -0.01], ['confidence', 1.01], ['confidence', Number.NaN],
    ['importance', -0.01], ['importance', 1.01], ['importance', Number.POSITIVE_INFINITY],
  ] as const)('rejects invalid %s value %s', async (field, value) => {
    await expect(runtime.create('user-a', 'token-a', { ...base, [field]: value })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('defaults SYSTEM_DERIVED to PENDING_CONFIRMATION and rejects ACTIVE', async () => {
    repository.create.mockResolvedValue(record({ source: 'SYSTEM_DERIVED', status: 'PENDING_CONFIRMATION' }));
    await runtime.create('user-a', 'token-a', { ...base, source: 'SYSTEM_DERIVED' });
    expect(repository.create).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'user-a', expect.objectContaining({ status: 'PENDING_CONFIRMATION' }));
    await expect(runtime.create('user-a', 'token-a', { ...base, source: 'SYSTEM_DERIVED', status: 'ACTIVE' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows a future expiration and rejects invalid or elapsed expiration', async () => {
    repository.create.mockResolvedValue(record({ type: 'TEMPORARY_STATE', expires_at: '2999-01-01T00:00:00.000Z' }));
    await expect(runtime.create('user-a', 'token-a', { ...base, type: 'TEMPORARY_STATE', expiresAt: '2999-01-01T00:00:00.000Z' })).resolves.toBeDefined();
    await expect(runtime.create('user-a', 'token-a', { ...base, expiresAt: 'invalid' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(runtime.create('user-a', 'token-a', { ...base, expiresAt: '2000-01-01T00:00:00.000Z' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails closed when another user memory is invisible', async () => {
    repository.find.mockResolvedValue(undefined);
    repository.markDeleted.mockResolvedValue(undefined);
    await expect(runtime.find('user-a', 'token-a', 'memory-b')).rejects.toBeInstanceOf(NotFoundException);
    await expect(runtime.markDeleted('user-a', 'token-a', 'memory-b')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates atomic supersession and preserves authenticated ownership', async () => {
    repository.supersede.mockResolvedValue(record({ id: 'successor', version: 2, supersedes_memory_id: 'old' }));
    await expect(runtime.supersede('user-a', 'token-a', 'old', { ...base, content: 'I moved to Alexandria.' }))
      .resolves.toEqual(expect.objectContaining({ user_id: 'user-a', version: 2, supersedes_memory_id: 'old' }));
  });

  it('fails closed for cross-user supersession', async () => {
    repository.supersede.mockResolvedValue(undefined);
    await expect(runtime.supersede('user-a', 'token-a', 'memory-b', base)).rejects.toBeInstanceOf(NotFoundException);
  });
});
