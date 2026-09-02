import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { View } from 'react-native';

import type { Rect } from './geometry';

/**
 * Positions for the Skia overlay are taken with `measureLayout` against the surface node,
 * not by composing `onLayout` rects down the tree.
 *
 * `onLayout` reports a rect relative to whatever the platform considers the parent, and
 * on react-native-web that is not the flex parent: every nested word view comes back at
 * `x: 0`. Composed together those zeros collapse a whole span onto one point, and the
 * threads drawn from them degenerate into a single horizontal line — visible, plausible,
 * and completely wrong. `measureLayout` answers the question actually being asked: where
 * is this node inside the surface.
 *
 * `epoch` exists because `onLayout` does not fire when an ancestor moves. Anything that
 * can shift the surface — a new beat, a language flip, a resize — bumps it, and every
 * measured node re-measures.
 */
interface SurfaceMeasureValue {
  surfaceRef: RefObject<View | null>;
  report: (id: string, rect: Rect) => void;
  epoch: number;
}

const SurfaceMeasureContext = createContext<SurfaceMeasureValue | null>(null);

export function SurfaceMeasureProvider({
  value,
  children,
}: {
  value: SurfaceMeasureValue;
  children: ReactNode;
}) {
  return (
    <SurfaceMeasureContext.Provider value={value}>{children}</SurfaceMeasureContext.Provider>
  );
}

export function useSurfaceMeasure(id: string): {
  ref: RefObject<View | null>;
  onLayout: () => void;
} {
  const context = useContext(SurfaceMeasureContext);
  if (!context) throw new Error('useSurfaceMeasure must be used inside <SurfaceMeasureProvider>');

  const { surfaceRef, report, epoch } = context;
  const ref = useRef<View | null>(null);

  const measure = useCallback(() => {
    const node = ref.current;
    const surface = surfaceRef.current;
    if (!node || !surface || typeof node.measureLayout !== 'function') return;
    node.measureLayout(
      surface,
      (x: number, y: number, width: number, height: number) => {
        report(id, { x, y, width, height });
      },
      () => {
        /* the node went away between layout and measure; the next epoch will retry */
      }
    );
  }, [id, report, surfaceRef]);

  useEffect(() => {
    measure();
  }, [measure, epoch]);

  return { ref, onLayout: measure };
}
