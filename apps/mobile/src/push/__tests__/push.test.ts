/**
 * A3-02 — the device permission runtime, registration lifecycle, tap inbox and copy authority (unit level).
 */
import { createManualForegroundSignal } from '../../runtime-entry';
import { PushApiClient, type PushDeviceSync } from '../../runtime-entry/push-api';
import { PUSH_COPY_GATE, pushCopy } from '../copy';
import { createEphemeralPushDeviceStore, newInstallationId } from '../device-store';
import { createNotificationEntryInbox } from '../entry-inbox';
import { createInertPushPlatformPort, tapFromPayload, type OsPermissionState, type PushPlatformPort } from '../platform-port';
import { channelsFor, createPushController } from '../push-controller';

const flush = async () => { for (let i = 0; i < 8; i += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };
const ITEM = '00000000-0000-4000-8000-000000000001';

function fakePort(initial: OsPermissionState, answer: OsPermissionState = { permission: 'GRANTED', canAskAgain: false }) {
  let permission = initial;
  const calls = { request: 0, settings: 0, channels: [] as string[] };
  const tokenListeners = new Set<(token: string) => void>();
  const port: PushPlatformPort = {
    ...createInertPushPlatformPort('ANDROID'),
    readPermission: async () => permission,
    requestPermission: async () => { calls.request += 1; permission = answer; return answer; },
    deviceToken: async () => (permission.permission === 'GRANTED' ? 'fcm-token-1' : null),
    onTokenChange: (listener) => { tokenListeners.add(listener); return () => tokenListeners.delete(listener); },
    ensureChannels: async (channels) => { calls.channels = channels.map((c) => c.id); },
    openNotificationSettings: async () => { calls.settings += 1; },
  };
  return { port, calls, rotate: (token: string) => tokenListeners.forEach((l) => l(token)), setPermission: (p: OsPermissionState) => { permission = p; } };
}

function fakeTransport() {
  const syncs: PushDeviceSync[] = [];
  const detached: string[] = [];
  const others: string[] = [];
  const opened: string[] = [];
  return {
    syncs, detached, others, opened,
    transport: {
      sync: async (input: PushDeviceSync) => { syncs.push(input); return true; },
      detach: async (id: string) => { detached.push(id); return true; },
      detachOthers: async (id: string) => { others.push(id); return true; },
      recordOpened: async (_id: string, item: string) => { opened.push(item); return true; },
    },
  };
}

function controller(port: PushPlatformPort, declined = false) {
  const t = fakeTransport();
  const foreground = createManualForegroundSignal('ACTIVE');
  const store = createEphemeralPushDeviceStore({ installationId: '11111111-1111-4111-8111-111111111111', declined });
  const c = createPushController({ port, store, transport: t.transport, foreground, isCurrent: () => true, language: () => 'ar', timeZone: () => 'Africa/Cairo', appVersion: '0.1.0' });
  return { c, t, foreground, store };
}

describe('A3-02 permission runtime (D50, P3 §11)', () => {
  it('nothing is asked at start: the OS permission is READ, the device registers without a token', async () => {
    const { port, calls } = fakePort({ permission: 'NOT_REQUESTED', canAskAgain: true });
    const { c, t } = controller(port);
    c.start();
    await flush();
    expect(calls.request).toBe(0);
    expect(c.getState()).toMatchObject({ permission: 'NOT_REQUESTED', education: false });
    expect(t.syncs).toHaveLength(1);
    expect(t.syncs[0]).toMatchObject({ pushToken: null, osPermission: 'NOT_REQUESTED', timeZone: 'Africa/Cairo', locale: 'ar', platform: 'ANDROID', apnsEnvironment: null });
  });

  it('a legitimate moment → education → Allow → the REAL OS prompt → granted → the token registers', async () => {
    const { port, calls } = fakePort({ permission: 'NOT_REQUESTED', canAskAgain: true });
    const { c, t } = controller(port);
    c.start();
    await flush();
    expect(c.offer('PROACTIVE_ALLOW')).toBe('EDUCATION');
    expect(c.getState().education).toBe(true);
    expect(calls.request).toBe(0); // the education comes BEFORE the platform prompt
    await c.allow();
    expect(calls.request).toBe(1);
    expect(c.getState()).toMatchObject({ permission: 'GRANTED', education: false });
    expect(t.syncs.at(-1)).toMatchObject({ pushToken: 'fcm-token-1', osPermission: 'GRANTED' });
  });

  it('denied: no Push, no repeated pressure — the moment offers nothing, settings hand off to the OS', async () => {
    const { port, calls } = fakePort({ permission: 'NOT_REQUESTED', canAskAgain: true }, { permission: 'DENIED', canAskAgain: false });
    const { c, t } = controller(port);
    c.start();
    await flush();
    c.offer('DEVICE_SETTINGS');
    await c.allow();
    expect(c.getState().permission).toBe('DENIED');
    expect(t.syncs.at(-1)).toMatchObject({ pushToken: null, osPermission: 'DENIED' });
    expect(c.offer('PROACTIVE_ALLOW')).toBe('NOTHING');
    expect(c.offer('DEVICE_SETTINGS')).toBe('SETTINGS');
    await flush();
    expect(calls.settings).toBe(1);
    expect(calls.request).toBe(1);
  });

  it('"Not now": nothing asked, the note once, and QANDEEL never asks again by itself — only the reader’s settings visit does', async () => {
    const { port, calls } = fakePort({ permission: 'NOT_REQUESTED', canAskAgain: true });
    const { c, store } = controller(port);
    c.start();
    await flush();
    c.offer('PROACTIVE_ALLOW');
    c.notNow();
    expect(c.getState()).toMatchObject({ education: false, notNowNote: true });
    expect(store.educationDeclined()).toBe(true);
    expect(c.offer('PROACTIVE_ALLOW')).toBe('NOTHING');
    expect(c.offer('DEVICE_SETTINGS')).toBe('EDUCATION');
    expect(calls.request).toBe(0);
  });

  it('a declined education survives a new identity on the same device', async () => {
    const { port } = fakePort({ permission: 'NOT_REQUESTED', canAskAgain: true });
    const { c } = controller(port, true);
    c.start();
    await flush();
    expect(c.offer('PROACTIVE_ALLOW')).toBe('NOTHING');
  });

  it('back in front, a permission changed in the OS settings is read and re-registered', async () => {
    const f = fakePort({ permission: 'DENIED', canAskAgain: false });
    const { c, t, foreground } = controller(f.port);
    c.start();
    await flush();
    f.setPermission({ permission: 'GRANTED', canAskAgain: false });
    foreground.set('INACTIVE');
    foreground.set('ACTIVE');
    await flush();
    expect(c.getState().permission).toBe('GRANTED');
    expect(t.syncs.at(-1)).toMatchObject({ osPermission: 'GRANTED', pushToken: 'fcm-token-1' });
  });

  it('token rotation re-registers at once; an unchanged state is not re-sent', async () => {
    const f = fakePort({ permission: 'GRANTED', canAskAgain: false });
    const { c, t, foreground } = controller(f.port);
    c.start();
    await flush();
    const before = t.syncs.length;
    foreground.set('INACTIVE');
    foreground.set('ACTIVE');
    await flush();
    expect(t.syncs.length).toBe(before);
    f.rotate('fcm-token-2');
    await flush();
    expect(t.syncs.at(-1)?.pushToken).toBe('fcm-token-2');
  });

  it('Android channels are registered from the Product categories, in approved words', async () => {
    const f = fakePort({ permission: 'GRANTED', canAskAgain: false });
    const { c } = controller(f.port);
    c.start();
    await flush();
    expect(f.calls.channels).toEqual(['qandeel', 'category-qandeel', 'category-shared', 'category-public', 'category-introductions', 'category-system']);
    expect(channelsFor('en').find((ch) => ch.id === 'qandeel')?.name).toBe('QANDEEL');
  });
});

describe('A3-02 sign-out and other devices', () => {
  it('sign-out detaches THIS installation, and never throws even when everything fails', async () => {
    const f = fakePort({ permission: 'GRANTED', canAskAgain: false });
    const { c, t } = controller(f.port);
    await c.detach();
    expect(t.detached).toEqual(['11111111-1111-4111-8111-111111111111']);
    const broken = createPushController({
      port: f.port, foreground: createManualForegroundSignal('ACTIVE'), isCurrent: () => true, language: () => 'en',
      store: { installationId: () => { throw new Error('storage'); }, educationDeclined: () => false, declineEducation: () => undefined },
      transport: { sync: async () => true, detach: async () => { throw new Error('network'); }, detachOthers: async () => true, recordOpened: async () => true },
    });
    await expect(broken.detach()).resolves.toBeUndefined();
  });

  it('a detach that hangs never holds sign-out past its bound', async () => {
    const f = fakePort({ permission: 'GRANTED', canAskAgain: false });
    const c = createPushController({
      port: f.port, foreground: createManualForegroundSignal('ACTIVE'), isCurrent: () => true, language: () => 'en', detachTimeoutMs: 20,
      store: createEphemeralPushDeviceStore(),
      transport: { sync: async () => true, detach: () => new Promise<boolean>(() => undefined), detachOthers: async () => true, recordOpened: async () => true },
    });
    const started = Date.now();
    await c.detach();
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('other devices and per-device open evidence go to the server with THIS installation', async () => {
    const f = fakePort({ permission: 'GRANTED', canAskAgain: false });
    const { c, t } = controller(f.port);
    await c.detachOthers();
    await c.recordOpened(ITEM);
    expect(t.others).toEqual(['11111111-1111-4111-8111-111111111111']);
    expect(t.opened).toEqual([ITEM]);
  });
});

describe('A3-02 native Direct Entry inbox and payload', () => {
  it('a tap payload is read strictly: the marker and one item id, nothing else', () => {
    expect(tapFromPayload({ qandeel: 'a3', item: ITEM })).toEqual({ itemId: ITEM });
    expect(tapFromPayload({ qandeel: 'a3', item: 'not-an-id' })).toBeNull();
    expect(tapFromPayload({ item: ITEM })).toBeNull();
    expect(tapFromPayload({ qandeel: 'x', item: ITEM })).toBeNull();
    expect(tapFromPayload(null)).toBeNull();
  });

  it('one pending tap, taken once; the newest replaces the older; signed out drops it', () => {
    const inbox = createNotificationEntryInbox();
    inbox.put({ itemId: 'a' });
    inbox.put({ itemId: ITEM });
    expect(inbox.peek()).toEqual({ itemId: ITEM });
    expect(inbox.take()).toEqual({ itemId: ITEM });
    expect(inbox.take()).toBeNull();
    inbox.put({ itemId: ITEM });
    inbox.drop();
    expect(inbox.take()).toBeNull();
  });
});

describe('A3-02 device store and transport', () => {
  it('the installation id is a random v4 UUID, stable once created', () => {
    expect(newInstallationId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    const store = createEphemeralPushDeviceStore();
    expect(store.installationId()).toBe(store.installationId());
  });

  it('the client decodes one outcome word strictly', async () => {
    const answer = (status: number, body: unknown) => async () => ({ ok: status < 300, status, json: async () => body });
    const client = (status: number, body: unknown) => new PushApiClient({ baseUrl: 'https://api', fetch: answer(status, body) as never });
    const input: PushDeviceSync = { installationId: '11111111-1111-4111-8111-111111111111', platform: 'IOS', pushToken: 'ab', apnsEnvironment: 'PRODUCTION', osPermission: 'GRANTED', timeZone: 'Africa/Cairo', locale: 'en', appVersion: null };
    expect(await client(200, { outcome: 'ROTATED' }).sync(input)).toBe(true);
    expect(await client(200, { outcome: 'ROTATED', token: 'x' }).sync(input)).toBe(false);
    expect(await client(503, { outcome: 'UNAVAILABLE' }).sync(input)).toBe(false);
    expect(await client(200, { outcome: 'NOT_ATTACHED' }).detach(input.installationId)).toBe(true);
    expect(await client(200, { outcome: 'NO_EVIDENCE' }).recordOpened(input.installationId, ITEM)).toBe(true);
  });
});

describe('A3-02 copy authority', () => {
  it('the education rows are the P3-A DIRECTION / PROOF words, and their status is stated — never silently final', () => {
    expect(PUSH_COPY_GATE.status).toMatch(/A3-02 PRODUCT COPY GATE/u);
    expect(pushCopy('ar').eduAllow).toBe('السماح بالإشعارات');
    expect(pushCopy('en').eduNotNow).toBe('Not now');
    expect(pushCopy('ar').osOff).toBe('إشعارات قنديل متوقفة على هذا الجهاز، وسيظل النشاط يظهر داخل التطبيق.');
  });
});
