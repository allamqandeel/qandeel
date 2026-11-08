import type { VoiceByteRange } from './private-audio-object.store';

/**
 * One `bytes=` range of an object of `size` bytes (RFC 9110 §14.1.2): `a-b`, `a-` or `-n`. No header, a malformed one, or
 * several ranges: null (the whole object, 200). A well-formed range that cannot be satisfied: 'UNSATISFIABLE' (416).
 *
 * S8B-07 CP1-B: a leaf of its own (moved unchanged from `voice-media.service.ts`, which re-exports it), so the Replay
 * Media Service reuses it without loading the Voice Media service or its service-role repository.
 */
export function parseByteRange(header: unknown, size: number): VoiceByteRange | null | 'UNSATISFIABLE' {
  if (typeof header !== 'string') return null;
  const match = /^bytes=(\d*)-(\d*)$/u.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;
  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix === 0) return 'UNSATISFIABLE';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return 'UNSATISFIABLE';
  return { start, end };
}
