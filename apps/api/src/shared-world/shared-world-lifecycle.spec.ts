import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { ROUTE_RATE_LIMIT_CENSUS } from '../http-security/route-rate-limit.census';
import type { SharedProposalRow, SharedWorldLifecycleRepository } from './shared-world-lifecycle.repository';
import { SHARED_HISTORY_PACKAGE_MAX, SHARED_LIFECYCLE_PAGE, SharedWorldLifecycleService } from './shared-world-lifecycle.service';
import type { SharedWorldRepository } from './shared-world.repository';

const WORLD = '33333333-3333-4333-8333-333333333333';
const OTHER_WORLD = '77777777-7777-4777-8777-777777777777';
const COMMAND = '55555555-5555-4555-8555-555555555555';
const PROPOSAL = '88888888-8888-4888-8888-888888888888';
const PACKAGE = '99999999-9999-4999-8999-999999999999';
const HANDLE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MATERIAL = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MATERIAL_2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const AT = '2026-10-05T10:00:00+00:00';

/** One proposal row exactly as migration 0140 projects it, with the fields a case varies. */
const proposalRow = (over: Partial<SharedProposalRow>): SharedProposalRow => ({
  proposal_id: PROPOSAL, operation_kind: 'END_WORLD', created_at: AT, proposer_name: 'Bassem', proposer_is_self: false, target_name: null,
  proposed_name: null, proposed_description: null, proposed_topic: null, approved_by_self: false, approved_count: 0, required_count: 2, ...over,
});

/** In-memory stand-ins answering exactly as migrations 0138 / 0140 do for one reader. */
function fakes(options: { allow?: boolean; outcome?: string } = {}) {
  const allow = options.allow ?? true;
  const shared = {
    resolveEntry: jest.fn(async (_t: string, worldId: string) => [allow && worldId === WORLD
      ? { outcome: 'ALLOW', world_id: WORLD, born_at: AT, joined_at: AT } : { outcome: 'UNAVAILABLE', world_id: null, born_at: null, joined_at: null }]),
  };
  const lifecycle = {
    capabilities: jest.fn(async () => [{ governance_available: true, history_available: false }]),
    settings: jest.fn(async () => [{ world_name: 'Our Lantern', world_description: null, world_topic: 'Weekend' }]),
    members: jest.fn(async () => [{ member_handle: HANDLE, member_name: 'Bassem', is_self: false }, { member_handle: COMMAND, member_name: 'Amal', is_self: true }]),
    proposals: jest.fn(async (): Promise<SharedProposalRow[]> => [
      { proposal_id: PROPOSAL, operation_kind: 'WORLD_SETTINGS_CHANGE', created_at: AT, proposer_name: 'Amal', proposer_is_self: true, target_name: null,
        proposed_name: 'New', proposed_description: null, proposed_topic: null, approved_by_self: false, approved_count: 2, required_count: 3 },
      { proposal_id: PACKAGE, operation_kind: 'REMOVE_MEMBER', created_at: AT, proposer_name: 'Bassem', proposer_is_self: false, target_name: 'Chadi',
        proposed_name: null, proposed_description: null, proposed_topic: null, approved_by_self: true, approved_count: 1, required_count: 2 },
      { proposal_id: MATERIAL, operation_kind: 'ADD_MEMBER', created_at: AT, proposer_name: 'Bassem', proposer_is_self: false, target_name: 'leaked',
        proposed_name: null, proposed_description: null, proposed_topic: null, approved_by_self: false, approved_count: 0, required_count: 3 },
    ]),
    historyRequests: jest.fn(async () => [
      { package_id: PACKAGE, created_at: AT, grantee_name: 'Rana', approved_by_self: false, material_id: MATERIAL, established_at: AT, text_body: 'mine one' },
      { package_id: PACKAGE, created_at: AT, grantee_name: 'Rana', approved_by_self: false, material_id: MATERIAL_2, established_at: AT, text_body: 'mine two' },
    ]),
    historyCandidates: jest.fn(async () => [
      { material_id: MATERIAL_2, established_at: AT, is_self: false, author_name: 'Bassem', text_body: 'newer' },
      { material_id: MATERIAL, established_at: AT, is_self: true, author_name: 'Amal', text_body: 'older' },
    ]),
    closedWorlds: jest.fn(async () => [{ world_id: WORLD, closed_at: AT, world_name: 'Our Lantern' }]),
    closedMembers: jest.fn(async () => [{ world_id: WORLD, is_self: true, member_name: 'Amal' }, { world_id: OTHER_WORLD, is_self: true, member_name: 'Elsewhere' }]),
    closedMaterial: jest.fn(async () => [
      { material_id: MATERIAL_2, producer_kind: 'QANDEEL', established_at: AT, is_self: false, author_name: null, text_body: 'qandeel' },
      { material_id: MATERIAL, producer_kind: 'HUMAN', established_at: AT, is_self: true, author_name: 'Amal', text_body: 'mine' },
    ]),
    formerMaterial: jest.fn(async () => [{ material_id: MATERIAL, world_id: WORLD, established_at: AT, text_body: 'my old words' }]),
    formerHistoryRequests: jest.fn(async () => [
      { package_id: PACKAGE, world_id: WORLD, created_at: AT, approved_by_self: false, material_id: MATERIAL, established_at: AT, text_body: 'my old words' },
    ]),
    proposeMember: jest.fn(async () => [{ outcome: options.outcome ?? 'SUBMITTED' }]),
    acceptMembershipRequest: jest.fn(async () => [{ outcome: options.outcome ?? 'JOINED' }]),
    leave: jest.fn(async () => [{ outcome: options.outcome ?? 'LEFT' }]),
    proposeSettings: jest.fn(async () => [{ outcome: options.outcome ?? 'PROPOSED', proposal_id: PROPOSAL }]),
    proposeRemoval: jest.fn(async () => [{ outcome: options.outcome ?? 'PROPOSED', proposal_id: PROPOSAL }]),
    proposeEnd: jest.fn(async () => [{ outcome: options.outcome ?? 'PROPOSED', proposal_id: PROPOSAL }]),
    approve: jest.fn(async () => [{ outcome: options.outcome ?? 'APPROVED' }]),
    proposeHistoryShare: jest.fn(async () => [{ outcome: options.outcome ?? 'PROPOSED', package_id: PACKAGE }]),
    approveHistoryShare: jest.fn(async () => [{ outcome: options.outcome ?? 'GRANTED' }]),
    deleteOwnFormer: jest.fn(async () => [{ outcome: options.outcome ?? 'DELETED' }]),
  };
  const service = new SharedWorldLifecycleService(shared as unknown as SharedWorldRepository, lifecycle as unknown as SharedWorldLifecycleRepository);
  return { service, shared, lifecycle };
}

describe('S4-03 Shared lifecycle Product boundary', () => {
  it('returns nothing of a World before ALLOW, and reads nothing of it', async () => {
    const { service, lifecycle } = fakes({ allow: false });
    expect(await service.manage('token', WORLD)).toEqual({ outcome: 'UNAVAILABLE' });
    expect(await service.historyCandidates('token', WORLD, HANDLE)).toEqual({ outcome: 'UNAVAILABLE' });
    expect(await service.manage('token', 'not-a-world')).toEqual({ outcome: 'UNAVAILABLE' });
    expect(lifecycle.settings).not.toHaveBeenCalled();
    expect(lifecycle.proposals).not.toHaveBeenCalled();
    expect(lifecycle.historyCandidates).not.toHaveBeenCalled();
  });

  it('projects Manage World: settings, handles, the proposals and the history requests that wait on THIS reader', async () => {
    const { service } = fakes();
    expect(await service.manage('token', WORLD)).toEqual({
      outcome: 'ALLOW',
      capabilities: { governance: true, history: false },
      settings: { name: 'Our Lantern', description: null, topic: 'Weekend' },
      members: [{ handle: HANDLE, name: 'Bassem', self: false }, { handle: COMMAND, name: 'Amal', self: true }],
      proposals: [
        { proposalId: PROPOSAL, kind: 'SETTINGS', proposer: { name: null, self: true }, targetName: null,
          settings: { name: 'New', description: null, topic: null }, approvedBySelf: false, progress: { approved: 2, required: 3 } },
        { proposalId: PACKAGE, kind: 'REMOVAL', proposer: { name: 'Bassem', self: false }, targetName: 'Chadi', settings: null,
          approvedBySelf: true, progress: { approved: 1, required: 2 } },
        // An add never names its target, whatever a read might carry.
        { proposalId: MATERIAL, kind: 'ADD', proposer: { name: 'Bassem', self: false }, targetName: null, settings: null,
          approvedBySelf: false, progress: { approved: 0, required: 3 } },
      ],
      historyRequests: [{ packageId: PACKAGE, granteeName: 'Rana', approvedBySelf: false, items: [
        { materialId: MATERIAL, text: 'mine one', establishedAt: AT }, { materialId: MATERIAL_2, text: 'mine two', establishedAt: AT }] }],
    });
  });

  it('refuses a Product boolean that is not a real boolean instead of guessing it', async () => {
    const { service, lifecycle } = fakes();
    lifecycle.proposals.mockResolvedValueOnce([proposalRow({ approved_by_self: null as unknown as boolean })]);
    await expect(service.manage('token', WORLD)).rejects.toBeInstanceOf(ServiceUnavailableException);
    lifecycle.proposals.mockResolvedValueOnce([proposalRow({ proposer_is_self: null as unknown as boolean })]);
    await expect(service.manage('token', WORLD)).rejects.toBeInstanceOf(ServiceUnavailableException);
    lifecycle.proposals.mockResolvedValueOnce([proposalRow({ approved_count: 3 })]);
    await expect(service.manage('token', WORLD)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('never projects an operation the boundary does not govern', async () => {
    const { service, lifecycle } = fakes();
    lifecycle.proposals.mockResolvedValueOnce([proposalRow({ operation_kind: 'OWNER_TRANSFER' })]);
    await expect(service.manage('token', WORLD)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('adds or brings back a member by Shared ID: one answer, nothing about the target; only the target accepts', async () => {
    const { service, lifecycle } = fakes();
    expect(await service.proposeMember('token', WORLD, { commandId: COMMAND, sharedId: 'k7qm 4xwd p9tr' })).toEqual({ outcome: 'SUBMITTED' });
    expect(lifecycle.proposeMember).toHaveBeenCalledWith('token', COMMAND, WORLD, 'k7qm 4xwd p9tr');
    await expect(service.proposeMember('token', WORLD, { commandId: COMMAND, sharedId: 'x'.repeat(65) })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.proposeMember('token', WORLD, { commandId: COMMAND, sharedId: 'K7QM-4XWD-P9TR', targetUserId: HANDLE })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.proposeMember('token', WORLD, { commandId: COMMAND })).rejects.toBeInstanceOf(BadRequestException);
    expect(await fakes({ outcome: 'INVALID_SHARED_ID' }).service.proposeMember('token', WORLD, { commandId: COMMAND, sharedId: 'nope' })).toEqual({ outcome: 'INVALID_SHARED_ID' });
    await expect(fakes({ outcome: 'PROPOSED' }).service.proposeMember('token', WORLD, { commandId: COMMAND, sharedId: 'nope' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(await service.acceptMembershipRequest('token', WORLD, PROPOSAL, { commandId: COMMAND })).toEqual({ outcome: 'JOINED' });
    expect(lifecycle.acceptMembershipRequest).toHaveBeenCalledWith('token', COMMAND, WORLD, PROPOSAL);
    await expect(service.acceptMembershipRequest('token', WORLD, PROPOSAL, { commandId: COMMAND, userId: HANDLE })).rejects.toBeInstanceOf(BadRequestException);
    expect(await service.acceptMembershipRequest('token', WORLD, 'nope', { commandId: COMMAND })).toEqual({ outcome: 'UNAVAILABLE' });
    expect(await fakes({ outcome: 'INVITED' }).service.approve('token', WORLD, PROPOSAL, { commandId: COMMAND })).toEqual({ outcome: 'INVITED' });
  });

  it('a former member approves their own included words outside the World: own words only, by exact World and package', async () => {
    const { service, lifecycle } = fakes();
    expect(await service.formerHistoryRequests('token')).toEqual({ requests: [
      { packageId: PACKAGE, worldId: WORLD, approvedBySelf: false, items: [{ materialId: MATERIAL, text: 'my old words', establishedAt: AT }] },
    ] });
    expect(await service.approveHistoryShare('token', WORLD, PACKAGE, { commandId: COMMAND })).toEqual({ outcome: 'GRANTED' });
    lifecycle.formerHistoryRequests.mockResolvedValueOnce([{ package_id: PACKAGE, world_id: WORLD, created_at: AT, approved_by_self: null as unknown as boolean,
      material_id: MATERIAL, established_at: AT, text_body: 'x' }]);
    await expect(service.formerHistoryRequests('token')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('takes no user, actor, approver, audience, authority or rule from a request', async () => {
    const { service, lifecycle } = fakes();
    await expect(service.leave('token', WORLD, { commandId: COMMAND, userId: HANDLE })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.approve('token', WORLD, PROPOSAL, { commandId: COMMAND, approverId: HANDLE })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.proposeRemoval('token', WORLD, { commandId: COMMAND, memberHandle: HANDLE, targetUserId: HANDLE })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.proposeSettings('token', WORLD, { commandId: COMMAND, name: 'x', description: '', topic: '', approvalRule: 'NONE' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.proposeEnd('token', WORLD, { commandId: COMMAND, membershipSnapshot: [] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.proposeHistoryShare('token', WORLD, { commandId: COMMAND, memberHandle: HANDLE, materialIds: [MATERIAL], audience: [] })).rejects.toBeInstanceOf(BadRequestException);
    expect(lifecycle.leave).not.toHaveBeenCalled();
    expect(lifecycle.approve).not.toHaveBeenCalled();
  });

  it('bounds every request: command identity, settings lengths, handles and the history package', async () => {
    const { service, lifecycle } = fakes();
    await expect(service.leave('token', WORLD, { commandId: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.proposeSettings('token', WORLD, { commandId: COMMAND, name: 'x'.repeat(81), description: '', topic: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.proposeSettings('token', WORLD, { commandId: COMMAND, name: 'x', description: 'x'.repeat(501), topic: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.proposeSettings('token', WORLD, { commandId: COMMAND, name: 'x', description: '', topic: 'x'.repeat(121) })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.proposeRemoval('token', WORLD, { commandId: COMMAND, memberHandle: 'not-a-handle' })).rejects.toBeInstanceOf(BadRequestException);
    const tooMany = Array.from({ length: SHARED_HISTORY_PACKAGE_MAX + 1 }, (_, i) => `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`);
    await expect(service.proposeHistoryShare('token', WORLD, { commandId: COMMAND, memberHandle: HANDLE, materialIds: tooMany })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.proposeHistoryShare('token', WORLD, { commandId: COMMAND, memberHandle: HANDLE, materialIds: [MATERIAL, MATERIAL.toUpperCase()] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.proposeHistoryShare('token', WORLD, { commandId: COMMAND, memberHandle: HANDLE, materialIds: [] })).rejects.toBeInstanceOf(BadRequestException);
    expect(lifecycle.proposeSettings).not.toHaveBeenCalled();
    expect(lifecycle.proposeHistoryShare).not.toHaveBeenCalled();
  });

  it('passes the exact World and the server outcome through, and nothing else', async () => {
    const { service, lifecycle } = fakes();
    expect(await service.leave('token', WORLD, { commandId: COMMAND })).toEqual({ outcome: 'LEFT' });
    expect(lifecycle.leave).toHaveBeenCalledWith('token', COMMAND, WORLD);
    expect(await service.proposeSettings('token', WORLD, { commandId: COMMAND, name: ' Our Lantern ', description: '', topic: '' })).toEqual({ outcome: 'PROPOSED' });
    expect(lifecycle.proposeSettings).toHaveBeenCalledWith('token', COMMAND, WORLD, { name: ' Our Lantern ', description: '', topic: '' });
    expect(await service.proposeRemoval('token', WORLD, { commandId: COMMAND, memberHandle: HANDLE })).toEqual({ outcome: 'PROPOSED' });
    expect(await service.proposeEnd('token', WORLD, { commandId: COMMAND })).toEqual({ outcome: 'PROPOSED' });
    expect(await service.approve('token', WORLD, PROPOSAL, { commandId: COMMAND })).toEqual({ outcome: 'APPROVED' });
    expect(lifecycle.approve).toHaveBeenCalledWith('token', COMMAND, WORLD, PROPOSAL);
    expect(await service.proposeHistoryShare('token', WORLD, { commandId: COMMAND, memberHandle: HANDLE, materialIds: [MATERIAL, MATERIAL_2] })).toEqual({ outcome: 'PROPOSED' });
    expect(await service.approveHistoryShare('token', WORLD, PACKAGE, { commandId: COMMAND })).toEqual({ outcome: 'GRANTED' });
    expect(await service.approve('token', 'nope', PROPOSAL, { commandId: COMMAND })).toEqual({ outcome: 'UNAVAILABLE' });
  });

  it('keeps the bounded refusals and the STALE truth; an unknown answer is no answer', async () => {
    expect(await fakes({ outcome: 'STALE' }).service.approve('token', WORLD, PROPOSAL, { commandId: COMMAND })).toEqual({ outcome: 'STALE' });
    expect(await fakes({ outcome: 'UNAVAILABLE' }).service.leave('token', WORLD, { commandId: COMMAND })).toEqual({ outcome: 'UNAVAILABLE' });
    expect(await fakes({ outcome: 'UNCHANGED' }).service.proposeSettings('token', WORLD, { commandId: COMMAND, name: '', description: '', topic: '' })).toEqual({ outcome: 'UNCHANGED' });
    await expect(fakes({ outcome: 'SOMETHING_ELSE' }).service.approve('token', WORLD, PROPOSAL, { commandId: COMMAND })).rejects.toBeInstanceOf(ServiceUnavailableException);
    const { service, lifecycle } = fakes();
    lifecycle.leave.mockRejectedValueOnce(new DataApiError(500));
    await expect(service.leave('token', WORLD, { commandId: COMMAND })).rejects.toBeInstanceOf(ServiceUnavailableException);
    lifecycle.proposeSettings.mockRejectedValueOnce(new DataApiError(400));
    await expect(service.proposeSettings('token', WORLD, { commandId: COMMAND, name: 'x', description: '', topic: '' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('offers earlier words oldest first, one bounded page at a time (a page, never a ceiling), the reader\'s own unnamed', async () => {
    const { service, lifecycle } = fakes();
    expect(await service.historyCandidates('token', WORLD, HANDLE)).toEqual({ outcome: 'ALLOW', candidates: [
      { materialId: MATERIAL, self: true, authorName: null, text: 'older', establishedAt: AT },
      { materialId: MATERIAL_2, self: false, authorName: 'Bassem', text: 'newer', establishedAt: AT },
    ], hasOlder: false });
    expect(lifecycle.historyCandidates).toHaveBeenCalledWith('token', WORLD, HANDLE, null, SHARED_LIFECYCLE_PAGE + 1);
    const full = Array.from({ length: SHARED_LIFECYCLE_PAGE + 1 }, (_, i) => ({
      material_id: `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`, established_at: AT, is_self: false, author_name: 'Bassem', text_body: `m${i}`,
    }));
    lifecycle.historyCandidates.mockResolvedValueOnce(full);
    const page = await service.historyCandidates('token', WORLD, HANDLE, MATERIAL, AT);
    expect(page.outcome === 'ALLOW' && page.candidates.length).toBe(SHARED_LIFECYCLE_PAGE);
    expect(page.outcome === 'ALLOW' && page.hasOlder).toBe(true);
    expect(lifecycle.historyCandidates).toHaveBeenLastCalledWith('token', WORLD, HANDLE, { materialId: MATERIAL, establishedAt: AT }, SHARED_LIFECYCLE_PAGE + 1);
    await expect(service.historyCandidates('token', WORLD, HANDLE, MATERIAL, 'yesterday')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('shows a closed World only by entitlement: read-only, its members at closure, oldest first', async () => {
    const { service, lifecycle } = fakes();
    expect(await service.closedWorld('token', WORLD)).toEqual({
      outcome: 'ALLOW',
      world: { worldId: WORLD, name: 'Our Lantern', members: [{ name: 'Amal', self: true }] },
      materials: [
        { materialId: MATERIAL, producer: 'SELF', authorName: null, text: 'mine', establishedAt: AT },
        { materialId: MATERIAL_2, producer: 'QANDEEL', authorName: null, text: 'qandeel', establishedAt: AT },
      ],
      hasOlder: false,
    });
    expect(await service.closedWorld('token', OTHER_WORLD)).toEqual({ outcome: 'UNAVAILABLE' });
    expect(lifecycle.closedMaterial).toHaveBeenCalledTimes(1);
    await expect(service.closedWorld('token', WORLD, MATERIAL, 'yesterday')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists only the reader\'s own former words and deletes through the owner authority', async () => {
    const { service, lifecycle } = fakes();
    expect(await service.ownMaterial('token')).toEqual({ materials: [{ materialId: MATERIAL, worldId: WORLD, text: 'my old words', establishedAt: AT }], hasOlder: false });
    expect(await service.deleteOwnMaterial('token', WORLD, MATERIAL, { commandId: COMMAND })).toEqual({ outcome: 'DELETED' });
    expect(lifecycle.deleteOwnFormer).toHaveBeenCalledWith('token', COMMAND, WORLD, MATERIAL);
    expect(await service.deleteOwnMaterial('token', WORLD, 'nope', { commandId: COMMAND })).toEqual({ outcome: 'UNAVAILABLE' });
  });

  it('classifies every lifecycle route with the existing classes: proposals strict, the rest authenticated', () => {
    for (const route of ['POST /shared/worlds/:worldId/proposals/settings', 'POST /shared/worlds/:worldId/proposals/removal',
      'POST /shared/worlds/:worldId/proposals/end', 'POST /shared/worlds/:worldId/history-shares', 'POST /shared/worlds/:worldId/proposals/member']) {
      expect(ROUTE_RATE_LIMIT_CENSUS[route]).toBe('SECURITY_SENSITIVE');
    }
    for (const route of ['GET /shared/worlds/:worldId/manage', 'POST /shared/worlds/:worldId/leave', 'POST /shared/worlds/:worldId/proposals/:proposalId/approve',
      'POST /shared/worlds/:worldId/history-shares/:packageId/approve', 'GET /shared/closed/:worldId', 'GET /shared/own-material',
      'POST /shared/own-material/:worldId/:materialId/delete', 'POST /shared/membership-requests/:worldId/:requestId/accept',
      'GET /shared/own-material/history-shares', 'POST /shared/own-material/history-shares/:worldId/:packageId/approve',
      'GET /shared/worlds/:worldId/history-shares/candidates/:memberHandle/before/:materialId/:establishedAt']) {
      expect(ROUTE_RATE_LIMIT_CENSUS[route]).toBe('AUTHENTICATED');
    }
  });
});
