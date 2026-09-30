/**
 * W3-MEGA-A — the reader's identity and Security & Sign-in acts for one runtime generation. The controller holds only
 * what the server said or what a fresh read shows; it never reports a change it cannot prove.
 */
import type {
  AccountIdentityOutcome,
  AccountIdentityView,
  EmailChangeConfirmOutcome,
  EmailChangeRequestOutcome,
  LoginIdChangeOutcome,
  NameChangeOutcome,
  PasswordChangeOutcome,
  SignOutOthersOutcome,
} from '../../runtime-entry';
import { ACCOUNT_IDENTITY_READ_RETRY_DELAYS_MS, createAccountIdentityController, type AccountIdentityTransport } from '..';

const IDENTITY: AccountIdentityView = Object.freeze({ name: 'Noor', loginId: 'noor.h', email: 'noor@example.test', emailVerified: true });

function server(initial: AccountIdentityView = IDENTITY) {
  let current = { ...initial };
  const reads: AccountIdentityOutcome[] = [];
  const calls: { method: string; args: unknown[] }[] = [];
  const queue: unknown[] = [];
  const transport: AccountIdentityTransport = {
    readIdentity: jest.fn(async () => reads.shift() ?? { kind: 'READ' as const, view: { ...current } }),
    changeName: jest.fn(async (name: string) => (calls.push({ method: 'changeName', args: [name] }), queue.shift() as NameChangeOutcome)),
    changeLoginId: jest.fn(async (commandId: string, loginId: string, password: string) =>
      (calls.push({ method: 'changeLoginId', args: [commandId, loginId, password] }), queue.shift() as LoginIdChangeOutcome)),
    requestEmailChange: jest.fn(async (password: string, email: string) => (calls.push({ method: 'requestEmailChange', args: [password, email] }), queue.shift() as EmailChangeRequestOutcome)),
    confirmEmailChange: jest.fn(async (email: string, a: string, b: string) => (calls.push({ method: 'confirmEmailChange', args: [email, a, b] }), queue.shift() as EmailChangeConfirmOutcome)),
    changePassword: jest.fn(async (password: string, next: string) => (calls.push({ method: 'changePassword', args: [password, next] }), queue.shift() as PasswordChangeOutcome)),
    signOutOtherDevices: jest.fn(async () => (calls.push({ method: 'signOutOtherDevices', args: [] }), queue.shift() as SignOutOthersOutcome)),
  };
  return {
    transport,
    calls,
    answer: (...outcomes: unknown[]) => queue.push(...outcomes),
    failRead: () => reads.push({ kind: 'UNAVAILABLE' }),
    commit: (patch: Partial<AccountIdentityView>) => {
      current = { ...current, ...patch };
    },
  };
}

let ids = 0;
async function ready(s = server()) {
  const timers: { tick: () => void; ms: number }[] = [];
  const controller = createAccountIdentityController({
    transport: s.transport,
    isCurrent: () => true,
    newCommandId: () => `00000000-0000-4000-8000-${String((ids += 1)).padStart(12, '0')}`,
    setTimer: (tick, ms) => (timers.push({ tick, ms }), timers.length),
    clearTimer: () => undefined,
  });
  controller.start();
  await Promise.resolve();
  await Promise.resolve();
  return { controller, timers, s };
}

describe('the identity read', () => {
  it('holds exactly the server’s identity once read, and nothing before', async () => {
    const s = server();
    const controller = createAccountIdentityController({ transport: s.transport, isCurrent: () => true, setTimer: () => null, clearTimer: () => undefined });
    expect(controller.getState()).toEqual({ status: 'LOADING', identity: null });
    controller.start();
    controller.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.getState()).toEqual({ status: 'READY', identity: IDENTITY });
    expect(s.transport.readIdentity).toHaveBeenCalledTimes(1);
  });

  it('asks again after a failed read, with the same back-off as the Public ID', async () => {
    const s = server();
    s.failRead();
    const { controller, timers } = await ready(s);
    expect(controller.getState().status).toBe('LOADING');
    expect(timers.map((t) => t.ms)).toEqual([ACCOUNT_IDENTITY_READ_RETRY_DELAYS_MS[0]]);
    timers[0].tick();
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.getState().status).toBe('READY');
  });

  it('refuses every act before the identity is known, and after retirement', async () => {
    const s = server();
    const controller = createAccountIdentityController({ transport: s.transport, isCurrent: () => true, setTimer: () => null, clearTimer: () => undefined });
    await expect(controller.changeName('X')).resolves.toBeNull();
    const live = (await ready()).controller;
    live.retire();
    await expect(live.signOutOtherDevices()).resolves.toBeNull();
  });
});

describe('the Name', () => {
  it('sends the trimmed Name and shows only the server’s answer', async () => {
    const { controller, s } = await ready();
    s.answer({ kind: 'ANSWERED', answer: 'CHANGED', name: 'Noor Hassan' });
    await expect(controller.changeName('  Noor Hassan ')).resolves.toBe('DONE');
    expect(s.calls[0]).toEqual({ method: 'changeName', args: ['Noor Hassan'] });
    expect(controller.getState().identity?.name).toBe('Noor Hassan');
  });

  it('an empty Name is refused at once; the server’s INVALID is the same answer', async () => {
    const { controller, s } = await ready();
    await expect(controller.changeName('   ')).resolves.toBe('EMPTY');
    expect(s.calls).toEqual([]);
    s.answer({ kind: 'ANSWERED', answer: 'INVALID', name: 'Noor' });
    await expect(controller.changeName('x')).resolves.toBe('EMPTY');
    expect(controller.getState().identity?.name).toBe('Noor');
  });

  it('a lost answer is reconciled by reading: committed → DONE, never a false failure; not committed → RETRY', async () => {
    const { controller, s } = await ready();
    s.answer({ kind: 'NETWORK' });
    s.commit({ name: 'Noor H' });
    await expect(controller.changeName('Noor H')).resolves.toBe('DONE');
    expect(controller.getState().identity?.name).toBe('Noor H');
    s.answer({ kind: 'FAILED' });
    await expect(controller.changeName('Someone Else')).resolves.toBe('RETRY');
    expect(controller.getState().identity?.name).toBe('Noor H');
  });
});

describe('the Login ID', () => {
  it('sends the canonical value, the password once, and ONE command identity per value', async () => {
    const { controller, s } = await ready();
    s.answer({ kind: 'NETWORK' }, { kind: 'ANSWERED', answer: 'CHANGED', loginId: 'noor.new' });
    await expect(controller.changeLoginId(' Noor.New ', 'pw')).resolves.toBe('RETRY');
    await expect(controller.changeLoginId('noor.new', 'pw')).resolves.toBe('DONE');
    const [first, second] = s.calls.filter((c) => c.method === 'changeLoginId');
    expect(first.args[1]).toBe('noor.new');
    expect(second.args[0]).toBe(first.args[0]);
    expect(controller.getState().identity?.loginId).toBe('noor.new');
  });

  it('a different value is a different command', async () => {
    const { controller, s } = await ready();
    s.answer({ kind: 'ANSWERED', answer: 'UNAVAILABLE', loginId: 'noor.h' }, { kind: 'ANSWERED', answer: 'CHANGED', loginId: 'noor.b' });
    await expect(controller.changeLoginId('noor.a', 'pw')).resolves.toBe('UNAVAILABLE');
    await expect(controller.changeLoginId('noor.b', 'pw')).resolves.toBe('DONE');
    const [a, b] = s.calls.map((c) => c.args[0]);
    expect(a).not.toBe(b);
  });

  it('refuses an empty or malformed Login ID before any request, and maps every server answer', async () => {
    const { controller, s } = await ready();
    await expect(controller.changeLoginId('', 'pw')).resolves.toBe('EMPTY');
    await expect(controller.changeLoginId('no', 'pw')).resolves.toBe('MALFORMED');
    expect(s.calls).toEqual([]);
    s.answer({ kind: 'PASSWORD_REJECTED' }, { kind: 'ANSWERED', answer: 'INVALID', loginId: 'noor.h' }, { kind: 'ANSWERED', answer: 'UNCHANGED', loginId: 'noor.h' });
    await expect(controller.changeLoginId('noor.x', 'bad')).resolves.toBe('PASSWORD_REJECTED');
    await expect(controller.changeLoginId('noor.x', 'pw')).resolves.toBe('MALFORMED');
    await expect(controller.changeLoginId('noor.h', 'pw')).resolves.toBe('UNCHANGED');
  });

  it('a lost answer whose change committed is DONE; a conflict never reuses the spent identity', async () => {
    const { controller, s } = await ready();
    s.answer({ kind: 'NETWORK' });
    s.commit({ loginId: 'noor.z' });
    await expect(controller.changeLoginId('noor.z', 'pw')).resolves.toBe('DONE');
    s.answer({ kind: 'CONFLICT' }, { kind: 'ANSWERED', answer: 'CHANGED', loginId: 'noor.y' });
    await expect(controller.changeLoginId('noor.y', 'pw')).resolves.toBe('RETRY');
    await controller.changeLoginId('noor.y', 'pw');
    const ids = s.calls.filter((c) => c.method === 'changeLoginId').map((c) => c.args[0]);
    expect(ids[ids.length - 1]).not.toBe(ids[ids.length - 2]);
  });
});

describe('the Email change', () => {
  it('an implausible Email is refused at once; the server’s outcomes map one to one', async () => {
    const { controller, s } = await ready();
    await expect(controller.requestEmailChange('pw', 'not an email')).resolves.toBe('INVALID_EMAIL');
    expect(s.calls).toEqual([]);
    s.answer({ kind: 'ACCEPTED' }, { kind: 'UNCHANGED' }, { kind: 'PASSWORD_REJECTED' }, { kind: 'NETWORK' });
    await expect(controller.requestEmailChange('pw', ' new@example.test ')).resolves.toBe('CODES_SENT');
    expect(s.calls[0].args).toEqual(['pw', 'new@example.test']);
    await expect(controller.requestEmailChange('pw', 'noor@example.test')).resolves.toBe('UNCHANGED');
    await expect(controller.requestEmailChange('bad', 'new@example.test')).resolves.toBe('PASSWORD_REJECTED');
    await expect(controller.requestEmailChange('pw', 'new@example.test')).resolves.toBe('RETRY');
  });

  it('confirms only on the server’s CHANGED — or, after a lost answer, when the Email read back IS the new one', async () => {
    const { controller, s } = await ready();
    s.answer({ kind: 'CODE_REJECTED' }, { kind: 'NETWORK' }, { kind: 'NETWORK' });
    await expect(controller.confirmEmailChange('new@example.test', '111111', '222222')).resolves.toBe('CODE_REJECTED');
    await expect(controller.confirmEmailChange('new@example.test', '111111', '222222')).resolves.toBe('RETRY');
    s.commit({ email: 'new@example.test' });
    await expect(controller.confirmEmailChange('NEW@example.test', '111111', '222222')).resolves.toBe('CHANGED');
  });
});

describe('Security & Sign-in', () => {
  it('a password change without an answer is NEVER reported as changed', async () => {
    const { controller, s } = await ready();
    s.answer({ kind: 'NETWORK' }, { kind: 'FAILED' }, { kind: 'CHANGED' }, { kind: 'CHANGED_SIGNED_OUT' }, { kind: 'POLICY' }, { kind: 'PASSWORD_REJECTED' });
    await expect(controller.changePassword('old', 'new')).resolves.toBe('RETRY');
    await expect(controller.changePassword('old', 'new')).resolves.toBe('RETRY');
    await expect(controller.changePassword('old', 'new')).resolves.toBe('CHANGED');
    await expect(controller.changePassword('old', 'new')).resolves.toBe('CHANGED_SIGNED_OUT');
    await expect(controller.changePassword('old', 'old')).resolves.toBe('POLICY');
    await expect(controller.changePassword('bad', 'new')).resolves.toBe('PASSWORD_REJECTED');
  });

  it('signs out other devices only on the server’s confirmation', async () => {
    const { controller, s } = await ready();
    s.answer({ kind: 'SIGNED_OUT_OTHERS' }, { kind: 'FAILED' });
    await expect(controller.signOutOtherDevices()).resolves.toBe('DONE');
    await expect(controller.signOutOtherDevices()).resolves.toBe('RETRY');
  });

  it('one act at a time: a second act while one is in flight is refused', async () => {
    const { controller, s } = await ready();
    let release!: (value: SignOutOthersOutcome) => void;
    (s.transport.signOutOtherDevices as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const first = controller.signOutOtherDevices();
    await expect(controller.changePassword('a', 'b')).resolves.toBeNull();
    release({ kind: 'SIGNED_OUT_OTHERS' });
    await expect(first).resolves.toBe('DONE');
  });
});
