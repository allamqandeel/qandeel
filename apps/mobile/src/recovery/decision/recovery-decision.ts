/**
 * T-13 §5 / §13 — what a loaded record means for the bootstrap, decided in one pure function.
 *
 * Three answers, and no fourth:
 *
 *   FRESH     nothing is stored for this identity — the existing clean new-Session bootstrap applies;
 *   RESUME    a valid record exists — its Session is resumed through the existing bootstrap seam and
 *             its viewpoint is reconciled against the fresh authoritative snapshot; no Session is created;
 *   REFUSED   something is stored and it cannot be trusted, or the storage could not answer at all.
 *             Recovery fails closed: no replacement Session is created in its place, the Product does
 *             not become READY, and the refusal is exposed as a controlled state.
 *
 * "Unavailable storage" is refused rather than treated as "no record", deliberately: creating a fresh
 * Session while the reader's real one may still be stored would orphan the real one and present a
 * viewpoint the reader never committed. Not knowing is not the same as knowing there is nothing.
 */
import type { ProductRecoveryRecord } from '../schema';
import type { RecoveryLoadOutcome, RecoveryLoadRejection } from '../store/product-recovery-store';

export type RecoveryRefusal =
  | { readonly kind: 'RECORD_INVALID'; readonly reason: RecoveryLoadRejection; readonly detail: string }
  | { readonly kind: 'STORAGE_UNAVAILABLE'; readonly detail: string };

export type RecoveryDecision =
  | { readonly kind: 'FRESH' }
  | { readonly kind: 'RESUME'; readonly record: ProductRecoveryRecord }
  | { readonly kind: 'REFUSED'; readonly refusal: RecoveryRefusal };

export function decideRecovery(ownerUserId: string, loaded: RecoveryLoadOutcome): RecoveryDecision {
  switch (loaded.kind) {
    case 'NO_RECORD':
      return { kind: 'FRESH' };
    case 'RECORD':
      // The store already refused a foreign owner; asked again here so the decision cannot depend on
      // the store having asked, and a record for anyone but this reader can never be resumed.
      if (loaded.record.ownerUserId !== ownerUserId) {
        return { kind: 'REFUSED', refusal: { kind: 'RECORD_INVALID', reason: 'OWNER_MISMATCH', detail: 'the record belongs to a different identity' } };
      }
      return { kind: 'RESUME', record: loaded.record };
    case 'INVALID':
      return { kind: 'REFUSED', refusal: { kind: 'RECORD_INVALID', reason: loaded.reason, detail: loaded.detail } };
    case 'UNAVAILABLE':
      return { kind: 'REFUSED', refusal: { kind: 'STORAGE_UNAVAILABLE', detail: loaded.detail } };
    default: {
      const exhaustive: never = loaded;
      return exhaustive;
    }
  }
}
