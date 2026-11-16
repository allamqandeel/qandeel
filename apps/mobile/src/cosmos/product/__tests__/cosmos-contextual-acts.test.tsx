/**
 * COSMOS-INT-01 Slice C — the compact contextual controls (Contract v1.3 §14 C-3 / C-4 / C-5, §15.3 B). The store and
 * the disclosures are the REAL ones through T-08's own fixtures, so what is proven is that every chip is one of T-08's
 * offered acts, reaches exactly ONE T-07 executor by effect, carries T-08's own label and hint, that Return Live and the
 * first-rung Return to World are not chips (they have other homes), that the context choice goes through T-04's
 * executor, and that a reader offered nothing sees nothing — never a disabled control.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';

import { initialCameraIntent, type MapProjectionRequest } from '../../../map';
import { cameraIntentEquals, sessionPosition, type CanonicalStore } from '../../../state';
import { bindExactReturnOrigin, chromeProjection, mapProjectionRequest, orientationModel, returnActWords, type ReturnOpportunityId } from '../../../orientation-chrome';
import { returnMapContext } from '../../../return-navigation';
import {
  TWO_CONTEXT_WORLD,
  beginInspectionJourney,
  chromeStore,
  chromeSurface,
  contextAt,
  fetched,
  historicalStore,
  inspect,
  known,
  projectionFor,
  withInspection,
} from '../../../orientation-chrome/__fixtures__/chrome';
import { COSMOS_ACTS_NOTE_TEST_ID, COSMOS_ACTS_TEST_ID, COSMOS_ACT_TEST_ID_PREFIX, COSMOS_CONTEXT_TEST_ID_PREFIX, CosmosContextualActs, chipActs } from '..';

/** A historical reader whose live focus IS disclosed here, so every act is reachable in one fixture (T-08's own reader). */
const reader = (): CanonicalStore =>
  chromeStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
  });
const liveProvider = (request: MapProjectionRequest) => returnMapContext(fetched(TWO_CONTEXT_WORLD({ tc: 6, liveHead: 6 })), request);

const chips = (view: RenderResult) => view.queryAllByTestId(new RegExp(`^${COSMOS_ACT_TEST_ID_PREFIX}(?!context:)`, 'u')).map((node) => (node.props.testID as string).slice(COSMOS_ACT_TEST_ID_PREFIX.length) as ReturnOpportunityId);
const press = async (view: RenderResult, testID: string) => { await fireEvent.press(view.getByTestId(testID)); };

let view: RenderResult | null = null;
afterEach(async () => { await cleanup(); view = null; });

const mountReader = (store: CanonicalStore, over: Partial<Parameters<typeof CosmosContextualActs>[0]> = {}) =>
  render(<CosmosContextualActs surface={chromeSurface(store)} language="en" projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD()))} liveContext={liveProvider} {...over} />);

describe('CosmosContextualActs — T-08 decides, T-07 acts', () => {
  it('offers exactly T-08’s acts in T-08’s order, minus Return Live (whose home is the rail), with T-08’s own label and hint', async () => {
    const store = reader();
    view = await mountReader(store);
    const model = orientationModel(store, projectionFor(store, fetched(TWO_CONTEXT_WORLD())), { exactReturnOrigin: null, preview: null, liveContextAvailable: true });
    const offered = model.returns.offered.map((each) => each.id);
    expect(offered).toContain('RETURN_LIVE_HEAD');
    expect(chips(view)).toEqual(offered.filter((id) => id !== 'RETURN_LIVE_HEAD'));
    expect(chips(view)).toEqual([...chipActs(model)]);
    for (const id of chips(view)) {
      const chip = view.getByTestId(`${COSMOS_ACT_TEST_ID_PREFIX}${id}`);
      const words = returnActWords('en', id);
      expect(chip.props.accessibilityLabel).toBe(words.label);
      expect(chip.props.accessibilityHint).toBe(words.hint);
      expect(chip.props.accessibilityRole).toBe('button');
      // The hint is spoken, not drawn (§15.6): only the label is on the screen.
      expect(view.queryByText(words.hint)).toBeNull();
      expect(view.getByText(words.label)).toBeTruthy();
    }
  });

  it('Return to World at a deeper rung is a chip that moves the camera to the canonical World and records one step; at the first rung it is not a chip (it is the stage’s Back)', async () => {
    const deep = reader();
    view = await mountReader(deep);
    expect(chips(view)).toContain('RETURN_WORLD');
    const before = deep.getState();
    await press(view, `${COSMOS_ACT_TEST_ID_PREFIX}RETURN_WORLD`);
    const after = deep.getState();
    expect(cameraIntentEquals(after.camera, initialCameraIntent())).toBe(true);
    expect(after.temporal).toBe(before.temporal);
    expect(after.history).toHaveLength(1);
    await act(async () => { view!.unmount(); });

    const atWorld = chromeStore({ liveHead: 6, temporal: { kind: 'PINNED', at: sessionPosition(4) }, depth: 'WORLD' });
    view = await render(<CosmosContextualActs surface={chromeSurface(atWorld)} language="en" projection={projectionFor(atWorld, fetched(TWO_CONTEXT_WORLD({ depth: 'WORLD' })))} />);
    expect(chips(view)).not.toContain('RETURN_WORLD');
    expect(chips(view)).not.toContain('RETURN_LIVE_HEAD');
  });

  it('Back reverses the latest step through T-07 and never means Live; the composite is one transaction moving time and camera', async () => {
    const store = reader();
    view = await mountReader(store);
    await press(view, `${COSMOS_ACT_TEST_ID_PREFIX}RETURN_WORLD`);
    expect(store.getState().history).toHaveLength(1);
    await press(view, `${COSMOS_ACT_TEST_ID_PREFIX}BACK_ONE_STEP`);
    expect(store.getState().history).toHaveLength(0);
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 4 });

    const before = store.getState();
    await press(view, `${COSMOS_ACT_TEST_ID_PREFIX}GO_LIVE_AND_LOCATE`);
    const after = store.getState();
    expect(after.temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(after.camera).not.toBe(before.camera);
    expect(after.history).toHaveLength(1);
  });

  it('every outcome is observed with its frozen identity, exactly as the old chrome reported it', async () => {
    const store = reader();
    const seen: string[] = [];
    view = await mountReader(store, { onReturnOutcome: (id, outcome) => seen.push(`${id}:${outcome.outcome}`) });
    await press(view, `${COSMOS_ACT_TEST_ID_PREFIX}RETURN_LIVE_FOCUS`);
    expect(seen).toEqual(['RETURN_LIVE_FOCUS:APPLIED']);
  });

  it('Exact Return restores the inspection journey’s origin, and a refused origin is retired rather than re-offered', async () => {
    const store = reader();
    const target = beginInspectionJourney(store);
    const origin = bindExactReturnOrigin(store, target);
    view = await mountReader(store, { exactReturnOrigin: origin });
    expect(chips(view)).toContain('EXACT_RETURN');
    await press(view, `${COSMOS_ACT_TEST_ID_PREFIX}RETURN_WORLD`);
    await press(view, `${COSMOS_ACT_TEST_ID_PREFIX}EXACT_RETURN`);
    expect(store.getState().history).toHaveLength(0);
    // Consumed: the origin is gone from the store's history, so T-08 no longer offers it.
    expect(chips(view)).not.toContain('EXACT_RETURN');
  });

  it('a reader offered nothing sees nothing: no region, no disabled control', async () => {
    // Already Live, already at World, no history, no journey.
    const store = chromeStore({ liveHead: 6, depth: 'WORLD' });
    view = await render(<CosmosContextualActs surface={chromeSurface(store)} language="en" projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD({ tc: 6, depth: 'WORLD' })))} />);
    expect(view.queryByTestId(COSMOS_ACTS_TEST_ID)).toBeNull();
    expect(JSON.stringify(view.toJSON() ?? null)).not.toContain('"disabled":true');
  });

  it('the context choice: T-08’s chooser as chips, chosen through T-04’s executor, the current one marked and never preselected', async () => {
    const store = historicalStore();
    inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-a' } });
    const projection = projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known())));
    const outcomes: string[] = [];
    view = await render(<CosmosContextualActs surface={chromeSurface(store)} language="ar" projection={projection} onMapOutcome={(outcome) => outcomes.push(outcome.outcome)} />);
    const model = orientationModel(store, projection, { exactReturnOrigin: null, preview: null, liveContextAvailable: false });
    expect(model.context.choiceAvailable).toBe(true);
    const options = view.queryAllByTestId(new RegExp(`^${COSMOS_CONTEXT_TEST_ID_PREFIX}`, 'u'));
    expect(options).toHaveLength(model.context.appearances.length);
    const current = model.context.appearances.find((option) => option.current)!;
    const other = model.context.appearances.find((option) => !option.current)!;
    expect(view.getByTestId(`${COSMOS_CONTEXT_TEST_ID_PREFIX}${current.ordinal}`).props.accessibilityState).toMatchObject({ selected: true });
    expect(view.getByTestId(`${COSMOS_CONTEXT_TEST_ID_PREFIX}${other.ordinal}`).props.accessibilityState).toMatchObject({ selected: false });
    const bindingBefore = store.getState().inspection;
    await press(view, `${COSMOS_CONTEXT_TEST_ID_PREFIX}${other.ordinal}`);
    expect(outcomes).toEqual(['APPLIED']);
    expect(store.getState().inspection).not.toBe(bindingBefore);
    expect(view.queryByTestId(COSMOS_ACTS_NOTE_TEST_ID)).toBeNull();
  });

  it('a technical inspection state keeps T-08’s one sentence as a quiet note under the chips', async () => {
    const store = historicalStore();
    inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'THREAD', id: 'thread-a' });
    // The projection the chrome holds has not been fetched for this viewpoint: "not ready to show yet".
    const request = mapProjectionRequest(store.getState());
    if (request === null) throw new Error('no viewpoint');
    view = await render(<CosmosContextualActs surface={chromeSurface(store)} language="en" projection={chromeProjection({ status: 'NOT_FETCHED' }, request)} />);
    const note = view.getByTestId(COSMOS_ACTS_NOTE_TEST_ID);
    expect(typeof note.props.children).toBe('string');
    expect((note.props.children as string).length).toBeGreaterThan(0);
  });
});
