/**
 * S4-01 — the Shared area's own state: authority before anything of a World, one command per act, and nothing of the
 * Personal world.
 */
import type { SharedEntryResult, SharedRootResult } from '../../runtime-entry';
import { createSharedIdController } from '../shared-id-controller';
import { createSharedWorldController, mintSharedCommandId, type SharedWorldTransport } from '../shared-world-controller';

const WORLD = '33333333-3333-4333-8333-333333333333';
const INVITATION = '44444444-4444-4444-8444-444444444444';
const ROOT: SharedRootResult = {
  kind: 'READ',
  root: {
    capabilities: { invitation: true, birth: true },
    worlds: [],
    invitations: [{ invitationId: INVITATION, inviterName: 'Bassem' }],
  },
};
const ALLOW: SharedEntryResult = { kind: 'ALLOW', world: { worldId: WORLD, bornAt: '2026-10-05T00:00:00Z', members: [{ name: 'Amal', self: true }, { name: 'Bassem', self: false }] } };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function transport(overrides: Partial<SharedWorldTransport> = {}) {
  const calls: { name: string; args: unknown[] }[] = [];
  const t: SharedWorldTransport = {
    root: jest.fn(async () => { calls.push({ name: 'root', args: [] }); return ROOT; }),
    invite: jest.fn(async (...args) => { calls.push({ name: 'invite', args }); return { kind: 'SUBMITTED' as const }; }),
    accept: jest.fn(async (...args) => { calls.push({ name: 'accept', args }); return { kind: 'BORN' as const, worldId: WORLD }; }),
    decline: jest.fn(async (...args) => { calls.push({ name: 'decline', args }); return { kind: 'DECLINED' as const }; }),
    entry: jest.fn(async (...args) => { calls.push({ name: 'entry', args }); return ALLOW; }),
    ...overrides,
  };
  return { t, calls };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('S4-01 Shared area controller', () => {
  it('mints v4-shaped command identities', () => {
    for (let i = 0; i < 50; i += 1) expect(mintSharedCommandId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  });

  it('resolves authority BEFORE a World is shown, and shows nothing of it while resolving', async () => {
    const pending = deferred<SharedEntryResult>();
    const { t } = transport({ entry: jest.fn(() => pending.promise) });
    const c = createSharedWorldController({ transport: t, isCurrent: () => true });
    c.openWorld(WORLD);
    expect(c.getState().place).toEqual({ kind: 'WORLD', worldId: WORLD });
    expect(c.getState().entry).toEqual({ status: 'RESOLVING', world: null });
    pending.resolve(ALLOW);
    await flush();
    expect(c.getState().entry.status).toBe('ALLOW');
    expect(c.getState().entry.world?.members).toHaveLength(2);
  });

  it('re-resolves on re-entry: returning to the area hides the World until authority is ALLOW again', async () => {
    let answer: SharedEntryResult = ALLOW;
    const { t } = transport({ entry: jest.fn(async () => answer) });
    const c = createSharedWorldController({ transport: t, isCurrent: () => true });
    c.openWorld(WORLD);
    await flush();
    expect(c.getState().entry.status).toBe('ALLOW');
    answer = { kind: 'DENIED' };
    c.enter();
    expect(c.getState().entry).toEqual({ status: 'RESOLVING', world: null });
    await flush();
    // Revoked authority fails safe: one neutral state, and nothing of the World is kept.
    expect(c.getState().entry).toEqual({ status: 'DENIED', world: null });
    expect(c.getState().place).toEqual({ kind: 'WORLD', worldId: WORLD });
  });

  it('accept births and enters the World at once, through the same authority-first entry', async () => {
    const { t, calls } = transport();
    const c = createSharedWorldController({ transport: t, isCurrent: () => true, newCommandId: () => 'command-1' });
    await c.accept(INVITATION);
    expect(calls.find((x) => x.name === 'accept')?.args).toEqual([INVITATION, 'command-1']);
    expect(c.getState().place).toEqual({ kind: 'WORLD', worldId: WORLD });
    expect(c.getState().entry.status).toBe('ALLOW');
  });

  it('a lost acceptance answer is retried under the SAME command; a delivered one is not kept', async () => {
    let first = true;
    const { t, calls } = transport({
      accept: jest.fn(async (...args: [string, string]) => {
        calls.push({ name: 'accept', args });
        if (first) { first = false; return { kind: 'UNAVAILABLE' as const }; }
        return { kind: 'BORN' as const, worldId: WORLD };
      }),
    });
    let n = 0;
    const c = createSharedWorldController({ transport: t, isCurrent: () => true, newCommandId: () => `command-${++n}` });
    await c.accept(INVITATION);
    expect(c.getState().notice).toBe('ACTION_UNAVAILABLE');
    await c.accept(INVITATION);
    const accepts = calls.filter((x) => x.name === 'accept');
    expect(accepts.map((x) => x.args[1])).toEqual(['command-1', 'command-1']);
  });

  it('decline reports DECLINED and creates nothing to enter', async () => {
    const { t } = transport();
    const c = createSharedWorldController({ transport: t, isCurrent: () => true });
    await c.decline(INVITATION);
    expect(c.getState().notice).toBe('DECLINED');
    expect(c.getState().place).toEqual({ kind: 'ROOT' });
    expect(t.entry).not.toHaveBeenCalled();
  });

  it('an invitation keeps one command per typed value until an answer is delivered', async () => {
    const outcomes = ['UNAVAILABLE', 'SUBMITTED', 'SUBMITTED'] as const;
    let i = 0;
    const seen: string[] = [];
    const { t } = transport({ invite: jest.fn(async (commandId: string) => { seen.push(commandId); return { kind: outcomes[i++] }; }) });
    let n = 0;
    const c = createSharedWorldController({ transport: t, isCurrent: () => true, newCommandId: () => `invite-${++n}` });
    expect(await c.invite('k7qm 4xwd p9tr')).toBe('UNAVAILABLE');
    expect(await c.invite('k7qm 4xwd p9tr')).toBe('SUBMITTED');
    expect(await c.invite('k7qm 4xwd p9tr')).toBe('SUBMITTED');
    expect(seen).toEqual(['invite-1', 'invite-1', 'invite-2']);
  });

  it('publishes nothing once retired or replaced', async () => {
    let current = true;
    const { t } = transport();
    const c = createSharedWorldController({ transport: t, isCurrent: () => current });
    const listener = jest.fn();
    c.subscribe(listener);
    current = false;
    c.enter();
    await flush();
    expect(listener).not.toHaveBeenCalled();
    expect(c.getState().root.status).toBe('IDLE');
  });
});

describe('S4-01 Shared ID controller', () => {
  it('reads on start, regenerates under one command, and never shows the old value after regeneration', async () => {
    const answers = [{ kind: 'READY' as const, sharedId: 'K7QM-4XWD-P9TR' }];
    const regenerate = jest.fn(async () => ({ kind: 'READY' as const, sharedId: 'AB12-CD34-EF56' }));
    const c = createSharedIdController({ transport: { identity: jest.fn(async () => answers[0]), regenerate }, isCurrent: () => true, newCommandId: () => 'regen-1' });
    c.start();
    await flush();
    expect(c.getState()).toEqual({ status: 'READY', sharedId: 'K7QM-4XWD-P9TR', regenerating: false });
    expect(await c.regenerate()).toBe(true);
    expect(regenerate).toHaveBeenCalledWith('regen-1');
    expect(c.getState().sharedId).toBe('AB12-CD34-EF56');
  });

  it('says NOT_OPEN when Shared is closed, and keeps the command for a retry of a lost regeneration', async () => {
    let lost = true;
    const regenerate = jest.fn(async () => (lost ? { kind: 'UNAVAILABLE' as const } : { kind: 'READY' as const, sharedId: 'AB12-CD34-EF56' }));
    let n = 0;
    const c = createSharedIdController({ transport: { identity: jest.fn(async () => ({ kind: 'NOT_OPEN' as const })), regenerate }, isCurrent: () => true, newCommandId: () => `regen-${++n}` });
    c.start();
    await flush();
    expect(c.getState().status).toBe('NOT_OPEN');
    expect(await c.regenerate()).toBe(false);
    lost = false;
    await c.regenerate();
    expect(regenerate.mock.calls.map((call) => (call as unknown[])[0])).toEqual(['regen-1', 'regen-1']);
  });
});
