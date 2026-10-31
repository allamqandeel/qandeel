import type { MemorySource, MemoryType } from './memory.types';

export const EVIDENCE_KINDS = [
  'USER_STATED_FACT',
  'USER_STATED_PREFERENCE',
  'USER_STATED_GOAL',
  'USER_STATED_COMMITMENT',
  'USER_STATED_RELATIONSHIP_CONTEXT',
  'USER_STATED_INTERACTION_PREFERENCE',
  'USER_STATED_TEMPORARY_STATE',
] as const;

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** Internal, provider-neutral input boundary for future intelligence consumers. */
export interface EvidenceItem {
  evidenceId: string;
  evidenceKind: EvidenceKind;
  memoryType: Exclude<MemoryType, 'DERIVED_INSIGHT'>;
  statement: string;
  /** S8B-03 (E3): MACHINE_ASR is evidence too (0186 E1), and its source travels with it to every model boundary (E5). */
  source: Extract<MemorySource, 'USER_STATED' | 'USER_CONFIRMED' | 'MACHINE_ASR'>;
  /** S8B-03 (E5): present on a MACHINE_ASR item only - whether the user later confirmed it in typed text. */
  confirmedByTyping?: boolean;
  /** Memory extraction confidence; it is not truth probability. */
  confidence: number;
  /** Memory utility metadata; it is not evidential strength. */
  importance: number;
  observedAt: string;
  updatedAt: string;
  originatingMemoryId: string;
}
