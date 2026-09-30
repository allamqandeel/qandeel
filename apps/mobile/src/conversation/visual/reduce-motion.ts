/**
 * W3-MEGA-S (E2E-D-12) — the platform's Reduce Motion, honoured when it CHANGES while QANDEEL is open.
 *
 * Reanimated's `useReducedMotion` reports the setting as it was when the app started and never updates, so a reader
 * who turns Reduce Motion on mid-session kept the motion until a restart (F1R2 platform mapping §3, item 4). This
 * starts from that same launch value and then follows the platform's own `reduceMotionChanged` event. It is a reader
 * of the platform signal and nothing else: QANDEEL has no motion preference of its own (W3-PDG-01 §6).
 *
 * The value lives in ONE process-wide store, not in each component, and its one platform listener stays for the life
 * of the process: a surface mounted after a change (a new conversation surface, a new runtime generation) starts from
 * what the platform last said, not from the launch value.
 */
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/** What the platform has said since the first reader subscribed; `null` until it says anything. */
let said: boolean | null = null;
const listeners = new Set<() => void>();
let platform: { remove(): void } | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  platform ??= AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
    const next = enabled === true;
    if (said === next) return;
    said = next;
    for (const each of Array.from(listeners)) each();
  }) ?? null;
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => said;

export function useReduceMotion(): boolean {
  const atLaunch = useReducedMotion();
  return useSyncExternalStore(subscribe, snapshot, snapshot) ?? atLaunch;
}

/** Tests only: forget what the platform said and drop the platform listener. */
export function resetReduceMotionForTests(): void {
  said = null;
  platform?.remove();
  platform = null;
  listeners.clear();
}
