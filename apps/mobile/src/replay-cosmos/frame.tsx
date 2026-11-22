/**
 * REPLAY-COSMOS-01 — ONE frame of a Replay's COSMOS stage, at scoped presentation time t: the SAME element tree in the
 * app's `<Canvas>` and in the video's offscreen render, so the two cannot differ in what they draw.
 *
 *   frame(t) = production parts (`../cosmos/skia/parts`) in CosmosCanvas's own five draws — DEEP, GAS × 0.9, every
 *              rung under ONE camera matrix with the production layer opacities, the VEIL in front, the Lens — over the
 *              production prepared stage of the knowledge visible at t (`knowledgeAt`), at the camera the plan gives
 *              for t (`cameraAt`), then the labels the production `placeLabels` lays out for that stage at the plan's
 *              anchor camera, moved exactly as the live LabelLayer moves them.
 *
 * Nothing here is a second engine: no plate, sprite, line or lens is drawn by code of its own; only the camera VALUES
 * come from the Replay plan instead of a gesture. The one addition is the label drawing: Skia paragraphs (so the video
 * carries the same labels the app shows), with the live label's size, colour, weight, opacity, shadow and direction.
 * The typeface is a PO decision (`LabelTypography`); the default keeps the live weights (700 major / 500 ordinary).
 */
import { Fill, Group, Paragraph, Skia, TextAlign, TextDirection, type SkImage, type SkPaint, type SkParagraph, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import type { ReactElement } from 'react';

import type { NasijCamera } from '../cosmos/core/camera';
import { rungScale } from '../cosmos/core/stage';
import { Lens, PlateFill, RungDraws, VOID } from '../cosmos/skia/parts';
import { placeLabels, type PlacedLabel } from '../cosmos/skia/CosmosCanvas';
import type { PreparedStage } from '../cosmos/skia/prepare';
import { depthOfLs, layerAlphaAt, plateMotions, plateOffsetOf, unheldMaskOf } from '../cosmos/skia/worklets';
import { cameraAt, type ReplayCameraPlan } from './camera-plan';
import type { ReplayMomentStage } from './stages';
import { knowledgeAt, type ReplayCosmosTimeline } from './timeline';

const RUNGS = 5;
const LABEL_WIDTH = 240; // CosmosCanvas LABEL_WIDTH
const SHADOW = 'rgba(2, 3, 10, 0.95)'; // CosmosCanvas SHADOW
const ARABIC = /[؀-ۿ]/u;
/** PROPOSED (VG-CP2A): a disclosure fades in over 0.6 s from its own disclosure time, starting visible (never at 0). */
export const REVEAL_MS = 600;
const REVEAL_FLOOR = 0.1;

/**
 * The label typeface — a PO decision (guardrail 1, 2026-11-22), so both are drawable for the side-by-side:
 *  - SYSTEM_LIVE_WEIGHTS: the platform's default family at the live weights 700 / 500 (the live label's own style);
 *  - ESTEDAD_REGULAR_MEDIUM: the bundled QANDEEL Estedad v8.5 statics, Medium 500 for the major label and Regular 400
 *    for the ordinary one — the distinction kept with the two files already shipped (a SemiBold 600 static would be a
 *    NEW asset, identified in the report and not added).
 */
export type LabelTypography = 'SYSTEM_LIVE_WEIGHTS' | 'ESTEDAD_REGULAR_MEDIUM';
export const ESTEDAD_FAMILY_REGULAR = 'QandeelEstedad-Regular';
export const ESTEDAD_FAMILY_MEDIUM = 'QandeelEstedad-Medium';

export interface ReplayFrameImages { readonly deep: SkImage; readonly gas: SkImage; readonly veil: SkImage; readonly atlas: SkImage }
export interface ReplayFrameStage { readonly stage: ReplayMomentStage; readonly prepared: PreparedStage }

export interface ReplayCosmosScene {
  readonly timeline: ReplayCosmosTimeline;
  readonly plan: ReplayCameraPlan;
  /** The prepared stage of every ordinal the timeline draws, and of nothing (`empty`). */
  readonly stages: ReadonlyMap<number, ReplayFrameStage>;
  readonly empty: ReplayFrameStage;
  readonly rtl: boolean;
  readonly fontScale: number;
  readonly typography: LabelTypography;
  /** Required for ESTEDAD_REGULAR_MEDIUM; ignored otherwise. */
  readonly fonts: SkTypefaceFontProvider | null;
}

export interface ReplayFrameFacts {
  readonly t: number;
  readonly camera: NasijCamera;
  readonly anchor: NasijCamera;
  readonly segment: string | null;
  readonly knowledge: number | null;
  readonly previous: number | null;
  readonly mix: number;
}

/** What frame t shows, as facts (for tests and the proof's sidecar). */
export function replayFrameFacts(scene: ReplayCosmosScene, t: number): ReplayFrameFacts {
  const { camera, anchor, segment } = cameraAt(scene.plan, t);
  const knowledge = knowledgeAt(scene.timeline, t);
  let previous: number | null = scene.timeline.initialOrdinal;
  let at = -Infinity;
  for (const step of scene.timeline.steps) {
    if (step.atMs > t) break;
    if (step.ordinal === knowledge) { at = step.atMs; break; }
    previous = step.ordinal;
  }
  const mix = at === -Infinity ? 1 : Math.min(1, REVEAL_FLOOR + (1 - REVEAL_FLOOR) * ((t - at) / REVEAL_MS));
  return { t, camera, anchor, segment: segment?.id ?? null, knowledge, previous: mix < 1 ? previous : null, mix };
}

// ── labels ────────────────────────────────────────────────────────────────────────────────────────────────────────

interface LabelPass { readonly anchor: NasijCamera; readonly layouts: readonly { readonly rung: number; readonly scale: number; readonly labels: readonly PlacedLabel[] }[] }

/** The live `labelLayouts` memo for one stage at one anchor camera (no host rail in a Replay world). */
function labelPassOf(stage: ReplayMomentStage, anchor: NasijCamera, width: number, height: number, fontScale: number, rtl: boolean): LabelPass {
  const list = stage.list;
  const resting = Math.min(list.layers.length - 1, Math.max(0, Math.round(Math.log(anchor.scale) / Math.log(8))));
  const layouts = list.layers.filter((l) => l.labels.length > 0).map((layer) => {
    const scale = layer.rung === resting ? anchor.scale : rungScale(layer.rung);
    return { rung: layer.rung, scale, labels: placeLabels(layer.labels, layer.rung, scale, anchor, width, height, height / 2, fontScale, rtl, { fit: true }) };
  }).filter((l) => l.labels.length > 0);
  return { anchor, layouts };
}

const passes = new WeakMap<ReplayMomentStage, Map<string, LabelPass>>();
function cachedPass(stage: ReplayMomentStage, anchor: NasijCamera, width: number, height: number, fontScale: number, rtl: boolean): LabelPass {
  let byAnchor = passes.get(stage);
  if (byAnchor === undefined) { byAnchor = new Map(); passes.set(stage, byAnchor); }
  const key = `${anchor.cx}|${anchor.cy}|${anchor.scale}|${width}|${height}|${fontScale}|${rtl}`;
  let pass = byAnchor.get(key);
  if (pass === undefined) { pass = labelPassOf(stage, anchor, width, height, fontScale, rtl); byAnchor.set(key, pass); }
  return pass;
}

const paragraphs = new Map<string, SkParagraph>();
const providers = new WeakMap<SkTypefaceFontProvider, number>();
let providerSerial = 0;
function paragraphOf(label: PlacedLabel, scene: ReplayCosmosScene): SkParagraph {
  const fonts = scene.typography === 'ESTEDAD_REGULAR_MEDIUM' ? scene.fonts : null;
  let pid = 0;
  if (fonts !== null) { pid = providers.get(fonts) ?? 0; if (pid === 0) { providerSerial += 1; pid = providerSerial; providers.set(fonts, pid); } }
  const key = `${scene.typography}|${pid}|${label.text}|${label.size}|${label.color}|${label.major}|${scene.fontScale}`;
  let p = paragraphs.get(key);
  if (p === undefined) {
    const rtl = ARABIC.test(label.text);
    const style = { textAlign: TextAlign.Center, textDirection: rtl ? TextDirection.RTL : TextDirection.LTR, maxLines: 1, ellipsis: '…' };
    const builder = fonts === null ? Skia.ParagraphBuilder.Make(style) : Skia.ParagraphBuilder.Make(style, fonts);
    const alpha = label.major ? 1 : 0.95;
    const color = Skia.Color(label.color); color[3] *= alpha;
    const shadow = Skia.Color(SHADOW); shadow[3] *= alpha;
    const face = fonts === null
      ? { fontStyle: { weight: label.major ? 700 : 500 } }
      : { fontFamilies: [label.major ? ESTEDAD_FAMILY_MEDIUM : ESTEDAD_FAMILY_REGULAR] };
    builder.pushStyle({ ...face, color, fontSize: label.size * scene.fontScale, shadows: [{ color: shadow, blurRadius: label.major ? 12 : 7, offset: { x: 0, y: 0 } }] });
    builder.addText(label.text);
    p = builder.build();
    p.layout(LABEL_WIDTH);
    paragraphs.set(key, p);
  }
  return p;
}

const layerPaints = new Map<number, SkPaint>();
function layerPaint(alpha: number): SkPaint {
  const q = Math.round(alpha * 255);
  let paint = layerPaints.get(q);
  if (paint === undefined) { paint = Skia.Paint(); paint.setAlphaf(q / 255); layerPaints.set(q, paint); }
  return paint;
}

function labelElements(key: string, scene: ReplayCosmosScene, stage: ReplayMomentStage, camera: NasijCamera, anchor: NasijCamera, width: number, height: number, alpha: number): ReactElement[] {
  if (alpha <= 0) return [];
  const pass = cachedPass(stage, anchor, width, height, scene.fontScale, scene.rtl);
  const s = camera.scale; const depth = depthOfLs(Math.log(s)); const unheld = unheldMaskOf(stage.held);
  const focusX = width / 2; const focusY = height / 2;
  const out: ReactElement[] = [];
  for (const layout of pass.layouts) {
    const opacity = layerAlphaAt(depth, RUNGS, unheld, layout.rung) * alpha;
    if (opacity <= 0.001) continue;
    // The live LabelLayer's transform, about the view's centre.
    const sc = s / layout.scale;
    const tx = focusX + (pass.anchor.cx - camera.cx) * s - width / 2;
    const ty = focusY + (pass.anchor.cy - camera.cy) * s + (height / 2 - focusY) * sc - height / 2;
    out.push(
      <Group key={`${key}:${layout.rung}`} transform={[{ translateX: width / 2 + tx }, { translateY: height / 2 + ty }, { scale: sc }, { translateX: -width / 2 }, { translateY: -height / 2 }]}
        layer={opacity < 0.999 ? layerPaint(opacity) : undefined}>
        {layout.labels.map((label) => <Paragraph key={label.id} paragraph={paragraphOf(label, scene)} x={label.left} y={label.top} width={LABEL_WIDTH} />)}
      </Group>,
    );
  }
  return out;
}

// ── the frame ─────────────────────────────────────────────────────────────────────────────────────────────────────

function rungsOf(key: string, frame: ReplayFrameStage, depth: number, alpha: number, atlas: SkImage, hair: number): ReactElement[] {
  const unheld = unheldMaskOf(frame.stage.held);
  return frame.prepared.rungs.map((layer) => (
    <RungDraws key={`${key}:${layer.rung}`} layer={layer} atlas={atlas} mode="FULL" opacity={layerAlphaAt(depth, RUNGS, unheld, layer.rung) * alpha} hair={hair} />
  ));
}

/**
 * The element tree of frame t, in points, for a `width` × `height` world. `labels: false` draws the world alone (the
 * proof's label-free comparisons). The same call renders in the app's `<Canvas>` and in the export's offscreen root.
 */
export function replayCosmosFrame(scene: ReplayCosmosScene, images: ReplayFrameImages | null, t: number, width: number, height: number, labels = true): ReactElement {
  const facts = replayFrameFacts(scene, t);
  const { camera, anchor } = facts;
  const cur = facts.knowledge === null ? scene.empty : scene.stages.get(facts.knowledge) ?? scene.empty;
  const prev = facts.previous === null ? (facts.mix < 1 ? scene.empty : null) : scene.stages.get(facts.previous) ?? scene.empty;
  if (images === null) return <Fill color={VOID} />;
  const motions = plateMotions(RUNGS);
  const clock = t / 1000; // the atmosphere's drift clock, in seconds — presentation time, never the wall clock
  const ls = Math.log(camera.scale);
  const depth = depthOfLs(ls);
  const focusX = width / 2; const focusY = height / 2;
  const plate = (image: SkImage, m: (typeof motions)['deep']) => {
    const o = plateOffsetOf(camera.cx, camera.cy, ls, focusX, focusY, clock, m.zExp, m.pan, m.driftX, m.driftY, image.width());
    return [{ translateX: o.x }, { translateY: o.y }, { scale: o.k }] as const;
  };
  const s = camera.scale;
  const matrix = [s, 0, focusX - camera.cx * s, 0, s, focusY - camera.cy * s, 0, 0, 1];
  const hair = 1 / s;
  return (
    <Group>
      <PlateFill image={images.deep} transform={[...plate(images.deep, motions.deep)]} additive={false} alpha={1} />
      <PlateFill image={images.gas} transform={[...plate(images.gas, motions.gas)]} additive alpha={0.9} />
      <Group matrix={matrix}>
        {prev === null ? null : rungsOf('prev', prev, depth, 1 - facts.mix, images.atlas, hair)}
        {rungsOf('cur', cur, depth, facts.mix, images.atlas, hair)}
      </Group>
      <PlateFill image={images.veil} transform={[...plate(images.veil, motions.veil)]} additive alpha={1} />
      <Lens width={width} height={height} />
      {!labels ? null : (
        <Group>
          {prev === null ? null : labelElements('prev', scene, prev.stage, camera, anchor, width, height, 1 - facts.mix)}
          {labelElements('cur', scene, cur.stage, camera, anchor, width, height, facts.mix)}
        </Group>
      )}
    </Group>
  );
}
