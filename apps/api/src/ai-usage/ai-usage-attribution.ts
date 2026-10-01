import { AsyncLocalStorage } from 'node:async_hooks';
import type { AiProcessingPath } from './ai-usage.types';

// AI-COST-01 - the request-scoped answer to "whose work is this provider call?".
//
// A provider adapter knows its provider and model; it does not know whose turn it is spending on, and the frozen
// adapters must not learn. So the two production entries that start provider work open ONE attribution scope with the
// account they already authenticated or authorized:
//
//   * `ConversationService.createTurn` - the reader's own authenticated request (reply + semantic establishment);
//   * the post-response dispatcher - an execution whose owner the canonical authority has just verified.
//
// The scope carries internal identifiers only. The accounting boundary refuses a provider call that has no scope at
// all (an unattributed production call would be untracked spend), so a new entry point cannot silently bypass the
// ledger: it must open a scope, and a static contract names every place that does.

export interface AiUsageAttribution {
  readonly userId: string;
  /** Canonical correlation, when the entry already holds it; the request correlation fills a gap at call time. */
  readonly sessionId?: string;
  readonly sourceTurnId?: string;
  readonly processingPath?: AiProcessingPath;
}

const attributions = new AsyncLocalStorage<AiUsageAttribution>();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Runs `work` with the account its provider calls are charged to. An attribution that is not made of internal UUIDs
 * opens NO scope: the work itself runs unchanged, and any provider attempt inside it is refused by the accounting
 * boundary before it starts (fail-closed, never an unattributed or mis-attributed call).
 */
export function runWithAiUsageAttribution<T>(attribution: AiUsageAttribution, work: () => T): T {
  const valid = UUID.test(attribution.userId)
    && [attribution.sessionId, attribution.sourceTurnId].every((value) => value === undefined || UUID.test(value));
  return valid ? attributions.run(Object.freeze({ ...attribution }), work) : attributions.exit(work);
}

/** Narrows the open scope to one processing path (the Model Router knows FAST / DEEP per request). */
export function runWithAiUsageProcessingPath<T>(processingPath: AiProcessingPath, work: () => T): T {
  const current = attributions.getStore();
  if (!current) return work();
  return attributions.run(Object.freeze({ ...current, processingPath }), work);
}

export function currentAiUsageAttribution(): AiUsageAttribution | undefined {
  return attributions.getStore();
}
