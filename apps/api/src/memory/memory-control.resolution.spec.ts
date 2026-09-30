import type { MemoryRecord } from './memory.types';
import { distinctiveWords, resolveMemoryTarget } from './memory-control.resolution';

const USER = '00000000-0000-4000-8000-000000000001';
let sequence = 0;
function memory(content: string, overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`, user_id: USER, scope: 'USER', type: 'PERSONAL_FACT',
    content, source: 'USER_STATED', confidence: 0.95, importance: 0.65, status: 'ACTIVE', version: 1,
    created_at: '2026-09-30T10:00:00.000Z', updated_at: '2026-09-30T10:00:00.000Z', expires_at: null, supersedes_memory_id: null,
    ...overrides,
  };
}

describe('W3-MEGA-M Memory target resolution', () => {
  it('keeps only distinctive words, with light Arabic stemming', () => {
    expect([...distinctiveWords('أنا مش ساكن في أكتوبر دلوقتي')]).toEqual(['ساكن', 'اكتوبر']);
    expect([...distinctiveWords('امسح موضوع الشغل')]).toEqual(['امسح', 'شغل']);
    expect(distinctiveWords('شغلي في البنك').has('شغل')).toBe(true);
    expect(distinctiveWords('المعلومة دي معايا').size).toBe(0);
    expect(distinctiveWords('that information').size).toBe(0);
  });

  it('RESOLVES only when every distinctive word is in exactly one Memory', () => {
    const october = memory('أنا ساكن في أكتوبر.');
    const tanta = memory('صاحبي ساكن في طنطا.');
    expect(resolveMemoryTarget('ساكن في أكتوبر دلوقتي', [october, tanta])).toEqual({ state: 'RESOLVED', memory: october });
    expect(resolveMemoryTarget('live in October', [memory('I live in October.'), memory('I like tea.')]).state).toBe('RESOLVED');
  });

  it('two full matches are AMBIGUOUS, in the given (recency) order — never the "best" one', () => {
    const bank = memory('شغلي الجديد في البنك.');
    const boss = memory('مديري في الشغل صعب.');
    expect(resolveMemoryTarget('موضوع الشغل', [bank, boss, memory('أنا بحب القهوة.')])).toEqual({ state: 'AMBIGUOUS', options: [bank, boss] });
  });

  it('a partial match is never acted on: it is PARTIAL, for the caller to ask about or leave alone', () => {
    const cafe = memory('أنا بحب كافيه النيل.');
    expect(resolveMemoryTarget('كافيه الزمالك', [cafe])).toEqual({ state: 'PARTIAL', options: [cafe] });
  });

  it('a predicate alone («بحب», "like") never names a Memory, even when it is all the words there are', () => {
    const kushari = memory('أنا بحب الكشري.');
    expect(resolveMemoryTarget('إني بحب المكان ده', [kushari])).toEqual({ state: 'NONE' });
    expect(resolveMemoryTarget('إني بحب', [kushari])).toEqual({ state: 'PARTIAL', options: [kushari] });
    expect(resolveMemoryTarget('that I like', [memory('I like tea.')]).state).toBe('PARTIAL');
  });

  it('offers at most three options', () => {
    const many = [1, 2, 3, 4, 5].map((n) => memory(`الشغل رقم ${n}`));
    const result = resolveMemoryTarget('الشغل', many);
    expect(result.state === 'AMBIGUOUS' && result.options).toEqual(many.slice(0, 3));
  });

  it('NONE when nothing matches, UNSPECIFIED when the words name nothing', () => {
    expect(resolveMemoryTarget('بحب الشاي', [memory('أنا ساكن في طنطا.')])).toEqual({ state: 'NONE' });
    expect(resolveMemoryTarget('المعلومة دي', [memory('أنا ساكن في طنطا.')])).toEqual({ state: 'UNSPECIFIED' });
  });
});
