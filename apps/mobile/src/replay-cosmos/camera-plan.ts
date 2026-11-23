/**
 * REPLAY-COSMOS-01 — the deterministic ReplayCameraPlan: ONE guided camera, shared by the app and the video.
 *
 * The plan is DATA built once from the scoped timeline and the production stage of each disclosed moment: a list of
 * segments, each justified by ONE disclosure step and aimed only at marks that step (or an earlier one) had already
 * disclosed, and never starting before that step's disclosure time. `cameraAt(plan, t)` is pure: nothing reads a clock,
 * a touch, the export's speed or the reader's pinch, so a seek to t draws what playing to t draws, and the app and the
 * video cannot drift apart. Between segments the camera HOLDS.
 *
 * Ported from the REPLAY-LOCAL-02 proof (camera-plan v1, the van Wijk–Nuij path, ρ = √2). The depth vocabulary is the
 * production COSMOS one (scale 8^rung over the Personal rungs). The live COSMOS camera is not touched and never becomes
 * cinematic: this camera exists only in a Replay.
 *
 * PROPOSED (VG-CP2A): every duration, the ease, the framing margins and the shot vocabulary. A Replay records no
 * inspection, so INSPECT_ANALYTICAL (in the proof) is not planned here.
 */
import { clampScale, type NasijCamera } from '../cosmos/core/camera';
import { rungScale } from '../cosmos/core/stage';
import { markOf, marksOf, type ReplayMomentStage } from './stages';
import type { ReplayCosmosTimeline } from './timeline';

export const CAMERA_PLAN_VERSION = 'REPLAY-COSMOS-01/camera-plan/v1 (van Wijk–Nuij, rho √2; vocabulary PROPOSED, VG-CP2A)';
const RUNGS = 5;

export interface ReplayView { readonly width: number; readonly height: number }
export type ShotKind = 'APPROACH_TOPIC' | 'FRAME_ESTABLISHED_TOPICS' | 'REVEAL_CONNECTION' | 'FOLLOW_CONNECTION' | 'CLOSING_OVERVIEW';

export interface CameraSegment {
  readonly id: string;
  readonly kind: ShotKind;
  /** Scoped ms. */
  readonly t0: number;
  readonly t1: number;
  /** The historical justification: the step (moment ordinal), its disclosure time, and the disclosed marks it is about. */
  readonly source: { readonly ordinal: number; readonly atMs: number; readonly ids: readonly string[] };
  readonly from: NasijCamera;
  readonly to: NasijCamera;
  /** The van Wijk–Nuij path length S (screen-width units). */
  readonly pathS: number;
}

export interface ReplayCameraPlan {
  readonly version: string;
  readonly view: ReplayView;
  readonly initial: NasijCamera;
  readonly segments: readonly CameraSegment[];
  readonly durationMs: number;
}

const easeInOutCubic = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const MARGIN = 56;
const ORIGIN_CAMERA: NasijCamera = { cx: 0, cy: 0, scale: 1 };

function frame(view: ReplayView, points: readonly { x: number; y: number }[], maxScale: number): NasijCamera {
  if (points.length === 0) return ORIGIN_CAMERA;
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const p of points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const w = Math.max(1e-6, maxX - minX); const h = Math.max(1e-6, maxY - minY);
  const s = Math.min(maxScale, (view.width - 2 * MARGIN) / w, (view.height - 2 * MARGIN - 80) / h);
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 + 12 / s, scale: clampScale(s, RUNGS) };
}
const at = (p: { x: number; y: number }, rung: number, yShift = 0): NasijCamera => ({ cx: p.x, cy: p.y + yShift / rungScale(rung), scale: rungScale(rung) });

// van Wijk & Nuij, "Smooth and efficient zooming and panning" (2003).
const RHO = Math.SQRT2;
interface Path { readonly S: number; readonly u1: number; at(s: number): { u: number; w: number } }
function vwnPath(view: ReplayView, a: NasijCamera, b: NasijCamera): Path {
  const w0 = view.width / a.scale; const w1 = view.width / b.scale; const u1 = Math.hypot(b.cx - a.cx, b.cy - a.cy);
  const r2 = RHO * RHO; const r4 = r2 * r2;
  if (u1 < 1e-9 * Math.max(w0, w1)) {
    const k = w1 > w0 ? 1 : -1; const S = Math.abs(Math.log(w1 / w0)) / RHO;
    return { S, u1, at: (s) => ({ u: 0, w: w0 * Math.exp(k * RHO * s) }) };
  }
  const bb = (wi: number, sign: number) => (w1 * w1 - w0 * w0 + sign * r4 * u1 * u1) / (2 * wi * r2 * u1);
  const r = (x: number) => Math.log(-x + Math.sqrt(x * x + 1));
  const R0 = r(bb(w0, 1)); const R1 = r(bb(w1, -1)); const S = (R1 - R0) / RHO;
  return { S, u1, at: (s) => ({ u: (w0 / r2) * (Math.cosh(R0) * Math.tanh(RHO * s + R0) - Math.sinh(R0)), w: (w0 * Math.cosh(R0)) / Math.cosh(RHO * s + R0) }) };
}
/** Duration proportional to the path length (PROPOSED 1 s per unit S), 1.8 s … 6 s. */
const durationFor = (S: number): number => Math.round(Math.min(6000, Math.max(1800, 1000 * S)));

const threadPoints = (stage: ReplayMomentStage): { x: number; y: number }[] =>
  marksOf(stage.list).threads.map((id) => markOf(stage.list, 0, id)).filter((p): p is NonNullable<typeof p> => p !== null);

/**
 * Build the plan. `stages`: the production stage of each ordinal the timeline draws (its opening knowledge included).
 * Rules (PROPOSED vocabulary):
 *  - the scope opens framing the topics its opening knowledge holds, at FAR (or the world's origin when it holds none);
 *  - a step that establishes a topic: APPROACH_TOPIC to it at MID; the 3rd, 6th … topic: FRAME_ESTABLISHED_TOPICS;
 *  - a step that binds a Reading to its Thread (the Personal map's one relation): REVEAL_CONNECTION, FOLLOW_CONNECTION;
 *  - CLOSING_OVERVIEW at FAR once the last step's segments end, if the scope leaves room;
 *  - a segment never starts before its step's disclosure time, nor before the previous segment ends; a segment that
 *    would be cut below 400 ms by the scope's end is not planned (the camera holds instead of jerking).
 */
export function buildReplayCameraPlan(timeline: ReplayCosmosTimeline, stages: ReadonlyMap<number, ReplayMomentStage>, view: ReplayView): ReplayCameraPlan {
  const opening = timeline.initialOrdinal === null ? null : stages.get(timeline.initialOrdinal) ?? null;
  const initial = opening === null ? ORIGIN_CAMERA : frame(view, threadPoints(opening), 1);
  const segments: CameraSegment[] = [];
  let cam = initial; let free = 0; let n = 0;
  const push = (kind: ShotKind, ordinal: number, atMs: number, ids: string[], to: NasijCamera, fixed?: number): void => {
    const t0 = Math.max(atMs, free);
    const path = vwnPath(view, cam, to);
    const t1 = Math.min(timeline.durationMs, t0 + (fixed ?? durationFor(path.S)));
    if (t1 - t0 < 400) return;
    n += 1;
    segments.push({ id: `S${n}`, kind, t0, t1, source: { ordinal, atMs, ids }, from: cam, to, pathS: path.S });
    cam = to; free = t1;
  };
  let before = opening === null ? { threads: [] as readonly string[], readings: [] as readonly string[] } : marksOf(opening.list);
  let last: ReplayMomentStage | null = opening;
  for (const step of timeline.steps) {
    const stage = stages.get(step.ordinal);
    if (stage === undefined) continue;
    const now = marksOf(stage.list);
    const topics = now.threads.filter((id) => !before.threads.includes(id));
    const readings = now.readings.filter((id) => !before.readings.includes(id));
    if (topics.length > 0) {
      const count = now.threads.length;
      if (count >= 3 && count % 3 === 0) {
        push('FRAME_ESTABLISHED_TOPICS', step.ordinal, step.atMs, topics, frame(view, threadPoints(stage), 1.6));
      } else {
        const p = markOf(stage.list, 1, topics[0]);
        if (p !== null) push('APPROACH_TOPIC', step.ordinal, step.atMs, [topics[0]], at(p, 1, 26));
      }
    }
    if (readings.length > 0) {
      const appearance = stage.list.layers[2]?.hits.find((h) => h.id.split('@')[0] === readings[0]) ?? null;
      const hostId = appearance === null ? undefined : stage.hosts.get(appearance.id);
      const host = hostId === undefined ? null : markOf(stage.list, 2, hostId);
      if (appearance !== null && host !== null) {
        push('REVEAL_CONNECTION', step.ordinal, step.atMs, [readings[0]], at(host, 2, 10));
        push('FOLLOW_CONNECTION', step.ordinal, step.atMs, [readings[0]], { cx: (host.x + appearance.x * 2) / 3, cy: (host.y + appearance.y * 2) / 3, scale: rungScale(2) }, 2400);
      }
    }
    before = now; last = stage;
  }
  if (last !== null && timeline.steps.length > 0) {
    const closing = frame(view, threadPoints(last), 1);
    const room = timeline.durationMs - free;
    if (room >= 4000) {
      const step = timeline.steps[timeline.steps.length - 1];
      push('CLOSING_OVERVIEW', step.ordinal, Math.max(step.atMs, timeline.durationMs - 4000), [], closing);
    }
  }
  return { version: CAMERA_PLAN_VERSION, view, initial, segments, durationMs: timeline.durationMs };
}

const paths = new WeakMap<CameraSegment, Path>();

/** The camera at scoped time t (ms), and the camera the current segment is aimed at (the label anchor). Pure. */
export function cameraAt(plan: ReplayCameraPlan, t: number): { readonly camera: NasijCamera; readonly anchor: NasijCamera; readonly segment: CameraSegment | null } {
  let last: CameraSegment | null = null;
  for (const s of plan.segments) {
    if (t < s.t0) break;
    if (t < s.t1) {
      let path = paths.get(s);
      if (path === undefined) { path = vwnPath(plan.view, s.from, s.to); paths.set(s, path); }
      const e = easeInOutCubic((t - s.t0) / (s.t1 - s.t0));
      const { u, w } = path.at(path.S * e);
      const f = path.u1 > 0 ? u / path.u1 : 0;
      return { camera: { cx: s.from.cx + (s.to.cx - s.from.cx) * f, cy: s.from.cy + (s.to.cy - s.from.cy) * f, scale: plan.view.width / w }, anchor: s.to, segment: s };
    }
    last = s;
  }
  const c = last === null ? plan.initial : last.to;
  return { camera: c, anchor: c, segment: null };
}

/** Every segment targets only marks visible at its start (the no-future rule for the camera); the ids it fails on. */
export function planFutureViolations(plan: ReplayCameraPlan, timeline: ReplayCosmosTimeline, stages: ReadonlyMap<number, ReplayMomentStage>): string[] {
  const out: string[] = [];
  for (const s of plan.segments) {
    let visible: number | null = timeline.initialOrdinal;
    for (const step of timeline.steps) if (step.atMs <= s.t0) visible = step.ordinal;
    const stage = visible === null ? null : stages.get(visible) ?? null;
    const marks = stage === null ? { threads: [], readings: [] } : marksOf(stage.list);
    for (const id of s.source.ids) if (!marks.threads.includes(id) && !marks.readings.includes(id)) out.push(`${s.id}:${id}`);
    if (s.t0 < s.source.atMs) out.push(`${s.id}:starts-before-its-step`);
  }
  return out;
}
