// S8B-05 CP3 - the shared background provider permits (contract v1.2 A1 §3, L2 - L5; migration 0191).
//
// One permit per unit of background provider work - a call analysis half, a text exchange's semantic establishment after
// its reply, a post-response execution - asked once BEFORE the unit reads its semantic context, shared by every instance
// through PostgreSQL. The live call reply, the typed reply and the voice-note reply never ask: nothing here is on a reply
// path, and the voice path makes no database call for it.
//
// Waiting is jittered backoff, bounded by the caller and measured. Nothing is cancelled once started and nothing is
// dropped: a caller that is not granted in time gives the work back to its own retry (the queue, the stream, the
// idempotent replay), never a default answer. A held permit is renewed while its unit runs, so a long walk keeps its slot,
// and a crashed instance's permit lapses in the database.

import { randomUUID } from 'node:crypto';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

export type BackgroundWorkKind = 'CALL_ANALYSIS' | 'TEXT_SEMANTIC_ANALYSIS' | 'POST_RESPONSE_INTELLIGENCE';

export interface BackgroundPermitRequest {
  /** L2: wait while this person's live reply is generating with nothing heard yet (call analysis and post-response). */
  readonly respectCriticalWindow: boolean;
  /** The longest this unit may wait for a slot before giving its work back to its own retry. */
  readonly maxWaitMs: number;
  /**
   * Optional: resolves when the wait is worth asking again before its backoff step ends - the reply's first audio ends
   * L2's window, so the call analysis worker wakes on it instead of sleeping past it. Never grants anything by itself.
   */
  readonly wake?: () => Promise<void>;
}

export interface BackgroundPermit {
  /** How long the unit waited for its slot (0 when granted at once). */
  readonly waitedMs: number;
  /** Returns the slot. Safe to call more than once; a failed release lapses in the database. */
  release(): Promise<void>;
}

export type BackgroundPermitWait = 'WAIT_CRITICAL_WINDOW' | 'WAIT_USER_LIMIT' | 'WAIT_CAPACITY';

/** What a gate observed, for measurement only: never content, never an identity beyond the work kind. */
export interface BackgroundPermitObserver {
  granted?(kind: BackgroundWorkKind, waitedMs: number): void;
  waited?(kind: BackgroundWorkKind, reason: BackgroundPermitWait): void;
  timedOut?(kind: BackgroundWorkKind, waitedMs: number): void;
}

export interface BackgroundPermitGate {
  /** A permit, or `null` when none was granted within `maxWaitMs` (nothing was started). */
  acquire(userId: string, kind: BackgroundWorkKind, request: BackgroundPermitRequest): Promise<BackgroundPermit | null>;
}

/** The gate of a runtime with no shared permits (unit tests, a module wired without the database): always granted. */
export const UNGATED_BACKGROUND_PERMITS: BackgroundPermitGate = Object.freeze({
  acquire: async (): Promise<BackgroundPermit> => ({ waitedMs: 0, release: async () => undefined }),
});

export const BACKGROUND_PERMIT_BACKOFF = Object.freeze({ firstMs: 50, maxMs: 1_000 });
/** A held permit is renewed this often; the database lease (0191 policy, 120 s) is several renewals long. */
export const BACKGROUND_PERMIT_RENEW_MS = 30_000;

interface AcquireRow {
  readonly outcome: 'GRANTED' | BackgroundPermitWait;
}

export interface DatabaseBackgroundPermitGateOptions {
  readonly sleep?: (ms: number) => Promise<void>;
  readonly random?: () => number;
  readonly now?: () => number;
  readonly observer?: BackgroundPermitObserver;
}

export class DatabaseBackgroundPermitGate implements BackgroundPermitGate {
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(
    private readonly serviceApi: Pick<SupabaseServiceRoleApiService, 'rpc'>,
    private readonly options: DatabaseBackgroundPermitGateOptions = {},
  ) {
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
  }

  async acquire(userId: string, kind: BackgroundWorkKind, request: BackgroundPermitRequest): Promise<BackgroundPermit | null> {
    const holder = randomUUID();
    const started = this.now();
    let backoff: number = BACKGROUND_PERMIT_BACKOFF.firstMs;
    for (;;) {
      const outcome = await this.ask(userId, kind, holder, request.respectCriticalWindow);
      const waitedMs = this.now() - started;
      if (outcome === 'GRANTED') {
        this.options.observer?.granted?.(kind, waitedMs);
        return this.held(userId, kind, holder, waitedMs);
      }
      this.options.observer?.waited?.(kind, outcome);
      if (waitedMs >= request.maxWaitMs) {
        this.options.observer?.timedOut?.(kind, waitedMs);
        return null;
      }
      // Full jitter over the current step, never past the caller's bound.
      const step = Math.max(1, Math.round(backoff * (0.5 + this.random() / 2)));
      const pause = this.sleep(Math.min(step, Math.max(1, request.maxWaitMs - waitedMs)));
      await (request.wake ? Promise.race([pause, request.wake()]) : pause);
      backoff = Math.min(BACKGROUND_PERMIT_BACKOFF.maxMs, backoff * 2);
    }
  }

  private async ask(userId: string, kind: BackgroundWorkKind, holder: string, respectCriticalWindow: boolean): Promise<AcquireRow['outcome']> {
    const rows = await this.serviceApi.rpc<AcquireRow[]>('server_acquire_background_permit_v1', {
      p_user_id: userId,
      p_work_kind: kind,
      p_holder: holder,
      p_respect_critical_window: respectCriticalWindow,
    });
    const outcome = Array.isArray(rows) ? rows[0]?.outcome : undefined;
    if (outcome !== 'GRANTED' && outcome !== 'WAIT_CRITICAL_WINDOW' && outcome !== 'WAIT_USER_LIMIT' && outcome !== 'WAIT_CAPACITY') {
      throw new Error('The background permit authority returned an unknown outcome.');
    }
    return outcome;
  }

  private held(userId: string, kind: BackgroundWorkKind, holder: string, waitedMs: number): BackgroundPermit {
    let released = false;
    // Renewal is the same idempotent grant for the same holder; it never waits (a held slot is not re-queued) and a
    // failure only shortens the lease to the database's own lapse.
    const renew = setInterval(() => {
      if (!released) this.ask(userId, kind, holder, false).catch(() => undefined);
    }, BACKGROUND_PERMIT_RENEW_MS);
    renew.unref?.();
    return {
      waitedMs,
      release: async () => {
        if (released) return;
        released = true;
        clearInterval(renew);
        try {
          await this.serviceApi.rpc('server_release_background_permit_v1', { p_holder: holder });
        } catch {
          // A permit that cannot be returned lapses at its lease in the database.
        }
      },
    };
  }
}
