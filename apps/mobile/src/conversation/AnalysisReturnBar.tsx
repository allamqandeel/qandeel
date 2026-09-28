/**
 * W1A-01 — Analysis → Conversation (E2E-B-07): the one control the Analysis depth gains.
 *
 * It sits in its own band ABOVE the Analysis world, at the reader's START edge, carrying P2's back
 * chevron and the frozen label «المحادثة» / Conversation (G1.1 closure §1, P4-C4 `backName`). The
 * band is the World and nothing else; the Living Analysis Map below it is untouched and is simply
 * laid out beneath the band's measured height, so the band never covers any part of the world.
 */
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Text, View, findNodeHandle, type LayoutChangeEvent } from 'react-native';

import type { ChromeLanguage } from '../orientation-chrome';
import { readerDirection, readerSide } from './bidi';
import { conversationCopy } from './copy';
import { Control } from './visual/Control';
import { useConversationTypeface } from './visual/fonts';
import { Glyph } from './visual/Glyph';
import { typeStyle, usePalette } from './visual/theme';

export interface AnalysisReturnBarProps {
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly left: number; readonly right: number };
  readonly onReturnToConversation: () => void;
  /** Reports the band's full height, so the world beneath it is laid out below it. */
  readonly onHeight: (height: number) => void;
  /** Move screen-reader focus to the control once, when arriving from the Conversation. */
  readonly focusControl?: boolean;
}

export const ANALYSIS_RETURN_BAR_MIN_HEIGHT = 48;

export function AnalysisReturnBar({ language, insets, onReturnToConversation, onHeight, focusControl = false }: AnalysisReturnBarProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = conversationCopy(language);
  const direction = readerDirection(language);
  const start = readerSide(language);
  const controlRef = useRef<View | null>(null);

  useEffect(() => {
    if (!focusControl || !ready) return;
    const node = controlRef.current === null ? null : findNodeHandle(controlRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [focusControl, ready]);

  return (
    <View
      testID="qandeel-analysis-return-bar"
      onLayout={(event: LayoutChangeEvent) => onHeight(event.nativeEvent.layout.height)}
      style={{
        backgroundColor: palette.world,
        direction: 'ltr',
        paddingTop: insets.top,
        paddingLeft: insets.left + 10,
        paddingRight: insets.right + 10,
        minHeight: insets.top + ANALYSIS_RETURN_BAR_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: start === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      {ready ? (
        <Control
          palette={palette}
          language={language}
          accessibilityLabel={copy.backName}
          onPress={onReturnToConversation}
          testID="qandeel-depth-to-conversation"
          controlRef={(node) => {
            controlRef.current = node;
          }}
          style={{ paddingHorizontal: 12 }}
        >
          <View style={{ flexDirection: direction === 'rtl' ? 'row-reverse' : 'row', alignItems: 'center' }}>
            <Glyph name="back" color={palette.primary} direction={direction} />
            <Text style={{ ...typeStyle('action'), color: palette.primary, ...(direction === 'rtl' ? { marginRight: 6 } : { marginLeft: 6 }) }}>
              {copy.backLabel}
            </Text>
          </View>
        </Control>
      ) : null}
    </View>
  );
}
