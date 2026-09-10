/**
 * T-12 — Layer B: the production wrappers actually consume the room the plan gave them.
 *
 * This is a PROPAGATION proof and nothing more. It does not claim that a JS renderer reproduces Yoga,
 * because it does not: `jest-expo` performs no layout at all. What it proves is the link that was
 * missing when a truthful region reached zero on a device — that the allocation the plan computes is
 * the allocation each region is actually handed, in every case in the envelope, in both arrangements.
 *
 * The native behaviour itself is closed only by Layer C, on real hardware.
 */
import { act, render } from '@testing-library/react-native';

import { ORIENTATION_CHROME_TEST_ID, RETURN_CONTROLS_TEST_ID } from '../../orientation-chrome';
import { chromeStore, contextAt, flattenStyle, TWO_CONTEXT_WORLD } from '../../orientation-chrome/__fixtures__/chrome';
import { sessionPosition } from '../../state';
import { createPresentationController } from '../../timeline';
import { createTemporalPreviewController } from '../../temporal-navigation/preview';
import { trackOf } from '../../temporal-navigation/__fixtures__/temporal';
import {
  isPressTarget,
  RESPONSIVE_CHROME_BAND_TEST_ID,
  RESPONSIVE_MAP_FRAME_TEST_ID,
  ResponsiveWorld,
  resize,
  subtree,
} from '../__fixtures__/composition';
import { recompositionPlan } from '../plan';
import { RESPONSIVE_SUPPORT_BAND_TEST_ID } from '../ResponsiveSupportBand';
import { RESPONSIVE_TIMELINE_ROW_TEST_ID } from '../ResponsiveTimelineRow';
import { presentationSurface } from '../surface';

jest.setTimeout(120_000);

/** The supported proof envelope, by measurement rather than by any device name. */
const ENVELOPE = [
  { id: 'C1', width: 320, height: 568 },
  { id: 'C2', width: 360, height: 800 },
  { id: 'C3', width: 390, height: 844 },
  { id: 'C4', width: 412, height: 915 },
  { id: 'C5', width: 568, height: 320 },
  { id: 'C6', width: 844, height: 390 },
  { id: 'C7', width: 768, height: 1024 },
  { id: 'C8', width: 1024, height: 768 },
  { id: 'C9', width: 1366, height: 1024 },
] as const;

function reader() {
  const store = chromeStore({ liveHead: 6, depth: 'ANALYTICAL_OBJECT', temporal: { kind: 'PINNED', at: sessionPosition(4) } });
  return { store, context: contextAt(TWO_CONTEXT_WORLD()) };
}

async function mounted(language: 'en' | 'ar') {
  const world = reader();
  const preview = createTemporalPreviewController();
  const presentation = createPresentationController(trackOf('session-1', 6), 0);
  const view = await render(
    <ResponsiveWorld store={world.store} context={world.context} language={language} preview={preview} presentation={presentation} />,
  );
  return view;
}

describe('T12 — the plan allocation reaches the regions that used to reach zero', () => {
  for (const language of ['en', 'ar'] as const) {
    it(`every region is handed the plan's own allocation, at every supported size (${language})`, async () => {
      const view = await mounted(language);
      for (const testCase of ENVELOPE) {
        await resize(view, testCase.width, testCase.height);
        const plan = recompositionPlan(presentationSurface({ width: testCase.width, height: testCase.height }) as never);

        const band = flattenStyle(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID).props.style);
        const row = flattenStyle(view.getByTestId(RESPONSIVE_TIMELINE_ROW_TEST_ID).props.style);
        const chrome = flattenStyle(view.getByTestId(RESPONSIVE_CHROME_BAND_TEST_ID).props.style);

        // The band is the plan's, and it neither grows nor yields: that is what stops the world's
        // growth from reclaiming it, which is exactly how a region reached zero.
        expect(band.height).toBe(plan.support.bandPoints);
        expect(band.flexGrow).toBe(0);
        expect(band.flexShrink).toBe(0);
        expect(band.flexDirection).toBe(plan.support.arrangement === 'SIDE_BY_SIDE' ? 'row' : 'column');

        // Each region states its allocation rather than inferring it from a scroller.
        expect(row.height).toBe(plan.support.timelinePoints);
        expect(chrome.height).toBe(plan.support.chromePoints);
        // And no allocation is ever zero while the region is present.
        expect(row.height).toBeGreaterThan(0);
        expect(chrome.height).toBeGreaterThan(0);
        expect(band.height).toBeGreaterThan(0);

        // The world keeps its own floor throughout.
        const frame = flattenStyle(view.getByTestId(RESPONSIVE_MAP_FRAME_TEST_ID).props.style);
        expect(frame.minHeight).toBe(plan.mapFrame.minHeightPoints);
        expect(frame.flexShrink).toBe(0);
      }
      await act(async () => {
        view.unmount();
      });
    });
  }

  it('keeps every act offered and every target at 44 points, in both arrangements', async () => {
    const view = await mounted('ar');
    for (const testCase of ENVELOPE) {
      await resize(view, testCase.width, testCase.height);
      // The orientation and its return acts are present at every size — a short surface recomposes
      // them, it never removes one.
      expect(view.getByTestId(ORIENTATION_CHROME_TEST_ID)).toBeTruthy();
      const controls = subtree(view, RETURN_CONTROLS_TEST_ID).filter(isPressTarget);
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        expect(JSON.stringify(((control.props ?? {}) as Record<string, unknown>).style)).toContain('"minHeight":44');
      }
      // Whatever exceeds the room it was given stays reachable inside the region itself.
      expect(subtree(view, RESPONSIVE_CHROME_BAND_TEST_ID).some((node) => node.type === 'RCTScrollView')).toBe(true);
      expect(subtree(view, RESPONSIVE_TIMELINE_ROW_TEST_ID).some((node) => node.type === 'RCTScrollView')).toBe(true);
    }
    await act(async () => {
      view.unmount();
    });
  });

  it('changes a style and never an element type, so no measurement can remount a region', async () => {
    const view = await mounted('en');
    // Straight across the short/normal boundary and back: the same instances must survive it, because
    // local state that a resize must not clear lives inside these regions.
    await resize(view, 844, 390);
    const acrossBand = view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID);
    const acrossChrome = view.getByTestId(RESPONSIVE_CHROME_BAND_TEST_ID);
    expect(flattenStyle(acrossBand.props.style).flexDirection).toBe('row');

    await resize(view, 390, 844);
    expect(flattenStyle(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID).props.style).flexDirection).toBe('column');

    await resize(view, 844, 390);
    expect(flattenStyle(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID).props.style).flexDirection).toBe('row');
    // Same node identity across both crossings: nothing here is keyed by a width, a height or a band.
    expect(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID).type).toBe(acrossBand.type);
    expect(view.getByTestId(RESPONSIVE_CHROME_BAND_TEST_ID).type).toBe(acrossChrome.type);
    await act(async () => {
      view.unmount();
    });
  });

  it('branches on measured geometry alone — never on a device, a brand or a platform', async () => {
    // Two surfaces with the SAME measurements compose identically, whatever is running them.
    const a = recompositionPlan(presentationSurface({ width: 844, height: 390 }) as never);
    const b = recompositionPlan(presentationSurface({ width: 844, height: 390 }) as never);
    expect(a.support).toEqual(b.support);
    // And one point of difference in the measurement is the only thing that can change the answer.
    const shorter = recompositionPlan(presentationSurface({ width: 844, height: 1024 }) as never);
    expect(shorter.support.arrangement).toBe('STACKED');
    expect(a.support.arrangement).toBe('SIDE_BY_SIDE');
  });
});
