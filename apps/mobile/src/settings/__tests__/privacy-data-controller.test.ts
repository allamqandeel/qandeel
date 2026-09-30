/**
 * W3-MEGA-S — the Privacy & Data controller: nothing guessed, one act at a time, one command identity per request until
 * it is settled, lost answers reconciled by reading, and a package being prepared read again until it is ready.
 */
import type { PrivacyStateView } from '../../runtime-entry';
import { PRIVACY_PREPARING_POLL_MS, PRIVACY_READ_RETRY_DELAYS_MS, createPrivacyDataController, type PrivacyDataTransport } from '..';

const NONE: PrivacyStateView = { export: { status: 'NONE', availableUntil: null }, deletion: { status: 'NONE', finalAt: null } };
const PREPARING: PrivacyStateView = { ...NONE, export: { status: 'PREPARING', availableUntil: null } };
const READY: PrivacyStateView = { ...NONE, export: { status: 'READY', availableUntil: '2026-10-07T09:00:00.000Z' } };
const SCHEDULED: PrivacyStateView = { ...NONE, deletion: { status: 'SCHEDULED', finalAt: '2026-10-07T09:00:00.000Z' } };
const flush = () => new Promise((resolve) => setImmediate(resolve));

function harness(initial: PrivacyStateView = NONE) {
  let current: PrivacyStateView | null = initial;
  const queue: unknown[] = [];
  const next = async () => queue.shift() as never;
  const transport: PrivacyDataTransport = {
    readPrivacyState: jest.fn(async () => (current === null ? { kind: 'UNAVAILABLE' as const } : { kind: 'READ' as const, view: current })),
    requestDataExport: jest.fn(next),
    downloadDataExport: jest.fn(next),
    requestAccountDeletion: jest.fn(next),
    cancelAccountDeletion: jest.fn(next),
  };
  const timers: { tick: () => void; ms: number }[] = [];
  let ids = 0;
  let live = true;
  const controller = createPrivacyDataController({
    transport,
    isCurrent: () => live,
    newCommandId: () => `command-${(ids += 1)}`,
    setTimer: (tick, ms) => {
      timers.push({ tick, ms });
      return timers.length;
    },
    clearTimer: () => undefined,
  });
  return {
    controller,
    transport,
    timers,
    answer: (...outcomes: unknown[]) => queue.push(...outcomes),
    set: (view: PrivacyStateView | null) => {
      current = view;
    },
    end: () => {
      live = false;
    },
  };
}

describe('the Privacy & Data controller', () => {
  it('reads once when started, and asks again after a failure until it answers', async () => {
    const h = harness();
    h.set(null);
    h.controller.start();
    h.controller.start();
    await flush();
    expect(h.transport.readPrivacyState).toHaveBeenCalledTimes(1);
    expect(h.controller.getState()).toEqual({ status: 'LOADING', view: null });
    expect(h.timers[0].ms).toBe(PRIVACY_READ_RETRY_DELAYS_MS[0]);
    h.set(NONE);
    h.timers[0].tick();
    await flush();
    expect(h.controller.getState()).toEqual({ status: 'READY', view: NONE });
    // Shown again later: the server's state is read again.
    h.set(PREPARING);
    h.controller.start();
    await flush();
    expect(h.transport.readPrivacyState).toHaveBeenCalledTimes(3);
    expect(h.controller.getState().view).toEqual(PREPARING);
  });

  it('refuses every act before the state is known', async () => {
    const h = harness();
    await expect(h.controller.requestExport('pw')).resolves.toBeNull();
    await expect(h.controller.requestDeletion('pw')).resolves.toBeNull();
    await expect(h.controller.cancelDeletion()).resolves.toBeNull();
    await expect(h.controller.downloadExport()).resolves.toBeNull();
  });

  it('reads a package being prepared again, until it is ready — then stops', async () => {
    const h = harness(PREPARING);
    h.controller.start();
    await flush();
    const poll = h.timers.find((t) => t.ms === PRIVACY_PREPARING_POLL_MS);
    expect(poll).toBeDefined();
    h.set(READY);
    poll?.tick();
    await flush();
    expect(h.controller.getState().view).toEqual(READY);
    expect(h.timers.filter((t) => t.ms === PRIVACY_PREPARING_POLL_MS)).toHaveLength(1);
  });

  it('keeps ONE command identity across a lost answer, and settles it once the request is held', async () => {
    const h = harness();
    h.controller.start();
    await flush();
    h.answer({ kind: 'NETWORK' });
    await expect(h.controller.requestExport('pw')).resolves.toBe('RETRY');
    h.answer({ kind: 'ACCEPTED', view: PREPARING.export });
    await expect(h.controller.requestExport('pw')).resolves.toBe('ACCEPTED');
    expect((h.transport.requestDataExport as jest.Mock).mock.calls.map((c) => c[0])).toEqual(['command-1', 'command-1']);
    h.answer({ kind: 'ACCEPTED', view: PREPARING.export });
    await h.controller.requestExport('pw');
    expect((h.transport.requestDataExport as jest.Mock).mock.calls[2][0]).toBe('command-2');
  });

  it('a lost answer on a request the server now holds is accepted — never a false failure', async () => {
    const h = harness();
    h.controller.start();
    await flush();
    h.answer({ kind: 'FAILED' });
    h.set(SCHEDULED);
    await expect(h.controller.requestDeletion('pw')).resolves.toBe('ACCEPTED');
    expect(h.controller.getState().view).toEqual(SCHEDULED);
  });

  it('says only what the server said: a refused password, an empty one, and nothing optimistic', async () => {
    const h = harness();
    h.controller.start();
    await flush();
    await expect(h.controller.requestDeletion('')).resolves.toBe('EMPTY');
    expect(h.transport.requestAccountDeletion).not.toHaveBeenCalled();
    h.answer({ kind: 'PASSWORD_REJECTED' });
    await expect(h.controller.requestDeletion('wrong')).resolves.toBe('PASSWORD_REJECTED');
    expect(h.controller.getState().view).toEqual(NONE);
  });

  it('one act at a time', async () => {
    const h = harness();
    h.controller.start();
    await flush();
    let release: (value: unknown) => void = () => undefined;
    (h.transport.requestDataExport as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const first = h.controller.requestExport('pw');
    await expect(h.controller.requestDeletion('pw')).resolves.toBeNull();
    release({ kind: 'ACCEPTED', view: PREPARING.export });
    await expect(first).resolves.toBe('ACCEPTED');
  });

  it('cancellation: CANCELLED or NONE clears the deletion; NOT_CANCELLABLE reads the truth; a lost answer is judged by reading', async () => {
    const h = harness(SCHEDULED);
    h.controller.start();
    await flush();
    h.answer({ kind: 'CANCELLED' });
    await expect(h.controller.cancelDeletion()).resolves.toBe('CANCELLED');
    expect(h.controller.getState().view?.deletion).toEqual({ status: 'NONE', finalAt: null });

    const late = harness(SCHEDULED);
    late.controller.start();
    await flush();
    late.answer({ kind: 'NOT_CANCELLABLE' });
    late.set({ ...NONE, deletion: { status: 'FINALIZING', finalAt: SCHEDULED.deletion.finalAt } });
    await expect(late.controller.cancelDeletion()).resolves.toBe('NOT_CANCELLABLE');
    expect(late.controller.getState().view?.deletion.status).toBe('FINALIZING');

    const lost = harness(SCHEDULED);
    lost.controller.start();
    await flush();
    lost.answer({ kind: 'NETWORK' });
    lost.set(NONE);
    await expect(lost.controller.cancelDeletion()).resolves.toBe('CANCELLED');
    lost.answer({ kind: 'NETWORK' });
    lost.set(SCHEDULED);
    await expect(lost.controller.cancelDeletion()).resolves.toBe('RETRY');
  });

  it('the download hands out only the server’s ready package; anything else re-reads the state', async () => {
    const h = harness(READY);
    h.controller.start();
    await flush();
    const document = { format: 'qandeel.personal-data-export.v1' };
    h.answer({ kind: 'READY', availableUntil: READY.export.availableUntil, document });
    await expect(h.controller.downloadExport()).resolves.toEqual({ kind: 'READY', document });
    h.answer({ kind: 'NOT_READY', status: 'EXPIRED' });
    h.set({ ...NONE, export: { status: 'EXPIRED', availableUntil: null } });
    await expect(h.controller.downloadExport()).resolves.toEqual({ kind: 'NOT_READY' });
    expect(h.controller.getState().view?.export.status).toBe('EXPIRED');
  });

  it('a retired generation does nothing', async () => {
    const h = harness();
    h.controller.start();
    await flush();
    h.controller.retire();
    await expect(h.controller.requestExport('pw')).resolves.toBeNull();
    expect(h.transport.requestDataExport).not.toHaveBeenCalled();
  });
});
