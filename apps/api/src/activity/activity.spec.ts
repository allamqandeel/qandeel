import 'reflect-metadata';
import { BadRequestException, NotFoundException, RequestMethod, ServiceUnavailableException } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { ActivityCandidateInvalidError, ActivityPublisher, validateCandidate, type ActivityCandidate } from './activity-publisher.service';
import { ActivityController } from './activity.controller';
import type { ActivityPreferencesRow, ActivityRepository } from './activity.repository';
import { ActivityService } from './activity.service';
import type { ActivityItemRow } from './activity.types';

const USER = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'caller-token';
const ITEM = '22222222-2222-4222-8222-222222222222';
const iso = (offset = 0) => new Date(Date.now() + offset).toISOString();

function row(overrides: Partial<ActivityItemRow> = {}): ActivityItemRow {
  return {
    id: ITEM, category: 'SYSTEM', kind: 'ACCOUNT', interruption_class: 3, critical: false, requested: false,
    context_kind: 'ACCOUNT', context_ref: null, context_label_ar: null, context_label_en: null,
    entry_destination: 'GENERAL_SETTINGS', entry_ref: 'ACCOUNT', speaker: 'PRODUCT', body_ar: 'جملة', body_en: 'sentence',
    secondary_ar: null, secondary_en: null, actionable: false, disclosure_max: 'L2', member_count: 1, occurred_at: iso(-60_000),
    last_occurred_at: iso(-60_000), expires_at: null, withdrawn_at: null, attention: 'NEW', presented_in_app_at: null,
    interruption_settled_at: null, ...overrides,
  };
}

function repository(overrides: Partial<Record<keyof ActivityRepository, jest.Mock>> = {}) {
  return {
    page: jest.fn().mockResolvedValue([]), anchor: jest.fn().mockResolvedValue([]), attentionItems: jest.fn().mockResolvedValue([]),
    preferences: jest.fn().mockResolvedValue([]), mutes: jest.fn().mockResolvedValue([]), markSeen: jest.fn().mockResolvedValue([{ seen: 1 }]),
    open: jest.fn(), recordStrip: jest.fn().mockResolvedValue([{ presented: 1, settled: 0 }]), savePreferences: jest.fn().mockResolvedValue([{ outcome: 'SAVED' }]),
    setSnooze: jest.fn().mockResolvedValue([{ outcome: 'SNOOZED' }]), setMute: jest.fn(), publish: jest.fn(), withdraw: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<ActivityRepository>;
}

describe('A3-01 ActivityController — owner-only routes, no publication route', () => {
  const routes = Object.getOwnPropertyNames(ActivityController.prototype).filter((name) => name !== 'constructor')
    .map((name) => {
      const handler = (ActivityController.prototype as unknown as Record<string, object>)[name];
      return `${RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod]} /activity/${Reflect.getMetadata(PATH_METADATA, handler) as string}`;
    }).sort();

  it('serves exactly the nine Activity routes, every one guarded at the class', () => {
    expect(Reflect.getMetadata(PATH_METADATA, ActivityController)).toBe('activity');
    expect(Reflect.getMetadata(GUARDS_METADATA, ActivityController)).toEqual([SupabaseAuthGuard]);
    expect(routes).toEqual([
      'GET /activity/attention', 'GET /activity/items', 'GET /activity/preferences', 'POST /activity/items/:itemId/open',
      'POST /activity/items/seen', 'POST /activity/strip', 'PUT /activity/mutes', 'PUT /activity/preferences', 'PUT /activity/snooze',
    ]);
    expect(routes.join(' ')).not.toMatch(/publish|withdraw|push|device|token/iu);
  });

  it('passes only the verified identity — never a user id from the request', async () => {
    const service = { page: jest.fn().mockResolvedValue({ items: [], before: null }) } as unknown as ActivityService;
    await new ActivityController(service).page({ headers: {}, authenticatedUser: { userId: USER, accessToken: TOKEN } } as never, { userId: 'someone-else' });
    expect((service.page as jest.Mock).mock.calls[0].slice(0, 2)).toEqual([USER, TOKEN]);
  });
});

describe('A3-01 ActivityService — the feed', () => {
  it('reads with the caller token AND the caller user id (account isolation), bounded keyset pages', async () => {
    const repo = repository({ page: jest.fn().mockResolvedValue([row(), row({ id: '33333333-3333-4333-8333-333333333333' })]) });
    const view = await new ActivityService(repo).page(USER, TOKEN, { limit: '1' });
    expect(repo.page).toHaveBeenCalledWith(TOKEN, USER, 1, null, null);
    expect(view.items).toHaveLength(1);
    expect(view.before).toBe(ITEM);
  });

  it('refuses an unbounded or unknown query', async () => {
    const service = new ActivityService(repository());
    for (const query of [{ limit: '51' }, { limit: '0' }, { limit: 'x' }, { category: 'WORLD' }, { before: 'not-a-uuid' }, { userId: USER }]) {
      await expect(service.page(USER, TOKEN, query)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('a cursor must name one of the caller\'s own items', async () => {
    const repo = repository({ anchor: jest.fn().mockResolvedValue([]) });
    await expect(new ActivityService(repo).page(USER, TOKEN, { before: ITEM })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.anchor).toHaveBeenCalledWith(TOKEN, USER, ITEM);
  });

  it('a row is presence and words only: stale, muted, waiting and Direct Entry availability are derived, nothing internal leaks', async () => {
    const shared = row({ category: 'SHARED', kind: 'SHARED_ACTIVITY', context_kind: 'SHARED_WORLD', context_ref: 'w1', entry_destination: 'SHARED_WORLD', entry_ref: 'w1' });
    const repo = repository({
      page: jest.fn().mockResolvedValue([row({ actionable: true, attention: 'SEEN' }), row({ expires_at: iso(-1) }), shared]),
      mutes: jest.fn().mockResolvedValue([{ context_ref: 'w1' }]),
    });
    const { items } = await new ActivityService(repo).page(USER, TOKEN, {});
    expect(items[0]).toMatchObject({ waiting: true, stale: false, mark: true, entry: 'AVAILABLE' });
    expect(items[1]).toMatchObject({ stale: true, mark: false, entry: 'UNAVAILABLE' });
    // S4-04: a Shared World row is a Direct Entry (re-authorized at open); muting silences it and changes nothing else.
    expect(items[2]).toMatchObject({ muted: true, mark: false, entry: 'AVAILABLE' });
    expect(JSON.stringify(items)).not.toMatch(/context_ref|w1|entry_ref|source|candidate|member/u);
  });

  it('any upstream failure is one sanitized 503', async () => {
    const repo = repository({ page: jest.fn().mockRejectedValue(new DataApiError(500)) });
    await expect(new ActivityService(repo).page(USER, TOKEN, {})).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('A3-01 ActivityService — attention summary', () => {
  const now = Date.now();
  it('global is presence with NO count field; Shared counts rows; Introductions presence only; System counts actionable only', async () => {
    const repo = repository({
      attentionItems: jest.fn().mockResolvedValue([
        row({ id: 'a', category: 'SHARED', kind: 'SHARED_ACTIVITY', context_kind: 'SHARED_WORLD', context_ref: 'w', entry_destination: 'NONE', entry_ref: null, member_count: 3 }),
        row({ id: 'b', actionable: true }),
        row({ id: 'c' }),
      ]),
    });
    const view = await new ActivityService(repo).attention(USER, TOKEN, { timeZone: 'Africa/Cairo' });
    expect(view.present).toBe(true);
    expect(Object.keys(view).sort()).toEqual(['categories', 'interruptions', 'present']);
    expect(view.categories.SHARED).toEqual({ present: true, count: 1 });
    expect(view.categories.SYSTEM).toEqual({ present: true, count: 1 });
    expect(view.categories.INTRODUCTIONS).toEqual({ present: false });
    expect(view.categories.QANDEEL).toEqual({ present: false });
    void now;
  });

  it('no attention items: no mark', async () => {
    const view = await new ActivityService(repository()).attention(USER, TOKEN, { timeZone: 'UTC' });
    expect(view.present).toBe(false);
    expect(view.interruptions).toEqual([]);
  });

  it('a device-local rule needs a real IANA zone — never a UTC guess', async () => {
    const service = new ActivityService(repository());
    for (const query of [{}, { timeZone: 'Mars/Olympus' }, { timeZone: '../etc' }, { timeZone: 'UTC', extra: '1' }]) {
      await expect(service.attention(USER, TOKEN, query)).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});

describe('A3-01 ActivityService — attention state never resolves anything; Direct Entry revalidates', () => {
  it('seen: bounded, unique ids only', async () => {
    const repo = repository();
    const service = new ActivityService(repo);
    await service.markSeen(TOKEN, { itemIds: [ITEM] });
    expect(repo.markSeen).toHaveBeenCalledWith(TOKEN, [ITEM]);
    for (const body of [{ itemIds: [] }, { itemIds: [ITEM, ITEM] }, { itemIds: Array(65).fill(ITEM) }, { itemIds: ['x'] }, {}]) {
      await expect(service.markSeen(TOKEN, body)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  const open = (answer: unknown) => new ActivityService(repository({ open: jest.fn().mockResolvedValue(answer) })).open(TOKEN, ITEM);
  const opened = (destination: string, ref: string | null, context = 'PERSONAL') =>
    [{ outcome: 'OPENED', category: 'QANDEEL', context_kind: context, context_ref: null, entry_destination: destination, entry_ref: ref }];

  it('current Product destinations execute', async () => {
    await expect(open(opened('PERSONAL_CONVERSATION', null))).resolves.toEqual({ outcome: 'ENTER', destination: { kind: 'PERSONAL_CONVERSATION' } });
    await expect(open(opened('QANDEEL_UNDERSTANDING', null))).resolves.toEqual({ outcome: 'ENTER', destination: { kind: 'QANDEEL_UNDERSTANDING' } });
    await expect(open(opened('GENERAL_SETTINGS', 'SECURITY', 'ACCOUNT'))).resolves.toEqual({ outcome: 'ENTER', destination: { kind: 'GENERAL_SETTINGS', section: 'SECURITY' } });
  });

  it('Stage 6–8 destinations (and Replay, Stage 7) stay typed but fail closed', async () => {
    for (const destination of ['INTRODUCTIONS', 'REPLAY']) {
      await expect(open(opened(destination, 'ref', 'SHARED_WORLD'))).resolves.toEqual({ outcome: 'UNAVAILABLE', fallback: null });
    }
  });

  it('a stale target gets no guessed destination — only a safe act into its own originating context (D39)', async () => {
    await expect(open([{ outcome: 'STALE', category: 'QANDEEL', context_kind: 'PERSONAL', context_ref: null, entry_destination: null, entry_ref: null }]))
      .resolves.toEqual({ outcome: 'STALE', fallback: { kind: 'PERSONAL_CONVERSATION' } });
    await expect(open([{ outcome: 'STALE', category: 'SHARED', context_kind: 'SHARED_WORLD', context_ref: 'w', entry_destination: null, entry_ref: null }]))
      .resolves.toEqual({ outcome: 'STALE', fallback: null });
  });

  it('another account\'s item, or a malformed id, is the same 404', async () => {
    await expect(open([{ outcome: 'NOT_FOUND', category: null, context_kind: null, context_ref: null, entry_destination: null, entry_ref: null }])).rejects.toBeInstanceOf(NotFoundException);
    await expect(new ActivityService(repository()).open(TOKEN, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('strip evidence: one presented item, the rest settled; never both for one item, never empty', async () => {
    const repo = repository();
    const service = new ActivityService(repo);
    await service.recordStrip(TOKEN, { presentedItemId: ITEM, settledItemIds: [] });
    expect(repo.recordStrip).toHaveBeenCalledWith(TOKEN, ITEM, []);
    for (const body of [{ presentedItemId: null, settledItemIds: [] }, { presentedItemId: ITEM, settledItemIds: [ITEM] }, { presentedItemId: ITEM }]) {
      await expect(service.recordStrip(TOKEN, body)).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});

describe('A3-01 ActivityService — preferences persistence', () => {
  const stored: ActivityPreferencesRow = {
    proactive: 'REDUCE', shared_alerts: false, public_interactions: true, public_discovery: true, introductions_alerts: true,
    account_updates: false, quiet_hours_enabled: true, quiet_hours_start: 22 * 60 + 30, quiet_hours_end: 7 * 60,
    snooze_until: null, lock_qandeel: 'L1', lock_shared: 'L3', lock_public: 'L2', lock_discovery: 'L1', lock_introductions: 'L0',
    lock_reminders: 'L2', lock_account: 'L2', lock_security: 'L2',
  };
  const body = {
    proactive: 'REDUCE', shared: { alerts: false }, public: { interactions: true, discovery: true }, introductions: { alerts: true },
    account: { updates: false }, quietHours: { enabled: true, start: '22:30', end: '07:00' },
    lockScreen: { QANDEEL: 'L1', SHARED: 'L3', PUBLIC: 'L2', DISCOVERY: 'L1', INTRODUCTIONS: 'L0', REMINDERS: 'L2', ACCOUNT: 'L2', SECURITY: 'L2' },
  };

  it('no row reads as the frozen defaults; Introductions controls are not available before the capability is entered', async () => {
    const view = await new ActivityService(repository()).readPreferences(USER, TOKEN);
    expect(view).toEqual({
      proactive: 'ALLOW', shared: { alerts: true }, public: { interactions: true, discovery: false },
      introductions: { available: false, alerts: true }, account: { updates: true },
      quietHours: { enabled: true, start: '23:00', end: '08:00' }, snoozeUntil: null,
      lockScreen: { QANDEEL: 'L1', SHARED: 'L2', PUBLIC: 'L2', DISCOVERY: 'L1', INTRODUCTIONS: 'L0', REMINDERS: 'L2', ACCOUNT: 'L2', SECURITY: 'L2' },
    });
  });

  it('saves the whole row and answers what the database now holds', async () => {
    const repo = repository({ preferences: jest.fn().mockResolvedValue([stored]) });
    const view = await new ActivityService(repo).savePreferences(USER, TOKEN, body);
    expect(repo.savePreferences).toHaveBeenCalledWith(TOKEN, expect.objectContaining({ proactive: 'REDUCE', quiet_hours_start: 1350, quiet_hours_end: 420, lock_shared: 'L3' }));
    expect(view.quietHours).toEqual({ enabled: true, start: '22:30', end: '07:00' });
  });

  it('refuses anything outside the frozen vocabulary, a zero-length Quiet Hours window, or an extra key', async () => {
    const service = new ActivityService(repository());
    for (const bad of [{ ...body, proactive: 'SOMETIMES' }, { ...body, quietHours: { enabled: true, start: '07:00', end: '07:00' } },
      { ...body, quietHours: { enabled: true, start: '24:00', end: '07:00' } }, { ...body, lockScreen: { ...body.lockScreen, SECURITY: 'L4' } },
      { ...body, critical: false }, { ...body, account: { updates: false, security: false } }]) {
      await expect(service.savePreferences(USER, TOKEN, bad)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('Snooze: 1 minute to 7 days from the server clock, or null to end it', async () => {
    const repo = repository();
    const service = new ActivityService(repo);
    await service.setSnooze(USER, TOKEN, { minutes: 60 });
    const until = Date.parse((repo.setSnooze as jest.Mock).mock.calls[0][1]);
    expect(Math.abs(until - (Date.now() + 3_600_000))).toBeLessThan(5_000);
    await service.setSnooze(USER, TOKEN, { minutes: null });
    expect((repo.setSnooze as jest.Mock).mock.calls[1][1]).toBeNull();
    for (const bad of [{ minutes: 0 }, { minutes: 10_081 }, { minutes: 1.5 }, { until: iso() }]) {
      await expect(service.setSnooze(USER, TOKEN, bad)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('a mute names only a Shared context the caller\'s own Activity holds', async () => {
    const repo = repository({ setMute: jest.fn().mockResolvedValue([{ outcome: 'UNKNOWN_CONTEXT' }]) });
    await expect(new ActivityService(repo).setMute(TOKEN, { contextRef: 'w', muted: true })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('A3-01 ActivityPublisher — the one server-side candidate boundary', () => {
  const candidate = (o: Partial<ActivityCandidate> = {}): ActivityCandidate => ({
    recipientUserId: USER, candidateKey: 'shared:msg:1', sourceRef: 'shared-message:1', kind: 'SHARED_ACTIVITY', interruptionClass: 3,
    contextRef: 'world-1', entry: { destination: 'SHARED_WORLD', ref: 'world-1' }, speaker: 'PRODUCT', body: { ar: 'ردّ', en: 'reply' },
    disclosureMax: 'L2', occurredAt: iso(), ...o,
  });

  it('accepts a candidate inside its own authority scope', () => expect(() => validateCandidate(candidate())).not.toThrow());

  it('refuses every authority, voice or exception mismatch the frozen contracts forbid', () => {
    const bad: Partial<ActivityCandidate>[] = [
      { entry: { destination: 'PERSONAL_CONVERSATION' } },                          // D43: no cross-World Direct Entry
      { speaker: 'QANDEEL' },                                                        // D18: QANDEEL voice only for QANDEEL
      { critical: true },                                                            // only SECURITY may be critical
      { requested: true },                                                           // only REMINDER may be requested
      { interruptionClass: 1 },                                                      // Class 1 is critical security only
      { contextRef: null },                                                          // a Shared item names its World
      { body: {} },                                                                  // one sentence, at least
      { disclosureMax: 'L4' as never },
      { expiresAt: iso(-1_000) },
      { kind: 'SCORE' as never },
    ];
    for (const o of bad) expect(() => validateCandidate(candidate(o))).toThrow(ActivityCandidateInvalidError);
  });

  it('publishes through the server channel only and answers the database outcome; a replay is DUPLICATE', async () => {
    const repo = repository({ publish: jest.fn().mockResolvedValue([{ outcome: 'DUPLICATE', item_id: ITEM }]) });
    await expect(new ActivityPublisher(repo).publish(candidate())).resolves.toEqual({ outcome: 'DUPLICATE', itemId: ITEM });
    expect(repo.publish).toHaveBeenCalledWith(expect.objectContaining({
      p_user_id: USER, p_category: 'SHARED', p_context_kind: 'SHARED_WORLD', p_candidate_key: 'shared:msg:1', p_critical: false,
    }));
  });

  it('withdrawal names one recipient and one source', async () => {
    const repo = repository({ withdraw: jest.fn().mockResolvedValue([{ withdrawn_items: 1 }]) });
    await expect(new ActivityPublisher(repo).withdraw(USER, 'shared-message:1')).resolves.toBe(1);
    await expect(new ActivityPublisher(repo).withdraw('x', 'y')).rejects.toBeInstanceOf(ActivityCandidateInvalidError);
  });
});
