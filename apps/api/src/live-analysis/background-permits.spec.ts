import { DatabaseBackgroundPermitGate, UNGATED_BACKGROUND_PERMITS } from './background-permits';
import { DatabasePostResponseBackgroundGate, POST_RESPONSE_GATE_POLICY } from './post-response-background-gate';

const USER = '44444444-4444-4444-8444-444444444444';
const SESSION = '33333333-3333-4333-8333-333333333333';

function clockedRpc(outcomes: string[]) {
  let now = 0;
  const calls: { name: string; body: Record<string, unknown> }[] = [];
  const rpc = jest.fn(async (name: string, body: Record<string, unknown>) => {
    calls.push({ name, body });
    if (name === 'server_release_background_permit_v1') return [{ outcome: 'RELEASED' }];
    return [{ outcome: outcomes.shift() ?? 'GRANTED' }];
  });
  const sleep = jest.fn(async (ms: number) => { now += ms; });
  return { rpc, calls, sleep, now: () => now };
}

describe('S8B-05 CP3: the shared background permits', () => {
  it('waits with jittered backoff until GRANTED, measures the wait, and releases once', async () => {
    const r = clockedRpc(['WAIT_CRITICAL_WINDOW', 'WAIT_CAPACITY', 'GRANTED']);
    const gate = new DatabaseBackgroundPermitGate({ rpc: r.rpc as never }, { sleep: r.sleep, now: r.now, random: () => 1 });
    const permit = await gate.acquire(USER, 'CALL_ANALYSIS', { respectCriticalWindow: true, maxWaitMs: 10_000 });
    expect(permit).not.toBeNull();
    expect(r.sleep.mock.calls.map((c) => c[0])).toEqual([50, 100]);
    expect(permit!.waitedMs).toBe(150);
    const asks = r.calls.filter((c) => c.name === 'server_acquire_background_permit_v1');
    expect(new Set(asks.map((c) => c.body.p_holder)).size).toBe(1);
    expect(asks[0].body).toMatchObject({ p_user_id: USER, p_work_kind: 'CALL_ANALYSIS', p_respect_critical_window: true });
    await permit!.release();
    await permit!.release();
    expect(r.calls.filter((c) => c.name === 'server_release_background_permit_v1')).toHaveLength(1);
  });

  it('gives up at its bound with null (nothing started), never past it', async () => {
    const r = clockedRpc(Array(100).fill('WAIT_USER_LIMIT'));
    const gate = new DatabaseBackgroundPermitGate({ rpc: r.rpc as never }, { sleep: r.sleep, now: r.now, random: () => 1 });
    expect(await gate.acquire(USER, 'TEXT_SEMANTIC_ANALYSIS', { respectCriticalWindow: false, maxWaitMs: 2_000 })).toBeNull();
    expect(r.now()).toBe(2_000);
  });

  it('a wake asks again before the backoff step ends; it never grants by itself', async () => {
    const r = clockedRpc(['WAIT_CRITICAL_WINDOW', 'GRANTED']);
    const neverSleeps = jest.fn(() => new Promise<void>(() => undefined));
    const gate = new DatabaseBackgroundPermitGate({ rpc: r.rpc as never }, { sleep: neverSleeps, now: r.now, random: () => 1 });
    const wake = jest.fn(async () => undefined);
    const permit = await gate.acquire(USER, 'CALL_ANALYSIS', { respectCriticalWindow: true, maxWaitMs: 10_000, wake });
    expect(permit).not.toBeNull();
    expect(wake).toHaveBeenCalledTimes(1);
    expect(r.calls.filter((c) => c.name === 'server_acquire_background_permit_v1')).toHaveLength(2);
  });

  it('a capacity wait asks again as soon as this instance frees capacity (a release or a close), never granted by it', async () => {
    const r = clockedRpc(['GRANTED', 'WAIT_CAPACITY', 'GRANTED']);
    const neverSleeps = jest.fn(() => new Promise<void>(() => undefined));
    const gate = new DatabaseBackgroundPermitGate({ rpc: r.rpc as never }, { sleep: neverSleeps, now: r.now, random: () => 1 });
    const held = await gate.acquire(USER, 'CALL_ANALYSIS', { respectCriticalWindow: false, maxWaitMs: 10_000 });
    const waiting = gate.acquire(USER, 'CALL_ANALYSIS', { respectCriticalWindow: false, maxWaitMs: 10_000 });
    await new Promise((resolve) => setImmediate(resolve));
    expect(r.calls.filter((c) => c.name === 'server_acquire_background_permit_v1')).toHaveLength(2);
    // The backoff never ends (sleep never resolves): only the release wakes the wait, and the database grants it.
    await held!.release();
    expect(await waiting).not.toBeNull();
    expect(r.calls.filter((c) => c.name === 'server_acquire_background_permit_v1')).toHaveLength(3);

    const closed = clockedRpc(['WAIT_CAPACITY', 'GRANTED']);
    const other = new DatabaseBackgroundPermitGate({ rpc: closed.rpc as never }, { sleep: neverSleeps, now: closed.now, random: () => 1 });
    const pending = other.acquire(USER, 'CALL_ANALYSIS', { respectCriticalWindow: false, maxWaitMs: 10_000 });
    await new Promise((resolve) => setImmediate(resolve));
    other.capacityMayHaveChanged();
    expect(await pending).not.toBeNull();
  });

  it('refuses an unknown outcome instead of guessing', async () => {
    const r = clockedRpc(['MAYBE']);
    const gate = new DatabaseBackgroundPermitGate({ rpc: r.rpc as never }, { sleep: r.sleep, now: r.now });
    await expect(gate.acquire(USER, 'CALL_ANALYSIS', { respectCriticalWindow: true, maxWaitMs: 1_000 })).rejects.toThrow('unknown outcome');
  });

  it('the ungated gate always grants (a runtime without the database)', async () => {
    const permit = await UNGATED_BACKGROUND_PERMITS.acquire(USER, 'POST_RESPONSE_INTELLIGENCE', { respectCriticalWindow: true, maxWaitMs: 0 });
    expect(permit?.waitedMs).toBe(0);
  });
});

describe('S8B-05 CP3: the post-response background gate', () => {
  const envelope = JSON.stringify({ subject_user_id: USER, subject_session_id: SESSION, subject_turn_id: USER });
  const granted = { acquire: jest.fn(async () => ({ waitedMs: 0, release: jest.fn(async () => undefined) })) };

  it('a text session needs no lease; one permit with L2 respected', async () => {
    const rpc = jest.fn(async () => [{ outcome: 'NOT_REQUIRED' }]);
    const gate = new DatabasePostResponseBackgroundGate({ rpc: rpc as never }, granted);
    const entry = await gate.enter(envelope);
    expect(entry).not.toBeNull();
    expect(granted.acquire).toHaveBeenCalledWith(USER, 'POST_RESPONSE_INTELLIGENCE', { respectCriticalWindow: true, maxWaitMs: POST_RESPONSE_GATE_POLICY.permitWaitMs });
    await entry!.release();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('a session held by the call analysis worker is waited for, then left for reclaim (null), never cancelled', async () => {
    let now = 0;
    const rpc = jest.fn(async () => [{ outcome: 'BUSY' }]);
    const gate = new DatabasePostResponseBackgroundGate({ rpc: rpc as never }, granted, async (ms) => { now += ms; }, () => now);
    expect(await gate.enter(envelope)).toBeNull();
    expect(now).toBeGreaterThanOrEqual(POST_RESPONSE_GATE_POLICY.leaseWaitMs);
  });

  it('an acquired lease is returned with the permit, and returned at once when no permit is granted', async () => {
    const rpc = jest.fn(async (name: string) => [{ outcome: name === 'server_acquire_session_semantic_lease_v1' ? 'ACQUIRED' : 'RELEASED' }]);
    const gate = new DatabasePostResponseBackgroundGate({ rpc: rpc as never }, { acquire: jest.fn(async () => null) });
    expect(await gate.enter(envelope)).toBeNull();
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['server_acquire_session_semantic_lease_v1', 'server_release_session_semantic_lease_v1']);
  });

  it('an envelope naming no valid subject is not gated (the dispatcher refuses it on its own terms)', async () => {
    const rpc = jest.fn();
    const gate = new DatabasePostResponseBackgroundGate({ rpc: rpc as never }, granted);
    expect(await gate.enter('not json')).not.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
