/**
 * S8B-06 CP3 — the call on the PRODUCTION phase surface, over a runtime the harness genuinely built: the real owner, CP2's
 * controller and CP1's client on CP1's fakes (socket, engine, platform), the real composition. G1.2: START is
 * Analysis-first; the call line is in the Analysis's call box and above the composer; the map keeps the call; an end the
 * reader did not choose (J3) returns them to the Conversation with the notice and the entry again. Queries are by test id
 * (the harness's locale is the machine's).
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { CALL_ENTRY_TEST_ID, CALL_LINE_TEST_ID, CALL_NOTICE_TEST_ID, loadCallDevice, type CallDevice } from '../../call';
import { historyBody, exchange } from '../../conversation/__fixtures__/conversation';
import { resize } from '../../responsive/__fixtures__/composition';
import { FakeCallEngine, FakeCallPlatform } from '../../voice-call/__fixtures__/live-call-fakes';
import { refuseConnection, socketRecorder, state, type FakeSocket } from '../../voice-call/__fixtures__/live-call-test-kit';
import { VOICE_CAPABILITY_ROUTE, currentConsentCapability } from '../../voice-note/__fixtures__/voice-capability';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { harness, settle, type IntegrationHarness } from '../__fixtures__/integration';

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };

async function settled(): Promise<void> {
  await act(async () => {
    await settle();
  });
}

async function laidOut(view: RenderResult, which: 'conversation' | 'analysis'): Promise<void> {
  await fireEvent(view.getByTestId(`qandeel-depth-${which}`), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
  await settled();
}

async function withCall(extra: Partial<CallDevice> = {}): Promise<{ h: IntegrationHarness; view: RenderResult; sockets: FakeSocket[]; platform: FakeCallPlatform }> {
  const platform = new FakeCallPlatform();
  const { factory, sockets } = socketRecorder();
  const h = await harness({ foreground: 'ACTIVE', callDevice: { platform, engine: new FakeCallEngine(), socketFactory: factory, ...extra } });
  h.http.on('/turns', (request) => (request.method === 'GET' ? { status: 200, body: historyBody([exchange('fixture: earlier words', { key: 'fixture-earlier' })]) } : { status: 500, body: {} }));
  h.http.on(VOICE_CAPABILITY_ROUTE, () => currentConsentCapability());
  h.http.on('/voice/calls/truth', () => ({ status: 200, body: { callTruth: 'NO_CALL_KNOWN', callId: null, callState: null, startedAt: null } }));
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <RuntimePhaseSurface runtime={h.runtime} />
    </SafeAreaProvider>,
  );
  await settled();
  return { h, view, sockets, platform };
}

/** Android system Back, as the platform delivers it to whoever registered for it (last first). */
function systemBack() {
  type Handler = Parameters<typeof BackHandler.addEventListener>[1];
  const handlers: { handler: Handler; removed: boolean }[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    const entry = { handler, removed: false };
    handlers.push(entry);
    return { remove: () => { entry.removed = true; } };
  });
  return {
    /** Press Back: true when this app consumed it, false when it reaches the platform (which finishes the app). */
    async press(): Promise<boolean> {
      let consumed = false;
      await act(async () => {
        for (const entry of [...handlers].reverse()) {
          if (!entry.removed && entry.handler({} as Parameters<Handler>[0]) === true) {
            consumed = true;
            break;
          }
        }
        await settle();
      });
      return consumed;
    },
  };
}

/** The server's side of the call: its STATE messages carry the call the phone's HELLO named. */
function serverOf(socket: FakeSocket) {
  const callId = socket.texts().find((m) => m.type === 'HELLO')?.callId as string;
  return (over: Parameters<typeof state>[0]) => socket.server(state({ callId, ...over }));
}

describe('S8B-06 CP3 — the call over DepthComposition', () => {
  it('START is Analysis-first: the reader is taken to the Analysis once the call connects, with the call line in its box', async () => {
    const { h, view, sockets, platform } = await withCall();
    expect(view.getByTestId('qandeel-depth-conversation')).toBeTruthy();
    await fireEvent.press(view.getByTestId(CALL_ENTRY_TEST_ID));
    await settled();
    expect(platform.startCalls).toHaveLength(1);
    const socket = sockets[0]!;
    await act(async () => {
      socket.open();
      await settle();
    });
    const server = serverOf(socket);
    await act(async () => {
      server({ state: 'CONNECTING', epoch: 1 });
      await settle();
    });
    expect(h.ready().call.getState().stage).toBe('CONNECTING');
    await laidOut(view, 'analysis');
    await resize(view, 390, 844, { insetTop: 104, insetBottom: 34 });
    await settled();
    expect(view.getByTestId('qandeel-analysis-call-box')).toBeTruthy();
    expect(view.getAllByTestId(CALL_LINE_TEST_ID).length).toBeGreaterThanOrEqual(1);
    expect(view.queryByTestId(CALL_ENTRY_TEST_ID)).toBeNull();
    await act(async () => {
      server({ state: 'ACTIVE', epoch: 1, startedAt: new Date().toISOString() });
      await settle();
    });
    expect(h.ready().call.getState().stage).toBe('ACTIVE');
    expect(view.getByTestId('qandeel-analysis-call-box')).toBeTruthy();
    h.dispose();
  });

  it('J3: an end the reader did not choose returns them to the Conversation, with the notice and the entry again', async () => {
    const { h, view, sockets } = await withCall();
    await fireEvent.press(view.getByTestId(CALL_ENTRY_TEST_ID));
    await settled();
    const socket = sockets[0]!;
    await act(async () => {
      socket.open();
      await settle();
    });
    const server = serverOf(socket);
    await act(async () => {
      server({ state: 'CONNECTING', epoch: 1 });
      server({ state: 'ACTIVE', epoch: 1, startedAt: new Date().toISOString() });
      await settle();
    });
    await laidOut(view, 'analysis');
    expect(view.queryAllByTestId(/^qandeel-depth-(conversation|analysis)$/u).map((l) => l.props.testID)).toEqual(['qandeel-depth-analysis']);
    await act(async () => {
      server({ state: 'ENDED', epoch: 1, endReason: 'SERVER_ENDED' });
      await settle();
    });
    expect(h.ready().call.getState()).toMatchObject({ stage: 'IDLE', notice: 'STOPPED', unchosenEnds: 1 });
    await laidOut(view, 'conversation');
    expect(view.getByTestId('qandeel-conversation')).toBeTruthy();
    expect(view.queryByTestId('qandeel-analysis-call-box')).toBeNull();
    expect(view.getByTestId(CALL_NOTICE_TEST_ID)).toBeTruthy();
    expect(view.getByTestId(CALL_ENTRY_TEST_ID)).toBeTruthy();
    h.dispose();
  });

  it('R1: during a call Back first returns the Analysis to the Conversation, then sends the app to the background; the call goes on', async () => {
    const back = systemBack();
    const { h, view, sockets, platform } = await withCall({ backKey: loadCallDevice().backKey });
    const moves = jest.fn(() => true);
    platform.moveToBackground = moves;
    await fireEvent.press(view.getByTestId(CALL_ENTRY_TEST_ID));
    await settled();
    const socket = sockets[0]!;
    await act(async () => {
      socket.open();
      await settle();
    });
    const server = serverOf(socket);
    await act(async () => {
      server({ state: 'CONNECTING', epoch: 1 });
      server({ state: 'ACTIVE', epoch: 1, startedAt: new Date().toISOString() });
      await settle();
    });
    await laidOut(view, 'analysis');
    expect(view.queryAllByTestId(/^qandeel-depth-(conversation|analysis)$/u).map((l) => l.props.testID)).toEqual(['qandeel-depth-analysis']);
    // The Analysis's own Back is taken first: the reader is back in the Conversation, the app stays in front.
    expect(await back.press()).toBe(true);
    expect(moves).not.toHaveBeenCalled();
    await laidOut(view, 'conversation');
    expect(view.getByTestId('qandeel-conversation')).toBeTruthy();
    // At the root: the app goes to the background; nothing ends the call.
    expect(await back.press()).toBe(true);
    expect(moves).toHaveBeenCalledTimes(1);
    expect(h.ready().call.getState().stage).toBe('ACTIVE');
    expect(socket.controls().map((m) => m.type)).not.toContain('END');
    expect(platform.endCalls).toEqual([]);
    // The call's End still ends it; then Back is the platform's again.
    await act(async () => {
      h.ready().call.end();
      server({ state: 'ENDED', epoch: 1, endReason: 'USER_ENDED' });
      await settle();
    });
    expect(h.ready().call.getState().stage).toBe('IDLE');
    expect(await back.press()).toBe(false);
    expect(moves).toHaveBeenCalledTimes(1);
    h.dispose();
  });

  it('F-E: a refusal that comes before the Analysis is drawn still returns the reader to the Conversation, with the notice', async () => {
    const { h, view, sockets } = await withCall();
    // The start and the server's refusal inside ONE act: the owner's CONNECTING (G1.2: to the Analysis) and its refused
    // end (J3: back to the Conversation) both happen before React draws anything, as on the phone after a permission
    // dialog, when the refusal was handled before the crossing to the Analysis was drawn.
    await act(async () => {
      void h.ready().call.start();
      await settle();
      const socket = sockets[0]!;
      socket.open();
      refuseConnection(socket, 'CAPACITY_FULL');
      await settle();
    });
    expect(h.ready().call.getState()).toMatchObject({ stage: 'IDLE', notice: 'CAPACITY', unchosenEnds: 1 });
    await settled();
    await laidOut(view, 'analysis').catch(() => undefined);
    await laidOut(view, 'conversation');
    expect(view.queryAllByTestId(/^qandeel-depth-(conversation|analysis)$/u).map((l) => l.props.testID)).toEqual(['qandeel-depth-conversation']);
    expect(view.getByTestId(CALL_NOTICE_TEST_ID)).toBeTruthy();
    expect(view.getByTestId(CALL_ENTRY_TEST_ID)).toBeTruthy();
    h.dispose();
  });

  it('F-E: a refusal that comes after the Analysis is drawn and laid out returns the reader to the Conversation, with the notice', async () => {
    const { h, view, sockets } = await withCall();
    await fireEvent.press(view.getByTestId(CALL_ENTRY_TEST_ID));
    await settled();
    const socket = sockets[0]!;
    await act(async () => {
      socket.open();
      await settle();
    });
    await act(async () => {
      serverOf(socket)({ state: 'CONNECTING', epoch: 1 });
      await settle();
    });
    await laidOut(view, 'analysis');
    expect(view.queryAllByTestId(/^qandeel-depth-(conversation|analysis)$/u).map((l) => l.props.testID)).toEqual(['qandeel-depth-analysis']);
    await act(async () => {
      refuseConnection(socket, 'CAPACITY_FULL');
      await settle();
    });
    await laidOut(view, 'conversation');
    expect(h.ready().call.getState()).toMatchObject({ stage: 'IDLE', notice: 'CAPACITY', unchosenEnds: 1 });
    expect(view.queryAllByTestId(/^qandeel-depth-(conversation|analysis)$/u).map((l) => l.props.testID)).toEqual(['qandeel-depth-conversation']);
    expect(view.getByTestId(CALL_NOTICE_TEST_ID)).toBeTruthy();
    expect(view.getByTestId(CALL_ENTRY_TEST_ID)).toBeTruthy();
    h.dispose();
  });
});
