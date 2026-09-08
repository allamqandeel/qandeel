/**
 * T-08 — the return acts that are meaningful right now, as Product controls.
 *
 * Each control reaches exactly ONE T-07 executor. There is no shared handler that decides between
 * them from a payload, no generic `navigate(id)`, no router call and no store dispatch: a reader who
 * presses "rejoin the conversation" runs `returnLiveHead` and can run nothing else, and the mapping
 * is a `switch` with one call per arm so it is readable as a proof rather than as a lookup.
 *
 * The decision is made from the frozen IDENTITY alone. The intent and per-dimension promises the
 * model carries are descriptive — they are what the reader is told, never an execution input — so
 * that metadata can never become a second authority over what an act does.
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
 *
 * ## Type
 *
 * Every line height here is ~1.6x its font size. Arabic ascenders, descenders and the marks above
 * and below the baseline clip at the tighter ratios that read acceptably in Latin. The FONT FAMILY
 * is deliberately not set: which families the app loads is an asset decision owned by the
 * integration task, and this component states the assumption rather than silently relying on it —
 * **it assumes the app loads an Arabic-capable family**. No letter spacing and no italics appear
 * anywhere in this layer: both visibly break the connected Arabic script.
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
  returnWorld,
  type ReturnCheckpointTarget,
  type ReturnMapContext,
  type ReturnOutcome,
  type ReturnSurface,
} from '../return-navigation';
import { returnActWords } from './product-copy';
import type { ChromeLanguage, ReturnChrome, ReturnOpportunity, ReturnOpportunityId } from './types';

export const RETURN_CONTROLS_TEST_ID = 'qandeel-return-controls';

export interface ReturnControlsProps {
  readonly surface: ReturnSurface;
  readonly language: ChromeLanguage;
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
   * There is deliberately NO fallback. A built-in "the client holds nothing" provider would keep the
   * control on screen forever while guaranteeing its spatial half could never be attempted — a
   * capability advertised by a surface that does not have it. Without a provider the composite is
   * not offered at all, which is decided in the model from the same fact.
   */
  readonly liveContext?: (request: MapProjectionRequest) => ReturnMapContext;
  /** Observes the executor's own answer. Purely informational; it authorizes nothing. */
  readonly onOutcome?: (id: ReturnOpportunityId, outcome: ReturnOutcome) => void;
  /**
   * How the offered acts are arranged (T-11). An already-decided ARRANGEMENT, never a measurement.
   *
   * This component still reads no width, no breakpoint and no layout: it is told, by the layer that
   * owns responsive recomposition, whether the room it has been given makes a second column
   * truthful. Nothing about the answer depends on it — the same acts, in the same order, with the
   * same words and the same availability, are rendered either way, and both arrangements are
   * direction-neutral so `row` is the reading direction rather than the physical left.
   *
   * `STACKED` is the default because it is the only arrangement that is always truthful.
   */
  readonly arrangement?: 'STACKED' | 'PAIRED';
}

export function ReturnControls({
  surface,
  language,
  orientation,
  context,
  exactReturnTarget,
  liveContext,
  onOutcome,
  arrangement = 'STACKED',
}: ReturnControlsProps) {
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
        case 'GO_LIVE_AND_LOCATE': {
          // The act is offered only where a real provider exists, so this cannot be reached without
          // one. No substitute is manufactured here: a fake attempt is worse than no control.
          if (liveContext === undefined) return;
          outcome = goLiveAndLocate(surface, { liveContext });
          break;
        }
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
    <View
      testID={RETURN_CONTROLS_TEST_ID}
      style={arrangement === 'PAIRED' ? styles.pairedGroup : styles.group}
      // The group itself claims no touch: only the buttons inside it are targets, so every press
      // that misses a control reaches the world beneath rather than being swallowed here.
      //
      // And it carries no accessibility metadata either. On Android an `accessibilityLabel` becomes
      // this ViewGroup's `contentDescription`, which makes TalkBack focus the group and stop
      // traversing into it — the six independent buttons would become one unreadable node. Each
      // control's own label is self-sufficient, so nothing is lost by the group staying silent.
      pointerEvents="box-none"
      accessibilityRole="none"
    >
      {orientation.offered.map((candidate) => (
        <ReturnControl key={candidate.id} language={language} opportunity={candidate} onPress={run} paired={arrangement === 'PAIRED'} />
      ))}
    </View>
  );
}

interface ReturnControlProps {
  readonly language: ChromeLanguage;
  readonly opportunity: ReturnOpportunity;
  readonly onPress: (id: ReturnOpportunityId) => void;
  /** Whether this control shares its row. Layout only: the act, its words and its target are the same. */
  readonly paired: boolean;
}

/**
 * One act, as one control.
 *
 * There is no icon and no glyph anywhere in it. An arrow would encode a direction, and a direction
 * is a claim about where something is — a claim T-08 is never entitled to make, in either reading
 * direction. The label carries the whole meaning, so it survives mirroring unchanged, and nothing
 * about the control is mirrored by meaning because there is nothing directional to mirror.
 *
 * The hint is rendered as well as spoken. For the composite that is not decoration: the conditional
 * half of its promise lives in the hint, and a reader who only saw the label would read a guarantee.
 *
 * The pressed state is a static opacity swap, not an animation: no duration, no easing and no
 * animation driver. Motion is T-10's.
 */
function ReturnControl({ language, opportunity, onPress, paired }: ReturnControlProps) {
  const words = returnActWords(language, opportunity.id);
  return (
    <Pressable
      testID={`${RETURN_CONTROLS_TEST_ID}:${opportunity.id}`}
      style={({ pressed }) => [styles.control, paired ? styles.pairedControl : null, pressed ? styles.pressed : null]}
      // Horizontal only. The controls are stacked, so a vertical slop would make adjacent hit areas
      // overlap and turn a near-miss into the wrong act; the 44pt minimum already covers the
      // vertical axis, and the group's own gap keeps the targets apart. Symmetric, so it is the
      // same target in either reading direction.
      hitSlop={HORIZONTAL_SLOP}
      accessibilityRole="button"
      accessibilityLabel={words.label}
      accessibilityHint={words.hint}
      onPress={() => onPress(opportunity.id)}
    >
      <Text style={styles.label}>{words.label}</Text>
      <Text style={styles.hint}>{words.hint}</Text>
    </Pressable>
  );
}

/** Slop on the reading axis only; see the control above for why the vertical axis carries none. */
const HORIZONTAL_SLOP = Object.freeze({ left: 8, right: 8 });

const styles = StyleSheet.create({
  // `rowGap` keeps adjacent touch targets at least 8pt apart, which is the platform minimum.
  group: { flexDirection: 'column', rowGap: 8 },
  // Two across, when the layer that owns recomposition says the room makes it truthful. `row` is
  // the READING direction — React Native reverses it under a right-to-left layout — so the acts
  // keep their frozen order in both directions and neither the wrapping nor the order is mirrored
  // into a different meaning. Both gaps stay at the 8pt platform minimum between touch targets.
  pairedGroup: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8 },
  // `minHeight` rather than `height`, so the control still contains its label at the largest system
  // text size and under Arabic wording that runs longer than the English; 44 is the platform
  // minimum for a comfortable target. Growing downwards can never overlap a sibling, because the
  // group lays them out in a column with a gap.
  control: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  // A basis under half the row plus the 8pt gap, so exactly two share a line and a third wraps;
  // `flexGrow` lets a lone control on the last line take the whole measure rather than half of it.
  // No `width`, no `maxWidth` and no `numberOfLines`: the cell is a floor for the words, never a
  // ceiling, so the control still grows downwards to contain the longest Arabic wording at the
  // largest text size.
  pairedControl: { flexBasis: '48%', flexGrow: 1 },
  pressed: { opacity: 0.6 },
  label: { fontSize: 15, lineHeight: 24, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 21 },
});
