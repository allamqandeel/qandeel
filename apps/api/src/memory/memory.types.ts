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
