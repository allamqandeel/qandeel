/**
 * VPORT-01 — the Living Analysis World's expression: what it may paint, from what, and nothing else.
 *
 * These are component and unit claims over the declarative Skia stand-in. They prove the element tree,
 * the expression rules and the distance arithmetic; the pixels themselves are proved on a device by the
 * VPORT-01 visual proof.
 */
import { act, render } from '@testing-library/react-native';

import { disclosureFixture } from '../__fixtures__/disclosure';
import { contextOf, envelope, testStore } from '../__fixtures__/store';
import { canvasProps } from '../../motion/__fixtures__/canvas';
import { stubPresentationCamera } from '../../motion/__fixtures__/presentation-camera';
import { DEFAULT_MAP_SCALE, decodeCameraIntent, envelopeCenter, type MapCamera } from '../camera';
import { inspectObject } from '../inspection';
import {
  APPEARANCE_RADIUS_POINTS,
  HOME_RADIUS_POINTS,
  MapCanvas,
  MapSurface,
  REGISTER_RADIUS_POINTS,
  placeScene,
} from '../renderer';
import {
  DEFAULT_WORLD_PRESENTATION,
  MARK_RADIUS_POINTS,
  WORLD_VISUAL,
  approachOf,
  isSelectedNode,
  markerRadius,
  morphologyPath,
  presentationRotation,
  presentedApproach,
  stratumDrift,
  worldPresentation,
  worldSchedule,
  worldSelection,
  type WorldPresentation,
} from '../visual';
import { canonicalWorldAddress, scaleBy, type MapScale } from '../world';

const view = envelope();

const DISCLOSURE = () =>
  disclosureFixture({
    depth: 'ANALYTICAL_OBJECT',
    threads: [
      { id: 'thread-a', x: '0', y: '0' },
      { id: 'thread-b', x: '400000', y: '0' },
    ],
    appearances: [
      { bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
      { bindingId: 'binding-2', threadId: 'thread-a', readingId: 'reading-2', boundSp: 3 },
    ],
    focuses: [{ id: 'focus-1', startedSp: 1 }],
    readings: [{ id: 'reading-1' }, { id: 'reading-2' }, { id: 'reading-orphan' }],
  });

const cameraOf = (store: ReturnType<typeof testStore>): MapCamera => {
  const decoded = decodeCameraIntent(store.getState().camera);
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
};

interface TreeNode {
  readonly props?: Record<string, unknown>;
  readonly children?: readonly unknown[];
}

/** Every element of one Skia kind, with its props. */
function elements(json: unknown, kind: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const record = node as TreeNode;
    if (record.props?.skiaElement === kind) found.push(record.props);
    for (const child of record.children ?? []) walk(child);
  };
  walk(json);
  return found;
}

function paint(world: WorldPresentation = DEFAULT_WORLD_PRESENTATION) {
  const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
  const context = contextOf(store, DISCLOSURE());
  const placed = placeScene(context.scene, cameraOf(store), view);
  const motion = stubPresentationCamera({ center: envelopeCenter(view) });
  return { placed, element: <MapCanvas {...canvasProps({ placed, motion, envelope: view })} world={world} /> };
}

describe('distance is optical, on the canonical logarithmic footing', () => {
  it('the default viewpoint is FAR, one reinforcement step in is MID, two are NEAR', () => {
    expect(approachOf(DEFAULT_MAP_SCALE)).toBe(0);
    const one = scaleBy(DEFAULT_MAP_SCALE, 1n, 8n);
    const two = scaleBy(one, 1n, 8n);
    expect(approachOf(one)).toBeCloseTo(0.5, 10);
    expect(approachOf(two)).toBeCloseTo(1, 10);
    // Further out than the default clamps at FAR; further in clamps at NEAR.
    expect(approachOf(scaleBy(DEFAULT_MAP_SCALE, 8n, 1n))).toBe(0);
    expect(approachOf(scaleBy(two, 1n, 8n))).toBe(1);
  });

  it('the presented approach follows the residual: a travel starts at the old distance and ends at the new one', () => {
    // Zooming in by one rung: the canonical camera is already at MID; the residual still shows FAR.
    expect(presentedApproach(0.5, 1 / 8)).toBeCloseTo(0, 10);
    expect(presentedApproach(0.5, 1)).toBeCloseTo(0.5, 10);
    // Halfway along the logarithmic travel is halfway between the two materials.
    expect(presentedApproach(0.5, 1 / Math.sqrt(8))).toBeCloseTo(0.25, 10);
  });

  it('the schedule is the canonical one: FAR has no map floor, MID has it, NEAR resolves into the constellation', () => {
    const far = worldSchedule(0);
    const mid = worldSchedule(0.5);
    const near = worldSchedule(1);
    expect(far.far).toBe(1);
    expect(far.map).toBe(0);
    expect(mid.map).toBeGreaterThan(0.9);
    expect(mid.lod).toBe(0);
    expect(near.lod).toBe(1);
    expect(near.map).toBeLessThan(0.05);
  });
});

describe('the atmosphere is part of the world, and it never jumps', () => {
  const scale = DEFAULT_MAP_SCALE;
  const tile = 768;
  const wrap = (v: number) => ((v % tile) + tile) % tile;
  const address = (x: bigint, y: bigint) => {
    const decoded = canonicalWorldAddress(x, y);
    if (!decoded.ok) throw new Error('bad address');
    return decoded.address;
  };

  it('a pan rebases without moving the stratum: canonical offset change and residual cancel exactly', () => {
    for (const rate of [WORLD_VISUAL.parallax.far, WORLD_VISUAL.parallax.mid, WORLD_VISUAL.parallax.near]) {
      const before = stratumDrift(address(123456789n, -98765n), scale, tile, rate, false);
      // The camera moved right by 130 points: the anchor advanced by 130·upp world units, and the
      // rebase shows the old frame with a residual of +130 points.
      const upp = Number(scale.numerator) / Number(scale.denominator);
      const after = stratumDrift(address(123456789n + BigInt(130 * upp), -98765n), scale, tile, rate, false);
      expect(wrap(after.offsetX + after.follow * 130)).toBeCloseTo(wrap(before.offsetX), 6);
      expect(after.offsetY).toBeCloseTo(before.offsetY, 6);
    }
  });

  it('Semantic Zoom about a fixed anchor does not move a standard-motion stratum', () => {
    const anchor = address(987654321n, 123456789n);
    const before = stratumDrift(anchor, scale, tile, WORLD_VISUAL.parallax.mid, false);
    const after = stratumDrift(anchor, scaleBy(scale, 1n, 8n), tile, WORLD_VISUAL.parallax.mid, false);
    expect(after.offsetX).toBe(before.offsetX);
    expect(after.offsetY).toBe(before.offsetY);
    // ...and it follows the hand more slowly when the camera is closer: a deeper plane.
    expect(after.follow).toBeCloseTo(before.follow / 8, 10);
  });

  it('reduced motion: every plane moves with the world itself (D2R parallax-differential = 0)', () => {
    expect(WORLD_VISUAL.parallax.reducedDifferential).toBe(0);
    const anchor = address(5000000n, -7000000n);
    for (const rate of [WORLD_VISUAL.parallax.far, WORLD_VISUAL.parallax.mid]) {
      const drift = stratumDrift(anchor, scale, tile, rate, true);
      expect(drift.follow).toBe(1);
      const upp = Number(scale.numerator) / Number(scale.denominator);
      expect(wrap(-drift.offsetX)).toBeCloseTo(wrap(5000000 / upp), 6);
    }
  });
});

describe('the world expresses only what the Map holds', () => {
  it('one object per presented plane node, one register mark per ungeographic identity, nothing else', async () => {
    const { placed, element } = paint();
    const rendered = await render(element);
    const json = rendered.toJSON();
    const anchors = elements(json, 'Group').filter((p) => p.origin !== undefined && p.opacity === undefined && p.transform === undefined);
    expect(anchors).toHaveLength(placed.visibleNodes.length);
    for (const node of placed.visibleNodes) {
      expect(anchors.some((a) => (a.origin as { x: number }).x === node.x && (a.origin as { y: number }).y === node.y)).toBe(true);
    }
  });

  it('the only relation drawn is the hosting relation: one tether per contextual appearance, ending on its Home', async () => {
    const { placed, element } = paint();
    const rendered = await render(element);
    const paths = elements(rendered.toJSON(), 'Path').map((p) => p.path as string).filter((d) => /^M [-0-9.]+ [-0-9.]+ L [-0-9.]+ [-0-9.]+$/u.test(d));
    const appearances = placed.visibleNodes.filter((node) => node.locus?.kind === 'CONTEXTUAL_APPEARANCE');
    const home = placed.nodes.find((node) => node.locus?.kind === 'THREAD_HOME' && node.id === 'thread-a')!;
    // Three strokes per tether (ground, body, core), all on the same line.
    const lines = [...new Set(paths)];
    expect(lines).toHaveLength(appearances.length);
    for (const node of appearances) expect(lines).toContain(`M ${home.x} ${home.y} L ${node.x} ${node.y}`);
    // No line between two Homes, no line from an ungeographic identity.
    const other = placed.nodes.find((node) => node.id === 'thread-b')!;
    expect(lines.some((d) => d.includes(`${other.x} ${other.y}`))).toBe(false);
  });

  it('an ungeographic identity has no ground and no light: its mark, in screen space, and nothing else', async () => {
    const { placed, element } = paint();
    const rendered = await render(element);
    const json = rendered.toJSON();
    const register = placed.visibleNodes.filter((node) => node.region === 'UNGEOGRAPHIC_REGISTER');
    expect(register.map((node) => node.objectKey)).toEqual(['READING:reading-orphan', 'EMERGING_FOCUS:focus-1']);
    const lights = elements(json, 'Circle');
    for (const node of register) expect(lights.some((c) => c.cx === node.x && c.cy === node.y)).toBe(false);
  });

  it('every per-object quantity is constant per tier: two Homes are drawn identically apart from where they are', async () => {
    const { placed, element } = paint();
    const rendered = await render(element);
    const json = JSON.stringify(rendered.toJSON());
    const [a, b] = placed.visibleNodes.filter((node) => node.locus?.kind === 'THREAD_HOME');
    const lightsAt = (x: number, y: number) =>
      elements(JSON.parse(json), 'Circle')
        .filter((c) => c.cx === x && c.cy === y)
        .map((c) => ({ r: c.r }));
    expect(lightsAt(a.x, a.y)).toEqual(lightsAt(b.x, b.y));
    expect(lightsAt(a.x, a.y).length).toBeGreaterThan(0);
  });

  it('the canonical morphology of each family comes from the closed source, and its rotation means nothing', () => {
    expect(WORLD_VISUAL.shapes.THREAD.slot).toBe('THREAD');
    expect(WORLD_VISUAL.shapes.READING.slot).toBe('READING');
    expect(WORLD_VISUAL.shapes.EMERGING_FOCUS.slot).toBe('OPEN');
    expect(WORLD_VISUAL.shapes.EMERGING_FOCUS.stroked).toBe(true);
    // Deterministic per scene key, and independent of everything else.
    expect(presentationRotation('THREAD:thread-a@THREAD_HOME:thread-a')).toBe(presentationRotation('THREAD:thread-a@THREAD_HOME:thread-a'));
    expect(morphologyPath('THREAD', 10, 20, 6, 0)).toMatch(/^M 18\.04 20 A 8\.04 3\.72 /u);
  });

  it('every mark and marker stays inside the T-04 hit radius of its placement', () => {
    const extent = 1.42;
    expect(MARK_RADIUS_POINTS.THREAD_HOME * extent).toBeLessThan(HOME_RADIUS_POINTS);
    expect(MARK_RADIUS_POINTS.CONTEXTUAL_APPEARANCE * extent).toBeLessThan(APPEARANCE_RADIUS_POINTS);
    expect(MARK_RADIUS_POINTS.UNGEOGRAPHIC * extent).toBeLessThan(REGISTER_RADIUS_POINTS);
    const thickness = WORLD_VISUAL.palettes.standard.markerThickness;
    expect(markerRadius('THREAD_HOME', thickness) + thickness / 2).toBeLessThanOrEqual(HOME_RADIUS_POINTS);
    expect(markerRadius('CONTEXTUAL_APPEARANCE', thickness) + thickness / 2).toBeLessThanOrEqual(APPEARANCE_RADIUS_POINTS);
    expect(markerRadius('UNGEOGRAPHIC', thickness) + thickness / 2).toBeLessThanOrEqual(REGISTER_RADIUS_POINTS);
  });
});

describe('SELECTED is IF_ref, drawn as a shape', () => {
  it('nothing is selected until something is inspected; then exactly the inspected object carries the marker', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, DISCLOSURE());
    const rendered = await render(<MapSurface store={store} context={context} envelope={view} />);
    const markers = () => elements(rendered.toJSON(), 'Circle').filter((c) => c.style === 'stroke');
    expect(markers()).toHaveLength(0);

    await act(async () => {
      inspectObject(store, context, { family: 'THREAD', id: 'thread-b' });
    });
    const placed = placeScene(context.scene, cameraOf(store), view);
    const home = placed.nodes.find((node) => node.id === 'thread-b')!;
    expect(markers()).toHaveLength(1);
    expect(markers()[0]).toMatchObject({ cx: home.x, cy: home.y, color: WORLD_VISUAL.palettes.standard.selectedMarker });
  });

  it('an inspection through a named appearance selects that appearance only', () => {
    const selection = { objectKey: 'READING:reading-1', bindingId: 'binding-1' };
    const node = (bindingId: string) =>
      ({ objectKey: 'READING:reading-1', locus: { kind: 'CONTEXTUAL_APPEARANCE', bindingId } }) as unknown as Parameters<typeof isSelectedNode>[1];
    expect(isSelectedNode(selection, node('binding-1'))).toBe(true);
    expect(isSelectedNode(selection, node('binding-2'))).toBe(false);
    expect(isSelectedNode({ objectKey: 'READING:reading-1', bindingId: null }, node('binding-2'))).toBe(true);
    expect(worldSelection(null)).toBeNull();
  });
});

describe('increased contrast moves the analytical relation up one rung, and nothing becomes Light', () => {
  it('the F1 override is the frozen one', () => {
    expect(WORLD_VISUAL.palettes.standard.analysisRelation).toBe('#8b8982');
    expect(WORLD_VISUAL.palettes.increased.analysisRelation).toBe('#afaca3');
    expect(WORLD_VISUAL.palettes.increased.strokeAlphaMultiplier).toBe(0);
  });

  it('under increased contrast the hosting relation is drawn in the raised analytical ink, opaque', async () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const camera = cameraOf(store);
    const world = worldPresentation(camera, { reducedMotion: false, contrast: 'increased', inspection: null });
    const { element } = paint(world);
    const rendered = await render(element);
    const gradients = elements(rendered.toJSON(), 'LinearGradient').map((g) => g.colors as string[]);
    expect(gradients.some((colors) => colors.every((c) => c === 'rgba(175,172,163,1)'))).toBe(true);
  });

  it('the world is the Analysis world: dark only, whatever the reader chose elsewhere', () => {
    expect(Object.keys(WORLD_VISUAL.palettes).sort()).toEqual(['increased', 'standard']);
    expect(WORLD_VISUAL.palettes.standard.world).toBe('#101010');
    expect(WORLD_VISUAL.material.ground.every((hex) => Number.parseInt(hex.slice(1), 16) < 0x101010)).toBe(true);
  });
});

describe('the OPEN-17 channels reach the atmosphere as plain numbers, canonical at the default', () => {
  it('ambient and emptySpace at 0.5 draw the strata at exactly their canonical weight', async () => {
    const { element } = paint();
    const rendered = await render(element);
    const groups = elements(rendered.toJSON(), 'Group').filter((g) => typeof g.opacity === 'number');
    expect(groups.filter((g) => g.opacity === 1).length).toBeGreaterThanOrEqual(2);
  });

  it('a scale is a MapScale, and the world reads it only as distance', () => {
    const scale: MapScale = DEFAULT_MAP_SCALE;
    expect(Number(scale.numerator) / Number(scale.denominator)).toBe(8192);
  });
});
