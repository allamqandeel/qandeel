/**
 * T-11 — the same answer at every width, in both languages, in both directions.
 *
 * > Compactness removes space, not truth.
 *
 * The whole of T-08's semantic model is frozen, so the interesting claim is a NEGATIVE one: across
 * the entire supported envelope, at both text sizes and in every language/direction combination,
 * the semantic model, the offered acts, their order, their availability and every single word are
 * identical. Only the arrangement differs.
 *
 * Language and layout direction are tested as independent axes throughout. `I18nManager.isRTL`
 * never selects a language here and a language never selects a direction, because in the Product
 * they are two different facts about a reader and either can be true without the other.
 */
import { act, render } from '@testing-library/react-native';
import { I18nManager } from 'react-native';

import { MAP_SURFACE_PLANE_TEST_ID } from '../../map';
import { ORIENTATION_CHROME_TEST_ID, orientationModel, RETURN_CONTROLS_TEST_ID, type ChromeLanguage } from '../../orientation-chrome';
import { chromeStore, chromeSurface, contextAt, flattenStyle, readableText, TWO_CONTEXT_WORLD } from '../../orientation-chrome/__fixtures__/chrome';
import { sessionPosition } from '../../state';
import { createPresentationController } from '../../timeline';
import { createTemporalPreviewController } from '../../temporal-navigation/preview';
import { temporalTargeting } from '../../temporal-navigation/targeting';
import { trackOf } from '../../temporal-navigation/__fixtures__/temporal';
import { isPressTarget, nodes, RESPONSIVE_CHROME_BAND_TEST_ID, ResponsiveWorld, resize, subtree } from '../__fixtures__/composition';
import { CHROME_MAX_MEASURE_POINTS, CHROME_OWN_HORIZONTAL_PADDING, recompositionPlan, type RecompositionPlan } from '../plan';
import { presentationSurface } from '../surface';

jest.setTimeout(120_000);

const ENVELOPE = [
  { id: 'C1', width: 320, height: 568 },
  { id: 'C2', width: 360, height: 800 },
  { id: 'C3', width: 390, height: 844 },
  { id: 'C4', width: 412, height: 915 },
  { id: 'C5', width: 568, height: 320 },
  { id: 'C6', width: 844, height: 390 },
  { id: 'C7', width: 768, height: 1024 },
  { id: 'C8', width: 1024, height: 768 },
  { id: 'C9', width: 1366, height: 1024 },
] as const;

const reader = () =>
  chromeStore({
    liveHead: 6,
    depth: 'ANALYTICAL_OBJECT',
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
  });

async function mounted(language: ChromeLanguage, fontScale = 1, insets: Record<string, number> = {}) {
  const store = reader();
  const context = contextAt(TWO_CONTEXT_WORLD());
  const preview = createTemporalPreviewController();
  const presentation = createPresentationController(trackOf('session-1', 6), 0);
  const plans: RecompositionPlan[] = [];
  const view = await render(
    <ResponsiveWorld
      store={store}
      context={context}
      language={language}
      preview={preview}
      presentation={presentation}
      fontScale={fontScale}
      insets={insets}
      onPlan={(plan) => plans.push(plan)}
    />,
  );
  return { store, context, view, plans, latestPlan: () => plans[plans.length - 1] };
}

/** Everything a reader can see or hear in the chrome, plus what each control is and how big it is. */
function chromeAnswer(view: Awaited<ReturnType<typeof render>>) {
  const chrome = view.getByTestId(ORIENTATION_CHROME_TEST_ID);
  // A viewpoint where no return act is meaningful renders no group at all — "nothing meaningful to
  // offer is a legitimate answer, and an empty group is not a surface". That state has to be part
  // of the parity matrix rather than excluded from it: an absent group must be absent at EVERY
  // width, which is exactly the kind of thing a helper that assumed a group would hide.
  const group = view.queryByTestId(RETURN_CONTROLS_TEST_ID);
  const controls = group === null ? [] : nodes(group).filter(isPressTarget);
  return {
    offersAnyAct: group !== null,
    words: readableText(chrome),
    acts: controls.map((node) => ((node.props ?? {}) as Record<string, unknown>).testID),
    labels: controls.map((node) => ((node.props ?? {}) as Record<string, unknown>).accessibilityLabel),
    hints: controls.map((node) => ((node.props ?? {}) as Record<string, unknown>).accessibilityHint),
    disabled: controls.map((node) => JSON.stringify(((node.props ?? {}) as Record<string, unknown>).accessibilityState ?? null)),
    // Focus order is the order the accessible tree presents them in, which is the order they are
    // laid out in. It must not diverge from the visual order when the arrangement wraps.
    focusOrder: nodes(chrome)
      .filter(isPressTarget)
      .map((node) => ((node.props ?? {}) as Record<string, unknown>).accessibilityLabel),
  };
}

describe('T11 — the same truthful answer at every supported size', () => {
  for (const language of ['en', 'ar'] as const) {
    for (const rtl of [false, true]) {
      it(`T11-A41…A43, T11-A52, T11-A53 — ${language} ${rtl ? 'RTL' : 'LTR'}: model, acts, order and words are identical across C1…C9`, async () => {
        const original = I18nManager.isRTL;
        I18nManager.isRTL = rtl;
        try {
          const world = await mounted(language);
          await resize(world.view, ENVELOPE[0].width, ENVELOPE[0].height);
          const reference = chromeAnswer(world.view);
          const referenceModel = orientationModel(
            world.store,
            { held: true, context: world.context },
            { liveContextAvailable: true },
          );
          expect(reference.acts.length).toBeGreaterThan(0);

          for (const testCase of ENVELOPE) {
            await resize(world.view, testCase.width, testCase.height);
            const answer = chromeAnswer(world.view);
            expect({ case: testCase.id, ...answer }).toEqual({ case: testCase.id, ...reference });
            // The semantic model itself, recomputed at this width: deep-equal, object for object.
            expect(orientationModel(world.store, { held: true, context: world.context }, { liveContextAvailable: true })).toEqual(
              referenceModel,
            );
          }
          await act(async () => {
            world.view.unmount();
          });
        } finally {
          I18nManager.isRTL = original;
        }
      });
    }
  }

  it('T11-A44, T11-A45, T11-A46, T11-A47, T11-A49 — nothing is hidden, shrunk, truncated or put behind "More"', async () => {
    const world = await mounted('ar');
    for (const testCase of ENVELOPE) {
      await resize(world.view, testCase.width, testCase.height);
      const controls = subtree(world.view, RETURN_CONTROLS_TEST_ID).filter(isPressTarget);
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        const style = flattenStyle(((control.props ?? {}) as Record<string, unknown>).style);
        // A floor, never a ceiling: the control grows to contain the longest Arabic wording.
        expect(style.minHeight).toBe(44);
        expect(style.height).toBeUndefined();
        expect(style.maxHeight).toBeUndefined();
      }
      const serialized = JSON.stringify(subtree(world.view, ORIENTATION_CHROME_TEST_ID));
      // Nothing clips, ellipsizes or hides an act behind an indirection at any width.
      expect(serialized).not.toContain('numberOfLines');
      expect(serialized).not.toContain('ellipsizeMode');
      expect(serialized).not.toContain('"overflow":"hidden"');
      // Nothing disables the reader's own text size, and nothing caps it.
      expect(serialized).not.toContain('allowFontScaling');
      expect(serialized).not.toContain('maxFontSizeMultiplier');
    }
    await act(async () => {
      world.view.unmount();
    });
  });

  it('T11-A48 — an expansive window adds no control, no summary and no second Product', async () => {
    const world = await mounted('en');
    await resize(world.view, 320, 568);
    const compact = {
      acts: chromeAnswer(world.view).acts,
      textNodes: subtree(world.view, ORIENTATION_CHROME_TEST_ID).filter((node) => node.type === 'Text').length,
    };
    for (const [width, height] of [
      [768, 1024],
      [1024, 768],
      [1366, 1024],
    ] as const) {
      await resize(world.view, width, height);
      const wide = {
        acts: chromeAnswer(world.view).acts,
        textNodes: subtree(world.view, ORIENTATION_CHROME_TEST_ID).filter((node) => node.type === 'Text').length,
      };
      // Exactly the same controls and exactly the same number of things to read: a bigger window is
      // not permission to say more.
      expect(wide).toEqual(compact);
      // The extra width becomes air around the same words, bounded by the reading measure — and
      // ONLY the words are bounded: the Timeline is a temporal instrument, not prose, so every
      // extra point of it is one more disclosed Moment the reader can see and reach at once.
      const plan = world.latestPlan();
      expect(plan.chrome.measurePoints).toBe(CHROME_MAX_MEASURE_POINTS + 2 * CHROME_OWN_HORIZONTAL_PADDING);
      expect(plan.timelineWidthPoints).toBe(width - 2 * plan.chrome.paddingHorizontal);
      expect(plan.timelineWidthPoints).toBeGreaterThan(plan.chrome.measurePoints);
      expect(plan.chrome.arrangement).toBe('STACKED');
      const band = world.view.getByTestId(RESPONSIVE_CHROME_BAND_TEST_ID);
      expect(flattenStyle(band.props.style).paddingHorizontal).toBe(24);
    }
    await act(async () => {
      world.view.unmount();
    });
  });

  it('short landscape pairs the acts, keeps every word, and never becomes a sidebar', async () => {
    const world = await mounted('ar');
    await resize(world.view, 390, 844);
    const portrait = chromeAnswer(world.view);
    await resize(world.view, 568, 320);
    const short = chromeAnswer(world.view);
    expect(short).toEqual(portrait);
    expect(world.latestPlan().chrome.arrangement).toBe('PAIRED');
    // Two across, in the READING direction, at the platform minimum spacing — and still a column of
    // rows, never a panel beside the world.
    const group = world.view.getByTestId(RETURN_CONTROLS_TEST_ID);
    expect(group.props.style).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8 });
    for (const control of subtree(world.view, RETURN_CONTROLS_TEST_ID).filter(isPressTarget)) {
      const style = flattenStyle(((control.props ?? {}) as Record<string, unknown>).style);
      expect(style.minHeight).toBe(44);
      expect(style.flexBasis).toBe('48%');
      expect(style.width).toBeUndefined();
      expect(style.maxWidth).toBeUndefined();
    }
    // and going back restores the column, with the same answer.
    await resize(world.view, 390, 844);
    expect(chromeAnswer(world.view)).toEqual(portrait);
    expect(world.view.getByTestId(RETURN_CONTROLS_TEST_ID).props.style).toMatchObject({ flexDirection: 'column', rowGap: 8 });
    await act(async () => {
      world.view.unmount();
    });
  });

  it('T11-A56, T11-A57, T11-A58 — the largest text keeps every act reachable and changes no Product state', async () => {
    const store = reader();
    const context = contextAt(TWO_CONTEXT_WORLD());
    const before = store.getState();
    const referenceModel = orientationModel(store, { held: true, context }, { liveContextAvailable: true });
    let reference: ReturnType<typeof chromeAnswer> | null = null;
    for (const fontScale of [1, 1.35, 2, 3.5]) {
      const world = await mounted('ar', fontScale);
      await resize(world.view, 320, 568);
      const answer = chromeAnswer(world.view);
      reference = reference ?? answer;
      // Every act, every word, every hint and the same order — a larger text size is pressure on
      // the layout and never a reason to remove something.
      expect(answer).toEqual(reference);
      expect(orientationModel(world.store, { held: true, context: world.context }, { liveContextAvailable: true })).toEqual(referenceModel);
      expect(world.store.getState().history).toHaveLength(0);
      await act(async () => {
        world.view.unmount();
      });
    }
    expect(store.getState()).toBe(before);
  });

  it('T11-A50 — the only things that can take a press in the chrome are the controls that mean something', async () => {
    const world = await mounted('en');
    for (const testCase of ENVELOPE) {
      await resize(world.view, testCase.width, testCase.height);
      const targets = subtree(world.view, ORIENTATION_CHROME_TEST_ID).filter(isPressTarget);
      const testIDs = targets.map((node) => String(((node.props ?? {}) as Record<string, unknown>).testID ?? ''));
      // Every press target inside the chrome is a named control. No wrapper, no band and no text
      // surface swallows a touch that was meant for the world.
      for (const id of testIDs) expect(id).not.toBe('');
      // and the Map's own pointer route is still there to receive one.
      expect(world.view.getByTestId(MAP_SURFACE_PLANE_TEST_ID)).toBeTruthy();
    }
    await act(async () => {
      world.view.unmount();
    });
  });

  it('T11-A08 — an asymmetric inset changes padding and nothing else', async () => {
    const world = await mounted('en', 1, { top: 48, bottom: 34, left: 0, right: 0 });
    await resize(world.view, 390, 844, { insetTop: 48, insetBottom: 34 });
    const withInset = chromeAnswer(world.view);
    expect(world.latestPlan().chrome.bottomInset).toBe(34);
    // T-08's own seam receives it, and the words are untouched.
    const chrome = world.view.getByTestId(ORIENTATION_CHROME_TEST_ID);
    expect(flattenStyle(chrome.props.style).paddingBottom).toBe(12 + 34);
    const plain = await mounted('en');
    await resize(plain.view, 390, 844);
    expect(withInset.words).toEqual(chromeAnswer(plain.view).words);
    expect(withInset.acts).toEqual(chromeAnswer(plain.view).acts);
    await act(async () => {
      world.view.unmount();
    });
    await act(async () => {
      plain.view.unmount();
    });
  });

  it('the chrome surface is a bottom band at every width — never a drawer, sidebar or inspector', async () => {
    const world = await mounted('en');
    for (const testCase of ENVELOPE) {
      await resize(world.view, testCase.width, testCase.height);
      const chrome = world.view.getByTestId(ORIENTATION_CHROME_TEST_ID);
      const style = flattenStyle(chrome.props.style);
      // Self-sizing and stretched across its parent: no absolute fill, no fixed side, no width
      // fraction, no modal, no panel.
      expect(style.alignSelf).toBe('stretch');
      expect(style.position).toBeUndefined();
      expect(style.width).toBeUndefined();
      expect(style.flex).toBeUndefined();
      const band = flattenStyle(world.view.getByTestId(RESPONSIVE_CHROME_BAND_TEST_ID).props.style);
      expect(band.position).toBeUndefined();
      // T-12 re-anchor. What this defends is that the chrome is never a DRAWER, a SIDEBAR or an
      // INSPECTOR — never floated over the world, never pinned to a side, never a fraction of the
      // window. That is unchanged and still checked above and below. What a bare `width` no longer
      // distinguishes is the short-height composition, where the instrument and the orientation sit
      // ACROSS each other inside the same bottom band: there the orientation legitimately occupies
      // its own half of that band. So the rule is stated precisely instead of by absence — a width
      // may exist ONLY in that arrangement, and only as the plan's own half of the band.
      const plan = recompositionPlan(presentationSurface({ width: testCase.width, height: testCase.height }) as never);
      if (plan.support.arrangement === 'SIDE_BY_SIDE') {
        expect(band.width).toBe(plan.support.chromeWidthPoints);
        expect(plan.shortHeight).toBe(true);
      } else {
        expect(band.width).toBeUndefined();
      }
      // Never a fraction of the window, in either arrangement.
      expect(typeof band.width === 'string').toBe(false);
    }
    await act(async () => {
      world.view.unmount();
    });
  });
});

describe('T11 — every Product state answers the same at every width', () => {
  /**
   * The parity claim is per STATE, not across states: two different viewpoints must of course say
   * different things. What must never differ is one viewpoint's answer at two window sizes — and
   * the states that change which acts are meaningful are exactly the ones worth checking, because
   * they are where a width-sensitive offering would show.
   */
  const STATES = [
    { id: 'FOLLOW_LIVE at the world rung', options: { liveHead: 6, depth: 'WORLD' as const, temporal: { kind: 'FOLLOW_LIVE' as const } } },
    {
      id: 'FOLLOW_LIVE with an established Live Focus',
      options: {
        liveHead: 6,
        depth: 'ANALYTICAL_OBJECT' as const,
        temporal: { kind: 'FOLLOW_LIVE' as const },
        liveFocus: { kind: 'ESTABLISHED_THREAD' as const, threadId: 'thread-a' },
        liveFocusAtSp: 5,
      },
    },
    { id: 'PINNED at the world rung, no Live Focus', options: { liveHead: 6, depth: 'WORLD' as const, temporal: { kind: 'PINNED' as const, at: sessionPosition(4) } } },
    {
      id: 'PINNED deeper, with a Live Focus',
      options: {
        liveHead: 6,
        depth: 'ANALYTICAL_OBJECT' as const,
        temporal: { kind: 'PINNED' as const, at: sessionPosition(4) },
        liveFocus: { kind: 'ESTABLISHED_THREAD' as const, threadId: 'thread-a' },
        liveFocusAtSp: 5,
      },
    },
    // No mirrored Live Head at all. `PINNED` is not constructible there — the kernel refuses it,
    // because a position nothing has disclosed is not a pinnable one — so the state that actually
    // exists is the following one, and it is the case where the fewest acts are meaningful.
    { id: 'FOLLOW_LIVE with no mirrored Live Head', options: { liveHead: null, depth: 'WORLD' as const, temporal: { kind: 'FOLLOW_LIVE' as const } } },
  ];

  for (const state of STATES) {
    it(`T11-A41…A43 — ${state.id}: identical at C1, C5 and C8`, async () => {
      const store = chromeStore(state.options);
      const context = contextAt(TWO_CONTEXT_WORLD());
      const preview = createTemporalPreviewController();
      const presentation = createPresentationController(trackOf('session-1', 6), 0);
      const view = await render(
        <ResponsiveWorld store={store} context={context} language="ar" preview={preview} presentation={presentation} />,
      );
      const before = store.getState();
      await resize(view, 320, 568);
      const reference = chromeAnswer(view);
      for (const [width, height] of [
        [568, 320],
        [1024, 768],
        [320, 568],
      ] as const) {
        await resize(view, width, height);
        expect(chromeAnswer(view)).toEqual(reference);
      }
      // and the state itself was never touched by any of it.
      expect(store.getState()).toBe(before);
      await act(async () => {
        view.unmount();
      });
    });
  }

  it('a Preview open across a resize keeps the same answer and is neither committed nor cancelled', async () => {
    const store = reader();
    const context = contextAt(TWO_CONTEXT_WORLD());
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', 6), 0);
    const view = await render(
      <ResponsiveWorld store={store} context={context} language="ar" preview={preview} presentation={presentation} />,
    );
    await resize(view, 390, 844);
    const result = preview.preview(temporalTargeting(store.getState(), presentation.getSnapshot().track), sessionPosition(2), 'DISCLOSED_TARGET');
    expect(result.outcome).toBe('PREVIEWING');
    const previewing = chromeAnswer(view);
    const before = store.getState();
    // The chrome says a second thing while a preview is open — that this is a temporary look, and
    // that the reader's own committed position has not moved. Both must survive every width.
    for (const [width, height] of [
      [320, 568],
      [568, 320],
      [1366, 1024],
    ] as const) {
      await resize(view, width, height);
      expect(chromeAnswer(view)).toEqual(previewing);
      expect(preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 2 });
      expect(store.getState()).toBe(before);
    }
    await act(async () => {
      view.unmount();
    });
  });
});

describe('T11 — the chrome never learns to measure', () => {
  it('reads no width, breakpoint or dimension of its own at any size', async () => {
    const world = await mounted('ar');
    for (const testCase of ENVELOPE) {
      await resize(world.view, testCase.width, testCase.height);
      const serialized = JSON.stringify(subtree(world.view, ORIENTATION_CHROME_TEST_ID));
      // The same guard T-08 froze for itself, re-proven inside the responsive composition: the
      // chrome is TOLD its arrangement, and it looks nothing up.
      for (const responsive of ['onLayout', 'useWindowDimensions', 'breakpoint', 'maxWidth', 'minWidth']) {
        expect(serialized).not.toContain(responsive);
      }
    }
    await act(async () => {
      world.view.unmount();
    });
  });

  it('the surface passes T-08 exactly one already-decided arrangement, and never a measurement', async () => {
    const world = await mounted('en');
    const seen = new Set<string>();
    for (const testCase of ENVELOPE) {
      await resize(world.view, testCase.width, testCase.height);
      seen.add(world.latestPlan().chrome.arrangement);
    }
    expect([...seen].sort()).toEqual(['PAIRED', 'STACKED']);
    await act(async () => {
      world.view.unmount();
    });
  });
});

/** The chrome surface fixture is re-exported for the composition; naming it keeps the import honest. */
export const CHROME_SURFACE = chromeSurface;
