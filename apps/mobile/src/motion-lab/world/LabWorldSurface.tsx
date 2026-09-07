/**
 * T-10.0 MOTION LAB — the world surface: the real store, the real preview, the real projection
 * derivation, one presentation camera and one presented set, composed.
 *
 * Truth first, in the same order production keeps it: subscribe to canonical state; decode the
 * camera; derive the context of the effective `TC` (or of `PTC` while a preview is open) through
 * T-04's own context builder and freshness rule; place the scene with T-04's own placement. Only
 * then does the presentation decide how the difference from the previous frame is SHOWN — and it
 * decides that in layout effects, after React has committed the new canonical positions, so the
 * re-based residual and the new positions reach the screen in the same frame.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { MapAccessibilityLayer, decodeCameraIntent, decodeInspectionRef, hitTest, placeScene, type MapCamera, type PlacedNode, type ViewportEnvelope } from '../../map';
import { effectiveTC, type CanonicalStore } from '../../state';
import type { TemporalPreviewController } from '../../temporal-navigation';
import { fadeTo } from '../motion/settle';
import type { MotionProfile } from '../motion/profiles';
import { createBox, useLabCamera, type LabCameraBinding } from '../motion/useLabCamera';
import { classifyChange, presentNodes, removeExited, type PresentedNode } from '../motion/world-presence';
import { describeOutcome, type CauseChannel, type LabActs } from '../truth/lab-acts';
import { currentLabContext, previewLabContext } from '../truth/lab-projection';
import type { LabWorld } from '../truth/lab-world';
import { LabWorldCanvas } from './LabWorldCanvas';

export const LAB_WORLD_SURFACE_TEST_ID = 'qandeel-motion-lab-world';

const EMPTY_NODES: readonly PlacedNode[] = Object.freeze([]);

export interface LabWorldSurfaceProps {
  readonly store: CanonicalStore;
  readonly preview: TemporalPreviewController;
  readonly world: LabWorld;
  readonly profile: MotionProfile;
  readonly envelope: ViewportEnvelope;
  readonly channel: CauseChannel;
  readonly acts: LabActs;
  readonly ignitionEnabled: boolean;
  readonly onStatus: (line: string) => void;
  /** Hands the camera binding up, so scripted scenarios can drive the same paths a finger does. */
  readonly onCamera?: (camera: LabCameraBinding) => void;
}

interface Viewpoint {
  readonly sessionId: string;
  readonly tc: number | null;
  readonly depth: string;
  readonly liveHead: number | null;
}

export function LabWorldSurface({ store, preview, world, profile, envelope, channel, acts, ignitionEnabled, onStatus, onCamera }: LabWorldSurfaceProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const previewSnapshot = useSyncExternalStore(preview.subscribe, preview.getSnapshot);

  const decoded = useMemo(() => decodeCameraIntent(state.camera), [state.camera]);
  const camera: MapCamera | null = decoded.ok ? decoded.camera : null;

  const committed = useMemo(() => currentLabContext(world, state), [world, state]);
  const previewed = useMemo(
    () => (previewSnapshot.status === 'PREVIEWING' ? previewLabContext(world, state, previewSnapshot.ptc) : null),
    [world, state, previewSnapshot],
  );
  const shown = previewed ?? committed;
  const placed = useMemo(() => (shown !== null && camera !== null ? placeScene(shown.scene, camera, envelope) : null), [shown, camera, envelope]);

  // Read at call time by callbacks queued on the UI runtime, so a rerender never splits ownership.
  // State-held boxes rather than refs: the React Compiler lint rejects a ref read from a gesture.
  const [latest] = useState(() => createBox({ profile, committed, placed }));
  useLayoutEffect(() => {
    latest.set({ profile, committed, placed });
  });
  const velocityTracking =
    profile.field.velocityBreath > 0 || profile.field.arrivalBreath > 0 || (profile.travel.settle.kind === 'spring' && profile.travel.settle.carriesVelocity);

  const commitPan = useCallback(
    (translationX: number, translationY: number) => {
      onStatus(describeOutcome(acts.pan(translationX, translationY)));
    },
    [acts, onStatus],
  );

  const onTap = useCallback(
    (point: { readonly x: number; readonly y: number }) => {
      const { committed: context, placed: scene } = latest.get();
      if (context === null || scene === null) return;
      if (previewSnapshot.status === 'PREVIEWING') {
        onStatus('a preview is open: commit it or cancel it before acting on the world');
        return;
      }
      const node = hitTest(scene, point);
      if (node === null) return;
      onStatus(describeOutcome(acts.tap(context, node)));
    },
    [acts, latest, onStatus, previewSnapshot.status],
  );

  const binding = useLabCamera({ envelope, profile: () => latest.get().profile, velocityTracking, commitPan, onTap });
  useLayoutEffect(() => {
    onCamera?.(binding);
  }, [binding, onCamera]);

  // The camera choreography itself is issued from inside the Skia root (`PlaneRebase` in the
  // canvas), in the same inner commit that writes the nodes' positions.

  // The presented set: what is on the plane, and how each arrival or departure is shown.
  const [presented, setPresented] = useState<readonly PresentedNode[]>([]);
  const viewpoint = useRef<Viewpoint | null>(null);
  const token = useRef(0);
  useLayoutEffect(() => {
    const next: Viewpoint = {
      sessionId: state.session.id,
      tc: shown === null ? effectiveTC(state) : shown.scene.tc,
      depth: state.camera.depth,
      liveHead: state.live.LH,
    };
    const liveAdvanced = viewpoint.current !== null && next.liveHead !== viewpoint.current.liveHead && state.temporal.kind === 'FOLLOW_LIVE';
    const change = classifyChange(viewpoint.current, next, liveAdvanced);
    viewpoint.current = next;
    token.current += 1;
    const current = token.current;
    setPresented((previous) => presentNodes(previous, placed === null ? [] : placed.nodes, change, latest.get().profile, current));
  }, [latest, placed, shown, state]);

  const onExited = useCallback((key: string) => {
    setPresented((previous) => removeExited(previous, key));
  }, []);

  // The preview veil: a preview is never drawn at committed weight (T-06's own rule for its
  // marker, applied to the world). Opacity only, so reduced motion keeps it too.
  const veil = useSharedValue(1);
  useLayoutEffect(() => {
    veil.set(fadeTo(previewSnapshot.status === 'PREVIEWING' ? 0.86 : 1, 160));
  }, [previewSnapshot.status, veil]);

  const inspectedKeys = useMemo(() => {
    const ref = decodeInspectionRef(state.inspection);
    const keys = new Set<string>();
    if (ref === null || placed === null) return keys;
    const objectKey = `${ref.family}:${ref.id}`;
    const bindingId = ref.appearance?.kind === 'THREAD_READING' ? ref.appearance.bindingId : null;
    for (const node of placed.nodes) {
      if (node.objectKey !== objectKey) continue;
      if (bindingId === null || (node.locus?.kind === 'CONTEXTUAL_APPEARANCE' && node.locus.bindingId === bindingId)) keys.add(node.key);
    }
    return keys;
  }, [state.inspection, placed]);

  const composed = useMemo(() => Gesture.Exclusive(binding.gesture, binding.tap), [binding.gesture, binding.tap]);

  // The non-drag routes: T-04's own accessible Map over the same committed scene, unchanged. Every
  // act it offers (inspect, direct jump, context switch, semantic zoom, explore) reaches the same
  // executors; the presentation learns of the result through the store exactly as for a tap.
  const onAccessibleOutcome = useCallback(
    (outcome: { readonly outcome: string }) => {
      channel.mark(outcome.outcome === 'CONTEXT_SELECTION_REQUIRED' ? 'INSPECT' : 'DIRECT_JUMP');
      onStatus(`accessible route → ${outcome.outcome}`);
    },
    [channel, onStatus],
  );

  if (camera === null) {
    return <View testID={LAB_WORLD_SURFACE_TEST_ID} style={[styles.surface, { width: envelope.width, height: envelope.height }]} />;
  }

  return (
    <View testID={LAB_WORLD_SURFACE_TEST_ID} style={[styles.surface, { width: envelope.width, height: envelope.height }]}>
      <GestureDetector gesture={composed}>
        <View style={StyleSheet.absoluteFill}>
          <LabWorldCanvas
            envelope={envelope}
            presented={presented}
            placedNodes={placed === null ? EMPTY_NODES : placed.nodes}
            camera={binding}
            canonical={camera}
            channel={channel}
            profile={profile}
            inspectedKeys={inspectedKeys}
            ignitionEnabled={ignitionEnabled}
            veil={veil}
            onExited={onExited}
          />
        </View>
      </GestureDetector>
      {committed !== null ? (
        // Semantics only: the overlay stays in the accessibility tree but takes no pointer, so the
        // gesture route beneath it keeps receiving the hand (on the web renderer an absolutely
        // positioned overlay would otherwise swallow every pointer event).
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <MapAccessibilityLayer store={store} context={committed} camera={camera} envelope={envelope} onOutcome={onAccessibleOutcome} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { overflow: 'hidden' },
});
