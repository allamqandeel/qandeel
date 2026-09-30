import type { MemoryType } from './memory.types';

// W3-MEGA-M (E2E-D-13) — the bounded vocabulary of a conversational Memory command. It mirrors the database
// vocabulary of migration 0128 exactly (`memory_control_commands_kind_check` and the command's outcome list).

export type MemoryControlKind = 'INSPECT' | 'REMEMBER' | 'CORRECT' | 'FORGET' | 'DISABLE';

/** Outcomes the server may ASK the database to commit. `TARGET_CHANGED` is decided by the database, never asked for. */
export type MemoryControlRequestedOutcome =
  | 'INSPECTED' | 'NOTHING_REMEMBERED'
  | 'REMEMBERED' | 'ALREADY_REMEMBERED' | 'DECLINED_SENSITIVE'
  | 'CORRECTED' | 'ALREADY_CORRECT'
  | 'FORGOTTEN' | 'DISABLED'
  | 'TARGET_NOT_FOUND' | 'TARGET_NOT_SPECIFIED'
  | 'CLARIFICATION_REQUIRED' | 'CLARIFICATION_DECLINED';

export type MemoryControlOutcome = MemoryControlRequestedOutcome | 'TARGET_CHANGED';

export const MEMORY_CONTROL_OUTCOMES: ReadonlySet<MemoryControlOutcome> = new Set<MemoryControlOutcome>([
  'INSPECTED', 'NOTHING_REMEMBERED', 'REMEMBERED', 'ALREADY_REMEMBERED', 'DECLINED_SENSITIVE', 'CORRECTED',
  'ALREADY_CORRECT', 'FORGOTTEN', 'DISABLED', 'TARGET_NOT_FOUND', 'TARGET_NOT_SPECIFIED', 'CLARIFICATION_REQUIRED',
  'CLARIFICATION_DECLINED', 'TARGET_CHANGED',
]);

/** A clarification offers at most this many options (database: `cardinality(candidate_memory_ids) <= 3`). */
export const MAX_CLARIFICATION_OPTIONS = 3;

/**
 * The fully decided command a Conversation turn hands to the ONE atomic database command
 * (`server_finalize_memory_control_turn_v1`). Every id in it came from a canonical owner-scoped read, never from the
 * user's words or a provider. `reply` reports the requested outcome; `replyIfChanged` is what QANDEEL says instead
 * when the database finds the target no longer qualifies under its row lock.
 */
export interface MemoryControlPlan {
  kind: MemoryControlKind;
  outcome: MemoryControlRequestedOutcome;
  targetMemoryId?: string;
  newMemory?: {
    id: string;
    type: MemoryType;
    content: string;
    confidence: number;
    importance: number;
    expiresAt?: string;
  };
  candidateMemoryIds: readonly string[];
  answersCommandId?: string;
  reply: string;
  replyIfChanged?: string;
}

/** The clarification the immediately preceding user turn received, read with the owner's token (migration 0128). */
export interface PendingMemoryClarification {
  commandId: string;
  kind: Exclude<MemoryControlKind, 'INSPECT' | 'REMEMBER'>;
  candidateMemoryIds: readonly string[];
  clarifiedTurnContent: string;
}
