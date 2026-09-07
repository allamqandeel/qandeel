/**
 * T-08 — I: React lifecycle cannot change what a Product act means.
 *
 * Chrome is rendered often, by parents this layer does not control, with callbacks whose identity
 * changes every time. None of that may rebind a target, elect a context, replay an act, resurrect a
 * dead callback or let a stale closure reach a store that has been replaced. The whole orientation
 * answer is recomputed from props and subscribed state on every render, which is what makes these
 * properties structural rather than lucky.
 */
import { act, fireEvent, render } from '@testing-library/react-native';

import { CANONICAL_STATE_KEYS, sessionPosition, type CanonicalStore } from '../../state';
import { latestReturnCheckpoint, returnWorld, type ReturnMapContext } from '../../return-navigation';
import type { MapProjectionRequest } from '../../map';
import { OrientationChrome } from '../OrientationChrome';
import { RETURN_CONTROLS_TEST_ID } from '../ReturnControls';
import { chromeStore, chromeSurface, fetched, projectionFor, TWO_CONTEXT_WORLD } from '../__fixtures__/chrome';

/** A live focus is supplied so the composite act actually reaches its `liveContext` provider. */
const reader = (): CanonicalStore =>
  chromeStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
  });

const disabledOf = (view: Awaited<ReturnType<typeof render>>, id: string): boolean =>
  view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:${id}`).props.accessibilityState.disabled;

describe('OC08-I — rerender and callback churn', () => {
  it('I79 — a new callback identity on every render changes no semantics and runs no act', async () => {
    const store = reader();
    const projection = projectionFor(store, fetched(TWO_CONTEXT_WORLD()));
    const view = await render(<OrientationChrome surface={chromeSurface(store)} projection={projection} onReturnOutcome={() => undefined} />);
    const before = store.getState();
    const snapshot = JSON.stringify(view.toJSON(), (_key, value) => (typeof value === 'function' ? '[handler]' : value));

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        view.rerender(
          <OrientationChrome
            surface={chromeSurface(store)}
            projection={projection}
            onReturnOutcome={() => undefined}
            onMapOutcome={() => undefined}
            liveContext={() => ({ ok: false, code: 'PROJECTION_NOT_AVAILABLE', detail: 'none' })}
          />,
        );
      });
    }

    expect(store.getState()).toBe(before);
    expect(JSON.stringify(view.toJSON(), (_key, value) => (typeof value === 'function' ? '[handler]' : value))).toBe(snapshot);

    await act(async () => {
      view.unmount();
    });
  });

  it('I85 — rapid repeated presses cannot replay an authorization', async () => {
    const store = reader();
    const surface = chromeSurface(store);
    returnWorld(surface);
    expect(store.getState().history).toHaveLength(1);

    const view = await render(
      <OrientationChrome surface={surface} projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD({ depth: 'WORLD' })))} />,
    );
    await act(async () => {
      const control = view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:BACK_ONE_STEP`);
      fireEvent.press(control);
      fireEvent.press(control);
      fireEvent.press(control);
    });

    // The first press consumed the only checkpoint. The others found nothing to reverse and were
    // refused by the executor; no authorization was reused and no extra state appeared.
    expect(store.getState().history).toHaveLength(0);
    expect(Object.keys(store.getState()).sort()).toEqual([...CANONICAL_STATE_KEYS].sort());

    await act(async () => {
      view.unmount();
    });
  });
});

describe('OC08-I — unmount and replacement', () => {
  it('I82 — a provider captured before unmount is inert afterwards: it holds nothing and writes nothing', async () => {
    const store = reader();
    let captured: ((request: MapProjectionRequest) => ReturnMapContext) | null = null;
    const provider = (request: MapProjectionRequest): ReturnMapContext => {
      captured = provider;
      return { ok: false, code: 'PROJECTION_NOT_AVAILABLE', detail: `late for ${request.sessionId}` };
    };

    const view = await render(
      <OrientationChrome surface={chromeSurface(store)} projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD()))} liveContext={provider} />,
    );
    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:GO_LIVE_AND_LOCATE`));
    });
    expect(captured).not.toBeNull();
    const afterAct = store.getState();

    await act(async () => {
      view.unmount();
    });

    // Calling it late is possible and completely harmless: it is a pure function of its argument,
    // holds no store and carries no authority, so there is nothing for it to do.
    const late = provider({ sessionId: 'session-1', tc: sessionPosition(6), depth: 'ANALYTICAL_OBJECT' });
    expect(late.ok).toBe(false);
    expect(store.getState()).toBe(afterAct);
  });

  it('I83, I84 — a replaced store is acted on, and an old store-bound target is invalidated', async () => {
    const original = reader();
    const surface = chromeSurface(original);
    returnWorld(surface);
    const originalTarget = latestReturnCheckpoint(original);
    expect(originalTarget).not.toBeNull();
    const originalAfterSetup = original.getState();

    const view = await render(
      <OrientationChrome surface={surface} projection={projectionFor(original, fetched(TWO_CONTEXT_WORLD({ depth: 'WORLD' })))} exactReturnTarget={originalTarget} />,
    );
    expect(disabledOf(view, 'EXACT_RETURN')).toBe(false);

    // The whole surface is replaced with a different store, while the OLD target is still passed.
    const replacement = reader();
    await act(async () => {
      view.rerender(
        <OrientationChrome
          surface={chromeSurface(replacement)}
          projection={projectionFor(replacement, fetched(TWO_CONTEXT_WORLD()))}
          exactReturnTarget={originalTarget}
        />,
      );
    });

    // I84 — the replacement has recorded nothing, so a target with that ordinal cannot still stand.
    expect(replacement.getState().history).toHaveLength(0);
    expect(disabledOf(view, 'EXACT_RETURN')).toBe(true);

    // I83 — and every act now reaches the replacement, never the store that was left behind.
    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:RETURN_WORLD`));
    });
    expect(replacement.getState().history).toHaveLength(1);
    expect(original.getState()).toBe(originalAfterSetup);

    await act(async () => {
      view.unmount();
    });
  });

  it('I86 — the one piece of local state is noncanonical and can only ever remove an opportunity', async () => {
    const store = reader();
    const surface = chromeSurface(store);
    returnWorld(surface);
    // A real handle from ANOTHER store: T-07 refuses it, and T-08 retires it.
    const foreign = reader();
    returnWorld(chromeSurface(foreign));
    const foreignTarget = latestReturnCheckpoint(foreign);

    const before = store.getState();
    const view = await render(
      <OrientationChrome
        surface={surface}
        projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD({ depth: 'WORLD' })))}
        exactReturnTarget={foreignTarget}
      />,
    );
    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`));
    });

    // Canonical state is untouched, and the transient retirement only ever subtracts.
    expect(store.getState()).toBe(before);
    expect(disabledOf(view, 'EXACT_RETURN')).toBe(true);
    expect(Object.keys(store.getState()).sort()).toEqual([...CANONICAL_STATE_KEYS].sort());

    // A rerender does not resurrect it, and a remount starts clean rather than inheriting it.
    await act(async () => {
      view.rerender(
        <OrientationChrome
          surface={surface}
          projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD({ depth: 'WORLD' })))}
          exactReturnTarget={foreignTarget}
        />,
      );
    });
    expect(disabledOf(view, 'EXACT_RETURN')).toBe(true);

    await act(async () => {
      view.unmount();
    });
  });
});
