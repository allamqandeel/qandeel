/**
 * S8B-07 CP1-B (INFRA-07, contract §17.1) — the deployment roles of the one codebase.
 *
 * The Replay Media Compute Pool runs this monolith under `QANDEEL_COMPUTE_ROLE = REPLAY_MEDIA` (the media worker and,
 * from step 3, the Replay Media Service); the independent watchdog runs under `REPLAY_WATCHDOG`. The API (the process
 * that carries the Voice Gateway) runs with no role, or `API`. Each entry point refuses every role but its own, so no
 * Replay work can start on a Live Voice host and no Voice Gateway can start on the Replay pool (V-33).
 *
 * The placement is `REPLAY_POOL` or `NONE` only (V-28). Any same-host mode — DEDICATED, SHARED, or anything else — is a
 * refusal at start-up, never a fallback.
 */
export const COMPUTE_ROLES = ['API', 'REPLAY_MEDIA', 'REPLAY_WATCHDOG'] as const;
export type ComputeRole = (typeof COMPUTE_ROLES)[number];
export const REPLAY_PLACEMENTS = ['REPLAY_POOL', 'NONE'] as const;
export type ReplayPlacement = (typeof REPLAY_PLACEMENTS)[number];

/** A start-up refusal. Names the variable and the refused value class only. */
export class ComputeRoleRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComputeRoleRefusal';
  }
}

/** The process's role: `QANDEEL_COMPUTE_ROLE`, absent meaning `API`. Any other value refuses. */
export function computeRoleOf(env: NodeJS.ProcessEnv): ComputeRole {
  const raw = env.QANDEEL_COMPUTE_ROLE;
  if (raw === undefined || raw === '') return 'API';
  if ((COMPUTE_ROLES as readonly string[]).includes(raw)) return raw as ComputeRole;
  throw new ComputeRoleRefusal('QANDEEL_COMPUTE_ROLE names no known role');
}

/** Refuses to start unless the process runs exactly `expected`. */
export function assertComputeRole(expected: ComputeRole, env: NodeJS.ProcessEnv): void {
  const role = computeRoleOf(env);
  if (role !== expected) throw new ComputeRoleRefusal(`this entry point runs only as ${expected}`);
}

/**
 * `QANDEEL_REPLAY_PLACEMENT`: `REPLAY_POOL` (the Replay pool exists) or `NONE` (it does not: listening and Replay
 * answer BUSY). Absent means `NONE`. DEDICATED, SHARED or any other value refuses (INFRA-07-03; A-5 superseded).
 */
export function replayPlacementOf(env: NodeJS.ProcessEnv): ReplayPlacement {
  const raw = env.QANDEEL_REPLAY_PLACEMENT;
  if (raw === undefined || raw === '') return 'NONE';
  if ((REPLAY_PLACEMENTS as readonly string[]).includes(raw)) return raw as ReplayPlacement;
  throw new ComputeRoleRefusal('QANDEEL_REPLAY_PLACEMENT allows REPLAY_POOL or NONE only; no same-host placement exists');
}

/** The Replay pool's own entry points: the role, and a placement that names the pool. */
export function assertReplayPoolProcess(expected: 'REPLAY_MEDIA' | 'REPLAY_WATCHDOG', env: NodeJS.ProcessEnv): void {
  assertComputeRole(expected, env);
  if (replayPlacementOf(env) !== 'REPLAY_POOL') {
    throw new ComputeRoleRefusal('a Replay pool process starts only with QANDEEL_REPLAY_PLACEMENT=REPLAY_POOL');
  }
}

/** The API's entry point: never a Replay role (the Voice Gateway never shares a process with Replay work). */
export function assertApiProcess(env: NodeJS.ProcessEnv): void {
  assertComputeRole('API', env);
  replayPlacementOf(env);
}

/** The printable text of a start-up failure: a refusal's own message, otherwise only its class (never a value). */
export function startupRefusalText(error: unknown): string {
  const named = error as { name?: string; message?: string } | null;
  const refusals = ['ComputeRoleRefusal', 'ReplayDatabaseRefusal'];
  if (named && typeof named.message === 'string' && refusals.includes(named.name ?? '')) return named.message;
  if (named && typeof named.message === 'string' && /^the Replay (?:pool|store) /u.test(named.message)) return named.message;
  return 'a start-up check failed';
}
