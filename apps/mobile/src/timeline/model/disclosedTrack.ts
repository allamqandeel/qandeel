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

/** Entitlement is upstream. Accept only an already-disclosed contiguous current-session
 * region; never accept LH, timestamps, history queries or a full-session item count.
 * Copy only SP so caller metadata/mutation cannot affect geometry or accessibility. */
export function disclosedTrack(sessionId: string, targets: readonly DisclosedMomentTarget[]): DisclosedTrack {
  if (!sessionId) throw new TypeError('A current session identity is required');
  const copy = targets.map((target, index) => {
    const sp = target.sessionPosition;
    if (!Number.isSafeInteger(sp) || sp < 1 || (index > 0 && sp !== targets[index - 1].sessionPosition + 1)) {
      throw new RangeError('Disclosed SPs must be safe, positive, contiguous and ascending');
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
