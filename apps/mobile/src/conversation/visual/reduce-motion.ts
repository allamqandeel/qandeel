/**
 * W3-MEGA-S (E2E-D-12) — the platform's Reduce Motion, honoured when it CHANGES while QANDEEL is open.
 *
 * Reanimated's `useReducedMotion` reports the setting as it was when the app started and never updates, so a reader
 * who turns Reduce Motion on mid-session kept the motion until a restart (F1R2 platform mapping §3, item 4). This
 * starts from that same launch value and then follows the platform's own `reduceMotionChanged` event. It is a reader
 * of the platform signal and nothing else: QANDEEL has no motion preference of its own (W3-PDG-01 §6).
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export function useReduceMotion(): boolean {
  const atLaunch = useReducedMotion();
  const [changed, setChanged] = useState<boolean | null>(null);
  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => setChanged(enabled === true));
    return () => subscription?.remove();
  }, []);
  return changed ?? atLaunch;
}
