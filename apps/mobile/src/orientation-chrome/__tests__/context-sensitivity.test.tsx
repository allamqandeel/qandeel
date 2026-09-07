/**
 * T-08 — R1-01: the rendered return set is context-sensitive, and the six meanings stay six.
 *
 * The original chrome rendered all six controls permanently, disabling the ones that were not
 * meaningful. That is a toolbar: it presents the entire vocabulary of the system as though every
 * part of it were a live choice, which is exactly the dashboard drift the Product contract forbids.
 *
 * What must NOT follow from fixing it is semantic collapse. The six identities keep their own
 * effects, promises and wording whether or not they are offered, none is merged into a generic act,
 * and the frozen vocabulary is unchanged. Only the OFFER is context-sensitive — and every input to
 * it is knowledge-safe, so the offered set leaks nothing either.
 */
import { act, render } from '@testing-library/react-native';

import { sessionPosition, type CanonicalStore } from '../../state';
import { returnWorld } from '../../return-navigation';
import { OrientationChrome } from '../OrientationChrome';
import { RETURN_CONTROLS_TEST_ID } from '../ReturnControls';
import { returnMeaning } from '../return-orientation';
import { returnActWords } from '../product-copy';
import { orientationModel } from '../model';
import { RETURN_OPPORTUNITY_IDS } from '../types';
import { chromeStore, chromeSurface, fetched, offeredIds, projectionFor, TWO_CONTEXT_WORLD } from '../__fixtures__/chrome';

const historicalWithFocus = (): CanonicalStore =>
  chromeStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
  });

/** Following Live, at the World viewpoint, with nothing recorded: nothing is meaningful. */
const settledAtWorld = (): CanonicalStore => chromeStore({ liveHead: 6, temporal: { kind: 'FOLLOW_LIVE' }, depth: 'WORLD' });

describe('R1-01 — the offered set follows the reader\'s own situation', () => {
  it('a settled reader with nothing to undo is offered nothing at all', async () => {
    const store = settledAtWorld();
    const projection = projectionFor(store, fetched(TWO_CONTEXT_WORLD({ depth: 'WORLD' })));
    expect(offeredIds(orientationModel(store, projection))).toEqual([]);

    // An empty group is not a surface: the whole control region is absent rather than empty.
    const view = await render(<OrientationChrome language="en" surface={chromeSurface(store)} projection={projection} />);
    expect(view.queryByTestId(RETURN_CONTROLS_TEST_ID)).toBeNull();

    await act(async () => {
      view.unmount();
    });
  });

  it('a historical reader whose live focus is disclosed here is offered exactly the four that apply', () => {
    const store = historicalWithFocus();
    expect(offeredIds(orientationModel(store, projectionFor(store, fetched(TWO_CONTEXT_WORLD())), { liveContextAvailable: true }))).toEqual([
      'RETURN_LIVE_HEAD',
      'RETURN_LIVE_FOCUS',
      'RETURN_WORLD',
      'GO_LIVE_AND_LOCATE',
    ]);
  });

  it('Back appears only once there is something to reverse, and disappears again when there is not', () => {
    const store = historicalWithFocus();
    const surface = chromeSurface(store);
    const projection = () => projectionFor(store, fetched(TWO_CONTEXT_WORLD({ depth: store.getState().camera.depth })));
    expect(offeredIds(orientationModel(store, projection()))).not.toContain('BACK_ONE_STEP');

    returnWorld(surface);
    expect(offeredIds(orientationModel(store, projection()))).toContain('BACK_ONE_STEP');
  });

  it('the composite is offered only where it is materially distinct from its own halves', () => {
    // Historical: "go back to Live AND move there" is genuinely a third thing.
    const historical = historicalWithFocus();
    expect(offeredIds(orientationModel(historical, projectionFor(historical, fetched(TWO_CONTEXT_WORLD())), { liveContextAvailable: true }))).toContain('GO_LIVE_AND_LOCATE');

    // Already following Live: its temporal half does nothing, so it would collapse into "move to
    // where attention is now" and become a second button for one act.
    const live = chromeStore({
      liveHead: 6,
      temporal: { kind: 'FOLLOW_LIVE' },
      depth: 'ANALYTICAL_OBJECT',
      liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
      liveFocusAtSp: 5,
    });
    const offered = offeredIds(orientationModel(live, projectionFor(live, fetched(TWO_CONTEXT_WORLD({ tc: 6, liveHead: 6 })))));
    expect(offered).not.toContain('GO_LIVE_AND_LOCATE');
    expect(offered).not.toContain('RETURN_LIVE_HEAD');
    expect(offered).toContain('RETURN_LIVE_FOCUS');
  });

  it('the offered order is always the frozen logical order, never the order things became true', () => {
    const store = historicalWithFocus();
    returnWorld(chromeSurface(store));
    const offered = offeredIds(orientationModel(store, projectionFor(store, fetched(TWO_CONTEXT_WORLD({ depth: 'WORLD' })))));
    const frozen = RETURN_OPPORTUNITY_IDS.filter((id) => offered.includes(id));
    expect(offered).toEqual(frozen);
  });
});

describe('R1-02 — six meanings remain six, offered or not', () => {
  it('every frozen identity keeps its own effect, promises and wording', () => {
    const meanings = RETURN_OPPORTUNITY_IDS.map((id) => returnMeaning(id));
    expect(meanings.map((meaning) => meaning.id)).toEqual([...RETURN_OPPORTUNITY_IDS]);
    expect(new Set(meanings.map((meaning) => returnActWords('en', meaning.id).label)).size).toBe(6);
    expect(new Set(meanings.map((meaning) => returnActWords('en', meaning.id).hint)).size).toBe(6);

    // The two opposites stay opposite: Live Head promises time and not a place; Live Focus promises
    // a place and not time.
    expect(returnMeaning('RETURN_LIVE_HEAD').effects).toEqual({ temporal: 'DIRECT', spatial: 'PRESERVED', inspection: 'PRESERVED' });
    expect(returnMeaning('RETURN_LIVE_FOCUS').effects).toEqual({ temporal: 'PRESERVED', spatial: 'ONE_SHOT_BOUNDED', inspection: 'PRESERVED' });
    expect(returnMeaning('GO_LIVE_AND_LOCATE').effect).toBe('TEMPORAL_AND_SPATIAL');
    expect(returnMeaning('RETURN_WORLD').effect).toBe('SPATIAL');
    expect(returnMeaning('BACK_ONE_STEP').effect).toBe('HISTORY');
  });

  it('a meaning is a constant: being offered or not never changes what an act claims', () => {
    const historical = historicalWithFocus();
    const offeredHere = orientationModel(historical, projectionFor(historical, fetched(TWO_CONTEXT_WORLD()))).returns.offered;
    for (const opportunity of offeredHere) {
      expect(opportunity).toEqual(returnMeaning(opportunity.id));
    }
  });

  it('no generic identity exists to stand in for any of them', () => {
    for (const id of RETURN_OPPORTUNITY_IDS) {
      expect(/^(home|reset|navigate|go ?live|back or home|return)$/iu.test(returnActWords('en', id).label.trim())).toBe(false);
    }
    expect(RETURN_OPPORTUNITY_IDS).toHaveLength(6);
  });
});
