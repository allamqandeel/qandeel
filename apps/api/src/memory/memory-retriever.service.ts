import { Injectable } from '@nestjs/common';
import type { ModelRouterMemoryContext } from '../model-router/model-router.types';
import type { MemoryRecord } from './memory.types';
import { MemoryRuntimeService } from './memory-runtime.service';

export const MEMORY_CANDIDATE_LIMIT = 32;
export const MAX_SELECTED_MEMORIES = 4;
export const MAX_MEMORY_CONTEXT_CHARACTERS = 2400;

const RECALL_CUES = [
  /\bremember\b/u, /\brecall\b/u, /\bwhat did i tell you\b/u, /\bwe discussed\b/u,
  /فاكر/u, /تفتكر/u, /قلتلك قبل كد[هة]/u, /اتكلمنا قبل كد[هة]/u,
];
const PERSONAL_SIGNALS = [
  /\b(my|mine|i plan|i prefer|i told you|we discussed)\b/u,
  /(بتاعي|شغلي|خطتي|هدفي|بحب|بفضل|صاحبي|صاحبتي)/u,
];
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'what', 'did', 'i', 'you', 'about', 'my', 'to', 'we', 'it',
  'فاكر', 'تفتكر', 'لما', 'قلتلك', 'قبل', 'كده', 'عن', 'في', 'من', 'على', 'انا', 'إيه', 'ايه',
]);

interface RankedMemory { memory: MemoryRecord; relevance: number; score: number }

@Injectable()
export class MemoryRetrieverService {
  constructor(private readonly runtime: MemoryRuntimeService) {}

  shouldRetrieve(content: string): boolean {
    const normalized = normalize(content);
    return RECALL_CUES.some((cue) => cue.test(normalized)) || PERSONAL_SIGNALS.some((signal) => signal.test(normalized));
  }

  async retrieve(userId: string, accessToken: string, content: string): Promise<ReadonlyArray<ModelRouterMemoryContext>> {
    if (!this.shouldRetrieve(content)) return [];
    const candidates = await this.runtime.listActiveForUser(userId, accessToken, MEMORY_CANDIDATE_LIMIT);
    return selectMemories(content, candidates);
  }
}

export function selectMemories(query: string, candidates: ReadonlyArray<MemoryRecord>): ReadonlyArray<ModelRouterMemoryContext> {
  const queryTokens = tokens(query);
  const ranked = candidates.map((memory): RankedMemory => {
    const memoryTokens = tokens(memory.content);
    const matches = [...queryTokens].filter((token) => memoryTokens.has(token)).length;
    const relevance = queryTokens.size === 0 ? 0 : matches / queryTokens.size;
    return {
      memory,
      relevance,
      score: relevance * 100 + memory.importance * 5 + memory.confidence * 2,
    };
  }).filter(({ relevance }) => relevance > 0)
    .sort((left, right) =>
      right.score - left.score ||
      right.relevance - left.relevance ||
      right.memory.updated_at.localeCompare(left.memory.updated_at) ||
      left.memory.id.localeCompare(right.memory.id),
    );

  const selected: ModelRouterMemoryContext[] = [];
  const seen = new Set<string>();
  let characters = 0;
  for (const { memory } of ranked) {
    const duplicateKey = normalize(memory.content).trim().replace(/\s+/gu, ' ');
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);
    if (selected.length >= MAX_SELECTED_MEMORIES) break;
    if (characters + memory.content.length > MAX_MEMORY_CONTEXT_CHARACTERS) continue;
    selected.push({ type: memory.type, content: memory.content, source: memory.source });
    characters += memory.content.length;
  }
  return selected;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase('und')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/gu, '')
    .replace(/[أإآ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه');
}

function tokens(value: string): Set<string> {
  return new Set(normalize(value).match(/[\p{L}\p{N}]+/gu)?.filter((token) => token.length > 1 && !STOP_WORDS.has(token)) ?? []);
}
