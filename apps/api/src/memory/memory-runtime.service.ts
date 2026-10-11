import { Injectable, NotFoundException } from '@nestjs/common';
import { MemoryRepository } from './memory.repository';
import type { MemoryRecord } from './memory.types';

// MEM-AR-01C (migration 0152): the Memory Runtime's reads. Its former create / markDeleted / supersede had no runtime
// caller and wrote through the legacy server commands, whose EXECUTE is now revoked; they are removed. A Memory changes
// only through the conversational command (server_finalize_memory_control_turn_v2) or the background writer
// (background_record_memory_v1), both of which take the owner's equivalence lock and record the subject.
@Injectable()
export class MemoryRuntimeService {
  constructor(private readonly repository: MemoryRepository) {}

  async find(userId: string, accessToken: string, id: string): Promise<MemoryRecord> {
    const memory = await this.repository.find(accessToken, userId, id);
    if (!memory) throw new NotFoundException('Memory not found.');
    return memory;
  }

  listActiveForUser(userId: string, accessToken: string, limit: number): Promise<MemoryRecord[]> {
    return this.repository.listActiveForUser(accessToken, userId, limit);
  }
}
