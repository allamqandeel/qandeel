/**
 * T-13 §15 — advancing the durable recovery snapshot from the ONE canonical store.
 *
 * > **A snapshot advances when an effective canonical act changes a persisted field. A passive server
 * > update never does.**
 *
 * The writer subscribes to the canonical store and, on every publish, reads the persisted subset by
 * name — `TM`, `IF_ref`, `MC`, `RH` — and compares it with the last subset it committed. Only a change
 * to that subset produces a write. `LH` and `LF` are not in the subset, so a live-head advance or a
 * Live Focus transition underneath an unchanged viewpoint issues nothing at all, and neither value is
 * ever copied into durable Product recovery.
 *
 * The very first write happens at attach, unconditionally: it is the RECOVERY LOCATOR — this
 * identity's active Session together with the viewpoint the store was constructed with — and it is what
 * makes a Session resumable even for a reader who restarts before acting.
 *
 * Nothing here blocks the store or the UI. A write is enqueued and forgotten; the store's own serialized
 * chain and sequence gate guarantee order and refuse stale overwrites, and `isCurrent` is re-asked inside
 * the serialized section so a generation retired while a write waited commits nothing.
 */
import type { CanonicalStore } from '../../state';
import { productRecoveryRecord, recoveredViewpointEquals, recoveredViewpointOf, type RecoveredViewpoint } from '../schema';
import type { ProductRecoveryStore, RecoveryWriteOutcome } from '../store/product-recovery-store';

export interface RecoveryWriterOptions {
  readonly store: CanonicalStore;
  readonly recovery: ProductRecoveryStore;
  /** The authenticated owner this runtime generation belongs to. Never inferred from the record. */
  readonly ownerUserId: string;
  /** The active Session the store was constructed for. Never read from the record. */
  readonly sessionId: string;
  /** Whether the runtime generation that attached this writer is still the current one. */
  readonly isCurrent: () => boolean;
  /** The sequence the loaded record carried, or `0` for a fresh Session. Writes continue strictly above it. */
  readonly startSequence: number;
}

export interface RecoveryWriterStatus {
  readonly attached: boolean;
  /** Writes issued to the store, including the locator write at attach. */
  readonly issued: number;
  /** Writes the store reported COMMITTED. */
  readonly committed: number;
  readonly superseded: number;
  readonly skipped: number;
  readonly failed: number;
  readonly lastSequence: number;
}

export interface RecoveryWriter {
  /** Stop observing. Nothing issued after this, and nothing still queued commits. */
  retire(): void;
  /** Resolves once every write issued so far has been answered by the store. For proofs, never for the UI. */
  settled(): Promise<void>;
  status(): RecoveryWriterStatus;
}

export function attachRecoveryWriter(options: RecoveryWriterOptions): RecoveryWriter {
  const { store, recovery, ownerUserId, sessionId, isCurrent } = options;
  let attached = true;
  let sequence = options.startSequence;
  let issued = 0;
  let committed = 0;
  let superseded = 0;
  let skipped = 0;
  let failed = 0;
  const outstanding = new Set<Promise<RecoveryWriteOutcome>>();

  const admit = () => attached && isCurrent();

  function issue(viewpoint: RecoveredViewpoint): void {
    sequence += 1;
    issued += 1;
    const write = recovery.write(productRecoveryRecord(ownerUserId, sessionId, viewpoint, sequence), { admit });
    outstanding.add(write);
    void write.then(
      (outcome) => {
        outstanding.delete(write);
        if (outcome.kind === 'COMMITTED') committed += 1;
        else if (outcome.kind === 'SUPERSEDED') superseded += 1;
        else if (outcome.kind === 'SKIPPED') skipped += 1;
        else failed += 1;
      },
      () => {
        outstanding.delete(write);
        failed += 1;
      },
    );
  }

  // The recovery locator: written at attach, before any act.
  let last = recoveredViewpointOf(store.getState());
  issue(last);

  const unsubscribe = store.subscribe(() => {
    if (!admit()) return;
    const next = recoveredViewpointOf(store.getState());
    // A publish that changed only `LH` or `LF` leaves the persisted subset equal, and issues nothing.
    if (recoveredViewpointEquals(last, next)) return;
    last = next;
    issue(next);
  });

  return {
    retire() {
      if (!attached) return;
      attached = false;
      unsubscribe();
    },
    async settled() {
      await Promise.all(Array.from(outstanding));
    },
    status: () => ({ attached, issued, committed, superseded, skipped, failed, lastSequence: sequence }),
  };
}
