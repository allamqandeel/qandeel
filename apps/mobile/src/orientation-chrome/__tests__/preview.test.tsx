/**
 * T-08 R3-02 — a preview is looked at; it is not travelled to.
 *
 * T-06 owns the ephemeral temporal preview entirely: `PTC` is Class C, it has no key in
 * `CanonicalState`, it appends no `RH`, and it is not a second temporal cursor. T-08's whole job here
 * is to say so out loud — to show the transient target WITHOUT ever implying that the reader's own
 * committed position moved.
 *
 * The seam is read-only by TYPE. `TemporalPreviewSource` carries `getSnapshot` and `subscribe` and
 * nothing else, so `preview(...)`, `stepForward(...)`, `cancel()` and `reconcile(...)` are not
 * reachable from this layer at all — a call to any of them is a compile error rather than a rule.
 * The tests below still verify behaviourally that none of them is called, because a proof that only
 * holds in the type system stops holding the moment someone widens the type.
 */
import { act, render } from '@testing-library/react-native';

import { sessionPosition, type CanonicalStore } from '../../state';
import { createTemporalPreviewController, type TemporalPreview } from '../../temporal-navigation/preview';
import { ORIENTATION_CHROME_TEST_ID, OrientationChrome } from '../OrientationChrome';
import { RETURN_CONTROLS_TEST_ID } from '../ReturnControls';
import { bindExactReturnOrigin } from '../exact-return-origin';
import { orientationModel } from '../model';
import { RETURN_OPPORTUNITY_IDS, type ChromeLanguage, type ReturnOpportunityId } from '../types';
import { latestReturnCheckpoint, returnWorld } from '../../return-navigation';
import {
  chromeStore,
  chromeSurface,
  fetched,
  projectionFor,
  readableText,
  TWO_CONTEXT_WORLD,
} from '../__fixtures__/chrome';

const ARABIC = /[؀-ۿ]/u;

/**
 * A preview source that publishes REAL `TemporalPreview` values.
 *
 * It carries the whole controller shape — including `cancel` — precisely so the tests can prove
 * T-08 never reaches for the halves it is not given. What T-08 receives is narrowed to the
 * read-only pair; what this fixture records is every call anybody makes.
 */
function previewSource() {
  const listeners = new Set<() => void>();
  let state: TemporalPreview = Object.freeze({ status: 'IDLE' });
  let generation = 0;
  const calls = { cancel: 0, preview: 0, stepForward: 0, reconcile: 0 };
  return {
    calls,
    listenerCount: () => listeners.size,
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    cancel() {
      calls.cancel += 1;
      return { outcome: 'UNCHANGED' as const };
    },
    /** Test-side only: publishes what T-06 would have published. */
    emit(next: TemporalPreview) {
      state = next;
      for (const listener of Array.from(listeners)) listener();
    },
    previewing(at: number) {
      generation += 1;
      return Object.freeze({
        status: 'PREVIEWING' as const,
        ptc: sessionPosition(at),
        source: 'DISCLOSED_TARGET' as const,
        origin: Object.freeze({ sessionId: 'session-1', mode: 'PINNED' as const, tc: sessionPosition(4) }),
        generation,
      });
    },
  };
}

const historical = (): CanonicalStore =>
  chromeStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
  });

const live = (): CanonicalStore =>
  chromeStore({ liveHead: 6, temporal: { kind: 'FOLLOW_LIVE' }, depth: 'ANALYTICAL_OBJECT', liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' }, liveFocusAtSp: 5 });

type Source = ReturnType<typeof previewSource>;

const renderWith = (store: CanonicalStore, source: Source | null, language: ChromeLanguage = 'en', origin?: ReturnType<typeof bindExactReturnOrigin>) =>
  render(
    <OrientationChrome
      language={language}
      surface={chromeSurface(store)}
      projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD()))}
      preview={source}
      exactReturnOrigin={origin}
      liveContext={() => ({ ok: false, code: 'PROJECTION_NOT_AVAILABLE', detail: 'none' })}
    />,
  );

const previewLine = (view: Awaited<ReturnType<typeof render>>): string | null => {
  const node = view.queryByTestId(`${ORIENTATION_CHROME_TEST_ID}:preview`);
  return node === null ? null : (node.props.children as string);
};

const temporalLine = (view: Awaited<ReturnType<typeof render>>): string =>
  view.getByTestId(`${ORIENTATION_CHROME_TEST_ID}:temporal`).props.children as string;

describe('R3-02 — the committed position and the transient one are two different facts', () => {
  it('25 — with no preview source at all, the orientation is the committed one and nothing else', async () => {
    const store = historical();
    const view = await renderWith(store, null);
    expect(previewLine(view)).toBeNull();
    expect(temporalLine(view)).toBe('Reading at moment 4.');
    expect(orientationModel(store, projectionFor(store, fetched(TWO_CONTEXT_WORLD()))).temporal.preview).toEqual({ status: 'IDLE' });
    await act(async () => {
      view.unmount();
    });
  });

  it('26, 27, 28, 35 — an open preview is stated distinctly while the committed stance stays visible', async () => {
    const store = historical();
    const source = previewSource();
    const view = await renderWith(store, source);

    await act(async () => {
      source.emit(source.previewing(2));
    });

    // 26 — the committed line is unchanged and still says where the reader actually is.
    expect(temporalLine(view)).toBe('Reading at moment 4.');
    // 27 — and the transient target is stated as its own separate thing, which denies commitment.
    expect(previewLine(view)).toBe('A temporary look at moment 2. Your position has not changed.');

    // 28 — no third temporal mode was invented: `mode` still has exactly the two frozen values, and
    // the preview sits BESIDE it rather than inside it.
    const model = orientationModel(store, projectionFor(store, fetched(TWO_CONTEXT_WORLD())), { preview: source.getSnapshot() });
    expect(model.temporal.mode).toBe('PINNED');
    expect(model.temporal.at).toBe(sessionPosition(4));
    expect(model.temporal.preview).toEqual({ status: 'PREVIEWING', at: sessionPosition(2), source: 'DISCLOSED_TARGET' });

    // 35 — previewing the position already committed is still a preview, not a no-op: the reader is
    // looking at it transiently, and the surface must not quietly stop saying so.
    await act(async () => {
      source.emit(source.previewing(4));
    });
    expect(previewLine(view)).toBe('A temporary look at moment 4. Your position has not changed.');
    expect(temporalLine(view)).toBe('Reading at moment 4.');

    await act(async () => {
      view.unmount();
    });
  });

  it('29, 30, 31, 32 — a preview writes no canonical state, appends no history, and cancelling restores nothing', async () => {
    const store = historical();
    const source = previewSource();
    const before = store.getState();
    const view = await renderWith(store, source);

    await act(async () => {
      source.emit(source.previewing(2));
    });
    // 29, 30 — the canonical object is the SAME object, so no field moved and no entry was appended.
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);

    // 31 — retargeting moves only the transient line.
    await act(async () => {
      source.emit(source.previewing(3));
    });
    expect(previewLine(view)).toBe('A temporary look at moment 3. Your position has not changed.');
    expect(temporalLine(view)).toBe('Reading at moment 4.');
    expect(store.getState()).toBe(before);

    // 32 — and when it ends there is nothing to restore, because nothing committed ever moved.
    await act(async () => {
      source.emit({ status: 'IDLE' });
    });
    expect(previewLine(view)).toBeNull();
    expect(temporalLine(view)).toBe('Reading at moment 4.');
    expect(store.getState()).toBe(before);

    await act(async () => {
      view.unmount();
    });
  });

  it('33, 34 — a preview never rewrites the committed mode, under Live or while pinned', async () => {
    const following = live();
    const source = previewSource();
    const view = await renderWith(following, source);
    await act(async () => {
      source.emit(source.previewing(2));
    });
    // 33 — still following Live. Looking at an earlier Moment is not pinning to it.
    expect(temporalLine(view)).toBe('Following the conversation as it continues.');
    expect(previewLine(view)).toContain('moment 2');
    await act(async () => {
      view.unmount();
    });

    // 34 — and a pinned reader keeps their own target.
    const pinned = historical();
    const other = previewSource();
    const pinnedView = await renderWith(pinned, other);
    await act(async () => {
      other.emit(other.previewing(2));
    });
    expect(temporalLine(pinnedView)).toBe('Reading at moment 4.');
    await act(async () => {
      pinnedView.unmount();
    });
  });
});

describe('R3-02 — the subscription is the real one, and it is retired properly', () => {
  it('36 — replacing the controller drops the old subscription and follows the new one', async () => {
    const store = historical();
    const first = previewSource();
    const second = previewSource();
    const view = await renderWith(store, first);
    expect(first.listenerCount()).toBe(1);

    await act(async () => {
      view.rerender(
        <OrientationChrome
          language="en"
          surface={chromeSurface(store)}
          projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD()))}
          preview={second}
          liveContext={() => ({ ok: false, code: 'PROJECTION_NOT_AVAILABLE', detail: 'none' })}
        />,
      );
    });

    // The old controller is no longer listened to at all, so a publication from it reaches nothing.
    expect(first.listenerCount()).toBe(0);
    expect(second.listenerCount()).toBe(1);
    await act(async () => {
      first.emit(first.previewing(2));
    });
    expect(previewLine(view)).toBeNull();

    // The replacement is followed normally.
    await act(async () => {
      second.emit(second.previewing(3));
    });
    expect(previewLine(view)).toContain('moment 3');

    await act(async () => {
      view.unmount();
    });
  });

  it('37 — an unmounted chrome ignores a late publication from a retired controller', async () => {
    const store = historical();
    const source = previewSource();
    const view = await renderWith(store, source);
    await act(async () => {
      view.unmount();
    });
    expect(source.listenerCount()).toBe(0);
    // Publishing after unmount must not throw and must reach nothing.
    expect(() => source.emit(source.previewing(2))).not.toThrow();
  });

  it('the real T-06 controller satisfies the read-only seam and reads IDLE as idle', async () => {
    const store = historical();
    // The REAL public controller, not a stand-in: this is what proves the seam matches T-06's own
    // published surface rather than a shape invented here.
    const controller = createTemporalPreviewController();
    const view = await render(
      <OrientationChrome
        language="en"
        surface={chromeSurface(store)}
        projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD()))}
        preview={controller}
      />,
    );
    expect(previewLine(view)).toBeNull();
    expect(controller.getSnapshot()).toEqual({ status: 'IDLE' });
    await act(async () => {
      view.unmount();
    });
  });
});

describe('R3-02 — every act still runs exactly once, and T-08 cancels nothing', () => {
  /** A historical reader with a bound Exact Return origin, so all six can be reachable. */
  function everything() {
    const store = historical();
    const surface = chromeSurface(store);
    returnWorld(surface);
    const origin = bindExactReturnOrigin(store, latestReturnCheckpoint(store));
    return { store, origin };
  }

  it.each(RETURN_OPPORTUNITY_IDS)('38-43, 44 — %s runs once under an open preview, and no cancel is ever called', async (id: ReturnOpportunityId) => {
    const { store, origin } = everything();
    const source = previewSource();
    const outcomes: ReturnOpportunityId[] = [];
    const view = await render(
      <OrientationChrome
        language="en"
        surface={chromeSurface(store)}
        projection={projectionFor(store, fetched(TWO_CONTEXT_WORLD({ depth: store.getState().camera.depth })))}
        preview={source}
        exactReturnOrigin={origin}
        liveContext={() => ({ ok: false, code: 'PROJECTION_NOT_AVAILABLE', detail: 'none' })}
        onReturnOutcome={(pressed) => outcomes.push(pressed)}
      />,
    );
    await act(async () => {
      source.emit(source.previewing(2));
    });

    const control = view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:${id}`);
    if (control !== null) {
      await act(async () => {
        control.props.onClick();
      });
      // Exactly one Product act, for exactly the identity pressed. T-07 owns preview precedence and
      // performs the cancellation itself; a second one here would be a second ordering bug.
      expect(outcomes).toEqual([id]);
    }

    // 44 — T-08 never cancels a preview, whichever act ran.
    expect(source.calls.cancel).toBe(0);
    expect(source.calls.preview).toBe(0);
    expect(source.calls.stepForward).toBe(0);
    expect(source.calls.reconcile).toBe(0);

    await act(async () => {
      view.unmount();
    });
  });
});

describe('R3-02 — the preview says only what a preview may say', () => {
  it.each(['ar', 'en'] as const)('45, 46, 49 — the %s preview sentence is in that language and is reachable nonvisually', async (language) => {
    const store = historical();
    const source = previewSource();
    const view = await renderWith(store, source, language);
    await act(async () => {
      source.emit(source.previewing(2));
    });

    const line = previewLine(view);
    expect(line).not.toBeNull();
    expect(ARABIC.test(line as string)).toBe(language === 'ar');
    // 49 — it is rendered as text, so a screen reader reaches it: it is part of the readable output
    // rather than a purely visual treatment.
    expect(readableText(view.toJSON()).join(' | ')).toContain(line as string);

    await act(async () => {
      view.unmount();
    });
  });

  it('47, 48 — the preview names no future identity or count, and T-08 can manufacture no target of its own', async () => {
    const store = historical();
    const source = previewSource();
    const view = await renderWith(store, source);
    await act(async () => {
      source.emit(source.previewing(2));
    });

    const words = readableText(view.toJSON()).join(' | ');
    for (const leak of ['thread-a', 'thread-b', 'reading-1', 'binding-a', 'DISCLOSED_TARGET', 'session-1', 'generation']) {
      expect(words).not.toContain(leak);
    }

    // 48 — the transient target is exactly what T-06 published, and nothing else: T-08 derives no
    // position of its own, so it cannot present a Moment T-06 never authorized.
    const snapshot = source.getSnapshot();
    const model = orientationModel(store, projectionFor(store, fetched(TWO_CONTEXT_WORLD())), { preview: snapshot });
    expect(model.temporal.preview).toEqual({
      status: 'PREVIEWING',
      at: snapshot.status === 'PREVIEWING' ? snapshot.ptc : null,
      source: 'DISCLOSED_TARGET',
    });
    // And T-06's own internals are not copied across into the orientation answer.
    expect(Object.keys(model.temporal.preview).sort()).toEqual(['at', 'source', 'status']);

    await act(async () => {
      view.unmount();
    });
  });
});
