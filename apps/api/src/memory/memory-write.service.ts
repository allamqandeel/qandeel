import { Injectable } from '@nestjs/common';
import { MemoryRuntimeService } from './memory-runtime.service';
import {
  MEMORY_WRITE_DUPLICATE_LOOKUP_LIMIT,
  MemoryWriteEvaluatorService,
  normalizeMemoryContent,
} from './memory-write-evaluator.service';
import type { MemoryType } from './memory.types';

export type MemoryWriteResult =
  | { decision: 'SKIP'; reason: string; type?: MemoryType }
  | { decision: 'WRITE'; type: MemoryType; memoryId: string; evidenceId: `memory:${string}` };

@Injectable()
export class MemoryWriteService {
  constructor(
    private readonly evaluator: MemoryWriteEvaluatorService,
    private readonly runtime: MemoryRuntimeService,
  ) {}

  async evaluateAndWrite(userId: string, accessToken: string, currentUserContent: string): Promise<MemoryWriteResult> {
    const decision = this.evaluator.evaluate(currentUserContent);
    if (decision.decision === 'SKIP') return decision;

    const active = await this.runtime.listActiveForUser(userId, accessToken, MEMORY_WRITE_DUPLICATE_LOOKUP_LIMIT);
    const duplicate = active.some((memory) =>
      memory.type === decision.candidate.type &&
      normalizeMemoryContent(memory.content) === normalizeMemoryContent(decision.candidate.content),
    );
    if (duplicate) return { decision: 'SKIP', reason: 'EXACT_NORMALIZED_DUPLICATE', type: decision.candidate.type };

    const created = await this.runtime.create(userId, accessToken, decision.candidate);
    return {
      decision: 'WRITE', type: decision.candidate.type,
      memoryId: created.id, evidenceId: `memory:${created.id}`,
    };
  }
}
