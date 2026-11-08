/** S8B-07 CP1-B — the injection tokens the Replay pool's modules share (no module imports another's file for them). */
export const REPLAY_DATABASE = Symbol('REPLAY_DATABASE');
export const TRANSIENT_AUDIO_STORE = Symbol('TRANSIENT_AUDIO_STORE');
/** Step 3: the Replay Media Service's response timing (contract §15.1, §19.1). */
export const TRANSIENT_STREAM_TIMING = Symbol('TRANSIENT_STREAM_TIMING');
