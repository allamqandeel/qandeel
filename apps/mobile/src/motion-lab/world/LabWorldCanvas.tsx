/**
 * T-10.0 MOTION LAB — the Skia plane: ground, the world plane under the presentation camera, the
 * screen-space register, and Exact Return's arrival lock.
 *
 * Structure follows T-04's structural renderer: the world plane is one `Group` that carries the
 * residual camera transform about the viewport centre, the ungeographic register is drawn in
 * screen space outside it, and nothing is painted that the presented set does not contain.
 */
import { useLayoutEffect, useRef } from 'react';
import { Canvas, Group, Rect, RoundedRect, vec } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';

import { envelopeCenter, type MapCamera, type PlacedNode, type ViewportEnvelope } from '../../map';
import type { LabCameraBinding } from '../motion/useLabCamera';
import type { MotionProfile } from '../motion/profiles';
import { hostOf, type PresentedNode } from '../motion/world-presence';
import type { CauseChannel } from '../truth/lab-acts';
import { LAB_INK, LabNode } from './LabNode';

/**
 * Re-bases the residual camera from INSIDE the Skia root, as the last child of the plane.
 *
 * The Skia canvas renders its children in its own React root, and that root commits a few
 * milliseconds after the surface's own commit. A re-base issued from the surface therefore reaches
 * the renderer one paint before the nodes' new positions do, and that paint shows the old positions
 * at the new residual. Issued here, in a layout effect of the same inner commit that writes the
 * positions (siblings run in order, so after them), the residual and the positions land together.
 */
function PlaneRebase({ camera, canonical, channel }: { readonly camera: LabCameraBinding; readonly canonical: MapCamera; readonly channel: CauseChannel }) {
  const lastCamera = useRef<MapCamera | null>(null);
  useLayoutEffect(() => {
    camera.applyCameraChange(lastCamera.current, canonical, channel.last());
    lastCamera.current = canonical;
  }, [camera, canonical, channel]);
  return null;
}

export const LAB_CANVAS_TEST_ID = 'qandeel-motion-lab-canvas';

const GROUND = 'rgb(243,241,235)';
const HORIZON = 'rgb(226,223,214)';

export interface LabWorldCanvasProps {
  readonly envelope: ViewportEnvelope;
  readonly presented: readonly PresentedNode[];
  /**
   * The CURRENT canonical placement, derived in the same render as the camera. Positions are read
   * from here, never from the presented set, so a re-based residual and the new positions reach the
   * screen in one frame; a node that has left the scene keeps the last position the set recorded.
   */
  readonly placedNodes: readonly PlacedNode[];
  readonly camera: LabCameraBinding;
  /** The canonical camera these positions were placed under; drives the re-base inside the Skia root. */
  readonly canonical: MapCamera;
  readonly channel: CauseChannel;
  readonly profile: MotionProfile;
  /** Presented-node keys currently inspected (`IF_ref`), rendered as a ring. */
  readonly inspectedKeys: ReadonlySet<string>;
  readonly ignitionEnabled: boolean;
  /** The preview veil, `1` committed … `0.86` while a preview is open. */
  readonly veil: LabCameraBinding['planeOpacity'];
  readonly onExited: (key: string) => void;
}

interface RippleSource {
  readonly token: number;
  readonly x: number;
  readonly y: number;
}

/** The most recent igniting arrival, for the field profile's ripple. */
function rippleSource(presented: readonly PresentedNode[]): RippleSource | null {
  let latest: PresentedNode | null = null;
  for (const entry of presented) {
    if (entry.ignite && entry.phase === 'ENTERING' && (latest === null || entry.entryToken > latest.entryToken)) latest = entry;
  }
  return latest === null ? null : { token: latest.entryToken, x: latest.node.x, y: latest.node.y };
}

export function LabWorldCanvas({ envelope, presented, placedNodes, camera, canonical, channel, profile, inspectedKeys, ignitionEnabled, veil, onExited }: LabWorldCanvasProps) {
  const center = envelopeCenter(envelope);
  const transform = useDerivedValue(() => {
    const [x, y, s] = camera.planeTransform.get();
    return [{ translateX: x }, { translateY: y }, { scale: s }];
  });
  const lockOpacity = useDerivedValue(() => camera.lock.get() * 0.7);
  const source = profile.ignition.style === 'ripple' ? rippleSource(presented) : null;
  const byKey = new Map(placedNodes.map((node) => [node.key, node] as const));
  /** The node as placed right now, or its last recorded placement while it leaves. */
  const current = (entry: PresentedNode): PresentedNode => {
    const node = byKey.get(entry.key);
    return node === undefined ? entry : { ...entry, node, host: hostOf(node, placedNodes) };
  };

  const rippleFor = (entry: PresentedNode) => {
    if (source === null || entry.ignite || entry.node.region !== 'WORLD_PLANE') return null;
    const distance = Math.hypot(entry.node.x - source.x, entry.node.y - source.y);
    if (distance > profile.ignition.rippleRadiusPoints) return null;
    return { token: source.token, delayMs: Math.round((distance / profile.ignition.rippleRadiusPoints) * 140) };
  };

  return (
    <Canvas testID={LAB_CANVAS_TEST_ID} style={{ width: envelope.width, height: envelope.height }}>
      <Rect x={0} y={0} width={envelope.width} height={envelope.height} color={GROUND} />
      <Rect x={0} y={envelope.height - 1} width={envelope.width} height={1} color={HORIZON} />
      <Group opacity={veil}>
        <Group opacity={camera.planeOpacity}>
          <Group transform={transform} origin={vec(center.x, center.y)}>
            {presented
              .filter((entry) => entry.node.region === 'WORLD_PLANE')
              .map(current)
              .map((entry) => (
                <LabNode
                  key={entry.key}
                  entry={entry}
                  profile={profile}
                  inverseScale={camera.inverseScale}
                  speed={camera.speed}
                  arrival={camera.arrival}
                  inspected={inspectedKeys.has(entry.key)}
                  ignitionEnabled={ignitionEnabled}
                  ripple={rippleFor(entry)}
                  inPlane
                  onExited={onExited}
                />
              ))}
            <PlaneRebase camera={camera} canonical={canonical} channel={channel} />
          </Group>
        </Group>
      </Group>
      {presented
        .filter((entry) => entry.node.region === 'UNGEOGRAPHIC_REGISTER')
        .map(current)
        .map((entry) => (
          <LabNode
            key={entry.key}
            entry={entry}
            profile={profile}
            inverseScale={camera.inverseScale}
            speed={camera.speed}
            arrival={camera.arrival}
            inspected={inspectedKeys.has(entry.key)}
            ignitionEnabled={ignitionEnabled}
            ripple={null}
            inPlane={false}
            onExited={onExited}
          />
        ))}
      <RoundedRect x={6} y={6} width={envelope.width - 12} height={envelope.height - 12} r={14} color={LAB_INK} style="stroke" strokeWidth={1.5} opacity={lockOpacity} />
    </Canvas>
  );
}
