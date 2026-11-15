/**
 * COSMOS-INT-01 Slice C — the accepted bottom rail over the production temporal authorities (Contract v1.3 §14 C-1 /
 * C-2 / C-9, §15.3 A). The store, the preview controller and the presentation controller are the REAL ones; what is
 * proven is that the rail shows exactly the disclosed Moments, reaches T-06's one commit boundary, keeps T-05 as the ONE
 * window authority for a long conversation, places its markers by T-06's one rule in both directions, and keeps the
 * non-drag navigators mounted while none of their text is on the screen.
 */
import { act, cleanup, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { View } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { analysisCopy } from '../../../analysis-language';
import { temporalOrientationLine } from '../../../orientation-chrome';
import { sessionPosition } from '../../../state';
import { commitMoment, createTemporalPreviewController, temporalTargeting, type TemporalOutcome } from '../../../temporal-navigation';
import { temporalTestStore, trackOf } from '../../../temporal-navigation/__fixtures__/temporal';
import { TIMELINE_STEP, createPresentationController } from '../../../timeline';
import {
  COSMOS_RAIL_ACTS_ROW_TEST_ID,
  COSMOS_RAIL_COMMITTED_TEST_ID,
  COSMOS_RAIL_EARLIER_TEST_ID,
  COSMOS_RAIL_HEADLESS_TEST_ID,
  COSMOS_RAIL_LABEL_TEST_ID,
  COSMOS_RAIL_LATER_TEST_ID,
  COSMOS_RAIL_LIVE_TEST_ID,
  COSMOS_RAIL_MOMENT_TEST_ID_PREFIX,
  COSMOS_RAIL_PREVIEW_TEST_ID,
  COSMOS_RAIL_SEGMENTS_TEST_ID,
  COSMOS_TIMELINE_RAIL_TEST_ID,
  CosmosTimelineRail,
  RAIL_MIN_PITCH,
  RAIL_SCRUB_GESTURE_TEST_ID,
  railSegmentAt,
  railWindow,
} from '..';

const WIDTH = 240;

const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter((entry) => entry !== null && typeof entry === 'object')) as Record<string, unknown>;
const translateX = (style: unknown): number | undefined =>
  (flat(style).transform as readonly Record<string, number>[] | undefined)?.find((entry) => 'translateX' in entry)?.translateX;

function harness(liveHead: number, language: 'ar' | 'en' = 'en', acts: React.ReactNode = null) {
  const store = temporalTestStore({ liveHead });
  const preview = createTemporalPreviewController();
  const presentation = createPresentationController(trackOf('session-1', liveHead));
  const outcomes: TemporalOutcome[] = [];
  // A fresh element each time: React bails out of a rerender whose element is the very same object.
  const element = () => <CosmosTimelineRail store={store} preview={preview} presentation={presentation} language={language} acts={acts} onOutcome={(outcome) => outcomes.push(outcome)} />;
  return { store, preview, presentation, outcomes, language, element };
}
type Harness = ReturnType<typeof harness>;

async function mount(h: Harness, width = WIDTH): Promise<RenderResult> {
  const view = await render(h.element());
  await fireEvent(view.getByTestId(COSMOS_RAIL_SEGMENTS_TEST_ID), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height: 44 } } });
  return view;
}
/**
 * T-06's motion writes the marker's target into a shared value in an effect and the animated style reads it on the UI
 * runtime; the test mock evaluates the style at render, so one more render shows what the device shows at once.
 */
const settled = async (view: RenderResult, h: Harness) => { await view.rerender(h.element()); };
const moments = (view: RenderResult) => view.queryAllByTestId(new RegExp(`^${COSMOS_RAIL_MOMENT_TEST_ID_PREFIX}`, 'u')).map((node) => Number((node.props.testID as string).slice(COSMOS_RAIL_MOMENT_TEST_ID_PREFIX.length)));
const press = async (view: RenderResult, testID: string) => { await fireEvent.press(view.getByTestId(testID)); };
/** The host tree without the headless navigators (a 1 × 1 clipped host): what is on the screen. */
const onScreen = (view: RenderResult): string => {
  const strip = (node: unknown): unknown => {
    if (node === null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(strip);
    const record = node as { props?: { testID?: string }; children?: unknown[] | null };
    if (record.props?.testID === COSMOS_RAIL_HEADLESS_TEST_ID) return null;
    return { ...record, children: (record.children ?? []).map(strip) };
  };
  return JSON.stringify(strip(view.toJSON()));
};

/** Every string the host tree draws (outside the headless host), in order: what a sighted reader reads. */
const drawnText = (view: RenderResult): string[] => {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') { out.push(node); return; }
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const record = node as { props?: { testID?: string }; children?: unknown[] | null };
    if (record.props?.testID === COSMOS_RAIL_HEADLESS_TEST_ID) return;
    (record.children ?? []).forEach(walk);
  };
  walk(view.toJSON());
  return out;
};

let view: RenderResult | null = null;
afterEach(async () => { await cleanup(); view = null; });

describe('the rail window (pure)', () => {
  it('shows every disclosed Moment while they fit, and windows at the minimum pitch', () => {
    expect(railWindow(0, 10, 0)).toEqual({ capacity: 0, shown: 0, start: 0, pitch: 0, windowed: false });
    expect(railWindow(WIDTH, 6, 0)).toEqual({ capacity: 30, shown: 6, start: 0, pitch: 40, windowed: false });
    expect(railWindow(WIDTH, 30, 0)).toMatchObject({ shown: 30, pitch: RAIL_MIN_PITCH, windowed: false });
    // A long conversation: the window start is T-05's offset in Track steps, clamped to the last full window.
    expect(railWindow(WIDTH, 100, 0)).toMatchObject({ capacity: 30, shown: 30, start: 0, windowed: true });
    expect(railWindow(WIDTH, 100, 40 * TIMELINE_STEP)).toMatchObject({ start: 40 });
    expect(railWindow(WIDTH, 100, 99 * TIMELINE_STEP)).toMatchObject({ start: 70 });
  });

  it('maps a finger to a segment in both directions and to nothing outside the rail', () => {
    expect(railSegmentAt(0, WIDTH, 40, 6, false)).toBe(0);
    expect(railSegmentAt(239, WIDTH, 40, 6, false)).toBe(5);
    expect(railSegmentAt(239, WIDTH, 40, 6, true)).toBe(0);
    expect(railSegmentAt(1, WIDTH, 40, 6, true)).toBe(5);
    expect(railSegmentAt(-1, WIDTH, 40, 6, false)).toBe(-1);
    expect(railSegmentAt(WIDTH, WIDTH, 40, 6, false)).toBe(-1);
    expect(railSegmentAt(10, 0, 0, 6, false)).toBe(-1);
    expect(railSegmentAt(Number.NaN, WIDTH, 40, 6, false)).toBe(-1);
  });
});

describe('CosmosTimelineRail — the disclosed Moments, T-06 commits, the Live edge', () => {
  it('shows one segment per DISCLOSED Moment, named with T-05 words, nothing beyond the disclosure horizon; following Live shows no committed dot', async () => {
    const h = harness(6);
    view = await mount(h);
    expect(moments(view)).toEqual([1, 2, 3, 4, 5, 6]);
    const copy = analysisCopy('en');
    expect(view.getByTestId(`${COSMOS_RAIL_MOMENT_TEST_ID_PREFIX}3`).props.accessibilityLabel).toBe(copy.timelinePoint(3));
    // The rail's capacity in Track steps is T-05's viewport: one window authority.
    expect(h.presentation.getSnapshot().viewport).toBe(30 * TIMELINE_STEP);
    expect(view.queryByTestId(COSMOS_RAIL_EARLIER_TEST_ID)).toBeNull();
    expect(view.queryByTestId(COSMOS_RAIL_LATER_TEST_ID)).toBeNull();
    // Following Live: the dot stands down, the Live words are quiet and selected.
    expect(flat(view.getByTestId(COSMOS_RAIL_COMMITTED_TEST_ID).props.style).opacity).toBe(0);
    const live = view.getByTestId(COSMOS_RAIL_LIVE_TEST_ID);
    expect(live.props.accessibilityLabel).toBe(copy.followingConversation);
    expect(live.props.accessibilityState).toMatchObject({ selected: true, disabled: false });
    // No text of the old Timeline presentation on the screen: no percentage of a view range (it stays in the headless host).
    expect(onScreen(view)).not.toContain('%');
    expect(JSON.stringify(view.toJSON())).toContain('%');
  });

  it('a pressed segment previews and commits through T-06 (one history step, PINNED), lights the dot at it and the Live words as the way back', async () => {
    const h = harness(6);
    view = await mount(h);
    await press(view, `${COSMOS_RAIL_MOMENT_TEST_ID_PREFIX}3`);
    await settled(view, h);
    expect(h.store.getState().temporal).toEqual({ kind: 'PINNED', at: sessionPosition(3) });
    expect(h.store.getState().history).toHaveLength(1);
    expect(h.preview.getSnapshot().status).not.toBe('PREVIEWING');
    expect(h.outcomes.map((o) => o.outcome)).toEqual(['APPLIED']);
    const committed = view.getByTestId(COSMOS_RAIL_COMMITTED_TEST_ID);
    expect(flat(committed.props.style).opacity).toBe(1);
    // T-06's one placement rule: the centre of the third 40-point segment, from the row's logical start.
    expect(translateX(committed.props.style)).toBe(2 * 40 + 20);
    expect(view.getByTestId(`${COSMOS_RAIL_MOMENT_TEST_ID_PREFIX}3`).props.accessibilityState).toMatchObject({ selected: true });
    const copy = analysisCopy('en');
    expect(view.getByTestId(COSMOS_RAIL_LIVE_TEST_ID).props.accessibilityLabel).toBe(copy.rejoinConversation);
    // The Live words: T-06's Live edge intent, back to FOLLOW_LIVE.
    await press(view, COSMOS_RAIL_LIVE_TEST_ID);
    expect(h.store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(h.outcomes.map((o) => o.outcome)).toEqual(['APPLIED', 'APPLIED']);
  });

  it('a preview held by the controller is the hollow ring; a pointer interaction that ends without a target of its own commits nothing and cancels only what it owns (T-06)', async () => {
    const h = harness(6);
    view = await mount(h);
    await act(async () => {
      expect(h.preview.preview(temporalTargeting(h.store.getState(), h.presentation.getSnapshot().track), sessionPosition(5), 'DISCLOSED_TARGET').outcome).toBe('PREVIEWING');
    });
    await settled(view, h);
    const ring = view.getByTestId(COSMOS_RAIL_PREVIEW_TEST_ID);
    expect(flat(ring.props.style).opacity).toBe(0.72);
    expect(translateX(ring.props.style)).toBe(4 * 40 + 20);
    // A pan that begins and fails (a competing recognizer), and one that begins and ends with no segment crossed: neither
    // commits anything, and neither reaches the preview another route owns — T-06's coordinator cancels ONLY its own.
    await act(async () => {
      fireGestureHandler(getByGestureTestId(RAIL_SCRUB_GESTURE_TEST_ID), [{ state: State.BEGAN, x: 100 }, { state: State.FAILED, x: 100 }]);
    });
    await act(async () => {
      fireGestureHandler(getByGestureTestId(RAIL_SCRUB_GESTURE_TEST_ID), [{ state: State.BEGAN, x: 100 }, { state: State.ACTIVE, x: 100 }, { state: State.END, x: 100 }]);
    });
    expect(h.preview.getSnapshot()).toMatchObject({ status: 'PREVIEWING', ptc: 5 });
    expect(h.store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(h.store.getState().history).toHaveLength(0);
    // The successful end with no target of its own failed closed, and said so.
    expect(h.outcomes.map((o) => o.outcome)).toEqual(['REJECTED']);
  });

  // COSMOS-INT-01 Slice C CONTROLLED RE-ANCHOR (Product Owner, 2026-11-15, Contract v1.4 §16 U-9 / A-6): the rail is laid
  // out identically in both languages — Moment 1 at the left, the Live edge at the right, the markers anchored at the
  // left and placed by T-06's one rule — and only the words are Arabic. Previous form: a row-reversed segment row, the
  // markers anchored at the right and T-06's rtl rule (`−logical`).
  it('Arabic: the same geometry as English (U-9) — the first Moment at the left, the markers anchored at the left and placed by the same rule; the words are Arabic', async () => {
    const h = harness(6, 'ar');
    view = await mount(h);
    expect(flat(view.getByTestId(COSMOS_RAIL_SEGMENTS_TEST_ID).props.style).flexDirection).toBe('row');
    await press(view, `${COSMOS_RAIL_MOMENT_TEST_ID_PREFIX}3`);
    await settled(view, h);
    const committed = view.getByTestId(COSMOS_RAIL_COMMITTED_TEST_ID);
    expect(flat(committed.props.style).left).toBe(0);
    expect(flat(committed.props.style).right).toBeUndefined();
    expect(translateX(committed.props.style)).toBe(2 * 40 + 20);
    expect(view.getByTestId(`${COSMOS_RAIL_MOMENT_TEST_ID_PREFIX}3`).props.accessibilityLabel).toBe(analysisCopy('ar').timelinePoint(3));
    expect(view.getByTestId(COSMOS_RAIL_LIVE_TEST_ID).props.accessibilityLabel).toBe(analysisCopy('ar').rejoinConversation);
  });

  // COSMOS-INT-01 Slice C (Product Owner, 2026-11-15, Contract v1.4 §16 U-6 / A-4 / A-5): the compact Moment label.
  it('§16 A-4: above the segments stands only T-05\'s word for the COMMITTED Moment ("Moment 3" / «اللحظة 3»), nothing while following Live, with T-08\'s sentence as its accessible label; no "Reading at" is drawn', async () => {
    for (const language of ['en', 'ar'] as const) {
      const h = harness(6, language);
      view = await mount(h);
      const copy = analysisCopy(language);
      // Following Live: no Moment is committed, so no number is invented — the Live words carry the state.
      expect(view.queryByTestId(COSMOS_RAIL_LABEL_TEST_ID)).toBeNull();
      await press(view, `${COSMOS_RAIL_MOMENT_TEST_ID_PREFIX}3`);
      await settled(view, h);
      const label = view.getByTestId(COSMOS_RAIL_LABEL_TEST_ID);
      expect(view.getByText(copy.timelinePoint(3))).toBeTruthy();
      expect(copy.timelinePoint(3)).toBe(language === 'ar' ? 'اللحظة 3' : 'Moment 3');
      // The accessible label is T-08's own temporal sentence for this very state (the one the retired line said): the
      // Moment, and that the conversation has continued since it.
      const sentence = temporalOrientationLine(h.store, language, null);
      expect(typeof sentence).toBe("string");
      expect(sentence).toContain(copy.atMoment(3));
      expect(view.getByLabelText(sentence as string)).toBeTruthy();
      expect(label).toBeTruthy();
      // Nothing explanatory is DRAWN (the sentence lives in the accessible label only): not the T-08 sentence, not a
      // prefix, not a trailing full stop.
      const drawn = JSON.stringify(drawnText(view));
      expect(drawn).toContain(copy.timelinePoint(3));
      expect(drawn).not.toContain(copy.atMoment(3));
      expect(drawn).not.toContain('Reading at');
      expect(drawn).not.toContain('القراءة عند');
      expect(drawn).not.toContain(`${copy.timelinePoint(3)}.`);
      // The label's text direction follows the language; the rail's geometry does not.
      const text = view.getByText(copy.timelinePoint(3));
      expect(flat(text.props.style)).toMatchObject(language === 'ar' ? { textAlign: 'right', writingDirection: 'rtl' } : { textAlign: 'left', writingDirection: 'ltr' });
      await act(async () => { view!.unmount(); });
    }
  });

  // COSMOS-INT-01 Slice C (Product Owner, 2026-11-15, Contract v1.4 §16 U-3 / A-3): the host's acts at the START of the words row.
  it('§16 A-3: the host\'s compact acts stand at the START of the words row and the Live words at its END; their own row stands ABOVE the label (§16.6: the rail grows upward only; nothing clipped)', async () => {
    const plain = harness(6);
    view = await mount(plain);
    const wordsRow = (v: RenderResult) => { let node = v.getByTestId(COSMOS_RAIL_LIVE_TEST_ID).parent; while (node !== null && flat(node.props.style).gap !== 6) node = node.parent; return node!; };
    const without = wordsRow(view);
    expect(without.children).toHaveLength(2);
    await act(async () => { view!.unmount(); });
    const h = harness(6, 'en', <View testID="host-acts" />);
    view = await mount(h);
    const row = wordsRow(view);
    expect(row.children).toHaveLength(2);
    expect(flat(row.props.style).flexDirection).toBe('row');
    const actsRow = view.getByTestId(COSMOS_RAIL_ACTS_ROW_TEST_ID);
    expect(actsRow.children[0]).toBe(view.getByTestId('host-acts'));
    const rail = view.getByTestId(COSMOS_TIMELINE_RAIL_TEST_ID);
    expect(rail.children[0]).toBe(actsRow);
    expect(flat(actsRow.props.style).overflow).toBeUndefined();
    expect(within(row).queryByTestId('host-acts')).toBeNull();
  });

  it('keeps T-06 and T-05 non-drag routes mounted and reachable, headless', async () => {
    const h = harness(6);
    view = await mount(h);
    const headless = view.getByTestId(COSMOS_RAIL_HEADLESS_TEST_ID);
    expect(flat(headless.props.style)).toMatchObject({ width: 1, height: 1, overflow: 'hidden' });
    expect(headless.props.accessibilityElementsHidden).not.toBe(true);
    expect(headless.props.importantForAccessibility).not.toBe('no-hide-descendants');
    expect(view.getByTestId('qandeel-temporal-navigator')).toBeTruthy();
    expect(view.getByTestId('timeline-command')).toBeTruthy();
    expect(view.getByTestId('timeline-position')).toBeTruthy();
  });
});

describe('a long conversation — T-05 is the one window authority (G-1)', () => {
  it('windows at the capacity, follows the committed Moment on mount, and the "…" marks page through T-05', async () => {
    const h = harness(100);
    view = await mount(h);
    // Live at SP100, 30 segments fit: the window follows the committed Moment, clamped to the last full window.
    expect(h.presentation.getSnapshot().viewport).toBe(30 * TIMELINE_STEP);
    expect(moments(view)).toEqual(Array.from({ length: 30 }, (_u, i) => 71 + i));
    const copy = analysisCopy('en');
    expect(view.getByTestId(COSMOS_RAIL_EARLIER_TEST_ID).props.accessibilityLabel).toBe(copy.trackContinues);
    expect(view.queryByTestId(COSMOS_RAIL_LATER_TEST_ID)).toBeNull();
    // Paging is T-05's own page: one viewport back. The committed Moment leaves the window and is NOT dragged back.
    await press(view, COSMOS_RAIL_EARLIER_TEST_ID);
    expect(h.presentation.getSnapshot().offset).toBe(70 * TIMELINE_STEP - 30 * TIMELINE_STEP);
    expect(moments(view)).toEqual(Array.from({ length: 30 }, (_u, i) => 41 + i));
    expect(view.getByTestId(COSMOS_RAIL_LATER_TEST_ID)).toBeTruthy();
    expect(h.store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    // A Moment in the paged window commits like any other; the window holds (it is already inside it).
    await press(view, `${COSMOS_RAIL_MOMENT_TEST_ID_PREFIX}45`);
    expect(h.store.getState().temporal).toEqual({ kind: 'PINNED', at: sessionPosition(45) });
    expect(moments(view)[0]).toBe(41);
  });

  it('a commit outside the window brings the window to it (centred), through T-05', async () => {
    const h = harness(100);
    view = await mount(h);
    await press(view, COSMOS_RAIL_EARLIER_TEST_ID);
    await press(view, COSMOS_RAIL_EARLIER_TEST_ID);
    expect(moments(view)[0]).toBe(11);
    await act(async () => {
      expect(commitMoment(h.store, sessionPosition(50)).outcome).toBe('APPLIED');
    });
    const shown = moments(view);
    expect(shown).toContain(50);
    // Centred: index 49 − ⌊30 / 2⌋ = 34 → the first shown Moment is SP35.
    expect(shown[0]).toBe(35);
    // And a commit beyond the last full window clamps to it (T-05's own maximum).
    await act(async () => {
      expect(commitMoment(h.store, sessionPosition(90)).outcome).toBe('APPLIED');
    });
    expect(moments(view)[0]).toBe(71);
  });

  it('never shows an undisclosed position as a target: the segments are the disclosed Track, not the Live Head', async () => {
    const h = harness(6);
    // T-05 discloses only SP1..SP4 of a Session whose Live Head is SP6.
    h.presentation.replaceDisclosed(trackOf('session-1', 4));
    view = await mount(h);
    expect(moments(view)).toEqual([1, 2, 3, 4]);
    expect(view.queryByTestId(COSMOS_RAIL_LATER_TEST_ID)).toBeNull();
    expect(view.getByTestId(COSMOS_TIMELINE_RAIL_TEST_ID)).toBeTruthy();
  });
});
