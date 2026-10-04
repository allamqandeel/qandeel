/**
 * A3-02 — native Direct Entry, held until the reader's own world can execute it (I-08N-01 D38–D43).
 *
 * A notification tap — while the app runs, or the one that launched it from a terminated state — becomes ONE pending
 * entry here, keyed by nothing but the opaque Activity item id it carried. It is NOT executed here and NOT trusted: the
 * composition hands it to Activity's `open`, the ONE boundary that revalidates the item, its target, its authority and
 * its owning context NOW, for the account signed in NOW (D38). So:
 *
 *   - a tap that arrives before the world is ready waits (cold start, sign-in restore) — and is taken once;
 *   - signed out, it is dropped, never carried into whichever account signs in next (no cross-account resume);
 *   - an item of another account answers 404 at `open` and goes nowhere — no substitute destination is invented (D39);
 *   - a newer tap replaces an older one: one entry, the reader's latest intent.
 *
 * It holds no account, no content and no destination of its own.
 */
import type { NotificationTap } from './platform-port';

export interface NotificationEntryInbox {
  /** The pending tap, if any; taking it empties the inbox. */
  take(): NotificationTap | null;
  peek(): NotificationTap | null;
  put(tap: NotificationTap): void;
  /** Signed out: the pending tap is dropped. */
  drop(): void;
  subscribe(listener: () => void): () => void;
}

export function createNotificationEntryInbox(): NotificationEntryInbox {
  let pending: NotificationTap | null = null;
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of Array.from(listeners)) listener(); };
  return {
    take() {
      const tap = pending;
      pending = null;
      if (tap !== null) notify();
      return tap;
    },
    peek: () => pending,
    put(tap) {
      pending = tap;
      notify();
    },
    drop() {
      if (pending === null) return;
      pending = null;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
