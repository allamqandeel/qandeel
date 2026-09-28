/**
 * W1A-01 — the Conversation presentation owner: the Product Owner's send, retry and history rules.
 *
 * Every rule is asserted on the owner itself over a transport whose every answer the test decides,
 * so ordering, late answers and retirement are proven rather than raced.
 */
import {
  ABANDONED_REPLY_RECHECKS,
  ABANDONED_REPLY_RECHECK_MS,
  MAX_SUBMISSION_LENGTH,
  SUBMISSION_CONFIRMATION_WINDOW_MS,
  createConversationController,
  mintSubmissionKey,
  type ConversationController,
} from '..';
import { exchange, flush, page, scriptedTransport, type ScriptedTransport } from '../__fixtures__/conversation';

const SESSION = '11111111-1111-4111-8111-111111111111';

interface Rig {
  controller: ConversationController;
  transport: ScriptedTransport;
  catchUps: { count: number };
  current: { value: boolean };
  timers: { callback: () => void; ms: number; cleared: boolean }[];
}

function rig(keys: string[] = ['key-1', 'key-2', 'key-3']): Rig {
  const transport = scriptedTransport();
  const catchUps = { count: 0 };
  const current = { value: true };
  const timers: Rig['timers'] = [];
  const queue = [...keys];
  const controller = createConversationController({
    sessionId: SESSION,
    transport,
    isCurrent: () => current.value,
    onReplyCommitted: () => {
      catchUps.count += 1;
    },
    newSubmissionKey: () => {
      const next = queue.shift();
      if (next === undefined) throw new Error('the test ran out of keys');
      return next;
    },
    setTimer: (callback, ms) => {
      const timer = { callback, ms, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimer: (handle) => {
      (handle as { cleared: boolean }).cleared = true;
    },
  });
  return { controller, transport, catchUps, current, timers };
}

async function loaded(r: Rig, exchanges = [exchange('fixture: earlier words')]): Promise<void> {
  r.controller.ensureHistory();
  r.transport.answerRead(page(exchanges));
  await flush();
}

describe('W1A-01 — sending one logical submission', () => {
  it('Send issues the composer words ONCE under a fresh key, keeps them in the LOCKED composer, and shows no committed utterance yet', async () => {
    const r = rig();
    await loaded(r, []);
    r.controller.setDraft('fixture: السلام عليكم');
    r.controller.send();

    expect(r.transport.submissions).toEqual([{ sessionId: SESSION, submission: { content: 'fixture: السلام عليكم', idempotencyKey: 'key-1' } }]);
    const state = r.controller.getState();
    expect(state.submission).toEqual({ content: 'fixture: السلام عليكم', key: 'key-1', phase: 'AWAITING' });
    expect(state.draft).toBe('fixture: السلام عليكم');
    // The unconfirmed words are NOT a committed utterance.
    expect(state.exchanges).toEqual([]);

    // Locked: typing is ignored and a second Send issues nothing.
    r.controller.setDraft('fixture: something else');
    r.controller.send();
    expect(r.controller.getState().draft).toBe('fixture: السلام عليكم');
    expect(r.transport.submissions).toHaveLength(1);
  });

  it('the server confirmation commits the exchange, clears the composer, frees it, and asks Analysis to catch up', async () => {
    const r = rig();
    await loaded(r, []);
    r.controller.setDraft('fixture: hello');
    r.controller.send();
    const confirmed = exchange('fixture: hello', { key: 'key-1' });
    r.transport.answerSubmit({ kind: 'ANSWERED', exchange: confirmed });
    await flush();

    const state = r.controller.getState();
    expect(state.exchanges).toEqual([confirmed]);
    expect(state.submission).toBeNull();
    expect(state.draft).toBe('');
    expect(r.catchUps.count).toBe(1);
    expect(r.timers[0].cleared).toBe(true);
  });

  it('blank words are never sent, and nothing longer than the server admits can be typed', async () => {
    const r = rig();
    await loaded(r, []);
    for (const blank of ['', '   ', '\n\n', '\t ']) {
      r.controller.setDraft(blank);
      r.controller.send();
    }
    expect(r.transport.submissions).toHaveLength(0);
    r.controller.setDraft('x'.repeat(MAX_SUBMISSION_LENGTH + 10));
    expect(r.controller.getState().draft).toHaveLength(MAX_SUBMISSION_LENGTH);
  });

  it('every NEW submission gets a NEW key; a key is never reused for different words', async () => {
    const r = rig();
    await loaded(r, []);
    r.controller.setDraft('fixture: first');
    r.controller.send();
    r.transport.answerSubmit({ kind: 'ANSWERED', exchange: exchange('fixture: first', { key: 'key-1' }) });
    await flush();
    r.controller.setDraft('fixture: second');
    r.controller.send();
    expect(r.transport.submissions.map((s) => [s.submission.idempotencyKey, s.submission.content])).toEqual([
      ['key-1', 'fixture: first'],
      ['key-2', 'fixture: second'],
    ]);
  });

  it('a committed turn whose reply FAILED stays in the conversation with its failure — and there is no reply retry', async () => {
    const r = rig();
    await loaded(r, []);
    r.controller.setDraft('fixture: words');
    r.controller.send();
    const failed = exchange('fixture: words', { key: 'key-1', replyState: 'FAILED' });
    r.transport.answerSubmit({ kind: 'ANSWERED', exchange: failed });
    await flush();

    expect(r.controller.getState().exchanges).toEqual([failed]);
    expect(r.controller.getState().submission).toBeNull();
    expect(r.catchUps.count).toBe(0);
    // No retry path exists for a confirmed reply failure: retrySubmission only acts on UNCONFIRMED.
    r.controller.retrySubmission();
    expect(r.transport.submissions).toHaveLength(1);
  });

  it('a definitive refusal commits nothing, gives the words back editable, and says they were not sent', async () => {
    for (const outcome of [{ kind: 'REFUSED', status: 409 } as const, { kind: 'NOT_ISSUED' } as const]) {
      const r = rig();
      await loaded(r, []);
      r.controller.setDraft('fixture: words');
      r.controller.send();
      r.transport.answerSubmit(outcome);
      await flush();
      const state = r.controller.getState();
      expect(state.submission).toBeNull();
      expect(state.refused).toBe(true);
      expect(state.draft).toBe('fixture: words');
      expect(state.exchanges).toEqual([]);
      // Editable, and no retry is implied: retrySubmission has nothing to act on.
      r.controller.setDraft('fixture: edited');
      expect(r.controller.getState().draft).toBe('fixture: edited');
      r.controller.retrySubmission();
      expect(r.transport.submissions).toHaveLength(1);
      // Sending again is a NEW submission under a NEW key, and it clears the line.
      r.controller.send();
      expect(r.transport.submissions[1].submission).toEqual({ content: 'fixture: edited', idempotencyKey: 'key-2' });
      expect(r.controller.getState().refused).toBe(false);
    }
  });

  it('emptying the composer after a refusal clears the "not sent" line', async () => {
    const r = rig();
    await loaded(r, []);
    r.controller.setDraft('fixture: words');
    r.controller.send();
    r.transport.answerSubmit({ kind: 'REFUSED', status: 422 });
    await flush();
    r.controller.setDraft('fixture: word');
    expect(r.controller.getState().refused).toBe(true);
    r.controller.setDraft('');
    expect(r.controller.getState().refused).toBe(false);
  });
});

describe('W1A-01 — an outcome the client cannot confirm', () => {
  it('is first resolved BY READING — a turn found under this key is the answer, and nothing is re-sent', async () => {
    const r = rig();
    await loaded(r, []);
    r.controller.setDraft('fixture: words');
    r.controller.send();
    r.transport.answerSubmit({ kind: 'OUTCOME_UNKNOWN', reason: 'NETWORK' });
    await flush();
    expect(r.transport.reads).toHaveLength(2);

    const admitted = exchange('fixture: words', { key: 'key-1', replyState: 'FAILED' });
    r.transport.answerRead(page([admitted]));
    await flush();
    expect(r.controller.getState().exchanges).toEqual([admitted]);
    expect(r.controller.getState().submission).toBeNull();
    // FAILED work is not re-entered: exactly the one submission was ever sent.
    expect(r.transport.submissions).toHaveLength(1);
  });

  it('a COMPLETED turn found by reading re-enters establishment with the SAME key — the one supported recovery', async () => {
    const r = rig();
    await loaded(r, []);
    r.controller.setDraft('fixture: words');
    r.controller.send();
    r.transport.answerSubmit({ kind: 'OUTCOME_UNKNOWN', reason: 'SERVER_ERROR' });
    await flush();
    const completed = exchange('fixture: words', { key: 'key-1' });
    r.transport.answerRead(page([completed]));
    await flush();

    expect(r.controller.getState().exchanges).toEqual([completed]);
    expect(r.transport.submissions.map((s) => s.submission)).toEqual([
      { content: 'fixture: words', idempotencyKey: 'key-1' },
      { content: 'fixture: words', idempotencyKey: 'key-1' },
    ]);
    r.transport.answerSubmit({ kind: 'ANSWERED', exchange: completed });
    await flush();
    // Still one exchange: the replay resolved to the same turn.
    expect(r.controller.getState().exchanges).toHaveLength(1);
    expect(r.catchUps.count).toBe(2);
  });

  it('with no turn under this key, the words stay LOCKED in the composer as UNCONFIRMED — never sent again by themselves', async () => {
    const r = rig();
    await loaded(r, []);
    r.controller.setDraft('fixture: words');
    r.controller.send();
    r.transport.answerSubmit({ kind: 'OUTCOME_UNKNOWN', reason: 'NETWORK' });
    await flush();
    r.transport.answerRead(page([exchange('fixture: someone else', { key: 'other-key' })]));
    await flush();

    expect(r.controller.getState().submission).toEqual({ content: 'fixture: words', key: 'key-1', phase: 'UNCONFIRMED' });
    expect(r.controller.getState().draft).toBe('fixture: words');
    expect(r.transport.submissions).toHaveLength(1);
    r.controller.send();
    r.controller.setDraft('fixture: edited');
    expect(r.transport.submissions).toHaveLength(1);
    expect(r.controller.getState().draft).toBe('fixture: words');
  });

  it('"Try again" re-issues the SAME words under the SAME key, and the server answer is ONE exchange', async () => {
    const r = rig();
    await loaded(r, []);
    r.controller.setDraft('fixture: words');
    r.controller.send();
    r.transport.answerSubmit({ kind: 'OUTCOME_UNKNOWN', reason: 'NETWORK' });
    await flush();
    r.transport.answerRead({ kind: 'UNAVAILABLE', reason: 'NETWORK' });
    await flush();
    expect(r.controller.getState().submission?.phase).toBe('UNCONFIRMED');

    r.controller.retrySubmission();
    expect(r.controller.getState().submission?.phase).toBe('AWAITING');
    expect(r.transport.submissions[1].submission).toEqual({ content: 'fixture: words', idempotencyKey: 'key-1' });
    const confirmed = exchange('fixture: words', { key: 'key-1' });
    r.transport.answerSubmit({ kind: 'ANSWERED', exchange: confirmed });
    await flush();
    expect(r.controller.getState().exchanges).toEqual([confirmed]);
    expect(r.controller.getState().submission).toBeNull();
  });

  it('a submission with no answer inside the confirmation window is reconciled by reading, and a late answer still counts', async () => {
    const r = rig();
    await loaded(r, []);
    r.controller.setDraft('fixture: words');
    r.controller.send();
    expect(r.timers[0].ms).toBe(SUBMISSION_CONFIRMATION_WINDOW_MS);
    r.timers[0].callback();
    await flush();
    r.transport.answerRead(page([]));
    await flush();
    expect(r.controller.getState().submission?.phase).toBe('UNCONFIRMED');

    // The original request finally answers: it is authoritative for this key, so it is applied.
    const late = exchange('fixture: words', { key: 'key-1' });
    r.transport.answerSubmit({ kind: 'ANSWERED', exchange: late });
    await flush();
    expect(r.controller.getState().exchanges).toEqual([late]);
    expect(r.controller.getState().submission).toBeNull();
  });
});

describe('W1A-01 — the authoritative conversation-so-far', () => {
  it('reads the newest page once, oldest to newest, and keeps a committed turn whose reply failed', async () => {
    const r = rig();
    const history = [exchange('fixture: one'), exchange('fixture: two', { replyState: 'FAILED' }), exchange('fixture: three', { replyState: 'PENDING' })];
    r.controller.ensureHistory();
    r.controller.ensureHistory();
    expect(r.transport.reads).toEqual([{ sessionId: SESSION }]);
    r.transport.answerRead(page(history));
    await flush();
    expect(r.controller.getState().history).toBe('READY');
    expect(r.controller.getState().exchanges).toEqual(history);
  });

  it('a failed first read is UNAVAILABLE, and its "Try again" reads again', async () => {
    const r = rig();
    r.controller.ensureHistory();
    r.transport.answerRead({ kind: 'UNAVAILABLE', reason: 'SERVER_ERROR' });
    await flush();
    expect(r.controller.getState().history).toBe('UNAVAILABLE');
    r.controller.retryHistory();
    expect(r.controller.getState().history).toBe('LOADING');
    r.transport.answerRead(page([exchange('fixture: one')]));
    await flush();
    expect(r.controller.getState().history).toBe('READY');
  });

  it('older pages load backwards from the oldest held turn and never duplicate a turn', async () => {
    const r = rig();
    const older = [exchange('fixture: a', { order: 1 }), exchange('fixture: b', { order: 2 })];
    const newest = [exchange('fixture: c', { order: 3 }), exchange('fixture: d', { order: 4 })];
    r.controller.ensureHistory();
    r.transport.answerRead(page(newest, true));
    await flush();
    r.controller.loadOlder();
    r.controller.loadOlder();
    expect(r.transport.reads[1]).toEqual({ sessionId: SESSION, before: newest[0].userTurn.id });
    expect(r.transport.reads).toHaveLength(2);
    r.transport.answerRead(page([...older, newest[0]], false));
    await flush();
    expect(r.controller.getState().exchanges.map((e) => e.userTurn.content)).toEqual(['fixture: a', 'fixture: b', 'fixture: c', 'fixture: d']);
    expect(r.controller.getState().hasOlder).toBe(false);
    r.controller.loadOlder();
    expect(r.transport.reads).toHaveLength(2);
  });

  it('a newer report of the same turn replaces the older one (PENDING becomes COMPLETED)', async () => {
    const r = rig();
    const pending = exchange('fixture: words', { replyState: 'PENDING' });
    r.controller.ensureHistory();
    r.transport.answerRead(page([pending]));
    await flush();
    const answered = { ...pending, replyState: 'COMPLETED' as const, reply: { id: 'reply-1', content: 'fixture: reply', createdAt: pending.userTurn.createdAt } };
    r.controller.ensureHistory();
    r.transport.answerRead(page([answered]));
    await flush();
    expect(r.controller.getState().exchanges).toEqual([answered]);
  });
});

describe('W1A-01 — a committed turn restored as PENDING (e.g. after a crash)', () => {
  const restoredKey = 'restored-key';
  const restored = () => exchange('fixture: words before the crash', { key: restoredKey, replyState: 'PENDING' });
  const fired = new WeakSet<object>();
  const armed = (r: Rig) => r.timers.filter((timer) => timer.ms === ABANDONED_REPLY_RECHECK_MS && !timer.cleared && !fired.has(timer));
  const fire = (timer: Rig['timers'][number]) => {
    fired.add(timer);
    timer.callback();
  };

  async function restoredRig(): Promise<{ r: Rig; pending: ReturnType<typeof restored> }> {
    const r = rig();
    const pending = restored();
    await loaded(r, [pending]);
    return { r, pending };
  }

  /** Fire the one armed re-check, answer its same-key replay, then answer the history read that follows. */
  async function recheck(r: Rig, replay: Parameters<ScriptedTransport['answerSubmit']>[0], reread: Parameters<ScriptedTransport['answerRead']>[0]) {
    const [timer] = armed(r);
    fire(timer);
    await flush();
    r.transport.answerSubmit(replay);
    await flush();
    r.transport.answerRead(reread);
    await flush();
  }

  it('before its lease can have expired nothing is sent: the turn stays PENDING and only one re-check is armed', async () => {
    const { r, pending } = await restoredRig();
    expect(r.controller.getState().exchanges).toEqual([pending]);
    expect(r.transport.submissions).toHaveLength(0);
    expect(armed(r)).toHaveLength(1);
    expect(ABANDONED_REPLY_RECHECK_MS).toBeGreaterThan(SUBMISSION_CONFIRMATION_WINDOW_MS);
    // A second read of the same PENDING turn arms nothing more.
    r.controller.ensureHistory();
    r.transport.answerRead(page([pending]));
    await flush();
    expect(armed(r)).toHaveLength(1);
    expect(r.transport.submissions).toHaveLength(0);
  });

  it('a live lease stays PENDING: the re-check is the SAME key and words, the server leaves it, and it is re-checked once more at most', async () => {
    const { r, pending } = await restoredRig();
    await recheck(r, { kind: 'ANSWERED', exchange: pending }, page([pending]));
    expect(r.transport.submissions.map((s) => s.submission)).toEqual([{ content: pending.userTurn.content, idempotencyKey: restoredKey }]);
    expect(r.controller.getState().exchanges).toEqual([pending]);
    expect(armed(r)).toHaveLength(1);
    await recheck(r, { kind: 'ANSWERED', exchange: pending }, page([pending]));
    // Still truthfully PENDING, and never polled again.
    expect(r.controller.getState().exchanges).toEqual([pending]);
    expect(armed(r)).toHaveLength(0);
    expect(r.transport.submissions).toHaveLength(ABANDONED_REPLY_RECHECKS);
    expect(r.transport.pending()).toEqual({ submits: 0, reads: 0 });
  });

  it('an expired, abandoned GENERATING turn converges to FAILED through the server recovery, and FAILED is never re-entered', async () => {
    const { r, pending } = await restoredRig();
    const failed = { ...pending, replyState: 'FAILED' as const };
    await recheck(r, { kind: 'ANSWERED', exchange: failed }, page([failed]));
    expect(r.controller.getState().exchanges).toEqual([failed]);
    expect(armed(r)).toHaveLength(0);
    expect(r.transport.submissions).toHaveLength(1);
    expect(r.catchUps.count).toBe(0);
    // A later read of the same FAILED turn arms nothing: no reopening, no replacement turn.
    r.controller.ensureHistory();
    r.transport.answerRead(page([failed]));
    await flush();
    expect(armed(r)).toHaveLength(0);
    expect(r.transport.submissions).toHaveLength(1);
  });

  it('a late COMPLETED converges from the reread, and the Analysis owners are asked to catch up', async () => {
    const { r, pending } = await restoredRig();
    const completed = { ...pending, replyState: 'COMPLETED' as const, reply: { id: 'reply-late', content: 'fixture: late reply', createdAt: pending.userTurn.createdAt } };
    // The replay itself still sees GENERATING; the history read that follows has the reply.
    await recheck(r, { kind: 'ANSWERED', exchange: pending }, page([completed]));
    expect(r.controller.getState().exchanges).toEqual([completed]);
    expect(r.catchUps.count).toBe(1);
    expect(armed(r)).toHaveLength(0);
    expect(r.transport.submissions).toHaveLength(1);
  });

  it('an unanswerable re-check still rereads the history, and the bound holds', async () => {
    const { r, pending } = await restoredRig();
    await recheck(r, { kind: 'OUTCOME_UNKNOWN', reason: 'NETWORK' }, { kind: 'UNAVAILABLE', reason: 'NETWORK' });
    expect(r.controller.getState().exchanges).toEqual([pending]);
    await recheck(r, { kind: 'OUTCOME_UNKNOWN', reason: 'NETWORK' }, { kind: 'UNAVAILABLE', reason: 'NETWORK' });
    expect(armed(r)).toHaveLength(0);
    expect(r.transport.submissions).toHaveLength(ABANDONED_REPLY_RECHECKS);
  });

  it('no duplicate admission: every re-check reuses the turn\'s own key, a turn without a key or already resolved is never re-sent, and nothing survives retirement', async () => {
    const r = rig();
    const pending = restored();
    const keyless = exchange('fixture: keyless words', { key: null, replyState: 'PENDING' });
    const completed = exchange('fixture: answered');
    const failed = exchange('fixture: failed', { replyState: 'FAILED' });
    await loaded(r, [completed, failed, keyless, pending]);
    expect(armed(r)).toHaveLength(1);
    await recheck(r, { kind: 'ANSWERED', exchange: pending }, page([completed, failed, keyless, pending]));
    await recheck(r, { kind: 'ANSWERED', exchange: pending }, page([completed, failed, keyless, pending]));
    expect(new Set(r.transport.submissions.map((s) => s.submission.idempotencyKey))).toEqual(new Set([restoredKey]));
    expect(r.controller.getState().exchanges).toHaveLength(4);

    const retiring = await restoredRig();
    retiring.r.controller.retire();
    expect(armed(retiring.r)).toHaveLength(0);
  });

  it('the reader\'s own outstanding request for the same turn is the one that answers: the re-check waits for it', async () => {
    const r = rig();
    await loaded(r, []);
    r.controller.setDraft('fixture: words');
    r.controller.send();
    // A history read during the request already shows the admitted turn, PENDING.
    const admitted = exchange('fixture: words', { key: 'key-1', replyState: 'PENDING' });
    r.controller.ensureHistory();
    r.transport.answerRead(page([admitted]));
    await flush();
    fire(armed(r)[0]);
    await flush();
    expect(r.transport.submissions).toHaveLength(1);
    expect(armed(r)).toHaveLength(1);
  });
});

describe('W1A-01 — one runtime generation', () => {
  it('after retirement nothing is applied, nothing is issued, and no catch-up is requested', async () => {
    const r = rig();
    await loaded(r, []);
    r.controller.setDraft('fixture: words');
    r.controller.send();
    r.controller.retire();
    r.transport.answerSubmit({ kind: 'ANSWERED', exchange: exchange('fixture: words', { key: 'key-1' }) });
    await flush();
    expect(r.controller.getState().exchanges).toEqual([]);
    expect(r.catchUps.count).toBe(0);
    expect(r.timers[0].cleared).toBe(true);
    r.controller.ensureHistory();
    expect(r.transport.reads).toHaveLength(1);
  });

  it('an answer that arrives after the generation stopped being current changes nothing', async () => {
    const r = rig();
    await loaded(r, []);
    r.controller.setDraft('fixture: words');
    r.controller.send();
    r.current.value = false;
    r.transport.answerSubmit({ kind: 'ANSWERED', exchange: exchange('fixture: words', { key: 'key-1' }) });
    await flush();
    expect(r.controller.getState().exchanges).toEqual([]);
    expect(r.catchUps.count).toBe(0);
  });

  it('the default key is a bounded, non-credential string, and two keys are never equal', () => {
    const keys = new Set(Array.from({ length: 2000 }, () => mintSubmissionKey()));
    expect(keys.size).toBe(2000);
    for (const key of keys) {
      expect(key.length).toBeGreaterThan(8);
      expect(key.length).toBeLessThanOrEqual(128);
      expect(key).toMatch(/^w1a-[0-9a-z-]+$/u);
    }
  });
});
