// S8B-03 (CP1, E8, A16) — spoken Memory commands by band (§4.9.4), on the real Memory-control boundary with the real
// interpreter and evaluator. Only the owner-scoped reads are replaced. The database (finalize v2, migration 0186) enforces
// the same table and is proven against real PostgreSQL by database/verify-migration-0186.mjs (V-MC1 ... V-MC8).
import { MemoryControlService } from './memory-control.service';
import type { MemoryControlRepository } from './memory-control.repository';
import { MemoryWriteEvaluatorService } from './memory-write-evaluator.service';
import {
  clarificationReply, forgottenReply, notHeardClearlyReply, voiceCorrectionQuestion, voiceDisableQuestion, voiceForgetQuestion,
} from './memory-control.copy';
import type { MemoryCommandVoiceSource, PendingMemoryClarification, PendingSubjectClarification } from './memory-control.types';
import type { MemoryRecord } from './memory.types';

const USER = 'aaaaaaaa-0000-4000-8000-000000000001';
const SESSION = '5e55a000-0000-4000-8000-000000000001';
const TURN = 'cccccccc-0000-4000-8000-000000000001';
const COMMAND = 'dddddddd-0000-4000-8000-000000000001';

function memory(id: string, content: string, overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id, user_id: USER, scope: 'USER', type: 'PERSONAL_FACT', content, source: 'USER_STATED', confidence: 0.95, importance: 0.65,
    status: 'ACTIVE', version: 1, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z',
    expires_at: null, supersedes_memory_id: null, subject: 'SELF', ...overrides,
  };
}

const COFFEE = memory('3e3e3e3e-0000-4000-8000-000000000001', 'أنا بحب كافيه النيل');
const TEA = memory('3e3e3e3e-0000-4000-8000-000000000002', 'أنا بحب الشاي');
const OCTOBER = memory('3e3e3e3e-0000-4000-8000-000000000003', 'أنا ساكن في أكتوبر');

function setup(rows: MemoryRecord[], pending: {
  clarification?: PendingMemoryClarification; subject?: PendingSubjectClarification;
} = {}) {
  const repository = {
    listControllable: jest.fn().mockResolvedValue(rows),
    findOwned: jest.fn().mockImplementation(async (_t: string, _u: string, ids: readonly string[]) => rows.filter((row) => ids.includes(row.id))),
    findPendingClarification: jest.fn().mockResolvedValue(pending.clarification),
    findPendingSubjectClarification: jest.fn().mockResolvedValue(pending.subject),
    findPendingCorrectionSubjectClarification: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<MemoryControlRepository>;
  return { repository, service: new MemoryControlService(repository, new MemoryWriteEvaluatorService()) };
}

function turn(content: string, source?: MemoryCommandVoiceSource) {
  const readVoiceSource = source ? jest.fn().mockResolvedValue(source) : undefined;
  return {
    readVoiceSource,
    turn: { accessToken: 'token', userId: USER, sessionId: SESSION, sourceTurnId: TURN, content, ...(readVoiceSource ? { readVoiceSource } : {}) },
  };
}

const voice = (band: 'HIGH' | 'MEDIUM' | 'LOW', origin: 'HIGH' | 'MEDIUM' | 'LOW' | null = band): MemoryCommandVoiceSource => ({ turnBand: band, originBand: origin });
const typed = (origin: 'HIGH' | 'MEDIUM' | 'LOW' | null = null): MemoryCommandVoiceSource => ({ turnBand: null, originBand: origin });

describe('S8B-03 spoken Memory commands (E8, §4.9.4)', () => {
  it('an ordinary turn reads no voice source at all', async () => {
    const { service } = setup([COFFEE]);
    const { turn: t, readVoiceSource } = turn('النهارده كان يوم طويل', voice('HIGH'));
    await expect(service.plan(t)).resolves.toBeNull();
    expect(readVoiceSource).not.toHaveBeenCalled();
  });

  it('a typed command is planned exactly as before (no reader, or a typed source)', async () => {
    const { service } = setup([COFFEE]);
    const before = await service.plan(turn('انسى إني بحب كافيه النيل.').turn);
    const after = await service.plan(turn('انسى إني بحب كافيه النيل.', typed()).turn);
    expect(before).toEqual({ kind: 'FORGET', outcome: 'FORGOTTEN', targetMemoryId: COFFEE.id, candidateMemoryIds: [],
      reply: forgottenReply('ar', COFFEE.content), replyIfChanged: expect.any(String) });
    expect(after).toEqual(before);
  });

  it.each([['HIGH', 0.90], ['MEDIUM', 0.75]] as const)('REMEMBER from %s is REMEMBERED at the band score %s', async (band, score) => {
    const { service } = setup([]);
    const { turn: t, readVoiceSource } = turn('افتكر إني بحب القهوة', voice(band));
    const plan = await service.plan(t);
    expect(readVoiceSource).toHaveBeenCalledWith(undefined);
    expect(plan).toMatchObject({ kind: 'REMEMBER', outcome: 'REMEMBERED', subject: 'SELF', newMemory: { confidence: score } });
  });

  it.each([
    ['افتكر إني بحب القهوة', 'REMEMBER'],
    ['انسى إني بحب كافيه النيل.', 'FORGET'],
    ['متعتمدش على إني بحب الشاي', 'DISABLE'],
    ['أنا مش ساكن في أكتوبر، أنا ساكن في طنطا.', 'CORRECT'],
  ] as const)('LOW: «%s» changes nothing - NOT_HEARD_CLEARLY with C-54', async (content, kind) => {
    const { service } = setup([COFFEE, TEA, OCTOBER]);
    await expect(service.plan(turn(content, voice('LOW')).turn)).resolves.toEqual({
      kind, outcome: 'NOT_HEARD_CLEARLY', candidateMemoryIds: [], reply: notHeardClearlyReply('ar'),
    });
  });

  it('LOW: an inspection still answers (read only)', async () => {
    const { service } = setup([COFFEE]);
    await expect(service.plan(turn('إيه اللي فاكره عني؟', voice('LOW')).turn)).resolves.toMatchObject({ kind: 'INSPECT', outcome: 'INSPECTED' });
  });

  it.each(['HIGH', 'MEDIUM'] as const)('a spoken FORGET from %s is never executed: it asks the C-55 confirmation', async (band) => {
    const { service } = setup([COFFEE]);
    await expect(service.plan(turn('انسى إني بحب كافيه النيل.', voice(band)).turn)).resolves.toEqual({
      kind: 'FORGET', outcome: 'CLARIFICATION_REQUIRED', candidateMemoryIds: [COFFEE.id], reply: voiceForgetQuestion('ar', COFFEE.content),
    });
  });

  it('a spoken DISABLE asks the C-56 confirmation', async () => {
    const { service } = setup([TEA]);
    await expect(service.plan(turn('متعتمدش على إني بحب الشاي', voice('HIGH')).turn)).resolves.toEqual({
      kind: 'DISABLE', outcome: 'CLARIFICATION_REQUIRED', candidateMemoryIds: [TEA.id], reply: voiceDisableQuestion('ar', TEA.content),
    });
  });

  it('a spoken CORRECT with one clear target is CORRECTED at the band score', async () => {
    const { service } = setup([OCTOBER]);
    await expect(service.plan(turn('أنا مش ساكن في أكتوبر، أنا ساكن في طنطا.', voice('MEDIUM')).turn))
      .resolves.toMatchObject({ kind: 'CORRECT', outcome: 'CORRECTED', targetMemoryId: OCTOBER.id, newMemory: { confidence: 0.75 } });
  });

  it('a several-option question from a voice turn is the existing clarification, unchanged', async () => {
    const other = memory('3e3e3e3e-0000-4000-8000-000000000004', 'أنا ساكن في أكتوبر جنب الجامعة');
    const { service } = setup([OCTOBER, other]);
    const plan = await service.plan(turn('أنا مش ساكن في أكتوبر، أنا ساكن في طنطا.', voice('HIGH')).turn);
    expect(plan).toMatchObject({ kind: 'CORRECT', outcome: 'CLARIFICATION_REQUIRED' });
    expect(plan?.candidateMemoryIds).toHaveLength(2);
    expect(plan?.reply).toBe(clarificationReply('ar', [OCTOBER.content, other.content], false, ['SELF', 'SELF']));
  });

  describe('answers to a question', () => {
    const forgetQuestion: PendingMemoryClarification = { commandId: COMMAND, kind: 'FORGET', candidateMemoryIds: [COFFEE.id], clarifiedTurnContent: 'انسى إني بحب كافيه النيل.' };

    it.each([
      ['typed', typed('HIGH')],
      ['HIGH', voice('HIGH')],
    ] as const)('a %s «أيوه» executes the confirmed FORGET', async (_name, source) => {
      const { service } = setup([COFFEE], { clarification: forgetQuestion });
      const { turn: t, readVoiceSource } = turn('أيوه', source);
      await expect(service.plan(t)).resolves.toMatchObject({ kind: 'FORGET', outcome: 'FORGOTTEN', targetMemoryId: COFFEE.id, answersCommandId: COMMAND });
      expect(readVoiceSource).toHaveBeenCalledWith(COMMAND);
    });

    it.each(['MEDIUM', 'LOW'] as const)('a %s answer is not accepted: nothing changes (C-54)', async (band) => {
      const { service } = setup([COFFEE], { clarification: forgetQuestion });
      await expect(service.plan(turn('أيوه', voice(band, 'HIGH')).turn)).resolves.toEqual({
        kind: 'FORGET', outcome: 'NOT_HEARD_CLEARLY', candidateMemoryIds: [], reply: notHeardClearlyReply('ar'),
      });
    });

    it('a typed answer to a voice REMEMBER question keeps that message\'s words at its band score', async () => {
      const { service } = setup([], { subject: { commandId: COMMAND, clarifiedTurnContent: 'افتكر إن سلمى بتحب الرسم' } });
      await expect(service.plan(turn('عن أختي', typed('MEDIUM')).turn)).resolves.toMatchObject({
        kind: 'REMEMBER', outcome: 'REMEMBERED', answersCommandId: COMMAND, newMemory: { confidence: 0.75 },
      });
    });
  });

  it('C-57 shows the old and the new words together (Copy Gate, verbatim)', () => {
    expect(voiceCorrectionQuestion('ar', 'أنا ساكن في أكتوبر', 'أنا ساكن في طنطا')).toBe('هل المقصود تصحيح «أنا ساكن في أكتوبر» إلى «أنا ساكن في طنطا»؟');
    expect(voiceCorrectionQuestion('en', 'I live in Giza', 'I live in Tanta')).toBe('Should I change “I live in Giza” to “I live in Tanta”?');
  });

  it('C-54 ... C-56 are the approved bytes', () => {
    expect(notHeardClearlyReply('ar')).toBe('لم تكن الرسالة الصوتية واضحة بما يكفي لتنفيذ هذا الطلب، لذلك لم أغيّر شيئًا. يمكن كتابة الطلب أو تسجيله من جديد.');
    expect(notHeardClearlyReply('en')).toBe("The voice message wasn't clear enough to act on this request, so I haven't changed anything. The request can be typed or recorded again.");
    expect(voiceForgetQuestion('ar', 'x')).toBe('هل المقصود نسيان «x»؟');
    expect(voiceForgetQuestion('en', 'x')).toBe('Should I forget “x”?');
    expect(voiceDisableQuestion('ar', 'x')).toBe('هل المقصود التوقف عن الاعتماد على «x»؟');
    expect(voiceDisableQuestion('en', 'x')).toBe('Should I stop relying on “x”?');
  });
});
