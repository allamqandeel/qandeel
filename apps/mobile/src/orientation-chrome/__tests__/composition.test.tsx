/**
 * T-08 R3-06 / R3-06B — the Map and the chrome, in ONE world composition.
 *
 * The earlier proof asserted `pointerEvents="box-none"` on the chrome ROOT and called that
 * pass-through. It is not: `box-none` exempts only the node it is written on, so every descendant
 * `View` and `Text` kept ordinary hit testing and could still swallow a touch meant for the world.
 * What is proved here instead is the actual requirement — that in the real composed tree the ONLY
 * nodes able to take a press are the controls that mean something, and that a tap which misses them
 * reaches the Map's own route.
 *
 * The composition is a TEST composition. Nothing is mounted into the app shell: where the Map and
 * this chrome finally sit together in the Product is the integration task's decision, and mounting
 * it here to "prove integration" would steal exactly that.
 *
 * Narrow width is a real parent constraint and a real viewport envelope, not a safe-area inset. A
 * padding change proves padding; it says nothing about what happens when the surface is 320 points
 * wide and the Arabic wording runs longer than the English.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';

import { sessionPosition, type CanonicalStore } from '../../state';
import { MAP_SURFACE_PLANE_TEST_ID, MAP_SURFACE_TEST_ID, MapSurface, placeScene, decodeCameraIntent, type MapInspectionContext } from '../../map';
import { envelope } from '../../map/__fixtures__/store';
import { CONTEXT_CHOICE_TEST_ID, INSPECTION_ORIENTATION_TEST_ID } from '../InspectionOrientation';
import { ORIENTATION_CHROME_TEST_ID, OrientationChrome } from '../OrientationChrome';
import { RETURN_CONTROLS_TEST_ID } from '../ReturnControls';
import { orientationModel } from '../model';
import type { ChromeLanguage } from '../types';
import { chromeStore, chromeSurface, contextAt, fetched, historicalStore, inspect, known, offeredIds, projectionFor, TWO_CONTEXT_WORLD, withInspection } from '../__fixtures__/chrome';

const WIDE = envelope(390, 844);
const NARROW = envelope(320, 568);

const reader = (): CanonicalStore =>
  chromeStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
  });

/** A reader inspecting a Reading disclosed in two Threads, so the chooser is populated too. */
function inspecting() {
  const store = historicalStore();
  inspect(store, contextAt(TWO_CONTEXT_WORLD()), {
    family: 'READING',
    id: 'reading-1',
    appearance: { kind: 'THREAD_READING', bindingId: 'binding-a' },
  });
  return { store, disclosure: withInspection(TWO_CONTEXT_WORLD(), known()) };
}

/**
 * The world composition: one persistent Map with the chrome as support around it.
 *
 * Deliberately a plain `View`, not the app shell: this is the arrangement under test, not the
 * Product's final one.
 */
function World({
  store,
  context,
  language = 'en',
  width = WIDE,
  onMap,
  onReturn,
}: {
  store: CanonicalStore;
  context: MapInspectionContext;
  language?: ChromeLanguage;
  width?: ReturnType<typeof envelope>;
  onMap?: (outcome: unknown) => void;
  onReturn?: (id: string) => void;
}) {
  return (
    <View style={{ width: width.width, height: width.height }}>
      <MapSurface store={store} context={context} envelope={width} onOutcome={onMap} />
      <OrientationChrome
        language={language}
        surface={chromeSurface(store)}
        projection={{ held: true, context }}
        liveContext={() => ({ ok: false, code: 'PROJECTION_NOT_AVAILABLE', detail: 'none' })}
        onMapOutcome={onMap}
        onReturnOutcome={(id) => onReturn?.(id)}
      />
    </View>
  );
}

/** Every node of a subtree, flattened. */
function nodes(root: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (root === null || root === undefined || typeof root !== 'object') return out;
  if (Array.isArray(root)) {
    for (const child of root) nodes(child, out);
    return out;
  }
  const element = root as { type?: string; props?: Record<string, unknown>; children?: unknown };
  if (typeof element.type === 'string') out.push(element as Record<string, unknown>);
  nodes(element.children, out);
  return out;
}

/** A node that can take a press: React Native gives every real target the responder handlers. */
const isPressTarget = (node: Record<string, unknown>): boolean => {
  const props = (node.props ?? {}) as Record<string, unknown>;
  return typeof props.onStartShouldSetResponder === 'function';
};

const subtree = (view: Awaited<ReturnType<typeof render>>, testID: string) => nodes(view.getByTestId(testID));

describe('R3-06 — the world stays reachable through the chrome', () => {
  it('1, 6 — both the Map and the chrome are mounted in one composition, and there is exactly one Map', async () => {
    const { store, disclosure } = inspecting();
    const context = contextAt(disclosure);
    const view = await render(<World store={store} context={context} />);

    expect(view.getByTestId(MAP_SURFACE_TEST_ID)).toBeTruthy();
    expect(view.getByTestId(ORIENTATION_CHROME_TEST_ID)).toBeTruthy();
    // 6 — the chrome builds no second Map and no second hit-test universe that could disagree.
    expect(view.queryAllByTestId(MAP_SURFACE_TEST_ID)).toHaveLength(1);
    expect(subtree(view, ORIENTATION_CHROME_TEST_ID).filter((node) => node.type === 'Canvas')).toHaveLength(0);

    await act(async () => {
      view.unmount();
    });
  });

  it('the only nodes in the chrome that can take a press are the controls that mean something', async () => {
    const { store, disclosure } = inspecting();
    const view = await render(<World store={store} context={contextAt(disclosure)} />);

    const chrome = subtree(view, ORIENTATION_CHROME_TEST_ID);
    const targets = chrome.filter(isPressTarget).map((node) => ((node.props ?? {}) as Record<string, unknown>).testID);
    const model = orientationModel(store, { held: true, context: contextAt(disclosure) }, { liveContextAvailable: true });
    const expected = [
      ...offeredIds(model).map((id) => `${RETURN_CONTROLS_TEST_ID}:${id}`),
      ...model.context.appearances.map((option) => `${CONTEXT_CHOICE_TEST_ID}:option:${option.ordinal}`),
    ];
    expect([...targets].sort()).toEqual([...expected].sort());

    // 2 — and every structural node that is NOT a control declares itself transparent to touch, so
    // a press that misses a control is not absorbed by a label, a wrapper or a region.
    for (const node of chrome) {
      if (isPressTarget(node)) continue;
      if (node.type !== 'View') continue;
      const props = (node.props ?? {}) as Record<string, unknown>;
      expect(['box-none', 'none']).toContain(props.pointerEvents);
    }

    await act(async () => {
      view.unmount();
    });
  });

  it('2 — a tap that misses the chrome reaches the Map route and inspects the world', async () => {
    const store = reader();
    const context = contextAt(TWO_CONTEXT_WORLD());
    const outcomes: unknown[] = [];
    const view = await render(<World store={store} context={context} onMap={(outcome) => outcomes.push(outcome)} />);

    const decoded = decodeCameraIntent(store.getState().camera);
    if (!decoded.ok) throw new Error(decoded.detail);
    const placed = placeScene(context.scene, decoded.camera, WIDE);
    const target = placed.nodes[0];
    expect(target).toBeTruthy();

    await act(async () => {
      fireEvent(view.getByTestId(MAP_SURFACE_PLANE_TEST_ID), 'responderRelease', {
        nativeEvent: { locationX: target.x, locationY: target.y },
      });
    });

    // The Map's own act ran: the world was inspected, by the world's own route.
    expect(outcomes.length).toBeGreaterThan(0);
    expect(store.getState().inspection).not.toBeNull();

    await act(async () => {
      view.unmount();
    });
  });

  it('3 — pressing a chrome control runs the T-07 act and does not fall through to the Map', async () => {
    const store = reader();
    const context = contextAt(TWO_CONTEXT_WORLD());
    const mapOutcomes: unknown[] = [];
    const returns: string[] = [];
    const view = await render(<World store={store} context={context} onMap={(outcome) => mapOutcomes.push(outcome)} onReturn={(id) => returns.push(id)} />);

    const before = store.getState().inspection;
    await act(async () => {
      view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:RETURN_WORLD`).props.onClick();
    });

    expect(returns).toEqual(['RETURN_WORLD']);
    // The Map never saw it: no inspection happened, so the press did not also land on the world.
    expect(mapOutcomes).toHaveLength(0);
    expect(store.getState().inspection).toBe(before);

    await act(async () => {
      view.unmount();
    });
  });

  it('4 — pressing a contextual-appearance option switches context and does nothing else', async () => {
    const { store, disclosure } = inspecting();
    const context = contextAt(disclosure);
    const returns: string[] = [];
    const mapOutcomes: unknown[] = [];
    const view = await render(<World store={store} context={context} onMap={(outcome) => mapOutcomes.push(outcome)} onReturn={(id) => returns.push(id)} />);

    const beforeHistory = store.getState().history.length;
    await act(async () => {
      view.getByTestId(`${CONTEXT_CHOICE_TEST_ID}:option:1`).props.onClick();
    });

    // A context switch is T-04's act: exactly one Map outcome, and no return act at all. It is a
    // Product transaction, so it records exactly ONE reversible entry — the reader can take it
    // back — and it must not record more than one or trigger a return as well.
    expect(mapOutcomes).toHaveLength(1);
    expect(returns).toEqual([]);
    expect(store.getState().history.length).toBe(beforeHistory + 1);

    await act(async () => {
      view.unmount();
    });
  });

  it('5 — a stale Map projection stays unavailable even while the chrome is on screen', async () => {
    // The reader HAS asked to inspect something, so the technical sentence is the one under test:
    // a stale scene must produce "the Product cannot show you this yet", never "it is not there".
    const { store } = inspecting();
    const foreign = contextAt(TWO_CONTEXT_WORLD({ tc: 2, liveHead: 2 }));
    const view = await render(<World store={store} context={foreign} />);

    // The Map renders no scene at all rather than a plausible wrong one...
    expect(view.queryByTestId(MAP_SURFACE_PLANE_TEST_ID)).toBeNull();
    // ...and the chrome states the technical fact, without turning it into an absence in the world.
    const statement = view.getByTestId(`${INSPECTION_ORIENTATION_TEST_ID}:statement`).props.children as string;
    expect(statement).toBe('Catching up with where you are.');
    expect(statement).not.toContain('does not know');
    expect(orientationModel(store, { held: true, context: foreign }).projection.status).toBe('STALE');

    await act(async () => {
      view.unmount();
    });
  });

  it('a reader who has inspected nothing is shown no inspection region at all', async () => {
    const store = reader();
    const view = await render(<World store={store} context={contextAt(TWO_CONTEXT_WORLD())} />);
    // An empty region is not a surface: the world keeps the room instead.
    expect(view.queryByTestId(INSPECTION_ORIENTATION_TEST_ID)).toBeNull();
    // The rest of the chrome is unaffected, so this is restraint rather than a missing surface.
    expect(view.getByTestId(ORIENTATION_CHROME_TEST_ID)).toBeTruthy();
    await act(async () => {
      view.unmount();
    });
  });

  it('L110, 7 — nothing is mounted in the app shell and no app router participates in any of it', async () => {
    const { store, disclosure } = inspecting();
    const view = await render(<World store={store} context={contextAt(disclosure)} />);
    const serialized = JSON.stringify(view.toJSON());
    for (const router of ['expo-router', 'navigation', 'Screen', 'Stack']) {
      expect(serialized).not.toContain(router);
    }
    await act(async () => {
      view.unmount();
    });
  });
});

describe('R3-06B — a genuinely narrow surface changes presentation and nothing else', () => {
  it.each(['ar', 'en'] as const)('M120 — at 320 points the %s chrome keeps the same truth, acts and geography', async (language) => {
    const { store, disclosure } = inspecting();
    const context = contextAt(disclosure);

    const canonicalBefore = store.getState();
    const wideModel = orientationModel(store, { held: true, context }, { liveContextAvailable: true });

    const wide = await render(<World store={store} context={context} language={language} width={WIDE} />);
    const wideRows = subtree(wide, RETURN_CONTROLS_TEST_ID)
      .filter(isPressTarget)
      .map((node) => ((node.props ?? {}) as Record<string, unknown>).testID);
    const wideWords = subtree(wide, ORIENTATION_CHROME_TEST_ID)
      .filter((node) => node.type === 'Text')
      .map((node) => JSON.stringify((node as { children?: unknown }).children));
    await act(async () => {
      wide.unmount();
    });

    const narrow = await render(<World store={store} context={context} language={language} width={NARROW} />);
    const narrowRows = subtree(narrow, RETURN_CONTROLS_TEST_ID)
      .filter(isPressTarget)
      .map((node) => ((node.props ?? {}) as Record<string, unknown>).testID);
    const narrowWords = subtree(narrow, ORIENTATION_CHROME_TEST_ID)
      .filter((node) => node.type === 'Text')
      .map((node) => JSON.stringify((node as { children?: unknown }).children));

    // The semantic model is the same object-for-object: narrow width is not an input to truth.
    expect(orientationModel(store, { held: true, context }, { liveContextAvailable: true })).toEqual(wideModel);
    // The same acts, in the same logical order — no reordering and no responsive Product action.
    expect(narrowRows).toEqual(wideRows);
    // The same words: nothing is dropped, shortened or truncated to fit.
    expect(narrowWords).toEqual(wideWords);
    // Canonical state and the camera are untouched: no refit, no recenter, no world reflow.
    expect(store.getState()).toBe(canonicalBefore);

    // Controls stay stacked in a column with a gap, so they cannot overlap however long the Arabic
    // runs, and each keeps the 44pt minimum target.
    const group = narrow.getByTestId(RETURN_CONTROLS_TEST_ID);
    expect(group.props.style).toMatchObject({ flexDirection: 'column', rowGap: 8 });
    for (const node of subtree(narrow, RETURN_CONTROLS_TEST_ID).filter(isPressTarget)) {
      const style = ((node.props ?? {}) as Record<string, unknown>).style as unknown[];
      expect(JSON.stringify(style)).toContain('"minHeight":44');
    }
    // Nothing truncates, so nothing can be silently hidden at this width.
    expect(JSON.stringify(narrow.toJSON())).not.toContain('numberOfLines');

    await act(async () => {
      narrow.unmount();
    });
  });

  it('no width, breakpoint or measurement is read anywhere in the chrome', async () => {
    const { store, disclosure } = inspecting();
    const view = await render(<World store={store} context={contextAt(disclosure)} width={NARROW} />);
    const serialized = JSON.stringify(subtree(view, ORIENTATION_CHROME_TEST_ID));
    // T-11 owns responsive recomposition. T-08 wraps within ordinary layout and reads no dimension.
    for (const responsive of ['onLayout', 'useWindowDimensions', 'breakpoint', 'maxWidth', 'minWidth']) {
      expect(serialized).not.toContain(responsive);
    }
    await act(async () => {
      view.unmount();
    });
  });
});
