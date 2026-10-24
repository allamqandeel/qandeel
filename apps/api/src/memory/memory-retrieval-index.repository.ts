import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from './memory-data-api.service';
import { withMemorySubject } from './memory-subject';
import { MEMORY_SOURCES, MEMORY_TYPES, type MemoryRecord, type PersonalKnowledgeSource, type SemanticMemoryCandidate } from './memory.types';

// S8A-03 CP2 — the semantic Memory read (migration 0171), kept apart from MemoryRepository so that repository stays the
// MEM-AR-01C read-only table surface with no RPC at all. This is a READ too: one SECURITY INVOKER function under the
// caller's own token and RLS; it writes nothing and no definer is involved.
@Injectable()
export class MemoryRetrievalIndexRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}

  // S8A-03 CP2 (migration 0171): the semantic read. SECURITY INVOKER under the caller's own RLS, and eligibility
  // (ACTIVE, unexpired, the caller's own) is decided from public.memories at read time - never from the index. A row
  // that is not the caller's ACTIVE Memory is an integrity failure, never filtered into a partial answer.
  async retrieveSemanticCandidates(accessToken: string, userId: string, terms: readonly string[], limit: number): Promise<SemanticMemoryCandidate[]> {
    const rows = await this.dataApi.request<unknown>(accessToken, 'rpc/retrieve_personal_memory_candidates_v1', {
      method: 'POST', body: JSON.stringify({ p_terms: terms, p_limit: limit }),
    });
    if (!Array.isArray(rows)) throw new Error('MEMORY_SEMANTIC_READ_INTEGRITY');
    return rows.map((row: Record<string, unknown>) => {
      if (row?.user_id !== userId || row.status !== 'ACTIVE' || typeof row.hits !== 'number' || typeof row.unsettled !== 'boolean' ||
          !(row.slot === null || typeof row.slot === 'string')) throw new Error('MEMORY_SEMANTIC_READ_INTEGRITY');
      const { hits, slot, unsettled, ...memory } = row;
      return { memory: withMemorySubject(memory as unknown as MemoryRecord), hits: hits as number, slot: slot as string | null, unsettled: unsettled as boolean };
    });
  }

  // S8A-03 Living Personal Memory (migration 0172): the rows the knowledge picture is projected from. SECURITY INVOKER
  // under the caller's own RLS; eligibility (ACTIVE, unexpired, the caller's own, never an Interaction Preference or a
  // Derived Insight) is decided from public.memories at read time. A malformed row is an integrity failure.
  async readPersonalKnowledgeSources(accessToken: string, limit: number): Promise<PersonalKnowledgeSource[]> {
    const rows = await this.dataApi.request<unknown>(accessToken, 'rpc/personal_knowledge_sources_v2', {
      method: 'POST', body: JSON.stringify({ p_limit: limit }),
    });
    if (!Array.isArray(rows) || rows.length > limit) throw new Error('PERSONAL_KNOWLEDGE_READ_INTEGRITY');
    const text = (value: unknown) => typeof value === 'string';
    const nullableText = (value: unknown) => value === null || typeof value === 'string';
    return rows.map((row: Record<string, unknown>) => {
      if (!row || !text(row.id) || !(MEMORY_TYPES as readonly unknown[]).includes(row.type) || !text(row.content) ||
          !(MEMORY_SOURCES as readonly unknown[]).includes(row.source) || typeof row.importance !== 'number' || !text(row.created_at) ||
          !nullableText(row.expires_at) || !(row.subject === null || row.subject === 'SELF' || row.subject === 'OTHER') ||
          !nullableText(row.slot) || !nullableText(row.temporal) || !text(row.last_stated_at) || typeof row.restated_count !== 'number' ||
          typeof row.ended !== 'boolean' || typeof row.unsettled !== 'boolean' ||
          !nullableText(row.person_name) || !nullableText(row.person_relation)) throw new Error('PERSONAL_KNOWLEDGE_READ_INTEGRITY');
      return row as unknown as PersonalKnowledgeSource;
    });
  }
}
