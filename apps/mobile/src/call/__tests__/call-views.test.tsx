/**
 * S8B-06 CP3 — the call's surfaces over the ONE owner (G1.2, P4-C3, J7): the entry only while no call is live, the call
 * line's words only for what is not normal (the disclosure in CONNECTING only), the time with its spoken name, the
 * microphone and QANDEEL's voice as assistive status only, the notice after an end the reader did not choose, the record
 * on a call's last turn (never interactive), the interrupted mark on a cut reply, and the depth control's suffix while a
 * call continues. Both languages.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { View } from 'react-native';

import { exchange } from '../../conversation/__fixtures__/conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { ConversationExchangeView } from '../../runtime-entry';
import { liveCallScreenCopy } from '../../voice-call/live-call-copy';
import type { CallOwner, CallOwnerState } from '../call-owner';
import { liveCallKey } from '../call-owner';
import {
  CALL_ENTRY_TEST_ID, CALL_LINE_TEST_ID, CALL_NOTICE_TEST_ID, CALL_RECORD_TEST_ID, callStatusLines, formatCallLength, useCallSurface,
} from '../CallViews';

const CALL = 'f0000000-0000-4000-8000-000000000009';
const IDLE: CallOwnerState = {
  stage: 'IDLE', callId: null, activeSince: null, muted: false, route: null, audible: false, warning: null, notice: null, record: null, unchosenEnds: 0,
};

function fakeOwner(initial: Partial<CallOwnerState> = {}) {
  let state: CallOwnerState = { ...IDLE, ...initial };
  const listeners = new Set<() => void>();
  const calls: string[] = [];
  const owner: CallOwner = {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start: async () => void calls.push('start'),
    end: () => void calls.push('end'),
    toggleMute: () => void calls.push('mute'),
    toggleRoute: () => void calls.push('route'),
    dismissNotice: () => void calls.push('dismiss'),
    carryText: () => null,
    retire: () => undefined,
  };
  const set = (patch: Partial<CallOwnerState>) => act(async () => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  });
  return { owner, calls, set };
}

function Host({ owner, exchanges, language }: { owner: CallOwner; exchanges: readonly ConversationExchangeView[]; language: ChromeLanguage }): ReactElement {
  const slots = useCallSurface(owner, exchanges, language);
  return (
    <View>
      <View testID="end">{slots.composerEnd}</View>
      <View testID="above">{slots.aboveComposer}</View>
      {exchanges.map((e) => (
        <View key={e.userTurn.id} testID={`trailer-${e.userTurn.id}`}>
          {slots.exchangeTrailer(e)}
          {slots.replyCompanion(e)?.control ?? null}
        </View>
      ))}
      <View testID="tail">{slots.threadTail}</View>
      <View testID="suffix" accessibilityLabel={slots.depthNameSuffix ?? 'none'} />
    </View>
  );
}

const callTurn = (commit: string, extra: Partial<ConversationExchangeView> = {}): ConversationExchangeView => ({
  ...exchange(`said ${commit}`, { key: liveCallKey(CALL, `0000000${commit}-0000-4000-8000-000000000000`) }),
  ...extra,
});

describe.each(['ar', 'en'] as const)('S8B-06 CP3 — the call surfaces (%s)', (language) => {
  const copy = liveCallScreenCopy(language);

  it('the entry only while no call is live; a press asks the owner; busy while preparing', async () => {
    const t = fakeOwner();
    const view = await render(<Host owner={t.owner} exchanges={[]} language={language} />);
    const entry = view.getByTestId(CALL_ENTRY_TEST_ID);
    expect(entry.props.accessibilityLabel).toBe(copy.entryName);
    await fireEvent.press(entry);
    expect(t.calls).toEqual(['start']);
    await t.set({ stage: 'PREPARING' });
    expect(view.getByTestId(CALL_ENTRY_TEST_ID).props.accessibilityState).toMatchObject({ busy: true });
    await fireEvent.press(view.getByTestId(CALL_ENTRY_TEST_ID));
    expect(t.calls).toEqual(['start']);
    await t.set({ stage: 'CONNECTING', callId: CALL });
    expect(view.queryByTestId(CALL_ENTRY_TEST_ID)).toBeNull();
    expect(view.getByTestId(CALL_LINE_TEST_ID)).toBeTruthy();
    expect(view.getByTestId('suffix').props.accessibilityLabel).toBe(copy.continuesSuffix);
  });

  it('the disclosure in CONNECTING only; an ordinary ACTIVE call shows no status words', async () => {
    const t = fakeOwner({ stage: 'CONNECTING', callId: CALL });
    const view = await render(<Host owner={t.owner} exchanges={[]} language={language} />);
    expect(view.getByText(copy.disclosure)).toBeTruthy();
    expect(view.getByText(copy.connecting)).toBeTruthy();
    await t.set({ stage: 'ACTIVE', activeSince: Date.now() });
    expect(view.queryByText(copy.disclosure)).toBeNull();
    expect(callStatusLines({ ...IDLE, stage: 'ACTIVE' }, copy)).toEqual([]);
    for (const [patch, line] of [
      [{ stage: 'RECONNECTING' }, copy.reconnecting], [{ stage: 'HELD' }, copy.held],
      [{ stage: 'ACTIVE', warning: 'T5' }, copy.warningT5], [{ stage: 'ACTIVE', warning: 'T1' }, copy.warningT1],
    ] as const) {
      await t.set({ warning: null, ...patch });
      expect(view.getByText(line)).toBeTruthy();
      expect(view.queryByText(copy.disclosure)).toBeNull();
    }
  });

  it('the time is m:ss with its spoken name; the microphone and QANDEEL\'s voice are assistive status only', async () => {
    const t = fakeOwner({ stage: 'ACTIVE', callId: CALL, activeSince: Date.now() });
    const view = await render(<Host owner={t.owner} exchanges={[]} language={language} />);
    const time = view.getByLabelText(copy.elapsedName('0:00'));
    expect(time.props.accessibilityValue).toEqual({ text: copy.microphoneOn });
    expect(view.queryByText(copy.microphoneOn)).toBeNull();
    await t.set({ muted: true, audible: true });
    expect(view.getByLabelText(copy.elapsedName('0:00')).props.accessibilityValue).toEqual({ text: `${copy.microphoneMuted}. ${copy.speaking}` });
    expect(view.queryByText(copy.speaking)).toBeNull();
    expect(formatCallLength(61_400)).toBe('1:01');
    expect(formatCallLength(3_600_000)).toBe('60:00');
  });

  it('the rail is the owner\'s: mute, route and End are its commands', async () => {
    const t = fakeOwner({ stage: 'ACTIVE', callId: CALL, activeSince: Date.now(), route: 'LOUDSPEAKER' });
    const view = await render(<Host owner={t.owner} exchanges={[]} language={language} />);
    await fireEvent.press(view.getByLabelText(copy.mute));
    await fireEvent.press(view.getByLabelText(copy.route));
    await fireEvent.press(view.getByLabelText(copy.endCall));
    expect(t.calls).toEqual(['mute', 'route', 'end']);
  });

  it('after an end the reader did not choose: the notice, the entry again, no line', async () => {
    const t = fakeOwner({ stage: 'ACTIVE', callId: CALL, activeSince: Date.now() });
    const view = await render(<Host owner={t.owner} exchanges={[]} language={language} />);
    await t.set({ stage: 'IDLE', callId: null, activeSince: null, notice: 'MICROPHONE_LOST', unchosenEnds: 1, record: { callId: CALL, lengthMs: 75_000, stopped: true } });
    expect(view.queryByTestId(CALL_LINE_TEST_ID)).toBeNull();
    expect(view.getByTestId(CALL_NOTICE_TEST_ID)).toBeTruthy();
    expect(view.getByText(copy.notice.MICROPHONE_LOST)).toBeTruthy();
    expect(view.getByTestId(CALL_ENTRY_TEST_ID)).toBeTruthy();
    expect(view.getByTestId('suffix').props.accessibilityLabel).toBe('none');
  });

  it('a microphone refusal offers the system settings', async () => {
    const t = fakeOwner({ notice: 'MIC_PERMISSION' });
    const view = await render(<Host owner={t.owner} exchanges={[]} language={language} />);
    expect(view.getByText(copy.notice.MIC_PERMISSION)).toBeTruthy();
    expect(view.getByTestId(`${CALL_NOTICE_TEST_ID}:settings`).props.accessibilityLabel).toBe(copy.openSettings);
  });

  it('J7: the record follows the call\'s LAST turn only, never while the call is live, and is not interactive', async () => {
    const turns = [exchange('written'), callTurn('1'), callTurn('2')];
    const t = fakeOwner({ stage: 'ACTIVE', callId: CALL, activeSince: Date.now() });
    const view = await render(<Host owner={t.owner} exchanges={turns} language={language} />);
    expect(view.queryByTestId(CALL_RECORD_TEST_ID)).toBeNull();
    await t.set({ stage: 'IDLE', callId: null, activeSince: null, record: { callId: CALL, lengthMs: 125_000, stopped: true } });
    const records = view.getAllByTestId(CALL_RECORD_TEST_ID);
    expect(records).toHaveLength(1);
    expect(view.getByTestId(`trailer-${turns[2].userTurn.id}`)).toContainElement(records[0]);
    expect(records[0].props.accessibilityLabel).toBe(`${copy.recordSummary('2:05')}. ${copy.recordStopped}`);
    expect(records[0].props.onPress).toBeUndefined();
    expect(records[0].props.accessibilityRole).toBeUndefined();
    expect(view.getByTestId('tail').children).toHaveLength(0);
  });

  it('a past call known only by its turns shows the record without a length; a call with no turn is the thread\'s tail', async () => {
    const turns = [callTurn('1')];
    const t = fakeOwner();
    const view = await render(<Host owner={t.owner} exchanges={turns} language={language} />);
    expect(view.getByTestId(CALL_RECORD_TEST_ID).props.accessibilityLabel).toBe(copy.recordWord);
    const empty = fakeOwner({ record: { callId: 'e0000000-0000-4000-8000-00000000000e', lengthMs: 9_000, stopped: false } });
    const other = await render(<Host owner={empty.owner} exchanges={[exchange('written')]} language={language} />);
    expect(other.getByTestId('tail')).toContainElement(other.getByTestId(CALL_RECORD_TEST_ID));
    expect(other.getByTestId(CALL_RECORD_TEST_ID).props.accessibilityLabel).toBe(copy.recordSummary('0:09'));
  });

  it('a reply the reader cut is marked as cut; a whole one is not', async () => {
    const cut = callTurn('1', { deliveryState: 'INTERRUPTED' });
    const whole = callTurn('2', { deliveryState: 'COMPLETE' });
    const t = fakeOwner({ stage: 'ACTIVE', callId: CALL, activeSince: Date.now() });
    const view = await render(<Host owner={t.owner} exchanges={[cut, whole]} language={language} />);
    expect(view.getByTestId(`qandeel-call-interrupted-${cut.userTurn.id}`)).toBeTruthy();
    expect(view.queryByTestId(`qandeel-call-interrupted-${whole.userTurn.id}`)).toBeNull();
    expect(view.getByText(copy.interrupted)).toBeTruthy();
  });
});
