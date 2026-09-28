/**
 * W1B-01 — first use and the Conversation openings, on the production surfaces.
 *
 *   the bounded wait → the concise Welcome (owed once) → the real Conversation;
 *   the First Conversation Opening in a genuinely empty Conversation, the normal opener afterwards,
 *   never both, never above a committed turn, never with an invented name.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ConversationOpening, FIRST_USE_WAITING_TEST_ID, FirstUseGate, createAccountController, firstUseCopy, openingFor, type AccountController } from '..';
import { ConversationSurface, conversationCopy, createConversationController } from '../../conversation';
import { exchange, flush, page, scriptedTransport } from '../../conversation/__fixtures__/conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { AccountFirstUseOutcome } from '../../runtime-entry';

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const FSI = String.fromCodePoint(0x2068);
const PDI = String.fromCodePoint(0x2069);

async function accountWith(view: { displayName: string | null; welcomePending: boolean; firstConversationOpening: boolean } | 'UNAVAILABLE') {
  let completions = 0;
  const outcome: AccountFirstUseOutcome = view === 'UNAVAILABLE' ? { kind: 'UNAVAILABLE' } : { kind: 'READ', view };
  const account = createAccountController({
    transport: { readFirstUse: async () => outcome, completeWelcome: async () => { completions += 1; return true; } },
    isCurrent: () => true,
    setTimer: () => null,
    clearTimer: () => undefined,
  });
  return { account, completions: () => completions };
}

const settle = async () => {
  await act(async () => {
    await flush();
  });
};
const tree = (view: RenderResult) => JSON.stringify(view.toJSON());

describe('first use — the gate before the reader’s world', () => {
  it('waits on the Dark World, then shows the concise Welcome by the account Name, then the world', async () => {
    const { account, completions } = await accountWith({ displayName: 'منى', welcomePending: true, firstConversationOpening: true });
    const view = await render(
      <FirstUseGate account={account} language="ar" insets={INSETS}>
        <Text testID="world">world</Text>
      </FirstUseGate>,
    );
    expect(view.getByTestId(FIRST_USE_WAITING_TEST_ID)).toBeTruthy();
    expect(view.queryByTestId('world')).toBeNull();
    await act(async () => {
      account.start();
      await flush();
    });
    const [greeting, definition, start] = firstUseCopy('ar').welcome('منى');
    expect(view.getByTestId('qandeel-first-use-greeting').props.children).toBe(greeting);
    expect(greeting).toBe(`أهلًا يا ${FSI}منى${PDI}.`);
    expect(view.getByTestId('qandeel-first-use-definition').props.children).toBe(definition);
    expect(view.getByTestId('qandeel-first-use-start').props.accessibilityLabel).toBe(start);
    expect(view.queryByTestId('world')).toBeNull();
    await fireEvent.press(view.getByTestId('qandeel-first-use-start'));
    expect(view.getByTestId('world')).toBeTruthy();
    expect(completions()).toBe(1);
    await view.unmount();
  });

  it('English Welcome: the three approved lines, and nothing that asks a question', async () => {
    const { account } = await accountWith({ displayName: 'Mona', welcomePending: true, firstConversationOpening: true });
    account.start();
    await flush();
    const view = await render(<FirstUseGate account={account} language="en" insets={INSETS}><Text>world</Text></FirstUseGate>);
    await settle();
    const text = tree(view);
    for (const line of firstUseCopy('en').welcome('Mona')) expect(text).toContain(line);
    for (const absent of ['?', 'Skip', 'questionnaire', 'photo']) expect(text).not.toContain(absent);
    await view.unmount();
  });

  it('an account that is not owed the Welcome goes straight into its world', async () => {
    for (const state of [
      { displayName: 'Mona', welcomePending: false, firstConversationOpening: true },
      { displayName: null, welcomePending: false, firstConversationOpening: true },
    ] as const) {
      const { account } = await accountWith(state);
      account.start();
      await flush();
      const view = await render(<FirstUseGate account={account} language="en" insets={INSETS}><Text testID="world">world</Text></FirstUseGate>);
      expect(view.getByTestId('world')).toBeTruthy();
      await view.unmount();
    }
  });

  it('an unreadable account opens the world with no Welcome', async () => {
    const { account } = await accountWith('UNAVAILABLE');
    account.start();
    await flush();
    const view = await render(<FirstUseGate account={account} language="ar" insets={INSETS}><Text testID="world">world</Text></FirstUseGate>);
    expect(view.getByTestId('world')).toBeTruthy();
    await view.unmount();
  });
});

describe('the openings', () => {
  it('the rule: First until the first committed turn, normal afterwards, none without a Name or an answer', () => {
    const ready = { status: 'READY' as const, welcomePending: false };
    expect(openingFor({ ...ready, displayName: 'Mona', firstConversationOpening: true })).toEqual({ kind: 'FIRST', displayName: 'Mona' });
    expect(openingFor({ ...ready, displayName: 'Mona', firstConversationOpening: false })).toEqual({ kind: 'NORMAL', displayName: 'Mona' });
    expect(openingFor({ ...ready, displayName: null, firstConversationOpening: true })).toBeNull();
    expect(openingFor({ status: 'LOADING', displayName: null, welcomePending: false, firstConversationOpening: false })).toBeNull();
    expect(openingFor({ status: 'UNAVAILABLE', displayName: null, welcomePending: false, firstConversationOpening: false })).toBeNull();
  });

  async function conversationWith(account: AccountController, language: ChromeLanguage, history: ReturnType<typeof exchange>[]) {
    const transport = scriptedTransport();
    const controller = createConversationController({
      sessionId: '11111111-1111-4111-8111-111111111111',
      transport,
      isCurrent: () => true,
      onReplyCommitted: () => undefined,
      newSubmissionKey: () => 'key-1',
      setTimer: () => null,
      clearTimer: () => undefined,
    });
    const view = await render(
      <ConversationSurface controller={controller} language={language} insets={INSETS} onOpenAnalysis={() => undefined} opening={<ConversationOpening account={account} language={language} />} />,
    );
    await settle();
    return { view, transport };
  }

  it('the First Conversation Opening in an empty Conversation, attributed to QANDEEL, with the composer below it', async () => {
    const { account } = await accountWith({ displayName: 'منى', welcomePending: false, firstConversationOpening: true });
    account.start();
    await flush();
    const { view, transport } = await conversationWith(account, 'ar', []);
    expect(view.queryByTestId('qandeel-first-conversation-opening')).toBeNull();
    await act(async () => {
      transport.answerRead(page([]));
      await flush();
    });
    const opening = view.getByTestId('qandeel-first-conversation-opening');
    const lines = firstUseCopy('ar').firstOpening('منى');
    expect(opening.props.accessibilityLabel).toBe(conversationCopy('ar').replyTurnName(lines.join(' ')));
    expect(tree(view)).toContain(lines[1]);
    expect(view.queryByTestId('qandeel-conversation-opener')).toBeNull();
    expect(view.getByTestId('qandeel-conversation-input')).toBeTruthy();
    await view.unmount();
  });

  it('the normal opener once the account has conversed — unchanged, and never together with the First Opening', async () => {
    const { account } = await accountWith({ displayName: 'Mona', welcomePending: false, firstConversationOpening: false });
    account.start();
    await flush();
    const { view, transport } = await conversationWith(account, 'en', []);
    await act(async () => {
      transport.answerRead(page([]));
      await flush();
    });
    expect(view.getByTestId('qandeel-conversation-opener').props.accessibilityLabel).toBe(`QANDEEL: Hi ${FSI}Mona${PDI} ... I'm here, ready when you are ... let's begin`);
    expect(view.queryByTestId('qandeel-first-conversation-opening')).toBeNull();
    await view.unmount();
  });

  it('no opening above a committed turn, and none while the history has not been read', async () => {
    const { account } = await accountWith({ displayName: 'Mona', welcomePending: false, firstConversationOpening: true });
    account.start();
    await flush();
    const { view, transport } = await conversationWith(account, 'en', []);
    await act(async () => {
      transport.answerRead(page([exchange('fixture: hello', { reply: 'fixture: hi' })]));
      await flush();
    });
    expect(view.queryByTestId('qandeel-first-conversation-opening')).toBeNull();
    expect(view.queryByTestId('qandeel-conversation-opener')).toBeNull();
    await view.unmount();
  });

  it('no Name, no opening — nothing is invented', async () => {
    const { account } = await accountWith({ displayName: null, welcomePending: false, firstConversationOpening: true });
    account.start();
    await flush();
    const { view, transport } = await conversationWith(account, 'ar', []);
    await act(async () => {
      transport.answerRead(page([]));
      await flush();
    });
    expect(view.queryByTestId('qandeel-first-conversation-opening')).toBeNull();
    expect(view.queryByTestId('qandeel-conversation-opener')).toBeNull();
    await view.unmount();
  });
});
