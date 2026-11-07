import { assertApiProcess, assertReplayPoolProcess, computeRoleOf, replayPlacementOf, startupRefusalText } from './replay-compute-role';
import { assertReplayDatabaseRole, replayPoolSizeOf, type ReplayDatabase } from './replay-database';
import { mediaWorkerOptionsFrom, jobWallCapMs } from './media-worker.service';

// S8B-07 CP1-B — V-28 (REPLAY_POOL / NONE only; no same-host placement) and V-33 / V-36 (1) (each entry point refuses
// the wrong role), plus the P-3 database-role checks at start-up.
describe('deployment roles (INFRA-07)', () => {
  it('no role means the API; only the three named roles exist', () => {
    expect(computeRoleOf({})).toBe('API');
    expect(computeRoleOf({ QANDEEL_COMPUTE_ROLE: 'REPLAY_MEDIA' })).toBe('REPLAY_MEDIA');
    expect(() => computeRoleOf({ QANDEEL_COMPUTE_ROLE: 'LIVE_VOICE_AND_REPLAY' })).toThrow('QANDEEL_COMPUTE_ROLE names no known role');
  });

  it('the API refuses every Replay role, and a Replay entry point refuses the API and the other Replay role', () => {
    expect(() => assertApiProcess({})).not.toThrow();
    expect(() => assertApiProcess({ QANDEEL_COMPUTE_ROLE: 'REPLAY_MEDIA' })).toThrow('this entry point runs only as API');
    expect(() => assertApiProcess({ QANDEEL_COMPUTE_ROLE: 'REPLAY_WATCHDOG' })).toThrow('this entry point runs only as API');
    const pool = { QANDEEL_REPLAY_PLACEMENT: 'REPLAY_POOL' };
    expect(() => assertReplayPoolProcess('REPLAY_MEDIA', { ...pool, QANDEEL_COMPUTE_ROLE: 'REPLAY_MEDIA' })).not.toThrow();
    expect(() => assertReplayPoolProcess('REPLAY_MEDIA', pool)).toThrow('runs only as REPLAY_MEDIA');
    expect(() => assertReplayPoolProcess('REPLAY_MEDIA', { ...pool, QANDEEL_COMPUTE_ROLE: 'REPLAY_WATCHDOG' })).toThrow('runs only as REPLAY_MEDIA');
    expect(() => assertReplayPoolProcess('REPLAY_WATCHDOG', { ...pool, QANDEEL_COMPUTE_ROLE: 'REPLAY_MEDIA' })).toThrow('runs only as REPLAY_WATCHDOG');
  });

  it('V-28: the placement is REPLAY_POOL or NONE; DEDICATED, SHARED or any same-host mode refuses at start-up', () => {
    expect(replayPlacementOf({})).toBe('NONE');
    expect(replayPlacementOf({ QANDEEL_REPLAY_PLACEMENT: 'REPLAY_POOL' })).toBe('REPLAY_POOL');
    for (const mode of ['DEDICATED', 'SHARED', 'SAME_HOST', 'API']) {
      expect(() => replayPlacementOf({ QANDEEL_REPLAY_PLACEMENT: mode })).toThrow('no same-host placement exists');
      expect(() => assertApiProcess({ QANDEEL_REPLAY_PLACEMENT: mode })).toThrow('no same-host placement exists');
    }
    // NONE: no Replay pool process may start (listening and Replay then answer BUSY; no fallback anywhere).
    expect(() => assertReplayPoolProcess('REPLAY_MEDIA', { QANDEEL_COMPUTE_ROLE: 'REPLAY_MEDIA', QANDEEL_REPLAY_PLACEMENT: 'NONE' }))
      .toThrow('starts only with QANDEEL_REPLAY_PLACEMENT=REPLAY_POOL');
  });

  it('a start-up failure prints only a refusal\'s own text, never a value', () => {
    expect(startupRefusalText(new Error('connect ECONNREFUSED 10.0.0.7:5432 password=x'))).toBe('a start-up check failed');
  });
});

describe('the Replay pool\'s database role (P-3) and bounds (D-06.1, D-06.5)', () => {
  const fake = (role: Record<string, unknown>, grants = 0): ReplayDatabase => ({
    query: async <R>(text: string) => (text.includes('role_table_grants') ? [{ n: grants }] : [role]) as R[],
    close: async () => undefined,
  });
  const good = { current_user: 'qandeel_replay_media', rolconnlimit: 10, rolsuper: false, rolbypassrls: false,
    rolconfig: ['statement_timeout=5s', 'lock_timeout=1s', 'idle_in_transaction_session_timeout=10s'] };

  it('starts only as qandeel_replay_media with CONNECTION LIMIT 10, the three timeouts and no table privilege', async () => {
    await expect(assertReplayDatabaseRole(fake(good))).resolves.toBeUndefined();
    await expect(assertReplayDatabaseRole(fake({ ...good, current_user: 'service_role' }))).rejects.toThrow('connects only as qandeel_replay_media');
    await expect(assertReplayDatabaseRole(fake({ ...good, rolconnlimit: -1 }))).rejects.toThrow('CONNECTION LIMIT must be 10');
    await expect(assertReplayDatabaseRole(fake({ ...good, rolconfig: ['statement_timeout=60s', 'lock_timeout=1s', 'idle_in_transaction_session_timeout=10s'] })))
      .rejects.toThrow('statement_timeout must be 5s');
    await expect(assertReplayDatabaseRole(fake({ ...good, rolsuper: true }))).rejects.toThrow('superuser');
    await expect(assertReplayDatabaseRole(fake(good, 1))).rejects.toThrow('no table privilege');
  });

  it('the application pool never exceeds the role\'s limit', () => {
    expect(replayPoolSizeOf({})).toBe(4);
    expect(replayPoolSizeOf({ REPLAY_MEDIA_DB_POOL_MAX: '10' })).toBe(10);
    expect(() => replayPoolSizeOf({ REPLAY_MEDIA_DB_POOL_MAX: '11' })).toThrow();
  });

  it('one mix job per process by default, 2 at most; the wall cap is 20 s + 0.03 × media, at most 150 s', () => {
    expect(mediaWorkerOptionsFrom({}).concurrency).toBe(1);
    expect(mediaWorkerOptionsFrom({ REPLAY_MEDIA_CONCURRENCY: '2' }).concurrency).toBe(2);
    expect(() => mediaWorkerOptionsFrom({ REPLAY_MEDIA_CONCURRENCY: '3' })).toThrow('D-06.1');
    expect(jobWallCapMs(10 * 60_000)).toBe(38_000);
    expect(jobWallCapMs(60 * 60_000)).toBe(128_000);
    expect(jobWallCapMs(5 * 60 * 60_000)).toBe(150_000);
  });
});
