/**
 * W3-01 — the appearance layer: ONE authority for Dark / Light / System (P1 §12), its device-local
 * per-identity store, its platform edges, and how the visual layer consumes it.
 */
export {
  APPEARANCE_PREFERENCES,
  DEFAULT_APPEARANCE_PREFERENCE,
  createAppearanceAuthority,
  effectiveAppearanceFor,
  isAppearancePreference,
  type AppearanceAuthority,
  type AppearanceAuthorityOptions,
  type AppearancePreference,
  type AppearancePreferenceStore,
  type AppearanceState,
  type EffectiveAppearance,
  type NativeAppearanceSink,
  type SystemAppearanceSource,
} from './appearance-authority';
export {
  APPEARANCE_DATABASE_NAME,
  APPEARANCE_KEY_PREFIX,
  appearanceKeyFor,
  createAppearancePreferenceStore,
  createEphemeralAppearancePreferenceStore,
} from './appearance-storage';
export { createNativeAppearanceSink, createSystemAppearanceSource } from './native-appearance';
export {
  AnalysisAppearanceScope,
  AppearanceProvider,
  AppearanceStatusBar,
  statusBarStyleFor,
  useAppearance,
  useAppearanceChoice,
  useSurfaceAppearance,
} from './AppearanceProvider';
