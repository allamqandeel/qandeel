/**
 * S5-01 (E2E-H-08) — the Public display choice in General Settings → Account & Identity (P1 §6, §8.1). There is no
 * Public Settings page or tab: this is one radio group inside the existing Account & Identity group.
 *
 * Two options, each with the label the Public World renders for it NOW:
 *
 *   «المعرّف العام» / Public ID — the reader's CURRENT Public ID, drawn as an isolated left-to-right handle;
 *   «الاسم» / Name             — the reader's CURRENT Name (offered only when the account has one).
 *
 * The selected option is told by E1R's selected treatment (a ring holding a filled dot — a shape, not only a colour)
 * and by its accessibility state, exactly as the Appearance choice. Nothing is optimistic; a choice that did not go
 * through shows the existing network sentence. Every word comes from an existing copy module.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { publicCopy } from '../public-world/copy';
import type { PublicDisplayMode } from '../runtime-entry';
import type { PublicDisplayController } from './public-display-controller';
import { isolatedHandle } from './PublicIdSection';

const ROW_START = 24;
const ROW_END = 20;
const MARKER = 20;
const MARKER_DOT = 10;
const BUSY_OPACITY = 0.6;

export interface PublicDisplaySectionProps {
  readonly controller: PublicDisplayController;
  /** «المعرّف العام» / Public ID (W3-02 `pidTerm`) and «الاسم» / Name (W1B-01), and the network sentence. */
  readonly terms: { readonly publicId: string; readonly name: string; readonly network: string };
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
}

export function PublicDisplaySection({ controller, terms, language, palette }: PublicDisplaySectionProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const heading = publicCopy(language).displayHeading;

  // Read every time the row is drawn: a Public ID or Name change made elsewhere is reflected, never stale.
  useEffect(() => {
    controller.load();
  }, [controller]);

  const display = state.display;
  if (display === null) return null;
  const options: readonly { readonly mode: PublicDisplayMode; readonly term: string; readonly value: string | null }[] = [
    { mode: 'PSEUDONYM', term: terms.publicId, value: display.mode === 'PSEUDONYM' && display.label !== null ? isolatedHandle(display.label) : null },
    ...(display.realNameAvailable
      ? [{ mode: 'REAL_NAME' as const, term: terms.name, value: display.mode === 'REAL_NAME' ? display.label : null }]
      : []),
  ];

  return (
    <View testID="qandeel-public-display">
      <Text testID="qandeel-public-display-heading" style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 10, writingDirection: writing }}>
        {heading}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={heading} accessibilityLanguage={language}>
        {options.map((option) => {
          const selected = display.mode === option.mode;
          const busy = state.busy === option.mode;
          return (
            <Control
              key={option.mode}
              palette={palette}
              language={language}
              accessibilityRole="radio"
              accessibilityLabel={option.value === null ? option.term : `${option.term}, ${option.value}`}
              accessibilityState={{ checked: selected, selected, busy }}
              onPress={() => controller.choose(option.mode)}
              testID={`qandeel-public-display-${option.mode.toLowerCase()}`}
              style={{ minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, opacity: busy ? BUSY_OPACITY : 1 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 14 }}>
                <View style={{
                  width: MARKER, height: MARKER, borderRadius: MARKER / 2, borderWidth: palette.markerThickness,
                  borderColor: selected ? palette.selectedInk : palette.restInk, alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected ? (
                    <View testID={`qandeel-public-display-${option.mode.toLowerCase()}-selected`}
                      style={{ width: MARKER_DOT, height: MARKER_DOT, borderRadius: MARKER_DOT / 2, backgroundColor: palette.selectedMarker }} />
                  ) : null}
                </View>
                <View style={{ rowGap: 2, flexShrink: 1 }}>
                  <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{option.term}</Text>
                  {option.value !== null ? (
                    <Text testID="qandeel-public-display-label" style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{option.value}</Text>
                  ) : null}
                </View>
              </View>
            </Control>
          );
        })}
      </View>
      {state.failed ? (
        <Text testID="qandeel-public-display-failed" accessibilityLiveRegion="polite"
          style={{ ...typeStyle('metadata'), color: palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}>
          {terms.network}
        </Text>
      ) : null}
    </View>
  );
}
