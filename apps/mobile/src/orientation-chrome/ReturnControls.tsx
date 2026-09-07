/**
 * T-08 — the return acts that are meaningful right now, as Product controls.
 *
 * Each control reaches exactly ONE T-07 executor. There is no shared handler that decides between
 * them from a payload, no generic `navigate(id)`, no router call and no store dispatch: a reader who
 * presses "follow the live conversation" runs `returnLiveHead` and can run nothing else, and the
 * mapping is a `switch` with one call per arm so it is readable as a proof rather than as a lookup.
 *
 * The Preview is not cancelled here. T-06 froze the precedence and T-07 already applies it inside
 * every executor, so duplicating it would create a second cancellation with its own ordering bugs.
 * This component holds no preview state and never calls the controller.
 *
 * ## Context-sensitive, not a toolbar
 *
 * Only the acts the model says are meaningful are rendered. A permanent six-control matrix would
 * present the whole vocabulary of the system as though every part of it were a live choice, which is
 * the dashboard drift the Product contract forbids. The six MEANINGS are untouched by that: each
 * keeps its own identity, effect, promises and wording, and none is ever merged into a generic act.
 *
 * Every input to "is this meaningful" is knowledge-safe, so the offered SET is knowledge-safe too:
 * two viewpoints that differ only in a Live Focus this position cannot disclose render an identical
 * tree, because the Live Focus act is absent from both.
 *
 * ## One accessible route, not two claimed ones
 *
 * Each control is its own native button, which is the route a screen reader actually reaches. The
 * group is a plain layout `View`: it is deliberately not an accessibility element, so it must not
 * also advertise custom actions — a non-focusable container's actions are not a discoverable route,
 * and claiming them as one would document behaviour React Native does not provide. The buttons give
 * full parity on their own, so the redundant group actions are simply not there.
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import { RETURN_CONTROLS_LABEL } from './product-copy';
import type { ReturnChrome, ReturnOpportunity, ReturnOpportunityId } from './types';

export const RETURN_CONTROLS_TEST_ID = 'qandeel-return-controls';

export interface ReturnControlsProps {
  readonly surface: ReturnSurface;
  readonly orientation: ReturnChrome;
  /**
   * The projection of the viewpoint the reader is standing on, when one is currently held and
   * proven. Return to Live Focus needs it; every other act ignores it entirely.
   */
  readonly context: MapInspectionContext | null;
  /**
   * The target behind an offered Exact Return, already resolved against this store's lifecycle.
   * `null` whenever the act is not offered, so there is nothing here to press.
   */
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
      // Only an offered act is reachable. The executors would refuse or no-op anyway; refusing here
      // means a control that is not on screen has no route at all.
      if (!orientation.offered.some((candidate) => candidate.id === id)) return;

      // The act runs FIRST and the observer is notified afterwards. Calling `onOutcome?.(act())`
      // would not evaluate its argument at all when no observer is attached, silently turning every
      // control into a no-op — an absent observer must never suppress the act itself.
      let outcome: ReturnOutcome;
      switch (id) {
        case 'BACK_ONE_STEP':
          outcome = backOneStep(surface);
          break;
        case 'EXACT_RETURN': {
          // Bound, never discovered, and already proven to belong to this store's own lifecycle.
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

  // Nothing meaningful to offer is a legitimate answer, and an empty group is not a surface.
  if (orientation.offered.length === 0) return null;

  return (
    <View testID={RETURN_CONTROLS_TEST_ID} style={styles.group} accessibilityRole="none" accessibilityLabel={RETURN_CONTROLS_LABEL}>
      {orientation.offered.map((candidate) => (
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
  return (
    <Pressable
      testID={`${RETURN_CONTROLS_TEST_ID}:${opportunity.id}`}
      style={({ pressed }) => [styles.control, pressed ? styles.pressed : null]}
      // Horizontal only. The controls are stacked, so a vertical slop would make adjacent hit areas
      // overlap and turn a near-miss into the wrong act; the 44pt minimum already covers the
      // vertical axis, and the group's own gap keeps the targets apart.
      hitSlop={HORIZONTAL_SLOP}
      accessibilityRole="button"
      accessibilityLabel={opportunity.label}
      accessibilityHint={opportunity.hint}
      onPress={() => onPress(opportunity.id)}
    >
      <Text style={styles.label}>{opportunity.label}</Text>
      <Text style={styles.hint}>{opportunity.hint}</Text>
    </Pressable>
  );
}

/** Slop on the reading axis only; see the control below for why the vertical axis carries none. */
const HORIZONTAL_SLOP = Object.freeze({ left: 8, right: 8 });

const styles = StyleSheet.create({
  // `rowGap` keeps adjacent touch targets at least 8pt apart, which is the platform minimum.
  group: { flexDirection: 'column', rowGap: 8 },
  // `minHeight` rather than `height`, so the control still contains its label at the largest system
  // text size; 44 is the platform minimum for a comfortable target.
  control: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  pressed: { opacity: 0.6 },
  label: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 13 },
});
