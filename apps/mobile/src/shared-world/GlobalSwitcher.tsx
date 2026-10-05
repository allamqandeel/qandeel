/**
 * S4-01 — the first production Global Switcher (I-08A4 §3–§4; P4-C1 SW-3 "Keyed Seam"; P2 §5).
 *
 * Two destinations at this baseline: «قنديل» / QANDEEL (the Personal world) and «العالم المشترك» / Shared World. The
 * Public World is not exposed before its own Product stage, so no inert third destination is drawn.
 *
 *   - form: SW-3 — the plate (the one functional surface tone), a full-width hairline seam at its top edge, and the
 *     SELECTED cell's seam thickened to the E1R marker across the whole cell, with the word's weight. Brass never
 *     carries state: the glyph and the word are the same ink at every state (C3 §6; P2 §5);
 *   - each item is the P2 navigation glyph ABOVE the destination word; the word names the control and the glyph is
 *     decorative (P2 §10). A world glyph never mirrors; the items follow the reading direction (START = Personal);
 *   - switching ≠ pushing (I-08A4 §4): choosing a destination calls `onSelect` and nothing else — no route, no Back
 *     history, no Session, no canonical write. Choosing the current destination does nothing.
 */
import { Text, View } from 'react-native';

import { Control, typeStyle, usePalette } from '../conversation';
import { NavGlyph } from '../iconography';
import type { ChromeLanguage } from '../orientation-chrome';
import { sharedCopy } from './copy';

export type WorldArea = 'MY_WORLD' | 'SHARED_WORLD';

/** The plate's height inside the 56 pt the P2-A / P4-C proofs give the switcher. */
export const GLOBAL_SWITCHER_HEIGHT = 56;
const HAIRLINE = 1;
export const GLOBAL_SWITCHER_TEST_ID = 'qandeel-global-switcher';

export interface GlobalSwitcherProps {
  readonly area: WorldArea;
  readonly language: ChromeLanguage;
  readonly bottomInset: number;
  readonly onSelect: (area: WorldArea) => void;
}

export function GlobalSwitcher({ area, language, bottomInset, onSelect }: GlobalSwitcherProps) {
  const palette = usePalette();
  const copy = sharedCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const items: readonly { readonly key: WorldArea; readonly word: string; readonly glyph: 'navMine' | 'navShared' }[] = [
    { key: 'MY_WORLD', word: copy.personalWorld, glyph: 'navMine' },
    { key: 'SHARED_WORLD', word: copy.sharedWorld, glyph: 'navShared' },
  ];
  return (
    <View
      testID={GLOBAL_SWITCHER_TEST_ID}
      accessibilityRole="radiogroup"
      accessibilityLabel={copy.switcherLabel}
      accessibilityLanguage={language}
      style={{ backgroundColor: palette.field, paddingBottom: bottomInset, direction: writing }}
    >
      <View style={{ height: HAIRLINE, backgroundColor: palette.tertiary, opacity: 0.4 }} />
      <View style={{ height: GLOBAL_SWITCHER_HEIGHT, flexDirection: 'row' }}>
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
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 0, paddingHorizontal: 6 }}
              >
                <NavGlyph name={item.glyph} color={palette.restInk} />
                <Text
                  numberOfLines={1}
                  // The word's weight is SELECTED's second channel: the medium face when selected, the regular one at rest.
                  style={{ ...typeStyle('action'), fontFamily: selected ? typeStyle('action').fontFamily : typeStyle('body').fontFamily, color: palette.restInk, textAlign: 'center', writingDirection: writing }}
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
