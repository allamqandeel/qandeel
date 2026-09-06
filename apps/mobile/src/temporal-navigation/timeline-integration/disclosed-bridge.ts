/**
 * T-06 — the bridge from T-05's disclosed presentation to temporal intent.
 *
 * The integration direction is one-way and it matters. T-05 identifies a disclosed target; T-06
 * decides whether that target may become temporal intent. T-05 gains nothing in return: no canonical
 * store, no dispatch, no selected Moment, no Live commit, no Map dependency, no knowledge that a
 * temporal layer exists at all. Everything in this file reads T-05's presentation model and writes
 * nothing back into it.
 *
 * The separation the frozen contract insists on is preserved by construction, because there is no
 * function here that could break it:
 *
 *   - scrolling the presentation window produces no temporal target;
 *   - moving, refining or widening the presentation position produces no temporal target;
 *   - a viewport change produces no temporal target;
 *   - only EXPLICIT activation of a disclosed target produces one.
 *
 * A presentation coordinate is used for exactly one thing: identifying WHICH disclosed target the
 * reader activated. It is never a temporal quantity — no percentage of a session, no interpolation
 * between Moments, no fractional position. The moment a target is identified it becomes an integer
 * Session Position and the coordinate is discarded.
 */
import { hitTest, type DisclosedMomentTarget, type DisclosedTrack, type PresentationSnapshot } from '../../timeline';
import type { TargetResolution } from '../targeting/addressability';
import { resolveDisclosedTarget, type TemporalTargeting } from '../targeting/disclosed-availability';
import { presentationX } from './presentation-geometry';

/**
 * The disclosed target under a touch, or `null`. The physical-to-logical mirror is the ONE shared
 * presentation geometry (`presentation-geometry.ts`), and the hit test is T-05's own — neither is
 * re-implemented here — and it is activation-neutral: identifying a target is not selecting it,
 * previewing it or committing it.
 */
export function disclosedTargetAt(snapshot: PresentationSnapshot, x: number, rtl: boolean): DisclosedMomentTarget | null {
  const logical = presentationX(x, snapshot.viewport, rtl);
  if (logical === null) return null;
  return hitTest(snapshot.track, snapshot.offset, snapshot.viewport, logical);
}

/**
 * Turns an EXPLICITLY activated disclosed target into a temporal target, or refuses it.
 *
 * The Track this target came from is checked against the targeting authority's own Track first: a
 * presentation built for another Session, or a row handed in from a Track that is not the one
 * currently authorizing interaction, is a defect and never a merge. After that the ONE interaction
 * gate decides — canonical validity, then disclosed membership — so the pointer route enjoys no
 * privilege and gains no second rule: being visible on a Timeline is not, by itself, authority.
 */
export function temporalTargetFromDisclosed(
  targeting: TemporalTargeting,
  track: DisclosedTrack,
  target: DisclosedMomentTarget,
): TargetResolution {
  if (track.sessionId !== targeting.bounds.sessionId || track.sessionId !== targeting.disclosed.sessionId) {
    return {
      ok: false,
      code: 'SESSION_MISMATCH',
      detail: `the disclosed Track covers Session ${track.sessionId}; the mirrored Session is ${targeting.bounds.sessionId}`,
    };
  }
  if (target === null || typeof target !== 'object') {
    return { ok: false, code: 'INVALID_INPUT', detail: 'a disclosed Moment target is required' };
  }
  return resolveDisclosedTarget(targeting, target.sessionPosition);
}
