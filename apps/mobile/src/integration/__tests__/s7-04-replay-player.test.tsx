/**
 * S7-04 — the Replay player as the production runtime composes it: Select → Saved Draft → Real Preview → Historical
 * Player → Private Finalize → Return (and Reopen), from the Conversation and from the Analysis, over the REAL-PATH
 * captured Replay wire (`replay-player/__fixtures__/replay-player-wire.json`, served route by route with the
 * composition's own random command ids — the id discipline itself is proven exactly in the controller proofs).
 *
 * The conversation on screen is a fixture conversation (its messages are fixture words); the Replay that is played is
 * the captured one. The gate is OPEN here only because the captured capability answer is served — a controlled
 * fixture, exactly like S7-02's; the shipped gate stays closed (last test).
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import { MAP_SURFACE_TEST_ID } from '../../map';
import { conversationCopy } from '../../conversation';
import { replayEntryCopy } from '../../replay-entry';
import { REPLAY_PLAYER_TEST_ID, replayPlayerCopy } from '../../replay-player';
import { PLAYER_WIRE, playerServer, type PlayerServer } from '../../replay-player/__fixtures__/player-wire';
import { turnEvent } from '../../replay-entry/__fixtures__/replay';
import { RESPONSIVE_MAP_FRAME_TEST_ID, RESPONSIVE_SURFACE_TEST_ID } from '../../responsive';
import { TEST_CONFIG } from '../../runtime-entry/__fixtures__/runtime-entry';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { harness, settle, type IntegrationHarness } from '../__fixtures__/integration';
import { deviceProductLanguage } from '../locale/device-locale';

// Each journey drives the whole production composition through many reads and commands; under a full parallel run
// that takes longer than Jest's 5 s default.
jest.setTimeout(30000);

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
const HIDDEN = { includeHiddenElements: true } as const;
/** The harness speaks the device's language (Arabic or English): every expectation reads the shipped words for it. */
const LANGUAGE = deviceProductLanguage();
const PLAYER_WORDS = replayPlayerCopy(LANGUAGE);
const MOMENTS = (PLAYER_WIRE.scenes.preview.moments as { moments: { text: string }[] }).moments;

const HISTORY = [exchange('fixture: the first words'), exchange('fixture: the second words'), exchange('fixture: the third words')];
/** The committed units, so the part [first message .. second reply] is SP 1 .. 6 — the captured draft's range. */
const EVENTS = (sessionId: string) => [
  turnEvent(HISTORY[0].userTurn.id, 1, 2, sessionId), turnEvent(HISTORY[0].reply!.id, 3, 3, sessionId),
  turnEvent(HISTORY[1].userTurn.id, 4, 4, sessionId), turnEvent(HISTORY[1].reply!.id, 5, 6, sessionId),
  turnEvent(HISTORY[2].userTurn.id, 7, 7, sessionId), turnEvent(HISTORY[2].reply!.id, 8, 8, sessionId),
];

async function world(options: { gate?: boolean } = {}): Promise<{ h: IntegrationHarness; server: PlayerServer; view: RenderResult }> {
  const h = await harness({ liveHead: 8 });
  const sessionId = h.ready().bundle.sessionId;
  const server = playerServer({ base: TEST_CONFIG.apiBaseUrl, composition: true });
  h.http.on('/turns', () => ({ status: 200, body: historyBody(HISTORY) }));
  h.http.on('/temporal/events', () => ({ status: 200, body: { sessionId, events: EVENTS(sessionId) } }));
  h.http.on('/replay', async (call) => {
    if (call.url.endsWith('/replay/capability') && options.gate === false) return { status: 200, body: { creationAvailable: false } };
    const answer = await server.fetch(call.url, { method: call.method, ...(call.body === null ? {} : { body: call.body }) });
    return { status: answer.status, body: await answer.json() };
  });
  const view = await render(<SafeAreaProvider initialMetrics={METRICS}><RuntimePhaseSurface runtime={h.runtime} /></SafeAreaProvider>);
  await act(async () => {
    await settle();
  });
  return { h, server, view };
}

async function press(view: RenderResult, testID: string): Promise<void> {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await settle();
  });
}

/** There is no Yoga in the test renderer: lay every Living Analysis surface out in a real room. */
async function layOut(view: RenderResult): Promise<void> {
  for (const surface of view.queryAllByTestId(RESPONSIVE_SURFACE_TEST_ID, HIDDEN)) {
    await act(async () => {
      fireEvent(surface, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
    });
  }
  for (const frame of view.queryAllByTestId(RESPONSIVE_MAP_FRAME_TEST_ID, HIDDEN)) {
    await act(async () => {
      fireEvent(frame, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 420 } } });
    });
  }
  await act(async () => {
    await settle();
  });
}

const text = (view: RenderResult, id: string) => {
  const node = view.getByTestId(id);
  return (Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children) as string;
};

/** Saves the part [first message .. second reply] through the S7-02 entry, exactly as a reader does. */
async function savePart(view: RenderResult): Promise<void> {
  await press(view, 'qandeel-replay-entry');
  await press(view, 'qandeel-replay-choose-part');
  await press(view, `qandeel-selectable-${HISTORY[0].userTurn.id}`);
  await press(view, `qandeel-selectable-${HISTORY[1].reply!.id}`);
  await press(view, 'qandeel-replay-save');
}

function systemBack() {
  type Handler = Parameters<typeof BackHandler.addEventListener>[1];
  const handlers: { handler: Handler; removed: boolean }[] = [];
  const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    const entry = { handler, removed: false };
    handlers.push(entry);
    return { remove: () => { entry.removed = true; } };
  });
  return {
    press: async () => {
      await act(async () => {
        const live = handlers.filter((entry) => !entry.removed);
        live[live.length - 1].handler({ type: 'hardwareBackPress', timeStamp: 0 } as never);
        await settle();
      });
    },
    restore: () => spy.mockRestore(),
  };
}

describe('S7-04 — Select → Saved Draft → Real Preview → Player → Private Finalize → Return, in the production composition', () => {
  it('plays the captured version over the Conversation, and returns to it exactly as it was', async () => {
    const { h, server, view } = await world();
    const runtime = h.ready();
    await fireEvent.changeText(view.getByTestId('qandeel-conversation-input'), 'fixture: words not sent yet');
    await savePart(view);
    expect(JSON.parse(h.http.matching('/replay/drafts')[0].body!)).toMatchObject({ firstTc: 1, lastTc: 6 });
    expect(view.getByTestId('qandeel-replay-notice')).toBeTruthy();

    const conversationBefore = runtime.conversation.getState();
    const storeBefore = runtime.store.getState();
    const generation = runtime.generation;
    const authGeneration = runtime.bundle.authGeneration;
    await press(view, 'qandeel-replay-preview');
    await layOut(view);

    // A REAL preview: the captured command, then the captured version read through the production clients.
    const preview = h.http.matching('/preview');
    expect(preview).toHaveLength(1);
    expect(preview[0].authorization).toBe('Bearer token-1');
    expect(JSON.parse(preview[0].body!)).toEqual({ commandId: expect.stringMatching(/^[0-9a-f-]{36}$/u), expectedDraftRevision: 1 });
    expect(view.getByTestId(REPLAY_PLAYER_TEST_ID)).toBeTruthy();
    expect(text(view, 'qandeel-replay-text')).toBe(MOMENTS[0].text);
    expect(view.getByTestId(MAP_SURFACE_TEST_ID)).toBeTruthy();
    // The Conversation is still mounted beneath, out of reach; the switcher is not over the passage.
    expect(view.queryByTestId('qandeel-conversation-input')).toBeNull();
    expect(view.getByTestId('qandeel-conversation-input', HIDDEN).props.value).toBe('fixture: words not sent yet');
    expect(view.queryByTestId('qandeel-global-switcher')).toBeNull();

    await fireEvent(view.getByTestId('qandeel-replay-spine'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await act(async () => {
      await settle();
    });
    expect(text(view, 'qandeel-replay-text')).toBe(MOMENTS[1].text);
    await press(view, 'qandeel-replay-player-finalize');
    expect(text(view, 'qandeel-replay-player-sentence')).toBe(PLAYER_WORDS.finalizedNotice);
    expect(text(view, 'qandeel-replay-text')).toBe(MOMENTS[1].text);

    await press(view, 'qandeel-replay-player-back');
    expect(view.queryByTestId(REPLAY_PLAYER_TEST_ID)).toBeNull();
    // Returned exactly where the reader was: the unsent words, the conversation, the live store, the same generation.
    expect(view.getByTestId('qandeel-conversation-input').props.value).toBe('fixture: words not sent yet');
    expect(runtime.conversation.getState().exchanges).toBe(conversationBefore.exchanges);
    expect(runtime.store.getState()).toBe(storeBefore);
    expect(h.ready()).toBe(runtime);
    expect(h.ready().generation).toBe(generation);
    expect(h.ready().bundle.authGeneration).toBe(authGeneration);
    expect(h.http.creates()).toHaveLength(1);
    expect(h.http.matching('/turns').filter((call) => call.method === 'POST')).toHaveLength(0);
    for (const call of h.http.matching('/replay')) expect(call.authorization).toBe('Bearer token-1');
    expect(server.uncaptured).toEqual([]);
    view.unmount();
    h.dispose();
  });

  it('from the Analysis: the END-edge entry opens the newest Replay; Reopen and a new preview; Android Back returns to the same Analysis', async () => {
    const back = systemBack();
    const { h, server, view } = await world();
    const runtime = h.ready();
    await savePart(view);
    await press(view, 'qandeel-replay-preview');
    await press(view, 'qandeel-replay-player-finalize');
    await press(view, 'qandeel-replay-player-back');

    await press(view, 'qandeel-depth-to-analysis');
    await layOut(view);
    const storeBefore = runtime.store.getState();
    expect(view.getByTestId('qandeel-replay-analysis-entry').props.accessibilityLabel).toBe(replayEntryCopy(LANGUAGE).replayName);
    await press(view, 'qandeel-replay-analysis-entry');
    await layOut(view);
    expect(view.getByTestId(REPLAY_PLAYER_TEST_ID)).toBeTruthy();
    expect(view.getByTestId('qandeel-replay-player-back').props.accessibilityLabel).toBe(conversationCopy(LANGUAGE).doorName);
    expect(text(view, 'qandeel-replay-player-sentence')).toBe(PLAYER_WORDS.finalized);
    // The Analysis beneath keeps its world and its camera; it is out of reach.
    expect(view.queryByTestId('qandeel-depth-to-conversation')).toBeNull();
    expect(view.getByTestId('qandeel-depth-to-conversation', HIDDEN)).toBeTruthy();

    await press(view, 'qandeel-replay-player-reopen');
    expect(text(view, 'qandeel-replay-player-sentence')).toBe(PLAYER_WORDS.reopenedNotice);
    await press(view, 'qandeel-replay-player-preview');
    await layOut(view);
    expect(h.http.matching('/preview')).toHaveLength(2);
    expect(text(view, 'qandeel-replay-text')).toBe((PLAYER_WIRE.scenes.second.moments as { moments: { text: string }[] }).moments[0].text);

    await back.press();
    expect(view.queryByTestId(REPLAY_PLAYER_TEST_ID)).toBeNull();
    expect(view.getByTestId('qandeel-depth-to-conversation')).toBeTruthy();
    expect(runtime.store.getState()).toBe(storeBefore);
    expect(server.uncaptured).toEqual([]);
    back.restore();
    view.unmount();
    h.dispose();
  });

  // G-1 (corrected in S7-04, record §5): the draft was saved before the app restarted, so this generation has none of
  // its own; the Analysis reaches it through the conversation's list, which now carries a draft with no version.
  it('G-1: after a restart, the Analysis opens the draft saved before it from the list, and previews it', async () => {
    const { h, server, view } = await world();
    server.listIs('listDraft');
    await press(view, 'qandeel-depth-to-analysis');
    await layOut(view);
    await press(view, 'qandeel-replay-analysis-entry');
    await layOut(view);
    expect(h.http.matching('/replay/drafts')).toHaveLength(0);
    expect(h.http.matching('/replay/conversations/')).toHaveLength(1);
    expect(view.getByTestId(REPLAY_PLAYER_TEST_ID)).toBeTruthy();
    expect(view.getByTestId('qandeel-replay-player-draft')).toBeTruthy();
    await press(view, 'qandeel-replay-player-preview');
    await layOut(view);
    expect(h.http.matching('/preview')).toHaveLength(1);
    expect(text(view, 'qandeel-replay-text')).toBe(MOMENTS[0].text);
    expect(server.uncaptured).toEqual([]);
    view.unmount();
    h.dispose();
  });

  it('a sign-out while the passage is open retires it with the generation: nothing of it stays, and a late answer shows nothing', async () => {
    let release: (() => void) | null = null;
    const { h, view } = await world();
    const player = h.ready().replayPlayer;
    await savePart(view);
    h.http.on('/preview', () => new Promise((resolve) => {
      release = () => resolve({ status: 200, body: PLAYER_WIRE.steps.preview.body });
    }));
    await press(view, 'qandeel-replay-preview');
    expect(view.getByTestId(REPLAY_PLAYER_TEST_ID)).toBeTruthy();
    await act(async () => {
      h.auth.emit(null, 'SIGNED_OUT');
      await settle();
    });
    expect(h.phase().kind).toBe('SIGNED_OUT');
    expect(view.queryByTestId(REPLAY_PLAYER_TEST_ID, HIDDEN)).toBeNull();
    expect(player.getState().open).toBeNull();
    const before = h.http.calls.length;
    await act(async () => {
      release?.();
      await settle();
    });
    expect(player.getState().open).toBeNull();
    expect(h.http.calls.length).toBe(before);
    view.unmount();
    h.dispose();
  });

  it('the gate ships closed: no preview action and no Analysis entry, and no lifecycle command is ever issued', async () => {
    const { h, view } = await world({ gate: false });
    expect(view.queryByTestId('qandeel-replay-entry')).toBeNull();
    await press(view, 'qandeel-depth-to-analysis');
    await layOut(view);
    expect(view.queryByTestId('qandeel-replay-analysis-entry')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-analysis-entry-slot', HIDDEN)).toBeNull();
    expect(h.http.matching('/preview')).toHaveLength(0);
    expect(h.http.matching('/finalize')).toHaveLength(0);
    expect(h.http.matching('/reopen')).toHaveLength(0);
    expect(h.http.matching('/versions/')).toHaveLength(0);
    view.unmount();
    h.dispose();
  });
});
