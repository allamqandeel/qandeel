/**
 * S6-07 (CP3) — the per-Introduction mute rows of General Settings → «الإشعارات والنشاط» / Notifications & Activity
 * (I-08N-01 D34; P3 §12.2), for ONE runtime generation. The S4-04 Shared rows' law, for Introduction Worlds:
 *
 * The rows are the reader's own Introduction Worlds, read from the server when the page is shown — nobody else's World,
 * no count. Each row mutes or unmutes exactly ONE Introduction; the SERVER's answer is what the page shows afterwards,
 * never an optimistic guess left standing. A World that stopped being the reader's between the read and the act simply
 * leaves the list. Muting changes notification and attention presentation only — never the Introduction itself — and the
 * global Introductions alerts control stays Activity's own.
 */
import type { IntroductionAlertsResult, IntroductionSetAlertsResult, IntroductionWorldAlert } from '../runtime-entry';

export interface IntroductionAlertsTransport {
  alerts(): Promise<IntroductionAlertsResult>;
  setAlerts(worldId: string, muted: boolean): Promise<IntroductionSetAlertsResult>;
}

export interface IntroductionAlertsState {
  readonly status: 'LOADING' | 'READY' | 'UNAVAILABLE';
  readonly worlds: readonly IntroductionWorldAlert[];
  /** The World whose change is in flight, if any: one act at a time. */
  readonly busy: string | null;
  /** The last change was not confirmed (the confirmed state is still shown). */
  readonly failed: boolean;
}

export interface IntroductionAlertsController {
  getState(): IntroductionAlertsState;
  subscribe(listener: () => void): () => void;
  /** The page is shown: read the reader's own Introduction Worlds again. */
  start(): void;
  /** Mute / unmute ONE Introduction. Resolves true once the server confirmed it. */
  setMuted(worldId: string, muted: boolean): Promise<boolean>;
  retire(): void;
}

const LOADING: IntroductionAlertsState = Object.freeze({ status: 'LOADING', worlds: [], busy: null, failed: false });

export function createIntroductionAlertsController(options: { readonly transport: IntroductionAlertsTransport; readonly isCurrent: () => boolean }): IntroductionAlertsController {
  const listeners = new Set<() => void>();
  let state: IntroductionAlertsState = LOADING;
  let retired = false;
  let read = 0;
  const live = () => !retired && options.isCurrent();
  const publish = (next: IntroductionAlertsState) => {
    if (!live()) return;
    state = next;
    for (const listener of Array.from(listeners)) listener();
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (!live()) return;
      const ticket = ++read;
      if (state.status !== 'READY') publish(LOADING);
      void options.transport.alerts().then((result) => {
        if (ticket !== read) return;
        publish(result.kind === 'READ' ? { status: 'READY', worlds: result.worlds, busy: null, failed: false } : { ...LOADING, status: 'UNAVAILABLE' });
      });
    },
    async setMuted(worldId, muted) {
      if (!live() || state.status !== 'READY' || state.busy !== null || !state.worlds.some((w) => w.worldId === worldId)) return false;
      read += 1; // a read in flight no longer answers the page
      publish({ ...state, busy: worldId, failed: false });
      const result = await options.transport.setAlerts(worldId, muted);
      if (result.kind === 'MUTED' || result.kind === 'UNMUTED') {
        const confirmed = result.kind === 'MUTED';
        publish({ ...state, busy: null, worlds: state.worlds.map((w) => (w.worldId === worldId ? { ...w, muted: confirmed } : w)) });
        return true;
      }
      if (result.kind === 'NOT_A_WORLD') {
        // No longer one of the reader's Introductions: it leaves the list, and nothing about why is said.
        publish({ ...state, busy: null, worlds: state.worlds.filter((w) => w.worldId !== worldId) });
        return false;
      }
      publish({ ...state, busy: null, failed: true });
      return false;
    },
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
