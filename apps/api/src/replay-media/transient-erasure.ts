import type { TransientAudioStore } from './transient-audio.store';
import type { ClaimedErasure, TransientMediaRepository } from './transient-media.repository';

/**
 * S8B-07 CP1-B (contract §0.2 step 3, §18.1 – §18.2) — the ONE DELETE-then-HEAD-404 pass over claimed Replay erasure
 * ledger rows, used by the media worker's reaper (every 10 s, keys due now) and by the independent watchdog's backstop
 * (every 60 s, keys past erase_by = due_at + 120 s). Only an absence proven by HEAD after the DELETE completes a key; any
 * failure leaves the row due, and its 60 s claim lease lapses so the next pass retries it. Nothing is ever dropped.
 */
export const ERASURE_STORE_BUDGET_MS = 15_000;

export async function eraseClaimed(
  repository: TransientMediaRepository, store: TransientAudioStore, claims: readonly ClaimedErasure[],
): Promise<{ erased: number; deferred: number }> {
  const result = { erased: 0, deferred: 0 };
  for (const claim of claims) {
    let gone = false;
    try {
      await store.removeTransient(claim.storage_key, null, AbortSignal.timeout(ERASURE_STORE_BUDGET_MS));
      gone = (await store.headTransient(claim.storage_key, null, AbortSignal.timeout(ERASURE_STORE_BUDGET_MS))) === null;
    } catch {
      gone = false;
    }
    if (!gone) {
      result.deferred += 1;
      continue;
    }
    try {
      if (await repository.completeErasure(claim.storage_key, claim.lease_id)) result.erased += 1;
      else result.deferred += 1;
    } catch {
      result.deferred += 1;
    }
  }
  return result;
}

/** The pass's pool-wide bounds (P-3: claims ≤ 25 jobs, sweeps and erasure claims ≤ 100 rows). */
export const SWEEP_LIMIT = 100;
export const ERASURE_CLAIM_LIMIT = 100;
/** erase_by = due_at + 120 s (R1.1): the watchdog's backstop takes only keys past it. */
export const ERASE_BY_SECONDS = 120;
