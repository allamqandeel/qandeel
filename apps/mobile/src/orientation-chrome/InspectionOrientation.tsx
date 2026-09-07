/**
 * T-08 — what the reader is inspecting, how deep it sits, and what contextualizes it.
 *
 * This is orientation, not an analytical report. It states what the current disclosure legitimately
 * says about the requested inspection and stops there: no statement, no content, no confidence, no
 * relation, no evidence and no summary. The Map remains where the world is looked at.
 *
 * ## Nothing engineering-facing reaches the reader
 *
 * Every word comes from `product-copy.ts`. A family is named in plain language, never as its wire
 * token; a rung is named by what it discloses, never as its enum; a projection refusal is a sentence
 * about what the Product can show, never a transport code; and no identifier of any kind — canonical
 * id, binding id, locus key or lineage token — is spoken or drawn. The typed distinctions behind
 * those words are untouched.
 *
 * ## The context path is not a breadcrumb
 *
 * The route is rendered as text and nothing in it is pressable. A clickable path would be a claim
 * that the world is a document hierarchy with parents to navigate up into, and it is not: it is one
 * world, and this is the disclosed route by which the reader reached this vantage on it. It states
 * the SHAPE of that route — inside a thread, inside a context — and names nothing inside it.
 *
 * ## One accessible route, not two claimed ones
 *
 * Each option is its own native button. The chooser container is a plain layout `View` and does not
 * advertise custom actions: a non-focusable container's actions are not a route a screen reader
 * discovers, and the buttons already give full parity.
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { switchContext, type MapActionOutcome, type MapInspectionContext } from '../map';
import type { CanonicalStore } from '../state';
import { CONTEXT_CHOICE_TITLE, INSPECTION_ORIENTATION_LABEL, contextPathSentence, inspectionSentence } from './product-copy';
import type { ContextChrome, InspectionChrome } from './types';

export const INSPECTION_ORIENTATION_TEST_ID = 'qandeel-inspection-orientation';
export const CONTEXT_CHOICE_TEST_ID = 'qandeel-context-choice';

export interface InspectionOrientationProps {
  readonly store: CanonicalStore;
  readonly inspection: InspectionChrome;
  readonly context: ContextChrome;
  /** The proven-current projection, or `null`. Without one no contextual act is offered. */
  readonly mapContext: MapInspectionContext | null;
  readonly onOutcome?: (outcome: MapActionOutcome) => void;
}

export function InspectionOrientation({ store, inspection, context, mapContext, onOutcome }: InspectionOrientationProps) {
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

  const path = contextPathSentence(context.lineage);

  return (
    <View
      testID={INSPECTION_ORIENTATION_TEST_ID}
      style={styles.region}
      accessibilityRole="none"
      accessibilityLabel={INSPECTION_ORIENTATION_LABEL}
    >
      <Text testID={`${INSPECTION_ORIENTATION_TEST_ID}:statement`} style={styles.statement}>
        {inspectionSentence(render)}
      </Text>

      {path === null ? null : (
        <Text testID={`${INSPECTION_ORIENTATION_TEST_ID}:lineage`} style={styles.lineage}>
          {path}
        </Text>
      )}

      {context.choiceAvailable ? (
        <View testID={CONTEXT_CHOICE_TEST_ID} style={styles.choice} accessibilityRole="none" accessibilityLabel={CONTEXT_CHOICE_TITLE}>
          <Text testID={`${CONTEXT_CHOICE_TEST_ID}:ordering`} style={styles.ordering}>
            {context.ordering}
          </Text>
          {context.appearances.map((option) => (
            <Pressable
              key={option.ordinal}
              testID={`${CONTEXT_CHOICE_TEST_ID}:option:${option.ordinal}`}
              style={({ pressed }) => [styles.option, pressed ? styles.pressed : null]}
              // Horizontal only: the options are stacked, so vertical slop would overlap them.
              hitSlop={HORIZONTAL_SLOP}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              // `selected` states where the reader IS, read from their own inspection. Where they
              // are inside no named context, nothing is marked: there is no default and no primary.
              accessibilityState={{ selected: option.current }}
              onPress={() => choose(option.ordinal)}
            >
              <Text style={styles.optionLabel}>{option.label}</Text>
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
  region: { flexDirection: 'column' },
  statement: { fontSize: 15 },
  // Text, never a control: the route is where the reader came from, not a hierarchy to climb.
  lineage: { fontSize: 13, marginTop: 4 },
  choice: { flexDirection: 'column', marginTop: 8, rowGap: 8 },
  ordering: { fontSize: 12 },
  option: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  optionLabel: { fontSize: 14 },
  pressed: { opacity: 0.6 },
});
