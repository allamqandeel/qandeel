// COSMOS (experimental, isolated) — the Skia host of the cosmic stage. WRITTEN WITHOUT A DEVICE; never run on one here.
//
// THE POINT OF THE GATE. One `<Canvas>`. The camera lives only in Reanimated shared values on the UI thread: a fixed
// world anchor (wx, wy), where that anchor is on the glass (sx, sy), ls = ln(scale), and fy, the height at which the
// camera's centre is drawn. A pan moves (sx, sy); a pinch re-anchors to the world point under the fingers and changes
// ls; a settle animates (sx, sy, ls, fy) with one timing curve. No React render and no JS-thread work happens per frame
// during a gesture or a settle: the matrix, each rung's opacity, the three plate transforms and the labels' transform
// are all derived on the UI thread from those values.
//
// Per frame, in order: (1) the DEEP plate, one full-screen tiled fill; (2) the GAS plate, additive; (3) under ONE camera
// matrix, per visible rung, ONE atlas draw for all of its sprites (additive), then one stroked path per hairline set
// and, in Shared, the horizon; (4) the VEIL plate in FRONT of the world, additive; (5) the static lens. Everything the
// atlas and the paths need is prepared once per stage (`./prepare`) and only transformed afterwards. There is no
// saveLayer, no image filter, no blur and no per-entity React node in the canvas.
//
// This host decides nothing. When the fingers lift it reports what they did; the parent asks the production authority
// for ONE canonical act and answers with `settleTo(canonicalCamera, focusY)`.
//
// MEASUREMENT (the gate's instrument, built in). A UI-thread frame callback records, while a gesture or its settle is
// in progress, (a) the interval between consecutive frame callbacks and (b) the time from a gesture event to the next
// frame callback, both on the UI runtime's `performance.now()` clock. These are UI-THREAD FRAME-CALLBACK INTERVALS, not
// display-presented frame times, and (b) is NOT touch-to-photon latency: both of those need external capture
// (`experiments/cosmos-proof/measure-honor.sh`, a high-speed camera).

import { Canvas, Fill, Group, useImage, type SkImage, type Transforms3d } from '@shopify/react-native-skia';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, PixelRatio, Pressable, StyleSheet, Text, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import type { NasijCamera } from '../core/camera';
import { rungScale, type Stage, type StageLabel, type WorldKind } from '../core/stage';
import { Lens, PlateFill, RungDraws, VOID, type OverdrawMode } from './parts';
import { disposePrepared, lightRgbOf, prepareStage, type PreparedRung, type PreparedStage } from './prepare';
import {
  SETTLE_BEZIER, SETTLE_MS, clampLs, depthOfLs, layerAlphaAt, percentileOf, plateMotions, plateOffsetOf, stepForLs, uiNow, unheldMaskOf, type PlateMotion,
} from './worklets';

export type { OverdrawMode } from './parts';
export const OVERDRAW_MODES: readonly OverdrawMode[] = ['FULL', 'NO_BODIES', 'PLATES_ONLY'];
/** COSMOS-INT-01: the accessible gesture surface (the stage's semantic step) — the suffix the old world view used. */
export const COSMOS_STEP_TEST_ID_SUFFIX = ':semantic-step';
/** COSMOS-INT-01: one accessible mark (screen reader on): `${testID}${COSMOS_MARK_TEST_ID_INFIX}${entityId}`. */
export const COSMOS_MARK_TEST_ID_INFIX = ':mark:';
export type MotionKind = 'PAN' | 'ZOOM';

/** One gesture and its settle, as the UI thread saw it. See the header: these are frame-callback intervals. */
export interface ProbeResult {
  readonly kind: MotionKind;
  readonly mode: OverdrawMode;
  readonly drift: boolean;
  /** UI-thread frame-callback intervals recorded (at most the ring's size; the latest are kept). */
  readonly frames: number;
  readonly avgFps: number; readonly p50: number; readonly p95: number; readonly max: number;
  /** Intervals longer than 50 ms ("stalls") and longer than 100 ms ("freezes"). */
  readonly stalls: number; readonly freezes: number;
  /** Gesture event → next UI frame callback, in ms (same clock on both ends). */
  readonly inputs: number; readonly inputP50: number; readonly inputP95: number;
}

export interface CosmosSettleOptions {
  /**
   * Keep the current anchor (the world point a pinch left under the fingers) instead of re-anchoring to the target's
   * centre. Right for a canonical step ABOUT those fingers: the anchor then does not move on the glass at all.
   */
  readonly keepAnchor?: boolean;
}

export interface CosmosCanvasHandle {
  /** Ease the presentation camera to `target`; `focusY` is where the camera's centre is drawn. */
  settleTo(target: NasijCamera, focusY: number, options?: CosmosSettleOptions): void;
  /** The same, without motion (a new world, a first layout). */
  jumpTo(target: NasijCamera, focusY: number): void;
}

export interface CosmosCanvasProps {
  readonly world: WorldKind;
  readonly stage: Stage;
  /** Which rungs the host holds data for (Personal), or null when every rung is held. */
  readonly held: readonly boolean[] | null;
  /** The canonical rung: whose marks the accessibility layer offers. */
  readonly rung: number;
  readonly rtl: boolean;
  readonly initialCamera: NasijCamera;
  readonly mode: OverdrawMode;
  /** The slow drift of the atmosphere at rest. Off under Reduce Motion whatever this says. */
  readonly drift: boolean;
  /** Measurement only: draw into a SurfaceView (its own compositor layer) instead of the default TextureView. */
  readonly opaqueSurface?: boolean;
  /** One completed drag. */
  readonly onPanEnd: (camera: NasijCamera) => void;
  /** One completed pinch: the step its ratio asks for (or none), the point the fingers held, and the camera at release. */
  readonly onPinchEnd: (direction: 'IN' | 'OUT' | null, focalX: number, focalY: number, camera: NasijCamera) => void;
  readonly onTap: (x: number, y: number, camera: NasijCamera) => void;
  /** The settle finished (or was instant): the presentation camera IS the target now. */
  readonly onSettled?: (camera: NasijCamera) => void;
  readonly onViewSize?: (width: number, height: number) => void;
  /** After each gesture and its settle. */
  readonly onProbe?: (result: ProbeResult) => void;
  /** Once per mount: the first UI frame after a NON-EMPTY stage and its images were committed to the canvas. */
  readonly onFirstStageFrame?: () => void;
  // Accessibility.
  readonly accessibilityLabel: string;
  readonly zoomInLabel: string;
  readonly zoomOutLabel: string;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly labelOf: (id: string) => string;
  readonly onActivate: (id: string) => void;
  /**
   * COSMOS-INT-01: false when the host lays a production accessibility layer over the stage (the Personal Map's, with
   * its inspect / switch-context / direct-jump and viewport actions); the stage then offers no mark and no action of
   * its own, so one object is never two nodes. Default true: the stage's own marks, as proven.
   */
  readonly accessibleMarks?: boolean;
  /** COSMOS-INT-01: the host's test id; the accessible gesture surface is `${testID}:semantic-step`, a mark `${testID}:mark:${id}`. */
  readonly testID?: string;
}

const FRAME_RING = 600;
const INPUT_RING = 256;
const LABEL_WIDTH = 240;
const LABEL_MAX_CHARS = 34;
const MAX_LABELS_PER_RUNG = 60;
/**
 * COSMOS E-2 corrections, Slice D-1 (PO directive 2026-11-20 §7): how far an ordinary label may be moved inward from
 * its body so that it is drawn whole near a side of the glass. Beyond this it is left out (whole or not at all), never
 * displaced: a name must stay on its body through a pan, so it is never pushed into another region.
 */
const LABEL_EDGE_SHIFT_MAX = 16;
const MAX_ACCESSIBLE_MARKS = 60;
const SHADOW = 'rgba(2, 3, 10, 0.95)';

type Camera3 = { readonly cx: number; readonly cy: number; readonly scale: number };
interface CameraValues {
  readonly wx: SharedValue<number>; readonly wy: SharedValue<number>;
  readonly sx: SharedValue<number>; readonly sy: SharedValue<number>;
  readonly ls: SharedValue<number>;
}
interface RungValues { readonly rungs: SharedValue<number>; readonly unheld: SharedValue<number> }

// ── the prepared atmosphere: nine small images baked at build time, loaded by the canvas that draws them ──────────────
const PLATES: Readonly<Record<WorldKind, { readonly deep: number; readonly gas: number; readonly veil: number }>> = {
  PERSONAL: { deep: require('../assets/personal-deep.jpg'), gas: require('../assets/personal-gas.jpg'), veil: require('../assets/personal-veil.jpg') },
  SHARED: { deep: require('../assets/shared-deep.jpg'), gas: require('../assets/shared-gas.jpg'), veil: require('../assets/shared-veil.jpg') },
  PUBLIC: { deep: require('../assets/public-deep.jpg'), gas: require('../assets/public-gas.jpg'), veil: require('../assets/public-veil.jpg') },
};
const LIGHT_ATLAS: number = require('../assets/light-atlas.png');

// ── canvas parts ──────────────────────────────────────────────────────────────────────────────────────────────────

/** One atmosphere plate: its transform is derived on the UI thread from the camera, the focus and the clock. */
function Plate({ image, motion, additive, alpha, wx, wy, sx, sy, ls, fy, vw, clock }: {
  readonly image: SkImage; readonly motion: PlateMotion; readonly additive: boolean; readonly alpha: number;
  readonly fy: SharedValue<number>; readonly vw: SharedValue<number>; readonly clock: SharedValue<number>;
} & CameraValues) {
  const pixels = image.width();
  const { zExp, pan, driftX, driftY } = motion;
  const transform = useDerivedValue<Transforms3d>(() => {
    const s = Math.exp(ls.get());
    // The camera's centre: the world point drawn at the view focus (vw / 2, fy).
    const cx = wx.get() + (vw.get() / 2 - sx.get()) / s;
    const cy = wy.get() + (fy.get() - sy.get()) / s;
    const at = plateOffsetOf(cx, cy, ls.get(), vw.get() / 2, fy.get(), clock.get(), zExp, pan, driftX, driftY, pixels);
    return [{ translateX: at.x }, { translateY: at.y }, { scale: at.k }];
  });
  return <PlateFill image={image} transform={transform} additive={additive} alpha={alpha} />;
}

/** One rung under one opacity derived on the UI thread. */
const RungLayer = memo(function RungLayer({ layer, atlas, mode, ls, rungs, unheld }: {
  readonly layer: PreparedRung; readonly atlas: SkImage | null; readonly mode: OverdrawMode;
} & Pick<CameraValues, 'ls'> & RungValues) {
  const rung = layer.rung;
  const opacity = useDerivedValue(() => layerAlphaAt(depthOfLs(ls.get()), rungs.get(), unheld.get(), rung));
  // The horizon is a hairline at every depth: one point wide whatever the scale.
  const hair = useDerivedValue(() => 1 / Math.exp(ls.get()));
  return <RungDraws layer={layer} atlas={atlas} mode={mode} opacity={opacity} hair={hair} />;
});

// ── labels (React Native text, moved on the UI thread) ────────────────────────────────────────────────────────────

interface PlacedLabel { readonly id: string; readonly text: string; readonly left: number; readonly top: number; readonly size: number; readonly major: boolean; readonly color: string }
interface LabelLayout { readonly rung: number; /** The scale this rung's labels were laid out at. */ readonly scale: number; readonly labels: readonly PlacedLabel[] }

const ARABIC = /[\u0600-\u06FF]/u;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * The labels of one rung around the anchor camera (the camera the current settle is aimed at), as they sit on the glass
 * when that rung rests at `scale`.
 * The gate's rules: a hub's title first, then the selection; a label is drawn whole or not at all (one whose entity is
 * within 24 pt of an edge is left out); overlaps are rejected greedily. Labels up to 1.5 screens away are kept, so a
 * pan brings them in; one that would be cut by the edge at rest is not.
 *
 * Slice D-1 (2026-11-20): an ordinary label is moved inward by at most `LABEL_EDGE_SHIFT_MAX` to be drawn whole;
 * one that would need more is left out rather than drawn away from its body (the hub's title keeps the full inward
 * move: it is the selected subject, and it is drawn whole wherever its body is in view). Exported for its tests only.
 */
export function placeLabels(labels: readonly StageLabel[], rung: number, scale: number, camera: Camera3, width: number, height: number, focusY: number, fontScale: number, rtl: boolean): PlacedLabel[] {
  const k = scale / rungScale(rung);
  const out: PlacedLabel[] = [];
  const taken: [number, number, number, number][] = [];
  const railLeft = rtl ? 50 : 10; const railRight = rtl ? 10 : 50;
  const weight = (l: StageLabel) => Number(l.emphasis) + Number(l.major) * 2;
  for (const label of [...labels].sort((a, b) => weight(b) - weight(a))) {
    if (out.length >= MAX_LABELS_PER_RUNG) break;
    let px = (label.x - camera.cx) * scale + width / 2;
    const py = (label.y - camera.cy) * scale + focusY;
    if (px < -1.5 * width || px > 2.5 * width || py < -1.5 * height || py > 2.5 * height) continue;
    const size = label.major ? clamp(23 * Math.pow(k, 0.6), 15, 30) : clamp(12.5 * Math.pow(k, 0.6), 10.5, 17);
    const text = label.text.length > LABEL_MAX_CHARS ? `${label.text.slice(0, LABEL_MAX_CHARS - 1)}…` : label.text;
    // No text measurement off the UI: an estimate of the drawn width, generous enough to keep neighbours apart.
    const w = Math.min(LABEL_WIDTH, text.length * size * fontScale * 0.58 + 8);
    const inView = px >= 0 && px <= width && py >= 0 && py <= height;
    if (inView) {
      if (px < 24 || px > width - 24 || py < 96 || py > height - 40) continue;
      const whole = clamp(px, Math.min(w / 2 + railLeft, width / 2), Math.max(width - w / 2 - railRight, width / 2));
      if (!label.major && Math.abs(whole - px) > LABEL_EDGE_SHIFT_MAX) continue;
      px = whole;
    }
    const box: [number, number, number, number] = [px - w / 2 - 5, py - 2, px + w / 2 + 5, py + size * fontScale + 5];
    if (!inView && box[0] < width && box[2] > 0 && box[1] < height && box[3] > 0) continue;
    if (!label.emphasis && !label.major && taken.some((q) => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1])) continue;
    taken.push(box);
    out.push({ id: label.id, text, left: px - LABEL_WIDTH / 2, top: py, size, major: label.major, color: label.tint < 0 ? '#FFFFFF' : lightRgbOf(label.tint) });
  }
  return out;
}

/**
 * One rung's labels: ONE animated view. Its children sit where they are at rest; the view is moved and scaled about its
 * centre on the UI thread so that every label follows its world point exactly.
 */
const LabelLayer = memo(function LabelLayer({ layout, origin, focusY, width, height, wx, wy, sx, sy, ls, rungs, unheld }: {
  readonly layout: LabelLayout; readonly origin: Camera3; readonly focusY: number; readonly width: number; readonly height: number;
} & CameraValues & RungValues) {
  const { rung, scale: laid } = layout;
  const ox = origin.cx; const oy = origin.cy;
  const style = useAnimatedStyle(() => {
    const s = Math.exp(ls.get());
    const sc = s / laid;
    return {
      opacity: layerAlphaAt(depthOfLs(ls.get()), rungs.get(), unheld.get(), rung),
      transform: [
        { translateX: sx.get() + (ox - wx.get()) * s - width / 2 },
        { translateY: sy.get() + (oy - wy.get()) * s + (height / 2 - focusY) * sc - height / 2 },
        { scale: sc },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.labelLayer, { width, height }, style]}>
      {layout.labels.map((label) => (
        <View key={label.id} style={[styles.labelBox, { left: label.left, top: label.top }]}>
          <Text
            allowFontScaling
            numberOfLines={1}
            accessible={false}
            importantForAccessibility="no"
            style={[styles.label, {
              color: label.color, fontSize: label.size, fontWeight: label.major ? '700' : '500', opacity: label.major ? 1 : 0.95,
              textShadowRadius: label.major ? 12 : 7, writingDirection: ARABIC.test(label.text) ? 'rtl' : 'ltr',
            }]}
          >
            {label.text}
          </Text>
        </View>
      ))}
    </Animated.View>
  );
});

// ── ownership: every Skia object made here is released here ───────────────────────────────────────────────────────

/**
 * Owns a Skia resource for as long as it is the current one. It is released a moment AFTER it stops being current, so
 * the canvas has committed the tree that no longer draws it; a resource that becomes current again inside that moment
 * (an effect replayed by React) is simply kept. On unmount everything still pending is released by its timer.
 */
function useOwned<T extends object>(value: T | null, release: (value: T) => void): void {
  const pending = useRef(new Map<T, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    if (value === null) return undefined;
    const waiting = pending.current;
    const timer = waiting.get(value);
    if (timer !== undefined) { clearTimeout(timer); waiting.delete(value); }
    return () => {
      waiting.set(value, setTimeout(() => { waiting.delete(value); release(value); }, 1200));
    };
  }, [value, release]);
}

/** The host's call-time state: the latest props and the settle's target and sequence. */
function createHost(initial: CosmosCanvasProps) {
  let props = initial;
  let target: { camera: Camera3; focusY: number | null } = { camera: initial.initialCamera, focusY: null };
  let settling = false;
  let seq = 0;
  let firstFrame = false;
  return {
    bind(next: CosmosCanvasProps) { props = next; },
    props: () => props,
    target: () => target,
    settling: () => settling,
    /** A new target: returns the sequence number its completion must present. */
    aim(camera: Camera3, focusY: number, animated: boolean) { seq += 1; settling = animated; target = { camera, focusY }; return seq; },
    /** A gesture took the world: any completion still in flight is stale. */
    interrupt() { seq += 1; settling = false; },
    /** True when `n` is the current settle, which is then over. */
    finish(n: number) { if (n !== seq) return false; settling = false; return true; },
    /** True the first time only. */
    claimFirstFrame() { if (firstFrame) return false; firstFrame = true; return true; },
  };
}

/** Write one slot of a ring that lives on the UI thread. */
function ringWrite(ring: SharedValue<number[]>, at: number, value: number): void {
  'worklet';
  ring.modify((values) => {
    'worklet';
    values[at] = value;
    return values;
  });
}

// ── the host ──────────────────────────────────────────────────────────────────────────────────────────────────────

export const CosmosCanvas = forwardRef<CosmosCanvasHandle, CosmosCanvasProps>(function CosmosCanvas(props, ref) {
  const { world, stage, held, rung, rtl, initialCamera, mode, drift } = props;
  const reduceMotion = useReducedMotion();

  // The camera, on the UI thread.
  const wx = useSharedValue(initialCamera.cx);
  const wy = useSharedValue(initialCamera.cy);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const ls = useSharedValue(Math.log(initialCamera.scale));
  /** Where the camera's centre is drawn (it travels in the same animation as the camera). */
  const fy = useSharedValue(0);
  /** Where it is drawn once settled: what "the camera" means when the fingers lift. */
  const fyTarget = useSharedValue(0);
  const vw = useSharedValue(0);
  const vh = useSharedValue(0);
  const rungs = useSharedValue(stage.layers.length);
  const unheld = useSharedValue(unheldMaskOf(held));
  /** 0 → 1 over each settle; its completion is the settle's. */
  const settleT = useSharedValue(1);
  // Gesture bookkeeping, on the UI thread.
  const active = useSharedValue(0);
  const pinched = useSharedValue(0);
  /** 1 while two fingers are pinching (the pinch gesture is live); `pinched` stays 1 until the whole gesture ends. */
  const pinching = useSharedValue(0);
  const focalLastX = useSharedValue(0);
  const focalLastY = useSharedValue(0);
  const lsAtGestureStart = useSharedValue(0);
  const lsAtPinchStart = useSharedValue(0);
  // The atmosphere's clock (seconds), advanced per frame while the drift is on.
  const clock = useSharedValue(0);
  const driftOn = useSharedValue(0);
  // The probe, on the UI thread.
  const probing = useSharedValue(0);
  const probeSkip = useSharedValue(0);
  const probeKind = useSharedValue(0); // 0 undecided, 1 PAN, 2 ZOOM
  const frames = useSharedValue<number[]>(new Array<number>(FRAME_RING).fill(0));
  const frameCount = useSharedValue(0);
  const inputs = useSharedValue<number[]>(new Array<number>(INPUT_RING).fill(0));
  const inputCount = useSharedValue(0);
  const pendingInput = useSharedValue(0);
  const firstArm = useSharedValue(0);
  const camera: CameraValues = useMemo(() => ({ wx, wy, sx, sy, ls }), [wx, wy, sx, sy, ls]);

  useEffect(() => { rungs.set(stage.layers.length); unheld.set(unheldMaskOf(held)); }, [stage.layers.length, held, rungs, unheld]);
  useEffect(() => { driftOn.set(drift && !reduceMotion ? 1 : 0); }, [drift, reduceMotion, driftOn]);

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  /**
   * The anchor the labels and the accessible marks are laid out around: the camera the current settle is AIMED at (and
   * the glass's focus line there). Slice D-1 (2026-11-20): it is set when a settle or a jump is aimed, not when the
   * settle completes, so a label never waits for an uninterrupted 320 ms rest to be laid out where its body now is;
   * the UI-thread transform keeps every laid-out label on its world point in between, exactly as before.
   */
  const [settled, setSettled] = useState<{ camera: Camera3; focusY: number }>({ camera: initialCamera, focusY: 0 });
  const anchorTo = useCallback((camera: Camera3, focusY: number) => {
    setSettled((previous) => (previous.focusY === focusY && previous.camera.cx === camera.cx && previous.camera.cy === camera.cy && previous.camera.scale === camera.scale ? previous : { camera, focusY }));
  }, []);
  // What the callbacks reach at call time (never during render): the latest props and the settle's bookkeeping.
  const [host] = useState(() => createHost(props));
  useLayoutEffect(() => { host.bind(props); }, [host, props]);

  // ── images: owned by their hooks ────────────────────────────────────────────────────────────────────────────────
  const deep = useImage(PLATES[world].deep);
  const gas = useImage(PLATES[world].gas);
  const veil = useImage(PLATES[world].veil);
  const atlas = useImage(LIGHT_ATLAS);
  const motions = useMemo(() => plateMotions(stage.layers.length), [stage.layers.length]);

  // ── the frame callback: the drift's clock and the probe. It never touches React. ────────────────────────────────
  const emitFirstFrame = useCallback(() => { if (host.claimFirstFrame()) host.props().onFirstStageFrame?.(); }, [host]);
  useFrameCallback((info) => {
    'worklet';
    const dt = info.timeSincePreviousFrame;
    if (dt === null || dt === undefined) return;
    if (driftOn.get() === 1) clock.set(clock.get() + Math.min(0.05, dt / 1000));
    if (pendingInput.get() > 0) {
      // Both stamps are `performance.now()` on this runtime: the gesture callback's, and now.
      const waited = uiNow() - pendingInput.get();
      pendingInput.set(0);
      if (probing.get() === 1 && waited >= 0) {
        ringWrite(inputs, inputCount.get() % INPUT_RING, waited);
        inputCount.set(inputCount.get() + 1);
      }
    }
    if (probing.get() === 1) {
      // The first interval after the probe starts began before the gesture did.
      if (probeSkip.get() === 1) probeSkip.set(0);
      else { ringWrite(frames, frameCount.get() % FRAME_RING, dt); frameCount.set(frameCount.get() + 1); }
    }
    if (firstArm.get() > 0) {
      firstArm.set(firstArm.get() - 1);
      if (firstArm.get() === 0) scheduleOnRN(emitFirstFrame);
    }
  }, true);

  // ── UI thread → JS, once per gesture ────────────────────────────────────────────────────────────────────────────
  const interrupt = useCallback(() => host.interrupt(), [host]);
  const emitPanEnd = useCallback((cx: number, cy: number, scale: number) => host.props().onPanEnd({ cx, cy, scale }), [host]);
  const emitPinchEnd = useCallback((step: number, fx: number, fyAt: number, cx: number, cy: number, scale: number) =>
    host.props().onPinchEnd(step > 0 ? 'IN' : step < 0 ? 'OUT' : null, fx, fyAt, { cx, cy, scale }), [host]);
  const emitTap = useCallback((x: number, y: number, cx: number, cy: number, scale: number) => host.props().onTap(x, y, { cx, cy, scale }), [host]);
  const emitProbe = useCallback((kind: number, count: number, mean: number, p50: number, p95: number, max: number, stalls: number, freezes: number, inputN: number, inputP50: number, inputP95: number) => {
    const now = host.props();
    now.onProbe?.({
      kind: kind === 2 ? 'ZOOM' : 'PAN', mode: now.mode, drift: now.drift, frames: count, avgFps: mean > 0 ? 1000 / mean : 0, p50, p95, max, stalls, freezes,
      inputs: inputN, inputP50, inputP95,
    });
  }, [host]);
  const emitSettled = useCallback((seq: number) => {
    if (!host.finish(seq)) return;
    const at = host.target();
    // The anchor was taken when this settle was aimed; completion only reports it (Slice D-1).
    host.props().onSettled?.(at.camera);
  }, [host]);

  // ── settle and jump ─────────────────────────────────────────────────────────────────────────────────────────────
  const jump = useCallback((to: Camera3, focusY: number) => {
    const seq = host.aim(to, focusY, false);
    anchorTo(to, focusY);
    scheduleOnUI((cx: number, cy: number, scale: number, fyTo: number, n: number) => {
      'worklet';
      cancelAnimation(sx); cancelAnimation(sy); cancelAnimation(ls); cancelAnimation(fy); cancelAnimation(settleT);
      wx.set(cx); wy.set(cy); sx.set(vw.get() / 2); sy.set(fyTo); ls.set(Math.log(scale));
      fy.set(fyTo); fyTarget.set(fyTo); settleT.set(1);
      probing.set(0); probeKind.set(0);
      scheduleOnRN(emitSettled, n);
    }, to.cx, to.cy, to.scale, focusY, seq);
  }, [anchorTo, emitSettled, fy, fyTarget, host, ls, probeKind, probing, settleT, sx, sy, vw, wx, wy]);

  const settle = useCallback((to: Camera3, focusY: number, options?: CosmosSettleOptions) => {
    const now = host.target();
    // The same target while its settle is still running: let the one animation finish rather than restart its curve.
    if (host.settling() && now.focusY === focusY && now.camera.cx === to.cx && now.camera.cy === to.cy && now.camera.scale === to.scale) return;
    const seq = host.aim(to, focusY, true);
    anchorTo(to, focusY);
    const duration = reduceMotion ? 0 : SETTLE_MS;
    scheduleOnUI((cx: number, cy: number, scale: number, fyTo: number, n: number, ms: number, keepAnchor: boolean) => {
      'worklet';
      const lsTo = Math.log(scale);
      if (active.get() > 0) {
        // The fingers are already down again: the world stays under them, and their own release will settle it.
        fyTarget.set(fyTo);
        scheduleOnRN(interrupt);
        return;
      }
      if (!keepAnchor) {
        // Re-anchor to the destination: it then travels in a straight line to the focus point while the scale eases.
        const s = Math.exp(ls.get());
        const nsx = sx.get() + (cx - wx.get()) * s;
        const nsy = sy.get() + (cy - wy.get()) * s;
        wx.set(cx); wy.set(cy); sx.set(nsx); sy.set(nsy);
      }
      const tsx = vw.get() / 2 + (wx.get() - cx) * scale;
      const tsy = fyTo + (wy.get() - cy) * scale;
      fyTarget.set(fyTo);
      const still = Math.abs(tsx - sx.get()) < 0.5 && Math.abs(tsy - sy.get()) < 0.5 && Math.abs(lsTo - ls.get()) < 1e-4 && Math.abs(fyTo - fy.get()) < 0.5;
      const finish = () => {
        'worklet';
        if (probing.get() === 1) {
          const count = Math.min(frameCount.get(), FRAME_RING);
          const sorted = frames.get().slice(0, count).sort((a, b) => a - b);
          let sum = 0; let stalls = 0; let freezes = 0;
          for (let i = 0; i < count; i += 1) { sum += sorted[i]; if (sorted[i] > 50) stalls += 1; if (sorted[i] > 100) freezes += 1; }
          const inputN = Math.min(inputCount.get(), INPUT_RING);
          const waits = inputs.get().slice(0, inputN).sort((a, b) => a - b);
          const kind = probeKind.get() === 0 ? 1 : probeKind.get();
          probing.set(0); probeKind.set(0);
          scheduleOnRN(emitProbe, kind, count, count > 0 ? sum / count : 0, percentileOf(sorted, count, 0.5), percentileOf(sorted, count, 0.95),
            count > 0 ? sorted[count - 1] : 0, stalls, freezes, inputN, percentileOf(waits, inputN, 0.5), percentileOf(waits, inputN, 0.95));
        }
        scheduleOnRN(emitSettled, n);
      };
      if (probing.get() === 0 && still) {
        // Nothing moves and nothing was being measured: place the camera exactly and report no motion.
        sx.set(tsx); sy.set(tsy); ls.set(lsTo); fy.set(fyTo); settleT.set(1);
        scheduleOnRN(emitSettled, n);
        return;
      }
      if (probing.get() === 0) { frameCount.set(0); inputCount.set(0); probeSkip.set(1); probing.set(1); }
      // A pinch is a ZOOM whatever follows; otherwise the motion is a ZOOM when the scale changes and a PAN when not.
      if (probeKind.get() !== 2) probeKind.set(Math.abs(lsTo - ls.get()) > 0.01 ? 2 : 1);
      if (ms <= 0) {
        cancelAnimation(sx); cancelAnimation(sy); cancelAnimation(ls); cancelAnimation(fy); cancelAnimation(settleT);
        sx.set(tsx); sy.set(tsy); ls.set(lsTo); fy.set(fyTo); settleT.set(1);
        finish();
        return;
      }
      const curve = { duration: ms, easing: Easing.bezier(SETTLE_BEZIER[0], SETTLE_BEZIER[1], SETTLE_BEZIER[2], SETTLE_BEZIER[3]) };
      sx.set(withTiming(tsx, curve));
      sy.set(withTiming(tsy, curve));
      ls.set(withTiming(lsTo, curve));
      fy.set(withTiming(fyTo, curve));
      settleT.set(0);
      settleT.set(withTiming(1, curve, (finished) => {
        'worklet';
        if (finished === true) finish();
      }));
    }, to.cx, to.cy, to.scale, focusY, seq, duration, options?.keepAnchor === true);
  }, [active, anchorTo, emitProbe, emitSettled, frameCount, frames, fy, fyTarget, host, inputCount, inputs, interrupt, ls, probeKind, probeSkip, probing, reduceMotion, settleT, sx, sy, vw, wx, wy]);

  useImperativeHandle(ref, () => ({ settleTo: settle, jumpTo: jump }), [settle, jump]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    vw.set(width); vh.set(height);
    setSize((previous) => (previous !== null && previous.width === width && previous.height === height ? previous : { width, height }));
    // A new glass: the camera is where it was, redrawn around the new centre. Presentation only; nothing canonical moves.
    const at = host.target();
    jump(at.camera, at.focusY ?? height / 2);
    host.props().onViewSize?.(width, height);
  }, [host, jump, vh, vw]);

  // ── gestures: worklets that only move the shared values ─────────────────────────────────────────────────────────
  const gesture = useMemo(() => {
    const begin = () => {
      'worklet';
      if (active.get() === 0) {
        // A settle in flight stops where it is. `fy` stays where it had got to (the plates must not jump); what the
        // fingers report when they lift is measured against `fyTarget`, where the camera's centre WILL be drawn.
        cancelAnimation(sx); cancelAnimation(sy); cancelAnimation(ls); cancelAnimation(fy); cancelAnimation(settleT);
        pinched.set(0);
        lsAtGestureStart.set(ls.get());
        // A new measurement begins with the gesture.
        frameCount.set(0); inputCount.set(0); probeSkip.set(1); probeKind.set(0); probing.set(1);
        scheduleOnRN(interrupt);
      }
      active.set(active.get() + 1);
      if (pendingInput.get() === 0) pendingInput.set(uiNow());
    };
    const finish = () => {
      'worklet';
      active.set(Math.max(0, active.get() - 1));
      if (active.get() > 0) return;
      const s = Math.exp(ls.get());
      const cx = wx.get() + (vw.get() / 2 - sx.get()) / s;
      const cy = wy.get() + (fyTarget.get() - sy.get()) / s;
      if (pinched.get() === 1) {
        probeKind.set(2);
        scheduleOnRN(emitPinchEnd, stepForLs(ls.get() - lsAtGestureStart.get()), sx.get(), sy.get(), cx, cy, s);
      } else scheduleOnRN(emitPanEnd, cx, cy, s);
    };
    // The three gestures carry test identifiers so the headless pinch-focus tests can drive them (no runtime effect).
    const pan = Gesture.Pan().withTestId('cosmos-pan').minDistance(8).maxPointers(2).averageTouches(true)
      .onStart(() => { 'worklet'; begin(); })
      .onChange((event) => {
        'worklet';
        if (pendingInput.get() === 0) pendingInput.set(uiNow());
        // While two fingers pinch, the midpoint's travel comes from the pinch's own focal (below), event for event and
        // from the first one; counting the pan's average here as well would move the world twice.
        if (pinching.get() === 1) return;
        sx.set(sx.get() + event.changeX); sy.set(sy.get() + event.changeY);
      })
      .onEnd(() => { 'worklet'; finish(); });
    const pinch = Gesture.Pinch().withTestId('cosmos-pinch')
      .onStart((event) => {
        'worklet';
        begin();
        // Re-anchor to the world point under the fingers: from here the scale changes about exactly that point.
        const s = Math.exp(ls.get());
        wx.set(wx.get() + (event.focalX - sx.get()) / s);
        wy.set(wy.get() + (event.focalY - sy.get()) / s);
        sx.set(event.focalX); sy.set(event.focalY);
        focalLastX.set(event.focalX); focalLastY.set(event.focalY);
        pinched.set(1); pinching.set(1);
        lsAtPinchStart.set(ls.get());
      })
      .onChange((event) => {
        'worklet';
        if (pendingInput.get() === 0) pendingInput.set(uiNow());
        // On Android the pinch handler stays active through the FIRST finger's lift and reports one more update whose
        // focal is the one finger still down (RNGH PinchGestureHandler: focal = detector focus after POINTER_UP; it ends
        // only on ACTION_UP). That is not a midpoint; following it would pan the world by half the fingers' distance
        // at release (HONOR proof, 2026-11-15: a 420 px jump). Only a two-finger focal moves the anchor.
        if (event.numberOfPointers < 2) return;
        // The anchor follows the midpoint: the world point that was under the fingers stays under them as they move,
        // and the scale changes about where they are now (PO finding, 2026-11-15: an off-centre pinch drifted).
        sx.set(sx.get() + (event.focalX - focalLastX.get())); sy.set(sy.get() + (event.focalY - focalLastY.get()));
        focalLastX.set(event.focalX); focalLastY.set(event.focalY);
        if (event.scale > 0) ls.set(clampLs(lsAtPinchStart.get() + Math.log(event.scale), rungs.get()));
      })
      .onEnd(() => { 'worklet'; pinching.set(0); finish(); });
    const tap = Gesture.Tap().withTestId('cosmos-tap').maxDistance(8).maxDuration(400)
      .onEnd((event, success) => {
        'worklet';
        if (!success) return;
        const s = Math.exp(ls.get());
        scheduleOnRN(emitTap, event.x, event.y, wx.get() + (vw.get() / 2 - sx.get()) / s, wy.get() + (fyTarget.get() - sy.get()) / s, s);
      });
    // The first to activate wins: a drag or a pinch cancels the tap, and a completed tap never becomes a drag.
    return Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);
  }, [active, emitPanEnd, emitPinchEnd, emitTap, focalLastX, focalLastY, frameCount, fy, fyTarget, inputCount, interrupt, ls, lsAtGestureStart, lsAtPinchStart, pendingInput, pinched, pinching, probeKind, probeSkip, probing, rungs, settleT, sx, sy, vw, wx, wy]);

  // ── owned Skia resources ────────────────────────────────────────────────────────────────────────────────────────
  // Slice D-1 (2026-11-20): a stage object that compiles to the SAME content (its digest, over sprites, hairlines and
  // label texts) keeps its prepared Skia natives; a Public read that serves the same field again (a focus, a foreground
  // return) no longer rebuilds the atlas instances and re-commits the tree during its settle.
  // The memo is keyed on the digest on purpose: two stage objects with one digest draw the same instances.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prepared: PreparedStage = useMemo(() => prepareStage(stage), [stage.digest, stage.layers.length]);
  useOwned(prepared, disposePrepared);

  // The first frame after a non-empty stage and its images reached the canvas (a proxy for "first drawn": the canvas
  // paints the committed tree on a UI frame, and two frame callbacks are let pass).
  const stageReady = prepared.instanceCount > 0 && deep !== null && atlas !== null && size !== null;
  useEffect(() => {
    if (!stageReady) return;
    scheduleOnUI(() => { 'worklet'; firstArm.set(2); });
  }, [stageReady, firstArm]);

  // ── derived drawing values (UI thread) ──────────────────────────────────────────────────────────────────────────
  const matrix = useDerivedValue(() => {
    const s = Math.exp(ls.get());
    return [s, 0, sx.get() - wx.get() * s, 0, s, sy.get() - wy.get() * s, 0, 0, 1];
  });

  // ── labels and the accessible marks: recomputed when a settle is aimed (and when the stage changes), never per frame ──
  const fontScale = PixelRatio.getFontScale();
  const labelLayouts = useMemo((): LabelLayout[] => {
    if (size === null || mode === 'PLATES_ONLY') return [];
    const resting = clamp(Math.round(Math.log(settled.camera.scale) / Math.log(8)), 0, stage.layers.length - 1);
    return stage.layers.filter((layer) => layer.labels.length > 0).map((layer) => {
      // The rung at rest is laid out at the settled camera's own scale (which differs from the rung's only in the
      // presentation-only overview); the others at their own rung's scale, where they are seen in a cross-fade.
      const scale = layer.rung === resting ? settled.camera.scale : rungScale(layer.rung);
      return { rung: layer.rung, scale, labels: placeLabels(layer.labels, layer.rung, scale, settled.camera, size.width, size.height, settled.focusY, fontScale, rtl) };
    }).filter((layout) => layout.labels.length > 0);
  }, [stage, settled, size, fontScale, rtl, mode]);

  // The accessible marks would take touches from the gesture surface, so they exist only while a screen reader is on.
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => { if (live) setScreenReader(on); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { live = false; subscription.remove(); };
  }, []);
  const standIn = props.accessibleMarks === false;
  const marks = useMemo(() => {
    if (!screenReader || size === null || standIn) return [];
    const hits = stage.layers[rung]?.hits ?? [];
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
  }, [screenReader, stage, rung, settled, size, standIn]);

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
          testID={props.testID === undefined ? undefined : `${props.testID}${COSMOS_STEP_TEST_ID_SUFFIX}`}
          accessible={!standIn}
          accessibilityLabel={props.accessibilityLabel}
          accessibilityActions={standIn ? undefined : actions}
          onAccessibilityAction={standIn ? undefined : onAccessibilityAction}
        >
          <Canvas style={StyleSheet.absoluteFill} opaque={props.opaqueSurface === true}>
            {/* (1) DEEP, opaque; until it has decoded, the void. */}
            {deep === null ? <Fill color={VOID} /> : <Plate image={deep} motion={motions.deep} additive={false} alpha={1} {...camera} fy={fy} vw={vw} clock={clock} />}
            {/* (2) GAS, additive. */}
            {gas === null ? null : <Plate image={gas} motion={motions.gas} additive alpha={0.9} {...camera} fy={fy} vw={vw} clock={clock} />}
            {/* (3) The world, under ONE camera matrix. */}
            {mode === 'PLATES_ONLY' ? null : (
              <Group matrix={matrix}>
                {prepared.rungs.map((layer) => (
                  <RungLayer key={layer.rung} layer={layer} atlas={atlas} mode={mode} ls={ls} rungs={rungs} unheld={unheld} />
                ))}
              </Group>
            )}
            {/* (4) The VEIL passes in FRONT of the world: the sense of being inside the medium. */}
            {veil === null ? null : <Plate image={veil} motion={motions.veil} additive alpha={1} {...camera} fy={fy} vw={vw} clock={clock} />}
            {/* (5) The lens. */}
            {size === null ? null : <Lens width={size.width} height={size.height} />}
          </Canvas>
          {size === null ? null : labelLayouts.map((layout) => (
            <LabelLayer key={layout.rung} layout={layout} origin={settled.camera} focusY={settled.focusY} width={size.width} height={size.height}
              {...camera} rungs={rungs} unheld={unheld} />
          ))}
        </View>
      </GestureDetector>
      {marks.length === 0 ? null : (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {marks.map((mark) => (
            <Pressable
              key={mark.id}
              testID={props.testID === undefined ? undefined : `${props.testID}${COSMOS_MARK_TEST_ID_INFIX}${mark.id}`}
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
  root: { flex: 1, backgroundColor: VOID },
  labelLayer: { position: 'absolute', left: 0, top: 0 },
  labelBox: { position: 'absolute', width: LABEL_WIDTH, alignItems: 'center' },
  label: { textAlign: 'center', textShadowColor: SHADOW, textShadowOffset: { width: 0, height: 0 }, includeFontPadding: false },
  mark: { position: 'absolute' },
});
