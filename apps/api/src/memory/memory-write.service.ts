import { Injectable } from '@nestjs/common';
import { MemoryRuntimeService } from './memory-runtime.service';
import {
  MEMORY_WRITE_DUPLICATE_LOOKUP_LIMIT,
  MemoryWriteEvaluatorService,
  normalizeMemoryContent,
} from './memory-write-evaluator.service';
import type { MemoryType } from './memory.types';
import { interpretMemoryControl } from './memory-control.interpreter';

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
    // W3-MEGA-M: an explicit conversational Memory command is never re-applied by inference.
    if (interpretMemoryControl(currentUserContent)) return { decision: 'SKIP', reason: 'MEMORY_CONTROL_COMMAND' };

    const active = await this.runtime.listActiveForUser(userId, accessToken, MEMORY_WRITE_DUPLICATE_LOOKUP_LIMIT);
    const duplicate = active.some((memory) =>
      memory.type === decision.candidate.type &&
      normalizeMemoryContent(memory.content) === normalizeMemoryContent(decision.candidate.content),
    );
    if (duplicate) return { decision: 'SKIP', reason: 'EXACT_NORMALIZED_DUPLICATE', type: decision.candidate.type };

    // The access token scopes the duplicate lookup only; the write itself is a
    // server-authority command that never carries a caller credential.
    const created = await this.runtime.create(userId, decision.candidate);
    return {
      decision: 'WRITE', type: decision.candidate.type,
      memoryId: created.id, evidenceId: `memory:${created.id}`,
    };
  }
}
