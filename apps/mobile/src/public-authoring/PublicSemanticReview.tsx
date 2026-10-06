/**
 * S5-03A — QANDEEL's understanding of a READY_FOR_REVIEW Public Experience, drawn inside the S5-02 review (no second
 * navigation system): the meaning, the main and other meanings, and why QANDEEL reads it so; "accept" for exactly the
 * revision shown; and "correct the understanding" — the reader's own words for the MEANING. There is no place, map,
 * coordinate, neighbour or rank anywhere here, and no internal term (lens, model, prompt, vector) is shown: a correction
 * is about meaning only, and QANDEEL checks it against the experience's content before it counts.
 *
 * Every word is the S5-03A copy module's. Nothing here says "published": the Experience stays READY_FOR_REVIEW.
 */
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { PublicSemanticReview as Understanding } from '../runtime-entry';
import { SEMANTIC_MEANING_MAX, type PublicAuthoringController } from './public-authoring-controller';
import { publicSemanticCopy, semanticListSeparator, type PublicSemanticCopy } from './semantic-copy';

const ROW_START = 24;
const ROW_END = 20;
const BUSY_OPACITY = 0.6;
const FIELD_MIN_HEIGHT = 48;
const FIELD_RADIUS = 12;
/** A theme line holds up to three themes of 40 characters and their separators. */
const THEMES_FIELD_MAX = 3 * 40 + 8;

interface Shared { readonly palette: ConversationPalette; readonly language: ChromeLanguage; readonly copy: PublicSemanticCopy; readonly writing: 'rtl' | 'ltr' }

export interface PublicSemanticReviewProps {
  readonly understanding: Understanding;
  readonly correcting: boolean;
  readonly palette: ConversationPalette;
  readonly language: ChromeLanguage;
  readonly busy: boolean;
  readonly controller: PublicAuthoringController;
}

function Heading({ text, s, testID }: { readonly text: string; readonly s: Shared; readonly testID?: string }) {
  return (
    <Text testID={testID} accessibilityRole="header" accessibilityLanguage={s.language}
      style={{ ...typeStyle('metadata'), color: s.palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 22, paddingBottom: 6, writingDirection: s.writing }}>
      {text}
    </Text>
  );
}

function Line({ text, s, role = 'supporting', testID, color }: { readonly text: string; readonly s: Shared; readonly role?: 'supporting' | 'body'; readonly testID?: string; readonly color?: string }) {
  return (
    <Text testID={testID} accessibilityLanguage={s.language}
      style={{ ...typeStyle(role), color: color ?? s.palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 4, writingDirection: s.writing }}>
      {text}
    </Text>
  );
}

function Action({ label, onPress, s, testID, busy, emphasis = false }: {
  readonly label: string; readonly onPress: () => void; readonly s: Shared; readonly testID: string; readonly busy: boolean; readonly emphasis?: boolean;
}) {
  return (
    <View style={{ paddingStart: ROW_START - 16, paddingVertical: 4 }}>
      <Control palette={s.palette} language={s.language} accessibilityLabel={label} accessibilityState={{ busy, disabled: busy }} onPress={onPress} testID={testID}
        style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: emphasis ? s.palette.field : undefined, opacity: busy ? BUSY_OPACITY : 1 }}>
        <Text style={{ ...typeStyle('action'), color: emphasis ? s.palette.primary : s.palette.restInk, writingDirection: s.writing }}>{label}</Text>
      </Control>
    </View>
  );
}

/** S5-03A — one labelled text field of the correction form. */
function Field({ label, value, onChange, max, s, busy, testID }: {
  readonly label: string; readonly value: string; readonly onChange: (next: string) => void; readonly max: number; readonly s: Shared;
  readonly busy: boolean; readonly testID: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ rowGap: 4 }}>
      <Text accessibilityLanguage={s.language} style={{ ...typeStyle('supporting'), color: s.palette.secondary, writingDirection: s.writing }}>{label}</Text>
      <TextInput testID={testID} value={value} onChangeText={onChange} editable={!busy} maxLength={max} accessibilityLabel={label}
        accessibilityLanguage={s.language} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} selectionColor={s.palette.primary}
        cursorColor={s.palette.primary}
        style={{
          ...typeStyle('body'), color: s.palette.primary, backgroundColor: s.palette.field, minHeight: FIELD_MIN_HEIGHT, borderRadius: FIELD_RADIUS,
          paddingHorizontal: 14, paddingVertical: 9, borderWidth: s.palette.focusThickness, borderColor: focused ? s.palette.focusIndicator : s.palette.field,
          writingDirection: s.writing, textAlign: s.writing === 'rtl' ? 'right' : 'left',
        }} />
    </View>
  );
}

/** S5-03A — correcting the meaning, in the reader's own words. Starts from the understanding shown. */
function Correction({ understanding, s, busy, controller }: {
  readonly understanding: Extract<Understanding, { readonly interpretationId: string }>; readonly s: Shared; readonly busy: boolean;
  readonly controller: PublicAuthoringController;
}) {
  const separator = semanticListSeparator(s.language);
  const [meaning, setMeaning] = useState(understanding.meaning);
  const [primary, setPrimary] = useState(understanding.primaryThemes.join(separator));
  const [secondary, setSecondary] = useState(understanding.secondaryThemes.join(separator));
  return (
    <View testID="qandeel-public-semantic-correction" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 10, rowGap: 10 }}>
      <Text accessibilityLanguage={s.language} style={{ ...typeStyle('supporting'), color: s.palette.secondary, writingDirection: s.writing }}>
        {s.copy.correctionScope}
      </Text>
      <Field label={s.copy.meaningLabel} value={meaning} onChange={setMeaning} max={SEMANTIC_MEANING_MAX} s={s} busy={busy} testID="qandeel-public-semantic-meaning-field" />
      <Field label={s.copy.primaryLabel} value={primary} onChange={setPrimary} max={THEMES_FIELD_MAX} s={s} busy={busy} testID="qandeel-public-semantic-primary-field" />
      <Field label={s.copy.secondaryLabel} value={secondary} onChange={setSecondary} max={THEMES_FIELD_MAX} s={s} busy={busy} testID="qandeel-public-semantic-secondary-field" />
      <View style={{ marginStart: -(ROW_START - 8) }}>
        <Action label={s.copy.submitCorrection} onPress={() => controller.submitCorrection(meaning, primary, secondary)} s={s} busy={busy} emphasis
          testID="qandeel-public-semantic-submit" />
        <Action label={s.copy.cancel} onPress={controller.cancelCorrection} s={s} busy={busy} testID="qandeel-public-semantic-cancel" />
      </View>
    </View>
  );
}

/** S5-03A — QANDEEL's understanding of a READY_FOR_REVIEW Experience, and the reader's review of it. */
export function PublicSemanticReview({ understanding, correcting, palette, language, busy, controller }: PublicSemanticReviewProps) {
  const s: Shared = { palette, language, copy: publicSemanticCopy(language), writing: language === 'ar' ? 'rtl' : 'ltr' };
  const separator = semanticListSeparator(s.language);
  return (
    <View testID="qandeel-public-semantic">
      <Heading text={s.copy.heading} s={s} testID="qandeel-public-semantic-heading" />
      <Line text={s.copy.explain} s={s} />
      {understanding.state === 'NO_PROPOSAL' ? (
        <Action label={s.copy.ask} onPress={controller.requestUnderstanding} s={s} busy={busy} emphasis testID="qandeel-public-semantic-ask" />
      ) : understanding.state === 'AWAITING_REVIEW' || understanding.state === 'REVIEWED' ? (
        <View testID={understanding.state === 'REVIEWED' ? 'qandeel-public-semantic-reviewed' : 'qandeel-public-semantic-awaiting'}>
          <Heading text={s.copy.meaningHeading} s={s} />
          <Line text={understanding.meaning} s={s} role="body" color={s.palette.primary} testID="qandeel-public-semantic-meaning" />
          <Heading text={s.copy.primaryHeading} s={s} />
          <Line text={understanding.primaryThemes.join(separator)} s={s} role="body" color={s.palette.primary} testID="qandeel-public-semantic-primary" />
          {understanding.secondaryThemes.length > 0 ? (
            <>
              <Heading text={s.copy.secondaryHeading} s={s} />
              <Line text={understanding.secondaryThemes.join(separator)} s={s} testID="qandeel-public-semantic-secondary" />
            </>
          ) : null}
          {understanding.explanation !== null ? (
            <>
              <Heading text={s.copy.whyHeading} s={s} />
              <Line text={understanding.explanation} s={s} testID="qandeel-public-semantic-why" />
            </>
          ) : null}
          {understanding.decision === 'ACCEPTED' ? <Line text={s.copy.acceptedState} s={s} testID="qandeel-public-semantic-accepted" /> : null}
          {understanding.decision === 'CORRECTED' ? <Line text={s.copy.correctedState} s={s} testID="qandeel-public-semantic-corrected" /> : null}
          {correcting ? (
            <Correction key={understanding.interpretationId} understanding={understanding} s={s} busy={busy} controller={controller} />
          ) : (
            <>
              {understanding.state === 'AWAITING_REVIEW'
                ? <Action label={s.copy.accept} onPress={controller.acceptUnderstanding} s={s} busy={busy} emphasis testID="qandeel-public-semantic-accept" /> : null}
              <Action label={s.copy.correct} onPress={controller.openCorrection} s={s} busy={busy} testID="qandeel-public-semantic-correct" />
            </>
          )}
        </View>
      ) : (
        <Line text={s.copy.actionUnavailable} s={s} testID="qandeel-public-semantic-unavailable" />
      )}
    </View>
  );
}
