// S8A-03 Living Personal Memory: the knowledge picture (CORE / CURRENT), its composition with RECALLED inside the ONE
// existing MEMORY slice, and the privacy rules it must keep. Pure fixtures: no database, no provider, no clock.
import { IntegratedContextBudgetAssemblerService } from '../intelligence-runtime/integrated-context-budget-assembler.service';
import { MEMORY_BUDGET_BYTES } from '../intelligence-runtime/integrated-context-budget-contract';
import {
  composeServerGuidance, MEMORY_PERSON_GUIDANCE, memoryContextFixedBytes, renderMemoryContextGuidance, type ModelRouterMemoryContext,
} from '../model-router/model-router.types';
import type { TelemetryService } from '../observability/telemetry.service';
import {
  composeMemoryContext, CORE_BUDGET_SHARE, CURRENT_BUDGET_SHARE, MAX_MEMORY_CONTEXT_CHARACTERS, MAX_SELECTED_MEMORIES,
  MemoryRetrieverService, selectMemories,
} from './memory-retriever.service';
import type { MemoryRuntimeService } from './memory-runtime.service';
import type { MemoryRecord, PersonalKnowledgeSource, SemanticMemoryCandidate } from './memory.types';
import { MAX_CORE_ITEMS, MAX_CURRENT_ITEMS, PERSONAL_KNOWLEDGE_SOURCE_LIMIT, projectPersonalKnowledge } from './personal-knowledge.projection';

let serial = 0;
const id = () => `00000000-0000-4000-8000-${String(++serial).padStart(12, '0')}`;
const row = (content: string, overrides: Partial<PersonalKnowledgeSource> = {}): PersonalKnowledgeSource => ({
  id: id(), type: 'PERSONAL_FACT', content, source: 'USER_STATED', importance: 0.65, created_at: '2026-09-01T00:00:00+00:00',
  expires_at: null, subject: 'SELF', slot: null, temporal: 'CURRENT', last_stated_at: '2026-09-01T00:00:00+00:00', restated_count: 0,
  ended: false, unsettled: false, ...overrides,
});
const record = (source: PersonalKnowledgeSource): MemoryRecord => ({
  id: source.id, user_id: 'user-a', scope: 'USER', type: source.type, content: source.content, source: source.source, confidence: 0.8,
  importance: source.importance, status: 'ACTIVE', version: 1, created_at: source.created_at, updated_at: source.created_at,
  expires_at: source.expires_at, supersedes_memory_id: null, subject: source.subject,
});
const hit = (source: PersonalKnowledgeSource, hits = 1): SemanticMemoryCandidate => ({ memory: record(source), hits, slot: source.slot, unsettled: source.unsettled });
const contents = (items: readonly ModelRouterMemoryContext[]) => items.map((item) => item.content);
const bytes = (items: readonly ModelRouterMemoryContext[]) => Buffer.byteLength(renderMemoryContextGuidance(items), 'utf8');

describe('S8A-03 Living Personal Memory - the knowledge picture', () => {
  it('CORE is identity, family, goals and stated facts, in that priority; CURRENT is states, plans and decisions', () => {
    const home = row('أنا ساكن في المعادي.', { slot: 'RESIDENCE' });
    const job = row('أنا ممرضة في مستشفى حكومي.', { slot: 'OCCUPATION' });
    const married = row('أنا متجوزة من خمس سنين.', { type: 'RELATIONSHIP_CONTEXT' });
    const wife = row('مراتي اسمها سارة.', { type: 'RELATIONSHIP_CONTEXT', subject: 'OTHER' });
    const son = row('ابني يوسف عنده سبع سنين.', { subject: 'OTHER' });
    const goal = row('عايزة أتعلم ألماني.', { type: 'GOAL' });
    const coffee = row('بحب القهوة الصبح.', { type: 'STABLE_PREFERENCE' });
    const exam = row('عندي امتحان بكرة.', { type: 'TEMPORARY_STATE', temporal: 'TEMPORARY', last_stated_at: '2026-10-22T09:00:00+00:00' });
    const plan = row('ناوية أسافر الشهر الجاي.', { temporal: 'PLANNED', last_stated_at: '2026-10-20T09:00:00+00:00' });
    const decision = row('قررت أبطل السكر.', { type: 'DECISION_COMMITMENT', last_stated_at: '2026-10-21T09:00:00+00:00' });
    const picture = projectPersonalKnowledge([coffee, goal, son, wife, married, job, home, exam, plan, decision]);
    // Equal standing within a group falls back to the id order: home < job, married < wife < son.
    expect(picture.core.flatMap((unit) => unit.items).map((item) => [item.content, item.about, item.tier])).toEqual([
      [home.content, 'USER', 'CORE'], [job.content, 'USER', 'CORE'],
      [married.content, 'USER', 'CORE'], [wife.content, 'SOMEONE_ELSE', 'CORE'], [son.content, 'SOMEONE_ELSE', 'CORE'],
      [goal.content, 'USER', 'CORE'], [coffee.content, 'USER', 'CORE'],
    ]);
    expect(picture.current.flatMap((unit) => unit.items)).toEqual([
      { type: 'TEMPORARY_STATE', content: exam.content, source: 'USER_STATED', about: 'USER', tier: 'CURRENT', stated: '2026-10-22' },
      { type: 'DECISION_COMMITMENT', content: decision.content, source: 'USER_STATED', about: 'USER', tier: 'CURRENT', stated: '2026-10-21' },
      { type: 'PERSONAL_FACT', content: plan.content, source: 'USER_STATED', about: 'USER', tier: 'CURRENT', stated: '2026-10-20' },
    ]);
  });

  it('family is core knowledge even when the row is about someone else - and it stays about that person', () => {
    const wife = row('مراتي بتشتغل مدرسة.', { subject: 'OTHER' });
    const myDaughter = row('My daughter Lina is six.', { subject: 'OTHER', type: 'RELATIONSHIP_CONTEXT' });
    const picture = projectPersonalKnowledge([wife, myDaughter]);
    const items = picture.core.flatMap((unit) => unit.items);
    expect(items.map((item) => item.about)).toEqual(['SOMEONE_ELSE', 'SOMEONE_ELSE']);
    expect(items.every((item) => item.standing === undefined)).toBe(true);
  });

  it('never projects someone else who is not named as family, an unattributed row, or what the user did not state', () => {
    const friend = row('صاحبي أحمد بيشتغل في بنك.', { subject: 'OTHER' });
    const colleague = row('زميلي ساكن في المعادي.', { subject: 'OTHER', type: 'RELATIONSHIP_CONTEXT' });
    const unattributed = row('مراتي اسمها سارة.', { subject: null, type: 'RELATIONSHIP_CONTEXT' });
    const kinPreference = row('مراتي بتحب الشاي.', { subject: 'OTHER', type: 'STABLE_PREFERENCE' });
    const derived = row('أنا ساكن في الزمالك.', { source: 'SYSTEM_DERIVED', slot: 'RESIDENCE' });
    const picture = projectPersonalKnowledge([friend, colleague, unattributed, kinPreference, derived]);
    expect([...picture.core, ...picture.current]).toEqual([]);
  });

  it('history is never current: an ended, PAST or past-tense row is in neither tier, and is marked for RECALLED', () => {
    const ended = row('أنا بدخن.', { slot: 'SMOKING', temporal: 'PAST', ended: true });
    const past = row('أنا ساكن في إسكندرية.', { slot: 'RESIDENCE', temporal: 'PAST' });
    const pastTense = row('كنت بشتغل في فودافون.', { temporal: null });
    const endedPlan = row('ناوي أسافر ألمانيا.', { temporal: 'PAST', ended: true });
    const picture = projectPersonalKnowledge([ended, past, pastTense, endedPlan]);
    expect([...picture.core, ...picture.current]).toEqual([]);
    expect([...picture.historical].sort()).toEqual([ended.id, past.id, pastTense.id, endedPlan.id].sort());
  });

  it('silence never ends a current item: an old, never-restated plan stays CURRENT, with the date it was stated', () => {
    const old = row('ناوي أغير شغلي.', { temporal: 'PLANNED', last_stated_at: '2025-01-10T00:00:00+00:00' });
    expect(projectPersonalKnowledge([old]).current.flatMap((unit) => unit.items)).toEqual([
      expect.objectContaining({ content: old.content, tier: 'CURRENT', stated: '2025-01-10' }),
    ]);
  });

  it('two current facts in one slot are ONE unsettled unit, served whole - or not at all when one may not be shown', () => {
    const a = row('أنا ساكن في المعادي.', { slot: 'RESIDENCE', unsettled: true });
    const b = row('أنا ساكن في الشيخ زايد.', { slot: 'RESIDENCE', unsettled: true });
    const unit = projectPersonalKnowledge([a, b]).core;
    expect(unit).toHaveLength(1);
    expect(unit[0].items.map((item) => item.standing)).toEqual(['UNSETTLED', 'UNSETTLED']);
    const derived = { ...b, source: 'SYSTEM_DERIVED' as const };
    expect(projectPersonalKnowledge([a, derived]).core).toEqual([]);
  });

  it('restated facts rank first within a group; the item bounds are never exceeded', () => {
    const many = Array.from({ length: 14 }, (_, n) => row(`حقيقة رقم ${n}.`, { restated_count: n % 3 }));
    const plans = Array.from({ length: 9 }, (_, n) => row(`خطة رقم ${n}.`, { temporal: 'PLANNED' }));
    const picture = projectPersonalKnowledge([...many, ...plans]);
    expect(picture.core.flatMap((unit) => unit.items)).toHaveLength(MAX_CORE_ITEMS);
    expect(picture.current).toHaveLength(MAX_CURRENT_ITEMS);
    expect(picture.core[0].items[0].content).toMatch(/رقم (2|5|8|11)\./u);
  });

  it('a later restatement ranks first', () => {
    const older = row('بحب الجري.', { type: 'STABLE_PREFERENCE', last_stated_at: '2026-01-01T00:00:00+00:00' });
    const newer = row('بحب السباحة.', { type: 'STABLE_PREFERENCE', last_stated_at: '2026-10-01T00:00:00+00:00' });
    expect(contents(projectPersonalKnowledge([older, newer]).core.flatMap((unit) => unit.items))).toEqual([newer.content, older.content]);
  });
});

describe('S8A-03 Living Personal Memory - composition inside the ONE existing MEMORY slice', () => {
  const longArabic = (n: number) => `أنا ${'ساكن في حي هادئ قريب من الشغل والمدرسة '.repeat(6)}${n}.`.slice(0, 280);

  it('the worst case - every tier full of the longest Memories - renders within MEMORY_BUDGET_BYTES and the assembler keeps it whole', () => {
    const core = Array.from({ length: 12 }, (_, n) => row(longArabic(n)));
    const current = Array.from({ length: 8 }, (_, n) => row(longArabic(100 + n), { temporal: 'PLANNED' }));
    const recalled = Array.from({ length: 6 }, (_, n) => row(`${'شغل '.repeat(150)}${n}`.slice(0, 600), { subject: null }));
    const context = composeMemoryContext('شغل', [...core, ...current, ...recalled], [], recalled.map((r) => hit(r)));
    expect(bytes(context)).toBeLessThanOrEqual(MEMORY_BUDGET_BYTES);
    const assembled = new IntegratedContextBudgetAssemblerService({ recordContextBudgetSourceDecision: jest.fn(), recordContextBudgetBytes: jest.fn() } as unknown as TelemetryService)
      .assemble({
        task: 'CONVERSATIONAL_RESPONSE', path: 'FAST', complexity: 'LOW', behavioralGuidance: 'policy',
        messages: [{ role: 'USER', content: 'شغل' }], currentUserContent: 'شغل', locale: 'und', modality: 'TEXT',
        latencyBudgetMs: 3_000, costBudget: 'LOW', safetyLevel: 'STANDARD', memoryContext: context,
      });
    const memory = assembled.decisions.find((decision) => decision.source === 'MEMORY')!;
    expect(memory.outcome).toBe('INCLUDED_FULL');
    expect(memory.retainedBytes).toBe(Buffer.byteLength(composeServerGuidance({ behavioralGuidance: 'policy', memoryContext: context }), 'utf8')
      - Buffer.byteLength(composeServerGuidance({ behavioralGuidance: 'policy' }), 'utf8'));
    // The renderer the projection measures is byte-identical to the section composeServerGuidance appends.
    expect(composeServerGuidance({ behavioralGuidance: 'policy', memoryContext: context }))
      .toBe(composeServerGuidance({ behavioralGuidance: 'policy' }) + renderMemoryContextGuidance(context));
    expect(memory.retainedBytes).toBe(bytes(context));
    // Fewer than the item bounds are served when the bytes run out: 10 + 6 is a bound, never a promise.
    const tiers = context.map((item) => item.tier);
    expect(tiers.filter((tier) => tier === 'CORE').length).toBeLessThan(MAX_CORE_ITEMS);
    expect(tiers.filter((tier) => tier === 'CURRENT').length).toBeLessThan(MAX_CURRENT_ITEMS);
    // RECALLED keeps at least its floor, and never more than its own 4-Memory / 2,400-character caps.
    const recalledItems = context.filter((item) => item.tier === 'RECALLED');
    expect(recalledItems.length).toBeGreaterThan(0);
    expect(recalledItems.length).toBeLessThanOrEqual(MAX_SELECTED_MEMORIES);
    expect(recalledItems.reduce((n, item) => n + item.content.length, 0)).toBeLessThanOrEqual(MAX_MEMORY_CONTEXT_CHARACTERS);
    expect(tiers).toEqual([...tiers].sort((a, b) => ['CORE', 'CURRENT', 'RECALLED'].indexOf(a!) - ['CORE', 'CURRENT', 'RECALLED'].indexOf(b!)));
  });

  it('secondary details never crowd out identity and family: CORE keeps its floor however long the recalled details are', () => {
    const identity = [row('أنا ساكن في المعادي.', { slot: 'RESIDENCE' }), row('مراتي اسمها سارة.', { subject: 'OTHER', type: 'RELATIONSHIP_CONTEXT' })];
    const details = Array.from({ length: 4 }, (_, n) => row(`تفصيلة قديمة عن السفر ${'سفر '.repeat(140)}${n}`.slice(0, 590), { importance: 0.9 }));
    const context = composeMemoryContext('سفر', [...identity, ...details], [], details.map((d) => hit(d, 5)));
    expect(contents(context.filter((item) => item.tier === 'CORE'))).toEqual(expect.arrayContaining(identity.map((r) => r.content)));
    expect(bytes(context)).toBeLessThanOrEqual(MEMORY_BUDGET_BYTES);
  });

  it('CORE and CURRENT never take more than their share, so RECALLED always keeps the rest', () => {
    const core = Array.from({ length: 10 }, (_, n) => row(longArabic(n)));
    const current = Array.from({ length: 6 }, (_, n) => row(longArabic(50 + n), { type: 'DECISION_COMMITMENT' }));
    const context = composeMemoryContext('تمام', [...core, ...current], [], []);
    const pictureBytes = context.reduce((n, item) => n + Buffer.byteLength(JSON.stringify(item), 'utf8') + 1, 0);
    expect(pictureBytes).toBeLessThanOrEqual(MEMORY_BUDGET_BYTES * (CORE_BUDGET_SHARE + CURRENT_BUDGET_SHARE));
  });

  it('RECALLED never repeats what the picture served, and marks history as HISTORICAL', () => {
    const home = row('أنا ساكن في المعادي.', { slot: 'RESIDENCE' });
    const oldHome = row('أنا ساكن في إسكندرية.', { slot: 'RESIDENCE', temporal: 'PAST', ended: true });
    const context = composeMemoryContext('ساكن فين', [home, oldHome], [], [hit(home), hit(oldHome)]);
    expect(context).toEqual([
      expect.objectContaining({ content: home.content, tier: 'CORE' }),
      expect.objectContaining({ content: oldHome.content, tier: 'RECALLED', standing: 'HISTORICAL' }),
    ]);
  });

  it('a forgotten Memory is not in the read, so it is in no tier: nothing derived from it survives (no stored picture)', () => {
    const kept = row('أنا ممرضة.', { slot: 'OCCUPATION' });
    const context = composeMemoryContext('تمام', [kept], [], []);
    expect(contents(context)).toEqual([kept.content]);
  });

  it('without options the CP2 selection is byte-identical (no tier, no HISTORICAL)', () => {
    const past = row('كنت بشتغل في فودافون.');
    const plain = selectMemories('فودافون', [record(past)]);
    expect(plain).toEqual([{ type: 'PERSONAL_FACT', content: past.content, source: 'USER_STATED', about: 'USER' }]);
  });
});

describe('S8A-03 Living Personal Memory - the read path', () => {
  const runtime = (knowledge: () => Promise<PersonalKnowledgeSource[]>) => ({
    listActiveForUser: jest.fn().mockResolvedValue([]),
    retrieveSemanticCandidates: jest.fn().mockResolvedValue([]),
    readPersonalKnowledgeSources: jest.fn(knowledge),
  });

  it('reads the picture on every turn - even «تمام» - in ONE bounded read beside the others, and makes no model call', async () => {
    const home = row('أنا ساكن في المعادي.', { slot: 'RESIDENCE' });
    const r = runtime(async () => [home]);
    const context = await new MemoryRetrieverService(r as unknown as MemoryRuntimeService).retrieve('user-a', 'token-a', 'تمام');
    expect(r.readPersonalKnowledgeSources).toHaveBeenCalledWith('token-a', PERSONAL_KNOWLEDGE_SOURCE_LIMIT);
    expect(contents(context)).toEqual([home.content]);
  });

  it('launches the knowledge read in parallel with the semantic read (no serial stage)', async () => {
    let releaseKnowledge!: () => void;
    const r = runtime(() => new Promise((resolve) => { releaseKnowledge = () => resolve([]); }));
    const pending = new MemoryRetrieverService(r as unknown as MemoryRuntimeService).retrieve('user-a', 'token-a', 'شغلي في المستشفى');
    await Promise.resolve();
    expect(r.retrieveSemanticCandidates).toHaveBeenCalled();
    releaseKnowledge();
    await pending;
  });

  it('is fail-soft: a failed knowledge read serves exactly the CP2 selection', async () => {
    const r = runtime(async () => { throw new Error('PERSONAL_KNOWLEDGE_READ_INTEGRITY'); });
    await expect(new MemoryRetrieverService(r as unknown as MemoryRuntimeService).retrieve('user-a', 'token-a', 'تمام')).resolves.toEqual([]);
  });
});

describe('S8A-03 Open Understanding - person labels (0173, CP2 amendment §10)', () => {
  it('someone else\'s fact is placed by its grounded person label, never by a kin-word list, and stays that person\'s', () => {
    const salma = row('سلمى بقت مدرسة إنجليزي.', { subject: 'OTHER', person_name: 'سلمى', person_relation: 'مراتي' });
    const unlabelled = row('صاحبي أحمد بيشتغل في بنك.', { subject: 'OTHER' });
    const mine = row('أنا ساكن في المعادي.', { slot: 'RESIDENCE', person_name: null, person_relation: null });
    const items = projectPersonalKnowledge([salma, unlabelled, mine]).core.flatMap((unit) => unit.items);
    expect(items.map((item) => [item.content, item.about, item.person])).toEqual([
      ['أنا ساكن في المعادي.', 'USER', undefined],
      ['سلمى بقت مدرسة إنجليزي.', 'SOMEONE_ELSE', 'سلمى (مراتي)'],
    ]);
  });

  it('a recalled SOMEONE_ELSE item names its person too; the guidance sentence is rendered only when an item names one', () => {
    const moved = row('حسام اتنقل الدوحة.', { subject: 'OTHER', person_name: 'حسام', person_relation: 'أخويا', temporal: 'PAST', ended: true });
    const context = composeMemoryContext('حسام', [moved], [], [hit(moved)]);
    expect(context).toEqual([expect.objectContaining({ content: moved.content, tier: 'RECALLED', standing: 'HISTORICAL', person: 'حسام (أخويا)' })]);
    expect(renderMemoryContextGuidance(context)).toContain(MEMORY_PERSON_GUIDANCE);
    expect(renderMemoryContextGuidance([{ type: 'PERSONAL_FACT', content: 'أنا ممرضة.', about: 'USER', tier: 'CORE' }])).not.toContain(MEMORY_PERSON_GUIDANCE);
    // The fixed cost of the section counts the sentence, so the exact bound of the ONE MEMORY slice still holds.
    expect(memoryContextFixedBytes()).toBeGreaterThanOrEqual(Buffer.byteLength(MEMORY_PERSON_GUIDANCE, 'utf8'));
  });
});
