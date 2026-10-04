import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { DEFAULT_PREFERENCES, LOCK_DEFAULTS, type ActivityItemRow } from '../activity/activity.types';
import { ReevaluationPass, decideDispatch, deferralOutlivesItem, orderForPass, quietHoursEnd } from './push-dispatch-decision';
import { PushDispatcherWorker, type PushTransports } from './push-dispatcher.worker';
import { LOCK_SCREEN_COPY, projectForPlatform, ttlSecondsOf } from './push-projection';
import { ApnsTransport, FcmTransport, apnsHeaders, apnsPayload, classifyApns, classifyFcm, fcmBody } from './push-transport';
import { PushService } from './push.service';
import type { ClaimedAttempt, PlatformMessage, TransportOutcome } from './push.types';
import type { PushTransport } from './push-transport';

const NOW = Date.parse('2026-10-04T12:00:00.000Z'); // 15:00 in Africa/Cairo
const iso = (offset: number) => new Date(NOW + offset).toISOString();
const MIN = 60_000;
const H = 60 * MIN;

function item(o: Partial<ActivityItemRow & { created_at: string }> = {}): ActivityItemRow & { created_at: string } {
  return {
    id: '00000000-0000-4000-8000-000000000001', category: 'SYSTEM', kind: 'ACCOUNT', interruption_class: 2, critical: false,
    requested: false, context_kind: 'ACCOUNT', context_ref: null, context_label_ar: null, context_label_en: null,
    entry_destination: 'GENERAL_SETTINGS', entry_ref: 'ACCOUNT', speaker: 'PRODUCT', body_ar: 'جملة الحدث', body_en: 'The event sentence',
    secondary_ar: 'المعاينة', secondary_en: 'The preview', actionable: false, disclosure_max: 'L3', member_count: 1,
    occurred_at: iso(-2 * MIN), last_occurred_at: iso(-2 * MIN), expires_at: null, withdrawn_at: null, attention: 'NEW',
    presented_in_app_at: null, interruption_settled_at: null, created_at: iso(-2 * MIN), ...o,
  };
}


const prefsRow = (o: Record<string, unknown> = {}) => ({
  proactive: 'ALLOW', shared_alerts: true, public_interactions: true, public_discovery: false, introductions_alerts: true,
  account_updates: true, quiet_hours_enabled: false, quiet_hours_start: 1380, quiet_hours_end: 480, snooze_until: null,
  lock_qandeel: 'L1', lock_shared: 'L2', lock_public: 'L2', lock_discovery: 'L1', lock_introductions: 'L0', lock_reminders: 'L2',
  lock_account: 'L2', lock_security: 'L2', ...o,
});

function claim(o: Partial<ClaimedAttempt> = {}, itemOverrides: Partial<ActivityItemRow & { created_at: string }> = {}): ClaimedAttempt {
  return {
    attemptId: 'a-1', userId: 'u-1', attemptCount: 0, reevaluation: false,
    device: { id: 'd-1', platform: 'ANDROID', transport: 'FCM', apnsEnvironment: null, token: 'fcm-token', status: 'ACTIVE', osPermission: 'GRANTED', timeZone: 'Africa/Cairo', locale: 'en' },
    item: item(itemOverrides), preferences: prefsRow(), muted: false, evidence: [], now: iso(0), ...o,
  };
}

describe('A3-02 platform projection — the words never exceed the level (D14–D17, P3 §10)', () => {
  it('L0: the same words for every category, on the neutral channel, with no title', () => {
    for (const [category, kind, context] of [['SYSTEM', 'SECURITY', 'ACCOUNT'], ['INTRODUCTIONS', 'INTRODUCTION', 'INTRODUCTIONS'], ['SHARED', 'SHARED_ACTIVITY', 'SHARED_WORLD']] as const) {
      const m = projectForPlatform(item({ category, kind, context_kind: context, context_label_en: 'A World' }), 'L0', 'en', NOW);
      expect(m).toMatchObject({ title: null, body: 'New notification', androidChannel: 'qandeel', threadId: 'qandeel' });
      expect(JSON.stringify(m)).not.toMatch(/World|sentence|preview|Introductions|Security/u);
    }
    expect(projectForPlatform(item(), 'L0', 'ar', NOW).body).toBe('إشعار جديد');
  });

  it('L1: the category generic line only — no context label, no producer sentence', () => {
    const m = projectForPlatform(item({ context_label_en: 'Label' }), 'L1', 'en', NOW);
    expect(m).toMatchObject({ title: null, body: 'Account update', androidChannel: 'category-system' });
    expect(projectForPlatform(item({ kind: 'SECURITY', critical: true, interruption_class: 1 }), 'L1', 'ar', NOW).body).toBe('تنبيه أمان');
  });

  it('L2: a title and the bounded sentence, never the preview; L3 adds the preview', () => {
    const l2 = projectForPlatform(item(), 'L2', 'en', NOW);
    expect(l2).toMatchObject({ title: 'Account', body: 'The event sentence' });
    expect(l2.body).not.toContain('preview');
    const l3 = projectForPlatform(item(), 'L3', 'en', NOW);
    expect(l3.body).toBe('The event sentence\nThe preview');
    expect(projectForPlatform(item({ category: 'SHARED', kind: 'SHARED_ACTIVITY', context_kind: 'SHARED_WORLD', context_label_ar: 'عالمنا' }), 'L2', 'ar', NOW).title).toBe('عالمنا');
  });

  it('data carries only the opaque marker and the item id; the collapse id is the intent', () => {
    const m = projectForPlatform(item(), 'L3', 'en', NOW);
    expect(m.data).toEqual({ qandeel: 'a3', item: item().id });
    expect(m.collapseId).toBe(item().id);
  });

  it('every fixed Lock Screen string is one of the approved registry rows (pinned byte-exact by the root contract)', () => {
    expect(Object.keys(LOCK_SCREEN_COPY.generic).sort()).toEqual(Object.keys(LOCK_DEFAULTS).sort());
  });

  it('the TTL never outlives the semantic window or the 24 h freshness bound (D59)', () => {
    expect(ttlSecondsOf(item({ expires_at: iso(10 * MIN) }), NOW)).toBe(600);
    expect(ttlSecondsOf(item({ last_occurred_at: iso(-23 * H) }), NOW)).toBe(3600);
    expect(ttlSecondsOf(item({ expires_at: iso(-1) }), NOW)).toBe(0);
  });
});

describe('A3-02 dispatch decision — every intent revalidated against CURRENT truth (D54, D55)', () => {
  it('an eligible item is sent at the lower of the ceiling and the event projection', () => {
    const d = decideDispatch(claim(), NOW);
    expect(d).toMatchObject({ kind: 'SEND', level: 'L2' });
    expect(decideDispatch(claim({ preferences: prefsRow({ lock_account: 'L0' }) }), NOW)).toMatchObject({ kind: 'SEND', level: 'L0' });
    expect(decideDispatch(claim({}, { disclosure_max: 'L1' }), NOW)).toMatchObject({ kind: 'SEND', level: 'L1' });
    // Importance never raises disclosure (D14): critical security stays at its L2 default.
    expect(decideDispatch(claim({}, { kind: 'SECURITY', critical: true, interruption_class: 1 }), NOW)).toMatchObject({ kind: 'SEND', level: 'L2' });
  });

  it('no preference row = the frozen defaults (Quiet Hours ON in the DEVICE zone)', () => {
    expect(decideDispatch(claim({ preferences: null }), NOW).kind).toBe('SEND'); // 15:00 Cairo
    const night = Date.parse('2026-10-04T21:30:00.000Z'); // 00:30 Cairo
    const d = decideDispatch(claim({ preferences: null }, { last_occurred_at: new Date(night - MIN).toISOString() }), night);
    expect(d).toMatchObject({ kind: 'DEFER', reason: 'quiet_hours' });
    expect(new Date((d as { until: number }).until).toISOString()).toBe('2026-10-05T05:00:00.000Z'); // 08:00 Cairo
    expect(decideDispatch(claim({ preferences: null, device: { ...claim().device, timeZone: 'America/New_York' } }, { last_occurred_at: new Date(night - MIN).toISOString() }), night).kind).toBe('SEND');
  });

  it('Snooze defers to its end; the two exceptions go through (D06)', () => {
    const snoozed = prefsRow({ snooze_until: iso(2 * H) });
    expect(decideDispatch(claim({ preferences: snoozed }), NOW)).toEqual(expect.objectContaining({ kind: 'DEFER', reason: 'snoozed', until: NOW + 2 * H }));
    expect(decideDispatch(claim({ preferences: snoozed }, { kind: 'SECURITY', critical: true, interruption_class: 1 }), NOW).kind).toBe('SEND');
  });

  it('expired / withdrawn / not fresh → EXPIRED, never retried past the window (D59)', () => {
    expect(decideDispatch(claim({}, { expires_at: iso(-1) }), NOW)).toEqual({ kind: 'EXPIRE', reason: 'stale' });
    expect(decideDispatch(claim({}, { withdrawn_at: iso(-1) }), NOW)).toEqual({ kind: 'EXPIRE', reason: 'stale' });
    expect(decideDispatch(claim({}, { last_occurred_at: iso(-25 * H) }), NOW)).toEqual({ kind: 'EXPIRE', reason: 'not_fresh' });
    const c = claim({}, { expires_at: iso(30 * MIN) });
    expect(deferralOutlivesItem(c, NOW + H, NOW)).toBe(true);
    expect(deferralOutlivesItem(c, NOW + 10 * MIN, NOW)).toBe(false);
  });

  it('foreground is read from in-app EVIDENCE: presented / settled / seen items never push (D51)', () => {
    expect(decideDispatch(claim({}, { interruption_settled_at: iso(-MIN), presented_in_app_at: iso(-MIN) }), NOW)).toEqual({ kind: 'SUPPRESS', reason: 'settled' });
    expect(decideDispatch(claim({}, { attention: 'SEEN' }), NOW)).toEqual({ kind: 'SUPPRESS', reason: 'already_seen' });
  });

  it('muted / revoked / category off / OS permission / gate absent / ambient → SUPPRESSED', () => {
    const shared = { category: 'SHARED' as const, kind: 'SHARED_ACTIVITY' as const, context_kind: 'SHARED_WORLD' as const, context_ref: 'w-1', entry_destination: 'SHARED_WORLD' as const, entry_ref: 'w-1' };
    expect(decideDispatch(claim({ muted: true }, shared), NOW)).toEqual({ kind: 'SUPPRESS', reason: 'muted_context' });
    expect(decideDispatch(claim({ preferences: prefsRow({ account_updates: false }) }), NOW)).toEqual({ kind: 'SUPPRESS', reason: 'category_off' });
    expect(decideDispatch(claim({ device: { ...claim().device, osPermission: 'DENIED' } }), NOW)).toEqual({ kind: 'SUPPRESS', reason: 'os_permission' });
    expect(decideDispatch(claim({}, { category: 'QANDEEL', kind: 'PROACTIVE', context_kind: 'PERSONAL', entry_destination: 'PERSONAL_CONVERSATION', entry_ref: null, speaker: 'QANDEEL' }), NOW))
      .toEqual({ kind: 'SUPPRESS', reason: 'proactive_gate_absent' });
    expect(decideDispatch(claim({}, { category: 'INTRODUCTIONS', kind: 'INTRODUCTION', context_kind: 'INTRODUCTIONS', entry_destination: 'INTRODUCTIONS', entry_ref: 'x' }), NOW))
      .toEqual({ kind: 'SUPPRESS', reason: 'introductions_not_entered' });
    expect(decideDispatch(claim({}, { interruption_class: 4 }), NOW)).toEqual({ kind: 'SUPPRESS', reason: 'ambient' });
    expect(decideDispatch(claim({ device: { ...claim().device, status: 'DETACHED', token: null } }), NOW)).toEqual({ kind: 'SUPPRESS', reason: 'device_unavailable' });
  });

  it('the P3 §14 ceilings count delivery evidence; the two exceptions sit outside them', () => {
    const four = Array.from({ length: 4 }, (_, i) => ({ at: iso(-(i + 1) * H), kind: 'ACCOUNT' as const, critical: false, requested: false }));
    expect(decideDispatch(claim({ evidence: four }), NOW)).toEqual({ kind: 'SUPPRESS', reason: 'ordinary-24h' });
    expect(decideDispatch(claim({ evidence: four }, { kind: 'SECURITY', critical: true, interruption_class: 1 }), NOW).kind).toBe('SEND');
  });

  it('Quiet Hours end is the next device-local end, to the minute', () => {
    const at = Date.parse('2026-10-04T21:30:20.000Z');
    expect(new Date(quietHoursEnd(DEFAULT_PREFERENCES, 'Africa/Cairo', at)).toISOString()).toBe('2026-10-05T05:00:00.000Z');
  });

  it('re-evaluation after Quiet Hours: at most ONE item per reader interrupts per pass, on all its devices', () => {
    const a = claim({ attemptId: 'a', reevaluation: true }, { id: '00000000-0000-4000-8000-00000000000a', interruption_class: 3 });
    const aTablet = { ...a, attemptId: 'a2', device: { ...a.device, id: 'd-2' } };
    const b = claim({ attemptId: 'b', reevaluation: true }, { id: '00000000-0000-4000-8000-00000000000b', interruption_class: 2 });
    const fresh = claim({ attemptId: 'f' }, { id: '00000000-0000-4000-8000-00000000000f' });
    const ordered = orderForPass([a, aTablet, b, fresh]);
    expect(ordered[0].attemptId).toBe('b'); // the lower class wins (A3-01 chooseOne)
    const pass = new ReevaluationPass();
    const results = ordered.map((c) => [c.attemptId, pass.admit(c, decideDispatch(c, NOW)).kind]);
    expect(Object.fromEntries(results)).toEqual({ b: 'SEND', a: 'SUPPRESS', a2: 'SUPPRESS', f: 'SEND' });
    const same = new ReevaluationPass();
    expect([a, aTablet].map((c) => same.admit(c, decideDispatch(c, NOW)).kind)).toEqual(['SEND', 'SEND']);
  });
});

describe('A3-02 transports — payloads and the documented outcome classes', () => {
  const message: PlatformMessage = projectForPlatform(item(), 'L2', 'en', NOW);

  it('FCM: channel, tag / collapse key, TTL, data — and no badge', () => {
    const body = fcmBody('tok', message) as { message: Record<string, any> };
    expect(body.message.android).toEqual({ priority: 'high', ttl: `${message.ttlSeconds}s`, collapse_key: message.collapseId, notification: { channel_id: 'category-system', tag: message.collapseId } });
    expect(body.message.data).toEqual({ qandeel: 'a3', item: item().id });
    expect(JSON.stringify(body)).not.toMatch(/badge|notification_count/u);
    expect((fcmBody('tok', projectForPlatform(item(), 'L0', 'en', NOW)) as any).message.notification).toEqual({ body: 'New notification' });
  });

  it('APNs: collapse id, expiration, thread, no badge, no category / quick action', () => {
    expect(apnsPayload(message)).toEqual({ aps: { alert: { title: 'Account', body: 'The event sentence' }, sound: 'default', 'thread-id': 'category-system' }, qandeel: 'a3', item: item().id });
    const headers = apnsHeaders(message, 'com.qandeel.mobile', 'jwt', NOW);
    expect(headers['apns-collapse-id']).toBe(message.collapseId);
    expect(headers['apns-expiration']).toBe(String(NOW / 1000 + message.ttlSeconds));
    expect(headers['apns-push-type']).toBe('alert');
  });

  it('FCM classification', () => {
    expect(classifyFcm(404, 'UNREGISTERED')).toEqual({ kind: 'TOKEN_INVALID', reason: 'unregistered' });
    expect(classifyFcm(403, 'SENDER_ID_MISMATCH').kind).toBe('TOKEN_INVALID');
    expect(classifyFcm(401, 'THIRD_PARTY_AUTH_ERROR')).toEqual({ kind: 'RETRYABLE', reason: 'provider_auth' });
    expect(classifyFcm(429, 'QUOTA_EXCEEDED').kind).toBe('RETRYABLE');
    expect(classifyFcm(503, 'UNAVAILABLE').kind).toBe('RETRYABLE');
    expect(classifyFcm(400, 'INVALID_ARGUMENT')).toEqual({ kind: 'REJECTED', reason: 'invalid_argument' });
  });

  it('APNs classification', () => {
    expect(classifyApns(410, 'Unregistered').kind).toBe('TOKEN_INVALID');
    expect(classifyApns(400, 'BadDeviceToken').kind).toBe('TOKEN_INVALID');
    expect(classifyApns(400, 'DeviceTokenNotForTopic')).toEqual({ kind: 'TOKEN_INVALID', reason: 'token_not_for_topic' });
    expect(classifyApns(403, 'ExpiredProviderToken').kind).toBe('RETRYABLE');
    expect(classifyApns(429, 'TooManyRequests').kind).toBe('RETRYABLE');
    expect(classifyApns(400, 'PayloadTooLarge').kind).toBe('REJECTED');
  });

  it('without credentials a transport sends nothing and says so', async () => {
    expect(await new FcmTransport(null).send('t', message)).toEqual({ kind: 'NOT_CONFIGURED' });
    expect(await new ApnsTransport(null).send('t', message, { apnsEnvironment: 'PRODUCTION' })).toEqual({ kind: 'NOT_CONFIGURED' });
  });

  it('FCM: a signed service-account grant, then the v1 send', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const calls: { url: string; init: RequestInit }[] = [];
    const http = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.includes('oauth2')) {
        const assertion = new URLSearchParams(init.body as string).get('assertion') as string;
        const [h, c, s] = assertion.split('.');
        expect(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true);
        return new Response(JSON.stringify({ access_token: 'at', expires_in: 3600 }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const t = new FcmTransport({ projectId: 'p', clientEmail: 'sa@p', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string }, http, () => NOW);
    expect(await t.send('tok', message)).toEqual({ kind: 'ACCEPTED' });
    expect(await t.send('tok', message)).toEqual({ kind: 'ACCEPTED' });
    expect(calls.filter((c) => c.url.includes('oauth2'))).toHaveLength(1); // the access token is reused
    expect(calls[1].url).toBe('https://fcm.googleapis.com/v1/projects/p/messages:send');
  });

  it('APNs: an ES256 provider token, the environment host, and the device path', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const seen: { origin: string; path: string; headers: Record<string, string> }[] = [];
    const t = new ApnsTransport({ teamId: 'TEAM', keyId: 'KEY', topic: 'com.qandeel.mobile', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string },
      async (origin, path, headers) => { seen.push({ origin, path, headers }); return { status: 200, body: '' }; }, () => NOW);
    expect(await t.send('ab'.repeat(32), message, { apnsEnvironment: 'SANDBOX' })).toEqual({ kind: 'ACCEPTED' });
    expect(seen[0].origin).toBe('https://api.sandbox.push.apple.com');
    expect(seen[0].path).toBe(`/3/device/${'ab'.repeat(32)}`);
    const [h, c, s] = seen[0].headers.authorization.replace('bearer ', '').split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'KEY' });
    expect(createVerify('SHA256').update(`${h}.${c}`).verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'))).toBe(true);
    expect(await t.send('not-hex', message, { apnsEnvironment: 'PRODUCTION' })).toEqual({ kind: 'TOKEN_INVALID', reason: 'bad_device_token' });
  });
});

describe('A3-02 dispatcher — one pass, evidence only where it happened', () => {
  type Recorded = { id: string; state: string; reason: string | null; next: string | null; level: string | null; counted: boolean };
  function harness(claims: ClaimedAttempt[], outcomes: TransportOutcome[] = []) {
    const recorded: Recorded[] = [];
    const sent: { token: string; message: PlatformMessage }[] = [];
    const signals: string[] = [];
    const transport = (): PushTransport => ({
      configured: true,
      send: async (token, message) => { sent.push({ token, message }); return outcomes.shift() ?? { kind: 'ACCEPTED' }; },
    });
    const transports: PushTransports = { FCM: transport(), APNS: transport() };
    const repository = {
      plan: async () => [{ planned: claims.length }],
      claim: async () => claims,
      record: async (id: string, _t: string, state: string, reason: string | null, next: string | null, level: string | null, counted: boolean) => {
        recorded.push({ id, state, reason, next, level, counted }); return [{ outcome: 'RECORDED' }];
      },
    };
    const telemetry = { recordOperationalOutcome: (d: string, o: string, r: string) => signals.push(`${d}:${o}:${r}`) };
    const worker = new PushDispatcherWorker(repository as never, telemetry as never, transports);
    worker.clock = () => NOW;
    return { worker, recorded, sent, signals };
  }

  it('sends an eligible intent once and records ACCEPTED with its level — never delivered', async () => {
    const h = harness([claim()]);
    await h.worker.runOnce();
    expect(h.sent).toHaveLength(1);
    expect(h.recorded).toEqual([{ id: 'a-1', state: 'ACCEPTED', reason: 'accepted', next: null, level: 'L2', counted: true }]);
    expect(h.signals).toContain('PUSH_DELIVERY:dispatch_fcm:accepted');
    expect(JSON.stringify(h.signals)).not.toMatch(/fcm-token|sentence|a-1|u-1/u);
  });

  it('a dead token retires the device; a rejection is terminal; a transient failure retries with back-off, bounded', async () => {
    const h = harness([claim({ attemptId: 'x' }, { id: '00000000-0000-4000-8000-0000000000a1' }), claim({ attemptId: 'y' }, { id: '00000000-0000-4000-8000-0000000000a2' }),
      claim({ attemptId: 'z', attemptCount: 1 }, { id: '00000000-0000-4000-8000-0000000000a3' }), claim({ attemptId: 'w', attemptCount: 5 }, { id: '00000000-0000-4000-8000-0000000000a4' })],
    [{ kind: 'TOKEN_INVALID', reason: 'unregistered' }, { kind: 'REJECTED', reason: 'provider_rejected' }, { kind: 'RETRYABLE', reason: 'provider_unavailable' }, { kind: 'RETRYABLE', reason: 'transport' }]);
    await h.worker.runOnce();
    const by = Object.fromEntries(h.recorded.map((r) => [r.id, r]));
    expect(by.x.state).toBe('TOKEN_INVALID');
    expect(by.y.state).toBe('REJECTED');
    expect(by.z).toMatchObject({ state: 'PENDING', counted: true, next: new Date(NOW + 120_000).toISOString() });
    expect(by.w).toMatchObject({ state: 'EXHAUSTED', counted: true });
  });

  it('a transport without credentials sends nothing and the intent waits, uncounted', async () => {
    const h = harness([claim()], [{ kind: 'NOT_CONFIGURED' }]);
    await h.worker.runOnce();
    expect(h.recorded[0]).toMatchObject({ state: 'PENDING', reason: 'provider_not_configured', counted: false });
  });

  it('deferrals and suppressions send nothing', async () => {
    const h = harness([claim({ attemptId: 'q', preferences: prefsRow({ snooze_until: iso(H) }) }), claim({ attemptId: 's' }, { id: '00000000-0000-4000-8000-0000000000b1', attention: 'SEEN' })]);
    await h.worker.runOnce();
    expect(h.sent).toHaveLength(0);
    expect(Object.fromEntries(h.recorded.map((r) => [r.id, `${r.state}:${r.reason}`]))).toEqual({ q: 'DEFERRED:snoozed', s: 'SUPPRESSED:already_seen' });
  });

  it('the ceilings see this pass’s own acceptances: the fifth ordinary item in 24 h is suppressed', async () => {
    const evidence = Array.from({ length: 3 }, (_, i) => ({ at: iso(-(i + 1) * H), kind: 'ACCOUNT' as const, critical: false, requested: false }));
    const claims = [1, 2].map((n) => claim({ attemptId: `c${n}`, evidence }, { id: `00000000-0000-4000-8000-00000000000${n}`, last_occurred_at: iso(-n * MIN) }));
    const h = harness(claims);
    await h.worker.runOnce();
    expect(h.recorded.map((r) => `${r.id}:${r.state}`).sort()).toEqual(['c1:ACCEPTED', 'c2:SUPPRESSED']);
  });

  it('one item to two devices of one reader: both sent (one interruption), each with its own evidence', async () => {
    const phone = claim({ attemptId: 'p' });
    const tablet = claim({ attemptId: 't', device: { ...claim().device, id: 'd-2', platform: 'IOS', transport: 'APNS', apnsEnvironment: 'PRODUCTION', token: 'ab'.repeat(32) } });
    const h = harness([phone, tablet]);
    await h.worker.runOnce();
    expect(h.recorded.map((r) => `${r.id}:${r.state}`).sort()).toEqual(['p:ACCEPTED', 't:ACCEPTED']);
  });
});

describe('A3-02 device boundary — strict input, outcome words only', () => {
  const ok = { installationId: '11111111-1111-4111-8111-111111111111', platform: 'ANDROID', pushToken: 'tok', apnsEnvironment: null, osPermission: 'GRANTED', timeZone: 'Africa/Cairo', locale: 'ar', appVersion: '0.1.0' };
  const service = (outcome: unknown = [{ outcome: 'REGISTERED' }]) => new PushService({
    sync: async () => outcome, detach: async () => [{ outcome: 'DETACHED' }], detachOthers: async () => [{ detached: 2 }], recordOpen: async () => [{ outcome: 'RECORDED' }],
  } as never);

  it('accepts a well-formed sync and answers only the outcome', async () => {
    expect(await service().sync('jwt', ok)).toEqual({ outcome: 'REGISTERED' });
  });

  it('refuses malformed input', async () => {
    for (const bad of [{ ...ok, extra: 1 }, { ...ok, platform: 'WEB' }, { ...ok, osPermission: 'PROVISIONAL' }, { ...ok, timeZone: 'Mars/Base' },
      { ...ok, platform: 'IOS', apnsEnvironment: null }, { ...ok, apnsEnvironment: 'PRODUCTION' }, { ...ok, pushToken: 'a b' }, { ...ok, installationId: 'x' }, { ...ok, locale: 'fr' }]) {
      await expect(service().sync('jwt', bad)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('a token-less sync is legitimate (permission denied / not yet requested)', async () => {
    expect(await service().sync('jwt', { ...ok, pushToken: null, osPermission: 'DENIED' })).toEqual({ outcome: 'REGISTERED' });
  });

  it('upstream failure is one sanitized 503', async () => {
    await expect(service([]).sync('jwt', ok)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('detach, detach others, opened', async () => {
    expect(await service().detach('jwt', { installationId: ok.installationId })).toEqual({ outcome: 'DETACHED' });
    expect(await service().detachOthers('jwt', { installationId: ok.installationId })).toEqual({ outcome: 'DETACHED' });
    expect(await service().recordOpen('jwt', { installationId: ok.installationId, itemId: '00000000-0000-4000-8000-000000000001' })).toEqual({ outcome: 'RECORDED' });
    await expect(service().recordOpen('jwt', { installationId: ok.installationId, itemId: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
  });
});


