/**
 * T-04 — the accessible Map as real native View semantics, layered over the same scene the Skia
 * canvas paints. Every action here is a non-drag route to a T-04-owned Map intent, and each one
 * goes through the same executors, the same entitlement resolution and the same canonical store
 * as its pointer equivalent. There is no accessibility-only path to state, and no action is
 * offered that the visual route could not reach.
 *
 * The T-07 return acts are deliberately absent even though a final accessibility architecture
 * will want them: they remain later-owner metadata, and offering an action this task cannot
 * honour would be a promise, not a route.
 *
 * It also enforces the ONE context-freshness rule itself rather than trusting its parent, so a
 * stale projection cannot survive here after it has left the pixels. When the supplied context is
 * no longer the store's `(Session, effective TC, MC.depth)`, NOTHING is derived from that scene —
 * not the object nodes, and not the container's role or label, which are disclosure semantics in
 * their own right. The object set is empty, not hidden, not dimmed, not retained without actions,
 * exactly as the sighted scene is. The viewport routes stay, because they act on the camera rather
 * than on the disclosed world, and they are how a reader brings the camera back to a rung the held
 * projection matches.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';

import { type CanonicalStore } from '../../state';
import { exploreViewport, zoomSemanticStep, type MapCamera, type ViewportEnvelope } from '../camera';
import { mapContextFreshness, type MapObjectFamily } from '../projection';
import {
  decodeInspectionRef,
  directJump,
  entitledLoci,
  inspectObject,
  isCurrentMapContext,
  switchContext,
  type DirectJumpOutcome,
  type MapInspectionContext,
} from '../inspection';
import type { MapActionOutcome } from '../outcome';
import {
  buildMapAccessibilityTree,
  mapAccessibilityWithoutProjection,
  type MapAccessibilityFocus,
  type MapAccessibilityNode,
} from './map-accessibility';

export const MAP_ACCESSIBILITY_TEST_ID = 'qandeel-map-accessibility';

export interface MapAccessibilityLayerProps {
  readonly store: CanonicalStore;
  readonly context: MapInspectionContext;
  readonly camera: MapCamera;
  readonly envelope: ViewportEnvelope;
  readonly onOutcome?: (outcome: MapActionOutcome | DirectJumpOutcome) => void;
}

/** The Map families are exactly the disclosure families of the same name. */
const historicalFamilyOf = (family: MapObjectFamily): 'THREAD' | 'READING' | 'EMERGING_FOCUS' => family;

export function MapAccessibilityLayer({ store, context, camera, envelope, onOutcome }: MapAccessibilityLayerProps) {
  // Subscribed, not sampled: the offered actions depend on the current `IF_ref` and the whole
  // projection tuple, so a tree built from a snapshot taken once at mount would keep offering — or
  // keep withholding — a context switch after the inspection moved, and would keep naming objects
  // of a projection the store has already left. Reading through `useSyncExternalStore` is the T-02
  // kernel's own subscription seam, and it makes this layer correct independently of its parent.
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const inspection = state.inspection;
  // The one shared rule, over the state this component subscribed to.
  const freshness = useMemo(() => mapContextFreshness(state, context), [state, context]);

  const focus: MapAccessibilityFocus | null = useMemo(() => {
    const decoded = decodeInspectionRef(inspection);
    if (decoded === null) return null;
    if (decoded.family !== 'THREAD' && decoded.family !== 'READING' && decoded.family !== 'EMERGING_FOCUS') return null;
    return {
      family: decoded.family,
      id: decoded.id,
      bindingId: decoded.appearance?.kind === 'THREAD_READING' ? decoded.appearance.bindingId : null,
    };
  }, [inspection]);

  // A stale projection produces no scene-derived tree at all — not a scene-derived tree with its
  // nodes removed. The container role and label are disclosure semantics too, so they are built
  // from the scene only while that scene is this Map (R2-FIX-01).
  const tree = useMemo(
    () => (freshness.fresh ? buildMapAccessibilityTree(context.scene, camera, envelope, focus) : mapAccessibilityWithoutProjection()),
    [freshness, context.scene, camera, envelope, focus],
  );

  // The act runs first and the observer is notified afterwards. An optional call would not
  // evaluate its argument at all when no observer is attached, which would silently make the
  // whole accessible route a no-op.
  const runNodeAction = useCallback(
    (node: MapAccessibilityNode, action: string) => {
      // Belt and braces: a stale context exposes no node at all, and were one to reach here it
      // would still change nothing — the executors ask the same rule again.
      if (!isCurrentMapContext(store, context).fresh) return;
      const family = historicalFamilyOf(node.family);
      if (action === 'inspect') {
        const outcome = inspectObject(store, context, { family, id: node.id });
        onOutcome?.(outcome);
        return;
      }
      if (action === 'direct-jump') {
        const outcome = directJump(store, context, { family, id: node.id });
        onOutcome?.(outcome);
        return;
      }
      if (action === 'switch-context') {
        // A deterministic traversal of the object's own disclosed appearances, from the one the
        // current inspection names to the next. Nothing is elected: without a current named
        // context this action is not offered at all.
        const loci = entitledLoci(context.scene, node.family, node.id);
        const current = loci.findIndex((locus) => locus.locus.kind === 'CONTEXTUAL_APPEARANCE' && locus.locus.bindingId === focus?.bindingId);
        if (current < 0) return;
        const next = loci[(current + 1) % loci.length];
        if (next.locus.kind !== 'CONTEXTUAL_APPEARANCE') return;
        const outcome = switchContext(store, context, { family, id: node.id, appearance: { kind: 'THREAD_READING', bindingId: next.locus.bindingId } });
        onOutcome?.(outcome);
      }
    },
    [store, context, focus, onOutcome],
  );

  const runViewportAction = useCallback(
    (action: string) => {
      const outcome =
        action === 'zoom-in'
          ? zoomSemanticStep(store, 'IN')
          : action === 'zoom-out'
            ? zoomSemanticStep(store, 'OUT')
            : action === 'explore-left'
              ? exploreViewport(store, envelope, 'LEFT')
              : action === 'explore-right'
                ? exploreViewport(store, envelope, 'RIGHT')
                : action === 'explore-up'
                  ? exploreViewport(store, envelope, 'UP')
                  : action === 'explore-down'
                    ? exploreViewport(store, envelope, 'DOWN')
                    : null;
      if (outcome !== null) onOutcome?.(outcome);
    },
    [store, envelope, onOutcome],
  );

  return (
    <View
      testID={MAP_ACCESSIBILITY_TEST_ID}
      style={StyleSheet.absoluteFill}
      accessibilityRole={tree.containerRole === 'list' ? 'list' : 'none'}
      accessibilityLabel={tree.containerLabel}
      accessibilityActions={[...tree.viewportActions]}
      onAccessibilityAction={(event: AccessibilityActionEvent) => runViewportAction(event.nativeEvent.actionName)}
    >
      {tree.nodes.map((node) => (
        <View
          key={node.key}
          testID={`${MAP_ACCESSIBILITY_TEST_ID}:${node.key}`}
          accessible
          accessibilityRole={node.role}
          accessibilityLabel={node.label}
          accessibilityActions={[...node.actions]}
          onAccessibilityAction={(event: AccessibilityActionEvent) => runNodeAction(node, event.nativeEvent.actionName)}
        />
      ))}
    </View>
  );
}
