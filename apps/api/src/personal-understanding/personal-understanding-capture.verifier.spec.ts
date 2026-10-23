import {
  carriesFirstPersonSignal,
  verifyFactProposal,
  verifyFactProposals,
  verifyMemoryProposals,
} from './personal-understanding-capture.verifier';
import { memoryRetrievalTerms } from '../memory/memory-retrieval-terms';
import type { UnderstandingFactProposal, VerifiedUnderstandingItem } from './personal-understanding.types';

const NOW = new Date('2026-10-23T10:00:00.000Z');
const fact = (span: string, overrides: Partial<UnderstandingFactProposal> = {}): UnderstandingFactProposal => ({
  span, subject: 'SELF', polarity: 'AFFIRMED', modality: 'STATED', temporal: 'CURRENT', type: 'PERSONAL_FACT', slot: null, keys: [],
  ...overrides,
});
const kept = (proposal: UnderstandingFactProposal, message: string): VerifiedUnderstandingItem => {
  const verdict = verifyFactProposal(proposal, message, NOW);
  if (!('kept' in verdict)) throw new Error(`expected kept, got ${verdict.rejected}`);
  return verdict.kept;
};
const rejected = (proposal: UnderstandingFactProposal, message: string) => {
  const verdict = verifyFactProposal(proposal, message, NOW);
  return 'rejected' in verdict ? verdict.rejected : 'KEPT';
};

describe('S8A-03 CP2 Personal Understanding verifier - natural acquisition', () => {
  it('keeps several facts the user stated in one natural Egyptian message, each as the user said it', () => {
    const message = 'أنا ساكن في المعادي وبشتغل مهندس في شركة فودافون، ومتجوز من سنتين.';
    const { kept: items, rejected: refused } = verifyFactProposals([
      fact('أنا ساكن في المعادي', { slot: 'RESIDENCE', keys: ['سكن', 'عايش فين', 'home'] }),
      fact('بشتغل مهندس', { slot: 'OCCUPATION', keys: ['شغل', 'وظيفة', 'job'] }),
      fact('في شركة فودافون', { slot: 'EMPLOYER', keys: ['شركة', 'employer'] }),
      fact('ومتجوز من سنتين', { slot: 'MARITAL_STATUS', keys: ['جواز', 'مراتي', 'married'] }),
    ], message, [], NOW);
    expect(refused).toEqual(['MALFORMED']); // the fourth kept fact exceeds the three-per-turn bound
    expect(items.map((item) => [item.content, item.slot, item.temporal])).toEqual([
      ['أنا ساكن في المعادي.', 'RESIDENCE', 'CURRENT'],
      ['بشتغل مهندس.', 'OCCUPATION', 'CURRENT'],
      ['في شركة فودافون.', 'EMPLOYER', 'CURRENT'],
    ]);
    for (const item of items) {
      expect(item.importance).toBe(0.65);
      expect(item.expiresAt).toBeNull();
      expect(item.memoryId).toMatch(/^[0-9a-f-]{36}$/u);
    }
  });

  it('carries the first-person subject across clauses of one sentence, but never past someone else', () => {
    expect(kept(fact('ومتجوز من سنتين', { slot: 'MARITAL_STATUS' }), 'أنا ساكن في المعادي، ومتجوز من سنتين').content).toBe('ومتجوز من سنتين.');
    expect(rejected(fact('ومتجوز من سنتين'), 'أخويا ساكن في المعادي، ومتجوز من سنتين')).toBe('NO_FIRST_PERSON');
    expect(rejected(fact('ومتجوز من سنتين'), 'أنا ساكن في المعادي. ومتجوز من سنتين')).toBe('NO_FIRST_PERSON');
  });

  it('keeps an English statement and indexes it under its own words and the proposed keys', () => {
    const item = kept(fact('I work at Google as a data engineer', { slot: 'EMPLOYER', keys: ['job', 'شغل', 'company'] }), 'I work at Google as a data engineer.');
    expect(item.content).toBe('I work at Google as a data engineer.');
    expect(item.terms).toEqual(expect.arrayContaining(['google', 'engineer', 'job', 'company']));
    expect(item.terms.length).toBeLessThanOrEqual(64);
  });

  it('makes a stated fact findable by a later paraphrase through its keys, never by adding words to the Memory', () => {
    const item = kept(fact('أنا ساكن في المعادي', { slot: 'RESIDENCE', keys: ['عايش', 'سكن', 'منطقة', 'بيت'] }), 'أنا ساكن في المعادي');
    expect(item.content).toBe('أنا ساكن في المعادي.');
    const later = memoryRetrievalTerms('هو أنا عايش في أنهي منطقة؟');
    expect(later.some((term) => item.terms.includes(term))).toBe(true);
  });
});

describe('S8A-03 CP2 Personal Understanding verifier - what is never a user fact', () => {
  it('refuses another person, however the model labels it', () => {
    expect(rejected(fact('بيشتغل في بنك مصر', { subject: 'OTHER' }), 'أخويا بيشتغل في بنك مصر')).toBe('NOT_SELF');
    expect(rejected(fact('بيشتغل في بنك مصر'), 'أخويا بيشتغل في بنك مصر')).toBe('THIRD_PARTY');
    expect(rejected(fact('ساكنة في إسكندرية'), 'أختي ساكنة في إسكندرية')).toBe('THIRD_PARTY');
    expect(rejected(fact('works at a bank'), 'My brother works at a bank')).toBe('THIRD_PARTY');
    expect(rejected(fact('بيحب الكورة جدا'), 'بيحب الكورة جدا')).toBe('NO_FIRST_PERSON');
    expect(rejected(fact('بيحب الكورة جدا'), 'أنا شايف إنه بيحب الكورة جدا')).toBe('THIRD_PARTY');
    // «أنا» inside the span itself wins over a mention of someone else earlier in the clause.
    expect(kept(fact('أنا بشتغل في نفس البنك'), 'أخويا وأنا بشتغل في نفس البنك').content).toBe('أنا بشتغل في نفس البنك.');
  });

  it('refuses a quotation or a report of what someone else said', () => {
    expect(rejected(fact('لازم أسيب الشغل'), 'صاحبي قالي لازم أسيب الشغل')).toBe('QUOTED_OR_REPORTED');
    expect(rejected(fact('I am moving to Dubai'), 'My manager said I am moving to Dubai')).toBe('QUOTED_OR_REPORTED');
    expect(rejected(fact('أنا مسافر بكرة'), 'كتبلي «أنا مسافر بكرة» وقفل')).toBe('QUOTED_OR_REPORTED');
    expect(rejected(fact('أنا ساكن في الزمالك', { modality: 'QUOTED' }), 'أنا ساكن في الزمالك')).toBe('NOT_A_STATEMENT');
  });

  it('never stores a negation as its opposite and keeps a negation only with the negating words', () => {
    expect(rejected(fact('بدخن سجاير', { slot: 'SMOKING' }), 'أنا مش بدخن سجاير')).toBe('NEGATION_MISMATCH');
    expect(kept(fact('أنا مش بدخن سجاير', { polarity: 'NEGATED', slot: 'SMOKING' }), 'أنا مش بدخن سجاير').content).toBe('أنا مش بدخن سجاير.');
    expect(rejected(fact('أنا بدخن', { polarity: 'NEGATED' }), 'أنا بدخن')).toBe('NEGATION_MISMATCH');
    expect(rejected(fact('ماشتغلش في البنك'), 'أنا ماشتغلش في البنك')).toBe('NEGATION_MISMATCH');
    expect(rejected(fact('smoke every day'), "I don't smoke every day")).toBe('NEGATION_MISMATCH');
    expect(kept(fact('بطلت التدخين', { polarity: 'NEGATED', slot: 'SMOKING' }), 'بطلت التدخين من شهرين').content).toBe('بطلت التدخين.');
  });

  it('refuses questions, suppositions, wishes and guesses', () => {
    expect(rejected(fact('أنا محتاج أغير شغلي'), 'هل أنا محتاج أغير شغلي؟')).toBe('QUESTION');
    expect(rejected(fact('أنا ساكن في المعادي'), 'أنا ساكن في المعادي؟')).toBe('QUESTION');
    expect(rejected(fact('do I live in Cairo'), 'do I live in Cairo')).toBe('QUESTION');
    expect(rejected(fact('هشتغل في جوجل'), 'لو اتنقلت القاهرة هشتغل في جوجل')).toBe('HYPOTHETICAL');
    expect(rejected(fact('I would quit my job'), 'If they cut my salary I would quit my job')).toBe('HYPOTHETICAL');
    expect(rejected(fact('أبقى دكتور', { modality: 'WISH' }), 'نفسي أبقى دكتور')).toBe('NOT_A_STATEMENT');
    expect(rejected(fact('هسافر ألمانيا'), 'أنا غالبا هسافر ألمانيا')).toBe('SPECULATIVE');
  });

  it('refuses words the user did not write, secrets, and spans too short to stand alone', () => {
    expect(rejected(fact('المستخدم يسكن في المعادي'), 'أنا ساكن في المعادي')).toBe('NOT_VERBATIM');
    expect(rejected(fact('أنا ساكن في مدينة نصر'), 'أنا ساكن في المعادي')).toBe('NOT_VERBATIM');
    expect(rejected(fact('كلمة السر بتاعتي 4455'), 'كلمة السر بتاعتي 4455')).toBe('SENSITIVE_DATA');
    expect(rejected(fact('بدخن'), 'بدخن')).toBe('TOO_SHORT_OR_LONG');
    expect(rejected(fact('الجو حلو النهارده'), 'الجو حلو النهارده')).toBe('NO_FIRST_PERSON');
  });

  it('refuses a malformed proposal without trusting any of its fields', () => {
    expect(rejected({ ...fact('أنا ساكن في المعادي'), slot: 'CITY' as never }, 'أنا ساكن في المعادي')).toBe('MALFORMED');
    expect(rejected({ ...fact('أنا ساكن في المعادي'), keys: Array(17).fill('سكن') }, 'أنا ساكن في المعادي')).toBe('MALFORMED');
    expect(rejected({ ...fact('أنا ساكن في المعادي'), keys: ['x'.repeat(49)] }, 'أنا ساكن في المعادي')).toBe('MALFORMED');
    expect(rejected({ ...fact('أنا ساكن في المعادي'), type: 'INTERACTION_PREFERENCE' as never }, 'أنا ساكن في المعادي')).toBe('MALFORMED');
    expect(rejected({ ...fact('أنا ساكن في المعادي'), span: 7 as never }, 'أنا ساكن في المعادي')).toBe('MALFORMED');
  });
});

describe('S8A-03 CP2 Personal Understanding verifier - time', () => {
  it('keeps a past fact only as PAST: history is never UNSETTLED with a current fact', () => {
    expect(rejected(fact('كنت ساكن في طنطا', { slot: 'RESIDENCE' }), 'كنت ساكن في طنطا')).toBe('TEMPORAL_MISMATCH');
    const past = kept(fact('كنت ساكن في طنطا', { slot: 'RESIDENCE', temporal: 'PAST' }), 'كنت ساكن في طنطا');
    expect([past.temporal, past.slot]).toEqual(['PAST', 'RESIDENCE']);
  });

  it('keeps a near-time state with a bounded expiry and never a passing emotion', () => {
    const tomorrow = kept(fact('عندي امتحان بكرة', { temporal: 'TEMPORARY', type: 'TEMPORARY_STATE', slot: 'STUDY' }), 'عندي امتحان بكرة');
    expect(tomorrow.expiresAt).toBe('2026-10-25T10:00:00.000Z');
    expect(tomorrow.slot).toBe('STUDY');
    expect(tomorrow.importance).toBe(0.5);
    const week = kept(fact('عندي امتحانات الأسبوع ده', { temporal: 'TEMPORARY', type: 'TEMPORARY_STATE' }), 'عندي امتحانات الأسبوع ده');
    expect(week.expiresAt).toBe('2026-11-06T10:00:00.000Z');
    expect(rejected(fact('عندي امتحان مهم', { temporal: 'TEMPORARY', type: 'TEMPORARY_STATE' }), 'عندي امتحان مهم')).toBe('TEMPORAL_MISMATCH');
    expect(rejected(fact('عندي امتحان بكرة', { type: 'TEMPORARY_STATE' }), 'عندي امتحان بكرة')).toBe('TEMPORAL_MISMATCH');
    expect(rejected(fact('أنا متضايق النهارده', { temporal: 'TEMPORARY', type: 'TEMPORARY_STATE' }), 'أنا متضايق النهارده')).toBe('TRANSIENT_EMOTION');
  });

  it('keeps a plan without a slot', () => {
    const plan = kept(fact('هنقل إسكندرية السنة الجاية', { temporal: 'PLANNED', type: 'GOAL', slot: 'RESIDENCE' }), 'أنا هنقل إسكندرية السنة الجاية');
    expect([plan.temporal, plan.slot, plan.type]).toEqual(['PLANNED', null, 'GOAL']);
  });
});

describe('S8A-03 CP2 Personal Understanding verifier - one answer', () => {
  it('drops duplicates within the answer and against a current Memory of the same type', () => {
    const message = 'أنا بحب القهوة. أنا بحب القهوة. وبشتغل مدرس';
    const { kept: items, rejected: refused } = verifyFactProposals([
      fact('أنا بحب القهوة', { type: 'STABLE_PREFERENCE' }),
      fact('أنا بحب القهوة', { type: 'STABLE_PREFERENCE' }),
      fact('وبشتغل مدرس', { slot: 'OCCUPATION' }),
    ], message, [{ type: 'PERSONAL_FACT', content: 'وبشتغل مدرس.' }], NOW);
    expect(items.map((item) => item.content)).toEqual(['أنا بحب القهوة.']);
    expect(refused).toEqual(['DUPLICATE', 'DUPLICATE']);
  });

  it('never lets a capture reverse a current Memory: «بطلت …» is left to the controlled correction', () => {
    const { kept: items, rejected: refused } = verifyFactProposals(
      [fact('بطلت القهوة', { polarity: 'NEGATED', type: 'STABLE_PREFERENCE' })],
      'بطلت القهوة', [{ type: 'STABLE_PREFERENCE', content: 'أنا بحب القهوة.' }], NOW,
    );
    expect(items).toEqual([]);
    expect(refused).toEqual(['REVERSAL_NEEDS_CORRECTION']);
  });

  it('a model answer that is entirely wrong keeps nothing', () => {
    const { kept: items } = verifyFactProposals([
      fact('ساكن في المريخ'), fact('بيشتغل طيار', { subject: 'OTHER' }), fact('أنا مليونير', { modality: 'WISH' }),
    ], 'أخويا بيشتغل طيار ونفسي أبقى مليونير', [], NOW);
    expect(items).toEqual([]);
  });
});

describe('S8A-03 CP2 Personal Understanding verifier - backfill index', () => {
  const memories = [
    { handle: 'm1', memoryId: '00000000-0000-4000-8000-000000000001', type: 'PERSONAL_FACT' as const, content: 'أنا ساكن في المعادي.' },
    { handle: 'm2', memoryId: '00000000-0000-4000-8000-000000000002', type: 'TEMPORARY_STATE' as const, content: 'عندي امتحان بكرة.' },
    { handle: 'm3', memoryId: '00000000-0000-4000-8000-000000000003', type: 'PERSONAL_FACT' as const, content: 'كنت بشتغل في البنك.' },
    { handle: 'm4', memoryId: '00000000-0000-4000-8000-000000000004', type: 'GOAL' as const, content: 'عايز أتعلم ألماني.' },
  ];

  it('indexes every supplied Memory under its own words, adding only verified readings of the model', () => {
    const rows = verifyMemoryProposals([
      { handle: 'm1', slot: 'RESIDENCE', temporal: 'CURRENT', keys: ['سكن', 'home'] },
      { handle: 'm2', slot: 'STUDY', temporal: 'CURRENT', keys: ['exam'] },
      { handle: 'm3', slot: 'EMPLOYER', temporal: 'CURRENT', keys: ['شغل'] },
      { handle: 'm9', slot: 'RESIDENCE', temporal: 'CURRENT', keys: ['ignored'] },
    ], memories);
    expect(rows.map((row) => [row.memoryId.slice(-1), row.slot, row.temporal])).toEqual([
      ['1', 'RESIDENCE', 'CURRENT'],
      ['2', null, 'TEMPORARY'], // a TEMPORARY_STATE is always temporary and never takes a slot
      ['3', null, 'CURRENT'], // «كنت» without PAST: the slot is dropped rather than trusted
      ['4', null, 'CURRENT'], // no proposal: own words only
    ]);
    expect(rows[0].terms).toEqual(expect.arrayContaining([...memoryRetrievalTerms('المعادي'), 'home']));
    expect(rows.flatMap((row) => row.terms)).not.toContain('ignored');
  });

  it('ignores a malformed or repeated handle proposal and keeps the Memory findable by its own words', () => {
    const rows = verifyMemoryProposals([
      { handle: 'm1', slot: 'HOME' as never, temporal: 'CURRENT', keys: ['سكن'] },
      { handle: 'm4', slot: null, temporal: 'PLANNED', keys: ['german'] },
      { handle: 'm4', slot: 'STUDY', temporal: 'CURRENT', keys: ['study'] },
    ], memories);
    expect(rows[0].slot).toBeNull();
    expect(rows[0].terms).not.toContain('سكن');
    expect([rows[3].slot, rows[3].temporal]).toEqual([null, 'PLANNED']);
    expect(rows[3].terms).toContain('german');
    expect(rows[3].terms).not.toContain('study');
  });
});

describe('S8A-03 CP2 first-person pre-screen', () => {
  it.each([
    ['أنا ساكن في المعادي', true], ['بشتغل في بنك', true], ['اتجوزت السنة اللي فاتت', true], ['شغلي بعيد', true],
    ['I live in Cairo', true], ['my sister is a doctor', true],
    ['بيشتغل في بنك', false], ['الجو حلو النهارده', false], ['ازيك عامل ايه', false], ['the weather is nice', false],
  ])('%s -> %s', (message, expected) => {
    expect(carriesFirstPersonSignal(message)).toBe(expected);
  });
});
