/**
 * S8B-06 CP3 R3 (the Product Owner's CP3 Review R1 decision, option A; migration 0193) — the finished-call record (J7)
 * from the server's durable truth. The history page carries the Session's finished calls (`calls`, additively); the phone
 * decodes them strictly, keeps them across pages, and draws each record from the server's own instants and end reason:
 * after a restart (no runtime record at all) the length and «توقفت» are still there, a call that left no turn has its
 * record at its end's place in the thread, and a call the server does not list (one that never became ACTIVE) has none.
 * Both languages.
 */
import { act, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { View } from 'react-native';

import { createConversationController } from '../../conversation';
import { exchange, flush, historyBody, page, scriptedTransport } from '../../conversation/__fixtures__/conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import { ConversationTurnApiClient, type ConversationExchangeView, type ConversationFinishedCallView } from '../../runtime-entry';
import { SESSION_A, TEST_CONFIG, httpDouble } from '../../runtime-entry/__fixtures__/runtime-entry';
import { liveCallScreenCopy } from '../../voice-call/live-call-copy';
import type { CallOwner, CallOwnerState } from '../call-owner';
import { liveCallKey } from '../call-owner';
import { CALL_RECORD_TEST_ID, useCallSurface } from '../CallViews';

const CALL = 'f0000000-0000-4000-8000-000000000009';
const SILENT = 'f0000000-0000-4000-8000-00000000000a';
const EARLY = 'f0000000-0000-4000-8000-00000000000b';
const IDLE: CallOwnerState = {
  stage: 'IDLE', callId: null, activeSince: null, muted: false, route: null, audible: false, warning: null, notice: null, record: null, unchosenEnds: 0,
};
// The fixture's clock: exchange order n is created at 10:mm:ss with n seconds past 10:00 (2026-09-28, UTC).
const at = (seconds: number, ms = 0) => new Date(Date.UTC(2026, 8, 28, 10, 0, seconds, ms)).toISOString();
const finished = (callId: string, started: string, ended: string, endReason: ConversationFinishedCallView['endReason'] = 'USER_ENDED', atMaxLength = false): ConversationFinishedCallView =>
  ({ callId, startedAt: started, endedAt: ended, endReason, atMaxLength });

function owner(initial: Partial<CallOwnerState> = {}): { owner: CallOwner; set: (patch: Partial<CallOwnerState>) => Promise<void> } {
  let state: CallOwnerState = { ...IDLE, ...initial };
  const listeners = new Set<() => void>();
  return {
    owner: {
      getState: () => state,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      start: async () => undefined, end: () => undefined, toggleMute: () => undefined, toggleRoute: () => undefined,
      dismissNotice: () => undefined, carryText: () => null, retire: () => undefined,
    },
    set: (patch) => act(async () => {
      state = { ...state, ...patch };
      for (const listener of listeners) listener();
    }),
  };
}

function Host({ callOwner, exchanges, calls, language }: {
  callOwner: CallOwner; exchanges: readonly ConversationExchangeView[]; calls: readonly ConversationFinishedCallView[]; language: ChromeLanguage;
}): ReactElement {
  const slots = useCallSurface(callOwner, exchanges, language, calls);
  return (
    <View>
      <View testID="head">{slots.threadHead}</View>
      {exchanges.map((e) => <View key={e.userTurn.id} testID={`trailer-${e.userTurn.id}`}>{slots.exchangeTrailer(e)}</View>)}
      <View testID="tail">{slots.threadTail}</View>
    </View>
  );
}

const callTurn = (commit: string, order: number): ConversationExchangeView =>
  exchange(`said ${commit}`, { order, key: liveCallKey(CALL, `0000000${commit}-0000-4000-8000-000000000000`) });

describe('S8B-06 CP3 R3 — the history carries the finished calls (decoder)', () => {
  const api = (body: unknown) => {
    const http = httpDouble();
    http.on('/turns', () => ({ status: 200, body }));
    return new ConversationTurnApiClient({ baseUrl: TEST_CONFIG.apiBaseUrl, fetch: http.fetch });
  };
  const view = exchange('fixture: one');
  const call = finished(CALL, '2026-11-04T10:00:00.250Z', '2026-11-04T10:01:05.750Z', 'PEER_LOST_AFTER_GRACE');

  it('accepts the calls beside the exchanges, and a page without them is exactly the page it was', async () => {
    await expect(api({ ...(historyBody([view]) as object), calls: [call] }).readHistory(SESSION_A))
      .resolves.toEqual({ kind: 'PAGE', page: { exchanges: [view], hasOlder: false, calls: [call] } });
    await expect(api(historyBody([view])).readHistory(SESSION_A)).resolves.toEqual({ kind: 'PAGE', page: { exchanges: [view], hasOlder: false } });
  });

  it('refuses a malformed call: never a guessed length or reason', async () => {
    for (const bad of [
      'calls', [{ ...call, callId: '' }], [{ ...call, startedAt: 'yesterday' }], [{ ...call, endedAt: '2026-11-04T09:59:59.000Z' }],
      [{ ...call, endReason: 'HUNG_UP' }], [{ ...call, endReason: undefined }], [null],
      // D6: the maximum-length fact is required, a boolean, and only ever the server's own end.
      [{ ...call, atMaxLength: undefined }], [{ ...call, atMaxLength: 'yes' }], [{ ...call, atMaxLength: true }],
    ]) {
      await expect(api({ ...(historyBody([view]) as object), calls: bad }).readHistory(SESSION_A)).resolves.toEqual({ kind: 'UNAVAILABLE', reason: 'MALFORMED_RESPONSE' });
    }
  });
});

describe('S8B-06 CP3 R3 — the Conversation keeps the finished calls across pages (controller)', () => {
  it('merges the calls of the newest and the older pages, one per call, oldest to newest by their end', async () => {
    const transport = scriptedTransport();
    const controller = createConversationController({ sessionId: SESSION_A, transport, isCurrent: () => true, onReplyCommitted: () => undefined });
    expect(controller.getState().calls).toEqual([]);
    const newest = [exchange('c', { order: 30 })];
    const late = finished(CALL, at(40), at(50));
    controller.ensureHistory();
    transport.answerRead({ kind: 'PAGE', page: { exchanges: newest, hasOlder: true, calls: [late] } });
    await flush();
    expect(controller.getState().calls).toEqual([late]);
    controller.loadOlder();
    const early = finished(EARLY, at(1), at(5), 'SERVER_ENDED');
    transport.answerRead({ kind: 'PAGE', page: { exchanges: [exchange('a', { order: 10 })], hasOlder: false, calls: [early] } });
    await flush();
    expect(controller.getState().calls).toEqual([early, late]);
    // A refresh of the newest page carries the same call again: still one record.
    controller.ensureHistory();
    transport.answerRead({ kind: 'PAGE', page: { exchanges: newest, hasOlder: true, calls: [late] } });
    await flush();
    expect(controller.getState().calls).toEqual([early, late]);
    // A page from a server without the field changes nothing.
    controller.ensureHistory();
    transport.answerRead(page(newest, true));
    await flush();
    expect(controller.getState().calls).toEqual([early, late]);
  });
});

describe.each(['ar', 'en'] as const)('S8B-06 CP3 R3 — the record drawn from the server\'s truth (%s)', (language) => {
  const copy = liveCallScreenCopy(language);

  it('after a restart (no runtime record): the length is the server\'s ended − started, and «stopped» its end reason', async () => {
    const turns = [exchange('written', { order: 1 }), callTurn('1', 2), callTurn('2', 3)];
    const restarted = owner();
    const view = await render(<Host callOwner={restarted.owner} exchanges={turns} calls={[finished(CALL, at(2), at(2 + 125, 400), 'SERVER_ENDED')]} language={language} />);
    const records = view.getAllByTestId(CALL_RECORD_TEST_ID);
    expect(records).toHaveLength(1);
    expect(view.getByTestId(`trailer-${turns[2].userTurn.id}`)).toContainElement(records[0]);
    expect(records[0].props.accessibilityLabel).toBe(`${copy.recordSummary('2:05')}. ${copy.recordStopped}`);
    // The person's own End: no «stopped».
    const chosen = await render(<Host callOwner={owner().owner} exchanges={turns} calls={[finished(CALL, at(2), at(2 + 75))]} language={language} />);
    expect(chosen.getByTestId(CALL_RECORD_TEST_ID).props.accessibilityLabel).toBe(copy.recordSummary('1:15'));
  });

  it("D6: the end at the maximum length is not «stopped»: the server's at_max_length decides, never SERVER_ENDED alone", async () => {
    const turns = [exchange('written', { order: 1 }), callTurn('1', 2)];
    const hour = 60 * 60;
    const atMax = await render(<Host callOwner={owner().owner} exchanges={turns} calls={[finished(CALL, at(2), at(2 + hour), 'SERVER_ENDED', true)]} language={language} />);
    expect(atMax.getByTestId(CALL_RECORD_TEST_ID).props.accessibilityLabel).toBe(copy.recordSummary('60:00'));
    // Counter-test: the same reason and the same length, without the server's fact, still reads «stopped».
    const without = await render(<Host callOwner={owner().owner} exchanges={turns} calls={[finished(CALL, at(2), at(2 + hour), 'SERVER_ENDED')]} language={language} />);
    expect(without.getByTestId(CALL_RECORD_TEST_ID).props.accessibilityLabel).toBe(`${copy.recordSummary('60:00')}. ${copy.recordStopped}`);
  });

  it('the server\'s record stands over the phone\'s own count once a read carries it', async () => {
    const turns = [callTurn('1', 2)];
    const t = owner({ record: { callId: CALL, lengthMs: 9_000, stopped: true } });
    const view = await render(<Host callOwner={t.owner} exchanges={turns} calls={[]} language={language} />);
    expect(view.getByTestId(CALL_RECORD_TEST_ID).props.accessibilityLabel).toBe(`${copy.recordSummary('0:09')}. ${copy.recordStopped}`);
    await view.rerender(<Host callOwner={t.owner} exchanges={turns} calls={[finished(CALL, at(2), at(2 + 10))]} language={language} />);
    expect(view.getAllByTestId(CALL_RECORD_TEST_ID)).toHaveLength(1);
    expect(view.getByTestId(CALL_RECORD_TEST_ID).props.accessibilityLabel).toBe(copy.recordSummary('0:10'));
  });

  it('a call that left no turn keeps its record after a restart, at its end\'s place in the thread', async () => {
    const turns = [exchange('first', { order: 10 }), exchange('second', { order: 20 })];
    const calls = [finished(EARLY, at(1), at(4)), finished(SILENT, at(12), at(15), 'FAILED')];
    const view = await render(<Host callOwner={owner().owner} exchanges={turns} calls={calls} language={language} />);
    const records = view.getAllByTestId(CALL_RECORD_TEST_ID);
    expect(records).toHaveLength(2);
    // EARLY ended before the first turn: before it. SILENT ended between the two turns: after the first.
    expect(view.getByTestId('head')).toContainElement(records[0]);
    expect(records[0].props.accessibilityLabel).toBe(copy.recordSummary('0:03'));
    expect(view.getByTestId(`trailer-${turns[0].userTurn.id}`)).toContainElement(records[1]);
    expect(records[1].props.accessibilityLabel).toBe(`${copy.recordSummary('0:03')}. ${copy.recordStopped}`);
    expect(view.getByTestId(`trailer-${turns[1].userTurn.id}`).children).toHaveLength(0);
    expect(view.getByTestId('tail').children).toHaveLength(0);
  });

  it('a Session whose only call left no turn: its record alone, at the tail', async () => {
    const view = await render(<Host callOwner={owner().owner} exchanges={[]} calls={[finished(SILENT, at(1), at(31))]} language={language} />);
    expect(view.getByTestId('tail')).toContainElement(view.getByTestId(CALL_RECORD_TEST_ID));
    expect(view.getByTestId(CALL_RECORD_TEST_ID).props.accessibilityLabel).toBe(copy.recordSummary('0:30'));
    expect(view.getByTestId('head').children).toHaveLength(0);
  });

  it('counter-test: a call the server does not list (it never became ACTIVE) and the runtime never recorded has no record', async () => {
    const view = await render(<Host callOwner={owner().owner} exchanges={[exchange('written', { order: 1 })]} calls={[]} language={language} />);
    expect(view.queryByTestId(CALL_RECORD_TEST_ID)).toBeNull();
  });

  it('the live call is never drawn as finished, whatever a page says', async () => {
    const live = owner({ stage: 'ACTIVE', callId: SILENT, activeSince: Date.now() });
    const view = await render(<Host callOwner={live.owner} exchanges={[]} calls={[finished(SILENT, at(1), at(2))]} language={language} />);
    expect(view.queryByTestId(CALL_RECORD_TEST_ID)).toBeNull();
  });
});
