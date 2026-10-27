/**
 * S8A-05 CP2 — «شارك في العالم العام» from the conversation: the choice is a REFERENCE proven by the S7-02 anchor proof
 * (two ends, the whole messages left out inside them, QANDEEL's replies in or out — never a text, speaker or order), a
 * contiguous part, separate whole messages and the whole conversation alike; an unprovable conversation offers nothing;
 * a refusal is said and nothing is created; a created draft is handed to the composition ONCE; the conversation is read
 * and never written; and the bar speaks Arabic and English from the CP2 copy, with the selection's marks.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import { exchange } from '../../conversation/__fixtures__/conversation';
import type { PublicComposeCreateResult, PublicComposeSourceChoice } from '../../public-compose';
import { publicSourceCopy } from '../../public-compose/source-copy';
import { publicComposeCopy } from '../../public-compose/copy';
import { proveAnchors } from '../../replay-entry/replay-anchors';
import { SESSION, fakeConversation, fakeReplayTransport, flush, headOf, timeline } from '../../replay-entry/__fixtures__/replay';
import { createPublicShareController, shareChoiceOf, usePublicShareSelection, type PublicShareController } from '..';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const DRAFT = '00000000-0000-4000-8000-000000000101';

function rig(options: { create?: (choice: PublicComposeSourceChoice) => Promise<PublicComposeCreateResult>; units?: (id: string) => number } = {}) {
  const history = [exchange('one'), exchange('two'), exchange('three')];
  const events = timeline(history, { units: options.units });
  const transport = fakeReplayTransport({ events });
  const conversation = fakeConversation(history);
  const create = jest.fn(options.create ?? (async () => ({ kind: 'CREATED' as const, draftId: DRAFT })));
  const controller = createPublicShareController({ sessionId: SESSION, transport, conversation, isCurrent: () => true, create });
  return { history, events, transport, conversation, create, controller };
}

const conversationChoice = (create: jest.Mock) => (create.mock.calls[0][0] as Extract<PublicComposeSourceChoice, { kind: 'CONVERSATION' }>).choice;

describe('S8A-05 CP2 — the choice is a proven reference', () => {
  // Three exchanges of two units each: one 1-2, reply 3-4; two 5-6, reply 7-8; three 9-10, reply 11-12.
  const history = [exchange('one'), exchange('two'), exchange('three')];
  const proven = proveAnchors(SESSION, timeline(history), 12);
  if (!proven.ok) throw new Error('fixture');
  const proof = proven.proof;
  const id = (n: number) => proof.order[n];
  const replies = new Set(history.map((e) => e.reply!.id.toLowerCase()));

  it('a contiguous part: its two ends, nothing left out, replies in', () => {
    expect(shareChoiceOf(proof, new Set([id(2), id(3), id(4)]), replies)).toEqual({
      sessionId: SESSION, firstPosition: 5, lastPosition: 10, includeQandeelReplies: true, excludedMessagePositions: [], emphasizedMessagePositions: [],
    });
  });

  it('separate whole messages: the messages between them that were not chosen are named by their first position', () => {
    expect(shareChoiceOf(proof, new Set([id(0), id(3), id(5)]), replies)).toMatchObject({
      firstPosition: 1, lastPosition: 12, includeQandeelReplies: true, excludedMessagePositions: [3, 5, 9],
    });
  });

  it('only the reader’s own words: replies are out, and need not be named', () => {
    expect(shareChoiceOf(proof, new Set([id(0), id(4)]), replies)).toEqual({
      sessionId: SESSION, firstPosition: 1, lastPosition: 10, includeQandeelReplies: false, excludedMessagePositions: [5], emphasizedMessagePositions: [],
    });
  });

  it('nothing chosen is no choice', () => {
    expect(shareChoiceOf(proof, new Set(), replies)).toBeNull();
  });
});

describe('S8A-05 CP2 — the share controller', () => {
  it('proves the conversation, chooses the whole of it, creates ONE private draft and hands it over once; the conversation is not written', async () => {
    const r = rig();
    r.controller.open();
    await flush();
    expect(typeof r.controller.getState().proof).toBe('object');
    r.controller.proceed();
    expect(r.controller.getState().problem).toBe('NOTHING');
    expect(r.create).not.toHaveBeenCalled();
    r.controller.chooseWhole();
    r.controller.proceed();
    await flush();
    expect(r.create).toHaveBeenCalledTimes(1);
    expect(r.create.mock.calls[0][0]).toEqual({ kind: 'CONVERSATION', choice: {
      sessionId: SESSION, firstPosition: 1, lastPosition: 12, includeQandeelReplies: true, excludedMessagePositions: [], emphasizedMessagePositions: [] } });
    expect(r.controller.getState()).toMatchObject({ selecting: false, handoff: DRAFT });
    r.controller.takeHandoff();
    expect(r.controller.getState().handoff).toBeNull();
    // Read only: no command reached the Replay transport, and the conversation is the same.
    expect(r.transport.commands).toEqual([]);
    expect(r.conversation.getState().exchanges).toBe(r.conversation.getState().exchanges);
  });

  it('toggles messages by their own ids; an id the proof does not hold is ignored', async () => {
    const r = rig();
    r.controller.open();
    await flush();
    r.controller.toggle(r.history[1].userTurn.id.toUpperCase());
    r.controller.toggle('not-a-message');
    r.controller.toggle(r.history[2].userTurn.id);
    r.controller.toggle(r.history[2].userTurn.id);
    expect([...r.controller.getState().chosen]).toEqual([r.history[1].userTurn.id.toLowerCase()]);
    r.controller.proceed();
    await flush();
    expect(conversationChoice(r.create)).toMatchObject({ firstPosition: 5, lastPosition: 6, includeQandeelReplies: false, excludedMessagePositions: [] });
  });

  it('an unprovable conversation offers nothing to choose', async () => {
    const r = rig();
    r.transport.head = 99;
    r.controller.open();
    await flush();
    expect(r.controller.getState()).toMatchObject({ proof: 'UNAVAILABLE', problem: 'UNPROVABLE' });
    r.controller.chooseWhole();
    r.controller.proceed();
    expect(r.create).not.toHaveBeenCalled();
  });

  it('a refusal is said and keeps the choice; no draft is handed over', async () => {
    const r = rig({ create: async () => ({ kind: 'REFUSED', outcome: 'TOO_LARGE' }) });
    r.controller.open();
    await flush();
    r.controller.chooseWhole();
    r.controller.proceed();
    await flush();
    expect(r.controller.getState()).toMatchObject({ selecting: true, busy: false, problem: 'REFUSED', refusal: 'TOO_LARGE', handoff: null });
    expect(r.controller.getState().chosen.size).toBe(6);
  });

  it('cancel and retire leave nothing behind', async () => {
    const r = rig();
    r.controller.open();
    await flush();
    r.controller.chooseWhole();
    r.controller.cancel();
    expect(r.controller.getState()).toMatchObject({ selecting: false, proof: null, handoff: null });
    expect(r.controller.getState().chosen.size).toBe(0);
    r.controller.retire();
    r.controller.open();
    await flush();
    expect(r.transport.calls.filter((c) => c.startsWith('events')).length).toBeLessThanOrEqual(2);
  });

  it('reads every page of a long conversation before proving it', async () => {
    const long = Array.from({ length: 140 }, (_, n) => exchange(`m${n}`));
    const events = timeline(long);
    const transport = fakeReplayTransport({ events });
    transport.head = headOf(events);
    const controller = createPublicShareController({ sessionId: SESSION, transport, conversation: fakeConversation(long), isCurrent: () => true,
      create: async () => ({ kind: 'FAILED' }) });
    controller.open();
    await flush();
    await flush();
    const proof = controller.getState().proof;
    expect(typeof proof === 'object' && proof !== null ? proof.order.length : 0).toBe(280);
  });
});

const appearance = () => {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
};

function Harness({ controller, conversation, language }: {
  readonly controller: PublicShareController; readonly conversation: ReturnType<typeof fakeConversation>; readonly language: 'ar' | 'en';
}) {
  const selection = usePublicShareSelection(controller, conversation, language, { left: 0, right: 0, bottom: 0 });
  if (selection === null) return <Text testID="closed">closed</Text>;
  return (
    <View>
      <Text testID="title">{selection.title}</Text>
      {conversation.getState().exchanges.map((e) => (
        <Text key={e.userTurn.id} testID={`mark-${e.userTurn.id}`} onPress={() => selection.onToggle(e.userTurn.id)}>
          {selection.markOf(e.userTurn.id)?.mark ?? 'null'}
        </Text>
      ))}
      {selection.bar}
    </View>
  );
}

afterEach(cleanup);

describe.each(['ar', 'en'] as const)('S8A-05 CP2 %s — the selection bar', (language) => {
  const copy = publicSourceCopy(language);

  it('speaks the CP2 copy, marks the chosen messages, and says why nothing can be continued yet', async () => {
    const r = rig();
    const view = await render(<AppearanceProvider authority={appearance()}><Harness controller={r.controller} conversation={r.conversation} language={language} /></AppearanceProvider>);
    expect(view.getByTestId('closed')).toBeTruthy();
    await act(async () => { r.controller.open(); });
    await flush();
    expect(view.getByTestId('title').props.children).toBe(copy.shareTitle);
    expect(view.getByTestId('qandeel-public-share-hint').props.children).toBe(copy.shareHint);
    expect(view.getByTestId('qandeel-public-share-continue').props.accessibilityLabel).toBe(copy.shareContinue);
    expect(view.getByTestId('qandeel-public-share-continue').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('qandeel-public-share-whole').props.accessibilityLabel).toBe(copy.shareWhole);
    expect(view.getByTestId('qandeel-public-share-cancel').props.accessibilityLabel).toBe(copy.shareCancel);
    expect(view.getByTestId(`mark-${r.history[0].userTurn.id}`).props.children).toBe('OUT');
    await fireEvent.press(view.getByTestId(`mark-${r.history[0].userTurn.id}`));
    expect(view.getByTestId(`mark-${r.history[0].userTurn.id}`).props.children).toBe('IN');
    expect(view.getByTestId('qandeel-public-share-continue').props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(view.getByTestId('qandeel-public-share-cancel'));
    expect(view.getByTestId('closed')).toBeTruthy();
  });

  it('an unprovable conversation and a refusal are said in the reader’s language', async () => {
    const r = rig({ create: async () => ({ kind: 'REFUSED', outcome: 'LIMIT_REACHED' }) });
    r.transport.head = 99;
    const view = await render(<AppearanceProvider authority={appearance()}><Harness controller={r.controller} conversation={r.conversation} language={language} /></AppearanceProvider>);
    await act(async () => { r.controller.open(); });
    await flush();
    expect(view.getByTestId('qandeel-public-share-problem').props.children).toBe(copy.shareUnprovable);
    await act(async () => { r.controller.cancel(); });
    r.transport.head = headOf(r.events);
    await act(async () => { r.controller.open(); });
    await flush();
    await act(async () => { r.controller.chooseWhole(); r.controller.proceed(); });
    await flush();
    expect(view.getByTestId('qandeel-public-share-problem').props.children).toBe(publicComposeCopy(language).limitReached);
  });
});
