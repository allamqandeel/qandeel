/**
 * S8B-07 CP1-B step 5 (Sheet A) — a finished call's record with its recording player, in Arabic and English: what the
 * record shows for each server state and each player phase (the pure mapping the view uses), CL-10 while sealed, CL-04
 * after 1 s without audio, CL-05 when it cannot be played now, CL-08 / CL-09 under the time, CL-06 / CL-07 only for the
 * cause the server proves and CL-11 (no final full stop) otherwise, in this session only; a live call refuses the play
 * with no text. FUNCTIONAL only: HC-1 … HC-5 are the device's (step 6).
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import { createManualForegroundSignal, type ConversationFinishedCallView } from '../../runtime-entry';
import { createCallListening } from '../call-listening';
import { CALL_LISTENING_TEST_ID, CallRecordListening, callListeningView } from '../CallListeningViews';
import { originalAudioText } from '../original-audio-copy';
import { createPlaybackOwner, type LiveCallSignal } from '../playback-owner';
import type { TransientPlaybackState } from '../transient-playback';
import type { TransientMediaApiClient } from '../transient-media-api';
import { createFakePlayerPort, FakeTransientServer, MINUTE } from '../__fixtures__/fake-transient-world';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.setTimeout(30000);

const CALL_ID = 'e0000000-0000-4000-8000-000000000001';
const ID = `${CALL_LISTENING_TEST_ID}-${CALL_ID}`;
const appearance = () => createAppearanceAuthority({
  store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
  system: { current: () => 'DARK', subscribe: () => () => undefined },
  native: { apply: () => undefined },
});
const tick = (ms = 0) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });

const call = (over: Partial<ConversationFinishedCallView> = {}): ConversationFinishedCallView => ({
  callId: CALL_ID, startedAt: '2026-11-01T10:00:00.000Z', endedAt: '2026-11-01T10:01:00.000Z', endReason: 'USER_ENDED', atMaxLength: false,
  recordingStatus: 'AVAILABLE', availableUntil: '2026-12-01T10:00:00.000Z', unavailableReason: null, ...over,
} as ConversationFinishedCallView);

const engineState = (over: Partial<TransientPlaybackState> = {}): TransientPlaybackState => ({
  phase: 'IDLE', waiting: false, runIndex: 0, positionMs: 0, runs: null, boundaries: [], endedReason: null, ...over,
});

let serial = 0;
const commandId = () => {
  serial += 1;
  return `f0000000-0000-4000-8000-${serial.toString(16).padStart(12, '0')}`;
};

function harness(language: 'ar' | 'en') {
  const server = new FakeTransientServer({ runs: [60_000], sourceEndsInMs: 600 * MINUTE, prepareMs: 2_000, sourceReason: 'DELETED' });
  const players = createFakePlayerPort(server, { loadDelayMs: 200, seekStallMs: 0, responseCapMs: 0 });
  const listeners = new Set<() => void>();
  let live = false;
  const signal: LiveCallSignal = { isLive: () => live, subscribe: (l) => (listeners.add(l), () => listeners.delete(l)) };
  const owner = createPlaybackOwner(signal);
  const api = {
    requestListening: (_callId: string, command: string) => server.request(command),
    status: (id: string) => server.status(id),
    release: (id: string) => server.release(id),
    audioUrl: (id: string) => `https://media.test/voice/transient/${id}`,
  } as unknown as TransientMediaApiClient;
  const listening = createCallListening({
    api, owner, player: players.port, foreground: createManualForegroundSignal('ACTIVE'), authorization: () => ({ Authorization: 'Bearer t' }), newCommandId: commandId,
  });
  const entries: string[] = [];
  const tree = (view: ConversationFinishedCallView) => (
    <AppearanceProvider authority={appearance()}>
      <CallRecordListening call={view} listening={listening} language={language} onReplayEntry={() => entries.push(view.callId)}
        record={(showLength) => <Text testID="qandeel-call-record">{showLength ? 'record with length' : 'record'}</Text>} />
    </AppearanceProvider>
  );
  return {
    server, players, listening, entries, tree,
    setLive(next: boolean) { live = next; for (const l of Array.from(listeners)) l(); },
  };
}

const text = (view: RenderResult, id: string) => {
  const node = view.getByTestId(id);
  return (Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children) as string;
};

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
});

describe('what the record shows (the mapping the view uses)', () => {
  it('a server without listening, or a recording first seen unavailable: the S8B-06 record, unchanged', () => {
    expect(callListeningView(call({ recordingStatus: undefined }), engineState(), false)).toEqual({ kind: 'RECORD' });
    expect(callListeningView(call({ recordingStatus: 'UNAVAILABLE', unavailableReason: 'DELETED' }), engineState(), false)).toEqual({ kind: 'RECORD' });
  });

  it('seen available in this session, then no longer: CL-06 / CL-07 only for a proven cause, else CL-11', () => {
    expect(callListeningView(call({ recordingStatus: 'UNAVAILABLE', unavailableReason: 'EXPIRED' }), engineState(), true)).toEqual({ kind: 'NO_LONGER', row: 'CL-06' });
    expect(callListeningView(call({ recordingStatus: 'UNAVAILABLE', unavailableReason: 'DELETED' }), engineState(), true)).toEqual({ kind: 'NO_LONGER', row: 'CL-07' });
    expect(callListeningView(call({ recordingStatus: 'UNAVAILABLE', unavailableReason: null }), engineState(), true)).toEqual({ kind: 'NO_LONGER', row: 'CL-11' });
    expect(callListeningView(call(), engineState({ phase: 'ENDED', endedReason: null }), true)).toEqual({ kind: 'NO_LONGER', row: 'CL-11' });
    expect(callListeningView(call(), engineState({ phase: 'ENDED', endedReason: 'DELETED' }), true)).toEqual({ kind: 'NO_LONGER', row: 'CL-07' });
  });

  it('sealed: PREPARING; available: the player, CL-04 only after 1 s waiting, CL-05 when it failed', () => {
    expect(callListeningView(call({ recordingStatus: 'PREPARING' }), engineState(), false)).toEqual({ kind: 'PREPARING' });
    expect(callListeningView(call(), engineState(), true)).toEqual({ kind: 'PLAYER', notice: null });
    expect(callListeningView(call(), engineState({ phase: 'PREPARING' }), true)).toEqual({ kind: 'PLAYER', notice: null });
    expect(callListeningView(call(), engineState({ phase: 'PREPARING', waiting: true }), true)).toEqual({ kind: 'PLAYER', notice: 'CL-04' });
    expect(callListeningView(call(), engineState({ phase: 'FAILED' }), true)).toEqual({ kind: 'PLAYER', notice: 'CL-05' });
  });

  it('CL-11 carries no final full stop, in either language', () => {
    expect(originalAudioText('CL-11', 'ar').endsWith('.')).toBe(false);
    expect(originalAudioText('CL-11', 'en').endsWith('.')).toBe(false);
  });
});

describe.each(['ar', 'en'] as const)('the record\'s player (%s)', (language) => {
  it('available: the record without its length, CL-01 / CL-03, CL-04 after 1 s, then CL-02 while it plays', async () => {
    const h = harness(language);
    const view = await render(h.tree(call()));
    expect(text(view, 'qandeel-call-record')).toBe('record');
    expect(view.getByTestId(`${ID}-play`).props.accessibilityLabel.startsWith(originalAudioText('CL-01', language))).toBe(true);
    await act(async () => { await fireEvent.press(view.getByTestId(`${ID}-play`)); });
    await tick(1_100);
    expect(text(view, `${ID}-waiting`)).toBe(originalAudioText('CL-04', language));
    await tick(2_000);
    expect(view.queryByTestId(`${ID}-waiting`)).toBeNull();
    expect(view.getByTestId(`${ID}-play`).props.accessibilityLabel.startsWith(originalAudioText('CL-02', language))).toBe(true);
    expect(view.getByTestId(`${ID}-line`).props.accessibilityLabel).toBe(originalAudioText('CL-03', language));
    expect(h.players.made.some((p) => p.calls.includes('play') && !p.released)).toBe(true);
  });

  it('the time opens CL-08 (the retention limit) and CL-09, the existing Replay entry', async () => {
    const h = harness(language);
    const view = await render(h.tree(call()));
    await act(async () => { await fireEvent.press(view.getByTestId(`${ID}-more`)); });
    const details = view.getByTestId(`${ID}-details`);
    const said = JSON.stringify(details);
    expect(said).toContain(originalAudioText('CL-08', language).split('{date}')[0]!.trim());
    await act(async () => { await fireEvent.press(view.getByTestId(`${ID}-replay`)); });
    expect(h.entries).toEqual([CALL_ID]);
    expect(view.getByTestId(`${ID}-replay`).props.accessibilityLabel).toBe(originalAudioText('CL-09', language));
  });

  it('sealed: CL-10 and the play not available', async () => {
    const h = harness(language);
    const view = await render(h.tree(call({ recordingStatus: 'PREPARING', availableUntil: null })));
    expect(text(view, `${ID}-preparing`)).toBe(originalAudioText('CL-10', language));
    expect(view.queryByTestId(`${ID}-play-unavailable`)).not.toBeNull();
    expect(view.queryByTestId(`${ID}-play`)).toBeNull();
  });

  it('deleted while playing: stopped, the record with its length again, CL-07 because the server proves it', async () => {
    const h = harness(language);
    const view = await render(h.tree(call()));
    await act(async () => { await fireEvent.press(view.getByTestId(`${ID}-play`)); });
    await tick(3_000);
    h.server.deleteSource();
    await tick(12_000);
    expect(text(view, `${ID}-ended`)).toBe(originalAudioText('CL-07', language));
    expect(text(view, 'qandeel-call-record')).toBe('record with length');
    expect(h.players.made.every((p) => p.released)).toBe(true);
  });

  it('the server reports it no longer available with no proven cause: CL-11, this session only', async () => {
    const h = harness(language);
    const view = await render(h.tree(call()));
    await view.rerender(h.tree(call({ recordingStatus: 'UNAVAILABLE', availableUntil: null, unavailableReason: null })));
    expect(text(view, `${ID}-ended`)).toBe(originalAudioText('CL-11', language));
    // A fresh runtime that never saw it available says nothing: the record only.
    const fresh = harness(language);
    await cleanup();
    const other = await render(fresh.tree(call({ recordingStatus: 'UNAVAILABLE', availableUntil: null, unavailableReason: null })));
    expect(other.queryByTestId(`${ID}-ended`)).toBeNull();
    expect(text(other, 'qandeel-call-record')).toBe('record with length');
  });

  it('a live call refuses the play with no text, and a call that starts mid-play stops it and releases the audio', async () => {
    const h = harness(language);
    const view = await render(h.tree(call()));
    h.setLive(true);
    await act(async () => { await fireEvent.press(view.getByTestId(`${ID}-play`)); });
    await tick(3_000);
    expect(h.server.calls).toHaveLength(0);
    expect(view.queryByTestId(`${ID}-failed`)).toBeNull();
    expect(view.queryByTestId(`${ID}-waiting`)).toBeNull();
    h.setLive(false);
    await act(async () => { await fireEvent.press(view.getByTestId(`${ID}-play`)); });
    await tick(3_000);
    expect(h.players.made.some((p) => p.calls.includes('play') && !p.released)).toBe(true);
    await act(async () => { h.setLive(true); });
    await tick(1_000);
    // What was heard stops when the call starts (the span closes), and nothing plays after.
    expect(h.players.audible.length).toBeGreaterThan(0);
    expect(h.players.made.every((p) => p.playedAfterRelease === 0)).toBe(true);
    expect(h.players.made.every((p) => p.released)).toBe(true);
    expect(view.getByTestId(`${ID}-play`).props.accessibilityLabel.startsWith(originalAudioText('CL-01', language))).toBe(true);
  });

  it('leaving the conversation releases every call\'s audio', async () => {
    const h = harness(language);
    const view = await render(h.tree(call()));
    await act(async () => { await fireEvent.press(view.getByTestId(`${ID}-play`)); });
    await tick(3_000);
    await act(async () => { h.listening.leaveAll(); });
    await tick(0);
    expect(h.players.made.every((p) => p.released)).toBe(true);
    expect(h.server.calls.some((c) => c.startsWith('DELETE'))).toBe(true);
  });
});
