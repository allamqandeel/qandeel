/**
 * S5-03B R1 — the Living Analysis screen keeps its owners mounted.
 *
 * The screen golden proves WHAT the screen is in each state. This proves the owners that hold local state — the Map's
 * presentation camera, the Timeline's instrument, the chrome — are the SAME instances across the changes a reader makes
 * without leaving the screen: a resize into another band, a preview, an inspection and a language change. A remount
 * would clear a temporal interaction or a camera residual mid-gesture, so identity is the claim.
 */
import { act, render, type RenderResult } from '@testing-library/react-native';

import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { MAP_SURFACE_TEST_ID, inspectObject, mapInspectionContext, mapProjectionRequest } from '../../map';
import { ORIENTATION_CHROME_TEST_ID } from '../../orientation-chrome';
import type { HistoricalSemanticDepth } from '../../projection';
import { RESPONSIVE_CHROME_BAND_TEST_ID, RESPONSIVE_TIMELINE_ROW_TEST_ID } from '../../responsive';
import { resize } from '../../responsive/__fixtures__/composition';
import { sessionPosition } from '../../state';
import { temporalTargeting } from '../../temporal-navigation';
import type { Responder } from '../../runtime-entry/__fixtures__/runtime-entry';
import { LivingAnalysisMap } from '../composition/LivingAnalysisMap';
import { productLocale } from '../locale/product-locale';
import { harness, settle, SESSION_A, type IntegrationHarness } from '../__fixtures__/integration';

const LIVE_HEAD = 6;
const projection: Responder = (request) => {
  const params = new URL(request.url).searchParams;
  return {
    status: 200,
    body: disclosureFixture({
      depth: (params.get('depth') ?? 'WORLD') as HistoricalSemanticDepth,
      sessionId: SESSION_A,
      tc: Number(params.get('tc') ?? LIVE_HEAD),
      liveHead: LIVE_HEAD,
      threads: [
        { id: 'thread-a', x: '0', y: '0' },
        { id: 'thread-b', x: '500000', y: '0' },
      ],
    }),
  };
};

const OWNERS = [MAP_SURFACE_TEST_ID, 'qandeel-map-surface-plane', 'qandeel-temporal-target-layer', RESPONSIVE_TIMELINE_ROW_TEST_ID, RESPONSIVE_CHROME_BAND_TEST_ID, ORIENTATION_CHROME_TEST_ID];
const owners = (view: RenderResult) => OWNERS.map((id) => view.getByTestId(id));

const element = (h: IntegrationHarness, language: 'en' | 'ar', width: number, height: number) => (
  <LivingAnalysisMap
    runtime={h.ready()}
    locale={productLocale(language, language === 'ar' ? 'RTL' : 'LTR')}
    insets={{ top: 44, bottom: 34, left: 0, right: 0 }}
    fontScale={1}
    envelope={{ width, height }}
  />
);

it('S5-03B R1 — the Map, the Timeline and the chrome are never remounted by a resize, a preview, an inspection or a language change', async () => {
  const h = await harness({ liveHead: LIVE_HEAD, projection });
  const view = await render(element(h, 'en', 390, 844));
  await act(async () => {
    await settle();
  });
  await resize(view, 390, 844, { insetTop: 44, insetBottom: 34 });
  await act(async () => {
    await settle();
  });
  const before = owners(view);
  const runtime = h.ready();

  // A preview: the temporal interaction the instrument holds.
  await act(async () => {
    const targeting = temporalTargeting(runtime.store.getState(), runtime.presentation.getSnapshot().track);
    expect(runtime.preview.preview(targeting, sessionPosition(3), 'DISCLOSED_TARGET').outcome).toBe('PREVIEWING');
    await settle();
  });
  // A resize into the other band and back, with the preview still held.
  await resize(view, 1180, 820, { insetTop: 44, insetBottom: 34 });
  await resize(view, 390, 844, { insetTop: 44, insetBottom: 34 });
  expect(runtime.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 3 });
  // An inspection.
  await act(async () => {
    const request = mapProjectionRequest(runtime.store.getState());
    if (request === null) throw new Error('no viewpoint');
    const context = mapInspectionContext(runtime.bundle.projection.lookup(request.sessionId, request.tc, request.depth), request);
    if (!context.ok) throw new Error('no inspection context');
    expect(inspectObject(runtime.store, context.context, { family: 'THREAD', id: 'thread-b' }).outcome).toBe('APPLIED');
    await settle();
  });
  // A language change.
  await act(async () => {
    view.rerender(element(h, 'ar', 390, 844));
    await settle();
  });

  const after = owners(view);
  OWNERS.forEach((id, index) => expect([id, after[index]]).toEqual([id, before[index]]));
  for (let index = 0; index < OWNERS.length; index += 1) expect(after[index]).toBe(before[index]);
  h.dispose();
});
