/**
 * MAP-PERF-01 (PO, 2026-11-14) — the adjacent rungs are held before the reader steps to them.
 *
 * A semantic step to a rung that is still being fetched leaves the Map with no context, so the Map is unmounted and
 * mounted again and the first Zoom IN jumps instead of travelling. The composition asks for the two neighbours of the
 * held rung through the same one cache, so the step finds its scene. This proves the Map survives the first step, that
 * no rung is read twice and at most the two neighbours are asked for, and that nothing is asked for during a live call.
 */
import { act, render } from '@testing-library/react-native';

import type { CallOwner, CallOwnerState } from '../../call';
import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { MAP_SURFACE_TEST_ID, zoomSemanticStep } from '../../map';
import type { HistoricalSemanticDepth } from '../../projection';
import { resize } from '../../responsive/__fixtures__/composition';
import type { Responder } from '../../runtime-entry/__fixtures__/runtime-entry';
import { LivingAnalysisMap } from '../composition/LivingAnalysisMap';
import { productLocale } from '../locale/product-locale';
import type { IntegrationSessionRuntime } from '../runtime/integration-runtime';
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

/** The rung of every projection read so far, in the order they were sent. */
const reads = (h: IntegrationHarness) => h.http.matching('/historical-projection').map((call) => new URL(call.url).searchParams.get('depth') ?? 'WORLD');

async function composed(h: IntegrationHarness, runtime: IntegrationSessionRuntime = h.ready()) {
  const view = await render(
    <LivingAnalysisMap
      runtime={runtime}
      locale={productLocale('en', 'LTR')}
      insets={{ top: 44, bottom: 34, left: 0, right: 0 }}
      fontScale={1}
      envelope={{ width: 390, height: 844 }}
    />,
  );
  await act(async () => {
    await settle();
  });
  await resize(view, 390, 844, { insetTop: 44, insetBottom: 34 });
  await act(async () => {
    await settle();
  });
  return view;
}

/** A call whose stage the test sets; the rest of the owner is never reached by the composition. */
function callAt(stage: CallOwnerState['stage']) {
  const listeners = new Set<() => void>();
  let state = { stage } as CallOwnerState;
  const call = {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as CallOwner;
  return {
    call,
    set(next: CallOwnerState['stage']) {
      state = { stage: next } as CallOwnerState;
      listeners.forEach((listener) => listener());
    },
  };
}

it('the first Zoom IN finds its rung held, and the Map is not unmounted and mounted again', async () => {
  const h = await harness({ liveHead: LIVE_HEAD, projection });
  const view = await composed(h);
  // The held World rung asked for its one neighbour (World has nothing below it), and only once.
  expect(reads(h).filter((depth) => depth === 'THREAD')).toHaveLength(1);
  const map = view.getByTestId(MAP_SURFACE_TEST_ID);
  const plane = view.getByTestId('qandeel-map-surface-plane');

  await act(async () => {
    expect(zoomSemanticStep(h.ready().store, 'IN').outcome).toBe('APPLIED');
    // The step itself: the rung is already held, so the Map keeps its context in the same commit.
    expect(view.getByTestId(MAP_SURFACE_TEST_ID)).toBe(map);
    await settle();
  });
  expect(h.ready().store.getState().camera.depth).toBe('THREAD');
  expect(view.getByTestId(MAP_SURFACE_TEST_ID)).toBe(map);
  expect(view.getByTestId('qandeel-map-surface-plane')).toBe(plane);
  h.dispose();
});

it('a held rung is never read again, and no more than the two neighbours are asked for', async () => {
  const h = await harness({ liveHead: LIVE_HEAD, projection });
  await composed(h);
  const store = h.ready().store;
  for (const direction of ['IN', 'IN', 'OUT', 'OUT', 'IN'] as const) {
    await act(async () => {
      expect(zoomSemanticStep(store, direction).outcome).toBe('APPLIED');
      await settle();
    });
  }
  const sent = reads(h);
  // Every rung once: World, Thread, Session (also the Timeline's own rung) and the Analytical Object, the furthest
  // neighbour of the deepest rung visited. Nothing further.
  expect(new Set(sent).size).toBe(sent.length);
  expect(sent.slice().sort()).toEqual(['ANALYTICAL_OBJECT', 'SESSION', 'THREAD', 'WORLD']);
  h.dispose();
});

it('nothing is asked for while a live call is up, and the neighbours are asked for once it ends', async () => {
  const h = await harness({ liveHead: LIVE_HEAD, projection });
  const fake = callAt('ACTIVE');
  await composed(h, { ...h.ready(), call: fake.call });
  expect(reads(h)).not.toContain('THREAD');

  await act(async () => {
    fake.set('IDLE');
    await settle();
  });
  expect(reads(h).filter((depth) => depth === 'THREAD')).toHaveLength(1);
  h.dispose();
});
