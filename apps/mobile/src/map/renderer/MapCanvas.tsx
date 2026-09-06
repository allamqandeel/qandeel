/**
 * T-04 — the structural Skia renderer.
 *
 * It exists to prove the world mechanics, not to finish a visual language. Everything it paints
 * is a neutral placeholder: a plain wash, plain circles for entitled objects, plain tethers from
 * a contextual appearance to the Home that hosts it, and a plain strip for identities that have
 * no place. There is no typography, no colour system, no material, no iconography, no motion
 * language, no lifecycle styling and no inspection chrome here — those are Phase VI's and the
 * later chrome tasks', and adding them now would make an unfinished decision look decided.
 *
 * What it does guarantee is truth: it paints exactly the scene derived from `V`, positioned by
 * the same placement function that hit testing uses, offset by the live gesture's Class-D
 * progress, and nothing else. It cannot draw an object the projection did not disclose, because
 * it never receives one.
 */
import { Canvas, Circle, Group, Line, Rect, vec } from '@shopify/react-native-skia';

import type { MapCamera, ViewportEnvelope } from '../camera';
import type { MapScene } from '../projection';
import { placeScene, type PlacedScene } from './map-geometry';
import { DEFAULT_RENDER_STYLE, type RenderStyle } from './render-style';

export const MAP_CANVAS_TEST_ID = 'qandeel-map-canvas';

/** Neutral placeholder palette: grey values only, so nothing here reads as a Product decision. */
const GROUND = 'rgb(246,246,244)';
const AMBIENT = 'rgb(226,226,222)';
const EMPTY_SPACE = 'rgb(208,208,204)';
const HOME_FILL = 'rgb(64,64,62)';
const APPEARANCE_FILL = 'rgb(126,126,122)';
const TETHER = 'rgb(178,178,174)';
const REGISTER_FILL = 'rgb(150,150,146)';

export interface MapCanvasProps {
  readonly scene: MapScene;
  readonly camera: MapCamera;
  readonly envelope: ViewportEnvelope;
  /** Live drag progress in presentation points. Class D: never canonical, discarded on cancel. */
  readonly panTranslationX?: number;
  readonly panTranslationY?: number;
  readonly style?: RenderStyle;
  /** Supplied by a caller that already placed the scene, so paint and hit testing share one placement. */
  readonly placed?: PlacedScene;
}

export function MapCanvas({
  scene,
  camera,
  envelope,
  panTranslationX = 0,
  panTranslationY = 0,
  style = DEFAULT_RENDER_STYLE,
  placed,
}: MapCanvasProps) {
  const placement = placed ?? placeScene(scene, camera, envelope);
  const emptySpaceInset = 24;

  return (
    <Canvas testID={MAP_CANVAS_TEST_ID} style={{ width: envelope.width, height: envelope.height }}>
      <Rect x={0} y={0} width={envelope.width} height={envelope.height} color={GROUND} />
      {/* OPEN-17: the two tunable channels paint, and only paint. */}
      <Rect x={0} y={0} width={envelope.width} height={envelope.height} color={AMBIENT} opacity={style.ambient} />
      <Rect
        x={emptySpaceInset}
        y={emptySpaceInset}
        width={Math.max(0, envelope.width - 2 * emptySpaceInset)}
        height={Math.max(0, envelope.height - 2 * emptySpaceInset)}
        color={EMPTY_SPACE}
        opacity={style.emptySpace * 0.35}
      />
      {/* The world plane follows the live drag; the register does not, because it is screen space. */}
      <Group transform={[{ translateX: panTranslationX }, { translateY: panTranslationY }]}>
        {placement.visibleNodes
          .filter((node) => node.region === 'WORLD_PLANE' && node.locus?.kind === 'CONTEXTUAL_APPEARANCE')
          .map((node) => {
            const host = placement.nodes.find(
              (candidate) =>
                candidate.region === 'WORLD_PLANE' &&
                candidate.locus?.kind === 'THREAD_HOME' &&
                node.locus?.kind === 'CONTEXTUAL_APPEARANCE' &&
                candidate.locus.threadId === node.locus.threadId,
            );
            if (host === undefined) return null;
            return <Line key={`tether:${node.key}`} p1={vec(host.x, host.y)} p2={vec(node.x, node.y)} color={TETHER} strokeWidth={1} />;
          })}
        {placement.visibleNodes
          .filter((node) => node.region === 'WORLD_PLANE')
          .map((node) => (
            <Circle key={node.key} cx={node.x} cy={node.y} r={node.radius} color={node.locus?.kind === 'THREAD_HOME' ? HOME_FILL : APPEARANCE_FILL} />
          ))}
      </Group>
      {placement.visibleNodes
        .filter((node) => node.region === 'UNGEOGRAPHIC_REGISTER')
        .map((node) => (
          <Circle key={node.key} cx={node.x} cy={node.y} r={node.radius} color={REGISTER_FILL} />
        ))}
    </Canvas>
  );
}
