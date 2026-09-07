/**
 * T-10 — the Skia wrapper that resolves ONE newly disclosed object into legibility.
 *
 * It carries no colour, no radius, no shape and no lifecycle styling: the graphic language stays
 * entirely with the renderer that passes its own painted element in as a child. All this adds is
 * WHEN that element becomes fully itself, and from where.
 *
 * It has no exit path. When the object leaves the current `V` the renderer stops rendering it and
 * React unmounts this wrapper with it, in the same commit — which is why a no-longer-disclosed
 * object cannot survive for a frame no matter what any animation is doing.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { Group, vec } from '@shopify/react-native-skia';
import { Easing, ReduceMotion, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import { QANDEEL_EASE_OUT } from '../tokens';
import type { DisclosureArrivalPlan } from './arrival';

const EASE_OUT = Easing.bezier(QANDEEL_EASE_OUT[0], QANDEEL_EASE_OUT[1], QANDEEL_EASE_OUT[2], QANDEEL_EASE_OUT[3]);

export interface DisclosureArrivalProps {
  readonly plan: DisclosureArrivalPlan;
  /** The object's own centre: the local resolve scales about the object, never about the screen. */
  readonly originX: number;
  readonly originY: number;
  readonly children: React.ReactNode;
}

export function DisclosureArrival({ plan, originX, originY, children }: DisclosureArrivalProps) {
  // An arrival's recipe is decided when the object arrives, and never revised. Freezing it keeps
  // the worklets below closed over stable numbers, so a later canonical change — which moves every
  // node's position — does not rebuild one derived value per object for a resolve already at rest.
  const [entry] = useState(plan);
  // Zero when this object is arriving, so the FIRST painted frame already shows the entry state —
  // there is no commit in which it is drawn at full weight before the resolve begins.
  const progress = useSharedValue(entry.animated ? 0 : 1);
  const played = useRef(false);
  const { animated, durationMs, fromScale, fromX, fromY } = entry;

  useLayoutEffect(() => {
    if (played.current || !animated) return;
    played.current = true;
    // `Never`: this resolve IS the reduced-motion choreography when reduced motion is on — the plan
    // has already removed the movement from it — so it must not be jumped to its end.
    progress.set(withTiming(1, { duration: durationMs, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }));
  }, [animated, durationMs, progress]);

  const opacity = useDerivedValue(() => progress.get());
  const transform = useDerivedValue(() => {
    const done = progress.get();
    const remaining = 1 - done;
    return [
      { translateX: fromX * remaining },
      { translateY: fromY * remaining },
      { scale: fromScale + (1 - fromScale) * done },
    ];
  });

  // An object that is not arriving is drawn exactly as the renderer drew it before this task
  // existed: no wrapper, no group, no opacity layer, no derived value attached to anything. The
  // first painted world therefore costs nothing at all, and a still world stays still.
  if (!animated) return <>{children}</>;

  return (
    <Group opacity={opacity} transform={transform} origin={vec(originX, originY)}>
      {children}
    </Group>
  );
}
