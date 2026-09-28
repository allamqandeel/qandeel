/**
 * W1B-01 (E2E-A-13) — the concise first-use Welcome, as the Product Owner's controlled amendment to
 * I-08A4 §14 has it: three lines, addressed by the account Name, and the last line is the start act.
 *
 * It is relationship-first and asks nothing: no questionnaire, no second name question, no carousel,
 * no skip. It is ONE coherent surface in the frozen visual language — the Dark World, the greeting as
 * E3's statement, the definition as body text, and the start line as a FIELD-filled act — never an
 * onboarding card. Its start act moves the reader into the real Conversation; the Welcome is then
 * complete (see `account-controller.ts` for why that is durable and what happens if it does not land).
 */
import { ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Control, typeStyle, useConversationTypeface, usePalette } from '../../conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import { firstUseCopy } from '../copy';

export const WELCOME_SURFACE_TEST_ID = 'qandeel-first-use-welcome';

export interface WelcomeSurfaceProps {
  readonly displayName: string;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  readonly onStart: () => void;
}

const GUTTER = 28;

export function WelcomeSurface({ displayName, language, insets, onStart }: WelcomeSurfaceProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const [greeting, definition, start] = firstUseCopy(language).welcome(displayName);
  const writingDirection = language === 'ar' ? 'rtl' : 'ltr';
  const textAlign = language === 'ar' ? 'right' : 'left';

  return (
    <View testID={WELCOME_SURFACE_TEST_ID} style={{ flex: 1, backgroundColor: palette.world }} accessibilityLanguage={language}>
      <StatusBar style="light" />
      {ready ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingTop: insets.top + GUTTER,
            paddingBottom: insets.bottom + GUTTER,
            paddingLeft: insets.left + GUTTER,
            paddingRight: insets.right + GUTTER,
          }}
        >
          <View style={{ width: '100%', maxWidth: 460, alignSelf: 'center', rowGap: 18 }}>
            <Text testID="qandeel-first-use-greeting" accessibilityRole="header" style={{ ...typeStyle('statement'), color: palette.primary, textAlign, writingDirection }}>
              {greeting}
            </Text>
            <Text testID="qandeel-first-use-definition" style={{ ...typeStyle('body'), color: palette.secondary, textAlign, writingDirection }}>
              {definition}
            </Text>
            <Control
              palette={palette}
              language={language}
              accessibilityLabel={start}
              onPress={onStart}
              testID="qandeel-first-use-start"
              style={{ marginTop: 14, minHeight: 52, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: palette.field }}
            >
              <Text style={{ ...typeStyle('body'), color: palette.primary, textAlign, writingDirection }}>{start}</Text>
            </Control>
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}
