/**
 * A3-02 — the ONE seam between QANDEEL and the device's own notification system.
 *
 * Everything platform-specific stays behind this port (AGENTS.md §4: provider logic behind an adapter): reading and
 * requesting the OS permission, the platform device token and its rotation, the Android channels, the foreground
 * presentation policy, the notification-tap responses, and the hand-off to the OS notification settings. The production
 * implementation is `expo-push-platform.ts` (Expo's first-party `expo-notifications`, which talks to APNs / FCM
 * natively — no relay); tests and the validation proof use their own.
 *
 * The OS owns the prompt and its answer, the notification card, the Lock Screen and its preview setting, sound, channel
 * importance and Focus / Do Not Disturb (P3-A platform gate, "ownership split"). QANDEEL owns WHEN to ask, the education
 * before it, which events may interrupt, the words, and the Direct Entry after a tap.
 */
import type { OsPermission, PushPlatform } from '../runtime-entry/push-api';

export interface OsPermissionState {
  readonly permission: OsPermission;
  /** False once the OS will no longer show its prompt (iOS after one answer; Android after repeated refusal). */
  readonly canAskAgain: boolean;
}

/** One Android channel, as the device registers it. Names are approved / CANON words in the reader's language. */
export interface ChannelSpec {
  readonly id: string;
  readonly name: string;
}

/** The opaque payload of a QANDEEL notification: a marker and an Activity item id. Nothing else is ever read from it. */
export interface NotificationTap {
  readonly itemId: string;
}

export interface PushPlatformPort {
  readonly platform: PushPlatform;
  /** Which APNs environment issued this build's token (iOS only). */
  readonly apnsEnvironment: 'PRODUCTION' | 'SANDBOX' | null;
  readPermission(): Promise<OsPermissionState>;
  /** The REAL OS prompt. Called only after the reader chose to allow in QANDEEL's education (P3 §11). */
  requestPermission(): Promise<OsPermissionState>;
  /** The platform device token, or null when the platform cannot give one (e.g. no push service configured). */
  deviceToken(): Promise<string | null>;
  onTokenChange(listener: (token: string) => void): () => void;
  /** Android: register the channels (idempotent). iOS: nothing — no category is registered (no quick action, D42). */
  ensureChannels(channels: readonly ChannelSpec[]): Promise<void>;
  /**
   * While the app is in front, a QANDEEL notification is NOT presented by the OS: the in-app law owns that moment (D51,
   * P3 §15). `onForegroundArrival` lets the in-app attention re-read current truth at once.
   */
  installForegroundPolicy(onForegroundArrival: () => void): () => void;
  onTap(listener: (tap: NotificationTap) => void): () => void;
  /** The tap that launched the app from a terminated state, once; then it is cleared. */
  takeLaunchTap(): Promise<NotificationTap | null>;
  /** The device's own notification settings for this app (a hand-off, never an imitation — P3 §12.2). */
  openNotificationSettings(): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** Reads a tap's payload strictly: the QANDEEL marker and one item id, or nothing. */
export function tapFromPayload(data: unknown): NotificationTap | null {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  return record.qandeel === 'a3' && typeof record.item === 'string' && UUID.test(record.item) ? { itemId: record.item } : null;
}

/**
 * A port for a host with no notification system (Jest, a configuration-refused build): the permission reads
 * NOT_REQUESTED, no token exists, nothing is ever presented and no tap ever arrives. It never fakes a grant.
 */
export function createInertPushPlatformPort(platform: PushPlatform = 'ANDROID'): PushPlatformPort {
  return {
    platform,
    apnsEnvironment: platform === 'IOS' ? 'SANDBOX' : null,
    readPermission: async () => ({ permission: 'NOT_REQUESTED', canAskAgain: true }),
    requestPermission: async () => ({ permission: 'NOT_REQUESTED', canAskAgain: true }),
    deviceToken: async () => null,
    onTokenChange: () => () => undefined,
    ensureChannels: async () => undefined,
    installForegroundPolicy: () => () => undefined,
    onTap: () => () => undefined,
    takeLaunchTap: async () => null,
    openNotificationSettings: async () => undefined,
  };
}
