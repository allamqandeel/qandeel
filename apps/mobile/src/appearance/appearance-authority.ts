/**
 * W3-01 (E2E-D-10) — the ONE appearance authority. P1 §12 is the law it carries out.
 *
 * > **Dark / Light / System, a Dark default, non-Analysis surfaces follow it, and the Analysis stays dark.**
 *
 * It owns exactly two facts and nothing else:
 *
 *   - the reader's PREFERENCE — `DARK`, `LIGHT` or `SYSTEM` — for the identity currently bound;
 *   - the EFFECTIVE appearance — `DARK` or `LIGHT` — that non-Analysis surfaces paint in. `SYSTEM` is the
 *     operating system's current appearance, followed live; `DARK` and `LIGHT` ignore the operating system.
 *
 * The visual layer reads the effective appearance (through `AppearanceProvider`) and nothing reads the
 * operating system's appearance around it: this is the only consumer of the system source, so there is no
 * second, scattered `useColorScheme()` authority to disagree with it. The Analysis boundary is applied by the
 * visual layer (`AnalysisAppearanceScope`), never by changing this state — no preference repaints Analysis.
 *
 * ## Whose preference, and when nobody is signed in
 *
 * The preference is per identity on this device (`appearance-storage.ts`). `bindAccount(userId)` is called by
 * the integration runtime whenever the authenticated identity changes; `bindAccount(null)` — signed out,
 * restoring, unverifiable — is the new-user default, DARK, whatever any earlier identity chose. Identity A's
 * choice therefore never reaches identity B, and survives, keyed to A, for A's next explicit sign-in.
 *
 * ## The native appearance
 *
 * Every effective change is handed to the native sink (`native-appearance.ts`), which declares the app's own
 * night mode where the platform supports it, so a cold launch does not contradict the reader's choice
 * (Android 12+ persists it for the system splash). Product code never names a platform constant.
 *
 * Nothing here logs: a preference is the reader's, and it is not diagnostic data.
 */

export type AppearancePreference = 'DARK' | 'LIGHT' | 'SYSTEM';
export type EffectiveAppearance = 'DARK' | 'LIGHT';

/** P1 §12.1 — the new-user default, and the appearance of every surface nobody is signed in to. */
export const DEFAULT_APPEARANCE_PREFERENCE: AppearancePreference = 'DARK';

export const APPEARANCE_PREFERENCES: readonly AppearancePreference[] = Object.freeze(['DARK', 'LIGHT', 'SYSTEM']);

export function isAppearancePreference(value: unknown): value is AppearancePreference {
  return value === 'DARK' || value === 'LIGHT' || value === 'SYSTEM';
}

export interface AppearanceState {
  /** Whether an identity is bound. Signed out, the preference is the default and cannot be changed. */
  readonly bound: boolean;
  readonly preference: AppearancePreference;
  readonly effective: EffectiveAppearance;
}

/** The operating system's own appearance. Consumed here, and only here. */
export interface SystemAppearanceSource {
  current(): EffectiveAppearance;
  /** Observe the operating system's appearance changing. Returns an idempotent unsubscribe. */
  subscribe(listener: (next: EffectiveAppearance) => void): () => void;
}

/** Declares the app's native appearance. Given the PREFERENCE, so `SYSTEM` can follow the device natively. */
export interface NativeAppearanceSink {
  apply(preference: AppearancePreference): void;
}

/** Device-local, per-identity storage of the preference. Synchronous, so a bound identity never flashes. */
export interface AppearancePreferenceStore {
  read(userId: string): AppearancePreference | null;
  write(userId: string, preference: AppearancePreference): void;
}

export interface AppearanceAuthority {
  getState(): AppearanceState;
  /** Observe every state change. Returns an idempotent unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Bind the authenticated identity, or `null` when nobody is signed in (DARK, the default). */
  bindAccount(userId: string | null): void;
  /** The reader's explicit choice, for the bound identity. Refused (false) when nobody is bound. */
  setPreference(preference: AppearancePreference): boolean;
  dispose(): void;
}

export interface AppearanceAuthorityOptions {
  readonly store: AppearancePreferenceStore;
  readonly system: SystemAppearanceSource;
  readonly native: NativeAppearanceSink;
}

export function effectiveAppearanceFor(preference: AppearancePreference, system: EffectiveAppearance): EffectiveAppearance {
  return preference === 'SYSTEM' ? system : preference;
}

export function createAppearanceAuthority({ store, system, native }: AppearanceAuthorityOptions): AppearanceAuthority {
  let account: string | null = null;
  let disposed = false;
  let appliedNative: AppearancePreference | null = null;
  const listeners = new Set<() => void>();

  const compute = (preference: AppearancePreference): AppearanceState => ({
    bound: account !== null,
    preference,
    effective: effectiveAppearanceFor(preference, system.current()),
  });

  let state: AppearanceState = compute(DEFAULT_APPEARANCE_PREFERENCE);

  /** A storage that cannot answer is not a preference: the default stands, and nothing is guessed. */
  function stored(userId: string): AppearancePreference {
    try {
      const value = store.read(userId);
      return isAppearancePreference(value) ? value : DEFAULT_APPEARANCE_PREFERENCE;
    } catch {
      return DEFAULT_APPEARANCE_PREFERENCE;
    }
  }

  function applyNative(preference: AppearancePreference): void {
    if (appliedNative === preference) return;
    appliedNative = preference;
    try {
      native.apply(preference);
    } catch {
      // The native declaration is the platform's echo of the choice; the app's own surfaces are already right.
    }
  }

  /**
   * The native declaration comes FIRST: an explicit Dark or Light is an app-level override of the platform
   * appearance, so the operating system's own value is only readable again once `SYSTEM` has released it.
   * If the platform reports the release a moment later, the system subscription below corrects the value.
   */
  function publish(preference: AppearancePreference): void {
    applyNative(preference);
    const next = compute(preference);
    const changed = next.bound !== state.bound || next.preference !== state.preference || next.effective !== state.effective;
    state = next;
    if (!changed) return;
    for (const listener of Array.from(listeners)) listener();
  }

  // Only `SYSTEM` listens to the operating system; an explicit Dark or Light ignores it entirely.
  const unsubscribeSystem = system.subscribe(() => {
    if (disposed || state.preference !== 'SYSTEM') return;
    publish('SYSTEM');
  });

  // Deliberately NO native declaration here. Until the auth owner settles who (if anyone) is signed in, the
  // platform keeps the appearance it persisted at the last run — the reader's own — so a cold launch never
  // flips a Light reader's window Dark while their session is restored. The first bind declares it.

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        listeners.delete(listener);
      };
    },
    bindAccount(userId) {
      if (disposed) return;
      const next = typeof userId === 'string' && userId.length > 0 ? userId : null;
      // The same identity again (a token refresh) changes nothing; the first bind always declares.
      if (next === account && appliedNative !== null) return;
      account = next;
      publish(account === null ? DEFAULT_APPEARANCE_PREFERENCE : stored(account));
    },
    setPreference(preference) {
      if (disposed || account === null || !isAppearancePreference(preference)) return false;
      try {
        store.write(account, preference);
      } catch {
        // The choice still holds for this session; it simply could not be kept for the next one.
      }
      publish(preference);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribeSystem();
      listeners.clear();
    },
  };
}
