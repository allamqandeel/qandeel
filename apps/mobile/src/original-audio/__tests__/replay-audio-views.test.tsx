/**
 * S8B-07 CP1-B step 5 (Sheet B) — the S7-04 player rendered with the original-audio surface, in Arabic and English: the
 * V2 pacing declaration (RA-01 / RA-02) in place of the V1 line, a text moment exactly as in V1, an audio moment's
 * transcript under RA-03 (never as the original), its line (RA-14), the frame above the moment of another recording
 * (RA-05) and the recorded gap under it (RA-06), the proven or generic end (RA-09 / RA-10 / RA-17) with the reading
 * withheld (B13: no fallback), RA-12 with the existing «Try again», and a V1 version untouched. FUNCTIONAL only: what the
 * screen reader and the ear make of it is the device's (step 6).
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import { REPLAY_RENDER_CONTRACT_V1 } from '../../replay-composite';
import { REPLAY_PLAYER_TEST_ID, ReplayPlayer, replayPlayerCopy } from '../../replay-player';
import { resize } from '../../responsive/__fixtures__/composition';
import { originalAudioLengthText, originalAudioText } from '../original-audio-copy';
import { createReplayAudioSurface } from '../ReplayAudioViews';
import { run, until, world, type WorldOptions } from '../__fixtures__/replay-audio-world';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.setTimeout(60000);

const INSETS = { top: 24, right: 0, bottom: 16, left: 0 };
const appearance = () => createAppearanceAuthority({
  store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
  system: { current: () => 'DARK', subscribe: () => () => undefined },
  native: { apply: () => undefined },
});
const tick = (ms = 0) => act(async () => { await run(ms); });

async function mount(language: 'ar' | 'en', options: WorldOptions = {}) {
  const w = world(options);
  const surface = createReplayAudioSurface(w.audio, w.player);
  const view: RenderResult = await render(
    <AppearanceProvider authority={appearance()}><ReplayPlayer controller={w.player} language={language} insets={INSETS} surface={surface} /></AppearanceProvider>,
  );
  await act(async () => { await w.open(); });
  await tick();
  await resize(view, 390, 844, { mapHeight: 420 });
  await tick();
  expect(view.queryByTestId(REPLAY_PLAYER_TEST_ID)).not.toBeNull();
  return { w, view };
}

const text = (view: RenderResult, id: string) => {
  const node = view.getByTestId(id);
  return (Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children) as string;
};
const show = async (w: ReturnType<typeof world>, ordinal: number) => {
  await act(async () => { w.player.seek(ordinal); });
  await tick();
};

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
});

describe.each(['ar', 'en'] as const)('the V2 player surface (%s)', (language) => {
  it('declares the V2 pace (RA-02, not the V1 line); a text moment is V1\'s, an audio moment its transcript under RA-03', async () => {
    const { view, w } = await mount(language);
    expect(text(view, 'qandeel-replay-pacing')).toBe(originalAudioText('RA-02', language));
    expect(text(view, 'qandeel-replay-pacing')).not.toBe(replayPlayerCopy(language).pacing);
    // Moment 1 is text: the V1 source surface, no line and no derived caption.
    expect(w.ordinal()).toBe(1);
    expect(text(view, 'qandeel-replay-text')).toBe('first');
    expect(view.queryByTestId('qandeel-replay-derived')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-audio-line-1-line')).toBeNull();
    // Moment 2 is audio: the transcript is shown as DERIVED, never as the original message.
    await show(w, 2);
    expect(view.queryByTestId('qandeel-replay-text')).toBeNull();
    expect(text(view, 'qandeel-replay-derived-caption')).toBe(originalAudioText('RA-03', language));
    expect(text(view, 'qandeel-replay-derived-text')).toBe('heard two');
    expect(view.getByTestId('qandeel-replay-derived').props.accessibilityLabel).toBe(`${originalAudioText('RA-03', language)} heard two`);
    expect(view.queryByTestId('qandeel-replay-source')).not.toBeNull();
    // Nothing is known of the audio before the map arrives: no line yet, and no request until play.
    expect(view.queryByTestId('qandeel-replay-audio-line-2-line')).toBeNull();
    expect(w.server.calls).toHaveLength(0);
  });

  it('while playing: RA-11 after a second of preparing, then the moment\'s line (RA-14) at its window position', async () => {
    const { view, w } = await mount(language);
    await show(w, 2);
    await act(async () => { w.player.play(); });
    await tick(1_100);
    expect(text(view, 'qandeel-replay-audio-waiting')).toBe(originalAudioText('RA-11', language));
    await act(async () => { await until(() => w.clock()!.getState().phase === 'RUNNING'); });
    await tick(2_500);
    expect(view.queryByTestId('qandeel-replay-audio-waiting')).toBeNull();
    const line = view.getByTestId('qandeel-replay-audio-line-2-line');
    expect(line.props.accessibilityLabel).toBe(originalAudioText('RA-14', language));
    expect(line.props.accessibilityValue.now).toBeGreaterThan(0);
    // The line is the moment's, never a play control of its own: the player's transport is the only one.
    expect(view.queryByTestId('qandeel-replay-audio-line-2-play')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-audio-line-2-play-unavailable')).toBeNull();
  });

  it('the moment of another recording carries RA-05 above it, and its recorded drop RA-06 under it', async () => {
    const { view, w } = await mount(language);
    // From moment 5 (text) into 6: played, as the last moment cannot be started (play there restarts from the first).
    await show(w, 5);
    await act(async () => { w.player.play(); });
    await act(async () => { await until(() => w.clock()!.getState().ordinal === 6); });
    await tick(500);
    expect(w.ordinal()).toBe(6);
    expect(view.getByTestId('qandeel-replay-audio-before-6').props.accessibilityLabel).toBe(originalAudioText('RA-05', language));
    expect(text(view, 'qandeel-replay-audio-gap-6-1000')).toBe(originalAudioLengthText('RA-06', language, 1_000));
    // Moment 2 is the first of its recording: no frame above it.
    await show(w, 2);
    expect(view.queryByTestId('qandeel-replay-audio-before-2')).toBeNull();
  });

  it('the source deleted: RA-10 only because the server proves it, the reading withheld, nothing plays after (B13)', async () => {
    const { view, w } = await mount(language, { server: { sourceReason: 'DELETED' } });
    await show(w, 2);
    await act(async () => { w.player.play(); });
    await tick(3_000);
    w.server.deleteSource();
    await act(async () => { await until(() => w.clock()!.getState().phase === 'ENDED'); });
    await tick();
    expect(text(view, 'qandeel-replay-audio-ended')).toBe(originalAudioText('RA-10', language));
    expect(view.queryByTestId('qandeel-replay-pacing')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-derived')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-text')).toBeNull();
    await show(w, 1);
    expect(view.queryByTestId('qandeel-replay-text')).toBeNull();
  });

  it('a cause the server does not prove: RA-17, never RA-09 or RA-10', async () => {
    const { view, w } = await mount(language, { server: { sourceReason: undefined, sourceEndsInMs: 4_000 } });
    await show(w, 2);
    await act(async () => { w.player.play(); });
    await act(async () => { await until(() => w.clock()!.getState().phase === 'ENDED'); });
    await tick();
    const ended = text(view, 'qandeel-replay-audio-ended');
    const reason = w.clock()!.detail().engine.endedReason;
    expect(ended).toBe(originalAudioText(reason === 'EXPIRED' ? 'RA-09' : reason === 'DELETED' ? 'RA-10' : 'RA-17', language));
  });

  it('no media service or a full pool: RA-12 and the existing «Try again», which asks again', async () => {
    const { view, w } = await mount(language);
    w.server.busy = 1;
    await show(w, 2);
    await act(async () => { w.player.play(); });
    await tick(500);
    expect(text(view, 'qandeel-replay-audio-failed-text')).toBe(originalAudioText('RA-12', language));
    await act(async () => { await fireEvent.press(view.getByTestId('qandeel-replay-audio-retry')); });
    await act(async () => { await until(() => w.clock()!.getState().phase === 'RUNNING'); });
    await tick();
    expect(view.queryByTestId('qandeel-replay-audio-failed')).toBeNull();
    expect(w.playing()).toBe(true);
  });
});

describe('V1 is untouched by the surface', () => {
  it.each(['ar', 'en'] as const)('a V1 version keeps its own pacing line and no audio surface (%s)', async (language) => {
    const { view, w } = await mount(language, { contract: REPLAY_RENDER_CONTRACT_V1, moments: [
      { ordinal: 1, tc: 1, sourceRole: 'USER', originalMedium: 'ORIGINAL_TEXT', omittedBefore: 0, text: 'first' },
      { ordinal: 2, tc: 2, sourceRole: 'ASSISTANT', originalMedium: 'ORIGINAL_TEXT', omittedBefore: 0, text: 'second' },
    ] });
    expect(w.clock()).toBeNull();
    expect(text(view, 'qandeel-replay-pacing')).toBe(replayPlayerCopy(language).pacing);
    expect(text(view, 'qandeel-replay-text')).toBe('first');
    expect(view.queryByTestId('qandeel-replay-derived')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-audio-waiting')).toBeNull();
  });
});
