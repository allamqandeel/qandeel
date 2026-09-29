/**
 * W1A-01 — the production Conversation surface: frozen visual language, speaker sides, paragraph
 * direction, accessible names, the approved send / waiting / failure states, and nothing invented.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { ConversationSurface, conversationCopy, createConversationController, type ConversationController } from '..';
import type { ChromeLanguage } from '../../orientation-chrome';
import { CANONICAL_VISUAL } from '../visual/canonical-visual.generated';
import { exchange, flush, page, scriptedTransport, type ScriptedTransport } from '../__fixtures__/conversation';

const SESSION = '11111111-1111-4111-8111-111111111111';
const PALETTE = CANONICAL_VISUAL.palettes.DARK.standard;
const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };

async function mounted(language: ChromeLanguage, history = [exchange('fixture: السلام عليكم', { reply: 'fixture: وعليكم السلام' })]) {
  const transport = scriptedTransport();
  let key = 0;
  const controller = createConversationController({
    sessionId: SESSION,
    transport,
    isCurrent: () => true,
    onReplyCommitted: () => undefined,
    newSubmissionKey: () => `key-${(key += 1)}`,
    setTimer: () => null,
    clearTimer: () => undefined,
  });
  const opened = { count: 0 };
  const view = await render(
    <ConversationSurface controller={controller} language={language} insets={INSETS} onOpenAnalysis={() => { opened.count += 1; }} />,
  );
  await act(async () => {
    await flush();
  });
  if (transport.pending().reads > 0) {
    await act(async () => {
      transport.answerRead(page(history));
      await flush();
    });
  }
  return { view, controller, transport, opened };
}

const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

interface JsonNode { type: string; props: Record<string, unknown>; children: (JsonNode | string)[] | null }
/** Every rendered host node under `root`, depth first. */
function walk(root: unknown): JsonNode[] {
  const out: JsonNode[] = [];
  const visit = (node: unknown) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const n = node as JsonNode;
    out.push(n);
    (n.children ?? []).forEach(visit);
  };
  visit(root);
  return out;
}
const byTestId = (view: RenderResult, id: string) => walk(view.toJSON()).find((node) => node.props.testID === id)!;
/** The Text nodes under a node, with their rendered string. */
const texts = (root: unknown) =>
  walk(root).filter((node) => node.type === 'Text').map((node) => ({ node, text: (node.children ?? []).filter((c) => typeof c === 'string').join('') }));

async function type(view: RenderResult, text: string) {
  await fireEvent.changeText(view.getByTestId('qandeel-conversation-input'), text);
}

describe('W1A-01 — speaker sides follow the reader’s language; QANDEEL takes the other edge', () => {
  it('Arabic: the reader’s committed turn is on the RIGHT, bleeding to the edge; QANDEEL is on the LEFT', async () => {
    const { view, controller } = await mounted('ar');
    const [first] = controller.getState().exchanges;
    const utterance = style(view.getByTestId(`qandeel-utterance-${first.userTurn.id}`));
    expect(utterance.alignSelf).toBe('flex-end');
    expect(utterance.marginRight).toBe(-24);
    expect(utterance.borderTopLeftRadius).toBe(18);
    const reply = style(view.getByTestId(`qandeel-reply-${first.reply!.id}`));
    expect(reply.alignSelf).toBe('flex-start');
  });

  it('English: the reader’s committed turn is on the LEFT; QANDEEL is on the RIGHT', async () => {
    const { view, controller } = await mounted('en');
    const [first] = controller.getState().exchanges;
    const utterance = style(view.getByTestId(`qandeel-utterance-${first.userTurn.id}`));
    expect(utterance.alignSelf).toBe('flex-start');
    expect(utterance.marginLeft).toBe(-24);
    expect(utterance.borderTopRightRadius).toBe(18);
    expect(style(view.getByTestId(`qandeel-reply-${first.reply!.id}`)).alignSelf).toBe('flex-end');
  });

  it('the surface is an explicit left-to-right frame, so the platform’s global direction cannot move a side', async () => {
    const { view } = await mounted('ar');
    expect(style(view.getByTestId('qandeel-conversation')).direction).toBe('ltr');
  });
});

describe('W1A-01 — paragraph direction is independent of the speaker', () => {
  it('a mixed Arabic turn keeps each paragraph in its own direction on the reader’s side', async () => {
    // First-strong would read the first paragraph as left-to-right; its majority is Arabic.
    const mixed = exchange('fixture: Q3 numbers لسه ما وصلتش لحد دلوقتي\nfixture: The report is ready');
    const { view } = await mounted('ar', [mixed]);
    const slab = byTestId(view, `qandeel-utterance-${mixed.userTurn.id}`);
    const [arabic, english] = texts(slab).map(({ node }) => style(node));
    expect(arabic).toMatchObject({ textAlign: 'right', writingDirection: 'rtl' });
    expect(english).toMatchObject({ textAlign: 'left', writingDirection: 'ltr' });
    // Both paragraphs are still the READER's, on the reader's side.
    expect(style(slab).alignSelf).toBe('flex-end');
  });

  it('an English turn in an English reader’s conversation is left-to-right, and an Arabic reply in it is right-to-left', async () => {
    const turn = exchange('fixture: hello', { reply: 'أهلا بيك fixture' });
    const { view } = await mounted('en', [turn]);
    const reply = byTestId(view, `qandeel-reply-${turn.reply!.id}`);
    const [{ node: paragraph }] = texts(reply);
    expect(style(paragraph)).toMatchObject({ textAlign: 'right', writingDirection: 'rtl' });
    expect(style(reply).alignSelf).toBe('flex-end');
  });
});

describe('W1A-01 — the frozen roles: UTTERANCE is the committed turn, FIELD is the composer', () => {
  it('the committed turn and the composer paint their canonical roles; QANDEEL paints no surface; the World is the ground', async () => {
    const { view, controller } = await mounted('ar');
    const [first] = controller.getState().exchanges;
    expect(style(view.getByTestId(`qandeel-utterance-${first.userTurn.id}`)).backgroundColor).toBe(PALETTE.utterance);
    expect(style(view.getByTestId('qandeel-conversation-composer')).backgroundColor).toBe(PALETTE.field);
    expect(style(view.getByTestId(`qandeel-reply-${first.reply!.id}`)).backgroundColor).toBeUndefined();
    expect(style(view.getByTestId('qandeel-conversation')).backgroundColor).toBe(PALETTE.world);
    // The roles resolve through their canonical routes, never a copied literal.
    expect(PALETTE.routes.utterance.startsWith('qandeel.role.utterance.fill')).toBe(true);
    expect(PALETTE.routes.field.startsWith('qandeel.role.field.fill')).toBe(true);
  });

  it('text is set in the Estedad v8.5 static faces at the E3 roles, with no letter-spacing and no synthetic weight', async () => {
    const { view, controller } = await mounted('ar');
    const [first] = controller.getState().exchanges;
    const [{ node: paragraph }] = texts(byTestId(view, `qandeel-utterance-${first.userTurn.id}`));
    expect(style(paragraph)).toMatchObject({ fontFamily: 'Estedad-Regular', fontSize: 17, lineHeight: 30 });
    expect(style(paragraph).letterSpacing).toBeUndefined();
    expect(style(paragraph).fontWeight).toBeUndefined();
    const door = view.getByText(conversationCopy('ar').doorLabel);
    expect(style(door)).toMatchObject({ fontFamily: 'Estedad-Medium', fontSize: 14, lineHeight: 23 });
  });
});

describe('W1A-01 — accessible names are the approved ones', () => {
  it.each(['ar', 'en'] as const)('%s: turns are read with their speaker, the composer and the depth control carry their names', async (language) => {
    const copy = conversationCopy(language);
    const { view, controller } = await mounted(language);
    const [first] = controller.getState().exchanges;
    expect(view.getByTestId(`qandeel-utterance-${first.userTurn.id}`).props.accessibilityLabel).toBe(copy.userTurnName(first.userTurn.content));
    expect(view.getByTestId(`qandeel-reply-${first.reply!.id}`).props.accessibilityLabel).toBe(copy.replyTurnName(first.reply!.content));
    const input = view.getByTestId('qandeel-conversation-input');
    expect(input.props.accessibilityLabel).toBe(copy.composerName);
    expect(input.props.placeholder).toBe(copy.composerPlaceholder);
    const door = view.getByTestId('qandeel-depth-to-analysis');
    expect(door.props.accessibilityLabel).toBe(copy.doorName);
    expect(door.props.accessibilityRole).toBe('button');
  });

  it('the exact approved strings, both languages', () => {
    expect(conversationCopy('ar')).toMatchObject({
      composerPlaceholder: 'كلامك هنا', composerName: 'رسالتك لقنديل', sendName: 'إرسال', waitingForReply: 'في انتظار رد قنديل',
      sendUnconfirmed: 'تعذّر التأكد من إرسال الرسالة.', sendRefused: 'تعذّر إرسال الرسالة.', replyFailed: 'تعذّر إكمال رد قنديل.', historyUnavailable: 'تعذّر تحميل المحادثة.',
      tryAgain: 'إعادة المحاولة', doorLabel: 'تحليل المحادثة', doorName: 'تحليل المحادثة', backLabel: 'المحادثة', backName: 'المحادثة',
    });
    expect(conversationCopy('ar').userTurnName('x')).toBe('كلامك: x');
    expect(conversationCopy('ar').replyTurnName('x')).toBe('قنديل: x');
    expect(conversationCopy('en')).toMatchObject({
      composerPlaceholder: 'Write here', composerName: 'Your message to QANDEEL', sendName: 'Send', waitingForReply: "Waiting for QANDEEL's reply",
      sendUnconfirmed: "It couldn't be confirmed that the message was sent.", sendRefused: "The message wasn't sent.", replyFailed: "QANDEEL's reply couldn't be completed.",
      historyUnavailable: "The conversation didn't load.", tryAgain: 'Try again', doorLabel: 'Analysis', doorName: 'Analysis of this conversation',
      backLabel: 'Conversation', backName: 'Conversation',
    });
    expect(conversationCopy('en').userTurnName('x')).toBe('You: x');
    expect(conversationCopy('en').replyTurnName('x')).toBe('QANDEEL: x');
  });
});

describe('W1A-01 — the send flow as the Product Owner approved it', () => {
  it('Send is ABSENT without words, present with them, and is the only way to send', async () => {
    const { view, transport } = await mounted('ar', []);
    expect(view.queryByTestId('qandeel-conversation-send')).toBeNull();
    await type(view, '   ');
    expect(view.queryByTestId('qandeel-conversation-send')).toBeNull();
    await type(view, 'fixture: مرحبا');
    const send = view.getByTestId('qandeel-conversation-send');
    expect(send.props.accessibilityLabel).toBe('إرسال');
    const input = view.getByTestId('qandeel-conversation-input');
    // Enter is a new line; submitting from the keyboard is not a second send path.
    expect(input.props.multiline).toBe(true);
    expect(input.props.submitBehavior).toBe('newline');
    expect(input.props.onSubmitEditing).toBeUndefined();
    expect(transport.submissions).toHaveLength(0);
  });

  it('after Send the words stay in the LOCKED composer with the waiting line, and become an utterance only when confirmed', async () => {
    const { view, controller, transport } = await mounted('ar', []);
    await type(view, 'fixture: مرحبا');
    await fireEvent.press(view.getByTestId('qandeel-conversation-send'));

    const input = view.getByTestId('qandeel-conversation-input');
    expect(input.props.value).toBe('fixture: مرحبا');
    expect(input.props.editable).toBe(false);
    expect(view.queryByTestId('qandeel-conversation-send')).toBeNull();
    expect(view.getByTestId('qandeel-conversation-awaiting').props.children).toBe('في انتظار رد قنديل');
    expect(view.queryAllByTestId(/^qandeel-utterance-/u)).toHaveLength(0);

    const confirmed = exchange('fixture: مرحبا', { key: 'key-1' });
    await act(async () => {
      transport.answerSubmit({ kind: 'ANSWERED', exchange: confirmed });
      await flush();
    });
    expect(view.getByTestId('qandeel-conversation-input').props.value).toBe('');
    expect(view.getByTestId('qandeel-conversation-input').props.editable).toBe(true);
    expect(view.getByTestId(`qandeel-utterance-${confirmed.userTurn.id}`)).toBeTruthy();
    expect(view.queryByTestId('qandeel-conversation-awaiting')).toBeNull();
    expect(controller.getState().exchanges).toHaveLength(1);
  });

  it('an unconfirmed send shows the approved line and Try again, which re-issues the SAME key', async () => {
    const { view, transport } = await mounted('en', []);
    await type(view, 'fixture: hello');
    await fireEvent.press(view.getByTestId('qandeel-conversation-send'));
    await act(async () => {
      transport.answerSubmit({ kind: 'OUTCOME_UNKNOWN', reason: 'NETWORK' });
      await flush();
      transport.answerRead({ kind: 'UNAVAILABLE', reason: 'NETWORK' });
      await flush();
    });
    expect(view.getByTestId('qandeel-conversation-unconfirmed')).toBeTruthy();
    expect(view.getByText("It couldn't be confirmed that the message was sent.")).toBeTruthy();
    expect(view.getByTestId('qandeel-conversation-input').props.value).toBe('fixture: hello');
    expect(view.getByTestId('qandeel-conversation-input').props.editable).toBe(false);
    const retry = view.getByTestId('qandeel-conversation-send-retry');
    expect(retry.props.accessibilityLabel).toBe('Try again');
    await fireEvent.press(retry);
    expect(transport.submissions.map((s) => s.submission)).toEqual([
      { content: 'fixture: hello', idempotencyKey: 'key-1' },
      { content: 'fixture: hello', idempotencyKey: 'key-1' },
    ]);
  });

  it.each([
    ['ar', 'تعذّر إرسال الرسالة.'],
    ['en', "The message wasn't sent."],
  ] as const)('%s: a definitive refusal shows the approved "not sent" line, announces it, leaves the words editable, and offers NO retry', async (language, line) => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const { view, transport } = await mounted(language, []);
    await type(view, 'fixture: words');
    await fireEvent.press(view.getByTestId('qandeel-conversation-send'));
    await act(async () => {
      transport.answerSubmit({ kind: 'REFUSED', status: 422 });
      await flush();
    });
    const refused = view.getByTestId('qandeel-conversation-refused');
    const [{ node, text }] = texts(byTestId(view, 'qandeel-conversation-refused'));
    expect(text).toBe(line);
    expect(style(node).color).toBe(PALETTE.error);
    expect(refused).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(line);
    // No server word, no ambiguous-outcome wording, no retry control.
    expect(view.queryByText(conversationCopy(language).sendUnconfirmed)).toBeNull();
    expect(view.queryByTestId('qandeel-conversation-send-retry')).toBeNull();
    const input = view.getByTestId('qandeel-conversation-input');
    expect(input.props.value).toBe('fixture: words');
    expect(input.props.editable).toBe(true);
    expect(view.getByTestId('qandeel-conversation-send')).toBeTruthy();
    announce.mockRestore();
  });

  it('a committed turn whose reply failed shows the approved failure on QANDEEL’s side and NO retry', async () => {
    const failed = exchange('fixture: words', { replyState: 'FAILED' });
    const { view } = await mounted('ar', [failed]);
    const line = view.getByTestId(`qandeel-reply-failed-${failed.userTurn.id}`);
    expect(line.props.children).toBe('تعذّر إكمال رد قنديل.');
    expect(style(line)).toMatchObject({ alignSelf: 'flex-start', color: PALETTE.error });
    expect(view.getByTestId(`qandeel-utterance-${failed.userTurn.id}`)).toBeTruthy();
    expect(view.queryAllByText('إعادة المحاولة')).toHaveLength(0);
  });

  it('a committed turn still awaiting its reply shows the waiting line on QANDEEL’s side', async () => {
    const pending = exchange('fixture: words', { replyState: 'PENDING' });
    const { view } = await mounted('en', [pending]);
    const line = view.getByTestId(`qandeel-reply-pending-${pending.userTurn.id}`);
    expect(line.props.children).toBe("Waiting for QANDEEL's reply");
    expect(style(line).alignSelf).toBe('flex-end');
  });

  it('a history that did not load says so in the approved words, with Try again', async () => {
    const transport: ScriptedTransport = scriptedTransport();
    const controller: ConversationController = createConversationController({
      sessionId: SESSION, transport, isCurrent: () => true, onReplyCommitted: () => undefined, setTimer: () => null, clearTimer: () => undefined,
    });
    const view = await render(<ConversationSurface controller={controller} language="ar" insets={INSETS} onOpenAnalysis={() => undefined} />);
    await act(async () => {
      await flush();
      transport.answerRead({ kind: 'UNAVAILABLE', reason: 'SERVER_ERROR' });
      await flush();
    });
    expect(view.getByText('تعذّر تحميل المحادثة.')).toBeTruthy();
    await fireEvent.press(view.getByTestId('qandeel-conversation-history-retry'));
    expect(transport.reads).toHaveLength(2);
  });
});

describe('W1A-01 — nothing but the approved words and the one depth control', () => {
  it('every visible string is approved copy or the conversation’s own words; no server text, enum or opener', async () => {
    const failed = exchange('fixture: second', { replyState: 'FAILED' });
    const pending = exchange('fixture: third', { replyState: 'PENDING' });
    const { view } = await mounted('ar', [exchange('fixture: first', { reply: 'fixture: reply' }), failed, pending]);
    const copy = conversationCopy('ar');
    const approved = new Set([copy.doorLabel, copy.replyFailed, copy.waitingForReply, copy.tryAgain, copy.historyUnavailable, copy.sendUnconfirmed]);
    const marks = new RegExp(`^[${String.fromCodePoint(0x200e)}${String.fromCodePoint(0x200f)}]`, 'u');
    const shown = texts(view.toJSON()).map(({ text }) => text.replace(marks, ''));
    expect(shown.length).toBeGreaterThan(3);
    for (const text of shown) {
      expect(approved.has(text) || text.startsWith('fixture:')).toBe(true);
    }
    // What a reader or a screen reader can meet: rendered text, accessible names and placeholders.
    const exposed = [
      ...shown,
      ...walk(view.toJSON()).flatMap((node) => [node.props.accessibilityLabel, node.props.placeholder].filter((v): v is string => typeof v === 'string')),
    ].join('\n');
    for (const internal of ['FAILED', 'PENDING', 'COMPLETED', 'GENERATING', 'session', 'runtime:', 'Conversation generation failed', 'اهلا', 'null', 'undefined']) {
      expect(exposed).not.toContain(internal);
    }
  });

  it('the only upper control is Conversation → Analysis — no Activity, Replay, Understanding, Settings, Voice or world switcher', async () => {
    const { view, opened } = await mounted('ar');
    const buttons = walk(view.toJSON()).filter((node) => node.props.accessibilityRole === 'button');
    // The door, and (with no words typed) nothing else.
    expect(buttons.map((node) => node.props.testID)).toEqual(['qandeel-depth-to-analysis']);
    await fireEvent.press(view.getByTestId('qandeel-depth-to-analysis'));
    expect(opened.count).toBe(1);
  });

  it('every control is at least 44 points in both axes', async () => {
    const { view } = await mounted('en');
    await type(view, 'fixture: words');
    for (const id of ['qandeel-depth-to-analysis', 'qandeel-conversation-send']) {
      const s = style(view.getByTestId(id));
      expect(s.minWidth as number).toBeGreaterThanOrEqual(44);
      expect(s.minHeight as number).toBeGreaterThanOrEqual(44);
    }
  });
});
