/**
 * R4 — a DRAG opens a culling corridor, because a hand does not declare where it is going.
 *
 * The defect this closes was reader-visible, physical, and invisible to every test that existed. A
 * travel declares its whole path when it is authorized, so the renderer can open a corridor that
 * already contains every frame of it; the corridor arithmetic was correct and R3 proved it. A drag
 * declares nothing: the plane is attached to a hand, no canonical camera changes until the finger
 * lifts, and NOTHING widened the corridor for the whole gesture — so `presented` went on being
 * computed against the RESTING viewport while the reader dragged new world onto the glass.
 *
 * Measured on an Honor X9b, as ink per vertical slice of the world's own band during one drag:
 *
 *     before the drag   22.68  22.02  10.02   2.37   0.15   0.00
 *     mid-drag          0.00   0.00   13.66  23.20  21.60  15.95   <- the leading edge is BLANK
 *     at release        17.13  26.55  19.15  23.20  21.60  15.95   <- and it all appears at once
 *
 * Two slices of the glass held nothing while the reader was looking at them, and the objects that
 * belonged there appeared in the frame after the finger lifted. That is the whole defect: not a
 * culling arithmetic error, but a corridor nobody opened.
 *
 * The reaction that carries this rule is a no-op in this runtime by design — `jest.setup.js` says so
 * and says why — so the rule itself is an ordinary function and is tested as one here, together with
 * the consequence that actually matters: an object the drag has brought onto the glass is admitted
 * for painting BEFORE the gesture ends.
 */
import {
  RESIDUAL_AT_REST,
  RESIDUAL_ENVELOPE_AT_REST,
  envelopeHull,
  expandedEnvelope,
  isPresentedWithinEnvelope,
  presentationAdvance,
  residualEnvelope,
} from '..';
import { CULL_MARGIN_POINTS } from '../../map/renderer/map-geometry';

const view = { width: 390, height: 420 };
const center = { x: view.width / 2, y: view.height / 2 };
/** The budget the renderer actually uses. Written as the renderer's own constant, never a copy. */
const BUDGET = CULL_MARGIN_POINTS;

describe('R4-01 — the plane reports its progress, and only when it is worth reporting', () => {
  it('says nothing at rest, and nothing until it has moved a whole budget', () => {
    expect(presentationAdvance(RESIDUAL_AT_REST, RESIDUAL_AT_REST, 500, BUDGET)).toBeNull();
    // One point short is still silence: a threshold that fires early is a per-frame crossing wearing
    // a threshold's name.
    expect(presentationAdvance({ tx: BUDGET - 1, ty: 0, zoom: 1 }, RESIDUAL_AT_REST, 500, BUDGET)).toBeNull();
    expect(presentationAdvance({ tx: BUDGET, ty: 0, zoom: 1 }, RESIDUAL_AT_REST, 500, BUDGET)).not.toBeNull();
    // Diagonal travel counts as travel: the distance is on the glass, not along an axis.
    const diagonal = presentationAdvance({ tx: BUDGET * 0.8, ty: BUDGET * 0.8, zoom: 1 }, RESIDUAL_AT_REST, 500, BUDGET);
    expect(diagonal).not.toBeNull();
  });

  it('measures the distance on the GLASS, so a residual zoom is travel too', () => {
    // A plane at half scale moves the glass half as far for the same residual translation.
    expect(presentationAdvance({ tx: BUDGET, ty: 0, zoom: 0.5 }, { tx: 0, ty: 0, zoom: 0.5 }, 500, BUDGET)).toBeNull();
    expect(presentationAdvance({ tx: 2 * BUDGET, ty: 0, zoom: 0.5 }, { tx: 0, ty: 0, zoom: 0.5 }, 500, BUDGET)).not.toBeNull();
    // And a scale change alone moves what is on the glass without moving the translation at all.
    expect(presentationAdvance({ tx: 0, ty: 0, zoom: 1.2 }, RESIDUAL_AT_REST, 500, BUDGET)).not.toBeNull();
    expect(presentationAdvance({ tx: 0, ty: 0, zoom: 1.01 }, RESIDUAL_AT_REST, 500, BUDGET)).toBeNull();
  });

  it('asks for a wider band the faster the plane got away from it', () => {
    const slow = presentationAdvance({ tx: BUDGET, ty: 0, zoom: 1 }, RESIDUAL_AT_REST, 500, BUDGET);
    const fast = presentationAdvance({ tx: 12 * BUDGET, ty: 0, zoom: 1 }, RESIDUAL_AT_REST, 500, BUDGET);
    expect(slow?.padPlaneUnits).toBe(2 * BUDGET);
    expect(fast?.padPlaneUnits).toBeGreaterThan(slow?.padPlaneUnits ?? 0);
    // The band always covers at least the budget that was allowed to elapse, which is what makes the
    // next report late-safe rather than merely likely to be in time.
    expect(slow?.padPlaneUnits).toBeGreaterThanOrEqual(BUDGET);
  });

  it('refuses a budget that is not a distance, rather than crossing on every frame', () => {
    expect(presentationAdvance({ tx: 5000, ty: 0, zoom: 1 }, RESIDUAL_AT_REST, 500, 0)).toBeNull();
    expect(presentationAdvance({ tx: 5000, ty: 0, zoom: 1 }, RESIDUAL_AT_REST, 500, -1)).toBeNull();
    expect(presentationAdvance({ tx: 5000, ty: 0, zoom: 1 }, RESIDUAL_AT_REST, 500, Number.NaN)).toBeNull();
    expect(presentationAdvance({ tx: Number.NaN, ty: 0, zoom: 1 }, RESIDUAL_AT_REST, 500, BUDGET)).toBeNull();
  });
});

describe('R4-02 — what the report buys: the glass is painted ahead of the hand', () => {
  /** The corridor a drag has opened after reporting from `residual`. */
  const draggedCorridor = (residual: { tx: number; ty: number; zoom: number }) => {
    const advance = presentationAdvance(residual, RESIDUAL_AT_REST, Math.hypot(view.width, view.height), BUDGET);
    if (advance === null) throw new Error('this drag should have been worth reporting');
    return envelopeHull(RESIDUAL_ENVELOPE_AT_REST, expandedEnvelope(residualEnvelope(advance.residual), advance.padPlaneUnits));
  };

  it('admits an object the drag has brought onto the glass, and the resting rule does not', () => {
    // A drag to the right by one viewport brings in world from the left. This object starts a full
    // viewport off the left edge — comfortably outside the resting cull — and the drag puts it in
    // the middle of the screen.
    const object = { x: center.x - view.width, y: center.y, radius: 13 };
    const dragged = { tx: view.width, ty: 0, zoom: 1 };

    // THE DEFECT, as it was: culling against rest leaves it unpainted while the reader looks at it.
    expect(isPresentedWithinEnvelope(object, RESIDUAL_ENVELOPE_AT_REST, center, view, BUDGET)).toBe(false);
    // THE CORRECTION: the corridor the drag opened contains it.
    expect(isPresentedWithinEnvelope(object, draggedCorridor(dragged), center, view, BUDGET)).toBe(true);
  });

  it('paints beyond the glass, so the NEXT stretch of the drag is already drawn', () => {
    const dragged = { tx: 200, ty: 0, zoom: 1 };
    const corridor = draggedCorridor(dragged);
    // An object that is not yet on the glass at this residual, but will be within one budget of
    // further travel, is already admitted. That is the whole difference between a band that follows
    // the hand and one that trails it.
    const justOffGlass = { x: center.x - view.width / 2 - dragged.tx - BUDGET / 2, y: center.y, radius: 13 };
    expect(isPresentedWithinEnvelope(justOffGlass, corridor, center, view, BUDGET)).toBe(true);
  });

  it('still ends somewhere: a corridor is a band around the drag, not the whole world', () => {
    const corridor = draggedCorridor({ tx: 200, ty: 0, zoom: 1 });
    // Far outside anything this drag could have shown. A corridor that admitted this would be paying
    // to paint a world nobody is looking at, which is the cost the retirement exists to avoid.
    expect(isPresentedWithinEnvelope({ x: center.x - 20_000, y: center.y, radius: 13 }, corridor, center, view, BUDGET)).toBe(false);
  });

  it('the band is symmetric, because a hand may turn around', () => {
    const padded = expandedEnvelope(residualEnvelope({ tx: 100, ty: -60, zoom: 1 }), 25);
    expect(padded.txMin).toBe(75);
    expect(padded.txMax).toBe(125);
    expect(padded.tyMin).toBe(-85);
    expect(padded.tyMax).toBe(-35);
    // The residual zoom is NOT padded: a pinch writes nothing per frame, so widening it would
    // multiply the candidate set for nothing a reader could see.
    expect(padded.zoomMin).toBe(1);
    expect(padded.zoomMax).toBe(1);
    // A pad that is not a distance changes nothing rather than inverting the interval.
    expect(expandedEnvelope(RESIDUAL_ENVELOPE_AT_REST, -5)).toEqual(RESIDUAL_ENVELOPE_AT_REST);
    expect(expandedEnvelope(RESIDUAL_ENVELOPE_AT_REST, Number.NaN)).toEqual(RESIDUAL_ENVELOPE_AT_REST);
  });
});
