/** W1B-01 — the account's first-use presentation for one runtime generation. */
import { ACCOUNT_READ_WAIT_MS, createAccountController, type AccountTransport } from '..';
import type { AccountFirstUseOutcome } from '../../runtime-entry';

function scripted() {
  let answer: ((outcome: AccountFirstUseOutcome) => void) | null = null;
  const completions: number[] = [];
  const transport: AccountTransport = {
    readFirstUse: () => new Promise((resolve) => { answer = resolve; }),
    completeWelcome: async () => {
      completions.push(1);
      return true;
    },
  };
  const timers: { tick: () => void; ms: number }[] = [];
  return {
    transport,
    completions,
    timers,
    answer: async (outcome: AccountFirstUseOutcome) => {
      answer?.(outcome);
      await Promise.resolve();
      await Promise.resolve();
    },
    setTimer: (tick: () => void, ms: number) => {
      timers.push({ tick, ms });
      return timers.length;
    },
    clearTimer: () => undefined,
  };
}

const READ = (view: { displayName: string | null; welcomePending: boolean; firstConversationOpening: boolean }): AccountFirstUseOutcome => ({ kind: 'READ', view });

test('LOADING until the server answers, then exactly its first-use state', async () => {
  const s = scripted();
  const account = createAccountController({ transport: s.transport, isCurrent: () => true, setTimer: s.setTimer, clearTimer: s.clearTimer });
  account.start();
  expect(account.getState().status).toBe('LOADING');
  await s.answer(READ({ displayName: 'منى', welcomePending: true, firstConversationOpening: true }));
  expect(account.getState()).toEqual({ status: 'READY', displayName: 'منى', welcomePending: true, firstConversationOpening: true });
});

test('an unreadable account opens the world with no Welcome and no name', async () => {
  const s = scripted();
  const account = createAccountController({ transport: s.transport, isCurrent: () => true, setTimer: s.setTimer, clearTimer: s.clearTimer });
  account.start();
  await s.answer({ kind: 'UNAVAILABLE' });
  expect(account.getState()).toEqual({ status: 'UNAVAILABLE', displayName: null, welcomePending: false, firstConversationOpening: false });
});

test('the wait is bounded: a server that never answers still lets the reader in', async () => {
  const s = scripted();
  const account = createAccountController({ transport: s.transport, isCurrent: () => true, setTimer: s.setTimer, clearTimer: s.clearTimer });
  account.start();
  expect(s.timers.map((t) => t.ms)).toEqual([ACCOUNT_READ_WAIT_MS]);
  s.timers[0].tick();
  expect(account.getState().status).toBe('UNAVAILABLE');
  // A late answer changes nothing: the reader is already in their world.
  await s.answer(READ({ displayName: 'Mona', welcomePending: true, firstConversationOpening: true }));
  expect(account.getState().status).toBe('UNAVAILABLE');
});

test('an unnamed account is never owed a Welcome', async () => {
  const s = scripted();
  const account = createAccountController({ transport: s.transport, isCurrent: () => true, setTimer: s.setTimer, clearTimer: s.clearTimer });
  account.start();
  await s.answer(READ({ displayName: null, welcomePending: true, firstConversationOpening: true }));
  expect(account.getState().welcomePending).toBe(false);
});

test('the Welcome’s start act moves the reader on at once and writes the completion exactly once', async () => {
  const s = scripted();
  const account = createAccountController({ transport: s.transport, isCurrent: () => true, setTimer: s.setTimer, clearTimer: s.clearTimer });
  account.start();
  await s.answer(READ({ displayName: 'Mona', welcomePending: true, firstConversationOpening: true }));
  account.completeWelcome();
  account.completeWelcome();
  expect(account.getState()).toEqual({ status: 'READY', displayName: 'Mona', welcomePending: false, firstConversationOpening: true });
  expect(s.completions).toHaveLength(1);
});

test('a retired generation ignores a late answer and writes nothing', async () => {
  const s = scripted();
  const account = createAccountController({ transport: s.transport, isCurrent: () => true, setTimer: s.setTimer, clearTimer: s.clearTimer });
  account.start();
  account.retire();
  await s.answer(READ({ displayName: 'Mona', welcomePending: true, firstConversationOpening: true }));
  expect(account.getState().status).toBe('LOADING');
  account.completeWelcome();
  expect(s.completions).toHaveLength(0);
});
