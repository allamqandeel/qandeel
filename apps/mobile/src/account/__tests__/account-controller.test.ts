/** W1B-01 — the account's first-use presentation for one runtime generation. */
import { ACCOUNT_READ_ATTEMPT_MS, ACCOUNT_READ_RETRY_DELAYS_MS, createAccountController, type AccountTransport } from '..';
import type { AccountFirstUseOutcome } from '../../runtime-entry';

function scripted() {
  /** One entry per read the controller asked for, in order. */
  const reads: { resolve: (outcome: AccountFirstUseOutcome) => void; reject: (cause: unknown) => void }[] = [];
  const completions: number[] = [];
  const transport: AccountTransport = {
    readFirstUse: () => new Promise((resolve, reject) => { reads.push({ resolve, reject }); }),
    completeWelcome: async () => {
      completions.push(1);
      return true;
    },
  };
  const timers: { tick: () => void; ms: number; cleared: boolean }[] = [];
  const settle = async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  };
  return {
    transport,
    completions,
    reads,
    timers,
    /** The one timer still waiting, if any. */
    pending: () => timers.filter((t) => !t.cleared),
    /** Let the one waiting timer run out. */
    elapse: () => {
      const [waiting] = timers.filter((t) => !t.cleared);
      waiting.cleared = true;
      waiting.tick();
    },
    answer: async (index: number, outcome: AccountFirstUseOutcome) => {
      reads[index].resolve(outcome);
      await settle();
    },
    fail: async (index: number) => {
      reads[index].reject(new Error('transport'));
      await settle();
    },
    setTimer: (tick: () => void, ms: number) => {
      timers.push({ tick, ms, cleared: false });
      return timers.length - 1;
    },
    clearTimer: (handle: unknown) => {
      timers[handle as number].cleared = true;
    },
  };
}

const READ = (view: { displayName: string | null; welcomePending: boolean; firstConversationOpening: boolean }): AccountFirstUseOutcome => ({ kind: 'READ', view });
const NEW_ACCOUNT = READ({ displayName: 'Mona', welcomePending: true, firstConversationOpening: true });

function controllerOver(s: ReturnType<typeof scripted>) {
  return createAccountController({ transport: s.transport, isCurrent: () => true, setTimer: s.setTimer, clearTimer: s.clearTimer });
}

test('LOADING until the server answers, then exactly its first-use state', async () => {
  const s = scripted();
  const account = controllerOver(s);
  account.start();
  expect(account.getState().status).toBe('LOADING');
  await s.answer(0, READ({ displayName: 'منى', welcomePending: true, firstConversationOpening: true }));
  expect(account.getState()).toEqual({ status: 'READY', displayName: 'منى', welcomePending: true, firstConversationOpening: true });
  expect(s.pending()).toEqual([]);
});

test('an unreadable account is never opened as though first use were not owed: it stays LOADING and asks again', async () => {
  const s = scripted();
  const account = controllerOver(s);
  account.start();
  await s.answer(0, { kind: 'UNAVAILABLE' });
  expect(account.getState().status).toBe('LOADING');
  expect(s.pending().map((t) => t.ms)).toEqual([ACCOUNT_READ_RETRY_DELAYS_MS[0]]);
  s.elapse();
  expect(s.reads).toHaveLength(2);
  await s.fail(1);
  expect(account.getState().status).toBe('LOADING');
  expect(s.pending().map((t) => t.ms)).toEqual([ACCOUNT_READ_RETRY_DELAYS_MS[1]]);
  s.elapse();
  // The read that finally answers resolves normally — first use was delayed, not erased.
  await s.answer(2, NEW_ACCOUNT);
  expect(account.getState()).toEqual({ status: 'READY', displayName: 'Mona', welcomePending: true, firstConversationOpening: true });
  expect(s.completions).toHaveLength(0);
});

test('a server that does not answer never opens the world: time running out only asks again', async () => {
  const s = scripted();
  const account = controllerOver(s);
  account.start();
  expect(s.pending().map((t) => t.ms)).toEqual([ACCOUNT_READ_ATTEMPT_MS]);
  for (let attempt = 0; attempt < ACCOUNT_READ_RETRY_DELAYS_MS.length + 2; attempt += 1) {
    s.elapse(); // the attempt's time runs out
    expect(account.getState().status).toBe('LOADING');
    const delay = ACCOUNT_READ_RETRY_DELAYS_MS[Math.min(attempt, ACCOUNT_READ_RETRY_DELAYS_MS.length - 1)];
    expect(s.pending().map((t) => t.ms)).toEqual([delay]);
    s.elapse(); // the pause before the next read
  }
  expect(account.getState().status).toBe('LOADING');
  expect(s.reads).toHaveLength(ACCOUNT_READ_RETRY_DELAYS_MS.length + 3);
  // A late answer to the FIRST read still resolves normally, and ends the asking.
  await s.answer(0, NEW_ACCOUNT);
  expect(account.getState()).toEqual({ status: 'READY', displayName: 'Mona', welcomePending: true, firstConversationOpening: true });
  expect(s.pending()).toEqual([]);
  // Answers to the others change nothing further.
  await s.answer(1, READ({ displayName: 'Mona', welcomePending: false, firstConversationOpening: false }));
  expect(account.getState().welcomePending).toBe(true);
});

test('an attempt gives way once: its failure after its time ran out asks nothing extra', async () => {
  const s = scripted();
  const account = controllerOver(s);
  account.start();
  s.elapse();
  await s.fail(0);
  expect(s.pending().map((t) => t.ms)).toEqual([ACCOUNT_READ_RETRY_DELAYS_MS[0]]);
  expect(s.reads).toHaveLength(1);
  expect(account.getState().status).toBe('LOADING');
});

test('an unnamed account is never owed a Welcome', async () => {
  const s = scripted();
  const account = controllerOver(s);
  account.start();
  await s.answer(0, READ({ displayName: null, welcomePending: true, firstConversationOpening: true }));
  expect(account.getState().welcomePending).toBe(false);
});

test('the Welcome’s start act moves the reader on at once and writes the completion exactly once', async () => {
  const s = scripted();
  const account = controllerOver(s);
  account.start();
  await s.answer(0, NEW_ACCOUNT);
  account.completeWelcome();
  account.completeWelcome();
  expect(account.getState()).toEqual({ status: 'READY', displayName: 'Mona', welcomePending: false, firstConversationOpening: true });
  expect(s.completions).toHaveLength(1);
});

test('nothing completes the Welcome while the account is unknown', async () => {
  const s = scripted();
  const account = controllerOver(s);
  account.start();
  await s.answer(0, { kind: 'UNAVAILABLE' });
  account.completeWelcome();
  expect(s.completions).toHaveLength(0);
});

test('a retired generation ignores a late answer, asks nothing more and writes nothing', async () => {
  const s = scripted();
  const account = controllerOver(s);
  account.start();
  account.retire();
  expect(s.pending()).toEqual([]);
  await s.answer(0, NEW_ACCOUNT);
  expect(account.getState().status).toBe('LOADING');
  expect(s.reads).toHaveLength(1);
  account.completeWelcome();
  expect(s.completions).toHaveLength(0);
});
