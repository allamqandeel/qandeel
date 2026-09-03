import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

/** Stable technical identifiers used by the component test and the Maestro boot smoke. */
export const FOUNDATION_SHELL_TEST_ID = 'qandeel-foundation-shell';
export const FOUNDATION_SHELL_TITLE = 'QANDEEL';
export const FOUNDATION_SHELL_STATUS = 'T-01 foundation shell';

/**
 * Minimal technical shell proving that the committed mobile foundation boots.
 *
 * This is infrastructure, not Product UI: no Product copy, no visual language,
 * no semantic state. The first Product task replaces it.
 */
export function FoundationShell() {
  return (
    <View
      style={styles.root}
      testID={FOUNDATION_SHELL_TEST_ID}
      accessibilityLabel={`${FOUNDATION_SHELL_TITLE} ${FOUNDATION_SHELL_STATUS}`}
    >
      <StatusBar style="auto" />
      <Text accessibilityRole="header" style={styles.title}>
        {FOUNDATION_SHELL_TITLE}
      </Text>
      <Text style={styles.status}>{FOUNDATION_SHELL_STATUS}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  status: {
    marginTop: 8,
    fontSize: 14,
  },
});
