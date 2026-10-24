// S8A-04 CP2 — the provider-neutral Shared knowledge recall (Controlled Amendment §3, M2): which of what one Shared World
// already knows bears on its conversation right now.
//
// Among hundreds of positions held by the same people, "who" does not tell them apart, a message that has no place yet has
// no map neighbourhood, recency misses the old position that still matters, and a lexical index would be the keyword engine
// the Product Owner excluded — so the model chooses (§3.1). It receives the World's knowledge as labelled entries (K1…Kn)
// and the newest messages; it answers refs only, decoded strictly HERE against the refs it was given. It never sees an
// identity, and it never decides what a reply may know: the knowledge read already holds only what every current recipient
// may see. Nothing here logs anything.
import type { recallEntry } from './shared-world-knowledge';
import { SHARED_RECALL_REFS_MAX } from './shared-world-knowledge';

export const SHARED_KNOWLEDGE_RECALL_CONTRACT = 'SHARED_KNOWLEDGE_RECALL_V1' as const;

/** The recall's ENTIRE input (§10 M2 data). */
export interface SharedKnowledgeRecallInput {
  readonly contract: typeof SHARED_KNOWLEDGE_RECALL_CONTRACT;
  readonly knowledge: ReadonlyArray<ReturnType<typeof recallEntry>>;
  readonly conversation: ReadonlyArray<{ readonly from: string; readonly text: string }>;
}

export interface SharedKnowledgeRecaller {
  recall(input: SharedKnowledgeRecallInput, signal: AbortSignal): Promise<unknown>;
}

export const SHARED_KNOWLEDGE_RECALLER = Symbol('SHARED_KNOWLEDGE_RECALLER');

export class SharedKnowledgeRecallUnavailableError extends Error {
  constructor() {
    super('Shared knowledge recall is unavailable.');
    this.name = 'SharedKnowledgeRecallUnavailableError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Exactly `{ refs }`: at most eight distinct refs of the given knowledge, or null. */
export function decodeSharedKnowledgeRecall(value: unknown, input: SharedKnowledgeRecallInput): string[] | null {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !Array.isArray(value.refs) || value.refs.length > SHARED_RECALL_REFS_MAX) return null;
  const known = new Set(input.knowledge.map((entry) => entry.ref));
  if (!value.refs.every((ref) => typeof ref === 'string' && known.has(ref)) || new Set(value.refs).size !== value.refs.length) return null;
  return [...(value.refs as string[])];
}

/**
 * The deterministic test recaller (NODE_ENV=test only): it chooses the oldest eight refs it was given. It reads no words
 * and is never a production fallback.
 */
export class FakeSharedKnowledgeRecaller implements SharedKnowledgeRecaller {
  async recall(input: SharedKnowledgeRecallInput): Promise<unknown> {
    return { refs: input.knowledge.slice(0, SHARED_RECALL_REFS_MAX).map((entry) => entry.ref) };
  }
}

/** Refuses: the reply then takes the safe path (§3.2.5). Never a fallback that reads the words. */
export class UnconfiguredSharedKnowledgeRecaller implements SharedKnowledgeRecaller {
  async recall(): Promise<unknown> {
    throw new SharedKnowledgeRecallUnavailableError();
  }
}
