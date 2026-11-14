/**
 * MAP-CLOSE-01 CA-O2 (Product Owner, approved with conditions, 2026-11-14): the Personal chrome band keeps the END of its
 * words in view when they overflow, so the return acts (stacked up from the bottom) stay under the finger when Go Live +
 * Locate appears above them. The conditions: nothing is hidden or removed — what no longer fits stays inside the
 * scroller, reachable by scrolling and by every accessible route, and the scroller's indicator says there is more.
 *
 * On the PO's phone (proof build, 2026-11-14): two presses at the same point stepped SESSION → THREAD → WORLD. Jest has no
 * layout, so this pins the mechanism: every change of the words' size or of the band keeps the end, at any text size.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { ScrollView, Text } from 'react-native';

import { recompositionPlan } from '../plan';
import { RESPONSIVE_CHROME_MEASURE_TEST_ID, ResponsiveChromeBand } from '../ResponsiveChromeBand';
import { presentationSurface } from '../surface';

const planFor = (fontScale: number) => {
  const surface = presentationSurface({ width: 369, height: 816, insetTop: 40, insetBottom: 24, fontScale });
  if (surface === null) throw new Error('no surface');
  return recompositionPlan(surface);
};

const words = (size: number) => (
  <>
    <Text style={{ fontSize: size }}>المعروض الآن: الخيوط.</Text>
    <Text accessibilityRole="button" style={{ fontSize: size }}>عرض التفاصيل</Text>
    <Text accessibilityRole="button" style={{ fontSize: size }}>العودة إلى المحادثة والانتقال إلى موضعها</Text>
    <Text accessibilityRole="button" style={{ fontSize: size }}>الرجوع خطوة واحدة</Text>
  </>
);

describe('CA-O2 — the Personal chrome band keeps its end in view', () => {
  let toEnd: jest.SpyInstance;
  let flash: jest.SpyInstance;
  beforeEach(() => {
    toEnd = jest.spyOn(ScrollView.prototype, 'scrollToEnd').mockImplementation(() => undefined);
    flash = jest.spyOn(ScrollView.prototype, 'flashScrollIndicators').mockImplementation(() => undefined);
  });
  afterEach(() => {
    toEnd.mockRestore();
    flash.mockRestore();
  });

  it.each([1, 1.3, 2])('at text size %s, a change of the words or of the band keeps the end, without animation', async (fontScale) => {
    const plan = planFor(fontScale);
    const view = await render(
      <ResponsiveChromeBand chrome={plan.chrome} support={plan.support} anchorEnd>
        {words(13 * fontScale)}
      </ResponsiveChromeBand>,
    );
    // The events reach the scroller from the words inside it (fireEvent climbs to the nearest handler).
    const scroller = view.getByTestId(RESPONSIVE_CHROME_MEASURE_TEST_ID);
    await fireEvent(scroller, 'contentSizeChange', 369, 900);
    await fireEvent(scroller, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 369, height: 260 } } });
    expect(toEnd).toHaveBeenCalledTimes(2);
    expect(toEnd).toHaveBeenCalledWith({ animated: false });
    // The reader is told there is more above.
    expect(flash).toHaveBeenCalledTimes(2);
    // Nothing is removed or hidden from a route: every word and act is still there, inside the scroller.
    for (const text of ['المعروض الآن: الخيوط.', 'عرض التفاصيل', 'العودة إلى المحادثة والانتقال إلى موضعها', 'الرجوع خطوة واحدة']) {
      expect(view.getByText(text)).toBeTruthy();
    }
    expect(view.getAllByRole('button')).toHaveLength(3);
  });

  it('a band without it (a world with no time: a place\'s panel) still opens at its start', async () => {
    const plan = planFor(1);
    const view = await render(
      <ResponsiveChromeBand chrome={plan.chrome} support={plan.support}>
        {words(13)}
      </ResponsiveChromeBand>,
    );
    // The events reach the scroller from the words inside it (fireEvent climbs to the nearest handler).
    const scroller = view.getByTestId(RESPONSIVE_CHROME_MEASURE_TEST_ID);
    await fireEvent(scroller, 'contentSizeChange', 369, 900);
    await fireEvent(scroller, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 369, height: 260 } } });
    expect(toEnd).not.toHaveBeenCalled();
    expect(flash).not.toHaveBeenCalled();
  });
});
