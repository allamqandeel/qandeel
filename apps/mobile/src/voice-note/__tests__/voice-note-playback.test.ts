/**
 * S8B-03 (CP2, P4-C3 §1, contract §8.2 «الفقاعة») — one note plays at a time, read with the bearer in a HEADER, never
 * unseen, and a note that cannot be played now says so (C-39) and stays playable later.
 */
import { createManualForegroundSignal } from '../../runtime-entry';
import { createVoiceNotePlayback, VOICE_NOTE_LOAD_TIMEOUT_MS, type VoiceNotePlayerPort, type VoiceNotePlayerStatus } from '../voice-note-playback';

const A = 'a0000000-0000-4000-8000-00000000000a';
const B = 'b0000000-0000-4000-8000-00000000000b';

function fakePlayer() {
  const made: { url: string; headers: Record<string, string>; emit: (s: Partial<VoiceNotePlayerStatus>) => void; calls: string[] }[] = [];
  let fail = false;
  const port: VoiceNotePlayerPort = {
    create: async (url, headers, onStatus) => {
      if (fail) throw new Error('no player');
      const calls: string[] = [];
      made.push({
        url, headers, calls,
        emit: (s) => onStatus({ loaded: true, playing: true, positionMs: 0, durationMs: 4000, finished: false, failed: false, ...s }),
      });
      return {
        play: () => calls.push('play'),
        pause: () => calls.push('pause'),
        seekTo: async (ms) => {
          calls.push(`seek:${ms}`);
        },
        release: () => calls.push('release'),
      };
    },
  };
  return { port, made, failNext: () => (fail = true) };
}

function setup(header: Record<string, string> | null = { Authorization: 'Bearer t' }) {
  const player = fakePlayer();
  const foreground = createManualForegroundSignal('ACTIVE');
  const timers: { callback: () => void; ms: number; live: boolean }[] = [];
  const playback = createVoiceNotePlayback({
    player: player.port,
    urlOf: (id) => `https://api.test/voice/recordings/${id}/objects/NOTE/0`,
    authorization: () => header,
    foreground,
    setTimer: (callback, ms) => {
      const t = { callback, ms, live: true };
      timers.push(t);
      return t;
    },
    clearTimer: (t) => {
      (t as { live: boolean }).live = false;
    },
  });
  return { playback, player, foreground, timers };
}

describe('voice note playback', () => {
  it('reads the note with the bearer in a header, never in its URL, and plays it', async () => {
    const t = setup();
    await t.playback.toggle(A);
    expect(t.player.made).toHaveLength(1);
    expect(t.player.made[0].url).toBe(`https://api.test/voice/recordings/${A}/objects/NOTE/0`);
    expect(t.player.made[0].url).not.toMatch(/token|bearer|auth/iu);
    expect(t.player.made[0].headers).toEqual({ Authorization: 'Bearer t' });
    expect(t.player.made[0].calls).toEqual(['play']);
    expect(t.playback.getState().current).toEqual({ recordingId: A, phase: 'LOADING' });
    t.player.made[0].emit({ positionMs: 1200 });
    expect(t.playback.getState()).toEqual({ current: { recordingId: A, phase: 'PLAYING' }, positions: { [A]: 1200 } });
  });

  it('seek: a note not held keeps the position for its next play; a held note moves there and keeps playing', async () => {
    const t = setup();
    await t.playback.seek(A, 2500.4);
    expect(t.playback.getState().positions).toEqual({ [A]: 2500 });
    expect(t.player.made).toHaveLength(0);
    await t.playback.toggle(A);
    expect(t.player.made[0].calls).toEqual(['seek:2500', 'play']);
    t.player.made[0].emit({ positionMs: 2600 });
    expect(t.playback.getState().current?.phase).toBe('PLAYING');
    await t.playback.seek(A, 400);
    expect(t.player.made[0].calls).toEqual(['seek:2500', 'play', 'seek:400']);
    expect(t.playback.getState()).toEqual({ current: { recordingId: A, phase: 'PLAYING' }, positions: { [A]: 400 } });
    await t.playback.seek(A, -30);
    expect(t.playback.getState().positions[A]).toBe(0);
  });

  it('seek: while the player moves, its reports of the old position are not taken', async () => {
    const t = setup();
    await t.playback.toggle(A);
    const made = t.player.made[0];
    made.emit({ positionMs: 3000 });
    const pending = t.playback.seek(A, 500);
    made.emit({ positionMs: 3100 }); // a report from before the move lands
    expect(t.playback.getState().positions[A]).toBe(500);
    await pending;
    made.emit({ positionMs: 600 });
    expect(t.playback.getState().positions[A]).toBe(600);
  });

  it('a second tap pauses, a third resumes from the stored position on the same player', async () => {
    const t = setup();
    await t.playback.toggle(A);
    t.player.made[0].emit({ positionMs: 900 });
    await t.playback.toggle(A);
    expect(t.playback.getState().current?.phase).toBe('PAUSED');
    await t.playback.toggle(A);
    expect(t.playback.getState().current?.phase).toBe('PLAYING');
    expect(t.player.made).toHaveLength(1);
    expect(t.player.made[0].calls).toEqual(['play', 'pause', 'play']);
  });

  it('one note at a time: playing another releases the first; returning to it seeks to where it was', async () => {
    const t = setup();
    await t.playback.toggle(A);
    t.player.made[0].emit({ positionMs: 2500 });
    await t.playback.toggle(B);
    expect(t.player.made[0].calls).toEqual(['play', 'release']);
    expect(t.playback.getState().current?.recordingId).toBe(B);
    await t.playback.toggle(A);
    expect(t.player.made[2].calls).toEqual(['seek:2500', 'play']);
  });

  it('at the end the note rests at its start with its played mark kept', async () => {
    const t = setup();
    await t.playback.toggle(A);
    t.player.made[0].emit({ positionMs: 3900 });
    t.player.made[0].emit({ finished: true, playing: false, positionMs: 4000 });
    expect(t.playback.getState()).toEqual({ current: { recordingId: A, phase: 'PAUSED' }, positions: { [A]: 0 } });
  });

  it('QAN-BL-MOB-04: at the end the note stays still; only Play starts it again, from its start', async () => {
    // The Android player as Media3 behaves (expo-audio 57, BaseAudioPlayer.kt): `play()` / `pause()` set the wish to
    // play, the end does not clear it, and a seek on an ended player that still wishes to play resumes it.
    const made: { emit: (s: Partial<VoiceNotePlayerStatus>) => void; sounding: () => boolean; calls: string[] }[] = [];
    const port: VoiceNotePlayerPort = {
      create: async (_url, _headers, onStatus) => {
        const calls: string[] = [];
        let wish = false;
        let ended = false;
        let sounding = false;
        const status = (s: Partial<VoiceNotePlayerStatus>) => onStatus({ loaded: true, playing: sounding, positionMs: 0, durationMs: 4000, finished: false, failed: false, ...s });
        made.push({
          calls,
          sounding: () => sounding,
          emit: (s) => {
            if (s.finished === true) {
              ended = true;
              sounding = false;
            }
            status(s);
          },
        });
        return {
          play: () => { calls.push('play'); wish = true; sounding = true; ended = false; },
          pause: () => { calls.push('pause'); wish = false; sounding = false; },
          seekTo: async (ms) => {
            calls.push(`seek:${ms}`);
            if (ended && wish) {
              ended = false;
              sounding = true;
              status({ positionMs: ms });
            }
          },
          release: () => calls.push('release'),
        };
      },
    };
    const playback = createVoiceNotePlayback({
      player: port, urlOf: (id) => `https://api.test/voice/recordings/${id}/objects/NOTE/0`, authorization: () => ({ Authorization: 'Bearer t' }),
      foreground: createManualForegroundSignal('ACTIVE'), setTimer: () => null, clearTimer: () => undefined,
    });
    await playback.toggle(A);
    made[0].emit({ positionMs: 1200 });
    made[0].emit({ finished: true, playing: false, positionMs: 4000 });
    await Promise.resolve();
    expect(made[0].sounding()).toBe(false);
    expect(made[0].calls).toEqual(['play', 'pause', 'seek:0']);
    expect(playback.getState()).toEqual({ current: { recordingId: A, phase: 'PAUSED' }, positions: { [A]: 0 } });
    // Play alone starts it again, from its start; pause and resume are unchanged.
    await playback.toggle(A);
    expect(made[0].sounding()).toBe(true);
    expect(playback.getState().current).toEqual({ recordingId: A, phase: 'PLAYING' });
    await playback.toggle(A);
    expect(made[0].sounding()).toBe(false);
    expect(made[0].calls).toEqual(['play', 'pause', 'seek:0', 'play', 'pause']);
  });

  it('nothing plays unseen: leaving the foreground pauses, and a tap while away does nothing', async () => {
    const t = setup();
    await t.playback.toggle(A);
    t.player.made[0].emit({});
    t.foreground.set('INACTIVE');
    expect(t.playback.getState().current?.phase).toBe('PAUSED');
    expect(t.player.made[0].calls).toEqual(['play', 'pause']);
    await t.playback.toggle(A);
    expect(t.player.made[0].calls).toEqual(['play', 'pause']);
  });

  it('pause() (the reader left the conversation) pauses what plays and lets go of what was still loading', async () => {
    const t = setup();
    await t.playback.toggle(A);
    t.playback.pause();
    expect(t.playback.getState().current).toBeNull();
    expect(t.player.made[0].calls).toEqual(['play', 'release']);
    await t.playback.toggle(B);
    t.player.made[1].emit({});
    t.playback.pause();
    expect(t.playback.getState().current).toEqual({ recordingId: B, phase: 'PAUSED' });
  });

  it('C-39: no identity, a player that fails, a platform error or a note that never loads — FAILED, and playable again later', async () => {
    const none = setup(null);
    await none.playback.toggle(A);
    expect(none.playback.getState().current).toEqual({ recordingId: A, phase: 'FAILED' });
    expect(none.player.made).toHaveLength(0);

    const broken = setup();
    broken.player.failNext();
    await broken.playback.toggle(A);
    expect(broken.playback.getState().current?.phase).toBe('FAILED');

    const error = setup();
    await error.playback.toggle(A);
    error.player.made[0].emit({ failed: true });
    expect(error.playback.getState().current?.phase).toBe('FAILED');
    expect(error.player.made[0].calls).toEqual(['play', 'release']);
    await error.playback.toggle(A);
    expect(error.player.made).toHaveLength(2);

    const slow = setup();
    await slow.playback.toggle(A);
    const timer = slow.timers.find((x) => x.live);
    expect(timer?.ms).toBe(VOICE_NOTE_LOAD_TIMEOUT_MS);
    timer?.callback();
    expect(slow.playback.getState().current?.phase).toBe('FAILED');
    // A note that loaded clears its timer.
    const fast = setup();
    await fast.playback.toggle(A);
    fast.player.made[0].emit({});
    expect(fast.timers.every((x) => !x.live)).toBe(true);
  });

  it('forget releases a held note and drops its position; retire releases everything and ignores late events', async () => {
    const t = setup();
    await t.playback.toggle(A);
    t.player.made[0].emit({ positionMs: 700 });
    t.playback.forget(A);
    expect(t.playback.getState()).toEqual({ current: null, positions: {} });
    await t.playback.toggle(B);
    const late = t.player.made[1];
    t.playback.retire();
    expect(late.calls).toEqual(['play', 'release']);
    late.emit({ positionMs: 5 });
    expect(t.playback.getState().positions).toEqual({});
  });
});
