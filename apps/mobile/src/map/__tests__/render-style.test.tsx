import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render } from '@testing-library/react-native';

import { disclosureFixture } from '../__fixtures__/disclosure';
import { contextOf, envelope, testStore } from '../__fixtures__/store';
import { buildMapAccessibilityTree } from '../accessibility';
import { canvasProps } from '../../motion/__fixtures__/canvas';
import { stubPresentationCamera } from '../../motion/__fixtures__/presentation-camera';
import { decodeCameraIntent, envelopeCenter } from '../camera';
import { deriveMapScene, mapProjectionRequest } from '../projection';
import { MAP_CANVAS_TEST_ID, MapCanvas, hitTest, placeScene, renderStyle, RENDER_STYLE_CHANNELS } from '../renderer';

const DISCLOSURE = () =>
  disclosureFixture({
    depth: 'SOURCE_PROVENANCE',
    threads: [
      { id: 'thread-a', x: '0', y: '0' },
      { id: 'thread-b', x: '400000', y: '0' },
    ],
    appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
    focuses: [{ id: 'focus-1', startedSp: 1 }],
    readings: [{ id: 'reading-1' }],
  });

const QUIET = renderStyle(0, 0);
const LOUD = renderStyle(1, 1);

interface RenderedNode {
  readonly type: unknown;
  readonly props: Record<string, unknown>;
  readonly children: readonly unknown[] | null;
}

const asNode = (value: unknown): RenderedNode | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && 'props' in value ? (value as unknown as RenderedNode) : null;

const stripOpacity = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripOpacity);
  const node = asNode(value);
  if (node === null) return value;
  const { opacity: _opacity, ...props } = node.props;
  return { type: node.type, props, children: (node.children ?? []).map(stripOpacity) };
};

const opacities = (value: unknown): number[] => {
  if (Array.isArray(value)) return value.flatMap(opacities);
  const node = asNode(value);
  if (node === null) return [];
  const own = typeof node.props.opacity === 'number' ? [node.props.opacity] : [];
  return [...own, ...(node.children ?? []).flatMap(opacities)];
};

describe('OPEN-17 — the two presentation channels change pixels and nothing else (M04-11)', () => {
  it('only two channels exist, and both are clamped presentation scalars', () => {
    expect([...RENDER_STYLE_CHANNELS]).toEqual(['ambient', 'emptySpace']);
    expect(renderStyle(-3, 12)).toEqual({ ambient: 0, emptySpace: 1 });
    expect(renderStyle(Number.NaN, 0.25)).toEqual({ ambient: 0, emptySpace: 0.25 });
  });

  it('the entitlement, placement and accessibility layers cannot take a RenderStyle at all', () => {
    const read = (...segments: string[]) => readFileSync(join(__dirname, '..', ...segments), 'utf8');
    for (const file of [
      ['projection', 'map-scene.ts'],
      ['renderer', 'map-geometry.ts'],
      ['accessibility', 'map-accessibility.ts'],
      ['inspection', 'entitlement.ts'],
      ['inspection', 'locatability.ts'],
      ['inspection', 'map-actions.ts'],
      ['camera', 'camera.ts'],
      ['camera', 'viewport.ts'],
    ]) {
      const code = read(...file).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');
      expect(code.includes('RenderStyle')).toBe(false);
      expect(code.includes('render-style')).toBe(false);
    }
  });

  it('M04-11 — two values preserve canonical state, V, Homes, scene membership and the a11y tree', async () => {
    const quietStore = testStore({ depth: 'SOURCE_PROVENANCE' });
    const loudStore = testStore({ depth: 'SOURCE_PROVENANCE' });
    const disclosure = DISCLOSURE();

    const quietContext = contextOf(quietStore, disclosure);
    const loudContext = contextOf(loudStore, disclosure);
    const camera = decodeCameraIntent(quietStore.getState().camera);
    if (!camera.ok) throw new Error(camera.detail);

    // Canonical state and the disclosed projection are untouched by either value.
    expect(quietStore.getState()).toEqual(loudStore.getState());
    expect(quietContext.disclosure).toBe(loudContext.disclosure);
    const request = mapProjectionRequest(quietStore.getState());
    if (request === null) throw new Error('expected a request');
    expect(deriveMapScene({ status: 'FETCHED', value: disclosure, sealed: disclosure.sealed }, request)).toEqual({
      status: 'SCENE',
      scene: expect.objectContaining({ depth: 'SOURCE_PROVENANCE' }),
    });

    // Home coordinates, scene membership, placement, hit testing and the accessible tree.
    expect([...quietContext.scene.keys].sort()).toEqual([...loudContext.scene.keys].sort());
    expect(quietContext.scene.homes).toEqual(loudContext.scene.homes);
    const placed = placeScene(quietContext.scene, camera.camera, envelope());
    expect(placed).toEqual(placeScene(loudContext.scene, camera.camera, envelope()));
    const home = placed.nodes.find((node) => node.id === 'thread-a');
    if (home === undefined) throw new Error('expected a placed Home');
    expect(hitTest(placed, { x: home.x, y: home.y })?.key).toBe(home.key);

    const quietTree = buildMapAccessibilityTree(quietContext.scene, camera.camera, envelope());
    const loudTree = buildMapAccessibilityTree(loudContext.scene, camera.camera, envelope());
    expect(quietTree).toEqual(loudTree);
    expect(quietTree.nodes.map((node) => node.actions)).toEqual(loudTree.nodes.map((node) => node.actions));

    // Only nonsemantic pixels differ. The rendered element trees are compared with the paint
    // opacity removed: everything that is not paint — the elements, their identities, their
    // geometry and their order — is identical under both values, and `opacity` is the only
    // property that moves at all.
    // ONE stand-in for both renders: the presentation camera is not a paint channel, so it must be
    // identical on both sides of the comparison for the comparison to be about paint at all.
    const motion = stubPresentationCamera({ center: envelopeCenter(envelope()) });
    const quietRender = await render(
      <MapCanvas {...canvasProps({ placed, motion, envelope: envelope(), style: QUIET })} />,
    );
    expect(quietRender.getByTestId(MAP_CANVAS_TEST_ID)).toBeTruthy();
    const quietJson = quietRender.toJSON();
    quietRender.unmount();

    const loudRender = await render(
      <MapCanvas {...canvasProps({ placed, motion, envelope: envelope(), style: LOUD })} />,
    );
    const loudJson = loudRender.toJSON();
    loudRender.unmount();

    expect(stripOpacity(loudJson)).toEqual(stripOpacity(quietJson));
    expect(opacities(loudJson)).not.toEqual(opacities(quietJson));

    // And the canonical state is still identical afterwards, with no RH entry from rendering.
    expect(quietStore.getState()).toEqual(loudStore.getState());
    expect(quietStore.getState().history).toHaveLength(0);
  });
});
