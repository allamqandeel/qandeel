/**
 * W1A-01 — the Analysis return band and the world beneath it.
 *
 * The band is an opaque strip of the World at the top of the Analysis depth. The Living Analysis Map
 * must treat it exactly as it treats the status bar: its measured height is the world's top inset,
 * so T-11 keeps every part of the world a reader must see out from under it. This proves the value
 * the composition actually hands the (unchanged) Map composition.
 *
 * S5-03B R1 (controlled re-anchor): the band is now the ONE Living Analysis surface's top band. The depth hands the
 * Map composition the band itself and its measured height, and the surface composes the world with the device's
 * edges and the band's height as the top inset (`{ ...insets, top: top.height }`, proven against the real surface in
 * `living-analysis/__tests__/living-analysis-surface.test.tsx`). The stand-in below mounts the band where the surface
 * does and records exactly that inset, so the claim is unchanged: the band's measured height reaches the world.
 */
import { act, fireEvent, render } from '@testing-library/react-native';

import { DepthComposition } from '../composition/DepthComposition';
import { productLocale } from '../locale/product-locale';
import { harness, settle } from '../__fixtures__/integration';
import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';

const mockReceived: { insets: Record<string, number> }[] = [];
jest.mock('../composition/LivingAnalysisMap', () => ({
  LivingAnalysisMap: (props: { insets: Record<string, number>; top?: { content: unknown; height: number } | null }) => {
    const top = props.top ?? null;
    mockReceived.push({ insets: top === null ? props.insets : { ...props.insets, top: top.height } });
    return top === null ? null : top.content;
  },
}));

it('the band’s measured height reaches the world as its top inset; the other edges are the device’s', async () => {
  const h = await harness();
  h.http.on('/turns', () => ({ status: 200, body: historyBody([exchange('fixture: words')]) }));
  const view = await render(
    <DepthComposition
      runtime={h.ready()}
      locale={productLocale('ar', 'RTL')}
      insets={{ top: 44, bottom: 34, left: 0, right: 0 }}
      fontScale={1}
      envelope={{ width: 390, height: 844 }}
    />,
  );
  await act(async () => {
    await settle();
  });
  await fireEvent.press(view.getByTestId('qandeel-depth-to-analysis'));
  await act(async () => {
    view.getByTestId('qandeel-analysis-return-bar').props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 104 } } });
    await settle();
  });
  const last = mockReceived[mockReceived.length - 1];
  expect(last.insets).toEqual({ top: 104, bottom: 34, left: 0, right: 0 });
  // Before the band was measured, its floor (the device top inset plus the 48-point band) stood in.
  expect(mockReceived[0].insets.top).toBe(44 + 48);
  // The band carries its control at the reader's START edge: the right in Arabic.
  const band = view.getByTestId('qandeel-analysis-return-bar');
  expect(band.props.style.justifyContent).toBe('flex-end');
  view.unmount();
  h.dispose();
});
