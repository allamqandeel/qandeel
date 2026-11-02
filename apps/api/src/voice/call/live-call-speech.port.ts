/**
 * S8B-05 CP1 — where a live call's decoded uplink goes: PCM s16le mono 16 kHz, the recognizer's input (D-C1), in capture
 * order. CP2 binds the realtime recognizer here (endpointing, the user turn); CP1 binds NO recognizer: the null sink
 * below keeps nothing and sends nothing anywhere. No provider is reached in CP1.
 */
export const LIVE_CALL_SPEECH_SINK = Symbol('LIVE_CALL_SPEECH_SINK');

export interface LiveCallSpeechStream {
  /** One decoded 20 ms frame at its capture instant. Never awaited on the audio path. */
  push(pcm16k: Buffer, captureMs: number): void;
  close(): void;
}

export interface LiveCallSpeechSink {
  open(input: { readonly userId: string; readonly callId: string }): LiveCallSpeechStream;
}

/** CP1: the decoded audio stops here. */
export const NULL_LIVE_CALL_SPEECH_SINK: LiveCallSpeechSink = Object.freeze({
  open: (): LiveCallSpeechStream => ({ push: () => undefined, close: () => undefined }),
});
