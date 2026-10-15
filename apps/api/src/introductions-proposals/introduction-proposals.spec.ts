import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError, type SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { IntroductionProposalsRepository } from './introduction-proposals.repository';
import { IntroductionProposalsService } from './introduction-proposals.service';

// S6-04 - the API boundary of a human's own private proposals (migration 0158): the exact request shapes, strict
// decoding of the four neutral columns, the five fixed decision answers, one call per request and never a retry, no
// identity, role or state from the client, and nothing of the database's answer passed on.

const PROPOSAL = '11111111-1111-4111-8111-111111111111';
const VIEW = '22222222-2222-4222-8222-222222222222';
const COMMAND = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';
const row = (overrides: Record<string, unknown> = {}) => ({
  recipient_view_id: VIEW, matching_proposal_id: PROPOSAL, neutral_outcome: 'AWAITING_YOU', available_actions: ['APPROVE_FORWARD', 'DECLINE'], ...overrides,
});
const shown = { proposalId: PROPOSAL, viewId: VIEW, status: 'AWAITING_YOU', actions: ['APPROVE_FORWARD', 'DECLINE'] };

describe('S6-04 - IntroductionProposalsService', () => {
  let list: jest.Mock;
  let get: jest.Mock;
  let decide: jest.Mock;
  let service: IntroductionProposalsService;

  beforeEach(() => {
    list = jest.fn().mockResolvedValue([row()]);
    get = jest.fn().mockResolvedValue([row()]);
    decide = jest.fn().mockResolvedValue([{ outcome: 'RECORDED', neutral_outcome: 'IN_PROGRESS' }]);
    service = new IntroductionProposalsService({ list, get, decide } as unknown as IntroductionProposalsRepository);
  });

  describe('the listing', () => {
    it('reads one bounded page of the caller\'s own proposals and decodes exactly the four neutral columns', async () => {
      await expect(service.list('token', undefined, undefined)).resolves.toEqual({ proposals: [shown], next: null });
      expect(list).toHaveBeenCalledWith('token', null, 20);
    });

    it('offers the next cursor only when the page is full', async () => {
      list.mockResolvedValue([row(), row({ matching_proposal_id: OTHER, neutral_outcome: 'IN_PROGRESS', available_actions: ['WITHDRAW'] })]);
      await expect(service.list('token', PROPOSAL, '2')).resolves.toMatchObject({ next: OTHER });
      expect(list).toHaveBeenCalledWith('token', PROPOSAL, 2);
    });

    it.each([
      ['a malformed cursor', 'x', undefined], ['a cursor array', [PROPOSAL], undefined], ['a zero page', undefined, '0'],
      ['a page above twenty', undefined, '21'], ['a non-numeric page', undefined, 'ten'], ['a page array', undefined, ['5']],
    ])('refuses %s before any database call', async (_label, after, limit) => {
      await expect(service.list('token', after, limit)).rejects.toBeInstanceOf(BadRequestException);
      expect(list).not.toHaveBeenCalled();
    });

    it.each([
      ['a first name column', row({ presented_first_name: 'Sara' })],
      ['a conclusion column', row({ safe_compatibility_conclusion: 'x' })],
      ['an unknown outcome', row({ neutral_outcome: 'FORWARDED_TO_SECOND' })],
      ['an acceptance', row({ available_actions: ['ACCEPT'] })],
      ['a repeated action', row({ available_actions: ['DECLINE', 'DECLINE'] })],
      ['a malformed identity', row({ recipient_view_id: 'v1' })],
      ['a missing column', { recipient_view_id: VIEW, matching_proposal_id: PROPOSAL, neutral_outcome: 'AWAITING_YOU' }],
    ])('fails closed on %s, never passing it on', async (_label, bad) => {
      list.mockResolvedValue([bad]);
      await expect(service.list('token', undefined, undefined)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('fails closed on more rows than the page it asked for', async () => {
      list.mockResolvedValue([row()]);
      await expect(service.list('token', undefined, '1')).resolves.toMatchObject({ next: PROPOSAL });
      list.mockResolvedValue([row(), row()]);
      await expect(service.list('token', undefined, '1')).rejects.toBeInstanceOf(ServiceUnavailableException);
      list.mockResolvedValue([row(), row(), row()]);
      await expect(service.list('token', undefined, '2')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('one proposal', () => {
    it('answers the caller\'s own proposal, or null for anything else', async () => {
      await expect(service.get('token', PROPOSAL)).resolves.toEqual({ proposal: shown });
      get.mockResolvedValue([]);
      await expect(service.get('token', OTHER)).resolves.toEqual({ proposal: null });
    });

    it('a proposal that is not an identifier is null without a database call', async () => {
      await expect(service.get('token', 'not-a-proposal')).resolves.toEqual({ proposal: null });
      expect(get).not.toHaveBeenCalled();
    });
  });

  describe('the decisions', () => {
    it.each(['forward-approval', 'decline', 'withdrawal'] as const)('%s sends exactly the command, the proposal and the view, once, then re-reads', async (kind) => {
      get.mockResolvedValue([row({ neutral_outcome: 'IN_PROGRESS', available_actions: ['WITHDRAW'] })]);
      await expect(service.decide('token', kind, PROPOSAL, { commandId: COMMAND, viewId: VIEW })).resolves.toEqual({
        outcome: 'RECORDED', proposal: { ...shown, status: 'IN_PROGRESS', actions: ['WITHDRAW'] },
      });
      expect(decide).toHaveBeenCalledTimes(1);
      expect(decide).toHaveBeenCalledWith('token', kind, COMMAND, PROPOSAL, VIEW);
      expect(get).toHaveBeenCalledWith('token', PROPOSAL);
    });

    it.each(['RECORDED', 'CHANGED', 'UNAVAILABLE', 'NOT_AVAILABLE_NOW', 'COMMAND_CONFLICT'])('passes the fixed %s answer through', async (outcome) => {
      decide.mockResolvedValue([{ outcome, neutral_outcome: null }]);
      await expect(service.decide('token', 'decline', PROPOSAL, { commandId: COMMAND, viewId: VIEW })).resolves.toMatchObject({ outcome });
    });

    it.each([
      ['no body', undefined], ['an array', [COMMAND]], ['no view', { commandId: COMMAND }], ['no command', { viewId: VIEW }],
      ['a malformed command', { commandId: 'x', viewId: VIEW }], ['an actor', { commandId: COMMAND, viewId: VIEW, userId: OTHER }],
      ['a role', { commandId: COMMAND, viewId: VIEW, role: 'FIRST_RECIPIENT' }],
      ['an expected state', { commandId: COMMAND, viewId: VIEW, expectedState: 'FORWARDED_TO_SECOND' }],
      ['a counterpart', { commandId: COMMAND, viewId: VIEW, counterpartId: OTHER }],
    ])('refuses %s as an invalid request before any database call', async (_label, body) => {
      await expect(service.decide('token', 'withdrawal', PROPOSAL, body)).rejects.toBeInstanceOf(BadRequestException);
      expect(decide).not.toHaveBeenCalled();
    });

    it('a proposal that is not an identifier is UNAVAILABLE without a database call', async () => {
      await expect(service.decide('token', 'decline', 'nope', { commandId: COMMAND, viewId: VIEW })).resolves.toEqual({ outcome: 'UNAVAILABLE', proposal: null });
      expect(decide).not.toHaveBeenCalled();
    });

    it('an unknown or missing answer fails closed, never as a success', async () => {
      for (const rows of [[], [{ outcome: 'MATCHED' }], [{}], null, [{ outcome: 'RECORDED' }, { outcome: 'RECORDED' }]]) {
        decide.mockResolvedValue(rows);
        await expect(service.decide('token', 'forward-approval', PROPOSAL, { commandId: COMMAND, viewId: VIEW }))
          .rejects.toBeInstanceOf(ServiceUnavailableException);
      }
    });

    it('only a database 22023 is the client\'s invalid request; every other failure is unavailable, said once, never retried', async () => {
      decide.mockRejectedValue(new DataApiError(400, { databaseCode: '22023', databaseMessage: 'MATCHING_COMMAND_INVALID' }));
      await expect(service.decide('token', 'decline', PROPOSAL, { commandId: COMMAND, viewId: VIEW })).rejects.toBeInstanceOf(BadRequestException);
      for (const error of [new DataApiError(400, { databaseCode: 'P0001', databaseMessage: 'MATCHING_DECISION_CONTRADICTORY_STATE' }),
        new DataApiError(400), new DataApiError(401), new DataApiError(403), new DataApiError(404), new DataApiError(409),
        new DataApiError(500, { databaseCode: '40001', databaseMessage: 'MATCHING_RECIPIENT_VIEW_STALE' }), new DataApiError(503)]) {
        decide.mockReset().mockRejectedValue(error);
        const refusal = await service.decide('token', 'decline', PROPOSAL, { commandId: COMMAND, viewId: VIEW }).catch((e: unknown) => e);
        expect(refusal).toBeInstanceOf(ServiceUnavailableException);
        expect(JSON.stringify((refusal as ServiceUnavailableException).getResponse())).not.toMatch(/MATCHING|P0001|40001|22023/u);
        expect(decide).toHaveBeenCalledTimes(1);
      }
    });
  });
});

describe('S6-04 - IntroductionProposalsRepository', () => {
  it('calls only the five migration 0158 boundaries, with the caller token and exactly their parameters', async () => {
    const request = jest.fn().mockResolvedValue([]);
    const repository = new IntroductionProposalsRepository({ request } as unknown as SupabaseDataApiService);
    await repository.list('caller-token', null, 20);
    await repository.get('caller-token', PROPOSAL);
    await repository.decide('caller-token', 'forward-approval', COMMAND, PROPOSAL, VIEW);
    await repository.decide('caller-token', 'decline', COMMAND, PROPOSAL, VIEW);
    await repository.decide('caller-token', 'withdrawal', COMMAND, PROPOSAL, VIEW);
    const decision = { method: 'POST', body: JSON.stringify({ p_command_id: COMMAND, p_proposal_id: PROPOSAL, p_expected_view_id: VIEW }) };
    expect(request.mock.calls).toEqual([
      ['caller-token', 'rpc/list_my_matching_proposals_v1', { method: 'POST', body: JSON.stringify({ p_after_proposal_id: null, p_limit: 20 }) }],
      ['caller-token', 'rpc/get_my_matching_proposal_v1', { method: 'POST', body: JSON.stringify({ p_proposal_id: PROPOSAL }) }],
      ['caller-token', 'rpc/approve_my_matching_proposal_forward_v1', decision],
      ['caller-token', 'rpc/decline_my_matching_proposal_v1', decision],
      ['caller-token', 'rpc/withdraw_my_matching_proposal_v1', decision],
    ]);
  });
});

describe('S6-04 - the proposal module is isolated', () => {
  const dir = __dirname;
  const own = readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts')).sort();

  it('is exactly its four files', () => {
    expect(own).toEqual(['introduction-proposals.controller.ts', 'introduction-proposals.repository.ts', 'introduction-proposals.service.ts', 'introductions-proposals.module.ts']);
  });

  it.each(own)('%s imports only its own files, auth and the Data API transport, names no core and logs nothing', (name) => {
    const text = readFileSync(join(dir, name), 'utf8');
    for (const target of [...text.matchAll(/from '([^']+)'/gu)].map((m) => m[1])) {
      expect(target.startsWith('./') || ['@nestjs/common', '../auth/authenticated-request', '../auth/supabase-auth.guard',
        '../auth/supabase-auth.service', '../conversation/supabase-data-api.service'].includes(target)).toBe(true);
    }
    const code = text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
    expect(code).not.toMatch(/_core_v1|commit_matching|resolve_my_matching_proposal_v1|_fields_v1|presented_first_name|safe_compatibility|service[-_]role|model-router|shared-world/iu);
    expect(code).not.toMatch(/console\.|Logger|captureException|Sentry|retry|setTimeout/iu);
  });

  it('has no acceptance route and takes no identity, role or state from the client', () => {
    const controller = readFileSync(join(dir, 'introduction-proposals.controller.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '');
    expect([...controller.matchAll(/@(Get|Post|Put|Patch|Delete)\('([^']+)'\)/gu)].map((m) => `${m[1]} ${m[2]}`)).toEqual([
      'Get proposals', 'Get proposals/:proposalId', 'Post proposals/:proposalId/forward-approval',
      'Post proposals/:proposalId/decline', 'Post proposals/:proposalId/withdrawal',
    ]);
    expect([...controller.matchAll(/@Param\('([^']+)'\)/gu)].map((m) => m[1])).toEqual(['proposalId', 'proposalId', 'proposalId', 'proposalId']);
    expect([...controller.matchAll(/@Query\('([^']+)'\)/gu)].map((m) => m[1])).toEqual(['after', 'limit']);
    expect(controller).not.toMatch(/accept|userId|role|state/iu);
  });
});
