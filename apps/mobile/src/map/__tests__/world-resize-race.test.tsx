/**
 * SHARED-VIS-01 (controlled frozen-map correction) — a world frame resized while, or just after, the camera travels.
 *
 * The defect, as the device pass caught it: a place's panel is scrolled, Back steps the camera out (NEAR → MID, a
 * ×8 travel), the panel closes, the content-sized band shrinks and the world frame grows — and, about one time in four,
 * the world never came to rest again: no labels, no targets, until the reader dragged it.
 *
 * These tests run the REAL presentation camera, world surface and `WorldCanvas` against a model of Reanimated's two
 * runtimes (`ui-runtime-model`), so the interleaving that only a device produced is stated exactly: which React tasks
 * ran, when the UI runtime received their writes, and when it drew a frame.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- a jest.mock factory runs before the imports and must require */
import { act, cleanup, render } from '@testing-library/react-native';
import { useLayoutEffect, useMemo, type MutableRefObject } from 'react';

import { viewportEnvelope, type ViewportEnvelope } from '../camera';
import { WorldCanvas, useWorldFrame, useWorldMotion } from '../renderer';
import { worldPresentation } from '../visual';
import { canonicalWorldAddress, type CanonicalWorldAddress } from '../world';
import { focusField, zoomField, type PublicFieldCamera } from '../../public-world/field/public-field-camera';
import { placePublicField, type PublicWorldNode } from '../../public-world/field/public-field-projection';
import { resetReduceMotionForTests, type PresentationCameraBinding } from '../../motion';
import { sharedUiRuntimeModel, type ModelReaction } from '../../motion/__fixtures__/ui-runtime-model';
import type { PublicFieldEntry } from '../../runtime-entry';

jest.mock('react-native-worklets', () => {
  const { sharedUiRuntimeModel: model } = require('../../motion/__fixtures__/ui-runtime-model');
  return {
    scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => model().toReact(fn, args),
    scheduleOnUI: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
    createSerializable: (value: unknown) => value,
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text, Image, ScrollView, FlatList } = require('react-native');
  const { sharedUiRuntimeModel: model } = require('../../motion/__fixtures__/ui-runtime-model');
  const identity = (value: unknown) => value;
  const durationOf = (config: { duration?: number } | undefined) => config?.duration ?? 300;
  return {
    __esModule: true,
    default: { View, Text, Image, ScrollView, FlatList, createAnimatedComponent: identity },
    useSharedValue: (initial: unknown) => React.useState(() => model().makeValue(initial))[0],
    useAnimatedStyle: (updater: () => unknown) => updater(),
    useDerivedValue: (processor: () => unknown) => {
      const latest = React.useRef(processor);
      latest.current = processor;
      return React.useState(() => ({
        get value() {
          return latest.current();
        },
        get: () => latest.current(),
      }))[0];
    },
    // A mapper: registered after the commit, evaluated on the UI runtime's frames, first with no previous value.
    useAnimatedReaction: (prepare: () => unknown, react: (now: unknown, previous: unknown) => void, deps?: unknown[]) => {
      React.useEffect(() => {
        const reaction: ModelReaction = { prepare, react, first: true, previous: null };
        model().reactions.add(reaction);
        return () => {
          model().reactions.delete(reaction);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps);
    },
    useAnimatedRef: () => ({ current: null }),
    useEvent: () => () => undefined,
    setGestureState: () => undefined,
    makeMutable: (initial: unknown) => model().makeValue(initial),
    useReducedMotion: () => (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ === true,
    useFrameCallback: () => ({ callbackId: 0, isActive: false, setActive: () => undefined }),
    withTiming: (to: number, config?: { duration?: number }) => model().timing(to, durationOf(config)),
    withSpring: (to: number, config?: { duration?: number }) => model().timing(to, durationOf(config)),
    withDelay: (ms: number, next: unknown) => model().delay(ms, next),
    withSequence: (...parts: unknown[]) => model().sequence(...parts),
    withRepeat: identity,
    cancelAnimation: (value: unknown) => model().cancel(value),
    interpolate: () => 0,
    Easing: { bezier: (a: number, b: number, c: number, d: number) => ({ bezier: [a, b, c, d] }) },
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  };
});

const ui = sharedUiRuntimeModel;
jest.setTimeout(30_000);

const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const at = (x: bigint, y: bigint): CanonicalWorldAddress => {
  const a = canonicalWorldAddress(x, y);
  if (!a.ok) throw new Error('fixture');
  return a.address;
};
const entry = (n: number, x: bigint, y: bigint): PublicFieldEntry => ({ id: id(n), address: at(x, y), meaning: `meaning ${n}`, region: 'family.fear' });
// A cluster around the focused place, so MID shows several places and NEAR fewer.
const ENTRIES: readonly PublicFieldEntry[] = [
  entry(1, 300_000n, 600_000n),
  entry(2, 315_000n, 608_000n),
  entry(3, 290_000n, 590_000n),
  entry(4, 330_000n, 640_000n),
  entry(5, 260_000n, 560_000n),
  entry(6, 350_000n, 520_000n),
];
const FOCUS = ENTRIES[0]!;

/** The frame while the place's panel is open (the band holds the panel), and after Back (the band holds a line). */
const PANEL_OPEN = viewportEnvelope(411, 493)!;
const PANEL_CLOSED = viewportEnvelope(411, 833)!;

const NEAR = focusField(FOCUS.address);
const MID = (() => {
  const move = zoomField(NEAR, 'OUT', FOCUS.address);
  if (move.outcome !== 'MOVED') throw new Error('fixture');
  return move.camera;
})();

interface Probe {
  atRest: boolean;
  presented: readonly PublicWorldNode[];
  nodeAt: (x: number, y: number) => PublicWorldNode | null;
  motion: PresentationCameraBinding;
}

const OWNER = Object.freeze({ owner: 'world-resize-race' });
const noCause = () => null;

function World({ envelope, camera, probeRef }: { envelope: ViewportEnvelope; camera: PublicFieldCamera; probeRef: MutableRefObject<Probe | null> }) {
  const worldMotion = useWorldMotion<PublicFieldCamera>(envelope);
  const placed = useMemo(() => placePublicField({ camera, envelope, entries: ENTRIES, results: [], focusId: FOCUS.id }), [camera, envelope]);
  const frame = useWorldFrame<PublicFieldCamera, PublicWorldNode>(worldMotion, { owner: OWNER, camera, envelope, placed, membership: null, cause: noCause });
  const world = useMemo(
    () => worldPresentation(camera, { reducedMotion: worldMotion.motion.reducedMotion, contrast: 'standard', inspection: null }),
    [camera, worldMotion.motion.reducedMotion],
  );
  // What this commit shows, read by the test after every commit.
  useLayoutEffect(() => {
    probeRef.current = { atRest: worldMotion.atRest, presented: frame.presented, nodeAt: frame.nodeAt, motion: worldMotion.motion };
  });
  return (
    <WorldCanvas<PublicWorldNode>
      testID="race-canvas"
      envelope={envelope}
      motion={worldMotion.motion}
      presented={frame.presented}
      newlyDisclosed={frame.newlyDisclosed}
      arrivals={worldMotion.arrivals}
      cameraCommit={frame.cameraCommit}
      world={world}
      isPlace={() => true}
      hostOf={() => undefined}
      renderObject={() => null}
    />
  );
}

/** One React task (a commit and its effects); what it posted is then received by the UI runtime. */
async function reactTask(work: () => Promise<void> | void) {
  await work();
  ui().deliver();
}

/** One UI frame, and whatever it handed to the React runtime, run as the React runtime's next task. */
async function uiFrame() {
  let moved = false;
  await act(async () => {
    moved = ui().frame();
    moved = ui().drainReact() > 0 || moved;
  });
  moved = ui().pending() > 0 || moved;
  ui().deliver();
  return moved;
}

/** Frames until nothing has moved for a few frames running (bounded: a travel is well under a second). */
async function settle(maxFrames = 240) {
  let quiet = 0;
  for (let i = 0; i < maxFrames && quiet < 3; i += 1) quiet = (await uiFrame()) ? 0 : quiet + 1;
}

const keys = (nodes: readonly PublicWorldNode[]) => nodes.map((node) => node.key).sort();

async function mount(envelope: ViewportEnvelope, camera: PublicFieldCamera) {
  const probe: MutableRefObject<Probe | null> = { current: null };
  const view = await render(<World envelope={envelope} camera={camera} probeRef={probe} />);
  ui().deliver();
  const show = (next: { envelope?: ViewportEnvelope; camera?: PublicFieldCamera }) => {
    envelope = next.envelope ?? envelope;
    camera = next.camera ?? camera;
    return view.rerender(<World envelope={envelope} camera={camera} probeRef={probe} />);
  };
  return { probe, show };
}

/** What a world drawn at rest at this camera and frame presents: a fresh surface, never moved. */
async function restingPresented(envelope: ViewportEnvelope, camera: PublicFieldCamera) {
  const { probe } = await mount(envelope, camera);
  await settle(4);
  const presented = keys(probe.current!.presented);
  await cleanup();
  ui().reset();
  return presented;
}

/** The place's panel open at NEAR, the world at rest, as the reader sees it before Back. */
async function atNearWithPanel() {
  const world = await mount(PANEL_OPEN, NEAR);
  await settle(4);
  expect(world.probe.current!.atRest).toBe(true);
  return world;
}

/** The world came to rest, and what is on the glass is exactly what a world at rest there shows — and can be touched. */
async function expectSettledAtMidWithClosedPanel(probe: MutableRefObject<Probe | null>, expected: readonly string[]) {
  await settle();
  const now = probe.current!;
  expect(now.motion.readResidual()).toEqual({ tx: 0, ty: 0, zoom: 1 });
  expect(now.atRest).toBe(true);
  expect(keys(now.presented)).toEqual(expected);
  // Paint, pointer and act agree: every presented place is the place a touch at its centre selects.
  expect(now.presented.length).toBeGreaterThan(1);
  for (const node of now.presented) expect(now.nodeAt(node.x, node.y)?.key).toBe(node.key);
}

let expectedAtMid: readonly string[] = [];

beforeAll(async () => {
  ui().reset();
  expectedAtMid = await restingPresented(PANEL_CLOSED, MID);
});

beforeEach(() => {
  ui().reset();
  (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = false;
  resetReduceMotionForTests();
});

afterEach(async () => {
  await cleanup();
  ui().reset();
  (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = false;
  resetReduceMotionForTests();
});

describe('SHARED-VIS-01 — a world frame resized around a camera travel', () => {
  it('the device interleaving: Back commits, then the frame grows, before the UI runtime draws a frame', async () => {
    const { probe, show } = await atNearWithPanel();
    await reactTask(() => show({ camera: MID }));
    await reactTask(() => show({ envelope: PANEL_CLOSED }));
    await expectSettledAtMidWithClosedPanel(probe, expectedAtMid);
  });

  it('Back and the larger frame in the same commit', async () => {
    const { probe, show } = await atNearWithPanel();
    await reactTask(() => show({ camera: MID, envelope: PANEL_CLOSED }));
    await expectSettledAtMidWithClosedPanel(probe, expectedAtMid);
  });

  it.each([1, 3, 8, 15])('the frame grows %i frame(s) into the travel, while the camera is still moving', async (frames) => {
    const { probe, show } = await atNearWithPanel();
    await reactTask(() => show({ camera: MID }));
    for (let i = 0; i < frames; i += 1) await uiFrame();
    expect(probe.current!.motion.readResidual().zoom).not.toBe(1);
    await reactTask(() => show({ envelope: PANEL_CLOSED }));
    await expectSettledAtMidWithClosedPanel(probe, expectedAtMid);
  });

  it('a resize does not cut the travel short: the camera keeps travelling instead of jumping to its end', async () => {
    const { probe, show } = await atNearWithPanel();
    await reactTask(() => show({ camera: MID }));
    await uiFrame();
    await uiFrame();
    const before = probe.current!.motion.readResidual().zoom;
    expect(before).toBeGreaterThan(1);
    await reactTask(() => show({ envelope: PANEL_CLOSED }));
    await uiFrame();
    const after = probe.current!.motion.readResidual().zoom;
    expect(after).toBeGreaterThan(1);
    expect(after).toBeLessThanOrEqual(before);
    await expectSettledAtMidWithClosedPanel(probe, expectedAtMid);
  });

  it('the frame grows just before and just after the camera comes to rest', async () => {
    for (const lateness of ['BEFORE_REST', 'AT_REST', 'AFTER_REST'] as const) {
      const { probe, show } = await atNearWithPanel();
      await reactTask(() => show({ camera: MID }));
      // Frames until the residual reaches rest, stopping one frame short, on it, or one frame past it.
      for (let i = 0; i < 240; i += 1) {
        const zoom = probe.current!.motion.readResidual().zoom;
        if (lateness === 'BEFORE_REST' && zoom !== 1 && zoom < 1.05) break;
        if (lateness !== 'BEFORE_REST' && zoom === 1) break;
        await uiFrame();
      }
      if (lateness === 'AFTER_REST') await uiFrame();
      await reactTask(() => show({ envelope: PANEL_CLOSED }));
      await expectSettledAtMidWithClosedPanel(probe, expectedAtMid);
      await cleanup();
      ui().reset();
    }
  });

  it('the panel opening again: the frame shrinks as the camera steps in (MID → NEAR)', async () => {
    const world = await mount(PANEL_CLOSED, MID);
    await settle(4);
    await reactTask(() => world.show({ camera: NEAR }));
    await reactTask(() => world.show({ envelope: PANEL_OPEN }));
    await settle();
    const now = world.probe.current!;
    expect(now.atRest).toBe(true);
    await cleanup();
    ui().reset();
    expect(keys(now.presented)).toEqual(await restingPresented(PANEL_OPEN, NEAR));
  });

  it('under Reduced Motion the step is a cut, and a resize around it still comes to rest', async () => {
    (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = true;
    resetReduceMotionForTests();
    const { probe, show } = await atNearWithPanel();
    expect(probe.current!.motion.reducedMotion).toBe(true);
    await reactTask(() => show({ camera: MID }));
    await reactTask(() => show({ envelope: PANEL_CLOSED }));
    await expectSettledAtMidWithClosedPanel(probe, expectedAtMid);
  });

  it('a resize at rest is still exactly a window resize: nothing moves and nothing is withheld', async () => {
    const { probe, show } = await atNearWithPanel();
    await reactTask(() => show({ camera: MID }));
    await settle();
    await reactTask(() => show({ envelope: PANEL_CLOSED }));
    expect(probe.current!.atRest).toBe(true);
    expect(probe.current!.motion.readResidual()).toEqual({ tx: 0, ty: 0, zoom: 1 });
    expect(keys(probe.current!.presented)).toEqual(expectedAtMid);
  });

  it('leaving the world still leaves no residual behind (unmount resets the plane)', async () => {
    const { probe, show } = await atNearWithPanel();
    await reactTask(() => show({ camera: MID }));
    await uiFrame();
    const motion = probe.current!.motion;
    expect(motion.readResidual().zoom).toBeGreaterThan(1);
    await cleanup();
    ui().deliver();
    expect(motion.readResidual()).toEqual({ tx: 0, ty: 0, zoom: 1 });
  });
});
