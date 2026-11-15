/**
 * COSMOS-INT-01 Slice B — the ONE Living Analysis surface's STAGE presentation (Product Owner D-2).
 *
 * With a `stage`, the screen composes exactly as before — the top band first and above, T-11's column, the measured
 * frame, the ONE support band — and the world is drawn once, full-surface, UNDER it: the frame reports the GLASS (the
 * whole surface with the top band and the band beneath as its insets) and takes no touch; the support band is drawn as
 * glass; `world` is never called. The glass is a measured fact, held by value.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { viewportEnvelope, type ViewportEnvelope } from '../../map/camera';
import { RESPONSIVE_MAP_FRAME_TEST_ID, RESPONSIVE_SUPPORT_BAND_TEST_ID } from '../../responsive';
import { resize, simulatedMapHeight } from '../../responsive/__fixtures__/composition';
import { LIVING_ANALYSIS_STAGE_TEST_ID, LivingAnalysisSurface } from '../LivingAnalysisSurface';

const seen: { glass: ViewportEnvelope[]; world: number } = { glass: [], world: 0 };

const styleOf = (node: { props: { style?: unknown } }): Record<string, unknown> =>
  Object.assign({}, ...[node.props.style].flat(4).filter(Boolean)) as Record<string, unknown>;

async function composed(timeline: boolean): Promise<RenderResult> {
  const view = await render(
    <LivingAnalysisSurface
      insets={{ top: 44, bottom: 34, left: 0, right: 0 }}
      fontScale={1}
      envelope={{ width: 390, height: 844 }}
      top={{ content: <View testID="probe-top" />, height: 104 }}
      world={() => { seen.world += 1; return <View testID="probe-world" />; }}
      stage={(glass) => { seen.glass.push(glass); return <View testID="probe-stage" />; }}
      timeline={timeline ? { line: <Text>line</Text>, layer: <View testID="probe-timeline" /> } : null}
      chrome={() => <View testID="probe-chrome" />}
    />,
  );
  await resize(view, 390, 844, { insetTop: 104, insetBottom: 34 });
  return view;
}

afterEach(() => { cleanup(); seen.glass.length = 0; seen.world = 0; });

describe('COSMOS-INT-01 — the STAGE presentation', () => {
  it('draws the stage under the composition in the glass the frame measured: the top band above, the band beneath, as insets', async () => {
    const view = await composed(true);
    const mapHeight = simulatedMapHeight(844, { insetTop: 104, insetBottom: 34 });
    const expected = viewportEnvelope(390, 844, { top: 104, bottom: 844 - mapHeight, left: 0, right: 0 });
    expect(seen.glass.length).toBeGreaterThan(0);
    expect(seen.glass[seen.glass.length - 1]).toEqual(expected);
    // The stage is the stage layer's child; the frame holds nothing to draw; the world callback was never asked.
    type Node = { props: { testID?: string }; children: readonly (Node | string)[] };
    const walk = (node: Node): boolean => node.props.testID === 'probe-stage' || node.children.some((c) => typeof c !== 'string' && walk(c));

    expect(walk(view.getByTestId(LIVING_ANALYSIS_STAGE_TEST_ID))).toBe(true);
    expect(view.queryByTestId('probe-world')).toBeNull();
    expect(seen.world).toBe(0);
    // The frame's only child is the glass reporter, which draws nothing: no host node under the frame.
    expect(view.getByTestId(RESPONSIVE_MAP_FRAME_TEST_ID).children).toEqual([]);
  });

  it('the frame is glass (no touch of its own) and the support band is drawn as glass; the top band and the chrome stay', async () => {
    const view = await composed(false);
    expect(styleOf(view.getByTestId(RESPONSIVE_MAP_FRAME_TEST_ID)).pointerEvents).toBe('none');
    const band = view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID);
    expect(styleOf(band).backgroundColor).toBe('rgba(11, 13, 26, 0.62)');
    expect(band.props.pointerEvents).toBe('box-none');
    expect(view.getByTestId('probe-top')).toBeTruthy();
    expect(view.getByTestId('probe-chrome')).toBeTruthy();
  });

  it('holds the glass by value: an equal measurement is not a new glass, a different one is', async () => {
    const view = await composed(true);
    const before = seen.glass.length;
    const frame = view.getByTestId(RESPONSIVE_MAP_FRAME_TEST_ID);
    const mapHeight = simulatedMapHeight(844, { insetTop: 104, insetBottom: 34 });
    await act(async () => { fireEvent(frame, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: mapHeight } } }); });
    expect(seen.glass.length).toBe(before);
    await act(async () => { fireEvent(frame, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: mapHeight - 40 } } }); });
    expect(seen.glass.length).toBeGreaterThan(before);
    expect(seen.glass[seen.glass.length - 1].insetBottom).toBe(844 - (mapHeight - 40));
  });
});
