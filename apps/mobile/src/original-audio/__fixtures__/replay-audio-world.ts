/**
 * S8B-07 CP1-B step 5 (Sheet B) — a V2 Replay world for the player tests: the S7-04 controller with the original-audio
 * clock source, over the simulated Replay Media Service and streaming player (`fake-transient-world`), on jest's fake
 * clock. 1 text · 2 audio · 3 audio (a turn of two units: 3 and 4) · 5 text · 6 audio (another recording).
 */
import type { HistoricalSemanticDepth } from '@qandeel/runtime';

import { createReplayPlayerController, readingPaceMs, type ReplayPlayerController } from '../../replay-player';
import { REPLAY_RENDER_CONTRACT_V1, REPLAY_RENDER_CONTRACT_V2 } from '../../replay-composite';
import { createManualForegroundSignal, type ReplayHistoryMoment, type ReplayHistoryVersion } from '../../runtime-entry';
import type { ReplayDraftHandoff } from '../../replay-entry';
import { createPlaybackOwner, type LiveCallSignal } from '../playback-owner';
import type { PresentationBoundary, PresentationSpan } from '../presentation-map';
import { createReplayAudio } from '../replay-audio';
import type { ReplayAudioAnnouncement } from '../replay-audio-clock';
import type { TransientMediaApiClient } from '../transient-media-api';
import { createFakePlayerPort, FakeTransientServer, MINUTE, type FakeServerOptions } from './fake-transient-world';

export const SESSION = 'a0000000-0000-4000-8000-000000000001';
export const REPLAY = 'b0000000-0000-4000-8000-000000000002';
export const VERSION = 'c0000000-0000-4000-8000-000000000003';

let commands = 0;
const commandId = () => {
  commands += 1;
  return `d0000000-0000-4000-8000-${commands.toString(16).padStart(12, '0')}`;
};

export const moment = (ordinal: number, originalMedium: 'ORIGINAL_TEXT' | 'ORIGINAL_AUDIO', text: string | null, sourceRole: 'USER' | 'ASSISTANT' = 'USER'): ReplayHistoryMoment =>
  ({ ordinal, tc: ordinal, sourceRole, originalMedium, omittedBefore: 0, text });

/**
 * 1 text · 2 audio · 3 audio (a turn of two units: 3 and 4) · 5 text · 6 audio (another recording). An original-audio moment
 * carries no text, as the server reads it (0183 R-1; S8B-07 CP1-B F-1 on HONOR: the step 5 fixture gave it text).
 */
export const MOMENTS: readonly ReplayHistoryMoment[] = [
  moment(1, 'ORIGINAL_TEXT', 'first'),
  moment(2, 'ORIGINAL_AUDIO', null),
  moment(3, 'ORIGINAL_AUDIO', null, 'ASSISTANT'),
  moment(4, 'ORIGINAL_AUDIO', null, 'ASSISTANT'),
  moment(5, 'ORIGINAL_TEXT', 'fifth'),
  moment(6, 'ORIGINAL_AUDIO', null),
];
/** The same moments as text, for a V1 version (all text). */
export const MOMENTS_AS_TEXT: readonly ReplayHistoryMoment[] = MOMENTS.map((m) => ({ ...m, originalMedium: 'ORIGINAL_TEXT' as const, text: m.text ?? `spoken ${m.ordinal}` }));

export const RUN0: readonly PresentationSpan[] = [
  { kind: 'WINDOW', fromMs: 0, toMs: 6_000, track: 'USER', momentOrdinal: 2 },
  { kind: 'WINDOW', fromMs: 4_000, toMs: 9_000, track: 'QANDEEL', momentOrdinal: 3 },
  { kind: 'MIX', fromMs: 4_000, toMs: 6_000 },
];
export const RUN1: readonly PresentationSpan[] = [
  { kind: 'WINDOW', fromMs: 0, toMs: 5_000, track: 'USER', momentOrdinal: 6 },
  { kind: 'GAP', fromMs: 1_000, toMs: 2_000, track: 'USER', gapKind: 'RECONNECTION' },
];
export const CROSS: PresentationBoundary = { kind: 'CROSS_RECORDING' };

export function version(contract: typeof REPLAY_RENDER_CONTRACT_V1 | typeof REPLAY_RENDER_CONTRACT_V2, moments = MOMENTS): ReplayHistoryVersion {
  return {
    replayId: REPLAY, versionId: VERSION, revision: 1, isCurrent: true, finalized: true, coverage: 'SELECTED_EXCERPT', momentCount: moments.length,
    temporalDiscontinuityCount: 0, firstTc: 1, lastTc: moments.length,
    renderContract: { revision: 1, schema: contract.schema, sourceMediumClass: contract.sourceMediumClass, policies: { ...contract.policies } },
    viewing: { state: 'VIEWABLE', notViewableClass: null, sourceLayer: 'DEREFERENCEABLE', analyticalLayer: 'SEALED_HISTORICAL_EVIDENCE' },
  };
}

function liveCallSignal() {
  const listeners = new Set<() => void>();
  let live = false;
  const signal: LiveCallSignal = { isLive: () => live, subscribe: (l) => (listeners.add(l), () => listeners.delete(l)) };
  return { signal, set(next: boolean) { live = next; for (const l of Array.from(listeners)) l(); } };
}

export interface WorldOptions {
  readonly server?: Partial<FakeServerOptions>;
  readonly contract?: typeof REPLAY_RENDER_CONTRACT_V1 | typeof REPLAY_RENDER_CONTRACT_V2;
  readonly moments?: readonly ReplayHistoryMoment[];
}

export function world(options: WorldOptions = {}) {
  const server = new FakeTransientServer({ runs: [9_000, 5_000], spans: [RUN0, RUN1], boundaries: [CROSS], sourceEndsInMs: 600 * MINUTE, prepareMs: 2_000, ...options.server });
  const players = createFakePlayerPort(server, { loadDelayMs: 200, seekStallMs: 0, responseCapMs: 0 });
  const call = liveCallSignal();
  const owner = createPlaybackOwner(call.signal);
  const replayCalls: string[] = [];
  const api = {
    requestReplay: (replayId: string, versionId: string, command: string) => {
      replayCalls.push(`${replayId} ${versionId}`);
      return server.request(command);
    },
    status: (id: string) => server.status(id),
    release: (id: string) => server.release(id),
    audioUrl: (id: string) => `https://media.test/voice/transient/${id}`,
  } as unknown as TransientMediaApiClient;
  const announced: ReplayAudioAnnouncement[] = [];
  const audio = createReplayAudio({
    api, owner, player: players.port, foreground: createManualForegroundSignal('ACTIVE'), authorization: () => ({ Authorization: 'Bearer t' }), newCommandId: commandId,
  });
  audio.onAnnouncement((a) => announced.push(a));
  const moments = options.moments ?? MOMENTS;
  const analysisReads: string[] = [];
  const player: ReplayPlayerController = createReplayPlayerController({
    sessionId: SESSION,
    reads: {
      replay: async () => ({ kind: 'FOUND', replay: { replayId: REPLAY, lifecycle: 'FINALIZED', revision: 1, coverage: 'SELECTED_EXCERPT', firstTc: 1, lastTc: moments.length,
        sourceState: 'CURRENT', currentVersion: { versionId: VERSION, revision: 1, finalized: true } } }),
      conversationReplays: async () => ({ kind: 'UNAVAILABLE' }),
    },
    commands: {
      preview: async () => ({ kind: 'OUTCOME_UNKNOWN' }), finalize: async () => ({ kind: 'OUTCOME_UNKNOWN' }), reopen: async () => ({ kind: 'OUTCOME_UNKNOWN' }),
    } as never,
    history: {
      version: async () => ({ kind: 'FOUND', version: version(options.contract ?? REPLAY_RENDER_CONTRACT_V2, moments) }),
      moments: async () => ({ kind: 'FOUND', moments }),
      momentAnalysis: async (_r: string, _v: string, ordinal: number, depth: HistoricalSemanticDepth) => {
        analysisReads.push(`${ordinal} ${depth}`);
        return { kind: 'NOT_FOUND' };
      },
    },
    isCurrent: () => true,
    newCommandId: commandId,
    momentClock: audio.clockSource,
  });
  // The composite's own reads, as its view asks them: one rung for the moment shown, so a paced moment is settled.
  player.subscribe(() => {
    const open = player.getState().open;
    open?.composite?.ensureAnalysis(open.ordinal, 'WORLD');
  });
  const open = async () => {
    player.openSaved({ sessionId: SESSION, replayId: REPLAY, draftRevision: 1, coverage: 'SELECTED_EXCERPT', selectedMomentCount: moments.length } as unknown as ReplayDraftHandoff);
    await run(0);
    await run(0);
  };
  const ordinal = () => player.getState().open?.ordinal;
  const playing = () => player.getState().open?.playing;
  const clock = () => audio.clockOf(VERSION);
  /** Content heard per file (artifact): [from, to] pieces in the order heard. */
  const heard = () => players.audible.map((s) => ({ run: server.sets[0]!.ids.indexOf(s.artifactId), from: s.contentStart, to: s.contentEnd, at: s.wallStart, until: s.wallEnd }));
  return { server, players, call, owner, audio, player, open, ordinal, playing, clock, heard, announced, replayCalls, analysisReads };
}

export const run = (ms: number) => jest.advanceTimersByTimeAsync(ms);
/** Steps the fake clock until the condition holds; returns the time it took. */
export async function until(condition: () => boolean, maxMs = 60_000): Promise<number> {
  let spent = 0;
  while (!condition()) {
    if (spent >= maxMs) throw new Error('condition never held');
    await run(10);
    spent += 10;
  }
  return spent;
}
export const pace = (text: string) => readingPaceMs(text);

