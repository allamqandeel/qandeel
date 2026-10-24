import { FakePersonalUnderstandingCaptureProvider } from './fake-personal-understanding-capture.provider';
import { capturableMessage, PersonalUnderstandingCaptureService } from './personal-understanding-capture.service';
import type { UnderstandingFactProposalV3 } from './personal-understanding.types';

const NOW = new Date('2026-10-24T10:00:00.000Z');
const context = { executionId: 'e', sourceTurnId: 't', userId: 'u' } as never;
const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const fact = (span: string, overrides: Partial<UnderstandingFactProposalV3> = {}): UnderstandingFactProposalV3 => ({
  span, owner: 'SELF', ownerBasis: 'IN_SPAN', evidence: null, personName: null, personRelation: null, polarity: 'AFFIRMED', modality: 'STATED',
  temporal: 'CURRENT', type: 'PERSONAL_FACT', slot: null, importance: 'USEFUL', days: null, keys: [], ...overrides,
});
type Known = { memoryId: string; type: string; content: string; subject: 'SELF' | 'OTHER' | 'UNATTRIBUTED'; personName: string | null;
  personRelation: string | null; temporal: string | null; ended: boolean; terms: string[] };
const known = (n: number, content: string, overrides: Partial<Known> = {}): Known => ({
  memoryId: ID(n), type: 'PERSONAL_FACT', content, subject: 'SELF', personName: null, personRelation: null, temporal: 'CURRENT', ended: false, terms: [], ...overrides,
});

function setup(backlog: Array<{ memoryId: string; type: never; content: string }> = [], current: Array<{ id?: string; subject?: string | null; type: string; content: string }> = [],
  knownItems: Known[] = [], turns: Array<{ role: 'USER' | 'ASSISTANT'; content: string }> = []) {
  const data = {
    listUnindexedMemories: jest.fn().mockResolvedValue(backlog), listCaptureScreenMemories: jest.fn().mockResolvedValue(current),
    listKnownMemories: jest.fn().mockResolvedValue(knownItems), listRecentTurns: jest.fn().mockResolvedValue(turns),
  };
  const provider = new FakePersonalUnderstandingCaptureProvider();
  return { data, provider, service: new PersonalUnderstandingCaptureService(data as never, provider) };
}

describe('S8A-03 capture pre-screen (Open Understanding: no first-person word list)', () => {
  it.each([
    ['أنا ساكن في المعادي وبشتغل مهندس', true],
    ['I moved to Alexandria last month', true],
    // Amendment §10: the message is read whatever its wording; the semantic verifier decides what is kept and whose it is.
    ['ازيك عامل ايه النهارده', true],
    ['يعمل أخي ممرضًا في مستشفى حكومي', true],
    ['وسلمى بقت مدرسة إنجليزي', true],
    ['انسى إني ساكن في المعادي', false], // a Memory control command is the foreground's
    ['كلمة السر بتاعتي 1234', false], // a secret is never sent to a provider
    ['أنا', false],
    [`أنا ${'ا'.repeat(1_500)}`, false],
  ])('%s -> %s', (message, sent) => {
    expect(capturableMessage(message) !== null).toBe(sent);
  });

  // S8A-03 CP3 D-2: a negation that restates nothing is a disclosure, not a command. Every correction that restates its
  // predicate, "I'm not X, I'm Y", a natural reversal and a forget stay the foreground's.
  it.each([
    ['أنا مش بدخن خالص، ومش متجوز', true],
    ["I don't like my job, but I need the money", true],
    ['لا، مش ساكن في أكتوبر، ساكن في طنطا', false],
    ['أنا مبقتش ساكن في أكتوبر، أنا دلوقتي ساكن في طنطا', false],
    ['غيرت رأيي، مش بحب الشاي، بحب القهوة', false],
    ["I'm not a teacher, I'm a nurse", false],
    ["I don't live in Cairo anymore, I live in Giza", false],
    ['انسى إني مش بدخن', false],
    ['افتكر إني مش متجوز', false],
  ])('CP3 %s -> %s', (message, sent) => {
    expect(capturableMessage(message) !== null).toBe(sent);
  });
});

describe('PersonalUnderstandingCaptureService (S8A-03 capture schema v3)', () => {
  it('plans nothing - no claim, no call - when there is no capturable message and every Memory is indexed', async () => {
    const { service, data } = setup();
    await expect(service.prepare(context, 'اه', NOW)).resolves.toBeUndefined();
    expect(data.listUnindexedMemories).toHaveBeenCalledWith(context, 4);
    expect(data.listCaptureScreenMemories).not.toHaveBeenCalled();
    expect(data.listKnownMemories).not.toHaveBeenCalled();
    expect(data.listRecentTurns).not.toHaveBeenCalled();
  });

  it('plans backfill alone with opaque handles, never sending a secret-bearing Memory, and reads nothing else', async () => {
    const { service, data } = setup([
      { memoryId: ID(1), type: 'PERSONAL_FACT' as never, content: 'بشتغل مهندس.' },
      { memoryId: ID(2), type: 'PERSONAL_FACT' as never, content: 'رقم الحساب 1234.' },
      { memoryId: ID(3), type: 'GOAL' as never, content: 'عايز أتعلم ألماني.' },
    ]);
    const plan = await service.prepare(context, 'اه', NOW);
    expect(plan).toEqual({ message: null, current: [], known: [], recentTurns: [], backlog: [
      { handle: 'm1', memoryId: ID(1), type: 'PERSONAL_FACT', content: 'بشتغل مهندس.' },
      { handle: 'm2', memoryId: ID(3), type: 'GOAL', content: 'عايز أتعلم ألماني.' },
    ], settle: [{ memoryId: ID(2), slot: null, temporal: 'CURRENT', terms: [] }] });
    expect(data.listCaptureScreenMemories).not.toHaveBeenCalled();
    expect(data.listKnownMemories).not.toHaveBeenCalled();
    expect(data.listRecentTurns).not.toHaveBeenCalled();
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
      const plan = await service.prepare(context, 'اه', NOW);
      expect(plan?.backlog).toEqual([]);
      const command = await service.propose(plan!, NOW);
      expect(provider.calls).toEqual([]); // nothing to send: no provider call at all
      expect(command.items).toEqual([]);
      expect(command.index.map((entry) => entry.memoryId)).toEqual([ID(1), ID(2), ID(3), ID(4)]);
      expect(command.index.every((entry) => entry.slot === null)).toBe(true);
    });

    it('a secret-bearing Memory is settled under no term; a long one under its own words only', async () => {
      const { service } = setup(unsendable);
      const command = await service.propose((await service.prepare(context, 'اه', NOW))!, NOW);
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
      expect(failed).toMatchObject({ items: [], index: [{ memoryId: ID(2), slot: null, temporal: 'CURRENT', terms: [] }], reaffirmed: [], ended: [], forget: [], corrections: [] });
    });
  });

  it('sends the message, the recent turns and what QANDEEL knows under opaque handles - never an identity or a secret', async () => {
    const { service, provider, data } = setup(
      [{ memoryId: ID(1), type: 'PERSONAL_FACT' as never, content: 'بشتغل مهندس.' }], [],
      [known(2, 'مراتي اسمها سلمى.', { subject: 'OTHER', type: 'RELATIONSHIP_CONTEXT', personName: 'سلمى', personRelation: 'مراتي' }),
        known(3, 'أنا ساكن في المعادي.'), known(4, 'رقم الحساب 1234.'), known(5, 'ملاحظة قديمة.', { subject: 'UNATTRIBUTED', temporal: null })],
      [{ role: 'USER', content: 'سلمى بتدور على شغل' }, { role: 'ASSISTANT', content: 'ربنا يوفقها' }, { role: 'USER', content: 'الباسورد 1234' }],
    );
    const plan = await service.prepare(context, 'وبقت مدرسة إنجليزي', NOW);
    expect(data.listKnownMemories).toHaveBeenCalledWith(context, 40);
    expect(data.listRecentTurns).toHaveBeenCalledWith(context, 4);
    await service.propose(plan!, NOW);
    expect(provider.calls).toEqual([{
      schemaVersion: 3, currentUserText: 'وبقت مدرسة إنجليزي',
      recentTurns: [{ role: 'USER', content: 'سلمى بتدور على شغل' }, { role: 'QANDEEL', content: 'ربنا يوفقها' }],
      memories: [{ handle: 'm1', type: 'PERSONAL_FACT', content: 'بشتغل مهندس.' }],
      known: [
        { handle: 'k1', type: 'RELATIONSHIP_CONTEXT', content: 'مراتي اسمها سلمى.', about: 'OTHER: سلمى (مراتي)', temporal: 'CURRENT', ended: false },
        { handle: 'k2', type: 'PERSONAL_FACT', content: 'أنا ساكن في المعادي.', about: 'USER', temporal: 'CURRENT', ended: false },
        { handle: 'k3', type: 'PERSONAL_FACT', content: 'ملاحظة قديمة.', about: 'NOT_RECORDED', temporal: null, ended: false },
      ],
    }]);
    expect(JSON.stringify(provider.calls)).not.toMatch(/1234|00000000-/u);
  });

  it('keeps someone else\'s fact under the person the user named a turn before, and the user\'s own facts as theirs', async () => {
    const { service, provider } = setup([], [{ id: ID(3), subject: 'SELF', type: 'STABLE_PREFERENCE', content: 'بحب القهوة.' }], [],
      [{ role: 'USER', content: 'أخويا حسام اتنقل الدوحة' }]);
    provider.setOutput({ facts: [
      fact('بيشتغل في بنك هناك', { owner: 'OTHER', ownerBasis: 'CONVERSATION', personName: 'حسام', personRelation: 'أخويا' }),
      fact('بحب القهوة', { type: 'STABLE_PREFERENCE' }),
      fact('بيحب الكورة', { owner: 'OTHER', ownerBasis: 'INFERRED', personName: 'حسام' }),
    ] });
    const command = await service.propose((await service.prepare(context, 'بيشتغل في بنك هناك، وأنا لسه بحب القهوة، وبيحب الكورة', NOW))!, NOW);
    expect(command.items.map((item) => [item.content, item.subject, item.personName, item.personRelation, item.slot]))
      .toEqual([['بيشتغل في بنك هناك.', 'OTHER', 'حسام', 'أخويا', null]]);
    expect(command.reaffirmed).toEqual([ID(3)]); // the restated preference moves its living state, it is not a new Memory
  });

  it('forgets, corrects and ends known Memories by handle only, and an ending wins over a restatement', async () => {
    const { service, provider } = setup([], [{ id: ID(7), subject: 'SELF', type: 'PERSONAL_FACT', content: 'أنا بدخن.' }],
      [known(7, 'أنا بدخن.'), known(8, 'عليا قسط عربية.'), known(9, 'ليلى عندها 7 سنين.', { subject: 'OTHER', personName: 'ليلى', personRelation: 'بنتي' })]);
    provider.setOutput({
      facts: [fact('أنا بدخن')],
      context: [{ handle: 'k1', status: 'ENDED', span: 'وبطلت السجاير خلاص' }],
      commands: [
        { kind: 'FORGET', handle: 'k2', span: 'انسى موضوع القسط', replacement: null },
        { kind: 'CORRECT', handle: 'k3', span: 'ليلى عندها 8 مش 7', replacement: fact('ليلى عندها 8', { owner: 'OTHER', ownerBasis: 'IN_SPAN', personName: 'ليلى' }) },
      ],
    });
    const command = await service.propose((await service.prepare(context, 'أنا بدخن. وبطلت السجاير خلاص، وانسى موضوع القسط، وليلى عندها 8 مش 7', NOW))!, NOW);
    expect(command.items).toEqual([]);
    expect([command.ended, command.reaffirmed, command.forget]).toEqual([[ID(7)], [], [ID(8)]]);
    expect(command.corrections).toEqual([expect.objectContaining({ targetMemoryId: ID(9), content: 'ليلى عندها 8.' })]);
  });

  it('a provider failure proposes nothing and indexes nothing, so the backfill runs again later', async () => {
    const { service, provider } = setup([{ memoryId: ID(1), type: 'PERSONAL_FACT' as never, content: 'بشتغل مهندس.' }]);
    provider.setFailure('TIMEOUT');
    const plan = await service.prepare(context, 'أنا ساكن في المعادي', NOW);
    await expect(service.propose(plan!, NOW)).resolves.toMatchObject({ items: [], index: [], reaffirmed: [], ended: [], forget: [], corrections: [] });
  });

  it('a read failure happens before any claim and surfaces to the dispatcher', async () => {
    const { service, data } = setup();
    data.listKnownMemories.mockRejectedValue(new Error('BACKGROUND_UNDERSTANDING_KNOWN_INTEGRITY'));
    await expect(service.prepare(context, 'أنا ساكن في المعادي', NOW)).rejects.toThrow('KNOWN_INTEGRITY');
  });
});
