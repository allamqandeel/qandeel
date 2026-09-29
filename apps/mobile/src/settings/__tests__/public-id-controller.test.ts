/**
 * W3-02 (E2E-D-09) — the Public ID controller: the one lifetime change is never guessed.
 *
 * The transport is a scripted double that answers exactly what migration 0125 would; every case asserts what
 * the reader is told AND which command identity reached the server.
 */
import type { AccountPublicIdOutcome, PublicIdChangeOutcome } from '../../runtime-entry';
import { createPublicIdController, isWellFormedPublicId, mintPublicIdCommandId, normalizePublicId, type PublicIdTransport } from '..';

const READ = (publicId: string, changeAvailable: boolean): AccountPublicIdOutcome => ({ kind: 'READ', view: { publicId, changeAvailable } });
const ANSWER = (answer: 'CHANGED' | 'UNCHANGED' | 'INVALID' | 'UNAVAILABLE' | 'ALREADY_USED', publicId: string, changeAvailable: boolean): PublicIdChangeOutcome =>
  ({ kind: 'ANSWERED', answer, view: { publicId, changeAvailable } });

function scripted(reads: AccountPublicIdOutcome[], changes: PublicIdChangeOutcome[]) {
  const calls: { commandId: string; publicId: string }[] = [];
  let readCount = 0;
  const transport: PublicIdTransport = {
    readPublicId: jest.fn(async () => {
      readCount += 1;
      return reads.length > 1 ? reads.shift()! : reads[0];
    }),
    changePublicId: jest.fn(async (commandId: string, publicId: string) => {
      calls.push({ commandId, publicId });
      return changes.shift() ?? { kind: 'NETWORK' as const };
    }),
  };
  return { transport, calls, reads: () => readCount };
}

let ids = 0;
const newCommandId = () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`;
const flush = () => new Promise((resolve) => setImmediate(resolve));

async function ready(reads: AccountPublicIdOutcome[], changes: PublicIdChangeOutcome[]) {
  const double = scripted(reads, changes);
  const timers: (() => void)[] = [];
  const controller = createPublicIdController({ transport: double.transport, isCurrent: () => true, newCommandId, setTimer: (tick) => timers.push(tick), clearTimer: () => undefined });
  controller.start();
  await flush();
  return { controller, timers, ...double };
}

beforeEach(() => {
  ids = 0;
});

describe('the grammar mirror', () => {
  it('normalizes exactly as the database does, and judges the same shapes', () => {
    expect(normalizePublicId('  @Noor.Writes٢٧ ')).toBe('noor.writes27');
    expect(normalizePublicId('@@abc')).toBe('@abc');
    expect(normalizePublicId('ABC۱۲')).toBe('abc12');
    for (const legal of ['abc', 'nightlamp27', 'noor.writes', 'a_b.c9', 'a'.repeat(24)]) expect(isWellFormedPublicId(legal)).toBe(true);
    for (const illegal of ['', 'ab', 'a'.repeat(25), '1abc', '.abc', 'abc.', 'a..b', 'a._b', 'a-b', 'a b', 'نور', '@abc', 'ABC']) expect(isWellFormedPublicId(illegal)).toBe(false);
  });

  it('mints UUID-shaped command identities', () => {
    expect(mintPublicIdCommandId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    expect(mintPublicIdCommandId()).not.toBe(mintPublicIdCommandId());
  });
});

describe('reading', () => {
  it('stays LOADING until the server answers, and asks again after a failure — never a guessed state', async () => {
    const { controller, timers, reads } = await ready([{ kind: 'UNAVAILABLE' }, READ('nightlamp27', true)], []);
    expect(controller.getState()).toEqual({ status: 'LOADING', publicId: null, changeAvailable: false });
    expect(timers).toHaveLength(1);
    timers[0]();
    await flush();
    expect(reads()).toBe(2);
    expect(controller.getState()).toEqual({ status: 'READY', publicId: 'nightlamp27', changeAvailable: true });
  });

  it('start is idempotent, and nothing after retirement changes anything', async () => {
    const { controller, transport } = await ready([READ('nightlamp27', true)], []);
    controller.start();
    expect(transport.readPublicId).toHaveBeenCalledTimes(1);
    controller.retire();
    expect(await controller.commit('noor.writes')).toBeNull();
    expect(transport.changePublicId).not.toHaveBeenCalled();
  });
});

describe('the one lifetime change', () => {
  it('commits the normalized value and consumes the change only when the server says CHANGED', async () => {
    const { controller, calls } = await ready([READ('nightlamp27', true)], [ANSWER('CHANGED', 'noor.writes', false)]);
    const pending = controller.commit(' @Noor.Writes ');
    // Nothing is consumed optimistically while the request is in flight.
    expect(controller.getState()).toMatchObject({ publicId: 'nightlamp27', changeAvailable: true });
    expect(await pending).toBe('DONE');
    expect(calls).toEqual([{ commandId: newCommandIdAt(1), publicId: 'noor.writes' }]);
    expect(controller.getState()).toEqual({ status: 'READY', publicId: 'noor.writes', changeAvailable: false });
  });

  it('a malformed value is told at once, with no request', async () => {
    const { controller, calls } = await ready([READ('nightlamp27', true)], []);
    for (const value of ['', 'ab', '1abc', 'نور', 'a b']) expect(await controller.commit(value)).toBe('INVALID');
    expect(calls).toHaveLength(0);
    expect(controller.getState().changeAvailable).toBe(true);
  });

  it('UNCHANGED (the current ID) and UNAVAILABLE consume nothing; ALREADY_USED ends the change with the canonical value', async () => {
    const { controller } = await ready([READ('nightlamp27', true)], [
      ANSWER('UNCHANGED', 'nightlamp27', true),
      ANSWER('UNAVAILABLE', 'nightlamp27', true),
      ANSWER('ALREADY_USED', 'first.choice', false),
    ]);
    expect(await controller.commit('@NightLamp27')).toBe('UNCHANGED');
    expect(controller.getState().changeAvailable).toBe(true);
    expect(await controller.commit('taken.one')).toBe('UNAVAILABLE');
    expect(controller.getState().changeAvailable).toBe(true);
    expect(await controller.commit('late.try')).toBe('DONE');
    expect(controller.getState()).toEqual({ status: 'READY', publicId: 'first.choice', changeAvailable: false });
  });

  it('a second confirm while one is in flight is refused — one request, one command', async () => {
    let answer!: (outcome: PublicIdChangeOutcome) => void;
    const { controller, transport } = await ready([READ('nightlamp27', true)], []);
    (transport.changePublicId as jest.Mock).mockImplementationOnce(() => new Promise<PublicIdChangeOutcome>((resolve) => { answer = resolve; }));
    const first = controller.commit('noor.writes');
    expect(await controller.commit('noor.writes')).toBeNull();
    answer(ANSWER('CHANGED', 'noor.writes', false));
    expect(await first).toBe('DONE');
    expect(transport.changePublicId).toHaveBeenCalledTimes(1);
  });
});

describe('a lost answer is reconciled by reading, never guessed', () => {
  it('lost answer, change found committed → DONE with the canonical value (no false failure)', async () => {
    const { controller, reads } = await ready([READ('nightlamp27', true), READ('noor.writes', false)], [{ kind: 'NETWORK' }]);
    expect(await controller.commit('noor.writes')).toBe('DONE');
    expect(reads()).toBe(2);
    expect(controller.getState()).toEqual({ status: 'READY', publicId: 'noor.writes', changeAvailable: false });
  });

  it('lost answer, change NOT committed → RETRY, and the retry is the SAME command', async () => {
    const { controller, calls } = await ready([READ('nightlamp27', true), READ('nightlamp27', true)], [{ kind: 'FAILED' }, ANSWER('CHANGED', 'noor.writes', false)]);
    expect(await controller.commit('noor.writes')).toBe('RETRY');
    expect(controller.getState().changeAvailable).toBe(true);
    expect(await controller.commit(' @NOOR.writes')).toBe('DONE');
    expect(calls.map((call) => call.commandId)).toEqual([newCommandIdAt(1), newCommandIdAt(1)]);
  });

  it('lost answer and the read fails too → RETRY (still unknown), and the retry is still the SAME command', async () => {
    const { controller, calls } = await ready([READ('nightlamp27', true), { kind: 'UNAVAILABLE' }, { kind: 'UNAVAILABLE' }], [{ kind: 'NETWORK' }, ANSWER('CHANGED', 'noor.writes', false)]);
    expect(await controller.commit('noor.writes')).toBe('RETRY');
    // The earlier request DID commit: the replay of the same command answers the committed truth.
    expect(await controller.commit('noor.writes')).toBe('DONE');
    expect(new Set(calls.map((call) => call.commandId)).size).toBe(1);
  });

  it('a different value is a different command', async () => {
    const { controller, calls } = await ready([READ('nightlamp27', true)], [ANSWER('UNAVAILABLE', 'nightlamp27', true), ANSWER('CHANGED', 'second.try', false)]);
    await controller.commit('first.try');
    await controller.commit('second.try');
    expect(calls[0].commandId).not.toBe(calls[1].commandId);
  });

  it('a spent command identity is never reused: CONFLICT reconciles and the next confirm mints a new one', async () => {
    const { controller, calls } = await ready([READ('nightlamp27', true), READ('nightlamp27', true)], [{ kind: 'CONFLICT' }, ANSWER('CHANGED', 'noor.writes', false)]);
    expect(await controller.commit('noor.writes')).toBe('RETRY');
    expect(await controller.commit('noor.writes')).toBe('DONE');
    expect(calls[0].commandId).not.toBe(calls[1].commandId);
  });
});

function newCommandIdAt(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
