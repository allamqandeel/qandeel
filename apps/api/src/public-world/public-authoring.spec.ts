import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ROUTE_RATE_LIMIT_CENSUS } from '../http-security/route-rate-limit.census';
import type { PublicAuthoringRepository } from './public-authoring.repository';
import { MAX_PACKAGE_SOURCES, PublicAuthoringService } from './public-authoring.service';

const TOKEN = 'reader-token';
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const COMMAND = id(1);
const EXPERIENCE = id(2);
const MANIFEST = id(3);

const currentRow = (ordinal: number, text: string, extra: Record<string, unknown> = {}) => ({
  review_state: 'CURRENT', current_lifecycle: 'DRAFT', version_ordinal: 1, manifest_version_id: MANIFEST, publisher_label_mode: 'REAL_NAME',
  publisher_display_label: 'Amal', item_count: 2, required_approver_count: 2, effective_approval_count: 1,
  own_approval_state: 'EFFECTIVE', ready_allowed: false, item_ordinal: ordinal,
  derivative_classification: 'SOURCE_CONTENT_BEARING_DERIVATIVE', public_text_body: text, ...extra,
});

function repository(overrides: Partial<Record<keyof PublicAuthoringRepository, jest.Mock>> = {}) {
  return {
    drafts: jest.fn(async () => [{ experience_id: EXPERIENCE, current_lifecycle: 'DRAFT', created_at: '2026-10-06T00:00:00Z', has_package: true, item_count: 2 }]),
    sources: jest.fn(async () => [
      { source_kind: 'PERSONAL', source_id: id(10), world_id: null, material_kind: null, established_at: 't', is_self: true, author_name: null, text_body: 'my words' },
      { source_kind: 'SHARED', source_id: id(11), world_id: id(12), material_kind: 'HUMAN_TEXT', established_at: 't', is_self: false, author_name: 'Hadir', text_body: 'her words' },
    ]),
    startDraft: jest.fn(async () => [{ outcome: 'CREATED', experience_id: EXPERIENCE, current_lifecycle: 'DRAFT' }]),
    preparePackage: jest.fn(async () => [{ outcome: 'PREPARED', item_count: 2, required_approver_count: 2 }]),
    review: jest.fn(async () => [currentRow(1, 'my words'), currentRow(2, 'her words')]),
    approvalRequests: jest.fn(async () => [
      { manifest_version_id: MANIFEST, request_state: 'CURRENT', current_lifecycle: 'DRAFT', publisher_label_mode: 'PSEUDONYM',
        publisher_display_label: 'nightlamp27', item_count: 3, own_item_count: 1, required_approver_count: 2,
        effective_approval_count: 0, own_approval_state: 'MISSING', item_ordinal: 2, public_text_body: 'her words' },
    ]),
    approve: jest.fn(async () => [{ outcome: 'APPROVED', own_approval_state: 'EFFECTIVE' }]),
    withdraw: jest.fn(async () => [{ outcome: 'WITHDRAWN' }]),
    ready: jest.fn(async () => [{ outcome: 'READY_FOR_REVIEW', current_lifecycle: 'READY_FOR_REVIEW' }]),
    ...overrides,
  };
}
const service = (repo = repository()) => new PublicAuthoringService(repo as unknown as PublicAuthoringRepository);

describe('S5-02 Public authoring — the caller supplies its own command and nothing it could forge', () => {
  it('starts a Draft from a fresh command id alone', async () => {
    const repo = repository();
    await expect(service(repo).startDraft(TOKEN, { commandId: COMMAND })).resolves.toEqual({ outcome: 'CREATED', experienceId: EXPERIENCE });
    expect(repo.startDraft).toHaveBeenCalledWith(TOKEN, COMMAND);
    for (const body of [{ commandId: COMMAND, label: 'a chosen label' }, { commandId: COMMAND, publicIdentityRef: id(9) },
      { commandId: COMMAND, userId: id(9) }, { commandId: 'not-a-uuid' }, {}, null, [], 'x']) {
      expect(() => service(repo).startDraft(TOKEN, body)).toThrow(BadRequestException);
    }
    expect(repo.startDraft).toHaveBeenCalledTimes(1);
  });

  it('prepares from 1–20 distinct existing sources, never from text, approvers or an audience', async () => {
    const repo = repository();
    await expect(service(repo).preparePackage(TOKEN, EXPERIENCE, { commandId: COMMAND, personal: [id(10)], shared: [{ worldId: id(12), materialId: id(11) }] }))
      .resolves.toEqual({ outcome: 'PREPARED', itemCount: 2, requiredApprovals: 2 });
    expect(repo.preparePackage).toHaveBeenCalledWith(TOKEN, COMMAND, EXPERIENCE, [id(10)], [id(12)], [id(11)]);
    const tooMany = Array.from({ length: MAX_PACKAGE_SOURCES + 1 }, (_, n) => id(100 + n));
    for (const body of [
      { commandId: COMMAND }, { commandId: COMMAND, personal: [], shared: [] }, { commandId: COMMAND, personal: tooMany },
      { commandId: COMMAND, personal: [id(10), id(10)] }, { commandId: COMMAND, personal: ['x'] },
      { commandId: COMMAND, personal: [id(10)], text: 'free text to publish' }, { commandId: COMMAND, personal: [id(10)], approvers: [id(9)] },
      { commandId: COMMAND, shared: [{ worldId: id(12), materialId: id(11), body: 'replaced words' }] },
      { commandId: COMMAND, shared: [{ materialId: id(11) }] }, { commandId: COMMAND, personal: [id(10)], audience: 'EVERYONE' },
    ]) {
      expect(() => service(repo).preparePackage(TOKEN, EXPERIENCE, body)).toThrow(BadRequestException);
    }
    await expect(service(repo).preparePackage(TOKEN, 'nope', { commandId: COMMAND, personal: [id(10)] }))
      .resolves.toEqual({ outcome: 'UNAVAILABLE', itemCount: null, requiredApprovals: null });
    expect(repo.preparePackage).toHaveBeenCalledTimes(1);
  });

  it('passes the bounded, non-enumerating refusals through unchanged', async () => {
    for (const outcome of ['UNAVAILABLE', 'NOT_PUBLISHABLE', 'STALE', 'NOT_DRAFT']) {
      const repo = repository({ preparePackage: jest.fn(async () => [{ outcome, item_count: null, required_approver_count: null }]) });
      await expect(service(repo).preparePackage(TOKEN, EXPERIENCE, { commandId: COMMAND, personal: [id(10)] }))
        .resolves.toEqual({ outcome, itemCount: null, requiredApprovals: null });
    }
    const odd = repository({ preparePackage: jest.fn(async () => [{ outcome: 'PUBLISHED', item_count: 1, required_approver_count: 0 }]) });
    await expect(service(odd).preparePackage(TOKEN, EXPERIENCE, { commandId: COMMAND, personal: [id(10)] })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('S5-02 controller review — exactly what would become public, whole or not at all', () => {
  it('renders the exact bytes, the CURRENT public display and bounded progress, and nothing sealed', async () => {
    const view = await service().review(TOKEN, EXPERIENCE);
    expect(view).toEqual({
      state: 'CURRENT', lifecycle: 'DRAFT', manifestId: MANIFEST, publisher: { mode: 'REAL_NAME', label: 'Amal' }, itemCount: 2, requiredApprovals: 2,
      effectiveApprovals: 1, ownApproval: 'EFFECTIVE', readyAllowed: false,
      items: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'my words' }, { ordinal: 2, kind: 'SOURCE_CONTENT', text: 'her words' }],
    });
    const { manifestId: _manifest, ...rest } = view as { manifestId?: string };
    expect(JSON.stringify(rest)).not.toMatch(/user|world|material|provenance|digest|fingerprint|session/iu);
  });

  it('is one neutral UNAVAILABLE for no row, an invalid id and a package that is no longer whole', async () => {
    await expect(service(repository({ review: jest.fn(async () => []) })).review(TOKEN, EXPERIENCE))
      .resolves.toEqual({ state: 'UNAVAILABLE', lifecycle: null, publisher: null });
    await expect(service().review(TOKEN, 'nope')).resolves.toEqual({ state: 'UNAVAILABLE', lifecycle: null, publisher: null });
    const dark = repository({ review: jest.fn(async () => [{ ...currentRow(0, ''), review_state: 'UNAVAILABLE', item_ordinal: null, public_text_body: null }]) });
    await expect(service(dark).review(TOKEN, EXPERIENCE)).resolves.toEqual({ state: 'UNAVAILABLE', lifecycle: 'DRAFT', publisher: { mode: 'REAL_NAME', label: 'Amal' } });
  });

  it('refuses to present a partial package as complete', async () => {
    const partial = repository({ review: jest.fn(async () => [currentRow(1, 'my words')]) });
    await expect(service(partial).review(TOKEN, EXPERIENCE)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('S5-02 content approval — the exact human, their own words, their own decision', () => {
  it('lists only the approver\'s own included words', async () => {
    await expect(service().approvalRequests(TOKEN)).resolves.toEqual({ requests: [{
      manifestId: MANIFEST, state: 'CURRENT', lifecycle: 'DRAFT', publisher: { mode: 'PSEUDONYM', label: 'nightlamp27' }, itemCount: 3,
      ownItemCount: 1, requiredApprovals: 2, effectiveApprovals: 0, ownApproval: 'MISSING', ownItems: [{ ordinal: 2, text: 'her words' }],
    }] });
  });

  it('approves and withdraws by command id alone, never naming an approver', async () => {
    const repo = repository();
    await expect(service(repo).approve(TOKEN, MANIFEST, { commandId: COMMAND })).resolves.toEqual({ outcome: 'APPROVED', ownApproval: 'EFFECTIVE' });
    expect(repo.approve).toHaveBeenCalledWith(TOKEN, COMMAND, MANIFEST);
    await expect(service(repo).withdraw(TOKEN, MANIFEST, { commandId: COMMAND })).resolves.toEqual({ outcome: 'WITHDRAWN' });
    for (const body of [{ commandId: COMMAND, approver: id(9) }, { commandId: COMMAND, userId: id(9) }, { approve: true }]) {
      expect(() => service(repo).approve(TOKEN, MANIFEST, body)).toThrow(BadRequestException);
      expect(() => service(repo).withdraw(TOKEN, MANIFEST, body)).toThrow(BadRequestException);
    }
    await expect(service(repo).approve(TOKEN, 'nope', { commandId: COMMAND })).resolves.toEqual({ outcome: 'UNAVAILABLE', ownApproval: null });
  });

  it('commits READY_FOR_REVIEW and nothing beyond it', async () => {
    await expect(service().ready(TOKEN, EXPERIENCE, { commandId: COMMAND })).resolves.toEqual({ outcome: 'READY_FOR_REVIEW', lifecycle: 'READY_FOR_REVIEW' });
    const incomplete = repository({ ready: jest.fn(async () => [{ outcome: 'APPROVALS_INCOMPLETE', current_lifecycle: 'DRAFT' }]) });
    await expect(service(incomplete).ready(TOKEN, EXPERIENCE, { commandId: COMMAND })).resolves.toEqual({ outcome: 'APPROVALS_INCOMPLETE', lifecycle: 'DRAFT' });
    const published = repository({ ready: jest.fn(async () => [{ outcome: 'PUBLISHED', current_lifecycle: 'PUBLISHED' }]) });
    await expect(service(published).ready(TOKEN, EXPERIENCE, { commandId: COMMAND })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('turns a transport failure into 503, never into a decision', async () => {
    const down = repository({ approve: jest.fn(async () => { throw new Error('down'); }) });
    await expect(service(down).approve(TOKEN, MANIFEST, { commandId: COMMAND })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('S5-02 sources — existing QANDEEL material only', () => {
  it('maps the caller\'s own Personal text and visible Shared text', async () => {
    await expect(service().sources(TOKEN)).resolves.toEqual({
      personal: [{ sourceId: id(10), text: 'my words', at: 't' }],
      shared: [{ worldId: id(12), materialId: id(11), producer: 'HUMAN', isSelf: false, authorName: 'Hadir', text: 'her words', at: 't' }],
    });
  });
});

describe('S5-02 routes', () => {
  it('are classified, the two that create durable state under the strict class', () => {
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /public/authoring']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /public/authoring/sources']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /public/authoring/drafts']).toBe('SECURITY_SENSITIVE');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /public/authoring/drafts/:experienceId/package']).toBe('SECURITY_SENSITIVE');
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /public/authoring/drafts/:experienceId/review']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /public/authoring/drafts/:experienceId/ready']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /public/authoring/approvals']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /public/authoring/approvals/:manifestId/approve']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /public/authoring/approvals/:manifestId/withdraw']).toBe('AUTHENTICATED');
    expect(Object.keys(ROUTE_RATE_LIMIT_CENSUS).filter((route) => /publish/u.test(route))).toEqual([]);
  });
});
