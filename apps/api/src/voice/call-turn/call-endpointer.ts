/**
 * S8B-05 CP2 (contract v1.2 FINAL §5.1, D-A1) — the server's endpointer for a live call: one authority for the end of the
 * person's turn, testable without a device. It separates the five moments of §5.1:
 *
 *   1. a tentative pause      — the VAD on the decoded uplink (ported from `scripts/s8b-01/asr-sm-proof.mjs`
 *                               `causalEndpoints`: 20 ms frames, RMS ≥ 300 is speech, armed after 100 ms of speech);
 *   2. ForceEndOfUtterance    — after 500 ms of finalize silence (FINALIZE);
 *   3. the ASR final accepted — the recognizer's last FINAL after the force, or its 1000 ms timeout (the engine's part);
 *   4. the turn commit        — after 800 ms of commit silence (COMMIT_SILENCE), a starting value measured, not a law;
 *   5. DeepSeek starts        — only after the commit (the engine's part).
 *
 * Speech that resumes after FINALIZE or COMMIT_SILENCE takes the turn back to LISTENING: the SAME turn goes on, and its
 * finals are appended in order, so nothing is lost and nothing is said twice. Pure: no clock, no I/O; time is the
 * capture clock of the frames it is given.
 */
export const CALL_ENDPOINTING = Object.freeze({
  frameMs: 20,
  rmsThreshold: 300,
  minSpeechMs: 100,
  finalizeSilenceMs: 500,
  asrFinalTimeoutMs: 1000,
  commitSilenceMs: 800,
});

export type EndpointerEvent =
  /** The turn's speech started (armed), at the first loud frame of the run. */
  | { readonly kind: 'SPEECH_START'; readonly atMs: number }
  /** Speech came back after FINALIZE / COMMIT_SILENCE: the same turn goes on. */
  | { readonly kind: 'RESUMED'; readonly atMs: number }
  /** 500 ms of silence after armed speech: send ForceEndOfUtterance. `speechEndMs` = where the silence began. */
  | { readonly kind: 'FINALIZE'; readonly atMs: number; readonly speechEndMs: number }
  /** 800 ms of silence: the turn may be committed (once the ASR final is accepted). */
  | { readonly kind: 'COMMIT_SILENCE'; readonly atMs: number; readonly speechEndMs: number };

export type EndpointerState = 'IDLE' | 'SPEAKING' | 'FINALIZING' | 'PENDING_COMMIT';

/** The RMS of one frame of PCM s16le. */
export function frameRms(pcm: Buffer): number {
  const samples = Math.floor(pcm.length / 2);
  if (samples === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples; i += 1) {
    const v = pcm.readInt16LE(i * 2);
    sum += v * v;
  }
  return Math.sqrt(sum / samples);
}

export class CallEndpointer {
  private stateValue: EndpointerState = 'IDLE';
  private speechRun = 0;
  private runStartMs = 0;
  private silentSince: number | null = null;
  private turnStartMs: number | null = null;
  private lastSpeechEndMs = 0;

  constructor(private readonly config: typeof CALL_ENDPOINTING = CALL_ENDPOINTING) {}

  get state(): EndpointerState {
    return this.stateValue;
  }

  /** Where the current turn's speech started (null before it armed). */
  get turnStart(): number | null {
    return this.turnStartMs;
  }

  /** Where the current turn's speech last ended. */
  get speechEnd(): number {
    return this.lastSpeechEndMs;
  }

  /** One 20 ms frame at its capture instant; the events it causes, in order. */
  push(pcm: Buffer, captureMs: number): EndpointerEvent[] {
    const { frameMs, rmsThreshold, minSpeechMs, finalizeSilenceMs, commitSilenceMs } = this.config;
    const events: EndpointerEvent[] = [];
    const endMs = captureMs + frameMs;
    if (frameRms(pcm) >= rmsThreshold) {
      if (this.speechRun === 0) this.runStartMs = captureMs;
      this.speechRun += frameMs;
      this.silentSince = null;
      if (this.speechRun >= minSpeechMs) {
        if (this.stateValue === 'IDLE') {
          this.turnStartMs = this.runStartMs;
          events.push({ kind: 'SPEECH_START', atMs: this.runStartMs });
        } else if (this.stateValue === 'FINALIZING' || this.stateValue === 'PENDING_COMMIT') {
          events.push({ kind: 'RESUMED', atMs: this.runStartMs });
        }
        this.stateValue = 'SPEAKING';
        this.lastSpeechEndMs = endMs;
      }
      return events;
    }
    this.speechRun = 0;
    this.silentSince ??= captureMs;
    if (this.stateValue === 'IDLE') return events;
    const silence = endMs - this.silentSince;
    if (this.stateValue === 'SPEAKING' && silence >= finalizeSilenceMs) {
      this.stateValue = 'FINALIZING';
      events.push({ kind: 'FINALIZE', atMs: endMs, speechEndMs: this.lastSpeechEndMs });
    }
    if (this.stateValue === 'FINALIZING' && silence >= commitSilenceMs) {
      this.stateValue = 'PENDING_COMMIT';
      events.push({ kind: 'COMMIT_SILENCE', atMs: endMs, speechEndMs: this.lastSpeechEndMs });
    }
    return events;
  }

  /** The turn was committed (or dropped): the next speech starts a new turn. */
  reset(): void {
    this.stateValue = 'IDLE';
    this.turnStartMs = null;
    this.speechRun = 0;
  }
}
