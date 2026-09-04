/**
 * T-02 — React binding for the canonical state kernel.
 *
 * React is a subscriber only: it reads through the built-in `useSyncExternalStore` and never
 * owns or writes canonical state. This provider is not mounted in the T-01 technical shell
 * (no authoritative Session snapshot exists before T-03A2); later tasks mount it where
 * Architecture authorizes.
 */
import { createContext, useCallback, useContext, useRef, useSyncExternalStore, type ReactNode } from 'react';

import type { CanonicalState } from './classes';
import type { CanonicalStore } from './store';

const CanonicalStoreContext = createContext<CanonicalStore | null>(null);

export interface CanonicalStateProviderProps {
  readonly store: CanonicalStore;
  readonly children?: ReactNode;
}

export function CanonicalStateProvider({ store, children }: CanonicalStateProviderProps) {
  return <CanonicalStoreContext.Provider value={store}>{children}</CanonicalStoreContext.Provider>;
}

export function useCanonicalStore(): CanonicalStore {
  const store = useContext(CanonicalStoreContext);
  if (store === null) {
    throw new Error('useCanonicalStore: no CanonicalStateProvider above this component');
  }
  return store;
}

interface SelectorCache<T> {
  readonly state: CanonicalState;
  readonly selector: (state: CanonicalState) => T;
  readonly value: T;
}

/**
 * Reads a derived value. The snapshot is cached per (state, selector) pair, so an unchanged
 * store yields the same value on repeated calls, as `useSyncExternalStore` requires.
 */
export function useCanonicalSelector<T>(selector: (state: CanonicalState) => T): T {
  const store = useCanonicalStore();
  const cache = useRef<SelectorCache<T> | null>(null);
  const getSnapshot = useCallback((): T => {
    const state = store.getState();
    const cached = cache.current;
    if (cached !== null && cached.state === state && cached.selector === selector) return cached.value;
    const value = selector(state);
    cache.current = { state, selector, value };
    return value;
  }, [store, selector]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
