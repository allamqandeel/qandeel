/**
 * W1A-01 — E2E-B-03 / B-04 / B-07 on the PRODUCTION phase surface.
 *
 * `RuntimePhaseSurface` is the route's own reader-facing mapping, driven over a runtime the harness
 * genuinely built: T-12P's bootstrap, the real store and authorities, the real T-12P turn transport
 * on the AC-01 seam, and the real composition. Only the network and the Supabase project are stood
 * in for, through T-12P's own injection points.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { MAP_SURFACE_TEST_ID } from '../../map';
import { exchange, historyBody, submitBody } from '../../conversation/__fixtures__/conversation';
import { resize } from '../../responsive/__fixtures__/composition';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { SESSION_A, harness, settle, type IntegrationHarness } from '../__fixtures__/integration';

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };

async function onRoute(h: IntegrationHarness): Promise<RenderResult> {
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <RuntimePhaseSurface runtime={h.runtime} />
    </SafeAreaProvider>,
  );
  await act(async () => {
    await settle();
  });
  return view;
}

async function signedIn(history = [exchange('fixture: earlier words', { key: 'fixture-earlier' })]): Promise<IntegrationHarness> {
  const h = await harness();
  h.http.on('/turns', (request) => (request.method === 'GET' ? { status: 200, body: historyBody(history) } : { status: 500, body: {} }));
  return h;
}

async function press(view: RenderResult, testID: string): Promise<void> {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await settle();
  });
}

/** The incoming depth's first layout — the moment its cross-fade may begin. */
async function laidOut(view: RenderResult, which: 'conversation' | 'analysis'): Promise<void> {
  await fireEvent(view.getByTestId(`qandeel-depth-${which}`), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
  await act(async () => {
    await settle();
  });
}

/** Across the boundary: the door, then the incoming depth's first layout. */
async function cross(view: RenderResult, door: string, to: 'conversation' | 'analysis'): Promise<void> {
  await press(view, door);
  await laidOut(view, to);
}

/** Into the Analysis depth, laid out in a real room so the world actually composes. */
async function openAnalysis(view: RenderResult): Promise<void> {
  await cross(view, 'qandeel-depth-to-analysis', 'analysis');
  await resize(view, 390, 844, { insetTop: 104, insetBottom: 34 });
}

/** Every mounted depth, including the outgoing one hidden from assistive technology beneath the fade. */
const layersMounted = (view: RenderResult) =>
  view.queryAllByTestId(/^qandeel-depth-(conversation|analysis)$/u, { includeHiddenElements: true }).length;

const fadesIn = (timing: jest.SpyInstance) =>
  timing.mock.calls.filter(([to, config]) => to === 1 && (config as { duration?: number } | undefined)?.duration === 200);

const setReducedMotion = (on: boolean) => {
  (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = on;
};

afterEach(() => {
  setReducedMotion(false);
  jest.restoreAllMocks();
});

describe('W1A-01 — after sign-in the reader lands in the Conversation of their Session', () => {
  it('lands in the Conversation, not the Analysis, and reads THIS Session’s history with the reader’s own bearer', async () => {
    const h = await signedIn();
    const view = await onRoute(h);
    expect(view.getByTestId('qandeel-conversation')).toBeTruthy();
    expect(view.queryByTestId(MAP_SURFACE_TEST_ID)).toBeNull();
    const reads = h.http.matching('/turns');
    expect(reads).toHaveLength(1);
    expect(reads[0].method).toBe('GET');
    expect(reads[0].url).toContain(`/conversation/sessions/${h.ready().bundle.sessionId}/turns`);
    expect(reads[0].authorization).toBe('Bearer token-1');
    expect(view.getByLabelText('You: fixture: earlier words')).toBeTruthy();
    // No Session was created for landing, and none will be for switching.
    expect(h.http.creates()).toHaveLength(1);
    view.unmount();
    h.dispose();
  });
});

describe('W1A-01 — writing to QANDEEL on the real route (B-03)', () => {
  it('Send issues ONE POST for this Session with the words and a key; the confirmed exchange is committed; Analysis is asked to catch up', async () => {
    const h = await signedIn([]);
    const view = await onRoute(h);
    const catchUp = jest.spyOn(h.ready().liveDriver, 'requestImmediateCatchUp');
    const sent: { content: string; idempotencyKey: string }[] = [];
    h.http.on('/turns', (request) => {
      if (request.method === 'GET') return { status: 200, body: historyBody([]) };
      const body = JSON.parse(request.body!) as { content: string; idempotencyKey: string };
      sent.push(body);
      return { status: 201, body: submitBody(exchange(body.content, { key: body.idempotencyKey, reply: 'fixture: وعليكم السلام' }), SESSION_A) };
    });

    await fireEvent.changeText(view.getByTestId('qandeel-conversation-input'), 'fixture: السلام عليكم');
    await press(view, 'qandeel-conversation-send');

    const posts = h.http.matching('/turns').filter((call) => call.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toContain(`/conversation/sessions/${SESSION_A}/turns`);
    expect(posts[0].authorization).toBe('Bearer token-1');
    expect(sent).toHaveLength(1);
    expect(sent[0].content).toBe('fixture: السلام عليكم');
    expect(sent[0].idempotencyKey).toMatch(/^w1a-/u);
    expect(view.getByText(/fixture: وعليكم السلام/u)).toBeTruthy();
    expect(view.getByTestId('qandeel-conversation-input').props.value).toBe('');
    expect(catchUp).toHaveBeenCalledTimes(1);
    view.unmount();
    h.dispose();
  });

  it('a token refresh between reading and writing is carried by the write; the runtime generation does not change', async () => {
    const h = await signedIn([]);
    const view = await onRoute(h);
    const generation = h.ready().generation;
    h.http.on('/turns', (request) =>
      request.method === 'GET'
        ? { status: 200, body: historyBody([]) }
        : { status: 201, body: submitBody(exchange('fixture: words', { key: (JSON.parse(request.body!) as { idempotencyKey: string }).idempotencyKey }), SESSION_A) },
    );
    await act(async () => {
      h.auth.emit({ userId: 'user-1', accessToken: 'token-1-refreshed' });
      await settle();
    });
    await fireEvent.changeText(view.getByTestId('qandeel-conversation-input'), 'fixture: words');
    await press(view, 'qandeel-conversation-send');
    const post = h.http.matching('/turns').find((call) => call.method === 'POST')!;
    expect(post.authorization).toBe('Bearer token-1-refreshed');
    expect(h.ready().generation).toBe(generation);
    view.unmount();
    h.dispose();
  });

  it('sign-out retires the Conversation with the generation: nothing more is issued for that identity', async () => {
    const h = await signedIn([]);
    const view = await onRoute(h);
    const conversation = h.ready().conversation;
    await act(async () => {
      h.auth.emit(null, 'SIGNED_OUT');
      await settle();
    });
    expect(h.phase().kind).toBe('SIGNED_OUT');
    const before = h.http.calls.length;
    conversation.ensureHistory();
    conversation.setDraft('fixture: words');
    conversation.send();
    await settle();
    expect(h.http.calls.length).toBe(before);
    view.unmount();
    h.dispose();
  });
});

describe('W1A-01 — Conversation ↔ Analysis is one Session, one generation, one world (B-07)', () => {
  it('the door opens the existing Analysis world, and «Conversation» returns to the same Conversation — nothing dispatched, created or replaced', async () => {
    const h = await signedIn();
    const view = await onRoute(h);
    const runtime = h.ready();
    const stateBefore = runtime.store.getState();

    await openAnalysis(view);
    expect(view.getByTestId(MAP_SURFACE_TEST_ID)).toBeTruthy();
    expect(view.getByTestId('qandeel-depth-to-conversation').props.accessibilityLabel).toBe('Conversation');
    expect(view.queryByTestId('qandeel-conversation')).toBeNull();
    // The SAME runtime generation, Session and store; switching depth wrote no canonical state.
    expect(h.ready()).toBe(runtime);
    expect(runtime.store.getState()).toBe(stateBefore);
    expect(h.http.creates()).toHaveLength(1);

    await cross(view, 'qandeel-depth-to-conversation', 'conversation');
    expect(view.getByTestId('qandeel-conversation')).toBeTruthy();
    expect(view.queryByTestId(MAP_SURFACE_TEST_ID)).toBeNull();
    expect(view.getByLabelText('You: fixture: earlier words')).toBeTruthy();
    expect(h.ready()).toBe(runtime);
    expect(runtime.store.getState()).toBe(stateBefore);
    expect(h.http.creates()).toHaveLength(1);
    view.unmount();
    h.dispose();
  });

  it('standard motion: the F2 symmetric cross-fade, 200 ms, linear — in both directions', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const h = await signedIn();
    const view = await onRoute(h);
    await openAnalysis(view);
    await cross(view, 'qandeel-depth-to-conversation', 'conversation');
    const fades = fadesIn(timing);
    expect(fades).toHaveLength(2);
    for (const [, config] of fades) expect((config as { easing?: unknown }).easing).toBe(Reanimated.Easing.linear);
    view.unmount();
    h.dispose();
  });

  it('Reduced Motion: no cross-fade at all — the same switch, the same truth, no movement', async () => {
    setReducedMotion(true);
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const h = await signedIn();
    const view = await onRoute(h);
    await openAnalysis(view);
    expect(view.getByTestId(MAP_SURFACE_TEST_ID)).toBeTruthy();
    expect(view.queryAllByTestId(/^qandeel-depth-(conversation|analysis)$/u)).toHaveLength(1);
    await press(view, 'qandeel-depth-to-conversation');
    expect(view.getByTestId('qandeel-conversation')).toBeTruthy();
    expect(timing.mock.calls.filter(([to, config]) => to === 1 && (config as { duration?: number } | undefined)?.duration === 200)).toHaveLength(0);
    view.unmount();
    h.dispose();
  });

  it('the fade waits for the incoming depth to lay out, so a slow mount cannot turn it into a cut; turning back mid-fade still resolves', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const h = await signedIn();
    const view = await onRoute(h);
    await press(view, 'qandeel-depth-to-analysis');
    // Mounted, beneath nothing yet: no clock is running until the Analysis has laid out.
    expect(fadesIn(timing)).toHaveLength(0);
    expect(layersMounted(view)).toBe(2);
    // The reader turns back before the Analysis ever laid out: the Conversation is still mounted, lays
    // out no more, and fades back at once — nothing is left waiting.
    await press(view, 'qandeel-depth-to-conversation');
    expect(fadesIn(timing)).toHaveLength(1);
    expect(view.getByTestId('qandeel-conversation')).toBeTruthy();
    expect(layersMounted(view)).toBe(1);
    // And forward again: one fade, on layout.
    await press(view, 'qandeel-depth-to-analysis');
    expect(fadesIn(timing)).toHaveLength(1);
    await laidOut(view, 'analysis');
    expect(fadesIn(timing)).toHaveLength(2);
    expect(layersMounted(view)).toBe(1);
    expect(view.queryByTestId('qandeel-conversation')).toBeNull();
    view.unmount();
    h.dispose();
  });

  it('only the current depth is interactive and exposed to assistive technology', async () => {
    const h = await signedIn();
    const view = await onRoute(h);
    const layers = view.queryAllByTestId(/^qandeel-depth-(conversation|analysis)$/u);
    expect(layers).toHaveLength(1);
    expect(layers[0].props.importantForAccessibility).toBe('auto');
    expect(layers[0].props.accessibilityElementsHidden).toBe(false);
    view.unmount();
    h.dispose();
  });
});
