/**
 * REPLAY-COSMOS-01 — the world of an in-app Replay: the production COSMOS stage, guided by the Replay's ONE camera plan,
 * over the Replay's ONE historical timeline — the same scene, plan and timeline the video export draws.
 *
 *   `ReplayCosmosStage`  draws `replayCosmosFrame(scene, t)` in a `<Canvas>`: the same element tree the export renders
 *                        offscreen. No gesture is attached: the guided camera is the Replay's, and nothing the reader
 *                        does in the app moves or rewrites it (the live COSMOS camera and its gestures are untouched).
 *   `ReplayCosmosWorld`  reads every moment's five depths through the composite controller and the S7-03 adapter
 *                        (`history.ts`), builds the timeline and the plan once they are all answered, and drives t:
 *
 *     with an audio plan  (PR #404 RB-1 S2) the version's audio clock is the ONE authority: the timeline is laid out by
 *                        `replayPresentationClock` from the map the clock holds, and t is the clock's PLACE, read on
 *                        every display frame (the playing file's own position, or the pause the clock times) — never a
 *                        wall clock and never the reading pace. Pause, resume, seek and a run boundary are the clock's;
 *                        the stage only follows. A text moment inside it keeps the player's reading pace (B2X), drawn
 *                        the same allowance behind the audio is;
 *     audio, no map yet   (or refused, RA-12) the stage stays at the start of the moment shown: no time is run, so no
 *                        analysis can be drawn ahead of speech that has not played;
 *     text only           (no audio clock: every V1 version, a V2 version of text alone) exactly the S7-03 / S7-04
 *                        behaviour: t runs through the moment's declared reading pace while the player plays (pause
 *                        holds t; a step or a Spine commit puts t at the start of the target's window). No audio claim.
 */
import { useImage } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { PixelRatio } from 'react-native';

import { PERSONAL_DEPTHS } from '../cosmos/core/adapters';
import { disposePrepared, prepareStage } from '../cosmos/skia/prepare';
import type { ReplayHistoryMoment, ReplayHistoryVersion } from '../runtime-entry';
import type { ReplayCompositeController } from '../replay-composite/composite-controller';
import { buildReplayCameraPlan } from './camera-plan';
import type { LabelTypography, ReplayCosmosScene, ReplayFrameImages, ReplayFrameStage } from './frame';
import { replayMomentScenes } from './history';
import { replayPresentationClock, replayStageTime, type ReplayPresentationClock, type ReplayStageClock, type ReplayStageTime } from './presentation-clock';
import { ReplayCosmosStage } from './ReplayCosmosStage';
import { emptyReplayStage, type ReplayMomentStage } from './stages';
import { buildReplayCosmosTimeline, type ReplayCosmosMomentInput, type ReplayScope } from './timeline';

/** The in-app frame rate the timeline's causal frames are counted at (the video's own; the app redraws per display frame). */
export const REPLAY_COSMOS_FPS = 30;

const PLATES = {
  deep: require('../cosmos/assets/personal-deep.jpg') as number,
  gas: require('../cosmos/assets/personal-gas.jpg') as number,
  veil: require('../cosmos/assets/personal-veil.jpg') as number,
  atlas: require('../cosmos/assets/light-atlas.png') as number,
};

/** The production COSMOS images (the live canvas's own files). */
export function useReplayCosmosImages(): ReplayFrameImages | null {
  const deep = useImage(PLATES.deep);
  const gas = useImage(PLATES.gas);
  const veil = useImage(PLATES.veil);
  const atlas = useImage(PLATES.atlas);
  return deep === null || gas === null || veil === null || atlas === null ? null : { deep, gas, veil, atlas };
}

/** Prepared stages, owned here: every one made is released when it is no longer drawn. */
function usePrepared(stages: ReadonlyMap<number, ReplayMomentStage> | null): { readonly byOrdinal: ReadonlyMap<number, ReplayFrameStage>; readonly empty: ReplayFrameStage } | null {
  const prepared = useMemo(() => {
    if (stages === null) return null;
    const byOrdinal = new Map<number, ReplayFrameStage>();
    for (const [ordinal, stage] of stages) byOrdinal.set(ordinal, { stage, prepared: prepareStage(stage.list) });
    const empty = emptyReplayStage();
    return { byOrdinal, empty: { stage: empty, prepared: prepareStage(empty.list) } };
  }, [stages]);
  useEffect(() => () => {
    if (prepared === null) return;
    const all = [...prepared.byOrdinal.values(), prepared.empty];
    // Released a moment after the canvas stops drawing them (the tree that drew them has been replaced).
    setTimeout(() => { for (const p of all) disposePrepared(p.prepared); }, 250);
  }, [prepared]);
  return prepared;
}

export interface ReplayCosmosWorldProps {
  readonly controller: ReplayCompositeController;
  readonly version: ReplayHistoryVersion;
  readonly moments: readonly ReplayHistoryMoment[];
  readonly sessionId: string;
  /** The moment the player shows. */
  readonly ordinal: number;
  readonly playing: boolean;
  /** Each TEXT moment's presentation length: the player's own declared reading pace (an audio moment's is the map's). */
  readonly windowMs: (moment: ReplayHistoryMoment) => number;
  /** RB-1 S2: the version's audio clock, when the player has one for it; absent or null: the version is text only. */
  readonly stageClock?: ReplayStageClock | null;
  readonly scope: ReplayScope;
  readonly rtl: boolean;
  readonly typography: LabelTypography;
  readonly width: number;
  readonly height: number;
  readonly accessibilityLabel?: string;
}

export function ReplayCosmosWorld(props: ReplayCosmosWorldProps) {
  const { controller, version, moments, sessionId, ordinal, playing, windowMs, scope, rtl, typography, width, height } = props;
  const stageClock = props.stageClock ?? null;
  const revision = useSyncExternalStore(controller.subscribe, controller.revision);
  useSyncExternalStore(stageClock?.subscribe ?? noSubscription, stageClock?.revision ?? noRevision);
  // The map the audio clock holds (null before it arrives, or when refused): the presentation clock is laid out from it.
  const audioPlan = stageClock?.detail().plan ?? null;
  const presentation = useMemo(() => (audioPlan === null ? null : replayPresentationClock(audioPlan, moments, windowMs)), [audioPlan, moments, windowMs]);
  const viewable = version.viewing.state === 'VIEWABLE';

  // Every moment's five reads, asked once each (a held answer is never read again).
  useEffect(() => {
    if (!viewable) return;
    for (const moment of moments) for (const depth of PERSONAL_DEPTHS) controller.ensureAnalysis(moment.ordinal, depth);
  }, [controller, moments, viewable]);

  const stages = useMemo((): ReadonlyMap<number, ReplayMomentStage> | null => {
    if (!viewable) return null;
    const out = new Map<number, ReplayMomentStage>();
    for (const moment of moments) {
      const read = replayMomentScenes(version, moment, sessionId, rtl, (o, d) => controller.analysis(o, d));
      // Not all answered: nothing is drawn yet. A refused moment has no stage: the composite draws no world while it is
      // shown (S7-03: said so, with no Map), and a video of the version is refused whole (it would draw around it).
      if (read.status === 'PENDING') return null;
      if (read.status === 'READY') out.set(moment.ordinal, read.stage);
    }
    return out;
    // `revision` is the controller's own change signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, version, moments, sessionId, rtl, viewable, revision]);

  // The timeline's moments: the presentation clock's when the audio plan is held, otherwise each moment's declared pace in
  // order (an audio moment, if any, still completes only at its window's END: never a disclosure ahead of its speech).
  const windows = useMemo((): readonly ReplayCosmosMomentInput[] => {
    if (presentation !== null) return presentation.inputs;
    const ends = moments.reduce<number[]>((acc, moment) => [...acc, (acc.at(-1) ?? 0) + Math.max(1, windowMs(moment))], []);
    return moments.map((moment, i) => {
      const windowStartMs = i === 0 ? 0 : ends[i - 1];
      return { ordinal: moment.ordinal, tc: moment.tc, windowStartMs, windowEndMs: ends[i], completeAtMs: moment.originalMedium === 'ORIGINAL_AUDIO' ? ends[i] : windowStartMs, availableAtMs: null };
    });
  }, [presentation, moments, windowMs]);
  const timeline = useMemo(() => {
    const built = buildReplayCosmosTimeline(windows, scope, {
      fps: REPLAY_COSMOS_FPS, unrecorded: 'UNESTABLISHED_PRESENTATION_GUARDS_ONLY', ...(presentation === null ? {} : { durationMs: presentation.durationMs }),
    });
    return built.ok ? built.timeline : null;
  }, [windows, scope, presentation]);
  const prepared = usePrepared(stages);
  const images = useReplayCosmosImages();
  const scene = useMemo((): ReplayCosmosScene | null => {
    if (timeline === null || stages === null || prepared === null) return null;
    return {
      timeline, plan: buildReplayCameraPlan(timeline, stages, { width, height }), stages: prepared.byOrdinal, empty: prepared.empty,
      rtl, fontScale: PixelRatio.getFontScale(), typography, fonts: null,
    };
  }, [timeline, stages, prepared, width, height, rtl, typography]);

  const startMs = timeline?.startMs ?? 0;
  const durationMs = timeline?.durationMs ?? 0;
  const followed = useAudioStageTime(presentation, stageClock, ordinal, playing);
  // The reading pace runs only for a text-only version, or inside a text moment's own block; an audio version whose map
  // is not held stays where the moment shown starts.
  const shownWindow = windows.find((w) => w.ordinal === ordinal) ?? null;
  const pacedRange = followed?.kind === 'PACED' ? { from: followed.startMs, to: followed.endMs }
    : followed === null && stageClock === null && shownWindow !== null ? { from: shownWindow.windowStartMs, to: shownWindow.windowEndMs } : null;
  const paced = usePacedTime(pacedRange, startMs, durationMs, playing && pacedRange !== null);
  const scoped = (full: number) => Math.min(durationMs, Math.max(0, full - startMs));
  // A text block inside an audio plan is drawn its stated allowance behind (a delay, never an advance); a text-only version
  // keeps its pace exactly.
  const behind = followed?.kind === 'PACED' ? followed.behindMs : 0;
  const t = followed !== null && followed.kind !== 'PACED' ? scoped(followed.t) : pacedRange !== null ? Math.max(0, paced - behind) : scoped(shownWindow?.windowStartMs ?? 0);
  if (scene === null) return null;
  return <ReplayCosmosStage scene={scene} images={images} t={t} width={width} height={height} accessibilityLabel={props.accessibilityLabel} />;
}

const noSubscription = () => () => undefined;
const noRevision = () => 0;

/**
 * RB-1 S2: the stage time while the version's audio plan is held — the clock's place, read when drawing, once per display
 * frame while the player plays (a pause, a seek or a boundary is the clock's change, and its revision redraws). It reads
 * no wall clock and no reading pace: a display frame only asks the clock where it is. Null: no audio plan held.
 */
function useAudioStageTime(presentation: ReplayPresentationClock | null, stageClock: ReplayStageClock | null, ordinal: number, playing: boolean): ReplayStageTime | null {
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!playing || presentation === null || stageClock === null) return undefined;
    let frame = 0;
    const onFrame = () => {
      redraw((n) => n + 1);
      frame = requestAnimationFrame(onFrame);
    };
    frame = requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(frame);
  }, [playing, presentation, stageClock]);
  if (presentation === null || stageClock === null) return null;
  const state = stageClock.getState();
  return replayStageTime(presentation, ordinal, { phase: state.phase, ordinal: state.ordinal, place: stageClock.place() });
}

/** Scoped presentation time through a paced range (a text-only version's moment, or a text moment's block; see the header). */
function usePacedTime(range: { readonly from: number; readonly to: number } | null, startMs: number, durationMs: number, playing: boolean): number {
  const base = range === null ? 0 : Math.max(0, range.from - startMs);
  const limit = range === null ? 0 : Math.max(base, Math.min(durationMs, range.to - startMs));
  // The time run inside the moment shown, kept with the moment it belongs to: another moment starts from its start.
  const [run, setRun] = useState<{ readonly base: number; readonly ms: number }>({ base, ms: 0 });
  const elapsed = run.base === base ? run.ms : 0;
  useEffect(() => {
    if (!playing) return undefined;
    let frame = 0;
    const from = Date.now() - elapsed;
    const tick = () => {
      setRun({ base, ms: Date.now() - from });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // `elapsed` is read once, where play (re)starts; a pause holds it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, base]);
  return Math.min(limit, base + elapsed);
}
