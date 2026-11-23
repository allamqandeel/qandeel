/**
 * REPLAY-COSMOS-01 — from the Replay's governed reads to the COSMOS stage of every moment, through the S7-03 adapter.
 *
 * For each moment and each Personal depth the read is the composite controller's own (`analysis(ordinal, depth)`), the
 * historical disclosure is the S7-03 adapter's (`discloseReplayMoment`: render contract, medium, viewability, SP ≤ TC,
 * ordinal / TC and version range — every guard kept), and the scene is T-04's (`mapInspectionContext`). A moment whose
 * reads are not all answered is NOT ready; a refusal is reported, never drawn around. Thread names are the ones the
 * Replay disclosed for that moment (`disclosure.world.threads[].name.text`), exactly as the live Personal owner reads
 * its own; the frozen Replay wire discloses none today (REPLAY-COSMOS-01 blocker N-1), and none is invented.
 */
import { PERSONAL_DEPTHS } from '../cosmos/core/adapters';
import { mapInspectionContext, type MapScene } from '../map';
import type { ReplayHistoryMoment, ReplayHistoryVersion } from '../runtime-entry';
import { sessionPosition } from '../state';
import type { ReplayAnalysisState } from '../replay-composite/composite-controller';
import { discloseReplayMoment } from '../replay-composite/projection-adapter';
import { replayMomentStage, type ReplayMomentStage } from './stages';

export type ReplayMomentScenes =
  | { readonly status: 'READY'; readonly stage: ReplayMomentStage; readonly named: number; readonly unnamed: number }
  | { readonly status: 'PENDING' }
  | { readonly status: 'REFUSED'; readonly depth: string; readonly reason: string };

/** The stage of one moment from its five reads, or why it is not one. */
export function replayMomentScenes(
  version: ReplayHistoryVersion, moment: ReplayHistoryMoment, sessionId: string, rtl: boolean,
  analysisOf: (ordinal: number, depth: (typeof PERSONAL_DEPTHS)[number]) => ReplayAnalysisState | null,
): ReplayMomentScenes {
  const scenes: (MapScene | null)[] = [];
  const names = new Map<string, string>();
  let unnamed = 0;
  for (const depth of PERSONAL_DEPTHS) {
    const analysis = analysisOf(moment.ordinal, depth);
    if (analysis === null || analysis.status === 'LOADING') return { status: 'PENDING' };
    if (analysis.status !== 'AVAILABLE') return { status: 'REFUSED', depth, reason: analysis.status };
    const disclosed = discloseReplayMoment(version, moment, analysis.analysis);
    if (disclosed.status !== 'DISCLOSED') return { status: 'REFUSED', depth, reason: disclosed.status };
    const context = mapInspectionContext(disclosed.entry, { sessionId, tc: sessionPosition(moment.tc), depth });
    if (!context.ok) return { status: 'REFUSED', depth, reason: `SCENE_${context.derivation.status}` };
    scenes.push(context.context.scene);
    if (depth === 'WORLD') {
      for (const thread of context.context.disclosure.world.threads) {
        if (thread.name.text === null) unnamed += 1;
        else names.set(thread.id, thread.name.text);
      }
    }
  }
  return { status: 'READY', stage: replayMomentStage(moment.ordinal, scenes, names, rtl), named: names.size, unnamed };
}
