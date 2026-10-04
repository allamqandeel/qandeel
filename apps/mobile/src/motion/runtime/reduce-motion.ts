/**
 * The ONE reader of the platform's Reduce Motion setting, honoured when it CHANGES while QANDEEL is open.
 *
 * W3-MEGA-S (E2E-D-12) introduced this reader for the W1A / W3 surfaces. VPORT-02 (`QAN-BL-A11Y-01`) moved it here,
 * into the T-10 motion owner, unchanged in behaviour, so the presentation camera and the temporal motion binding read
 * the same live signal instead of Reanimated's launch-only `useReducedMotion()`. There is still exactly one store and
 * one platform listener; `conversation/visual/reduce-motion.ts` re-exports this module rather than keeping a second.
 *
 * Reanimated's `useReducedMotion` reports the setting as it was when the app started and never updates, so a reader
 * who turned Reduce Motion on mid-session kept the motion until a restart (F1R2 platform mapping §3, item 4). This
 * starts from that same launch value and then follows the platform's own `reduceMotionChanged` event. It is a reader
 * of the platform signal and nothing else: QANDEEL has no motion preference of its own (W3-PDG-01 §6).
 *
 * The value lives in ONE process-wide store, not in each component, and its one platform listener stays for the life
 * of the process: a surface mounted after a change (a new conversation surface, a new runtime generation, a remounted
 * Map) starts from what the platform last said, not from the launch value.
 */
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/** What the platform has said since the first reader started following it; `null` until it says anything. */
let said: boolean | null = null;
const listeners = new Set<() => void>();
let platform: { remove(): void } | null = null;

function follow(listener: () => void): () => void {
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

/** Whether the platform asks for reduced motion RIGHT NOW: the launch value until the platform says otherwise. */
export function useReduceMotion(): boolean {
  const atLaunch = useReducedMotion();
  return useSyncExternalStore(follow, snapshot, snapshot) ?? atLaunch;
}

/** Tests only: how many readers currently follow the one platform listener. */
export function reduceMotionReadersForTests(): number {
  return listeners.size;
}

/** Tests only: forget what the platform said and drop the platform listener. */
export function resetReduceMotionForTests(): void {
  said = null;
  platform?.remove();
  platform = null;
  listeners.clear();
}
