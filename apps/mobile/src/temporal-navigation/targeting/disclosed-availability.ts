/**
 * T-06 — disclosed interaction availability, which is NOT canonical addressability (R1-01).
 *
 * Two different questions have to stay two different questions:
 *
 *   1. is this Session Position a legitimate Moment at all?  →  `[1, LH]`, T-02's frozen
 *      precondition, unchanged and still checked by `resolveTemporalTarget`;
 *   2. may T-06 interaction target it right now?  →  is it a member of the CURRENTLY DISCLOSED
 *      Track for this Session.
 *
 * The second is strictly narrower and is T-06's own. With `LH = 100` and a disclosed prefix through
 * `SP(80)`, `SP(95)` is a perfectly valid Moment and is NOT an interaction target: nothing has
 * disclosed it, and the numeric value of `LH` is not a disclosure. Exact entry and relative forward
 * continuation must not be able to manufacture access to it, and neither may the pointer route —
 * all three ask this one rule.
 *
 * What disclosure authority is, and what it refuses to be:
 *
 *   - it is membership in T-05's complete SP1-anchored disclosed prefix, checked per candidate
 *     against the Track's own row rather than inferred from its length;
 *   - it is Session-scoped. A Track built for another Session authorizes nothing here, and a Session
 *     replacement therefore invalidates the old authority outright;
 *   - it grows and never rewrites: a target that becomes disclosed later becomes targetable later,
 *     and nothing about earlier Product truth changes when it does;
 *   - it is never derived from a pixel, a percentage, a window offset, a viewport bound or a scroll
 *     position. A presentation coordinate can identify WHICH disclosed row was activated; it can
 *     never decide WHETHER a position is disclosed.
 *
 * The Live Edge is untouched by all of this. It is a temporal MODE intent, not a member of the
 * disclosed sequence, so the end of the disclosed Track is never a surrogate for it and holding at
 * the horizon never becomes `FOLLOW_LIVE`.
 */
import { isSessionPosition, type CanonicalState, type SessionPosition } from '../../state';
import type { DisclosedTrack } from '../../timeline';
import type { TemporalRejectionCode } from '../outcome';
import { nextForwardTarget, resolveTemporalTarget, temporalBounds, type TargetResolution, type TemporalBounds } from './addressability';

/**
 * The set of Session Positions T-06 interaction may target right now. Derived from ONE disclosed
 * Track and nothing else — no store, no projection, no presentation geometry.
 */
export interface DisclosedTargetAuthority {
  readonly sessionId: string;
  /** The last disclosed Session Position, or `null` when nothing is disclosed yet. */
  readonly horizon: SessionPosition | null;
  readonly count: number;
  /** Membership, verified against the Track's own row rather than assumed from its length. */
  has(candidate: unknown): boolean;
}

export function disclosedTargetAuthority(track: DisclosedTrack): DisclosedTargetAuthority {
  const targets = track.targets;
  const count = targets.length;
  const horizon = count === 0 ? null : targets[count - 1].sessionPosition;
  return Object.freeze({
    sessionId: track.sessionId,
    horizon,
    count,
    has(candidate: unknown): boolean {
      // T-05's factory enforces the complete SP1-anchored contiguous prefix, so the row index is
      // exact — and the row is still read back and compared, so a Track that ever stopped being a
      // prefix would refuse rather than quietly authorize the wrong Moment.
      if (!isSessionPosition(candidate)) return false;
      return targets[candidate - 1]?.sessionPosition === candidate;
    },
  });
}

/**
 * The two authorities a T-06 interaction needs, carried together so a route cannot accidentally
 * consult one without the other. Canonical bounds come from Class A alone; disclosed availability
 * comes from the Track alone; neither is derived from the other.
 */
export interface TemporalTargeting {
  readonly bounds: TemporalBounds;
  readonly disclosed: DisclosedTargetAuthority;
}

export function temporalTargeting(state: CanonicalState, track: DisclosedTrack): TemporalTargeting {
  return { bounds: temporalBounds(state), disclosed: disclosedTargetAuthority(track) };
}

const refuse = (code: TemporalRejectionCode, detail: string): TargetResolution => ({ ok: false, code, detail });

/**
 * THE T-06 interaction targeting gate. Canonical validity is asked FIRST, so a position below
 * `SP(1)` or beyond `LH` keeps its own precise refusal; disclosed membership is asked second, so a
 * canonically valid but undisclosed position is refused as exactly that and never as "out of range".
 */
export function resolveDisclosedTarget(targeting: TemporalTargeting, candidate: unknown): TargetResolution {
  const { bounds, disclosed } = targeting;
  if (disclosed.sessionId !== bounds.sessionId) {
    return refuse('SESSION_MISMATCH', `the disclosed Track covers Session ${disclosed.sessionId}; the mirrored Session is ${bounds.sessionId}`);
  }
  const canonical = resolveTemporalTarget(bounds, candidate);
  if (!canonical.ok) return canonical;
  if (!disclosed.has(canonical.sp)) {
    return refuse(
      'NOT_DISCLOSED',
      `Session Position ${canonical.sp} is a legitimate Moment but is not part of the disclosed Track, which reaches ${disclosed.horizon ?? 'nothing'}`,
    );
  }
  return canonical;
}

export type DisclosedForwardStep =
  | { readonly outcome: 'STEP'; readonly sp: SessionPosition }
  /** The authoritative Live Head. There is no later Moment at all. */
  | { readonly outcome: 'AT_LIVE_HEAD'; readonly sp: SessionPosition }
  /**
   * The end of what is disclosed. A later Moment may exist and simply has not been disclosed, so
   * the continuation HOLDS here — it does not reach past the horizon, and it does not become Live
   * intent. If disclosure grows, a later deliberate step reaches further.
   */
  | { readonly outcome: 'AT_DISCLOSURE_HORIZON'; readonly sp: SessionPosition }
  | { readonly outcome: 'REJECTED'; readonly code: TemporalRejectionCode; readonly detail: string };

/**
 * The next legitimate forward target. It composes the canonical rule rather than restating it: the
 * canonical bound is asked first, then the disclosure horizon, so the two bounds stay separable and
 * a caller can tell which one it is standing on.
 */
export function nextDisclosedTarget(targeting: TemporalTargeting, from: unknown): DisclosedForwardStep {
  const current = resolveDisclosedTarget(targeting, from);
  if (!current.ok) return { outcome: 'REJECTED', code: current.code, detail: current.detail };
  const canonical = nextForwardTarget(targeting.bounds, current.sp);
  if (canonical.outcome === 'REJECTED') return canonical;
  if (canonical.outcome === 'AT_LIVE_HEAD') return { outcome: 'AT_LIVE_HEAD', sp: current.sp };
  return targeting.disclosed.has(canonical.sp)
    ? { outcome: 'STEP', sp: canonical.sp }
    : { outcome: 'AT_DISCLOSURE_HORIZON', sp: current.sp };
}
