export const MEMORY_TYPES = [
  'STABLE_PREFERENCE',
  'PERSONAL_FACT',
  'GOAL',
  'DECISION_COMMITMENT',
  'RELATIONSHIP_CONTEXT',
  'INTERACTION_PREFERENCE',
  'TEMPORARY_STATE',
  'DERIVED_INSIGHT',
] as const;

export const MEMORY_SOURCES = [
  'USER_STATED',
  'USER_CONFIRMED',
  'SYSTEM_DERIVED',
  'IMPORTED',
  'ADMIN_CONTROLLED',
] as const;

export const MEMORY_STATUSES = [
  'ACTIVE',
  'SUPERSEDED',
  'EXPIRED',
  'DELETED',
  'DISABLED',
  'PENDING_CONFIRMATION',
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];
export type MemorySource = (typeof MEMORY_SOURCES)[number];
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];
export type MemorySubject = 'SELF' | 'OTHER';

/**
 * S8A-03 CP2 (migration 0171): one row of the semantic read - an eligible Memory of the caller, how many of the query's
 * terms it is indexed under, its optional slot, and whether it shares that slot with another CURRENT SELF Memory. Such a
 * Memory is UNSETTLED, never a confirmed conflict: the server cannot tell whether both still hold (two employers) or one
 * replaced the other (a move), so neither is served as the settled answer (CP2 R1).
 */
export interface SemanticMemoryCandidate {
  memory: MemoryRecord;
  hits: number;
  slot: string | null;
  unsettled: boolean;
}

/**
 * S8A-03 Living Personal Memory (migration 0172): one row the knowledge picture is projected from - an eligible Memory
 * of the caller with its subject, optional slot and time standing, and its living state (when the user last stated it,
 * how often a later turn restated it, whether the user explicitly ended it). `unsettled` is the 0171 same-slot rule.
 */
export interface PersonalKnowledgeSource {
  id: string;
  type: MemoryType;
  content: string;
  source: MemorySource;
  importance: number;
  created_at: string;
  expires_at: string | null;
  subject: MemorySubject | null;
  slot: string | null;
  temporal: string | null;
  last_stated_at: string;
  restated_count: number;
  ended: boolean;
  unsettled: boolean;
  /** S8A-03 Open Understanding (0173): whom an OTHER Memory is about, in the user's own words; absent before 0173. */
  person_name?: string | null;
  person_relation?: string | null;
}

export interface MemoryRecord {
  id: string;
  user_id: string;
  scope: 'USER';
  type: MemoryType;
  content: string;
  source: MemorySource;
  confidence: number;
  importance: number;
  status: MemoryStatus;
  version: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  supersedes_memory_id: string | null;
  /**
   * MEM-AR-01C (PD-1, migration 0152): whom the Memory is about, from its append-only attribution. SELF: the user;
   * OTHER: someone else the user told QANDEEL about; null or absent: UNATTRIBUTED - the subject was never established,
   * so it is never personal Evidence.
   */
  subject?: MemorySubject | null;
}

export interface CreateMemoryInput {
  type: MemoryType;
  content: string;
  source: MemorySource;
  confidence: number;
  importance: number;
  status?: MemoryStatus;
  expiresAt?: string;
}

/**
 * The background capture's answer for one turn. WRITE names the Memory this execution recorded (created now, or
 * ALREADY_RECORDED by a replay of the same execution); SKIP says why nothing was written - the evaluator's own reasons,
 * the capture screen's, or the background writer's (MEM-AR-01C: SKIPPED_COMMAND_TURN, EQUIVALENT_EXISTS,
 * SUPERSEDED_BY_LATER_COMMAND).
 */
export type MemoryWriteResult =
  | { decision: 'SKIP'; reason: string; type?: MemoryType }
  | { decision: 'WRITE'; type: MemoryType; memoryId: string; evidenceId: `memory:${string}` };
