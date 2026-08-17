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
  source: Extract<MemorySource, 'USER_STATED' | 'USER_CONFIRMED'>;
  /** Memory extraction confidence; it is not truth probability. */
  confidence: number;
  /** Memory utility metadata; it is not evidential strength. */
  importance: number;
  observedAt: string;
  updatedAt: string;
  originatingMemoryId: string;
}
