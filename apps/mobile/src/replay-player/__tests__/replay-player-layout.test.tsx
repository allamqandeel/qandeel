/**
 * S7-04 — the player's layout under the Product Owner's visual direction (2026-10-20): option (b).
 *
 *   - the surface is composed CHROME_ONLY: no Timeline row, no Live Timeline, nothing in the temporal slot;
 *   - the moment controls stand in the moment's own header beside its position, inside the band the chrome MEASURES —
 *     so the band is what the moment needs and the world grows into the rest, with no fixed room held for nothing;
 *   - the transport is P2's own `play` / `pause` and the Replay's ONE timeline (S8B-07 CP2-A.1 correction round, "REPLAY
 *     UI FINAL CORRECTION", Product Owner, 2026-11-28, superseding the Temporal Spine of 2026-10-20): the whole part's
 *     time, P2's rest notches at the moment starts, no Live, no temporal authority;
 *   - F-4 (the same round): the moment's reading has a FIXED room, so no message, status or seek changes the band — and
 *     with it the world's frame.
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
import { TEMPORAL_LIVE_EDGE_TEST_ID, TEMPORAL_LIVE_TERMINAL_TEST_ID, TEMPORAL_TARGET_LAYER_TEST_ID } from '../../temporal-navigation';
import { REPLAY_COMPOSITE_TEST_ID, ReplayMomentComposite, createReplayCompositeController, replayCompositeCopy } from '../../replay-composite';
import { replayScene, replayWireClient } from '../../replay-composite/__fixtures__/replay-wire';
import { replayEntryCopy } from '../../replay-entry';
import { ReplayPlayer, createReplayPlayerController, type ReplayPlayerScheduler } from '..';
import { readingRoom } from '../../replay-composite/ReplayMomentComposite';
import { REPLAY_TIMELINE_INSET } from '../ReplayTimelineBar';
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

const TIMELINE = 'qandeel-replay-timeline-line';
const go = async (player: ReturnType<typeof createReplayPlayerController>, ordinal: number) => {
  await act(async () => { player.seek(ordinal); });
  await flush();
};

describe('S7-04 visual direction — CHROME_ONLY, the moment controls in the measured band', () => {
  it('composes no Timeline: nothing in the temporal slot, and the chrome band is measured', async () => {
    const { view } = await mount('ar');
    expect(view.queryAllByTestId(RESPONSIVE_TIMELINE_ROW_TEST_ID)).toHaveLength(0);
    expect(view.queryByTestId('qandeel-temporal-orientation-line')).toBeNull();
    // CHROME_ONLY is the only plan that measures its chrome.
    expect(typeof view.getByTestId(RESPONSIVE_CHROME_MEASURE_TEST_ID).props.onLayout).toBe('function');
  });

  it('the transport and its one timeline stand inside the moment’s band; no pace paragraph, position line or orientation sentences', async () => {
    const { view } = await mount('ar');
    for (const id of ['qandeel-replay-moment-controls', 'qandeel-replay-transport', TIMELINE, 'qandeel-replay-text']) {
      expect(within(view, RESPONSIVE_CHROME_BAND_TEST_ID, id)).toBe(true);
    }
    expect(within(view, 'qandeel-replay-moment-controls', 'qandeel-replay-transport')).toBe(true);
    // CP2-A.1 correction round: what the band no longer draws on the playing Replay.
    for (const id of ['qandeel-replay-pacing', 'qandeel-replay-position', 'qandeel-replay-temporal', 'qandeel-replay-spatial', 'qandeel-replay-spine']) {
      expect(view.queryByTestId(id, ALL)).toBeNull();
    }
    // The transport's only words on screen are its time (elapsed / total).
    const words = inside(view.getByTestId('qandeel-replay-transport')).queryAllByText(/./u, ALL).map((node) => node.props.children as string);
    expect(words).toHaveLength(1);
    expect(words[0]).toMatch(/^\d+:\d\d \/ \d+:\d\d$/u);
    // Read in order: the transport (play, the timeline), then the message.
    expect(order(view, RESPONSIVE_CHROME_BAND_TEST_ID, ['qandeel-replay-transport', 'qandeel-replay-source']))
      .toEqual(['qandeel-replay-transport', 'qandeel-replay-source']);
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
    for (const id of ['qandeel-replay-text', 'qandeel-replay-transport']) {
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
  ] as const)('%s, text × %d: the controls stand outside the reading, and the reading has its fixed room, never more than the band holds', async (language, fontScale, held) => {
    const { view } = await mount(language, { fontScale, long: true });
    await settle(view, held);
    // The controls (play, the timeline and its status line) are NOT inside the scrolling reading; the message is.
    for (const id of ['qandeel-replay-transport', 'qandeel-replay-play', TIMELINE, 'qandeel-replay-timeline-status']) {
      expect(within(view, 'qandeel-replay-moment-controls', id)).toBe(true);
      expect(within(view, 'qandeel-replay-moment-reading', id)).toBe(false);
    }
    for (const id of ['qandeel-replay-source', 'qandeel-replay-text']) {
      expect(within(view, 'qandeel-replay-moment-reading', id)).toBe(true);
      expect(within(view, 'qandeel-replay-moment-controls', id)).toBe(false);
    }
    // The long message is whole: every character, no line limit, scrolled inside its room.
    expect(view.getByTestId('qandeel-replay-text').props.children).toBe(LONG);
    expect(view.getByTestId('qandeel-replay-text').props.numberOfLines).toBeUndefined();
    // The band's cap is T-11's own (the band's height when the chrome asks for more than it has).
    await measure(view, 4000);
    const cap = style(view.getByTestId(RESPONSIVE_SUPPORT_BAND_TEST_ID)).height as number;
    const reading = view.getByTestId('qandeel-replay-moment-reading');
    const bound = Math.floor(cap - (10 + INSETS.bottom + 10) - held - 2) - 1;
    const room = style(reading).height as number;
    // F-4: the fixed room of one message card at this text size — or less, where the band cannot hold it.
    expect(room).toBe(Math.min(readingRoom(fontScale), bound));
    expect(style(reading).maxHeight).toBeUndefined();
    expect(room).toBeGreaterThanOrEqual(44);
    // So everything the band holds — its padding, the controls, the gap and the reading — fits under the cap: the band's
    // own scroller has nothing to scroll, and the controls cannot leave the screen.
    expect(10 + held + 2 + room + 10 + INSETS.bottom).toBeLessThanOrEqual(cap);
    expect(style(reading).flexGrow).toBe(0);
    expect(reading.props.nestedScrollEnabled).toBe(true);
  });

  it('a different moment is read from its start: the reading returns to its top at once, with no motion', async () => {
    const { view, player } = await mount('ar', { fontScale: 2, long: true });
    await settle(view, 115);
    const scrolled = jest.spyOn(ScrollView.prototype, 'scrollTo');
    try {
      await go(player, 2);
      expect(view.getByTestId(TIMELINE).props.accessibilityValue.text).toContain('في إعادة العرض: 2 من 6.');
      expect(scrolled).toHaveBeenCalledWith({ y: 0, animated: false });
      expect(scrolled.mock.calls.every(([to]) => (to as { animated?: boolean }).animated === false)).toBe(true);
    } finally {
      scrolled.mockRestore();
    }
  });

  it('F-4: a short moment and a long one hold the SAME room, so the band — and the world above it — never moves between moments', async () => {
    const { view, player } = await mount('ar', { long: true });
    await settle(view, 70);
    const rooms: unknown[] = [];
    const controls: unknown[] = [];
    for (const ordinal of [1, 2, 3, 4, 5, 6, 1]) {
      await go(player, ordinal);
      rooms.push(style(view.getByTestId('qandeel-replay-moment-reading')).height);
      controls.push(style(view.getByTestId('qandeel-replay-timeline-status')).height);
    }
    expect(new Set(rooms).size).toBe(1);
    expect(typeof rooms[0]).toBe('number');
    expect(new Set(controls).size).toBe(1);
    expect(style(view.getByTestId('qandeel-replay-moment-reading')).minHeight).toBeUndefined();
  });

  it('controls that alone need nearly the whole band keep the reading at its fixed room, and the band’s own scroller reaches all of it', async () => {
    const { view } = await mount('ar', { fontScale: 2, long: true });
    await settle(view, 2000);
    expect(style(view.getByTestId('qandeel-replay-moment-reading')).height).toBe(readingRoom(2));
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
    // The moment's parts are the band's own children, in S7-03's order — its orientation sentences included.
    expect(order(view, 'qandeel-replay-moment', ['qandeel-replay-position', 'qandeel-replay-source', 'qandeel-replay-temporal']))
      .toEqual(['qandeel-replay-position', 'qandeel-replay-source', 'qandeel-replay-temporal']);
    expect(view.getByTestId('qandeel-replay-spatial').props.children).toBe('المعروض الآن: العالم كله.');
    expect(within(view, RESPONSIVE_CHROME_MEASURE_TEST_ID, 'qandeel-replay-text')).toBe(true);
  });
});

describe('S8B-07 CP2-A.1 correction round — the Replay’s ONE timeline (Product Owner, 2026-11-28)', () => {
  const WIDTH = 300;
  const lay = (view: RenderResult) => act(async () => {
    fireEvent(view.getByTestId(TIMELINE), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 44 } } });
  });
  /** The physical x of a fraction of the line, from the reader's start. */
  const xOf = (fraction: number, rtl: boolean) => {
    const logical = REPLAY_TIMELINE_INSET + fraction * (WIDTH - 2 * REPLAY_TIMELINE_INSET);
    return rtl ? WIDTH - logical : logical;
  };
  const tap = (x: number) => act(async () => {
    fireGestureHandler(getByGestureTestId('qandeel-replay-timeline-tap'), [{ state: State.BEGAN, x }, { state: State.ACTIVE, x }, { state: State.END, x }]);
  });
  const total = (view: RenderResult) => (view.getByTestId(TIMELINE).props.accessibilityValue.max as number) * 1000;

  it('one line, a compact thumb on its axis, the elapsed part from the reader’s start, a notch at each later moment, no Live', async () => {
    const { view } = await mount('ar');
    await lay(view);
    expect(view.queryAllByTestId(TIMELINE)).toHaveLength(1);
    const thumb = style(view.getByTestId('qandeel-replay-timeline-thumb', ALL));
    expect(thumb.width).toBe(12);
    expect(thumb.height).toBe(12);
    expect(thumb.borderRadius).toBe(6);
    // Vertically centred on the 44 pt line, as the track is.
    const track = style(view.getByTestId('qandeel-replay-timeline-track', ALL));
    expect((thumb.top as number) + 6).toBe((track.top as number) + (track.height as number) / 2);
    // Elapsed and remaining differ in ink and weight.
    const elapsed = style(view.getByTestId('qandeel-replay-timeline-elapsed', ALL));
    expect(elapsed.backgroundColor).not.toBe(track.backgroundColor);
    expect(track.opacity).toBeLessThan(1);
    expect(elapsed.right).toBe(REPLAY_TIMELINE_INSET);
    expect(view.queryAllByTestId(/^qandeel-replay-timeline-mark-/u, ALL)).toHaveLength(5);
    for (const id of [TEMPORAL_LIVE_TERMINAL_TEST_ID, TEMPORAL_LIVE_EDGE_TEST_ID, TEMPORAL_TARGET_LAYER_TEST_ID]) expect(view.queryByTestId(id, ALL)).toBeNull();
  });

  it.each([['ar', true], ['en', false]] as const)('%s: a tap places the Replay at that time — forward, then back — before the first Play', async (language, rtl) => {
    const { view, player } = await mount(language);
    await lay(view);
    const length = total(view);
    await tap(xOf(0.97, rtl));
    await flush();
    expect(view.getByTestId('qandeel-replay-text').props.children).toBe(MOMENT_TEXTS[5]);
    expect(view.getByTestId(TIMELINE).props.accessibilityValue.now).toBeGreaterThanOrEqual(Math.floor((0.97 * length) / 1000) - 1);
    await tap(xOf(0.01, rtl));
    await flush();
    expect(view.getByTestId('qandeel-replay-text').props.children).toBe(MOMENT_TEXTS[0]);
    expect(player.getState().open?.playing).toBe(false);
  });

  it('a drag previews, a cancelled drag is lossless, and a completed one lands where it lifted', async () => {
    const { view } = await mount('en');
    await lay(view);
    const x = xOf(0.5, false);
    await act(async () => {
      fireGestureHandler(getByGestureTestId('qandeel-replay-timeline-drag'), [{ state: State.BEGAN, x }, { state: State.ACTIVE, x }, { state: State.CANCELLED, x }]);
    });
    await flush();
    expect(view.getByTestId('qandeel-replay-text').props.children).toBe(MOMENT_TEXTS[0]);
    expect(style(view.getByTestId('qandeel-replay-timeline-thumb', ALL)).width).toBe(12);
    const to = xOf(0.99, false);
    await act(async () => {
      fireGestureHandler(getByGestureTestId('qandeel-replay-timeline-drag'), [{ state: State.BEGAN, x: to }, { state: State.ACTIVE, x: to }, { state: State.END, x: to }]);
    });
    await flush();
    expect(view.getByTestId('qandeel-replay-text').props.children).toBe(MOMENT_TEXTS[5]);
  });

  it('the time box keeps one width while the time runs, so the line never changes length', async () => {
    const { view, player } = await mount('en');
    const box = () => style(view.getByTestId('qandeel-replay-timeline-time', ALL).parent!).width;
    const before = box();
    await go(player, 6);
    expect(box()).toBe(before);
  });

  it('omitted messages are said in words by S7-03’s historical disclosure — the timeline draws no P2 discontinuity points', async () => {
    const cut = await mount('ar', { omitBefore: 4 });
    const dots = (view: RenderResult) => nodes(view.toJSON()).filter((node) => /discontinuity/u.test(String((node.props as { testID?: string }).testID ?? '')));
    expect(dots(cut.view)).toHaveLength(0);
    await go(cut.player, 4);
    const gap = cut.view.getByTestId('qandeel-replay-gap');
    expect(gap.props.accessibilityLabel).toBe(replayCompositeCopy('ar').gap(replayEntryCopy('ar').count(2)));
    expect(within(cut.view, 'qandeel-replay-moment-reading', 'qandeel-replay-gap')).toBe(true);
    expect(dots(cut.view)).toHaveLength(0);
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

  it('Reduced Motion: the same timeline, the same moment and the same routes; the timeline has no motion to cut', async () => {
    const normal = await mount('ar');
    await lay(normal.view);
    const before = normal.view.getByTestId(TIMELINE).props.accessibilityValue;
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
      expect(reduced.view.getByTestId(TIMELINE).props.accessibilityValue).toEqual(before);
      await tap(xOf(0.97, true));
      await flush();
      expect(reduced.view.getByTestId('qandeel-replay-text').props.children).toBe(MOMENT_TEXTS[5]);
    } finally {
      resetReduceMotionForTests();
      jest.restoreAllMocks();
    }
  });
});
