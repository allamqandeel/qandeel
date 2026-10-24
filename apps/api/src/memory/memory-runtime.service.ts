import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { MemoryRepository } from './memory.repository';
import { MemoryRetrievalIndexRepository } from './memory-retrieval-index.repository';
import type { MemoryRecord, PersonalKnowledgeSource, SemanticMemoryCandidate } from './memory.types';

// MEM-AR-01C (migration 0152): the Memory Runtime's reads. Its former create / markDeleted / supersede had no runtime
// caller and wrote through the legacy server commands, whose EXECUTE is now revoked; they are removed. A Memory changes
// only through the conversational command (server_finalize_memory_control_turn_v2) or the background writer
// (background_record_memory_v1), both of which take the owner's equivalence lock and record the subject.
@Injectable()
export class MemoryRuntimeService {
  constructor(
    private readonly repository: MemoryRepository,
    // S8A-03 CP2: always provided by MemoryModule; optional only so hand-built test runtimes keep compiling. Without it the
    // semantic read fails, and the retriever is fail-soft on that failure (the recall path still serves).
    @Optional() private readonly index?: MemoryRetrievalIndexRepository,
  ) {}

  async find(userId: string, accessToken: string, id: string): Promise<MemoryRecord> {
    const memory = await this.repository.find(accessToken, userId, id);
    if (!memory) throw new NotFoundException('Memory not found.');
    return memory;
  }

  listActiveForUser(userId: string, accessToken: string, limit: number): Promise<MemoryRecord[]> {
    return this.repository.listActiveForUser(accessToken, userId, limit);
  }

  /** S8A-03 CP2: the caller's eligible Memories indexed under any of these terms (migration 0171), read-time eligibility. */
  retrieveSemanticCandidates(userId: string, accessToken: string, terms: readonly string[], limit: number): Promise<SemanticMemoryCandidate[]> {
    if (!this.index) return Promise.reject(new Error('MEMORY_RETRIEVAL_INDEX_UNAVAILABLE'));
    return this.index.retrieveSemanticCandidates(accessToken, userId, terms, limit);
  }

  /** S8A-03 Living Personal Memory: the caller's rows the knowledge picture is projected from (migration 0172). */
  readPersonalKnowledgeSources(accessToken: string, limit: number): Promise<PersonalKnowledgeSource[]> {
    if (!this.index) return Promise.reject(new Error('MEMORY_RETRIEVAL_INDEX_UNAVAILABLE'));
    return this.index.readPersonalKnowledgeSources(accessToken, limit);
  }
}
