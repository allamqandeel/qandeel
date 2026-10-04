/**
 * A3-02 — the reader's device permission and this installation's registration, for ONE signed-in identity.
 *
 * Permission (I-08N-01 D50; P3 §11):
 *   - nothing is asked at launch; the OS permission is read, never assumed;
 *   - QANDEEL's own education comes BEFORE the platform prompt, and only at a legitimate moment: choosing «سماح» /
 *     Allow for Proactive QANDEEL, or the reader's own visit to Device Notification Settings (the first Shared entry and
 *     entering Introductions are the other two moments; those surfaces do not exist yet — Stages 4 and 6);
 *   - «السماح بالإشعارات» hands over to the REAL OS prompt; «مش دلوقتي» keeps everything working, says so once, and
 *     QANDEEL does not ask again by itself — only the reader's own Device Notification Settings visit offers it again;
 *   - once the OS has an answer it is the platform's: a refusal is never re-prompted by QANDEEL; the settings row then
 *     hands off to the device's own notification settings;
 *   - refusal removes Push only: Activity, the mark and the strip keep working.
 *
 * Registration (QAN-BL-NOTIF-01): this installation's token, OS permission, IANA zone and language reach the server on
 * start, on every permission or zone change, on token rotation, and at most every 12 h in the foreground. A token is
 * held only while the OS permission is granted. Sign-out detaches this installation first; "sign out from other
 * devices" detaches every other one.
 */
import type { ForegroundSignal, OsPermission, PushApiClient, PushDeviceSync } from '../runtime-entry';
import type { ChromeLanguage } from '../orientation-chrome';
import { pushCopy } from './copy';
import type { PushDeviceStore } from './device-store';
import type { ChannelSpec, PushPlatformPort } from './platform-port';

export type EducationMoment = 'PROACTIVE_ALLOW' | 'DEVICE_SETTINGS';

export interface PushState {
  /** The OS permission as last read; UNKNOWN until the first read answers. */
  readonly permission: OsPermission | 'UNKNOWN';
  /** Whether the OS would still show its own prompt. */
  readonly canAskAgain: boolean;
  /** The education sheet is in front. */
  readonly education: boolean;
  /** The once-only note after "Not now". */
  readonly notNowNote: boolean;
}

export interface PushController {
  getState(): PushState;
  subscribe(listener: () => void): () => void;
  start(): void;
  /** A legitimate moment: maybe the education, maybe the OS settings hand-off, maybe nothing. */
  offer(moment: EducationMoment): 'EDUCATION' | 'SETTINGS' | 'NOTHING';
  /** «السماح بالإشعارات»: the education closes and the REAL OS prompt follows. */
  allow(): Promise<void>;
  /** «مش دلوقتي». */
  notNow(): void;
  openDeviceSettings(): Promise<void>;
  /** Sign-out: this installation stops receiving. Bounded; never throws; never blocks sign-out for long. */
  detach(): Promise<void>;
  /** "Sign out from other devices" succeeded: every other installation stops receiving. */
  detachOthers(): Promise<void>;
  /** Per-device evidence for a tap on THIS installation (D53). */
  recordOpened(itemId: string): Promise<void>;
  retire(): void;
}

export interface PushControllerOptions {
  readonly port: PushPlatformPort;
  readonly store: PushDeviceStore;
  readonly transport: Pick<PushApiClient, 'sync' | 'detach' | 'detachOthers' | 'recordOpened'>;
  readonly foreground: ForegroundSignal;
  readonly isCurrent: () => boolean;
  readonly language: () => ChromeLanguage;
  readonly timeZone?: () => string;
  readonly appVersion?: string | null;
  readonly now?: () => number;
  /** How long sign-out waits for the detach before going on regardless (ms). */
  readonly detachTimeoutMs?: number;
}

const RESYNC_MS = 12 * 60 * 60 * 1000;
const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/** The Android channels, named in the reader's language (the ids are the server's). */
export function channelsFor(language: ChromeLanguage): readonly ChannelSpec[] {
  const names = pushCopy(language).channels;
  return (Object.keys(names) as (keyof typeof names)[]).map((id) => ({ id, name: names[id] }));
}

export function createPushController(options: PushControllerOptions): PushController {
  const { port, store, transport } = options;
  const timeZone = options.timeZone ?? deviceTimeZone;
  const now = options.now ?? Date.now;
  let state: PushState = { permission: 'UNKNOWN', canAskAgain: true, education: false, notNowNote: false };
  const listeners = new Set<() => void>();
  const unsubscribers: (() => void)[] = [];
  let retired = false;
  let started = false;
  let lastSync: { readonly key: string; readonly at: number } | null = null;
  let token: string | null = null;
  /** Bumped whenever the platform hands over a token, so a rotation always re-syncs. The token is never a key. */
  let tokenVersion = 0;

  const live = () => !retired && options.isCurrent();
  const set = (next: Partial<PushState>) => {
    state = { ...state, ...next };
    for (const listener of Array.from(listeners)) listener();
  };

  async function sync(force = false): Promise<void> {
    if (!live() || state.permission === 'UNKNOWN') return;
    const granted = state.permission === 'GRANTED';
    if (granted && token === null) {
      token = await port.deviceToken();
      tokenVersion += 1;
    }
    if (!live()) return;
    const input: PushDeviceSync = {
      installationId: store.installationId(), platform: port.platform, pushToken: granted ? token : null,
      apnsEnvironment: port.apnsEnvironment, osPermission: state.permission, timeZone: timeZone(),
      locale: options.language(), appVersion: options.appVersion ?? null,
    };
    const key = JSON.stringify({ ...input, pushToken: input.pushToken === null ? null : tokenVersion });
    if (!force && lastSync !== null && lastSync.key === key && now() - lastSync.at < RESYNC_MS) return;
    if (await transport.sync(input)) lastSync = { key, at: now() };
  }

  async function readPermission(): Promise<void> {
    const read = await port.readPermission();
    if (!live()) return;
    if (read.permission !== state.permission || read.canAskAgain !== state.canAskAgain) set(read);
    await sync();
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (started || retired) return;
      started = true;
      void port.ensureChannels(channelsFor(options.language())).catch(() => undefined);
      unsubscribers.push(port.onTokenChange((next) => {
        token = next;
        tokenVersion += 1;
        void sync(true);
      }));
      unsubscribers.push(options.foreground.subscribe(() => {
        // Back in front: the reader may have changed the permission in the OS settings, or crossed a time zone.
        if (options.foreground.current() === 'ACTIVE') void readPermission().catch(() => undefined);
      }));
      void readPermission().catch(() => undefined);
    },
    offer(moment) {
      if (!live() || state.education) return 'NOTHING';
      const askable = state.permission === 'NOT_REQUESTED' && state.canAskAgain;
      if (askable && (moment === 'DEVICE_SETTINGS' || !store.educationDeclined())) {
        set({ education: true, notNowNote: false });
        return 'EDUCATION';
      }
      if (moment === 'DEVICE_SETTINGS') {
        void port.openNotificationSettings().catch(() => undefined);
        return 'SETTINGS';
      }
      return 'NOTHING';
    },
    async allow() {
      if (!live() || !state.education) return;
      set({ education: false });
      const answer = await port.requestPermission().catch(() => null);
      if (!live() || answer === null) return;
      set(answer);
      await sync(true).catch(() => undefined);
    },
    notNow() {
      if (!live() || !state.education) return;
      store.declineEducation();
      set({ education: false, notNowNote: true });
    },
    async openDeviceSettings() {
      await port.openNotificationSettings().catch(() => undefined);
    },
    async detach() {
      // Sign-out never depends on Push: whatever fails here (the store, the network, the server), sign-out goes on.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          transport.detach(store.installationId()).catch(() => false),
          new Promise((resolve) => { timer = setTimeout(resolve, options.detachTimeoutMs ?? 3000); }),
        ]);
      } catch {
        // Nothing to do: the server-side registration then ages out (30 days) or moves at the next sign-in here.
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        lastSync = null;
      }
    },
    async detachOthers() {
      if (!live()) return;
      try {
        await transport.detachOthers(store.installationId());
      } catch {
        // Evidence and detachment are best-effort; nothing in the reader's path waits on them.
      }
    },
    async recordOpened(itemId) {
      if (!live()) return;
      try {
        await transport.recordOpened(store.installationId(), itemId);
      } catch {
        // As above.
      }
    },
    retire() {
      retired = true;
      for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
      listeners.clear();
    },
  };
}
