/**
 * REPLAY-COSMOS-01 — the world of an in-app Replay: the production COSMOS stage, guided by the Replay's ONE camera plan,
 * over the Replay's ONE historical timeline — the same scene, plan and timeline the video export draws.
 *
 *   `ReplayCosmosStage`  draws `replayCosmosFrame(scene, t)` in a `<Canvas>`: the same element tree the export renders
 *                        offscreen. No gesture is attached: the guided camera is the Replay's, and nothing the reader
 *                        does in the app moves or rewrites it (the live COSMOS camera and its gestures are untouched).
 *   `ReplayCosmosWorld`  reads every moment's five depths through the composite controller and the S7-03 adapter
 *                        (`history.ts`), builds the timeline and the plan once they are all answered, and drives t from
 *                        the moment the player shows: a moment's window starts where the player starts it, and t runs
 *                        through that window only while the player plays (pause holds t; a step or a Spine commit puts
 *                        t at the start of the target's window, as the player runs the target from its start).
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
import { ReplayCosmosStage } from './ReplayCosmosStage';
import { emptyReplayStage, type ReplayMomentStage } from './stages';
import { buildReplayCosmosTimeline, type ReplayScope } from './timeline';

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
  /** Each moment's presentation window length (the player's own pace or clock); the timeline is built from these. */
  readonly windowMs: (moment: ReplayHistoryMoment) => number;
  readonly scope: ReplayScope;
  readonly rtl: boolean;
  readonly typography: LabelTypography;
  readonly width: number;
  readonly height: number;
  readonly accessibilityLabel?: string;
}

export function ReplayCosmosWorld(props: ReplayCosmosWorldProps) {
  const { controller, version, moments, sessionId, ordinal, playing, windowMs, scope, rtl, typography, width, height } = props;
  const revision = useSyncExternalStore(controller.subscribe, controller.revision);
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

  const windows = useMemo(() => {
    const ends = moments.reduce<number[]>((acc, moment) => [...acc, (acc.at(-1) ?? 0) + Math.max(1, windowMs(moment))], []);
    return moments.map((moment, i) => ({ ordinal: moment.ordinal, tc: moment.tc, windowStartMs: i === 0 ? 0 : ends[i - 1], windowEndMs: ends[i], availableAtMs: null }));
  }, [moments, windowMs]);
  const timeline = useMemo(() => {
    const built = buildReplayCosmosTimeline(windows, scope, { fps: REPLAY_COSMOS_FPS, unrecorded: 'LEGACY_WINDOW_START_PENDING_PO' });
    return built.ok ? built.timeline : null;
  }, [windows, scope]);
  const prepared = usePrepared(stages);
  const images = useReplayCosmosImages();
  const scene = useMemo((): ReplayCosmosScene | null => {
    if (timeline === null || stages === null || prepared === null) return null;
    return {
      timeline, plan: buildReplayCameraPlan(timeline, stages, { width, height }), stages: prepared.byOrdinal, empty: prepared.empty,
      rtl, fontScale: PixelRatio.getFontScale(), typography, fonts: null,
    };
  }, [timeline, stages, prepared, width, height, rtl, typography]);

  const t = usePresentationTime(windows, timeline?.startMs ?? 0, timeline?.durationMs ?? 0, ordinal, playing);
  if (scene === null) return null;
  return <ReplayCosmosStage scene={scene} images={images} t={t} width={width} height={height} accessibilityLabel={props.accessibilityLabel} />;
}

/** Scoped presentation time from the player's moment and play state (see the header). */
function usePresentationTime(windows: readonly { ordinal: number; windowStartMs: number; windowEndMs: number }[], startMs: number, durationMs: number, ordinal: number, playing: boolean): number {
  const window = windows.find((w) => w.ordinal === ordinal) ?? null;
  const base = window === null ? 0 : Math.max(0, window.windowStartMs - startMs);
  const limit = window === null ? 0 : Math.max(base, Math.min(durationMs, window.windowEndMs - startMs));
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
