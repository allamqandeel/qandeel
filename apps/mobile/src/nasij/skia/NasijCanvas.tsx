// NASIJ (experimental, isolated) — the Skia host of the cloth.
//
// THE POINT OF THE EXPERIMENT. One `<Canvas>`. The camera lives only in Reanimated shared values on the UI thread:
// a fixed world anchor (wx, wy), where that anchor is on the glass (sx, sy) and ls = ln(scale). A pan moves (sx, sy); a
// pinch re-anchors to the world point under the fingers and changes ls; a settle animates (sx, sy, ls) with one timing
// curve. No React render and no JS-thread work happens per frame during a gesture or a settle: the matrix, each layer's
// opacity, the weave and the labels' transform are all derived on the UI thread from those values.
//
// The geometry is prepared once per draw list (one static SkPath per batch) and only transformed afterwards. There is
// no saveLayer, no image filter, no blur and no per-entity React node in the canvas. A frame at rest (and while
// panning) makes TWO full-screen passes, the opaque weave and the lantern, then the border's batches and ONE layer's.
//
// This host decides nothing. When the fingers lift it reports what they did; the parent asks the production authority
// for the canonical act and answers with `settleTo(canonicalCamera, focusY)`.

import { Canvas, Fill, FilterMode, Group, ImageShader, MipmapMode, Path, RadialGradient, Rect, type SkImage } from '@shopify/react-native-skia';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, PixelRatio, Pressable, StyleSheet, Text, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import type { NasijCamera } from '../core/camera';
import type { NasijPalette } from '../core/palette';
import type { NasijDrawList, NasijLabel } from '../core/scene';
import { WEAVE_TILE_PX, disposePrepared, disposeWeave, makeWeaveTile, prepareCloth, withAlpha, type PreparedBatch, type PreparedCloth } from './prepare';
import { SETTLE_BEZIER, SETTLE_MS, clampLs, depthOfLs, groundAlphaAt, layerAlphaAt, mod, stepForLs, unheldMaskOf, weaveOctaveAt } from './worklets';

export interface NasijFrameStats { readonly count: number; readonly p50: number; readonly p95: number; readonly max: number; readonly fps: number }

export interface NasijSettleOptions {
  /**
   * Keep the current anchor (the world point a pinch left under the fingers) instead of re-anchoring to the target's
   * centre. Right for a canonical step ABOUT those fingers: the anchor then does not move on the glass at all.
   */
  readonly keepAnchor?: boolean;
}

export interface NasijCanvasHandle {
  /** Ease the presentation camera to the canonical one; `focusY` is where the camera's centre is drawn. */
  settleTo(target: NasijCamera, focusY: number, options?: NasijSettleOptions): void;
  /** The same, without motion (a new world, a first layout). */
  jumpTo(target: NasijCamera, focusY: number): void;
  /** Frame pacing of the last gesture and its settle, measured on the UI thread. */
  readFrameStats(): NasijFrameStats;
}

export interface NasijCanvasProps {
  readonly list: NasijDrawList;
  /** Which rungs the host holds data for (Personal), or null when every rung is held. */
  readonly held: readonly boolean[] | null;
  /** The canonical rung: whose marks the accessibility layer offers. */
  readonly rung: number;
  readonly palette: NasijPalette;
  readonly night: boolean;
  readonly rtl: boolean;
  readonly initialCamera: NasijCamera;
  /** One completed drag. */
  readonly onPanEnd: (camera: NasijCamera) => void;
  /** One completed pinch: the step its ratio asks for (or none), the point the fingers held, and the camera at release. */
  readonly onPinchEnd: (direction: 'IN' | 'OUT' | null, focalX: number, focalY: number, camera: NasijCamera) => void;
  readonly onTap: (x: number, y: number, camera: NasijCamera) => void;
  /** The settle finished (or was instant): the presentation camera IS the target now. */
  readonly onSettled?: (camera: NasijCamera) => void;
  readonly onViewSize?: (width: number, height: number) => void;
  // Accessibility.
  readonly accessibilityLabel: string;
  readonly zoomInLabel: string;
  readonly zoomOutLabel: string;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly labelOf: (id: string) => string;
  readonly onActivate: (id: string) => void;
}

const FRAME_RING = 240;
const LABEL_WIDTH = 260;
const LABEL_MAX_CHARS = 34;
const MAX_LABELS_PER_RUNG = 80;
const MAX_ACCESSIBLE_MARKS = 60;

type Camera3 = { readonly cx: number; readonly cy: number; readonly scale: number };
interface CameraValues {
  readonly wx: SharedValue<number>; readonly wy: SharedValue<number>;
  readonly sx: SharedValue<number>; readonly sy: SharedValue<number>;
  readonly ls: SharedValue<number>;
}
interface RungValues { readonly rungs: SharedValue<number>; readonly unheld: SharedValue<number> }

// ── canvas parts ──────────────────────────────────────────────────────────────────────────────────────────────────

const Batches = memo(function Batches({ batches, colors }: { readonly batches: readonly PreparedBatch[]; readonly colors: NasijPalette['colors'] }) {
  return (
    <>
      {batches.map((batch) => (batch.style === 'fill'
        ? <Path key={batch.key} path={batch.path} color={colors[batch.color]} opacity={batch.alpha} />
        : <Path key={batch.key} path={batch.path} color={colors[batch.color]} opacity={batch.alpha} style="stroke" strokeWidth={batch.width} />))}
    </>
  );
});

/** One rung's layer: static paths under one opacity derived on the UI thread. */
function ClothLayer({ rung, batches, colors, ls, rungs, unheld }: { readonly rung: number; readonly batches: readonly PreparedBatch[]; readonly colors: NasijPalette['colors'] } & Pick<CameraValues, 'ls'> & RungValues) {
  const opacity = useDerivedValue(() => layerAlphaAt(depthOfLs(ls.get()), rungs.get(), unheld.get(), rung));
  return <Group opacity={opacity}><Batches batches={batches} colors={colors} /></Group>;
}

/** One octave of the woven ground: a single tiled fill. */
function WeaveOctave({ image, which, wx, wy, sx, sy, ls }: { readonly image: SkImage; readonly which: 0 | 1 } & CameraValues) {
  const transform = useDerivedValue(() => {
    const s = Math.exp(ls.get());
    const period = weaveOctaveAt(ls.get(), which).spacing * s;
    // The weave is periodic, so only the offset inside one repeat is kept: the shader never sees a large translation.
    return [{ translateX: mod(sx.get() - wx.get() * s, period) }, { translateY: mod(sy.get() - wy.get() * s, period) }, { scale: period / WEAVE_TILE_PX }];
  });
  const opacity = useDerivedValue(() => weaveOctaveAt(ls.get(), which).alpha);
  return (
    <Fill opacity={opacity}>
      <ImageShader image={image} tx="repeat" ty="repeat" transform={transform} sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }} />
    </Fill>
  );
}

// ── labels (React Native text, moved on the UI thread) ────────────────────────────────────────────────────────────

interface PlacedLabel { readonly id: string; readonly text: string; readonly left: number; readonly top: number; readonly emphasis: boolean }

/** The labels of one rung near the settled camera, overlaps rejected greedily with the selection first. */
function placeLabels(labels: readonly NasijLabel[], rung: number, camera: Camera3, width: number, height: number, focusY: number, fontScale: number): PlacedLabel[] {
  const k = Math.pow(8, rung);
  const out: PlacedLabel[] = [];
  const taken: [number, number, number, number][] = [];
  const ordered = [...labels].sort((a, b) => Number(b.emphasis) - Number(a.emphasis));
  for (const label of ordered) {
    if (out.length >= MAX_LABELS_PER_RUNG) break;
    // Where the label sits on the glass when this rung is at rest around the settled camera.
    const px = (label.x - camera.cx) * k + width / 2;
    const py = (label.y - camera.cy) * k + focusY;
    if (px < -1.5 * width || px > 2.5 * width || py < -1.5 * height || py > 2.5 * height) continue;
    const text = label.text.length > LABEL_MAX_CHARS ? `${label.text.slice(0, LABEL_MAX_CHARS - 1)}…` : label.text;
    const size = (label.emphasis ? 15 : 13) * fontScale;
    const w = Math.min(LABEL_WIDTH, text.length * size * 0.56 + 16);
    const box: [number, number, number, number] = [px - w / 2 - 4, py - 2, px + w / 2 + 4, py + size + 10];
    if (!label.emphasis && taken.some((t) => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1])) continue;
    taken.push(box);
    out.push({ id: label.id, text, left: label.x * k - LABEL_WIDTH / 2, top: label.y * k, emphasis: label.emphasis });
  }
  return out;
}

const LabelLayer = memo(function LabelLayer({ rung, labels, palette, rtl, wx, wy, sx, sy, ls, rungs, unheld }: {
  readonly rung: number; readonly labels: readonly PlacedLabel[]; readonly palette: NasijPalette; readonly rtl: boolean;
} & CameraValues & RungValues) {
  const k0 = Math.pow(8, rung);
  const style = useAnimatedStyle(() => {
    const s = Math.exp(ls.get());
    return {
      opacity: layerAlphaAt(depthOfLs(ls.get()), rungs.get(), unheld.get(), rung),
      transform: [{ translateX: sx.get() - wx.get() * s }, { translateY: sy.get() - wy.get() * s }, { scale: s / k0 }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.labelLayer, style]}>
      {labels.map((label) => (
        <View key={label.id} style={[styles.labelBox, { left: label.left, top: label.top }]}>
          <Text
            allowFontScaling
            numberOfLines={1}
            accessible={false}
            importantForAccessibility="no"
            style={[styles.label, {
              color: palette.text, backgroundColor: withAlpha(toRgba(palette.colors.ground), 0.72), writingDirection: rtl ? 'rtl' : 'ltr',
              fontSize: label.emphasis ? 15 : 13, fontWeight: label.emphasis ? '600' : '500',
            }]}
          >
            {label.text}
          </Text>
        </View>
      ))}
    </Animated.View>
  );
});

/** `#rrggbb` as `rgba(r, g, b, 1)` (the palette's solid colours are hex). */
function toRgba(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 1)`;
}

// ── ownership: every Skia object made here is released here ───────────────────────────────────────────────────────

/**
 * Owns a Skia resource for as long as it is the current one. It is released a moment AFTER it stops being current, so
 * the canvas has committed the tree that no longer draws it; a resource that becomes current again inside that moment
 * (an effect replayed by React) is simply kept.
 */
function useOwned<T extends object>(value: T | null, release: (value: T) => void): void {
  const pending = useRef(new Map<T, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    if (value === null) return undefined;
    const waiting = pending.current;
    const timer = waiting.get(value);
    if (timer !== undefined) { clearTimeout(timer); waiting.delete(value); }
    return () => {
      waiting.set(value, setTimeout(() => { waiting.delete(value); release(value); }, 1500));
    };
  }, [value, release]);
}

/** The host's call-time state: the latest props, the settle's target and sequence, and whether the probe runs. */
function createHost(initial: NasijCanvasProps) {
  let props = initial;
  let target: { camera: Camera3; focusY: number | null } = { camera: initial.initialCamera, focusY: null };
  let settling = false;
  let seq = 0;
  let probing = false;
  return {
    bind(next: NasijCanvasProps) { props = next; },
    props: () => props,
    target: () => target,
    settling: () => settling,
    /** A new target: returns the sequence number its completion must present. */
    aim(camera: Camera3, focusY: number, animated: boolean) { seq += 1; settling = animated; target = { camera, focusY }; return seq; },
    /** A gesture took the cloth: any completion still in flight is stale. */
    interrupt() { seq += 1; settling = false; },
    /** True when `n` is the current settle, which is then over. */
    finish(n: number) { if (n !== seq) return false; settling = false; return true; },
    beginProbe() { if (probing) return false; probing = true; return true; },
    endProbe() { if (!probing) return false; probing = false; return true; },
  };
}

// ── the host ──────────────────────────────────────────────────────────────────────────────────────────────────────

export const NasijCanvas = forwardRef<NasijCanvasHandle, NasijCanvasProps>(function NasijCanvas(props, ref) {
  const { list, held, rung, palette, night, rtl, initialCamera } = props;
  const reduceMotion = useReducedMotion();

  // The camera, on the UI thread.
  const wx = useSharedValue(initialCamera.cx);
  const wy = useSharedValue(initialCamera.cy);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const ls = useSharedValue(Math.log(initialCamera.scale));
  /** Where the lantern is centred (it travels with the focus point in the same animation). */
  const lanternY = useSharedValue(0);
  /** Where the camera's centre is drawn once settled: what "the camera" means when the fingers lift. */
  const focusYTarget = useSharedValue(0);
  const vw = useSharedValue(0);
  const vh = useSharedValue(0);
  const rungs = useSharedValue(list.layers.length);
  const unheld = useSharedValue(unheldMaskOf(held));
  // Gesture bookkeeping, on the UI thread.
  const active = useSharedValue(0);
  const pinched = useSharedValue(0);
  const lsAtGestureStart = useSharedValue(0);
  const lsAtPinchStart = useSharedValue(0);
  // The frame-pacing probe's ring buffer, on the UI thread.
  const frames = useSharedValue<number[]>(new Array<number>(FRAME_RING).fill(0));
  const frameCount = useSharedValue(0);
  const camera: CameraValues = useMemo(() => ({ wx, wy, sx, sy, ls }), [wx, wy, sx, sy, ls]);

  useEffect(() => { rungs.set(list.layers.length); unheld.set(unheldMaskOf(held)); }, [list.layers.length, held, rungs, unheld]);

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [settled, setSettled] = useState<{ camera: Camera3; focusY: number }>({ camera: initialCamera, focusY: 0 });
  // What the callbacks reach at call time (never during render): the latest props and the settle's bookkeeping.
  const [host] = useState(() => createHost(props));
  useLayoutEffect(() => { host.bind(props); }, [host, props]);

  // ── the probe ───────────────────────────────────────────────────────────────────────────────────────────────────
  const probe = useFrameCallback((info) => {
    'worklet';
    const dt = info.timeSincePreviousFrame;
    if (dt === null || dt === undefined) return;
    const at = frameCount.get() % FRAME_RING;
    frames.modify((ring) => { 'worklet'; ring[at] = dt; return ring; });
    frameCount.set(frameCount.get() + 1);
  }, false);
  const startProbe = useCallback(() => {
    // A gesture took the cloth: whatever settle was running is over, and a new measurement begins.
    host.interrupt();
    frameCount.set(0);
    if (host.beginProbe()) probe.setActive(true);
  }, [frameCount, host, probe]);
  const stopProbe = useCallback(() => {
    if (host.endProbe()) probe.setActive(false);
  }, [host, probe]);
  useEffect(() => () => probe.setActive(false), [probe]);

  // ── UI thread → JS, once per gesture ────────────────────────────────────────────────────────────────────────────
  const emitPanEnd = useCallback((cx: number, cy: number, scale: number) => host.props().onPanEnd({ cx, cy, scale }), [host]);
  const emitPinchEnd = useCallback((step: number, fx: number, fy: number, cx: number, cy: number, scale: number) =>
    host.props().onPinchEnd(step > 0 ? 'IN' : step < 0 ? 'OUT' : null, fx, fy, { cx, cy, scale }), [host]);
  const emitTap = useCallback((x: number, y: number, cx: number, cy: number, scale: number) => host.props().onTap(x, y, { cx, cy, scale }), [host]);
  const emitSettled = useCallback((seq: number) => {
    if (!host.finish(seq)) return;
    stopProbe();
    const at = host.target();
    const done = { camera: at.camera, focusY: at.focusY ?? 0 };
    setSettled(done);
    host.props().onSettled?.(done.camera);
  }, [host, stopProbe]);

  // ── settle and jump ─────────────────────────────────────────────────────────────────────────────────────────────
  const jump = useCallback((to: Camera3, focusY: number) => {
    const seq = host.aim(to, focusY, false);
    scheduleOnUI((cx: number, cy: number, scale: number, fy: number, n: number) => {
      'worklet';
      cancelAnimation(sx); cancelAnimation(sy); cancelAnimation(ls); cancelAnimation(lanternY);
      wx.set(cx); wy.set(cy); sx.set(vw.get() / 2); sy.set(fy); ls.set(Math.log(scale));
      lanternY.set(fy); focusYTarget.set(fy);
      scheduleOnRN(emitSettled, n);
    }, to.cx, to.cy, to.scale, focusY, seq);
  }, [emitSettled, focusYTarget, host, lanternY, ls, sx, sy, vw, wx, wy]);

  const settle = useCallback((to: Camera3, focusY: number, options?: NasijSettleOptions) => {
    const now = host.target();
    // The same target while its settle is still running: let the one animation finish rather than restart its curve.
    if (host.settling() && now.focusY === focusY && now.camera.cx === to.cx && now.camera.cy === to.cy && now.camera.scale === to.scale) return;
    const seq = host.aim(to, focusY, true);
    if (host.beginProbe()) { frameCount.set(0); probe.setActive(true); }
    const duration = reduceMotion ? 0 : SETTLE_MS;
    scheduleOnUI((cx: number, cy: number, scale: number, fy: number, n: number, ms: number, keepAnchor: boolean) => {
      'worklet';
      if (!keepAnchor) {
        // Re-anchor to the destination: it then travels in a straight line to the focus point while the scale eases.
        const s = Math.exp(ls.get());
        const nsx = sx.get() + (cx - wx.get()) * s;
        const nsy = sy.get() + (cy - wy.get()) * s;
        wx.set(cx); wy.set(cy); sx.set(nsx); sy.set(nsy);
      }
      const tsx = vw.get() / 2 + (wx.get() - cx) * scale;
      const tsy = fy + (wy.get() - cy) * scale;
      focusYTarget.set(fy);
      if (ms <= 0) {
        sx.set(tsx); sy.set(tsy); ls.set(Math.log(scale)); lanternY.set(fy);
        scheduleOnRN(emitSettled, n);
        return;
      }
      const curve = { duration: ms, easing: Easing.bezier(SETTLE_BEZIER[0], SETTLE_BEZIER[1], SETTLE_BEZIER[2], SETTLE_BEZIER[3]) };
      sx.set(withTiming(tsx, curve));
      sy.set(withTiming(tsy, curve));
      lanternY.set(withTiming(fy, curve));
      ls.set(withTiming(Math.log(scale), curve, (finished) => {
        'worklet';
        if (finished === true) scheduleOnRN(emitSettled, n);
      }));
    }, to.cx, to.cy, to.scale, focusY, seq, duration, options?.keepAnchor === true);
  }, [emitSettled, focusYTarget, frameCount, host, lanternY, ls, probe, reduceMotion, sx, sy, vw, wx, wy]);

  const readFrameStats = useCallback((): NasijFrameStats => {
    const n = Math.min(frameCount.get(), FRAME_RING);
    if (n === 0) return { count: 0, p50: 0, p95: 0, max: 0, fps: 0 };
    const sorted = frames.get().slice(0, n).sort((a, b) => a - b);
    const mean = sorted.reduce((sum, v) => sum + v, 0) / n;
    return { count: n, p50: sorted[Math.floor(n / 2)], p95: sorted[Math.min(n - 1, Math.floor(n * 0.95))], max: sorted[n - 1], fps: mean > 0 ? 1000 / mean : 0 };
  }, [frameCount, frames]);

  useImperativeHandle(ref, () => ({ settleTo: settle, jumpTo: jump, readFrameStats }), [settle, jump, readFrameStats]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    vw.set(width); vh.set(height);
    setSize((previous) => (previous !== null && previous.width === width && previous.height === height ? previous : { width, height }));
    // A new glass: the camera is where it was, redrawn around the new centre. Class D; nothing canonical moves.
    const at = host.target();
    jump(at.camera, at.focusY ?? height / 2);
    host.props().onViewSize?.(width, height);
  }, [host, jump, vh, vw]);

  // ── gestures: worklets that only move the shared values ─────────────────────────────────────────────────────────
  const gesture = useMemo(() => {
    const begin = () => {
      'worklet';
      if (active.get() === 0) {
        cancelAnimation(sx); cancelAnimation(sy); cancelAnimation(ls);
        pinched.set(0);
        lsAtGestureStart.set(ls.get());
        scheduleOnRN(startProbe);
      }
      active.set(active.get() + 1);
    };
    const finish = () => {
      'worklet';
      active.set(Math.max(0, active.get() - 1));
      if (active.get() > 0) return;
      const s = Math.exp(ls.get());
      const cx = wx.get() + (vw.get() / 2 - sx.get()) / s;
      const cy = wy.get() + (focusYTarget.get() - sy.get()) / s;
      if (pinched.get() === 1) scheduleOnRN(emitPinchEnd, stepForLs(ls.get() - lsAtGestureStart.get()), sx.get(), sy.get(), cx, cy, s);
      else scheduleOnRN(emitPanEnd, cx, cy, s);
    };
    const pan = Gesture.Pan().minDistance(8).maxPointers(2)
      .onStart(() => { 'worklet'; begin(); })
      .onChange((event) => { 'worklet'; sx.set(sx.get() + event.changeX); sy.set(sy.get() + event.changeY); })
      .onEnd(() => { 'worklet'; finish(); });
    const pinch = Gesture.Pinch()
      .onStart((event) => {
        'worklet';
        begin();
        // Re-anchor to the world point under the fingers: from here the scale changes about exactly that point.
        const s = Math.exp(ls.get());
        wx.set(wx.get() + (event.focalX - sx.get()) / s);
        wy.set(wy.get() + (event.focalY - sy.get()) / s);
        sx.set(event.focalX); sy.set(event.focalY);
        pinched.set(1);
        lsAtPinchStart.set(ls.get());
      })
      .onChange((event) => { 'worklet'; if (event.scale > 0) ls.set(clampLs(lsAtPinchStart.get() + Math.log(event.scale), rungs.get())); })
      .onEnd(() => { 'worklet'; finish(); });
    const tap = Gesture.Tap().maxDistance(8).maxDuration(400)
      .onEnd((event, success) => {
        'worklet';
        if (!success) return;
        const s = Math.exp(ls.get());
        scheduleOnRN(emitTap, event.x, event.y, wx.get() + (vw.get() / 2 - sx.get()) / s, wy.get() + (focusYTarget.get() - sy.get()) / s, s);
      });
    return Gesture.Exclusive(Gesture.Simultaneous(pan, pinch), tap);
  }, [active, emitPanEnd, emitPinchEnd, emitTap, focusYTarget, ls, lsAtGestureStart, lsAtPinchStart, pinched, rungs, startProbe, sx, sy, vw, wx, wy]);

  // ── owned Skia resources ────────────────────────────────────────────────────────────────────────────────────────
  const cloth: PreparedCloth = useMemo(() => prepareCloth(list), [list]);
  useOwned(cloth, disposePrepared);
  const weave = useMemo(() => makeWeaveTile(palette, night), [palette, night]);
  useOwned(weave, disposeWeave);

  // ── derived drawing values (UI thread) ──────────────────────────────────────────────────────────────────────────
  const matrix = useDerivedValue(() => {
    const s = Math.exp(ls.get());
    return [s, 0, sx.get() - wx.get() * s, 0, s, sy.get() - wy.get() * s, 0, 0, 1];
  });
  const groundOpacity = useDerivedValue(() => groundAlphaAt(ls.get()));
  const lanternCentre = useDerivedValue(() => ({ x: vw.get() / 2, y: lanternY.get() }));
  const lantern = useMemo(() => {
    const strength = night ? 1.9 : 1;
    return {
      colors: [palette.lanternWarm, withAlpha(palette.lanternWarm, 0), withAlpha(palette.lanternShade, 0),
        ...[0.03, 0.09, 0.17, 0.26].map((a) => withAlpha(palette.lanternShade, a * strength))],
      positions: [0, 0.38, 0.38, 0.55, 0.7, 0.85, 1],
    };
  }, [palette, night]);

  // ── labels and the accessible marks: recomputed on settle (and when the list changes), never per frame ──────────
  const fontScale = PixelRatio.getFontScale();
  const labelLayers = useMemo(() => {
    if (size === null) return [];
    return list.layers.filter((layer) => layer.labels.length > 0)
      .map((layer) => ({ rung: layer.rung, labels: placeLabels(layer.labels, layer.rung, settled.camera, size.width, size.height, settled.focusY, fontScale) }));
  }, [list, settled, size, fontScale]);

  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => { if (live) setScreenReader(on); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { live = false; subscription.remove(); };
  }, []);
  const marks = useMemo(() => {
    if (!screenReader || size === null) return [];
    const hits = list.layers[rung]?.hits ?? [];
    const out: { id: string; left: number; top: number; side: number }[] = [];
    for (const hit of hits) {
      if (out.length >= MAX_ACCESSIBLE_MARKS) break;
      const x = (hit.x - settled.camera.cx) * settled.camera.scale + size.width / 2;
      const y = (hit.y - settled.camera.cy) * settled.camera.scale + settled.focusY;
      if (x < 0 || x > size.width || y < 0 || y > size.height) continue;
      const side = Math.max(44, hit.r * 2);
      out.push({ id: hit.id, left: x - side / 2, top: y - side / 2, side });
    }
    return out;
  }, [screenReader, list, rung, settled, size]);

  const onAccessibilityAction = useCallback((event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'zoom-in') host.props().onZoomIn();
    else if (event.nativeEvent.actionName === 'zoom-out') host.props().onZoomOut();
  }, [host]);
  const actions = useMemo(() => [{ name: 'zoom-in', label: props.zoomInLabel }, { name: 'zoom-out', label: props.zoomOutLabel }], [props.zoomInLabel, props.zoomOutLabel]);

  return (
    <View style={styles.root}>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.root}
          collapsable={false}
          onLayout={onLayout}
          accessible
          accessibilityLabel={props.accessibilityLabel}
          accessibilityActions={actions}
          onAccessibilityAction={onAccessibilityAction}
        >
          <Canvas style={StyleSheet.absoluteFill}>
            {/* Full-screen passes are the cost. At rest and while panning there are TWO: the opaque weave (the ground
                is baked into its tile) and the lantern. The plain ground and the finer octave have opacity 0 then,
                which Skia rejects before drawing; they are painted only while a rung transition is in progress. */}
            <Fill color={palette.colors.ground} opacity={weave === null ? 1 : groundOpacity} />
            {weave === null ? null : <WeaveOctave image={weave} which={0} {...camera} />}
            {weave === null ? null : <WeaveOctave image={weave} which={1} {...camera} />}
            {size === null ? null : (
              <Rect x={0} y={0} width={size.width} height={size.height}>
                <RadialGradient c={lanternCentre} r={Math.hypot(size.width, size.height) * 0.62} colors={lantern.colors} positions={lantern.positions} />
              </Rect>
            )}
            <Group matrix={matrix}>
              <Batches batches={cloth.border} colors={palette.colors} />
              {cloth.layers.map((batches, r) => (
                <ClothLayer key={r} rung={r} batches={batches} colors={palette.colors} ls={ls} rungs={rungs} unheld={unheld} />
              ))}
            </Group>
          </Canvas>
          {labelLayers.map((layer) => (
            <LabelLayer key={layer.rung} rung={layer.rung} labels={layer.labels} palette={palette} rtl={rtl} {...camera} rungs={rungs} unheld={unheld} />
          ))}
        </View>
      </GestureDetector>
      {marks.length === 0 ? null : (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {marks.map((mark) => (
            <Pressable
              key={mark.id}
              accessibilityRole="button"
              accessibilityLabel={props.labelOf(mark.id)}
              onPress={() => props.onActivate(mark.id)}
              style={[styles.mark, { left: mark.left, top: mark.top, width: mark.side, height: mark.side }]}
            />
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  labelLayer: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, transformOrigin: 'left top' },
  labelBox: { position: 'absolute', width: LABEL_WIDTH, alignItems: 'center' },
  label: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: 'hidden', textAlign: 'center' },
  mark: { position: 'absolute' },
});
