import { Injectable } from '@nestjs/common';
import type { EvidenceItem, EvidenceKind } from './evidence.types';
import { MemoryRuntimeService } from './memory-runtime.service';
import type { MemoryRecord, MemoryType } from './memory.types';

export const EVIDENCE_CANDIDATE_LIMIT = 64;
export const MAX_ELIGIBLE_EVIDENCE = 64;

const EVIDENCE_KIND_BY_MEMORY_TYPE: Readonly<
  Record<Exclude<MemoryType, 'DERIVED_INSIGHT'>, EvidenceKind>
> = {
  PERSONAL_FACT: 'USER_STATED_FACT',
  STABLE_PREFERENCE: 'USER_STATED_PREFERENCE',
  GOAL: 'USER_STATED_GOAL',
  DECISION_COMMITMENT: 'USER_STATED_COMMITMENT',
  RELATIONSHIP_CONTEXT: 'USER_STATED_RELATIONSHIP_CONTEXT',
  INTERACTION_PREFERENCE: 'USER_STATED_INTERACTION_PREFERENCE',
  TEMPORARY_STATE: 'USER_STATED_TEMPORARY_STATE',
};

@Injectable()
export class EvidenceService {
  constructor(private readonly memoryRuntime: MemoryRuntimeService) {}

  async listEligibleForUser(
    userId: string,
    accessToken: string,
    now = new Date(),
  ): Promise<ReadonlyArray<EvidenceItem>> {
    const candidates = await this.memoryRuntime.listActiveForUser(
      userId,
      accessToken,
      EVIDENCE_CANDIDATE_LIMIT,
    );
    return projectEligibleEvidence(userId, candidates, now).slice(0, MAX_ELIGIBLE_EVIDENCE);
  }
}

export function projectEligibleEvidence(
  userId: string,
  candidates: ReadonlyArray<MemoryRecord>,
  now = new Date(),
): EvidenceItem[] {
  const seen = new Set<string>();

  return candidates
    .filter((memory) => isEligible(userId, memory, now))
    .sort((left, right) =>
      right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id),
    )
    .filter((memory) => {
      const key = `${memory.type}\u0000${memory.source}\u0000${normalizeExact(memory.content)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((memory) => ({
      evidenceId: `memory:${memory.id}`,
      evidenceKind: EVIDENCE_KIND_BY_MEMORY_TYPE[memory.type as Exclude<MemoryType, 'DERIVED_INSIGHT'>],
      memoryType: memory.type as Exclude<MemoryType, 'DERIVED_INSIGHT'>,
      statement: memory.content,
      source: memory.source as 'USER_STATED' | 'USER_CONFIRMED',
      confidence: memory.confidence,
      importance: memory.importance,
      observedAt: memory.created_at,
      updatedAt: memory.updated_at,
      originatingMemoryId: memory.id,
    }));
}

function isEligible(userId: string, memory: MemoryRecord, now: Date): boolean {
  return memory.user_id === userId &&
    memory.status === 'ACTIVE' &&
    (memory.source === 'USER_STATED' || memory.source === 'USER_CONFIRMED') &&
    memory.type !== 'DERIVED_INSIGHT' &&
    (memory.expires_at === null || new Date(memory.expires_at).getTime() > now.getTime());
}

// The canonical exact-normalization used by the Evidence dedup key. Exported so
// the shared golden parity fixtures can assert it directly against the SQL
// primitive public.canonical_evidence_content_key_v1 (migration 0028). The
// behaviour is unchanged.
export function normalizeExact(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}
