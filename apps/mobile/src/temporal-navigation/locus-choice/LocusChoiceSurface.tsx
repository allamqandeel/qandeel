/**
 * T-06 — the user-facing route for a pending contextual-locus choice (R1-04).
 *
 * The narrowest truthful interaction substrate that resolves a `LOCUS_SELECTION_REQUIRED` state.
 * Not final chrome, not art direction, not navigation: a list of the legitimate choices, a way to
 * pick one, and a way to back out.
 *
 * Both routes converge on ONE executor, so they cannot diverge in what they may do:
 *
 *   - the pointer route is a `Pressable` per option;
 *   - the non-pointer route is an accessibility action per option on the container, named by the
 *     option's own stable key rather than by an index, so it needs no precision input and no
 *     ordering assumption. Each option is also an ordinary accessible button in its own right.
 *
 * Nothing here elects, ranks or preselects. Every legitimate locus is offered, in the disclosed
 * scene's own deterministic order, and the surface says out loud that the order is not a ranking.
 * Backing out performs no act at all: no canonical field moves and no RH entry appears, because the
 * temporal half of a composite choice has not happened yet and this route does not make it happen.
 */
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';

import type { CanonicalStore } from '../../state';
import type { TemporalOutcome } from '../outcome';
import type { CommitMomentAndLocateOutcome } from '../targeting';
import { locusChoiceModel, resolvePendingLocusChoice, type PendingLocusChoice } from './pending-locus-choice';

export const LOCUS_CHOICE_TEST_ID = 'qandeel-locus-choice';
export const LOCUS_CHOICE_CANCEL_TEST_ID = 'qandeel-locus-choice-cancel';

/** The accessibility action that backs out of the choice. Option actions are keyed by locus. */
export const LOCUS_CHOICE_CANCEL_ACTION = 'cancel-locus-choice';

export interface LocusChoiceSurfaceProps {
  readonly store: CanonicalStore;
  readonly pending: PendingLocusChoice;
  /** Observes the executor's own answer. Purely informational; it authorizes nothing. */
  readonly onOutcome?: (outcome: TemporalOutcome | CommitMomentAndLocateOutcome) => void;
  /** Backing out. Non-transactional by construction: this component performs no act to undo. */
  readonly onCancel?: () => void;
}

export function LocusChoiceSurface({ store, pending, onOutcome, onCancel }: LocusChoiceSurfaceProps) {
  const model = useMemo(() => locusChoiceModel(pending), [pending]);

  // The act runs first and the observer is notified afterwards: an optional call would not evaluate
  // its argument when no observer is attached, which would silently disable the whole route.
  const choose = useCallback(
    (key: string) => {
      const option = model.options.find((candidate) => candidate.key === key);
      if (option === undefined) return;
      const outcome = resolvePendingLocusChoice(store, pending, option.locus);
      onOutcome?.(outcome);
    },
    [model, store, pending, onOutcome],
  );

  return (
    <View
      testID={LOCUS_CHOICE_TEST_ID}
      style={styles.surface}
      accessibilityRole="none"
      accessibilityLabel={model.title}
      accessibilityHint={model.orderingNote}
      accessibilityActions={[
        ...model.options.map((option) => ({ name: option.key, label: option.label })),
        { name: LOCUS_CHOICE_CANCEL_ACTION, label: 'Leave without choosing' },
      ]}
      onAccessibilityAction={(event: AccessibilityActionEvent) => {
        const action = event.nativeEvent.actionName;
        if (action === LOCUS_CHOICE_CANCEL_ACTION) {
          onCancel?.();
          return;
        }
        choose(action);
      }}
    >
      <Text testID={`${LOCUS_CHOICE_TEST_ID}:title`}>{model.title}</Text>
      <Text testID={`${LOCUS_CHOICE_TEST_ID}:ordering`}>{model.orderingNote}</Text>

      {model.options.map((option) => (
        <Pressable
          key={option.key}
          testID={`${LOCUS_CHOICE_TEST_ID}:option:${option.key}`}
          style={styles.option}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          // No option is selected, preferred or defaulted: there is nothing to select until the
          // reader chooses, and saying otherwise would be a recommendation.
          accessibilityState={{ selected: false }}
          onPress={() => choose(option.key)}
        >
          <Text>{option.label}</Text>
        </Pressable>
      ))}

      <Pressable
        testID={LOCUS_CHOICE_CANCEL_TEST_ID}
        style={styles.option}
        accessibilityRole="button"
        accessibilityLabel="Leave without choosing"
        onPress={() => onCancel?.()}
      >
        <Text>Leave without choosing</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { flexDirection: 'column' },
  option: { minHeight: 44, justifyContent: 'center' },
});
