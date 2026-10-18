import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { interruptionVerdict, markOf, silenceOf } from '../activity/activity-decision';
import { ActivityPublisher, validateCandidate, type ActivityCandidate } from '../activity/activity-publisher.service';
import type { ActivityRepository } from '../activity/activity.repository';
import { ActivityService } from '../activity/activity.service';
import { DEFAULT_PREFERENCES, type ActivityItemRow } from '../activity/activity.types';
import { DataApiError } from '../conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { IntroductionsEnrollmentRepository } from '../introductions-enrollment/introductions-enrollment.repository';
import { IntroductionsEnrollmentService } from '../introductions-enrollment/introductions-enrollment.service';
import type { IntroductionsForwardDispatchRepository, UnpublishedDelivery } from '../introductions-dispatch/introductions-forward-dispatch.repository';
import { IntroductionsForwardDispatcherWorker } from '../introductions-dispatch/introductions-forward-dispatcher.worker';
import { IntroductionWorldAlertsService, type IntroductionWorldAlertsRepository } from '../introductions-world/introduction-world-alerts.controller';
import { decideDispatch } from '../push/push-dispatch-decision';
import { LOCK_SCREEN_COPY } from '../push/push-projection';
import type { ClaimedAttempt } from '../push/push.types';
import { INTRODUCTIONS_ACTIVITY_COPY, INTRODUCTIONS_ACTIVITY_COPY_GATE } from './introductions-activity-copy';
import { IntroductionsActivityProducer } from './introductions-activity.producer';
import { IntroductionsActivityRepository, IntroductionsActivitySourceError, type PendingIntroductionsEvent } from './introductions-activity.repository';

const U = '11111111-1111-4111-8111-111111111111';
const V = '22222222-2222-4222-8222-222222222222';
const W = '33333333-3333-4333-8333-333333333333';
const W2 = '44444444-4444-4444-8444-444444444444';
const P = '55555555-5555-4555-8555-555555555555';
const T = '66666666-6666-4666-8666-666666666666';
const M = '77777777-7777-4777-8777-777777777777';
const TOKEN = 'token';
const NOW = Date.parse('2026-10-18T12:00:00.000Z');
const iso = (offset: number) => new Date(NOW + offset).toISOString();

const delivery = (o: Partial<UnpublishedDelivery> = {}): UnpublishedDelivery => ({
  deliveryTransitionId: T, proposalId: P, recipientUserId: U, candidateKey: `introductions:proposal-delivered:${T}`, deliveredAt: iso(-60_000), ...o,
});
const event = (o: Partial<PendingIntroductionsEvent> = {}): PendingIntroductionsEvent => ({
  event: 'WORLD_BORN', recipientUserId: U, worldId: W, sourceId: W, candidateKey: `introductions:world-born:${W}`, occurredAt: iso(-60_000), ...o,
});
function producer(sources: Partial<Record<'delivery' | 'pending', jest.Mock>> = {}) {
  const published: ActivityCandidate[] = [];
  const publish = jest.fn(async (candidate: ActivityCandidate) => { validateCandidate(candidate); published.push(candidate); return { outcome: 'PUBLISHED' as const, itemId: P }; });
  const repository = { delivery: jest.fn().mockResolvedValue({ recipientUserId: U, proposalId: P, deliveredAt: iso(-60_000), expiresAt: iso(86_400_000) }),
    pending: jest.fn().mockResolvedValue([]), ...sources } as unknown as IntroductionsActivityRepository;
  return { published, publish, repository, producer: new IntroductionsActivityProducer(repository, { publish } as unknown as ActivityPublisher) };
}
function row(o: Partial<ActivityItemRow> = {}): ActivityItemRow {
  return {
    id: '88888888-8888-4888-8888-888888888888', category: 'INTRODUCTIONS', kind: 'INTRODUCTION', interruption_class: 3, critical: false, requested: false,
    context_kind: 'INTRODUCTIONS', context_ref: W, context_label_ar: null, context_label_en: null, entry_destination: 'INTRODUCTIONS',
    entry_ref: `world:${W}`, speaker: 'PRODUCT', body_ar: INTRODUCTIONS_ACTIVITY_COPY.update.ar, body_en: INTRODUCTIONS_ACTIVITY_COPY.update.en,
    secondary_ar: null, secondary_en: null, actionable: false, disclosure_max: 'L0', member_count: 1, occurred_at: iso(-60_000),
    last_occurred_at: iso(-60_000), expires_at: null, withdrawn_at: null, attention: 'NEW', presented_in_app_at: null, interruption_settled_at: null, ...o,
  };
}

describe('S6-07 CP3 — the Introductions Activity producer (one boundary, durable sources, no content)', () => {
  it('a delivered proposal: its recipient, Class 3, L0, the proposal entry until its own deadline, under the database key', async () => {
    const { producer: p, published, repository } = producer();
    await p.publishDelivered(delivery());
    expect(repository.delivery).toHaveBeenCalledWith(T);
    expect(published).toEqual([{
      recipientUserId: U, candidateKey: `introductions:proposal-delivered:${T}`, sourceRef: `introductions:proposal:${P}`, kind: 'INTRODUCTION',
      interruptionClass: 3, contextRef: null, contextLabel: null, entry: { destination: 'INTRODUCTIONS', ref: `proposal:${P}` }, speaker: 'PRODUCT',
      body: INTRODUCTIONS_ACTIVITY_COPY.update, secondary: null, disclosureMax: 'L0', occurredAt: iso(-60_000), expiresAt: iso(86_400_000),
    }]);
  });

  it('a delivery the source no longer answers for exactly that recipient publishes nothing', async () => {
    for (const answer of [null, { recipientUserId: V, proposalId: P, deliveredAt: iso(0), expiresAt: iso(1) }, { recipientUserId: U, proposalId: W, deliveredAt: iso(0), expiresAt: iso(1) }]) {
      const { producer: p, publish } = producer({ delivery: jest.fn().mockResolvedValue(answer) });
      await p.publishDelivered(delivery());
      expect(publish).not.toHaveBeenCalled();
    }
  });

  it('every other event: its World as context and entry; a message is Class 4 (Q10), everything else Class 3; the key is the event\'s own', async () => {
    const events = [
      event(), event({ event: 'HUMAN_TEXT', sourceId: M, candidateKey: `introductions:human-text:${M}` }),
      event({ event: 'DISCLOSURE', sourceId: M, candidateKey: `introductions:disclosure:${M}` }),
      event({ event: 'ENDED', candidateKey: `introductions:ended:${W}` }),
      event({ event: 'SUCCESS_REQUESTED', sourceId: M, candidateKey: `introductions:success-requested:${M}:${U}` }),
    ];
    const { producer: p, published } = producer({ pending: jest.fn().mockResolvedValue(events) });
    await expect(p.publishPendingEvents(50)).resolves.toEqual({ published: 5, failed: 0 });
    expect(published.map((c) => [c.candidateKey, c.interruptionClass])).toEqual(events.map((e) => [e.candidateKey, e.event === 'HUMAN_TEXT' ? 4 : 3]));
    for (const c of published) {
      expect(c).toMatchObject({ recipientUserId: U, contextRef: W, entry: { destination: 'INTRODUCTIONS', ref: `world:${W}` }, disclosureMax: 'L0', sourceRef: c.candidateKey });
    }
  });

  it('no item carries a name, a message, a shared detail, a reason or a label: one approved generic sentence, reused', async () => {
    expect(INTRODUCTIONS_ACTIVITY_COPY.update).toBe(LOCK_SCREEN_COPY.generic.INTRODUCTIONS);
    expect(INTRODUCTIONS_ACTIVITY_COPY_GATE).toMatchObject({ reused: ['update'], approved: [], proposed: [] });
    const { producer: p, published } = producer({ pending: jest.fn().mockResolvedValue([event({ event: 'HUMAN_TEXT', sourceId: M, candidateKey: `introductions:human-text:${M}` })]) });
    await p.publishDelivered(delivery());
    await p.publishPendingEvents(50);
    for (const c of published) expect([c.body, c.secondary, c.contextLabel]).toEqual([LOCK_SCREEN_COPY.generic.INTRODUCTIONS, null, null]);
  });

  it('a failed publication is counted and the event stays for the next pass', async () => {
    const { producer: p, publish } = producer({ pending: jest.fn().mockResolvedValue([event(), event({ recipientUserId: V })]) });
    publish.mockRejectedValueOnce(new Error('down'));
    await expect(p.publishPendingEvents(50)).resolves.toEqual({ published: 1, failed: 1 });
  });

  it('runs inside the forward dispatcher\'s pass: deliveries then events, exactly once each after a crash, never in a forward transaction', async () => {
    const told = new Set<string>();
    const { producer: p, publish } = producer({ pending: jest.fn(async () => [event()].filter((e) => !told.has(e.candidateKey))) });
    publish.mockImplementation(async (c: ActivityCandidate) => { if (c.candidateKey.includes('world-born') && !told.has('crashed')) { told.add('crashed'); throw new Error('worker died'); } told.add(c.candidateKey); return { outcome: 'PUBLISHED', itemId: P }; });
    const forward = { forwardOne: jest.fn().mockResolvedValue('NONE_DUE'), listUnpublishedDeliveries: jest.fn(async () => [delivery()].filter((d) => !told.has(d.candidateKey))) };
    const worker = new IntroductionsForwardDispatcherWorker(forward as unknown as IntroductionsForwardDispatchRepository, undefined, p);
    expect(await worker.runOnce()).toMatchObject({ published: 1, publishFailed: 1 });
    expect(await worker.runOnce()).toMatchObject({ published: 1, publishFailed: 0 });
    expect(await worker.runOnce()).toMatchObject({ published: 0, publishFailed: 0 });
    expect([...told].filter((k) => k !== 'crashed').sort()).toEqual([`introductions:proposal-delivered:${T}`, `introductions:world-born:${W}`]);
  });
});

describe('S6-07 CP3 — IntroductionsActivityRepository: the server channel, strictly decoded', () => {
  const api = (answer: unknown) => { const rpc = jest.fn().mockResolvedValue(answer); return { rpc, repository: new IntroductionsActivityRepository({ rpc } as unknown as SupabaseServiceRoleApiService) }; };
  const listed = { event: 'ENDED', recipient_user_id: U, world_id: W, source_id: W, candidate_key: `introductions:ended:${W}`, occurred_at: iso(0) };

  it('lists through the 0167 lister and re-reads one delivery through its source read', async () => {
    const { rpc, repository } = api([listed]);
    await expect(repository.pending(50)).resolves.toEqual([{ event: 'ENDED', recipientUserId: U, worldId: W, sourceId: W, candidateKey: `introductions:ended:${W}`, occurredAt: iso(0) }]);
    expect(rpc).toHaveBeenCalledWith('server_list_introductions_activity_v1', { p_limit: 50 });
    const one = api([{ recipient_user_id: U, proposal_id: P, delivered_at: iso(0), expires_at: iso(1) }]);
    await expect(one.repository.delivery(T)).resolves.toEqual({ recipientUserId: U, proposalId: P, deliveredAt: iso(0), expiresAt: iso(1) });
    expect(one.rpc).toHaveBeenCalledWith('server_read_introductions_proposal_delivery_v1', { p_delivery_transition_id: T });
    await expect(api([]).repository.delivery(T)).resolves.toBeNull();
  });

  it('refuses any answer no migration produces (an unknown event, a key that is not the event\'s own, a bad identity)', async () => {
    for (const bad of [{ ...listed, event: 'DECLINED' }, { ...listed, candidate_key: `introductions:ended:${W2}` }, { ...listed, world_id: 'x' }, { ...listed, occurred_at: 'soon' }]) {
      await expect(api([bad]).repository.pending(50)).rejects.toBeInstanceOf(IntroductionsActivitySourceError);
    }
    await expect(api([listed, listed]).repository.pending(1)).rejects.toBeInstanceOf(IntroductionsActivitySourceError);
    await expect(api([{}, {}]).repository.delivery(T)).rejects.toBeInstanceOf(IntroductionsActivitySourceError);
  });

  it('the module has no controller and no client token; the producer reaches Activity only through the publisher', () => {
    const dir = __dirname;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))) {
      const code = readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, '');
      expect([file, /@Controller|@(Get|Post|Put|Patch|Delete)\(|SupabaseDataApiService|accessToken|console\.|Logger|activity\/activity\.repository|server_publish/u.test(code)]).toEqual([file, false]);
      expect([file, /from '\.\.\/(memory|hypothesis|human-model|model-router|shared-world|public-world|connected-worlds)\b/u.test(code)]).toEqual([file, false]);
    }
  });
});

describe('S6-07 CP3 — the capability truth and the per-Introduction mute in the attention decision', () => {
  const prefs = DEFAULT_PREFERENCES;
  it('never entered: silenced, no mark, no interruption; entered: eligible like any Class 3 item', () => {
    expect(silenceOf(row(), prefs, new Set())).toBe('INTRODUCTIONS_NOT_ENTERED');
    expect(markOf(row(), prefs, new Set(), NOW)).toBe(false);
    expect(silenceOf(row(), prefs, new Set(), true)).toBeNull();
    expect(markOf(row(), prefs, new Set(), NOW, true)).toBe(true);
    const input = { prefs: { ...prefs, quietHours: { enabled: false, start: 0, end: 1 } }, mutes: new Set<string>(), now: NOW, timeZone: 'Africa/Cairo' };
    expect(interruptionVerdict(row(), input)).toBe('INTRODUCTIONS_NOT_ENTERED');
    expect(interruptionVerdict(row(), { ...input, introductionsEntered: true })).toBe('ELIGIBLE');
  });

  it('one Introduction muted silences that World only; the category control and the Shared mute stay theirs', () => {
    const mutes = new Set([W]);
    expect(silenceOf(row(), prefs, mutes, true)).toBe('MUTED_CONTEXT');
    expect(silenceOf(row({ context_ref: W2, entry_ref: `world:${W2}` }), prefs, mutes, true)).toBeNull();
    expect(silenceOf(row({ context_ref: null, entry_ref: `proposal:${P}` }), prefs, mutes, true)).toBeNull();
    expect(silenceOf(row(), { ...prefs, introductionsAlerts: false }, new Set(), true)).toBe('CATEGORY_OFF');
  });

  it('a message (Class 4) is ambient: in Activity, no mark, never an interruption', () => {
    const text = row({ interruption_class: 4 });
    expect(markOf(text, prefs, new Set(), NOW, true)).toBe(false);
    expect(interruptionVerdict(text, { prefs, mutes: new Set(), now: NOW, timeZone: 'Africa/Cairo', introductionsEntered: true })).toBe('AMBIENT');
  });
});

describe('S6-07 CP3 — Native Push for Introductions: revalidated, L0, never a message', () => {
  const claim = (o: Partial<ClaimedAttempt> = {}, item: Partial<ActivityItemRow> = {}): ClaimedAttempt => ({
    attemptId: 'a-1', userId: U, attemptCount: 0, reevaluation: false,
    device: { id: 'd-1', platform: 'ANDROID', transport: 'FCM', apnsEnvironment: null, token: 't', status: 'ACTIVE', osPermission: 'GRANTED', timeZone: 'Africa/Cairo', locale: 'ar' },
    item: { ...row(item), created_at: iso(-60_000) } as ClaimedAttempt['item'], preferences: { proactive: 'ALLOW', shared_alerts: true, public_interactions: true,
      public_discovery: false, introductions_alerts: true, account_updates: true, quiet_hours_enabled: false, quiet_hours_start: 1380, quiet_hours_end: 480,
      snooze_until: null, lock_qandeel: 'L1', lock_shared: 'L2', lock_public: 'L2', lock_discovery: 'L1', lock_introductions: 'L2', lock_reminders: 'L2',
      lock_account: 'L2', lock_security: 'L2' }, muted: false, evidence: [], now: iso(0), ...o,
  });

  it('entered: «إشعار جديد» on the neutral channel, nothing else — even with the reader\'s ceiling raised to L2', () => {
    const decision = decideDispatch(claim({ introductionsEntered: true }), NOW);
    expect(decision).toMatchObject({ kind: 'SEND', level: 'L0', message: { title: null, body: 'إشعار جديد', androidChannel: 'qandeel' } });
    expect(JSON.stringify(decision)).not.toContain(LOCK_SCREEN_COPY.generic.INTRODUCTIONS.ar);
  });

  it('not entered (or a failed capability read), muted, alerts off or a message: suppressed, never sent', () => {
    expect(decideDispatch(claim(), NOW)).toEqual({ kind: 'SUPPRESS', reason: 'introductions_not_entered' });
    expect(decideDispatch(claim({ introductionsEntered: true, muted: true }), NOW)).toEqual({ kind: 'SUPPRESS', reason: 'muted_context' });
    expect(decideDispatch(claim({ introductionsEntered: true, preferences: { ...claim().preferences, introductions_alerts: false } }), NOW)).toEqual({ kind: 'SUPPRESS', reason: 'category_off' });
    expect(decideDispatch(claim({ introductionsEntered: true }, { interruption_class: 4 }), NOW)).toEqual({ kind: 'SUPPRESS', reason: 'ambient' });
  });

  it('Quiet Hours and Snooze defer an Introductions notification like any other', () => {
    const quiet = claim({ introductionsEntered: true, preferences: { ...claim().preferences, quiet_hours_enabled: true, quiet_hours_start: 0, quiet_hours_end: 1439 } });
    expect(decideDispatch(quiet, NOW)).toMatchObject({ kind: 'DEFER', reason: 'quiet_hours' });
    const snoozed = claim({ introductionsEntered: true, preferences: { ...claim().preferences, snooze_until: iso(3_600_000) } });
    expect(decideDispatch(snoozed, NOW)).toMatchObject({ kind: 'DEFER', reason: 'snoozed' });
  });
});

describe('S6-07 CP3 — Direct Entry into Introductions, revalidated at open on the caller\'s token', () => {
  const opened = (ref: string, contextRef: string | null) => [{ outcome: 'OPENED', category: 'INTRODUCTIONS', context_kind: 'INTRODUCTIONS', context_ref: contextRef, entry_destination: 'INTRODUCTIONS', entry_ref: ref }];
  const service = (o: Record<string, jest.Mock>) => {
    const repository = { open: jest.fn(), ownIntroductionWorlds: jest.fn().mockResolvedValue([]), ownProposal: jest.fn().mockResolvedValue([]), ...o };
    return { repository, service: new ActivityService(repository as unknown as ActivityRepository) };
  };

  it('world: the exact World while it is still one of the caller\'s own Introductions — never another', async () => {
    const { repository, service: s } = service({ open: jest.fn().mockResolvedValue(opened(`world:${W}`, W)), ownIntroductionWorlds: jest.fn().mockResolvedValue([{ world_id: W2 }, { world_id: W }]) });
    await expect(s.open(TOKEN, P)).resolves.toEqual({ outcome: 'ENTER', destination: { kind: 'INTRODUCTIONS', target: { kind: 'WORLD', worldId: W } } });
    expect(repository.ownIntroductionWorlds).toHaveBeenCalledWith(TOKEN);
    repository.ownIntroductionWorlds.mockResolvedValue([{ world_id: W2 }]);
    await expect(s.open(TOKEN, P)).resolves.toEqual({ outcome: 'UNAVAILABLE', fallback: null });
  });

  it('proposal: only while the S6-04 reader still answers exactly that proposal; expired, withdrawn or never theirs is UNAVAILABLE', async () => {
    const { repository, service: s } = service({ open: jest.fn().mockResolvedValue(opened(`proposal:${P}`, null)), ownProposal: jest.fn().mockResolvedValue([{ matching_proposal_id: P }]) });
    await expect(s.open(TOKEN, P)).resolves.toEqual({ outcome: 'ENTER', destination: { kind: 'INTRODUCTIONS', target: { kind: 'PROPOSAL', proposalId: P } } });
    expect(repository.ownProposal).toHaveBeenCalledWith(TOKEN, P);
    for (const answer of [[], [{ matching_proposal_id: W }], null]) {
      repository.ownProposal.mockResolvedValue(answer);
      await expect(s.open(TOKEN, P)).resolves.toEqual({ outcome: 'UNAVAILABLE', fallback: null });
    }
  });

  it('a malformed or out-of-context reference is refused, never interpreted', async () => {
    for (const rows of [opened('world:x', 'x'), opened(`world:${W}`, W2), opened(`proposal:${P}`, W), opened(`relations:${P}`, null),
      [{ ...opened(`world:${W}`, W)[0], context_kind: 'SHARED_WORLD' }]]) {
      const { service: s } = service({ open: jest.fn().mockResolvedValue(rows) });
      await expect(s.open(TOKEN, P)).rejects.toBeInstanceOf(ServiceUnavailableException);
    }
  });

  it('the Introductions controls are available exactly when the caller has entered (their own truth, on their own token)', async () => {
    for (const entered of [true, false]) {
      const repository = { preferences: jest.fn().mockResolvedValue([]), introductionsEntered: jest.fn().mockResolvedValue(entered) };
      const view = await new ActivityService(repository as unknown as ActivityRepository).readPreferences(U, TOKEN);
      expect(view.introductions).toEqual({ available: entered, alerts: true });
      expect(repository.introductionsEntered).toHaveBeenCalledWith(TOKEN);
    }
    const malformed = { preferences: jest.fn().mockResolvedValue([]), introductionsEntered: jest.fn().mockResolvedValue([{ entered: true }]) };
    await expect(new ActivityService(malformed as unknown as ActivityRepository).readPreferences(U, TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('S6-07 CP3 — the per-Introduction alerts service', () => {
  const alerts = (o: Partial<Record<'list' | 'set', jest.Mock>>) => new IntroductionWorldAlertsService({ list: jest.fn(), set: jest.fn(), ...o } as unknown as IntroductionWorldAlertsRepository);

  it('lists exactly what the database lists, strictly decoded', async () => {
    const list = jest.fn().mockResolvedValue([{ world_id: W, introduction_state: 'ACTIVE', other_first_name: 'Mona', muted: true }, { world_id: W2, introduction_state: 'ENDED', other_first_name: null, muted: false }]);
    await expect(alerts({ list }).list(TOKEN)).resolves.toEqual({ worlds: [{ worldId: W, state: 'ACTIVE', otherFirstName: 'Mona', muted: true }, { worldId: W2, state: 'ENDED', otherFirstName: null, muted: false }] });
    for (const bad of [[{ world_id: W, introduction_state: 'MATCHED', other_first_name: null, muted: false }], [{ world_id: W, introduction_state: 'ACTIVE', other_first_name: null, muted: 'no' }], null]) {
      await expect(alerts({ list: jest.fn().mockResolvedValue(bad) }).list(TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
    }
  });

  it('sets ONE World on the caller\'s token: the database\'s word, UNAVAILABLE for anything not theirs, 400 for a bad body', async () => {
    const set = jest.fn().mockResolvedValue([{ outcome: 'MUTED' }]);
    await expect(alerts({ set }).set(TOKEN, W, { muted: true })).resolves.toEqual({ outcome: 'MUTED' });
    expect(set).toHaveBeenCalledWith(TOKEN, W, true);
    await expect(alerts({ set: jest.fn().mockResolvedValue([{ outcome: 'UNAVAILABLE' }]) }).set(TOKEN, W, { muted: false })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
    await expect(alerts({ set }).set(TOKEN, 'not-a-world', { muted: true })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
    for (const body of [{}, { muted: 'yes' }, { muted: true, world: W }, null]) await expect(alerts({ set }).set(TOKEN, W, body)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('S6-07 CP3 — withdrawing ONE consent, through its own retained frozen command', () => {
  const view = { available: false, accountDeletionPending: false, consents: { participation: null, contextGrant: null, disclosureAuthority: null },
    setup: { participationState: 'OFF', pauseReason: null, contextGrant: false, disclosureAuthority: false, matchable: false }, enrollment: null };
  const setupRow = { participation_state: 'ACTIVE', pause_reason: null, participation_event_id: M, matching_context_grant_id: W, introduction_profile_version_id: W2,
    matching_requirement_version_id: W2, pre_match_disclosure_authority_id: P, bound_profile_version_id: W2, approved_field_count: 0 };
  const harness = (setup: unknown = [setupRow]) => {
    const request = jest.fn(async (_token: string, path: string) => (path === 'rpc/get_my_matching_setup_v1' ? setup : path === 'rpc/read_my_matching_enrollment_v1' ? view : [{ ok: true }]));
    const repository = new IntroductionsEnrollmentRepository({ request } as never);
    return { request, service: new IntroductionsEnrollmentService(repository) };
  };
  const C = 'abababab-abab-4bab-8bab-abababababab';

  it.each([
    ['participation', 'rpc/turn_off_matching_participation_v1', { p_command_id: C, p_expected_current_event_id: M }],
    ['contextGrant', 'rpc/revoke_matching_context_v1', { p_command_id: C, p_expected_active_grant_id: W }],
    ['disclosureAuthority', 'rpc/revoke_pre_match_disclosure_authority_v1', { p_command_id: C, p_expected_active_authority_id: P }],
  ])('%s: exactly its own command, on the identity the caller\'s own setup read names, and no other consent', async (consent, path, body) => {
    const { request, service } = harness();
    await expect(service.revoke(TOKEN, { commandId: C, consent })).resolves.toMatchObject({ outcome: 'REVOKED' });
    const writes = request.mock.calls.filter(([, p]) => p !== 'rpc/get_my_matching_setup_v1' && p !== 'rpc/read_my_matching_enrollment_v1');
    expect(writes).toEqual([[TOKEN, path, { method: 'POST', body: JSON.stringify(body) }]]);
  });

  it('nothing to withdraw is NOT_ACTIVE, without any write', async () => {
    const { request, service } = harness([{ ...setupRow, participation_state: 'OFF', matching_context_grant_id: null, pre_match_disclosure_authority_id: null }]);
    for (const consent of ['participation', 'contextGrant', 'disclosureAuthority']) {
      await expect(service.revoke(TOKEN, { commandId: C, consent })).resolves.toMatchObject({ outcome: 'NOT_ACTIVE' });
    }
    expect(request.mock.calls.every(([, p]) => p === 'rpc/get_my_matching_setup_v1' || p === 'rpc/read_my_matching_enrollment_v1')).toBe(true);
  });

  it('the frozen command\'s refusals: a stale identity is CHANGED, a reused command id COMMAND_CONFLICT, already withdrawn NOT_ACTIVE', async () => {
    for (const [error, outcome] of [[new DataApiError(409, { databaseCode: 'PT409' }), 'CHANGED'], [new DataApiError(409, { databaseCode: '23505' }), 'COMMAND_CONFLICT'],
      [new DataApiError(400, { databaseCode: '55000' }), 'NOT_ACTIVE']] as const) {
      const { request, service } = harness();
      request.mockImplementation(async (_t: string, path: string) => {
        if (path === 'rpc/get_my_matching_setup_v1') return [setupRow];
        if (path === 'rpc/read_my_matching_enrollment_v1') return view;
        throw error;
      });
      await expect(service.revoke(TOKEN, { commandId: C, consent: 'participation' })).resolves.toMatchObject({ outcome });
    }
  });

  it('a malformed request is a 400; an unknown failure one sanitized 503', async () => {
    const { service } = harness();
    for (const body of [{}, { commandId: C }, { commandId: 'x', consent: 'participation' }, { commandId: C, consent: 'everything' }, { commandId: C, consent: 'participation', extra: 1 }]) {
      await expect(service.revoke(TOKEN, body)).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(harness([]).service.revoke(TOKEN, { commandId: C, consent: 'participation' })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
