/**
 * T-06 — the accessible temporal routes as real native View semantics.
 *
 * Every action here reaches Product truth through the same addressability gate, the same preview
 * controller and the same commit boundary as the pointer route. None of them needs a drag, a
 * precision pointer or a coordinate of any kind: exact targeting is typed as a Session Position,
 * forward continuation is a repeatable single step, and preview, commit, cancel and the Live target
 * are named actions.
 *
 * The T-07 return acts are deliberately absent even though a final accessibility architecture will
 * want them: they remain later-owner metadata, and offering an action this task cannot honour would
 * be a promise rather than a route.
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
    <View
      testID={TEMPORAL_NAVIGATOR_TEST_ID}
      style={styles.surface}
      accessible
      accessibilityRole="none"
      accessibilityLabel={model.surfaceLabel}
      accessibilityValue={{ text: temporalAnnouncement(model) }}
      accessibilityActions={model.actions.map((action) => ({ name: action.name, label: action.label }))}
      onAccessibilityAction={(event: AccessibilityActionEvent) => runAction(event.nativeEvent.actionName)}
    >
      {/* Committed truth and the preview are separate statements. The preview never overwrites the
          committed sentence, and it always says that it is a preview. */}
      <Text testID={`${TEMPORAL_NAVIGATOR_TEST_ID}:stance`}>{model.stanceLabel}</Text>
      {model.previewLabel !== null && <Text testID={`${TEMPORAL_NAVIGATOR_TEST_ID}:preview`}>{model.previewLabel}</Text>}

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
  entry: { minHeight: 44 },
  control: { minHeight: 44, justifyContent: 'center' },
});
