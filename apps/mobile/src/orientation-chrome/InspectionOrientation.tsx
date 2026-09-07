/**
 * T-08 — what the reader is inspecting, how deep it sits, and what contextualizes it.
 *
 * This is orientation, not an analytical report. It states what the current disclosure legitimately
 * says about the requested inspection and stops there: no statement, no content, no confidence, no
 * relation, no evidence and no summary. The Map remains where the world is looked at.
 *
 * ## Nothing engineering-facing reaches the reader
 *
 * Every word comes from `product-copy.ts`, in the reader's own language. A family is named in plain
 * language, never as its wire token; a rung is named by what it discloses, never as its enum; a
 * projection refusal is a sentence about what the Product can show, never a transport code; and no
 * identifier of any kind — canonical id, binding id, locus key or lineage token — is spoken or
 * drawn. The typed distinctions behind those words are untouched, and they are the same typed
 * distinctions in both languages.
 *
 * ## The context path is not a breadcrumb
 *
 * The route is rendered as text and nothing in it is pressable. A clickable path would be a claim
 * that the world is a document hierarchy with parents to navigate up into, and it is not: it is one
 * world, and this is the disclosed route by which the reader reached this vantage on it. It states
 * the SHAPE of that route — inside a thread, then a place — and names nothing inside it.
 *
 * ## One accessible route, not two claimed ones
 *
 * Each option is its own native button. The chooser container is a plain layout `View` and does not
 * advertise custom actions: a non-focusable container's actions are not a route a screen reader
 * discovers, and the buttons already give full parity.
 *
 * ## Pointer and type
 *
 * The noninteractive text of this region claims no touch at all, so a press that lands on a sentence
 * reaches the world beneath it rather than being absorbed by a label. Only the chooser's own buttons
 * are targets. Line heights are ~1.6x the font size for the Arabic reasons stated in
 * `ReturnControls.tsx`, and the font family is likewise the app's to load.
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { switchContext, type MapActionOutcome, type MapInspectionContext } from '../map';
import type { CanonicalStore } from '../state';
import {
  contextChoiceLabel,
  contextChoiceTitle,
  contextOrderingNote,
  contextPathSentence,
  inspectionSentence,
} from './product-copy';
import type { ChromeLanguage, ContextChrome, InspectionChrome } from './types';

export const INSPECTION_ORIENTATION_TEST_ID = 'qandeel-inspection-orientation';
export const CONTEXT_CHOICE_TEST_ID = 'qandeel-context-choice';

export interface InspectionOrientationProps {
  readonly store: CanonicalStore;
  readonly language: ChromeLanguage;
  readonly inspection: InspectionChrome;
  readonly context: ContextChrome;
  /** The proven-current projection, or `null`. Without one no contextual act is offered. */
  readonly mapContext: MapInspectionContext | null;
  readonly onOutcome?: (outcome: MapActionOutcome) => void;
}

export function InspectionOrientation({ store, language, inspection, context, mapContext, onOutcome }: InspectionOrientationProps) {
  const render = inspection.render;

  const choose = useCallback(
    (ordinal: number) => {
      const option = context.appearances.find((candidate) => candidate.ordinal === ordinal);
      if (option === undefined || mapContext === null) return;
      // Only a render state entitled to name the identity can reach a chooser at all, so this is
      // the identity the model already admitted, never one read back out of `IF_ref`.
      if (render.kind !== 'RENDERABLE') return;
      // The requested version travels with the switch. Dropping it would silently rebind the reader
      // to the then-current version, which is a different request from the one they made.
      const outcome = switchContext(store, mapContext, {
        family: render.family,
        id: render.id,
        ...(render.versionIntent === null ? {} : { version: render.versionIntent }),
        appearance: { kind: 'THREAD_READING', bindingId: option.bindingId },
      });
      onOutcome?.(outcome);
    },
    [store, mapContext, context, render, onOutcome],
  );

  const path = contextPathSentence(language, context.lineage);

  // Inspecting nothing is a legitimate answer, and an empty region is not a surface. A line that
  // permanently says "nothing is being inspected" is a status field that is always populated, which
  // is the dashboard drift the Product contract forbids — and it competes with the world for room
  // while saying nothing about it. The technical states still render: they are things the Product
  // cannot show right now, which is not the same as the reader having asked for nothing.
  if (render.kind === 'NO_INSPECTION' && path === null && !context.choiceAvailable) return null;

  return (
    <View
      testID={INSPECTION_ORIENTATION_TEST_ID}
      style={styles.region}
      // The region is a layout container, not a target: the chooser's buttons below claim their own
      // presses and everything else falls through to the world. It carries no accessibility
      // metadata either — on Android a label here becomes the ViewGroup's `contentDescription`, and
      // TalkBack would then focus the container instead of traversing into it.
      pointerEvents="box-none"
      accessibilityRole="none"
    >
      {/* Text only. It is read and heard, never pressed, so it intercepts nothing. */}
      <View pointerEvents="none">
        <Text testID={`${INSPECTION_ORIENTATION_TEST_ID}:statement`} style={styles.statement}>
          {inspectionSentence(language, render)}
        </Text>

        {path === null ? null : (
          <Text testID={`${INSPECTION_ORIENTATION_TEST_ID}:lineage`} style={styles.lineage}>
            {path}
          </Text>
        )}
      </View>

      {context.choiceAvailable ? (
        <View
          testID={CONTEXT_CHOICE_TEST_ID}
          style={styles.choice}
          pointerEvents="box-none"
          accessibilityRole="none"
        >
          {/*
            Rendered rather than hung on the container as a label. As a container label it would be
            spoken by nobody on iOS and would swallow the options on Android; as text it is both
            seen and heard, which is what a sentence explaining the chooser is for.
          */}
          <View pointerEvents="none">
            <Text testID={`${CONTEXT_CHOICE_TEST_ID}:title`} style={styles.choiceTitle}>
              {contextChoiceTitle(language)}
            </Text>
            <Text testID={`${CONTEXT_CHOICE_TEST_ID}:ordering`} style={styles.ordering}>
              {contextOrderingNote(language)}
            </Text>
          </View>
          {context.appearances.map((option) => (
            <Pressable
              key={option.ordinal}
              testID={`${CONTEXT_CHOICE_TEST_ID}:option:${option.ordinal}`}
              style={({ pressed }) => [styles.option, pressed ? styles.pressed : null]}
              // Horizontal only: the options are stacked, so vertical slop would overlap them.
              hitSlop={HORIZONTAL_SLOP}
              accessibilityRole="button"
              accessibilityLabel={contextChoiceLabel(language, option.current, option.boundAtMoment)}
              // `selected` states where the reader IS, read from their own inspection. Where they
              // are inside no named context, nothing is marked: there is no default and no primary.
              accessibilityState={{ selected: option.current }}
              onPress={() => choose(option.ordinal)}
            >
              <Text style={styles.optionLabel}>{contextChoiceLabel(language, option.current, option.boundAtMoment)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Slop on the reading axis only, so stacked options never share hit area. */
const HORIZONTAL_SLOP = Object.freeze({ left: 8, right: 8 });

const styles = StyleSheet.create({
  // TWO type tiers, not four. 12 / 13 / 14 / 15 was a scale with one-point steps, which reads as
  // inconsistency rather than hierarchy: primary and secondary are the only distinctions this
  // surface actually makes, and weight carries the rest. Every line height is 1.6x for Arabic.
  region: { flexDirection: 'column' },
  statement: { fontSize: 15, lineHeight: 24 },
  // Text, never a control: the route is where the reader came from, not a hierarchy to climb.
  lineage: { fontSize: 13, lineHeight: 21, marginTop: 4 },
  choice: { flexDirection: 'column', marginTop: 8, rowGap: 8 },
  choiceTitle: { fontSize: 15, lineHeight: 24 },
  ordering: { fontSize: 13, lineHeight: 21 },
  option: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  // A control, so it is primary-tier and legible; the return labels stay distinct by weight.
  optionLabel: { fontSize: 15, lineHeight: 24 },
  pressed: { opacity: 0.6 },
});
