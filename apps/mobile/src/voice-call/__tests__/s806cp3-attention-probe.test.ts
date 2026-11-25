/**
 * INTEL-LIVE-01 CP2 — the proof app's attention probe (validation only): off unless the proof server asks, the clock
 * offset of the fastest round trip, and nothing asked of the runtime while off.
 */
import { clockOffset, followAttentionProbe } from '../__validation__/s806cp3-attention-probe';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('INTEL-LIVE-01 CP2: the attention probe', () => {
  it('puts a phone instant on the server clock by the fastest round trip', () => {
    expect(clockOffset([])).toBeNull();
    expect(clockOffset([
      { sent: 1000, server: 5100, received: 1200 },
      { sent: 2000, server: 6010, received: 2020 },
      { sent: 3000, server: 7300, received: 3400 },
    ])).toBe(4000);
  });

  it('does nothing unless the proof server asks for it', async () => {
    const asked: string[] = [];
    const runtime = jest.fn(() => null);
    const stop = followAttentionProbe({
      runtime,
      fetch: async (url) => { asked.push(url); return { ok: true, json: async () => ({ on: false }) }; },
    });
    await flush();
    await flush();
    expect(asked).toEqual(['http://127.0.0.1:8806/proof/probe']);
    expect(runtime).not.toHaveBeenCalled();
    stop();
  });

  it('does nothing when the proof server has no probe route (the iOS Targeted Gate\'s server answers 404)', async () => {
    const asked: string[] = [];
    const runtime = jest.fn(() => null);
    const stop = followAttentionProbe({ runtime, fetch: async (url) => { asked.push(url); return { ok: false, json: async () => ({}) }; } });
    await flush();
    await flush();
    expect(asked).toHaveLength(1);
    expect(runtime).not.toHaveBeenCalled();
    stop();
  });
});
