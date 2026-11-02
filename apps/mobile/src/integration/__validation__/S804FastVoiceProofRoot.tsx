/**
 * S8B-04 (CP2) — the Fast Voice Path feasibility proof root. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes an entry point only
 * when `apps/mobile/scripts/select-s804-proof-entry.mjs --apply` points `main` at `s804-proof-entry.tsx` for one proof
 * build (S804_DEVICE_PROOF=1), which the S8B-04 record names in its evidence.
 *
 * It answers, on a real Android runtime and with the installed `expo-audio`, the questions the Product Owner's Fast Voice
 * Path decision (2026-11-01) asks before any core is built — against `scripts/s8b-04/fake-fast-voice-server.cjs` reached
 * through `adb reverse` (`http://127.0.0.1:8804`). Every timing here is a SIMULATED provider; only the phone's part is real.
 *
 *   T1  one sentence streamed as a WAV of unknown length: does the platform player start before the stream ends?
 *   T2  a turn of released sentences, each streamed while produced, played through ONE playlist: first audible start,
 *       order, stalls between sentences; the held sentence is never offered or played.
 *   T3  pause, resume, then stop in the middle of a stream: nothing plays after stop.
 *   T4  play the same turn again: every sentence is replayed from the store, with no new synthesis.
 *   T5  the microphone: the S8B-03 M4A recorder and the PCM AudioStream TOGETHER (both orders): buffers, samples, gaps,
 *       and the M4A uploaded for the host prover.
 *   T6–T8  the whole reply as ONE stream with a server-announced final length: play, underrun, pause/stop, replay.
 *   T9  does one capture silence the other? alone → together → alone, both orders, levels per 250 ms window.
 *
 * CP2 — the PRODUCTION client code on the phone, against the fake server's API-shaped routes:
 *   T10 the automatic voice reply (createVoiceReplies + the Expo player port): it speaks by itself, the released text
 *       arrives by the long-poll, it stops itself at the announced length, then replay from the store (no new synthesis).
 *   T11 pause / resume on the one player, then quiet() while a reply is still produced: paused and synthesis stopped.
 *   T12 the live note (createVoiceLiveNotes + the Expo PCM port) beside the S8B-03 M4A recorder, on the real microphone:
 *       every chunk once and in order, a non-silent signal, and the M4A still recorded. SPEAK during it.
 *   UIar / UIen  the PRODUCTION Conversation with the automatic voice reply (S804UiProof), for the gate's captures.
 *
 * Each result is shown (testID `s804-log`) and posted to the fake server as numbers only: no audio, path or token.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  AudioModule,
  createAudioPlayer,
  createAudioPlaylist,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioPlaylist,
  type NativeAudioModule,
} from 'expo-audio';
import { createManualForegroundSignal } from '../../runtime-entry';
import { createDeviceVoiceDraftFiles } from '../../voice-note/voice-draft-store';
import { VoiceNoteApiClient, type VoiceNoteFetch } from '../../voice-note/voice-note-api';
import { createExpoVoiceNotePlayerPort } from '../../voice-note/voice-note-player-port';
import { createExpoVoicePcmStreamPort } from '../../voice-note/voice-pcm-stream-port';
import { createVoiceLiveNotes } from '../../voice-note/voice-live-note';
import { createVoiceReplies, type VoiceReplies, type VoiceReplyItem } from '../../voice-note/voice-reply';
import { platformRecordingOptions } from '../../voice-note/recording-options';
import type { ChromeLanguage } from '../../orientation-chrome';
import { S804UiProof } from './S804UiProof';

const BASE = 'http://127.0.0.1:8804';
const SAMPLE_EVERY_MS = 50;

type Sample = { t: number; index: number; time: number; playing: boolean; buffering: boolean; loaded: boolean };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clock = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

async function post(path: string, body: unknown): Promise<void> {
  try {
    await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    // The log is best effort; the screen keeps the result.
  }
}

// CP2: the production client, against the fake server. The bearer is a fixed proof value (no account exists here).
const PROOF_AUTH = { Authorization: 'Bearer s804-proof' };
const proofFetch: VoiceNoteFetch = (input, init) => fetch(input, { ...init, headers: { ...(init?.headers ?? {}), ...PROOF_AUTH } } as RequestInit);
const proofApi = () => new VoiceNoteApiClient({ baseUrl: BASE, fetch: proofFetch });
/** expo-audio's native module, typed: its recorder and stream classes are native members the import linter cannot see. */
const nativeAudio: NativeAudioModule = AudioModule;
/** A file-name stamp (outside render, so the render stays pure). */
const stamp = () => Date.now();
/** The one proof screen's mutable state: the player under test, the busy flag and the last turn (one instance only). */
const harness: {
  held: { player?: AudioPlayer; playlist?: AudioPlaylist } | null;
  busy: boolean;
  lastTurn: { turnId: string; segments: number[] } | null;
  lastReply: string | null;
} = { held: null, busy: false, lastTurn: null, lastReply: null };
/** The harness is written only through these (module scope, so a render never mutates it). */
const setHarness = (patch: Partial<typeof harness>) => { Object.assign(harness, patch); };
const randomId = () => `${Date.now().toString(16)}-${Math.floor(Math.random() * 1e9).toString(16)}`;

/** One automatic reply, started as the server's commit ?auto=1 would start it, watched through the production state. */
async function startProofReply(replies: VoiceReplies) {
  const start = (await (await fetch(`${BASE}/fv/live-reply/start`, { method: 'POST' })).json()) as { replyId: string; turnId: string };
  const t0 = clock();
  const phases: Array<{ phase: string; ms: number }> = [];
  const texts: Array<{ length: number; ms: number }> = [];
  let last: VoiceReplyItem | undefined;
  const unsubscribe = replies.subscribe(() => {
    const item = replies.getState().replies[start.turnId];
    if (!item) return;
    if (item.phase !== last?.phase) phases.push({ phase: item.phase, ms: Math.round(clock() - t0) });
    if ((item.text ?? '').length !== (last?.text ?? '').length) texts.push({ length: (item.text ?? '').length, ms: Math.round(clock() - t0) });
    last = item;
  });
  replies.start(start.turnId, start.replyId);
  const until = async (test: (item: VoiceReplyItem | undefined) => boolean, ms: number) => {
    const deadline = clock() + ms;
    while (clock() < deadline && !test(replies.getState().replies[start.turnId])) await wait(50);
    return replies.getState().replies[start.turnId];
  };
  return { ...start, t0, phases, texts, until, unsubscribe, item: () => replies.getState().replies[start.turnId] };
}

function proofReplies(exchanges: Array<{ ok: boolean; ms: number }>, t0: { value: number }) {
  return createVoiceReplies({
    api: proofApi(),
    player: createExpoVoiceNotePlayerPort(),
    authorization: () => PROOF_AUTH,
    foreground: createManualForegroundSignal('ACTIVE'),
    isCurrent: () => true,
    onExchange: (_turn, exchange) => exchanges.push({ ok: exchange !== null, ms: Math.round(clock() - t0.value) }),
  });
}

async function playbackMode(): Promise<void> {
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
}

/**
 * The recorder's file, read as a Blob (the platform reads a file URI natively) and posted as is; then removed through the
 * production Voice Note file port, so the harness itself touches no file API.
 */
async function uploadRecording(uri: string, name: string): Promise<number> {
  const blob = await (await fetch(uri)).blob();
  await fetch(`${BASE}/fv/upload?name=${name}`, { method: 'POST', body: blob });
  createDeviceVoiceDraftFiles().removeUri(uri);
  return blob.size;
}

/** Stalls: wall time spent "playing" while the position did not move, outside the very start. */
function analyse(samples: Sample[], t0: number) {
  const firstAudible = samples.find((s) => s.playing && s.time > 0.02);
  let stallMs = 0;
  let longestStallMs = 0;
  let run = 0;
  const order: number[] = [];
  for (let k = 1; k < samples.length; k += 1) {
    const a = samples[k - 1];
    const b = samples[k];
    if (order[order.length - 1] !== b.index) order.push(b.index);
    const advanced = b.index !== a.index || b.time > a.time + 0.001;
    if (firstAudible && b.t > firstAudible.t && a.playing && b.playing && !advanced) {
      run += b.t - a.t;
      stallMs += b.t - a.t;
      longestStallMs = Math.max(longestStallMs, run);
    } else run = 0;
  }
  return {
    firstAudibleMs: firstAudible ? Math.round(firstAudible.t - t0) : null,
    stallMs: Math.round(stallMs),
    longestStallMs: Math.round(longestStallMs),
    order,
  };
}

export function S804FastVoiceProofRoot() {
  const [log, setLog] = useState<string[]>(['S8B-04 fast voice proof ready']);
  const [ui, setUi] = useState<ChromeLanguage | null>(null);

  const say = (line: string) => setLog((lines) => [line, ...lines].slice(0, 40));

  const release = () => {
    try {
      harness.held?.player?.remove();
      harness.held?.playlist?.destroy?.();
    } catch {
      // Already gone.
    }
    setHarness({ held: null });
  };

  async function run(name: string, body: () => Promise<Record<string, unknown>>) {
    if (harness.busy) return;
    setHarness({ busy: true });
    say(`${name}: running`);
    try {
      const result = await body();
      await post('/fv/log', { test: name, ...result });
      say(`${name}: ${JSON.stringify(result)}`);
    } catch (error) {
      const result = { error: String((error as Error)?.message ?? error) };
      await post('/fv/log', { test: name, ...result });
      say(`${name}: ${JSON.stringify(result)}`);
    } finally {
      setHarness({ busy: false });
    }
  }

  // T1 — one sentence, unknown length, streamed while produced.
  const t1 = () => run('T1', async () => {
    await playbackMode();
    const start = await (await fetch(`${BASE}/fv/turn/start?first=0`, { method: 'POST' })).json();
    const t0 = clock();
    const samples: Sample[] = [];
    const player = createAudioPlayer({ uri: `${BASE}/fv/seg/${start.turnId}/0` }, { updateInterval: SAMPLE_EVERY_MS });
    setHarness({ held: { player } });
    let finished = false;
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      samples.push({ t: clock(), index: 0, time: s.currentTime, playing: s.playing, buffering: s.isBuffering, loaded: s.isLoaded });
      if (s.didJustFinish) finished = true;
    });
    player.play();
    const deadline = t0 + 15000;
    while (!finished && clock() < deadline) await wait(50);
    sub.remove();
    release();
    return { finished, ...analyse(samples, t0), heardS: Math.round((samples[samples.length - 1]?.time ?? 0) * 100) / 100 };
  });

  async function playTurn(turnId: string, segments: number[], control?: (p: AudioPlaylist, t0: number, firstAt: () => number | null) => Promise<void>) {
    const t0 = clock();
    const samples: Sample[] = [];
    const playlist = createAudioPlaylist({ sources: segments.map((i) => ({ uri: `${BASE}/fv/seg/${turnId}/${i}` })), updateInterval: SAMPLE_EVERY_MS });
    setHarness({ held: { playlist } });
    let finishedLast = false;
    const sub = playlist.addListener('playlistStatusUpdate', (s) => {
      samples.push({ t: clock(), index: s.currentIndex, time: s.currentTime, playing: s.playing, buffering: s.isBuffering, loaded: s.isLoaded });
      if (s.didJustFinish && s.currentIndex === segments.length - 1) finishedLast = true;
    });
    const changes: number[] = [];
    const subTrack = playlist.addListener('trackChanged', (d) => changes.push(d.currentIndex));
    playlist.play();
    const firstAt = () => samples.find((s) => s.playing && s.time > 0.02)?.t ?? null;
    if (control) await control(playlist, t0, firstAt);
    else {
      const deadline = t0 + 25000;
      while (!finishedLast && clock() < deadline) await wait(50);
    }
    const tail = samples[samples.length - 1];
    sub.remove();
    subTrack.remove();
    release();
    return { finishedLast, trackChanges: changes, lastIndex: tail?.index ?? null, ...analyse(samples, t0), samples };
  }

  // T2 — a turn: released sentences in order, the held one never offered.
  const t2 = () => run('T2', async () => {
    await playbackMode();
    const start = await (await fetch(`${BASE}/fv/turn/start`, { method: 'POST' })).json();
    const { samples, ...result } = await playTurn(start.turnId, start.segments);
    setHarness({ lastTurn: start });
    return { turnId: start.turnId, offered: start.segments, ...result, sampleCount: samples.length };
  });

  // T3 — pause, resume, stop mid-stream.
  const t3 = () => run('T3', async () => {
    await playbackMode();
    const start = await (await fetch(`${BASE}/fv/turn/start`, { method: 'POST' })).json();
    const marks: Record<string, number> = {};
    let positionAtStop = -1;
    let playedAfterStop = false;
    const { samples, ...result } = await playTurn(start.turnId, start.segments, async (playlist, t0, firstAt) => {
      while (firstAt() === null && clock() < t0 + 10000) await wait(20);
      await wait(1200);
      playlist.pause();
      marks.pausedAt = Math.round(clock() - t0);
      const pausedTime = playlist.currentTime;
      await wait(1000);
      marks.movedWhilePausedMs = Math.round((playlist.currentTime - pausedTime) * 1000);
      playlist.play();
      marks.resumedAt = Math.round(clock() - t0);
      await wait(1500);
      positionAtStop = playlist.currentTime;
      marks.stoppedAt = Math.round(clock() - t0);
      playlist.pause();
      release();
      await wait(1500);
      playedAfterStop = false; // The released playlist cannot report: nothing holds it.
    });
    return { turnId: start.turnId, ...marks, positionAtStopS: Math.round(positionAtStop * 100) / 100, playedAfterStop, ...result, sampleCount: samples.length };
  });

  // T4 — the same turn again: replayed from the store.
  const t4 = () => run('T4', async () => {
    await playbackMode();
    const turn = harness.lastTurn;
    if (!turn) return { skipped: 'run T2 first' };
    const before = await (await fetch(`${BASE}/fv/health`)).json();
    const { samples, ...result } = await playTurn(turn.turnId, turn.segments);
    const after = await (await fetch(`${BASE}/fv/health`)).json();
    return { turnId: turn.turnId, newSynthesisCalls: after.synthesisCalls - before.synthesisCalls, ...result, sampleCount: samples.length };
  });

  // T5 — the M4A recorder and the PCM stream together, in one order.
  async function micTogether(order: 'RECORDER_FIRST' | 'STREAM_FIRST', seconds: number) {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return { order, error: 'permission not granted' };
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
    const recorder = new nativeAudio.AudioRecorder(platformRecordingOptions());
    const stream = new nativeAudio.AudioStream({ sampleRate: 16000, channels: 1, encoding: 'int16' });
    let buffers = 0;
    let samples = 0;
    let sumSquares = 0;
    let lastTs = -1;
    let maxGapMs = 0;
    let reportedRate = 0;
    const sub = stream.addListener('audioStreamBuffer', (b: { data: ArrayBuffer; sampleRate: number; timestamp: number }) => {
      const view = new Int16Array(b.data);
      buffers += 1;
      samples += view.length;
      reportedRate = b.sampleRate;
      for (let k = 0; k < view.length; k += 1) sumSquares += view[k] * view[k];
      if (lastTs >= 0) maxGapMs = Math.max(maxGapMs, Math.round((b.timestamp - lastTs) * 1000));
      lastTs = b.timestamp;
    });
    const errors: string[] = [];
    const startRecorder = async () => {
      try {
        await recorder.prepareToRecordAsync();
        recorder.record();
      } catch (error) {
        errors.push(`recorder: ${String((error as Error)?.message ?? error)}`);
      }
    };
    const startStream = async () => {
      try {
        await stream.start();
      } catch (error) {
        errors.push(`stream: ${String((error as Error)?.message ?? error)}`);
      }
    };
    const t0 = clock();
    if (order === 'RECORDER_FIRST') {
      await startRecorder();
      await startStream();
    } else {
      await startStream();
      await startRecorder();
    }
    const startedMs = Math.round(clock() - t0);
    await wait(seconds * 1000);
    const midStatus = recorder.getStatus();
    const wallMs = Math.round(clock() - t0);
    stream.stop();
    try {
      await recorder.stop();
    } catch (error) {
      errors.push(`recorder stop: ${String((error as Error)?.message ?? error)}`);
    }
    sub.remove();
    const status = recorder.getStatus();
    let uploadBytes = 0;
    const name = `t5-${order.toLowerCase()}-${stamp()}.m4a`;
    try {
      if (recorder.uri) {
        uploadBytes = await uploadRecording(recorder.uri, name);
      }
    } catch (error) {
      errors.push(`upload: ${String((error as Error)?.message ?? error)}`);
    }
    try {
      recorder.release?.();
    } catch {
      // Released already.
    }
    return {
      order,
      startedMs,
      wallMs,
      streamBuffers: buffers,
      streamSamples: samples,
      reportedRate,
      expectedSamplesApprox: Math.round(((wallMs - startedMs) / 1000) * (reportedRate || 16000)),
      streamRms: samples ? Math.round(Math.sqrt(sumSquares / samples)) : 0,
      maxBufferGapMs: maxGapMs,
      recorderWasRecording: Boolean(midStatus?.isRecording),
      recorderDurationMs: Math.round(status?.durationMillis ?? midStatus?.durationMillis ?? 0),
      m4aName: uploadBytes ? name : null,
      m4aBytes: uploadBytes,
      errors,
    };
  }
  // T9 — does one capture silence the other? Phases of 2.5 s: A alone, A + B, A alone again (and the reverse order).
  // The stream's level per 250 ms window and the recorder's metering are sampled throughout, while the host plays sound.
  async function overlap(first: 'STREAM' | 'RECORDER') {
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
    const recorder = new nativeAudio.AudioRecorder({ ...platformRecordingOptions(), isMeteringEnabled: true });
    const stream = new nativeAudio.AudioStream({ sampleRate: 16000, channels: 1, encoding: 'int16' });
    const t0 = clock();
    let winSum = 0;
    let winN = 0;
    const streamRms: number[] = [];
    const meter: number[] = [];
    const phases: Record<string, number> = {};
    const errors: string[] = [];
    const sub = stream.addListener('audioStreamBuffer', (b: { data: ArrayBuffer }) => {
      const v = new Int16Array(b.data);
      for (let k = 0; k < v.length; k += 1) winSum += v[k] * v[k];
      winN += v.length;
    });
    let recording = false;
    const tick = setInterval(() => {
      streamRms.push(winN ? Math.round(Math.sqrt(winSum / winN)) : -1);
      winSum = 0;
      winN = 0;
      const st = recording ? recorder.getStatus() : null;
      meter.push(st && typeof st.metering === 'number' ? Math.round(st.metering) : -999);
    }, 250);
    const startRec = async () => {
      try { await recorder.prepareToRecordAsync(); recorder.record(); recording = true; } catch (e) { errors.push(`rec: ${String((e as Error)?.message ?? e)}`); }
    };
    const stopRec = async () => {
      try { recording = false; await recorder.stop(); } catch (e) { errors.push(`rec stop: ${String((e as Error)?.message ?? e)}`); }
    };
    const startStream = async () => {
      try { await stream.start(); } catch (e) { errors.push(`stream: ${String((e as Error)?.message ?? e)}`); }
    };
    if (first === 'STREAM') {
      await startStream(); phases.aloneFrom = Math.round(clock() - t0); await wait(2500);
      await startRec(); phases.bothFrom = Math.round(clock() - t0); await wait(2500);
      await stopRec(); phases.aloneAgainFrom = Math.round(clock() - t0); await wait(2500);
      stream.stop();
    } else {
      await startRec(); phases.aloneFrom = Math.round(clock() - t0); await wait(2500);
      await startStream(); phases.bothFrom = Math.round(clock() - t0); await wait(2500);
      stream.stop(); phases.aloneAgainFrom = Math.round(clock() - t0); await wait(2500);
      await stopRec();
    }
    clearInterval(tick);
    sub.remove();
    let m4aBytes = 0;
    const name = `t9-${first.toLowerCase()}-first-${stamp()}.m4a`;
    try {
      if (recorder.uri) {
        m4aBytes = await uploadRecording(recorder.uri, name);
      }
    } catch (e) {
      errors.push(`upload: ${String((e as Error)?.message ?? e)}`);
    }
    try { recorder.release?.(); } catch { /* released */ }
    return { first, phases, windowMs: 250, streamRms, recorderMeteringDb: meter, m4aName: m4aBytes ? name : null, m4aBytes, errors };
  }
  const t9 = () => run('T9', async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return { error: 'permission not granted' };
    const a = await overlap('STREAM');
    await wait(800);
    const b = await overlap('RECORDER');
    await playbackMode();
    return { a, b };
  });

  const t5 = () => run('T5', async () => {
    const a = await micTogether('RECORDER_FIRST', 6);
    await wait(800);
    const b = await micTogether('STREAM_FIRST', 6);
    await playbackMode();
    return { a, b };
  });

  // T6–T8 — the whole reply as ONE stream (the server writes every released sentence back to back); the phone learns the
  // final audio length from /status and stops itself there (an unknown-length WAV never reports its end on Android).
  async function playReply(turnId: string, opts: { pauseTest?: boolean; deadlineMs?: number } = {}) {
    const t0 = clock();
    const samples: Sample[] = [];
    const player = createAudioPlayer({ uri: `${BASE}/fv/reply/${turnId}` }, { updateInterval: SAMPLE_EVERY_MS });
    setHarness({ held: { player } });
    let endS: number | null = null;
    let stoppedAtEnd = false;
    let overrunMs: number | null = null;
    let bufferingSamples = 0;
    let finished = false;
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      samples.push({ t: clock(), index: 0, time: s.currentTime, playing: s.playing, buffering: s.isBuffering, loaded: s.isLoaded });
      if (s.isBuffering) bufferingSamples += 1;
      if (s.didJustFinish) finished = true;
      if (endS !== null && !stoppedAtEnd && s.currentTime >= endS - 0.04) {
        player.pause();
        stoppedAtEnd = true;
        overrunMs = Math.round((s.currentTime - endS) * 1000);
      }
    });
    player.play();
    const marks: Record<string, number> = {};
    let polling = true;
    const poll = (async () => {
      while (polling && endS === null) {
        try {
          const st = await (await fetch(`${BASE}/fv/reply/${turnId}/status`)).json();
          if (st.complete) {
            endS = st.audioMs / 1000;
            marks.endKnownAtMs = Math.round(clock() - t0);
          }
        } catch {
          // Retry.
        }
        await wait(200);
      }
    })();
    if (opts.pauseTest) {
      while (!samples.some((s) => s.playing && s.time > 0.02) && clock() < t0 + 10000) await wait(20);
      await wait(1200);
      player.pause();
      marks.pausedAt = Math.round(clock() - t0);
      const pausedTime = player.currentTime;
      await wait(1000);
      marks.movedWhilePausedMs = Math.round((player.currentTime - pausedTime) * 1000);
      player.play();
      marks.resumedAt = Math.round(clock() - t0);
      await wait(1500);
      marks.positionAtStopMs = Math.round(player.currentTime * 1000);
      player.pause();
      const at = player.currentTime;
      await wait(1500);
      marks.movedAfterStopMs = Math.round((player.currentTime - at) * 1000);
    } else {
      const deadline = t0 + (opts.deadlineMs ?? 30000);
      while (!stoppedAtEnd && !finished && clock() < deadline) await wait(50);
    }
    polling = false;
    await poll;
    sub.remove();
    release();
    const last = samples[samples.length - 1];
    return {
      ...marks,
      endS,
      stoppedAtEnd,
      overrunMs,
      finished,
      bufferingSamples,
      heardS: Math.round((last?.time ?? 0) * 100) / 100,
      ...analyse(samples, t0),
      sampleCount: samples.length,
    };
  }
  const t6 = () => run('T6', async () => {
    await playbackMode();
    const start = await (await fetch(`${BASE}/fv/turn/start?auto=1`, { method: 'POST' })).json();
    setHarness({ lastReply: start.turnId });
    return { turnId: start.turnId, ...(await playReply(start.turnId)) };
  });
  const t7 = () => run('T7', async () => {
    await playbackMode();
    const start = await (await fetch(`${BASE}/fv/turn/start?auto=1&gap=3000`, { method: 'POST' })).json();
    return { turnId: start.turnId, gap: 3000, ...(await playReply(start.turnId, { deadlineMs: 40000 })) };
  });
  const t8 = () => run('T8', async () => {
    await playbackMode();
    const start = await (await fetch(`${BASE}/fv/turn/start?auto=1`, { method: 'POST' })).json();
    const paused = await playReply(start.turnId, { pauseTest: true });
    await wait(4000);
    const before = await (await fetch(`${BASE}/fv/health`)).json();
    const replay = await playReply(start.turnId);
    const after = await (await fetch(`${BASE}/fv/health`)).json();
    return { turnId: start.turnId, paused, replay, replayNewSynthesisCalls: after.synthesisCalls - before.synthesisCalls };
  });

  // T10 — the automatic voice reply, end to end through the production client; then replay.
  const t10 = () => run('T10', async () => {
    await playbackMode();
    const exchanges: Array<{ ok: boolean; ms: number }> = [];
    const clockRef = { value: clock() };
    const replies = proofReplies(exchanges, clockRef);
    const reply = await startProofReply(replies);
    clockRef.value = reply.t0;
    const ended = await reply.until((item) => item?.phase === 'ENDED' || item?.phase === 'FAILED' || item?.phase === 'GONE', 30000);
    const before = await (await fetch(`${BASE}/fv/health`)).json();
    await replies.toggle(reply.turnId);
    const replayed = await reply.until((item) => item?.phase === 'ENDED' || item?.phase === 'FAILED', 30000);
    const after = await (await fetch(`${BASE}/fv/health`)).json();
    reply.unsubscribe();
    replies.retire();
    return {
      firstPlayingMs: reply.phases.find((p) => p.phase === 'PLAYING')?.ms ?? null,
      endedPhase: ended?.phase ?? null, final: ended?.final ?? null, textLength: ended?.text?.length ?? null,
      phases: reply.phases, texts: reply.texts, exchanges, replayPhase: replayed?.phase ?? null,
      replayNewSynthesisCalls: after.synthesisCalls - before.synthesisCalls,
    };
  });

  // T11 — pause / resume on the one player; then quiet() while a second reply is still produced.
  const t11 = () => run('T11', async () => {
    await playbackMode();
    const exchanges: Array<{ ok: boolean; ms: number }> = [];
    const clockRef = { value: clock() };
    const replies = proofReplies(exchanges, clockRef);
    const a = await startProofReply(replies);
    await a.until((item) => item?.phase === 'PLAYING', 10000);
    await wait(1000);
    await replies.toggle(a.turnId);
    const paused = a.item()?.phase ?? null;
    await wait(1500);
    const stillPaused = a.item()?.phase ?? null;
    await replies.toggle(a.turnId);
    const resumed = a.item()?.phase ?? null;
    const ended = await a.until((item) => item?.phase === 'ENDED' || item?.phase === 'FAILED', 30000);
    a.unsubscribe();
    const b = await startProofReply(replies);
    await b.until((item) => item?.phase === 'PLAYING', 10000);
    await wait(300);
    replies.quiet();
    await wait(1500);
    const quieted = b.item()?.phase ?? null;
    b.unsubscribe();
    replies.retire();
    return { paused, stillPaused, resumed, endedPhase: ended?.phase ?? null, phasesA: a.phases, quieted, phasesB: b.phases };
  });

  // T12 — the live note on the real microphone beside the M4A recorder (the session's order: recorder, then live note).
  const t12 = () => run('T12', async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return { error: 'permission not granted' };
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
    const recorder = new nativeAudio.AudioRecorder(platformRecordingOptions());
    await recorder.prepareToRecordAsync();
    recorder.record();
    let liveId = '';
    const notes = createVoiceLiveNotes({ api: proofApi(), stream: createExpoVoicePcmStreamPort(), newId: () => (liveId = randomId()) });
    await notes.begin('c0000000-0000-4000-8000-0000000000s8');
    say('T12: SPEAK NOW (6 s)');
    await wait(6000);
    const t0 = clock();
    const ref = await notes.finish();
    const finishMs = Math.round(clock() - t0);
    await recorder.stop();
    const recorded = recorder.getStatus();
    let m4aBytes = 0;
    if (recorder.uri) m4aBytes = await uploadRecording(recorder.uri, `t12-${stamp()}.m4a`);
    try { recorder.release?.(); } catch { /* released */ }
    const summary = liveId ? await (await fetch(`${BASE}/fv/live-notes/${liveId}`)).json() : null;
    return { ref: ref ?? null, finishMs, summary, recorderDurationMs: recorded.durationMillis ?? null, m4aBytes };
  });

  const buttons: Array<[string, () => void]> = [['T1', t1], ['T2', t2], ['T3', t3], ['T4', t4], ['T5', t5]];
  const buttons3: Array<[string, () => void]> = [['T10', t10], ['T11', t11], ['T12', t12], ['UIar', () => setUi('ar')], ['UIen', () => setUi('en')]];
  const buttons2: Array<[string, () => void]> = [['T6', t6], ['T7', t7], ['T8', t8], ['T9', t9]];
  if (ui !== null) return <S804UiProof language={ui} onClose={() => setUi(null)} />;
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.row, { marginBottom: 12 }]}>
        {buttons2.map(([label, onPress]) => (
          <Pressable key={label} testID={`s804-${label.toLowerCase()}`} accessibilityRole="button" accessibilityLabel={`s804-${label.toLowerCase()}`} onPress={onPress} style={styles.button}>
            <Text style={styles.buttonText}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        {buttons.map(([label, onPress]) => (
          <Pressable key={label} testID={`s804-${label.toLowerCase()}`} accessibilityRole="button" accessibilityLabel={`s804-${label.toLowerCase()}`} onPress={onPress} style={styles.button}>
            <Text style={styles.buttonText}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.row, { marginTop: 12 }]}>
        {buttons3.map(([label, onPress]) => (
          <Pressable key={label} testID={`s804-${label.toLowerCase()}`} accessibilityRole="button" accessibilityLabel={`s804-${label.toLowerCase()}`} onPress={onPress} style={styles.button}>
            <Text style={styles.buttonText}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView testID="s804-log" style={styles.log}>
        {log.map((line, i) => (
          <Text key={i} style={styles.line}>{line}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 48, backgroundColor: '#fff' },
  row: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8 },
  button: { minWidth: 56, minHeight: 48, borderRadius: 8, backgroundColor: '#123', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16 },
  log: { flex: 1, margin: 8 },
  line: { fontSize: 11, color: '#111', marginBottom: 6 },
});
