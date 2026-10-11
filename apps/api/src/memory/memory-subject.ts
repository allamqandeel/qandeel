import type { MemoryRecord, MemorySubject } from './memory.types';

// MEM-AR-01C (PD-1, migration 0152) — the subject of a Memory as every reader sees it.
//
// A Memory read embeds its append-only attribution through the composite foreign key
// (memory_subject_attributions.(memory_id, user_id) -> memories.(id, user_id)). PostgREST answers the embed as one object,
// a one-element array or nothing, depending on how it classifies the relationship; all three are accepted. Anything else
// - no row, an unknown value, a malformed shape - reads as UNATTRIBUTED (`null`): a subject that is not established is
// never personal Evidence, so the safe reading of doubt is "not about the user".

export const MEMORY_SUBJECT_EMBED = 'memory_subject_attributions(subject)';

type EmbeddedRow = Omit<MemoryRecord, 'subject'> & { memory_subject_attributions?: unknown; subject?: unknown };

export function readMemorySubject(embedded: unknown): MemorySubject | null {
  const row = Array.isArray(embedded) ? (embedded.length === 1 ? embedded[0] : undefined) : embedded;
  if (typeof row !== 'object' || row === null) return null;
  const subject = (row as { subject?: unknown }).subject;
  return subject === 'SELF' || subject === 'OTHER' ? subject : null;
}

/**
 * The record with its subject resolved and the transport embed removed. A row that carries no embed key at all (an
 * in-process double that already speaks `MemoryRecord`) keeps the subject it states, read the same strict way.
 */
export function withMemorySubject(row: EmbeddedRow): MemoryRecord {
  const { memory_subject_attributions: embedded, subject: stated, ...memory } = row;
  const subject = 'memory_subject_attributions' in row ? readMemorySubject(embedded) : readMemorySubject({ subject: stated });
  return { ...memory, subject };
}
