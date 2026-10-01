import { AsyncLocalStorage } from 'node:async_hooks';

// PROD-SEC-02 - the request-scoped foreground work context of ONE createTurn request.
//
// It carries two things and decides neither of them:
//
//   1. The work DEADLINE. Once it has passed, no NEW foreground provider call may start for this request:
//      every foreground provider checks `assertForegroundProviderBudget()` immediately before it would open a
//      provider request. A call already in flight keeps its own bounded provider timeout. Nothing races a timer
//      against running work, and nothing is fabricated when work stops: the reply path fails its turn through
//      the existing canonical failure, and the post-finalization semantic phase stays retryable.
//
//   2. The handle of the database work lease (migration 0131) this request holds for a user turn. The bound
//      itself - how many turns of one session and of one user may do foreground work at once - is owned by the
//      database under a per-user lock (`begin_conversation_turn_work_v1`), so it holds across every API
//      instance. This context only remembers which lease it holds, so the generation and semantic phases of the
//      same exchange share ONE lease, and returns it when the request ends. A crashed request's lease expires
//      in the database on its own.
//
// Outside a scope (background and post-response work, tools and specs that drive the orchestrator directly)
// both checks are inert: those paths are bounded by their own budgets, and the only production foreground entry,
// `ConversationService.createTurn`, always opens a scope.

/** The engineering default for one createTurn request's foreground work, and its hard bounds. */
export const FOREGROUND_TURN_WORK_DEADLINE_DEFAULT_MS = 90_000;
export const FOREGROUND_TURN_WORK_DEADLINE_MIN_MS = 30_000;
/**
 * The ceiling is not tunable upwards: the database work lease lasts the frozen 120-second foreground lease
 * (`foreground_generation_lease_interval_v1`), and the deadline must leave room inside it for the last provider
 * call already in flight (at most 10 s) and the final commits, so a lease can never expire under live work.
 */
export const FOREGROUND_TURN_WORK_DEADLINE_MAX_MS = 90_000;

/** `CONVERSATION_TURN_WORK_DEADLINE_MS`, validated and clamped. A malformed value falls back to the default. */
export function foregroundTurnWorkDeadlineMs(environment: NodeJS.ProcessEnv = process.env): number {
  const raw = environment.CONVERSATION_TURN_WORK_DEADLINE_MS;
  if (raw === undefined || !/^[0-9]{1,9}$/u.test(raw)) return FOREGROUND_TURN_WORK_DEADLINE_DEFAULT_MS;
  return Math.min(FOREGROUND_TURN_WORK_DEADLINE_MAX_MS, Math.max(FOREGROUND_TURN_WORK_DEADLINE_MIN_MS, Number(raw)));
}

/** Thrown BEFORE a provider request is opened once the request's foreground deadline has passed. */
export class ForegroundTurnDeadlineExceededError extends Error {
  constructor() {
    super('The foreground turn work deadline is exhausted; no new provider call is started.');
    this.name = 'ForegroundTurnDeadlineExceededError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The database's answer to "may this request start foreground work for this user turn?". */
export type ForegroundTurnWorkBegin =
  | { readonly outcome: 'GRANTED'; readonly leaseId: string }
  /** Another live request already holds this turn's work lease: never start a second copy of the same work. */
  | { readonly outcome: 'IN_PROGRESS' }
  /** The session or the user is at its foreground work bound right now. */
  | { readonly outcome: 'LIMITED' };

export interface ForegroundTurnWorkGate {
  begin(sessionId: string, userTurnId: string): Promise<ForegroundTurnWorkBegin>;
  end(userTurnId: string, leaseId: string): Promise<void>;
}

/** What a caller learns from `enterForegroundTurnWork`; `UNSCOPED` means no foreground scope is open. */
export type ForegroundTurnWorkEntry = 'GRANTED' | 'IN_PROGRESS' | 'LIMITED' | 'UNSCOPED';

interface ForegroundTurnWorkScope {
  readonly deadlineAt: number;
  readonly now: () => number;
  readonly gate: ForegroundTurnWorkGate;
  /** user turn id -> lease id, for the leases this request holds. */
  readonly held: Map<string, string>;
}

const scopes = new AsyncLocalStorage<ForegroundTurnWorkScope>();

/** Runs one createTurn request inside its foreground scope and returns every lease it took, however it ends. */
export async function runForegroundTurnWork<T>(
  gate: ForegroundTurnWorkGate,
  deadlineMs: number,
  work: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const scope: ForegroundTurnWorkScope = { deadlineAt: now() + deadlineMs, now, gate, held: new Map() };
  try {
    return await scopes.run(scope, work);
  } finally {
    for (const [userTurnId, leaseId] of scope.held) {
      // Best effort: a lease that cannot be returned expires in the database, so a failed release can only ever
      // shorten the bound's slack, never widen it, and never fail the answer the request already has.
      await gate.end(userTurnId, leaseId).catch(() => undefined);
    }
  }
}

/** Called by every foreground provider immediately before it opens a provider request. */
export function assertForegroundProviderBudget(): void {
  const scope = scopes.getStore();
  if (scope && scope.now() >= scope.deadlineAt) throw new ForegroundTurnDeadlineExceededError();
}

/**
 * Asks the database for this user turn's work lease before the first provider-bearing step of the exchange
 * (the generation claim, or the post-finalization semantic walk of an exchange that is not yet established).
 * A lease this request already holds is reused, so one exchange never counts twice.
 */
export async function enterForegroundTurnWork(sessionId: string, userTurnId: string): Promise<ForegroundTurnWorkEntry> {
  const scope = scopes.getStore();
  if (!scope) return 'UNSCOPED';
  if (scope.held.has(userTurnId)) return 'GRANTED';
  const begun = await scope.gate.begin(sessionId, userTurnId);
  if (begun.outcome === 'GRANTED') scope.held.set(userTurnId, begun.leaseId);
  return begun.outcome;
}
