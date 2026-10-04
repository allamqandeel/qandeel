/**
 * VPORT-02 — the final temporal / orientation / iconography layer over the existing runtime.
 *
 * What these prove, in the Task Contract's own terms (§11.4):
 *   - P2 Temporal Spine C: FOLLOW_LIVE opens no Moment and engages the Live terminal; PINNED(t) opens the spine at t;
 *     a preview is a lighter opening with no mark beside the committed one; newest Moment ≠ Live Edge;
 *   - F-P2-02: the Live terminal is beside the strip, never over it, so every Moment in the window stays reachable;
 *   - RTL: the terminal mirrors as layout, the spine is placed with logical `start`;
 *   - the G3 temporal orientation line: PINNED and preview only, said once, never in the chrome when composed;
 *   - Return Live has one home, the Live edge: the chrome does not present it a second time;
 *   - the dark-on-dark correction: every word and mark carries an Analysis ink;
 *   - the Call Rail: form-carried state, no activity input of any kind, End Call neutral at 27 px.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import { I18nManager } from 'react-native';

import { analysisInk } from '../../analysis-visual';
import { OrientationChrome, TemporalOrientationLine, temporalOrientationLine, ORIENTATION_CHROME_TEST_ID } from '../../orientation-chrome';
import { chromeStore, chromeSurface, fetched, known, projectionFor, TWO_CONTEXT_WORLD, withInspection } from '../../orientation-chrome/__fixtures__/chrome';
import { RETURN_CONTROLS_TEST_ID } from '../../orientation-chrome/ReturnControls';
import { sessionPosition } from '../../state';
import { createPresentationController, TIMELINE_STEP } from '../../timeline';
import { createTemporalPreviewController } from '../../temporal-navigation/preview';
import { temporalTargeting } from '../../temporal-navigation/targeting/disclosed-availability';
import {
  TEMPORAL_COMMITTED_MARKER_TEST_ID,
  TEMPORAL_LIVE_EDGE_TEST_ID,
  TEMPORAL_LIVE_TERMINAL_TEST_ID,
  TEMPORAL_PREVIEW_MARKER_TEST_ID,
  TEMPORAL_SPINE_TEST_ID,
  TEMPORAL_TARGET_STRIP_TEST_ID,
  TemporalTargetLayer,
} from '../../temporal-navigation/timeline-integration';
import { commitMoment } from '../../temporal-navigation/targeting';
import { temporalTestStore, trackOf } from '../../temporal-navigation/__fixtures__/temporal';
import { CALL_RAIL_TEST_ID, CallRail, P2_CALL_RAIL, P2_SPINE, spinePresentation } from '..';

const INK = analysisInk(false);
/** The P2 drawings are decorative and hidden from the accessibility tree by design, so a test must ask for them. */
const HIDDEN = { includeHiddenElements: true } as const;
const flatten = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...(Array.isArray(style) ? style.flat(4) : [style]).filter((entry) => entry !== null && typeof entry === 'object'));

async function layer(options: { liveHead?: number; pinnedAt?: number; count?: number } = {}) {
  const store = temporalTestStore({
    liveHead: options.liveHead ?? 8,
    ...(options.pinnedAt === undefined ? {} : { temporal: { kind: 'PINNED' as const, at: sessionPosition(options.pinnedAt) } }),
  });
  const preview = createTemporalPreviewController();
  const presentation = createPresentationController(trackOf('session-1', options.count ?? 8), 240);
  const view = await render(<TemporalTargetLayer store={store} preview={preview} presentation={presentation} />);
  return { store, preview, presentation, view };
}

type Node = { readonly props: Record<string, unknown>; readonly children?: readonly (Node | string)[] | null; readonly type?: string };
/** Every node below (and including) one rendered element that matches, walking the plain host tree. */
function descendants(root: unknown, match: (node: Node) => boolean, out: Node[] = []): Node[] {
  if (root === null || typeof root !== 'object') return out;
  const node = root as Node;
  if (node.props !== undefined && match(node)) out.push(node);
  for (const child of node.children ?? []) descendants(child, match, out);
  return out;
}
const skia = (kind: string) => (node: Node) => node.props.skiaElement === kind;

const unmount = async (view: { unmount: () => void }) => act(async () => view.unmount());

describe('Spine presentation — plain arithmetic over T-05 geometry', () => {
  it('one notch per disclosed Moment in the window, at the 48-point step, and nothing outside it', () => {
    const spine = spinePresentation({ disclosed: 30, offset: 480, viewport: 240, committedSp: null, targetSp: null });
    expect(spine.spineLength).toBe(240);
    for (const notch of spine.notches) expect(notch.start).toBe((notch.sp - 1) * TIMELINE_STEP + TIMELINE_STEP / 2 - 480);
    expect(spine.notches.every((notch) => notch.start >= -TIMELINE_STEP && notch.start <= 240 + TIMELINE_STEP)).toBe(true);
    expect(spine.notches.length).toBeLessThanOrEqual(Math.ceil(240 / TIMELINE_STEP) + 3);
  });

  it('the hairline stops at the newest disclosed Moment, never beyond it', () => {
    expect(spinePresentation({ disclosed: 3, offset: 0, viewport: 400, committedSp: null, targetSp: null }).spineLength).toBe(3 * TIMELINE_STEP);
    expect(spinePresentation({ disclosed: 0, offset: 0, viewport: 400, committedSp: null, targetSp: null }).notches).toHaveLength(0);
  });

  it('the committed Moment\'s notch gives way to the aperture\'s mark; the previewed one is marked as WHICH Moment', () => {
    const spine = spinePresentation({ disclosed: 8, offset: 0, viewport: 400, committedSp: 3, targetSp: 6 });
    expect(spine.notches.some((notch) => notch.sp === 3)).toBe(false);
    expect(spine.notches.filter((notch) => notch.target).map((notch) => notch.sp)).toEqual([6]);
  });
});

describe('Temporal Spine C on the production temporal surface', () => {
  it('FOLLOW_LIVE opens no Moment: the committed aperture is closed and the Live terminal is ENGAGED', async () => {
    const { view } = await layer();
    expect(flatten(view.getByTestId(TEMPORAL_COMMITTED_MARKER_TEST_ID).props.style).opacity).toBe(0);
    const terminal = view.getByTestId(TEMPORAL_LIVE_TERMINAL_TEST_ID, HIDDEN);
    const strokes = descendants(terminal, skia('Path'));
    expect(strokes.map((node) => node.props.strokeWidth)).toEqual([P2_SPINE.terminal.stop.strokeWidth, P2_SPINE.terminal.present.engagedStrokeWidth]);
    expect(strokes.every((node) => node.props.color === INK.primary)).toBe(true);
    await unmount(view);
  });

  it('PINNED(t) opens the spine at t, with its mark; the Live terminal is AVAILABLE, a hairline in the rest ink', async () => {
    const { view } = await layer({ pinnedAt: 3 });
    const committed = view.getByTestId(TEMPORAL_COMMITTED_MARKER_TEST_ID);
    expect(flatten(committed.props.style).opacity).toBe(1);
    expect(descendants(committed, skia('RoundedRect'))).toHaveLength(1);
    const strokes = descendants(view.getByTestId(TEMPORAL_LIVE_TERMINAL_TEST_ID, HIDDEN), skia('Path'));
    expect(strokes[1]?.props.strokeWidth).toBe(P2_SPINE.terminal.present.availableStrokeWidth);
    expect(strokes.every((node) => node.props.color === INK.restInk)).toBe(true);
    // The spine itself: a tertiary hairline and the resting notches, with the committed Moment's notch replaced.
    expect(view.queryByTestId(`${TEMPORAL_SPINE_TEST_ID}:sp-3`, HIDDEN)).toBeNull();
    expect(view.getByTestId(`${TEMPORAL_SPINE_TEST_ID}:sp-2`, HIDDEN)).toBeTruthy();
    await unmount(view);
  });

  it('a preview is a lighter opening with no mark, and committed truth does not move with it', async () => {
    const { store, preview, presentation, view } = await layer({ pinnedAt: 2 });
    const before = flatten(view.getByTestId(TEMPORAL_COMMITTED_MARKER_TEST_ID).props.style).transform;
    await act(async () => {
      preview.preview(temporalTargeting(store.getState(), presentation.getSnapshot().track), 6, 'DISCLOSED_TARGET');
    });
    const cursor = view.getByTestId(TEMPORAL_PREVIEW_MARKER_TEST_ID);
    expect(flatten(cursor.props.style).opacity).toBe(0.72);
    expect(descendants(cursor, skia('RoundedRect'))).toHaveLength(0);
    expect(flatten(view.getByTestId(TEMPORAL_COMMITTED_MARKER_TEST_ID).props.style).transform).toEqual(before);
    expect(view.getByTestId(`${TEMPORAL_SPINE_TEST_ID}:target:sp-6`, HIDDEN)).toBeTruthy();
    // Preview → cancel is lossless: the stance never moved, the preview closes.
    await act(async () => {
      preview.cancel();
    });
    expect(flatten(view.getByTestId(TEMPORAL_PREVIEW_MARKER_TEST_ID).props.style).opacity).toBe(0);
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 2 });
    await unmount(view);
  });

  it('the newest Moment is not the Live Edge: committing it gives PINNED(LH), the spine opens and Live stays offered', async () => {
    const { store, view } = await layer({ liveHead: 8 });
    await act(async () => {
      commitMoment(store, 8);
    });
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 8 });
    expect(flatten(view.getByTestId(TEMPORAL_COMMITTED_MARKER_TEST_ID).props.style).opacity).toBe(1);
    expect(view.getByTestId(TEMPORAL_LIVE_EDGE_TEST_ID).props.accessibilityState).toMatchObject({ selected: false, disabled: false });
    // Return Live from its one home, the Live edge — words or terminal, the same act.
    await act(async () => {
      fireEvent.press(view.getByTestId(TEMPORAL_LIVE_TERMINAL_TEST_ID, HIDDEN));
    });
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(flatten(view.getByTestId(TEMPORAL_COMMITTED_MARKER_TEST_ID).props.style).opacity).toBe(0);
    await unmount(view);
  });

  it('F-P2-02: the Live terminal lies beside the strip, never over it, and is not a second accessible element', async () => {
    const { view } = await layer({ pinnedAt: 4 });
    const strip = view.getByTestId(TEMPORAL_TARGET_STRIP_TEST_ID);
    const terminal = view.getByTestId(TEMPORAL_LIVE_TERMINAL_TEST_ID, HIDDEN);
    // Siblings in one row: nothing of the terminal is inside the strip's subtree, so it can take no strip touch.
    expect(descendants(strip, (node) => node.props.testID === TEMPORAL_LIVE_TERMINAL_TEST_ID)).toHaveLength(0);
    expect(terminal.props.accessible).toBe(false);
    expect(view.getByTestId(TEMPORAL_LIVE_EDGE_TEST_ID).props.accessibilityRole).toBe('button');
    // The strip is still exactly T-05's viewport.
    expect(flatten(strip.props.style).width).toBe(240);
    await unmount(view);
  });

  it('every word on the temporal surface carries an Analysis ink (the dark-on-dark correction)', async () => {
    const { view } = await layer({ pinnedAt: 4 });
    const allowed = new Set<string>([INK.primary, INK.secondary, INK.tertiary, INK.restInk, INK.error]);
    const texts = descendants(view.toJSON(), (node) => node.type === 'Text');
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) expect(allowed.has(flatten(text.props.style).color as string)).toBe(true);
    await unmount(view);
  });

  it('under right-to-left the Live terminal mirrors as LAYOUT, and the spine is placed by logical start', async () => {
    const original = I18nManager.isRTL;
    Object.defineProperty(I18nManager, 'isRTL', { value: true, configurable: true });
    try {
      const { view } = await layer({ pinnedAt: 4 });
      const mirrored = descendants(view.getByTestId(TEMPORAL_LIVE_TERMINAL_TEST_ID, HIDDEN), (node) => Array.isArray(flatten(node.props.style).transform));
      expect(mirrored.some((node) => JSON.stringify(flatten(node.props.style).transform) === JSON.stringify([{ scaleX: -1 }]))).toBe(true);
      const notch = flatten(view.getByTestId(`${TEMPORAL_SPINE_TEST_ID}:sp-1`, HIDDEN).props.style);
      expect(notch.start).toBeDefined();
      expect(notch.left).toBeUndefined();
      await unmount(view);
    } finally {
      Object.defineProperty(I18nManager, 'isRTL', { value: original, configurable: true });
    }
  });
});

describe('the G3 temporal orientation line and Return Live\'s one home', () => {
  const pinned = () =>
    chromeStore({ liveHead: 6, temporal: { kind: 'PINNED', at: sessionPosition(4) }, depth: 'ANALYTICAL_OBJECT', liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' }, liveFocusAtSp: 5 });

  it('following Live the line says nothing and holds no gap', async () => {
    const store = chromeStore({ liveHead: 6 });
    expect(temporalOrientationLine(store, 'en', null)).toBeNull();
    const view = await render(<TemporalOrientationLine store={store} language="en" />);
    expect(view.toJSON()).toBeNull();
    await unmount(view);
  });

  it('PINNED says T-08\'s pinned sentence and, because the conversation continued, its second sentence', async () => {
    const store = pinned();
    const words = temporalOrientationLine(store, 'en', null);
    expect(words).toContain('4');
    expect(words).toContain('The conversation has continued since this moment.');
    const view = await render(<TemporalOrientationLine store={store} language="ar" />);
    expect(view.getByText(temporalOrientationLine(store, 'ar', null) as string).props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: INK.primary })]));
    await unmount(view);
  });

  it('a preview says T-08\'s preview sentence', () => {
    const store = pinned();
    const words = temporalOrientationLine(store, 'en', { status: 'PREVIEWING', ptc: sessionPosition(2), generation: 1, source: 'DISCLOSED_TARGET', origin: { mode: 'PINNED', tc: sessionPosition(4) } } as never);
    expect(words).toBe('A temporary look at moment 2. Your position has not changed.');
  });

  it('composed with the Timeline, the chrome says the line nowhere and presents Return Live nowhere; every other act stays', async () => {
    const store = pinned();
    const projection = projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known())));
    const standalone = await render(<OrientationChrome language="en" surface={chromeSurface(store)} projection={projection} />);
    expect(standalone.queryByTestId(`${ORIENTATION_CHROME_TEST_ID}:temporal`)).toBeTruthy();
    expect(standalone.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:RETURN_LIVE_HEAD`)).toBeTruthy();
    const others = standalone
      .getByTestId(RETURN_CONTROLS_TEST_ID)
      .children.map((child) => (typeof child === 'string' ? child : child.props.testID))
      .filter((id) => id !== `${RETURN_CONTROLS_TEST_ID}:RETURN_LIVE_HEAD`);
    await unmount(standalone);

    const composed = await render(
      <OrientationChrome language="en" surface={chromeSurface(store)} projection={projection} temporalLine="WITH_TIMELINE" returnLiveHome="LIVE_EDGE" />,
    );
    for (const line of ['temporal', 'preview', 'live']) expect(composed.queryByTestId(`${ORIENTATION_CHROME_TEST_ID}:${line}`)).toBeNull();
    expect(composed.queryByTestId(`${ORIENTATION_CHROME_TEST_ID}:spatial`)).toBeTruthy();
    expect(composed.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:RETURN_LIVE_HEAD`)).toBeNull();
    expect(composed.getByTestId(RETURN_CONTROLS_TEST_ID).children.map((child) => (typeof child === 'string' ? child : child.props.testID))).toEqual(others);
    await unmount(composed);
  });
});

describe('Call Rail A "Keyed Seam" — visual machine only', () => {
  const labels = { mute: 'Mute microphone', unmute: 'Unmute microphone', route: 'Speaker', endCall: 'End call' } as const;
  const rail = (over: Partial<Parameters<typeof CallRail>[0]> = {}) => (
    <CallRail
      palette={INK}
      language="en"
      labels={labels}
      muted={false}
      route="EARPIECE"
      onToggleMute={() => undefined}
      onToggleRoute={() => undefined}
      onEndCall={() => undefined}
      {...over}
    />
  );

  it('three 44-point targets laid out from the END edge, with the separated End terminal nearest it', async () => {
    const view = await render(rail());
    const at = (id: string) => flatten(view.getByTestId(`${CALL_RAIL_TEST_ID}:${id}`).props.style);
    for (const id of ['end', 'mic', 'route']) {
      expect(at(id).width).toBe(44);
      expect(at(id).minHeight).toBe(44);
    }
    expect(at('end').end).toBe(P2_CALL_RAIL.slots.end.end);
    expect(at('mic').end).toBe(P2_CALL_RAIL.slots.mic.end);
    expect(at('route').end).toBe(P2_CALL_RAIL.slots.route.end);
    await unmount(view);
  });

  it('state is carried by FORM and by the accessible state, never by colour alone', async () => {
    const live = await render(rail());
    const mic = live.getByTestId(`${CALL_RAIL_TEST_ID}:mic`);
    expect(mic.props.accessibilityLabel).toBe(labels.mute);
    expect(mic.props.accessibilityState).toMatchObject({ checked: false });
    await unmount(live);
    const muted = await render(rail({ muted: true, route: 'LOUDSPEAKER' }));
    expect(muted.getByTestId(`${CALL_RAIL_TEST_ID}:mic`).props.accessibilityLabel).toBe(labels.unmute);
    expect(muted.getByTestId(`${CALL_RAIL_TEST_ID}:mic`).props.accessibilityState).toMatchObject({ checked: true });
    expect(muted.getByTestId(`${CALL_RAIL_TEST_ID}:route`).props.accessibilityState).toMatchObject({ checked: true });
    // The microphone is cut by a band of negative space as well as crossed by the slash.
    const micGlyph = muted.getByTestId(`${CALL_RAIL_TEST_ID}:mic-glyph`, HIDDEN);
    expect(descendants(micGlyph, (node) => node.props.blendMode === 'clear')).toHaveLength(1);
    await unmount(muted);
  });

  it('End Call is the one solid mark, 27 px, in the primary ink — no red, no Brass', async () => {
    const view = await render(rail());
    const end = view.getByTestId(`${CALL_RAIL_TEST_ID}:end-glyph`, HIDDEN);
    expect(flatten(end.props.style).width).toBe(27);
    const fills = descendants(end, (node) => node.props.style === 'fill');
    expect(fills.map((node) => node.props.color)).toEqual([INK.primary]);
    expect(JSON.stringify(view.toJSON())).not.toContain(INK.error);
    await unmount(view);
  });

  it('with no known route the route control is absent, not guessed', async () => {
    const view = await render(rail({ route: null }));
    expect(view.queryByTestId(`${CALL_RAIL_TEST_ID}:route`)).toBeNull();
    expect(view.getByTestId(`${CALL_RAIL_TEST_ID}:mic`)).toBeTruthy();
    await unmount(view);
  });

  it('presses reach the call owner\'s callbacks and nothing else', async () => {
    const calls: string[] = [];
    const view = await render(rail({ onToggleMute: () => calls.push('mute'), onToggleRoute: () => calls.push('route'), onEndCall: () => calls.push('end') }));
    for (const id of ['mic', 'route', 'end']) fireEvent.press(view.getByTestId(`${CALL_RAIL_TEST_ID}:${id}`));
    expect(calls).toEqual(['mute', 'route', 'end']);
    await unmount(view);
  });
});
