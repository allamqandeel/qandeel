/**
 * S8B-07 CP1-B step 5 (Sheet B) — the S7-04 player rendered with the original-audio surface, in Arabic and English: the
 * V2 pacing declaration (RA-01 / RA-02) in place of the V1 line, a text moment exactly as in V1, an audio moment with no
 * transcript (the server gives none: F-1, F-2 open) and never the original's text, the frame above the moment of another recording
 * (RA-05) and the recorded gap under it (RA-06), the proven or generic end (RA-09 / RA-10 / RA-17) with the reading
 * withheld (B13: no fallback), RA-12 with the existing «Try again», and a V1 version untouched. FUNCTIONAL only: what the
 * screen reader and the ear make of it is the device's (step 6).
 *
 * S8B-07 CP2-A.1 correction round ("REPLAY UI FINAL CORRECTION", Product Owner, 2026-11-28): the declaration of the pace
 * is the one timeline's accessibility hint, not a paragraph; RA-14's per-moment line is retired (the Replay has ONE
 * timeline); RA-11 / RA-12 / the ended row stand in the timeline's one held status line.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import { REPLAY_RENDER_CONTRACT_V1 } from '../../replay-composite';
import { replayEntryCopy } from '../../replay-entry';
import { REPLAY_PLAYER_TEST_ID, ReplayPlayer, replayPlayerCopy } from '../../replay-player';
import { resize } from '../../responsive/__fixtures__/composition';
import { originalAudioLengthText, originalAudioText } from '../original-audio-copy';
import { createReplayAudioSurface } from '../ReplayAudioViews';
import { RUN0, RUN1, run, until, world, type WorldOptions } from '../__fixtures__/replay-audio-world';

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
  const node = view.getByTestId(id, { includeHiddenElements: true });
  return (Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children) as string;
};
const TIMELINE = 'qandeel-replay-timeline-line';
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
  it('declares the V2 pace (RA-02, not the V1 line) on the timeline, never as a paragraph; a text moment is V1\'s, an audio moment its own surface with no transcript', async () => {
    const { view, w } = await mount(language);
    expect(view.getByTestId(TIMELINE).props.accessibilityHint).toBe(originalAudioText('RA-02', language));
    expect(view.getByTestId(TIMELINE).props.accessibilityHint).not.toBe(replayPlayerCopy(language).pacing);
    expect(view.queryByTestId('qandeel-replay-pacing')).toBeNull();
    // Moment 1 is text: the V1 source surface, no line and no derived caption.
    expect(w.ordinal()).toBe(1);
    expect(text(view, 'qandeel-replay-text')).toBe('first');
    expect(view.queryByTestId('qandeel-replay-derived')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-audio-line-1-line')).toBeNull();
    // Moment 2 is audio: its own source surface, never the original message's text, and no RA-03 transcript, since the
    // server gives none (F-1 on HONOR; F-2 open): nothing stands in for it, and it is never "not viewable".
    await show(w, 2);
    expect(view.queryByTestId('qandeel-replay-text')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-derived')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-not-viewable')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-source')).not.toBeNull();
    // No line of its own (RA-14 retired: one timeline), and no request until play.
    expect(view.queryByTestId('qandeel-replay-audio-line-2-line')).toBeNull();
    expect(w.server.calls).toHaveLength(0);
  });

  it("S8B-07 CP2-A.1 (PO direction): the part's timeline is there before the first Play, and a step on it asks for nothing", async () => {
    const { view, w } = await mount(language);
    const line = view.getByTestId(TIMELINE);
    expect(line.props.accessibilityValue.max).toBe(22);
    expect(line.props.accessibilityValue.now).toBe(0);
    expect(text(view, 'qandeel-replay-timeline-time')).toBe('0:00 / 0:22');
    await act(async () => { fireEvent(line, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }); });
    await tick();
    expect(view.getByTestId(TIMELINE).props.accessibilityValue.now).toBe(1);
    expect(w.server.calls).toHaveLength(0);
    expect(w.playing()).toBe(false);
  });

  it('S8B-07 CP2-A.1: with no map answer the timeline claims no length and cannot be moved before Play', async () => {
    const { view } = await mount(language, { map: () => Promise.resolve({ kind: 'UNAVAILABLE' }) });
    const line = view.getByTestId(TIMELINE);
    expect(line.props.accessibilityValue.max).toBeUndefined();
    expect(line.props.accessibilityState.disabled).toBe(true);
    expect(line.props.accessibilityActions).toEqual([]);
    expect(text(view, 'qandeel-replay-timeline-time')).toBe('');
    expect(view.queryByTestId('qandeel-replay-timeline-thumb')).toBeNull();
  });

  it('while playing: RA-11 after a second of preparing, in the held status line; no line of the moment\'s own (RA-14 retired)', async () => {
    const { view, w } = await mount(language);
    await show(w, 2);
    const held = view.getByTestId('qandeel-replay-timeline-status').props.style.height;
    await act(async () => { w.player.play(); });
    await tick(1_100);
    expect(text(view, 'qandeel-replay-audio-waiting')).toBe(originalAudioText('RA-11', language));
    expect(view.getByTestId('qandeel-replay-timeline-status').props.style.height).toBe(held);
    await act(async () => { await until(() => w.clock()!.getState().phase === 'RUNNING'); });
    await tick(2_500);
    expect(view.queryByTestId('qandeel-replay-audio-waiting')).toBeNull();
    expect(view.getByTestId('qandeel-replay-timeline-status').props.style.height).toBe(held);
    expect(view.queryByTestId('qandeel-replay-audio-line-2-line')).toBeNull();
    // The transport's play is the only one.
    expect(view.queryByTestId('qandeel-replay-audio-line-2-play')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-audio-line-2-play-unavailable')).toBeNull();
  });

  it('S8B-07 CP2-A.1: one timeline of the whole part, at the clock place; a step on it places the clock there', async () => {
    const { view, w } = await mount(language);
    await show(w, 2);
    await act(async () => { w.player.play(); });
    await act(async () => { await until(() => w.clock()!.getState().phase === 'RUNNING'); });
    await tick(2_500);
    const line = view.getByTestId(TIMELINE);
    // Named by the approved Replay name (no new word); its length is the whole part's (22.5 s), not the moment's.
    expect(line.props.accessibilityLabel).toBe(replayEntryCopy(language).replayName);
    expect(line.props.accessibilityValue.max).toBe(22);
    // Moment 2 starts 3.5 s into the part (after moment 1's reading pace): the line is the part's time, not the file's.
    expect(line.props.accessibilityValue.now).toBeGreaterThanOrEqual(5);
    expect(line.props.accessibilityValue.now).toBeLessThanOrEqual(6);
    // There is no second play control: the transport's is the only one.
    expect(view.queryByTestId('qandeel-replay-audio-timeline-play')).toBeNull();
    await act(async () => { w.player.pause(); });
    await tick();
    const before = w.clock()!.place();
    expect(before?.kind).toBe('RUN');
    await act(async () => { fireEvent(view.getByTestId(TIMELINE), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }); });
    await tick();
    const after = w.clock()!.place();
    expect(after).toMatchObject({ kind: 'RUN', runIndex: 0 });
    expect((after as { positionMs: number }).positionMs - (before as { positionMs: number }).positionMs).toBeGreaterThanOrEqual(900);
    expect((after as { positionMs: number }).positionMs - (before as { positionMs: number }).positionMs).toBeLessThanOrEqual(1_100);
    expect(w.clock()!.getState().phase).toBe('HELD');
    expect(w.playing()).toBe(false);
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

  it('RA-08\'s floor under the moment: a 999 ms writer loss has no line, a 1 000 ms one has RA-08; RA-06 is unchanged', async () => {
    const spans = [RUN0, [...RUN1,
      { kind: 'GAP', fromMs: 2_500, toMs: 3_499, track: 'USER', gapKind: 'WRITER_LOSS' },
      { kind: 'GAP', fromMs: 3_600, toMs: 4_600, track: 'USER', gapKind: 'WRITER_LOSS' },
    ] as const];
    const { view, w } = await mount(language, { server: { spans } });
    await show(w, 5);
    await act(async () => { w.player.play(); });
    await act(async () => { await until(() => w.clock()!.getState().ordinal === 6); });
    await tick(500);
    expect(text(view, 'qandeel-replay-audio-gap-6-1000')).toBe(originalAudioLengthText('RA-06', language, 1_000));
    expect(view.queryByTestId('qandeel-replay-audio-gap-6-2500')).toBeNull();
    expect(text(view, 'qandeel-replay-audio-gap-6-3600')).toBe(originalAudioLengthText('RA-08', language, 1_000));
    // The loss itself stays in the map: the server's spans are kept whole, only the line is not shown.
    expect(w.clock()!.detail().plan!.runs[1]!.spans.filter((span) => span.kind === 'GAP')).toHaveLength(3);
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
  it.each(['ar', 'en'] as const)('a V1 version keeps its own pacing declaration (on the timeline) and no audio surface (%s)', async (language) => {
    const { view, w } = await mount(language, { contract: REPLAY_RENDER_CONTRACT_V1, moments: [
      { ordinal: 1, tc: 1, sourceRole: 'USER', originalMedium: 'ORIGINAL_TEXT', omittedBefore: 0, text: 'first' },
      { ordinal: 2, tc: 2, sourceRole: 'ASSISTANT', originalMedium: 'ORIGINAL_TEXT', omittedBefore: 0, text: 'second' },
    ] });
    expect(w.clock()).toBeNull();
    expect(view.getByTestId(TIMELINE).props.accessibilityHint).toBe(replayPlayerCopy(language).pacing);
    expect(text(view, 'qandeel-replay-text')).toBe('first');
    expect(view.queryByTestId('qandeel-replay-derived')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-audio-waiting')).toBeNull();
  });
});
