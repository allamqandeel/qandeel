/**
 * S8B-07 CP1-B step 5 (Sheet B, B1a – B1c; RA-13 / RA-16) — a voice turn of several units in the Replay selection, in the
 * REAL Conversation surface: still ONE message with ONE mark (the S7-02 anchors are unchanged), its hint RA-16, RA-13
 * with the length under it only where the server gave the length, nothing on a text turn or a one-unit voice turn, and a
 * press that selects or removes the whole turn. Arabic and English.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';

import { ConversationSurface, createConversationController, type ConversationController } from '../../conversation';
import { exchange, page, scriptedTransport } from '../../conversation/__fixtures__/conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import { ReplayEntryControl, ReplayEntryMenu, createReplayEntryController, replayEntryCopy, useReplaySelection, type ReplayEntryController } from '../../replay-entry';
import { SESSION, fakeReplayTransport, flush, timeline } from '../../replay-entry/__fixtures__/replay';
import type { ConversationExchangeView } from '../../runtime-entry';
import { originalAudioLengthText, originalAudioText } from '../original-audio-copy';
import { useVoicePassageSelection, voicePassages, withVoicePassages } from '../voice-passage-selection';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };

function Composed({ conversation, replay, language }: { conversation: ConversationController; replay: ReplayEntryController; language: ChromeLanguage }) {
  const selection = useVoicePassageSelection(useReplaySelection(replay, conversation, language, INSETS), replay, conversation, language);
  return (
    <ConversationSurface
      controller={conversation}
      language={language}
      insets={INSETS}
      onOpenAnalysis={() => undefined}
      chromeEnd={<ReplayEntryControl controller={replay} language={language} />}
      overlay={<ReplayEntryMenu controller={replay} language={language} insets={INSETS} />}
      selection={selection}
    />
  );
}

/** A text exchange, a Voice Note of three units (83 s), a one-unit Voice Note, and a live call's exchange of two units each. */
function history(): ConversationExchangeView[] {
  const text = exchange('fixture: text', { reply: 'fixture: text reply' });
  const voice = { ...exchange('fixture: a long voice note', { reply: 'fixture: voice reply' }), voiceNote: { recordingId: 'r-1', available: true, availableUntil: null, durationMs: 83_000 } };
  const short = { ...exchange('fixture: short', { reply: 'fixture: short reply' }), voiceNote: { recordingId: 'r-2', available: true, availableUntil: null, durationMs: 4_000 } };
  const call = { ...exchange('fixture: said in a call', { reply: 'fixture: spoken reply' }), deliveryState: 'COMPLETE' as const };
  return [text, voice, short, call];
}

async function mounted(language: ChromeLanguage) {
  const turns = history();
  const units = new Map<string, number>([[turns[1]!.userTurn.id, 3], [turns[2]!.userTurn.id, 1], [turns[3]!.userTurn.id, 2], [turns[3]!.reply!.id, 2]]);
  const transport = scriptedTransport();
  const conversation = createConversationController({
    sessionId: SESSION, transport, isCurrent: () => true, onReplyCommitted: () => undefined,
    newSubmissionKey: () => 'key-1', setTimer: () => null, clearTimer: () => undefined,
  });
  const replayTransport = fakeReplayTransport({ events: timeline(turns, { units: (id) => units.get(id) ?? 2 }) });
  const replay = createReplayEntryController({ sessionId: SESSION, transport: replayTransport, conversation, isCurrent: () => true, newCommandId: () => 'cmd-1' });
  const view: RenderResult = await render(<Composed conversation={conversation} replay={replay} language={language} />);
  await act(async () => {
    transport.answerRead(page(turns));
    await flush();
  });
  return { view, turns };
}

async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await flush();
  });
}

describe('the words of a multi-unit voice turn (pure)', () => {
  it('RA-16 on its mark, RA-13 with the server\'s length; nothing on text, one unit, or a turn the proof does not hold', () => {
    const turns = history();
    const units = new Map<string, number>([
      [turns[0]!.userTurn.id, 3], [turns[1]!.userTurn.id, 3], [turns[2]!.userTurn.id, 1], [turns[3]!.userTurn.id, 2], [turns[3]!.reply!.id, 2],
    ]);
    const words = voicePassages(turns, units, 'en');
    expect(words.get(turns[0]!.userTurn.id)).toBeUndefined();
    expect(words.get(turns[1]!.userTurn.id)).toEqual({ hint: originalAudioText('RA-16', 'en'), beneath: originalAudioLengthText('RA-13', 'en', 83_000) });
    expect(words.get(turns[1]!.reply!.id)).toBeUndefined();
    expect(words.get(turns[2]!.userTurn.id)).toBeUndefined();
    // A call's turns are spoken; the server gives no per-turn length, so the hint only.
    expect(words.get(turns[3]!.userTurn.id)).toEqual({ hint: originalAudioText('RA-16', 'en') });
    expect(words.get(turns[3]!.reply!.id)).toEqual({ hint: originalAudioText('RA-16', 'en') });
    expect(voicePassages(turns, new Map(), 'en').size).toBe(0);
  });

  it('never words a mark that is not selectable, and leaves a selection without passages as it is', () => {
    const base = { title: 't', interactive: true, onToggle: () => undefined, bar: <></>, markOf: () => ({ mark: 'NONE' as const, joinAbove: false, joinBelow: false }) };
    const worded = withVoicePassages(base, new Map([['a', { hint: 'h' }]]));
    expect(worded!.markOf('a')).toEqual({ mark: 'NONE', joinAbove: false, joinBelow: false });
    expect(withVoicePassages(base, new Map())).toBe(base);
    expect(withVoicePassages(null, new Map([['a', { hint: 'h' }]]))).toBeNull();
  });
});

describe.each(['ar', 'en'] as const)('in the Conversation surface (%s)', (language) => {
  it('B1a: one mark with RA-16 and RA-13 under the long Voice Note; the text and the one-unit turn carry nothing', async () => {
    const { view, turns } = await mounted(language);
    await press(view, 'qandeel-replay-entry');
    await press(view, 'qandeel-replay-choose-part');
    const voice = turns[1]!.userTurn.id;
    expect(view.getByTestId(`qandeel-selectable-${voice}`).props.accessibilityHint).toBe(originalAudioText('RA-16', language));
    expect(view.getByTestId(`qandeel-selectable-${voice}`).props.accessibilityRole).toBe('checkbox');
    expect(view.getAllByTestId(`qandeel-selection-mark-${voice}`)).toHaveLength(1);
    const beneath = view.getByTestId(`qandeel-selection-beneath-${voice}`);
    expect(beneath.props.children).toBe(originalAudioLengthText('RA-13', language, 83_000));
    expect(beneath.props.style).toEqual(expect.objectContaining({ writingDirection: language === 'ar' ? 'rtl' : 'ltr' }));
    for (const id of [turns[0]!.userTurn.id, turns[0]!.reply!.id, turns[2]!.userTurn.id, turns[1]!.reply!.id]) {
      expect(view.getByTestId(`qandeel-selectable-${id}`).props.accessibilityHint).toBeUndefined();
      expect(view.queryByTestId(`qandeel-selection-beneath-${id}`)).toBeNull();
    }
    expect(view.getByTestId(`qandeel-selectable-${turns[3]!.reply!.id}`).props.accessibilityHint).toBe(originalAudioText('RA-16', language));
    expect(view.queryByTestId(`qandeel-selection-beneath-${turns[3]!.reply!.id}`)).toBeNull();
  });

  it('B1b / B1c: a press on the voice turn selects all of it as one message; a range that leaves it removes all of it', async () => {
    const { view, turns } = await mounted(language);
    const copy = replayEntryCopy(language);
    await press(view, 'qandeel-replay-entry');
    await press(view, 'qandeel-replay-choose-part');
    const voice = turns[1]!.userTurn.id;
    await press(view, `qandeel-selectable-${voice}`);
    expect(view.getByTestId(`qandeel-selectable-${voice}`).props.accessibilityState).toMatchObject({ checked: true });
    expect(view.getByText(copy.count(1))).toBeTruthy();
    // The S7-02 ends, unchanged: a range from the voice turn to the call's reply holds it whole, a new range that starts
    // after it leaves it whole.
    await press(view, `qandeel-selectable-${turns[3]!.reply!.id}`);
    expect(view.getByTestId(`qandeel-selectable-${voice}`).props.accessibilityState).toMatchObject({ checked: true });
    expect(view.getByText(copy.count(6))).toBeTruthy();
    await press(view, `qandeel-selectable-${turns[3]!.userTurn.id}`);
    expect(view.getByTestId(`qandeel-selectable-${voice}`).props.accessibilityState).toMatchObject({ checked: false });
    expect(view.getByText(copy.count(1))).toBeTruthy();
    // The words stay on the one mark whether it is in or out.
    expect(view.getByTestId(`qandeel-selectable-${voice}`).props.accessibilityHint).toBe(originalAudioText('RA-16', language));
  });
});
