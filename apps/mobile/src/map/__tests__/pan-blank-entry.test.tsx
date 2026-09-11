/**
 * T-12 / MOT-04 — a live drag may not show the reader an empty piece of glass.
 *
 * THE CLAIM, stated the way the defect was: a direct one-finger Pan cannot expose a blank viewport
 * region merely because the canonical `PAN` has not committed yet.
 *
 * It was exactly that. The canonical camera does not move until the finger lifts, `commitCamera` is
 * the only thing that ever opened a culling corridor, and so for the whole gesture `presented` was
 * computed against the RESTING viewport while the reader dragged new world onto the screen. Measured
 * on an Honor X9b as ink per vertical slice of the world's own band during one drag:
 *
 *     before the drag   22.68  22.02  10.02   2.37   0.15   0.00
 *     mid-drag          0.00   0.00   13.66  23.20  21.60  15.95   <- the leading edge is BLANK
 *     at release        17.13  26.55  19.15  23.20  21.60  15.95   <- and it all appears at once
 *
 * Every unit test passed throughout, because every one of them asked whether the culling arithmetic
 * was right. It was. What nobody asked was whether anything opened a corridor for a gesture that
 * commits nothing until it ends.
 *
 * So this suite drives the PRODUCTION wiring rather than the arithmetic: it mounts the real
 * `MapSurface`, takes the advance callback the surface actually hands its camera, and asks what the
 * renderer paints before and after — with the canonical camera held identical throughout, which is
 * what makes it a statement about a live drag rather than about a committed act.
 */
import { act, render } from '@testing-library/react-native';

import { disclosureFixture } from '../__fixtures__/disclosure';
import { contextOf, envelope, testStore } from '../__fixtures__/store';
import { circles } from '../../motion/__fixtures__/paint';
import { MAP_SURFACE_TEST_ID, MapSurface } from '../renderer/MapSurface';
import { CULL_MARGIN_POINTS } from '../renderer/map-geometry';
import { decodeCameraIntent, envelopeCenter, type MapCamera } from '../camera';

/**
 * The seam this suite needs, and the narrowest one that exists: the options the surface hands its
 * presentation camera. The real hook still runs — nothing about the camera is faked — this only
 * remembers what it was asked for, because the reaction that would call it back is a no-op in this
 * runtime by design (`jest.setup.js` says so, and says why).
 */
let captured: {
  onPresentationAdvanced?: (tx: number, ty: number, zoom: number, padPlaneUnits: number, epoch: number) => void;
  advancePoints?: number;
  binding?: { epoch: { get: () => number }; grab: () => void; release: () => void; dragBy: (x: number, y: number) => void };
} = {};

jest.mock('../../motion', () => {
  const actual = jest.requireActual('../../motion');
  return {
    ...actual,
    usePresentationCamera: (options: { onPresentationAdvanced?: never; advancePoints?: number }) => {
      const binding = actual.usePresentationCamera(options);
      captured = { onPresentationAdvanced: options.onPresentationAdvanced, advancePoints: options.advancePoints, binding };
      return binding;
    },
  };
});

jest.setTimeout(120_000);

const view = envelope();
const center = envelopeCenter(view);

const cameraOf = (store: ReturnType<typeof testStore>): MapCamera => {
  const decoded = decodeCameraIntent(store.getState().camera);
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
};

/** A Home placed at a chosen screen x under the store's CURRENT camera, through its own exact scale. */
const homeAtScreenX = (id: string, screenX: number, camera: MapCamera) => ({
  id,
  x: String((BigInt(Math.round(screenX - center.x)) * camera.scale.numerator) / camera.scale.denominator),
  y: '0',
});

/** Is anything painted within a point of this screen x? */
const paintedAt = (tree: unknown, screenX: number): boolean =>
  circles(tree).some((circle) => Math.abs(circle.cx - screenX) < 1);

describe('MOT-04 — a live drag paints the glass it is uncovering', () => {
  beforeEach(() => {
    captured = {};
  });

  it('the surface asks its camera to report progress, at the renderer own cull margin', async () => {
    const store = testStore({ depth: 'THREAD' });
    const context = contextOf(store, disclosureFixture({ depth: 'THREAD', threads: [homeAtScreenX('thread-a', 200, cameraOf(store))] }));
    const rendered = await render(<MapSurface store={store} context={context} envelope={view} />);
    expect(rendered.getByTestId(MAP_SURFACE_TEST_ID)).toBeTruthy();

    // Without this the corridor has no second author and the defect is structurally back.
    expect(typeof captured.onPresentationAdvanced).toBe('function');
    // The budget is the renderer's OWN margin: the plane reports exactly as often as the painted band
    // allows, so a report can never arrive after an unpainted region has reached the reader.
    expect(captured.advancePoints).toBe(CULL_MARGIN_POINTS);

    await act(async () => {
      rendered.unmount();
    });
  });

  it('admits the world the drag is uncovering, while the canonical camera has not moved at all', async () => {
    const store = testStore({ depth: 'THREAD' });
    const camera = cameraOf(store);
    // One viewport to the LEFT of the glass: comfortably outside the resting cull, and exactly what a
    // drag to the right brings into view.
    const offGlassX = center.x - view.width;
    const context = contextOf(
      store,
      disclosureFixture({ depth: 'THREAD', threads: [homeAtScreenX('thread-a', offGlassX, camera), homeAtScreenX('thread-b', center.x, camera)] }),
    );
    const rendered = await render(<MapSurface store={store} context={context} envelope={view} />);

    const cameraBefore = store.getState().camera;
    // At rest the world on the glass is painted and the world off it is not. That is culling working.
    expect(paintedAt(rendered.toJSON(), center.x)).toBe(true);
    expect(paintedAt(rendered.toJSON(), offGlassX)).toBe(false);

    // THE DRAG, through the camera's own entry points rather than a simulation of them: a finger
    // arrives, the plane is moved one viewport to the right, and the plane reports that it has. None
    // of it commits anything — no `PAN`, no canonical camera change, no dispatch.
    const advance = captured.onPresentationAdvanced;
    const binding = captured.binding;
    if (advance === undefined || binding === undefined) throw new Error('the surface handed its camera no advance route');
    await act(async () => {
      binding.grab();
      binding.dragBy(view.width, 0);
    });
    await act(async () => {
      advance(view.width, 0, 1, 2 * CULL_MARGIN_POINTS, binding.epoch.get());
    });
    // The object the drag has uncovered is now painted...
    expect(paintedAt(rendered.toJSON(), offGlassX)).toBe(true);
    // ...and the one that was already on the glass has not been dropped for it.
    expect(paintedAt(rendered.toJSON(), center.x)).toBe(true);
    // ...and NOTHING canonical moved. The camera is the same object it was before the drag: this is a
    // claim about what a live gesture paints, not about what a committed act changes.
    expect(store.getState().camera).toBe(cameraBefore);

    await act(async () => {
      rendered.unmount();
    });
  });

  it('a report from a motion that has been replaced cannot widen anything', async () => {
    const store = testStore({ depth: 'THREAD' });
    const camera = cameraOf(store);
    const offGlassX = center.x - view.width;
    const context = contextOf(store, disclosureFixture({ depth: 'THREAD', threads: [homeAtScreenX('thread-a', offGlassX, camera)] }));
    const rendered = await render(<MapSurface store={store} context={context} envelope={view} />);

    const advance = captured.onPresentationAdvanced;
    const binding = captured.binding;
    if (advance === undefined || binding === undefined) throw new Error('the surface handed its camera no advance route');
    await act(async () => {
      binding.grab();
      binding.dragBy(view.width, 0);
    });
    // A report stamped with a generation that is not the one on the glass describes a plane that is no
    // longer there. Widening for it would paint a world nobody is looking at.
    await act(async () => {
      advance(view.width, 0, 1, 2 * CULL_MARGIN_POINTS, binding.epoch.get() + 7);
    });
    expect(paintedAt(rendered.toJSON(), offGlassX)).toBe(false);

    await act(async () => {
      rendered.unmount();
    });
  });
});
