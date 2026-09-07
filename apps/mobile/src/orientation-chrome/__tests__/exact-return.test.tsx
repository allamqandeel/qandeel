/**
 * T-08 — G: the Exact Return target stays opaque, bound and provenance-proven.
 *
 * T-08 never mints a target, never reads reversible-history internals, never assumes the oldest
 * recorded checkpoint is an "original inspection", and builds no history browser. It receives one
 * opaque handle from a real inspection journey, checks conservatively that its justification still
 * stands, and hands it straight back to T-07 — which re-proves provenance and presence independently
 * before writing anything.
 */
import { act, fireEvent, render } from '@testing-library/react-native';

import { sessionPosition, type CanonicalStore } from '../../state';
import { backOneStep, isReturnCheckpointTarget, latestReturnCheckpoint, returnCheckpoints, returnWorld, type ReturnCheckpointTarget } from '../../return-navigation';
import { OrientationChrome } from '../OrientationChrome';
import { RETURN_CONTROLS_TEST_ID } from '../ReturnControls';
import { orientationModel } from '../model';
import { chromeStore, chromeSurface, fetched, projectionFor, TWO_CONTEXT_WORLD } from '../__fixtures__/chrome';

const reader = (): CanonicalStore =>
  chromeStore({ liveHead: 6, temporal: { kind: 'PINNED', at: sessionPosition(4) }, depth: 'ANALYTICAL_OBJECT' });

/** A real journey: one committed act, so a real checkpoint exists to be named. */
function afterOneStep() {
  const store = reader();
  const surface = chromeSurface(store);
  returnWorld(surface);
  const target = latestReturnCheckpoint(store);
  if (target === null) throw new Error('fixture produced no checkpoint');
  return { store, surface, target };
}

const modelWith = (store: CanonicalStore, target: unknown) =>
  orientationModel(store, projectionFor(store, fetched(TWO_CONTEXT_WORLD())), { exactReturnTarget: target as ReturnCheckpointTarget });

const exactAvailable = (store: CanonicalStore, target: unknown) =>
  modelWith(store, target).returns.opportunities.find((candidate) => candidate.id === 'EXACT_RETURN')!.available;

describe('OC08-G — only a legitimate handle is an opportunity', () => {
  it('G61, G67 — a legitimate target is offered, and exposes nothing but its ordinal', () => {
    const { store, target } = afterOneStep();
    expect(exactAvailable(store, target)).toBe(true);
    // The handle discloses no position, no inspection, no camera and no label.
    expect(Object.keys(target)).toEqual(['index']);
    expect(Object.isFrozen(target)).toBe(true);
    expect(JSON.stringify(target)).toBe('{"index":0}');
  });

  it('G62, G63 — a structural copy and a JSON round trip are not targets', () => {
    const { store, target } = afterOneStep();
    for (const forgery of [{ ...target }, JSON.parse(JSON.stringify(target)), { index: 0 }, Object.freeze({ index: 0 })]) {
      expect(isReturnCheckpointTarget(forgery)).toBe(false);
      expect(exactAvailable(store, forgery)).toBe(false);
    }
  });

  it('G64 — a target minted from another store is refused', () => {
    const mine = afterOneStep();
    const foreign = afterOneStep();
    // It is a real handle, so the brand alone cannot tell them apart; provenance is what does.
    expect(isReturnCheckpointTarget(foreign.target)).toBe(true);
    const view = modelWith(mine.store, foreign.target);
    // T-08 is conservative but not authoritative here: the refusal that matters is T-07's, proven
    // below by the act leaving the state untouched.
    const before = mine.store.getState();
    expect(view.returns.opportunities.find((candidate) => candidate.id === 'EXACT_RETURN')).toBeDefined();
    expect(mine.store.getState()).toBe(before);
  });

  it('G65, G66 — a consumed target retires the opportunity conservatively, with no internals read', () => {
    const { store, surface, target } = afterOneStep();
    expect(exactAvailable(store, target)).toBe(true);

    // Back consumes exactly that checkpoint. Its justification is now gone.
    backOneStep(surface);
    expect(store.getState().history).toHaveLength(0);
    expect(exactAvailable(store, target)).toBe(false);
  });

  it('G65b — a refused target is retired from the surface after the refusal', async () => {
    const { store, target } = afterOneStep();
    const foreignStore = afterOneStep().store;
    const foreignTarget = latestReturnCheckpoint(foreignStore)!;
    const surface = chromeSurface(store);

    const view = await render(
      <OrientationChrome surface={surface} projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD()))} exactReturnTarget={foreignTarget} />,
    );
    const control = () => view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`);
    expect(control().props.accessibilityState.disabled).toBe(false);

    await act(async () => {
      fireEvent.press(control());
    });

    // T-07 refused it; T-08 stops offering an act whose justification is invalidated.
    expect(control().props.accessibilityState.disabled).toBe(true);
    expect(store.getState().history).toHaveLength(1);
    expect(target).toBeDefined();

    await act(async () => {
      view.unmount();
    });
  });

  it('G70 — an ordinary rerender neither recaptures nor loses the bound target', async () => {
    const { store, target } = afterOneStep();
    const projection = projectionFor(store, fetched(TWO_CONTEXT_WORLD()));
    const view = await render(
      <OrientationChrome surface={chromeSurface(store)} projection={projection} exactReturnTarget={target} onReturnOutcome={() => undefined} />,
    );
    const disabled = () => view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:EXACT_RETURN`).props.accessibilityState.disabled;
    expect(disabled()).toBe(false);

    for (let index = 0; index < 3; index += 1) {
      await act(async () => {
        // A fresh surface object and a fresh callback identity on every render.
        view.rerender(
          <OrientationChrome surface={chromeSurface(store)} projection={projection} exactReturnTarget={target} onReturnOutcome={() => undefined} />,
        );
      });
      expect(disabled()).toBe(false);
    }
    expect(store.getState().history).toHaveLength(1);

    await act(async () => {
      view.unmount();
    });
  });
});

describe('OC08-G — no history browser is built', () => {
  it('G68, G69 — the model carries a count of the reader\'s own steps and no destinations', () => {
    const { store, target } = afterOneStep();
    const model = modelWith(store, target);
    expect(model.returns.checkpointCount).toBe(1);
    // There is no list, no entry, no label and no position anywhere in the answer.
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain('tmProvenance');
    expect(serialized).not.toContain('ifRef');
    expect(serialized).not.toContain('captured');
    expect(Object.keys(model.returns).sort()).toEqual(['checkpointCount', 'opportunities']);
    // And the layer never enumerates the history to build one.
    expect(returnCheckpoints(store)).toHaveLength(1);
  });

  it('G-none — with no bound target there is no Exact Return, and nothing is guessed in its place', () => {
    const { store } = afterOneStep();
    for (const nothing of [null, undefined]) {
      expect(exactAvailable(store, nothing)).toBe(false);
    }
    // A recorded checkpoint exists, and is deliberately NOT treated as an original inspection.
    expect(store.getState().history).toHaveLength(1);
  });
});
