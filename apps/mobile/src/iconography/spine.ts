/**
 * VPORT-02 — where the Temporal Spine's hairline and notches fall inside T-05's presentation window.
 *
 * Plain arithmetic over T-05's own quantities — the invariant step, the window offset, the viewport and the count of
 * disclosed Moments — in the strip's LOGICAL space (0 at the start edge). It decides nothing: it is told which Moment
 * is committed and which is previewed, and it never turns a coordinate into a Moment. Logical positions are placed
 * with `start`, so a right-to-left layout mirrors them as layout, which is T-06's one mirror rule and no second one.
 *
 * Only Moments within one step of the window are produced, so the cost is the window's, never the Session's.
 */
import { P2_SPINE } from './p2-production.generated';

export interface SpineInput {
  /** How many Moments T-05 has disclosed: SP1 … SP(n). */
  readonly disclosed: number;
  /** T-05's window offset, in layout points. */
  readonly offset: number;
  /** T-05's viewport, in layout points. */
  readonly viewport: number;
  /** PINNED(t)'s Moment, whose notch the committed aperture's mark replaces; `null` while following Live. */
  readonly committedSp: number | null;
  /** The previewed Moment, whose notch says WHICH Moment — never how important it is; `null` with no preview. */
  readonly targetSp: number | null;
}

export interface SpineNotch {
  readonly sp: number;
  /** The notch's centre, from the strip's logical start. */
  readonly start: number;
  readonly target: boolean;
}

export interface SpinePresentation {
  /** The hairline runs from the start edge to the newest disclosed Moment's far side, clipped to the window. */
  readonly spineLength: number;
  readonly notches: readonly SpineNotch[];
}

const EMPTY: SpinePresentation = Object.freeze({ spineLength: 0, notches: Object.freeze([]) });

export function spinePresentation(input: SpineInput): SpinePresentation {
  const { disclosed, offset, viewport, committedSp, targetSp } = input;
  if (!Number.isFinite(disclosed) || disclosed < 1 || !Number.isFinite(viewport) || viewport <= 0 || !Number.isFinite(offset)) return EMPTY;
  const step = P2_SPINE.stepPoints;
  const spineLength = Math.max(0, Math.min(viewport, disclosed * step - offset));
  const first = Math.max(1, Math.floor(offset / step));
  const last = Math.min(disclosed, Math.ceil((offset + viewport) / step) + 1);
  const notches: SpineNotch[] = [];
  for (let sp = first; sp <= last; sp += 1) {
    const start = (sp - 1) * step + step / 2 - offset;
    if (start < -step || start > viewport + step) continue;
    if (sp === committedSp && sp !== targetSp) continue;
    notches.push(Object.freeze({ sp, start, target: sp === targetSp }));
  }
  return Object.freeze({ spineLength, notches: Object.freeze(notches) });
}
