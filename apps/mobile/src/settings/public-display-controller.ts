/**
 * S5-01 (E2E-H-08) — the reader's Public display choice, inside General Settings → Account & Identity (P1 §6, §8.1).
 *
 * The reader chooses a MODE and nothing else: «المعرّف العام» / Public ID (PSEUDONYM — the account's CURRENT Public ID)
 * or «الاسم» / Name (REAL_NAME — the account's CURRENT Name). What the Public World renders is the server's derived
 * answer, read again every time the row is drawn, so a Public ID or Name change can never leave a stale label here.
 * Nothing is optimistic: the choice shows as made only once the server answers it; a lost answer is reconciled by
 * reading the canonical state again, never guessed. The Public ID and the Name themselves are never touched.
 */
import type { PublicDisplay, PublicDisplayMode, PublicDisplayResult, PublicSetDisplayResult } from '../runtime-entry';

export interface PublicDisplayTransport {
  readDisplay(): Promise<PublicDisplayResult>;
  setDisplay(mode: PublicDisplayMode): Promise<PublicSetDisplayResult>;
}

export interface PublicDisplayState {
  readonly status: 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE';
  readonly display: PublicDisplay | null;
  /** The mode being chosen now, if any. */
  readonly busy: PublicDisplayMode | null;
  /** The last choice did not go through (or it is unknown whether it did after re-reading). */
  readonly failed: boolean;
}

export interface PublicDisplayController {
  getState(): PublicDisplayState;
  subscribe(listener: () => void): () => void;
  load(): void;
  choose(mode: PublicDisplayMode): void;
  retire(): void;
}

const INITIAL: PublicDisplayState = Object.freeze<PublicDisplayState>({ status: 'IDLE', display: null, busy: null, failed: false });

export function createPublicDisplayController({ transport, isCurrent }: {
  readonly transport: PublicDisplayTransport;
  readonly isCurrent: () => boolean;
}): PublicDisplayController {
  const listeners = new Set<() => void>();
  let state: PublicDisplayState = INITIAL;
  let retired = false;
  let read = 0;
  const publish = (next: PublicDisplayState) => {
    if (retired || !isCurrent()) return;
    state = next;
    for (const listener of Array.from(listeners)) listener();
  };

  async function reread(failed: boolean): Promise<void> {
    const ticket = ++read;
    const result = await transport.readDisplay();
    if (ticket !== read) return;
    publish(result.kind === 'READ'
      ? { status: 'READY', display: result.display, busy: null, failed }
      : { ...state, status: state.display === null ? 'UNAVAILABLE' : 'READY', busy: null, failed });
  }

  async function choose(mode: PublicDisplayMode): Promise<void> {
    if (state.busy !== null || state.display === null || state.display.mode === mode) return;
    if (mode === 'REAL_NAME' && !state.display.realNameAvailable) return;
    read += 1;
    publish({ ...state, busy: mode, failed: false });
    const result = await transport.setDisplay(mode);
    if (result.kind === 'UPDATED' || result.kind === 'UNCHANGED') {
      publish({ status: 'READY', display: { ...state.display, mode: result.mode, label: result.label }, busy: null, failed: false });
      return;
    }
    // NOT_AVAILABLE (no Name) or no answer: the canonical state decides what is shown.
    await reread(result.kind === 'UNAVAILABLE');
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load() {
      if (state.busy !== null) return;
      if (state.display === null) publish({ ...state, status: 'LOADING' });
      void reread(false);
    },
    choose(mode) {
      void choose(mode);
    },
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
