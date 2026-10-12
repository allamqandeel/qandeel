import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from './memory-data-api.service';
import { MEMORY_SUBJECT_EMBED, withMemorySubject } from './memory-subject';
import type { MemoryRecord } from './memory.types';
import type { PendingCorrectionSubjectClarification, PendingMemoryClarification, PendingSubjectClarification } from './memory-control.types';

// MEM-AR-01C: every candidate carries its subject (SELF / OTHER / UNATTRIBUTED), resolved from the embedded attribution.
const MEMORY_FIELDS = `id,user_id,scope,type,content,source,confidence,importance,status,version,created_at,updated_at,expires_at,supersedes_memory_id,${MEMORY_SUBJECT_EMBED}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** The bounded owner-scoped candidate set a conversational Memory command may name. */
export const MEMORY_CONTROL_CANDIDATE_LIMIT = 64;

// W3-MEGA-M (E2E-D-13): reads only, all with the CALLER's token under row-level security AND an explicit owner filter.
// Writes never happen here: the one atomic server command (migration 0152, v2) is called by the Conversation
// repository, because it also finalizes the turn.
@Injectable()
export class MemoryControlRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}

  /** ACTIVE and DISABLED rows (the only ones a command may act on), newest change first. Expiry is applied by the caller. */
  async listControllable(accessToken: string, userId: string, limit = MEMORY_CONTROL_CANDIDATE_LIMIT): Promise<MemoryRecord[]> {
    const query = new URLSearchParams({
      select: MEMORY_FIELDS, user_id: `eq.${userId}`, status: 'in.(ACTIVE,DISABLED)',
      order: 'updated_at.desc,id.desc', limit: String(limit),
    });
    return (await this.dataApi.request<MemoryRecord[]>(accessToken, `memories?${query}`)).map(withMemorySubject);
  }

  async findOwned(accessToken: string, userId: string, ids: readonly string[]): Promise<MemoryRecord[]> {
    if (ids.length === 0) return [];
    if (!ids.every((id) => UUID.test(id))) throw new Error('MEMORY_CONTROL_INVALID_IDENTITY');
    const query = new URLSearchParams({ select: MEMORY_FIELDS, user_id: `eq.${userId}`, id: `in.(${ids.join(',')})` });
    return (await this.dataApi.request<MemoryRecord[]>(accessToken, `memories?${query}`)).map(withMemorySubject);
  }

  /** The clarification the IMMEDIATELY preceding user turn of this Session received and nobody has answered. */
  async findPendingClarification(accessToken: string, sessionId: string, sourceTurnId: string): Promise<PendingMemoryClarification | undefined> {
    const rows = await this.dataApi.request<Array<{
      command_id: unknown; kind: unknown; candidate_memory_ids: unknown; clarified_turn_content: unknown;
    }>>(accessToken, 'rpc/pending_memory_clarification_v1', {
      method: 'POST', body: JSON.stringify({ p_session_id: sessionId, p_source_turn_id: sourceTurnId }),
    });
    if (!Array.isArray(rows) || rows.length === 0) return undefined;
    const [row] = rows;
    if (rows.length !== 1 || typeof row.command_id !== 'string' || !UUID.test(row.command_id)
      || (row.kind !== 'CORRECT' && row.kind !== 'FORGET' && row.kind !== 'DISABLE')
      || !Array.isArray(row.candidate_memory_ids) || row.candidate_memory_ids.length < 1 || row.candidate_memory_ids.length > 3
      || !row.candidate_memory_ids.every((id) => typeof id === 'string' && UUID.test(id))
      || typeof row.clarified_turn_content !== 'string') {
      throw new Error('MEMORY_CONTROL_PENDING_CLARIFICATION_INTEGRITY');
    }
    return {
      commandId: row.command_id, kind: row.kind,
      candidateMemoryIds: row.candidate_memory_ids as string[], clarifiedTurnContent: row.clarified_turn_content,
    };
  }

  /**
   * MEM-AR-01C: the subject question («المعلومة دي عنك إنت، ولا عن حد تاني؟») the IMMEDIATELY preceding user turn of
   * this Session received and nobody has answered, with that question turn's words (migration 0152).
   */
  async findPendingSubjectClarification(accessToken: string, sessionId: string, sourceTurnId: string): Promise<PendingSubjectClarification | undefined> {
    const rows = await this.dataApi.request<Array<{ command_id: unknown; clarified_turn_content: unknown }>>(
      accessToken, 'rpc/pending_memory_subject_clarification_v1', {
        method: 'POST', body: JSON.stringify({ p_session_id: sessionId, p_source_turn_id: sourceTurnId }),
      });
    if (!Array.isArray(rows) || rows.length === 0) return undefined;
    const [row] = rows;
    if (rows.length !== 1 || typeof row.command_id !== 'string' || !UUID.test(row.command_id) || typeof row.clarified_turn_content !== 'string') {
      throw new Error('MEMORY_CONTROL_PENDING_SUBJECT_CLARIFICATION_INTEGRITY');
    }
    return { commandId: row.command_id, clarifiedTurnContent: row.clarified_turn_content };
  }

  /**
   * L-11: the subject question a CORRECTION asked the IMMEDIATELY preceding user turn of this Session and nobody has
   * answered - its own read, never the REMEMBER one - with the fact it names and the correction request's words.
   */
  async findPendingCorrectionSubjectClarification(
    accessToken: string, sessionId: string, sourceTurnId: string,
  ): Promise<PendingCorrectionSubjectClarification | undefined> {
    const rows = await this.dataApi.request<Array<{ command_id: unknown; target_memory_id: unknown; clarified_turn_content: unknown }>>(
      accessToken, 'rpc/pending_memory_correction_subject_clarification_v1', {
        method: 'POST', body: JSON.stringify({ p_session_id: sessionId, p_source_turn_id: sourceTurnId }),
      });
    if (!Array.isArray(rows) || rows.length === 0) return undefined;
    const [row] = rows;
    if (rows.length !== 1 || typeof row.command_id !== 'string' || !UUID.test(row.command_id)
      || typeof row.target_memory_id !== 'string' || !UUID.test(row.target_memory_id) || typeof row.clarified_turn_content !== 'string') {
      throw new Error('MEMORY_CONTROL_PENDING_CORRECTION_SUBJECT_CLARIFICATION_INTEGRITY');
    }
    return { commandId: row.command_id, targetMemoryId: row.target_memory_id, clarifiedTurnContent: row.clarified_turn_content };
  }
}
