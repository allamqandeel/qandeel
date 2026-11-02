// S8B-05 CP3 - the post-response execution's place in the shared background work (contract v1.1 §1.6, v1.2 A1 §3).
//
// One post-response delivery is one unit of background provider work: it takes the session's semantic lease when the
// session has a live call or open call analysis (NOT_REQUIRED for a text session - unchanged), then one shared background
// permit (L2 respected). A session held by the call analysis worker is waited for, briefly, with the next turn of the
// lease reserved; not entered in time, the delivery is simply not acknowledged and the stream reclaims it later. Delayed,
// never cancelled and never dropped; the dispatcher, its semantics and its budget are untouched.

import { randomUUID } from 'node:crypto';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import type { BackgroundPermitGate } from './background-permits';

export const POST_RESPONSE_BACKGROUND_GATE = Symbol('POST_RESPONSE_BACKGROUND_GATE');

export interface PostResponseBackgroundEntry {
  release(): Promise<void>;
}

export interface PostResponseBackgroundGate {
  /** The entry for one delivery, or null when it must wait for a later reclaim (nothing was started). */
  enter(envelope: string): Promise<PostResponseBackgroundEntry | null>;
}

export const POST_RESPONSE_GATE_POLICY = Object.freeze({ leaseWaitMs: 8_000, permitWaitMs: 5_000, firstBackoffMs: 50, maxBackoffMs: 1_000 });

const PASS: PostResponseBackgroundEntry = Object.freeze({ release: async () => undefined });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function subjectOf(envelope: string): { readonly userId: string; readonly sessionId: string } | null {
  try {
    const event = JSON.parse(envelope) as { subject_user_id?: unknown; subject_session_id?: unknown };
    if (typeof event?.subject_user_id === 'string' && UUID.test(event.subject_user_id)
      && typeof event.subject_session_id === 'string' && UUID.test(event.subject_session_id)) {
      return { userId: event.subject_user_id, sessionId: event.subject_session_id };
    }
  } catch {
    // An unreadable envelope names no subject; the dispatcher refuses it on its own terms.
  }
  return null;
}

export class DatabasePostResponseBackgroundGate implements PostResponseBackgroundGate {
  constructor(
    private readonly serviceApi: Pick<SupabaseServiceRoleApiService, 'rpc'>,
    private readonly permits: BackgroundPermitGate,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    private readonly now: () => number = Date.now,
  ) {}

  async enter(envelope: string): Promise<PostResponseBackgroundEntry | null> {
    const subject = subjectOf(envelope);
    // No valid subject: no provider can be reached for it (the dispatcher and the ledger refuse), so nothing to gate.
    if (!subject) return PASS;
    const holder = randomUUID();
    const leased = await this.lease(subject.userId, subject.sessionId, holder);
    if (leased === null) return null;
    const permit = await this.permits.acquire(subject.userId, 'POST_RESPONSE_INTELLIGENCE', {
      respectCriticalWindow: true,
      maxWaitMs: POST_RESPONSE_GATE_POLICY.permitWaitMs,
    });
    const releaseLease = async (): Promise<void> => {
      if (leased !== 'ACQUIRED') return;
      try {
        await this.serviceApi.rpc('server_release_session_semantic_lease_v1', { p_session_id: subject.sessionId, p_holder: holder });
      } catch {
        // The lease lapses in the database.
      }
    };
    if (!permit) {
      await releaseLease();
      return null;
    }
    return {
      release: async () => {
        await permit.release();
        await releaseLease();
      },
    };
  }

  /** ACQUIRED or NOT_REQUIRED (a text session), or null after the bounded wait on a BUSY session (its lease reserved). */
  private async lease(userId: string, sessionId: string, holder: string): Promise<'ACQUIRED' | 'NOT_REQUIRED' | null> {
    const started = this.now();
    let backoff: number = POST_RESPONSE_GATE_POLICY.firstBackoffMs;
    for (;;) {
      const rows = await this.serviceApi.rpc<{ outcome: string }[]>('server_acquire_session_semantic_lease_v1', {
        p_user_id: userId, p_session_id: sessionId, p_holder: holder,
      });
      const outcome = Array.isArray(rows) ? rows[0]?.outcome : undefined;
      if (outcome === 'ACQUIRED') return 'ACQUIRED';
      // NOT_FOUND: the session is not this subject's; the dispatcher's own ownership check refuses the delivery.
      if (outcome === 'NOT_REQUIRED' || outcome === 'NOT_FOUND') return 'NOT_REQUIRED';
      if (outcome !== 'BUSY') throw new Error('The session semantic lease returned an unknown outcome.');
      if (this.now() - started >= POST_RESPONSE_GATE_POLICY.leaseWaitMs) return null;
      await this.sleep(Math.round(backoff * (0.5 + Math.random() / 2)));
      backoff = Math.min(POST_RESPONSE_GATE_POLICY.maxBackoffMs, backoff * 2);
    }
  }
}
