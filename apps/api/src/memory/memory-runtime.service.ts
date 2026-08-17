import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MemoryRepository } from './memory.repository';
import {
  MEMORY_SOURCES, MEMORY_STATUSES, MEMORY_TYPES,
  type CreateMemoryInput, type MemoryRecord, type MemoryStatus,
} from './memory.types';

@Injectable()
export class MemoryRuntimeService {
  constructor(private readonly repository: MemoryRepository) {}

  async create(userId: string, accessToken: string, input: CreateMemoryInput): Promise<MemoryRecord> {
    const validated = this.validate(input);
    return this.repository.create(accessToken, randomUUID(), userId, validated);
  }

  async find(userId: string, accessToken: string, id: string): Promise<MemoryRecord> {
    const memory = await this.repository.find(accessToken, userId, id);
    if (!memory) throw new NotFoundException('Memory not found.');
    return memory;
  }

  listActiveForUser(userId: string, accessToken: string): Promise<MemoryRecord[]> {
    return this.repository.listActiveForUser(accessToken, userId);
  }

  async markDeleted(userId: string, accessToken: string, id: string): Promise<MemoryRecord> {
    const memory = await this.repository.markDeleted(accessToken, userId, id);
    if (!memory) throw new NotFoundException('Memory not found.');
    return memory;
  }

  async supersede(userId: string, accessToken: string, oldMemoryId: string, input: CreateMemoryInput): Promise<MemoryRecord> {
    const newMemoryId = randomUUID();
    if (newMemoryId === oldMemoryId) throw new BadRequestException('A memory cannot supersede itself.');
    const successor = await this.repository.supersede(accessToken, oldMemoryId, newMemoryId, this.validate(input));
    if (!successor) throw new NotFoundException('Active memory not found.');
    if (successor.user_id !== userId) throw new NotFoundException('Active memory not found.');
    return successor;
  }

  private validate(input: CreateMemoryInput): Required<Omit<CreateMemoryInput, 'expiresAt'>> & { expiresAt?: string } {
    if (!MEMORY_TYPES.includes(input.type)) throw new BadRequestException('Invalid memory type.');
    if (!MEMORY_SOURCES.includes(input.source)) throw new BadRequestException('Invalid memory source.');
    const status: MemoryStatus = input.status ?? (input.source === 'SYSTEM_DERIVED' ? 'PENDING_CONFIRMATION' : 'ACTIVE');
    if (!MEMORY_STATUSES.includes(status)) throw new BadRequestException('Invalid memory status.');
    if (input.source === 'SYSTEM_DERIVED' && status === 'ACTIVE') {
      throw new BadRequestException('System-derived memory requires confirmation before activation.');
    }
    if (typeof input.content !== 'string' || input.content.trim().length === 0) {
      throw new BadRequestException('Memory content is required.');
    }
    this.validateUnitInterval('confidence', input.confidence);
    this.validateUnitInterval('importance', input.importance);
    if (input.expiresAt !== undefined) {
      const expiresAt = new Date(input.expiresAt);
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new BadRequestException('Memory expiration must be a valid future timestamp.');
      }
    }
    return { ...input, content: input.content.trim(), status };
  }

  private validateUnitInterval(name: string, value: number): void {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new BadRequestException(`${name} must be between 0 and 1.`);
    }
  }
}
