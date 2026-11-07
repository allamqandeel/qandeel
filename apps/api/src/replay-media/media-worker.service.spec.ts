import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { MediaWorkerService } from './media-worker.service';
import { ReplayWatchdogService } from './replay-watchdog.service';
import type { StoreMeter, TransientAudioStore } from './transient-audio.store';
import { eraseClaimed } from './transient-erasure';
import type { TransientMediaRepository } from './transient-media.repository';

// S8B-07 CP1-B — the worker's orchestration, the reaper and the watchdog against fakes (the real ffmpeg, PostgreSQL and
// rclone proof is database/prove-0196-media-worker.mjs). No audio here.
const KEY = 'voice-transient/00000000-0000-4000-8000-000000000001';

function fakeStore(over: Partial<TransientAudioStore> = {}): TransientAudioStore & { removed: string[]; heads: string[] } {
  const removed: string[] = [];
  const heads: string[] = [];
  return {
    removed, heads,
    isConfigured: () => true,
    readSource: async () => null,
    putTransient: async (_k: string, _b: Readable, _n: number, _m: StoreMeter) => undefined,
    headTransient: async (k: string) => {
      heads.push(k);
      return null;
    },
    removeTransient: async (k: string) => {
      removed.push(k);
    },
    openTransient: async () => null,
    ...over,
  };
}

function fakeRepository(over: Partial<Record<keyof TransientMediaRepository, unknown>> = {}) {
  const calls: Array<[string, ...unknown[]]> = [];
  const rec = (name: string, value: unknown) => async (...args: unknown[]) => {
    calls.push([name, ...args]);
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown)(...args) : value;
  };
  const repository = {
    claimJobs: rec('claimJobs', []), readJob: rec('readJob', []), heartbeat: rec('heartbeat', false),
    complete: rec('complete', 'READY'), fail: rec('fail', true),
    sweep: rec('sweep', { expired: 0, late_marked: 0, late_outstanding: 0, purged: 0 }),
    claimErasures: rec('claimErasures', []), completeErasure: rec('completeErasure', true), beat: rec('beat', undefined),
    health: rec('health', null),
    ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, rec(k, v)])),
  } as unknown as TransientMediaRepository;
  return { repository, calls };
}

const bin = { ffmpeg: 'ffmpeg-not-run', ffprobe: 'ffprobe-not-run' };

describe('the media worker (contract §9, §10)', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'replay-worker-spec-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const worker = (repository: TransientMediaRepository, store: TransientAudioStore = fakeStore()) =>
    new MediaWorkerService(repository, store, bin, { concurrency: 1, pollMs: 1000, scratchRoot: root, instanceId: '00000000-0000-4000-8000-0000000000aa' });

  it('a job whose inputs the database withholds is handed back to the database (heartbeat), never mixed', async () => {
    const { repository, calls } = fakeRepository({ readJob: [] });
    expect(await worker(repository).processJob('j', 'l')).toBe('EXPIRED');
    expect(calls.map((c) => c[0])).toEqual(['readJob', 'heartbeat']);
  });

  it('a plan that fails (an unknown container) fails the set with its bounded class; nothing is uploaded', async () => {
    const store = fakeStore({ putTransient: async () => {
      throw new Error('must not upload');
    } });
    const { repository, calls } = fakeRepository({ readJob: [
      { entry: 'JOB', owner_kind: 'LISTENING', generation: 1, storage_key: KEY, expected_duration_ms: 1000, clock_start_ms: 0, clock_end_ms: 1000 },
      { entry: 'SEGMENT', storage_key: 'voice-call/00000000-0000-4000-8000-000000000002', track: 'USER', content_type: 'audio/wav', byte_size: 1, clock_start_ms: 0, clock_end_ms: 1000 },
    ] });
    expect(await worker(repository, store).processJob('j', 'l')).toBe('FAILED');
    const fail = calls.find((c) => c[0] === 'fail')!;
    expect(fail.slice(1, 4)).toEqual(['j', 'l', 'DECODE_FAILED']);
    expect(fail[4]).toEqual(expect.objectContaining({ bytesRead: 0, storeOps: 0 }));
    expect(readdirSync(root)).toEqual([]);
  });

  it('a transport failure (the database unreachable) changes nothing: no fail, the lease lapses and the job is retried', async () => {
    const { repository, calls } = fakeRepository({ readJob: () => {
      throw new Error('ECONNRESET');
    } });
    expect(await worker(repository).processJob('j', 'l')).toBe('DEFERRED');
    expect(calls.map((c) => c[0])).toEqual(['readJob']);
  });

  it('a missing source object fails closed as OBJECT_MISSING (never skipped, never silence)', async () => {
    const { repository, calls } = fakeRepository({ readJob: [
      { entry: 'JOB', owner_kind: 'LISTENING', generation: 1, storage_key: KEY, expected_duration_ms: 1000, clock_start_ms: 0, clock_end_ms: 1000 },
      { entry: 'SEGMENT', storage_key: 'voice-call/00000000-0000-4000-8000-000000000002', track: 'USER', content_type: 'audio/ogg', byte_size: 10, clock_start_ms: 0, clock_end_ms: 1000 },
    ] });
    // The encoder is never reached: the free-space check and the source read come first in this fake world, so the
    // encoder binary is a stub that exits at once.
    const w = new MediaWorkerService(repository, fakeStore(), { ffmpeg: process.execPath, ffprobe: process.execPath },
      { concurrency: 1, pollMs: 1000, scratchRoot: root, instanceId: 'x', minFreeBytes: 0 });
    expect(await w.processJob('j', 'l')).toBe('FAILED');
    expect(calls.find((c) => c[0] === 'fail')!.slice(1, 4)).toEqual(['j', 'l', 'OBJECT_MISSING']);
  });

  it('start-up empties the scratch root: every directory a dead process left is removed', async () => {
    mkdirSync(join(root, 'dead-job'));
    writeFileSync(join(root, 'dead-job', 'out.m4a'), 'x');
    await worker(fakeRepository().repository).cleanScratchRoot();
    expect(readdirSync(root)).toEqual([]);
  });

  it('the reaper sweeps, then erases due keys now (overdue 0), and reports TRANSIENT_ERASURE_LATE while one is outstanding', async () => {
    const outcomes: string[] = [];
    const { repository, calls } = fakeRepository({
      sweep: { expired: 1, late_marked: 0, late_outstanding: 2, purged: 0 },
      claimErasures: [{ storage_key: KEY, lease_id: 'e1' }],
    });
    const w = new MediaWorkerService(repository, fakeStore(), bin, { concurrency: 1, pollMs: 1000, scratchRoot: root, instanceId: 'x' },
      { recordOperationalOutcome: (d: string, o: string, r: string) => outcomes.push(`${d}/${o}/${r}`) } as never);
    expect(await w.reapOnce()).toEqual({ erased: 1, deferred: 0, expired: 1, lateOutstanding: 2 });
    expect(calls.find((c) => c[0] === 'claimErasures')!.slice(1)).toEqual([100, 0]);
    expect(outcomes).toEqual(['REPLAY_MEDIA/sweep/success', 'REPLAY_MEDIA/reap/success', 'TRANSIENT_ERASURE_LATE/erasure/late']);
  });
});

describe('the one DELETE + HEAD 404 pass (contract §18.1)', () => {
  it('only an absence proven by HEAD after the DELETE completes a key; any failure leaves it due', async () => {
    const present = fakeStore({ headTransient: async () => 1234 });
    const { repository, calls } = fakeRepository();
    expect(await eraseClaimed(repository, present, [{ storage_key: KEY, lease_id: 'e' }])).toEqual({ erased: 0, deferred: 1 });
    expect(calls.some((c) => c[0] === 'completeErasure')).toBe(false);
    const failing = fakeStore({ removeTransient: async () => {
      throw new Error('store down');
    } });
    expect(await eraseClaimed(repository, failing, [{ storage_key: KEY, lease_id: 'e' }])).toEqual({ erased: 0, deferred: 1 });
    const gone = fakeStore();
    expect(await eraseClaimed(repository, gone, [{ storage_key: KEY, lease_id: 'e' }])).toEqual({ erased: 1, deferred: 0 });
    expect(gone.removed).toEqual([KEY]);
    expect(gone.heads).toEqual([KEY]);
  });
});

describe('the independent watchdog (V-36)', () => {
  it('one run: its own heartbeat, the sweep, the backstop past erase_by (120 s), then content-free health gauges', async () => {
    const gauges: Array<[string, number]> = [];
    const { repository, calls } = fakeRepository({
      sweep: { expired: 3, late_marked: 1, late_outstanding: 1, purged: 0 },
      claimErasures: [{ storage_key: KEY, lease_id: 'e' }],
      health: { oldest_pending_age_ms: '61000', pending_over_60s: 1, pool_heartbeat_age_ms: null, watchdog_heartbeat_age_ms: 5, erasures_due: 1, erasures_late: 1 },
    });
    const telemetry = { recordOperationalOutcome: () => undefined, recordReplayHealth: (m: string, v: number) => gauges.push([m, v]) };
    const run = await new ReplayWatchdogService(repository, fakeStore(), telemetry as never, 'w').runOnce();
    expect(calls.map((c) => c[0])).toEqual(['beat', 'sweep', 'claimErasures', 'completeErasure', 'health']);
    expect(calls[0]!.slice(1)).toEqual(['w', 'REPLAY_WATCHDOG']);
    expect(calls[2]!.slice(1)).toEqual([100, 120]);
    expect(run).toEqual(expect.objectContaining({ expired: 3, lateMarked: 1, lateOutstanding: 1, erased: 1, deferred: 0 }));
    // The pool heartbeat is absent (every pool instance stopped): it is reported as absent and never emitted as a value.
    expect(run.health!.pool_heartbeat_age_ms).toBeNull();
    expect(gauges.map(([m]) => m)).not.toContain('pool_heartbeat_age_ms');
    expect(gauges).toContainEqual(['oldest_pending_age_ms', 61000]);
  });

  it('a step that fails is reported and the next steps still run', async () => {
    const { repository, calls } = fakeRepository({ sweep: () => {
      throw new Error('down');
    } });
    await new ReplayWatchdogService(repository, fakeStore(), undefined, 'w').runOnce();
    expect(calls.map((c) => c[0])).toEqual(['beat', 'sweep', 'claimErasures', 'health']);
  });
});
