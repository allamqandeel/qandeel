/**
 * S5-03B R1 — the ONE Living Analysis surface, over the real responsive owner.
 *
 * What the screen guarantees every world, whatever it draws: the Analysis place (dark under every preference), the top
 * band read first and paid for as the world's top inset, the measured world frame, and one support band whose
 * temporal row exists only for a world that has a temporal track. SHARED-VIS-01 (Product Owner, Option 1): a world with
 * no temporal track is given the band its chrome MEASURES — none when the chrome is empty — capped at the room every
 * world's band has, and the world grows into the rest; a world with a temporal track is composed exactly as before.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { useSurfaceAppearance } from '../../appearance';
import type { ViewportEnvelope } from '../../map/camera';
import {
  RESPONSIVE_CHROME_BAND_TEST_ID,
  RESPONSIVE_CHROME_MEASURE_TEST_ID,
  RESPONSIVE_MAP_FRAME_TEST_ID,
  RESPONSIVE_SUPPORT_BAND_TEST_ID,
  RESPONSIVE_TIMELINE_ROW_TEST_ID,
  type ChromeComposition,
} from '../../responsive';
import { RESPONSIVE_SURFACE_TEST_ID, resize } from '../../responsive/__fixtures__/composition';
import { LivingAnalysisSurface, type LivingAnalysisSurfaceProps } from '../LivingAnalysisSurface';

const seen: { envelopes: ViewportEnvelope[]; chrome: ChromeComposition[]; appearance: string[] } = { envelopes: [], chrome: [], appearance: [] };

function AppearanceProbe({ testID }: { readonly testID: string }) {
  seen.appearance.push(useSurfaceAppearance());
  return <View testID={testID} />;
}

function surface(overrides: Partial<LivingAnalysisSurfaceProps> = {}) {
  return (
    <LivingAnalysisSurface
      insets={{ top: 44, bottom: 34, left: 0, right: 0 }}
      fontScale={1}
      envelope={{ width: 390, height: 844 }}
      world={(envelope) => {
        seen.envelopes.push(envelope);
        return <View testID="probe-world" />;
      }}
      timeline={{ line: <Text>line</Text>, layer: <View testID="probe-timeline" /> }}
      chrome={(composition) => {
        seen.chrome.push(composition);
        return <AppearanceProbe testID="probe-chrome" />;
      }}
      {...overrides}
    />
  );
}

async function composed(element: ReturnType<typeof surface>, insetTop = 44): Promise<RenderResult> {
  const view = await render(element);
  await resize(view, 390, 844, { insetTop, insetBottom: 34 });
  return view;
}

const styleOf = (node: { props: { style?: unknown } }): Record<string, unknown> => {
  const raw = node.props.style;
  return (Array.isArray(raw) ? Object.assign({}, ...raw.flat(4).filter(Boolean)) : (raw ?? {})) as Record<string, unknown>;
};

const layout = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } });

afterEach(() => {
  cleanup();
  seen.envelopes.length = 0;
  seen.chrome.length = 0;
  seen.appearance.length = 0;
});

describe('S5-03B R1 — the Living Analysis surface', () => {
  it('is the Analysis place: dark under every preference, wherever the world puts its content', async () => {
    await composed(surface({ top: { content: <AppearanceProbe testID="probe-top" />, height: 104 } }), 104);
    expect(seen.appearance.length).toBeGreaterThan(0);
    expect(new Set(seen.appearance)).toEqual(new Set(['DARK']));
  });

  it('draws the top band first and pays for it as the world’s top inset', async () => {
    const view = await composed(surface({ top: { content: <View testID="probe-top" />, height: 104 } }), 104);
    // Two siblings at the root (the renderer holds them under one container).
    const tree = (view.toJSON() as unknown as { children: { props: { style?: unknown } }[] }).children;
    expect(tree).toHaveLength(2);
    // The band, then the responsive surface: read first, drawn above the world.
    expect(styleOf(tree[0])).toEqual({ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 });
    expect((tree[1] as unknown as { props: { testID: string } }).props.testID).toBe(RESPONSIVE_SURFACE_TEST_ID);
    expect(view.getByTestId('probe-top')).toBeTruthy();
    // The band's height, not the device's top edge, is the world's top inset.
    expect(seen.envelopes.at(-1)?.insetTop).toBe(104);
  });

  it('without a top band, the device’s own edges are the world’s insets', async () => {
    const view = await composed(surface());
    expect((view.toJSON() as unknown as { props: { testID: string } }).props.testID).toBe(RESPONSIVE_SURFACE_TEST_ID);
    expect(seen.envelopes.at(-1)?.insetTop).toBe(44);
  });

  it('a world with a temporal track gets the Timeline row and its line beside the chrome', async () => {
    const view = await composed(surface());
    expect(view.queryAllByTestId(RESPONSIVE_TIMELINE_ROW_TEST_ID)).toHaveLength(1);
    expect(view.getByTestId('probe-timeline')).toBeTruthy();
    expect(view.getByTestId('probe-chrome')).toBeTruthy();
    expect(seen.chrome.at(-1)?.gapPoints).toBeGreaterThan(0);
  });

  it('a world with no temporal track gets no instrument; until its chrome is measured, the SAME room for the world and the band', async () => {
    const withTrack = await composed(surface());
    const bandWith = styleOf(withTrack.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID)).height;
    const worldWith = seen.envelopes.at(-1);

    const without = await composed(surface({ timeline: null }));
    expect(without.queryAllByTestId(RESPONSIVE_TIMELINE_ROW_TEST_ID)).toHaveLength(0);
    expect(without.getByTestId('probe-chrome')).toBeTruthy();
    expect(styleOf(without.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID)).height).toBe(bandWith);
    expect(seen.envelopes.at(-1)).toEqual(worldWith);
    // The chrome takes the whole band: no row above it, so no gap kept from one.
    expect(styleOf(without.getByTestId(RESPONSIVE_CHROME_BAND_TEST_ID)).height).toBe(bandWith);
    expect(seen.chrome.at(-1)?.gapPoints).toBe(0);
  });

  it('the temporal line’s measured room comes out of the chrome band, never out of the world (VPORT-02 G3 B)', async () => {
    const view = await composed(surface());
    const chromeBefore = styleOf(view.getByTestId(RESPONSIVE_CHROME_BAND_TEST_ID)).height as number;
    const worldBefore = seen.envelopes.at(-1);
    await act(async () => {
      fireEvent(view.getByTestId('qandeel-responsive-timeline-line'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 39.2 } } });
    });
    expect(styleOf(view.getByTestId(RESPONSIVE_CHROME_BAND_TEST_ID)).height).toBe(chromeBefore - 40);
    expect(seen.envelopes.at(-1)).toEqual(worldBefore);
  });

  it('SHARED-VIS-01 — an empty chrome holds no room: the band is only the bottom safe area, no gap, and the world reaches it', async () => {
    const view = await composed(surface({ timeline: null }));
    const half = styleOf(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID)).height as number;
    await act(async () => { fireEvent(view.getByTestId(RESPONSIVE_CHROME_MEASURE_TEST_ID), 'layout', layout(0)); });
    const band = styleOf(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID));
    expect(band.height).toBe(34);
    expect(band.marginTop).toBe(0);
    expect(styleOf(view.getByTestId(RESPONSIVE_CHROME_BAND_TEST_ID)).height).toBe(34);
    // The world's ceiling is the whole column above the safe area; its basis (half) and floor are unchanged.
    const frame = styleOf(view.getByTestId(RESPONSIVE_MAP_FRAME_TEST_ID));
    expect(frame.maxHeight).toBe(844 - 34);
    expect(frame.maxHeight as number).toBeGreaterThan(844 - half);
    expect(frame.flexBasis).toBe(Math.round((844 - 44 - 34) / 2));
  });

  it('SHARED-VIS-01 — content is given exactly the band it measures, grows with it, and is capped at the room every world has', async () => {
    const view = await composed(surface({ timeline: null }));
    const cap = styleOf(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID)).height as number;
    const gap = styleOf(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID)).marginTop as number;
    // The empty-World sentence: a short band, the world above it, the sentence still mounted and still read.
    await act(async () => { fireEvent(view.getByTestId(RESPONSIVE_CHROME_MEASURE_TEST_ID), 'layout', layout(71.4)); });
    expect(styleOf(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID)).height).toBe(72);
    expect(styleOf(view.getByTestId(RESPONSIVE_CHROME_BAND_TEST_ID)).height).toBe(72);
    expect(styleOf(view.getByTestId(RESPONSIVE_MAP_FRAME_TEST_ID)).maxHeight).toBe(844 - 72 - gap);
    expect(view.getByTestId('probe-chrome')).toBeTruthy();
    // A panel opening: the band grows with what it holds, and the world gives back exactly that much.
    await act(async () => { fireEvent(view.getByTestId(RESPONSIVE_CHROME_MEASURE_TEST_ID), 'layout', layout(300)); });
    expect(styleOf(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID)).height).toBe(300);
    expect(styleOf(view.getByTestId(RESPONSIVE_MAP_FRAME_TEST_ID)).maxHeight).toBe(844 - 300 - gap);
    // More than the room: capped, the rest reachable inside the band's scroller; the world keeps its half.
    await act(async () => { fireEvent(view.getByTestId(RESPONSIVE_CHROME_MEASURE_TEST_ID), 'layout', layout(2000)); });
    expect(styleOf(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID)).height).toBe(cap);
    expect(styleOf(view.getByTestId(RESPONSIVE_MAP_FRAME_TEST_ID)).maxHeight).toBe(844 - cap - gap);
  });

  it('SHARED-VIS-01 — a world with a temporal track never measures its chrome: Personal is composed exactly as before', async () => {
    const view = await composed(surface());
    // Nothing is measured, so nothing the chrome says can move the band (the plan ignores a measurement here as well).
    expect(view.getByTestId(RESPONSIVE_CHROME_MEASURE_TEST_ID).props.onLayout).toBeUndefined();
    expect(styleOf(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID)).marginTop).toBeGreaterThan(0);
  });

  it('SHARED-VIS-01 D2 — the panel closing gives its room back at once: the world view keeps any running travel', async () => {
    const view = await composed(surface({ timeline: null }));
    await act(async () => { fireEvent(view.getByTestId(RESPONSIVE_CHROME_MEASURE_TEST_ID), 'layout', layout(300)); });
    expect(styleOf(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID)).height).toBe(300);
    // Back closes the panel in the same moment the camera steps out. The band follows the chrome without waiting: a
    // frame resized mid-travel no longer strands the world (`map/__tests__/world-resize-race.test.tsx`).
    await act(async () => { fireEvent(view.getByTestId(RESPONSIVE_CHROME_MEASURE_TEST_ID), 'layout', layout(0)); });
    expect(styleOf(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID)).height).toBe(34);
  });

  it('mounts the composition observer after the band, outside the layout', async () => {
    const view = await composed(surface({ after: <View testID="probe-after" /> }));
    const root = view.getByTestId(RESPONSIVE_SURFACE_TEST_ID);
    const last = root.children.at(-1) as unknown as { props: { testID?: string } };
    expect(last.props.testID).toBe('probe-after');
  });
});

describe('S5-03B R1 — the surface holds nothing of any world', () => {
  it('imports no store, projection, inspection, time or Personal owner', () => {
    const text = readFileSync(join(__dirname, '..', 'LivingAnalysisSurface.tsx'), 'utf8');
    const specifiers = [...text.matchAll(/from '([^']+)'/gu)].map((match) => match[1]);
    expect(specifiers).toEqual(['react', 'react-native', '../analysis-visual', '../appearance', '../map/camera', '../responsive']);
    expect(text).not.toMatch(/CanonicalStore|useSyncExternalStore|dispatch/u);
  });
});
