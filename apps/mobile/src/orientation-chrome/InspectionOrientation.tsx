/**
 * T-08 — what the reader is inspecting, how deep it sits, and what contextualizes it.
 *
 * This is orientation, not an analytical report. It states what the current disclosure legitimately
 * says about the requested inspection and stops there: no statement, no content, no confidence, no
 * relation, no evidence and no summary. The Map remains where the world is looked at; this only
 * answers "what am I looking at, and where in the world am I looking at it from".
 *
 * ## Every branch says a different thing, and they may never be merged
 *
 * "not known at this moment", "withheld at this level of detail", "the context you asked for is not
 * available here", "not loaded yet", "the server refused", "the view is being brought up to date"
 * and "this view does not describe your inspection" are seven different facts. Four of them are
 * about the client and the transport and say nothing whatsoever about the world; presenting any of
 * them as an absence would tell the reader something false about their own history.
 *
 * A superseded or not-yet-current version is likewise never called wrong, deleted or never valid.
 * It is a recorded version of a real lineage, and the reader asked for exactly it.
 *
 * ## The context path is not a breadcrumb
 *
 * The route is rendered as text and nothing in it is pressable. A clickable path would be a claim
 * that the world is a document hierarchy with parents to navigate up into, and it is not: it is one
 * world, and this is the disclosed route by which the reader reached this vantage on it.
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';

import { switchContext, type MapActionOutcome, type MapInspectionContext } from '../map';
import type { CanonicalStore } from '../state';
import type { ContextChrome, ContextStep, InspectionChrome, InspectionRenderState } from './types';

export const INSPECTION_ORIENTATION_TEST_ID = 'qandeel-inspection-orientation';
export const CONTEXT_CHOICE_TEST_ID = 'qandeel-context-choice';

/** The neutral name of the region. It names the region, never the object or the state of the world. */
export const INSPECTION_ORIENTATION_LABEL = 'What you are inspecting';

export interface InspectionOrientationProps {
  readonly store: CanonicalStore;
  readonly inspection: InspectionChrome;
  readonly context: ContextChrome;
  /** The proven-current projection, or `null`. Without one no contextual act is offered. */
  readonly mapContext: MapInspectionContext | null;
  readonly onOutcome?: (outcome: MapActionOutcome) => void;
}

function versionLine(versionIntent: number | null, noncurrent: 'PREVALID' | 'SUPERSEDED' | null): string {
  const asked = versionIntent === null ? 'The version current at this moment.' : `Version ${versionIntent}, exactly as you asked for it.`;
  if (noncurrent === 'SUPERSEDED') return `${asked} It had already been replaced by this moment.`;
  if (noncurrent === 'PREVALID') return `${asked} It was not yet the current one at this moment.`;
  return asked;
}

/** The single statement for one render state. Nothing here names anything the state does not carry. */
export function inspectionStatement(render: InspectionRenderState): string {
  switch (render.kind) {
    case 'NO_INSPECTION':
      return 'Nothing is being inspected.';
    case 'RENDERABLE':
      return `${render.family} ${render.id}. ${versionLine(render.versionIntent, render.noncurrent)}`;
    case 'IDENTITY_UNKNOWN_AT_TC':
      // No identity, no family, no shape and no place held for one. The reader is told only that
      // this moment does not know it, which is the whole of what may be said here.
      return 'This moment does not know what you asked to inspect.';
    case 'CONTEXT_UNAVAILABLE_AT_TC':
      // The identity is part of what this moment knows and may be named; the context may not be,
      // and no other context is offered in its place.
      return `${render.family} ${render.id}. ${versionLine(render.versionIntent, render.noncurrent)} The context you asked for is not available at this moment.`;
    case 'DEPTH_WITHHELD':
      // Withheld is not absent. The rung that would disclose it is named; none of its content is.
      return `${render.family} ${render.id}. Not disclosed at this level of detail; it is disclosed at ${render.requiredDepth}.`;
    case 'PROJECTION_NOT_FETCHED':
      return 'The view of this moment has not been loaded yet.';
    case 'PROJECTION_UNAVAILABLE':
      return `The view of this moment is unavailable: ${render.code}.`;
    case 'PROJECTION_STALE':
      return 'The view is being brought up to date.';
    case 'PROJECTION_INCOHERENT':
      return 'The view of this moment could not be used.';
    case 'INSPECTION_NOT_RESOLVED':
      return 'This view does not describe what you are inspecting.';
    case 'RESOLUTION_MALFORMED':
      return 'What you are inspecting could not be described here.';
    default: {
      const exhaustive: never = render;
      return exhaustive;
    }
  }
}

/** One disclosed step of the route, in words. Structural placeholder copy, like every label here. */
export function contextStepLabel(step: ContextStep): string {
  switch (step.kind) {
    case 'WORLD':
      return 'World';
    case 'RUNG':
      return step.token;
    case 'THREAD':
      return `Thread ${step.id}`;
    case 'THREAD_READING':
      return `context ${step.id}`;
    case 'QUESTION_TURN':
      return `question turn ${step.id}`;
    case 'OBJECT':
      return `${step.token} ${step.id}`;
    default: {
      const exhaustive: never = step.kind;
      return exhaustive;
    }
  }
}

export function InspectionOrientation({ store, inspection, context, mapContext, onOutcome }: InspectionOrientationProps) {
  const render = inspection.render;

  const choose = useCallback(
    (key: string) => {
      const option = context.appearances.find((candidate) => candidate.key === key);
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

  return (
    <View
      testID={INSPECTION_ORIENTATION_TEST_ID}
      style={styles.region}
      accessibilityRole="none"
      accessibilityLabel={INSPECTION_ORIENTATION_LABEL}
    >
      <Text testID={`${INSPECTION_ORIENTATION_TEST_ID}:statement`} style={styles.statement}>
        {inspectionStatement(render)}
      </Text>

      {context.lineage.length > 0 ? (
        <Text testID={`${INSPECTION_ORIENTATION_TEST_ID}:lineage`} style={styles.lineage}>
          {context.lineage.map(contextStepLabel).join(' / ')}
        </Text>
      ) : null}

      {context.choiceAvailable ? (
        <View
          testID={CONTEXT_CHOICE_TEST_ID}
          style={styles.choice}
          // Never `accessible`: each disclosed appearance stays its own element and its own action.
          accessibilityRole="none"
          accessibilityLabel="Other contexts this is disclosed in"
          accessibilityHint={context.ordering}
          accessibilityActions={context.appearances.map((option) => ({ name: option.key, label: option.label }))}
          onAccessibilityAction={(event: AccessibilityActionEvent) => choose(event.nativeEvent.actionName)}
        >
          <Text testID={`${CONTEXT_CHOICE_TEST_ID}:ordering`} style={styles.ordering}>
            {context.ordering}
          </Text>
          {context.appearances.map((option) => (
            <Pressable
              key={option.key}
              testID={`${CONTEXT_CHOICE_TEST_ID}:option:${option.key}`}
              style={({ pressed }) => [styles.option, pressed ? styles.pressed : null]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              // `selected` states where the reader IS, read from their own inspection. Where they
              // are inside no named context, nothing is marked: there is no default and no primary.
              accessibilityState={{ selected: option.current }}
              onPress={() => choose(option.key)}
            >
              <Text style={styles.optionLabel}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  region: { flexDirection: 'column' },
  statement: { fontSize: 15 },
  // Text, never a control: the route is where the reader came from, not a hierarchy to climb.
  lineage: { fontSize: 13, marginTop: 4 },
  choice: { flexDirection: 'column', marginTop: 8 },
  ordering: { fontSize: 12 },
  option: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  optionLabel: { fontSize: 14 },
  pressed: { opacity: 0.6 },
});
