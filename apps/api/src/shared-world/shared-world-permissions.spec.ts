import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { ROUTE_RATE_LIMIT_CENSUS } from '../http-security/route-rate-limit.census';
import type { SharedPermissionRow, SharedWorldPermissionsRepository } from './shared-world-permissions.repository';
import { SharedWorldPermissionsService } from './shared-world-permissions.service';
import type { SharedWorldRepository } from './shared-world.repository';

const WORLD = '33333333-3333-4333-8333-333333333333';
const OTHER_WORLD = '77777777-7777-4777-8777-777777777777';
const COMMAND = '55555555-5555-4555-8555-555555555555';
const REQUEST = '88888888-8888-4888-8888-888888888888';
const ITEM = '99999999-9999-4999-8999-999999999999';
const ITEM_2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REF = `sha256:${'c'.repeat(64)}`;
const AT = '2026-10-25T10:00:00+00:00';
const TOKEN = 'owner-token';

/** One row exactly as migration 0177's owner read projects it. */
const row = (over: Partial<SharedPermissionRow>): SharedPermissionRow => ({
  section: 'REQUEST', memory_id: ITEM, content: 'أنام مبكرًا كل يوم', request_id: REQUEST, ended_reason: null,
  member_names: ['هالة', 'سارة'], new_member_names: null, audience_ref: REF, ...over,
});

function fakes(options: { allow?: boolean; rows?: SharedPermissionRow[]; outcome?: string; error?: unknown } = {}) {
  const allow = options.allow ?? true;
  const shared = {
    resolveEntry: jest.fn(async (_t: string, worldId: string) => [allow && worldId === WORLD
      ? { outcome: 'ALLOW', world_id: WORLD, born_at: AT, joined_at: AT } : { outcome: 'UNAVAILABLE', world_id: null, born_at: null, joined_at: null }]),
  };
  const fail = async () => { if (options.error) throw options.error; };
  const permissions = {
    list: jest.fn(async () => { await fail(); return options.rows ?? [row({})]; }),
    answer: jest.fn(async () => { await fail(); return [{ outcome: options.outcome ?? 'ALLOWED' }]; }),
    allow: jest.fn(async () => { await fail(); return [{ outcome: options.outcome ?? 'ALLOWED' }]; }),
    withdraw: jest.fn(async () => { await fail(); return [{ outcome: options.outcome ?? 'REVOKED' }]; }),
  };
  const service = new SharedWorldPermissionsService(permissions as unknown as SharedWorldPermissionsRepository,
    shared as unknown as SharedWorldRepository);
  return { service, shared, permissions };
}

describe('S8A-04 CP3-C — the owner\'s permissions (migration 0177)', () => {
  describe('the read', () => {
    it('gives the owner their own request, items and endings, the other members by name and the opaque audience reference', async () => {
      const { service, permissions } = fakes({ rows: [
        row({}),
        row({ section: 'ALLOWED', memory_id: ITEM_2, request_id: null, content: 'أحب القهوة' }),
        row({ section: 'NEEDS_RECONFIRMATION', memory_id: ITEM_2, request_id: null, content: 'أسافر كثيرًا', new_member_names: ['نور'] }),
        row({ section: 'DECLINED', request_id: null, content: 'أمارس الرياضة' }),
        row({ section: 'ENDED', request_id: null, content: null, ended_reason: 'FORGOTTEN' }),
        row({ section: 'ENDED', request_id: null, content: 'أشرب الشاي', ended_reason: 'LEFT' }),
      ] });
      await expect(service.read(TOKEN, WORLD)).resolves.toEqual({
        outcome: 'READ', audienceRef: REF, members: ['هالة', 'سارة'],
        requests: [{ requestId: REQUEST, itemId: ITEM, text: 'أنام مبكرًا كل يوم' }],
        allowed: [{ itemId: ITEM_2, text: 'أحب القهوة' }],
        reconfirm: [{ itemId: ITEM_2, text: 'أسافر كثيرًا', newMembers: ['نور'] }],
        declined: [{ itemId: ITEM, text: 'أمارس الرياضة' }],
        ended: [{ itemId: ITEM, text: null, reason: 'FORGOTTEN' }, { itemId: ITEM, text: 'أشرب الشاي', reason: 'LEFT' }],
      });
      expect(permissions.list).toHaveBeenCalledWith(TOKEN, WORLD);
    });

    it('maps the database endings onto the CG-5 vocabulary (one text for an ending by time)', async () => {
      for (const [reason, ending] of [['CORRECTED', 'CORRECTED'], ['TURNED_OFF', 'TURNED_OFF'], ['EXPIRED', 'NO_LONGER_CURRENT'],
        ['INELIGIBLE', 'NO_LONGER_CURRENT'], ['WORLD_CLOSED', 'NO_LONGER_CURRENT']]) {
        const { service } = fakes({ rows: [row({ section: 'ENDED', request_id: null, content: null, ended_reason: reason })] });
        const view = await service.read(TOKEN, WORLD);
        expect(view.outcome === 'READ' && view.ended[0].reason).toBe(ending);
      }
    });

    it('an empty read is READ with nothing to answer', async () => {
      const { service } = fakes({ rows: [] });
      await expect(service.read(TOKEN, WORLD)).resolves.toEqual({ outcome: 'READ', audienceRef: null, members: [], requests: [], allowed: [],
        reconfirm: [], declined: [], ended: [] });
    });

    it('the entry verdict comes first: no read for a World the reader may not enter, or a malformed World id', async () => {
      const outside = fakes({ allow: false });
      await expect(outside.service.read(TOKEN, WORLD)).resolves.toEqual({ outcome: 'UNAVAILABLE' });
      expect(outside.permissions.list).not.toHaveBeenCalled();
      const malformed = fakes();
      await expect(malformed.service.read(TOKEN, 'not-a-world')).resolves.toEqual({ outcome: 'UNAVAILABLE' });
      expect(malformed.shared.resolveEntry).not.toHaveBeenCalled();
    });

    it('never shows an audience it cannot name, a mixed audience, an unknown section or reason, or an item without its words', async () => {
      for (const rows of [
        [row({ member_names: ['هالة', null] })],
        [row({ member_names: [''] })],
        [row({}), row({ section: 'ALLOWED', request_id: null, audience_ref: `sha256:${'d'.repeat(64)}` })],
        [row({}), row({ section: 'ALLOWED', request_id: null, member_names: ['هالة'] })],
        [row({ audience_ref: 'sha256:short' })],
        [row({ section: 'SOMETHING' })],
        [row({ section: 'ENDED', request_id: null, ended_reason: 'NOPE' })],
        [row({ content: null })],
        [row({ request_id: null })],
        [row({ section: 'NEEDS_RECONFIRMATION', request_id: null, new_member_names: [] })],
        [row({ memory_id: 'x' })],
      ]) {
        const { service } = fakes({ rows });
        await expect(service.read(TOKEN, WORLD)).rejects.toBeInstanceOf(ServiceUnavailableException);
      }
    });

    it('no value of the read is a user id: only the owner\'s items, words, names and the reference', async () => {
      const { service } = fakes();
      const view = await service.read(TOKEN, WORLD);
      expect(Object.keys(view).sort()).toEqual(['allowed', 'audienceRef', 'declined', 'ended', 'members', 'outcome', 'reconfirm', 'requests']);
    });
  });

  describe('answering a request (CG-1 / CG-2)', () => {
    it('Allow carries the audience reference the owner was shown; the database decides', async () => {
      const { service, permissions } = fakes();
      await expect(service.answer(TOKEN, WORLD, REQUEST, { commandId: COMMAND, decision: 'ALLOW', audienceRef: REF })).resolves.toEqual({ outcome: 'ALLOWED' });
      expect(permissions.answer).toHaveBeenCalledWith(TOKEN, COMMAND, REQUEST, 'ALLOW', REF);
    });

    it('No carries no reference', async () => {
      const { service, permissions } = fakes({ outcome: 'DECLINED' });
      await expect(service.answer(TOKEN, WORLD, REQUEST, { commandId: COMMAND, decision: 'DECLINE' })).resolves.toEqual({ outcome: 'DECLINED' });
      expect(permissions.answer).toHaveBeenCalledWith(TOKEN, COMMAND, REQUEST, 'DECLINE', null);
    });

    it('passes AUDIENCE_CHANGED and UNAVAILABLE through, and nothing else', async () => {
      for (const outcome of ['AUDIENCE_CHANGED', 'UNAVAILABLE']) {
        const { service } = fakes({ outcome });
        await expect(service.answer(TOKEN, WORLD, REQUEST, { commandId: COMMAND, decision: 'ALLOW', audienceRef: REF })).resolves.toEqual({ outcome });
      }
      const odd = fakes({ outcome: 'GRANTED' });
      await expect(odd.service.answer(TOKEN, WORLD, REQUEST, { commandId: COMMAND, decision: 'ALLOW', audienceRef: REF }))
        .rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('answers only an open request of THIS World, after the entry verdict', async () => {
      const elsewhere = fakes({ rows: [row({ request_id: '11111111-1111-4111-8111-111111111111' })] });
      await expect(elsewhere.service.answer(TOKEN, WORLD, REQUEST, { commandId: COMMAND, decision: 'DECLINE' })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
      expect(elsewhere.permissions.answer).not.toHaveBeenCalled();
      const outside = fakes({ allow: false });
      await expect(outside.service.answer(TOKEN, OTHER_WORLD, REQUEST, { commandId: COMMAND, decision: 'DECLINE' })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
      expect(outside.permissions.list).not.toHaveBeenCalled();
    });

    it('refuses a malformed body before any read: extra keys, a user id, a ceiling, a reference with No, none with Allow', async () => {
      for (const body of [
        null, {}, { commandId: 'x', decision: 'DECLINE' }, { commandId: COMMAND, decision: 'MAYBE' },
        { commandId: COMMAND, decision: 'ALLOW' }, { commandId: COMMAND, decision: 'ALLOW', audienceRef: 'sha256:short' },
        { commandId: COMMAND, decision: 'DECLINE', audienceRef: REF }, { commandId: COMMAND, decision: 'ALLOW', audienceRef: REF, userId: ITEM },
        { commandId: COMMAND, decision: 'ALLOW', audienceRef: REF, ceiling: [ITEM] },
      ]) {
        const { service, shared } = fakes();
        await expect(service.answer(TOKEN, WORLD, REQUEST, body)).rejects.toBeInstanceOf(BadRequestException);
        expect(shared.resolveEntry).not.toHaveBeenCalled();
      }
    });

    it('a database refusal as malformed is INVALID_REQUEST; any other failure is unavailable', async () => {
      const malformed = fakes({ error: new DataApiError(400) });
      await expect(malformed.service.read(TOKEN, WORLD)).rejects.toBeInstanceOf(BadRequestException);
      const conflict = fakes({ error: new DataApiError(409) });
      await expect(conflict.service.read(TOKEN, WORLD)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('allow later / allow for everyone, and withdraw', () => {
    it('allow carries the reference; the database decides', async () => {
      const { service, permissions } = fakes({ outcome: 'AUDIENCE_CHANGED' });
      await expect(service.allow(TOKEN, WORLD, ITEM, { commandId: COMMAND, audienceRef: REF })).resolves.toEqual({ outcome: 'AUDIENCE_CHANGED' });
      expect(permissions.allow).toHaveBeenCalledWith(TOKEN, COMMAND, WORLD, ITEM, REF);
      await expect(service.allow(TOKEN, WORLD, ITEM, { commandId: COMMAND })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.allow(TOKEN, WORLD, ITEM, { commandId: COMMAND, audienceRef: REF, memberIds: [] })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.allow(TOKEN, WORLD, 'nope', { commandId: COMMAND, audienceRef: REF })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
    });

    it('withdraw answers WITHDRAWN or UNAVAILABLE, after the entry verdict', async () => {
      const { service, permissions } = fakes();
      await expect(service.withdraw(TOKEN, WORLD, ITEM, { commandId: COMMAND })).resolves.toEqual({ outcome: 'WITHDRAWN' });
      expect(permissions.withdraw).toHaveBeenCalledWith(TOKEN, COMMAND, WORLD, ITEM);
      const nothing = fakes({ outcome: 'UNAVAILABLE' });
      await expect(nothing.service.withdraw(TOKEN, WORLD, ITEM, { commandId: COMMAND })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
      const outside = fakes({ allow: false });
      await expect(outside.service.withdraw(TOKEN, WORLD, ITEM, { commandId: COMMAND })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
      expect(outside.permissions.withdraw).not.toHaveBeenCalled();
      await expect(service.withdraw(TOKEN, WORLD, ITEM, { commandId: COMMAND, audienceRef: REF })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('every route is classified: consent acts security-sensitive, the read and withdrawal ordinary own acts', () => {
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /shared/worlds/:worldId/permissions']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /shared/worlds/:worldId/permissions/requests/:requestId/answer']).toBe('SECURITY_SENSITIVE');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /shared/worlds/:worldId/permissions/items/:itemId/allow']).toBe('SECURITY_SENSITIVE');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /shared/worlds/:worldId/permissions/items/:itemId/withdraw']).toBe('AUTHENTICATED');
  });
});
