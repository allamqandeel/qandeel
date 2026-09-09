/**
 * T-12 — A46…A55 and A95…A104: the integrated composition, and the accessibility of the tree it
 * actually produces.
 *
 * Every surface below is the REAL frozen owner over the REAL bootstrapped store and the REAL one
 * cache. Nothing is a stand-in, and there is no second, hidden copy of anything: that is the whole
 * claim, and asserting it on a duplicate composition would prove nothing at all.
 */
import { act, render, type RenderResult } from '@testing-library/react-native';

import { MAP_SURFACE_TEST_ID } from '../../map';
import { ORIENTATION_CHROME_TEST_ID, RETURN_CONTROLS_TEST_ID } from '../../orientation-chrome';
import {
  RESPONSIVE_CHROME_BAND_TEST_ID,
  RESPONSIVE_MAP_FRAME_TEST_ID,
  RESPONSIVE_TIMELINE_ROW_TEST_ID,
} from '../../responsive';
import { RESPONSIVE_SURFACE_TEST_ID, isPressTarget, nodes, resize } from '../../responsive/__fixtures__/composition';
import { panByTranslation } from '../../map';
import { LivingAnalysisMap } from '../composition/LivingAnalysisMap';
import { productLocale, type LayoutDirection } from '../locale/product-locale';
import { harness, settle, type IntegrationHarness } from '../__fixtures__/integration';
import type { ChromeLanguage } from '../../orientation-chrome';

async function composed(
  options: { language?: ChromeLanguage; direction?: LayoutDirection; fontScale?: number; width?: number; height?: number; withHistory?: boolean } = {},
): Promise<{ h: IntegrationHarness; view: RenderResult }> {
  const h = await harness();
  // A brand-new reader at the live World viewpoint with no history is legitimately offered NOTHING:
  // they are already Live, already at World, have nothing to go back to and no inspection journey.
  // That is truthful and it makes every count assertion below vacuous, so the reader is first given
  // one real step — a completed pan, through T-04's own executor — which is what a reader who has
  // looked at anything at all would have.
  if (options.withHistory !== false) {
    const panned = panByTranslation(h.ready().store, 48, 0);
    expect(panned.outcome).toBe('APPLIED');
  }
  const view = await render(
    <LivingAnalysisMap
      runtime={h.ready()}
      locale={productLocale(options.language ?? 'en', options.direction ?? 'LTR')}
      insets={{ top: 44, bottom: 34, left: 0, right: 0 }}
      fontScale={options.fontScale ?? 1}
    />,
  );
  await act(async () => {
    await settle();
  });
  await resize(view, options.width ?? 390, options.height ?? 844, { insetTop: 44, insetBottom: 34 });
  return { h, view };
}

/** Every node in the tree that can take a press. React Native gives each one the responder handlers. */
const pressTargets = (view: RenderResult) => nodes(view.toJSON()).filter(isPressTarget);

describe('T12-A46…A55 — the real surfaces, in one composition, over one store', () => {
  it('T12-A48, T12-A49, T12-A50, T12-A51 — the responsive root composes the Map, the Timeline row and the chrome', async () => {
    const { h, view } = await composed();
    expect(view.getByTestId(RESPONSIVE_SURFACE_TEST_ID)).toBeTruthy();
    expect(view.getByTestId(RESPONSIVE_MAP_FRAME_TEST_ID)).toBeTruthy();
    expect(view.getByTestId(RESPONSIVE_TIMELINE_ROW_TEST_ID)).toBeTruthy();
    expect(view.getByTestId(RESPONSIVE_CHROME_BAND_TEST_ID)).toBeTruthy();
    // The REAL owners, not stand-ins.
    expect(view.getByTestId(MAP_SURFACE_TEST_ID)).toBeTruthy();
    expect(view.getByTestId(ORIENTATION_CHROME_TEST_ID)).toBeTruthy();
    h.dispose();
  });

  it('T12-A54 — there is exactly ONE of each surface, and no hidden duplicate', async () => {
    const { h, view } = await composed();
    for (const id of [RESPONSIVE_MAP_FRAME_TEST_ID, RESPONSIVE_TIMELINE_ROW_TEST_ID, RESPONSIVE_CHROME_BAND_TEST_ID, MAP_SURFACE_TEST_ID, ORIENTATION_CHROME_TEST_ID]) {
      expect(view.queryAllByTestId(id)).toHaveLength(1);
    }
    h.dispose();
  });

  it('T12-A02, T12-A43 — every surface answers from the same store and the same viewpoint', async () => {
    const { h, view } = await composed();
    const runtime = h.ready();
    // The composition passes ONE store to all three, so a split-brain frame is unrepresentable
    // rather than merely unobserved.
    expect(runtime.returnSurface.store).toBe(runtime.store);
    expect(runtime.store).toBe(runtime.bundle.store);
    // And the disclosure the Map is drawn from is the one the bundle's single cache holds.
    const state = runtime.store.getState();
    const held = runtime.bundle.projection.lookup(runtime.bundle.sessionId, state.live.LH as number, state.camera.depth);
    expect(held.status).toBe('FETCHED');
    expect(view.getByTestId(MAP_SURFACE_TEST_ID)).toBeTruthy();
    h.dispose();
  });

  it('T12-A97 — the screen reader sees one copy of each return act', async () => {
    const { h, view } = await composed();
    const offered = view.queryAllByTestId(/^qandeel-return-controls:/u).map((node) => node.props.testID as string);
    expect(offered.length).toBeGreaterThan(0);
    expect(new Set(offered).size).toBe(offered.length);
    h.dispose();
  });

  it('and a reader with nothing to return to is offered nothing, rather than a control that cannot work', async () => {
    // The truthful baseline the assertion above is measured against: already Live, already at World,
    // no history, no inspection journey. Every act is correctly absent — none is rendered disabled,
    // and none is offered as a promise the surface could not keep.
    const { h, view } = await composed({ withHistory: false });
    expect(view.queryAllByTestId(/^qandeel-return-controls:/u)).toHaveLength(0);
    // Absent, not disabled — T-08's rule, asserted over T-08's own subtree. The scope matters: T-06's
    // non-drag temporal route DOES render disabled controls when there is no preview to commit or
    // cancel, which is that owner's frozen decision about a persistent instrument and not something
    // this composition reconciles or overrides.
    expect(JSON.stringify(view.getByTestId(ORIENTATION_CHROME_TEST_ID))).not.toContain('"disabled":true');
    h.dispose();
  });

  it('T12-A95 — every press target in the integrated tree is at least 44 points', async () => {
    const { h, view } = await composed();
    const undersized: string[] = [];
    for (const node of pressTargets(view)) {
      const props = (node.props ?? {}) as Record<string, unknown>;
      const raw = props.style;
      const style = (Array.isArray(raw) ? Object.assign({}, ...raw.filter(Boolean)) : (raw ?? {})) as Record<string, unknown>;
      const height = style.minHeight ?? style.height;
      const width = style.minWidth ?? style.width;
      if (typeof height === 'number' && height < 44) undersized.push(`${String(props.testID)} h=${height}`);
      if (typeof width === 'number' && width < 44) undersized.push(`${String(props.testID)} w=${width}`);
    }
    expect(undersized).toEqual([]);
    h.dispose();
  });

  it('T12-A55 — the integrated root does not collapse its interactive descendants into one node', async () => {
    const { h, view } = await composed();
    const root = view.getByTestId(RESPONSIVE_SURFACE_TEST_ID);
    // `accessible` on a container makes the whole subtree ONE node on Android, which is exactly how
    // a container swallows its own buttons.
    expect(root.props.accessible).not.toBe(true);
    expect(view.getByTestId(RESPONSIVE_CHROME_BAND_TEST_ID).props.accessible).not.toBe(true);
    h.dispose();
  });
});

describe('T12-A91, T12-A92, T12-A99, T12-A103, T12-A104 — Arabic, direction, large text and short landscape', () => {
  it('both Product languages compose, and the language does not select the direction', async () => {
    for (const [language, direction] of [
      ['en', 'LTR'],
      ['ar', 'RTL'],
      ['ar', 'LTR'],
      ['en', 'RTL'],
    ] as const) {
      const { h, view } = await composed({ language, direction });
      expect(view.getByTestId(ORIENTATION_CHROME_TEST_ID)).toBeTruthy();
      expect(view.getByTestId(MAP_SURFACE_TEST_ID)).toBeTruthy();
      h.dispose();
    }
  });

  it('T12-A99 — at 200 % text every act is still offered and nothing is dropped', async () => {
    const plain = await composed({ fontScale: 1 });
    const offeredAtOne = plain.view.queryAllByTestId(/^qandeel-return-controls:/u).length;
    plain.h.dispose();

    for (const fontScale of [2, 3.5]) {
      const large = await composed({ fontScale, width: 320, height: 568 });
      const offered = large.view.queryAllByTestId(/^qandeel-return-controls:/u).length;
      // Recompose density, never meaning: the same acts are offered at every text size.
      expect(offered).toBe(offeredAtOne);
      large.h.dispose();
    }
  });

  it('T12-A104, T12-A96 — a short landscape window hides no return act', async () => {
    const tall = await composed({ width: 390, height: 844 });
    const offeredTall = tall.view.queryAllByTestId(/^qandeel-return-controls:/u).length;
    tall.h.dispose();

    const short = await composed({ width: 568, height: 320 });
    expect(short.view.queryAllByTestId(/^qandeel-return-controls:/u).length).toBe(offeredTall);
    // The world never disappears to make room, and the chrome is still there to be reached.
    expect(short.view.getByTestId(RESPONSIVE_MAP_FRAME_TEST_ID)).toBeTruthy();
    expect(short.view.getByTestId(RESPONSIVE_CHROME_BAND_TEST_ID)).toBeTruthy();
    short.h.dispose();
  });

  it('T12-A100, T12-A52, T12-A53 — insets and font scale change no canonical field', async () => {
    const h = await harness();
    const runtime = h.ready();
    const before = runtime.store.getState();

    const view = await render(
      <LivingAnalysisMap runtime={runtime} locale={productLocale('en', 'LTR')} insets={{ top: 0, bottom: 0 }} fontScale={1} />,
    );
    await act(async () => {
      await settle();
    });
    await resize(view, 390, 844);
    await act(async () => {
      view.rerender(
        <LivingAnalysisMap
          runtime={runtime}
          locale={productLocale('ar', 'RTL')}
          insets={{ top: 59, bottom: 34, left: 21, right: 21 }}
          fontScale={2}
        />,
      );
    });
    await resize(view, 320, 568, { insetTop: 59, insetBottom: 34 });

    // A resize, an inset change, a font-scale change and a language change together: the Session,
    // the temporal mode, the position, the inspection, the camera and the history are untouched.
    const after = runtime.store.getState();
    expect(after.session).toEqual(before.session);
    expect(after.temporal).toEqual(before.temporal);
    expect(after.camera).toEqual(before.camera);
    expect(after.inspection).toBe(before.inspection);
    expect(after.history).toEqual(before.history);
    h.dispose();
  });
});
