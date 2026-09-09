/**
 * T-12P §2.7 — the one foreground signal for the runtime-entry layer.
 *
 * The contract requires that the live driver run only while the app is foreground/active, and stop
 * on backgrounding. Nothing in this repository observed app lifecycle before now: there is no
 * `AppState`, `useFocusEffect` or `InteractionManager` use anywhere under `apps/`. So this is the
 * first such observer, and it is deliberately ONE observer shared by both consumers that need it —
 * the Supabase token auto-refresh loop and the catch-up driver — rather than two subscriptions
 * racing each other to the same platform event.
 *
 * `active` is the only foreground state. iOS reports `inactive` while the app is transitioning or
 * behind a system sheet; treating that as not-foreground is the conservative reading and is what
 * "stops on backgrounding" should mean for a poller.
 *
 * The seam is injectable so every lifecycle rule can be proven without a device: the tests drive a
 * manual signal, and production binds the real `AppState`.
 */
import { AppState, type AppStateStatus } from 'react-native';

export type ForegroundState = 'ACTIVE' | 'INACTIVE';

export interface ForegroundSignal {
  /** The state right now. */
  current(): ForegroundState;
  /** Observe transitions. Returns an idempotent unsubscribe. */
  subscribe(listener: (state: ForegroundState) => void): () => void;
}

function toForegroundState(status: AppStateStatus): ForegroundState {
  return status === 'active' ? 'ACTIVE' : 'INACTIVE';
}

/** The production signal, backed by React Native's `AppState`. */
export function createAppStateForegroundSignal(): ForegroundSignal {
  return {
    current: () => toForegroundState(AppState.currentState),
    subscribe: (listener) => {
      const subscription = AppState.addEventListener('change', (status) => {
        listener(toForegroundState(status));
      });
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        subscription.remove();
      };
    },
  };
}

export interface ManualForegroundSignal extends ForegroundSignal {
  /** Drive a transition. Listeners are notified only when the state actually changes. */
  set(state: ForegroundState): void;
}

/**
 * A directly driven signal. Used by the focused tests, and by any host that already knows its own
 * foreground state and should not install a second platform listener.
 */
export function createManualForegroundSignal(initial: ForegroundState = 'ACTIVE'): ManualForegroundSignal {
  let state = initial;
  const listeners = new Set<(next: ForegroundState) => void>();
  return {
    current: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        listeners.delete(listener);
      };
    },
    set: (next) => {
      if (next === state) return;
      state = next;
      // Snapshot: a listener that unsubscribes during notification must not reindex the iteration.
      for (const listener of Array.from(listeners)) listener(next);
    },
  };
}
