/**
 * T-06 — temporal addressability: what may become a temporal target at all.
 *
 * The ONLY Product temporal addressing unit is the Session Position. Nothing here reads a
 * timestamp, a wall clock, a pixel offset, a normalized percentage, a presentation window, a scroll
 * offset, an animation frame, a gesture velocity, a duration, or a server knowledge or validity
 * time. A presentation coordinate may help a reader FIND a disclosed target, and the Timeline
 * bridge turns one into a disclosed target — but by the time temporal intent exists here, the
 * target is an integer Session Position in `[1, LH]` and nothing else.
 *
 * Every refusal fails closed and is typed. `LH = null` is the technical absence sentinel: it is not
 * SP(0), not a Moment and not a target, so before the first mirrored committed Session Position
 * NOTHING is addressable — which is a correct answer, not an error.
 *
 * The frozen distinction between `Moment(LH)` and the Live Edge is structural here:
 * `TemporalTargetIntent` has two shapes and there is no conversion between them. Reaching or
 * selecting SP(LH) can never *become* Live intent, because a `MOMENT` intent has no route into the
 * `LIVE_EDGE` branch anywhere in this layer.
 */
import { effectiveTC, isSessionPosition, sessionPosition, type CanonicalState, type SessionPosition } from '../../state';
import { temporalRejected, type TemporalOutcome, type TemporalRejectionCode } from '../outcome';

/**
 * The Class-A temporal facts a target has to be judged against, and nothing else. Derived from
 * canonical state alone; it carries no projection truth, no presentation state and no preview.
 */
export interface TemporalBounds {
  readonly sessionId: string;
  readonly liveHead: SessionPosition | null;
  readonly mode: 'FOLLOW_LIVE' | 'PINNED';
  /** Effective committed `TC`: `FOLLOW_LIVE → LH`, `PINNED(t) → t`. Derived, never stored. */
  readonly committedTc: SessionPosition | null;
}

export function temporalBounds(state: CanonicalState): TemporalBounds {
  return {
    sessionId: state.session.id,
    liveHead: state.live.LH,
    mode: state.temporal.kind,
    committedTc: effectiveTC(state),
  };
}

/**
 * A temporal intent. `MOMENT(sp)` is an ordinary committed Moment target; `LIVE_EDGE` is a temporal
 * MODE intent. They are different Product facts and this layer never derives one from the other.
 */
export type TemporalTargetIntent =
  | { readonly kind: 'MOMENT'; readonly sp: SessionPosition }
  | { readonly kind: 'LIVE_EDGE' };

export const LIVE_EDGE_INTENT: TemporalTargetIntent = Object.freeze({ kind: 'LIVE_EDGE' });

export type TargetResolution =
  | { readonly ok: true; readonly sp: SessionPosition }
  | { readonly ok: false; readonly code: TemporalRejectionCode; readonly detail: string };

const refuse = (code: TemporalRejectionCode, detail: string): TargetResolution => ({ ok: false, code, detail });

/**
 * Resolves one candidate into a legitimate temporal target, or refuses it. This is the single
 * addressability gate of the layer: preview, relative-forward continuation, the Timeline bridge,
 * the accessible exact-entry route and every commit path go through it.
 */
export function resolveTemporalTarget(bounds: TemporalBounds, candidate: unknown): TargetResolution {
  const lh = bounds.liveHead;
  if (lh === null) {
    return refuse('NO_ADDRESSABLE_POSITION', 'no authoritative committed Session Position has been mirrored (LH = null); nothing is addressable yet');
  }
  if (!isSessionPosition(candidate)) {
    return refuse('NOT_ADDRESSABLE', `${String(candidate)} is not a Session Position: an addressable Moment is an integer >= 1`);
  }
  if (candidate > lh) {
    return refuse('BEYOND_LIVE_HEAD', `Session Position ${candidate} is beyond the Live Head ${lh}; nothing later than LH exists`);
  }
  return { ok: true, sp: candidate };
}

/** True when this Session Position is a legitimate target right now. */
export function isAddressableTarget(bounds: TemporalBounds, candidate: unknown): boolean {
  return resolveTemporalTarget(bounds, candidate).ok;
}

export type ForwardStep =
  | { readonly outcome: 'STEP'; readonly sp: SessionPosition }
  /**
   * The target is already the authoritative Live Head. There is no later addressable Moment, and
   * this is emphatically NOT Live intent: forward continuation stops at `LH` and never converts
   * itself into `FOLLOW_LIVE`.
   */
  | { readonly outcome: 'AT_LIVE_HEAD'; readonly sp: SessionPosition }
  | { readonly outcome: 'REJECTED'; readonly code: TemporalRejectionCode; readonly detail: string };

/**
 * The next legitimate forward target after `from`. Forward continuation is defined over addressable
 * Session Positions and stops at the authoritative Live Head; it never crosses it, never widens the
 * disclosure horizon, and never invents a third temporal mode.
 */
export function nextForwardTarget(bounds: TemporalBounds, from: unknown): ForwardStep {
  const current = resolveTemporalTarget(bounds, from);
  if (!current.ok) return { outcome: 'REJECTED', code: current.code, detail: current.detail };
  const lh = bounds.liveHead;
  if (lh === null || current.sp >= lh) return { outcome: 'AT_LIVE_HEAD', sp: current.sp };
  return { outcome: 'STEP', sp: sessionPosition(current.sp + 1) };
}

/** A refusal rendered as this layer's outcome vocabulary. */
export const targetRefusal = (resolution: Extract<TargetResolution, { ok: false }>): TemporalOutcome =>
  temporalRejected(resolution.code, resolution.detail);
