import { FakePersonalUnderstandingCaptureProvider } from './fake-personal-understanding-capture.provider';
import { capturableMessage, PersonalUnderstandingCaptureService } from './personal-understanding-capture.service';
import type { UnderstandingFactProposal } from './personal-understanding.types';

const NOW = new Date('2026-10-23T10:00:00.000Z');
const context = { executionId: 'e', sourceTurnId: 't', userId: 'u' } as never;
const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const fact = (span: string, overrides: Partial<UnderstandingFactProposal> = {}): UnderstandingFactProposal => ({
  span, subject: 'SELF', polarity: 'AFFIRMED', modality: 'STATED', temporal: 'CURRENT', type: 'PERSONAL_FACT', slot: null, keys: [], ...overrides,
});

function setup(backlog: Array<{ memoryId: string; type: never; content: string }> = [], current: Array<{ type: string; content: string }> = []) {
  const data = { listUnindexedMemories: jest.fn().mockResolvedValue(backlog), listCaptureScreenMemories: jest.fn().mockResolvedValue(current) };
  const provider = new FakePersonalUnderstandingCaptureProvider();
  return { data, provider, service: new PersonalUnderstandingCaptureService(data as never, provider) };
}

describe('S8A-03 CP2 capture pre-screen', () => {
  it.each([
    ['أنا ساكن في المعادي وبشتغل مهندس', true],
    ['I moved to Alexandria last month', true],
    ['ازيك عامل ايه النهارده', false],
    ['انسى إني ساكن في المعادي', false], // a Memory control command is the foreground's
    ['كلمة السر بتاعتي 1234', false], // a secret is never sent to a provider
    ['أنا', false],
    [`أنا ${'ا'.repeat(1_500)}`, false],
  ])('%s -> %s', (message, sent) => {
    expect(capturableMessage(message) !== null).toBe(sent);
  });
});

describe('PersonalUnderstandingCaptureService (S8A-03 CP2)', () => {
  it('plans nothing - no claim, no call - when the message states nothing and every Memory is indexed', async () => {
    const { service, data } = setup();
    await expect(service.prepare(context, 'ازيك عامل ايه', NOW)).resolves.toBeUndefined();
    expect(data.listUnindexedMemories).toHaveBeenCalledWith(context, 4);
    expect(data.listCaptureScreenMemories).not.toHaveBeenCalled();
  });

  it('plans backfill alone with opaque handles, never sending a secret-bearing Memory', async () => {
    const { service, data } = setup([
      { memoryId: ID(1), type: 'PERSONAL_FACT' as never, content: 'بشتغل مهندس.' },
      { memoryId: ID(2), type: 'PERSONAL_FACT' as never, content: 'رقم الحساب 1234.' },
      { memoryId: ID(3), type: 'GOAL' as never, content: 'عايز أتعلم ألماني.' },
    ]);
    const plan = await service.prepare(context, 'تمام', NOW);
    expect(plan).toEqual({ message: null, current: [], backlog: [
      { handle: 'm1', memoryId: ID(1), type: 'PERSONAL_FACT', content: 'بشتغل مهندس.' },
      { handle: 'm2', memoryId: ID(3), type: 'GOAL', content: 'عايز أتعلم ألماني.' },
    ] });
    expect(data.listCaptureScreenMemories).not.toHaveBeenCalled();
  });

  it('proposes, verifies and returns one bounded command; the provider sees handles, never Memory identities', async () => {
    const { service, provider } = setup(
      [{ memoryId: ID(1), type: 'PERSONAL_FACT' as never, content: 'بشتغل مهندس.' }],
      [{ type: 'STABLE_PREFERENCE', content: 'أنا بحب القهوة.' }],
    );
    provider.setOutput({
      facts: [
        fact('أنا ساكن في المعادي', { slot: 'RESIDENCE', keys: ['سكن'] }),
        fact('بيشتغل في بنك', { subject: 'OTHER' }),
        fact('أنا بحب القهوة', { type: 'STABLE_PREFERENCE' }),
      ],
      memories: [{ handle: 'm1', slot: 'OCCUPATION', temporal: 'CURRENT', keys: ['شغل', 'job'] }],
    });
    const plan = await service.prepare(context, 'أنا ساكن في المعادي، وأخويا بيشتغل في بنك، وأنا بحب القهوة', NOW);
    const command = await service.propose(plan!, NOW);
    expect(provider.calls).toEqual([{ schemaVersion: 1, currentUserText: 'أنا ساكن في المعادي، وأخويا بيشتغل في بنك، وأنا بحب القهوة',
      memories: [{ handle: 'm1', type: 'PERSONAL_FACT', content: 'بشتغل مهندس.' }] }]);
    expect(JSON.stringify(provider.calls)).not.toContain(ID(1));
    expect(command.items.map((item) => item.content)).toEqual(['أنا ساكن في المعادي.']); // other person and duplicate dropped
    expect(command.index).toEqual([{ memoryId: ID(1), slot: 'OCCUPATION', temporal: 'CURRENT', terms: expect.arrayContaining(['job']) }]);
  });

  it('a provider failure proposes nothing and indexes nothing, so the backfill runs again later', async () => {
    const { service, provider } = setup([{ memoryId: ID(1), type: 'PERSONAL_FACT' as never, content: 'بشتغل مهندس.' }]);
    provider.setFailure('TIMEOUT');
    const plan = await service.prepare(context, 'أنا ساكن في المعادي', NOW);
    await expect(service.propose(plan!, NOW)).resolves.toEqual({ items: [], index: [] });
  });

  it('a read failure happens before any claim and surfaces to the dispatcher', async () => {
    const { service, data } = setup();
    data.listUnindexedMemories.mockRejectedValue(new Error('BACKGROUND_UNDERSTANDING_BACKFILL_INTEGRITY'));
    await expect(service.prepare(context, 'أنا ساكن في المعادي', NOW)).rejects.toThrow('BACKFILL_INTEGRITY');
  });
});
