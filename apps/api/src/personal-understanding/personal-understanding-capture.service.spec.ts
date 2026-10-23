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
    ], settle: [{ memoryId: ID(2), slot: null, temporal: 'CURRENT', terms: [] }] });
    expect(data.listCaptureScreenMemories).not.toHaveBeenCalled();
  });

  // CP2 R3: four Memories that may never reach the provider must not hold the bounded backfill window forever.
  describe('R3 - unsendable Memories never starve the backfill', () => {
    const long = `أنا ${'ب'.repeat(1_200)} بحب القهوة.`;
    const unsendable = [
      { memoryId: ID(1), type: 'PERSONAL_FACT' as never, content: long },
      { memoryId: ID(2), type: 'PERSONAL_FACT' as never, content: 'رقم الحساب 1234.' },
      { memoryId: ID(3), type: 'PERSONAL_FACT' as never, content: `${long} تاني` },
      { memoryId: ID(4), type: 'PERSONAL_FACT' as never, content: 'كلمة السر بتاعتي 1234' },
    ];

    it('settles all four without the model, so the next backfill read reaches the older eligible Memories', async () => {
      const { service, provider } = setup(unsendable);
      const plan = await service.prepare(context, 'تمام', NOW);
      expect(plan?.backlog).toEqual([]);
      const command = await service.propose(plan!, NOW);
      expect(provider.calls).toEqual([]); // nothing to send: no provider call at all
      expect(command.items).toEqual([]);
      expect(command.index.map((entry) => entry.memoryId)).toEqual([ID(1), ID(2), ID(3), ID(4)]);
      expect(command.index.every((entry) => entry.slot === null)).toBe(true);
    });

    it('a secret-bearing Memory is settled under no term; a long one under its own words only', async () => {
      const { service } = setup(unsendable);
      const command = await service.propose((await service.prepare(context, 'تمام', NOW))!, NOW);
      const terms = Object.fromEntries(command.index.map((entry) => [entry.memoryId, entry.terms]));
      expect([terms[ID(2)], terms[ID(4)]]).toEqual([[], []]);
      expect(terms[ID(1)].length).toBeGreaterThan(0);
      expect(terms[ID(1)].join(' ')).not.toMatch(/1234/u);
    });

    it('never sends an unsendable Memory, even beside a message and an eligible one, and still settles it on a provider failure', async () => {
      const { service, provider } = setup([unsendable[1], { memoryId: ID(5), type: 'PERSONAL_FACT' as never, content: 'بشتغل مهندس.' }]);
      const plan = await service.prepare(context, 'أنا ساكن في المعادي', NOW);
      await service.propose(plan!, NOW);
      expect(provider.calls[0].memories).toEqual([{ handle: 'm1', type: 'PERSONAL_FACT', content: 'بشتغل مهندس.' }]);
      expect(JSON.stringify(provider.calls)).not.toContain('1234');
      provider.setFailure('TIMEOUT');
      const failed = await service.propose(plan!, NOW);
      expect(failed).toEqual({ items: [], index: [{ memoryId: ID(2), slot: null, temporal: 'CURRENT', terms: [] }] });
    });
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
