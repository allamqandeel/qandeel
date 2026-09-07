/**
 * T-08 — G / R2-01: the Exact Return opportunity is provenance-proven, opaque, and never resurrects.
 *
 * R1 bound an opportunity to the store a caller SAID a target belonged to, and kept it alive while
 * the store's reversible depth exceeded the target's ordinal. R2 found both halves insufficient:
 *
 *   - a foreign target could be bound to this store, because nothing here could check the claim;
 *   - an ordinal is re-occupied, so a consumed target could be re-offered once unrelated new
 *     transactions grew history past its old position.
 *
 * Provenance now comes from T-07's own read-only predicate, asked at binding and again on every
 * render. The handle carries no data at all, so there is no second notion of validity to disagree
 * with it.
 */
import { act, fireEvent, render } from '@testing-library/react-native';

import { sessionPosition, type CanonicalStore } from '../../state';
import {
  backOneStep,
  exactReturn,
  isCurrentReturnCheckpointTargetForStore,
  isReturnCheckpointTarget,
  latestReturnCheckpoint,
  returnCheckpoints,
  returnWorld,
} from '../../return-navigation';
import { inspectObject } from '../../map';
import { OrientationChrome } from '../OrientationChrome';
import { RETURN_CONTROLS_TEST_ID } from '../ReturnControls';
import { bindExactReturnOrigin, exactReturnTargetFor, isExactReturnOrigin, type ExactReturnOrigin } from '../exact-return-origin';
import { orientationModel } from '../model';
import { chromeStore, chromeSurface, contextAt, fetched, isOffered, projectionFor, TWO_CONTEXT_WORLD } from '../__fixtures__/chrome';

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

/** Records `count` further reversible transactions, so history grows past any old ordinal. */
function growHistory(store: CanonicalStore, count: number): void {
  const context = contextAt(TWO_CONTEXT_WORLD());
  const targets = [
    { family: 'THREAD' as const, id: 'thread-a' },
    { family: 'THREAD' as const, id: 'thread-b' },
    { family: 'READING' as const, id: 'reading-1' },
  ];
  for (let index = 0; index < count; index += 1) {
    const outcome = inspectObject(store, context, targets[index % targets.length]);
    if (outcome.outcome !== 'APPLIED') throw new Error(`history did not grow: ${JSON.stringify(outcome)}`);
  }
}

const offersExact = (store: CanonicalStore, origin: ExactReturnOrigin | null) =>
  isOffered(orientationModel(store, projectionFor(store, fetched(TWO_CONTEXT_WORLD())), { exactReturnOrigin: origin }), 'EXACT_RETURN');

describe('R2-01 — binding requires real provenance, not a claim', () => {
  it('R2-01.2 — a target this store minted and still records binds', () => {
    const { store, origin } = afterOneStep();
    expect(isExactReturnOrigin(origin)).toBe(true);
    expect(offersExact(store, origin)).toBe(true);
  });

  it('R2-01.1 — a target minted by ANOTHER store cannot be bound to this one', () => {
    const mine = afterOneStep();
    const foreign = afterOneStep();
    // Both stores have exactly one checkpoint, so the foreign target's ordinal fits this store's
    // depth perfectly: an ordinal check would have accepted it. Provenance is what refuses.
    expect(isReturnCheckpointTarget(foreign.target)).toBe(true);
    expect(mine.store.getState().history).toHaveLength(1);
    expect(foreign.target.index).toBe(0);

    expect(isCurrentReturnCheckpointTargetForStore(mine.store, foreign.target)).toBe(false);
    expect(bindExactReturnOrigin(mine.store, foreign.target)).toBeNull();
    expect(offersExact(mine.store, null)).toBe(false);
  });

  it('R2-01.1b — the foreign target is never offered, and there is nothing to press', async () => {
    const mine = afterOneStep();
    const foreign = afterOneStep();
    const forged = bindExactReturnOrigin(mine.store, foreign.target);
    expect(forged).toBeNull();

    const before = mine.store.getState();
    const view = await render(
      <OrientationChrome
        surface={chromeSurface(mine.store)}
        projection={projectionFor(mine.store, fetched(TWO_CONTEXT_WORLD()))}
        exactReturnOrigin={forged}
      />,
    );
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`)).toBeNull();
    expect(mine.store.getState()).toBe(before);

    await act(async () => {
      view.unmount();
    });
  });

  it('R2-01.3, R2-01.4 — a structural copy and a JSON round trip cannot bind', () => {
    const { store, target } = afterOneStep();
    for (const forgery of [{ ...target }, JSON.parse(JSON.stringify(target)), { index: 0 }, Object.freeze({ index: 0 })]) {
      expect(isReturnCheckpointTarget(forgery)).toBe(false);
      expect(isCurrentReturnCheckpointTargetForStore(store, forgery)).toBe(false);
      expect(bindExactReturnOrigin(store, forgery)).toBeNull();
    }
    // And a look-alike opportunity is not one either.
    expect(isExactReturnOrigin({})).toBe(false);
    expect(exactReturnTargetFor(store, {})).toBeNull();
  });

  it('R2-01.5 — a target consumed BEFORE binding cannot bind', () => {
    const { store, surface, target } = afterOneStep();
    backOneStep(surface);
    expect(store.getState().history).toHaveLength(0);
    expect(isReturnCheckpointTarget(target)).toBe(true);
    expect(bindExactReturnOrigin(store, target)).toBeNull();
  });
});

describe('R2-01 — a consumed opportunity never resurrects', () => {
  it('R2-01.8, R2-01.9 — Exact Return retires the origin, and history regrowth does not revive it', async () => {
    const { store, origin } = afterOneStep();
    const surface = chromeSurface(store);
    const view = await render(
      <OrientationChrome surface={surface} projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD({ depth: 'WORLD' })))} exactReturnOrigin={origin} />,
    );
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`)).not.toBeNull();

    await act(async () => {
      fireEvent.press(view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`));
    });
    expect(store.getState().history).toHaveLength(0);
    expect(exactReturnTargetFor(store, origin)).toBeNull();

    await act(async () => {
      view.unmount();
    });

    // Now record unrelated new transactions until history is deeper than the consumed ordinal ever
    // was. An ordinal-based check would offer the dead origin again here.
    growHistory(store, 3);
    expect(store.getState().history.length).toBeGreaterThan(1);
    expect(exactReturnTargetFor(store, origin)).toBeNull();
    expect(offersExact(store, origin)).toBe(false);
  });

  it('R2-01.10 — Back consumption plus regrowth does not revive the origin either', () => {
    const { store, surface, origin } = afterOneStep();
    expect(offersExact(store, origin)).toBe(true);

    backOneStep(surface);
    expect(store.getState().history).toHaveLength(0);
    expect(offersExact(store, origin)).toBe(false);

    growHistory(store, 3);
    expect(store.getState().history.length).toBeGreaterThan(1);
    // Dead forever: presence is asked about the entry itself, never about a count.
    expect(exactReturnTargetFor(store, origin)).toBeNull();
    expect(offersExact(store, origin)).toBe(false);
  });

  it('R2-01.6 — an origin valid at binding but consumed before render is not offered', async () => {
    const { store, surface, origin } = afterOneStep();
    backOneStep(surface);

    const view = await render(
      <OrientationChrome surface={surface} projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD()))} exactReturnOrigin={origin} />,
    );
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`)).toBeNull();

    await act(async () => {
      view.unmount();
    });
  });

  it('R2-01.7 — a target consumed between validation and press is refused by T-07, with no extra mutation', () => {
    const { store, surface, origin } = afterOneStep();
    const target = exactReturnTargetFor(store, origin);
    expect(target).not.toBeNull();

    // The consuming event happens after the presentation validated the target.
    backOneStep(surface);
    const afterConsumption = store.getState();

    // A press that raced through anyway reaches T-07, which re-proves provenance and presence.
    const outcome = exactReturn(surface, target!);
    expect(outcome.outcome).toBe('REJECTED');
    // Nothing beyond the consuming event happened.
    expect(store.getState()).toBe(afterConsumption);
  });
});

describe('R2-01 — lifecycle and surface', () => {
  it('R2-01.11 — a replaced store invalidates the origin immediately', async () => {
    const original = afterOneStep();
    const replacement = afterOneStep();
    // The replacement has a checkpoint at the same ordinal, so only provenance tells them apart.
    expect(replacement.store.getState().history).toHaveLength(1);

    const view = await render(
      <OrientationChrome
        surface={original.surface}
        projection={projectionFor(original.store, fetched(TWO_CONTEXT_WORLD({ depth: 'WORLD' })))}
        exactReturnOrigin={original.origin}
      />,
    );
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`)).not.toBeNull();

    await act(async () => {
      view.rerender(
        <OrientationChrome
          surface={chromeSurface(replacement.store)}
          projection={projectionFor(replacement.store, fetched(TWO_CONTEXT_WORLD({ depth: 'WORLD' })))}
          exactReturnOrigin={original.origin}
        />,
      );
    });
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`)).toBeNull();
    expect(exactReturnTargetFor(replacement.store, original.origin)).toBeNull();

    await act(async () => {
      view.unmount();
    });
  });

  it('R2-01.12 — a valid same-store origin survives rerenders and callback churn', async () => {
    const { store, origin } = afterOneStep();
    const projection = projectionFor(store, fetched(TWO_CONTEXT_WORLD({ depth: 'WORLD' })));
    const view = await render(
      <OrientationChrome surface={chromeSurface(store)} projection={projection} exactReturnOrigin={origin} onReturnOutcome={() => undefined} />,
    );
    const present = () => view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`) !== null;
    expect(present()).toBe(true);

    for (let index = 0; index < 3; index += 1) {
      await act(async () => {
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

  it('R2-01.13 — the predicate answers with a boolean and exposes no checkpoint internals', () => {
    const { store, target, origin } = afterOneStep();
    const answer = isCurrentReturnCheckpointTargetForStore(store, target);
    expect(typeof answer).toBe('boolean');
    expect(answer).toBe(true);
    // The handle it answers about still discloses only its ordinal, and the opportunity discloses
    // nothing at all — no entry, no captured position, no inspection, no camera.
    expect(Object.keys(target)).toEqual(['index']);
    expect(Object.keys(origin)).toEqual([]);
    expect(JSON.stringify(origin)).toBe('{}');
    for (const internal of ['tmProvenance', 'ifRef', 'captured', 'camera', 'entry']) {
      expect(JSON.stringify(target)).not.toContain(internal);
    }
  });

  it('G68, G69 — the model carries a count of the reader\'s own steps and no destinations', () => {
    const { store, origin } = afterOneStep();
    const model = orientationModel(store, projectionFor(store, fetched(TWO_CONTEXT_WORLD())), { exactReturnOrigin: origin });
    expect(model.returns.checkpointCount).toBe(1);
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain('tmProvenance');
    expect(serialized).not.toContain('ifRef');
    expect(serialized).not.toContain('captured');
    expect(Object.keys(model.returns).sort()).toEqual(['checkpointCount', 'offered']);
    expect(returnCheckpoints(store)).toHaveLength(1);
  });

  it('G-none — with no bound opportunity there is no Exact Return, and nothing is guessed', () => {
    const { store } = afterOneStep();
    for (const nothing of [null, undefined]) {
      expect(offersExact(store, nothing as ExactReturnOrigin | null)).toBe(false);
    }
    expect(store.getState().history).toHaveLength(1);
  });
});
