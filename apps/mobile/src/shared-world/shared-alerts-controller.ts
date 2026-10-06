/**
 * S4-04 — the per-World Shared mute rows of General Settings → «الإشعارات والنشاط» / Notifications & Activity
 * (I-08N-01 D34; P3 §12.2), for ONE runtime generation.
 *
 * The rows are the reader's CURRENT Worlds, read from the Shared domain's own safe boundary when the page is shown — no
 * ended, former or hidden World, no count. Each row mutes or unmutes exactly ONE World; the SERVER's answer is what the
 * page shows afterwards, never an optimistic guess left standing (the A3-01 preferences pattern). A World that stopped
 * being the reader's between the read and the act simply leaves the list. Muting changes notification and attention
 * presentation only — never membership, conversation, QANDEEL's understanding or Shared authority — and the global
 * Shared World alerts control stays Activity's own.
 */
import type { SharedAlertsResult, SharedSetAlertsResult, SharedWorldAlert } from '../runtime-entry';

export interface SharedAlertsTransport {
  alerts(): Promise<SharedAlertsResult>;
  setAlerts(worldId: string, muted: boolean): Promise<SharedSetAlertsResult>;
}

export interface SharedAlertsState {
  readonly status: 'LOADING' | 'READY' | 'UNAVAILABLE';
  readonly worlds: readonly SharedWorldAlert[];
  /** The World whose change is in flight, if any: one act at a time. */
  readonly busy: string | null;
  /** The last change was not confirmed (the confirmed state is still shown). */
  readonly failed: boolean;
}

export interface SharedAlertsController {
  getState(): SharedAlertsState;
  subscribe(listener: () => void): () => void;
  /** The page is shown: read the reader's current Worlds again. */
  start(): void;
  /** Mute / unmute ONE World. Resolves true once the server confirmed it. */
  setMuted(worldId: string, muted: boolean): Promise<boolean>;
  retire(): void;
}

const LOADING: SharedAlertsState = Object.freeze({ status: 'LOADING', worlds: [], busy: null, failed: false });

export function createSharedAlertsController(options: { readonly transport: SharedAlertsTransport; readonly isCurrent: () => boolean }): SharedAlertsController {
  const listeners = new Set<() => void>();
  let state: SharedAlertsState = LOADING;
  let retired = false;
  let read = 0;
  const live = () => !retired && options.isCurrent();
  const publish = (next: SharedAlertsState) => {
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
        // No longer one of the reader's Worlds: it leaves the list, and nothing about why is said.
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
