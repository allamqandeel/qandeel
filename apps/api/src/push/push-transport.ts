import { createSign, type KeyObject, createPrivateKey } from 'node:crypto';
import { connect, type ClientHttp2Session } from 'node:http2';
import type { ApnsEnvironment, PlatformMessage, TransportOutcome } from './push.types';

/**
 * A3-02 — the two platform push transports, built on Node's own `fetch`, `crypto` and `http2`: no SDK, no third-party
 * relay, no new dependency (record §5). Each sends ONE already-revalidated, already-bounded message to ONE device and
 * answers ONE content-free outcome class. Nothing here logs; nothing here reads Product truth.
 *
 * Credentials come only from the deployment's secret store, by these names (never a value in the repository, a log, an
 * artifact or a client — record §7):
 *
 *   FCM   QANDEEL_FCM_PROJECT_ID, QANDEEL_FCM_CLIENT_EMAIL, QANDEEL_FCM_PRIVATE_KEY   (a Firebase service account)
 *   APNs  QANDEEL_APNS_TEAM_ID, QANDEEL_APNS_KEY_ID, QANDEEL_APNS_PRIVATE_KEY, QANDEEL_APNS_TOPIC   (a .p8 token key)
 *
 * A transport without its credentials answers NOT_CONFIGURED and sends nothing; the intent then waits (it is never
 * recorded as sent, and never as failed delivery).
 */
export interface PushTransport {
  readonly configured: boolean;
  send(token: string, message: PlatformMessage, target: { readonly apnsEnvironment: ApnsEnvironment | null }): Promise<TransportOutcome>;
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString('base64url');
const pem = (value: string | undefined) => (value ? value.replace(/\\n/gu, '\n') : undefined);

// ---------------------------------------------------------------------------------------------------------------------
// FCM HTTP v1
// ---------------------------------------------------------------------------------------------------------------------

export interface FcmCredentials { readonly projectId: string; readonly clientEmail: string; readonly privateKey: string }

export function fcmCredentialsFrom(env: NodeJS.ProcessEnv = process.env): FcmCredentials | null {
  const projectId = env.QANDEEL_FCM_PROJECT_ID;
  const clientEmail = env.QANDEEL_FCM_CLIENT_EMAIL;
  const privateKey = pem(env.QANDEEL_FCM_PRIVATE_KEY);
  return projectId && clientEmail && privateKey ? { projectId, clientEmail, privateKey } : null;
}

/** The FCM v1 request body. Data carries the opaque item id only; the channel and collapse key come from the projection. */
export function fcmBody(token: string, message: PlatformMessage): Record<string, unknown> {
  return {
    message: {
      token,
      notification: message.title === null ? { body: message.body } : { title: message.title, body: message.body },
      data: { ...message.data },
      android: {
        // Delivery mechanics only: the message may wake the device; the Product class is never an OS level (P3 §9).
        priority: 'high',
        ttl: `${message.ttlSeconds}s`,
        collapse_key: message.collapseId,
        notification: { channel_id: message.androidChannel, tag: message.collapseId },
      },
    },
  };
}

type Fetch = typeof fetch;

export class FcmTransport implements PushTransport {
  private accessToken: { readonly value: string; readonly expiresAt: number } | null = null;

  constructor(private readonly credentials: FcmCredentials | null, private readonly http: Fetch = fetch, private readonly clock: () => number = Date.now) {}

  get configured(): boolean { return this.credentials !== null; }

  async send(token: string, message: PlatformMessage): Promise<TransportOutcome> {
    if (this.credentials === null) return { kind: 'NOT_CONFIGURED' };
    let bearer: string;
    try {
      bearer = await this.bearer(this.credentials);
    } catch {
      return { kind: 'RETRYABLE', reason: 'provider_auth' };
    }
    let response: Response;
    try {
      response = await this.http(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.credentials.projectId)}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(fcmBody(token, message)),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return { kind: 'RETRYABLE', reason: 'transport' };
    }
    if (response.ok) return { kind: 'ACCEPTED' };
    const code = await fcmErrorCode(response);
    return classifyFcm(response.status, code);
  }

  private async bearer(credentials: FcmCredentials): Promise<string> {
    const now = this.clock();
    if (this.accessToken !== null && this.accessToken.expiresAt - 60_000 > now) return this.accessToken.value;
    const iat = Math.floor(now / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({
      iss: credentials.clientEmail, scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600,
    }));
    const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(credentials.privateKey).toString('base64url');
    const response = await this.http('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${signature}` }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('FCM_AUTH');
    const body = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof body.access_token !== 'string') throw new Error('FCM_AUTH');
    const seconds = typeof body.expires_in === 'number' ? body.expires_in : 3600;
    this.accessToken = { value: body.access_token, expiresAt: now + seconds * 1000 };
    return body.access_token;
  }
}

async function fcmErrorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: { status?: string; details?: { errorCode?: string }[] } };
    return body.error?.details?.find((d) => typeof d.errorCode === 'string')?.errorCode ?? body.error?.status ?? null;
  } catch {
    return null;
  }
}

/** FCM's documented error codes → an outcome class. A dead token is retired; everything transient is retried. */
export function classifyFcm(status: number, code: string | null): TransportOutcome {
  if (code === 'UNREGISTERED' || status === 404) return { kind: 'TOKEN_INVALID', reason: 'unregistered' };
  if (code === 'SENDER_ID_MISMATCH') return { kind: 'TOKEN_INVALID', reason: 'sender_mismatch' };
  if (status === 401 || code === 'THIRD_PARTY_AUTH_ERROR' || status === 403) return { kind: 'RETRYABLE', reason: 'provider_auth' };
  if (status === 429 || code === 'QUOTA_EXCEEDED') return { kind: 'RETRYABLE', reason: 'provider_throttled' };
  if (status >= 500 || code === 'UNAVAILABLE' || code === 'INTERNAL') return { kind: 'RETRYABLE', reason: 'provider_unavailable' };
  return { kind: 'REJECTED', reason: code === 'INVALID_ARGUMENT' ? 'invalid_argument' : 'provider_rejected' };
}

// ---------------------------------------------------------------------------------------------------------------------
// APNs (token-based provider authentication, HTTP/2)
// ---------------------------------------------------------------------------------------------------------------------

export interface ApnsCredentials { readonly teamId: string; readonly keyId: string; readonly privateKey: string; readonly topic: string }

export function apnsCredentialsFrom(env: NodeJS.ProcessEnv = process.env): ApnsCredentials | null {
  const teamId = env.QANDEEL_APNS_TEAM_ID;
  const keyId = env.QANDEEL_APNS_KEY_ID;
  const privateKey = pem(env.QANDEEL_APNS_PRIVATE_KEY);
  const topic = env.QANDEEL_APNS_TOPIC;
  return teamId && keyId && privateKey && topic ? { teamId, keyId, privateKey, topic } : null;
}

/** The APNs payload. No `badge` key exists: the app-icon badge is not used (record §9; P3 §6, D48). */
export function apnsPayload(message: PlatformMessage): Record<string, unknown> {
  return {
    aps: {
      alert: message.title === null ? { body: message.body } : { title: message.title, body: message.body },
      sound: 'default',
      'thread-id': message.threadId,
    },
    ...message.data,
  };
}

export function apnsHeaders(message: PlatformMessage, topic: string, bearer: string, now: number): Record<string, string> {
  return {
    authorization: `bearer ${bearer}`,
    'apns-topic': topic,
    'apns-push-type': 'alert',
    'apns-priority': '10',
    'apns-expiration': String(Math.floor(now / 1000) + message.ttlSeconds),
    'apns-collapse-id': message.collapseId,
  };
}

/** One HTTP/2 POST. Injectable so the transport is testable without the network. */
export type Http2Post = (origin: string, path: string, headers: Record<string, string>, body: string) => Promise<{ readonly status: number; readonly body: string }>;

export class ApnsTransport implements PushTransport {
  private providerToken: { readonly value: string; readonly issuedAt: number } | null = null;
  private key: KeyObject | null = null;

  constructor(private readonly credentials: ApnsCredentials | null, private readonly post: Http2Post = http2Post, private readonly clock: () => number = Date.now) {}

  get configured(): boolean { return this.credentials !== null; }

  async send(token: string, message: PlatformMessage, target: { readonly apnsEnvironment: ApnsEnvironment | null }): Promise<TransportOutcome> {
    if (this.credentials === null) return { kind: 'NOT_CONFIGURED' };
    if (!/^[0-9a-fA-F]{32,200}$/u.test(token)) return { kind: 'TOKEN_INVALID', reason: 'bad_device_token' };
    const now = this.clock();
    let bearer: string;
    try {
      bearer = this.bearer(this.credentials, now);
    } catch {
      return { kind: 'RETRYABLE', reason: 'provider_auth' };
    }
    const origin = target.apnsEnvironment === 'SANDBOX' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
    let response: { status: number; body: string };
    try {
      response = await this.post(origin, `/3/device/${token}`, apnsHeaders(message, this.credentials.topic, bearer, now), JSON.stringify(apnsPayload(message)));
    } catch {
      return { kind: 'RETRYABLE', reason: 'transport' };
    }
    if (response.status === 200) return { kind: 'ACCEPTED' };
    let reason: string | null = null;
    try {
      reason = (JSON.parse(response.body) as { reason?: string }).reason ?? null;
    } catch {
      reason = null;
    }
    return classifyApns(response.status, reason);
  }

  /** The provider token is reused for up to 50 minutes (Apple refuses one older than 60). */
  private bearer(credentials: ApnsCredentials, now: number): string {
    if (this.providerToken !== null && now - this.providerToken.issuedAt < 50 * 60_000) return this.providerToken.value;
    this.key ??= createPrivateKey(credentials.privateKey);
    const header = b64url(JSON.stringify({ alg: 'ES256', kid: credentials.keyId }));
    const claims = b64url(JSON.stringify({ iss: credentials.teamId, iat: Math.floor(now / 1000) }));
    const signature = createSign('SHA256').update(`${header}.${claims}`).sign({ key: this.key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    const value = `${header}.${claims}.${signature}`;
    this.providerToken = { value, issuedAt: now };
    return value;
  }
}

/** Apple's documented reasons → an outcome class. */
export function classifyApns(status: number, reason: string | null): TransportOutcome {
  if (status === 410 || reason === 'Unregistered' || reason === 'BadDeviceToken' || reason === 'DeviceTokenNotForTopic') {
    return { kind: 'TOKEN_INVALID', reason: reason === 'DeviceTokenNotForTopic' ? 'token_not_for_topic' : status === 410 ? 'unregistered' : 'bad_device_token' };
  }
  if (status === 403 || reason === 'ExpiredProviderToken' || reason === 'InvalidProviderToken') return { kind: 'RETRYABLE', reason: 'provider_auth' };
  if (status === 429) return { kind: 'RETRYABLE', reason: 'provider_throttled' };
  if (status >= 500) return { kind: 'RETRYABLE', reason: 'provider_unavailable' };
  return { kind: 'REJECTED', reason: 'provider_rejected' };
}

const sessions = new Map<string, ClientHttp2Session>();

function http2Post(origin: string, path: string, headers: Record<string, string>, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let session = sessions.get(origin);
    if (session === undefined || session.closed || session.destroyed) {
      session = connect(origin);
      session.on('error', () => sessions.delete(origin));
      session.on('close', () => sessions.delete(origin));
      session.unref();
      sessions.set(origin, session);
    }
    const request = session.request({ ':method': 'POST', ':path': path, 'content-type': 'application/json', ...headers });
    request.setTimeout(10_000, () => request.close());
    let status = 0;
    const chunks: Buffer[] = [];
    request.on('response', (h) => { status = Number(h[':status']); });
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => (status === 0 ? reject(new Error('APNS_NO_RESPONSE')) : resolve({ status, body: Buffer.concat(chunks).toString('utf8') })));
    request.on('error', reject);
    request.end(body);
  });
}
