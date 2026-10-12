import { Injectable } from '@nestjs/common';
import type { ModelRouterMemoryContext } from '../model-router/model-router.types';
import type { MemoryRecord } from './memory.types';
import { MemoryRuntimeService } from './memory-runtime.service';
import { lightArabicStem, normalizeArabicComparison } from './arabic-text';

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
  // MEM-AR-01A: «إني», «إنه», «إنها» (post-normalization forms) are particles, never what a Memory is about.
  'اني', 'انه', 'انها',
]);
// MEM-AR-01A (G-A1 RC-A2): «بحب» (and «بحبه», «بحبها», which stem to it) says how the user relates to something, not
// what the Memory is about. It never selects a Memory on its own while the query's other words select one.
const NON_DISTINCTIVE_STEMS = new Set(['بحب']);

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
  const distinctive = new Set([...queryTokens].filter((token) => !NON_DISTINCTIVE_STEMS.has(token)));
  const byDistinctive = distinctive.size < queryTokens.size ? rank(distinctive, candidates) : [];
  const ranked = byDistinctive.length > 0 ? byDistinctive : rank(queryTokens, candidates);

  const selected: ModelRouterMemoryContext[] = [];
  const seen = new Set<string>();
  let characters = 0;
  for (const { memory } of ranked) {
    const duplicateKey = normalize(memory.content).trim().replace(/\s+/gu, ' ');
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);
    if (selected.length >= MAX_SELECTED_MEMORIES) break;
    if (characters + memory.content.length > MAX_MEMORY_CONTEXT_CHARACTERS) continue;
    selected.push({ type: memory.type, content: memory.content, source: memory.source, about: aboutOf(memory) });
    characters += memory.content.length;
  }
  return selected;
}

// MEM-AR-01C (MF-2): every served Memory says whom it concerns. Retrieval keeps serving OTHER and UNATTRIBUTED Memories
// (they are the user's own words); only how they are read changes. Scoring, order, bounds and escaping are unchanged.
function aboutOf(memory: MemoryRecord): NonNullable<ModelRouterMemoryContext['about']> {
  return memory.subject === 'SELF' ? 'USER' : memory.subject === 'OTHER' ? 'SOMEONE_ELSE' : 'NOT_RECORDED';
}

function rank(queryTokens: ReadonlySet<string>, candidates: ReadonlyArray<MemoryRecord>): RankedMemory[] {
  return candidates.map((memory): RankedMemory => {
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
}

// MEM-AR-01A: one shared comparison normalizer (tatweel, harakat, hamza / ى / ة folds, Arabic-Indic digits, white
// space) and the established light stem, so «ساكنة» meets a stored «ساكن» and «للهدوء» meets «الهدوء». Lexical only:
// no semantic guess, and the scoring, ordering and bounds above are unchanged.
function normalize(value: string): string {
  return normalizeArabicComparison(value);
}

function tokens(value: string): Set<string> {
  return new Set(normalize(value).match(/[\p{L}\p{N}]+/gu)
    ?.filter((token) => token.length > 1 && !STOP_WORDS.has(token)).map(lightArabicStem).filter((token) => token.length > 1) ?? []);
}
