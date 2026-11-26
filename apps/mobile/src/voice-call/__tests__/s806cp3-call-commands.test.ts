/**
 * INTEL-LIVE-01 CP1 — the iOS Targeted Gate's call commands (validation only): the proof root calls the session's own
 * CallOwner exactly as the call entry and End do, takes each command once and tells the server what it did.
 */
import type { CallOwner, CallStage } from '../../call';
import {
  executeProofCallCommand, followProofCallCommands, PROOF_CALL_COMMANDS_BASE,
} from '../__validation__/s806cp3-call-commands';

function owner(stage: CallStage = 'IDLE') {
  const calls: string[] = [];
  const value = {
    getState: () => ({ stage }),
    start: async () => { calls.push('start'); },
    end: () => { calls.push('end'); },
  } as unknown as CallOwner;
  return { value, calls };
}

const flush = async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); };

describe('the proof call commands', () => {
  it('start is the call entry: the owner starts, unless it is already preparing; end is the call line\'s End', () => {
    const idle = owner('IDLE');
    expect(executeProofCallCommand('start', idle.value)).toBe('STARTED');
    expect(executeProofCallCommand('end', idle.value)).toBe('ENDED');
    expect(idle.calls).toEqual(['start', 'end']);
    const preparing = owner('PREPARING');
    expect(executeProofCallCommand('start', preparing.value)).toBe('BUSY');
    expect(preparing.calls).toEqual([]);
    expect(executeProofCallCommand('start', null)).toBe('NO_SESSION');
  });

  it('takes a command from the loopback proof server, executes it once and acknowledges it with the owner\'s stage', async () => {
    const o = owner('IDLE');
    const asked: string[] = [];
    const answers = [{ id: 7, op: 'start' }];
    let release: (() => void) | null = null;
    const fetch = jest.fn(async (url: string) => {
      asked.push(url);
      if (url.endsWith('/proof/call/next')) {
        const next = answers.shift();
        if (next) return { ok: true, json: async () => next };
        await new Promise<void>((resolve) => { release = resolve; });
        return { ok: true, json: async () => ({ id: null }) };
      }
      return { ok: true, json: async () => ({}) };
    });
    const stop = followProofCallCommands({ owner: () => o.value, fetch, now: () => 0 });
    await flush();
    expect(o.calls).toEqual(['start']);
    expect(asked).toEqual([
      `${PROOF_CALL_COMMANDS_BASE}/proof/call/next`,
      `${PROOF_CALL_COMMANDS_BASE}/proof/call/ack?id=7&outcome=STARTED&stage=IDLE`,
      `${PROOF_CALL_COMMANDS_BASE}/proof/call/next`,
    ]);
    expect(asked.every((u) => u.startsWith('http://127.0.0.1:8806/proof/call'))).toBe(true);
    stop();
    (release as (() => void) | null)?.();
    await flush();
    expect(o.calls).toEqual(['start']);
  });

  it('pauses after a refused request instead of asking again at once', async () => {
    jest.useFakeTimers();
    try {
      const fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) }));
      const stop = followProofCallCommands({ owner: () => null, fetch, pauseMs: 2000 });
      await flush();
      expect(fetch).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1999);
      await flush();
      expect(fetch).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      await flush();
      expect(fetch).toHaveBeenCalledTimes(2);
      stop();
    } finally {
      jest.useRealTimers();
    }
  });
});
