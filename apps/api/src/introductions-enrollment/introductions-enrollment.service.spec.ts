import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataApiError } from '../conversation/supabase-data-api.service';
import type { IntroductionsEnrollmentRepository } from './introductions-enrollment.repository';
import { ENROLLMENT_OUTCOMES, IntroductionsEnrollmentService } from './introductions-enrollment.service';

// S6-07 (CP1) — the API boundary of the governed enrollment (migration 0165): the exact request shape (no user id, no
// profile field, no requirement, no fact), strict decoding of every answer (doubt fails closed as one sanitized 503),
// the database's 22023 kept a 400, and nothing decided here that the database did not answer.

const ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'caller-token';
const TEXT = (version: string) => ({ version, textAr: 'نص', textEn: 'text' });
const viewAnswer = (over: Record<string, unknown> = {}) => ({
  available: false,
  accountDeletionPending: false,
  consents: { participation: null, contextGrant: null, disclosureAuthority: null },
  setup: { participationState: 'OFF', pauseReason: null, contextGrant: false, disclosureAuthority: false, matchable: false },
  enrollment: null,
  ...over,
});
const enrollBody = (over: Record<string, unknown> = {}) => ({
  commandId: ID, kind: 'ENROLL', expectedDraftVersion: 14,
  consents: { participation: 'PARTICIPATION_V1', contextGrant: 'CONTEXT_V1', disclosureAuthority: 'DISCLOSURE_V1' },
  ...over,
});

describe('S6-07 CP1 — IntroductionsEnrollmentService', () => {
  let repository: Record<keyof IntroductionsEnrollmentRepository, jest.Mock>;
  let service: IntroductionsEnrollmentService;

  beforeEach(() => {
    repository = {
      read: jest.fn().mockResolvedValue(viewAnswer()),
      act: jest.fn().mockResolvedValue([{ outcome: 'NOT_AVAILABLE_NOW', participation_state: null, matchable: null }]),
    };
    service = new IntroductionsEnrollmentService(repository as unknown as IntroductionsEnrollmentRepository);
  });

  it('reads the caller\'s own view on the caller\'s token, and decodes it exactly', async () => {
    repository.read.mockResolvedValue(viewAnswer({
      available: true,
      consents: { participation: TEXT('P_V1'), contextGrant: TEXT('C_V1'), disclosureAuthority: TEXT('D_V1') },
      setup: { participationState: 'ACTIVE', pauseReason: null, contextGrant: true, disclosureAuthority: true, matchable: true },
      enrollment: { enrolledDraftVersion: 14, lastAct: 'ENROLL', lastActAt: '2026-10-18T07:47:20.759455+00:00' },
    }));
    const view = await service.read(TOKEN);
    expect(repository.read).toHaveBeenCalledWith(TOKEN);
    expect(view).toEqual({
      available: true, accountDeletionPending: false,
      consents: { participation: TEXT('P_V1'), contextGrant: TEXT('C_V1'), disclosureAuthority: TEXT('D_V1') },
      setup: { participationState: 'ACTIVE', pauseReason: null, contextGrant: true, disclosureAuthority: true, matchable: true },
      enrollment: { enrolledDraftVersion: 14, lastAct: 'ENROLL', lastActAt: '2026-10-18T07:47:20.759455+00:00' },
    });
  });

  it.each([
    ['a missing field', { available: true }],
    ['an unknown participation state', viewAnswer({ setup: { participationState: 'MAYBE', pauseReason: null, contextGrant: false, disclosureAuthority: false, matchable: false } })],
    ['a non-boolean availability', viewAnswer({ available: 'yes' })],
    ['a malformed consent text', viewAnswer({ consents: { participation: { version: 'p_v1', textAr: 'x', textEn: 'y' }, contextGrant: null, disclosureAuthority: null } })],
    ['an extra consent field', viewAnswer({ consents: { participation: { ...TEXT('P_V1'), extra: 1 }, contextGrant: null, disclosureAuthority: null } })],
    ['an unknown act', viewAnswer({ enrollment: { enrolledDraftVersion: 1, lastAct: 'ADMIN', lastActAt: '2026-10-18T00:00:00Z' } })],
  ])('fails closed (503, nothing internal) on %s', async (_label, answer) => {
    repository.read.mockResolvedValue(answer);
    await expect(service.read(TOKEN)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('sends exactly the act, the reviewed draft version and the three consent versions - no account, field or fact', async () => {
    const answer = await service.act(TOKEN, enrollBody());
    expect(repository.act).toHaveBeenCalledWith(TOKEN, ID, 'ENROLL', 14,
      { participation: 'PARTICIPATION_V1', contextGrant: 'CONTEXT_V1', disclosureAuthority: 'DISCLOSURE_V1' });
    expect(answer.outcome).toBe('NOT_AVAILABLE_NOW');
    expect(repository.read).toHaveBeenCalledTimes(1);
    expect(answer.view.available).toBe(false);
  });

  it('passes a null draft version and null consents through for the acts that do not carry them', async () => {
    repository.act.mockResolvedValue([{ outcome: 'RECONFIRMED', participation_state: 'ACTIVE', matchable: true }]);
    await service.act(TOKEN, enrollBody({ kind: 'RECONFIRM_CONSENT', expectedDraftVersion: null,
      consents: { participation: null, contextGrant: 'CONTEXT_V2', disclosureAuthority: null } }));
    expect(repository.act).toHaveBeenCalledWith(TOKEN, ID, 'RECONFIRM_CONSENT', null,
      { participation: null, contextGrant: 'CONTEXT_V2', disclosureAuthority: null });
  });

  it.each([
    ['a user id', { ...enrollBody(), userId: ID }],
    ['a profile field', { ...enrollBody(), shortIntroduction: 'hello there' }],
    ['a missing consents object', { commandId: ID, kind: 'ENROLL', expectedDraftVersion: 1 }],
    ['an extra consent', enrollBody({ consents: { participation: 'A_V1', contextGrant: 'B_V1', disclosureAuthority: 'C_V1', onboarding: 'D_V1' } })],
    ['an unknown act', enrollBody({ kind: 'ADMIN_ENROLL' })],
    ['a malformed command id', enrollBody({ commandId: 'x' })],
    ['a zero draft version', enrollBody({ expectedDraftVersion: 0 })],
    ['a fractional draft version', enrollBody({ expectedDraftVersion: 1.5 })],
    ['a lower-case consent version', enrollBody({ consents: { participation: 'p_v1', contextGrant: 'B_V1', disclosureAuthority: 'C_V1' } })],
  ])('refuses %s as INVALID_REQUEST before any database call', async (_label, body) => {
    await expect(service.act(TOKEN, body)).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.act).not.toHaveBeenCalled();
  });

  it.each(ENROLLMENT_OUTCOMES.map((o) => [o]))('relays the database\'s own word %s', async (outcome) => {
    repository.act.mockResolvedValue([{ outcome, participation_state: null, matchable: null }]);
    expect((await service.act(TOKEN, enrollBody())).outcome).toBe(outcome);
  });

  it('fails closed on an unknown outcome, a second row or an extra column', async () => {
    for (const rows of [[{ outcome: 'ENROLLED_ANYWAY', participation_state: null, matchable: null }],
      [{ outcome: 'ENROLLED', participation_state: 'ACTIVE', matchable: true }, { outcome: 'ENROLLED', participation_state: 'ACTIVE', matchable: true }],
      [{ outcome: 'ENROLLED', participation_state: 'ACTIVE', matchable: true, user_id: ID }]]) {
      repository.act.mockResolvedValue(rows);
      await expect(service.act(TOKEN, enrollBody())).rejects.toBeInstanceOf(ServiceUnavailableException);
    }
  });

  it('keeps the database\'s 22023 a 400, and every other failure one sanitized 503', async () => {
    repository.act.mockRejectedValue(new DataApiError(400, { databaseCode: '22023', databaseMessage: 'MATCHING_ENROLLMENT_COMMAND_INVALID' }));
    await expect(service.act(TOKEN, enrollBody())).rejects.toBeInstanceOf(BadRequestException);
    for (const error of [new DataApiError(400, { databaseCode: '42501' }), new DataApiError(503), new Error('network')]) {
      repository.act.mockRejectedValue(error);
      const failure = await service.act(TOKEN, enrollBody()).catch((caught: unknown) => caught);
      expect(failure).toBeInstanceOf(ServiceUnavailableException);
      expect(JSON.stringify((failure as ServiceUnavailableException).getResponse())).toBe('{"outcome":"UNAVAILABLE"}');
    }
  });

  it('the module holds no service_role path and no AI or Conversation runtime', () => {
    for (const file of ['introductions-enrollment.repository.ts', 'introductions-enrollment.service.ts',
      'introductions-enrollment.controller.ts', 'introductions-enrollment.module.ts']) {
      const source = readFileSync(join(__dirname, file), 'utf8');
      expect(source).not.toMatch(/ServiceRole|service_role'|SUPABASE_SERVICE_ROLE|ModelRouter|model-router|conversation\.module|memory/u);
    }
    const repositorySource = readFileSync(join(__dirname, 'introductions-enrollment.repository.ts'), 'utf8');
    expect([...repositorySource.matchAll(/'rpc\/([a-z0-9_]+)'/gu)].map((m) => m[1]).sort())
      .toEqual(['enroll_my_matching_setup_v1', 'read_my_matching_enrollment_v1']);
  });
});
