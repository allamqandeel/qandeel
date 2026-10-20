/**
 * S7-04 — the player's layout under the Product Owner's visual direction (2026-10-20): option (b).
 *
 *   - the surface is composed CHROME_ONLY: no Timeline row, no Live Timeline, nothing in the temporal slot;
 *   - the moment controls stand in the moment's own header beside its position, inside the band the chrome MEASURES —
 *     so the band is what the moment needs and the world grows into the rest, with no fixed room held for nothing;
 *   - the transport is P2's own `play` / `pause` and the Replay Temporal Spine (P2's Spine + Aperture C "Parting", the
 *     Product Owner's decision of 2026-10-20): one notch per moment of the version, no Live, no temporal authority.
 *
 * What a simulated layout proves is what the surface does GIVEN a measurement (see `responsive/__fixtures__`): the
 * band the plan allocates for the chrome's measured height, at every window and text size below. That the platform
 * measures the band without clipping a sentence is proven on the emulator (the S7-04 record's EMULATOR SCREENSHOT row).
 */
import { act, cleanup, fireEvent, render, within as inside, type RenderResult } from '@testing-library/react-native';
import { AccessibilityInfo, ScrollView, StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import { CANONICAL_VISUAL } from '../../conversation/visual/canonical-visual.generated';
import { resetReduceMotionForTests } from '../../motion';
import {
  RESPONSIVE_CHROME_BAND_TEST_ID,
  RESPONSIVE_CHROME_MEASURE_TEST_ID,
  RESPONSIVE_MAP_FRAME_TEST_ID,
  RESPONSIVE_SUPPORT_BAND_TEST_ID,
  RESPONSIVE_TIMELINE_ROW_TEST_ID,
} from '../../responsive';
import { nodes, resize } from '../../responsive/__fixtures__/composition';
import { TEMPORAL_LIVE_EDGE_TEST_ID, TEMPORAL_LIVE_TERMINAL_TEST_ID, TEMPORAL_TARGET_LAYER_TEST_ID, restingMarkerX } from '../../temporal-navigation';
import { REPLAY_COMPOSITE_TEST_ID, ReplayMomentComposite, createReplayCompositeController, replayCompositeCopy } from '../../replay-composite';
import { replayScene, replayWireClient } from '../../replay-composite/__fixtures__/replay-wire';
import { replayEntryCopy } from '../../replay-entry';
import { ReplayPlayer, createReplayPlayerController, type ReplayPlayerScheduler } from '..';
import { REPLAY_SPINE_GESTURE_TEST_ID, REPLAY_SPINE_TAP_TEST_ID, REPLAY_SPINE_TEST_ID, createSpineTouches, replaySpineOffset } from '../ReplaySpine';
import { PLAYER_IDS, PLAYER_WIRE, capturedHandoff, capturedIds, playerClients, playerServer, type PlayerAnswer } from '../__fixtures__/player-wire';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
/** The window under test; each case sets its own size and text scale. */
const windowSize = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => windowSize }));

jest.setTimeout(30000);

const INSETS = { top: 24, right: 0, bottom: 16, left: 0 };
const flush = () => act(async () => { for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve)); });
const style = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
const measure = (view: RenderResult, height: number) => act(async () => {
  fireEvent(view.getByTestId(RESPONSIVE_CHROME_MEASURE_TEST_ID), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: windowSize.width, height } } });
});

const appearance = () => createAppearanceAuthority({
  store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
  system: { current: () => 'DARK', subscribe: () => () => undefined },
  native: { apply: () => undefined },
});

/** A long historical message, said as text: the moments read is the captured one with its first text made long. */
const LONG = 'المدير بقى بيتعامل معايا بشكل غريب، ومش فاهم السبب، وكل ما أحاول أكلمه يقول إنه مشغول وبعدين يرجع يسأل عن حاجات قديمة خلصت من أسبوعين، وأنا تعبت من إني أفسر كل حاجة من الأول. '.repeat(3).trim();
type WireMoment = { text: string; omittedBefore: number };
const MOMENTS_BODY = PLAYER_WIRE.scenes.preview.moments as { moments: WireMoment[] };
const MOMENT_TEXTS = MOMENTS_BODY.moments.map((moment) => moment.text);
/** The captured moments read, with one moment changed. */
const changedMoments = (change: (moment: WireMoment, index: number) => WireMoment) => (request: { method: string; path: string }): PlayerAnswer | undefined => {
  if (request.method !== 'GET' || !request.path.endsWith(`/versions/${PLAYER_IDS.v1}/moments`)) return undefined;
  return { status: 200, body: { ...MOMENTS_BODY, moments: MOMENTS_BODY.moments.map(change) } };
};
const longMoments = changedMoments((moment, index) => (index === 0 ? { ...moment, text: LONG } : moment));

async function mount(language: 'ar' | 'en', options: { width?: number; height?: number; fontScale?: number; long?: boolean; omitBefore?: number } = {}) {
  Object.assign(windowSize, { width: options.width ?? 390, height: options.height ?? 844, fontScale: options.fontScale ?? 1 });
  const omitted = options.omitBefore;
  const server = playerServer(options.long === true ? { intercept: longMoments }
    : omitted !== undefined ? { intercept: changedMoments((moment, index) => (index === omitted - 1 ? { ...moment, omittedBefore: 2 } : moment)) } : {});
  const scheduler: ReplayPlayerScheduler = { set: () => 0, clear: () => undefined };
  const player = createReplayPlayerController({
    sessionId: PLAYER_IDS.session, ...playerClients(server), isCurrent: () => true, newCommandId: capturedIds('preview'), scheduler,
  });
  const view = await render(<AppearanceProvider authority={appearance()}><ReplayPlayer controller={player} language={language} insets={INSETS} /></AppearanceProvider>);
  await act(async () => player.openSaved(capturedHandoff('draft')));
  await flush();
  await resize(view, windowSize.width, windowSize.height, { insetTop: INSETS.top, insetBottom: INSETS.bottom });
  await flush();
  return { view, player, server };
}

const ALL = { includeHiddenElements: true } as const;
const within = (view: RenderResult, ancestor: string, testID: string) => inside(view.getByTestId(ancestor, ALL)).queryAllByTestId(testID, ALL).length > 0;
/** The test ids of a subtree, in reading (tree) order. */
const order = (view: RenderResult, ancestor: string, ids: readonly string[]) =>
  nodes(view.toJSON()).map((node) => (node.props as { testID?: string }).testID).filter((id): id is string => id !== undefined && (ids.includes(id) || id === ancestor))
    .slice(1);

afterEach(async () => {
  await cleanup();
});

describe('S7-04 visual direction — CHROME_ONLY, the moment controls in the measured band', () => {
  it('composes no Timeline: nothing in the temporal slot, and the chrome band is measured', async () => {
    const { view } = await mount('ar');
    expect(view.queryAllByTestId(RESPONSIVE_TIMELINE_ROW_TEST_ID)).toHaveLength(0);
    expect(view.queryByTestId('qandeel-temporal-orientation-line')).toBeNull();
    // CHROME_ONLY is the only plan that measures its chrome.
    expect(typeof view.getByTestId(RESPONSIVE_CHROME_MEASURE_TEST_ID).props.onLayout).toBe('function');
  });

  it('the transport and the pace stand inside the moment’s band, beside its position, which is said once', async () => {
    const { view } = await mount('ar');
    for (const id of ['qandeel-replay-moment-controls', 'qandeel-replay-transport', 'qandeel-replay-pacing', 'qandeel-replay-position', 'qandeel-replay-text', 'qandeel-replay-spatial']) {
      expect(within(view, RESPONSIVE_CHROME_BAND_TEST_ID, id)).toBe(true);
    }
    expect(within(view, 'qandeel-replay-moment-controls', 'qandeel-replay-transport')).toBe(true);
    expect(within(view, 'qandeel-replay-moment-controls', 'qandeel-replay-position')).toBe(true);
    expect(view.queryAllByTestId('qandeel-replay-position')).toHaveLength(1);
    // The controls carry no words of their own on screen: no count is repeated beside the position.
    expect(inside(view.getByTestId('qandeel-replay-transport')).queryAllByText(/./u, ALL)).toHaveLength(0);
    // Read in order: the moments (play and the Spine), where the reader is among them, then the message.
    expect(order(view, RESPONSIVE_CHROME_BAND_TEST_ID, ['qandeel-replay-position', 'qandeel-replay-transport', 'qandeel-replay-source']))
      .toEqual(['qandeel-replay-transport', 'qandeel-replay-position', 'qandeel-replay-source']);
  });

  it.each([
    ['a small phone', 320, 568, 1],
    ['a phone', 390, 844, 1],
    ['a phone, larger text', 390, 844, 1.3],
    ['a phone, the largest text', 390, 844, 2],
    ['a tablet', 768, 1024, 1],
  ])('%s (%i × %i, text × %d): the band is exactly what the moment measures, capped; the world takes the rest', async (_name, width, height, fontScale) => {
    const { view } = await mount('ar', { width, height, fontScale });
    const cap = style(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID)).height as number;
    // A moment that fits: the band is its measured height (whole points), nothing held beyond it and nothing cut.
    const fits = Math.max(INSETS.bottom, Math.min(cap - 20, 240.4));
    await measure(view, fits);
    const band = style(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID));
    expect(band.height).toBe(Math.ceil(fits));
    expect(style(view.getByTestId(RESPONSIVE_CHROME_BAND_TEST_ID)).height).toBe(Math.ceil(fits));
    expect(style(view.getByTestId(RESPONSIVE_MAP_FRAME_TEST_ID)).maxHeight).toBe(height - Math.ceil(fits) - (band.marginTop as number));
    // A moment taller than the room: the band stops at the cap every world has, the world keeps its half, and the rest
    // of the moment stays mounted and reachable in the band's scroller — no sentence is removed or given a line limit.
    await measure(view, 4000);
    expect(style(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID)).height).toBe(cap);
    for (const id of ['qandeel-replay-text', 'qandeel-replay-temporal', 'qandeel-replay-spatial', 'qandeel-replay-pacing', 'qandeel-replay-position', 'qandeel-replay-transport']) {
      // Inside the band's scroller content (what the band measures), with no line limit.
      expect(within(view, RESPONSIVE_CHROME_MEASURE_TEST_ID, id)).toBe(true);
      expect(view.getByTestId(id).props.numberOfLines).toBeUndefined();
    }
  });

  it('a long historical message is shown whole: every character, no line limit, in the measured band', async () => {
    const { view, server } = await mount('ar', { long: true });
    expect(server.uncaptured).toEqual([]);
    const node = view.getByTestId('qandeel-replay-text');
    expect(node.props.children).toBe(LONG);
    expect(node.props.numberOfLines).toBeUndefined();
    expect(within(view, RESPONSIVE_CHROME_BAND_TEST_ID, 'qandeel-replay-text')).toBe(true);
  });

  it('the sentence «المعروض الآن: العالم كله.» is in the band, whole', async () => {
    const { view } = await mount('ar');
    expect(view.getByTestId('qandeel-replay-spatial').props.children).toBe('المعروض الآن: العالم كله.');
    expect(view.getByTestId('qandeel-replay-spatial').props.numberOfLines).toBeUndefined();
  });
});

describe('S7-04 review — the controls stay in place while a long message scrolls (Product Owner review, 2026-10-20)', () => {
  /** What the platform reports: the rect the composite fills (the surface's own) and the controls' natural height. */
  const settle = async (view: RenderResult, held: number) => {
    await act(async () => {
      fireEvent(view.getByTestId(REPLAY_COMPOSITE_TEST_ID), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: windowSize.width, height: windowSize.height } } });
    });
    await act(async () => {
      fireEvent(view.getByTestId('qandeel-replay-moment-controls'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: windowSize.width, height: held } } });
    });
    await flush();
  };

  it.each([
    ['ar', 1, 70], ['ar', 1.3, 80], ['ar', 2, 115],
    ['en', 1, 70], ['en', 1.3, 85], ['en', 2, 120],
  ] as const)('%s, text × %d: the controls stand outside the reading, and the reading is bounded so the band never scrolls them away', async (language, fontScale, held) => {
    const { view } = await mount(language, { fontScale, long: true });
    await settle(view, held);
    // The controls (play, the Spine) and where the reader is are NOT inside the scrolling reading; the pace's
    // declaration and the message are.
    for (const id of ['qandeel-replay-transport', 'qandeel-replay-play', REPLAY_SPINE_TEST_ID, 'qandeel-replay-position']) {
      expect(within(view, 'qandeel-replay-moment-controls', id)).toBe(true);
      expect(within(view, 'qandeel-replay-moment-reading', id)).toBe(false);
    }
    for (const id of ['qandeel-replay-pacing', 'qandeel-replay-source', 'qandeel-replay-text', 'qandeel-replay-temporal', 'qandeel-replay-spatial']) {
      expect(within(view, 'qandeel-replay-moment-reading', id)).toBe(true);
      expect(within(view, 'qandeel-replay-moment-controls', id)).toBe(false);
    }
    // The long message is whole: every character, no line limit.
    expect(view.getByTestId('qandeel-replay-text').props.children).toBe(LONG);
    expect(view.getByTestId('qandeel-replay-text').props.numberOfLines).toBeUndefined();
    // The band's cap is T-11's own (the band's height when the chrome asks for more than it has).
    await measure(view, 4000);
    const cap = style(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID)).height as number;
    const reading = view.getByTestId('qandeel-replay-moment-reading');
    const bound = style(reading).maxHeight as number;
    expect(bound).toBe(Math.floor(cap - (10 + INSETS.bottom + 10) - held - 2) - 1);
    // Bounded, never the fallback: the reading keeps at least one touch target's height to be scrolled by a finger.
    expect(bound).toBeGreaterThanOrEqual(44);
    // So everything the band holds — its padding, the controls, the gap and the bounded reading — fits under the cap:
    // the band's own scroller has nothing to scroll, and the controls cannot leave the screen.
    expect(10 + held + 2 + bound + 10 + INSETS.bottom).toBeLessThanOrEqual(cap);
    expect(style(reading).flexGrow).toBe(0);
    expect(reading.props.nestedScrollEnabled).toBe(true);
  });

  it('a different moment is read from its start: the reading returns to its top at once, with no motion', async () => {
    const { view } = await mount('ar', { fontScale: 2, long: true });
    await settle(view, 115);
    const scrolled = jest.spyOn(ScrollView.prototype, 'scrollTo');
    try {
      await act(async () => { fireEvent(view.getByTestId(REPLAY_SPINE_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }); });
      await flush();
      expect(view.getByTestId(REPLAY_SPINE_TEST_ID).props.accessibilityValue).toMatchObject({ now: 2 });
      expect(scrolled).toHaveBeenCalledWith({ y: 0, animated: false });
      expect(scrolled.mock.calls.every(([to]) => (to as { animated?: boolean }).animated === false)).toBe(true);
    } finally {
      scrolled.mockRestore();
    }
  });

  it('a short moment is not given room it does not need: the reading is bounded, never sized, so no space is held', async () => {
    const { view } = await mount('ar');
    await settle(view, 120);
    const reading = style(view.getByTestId('qandeel-replay-moment-reading'));
    expect(reading.height).toBeUndefined();
    expect(reading.minHeight).toBeUndefined();
    expect(typeof reading.maxHeight).toBe('number');
  });

  it('controls that alone need nearly the whole band leave the reading unbounded, and the band’s own scroller reaches all of it', async () => {
    const { view } = await mount('ar', { fontScale: 2, long: true });
    await settle(view, 2000);
    expect(style(view.getByTestId('qandeel-replay-moment-reading')).maxHeight).toBeUndefined();
    expect(within(view, RESPONSIVE_CHROME_MEASURE_TEST_ID, 'qandeel-replay-text')).toBe(true);
  });

  it('the S7-03 composite without controls is composed exactly as before: no reading scroller, nothing measured', async () => {
    const scene = replayScene('main');
    const controller = createReplayCompositeController(replayWireClient(scene), scene.replayId, scene.versionId);
    Object.assign(windowSize, { width: 400, height: 800, fontScale: 2 });
    const view = await render(<AppearanceProvider authority={appearance()}><ReplayMomentComposite controller={controller} ordinal={1} language="ar" insets={INSETS} /></AppearanceProvider>);
    await flush();
    await resize(view, 400, 800);
    await flush();
    expect(view.getByTestId(REPLAY_COMPOSITE_TEST_ID).props.onLayout).toBeUndefined();
    expect(view.queryByTestId('qandeel-replay-moment-reading', ALL)).toBeNull();
    expect(view.queryByTestId('qandeel-replay-moment-controls', ALL)).toBeNull();
    // The moment's parts are the band's own children, in S7-03's order.
    expect(order(view, 'qandeel-replay-moment', ['qandeel-replay-position', 'qandeel-replay-source', 'qandeel-replay-temporal']))
      .toEqual(['qandeel-replay-position', 'qandeel-replay-source', 'qandeel-replay-temporal']);
    expect(within(view, RESPONSIVE_CHROME_MEASURE_TEST_ID, 'qandeel-replay-text')).toBe(true);
  });
});

describe('S7-04 — the Replay Temporal Spine: P2’s Spine + Aperture C "Parting" over the version’s moments', () => {
  const VIEWPORT = 300;
  const lay = (view: RenderResult) => act(async () => {
    fireEvent(view.getByTestId(REPLAY_SPINE_TEST_ID), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: VIEWPORT, height: 44 } } });
  });
  /** The physical x of a moment's centre on the strip (position 1 … n), in the reading direction. */
  const xOf = (position: number, rtl: boolean) => (rtl ? VIEWPORT - ((position - 1) * 48 + 24) : (position - 1) * 48 + 24);
  const touch = (x: number) => act(async () => {
    fireGestureHandler(getByGestureTestId(REPLAY_SPINE_GESTURE_TEST_ID), [{ state: State.BEGAN, x }, { state: State.ACTIVE, x }, { state: State.END, x }]);
  });

  it('draws VPORT-02’s own Spine: one notch per moment at T-05’s 48-point step, the committed parting, no Live', async () => {
    const { view } = await mount('ar');
    await lay(view);
    expect(within(view, REPLAY_SPINE_TEST_ID, `${REPLAY_SPINE_TEST_ID}-line`)).toBe(true);
    // The committed moment's notch is replaced by its aperture; every other moment rests as a notch, 48 points apart.
    const notches = [2, 3, 4, 5, 6].map((sp) => view.getByTestId(`${REPLAY_SPINE_TEST_ID}-line:sp-${sp}`, ALL));
    const starts = notches.map((notch) => style(notch).start as number);
    expect(starts.slice(1).map((start, i) => start - starts[i])).toEqual([48, 48, 48, 48]);
    expect(view.queryByTestId(`${REPLAY_SPINE_TEST_ID}-line:sp-1`, ALL)).toBeNull();
    // Aperture C: the committed parting, and the preview parting, present only while a touch previews (at rest, unseen).
    expect(within(view, `${REPLAY_SPINE_TEST_ID}-committed`, `${REPLAY_SPINE_TEST_ID}-committed-aperture`)).toBe(true);
    expect(within(view, `${REPLAY_SPINE_TEST_ID}-preview`, `${REPLAY_SPINE_TEST_ID}-preview-aperture`)).toBe(true);
    expect(style(view.getByTestId(`${REPLAY_SPINE_TEST_ID}-committed`, ALL)).opacity).toBe(1);
    expect(style(view.getByTestId(`${REPLAY_SPINE_TEST_ID}-preview`, ALL)).opacity).toBe(0);
    // No Live Head, no Live terminal, no Return Live: none of the live Timeline is mounted.
    for (const id of [TEMPORAL_LIVE_TERMINAL_TEST_ID, TEMPORAL_LIVE_EDGE_TEST_ID, TEMPORAL_TARGET_LAYER_TEST_ID]) expect(view.queryByTestId(id, ALL)).toBeNull();
  });

  it.each([['ar', true], ['en', false]] as const)('%s: a completed touch on a moment commits THAT moment (its ordinal → its TC → its analysis)', async (language, rtl) => {
    const { view } = await mount(language);
    await lay(view);
    expect(style(view.getByTestId(REPLAY_SPINE_TEST_ID)).direction).toBe(rtl ? 'rtl' : 'ltr');
    await touch(xOf(3, rtl));
    await flush();
    expect(view.getByTestId('qandeel-replay-text').props.children).toBe(MOMENT_TEXTS[2]);
    expect(view.getByTestId(REPLAY_SPINE_TEST_ID).props.accessibilityValue).toMatchObject({ now: 3 });
    // The first and the last moment, at the strip's two ends in the reading direction.
    await touch(xOf(6, rtl));
    await flush();
    expect(view.getByTestId('qandeel-replay-text').props.children).toBe(MOMENT_TEXTS[5]);
    await touch(xOf(1, rtl));
    await flush();
    expect(view.getByTestId('qandeel-replay-text').props.children).toBe(MOMENT_TEXTS[0]);
  });

  it.each([['ar', true], ['en', false]] as const)('%s: a TAP on a notch (a touch that never becomes a drag) commits that moment', async (language, rtl) => {
    const { view } = await mount(language);
    await lay(view);
    const x = xOf(4, rtl);
    await act(async () => {
      // The drag begins the touch and fails when the finger lifts unmoved; the tap completes it.
      fireGestureHandler(getByGestureTestId(REPLAY_SPINE_GESTURE_TEST_ID), [{ state: State.BEGAN, x }, { state: State.FAILED, x }]);
      fireGestureHandler(getByGestureTestId(REPLAY_SPINE_TAP_TEST_ID), [{ state: State.BEGAN, x }, { state: State.ACTIVE, x }, { state: State.END, x }]);
    });
    await flush();
    expect(view.getByTestId('qandeel-replay-text').props.children).toBe(MOMENT_TEXTS[3]);
  });

  it('a touch both recognisers lose (neither a tap nor a drag) commits nothing; the loser of a race never cancels the winner', async () => {
    const { view } = await mount('ar');
    await lay(view);
    const x = xOf(5, true);
    await act(async () => {
      fireGestureHandler(getByGestureTestId(REPLAY_SPINE_GESTURE_TEST_ID), [{ state: State.BEGAN, x }, { state: State.FAILED, x }]);
      fireGestureHandler(getByGestureTestId(REPLAY_SPINE_TAP_TEST_ID), [{ state: State.BEGAN, x }, { state: State.FAILED, x }]);
    });
    await flush();
    expect(view.getByTestId('qandeel-replay-text').props.children).toBe(MOMENT_TEXTS[0]);
    // A drag that wins after the tap was cancelled still commits where it lifted.
    const to = xOf(2, true);
    await act(async () => {
      fireGestureHandler(getByGestureTestId(REPLAY_SPINE_TAP_TEST_ID), [{ state: State.BEGAN, x: to }, { state: State.CANCELLED, x: to }]);
      fireGestureHandler(getByGestureTestId(REPLAY_SPINE_GESTURE_TEST_ID), [{ state: State.BEGAN, x: to }, { state: State.ACTIVE, x: to }, { state: State.END, x: to }]);
    });
    await flush();
    expect(view.getByTestId('qandeel-replay-text').props.children).toBe(MOMENT_TEXTS[1]);
  });

  it('a release past the last moment commits nothing (a lossless cancel)', async () => {
    const { view } = await mount('ar');
    await lay(view);
    await touch(xOf(2, true));
    await flush();
    await touch(4); // beyond the sixth moment, at the END edge
    await flush();
    expect(view.getByTestId('qandeel-replay-text').props.children).toBe(MOMENT_TEXTS[1]);
  });

  it('the committed marker rests on its moment, mirrored as layout in RTL (T-06’s one rule)', async () => {
    const ar = await mount('ar');
    await lay(ar.view);
    const translate = (view: RenderResult) => ((style(view.getByTestId(`${REPLAY_SPINE_TEST_ID}-committed`, ALL)).transform as Record<string, number>[])[0]).translateX;
    expect(translate(ar.view)).toBe(restingMarkerX(24, VIEWPORT, true));
    await cleanup();
    const en = await mount('en');
    await lay(en.view);
    expect(translate(en.view)).toBe(restingMarkerX(24, VIEWPORT, false));
  });

  it('a touch only previews: the preview parting appears, and a late or older callback can never reopen or commit', () => {
    const touches = createSpineTouches();
    const previews: (number | null)[] = [];
    const commits: number[] = [];
    touches.bind({ moments: [{ ordinal: 1 }, { ordinal: 2 }, { ordinal: 3 }],
      onCommit: (ordinal) => commits.push(ordinal), setPreview: (p) => previews.push(p), acknowledgeCommit: () => undefined, acknowledgeCancel: () => undefined });
    touches.target(1, 1);
    expect(previews).toEqual([2]);
    expect(commits).toEqual([]);
    touches.settle(1, true, 2);
    expect(commits).toEqual([3]);
    // Late: a crossing of the settled touch, and anything of an older one.
    touches.target(1, 0);
    touches.settle(0, true, 0);
    expect(previews).toEqual([2, null]);
    expect(commits).toEqual([3]);
    // A cancelled touch commits nothing.
    touches.target(2, 0);
    touches.settle(2, false, 0);
    expect(commits).toEqual([3]);
  });

  it('omitted messages are said in words by S7-03’s historical disclosure — the Spine draws no P2 discontinuity points', async () => {
    const cut = await mount('ar', { omitBefore: 4 });
    await lay(cut.view);
    // P2's three points keep their one meaning (the window continues toward the live edge): none on a Replay, and the
    // hairline is not parted — the notches stay 48 points apart across the omission.
    const dots = (view: RenderResult) => nodes(view.toJSON()).filter((node) => /discontinuity/u.test(String((node.props as { testID?: string }).testID ?? '')));
    expect(dots(cut.view)).toHaveLength(0);
    const starts = [2, 3, 4, 5, 6].map((sp) => style(cut.view.getByTestId(`${REPLAY_SPINE_TEST_ID}-line:sp-${sp}`, ALL)).start as number);
    expect(starts.slice(1).map((start, i) => start - starts[i])).toEqual([48, 48, 48, 48]);
    // The Spine holds no dot-sized mark of its own: its children are VPORT-02's two layers and T-06's two markers.
    expect(inside(cut.view.getByTestId(REPLAY_SPINE_TEST_ID)).queryAllByTestId(/^qandeel-replay-spine-(?!line|target|committed|preview)/u, ALL)).toHaveLength(0);
    // Where the omission is, the composite says it in its own approved sentence, in the moment's reading.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => { fireEvent(cut.view.getByTestId(REPLAY_SPINE_TEST_ID), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }); });
      await flush();
    }
    expect(cut.view.getByTestId(REPLAY_SPINE_TEST_ID).props.accessibilityValue).toMatchObject({ now: 4 });
    const gap = cut.view.getByTestId('qandeel-replay-gap');
    expect(gap.props.accessibilityLabel).toBe(replayCompositeCopy('ar').gap(replayEntryCopy('ar').count(2)));
    expect(within(cut.view, 'qandeel-replay-moment-reading', 'qandeel-replay-gap')).toBe(true);
    expect(dots(cut.view)).toHaveLength(0);
  });

  it('a long version keeps T-05’s step: the window jumps a page at a time to keep the committed moment in view', () => {
    expect(replaySpineOffset(1, 6, 300)).toBe(0);
    expect(replaySpineOffset(6, 6, 300)).toBe(0);
    // 20 moments in 300 points: 6 fit; the seventh is on the second page; the last page ends at the last moment.
    expect(replaySpineOffset(6, 20, 300)).toBe(0);
    expect(replaySpineOffset(7, 20, 300)).toBe(6 * 48);
    expect(replaySpineOffset(20, 20, 300)).toBe(20 * 48 - 300);
  });

  it('play and pause are P2’s own solid media marks; they differ in form, never mirror, and carry their names', async () => {
    expect(CANONICAL_VISUAL.glyphs.play.fills).toHaveLength(1);
    expect(CANONICAL_VISUAL.glyphs.play.mirrorsInRtl).toBe(false);
    expect(CANONICAL_VISUAL.glyphs.pause.mirrorsInRtl).toBe(false);
    expect(CANONICAL_VISUAL.glyphs.pause.rects).toHaveLength(2);
    const { view, player } = await mount('ar');
    const play = view.getByTestId('qandeel-replay-play');
    expect(style(play).width).toBe(44);
    expect(style(play).minHeight).toBe(44);
    expect(within(view, 'qandeel-replay-play', 'qandeel-glyph-play')).toBe(true);
    await act(async () => player.play());
    await flush();
    expect(within(view, 'qandeel-replay-play', 'qandeel-glyph-pause')).toBe(true);
    expect(view.getByTestId('qandeel-replay-play').props.accessibilityLabel).toBe('إيقاف مؤقت');
    expect(style(view.getByTestId('qandeel-glyph-pause', ALL)).transform).toBeUndefined();
  });

  it('Reduced Motion: the same Spine, the same moment and the same routes; only the movement is cut', async () => {
    const normal = await mount('ar');
    await lay(normal.view);
    const before = normal.view.getByTestId(REPLAY_SPINE_TEST_ID).props.accessibilityValue;
    await cleanup();
    resetReduceMotionForTests();
    let emit: (enabled: boolean) => void = () => undefined;
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, handler: (enabled: boolean) => void) => {
      if (event === 'reduceMotionChanged') emit = handler;
      return { remove: () => undefined };
    }) as never);
    try {
      const reduced = await mount('ar');
      await act(async () => emit(true));
      await lay(reduced.view);
      expect(reduced.view.getByTestId(REPLAY_SPINE_TEST_ID).props.accessibilityValue).toEqual(before);
      await touch(xOf(2, true));
      await flush();
      expect(reduced.view.getByTestId('qandeel-replay-text').props.children).toBe(MOMENT_TEXTS[1]);
    } finally {
      resetReduceMotionForTests();
      jest.restoreAllMocks();
    }
  });
});
