/**
 * T-08 — F: contextual appearance, chosen explicitly and never elected.
 *
 * One canonical identity may be legitimately disclosed in several contexts. That is an ambiguity the
 * Product must present, not resolve: no primary, no default, no preselection, no nearest geometry, no
 * Live Focus heuristic and no first row. Choosing is the reader's act, it goes through T-04's own
 * executor, and it changes the vantage without changing the object or creating a relation.
 */
import { act, fireEvent, render } from '@testing-library/react-native';

import { decodeInspectionRef } from '../../map';
import { CONTEXT_CHOICE_TEST_ID } from '../InspectionOrientation';
import { OrientationChrome } from '../OrientationChrome';
import { contextOrientation } from '../context-orientation';
import { orientationModel } from '../model';
import { chromeSurface, contextAt, fetched, historicalStore, inspect, known, projectionFor, TWO_CONTEXT_WORLD, withInspection, world } from '../__fixtures__/chrome';

const DISCLOSED = () => withInspection(TWO_CONTEXT_WORLD(), known());

/** A reader inspecting `reading-1` through the `binding-a` context, which has a sibling context. */
function inspectingThroughA() {
  const store = historicalStore();
  inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-a' } });
  return { store, projection: projectionFor(store, fetched(DISCLOSED())) };
}

describe('OC08-F — when a chooser exists at all', () => {
  it('F51 — one legitimate appearance produces no artificial chooser', async () => {
    const single = world({
      depth: 'ANALYTICAL_OBJECT',
      tc: 4,
      liveHead: 6,
      threads: [{ id: 'thread-a', x: '1000000', y: '0' }],
      appearances: [{ bindingId: 'binding-a', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
      readings: [{ id: 'reading-1' }],
    });
    const store = historicalStore();
    inspect(store, contextAt(single), { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-a' } });
    const model = orientationModel(store, projectionFor(store, fetched(withInspection(single, known()))));
    // One appearance is not a choice, so nothing is offered rather than a chooser of one.
    expect(model.context.appearances).toEqual([]);
    expect(model.context.choiceAvailable).toBe(false);

    const view = await render(<OrientationChrome surface={chromeSurface(store)} projection={projectionFor(store, fetched(withInspection(single, known())))} />);
    expect(view.queryByTestId(CONTEXT_CHOICE_TEST_ID)).toBeNull();
    await act(async () => {
      view.unmount();
    });
  });

  it('F52, F53, F54 — several disclosed appearances are all offered, none marked as preferable', async () => {
    const { store, projection } = inspectingThroughA();
    const model = orientationModel(store, projection);
    expect(model.context.choiceAvailable).toBe(true);
    expect(model.context.appearances.map((option) => option.bindingId)).toEqual(['binding-a', 'binding-b']);
    // `current` states where the reader IS. Exactly one, and only because their own `IF_ref` says so.
    expect(model.context.appearances.filter((option) => option.current).map((option) => option.bindingId)).toEqual(['binding-a']);
    // The order denies being a ranking, out loud.
    expect(model.context.ordering).toContain('not a ranking');

    const view = await render(<OrientationChrome surface={chromeSurface(store)} projection={projection} />);
    const selected = model.context.appearances.map(
      (option) => view.getByTestId(`${CONTEXT_CHOICE_TEST_ID}:option:${option.ordinal}`).props.accessibilityState.selected,
    );
    expect(selected).toEqual([true, false]);
    await act(async () => {
      view.unmount();
    });
  });

  it('F53b — where the reader is inside no named context, no option is marked at all', () => {
    const store = historicalStore();
    inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1' });
    const model = orientationModel(store, projectionFor(store, fetched(DISCLOSED())));
    expect(model.context.appearances).toHaveLength(2);
    expect(model.context.appearances.every((option) => option.current === false)).toBe(true);
  });

  it('F55 — a context that this position does not disclose is absent from the list entirely', () => {
    const { store, projection } = inspectingThroughA();
    const model = orientationModel(store, projection);
    // The live world has a third context; `K(TC)` here does not, so it is not offered.
    expect(model.context.appearances.map((option) => option.bindingId)).not.toContain('binding-future');
    expect(JSON.stringify(model.context)).not.toContain('binding-future');
  });
});

describe('OC08-F — choosing', () => {
  it('F56, F58, F59 — the choice runs T-04\'s executor, keeps one identity and creates no relation', async () => {
    const { store, projection } = inspectingThroughA();
    const model = orientationModel(store, projection);
    const other = model.context.appearances.find((option) => option.bindingId === 'binding-b')!;
    const before = store.getState();

    const view = await render(<OrientationChrome surface={chromeSurface(store)} projection={projection} />);
    await act(async () => {
      fireEvent.press(view.getByTestId(`${CONTEXT_CHOICE_TEST_ID}:option:${other.ordinal}`));
    });

    const after = store.getState();
    const decoded = decodeInspectionRef(after.inspection);
    // F56 — the vantage moved, through the owner's own act.
    expect(decoded?.appearance?.bindingId).toBe('binding-b');
    // F58 — the same canonical identity, still one.
    expect(decoded?.family).toBe('READING');
    expect(decoded?.id).toBe('reading-1');
    // F59 — nothing else changed: no relation, no camera move, no temporal move.
    expect(after.camera).toBe(before.camera);
    expect(after.temporal).toBe(before.temporal);
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());

    await act(async () => {
      view.unmount();
    });
  });

  it('F57 — rendering the chooser performs no act; only an explicit press does', async () => {
    const { store, projection } = inspectingThroughA();
    const before = store.getState();
    const view = await render(<OrientationChrome surface={chromeSurface(store)} projection={projection} />);
    // Mounted, re-rendered and left alone: nothing is chosen for the reader.
    await act(async () => {
      view.rerender(<OrientationChrome surface={chromeSurface(store)} projection={projection} />);
    });
    // Object identity: not merely equal afterwards, but never republished at all. The reader's own
    // earlier inspection is still the only thing recorded.
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toBe(before.history);
    await act(async () => {
      view.unmount();
    });
  });

  it('F60 — a stale projection retires the chooser rather than leaving it actionable', () => {
    const { store } = inspectingThroughA();
    const stale = orientationModel(store, { held: true, context: contextAt(withInspection(TWO_CONTEXT_WORLD({ tc: 3 }), known())) });
    expect(stale.projection.status).toBe('STALE');
    expect(stale.context.choiceAvailable).toBe(false);
    expect(stale.context.appearances).toEqual([]);
  });

  it('F-identity — a family the Map does not place has no chooser, and that is a truthful answer', () => {
    const context = contextAt(DISCLOSED());
    expect(contextOrientation({ context, identity: { family: 'MATERIAL', id: 'material-1' }, currentBindingId: null, lineage: [] }).appearances).toEqual([]);
    expect(contextOrientation({ context, identity: null, currentBindingId: null, lineage: [] }).choiceAvailable).toBe(false);
  });
});
