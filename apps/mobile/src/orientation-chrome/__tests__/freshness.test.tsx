/**
 * T-08 — E: freshness before meaning.
 *
 * A projection is authority for exactly the viewpoint it was disclosed for. Read a stale, foreign,
 * wrong-position or wrong-depth scene as evidence and every absence in it becomes a confident lie.
 * These tests take a projection that is perfectly coherent in itself, point it at a viewpoint it does
 * not describe, and prove that NOTHING semantic survives: not an identity, not a context list, not a
 * capability, and not an accessibility label.
 */
import { act, render } from '@testing-library/react-native';

import { sessionPosition } from '../../state';
import { returnWorld } from '../../return-navigation';
import { INSPECTION_ORIENTATION_TEST_ID } from '../InspectionOrientation';
import { CONTEXT_CHOICE_TEST_ID } from '../InspectionOrientation';
import { OrientationChrome } from '../OrientationChrome';
import { orientationModel } from '../model';
import { chromeStore, chromeSurface, contextAt, fetched, historicalStore, inspect, isOffered, known, projectionFor, TWO_CONTEXT_WORLD, withInspection } from '../__fixtures__/chrome';

const DISCLOSED = () => withInspection(TWO_CONTEXT_WORLD(), known());

describe('OC08-E — a projection that is not this viewpoint\'s yields no semantic answer', () => {
  it('E43 — the current projection does derive semantic chrome', () => {
    const store = historicalStore({ liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' }, liveFocusAtSp: 5 });
    inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-a' } });
    const model = orientationModel(store, projectionFor(store, fetched(DISCLOSED())));
    expect(model.projection).toEqual({ status: 'CURRENT' });
    expect(model.inspection.render.kind).toBe('RENDERABLE');
    expect(model.context.appearances).toHaveLength(2);
    expect(model.live.focusReturn).toBe('AVAILABLE');
  });

  it.each([
    ['E44 — a foreign Session', () => chromeStore({ sessionId: 'session-2', liveHead: 6, depth: 'ANALYTICAL_OBJECT', temporal: { kind: 'PINNED', at: sessionPosition(4) } }), 'SESSION_CHANGED'],
    ['E45 — a different temporal position', () => historicalStore({ temporal: { kind: 'PINNED', at: sessionPosition(5) } }), 'TEMPORAL_POSITION_CHANGED'],
    ['E46 — a different semantic depth', () => historicalStore({ depth: 'SESSION' }), 'SEMANTIC_DEPTH_CHANGED'],
  ])('%s makes every semantic answer technical', (_name, build, reason) => {
    const store = build();
    // A perfectly coherent context — just not this viewpoint's.
    const model = orientationModel(store, { held: true, context: contextAt(DISCLOSED()) });

    expect(model.projection).toEqual({ status: 'STALE', reason });
    // E48 — a stale context cannot enable the focus return: the question is not even asked.
    expect(model.live.focusReturn).toBe('UNPROVEN');
    expect(isOffered(model, 'RETURN_LIVE_FOCUS')).toBe(false);
    // E49 — and it cannot enumerate contexts, or retain the ones it used to know.
    expect(model.context.appearances).toEqual([]);
    expect(model.context.lineage).toEqual([]);
    expect(model.context.choiceAvailable).toBe(false);
    // The generic Class-A orientation survives, because it never depended on the projection.
    expect(model.temporal.mode).toBe('PINNED');
  });

  it('E44b — a stale context is never reported as an absence in the world', () => {
    const store = historicalStore({ depth: 'SESSION' });
    inspect(historicalStore(), contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1' });
    const model = orientationModel(store, { held: true, context: contextAt(DISCLOSED()) });
    // With no inspection held here the answer is the neutral one; what matters is that the STALE
    // projection never becomes `IDENTITY_UNKNOWN_AT_TC` for a reader who does hold one.
    const inspecting = historicalStore();
    inspect(inspecting, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1' });
    const stale = orientationModel(inspecting, { held: true, context: contextAt(withInspection(TWO_CONTEXT_WORLD({ tc: 3 }), known())) });
    expect(stale.projection.status).toBe('STALE');
    expect(stale.inspection.render).toEqual({ kind: 'PROJECTION_STALE', reason: 'TEMPORAL_POSITION_CHANGED' });
    expect(stale.inspection.render.kind).not.toBe('IDENTITY_UNKNOWN_AT_TC');
    expect(model.inspection.render.kind).toBe('NO_INSPECTION');
  });
});

describe('OC08-E — retirement happens on the very next render', () => {
  it('E47, E50 — a committed act that moves the camera retires the semantic chrome and its labels', async () => {
    const store = historicalStore({ liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' }, liveFocusAtSp: 5 });
    inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-a' } });
    const projection = projectionFor(store, fetched(DISCLOSED()));
    const surface = chromeSurface(store);

    const view = await render(<OrientationChrome surface={surface} projection={projection} />);
    expect(view.getByTestId(`${INSPECTION_ORIENTATION_TEST_ID}:statement`).props.children).toContain('You are inspecting a reading.');
    expect(view.queryByTestId(CONTEXT_CHOICE_TEST_ID)).not.toBeNull();

    // Return to World moves the camera to the WORLD rung, so the held ANALYTICAL_OBJECT disclosure
    // stops being this Map. The component is subscribed, so it re-derives on the next render.
    await act(async () => {
      returnWorld(surface);
    });

    const statement = view.getByTestId(`${INSPECTION_ORIENTATION_TEST_ID}:statement`).props.children as string;
    expect(statement).toBe('Catching up with where you are.');
    expect(statement).not.toContain('reading-1');
    // E50 — no stale semantic residue survives in the accessible output either.
    expect(view.queryByTestId(CONTEXT_CHOICE_TEST_ID)).toBeNull();
    expect(view.queryByTestId(`${INSPECTION_ORIENTATION_TEST_ID}:lineage`)).toBeNull();
    expect(JSON.stringify(view.toJSON())).not.toContain('binding-a');

    await act(async () => {
      view.unmount();
    });
  });
});
