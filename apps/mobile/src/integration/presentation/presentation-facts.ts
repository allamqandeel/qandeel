/**
 * T-12 §12 — the app-root presentation facts T-11 deliberately left unmounted.
 *
 * T-11 built the room and the seams; it reads no platform dimension, no device, no screen and no
 * window, and it says so explicitly — the provider that knows the insets lives at the app root, and
 * the app root is this task's. These are those two seams, bound to the platform for the first time.
 *
 * ## Both are presentation, and the boundary is absolute
 *
 * A safe-area inset changes usable layout and padding. A font scale changes how large the reader's
 * text is. NEITHER changes a Product truth: not the Session, not `TM`, not `TC`, not `LH`, not `LF`,
 * not `IF_ref`, not the canonical camera, not the reversible history, not what is disclosed, and not
 * which acts are available. A device rotated into a notch and a reader at 200 % text are looking at
 * the same world from the same viewpoint as everyone else.
 *
 * ## Why `useWindowDimensions().fontScale`
 *
 * It is the supported React Native mechanism that is also REACTIVE: `PixelRatio.getFontScale()` is a
 * one-shot read, so a reader who changes their text size while the app is open would keep the layout
 * of the size they started with until something else happened to re-render. Dynamic Type is a setting
 * people change *because* they are having trouble reading right now, so a layout that waits for an
 * unrelated event is the wrong answer.
 *
 * T-11 clamps the value it is given at `MAX_TRACKED_FONT_SCALE` and refuses a non-finite or
 * non-positive one, so nothing is normalized here: passing the platform's own number through
 * unaltered is what keeps one validity rule instead of two.
 */

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ResponsiveInsets } from '../../responsive';

export interface PresentationFacts {
  /** Real safe-area insets, in points. Presentation only. */
  readonly insets: ResponsiveInsets;
  /** The reader's real text-size multiplier, exactly as the platform reports it. */
  readonly fontScale: number;
  /**
   * The envelope the composed world is presented inside, in points.
   *
   * T-11 measures its own container and must not read a display, so the app root reads it here and
   * hands it down as a seam — the same shape of arrangement the insets and the font scale already
   * use. It exists so a measurement taken inside a previous envelope cannot survive into a new one.
   */
  readonly envelope: { readonly width: number; readonly height: number };
}

/**
 * The two facts, read from the platform.
 *
 * `useSafeAreaInsets` requires the provider mounted above it; the Product root mounts it. The insets
 * object it returns is already stable between changes, so it is passed through rather than copied —
 * a fresh object every render would defeat T-11's memoization and re-derive the whole plan on every
 * pass.
 */
export function usePresentationFacts(): PresentationFacts {
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  // Memoized on its own numbers so an unchanged envelope hands down an unchanged object and nothing
  // downstream re-derives a plan that did not move.
  const envelope = useMemo(() => ({ width, height }), [width, height]);
  return { insets, fontScale, envelope };
}
