/**
 * T-06 — the accessible temporal routes as real native View semantics.
 *
 * Every action here reaches Product truth through the same addressability gate, the same preview
 * controller and the same commit boundary as the pointer route. None of them needs a drag, a
 * precision pointer or a coordinate of any kind: exact targeting is typed as a Session Position,
 * forward continuation is a repeatable single step, and preview, commit, cancel and the Live target
 * are named actions.
 *
 * ## Why the container is not an accessibility element (FCR-02)
 *
 * On React Native, `accessible={true}` makes a View ONE accessibility element — on iOS it becomes
 * `isAccessibilityElement`, on Android a single focusable node — and assistive technology does not
 * reliably reach the interactive descendants of such an element independently: they collapse into
 * the parent. A container that grouped the exact-entry `TextInput` and the four controls would
 * therefore hide exactly the routes this component exists to provide, and a test renderer would
 * never notice, because it can still find and fire the children.
 *
 * So the structure is split by what each element IS:
 *
 *   - the CONTAINER is a plain layout View. It carries no accessibility props at all, so it groups
 *     nothing and suppresses nothing;
 *   - the SUMMARY is a dedicated accessibility element with NO interactive descendants — only the
 *     two statements, committed stance and preview. It is focusable on its own, it announces the
 *     one truthful sentence, and it carries the named temporal actions, which cost nothing there
 *     because there is nothing beneath it to suppress;
 *   - the exact-entry input and the four controls are ordinary, individually focusable native
 *     elements, siblings of the summary, each with its own truthful label and state.
 *
 * The named actions are deliberately kept, and deliberately on the summary: a reader who has just
 * heard the temporal state can act on it without moving focus, and each action converges on the
 * same executor as the sibling control that offers the same capability. There is no capability that
 * exists only as an action, and none that exists only as a control.
 *
 * The T-07 return acts are deliberately absent even though a final accessibility architecture will
 * want them: they belong to T-07's own return surface, and offering an action this task cannot honour
 * would be a promise rather than a route.
 *
 * This component subscribes to canonical state and to the preview controller separately, because
 * they are separate kinds of truth and must be able to disagree — a preview open over unchanged
 * committed truth is the normal case, not a desynchronization.
 */
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type AccessibilityActionEvent } from 'react-native';

import type { CanonicalStore } from '../../state';
import type { DisclosedTrack } from '../../timeline';
import type { TemporalOutcome } from '../outcome';
import type { TemporalPreviewController } from '../preview/preview-state';
import { temporalTargeting } from '../targeting/disclosed-availability';
import { commitLiveEdgeIntent, commitPreviewedTarget } from '../targeting/commit';
import {
  parseExactMomentEntry,
  temporalAccessibilityModel,
  temporalAnnouncement,
  type TemporalAccessibilityActionName,
} from './temporal-accessibility';

export const TEMPORAL_NAVIGATOR_TEST_ID = 'qandeel-temporal-navigator';
/** The one accessibility element that states temporal truth and carries the named actions. */
export const TEMPORAL_SUMMARY_TEST_ID = 'qandeel-temporal-summary';
export const TEMPORAL_EXACT_ENTRY_TEST_ID = 'qandeel-temporal-exact-entry';
export const TEMPORAL_COMMIT_TEST_ID = 'qandeel-temporal-commit';
export const TEMPORAL_LIVE_TEST_ID = 'qandeel-temporal-live';

export interface TemporalNavigatorProps {
  readonly store: CanonicalStore;
  readonly preview: TemporalPreviewController;
  /**
   * The currently disclosed Track. It is what authorizes interaction targeting, so the accessible
   * routes are bounded by disclosure exactly as the pointer route is (R1-01) — the exact-entry hint
   * names the disclosure horizon, and a forward step is offered only where one really exists.
   */
  readonly track: DisclosedTrack;
  /** Presentation acknowledgement, invoked only after the store has answered. */
  readonly onCommitted?: () => void;
  readonly onCancelled?: () => void;
  readonly onOutcome?: (outcome: TemporalOutcome) => void;
}

export function TemporalNavigator({ store, preview, track, onCommitted, onCancelled, onOutcome }: TemporalNavigatorProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const previewState = useSyncExternalStore(preview.subscribe, preview.getSnapshot);
  const [entry, setEntry] = useState('');
  const [entryRefused, setEntryRefused] = useState(false);

  const targeting = useMemo(() => temporalTargeting(state, track), [state, track]);
  const model = useMemo(() => temporalAccessibilityModel(targeting, previewState), [targeting, previewState]);

  // The act runs first and the observers are notified afterwards: an optional call would not
  // evaluate its argument when no observer is attached, which would silently disable the route.
  const report = useCallback(
    (outcome: TemporalOutcome) => {
      onOutcome?.(outcome);
      if (outcome.outcome === 'APPLIED') onCommitted?.();
      else onCancelled?.();
    },
    [onOutcome, onCommitted, onCancelled],
  );

  const runAction = useCallback(
    (action: TemporalAccessibilityActionName | string) => {
      switch (action) {
        case 'preview-later-moment':
          // Relative forward continuation, one deliberate step over DISCLOSED targets. Ephemeral:
          // nothing canonical moves, and holding at either bound never becomes Live intent.
          preview.stepForward(targeting);
          return;
        case 'cancel-preview':
          preview.cancel();
          onCancelled?.();
          return;
        case 'commit-previewed-moment':
          report(commitPreviewedTarget(store, preview, targeting));
          return;
        case 'commit-live-edge':
          report(commitLiveEdgeIntent(store, preview));
          return;
        default:
          return;
      }
    },
    [preview, targeting, store, report, onCancelled],
  );

  const submitExact = useCallback(() => {
    const parsed = parseExactMomentEntry(entry);
    // The disclosed gate decides, so an exact entry that `LH` would allow but nothing has disclosed
    // is refused here exactly as it would be on every other route.
    const result = parsed === null ? null : preview.preview(targeting, parsed, 'EXACT_ENTRY');
    setEntryRefused(result === null || result.outcome === 'REJECTED');
  }, [entry, preview, targeting]);

  return (
    // Layout only. No accessibility prop of any kind: this View must never become an accessibility
    // element, because it owns the interactive descendants below.
    <View testID={TEMPORAL_NAVIGATOR_TEST_ID} style={styles.surface}>
      {/* The summary element: a leaf. Committed truth and the preview are separate statements — the
          preview never overwrites the committed sentence, and it always says that it is a preview.
          Nothing interactive lives inside it, so making it ONE element suppresses nothing. */}
      <View
        testID={TEMPORAL_SUMMARY_TEST_ID}
        style={styles.summary}
        accessible
        accessibilityRole="text"
        accessibilityLabel={model.surfaceLabel}
        accessibilityValue={{ text: temporalAnnouncement(model) }}
        accessibilityActions={model.actions.map((action) => ({ name: action.name, label: action.label }))}
        onAccessibilityAction={(event: AccessibilityActionEvent) => runAction(event.nativeEvent.actionName)}
      >
        <Text testID={`${TEMPORAL_NAVIGATOR_TEST_ID}:stance`}>{model.stanceLabel}</Text>
        {model.previewLabel !== null && <Text testID={`${TEMPORAL_NAVIGATOR_TEST_ID}:preview`}>{model.previewLabel}</Text>}
      </View>

      <TextInput
        testID={TEMPORAL_EXACT_ENTRY_TEST_ID}
        style={styles.entry}
        accessibilityLabel="Exact Moment number"
        accessibilityHint={
          model.exactTargetMaximum === null
            ? 'No conversational position is available yet.'
            : `Enter a Moment number from 1 to ${model.exactTargetMaximum}. This previews the Moment; it does not go to it.`
        }
        value={entry}
        onChangeText={setEntry}
        onSubmitEditing={submitExact}
        returnKeyType="go"
        keyboardType="number-pad"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={9}
      />
      {entryRefused && <Text accessibilityRole="alert">That Moment is not addressable.</Text>}

      <Pressable
        testID={TEMPORAL_COMMIT_TEST_ID}
        style={styles.control}
        accessibilityRole="button"
        accessibilityLabel="Go to the previewed Moment"
        accessibilityState={{ disabled: !model.commitAvailable }}
        disabled={!model.commitAvailable}
        onPress={() => runAction('commit-previewed-moment')}
      >
        <Text>Go to previewed Moment</Text>
      </Pressable>

      <Pressable
        testID={`${TEMPORAL_NAVIGATOR_TEST_ID}:cancel`}
        style={styles.control}
        accessibilityRole="button"
        accessibilityLabel="Cancel the preview"
        accessibilityState={{ disabled: !model.cancelAvailable }}
        disabled={!model.cancelAvailable}
        onPress={() => runAction('cancel-preview')}
      >
        <Text>Cancel preview</Text>
      </Pressable>

      <Pressable
        testID={`${TEMPORAL_NAVIGATOR_TEST_ID}:forward`}
        style={styles.control}
        accessibilityRole="button"
        accessibilityLabel="Preview the next later Moment"
        accessibilityState={{ disabled: !model.forwardAvailable }}
        disabled={!model.forwardAvailable}
        onPress={() => runAction('preview-later-moment')}
      >
        <Text>Preview next Moment</Text>
      </Pressable>

      {/* The Live target is its own control, never the last Moment of the Track: they are different
          Product facts and only this one produces FOLLOW_LIVE. */}
      <Pressable
        testID={TEMPORAL_LIVE_TEST_ID}
        style={styles.control}
        accessibilityRole="button"
        accessibilityLabel="Go to the live edge"
        accessibilityState={{ disabled: !model.liveAvailable }}
        disabled={!model.liveAvailable}
        onPress={() => runAction('commit-live-edge')}
      >
        <Text>Go live</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { flexDirection: 'column' },
  summary: { flexDirection: 'column' },
  entry: { minHeight: 44 },
  control: { minHeight: 44, justifyContent: 'center' },
});
