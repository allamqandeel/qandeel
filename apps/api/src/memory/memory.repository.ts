import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from './memory-data-api.service';
import { MemoryServiceRoleApiService } from './memory-service-role-api.service';
import type { CreateMemoryInput, MemoryRecord } from './memory.types';

const MEMORY_FIELDS = 'id,user_id,scope,type,content,source,confidence,importance,status,version,created_at,updated_at,expires_at,supersedes_memory_id';

type ValidatedMemoryInput = Required<Omit<CreateMemoryInput, 'expiresAt'>> & { expiresAt?: string };

// Reads stay on the authenticated owner-scoped path. Every authoritative write
// goes through a narrow, purpose-specific server-only database command over the
// service-role channel: after migration 0026 `authenticated` holds no
// INSERT/UPDATE/DELETE on public.memories and no EXECUTE on the legacy generic
// supersede_memory RPC, so a user token is neither used nor usable as Memory
// write authority here. There is no generic column-update path.
@Injectable()
export class MemoryRepository {
  constructor(
    private readonly dataApi: MemoryDataApiService,
    private readonly serverAuthority: MemoryServiceRoleApiService,
  ) {}

  async create(id: string, userId: string, input: ValidatedMemoryInput): Promise<MemoryRecord> {
    const rows = await this.serverAuthority.rpc<MemoryRecord[]>('server_create_memory_v1', {
      p_user_id: userId, p_memory_id: id, p_type: input.type, p_content: input.content,
      p_source: input.source, p_confidence: input.confidence, p_importance: input.importance,
      p_status: input.status, p_expires_at: input.expiresAt ?? null,
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

  async markDeleted(userId: string, id: string): Promise<MemoryRecord | undefined> {
    const rows = await this.serverAuthority.rpc<MemoryRecord[]>('server_mark_memory_deleted_v1', {
      p_user_id: userId, p_memory_id: id,
    });
    return rows[0];
  }

  async supersede(userId: string, oldMemoryId: string, newMemoryId: string, input: ValidatedMemoryInput): Promise<MemoryRecord | undefined> {
    const rows = await this.serverAuthority.rpc<MemoryRecord[]>('server_supersede_memory_v1', {
      p_user_id: userId, p_old_memory_id: oldMemoryId, p_new_memory_id: newMemoryId,
      p_type: input.type, p_content: input.content, p_source: input.source,
      p_confidence: input.confidence, p_importance: input.importance,
      p_status: input.status, p_expires_at: input.expiresAt ?? null,
    });
    return rows[0];
  }
}
