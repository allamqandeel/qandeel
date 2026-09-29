/**
 * W3-01 — how the visual layer consumes the ONE appearance authority.
 *
 *   - `AppearanceProvider` publishes the authority to the tree; `useAppearance()` reads its state.
 *   - `useSurfaceAppearance()` is the appearance a surface PAINTS in: the effective appearance, or DARK inside
 *     `AnalysisAppearanceScope`. That scope is how P1 §12.2 is kept by construction: the Analysis / Living
 *     Analysis place is dark under Dark, Light and System, and no preference can reach it — it is not a
 *     decision any Analysis component makes, and it is never a change to the authority's state.
 *   - `AppearanceStatusBar` is the ONE place the platform status content is chosen: light content over a dark
 *     ground, dark content over a light one (G3 K18 status-region legibility), for the surface it stands in.
 *
 * With no provider mounted (a component rendered on its own), the appearance is DARK — P1's default.
 */
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';

import { DEFAULT_APPEARANCE_PREFERENCE, type AppearanceAuthority, type AppearanceState, type EffectiveAppearance } from './appearance-authority';

const UNBOUND: AppearanceState = Object.freeze({ bound: false, preference: DEFAULT_APPEARANCE_PREFERENCE, effective: 'DARK' });
const NO_AUTHORITY = {
  getState: () => UNBOUND,
  subscribe: () => () => undefined,
};

const AuthorityContext = createContext<Pick<AppearanceAuthority, 'getState' | 'subscribe'> & Partial<AppearanceAuthority>>(NO_AUTHORITY);
/** True inside the Analysis place, where only the Dark family is ever painted. */
const AnalysisScopeContext = createContext(false);

export function AppearanceProvider({ authority, children }: { readonly authority: AppearanceAuthority; readonly children: ReactNode }) {
  return <AuthorityContext.Provider value={authority}>{children}</AuthorityContext.Provider>;
}

/** The Analysis / Living Analysis place: dark under every preference (P1 §12.2). */
export function AnalysisAppearanceScope({ children }: { readonly children: ReactNode }) {
  return <AnalysisScopeContext.Provider value>{children}</AnalysisScopeContext.Provider>;
}

/** The authority's state, observed. */
export function useAppearance(): AppearanceState {
  const authority = useContext(AuthorityContext);
  return useSyncExternalStore(authority.subscribe, authority.getState);
}

/** The reader's explicit choice, or `null` where no authority is mounted. */
export function useAppearanceChoice(): ((preference: AppearanceState['preference']) => boolean) | null {
  const authority = useContext(AuthorityContext);
  return authority.setPreference ?? null;
}

/** The appearance THIS surface paints in. */
export function useSurfaceAppearance(): EffectiveAppearance {
  const analysis = useContext(AnalysisScopeContext);
  const { effective } = useAppearance();
  return analysis ? 'DARK' : effective;
}

export function statusBarStyleFor(appearance: EffectiveAppearance): 'light' | 'dark' {
  return appearance === 'DARK' ? 'light' : 'dark';
}

/** The platform status content, legible over the ground of the surface it stands in. */
export function AppearanceStatusBar() {
  return <StatusBar style={statusBarStyleFor(useSurfaceAppearance())} />;
}
