/**
 * S4-01 — the first production Global Switcher (I-08A4 §3–§4; P4-C1 SW-3 "Keyed Seam"; P2 §5).
 *
 * Three destinations (I-08A4 §3): «قنديل» / QANDEEL (the Personal world), «العالم المشترك» / Shared World and — since
 * S5-01 — «العالم العام» / Public World, each a real area behind its own entry authority (P2 `navPublic`).
 *
 *   - form: SW-3 — the plate (the one functional surface tone), a full-width hairline seam at its top edge, and the
 *     SELECTED cell's seam thickened to the E1R marker across the whole cell, with the word's weight. Brass never
 *     carries state: the glyph and the word are the same ink at every state (C3 §6; P2 §5);
 *   - each item is the P2 navigation glyph ABOVE the destination word; the word names the control and the glyph is
 *     decorative (P2 §10). A world glyph never mirrors; the items follow the reading direction (START = Personal);
 *   - switching ≠ pushing (I-08A4 §4): choosing a destination calls `onSelect` and nothing else — no route, no Back
 *     history, no Session, no canonical write. Choosing the current destination does nothing.
 */
import { useDiagPhase } from '../cosmos/__diag__/trace';
import { Text, useWindowDimensions, View } from 'react-native';

import { Control, typeStyle, usePalette } from '../conversation';
import { NavGlyph } from '../iconography';
import type { ChromeLanguage } from '../orientation-chrome';
import { publicCopy } from '../public-world/copy';
import { sharedCopy } from './copy';

export type WorldArea = 'MY_WORLD' | 'SHARED_WORLD' | 'PUBLIC_WORLD';

/** The plate's height inside the 56 pt the P2-A / P4-C proofs give the switcher. */
export const GLOBAL_SWITCHER_HEIGHT = 56;
/** The glyph (24) and a little air: the cell stacks the glyph and the word's one line, centred, with no gap of its own. */
const GLYPH_AND_AIR = 24 + 4;
/** The action role's leading (theme.ts: 14 / 22), which the platform scales with the reader's text size. */
const WORD_LEADING = 22;
/**
 * COSMOS-INT-01 Slice E D-3 (PO D-c, 2026-11-18): the plate's height at the reader's text size. It is the accepted 56
 * points at the default size and every size up to iOS's largest non-accessibility one (xxxL, 1.235: 55.2 → 56); only at
 * the accessibility sizes does it grow with the word's own line, so the destination words stay on the screen and readable
 * (iPhone SE at AX3 drew them below its edge). Font scaling is untouched (W1A-01).
 */
export function globalSwitcherHeight(fontScale: number): number {
  return Math.max(GLOBAL_SWITCHER_HEIGHT, Math.ceil(GLYPH_AND_AIR + WORD_LEADING * Math.max(1, fontScale)));
}
const HAIRLINE = 1;
export const GLOBAL_SWITCHER_TEST_ID = 'qandeel-global-switcher';

export interface GlobalSwitcherProps {
  readonly area: WorldArea;
  readonly language: ChromeLanguage;
  readonly bottomInset: number;
  readonly onSelect: (area: WorldArea) => void;
}

export function GlobalSwitcher({ area, language, bottomInset, onSelect }: GlobalSwitcherProps) {
  useDiagPhase('switcher');
  const palette = usePalette();
  const { fontScale } = useWindowDimensions();
  const copy = sharedCopy(language);
  const publicWords = publicCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const items: readonly { readonly key: WorldArea; readonly word: string; readonly glyph: 'navMine' | 'navShared' | 'navPublic' }[] = [
    { key: 'MY_WORLD', word: copy.personalWorld, glyph: 'navMine' },
    { key: 'SHARED_WORLD', word: copy.sharedWorld, glyph: 'navShared' },
    { key: 'PUBLIC_WORLD', word: publicWords.publicWorld, glyph: 'navPublic' },
  ];
  return (
    <View
      testID={GLOBAL_SWITCHER_TEST_ID}
      accessibilityRole="radiogroup"
      accessibilityLabel={publicWords.switcherLabel}
      accessibilityLanguage={language}
      style={{ backgroundColor: palette.field, paddingBottom: bottomInset, direction: writing }}
    >
      <View style={{ height: HAIRLINE, backgroundColor: palette.tertiary, opacity: 0.4 }} />
      <View style={{ height: globalSwitcherHeight(fontScale), flexDirection: 'row' }}>
        {items.map((item) => {
          const selected = item.key === area;
          return (
            <View key={item.key} style={{ flex: 1 }}>
              {/* SW-3: the selected cell's seam thickens to the E1R marker across the whole cell. */}
              <View
                testID={`qandeel-switcher-seam-${item.key.toLowerCase()}`}
                style={{ position: 'absolute', top: -HAIRLINE, left: 0, right: 0, height: selected ? palette.markerThickness : 0, backgroundColor: palette.selectedMarker }}
              />
              <Control
                palette={palette}
                language={language}
                accessibilityRole="radio"
                accessibilityLabel={item.word}
                accessibilityState={{ selected, checked: selected }}
                onPress={() => {
                  if (!selected) onSelect(item.key);
                }}
                testID={`qandeel-switcher-${item.key.toLowerCase()}`}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 0, paddingHorizontal: 2 }}
              >
                <NavGlyph name={item.glyph} color={palette.restInk} />
                {/* UI-POLISH-01 (Product Owner, 2026-11-16: every destination word whole, never ellipsized). The HONOR showed
                    the Shared word, and once the Personal word, cut to an ellipsis. The words fit their cells: Estedad
                    at 14 sp measures the Shared word at 89 dp against a 111 dp cell, and the Personal word at 35 dp.
                    Android under-measures a centred, shrink-wrapped Arabic label and then ellipsizes into its own box,
                    so the word's box is the cell's whole width (alignSelf stretch). The cell's side padding is 2 dp, so
                    the word still fits on a 320 dp screen. Only when even that cannot hold it, at large accessibility
                    sizes on narrow screens, the word is fitted to the cell instead of cut. The switcher's 56-point band
                    is reserved by the composition, so the word stays one line. */}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  // The word's weight is SELECTED's second channel: the medium face when selected, the regular one at rest.
                  style={{ ...typeStyle('action'), fontFamily: selected ? typeStyle('action').fontFamily : typeStyle('body').fontFamily, color: palette.restInk, textAlign: 'center', writingDirection: writing, alignSelf: 'stretch' }}
                >
                  {item.word}
                </Text>
              </Control>
            </View>
          );
        })}
      </View>
    </View>
  );
}
