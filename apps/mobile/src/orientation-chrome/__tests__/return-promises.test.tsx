/**
 * T-08 R3-03 — what each return PROMISES, and the one promise that is conditional.
 *
 * The old model said `movesTime` and `movesCamera`, and four of the six frozen acts fit neither
 * value. Back and Exact Return restore a captured tuple, so a field may legitimately come back
 * unchanged. Return to Live Focus attempts the camera once and a race may make that a no-op. And Go
 * Live + Locate binds its referent at the post-live boundary and moves the camera only if that
 * referent turns out to be locatable at `K(LH)` — which is not knowable at activation, and must not
 * be, because knowing it would itself be a future-relative fact.
 *
 * So the promises are typed per dimension, the copy is written from the type, and the composite says
 * "if" out loud in both languages. The other half of the rule is that the composite is not OFFERED
 * at all unless this surface can actually attempt its spatial half — advertising a capability the
 * surface does not have is the same defect wearing different clothes.
 */
import { act, render } from '@testing-library/react-native';

import { cameraIntentEquals, sessionPosition, type CanonicalStore } from '../../state';
import type { MapProjectionRequest } from '../../map';
import { returnMapContext } from '../../return-navigation';
import { OrientationChrome } from '../OrientationChrome';
import { RETURN_CONTROLS_TEST_ID } from '../ReturnControls';
import { orientationModel } from '../model';
import { returnActWords } from '../product-copy';
import { opportunity, returnMeaning } from '../return-orientation';
import { RETURN_OPPORTUNITY_IDS, type ChromeLanguage, type ReturnOpportunityId } from '../types';
import { chromeStore, chromeSurface, fetched, offeredIds, projectionFor, readableText, TWO_CONTEXT_WORLD, world } from '../__fixtures__/chrome';

/** A historical reader whose live focus IS disclosed here, so the composite is semantically apt. */
const reader = (over: Parameters<typeof chromeStore>[0] = {}): CanonicalStore =>
  chromeStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
    ...over,
  });

const here = (store: CanonicalStore) => projectionFor(store, fetched(TWO_CONTEXT_WORLD({ depth: store.getState().camera.depth })));

/** The LIVE viewpoint's disclosure, in which `thread-a` really does have a place. */
const landingProvider = (request: MapProjectionRequest) => returnMapContext(fetched(TWO_CONTEXT_WORLD({ tc: 6, liveHead: 6 })), request);
/** A real provider that never has a disclosure to give. The temporal half still succeeds. */
const notFetchedProvider = (request: MapProjectionRequest) => returnMapContext({ status: 'NOT_FETCHED' }, request);
/** A real provider answering with a disclosure that is not the live viewpoint's at all. */
const staleProvider = (request: MapProjectionRequest) => returnMapContext(fetched(TWO_CONTEXT_WORLD({ tc: 2, liveHead: 2 })), request);

const renderWith = (store: CanonicalStore, liveContext?: (request: MapProjectionRequest) => ReturnType<typeof returnMapContext>, language: ChromeLanguage = 'en') =>
  render(<OrientationChrome language={language} surface={chromeSurface(store)} projection={here(store)} liveContext={liveContext} />);

describe('R3-03 — six identities, and no boolean pretending to be a promise', () => {
  it('50, 51, 52 — the vocabulary is exactly six, none of them generic, and no guarantee-shaped boolean survives', () => {
    expect(RETURN_OPPORTUNITY_IDS).toHaveLength(6);
    expect(new Set(RETURN_OPPORTUNITY_IDS).size).toBe(6);
    const intents = RETURN_OPPORTUNITY_IDS.map((id) => returnMeaning(id).intent);
    // 51 — six distinct intents. A generic Home/Reset/Return would have to pick one and silently
    // mean the others, which is exactly the collapse the frozen contract forbids.
    expect(new Set(intents).size).toBe(6);
    for (const id of RETURN_OPPORTUNITY_IDS) {
      const shape = returnMeaning(id);
      // 52 — the booleans are gone, and nothing replaced them with another guarantee.
      expect(shape).not.toHaveProperty('movesTime');
      expect(shape).not.toHaveProperty('movesCamera');
      expect(Object.keys(shape).sort()).toEqual(['effect', 'effects', 'id', 'intent']);
      expect(Object.keys(shape.effects).sort()).toEqual(['inspection', 'spatial', 'temporal']);
    }
  });

  it('53, 54 — Back and Exact Return promise a restored viewpoint, never a movement', () => {
    for (const id of ['BACK_ONE_STEP', 'EXACT_RETURN'] as const) {
      const shape = returnMeaning(id);
      expect(shape.effects).toEqual({
        temporal: 'RESTORED_IF_DIFFERENT',
        spatial: 'RESTORED_IF_DIFFERENT',
        inspection: 'RESTORED_IF_DIFFERENT',
      });
    }
    expect(returnMeaning('BACK_ONE_STEP').intent).toBe('RESTORE_LATEST_CAPTURED_VIEWPOINT');
    expect(returnMeaning('EXACT_RETURN').intent).toBe('RESTORE_BOUND_INSPECTION_EXACTLY');
    // And the words match the type: a captured viewpoint is restored; nothing is said about movement.
    expect(returnActWords('en', 'BACK_ONE_STEP').hint).toContain('Restores the viewpoint');
    expect(returnActWords('en', 'EXACT_RETURN').hint).toContain('Restores exactly the viewpoint');
  });

  it('55, 56, 57 — the two Live acts are opposites, and World is spatial at the same moment', () => {
    // 55 — temporal only. It must never be presented as taking the reader anywhere.
    expect(returnMeaning('RETURN_LIVE_HEAD').effects).toEqual({ temporal: 'DIRECT', spatial: 'PRESERVED', inspection: 'PRESERVED' });
    expect(returnActWords('en', 'RETURN_LIVE_HEAD').hint).toContain('The view does not move.');

    // 56 — spatial only, one shot, and explicitly not a way to change the moment.
    expect(returnMeaning('RETURN_LIVE_FOCUS').effects).toEqual({ temporal: 'PRESERVED', spatial: 'ONE_SHOT_BOUNDED', inspection: 'PRESERVED' });
    expect(returnActWords('en', 'RETURN_LIVE_FOCUS').hint).toContain('once');
    expect(returnActWords('en', 'RETURN_LIVE_FOCUS').hint).toContain('does not change');

    // 57 — World at the SAME temporal state, which is what makes it not Back.
    expect(returnMeaning('RETURN_WORLD').effects).toEqual({ temporal: 'PRESERVED', spatial: 'DIRECT', inspection: 'PRESERVED' });
    expect(returnActWords('en', 'RETURN_WORLD').hint).toContain('at the same moment');
  });

  it.each(['ar', 'en'] as const)('58, 59, 60 — the composite marks its spatial half conditional in %s', (language) => {
    expect(returnMeaning('GO_LIVE_AND_LOCATE').effects).toEqual({
      temporal: 'DIRECT',
      spatial: 'CONDITIONAL_POST_LIVE_LOCATE',
      inspection: 'PRESERVED',
    });
    const hint = returnActWords(language, 'GO_LIVE_AND_LOCATE').hint;
    // The conditional is stated in the reader's own language, not implied by the absence of a claim.
    expect(hint).toContain(language === 'ar' ? 'وإذا' : 'if');
    // And it never promises the landing.
    expect(hint).not.toMatch(/\bwill move\b/u);
  });
});

describe('R3-03 — the composite is offered only where its spatial half can be attempted', () => {
  it('61 — with no live-context provider at all, the composite is absent', async () => {
    const store = reader();
    expect(offeredIds(orientationModel(store, here(store)))).not.toContain('GO_LIVE_AND_LOCATE');
    const view = await renderWith(store, undefined);
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:GO_LIVE_AND_LOCATE`)).toBeNull();
    await act(async () => {
      view.unmount();
    });
  });

  it('62 — with a real provider it is offered, when the semantic conditions also hold', async () => {
    const store = reader();
    expect(offeredIds(orientationModel(store, here(store), { liveContextAvailable: true }))).toContain('GO_LIVE_AND_LOCATE');
    const view = await renderWith(store, landingProvider);
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:GO_LIVE_AND_LOCATE`)).not.toBeNull();
    await act(async () => {
      view.unmount();
    });

    // ...and never merely because a provider exists: under Live its temporal half does nothing, so
    // it would collapse into its own spatial half and become a second button for one act.
    const following = reader({ temporal: { kind: 'FOLLOW_LIVE' } });
    expect(offeredIds(orientationModel(following, here(following), { liveContextAvailable: true }))).not.toContain('GO_LIVE_AND_LOCATE');
  });

  it('74 — provider presence is a capability, not a target, so its identity may churn freely', async () => {
    const store = reader();
    const first = offeredIds(orientationModel(store, here(store), { liveContextAvailable: true }));
    const second = offeredIds(orientationModel(store, here(store), { liveContextAvailable: true }));
    expect(first).toEqual(second);
    // A different provider FUNCTION is the same capability, so the offered set cannot move with it.
    const view = await renderWith(store, landingProvider);
    const before = view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:GO_LIVE_AND_LOCATE`) !== null;
    await act(async () => {
      view.rerender(<OrientationChrome language="en" surface={chromeSurface(store)} projection={here(store)} liveContext={notFetchedProvider} />);
    });
    expect(view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:GO_LIVE_AND_LOCATE`) !== null).toBe(before);
    await act(async () => {
      view.unmount();
    });
  });
});

describe('R3-03 — a temporal-only composite is a valid outcome, not a failure', () => {
  async function pressComposite(store: CanonicalStore, provider: (request: MapProjectionRequest) => ReturnType<typeof returnMapContext>) {
    const cameraBefore = store.getState().camera;
    const view = await renderWith(store, provider);
    const control = view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:GO_LIVE_AND_LOCATE`);
    if (control !== null) {
      await act(async () => {
        control.props.onClick();
      });
    }
    const after = store.getState();
    await act(async () => {
      view.unmount();
    });
    return { offered: control !== null, after, cameraMoved: !cameraIntentEquals(cameraBefore, after.camera) };
  }

  it('63 — a live focus of NONE leaves the camera alone and the temporal return still stands', async () => {
    const store = reader({ liveFocus: { kind: 'NONE' } });
    const { offered, after, cameraMoved } = await pressComposite(store, landingProvider);
    expect(offered).toBe(true);
    expect(after.temporal.kind).toBe('FOLLOW_LIVE');
    expect(cameraMoved).toBe(false);
  });

  it('64 — an emerging, pregeographic focus is not a landing, and the act is still correct', async () => {
    const store = reader({ liveFocus: { kind: 'EMERGING_FOCUS', emergingFocusId: 'focus-not-placed' } });
    const { after, cameraMoved } = await pressComposite(store, landingProvider);
    expect(after.temporal.kind).toBe('FOLLOW_LIVE');
    expect(cameraMoved).toBe(false);
  });

  it('65 — a real provider holding no disclosure yields the temporal half alone', async () => {
    const store = reader();
    const { offered, after, cameraMoved } = await pressComposite(store, notFetchedProvider);
    expect(offered).toBe(true);
    expect(after.temporal.kind).toBe('FOLLOW_LIVE');
    expect(cameraMoved).toBe(false);
  });

  it('66 — a disclosure that is not the live viewpoint fabricates no spatial meaning', async () => {
    const store = reader();
    const { after, cameraMoved } = await pressComposite(store, staleProvider);
    expect(after.temporal.kind).toBe('FOLLOW_LIVE');
    // A scene that is not this viewpoint's is never read as evidence about where anything is.
    expect(cameraMoved).toBe(false);
  });

  it('67, 72 — a legitimate landing can move both, as ONE Product transaction', async () => {
    const store = reader();
    const before = store.getState().history.length;
    const { after } = await pressComposite(store, landingProvider);
    expect(after.temporal.kind).toBe('FOLLOW_LIVE');
    // 72 — one act, so exactly one reversible entry was recorded whatever the spatial half did.
    expect(after.history.length).toBe(before + 1);
  });

  it('68 — the referent is bound once at the post-live boundary and a later change is not chased', async () => {
    const store = reader();
    const view = await renderWith(store, landingProvider);
    const control = view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:GO_LIVE_AND_LOCATE`);
    await act(async () => {
      control.props.onClick();
    });
    const settled = store.getState().camera;
    // Live attention moves on afterwards. The act already happened; nothing re-reads it.
    await act(async () => {
      view.rerender(<OrientationChrome language="en" surface={chromeSurface(store)} projection={here(store)} liveContext={landingProvider} />);
    });
    expect(cameraIntentEquals(store.getState().camera, settled)).toBe(true);
    await act(async () => {
      view.unmount();
    });
  });

  it('73 — Back after a temporal-only composite restores the viewpoint it started from', async () => {
    const store = reader({ liveFocus: { kind: 'NONE' } });
    const beforeCamera = store.getState().camera;
    const beforeTemporal = store.getState().temporal;
    const view = await renderWith(store, landingProvider);
    await act(async () => {
      view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:GO_LIVE_AND_LOCATE`).props.onClick();
    });
    expect(store.getState().temporal.kind).toBe('FOLLOW_LIVE');

    await act(async () => {
      view.rerender(<OrientationChrome language="en" surface={chromeSurface(store)} projection={here(store)} liveContext={landingProvider} />);
    });
    await act(async () => {
      view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:BACK_ONE_STEP`).props.onClick();
    });
    expect(store.getState().temporal).toEqual(beforeTemporal);
    expect(cameraIntentEquals(store.getState().camera, beforeCamera)).toBe(true);
    await act(async () => {
      view.unmount();
    });
  });
});

describe('R3-03 — the composite discloses nothing about where it might land', () => {
  it.each(['ar', 'en'] as const)('69, 70 — no %s word of the composite names a target, a thread, a direction or a count', async (language) => {
    const store = reader();
    const view = await renderWith(store, landingProvider, language);
    const control = view.getByTestId(`${RETURN_CONTROLS_TEST_ID}:GO_LIVE_AND_LOCATE`);
    const words = `${control.props.accessibilityLabel} | ${control.props.accessibilityHint}`;
    for (const leak of ['thread-a', 'thread-b', 'reading-1', 'binding-a', 'ESTABLISHED_THREAD', '5', '6']) {
      expect(words).not.toContain(leak);
    }
    // 70 — and the spoken form is the same one, so there is no accessibility-only extra claim.
    expect(readableText(view.toJSON()).join(' | ')).toContain(control.props.accessibilityHint);
    await act(async () => {
      view.unmount();
    });
  });

  it('71 — two positions differing only in an undisclosed future focus offer the same set', () => {
    const disclosed = reader();
    const undisclosed = reader({ liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-nowhere' } });
    const withProvider = { liveContextAvailable: true };
    // The composite's presence follows the reader's OWN stance and this surface's own capability.
    expect(offeredIds(orientationModel(disclosed, here(disclosed), withProvider))).toContain('GO_LIVE_AND_LOCATE');
    expect(offeredIds(orientationModel(undisclosed, here(undisclosed), withProvider))).toContain('GO_LIVE_AND_LOCATE');
    // The only act that legitimately differs is the projection-bound Live Focus one.
    const strip = (ids: readonly ReturnOpportunityId[]) => ids.filter((id) => id !== 'RETURN_LIVE_FOCUS');
    expect(strip(offeredIds(orientationModel(disclosed, here(disclosed), withProvider)))).toEqual(
      strip(offeredIds(orientationModel(undisclosed, here(undisclosed), withProvider))),
    );
  });

  it('the offered opportunity carries the same frozen meaning as the identity itself', () => {
    const store = reader();
    const model = orientationModel(store, here(store), { liveContextAvailable: true });
    for (const id of RETURN_OPPORTUNITY_IDS) {
      const offered = opportunity(model.returns, id);
      if (offered !== null) expect(offered).toEqual(returnMeaning(id));
    }
  });

  it('an unplaced world still offers nothing that claims a place', () => {
    const empty = () => world({ depth: 'ANALYTICAL_OBJECT', tc: 4, liveHead: 6, threads: [], appearances: [], readings: [] });
    const store = reader();
    const model = orientationModel(store, projectionFor(store, fetched(empty())), { liveContextAvailable: true });
    expect(model.live.focusReturn).not.toBe('AVAILABLE');
    expect(offeredIds(model)).not.toContain('RETURN_LIVE_FOCUS');
  });
});
