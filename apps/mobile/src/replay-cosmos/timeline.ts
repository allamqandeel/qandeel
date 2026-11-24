/**
 * REPLAY-COSMOS-01 — the ONE historical timeline a Replay's COSMOS stage is drawn from, in the app and in the video.
 *
 * Presentation time (clock 5) is the only clock here: milliseconds from the start of the chosen scope. Each moment of
 * the version holds a presentation WINDOW (its audio window, or its declared reading pace) and the analytical knowledge
 * the authority disclosed at its TC, K(TC). That knowledge becomes VISIBLE at its disclosure time:
 *
 *   disclosedAt(k) = max( availability(k), windowStart(k), completeAt(k), disclosedAt(k − 1) )
 *
 *   - availability(k): the first historically RECORDED instant at which the analysis became available to the
 *     authorised map, already mapped onto presentation time (PO decision, 2026-11-22). Never the end of a speaker's
 *     audio, of the turn, the export request or a projection rebuild. Where none is recorded the caller must name the
 *     policy it applies (`mode`); nothing is inferred from turn order and no time is invented;
 *   - windowStart(k): the SP/TC no-future guard, kept independently — knowledge at TC = k never shows before the
 *     presentation reaches moment k;
 *   - completeAt(k): NO ANALYSIS BEFORE SPEECH (PO, RB-1, 2026-11-23: a hard invariant) — knowledge at TC = k never
 *     shows before moment k has been presented in full: an audio moment's window END (a later unit of a voice turn: its
 *     turn's window, C-B1), a text moment's display (its window start: the text is shown whole). No word-level time is
 *     invented: the map's window boundaries are the only ones used;
 *   - disclosedAt(k − 1): K(k) contains everything K(k − 1) did, so it never shows before K(k − 1) may. With overlapping
 *     speaker windows this running maximum IS the causal boundary: K(k) waits for the latest end among the windows of
 *     every moment up to k, and no window is dropped or flattened.
 *
 * Frames are CAUSAL (PO-APPROVED, 2026-11-22): a disclosure is first drawn on the first frame whose time is at or after
 * its disclosure time, never the nearest frame. A scope that starts later than 0 opens on the knowledge authorised AT its
 * start (never the final state, never nothing), and nothing in it is shortened, snapped or dropped. A disclosure that
 * falls at or after the scope's end is never pulled back into its last frame: it is listed (`afterEnd`), not drawn — what
 * a Replay shows after its last audio is a separate PO decision (the end-of-Replay policy).
 *
 * RB-2 / S4 (PO execution directive, 2026-11-24; RB-2 contract v1.1 §6.2 / §7): availability is TYPED end to end, never
 * `null`. RECORDED{atMs} is a historically certified instant (the S3 answer, bound by the phone and mapped onto this clock);
 * AFTER_END is +Infinity, so it is always listed in `afterEnd` and never reaches the speech guards; UNRECORDED claims no
 * time at all. The caller names the mode: CERTIFIED (the Replay of a version with original audio) REFUSES any UNRECORDED
 * moment — the caller then shows the neutral, analysis-free stage (`neutralReplayCosmosTimeline`, U-N), never a snapshot
 * or opening knowledge; UNESTABLISHED_PRESENTATION_GUARDS_ONLY is the pre-RB-2 behaviour of a version with no audio (V1 and
 * text only, D-RB2-12: ordinal pacing, labelled, never a historical-availability claim). The guard line is unchanged.
 */

/**
 * RB-2 / S4: a moment's historical availability on the full presentation clock. RECORDED: certified at `atMs` (an
 * in-recording position mapped AT OR AFTER, never earlier). AFTER_END: certified only after the whole recording — never
 * drawn inside the Replay, whatever the scope. UNRECORDED: no time established (UNESTABLISHED, BROKEN, ORDINAL_ONLY, a
 * refused answer, or none fetched); nothing may be inferred from it.
 */
export type ReplayCosmosAvailability =
  | { readonly kind: 'RECORDED'; readonly atMs: number }
  | { readonly kind: 'AFTER_END' }
  | { readonly kind: 'UNRECORDED' };

export const UNRECORDED_AVAILABILITY: ReplayCosmosAvailability = Object.freeze({ kind: 'UNRECORDED' as const });

/** One moment of the version, on the full (unscoped) presentation clock. */
export interface ReplayCosmosMomentInput {
  readonly ordinal: number;
  readonly tc: number;
  readonly windowStartMs: number;
  readonly windowEndMs: number;
  /** When the moment has been presented in full (`completeAt` above), within its window. */
  readonly completeAtMs: number;
  /** The moment whose presentation window this is: a later unit of a voice turn names its turn's first (C-B1). */
  readonly presentedBy?: number;
  /** When the moment's analysis became historically available, on the full presentation clock (typed; never null). */
  readonly availability: ReplayCosmosAvailability;
}

/**
 * What to do where no availability instant was recorded. There is exactly one policy, named as what it is: the
 * presentation guards ALONE decide (the moment's window, its completion, the knowledge it contains). It is not a
 * recorded availability and never passes for one — the analysis may have become available later than it is drawn, and
 * only RB-2 (a recorded availability; not approved) can establish when. It replaces the S7-03 window-start behaviour
 * (`LEGACY_WINDOW_START_PENDING_PO`), and is never earlier than it.
 */
export type UnrecordedAvailabilityPolicy = 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY';

/**
 * RB-2 / S4: CERTIFIED — every drawn disclosure rests on a certified availability (an UNRECORDED moment refuses the
 * timeline); or the named pre-RB-2 policy, selected explicitly by a caller that claims no historical time.
 */
export type ReplayTimelineMode = 'CERTIFIED' | UnrecordedAvailabilityPolicy;

/** The refusal a CERTIFIED timeline gives for a moment with no certified availability (the caller shows U-N). */
export const UNRECORDED_IN_CERTIFIED = 'UNRECORDED_AVAILABILITY_IN_CERTIFIED_MODE';

export type ReplayScope =
  | { readonly kind: 'FULL' }
  | { readonly kind: 'RANGE'; readonly startMs: number; readonly endMs: number };

export interface ReplayDisclosureStep {
  readonly ordinal: number;
  readonly tc: number;
  /** Disclosure time on the SCOPED clock (ms from the scope's start). */
  readonly atMs: number;
  /** The first frame drawing it (causal), and how late that frame is relative to `atMs` (0 ≤ lag < 1000 / fps). */
  readonly frame: number;
  readonly frameLagMs: number;
  readonly availability: 'RECORDED' | UnrecordedAvailabilityPolicy;
  /** How far the guards held the disclosure after its RECORDED availability (0: none held it); null when none was recorded. */
  readonly heldByGuardMs: number | null;
}

export interface ReplayCosmosTimeline {
  readonly scope: ReplayScope;
  /** On the full clock. */
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
  readonly fps: number;
  /** The knowledge the scope OPENS on: the latest moment disclosed at or before its start (null: nothing yet). */
  readonly initialOrdinal: number | null;
  readonly steps: readonly ReplayDisclosureStep[];
  /** The ordinals the scope DRAWS (its opening knowledge included) whose availability was not recorded (reported, never filled in). */
  readonly unrecorded: readonly number[];
  /** True only when every ordinal the scope draws has a RECORDED availability. */
  readonly availabilityEstablished: boolean;
  /** Disclosures at or after the scope's end: never drawn in it, never pulled back into its last frame. */
  readonly afterEnd: readonly number[];
  /** Every moment's window on the scoped clock (clipped to the scope; a window the scope cuts is kept, not dropped). */
  readonly windows: readonly { readonly ordinal: number; readonly startMs: number; readonly endMs: number }[];
}

export type TimelineRefusal = { readonly ok: false; readonly reason: string };

export interface ReplayTimelineOptions {
  readonly fps: number;
  readonly mode: ReplayTimelineMode;
  /** The presentation's own length (the audio clock's, past the last window); default the last window end. */
  readonly durationMs?: number;
}

type Scoped = { readonly ok: true; readonly startMs: number; readonly endMs: number } | TimelineRefusal;

/** The checks every timeline of a version makes, and its scope on the full clock. */
function scopeOf(moments: readonly ReplayCosmosMomentInput[], scope: ReplayScope, options: { readonly fps: number; readonly durationMs?: number }): Scoped {
  if (moments.length === 0) return { ok: false, reason: 'no moment' };
  if (!(options.fps > 0)) return { ok: false, reason: 'fps' };
  for (let i = 0; i < moments.length; i += 1) {
    const m = moments[i];
    if (!(m.windowEndMs >= m.windowStartMs) || m.windowStartMs < 0) return { ok: false, reason: `moment ${m.ordinal}: window` };
    if (!(m.completeAtMs >= m.windowStartMs && m.completeAtMs <= m.windowEndMs)) return { ok: false, reason: `moment ${m.ordinal}: completion` };
    // Windows in the order they START (D-05.5). They may overlap (two speakers); none is dropped or flattened.
    if (i > 0 && (m.ordinal <= moments[i - 1].ordinal || m.tc <= moments[i - 1].tc || m.windowStartMs < moments[i - 1].windowStartMs)) {
      return { ok: false, reason: `moment ${m.ordinal}: out of order` };
    }
  }
  const lastEnd = Math.max(...moments.map((m) => m.windowEndMs));
  const total = options.durationMs ?? lastEnd;
  if (!(total >= lastEnd)) return { ok: false, reason: 'duration shorter than the windows' };
  const startMs = scope.kind === 'FULL' ? 0 : scope.startMs;
  const endMs = scope.kind === 'FULL' ? total : scope.endMs;
  if (!(startMs >= 0 && endMs > startMs && endMs <= total)) return { ok: false, reason: 'scope outside the version' };
  return { ok: true, startMs, endMs };
}

/** One window per presented window, on the scoped clock: a later unit of a voice turn is on its turn's window. */
function scopedWindows(moments: readonly ReplayCosmosMomentInput[], startMs: number, endMs: number): ReplayCosmosTimeline['windows'] {
  return moments
    .filter((m) => (m.presentedBy ?? m.ordinal) === m.ordinal)
    .filter((m) => m.windowEndMs > startMs && m.windowStartMs < endMs)
    .map((m) => ({ ordinal: m.ordinal, startMs: Math.max(m.windowStartMs, startMs) - startMs, endMs: Math.min(m.windowEndMs, endMs) - startMs }));
}

/** Causal: the first frame i with i · frameMs ≥ atMs. The epsilon only absorbs binary rounding of an exact boundary. */
export const causalFrame = (atMs: number, fps: number): number => Math.ceil(atMs / (1000 / fps) - 1e-9);

export function buildReplayCosmosTimeline(
  moments: readonly ReplayCosmosMomentInput[],
  scope: ReplayScope,
  options: ReplayTimelineOptions,
): { readonly ok: true; readonly timeline: ReplayCosmosTimeline } | TimelineRefusal {
  const scoped = scopeOf(moments, scope, options);
  if (!scoped.ok) return scoped;
  const { startMs, endMs } = scoped;
  // CERTIFIED: no disclosure without a certified time. One UNRECORDED moment refuses the whole timeline — K(k) contains
  // K(k − 1), so no later moment could be placed either, and no opening knowledge is drawn from it (N-04, N-09).
  if (options.mode === 'CERTIFIED' && moments.some((m) => m.availability.kind === 'UNRECORDED')) return { ok: false, reason: UNRECORDED_IN_CERTIFIED };

  // Disclosure times on the FULL clock, with every guard.
  let previous = -Infinity;
  const full = moments.map((m) => {
    const a = m.availability;
    // RECORDED: its certified instant. AFTER_END: +Infinity, so it can only ever be listed after the scope (N-01, N-03).
    // UNRECORDED (only under the named pre-RB-2 policy): the guards alone decide; nothing is computed or filled in.
    const recorded = a.kind === 'RECORDED' ? a.atMs : a.kind === 'AFTER_END' ? Infinity : null;
    const available = recorded ?? -Infinity;
    const at = Math.max(available, m.windowStartMs, m.completeAtMs, previous);
    previous = at;
    return { m, at, recorded, held: recorded === null ? null : at - recorded };
  });

  let initialOrdinal: number | null = null;
  const steps: ReplayDisclosureStep[] = [];
  const unrecorded: number[] = [];
  const afterEnd: number[] = [];
  for (const d of full) {
    if (d.at <= startMs) { initialOrdinal = d.m.ordinal; if (d.recorded === null) unrecorded.push(d.m.ordinal); continue; }
    if (d.at >= endMs) { afterEnd.push(d.m.ordinal); continue; }
    const atMs = d.at - startMs;
    const frame = causalFrame(atMs, options.fps);
    steps.push({
      ordinal: d.m.ordinal, tc: d.m.tc, atMs, frame, frameLagMs: (frame * 1000 - atMs * options.fps) / options.fps,
      availability: d.recorded === null ? 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY' : 'RECORDED', heldByGuardMs: d.held,
    });
    if (d.recorded === null) unrecorded.push(d.m.ordinal);
  }
  const windows = scopedWindows(moments, startMs, endMs);
  const availabilityEstablished = unrecorded.length === 0;
  return { ok: true, timeline: { scope, startMs, endMs, durationMs: endMs - startMs, fps: options.fps, initialOrdinal, steps, unrecorded, availabilityEstablished, afterEnd, windows } };
}

/**
 * RB-2 / S4, U-N (contract v1.1 §7, D-RB2-3): the NEUTRAL, analysis-free timeline of a scope whose availability is not
 * certified — pending, refused, unavailable, or any UNRECORDED moment in CERTIFIED mode. The same windows and clock, and
 * NOTHING disclosed: no step, no opening knowledge, no tail. Its frames draw the empty stage; the analysis held in the
 * Replay snapshot is never drawn merely because it exists.
 */
export function neutralReplayCosmosTimeline(
  moments: readonly ReplayCosmosMomentInput[],
  scope: ReplayScope,
  options: { readonly fps: number; readonly durationMs?: number },
): { readonly ok: true; readonly timeline: ReplayCosmosTimeline } | TimelineRefusal {
  const scoped = scopeOf(moments, scope, options);
  if (!scoped.ok) return scoped;
  const { startMs, endMs } = scoped;
  return {
    ok: true,
    timeline: {
      scope, startMs, endMs, durationMs: endMs - startMs, fps: options.fps, initialOrdinal: null, steps: [],
      unrecorded: moments.map((m) => m.ordinal), availabilityEstablished: false, afterEnd: [], windows: scopedWindows(moments, startMs, endMs),
    },
  };
}

/** The knowledge visible at scoped time t: the latest step disclosed at or before t, else the opening knowledge. */
export function knowledgeAt(timeline: ReplayCosmosTimeline, t: number): number | null {
  let k = timeline.initialOrdinal;
  for (const step of timeline.steps) {
    if (step.atMs > t) break;
    k = step.ordinal;
  }
  return k;
}

/** The knowledge drawn on frame i (causal): the frame's own time decides, exactly as `knowledgeAt`. */
export function knowledgeOnFrame(timeline: ReplayCosmosTimeline, frame: number): number | null {
  let k = timeline.initialOrdinal;
  for (const step of timeline.steps) {
    if (step.frame > frame) break;
    k = step.ordinal;
  }
  return k;
}

/** The scoped time of frame i. */
export const frameTimeMs = (timeline: ReplayCosmosTimeline, frame: number): number => (frame * 1000) / timeline.fps;

/** The moment current at scoped time t: the latest-started window at or before t (D-05.5), or null before the first. */
export function momentAt(timeline: ReplayCosmosTimeline, t: number): number | null {
  let ordinal: number | null = null;
  for (const w of timeline.windows) {
    if (w.startMs > t) break;
    ordinal = w.ordinal;
  }
  return ordinal;
}
