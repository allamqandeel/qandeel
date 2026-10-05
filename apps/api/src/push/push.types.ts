/**
 * A3-02 — the platform-delivery vocabulary (I-08N-01 D41, D49–D59; P3 §10, §11, §14, §15). Transport mechanics only:
 * every Product fact is A3-01's (`../activity`), and nothing here is a score, weight or threshold.
 */
import type { ActivityItemRow, DisclosureLevel } from '../activity/activity.types';

export const PUSH_PLATFORMS = ['ANDROID', 'IOS'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

/** The platforms' OWN push services. No third-party relay exists in this path (record §5). */
export type PushTransportName = 'FCM' | 'APNS';
export const TRANSPORT_OF: Readonly<Record<PushPlatform, PushTransportName>> = Object.freeze({ ANDROID: 'FCM', IOS: 'APNS' });

/** D50 — the OS permission as the device reports it. Apple provisional authorization is not adopted (P3 §11). */
export const OS_PERMISSIONS = ['GRANTED', 'DENIED', 'NOT_REQUESTED'] as const;
export type OsPermission = (typeof OS_PERMISSIONS)[number];

export type ApnsEnvironment = 'PRODUCTION' | 'SANDBOX';
export type PushLocale = 'ar' | 'en';

/** Terminal and waiting intent states (migration 0137). There is no DELIVERED and no PRESENTED: unknown stays unknown (D56). */
export type AttemptState = 'PENDING' | 'DEFERRED' | 'ACCEPTED' | 'SUPPRESSED' | 'EXPIRED' | 'TOKEN_INVALID' | 'REJECTED' | 'EXHAUSTED';

/** The device as one claimed intent sees it. The token never leaves the server. */
export interface ClaimedDevice {
  readonly id: string;
  readonly platform: PushPlatform;
  readonly transport: PushTransportName;
  readonly apnsEnvironment: ApnsEnvironment | null;
  readonly token: string | null;
  readonly status: 'ACTIVE' | 'DETACHED' | 'INVALIDATED';
  readonly osPermission: OsPermission;
  readonly timeZone: string;
  readonly locale: PushLocale;
}

export type ClaimedItem = ActivityItemRow & { readonly created_at: string };

/** One claimed intent: the CURRENT facts the dispatcher revalidates (server_claim_push_attempts_v1). */
export interface ClaimedAttempt {
  readonly attemptId: string;
  readonly userId: string;
  readonly attemptCount: number;
  readonly reevaluation: boolean;
  readonly device: ClaimedDevice;
  readonly item: ClaimedItem;
  /** The preference row, or null for the frozen defaults. */
  readonly preferences: Record<string, unknown> | null;
  readonly muted: boolean;
  readonly evidence: readonly { readonly at: string; readonly kind: ActivityItemRow['kind']; readonly critical: boolean; readonly requested: boolean }[];
  readonly now: string;
}

/** The bounded platform message for ONE device, rendered at ONE disclosure level. Never stored. */
export interface PlatformMessage {
  readonly level: DisclosureLevel;
  /** Null at L0 / L1: the OS frame names the app; QANDEEL adds nothing above its level. */
  readonly title: string | null;
  readonly body: string;
  /** Android: the channel the Product category maps to (L0 → the neutral channel, D15 / P3 §10.1). */
  readonly androidChannel: PushChannelId;
  /** iOS: groups by the same mapping; never a category with actions (no quick action exists, D42). */
  readonly threadId: PushChannelId;
  /** The ONLY data the message carries: an opaque marker and the item id. Never content, never an account. */
  readonly data: { readonly qandeel: 'a3'; readonly item: string };
  /** D57: the provider collapses repeats of the same intent (FCM tag / collapse key, APNs collapse id). */
  readonly collapseId: string;
  /** D59: seconds the provider may keep trying — never past the semantic window. */
  readonly ttlSeconds: number;
}

/**
 * Android channels / iOS thread groups, mapped FROM the Product categories (D52, P3 §10.2): the platform reflects Product
 * semantics and creates none. `qandeel` is the neutral channel every L0 message uses, so the channel itself never
 * reveals more than L0 may (D15: Introductions must not even reveal that it is Introductions).
 */
export const PUSH_CHANNELS = ['qandeel', 'category-qandeel', 'category-shared', 'category-public', 'category-introductions', 'category-system'] as const;
export type PushChannelId = (typeof PUSH_CHANNELS)[number];

/** The content-free outcome classes of a transport call (APP-OPS-01: no id, token, text or provider body). */
export type TransportOutcome =
  | { readonly kind: 'ACCEPTED' }
  | { readonly kind: 'TOKEN_INVALID'; readonly reason: string }
  | { readonly kind: 'REJECTED'; readonly reason: string }
  | { readonly kind: 'RETRYABLE'; readonly reason: string }
  | { readonly kind: 'NOT_CONFIGURED' };

// Implementation policy (none is Product law; migration 0137's header names the database half).
export const PUSH_MAX_TRANSPORT_ATTEMPTS = 6;
/** Back-off after the n-th failed transport attempt (ms). Every retry is revalidated from scratch (D54, D55). */
export const PUSH_RETRY_BACKOFF_MS = [30_000, 120_000, 600_000, 1_800_000, 7_200_000] as const;
export const PUSH_PLAN_BATCH = 200;
export const PUSH_CLAIM_BATCH = 50;
export const PUSH_LEASE_SECONDS = 60;
export const PUSH_DEFAULT_POLL_MS = 15_000;
