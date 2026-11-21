/**
 * COSMOS E-2 corrections, Slice C (the Product Owner's D-5, Option U, 2026-11-20) — the person's CURRENT Personal World
 * for THIS identity, read through the transport bound to it and HELD only for presentation: the server is the authority
 * and every refresh replaces the whole world. Nothing here writes the T-02 kernel, dispatches a Product action, moves the
 * Session-bound camera or touches the timeline: the current world is a separate mode of the Personal map, beside the
 * Session-bound one. Retired with the generation like everything else bound to it.
 */
import type { CurrentPersonalThread, CurrentPersonalWorld } from '@qandeel/runtime';

import type { CurrentPersonalWorldApiClient } from '../runtime-entry';

export type CurrentPersonalWorldStatus = 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE';

export interface CurrentPersonalWorldState {
  readonly status: CurrentPersonalWorldStatus;
  /** The world as last served; empty until READY. */
  readonly threads: readonly CurrentPersonalThread[];
  /** The instant of the last successful read, or null. The present, never a Session Position. */
  readonly asOf: string | null;
}

export interface CurrentPersonalWorldController {
  getState(): CurrentPersonalWorldState;
  subscribe(listener: () => void): () => void;
  /** Read (again). Idempotent while a read is on its way; a READY world stays shown until the new one lands. */
  refresh(): void;
  /** One Thread of the held world, by id, or null. */
  thread(id: string): CurrentPersonalThread | null;
  retire(): void;
}

export interface CurrentPersonalWorldControllerOptions {
  readonly transport: Pick<CurrentPersonalWorldApiClient, 'read'>;
  readonly isCurrent: () => boolean;
}

const EMPTY: CurrentPersonalWorldState = Object.freeze({ status: 'IDLE', threads: [], asOf: null });

export function createCurrentPersonalWorldController(options: CurrentPersonalWorldControllerOptions): CurrentPersonalWorldController {
  const listeners = new Set<() => void>();
  let state: CurrentPersonalWorldState = EMPTY;
  let retired = false;
  let reading = false;
  const live = () => !retired && options.isCurrent();
  const set = (next: Partial<CurrentPersonalWorldState>) => {
    if (!live()) return;
    state = Object.freeze({ ...state, ...next });
    for (const listener of Array.from(listeners)) listener();
  };
  const held = (world: CurrentPersonalWorld) => set({ status: 'READY', threads: world.threads, asOf: world.asOf });

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh() {
      if (!live() || reading) return;
      reading = true;
      set({ status: state.status === 'READY' ? 'READY' : 'LOADING' });
      void options.transport.read().then((outcome) => {
        reading = false;
        if (!live()) return;
        if (outcome.kind === 'READ') held(outcome.world);
        else set({ status: 'UNAVAILABLE' });
      }, () => {
        reading = false;
        set({ status: 'UNAVAILABLE' });
      });
    },
    thread: (id) => state.threads.find((thread) => thread.id === id) ?? null,
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
