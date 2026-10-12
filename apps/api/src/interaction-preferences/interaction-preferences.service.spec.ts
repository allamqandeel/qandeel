import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { InteractionPreferencesService } from './interaction-preferences.service';
import type { InteractionPreferencesRepository } from './interaction-preferences.repository';
import { DEFAULT_INTERACTION_PREFERENCES } from './interaction-preferences.types';

const SELF_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const UNATTRIBUTED_ID = '33333333-3333-4333-8333-333333333333';
const EXPIRED_ID = '44444444-4444-4444-8444-444444444444';
const UNREADABLE_ID = '55555555-5555-4555-8555-555555555555';
const ENGLISH_ID = '66666666-6666-4666-8666-666666666666';

const row = (over: Record<string, unknown> = {}) => ({ reply_length: 'DEFAULT', reply_language: 'DEFAULT', humour: 'DEFAULT', explanation_style: 'DEFAULT', version: 0, ...over });
const memory = (id: string, content: string, subject: 'SELF' | 'OTHER' | null, over: Record<string, unknown> = {}) => ({
  id, content, status: 'ACTIVE', type: 'INTERACTION_PREFERENCE', expires_at: null, updated_at: '2026-10-01T00:00:00Z',
  memory_subject_attributions: subject === null ? null : { subject }, ...over,
});

describe('IP-IMP-01 — InteractionPreferencesService', () => {
  let repository: { read: jest.Mock; set: jest.Mock; applyLegacy: jest.Mock; legacyMemories: jest.Mock };
  let service: InteractionPreferencesService;

  beforeEach(() => {
    repository = { read: jest.fn().mockResolvedValue([]), set: jest.fn(), applyLegacy: jest.fn(), legacyMemories: jest.fn().mockResolvedValue([]) };
    service = new InteractionPreferencesService(repository as unknown as InteractionPreferencesRepository);
  });

  describe('the per-turn read (WP4): absent is "no declaration"; anything doubtful fails closed', () => {
    it('no row is the legitimate all-DEFAULT record at version 0', async () => {
      await expect(service.readForTurn('token', 'user')).resolves.toEqual({ preferences: DEFAULT_INTERACTION_PREFERENCES, version: 0 });
      expect(repository.read).toHaveBeenCalledWith('token', 'user');
    });

    it('a stored row is read exactly', async () => {
      repository.read.mockResolvedValue([row({ reply_language: 'ENGLISH', humour: 'WELCOME', version: 4 })]);
      await expect(service.readForTurn('token', 'user')).resolves.toEqual({
        preferences: { replyLength: 'DEFAULT', replyLanguage: 'ENGLISH', humour: 'WELCOME', explanationStyle: 'DEFAULT' }, version: 4,
      });
    });

    it.each([
      ['an upstream failure', () => Promise.reject(new DataApiError(503))],
      ['a timeout', () => Promise.reject(new ServiceUnavailableException())],
      ['a non-array answer', () => Promise.resolve({})],
      ['two rows', () => Promise.resolve([row(), row()])],
      ['an unknown value', () => Promise.resolve([row({ humour: 'SARCASTIC' })])],
      ['a missing value', () => Promise.resolve([{ ...row(), explanation_style: undefined }])],
      ['a malformed version', () => Promise.resolve([row({ version: -1 })])],
      ['a string version', () => Promise.resolve([row({ version: '1' })])],
    ])('%s is never read as DEFAULT: it throws', async (_name, answer) => {
      repository.read.mockImplementation(answer);
      await expect(service.readForTurn('token', 'user')).rejects.toBeDefined();
    });
  });

  describe('the conversation command plan (WP2)', () => {
    it('plans against the version it read, with the reply for every outcome the database may commit', async () => {
      repository.read.mockResolvedValue([row({ version: 7 })]);
      await expect(service.planCommand('token', 'user', { field: 'REPLY_LANGUAGE', value: 'EGYPTIAN_ARABIC', language: 'ar' })).resolves.toEqual({
        field: 'REPLY_LANGUAGE', value: 'EGYPTIAN_ARABIC', expectedVersion: 7,
        replyIfSaved: 'تم حفظ التفضيل. اللغة واللهجة: مصري.',
        replyIfUnchanged: 'تم حفظ التفضيل. اللغة واللهجة: مصري.',
        replyIfStale: 'لم يُحفظ التغيير. حاول مرة أخرى.',
      });
    });

    it('a failed read fails the plan (no acknowledgement can be produced)', async () => {
      repository.read.mockRejectedValue(new DataApiError(500));
      await expect(service.planCommand('token', 'user', { field: 'HUMOUR', value: 'DECLINED', language: 'en' })).rejects.toBeDefined();
    });
  });

  describe('Settings (WP5): one field, compare-and-set, the database decides', () => {
    it('sends exactly the chosen field and version and answers with the outcome and a fresh read', async () => {
      repository.set.mockResolvedValue([{ outcome: 'SAVED', version: 1 }]);
      repository.read.mockResolvedValue([row({ reply_length: 'ALWAYS_BRIEF', version: 1 })]);
      await expect(service.set('user', 'token', { field: 'REPLY_LENGTH', value: 'ALWAYS_BRIEF', expectedVersion: 0 })).resolves.toEqual({
        outcome: 'SAVED', preferences: { ...DEFAULT_INTERACTION_PREFERENCES, replyLength: 'ALWAYS_BRIEF' }, version: 1,
      });
      expect(repository.set).toHaveBeenCalledWith('token', 'REPLY_LENGTH', 'ALWAYS_BRIEF', 0);
    });

    it('a STALE answer is reported as such with the newer canonical value, never as saved', async () => {
      repository.set.mockResolvedValue([{ outcome: 'STALE', version: 3 }]);
      repository.read.mockResolvedValue([row({ humour: 'DECLINED', version: 3 })]);
      await expect(service.set('user', 'token', { field: 'HUMOUR', value: 'WELCOME', expectedVersion: 2 })).resolves.toEqual(expect.objectContaining({
        outcome: 'STALE', version: 3, preferences: expect.objectContaining({ humour: 'DECLINED' }),
      }));
    });

    it.each([
      [{ field: 'REPLY_LENGTH', value: 'ALWAYS_BRIEF' }],
      [{ field: 'REPLY_LENGTH', value: 'ALWAYS_BRIEF', expectedVersion: 0, userId: 'someone-else' }],
      [{ field: 'TONE', value: 'DEFAULT', expectedVersion: 0 }],
      [{ field: 'HUMOUR', value: 'ALWAYS_BRIEF', expectedVersion: 0 }],
      [{ field: 'REPLY_LANGUAGE', value: 'ARABIC', expectedVersion: 0 }],
      [{ field: 'REPLY_LENGTH', value: 'DEFAULT', expectedVersion: -1 }],
      [{ field: 'REPLY_LENGTH', value: 'DEFAULT', expectedVersion: 1.5 }],
      [null],
    ])('refuses an invalid request without touching the database: %j', async (body) => {
      await expect(service.set('user', 'token', body)).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.set).not.toHaveBeenCalled();
    });

    it('an upstream failure or a malformed outcome is one sanitized 503', async () => {
      repository.set.mockResolvedValue([{ outcome: 'MAYBE' }]);
      await expect(service.set('user', 'token', { field: 'HUMOUR', value: 'WELCOME', expectedVersion: 0 })).rejects.toBeInstanceOf(ServiceUnavailableException);
      repository.set.mockRejectedValue(new DataApiError(500));
      await expect(service.set('user', 'token', { field: 'HUMOUR', value: 'WELCOME', expectedVersion: 0 })).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('the optional legacy review (WP3): confirmed SELF only, no backfill, the Memory never changed', () => {
    it('an empty list is a legitimate answer', async () => {
      await expect(service.legacyReview('user', 'token')).resolves.toEqual({ preferences: DEFAULT_INTERACTION_PREFERENCES, version: 0, candidates: [] });
    });

    it('offers only the owner\'s ACTIVE, unexpired SELF Memories that state an approved value the record does not hold', async () => {
      repository.read.mockResolvedValue([row({ reply_language: 'ENGLISH', version: 2 })]);
      repository.legacyMemories.mockResolvedValue([
        memory(SELF_ID, 'كلمني بالمصري.', 'SELF'),
        memory(OTHER_ID, 'Speak to me in Gulf Arabic.', 'OTHER'),
        memory(UNATTRIBUTED_ID, 'Speak to me in Levantine Arabic.', null),
        memory(EXPIRED_ID, 'كلمني بالفصحى.', 'SELF', { expires_at: '2020-01-01T00:00:00Z' }),
        memory(UNREADABLE_ID, 'Speak to me in Arabic.', 'SELF'),
        memory(ENGLISH_ID, 'Speak to me in English.', 'SELF'),
      ]);
      const review = await service.legacyReview('user', 'token');
      expect(review.candidates).toEqual([
        { memoryId: SELF_ID, statement: 'كلمني بالمصري.', field: 'REPLY_LANGUAGE', value: 'EGYPTIAN_ARABIC', replacesCurrent: true },
      ]);
      expect(repository.set).not.toHaveBeenCalled();
      expect(repository.applyLegacy).not.toHaveBeenCalled();
    });

    it('adopting derives the value on the server from the Memory itself and lets the database re-validate it', async () => {
      repository.legacyMemories.mockResolvedValue([memory(SELF_ID, 'Speak to me in English.', 'SELF')]);
      repository.applyLegacy.mockResolvedValue([{ outcome: 'SAVED', version: 1 }]);
      repository.read.mockResolvedValue([row({ reply_language: 'ENGLISH', version: 1 })]);
      await expect(service.applyLegacy('user', 'token', { memoryId: SELF_ID, expectedVersion: 0 })).resolves.toEqual(expect.objectContaining({ outcome: 'SAVED', version: 1 }));
      expect(repository.legacyMemories).toHaveBeenCalledWith('token', 'user', [SELF_ID]);
      expect(repository.applyLegacy).toHaveBeenCalledWith('token', SELF_ID, 'REPLY_LANGUAGE', 'ENGLISH', 0);
    });

    it.each([
      ['an OTHER Memory', memory(OTHER_ID, 'Speak to me in English.', 'OTHER')],
      ['an UNATTRIBUTED Memory', memory(UNATTRIBUTED_ID, 'Speak to me in English.', null)],
      ['a forgotten Memory', memory(SELF_ID, 'Speak to me in English.', 'SELF', { status: 'DELETED' })],
      ['a Memory naming no approved value', memory(SELF_ID, 'Speak to me in Arabic.', 'SELF')],
    ])('%s is NOT_ELIGIBLE and nothing is written', async (_name, found) => {
      repository.legacyMemories.mockResolvedValue([found]);
      await expect(service.applyLegacy('user', 'token', { memoryId: SELF_ID, expectedVersion: 0 })).resolves.toEqual(expect.objectContaining({ outcome: 'NOT_ELIGIBLE' }));
      expect(repository.applyLegacy).not.toHaveBeenCalled();
    });

    it('refuses a request that names a value or an account', async () => {
      await expect(service.applyLegacy('user', 'token', { memoryId: SELF_ID, expectedVersion: 0, value: 'ENGLISH' })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.applyLegacy('user', 'token', { memoryId: 'not-a-uuid', expectedVersion: 0 })).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
