/**
 * S6-05 (CP5) — the Mutual Match acceptance and the Introduction World on the device, in Arabic and English, Dark and
 * Light: the approved copy word for word against the Copy Gate record; the strict transport; the controller's retry
 * identities, isolation and server-confirmed ENDED; and the V-1 surfaces — S1–S15b — with the 2px start-edge seam, the
 * tools (back and END only), IW-35 only on the server's own ended answer, END and the closed record, deletion before and
 * after END, both humans' discovery, and «العالم المشترك»'s separate «التعارف» section.
 *
 * The appearance is the REAL authority; the controllers are the REAL controllers over scripted transports.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import { CANONICAL_VISUAL } from '../../conversation/visual/canonical-visual.generated';
import type { ChromeLanguage } from '../../orientation-chrome';
import {
  IntroductionWorldsApiClient, createManualForegroundSignal, type IntroductionEndResult, type IntroductionHistoryRead, type IntroductionMessage,
  type IntroductionMessagesRead, type IntroductionSendResult, type IntroductionWorld, type IntroductionWorldsRead, type PrivateProposal,
  type ProposalAcceptance, type ProposalsRead, type SharedDeleteResult, type SharedRootResult,
} from '../../runtime-entry';
import { sharedConversationCopy } from '../../shared-world/conversation-copy';
import { sharedCopy } from '../../shared-world/copy';
import { sharedLifecycleCopy } from '../../shared-world/lifecycle-copy';
import { createSharedWorldController } from '../../shared-world/shared-world-controller';
import { SharedWorldArea } from '../../shared-world/SharedWorldArea';
import {
  INTRODUCTION_WORLD_COPY_GATE, INTRODUCTION_WORLD_COPY_ROWS, IntroductionWorldSurface, ProposalsSurface, createIntroductionWorldsController,
  createProposalsController, introductionWorldCopy, proposalsCopy, type IntroductionWorldsController,
} from '..';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const P = CANONICAL_VISUAL.palettes;
const W1 = '51111111-1111-4111-8111-111111111111';
const W2 = '52222222-2222-4222-8222-222222222222';
const PR1 = '53333333-3333-4333-8333-333333333333';
const PR2 = '54444444-4444-4444-8444-444444444444';
const V1 = '55555555-5555-4555-8555-555555555555';
const M1 = '56666666-6666-4666-8666-666666666661';
const M2 = '56666666-6666-4666-8666-666666666662';
const M3 = '56666666-6666-4666-8666-666666666663';
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const GATE = readFileSync(join(__dirname, '../../../../../docs/e2e/QANDEEL_S6_05_VISUAL_COPY_GATE_v1.md'), 'utf8');

const msg = (materialId: string, producer: 'SELF' | 'HUMAN', text: string, at: string): IntroductionMessage =>
  ({ materialId, producer, text, establishedAt: at, canDelete: producer === 'SELF' });
const HELLO = msg(M1, 'HUMAN', 'Hello there', '2026-10-16T10:00:00+00:00');
const MINE = msg(M2, 'SELF', 'Nice to meet you', '2026-10-16T10:01:00+00:00');
const world = (over: Partial<IntroductionWorld> = {}): IntroductionWorld => ({ worldId: W1, proposalId: PR1, state: 'ACTIVE', otherFirstName: 'Reem', ...over });

type Answer<T> = T | (() => Promise<T>);
const take = async <T,>(queue: Answer<T>[], fallback: () => T): Promise<T> => {
  const next = queue.shift();
  if (next === undefined) return fallback();
  return typeof next === 'function' ? (next as () => Promise<T>)() : next;
};
/** A deferred answer the test releases by hand. */
function later<T>() {
  let release!: (value: T) => void;
  const promise = new Promise<T>((resolve) => { release = resolve; });
  return { answer: () => promise, release };
}

function worldsServer(initial: { worlds?: IntroductionWorld[]; messages?: IntroductionMessage[]; history?: IntroductionMessage[] } = {}) {
  let worlds = initial.worlds ?? [world()];
  let page: IntroductionMessagesRead = { kind: 'PAGE', messages: initial.messages ?? [HELLO, MINE], hasOlder: false };
  let closed: IntroductionHistoryRead = { kind: 'PAGE', messages: initial.history ?? [HELLO, MINE], hasOlder: false };
  const q = {
    list: [] as Answer<IntroductionWorldsRead>[], messages: [] as Answer<IntroductionMessagesRead>[], history: [] as Answer<IntroductionHistoryRead>[],
    send: [] as Answer<IntroductionSendResult>[], end: [] as Answer<IntroductionEndResult>[], del: [] as Answer<SharedDeleteResult>[],
  };
  const calls = {
    lists: 0, messages: [] as { worldId: string; before: unknown }[], history: [] as { worldId: string; before: unknown }[],
    send: [] as { worldId: string; commandId: string; content: string }[], end: [] as { worldId: string; commandId: string }[],
    del: [] as { worldId: string; materialId: string; commandId: string }[],
  };
  return {
    q, calls,
    setWorlds(next: IntroductionWorld[]) { worlds = next; },
    setPage(next: IntroductionMessagesRead) { page = next; },
    setHistory(next: IntroductionHistoryRead) { closed = next; },
    transport: {
      list: async () => { calls.lists += 1; return take(q.list, () => ({ kind: 'READ' as const, worlds })); },
      messages: async (worldId: string, before: unknown) => { calls.messages.push({ worldId, before }); return take(q.messages, () => page); },
      history: async (worldId: string, before: unknown) => { calls.history.push({ worldId, before }); return take(q.history, () => closed); },
      send: async (worldId: string, commandId: string, content: string) => {
        calls.send.push({ worldId, commandId, content });
        return take(q.send, () => ({ kind: 'COMMITTED' as const, materialId: M3, establishedAt: '2026-10-16T10:02:00+00:00' }));
      },
      end: async (worldId: string, commandId: string) => { calls.end.push({ worldId, commandId }); return take(q.end, () => ({ kind: 'ENDED' as const })); },
    },
    deletion: {
      deleteMaterial: async (worldId: string, materialId: string, commandId: string) => {
        calls.del.push({ worldId, materialId, commandId });
        return take(q.del, () => ({ kind: 'DELETED' as const }));
      },
    },
  };
}

let ids = 0;
const nextId = () => `c0000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`;
function controllerOf(server: ReturnType<typeof worldsServer>, extra: { isCurrent?: () => boolean; foreground?: ReturnType<typeof createManualForegroundSignal> } = {}) {
  return createIntroductionWorldsController({
    transport: server.transport, deletion: server.deletion, isCurrent: extra.isCurrent ?? (() => true), foreground: extra.foreground, newCommandId: nextId,
  });
}

function appearance(preference: 'DARK' | 'LIGHT') {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: preference }), system: { current: () => 'DARK', subscribe: () => () => undefined }, native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
}

async function worldView(language: ChromeLanguage, server: ReturnType<typeof worldsServer>, preference: 'DARK' | 'LIGHT' = 'DARK', worldId = W1) {
  const controller = controllerOf(server);
  const onBack = jest.fn();
  const view = await render(
    <AppearanceProvider authority={appearance(preference)}>
      <IntroductionWorldSurface controller={controller} worldId={worldId} language={language} insets={INSETS} onBack={onBack} />
    </AppearanceProvider>,
  );
  await flush();
  await flush();
  return { view, controller, onBack };
}
async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await flush();
  await flush();
}
const words = (view: RenderResult) => view.getAllByText(/.+/u).map((node) => String(node.props.children));

// ---------------------------------------------------------------------------------------------------------------------
describe('the S6-05 Copy Gate, word for word', () => {
  const table = new Map<string, { ar: string; en: string; status: string }>();
  for (const line of GATE.split(/\r?\n/u)) {
    if (!/^\| (IW|M)-/u.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    table.set(cells[0].split(' ')[0], { ar: cells[2], en: cells[3], status: cells[4] });
  }

  it('every row is the gate record\'s APPROVED row in both languages; 30 rows; M-12 is not used anywhere', () => {
    const rows = Object.values(INTRODUCTION_WORLD_COPY_ROWS);
    expect(rows).toHaveLength(30);
    expect(new Set(rows.map((r) => r.id)).size).toBe(30);
    for (const row of rows) {
      const approved = table.get(row.id);
      expect(approved?.status).toMatch(/^APPROVED/u);
      expect(row.ar).toBe(approved!.ar.replace('{الاسم الأول}', '{0}'));
      expect(row.en).toBe(approved!.en.replace('{first name}', '{0}'));
    }
    expect(table.get('M-12')?.status).toMatch(/^Not used \(R-2\)/u);
    expect(INTRODUCTION_WORLD_COPY_GATE.notUsed).toEqual(['M-12']);
    for (const file of readdirSync(join(__dirname, '..')).filter((f) => /\.tsx?$/u.test(f))) {
      expect(readFileSync(join(__dirname, '..', file), 'utf8')).not.toContain('أنا معكما في البداية');
    }
  });

  it('IW-03b is the Product Owner\'s rev.3 correction and IW-22 keeps «ولكل» exactly', () => {
    expect(INTRODUCTION_WORLD_COPY_ROWS.acceptNameOnly.ar).toBe('عند بدء التعارف، لا يُعرض للطرف الآخر من ملفك سوى اسمك الأول للتعارف.');
    expect(INTRODUCTION_WORLD_COPY_ROWS.welcome.ar).toContain('ولكل منكما حرية الاستمرار');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('the Introduction World transport decodes strictly', () => {
  const answer = (status: number, body: unknown) => {
    const requests: { url: string; init: { method?: string; body?: string } }[] = [];
    const fetch = async (url: string, init: { method?: string; body?: string }) => {
      requests.push({ url, init });
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    };
    return { requests, client: new IntroductionWorldsApiClient({ baseUrl: 'https://api', fetch: fetch as never }) };
  };
  const offline = new IntroductionWorldsApiClient({ baseUrl: 'x', fetch: (async () => { throw new Error('offline'); }) as never });

  it('a World and a message are exactly what the server answers; anything else is no answer', async () => {
    const good = { worlds: [{ worldId: W1, proposalId: PR1, state: 'ACTIVE', otherFirstName: 'Reem' }] };
    expect((await answer(200, good).client.list()).kind).toBe('READ');
    for (const bad of [
      { worlds: [{ ...good.worlds[0], accountName: 'Reem Full' }] }, { worlds: [{ ...good.worlds[0], state: 'SUCCESS' }] },
      { worlds: [{ ...good.worlds[0], otherFirstName: '' }] }, { worlds: [good.worlds[0], good.worlds[0]] }, { worlds: good.worlds, extra: 1 },
    ]) expect((await answer(200, bad).client.list()).kind).toBe('UNAVAILABLE');
    expect((await offline.list()).kind).toBe('OFFLINE');
    const page = { outcome: 'ACTIVE', messages: [{ materialId: M1, producer: 'HUMAN', text: 'hi', establishedAt: '2026-10-16T10:00:00.123+00:00', canDelete: false }], hasOlder: true };
    expect(await answer(200, page).client.messages(W1, null)).toMatchObject({ kind: 'PAGE', hasOlder: true });
    for (const bad of [
      { ...page, messages: [{ ...page.messages[0], canDelete: true }] }, { ...page, messages: [{ ...page.messages[0], producer: 'QANDEEL' }] },
      { ...page, messages: [{ ...page.messages[0], authorName: 'x' }] }, { ...page, outcome: 'ENDED' },
    ]) expect((await answer(200, bad).client.messages(W1, null)).kind).toBe('FAILED');
  });

  it('ENDED is reported only when the server answered it in full; a 5xx, a timeout or a doubtful body never is', async () => {
    expect((await answer(200, { outcome: 'ENDED' }).client.messages(W1, null)).kind).toBe('ENDED');
    expect((await answer(200, { outcome: 'ENDED', materialId: null, establishedAt: null }).client.send(W1, 'c', 't')).kind).toBe('FAILED');
    expect((await answer(200, { outcome: 'ENDED', reason: 'x' }).client.messages(W1, null)).kind).toBe('FAILED');
    expect((await answer(503, { outcome: 'ENDED' }).client.send(W1, 'c', 't')).kind).toBe('FAILED');
    expect((await offline.send(W1, 'c', 't')).kind).toBe('OFFLINE');
    expect((await answer(400, {}).client.send(W1, 'c', 't')).kind).toBe('INVALID');
    expect((await answer(200, { outcome: 'COMMITTED', materialId: M3, establishedAt: '2026-10-16T10:02:00+00:00' }).client.send(W1, 'c', 't')))
      .toEqual({ kind: 'COMMITTED', materialId: M3, establishedAt: '2026-10-16T10:02:00+00:00' });
    for (const outcome of ['ENDED', 'ALREADY_SETTLED', 'UNAVAILABLE'] as const) expect((await answer(200, { outcome }).client.end(W1, 'c')).kind).toBe(outcome);
    expect((await answer(503, {}).client.end(W1, 'c')).kind).toBe('FAILED');
    expect((await answer(200, { outcome: 'ACTIVE', messages: [], hasOlder: false }).client.history(W1, null)).kind).toBe('FAILED');
    expect((await answer(200, { outcome: 'ENDED', messages: [], hasOlder: false }).client.history(W1, null)).kind).toBe('PAGE');
  });

  it('it sends exactly the routes and bodies of CP3, CP4 and S6-02: no user, counterpart or audience', async () => {
    const send = answer(200, { outcome: 'UNAVAILABLE' });
    await send.client.send(W1, 'cmd', 'hello');
    await send.client.end(W1, 'cmd2');
    await send.client.history(W1, { materialId: M1, establishedAt: '2026-10-16T10:00:00+00:00' });
    await send.client.messages(W1, null);
    await send.client.list();
    expect(send.requests.map((r) => [r.init.method, r.url, r.init.body ?? null])).toEqual([
      ['POST', `https://api/introductions/worlds/${W1}/messages`, JSON.stringify({ commandId: 'cmd', content: 'hello' })],
      ['POST', `https://api/introductions/worlds/${W1}/end`, JSON.stringify({ commandId: 'cmd2' })],
      ['GET', `https://api/introductions/worlds/${W1}/history/before/${M1}/2026-10-16T10%3A00%3A00%2B00%3A00`, null],
      ['GET', `https://api/introductions/worlds/${W1}/messages`, null],
      ['GET', 'https://api/introductions/worlds', null],
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('the Introduction World controller', () => {
  it('nothing of a World before its read; the name comes from the reader\'s own list; UNAVAILABLE clears everything', async () => {
    const server = worldsServer();
    const gate = later<IntroductionMessagesRead>();
    server.q.messages.push(gate.answer);
    const c = controllerOf(server);
    c.open(W1);
    expect(c.getState().open).toMatchObject({ worldId: W1, status: 'LOADING', messages: [] });
    gate.release({ kind: 'PAGE', messages: [HELLO], hasOlder: false });
    await flush();
    expect(c.getState().open).toMatchObject({ status: 'ACTIVE', messages: [HELLO] });
    expect(c.getState().list.worlds[0].otherFirstName).toBe('Reem');
    server.q.messages.push({ kind: 'UNAVAILABLE' });
    c.refresh();
    await flush();
    expect(c.getState().open).toMatchObject({ status: 'UNAVAILABLE', messages: [], pending: null });
  });

  it('a lost send is retried with the SAME command id; a refused one is not; COMMITTED is the server\'s message', async () => {
    const server = worldsServer();
    const c = controllerOf(server);
    c.open(W1);
    await flush();
    server.q.send.push({ kind: 'OFFLINE' }, { kind: 'FAILED' });
    expect(c.send('  ')).toBe(false);
    expect(c.send('one')).toBe(true);
    expect(c.send('two')).toBe(false); // one message at a time
    await flush();
    expect(c.getState().open?.pending).toEqual({ text: 'one', status: 'OFFLINE' });
    c.retrySend();
    await flush();
    expect(c.getState().open?.pending).toEqual({ text: 'one', status: 'FAILED' });
    c.retrySend();
    await flush();
    expect(server.calls.send.map((s) => s.commandId)).toEqual([server.calls.send[0].commandId, server.calls.send[0].commandId, server.calls.send[0].commandId]);
    expect(c.getState().open?.pending).toBeNull();
    server.q.send.push({ kind: 'COMMAND_CONFLICT' });
    c.send('three');
    await flush();
    c.retrySend();
    await flush();
    expect(server.calls.send[4].commandId).not.toBe(server.calls.send[3].commandId);
  });

  it('IW-35 only on the server\'s ended answer: the World turns to its closed record read from the reader\'s own entitlement', async () => {
    const server = worldsServer();
    const c = controllerOf(server);
    c.open(W1);
    await flush();
    for (const kind of ['FAILED', 'OFFLINE', 'INVALID'] as const) {
      server.q.send.push({ kind });
      if (c.getState().open?.pending === null) c.send('hello'); else c.retrySend();
      await flush();
      expect(c.getState().open?.pending?.status).not.toBe('ENDED');
      expect(c.getState().open?.status).toBe('ACTIVE');
    }
    server.q.send.push({ kind: 'ENDED' });
    c.retrySend();
    await flush();
    await flush();
    expect(c.getState().open).toMatchObject({ status: 'CLOSED', pending: { text: 'hello', status: 'ENDED' }, messages: [HELLO, MINE] });
    expect(server.calls.history).toHaveLength(1);
  });

  it('END is the reader\'s alone, retried with the SAME id; ENDED and ALREADY_SETTLED close it; UNAVAILABLE reveals nothing', async () => {
    const server = worldsServer();
    const c = controllerOf(server);
    c.open(W1);
    await flush();
    server.q.end.push({ kind: 'OFFLINE' }, { kind: 'FAILED' });
    expect(await c.endIntroduction()).toBe('OFFLINE');
    expect(c.getState().open?.end).toBe('FAILED');
    expect(await c.endIntroduction()).toBe('FAILED');
    expect(await c.endIntroduction()).toBe('ENDED');
    await flush();
    expect(new Set(server.calls.end.map((e) => e.commandId)).size).toBe(1);
    expect(c.getState().open).toMatchObject({ status: 'CLOSED', end: 'IDLE', notice: null });
    expect(await c.endIntroduction()).toBeNull(); // nothing re-opens or re-ends it
    const settled = worldsServer();
    settled.q.end.push({ kind: 'ALREADY_SETTLED' });
    const c2 = controllerOf(settled);
    c2.open(W1);
    await flush();
    await c2.endIntroduction();
    await flush();
    expect(c2.getState().open).toMatchObject({ status: 'CLOSED', notice: 'ALREADY_ENDED' });
    const outsider = worldsServer();
    outsider.q.end.push({ kind: 'UNAVAILABLE' });
    const c3 = controllerOf(outsider);
    c3.open(W1);
    await flush();
    await c3.endIntroduction();
    expect(c3.getState().open).toMatchObject({ status: 'UNAVAILABLE', messages: [] });
  });

  it('an answer about another World, or an earlier opening, is never applied', async () => {
    const server = worldsServer();
    const slow = later<IntroductionMessagesRead>();
    server.q.messages.push(slow.answer, { kind: 'PAGE', messages: [MINE], hasOlder: false });
    const c = controllerOf(server);
    c.open(W1);
    c.open(W2);
    await flush();
    slow.release({ kind: 'PAGE', messages: [HELLO], hasOlder: false });
    await flush();
    expect(c.getState().open).toMatchObject({ worldId: W2, messages: [MINE] });
    expect(JSON.stringify(c.getState().open)).not.toContain('Hello there');
  });

  it('a deleted message is gone for good: removed at once, and a re-read within the page never brings it back', async () => {
    const server = worldsServer();
    const c = controllerOf(server);
    c.open(W1);
    await flush();
    expect(await c.deleteMessage(M1)).toBe(false); // not the reader's
    server.q.del.push({ kind: 'UNAVAILABLE' });
    expect(await c.deleteMessage(M2)).toBe(false);
    server.setPage({ kind: 'PAGE', messages: [HELLO], hasOlder: false });
    expect(await c.deleteMessage(M2)).toBe(true);
    await flush();
    expect(server.calls.del.map((d) => d.commandId)).toEqual([server.calls.del[0].commandId, server.calls.del[0].commandId]);
    expect(c.getState().open?.messages).toEqual([HELLO]);
  });

  it('after END the reader still deletes their own words from the closed record (R-5)', async () => {
    const server = worldsServer();
    server.q.messages.push({ kind: 'ENDED' });
    const c = controllerOf(server);
    c.open(W1);
    await flush();
    await flush();
    expect(c.getState().open?.status).toBe('CLOSED');
    server.setHistory({ kind: 'PAGE', messages: [HELLO], hasOlder: false });
    expect(await c.deleteMessage(M2)).toBe(true);
    await flush();
    expect(server.calls.del).toEqual([{ worldId: W1, materialId: M2, commandId: expect.any(String) }]);
    expect(c.getState().open).toMatchObject({ status: 'CLOSED', messages: [HELLO], notice: 'DELETED' });
  });

  it('returning to the foreground re-reads the list and the open World; a retired generation changes nothing', async () => {
    const server = worldsServer();
    const foreground = createManualForegroundSignal('ACTIVE');
    let current = true;
    const c = controllerOf(server, { foreground, isCurrent: () => current });
    c.open(W1);
    await flush();
    const before = server.calls.messages.length;
    foreground.set('INACTIVE');
    foreground.set('ACTIVE');
    await flush();
    expect(server.calls.messages.length).toBe(before + 1);
    current = false;
    server.q.messages.push({ kind: 'UNAVAILABLE' });
    c.refresh();
    await flush();
    expect(c.getState().open?.status).toBe('ACTIVE');
  });

  it('older pages join beneath what the reader holds, from the right reader (live or closed)', async () => {
    const server = worldsServer();
    const OLD = msg('56666666-6666-4666-8666-666666666660', 'HUMAN', 'Earlier', '2026-10-16T09:00:00+00:00');
    server.setPage({ kind: 'PAGE', messages: [HELLO, MINE], hasOlder: true });
    server.q.messages.push({ kind: 'PAGE', messages: [HELLO, MINE], hasOlder: true }, { kind: 'PAGE', messages: [OLD], hasOlder: false });
    const c = controllerOf(server);
    c.open(W1);
    await flush();
    c.loadOlder();
    await flush();
    expect(server.calls.messages[1]).toEqual({ worldId: W1, before: { materialId: M1, establishedAt: HELLO.establishedAt } });
    expect(c.getState().open).toMatchObject({ messages: [OLD, HELLO, MINE], hasOlder: false });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe.each([['ar', 'DARK'], ['en', 'LIGHT']] as const)('the Introduction World surface — %s, %s', (language: ChromeLanguage, preference: 'DARK' | 'LIGHT') => {
  const copy = introductionWorldCopy(language);
  const shared = sharedCopy(language);
  const conversation = sharedConversationCopy(language);
  const palette = P[preference].standard;
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const title = copy.title.replace('{0}', 'Reem');

  it('S13 / S14: nothing of the World — not even the name — before its read; a World this person cannot see is one neutral answer', async () => {
    const server = worldsServer();
    const gate = later<IntroductionMessagesRead>();
    server.q.messages.push(gate.answer);
    const { view } = await worldView(language, server, preference);
    expect(view.getByTestId('qandeel-introduction-loading')).toBeTruthy();
    expect(words(view)).toEqual([shared.opening]);
    gate.release({ kind: 'UNAVAILABLE' });
    await flush();
    expect(view.getByTestId('qandeel-introduction-unavailable')).toBeTruthy();
    expect(words(view)).toEqual([shared.worldUnavailable, shared.retry]);
    expect(view.queryByTestId('qandeel-introduction-end')).toBeNull();
  });

  it('S6 / S7 / S9: ONE opening inside the 2px start-edge seam in the primary ink — the name, M-11, IW-22, IW-23 — and nothing of QANDEEL', async () => {
    const { view } = await worldView(language, worldsServer({ messages: [] }), preference);
    const root = view.getByTestId('qandeel-introduction-world');
    expect(flat(root).direction).toBe(writing);
    const opening = view.getByTestId('qandeel-introduction-opening');
    expect(flat(opening)).toMatchObject({ borderStartWidth: 2, borderStartColor: palette.selectedMarker });
    expect(palette.selectedMarker).toBe(palette.primary);
    expect(view.getByTestId('qandeel-introduction-opening-title').props.children).toBe(title);
    expect(view.getByTestId('qandeel-introduction-both-agreed').props.children).toBe(copy.bothAgreed);
    expect(view.getByTestId('qandeel-introduction-welcome').props.children).toBe(copy.welcome);
    expect(view.getByTestId('qandeel-introduction-note').props.children).toBe(copy.note);
    // The welcome carries no «قنديل» label, and nothing is a QANDEEL message.
    expect(words(view)).not.toContain(shared.personalWorld);
    expect(view.queryByTestId(/qandeel-shared-material-qandeel/u)).toBeNull();
    // Tools: back and END only (D4): no Manage World, members, field, refresh or add.
    expect(view.getByTestId('qandeel-introduction-end').props.accessibilityLabel).toBe(copy.endAction);
    for (const absent of ['qandeel-shared-manage-open', 'qandeel-shared-members', 'qandeel-shared-refresh', 'qandeel-shared-welcome', 'qandeel-shared-world-field']) {
      expect(view.queryByTestId(absent)).toBeNull();
    }
    expect(view.getByTestId('qandeel-shared-input').props.accessibilityLabel).toBe(copy.composerName);
    expect(view.getByTestId('qandeel-shared-input').props.placeholder).toBe(conversation.composerPlaceholder);
    expect(Number(flat(view.getByTestId('qandeel-introduction-end')).minHeight)).toBeGreaterThanOrEqual(44);
    expect(Number(flat(view.getByTestId('qandeel-introduction-back')).width)).toBeGreaterThanOrEqual(44);
  });

  it('IW-11b when the server vouches for no name; the other person\'s words carry only that first name', async () => {
    const { view } = await worldView(language, worldsServer({ worlds: [world({ otherFirstName: null })] }), preference);
    expect(view.getByTestId('qandeel-introduction-opening-title').props.children).toBe(copy.titleNoName);
    expect(view.getByTestId(`qandeel-shared-material-human-${M1}`).props.accessibilityLabel).toBe(`${shared.someone}: Hello there`);
    const named = await worldView(language, worldsServer(), preference);
    expect(named.view.getAllByTestId(`qandeel-shared-material-human-${M1}`).at(-1)!.props.accessibilityLabel).toBe('Reem: Hello there');
  });

  it('S15a: a failed send keeps the words unsent with «إعادة المحاولة» (the same id) and never says the Introduction ended', async () => {
    const server = worldsServer();
    server.q.send.push({ kind: 'OFFLINE' }, { kind: 'FAILED' });
    const { view } = await worldView(language, server, preference);
    await fireEvent.changeText(view.getByTestId('qandeel-shared-input'), 'Cooking, a lot.');
    await press(view, 'qandeel-shared-send');
    expect(view.getByTestId('qandeel-introduction-pending-offline')).toBeTruthy();
    expect(view.getByTestId('qandeel-introduction-send-failed').props.children).toBe(conversation.sendRefused);
    expect(view.getByTestId('qandeel-introduction-offline').props.children).toBe(proposalsCopy(language).offline);
    expect(view.queryByText(copy.sendEnded)).toBeNull();
    expect(view.getByTestId('qandeel-shared-input').props.value).toBe('');
    await press(view, 'qandeel-introduction-send-retry');
    expect(view.queryByText(copy.sendEnded)).toBeNull();
    expect(view.queryByTestId('qandeel-introduction-closed-banner')).toBeNull();
    await press(view, 'qandeel-introduction-send-retry');
    expect(new Set(server.calls.send.map((s) => s.commandId)).size).toBe(1);
    expect(view.queryByTestId(/qandeel-introduction-pending/u)).toBeNull();
  });

  it('S15b: on the server\'s ended answer — IW-35, the closed banner IW-31, and the composer and END are gone', async () => {
    const server = worldsServer();
    server.q.send.push({ kind: 'ENDED' });
    const { view } = await worldView(language, server, preference);
    await fireEvent.changeText(view.getByTestId('qandeel-shared-input'), 'Cooking, a lot.');
    await press(view, 'qandeel-shared-send');
    expect(view.getByTestId('qandeel-introduction-send-ended').props.children).toBe(copy.sendEnded);
    expect(view.getByTestId('qandeel-introduction-closed-banner')).toBeTruthy();
    expect(view.getByText(copy.closedBanner)).toBeTruthy();
    expect(view.queryByTestId('qandeel-shared-input')).toBeNull();
    expect(view.queryByTestId('qandeel-introduction-end')).toBeNull();
    expect(view.getByTestId('qandeel-introduction-title').props.children).toBe(title);
  });

  it('S10 / S11 / S12: END asks once, no reason, no red; running is IW-30; then the closed record with the reader\'s own words deletable', async () => {
    const server = worldsServer();
    const ending = later<IntroductionEndResult>();
    server.q.end.push(ending.answer);
    const { view } = await worldView(language, server, preference);
    await press(view, 'qandeel-introduction-end');
    expect(view.getByTestId('qandeel-introduction-title').props.children).toBe(copy.endTitle);
    expect(words(view)).toEqual([copy.endTitle, copy.endStops, copy.endNoReason, copy.endNoResume, copy.endConfirm, shared.back]);
    const confirm = view.getByTestId('qandeel-introduction-end-confirm');
    expect(JSON.stringify(flat(confirm))).not.toContain(palette.error);
    await fireEvent.press(confirm);
    await flush();
    expect(view.getByTestId('qandeel-introduction-ending').props.children).toBe(copy.ending);
    ending.release({ kind: 'ENDED' });
    await flush();
    await flush();
    expect(view.getByTestId('qandeel-introduction-closed')).toBeTruthy();
    expect(view.getByText(copy.closedBanner)).toBeTruthy();
    expect(view.queryByTestId('qandeel-shared-input')).toBeNull();
    expect(view.queryByTestId('qandeel-introduction-opening')).toBeNull();
    await press(view, `qandeel-shared-material-self-${M2}`);
    await press(view, 'qandeel-shared-delete');
    server.setHistory({ kind: 'PAGE', messages: [HELLO], hasOlder: false });
    await press(view, 'qandeel-shared-delete-confirm-action');
    expect(server.calls.del).toEqual([{ worldId: W1, materialId: M2, commandId: expect.any(String) }]);
    expect(view.queryByTestId(`qandeel-shared-material-self-${M2}`)).toBeNull();
    expect(view.queryByTestId(`qandeel-shared-material-human-${M1}`)).toBeTruthy();
  });

  it('ALREADY_SETTLED says IW-32; a failed END says «تعذّر ذلك الآن.» and offers «إعادة المحاولة» with the same id', async () => {
    const server = worldsServer();
    server.q.end.push({ kind: 'FAILED' }, { kind: 'ALREADY_SETTLED' });
    const { view } = await worldView(language, server, preference);
    await press(view, 'qandeel-introduction-end');
    await press(view, 'qandeel-introduction-end-confirm');
    expect(view.getByTestId('qandeel-introduction-end-failed').props.children).toBe(shared.actionUnavailable);
    expect(view.getByText(shared.retry)).toBeTruthy();
    await press(view, 'qandeel-introduction-end-confirm');
    expect(server.calls.end[0].commandId).toBe(server.calls.end[1].commandId);
    expect(view.getByText(copy.alreadyEnded)).toBeTruthy();
    expect(view.getByText(copy.closedBanner)).toBeTruthy();
  });

  it('Back walks back one level: from the confirmation to the World, from the World to where it was opened', async () => {
    const { view, onBack } = await worldView(language, worldsServer(), preference);
    await press(view, 'qandeel-introduction-end');
    await press(view, 'qandeel-introduction-back');
    expect(view.getByTestId('qandeel-introduction-active')).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
    await press(view, 'qandeel-introduction-back');
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe.each([['ar'], ['en']] as const)('the second recipient\'s acceptance and both humans\' entry — %s', (language: ChromeLanguage) => {
  const copy = introductionWorldCopy(language);
  const pc = proposalsCopy(language);
  const proposal = (over: Partial<PrivateProposal> = {}): PrivateProposal => ({ proposalId: PR1, viewId: V1, status: 'AWAITING_YOU', actions: ['ACCEPT', 'DECLINE'], ...over });

  async function proposals(list: PrivateProposal[], acceptances: ProposalAcceptance[] = [], worldsOf = worldsServer({ worlds: [] })) {
    let page: ProposalsRead = { kind: 'READ', proposals: list, next: null };
    const accepts: { proposalId: string; commandId: string; viewId: string }[] = [];
    const controller = createProposalsController({
      transport: {
        list: async () => page,
        decide: async () => ({ kind: 'FAILED' as const }),
        accept: async (proposalId: string, commandId: string, viewId: string) => {
          accepts.push({ proposalId, commandId, viewId });
          return acceptances.shift() ?? { kind: 'FAILED' as const };
        },
      },
      isCurrent: () => true,
      newCommandId: nextId,
    });
    const worlds = controllerOf(worldsOf);
    const view = await render(
      <AppearanceProvider authority={appearance('DARK')}>
        <ProposalsSurface controller={controller} language={language} insets={INSETS} onBack={jest.fn()} worlds={worlds} />
      </AppearanceProvider>,
    );
    await flush();
    return { view, controller, worlds, accepts, setPage: (next: ProposalsRead) => { page = next; } };
  }

  it('S1: IW-01 only when the server offers ACCEPT; otherwise acceptNotYet stays (production while the gate is closed)', async () => {
    const offered = await proposals([proposal()]);
    await press(offered.view, `qandeel-proposals-card-${PR1}`);
    expect(offered.view.getByTestId('qandeel-proposals-accept').props.accessibilityLabel).toBe(copy.acceptAction);
    expect(offered.view.queryByTestId('qandeel-proposals-accept-not-yet')).toBeNull();
    await cleanup();
    const closed = await proposals([proposal({ actions: ['DECLINE'] })]);
    await press(closed.view, `qandeel-proposals-card-${PR1}`);
    expect(closed.view.queryByTestId('qandeel-proposals-accept')).toBeNull();
    expect(closed.view.getByTestId('qandeel-proposals-accept-not-yet').props.children).toBe(pc.acceptNotYet);
    expect(words(closed.view).join(' ')).not.toContain(copy.acceptAction);
  });

  it('S2 → S3: one confirmation; a lost answer keeps the SAME id; MATCHED shows «بدأ التعارف» in the seam and the entry', async () => {
    const matched = { ...proposal(), status: 'MATCH_CONCLUDED' as const, actions: [] };
    const { view, accepts } = await proposals([proposal()], [{ kind: 'FAILED' }, { kind: 'ANSWERED', outcome: 'MATCHED', worldId: W1, proposal: matched }],
      worldsServer({ messages: [] }));
    await press(view, `qandeel-proposals-card-${PR1}`);
    await press(view, 'qandeel-proposals-accept');
    expect(view.getByTestId('qandeel-proposals-heading').props.children).toBe(copy.acceptTitle);
    for (const [index, key] of (['acceptBegins', 'acceptNameOnly', 'acceptProtected', 'acceptEitherEnds'] as const).entries()) {
      expect(view.getByTestId(`qandeel-proposals-accept-point-${index}`)).toBeTruthy();
      expect(view.getByText(copy[key])).toBeTruthy();
    }
    expect(view.getByText(copy.acceptConfirm)).toBeTruthy();
    await press(view, 'qandeel-proposals-accept-confirm');
    expect(view.getByText(pc.failed)).toBeTruthy();
    await press(view, 'qandeel-proposals-accept-confirm');
    expect(accepts).toEqual([{ proposalId: PR1, commandId: accepts[0].commandId, viewId: V1 }, { proposalId: PR1, commandId: accepts[0].commandId, viewId: V1 }]);
    expect(view.getByTestId('qandeel-proposals-heading').props.children).toBe(copy.begunTitle);
    expect(flat(view.getByTestId('qandeel-proposals-begun-seam'))).toMatchObject({ borderStartWidth: 2, borderStartColor: P.DARK.standard.selectedMarker });
    expect(view.getByTestId('qandeel-proposals-begun-body').props.children).toBe(copy.begunBody);
    await press(view, 'qandeel-proposals-enter-world');
    expect(view.getByTestId('qandeel-introduction-opening')).toBeTruthy();
    await press(view, 'qandeel-introduction-back');
    expect(view.getByTestId('qandeel-proposals-status').props.children).toBe(pc.MATCH_CONCLUDED);
  });

  it('a proposal that changed while it was reviewed decides nothing: CHANGED, UNAVAILABLE and NOT_AVAILABLE_NOW are said neutrally', async () => {
    for (const [outcome, line] of [['CHANGED', pc.changed], ['UNAVAILABLE', pc.unavailableBody], ['NOT_AVAILABLE_NOW', pc.notNow]] as const) {
      const { view } = await proposals([proposal()], [{ kind: 'ANSWERED', outcome, worldId: null, proposal: proposal({ actions: ['DECLINE'] }) }]);
      await press(view, `qandeel-proposals-card-${PR1}`);
      await press(view, 'qandeel-proposals-accept');
      await press(view, 'qandeel-proposals-accept-confirm');
      expect(view.getByText(line)).toBeTruthy();
      expect(view.queryByTestId('qandeel-proposals-begun')).toBeNull();
      await cleanup();
    }
  });

  it('S4: the first party — who never pressed the last agreement — finds the same World from MATCH_CONCLUDED (IW-06)', async () => {
    const concluded = proposal({ status: 'MATCH_CONCLUDED', actions: [] });
    const none = await proposals([concluded]);
    expect(none.view.queryByTestId(`qandeel-proposals-enter-${PR1}`)).toBeNull();
    await cleanup();
    const { view } = await proposals([concluded, proposal({ proposalId: PR2, status: 'NO_LONGER_AVAILABLE', actions: [] })], [], worldsServer());
    await flush();
    expect(view.getByTestId(`qandeel-proposals-enter-${PR1}`).props.accessibilityLabel).toBe(copy.enter);
    expect(view.queryByTestId(`qandeel-proposals-enter-${PR2}`)).toBeNull();
    await press(view, `qandeel-proposals-enter-${PR1}`);
    expect(view.getByTestId('qandeel-introduction-opening-title').props.children).toBe(copy.title.replace('{0}', 'Reem'));
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe.each([['ar', 'DARK'], ['en', 'LIGHT']] as const)('«العالم المشترك»: the separate «التعارف» section — %s, %s', (language: ChromeLanguage, preference: 'DARK' | 'LIGHT') => {
  const copy = introductionWorldCopy(language);
  const palette = P[preference].standard;
  const ROOT: SharedRootResult = { kind: 'READ', root: { capabilities: { invitation: false, birth: false }, worlds: [], invitations: [], closedWorlds: [], memberRequests: [] } };
  const unavailable = async () => ({ kind: 'UNAVAILABLE' as const });

  async function area(introductions: IntroductionWorldsController) {
    const shared = createSharedWorldController({
      transport: {
        manage: unavailable, leave: unavailable, proposeSettings: unavailable, proposeRemoval: unavailable, proposeEnd: unavailable, approve: unavailable,
        historyCandidates: unavailable, proposeHistoryShare: unavailable, approveHistoryShare: unavailable, closedWorld: unavailable, proposeMember: unavailable,
        acceptMembershipRequest: unavailable, root: async () => ROOT, invite: async () => ({ kind: 'UNAVAILABLE' as const }), accept: unavailable, decline: unavailable,
        entry: async () => ({ kind: 'DENIED' as const }), materials: async () => ({ kind: 'UNAVAILABLE' as const }), send: async () => ({ kind: 'NOT_AVAILABLE' as const }),
        deleteMaterial: async () => ({ kind: 'NOT_DELETABLE' as const }),
      } as never,
      isCurrent: () => true,
    });
    const view = await render(
      <AppearanceProvider authority={appearance(preference)}>
        <SharedWorldArea controller={shared} language={language} insets={INSETS} introductions={introductions} />
      </AppearanceProvider>,
    );
    await flush();
    await flush();
    return view;
  }

  it('S5: a live Introduction in «التعارف» with the seam; an ended one in «عوالم منتهية»; none, no section', async () => {
    const server = worldsServer({ worlds: [world(), world({ worldId: W2, proposalId: PR2, state: 'ENDED', otherFirstName: null })] });
    const view = await area(controllerOf(server));
    expect(view.getByText(copy.sectionHeading)).toBeTruthy();
    const live = view.getByTestId(`qandeel-introduction-card-${W1}`);
    expect(flat(live)).toMatchObject({ borderStartWidth: 2, borderStartColor: palette.selectedMarker });
    expect(live.props.accessibilityLabel).toBe(`${copy.title.replace('{0}', 'Reem')}${language === 'ar' ? '، ' : ', '}${copy.cardSubtitle}`);
    const ended = view.getByTestId(`qandeel-introduction-card-${W2}`);
    expect(ended.props.accessibilityLabel).toBe(`${copy.titleNoName}${language === 'ar' ? '، ' : ', '}${copy.endedStatus}`);
    expect(flat(ended).borderStartWidth).toBeUndefined();
    expect(view.getByText(sharedLifecycleCopy(language).endedHeading)).toBeTruthy();
    await cleanup();
    const empty = await area(controllerOf(worldsServer({ worlds: [] })));
    expect(empty.queryByText(copy.sectionHeading)).toBeNull();
  });

  it('opening an Introduction draws its own surface — never the Shared World screen, its field or Manage World — and Back returns', async () => {
    const view = await area(controllerOf(worldsServer()));
    await press(view, `qandeel-introduction-card-${W1}`);
    expect(view.getByTestId('qandeel-introduction-opening')).toBeTruthy();
    for (const absent of ['qandeel-shared-world', 'qandeel-shared-world-field', 'qandeel-shared-manage-open', 'qandeel-shared-members']) {
      expect(view.queryByTestId(absent)).toBeNull();
    }
    await press(view, 'qandeel-introduction-back');
    expect(view.getByTestId(`qandeel-introduction-card-${W1}`)).toBeTruthy();
  });

  it('an ended Introduction opens its closed record (the history reader), never the live conversation', async () => {
    const server = worldsServer({ worlds: [world({ state: 'ENDED' })] });
    server.q.messages.push({ kind: 'ENDED' });
    const view = await area(controllerOf(server));
    await press(view, `qandeel-introduction-card-${W1}`);
    await flush();
    expect(view.getByText(copy.closedBanner)).toBeTruthy();
    expect(server.calls.history.length).toBeGreaterThan(0);
    expect(view.queryByTestId('qandeel-shared-input')).toBeNull();
  });
});
