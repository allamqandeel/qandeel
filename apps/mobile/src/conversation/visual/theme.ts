/**
 * W1A-01 — the Conversation surface's resolved visual language.
 *
 * Every value comes from `canonical-visual.generated.ts`, which is resolved from the frozen token
 * tree, P2 geometry, E3 type roles and F2 motion. Nothing here is a literal colour, size or weight
 * of its own. Appearance (W3-01): the canonical family of the appearance THIS surface paints in — the
 * reader's effective Dark / Light from the ONE appearance authority, or Dark inside the Analysis scope
 * (P1 §12). Contrast: the platform's increased-contrast setting selects the F1 increased resolution of
 * that family, which changes the rest ink and the focus thickness only.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { useSurfaceAppearance } from '../../appearance';
import { CANONICAL_VISUAL } from './canonical-visual.generated';

type Palettes = typeof CANONICAL_VISUAL.palettes;
export type ConversationPalette = Palettes[keyof Palettes]['standard'] | Palettes[keyof Palettes]['increased'];

/** The two static Estedad v8.5 instances the surface ships, by PostScript name (= file name). */
export const TYPEFACE = Object.freeze({ regular: 'Estedad-Regular', medium: 'Estedad-Medium' });

export type TypeRole = keyof typeof CANONICAL_VISUAL.type | keyof typeof CANONICAL_VISUAL.display | 'section';

/**
 * UI-POLISH-01 (Product Owner, 2026-11-16) — the app-wide type refinement, the ONE product-side layer over the frozen E3
 * roles. The frozen E3 source and the generated table stay as recorded; every role is read only through `typeStyle`, and
 * the faces (Regular / Medium) are E3's own.
 *
 * - First direction ("a refined, cohesive typography scale ... not simply smaller text"): the display role every title is
 *   drawn with goes from E3's 32 / 50 to 26 / 41.
 * - Final direction ("App-Wide Typography & Premium UI Refinement": ordinary text, conversations and replies were still
 *   oversized and vertically spacious). The running-text roles move to the Material 3 sizes: Body Large 16, Body Medium and
 *   Label Large 14, Body Small 12.
 *
 * Their leadings are Arabic-first, not Latin-first. Estedad v8.5's own line box is 1.525 em (Regular) and 1.54 em (Medium),
 * and its tallest ink, stacked marks included, spans 1.45 em. Every leading therefore stays at or above 1.5 em, where
 * Material's Latin 24 / 20 / 16 would clip or crowd Arabic.
 *
 * | Role       | E3      | Refined |
 * |------------|---------|---------|
 * | body       | 17 / 30 | 16 / 26 |
 * | supporting | 15 / 25 | 14 / 22 |
 * | action     | 14 / 23 | 14 / 22 |
 * | metadata   | 12 / 20 | 12 / 18 |
 *
 * Font scaling is untouched: no `allowFontScaling` / `maxFontSizeMultiplier` is set. Touch targets are carried by the
 * controls' own minimum sizes, never by these leadings.
 *
 * `section` (closure pass, Product Owner 2026-11-16; a controlled amendment recorded in the W1A-01 record §13) is the one
 * role ADDED beside E3's. It is the heading of a section inside a secondary surface, where the 26 / 41 title is too
 * large; its first use is «النقاش» / Discussion in the Public Detail Sheet. It is 20 / 32 in E3's display weight (Medium).
 * The 32 is the F1R2 REV-05 production threshold (1.6) for `text.arabic-must-not-clip`, met without a measured
 * exception; Estedad Medium's own line box at 20 is 30.8 and its tallest ink 29.
 */
const STATEMENT = Object.freeze({ ...CANONICAL_VISUAL.display.statement, size: 26, leading: 41 });
const SECTION = Object.freeze({ ...CANONICAL_VISUAL.display.statement, size: 20, leading: 32 });
const RUNNING = Object.freeze({
  body: Object.freeze({ ...CANONICAL_VISUAL.type.body, size: 16, leading: 26 }),
  supporting: Object.freeze({ ...CANONICAL_VISUAL.type.supporting, size: 14, leading: 22 }),
  action: Object.freeze({ ...CANONICAL_VISUAL.type.action, size: 14, leading: 22 }),
  metadata: Object.freeze({ ...CANONICAL_VISUAL.type.metadata, size: 12, leading: 18 }),
});

/**
 * One E3 role as a React Native text style.
 *
 * The weight is carried by the FACE, never by `fontWeight`: a static instance already is its weight,
 * and asking a platform to embolden a named face again either does nothing or synthesizes a fake
 * bold. `letterSpacing` is never set, so Arabic stays connected, and the leading is the refined one above.
 */
export function typeStyle(role: TypeRole): { fontFamily: string; fontSize: number; lineHeight: number; includeFontPadding: false } {
  // W1B-01: the E3 display role (`statement`) sits beside the running-text roles.
  const spec = role === 'statement' ? STATEMENT : role === 'section' ? SECTION : RUNNING[role];
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
  const family = CANONICAL_VISUAL.palettes[useSurfaceAppearance()];
  return useIncreasedContrast() ? family.increased : family.standard;
}
