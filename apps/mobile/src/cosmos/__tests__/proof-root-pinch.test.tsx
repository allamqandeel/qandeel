// COSMOS (experimental, isolated) — what the proof root asks of the authority when a pinch ends, and where the world
// point under the fingers is afterwards. The owners are the real ones over the fixtures; the acts they receive are
// recorded. Regression for the PO's finding (2026-11-15): after a pinch, the scene drifted toward the screen centre
// instead of staying about the fingers, mostly after a short (sub-threshold) or refused pinch, and after a pinch
// whose midpoint had moved.

import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { settle as flush } from '../../runtime-entry/__fixtures__/runtime-entry';
import { project, unproject, type NasijCamera, type NasijView } from '../core/camera';
import { COSMOS_COPY } from '../__validation__/copy';
import { COSMOS_HUD_TEST_ID, CosmosProofRoot } from '../__validation__/CosmosProofRoot';
import type { CosmosWorldOwner } from '../__validation__/owners';

type Act = { kind: 'pan'; camera: NasijCamera } | { kind: 'step'; direction: 'IN' | 'OUT'; focal: { x: number; y: number } | null; released: NasijCamera | null; applied: boolean };
const mockActs: Act[] = [];
const mockOwners: CosmosWorldOwner[] = [];
jest.mock('../__validation__/owners', () => {
  const actual = jest.requireActual<typeof import('../__validation__/owners')>('../__validation__/owners');
  return {
    ...actual,
    createCosmosOwner: (world: Parameters<typeof actual.createCosmosOwner>[0], options: Parameters<typeof actual.createCosmosOwner>[1]) => {
      const owner = actual.createCosmosOwner(world, options);
      const wrapped: typeof owner = {
        ...owner,
        pan: (camera) => { mockActs.push({ kind: 'pan', camera }); return owner.pan(camera); },
        step: (direction, focal, released) => { const r = owner.step(direction, focal, released); mockActs.push({ kind: 'step', direction, focal, released, applied: r.applied }); return r; },
      };
      mockOwners.push(wrapped);
      return wrapped;
    },
  };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { createElement, Fragment } = jest.requireActual<typeof import('react')>('react');
  return { SafeAreaProvider: ({ children }: { children: unknown }) => createElement(Fragment, null, children as never), useSafeAreaInsets: () => ({ top: 44, left: 0, right: 0, bottom: 34 }) };
});
jest.mock('../../integration/locale/device-locale', () => ({ deviceProductLanguage: () => 'en' }));
jest.mock('../__validation__/fixture-transports', () => {
  const actual = jest.requireActual<typeof import('../__validation__/fixture-transports')>('../__validation__/fixture-transports');
  const instant = <T extends { latency?: number }>(options: T): T => ({ ...options, latency: 0 });
  return {
    ...actual,
    createPublicFixtureTransport: (options: Parameters<typeof actual.createPublicFixtureTransport>[0]) => actual.createPublicFixtureTransport(instant(options)),
    createSharedFixtureTransport: (options: Parameters<typeof actual.createSharedFixtureTransport>[0], language: 'ar' | 'en') => actual.createSharedFixtureTransport(instant(options), language),
    createPersonalFixtureWorld: (options: Parameters<typeof actual.createPersonalFixtureWorld>[0], language: 'ar' | 'en') => actual.createPersonalFixtureWorld(instant(options), language),
  };
});
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

const copy = COSMOS_COPY.en;
const W = 390; const H = 844;
const VIEW: NasijView = { width: W, height: H, focusX: W / 2, focusY: H / 2 };
const near = (a: { x: number; y: number }, b: { x: number; y: number }, tol: number) => Math.hypot(a.x - b.x, a.y - b.y) <= tol;
let view: RenderResult | null = null;
const settle = async () => { await act(async () => { for (let i = 0; i < 8; i += 1) await flush(); }); };
const sky = (v: RenderResult) => v.getByLabelText(new RegExp(`^(${copy.sky}|${COSMOS_COPY.ar.sky}) ·`, 'u'));
const layout = async (v: RenderResult) => { await act(async () => { fireEvent(sky(v), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: W, height: H } } }); }); await settle(); };
const current = () => mockOwners[mockOwners.length - 1];
const pinchAt = async (x: number, y: number, scale: number, dx = 0, dy = 0) => {
  await act(async () => {
    fireGestureHandler(getByGestureTestId('cosmos-pinch'), [
      { state: State.BEGAN, scale: 1, focalX: x, focalY: y },
      { state: State.ACTIVE, scale: 1, focalX: x, focalY: y },
      { state: State.ACTIVE, scale: Math.sqrt(scale), focalX: x + dx / 2, focalY: y + dy / 2 },
      { state: State.ACTIVE, scale, focalX: x + dx, focalY: y + dy },
      { state: State.END, scale, focalX: x + dx, focalY: y + dy },
    ]);
  });
  await settle();
};
beforeEach(() => { mockActs.length = 0; mockOwners.length = 0; });
afterEach(async () => { await cleanup(); view = null; });

describe('CosmosProofRoot: where the point under the fingers is after a pinch', () => {
  it('Public, a short pinch below the step threshold, off-centre: the pan asked for keeps that point in place at the canonical scale', async () => {
    view = await render(<CosmosProofRoot />);
    await layout(view);
    expect(view.getByTestId(COSMOS_HUD_TEST_ID).props.children).toMatch(/29 entities/u);
    const before = current().getSnapshot().camera;
    const w = unproject(before, VIEW, 300, 700);
    await pinchAt(300, 700, 1.08);
    const pans = mockActs.filter((a): a is Extract<Act, { kind: 'pan' }> => a.kind === 'pan');
    expect(mockActs.some((a) => a.kind === 'step')).toBe(false);
    expect(pans).toHaveLength(1);
    // The camera handed to the authority is at the canonical scale with the fingers' point where the fingers are.
    expect(pans[0].camera.scale).toBeCloseTo(before.scale, 6);
    expect(near(project(pans[0].camera, VIEW, w.x, w.y), { x: 300, y: 700 }, 0.5)).toBe(true);
    const after = current().getSnapshot().camera;
    expect(near(project(after, VIEW, w.x, w.y), { x: 300, y: 700 }, 0.5)).toBe(true);
  });

  it('Personal, a refused step (OUT at the first rung): the point under the fingers stays where it is', async () => {
    view = await render(<CosmosProofRoot />);
    await layout(view);
    await act(async () => { fireEvent.press(view!.getByText(copy.PERSONAL.toUpperCase())); });
    await layout(view);
    expect(view.getByTestId(COSMOS_HUD_TEST_ID).props.children).toMatch(/8 entities/u);
    const before = current().getSnapshot().camera;
    const w = unproject(before, VIEW, 90, 650);
    await pinchAt(90, 650, 0.6);
    const step = mockActs.find((a): a is Extract<Act, { kind: 'step' }> => a.kind === 'step');
    expect(step?.direction).toBe('OUT');
    expect(step?.applied).toBe(false);
    const after = current().getSnapshot().camera;
    expect(after.scale).toBeCloseTo(before.scale, 6);
    expect(near(project(after, VIEW, w.x, w.y), { x: 90, y: 650 }, 0.5)).toBe(true);
  });

  it('Personal, a step IN whose midpoint moved during the pinch: the authority keeps the fingers’ point under the fingers', async () => {
    view = await render(<CosmosProofRoot />);
    await layout(view);
    await act(async () => { fireEvent.press(view!.getByText(copy.PERSONAL.toUpperCase())); });
    await layout(view);
    const before = current().getSnapshot().camera;
    const w = unproject(before, VIEW, 300, 700);
    await pinchAt(300, 700, 2, 40, 30);
    const step = mockActs.find((a): a is Extract<Act, { kind: 'step' }> => a.kind === 'step');
    expect(step?.direction).toBe('IN');
    expect(step?.applied).toBe(true);
    const after = current().getSnapshot().camera;
    expect(after.scale).toBeCloseTo(before.scale * 8, 6);
    // Within a point: the production step keeps its focal point fixed, and that focal must be the fingers.
    expect(near(project(after, VIEW, w.x, w.y), { x: 340, y: 730 }, 1)).toBe(true);
  });

  it('Personal, a step IN then a step OUT at the same off-centre fingers: back to the same canonical camera', async () => {
    view = await render(<CosmosProofRoot />);
    await layout(view);
    await act(async () => { fireEvent.press(view!.getByText(copy.PERSONAL.toUpperCase())); });
    await layout(view);
    const before = current().getSnapshot().camera;
    await pinchAt(300, 700, 2);
    expect(current().getSnapshot().camera.scale).toBeCloseTo(before.scale * 8, 6);
    await pinchAt(300, 700, 0.5);
    const after = current().getSnapshot().camera;
    expect(after.scale).toBeCloseTo(before.scale, 6);
    expect(near({ x: after.cx, y: after.cy }, { x: before.cx, y: before.cy }, 0.01)).toBe(true);
  });
});
