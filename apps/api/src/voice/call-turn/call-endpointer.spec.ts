import { CALL_ENDPOINTING, CallEndpointer, frameRms, type EndpointerEvent } from './call-endpointer';

const FRAME_BYTES = 640; // 20 ms of PCM s16le mono at 16 kHz
const loud = (): Buffer => {
  const pcm = Buffer.alloc(FRAME_BYTES);
  for (let i = 0; i < FRAME_BYTES / 2; i += 1) pcm.writeInt16LE(i % 2 === 0 ? 2_000 : -2_000, i * 2);
  return pcm;
};
const quiet = (): Buffer => Buffer.alloc(FRAME_BYTES);

/** Feeds `ms` of loud or quiet audio from `at`, returning the events with the instant they were produced. */
function feed(endpointer: CallEndpointer, kind: 'loud' | 'quiet', at: number, ms: number): Array<EndpointerEvent> {
  const events: EndpointerEvent[] = [];
  for (let t = at; t < at + ms; t += 20) events.push(...endpointer.push(kind === 'loud' ? loud() : quiet(), t));
  return events;
}

describe('S8B-05 CP2 the live call endpointer (D-A1, §5.1)', () => {
  it('is the frozen D-A1 timeline: 20 ms frames, RMS 300, 100 ms of speech, ForceEndOfUtterance at 500 ms, commit at 800 ms', () => {
    expect(CALL_ENDPOINTING).toEqual({ frameMs: 20, rmsThreshold: 300, minSpeechMs: 100, finalizeSilenceMs: 500, asrFinalTimeoutMs: 1000, commitSilenceMs: 800 });
    expect(frameRms(quiet())).toBe(0);
    expect(frameRms(loud())).toBe(2_000);
  });

  it('a turn: speech arms after 100 ms, FINALIZE after 500 ms of silence, COMMIT_SILENCE after 800 ms', () => {
    const e = new CallEndpointer();
    expect(feed(e, 'loud', 1_000, 600)).toEqual([{ kind: 'SPEECH_START', atMs: 1_000 }]);
    expect(e.state).toBe('SPEAKING');
    const silence = feed(e, 'quiet', 1_600, 1_000);
    expect(silence).toEqual([
      { kind: 'FINALIZE', atMs: 2_100, speechEndMs: 1_600 },
      { kind: 'COMMIT_SILENCE', atMs: 2_400, speechEndMs: 1_600 },
    ]);
    expect([e.state, e.turnStart, e.speechEnd]).toEqual(['PENDING_COMMIT', 1_000, 1_600]);
    e.reset();
    expect([e.state, e.turnStart]).toEqual(['IDLE', null]);
  });

  it('noise shorter than 100 ms never starts a turn', () => {
    const e = new CallEndpointer();
    expect([...feed(e, 'loud', 0, 80), ...feed(e, 'quiet', 80, 1_000)]).toEqual([]);
    expect(e.state).toBe('IDLE');
  });

  it('speech that resumes while FINALIZING or PENDING_COMMIT continues the SAME turn (no second SPEECH_START)', () => {
    const e = new CallEndpointer();
    feed(e, 'loud', 0, 400);
    expect(feed(e, 'quiet', 400, 600).map((x) => x.kind)).toEqual(['FINALIZE']);
    expect(feed(e, 'loud', 1_000, 200)).toEqual([{ kind: 'RESUMED', atMs: 1_000 }]);
    expect(feed(e, 'quiet', 1_200, 900).map((x) => x.kind)).toEqual(['FINALIZE', 'COMMIT_SILENCE']);
    expect(feed(e, 'loud', 2_100, 120)).toEqual([{ kind: 'RESUMED', atMs: 2_100 }]);
    expect([e.state, e.turnStart, e.speechEnd]).toEqual(['SPEAKING', 0, 2_220]);
  });
});
