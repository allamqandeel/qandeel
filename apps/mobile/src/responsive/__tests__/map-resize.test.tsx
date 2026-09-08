/**
 * T-11 — the world under a changing window.
 *
 * > The window changes. The world does not.
 *
 * Every assertion here is about the SAME canonical camera under different envelopes. What must move
 * is the visible footprint and the screen-space placement; what must not move is anything canonical
 * — the anchor, the scale, the depth, `V`, a Home's address, the reversible history, the inspection
 * or the temporal stance.
 *
 * A note on what "unchanged" means for a Home. Its screen position necessarily differs between two
 * envelopes, because the camera anchor is drawn at the centre of the safe area and the safe area
 * moved. The invariant is the one that carries meaning: a Home's position RELATIVE TO THE CAMERA is
 * identical at every width, which is what "no reflow, no recenter, no fit-to-content and no
 * width-derived redistribution" actually asserts. Asserting equal screen coordinates would assert
 * the opposite of the contract — it would require the world to move with the window.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import { useLayoutEffect, useMemo } from 'react';
import { I18nManager, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import {
  buildMapAccessibilityTree,
  decodeCameraIntent,
  envelopeCenter,
  hitTest,
  MAP_ACCESSIBILITY_TEST_ID,
  MAP_SURFACE_PLANE_TEST_ID,
  MAP_SURFACE_TEST_ID,
  placeScene,
  viewportEnvelope,
  visibleFootprint,
  worldDeltaForPoints,
  type MapCamera,
  type PlacedNode,
  type ViewportEnvelope,
} from '../../map';
import { useMapPanGesture, type MapActionOutcome } from '../../map';
import { useAuthorityGeneration, usePresentationCamera } from '../../motion';
import { contextAt, chromeStore, TWO_CONTEXT_WORLD } from '../../orientation-chrome/__fixtures__/chrome';
import { sessionPosition, type CanonicalStore } from '../../state';
import { trackOf } from '../../temporal-navigation/__fixtures__/temporal';
import { ResponsiveWorld, resize, simulatedMapHeight, temporalControllers } from '../__fixtures__/composition';

jest.setTimeout(60_000);

const ENVELOPE = [
  { id: 'C1', width: 320, height: 568 },
  { id: 'C2', width: 360, height: 800 },
  { id: 'C3', width: 390, height: 844 },
  { id: 'C4', width: 412, height: 915 },
  { id: 'C5', width: 568, height: 320 },
  { id: 'C6', width: 844, height: 390 },
  { id: 'C7', width: 768, height: 1024 },
  { id: 'C8', width: 1024, height: 768 },
  { id: 'C9', width: 1366, height: 1024 },
] as const;

const envelopeOf = (width: number, height: number, insets: Record<string, number> = {}): ViewportEnvelope => {
  const built = viewportEnvelope(width, height, insets);
  if (built === null) throw new Error(`${width}x${height} is not a viewport`);
  return built;
};

function reader(): { store: CanonicalStore; context: ReturnType<typeof contextAt>; camera: MapCamera } {
  const store = chromeStore({ liveHead: 6, depth: 'ANALYTICAL_OBJECT', temporal: { kind: 'PINNED', at: sessionPosition(4) } });
  const context = contextAt(TWO_CONTEXT_WORLD());
  const decoded = decodeCameraIntent(store.getState().camera);
  if (!decoded.ok) throw new Error('fixture camera is not decodable');
  return { store, context, camera: decoded.camera };
}

/** Every world-plane node, keyed, positioned RELATIVE TO THE CAMERA. */
function worldOffsets(nodes: readonly PlacedNode[], envelope: ViewportEnvelope): Record<string, string> {
  const center = envelopeCenter(envelope);
  return Object.fromEntries(
    nodes
      .filter((node) => node.region === 'WORLD_PLANE')
      .map((node) => [node.key, `${node.x - center.x},${node.y - center.y},${node.radius}`]),
  );
}

describe('T11 — the world is the same world at every width', () => {
  it('T11-A11, T11-A13, T11-A14, T11-A15, T11-A16 — geography never reflows, recenters or refits', () => {
    const { context, camera } = reader();
    const reference = envelopeOf(ENVELOPE[0].width, ENVELOPE[0].height);
    const expected = worldOffsets(placeScene(context.scene, camera, reference).nodes, reference);
    expect(Object.keys(expected).length).toBeGreaterThan(0);

    for (const testCase of ENVELOPE) {
      const envelope = envelopeOf(testCase.width, testCase.height);
      const placed = placeScene(context.scene, camera, envelope);
      // Every Home and every contextual appearance sits at exactly the same place in the world,
      // whatever the window is: no compaction, no redistribution, no fit-to-content, no recenter.
      expect(worldOffsets(placed.nodes, envelope)).toEqual(expected);
      // and the membership of `V` is unchanged: culling removed nothing from the scene.
      expect(placed.nodes.map((node) => node.key).sort()).toEqual(
        placeScene(context.scene, camera, reference).nodes.map((node) => node.key).sort(),
      );
    }
  });

  it('a larger window reveals strictly more of the same world, and a smaller one strictly less', () => {
    const { context, camera } = reader();
    const small = envelopeOf(320, 568);
    const large = envelopeOf(1366, 1024);
    const smallFootprint = visibleFootprint(camera, small);
    const largeFootprint = visibleFootprint(camera, large);
    expect(largeFootprint.maxX - largeFootprint.minX).toBeGreaterThan(smallFootprint.maxX - smallFootprint.minX);
    expect(largeFootprint.maxY - largeFootprint.minY).toBeGreaterThan(smallFootprint.maxY - smallFootprint.minY);
    // The footprint GREW around the same centre: the camera did not move to make room.
    expect(largeFootprint.minX).toBeLessThanOrEqual(smallFootprint.minX);
    expect(largeFootprint.maxX).toBeGreaterThanOrEqual(smallFootprint.maxX);
    // and the visible set can only grow with it.
    const visibleAt = (envelope: ViewportEnvelope) =>
      new Set(placeScene(context.scene, camera, envelope).visibleNodes.map((node) => node.key));
    for (const key of visibleAt(small)) expect(visibleAt(large).has(key)).toBe(true);
  });

  it('T11-A12, T11-A54 — the world is never mirrored, in either language or either direction', () => {
    const { context, camera } = reader();
    const envelope = envelopeOf(390, 844);
    const ltr = placeScene(context.scene, camera, envelope);
    const original = I18nManager.isRTL;
    I18nManager.isRTL = true;
    try {
      const rtl = placeScene(context.scene, camera, envelope);
      expect(rtl.nodes).toEqual(ltr.nodes);
      expect(rtl.footprint).toEqual(ltr.footprint);
      expect(rtl.center).toEqual(ltr.center);
    } finally {
      I18nManager.isRTL = original;
    }
  });

  it('T11-A17 — the ungeographic register stays screen space, and width is never a rank', () => {
    const { context, camera } = reader();
    const narrow = envelopeOf(320, 568, { top: 48, bottom: 24 });
    const wide = envelopeOf(1366, 1024, { top: 48, bottom: 24 });
    const registerOf = (envelope: ViewportEnvelope) =>
      placeScene(context.scene, camera, envelope).nodes.filter((node) => node.region === 'UNGEOGRAPHIC_REGISTER');
    // The register reflows within its own screen-space strip, in the SAME order, and its identities
    // are unchanged: a wider strip is more columns of the same entries, never a re-ranking.
    expect(registerOf(wide).map((node) => node.key)).toEqual(registerOf(narrow).map((node) => node.key));
    for (const node of [...registerOf(narrow), ...registerOf(wide)]) {
      expect(node.locus).toBeNull();
      // Screen space: anchored to the safe-area inset, never to the camera anchor.
      expect(node.x).toBeGreaterThanOrEqual(0);
    }
  });

  it('T11-A18, T11-A19 — paint, pointer and the accessible tree agree under the new envelope', () => {
    const { context, camera } = reader();
    for (const testCase of ENVELOPE) {
      const envelope = envelopeOf(testCase.width, testCase.height, { top: 48, bottom: 24 });
      const placed = placeScene(context.scene, camera, envelope);
      const tree = buildMapAccessibilityTree(context.scene, camera, envelope, null);
      const footprint = visibleFootprint(camera, envelope);
      for (const node of placed.visibleNodes) {
        // A tap at exactly where the renderer drew it selects THAT node, at every width.
        expect(hitTest(placed, { x: node.x, y: node.y })).toBe(node);
      }
      // The accessible tree covers the entitled set regardless of culling, and its own
      // within-footprint answer is derived from the same footprint the placement used.
      for (const accessible of tree.nodes) {
        if (accessible.placement === 'UNGEOGRAPHIC') continue;
        const object = context.scene.objects.find((candidate) => candidate.id === accessible.id);
        expect(object).toBeDefined();
        const within = (object?.loci ?? []).some((locus) => {
          const addressed = locus.kind === 'THREAD_HOME' ? locus.address : locus.hostAddress;
          return addressed.x >= footprint.minX && addressed.x <= footprint.maxX && addressed.y >= footprint.minY && addressed.y <= footprint.maxY;
        });
        expect(accessible.withinVisibleFootprint).toBe(within);
      }
    }
  });
});

describe('T11 — a resize is not an act', () => {
  async function mountedWorld(width = 390, height = 844) {
    const { store, context } = reader();
    const { preview, presentation } = temporalControllers(trackOf('session-1', 6), 0);
    const outcomes: unknown[] = [];
    const view = await render(
      <ResponsiveWorld
        store={store}
        context={context}
        preview={preview}
        presentation={presentation}
        onMap={(outcome) => outcomes.push(outcome)}
        onTemporal={(outcome) => outcomes.push(outcome)}
      />,
    );
    await resize(view, width, height);
    return { store, context, preview, presentation, view, outcomes };
  }

  it('T11-A01…A07, T11-A74 — a full sweep of the envelope writes nothing canonical at all', async () => {
    const world = await mountedWorld();
    const before = world.store.getState();
    for (const testCase of [...ENVELOPE, ...ENVELOPE].reverse()) {
      await resize(world.view, testCase.width, testCase.height);
      // Identity, not equality: no canonical field was written, so the store never published.
      expect(world.store.getState()).toBe(before);
    }
    // and with insets and a font scale moving underneath it too.
    for (const inset of [0, 34, 48, 12]) {
      await resize(world.view, 390, 844, { insetTop: inset, insetBottom: inset });
      expect(world.store.getState()).toBe(before);
    }
    expect(before.history).toHaveLength(0);
    expect(before.temporal).toEqual({ kind: 'PINNED', at: 4 });
    expect(before.inspection).toBeNull();
    // No outcome was produced either, so no act was attempted and refused: none was attempted.
    expect(world.outcomes).toEqual([]);
    await act(async () => {
      world.view.unmount();
    });
  });

  it('T11-A18 — a tap after a resize reaches the object the reader is looking at', async () => {
    const world = await mountedWorld(320, 568);
    await resize(world.view, 1024, 768);
    const decoded = decodeCameraIntent(world.store.getState().camera);
    if (!decoded.ok) throw new Error('camera');
    // The Map frame's own rect after the resize, from the SAME arithmetic the composition used, so
    // the pointer is converted through the geometry the frame was actually given.
    const envelope = envelopeOf(1024, simulatedMapHeight(768));
    const placed = placeScene(world.context.scene, decoded.camera, envelope);
    const home = placed.visibleNodes.find((node) => node.locus?.kind === 'THREAD_HOME');
    expect(home).toBeDefined();
    await act(async () => {
      fireEvent(world.view.getByTestId(MAP_SURFACE_PLANE_TEST_ID), 'responderRelease', {
        nativeEvent: { locationX: home?.x ?? 0, locationY: home?.y ?? 0 },
      });
    });
    // The inspection landed on the object drawn there, through the real T-04 executor.
    expect(world.store.getState().inspection).not.toBeNull();
    expect(world.outcomes).toHaveLength(1);
    await act(async () => {
      world.view.unmount();
    });
  });

  it('T11-A21…A25 — a resize during a drag: one PAN, the finger\'s own translation, no double and no adoption', async () => {
    // The surface's own wiring, with the envelope-derived presentation inputs under the test's
    // control — exactly what a resize replaces underneath an open drag.
    interface DragProps {
      readonly store: CanonicalStore;
      readonly center: { readonly x: number; readonly y: number };
      readonly diagonalPoints: number;
      readonly onSettled: (outcome: MapActionOutcome) => void;
      readonly expose: (gesture: ReturnType<typeof useMapPanGesture>['gesture']) => void;
    }
    function DragSurface({ store, center, diagonalPoints, onSettled, expose }: DragProps) {
      const motion = usePresentationCamera({ center, diagonalPoints });
      const authority = useAuthorityGeneration(store);
      const { gesture } = useMapPanGesture(store, { enabled: true, camera: motion, authority, onSettled });
      useLayoutEffect(() => {
        expose(gesture);
      });
      return (
        <GestureDetector gesture={gesture}>
          <View testID="drag" />
        </GestureDetector>
      );
    }

    const { store, camera } = reader();
    const outcomes: MapActionOutcome[] = [];
    const held: { gesture: ReturnType<typeof useMapPanGesture>['gesture'] | null } = { gesture: null };
    const expose = (next: ReturnType<typeof useMapPanGesture>['gesture']) => {
      held.gesture = next;
    };
    const props = (center: { x: number; y: number }, diagonalPoints: number) => ({
      store,
      center,
      diagonalPoints,
      onSettled: (outcome: MapActionOutcome) => outcomes.push(outcome),
      expose,
    });
    const narrow = envelopeCenter(envelopeOf(320, 568));
    const wide = envelopeCenter(envelopeOf(1024, 768));
    const view = await render(<DragSurface {...props(narrow, Math.hypot(320, 568))} />);
    const live = () => {
      if (held.gesture === null) throw new Error('no gesture');
      return held.gesture;
    };

    // The finger arrives and drags under the OLD geometry.
    live().handlers.onBegin?.({ x: 0, y: 0 } as never);
    live().handlers.onChange?.({ changeX: -40, changeY: 25 } as never);

    // The window changes underneath it. The centre and the diagonal are both replaced.
    await act(async () => {
      view.rerender(<DragSurface {...props(wide, Math.hypot(1024, 768))} />);
    });
    expect(store.getState().history).toHaveLength(0);

    // The drag continues under the new geometry and completes.
    live().handlers.onChange?.({ changeX: -60, changeY: 35 } as never);
    live().handlers.onEnd?.({ translationX: -100, translationY: 60 } as never, true);
    live().handlers.onFinalize?.({} as never, true);

    // EXACTLY one canonical `PAN`, one checkpoint, and the anchor moved by the finger's own total
    // translation through the camera scale alone — the mapping never depended on the envelope, so
    // the geometry change could not have changed what the drag meant.
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(1);
    const after = decodeCameraIntent(store.getState().camera);
    if (!after.ok) throw new Error('camera');
    const expected = {
      x: camera.anchor.x + worldDeltaForPoints(camera, 100),
      y: camera.anchor.y + worldDeltaForPoints(camera, 60),
    };
    expect(after.camera.anchor.x).toBe(expected.x);
    expect(after.camera.anchor.y).toBe(expected.y);
    // and the scale and depth are exactly what they were: a drag pans, and a resize does neither.
    expect(after.camera.scale).toEqual(camera.scale);
    expect(after.camera.depth).toBe(camera.depth);

    // A second finalize of the same completed gesture adds nothing: no double commit.
    live().handlers.onFinalize?.({} as never, true);
    expect(store.getState().history).toHaveLength(1);
    expect(outcomes).toHaveLength(1);
    await act(async () => {
      view.unmount();
    });
  });

  it('a drag whose AUTHORITY was replaced during a resize is dropped, in both stores', async () => {
    interface DragProps {
      readonly store: CanonicalStore;
      readonly expose: (gesture: ReturnType<typeof useMapPanGesture>['gesture']) => void;
      readonly onSettled: (outcome: MapActionOutcome) => void;
    }
    function DragSurface({ store, expose, onSettled }: DragProps) {
      const center = useMemo(() => ({ x: 160, y: 284 }), []);
      const motion = usePresentationCamera({ center, diagonalPoints: 652 });
      const authority = useAuthorityGeneration(store);
      const { gesture } = useMapPanGesture(store, { enabled: true, camera: motion, authority, onSettled });
      useLayoutEffect(() => {
        expose(gesture);
      });
      return (
        <GestureDetector gesture={gesture}>
          <View testID="drag" />
        </GestureDetector>
      );
    }
    const first = reader().store;
    const second = reader().store;
    const outcomes: MapActionOutcome[] = [];
    const held: { gesture: ReturnType<typeof useMapPanGesture>['gesture'] | null } = { gesture: null };
    const expose = (next: ReturnType<typeof useMapPanGesture>['gesture']) => {
      held.gesture = next;
    };
    const live = () => {
      if (held.gesture === null) throw new Error('no gesture');
      return held.gesture;
    };
    const onSettled = (outcome: MapActionOutcome) => outcomes.push(outcome);
    const view = await render(<DragSurface store={first} expose={expose} onSettled={onSettled} />);
    live().handlers.onBegin?.({ x: 0, y: 0 } as never);
    live().handlers.onChange?.({ changeX: -40, changeY: 25 } as never);
    await act(async () => {
      view.rerender(<DragSurface store={second} expose={expose} onSettled={onSettled} />);
    });
    live().handlers.onEnd?.({ translationX: -100, translationY: 60 } as never, true);
    // No act in the store the drag moved, none in the store that replaced it, and no outcome
    // claiming one happened. The finger moved a world nobody is looking at.
    expect(first.getState().history).toHaveLength(0);
    expect(second.getState().history).toHaveLength(0);
    expect(outcomes).toEqual([]);
    await act(async () => {
      view.unmount();
    });
  });

  it('T11-A70 — a rapid resize sweep never remounts the world owner', async () => {
    const world = await mountedWorld();
    const surface = world.view.getByTestId(MAP_SURFACE_TEST_ID);
    const accessibility = world.view.getByTestId(MAP_ACCESSIBILITY_TEST_ID);
    for (let width = 320; width <= 1366; width += 37) await resize(world.view, width, 700 + (width % 200));
    // Same instances: no width or band was ever a key, so nothing was torn down and rebuilt.
    expect(world.view.getByTestId(MAP_SURFACE_TEST_ID)).toBe(surface);
    expect(world.view.getByTestId(MAP_ACCESSIBILITY_TEST_ID)).toBe(accessibility);
    await act(async () => {
      world.view.unmount();
    });
  });
});
