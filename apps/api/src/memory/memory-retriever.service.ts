import { Injectable } from '@nestjs/common';
import type { ModelRouterMemoryContext } from '../model-router/model-router.types';
import type { MemoryRecord, SemanticMemoryCandidate } from './memory.types';
import { MemoryRuntimeService } from './memory-runtime.service';
import { normalizeArabicComparison } from './arabic-text';
import { lexicalMemoryTokens, MAX_RETRIEVAL_QUERY_TERMS, memoryRetrievalTerms } from './memory-retrieval-terms';

export const MEMORY_CANDIDATE_LIMIT = 32;
export const MAX_SELECTED_MEMORIES = 4;
export const MAX_MEMORY_CONTEXT_CHARACTERS = 2400;
/** S8A-03 CP2: the most indexed Memories one semantic read asks for (0171 caps it at 12, plus the other UNSETTLED Memories of a matched slot). */
export const SEMANTIC_CANDIDATE_LIMIT = 12;

const RECALL_CUES = [
  /\bremember\b/u, /\brecall\b/u, /\bwhat did i tell you\b/u, /\bwe discussed\b/u,
  /فاكر/u, /تفتكر/u, /قلتلك قبل كد[هة]/u, /اتكلمنا قبل كد[هة]/u,
];
const PERSONAL_SIGNALS = [
  /\b(my|mine|i plan|i prefer|i told you|we discussed)\b/u,
  /(بتاعي|شغلي|خطتي|هدفي|بحب|بفضل|صاحبي|صاحبتي)/u,
];
// MEM-AR-01A (G-A1 RC-A2): «بحب» (and «بحبه», «بحبها», which stem to it) says how the user relates to something, not
// what the Memory is about. It never selects a Memory on its own while the query's other words select one.
const NON_DISTINCTIVE_STEMS = new Set(['بحب']);

interface Candidate { memory: MemoryRecord; hits: number; slot: string | null; unsettled: boolean }
interface RankedMemory extends Candidate { relevance: number; score: number }

@Injectable()
export class MemoryRetrieverService {
  constructor(private readonly runtime: MemoryRuntimeService) {}

  shouldRetrieve(content: string): boolean {
    const normalized = normalize(content);
    return RECALL_CUES.some((cue) => cue.test(normalized)) || PERSONAL_SIGNALS.some((signal) => signal.test(normalized));
  }

  // S8A-03 CP2 (Founder option B): two paths, and no model call at read time.
  //   * The recall path, unchanged: an explicit recall cue or personal signal still reads the 32 most recent eligible
  //     Memories and ranks them lexically.
  //   * The semantic path, on EVERY turn that has a content word: the 0171 index answers the caller's eligible Memories
  //     indexed under the message's terms - their own words and the semantic keys the background proposed - wherever
  //     they sit in time, so neither «فاكر» nor the last-32 window decides whether a Memory can be found.
  // The semantic path is additive and fail-soft: an index failure serves the recall path alone, never an error.
  async retrieve(userId: string, accessToken: string, content: string): Promise<ReadonlyArray<ModelRouterMemoryContext>> {
    const recall = this.shouldRetrieve(content);
    const terms = memoryRetrievalTerms(content).slice(0, MAX_RETRIEVAL_QUERY_TERMS);
    if (!recall && terms.length === 0) return [];
    const [recent, semantic] = await Promise.all([
      recall ? this.runtime.listActiveForUser(userId, accessToken, MEMORY_CANDIDATE_LIMIT) : Promise.resolve([]),
      terms.length > 0 ? this.semantic(userId, accessToken, terms) : Promise.resolve([]),
    ]);
    return selectMemories(content, recent, semantic);
  }

  private async semantic(userId: string, accessToken: string, terms: readonly string[]): Promise<SemanticMemoryCandidate[]> {
    try {
      return await this.runtime.retrieveSemanticCandidates(userId, accessToken, terms, SEMANTIC_CANDIDATE_LIMIT);
    } catch {
      return [];
    }
  }
}

export function selectMemories(
  query: string,
  allCandidates: ReadonlyArray<MemoryRecord>,
  semantic: ReadonlyArray<SemanticMemoryCandidate> = [],
): ReadonlyArray<ModelRouterMemoryContext> {
  // S8A-03 CP2: one candidate per Memory; an indexed row adds how many query terms it is indexed under and its same-slot
  // standing. With no indexed rows this is exactly the MEM-AR-01A selection.
  const byId = new Map<string, Candidate>();
  for (const memory of allCandidates) byId.set(memory.id, { memory, hits: 0, slot: null, unsettled: false });
  for (const row of semantic) byId.set(row.memory.id, { memory: row.memory, hits: row.hits, slot: row.slot, unsettled: row.unsettled });
  // IP-IMP-01 (WP4): a legacy INTERACTION_PREFERENCE Memory never steers a reply. The canonical Interaction Preferences
  // record is the ONE preference authority, so an old Memory can neither override it nor revive a preference the owner
  // reset. The Memory itself is untouched: still listed, exported, correctable and forgettable by its owner.
  const candidates = [...byId.values()].filter(({ memory }) => memory.type !== 'INTERACTION_PREFERENCE');
  const queryTokens = tokens(query);
  const termCount = memoryRetrievalTerms(query).length;
  const distinctive = new Set([...queryTokens].filter((token) => !NON_DISTINCTIVE_STEMS.has(token)));
  const byDistinctive = distinctive.size < queryTokens.size ? rank(distinctive, candidates, termCount) : [];
  const ranked = byDistinctive.length > 0 ? byDistinctive : rank(queryTokens, candidates, termCount);

  const selected: ModelRouterMemoryContext[] = [];
  const seen = new Set<string>();
  let characters = 0;
  const keyOf = (candidate: Candidate) => normalize(candidate.memory.content).trim().replace(/\s+/gu, ' ');
  for (const candidate of ranked) {
    if (selected.length >= MAX_SELECTED_MEMORIES) break;
    if (seen.has(keyOf(candidate))) continue;
    // S8A-03 CP2 (R2): an UNSETTLED current fact is never served alone. It and every other UNSETTLED Memory of its slot
    // are ONE unit, served whole only when the whole unit fits the explicit bounds - MAX_SELECTED_MEMORIES and
    // MAX_MEMORY_CONTEXT_CHARACTERS - and otherwise not at all, so the reply never sees one side as the settled answer
    // and the bounds are never exceeded (Founder CP2 condition 3).
    const unit = candidate.unsettled && candidate.slot !== null
      ? [candidate, ...candidates.filter((other) => other !== candidate && other.unsettled && other.slot === candidate.slot)]
      : [candidate];
    const fresh = unit.filter((member, index) => !seen.has(keyOf(member)) && unit.findIndex((other) => keyOf(other) === keyOf(member)) === index);
    const length = fresh.reduce((sum, member) => sum + member.memory.content.length, 0);
    if (selected.length + fresh.length > MAX_SELECTED_MEMORIES || characters + length > MAX_MEMORY_CONTEXT_CHARACTERS) {
      if (unit.length === 1) seen.add(keyOf(candidate));
      continue;
    }
    for (const member of fresh) {
      const { memory } = member;
      seen.add(keyOf(member));
      selected.push({
        type: memory.type, content: memory.content, source: memory.source, about: aboutOf(memory),
        ...(member.unsettled ? { standing: 'UNSETTLED' as const } : {}),
      });
    }
    characters += length;
  }
  return selected;
}

// MEM-AR-01C (MF-2): every served Memory says whom it concerns. Retrieval keeps serving OTHER and UNATTRIBUTED Memories
// (they are the user's own words); only how they are read changes. Scoring, order, bounds and escaping are unchanged.
function aboutOf(memory: MemoryRecord): NonNullable<ModelRouterMemoryContext['about']> {
  return memory.subject === 'SELF' ? 'USER' : memory.subject === 'OTHER' ? 'SOMEONE_ELSE' : 'NOT_RECORDED';
}

// S8A-03 CP2: relevance is the MEM-AR-01A lexical share plus, for an indexed Memory, the share of the message's
// retrieval terms it is indexed under (its own words and its semantic keys), capped at one. The order is unchanged.
function rank(queryTokens: ReadonlySet<string>, candidates: ReadonlyArray<Candidate>, termCount: number): RankedMemory[] {
  return candidates.map((candidate): RankedMemory => {
    const { memory } = candidate;
    const memoryTokens = tokens(memory.content);
    const matches = [...queryTokens].filter((token) => memoryTokens.has(token)).length;
    const lexical = queryTokens.size === 0 ? 0 : matches / queryTokens.size;
    const indexed = candidate.hits > 0 && termCount > 0 ? Math.min(1, candidate.hits / termCount) : 0;
    const relevance = lexical + indexed;
    return {
      ...candidate,
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
// no semantic guess, and the scoring, ordering and bounds above are unchanged. The tokenizer itself now lives in
// memory-retrieval-terms.ts (S8A-03 CP2), unchanged, so the semantic index uses the same normalization.
function normalize(value: string): string {
  return normalizeArabicComparison(value);
}

function tokens(value: string): Set<string> {
  return lexicalMemoryTokens(value);
}
