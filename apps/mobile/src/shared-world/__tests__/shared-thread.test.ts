/**
 * S4-02 — the World's conversation state: read only after ALLOW, owned by exactly one World, one command per logical
 * submission, the reader's own words deletable only, refreshed on foreground and on demand, and nothing carried across
 * Worlds.
 */
import { createManualForegroundSignal, type SharedEntryResult, type SharedMaterial, type SharedMaterialsResult } from '../../runtime-entry';
import { createSharedWorldController, type SharedWorldTransport } from '../shared-world-controller';

const A = '33333333-3333-4333-8333-33333333333a';
const B = '33333333-3333-4333-8333-33333333333b';
const allow = (worldId: string): SharedEntryResult => ({ kind: 'ALLOW', world: { worldId, bornAt: '2026-10-05T00:00:00Z', members: [{ name: 'Amal', self: true }, { name: 'Bassem', self: false }] } });
const material = (id: string, producer: SharedMaterial['producer'], text: string): SharedMaterial => ({
  materialId: id, producer, authorName: producer === 'HUMAN' ? 'Bassem' : null, text, establishedAt: '2026-10-05T10:00:00Z', canDelete: producer === 'SELF',
});
const MINE = material('66666666-6666-4666-8666-666666666661', 'SELF', 'مرحبا');
const THEIRS = material('66666666-6666-4666-8666-666666666662', 'HUMAN', 'Hi');
const READ = (materials: SharedMaterial[], conversation = true): SharedMaterialsResult => ({ kind: 'READ', conversation, materials });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

function transport(overrides: Partial<SharedWorldTransport> = {}): SharedWorldTransport {
  return {
    root: jest.fn(async () => ({ kind: 'READ' as const, root: { capabilities: { invitation: true, birth: true }, worlds: [], invitations: [] } })),
    invite: jest.fn(async () => ({ kind: 'SUBMITTED' as const })),
    accept: jest.fn(async () => ({ kind: 'NOT_ACCEPTABLE' as const })),
    decline: jest.fn(async () => ({ kind: 'DECLINED' as const })),
    entry: jest.fn(async (worldId: string) => allow(worldId)),
    materials: jest.fn(async () => READ([MINE, THEIRS])),
    send: jest.fn(async () => ({ kind: 'COMMITTED' as const, materialId: MINE.materialId, qandeel: 'COMMITTED' as const })),
    deleteMaterial: jest.fn(async () => ({ kind: 'DELETED' as const })),
    ...overrides,
  };
}

describe('S4-02 Shared conversation controller', () => {
  it('reads no material before the entry verdict is ALLOW, and reads it once after', async () => {
    const entry = deferred<SharedEntryResult>();
    const t = transport({ entry: jest.fn(() => entry.promise) });
    const c = createSharedWorldController({ transport: t, isCurrent: () => true });
    c.openWorld(A);
    await flush();
    expect(t.materials).not.toHaveBeenCalled();
    expect(c.getState().thread).toMatchObject({ worldId: A, status: 'NONE', materials: [] });
    entry.resolve(allow(A));
    await flush();
    expect(t.materials).toHaveBeenCalledWith(A);
    expect(c.getState().thread).toMatchObject({ worldId: A, status: 'READY', conversation: true, materials: [MINE, THEIRS] });
  });

  it('a DENIED entry reads nothing at all', async () => {
    const t = transport({ entry: jest.fn(async () => ({ kind: 'DENIED' as const })) });
    const c = createSharedWorldController({ transport: t, isCurrent: () => true });
    c.openWorld(A);
    await flush();
    expect(t.materials).not.toHaveBeenCalled();
  });

  it('authority lost after entry hides the World and everything of it', async () => {
    let answer: SharedMaterialsResult = READ([MINE, THEIRS]);
    const t = transport({ materials: jest.fn(async () => answer) });
    const c = createSharedWorldController({ transport: t, isCurrent: () => true });
    c.openWorld(A);
    await flush();
    answer = { kind: 'DENIED' };
    c.refreshThread();
    await flush();
    expect(c.getState().entry).toEqual({ status: 'DENIED', world: null });
    expect(c.getState().thread.materials).toEqual([]);
    expect(await c.send('still here?')).toBe(false);
  });

  it('a lost send keeps ONE command for its retry; a confirmed one ends it; the words are confirmed only on commit', async () => {
    const answers = [{ kind: 'UNAVAILABLE' as const }, { kind: 'COMMITTED' as const, materialId: MINE.materialId, qandeel: 'COMMITTED' as const },
      { kind: 'COMMITTED' as const, materialId: MINE.materialId, qandeel: 'UNAVAILABLE' as const }];
    const seen: string[] = [];
    const t = transport({ send: jest.fn(async (_w: string, commandId: string) => { seen.push(commandId); return answers.shift()!; }) });
    let n = 0;
    const c = createSharedWorldController({ transport: t, isCurrent: () => true, newCommandId: () => `cmd-${++n}` });
    c.openWorld(A);
    await flush();
    expect(await c.send('مرحبا')).toBe(false);
    expect(c.getState().thread.notice).toBe('SEND_UNCONFIRMED');
    expect(await c.send('مرحبا')).toBe(true);
    expect(await c.send('مرحبا')).toBe(true);
    expect(seen).toEqual(['cmd-1', 'cmd-1', 'cmd-2']);
    // The reply's failure is reported, and never undoes the committed words.
    expect(c.getState().thread.notice).toBe('REPLY_FAILED');
    expect(t.materials).toHaveBeenCalledTimes(3);
  });

  it('refuses empty, unbounded or concurrent sends, and any send while sending is closed', async () => {
    const pending = deferred<{ kind: 'COMMITTED'; materialId: string; qandeel: 'COMMITTED' }>();
    const t = transport({ send: jest.fn(() => pending.promise) });
    const c = createSharedWorldController({ transport: t, isCurrent: () => true });
    c.openWorld(A);
    await flush();
    expect(await c.send('   ')).toBe(false);
    expect(await c.send('x'.repeat(20001))).toBe(false);
    const first = c.send('one');
    expect(await c.send('two')).toBe(false);
    pending.resolve({ kind: 'COMMITTED', materialId: MINE.materialId, qandeel: 'COMMITTED' });
    expect(await first).toBe(true);
    expect(t.send).toHaveBeenCalledTimes(1);

    const closed = transport({ materials: jest.fn(async () => READ([], false)) });
    const d = createSharedWorldController({ transport: closed, isCurrent: () => true });
    d.openWorld(A);
    await flush();
    expect(await d.send('closed')).toBe(false);
    expect(closed.send).not.toHaveBeenCalled();
  });

  it('nothing of World A is ever shown as World B: the thread is emptied on every move and stale answers are dropped', async () => {
    const slowA = deferred<SharedMaterialsResult>();
    const t = transport({ materials: jest.fn((worldId: string) => (worldId === A ? slowA.promise : Promise.resolve(READ([THEIRS])))) });
    const c = createSharedWorldController({ transport: t, isCurrent: () => true });
    c.openWorld(A);
    await flush();
    c.openWorld(B);
    await flush();
    slowA.resolve(READ([MINE]));
    await flush();
    expect(c.getState().thread).toMatchObject({ worldId: B, materials: [THEIRS] });
    c.toRoot();
    expect(c.getState().thread).toMatchObject({ worldId: null, materials: [], sending: null, notice: null });
  });

  it('a lost send in World A does not lend its command to World B', async () => {
    const seen: string[] = [];
    const t = transport({ send: jest.fn(async (_w: string, commandId: string) => { seen.push(commandId); return { kind: 'UNAVAILABLE' as const }; }) });
    let n = 0;
    const c = createSharedWorldController({ transport: t, isCurrent: () => true, newCommandId: () => `cmd-${++n}` });
    c.openWorld(A);
    await flush();
    await c.send('same words');
    c.openWorld(B);
    await flush();
    await c.send('same words');
    expect(seen).toEqual(['cmd-1', 'cmd-2']);
  });

  it('deletes only the reader\'s own material, once per command, and re-reads the server\'s truth', async () => {
    const t = transport();
    const c = createSharedWorldController({ transport: t, isCurrent: () => true, newCommandId: () => 'delete-1' });
    c.openWorld(A);
    await flush();
    await c.deleteMaterial(THEIRS.materialId);
    expect(t.deleteMaterial).not.toHaveBeenCalled();
    await c.deleteMaterial(MINE.materialId);
    expect(t.deleteMaterial).toHaveBeenCalledWith(A, MINE.materialId, 'delete-1');
    expect(c.getState().thread.notice).toBe('DELETED');
    expect(t.materials).toHaveBeenCalledTimes(2);
  });

  it('returning to the foreground re-reads the open World, and only the open World', async () => {
    const foreground = createManualForegroundSignal('ACTIVE');
    const t = transport();
    const c = createSharedWorldController({ transport: t, isCurrent: () => true, foreground });
    foreground.set('INACTIVE');
    foreground.set('ACTIVE');
    await flush();
    expect(t.materials).not.toHaveBeenCalled();
    c.openWorld(A);
    await flush();
    foreground.set('INACTIVE');
    foreground.set('ACTIVE');
    await flush();
    expect(t.materials).toHaveBeenCalledTimes(2);
    c.retire();
    foreground.set('INACTIVE');
    foreground.set('ACTIVE');
    await flush();
    expect(t.materials).toHaveBeenCalledTimes(2);
  });
});
