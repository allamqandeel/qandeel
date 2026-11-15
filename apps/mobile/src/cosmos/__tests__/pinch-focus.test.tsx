// COSMOS (experimental, isolated) — the optical pinch keeps the world point under the fingers, and the settle that
// follows keeps it only when asked to (`keepAnchor`). Headless: the two runtimes are one and every animation lands at
// once (jest.setup), so what is asserted is the camera arithmetic, not timing.
//
// The invariant under test (PO, 2026-11-15): during a pinch the scene magnifies about the actual midpoint between the
// fingers; the world point there stays under the midpoint as the scale changes; if the midpoint moves the scene
// follows; this holds off-centre, at the corners, IN and OUT, across rapid repeats and across a settle; and the settle
// about the fingers moves nothing on the glass, where a re-anchoring settle (the old release path) does.

import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { createRef } from 'react';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { project, unproject, zoomAbout, type NasijCamera, type NasijView } from '../core/camera';
import { compileStage } from '../core/stage';
import { CosmosCanvas, type CosmosCanvasHandle } from '../skia/CosmosCanvas';

jest.mock('@shopify/react-native-skia', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const element = (name: string) => {
    const Component = ({ children }: { children?: unknown }) => React.createElement(View, { skiaElement: name } as object, (children ?? null) as never);
    Component.displayName = name;
    return Component;
  };
  const disposable = () => ({ dispose: () => undefined });
  const builder = () => { const b: Record<string, unknown> = { build: disposable, dispose: () => undefined }; for (const m of ['moveTo', 'lineTo', 'close']) b[m] = () => b; return b; };
  const image = { width: () => 1024, height: () => 1024, dispose: () => undefined };
  return {
    Canvas: element('Canvas'), Fill: element('Fill'), Group: element('Group'), Path: element('Path'), Rect: element('Rect'), RadialGradient: element('RadialGradient'),
    LinearGradient: element('LinearGradient'), ImageShader: element('ImageShader'), Atlas: element('Atlas'),
    FilterMode: { Nearest: 0, Linear: 1 }, MipmapMode: { None: 0, Nearest: 1, Linear: 2 },
    useImage: () => image,
    Skia: { XYWHRect: disposable, RSXform: disposable, PathBuilder: { Make: builder } },
  };
});
beforeAll(() => {
  const reanimated = jest.requireMock<{ useSharedValue: <T>(initial: T) => { get(): T; set(next: T): void; modify?: (fn: (value: T) => T) => void } }>('react-native-reanimated');
  const boxed = reanimated.useSharedValue;
  reanimated.useSharedValue = <T,>(initial: T) => { const box = boxed(initial); box.modify ??= (fn) => box.set(fn(box.get())); return box; };
});

const W = 390; const H = 844;
const VIEW: NasijView = { width: W, height: H, focusX: W / 2, focusY: H / 2 };
const HOME: NasijCamera = { cx: 0, cy: 0, scale: 1 };
const STAGE = compileStage({ world: 'PUBLIC', rungs: 3, entities: [], focusId: null, rtl: false });
const near = (a: { x: number; y: number }, b: { x: number; y: number }, tol = 0.01) => Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;

interface Ends { pinches: { direction: 'IN' | 'OUT' | null; fx: number; fy: number; camera: NasijCamera }[]; pans: NasijCamera[]; settled: NasijCamera[] }
let view: RenderResult | null = null;
let ends: Ends;
const handle = createRef<CosmosCanvasHandle>();

const mount = async (initialCamera: NasijCamera = HOME) => {
  ends = { pinches: [], pans: [], settled: [] };
  view = await render(
    <CosmosCanvas
      ref={handle} world="PUBLIC" stage={STAGE} held={null} rung={0} rtl={false} initialCamera={initialCamera} mode="FULL" drift={false}
      onPanEnd={(camera) => { ends.pans.push(camera); }}
      onPinchEnd={(direction, fx, fy, camera) => { ends.pinches.push({ direction, fx, fy, camera }); }}
      onTap={() => undefined} onSettled={(camera) => { ends.settled.push(camera); }}
      accessibilityLabel="The world · test" zoomInLabel="in" zoomOutLabel="out" onZoomIn={() => undefined} onZoomOut={() => undefined}
      labelOf={() => ''} onActivate={() => undefined}
    />,
  );
  await act(async () => { fireEvent(view!.getByLabelText('The world · test'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: W, height: H } } }); });
};
afterEach(async () => { await cleanup(); view = null; });

const pinch = () => getByGestureTestId('cosmos-pinch');
/** One pinch, as ONE event sequence (the test utility pads a call with BEGAN / END): fingers at (x, y), ratio
 * `scale`, optionally with the midpoint moving by (dx, dy) across the gesture. */
const doPinch = async (x: number, y: number, scale: number, dx = 0, dy = 0, androidLift = false) => {
  await act(async () => {
    fireGestureHandler(pinch(), [
      { state: State.BEGAN, scale: 1, focalX: x, focalY: y, numberOfPointers: 2 },
      { state: State.ACTIVE, scale: 1, focalX: x, focalY: y, numberOfPointers: 2 },
      { state: State.ACTIVE, scale: Math.sqrt(scale), focalX: x + dx / 2, focalY: y + dy / 2, numberOfPointers: 2 },
      { state: State.ACTIVE, scale, focalX: x + dx, focalY: y + dy, numberOfPointers: 2 },
      // Android (RNGH): the handler stays active through the first finger's lift and reports one more update whose
      // focal is the one finger still down, 200 px left of the midpoint here; it must move nothing.
      ...(androidLift ? [{ state: State.ACTIVE, scale, focalX: x + dx - 200, focalY: y + dy, numberOfPointers: 1 }] : []),
      { state: State.END, scale, focalX: x + dx - (androidLift ? 200 : 0), focalY: y + dy, numberOfPointers: androidLift ? 1 : 2 },
    ]);
  });
  return ends.pinches[ends.pinches.length - 1];
};

describe('the optical pinch keeps the world point under the fingers', () => {
  it('stationary, off-centre, IN: the point under the fingers is unchanged and the ratio asks for one step IN', async () => {
    await mount();
    const before = unproject(HOME, VIEW, 300, 700);
    const end = await doPinch(300, 700, 1.5);
    expect(end.direction).toBe('IN');
    expect([end.fx, end.fy]).toEqual([300, 700]);
    expect(end.camera.scale).toBeCloseTo(1.5, 6);
    expect(near(unproject(end.camera, VIEW, 300, 700), before)).toBe(true);
    // And not about the centre: a centre-anchored zoom would have moved that point by a third of its offset.
    expect(near(unproject({ ...HOME, scale: 1.5 }, VIEW, 300, 700), before)).toBe(false);
  });

  it('stationary, off-centre, OUT (inside the rubber band): the same invariant, one step OUT', async () => {
    await mount({ cx: 40, cy: -20, scale: 8 });
    const before = unproject({ cx: 40, cy: -20, scale: 8 }, VIEW, 90, 150);
    const end = await doPinch(90, 150, 0.6);
    expect(end.direction).toBe('OUT');
    expect(end.camera.scale).toBeCloseTo(8 * 0.6, 6);
    expect(near(unproject(end.camera, VIEW, 90, 150), before)).toBe(true);
  });

  it('a moving midpoint: the point that was under the fingers at the start is under them where they are at the end', async () => {
    await mount();
    const before = unproject(HOME, VIEW, 300, 700);
    const end = await doPinch(300, 700, 1.5, 40, 30);
    expect([end.fx, end.fy]).toEqual([340, 730]);
    expect(near(unproject(end.camera, VIEW, 340, 730), before)).toBe(true);
  });

  it('the Android lift: a last one-finger update (the remaining finger) before the end moves nothing, stationary and moving', async () => {
    await mount();
    const before = unproject(HOME, VIEW, 300, 700);
    const end = await doPinch(300, 700, 1.5, 0, 0, true);
    expect([end.fx, end.fy]).toEqual([300, 700]);
    expect(near(unproject(end.camera, VIEW, 300, 700), before)).toBe(true);
    const before2 = unproject(end.camera, VIEW, 500, 900);
    const end2 = await doPinch(500, 900, 1.4, 40, 30, true);
    expect([end2.fx, end2.fy]).toEqual([540, 930]);
    expect(near(unproject(end2.camera, VIEW, 540, 930), before2)).toBe(true);
  });

  it('at the four corners, IN and OUT, the invariant holds', async () => {
    for (const [x, y] of [[12, 12], [W - 12, 12], [12, H - 12], [W - 12, H - 12]] as const) {
      await mount({ cx: 5, cy: 7, scale: 8 });
      const start: NasijCamera = { cx: 5, cy: 7, scale: 8 };
      const before = unproject(start, VIEW, x, y);
      const inEnd = await doPinch(x, y, 2);
      expect(near(unproject(inEnd.camera, VIEW, x, y), before)).toBe(true);
      const outEnd = await doPinch(x, y, 0.6);
      expect(near(unproject(outEnd.camera, VIEW, x, y), before)).toBe(true);
      await cleanup();
    }
  });

  it('rapid repeated pinches: each holds the point under its own fingers, relative to the camera the previous one left', async () => {
    await mount();
    const first = await doPinch(300, 700, 1.5);
    const underSecondBefore = unproject(first.camera, VIEW, 80, 200);
    const second = await doPinch(80, 200, 1.4);
    expect(near(unproject(second.camera, VIEW, 80, 200), underSecondBefore)).toBe(true);
    expect(ends.pinches).toHaveLength(2);
  });

  it('a settle about the fingers moves nothing on the glass; a re-anchoring settle drifts the point toward the centre', async () => {
    await mount();
    const w = unproject(HOME, VIEW, 300, 700);
    const end = await doPinch(300, 700, 1.05); // below the step threshold: the ratio asks for nothing
    expect(end.direction).toBeNull();
    // The release the host should ask for: back to the canonical scale ABOUT the fingers.
    const anchored = zoomAbout(end.camera, VIEW, 300, 700, 1);
    await act(async () => { handle.current!.settleTo(anchored, H / 2, { keepAnchor: true }); });
    const settled = ends.settled[ends.settled.length - 1];
    expect(near(project(settled, VIEW, w.x, w.y), { x: 300, y: 700 })).toBe(true);
    // The old release path: the released CENTRE at the canonical scale, re-anchored at the destination.
    const recentred: NasijCamera = { cx: end.camera.cx, cy: end.camera.cy, scale: 1 };
    const drift = project(recentred, VIEW, w.x, w.y);
    expect(near(drift, { x: 300, y: 700 })).toBe(false);
    expect(Math.hypot(drift.x - 300, drift.y - 700)).toBeGreaterThan(5);
  });

  it('a pinch that begins while a settle is landing takes the world where it is, with no jump of the point under the fingers', async () => {
    await mount();
    const first = await doPinch(300, 700, 1.3);
    const target = zoomAbout(first.camera, VIEW, 300, 700, 8);
    await act(async () => { handle.current!.settleTo(target, H / 2, { keepAnchor: true }); });
    const landed = ends.settled[ends.settled.length - 1];
    const under = unproject(landed, VIEW, 120, 400);
    const second = await doPinch(120, 400, 0.6);
    expect(near(unproject(second.camera, VIEW, 120, 400), under)).toBe(true);
  });
});
