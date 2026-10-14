import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError } from '../conversation/supabase-data-api.service';
import type { IntroductionsPreparationRepository } from './introductions-preparation.repository';
import { IntroductionsPreparationService } from './introductions-preparation.service';
import type { OnboardingPhrasingPort } from './onboarding-phrasing.port';

// S6-01 — the API boundary of the owner's preparation: exact request shapes, strict decoding (doubt fails closed),
// the consent-gated prior-item read, no phrasing call to any provider, no content in errors.

const ID = '11111111-1111-4111-8111-111111111111';
const MEMORY = '22222222-2222-4222-8222-222222222222';
const recordAnswer = (over: Record<string, unknown> = {}) => ({
  availability: { preparation: true, assistance: true, enrollment: false },
  accountDeletionPending: false,
  assistance: { consent: 'NOT_GRANTED', grantedVersion: null, currentVersion: 'MATCHING_ONBOARDING_ASSISTANCE_V1' },
  draft: null,
  ...over,
});
const draftAnswer = {
  version: 3,
  facts: { firstName: { value: 'سارة', state: 'CONFIRMED' }, sex: { value: 'FEMALE', state: 'DECLARED' }, birthYearMonth: null, area: null, maritalStatus: null },
  profile: { shortIntroduction: null, workField: null },
  requirements: { hard: { answer: null, items: [] }, soft: { answer: null, items: [] }, discrepancies: [] },
  notes: [], priorUnderstandingDecisions: 0, skippedSteps: [], review: { state: 'NOT_REVIEWED', reviewedVersion: null },
};

describe('S6-01 — IntroductionsPreparationService', () => {
  let repository: Record<keyof IntroductionsPreparationRepository, jest.Mock>;
  let phrasing: { phrase: jest.Mock };
  let service: IntroductionsPreparationService;

  beforeEach(() => {
    repository = {
      availability: jest.fn().mockResolvedValue([{ preparation_available: true, assistance_available: false, enrollment_available: false, has_draft: false }]),
      read: jest.fn().mockResolvedValue(recordAnswer()),
      priorItems: jest.fn().mockResolvedValue([]),
      command: jest.fn().mockResolvedValue({ outcome: 'APPLIED', version: 1 }),
      discard: jest.fn().mockResolvedValue({ outcome: 'DISCARDED', version: 0 }),
      grantAssistance: jest.fn().mockResolvedValue({ outcome: 'GRANTED' }),
      revokeAssistance: jest.fn().mockResolvedValue({ outcome: 'REVOKED' }),
    } as unknown as Record<keyof IntroductionsPreparationRepository, jest.Mock>;
    phrasing = { phrase: jest.fn().mockReturnValue({ binding: 'UNBOUND' }) };
    service = new IntroductionsPreparationService(repository as unknown as IntroductionsPreparationRepository, phrasing as unknown as OnboardingPhrasingPort);
  });

  describe('reads', () => {
    it('availability: enrollment is never available, whatever the database is asked', async () => {
      await expect(service.availability('t')).resolves.toEqual({ preparation: true, assistance: false, enrollment: false, hasDraft: false });
      repository.availability.mockResolvedValue([{ preparation_available: true, assistance_available: true, enrollment_available: true, has_draft: false }]);
      await expect(service.availability('t')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('without the permission the prior-item reader is never asked, and the plan is the NEW path', async () => {
      const view = await service.view('t');
      expect(repository.priorItems).not.toHaveBeenCalled();
      expect(view.priorItems).toEqual([]);
      expect(view.plan.path).toBe('NEW');
      expect(view.plan.next).toEqual({ kind: 'OFFER_ASSISTANCE' });
      expect(view.phrasing).toBe('UNBOUND');
    });

    it('with the permission the reader is asked, and its items are decoded exactly as stored', async () => {
      repository.read.mockResolvedValue(recordAnswer({ assistance: { consent: 'GRANTED', grantedVersion: 'MATCHING_ONBOARDING_ASSISTANCE_V1', currentVersion: 'MATCHING_ONBOARDING_ASSISTANCE_V1' } }));
      repository.priorItems.mockResolvedValue([{ memory_id: MEMORY, memory_type: 'GOAL', content: 'هدفي أن أتزوج', recency: 'CURRENT', stated_at: '2026-10-01T00:00:00Z' }]);
      const view = await service.view('t');
      expect(view.priorItems).toEqual([{ memoryId: MEMORY, itemClass: 'GOAL', words: 'هدفي أن أتزوج', recency: 'CURRENT' }]);
      expect(view.plan.path).toBe('KNOWN');
      expect(view.plan.next).toMatchObject({ kind: 'CONFIRM_PRIOR_ITEM' });
    });

    it('the phrasing seam is UNBOUND and is the only thing consulted about wording', async () => {
      await service.view('t');
      expect(phrasing.phrase).toHaveBeenCalledTimes(1);
      expect(phrasing.phrase.mock.results[0].value).toEqual({ binding: 'UNBOUND' });
    });

    it.each([
      ['enrollment reported available', recordAnswer({ availability: { preparation: true, assistance: true, enrollment: true } })],
      ['an unknown consent state', recordAnswer({ assistance: { consent: 'MAYBE' } })],
      ['an unknown fact state', recordAnswer({ draft: { ...draftAnswer, facts: { ...draftAnswer.facts, sex: { value: 'FEMALE', state: 'GUESSED' } } } })],
      ['an inferred sex value', recordAnswer({ draft: { ...draftAnswer, facts: { ...draftAnswer.facts, sex: { value: 'UNKNOWN', state: 'CONFIRMED' } } } })],
      ['a malformed draft', recordAnswer({ draft: { version: 'x' } })],
      ['not an object', 'nope'],
    ])('a doubtful answer fails closed as 503 (%s)', async (_label, answer) => {
      repository.read.mockResolvedValue(answer);
      await expect(service.view('t')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('a doubtful prior item fails closed; a reader answering more than 12 items fails closed', async () => {
      repository.read.mockResolvedValue(recordAnswer({ assistance: { consent: 'GRANTED', grantedVersion: 'V', currentVersion: 'V' } }));
      repository.priorItems.mockResolvedValue([{ memory_id: MEMORY, memory_type: 'DERIVED_INSIGHT', content: 'x', recency: 'CURRENT' }]);
      await expect(service.view('t')).rejects.toBeInstanceOf(ServiceUnavailableException);
      repository.priorItems.mockResolvedValue(Array.from({ length: 13 }, () => ({ memory_id: MEMORY, memory_type: 'GOAL', content: 'x', recency: 'CURRENT' })));
      await expect(service.view('t')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('commands: exact shapes only', () => {
    const command = (kind: string, payload: unknown, over: Record<string, unknown> = {}) => ({ commandId: ID, expectedVersion: 0, kind, payload, ...over });

    it.each([
      ['SET_FACT', { fact: 'SEX', sex: 'FEMALE' }],
      ['SET_FACT', { fact: 'INTRODUCTION_FIRST_NAME', firstName: 'سارة' }],
      ['SET_FACT', { fact: 'BIRTH_YEAR_MONTH', year: 1996, month: 5 }],
      ['SET_FACT', { fact: 'BROAD_AREA', countryCode: 'EG', regionCode: 'EG-ALX' }],
      ['SET_FACT', { fact: 'MARITAL_STATUS', maritalStatus: 'CURRENTLY_MARRIED' }],
      ['CONFIRM_FACT', { fact: 'SEX' }],
      ['SET_PROFILE', { shortIntroduction: null, workField: 'EDUCATION' }],
      ['SET_REQUIREMENTS', { strength: 'HARD', answer: 'NONE_ADDITIONAL', items: [] }],
      ['SET_REQUIREMENTS', { strength: 'SOFT', answer: 'ITEMS', items: [{ dimension: 'AGE_RANGE', min: 25, max: 35 }] }],
      ['ADD_NOTE', { kind: 'WHAT_MATTERS', body: 'الصدق' }],
      ['REMOVE_NOTE', { noteId: MEMORY }],
      ['RECORD_PRIOR_UNDERSTANDING', { memoryId: MEMORY, decision: 'CONFIRMED' }],
      ['RECORD_PRIOR_UNDERSTANDING', { memoryId: MEMORY, decision: 'CORRECTED', correctedBody: 'كلماتي' }],
      ['SKIP_STEP', { step: 'ASSISTANCE_OFFER' }],
      ['CONFIRM_REVIEW', {}],
    ])('%s %j reaches the database as sent', async (kind, payload) => {
      const result = await service.command('t', command(kind, payload));
      expect(result.outcome).toBe('APPLIED');
      expect(repository.command).toHaveBeenCalledWith('t', ID, 0, kind, payload);
    });

    it.each([
      ['an extra top-level field', command('SKIP_STEP', { step: 'NOTES' }, { userId: ID })],
      ['an account parameter in the payload', command('SET_FACT', { fact: 'SEX', sex: 'FEMALE', userId: ID })],
      ['an unknown kind', command('ENROLL', {})],
      ['an inferred sex', command('SET_FACT', { fact: 'SEX', sex: 'UNKNOWN' })],
      ['an unknown fact', command('SET_FACT', { fact: 'HEIGHT', value: 170 })],
      ['a non-integer year', command('SET_FACT', { fact: 'BIRTH_YEAR_MONTH', year: 1996.5, month: 5 })],
      ['an unknown work field', command('SET_PROFILE', { shortIntroduction: null, workField: 'ASTRONAUT' })],
      ['a mixed answer', command('SET_REQUIREMENTS', { strength: 'HARD', answer: 'NONE', items: [] })],
      ['an unknown dimension', command('SET_REQUIREMENTS', { strength: 'HARD', answer: 'ITEMS', items: [{ dimension: 'RELIGIOSITY' }] })],
      ['too many items', command('SET_REQUIREMENTS', { strength: 'SOFT', answer: 'ITEMS', items: [1, 2, 3, 4].map(() => ({ dimension: 'AGE_RANGE' })) })],
      ['a corrected body on a confirmation', command('RECORD_PRIOR_UNDERSTANDING', { memoryId: MEMORY, decision: 'CONFIRMED', correctedBody: 'x' })],
      ['a bad memory id', command('RECORD_PRIOR_UNDERSTANDING', { memoryId: 'm1', decision: 'DECLINED' })],
      ['an oversized text', command('ADD_NOTE', { kind: 'ABOUT_ME', body: 'x'.repeat(1001) })],
      ['a negative version', command('CONFIRM_REVIEW', {}, { expectedVersion: -1 })],
      ['a bad command id', command('CONFIRM_REVIEW', {}, { commandId: 'abc' })],
      ['a payload on review', command('CONFIRM_REVIEW', { force: true })],
    ])('refused with 400 before the database (%s)', async (_label, body) => {
      await expect(service.command('t', body)).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.command).not.toHaveBeenCalled();
    });

    it('a database 22023 refusal is a 400 that names nothing; any other failure a sanitized 503', async () => {
      repository.command.mockRejectedValueOnce(new DataApiError(400));
      const refusal = await service.command('t', command('SKIP_STEP', { step: 'NOTES' })).catch((e: unknown) => e);
      expect(refusal).toBeInstanceOf(BadRequestException);
      expect((refusal as BadRequestException).getResponse()).toEqual({ outcome: 'INVALID_REQUEST' });
      repository.command.mockRejectedValueOnce(new DataApiError(500));
      const failure = await service.command('t', command('SKIP_STEP', { step: 'NOTES' })).catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(ServiceUnavailableException);
      expect((failure as ServiceUnavailableException).getResponse()).toEqual({ outcome: 'UNAVAILABLE' });
    });

    it('every database outcome is returned as it is; an unknown one fails closed', async () => {
      for (const outcome of ['STALE_VERSION', 'UNAVAILABLE', 'ACCOUNT_DELETION_PENDING', 'COMMAND_ID_REUSED', 'NOT_ELIGIBLE', 'NOT_READY_FOR_REVIEW']) {
        repository.command.mockResolvedValueOnce({ outcome });
        await expect(service.command('t', command('SKIP_STEP', { step: 'NOTES' }))).resolves.toMatchObject({ outcome });
      }
      repository.command.mockResolvedValueOnce({ outcome: 'ENROLLED' });
      await expect(service.command('t', command('SKIP_STEP', { step: 'NOTES' }))).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('consent and discard', () => {
    it('grant names the exact consent version; revoke and discard take only a command id', async () => {
      await expect(service.grantAssistance('t', { commandId: ID, consentVersion: 'MATCHING_ONBOARDING_ASSISTANCE_V1' })).resolves.toMatchObject({ outcome: 'GRANTED' });
      expect(repository.grantAssistance).toHaveBeenCalledWith('t', ID, 'MATCHING_ONBOARDING_ASSISTANCE_V1');
      await expect(service.revokeAssistance('t', { commandId: ID })).resolves.toMatchObject({ outcome: 'REVOKED' });
      await expect(service.discard('t', { commandId: ID })).resolves.toMatchObject({ outcome: 'DISCARDED' });
      await expect(service.grantAssistance('t', { commandId: ID })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.grantAssistance('t', { commandId: ID, consentVersion: 'v1; drop' })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.revokeAssistance('t', { commandId: ID, consentVersion: 'X' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
