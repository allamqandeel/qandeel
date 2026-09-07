/**
 * T-08 — the six frozen return acts as six Product controls.
 *
 * Each control reaches exactly ONE T-07 executor. There is no shared handler that decides between
 * them from a payload, no generic `navigate(id)`, no router call and no store dispatch: a reader
 * who presses "follow the live conversation" runs `returnLiveHead` and can run nothing else, and the
 * mapping is a `switch` with one call per arm so it is readable as a proof rather than as a lookup.
 *
 * The Preview is not cancelled here. T-06 froze the precedence and T-07 already applies it inside
 * every executor, so duplicating it would create a second cancellation with its own ordering bugs.
 * This component holds no preview state and never calls the controller.
 *
 * ## Both routes, one executor
 *
 * The pointer route is a `Pressable` per act. The non-pointer route is an accessibility action per
 * act on the container, named by the act's own frozen identity so it needs no index and no ordering
 * assumption. Both call the same function; there is no accessibility-only capability and no
 * accessibility-only entitlement.
 *
 * The container is deliberately NOT `accessible`: marking it so would collapse six independent
 * controls into one element and take the individual actions away from the reader.
 *
 * ## What never moves with live truth
 *
 * Every label, hint, effect and promise is a CONSTANT of the frozen identity. Only `available`
 * varies, and for Return to Live Focus that comes from the projection-bound answer alone. Two
 * viewpoints that differ only in a Live Focus the reader's own `K(TC)` cannot disclose therefore
 * render an identical tree — identical labels, identical hints, identical disabled states, identical
 * accessibility actions — because there is no expression here that could tell them apart.
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';

import type { MapInspectionContext, MapProjectionRequest } from '../map';
import {
  backOneStep,
  exactReturn,
  goLiveAndLocate,
  returnLiveFocus,
  returnLiveHead,
  returnMapContext,
  returnWorld,
  type ReturnCheckpointTarget,
  type ReturnMapContext,
  type ReturnOutcome,
  type ReturnSurface,
} from '../return-navigation';
import type { ReturnChrome, ReturnOpportunity, ReturnOpportunityId } from './types';

export const RETURN_CONTROLS_TEST_ID = 'qandeel-return-controls';

/** The neutral name of the group. It names the controls, never a place or a state of the world. */
export const RETURN_CONTROLS_LABEL = 'Ways back';

export interface ReturnControlsProps {
  readonly surface: ReturnSurface;
  readonly orientation: ReturnChrome;
  /**
   * The projection of the viewpoint the reader is standing on, when one is currently held and
   * proven. Return to Live Focus needs it; every other act ignores it entirely.
   */
  readonly context: MapInspectionContext | null;
  /** An opaque target bound from a real inspection journey, or nothing. Never minted here. */
  readonly exactReturnTarget?: ReturnCheckpointTarget | null;
  /**
   * Resolves the disclosed projection of the LIVE viewpoint for the composite act.
   *
   * When no provider is supplied the default answers with the technical truth — the client holds no
   * disclosure for that viewpoint — through T-07's own public helper. The composite still runs: its
   * temporal half is unaffected, and a delivery gap never becomes a claim that there is nowhere to go.
   */
  readonly liveContext?: (request: MapProjectionRequest) => ReturnMapContext;
  /** Observes the executor's own answer. Purely informational; it authorizes nothing. */
  readonly onOutcome?: (id: ReturnOpportunityId, outcome: ReturnOutcome) => void;
}

const notFetched = (request: MapProjectionRequest): ReturnMapContext => returnMapContext({ status: 'NOT_FETCHED' }, request);

export function ReturnControls({ surface, orientation, context, exactReturnTarget, liveContext, onOutcome }: ReturnControlsProps) {
  const run = useCallback(
    (id: ReturnOpportunityId) => {
      const chosen = orientation.opportunities.find((candidate) => candidate.id === id);
      // An unavailable act is not reachable by either route. The executors would refuse or no-op
      // anyway; refusing here means the accessible route offers exactly what the pointer route does.
      if (chosen === undefined || !chosen.available) return;

      // The act runs FIRST and the observer is notified afterwards. Calling `onOutcome?.(act())`
      // would not evaluate its argument at all when no observer is attached, silently turning every
      // control into a no-op — an absent observer must never suppress the act itself.
      let outcome: ReturnOutcome;
      switch (id) {
        case 'BACK_ONE_STEP':
          outcome = backOneStep(surface);
          break;
        case 'EXACT_RETURN': {
          // Bound, never discovered. Without a legitimate target there is nothing to return to, and
          // nothing is substituted for it.
          if (exactReturnTarget === undefined || exactReturnTarget === null) return;
          outcome = exactReturn(surface, exactReturnTarget);
          break;
        }
        case 'RETURN_LIVE_HEAD':
          outcome = returnLiveHead(surface);
          break;
        case 'RETURN_LIVE_FOCUS': {
          // Spatial only, and only against a projection proven to be this viewpoint's. Without one
          // the act is not offered at all, because its availability came from that same proof.
          if (context === null) return;
          outcome = returnLiveFocus(surface, { context });
          break;
        }
        case 'RETURN_WORLD':
          outcome = returnWorld(surface);
          break;
        case 'GO_LIVE_AND_LOCATE':
          outcome = goLiveAndLocate(surface, { liveContext: liveContext ?? notFetched });
          break;
        default: {
          const exhaustive: never = id;
          return exhaustive;
        }
      }
      onOutcome?.(id, outcome);
    },
    [surface, orientation, context, exactReturnTarget, liveContext, onOutcome],
  );

  const available = orientation.opportunities.filter((candidate) => candidate.available);

  return (
    <View
      testID={RETURN_CONTROLS_TEST_ID}
      style={styles.group}
      // Never `accessible`: six independent controls must stay six independent elements.
      accessibilityRole="none"
      accessibilityLabel={RETURN_CONTROLS_LABEL}
      accessibilityActions={available.map((candidate) => ({ name: candidate.id, label: candidate.label }))}
      onAccessibilityAction={(event: AccessibilityActionEvent) => run(event.nativeEvent.actionName as ReturnOpportunityId)}
    >
      {orientation.opportunities.map((candidate) => (
        <ReturnControl key={candidate.id} opportunity={candidate} onPress={run} />
      ))}
    </View>
  );
}

interface ReturnControlProps {
  readonly opportunity: ReturnOpportunity;
  readonly onPress: (id: ReturnOpportunityId) => void;
}

/**
 * One act, as one control.
 *
 * There is no icon and no glyph anywhere in it. An arrow would encode a direction, and a direction
 * is a claim about where something is — a claim T-08 is never entitled to make, in either reading
 * direction. The label carries the whole meaning, so it survives mirroring unchanged.
 *
 * The pressed state is a static opacity swap, not an animation: no duration, no easing and no
 * animation driver. Motion is T-10's.
 */
function ReturnControl({ opportunity, onPress }: ReturnControlProps) {
  const disabled = !opportunity.available;
  return (
    <Pressable
      testID={`${RETURN_CONTROLS_TEST_ID}:${opportunity.id}`}
      style={({ pressed }) => [styles.control, pressed && !disabled ? styles.pressed : null, disabled ? styles.disabled : null]}
      hitSlop={8}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={opportunity.label}
      accessibilityHint={opportunity.hint}
      // Knowledge-safe: every one of the six always publishes a disabled state, and the state is
      // derived only from facts the reader's own position entitles them to.
      accessibilityState={{ disabled }}
      onPress={() => onPress(opportunity.id)}
    >
      <Text style={styles.label}>{opportunity.label}</Text>
      <Text style={styles.hint}>{opportunity.hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'column' },
  // `minHeight` rather than `height`, so the control still contains its label at the largest system
  // text size; 44 is the platform minimum for a comfortable target.
  control: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  label: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 13 },
});
