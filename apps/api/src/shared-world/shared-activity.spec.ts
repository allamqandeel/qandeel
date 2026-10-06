import 'reflect-metadata';
import { BadRequestException, RequestMethod, ServiceUnavailableException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { interruptionVerdict, platformVerdict, silenceOf } from '../activity/activity-decision';
import { validateCandidate, type ActivityCandidate, type ActivityPublisher } from '../activity/activity-publisher.service';
import type { ActivityRepository } from '../activity/activity.repository';
import { ActivityService } from '../activity/activity.service';
import { CATEGORY_CONTEXT, DEFAULT_PREFERENCES, KIND_CATEGORY, type ActivityItemRow } from '../activity/activity.types';
import { LOCK_SCREEN_COPY } from '../push/push-projection';
import { SHARED_ACTIVITY_COPY } from './shared-activity-copy';
import { SharedActivityProducer } from './shared-activity.producer';
import type { SharedActivityRepository, SharedActivitySourceKind, SharedActivitySourceRow } from './shared-activity.repository';
import { SharedWorldAlertsService } from './shared-world-alerts.service';
import type { SharedWorldAlertsRepository } from './shared-world-alerts.repository';
import type { SharedWorldLifecycleRepository } from './shared-world-lifecycle.repository';
import type { SharedWorldRepository } from './shared-world.repository';
import { SharedWorldController } from './shared-world.controller';

const READER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const WORLD_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WORLD_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SOURCE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ITEM = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const AT = '2026-10-06T10:00:00.000Z';
const TOKEN = 'caller-token';

const sourceRow = (overrides: Partial<SharedActivitySourceRow> = {}): SharedActivitySourceRow => ({
  recipient_user_id: READER, world_id: WORLD_A, world_name: null, actor_name: 'Sara', subject_name: null, operation_kind: null,
  occurred_at: AT, ...overrides,
});

/** A durable truth stand-in: the 0141 server pass's answer per (kind, id). Recipients are its choice, never the caller's. */
function harness(answers: Partial<Record<SharedActivitySourceKind, SharedActivitySourceRow[]>> = {}) {
  const sources = { source: jest.fn(async (kind: SharedActivitySourceKind) => answers[kind] ?? []) } as unknown as jest.Mocked<SharedActivityRepository>;
  const store = new Map<string, ActivityCandidate>();
  const publisher = {
    publish: jest.fn(async (candidate: ActivityCandidate) => {
      validateCandidate(candidate);
      // The 0136 identity (recipient, candidate key): a replay is DUPLICATE and changes nothing (D57).
      const key = `${candidate.recipientUserId} ${candidate.candidateKey}`;
      const outcome = store.has(key) ? 'DUPLICATE' : 'PUBLISHED';
      if (!store.has(key)) store.set(key, candidate);
      return { outcome, itemId: ITEM };
    }),
    withdraw: jest.fn().mockResolvedValue(1),
  } as unknown as jest.Mocked<ActivityPublisher>;
  return { producer: new SharedActivityProducer(sources, publisher), sources, publisher, store, items: () => [...store.values()] };
}

/** The projection row the recipient's Activity would hold for a candidate (what A3-01's decision layer reads). */
function itemOf(candidate: ActivityCandidate, overrides: Partial<ActivityItemRow> = {}): ActivityItemRow {
  const category = KIND_CATEGORY[candidate.kind];
  return {
    id: ITEM, category, kind: candidate.kind, interruption_class: candidate.interruptionClass, critical: false, requested: false,
    context_kind: CATEGORY_CONTEXT[category], context_ref: candidate.contextRef ?? null, context_label_ar: candidate.contextLabel?.ar ?? null,
    context_label_en: candidate.contextLabel?.en ?? null, entry_destination: candidate.entry.destination, entry_ref: candidate.entry.ref ?? null,
    speaker: candidate.speaker, body_ar: candidate.body.ar ?? null, body_en: candidate.body.en ?? null, secondary_ar: candidate.secondary?.ar ?? null,
    secondary_en: candidate.secondary?.en ?? null, actionable: candidate.actionable === true, disclosure_max: candidate.disclosureMax, member_count: 1,
    occurred_at: new Date().toISOString(), last_occurred_at: new Date().toISOString(), expires_at: null, withdrawn_at: null, attention: 'NEW',
    presented_in_app_at: null, interruption_settled_at: null, ...overrides,
  };
}
const NOON_UTC = Date.parse('2026-10-06T12:00:00.000Z');
const decide = (item: ActivityItemRow, mutes: ReadonlySet<string> = new Set()) =>
  interruptionVerdict(item, { prefs: DEFAULT_PREFERENCES, mutes, now: NOON_UTC, timeZone: 'UTC' });
const fresh = (candidate: ActivityCandidate) => itemOf(candidate, { occurred_at: new Date(NOON_UTC - 1000).toISOString(), last_occurred_at: new Date(NOON_UTC - 1000).toISOString() });

describe('S4-04 A — the Shared Activity producer publishes genuine Shared facts through ActivityPublisher', () => {
  it('a committed human message reaches exactly the recipients durable truth names, as a Shared, PRODUCT-spoken, exact-World row', async () => {
    const h = harness({ HUMAN_TEXT: [sourceRow({ recipient_user_id: READER, world_name: 'Trip' })] });
    await h.producer.humanText(SOURCE);
    expect(h.sources.source).toHaveBeenCalledWith('HUMAN_TEXT', SOURCE);
    expect(h.items()).toEqual([{
      recipientUserId: READER, candidateKey: `s4-04:human-text:${SOURCE}`, sourceRef: `shared:human-text:${SOURCE}`, kind: 'SHARED_ACTIVITY',
      interruptionClass: 4, contextRef: WORLD_A, contextLabel: { ar: 'Trip', en: 'Trip' }, entry: { destination: 'SHARED_WORLD', ref: WORLD_A },
      speaker: 'PRODUCT', body: LOCK_SCREEN_COPY.generic.SHARED, secondary: null, disclosureMax: 'L2', occurredAt: AT,
    }]);
    expect(h.items().map((c) => c.recipientUserId)).not.toContain(OTHER);
  });

  it('a retry of the same command is the same candidate: DUPLICATE, never a second row (D57)', async () => {
    const h = harness({ HUMAN_TEXT: [sourceRow()] });
    await h.producer.humanText(SOURCE);
    await h.producer.humanText(SOURCE);
    expect(h.publisher.publish).toHaveBeenCalledTimes(2);
    expect(await h.publisher.publish.mock.results[1].value).toEqual({ outcome: 'DUPLICATE', itemId: ITEM });
    expect(h.store.size).toBe(1);
  });

  it('no cross-World leakage: each row carries only its own World, as context AND destination', async () => {
    const h = harness({ PROPOSAL: [sourceRow({ recipient_user_id: READER, world_id: WORLD_A, operation_kind: 'END_WORLD' }), sourceRow({ recipient_user_id: OTHER, world_id: WORLD_B, operation_kind: 'END_WORLD' })] });
    await h.producer.proposal(SOURCE);
    for (const candidate of h.items()) {
      expect(candidate.entry.ref).toBe(candidate.contextRef);
      expect([WORLD_A, WORLD_B]).toContain(candidate.contextRef);
    }
    expect(h.items().find((c) => c.recipientUserId === READER)?.contextRef).toBe(WORLD_A);
    expect(h.items().find((c) => c.recipientUserId === OTHER)?.contextRef).toBe(WORLD_B);
  });

  it('ordinary activity never becomes an automatic Push: a message is Class 4 — ambient, no mark, no strip, no platform delivery', async () => {
    const h = harness({ HUMAN_TEXT: [sourceRow()], LEFT: [sourceRow()] });
    await h.producer.humanText(SOURCE);
    await h.producer.left(SOURCE);
    for (const candidate of h.items()) {
      expect(candidate.interruptionClass).toBe(4);
      const item = fresh(candidate);
      expect(decide(item)).toBe('AMBIENT');
      expect(platformVerdict(item, { prefs: DEFAULT_PREFERENCES, mutes: new Set(), now: NOON_UTC, timeZone: 'UTC', evidence: [], osPermission: 'GRANTED', foreground: false }))
        .toEqual({ deliver: false, reason: 'AMBIENT' });
    }
  });

  it('a governance proposal is Class 3 with the approved Manage World words, the proposer named, the removal target named only for a removal', async () => {
    const h = harness({ PROPOSAL: [sourceRow({ operation_kind: 'REMOVE_MEMBER', actor_name: 'Sara', subject_name: 'Omar' })] });
    await h.producer.proposal(SOURCE);
    const [candidate] = h.items();
    expect(candidate).toMatchObject({
      interruptionClass: 3, candidateKey: `s4-04:proposal:${SOURCE}`, body: { ar: 'إزالة Omar من هذا العالم', en: 'Remove Omar from this world' },
      secondary: { ar: 'اقتراح من Sara', en: 'Proposed by Sara' }, entry: { destination: 'SHARED_WORLD', ref: WORLD_A },
    });
    expect(decide(fresh(candidate))).toBe('ELIGIBLE');
    for (const [kind, words] of [['WORLD_SETTINGS_CHANGE', SHARED_ACTIVITY_COPY.proposalSettings], ['END_WORLD', SHARED_ACTIVITY_COPY.proposalEnd],
      ['ADD_MEMBER', SHARED_ACTIVITY_COPY.proposalAdd], ['REJOIN_MEMBER', SHARED_ACTIVITY_COPY.proposalRejoin]] as const) {
      const one = harness({ PROPOSAL: [sourceRow({ operation_kind: kind, subject_name: null })] });
      await one.producer.proposal(SOURCE);
      expect(one.items()[0].body).toEqual(words);
    }
  });

  it('an add / rejoin request reaches its target with the proposer\'s Name and NOTHING of the World — no label, no entry', async () => {
    const h = harness({ MEMBER_REQUEST: [sourceRow({ operation_kind: 'ADD_MEMBER', world_name: 'Hidden name', actor_name: null })] });
    await h.producer.memberRequest(SOURCE);
    const [candidate] = h.items();
    expect(candidate).toMatchObject({ contextLabel: null, entry: { destination: 'NONE' }, interruptionClass: 3 });
    expect(candidate.body).toEqual({ ar: 'شخص ما يقترح انضمامك إلى عالم مشترك، وقد وافق عليه كل أعضائه.', en: 'Someone proposed that you join a Shared World, and all its members approved.' });
    expect(JSON.stringify(candidate)).not.toContain('Hidden name');
  });

  it('a join tells the other members and withdraws the joiner\'s own request; a birth tells the inviter', async () => {
    const h = harness({ JOINED: [sourceRow({ actor_name: 'Lina' })], BIRTH: [sourceRow({ actor_name: 'Lina' })] });
    await h.producer.joined(SOURCE, ITEM, OTHER);
    expect(h.items()[0]).toMatchObject({ interruptionClass: 3, body: { ar: 'انضم Lina إلى هذا العالم.', en: 'Lina joined this world.' } });
    expect(h.publisher.withdraw).toHaveBeenCalledWith(OTHER, `shared:member-request:${ITEM}`);
    await h.producer.birth(WORLD_A);
    expect(h.sources.source).toHaveBeenLastCalledWith('BIRTH', WORLD_A);
  });

  it('nothing is published for a malformed identity, an empty answer, a malformed row; a failure is absorbed', async () => {
    const h = harness({ HUMAN_TEXT: [sourceRow({ recipient_user_id: 'nope' }), sourceRow({ occurred_at: 'never' })] });
    await h.producer.humanText('not-a-uuid');
    expect(h.sources.source).not.toHaveBeenCalled();
    await h.producer.humanText(SOURCE);
    await h.producer.left(SOURCE);
    expect(h.publisher.publish).not.toHaveBeenCalled();
    const failing = harness();
    failing.sources.source.mockRejectedValueOnce(new Error('down'));
    await expect(failing.producer.humanText(SOURCE)).resolves.toBeUndefined();
    const rejecting = harness({ HUMAN_TEXT: [sourceRow()] });
    rejecting.publisher.publish.mockRejectedValueOnce(new Error('down'));
    await expect(rejecting.producer.humanText(SOURCE)).resolves.toBeUndefined();
  });

  it('every sentence fits the A3-01 body bound, whatever the Name', async () => {
    const h = harness({ PROPOSAL: [sourceRow({ operation_kind: 'REMOVE_MEMBER', actor_name: 'س'.repeat(500), subject_name: 'x'.repeat(500) })] });
    await h.producer.proposal(SOURCE);
    expect(h.items()).toHaveLength(1);
  });
});

describe('S4-04 — the controller hands Activity only committed facts, and never changes the Shared answer', () => {
  const request = { headers: {}, authenticatedUser: { userId: READER, accessToken: TOKEN } } as never;
  const build = (overrides: Record<string, unknown>) => {
    const producer = { humanText: jest.fn(), proposal: jest.fn(), memberRequest: jest.fn(), joined: jest.fn(), birth: jest.fn(), left: jest.fn() };
    const controller = new SharedWorldController(overrides as never, overrides as never, overrides as never, producer as never, {} as never);
    return { controller, producer };
  };
  it('publishes after COMMITTED / PROPOSED / SUBMITTED / INVITED / JOINED / BORN / LEFT only', async () => {
    const { controller, producer } = build({
      send: jest.fn().mockResolvedValueOnce({ outcome: 'COMMITTED', materialId: SOURCE, qandeel: 'COMMITTED' }).mockResolvedValueOnce({ outcome: 'UNAVAILABLE' }),
      proposeEnd: jest.fn().mockResolvedValueOnce({ outcome: 'PROPOSED' }).mockResolvedValueOnce({ outcome: 'UNAVAILABLE' }),
      proposeMember: jest.fn().mockResolvedValueOnce({ outcome: 'SUBMITTED' }).mockResolvedValueOnce({ outcome: 'INVALID_SHARED_ID' }),
      approve: jest.fn().mockResolvedValueOnce({ outcome: 'INVITED' }).mockResolvedValueOnce({ outcome: 'APPROVED' }),
      acceptMembershipRequest: jest.fn().mockResolvedValueOnce({ outcome: 'JOINED' }),
      accept: jest.fn().mockResolvedValueOnce({ outcome: 'BORN', worldId: WORLD_A }),
      leave: jest.fn().mockResolvedValueOnce({ outcome: 'LEFT' }),
    });
    const body = { commandId: SOURCE };
    await expect(controller.send(request, WORLD_A, body)).resolves.toEqual({ outcome: 'COMMITTED', materialId: SOURCE, qandeel: 'COMMITTED' });
    await controller.send(request, WORLD_A, body);
    await controller.proposeEnd(request, WORLD_A, body);
    await controller.proposeEnd(request, WORLD_A, body);
    await controller.proposeMember(request, WORLD_A, body);
    await controller.proposeMember(request, WORLD_A, body);
    await controller.approve(request, WORLD_A, ITEM, body);
    await controller.approve(request, WORLD_A, ITEM, body);
    await controller.acceptMembershipRequest(request, WORLD_A, ITEM, body);
    await controller.accept(request, ITEM, body);
    await controller.leave(request, WORLD_A, body);
    expect(producer.humanText.mock.calls).toEqual([[SOURCE]]);
    expect(producer.proposal.mock.calls).toEqual([[SOURCE], [SOURCE]]);
    expect(producer.memberRequest.mock.calls).toEqual([[ITEM]]);
    expect(producer.joined.mock.calls).toEqual([[SOURCE, ITEM, READER]]);
    expect(producer.birth.mock.calls).toEqual([[WORLD_A]]);
    expect(producer.left.mock.calls).toEqual([[SOURCE]]);
  });

  it('serves the two alert routes', () => {
    const route = (name: string) => {
      const handler = (SharedWorldController.prototype as unknown as Record<string, object>)[name];
      return `${RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod]} ${Reflect.getMetadata(PATH_METADATA, handler) as string}`;
    };
    expect(route('alertWorlds')).toBe('GET alerts');
    expect(route('setAlerts')).toBe('PUT worlds/:worldId/alerts');
  });
});

describe('S4-04 B — Direct Entry: Activity opens the exact Shared World only on a CURRENT entry verdict', () => {
  const opened = [{ outcome: 'OPENED', category: 'SHARED', context_kind: 'SHARED_WORLD', context_ref: WORLD_A, entry_destination: 'SHARED_WORLD', entry_ref: WORLD_A }];
  const service = (verdict: unknown[]) => {
    const repo = { open: jest.fn().mockResolvedValue(opened), sharedEntry: jest.fn().mockResolvedValue(verdict) } as unknown as jest.Mocked<ActivityRepository>;
    return { repo, service: new ActivityService(repo) };
  };
  it('a current member enters exactly that World, revalidated now on the caller\'s token', async () => {
    const { repo, service: s } = service([{ outcome: 'ALLOW', world_id: WORLD_A }]);
    await expect(s.open(TOKEN, ITEM)).resolves.toEqual({ outcome: 'ENTER', destination: { kind: 'SHARED_WORLD', worldId: WORLD_A } });
    expect(repo.sharedEntry).toHaveBeenCalledWith(TOKEN, WORLD_A);
  });
  it('removed / left / ended / never theirs: fails closed with no fallback and no World', async () => {
    for (const verdict of [[{ outcome: 'UNAVAILABLE', world_id: null }], [{ outcome: 'ALLOW', world_id: WORLD_B }], []]) {
      await expect(service(verdict).service.open(TOKEN, ITEM)).resolves.toEqual({ outcome: 'UNAVAILABLE', fallback: null });
    }
  });
  it('an item whose destination is not its own context is refused (never a guessed World)', async () => {
    const repo = { open: jest.fn().mockResolvedValue([{ ...opened[0], entry_ref: WORLD_B }]), sharedEntry: jest.fn() } as unknown as jest.Mocked<ActivityRepository>;
    await expect(new ActivityService(repo).open(TOKEN, ITEM)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repo.sharedEntry).not.toHaveBeenCalled();
  });
  it('Replay stays closed (Stage 7)', async () => {
    const repo = { open: jest.fn().mockResolvedValue([{ ...opened[0], entry_destination: 'REPLAY' }]), sharedEntry: jest.fn() } as unknown as jest.Mocked<ActivityRepository>;
    await expect(new ActivityService(repo).open(TOKEN, ITEM)).resolves.toEqual({ outcome: 'UNAVAILABLE', fallback: null });
  });
});

describe('S4-04 C — per-World mutes: World A silenced, World B untouched, unmute restores; nothing else changes', () => {
  it('the A3-01 law over the one mute table: muting A silences only A', async () => {
    const h = harness({ PROPOSAL: [sourceRow({ world_id: WORLD_A, operation_kind: 'END_WORLD' }), sourceRow({ world_id: WORLD_B, operation_kind: 'END_WORLD', recipient_user_id: OTHER })] });
    await h.producer.proposal(SOURCE);
    const [a, b] = h.items().sort((x, y) => (x.contextRef ?? '').localeCompare(y.contextRef ?? ''));
    const muted = new Set([WORLD_A]);
    expect(silenceOf(fresh(a), DEFAULT_PREFERENCES, muted)).toBe('MUTED_CONTEXT');
    expect(decide(fresh(a), muted)).toBe('MUTED_CONTEXT');
    expect(decide(fresh(b), muted)).toBe('ELIGIBLE');
    expect(decide(fresh(a), new Set())).toBe('ELIGIBLE');
    // The global control stays the global control.
    expect(silenceOf(fresh(b), { ...DEFAULT_PREFERENCES, sharedAlerts: false }, new Set())).toBe('CATEGORY_OFF');
  });

  const alerts = (rows: unknown[], outcome = 'MUTED') => {
    const repo = { list: jest.fn().mockResolvedValue(rows), set: jest.fn().mockResolvedValue([{ outcome }]) } as unknown as jest.Mocked<SharedWorldAlertsRepository>;
    const shared = { listMembers: jest.fn().mockResolvedValue([
      { world_id: WORLD_A, is_self: true, member_name: 'Me', joined_at: AT }, { world_id: WORLD_A, is_self: false, member_name: 'Sara', joined_at: AT },
      { world_id: WORLD_B, is_self: true, member_name: 'Me', joined_at: AT },
    ]) } as unknown as jest.Mocked<SharedWorldRepository>;
    const lifecycle = { worldNames: jest.fn().mockResolvedValue([{ world_id: WORLD_B, world_name: 'Family' }]) } as unknown as jest.Mocked<SharedWorldLifecycleRepository>;
    return { repo, service: new SharedWorldAlertsService(repo, shared, lifecycle) };
  };
  it('lists only the current Worlds the database returns, each with its own mute and its label facts — no count', async () => {
    const { service } = alerts([{ world_id: WORLD_A, muted: true }, { world_id: WORLD_B, muted: false }]);
    await expect(service.list(TOKEN)).resolves.toEqual({ worlds: [
      { worldId: WORLD_A, name: null, members: [{ name: 'Me', self: true }, { name: 'Sara', self: false }], muted: true },
      { worldId: WORLD_B, name: 'Family', members: [{ name: 'Me', self: true }], muted: false },
    ] });
  });
  it('sets one World on the caller\'s own token; a malformed body is refused; an unknown World is UNAVAILABLE without a call', async () => {
    const { repo, service } = alerts([], 'UNMUTED');
    await expect(service.set(TOKEN, WORLD_A, { muted: false })).resolves.toEqual({ outcome: 'UNMUTED' });
    expect(repo.set).toHaveBeenCalledWith(TOKEN, WORLD_A, false);
    await expect(service.set(TOKEN, WORLD_A, { muted: 'yes' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.set(TOKEN, WORLD_A, { muted: true, worldId: WORLD_B })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.set(TOKEN, 'nope', { muted: true })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
    expect(repo.set).toHaveBeenCalledTimes(1);
  });
  it('a malformed row fails closed as one 503', async () => {
    await expect(alerts([{ world_id: 'x', muted: true }]).service.list(TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
