/**
 * S7-04 — the player's passage over the REAL-PATH wire, through the production clients, the S7-03 composite and the
 * production Living Analysis surface: what the reader sees, hears and can press.
 *
 * S8B-07 CP2-A.1 correction round ("REPLAY UI FINAL CORRECTION", Product Owner, 2026-11-28): the Replay has ONE timeline
 * (the Temporal Spine, the pace paragraph and the position line are no longer drawn; the pace is the timeline's hint and
 * the position its value), and the top band is one row. RE-ANCHORED here, with the same approved words.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import { MAP_SURFACE_TEST_ID } from '../../map';
import { REPLAY_COSMOS_TEST_ID } from '../../replay-cosmos';
import { REPLAY_COMPOSITE_TEST_ID } from '../../replay-composite';
import { replayEntryCopy } from '../../replay-entry';
import { resize } from '../../responsive/__fixtures__/composition';
import { REPLAY_PLAYER_COPY_GATE, REPLAY_PLAYER_COPY_ROWS, REPLAY_PLAYER_TEST_ID, ReplayPlayer, createReplayPlayerController, type ReplayPlayerController, type ReplayPlayerScheduler } from '..';
import { PLAYER_IDS, PLAYER_WIRE, capturedHandoff, capturedIds, playerClients, playerServer, type PlayerServerOptions } from '../__fixtures__/player-wire';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

// The player renders the whole S7-03 composite and the Living Analysis surface; a full parallel run is slower than 5 s.
jest.setTimeout(60000);

const INSETS = { top: 24, right: 0, bottom: 16, left: 0 };
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
const flush = () => act(async () => { for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve)); });
const MOMENTS = (PLAYER_WIRE.scenes.preview.moments as { moments: { ordinal: number; text: string }[] }).moments;

const appearance = () => createAppearanceAuthority({
  store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
  system: { current: () => 'DARK', subscribe: () => () => undefined },
  native: { apply: () => undefined },
});

function readerFacing(root: unknown, out: string[] = []): string[] {
  if (typeof root === 'string') { out.push(root); return out; }
  if (root === null || typeof root !== 'object') return out;
  if (Array.isArray(root)) { for (const child of root) readerFacing(child, out); return out; }
  const node = root as { props?: Record<string, unknown>; children?: unknown };
  const props = node.props ?? {};
  for (const key of ['accessibilityLabel', 'accessibilityHint', 'accessibilityValue']) if (typeof props[key] === 'string') out.push(props[key] as string);
  readerFacing(node.children, out);
  return out;
}

function manual() {
  const pending = new Map<number, () => void>();
  let n = 0;
  const scheduler: ReplayPlayerScheduler = { set: (run) => { n += 1; pending.set(n, run); return n; }, clear: (h) => { pending.delete(h as number); } };
  return { scheduler, pending, fire: () => { const [[h, run]] = [...pending]; pending.delete(h); run(); } };
}

async function mount(language: 'ar' | 'en', ids: string[] = [], options: PlayerServerOptions = {}) {
  const server = playerServer(options);
  const clock = manual();
  const player: ReplayPlayerController = createReplayPlayerController({
    sessionId: PLAYER_IDS.session, ...playerClients(server), isCurrent: () => true, newCommandId: capturedIds('preview', ...ids), scheduler: clock.scheduler,
  });
  const view: RenderResult = await render(<AppearanceProvider authority={appearance()}><ReplayPlayer controller={player} language={language} insets={INSETS} /></AppearanceProvider>);
  expect(view.queryByTestId(REPLAY_PLAYER_TEST_ID)).toBeNull();
  await act(async () => player.openSaved(capturedHandoff('draft')));
  await flush();
  await resize(view, 390, 844, { mapHeight: 420 });
  await flush();
  return { view, player, server, clock };
}

const text = (view: RenderResult, id: string) => {
  const node = view.getByTestId(id, { includeHiddenElements: true });
  return (Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children) as string;
};
const press = async (view: RenderResult, id: string) => {
  await fireEvent.press(view.getByTestId(id));
  await flush();
};
/** To a moment (the timeline's seek lands on a moment through the same controller). */
const go = async (player: ReplayPlayerController, ordinal: number) => {
  await act(async () => { player.seek(ordinal); });
  await flush();
};
const TIMELINE = 'qandeel-replay-timeline-line';
const flat = (style: unknown) => [style].flat(Infinity).reduce((all: Record<string, unknown>, s: unknown) => ({ ...all, ...(s as object) }), {});

afterEach(async () => {
  await cleanup();
  delete (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__;
});

describe('S7-04 — the passage', () => {
  it('is modal, on the ONE Living Analysis surface, with the historical message and its Map at that moment', async () => {
    const { view } = await mount('ar');
    const passage = view.getByTestId(REPLAY_PLAYER_TEST_ID);
    expect(passage.props.accessibilityViewIsModal).toBe(true);
    expect(view.getByTestId(REPLAY_COMPOSITE_TEST_ID)).toBeTruthy();
    expect(text(view, 'qandeel-replay-text')).toBe(MOMENTS[0].text);
    // REPLAY-COSMOS-01 RE-ANCHOR: the moment's world is the Replay's COSMOS stage (it was T-04's MapSurface).
    expect(view.queryByTestId(REPLAY_COSMOS_TEST_ID)).not.toBeNull();
    expect(view.queryByTestId(MAP_SURFACE_TEST_ID)).toBeNull();
    // The top band, one row: the way back (frozen W1A-01 label), the approved title (said as the header), and the private lifecycle.
    expect(view.getByTestId('qandeel-replay-player-back').props.accessibilityLabel).toBe('المحادثة');
    expect(text(view, 'qandeel-replay-player-title')).toBe('إعادة عرض المحادثة');
    expect(view.getByTestId('qandeel-replay-player-title').props.accessibilityRole).toBe('header');
    expect(view.getByTestId('qandeel-replay-player-finalize').props.accessibilityLabel).toBe('حفظ نسخة خاصة');
    expect(view.getByTestId('qandeel-replay-player-reopen').props.accessibilityLabel).toBe('تعديل إعادة العرض');
    // P2's play and the ONE timeline: named by the approved Replay name, its value the time and the approved position,
    // its hint the declared pace. No Spine, no pace paragraph, no position line (CP2-A.1 correction round).
    expect(view.getByTestId('qandeel-replay-play').props.accessibilityLabel).toBe('تشغيل');
    const line = view.getByTestId(TIMELINE);
    expect(line.props.accessibilityRole).toBe('adjustable');
    expect(line.props.accessibilityLabel).toBe('إعادة عرض المحادثة');
    expect(line.props.accessibilityHint).toBe('تُعرض الرسائل نصًّا بإيقاع مناسب للقراءة، لا بتوقيتها الأصلي.');
    expect(line.props.accessibilityValue).toMatchObject({ min: 0, now: 0 });
    expect(line.props.accessibilityValue.text).toMatch(/^0:00 \/ \d+:\d\d، في إعادة العرض: 1 من 6\.$/u);
    expect(view.queryByTestId('qandeel-replay-spine')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-pacing')).toBeNull();
    expect(view.queryByTestId('qandeel-replay-position')).toBeNull();
    expect(view.queryAllByTestId(TIMELINE)).toHaveLength(1);
    // The moment starts are the line's notches: one for each later moment.
    expect(view.queryAllByTestId(/^qandeel-replay-timeline-mark-/u, { includeHiddenElements: true })).toHaveLength(5);
  });

  it('the timeline moves the composite to the moment at that time, forward and back, and stops at both ends; its place is said', async () => {
    const { view, player } = await mount('ar');
    const line = () => view.getByTestId(TIMELINE);
    const max = line().props.accessibilityValue.max as number;
    await act(async () => { fireEvent(line(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } }); });
    await flush();
    expect(text(view, 'qandeel-replay-text')).toBe(MOMENTS[0].text);
    expect(line().props.accessibilityValue.now).toBe(0);
    // Step forward until the second moment is reached: the reading follows the line's time, and the value says where.
    for (let i = 0; i < 60 && player.getState().open?.ordinal === 1; i += 1) {
      await act(async () => { fireEvent(line(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }); });
      await flush();
    }
    expect(text(view, 'qandeel-replay-text')).toBe(MOMENTS[1].text);
    expect(line().props.accessibilityValue.text).toContain('في إعادة العرض: 2 من 6.');
    // And back.
    await act(async () => { fireEvent(line(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } }); });
    await flush();
    expect(text(view, 'qandeel-replay-text')).toBe(MOMENTS[0].text);
    for (let i = 0; i < 80 && line().props.accessibilityValue.now < max; i += 1) {
      await act(async () => { fireEvent(line(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }); });
      await flush();
    }
    expect(text(view, 'qandeel-replay-text')).toBe(MOMENTS[5].text);
    expect(line().props.accessibilityValue.now).toBe(max);
    expect(view.getByTestId('qandeel-replay-play').props.accessibilityLabel).toBe('التشغيل من البداية');
  });

  it('play steps at the declared pace and says Pause while it plays; no sound or video exists anywhere', async () => {
    const { view, clock } = await mount('ar');
    await press(view, 'qandeel-replay-play');
    expect(view.getByTestId('qandeel-replay-play').props.accessibilityLabel).toBe('إيقاف مؤقت');
    expect(clock.pending.size).toBe(1);
    await act(async () => clock.fire());
    await flush();
    expect(text(view, 'qandeel-replay-text')).toBe(MOMENTS[1].text);
    await press(view, 'qandeel-replay-play');
    expect(clock.pending.size).toBe(0);
    expect(view.getByTestId('qandeel-replay-play').props.accessibilityLabel).toBe('تشغيل');
    const said = readerFacing(view.toJSON()).join(' ');
    for (const word of ['صوت', 'فيديو', 'استماع', 'audio', 'Audio', 'video', 'Video']) expect(said).not.toContain(word);
  });

  it('finalize says the copy is private and offers no share, publish or export of any kind', async () => {
    const { view, server } = await mount('ar', ['finalize']);
    await press(view, 'qandeel-replay-player-finalize');
    expect(server.uncaptured).toEqual([]);
    expect(text(view, 'qandeel-replay-player-sentence')).toBe('حُفظت نسخة خاصة من إعادة العرض، ولا تُشارك مع أحد.');
    expect(view.queryByTestId('qandeel-replay-player-finalize')).toBeNull();
    expect(view.getByTestId('qandeel-replay-player-reopen')).toBeTruthy();
    const said = readerFacing(view.toJSON());
    for (const words of said) expect(words).not.toMatch(/مشاركة|نشر|تصدير|إرسال|Share|Publish|Export|Send/u);
  });

  it('Back (the control or Android Back) closes the passage, and nothing of it stays', async () => {
    type Handler = Parameters<typeof BackHandler.addEventListener>[1];
    const handlers: Handler[] = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      handlers.push(handler);
      return { remove: () => { handlers.splice(handlers.indexOf(handler), 1); } };
    });
    const { view, player } = await mount('ar');
    expect(handlers).toHaveLength(1);
    await act(async () => { expect(handlers[handlers.length - 1]({ type: 'hardwareBackPress', timeStamp: 0 } as never)).toBe(true); });
    await flush();
    expect(view.queryByTestId(REPLAY_PLAYER_TEST_ID)).toBeNull();
    expect(handlers).toHaveLength(0);
    await act(async () => player.openSaved(capturedHandoff('draft')));
    await flush();
    await press(view, 'qandeel-replay-player-back');
    expect(view.queryByTestId(REPLAY_PLAYER_TEST_ID)).toBeNull();
    spy.mockRestore();
  });
});

describe('S7-04 — Arabic RTL, English, accessibility and Reduced Motion', () => {
  it('the reading direction lays out the transport and the band; the reader side is set physically for Android', async () => {
    // The transport's row and the band's status are physical rows (Android does not mirror inside an LTR root): play at
    // the reader's start, the time at the far end; the elapsed part grows from the reader's start.
    const row = (view: RenderResult) => flat((view.getByTestId('qandeel-replay-transport').children[0] as unknown as { props: { style: unknown } }).props.style);
    const ar = await mount('ar');
    expect(row(ar.view).flexDirection).toBe('row-reverse');
    expect(flat(ar.view.getByTestId('qandeel-replay-timeline-elapsed', { includeHiddenElements: true }).props.style).right).toBe(8);
    expect(flat(ar.view.getByTestId('qandeel-replay-player-status').props.style)).toMatchObject({ direction: 'ltr', flexDirection: 'row-reverse', justifyContent: 'flex-end' });
    await cleanup();
    const en = await mount('en');
    expect(row(en.view).flexDirection).toBe('row');
    expect(flat(en.view.getByTestId('qandeel-replay-timeline-elapsed', { includeHiddenElements: true }).props.style).left).toBe(8);
    expect(flat(en.view.getByTestId('qandeel-replay-player-status').props.style)).toMatchObject({ direction: 'ltr', flexDirection: 'row', justifyContent: 'flex-end' });
    expect(en.view.getByTestId('qandeel-replay-player-back').props.accessibilityLabel).toBe('Conversation');
    expect(en.view.getByTestId('qandeel-replay-play').props.accessibilityLabel).toBe('Play');
    expect(en.view.getByTestId(TIMELINE).props.accessibilityLabel).toBe('Conversation replay');
    expect(en.view.getByTestId(TIMELINE).props.accessibilityHint).toBe('Messages are shown as text at a reading pace, not at their original timing.');
    // The historical Arabic message keeps its own start in an English reader.
    expect(en.view.getByTestId('qandeel-replay-text').props.style.textAlign).toBe('right');
  });

  it('Reduced Motion shows the same moment and the same controls; the player adds no motion to reduce', async () => {
    const normal = await mount('ar');
    const before = readerFacing(normal.view.toJSON());
    await cleanup();
    (globalThis as { __QANDEEL_TEST_REDUCED_MOTION__?: boolean }).__QANDEEL_TEST_REDUCED_MOTION__ = true;
    const reduced = await mount('ar');
    expect(readerFacing(reduced.view.toJSON())).toEqual(before);
  });

  it('every control is at least the 44 pt target, and has its own accessible name', async () => {
    const { view } = await mount('ar');
    for (const id of ['qandeel-replay-player-back', 'qandeel-replay-player-finalize', 'qandeel-replay-player-reopen', 'qandeel-replay-play']) {
      const node = view.getByTestId(id);
      expect(node.props.accessibilityRole).toBe('button');
      expect(typeof node.props.accessibilityLabel).toBe('string');
      const style = [node.props.style].flat(Infinity).reduce((all: Record<string, unknown>, s: unknown) => ({ ...all, ...(s as object) }), {});
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('S7-05 — one name for the Replay (D2)', () => {
  it.each([['ar', 'إعادة عرض المحادثة'], ['en', 'Conversation replay']] as const)('%s: the player is titled with the same approved name the entry controls are labelled with', async (language, name) => {
    const { view } = await mount(language);
    expect(replayEntryCopy(language).replayName).toBe(name);
    const title = view.getByTestId('qandeel-replay-player-title');
    expect(title.props.children).toBe(name);
    expect(title.props.accessibilityRole).toBe('header');
  });
});

describe('S7-04 — F-2: no Session context, id or Reading scope reaches the reader', () => {
  it('S7-05: the wire carries no Session at all (a Reading scope is its class); nothing the reader sees or hears contains one, or any id', async () => {
    // The answers the player is served: every Reading scope is the class `CONVERSATION_SESSION`, and the conversation's
    // Session appears in no answer (only in what the client itself sends: the list path and the draft body).
    const answers = JSON.stringify([Object.values(PLAYER_WIRE.steps).map((step) => step.body), PLAYER_WIRE.scenes]);
    expect(answers).not.toContain(PLAYER_IDS.session);
    expect(answers).not.toContain('CONVERSATION_SESSION:');
    expect(new Set(answers.match(/"scope":"[^"]*"/gu))).toEqual(new Set(['"scope":"CONVERSATION_SESSION"']));
    const { view, player } = await mount('ar', ['finalize']);
    for (let i = 0; i < 6; i += 1) {
      for (const words of readerFacing(view.toJSON())) {
        expect(words).not.toMatch(UUID);
        expect(words).not.toContain('CONVERSATION_SESSION');
        expect(words).not.toContain(PLAYER_IDS.session);
      }
      if (i < 5) await go(player, i + 2);
    }
    await press(view, 'qandeel-replay-player-finalize');
    for (const words of readerFacing(view.toJSON())) expect(words).not.toMatch(UUID);
  });
});

/** The Product Owner's decision of 2026-10-20, word for word: [Arabic, English] per key. */
const APPROVED_COPY: Readonly<Record<string, readonly [string, string]>> = {
  play: ['تشغيل', 'Play'],
  pause: ['إيقاف مؤقت', 'Pause'],
  restart: ['التشغيل من البداية', 'Play from the start'],
  moments: ['لحظات إعادة العرض', 'Replay moments'],
  pacing: ['تُعرض الرسائل نصًّا بإيقاع مناسب للقراءة، لا بتوقيتها الأصلي.', 'Messages are shown as text at a reading pace, not at their original timing.'],
  preview: ['معاينة', 'Preview'],
  finalize: ['حفظ نسخة خاصة', 'Save a private copy'],
  finalized: ['نسخة خاصة محفوظة', 'Private copy saved'],
  finalizedNotice: ['حُفظت نسخة خاصة من إعادة العرض، ولا تُشارك مع أحد.', "A private copy of the Replay was saved. It isn't shared with anyone."],
  reopen: ['تعديل إعادة العرض', 'Edit the Replay'],
  reopenedNotice: ['أصبحت إعادة العرض مسودة يمكن تعديلها.', 'The Replay is a draft again and can be edited.'],
  analysisChanged: ['تغيّر التحليل منذ المعاينة، فلا يمكن حفظ هذه النسخة.', "The analysis changed since the preview, so this version can't be saved."],
  commandUnconfirmed: ['تعذّر التأكد من إتمام ذلك.', "We couldn't confirm whether the action was completed."],
};

describe('S7-04 — the Product Copy Gate is CLOSED (Product Owner, 2026-10-20)', () => {
  it('all 13 rows are APPROVED in Arabic AND English, each exactly as the Product Owner wrote it', () => {
    expect(REPLAY_PLAYER_COPY_GATE.status).toContain('CLOSED');
    expect(REPLAY_PLAYER_COPY_GATE.decidedOn).toBe('2026-10-20');
    expect(Object.keys(REPLAY_PLAYER_COPY_ROWS)).toEqual(Object.keys(APPROVED_COPY));
    for (const [key, row] of Object.entries(REPLAY_PLAYER_COPY_ROWS)) {
      expect([row.ar, row.en]).toEqual(APPROVED_COPY[key]);
      expect(row.status).toBe('APPROVED');
      expect(row.enStatus).toBe('APPROVED');
    }
    expect(REPLAY_PLAYER_COPY_GATE.arabicApproved).toEqual(Object.keys(APPROVED_COPY));
    expect(REPLAY_PLAYER_COPY_GATE.englishApproved).toEqual(Object.keys(APPROVED_COPY));
  });
});
