/**
 * S8B-07 CP1-B (VA-8, Sheet B) — the original audio of a generation's Replay player: the clock source handed to the S7-04
 * player (one clock per V2 version it opens, on `replay:<versionId>`), and the registry its views read.
 *
 * Only a V2 version (the API's own tuple, mirrored by the governed adapter) that has an audio moment is timed; every V1
 * version, and a V2 version of text alone, stays paced by the player exactly as in S7-04. With no Replay media service
 * (INFRA-07 `NONE`) every play is RA-12. Held in memory; nothing is stored, logged or reported.
 */
import type { ReplayMomentClockSource } from '../replay-player';
import type { ForegroundSignal } from '../runtime-entry';
import type { VoiceNotePlayerPort } from '../voice-note/voice-note-playback';
import type { PlaybackOwner } from './playback-owner';
import { createReplayAudioClock, type ReplayAudioAnnouncement, type ReplayAudioClock } from './replay-audio-clock';
import type { TransientMediaApiClient, TransientRequestResult } from './transient-media-api';
import { createTransientPlayback, type TransientPlaybackEvent } from './transient-playback';

export interface ReplayAudioOptions {
  /** The Replay Media Service's client; null when there is none (INFRA-07 `NONE`): every play is RA-12. */
  readonly api: TransientMediaApiClient | null;
  readonly owner: PlaybackOwner;
  readonly player: VoiceNotePlayerPort;
  readonly foreground: ForegroundSignal;
  readonly authorization: () => Record<string, string> | null;
  readonly newCommandId: () => string;
  readonly onEvent?: (event: TransientPlaybackEvent) => void;
}

export interface ReplayAudio {
  readonly clockSource: ReplayMomentClockSource;
  clockOf(versionId: string): ReplayAudioClock | null;
  /** Changes when a clock is made or let go, or when a clock's state (not its position) changes. */
  subscribe(listener: () => void): () => void;
  revision(): number;
  /** What a screen reader is told as it starts (RA-04 / RA-05 / RA-06 … RA-08 / RA-15), for the view that says it. */
  onAnnouncement(listener: (announcement: ReplayAudioAnnouncement) => void): () => void;
  retire(): void;
}

/** Only a version the composite already honours reaches a clock (READY), so its schema names its contract exactly. */
const REPLAY_AUDIO_SCHEMA = 'QANDEEL_REPLAY_RENDER_CONTRACT_V2';
const BUSY: Promise<TransientRequestResult> = Promise.resolve({ kind: 'BUSY' });

export function createReplayAudio(options: ReplayAudioOptions): ReplayAudio {
  const { api } = options;
  const clocks = new Map<string, { readonly clock: ReplayAudioClock; readonly unsubscribe: () => void }>();
  const listeners = new Set<() => void>();
  const speakers = new Set<(announcement: ReplayAudioAnnouncement) => void>();
  let revision = 0;
  let retired = false;
  const changed = () => {
    revision += 1;
    for (const listener of Array.from(listeners)) listener();
  };

  const clockSource: ReplayMomentClockSource = (version, moments) => {
    if (retired || version.renderContract.schema !== REPLAY_AUDIO_SCHEMA || !moments.some((moment) => moment.originalMedium === 'ORIGINAL_AUDIO')) return null;
    const { replayId, versionId } = version;
    clocks.get(versionId)?.clock.retire();
    const clock = createReplayAudioClock({
      version,
      moments,
      allowed: () => options.owner.transientAllowed(),
      onAnnounce: (announcement) => {
        for (const speaker of Array.from(speakers)) speaker(announcement);
      },
      onRetired: () => {
        const held = clocks.get(versionId);
        if (held === undefined || held.clock !== clock) return;
        held.unsubscribe();
        clocks.delete(versionId);
        changed();
      },
      engine: (onRunEnd) => createTransientPlayback({
        subjectKey: `replay:${versionId}`,
        request: (commandId) => (api === null ? BUSY : api.requestReplay(replayId, versionId, commandId)),
        status: (artifactId) => (api === null ? Promise.resolve({ kind: 'UNKNOWN' as const }) : api.status(artifactId)),
        release: (artifactId) => (api === null ? Promise.resolve() : api.release(artifactId)),
        audioUrl: (artifactId) => (api === null ? '' : api.audioUrl(artifactId)),
        authorization: options.authorization,
        player: options.player,
        owner: options.owner,
        foreground: options.foreground,
        newCommandId: options.newCommandId,
        onRunEnd,
        ...(options.onEvent === undefined ? {} : { onEvent: options.onEvent }),
      }),
    });
    let seen = clock.getState();
    const unsubscribe = clock.subscribe(() => {
      if (clock.getState() === seen) return;
      seen = clock.getState();
      changed();
    });
    clocks.set(versionId, { clock, unsubscribe });
    changed();
    return clock;
  };

  return {
    clockSource,
    clockOf: (versionId) => clocks.get(versionId)?.clock ?? null,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    revision: () => revision,
    onAnnouncement(listener) {
      speakers.add(listener);
      return () => {
        speakers.delete(listener);
      };
    },
    retire() {
      if (retired) return;
      retired = true;
      for (const { clock } of Array.from(clocks.values())) clock.retire();
      clocks.clear();
      listeners.clear();
      speakers.clear();
    },
  };
}
