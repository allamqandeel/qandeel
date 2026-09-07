/**
 * T-10 §6 — the Scene Truth Cut, proven at the renderer.
 *
 * The claim is absolute and this file states it as one property, checked after every kind of
 * change: **what is painted is exactly what the current `V` discloses, and nothing else.** Not
 * "nothing else after the exit finishes"; nothing else, in the commit the change lands in.
 *
 * That is provable rather than merely tested because there is no exit path to fail: an object the
 * projection stopped disclosing leaves the element tree with the placement, so a crossfade, an
 * exit fade, a fold-back, a retained ghost or a trail would have to be ADDED to make this file
 * fail. Arrivals are the asymmetric half, and they are decided in one pure function.
 */
import { act, render } from '@testing-library/react-native';

import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { contextOf, envelope, testStore } from '../../map/__fixtures__/store';
import { MapCanvas, decodeCameraIntent, envelopeCenter, hitTest, placeScene, type MapCamera } from '../../map';
import { DISCLOSURE_ENTRY_SCALE, MOTION_DURATIONS_MS, disclosureArrivalPlan } from '..';
import { canvasProps } from '../__fixtures__/canvas';
import { stubPresentationCamera } from '../__fixtures__/presentation-camera';

const WORLD = (threads: readonly { id: string; x: string; y: string }[], appearances: readonly { bindingId: string; threadId: string }[] = []) =>
  disclosureFixture({
    depth: 'ANALYTICAL_OBJECT',
    threads: [...threads],
    appearances: appearances.map((appearance) => ({ ...appearance, readingId: 'reading-1', boundSp: 2 })),
    readings: appearances.length > 0 ? [{ id: 'reading-1' }] : [],
  });

interface Painted {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

/** Every circle the renderer actually asked Skia to paint, in tree order. */
function painted(json: unknown): Painted[] {
  const found: Painted[] = [];
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    const record = node as { props?: Record<string, unknown>; children?: unknown[] };
    const props = record.props;
    if (props !== undefined && typeof props.cx === 'number' && typeof props.cy === 'number' && typeof props.r === 'number') {
      found.push({ cx: props.cx, cy: props.cy, r: props.r });
    }
    for (const child of record.children ?? []) walk(child);
  };
  walk(json);
  return found;
}

const sorted = (nodes: readonly Painted[]) => [...nodes].sort((a, b) => a.cx - b.cx || a.cy - b.cy || a.r - b.r);

const cameraOf = (store: ReturnType<typeof testStore>): MapCamera => {
  const decoded = decodeCameraIntent(store.getState().camera);
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
};

describe('T10-A21…A29, A35 — current V is what is painted, in the same commit', () => {
  const view = envelope();

  async function paintScene(store: ReturnType<typeof testStore>, disclosure: ReturnType<typeof WORLD>) {
    const camera = cameraOf(store);
    const context = contextOf(store, disclosure);
    const placed = placeScene(context.scene, camera, view);
    const motion = stubPresentationCamera({ center: envelopeCenter(view) });
    const rendered = await render(
      <MapCanvas {...canvasProps({ placed: placed, motion: motion, envelope: view })} />,
    );
    return { rendered, placed, motion, camera, context };
  }

  it('A21, A22, A23, A24 — an object removed from V is gone in the commit that removed it', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const both = WORLD([
      { id: 'thread-a', x: '0', y: '0' },
      { id: 'thread-b', x: '400000', y: '0' },
    ]);
    const one = WORLD([{ id: 'thread-a', x: '0', y: '0' }]);

    const { rendered, motion, camera } = await paintScene(store, both);
    const beforeCircles = painted(rendered.toJSON());
    expect(beforeCircles).toHaveLength(2);

    const nextContext = contextOf(store, one);
    const nextPlaced = placeScene(nextContext.scene, camera, view);
    await act(async () => {
      rendered.rerender(
        <MapCanvas {...canvasProps({ placed: nextPlaced, motion: motion, envelope: view })} />,
      );
    });

    const afterCircles = painted(rendered.toJSON());
    // Exactly the current placement. Not "the current placement plus something leaving".
    expect(sorted(afterCircles)).toEqual(sorted(nextPlaced.visibleNodes.map((node) => ({ cx: node.x, cy: node.y, r: node.radius }))));
    expect(afterCircles).toHaveLength(1);
    // And specifically: the departed Home's own pixels are not on the surface under any opacity.
    const departed = beforeCircles.find((circle) => !afterCircles.some((kept) => kept.cx === circle.cx && kept.cy === circle.cy));
    expect(departed).toBeDefined();
    expect(afterCircles.some((circle) => circle.cx === departed!.cx && circle.cy === departed!.cy)).toBe(false);
  });

  it('A35 — a shallower rung removes the detail it no longer discloses, immediately', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const deep = WORLD([{ id: 'thread-a', x: '0', y: '0' }], [{ bindingId: 'binding-1', threadId: 'thread-a' }]);
    const { rendered, motion, camera } = await paintScene(store, deep);
    expect(painted(rendered.toJSON())).toHaveLength(2);

    // The shallower viewpoint: the Thread's Home is still disclosed, its contextual detail is not.
    const shallowStore = testStore({ depth: 'THREAD' });
    const shallowCamera = cameraOf(shallowStore);
    const shallow = contextOf(shallowStore, disclosureFixture({ depth: 'THREAD', threads: [{ id: 'thread-a', x: '0', y: '0' }] }));
    const shallowPlaced = placeScene(shallow.scene, shallowCamera, view);
    await act(async () => {
      rendered.rerender(
        <MapCanvas {...canvasProps({ placed: shallowPlaced, motion: motion, envelope: view })} />,
      );
    });
    const after = painted(rendered.toJSON());
    expect(after).toHaveLength(1);
    // The detail did not animate back into its host; it simply stopped being disclosed.
    expect(sorted(after)).toEqual(sorted(shallowPlaced.visibleNodes.map((node) => ({ cx: node.x, cy: node.y, r: node.radius }))));
    expect(camera.depth).not.toBe(shallowCamera.depth);
  });

  it('A25, A26, A27, A28, A29 — a surface that stops painting a world leaves no residual behind', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const { rendered, motion } = await paintScene(store, WORLD([{ id: 'thread-a', x: '0', y: '0' }]));
    // Mid-travel when the projection is replaced: the residual is the only thing that could
    // survive a handoff, and it does not.
    motion.setResidual({ tx: 120, ty: -40, zoom: 8 });
    await act(async () => {
      rendered.unmount();
    });
    expect(motion.counts.reset).toBe(1);
    expect(motion.residual()).toEqual({ tx: 0, ty: 0, zoom: 1 });
  });

  it('A37 — a touch mid-travel selects what the eye sees, not what canonical truth alone would place', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const { placed, motion } = await paintScene(store, WORLD([{ id: 'thread-a', x: '0', y: '0' }]));
    const home = placed.visibleNodes.find((node) => node.locus?.kind === 'THREAD_HOME');
    if (home === undefined) throw new Error('expected a placed Home');

    // The plane is carrying 60 points of residual: the Home is DRAWN 60 points to the right.
    motion.setResidual({ tx: 60, ty: 0, zoom: 1 });
    // A touch where it is drawn hits it...
    expect(hitTest(placed, motion.canonicalPointAt({ x: home.x + 60, y: home.y }))?.key).toBe(home.key);
    // ...and a touch at its canonical placement, where nothing is drawn, hits nothing.
    expect(hitTest(placed, motion.canonicalPointAt({ x: home.x, y: home.y }))).toBeNull();
  });
});

describe('T10-A30, A31, A32 — arrivals are earned, local and unordered', () => {
  it('A30 — a new object travels only from a host that is disclosed right now', () => {
    const plan = disclosureArrivalPlan({ newlyDisclosed: true, hostOffset: { x: -40, y: 12 }, reducedMotion: false });
    expect(plan.animated).toBe(true);
    expect(plan.fromX).toBe(-40);
    expect(plan.fromY).toBe(12);
    expect(plan.fromScale).toBeGreaterThanOrEqual(0.88);
    expect(plan.fromScale).toBeLessThanOrEqual(0.92);
    expect(plan.durationMs).toBeLessThanOrEqual(260);
  });

  it('A31 — with no disclosed host the object resolves where it belongs, inventing no origin', () => {
    const plan = disclosureArrivalPlan({ newlyDisclosed: true, hostOffset: null, reducedMotion: false });
    expect(plan.animated).toBe(true);
    expect(plan.fromX).toBe(0);
    expect(plan.fromY).toBe(0);
    expect(plan.durationMs).toBe(MOTION_DURATIONS_MS.localResolve);
    // Nothing in the world appears from nothing. Every standard-motion arrival carries the entry
    // scale, travelling or not: a pure opacity fade with no initial transform reads as an object
    // materialising rather than resolving (`/review-animations`).
    expect(plan.fromScale).toBe(DISCLOSURE_ENTRY_SCALE);
    expect(plan.fromScale).toBeGreaterThanOrEqual(0.88);
    expect(plan.fromScale).toBeLessThan(1);
  });

  it('A32 — simultaneous arrivals carry no order at all: there is no delay to give one', () => {
    const first = disclosureArrivalPlan({ newlyDisclosed: true, hostOffset: { x: -40, y: 0 }, reducedMotion: false });
    const second = disclosureArrivalPlan({ newlyDisclosed: true, hostOffset: { x: -40, y: 0 }, reducedMotion: false });
    expect(first).toEqual(second);
    // Structural: the plan has no delay, index, ordinal or stagger field for an order to live in.
    expect(Object.keys(first).sort()).toEqual(['animated', 'durationMs', 'fromScale', 'fromX', 'fromY']);
  });

  it('no standard-motion arrival is a pure fade (/review-animations)', () => {
    // A pure opacity entrance with no initial transform is a comes-from-nowhere. Every arrival
    // that moves at standard motion carries the entry scale, hosted or not.
    for (const hostOffset of [null, { x: -40, y: 12 }, { x: 0, y: 0 }]) {
      const plan = disclosureArrivalPlan({ newlyDisclosed: true, hostOffset, reducedMotion: false });
      expect(plan.animated).toBe(true);
      expect(plan.fromScale).toBe(DISCLOSURE_ENTRY_SCALE);
      expect(plan.fromScale).toBeGreaterThanOrEqual(0.88);
      expect(plan.fromScale).toBeLessThan(1);
    }
    // Reduced motion is the ONE exception, and it is the rule working: movement is what gets
    // removed there, so the opacity bridge is deliberately left alone.
    expect(disclosureArrivalPlan({ newlyDisclosed: true, hostOffset: null, reducedMotion: true }).fromScale).toBe(1);
  });

  it('nothing arrives from nowhere on the first painted frame', () => {
    const plan = disclosureArrivalPlan({ newlyDisclosed: false, hostOffset: { x: -40, y: 12 }, reducedMotion: false });
    expect(plan).toEqual({ animated: false, fromScale: 1, fromX: 0, fromY: 0, durationMs: 0 });
  });

  it('reduced motion keeps the bridge and drops every movement in it (A58)', () => {
    const plan = disclosureArrivalPlan({ newlyDisclosed: true, hostOffset: { x: -40, y: 12 }, reducedMotion: true });
    expect(plan.animated).toBe(true);
    expect(plan.fromX).toBe(0);
    expect(plan.fromY).toBe(0);
    expect(plan.fromScale).toBe(1);
    expect(plan.durationMs).toBe(MOTION_DURATIONS_MS.reducedResolve);
  });
});
