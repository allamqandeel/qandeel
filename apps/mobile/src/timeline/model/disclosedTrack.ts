import type { SessionPosition } from '../../state/classes';

/** Layout pixels, invariant across viewport, content and disclosed count. */
export const TIMELINE_STEP = 48;
export interface DisclosedMomentTarget {
  readonly sessionPosition: SessionPosition;
}
export interface DisclosedTrack {
  readonly sessionId: string;
  readonly targets: readonly DisclosedMomentTarget[];
}

/** Entitlement is upstream. Accept only the COMPLETE already-disclosed current-session
 * prefix SP1..SP(H); never accept LH, timestamps, history queries or a full-session
 * item count. A suffix such as [SP50, SP51] is refused: index 0 is the Track origin,
 * so admitting a suffix would move the origin and silently redefine the geometry,
 * position scale and "first" of the same Moments. Windowing over this prefix is
 * T-05's own work and reduces simultaneity only. The empty Track stays valid.
 * Copy only SP so caller metadata/mutation cannot affect geometry or accessibility. */
export function disclosedTrack(sessionId: string, targets: readonly DisclosedMomentTarget[]): DisclosedTrack {
  if (!sessionId) throw new TypeError('A current session identity is required');
  const copy = targets.map((target, index) => {
    const sp = target.sessionPosition;
    if (!Number.isSafeInteger(sp) || sp < 1 || (index === 0 ? sp !== 1 : sp !== targets[index - 1].sessionPosition + 1)) {
      throw new RangeError('A disclosed Track must be the complete SP1-anchored contiguous ascending prefix');
    }
    return Object.freeze({ sessionPosition: sp });
  });
  return Object.freeze({ sessionId, targets: Object.freeze(copy) });
}

export function itemLayout(_data: unknown, index: number) {
  return { index, length: TIMELINE_STEP, offset: index * TIMELINE_STEP };
}
export const targetKey = (target: DisclosedMomentTarget): string => String(target.sessionPosition);

/** Presentation hit test only; no activation or semantic selection. */
export function hitTest(track: DisclosedTrack, offset: number, viewport: number, x: number): DisclosedMomentTarget | null {
  if (![offset, viewport, x].every(Number.isFinite) || x < 0 || x >= viewport || offset < 0) return null;
  return track.targets[Math.floor((offset + x) / TIMELINE_STEP)] ?? null;
}
