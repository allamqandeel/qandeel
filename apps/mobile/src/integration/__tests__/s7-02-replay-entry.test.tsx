/**
 * S7-02 — the Personal Replay entry as the production runtime composes it: bound to THIS Session and THIS identity's
 * bearer, absent while the gate is closed (the shipped default), and a draft command that carries no identity.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import { turnEvent } from '../../replay-entry/__fixtures__/replay';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { harness, settle, type IntegrationHarness } from '../__fixtures__/integration';

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
const REPLAY = '33333333-3333-4333-8333-333333333333';

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

async function press(view: RenderResult, testID: string): Promise<void> {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await settle();
  });
}

describe('S7-02 — the Replay entry in the production composition', () => {
  it('the gate ships closed: the capability is read, and nothing else about Replay is drawn or read', async () => {
    const h = await harness();
    h.http.on('/replay/capability', () => ({ status: 200, body: { creationAvailable: false } }));
    const view = await onRoute(h);
    expect(view.getByTestId('qandeel-conversation')).toBeTruthy();
    expect(h.http.matching('/replay/capability')).toHaveLength(1);
    expect(view.queryByTestId('qandeel-replay-entry')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-entry-slot', { includeHiddenElements: true })).toBeNull();
    expect(h.http.matching('/replay/conversations')).toHaveLength(0);
    view.unmount();
    h.dispose();
  });

  it('an open gate (a controlled fixture): THIS Session, THIS bearer, and a draft body with no identity in it', async () => {
    const history = [exchange('fixture: earlier words')];
    const [turn] = history;
    const h = await harness({ liveHead: 4 });
    const sessionId = h.ready().bundle.sessionId;
    h.http.on('/turns', () => ({ status: 200, body: historyBody(history) }));
    h.http.on('/replay/capability', () => ({ status: 200, body: { creationAvailable: true } }));
    h.http.on('/replay/conversations', () => ({ status: 200, body: { replays: [] } }));
    h.http.on('/temporal/events', () => ({ status: 200, body: { sessionId, events: [turnEvent(turn.userTurn.id, 1, 2, sessionId), turnEvent(turn.reply!.id, 3, 4, sessionId)] } }));
    h.http.on('/replay/drafts', () => ({ status: 200, body: { outcome: 'CREATED', replayId: REPLAY, lifecycle: 'DRAFT', draftRevision: 1, coverageClass: 'FULL_SOURCE', selectedMomentCount: 4 } }));
    const view = await onRoute(h);
    expect(view.getByTestId('qandeel-replay-entry')).toBeTruthy();
    await press(view, 'qandeel-replay-entry');
    expect(h.http.matching(`/replay/conversations/${sessionId}`)).toHaveLength(1);
    await press(view, 'qandeel-replay-choose-whole');
    await press(view, 'qandeel-replay-save');
    const posts = h.http.matching('/replay/drafts');
    expect(posts).toHaveLength(1);
    expect(posts[0].authorization).toBe('Bearer token-1');
    expect(JSON.parse(posts[0].body!)).toEqual({ commandId: expect.stringMatching(/^[0-9a-f-]{36}$/u), sessionId, firstTc: 1, lastTc: 4 });
    for (const call of h.http.matching('/replay')) expect(call.authorization).toBe('Bearer token-1');
    expect(view.getByTestId('qandeel-replay-notice')).toBeTruthy();
    // No Session was created, and no conversation turn was written.
    expect(h.http.creates()).toHaveLength(1);
    expect(h.http.matching('/turns').filter((c) => c.method === 'POST')).toHaveLength(0);
    view.unmount();
    h.dispose();
  });
});
