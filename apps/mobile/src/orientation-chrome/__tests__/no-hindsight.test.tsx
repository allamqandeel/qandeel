/**
 * T-08 — C: the historical Live firewall.
 *
 * The central proof of this task. A reader standing at a historical position may learn that the
 * conversation has continued and that an explicit route back to it exists. They may learn nothing
 * about WHERE it continued: no identity, no name, no family, no category, no Home, no direction, no
 * distance, no side of the screen, no marker and no count.
 *
 * The proof is differential and total. Two canonical states are built that differ ONLY in the Live
 * Focus, where that focus names an object the reader's own `K(TC)` does not disclose, and the ENTIRE
 * rendered native tree is compared — every element, every style, every accessibility label, hint,
 * state and action. Anything that differed would be a channel through which future truth escapes,
 * including a disabled state, an offered action or the mere existence of a control.
 */
import { act, render } from '@testing-library/react-native';

import { sessionPosition, type CanonicalStore, type LiveFocus } from '../../state';
import { OrientationChrome, ORIENTATION_CHROME_TEST_ID } from '../OrientationChrome';
import { orientationModel } from '../model';
import { returnMeaning } from '../return-orientation';
import { RETURN_OPPORTUNITY_IDS } from '../types';
import { chromeStore, chromeSurface, fetched, isOffered, projectionFor, TWO_CONTEXT_WORLD, world } from '../__fixtures__/chrome';

/** A historical reader at SP(4); Live has reached SP(6) and its focus is whatever the case supplies. */
const readerWith = (liveFocus: LiveFocus): CanonicalStore =>
  chromeStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus,
    ...(liveFocus.kind === 'NONE' ? {} : { liveFocusAtSp: 5 }),
  });

/**
 * The disclosed world at SP(4). It deliberately does NOT contain `thread-future`: that Thread was
 * established after this position, so `K(TC)` cannot disclose it and the reader may not learn it
 * exists.
 */
const WORLD_AT_TC = () => TWO_CONTEXT_WORLD();

const NONE: LiveFocus = { kind: 'NONE' };
const FUTURE_THREAD: LiveFocus = { kind: 'ESTABLISHED_THREAD', threadId: 'thread-future' };
const FUTURE_FOCUS: LiveFocus = { kind: 'EMERGING_FOCUS', emergingFocusId: 'focus-future' };

/**
 * The whole rendered native tree as text, with function identities normalized away. Everything else
 * — element types, styles, testIDs and every accessibility property — is compared exactly.
 */
type View = Awaited<ReturnType<typeof render>>;

const nativeTree = (tree: View): string =>
  JSON.stringify(tree.toJSON(), (_key, value) => (typeof value === 'function' ? '[handler]' : value));

/** Only what reaches a reader or a screen reader as words: labels, hints, actions and text. */
function spoken(node: unknown, out: string[]): void {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) spoken(child, out);
    return;
  }
  const element = node as { props?: Record<string, unknown>; children?: unknown };
  const props = element.props ?? {};
  for (const key of ['accessibilityLabel', 'accessibilityHint']) {
    if (typeof props[key] === 'string') out.push(props[key] as string);
  }
  const actions = props.accessibilityActions;
  if (Array.isArray(actions)) {
    for (const action of actions as readonly { name?: unknown; label?: unknown }[]) {
      if (typeof action.name === 'string') out.push(action.name);
      if (typeof action.label === 'string') out.push(action.label);
    }
  }
  spoken(element.children, out);
}

const spokenText = (tree: View): string => {
  const out: string[] = [];
  spoken(tree.toJSON(), out);
  return out.join(' | ').toLowerCase();
};

describe('OC08-C — two positions that differ only in a future Live Focus are indistinguishable', () => {
  it.each([
    ['a future Established Thread', FUTURE_THREAD],
    ['a future Emerging Focus', FUTURE_FOCUS],
  ])('C21…C27 — %s produces exactly the model and the native tree that NONE does', async (_name, focus) => {
    const withNone = readerWith(NONE);
    const withFuture = readerWith(focus);
    const disclosure = WORLD_AT_TC();

    const modelNone = orientationModel(withNone, projectionFor(withNone, fetched(disclosure)));
    const modelFuture = orientationModel(withFuture, projectionFor(withFuture, fetched(disclosure)));

    // The whole model, not a chosen field of it: there is nowhere for a difference to hide.
    expect(modelFuture).toEqual(modelNone);
    expect(modelNone.live.focusReturn).toBe('UNAVAILABLE');
    expect(modelFuture.live.focusReturn).toBe('UNAVAILABLE');

    // Rendered one at a time: two concurrent renders would overlap React's act scopes, and a proof
    // about identical output must not depend on how the proof itself was scheduled.
    const rendered: string[] = [];
    for (const store of [withNone, withFuture]) {
      const view = await render(<OrientationChrome surface={chromeSurface(store)} projection={projectionFor(store, fetched(disclosure))} />);
      const native = nativeTree(view);
      // A comparison of two empty trees would pass while proving nothing, so each render is proven
      // to have produced the surface before it is compared.
      expect(native).toContain(ORIENTATION_CHROME_TEST_ID);
      rendered.push(native);
      await act(async () => {
        view.unmount();
      });
    }
    expect(rendered[1]).toEqual(rendered[0]);
  });

  it('C22…C26 — nothing spoken names the future target, its family, a direction, a distance or a count', async () => {
    const store = readerWith(FUTURE_THREAD);
    const tree = await render(<OrientationChrome surface={chromeSurface(store)} projection={projectionFor(store, fetched(WORLD_AT_TC()))} />);
    const words = spokenText(tree);

    expect(words).not.toContain('thread-future');
    expect(words).not.toContain('focus-future');
    for (const forbidden of ['left', 'right', 'above', 'below', 'toward', 'away', 'nearby', 'offscreen', 'off-screen', 'direction', 'distance', 'arrow']) {
      expect(words).not.toContain(forbidden);
    }
    // No set size, child count or position-in-a-total is ever published. React Native gives every
    // `Pressable` an EMPTY `accessibilityValue` of its own; what must never happen is that anything
    // here populates one, so every occurrence is asserted to be empty rather than absent.
    const values = nativeTree(tree).match(/"accessibilityValue":\{[^}]*\}/gu) ?? [];
    expect(values.length).toBeGreaterThan(0);
    expect(values.filter((value) => value !== '"accessibilityValue":{}')).toEqual([]);
  });

  it('C28 — the generic route back to Live remains available while historical, and says only that', async () => {
    const store = readerWith(FUTURE_THREAD);
    const projection = projectionFor(store, fetched(WORLD_AT_TC()));
    const model = orientationModel(store, projection);
    expect(model.live.advancedWhileHistorical).toBe(true);
    expect(model.live.routeBackToLiveAvailable).toBe(true);

    const tree = await render(<OrientationChrome surface={chromeSurface(store)} projection={projection} />);
    expect(nativeTree(tree)).toContain(`"${ORIENTATION_CHROME_TEST_ID}:live"`);
    expect(spokenText(tree)).toContain('the conversation has continued since this moment.');
  });

  it('C29 — the specific Live Focus capability comes only from the projection-bound answer', () => {
    // A live Thread that IS disclosed at this position and has a legitimate Home there.
    const store = readerWith({ kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' });
    const proven = orientationModel(store, projectionFor(store, fetched(WORLD_AT_TC())));
    expect(proven.live.focusReturn).toBe('AVAILABLE');

    // The SAME live truth with no projection held: the question is not answered more quietly, it is
    // not asked at all, and no capability appears.
    const unproven = orientationModel(store, { held: false, derivation: { status: 'PROJECTION_NOT_FETCHED' } });
    expect(unproven.live.focusReturn).toBe('UNPROVEN');
    expect(isOffered(unproven, 'RETURN_LIVE_FOCUS')).toBe(false);
  });

  it('C30 — a legitimately locatable Live Focus offers the act and attaches no metadata to it', async () => {
    const store = readerWith({ kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' });
    const projection = projectionFor(store, fetched(WORLD_AT_TC()));
    const offered = orientationModel(store, projection).returns.offered.find((candidate) => candidate.id === 'RETURN_LIVE_FOCUS');
    expect(offered).toBeDefined();

    // The meaning is a constant: being offered added an entry to a list and changed nothing about
    // what the act claims, so the offered shape is exactly the frozen one.
    expect(offered).toEqual(returnMeaning('RETURN_LIVE_FOCUS'));
    // And where it is not offered, it is simply absent — never a differently-worded variant.
    const none = readerWith(NONE);
    expect(isOffered(orientationModel(none, projectionFor(none, fetched(WORLD_AT_TC()))), 'RETURN_LIVE_FOCUS')).toBe(false);
    expect(spokenText(await render(<OrientationChrome surface={chromeSurface(store)} projection={projection} />))).not.toContain('thread-a');
  });

  it('C21b — an ungeographic live focus is UNAVAILABLE, and stays indistinguishable from NONE', () => {
    // An Emerging Focus disclosed at this position is pregeographic by frozen truth: it is entitled
    // and has no place. That is a different fact from being undisclosed, and neither may leak.
    const disclosure = world({
      depth: 'ANALYTICAL_OBJECT',
      tc: 4,
      liveHead: 6,
      threads: [{ id: 'thread-a', x: '1000000', y: '0' }],
      focuses: [{ id: 'focus-here', startedSp: 2 }],
    });
    const ungeographic = readerWith({ kind: 'EMERGING_FOCUS', emergingFocusId: 'focus-here' });
    const none = readerWith(NONE);
    const model = orientationModel(ungeographic, projectionFor(ungeographic, fetched(disclosure)));
    expect(model.live.focusReturn).toBe('UNAVAILABLE');
    expect(model).toEqual(orientationModel(none, projectionFor(none, fetched(disclosure))));
  });

  it('C-shape — every return meaning is a constant, and the OFFERED SET never moves with future truth', () => {
    const offeredFor = (focus: LiveFocus) => {
      const store = readerWith(focus);
      return orientationModel(store, projectionFor(store, fetched(WORLD_AT_TC()))).returns.offered;
    };

    // The whole vocabulary keeps its meanings whatever live truth is, offered or not.
    for (const id of RETURN_OPPORTUNITY_IDS) {
      const meaning = returnMeaning(id);
      expect(meaning.id).toBe(id);
      for (const focus of [NONE, FUTURE_THREAD, { kind: 'ESTABLISHED_THREAD' as const, threadId: 'thread-a' }]) {
        const offered = offeredFor(focus).find((candidate) => candidate.id === id);
        // Offered or absent — never a differently-worded variant of itself.
        if (offered !== undefined) expect(offered).toEqual(meaning);
      }
    }

    // The no-hindsight statement: a Live Focus this position cannot disclose changes the offered set
    // in no way at all, while one it CAN disclose legitimately adds the spatial act.
    expect(offeredFor(FUTURE_THREAD)).toEqual(offeredFor(NONE));
    expect(offeredFor(FUTURE_FOCUS)).toEqual(offeredFor(NONE));
    expect(offeredFor({ kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' }).map((candidate) => candidate.id)).toContain('RETURN_LIVE_FOCUS');
    expect(offeredFor(NONE).map((candidate) => candidate.id)).not.toContain('RETURN_LIVE_FOCUS');
  });
});
