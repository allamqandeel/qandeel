/**
 * S7-03 — the composite's reader of ONE Replay version: the version, its moments, and each moment's analysis at each
 * depth, through the three S7-01 reads and nothing else.
 *
 * It holds what it read for the life of the instance (one instance per version) and nothing longer: no persistence, no
 * shared cache, no store of the live conversation. A moment's analysis is read when the composite asks for it, at the
 * depth the Map's camera is on, so a pinch through the frozen rungs reads the next rung for the SAME moment.
 *
 * It keeps every "nothing to draw" answer apart, because they mean different things to a reader:
 *
 *   NOT_VIEWABLE             the version is not viewable now (its reason and both layers come with the version);
 *   NOT_CURRENTLY_AVAILABLE  this moment's sealed analysis is not available now (ANALYSIS_NOT_CURRENTLY_AVAILABLE);
 *   NOT_FOUND                not this reader's, or no longer there;
 *   FAILED                   nothing usable arrived — a technical failure, retryable, and NEVER an empty history.
 */
import type { HistoricalSemanticDepth } from '@qandeel/runtime';

import type {
  ReplayAnalysisResult,
  ReplayHistoryMoment,
  ReplayHistoryVersion,
  ReplayMomentAnalysis,
  ReplayMomentsResult,
  ReplayVersionResult,
} from '../runtime-entry';
import { honoursRenderContract, isRenderableMedium } from './projection-adapter';

/** The three reads, as `ReplayHistoryApiClient` answers them. */
export interface ReplayHistoryReader {
  version(replayId: string, versionId: string): Promise<ReplayVersionResult>;
  moments(replayId: string, versionId: string): Promise<ReplayMomentsResult>;
  momentAnalysis(replayId: string, versionId: string, ordinal: number, depth: HistoricalSemanticDepth): Promise<ReplayAnalysisResult>;
}

export type ReplayCompositeState =
  | { readonly status: 'LOADING' }
  | { readonly status: 'FAILED' }
  | { readonly status: 'NOT_FOUND' }
  /** The version's render contract, or a moment's medium, is one this composite cannot honour: nothing is rendered. */
  | { readonly status: 'NOT_RENDERABLE' }
  | { readonly status: 'READY'; readonly version: ReplayHistoryVersion; readonly moments: readonly ReplayHistoryMoment[] };

export type ReplayAnalysisState =
  | { readonly status: 'LOADING' }
  | { readonly status: 'FAILED' }
  | { readonly status: 'NOT_FOUND' }
  | { readonly status: 'NOT_VIEWABLE' }
  | { readonly status: 'NOT_CURRENTLY_AVAILABLE' }
  | { readonly status: 'AVAILABLE'; readonly analysis: Extract<ReplayMomentAnalysis, { outcome: 'AVAILABLE' }> };

export interface ReplayCompositeController {
  readonly subscribe: (listener: () => void) => () => void;
  /** Changes whenever anything this controller holds changes. */
  readonly revision: () => number;
  readonly state: () => ReplayCompositeState;
  readonly analysis: (ordinal: number, depth: HistoricalSemanticDepth) => ReplayAnalysisState | null;
  /** Reads the version and its moments once. */
  readonly open: () => void;
  /** Reads one moment's analysis at one depth once; a held answer is never read again. */
  readonly ensureAnalysis: (ordinal: number, depth: HistoricalSemanticDepth) => void;
  /** Forgets every FAILED answer and reads it again. Nothing else is re-read. */
  readonly retry: () => void;
}

const LOADING = Object.freeze({ status: 'LOADING' as const });
const keyOf = (ordinal: number, depth: HistoricalSemanticDepth) => `${ordinal} ${depth}`;

export function createReplayCompositeController(reader: ReplayHistoryReader, replayId: string, versionId: string): ReplayCompositeController {
  let state: ReplayCompositeState = LOADING;
  let opened = false;
  let revision = 0;
  const analyses = new Map<string, ReplayAnalysisState>();
  const listeners = new Set<() => void>();
  const changed = () => {
    revision += 1;
    for (const listener of [...listeners]) listener();
  };

  const read = async () => {
    let version: ReplayVersionResult;
    let moments: ReplayMomentsResult;
    try {
      [version, moments] = await Promise.all([reader.version(replayId, versionId), reader.moments(replayId, versionId)]);
    } catch {
      version = { kind: 'UNAVAILABLE' };
      moments = { kind: 'UNAVAILABLE' };
    }
    if (version.kind === 'NOT_FOUND' || moments.kind === 'NOT_FOUND') state = { status: 'NOT_FOUND' };
    else if (version.kind !== 'FOUND' || moments.kind !== 'FOUND') state = { status: 'FAILED' };
    else if (moments.moments.length !== version.version.momentCount || moments.moments.some((moment) => moment.tc < version.version.firstTc || moment.tc > version.version.lastTc)) {
      // The two reads do not describe one version: neither is used.
      state = { status: 'FAILED' };
    } else if (!honoursRenderContract(version.version) || !moments.moments.every(isRenderableMedium)) state = { status: 'NOT_RENDERABLE' };
    else state = { status: 'READY', version: version.version, moments: moments.moments };
    changed();
  };

  const readAnalysis = async (ordinal: number, depth: HistoricalSemanticDepth) => {
    let answer: ReplayAnalysisResult;
    try {
      answer = await reader.momentAnalysis(replayId, versionId, ordinal, depth);
    } catch {
      answer = { kind: 'UNAVAILABLE' };
    }
    let next: ReplayAnalysisState;
    if (answer.kind === 'NOT_FOUND') next = { status: 'NOT_FOUND' };
    else if (answer.kind !== 'ANSWERED') next = { status: 'FAILED' };
    else if (answer.analysis.outcome === 'NOT_VIEWABLE') next = { status: 'NOT_VIEWABLE' };
    else if (answer.analysis.outcome === 'ANALYSIS_NOT_CURRENTLY_AVAILABLE') next = { status: 'NOT_CURRENTLY_AVAILABLE' };
    else next = { status: 'AVAILABLE', analysis: answer.analysis };
    analyses.set(keyOf(ordinal, depth), next);
    changed();
  };

  return Object.freeze({
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    revision: () => revision,
    state: () => state,
    analysis: (ordinal: number, depth: HistoricalSemanticDepth) => analyses.get(keyOf(ordinal, depth)) ?? null,
    open() {
      if (opened) return;
      opened = true;
      void read();
    },
    ensureAnalysis(ordinal: number, depth: HistoricalSemanticDepth) {
      if (state.status !== 'READY' || state.version.viewing.state !== 'VIEWABLE') return;
      if (!state.moments.some((moment) => moment.ordinal === ordinal)) return;
      const key = keyOf(ordinal, depth);
      if (analyses.has(key)) return;
      analyses.set(key, LOADING);
      changed();
      void readAnalysis(ordinal, depth);
    },
    retry() {
      if (state.status === 'FAILED') {
        state = LOADING;
        changed();
        void read();
        return;
      }
      for (const [key, value] of analyses) {
        if (value.status !== 'FAILED') continue;
        analyses.delete(key);
        const [ordinal, depth] = key.split(' ');
        analyses.set(key, LOADING);
        void readAnalysis(Number(ordinal), depth as HistoricalSemanticDepth);
      }
      changed();
    },
  });
}
