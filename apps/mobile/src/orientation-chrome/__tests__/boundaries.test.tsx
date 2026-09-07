/**
 * T-08 — L: the Map stays the semantic world, and this chrome stays support around it.
 *
 * These are the anti-drift proofs. They are deliberately structural: a dashboard, a sidebar, a page
 * stack or a full-screen inspector would all show up as a specific shape in the rendered tree, and
 * each of those shapes is asserted absent rather than merely discouraged in prose.
 */
import { act, render } from '@testing-library/react-native';

import { sessionPosition, type CanonicalStore } from '../../state';
import { ORIENTATION_CHROME_TEST_ID, OrientationChrome } from '../OrientationChrome';
import { orientationModel } from '../model';
import { contextOrderingNote, returnActWords } from '../product-copy';
import { chromeStore, chromeSurface, fetched, flattenStyle, known, projectionFor, TWO_CONTEXT_WORLD, withInspection } from '../__fixtures__/chrome';

const reader = (): CanonicalStore =>
  chromeStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
  });

const renderChrome = (store: CanonicalStore, bottomInset?: number) =>
  render(
    <OrientationChrome language="en"
      surface={chromeSurface(store)}
      projection={projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known())))}
      {...(bottomInset === undefined ? {} : { bottomInset })}
    />,
  );

describe('OC08-L — the world is not replaced', () => {
  it('L103 — the chrome claims only its own touches; everything else reaches the world beneath', async () => {
    const store = reader();
    const view = await renderChrome(store);
    const root = view.getByTestId(ORIENTATION_CHROME_TEST_ID);
    expect(root.props.pointerEvents).toBe('box-none');

    const style = flattenStyle(root.props.style);
    // Not a cover, not a page and not a claim on the whole screen.
    expect(style.position).toBeUndefined();
    expect(style.flex).toBeUndefined();
    expect(style.height).toBeUndefined();
    expect(style.top).toBeUndefined();
    expect(style.backgroundColor).toBeUndefined();

    await act(async () => {
      view.unmount();
    });
  });

  it('L104, L105 — there is no modal, no page, no scroller, no tab bar and no object list', async () => {
    const store = reader();
    const view = await renderChrome(store);
    const serialized = JSON.stringify(view.toJSON());
    for (const shape of ['Modal', 'ScrollView', 'FlatList', 'SectionList', 'RCTScrollView', 'VirtualizedList', 'absoluteFill', 'Drawer', 'TabBar']) {
      expect(serialized).not.toContain(shape);
    }
    // Only the two collection-shaped roles the platform understands are absent as well: this chrome
    // publishes no list and therefore no set size over the world.
    expect(serialized).not.toContain('"accessibilityRole":"list"');
    expect(serialized).not.toContain('"accessibilityRole":"tablist"');

    await act(async () => {
      view.unmount();
    });
  });

  it('L108 — meaning is carried by words and by presence, never by a decorative glow', async () => {
    const store = reader();
    const view = await renderChrome(store);
    const serialized = JSON.stringify(view.toJSON());
    for (const decoration of ['shadowColor', 'shadowRadius', 'shadowOpacity', 'elevation', 'textShadow', 'glow']) {
      expect(serialized).not.toContain(decoration);
    }
    // Colour is never an indicator at all: the chrome paints none, so nothing can depend on one.
    expect(serialized).not.toContain('color');
    // Every offered control says what it does in words, so presence is never the only signal either.
    for (const opportunity of orientationModel(store, projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known())))).returns.offered) {
      expect(serialized).toContain(returnActWords('en', opportunity.id).label);
      expect(serialized).toContain(returnActWords('en', opportunity.id).hint);
    }

    await act(async () => {
      view.unmount();
    });
  });
});

describe('OC08-L — no new Product vocabulary and no new authority', () => {
  it('L106 — no generic Home, Reset, Navigate or Go Live identity exists in the model', () => {
    const store = reader();
    const model = orientationModel(store, projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known()))));
    const vocabulary = JSON.stringify(model.returns);
    for (const generic of ['"HOME"', '"RESET"', '"NAVIGATE"', '"GO_LIVE"', '"BACK_OR_HOME"', '"RETURN"', '"REPLAY"', '"BOOKMARK"']) {
      expect(vocabulary).not.toContain(generic);
    }
    // Context-sensitive, never the whole vocabulary as a permanent panel — and never fewer meanings
    // than the frozen six, which stay six whether or not each is offered.
    expect(model.returns.offered.length).toBeLessThan(6);
    expect(model.returns.offered.length).toBeGreaterThan(0);
    expect(new Set(model.returns.offered.map((candidate) => candidate.id)).size).toBe(model.returns.offered.length);
  });

  it('L107 — nothing in the answer carries importance, confidence, ranking or prominence', () => {
    const store = reader();
    const model = orientationModel(store, projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known()))));

    // The ordering note is excluded from the scan because it exists precisely to DENY a ranking;
    // it is asserted separately, so the denial cannot be quietly dropped either.
    expect(contextOrderingNote('en')).toContain('not a ranking');
    const serialized = JSON.stringify({ ...model, context: { ...model.context, ordering: '' } });
    for (const forbidden of ['importance', 'confidence', 'rank', 'score', 'weight', 'priority', 'primary', 'prominence', 'recommended']) {
      expect(serialized.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('L109 — the answer carries no coordinate, anchor, scale or placement of any kind', () => {
    const store = reader();
    const serialized = JSON.stringify(orientationModel(store, projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known())))));
    // `"scheme"` stands in for the coordinate scheme id itself: every opaque world reference carries
    // one, so its absence covers the whole encoding without this file naming the scheme — which the
    // Map layer alone is entitled to mention.
    for (const geography of ['WORLD_ANCHOR', '"scheme"', 'SCALE_INTENT', 'anchor', 'destination', 'hostAddress', 'worldUnitsPerPoint', 'x"', 'y"']) {
      expect(serialized).not.toContain(geography);
    }
  });
});

describe('OC08-L — responsive recomposition belongs to a later task', () => {
  it('L120 — the chrome has no width input, so no Product answer can depend on one', async () => {
    const store = reader();
    const projection = projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known())));
    const model = orientationModel(store, projection);

    // The only layout-shaped prop is the safe-area seam, and it can move nothing but padding.
    const narrow = await renderChrome(store, 0);
    const narrowTree = JSON.stringify(narrow.toJSON(), (_key, value) => (typeof value === 'function' ? '[handler]' : value));
    await act(async () => {
      narrow.unmount();
    });

    const inset = await renderChrome(store, 34);
    const insetTree = JSON.stringify(inset.toJSON(), (_key, value) => (typeof value === 'function' ? '[handler]' : value));
    await act(async () => {
      inset.unmount();
    });

    expect(narrowTree).not.toEqual(insetTree);
    expect(narrowTree.replace('"paddingBottom":12', '"paddingBottom":46')).toEqual(insetTree);
    // The Product answer itself is untouched by it.
    expect(orientationModel(store, projection)).toEqual(model);
  });
});
