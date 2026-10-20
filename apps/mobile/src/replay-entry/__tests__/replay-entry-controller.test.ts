/**
 * S7-02 — the Replay entry owner: the hint versus the real permission, the selection by message id, one command per
 * attempt (no second draft on retry), governed refusals, and a conversation that is read and never written.
 */
import { exchange } from '../../conversation/__fixtures__/conversation';
import { createReplayEntryController, mintReplayCommandId, type ReplayEntryController } from '../replay-entry-controller';
import {
  REPLAY_ID,
  SESSION,
  draftView,
  fakeConversation,
  fakeReplayTransport,
  flush,
  headOf,
  timeline,
  type FakeConversation,
  type FakeReplayTransport,
} from '../__fixtures__/replay';

const ANSWER = (coverage: 'FULL_SOURCE' | 'SELECTED_EXCERPT', revision = 1) => ({
  kind: 'ANSWERED' as const,
  answer: { outcome: 'CREATED' as const, replayId: REPLAY_ID, lifecycle: 'DRAFT' as const, draftRevision: revision, coverage, selectedMomentCount: 6 },
});

interface Rig {
  readonly controller: ReplayEntryController;
  readonly transport: FakeReplayTransport;
  readonly conversation: FakeConversation;
  readonly history: ReturnType<typeof exchange>[];
  current: boolean;
}

async function rig(options: { history?: ReturnType<typeof exchange>[]; open?: boolean; commit?: boolean } = {}): Promise<Rig> {
  const history = options.history ?? [exchange('one'), exchange('two'), exchange('three')];
  const transport = fakeReplayTransport({ events: options.commit === false ? [] : timeline(history), open: options.open });
  const conversation = fakeConversation(history);
  let n = 0;
  const holder = { current: true } as Rig;
  const controller = createReplayEntryController({
    sessionId: SESSION, transport, conversation, isCurrent: () => holder.current, newCommandId: () => `cmd-${(n += 1)}`,
  });
  Object.assign(holder, { controller, transport, conversation, history });
  controller.ensure();
  await flush();
  return holder;
}

async function select(r: Rig, choice: 'WHOLE' | 'PART' | 'SAVED_DRAFT') {
  r.controller.openMenu();
  await flush();
  r.controller.choose(choice);
  await flush();
}

describe('S7-02 — the entry is a hint; the command is the permission', () => {
  it('a closed or unreadable hint draws nothing — no entry and no slot — and reads no conversation', async () => {
    const closed = await rig({ open: false });
    expect(closed.controller.getState().status).toBe('HIDDEN');
    expect(closed.transport.calls.filter((c) => c.startsWith('head') || c.startsWith('events'))).toEqual([]);
    const unreadable = fakeReplayTransport();
    unreadable.capabilityAnswer = { kind: 'UNAVAILABLE' };
    const controller = createReplayEntryController({ sessionId: SESSION, transport: unreadable, conversation: fakeConversation([]), isCurrent: () => true });
    controller.ensure();
    await flush();
    expect(controller.getState().status).toBe('HIDDEN');
  });

  it('a new conversation with nothing committed holds the slot but offers no entry; the first committed reply brings it', async () => {
    const r = await rig({ history: [], commit: false });
    expect(r.controller.getState().status).toBe('RESERVED');
    r.controller.openMenu();
    expect(r.controller.getState().menu).toBeNull();
    const first = exchange('first');
    r.transport.events.push(...timeline([first]));
    r.transport.head = headOf(r.transport.events);
    r.conversation.set([first]);
    await flush();
    expect(r.controller.getState().status).toBe('AVAILABLE');
  });

  it('an open hint is not a permission: NOT_AVAILABLE_NOW is answered as such, nothing is saved, and the hint is read again', async () => {
    const r = await rig();
    await select(r, 'WHOLE');
    r.controller.save();
    r.transport.capabilityAnswer = { kind: 'READ', creationAvailable: false };
    const before = r.transport.calls.filter((c) => c === 'capability').length;
    r.transport.commands[0].answer({ kind: 'REFUSED_BY_SERVER', refusal: 'NOT_AVAILABLE_NOW' });
    await flush();
    const state = r.controller.getState();
    expect(state.selection).toBeNull();
    expect(state.notice).toBe('NOT_AVAILABLE');
    expect(state.saved).toBeNull();
    expect(r.transport.calls.filter((c) => c === 'capability').length).toBe(before + 1);
    expect(state.status).toBe('HIDDEN');
  });
});

describe('S7-02 — whole conversation and one contiguous part', () => {
  it('the whole conversation is 1 .. Live Head, it reaches the open head, and the words follow what the SERVER saved', async () => {
    const r = await rig();
    await select(r, 'WHOLE');
    const selection = r.controller.getState().selection!;
    expect(selection.range).toEqual({ firstTc: 1, lastTc: 12, messageCount: 6, reachesOpenHead: true, whole: true });
    r.controller.save();
    expect(r.transport.commands).toHaveLength(1);
    expect(r.transport.commands[0]).toMatchObject({ kind: 'CREATE', commandId: 'cmd-1', sessionId: SESSION, range: { firstTc: 1, lastTc: 12 } });
    r.transport.commands[0].answer(ANSWER('FULL_SOURCE'));
    await flush();
    const state = r.controller.getState();
    expect(state.selection).toBeNull();
    expect(state.notice).toBe('SAVED_WHOLE');
    expect(state.saved).toEqual({ sessionId: SESSION, replayId: REPLAY_ID, draftRevision: 1, coverage: 'FULL_SOURCE', selectedMomentCount: 6, firstTc: 1, lastTc: 12, reachesOpenHead: true });
  });

  it('whole conversation does not rely on what is loaded: an older page not on screen is still inside', async () => {
    const all = [exchange('a'), exchange('b'), exchange('c')];
    const transport = fakeReplayTransport({ events: timeline(all) });
    const controller = createReplayEntryController({ sessionId: SESSION, transport, conversation: fakeConversation(all.slice(2)), isCurrent: () => true });
    controller.ensure();
    await flush();
    controller.openMenu();
    await flush();
    controller.choose('WHOLE');
    await flush();
    expect(controller.getState().selection!.range).toMatchObject({ firstTc: 1, lastTc: 12, messageCount: 6 });
  });

  it('a part: first tap, last tap, a third tap starts again — and only the proven range is sent', async () => {
    const r = await rig();
    await select(r, 'PART');
    const [, two, three] = r.history;
    expect(r.controller.getState().selection!.range).toBeNull();
    r.controller.save();
    expect(r.transport.commands).toHaveLength(0);
    r.controller.toggle(two.userTurn.id);
    r.controller.toggle(three.userTurn.id);
    expect(r.controller.getState().selection).toMatchObject({ firstId: two.userTurn.id, lastId: three.userTurn.id, range: { firstTc: 5, lastTc: 10, messageCount: 3 } });
    r.controller.toggle(two.reply!.id);
    expect(r.controller.getState().selection).toMatchObject({ firstId: two.reply!.id, lastId: two.reply!.id, range: { firstTc: 7, lastTc: 8, messageCount: 1 } });
    r.controller.toggle(three.reply!.id);
    r.controller.save();
    expect(r.transport.commands[0].range).toEqual({ firstTc: 7, lastTc: 12 });
    r.transport.commands[0].answer(ANSWER('SELECTED_EXCERPT'));
    await flush();
    expect(r.controller.getState().notice).toBe('SAVED_PART');
  });

  it('a message that is not a whole saved message cannot be chosen', async () => {
    const r = await rig();
    const pending = exchange('pending', { replyState: 'PENDING' });
    r.conversation.set([...r.history, pending]);
    await select(r, 'PART');
    r.controller.toggle(pending.userTurn.id);
    expect(r.controller.getState().selection!.firstId).toBeNull();
    r.controller.toggle('ffffffff-ffff-4fff-8fff-ffffffffffff');
    expect(r.controller.getState().selection!.firstId).toBeNull();
  });

  it('missing events: no proof, nothing can be chosen and nothing is sent', async () => {
    const r = await rig();
    r.transport.eventsAvailable = false;
    await select(r, 'WHOLE');
    expect(r.controller.getState().selection).toMatchObject({ proof: 'UNAVAILABLE', range: null, problem: 'FAILED' });
    r.controller.save();
    expect(r.transport.commands).toHaveLength(0);
  });

  it('a Live Head that moved while the events were read is caught up, never trusted half-way', async () => {
    const r = await rig();
    const late = exchange('late');
    r.transport.betweenEventsAndHead = () => {
      r.transport.events.push(...timeline([late], { from: 13 }));
      r.transport.head = 16;
    };
    await select(r, 'WHOLE');
    expect(r.controller.getState().selection!.range).toMatchObject({ firstTc: 1, lastTc: 16, messageCount: 8 });
  });
});

describe('S7-02 — the selection is stable while the conversation moves', () => {
  it('an older page loading moves no end and no position', async () => {
    const older = [exchange('o1'), exchange('o2')];
    const shown = [exchange('n1'), exchange('n2')];
    const transport = fakeReplayTransport({ events: timeline([...older, ...shown]) });
    const conversation = fakeConversation(shown);
    const controller = createReplayEntryController({ sessionId: SESSION, transport, conversation, isCurrent: () => true, newCommandId: () => 'cmd' });
    controller.ensure();
    await flush();
    controller.openMenu();
    await flush();
    controller.choose('PART');
    await flush();
    controller.toggle(shown[0].reply!.id);
    controller.toggle(shown[1].userTurn.id);
    const before = controller.getState().selection!;
    expect(before.range).toMatchObject({ firstTc: 11, lastTc: 14 });
    conversation.set([...older, ...shown]);
    await flush();
    const after = controller.getState().selection!;
    expect(after.firstId).toBe(before.firstId);
    expect(after.lastId).toBe(before.lastId);
    expect(after.range).toEqual(before.range);
  });

  it('a new reply committed during the selection extends the proof and moves no end of a part', async () => {
    const r = await rig();
    await select(r, 'PART');
    const [one, two] = r.history;
    r.controller.toggle(one.userTurn.id);
    r.controller.toggle(two.reply!.id);
    const before = r.controller.getState().selection!.range;
    const next = exchange('four');
    r.transport.events.push(...timeline([next], { from: 13 }));
    r.transport.head = 16;
    r.conversation.set([...r.history, next]);
    await flush();
    const after = r.controller.getState().selection!;
    expect(after.range).toEqual(before);
    expect(typeof after.proof === 'object' && after.proof.liveHead).toBe(16);
    // The newest message is selectable now.
    r.controller.toggle(next.reply!.id);
    r.controller.toggle(next.reply!.id);
    expect(r.controller.getState().selection!.range).toMatchObject({ firstTc: 15, lastTc: 16, reachesOpenHead: true });
  });

  it('CHANGED: the ends are cleared, the proof is read again and the reader chooses again', async () => {
    const r = await rig();
    await select(r, 'PART');
    r.controller.toggle(r.history[0].userTurn.id);
    r.controller.toggle(r.history[1].userTurn.id);
    r.controller.save();
    const reads = r.transport.calls.filter((c) => c.startsWith('events')).length;
    r.transport.commands[0].answer({ kind: 'REFUSED_BY_SERVER', refusal: 'CHANGED' });
    await flush();
    const selection = r.controller.getState().selection!;
    expect(selection).toMatchObject({ firstId: null, lastId: null, range: null, problem: 'CHANGED', command: null });
    expect(typeof selection.proof).toBe('object');
    expect(r.transport.calls.filter((c) => c.startsWith('events')).length).toBeGreaterThan(reads);
  });

  it('an extension that rewrites an earlier message is no proof: fail closed', async () => {
    const r = await rig();
    await select(r, 'PART');
    const rewritten = timeline(r.history, { units: (id) => (id === r.history[0].userTurn.id ? 3 : 2) });
    r.transport.events.splice(0, r.transport.events.length, ...rewritten, ...timeline([exchange('x')], { from: 14 }));
    r.transport.head = 17;
    r.conversation.set([...r.history, exchange('x')]);
    await flush();
    expect(r.controller.getState().selection).toMatchObject({ proof: 'UNAVAILABLE', problem: 'FAILED' });
  });
});

describe('S7-02 — one command per attempt: no second draft for an unresolved attempt', () => {
  it('an unreadable answer is UNCONFIRMED; Try again re-issues the SAME command id and range', async () => {
    const r = await rig();
    await select(r, 'WHOLE');
    r.controller.save();
    r.transport.commands[0].answer({ kind: 'OUTCOME_UNKNOWN' });
    await flush();
    expect(r.controller.getState().selection).toMatchObject({ problem: 'UNCONFIRMED', command: { id: 'cmd-1', phase: 'UNCONFIRMED' } });
    r.controller.save();
    expect(r.transport.commands).toHaveLength(1);
    r.controller.retry();
    expect(r.transport.commands).toHaveLength(2);
    expect(r.transport.commands[1]).toMatchObject({ commandId: 'cmd-1', range: r.transport.commands[0].range });
    r.transport.commands[1].answer(ANSWER('FULL_SOURCE'));
    await flush();
    expect(r.controller.getState().notice).toBe('SAVED_WHOLE');
  });

  it('leaving an unresolved attempt keeps it: re-entering resumes the same command instead of starting a new one', async () => {
    const r = await rig();
    await select(r, 'PART');
    r.controller.toggle(r.history[0].userTurn.id);
    r.controller.toggle(r.history[0].reply!.id);
    r.controller.save();
    r.transport.commands[0].answer({ kind: 'OUTCOME_UNKNOWN' });
    await flush();
    r.controller.cancel();
    expect(r.controller.getState().selection).toBeNull();
    r.controller.openMenu();
    await flush();
    const resumed = r.controller.getState();
    expect(resumed.menu).toBeNull();
    expect(resumed.selection).toMatchObject({ scope: 'PART', firstId: r.history[0].userTurn.id, command: { id: 'cmd-1', phase: 'UNCONFIRMED' } });
    r.controller.retry();
    expect(r.transport.commands.map((c) => c.commandId)).toEqual(['cmd-1', 'cmd-1']);
  });

  it('while a command is in flight it cannot be cancelled, re-sent or changed', async () => {
    const r = await rig();
    await select(r, 'PART');
    r.controller.toggle(r.history[0].userTurn.id);
    r.controller.save();
    r.controller.cancel();
    r.controller.save();
    r.controller.toggle(r.history[2].userTurn.id);
    const selection = r.controller.getState().selection!;
    expect(selection.command?.phase).toBe('SAVING');
    expect(selection.lastId).toBe(r.history[0].userTurn.id);
    expect(r.transport.commands).toHaveLength(1);
  });

  it('a refusal saves nothing and a new choice is a NEW command', async () => {
    const r = await rig();
    await select(r, 'WHOLE');
    r.controller.save();
    r.transport.commands[0].answer({ kind: 'REFUSED_BY_SERVER', refusal: 'NOT_WHOLE_MESSAGES' });
    await flush();
    expect(r.controller.getState().selection).toMatchObject({ problem: 'FAILED', command: null });
    expect(r.controller.getState().saved).toBeNull();
    r.controller.save();
    expect(r.transport.commands.map((c) => c.commandId)).toEqual(['cmd-1', 'cmd-2']);
  });

  it('a request refused before admission saves nothing', async () => {
    const r = await rig();
    await select(r, 'WHOLE');
    r.controller.save();
    r.transport.commands[0].answer({ kind: 'NOT_ADMITTED' });
    await flush();
    expect(r.controller.getState().selection).toMatchObject({ problem: 'FAILED', command: null });
  });

  it('the default command id is a UUID v4', () => {
    expect(mintReplayCommandId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    expect(mintReplayCommandId()).not.toBe(mintReplayCommandId());
  });
});

describe('S7-02 — returning to this conversation’s saved draft', () => {
  it('the menu offers the conversation’s own newest DRAFT; choosing it marks its ends and revises with expectedDraftRevision', async () => {
    const r = await rig();
    r.transport.listAnswer = { kind: 'READ', replays: [
      { replayId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', lifecycle: 'FINALIZED', createdAt: '2026-10-19T10:00:00Z' },
      { replayId: REPLAY_ID, lifecycle: 'DRAFT', createdAt: '2026-10-19T09:00:00Z' },
    ] };
    r.transport.readAnswer = { kind: 'FOUND', replay: draftView({ revision: 2, firstTc: 5, lastTc: 8 }) };
    r.controller.openMenu();
    await flush();
    expect(r.transport.calls).toContain(`list:${SESSION}`);
    expect(r.transport.calls).toContain(`read:${REPLAY_ID}`);
    expect(r.controller.getState().menu!.savedDraft).toMatchObject({ replayId: REPLAY_ID, revision: 2 });
    r.controller.choose('SAVED_DRAFT');
    await flush();
    const selection = r.controller.getState().selection!;
    expect(selection).toMatchObject({ scope: 'PART', target: { kind: 'REVISE', replayId: REPLAY_ID, expectedDraftRevision: 2 },
      firstId: r.history[1].userTurn.id, lastId: r.history[1].reply!.id });
    r.controller.toggle(r.history[2].userTurn.id);
    r.controller.toggle(r.history[2].reply!.id);
    r.controller.save();
    expect(r.transport.commands[0]).toMatchObject({ kind: 'REVISE', replayId: REPLAY_ID, expectedDraftRevision: 2, range: { firstTc: 9, lastTc: 12 } });
  });

  it('no draft of this conversation: no third choice', async () => {
    const r = await rig();
    r.controller.openMenu();
    await flush();
    expect(r.controller.getState().menu).toEqual({ savedDraft: null });
    r.controller.choose('SAVED_DRAFT');
    expect(r.controller.getState().selection).toBeNull();
  });

  // S7-05 D5 (2): a revise retry is the SAME command — the same id, Replay, expected revision and range — so the
  // server's idempotency (0169 verifier E10, real PostgreSQL) answers it with its first result, never a second revision.
  it('S7-05 D5 — an unconfirmed revision is retried with the SAME command id, Replay, expected revision and range', async () => {
    const r = await rig();
    r.transport.listAnswer = { kind: 'READ', replays: [{ replayId: REPLAY_ID, lifecycle: 'DRAFT', createdAt: '2026-10-19T09:00:00Z' }] };
    r.transport.readAnswer = { kind: 'FOUND', replay: draftView({ revision: 2, firstTc: 5, lastTc: 8 }) };
    await select(r, 'SAVED_DRAFT');
    r.controller.toggle(r.history[2].userTurn.id);
    r.controller.toggle(r.history[2].reply!.id);
    r.controller.save();
    const first = r.transport.commands[0];
    expect(first).toMatchObject({ kind: 'REVISE', commandId: 'cmd-1', replayId: REPLAY_ID, expectedDraftRevision: 2, range: { firstTc: 9, lastTc: 12 } });
    first.answer({ kind: 'OUTCOME_UNKNOWN' });
    await flush();
    expect(r.controller.getState().selection).toMatchObject({ problem: 'UNCONFIRMED', command: { id: 'cmd-1', phase: 'UNCONFIRMED' } });
    // Save again is not a second command; only Try again re-issues the one unresolved command.
    r.controller.save();
    expect(r.transport.commands).toHaveLength(1);
    r.controller.retry();
    expect(r.transport.commands).toHaveLength(2);
    const retried = r.transport.commands[1];
    expect(retried).toMatchObject({ kind: 'REVISE', commandId: first.commandId, replayId: first.replayId, expectedDraftRevision: first.expectedDraftRevision });
    expect(retried.range).toEqual(first.range);
    retried.answer({ kind: 'ANSWERED', answer: { outcome: 'REVISED', replayId: REPLAY_ID, lifecycle: 'DRAFT', draftRevision: 3, coverage: 'SELECTED_EXCERPT', selectedMomentCount: 2 } });
    await flush();
    expect(r.controller.getState()).toMatchObject({ notice: 'SAVED_PART', selection: null, saved: { replayId: REPLAY_ID, draftRevision: 3 } });
    expect(r.transport.commands.map((c) => c.commandId)).toEqual(['cmd-1', 'cmd-1']);
  });

  it('a revision answered CHANGED re-reads the draft revision it must name', async () => {
    const r = await rig();
    r.transport.listAnswer = { kind: 'READ', replays: [{ replayId: REPLAY_ID, lifecycle: 'DRAFT', createdAt: '2026-10-19T09:00:00Z' }] };
    r.transport.readAnswer = { kind: 'FOUND', replay: draftView({ revision: 2 }) };
    await select(r, 'SAVED_DRAFT');
    r.controller.toggle(r.history[0].userTurn.id);
    r.controller.save();
    r.transport.readAnswer = { kind: 'FOUND', replay: draftView({ revision: 3 }) };
    r.transport.commands[0].answer({ kind: 'REFUSED_BY_SERVER', refusal: 'CHANGED' });
    await flush();
    expect(r.controller.getState().selection).toMatchObject({ target: { kind: 'REVISE', expectedDraftRevision: 3 }, problem: 'CHANGED' });
  });
});

describe('S7-02 — the conversation is read, never written; a retired owner does nothing', () => {
  it('the owner only reads the conversation source', async () => {
    const history = [exchange('one')];
    const reads = { getState: 0, subscribe: 0 };
    const source = fakeConversation(history);
    const spy = { getState: () => { reads.getState += 1; return source.getState(); }, subscribe: (l: () => void) => { reads.subscribe += 1; return source.subscribe(l); } };
    const controller = createReplayEntryController({ sessionId: SESSION, transport: fakeReplayTransport({ events: timeline(history) }), conversation: Object.freeze(spy), isCurrent: () => true });
    controller.ensure();
    await flush();
    expect(Object.keys(spy)).toEqual(['getState', 'subscribe']);
    expect(reads.subscribe).toBe(1);
  });

  it('a late answer reaching a retired or replaced generation changes nothing', async () => {
    const r = await rig();
    await select(r, 'WHOLE');
    r.controller.save();
    r.current = false;
    r.transport.commands[0].answer(ANSWER('FULL_SOURCE'));
    await flush();
    expect(r.controller.getState().saved).toBeNull();
    r.controller.retire();
    r.controller.openMenu();
    expect(r.controller.getState().menu).toBeNull();
  });

  it('a new committed reply takes a saved line away', async () => {
    const r = await rig();
    await select(r, 'WHOLE');
    r.controller.save();
    r.transport.commands[0].answer(ANSWER('FULL_SOURCE'));
    await flush();
    expect(r.controller.getState().notice).toBe('SAVED_WHOLE');
    r.conversation.set([...r.history, exchange('next')]);
    await flush();
    expect(r.controller.getState().notice).toBeNull();
    expect(r.controller.getState().saved).not.toBeNull();
  });
});
