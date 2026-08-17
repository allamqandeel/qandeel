import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from './memory-data-api.service';
import type { CreateMemoryInput, MemoryRecord } from './memory.types';

const MEMORY_FIELDS = 'id,user_id,scope,type,content,source,confidence,importance,status,version,created_at,updated_at,expires_at,supersedes_memory_id';

@Injectable()
export class MemoryRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}

  async create(accessToken: string, id: string, userId: string, input: Required<Omit<CreateMemoryInput, 'expiresAt'>> & { expiresAt?: string }): Promise<MemoryRecord> {
    const rows = await this.dataApi.request<MemoryRecord[]>(accessToken, 'memories', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id, user_id: userId, scope: 'USER', type: input.type, content: input.content,
        source: input.source, confidence: input.confidence, importance: input.importance,
        status: input.status, expires_at: input.expiresAt ?? null,
      }),
    });
    return rows[0];
  }

  async find(accessToken: string, userId: string, id: string): Promise<MemoryRecord | undefined> {
    const query = new URLSearchParams({ select: MEMORY_FIELDS, id: `eq.${id}`, user_id: `eq.${userId}`, limit: '1' });
    return (await this.dataApi.request<MemoryRecord[]>(accessToken, `memories?${query}`))[0];
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
    return this.dataApi.request<MemoryRecord[]>(accessToken, `memories?${query}`);
  }

  async update(accessToken: string, userId: string, id: string, input: Partial<Pick<MemoryRecord, 'content' | 'confidence' | 'importance' | 'status' | 'expires_at'>>): Promise<MemoryRecord | undefined> {
    const query = new URLSearchParams({ select: MEMORY_FIELDS, id: `eq.${id}`, user_id: `eq.${userId}` });
    const rows = await this.dataApi.request<MemoryRecord[]>(accessToken, `memories?${query}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...input, updated_at: new Date().toISOString() }),
    });
    return rows[0];
  }

  async markDeleted(accessToken: string, userId: string, id: string): Promise<MemoryRecord | undefined> {
    return this.update(accessToken, userId, id, { status: 'DELETED' });
  }

  async supersede(accessToken: string, oldMemoryId: string, newMemoryId: string, input: Required<Omit<CreateMemoryInput, 'expiresAt'>> & { expiresAt?: string }): Promise<MemoryRecord | undefined> {
    const rows = await this.dataApi.request<MemoryRecord[]>(accessToken, 'rpc/supersede_memory', {
      method: 'POST',
      body: JSON.stringify({
        p_old_memory_id: oldMemoryId, p_new_memory_id: newMemoryId, p_type: input.type,
        p_content: input.content, p_source: input.source, p_confidence: input.confidence,
        p_importance: input.importance, p_status: input.status, p_expires_at: input.expiresAt ?? null,
      }),
    });
    return rows[0];
  }
}
