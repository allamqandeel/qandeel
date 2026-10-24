import {
  MAX_MEMORY_CONTEXT_CHARACTERS, MAX_SELECTED_MEMORIES, MEMORY_CANDIDATE_LIMIT,
  MemoryRetrieverService, SEMANTIC_CANDIDATE_LIMIT, selectMemories,
} from './memory-retriever.service';
import { MemoryRuntimeService } from './memory-runtime.service';
import type { MemoryRecord } from './memory.types';

const memory = (id: string, content: string, overrides: Partial<MemoryRecord> = {}): MemoryRecord => ({
  id, user_id: 'user-a', scope: 'USER', type: 'PERSONAL_FACT', content, source: 'USER_STATED',
  confidence: 0.5, importance: 0.5, status: 'ACTIVE', version: 1,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  expires_at: null, supersedes_memory_id: null, subject: 'SELF', ...overrides,
});

describe('MemoryRetrieverService', () => {
  let runtime: jest.Mocked<MemoryRuntimeService>;
  let retriever: MemoryRetrieverService;

  beforeEach(() => {
    runtime = { listActiveForUser: jest.fn().mockResolvedValue([]), retrieveSemanticCandidates: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<MemoryRuntimeService>;
    retriever = new MemoryRetrieverService(runtime);
  });

  it.each(['hello', 'thanks', 'تمام', 'What is the capital of Egypt?'])('skips non-personal turn %s without a query', async (content) => {
    await expect(retriever.retrieve('user-a', 'token-a', content)).resolves.toEqual([]);
    expect(runtime.listActiveForUser).not.toHaveBeenCalled();
  });

  it.each(['what did I tell you about my job?', 'فاكر موضوع الشغل؟', 'قلتلك قبل كده عن احمد'])('attempts bounded authenticated retrieval for %s', async (content) => {
    await retriever.retrieve('user-a', 'token-a', content);
    expect(runtime.listActiveForUser).toHaveBeenCalledWith('user-a', 'token-a', MEMORY_CANDIDATE_LIMIT);
  });

  it('uses generic explicit recall for arbitrary names without treating names alone as policy signals', async () => {
    expect(retriever.shouldRetrieve('يوسف')).toBe(false);
    await retriever.retrieve('user-a', 'token-a', 'فاكر موضوع يوسف؟');
    expect(runtime.listActiveForUser).toHaveBeenCalledWith('user-a', 'token-a', MEMORY_CANDIDATE_LIMIT);
  });

  it('returns no fabricated memory when an explicit recall has no relevant lexical match', async () => {
    runtime.listActiveForUser.mockResolvedValue([memory('1', 'I prefer tea')]);
    await expect(retriever.retrieve('user-a', 'token-a', 'remember my job?')).resolves.toEqual([]);
  });

  it('ranks deterministically with relevance primary and importance, confidence, then recency as bounded signals', () => {
    const candidates = [
      memory('irrelevant', 'My divorce hearing is tomorrow', { importance: 1, confidence: 1 }),
      memory('low', 'My job is in design', { importance: 0.2, confidence: 0.2 }),
      memory('important', 'My job goal is management', { importance: 0.9, confidence: 0.2 }),
      memory('confident-old', 'My job preference is remote', { importance: 0.5, confidence: 0.9 }),
      memory('confident-new', 'My job plan is remote', { importance: 0.5, confidence: 0.9, updated_at: '2026-02-01T00:00:00.000Z' }),
    ];
    const first = selectMemories('remember my job', candidates);
    expect(first).toEqual(selectMemories('remember my job', [...candidates].reverse()));
    expect(first.map(({ content }) => content)).not.toContain('My divorce hearing is tomorrow');
    expect(first[0].content).toBe('My job goal is management');
  });

  it('supports conservative Arabic normalization and lexical relevance', () => {
    expect(selectMemories('فاكر شُغلي؟', [memory('1', 'شغلي في التصميم'), memory('2', 'بحب الشاي')]))
      .toEqual([{ type: 'PERSONAL_FACT', content: 'شغلي في التصميم', source: 'USER_STATED', about: 'USER' }]);
  });

  it('deduplicates and enforces top-K and total character budget without truncation', () => {
    const candidates = [memory('dup-old', 'job remote'), memory('dup-new', ' JOB   REMOTE ', { updated_at: '2026-02-01T00:00:00.000Z' })];
    expect(selectMemories('job remote', candidates)).toHaveLength(1);
    expect(selectMemories('job', Array.from({ length: 8 }, (_, index) => memory(String(index), `job item ${index}`))))
      .toHaveLength(MAX_SELECTED_MEMORIES);
    const oversized = memory('large', `job ${'x'.repeat(MAX_MEMORY_CONTEXT_CHARACTERS)}`);
    expect(selectMemories('job', [oversized, memory('fits', 'job fits')])).toEqual([
      { type: 'PERSONAL_FACT', content: 'job fits', source: 'USER_STATED', about: 'USER' },
    ]);
  });

  it('MEM-AR-01C (L-3, MF-2): serves SELF, OTHER and UNATTRIBUTED Memories alike, each saying whom it concerns', () => {
    const served = selectMemories('job', [
      memory('a', 'my job is design', { subject: 'SELF' }),
      memory('b', 'my sister job is law', { subject: 'OTHER' }),
      memory('c', 'job was mentioned once', { subject: null }),
      memory('d', 'job without an embed'),
    ].map((row, index) => (index === 3 ? { ...row, subject: undefined } : row)));
    expect(served.map(({ content, about }) => [content, about])).toEqual([
      ['my job is design', 'USER'], ['my sister job is law', 'SOMEONE_ELSE'],
      ['job was mentioned once', 'NOT_RECORDED'], ['job without an embed', 'NOT_RECORDED'],
    ]);
  });

  // ---- MEM-AR-01A (F-2) -----------------------------------------------------------------------------------------
  describe('MEM-AR-01A lexical recall: shared normalizer + light stem, nothing semantic', () => {
    const served = (query: string, candidates: ReadonlyArray<MemoryRecord>) => selectMemories(query, candidates).map(({ content }) => content);

    it('a feminine question meets the stored masculine (legacy) form, and the reverse', () => {
      expect(served('فاكر أنا ساكنة فين؟', [memory('1', 'أنا ساكن في مدينة نصر.'), memory('2', 'أنا بحب الشاي.')])).toEqual(['أنا ساكن في مدينة نصر.']);
      expect(served('فاكر أنا ساكن فين؟', [memory('1', 'أنا ساكنة في مدينة نصر.')])).toEqual(['أنا ساكنة في مدينة نصر.']);
    });

    it('a clitic-inflected word meets its plain form («للهدوء» → «الهدوء»)', () => {
      expect(served('بالنسبة للهدوء اللي بحبه، ده هيأثر على اختياري؟', [memory('1', 'أنا بحب الهدوء والبيت المستقر.'), memory('2', 'هدفي أكون أسرة صغيرة.')]))
        .toEqual(['أنا بحب الهدوء والبيت المستقر.']);
    });

    it('«إني», «إنه», «إنها» are particles: they never produce a hit on their own', () => {
      const plan = memory('plan', 'هدفي إني أسيب الشغل خلال 6 شهور.');
      expect(served('فاكر إني؟', [plan])).toEqual([]);
      expect(served('فاكر لما قلتلك إني بحب الهدوء؟', [plan, memory('calm', 'أنا بحب الهدوء.')])).toEqual(['أنا بحب الهدوء.']);
      expect(served('فاكر إنه قال إنها مسافرة؟', [plan])).toEqual([]);
    });

    it('tatweel, harakat and Arabic-Indic digits do not split a match', () => {
      expect(served('فاكر الشــاي؟', [memory('1', 'أنا بحب الشاي.')])).toEqual(['أنا بحب الشاي.']);
      expect(served('فاكر شُغلي؟', [memory('1', 'شغلي في التصميم')])).toEqual(['شغلي في التصميم']);
      expect(served('فاكر الأوضة ٢٩؟', [memory('1', 'رقم الأوضة 29.'), memory('2', 'أنا بحب الشاي.')])).toEqual(['رقم الأوضة 29.']);
    });

    it('a paraphrase stays a recorded miss: «التدخين» does not meet «بيدخن» (K1.10, no semantic guess)', () => {
      expect(served('فاكر قلتلك إيه عن التدخين؟', [memory('1', 'قررت إني مش هتجوز حد بيدخن.')])).toEqual([]);
    });

    it('the bounds and the exact-match ordering are unchanged', () => {
      expect(MEMORY_CANDIDATE_LIMIT).toBe(32);
      expect(MAX_SELECTED_MEMORIES).toBe(4);
      expect(MAX_MEMORY_CONTEXT_CHARACTERS).toBe(2400);
      const exact = memory('exact', 'أنا ساكن في طنطا.', { importance: 0.2, confidence: 0.2 });
      const partial = memory('partial', 'صاحبي في طنطا.', { importance: 1, confidence: 1 });
      expect(served('فاكر أنا ساكن في طنطا؟', [partial, exact])).toEqual(['أنا ساكن في طنطا.', 'صاحبي في طنطا.']);
      expect(served('فاكر الشغل؟', Array.from({ length: 8 }, (_, index) => memory(String(index), `الشغل رقم ${index}`)))).toHaveLength(MAX_SELECTED_MEMORIES);
    });

    // G-A1 RC-A2: «بحب» is not what a Memory is about.
    const calm = memory('calm', 'أنا بحب الهدوء والبيت المستقر.');
    const travel = memory('travel', 'بحب السفر جدا.');
    const tea = memory('tea', 'أنا بحب الشاي.');

    it('«بحب» never selects a Memory on its own while the other words select one (K1.9)', () => {
      expect(served('فاكر لما قلتلك إني بحب الهدوء؟', [calm, travel, tea])).toEqual(['أنا بحب الهدوء والبيت المستقر.']);
      expect(served('بالنسبة للهدوء اللي بحبه، ده هيأثر على اختياري؟', [calm, travel])).toEqual(['أنا بحب الهدوء والبيت المستقر.']);
      expect(served('فاكر إني بحبها، السفر؟', [calm, travel])).toEqual(['بحب السفر جدا.']);
    });

    it('a question about what the user likes still recalls every «بحب» Memory, in the unchanged order', () => {
      expect(served('فاكر أنا بحب إيه؟', [calm, travel, tea])).toEqual(selectMemories('فاكر أنا بحب إيه؟', [tea, travel, calm]).map(({ content }) => content));
      expect(served('فاكر أنا بحب إيه؟', [calm, travel, tea])).toHaveLength(3);
    });

    it('when the other words select nothing, the earlier «بحب» behaviour is kept rather than serving nothing', () => {
      expect(served('فاكر إني بحب القهوة؟', [calm, travel])).toEqual(served('فاكر إني بحب؟', [calm, travel]));
      expect(served('فاكر إني بحب القهوة؟', [calm, travel])).toHaveLength(2);
    });

    it('other predicates and every other token are untouched', () => {
      expect(served('فاكر أنا ساكنة فين؟', [memory('home', 'أنا ساكن في مدينة نصر.'), calm])).toEqual(['أنا ساكن في مدينة نصر.']);
      expect(served('I love tea, remember?', [memory('en', 'I love hiking.'), memory('en2', 'I drink tea.')])).toHaveLength(2);
      expect(served('فاكر الشاي؟', [calm, tea])).toEqual(['أنا بحب الشاي.']);
    });
  });

  it('IP-IMP-01 (WP4): a legacy INTERACTION_PREFERENCE Memory never reaches the model; the canonical record is the one authority', () => {
    const candidates = [
      memory('legacy', 'كلمني بالمصري.', { type: 'INTERACTION_PREFERENCE', importance: 0.9 }),
      memory('legacy-en', 'Speak to me in English.', { type: 'INTERACTION_PREFERENCE', importance: 0.9 }),
      memory('fact', 'بحب الأكل المصري.'),
    ];
    expect(selectMemories('فاكر الأكل المصري؟', candidates).map((m) => m.content)).toEqual(['بحب الأكل المصري.']);
    expect(selectMemories('do you remember: speak to me in English', candidates)).toEqual([]);
  });
  // S8A-03 CP2 (Founder option B): the semantic index path. No model call at read time; eligibility is the database's.
  describe('S8A-03 CP2 semantic retrieval', () => {
    const row = (record: MemoryRecord, hits: number, slot: string | null = null, unsettled = false) => ({ memory: record, hits, slot, unsettled });

    it('finds a fact by a paraphrase with no recall cue, through the index, and never reads the recent window for it', async () => {
      runtime.retrieveSemanticCandidates.mockResolvedValue([row(memory('m1', 'أنا ساكن في المعادي.'), 1, 'RESIDENCE')]);
      const served = await retriever.retrieve('user-a', 'token-a', 'هو أنا عايش في أنهي منطقة؟');
      expect(served).toEqual([{ type: 'PERSONAL_FACT', content: 'أنا ساكن في المعادي.', source: 'USER_STATED', about: 'USER' }]);
      expect(runtime.listActiveForUser).not.toHaveBeenCalled();
      const [user, token, terms, limit] = runtime.retrieveSemanticCandidates.mock.calls[0];
      expect([user, token, limit]).toEqual(['user-a', 'token-a', SEMANTIC_CANDIDATE_LIMIT]);
      expect(terms.length).toBeGreaterThan(0);
      expect(terms.length).toBeLessThanOrEqual(32);
    });

    it('serves an indexed Memory older than the 32 most recent alongside the recall path', async () => {
      runtime.listActiveForUser.mockResolvedValue(Array.from({ length: 32 }, (_, n) => memory(`recent-${n}`, `ملاحظة رقم ${n}`)));
      runtime.retrieveSemanticCandidates.mockResolvedValue([row(memory('old', 'بشتغل مهندس في فودافون.', { updated_at: '2020-01-01T00:00:00.000Z' }), 2, 'EMPLOYER')]);
      const served = await retriever.retrieve('user-a', 'token-a', 'فاكر أنا بشتغل فين؟');
      expect(served.map((item) => item.content)).toContain('بشتغل مهندس في فودافون.');
    });

    it('is fail-soft: an index failure serves the recall path alone', async () => {
      runtime.listActiveForUser.mockResolvedValue([memory('1', 'شغلي في التصميم')]);
      runtime.retrieveSemanticCandidates.mockRejectedValue(new Error('index down'));
      await expect(retriever.retrieve('user-a', 'token-a', 'فاكر شغلي؟')).resolves.toEqual([
        { type: 'PERSONAL_FACT', content: 'شغلي في التصميم', source: 'USER_STATED', about: 'USER' },
      ]);
    });

    it('never serves an UNSETTLED current fact alone: the other facts of its slot follow it, all marked UNSETTLED', () => {
      const served = selectMemories('أنا ساكن فين؟', [], [
        row(memory('a', 'أنا ساكن في المعادي.'), 1, 'RESIDENCE', true),
        row(memory('b', 'أنا عايش في مدينة نصر.'), 0, 'RESIDENCE', true),
        row(memory('c', 'بشتغل مهندس.'), 0, 'OCCUPATION', false),
      ]);
      expect(served).toEqual([
        { type: 'PERSONAL_FACT', content: 'أنا ساكن في المعادي.', source: 'USER_STATED', about: 'USER', standing: 'UNSETTLED' },
        { type: 'PERSONAL_FACT', content: 'أنا عايش في مدينة نصر.', source: 'USER_STATED', about: 'USER', standing: 'UNSETTLED' },
      ]);
    });

    // CP2 R1: two employers held at once are not a confirmed conflict. They are served together, UNSETTLED, and nothing
    // the retriever emits names a conflict.
    it('R1 - two simultaneous employers are served together as UNSETTLED, never as CONFLICTING', () => {
      const served = selectMemories('بشتغل فين؟', [], [
        row(memory('bank', 'بشتغل في بنك مصر الصبح.'), 1, 'EMPLOYER', true),
        row(memory('clinic', 'وبشتغل كمان في عيادة بالليل.'), 1, 'EMPLOYER', true),
      ]);
      expect(served.map((item) => item.standing)).toEqual(['UNSETTLED', 'UNSETTLED']);
      expect(JSON.stringify(served)).not.toMatch(/CONFLICT/u);
    });

    // CP2 R2: the same-slot unit is served whole or not at all, inside MAX_SELECTED_MEMORIES and
    // MAX_MEMORY_CONTEXT_CHARACTERS.
    describe('R2 - the same-slot unit never breaks the explicit bounds', () => {
      it('three Memories served first leave one place: a two-Memory unit does not fit, so neither side is served', () => {
        const served = selectMemories('أنا ساكن فين؟', [], [
          row(memory('s1', 'أنا ساكن جنب النادي.', { importance: 0.9 }), 3),
          row(memory('s2', 'أنا ساكن قريب من الشغل.', { importance: 0.9 }), 3),
          row(memory('s3', 'أنا ساكن في الدور التالت.', { importance: 0.9 }), 3),
          row(memory('a', 'أنا ساكن في المعادي.', { importance: 0.1 }), 1, 'RESIDENCE', true),
          row(memory('b', 'أنا عايش في مدينة نصر.', { importance: 0.1 }), 1, 'RESIDENCE', true),
        ]);
        expect(served.map((item) => item.content)).toEqual(['أنا ساكن جنب النادي.', 'أنا ساكن قريب من الشغل.', 'أنا ساكن في الدور التالت.']);
        expect(served.some((item) => item.standing === 'UNSETTLED')).toBe(false);
      });

      it('a unit larger than the places left is skipped whole, and a later Memory still gets its place', () => {
        const unit = ['أ', 'ب', 'ج', 'د', 'ه'].map((label, n) => row(memory(`u${n}`, `أنا ساكن في الحي ${label}.`), 2, 'RESIDENCE', true));
        const served = selectMemories('أنا ساكن فين؟', [], [...unit, row(memory('free', 'أنا ساكن لوحدي.'), 1)]);
        expect(served).toEqual([{ type: 'PERSONAL_FACT', content: 'أنا ساكن لوحدي.', source: 'USER_STATED', about: 'USER' }]);
      });

      it('a unit whose second side would pass the character budget is not served half: neither side appears', () => {
        const served = selectMemories('أنا ساكن فين؟', [], [
          row(memory('a', `أنا ساكن في ${'س'.repeat(MAX_MEMORY_CONTEXT_CHARACTERS - 40)}`), 2, 'RESIDENCE', true),
          row(memory('b', 'أنا عايش في مدينة نصر في شارع طويل اسمه مكتوب بالكامل هنا.'), 1, 'RESIDENCE', true),
        ]);
        expect(served).toEqual([]);
      });

      it('a unit that fits is served whole, and the total stays inside both bounds', () => {
        const served = selectMemories('أنا ساكن فين؟', [], [
          row(memory('a', 'أنا ساكن في المعادي.'), 2, 'RESIDENCE', true),
          row(memory('b', 'أنا عايش في مدينة نصر.'), 1, 'RESIDENCE', true),
          row(memory('c', 'أنا ساكن مع صحابي.'), 1),
          row(memory('d', 'أنا ساكن في الدور التالت.'), 1),
          row(memory('e', 'أنا ساكن من سنتين.'), 1),
        ]);
        expect(served).toHaveLength(MAX_SELECTED_MEMORIES);
        expect(served.filter((item) => item.standing === 'UNSETTLED').map((item) => item.content)).toEqual(['أنا ساكن في المعادي.', 'أنا عايش في مدينة نصر.']);
        expect(served.reduce((sum, item) => sum + item.content.length, 0)).toBeLessThanOrEqual(MAX_MEMORY_CONTEXT_CHARACTERS);
      });
    });

    it('adds no standing to a settled fact and never serves a legacy Interaction Preference', () => {
      const served = selectMemories('بشتغل إيه؟', [], [
        row(memory('a', 'بشتغل مهندس.'), 1, 'OCCUPATION'),
        row(memory('p', 'كلمني بالإنجليزي.', { type: 'INTERACTION_PREFERENCE' }), 3),
      ]);
      expect(served).toEqual([{ type: 'PERSONAL_FACT', content: 'بشتغل مهندس.', source: 'USER_STATED', about: 'USER' }]);
    });

    it('with no indexed rows the selection is exactly the MEM-AR-01A lexical selection', () => {
      const candidates = [memory('1', 'شغلي في التصميم'), memory('2', 'بحب الشاي')];
      expect(selectMemories('فاكر شغلي؟', candidates, [])).toEqual(selectMemories('فاكر شغلي؟', candidates));
    });
  });
});
