/**
 * T-08 — G: the Exact Return opportunity is opaque, bound to a store lifecycle, and never guessed.
 *
 * T-08 never mints a target, never reads reversible-history internals, never assumes the oldest
 * recorded checkpoint is an "original inspection", and builds no history browser.
 *
 * R1 closed a Product defect here. A handle minted by ANOTHER store is a real handle whose ordinal
 * may well be inside this store's reversible depth, so the old ordinal-only check offered a control
 * that could never work; T-07 refused it correctly, but only once the reader had pressed it. The
 * opportunity is now bound to the store it was created against, so it is simply not offered — and
 * T-07 still re-proves provenance and presence independently at execution.
 */
import { act, fireEvent, render } from '@testing-library/react-native';

import { sessionPosition, type CanonicalStore } from '../../state';
import { backOneStep, isReturnCheckpointTarget, latestReturnCheckpoint, returnCheckpoints, returnWorld } from '../../return-navigation';
import { OrientationChrome } from '../OrientationChrome';
import { RETURN_CONTROLS_TEST_ID } from '../ReturnControls';
import { bindExactReturnOrigin, exactReturnTargetFor, isExactReturnOrigin, type ExactReturnOrigin } from '../exact-return-origin';
import { orientationModel } from '../model';
import { chromeStore, chromeSurface, fetched, isOffered, projectionFor, TWO_CONTEXT_WORLD } from '../__fixtures__/chrome';

const reader = (): CanonicalStore =>
  chromeStore({ liveHead: 6, temporal: { kind: 'PINNED', at: sessionPosition(4) }, depth: 'ANALYTICAL_OBJECT' });

/** A real journey: one committed act, so a real checkpoint exists to be named. */
function afterOneStep() {
  const store = reader();
  const surface = chromeSurface(store);
  returnWorld(surface);
  const target = latestReturnCheckpoint(store);
  if (target === null) throw new Error('fixture produced no checkpoint');
  const origin = bindExactReturnOrigin(store, target);
  if (origin === null) throw new Error('fixture produced no origin');
  return { store, surface, target, origin };
}

const offersExact = (store: CanonicalStore, origin: ExactReturnOrigin | null) =>
  isOffered(orientationModel(store, projectionFor(store, fetched(TWO_CONTEXT_WORLD())), { exactReturnOrigin: origin }), 'EXACT_RETURN');

describe('OC08-G — only a legitimately bound opportunity is offered', () => {
  it('G61, G67 — a bound origin is offered, and exposes nothing but its ordinal', () => {
    const { store, target, origin } = afterOneStep();
    expect(offersExact(store, origin)).toBe(true);
    // Neither the handle nor the opportunity discloses a position, an inspection, a camera or a label.
    expect(Object.keys(target)).toEqual(['index']);
    expect(Object.keys(origin)).toEqual(['ordinal']);
    expect(Object.isFrozen(origin)).toBe(true);
    expect(JSON.stringify(origin)).toBe('{"ordinal":0}');
  });

  it('G62, G63 — a structural copy and a JSON round trip bind nothing', () => {
    const { store, target } = afterOneStep();
    for (const forgery of [{ ...target }, JSON.parse(JSON.stringify(target)), { index: 0 }, Object.freeze({ index: 0 })]) {
      expect(isReturnCheckpointTarget(forgery)).toBe(false);
      expect(bindExactReturnOrigin(store, forgery)).toBeNull();
    }
    // And a look-alike opportunity is not one either.
    expect(isExactReturnOrigin({ ordinal: 0 })).toBe(false);
    expect(exactReturnTargetFor(store, { ordinal: 0 })).toBeNull();
  });

  it('R1-07 — an origin bound against another store is NOT offered, before any press', async () => {
    const mine = afterOneStep();
    const foreign = afterOneStep();
    // It is a genuinely bound opportunity, from a genuinely recorded checkpoint, whose ordinal is
    // inside this store's reversible depth. Only the store binding tells them apart.
    expect(isExactReturnOrigin(foreign.origin)).toBe(true);
    expect(foreign.origin.ordinal).toBeLessThan(mine.store.getState().history.length);

    expect(exactReturnTargetFor(mine.store, foreign.origin)).toBeNull();
    expect(offersExact(mine.store, foreign.origin)).toBe(false);

    const before = mine.store.getState();
    const view = await render(
      <OrientationChrome
        surface={chromeSurface(mine.store)}
        projection={projectionFor(mine.store, fetched(TWO_CONTEXT_WORLD()))}
        exactReturnOrigin={foreign.origin}
      />,
    );
    // The control does not exist at all, so there is nothing to press and nothing to refuse.
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`)).toBeNull();
    expect(mine.store.getState()).toBe(before);

    await act(async () => {
      view.unmount();
    });
  });

  it('G65, G66 — a consumed origin retires itself, with no internals read', () => {
    const { store, surface, origin } = afterOneStep();
    expect(offersExact(store, origin)).toBe(true);

    // Back consumes exactly that checkpoint. Its justification is now gone.
    backOneStep(surface);
    expect(store.getState().history).toHaveLength(0);
    expect(exactReturnTargetFor(store, origin)).toBeNull();
    expect(offersExact(store, origin)).toBe(false);
  });

  it('G61b — pressing a legitimately bound opportunity restores it and then retires it', async () => {
    const { store, origin } = afterOneStep();
    const surface = chromeSurface(store);
    const view = await render(
      <OrientationChrome surface={surface} projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD({ depth: 'WORLD' })))} exactReturnOrigin={origin} />,
    );
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`)).not.toBeNull();

    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`));
    });

    // The checkpoint was consumed, so the opportunity is gone on the very next render.
    expect(store.getState().history).toHaveLength(0);
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`)).toBeNull();

    await act(async () => {
      view.unmount();
    });
  });

  it('R1-09 — a valid same-store opportunity survives ordinary rerenders and callback churn', async () => {
    const { store, origin } = afterOneStep();
    const projection = projectionFor(store, fetched(TWO_CONTEXT_WORLD()));
    const view = await render(
      <OrientationChrome surface={chromeSurface(store)} projection={projection} exactReturnOrigin={origin} onReturnOutcome={() => undefined} />,
    );
    const present = () => view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`) !== null;
    expect(present()).toBe(true);

    for (let index = 0; index < 3; index += 1) {
      await act(async () => {
        // A fresh surface object and a fresh callback identity on every render.
        view.rerender(
          <OrientationChrome surface={chromeSurface(store)} projection={projection} exactReturnOrigin={origin} onReturnOutcome={() => undefined} />,
        );
      });
      expect(present()).toBe(true);
    }
    expect(store.getState().history).toHaveLength(1);

    await act(async () => {
      view.unmount();
    });
  });
});

describe('OC08-G — no history browser is built', () => {
  it('G68, G69 — the model carries a count of the reader\'s own steps and no destinations', () => {
    const { store, origin } = afterOneStep();
    const model = orientationModel(store, projectionFor(store, fetched(TWO_CONTEXT_WORLD())), { exactReturnOrigin: origin });
    expect(model.returns.checkpointCount).toBe(1);
    // There is no list, no entry, no label and no position anywhere in the answer.
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain('tmProvenance');
    expect(serialized).not.toContain('ifRef');
    expect(serialized).not.toContain('captured');
    expect(Object.keys(model.returns).sort()).toEqual(['checkpointCount', 'offered']);
    // And the layer never enumerates the history to build one.
    expect(returnCheckpoints(store)).toHaveLength(1);
  });

  it('G-none — with no bound opportunity there is no Exact Return, and nothing is guessed in its place', () => {
    const { store } = afterOneStep();
    for (const nothing of [null, undefined]) {
      expect(offersExact(store, nothing as ExactReturnOrigin | null)).toBe(false);
    }
    // A recorded checkpoint exists, and is deliberately NOT treated as an original inspection.
    expect(store.getState().history).toHaveLength(1);
  });

  it('G-bind — binding refuses an ordinal beyond the store\'s own reversible depth', () => {
    const { store, surface, target } = afterOneStep();
    backOneStep(surface);
    expect(store.getState().history).toHaveLength(0);
    // The target is still a real handle; there is simply nothing left for it to stand for.
    expect(isReturnCheckpointTarget(target)).toBe(true);
    expect(bindExactReturnOrigin(store, target)).toBeNull();
  });
});
