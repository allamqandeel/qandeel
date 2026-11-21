/**
 * COSMOS-INT-01 Slice D CP3 (§19.16) — the Personal PEEK's words and acts, as COSMOS presentation.
 *
 * Presentation only: every word and every act is handed in by its owner (the integration composes T-08's sentences, the
 * stage's family word, T-04's context choice and T-04's "Go to this place"); nothing here reads a store, decides what is
 * offered, or adds a word. It lives beside the sheet because the integration layer names no colour (T-12): the night, the
 * ink, the quiet grey and the gold are the sheet's and the chips' own accepted COSMOS tokens.
 *
 * Typography is T-08's own roles (statement `supporting`, lineage `metadata`); the family word is the focused mark's gold.
 * The acts row is the contextual chips' row (U-9: it runs left → right in both languages; the words keep their own
 * direction), and the "Go to this place" chip is the contextual chips' chip: a 32-point glass chip in a 44-point target.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { typeStyle } from '../../../conversation';
import type { ChromeLanguage } from '../../../orientation-chrome';

export interface CosmosPeekWordsProps {
  readonly language: ChromeLanguage;
  /** The approved family word, or none (an identity this moment does not know is never named). */
  readonly family: string | null;
  /** COSMOS E-2 Slice A: the inspected Thread's name (the person's alias or grounding wording) and where it came from; `quiet` for "unnamed". */
  readonly name?: { readonly text: string; readonly hint: string | null; readonly quiet?: boolean } | null;
  /** COSMOS E-2 Slice A: more, below the acts (the alias editor, the source chip). */
  readonly extra?: ReactNode;
  readonly statement: string;
  /**
   * COSMOS E-2 (SD-3 item 6, §31.10): the inspected Reading's own statement, exactly as the server disclosed it relied on;
   * or, `withheld`, the approved evidence-change line shown in its place. Never composed or inferred here.
   */
  readonly reading?: { readonly text: string; readonly withheld: boolean } | null;
  readonly lineage: string | null;
  /** The context choice, drawn by its owner (or none). */
  readonly choice?: ReactNode;
  /** "Go to this place": its label and its act, or none where it is not offered. */
  readonly go: { readonly label: string; readonly onPress: () => void } | null;
  /** The least height of the words (so the PEEK reaches what it must cover), and the bottom inset they keep clear of. */
  readonly minHeight: number;
  readonly bottomInset: number;
  /** The root's test id; the parts are `:family`, `:statement`, `:reading`, `:lineage` and `:go`. */
  readonly testID: string;
}

export function CosmosPeekWords({ language, family, name = null, statement, reading = null, lineage, choice = null, go, minHeight, bottomInset, testID, extra = null }: CosmosPeekWordsProps) {
  const rtl = language === 'ar';
  const words = { writingDirection: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left' } as const;
  return (
    <View testID={testID} accessibilityLanguage={language} style={[styles.peek, { minHeight, paddingBottom: bottomInset + 8 }]}>
      {family === null ? null : (
        <Text testID={`${testID}:family`} accessibilityRole="header" style={[typeStyle('supporting'), styles.family, words]}>{family}</Text>
      )}
      {name === null ? null : (
        <Text testID={`${testID}:name`} style={[typeStyle(name.quiet === true ? 'metadata' : 'supporting'), name.quiet === true ? styles.lineage : styles.name, words]}>{name.text}</Text>
      )}
      {name === null || name.hint === null ? null : (
        <Text testID={`${testID}:name-hint`} style={[typeStyle('metadata'), styles.lineage, words]}>{name.hint}</Text>
      )}
      <Text testID={`${testID}:statement`} style={[typeStyle('supporting'), styles.statement, words]}>{statement}</Text>
      {reading === null ? null : (
        <Text testID={`${testID}:reading`} style={[typeStyle(reading.withheld ? 'metadata' : 'supporting'), reading.withheld ? styles.lineage : styles.statement, words]}>{reading.text}</Text>
      )}
      {lineage === null ? null : (
        <Text testID={`${testID}:lineage`} style={[typeStyle('metadata'), styles.lineage, words]}>{lineage}</Text>
      )}
      {choice === null && go === null ? null : (
        <View style={styles.acts} pointerEvents="box-none">
          {choice}
          {go === null ? null : (
            <Pressable testID={`${testID}:go`} accessibilityRole="button" accessibilityLabel={go.label} accessibilityLanguage={language}
              onPress={go.onPress} style={styles.press}>
              <View style={styles.chip}><Text style={styles.chipText}>{go.label}</Text></View>
            </Pressable>
          )}
        </View>
      )}
      {extra}
    </View>
  );
}

// The accepted COSMOS tokens (the sheet's ink, the quiet grey, gold, the hairline; the chips' glass).
const C = { ink: '#E9EAF4', quiet: '#9A9DB4', gold: '#ECCC8A', glass: 'rgba(11, 13, 26, 0.62)', hair: 'rgba(233, 234, 244, 0.16)' } as const;

const styles = StyleSheet.create({
  peek: { paddingHorizontal: 20, rowGap: 2 },
  family: { color: C.gold },
  name: { color: C.ink, fontWeight: '600' },
  statement: { color: C.ink },
  lineage: { color: C.quiet },
  acts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingTop: 2 },
  // T12-A95: every press target is at least 44 points; the compact 32-point chip sits inside it (the contextual chips').
  press: { minHeight: 44, minWidth: 44, maxWidth: '100%', justifyContent: 'center' },
  chip: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 12, lineHeight: 18, color: C.ink, textAlign: 'center' },
});

// D-4 (COSMOS E-2 corrections, 2026-11-20): the topic-name acts of the Personal PEEK (name field, Save, Cancel, Name this
// topic, Open where it began) live in the integration layer, which may define no colour (T-12 §28.22). They read the
// sheet's accepted tokens from here, so the one palette stays this module's.
export const cosmosPeekChipStyles = StyleSheet.create({
  acts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingTop: 2 },
  editor: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, width: '100%' },
  field: { flexGrow: 1, minWidth: 160, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, color: C.ink, backgroundColor: C.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair },
  fieldFailed: { borderColor: C.gold },
  press: { minHeight: 44, minWidth: 44, maxWidth: '100%', justifyContent: 'center' },
  chip: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 12, lineHeight: 18, color: C.ink, textAlign: 'center' },
});
/** The placeholder ink of the name field (a prop, not a style). */
export const COSMOS_PEEK_PLACEHOLDER_INK = C.quiet;
