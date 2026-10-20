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
import { replayCompositeCopy } from '../../replay-composite';
import { REPLAY_PLAYER_TEST_ID, replayPlayerCopy } from '../../replay-player';
import { PLAYER_IDS, PLAYER_WIRE, playerServer, type PlayerServer } from '../../replay-player/__fixtures__/player-wire';
import { turnEvent } from '../../replay-entry/__fixtures__/replay';
import { RESPONSIVE_MAP_FRAME_TEST_ID, RESPONSIVE_SURFACE_TEST_ID } from '../../responsive';
import { TEST_CONFIG } from '../../runtime-entry/__fixtures__/runtime-entry';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { harness, settle, snapshot, worldDisclosure, SESSION_A, SESSION_B, type IntegrationHarness } from '../__fixtures__/integration';
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

/**
 * S7-05 D5 (1) — an account switch after a sign-out. Account A saves, previews and privately finalizes a Replay, then
 * signs out; account B signs in through the explicit path into its own Session. Nothing of A's Replay — its passage,
 * its notice, its conversation, its ids — reaches B's screen or B's requests, and B's Analysis offers B's own (empty)
 * history, never A's. The Replay A made is the captured one; B's server answers B's own reads only.
 */
describe('S7-05 D5 — an account switch after a sign-out shows nothing of the previous account', () => {
  const USER_2 = { userId: 'user-2', accessToken: 'token-2' };
  const B = `Bearer ${USER_2.accessToken}`;

  it('A finalizes a Replay and signs out; B signs in: no passage, notice, conversation or id of A appears, and no request of B names A', async () => {
    const { h, server, view } = await world();
    await savePart(view);
    await press(view, 'qandeel-replay-preview');
    await layOut(view);
    await press(view, 'qandeel-replay-player-finalize');
    expect(text(view, 'qandeel-replay-player-sentence')).toBe(PLAYER_WORDS.finalizedNotice);
    expect(h.ready().bundle.sessionId).toBe(SESSION_A);

    // B's own world, routed by B's credential: a new Session with one committed exchange of its own (so B's Analysis
    // entry is live, not a held slot), and an empty Replay history.
    const own = (call: { authorization: string | null }) => call.authorization === B;
    const unexpectedOfB: string[] = [];
    const HISTORY_B = [exchange('fixture: the second account’s words')];
    const EVENTS_B = [turnEvent(HISTORY_B[0].userTurn.id, 1, 1, SESSION_B), turnEvent(HISTORY_B[0].reply!.id, 2, 2, SESSION_B)];
    h.http.on('/conversation/sessions', (call) => ({
      status: 201,
      body: { id: own(call) ? SESSION_B : SESSION_A, user_id: own(call) ? USER_2.userId : 'user-1', status: 'ACTIVE', channel: 'TEXT', created_at: 'now', updated_at: 'now', last_activity_at: 'now', closed_at: null },
    }));
    h.http.on('/temporal', (call) => ({ status: 200, body: snapshot({ sessionId: own(call) ? SESSION_B : SESSION_A, liveHead: own(call) ? 2 : 8 }) }));
    h.http.on('/temporal/events', (call) => ({ status: 200, body: own(call) ? { sessionId: SESSION_B, events: EVENTS_B } : { sessionId: SESSION_A, events: EVENTS(SESSION_A) } }));
    h.http.on('/historical-projection', (call) => ({ status: 200, body: own(call) ? worldDisclosure(SESSION_B, 2, 2) : worldDisclosure(SESSION_A, 8, 8) }));
    h.http.on('/turns', (call) => ({ status: 200, body: historyBody(own(call) ? HISTORY_B : HISTORY) }));
    h.http.on('/replay', async (call) => {
      if (own(call)) {
        if (call.url.endsWith('/replay/capability')) return { status: 200, body: { creationAvailable: true } };
        if (call.url.endsWith(`/replay/conversations/${SESSION_B}`)) return { status: 200, body: { replays: [] } };
        unexpectedOfB.push(`${call.method} ${call.url}`);
        return { status: 404, body: { code: 'NOT_FOUND' } };
      }
      const answer = await server.fetch(call.url, { method: call.method, ...(call.body === null ? {} : { body: call.body }) });
      return { status: answer.status, body: await answer.json() };
    });

    await act(async () => {
      await h.runtime.auth.signOut();
      await settle();
    });
    expect(h.phase().kind).toBe('SIGNED_OUT');
    expect(view.queryByTestId(REPLAY_PLAYER_TEST_ID, HIDDEN)).toBeNull();
    const signedOutAt = h.http.calls.length;

    await act(async () => {
      h.auth.signInWith({ ok: true, value: USER_2 });
      await h.runtime.auth.signInWithPassword('validation identity', 'validation credential');
      await settle();
    });
    const second = h.ready();
    expect(second.bundle.sessionId).toBe(SESSION_B);
    expect(second.replayPlayer.getState().open).toBeNull();
    await layOut(view);

    // B's own conversation is on screen; nothing of A, mounted or hidden: no passage, no saved notice, none of A's words.
    expect(view.getAllByText(HISTORY_B[0].userTurn.content, { exact: false }).length).toBeGreaterThan(0);
    expect(view.queryByTestId(REPLAY_PLAYER_TEST_ID, HIDDEN)).toBeNull();
    expect(view.queryByTestId('qandeel-replay-notice', HIDDEN)).toBeNull();
    for (const exchangeOfA of HISTORY) expect(view.queryAllByText(exchangeOfA.userTurn.content, { ...HIDDEN, exact: false })).toHaveLength(0);
    for (const moment of MOMENTS) expect(view.queryAllByText(moment.text, { ...HIDDEN, exact: false })).toHaveLength(0);

    // B's Analysis: its Replay entry (the gate answers B open) reads B's own empty history, never A's Replay.
    await press(view, 'qandeel-depth-to-analysis');
    await layOut(view);
    await press(view, 'qandeel-replay-analysis-entry');
    await layOut(view);
    const listsOfB = h.http.calls.slice(signedOutAt).filter((call) => call.url.includes('/replay/conversations/'));
    expect(listsOfB.length).toBeGreaterThan(0);
    for (const call of listsOfB) expect(call.url.endsWith(`/replay/conversations/${SESSION_B}`)).toBe(true);
    for (const moment of MOMENTS) expect(view.queryAllByText(moment.text, { ...HIDDEN, exact: false })).toHaveLength(0);

    // Every request after the sign-out is B's, and none names A's Session, A's Replay or A's version.
    const afterSwitch = h.http.calls.slice(signedOutAt);
    expect(afterSwitch.length).toBeGreaterThan(0);
    expect(afterSwitch.some((call) => call.url.endsWith('/replay/capability'))).toBe(true);
    for (const call of afterSwitch) {
      if (call.authorization !== null) expect(call.authorization).toBe(B);
      for (const ofA of [SESSION_A, PLAYER_IDS.replay, PLAYER_IDS.v1, PLAYER_IDS.session]) {
        expect(call.url).not.toContain(ofA);
        expect(call.body ?? '').not.toContain(ofA);
      }
    }
    expect(unexpectedOfB).toEqual([]);
    expect(h.http.matching('/replay').filter((call) => call.authorization === B && call.method === 'POST')).toHaveLength(0);
    view.unmount();
    h.dispose();
  });
});

/**
 * S7-05 D5 (4) — NOT_VIEWABLE through the real path, in the production composition. The chain is real end to end: the
 * 0169 wrappers' rows on a real PostgreSQL database (verifier E07 proves the same withdrawal there), passed through the
 * REAL ReplayService (`apps/api/src/replay/replay-player-proof.spec.ts`), give the captured wire the production clients
 * read here. The reader saves the captured source part (1 .. 3), previews it, and its original message changes before
 * they save a private copy: the finalization is refused, and the passage reads its version again as NOT_VIEWABLE.
 */
describe('S7-05 D5 — NOT_VIEWABLE through the real path, in the production composition', () => {
  it('the source changes after the preview: Finalize is refused, and the passage shows the reason and both layers — no text, no Map, no analysis read', async () => {
    const { h, server, view } = await world();
    const COMPOSITE_WORDS = replayCompositeCopy(LANGUAGE);
    const SOURCE_MOMENTS = (PLAYER_WIRE.scenes.source.moments as { moments: { text: string }[] }).moments;
    await press(view, 'qandeel-replay-entry');
    await press(view, 'qandeel-replay-choose-part');
    await press(view, `qandeel-selectable-${HISTORY[0].userTurn.id}`);
    await press(view, `qandeel-selectable-${HISTORY[0].reply!.id}`);
    await press(view, 'qandeel-replay-save');
    expect(JSON.parse(h.http.matching('/replay/drafts')[0].body!)).toMatchObject({ firstTc: 1, lastTc: 3 });
    await press(view, 'qandeel-replay-preview');
    await layOut(view);
    expect(text(view, 'qandeel-replay-text')).toBe(SOURCE_MOMENTS[0].text);
    expect(view.queryByTestId('qandeel-replay-not-viewable')).toBeNull();

    server.withdrawSource();
    await press(view, 'qandeel-replay-player-finalize');
    await layOut(view);
    expect(text(view, 'qandeel-replay-player-sentence')).toBe(replayEntryCopy(LANGUAGE).changed);
    expect(h.http.matching('/finalize')).toHaveLength(1);
    const analysisReadsBefore = h.http.matching('/analysis').length;
    await layOut(view);

    // The version read again is the captured withdrawn one: its reason and both layers, and nothing of the messages.
    expect(view.getByTestId('qandeel-replay-not-viewable')).toBeTruthy();
    expect(text(view, 'qandeel-replay-not-viewable-reason')).toBe(COMPOSITE_WORDS.notViewable('SOURCE_NOT_CURRENTLY_AVAILABLE'));
    expect(text(view, 'qandeel-replay-source-layer')).toBe(COMPOSITE_WORDS.sourceLayerUnavailable);
    expect(text(view, 'qandeel-replay-analytical-layer')).toBe(COMPOSITE_WORDS.analyticalLayerSealed);
    expect(text(view, 'qandeel-replay-no-analysis-without-text')).toBe(COMPOSITE_WORDS.noAnalysisWithoutText);
    expect(view.queryByTestId('qandeel-replay-text')).toBeNull();
    for (const moment of SOURCE_MOMENTS) expect(view.queryAllByText(moment.text, { ...HIDDEN, exact: false })).toHaveLength(0);
    expect(view.queryByTestId(MAP_SURFACE_TEST_ID)).toBeNull();
    // Nothing is playable — no Spine is offered over a version that is not viewable — and no moment analysis is read.
    expect(view.queryByTestId('qandeel-replay-spine', HIDDEN)).toBeNull();
    expect(h.ready().replayPlayer.transport().available).toBe(false);
    await act(async () => {
      await settle();
    });
    expect(h.http.matching('/analysis').length).toBe(analysisReadsBefore);
    for (const call of h.http.matching(`/replay/${PLAYER_IDS.source}/versions/`)) expect(call.authorization).toBe('Bearer token-1');
    expect(server.uncaptured).toEqual([]);
    view.unmount();
    h.dispose();
  });
});
