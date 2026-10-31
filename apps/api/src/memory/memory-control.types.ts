import type { MemorySubject, MemoryType } from './memory.types';

// W3-MEGA-M (E2E-D-13) — the bounded vocabulary of a conversational Memory command. It mirrors the database
// vocabulary exactly (`memory_control_commands_kind_check` and the outcome lists of migrations 0128 and 0152).

export type MemoryControlKind = 'INSPECT' | 'REMEMBER' | 'CORRECT' | 'FORGET' | 'DISABLE';

/**
 * MEM-AR-01B (PD-2): the shape of a natural reversal, which is only ever a `CORRECT` (no new kind, no new outcome).
 * NO_LONGER «مبقتش X» and STOPPED «بطلت X» negate a remembered fact; BECAME «بقيت Y» states a new value for it.
 */
export type NaturalReversal = 'NO_LONGER' | 'STOPPED' | 'BECAME';

/**
 * Outcomes the server may ASK the database to commit (`server_finalize_memory_control_turn_v2`, migration 0152).
 * MEM-AR-01C: `SUBJECT_CLARIFICATION_REQUIRED` asks whom a remember request is about, and (L-11) whom the new value of a
 * correction of an UNATTRIBUTED fact is about, when that value is already remembered with an established subject.
 */
export type MemoryControlRequestedOutcome =
  | 'INSPECTED' | 'NOTHING_REMEMBERED'
  | 'REMEMBERED' | 'DECLINED_SENSITIVE' | 'SUBJECT_CLARIFICATION_REQUIRED'
  | 'CORRECTED' | 'ALREADY_CORRECT'
  | 'FORGOTTEN' | 'DISABLED'
  | 'TARGET_NOT_FOUND' | 'TARGET_NOT_SPECIFIED'
  | 'CLARIFICATION_REQUIRED' | 'CLARIFICATION_DECLINED'
  // S8B-03 (0186, E8): a spoken command the voice message did not carry clearly enough - nothing changes (C-54).
  | 'NOT_HEARD_CLEARLY';

/**
 * Outcomes the database DECIDES under its locks and never takes from the caller: `TARGET_CHANGED` (0128), and
 * (MEM-AR-01C) `ALREADY_REMEMBERED` / `RECONFIRMED` for a remember request and `CORRECTED_TO_EXISTING` for a
 * correction whose new value is already remembered.
 */
export type MemoryControlDecidedOutcome = 'TARGET_CHANGED' | 'ALREADY_REMEMBERED' | 'RECONFIRMED' | 'CORRECTED_TO_EXISTING';

export type MemoryControlOutcome = MemoryControlRequestedOutcome | MemoryControlDecidedOutcome;

export const MEMORY_CONTROL_OUTCOMES: ReadonlySet<MemoryControlOutcome> = new Set<MemoryControlOutcome>([
  'INSPECTED', 'NOTHING_REMEMBERED', 'REMEMBERED', 'ALREADY_REMEMBERED', 'DECLINED_SENSITIVE', 'CORRECTED',
  'ALREADY_CORRECT', 'FORGOTTEN', 'DISABLED', 'TARGET_NOT_FOUND', 'TARGET_NOT_SPECIFIED', 'CLARIFICATION_REQUIRED',
  'CLARIFICATION_DECLINED', 'TARGET_CHANGED',
  'SUBJECT_CLARIFICATION_REQUIRED', 'RECONFIRMED', 'CORRECTED_TO_EXISTING',
  'NOT_HEARD_CLEARLY',
]);

/** S8B-03 (E8): the ASR confidence band of a voice turn (migration 0183 / 0186). */
export type MemoryCommandVoiceBand = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * S8B-03 (E8): the voice source of a Memory command, read from the database (`server_read_memory_command_voice_v1`):
 * the band of the turn being answered and of the turn whose words are kept (the turn that asked the pending question, or
 * the turn itself). `null` is a typed turn. finalize v2 re-reads both under its locks and refuses anything else.
 */
export interface MemoryCommandVoiceSource {
  turnBand: MemoryCommandVoiceBand | null;
  originBand: MemoryCommandVoiceBand | null;
}

/** Reads the voice source of this turn; `answersCommandId` names the question it answers, if any. */
export type MemoryCommandVoiceReader = (answersCommandId: string | undefined) => Promise<MemoryCommandVoiceSource>;

/** A clarification offers at most this many options (database: `cardinality(candidate_memory_ids) <= 3`). */
export const MAX_CLARIFICATION_OPTIONS = 3;

/**
 * The fully decided command a Conversation turn hands to the ONE atomic database command
 * (`server_finalize_memory_control_turn_v2`, migration 0152). Every id in it came from a canonical owner-scoped read,
 * never from the user's words or a provider. `reply` reports the requested outcome; `replyIfChanged` is what QANDEEL
 * says instead when the database finds the target no longer qualifies under its row lock; `replyIfExisting` (a
 * remember or a correction) is what it says when the database finds the new fact already remembered
 * (ALREADY_REMEMBERED / CORRECTED_TO_EXISTING). `subject` is the subject screen's decisive answer for the new Memory;
 * a correction without one inherits its target's subject in the database. `equivalentMemoryId` is the remembered
 * Memory this server read found equivalent to the new fact, if any.
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
  subject?: MemorySubject;
  equivalentMemoryId?: string;
  reply: string;
  replyIfChanged?: string;
  replyIfExisting?: string;
}

/** The clarification the immediately preceding user turn received, read with the owner's token (migration 0128). */
export interface PendingMemoryClarification {
  commandId: string;
  kind: Exclude<MemoryControlKind, 'INSPECT' | 'REMEMBER'>;
  candidateMemoryIds: readonly string[];
  clarifiedTurnContent: string;
}

/** MEM-AR-01C: the subject question the immediately preceding user turn received, with that turn's words (migration 0152). */
export interface PendingSubjectClarification {
  commandId: string;
  clarifiedTurnContent: string;
}

/**
 * L-11: the subject question a correction asked the immediately preceding user turn, with the exact fact it names and the
 * words of the request that asked for the correction (migration 0152).
 */
export interface PendingCorrectionSubjectClarification {
  commandId: string;
  targetMemoryId: string;
  clarifiedTurnContent: string;
}
