/**
 * S4-04 — the unit-level laws: the strict Shared link, the per-World alerts controller, and the Shared first-entry
 * education moment over the EXISTING push controller rules.
 */
import { createEphemeralPushDeviceStore } from '../../push/device-store';
import { createInertPushPlatformPort, type OsPermissionState, type PushPlatformPort } from '../../push/platform-port';
import { createPushController } from '../../push/push-controller';
import { createManualForegroundSignal, type SharedSetAlertsResult, type SharedWorldAlert } from '../../runtime-entry';
import { createSharedAlertsController } from '../shared-alerts-controller';
import { createSharedLinkInbox, sharedWorldOfLink } from '../shared-link';

const flush = async () => { for (let i = 0; i < 8; i += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };
const WORLD_A = '33333333-3333-4333-8333-333333333333';
const WORLD_B = '55555555-5555-4555-8555-555555555555';

describe('S4-04 — a QANDEEL link names one exact World, strictly', () => {
  it('reads exactly qandeel://shared/world/<id> and nothing else', () => {
    expect(sharedWorldOfLink(`qandeel://shared/world/${WORLD_A}`)).toBe(WORLD_A);
    expect(sharedWorldOfLink(`qandeel://shared/world/${WORLD_A.toUpperCase()}`)).toBe(WORLD_A);
    for (const url of [`qandeel://shared/world/${WORLD_A}/`, `qandeel://shared/world/${WORLD_A}?item=1`, `qandeel://shared/world/${WORLD_A}#x`,
      `qandeel://shared/worlds/${WORLD_A}`, `exp+qandeel://shared/world/${WORLD_A}`, `https://qandeel.app/shared/world/${WORLD_A}`,
      'qandeel://shared/world/not-a-world', 'qandeel://s401-proof/world/allow', '', null, 42]) {
      expect(sharedWorldOfLink(url)).toBeNull();
    }
  });
  it('holds one pending World (the latest), taken once; drop forgets it', () => {
    const inbox = createSharedLinkInbox();
    const heard: number[] = [];
    inbox.subscribe(() => heard.push(1));
    inbox.put(WORLD_A);
    inbox.put(WORLD_B);
    expect(heard).toHaveLength(2);
    expect(inbox.take()).toBe(WORLD_B);
    expect(inbox.take()).toBeNull();
    inbox.put(WORLD_A);
    inbox.drop();
    expect(inbox.take()).toBeNull();
  });
});

describe('S4-04 C — the per-World alerts controller', () => {
  const worlds: SharedWorldAlert[] = [
    { worldId: WORLD_A, name: null, members: [{ name: 'Amal', self: true }, { name: 'Bassem', self: false }], muted: false },
    { worldId: WORLD_B, name: 'Family', members: [{ name: 'Amal', self: true }], muted: false },
  ];
  function build(answer: (worldId: string, muted: boolean) => SharedSetAlertsResult) {
    const sets: [string, boolean][] = [];
    const c = createSharedAlertsController({
      transport: { alerts: async () => ({ kind: 'READ', worlds }), setAlerts: async (worldId, muted) => { sets.push([worldId, muted]); return answer(worldId, muted); } },
      isCurrent: () => true,
    });
    return { c, sets };
  }
  it('muting World A changes A only; unmuting restores; the server answer is what is shown', async () => {
    const { c, sets } = build((_w, muted) => ({ kind: muted ? 'MUTED' : 'UNMUTED' }));
    c.start();
    await flush();
    expect(await c.setMuted(WORLD_A, true)).toBe(true);
    expect(c.getState().worlds.map((w) => [w.worldId, w.muted])).toEqual([[WORLD_A, true], [WORLD_B, false]]);
    expect(await c.setMuted(WORLD_A, false)).toBe(true);
    expect(c.getState().worlds.map((w) => w.muted)).toEqual([false, false]);
    expect(sets).toEqual([[WORLD_A, true], [WORLD_A, false]]);
  });
  it('an unconfirmed change keeps the confirmed state and says so; a World that is no longer the reader\'s leaves the list', async () => {
    const failing = build(() => ({ kind: 'UNAVAILABLE' }));
    failing.c.start();
    await flush();
    expect(await failing.c.setMuted(WORLD_A, true)).toBe(false);
    expect(failing.c.getState()).toMatchObject({ failed: true, busy: null });
    expect(failing.c.getState().worlds[0].muted).toBe(false);
    const gone = build(() => ({ kind: 'NOT_A_WORLD' }));
    gone.c.start();
    await flush();
    await gone.c.setMuted(WORLD_A, true);
    expect(gone.c.getState().worlds.map((w) => w.worldId)).toEqual([WORLD_B]);
  });
  it('acts only on a listed World, one act at a time', async () => {
    const { c, sets } = build(() => ({ kind: 'MUTED' }));
    expect(await c.setMuted(WORLD_A, true)).toBe(false); // not read yet
    c.start();
    await flush();
    expect(await c.setMuted('99999999-9999-4999-8999-999999999999', true)).toBe(false);
    expect(sets).toEqual([]);
  });
});

describe('S4-04 D — the Shared first-entry moment over the EXISTING education rules', () => {
  function push(initial: OsPermissionState, declined = false) {
    let requests = 0;
    const port: PushPlatformPort = {
      ...createInertPushPlatformPort('ANDROID'),
      readPermission: async () => initial,
      requestPermission: async () => { requests += 1; return { permission: 'GRANTED', canAskAgain: false }; },
    };
    const store = createEphemeralPushDeviceStore({ installationId: '11111111-1111-4111-8111-111111111111', declined });
    const transport = { sync: async () => true, detach: async () => true, detachOthers: async () => true, recordOpened: async () => true };
    const c = createPushController({ port, store, transport, foreground: createManualForegroundSignal('ACTIVE'), isCurrent: () => true, language: () => 'ar', timeZone: () => 'Africa/Cairo', appVersion: '0.1.0' });
    return { c, store, requests: () => requests };
  }
  it('offers the education before the OS has been asked; Not now is remembered and never pressed again', async () => {
    const p = push({ permission: 'NOT_REQUESTED', canAskAgain: true });
    p.c.start();
    await flush();
    expect(p.c.offer('SHARED_FIRST_ENTRY')).toBe('EDUCATION');
    expect(p.requests()).toBe(0);
    p.c.notNow();
    expect(p.store.educationDeclined()).toBe(true);
    expect(p.c.offer('SHARED_FIRST_ENTRY')).toBe('NOTHING');
    expect(p.c.getState().education).toBe(false);
  });
  it('a granted or refused device is never asked, and the moment never hands off to settings', async () => {
    for (const state of [{ permission: 'GRANTED', canAskAgain: false }, { permission: 'DENIED', canAskAgain: false }] as const) {
      const p = push(state);
      p.c.start();
      await flush();
      expect(p.c.offer('SHARED_FIRST_ENTRY')).toBe('NOTHING');
      expect(p.requests()).toBe(0);
    }
  });
  it('a reader who already declined (another moment) is not asked by the Shared one', async () => {
    const p = push({ permission: 'NOT_REQUESTED', canAskAgain: true }, true);
    p.c.start();
    await flush();
    expect(p.c.offer('SHARED_FIRST_ENTRY')).toBe('NOTHING');
  });
});
