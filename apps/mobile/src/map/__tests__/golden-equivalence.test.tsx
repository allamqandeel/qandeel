/**
 * S5-03B Phase 1 — the Personal Living Analysis Map's GOLDEN EQUIVALENCE.
 *
 * The generic world seam (`WorldCanvas`, `useWorldSurface`, the material / shape split of the world marks) is
 * extracted from the Stage-2 Map under one promise: the Personal Map paints and behaves exactly as it did. This
 * suite is that promise made checkable. It renders the PRODUCTION `MapSurface` (over a real canonical store) and
 * the production `MapCanvas` (under the presentation-camera stub, for the states a settled surface cannot hold)
 * across the matrix below, serialises every element of the declarative Skia stand-in IN ORDER with all of its
 * props, and compares the result with `__golden__/personal-map.golden.json`.
 *
 * The golden was generated from the implementation BEFORE the extraction (`QANDEEL_WRITE_GOLDEN=1`), and is
 * never regenerated to make a refactor pass: a difference is a Personal regression, not a new baseline.
 *
 *   FAR / MID / NEAR · Home · contextual appearance · tether · register · selection (identity and named
 *   appearance) · arrival in progress (surface and canvas) · travel in progress · empty world · stale context ·
 *   increased contrast · reduced motion
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, cleanup, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { disclosureFixture } from '../__fixtures__/disclosure';
import { address, contextOf, envelope } from '../__fixtures__/store';
import { canvasProps } from '../../motion/__fixtures__/canvas';
import { stubPresentationCamera } from '../../motion/__fixtures__/presentation-camera';
import { createCanonicalStore, sessionPosition, type CanonicalStore, type SemanticDepth } from '../../state';
import { DEFAULT_MAP_SCALE, WORLD_ORIGIN, decodeCameraIntent, envelopeCenter, initialCameraIntent, zoomSemanticStep, type MapCamera } from '../camera';
import { MAP_ACTION_AUTHORITY, inspectObject } from '../inspection';
import { MapCanvas, MapSurface, placeScene } from '../renderer';
import { worldPresentation } from '../visual';
import { scaleBy, type MapScale } from '../world';

const GOLDEN = join(__dirname, '__golden__', 'personal-map.golden.json');
const WRITE = process.env.QANDEEL_WRITE_GOLDEN === '1';
const view = envelope();

const MID_SCALE = scaleBy(DEFAULT_MAP_SCALE, 1n, 8n);
const NEAR_SCALE = scaleBy(MID_SCALE, 1n, 8n);

/** Off the origin, so the world-anchored strata drift (and reduced motion visibly holds them still). */
const ANCHOR = address(150_000n, -90_000n);

function store(depth: SemanticDepth, scale: MapScale): CanonicalStore {
  return createCanonicalStore(
    {
      session: { id: 'session-1' },
      live: { LH: sessionPosition(4), LF: { value: { kind: 'NONE' }, atSp: null } },
      temporal: { kind: 'FOLLOW_LIVE' },
      inspection: null,
      camera: initialCameraIntent(ANCHOR, scale, depth),
    },
    { mapActionAuthority: MAP_ACTION_AUTHORITY },
  );
}

const cameraOf = (s: CanonicalStore): MapCamera => {
  const decoded = decodeCameraIntent(s.getState().camera);
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
};

/** Homes a Home-step apart, two hosted Readings, an Emerging Focus and an ungrounded Reading (the register). */
const WORLD = (depth: SemanticDepth, withSecondAppearance = true) =>
  disclosureFixture({
    depth,
    threads: [
      { id: 'thread-a', x: '0', y: '0' },
      { id: 'thread-b', x: '400000', y: '0' },
      { id: 'thread-c', x: '-300000', y: '250000' },
    ],
    appearances: [
      { bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
      ...(withSecondAppearance ? [{ bindingId: 'binding-2', threadId: 'thread-a', readingId: 'reading-2', boundSp: 3 }] : []),
    ],
    focuses: [{ id: 'focus-1', startedSp: 1 }],
    readings: [{ id: 'reading-1' }, ...(withSecondAppearance ? [{ id: 'reading-2' }] : []), { id: 'reading-orphan' }],
  });

/** Every host element in order, with every prop: functions by name, animated handles by their current value. */
function serialise(json: unknown): unknown {
  const value = (input: unknown, depth = 0): unknown => {
    if (typeof input === 'function') return '[fn]';
    if (input === null || typeof input !== 'object') return typeof input === 'number' && !Number.isFinite(input) ? String(input) : input;
    if (depth > 8) return '[deep]';
    if (Array.isArray(input)) return input.map((entry) => value(entry, depth + 1));
    const record = input as Record<string, unknown>;
    if ('value' in record && typeof (record as { get?: unknown }).get === 'function') return { $animated: value(record.value, depth + 1) };
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) out[key] = value(record[key], depth + 1);
    return out;
  };
  const node = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') return input;
    if (Array.isArray(input)) return input.map(node);
    const record = input as { type?: string; props?: Record<string, unknown>; children?: unknown[] | null };
    const props: Record<string, unknown> = {};
    for (const key of Object.keys(record.props ?? {}).sort()) props[key] = value(record.props![key]);
    return { type: record.type, props, children: (record.children ?? []).map(node) };
  };
  return node(json);
}

const cases: Record<string, () => Promise<unknown>> = {};
const surface = (name: string, build: () => Promise<{ toJSON: () => unknown }>) => {
  cases[`surface:${name}`] = async () => serialise((await build()).toJSON());
};

const mount = async (s: CanonicalStore, context: ReturnType<typeof contextOf>) => render(<MapSurface store={s} context={context} envelope={view} />);

surface('far-homes', async () => { const s = store('WORLD', DEFAULT_MAP_SCALE); return mount(s, contextOf(s, WORLD('WORLD'))); });
surface('mid-appearances-tethers', async () => { const s = store('THREAD', MID_SCALE); return mount(s, contextOf(s, WORLD('THREAD'))); });
surface('near-register-focus', async () => { const s = store('ANALYTICAL_OBJECT', NEAR_SCALE); return mount(s, contextOf(s, WORLD('ANALYTICAL_OBJECT'))); });
surface('selected-home', async () => {
  const s = store('ANALYTICAL_OBJECT', MID_SCALE);
  const context = contextOf(s, WORLD('ANALYTICAL_OBJECT'));
  const view_ = await mount(s, context);
  await act(async () => { inspectObject(s, context, { family: 'THREAD', id: 'thread-b' }); });
  return view_;
});
surface('selected-identity-everywhere', async () => {
  const s = store('ANALYTICAL_OBJECT', MID_SCALE);
  const context = contextOf(s, WORLD('ANALYTICAL_OBJECT'));
  const view_ = await mount(s, context);
  await act(async () => { inspectObject(s, context, { family: 'READING', id: 'reading-orphan' }); });
  return view_;
});
surface('selected-named-appearance', async () => {
  const s = store('ANALYTICAL_OBJECT', MID_SCALE);
  const context = contextOf(s, WORLD('ANALYTICAL_OBJECT'));
  const view_ = await mount(s, context);
  await act(async () => { inspectObject(s, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } }); });
  return view_;
});
surface('arrival-of-a-new-appearance', async () => {
  const s = store('THREAD', MID_SCALE);
  const view_ = await mount(s, contextOf(s, WORLD('THREAD', false)));
  await act(async () => { view_.rerender(<MapSurface store={s} context={contextOf(s, WORLD('THREAD', true))} envelope={view} />); });
  return view_;
});
surface('empty-world', async () => { const s = store('WORLD', DEFAULT_MAP_SCALE); return mount(s, contextOf(s, disclosureFixture({ depth: 'WORLD' }))); });
surface('stale-context', async () => {
  const s = store('WORLD', DEFAULT_MAP_SCALE);
  const context = contextOf(s, WORLD('WORLD'));
  const view_ = await mount(s, context);
  // The camera now discloses another rung: the WORLD scene is no longer this Map, and nothing of it may survive.
  await act(async () => { expect(zoomSemanticStep(s, 'IN').outcome).toBe('APPLIED'); });
  return view_;
});
surface('mid-analytical-baseline', async () => { const s = store('ANALYTICAL_OBJECT', MID_SCALE); return mount(s, contextOf(s, WORLD('ANALYTICAL_OBJECT'))); });
surface('increased-contrast', async () => {
  jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, 'isHighTextContrastEnabled').mockResolvedValue(true);
  const s = store('ANALYTICAL_OBJECT', MID_SCALE);
  const view_ = await mount(s, contextOf(s, WORLD('ANALYTICAL_OBJECT')));
  await act(async () => { await Promise.resolve(); });
  return view_;
});
surface('reduced-motion', async () => {
  (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = true;
  const s = store('ANALYTICAL_OBJECT', MID_SCALE);
  return mount(s, contextOf(s, WORLD('ANALYTICAL_OBJECT')));
});

/** The canvas under the stub camera: states a settled surface never holds still long enough to read. */
const canvas = (name: string, build: () => { element: JSX.Element }) => {
  cases[`canvas:${name}`] = async () => serialise((await render(build().element)).toJSON());
};
const nearScene = () => {
  const s = store('ANALYTICAL_OBJECT', MID_SCALE);
  const context = contextOf(s, WORLD('ANALYTICAL_OBJECT'));
  return { s, context, placed: placeScene(context.scene, cameraOf(s), view) };
};
canvas('arrival-in-progress-from-host-and-local', () => {
  const { placed } = nearScene();
  const motion = stubPresentationCamera({ center: envelopeCenter(view) });
  const keys = placed.nodes.filter((n) => n.id === 'reading-2' || n.id === 'thread-c' || n.id === 'reading-orphan').map((n) => n.key);
  return { element: <MapCanvas {...canvasProps({ placed, motion, envelope: view, newlyDisclosed: keys })} /> };
});
canvas('travel-in-progress-with-world-presentation', () => {
  const { s, placed } = nearScene();
  const motion = stubPresentationCamera({ center: envelopeCenter(view) });
  motion.setResidual({ tx: 37.5, ty: -12.25, zoom: 1 / Math.sqrt(8) });
  const world = worldPresentation(cameraOf(s), { reducedMotion: false, contrast: 'increased', inspection: null });
  return { element: <MapCanvas {...canvasProps({ placed, motion, envelope: view })} world={world} /> };
});
canvas('reduced-motion-arrival', () => {
  const { placed } = nearScene();
  const motion = stubPresentationCamera({ center: envelopeCenter(view), reducedMotion: true });
  const keys = placed.nodes.filter((n) => n.id === 'reading-1').map((n) => n.key);
  return { element: <MapCanvas {...canvasProps({ placed, motion, envelope: view, newlyDisclosed: keys })} /> };
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  delete (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__;
});

describe('S5-03B Phase 1 — the Personal Map is byte-for-byte what Stage 2 painted', () => {
  const recorded: Record<string, unknown> = existsSync(GOLDEN) ? JSON.parse(readFileSync(GOLDEN, 'utf8')) : {};
  const produced: Record<string, unknown> = {};

  it.each(Object.keys(cases))('%s', async (name) => {
    produced[name] = JSON.parse(JSON.stringify(await cases[name]()));
    if (WRITE) return;
    expect(recorded[name]).toBeDefined();
    expect(produced[name]).toEqual(recorded[name]);
  });

  it('covers every case of the golden, and the golden covers every case', () => {
    if (WRITE) {
      mkdirSync(join(__dirname, '__golden__'), { recursive: true });
      writeFileSync(GOLDEN, `${JSON.stringify(produced, null, 1)}\n`);
      return;
    }
    expect(Object.keys(recorded).sort()).toEqual(Object.keys(cases).sort());
  });
});
