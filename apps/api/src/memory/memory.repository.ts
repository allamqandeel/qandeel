import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from './memory-data-api.service';
import { MEMORY_SUBJECT_EMBED, withMemorySubject } from './memory-subject';
import type { MemoryRecord } from './memory.types';

const MEMORY_FIELDS = `id,user_id,scope,type,content,source,confidence,importance,status,version,created_at,updated_at,expires_at,supersedes_memory_id,${MEMORY_SUBJECT_EMBED}`;

// Owner-scoped reads only, on the authenticated path. MEM-AR-01C (migration 0152): this repository writes nothing. The
// only authorities that can change a Memory are the conversational command (server_finalize_memory_control_turn_v2,
// called by the Conversation repository) and the background writer (background_record_memory_v1); the legacy writers'
// EXECUTE is revoked from every application role. Every row carries its subject (`subject`), resolved from the embedded
// append-only attribution.
@Injectable()
export class MemoryRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}

  async find(accessToken: string, userId: string, id: string): Promise<MemoryRecord | undefined> {
    const query = new URLSearchParams({ select: MEMORY_FIELDS, id: `eq.${id}`, user_id: `eq.${userId}`, limit: '1' });
    const row = (await this.dataApi.request<MemoryRecord[]>(accessToken, `memories?${query}`))[0];
    return row ? withMemorySubject(row) : undefined;
  }

  async listActiveForUser(accessToken: string, userId: string, limit: number, now = new Date()): Promise<MemoryRecord[]> {
    const query = new URLSearchParams({
      select: MEMORY_FIELDS,
      user_id: `eq.${userId}`,
      status: 'eq.ACTIVE',
      or: `(expires_at.is.null,expires_at.gt.${now.toISOString()})`,
      order: 'updated_at.desc,id.desc',
      limit: String(limit),
    });
    return (await this.dataApi.request<MemoryRecord[]>(accessToken, `memories?${query}`)).map(withMemorySubject);
  }
}
