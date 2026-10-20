/**
 * S7-02 — the Replay entry inside the REAL Conversation surface: the END-edge control and its ASIDE, the selection
 * mode over the conversation's own messages, Arabic and English sides, accessibility, and a conversation (the
 * composer's words, the depth control) that is exactly where it was after the mode ends.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { ConversationSurface, createConversationController, type ConversationController } from '../../conversation';
import { exchange, page, scriptedTransport } from '../../conversation/__fixtures__/conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import { REPLAY_ENTRY_COPY_GATE, REPLAY_ENTRY_COPY_ROWS, ReplayEntryControl, ReplayEntryMenu, ReplayNoticeLine, createReplayEntryController, replayEntryCopy, useReplaySelection, type ReplayEntryController } from '..';
import { REPLAY_ID, SESSION, fakeReplayTransport, flush, timeline, type FakeReplayTransport } from '../__fixtures__/replay';

// The test renderer has no native node handles; the precedent (introductions.test.tsx) stands one in.
jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };

function Composed({ conversation, replay, language, onOpenAnalysis }: {
  conversation: ConversationController; replay: ReplayEntryController; language: ChromeLanguage; onOpenAnalysis: () => void;
}) {
  const selection = useReplaySelection(replay, conversation, language, INSETS);
  return (
    <ConversationSurface
      controller={conversation}
      language={language}
      insets={INSETS}
      onOpenAnalysis={onOpenAnalysis}
      discussion={<ReplayNoticeLine controller={replay} language={language} insets={INSETS} />}
      chromeEnd={<ReplayEntryControl controller={replay} language={language} />}
      overlay={<ReplayEntryMenu controller={replay} language={language} insets={INSETS} />}
      selection={selection}
    />
  );
}

async function mounted(language: ChromeLanguage, options: { open?: boolean; committed?: boolean } = {}) {
  const history = [exchange('fixture: السلام عليكم', { reply: 'fixture: وعليكم السلام' }), exchange('fixture: Qandeel and English inside', { reply: 'fixture: نعم' })];
  const turns = scriptedTransport();
  const conversation = createConversationController({
    sessionId: SESSION, transport: turns, isCurrent: () => true, onReplyCommitted: () => undefined,
    newSubmissionKey: () => 'key-1', setTimer: () => null, clearTimer: () => undefined,
  });
  const replayTransport: FakeReplayTransport = fakeReplayTransport({ events: options.committed === false ? [] : timeline(history), open: options.open });
  const replay = createReplayEntryController({ sessionId: SESSION, transport: replayTransport, conversation, isCurrent: () => true, newCommandId: () => 'cmd-1' });
  const opened = { count: 0 };
  const view = await render(<Composed conversation={conversation} replay={replay} language={language} onOpenAnalysis={() => { opened.count += 1; }} />);
  await act(async () => {
    turns.answerRead(page(options.committed === false ? [] : history));
    await flush();
  });
  return { view, conversation, replay, replayTransport, history, opened };
}

async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await flush();
  });
}

const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

describe('S7-02 — the entry in the Conversation chrome', () => {
  it('while the gate is closed the Conversation looks exactly as before: no control, no slot', async () => {
    const { view } = await mounted('ar', { open: false });
    expect(view.queryByTestId('qandeel-replay-entry')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-entry-slot')).toBeNull();
    expect(view.getByTestId('qandeel-depth-to-analysis')).toBeTruthy();
  });

  it('a conversation with nothing committed advertises nothing; its slot is held and hidden from the screen reader', async () => {
    const { view } = await mounted('ar', { committed: false });
    expect(view.queryByTestId('qandeel-replay-entry')).toBeNull();
    const slot = view.getByTestId('qandeel-replay-entry-slot', { includeHiddenElements: true });
    expect(style(slot)).toMatchObject({ width: 44, height: 44 });
    expect(slot.props.accessibilityElementsHidden).toBe(true);
    expect(slot.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it.each(['ar', 'en'] as const)('%s: a named 44 pt control after the depth control, its ASIDE at the reader’s END edge', async (language) => {
    const { view } = await mounted(language);
    const copy = replayEntryCopy(language);
    const control = view.getByTestId('qandeel-replay-entry');
    expect(control.props.accessibilityLabel).toBe(copy.replayName);
    expect(control.props.accessibilityState).toMatchObject({ expanded: false });
    expect(style(control)).toMatchObject({ minWidth: 44, minHeight: 44 });
    expect(view.getByTestId('qandeel-glyph-replay', { includeHiddenElements: true })).toBeTruthy();
    await press(view, 'qandeel-replay-entry');
    expect(view.getByTestId('qandeel-replay-entry').props.accessibilityState).toMatchObject({ expanded: true });
    const menu = style(view.getByTestId('qandeel-replay-menu'));
    // END is the edge opposite the reader's start: LEFT for Arabic, RIGHT for English.
    expect(language === 'ar' ? menu.left : menu.right).toBe(10);
    expect(language === 'ar' ? menu.right : menu.left).toBeUndefined();
    expect(view.getByLabelText(copy.whole)).toBeTruthy();
    expect(view.getByLabelText(copy.part)).toBeTruthy();
    // No scrim: the conversation is still reachable while the ASIDE is open.
    expect(view.getByTestId('qandeel-conversation-input')).toBeTruthy();
    // A second press closes it, and the screen reader is returned to the control that opened it.
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
    await press(view, 'qandeel-replay-entry');
    expect(view.queryByTestId('qandeel-replay-menu')).toBeNull();
    expect(focus).toHaveBeenCalled();
    focus.mockRestore();
  });
});

describe('S7-02 — the selection mode over the conversation’s own messages', () => {
  it('Arabic: a part is chosen on the messages themselves; the composer and its words return untouched on Cancel', async () => {
    const { view, conversation, history, replayTransport, opened } = await mounted('ar');
    const copy = replayEntryCopy('ar');
    await act(async () => {
      conversation.setDraft('كلمات لم تُرسل بعد');
      await flush();
    });
    await press(view, 'qandeel-replay-entry');
    await press(view, 'qandeel-replay-choose-part');
    // The upper chrome names the mode; the depth control is not offered inside it.
    expect(view.getByTestId('qandeel-selection-title')).toBeTruthy();
    expect(view.getByText(copy.part)).toBeTruthy();
    expect(view.queryByTestId('qandeel-depth-to-analysis')).toBeNull();
    // The bar stands where the composer was.
    expect(view.queryByTestId('qandeel-conversation-composer')).toBeNull();
    expect(view.getByText(copy.pickHint)).toBeTruthy();
    // Every whole message is a checkbox, named by its own words.
    const first = view.getByTestId(`qandeel-selectable-${history[0].userTurn.id}`);
    expect(first.props.accessibilityRole).toBe('checkbox');
    expect(first.props.accessibilityState).toMatchObject({ checked: false });
    await press(view, `qandeel-selectable-${history[0].reply!.id}`);
    await press(view, `qandeel-selectable-${history[1].userTurn.id}`);
    expect(view.getByTestId(`qandeel-selectable-${history[0].reply!.id}`).props.accessibilityState).toMatchObject({ checked: true });
    expect(view.getByTestId(`qandeel-selectable-${history[1].reply!.id}`).props.accessibilityState).toMatchObject({ checked: false });
    expect(view.getByText(copy.count(2))).toBeTruthy();
    // The mark is in the END gutter: the left for Arabic.
    expect(style(view.getByTestId(`qandeel-selection-mark-${history[0].reply!.id}`)).left).toBeDefined();
    await press(view, 'qandeel-replay-cancel');
    expect(view.queryByTestId('qandeel-selection-title')).toBeNull();
    expect(view.getByTestId('qandeel-conversation-input').props.value).toBe('كلمات لم تُرسل بعد');
    expect(replayTransport.commands).toHaveLength(0);
    // The Conversation ↔ Analysis transition is exactly where it was.
    await press(view, 'qandeel-depth-to-analysis');
    expect(opened.count).toBe(1);
  });

  it('English: the whole conversation is shown, not chosen; Save creates ONE draft and the saved line says what the server saved', async () => {
    const { view, history, replayTransport } = await mounted('en');
    const copy = replayEntryCopy('en');
    await press(view, 'qandeel-replay-entry');
    await press(view, 'qandeel-replay-choose-whole');
    const message = view.getByTestId(`qandeel-selectable-${history[1].reply!.id}`);
    expect(message.props.accessibilityState).toMatchObject({ checked: true, disabled: true });
    expect(view.getByText(copy.count(4))).toBeTruthy();
    // The newest message is inside, and the open-head limit is said, never hidden.
    expect(view.getByTestId('qandeel-replay-open-head')).toBeTruthy();
    // The mark is in the END gutter: the right for English.
    expect(style(view.getByTestId(`qandeel-selection-mark-${history[1].reply!.id}`)).right).toBeDefined();
    await press(view, 'qandeel-replay-save');
    expect(replayTransport.commands).toHaveLength(1);
    expect(view.getByTestId('qandeel-replay-save').props.accessibilityState).toMatchObject({ busy: true });
    await act(async () => {
      replayTransport.commands[0].answer({ kind: 'ANSWERED', answer: { outcome: 'CREATED', replayId: REPLAY_ID, lifecycle: 'DRAFT', draftRevision: 1, coverage: 'FULL_SOURCE', selectedMomentCount: 8 } });
      await flush();
    });
    expect(view.getByTestId('qandeel-conversation-composer')).toBeTruthy();
    expect(view.getByText(copy.savedWhole)).toBeTruthy();
    expect(view.getByTestId('qandeel-replay-notice-open-head')).toBeTruthy();
  });

  it('an unconfirmed save offers Try again, and Try again re-sends the same command', async () => {
    const { view, replayTransport } = await mounted('en');
    const copy = replayEntryCopy('en');
    await press(view, 'qandeel-replay-entry');
    await press(view, 'qandeel-replay-choose-whole');
    await press(view, 'qandeel-replay-save');
    await act(async () => {
      replayTransport.commands[0].answer({ kind: 'OUTCOME_UNKNOWN' });
      await flush();
    });
    expect(view.getByText(copy.unconfirmed)).toBeTruthy();
    await press(view, 'qandeel-replay-try-again');
    expect(replayTransport.commands.map((c) => c.commandId)).toEqual(['cmd-1', 'cmd-1']);
  });
});

describe('S7-05 — the English of the S7-02 rows (Product Owner decision D2, 2026-10-20)', () => {
  /** Word for word as the Product Owner approved it. */
  const APPROVED_ENGLISH = {
    replayName: 'Conversation replay',
    whole: 'The whole conversation',
    part: 'Part of the conversation',
    savedDraft: 'Saved draft',
    pickHint: 'The first and last messages of the part',
    save: 'Save',
    openHead: 'A Replay that includes the latest message can only be shown once the conversation continues.',
    savedWhole: 'The whole conversation was saved for a Replay.',
    savedPart: 'The selected part was saved for a Replay.',
    changed: 'Something changed since you made this selection. Please select again.',
    notProvable: "This selection can't be saved as one continuous part.",
    unconfirmed: "We couldn't confirm whether it was saved.",
  } as const;

  it('every one of the 12 rows and the message count is APPROVED in English, word for word; no row is PROPOSED', () => {
    const en = replayEntryCopy('en');
    for (const [key, text] of Object.entries(APPROVED_ENGLISH)) {
      const row = REPLAY_ENTRY_COPY_ROWS[key as keyof typeof APPROVED_ENGLISH];
      expect(row.enStatus).toBe('APPROVED');
      expect(row.en).toBe(text);
      expect(en[key as keyof typeof APPROVED_ENGLISH]).toBe(text);
    }
    for (const row of Object.values(REPLAY_ENTRY_COPY_ROWS)) expect(row.enStatus).toBe('APPROVED');
    expect(REPLAY_ENTRY_COPY_GATE.englishProposed).toEqual([]);
    expect(REPLAY_ENTRY_COPY_GATE.englishApproved).toEqual(expect.arrayContaining([...Object.keys(APPROVED_ENGLISH), 'count']));
    expect(REPLAY_ENTRY_COPY_GATE.englishApproval).toMatch(/^S7-05 ENGLISH COPY APPROVAL — 2026-10-20/u);
  });

  it('the message count keeps its plural rule, with no brackets in what is shown', () => {
    const en = replayEntryCopy('en');
    expect(en.count(1)).toBe('1 message');
    expect(en.count(2)).toBe('2 messages');
    expect(en.count(11)).toBe('11 messages');
    for (const n of [1, 2, 7]) expect(en.count(n)).not.toMatch(/[()[\]/]/u);
  });
});
