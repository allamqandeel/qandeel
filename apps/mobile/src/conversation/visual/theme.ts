/**
 * W1A-01 — the Conversation surface's resolved visual language.
 *
 * Every value comes from `canonical-visual.generated.ts`, which is resolved from the frozen token
 * tree, P2 geometry, E3 type roles and F2 motion. Nothing here is a literal colour, size or weight
 * of its own. Appearance: Dark only in W1A — P1 makes Dark the default for non-Analysis surfaces and
 * no appearance preference exists yet. Contrast: the platform's increased-contrast setting selects
 * the F1 increased resolution, which changes the rest ink and the focus thickness only.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { CANONICAL_VISUAL } from './canonical-visual.generated';

export type ConversationPalette = (typeof CANONICAL_VISUAL.palette)['standard'] | (typeof CANONICAL_VISUAL.palette)['increased'];

/** The two static Estedad v8.5 instances the surface ships, by PostScript name (= file name). */
export const TYPEFACE = Object.freeze({ regular: 'Estedad-Regular', medium: 'Estedad-Medium' });

export type TypeRole = keyof typeof CANONICAL_VISUAL.type | keyof typeof CANONICAL_VISUAL.display;

/**
 * One E3 role as a React Native text style.
 *
 * The weight is carried by the FACE, never by `fontWeight`: a static instance already is its weight,
 * and asking a platform to embolden a named face again either does nothing or synthesizes a fake
 * bold. `letterSpacing` is never set, so Arabic stays connected, and the leading is E3's own.
 */
export function typeStyle(role: TypeRole): { fontFamily: string; fontSize: number; lineHeight: number; includeFontPadding: false } {
  // W1B-01: the E3 display role (`statement`) sits beside the running-text roles.
  const spec = role === 'statement' ? CANONICAL_VISUAL.display.statement : CANONICAL_VISUAL.type[role];
  return {
    fontFamily: spec.weight === 500 ? TYPEFACE.medium : TYPEFACE.regular,
    fontSize: spec.size,
    lineHeight: spec.leading,
    includeFontPadding: false,
  };
}

/** `#rrggbb` + alpha as `rgba()`, for the one translucent value the surface paints: pressed presence. */
export function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Whether the reader asked the platform for increased contrast. Read, and re-read on change. */
export function useIncreasedContrast(): boolean {
  const [increased, setIncreased] = useState(false);
  useEffect(() => {
    let active = true;
    const read = Platform.OS === 'ios' ? AccessibilityInfo.isDarkerSystemColorsEnabled : AccessibilityInfo.isHighTextContrastEnabled;
    if (typeof read === 'function') {
      read.call(AccessibilityInfo).then(
        (value) => { if (active) setIncreased(value === true); },
        () => undefined,
      );
    }
    const event = Platform.OS === 'ios' ? 'darkerSystemColorsChanged' : 'highTextContrastChanged';
    const subscription = AccessibilityInfo.addEventListener(event, (value: boolean) => setIncreased(value === true));
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);
  return increased;
}

export function usePalette(): ConversationPalette {
  return useIncreasedContrast() ? CANONICAL_VISUAL.palette.increased : CANONICAL_VISUAL.palette.standard;
}
