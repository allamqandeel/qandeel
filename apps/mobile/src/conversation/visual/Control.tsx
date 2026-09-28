/**
 * W1A-01 — one functional control, with the frozen interaction states.
 *
 *   - a 44 pt minimum target in both axes (F1R2);
 *   - pressed: the E1R pressed presence — the pressed ink at its token presence, laid over the
 *     control's own shape, never a colour swap of the label;
 *   - focus: the F1 focus perimeter — the focus indicator at the token thickness and offset, with the
 *     companion ring between it and the control, so it reads against any ground;
 *   - the accessible name is the control's own; its glyph is decorative.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, View, type AccessibilityState, type StyleProp, type ViewStyle } from 'react-native';

import { withAlpha, type ConversationPalette } from './theme';

export const MIN_TARGET = 44;
const CONTROL_RADIUS = 12;

export interface ControlProps {
  readonly palette: ConversationPalette;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
  readonly language: 'ar' | 'en';
  readonly controlRef?: (node: View | null) => void;
  /** W1B-01: a control whose one request is in flight says so (busy), and still refuses in its handler. */
  readonly accessibilityState?: AccessibilityState;
}

export function Control({ palette, accessibilityLabel, onPress, children, style, testID, language, controlRef, accessibilityState }: ControlProps) {
  const [focused, setFocused] = useState(false);
  const outer = palette.focusOffset + palette.focusThickness;
  return (
    <Pressable
      ref={controlRef}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityLanguage={language}
      accessibilityState={accessibilityState}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      testID={testID}
      style={[{ minWidth: MIN_TARGET, minHeight: MIN_TARGET, borderRadius: CONTROL_RADIUS, justifyContent: 'center' }, style]}
    >
      {({ pressed }) => (
        <>
          {pressed ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
                borderRadius: CONTROL_RADIUS,
                backgroundColor: withAlpha(palette.pressedInk, palette.pressedPresence),
              }}
            />
          ) : null}
          {children}
          {focused ? (
            <View
              pointerEvents="none"
              testID={testID === undefined ? undefined : `${testID}-focus`}
              style={{
                position: 'absolute', top: -outer, bottom: -outer, left: -outer, right: -outer,
                borderRadius: CONTROL_RADIUS + outer,
                borderWidth: palette.focusThickness,
                borderColor: palette.focusIndicator,
              }}
            >
              <View
                style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
                  borderRadius: CONTROL_RADIUS + palette.focusOffset,
                  borderWidth: palette.focusCompanionThickness,
                  borderColor: palette.focusCompanion,
                }}
              />
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}
