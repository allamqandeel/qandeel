/**
 * A3-01 — the reader's Notifications & Activity preferences, for ONE runtime generation (P3 §12–§13; I-08N-01 D33–D37).
 *
 * Read when the page is shown; changed one act at a time. Every change is the whole preference set the reader now sees,
 * and the SERVER's answer is what the page shows afterwards — never an optimistic guess left standing. A change the
 * server did not confirm leaves the last confirmed state in place and says so once. Snooze is its own act, measured on
 * the server's clock. Nothing here can turn critical security off: no such preference exists (D36).
 */
import type { ActivityPreferences, ActivityPreferencesInput, ActivityPreferencesOutcome } from '../runtime-entry';

export interface PreferencesTransport {
  readPreferences(): Promise<ActivityPreferencesOutcome>;
  savePreferences(input: ActivityPreferencesInput): Promise<ActivityPreferencesOutcome>;
  setSnooze(minutes: number | null): Promise<ActivityPreferencesOutcome>;
}

export interface PreferencesState {
  readonly status: 'LOADING' | 'READY' | 'UNAVAILABLE';
  readonly preferences: ActivityPreferences | null;
  readonly saving: boolean;
  /** The last change was not confirmed (the confirmed state is still shown). */
  readonly failed: boolean;
}

export interface ActivityPreferencesController {
  getState(): PreferencesState;
  subscribe(listener: () => void): () => void;
  start(): void;
  /** Apply one change to the confirmed preferences and save the whole set. */
  change(apply: (current: ActivityPreferencesInput) => ActivityPreferencesInput): Promise<boolean>;
  snooze(minutes: number | null): Promise<boolean>;
  retire(): void;
}

const LOADING: PreferencesState = Object.freeze({ status: 'LOADING', preferences: null, saving: false, failed: false });

export const toInput = (p: ActivityPreferences): ActivityPreferencesInput => ({
  proactive: p.proactive, shared: p.shared, public: p.public, introductions: { alerts: p.introductions.alerts },
  account: p.account, quietHours: p.quietHours, lockScreen: p.lockScreen,
});

export function createActivityPreferencesController(options: { readonly transport: PreferencesTransport; readonly isCurrent: () => boolean }): ActivityPreferencesController {
  const listeners = new Set<() => void>();
  let state: PreferencesState = LOADING;
  let retired = false;
  let busy = false;
  const live = () => !retired && options.isCurrent();
  const publish = (next: PreferencesState) => {
    state = next;
    for (const listener of Array.from(listeners)) listener();
  };

  async function act(send: () => Promise<ActivityPreferencesOutcome>): Promise<boolean> {
    if (!live() || busy || state.status !== 'READY') return false;
    busy = true;
    publish({ ...state, saving: true, failed: false });
    const outcome = await send();
    busy = false;
    if (!live()) return false;
    if (outcome.kind === 'READ') {
      publish({ status: 'READY', preferences: outcome.preferences, saving: false, failed: false });
      return true;
    }
    publish({ ...state, saving: false, failed: true });
    return false;
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (!live()) return;
      if (state.status !== 'READY') publish(LOADING);
      void options.transport.readPreferences().then((outcome) => {
        if (!live()) return;
        publish(outcome.kind === 'READ' ? { status: 'READY', preferences: outcome.preferences, saving: false, failed: false } : { ...LOADING, status: 'UNAVAILABLE' });
      });
    },
    change(apply) {
      const current = state.preferences;
      if (current === null) return Promise.resolve(false);
      return act(() => options.transport.savePreferences(apply(toInput(current))));
    },
    snooze: (minutes) => act(() => options.transport.setSnooze(minutes)),
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
