// COSMOS (experimental, isolated) — the absence states.
//
// "Empty" is five different facts. They are kept apart here so no host can collapse them into one sentence.

import type { NasijCamera, NasijView } from './camera';
import { unproject } from './camera';

export type NasijAbsence =
  | { readonly kind: 'NONE' }
  /** The authority has not answered yet. */
  | { readonly kind: 'LOADING' }
  /** The authority could not answer. */
  | { readonly kind: 'UNAVAILABLE' }
  /** The authority refused: no existence is implied either way. */
  | { readonly kind: 'REFUSED' }
  /** A complete read of the whole authorised world returned nothing. */
  | { readonly kind: 'WORLD_EMPTY' }
  /** The world is known to hold entries, but none is in view. `bearing` points at the nearest one known to the client. */
  | { readonly kind: 'REGION_EMPTY'; readonly bearing: { readonly dx: number; readonly dy: number; readonly id: string } | null };

export interface AbsenceFacts {
  readonly status: 'LOADING' | 'READY' | 'UNAVAILABLE' | 'REFUSED';
  /** Entities the client currently holds for display. */
  readonly shown: ReadonlyArray<{ readonly id: string; readonly x: number; readonly y: number }>;
  /**
   * What a WHOLE-WORLD read last established: the entries it returned, or null if no whole-world read has completed.
   * A viewport read never updates this. It is the only evidence that may ever say the world is empty.
   */
  readonly worldIndex: ReadonlyArray<{ readonly id: string; readonly x: number; readonly y: number }> | null;
}

export function absenceOf(facts: AbsenceFacts, camera: NasijCamera, view: NasijView): NasijAbsence {
  if (facts.status === 'LOADING') return { kind: 'LOADING' };
  if (facts.status === 'UNAVAILABLE') return { kind: 'UNAVAILABLE' };
  if (facts.status === 'REFUSED') return { kind: 'REFUSED' };
  const a = unproject(camera, view, 0, 0); const b = unproject(camera, view, view.width, view.height);
  const inView = (p: { x: number; y: number }) => p.x >= a.x && p.x <= b.x && p.y >= a.y && p.y <= b.y;
  if (facts.shown.some(inView)) return { kind: 'NONE' };
  const known = facts.worldIndex ?? [];
  if (facts.worldIndex !== null && known.length === 0 && facts.shown.length === 0) return { kind: 'WORLD_EMPTY' };
  // Nothing in view. Point at the nearest entry the client has actually been served; never invent one.
  const pool = known.length > 0 ? known : facts.shown;
  let best: { dx: number; dy: number; id: string; d: number } | null = null;
  for (const p of pool) {
    const dx = p.x - camera.cx; const dy = p.y - camera.cy; const d = dx * dx + dy * dy;
    if (best === null || d < best.d) best = { dx, dy, id: p.id, d };
  }
  // With no whole-world evidence and nothing held, all that is known is that THIS region is empty.
  return { kind: 'REGION_EMPTY', bearing: best === null ? null : { dx: best.dx, dy: best.dy, id: best.id } };
}
